"""
Staff side of safety and the support fund.

Rules that are not negotiable:

  * An anonymous report still shows staff who filed it. We cannot act on a
    report we cannot follow up, and abuse of the report system is itself a
    safety problem. "Anonymous" means hidden from the person reported, never
    hidden from the people responsible for acting. Nothing beyond what the
    report row already stores about her is added here — no phone, no address,
    no trusted contacts, no vault, no in-case-of-emergency data.

  * Approving a support request WRITES THE CREDIT. It is one action, not a
    decision followed by somebody remembering to top up a wallet. A grant that
    exists only as a status is a grant that never reaches her.

  * Every write is audited with the row id as the target, so an investigator
    can pull every staff action against one report or one request. Reads are
    not audited (see app/core/audit.py for why).

  * Helplines are curated here but never DEPEND on here: the code list in
    app/models/safety.py answers whenever the curated list is empty or the
    database is unreachable. See `effective_helplines` in routes/safety.py.
"""

import asyncio
import re
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, field_validator

from app.core.audit import record
from app.core.permissions import require_permission
from app.core.deps import get_current_user
from app.core.rbac import MEMBER_ROLE
from app.core.serializers import to_object_id
from app.db.mongodb import get_database
from app.models.conversation import notify
from app.models.role import RoleModel
from app.models.safety import (
    HELPLINES,
    HelplineModel,
    SafetyAlertModel,
    SafetyReportModel,
    TrustedContactModel,
)
from app.models.user import UserModel
from app.models.wallet import SupportRequestModel, WalletTxnModel
from app.routes.safety import effective_helplines, invalidate_helplines
from app.routes.wallet import symbol
from app.schemas.admin_modules import (
    AdminAlert,
    AdminReport,
    AdminSupportRequest,
    AlertDecision,
    ModuleCounts,
    SupportDecision,
)

router = APIRouter(prefix="/admin/safety", tags=["Staff · Safety"])

#: The two statuses that mean "nobody needs to do anything more".
RESOLVED_STATUSES = (SafetyReportModel.STATUS_ACTIONED, SafetyReportModel.STATUS_CLOSED)
OPEN_STATUSES = (SafetyReportModel.STATUS_OPEN, SafetyReportModel.STATUS_REVIEWING)


def _alerts():
    return get_database()[SafetyAlertModel.collection_name]


def _reports():
    return get_database()[SafetyReportModel.collection_name]


def _contacts():
    return get_database()[TrustedContactModel.collection_name]


def _support():
    return get_database()[SupportRequestModel.collection_name]


def _txns():
    return get_database()[WalletTxnModel.collection_name]


def _users():
    return get_database()[UserModel.collection_name]


def _helplines():
    return get_database()[HelplineModel.collection_name]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(v) -> str:
    return v.isoformat() if isinstance(v, datetime) else ""


def _actor_name(me: dict) -> str:
    return me.get("full_name", "") or me.get("email", "") or "Staff"


async def _members(user_ids: list[str]) -> dict[str, dict]:
    oids = []
    for uid in set(user_ids):
        try:
            oids.append(ObjectId(uid))
        except Exception:  # noqa: BLE001
            continue
    if not oids:
        return {}
    rows = await _users().find(
        {"_id": {"$in": oids}}, {"full_name": 1, "email": 1, "phone": 1, "member_id": 1}
    ).to_list(len(oids))
    return {str(r["_id"]): r for r in rows}


async def _noop_list() -> list:
    """An awaitable empty list, so the gather above stays one shape."""
    return []


# --- alerts ------------------------------------------------------------------

@router.get("/alerts", response_model=list[AdminAlert], summary="Safety alerts",
    dependencies=[Depends(require_permission("safety.view"))],
)
async def list_alerts(
    status_filter: str = Query("", alias="status", max_length=20),
    me: dict = Depends(get_current_user),
):
    query = {"status": status_filter} if status_filter else {}
    docs = await _alerts().find(query).sort("created_at", -1).to_list(300)

    # Members and trusted contacts are both "everything for these user_ids",
    # so they go together and each is ONE query rather than one per alert.
    user_ids = [d["user_id"] for d in docs]
    members, contact_rows = await asyncio.gather(
        _members(user_ids),
        _contacts().find({"user_id": {"$in": user_ids}}).to_list(None) if user_ids
        else _noop_list(),
    )
    by_user: dict[str, list] = {}
    for c in contact_rows:
        by_user.setdefault(c["user_id"], []).append(c)

    out = []
    for d in docs:
        u = members.get(d["user_id"], {})
        contacts = by_user.get(d["user_id"], [])
        out.append(
            AdminAlert(
                **SafetyAlertModel.to_response(d),
                member_name=u.get("full_name", d.get("member_name", "—")),
                member_email=u.get("email", ""),
                member_phone=u.get("phone", ""),
                location=d.get("location", ""),
                handled_by=d.get("handled_by", ""),
                contacts=[TrustedContactModel.to_response(c) for c in contacts],
            )
        )
    return out


