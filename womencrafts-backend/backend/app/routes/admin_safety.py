"""
Staff side of safety and the support fund.

Two rules that are not negotiable:

  * An anonymous report still shows staff who filed it. We cannot act on a
    report we cannot follow up, and abuse of the report system is itself a
    safety problem. "Anonymous" means hidden from the person reported, never
    hidden from the people responsible for acting.

  * Approving a support request WRITES THE CREDIT. It is one action, not a
    decision followed by somebody remembering to top up a wallet. A grant that
    exists only as a status is a grant that never reaches her.
"""

import asyncio
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.permissions import require_permission
from app.core.deps import get_current_user
from app.core.serializers import to_object_id
from app.db.mongodb import get_database
from app.models.conversation import notify
from app.routes.staff_account import log_activity
from app.models.safety import SafetyAlertModel, SafetyReportModel, TrustedContactModel
from app.models.user import UserModel
from app.models.wallet import SupportRequestModel, WalletTxnModel
from app.schemas.admin_modules import (
    AdminAlert,
    AdminReport,
    AdminSupportRequest,
    AlertDecision,
    ModuleCounts,
    ReportDecision,
    SupportDecision,
)
from app.routes.wallet import symbol

router = APIRouter(prefix="/admin/safety", tags=["Staff · Safety"])


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

@router.get("/alerts", response_model=list[AdminAlert], summary="Safety alerts")
async def list_alerts(
    status_filter: str = Query("", alias="status", max_length=20),
    me: dict = Depends(get_current_user),
):
    query = {"status": status_filter} if status_filter else {}
    docs = await _alerts().find(query).sort("created_at", -1).to_list(300)

    # Members and trusted contacts are both "everything for these user_ids",
    # so they go together and each is ONE query rather than one per alert.
    #
    # This used to fetch contacts inside the loop below. At 300 alerts that was
    # 300 round trips to a cluster in another data centre — about fifteen
    # seconds for a page staff open when somebody has raised an alarm, which is
    # the worst possible moment for it to be slow.
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
        # Whoever she asked us to reach — staff need these in front of them.
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


@router.patch("/alerts/{alert_id}", response_model=AdminAlert, summary="Update an alert", dependencies=[Depends(require_permission("safety.edit"))])
async def decide_alert(alert_id: str, body: AlertDecision, me: dict = Depends(get_current_user)):
    updates: dict = {
        "status": body.status,
        "resolution": body.resolution,
        "handled_by": me.get("full_name", ""),
    }
    if body.status == SafetyAlertModel.STATUS_RESOLVED:
        updates["resolved_at"] = datetime.now(timezone.utc)

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

    members = await _members([doc["user_id"]])
    u = members.get(doc["user_id"], {})
    contacts = await _contacts().find({"user_id": doc["user_id"]}).to_list(10)
    await log_activity(me, "Handled a safety alert", "Safety", target=doc.get("member_name", ""))
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

@router.get("/reports", response_model=list[AdminReport], summary="Reports")
async def list_reports(
    status_filter: str = Query("", alias="status", max_length=20),
    me: dict = Depends(get_current_user),
):
    query = {"status": status_filter} if status_filter else {}
    docs = await _reports().find(query).sort("created_at", -1).to_list(300)
    members = await _members([d["user_id"] for d in docs])
    return [
        AdminReport(
            **SafetyReportModel.to_response(d),
            member_name=members.get(d["user_id"], {}).get("full_name", "—"),
            member_email=members.get(d["user_id"], {}).get("email", ""),
            staff_note=d.get("staff_note", ""),
        )
        for d in docs
    ]


