"""
Staff side of circles, moderation and success stories.

── Moderation hides, it never deletes ────────────────────────────────────────
A post that caused a complaint has to survive the complaint, otherwise the
record of what happened disappears along with the evidence for it. So there
are three states, all of them reversible from this file and none of them a
`delete_one`:

  visible  → the member side shows it
  hidden   → `hidden: true`; out of every member query, counted as still there
  removed  → `hidden: true` and taken out of the circle's counters; still on
             disk, with the reason and who decided it

Every decision carries a reason, and every one is written to the audit trail
with the post, reply or member id as its target — so an investigator can pull
everything that was ever done to one post, or one woman.

── There is no report button yet ─────────────────────────────────────────────
The member app has no way to report a post, so this file cannot offer a queue
of *reported* posts. What it offers is the newest posts and replies across
every circle, which is the honest version, and the screen says so. When a
report mechanism lands, `list_queue` grows a `reported` state and nothing
else here needs to change.

── Counts are counted, not read ──────────────────────────────────────────────
`circles.member_count` is a stored counter, and the seed sets it to
`12 + 7 × posts` so a member's first visit does not look empty. That is a
member-facing choice; on this side the numbers are what the collections
actually hold, computed in the query. A Super Admin looking at "34 members"
must be able to open the roster and count 34.

── What this file must never expose ──────────────────────────────────────────
A member's circle profile is her name and her avatar — that is what other
members see beside her posts. That is all the roster and the queue send.
Not her email, not her phone, not her vault.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, field_validator

from app.core import cache, mongosafe
from app.core.audit import record
from app.core.deps import get_current_user
from app.core.media import media_url
from app.core.permissions import require_permission
from app.core.serializers import aware, to_object_id
from app.db.mongodb import get_database
from app.models.community import (
    CircleMemberModel,
    CircleModel,
    PostModel,
    PostReplyModel,
    StoryModel,
)
from app.models.community_moderation import CircleModerationModel
from app.models.conversation import notify
from app.models.user import UserModel
from app.schemas.me import MessageResponse

router = APIRouter(prefix="/admin/community", tags=["Staff · Community"])


def _circles():
    return get_database()[CircleModel.collection_name]


def _members():
    return get_database()[CircleMemberModel.collection_name]


def _posts():
    return get_database()[PostModel.collection_name]


def _replies():
    return get_database()[PostReplyModel.collection_name]


def _stories():
    return get_database()[StoryModel.collection_name]


def _users():
    return get_database()[UserModel.collection_name]


def _moderation():
    return get_database()[CircleModerationModel.collection_name]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value) -> str:
    when = aware(value)
    return when.isoformat() if when else ""


def _actor_name(me: dict) -> str:
    return me.get("full_name") or me.get("email") or "Staff"


def _required(v: str, msg: str) -> str:
    v = (v or "").strip()
    if not v:
        raise ValueError(msg)
    return v


# ── schemas ──────────────────────────────────────────────────────────────────
# Defined here rather than in `schemas/admin_modules.py`: that file is shared
# with other modules being rebuilt at the same time, and these shapes belong to
# this router alone.

class CircleUpsert(BaseModel):
    name: str
    topic: str = ""
    desc: str = ""
    guidelines: str = ""
    is_private: bool = False
    status: str = "active"

    @field_validator("name")
    @classmethod
    def has_name(cls, v: str) -> str:
        return _required(v, "Give the circle a name")

    @field_validator("status")
    @classmethod
    def known_status(cls, v: str) -> str:
        if v not in ("active", "archived"):
            raise ValueError("Status must be active or archived")
        return v


class CircleOut(BaseModel):
    id: str
    name: str
    topic: str
    desc: str
    guidelines: str
    is_private: bool
    is_savings: bool = False
    monthly_minor: int = 0
    round: int = 0
    status: str
    #: Counted from `circle_members` and `circle_posts` at request time.
    member_count: int
    post_count: int
    hidden_post_count: int
    moderator_count: int
    last_post_at: str = ""
    created_at: str = ""


class CircleSummary(BaseModel):
    total: int
    active: int
    archived: int
    private: int
    members: int
    posts: int
    hidden_posts: int
    muted_members: int


class CirclesPage(BaseModel):
    circles: list[CircleOut]
    summary: CircleSummary


class CircleMemberOut(BaseModel):
    """Her public circle profile — name and avatar — plus her moderation state."""
    user_id: str
    name: str
    avatar: str
    role: str
    joined_at: str
    muted_until: str = ""
    warnings: int = 0


class ModeratorBody(BaseModel):
    user_id: str

    @field_validator("user_id")
    @classmethod
    def has_id(cls, v: str) -> str:
        return _required(v, "Say which member")


class ReasonBody(BaseModel):
    reason: str = ""


class MuteBody(BaseModel):
    reason: str = ""
    days: int = Field(7, ge=1, le=365)


class QueueItem(BaseModel):
    kind: str                     # "post" | "reply"
    id: str
    post_id: str                  # the post itself, or the reply's parent
    circle_id: str
    circle_name: str
    user_id: str
    author_name: str
    author_avatar: str
    body: str
    parent_snippet: str = ""      # for a reply: the first line of the post
    likes: int = 0
    reply_count: int = 0
    pinned: bool = False
    hidden: bool
    state: str                    # "visible" | "hidden" | "removed"
    reason: str = ""
    moderated_by: str = ""
    moderated_at: str = ""
    when: str
    created_at: str
    author_muted_until: str = ""


class QueueSummary(BaseModel):
    posts: int
    replies: int
    hidden: int
    removed: int
    muted_members: int
    #: False until the member app can report a post. The screen reads this
    #: rather than a hardcoded sentence, so the day it flips the copy follows.
    reports_supported: bool = False


class ModerationQueue(BaseModel):
    items: list[QueueItem]
    summary: QueueSummary


class StoryOut(BaseModel):
    id: str
    author_name: str
    title: str
    body: str
    program: str
    status: str
    featured: bool
    likes: int
    when: str
    submitted_at: str = ""
    decided_at: str = ""
    decided_by: str = ""
    reason: str = ""


class StorySummary(BaseModel):
    total: int
    pending: int
    published: int
    declined: int
    featured: int


class StoriesPage(BaseModel):
    stories: list[StoryOut]
    summary: StorySummary


class StoryDecision(BaseModel):
    status: str
    featured: Optional[bool] = None
    reason: str = ""

    @field_validator("status")
    @classmethod
    def known(cls, v: str) -> str:
        if v not in ("pending", "published", "declined"):
            raise ValueError("Unknown status")
        return v


# ── circles ──────────────────────────────────────────────────────────────────

def _count_lookup(from_collection: str, extra_group: dict) -> dict:
    """
    One `$lookup` that counts a circle's rows in another collection.

    Membership and post rows key the circle by its id as a STRING, which is
    why `_id` is converted before it is compared.
    """
    return {
        "$lookup": {
            "from": from_collection,
            "let": {"cid": {"$toString": "$_id"}},
            "pipeline": [
                {"$match": {"$expr": {"$eq": ["$circle_id", "$$cid"]}}},
                {"$group": {"_id": None, "n": {"$sum": 1}, **extra_group}},
            ],
            "as": "_agg",
        }
    }


async def _circle_rows(query: dict) -> list[dict]:
    """Circles with their live member and post counts, in one round trip."""
    docs = await _circles().aggregate([
        {"$match": query},
        _count_lookup(CircleMemberModel.collection_name, {
            "mods": {"$sum": {"$cond": [
                {"$eq": ["$role", CircleModerationModel.ROLE_MODERATOR]}, 1, 0,
            ]}},
        }),
        {"$addFields": {"_members": {"$arrayElemAt": ["$_agg", 0]}}},
        _count_lookup(PostModel.collection_name, {
            "hidden": {"$sum": {"$cond": [{"$eq": ["$hidden", True]}, 1, 0]}},
            "last": {"$max": "$created_at"},
        }),
        {"$addFields": {"_posts": {"$arrayElemAt": ["$_agg", 0]}}},
        {"$project": {"_agg": 0}},
        {"$limit": 300},
    ]).to_list(300)

    # Active circles first, then the busiest. Done here rather than in the
    # pipeline because the sort key is a computed field on 300 rows at most.
    docs.sort(key=lambda d: (
        d.get("status", "active") != "active",
        -int((d.get("_members") or {}).get("n", 0)),
        (d.get("name") or "").lower(),
    ))
    return docs


def _circle_out(d: dict) -> CircleOut:
    members = d.get("_members") or {}
    posts = d.get("_posts") or {}
    total_posts = int(posts.get("n", 0))
    hidden = int(posts.get("hidden", 0))
    return CircleOut(
        id=str(d["_id"]),
        name=d.get("name", ""),
        topic=d.get("topic", ""),
        desc=d.get("desc", ""),
        guidelines=d.get("guidelines", ""),
        is_private=bool(d.get("is_private", False)),
        is_savings=bool(d.get("is_savings", False)),
        monthly_minor=int(d.get("monthly_minor", 0)),
        round=CircleModel.round_of(d),
        status=d.get("status", "active"),
        member_count=int(members.get("n", 0)),
        moderator_count=int(members.get("mods", 0)),
        post_count=total_posts - hidden,
        hidden_post_count=hidden,
        last_post_at=_iso(posts.get("last")),
        created_at=_iso(d.get("created_at")),
    )


async def _circle_or_404(circle_id: str) -> dict:
    doc = await _circles().find_one({"_id": to_object_id(circle_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That circle doesn't exist")
    return doc


async def _one_circle(circle_id: str) -> CircleOut:
    rows = await _circle_rows({"_id": to_object_id(circle_id)})
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That circle doesn't exist")
    return _circle_out(rows[0])


@router.get(
    "/circles",
    response_model=CirclesPage,
    summary="All circles, with live counts",
    dependencies=[Depends(require_permission("community.view"))],
)
async def list_circles(
    q: str = Query("", max_length=80),
    status_filter: str = Query("", alias="status", max_length=20),
):
    query: dict = {}
    if q.strip():
        query.update(mongosafe.any_of(q, ["name", "topic"]))
    if status_filter in ("active", "archived"):
        query["status"] = status_filter

    rows, muted = await asyncio.gather(
        _circle_rows(query),
        _moderation().count_documents({
            "kind": CircleModerationModel.KIND_MUTE, "until": {"$gt": _now()},
        }),
    )
    circles = [_circle_out(d) for d in rows]
    return CirclesPage(
        circles=circles,
        summary=CircleSummary(
            total=len(circles),
            active=sum(1 for c in circles if c.status == "active"),
            archived=sum(1 for c in circles if c.status != "active"),
            private=sum(1 for c in circles if c.is_private),
            members=sum(c.member_count for c in circles),
            posts=sum(c.post_count for c in circles),
            hidden_posts=sum(c.hidden_post_count for c in circles),
            muted_members=muted,
        ),
    )


@router.post(
    "/circles",
    response_model=CircleOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a circle",
    dependencies=[Depends(require_permission("community.create"))],
)
async def create_circle(
    body: CircleUpsert, request: Request, me: dict = Depends(get_current_user),
):
    doc = CircleModel.create_document(
        name=body.name, topic=body.topic.strip(), desc=body.desc.strip(),
        guidelines=body.guidelines.strip(), is_private=body.is_private,
        created_by=str(me["_id"]),
    )
    doc["status"] = body.status
    result = await _circles().insert_one(doc)
    circle_id = str(result.inserted_id)
    await record(
        me, "community.circle.create", target=circle_id,
        detail=f"Created circle “{body.name}”" + (" (private)" if body.is_private else ""),
        request=request,
    )
    return await _one_circle(circle_id)


@router.put(
    "/circles/{circle_id}",
    response_model=CircleOut,
    summary="Update a circle",
    dependencies=[Depends(require_permission("community.edit"))],
)
async def update_circle(
    circle_id: str, body: CircleUpsert, request: Request,
    me: dict = Depends(get_current_user),
):
    before = await _circle_or_404(circle_id)
    updates = body.model_dump()
    for k in ("topic", "desc", "guidelines"):
        updates[k] = updates[k].strip()
    updates["updated_at"] = _now()
    await _circles().update_one({"_id": before["_id"]}, {"$set": updates})

    changed = [k for k in ("name", "topic", "desc", "guidelines", "is_private", "status")
               if before.get(k) != updates[k]]
    await record(
        me, "community.circle.update", target=circle_id,
        detail=f"Updated circle “{body.name}”"
        + (f": {', '.join(changed)}" if changed else " (nothing changed)"),
        request=request,
    )
    return await _one_circle(circle_id)


@router.delete(
    "/circles/{circle_id}",
    response_model=MessageResponse,
    summary="Archive a circle",
    dependencies=[Depends(require_permission("community.delete"))],
)
async def archive_circle(
    circle_id: str, request: Request, me: dict = Depends(get_current_user),
):
    doc = await _circle_or_404(circle_id)
    await _circles().update_one(
        {"_id": doc["_id"]}, {"$set": {"status": "archived", "updated_at": _now()}}
    )
    await record(
        me, "community.circle.archive", target=circle_id,
        detail=f"Archived circle “{doc.get('name', '')}”", request=request,
    )
    return {"message": "Circle archived — members can no longer open it"}


@router.post(
    "/circles/{circle_id}/reopen",
    response_model=CircleOut,
    summary="Reopen an archived circle",
    dependencies=[Depends(require_permission("community.edit"))],
)
async def reopen_circle(
    circle_id: str, request: Request, me: dict = Depends(get_current_user),
):
    doc = await _circle_or_404(circle_id)
    await _circles().update_one(
        {"_id": doc["_id"]}, {"$set": {"status": "active", "updated_at": _now()}}
    )
    await record(
        me, "community.circle.reopen", target=circle_id,
        detail=f"Reopened circle “{doc.get('name', '')}”", request=request,
    )
    return await _one_circle(circle_id)


# ── roster and moderators ────────────────────────────────────────────────────

async def _public_profiles(user_ids: list[str]) -> dict[str, dict]:
    """Name and avatar only — what her circle already shows of her."""
    oids = [ObjectId(u) for u in user_ids if ObjectId.is_valid(u)]
    if not oids:
        return {}
    users = await _users().find(
        {"_id": {"$in": oids}}, {"full_name": 1, "name": 1, "avatar": 1},
    ).to_list(len(oids))
    return {
        str(u["_id"]): {
            "name": u.get("full_name") or u.get("name") or "A member",
            "avatar": media_url(u.get("avatar", "") or ""),
        }
        for u in users
    }


async def _moderation_state(circle_id: str, user_ids: list[str]) -> dict[str, dict]:
    """Active mute and warning count per member of one circle, one query."""
    if not user_ids:
        return {}
    rows = await _moderation().find(
        {"circle_id": circle_id, "user_id": {"$in": user_ids}},
        {"kind": 1, "user_id": 1, "until": 1},
    ).to_list(2000)
    now = _now()
    out: dict[str, dict] = {}
    for r in rows:
        slot = out.setdefault(r["user_id"], {"muted_until": "", "warnings": 0})
        if r.get("kind") == CircleModerationModel.KIND_WARNING:
            slot["warnings"] += 1
        elif r.get("kind") == CircleModerationModel.KIND_MUTE:
            until = aware(r.get("until"))
            if until and until > now:
                slot["muted_until"] = until.isoformat()
    return out


@router.get(
    "/circles/{circle_id}/members",
    response_model=list[CircleMemberOut],
    summary="Who is in a circle — public profile only",
    dependencies=[Depends(require_permission("community.view"))],
)
async def circle_members(circle_id: str):
    await _circle_or_404(circle_id)
    rows = await _members().find({"circle_id": circle_id}).sort("created_at", 1).to_list(500)
    ids = [r.get("user_id", "") for r in rows if r.get("user_id")]
    profiles, state = await asyncio.gather(
        _public_profiles(ids), _moderation_state(circle_id, ids),
    )

    rank = {CircleMemberModel.ROLE_HOST: 0, CircleModerationModel.ROLE_MODERATOR: 1}
    out = []
    for r in rows:
        uid = r.get("user_id", "")
        p = profiles.get(uid, {"name": "A member", "avatar": ""})
        s = state.get(uid, {})
        out.append(CircleMemberOut(
            user_id=uid,
            name=p["name"],
            avatar=p["avatar"],
            role=r.get("role", CircleMemberModel.ROLE_MEMBER),
            joined_at=_iso(r.get("created_at")),
            muted_until=s.get("muted_until", ""),
            warnings=int(s.get("warnings", 0)),
        ))
    out.sort(key=lambda m: (rank.get(m.role, 2), m.joined_at))
    return out


@router.post(
    "/circles/{circle_id}/moderators",
    response_model=MessageResponse,
    summary="Make a member of the circle its moderator",
    dependencies=[Depends(require_permission("community.edit"))],
)
async def assign_moderator(
    circle_id: str, body: ModeratorBody, request: Request,
    me: dict = Depends(get_current_user),
):
    circle = await _circle_or_404(circle_id)
    row = await _members().find_one({"circle_id": circle_id, "user_id": body.user_id})
    if not row:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "She has to be in the circle before she can moderate it",
        )
    if row.get("role") == CircleMemberModel.ROLE_HOST:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "She hosts this circle already")
    if row.get("role") == CircleModerationModel.ROLE_MODERATOR:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "She is already a moderator here")

    await _members().update_one(
        {"_id": row["_id"]}, {"$set": {"role": CircleModerationModel.ROLE_MODERATOR}}
    )
    name = (await _public_profiles([body.user_id])).get(body.user_id, {}).get("name", "A member")
    await notify(
        get_database(), body.user_id,
        f"You now moderate {circle.get('name', 'a circle')}",
        "Thank you for keeping the room a good one. Staff will be in touch about what that means.",
        "circle", "/app/circles",
    )
    await record(
        me, "community.moderator.assign", target=body.user_id,
        detail=f"Made {name} a moderator of “{circle.get('name', '')}”", request=request,
    )
    return {"message": f"{name} now moderates this circle"}


@router.delete(
    "/circles/{circle_id}/moderators/{user_id}",
    response_model=MessageResponse,
    summary="Step a moderator back down to member",
    dependencies=[Depends(require_permission("community.edit"))],
)
async def remove_moderator(
    circle_id: str, user_id: str, request: Request, me: dict = Depends(get_current_user),
):
    circle = await _circle_or_404(circle_id)
    updated = await _members().update_one(
        {"circle_id": circle_id, "user_id": user_id, "role": CircleModerationModel.ROLE_MODERATOR},
        {"$set": {"role": CircleMemberModel.ROLE_MEMBER}},
    )
    if not updated.matched_count:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "She is not a moderator of this circle")
    name = (await _public_profiles([user_id])).get(user_id, {}).get("name", "A member")
    await record(
        me, "community.moderator.remove", target=user_id,
        detail=f"{name} is no longer a moderator of “{circle.get('name', '')}”", request=request,
    )
    return {"message": f"{name} is a member again"}


# ── warn and mute ────────────────────────────────────────────────────────────

@router.post(
    "/circles/{circle_id}/members/{user_id}/warn",
    response_model=MessageResponse,
    summary="Warn a member, in writing",
    dependencies=[Depends(require_permission("community.edit"))],
)
async def warn_member(
    circle_id: str, user_id: str, body: ReasonBody, request: Request,
    me: dict = Depends(get_current_user),
):
    circle = await _circle_or_404(circle_id)
    reason = body.reason.strip()
    if not reason:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Say what the warning is for — she will read it")
    if not ObjectId.is_valid(user_id) or not await _users().find_one({"_id": ObjectId(user_id)}, {"_id": 1}):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That member doesn't exist")

    await _moderation().insert_one(CircleModerationModel.create_document(
        CircleModerationModel.KIND_WARNING, circle_id, user_id, reason,
        by_id=str(me["_id"]), by_name=_actor_name(me),
    ))
    await notify(
        get_database(), user_id,
        f"A note from the {circle.get('name', 'circle')} moderators",
        reason,
        "circle", "/app/circles",
    )
    name = (await _public_profiles([user_id])).get(user_id, {}).get("name", "A member")
    await record(
        me, "community.member.warn", target=user_id,
        detail=f"Warned {name} in “{circle.get('name', '')}”: {reason}", request=request,
    )
    return {"message": f"{name} has been told"}


@router.post(
    "/circles/{circle_id}/members/{user_id}/mute",
    response_model=MessageResponse,
    summary="Stop a member posting in one circle for a while",
    dependencies=[Depends(require_permission("community.edit"))],
)
async def mute_member(
    circle_id: str, user_id: str, body: MuteBody, request: Request,
    me: dict = Depends(get_current_user),
):
    circle = await _circle_or_404(circle_id)
    reason = body.reason.strip()
    if not reason:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Say why — she will read it")
    if not ObjectId.is_valid(user_id) or not await _users().find_one({"_id": ObjectId(user_id)}, {"_id": 1}):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That member doesn't exist")

    until = _now() + timedelta(days=body.days)
    # One live mute per member per circle: a second one extends the first
    # rather than stacking beside it.
    await _moderation().update_one(
        {"kind": CircleModerationModel.KIND_MUTE, "circle_id": circle_id, "user_id": user_id},
        {
            "$set": {
                "reason": reason[:400], "until": until, "updated_at": _now(),
                "by_id": str(me["_id"]), "by_name": _actor_name(me),
            },
            "$setOnInsert": {"created_at": _now()},
        },
        upsert=True,
    )
    label = until.strftime("%d %b %Y")
    await notify(
        get_database(), user_id,
        f"You can't post in {circle.get('name', 'this circle')} until {label}",
        reason,
        "circle", "/app/circles",
    )
    name = (await _public_profiles([user_id])).get(user_id, {}).get("name", "A member")
    await record(
        me, "community.member.mute", target=user_id,
        detail=f"Muted {name} in “{circle.get('name', '')}” for {body.days} day"
        f"{'s' if body.days != 1 else ''}: {reason}",
        request=request,
    )
    return {"message": f"{name} can't post here until {label}"}


@router.post(
    "/circles/{circle_id}/members/{user_id}/unmute",
    response_model=MessageResponse,
    summary="Lift a mute early",
    dependencies=[Depends(require_permission("community.edit"))],
)
async def unmute_member(
    circle_id: str, user_id: str, request: Request, me: dict = Depends(get_current_user),
):
    circle = await _circle_or_404(circle_id)
    updated = await _moderation().update_one(
        CircleModerationModel.active_mute_query(circle_id, user_id),
        {"$set": {"until": _now(), "updated_at": _now()}},
    )
    if not updated.matched_count:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "She isn't muted in this circle")
    name = (await _public_profiles([user_id])).get(user_id, {}).get("name", "A member")
    await notify(
        get_database(), user_id,
        f"You can post in {circle.get('name', 'the circle')} again",
        "", "circle", "/app/circles",
    )
    await record(
        me, "community.member.unmute", target=user_id,
        detail=f"Unmuted {name} in “{circle.get('name', '')}”", request=request,
    )
    return {"message": f"{name} can post again"}


# ── the moderation queue ─────────────────────────────────────────────────────

def _state_of(doc: dict) -> str:
    if not doc.get("hidden"):
        return "visible"
    return (doc.get("moderation") or {}).get("state") or "hidden"


def _state_filter(state: str) -> dict:
    if state == "visible":
        return {"hidden": {"$ne": True}}
    if state == "hidden":
        return {"hidden": True, "moderation.state": {"$ne": "removed"}}
    if state == "removed":
        return {"hidden": True, "moderation.state": "removed"}
    return {}


def _moderation_fields(doc: dict) -> dict:
    m = doc.get("moderation") or {}
    return {
        "reason": m.get("reason", "") if doc.get("hidden") else "",
        "moderated_by": m.get("by", "") if doc.get("hidden") else "",
        "moderated_at": _iso(m.get("at")) if doc.get("hidden") else "",
    }


async def _circle_names(circle_ids: set[str]) -> dict[str, str]:
    oids = [ObjectId(c) for c in circle_ids if ObjectId.is_valid(c)]
    if not oids:
        return {}
    rows = await _circles().find({"_id": {"$in": oids}}, {"name": 1}).to_list(len(oids))
    return {str(r["_id"]): r.get("name", "") for r in rows}


async def _active_mutes(pairs: set[tuple[str, str]]) -> dict[tuple[str, str], str]:
    """(circle_id, user_id) → until, for the authors on this page."""
    if not pairs:
        return {}
    rows = await _moderation().find({
        "kind": CircleModerationModel.KIND_MUTE,
        "until": {"$gt": _now()},
        "user_id": {"$in": sorted({u for _, u in pairs})},
    }, {"circle_id": 1, "user_id": 1, "until": 1}).to_list(1000)
    return {
        (r["circle_id"], r["user_id"]): _iso(r.get("until"))
        for r in rows if (r["circle_id"], r["user_id"]) in pairs
    }


@router.get(
    "/posts",
    response_model=ModerationQueue,
    summary="Newest posts and replies across all circles",
    dependencies=[Depends(require_permission("community.view"))],
)
async def list_queue(
    circle_id: str = Query("", max_length=40),
    state: str = Query("all", max_length=10),
    kind: str = Query("all", max_length=10),
    limit: int = Query(120, ge=1, le=300),
):
    """
    There is no report mechanism in the member app, so nothing here is
    "reported" — see the module note. The queue is the newest writing on the
    platform, filtered by circle and by moderation state.
    """
    post_query: dict = {**_state_filter(state)}
    if circle_id:
        post_query["circle_id"] = circle_id

    posts: list[dict] = []
    replies: list[dict] = []
    if kind in ("all", "post"):
        posts = await _posts().find(post_query).sort("created_at", -1).to_list(limit)
    if kind in ("all", "reply"):
        reply_query: dict = {**_state_filter(state)}
        if circle_id:
            # Replies do not carry the circle; find it through their posts.
            pids = [str(p["_id"]) for p in await _posts().find(
                {"circle_id": circle_id}, {"_id": 1}).to_list(2000)]
            reply_query["post_id"] = {"$in": pids}
        replies = await _replies().find(reply_query).sort("created_at", -1).to_list(limit)

    # The replies' parents, for the circle and a line of context.
    parent_ids = {r.get("post_id", "") for r in replies}
    parent_oids = [ObjectId(p) for p in parent_ids if ObjectId.is_valid(p)]
    parents = {str(p["_id"]): p for p in posts}
    missing = [o for o in parent_oids if str(o) not in parents]
    if missing:
        for p in await _posts().find(
            {"_id": {"$in": missing}}, {"circle_id": 1, "body": 1}).to_list(len(missing)):
            parents[str(p["_id"])] = p

    circle_ids = {p.get("circle_id", "") for p in posts} | {
        p.get("circle_id", "") for p in parents.values()}
    author_pairs = {(p.get("circle_id", ""), p.get("user_id", "")) for p in posts if p.get("user_id")}
    for r in replies:
        parent = parents.get(r.get("post_id", ""), {})
        if r.get("user_id"):
            author_pairs.add((parent.get("circle_id", ""), r["user_id"]))

    names, mutes, total_posts, total_replies, hidden_n, removed_n, muted_n = await asyncio.gather(
        _circle_names(circle_ids),
        _active_mutes(author_pairs),
        _posts().count_documents({}),
        _replies().count_documents({}),
        _posts().count_documents(_state_filter("hidden")),
        _posts().count_documents(_state_filter("removed")),
        _moderation().count_documents({
            "kind": CircleModerationModel.KIND_MUTE, "until": {"$gt": _now()},
        }),
    )

    items: list[tuple[datetime, QueueItem]] = []
    for p in posts:
        cid = p.get("circle_id", "")
        items.append((aware(p.get("created_at")) or datetime.min.replace(tzinfo=timezone.utc), QueueItem(
            kind="post", id=str(p["_id"]), post_id=str(p["_id"]),
            circle_id=cid, circle_name=names.get(cid, "—"),
            user_id=p.get("user_id", ""),
            author_name=p.get("author_name", "") or "A member",
            author_avatar=media_url(p.get("author_avatar", "") or ""),
            body=p.get("body", ""),
            likes=len(p.get("likes") or []),
            reply_count=int(p.get("reply_count", 0)),
            pinned=bool(p.get("pinned", False)),
            hidden=bool(p.get("hidden", False)),
            state=_state_of(p),
            **_moderation_fields(p),
            when=PostModel.to_response(p).get("when", ""),
            created_at=_iso(p.get("created_at")),
            author_muted_until=mutes.get((cid, p.get("user_id", "")), ""),
        )))
    for r in replies:
        parent = parents.get(r.get("post_id", ""), {})
        cid = parent.get("circle_id", "")
        snippet = (parent.get("body", "") or "").strip().splitlines()[0][:120] if parent.get("body") else ""
        items.append((aware(r.get("created_at")) or datetime.min.replace(tzinfo=timezone.utc), QueueItem(
            kind="reply", id=str(r["_id"]), post_id=r.get("post_id", ""),
            circle_id=cid, circle_name=names.get(cid, "—"),
            user_id=r.get("user_id", ""),
            author_name=r.get("author_name", "") or "A member",
            author_avatar=media_url(r.get("author_avatar", "") or ""),
            body=r.get("body", ""),
            parent_snippet=snippet,
            hidden=bool(r.get("hidden", False)),
            state=_state_of(r),
            **_moderation_fields(r),
            when=PostReplyModel.to_response(r).get("when", ""),
            created_at=_iso(r.get("created_at")),
            author_muted_until=mutes.get((cid, r.get("user_id", "")), ""),
        )))
    items.sort(key=lambda t: t[0], reverse=True)

    return ModerationQueue(
        items=[i for _, i in items[:limit]],
        summary=QueueSummary(
            posts=total_posts, replies=total_replies,
            hidden=hidden_n, removed=removed_n, muted_members=muted_n,
            reports_supported=False,
        ),
    )


async def _moderate(
    *, kind: str, item_id: str, new_state: str, reason: str,
    me: dict, request: Request,
) -> dict:
    """
    Hide, remove or restore one post or reply. The three share this because
    the record they leave must be the same shape whichever way it went.
    """
    coll = _posts() if kind == "post" else _replies()
    oid = to_object_id(item_id)
    doc = await coll.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"That {kind} doesn't exist")

    reason = reason.strip()
    if new_state in ("hidden", "removed") and not reason:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Give a reason — it stays on the record")

    was = _state_of(doc)
    if was == new_state:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"That {kind} is already {new_state}")

    now = _now()
    entry = {
        "state": new_state, "reason": reason[:400],
        "by": _actor_name(me), "by_id": str(me["_id"]), "at": now,
    }
    await coll.update_one({"_id": oid}, {
        "$set": {"hidden": new_state != "visible", "moderation": entry, "updated_at": now},
        "$push": {"moderation_history": {"$each": [entry], "$slice": -50}},
    })

    # A removed post leaves the circle's counter; a hidden one does not (it is
    # expected back). Restoring reverses whichever happened.
    if kind == "post":
        cid = doc.get("circle_id", "")
        if new_state == "removed" and ObjectId.is_valid(cid):
            await _circles().update_one(
                {"_id": ObjectId(cid), "post_count": {"$gt": 0}}, {"$inc": {"post_count": -1}})
        elif was == "removed" and ObjectId.is_valid(cid):
            await _circles().update_one({"_id": ObjectId(cid)}, {"$inc": {"post_count": 1}})
    else:
        pid = doc.get("post_id", "")
        if new_state == "removed" and ObjectId.is_valid(pid):
            await _posts().update_one(
                {"_id": ObjectId(pid), "reply_count": {"$gt": 0}}, {"$inc": {"reply_count": -1}})
        elif was == "removed" and ObjectId.is_valid(pid):
            await _posts().update_one({"_id": ObjectId(pid)}, {"$inc": {"reply_count": 1}})

    noun = "post" if kind == "post" else "reply"
    plural = "posts" if kind == "post" else "replies"
    if doc.get("user_id"):
        if new_state == "visible":
            await notify(get_database(), doc["user_id"], f"Your {noun} is back",
                         reason or "It was reviewed and put back.", "circle", "/app/circles")
        else:
            verb = "hidden" if new_state == "hidden" else "removed"
            await notify(get_database(), doc["user_id"], f"One of your {plural} was {verb}",
                         reason, "circle", "/app/circles")

    verb, done = {"hidden": ("hide", "Hid"), "removed": ("remove", "Removed"),
                  "visible": ("restore", "Restored")}[new_state]
    snippet = (doc.get("body", "") or "").strip().replace("\n", " ")[:80]
    await record(
        me, f"community.{kind}.{verb}", target=item_id,
        detail=f"{done} {noun} by {doc.get('author_name') or 'a member'}"
        f" (“{snippet}”)" + (f": {reason}" if reason else ""),
        request=request,
    )
    return {"message": {
        "hidden": f"{noun.capitalize()} hidden",
        "removed": f"{noun.capitalize()} removed from the circle",
        "visible": f"{noun.capitalize()} restored",
    }[new_state]}


@router.post("/posts/{post_id}/hide", response_model=MessageResponse, summary="Hide a post",
             dependencies=[Depends(require_permission("community.edit"))])
async def hide_post(post_id: str, body: ReasonBody, request: Request, me: dict = Depends(get_current_user)):
    return await _moderate(kind="post", item_id=post_id, new_state="hidden",
                           reason=body.reason, me=me, request=request)


@router.post("/posts/{post_id}/remove", response_model=MessageResponse, summary="Remove a post",
             dependencies=[Depends(require_permission("community.delete"))])
async def remove_post(post_id: str, body: ReasonBody, request: Request, me: dict = Depends(get_current_user)):
    return await _moderate(kind="post", item_id=post_id, new_state="removed",
                           reason=body.reason, me=me, request=request)


@router.post("/posts/{post_id}/restore", response_model=MessageResponse, summary="Restore a post",
             dependencies=[Depends(require_permission("community.edit"))])
async def restore_post(post_id: str, body: ReasonBody, request: Request, me: dict = Depends(get_current_user)):
    return await _moderate(kind="post", item_id=post_id, new_state="visible",
                           reason=body.reason, me=me, request=request)


@router.post("/replies/{reply_id}/hide", response_model=MessageResponse, summary="Hide a reply",
             dependencies=[Depends(require_permission("community.edit"))])
async def hide_reply(reply_id: str, body: ReasonBody, request: Request, me: dict = Depends(get_current_user)):
    return await _moderate(kind="reply", item_id=reply_id, new_state="hidden",
                           reason=body.reason, me=me, request=request)


@router.post("/replies/{reply_id}/remove", response_model=MessageResponse, summary="Remove a reply",
             dependencies=[Depends(require_permission("community.delete"))])
async def remove_reply(reply_id: str, body: ReasonBody, request: Request, me: dict = Depends(get_current_user)):
    return await _moderate(kind="reply", item_id=reply_id, new_state="removed",
                           reason=body.reason, me=me, request=request)


@router.post("/replies/{reply_id}/restore", response_model=MessageResponse, summary="Restore a reply",
             dependencies=[Depends(require_permission("community.edit"))])
async def restore_reply(reply_id: str, body: ReasonBody, request: Request, me: dict = Depends(get_current_user)):
    return await _moderate(kind="reply", item_id=reply_id, new_state="visible",
                           reason=body.reason, me=me, request=request)


@router.post(
    "/posts/{post_id}/pin",
    response_model=MessageResponse,
    summary="Pin or unpin a post at the top of its circle",
    dependencies=[Depends(require_permission("community.edit"))],
)
async def toggle_pinned(post_id: str, request: Request, me: dict = Depends(get_current_user)):
    oid = to_object_id(post_id)
    post = await _posts().find_one({"_id": oid})
    if not post:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That post doesn't exist")
    pinning = not post.get("pinned", False)
    await _posts().update_one({"_id": oid}, {"$set": {"pinned": pinning, "updated_at": _now()}})
    snippet = (post.get("body", "") or "").strip().replace("\n", " ")[:80]
    await record(
        me, "community.post.pin" if pinning else "community.post.unpin", target=post_id,
        detail=f"{'Pinned' if pinning else 'Unpinned'} post by {post.get('author_name') or 'a member'} (“{snippet}”)",
        request=request,
    )
    return {"message": "Post pinned to the top" if pinning else "Post unpinned"}


# ── stories ──────────────────────────────────────────────────────────────────

def _story_out(d: dict) -> StoryOut:
    base = StoryModel.to_response(d)
    decision = d.get("decision") or {}
    return StoryOut(
        id=base["id"],
        author_name=base["author_name"],
        title=base["title"],
        body=base["body"],
        program=base["program"],
        status=base["status"],
        featured=base["featured"],
        likes=base["likes"],
        when=base["when"],
        submitted_at=_iso(d.get("created_at")),
        decided_at=_iso(decision.get("at")),
        decided_by=decision.get("by", ""),
        reason=decision.get("reason", ""),
    )


@router.get(
    "/stories",
    response_model=StoriesPage,
    summary="Submitted stories",
    dependencies=[Depends(require_permission("community.view"))],
)
async def list_stories(status_filter: str = Query("", alias="status", max_length=20)):
    query = {"status": status_filter} if status_filter else {}
    docs, total, pending, published, declined, featured = await asyncio.gather(
        _stories().find(query).sort("created_at", -1).to_list(300),
        _stories().count_documents({}),
        _stories().count_documents({"status": StoryModel.STATUS_PENDING}),
        _stories().count_documents({"status": StoryModel.STATUS_PUBLISHED}),
        _stories().count_documents({"status": StoryModel.STATUS_DECLINED}),
        _stories().count_documents({"status": StoryModel.STATUS_PUBLISHED, "featured": True}),
    )
    return StoriesPage(
        stories=[_story_out(d) for d in docs],
        summary=StorySummary(
            total=total, pending=pending, published=published,
            declined=declined, featured=featured,
        ),
    )


@router.patch(
    "/stories/{story_id}",
    response_model=StoryOut,
    summary="Publish, decline, feature or unfeature — with a reason",
    dependencies=[Depends(require_permission("community.approve"))],
)
async def decide_story(
    story_id: str, body: StoryDecision, request: Request,
    me: dict = Depends(get_current_user),
):
    oid = to_object_id(story_id)
    before = await _stories().find_one({"_id": oid})
    if not before:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That story doesn't exist")

    reason = body.reason.strip()
    was_status = before.get("status", StoryModel.STATUS_PENDING)
    was_featured = bool(before.get("featured", False))
    featured = body.featured if body.featured is not None else was_featured
    if body.status != StoryModel.STATUS_PUBLISHED:
        featured = False   # only a published story can be on the front

    if body.status == StoryModel.STATUS_DECLINED and was_status != StoryModel.STATUS_DECLINED and not reason:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Say why — she will be told, and it stays on the record")

    # Which of the four things happened, for the audit line.
    if body.status != was_status:
        verb = {"published": "publish", "declined": "decline", "pending": "reopen"}[body.status]
    elif featured != was_featured:
        verb = "feature" if featured else "unfeature"
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nothing would change")

    now = _now()
    updates: dict = {
        "status": body.status, "featured": featured, "updated_at": now,
        "decision": {"verb": verb, "reason": reason[:400], "by": _actor_name(me),
                     "by_id": str(me["_id"]), "at": now},
    }
    if body.status == StoryModel.STATUS_PUBLISHED and was_status != StoryModel.STATUS_PUBLISHED:
        updates["published_at"] = now
    doc = await _stories().find_one_and_update(
        {"_id": oid}, {"$set": updates}, return_document=True,
    )
    # The member wall is cached; a decision has to reach it now, not in a while.
    cache.forget("community:stories")

    if doc.get("user_id"):
        if verb == "publish":
            await notify(get_database(), doc["user_id"], "Your story is live",
                         "Thank you for sharing it. Other women are reading it now.",
                         "account", f"/app/stories/{story_id}")
        elif verb == "decline":
            await notify(get_database(), doc["user_id"], "About your story",
                         f"We couldn't publish this one. {reason}", "account", "/app/stories")
        elif verb == "feature":
            await notify(get_database(), doc["user_id"], "Your story is on the front",
                         "It's the first thing members see on the stories wall this week.",
                         "account", f"/app/stories/{story_id}")

    done = {"publish": "Published", "decline": "Declined", "reopen": "Reopened",
            "feature": "Featured", "unfeature": "Unfeatured"}[verb]
    await record(
        me, f"community.story.{verb}", target=story_id,
        detail=f"{done} “{doc.get('title', '')}” by {doc.get('author_name') or 'a member'}"
        + (f": {reason}" if reason else ""),
        request=request,
    )
    return _story_out(doc)
