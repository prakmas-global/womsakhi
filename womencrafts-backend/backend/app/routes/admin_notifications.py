"""
What needs a person's attention — the staff notifications feed.

── What this replaced ───────────────────────────────────────────────────────
/dashboard/notifications read a `notifications` collection that nothing on the
platform ever wrote to. It held twelve seeded rows — "Priya Sharma booked a
Career Counseling session", "AI predicts 15 appointments are likely to be
cancelled today", "Daily backup finished (4.25 GB)" — with the time label
stored as the string "10 min ago" and the day bucket stored as the string
"Today". The page said the same thing for ever, and taught staff that the
bell was decorative, so the real alert got ignored too.

── What it is now ───────────────────────────────────────────────────────────
Nothing is stored. Each area below is the SAME query the module's own screen
runs to find its work — open safety reports, women waiting to be verified,
threads waiting for a reply, applications nobody has looked at — with the
few rows that matter most and a link to the screen where the work is done.
An item leaves the feed when the work is done. That is the only honest
"read" state a work queue can have, so there is no mark-as-read here.

── Who sees what ────────────────────────────────────────────────────────────
The door is `dashboard.view`, which every staff role holds. Inside, an area
appears only if the caller holds that module's `view` — a Content Editor does
not learn how many safety reports are open by opening her notifications. The
response names the areas that were left out, so a short feed is not mistaken
for an empty platform.

── Delivery ─────────────────────────────────────────────────────────────────
This page IS the delivery. Nothing here is emailed, pushed or texted to
staff — no adapter does that — and the page says so instead of offering
channel toggles that control nothing.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Awaitable, Callable, Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.core.deps import get_current_user
from app.core.permissions import CATALOGUE, require_permission, user_permissions
from app.db.mongodb import get_database
from app.models.community import StoryModel
from app.models.feedback import FeedbackModel
from app.models.growth import ApplicationModel, MentorshipRequestModel
from app.models.member import MemberModel
from app.models.safety import SafetyAlertModel, SafetyReportModel
from app.models.user import UserModel
from app.models.verification import DocumentModel, VerificationStatus
from app.models.wallet import SupportRequestModel
# The two areas whose "is it waiting?" rule is non-trivial reuse the screen's
# own code rather than a copy of it, so this feed cannot drift from the
# screen it points at.
from app.routes.appointments import BOOKED, IST, _in_scope, _load_all
from app.routes.messages import _ordered, _row, _states_for, _summaries, _users_for

router = APIRouter(prefix="/admin/notifications", tags=["Admin notifications"])


# ── shapes ──────────────────────────────────────────────────────────────────

class AttentionItem(BaseModel):
    id: str
    title: str
    desc: str = ""
    #: When it started waiting, ISO. None when the row has no timestamp.
    at: Optional[str] = None
    href: str
    #: Assigned to the caller. Only reports and threads can be.
    mine: bool = False


class AttentionArea(BaseModel):
    key: str
    module: str
    label: str
    #: What the count counts, in one line — and the order the items come in.
    note: str
    count: int
    mine: int = 0
    tone: str
    icon: str
    href: str
    items: list[AttentionItem]
    oldest_at: Optional[str] = None


class ModuleRef(BaseModel):
    module: str
    label: str


class AttentionFeed(BaseModel):
    as_of: str
    total: int
    mine: int
    oldest_at: Optional[str] = None
    areas: list[AttentionArea]
    #: Modules whose areas are in the feed (the caller can view them).
    modules: list[ModuleRef]
    #: Modules with areas the caller may NOT view — named, not counted.
    hidden: list[ModuleRef]


# ── helpers ─────────────────────────────────────────────────────────────────

def _db():
    return get_database()


def _aware(dt) -> Optional[datetime]:
    if not isinstance(dt, datetime):
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _iso(dt) -> Optional[str]:
    dt = _aware(dt)
    return dt.isoformat() if dt else None


def _snip(text: str, n: int = 120) -> str:
    text = " ".join((text or "").split())
    return text if len(text) <= n else text[: n - 1].rstrip() + "…"


async def _names(user_ids: list[str]) -> dict[str, dict]:
    """One lookup for a handful of rows, never one per row."""
    oids = []
    for uid in set(user_ids):
        try:
            oids.append(ObjectId(uid))
        except (InvalidId, TypeError):
            continue
    if not oids:
        return {}
    rows = await _db()[UserModel.collection_name].find(
        {"_id": {"$in": oids}}, {"full_name": 1, "email": 1}
    ).to_list(len(oids))
    return {str(r["_id"]): r for r in rows}


def _who(users: dict[str, dict], uid: str, fallback: str = "A member") -> str:
    u = users.get(uid or "", {})
    return u.get("full_name") or u.get("email") or fallback


async def _scan(col, query: dict, *, limit: int, key: str = "created_at"):
    """Count, the newest `limit` rows, and the oldest timestamp — three
    questions the cluster can answer at the same time."""
    count, docs, oldest = await asyncio.gather(
        col.count_documents(query),
        col.find(query).sort(key, -1).to_list(limit),
        col.find_one(query, {key: 1}, sort=[(key, 1)]),
    )
    return count, docs, _aware((oldest or {}).get(key))


# ── the areas ───────────────────────────────────────────────────────────────
#
# Each builder returns one AttentionArea. Its query is the one the module's
# screen runs; its href is that screen. Order inside `items` is newest first
# unless the note says otherwise.

async def _safety_reports(me_id: str, limit: int) -> AttentionArea:
    col = _db()[SafetyReportModel.collection_name]
    query = {"status": {"$in": [SafetyReportModel.STATUS_OPEN, SafetyReportModel.STATUS_REVIEWING]}}
    (count, docs, oldest), mine = await asyncio.gather(
        _scan(col, query, limit=limit),
        col.count_documents({**query, "assigned_to": me_id}),
    )
    items = []
    for d in docs:
        assigned = d.get("assigned_to") or ""
        state = "being reviewed" if d.get("status") == SafetyReportModel.STATUS_REVIEWING else "open"
        holder = f"with {d.get('assigned_to_name') or 'a colleague'}" if assigned else "unassigned"
        items.append(AttentionItem(
            id=str(d["_id"]), title=d.get("category") or "Safety report",
            desc=f"Report {state}, {holder}", at=_iso(d.get("created_at")),
            href="/dashboard/safety/reports", mine=assigned == me_id,
        ))
    return AttentionArea(
        key="safety_reports", module="safety", label="Open safety reports",
        note="Open or being reviewed; newest first", count=count, mine=mine,
        tone="rose", icon="ShieldAlert", href="/dashboard/safety/reports",
        items=items, oldest_at=_iso(oldest),
    )


async def _safety_alerts(limit: int) -> AttentionArea:
    col = _db()[SafetyAlertModel.collection_name]
    count, docs, oldest = await _scan(col, {"status": SafetyAlertModel.STATUS_OPEN}, limit=limit)
    items = [
        AttentionItem(
            id=str(d["_id"]), title=f"Alert from {d.get('member_name') or 'a member'}",
            desc=d.get("location") or "No location given", at=_iso(d.get("created_at")),
            href="/dashboard/safety",
        )
        for d in docs
    ]
    return AttentionArea(
        key="safety_alerts", module="safety", label="Safety alerts nobody has acknowledged",
        note="Raised and still open; newest first", count=count, tone="rose", icon="Siren",
        href="/dashboard/safety", items=items, oldest_at=_iso(oldest),
    )


async def _support_fund(limit: int) -> AttentionArea:
    col = _db()[SupportRequestModel.collection_name]
    count, docs, oldest = await _scan(col, {"status": SupportRequestModel.STATUS_PENDING}, limit=limit)
    items = []
    for d in docs:
        r = SupportRequestModel.to_response(d)
        items.append(AttentionItem(
            id=r["id"], title=f"{d.get('member_name') or 'A member'} asks for {r['amount_needed_label']}",
            desc=_snip(d.get("what_for") or ""), at=_iso(d.get("created_at")),
            href="/dashboard/support-fund",
        ))
    return AttentionArea(
        key="support_fund", module="safety", label="Support fund requests to decide",
        note="Asked and not yet answered; newest first", count=count, tone="amber",
        icon="HandCoins", href="/dashboard/support-fund", items=items, oldest_at=_iso(oldest),
    )


async def _verifications(limit: int) -> AttentionArea:
    col = _db()[UserModel.collection_name]
    query = {"role": "Member", "verification_status": VerificationStatus.IN_REVIEW}
    count, docs, oldest = await _scan(col, query, limit=limit, key="updated_at")
    items = [
        AttentionItem(
            id=str(d["_id"]), title=d.get("full_name") or d.get("email") or "A member",
            desc="Sent her ID and is waiting to be admitted", at=_iso(d.get("updated_at")),
            href="/dashboard/users/verification",
        )
        for d in docs
    ]
    return AttentionArea(
        key="verifications", module="users", label="Applications to review",
        note="Women who submitted their ID; newest first", count=count, tone="amber",
        icon="ShieldCheck", href="/dashboard/users/verification", items=items,
        oldest_at=_iso(oldest),
    )


async def _documents(limit: int) -> AttentionArea:
    col = _db()[DocumentModel.collection_name]
    count, docs, oldest = await _scan(col, {"status": DocumentModel.STATUS_PENDING}, limit=limit)
    users = await _names([d.get("user_id", "") for d in docs])
    items = [
        AttentionItem(
            id=str(d["_id"]),
            title=DocumentModel.TYPE_LABELS.get(d.get("doc_type", "other"), "Document"),
            desc=f"From {_who(users, d.get('user_id', ''))}", at=_iso(d.get("created_at")),
            href="/dashboard/users/verification",
        )
        for d in docs
    ]
    return AttentionArea(
        key="documents", module="users", label="ID documents pending",
        note="Uploaded, not yet checked; newest first", count=count, tone="sky",
        icon="FileCheck", href="/dashboard/users/verification", items=items,
        oldest_at=_iso(oldest),
    )


async def _members_pending(limit: int) -> AttentionArea:
    col = _db()[MemberModel.collection_name]
    count, docs, oldest = await _scan(col, {"status": "Pending"}, limit=limit)
    items = [
        AttentionItem(
            id=str(d["_id"]), title=d.get("full_name") or d.get("email") or "A member",
            desc=f"{d.get('code') or 'No code'} · awaiting approval in the directory",
            at=_iso(d.get("created_at")), href="/dashboard/users?status=Pending",
        )
        for d in docs
    ]
    return AttentionArea(
        key="members_pending", module="users", label="Directory members awaiting approval",
        note="Status Pending in the members directory; newest first", count=count,
        tone="amber", icon="UserPlus", href="/dashboard/users?status=Pending", items=items,
        oldest_at=_iso(oldest),
    )


async def _messages_waiting(me_id: str, limit: int) -> AttentionArea:
    summaries = await _summaries()
    uids = list(summaries)
    users, states = await asyncio.gather(_users_for(uids), _states_for(uids))
    rows = _ordered([_row(s, users[uid], states.get(uid)) for uid, s in summaries.items() if uid in users])
    waiting = [r for r in rows if r["status"] == "open" and r.get("waiting_since")]

    def _is_mine(r: dict) -> bool:
        a = r.get("assigned_to")
        return bool(a) and a.get("id") == me_id

    items = [
        AttentionItem(
            id=r["user_id"], title=r.get("full_name") or r.get("email") or "A member",
            desc=_snip(r.get("last_message") or ""), at=r.get("waiting_since"),
            href="/dashboard/messages", mine=_is_mine(r),
        )
        for r in waiting[:limit]
    ]
    return AttentionArea(
        key="messages_waiting", module="messages", label="Members waiting for a reply",
        note="Her last message has no answer yet; longest waiting first",
        count=len(waiting), mine=sum(1 for r in waiting if _is_mine(r)), tone="sky",
        icon="MessageSquare", href="/dashboard/messages", items=items,
        oldest_at=waiting[0]["waiting_since"] if waiting else None,
    )


async def _applications(limit: int) -> AttentionArea:
    col = _db()[ApplicationModel.collection_name]
    count, docs, oldest = await _scan(col, {"status": ApplicationModel.STATUS_APPLIED}, limit=limit)
    users = await _names([d.get("user_id", "") for d in docs])
    items = [
        AttentionItem(
            id=str(d["_id"]),
            title=f"{_who(users, d.get('user_id', ''))} → {d.get('opportunity_title') or 'an opportunity'}",
            desc=d.get("org") or "", at=_iso(d.get("created_at")), href="/dashboard/applications",
        )
        for d in docs
    ]
    return AttentionArea(
        key="applications", module="growth", label="New applications",
        note="Applied and not yet moved along; newest first", count=count, tone="violet",
        icon="Briefcase", href="/dashboard/applications", items=items, oldest_at=_iso(oldest),
    )


async def _mentor_requests(limit: int) -> AttentionArea:
    col = _db()[MentorshipRequestModel.collection_name]
    count, docs, oldest = await _scan(col, {"status": MentorshipRequestModel.STATUS_PENDING}, limit=limit)
    users = await _names([d.get("user_id", "") for d in docs])
    items = [
        AttentionItem(
            id=str(d["_id"]),
            title=f"{_who(users, d.get('user_id', ''))} asked for {d.get('mentor_name') or 'a mentor'}",
            desc=_snip(d.get("goal") or ""), at=_iso(d.get("created_at")),
            href="/dashboard/mentors/requests",
        )
        for d in docs
    ]
    return AttentionArea(
        key="mentor_requests", module="growth", label="Mentorship requests to introduce",
        note="Pending a human introduction; newest first", count=count, tone="violet",
        icon="UserRoundCheck", href="/dashboard/mentors/requests", items=items,
        oldest_at=_iso(oldest),
    )


async def _stories(limit: int) -> AttentionArea:
    col = _db()[StoryModel.collection_name]
    count, docs, oldest = await _scan(col, {"status": StoryModel.STATUS_PENDING}, limit=limit)
    items = [
        AttentionItem(
            id=str(d["_id"]), title=d.get("title") or "Untitled story",
            desc=f"By {d.get('author_name') or 'a member'}", at=_iso(d.get("created_at")),
            href="/dashboard/stories",
        )
        for d in docs
    ]
    return AttentionArea(
        key="stories", module="community", label="Stories waiting to be published",
        note="Submitted by a member, not yet decided; newest first", count=count,
        tone="brand", icon="BookOpen", href="/dashboard/stories", items=items,
        oldest_at=_iso(oldest),
    )


async def _feedback_open(limit: int) -> AttentionArea:
    col = _db()[FeedbackModel.collection_name]
    count, docs, oldest = await _scan(col, {"status": "Open"}, limit=limit)
    items = [
        AttentionItem(
            id=str(d["_id"]), title=d.get("user_name") or "Anonymous feedback",
            desc=_snip(d.get("text") or ""), at=_iso(d.get("created_at") or d.get("date")),
            href="/dashboard/feedback",
        )
        for d in docs
    ]
    return AttentionArea(
        key="feedback_open", module="feedback", label="Feedback nobody has answered",
        note="Status Open — no reply, not in review; newest first", count=count,
        tone="emerald", icon="MessageSquareHeart", href="/dashboard/feedback", items=items,
        oldest_at=_iso(oldest),
    )


async def _appointments_unconfirmed(limit: int) -> AttentionArea:
    now = datetime.now(IST)
    rows = [r for r in await _load_all() if _in_scope(r, "upcoming", now) and r["status"] == BOOKED]
    rows.sort(key=lambda r: r["_starts"])   # soonest first — the next one is the urgent one
    booked_at = [_aware(datetime.fromisoformat(r["created_at"])) for r in rows if r.get("created_at")]
    items = [
        AttentionItem(
            id=r["ref"], title=f"{r['name'] or 'Someone'} · {r['service'] or 'a session'}",
            desc=f"Starts {r['_starts'].strftime('%a %d %b, %I:%M %p')} — not yet confirmed",
            at=r.get("created_at"), href="/dashboard/appointments?status=booked",
        )
        for r in rows[:limit]
    ]
    return AttentionArea(
        key="appointments_unconfirmed", module="appointments",
        label="Appointments awaiting confirmation",
        note="Upcoming and still unconfirmed; soonest first", count=len(rows), tone="blue",
        icon="CalendarClock", href="/dashboard/appointments?status=booked", items=items,
        oldest_at=_iso(min(booked_at)) if booked_at else None,
    )


#: (module, builder). The module decides who may see the area.
_AREAS: list[tuple[str, Callable[[str, int], Awaitable[AttentionArea]]]] = [
    ("safety", lambda me, n: _safety_alerts(n)),
    ("safety", lambda me, n: _safety_reports(me, n)),
    ("safety", lambda me, n: _support_fund(n)),
    ("users", lambda me, n: _verifications(n)),
    ("users", lambda me, n: _documents(n)),
    ("users", lambda me, n: _members_pending(n)),
    ("messages", lambda me, n: _messages_waiting(me, n)),
    ("growth", lambda me, n: _applications(n)),
    ("growth", lambda me, n: _mentor_requests(n)),
    ("community", lambda me, n: _stories(n)),
    ("feedback", lambda me, n: _feedback_open(n)),
    ("appointments", lambda me, n: _appointments_unconfirmed(n)),
]


def _label(module: str) -> str:
    return CATALOGUE.get(module, (module, []))[0]


# ── the endpoint ────────────────────────────────────────────────────────────

@router.get(
    "/attention", response_model=AttentionFeed,
    summary="What is waiting for a person, in the areas the caller can open",
    dependencies=[Depends(require_permission("dashboard.view"))],
)
async def attention_feed(
    limit: int = Query(5, ge=1, le=20, description="Rows shown per area"),
    me: dict = Depends(get_current_user),
):
    perms = set(await user_permissions(me))
    me_id = str(me.get("_id", ""))

    visible = [(mod, build) for mod, build in _AREAS if f"{mod}.view" in perms]
    areas = list(await asyncio.gather(*(build(me_id, limit) for _mod, build in visible)))

    oldest = [_aware(datetime.fromisoformat(a.oldest_at)) for a in areas if a.oldest_at]
    seen_visible: list[str] = []
    seen_hidden: list[str] = []
    for mod, _build in _AREAS:
        bucket = seen_visible if f"{mod}.view" in perms else seen_hidden
        if mod not in bucket:
            bucket.append(mod)

    return AttentionFeed(
        as_of=datetime.now(timezone.utc).isoformat(),
        total=sum(a.count for a in areas),
        mine=sum(a.mine for a in areas),
        oldest_at=_iso(min(oldest)) if oldest else None,
        areas=areas,
        modules=[ModuleRef(module=m, label=_label(m)) for m in seen_visible],
        hidden=[ModuleRef(module=m, label=_label(m)) for m in seen_hidden],
    )
