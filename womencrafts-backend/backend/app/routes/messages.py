"""
The staff inbox: every member's thread with the team.

── One store, the one she reads ────────────────────────────────────────────
A member has exactly one thread with the team (`models/conversation.py`). Her
app reads it from `GET /me/messages`, counts what she has not seen at
`GET /me/unread`, and is told about a new reply through her notifications.
This module reads and writes those same `member_messages` rows, so what staff
see here is what she sees there — there is no admin-side copy to drift.

What the rows cannot carry — who on the team is looking after a thread, and
whether it has been resolved — lives in `member_threads` (`models/message.py`),
one document per member, created the first time staff assign or resolve.

── What is measured, and what is not ───────────────────────────────────────
Every figure here is computed from stored timestamps and flags: unread is the
`read_by_team` flag, "seen" is `read_by_member`, the reply time is the median
gap between a member's message and the team's next one. Nothing is presence,
typing, or an estimate. A reply is delivered *in the app*: stored in her
thread and filed as a notification. No SMS, WhatsApp or email is sent, and
the screen says so.

── What stays private ──────────────────────────────────────────────────────
The panel beside a thread shows the member's name, email, avatar, join date
and verification state. Never her vault, her in-case-of-emergency data or her
documents; there is no endpoint here that reads them.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.core import mongosafe
from app.core.audit import record
from app.core.deps import get_current_user
from app.core.media import media_url
from app.core.permissions import require_permission
from app.core.rbac import MEMBER_ROLE
from app.core.serializers import page_meta
from app.db.mongodb import get_database
from app.models.conversation import MemberMessageModel, MemberNotificationModel, notify
from app.models.message import SupportThreadModel
from app.models.user import UserModel
from app.schemas.message import (
    AssignRequest,
    MemberHit,
    MessageStats,
    ReplyRequest,
    SimpleMessage,
    StaffOption,
    StartThreadRequest,
    ThreadCounts,
    ThreadDetail,
    ThreadFilter,
    ThreadListResponse,
    ThreadMessage,
    ThreadRow,
)

router = APIRouter(prefix="/messages", tags=["Messages"])


def _messages():
    return get_database()[MemberMessageModel.collection_name]


def _threads():
    return get_database()[SupportThreadModel.collection_name]


def _users():
    return get_database()[UserModel.collection_name]


# --- small helpers -------------------------------------------------------------

_EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    if not isinstance(dt, datetime):
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _iso(dt: Optional[datetime]) -> Optional[str]:
    dt = _aware(dt)
    return dt.isoformat() if dt else None


def _label(dt: Optional[datetime]) -> str:
    dt = _aware(dt)
    return dt.strftime("%d %b, %I:%M %p") if dt else ""


def _oid(value: str, what: str = "Member") -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"{what} not found")


async def _member(user_id: str) -> dict:
    doc = await _users().find_one({"_id": _oid(user_id), "role": MEMBER_ROLE})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    return doc


def _name(user: dict) -> str:
    return user.get("full_name") or user.get("email") or "this member"


def _message_row(m: dict) -> dict:
    created = m.get("created_at")
    return {
        "id": str(m["_id"]),
        "sender": m.get("sender", MemberMessageModel.FROM_MEMBER),
        "sender_name": m.get("sender_name", ""),
        "body": m.get("body", ""),
        "sent_at": _iso(created) or "",
        "sent_label": _label(created),
        "read_by_member": bool(m.get("read_by_member")),
        "read_by_team": bool(m.get("read_by_team")),
    }


# --- folding the message rows into per-member summaries ------------------------

_SUMMARY_PROJECTION = {
    "user_id": 1, "sender": 1, "body": 1, "created_at": 1, "read_by_team": 1,
}


def _fold(summary: dict, m: dict) -> None:
    """Advance one thread's summary by one message, in created_at order."""
    created = _aware(m.get("created_at"))
    sender = m.get("sender", MemberMessageModel.FROM_MEMBER)
    summary["count"] += 1
    summary["last_body"] = m.get("body", "")
    summary["last_sender"] = sender
    summary["last_at"] = created
    summary["first_at"] = summary["first_at"] or created
    if sender == MemberMessageModel.FROM_MEMBER:
        summary["received"] += 1
        summary["last_member_at"] = created
        if not m.get("read_by_team"):
            summary["unread"] += 1
        if summary["waiting_since"] is None:
            summary["waiting_since"] = created
        if summary["asked_at"] is None:
            summary["asked_at"] = created
    else:
        summary["sent"] += 1
        summary["last_team_at"] = created
        summary["waiting_since"] = None
        if summary["asked_at"] is not None and created is not None:
            summary["gaps"].append((created - summary["asked_at"]).total_seconds() / 60)
            summary["asked_at"] = None


