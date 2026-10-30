"""
Rent & borrow — the API (rules, pricing and the booking steps: app/core/rentals.py).

Members (`/rentals`, verified only — every woman here has been checked):
  the board, one thing with its busy days and a price for chosen dates,
  her own things, and every step of a booking from both sides.
Staff (`/admin/rentals`, the market module): every listing and booking,
  hide a listing, and settle a raised problem.

Phones are never in a response. The two women talk in WomSakhi messages
(`MessageHer` on the screen) until one chooses to share a number there.
"""

from __future__ import annotations

import re
from datetime import date, datetime, timedelta, timezone
from typing import Literal, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, field_validator

from app.core import masters
from app.core import rentals as r
from app.core.audit import record
from app.core.deps import get_current_user
from app.core.media import MediaRef, media_url
from app.core.permissions import require_permission
from app.core.rbac import require_active_member
from app.db.mongodb import get_database
from app.engines import reminders as rem
from app.models.conversation import notify
from app.models.reminders import ReminderModel

router = APIRouter(prefix="/rentals", tags=["Member · Rent & borrow"])
admin_router = APIRouter(prefix="/admin/rentals", tags=["Staff · Rent & borrow"])

ITEMS, BOOKINGS, REVIEWS = "rental_items", "rental_bookings", "rental_reviews"
MAX_ITEMS = 40


def _db():
    return get_database()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _oid(v: str) -> ObjectId:
    try:
        return ObjectId(v)
    except Exception:  # noqa: BLE001
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")


def _first(u: Optional[dict]) -> str:
    return ((u or {}).get("full_name") or "A member").split()[0]


async def _users(ids: list[str]) -> dict[str, dict]:
    oids = [ObjectId(i) for i in set(ids) if ObjectId.is_valid(i)]
    return {str(u["_id"]): u for u in await _db()["users"].find(
        {"_id": {"$in": oids}}, {"full_name": 1, "avatar": 1, "verification_status": 1}).to_list(len(oids) or 1)}


async def _ratings(user_ids: list[str], about: str) -> dict[str, dict]:
    """Average stars a woman got, as an owner or as a renter — counted from real reviews."""
    rows = await _db()[REVIEWS].aggregate([
        {"$match": {"about_user_id": {"$in": list(set(user_ids))}, "about": about}},
        {"$group": {"_id": "$about_user_id", "avg": {"$avg": "$stars"}, "n": {"$sum": 1}}},
    ]).to_list(None)
    return {x["_id"]: {"stars": round(x["avg"], 1), "count": x["n"]} for x in rows}


# ── listing ──────────────────────────────────────────────────────────────────

class ItemIn(BaseModel):
    title: str = Field(min_length=3, max_length=80)
    category: str
    about: str = Field(default="", max_length=800)
    photos: list[MediaRef] = Field(min_length=1, max_length=r.MAX_PHOTOS)
    condition: Literal["like_new", "good", "used"] = "good"
    price_day_rupees: int = Field(ge=10, le=50_000)
    price_week_rupees: Optional[int] = Field(default=None, ge=10, le=3_00_000)
    deposit_rupees: int = Field(default=0, ge=0, le=5_00_000)
    min_days: int = Field(default=1, ge=1, le=30)
    max_days: int = Field(default=15, ge=1, le=r.MAX_DAYS)
    handover: Literal["pickup", "delivery", "either"] = "pickup"
    area: str = Field(default="", max_length=80)
    city: str = Field(min_length=2, max_length=60)
    rules: list[str] = Field(default_factory=list, max_length=8)

    @field_validator("title", "about", "area", "city")
    @classmethod
    def _tidy(cls, v: str) -> str:
        return " ".join((v or "").split())

    @field_validator("rules")
    @classmethod
    def _rules(cls, v: list[str]) -> list[str]:
        return [" ".join(x.split())[:80] for x in v if x.strip()]


def _item_doc(body: ItemIn) -> dict:
    if body.max_days < body.min_days:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "The longest rental cannot be shorter than the shortest.")
    if body.price_week_rupees and body.price_week_rupees >= body.price_day_rupees * 7:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "A weekly price should be less than seven days' rent.")
    return {
        "title": body.title, "about": body.about, "photos": body.photos, "condition": body.condition,
        "price_day_minor": body.price_day_rupees * 100,
        "price_week_minor": (body.price_week_rupees or 0) * 100,
        "deposit_minor": body.deposit_rupees * 100, "min_days": body.min_days, "max_days": body.max_days,
        "handover": body.handover, "area": body.area, "city": body.city, "rules": body.rules,
    }