@router.patch("/reports/{report_id}", response_model=AdminReport, summary="Action a report", dependencies=[Depends(require_permission("safety.edit"))])
async def decide_report(report_id: str, body: ReportDecision, me: dict = Depends(get_current_user)):
    doc = await _reports().find_one_and_update(
        {"_id": to_object_id(report_id)},
        {
            "$set": {
                "status": body.status,
                "staff_note": body.staff_note,
                "updated_at": datetime.now(timezone.utc),
            }
        },
        return_document=True,
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That report doesn't exist")

    if body.status in ("actioned", "closed"):
        await notify(
            get_database(), doc["user_id"],
            "About the report you made",
            body.staff_note
            or "We've looked into it and taken action. Thank you for telling us.",
            "safety", "/app/safety",
        )

    members = await _members([doc["user_id"]])
    await log_activity(me, "Actioned a report", "Safety", target=doc.get("category", ""))
    return AdminReport(
        **SafetyReportModel.to_response(doc),
        member_name=members.get(doc["user_id"], {}).get("full_name", "—"),
        member_email=members.get(doc["user_id"], {}).get("email", ""),
        staff_note=doc.get("staff_note", ""),
    )


# --- support fund ------------------------------------------------------------

@router.get("/support", response_model=list[AdminSupportRequest], summary="Support requests")
async def list_support(
    status_filter: str = Query("", alias="status", max_length=20),
    me: dict = Depends(get_current_user),
):
    query = {"status": status_filter} if status_filter else {}
    docs = await _support().find(query).sort("created_at", -1).to_list(300)
    members = await _members([d["user_id"] for d in docs])
    sym = symbol()
    return [
        AdminSupportRequest(
            **SupportRequestModel.to_response(d, sym),
            member_name=members.get(d["user_id"], {}).get("full_name", d.get("member_name", "—")),
            member_email=members.get(d["user_id"], {}).get("email", ""),
            member_code=members.get(d["user_id"], {}).get("member_id", ""),
            amount_needed_minor=int(d.get("amount_needed_minor", 0)),
            granted_minor=int(d.get("granted_minor", 0)),
            household_income=d.get("household_income", ""),
            dependants=int(d.get("dependants", 0)),
        )
        for d in docs
    ]


@router.patch(
    "/support/{request_id}",
    response_model=AdminSupportRequest,
    summary="Decide a support request",
    dependencies=[Depends(require_permission("safety.approve"))],
)
async def decide_support(
    request_id: str, body: SupportDecision, me: dict = Depends(get_current_user)
):
    oid = to_object_id(request_id)
    existing = await _support().find_one({"_id": oid})
    if not existing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That request doesn't exist")
    if existing.get("status") != SupportRequestModel.STATUS_PENDING:
        raise HTTPException(status.HTTP_409_CONFLICT, "This request has already been decided")

    granted_minor = int(round(body.granted * 100)) if body.status != "declined" else 0
    if body.status in ("approved", "partial") and granted_minor <= 0:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Enter the amount you're granting"
        )

    doc = await _support().find_one_and_update(
        {"_id": oid, "status": SupportRequestModel.STATUS_PENDING},
        {
            "$set": {
                "status": body.status,
                "granted_minor": granted_minor,
                "staff_note": body.staff_note,
                "decided_by": me.get("full_name", ""),
                "updated_at": datetime.now(timezone.utc),
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
    else:
        await notify(
            get_database(), doc["user_id"],
            "About your support request",
            body.staff_note
            or "We can't fund this one right now. Please message us — there may be another way.",
            "account", "/app/support-fund",
        )

    members = await _members([doc["user_id"]])
    await log_activity(me, "Decided a support request", "Safety", target=doc.get("what_for", ""))
    return AdminSupportRequest(
        **SupportRequestModel.to_response(doc, sym),
        member_name=members.get(doc["user_id"], {}).get("full_name", doc.get("member_name", "—")),
        member_email=members.get(doc["user_id"], {}).get("email", ""),
        member_code=members.get(doc["user_id"], {}).get("member_id", ""),
        amount_needed_minor=int(doc.get("amount_needed_minor", 0)),
        granted_minor=int(doc.get("granted_minor", 0)),
        household_income=doc.get("household_income", ""),
        dependants=int(doc.get("dependants", 0)),
    )


# --- what's waiting for a human ----------------------------------------------

@router.get("/counts", response_model=ModuleCounts, summary="Badge counts for the sidebar")
async def module_counts(me: dict = Depends(get_current_user)):
    db = get_database()
    return ModuleCounts(
        pending_stories=await db["stories"].count_documents({"status": "pending"}),
        open_alerts=await _alerts().count_documents({"status": {"$ne": "resolved"}}),
        open_reports=await _reports().count_documents({"status": {"$in": ["open", "reviewing"]}}),
        pending_support=await _support().count_documents({"status": "pending"}),
        new_applications=await db["applications"].count_documents({"status": "applied"}),
        pending_mentor_requests=await db["mentorship_requests"].count_documents(
            {"status": "pending"}
        ),
    )