def _blank(uid: str) -> dict:
    return {
        "user_id": uid, "count": 0, "unread": 0, "received": 0, "sent": 0,
        "last_body": "", "last_sender": "", "last_at": None, "first_at": None,
        "last_member_at": None, "last_team_at": None,
        "waiting_since": None, "asked_at": None, "gaps": [],
    }


async def _summaries(user_id: Optional[str] = None) -> dict[str, dict]:
    query = {"user_id": user_id} if user_id else {}
    out: dict[str, dict] = {}
    async for m in _messages().find(query, _SUMMARY_PROJECTION).sort("created_at", 1):
        uid = m.get("user_id") or ""
        if not uid:
            continue
        _fold(out.setdefault(uid, _blank(uid)), m)
    return out


async def _users_for(uids: list[str]) -> dict[str, dict]:
    oids = []
    for uid in uids:
        try:
            oids.append(ObjectId(uid))
        except (InvalidId, TypeError):
            continue
    if not oids:
        return {}
    return {str(u["_id"]): u async for u in _users().find({"_id": {"$in": oids}})}


async def _states_for(uids: list[str]) -> dict[str, dict]:
    if not uids:
        return {}
    return {s["user_id"]: s async for s in _threads().find({"user_id": {"$in": uids}})}


def _row(summary: dict, user: dict, state: Optional[dict]) -> dict:
    status_, reopened = SupportThreadModel.effective_status(state, summary["last_member_at"])
    return {
        "user_id": summary["user_id"],
        "full_name": user.get("full_name", ""),
        "email": user.get("email", ""),
        "avatar": media_url(user.get("avatar", "")),
        "message_count": summary["count"],
        "unread": summary["unread"],
        "last_message": (summary["last_body"] or "")[:140],
        "last_sender": summary["last_sender"],
        "last_at": _iso(summary["last_at"]),
        "last_label": _label(summary["last_at"]),
        "waiting_since": _iso(summary["waiting_since"]) if status_ == "open" else None,
        "status": status_,
        "reopened": reopened,
        "resolved_at": _iso((state or {}).get("resolved_at")) if status_ == "resolved" else None,
        "resolved_by_name": (state or {}).get("resolved_by_name", "") if status_ == "resolved" else "",
        "assigned_to": SupportThreadModel.assignee(state),
    }


def _ordered(rows: list[dict]) -> list[dict]:
    """Whoever has waited longest first, then the most recent thread."""
    waiting = [r for r in rows if r["status"] == "open" and r.get("waiting_since")]
    rest = [r for r in rows if not (r["status"] == "open" and r.get("waiting_since"))]
    waiting.sort(key=lambda r: r["waiting_since"])
    rest.sort(key=lambda r: r.get("last_at") or "", reverse=True)
    return waiting + rest


def _matches(row: dict, filter_: str, me_id: str) -> bool:
    if filter_ == "awaiting":
        return row["status"] == "open" and bool(row["waiting_since"])
    if filter_ == "unread":
        return row["unread"] > 0
    if filter_ == "mine":
        return bool(row["assigned_to"]) and row["assigned_to"]["id"] == me_id
    if filter_ == "unassigned":
        return row["status"] == "open" and not row["assigned_to"]
    if filter_ == "resolved":
        return row["status"] == "resolved"
    return True


