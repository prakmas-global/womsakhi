"""
Staff side of circles and success stories.

Moderation here HIDES, it never deletes. A post that caused a report has to
survive the report, otherwise the record of what happened disappears along with
the evidence for it.
"""

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core import mongosafe
from app.core.permissions import require_permission
from app.core.deps import get_current_user
from app.core.serializers import to_object_id
from app.db.mongodb import get_database
from app.models.community import CircleModel, PostModel, PostReplyModel, StoryModel
from app.models.conversation import notify
from app.routes.staff_account import log_activity
from app.models.user import UserModel
from app.schemas.admin_modules import (
    AdminCircle,
    AdminPost,
    AdminStory,
    CircleUpsert,
    StoryDecision,
)
from app.schemas.me import MessageResponse

router = APIRouter(prefix="/admin/community", tags=["Staff · Community"])


def _circles():
    return get_database()[CircleModel.collection_name]


def _posts():
    return get_database()[PostModel.collection_name]


def _replies():
    return get_database()[PostReplyModel.collection_name]


def _stories():
    return get_database()[StoryModel.collection_name]


def _users():
    return get_database()[UserModel.collection_name]


# --- circles -----------------------------------------------------------------

@router.get("/circles", response_model=list[AdminCircle], summary="All circles")
async def list_circles(q: str = Query("", max_length=80), me: dict = Depends(get_current_user)):
    query: dict = {}
    if q.strip():
        query["name"] = mongosafe.contains(q)
    docs = await _circles().find(query).sort("member_count", -1).to_list(300)
    return [
        AdminCircle(
            **{
                k: v
                for k, v in CircleModel.to_response(d).items()
                if k not in ("joined", "cover")
            },
            status=d.get("status", "active"),
        )
        for d in docs
    ]


@router.post(
    "/circles",
    response_model=AdminCircle,
    status_code=status.HTTP_201_CREATED,
    summary="Create a circle",
    dependencies=[Depends(require_permission("community.create"))],
)
async def create_circle(body: CircleUpsert, me: dict = Depends(get_current_user)):
    doc = CircleModel.create_document(
        name=body.name, topic=body.topic, desc=body.desc,
        guidelines=body.guidelines, is_private=body.is_private,
        created_by=str(me["_id"]),
    )
    doc["status"] = body.status
    result = await _circles().insert_one(doc)
    doc["_id"] = result.inserted_id
    await log_activity(me, "Created a circle", "Community", target=body.name)
    return AdminCircle(
        **{k: v for k, v in CircleModel.to_response(doc).items() if k not in ("joined", "cover")},
        status=doc["status"],
    )


