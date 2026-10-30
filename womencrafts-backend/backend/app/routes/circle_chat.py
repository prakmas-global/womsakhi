"""
Circles as group chats — the WhatsApp half of Community.

── What a circle is now ──────────────────────────────────────────────────────
A group chat. Its members talk in `circle_messages` (app/models/circle_chat.py);
the old discussion wall (`circle_posts`) is kept read-only as "Earlier posts".
Savings circles are still circles: the pot, the rounds and the payments in
routes/community.py are untouched, and their chat is where the group talks.

── Who may do what ──────────────────────────────────────────────────────────
* Read and send: members only — even in a public circle, the chat is for the
  people in it. "Only admins can send" (`who_posts == "hosts"`) turns a circle
  into an announcement group. A staff mute (`_refuse_if_muted`) still holds.
* Delete: her own message, or any message if she is an admin. Soft — the row
  stays and says "This message was deleted".
* Admins: the woman who started it, and anyone she (or another admin) makes
  one. Stored as the existing `host` role, so the invite link, the savings
  roster and every older check keep agreeing on who runs the circle. The
  founder cannot be removed or demoted.

── Getting in ───────────────────────────────────────────────────────────────
* The invite link (routes/public_share.py) — anyone with it joins.
* By username: an admin finds her (`/people/search`) and sends an invite. She
  is NOT added: she sees "Invites for you" and taps Join or Decline. Nobody is
  pulled into a group she did not choose.

── The list ─────────────────────────────────────────────────────────────────
`GET /community/chats` is her WhatsApp list: each circle with its last line,
how many she has not read (from `circle_members.last_read_at`), sorted by the
latest activity.
"""

from __future__ import annotations

import asyncio
import secrets
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from app.core import ratelimit
from app.core.media import MediaRefOptional, media_url
from app.core.rbac import require_active_member
from app.db.mongodb import get_database
from app.models.circle_chat import CircleMessageModel as Msg, post_system, who
from app.models.community import CircleMemberModel, CircleModel, PostModel
from app.models.conversation import notify
from app.routes.community import _refuse_if_muted

router = APIRouter(prefix="/community", tags=["Member · Circle chat"])

ADMIN_ROLES = {CircleMemberModel.ROLE_HOST, "moderator"}
PAGE = 50
#: Sends per member per minute, across all her circles.
SEND_LIMIT = (30, 60.0)


def _db():
    return get_database()


def _oid(raw: str) -> ObjectId:
    if not ObjectId.is_valid(raw or ""):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    return ObjectId(raw)


def _iso(d: Optional[datetime]) -> str:
    if not isinstance(d, datetime):
        return ""
    return (d if d.tzinfo else d.replace(tzinfo=timezone.utc)).isoformat()


def _aware(d: Optional[datetime]) -> Optional[datetime]:
    if not isinstance(d, datetime):
        return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


async def _circle(circle_id: str) -> dict:
    circle = await _db()[CircleModel.collection_name].find_one({"_id": _oid(circle_id), "status": "active"})
    if not circle:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That circle doesn't exist")
    return circle


async def _membership(circle_id: str, uid: str) -> Optional[dict]:
    return await _db()[CircleMemberModel.collection_name].find_one({"circle_id": circle_id, "user_id": uid})


def _is_admin(circle: dict, membership: Optional[dict], uid: str) -> bool:
    return bool(membership) and (circle.get("created_by") == uid or membership.get("role") in ADMIN_ROLES)


async def _member_or_403(circle_id: str, uid: str) -> tuple[dict, dict]:
    circle = await _circle(circle_id)
    membership = await _membership(circle_id, uid)
    if not membership:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Join this circle to see its chat")
    return circle, membership


async def _admin_or_403(circle_id: str, uid: str) -> tuple[dict, dict]:
    circle, membership = await _member_or_403(circle_id, uid)
    if not _is_admin(circle, membership, uid):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only a group admin can do that")
    return circle, membership