async def _all_rows() -> list[dict]:
    summaries = await _summaries()
    uids = list(summaries)
    users, states = await _users_for(uids), await _states_for(uids)
    rows = []
    for uid, s in summaries.items():
        user = users.get(uid)
        if not user:
            # A thread whose account is gone cannot be answered; it is not shown.
            continue
        rows.append(_row(s, user, states.get(uid)))
    return _ordered(rows)


async def _detail(user_id: str, member: Optional[dict] = None) -> dict:
    member = member or await _member(user_id)
    docs = [m async for m in _messages().find({"user_id": user_id}).sort("created_at", 1)]
    if not docs:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No thread with this member yet")
    summary = _blank(user_id)
    for m in docs:
        _fold(summary, m)
    state = await _threads().find_one({"user_id": user_id})
    row = _row(summary, member, state)
    row.update(
        member={
            "id": str(member["_id"]),
            "full_name": member.get("full_name", ""),
            "email": member.get("email", ""),
            "avatar": media_url(member.get("avatar", "")),
            "joined_at": _iso(member.get("created_at")),
            "verification_status": str(member.get("verification_status") or ""),
            "is_active": bool(member.get("is_active", True)),
        },
        messages=[_message_row(m) for m in docs],
        first_at=_iso(summary["first_at"]),
        last_team_at=_iso(summary["last_team_at"]),
        last_member_at=_iso(summary["last_member_at"]),
        assigned_at=_iso((state or {}).get("assigned_at")),
    )
    return row


async def _upsert_state(user_id: str, sets: dict) -> None:
    sets = {**sets, "updated_at": datetime.now(timezone.utc)}
    on_insert = {
        k: v for k, v in SupportThreadModel.create_document(user_id=user_id).items()
        if k not in sets and k != "user_id"
    }
    await _threads().update_one(
        {"user_id": user_id}, {"$set": sets, "$setOnInsert": on_insert}, upsert=True
    )


async def _deliver(member: dict, body: str, me: dict) -> dict:
    """
    Store the team's message in her thread and tell her about it.

    This is the whole delivery: the row her app reads at /me/messages, the
    `read_by_member=False` flag her badge counts, and a notification with a
    link to the thread. Nothing leaves the platform.
    """
    db = get_database()
    user_id = str(member["_id"])
    doc = MemberMessageModel.create_document(
        user_id=user_id,
        member_id=member.get("member_id") or "",
        body=body,
        sender=MemberMessageModel.FROM_TEAM,
        sender_name=me.get("full_name") or "WomSakhi team",
    )
    result = await _messages().insert_one(doc)
    doc["_id"] = result.inserted_id
    # Answering her is reading her.
    await _messages().update_many(
        {"user_id": user_id, "sender": MemberMessageModel.FROM_MEMBER, "read_by_team": False},
        {"$set": {"read_by_team": True}},
    )
    await notify(
        db, user_id,
        title="New reply from the team",
        body=body[:90],
        ntype=MemberNotificationModel.TYPE_MESSAGE,
        href="/app/messages",
    )
    return doc


# --- threads -------------------------------------------------------------------