@router.patch("/alerts/{alert_id}", response_model=AdminAlert, summary="Update an alert",
    dependencies=[Depends(require_permission("safety.edit"))],
)
async def decide_alert(
    alert_id: str, body: AlertDecision, request: Request, me: dict = Depends(get_current_user)
):
    updates: dict = {
        "status": body.status,
        "resolution": body.resolution,
        "handled_by": _actor_name(me),
    }
    if body.status == SafetyAlertModel.STATUS_RESOLVED:
        updates["resolved_at"] = _now()

    doc = await _alerts().find_one_and_update(
        {"_id": to_object_id(alert_id)}, {"$set": updates}, return_document=True
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That alert doesn't exist")

    if body.status == SafetyAlertModel.STATUS_ACKNOWLEDGED:
        await notify(
            get_database(), doc["user_id"],
            "We've seen your alert",
            body.resolution or "Someone from our team is on it and will reach you shortly.",
            "safety", "/app/safety",
        )

    await record(
        me, f"safety.alert.{body.status}", target=alert_id,
        detail=f"Alert marked {body.status}"
        + (f": {body.resolution}" if body.resolution else ""),
        request=request,
    )

    members = await _members([doc["user_id"]])
    u = members.get(doc["user_id"], {})
    contacts = await _contacts().find({"user_id": doc["user_id"]}).to_list(10)
    return AdminAlert(
        **SafetyAlertModel.to_response(doc),
        member_name=u.get("full_name", doc.get("member_name", "—")),
        member_email=u.get("email", ""),
        member_phone=u.get("phone", ""),
        location=doc.get("location", ""),
        handled_by=doc.get("handled_by", ""),
        contacts=[TrustedContactModel.to_response(c) for c in contacts],
    )


# --- reports -----------------------------------------------------------------

class ReportRow(AdminReport):
    """One line in the queue: the report row plus who is on it."""
    filed_at: str = ""
    updated_at: str = ""
    evidence: str = ""
    assigned_to: str = ""
    assigned_to_name: str = ""
    assigned_at: str = ""
    resolved_at: str = ""
    resolved_by: str = ""
    notes_count: int = 0


class ReportDetail(ReportRow):
    """The row plus its internal notes and its status/assignment history."""
    notes: list[dict] = []
    history: list[dict] = []


class ReportSummary(BaseModel):
    open: int
    reviewing: int
    actioned: int
    closed: int
    resolved: int
    total: int
    unassigned_open: int
    assigned_to_me: int


class AssignBody(BaseModel):
    """`me` assigns to the caller, `""` clears it, anything else is a staff user id."""
    assignee_id: str = Field("", max_length=40)


class NoteBody(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)


class ReportStatusBody(BaseModel):
    status: str
    reason: str = Field("", max_length=400)
    staff_note: str = Field("", max_length=2000)

    @field_validator("status")
    @classmethod
    def known(cls, v: str) -> str:
        if v not in ("open", "reviewing", "actioned", "closed"):
            raise ValueError("Unknown status")
        return v


def _report_status_query(status_filter: str) -> dict:
    """
    The screen groups four stored statuses into three columns. `resolved`
    is the alias for "actioned or closed"; `in_review` for the stored word.
    """
    f = (status_filter or "").strip().lower()
    if not f or f == "all":
        return {}
    if f in ("resolved", "done"):
        return {"status": {"$in": list(RESOLVED_STATUSES)}}
    if f in ("in_review", "in-review", "reviewing"):
        return {"status": SafetyReportModel.STATUS_REVIEWING}
    return {"status": f}


def _report_row(d: dict, members: dict[str, dict]) -> dict:
    m = members.get(d["user_id"], {})
    return {
        **SafetyReportModel.to_response(d),
        "member_name": m.get("full_name", "—"),
        "member_email": m.get("email", ""),
        "staff_note": d.get("staff_note", ""),
        "filed_at": _iso(d.get("created_at")),
        "updated_at": _iso(d.get("updated_at")),
        "evidence": d.get("evidence", "") or "",
        "assigned_to": d.get("assigned_to", "") or "",
        "assigned_to_name": d.get("assigned_to_name", "") or "",
        "assigned_at": _iso(d.get("assigned_at")),
        "resolved_at": _iso(d.get("resolved_at")),
        "resolved_by": d.get("resolved_by", "") or "",
        "notes_count": len(d.get("notes") or []),
    }


async def _report_detail(doc: dict) -> ReportDetail:
    members = await _members([doc["user_id"]])
    notes = [
        {**n, "at": _iso(n.get("at"))} for n in (doc.get("notes") or [])
    ]
    history = [
        {**h, "at": _iso(h.get("at"))} for h in (doc.get("history") or [])
    ]
    return ReportDetail(**_report_row(doc, members), notes=notes, history=history)


async def _report_or_404(report_id: str) -> dict:
    doc = await _reports().find_one({"_id": to_object_id(report_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That report doesn't exist")
    return doc


@router.get("/reports", response_model=list[ReportRow], summary="Reports, newest first",
    dependencies=[Depends(require_permission("safety.view"))],
)
async def list_reports(
    status_filter: str = Query("", alias="status", max_length=20),
    assigned: str = Query("", max_length=40, description="`me` for my queue, `none` for unassigned"),
    me: dict = Depends(get_current_user),
):
    query = _report_status_query(status_filter)
    if assigned == "me":
        query["assigned_to"] = str(me["_id"])
    elif assigned == "none":
        query["$or"] = [{"assigned_to": ""}, {"assigned_to": {"$exists": False}}]
    docs = await _reports().find(query).sort("created_at", -1).to_list(300)
    members = await _members([d["user_id"] for d in docs])
    return [ReportRow(**_report_row(d, members)) for d in docs]


@router.get("/reports/summary", response_model=ReportSummary, summary="How many, in each state",
    dependencies=[Depends(require_permission("safety.view"))],
)
async def report_summary(me: dict = Depends(get_current_user)):
    """
    Counted in the database, not from whichever tab happens to be loaded — a
    screen filtered to "New" must still say how many are in review.
    """
    groups = await _reports().aggregate(
        [{"$group": {"_id": "$status", "n": {"$sum": 1}}}]
    ).to_list(None)
    by = {g["_id"]: g["n"] for g in groups}
    unassigned_open, mine = await asyncio.gather(
        _reports().count_documents({
            "status": {"$in": list(OPEN_STATUSES)},
            "$or": [{"assigned_to": ""}, {"assigned_to": {"$exists": False}}],
        }),
        _reports().count_documents({
            "status": {"$in": list(OPEN_STATUSES)}, "assigned_to": str(me["_id"]),
        }),
    )
    return ReportSummary(
        open=by.get("open", 0),
        reviewing=by.get("reviewing", 0),
        actioned=by.get("actioned", 0),
        closed=by.get("closed", 0),
        resolved=by.get("actioned", 0) + by.get("closed", 0),
        total=sum(by.values()),
        unassigned_open=unassigned_open,
        assigned_to_me=mine,
    )


@router.get("/assignees", summary="Staff accounts a report can be assigned to",
    dependencies=[Depends(require_permission("safety.view"))],
)
async def list_assignees(me: dict = Depends(get_current_user)):
    """
    Every active staff account. Deliberately the minimum: id, name, email and
    role — enough to pick a colleague, nothing that belongs on the Staff screen.
    """
    names = {r["name"] async for r in get_database()[RoleModel.collection_name].find({}, {"name": 1})}
    names.discard(MEMBER_ROLE)
    rows = await _users().find(
        {"role": {"$in": sorted(names)}, "is_active": {"$ne": False}},
        {"full_name": 1, "email": 1, "role": 1},
    ).sort("full_name", 1).to_list(200)
    return [
        {
            "id": str(r["_id"]),
            "full_name": r.get("full_name", "") or r.get("email", ""),
            "email": r.get("email", ""),
            "role": r.get("role", ""),
            "is_me": str(r["_id"]) == str(me["_id"]),
        }
        for r in rows
    ]


@router.get("/reports/{report_id}", response_model=ReportDetail, summary="One report, with its notes",
    dependencies=[Depends(require_permission("safety.view"))],
)
async def get_report(report_id: str, me: dict = Depends(get_current_user)):
    return await _report_detail(await _report_or_404(report_id))


@router.post("/reports/{report_id}/assign", response_model=ReportDetail, summary="Assign a report",
    dependencies=[Depends(require_permission("safety.edit"))],
)
async def assign_report(
    report_id: str, body: AssignBody, request: Request, me: dict = Depends(get_current_user)
):
    existing = await _report_or_404(report_id)
    who = (body.assignee_id or "").strip()

    if who == "":
        assignee_id, assignee_name = "", ""
    elif who == "me" or who == str(me["_id"]):
        assignee_id, assignee_name = str(me["_id"]), _actor_name(me)
    else:
        try:
            oid = ObjectId(who)
        except Exception:  # noqa: BLE001
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "That isn't a staff account")
        staff = await _users().find_one({"_id": oid}, {"full_name": 1, "email": 1, "role": 1, "is_active": 1})
        if not staff or staff.get("role") == MEMBER_ROLE or not staff.get("is_active", True):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "That isn't an active staff account")
        assignee_id, assignee_name = str(staff["_id"]), staff.get("full_name", "") or staff.get("email", "")

    now = _now()
    entry = {
        "kind": "assign", "at": now,
        "by_id": str(me["_id"]), "by_name": _actor_name(me),
        "from": existing.get("assigned_to_name", "") or "",
        "to": assignee_name, "reason": "",
    }
    doc = await _reports().find_one_and_update(
        {"_id": existing["_id"]},
        {
            "$set": {
                "assigned_to": assignee_id,
                "assigned_to_name": assignee_name,
                "assigned_at": now if assignee_id else None,
                "updated_at": now,
            },
            "$push": {"history": {"$each": [entry], "$slice": -200}},
        },
        return_document=True,
    )
    await record(
        me, "safety.report.assign", target=report_id,
        detail=(f"Assigned {existing.get('category', 'report')} to {assignee_name}"
                if assignee_id else f"Unassigned {existing.get('category', 'report')}"),
        request=request,
    )
    return await _report_detail(doc)


@router.post("/reports/{report_id}/notes", response_model=ReportDetail, summary="Add an internal note",
    dependencies=[Depends(require_permission("safety.edit"))],
)
async def add_report_note(
    report_id: str, body: NoteBody, request: Request, me: dict = Depends(get_current_user)
):
    """
    Internal. Never shown to the member — the message she sees is `staff_note`
    on a status change, and that is a separate, deliberate act.
    """
    existing = await _report_or_404(report_id)
    now = _now()
    note = {
        "id": str(ObjectId()),
        "by_id": str(me["_id"]),
        "by_name": _actor_name(me),
        "text": body.text.strip(),
        "at": now,
    }
    doc = await _reports().find_one_and_update(
        {"_id": existing["_id"]},
        {
            "$push": {"notes": {"$each": [note], "$slice": -200}},
            "$set": {"updated_at": now},
        },
        return_document=True,
    )
    await record(
        me, "safety.report.note", target=report_id,
        detail=f"Note on {existing.get('category', 'report')}: {note['text'][:120]}",
        request=request,
    )
    return await _report_detail(doc)


@router.patch("/reports/{report_id}", response_model=ReportDetail, summary="Change a report's status",
    dependencies=[Depends(require_permission("safety.edit"))],
)
async def decide_report(
    report_id: str, body: ReportStatusBody, request: Request, me: dict = Depends(get_current_user)
):
    existing = await _report_or_404(report_id)
    before = existing.get("status", "open")
    reason = body.reason.strip()
    message = body.staff_note.strip()

    if before == body.status and not message:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"This report is already {before}")
    if before != body.status and len(reason) < 3:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Say why the status is changing")

    now = _now()
    updates: dict = {"status": body.status, "updated_at": now}
    if message:
        updates["staff_note"] = message
    if body.status in RESOLVED_STATUSES:
        updates["resolved_at"] = now
        updates["resolved_by"] = _actor_name(me)
    elif before in RESOLVED_STATUSES:
        # Reopened. The old resolution is in the history; the fields clear.
        updates["resolved_at"] = None
        updates["resolved_by"] = ""

    entry = {
        "kind": "status", "at": now,
        "by_id": str(me["_id"]), "by_name": _actor_name(me),
        "from": before, "to": body.status, "reason": reason,
        "told_member": bool(message and body.status in RESOLVED_STATUSES),
    }
    doc = await _reports().find_one_and_update(
        {"_id": existing["_id"]},
        {"$set": updates, "$push": {"history": {"$each": [entry], "$slice": -200}}},
        return_document=True,
    )

    if body.status in RESOLVED_STATUSES:
        await notify(
            get_database(), doc["user_id"],
            "About the report you made",
            message or "We've looked into it and taken action. Thank you for telling us.",
            "safety", "/app/safety",
        )

    verb = "resolve" if body.status in RESOLVED_STATUSES else "status"
    await record(
        me, f"safety.report.{verb}", target=report_id,
        detail=f"{existing.get('category', 'Report')}: {before} → {body.status}"
        + (f" — {reason}" if reason else "")
        + (" (member told)" if entry["told_member"] else ""),
        request=request,
    )
    return await _report_detail(doc)


# --- helplines ---------------------------------------------------------------

_NUMBER = re.compile(r"^\+?[0-9][0-9 \-]{1,19}$")


class HelplineBody(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    number: str = Field(..., min_length=2, max_length=24)
    desc: str = Field("", max_length=240)
    urgent: bool = False
    order: int = Field(0, ge=0, le=999)

    @field_validator("number")
    @classmethod
    def dialable(cls, v: str) -> str:
        v = v.strip()
        if not _NUMBER.match(v):
            raise ValueError("A number is digits, with optional +, spaces or dashes")
        return v

    @field_validator("name", "desc")
    @classmethod
    def trimmed(cls, v: str) -> str:
        return v.strip()


class HelplineList(BaseModel):
    """`managed` is False while the code list is what callers get."""
    items: list[dict]
    managed: bool
    builtin_count: int


async def _helpline_list() -> HelplineList:
    # Every write path ends here, so the public cache is dropped here.
    invalidate_helplines()
    rows = await _helplines().find({}).sort([("order", 1), ("created_at", 1)]).to_list(100)
    if rows:
        return HelplineList(
            items=[HelplineModel.to_response(r) for r in rows],
            managed=True, builtin_count=len(HELPLINES),
        )
    return HelplineList(
        items=[
            {"id": "", **h, "order": i, "builtin": True, "updated_at": ""}
            for i, h in enumerate(HELPLINES)
        ],
        managed=False, builtin_count=len(HELPLINES),
    )


async def _import_defaults(me: dict) -> int:
    """Copy the code list in, so the curated list starts whole. Returns how many."""
    docs = [
        HelplineModel.create_document(
            name=h["name"], number=h["number"], desc=h["desc"],
            urgent=h["urgent"], order=i, created_by=str(me["_id"]),
        )
        for i, h in enumerate(HELPLINES)
    ]
    if docs:
        await _helplines().insert_many(docs)
    return len(docs)


@router.get("/helplines", response_model=HelplineList, summary="The helpline list as callers see it",
    dependencies=[Depends(require_permission("safety.view"))],
)
async def list_helplines(me: dict = Depends(get_current_user)):
    return await _helpline_list()


@router.post("/helplines/import-defaults", response_model=HelplineList, summary="Copy the built-in numbers in",
    dependencies=[Depends(require_permission("safety.edit"))],
)
async def import_default_helplines(request: Request, me: dict = Depends(get_current_user)):
    if await _helplines().count_documents({}) > 0:
        raise HTTPException(status.HTTP_409_CONFLICT, "The list is already being managed here")
    n = await _import_defaults(me)
    await record(
        me, "safety.helpline.import", target="helplines",
        detail=f"Took over the helpline list: copied {n} built-in numbers", request=request,
    )
    return await _helpline_list()


@router.post("/helplines", response_model=HelplineList, status_code=status.HTTP_201_CREATED,
    summary="Add a helpline", dependencies=[Depends(require_permission("safety.edit"))],
)
async def add_helpline(body: HelplineBody, request: Request, me: dict = Depends(get_current_user)):
    imported = 0
    if await _helplines().count_documents({}) == 0:
        # The first curated row replaces the whole code list for every caller.
        # Copying the built-ins in first means adding one number never
        # silently removes six.
        imported = await _import_defaults(me)
    doc = HelplineModel.create_document(
        name=body.name, number=body.number, desc=body.desc,
        urgent=body.urgent, order=body.order, created_by=str(me["_id"]),
    )
    res = await _helplines().insert_one(doc)
    await record(
        me, "safety.helpline.add", target=str(res.inserted_id),
        detail=f"Added helpline {body.name} ({body.number})"
        + (f"; copied {imported} built-in numbers in first" if imported else ""),
        request=request,
    )
    return await _helpline_list()


@router.put("/helplines/{helpline_id}", response_model=HelplineList, summary="Edit a helpline",
    dependencies=[Depends(require_permission("safety.edit"))],
)
async def edit_helpline(
    helpline_id: str, body: HelplineBody, request: Request, me: dict = Depends(get_current_user)
):
    doc = await _helplines().find_one_and_update(
        {"_id": to_object_id(helpline_id)},
        {"$set": {
            "name": body.name, "number": body.number, "desc": body.desc,
            "urgent": body.urgent, "order": body.order, "updated_at": _now(),
        }},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That helpline doesn't exist")
    await record(
        me, "safety.helpline.edit", target=helpline_id,
        detail=f"Edited helpline {body.name} ({body.number})", request=request,
    )
    return await _helpline_list()


@router.delete("/helplines/{helpline_id}", response_model=HelplineList, summary="Remove a helpline",
    dependencies=[Depends(require_permission("safety.edit"))],
)
async def remove_helpline(helpline_id: str, request: Request, me: dict = Depends(get_current_user)):
    doc = await _helplines().find_one_and_delete({"_id": to_object_id(helpline_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That helpline doesn't exist")
    left = await _helplines().count_documents({})
    await record(
        me, "safety.helpline.remove", target=helpline_id,
        detail=f"Removed helpline {doc.get('name', '')} ({doc.get('number', '')})"
        + ("; list is empty, callers now get the built-in numbers" if left == 0 else ""),
        request=request,
    )
    return await _helpline_list()


# --- support fund ------------------------------------------------------------

class SupportRow(AdminSupportRequest):
    asked_at: str = ""
    decided_by: str = ""
    decided_at: str = ""
    decision_reason: str = ""


class SupportDecisionBody(SupportDecision):
    """The member-facing note is `staff_note`; `reason` stays internal."""
    reason: str = Field("", max_length=400)


class SupportSummary(BaseModel):
    """
    Two different facts, kept apart on purpose:

      * what THIS QUEUE approved — the sum of `granted_minor` on approved and
        part-funded requests;
      * what the WALLET LEDGER holds as scholarship credits — every credit
        with source `scholarship`, whether or not it came from a request here.

    There is no fund balance, because there is no fund account in this
    system. The screen says so rather than inventing one.
    """
    pending: int
    approved: int
    partial: int
    declined: int
    total: int
    pending_asked_minor: int
    approved_granted_minor: int
    ledger_credit_count: int
    ledger_credit_minor: int
    ledger_linked_count: int
    ledger_linked_minor: int
    currency: str


def _support_row(d: dict, members: dict[str, dict], sym: str) -> dict:
    m = members.get(d["user_id"], {})
    return {
        **SupportRequestModel.to_response(d, sym),
        "member_name": m.get("full_name", d.get("member_name", "—")),
        "member_email": m.get("email", ""),
        "member_code": m.get("member_id", ""),
        "amount_needed_minor": int(d.get("amount_needed_minor", 0)),
        "granted_minor": int(d.get("granted_minor", 0)),
        "household_income": d.get("household_income", ""),
        "dependants": int(d.get("dependants", 0)),
        "asked_at": _iso(d.get("created_at")),
        "decided_by": d.get("decided_by", "") or "",
        "decided_at": _iso(d.get("decided_at")),
        "decision_reason": d.get("decision_reason", "") or "",
    }


@router.get("/support", response_model=list[SupportRow], summary="Support requests",
    dependencies=[Depends(require_permission("safety.view"))],
)
async def list_support(
    status_filter: str = Query("", alias="status", max_length=20),
    me: dict = Depends(get_current_user),
):
    query = {"status": status_filter} if status_filter else {}
    docs = await _support().find(query).sort("created_at", -1).to_list(300)
    members = await _members([d["user_id"] for d in docs])
    sym = symbol()
    return [SupportRow(**_support_row(d, members, sym)) for d in docs]


@router.get("/support/summary", response_model=SupportSummary, summary="Counts and sums, from the rows",
    dependencies=[Depends(require_permission("safety.view"))],
)
async def support_summary(me: dict = Depends(get_current_user)):
    groups = await _support().aggregate([
        {"$group": {
            "_id": "$status", "n": {"$sum": 1},
            "asked": {"$sum": {"$ifNull": ["$amount_needed_minor", 0]}},
            "granted": {"$sum": {"$ifNull": ["$granted_minor", 0]}},
        }}
    ]).to_list(None)
    by = {g["_id"]: g for g in groups}

    def n(s):  # noqa: E306
        return int(by.get(s, {}).get("n", 0))

    approved_granted = int(by.get("approved", {}).get("granted", 0)) + int(by.get("partial", {}).get("granted", 0))

    request_ids = [str(r["_id"]) async for r in _support().find(
        {"status": {"$in": ["approved", "partial"]}}, {"_id": 1})]
    ledger = await _txns().aggregate([
        {"$match": {"source": WalletTxnModel.SOURCE_SCHOLARSHIP, "kind": WalletTxnModel.KIND_CREDIT}},
        {"$group": {
            "_id": None, "n": {"$sum": 1}, "sum": {"$sum": {"$ifNull": ["$amount_minor", 0]}},
            "linked_n": {"$sum": {"$cond": [{"$in": [{"$ifNull": ["$reference_id", ""]}, request_ids]}, 1, 0]}},
            "linked_sum": {"$sum": {"$cond": [{"$in": [{"$ifNull": ["$reference_id", ""]}, request_ids]}, {"$ifNull": ["$amount_minor", 0]}, 0]}},
        }},
    ]).to_list(1)
    led = ledger[0] if ledger else {}

    return SupportSummary(
        pending=n("pending"), approved=n("approved"), partial=n("partial"), declined=n("declined"),
        total=sum(int(g.get("n", 0)) for g in by.values()),
        pending_asked_minor=int(by.get("pending", {}).get("asked", 0)),
        approved_granted_minor=approved_granted,
        ledger_credit_count=int(led.get("n", 0)),
        ledger_credit_minor=int(led.get("sum", 0)),
        ledger_linked_count=int(led.get("linked_n", 0)),
        ledger_linked_minor=int(led.get("linked_sum", 0)),
        currency=symbol().strip(),
    )


@router.patch(
    "/support/{request_id}",
    response_model=SupportRow,
    summary="Decide a support request",
    dependencies=[Depends(require_permission("safety.approve"))],
)
async def decide_support(
    request_id: str, body: SupportDecisionBody, request: Request, me: dict = Depends(get_current_user)
):
    oid = to_object_id(request_id)
    existing = await _support().find_one({"_id": oid})
    if not existing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That request doesn't exist")
    if existing.get("status") != SupportRequestModel.STATUS_PENDING:
        raise HTTPException(status.HTTP_409_CONFLICT, "This request has already been decided")

    reason = body.reason.strip()
    granted_minor = int(round(body.granted * 100)) if body.status != "declined" else 0
    if body.status in ("approved", "partial") and granted_minor <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Enter the amount you're granting")
    if body.status == "declined" and len(reason) < 3:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Say why it's being declined")

    now = _now()
    doc = await _support().find_one_and_update(
        {"_id": oid, "status": SupportRequestModel.STATUS_PENDING},
        {
            "$set": {
                "status": body.status,
                "granted_minor": granted_minor,
                "staff_note": body.staff_note,
                "decision_reason": reason,
                "decided_by": _actor_name(me),
                "decided_by_id": str(me["_id"]),
                "decided_at": now,
                "updated_at": now,
            }
        },
        return_document=True,
    )
    if not doc:
        # Someone else decided it between our read and our write.
        raise HTTPException(status.HTTP_409_CONFLICT, "This request has already been decided")

    sym = symbol()
    if granted_minor > 0:
        # The grant IS the ledger entry. One action, not two.
        await _txns().insert_one(
            WalletTxnModel.create_document(
                user_id=doc["user_id"],
                member_id=doc.get("member_id", ""),
                kind=WalletTxnModel.KIND_CREDIT,
                amount_minor=granted_minor,
                source=WalletTxnModel.SOURCE_SCHOLARSHIP,
                label=f"Fee support · {doc.get('what_for', '')}".strip(" ·"),
                reference_id=str(doc["_id"]),
            )
        )
        await notify(
            get_database(), doc["user_id"],
            "We can help with that",
            f"{sym}{granted_minor / 100:,.0f} has been added to your wallet. "
            f"{body.staff_note or 'It comes off your fee automatically.'}",
            "account", "/app/wallet",
        )
        await record(
            me, "safety.support.approve", target=request_id,
            detail=f"{'Approved' if body.status == 'approved' else 'Part-funded'} "
                   f"{sym}{granted_minor / 100:,.0f} of {sym}{int(doc.get('amount_needed_minor', 0)) / 100:,.0f} "
                   f"for {doc.get('what_for', '')}; credit written to wallet"
                   + (f" — {reason}" if reason else ""),
            request=request,
        )
    else:
        await notify(
            get_database(), doc["user_id"],
            "About your support request",
            body.staff_note
            or "We can't fund this one right now. Please message us — there may be another way.",
            "account", "/app/support-fund",
        )
        await record(
            me, "safety.support.decline", target=request_id,
            detail=f"Declined {sym}{int(doc.get('amount_needed_minor', 0)) / 100:,.0f} "
                   f"for {doc.get('what_for', '')} — {reason}",
            request=request,
        )

    members = await _members([doc["user_id"]])
    return SupportRow(**_support_row(doc, members, sym))


# --- what's waiting for a human ----------------------------------------------

@router.get("/counts", response_model=ModuleCounts, summary="Badge counts for the sidebar",
    dependencies=[Depends(require_permission("safety.view"))],
)
async def module_counts(me: dict = Depends(get_current_user)):
    db = get_database()
    return ModuleCounts(
        pending_stories=await db["stories"].count_documents({"status": "pending"}),
        open_alerts=await _alerts().count_documents({"status": {"$ne": "resolved"}}),
        open_reports=await _reports().count_documents({"status": {"$in": list(OPEN_STATUSES)}}),
        pending_support=await _support().count_documents({"status": "pending"}),
        new_applications=await db["applications"].count_documents({"status": "applied"}),
        pending_mentor_requests=await db["mentorship_requests"].count_documents(
            {"status": "pending"}
        ),
    )


# --- assist links -------------------------------------------------------------
# "Together" lets one woman help another use the app, on the helped woman's
# recorded consent (routes/together.py). That consent is the whole safeguard,
# and it is abuse-prone: a helper who was never asked, or whose help has become
# control. So safety staff can see every link, who recorded it, whether consent
# was ever recorded, and can end one — which removes it from the helper's
# screen at once and tells her why.
#
# What this never shows: the helped woman is a NAME the helper typed, not an
# account; there is no row of hers to open, and this screen does not try.

ASSIST_LINKS = "assist_links"
ASSIST_TASKS = "assist_tasks"


class AssistLinkRow(BaseModel):
    id: str
    helper_id: str
    helper_name: str
    helper_code: str
    helped_name: str
    because: str
    owns_phone: bool
    consented: bool
    consent_on: str
    done_count: int
    last_did: str
    open_tasks: int
    created_at: str
    revoked_at: str
    revoked_reason: str
    revoked_by: str


class AssistLinkList(BaseModel):
    items: list[AssistLinkRow]
    total: int
    consented: int
    unconsented: int
    revoked: int


class AssistRevoke(BaseModel):
    reason: str = Field(min_length=3, max_length=400)


def _assist_links():
    return get_database()[ASSIST_LINKS]


def _assist_tasks():
    return get_database()[ASSIST_TASKS]


def _stamp(v) -> str:
    return v.isoformat() if isinstance(v, datetime) else ""


@router.get("/assist-links", response_model=AssistLinkList,
    summary="Every consent one member holds to act for another",
    dependencies=[Depends(require_permission("safety.view"))],
)
async def list_assist_links(
    state: str = Query("", max_length=20, description="consented | unconsented | revoked | (all)"),
    q: str = Query("", max_length=80),
    me: dict = Depends(get_current_user),
):
    query: dict = {}
    if state == "consented":
        query.update({"consent_on": {"$ne": None}, "revoked_at": None})
    elif state == "unconsented":
        query.update({"consent_on": None, "revoked_at": None})
    elif state == "revoked":
        query["revoked_at"] = {"$ne": None}
    if q.strip():
        query["name"] = {"$regex": re.escape(q.strip()), "$options": "i"}

    docs = await _assist_links().find(query).sort("created_at", -1).to_list(500)
    helper_ids = [d.get("user_id", "") for d in docs]
    members = await _members(helper_ids)
    codes: dict[str, str] = {}
    member_ids = [m.get("member_id") for m in members.values() if m.get("member_id")]
    if member_ids:
        oids = []
        for mid in member_ids:
            try:
                oids.append(ObjectId(mid))
            except Exception:  # noqa: BLE001
                continue
        async for m in get_database()["members"].find({"_id": {"$in": oids}}, {"code": 1}):
            codes[str(m["_id"])] = m.get("code", "")

    open_tasks: dict[str, int] = {}
    if docs:
        link_ids = [str(d["_id"]) for d in docs]
        async for row in _assist_tasks().aggregate([
            {"$match": {"link_id": {"$in": link_ids}, "done": {"$ne": True}}},
            {"$group": {"_id": "$link_id", "n": {"$sum": 1}}},
        ]):
            open_tasks[row["_id"]] = int(row["n"])

    items = []
    for d in docs:
        u = members.get(d.get("user_id", ""), {})
        items.append(AssistLinkRow(
            id=str(d["_id"]),
            helper_id=d.get("user_id", ""),
            helper_name=u.get("full_name", "") or "—",
            helper_code=codes.get(u.get("member_id", ""), ""),
            helped_name=d.get("name", ""),
            because=d.get("because", ""),
            owns_phone=bool(d.get("owns_phone", False)),
            consented=bool(d.get("consent_on")),
            consent_on=_stamp(d.get("consent_on")),
            done_count=int(d.get("done_count", 0) or 0),
            last_did=d.get("last_did", "") or "",
            open_tasks=open_tasks.get(str(d["_id"]), 0),
            created_at=_stamp(d.get("created_at")),
            revoked_at=_stamp(d.get("revoked_at")),
            revoked_reason=d.get("revoked_reason", "") or "",
            revoked_by=d.get("revoked_by_name", "") or "",
        ))

    # The header counts are over ALL links, whatever the filter shows.
    total = await _assist_links().count_documents({})
    revoked = await _assist_links().count_documents({"revoked_at": {"$ne": None}})
    consented = await _assist_links().count_documents({"consent_on": {"$ne": None}, "revoked_at": None})
    return AssistLinkList(
        items=items, total=total, consented=consented,
        unconsented=max(0, total - revoked - consented), revoked=revoked,
    )


@router.post("/assist-links/{link_id}/revoke", response_model=AssistLinkRow,
    summary="End a consent — the helper loses it at once",
    dependencies=[Depends(require_permission("safety.edit"))],
)
async def revoke_assist_link(
    link_id: str, body: AssistRevoke, request: Request, me: dict = Depends(get_current_user),
):
    doc = await _assist_links().find_one({"_id": to_object_id(link_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such link")
    if doc.get("revoked_at"):
        raise HTTPException(status.HTTP_409_CONFLICT, "That link is already ended")
    now = datetime.now(timezone.utc)
    await _assist_links().update_one(
        {"_id": doc["_id"]},
        {"$set": {"revoked_at": now, "revoked_reason": body.reason.strip(),
                  "revoked_by": str(me["_id"]), "revoked_by_name": _actor_name(me)}},
    )
    await notify(
        get_database(), doc.get("user_id", ""),
        f"Your link with {doc.get('name', 'someone')} has been ended",
        "Our safety team ended this arrangement. If you think that is wrong, reply to this message.",
        ntype="safety", href="/app/together",
    )
    await record(
        me, "safety.assist_revoked", target=str(doc["_id"]),
        detail=f"Ended the assist link for {doc.get('name', '')} — {body.reason.strip()}",
        request=request,
    )
    rows = await list_assist_links(state="", q="", me=me)
    for r in rows.items:
        if r.id == str(doc["_id"]):
            return r
    raise HTTPException(status.HTTP_404_NOT_FOUND, "No such link")