async def _users(ids: set[str]) -> dict[str, dict]:
    oids = [ObjectId(i) for i in ids if ObjectId.is_valid(i)]
    if not oids:
        return {}
    rows = _db()["users"].find({"_id": {"$in": oids}}, {"full_name": 1, "username": 1, "avatar": 1})
    return {str(u["_id"]): u async for u in rows}


# --- messages ----------------------------------------------------------------

class ReplyPreview(BaseModel):
    id: str
    name: str = ""
    text: str = ""
    photo: bool = False


class ChatMessage(BaseModel):
    id: str
    kind: str = "text"
    text: str = ""
    photo: str = ""
    user_id: str = ""
    name: str = ""
    username: str = ""
    avatar: str = ""
    mine: bool = False
    deleted: bool = False
    reply_to: Optional[ReplyPreview] = None
    at: str = ""


class MessagePage(BaseModel):
    messages: list[ChatMessage]
    #: Older messages exist before the first one here.
    has_more: bool = False
    can_send: bool = False
    is_admin: bool = False
    #: Her last read time before this page — the "new messages" line goes after it.
    last_read_at: str = ""


class SendMessage(BaseModel):
    text: str = Field(default="", max_length=2000)
    photo: MediaRefOptional = None
    reply_to: str = ""


async def _render(docs: list[dict], uid: str) -> list[ChatMessage]:
    reply_ids = {d["reply_to"] for d in docs if d.get("reply_to") and ObjectId.is_valid(d["reply_to"])}
    quoted = {}
    if reply_ids:
        rows = _db()[Msg.collection_name].find({"_id": {"$in": [ObjectId(r) for r in reply_ids]}})
        quoted = {str(r["_id"]): r async for r in rows}
    people = await _users({d.get("user_id", "") for d in docs} | {q.get("user_id", "") for q in quoted.values()})
    out = []
    for d in docs:
        u = people.get(d.get("user_id", ""), {})
        deleted = bool(d.get("deleted"))
        reply = None
        q = quoted.get(d.get("reply_to", ""))
        if q is not None and not deleted:
            reply = ReplyPreview(
                id=str(q["_id"]), name=who(people.get(q.get("user_id", ""))),
                text="This message was deleted" if q.get("deleted") else (q.get("text") or "")[:140],
                photo=bool(q.get("photo")) and not q.get("deleted"),
            )
        out.append(ChatMessage(
            id=str(d["_id"]), kind=d.get("kind", Msg.KIND_TEXT),
            text="" if deleted else d.get("text", ""),
            photo="" if deleted else media_url(d.get("photo", "")),
            user_id=d.get("user_id", ""), name=who(u) if u else "",
            username=u.get("username") or "", avatar=media_url(u.get("avatar", "")),
            mine=d.get("user_id") == uid and d.get("kind") != Msg.KIND_SYSTEM,
            deleted=deleted, reply_to=reply, at=_iso(d.get("created_at")),
        ))
    return out


def _can_send(circle: dict, membership: dict, uid: str) -> bool:
    return circle.get("who_posts", "all") == "all" or _is_admin(circle, membership, uid)


@router.get("/circles/{circle_id}/messages", response_model=MessagePage, summary="A circle's chat")
async def messages(
    circle_id: str,
    after: str = Query("", description="Only messages newer than this id — for polling"),
    before: str = Query("", description="Only messages older than this id — scrolling back"),
    limit: int = Query(PAGE, ge=1, le=100),
    me: dict = Depends(require_active_member),
):
    uid = str(me["_id"])
    circle, membership = await _member_or_403(circle_id, uid)
    col = _db()[Msg.collection_name]
    query: dict = {"circle_id": circle_id}
    has_more = False
    if after and ObjectId.is_valid(after):
        query["_id"] = {"$gt": ObjectId(after)}
        docs = await col.find(query).sort("_id", 1).limit(limit).to_list(limit)
    else:
        if before and ObjectId.is_valid(before):
            query["_id"] = {"$lt": ObjectId(before)}
        docs = await col.find(query).sort("_id", -1).limit(limit + 1).to_list(limit + 1)
        has_more = len(docs) > limit
        docs = list(reversed(docs[:limit]))
    return MessagePage(
        messages=await _render(docs, uid), has_more=has_more,
        can_send=_can_send(circle, membership, uid), is_admin=_is_admin(circle, membership, uid),
        last_read_at=_iso(membership.get("last_read_at")),
    )