@router.get(
    "/threads", response_model=ThreadListResponse, summary="Every member's thread with the team",
    dependencies=[Depends(require_permission("messages.view"))],
)
async def list_threads(
    q: Optional[str] = Query(None, description="Member name or email"),
    filter: ThreadFilter = Query("all"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    me: dict = Depends(get_current_user),
):
    me_id = str(me.get("_id", ""))
    rows = await _all_rows()
    counts = ThreadCounts(
        all=len(rows),
        awaiting=sum(1 for r in rows if _matches(r, "awaiting", me_id)),
        unread=sum(1 for r in rows if _matches(r, "unread", me_id)),
        mine=sum(1 for r in rows if _matches(r, "mine", me_id)),
        unassigned=sum(1 for r in rows if _matches(r, "unassigned", me_id)),
        resolved=sum(1 for r in rows if _matches(r, "resolved", me_id)),
    )
    shown = [r for r in rows if _matches(r, filter, me_id)]
    if q and q.strip():
        needle = q.strip().lower()
        shown = [r for r in shown if needle in r["full_name"].lower() or needle in r["email"].lower()]
    total = len(shown)
    start = (page - 1) * page_size
    items = [ThreadRow(**r) for r in shown[start:start + page_size]]
    return ThreadListResponse(items=items, counts=counts, **page_meta(total, page, page_size))


@router.get(
    "/threads/{user_id}", response_model=ThreadDetail, summary="One member's thread, in full",
    dependencies=[Depends(require_permission("messages.view"))],
)
async def get_thread(user_id: str, _: dict = Depends(get_current_user)):
    return ThreadDetail(**await _detail(user_id))


@router.post(
    "/threads", response_model=ThreadDetail, status_code=status.HTTP_201_CREATED,
    summary="Start a conversation with a member",
    dependencies=[Depends(require_permission("messages.create"))],
)
async def start_thread(payload: StartThreadRequest, request: Request, me: dict = Depends(get_current_user)):
    member = await _member(payload.user_id)
    existed = await _messages().count_documents({"user_id": payload.user_id}, limit=1) > 0
    await _deliver(member, payload.body, me)
    await record(
        me, "messages.reply" if existed else "messages.start", target=payload.user_id,
        detail=f"{'Replied to' if existed else 'Started a conversation with'} {_name(member)}: “{payload.body[:80]}”",
        request=request,
    )
    return ThreadDetail(**await _detail(payload.user_id, member))


@router.post(
    "/threads/{user_id}/reply", response_model=ThreadDetail, status_code=status.HTTP_201_CREATED,
    summary="Reply in a member's thread",
    dependencies=[Depends(require_permission("messages.create"))],
)
async def reply(user_id: str, payload: ReplyRequest, request: Request, me: dict = Depends(get_current_user)):
    member = await _member(user_id)
    await _deliver(member, payload.body, me)
    await record(
        me, "messages.reply", target=user_id,
        detail=f"Replied to {_name(member)}: “{payload.body[:80]}”", request=request,
    )
    return ThreadDetail(**await _detail(user_id, member))


@router.post(
    "/threads/{user_id}/read", response_model=ThreadDetail, summary="Mark her messages read by the team",
    dependencies=[Depends(require_permission("messages.edit"))],
)
async def mark_read(user_id: str, request: Request, me: dict = Depends(get_current_user)):
    member = await _member(user_id)
    result = await _messages().update_many(
        {"user_id": user_id, "sender": MemberMessageModel.FROM_MEMBER, "read_by_team": False},
        {"$set": {"read_by_team": True}},
    )
    if result.modified_count:
        await record(
            me, "messages.read", target=user_id,
            detail=f"Read {result.modified_count} new message(s) from {_name(member)}", request=request,
        )
    return ThreadDetail(**await _detail(user_id, member))


@router.post(
    "/threads/{user_id}/unread", response_model=ThreadDetail, summary="Put her last message back in the unread pile",
    dependencies=[Depends(require_permission("messages.edit"))],
)
async def mark_unread(user_id: str, request: Request, me: dict = Depends(get_current_user)):
    member = await _member(user_id)
    docs = [m async for m in _messages().find({"user_id": user_id}, {"sender": 1, "created_at": 1}).sort("created_at", 1)]
    # The final run of her messages — what the team still owes an answer to —
    # or, if the team had the last word, just her latest one.
    ids: list = []
    for m in reversed(docs):
        if m.get("sender") == MemberMessageModel.FROM_MEMBER:
            ids.append(m["_id"])
        elif ids:
            break
    if not ids:
        last_member = next((m for m in reversed(docs) if m.get("sender") == MemberMessageModel.FROM_MEMBER), None)
        if not last_member:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "She has not written anything yet")
        ids = [last_member["_id"]]
    await _messages().update_many({"_id": {"$in": ids}}, {"$set": {"read_by_team": False}})
    await record(
        me, "messages.unread", target=user_id,
        detail=f"Marked {len(ids)} message(s) from {_name(member)} unread", request=request,
    )
    return ThreadDetail(**await _detail(user_id, member))


