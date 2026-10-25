"""
Her profile's evidence — what she made, and whom she helped.

The profile's "What you made" and "Helping others" tabs used to be fixtures:
"Bridal blouse, full work — sold for ₹1,800", "Women you taught: 4", the same
for every member. Buyers and employers were shown somebody else's history as
hers. This file is the real thing:

* **Portfolio** — photos of work she finished, with a title and, if she likes,
  who it was for and the year. Each item has its own `visible` switch: shown
  on her profile to other members, or kept for herself. At most 30.
* **Impact** — counted from what actually happened on WomSakhi: learners on the
  courses she teaches, mentoring sessions she finished, answers of hers a
  teacher marked right, circles she hosts, women she offered work to. Counted,
  never ranked.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from app.core.media import media_url
from app.core.rbac import require_active_member
from app.db.mongodb import get_database

router = APIRouter(prefix="/me/portfolio", tags=["Member"])

COLLECTION = "portfolio_items"
MAX_ITEMS = 30


def _items():
    return get_database()[COLLECTION]


def _now() -> datetime:
    return datetime.now(timezone.utc)


class PortfolioIn(BaseModel):
    title: str = Field(min_length=2, max_length=80)
    #: The URL the uploads API returned for the photo.
    photo: str = Field(min_length=1, max_length=600)
    #: A work category key (the work masters), optional.
    category: str = Field(default="", max_length=64)
    made_for: str = Field(default="", max_length=80)
    year: Optional[int] = None
    visible: bool = True

    @field_validator("photo")
    @classmethod
    def uploaded(cls, v: str) -> str:
        v = v.strip()
        if not (v.startswith("/") or v.startswith("https://") or v.startswith("http://")):
            raise ValueError("Add a photo from your phone first.")
        return v

    @field_validator("year")
    @classmethod
    def sane_year(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and not (1950 <= v <= _now().year):
            raise ValueError("Pick a year from the list.")
        return v


class PortfolioPatch(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=80)
    made_for: Optional[str] = Field(default=None, max_length=80)
    visible: Optional[bool] = None


def _row(d: dict) -> dict:
    created = d.get("created_at")
    return {
        "id": str(d["_id"]),
        "title": d.get("title", ""),
        "photo": media_url(d.get("photo", "")),
        "category": d.get("category", ""),
        "made_for": d.get("made_for", ""),
        "year": d.get("year"),
        "visible": bool(d.get("visible", True)),
        "added": created.strftime("%b %d, %Y") if isinstance(created, datetime) else "",
    }


@router.get("", summary="What I made")
async def my_portfolio(me: dict = Depends(require_active_member)):
    docs = await _items().find({"user_id": str(me["_id"])}).sort("created_at", -1).to_list(MAX_ITEMS)
    return [_row(d) for d in docs]


@router.post("", status_code=status.HTTP_201_CREATED, summary="Add something I made")
async def add_item(body: PortfolioIn, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    if await _items().count_documents({"user_id": uid}) >= MAX_ITEMS:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            f"You can keep {MAX_ITEMS} pieces. Remove one to add another.")
    doc = {
        "user_id": uid,
        "title": " ".join(body.title.split()),
        "photo": body.photo,
        "category": body.category.strip(),
        "made_for": " ".join(body.made_for.split()),
        "year": body.year,
        "visible": body.visible,
        "created_at": _now(),
        "updated_at": _now(),
    }
    doc["_id"] = (await _items().insert_one(doc)).inserted_id
    return _row(doc)


async def _mine(item_id: str, uid: str) -> dict:
    try:
        doc = await _items().find_one({"_id": ObjectId(item_id), "user_id": uid})
    except Exception:  # noqa: BLE001
        doc = None
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That piece is not in your portfolio.")
    return doc


@router.patch("/{item_id}", summary="Change a piece (title, shown or hidden)")
async def edit_item(item_id: str, body: PortfolioPatch, me: dict = Depends(require_active_member)):
    doc = await _mine(item_id, str(me["_id"]))
    patch = {k: (" ".join(v.split()) if isinstance(v, str) else v)
             for k, v in body.model_dump().items() if v is not None}
    if patch:
        await _items().update_one({"_id": doc["_id"]}, {"$set": {**patch, "updated_at": _now()}})
        doc.update(patch)
    return _row(doc)


@router.delete("/{item_id}", summary="Remove a piece")
async def delete_item(item_id: str, me: dict = Depends(require_active_member)):
    doc = await _mine(item_id, str(me["_id"]))
    await _items().delete_one({"_id": doc["_id"]})
    return {"ok": True}


@router.get("/of/{user_id}", summary="Another member's shown work")
async def member_portfolio(user_id: str, me: dict = Depends(require_active_member)):
    """Only the pieces she switched to shown — never the hidden ones."""
    try:
        oid = ObjectId(user_id)
    except Exception:  # noqa: BLE001
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    u = await get_database()["users"].find_one({"_id": oid, "verification_status": "active"}, {"full_name": 1})
    if not u:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    docs = await _items().find({"user_id": user_id, "visible": True}).sort("created_at", -1).to_list(MAX_ITEMS)
    return {"first_name": (u.get("full_name") or "A member").split()[0], "items": [_row(d) for d in docs]}


@router.get("/impact", summary="What I did for other women — counted")
async def impact(me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    db = get_database()

    courses, mentors, circles_hosted, posts = await asyncio.gather(
        db["programs"].find({"owner_id": uid}, {"_id": 1, "name": 1}).to_list(200),
        db["mentors"].find({"owner_id": uid}, {"_id": 1, "sessions_done": 1}).to_list(10),
        db["circle_members"].find({"user_id": uid, "role": "host"}, {"circle_id": 1}).to_list(200),
        db["opportunities"].find({"owner_id": uid}, {"_id": 1}).to_list(200),
    )
    course_ids = [str(c["_id"]) for c in courses]
    mentor_ids = [str(m["_id"]) for m in mentors]
    circle_ids = [c.get("circle_id", "") for c in circles_hosted if c.get("circle_id")]
    post_ids = [str(p["_id"]) for p in posts]

    learners, mentees, circle_people, hired, answers = await asyncio.gather(
        db["enrollments"].find(
            {"program_id": {"$in": course_ids}, "status": {"$in": ["active", "completed"]}, "user_id": {"$ne": uid}},
            {"user_id": 1, "status": 1}).to_list(5000) if course_ids else asyncio.sleep(0, []),
        db["mentorship_requests"].find(
            {"mentor_id": {"$in": mentor_ids}, "status": "closed"}, {"user_id": 1}).to_list(5000) if mentor_ids else asyncio.sleep(0, []),
        db["circle_members"].find(
            {"circle_id": {"$in": circle_ids}, "user_id": {"$ne": uid}}, {"user_id": 1}).to_list(5000) if circle_ids else asyncio.sleep(0, []),
        db["applications"].find(
            {"opportunity_id": {"$in": post_ids}, "status": "offered"}, {"user_id": 1}).to_list(5000) if post_ids else asyncio.sleep(0, []),
        db["course_questions"].aggregate([
            {"$unwind": "$answers"},
            {"$match": {"answers.user_id": uid}},
            {"$group": {"_id": None, "all": {"$sum": 1},
                        "verified": {"$sum": {"$cond": [{"$eq": ["$answers.verified", True]}, 1, 0]}}}},
        ]).to_list(1),
    )
    ans = (answers or [{}])[0]

    # "Women further along because of you" — each woman once, however she was helped.
    helped = {r["user_id"] for r in learners} | {r["user_id"] for r in mentees} | {r["user_id"] for r in hired}
    return {
        "women_helped": len(helped),
        "courses": len(course_ids),
        "learners": len({r["user_id"] for r in learners}),
        "finished_course": len({r["user_id"] for r in learners if r.get("status") == "completed"}),
        "mentoring_sessions": sum(int(m.get("sessions_done") or 0) for m in mentors),
        "mentees": len({r["user_id"] for r in mentees}),
        "answers": int(ans.get("all", 0)),
        "verified_answers": int(ans.get("verified", 0)),
        "circles_hosted": len(circle_ids),
        "circle_members": len({r["user_id"] for r in circle_people}),
        "women_hired": len({r["user_id"] for r in hired}),
        "is_teacher": bool(course_ids),
        "is_mentor": bool(mentor_ids),
    }