async def _busy(item_id: str) -> list[dict]:
    """Held dates: from yes to back."""
    rows = await _db()[BOOKINGS].find({"item_id": item_id, "status": {"$in": list(r.HOLDING)}},
                                      {"start": 1, "end": 1}).to_list(500)
    return sorted(({"start": b["start"], "end": b["end"]} for b in rows), key=lambda x: x["start"])


def _card(d: dict, owner: Optional[dict], rating: Optional[dict], me: str) -> dict:
    return {
        "id": str(d["_id"]), "title": d["title"], "category": d["category"],
        "photo": media_url((d.get("photos") or [""])[0]), "condition": d.get("condition", "good"),
        "price_day_minor": d["price_day_minor"], "price_week_minor": d.get("price_week_minor", 0),
        "deposit_minor": d.get("deposit_minor", 0), "area": d.get("area", ""), "city": d.get("city", ""),
        "handover": d.get("handover", "pickup"), "status": d.get("status", "live"),
        "owner": {"id": d["owner_id"], "first_name": _first(owner), "avatar": media_url((owner or {}).get("avatar", "")),
                  "stars": (rating or {}).get("stars"), "reviews": (rating or {}).get("count", 0)},
        "mine": d["owner_id"] == me, "times_rented": d.get("times_rented", 0),
    }


