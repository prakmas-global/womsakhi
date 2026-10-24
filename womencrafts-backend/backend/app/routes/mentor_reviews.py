"""
Mentor reviews — what a mentor's page says about her, from sessions that
happened.

Every mentor's page used to show the same fixture reviews ("Sunita Devi…") and
the same past sessions, and the seed gave every mentor a rating between 4.6 and
4.9 that nobody had given. Here a learner rates a session once it is done
(status `closed`), once, and everything the page shows — the reviews, the
average, how many sessions she has given, how many women came back for a
second — is counted from those rows.

`mentor_reviews`: one per session (`request_id` unique), with the mentor, the
learner, a rating 1–5 and optional words. The mentor document's `rating`,
`rating_count` and `sessions_done` are kept in step on every write (the list
sorts on them) and recomputed once per process from the real rows, which is
what clears the invented seed figures.
"""

from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core import cache
from app.core.rbac import require_active_member
from app.db.mongodb import get_database
from app.models.growth import MentorModel, MentorshipRequestModel as REQ

router = APIRouter(prefix="/growth/mentors", tags=["Member · Learn"])

REVIEWS = "mentor_reviews"


def _db():
    return get_database()


def _oid(v: str) -> ObjectId:
    try:
        return ObjectId(v)
    except Exception:  # noqa: BLE001
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")


async def recompute(mentor_id: str) -> dict:
    """Rating, count, sessions given and women who came back — from real rows."""
    db = _db()
    rows = await db[REVIEWS].find({"mentor_id": mentor_id}, {"rating": 1}).to_list(5000)
    closed = await db[REQ.collection_name].find(
        {"mentor_id": mentor_id, "status": REQ.STATUS_CLOSED}, {"user_id": 1}).to_list(5000)
    per: dict[str, int] = {}
    for r in closed:
        per[r["user_id"]] = per.get(r["user_id"], 0) + 1
    stats = {
        "rating": round(sum(r["rating"] for r in rows) / len(rows), 1) if rows else 0.0,
        "rating_count": len(rows),
        "sessions_done": len(closed),
    }
    try:
        await db[MentorModel.collection_name].update_one({"_id": ObjectId(mentor_id)}, {"$set": stats})
    except Exception:  # noqa: BLE001
        pass
    return {**stats, "learners": len(per), "came_back": sum(1 for n in per.values() if n >= 2)}


_refreshed = False


async def refresh_all_once() -> None:
    """Once per process: replace any stored figure with the counted one."""
    global _refreshed
    if _refreshed:
        return
    _refreshed = True
    async for m in _db()[MentorModel.collection_name].find({}, {"_id": 1}):
        await recompute(str(m["_id"]))
    cache.forget("growth:mentors")


class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    text: str = Field(default="", max_length=500)


@router.post("/requests/{request_id}/review", status_code=201, summary="Rate a session that happened")
async def review_session(request_id: str, body: ReviewIn, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    req = await _db()[REQ.collection_name].find_one({"_id": _oid(request_id), "user_id": uid})
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That session is not yours.")
    if req.get("status") != REQ.STATUS_CLOSED:
        raise HTTPException(status.HTTP_409_CONFLICT, "You can rate a session once it has happened.")
    if await _db()[REVIEWS].find_one({"request_id": request_id}):
        raise HTTPException(status.HTTP_409_CONFLICT, "You have already rated this session.")
    now = datetime.now(timezone.utc)
    await _db()[REVIEWS].insert_one({
        "request_id": request_id, "mentor_id": req.get("mentor_id", ""), "user_id": uid,
        "first_name": (me.get("full_name") or "A member").split()[0],
        "rating": body.rating, "text": " ".join(body.text.split()), "created_at": now,
    })
    stats = await recompute(req.get("mentor_id", ""))
    cache.forget("growth:mentors")
    return {"ok": True, "rating": stats["rating"], "rating_count": stats["rating_count"]}


@router.get("/requests/reviewed", summary="Which of my sessions I have rated")
async def my_reviewed(me: dict = Depends(require_active_member)):
    rows = await _db()[REVIEWS].find({"user_id": str(me["_id"])}, {"request_id": 1, "rating": 1}).to_list(500)
    return {r["request_id"]: r["rating"] for r in rows}


@router.get("/{mentor_id}/reviews", summary="What women said after a session with her")
async def mentor_reviews(mentor_id: str, me: dict = Depends(require_active_member)):
    mentor = await _db()[MentorModel.collection_name].find_one({"_id": _oid(mentor_id), "status": "active"}, {"_id": 1})
    if not mentor:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That mentor isn't available")
    stats = await recompute(mentor_id)
    rows = await _db()[REVIEWS].find({"mentor_id": mentor_id}).sort("created_at", -1).to_list(50)
    return {
        **stats,
        "reviews": [{
            "first_name": r.get("first_name", "A member"),
            "rating": int(r.get("rating", 0)),
            "text": r.get("text", ""),
            "date": r["created_at"].strftime("%b %Y") if isinstance(r.get("created_at"), datetime) else "",
        } for r in rows],
    }