@router.post("/circles/{circle_id}/messages", response_model=ChatMessage,
             status_code=status.HTTP_201_CREATED, summary="Send a message to a circle")
async def send(circle_id: str, body: SendMessage, request: Request, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    circle, membership = await _member_or_403(circle_id, uid)
    text = (body.text or "").strip()
    if not text and not body.photo:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Write something or add a photo")
    if not _can_send(circle, membership, uid):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only admins can send messages in this group")
    await _refuse_if_muted(circle_id, uid)
    await ratelimit.check(request, "circle_chat", uid, SEND_LIMIT)
    reply_to = ""
    if body.reply_to and ObjectId.is_valid(body.reply_to):
        if await _db()[Msg.collection_name].find_one({"_id": ObjectId(body.reply_to), "circle_id": circle_id}, {"_id": 1}):
            reply_to = body.reply_to
    doc = Msg.create_document(circle_id, uid, text, photo=body.photo or "", reply_to=reply_to)
    doc["_id"] = (await _db()[Msg.collection_name].insert_one(doc)).inserted_id
    now = doc["created_at"]
    # Sending is reading: her own line must not count as unread for her.
    await asyncio.gather(
        _db()[CircleModel.collection_name].update_one({"_id": circle["_id"]}, {"$set": {"last_message_at": now}}),
        _db()[CircleMemberModel.collection_name].update_one({"_id": membership["_id"]}, {"$set": {"last_read_at": now}}),
    )
    return (await _render([doc], uid))[0]


@router.delete("/circles/{circle_id}/messages/{message_id}", response_model=ChatMessage, summary="Delete a message")
async def delete_message(circle_id: str, message_id: str, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    circle, membership = await _member_or_403(circle_id, uid)
    doc = await _db()[Msg.collection_name].find_one({"_id": _oid(message_id), "circle_id": circle_id})
    if not doc or doc.get("kind") == Msg.KIND_SYSTEM:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That message is gone")
    if doc.get("user_id") != uid and not _is_admin(circle, membership, uid):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only delete your own messages")
    await _db()[Msg.collection_name].update_one(
        {"_id": doc["_id"]},
        {"$set": {"deleted": True, "deleted_by": uid, "deleted_at": datetime.now(timezone.utc)}})
    doc["deleted"] = True
    return (await _render([doc], uid))[0]


@router.post("/circles/{circle_id}/read", summary="I have read this circle's chat")
async def mark_read(circle_id: str, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    _, membership = await _member_or_403(circle_id, uid)
    await _db()[CircleMemberModel.collection_name].update_one(
        {"_id": membership["_id"]}, {"$set": {"last_read_at": datetime.now(timezone.utc)}})
    return {"ok": True}


# --- her list ----------------------------------------------------------------

class ChatRow(BaseModel):
    id: str
    name: str
    cover: str = ""
    icon: str = ""
    topic: str = ""
    member_count: int = 0
    is_private: bool = False
    is_savings: bool = False
    is_admin: bool = False
    muted: bool = False
    #: "Priya: see you at 5", or "You: …", or a system line, or "".
    last_text: str = ""
    last_at: str = ""
    unread: int = 0


@router.get("/chats", response_model=list[ChatRow], summary="My circles as a chat list")
async def chats(me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    db = _db()
    rows = await db[CircleMemberModel.collection_name].find({"user_id": uid}).to_list(200)
    if not rows:
        return []
    mine = {r["circle_id"]: r for r in rows}
    circles = await db[CircleModel.collection_name].find(
        {"_id": {"$in": [ObjectId(c) for c in mine if ObjectId.is_valid(c)]}, "status": "active"}).to_list(200)
    ids = [str(c["_id"]) for c in circles]
    col = db[Msg.collection_name]

    lasts = {d["_id"]: d["last"] async for d in col.aggregate([
        {"$match": {"circle_id": {"$in": ids}}},
        {"$sort": {"_id": -1}},
        {"$group": {"_id": "$circle_id", "last": {"$first": "$$ROOT"}}},
    ])}

    async def unread(cid: str) -> int:
        q: dict = {"circle_id": cid, "user_id": {"$ne": uid}, "kind": Msg.KIND_TEXT, "deleted": {"$ne": True}}
        seen = _aware(mine[cid].get("last_read_at"))
        if seen:
            q["created_at"] = {"$gt": seen}
        else:
            # Never opened: what arrived since she joined, not the whole history.
            joined = _aware(mine[cid].get("created_at"))
            if joined:
                q["created_at"] = {"$gt": joined}
        return await col.count_documents(q, limit=99)

    counts, prefs = await asyncio.gather(
        asyncio.gather(*(unread(cid) for cid in ids)),
        db["circle_preferences"].find({"user_id": uid, "circle_id": {"$in": ids}}).to_list(200),
    )
    muted = {p["circle_id"] for p in prefs if p.get("muted")}
    people = await _users({d.get("user_id", "") for d in lasts.values()})

    out = []
    for c, n in zip(circles, counts):
        cid = str(c["_id"])
        last = lasts.get(cid)
        text, at = "", _aware(c.get("created_at"))
        if last:
            at = _aware(last.get("created_at")) or at
            body = "This message was deleted" if last.get("deleted") else (last.get("text") or ("📷 Photo" if last.get("photo") else ""))
            if last.get("kind") == Msg.KIND_SYSTEM:
                text = body
            else:
                by = "You" if last.get("user_id") == uid else who(people.get(last.get("user_id", "")))
                text = f"{by}: {body}"
        membership = mine[cid]
        out.append(ChatRow(
            id=cid, name=c.get("name", ""), cover=media_url(c.get("cover", "")), icon=media_url(c.get("icon", "")),
            topic=c.get("topic", ""), member_count=int(c.get("member_count", 0)),
            is_private=bool(c.get("is_private")), is_savings=bool(c.get("is_savings")),
            is_admin=_is_admin(c, membership, uid), muted=cid in muted,
            last_text=text[:160], last_at=_iso(at), unread=n,
        ))
    out.sort(key=lambda r: r.last_at, reverse=True)
    return out


# --- group info and admin powers ---------------------------------------------

class GroupMember(BaseModel):
    id: str
    name: str
    username: str = ""
    avatar: str = ""
    admin: bool = False
    founder: bool = False
    you: bool = False


class PendingInvite(BaseModel):
    id: str
    to_id: str
    name: str
    username: str = ""
    avatar: str = ""


class GroupInfo(BaseModel):
    id: str
    name: str
    desc: str = ""
    topic: str = ""
    cover: str = ""
    icon: str = ""
    is_private: bool = False
    is_savings: bool = False
    member_count: int = 0
    is_admin: bool = False
    only_admins: bool = False
    can_send: bool = False
    muted: bool = False
    #: The invite code, for admins only ("" for everyone else).
    invite_code: str = ""
    earlier_posts: int = 0
    members: list[GroupMember] = []
    pending: list[PendingInvite] = []


async def _info(circle: dict, uid: str) -> GroupInfo:
    cid = str(circle["_id"])
    db = _db()
    rows, earlier, pref, pending = await asyncio.gather(
        db[CircleMemberModel.collection_name].find({"circle_id": cid}).sort("created_at", 1).to_list(500),
        db[PostModel.collection_name].count_documents({"circle_id": cid, "hidden": {"$ne": True}}),
        db["circle_preferences"].find_one({"user_id": uid, "circle_id": cid}),
        db["circle_invites"].find({"circle_id": cid, "to_id": {"$exists": True}, "status": "pending"}).to_list(100),
    )
    mine = next((r for r in rows if r["user_id"] == uid), None)
    admin = _is_admin(circle, mine, uid)
    people = await _users({r["user_id"] for r in rows} | {p["to_id"] for p in pending})
    founder = circle.get("created_by", "")
    members = [GroupMember(
        id=r["user_id"], name=who(people.get(r["user_id"])), username=people.get(r["user_id"], {}).get("username") or "",
        avatar=media_url(people.get(r["user_id"], {}).get("avatar", "")),
        admin=r["user_id"] == founder or r.get("role") in ADMIN_ROLES, founder=r["user_id"] == founder,
        you=r["user_id"] == uid,
    ) for r in rows]
    # You first, then admins, then everyone in joining order — WhatsApp's order.
    members.sort(key=lambda m: (not m.you, not m.admin))
    return GroupInfo(
        id=cid, name=circle.get("name", ""), desc=circle.get("desc", ""), topic=circle.get("topic", ""),
        cover=media_url(circle.get("cover", "")), icon=media_url(circle.get("icon", "")),
        is_private=bool(circle.get("is_private")), is_savings=bool(circle.get("is_savings")),
        member_count=len(rows), is_admin=admin, only_admins=circle.get("who_posts") == "hosts",
        can_send=bool(mine) and _can_send(circle, mine, uid), muted=bool((pref or {}).get("muted")),
        invite_code=(circle.get("invite_code") or "") if admin else "", earlier_posts=earlier,
        members=members,
        pending=[PendingInvite(
            id=str(p["_id"]), to_id=p["to_id"], name=who(people.get(p["to_id"])),
            username=people.get(p["to_id"], {}).get("username") or "",
            avatar=media_url(people.get(p["to_id"], {}).get("avatar", "")),
        ) for p in pending] if admin else [],
    )


@router.get("/circles/{circle_id}/group", response_model=GroupInfo, summary="Group info")
async def group_info(circle_id: str, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    circle, _ = await _member_or_403(circle_id, uid)
    return await _info(circle, uid)


class GroupUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=80)
    desc: Optional[str] = Field(default=None, max_length=600)
    cover: MediaRefOptional = None
    only_admins: Optional[bool] = None


@router.patch("/circles/{circle_id}/group", response_model=GroupInfo, summary="Change the group (admins)")
async def update_group(circle_id: str, body: GroupUpdate, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    circle, _ = await _admin_or_403(circle_id, uid)
    patch: dict = {}
    lines: list[str] = []
    actor = who(me)
    if body.name is not None and body.name.strip() and body.name.strip() != circle.get("name"):
        patch["name"] = body.name.strip()
        lines.append(f'{actor} changed the group name to "{patch["name"]}"')
    if body.desc is not None and body.desc.strip() != (circle.get("desc") or ""):
        patch["desc"] = body.desc.strip()
        lines.append(f"{actor} changed the group description")
    if body.cover is not None and body.cover != circle.get("cover"):
        patch["cover"] = body.cover
        lines.append(f"{actor} changed the group photo")
    if body.only_admins is not None and body.only_admins != (circle.get("who_posts") == "hosts"):
        patch["who_posts"] = "hosts" if body.only_admins else "all"
        lines.append(f"{actor} let only admins send messages" if body.only_admins
                     else f"{actor} let everyone send messages")
    if patch:
        patch["updated_at"] = datetime.now(timezone.utc)
        await _db()[CircleModel.collection_name].update_one({"_id": circle["_id"]}, {"$set": patch})
        for line in lines:
            await post_system(_db(), circle_id, line, actor_id=uid)
        circle.update(patch)
    return await _info(circle, uid)


class AdminFlag(BaseModel):
    admin: bool


@router.post("/circles/{circle_id}/members/{user_id}/admin", response_model=GroupInfo, summary="Make or unmake an admin")
async def set_admin(circle_id: str, user_id: str, body: AdminFlag, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    circle, _ = await _admin_or_403(circle_id, uid)
    target = await _membership(circle_id, user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "She is not in this group")
    if user_id == circle.get("created_by") and not body.admin:
        raise HTTPException(status.HTTP_409_CONFLICT, "The woman who started the group is always an admin")
    role = CircleMemberModel.ROLE_HOST if body.admin else CircleMemberModel.ROLE_MEMBER
    if (target.get("role") in ADMIN_ROLES) != body.admin:
        await _db()[CircleMemberModel.collection_name].update_one({"_id": target["_id"]}, {"$set": {"role": role}})
        name = who((await _users({user_id})).get(user_id))
        await post_system(_db(), circle_id,
                          f"{who(me)} made {name} an admin" if body.admin else f"{name} is no longer an admin",
                          actor_id=uid)
    return await _info(circle, uid)


@router.delete("/circles/{circle_id}/members/{user_id}", response_model=GroupInfo, summary="Remove someone (admins)")
async def remove_member(circle_id: str, user_id: str, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    circle, _ = await _admin_or_403(circle_id, uid)
    if user_id == uid:
        raise HTTPException(status.HTTP_409_CONFLICT, "Use Leave group to leave it yourself")
    if user_id == circle.get("created_by"):
        raise HTTPException(status.HTTP_409_CONFLICT, "The woman who started the group cannot be removed")
    gone = await _db()[CircleMemberModel.collection_name].delete_one({"circle_id": circle_id, "user_id": user_id})
    if gone.deleted_count:
        await _db()[CircleModel.collection_name].update_one(
            {"_id": circle["_id"], "member_count": {"$gt": 0}}, {"$inc": {"member_count": -1}})
        name = who((await _users({user_id})).get(user_id))
        await post_system(_db(), circle_id, f"{who(me)} removed {name}", actor_id=uid)
    return await _info(circle, uid)


@router.post("/circles/{circle_id}/invite-code/reset", summary="A new invite link (admins); the old one stops working")
async def reset_invite_code(circle_id: str, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    circle, _ = await _admin_or_403(circle_id, uid)
    code = secrets.token_urlsafe(6).replace("-", "x").replace("_", "y")
    await _db()[CircleModel.collection_name].update_one({"_id": circle["_id"]}, {"$set": {"invite_code": code}})
    return {"code": code, "path": f"/join/{code}"}


# --- invites by username -------------------------------------------------------

class InviteBody(BaseModel):
    user_id: str


class IncomingInvite(BaseModel):
    id: str
    circle_id: str
    circle_name: str
    cover: str = ""
    icon: str = ""
    topic: str = ""
    member_count: int = 0
    is_savings: bool = False
    from_name: str = ""
    at: str = ""


def _invites():
    return _db()["circle_invites"]


@router.post("/circles/{circle_id}/invites", response_model=GroupInfo, status_code=status.HTTP_201_CREATED,
             summary="Invite a member by username (admins)")
async def invite(circle_id: str, body: InviteBody, request: Request, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    circle, _ = await _admin_or_403(circle_id, uid)
    await ratelimit.check(request, "circle_invite", uid, (40, 3600.0))
    target = await _db()["users"].find_one({
        "_id": _oid(body.user_id), "role": "Member", "verification_status": "active", "is_active": {"$ne": False}})
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "We could not find that member")
    if await _membership(circle_id, body.user_id):
        raise HTTPException(status.HTTP_409_CONFLICT, {"code": "already_member", "message": f"{who(target)} is already in this group"})
    if await _invites().find_one({"circle_id": circle_id, "to_id": body.user_id, "status": "pending"}, {"_id": 1}):
        raise HTTPException(status.HTTP_409_CONFLICT, {"code": "already_invited", "message": f"{who(target)} already has an invite"})
    # One row per (circle, woman): the collection's unique index on
    # `target_normalized` (shared with the create wizard's typed invites) means
    # an invite she declined last month is reopened rather than duplicated.
    now = datetime.now(timezone.utc)
    await _invites().update_one(
        {"circle_id": circle_id, "target_normalized": f"user:{body.user_id}"},
        {"$set": {"from_id": uid, "invited_by": uid, "to_id": body.user_id, "target": body.user_id,
                  "status": "pending", "created_at": now, "updated_at": now}},
        upsert=True,
    )
    await notify(_db(), body.user_id, f"{who(me)} invited you to {circle.get('name', 'a circle')}",
                 "Open Circles to join or decline.", "community", "/app/circles")
    return await _info(circle, uid)


@router.delete("/circles/{circle_id}/invites/{invite_id}", response_model=GroupInfo, summary="Take back an invite (admins)")
async def cancel_invite(circle_id: str, invite_id: str, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    circle, _ = await _admin_or_403(circle_id, uid)
    await _invites().update_one({"_id": _oid(invite_id), "circle_id": circle_id, "status": "pending"},
                                {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc)}})
    return await _info(circle, uid)


@router.get("/circle-invites", response_model=list[IncomingInvite], summary="Groups inviting me")
async def my_invites(me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    rows = await _invites().find({"to_id": uid, "status": "pending"}).sort("created_at", -1).to_list(50)
    circles = {str(c["_id"]): c async for c in _db()[CircleModel.collection_name].find(
        {"_id": {"$in": [ObjectId(r["circle_id"]) for r in rows if ObjectId.is_valid(r["circle_id"])]}, "status": "active"})}
    people = await _users({r.get("from_id", "") for r in rows})
    out = []
    for r in rows:
        c = circles.get(r["circle_id"])
        if not c:
            continue
        out.append(IncomingInvite(
            id=str(r["_id"]), circle_id=r["circle_id"], circle_name=c.get("name", ""),
            cover=media_url(c.get("cover", "")), icon=media_url(c.get("icon", "")), topic=c.get("topic", ""),
            member_count=int(c.get("member_count", 0)), is_savings=bool(c.get("is_savings")),
            from_name=who(people.get(r.get("from_id", ""))), at=_iso(r.get("created_at")),
        ))
    return out


async def _my_invite(invite_id: str, uid: str) -> dict:
    row = await _invites().find_one({"_id": _oid(invite_id), "to_id": uid, "status": "pending"})
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That invite is no longer open")
    return row


@router.post("/circle-invites/{invite_id}/accept", summary="Join the group that invited me")
async def accept_invite(invite_id: str, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    row = await _my_invite(invite_id, uid)
    circle = await _circle(row["circle_id"])
    cid = row["circle_id"]
    now = datetime.now(timezone.utc)
    if not await _membership(cid, uid):
        await _db()[CircleMemberModel.collection_name].insert_one(CircleMemberModel.create_document(uid, cid))
        await _db()[CircleModel.collection_name].update_one({"_id": circle["_id"]}, {"$inc": {"member_count": 1}})
        await post_system(_db(), cid, f"{who(me)} joined", actor_id=uid)
    await _invites().update_one({"_id": row["_id"]}, {"$set": {"status": "accepted", "updated_at": now}})
    if row.get("from_id"):
        await notify(_db(), row["from_id"], f"{who(me)} joined {circle.get('name', 'your circle')}",
                     "", "community", f"/app/circles/{cid}")
    return {"circle_id": cid, "name": circle.get("name", "")}


@router.post("/circle-invites/{invite_id}/decline", summary="Say no to a group invite")
async def decline_invite(invite_id: str, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    row = await _my_invite(invite_id, uid)
    await _invites().update_one({"_id": row["_id"]},
                                {"$set": {"status": "declined", "updated_at": datetime.now(timezone.utc)}})
    return {"ok": True}
