"""
The members directory, as a Super Admin runs it.

── Two collections, one person ──────────────────────────────────────────────
`members` is the directory row the admin screen manages; `users` is the login
behind it (`users.member_id` points at the directory row, and the two share an
email). Everything an admin does to "a member" here touches both, in that
order: the directory first, because that is what she is looking at, and the
account second, because that is what decides whether the woman can sign in.

── Every write is guarded and recorded ──────────────────────────────────────
A `users.*` permission guard decides who may; `record()` writes who
did, to whom, and why, after the write succeeded. A suspension, rejection or
deletion carries a reason, because "why was my account closed?" is a question
somebody will one day have to answer from this log alone.

── What an admin never sees from here ───────────────────────────────────────
Her private vault, her in-case-of-emergency data, and the bytes of her ID
documents. The profile endpoint counts what she has done (bookings, enrolments,
posts, orders) from the collections that record it, and it never reads a
stored "engagement score" — there was one, seeded, updated by nothing, and it
was shown as if it were hers.
"""

import csv
import io
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import Response

from app.core import cache, mongosafe
from app.core import email as mailer
from app.core.audit import record
from app.core.config import settings
from app.core.deps import get_current_user
from app.core.permissions import require_permission
from app.core.serializers import aware, page_meta, to_object_id
from app.core.staff_scope import combine_scope, require_member_in_scope, scope_for
from app.db.mongodb import get_database
from app.models.conversation import notify
from app.models.member import MemberModel
from app.models.user import UserModel
from app.models.verification import DocumentModel, VerificationStatus
from app.routes._paging import paged
from app.schemas.member import (
    DeletionRequestList,
    DeletionRequestRow,
    BulkRegionRequest,
    BulkStatusRequest,
    BulkStatusResponse,
    MemberCreate,
    MemberGrowthResponse,
    MemberListResponse,
    MemberProfileResponse,
    MemberResponse,
    MemberStatsResponse,
    MemberStatusUpdate,
    MemberUpdate,
    ReasonRequest,
    RequiredReasonRequest,
)

router = APIRouter(prefix="/members", tags=["Users"])

#: The only fields a caller may sort on. `paged` would happily sort on any
#: string it was handed, including one that indexes nothing.
SORTABLE = {"created_at", "updated_at", "full_name", "email", "status", "role", "segment", "code"}

#: Collections that record something a member did, and the field that names
#: her in each. Counted for the profile; never her vault or her in-case data.
_ACTIVITY = {
    "bookings": "bookings",
    "enrollments": "enrolments",
    "circle_posts": "posts",
    "post_replies": "replies",
    "circle_members": "circles",
    "event_registrations": "events",
    "applications": "applications",
    "orders": "orders",
}


def _members():
    return get_database()[MemberModel.collection_name]


def _users():
    return get_database()[UserModel.collection_name]


def _iso(value) -> str:
    return value.isoformat() if isinstance(value, datetime) else ""


def _name(doc: dict) -> str:
    return doc.get("full_name") or doc.get("email") or str(doc.get("_id", ""))


async def _next_code() -> str:
    """Generate the next 'WC-#####' code, one above the current highest."""
    highest = 12564
    async for doc in _members().find({}, {"code": 1}):
        code = str(doc.get("code", ""))
        if code.startswith("WC-") and code[3:].isdigit():
            highest = max(highest, int(code[3:]))
    return f"WC-{highest + 1}"