@router.post(
    "/threads/{user_id}/assign", response_model=ThreadDetail, summary="Hand a thread to a staff account",
    dependencies=[Depends(require_permission("messages.edit"))],
)
async def assign(user_id: str, payload: AssignRequest, request: Request, me: dict = Depends(get_current_user)):
    member = await _member(user_id)
    if not await _messages().count_documents({"user_id": user_id}, limit=1):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No thread with this member yet")
    staff_id = (payload.staff_id or "").strip()
    if staff_id:
        staff = await _users().find_one(
            {"_id": _oid(staff_id, "Staff account"), "role": {"$ne": MEMBER_ROLE}, "is_active": True}
        )
        if not staff:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Staff account not found")
        sets = {
            "assigned_to": str(staff["_id"]),
            "assigned_name": staff.get("full_name") or staff.get("email", ""),
            "assigned_at": datetime.now(timezone.utc),
            "assigned_by": str(me.get("_id", "")),
        }
        detail = f"Assigned {_name(member)}'s thread to {sets['assigned_name']}"
    else:
        sets = {"assigned_to": "", "assigned_name": "", "assigned_at": None, "assigned_by": str(me.get("_id", ""))}
        detail = f"Unassigned {_name(member)}'s thread"
    await _upsert_state(user_id, sets)
    await record(me, "messages.assign", target=user_id, detail=detail, request=request)
    return ThreadDetail(**await _detail(user_id, member))


@router.post(
    "/threads/{user_id}/resolve", response_model=ThreadDetail, summary="Mark a thread resolved",
    dependencies=[Depends(require_permission("messages.edit"))],
)
async def resolve(user_id: str, request: Request, me: dict = Depends(get_current_user)):
    member = await _member(user_id)
    if not await _messages().count_documents({"user_id": user_id}, limit=1):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No thread with this member yet")
    await _upsert_state(user_id, {
        "status": SupportThreadModel.STATUS_RESOLVED,
        "resolved_at": datetime.now(timezone.utc),
        "resolved_by": str(me.get("_id", "")),
        "resolved_by_name": me.get("full_name") or me.get("email", ""),
    })
    # Resolving is reading: nothing in a closed thread should stay counted.
    await _messages().update_many(
        {"user_id": user_id, "sender": MemberMessageModel.FROM_MEMBER, "read_by_team": False},
        {"$set": {"read_by_team": True}},
    )
    await record(me, "messages.resolve", target=user_id, detail=f"Resolved {_name(member)}'s thread", request=request)
    return ThreadDetail(**await _detail(user_id, member))


@router.post(
    "/threads/{user_id}/reopen", response_model=ThreadDetail, summary="Reopen a resolved thread",
    dependencies=[Depends(require_permission("messages.edit"))],
)
async def reopen(user_id: str, request: Request, me: dict = Depends(get_current_user)):
    member = await _member(user_id)
    if not await _messages().count_documents({"user_id": user_id}, limit=1):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No thread with this member yet")
    await _upsert_state(user_id, {
        "status": SupportThreadModel.STATUS_OPEN,
        "resolved_at": None, "resolved_by": "", "resolved_by_name": "",
    })
    await record(me, "messages.reopen", target=user_id, detail=f"Reopened {_name(member)}'s thread", request=request)
    return ThreadDetail(**await _detail(user_id, member))


# --- lookups -------------------------------------------------------------------

