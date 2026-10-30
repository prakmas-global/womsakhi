"""
People — her username, and finding another woman by hers.

`/me/username` checks and sets it (rules in app/core/usernames.py).
`/people/search` and `/people/u/{username}` are how one member finds another:
for a friend request, for adding her to a circle. Only admitted members are
found, never staff, and never by phone or email — a username is the only thing
a stranger can search on.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from app.core import usernames as un
from app.core.audit import record
from app.core.media import media_url
from app.core.rbac import require_active_member, require_member_account
from app.db.mongodb import get_database

router = APIRouter(tags=["People"])


def _db():
    return get_database()


# --- her username -------------------------------------------------------------

class UsernameState(BaseModel):
    username: str = ""
    #: The name other members see right now (username, else her account name).
    display_name: str = ""
    can_change: bool = True
    #: ISO date she may change it again, when she may not now.
    next_change_at: str = ""
    cooldown_days: int = un.COOLDOWN_DAYS


class UsernameCheck(BaseModel):
    username: str
    available: bool
    reason: str = ""
    suggestions: list[str] = []


class UsernameSet(BaseModel):
    username: str = Field(..., min_length=1, max_length=40)


def _state(user: dict) -> UsernameState:
    nxt = un.next_change_at(user)
    return UsernameState(
        username=user.get("username") or "",
        display_name=un.display_name(user),
        can_change=nxt is None,
        next_change_at=nxt.isoformat() if nxt else "",
    )


async def _taken(names: list[str], except_id) -> set[str]:
    rows = _db()["users"].find({"username": {"$in": names}, "_id": {"$ne": except_id}}, {"username": 1})
    return {r["username"] async for r in rows}


async def _suggest(me: dict, want: str) -> list[str]:
    draft = un.suggestions_from(me.get("full_name", ""), set(), want)
    # Draft a wider pool, then drop the ones already held.
    pool = draft + un.suggestions_from(me.get("full_name", ""), set(draft), want)
    taken = await _taken(pool, me["_id"])
    return [p for p in pool if p not in taken][:4]


@router.get("/me/username", response_model=UsernameState, summary="My username and when I can change it")
async def my_username(me: dict = Depends(require_member_account)):
    return _state(me)


@router.get("/me/username/check", response_model=UsernameCheck, summary="Is this username free?")
async def check_username(u: str = Query("", max_length=40), me: dict = Depends(require_member_account)):
    name = un.normalise(u)
    why = un.problem(name)
    if why is None and name != (me.get("username") or ""):
        if await _db()["users"].find_one({"username": name, "_id": {"$ne": me["_id"]}}, {"_id": 1}):
            why = "Someone already has this name."
    if name and name == (me.get("username") or ""):
        return UsernameCheck(username=name, available=True, reason="This is your username now.")
    return UsernameCheck(username=name, available=why is None, reason=why or "",
                         suggestions=[] if why is None else await _suggest(me, name))


@router.put("/me/username", response_model=UsernameState, summary="Set or change my username")
async def set_username(payload: UsernameSet, me: dict = Depends(require_member_account)):
    name = un.normalise(payload.username)
    if name == (me.get("username") or ""):
        return _state(me)
    why = un.problem(name)
    if why:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, {"code": "username_invalid", "message": why})
    nxt = un.next_change_at(me)
    if nxt is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, {
            "code": "username_cooldown",
            "message": f"You can change your username again on {nxt.strftime('%d %b %Y')}.",
            "next_change_at": nxt.isoformat(),
        })
    if await _db()["users"].find_one({"username": name, "_id": {"$ne": me["_id"]}}, {"_id": 1}):
        raise HTTPException(status.HTTP_409_CONFLICT, {"code": "username_taken", "message": "Someone already has this name."})
    now = datetime.now(timezone.utc)
    try:
        await _db()["users"].update_one(
            {"_id": me["_id"]},
            {"$set": {"username": name, "username_changed_at": now, "updated_at": now},
             "$push": {"username_history": {"$each": [{"username": me.get("username") or "", "until": now}],
                                            "$slice": -10}}},
        )
    except DuplicateKeyError:
        raise HTTPException(status.HTTP_409_CONFLICT, {"code": "username_taken", "message": "Someone already has this name."})
    await record(me, "username.set", detail=f"{me.get('username') or '—'} → {name}")
    return _state({**me, "username": name, "username_changed_at": now})


# --- finding another woman ----------------------------------------------------

class PersonRow(BaseModel):
    id: str
    username: str = ""
    name: str
    avatar: str = ""
    verified: bool = False
    location: str = ""
    #: none | friends | sent | received | self — filled by the friends module.
    relation: str = "none"


class PersonProfile(PersonRow):
    bio: str = ""
    member_since: str = ""
    friends: int = 0
    posts: int = 0


MEMBER_FILTER = {"role": "Member", "verification_status": "active", "is_active": {"$ne": False}}


async def _members_of(users: list[dict]) -> dict[str, dict]:
    ids = [ObjectId(u["member_id"]) for u in users if ObjectId.is_valid(u.get("member_id") or "")]
    if not ids:
        return {}
    rows = _db()["members"].find({"_id": {"$in": ids}}, {"display_location": 1, "location": 1, "bio": 1})
    return {str(r["_id"]): r async for r in rows}


def person_row(u: dict, member: Optional[dict] = None) -> PersonRow:
    member = member or {}
    loc = (member.get("display_location") or member.get("location") or "").split(",")[0].strip()
    return PersonRow(
        id=str(u["_id"]), username=u.get("username") or "", name=un.display_name(u),
        avatar=media_url(u.get("avatar", "")), verified=u.get("verification_status") == "active",
        location=loc,
    )


# Hook for the friends module: given her id and some rows, fill `relation`.
RELATION_FILLERS: list = []


async def _fill_relations(me: dict, rows: list[PersonRow]) -> None:
    for row in rows:
        if row.id == str(me["_id"]):
            row.relation = "self"
    for fill in RELATION_FILLERS:
        await fill(me, rows)


@router.get("/people/search", response_model=list[PersonRow], summary="Find a member by username")
async def search_people(q: str = Query("", max_length=40), limit: int = Query(12, ge=1, le=30),
                        me: dict = Depends(require_active_member)):
    name = un.normalise(q)
    if len(name) < 2:
        return []
    rx = "^" + re.escape(name)
    query = {**MEMBER_FILTER, "_id": {"$ne": me["_id"]}, "username": {"$regex": rx}}
    users = [u async for u in _db()["users"].find(query).limit(limit * 2)]
    # The exact name first, then shortest — "priya" before "priya.sews.pune".
    users.sort(key=lambda u: (u.get("username") != name, len(u.get("username") or "")))
    users = users[:limit]
    members = await _members_of(users)
    rows = [person_row(u, members.get(u.get("member_id") or "")) for u in users]
    await _fill_relations(me, rows)
    return rows


@router.get("/people/u/{username}", response_model=PersonProfile, summary="One member's public card")
async def person(username: str, me: dict = Depends(require_active_member)):
    name = un.normalise(username)
    query = {**MEMBER_FILTER, "username": name}
    if ObjectId.is_valid(username):
        # Members without a username yet are reached by id from a post or a chat.
        query = {"$or": [{**MEMBER_FILTER, "username": name}, {**MEMBER_FILTER, "_id": ObjectId(username)}]}
    u = await _db()["users"].find_one(query)
    if not u:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No member with that username")
    member = (await _members_of([u])).get(u.get("member_id") or "", {})
    row = person_row(u, member)
    await _fill_relations(me, [row])
    created = u.get("created_at")
    uid = str(u["_id"])
    friends = await _db()["friendships"].count_documents({"users": uid, "status": "accepted"})
    posts = await _db()["feed_posts"].count_documents({"author_id": uid, "deleted": {"$ne": True}})
    return PersonProfile(**row.model_dump(), bio=(member.get("bio") or "")[:600],
                         member_since=created.strftime("%b %Y") if isinstance(created, datetime) else "",
                         friends=friends, posts=posts)