@router.get("", summary="Things to rent")
async def board(q: str = Query("", max_length=60), category: str = Query("", max_length=60),
                city: str = Query("", max_length=60), mine: bool = False, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    find: dict = {"owner_id": uid, "status": {"$ne": "removed"}} if mine else \
        {"status": "live", "hidden": {"$ne": True}, "owner_id": {"$ne": uid}}
    if category.strip():
        find["category"] = category.strip()
    if q.strip():
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        find["$or"] = [{"title": rx}, {"about": rx}, {"category": rx}]
    docs = await _db()[ITEMS].find(find).sort("created_at", -1).to_list(300)
    users = await _users([d["owner_id"] for d in docs])
    ratings = await _ratings([d["owner_id"] for d in docs], "owner")
    here = (city or "").strip().lower()
    cards = [_card(d, users.get(d["owner_id"]), ratings.get(d["owner_id"]), uid) for d in docs]
    if mine:
        # Her own list says when staff have hidden one, and why — nobody else's does.
        for c, d in zip(cards, docs):
            c["hidden"], c["hidden_reason"] = bool(d.get("hidden")), d.get("hidden_reason", "")
    # Her own town first — a lehenga three cities away is not one she can borrow.
    if here and not mine:
        cards.sort(key=lambda c: c["city"].lower() != here)
    return cards


@router.get("/{item_id}", summary="One thing, its busy days, and its owner")
async def get_item(item_id: str, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    d = await _db()[ITEMS].find_one({"_id": _oid(item_id)})
    if not d or d.get("status") == "removed" or (d.get("hidden") and d["owner_id"] != uid):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That is not available any more.")
    owner = (await _users([d["owner_id"]])).get(d["owner_id"])
    rating = (await _ratings([d["owner_id"]], "owner")).get(d["owner_id"])
    reviews = await _db()[REVIEWS].find({"about_user_id": d["owner_id"], "about": "owner"}).sort("created_at", -1).to_list(5)
    mine = await _db()[BOOKINGS].find({"item_id": item_id, "renter_id": uid, "status": {"$in": list(r.OPEN)}}).to_list(5)
    return {
        **_card(d, owner, rating, uid),
        "photos": [media_url(p) for p in d.get("photos", [])], "about": d.get("about", ""),
        "min_days": d.get("min_days", 1), "max_days": d.get("max_days", r.MAX_DAYS), "rules": d.get("rules", []),
        "busy": await _busy(item_id), "hidden": bool(d.get("hidden")),
        # Only she is told why staff hid it — and only she can open it while hidden.
        "hidden_reason": d.get("hidden_reason", "") if d["owner_id"] == uid else "",
        "reviews": [{"stars": x["stars"], "praise": x.get("praise", []), "text": x.get("text", ""),
                     "by": x.get("by_name", ""), "on": x["created_at"].strftime("%b %Y")} for x in reviews],
        "my_bookings": [str(b["_id"]) for b in mine],
    }


@router.post("", status_code=status.HTTP_201_CREATED, summary="Rent something out")
async def add_item(body: ItemIn, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    if await _db()[ITEMS].count_documents({"owner_id": uid, "status": {"$ne": "removed"}}) >= MAX_ITEMS:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, f"You can rent out {MAX_ITEMS} things at a time.")
    category = await masters.check("rental_categories", body.category, field="category")
    doc = {"owner_id": uid, **_item_doc(body), "category": category, "status": "live", "hidden": False,
           "times_rented": 0, "created_at": _now(), "updated_at": _now()}
    doc["_id"] = (await _db()[ITEMS].insert_one(doc)).inserted_id
    return await get_item(str(doc["_id"]), me)


async def _own_item(item_id: str, uid: str) -> dict:
    d = await _db()[ITEMS].find_one({"_id": _oid(item_id), "owner_id": uid, "status": {"$ne": "removed"}})
    if not d:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That is not one of your things.")
    return d


@router.put("/{item_id}", summary="Change my listing")
async def edit_item(item_id: str, body: ItemIn, me: dict = Depends(require_active_member)):
    d = await _own_item(item_id, str(me["_id"]))
    category = await masters.check("rental_categories", body.category, field="category")
    await _db()[ITEMS].update_one({"_id": d["_id"]}, {"$set": {**_item_doc(body), "category": category, "updated_at": _now()}})
    return await get_item(item_id, me)


class ItemState(BaseModel):
    status: Literal["live", "paused"]


@router.patch("/{item_id}", summary="Pause or show my listing")
async def pause_item(item_id: str, body: ItemState, me: dict = Depends(require_active_member)):
    d = await _own_item(item_id, str(me["_id"]))
    await _db()[ITEMS].update_one({"_id": d["_id"]}, {"$set": {"status": body.status, "updated_at": _now()}})
    return await get_item(item_id, me)


@router.delete("/{item_id}", summary="Take my listing down")
async def remove_item(item_id: str, me: dict = Depends(require_active_member)):
    d = await _own_item(item_id, str(me["_id"]))
    if await _db()[BOOKINGS].count_documents({"item_id": item_id, "status": {"$in": list(r.HOLDING)}}):
        raise HTTPException(status.HTTP_409_CONFLICT, "Someone has it booked or has it now. Finish that rental first.")
    await _db()[ITEMS].update_one({"_id": d["_id"]}, {"$set": {"status": "removed", "updated_at": _now()}})
    # Open requests for it cannot happen now; say so rather than leave them hanging.
    async for b in _db()[BOOKINGS].find({"item_id": item_id, "status": r.REQUESTED}):
        await _move(b, r.DECLINED, "Taken down", by="owner", note="She is no longer renting this out.")
    return {"ok": True}


@router.get("/{item_id}/quote", summary="What these dates would cost")
async def get_quote(item_id: str, start: date, end: date, me: dict = Depends(require_active_member)):
    d = await _db()[ITEMS].find_one({"_id": _oid(item_id), "status": "live"})
    if not d:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That is not available any more.")
    problem = r.check_dates(d, start, end)
    clash = any(r.overlaps(start.isoformat(), end.isoformat(), b["start"], b["end"]) for b in await _busy(item_id))
    return {**r.quote(d, start, end), "ok": not problem and not clash,
            "problem": problem or ("Someone has it on some of those days." if clash else "")}


# ── bookings ─────────────────────────────────────────────────────────────────

class BookIn(BaseModel):
    start: date
    end: date
    note: str = Field(default="", max_length=300)


def _booking(b: dict, item: Optional[dict], people: dict[str, dict], uid: str, ratings: dict) -> dict:
    side = "owner" if b["owner_id"] == uid else "renter"
    other = b["renter_id"] if side == "owner" else b["owner_id"]
    reviewed = b.get("reviewed", {})
    return {
        "id": str(b["_id"]), "status": b["status"], "side": side,
        "item": {"id": b["item_id"], "title": (item or {}).get("title") or b.get("item_title", ""),
                 "photo": media_url(((item or {}).get("photos") or [b.get("item_photo", "")])[0]),
                 "category": (item or {}).get("category", "")},
        "with": {"id": other, "first_name": _first(people.get(other)), "avatar": media_url(people.get(other, {}).get("avatar", "")),
                 # The owner deciding sees how the renter has looked after other women's things.
                 "stars": ratings.get(other, {}).get("stars"), "reviews": ratings.get(other, {}).get("count", 0)},
        "start": b["start"], "end": b["end"], "days": b["days"],
        "rent_minor": b["rent_minor"], "deposit_minor": b["deposit_minor"], "note": b.get("note", ""),
        "rent_paid": bool(b.get("rent_paid")), "deposit_paid": bool(b.get("deposit_paid")),
        "condition_out": b.get("condition_out", ""), "photos_out": [media_url(p) for p in b.get("photos_out", [])],
        "condition_back": b.get("condition_back", ""), "deduction_minor": b.get("deduction_minor", 0),
        "deduction_note": b.get("deduction_note", ""), "photos_back": [media_url(p) for p in b.get("photos_back", [])],
        "deposit_back_minor": max(0, b["deposit_minor"] - b.get("deduction_minor", 0)),
        "problem": b.get("problem", ""), "problem_settled": b.get("problem_settled", ""),
        "reason": b.get("reason", ""),
        "i_reviewed": bool(reviewed.get(side)), "they_reviewed": bool(reviewed.get("renter" if side == "owner" else "owner")),
        "history": [{"status": h["status"], "at": h["at"].isoformat(), "by": h.get("by", ""), "note": h.get("note", "")}
                    for h in b.get("history", [])],
        "created_at": b["created_at"].isoformat(),
    }


async def _view(b: dict, uid: str) -> dict:
    item = await _db()[ITEMS].find_one({"_id": ObjectId(b["item_id"])}) if ObjectId.is_valid(b["item_id"]) else None
    people = await _users([b["owner_id"], b["renter_id"]])
    other = b["renter_id"] if b["owner_id"] == uid else b["owner_id"]
    ratings = await _ratings([other], "renter" if b["owner_id"] == uid else "owner")
    return _booking(b, item, people, uid, ratings)


async def _mine(booking_id: str, uid: str, side: Optional[str] = None) -> dict:
    b = await _db()[BOOKINGS].find_one({"_id": _oid(booking_id)})
    if not b or uid not in (b["owner_id"], b["renter_id"]):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That booking is not here.")
    if side == "owner" and b["owner_id"] != uid:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the owner can do this.")
    if side == "renter" and b["renter_id"] != uid:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the renter can do this.")
    return await _expire(b)


async def _expire(b: dict) -> dict:
    """A request nobody answered before its first day lapses — it should not sit there forever."""
    if b["status"] == r.REQUESTED and b["start"] < date.today().isoformat():
        return await _move(b, r.EXPIRED, "No answer in time", by="", note="She did not answer before the first day.")
    return b


async def _move(b: dict, to: str, label: str, *, by: str, note: str = "", sets: Optional[dict] = None) -> dict:
    now = _now()
    fresh = await _db()[BOOKINGS].find_one_and_update(
        {"_id": b["_id"]},
        {"$set": {"status": to, "updated_at": now, **(sets or {})},
         "$push": {"history": {"status": to, "at": now, "by": by, "note": note or label}}},
        return_document=True)
    await _remind(fresh)
    await _sync_book(fresh)
    return fresh


def _need(b: dict, *states: str) -> None:
    if b["status"] not in states:
        raise HTTPException(status.HTTP_409_CONFLICT, f"This booking is {b['status']} — that step is not open now.")


async def _held_clash(b: dict) -> bool:
    return any(r.overlaps(b["start"], b["end"], x["start"], x["end"]) for x in await _db()[BOOKINGS].find(
        {"item_id": b["item_id"], "status": {"$in": list(r.HOLDING)}, "_id": {"$ne": b["_id"]}},
        {"start": 1, "end": 1}).to_list(500))


@router.post("/{item_id}/book", status_code=status.HTTP_201_CREATED, summary="Ask to rent it for these dates")
async def book(item_id: str, body: BookIn, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    d = await _db()[ITEMS].find_one({"_id": _oid(item_id), "status": "live", "hidden": {"$ne": True}})
    if not d:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That is not available any more.")
    if d["owner_id"] == uid:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This is yours.")
    if problem := r.check_dates(d, body.start, body.end):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, problem)
    s, e = body.start.isoformat(), body.end.isoformat()
    if any(r.overlaps(s, e, x["start"], x["end"]) for x in await _busy(item_id)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Someone has it on some of those days. Pick other days.")
    if await _db()[BOOKINGS].count_documents({"item_id": item_id, "renter_id": uid, "status": r.REQUESTED}):
        raise HTTPException(status.HTTP_409_CONFLICT, "You have already asked for this. Wait for her answer, or cancel that request.")
    qt = r.quote(d, body.start, body.end)
    now = _now()
    doc = {"item_id": item_id, "owner_id": d["owner_id"], "renter_id": uid, "item_title": d["title"],
           "item_photo": (d.get("photos") or [""])[0], "start": s, "end": e, "days": qt["days"],
           "rent_minor": qt["rent_minor"], "deposit_minor": qt["deposit_minor"], "note": " ".join(body.note.split()),
           "status": r.REQUESTED, "history": [{"status": r.REQUESTED, "at": now, "by": "renter", "note": "Asked to rent"}],
           "created_at": now, "updated_at": now}
    doc["_id"] = (await _db()[BOOKINGS].insert_one(doc)).inserted_id
    await notify(_db(), d["owner_id"], title=f"{_first(me)} wants to rent your {d['title']}",
                 body=f"{s} to {e} · ₹{qt['rent_minor'] // 100:,} rent. Say yes or no in Rent & borrow.",
                 ntype="booking", href=f"/app/rent/bookings/{doc['_id']}")
    return await _view(doc, uid)


@router.get("/bookings/mine", summary="My bookings — what I rent, and what is rented from me")
async def my_bookings(side: Literal["renter", "owner", "all"] = "all", me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    find = {"renter_id": uid} if side == "renter" else {"owner_id": uid} if side == "owner" else \
        {"$or": [{"renter_id": uid}, {"owner_id": uid}]}
    docs = [await _expire(b) for b in await _db()[BOOKINGS].find(find).sort("created_at", -1).to_list(300)]
    items = {str(i["_id"]): i for i in await _db()[ITEMS].find(
        {"_id": {"$in": [ObjectId(b["item_id"]) for b in docs if ObjectId.is_valid(b["item_id"])]}}).to_list(300)}
    people = await _users([x for b in docs for x in (b["owner_id"], b["renter_id"])])
    renters = await _ratings([b["renter_id"] for b in docs if b["owner_id"] == uid], "renter")
    owners = await _ratings([b["owner_id"] for b in docs if b["renter_id"] == uid], "owner")
    return [_booking(b, items.get(b["item_id"]), people, uid, {**owners, **renters}) for b in docs]


@router.get("/bookings/{booking_id}", summary="One booking")
async def get_booking(booking_id: str, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    return await _view(await _mine(booking_id, uid), uid)


class ReasonIn(BaseModel):
    reason: str = Field(default="", max_length=300)


@router.post("/bookings/{booking_id}/accept", summary="Yes — hold these dates for her")
async def accept(booking_id: str, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    b = await _mine(booking_id, uid, "owner")
    _need(b, r.REQUESTED)
    if await _held_clash(b):
        raise HTTPException(status.HTTP_409_CONFLICT, "You have already said yes to someone for some of these days.")
    b = await _move(b, r.ACCEPTED, "Accepted", by="owner")
    await notify(_db(), b["renter_id"], title=f"Yes! {_first(me)} will rent you the {b['item_title']}",
                 body=f"Pick it up on {b['start']}. Pay the rent and deposit when you have it in your hands — not before.",
                 ntype="booking", href=f"/app/rent/bookings/{booking_id}")
    return await _view(b, uid)


@router.post("/bookings/{booking_id}/decline", summary="No, not this time")
async def decline(booking_id: str, body: ReasonIn, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    b = await _mine(booking_id, uid, "owner")
    _need(b, r.REQUESTED)
    b = await _move(b, r.DECLINED, "Declined", by="owner", note=body.reason.strip(), sets={"reason": body.reason.strip()})
    await notify(_db(), b["renter_id"], title=f"{_first(me)} cannot rent you the {b['item_title']} this time",
                 body=body.reason.strip() or "Try other dates, or something similar.", ntype="booking",
                 href=f"/app/rent/bookings/{booking_id}")
    return await _view(b, uid)


@router.post("/bookings/{booking_id}/cancel", summary="Call it off — before it is handed over")
async def cancel(booking_id: str, body: ReasonIn, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    b = await _mine(booking_id, uid)
    _need(b, r.REQUESTED, r.ACCEPTED)
    side = "owner" if b["owner_id"] == uid else "renter"
    b = await _move(b, r.CANCELLED, "Cancelled", by=side, note=body.reason.strip(), sets={"reason": body.reason.strip()})
    other = b["renter_id"] if side == "owner" else b["owner_id"]
    await notify(_db(), other, title=f"{_first(me)} cancelled the rental of the {b['item_title']}",
                 body=body.reason.strip() or f"{b['start']} to {b['end']}.", ntype="booking", href=f"/app/rent/bookings/{booking_id}")
    return await _view(b, uid)


class HandoverIn(BaseModel):
    rent_paid: bool
    deposit_paid: bool
    condition: Literal["like_new", "good", "used"] = "good"
    photos: list[MediaRef] = Field(default_factory=list, max_length=4)
    note: str = Field(default="", max_length=300)


@router.post("/bookings/{booking_id}/handover", summary="Handed over — and what I received")
async def handover(booking_id: str, body: HandoverIn, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    b = await _mine(booking_id, uid, "owner")
    _need(b, r.ACCEPTED)
    if b["start"] > (date.today() + timedelta(days=1)).isoformat():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Hand it over on or just before {b['start']}.")
    b = await _move(b, r.ACTIVE, "Handed over", by="owner", note=body.note.strip(), sets={
        "rent_paid": body.rent_paid, "deposit_paid": body.deposit_paid or not b["deposit_minor"],
        "condition_out": body.condition, "photos_out": body.photos, "handed_at": _now()})
    await _db()[ITEMS].update_one({"_id": ObjectId(b["item_id"])}, {"$inc": {"times_rented": 1}})
    await notify(_db(), b["renter_id"], title=f"You have the {b['item_title']}",
                 body=f"Bring it back by {b['end']}. Your deposit comes back when it does.", ntype="booking",
                 href=f"/app/rent/bookings/{booking_id}")
    return await _view(b, uid)


class ReturnIn(BaseModel):
    condition: Literal["fine", "damaged", "lost"]
    deduction_rupees: int = Field(default=0, ge=0)
    note: str = Field(default="", max_length=300)
    photos: list[MediaRef] = Field(default_factory=list, max_length=4)
    rent_paid: bool = True


@router.post("/bookings/{booking_id}/return", summary="It is back — its condition, and the deposit")
async def returned(booking_id: str, body: ReturnIn, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    b = await _mine(booking_id, uid, "owner")
    _need(b, r.ACTIVE)
    deduction = body.deduction_rupees * 100
    if deduction > b["deposit_minor"]:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "You cannot keep more than the deposit.")
    if deduction and not body.note.strip():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Say what was wrong, so she understands what you kept.")
    if body.condition == "fine" and deduction:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "If it came back fine, return the whole deposit.")
    nothing_back = b["deposit_minor"] - deduction <= 0
    sets = {"condition_back": body.condition, "deduction_minor": deduction, "deduction_note": body.note.strip(),
            "photos_back": body.photos, "rent_paid": body.rent_paid or b.get("rent_paid", False), "returned_at": _now()}
    # With no deposit to give back there is nothing left to confirm.
    b = await _move(b, r.CLOSED if nothing_back else r.RETURNED, "Returned", by="owner", note=body.note.strip(), sets=sets)
    back = b["deposit_minor"] - deduction
    await notify(_db(), b["renter_id"], title=f"The {b['item_title']} is back with {_first(me)}",
                 body=(f"₹{back // 100:,} of your deposit comes back to you" + (f" (she kept ₹{deduction // 100:,}: {body.note.strip()})" if deduction else "") + ".")
                 if b["deposit_minor"] else "Thank you. Leave her a few words.",
                 ntype="booking", href=f"/app/rent/bookings/{booking_id}")
    return await _view(b, uid)


@router.post("/bookings/{booking_id}/deposit-back", summary="I got my deposit back")
async def deposit_back(booking_id: str, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    b = await _mine(booking_id, uid, "renter")
    _need(b, r.RETURNED)
    b = await _move(b, r.CLOSED, "Deposit back", by="renter")
    await notify(_db(), b["owner_id"], title=f"{_first(me)} got her deposit back — all settled",
                 body=f"The {b['item_title']} rental is closed. Leave her a few words.", ntype="booking",
                 href=f"/app/rent/bookings/{booking_id}")
    return await _view(b, uid)


class ProblemIn(BaseModel):
    text: str = Field(min_length=5, max_length=600)


@router.post("/bookings/{booking_id}/problem", summary="Something is not right — tell WomSakhi")
async def problem(booking_id: str, body: ProblemIn, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    b = await _mine(booking_id, uid)
    _need(b, r.ACTIVE, r.RETURNED, r.CLOSED)
    side = "owner" if b["owner_id"] == uid else "renter"
    await _db()[BOOKINGS].update_one({"_id": b["_id"]}, {"$set": {
        "problem": f"{side}: {' '.join(body.text.split())}", "problem_at": _now(), "problem_settled": ""},
        "$push": {"history": {"status": "problem", "at": _now(), "by": side, "note": body.text.strip()}}})
    other = b["renter_id"] if side == "owner" else b["owner_id"]
    await notify(_db(), other, title=f"{_first(me)} raised a problem about the {b['item_title']}",
                 body="Our team will look at it with both of you.", ntype="booking", href=f"/app/rent/bookings/{booking_id}")
    return await get_booking(booking_id, me)


class ReviewIn(BaseModel):
    stars: int = Field(ge=1, le=5)
    praise: list[str] = Field(default_factory=list, max_length=5)
    text: str = Field(default="", max_length=400)


@router.post("/bookings/{booking_id}/review", status_code=status.HTTP_201_CREATED, summary="Say how it went")
async def review(booking_id: str, body: ReviewIn, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    b = await _mine(booking_id, uid)
    _need(b, r.RETURNED, r.CLOSED)
    side = "owner" if b["owner_id"] == uid else "renter"
    if (b.get("reviewed") or {}).get(side):
        raise HTTPException(status.HTTP_409_CONFLICT, "You have already said how it went.")
    allowed = r.PRAISE_FOR_RENTER if side == "owner" else r.PRAISE_FOR_OWNER
    await _db()[REVIEWS].insert_one({
        "booking_id": booking_id, "item_id": b["item_id"], "by_user_id": uid, "by_name": _first(me),
        # The renter reviews the owner, the owner reviews the renter.
        "about_user_id": b["renter_id"] if side == "owner" else b["owner_id"], "about": "renter" if side == "owner" else "owner",
        "stars": body.stars, "praise": [p for p in body.praise if p in allowed], "text": " ".join(body.text.split()),
        "created_at": _now()})
    await _db()[BOOKINGS].update_one({"_id": b["_id"]}, {"$set": {f"reviewed.{side}": True}})
    return await get_booking(booking_id, me)


@router.get("/meta/praise", summary="The words each side can pick")
async def praise_words(_: dict = Depends(require_active_member)):
    return {"for_owner": list(r.PRAISE_FOR_OWNER), "for_renter": list(r.PRAISE_FOR_RENTER)}


# ── reminders and the money book ─────────────────────────────────────────────

async def _remind(b: dict) -> None:
    """Pickup day for the renter; return day for both. Gone once it is back or off."""
    ref = str(b["_id"])
    try:
        from app.engines.wiring import _at_local, _tz_of
        if b["status"] in (r.ACCEPTED, r.ACTIVE):
            plan = [(b["renter_id"], "rent.pickupToday", b["start"], "09:00")] if b["status"] == r.ACCEPTED else []
            if b["status"] == r.ACTIVE:
                day_before = (date.fromisoformat(b["end"]) - timedelta(days=1)).isoformat()
                plan += [(b["renter_id"], "rent.returnTomorrow", day_before, "10:00"),
                         (b["owner_id"], "rent.comesBackToday", b["end"], "10:00")]
            for uid, key, day, hhmm in plan:
                if day < date.today().isoformat():
                    continue
                tz = await _tz_of(uid)
                await rem.ensure(user_id=uid, module="rentals", ref=ref, title_key=key,
                                 schedule_type=ReminderModel.SCHEDULE_ONCE, tz=tz, category="orders",
                                 klass=ReminderModel.CLASS_TRANSACTIONAL, at=_at_local(date.fromisoformat(day), hhmm, tz),
                                 payload={"title": b.get("item_title", ""), "booking": ref})
        if b["status"] not in (r.ACCEPTED, r.ACTIVE):
            await rem.reconcile(module="rentals", ref=ref, event="completed")
    except Exception:  # noqa: BLE001 — a reminder must never undo the step she just took
        pass


async def _sync_book(b: dict) -> None:
    """
    Once it is back, the rent (and anything kept from the deposit) goes into
    both women's My Khata: money in for the owner, money out for the renter.
    Rewritten whole, so a corrected return never leaves a stale line.
    """
    bid = str(b["_id"])
    await _db()["khata_entries"].delete_many({"booking_id": bid, "source": "rental"})
    if b["status"] not in (r.RETURNED, r.CLOSED) or not b.get("rent_paid"):
        return
    amount = b["rent_minor"] + b.get("deduction_minor", 0)
    day = (b.get("returned_at") or _now()).date().isoformat()
    now = _now()
    note = b.get("item_title", "Rental") + (" (incl. deposit kept)" if b.get("deduction_minor") else "")
    await _db()["khata_entries"].insert_many([
        {"user_id": b["owner_id"], "kind": "in", "amount_minor": amount, "category": "rent_earned", "note": f"Rented out: {note}",
         "on": day, "source": "rental", "booking_id": bid, "created_at": now, "updated_at": now},
        {"user_id": b["renter_id"], "kind": "out", "amount_minor": amount, "category": "rent_paid", "note": f"Rented: {note}",
         "on": day, "source": "rental", "booking_id": bid, "created_at": now, "updated_at": now},
    ])


# ── staff ────────────────────────────────────────────────────────────────────

@admin_router.get("/items", summary="Every listing", dependencies=[Depends(require_permission("market.view"))])
async def admin_items(q: str = Query("", max_length=60), _: dict = Depends(get_current_user)):
    find: dict = {"status": {"$ne": "removed"}}
    if q.strip():
        find["title"] = {"$regex": re.escape(q.strip()), "$options": "i"}
    docs = await _db()[ITEMS].find(find).sort("created_at", -1).to_list(500)
    users = await _users([d["owner_id"] for d in docs])
    return [{**_card(d, users.get(d["owner_id"]), None, ""), "owner_name": (users.get(d["owner_id"]) or {}).get("full_name", ""),
             "hidden": bool(d.get("hidden")), "hidden_reason": d.get("hidden_reason", "")} for d in docs]


class HideIn(BaseModel):
    hidden: bool
    reason: str = Field(default="", max_length=300)


@admin_router.patch("/items/{item_id}", summary="Hide or show a listing", dependencies=[Depends(require_permission("market.edit"))])
async def admin_hide(item_id: str, body: HideIn, request: Request, me: dict = Depends(get_current_user)):
    d = await _db()[ITEMS].find_one({"_id": _oid(item_id)})
    if not d:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    if body.hidden and not body.reason.strip():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Say why — she will be told.")
    await _db()[ITEMS].update_one({"_id": d["_id"]}, {"$set": {"hidden": body.hidden, "hidden_reason": body.reason.strip(), "updated_at": _now()}})
    await record(me, "rentals.hide" if body.hidden else "rentals.unhide", target=item_id, detail=body.reason.strip(), request=request)
    await notify(_db(), d["owner_id"], title=f"Your {d['title']} is {'hidden from' if body.hidden else 'back on'} Rent & borrow",
                 body=body.reason.strip() or "Thank you.", ntype="account", href="/app/rent/mine")
    return {"ok": True}


@admin_router.get("/bookings", summary="Bookings — problems first", dependencies=[Depends(require_permission("market.view"))])
async def admin_bookings(problems: bool = False, _: dict = Depends(get_current_user)):
    find: dict = {"problem": {"$nin": ["", None]}} if problems else {}
    docs = await _db()[BOOKINGS].find(find).sort("updated_at", -1).to_list(500)
    users = await _users([x for b in docs for x in (b["owner_id"], b["renter_id"])])
    return [{"id": str(b["_id"]), "item_title": b.get("item_title", ""), "status": b["status"], "start": b["start"], "end": b["end"],
             "rent_minor": b["rent_minor"], "deposit_minor": b["deposit_minor"], "deduction_minor": b.get("deduction_minor", 0),
             "owner": (users.get(b["owner_id"]) or {}).get("full_name", ""), "renter": (users.get(b["renter_id"]) or {}).get("full_name", ""),
             "problem": b.get("problem", ""), "problem_settled": b.get("problem_settled", ""),
             "history": [{"status": h["status"], "at": h["at"].isoformat(), "by": h.get("by", ""), "note": h.get("note", "")} for h in b.get("history", [])],
             } for b in docs]


class SettleIn(BaseModel):
    note: str = Field(min_length=5, max_length=500)


@admin_router.post("/bookings/{booking_id}/settle", summary="Settle a raised problem", dependencies=[Depends(require_permission("market.approve"))])
async def admin_settle(booking_id: str, body: SettleIn, request: Request, me: dict = Depends(get_current_user)):
    b = await _db()[BOOKINGS].find_one({"_id": _oid(booking_id)})
    if not b or not b.get("problem"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No problem raised on that booking.")
    await _db()[BOOKINGS].update_one({"_id": b["_id"]}, {"$set": {"problem_settled": body.note.strip(), "updated_at": _now()},
                                                          "$push": {"history": {"status": "settled", "at": _now(), "by": "WomSakhi", "note": body.note.strip()}}})
    await record(me, "rentals.settle", target=booking_id, detail=body.note.strip(), request=request)
    for uid in (b["owner_id"], b["renter_id"]):
        await notify(_db(), uid, title=f"WomSakhi looked into the {b.get('item_title', 'rental')}", body=body.note.strip(),
                     ntype="booking", href=f"/app/rent/bookings/{booking_id}")
    return {"ok": True}