@router.get(
    "/members", response_model=list[MemberHit], summary="Find a member to write to",
    dependencies=[Depends(require_permission("messages.view"))],
)
async def find_members(
    q: str = Query("", description="Name or email"),
    limit: int = Query(20, ge=1, le=50),
    _: dict = Depends(get_current_user),
):
    query: dict = {"role": MEMBER_ROLE}
    if q.strip():
        query.update(mongosafe.any_of(q.strip(), ["full_name", "email"]))
    users = [
        u async for u in _users()
        .find(query, {"full_name": 1, "email": 1, "avatar": 1})
        .sort("full_name", 1)
        .limit(limit)
    ]
    ids = [str(u["_id"]) for u in users]
    with_thread = set(await _messages().distinct("user_id", {"user_id": {"$in": ids}})) if ids else set()
    return [
        MemberHit(
            id=str(u["_id"]), full_name=u.get("full_name", ""), email=u.get("email", ""),
            avatar=media_url(u.get("avatar", "")), has_thread=str(u["_id"]) in with_thread,
        )
        for u in users
    ]


@router.get(
    "/staff", response_model=list[StaffOption], summary="Staff accounts a thread can be handed to",
    dependencies=[Depends(require_permission("messages.view"))],
)
async def staff_options(_: dict = Depends(get_current_user)):
    cursor = (
        _users()
        .find({"role": {"$ne": MEMBER_ROLE}, "is_active": True}, {"full_name": 1, "email": 1, "role": 1})
        .sort("full_name", 1)
    )
    return [
        StaffOption(id=str(u["_id"]), full_name=u.get("full_name") or u.get("email", ""), role=u.get("role", ""))
        async for u in cursor
    ]


# --- stats ---------------------------------------------------------------------

@router.get(
    "/stats", response_model=MessageStats, summary="Inbox figures, computed from the rows",
    dependencies=[Depends(require_permission("messages.view"))],
)
async def stats(_: dict = Depends(get_current_user)):
    summaries = await _summaries()
    uids = list(summaries)
    users, states = await _users_for(uids), await _states_for(uids)
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)

    threads = open_ = resolved = awaiting = unread = sent = received = 0
    gaps: list[float] = []
    for uid, s in summaries.items():
        if uid not in users:
            continue
        threads += 1
        status_, _reopened = SupportThreadModel.effective_status(states.get(uid), s["last_member_at"])
        if status_ == "resolved":
            resolved += 1
        else:
            open_ += 1
            if s["waiting_since"]:
                awaiting += 1
        unread += s["unread"]
        sent += s["sent"]
        received += s["received"]
        gaps.extend(s["gaps"])

    received_week = await _messages().count_documents(
        {"sender": MemberMessageModel.FROM_MEMBER, "created_at": {"$gte": week_ago}}
    )
    sent_week = await _messages().count_documents(
        {"sender": MemberMessageModel.FROM_TEAM, "created_at": {"$gte": week_ago}}
    )

    median = within_24h = None
    if gaps:
        gaps.sort()
        mid = len(gaps) // 2
        median = int(gaps[mid] if len(gaps) % 2 else (gaps[mid - 1] + gaps[mid]) / 2)
        within_24h = round(sum(1 for g in gaps if g <= 24 * 60) * 100 / len(gaps))

    return MessageStats(
        threads=threads, open=open_, resolved=resolved, awaiting_reply=awaiting,
        unread_messages=unread, sent_by_team=sent, received_from_members=received,
        received_this_week=received_week, sent_this_week=sent_week,
        median_first_reply_minutes=median, replies_measured=len(gaps),
        replied_within_24h_pct=within_24h,
    )


# --- seeding -------------------------------------------------------------------

async def seed() -> None:
    """
    Nothing to seed. The inbox is the members' real threads; inventing
    conversations here would put made-up women in front of staff. Kept as a
    callable because `core/seed_all.py` imports it by name.
    """
    return None