async def _member_or_404(member_id: str) -> dict:
    doc = await _members().find_one({"_id": to_object_id(member_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    return doc


async def _linked_user(member: dict) -> Optional[dict]:
    """The login behind a directory row: by the explicit link, else by email."""
    user = await _users().find_one({"member_id": str(member["_id"])})
    if user:
        return user
    if member.get("email"):
        return await _users().find_one({"email": member["email"], "role": "Member"})
    return None


def _query(
    q: Optional[str], role: Optional[str], status_: Optional[str],
    segment: Optional[str], ids: Optional[str],
) -> dict:
    query: dict = {}
    if role and role not in ("All Roles", "all"):
        query["role"] = role
    if status_ and status_ not in ("All Status", "all"):
        query["status"] = status_
    if segment and segment not in ("All Segments", "all"):
        query["segment"] = "" if segment == "__none__" else segment
    if q and q.strip():
        query.update(mongosafe.any_of(q, ["full_name", "email", "phone", "code"]))
    if ids:
        oids = []
        for raw in ids.split(","):
            raw = raw.strip()
            if ObjectId.is_valid(raw):
                oids.append(ObjectId(raw))
        query["_id"] = {"$in": oids}
    return query


def _sort(sort: str) -> tuple[str, int]:
    field = sort.lstrip("-") or "created_at"
    if field not in SORTABLE:
        field = "created_at"
    return field, -1 if sort.startswith("-") else 1


# ── Lists and figures ────────────────────────────────────────────────────────


@router.get("", response_model=MemberListResponse, summary="List members",
    dependencies=[Depends(require_permission("users.view"))],
)
async def list_members(
    q: Optional[str] = Query(None, description="Search by name, email, phone or code"),
    role: Optional[str] = Query(None, description="Filter by role"),
    status: Optional[str] = Query(None, description="Filter by status"),
    segment: Optional[str] = Query(None, description="Filter by segment; '__none__' for unset"),
    ids: Optional[str] = Query(None, description="Comma-separated member ids"),
    sort: str = Query("-created_at", description="Sort field; prefix '-' for descending"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    _: dict = Depends(get_current_user),
):
    field, direction = _sort(sort)
    total, docs = await paged(
        _members(), combine_scope(_query(q, role, status, segment, ids), _),
        sort=field, direction=direction, page=page, page_size=page_size,
    )
    items = [MemberModel.to_response(doc) for doc in docs]
    return MemberListResponse(items=items, **page_meta(total, page, page_size))


@router.get("/stats", response_model=MemberStatsResponse, summary="Member statistics",
    dependencies=[Depends(require_permission("users.view"))],
)
async def member_stats(_: dict = Depends(get_current_user)):
    projection = {"role": 1, "segment": 1, "status": 1, "created_at": 1}
    docs = [doc async for doc in _members().find(combine_scope({}, _), projection)]
    total = len(docs)

    by_role: dict[str, int] = {}
    by_segment: dict[str, int] = {}
    by_status: dict[str, int] = {}
    for doc in docs:
        by_role[doc.get("role") or "Member"] = by_role.get(doc.get("role") or "Member", 0) + 1
        seg = doc.get("segment") or ""
        by_segment[seg] = by_segment.get(seg, 0) + 1
        st = doc.get("status") or "Active"
        by_status[st] = by_status.get(st, 0) + 1

    now = datetime.now(timezone.utc)
    this_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month = (this_month - timedelta(days=1)).replace(day=1)

    def created_between(start: datetime, end: datetime) -> int:
        n = 0
        for doc in docs:
            when = aware(doc.get("created_at"))
            if when and start <= when < end:
                n += 1
        return n

    # "Verified" is the account's state, not the directory's — it is the login
    # that walked the verification path.
    verified = await _users().count_documents(
        {"role": "Member", "verification_status": VerificationStatus.ACTIVE}
    )

    return MemberStatsResponse(
        total=total,
        active=by_status.get("Active", 0),
        inactive=by_status.get("Inactive", 0),
        pending=by_status.get("Pending", 0),
        rejected=by_status.get("Rejected", 0),
        verified=verified,
        new_this_month=created_between(this_month, now + timedelta(days=1)),
        new_last_month=created_between(last_month, this_month),
        by_role=by_role,
        by_segment=by_segment,
        by_status=by_status,
    )


@router.get("/growth", response_model=MemberGrowthResponse, summary="Members over time, by week",
    dependencies=[Depends(require_permission("users.view"))],
)
async def member_growth(
    weeks: int = Query(12, ge=4, le=52),
    _: dict = Depends(get_current_user),
):
    """
    Cumulative directory size at the end of each of the last N weeks, from
    `created_at`. This replaces a chart whose six points were typed in.
    """
    now = datetime.now(timezone.utc)
    this_monday = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    starts = [this_monday - timedelta(weeks=weeks - 1 - i) for i in range(weeks)]

    stamps = [
        aware(doc.get("created_at"))
        async for doc in _members().find(combine_scope({}, _), {"created_at": 1})
    ]
    stamps = [s for s in stamps if s is not None]
    base = sum(1 for s in stamps if s < starts[0])

    points = []
    running = base
    for i, start in enumerate(starts):
        end = start + timedelta(weeks=1)
        fresh = sum(1 for s in stamps if start <= s < end)
        running += fresh
        points.append({"label": f"{start.strftime('%b')} {start.day}", "value": running, "new": fresh})
    return MemberGrowthResponse(points=points, weeks=weeks)


@router.get("/export", summary="Export the filtered member list as CSV",
    dependencies=[Depends(require_permission("users.export"))],
)
async def export_members(
    request: Request,
    q: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    segment: Optional[str] = Query(None),
    ids: Optional[str] = Query(None),
    sort: str = Query("-created_at"),
    me: dict = Depends(get_current_user),
):
    field, direction = _sort(sort)
    cursor = _members().find(combine_scope(_query(q, role, status, segment, ids), me)).sort(field, direction)

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([
        "Code", "Full name", "Email", "Phone", "Role", "Status", "Segment",
        "Location", "Gender", "Joined",
    ])
    n = 0
    async for doc in cursor:
        row = MemberModel.to_response(doc)
        writer.writerow([
            row["code"], row["full_name"], row["email"], row["phone"], row["role"],
            row["status"], row["segment"], row["location"], row["gender"], row["joined"],
        ])
        n += 1

    # An export is a read, but it is a read of everybody at once, and one that
    # leaves the building. It goes in the log.
    filters = ", ".join(
        f"{k}={v}" for k, v in (("q", q), ("role", role), ("status", status), ("segment", segment)) if v
    ) or ("selected rows" if ids else "no filters")
    await record(
        me, "member.export", target="members",
        detail=f"Exported {n} member{'s' if n != 1 else ''} as CSV ({filters})", request=request,
    )
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="members-{stamp}.csv"'},
    )


# ── Creating and changing ────────────────────────────────────────────────────


@router.post("", response_model=MemberResponse, status_code=status.HTTP_201_CREATED,
    summary="Create a member", dependencies=[Depends(require_permission("users.create"))],
)
async def create_member(payload: MemberCreate, request: Request, me: dict = Depends(get_current_user)):
    email = str(payload.email).lower().strip()
    if await _members().find_one({"email": email}):
        raise HTTPException(status.HTTP_409_CONFLICT, "A member with this email already exists")

    doc = MemberModel.create_document(
        full_name=payload.full_name,
        email=email,
        phone=payload.phone,
        role=payload.role,
        status=payload.status,
        location=payload.location,
        segment=payload.segment,
        gender=payload.gender,
        dob=payload.dob,
        referral=payload.referral,
        engagement=payload.engagement,
        avatar=payload.avatar,
        code=await _next_code(),
        verified_on="Awaiting review" if payload.status == "Pending" else "",
    )
    require_member_in_scope(doc, me)
    result = await _members().insert_one(doc)
    doc["_id"] = result.inserted_id
    await record(
        me, "member.create", target=str(doc["_id"]),
        detail=f"Added {_name(doc)} ({doc['code']}) to the directory as {doc['role']}, {doc['status']}",
        request=request,
    )
    return MemberResponse(**MemberModel.to_response(doc))


async def _apply_status(
    member: dict, new_status: str, me: dict, reason: str, request: Request, *, action: str,
) -> dict:
    """
    Change a directory row's status, and make the account agree.

    Inactive means she cannot sign in — `is_active` goes false, every existing
    session is ended by bumping her token version, and her cached record is
    dropped so the refusal is immediate rather than fifteen seconds away.
    Active undoes exactly that. Pending and Rejected are the verification
    path's states and leave the login alone.
    """
    now = datetime.now(timezone.utc)
    updates: dict = {"status": new_status, "updated_at": now}
    if new_status == "Active" and not member.get("verified_on"):
        updates["verified_on"] = now.strftime("%b %d, %Y")
    doc = await _members().find_one_and_update(
        {"_id": member["_id"]}, {"$set": updates}, return_document=True,
    )

    user = await _linked_user(member)
    if user and new_status in ("Active", "Inactive"):
        active = new_status == "Active"
        change: dict = {"$set": {
            "is_active": active,
            "verification_status": "active" if active else "suspended",
            "updated_at": now,
        }}
        if not active:
            change["$inc"] = {"token_version": 1}
        await _users().update_one({"_id": user["_id"]}, change)
        cache.forget_user(str(user["_id"]))
        if active:
            await notify(
                get_database(), str(user["_id"]),
                "Your account is open again",
                reason or "You can sign in and carry on where you left off.",
            )
        else:
            await notify(
                get_database(), str(user["_id"]),
                "Your account has been suspended",
                reason or "Please contact support if you think this is a mistake.",
            )

    why = f" — {reason}" if reason else ""
    await record(
        me, action, target=str(member["_id"]),
        detail=f"{_name(member)}: {member.get('status', '')} → {new_status}{why}", request=request,
    )
    return doc


@router.post("/bulk-status", response_model=BulkStatusResponse,
    summary="Suspend or restore several members at once",
    dependencies=[Depends(require_permission("users.edit"))],
)
async def bulk_status(payload: BulkStatusRequest, request: Request, me: dict = Depends(get_current_user)):
    changed = skipped = 0
    for raw in payload.ids:
        if not ObjectId.is_valid(raw):
            skipped += 1
            continue
        member = await _members().find_one({"_id": ObjectId(raw)})
        if not member or member.get("status") == payload.status:
            skipped += 1
            continue
        try:
            require_member_in_scope(member, me)
        except HTTPException:
            skipped += 1
            continue
        await _apply_status(
            member, payload.status, me, payload.reason, request,
            action="member.suspend" if payload.status == "Inactive" else "member.restore",
        )
        changed += 1
    verb = "suspended" if payload.status == "Inactive" else "restored"
    return BulkStatusResponse(
        changed=changed, skipped=skipped,
        message=f"{changed} member{'s' if changed != 1 else ''} {verb}"
                + (f", {skipped} already were or could not be found" if skipped else ""),
    )


@router.post("/bulk-region", response_model=BulkStatusResponse,
    summary="Assign several members to a region",
    dependencies=[Depends(require_permission("users.edit"))],
)
async def bulk_region(payload: BulkRegionRequest, request: Request, me: dict = Depends(get_current_user)):
    db = get_database()
    region = await db.regions.find_one({"name": {"$regex": f"^{re.escape(payload.region)}$", "$options": "i"}, "status": "Active"})
    if not region:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Choose an active region from the catalogue")
    target = region["name"]
    scope = scope_for(me)
    if scope["mode"] == "assigned" and target not in scope["regions"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only assign members to one of your regions")

    changed = skipped = 0
    for raw in payload.ids:
        if not ObjectId.is_valid(raw):
            skipped += 1
            continue
        member = await _members().find_one({"_id": ObjectId(raw)})
        if not member or member.get("location") == target:
            skipped += 1
            continue
        try:
            require_member_in_scope(member, me)
        except HTTPException:
            skipped += 1
            continue
        previous = member.get("location", "")
        await _members().update_one({"_id": member["_id"]}, {"$set": {
            "location": target, "updated_at": datetime.now(timezone.utc),
        }})
        await record(me, "member.region_assign", target=str(member["_id"]),
                     detail=f"{_name(member)}: {previous or 'Unassigned'} → {target}"
                            + (f" — {payload.reason}" if payload.reason else ""), request=request)
        changed += 1
    return BulkStatusResponse(
        changed=changed, skipped=skipped,
        message=f"{changed} member{'s' if changed != 1 else ''} assigned to {target}"
                + (f", {skipped} unchanged or unavailable" if skipped else ""),
    )


async def _erase_everything(member: Optional[dict], user: Optional[dict]) -> dict[str, int]:
    """
    Delete a woman's login, her directory row, and everything that only existed
    because of her — see `delete_member` for why each part is there. Shared by
    the delete button and by completing a deletion she asked for herself.
    """
    from pathlib import Path

    from app.core import integrity

    db = get_database()
    removed: dict[str, int] = {}
    if user:
        uid = str(user["_id"])
        # Her ID documents, off the disk as well as out of the database.
        folder = Path(settings.PRIVATE_MEDIA_DIR) / uid
        if folder.exists():
            for f in folder.glob("*"):
                f.unlink(missing_ok=True)
            folder.rmdir()
        removed.update(await integrity.cascade_delete("users", user["_id"]))
        await db[UserModel.collection_name].delete_one({"_id": user["_id"]})
        cache.forget_user(uid)
        removed["users deleted"] = 1

    if member:
        removed.update(await integrity.cascade_delete("members", member["_id"]))
        await db[MemberModel.collection_name].delete_one({"_id": member["_id"]})
    return removed


# --- deletion requests -------------------------------------------------------
# A member asks from Settings → "Delete my account". That suspends her at once
# and records the request (routes/me.py); a human completes the erasure here,
# within the 30 days the member screen promises, or cancels it if she changed
# her mind. Nothing about this is automatic on purpose: bookings, a wallet
# balance or a legal hold are things a person should look at first.

def _deletion_query() -> dict:
    return {"deletion_requested_at": {"$ne": None}}


async def _deletion_row(user: dict, now: datetime) -> DeletionRequestRow:
    member = None
    if user.get("member_id"):
        try:
            member = await _members().find_one({"_id": ObjectId(user["member_id"])})
        except Exception:  # noqa: BLE001
            member = None
    if member is None and user.get("email"):
        member = await _members().find_one({"email": user["email"]})
    asked = aware(user.get("deletion_requested_at")) or now
    days = max(0, (now - asked).days)
    return DeletionRequestRow(
        user_id=str(user["_id"]),
        member_id=str(member["_id"]) if member else "",
        name=user.get("full_name") or (_name(member) if member else "") or "—",
        email=user.get("email", ""),
        code=(member or {}).get("code", ""),
        reason=user.get("deletion_reason") or "",
        requested_at=_iso(user.get("deletion_requested_at")),
        days_waiting=days,
        overdue=days > 30,
    )


@router.get("/deletions", response_model=DeletionRequestList,
    summary="Members who asked for their account to be deleted",
    dependencies=[Depends(require_permission("users.view"))],
)
async def list_deletion_requests(_: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    docs = await _users().find(_deletion_query()).sort("deletion_requested_at", 1).to_list(500)
    rows = [await _deletion_row(u, now) for u in docs]
    visible = []
    for row in rows:
        member = await _members().find_one({"_id": ObjectId(row.member_id)}) if row.member_id else None
        if member:
            try:
                require_member_in_scope(member, _)
                visible.append(row)
            except HTTPException:
                pass
    rows = visible
    return DeletionRequestList(items=rows, total=len(rows), overdue=sum(1 for r in rows if r.overdue))


async def _deletion_user_or_404(user_id: str) -> dict:
    user = await _users().find_one({"_id": to_object_id(user_id), **_deletion_query()})
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No open deletion request for that account")
    return user


@router.post("/deletions/{user_id}/complete", summary="Erase the account she asked us to delete",
    dependencies=[Depends(require_permission("users.delete"))],
)
async def complete_deletion(
    user_id: str,
    request: Request,
    note: str = Query("", max_length=400, description="Anything checked first — goes in the audit log"),
    me: dict = Depends(get_current_user),
):
    user = await _deletion_user_or_404(user_id)
    now = datetime.now(timezone.utc)
    row = await _deletion_row(user, now)
    member = await _members().find_one({"_id": ObjectId(row.member_id)}) if row.member_id else None
    if member:
        require_member_in_scope(member, me)

    removed = await _erase_everything(member, user)
    detail = ", ".join(f"{n} {what}" for what, n in sorted(removed.items())) or "nothing else"
    extra = f" — {note.strip()}" if note.strip() else ""
    await record(
        me, "member.erase", target=row.member_id or row.user_id,
        detail=(f"Completed the deletion {row.name} ({row.code or row.email}) asked for on "
                f"{row.requested_at[:10]}{extra}. Also removed: {detail}"),
        request=request,
    )
    return {"message": f"Account erased. Also removed: {detail}."}


@router.post("/deletions/{user_id}/cancel", summary="Keep the account — she changed her mind",
    dependencies=[Depends(require_permission("users.edit"))],
)
async def cancel_deletion(
    user_id: str,
    request: Request,
    reason: str = Query("", max_length=400, description="How we know she wants to stay"),
    me: dict = Depends(get_current_user),
):
    user = await _deletion_user_or_404(user_id)
    now = datetime.now(timezone.utc)
    row = await _deletion_row(user, now)
    member = await _members().find_one({"_id": ObjectId(row.member_id)}) if row.member_id else None
    if member:
        require_member_in_scope(member, me)
    # She was suspended the moment she asked; requesting deletion is the only
    # way `suspended` and `deletion_requested_at` go together, so lifting both
    # restores exactly the state she was in before she asked.
    was = user.get("verification_status")
    restore_to = VerificationStatus.ACTIVE if user.get("verified_at") else VerificationStatus.IN_REVIEW
    await _users().update_one(
        {"_id": user["_id"]},
        {"$unset": {"deletion_requested_at": "", "deletion_reason": ""},
         "$set": {"verification_status": restore_to if was == VerificationStatus.SUSPENDED else was,
                  "updated_at": now}},
    )
    cache.forget_user(str(user["_id"]))
    why = f" — {reason.strip()}" if reason.strip() else ""
    await record(
        me, "member.deletion_cancelled", target=row.member_id or row.user_id,
        detail=f"Cancelled the deletion {row.name} ({row.code or row.email}) asked for on {row.requested_at[:10]}{why}",
        request=request,
    )
    return {"message": "Deletion request cancelled. She can sign in again."}


@router.get("/{member_id}", response_model=MemberResponse, summary="Get a member",
    dependencies=[Depends(require_permission("users.view"))],
)
async def get_member(member_id: str, _: dict = Depends(get_current_user)):
    member = await _member_or_404(member_id)
    require_member_in_scope(member, _)
    return MemberResponse(**MemberModel.to_response(member))


@router.get("/{member_id}/profile", response_model=MemberProfileResponse,
    summary="A member's profile: directory row, account state, and what she has done",
    dependencies=[Depends(require_permission("users.view"))],
)
async def member_profile(member_id: str, _: dict = Depends(get_current_user)):
    member = await _member_or_404(member_id)
    require_member_in_scope(member, _)
    db = get_database()
    user = await _linked_user(member)
    mid = str(member["_id"])
    uid = str(user["_id"]) if user else ""

    account = None
    if user:
        state = user.get("verification_status") or VerificationStatus.ACTIVE
        account = {
            "id": uid,
            "verification_status": state,
            "verification_label": VerificationStatus.LABELS.get(state, state),
            "verified_at": _iso(user.get("verified_at")),
            "email_verified_at": _iso(user.get("email_verified_at")),
            "is_active": bool(user.get("is_active", True)),
            "locale": user.get("locale") or "en",
            "onboarding_complete": bool(user.get("onboarding_complete", False)),
            "last_login_at": _iso(user.get("last_login_at")),
            "rejection_reason": user.get("rejection_reason") or "",
            "created_at": _iso(user.get("created_at")),
            "needs": [str(n) for n in ((user.get("ai_context") or {}).get("needs") or [])],
            "deletion_requested_at": _iso(user.get("deletion_requested_at")),
            "deletion_reason": user.get("deletion_reason") or "",
        }

    # Rows are keyed by user_id or member_id depending on the collection's age;
    # match either so nothing she did is missed.
    keys = [k for k in (uid, mid) if k]
    owner = {"$or": [{"user_id": {"$in": keys}}, {"member_id": {"$in": keys}}]}
    counts: dict[str, int] = {}
    for coll, key in _ACTIVITY.items():
        counts[key] = await db[coll].count_documents(owner)
    counts["total"] = sum(counts.values())

    enrolments = []
    async for e in db["enrollments"].find(owner).sort("created_at", -1).limit(10):
        enrolments.append({
            "id": str(e["_id"]),
            "program_name": e.get("program_name") or "",
            "status": e.get("status") or "",
            "progress": int(e.get("progress") or 0),
            "started": _iso(e.get("created_at")),
        })
    bookings = []
    async for b in db["bookings"].find(owner).sort("created_at", -1).limit(10):
        bookings.append({
            "id": str(b["_id"]),
            "service_name": b.get("service_name") or "",
            "date": str(b.get("date") or ""),
            "time": str(b.get("time") or ""),
            "mode": b.get("mode") or "",
            "status": b.get("status") or "",
        })

    # What staff have done to her. Older rows named the target by full name;
    # newer ones by id. Match both.
    targets = [t for t in (mid, uid, member.get("full_name", ""), member.get("code", "")) if t]
    history = []
    async for a in db["activity_log"].find({"target": {"$in": targets}}).sort("created_at", -1).limit(20):
        history.append({
            "id": str(a["_id"]),
            "by": a.get("user_name") or "",
            "action": a.get("action") or "",
            "detail": a.get("detail") or "",
            "when": _iso(a.get("created_at")),
        })

    return MemberProfileResponse(
        member=MemberResponse(**MemberModel.to_response(member)),
        account=account,
        activity=counts,
        enrolments=enrolments,
        bookings=bookings,
        history=history,
    )


@router.patch("/{member_id}", response_model=MemberResponse, summary="Update a member",
    dependencies=[Depends(require_permission("users.edit"))],
)
async def update_member(
    member_id: str, payload: MemberUpdate, request: Request, me: dict = Depends(get_current_user),
):
    oid = to_object_id(member_id)
    updates = payload.model_dump(exclude_unset=True)
    # Status has its own endpoints, with a reason and an account-side effect.
    updates.pop("status", None)
    if not updates:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nothing to change")

    if updates.get("email"):
        updates["email"] = str(updates["email"]).lower().strip()
        clash = await _members().find_one({"email": updates["email"], "_id": {"$ne": oid}})
        if clash:
            raise HTTPException(status.HTTP_409_CONFLICT, "Another member already uses this email")

    before = await _member_or_404(member_id)
    require_member_in_scope(before, me)
    updates["updated_at"] = datetime.now(timezone.utc)
    doc = await _members().find_one_and_update({"_id": oid}, {"$set": updates}, return_document=True)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")

    # Keep the login's name, phone and avatar in step, so what she sees on her
    # own profile is what the admin just typed.
    user = await _linked_user(before)
    if user:
        mirrored = {k: updates[k] for k in ("full_name", "phone", "avatar", "email") if k in updates}
        if mirrored:
            mirrored["updated_at"] = updates["updated_at"]
            await _users().update_one({"_id": user["_id"]}, {"$set": mirrored})
            cache.forget_user(str(user["_id"]))

    fields = ", ".join(k for k in updates if k != "updated_at")
    await record(
        me, "member.update", target=str(oid),
        detail=f"Edited {_name(doc)}: {fields}", request=request,
    )
    return MemberResponse(**MemberModel.to_response(doc))


@router.patch("/{member_id}/status", response_model=MemberResponse, summary="Change a member's status",
    dependencies=[Depends(require_permission("users.edit"))],
)
async def set_member_status(
    member_id: str, payload: MemberStatusUpdate, request: Request, me: dict = Depends(get_current_user),
):
    member = await _member_or_404(member_id)
    require_member_in_scope(member, me)
    doc = await _apply_status(member, payload.status, me, payload.reason, request, action="member.status")
    return MemberResponse(**MemberModel.to_response(doc))


@router.post("/{member_id}/suspend", response_model=MemberResponse,
    summary="Suspend a member — she cannot sign in until restored",
    dependencies=[Depends(require_permission("users.edit"))],
)
async def suspend_member(
    member_id: str, payload: RequiredReasonRequest, request: Request, me: dict = Depends(get_current_user),
):
    member = await _member_or_404(member_id)
    require_member_in_scope(member, me)
    if member.get("status") == "Inactive":
        raise HTTPException(status.HTTP_409_CONFLICT, "This member is already suspended")
    doc = await _apply_status(member, "Inactive", me, payload.reason, request, action="member.suspend")
    return MemberResponse(**MemberModel.to_response(doc))


@router.post("/{member_id}/restore", response_model=MemberResponse,
    summary="Restore a suspended member",
    dependencies=[Depends(require_permission("users.edit"))],
)
async def restore_member(
    member_id: str, payload: ReasonRequest, request: Request, me: dict = Depends(get_current_user),
):
    member = await _member_or_404(member_id)
    require_member_in_scope(member, me)
    if member.get("status") == "Active":
        raise HTTPException(status.HTTP_409_CONFLICT, "This member is already active")
    doc = await _apply_status(member, "Active", me, payload.reason, request, action="member.restore")
    return MemberResponse(**MemberModel.to_response(doc))


@router.post("/{member_id}/approve", response_model=MemberResponse,
    summary="Approve a pending member",
    dependencies=[Depends(require_permission("users.approve"))],
)
async def approve_member(
    member_id: str, payload: ReasonRequest, request: Request, me: dict = Depends(get_current_user),
):
    """
    The same transition the verification queue makes, reachable from her
    profile. The account becomes usable, any pending ID documents are marked
    approved by this reviewer, the directory row goes Active, and she is
    emailed.
    """
    member = await _member_or_404(member_id)
    require_member_in_scope(member, me)
    if member.get("status") == "Active":
        raise HTTPException(status.HTTP_409_CONFLICT, "This member is already approved")
    now = datetime.now(timezone.utc)
    db = get_database()

    user = await _linked_user(member)
    if user:
        await _users().update_one(
            {"_id": user["_id"]},
            {"$set": {
                "verification_status": VerificationStatus.ACTIVE,
                "verified_at": now,
                "rejection_reason": "",
                "is_active": True,
                "updated_at": now,
            }},
        )
        await db[DocumentModel.collection_name].update_many(
            {"user_id": str(user["_id"]), "status": DocumentModel.STATUS_PENDING},
            {"$set": {
                "status": DocumentModel.STATUS_APPROVED,
                "reviewed_by": str(me["_id"]),
                "reviewed_by_name": me.get("full_name", ""),
                "reviewed_at": now,
            }},
        )
        cache.forget_user(str(user["_id"]))
        await mailer.send(
            mailer.approved_email(user.get("full_name", ""), f"{settings.APP_BASE_URL.rstrip('/')}/signin"),
            user["email"],
        )

    doc = await _members().find_one_and_update(
        {"_id": member["_id"]},
        {"$set": {"status": "Active", "verified_on": now.strftime("%b %d, %Y"), "updated_at": now}},
        return_document=True,
    )
    why = f" — {payload.reason}" if payload.reason else ""
    await record(
        me, "member.approve", target=str(member["_id"]),
        detail=f"Approved {_name(member)}{why}", request=request,
    )
    return MemberResponse(**MemberModel.to_response(doc))


@router.post("/{member_id}/reject", response_model=MemberResponse,
    summary="Reject a pending member, with a reason she is told",
    dependencies=[Depends(require_permission("users.approve"))],
)
async def reject_member(
    member_id: str, payload: RequiredReasonRequest, request: Request, me: dict = Depends(get_current_user),
):
    member = await _member_or_404(member_id)
    require_member_in_scope(member, me)
    if member.get("status") == "Rejected":
        raise HTTPException(status.HTTP_409_CONFLICT, "This member is already rejected")
    now = datetime.now(timezone.utc)
    db = get_database()

    user = await _linked_user(member)
    if user:
        await _users().update_one(
            {"_id": user["_id"]},
            {"$set": {
                "verification_status": VerificationStatus.REJECTED,
                "rejection_reason": payload.reason,
                "updated_at": now,
            }},
        )
        await db[DocumentModel.collection_name].update_many(
            {"user_id": str(user["_id"]), "status": DocumentModel.STATUS_PENDING},
            {"$set": {
                "status": DocumentModel.STATUS_REJECTED,
                "reviewed_by": str(me["_id"]),
                "reviewed_by_name": me.get("full_name", ""),
                "reviewed_at": now,
                "review_note": payload.reason,
            }},
        )
        cache.forget_user(str(user["_id"]))
        await mailer.send(mailer.rejected_email(user.get("full_name", ""), payload.reason), user["email"])

    doc = await _members().find_one_and_update(
        {"_id": member["_id"]},
        {"$set": {"status": "Rejected", "updated_at": now}},
        return_document=True,
    )
    await record(
        me, "member.reject", target=str(member["_id"]),
        detail=f"Rejected {_name(member)} — {payload.reason}", request=request,
    )
    return MemberResponse(**MemberModel.to_response(doc))


@router.delete("/{member_id}", summary="Delete a member",
    dependencies=[Depends(require_permission("users.delete"))],
)
async def delete_member(
    member_id: str,
    request: Request,
    reason: str = Query("", max_length=400, description="Why — goes in the audit log"),
    me: dict = Depends(get_current_user),
):
    """
    Delete a member, and everything that only existed because of her.

    **This used to delete one row.** `members.delete_one` removed the directory
    profile and left everything else exactly where it was:

      · her `users` row survived, so the login still worked — an account that
        could sign in, with no profile behind it, which is a broken state no
        screen is written for;
      · her documents, notifications, messages, saved items and reset tokens
        all stayed, pointing at a member who no longer existed. Mongo has no
        foreign keys and nothing cascades, so nothing said a word.

    What is deleted and what survives is declared in `app/core/integrity.py`
    rather than here, so a new collection is one line in one table instead of a
    rule somebody has to remember to add to this function. Her financial
    records SURVIVE with the pointer cleared — a wallet transaction is a record
    of money that actually moved, and deleting it to tidy a reference would be
    falsifying a ledger.

    Her identity documents are deleted from disk as well as from the database.
    Leaving an encrypted photograph of somebody's Aadhaar card on a server
    after she has been removed is not a filing error.
    """
    member = await _member_or_404(member_id)
    require_member_in_scope(member, me)
    user = await _linked_user(member)
    removed = await _erase_everything(member, user)

    detail = ", ".join(f"{n} {what}" for what, n in sorted(removed.items())) or "nothing else"
    why = f" — {reason.strip()}" if reason.strip() else ""
    await record(
        me, "member.delete", target=str(member["_id"]),
        detail=f"Deleted {_name(member)} ({member.get('code', '')}){why}. Also removed: {detail}",
        request=request,
    )
    return {"message": f"Member deleted. Also removed: {detail}."}


@router.post(
    "/{member_id}/reset-password",
    response_model=dict,
    summary="Start a password reset for a member",
    dependencies=[Depends(require_permission("users.edit"))],
)
async def start_password_reset(member_id: str, request: Request, me: dict = Depends(get_current_user)):
    """
    Staff-initiated password reset.

    We never set a password on someone's behalf and we never reveal one — that
    would mean a staff member briefly knowing a member's credentials. Instead
    this issues a single-use, 24-hour link and emails it to her.
    """
    from app.models.verification import EmailTokenModel

    db = get_database()
    member = await _member_or_404(member_id)
    require_member_in_scope(member, me)
    user = await _linked_user(member)
    if not user:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "That member has no sign-in account to reset"
        )

    # Retire any earlier unused reset link, so only the newest one works.
    await db[EmailTokenModel.collection_name].delete_many(
        {"user_id": str(user["_id"]), "purpose": EmailTokenModel.PURPOSE_RESET, "used_at": None}
    )
    token_doc, raw_token = EmailTokenModel.create_document(
        str(user["_id"]), EmailTokenModel.PURPOSE_RESET, hours=24
    )
    await db[EmailTokenModel.collection_name].insert_one(token_doc)

    url = f"{settings.APP_BASE_URL}/reset-password?token={raw_token}"
    delivered = await mailer.send(
        mailer.reset_email(user.get("full_name", ""), url, by_staff=True), user["email"]
    )

    await record(
        me, "member.reset_password", target=str(member["_id"]),
        detail=f"Started a password reset for {_name(member)}"
               + ("" if delivered else " (email could not be delivered)"),
        request=request,
    )
    return {
        "message": (
            f"A reset link has been sent to {user['email']}. It expires in 24 hours."
            if delivered
            else f"A reset link was issued for {user['email']}, but email is not set up to deliver it yet."
        ),
        "delivered": delivered,
    }
