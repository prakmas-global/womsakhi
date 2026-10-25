"""
Links a member can share — a course, a story, a circle invite — and the pages
a stranger opens from them.

The app shared `womsakhi.com/course/<id>`, `/story/<id>` and `/join/<id>`, and
none of those pages existed: every shared link was a 404 in somebody's
WhatsApp. These are the endpoints behind the real pages (`/c/[id]`,
`/story/[id]`, `/join/[code]` in the frontend).

`router` is public (no session): it shows only what a stranger may see — a
course's title and its teacher's first name, a published story under the
name its author chose to show, a circle's name and how many women are in it.
No phone, no email, no member id.

`member_router` is the signed-in half: a host making an invite code for her
circle, a member joining by one, and finding a story's author to message her.
"""

from __future__ import annotations

import secrets
from datetime import datetime

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.rbac import require_active_member
from app.core.media import media_url
from app.db.mongodb import get_database
from app.models.community import CircleMemberModel, CircleModel, StoryModel
from app.models.circle_chat import post_system, who

router = APIRouter(prefix="/public", tags=["Public"])
member_router = APIRouter(prefix="/community", tags=["Member · Community"])

#: The statuses under which a course is open in Learn (routes/catalog.py).
_OPEN_PROGRAM = ["Ongoing", "Upcoming", "Active", "Published", "Running"]


def _db():
    return get_database()


def _oid(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")


def _first(name: str) -> str:
    return (name or "").strip().split(" ")[0]


# ── a course ───────────────────────────────────────────────────────────────

@router.get("/courses/{course_id}", summary="A course, for a shared link")
async def public_course(course_id: str):
    doc = await _db()["programs"].find_one({"_id": _oid(course_id), "status": {"$in": _OPEN_PROGRAM}})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That course is not open")
    lessons = doc.get("curriculum") or []
    return {
        "id": str(doc["_id"]),
        "name": doc.get("name", ""),
        "desc": (doc.get("desc") or "")[:600],
        "category": doc.get("category", ""),
        "duration": doc.get("duration", "") or "",
        "teacher": (_first(doc.get("teacher_name") or "") or "WomSakhi team")
        if doc.get("owner_kind") == "member" else "WomSakhi team",
        "by_member": doc.get("owner_kind") == "member",
        "lessons": len(lessons),
        "lesson_titles": [(m or {}).get("title", "") for m in lessons][:8],
        "price_minor": int(doc.get("price_minor") or 0),
        "enrolled": int(doc.get("enrolled") or 0),
    }


# ── a story ────────────────────────────────────────────────────────────────

@router.get("/stories/{story_id}", summary="A published story, for a shared link")
async def public_story(story_id: str):
    doc = await _db()[StoryModel.collection_name].find_one(
        {"_id": _oid(story_id), "status": StoryModel.STATUS_PUBLISHED})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That story is not here")
    published = doc.get("published_at") or doc.get("created_at")
    named = bool(doc.get("allow_name", True))
    return {
        "id": str(doc["_id"]),
        "title": doc.get("title", ""),
        "body": doc.get("body", ""),
        "program": doc.get("program", ""),
        "cover": media_url(doc.get("cover", "")),
        # The name she agreed to show — her first name only, on the open web.
        "author": _first(doc.get("author_name", "")) if named else "A WomSakhi member",
        "when": published.strftime("%d %b %Y") if isinstance(published, datetime) else "",
        "likes": len(doc.get("likes") or []),
    }


@member_router.get("/stories/{story_id}/author", summary="Who wrote it — to message her")
async def story_author(story_id: str, me: dict = Depends(require_active_member)):
    """Only when the story is published AND she chose to put her name to it."""
    doc = await _db()[StoryModel.collection_name].find_one(
        {"_id": _oid(story_id), "status": StoryModel.STATUS_PUBLISHED}, {"user_id": 1, "allow_name": 1, "author_name": 1})
    if not doc or not doc.get("allow_name", True) or not doc.get("user_id"):
        return {"user_id": "", "name": ""}
    if doc["user_id"] == str(me["_id"]):
        return {"user_id": "", "name": ""}
    author = await _db()["users"].find_one(
        {"_id": _oid(doc["user_id"]), "verification_status": "active", "role": "Member"}, {"_id": 1})
    if not author:
        return {"user_id": "", "name": ""}
    return {"user_id": doc["user_id"], "name": doc.get("author_name", "")}


# ── a circle invite ────────────────────────────────────────────────────────

async def _circle_by_code(code: str) -> dict:
    circle = await _db()[CircleModel.collection_name].find_one(
        {"invite_code": (code or "").strip(), "status": "active"})
    if not circle or not code:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This invite is not valid any more. Ask her for a new link.")
    return circle


@router.get("/circles/invite/{code}", summary="A circle invite, for a shared link")
async def public_invite(code: str):
    c = await _circle_by_code(code)
    return {
        "code": code,
        "name": c.get("name", ""),
        "topic": c.get("topic", ""),
        "desc": (c.get("desc") or "")[:400],
        "icon": c.get("icon", "") or "",
        "member_count": int(c.get("member_count") or 0),
        "is_savings": bool(c.get("is_savings")),
        "is_private": bool(c.get("is_private")),
        "monthly_minor": int(c.get("monthly_minor") or 0) if c.get("is_savings") else 0,
    }


@member_router.post("/circles/{circle_id}/invite-code", summary="My circle's invite link (host only)")
async def invite_code(circle_id: str, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    circle = await _db()[CircleModel.collection_name].find_one({"_id": _oid(circle_id), "status": "active"})
    if not circle:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That circle doesn't exist")
    host = circle.get("created_by") == uid or await _db()[CircleMemberModel.collection_name].find_one(
        {"circle_id": circle_id, "user_id": uid, "role": CircleMemberModel.ROLE_HOST})
    if not host:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the host can invite people with a link.")
    code = circle.get("invite_code")
    if not code:
        code = secrets.token_urlsafe(6).replace("-", "x").replace("_", "y")
        await _db()[CircleModel.collection_name].update_one({"_id": circle["_id"]}, {"$set": {"invite_code": code}})
    return {"code": code, "path": f"/join/{code}"}


@member_router.post("/circles/join/{code}", summary="Join a circle with an invite link")
async def join_by_code(code: str, me: dict = Depends(require_active_member)):
    """
    The invite IS the way in — including to a private circle, which
    `join_circle` refuses from the outside because nobody had invited her.
    """
    circle = await _circle_by_code(code)
    uid, circle_id = str(me["_id"]), str(circle["_id"])
    members = _db()[CircleMemberModel.collection_name]
    joined = await members.find_one({"user_id": uid, "circle_id": circle_id})
    if not joined:
        await members.insert_one(CircleMemberModel.create_document(uid, circle_id))
        await _db()[CircleModel.collection_name].update_one({"_id": circle["_id"]}, {"$inc": {"member_count": 1}})
        await post_system(_db(), circle_id, f"{who(me)} joined using the invite link", actor_id=uid)
    return {"circle_id": circle_id, "name": circle.get("name", ""), "already": bool(joined)}