@router.put("/circles/{circle_id}", response_model=AdminCircle, summary="Update a circle", dependencies=[Depends(require_permission("community.edit"))])
async def update_circle(circle_id: str, body: CircleUpsert, me: dict = Depends(get_current_user)):
    updates = body.model_dump()
    updates["updated_at"] = datetime.now(timezone.utc)
    doc = await _circles().find_one_and_update(
        {"_id": to_object_id(circle_id)}, {"$set": updates}, return_document=True
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That circle doesn't exist")
    await log_activity(me, "Updated a circle", "Community", target=body.name)
    return AdminCircle(
        **{k: v for k, v in CircleModel.to_response(doc).items() if k not in ("joined", "cover")},
        status=doc.get("status", "active"),
    )


@router.delete("/circles/{circle_id}", response_model=MessageResponse, summary="Archive a circle", dependencies=[Depends(require_permission("community.delete"))])
async def archive_circle(circle_id: str, me: dict = Depends(get_current_user)):
    updated = await _circles().update_one(
        {"_id": to_object_id(circle_id)}, {"$set": {"status": "archived"}}
    )
    if not updated.matched_count:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That circle doesn't exist")
    return {"message": "Circle archived — members can no longer open it"}


# --- posts (moderation) ------------------------------------------------------

@router.get("/posts", response_model=list[AdminPost], summary="Recent posts across all circles")
async def list_posts(
    circle_id: str = Query("", max_length=40),
    hidden: bool = Query(False, description="Only hidden posts"),
    me: dict = Depends(get_current_user),
):
    query: dict = {"hidden": True} if hidden else {}
    if circle_id:
        query["circle_id"] = circle_id
    docs = await _posts().find(query).sort("created_at", -1).to_list(300)

    ids = []
    for d in docs:
        try:
            ids.append(ObjectId(d["circle_id"]))
        except Exception:  # noqa: BLE001
            continue
    names = {
        str(c["_id"]): c.get("name", "")
        for c in await _circles().find({"_id": {"$in": ids}}, {"name": 1}).to_list(300)
    }

    return [
        AdminPost(
            **{
                k: v
                for k, v in PostModel.to_response(d).items()
                if k not in ("liked_by_me", "mine", "image")
            },
            circle_name=names.get(d.get("circle_id", ""), "—"),
            hidden=bool(d.get("hidden", False)),
        )
        for d in docs
    ]


@router.post("/posts/{post_id}/hide", response_model=MessageResponse, summary="Hide or unhide", dependencies=[Depends(require_permission("community.edit"))])
async def toggle_hidden(post_id: str, me: dict = Depends(get_current_user)):
    oid = to_object_id(post_id)
    post = await _posts().find_one({"_id": oid})
    if not post:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That post doesn't exist")

    hiding = not post.get("hidden", False)
    await _posts().update_one({"_id": oid}, {"$set": {"hidden": hiding}})
    if hiding and post.get("user_id"):
        await notify(
            get_database(), post["user_id"],
            "One of your posts was hidden",
            "It didn't fit our community guidelines. Message us if you think that's wrong.",
            "account", "/app/circles",
        )
    await log_activity(me, "Moderated a post", "Community", target=post.get("author_name", ""))
    return {"message": "Post hidden" if hiding else "Post restored"}


@router.post("/posts/{post_id}/pin", response_model=MessageResponse, summary="Pin or unpin", dependencies=[Depends(require_permission("community.edit"))])
async def toggle_pinned(post_id: str, me: dict = Depends(get_current_user)):
    oid = to_object_id(post_id)
    post = await _posts().find_one({"_id": oid})
    if not post:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That post doesn't exist")
    pinning = not post.get("pinned", False)
    await _posts().update_one({"_id": oid}, {"$set": {"pinned": pinning}})
    return {"message": "Post pinned to the top" if pinning else "Post unpinned"}


# --- stories -----------------------------------------------------------------

@router.get("/stories", response_model=list[AdminStory], summary="Submitted stories")
async def list_stories(
    status_filter: str = Query("", alias="status", max_length=20),
    me: dict = Depends(get_current_user),
):
    query = {"status": status_filter} if status_filter else {}
    docs = await _stories().find(query).sort("created_at", -1).to_list(300)

    oids = []
    for d in docs:
        try:
            if d.get("user_id"):
                oids.append(ObjectId(d["user_id"]))
        except Exception:  # noqa: BLE001
            continue
    emails = {
        str(u["_id"]): u.get("email", "")
        for u in await _users().find({"_id": {"$in": oids}}, {"email": 1}).to_list(300)
    }

    return [
        AdminStory(
            **{
                k: v
                for k, v in StoryModel.to_response(d).items()
                if k not in ("liked_by_me", "mine", "cover", "author_avatar")
            },
            member_email=emails.get(d.get("user_id", ""), ""),
        )
        for d in docs
    ]


@router.patch("/stories/{story_id}", response_model=AdminStory, summary="Publish or decline", dependencies=[Depends(require_permission("community.approve"))])
async def decide_story(story_id: str, body: StoryDecision, me: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    updates: dict = {"status": body.status, "updated_at": now}
    if body.featured is not None:
        updates["featured"] = body.featured
    if body.status == StoryModel.STATUS_PUBLISHED:
        updates["published_at"] = now

    doc = await _stories().find_one_and_update(
        {"_id": to_object_id(story_id)}, {"$set": updates}, return_document=True
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That story doesn't exist")

    if doc.get("user_id"):
        if body.status == StoryModel.STATUS_PUBLISHED:
            await notify(
                get_database(), doc["user_id"],
                "Your story is live",
                "Thank you for sharing it. Other women are reading it now.",
                "account", f"/app/stories/{story_id}",
            )
        elif body.status == StoryModel.STATUS_DECLINED:
            await notify(
                get_database(), doc["user_id"],
                "About your story",
                "We couldn't publish this one. Message us and we'll explain — it's usually something small.",
                "account", "/app/stories",
            )

    await log_activity(me, "Reviewed a success story", "Community", target=doc.get("title", ""))
    return AdminStory(
        **{
            k: v
            for k, v in StoryModel.to_response(doc).items()
            if k not in ("liked_by_me", "mine", "cover", "author_avatar")
        },
        member_email="",
    )
