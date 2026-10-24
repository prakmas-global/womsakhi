"""
Mentoring — a verified member who mentors, and "Your services".

Any verified member can become a mentor: she writes a short profile (what she
helps with, how she meets, how long, free or a price per session) and it goes
live in Mentors at once — no approval. Requests come to HER, not to staff:

    pending   → she accepts with a time and how to meet, or declines with a note
    accepted  → free: the learner sees how to meet straight away
                paid: the learner pays her by UPI and taps "I've paid"; she
                confirms, and only then is the meeting detail shown
    closed    → she marks the session done; it counts on her profile

A confirmed payment goes into her income book (via "mentoring"), the same way a
course payment does. WomSakhi never holds the money (routes/market.py).

`/services/me` is the hub: seller, teacher, mentor — what she has switched on,
and the next step for each.
"""

import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator, model_validator

from app.core import cache
from app.core.rbac import require_active_member
from app.core.serializers import to_object_id
from app.db.mongodb import get_database
from app.models.books import BookEntryModel
from app.models.conversation import notify
from app.models.growth import MentorModel, MentorshipRequestModel
from app.models.payout import PayoutAccountModel
from app.models.program import ProgramModel

router = APIRouter(tags=["Member"])

UPI_ID = re.compile(r"^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9]{1,63}$")
MODES = ("Video call", "Phone call", "In person")
REQ = MentorshipRequestModel


def _mentors():
    return get_database()[MentorModel.collection_name]


def _requests():
    return get_database()[MentorshipRequestModel.collection_name]


# ── her mentor profile ──────────────────────────────────────────────────────


class MentorIn(BaseModel):
    headline: str = Field(min_length=8, max_length=120)
    bio: str = Field(min_length=30, max_length=1500)
    expertise: list[str] = Field(min_length=1, max_length=8)
    languages: list[str] = Field(min_length=1, max_length=6)
    experience_years: int = Field(0, ge=0, le=60)
    location: str = Field("", max_length=80)
    availability: str = Field("", max_length=120)
    session_mode: str = "Video call"
    session_minutes: int = Field(30, ge=10, le=180)
    #: Whole rupees per session. 0 is free.
    price_rupees: int = Field(0, ge=0, le=20_000)
    upi_id: str = Field("", max_length=300)

    @field_validator("headline", "bio", "location", "availability", "upi_id")
    @classmethod
    def _strip(cls, v: str) -> str:
        return (v or "").strip()

    @field_validator("expertise", "languages")
    @classmethod
    def _tags(cls, v: list[str]) -> list[str]:
        out = []
        for t in v:
            t = (t or "").strip()[:40]
            if t and t.lower() not in {o.lower() for o in out}:
                out.append(t)
        if not out:
            raise ValueError("Add at least one")
        return out

    @field_validator("session_mode")
    @classmethod
    def _mode(cls, v: str) -> str:
        if v not in MODES:
            raise ValueError("Choose video call, phone call or in person")
        return v

    @model_validator(mode="after")
    def _price(self):
        if 0 < self.price_rupees < 10:
            raise ValueError("A paid session costs at least ₹10")
        if self.price_rupees and not UPI_ID.match(self.upi_id):
            raise ValueError("Add the UPI ID learners should pay, like name@okaxis")
        return self


class MentorProfile(BaseModel):
    id: str
    live: bool
    headline: str
    bio: str
    expertise: list[str]
    languages: list[str]
    experience_years: int
    location: str
    availability: str
    session_mode: str
    session_minutes: int
    price_minor: int
    upi_id: str
    sessions_done: int


def _profile(doc: dict) -> MentorProfile:
    return MentorProfile(
        id=str(doc["_id"]),
        live=doc.get("status") == "active",
        headline=doc.get("headline", ""), bio=doc.get("bio", ""),
        expertise=doc.get("expertise") or [], languages=doc.get("languages") or [],
        experience_years=int(doc.get("experience_years") or 0),
        location=doc.get("location", ""), availability=doc.get("availability", ""),
        session_mode=doc.get("session_mode") or "Video call",
        session_minutes=int(doc.get("session_minutes") or 30),
        price_minor=int(doc.get("price_minor") or 0), upi_id=doc.get("upi_id", ""),
        sessions_done=int(doc.get("sessions_done") or 0),
    )


async def _my_mentor(me: dict) -> dict | None:
    return await _mentors().find_one({"owner_id": str(me["_id"])})


@router.get("/mentoring/me", response_model=MentorProfile | None, summary="My mentor profile")
async def get_my_profile(me: dict = Depends(require_active_member)):
    doc = await _my_mentor(me)
    return _profile(doc) if doc else None


@router.put("/mentoring/me", response_model=MentorProfile, summary="Become a mentor, or update my profile")
async def save_my_profile(body: MentorIn, me: dict = Depends(require_active_member)):
    now = datetime.now(timezone.utc)
    fields = {
        "name": me.get("full_name") or "A WomSakhi member",
        "headline": body.headline, "bio": body.bio,
        "expertise": body.expertise, "languages": body.languages,
        "experience_years": body.experience_years, "location": body.location,
        "availability": body.availability, "session_mode": body.session_mode,
        "session_minutes": body.session_minutes,
        "price_minor": body.price_rupees * 100,
        "upi_id": body.upi_id if body.price_rupees else "",
        "photo": me.get("avatar", "") or "",
        "updated_at": now,
    }
    existing = await _my_mentor(me)
    if existing:
        if existing.get("status") == "retired":
            raise HTTPException(status.HTTP_409_CONFLICT,
                                "Our team has paused your mentor profile. Write to us through Help to talk about it.")
        doc = await _mentors().find_one_and_update({"_id": existing["_id"]}, {"$set": fields}, return_document=True)
    else:
        doc = MentorModel.create_document(name=fields["name"], status="active")
        doc.update(fields)
        doc.update(owner_kind="member", owner_id=str(me["_id"]))
        doc["_id"] = (await _mentors().insert_one(doc)).inserted_id
    cache.forget("growth:mentors")
    return _profile(doc)


async def _set_live(me: dict, live: bool) -> MentorProfile:
    doc = await _my_mentor(me)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "You haven't set up mentoring yet")
    if doc.get("status") not in ("active", "paused"):
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Our team has paused your mentor profile. Write to us through Help to talk about it.")
    doc = await _mentors().find_one_and_update(
        {"_id": doc["_id"]}, {"$set": {"status": "active" if live else "paused", "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    cache.forget("growth:mentors")
    return _profile(doc)


@router.post("/mentoring/me/pause", response_model=MentorProfile, summary="Stop taking requests for now")
async def pause(me: dict = Depends(require_active_member)):
    return await _set_live(me, False)


@router.post("/mentoring/me/resume", response_model=MentorProfile, summary="Take requests again")
async def resume(me: dict = Depends(require_active_member)):
    return await _set_live(me, True)


# ── requests to her ─────────────────────────────────────────────────────────


class IncomingRequest(BaseModel):
    id: str
    learner: str
    goal: str
    preferred_time: str
    status: str
    asked_on: str
    scheduled_for: str = ""
    meeting: str = ""
    mentor_note: str = ""
    price_minor: int = 0
    payment_status: str = ""
    reference: str = ""


def _incoming(doc: dict, name: str) -> IncomingRequest:
    pay = doc.get("payment") or {}
    created = doc.get("created_at")
    return IncomingRequest(
        id=str(doc["_id"]), learner=name, goal=doc.get("goal", ""),
        preferred_time=doc.get("preferred_time", ""), status=doc.get("status", ""),
        asked_on=created.strftime("%b %d, %Y") if isinstance(created, datetime) else "",
        scheduled_for=doc.get("scheduled_for", ""), meeting=doc.get("meeting", ""),
        mentor_note=doc.get("mentor_note", ""), price_minor=int(doc.get("price_minor") or 0),
        payment_status=pay.get("status", ""), reference=pay.get("reference", ""),
    )


async def _names(user_ids: list[str]) -> dict[str, str]:
    ids = [to_object_id(u) for u in user_ids if u]
    rows = await get_database()["users"].find({"_id": {"$in": ids}}, {"full_name": 1}).to_list(None) if ids else []
    return {str(r["_id"]): r.get("full_name") or "A member" for r in rows}


@router.get("/mentoring/requests", response_model=list[IncomingRequest], summary="Requests to me")
async def incoming(me: dict = Depends(require_active_member)):
    docs = await _requests().find(
        {"owner_id": str(me["_id"]), "status": {"$ne": REQ.STATUS_WITHDRAWN}}
    ).sort("created_at", -1).to_list(200)
    names = await _names([d.get("user_id", "") for d in docs])
    order = {REQ.STATUS_PENDING: 0, REQ.STATUS_ACCEPTED: 1}
    docs.sort(key=lambda d: (order.get(d.get("status"), 2), 0 if (d.get("payment") or {}).get("status") == "claimed" else 1))
    return [_incoming(d, names.get(d.get("user_id", ""), "A member")) for d in docs]


async def _mine(request_id: str, me: dict, *, state: str) -> dict:
    doc = await _requests().find_one({"_id": to_object_id(request_id), "owner_id": str(me["_id"])})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That request isn't one of yours")
    if doc.get("status") != state:
        raise HTTPException(status.HTTP_409_CONFLICT, "This request has already been handled.")
    return doc


class AcceptIn(BaseModel):
    scheduled_for: str = Field(min_length=3, max_length=80)
    #: A video-call link, a phone number to call, or the place to meet.
    meeting: str = Field(min_length=3, max_length=300)
    note: str = Field("", max_length=300)


class NoteIn(BaseModel):
    note: str = Field("", max_length=300)


async def _respond(doc: dict, me: dict) -> IncomingRequest:
    names = await _names([doc.get("user_id", "")])
    return _incoming(doc, names.get(doc.get("user_id", ""), "A member"))


@router.post("/mentoring/requests/{request_id}/accept", response_model=IncomingRequest, summary="Accept with a time")
async def accept(request_id: str, body: AcceptIn, me: dict = Depends(require_active_member)):
    doc = await _mine(request_id, me, state=REQ.STATUS_PENDING)
    now = datetime.now(timezone.utc)
    price = int(doc.get("price_minor") or 0)
    updates = {"status": REQ.STATUS_ACCEPTED, "scheduled_for": body.scheduled_for.strip(),
               "meeting": body.meeting.strip(), "mentor_note": body.note.strip(), "updated_at": now}
    if price:
        updates["payment"] = {"status": "awaiting", "amount_minor": price}
    doc = await _requests().find_one_and_update({"_id": doc["_id"]}, {"$set": updates}, return_document=True)
    who = me.get("full_name") or "Your mentor"
    await notify(
        get_database(), doc["user_id"], f"{who} accepted — {body.scheduled_for.strip()}",
        f"Pay ₹{price // 100} to her by UPI to confirm the session." if price else "Open Mentors to see how to join.",
        "mentorship", "/app/mentors",
    )
    return await _respond(doc, me)


@router.post("/mentoring/requests/{request_id}/decline", response_model=IncomingRequest, summary="Decline")
async def decline(request_id: str, body: NoteIn | None = None, me: dict = Depends(require_active_member)):
    doc = await _mine(request_id, me, state=REQ.STATUS_PENDING)
    note = (body.note if body else "").strip()
    doc = await _requests().find_one_and_update(
        {"_id": doc["_id"]},
        {"$set": {"status": REQ.STATUS_DECLINED, "mentor_note": note, "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    await notify(get_database(), doc["user_id"], f"{me.get('full_name') or 'The mentor'} can't take this one",
                 note or "Try another mentor — there are women who can help.", "mentorship", "/app/mentors")
    return await _respond(doc, me)


@router.post("/mentoring/requests/{request_id}/payment-received", response_model=IncomingRequest,
             summary="I received her payment")
async def payment_received(request_id: str, me: dict = Depends(require_active_member)):
    doc = await _mine(request_id, me, state=REQ.STATUS_ACCEPTED)
    pay = doc.get("payment") or {}
    if pay.get("status") not in ("awaiting", "claimed"):
        raise HTTPException(status.HTTP_409_CONFLICT, "There is no payment waiting on this session.")
    now = datetime.now(timezone.utc)
    doc = await _requests().find_one_and_update(
        {"_id": doc["_id"], "payment.status": {"$in": ["awaiting", "claimed"]}},
        {"$set": {"payment.status": "paid", "payment.confirmed_at": now, "updated_at": now}},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status.HTTP_409_CONFLICT, "This payment has already been handled.")
    names = await _names([doc["user_id"]])
    await get_database()[BookEntryModel.collection_name].insert_one(BookEntryModel.create_document(
        user_id=str(me["_id"]), who=names.get(doc["user_id"], "A member"), what="Mentoring session",
        minor=int((doc.get("payment") or {}).get("amount_minor") or 0), state="paid", via="mentoring", on=now,
    ))
    await notify(get_database(), doc["user_id"], "Your session is confirmed",
                 f"{doc.get('scheduled_for', '')} — open Mentors to see how to join.", "mentorship", "/app/mentors")
    return await _respond(doc, me)


@router.post("/mentoring/requests/{request_id}/done", response_model=IncomingRequest, summary="The session happened")
async def done(request_id: str, me: dict = Depends(require_active_member)):
    doc = await _mine(request_id, me, state=REQ.STATUS_ACCEPTED)
    doc = await _requests().find_one_and_update(
        {"_id": doc["_id"]}, {"$set": {"status": REQ.STATUS_CLOSED, "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    await _mentors().update_one({"_id": to_object_id(doc["mentor_id"])}, {"$inc": {"sessions_done": 1}})
    cache.forget("growth:mentors")
    return await _respond(doc, me)


# ── Your services: seller, teacher, mentor ──────────────────────────────────


class Step(BaseModel):
    label: str
    done: bool
    href: str


class Service(BaseModel):
    active: bool
    headline: str
    steps: list[Step]
    to_do: int = 0
    earned_minor: int = 0


class MyServices(BaseModel):
    seller: Service
    teacher: Service
    mentor: Service


@router.get("/services/me", response_model=MyServices, summary="What I offer: seller, teacher, mentor")
async def my_services(me: dict = Depends(require_active_member)):
    db = get_database()
    uid = str(me["_id"])
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    live_listings = await db["shop_listings"].count_documents({"user_id": uid, "status": "live", "hidden": {"$ne": True}})
    open_orders = await db["shop_orders"].count_documents({"seller_id": uid, "state": {"$in": ["New", "Making", "Ready"]}})
    payout = await db[PayoutAccountModel.collection_name].count_documents({"user_id": uid})
    courses = await db[ProgramModel.collection_name].find({"owner_id": uid}, {"status": 1, "price_minor": 1}).to_list(200)
    from app.routes.catalog import OPEN_PROGRAM_STATUSES
    live_courses = [c for c in courses if c.get("status") in OPEN_PROGRAM_STATUSES]
    course_ids = [str(c["_id"]) for c in courses]
    to_confirm = await db["enrollments"].count_documents(
        {"program_id": {"$in": course_ids}, "status": "pending", "payment.status": "claimed"}) if course_ids else 0
    mentor = await _my_mentor(me)
    mentor_to_do = await _requests().count_documents({
        "owner_id": uid,
        "$or": [{"status": REQ.STATUS_PENDING}, {"status": REQ.STATUS_ACCEPTED, "payment.status": "claimed"}],
    }) if mentor else 0

    async def earned(via: str) -> int:
        rows = await db[BookEntryModel.collection_name].aggregate([
            {"$match": {"user_id": uid, "via": via, "state": "paid", "on": {"$gte": month_start}}},
            {"$group": {"_id": None, "minor": {"$sum": "$minor"}}},
        ]).to_list(1)
        return int((rows[0] if rows else {}).get("minor") or 0)

    return MyServices(
        seller=Service(
            active=live_listings > 0,
            headline=f"{live_listings} listing{'s' if live_listings != 1 else ''} live" if live_listings else "Sell what you make or do",
            steps=[
                Step(label="Add how you get paid (UPI or bank)", done=payout > 0, href="/app/settings/payments"),
                Step(label="Put your first product or service live", done=live_listings > 0, href="/app/documents/new"),
                Step(label="Share your shop link", done=live_listings > 0 and payout > 0, href="/app/collect"),
            ],
            to_do=open_orders,
        ),
        teacher=Service(
            active=bool(live_courses),
            headline=f"{len(live_courses)} course{'s' if len(live_courses) != 1 else ''} live" if live_courses else "Teach what you know",
            steps=[
                Step(label="Write your first course", done=bool(courses), href="/app/teach/new"),
                Step(label="Publish it in Learn", done=bool(live_courses), href="/app/teach"),
            ],
            to_do=to_confirm,
            earned_minor=await earned("course"),
        ),
        mentor=Service(
            active=bool(mentor and mentor.get("status") == "active"),
            headline=("Taking requests" if mentor.get("status") == "active" else "Paused") if mentor else "Guide women one to one",
            steps=[
                Step(label="Write your mentor profile", done=bool(mentor), href="/app/mentoring"),
                Step(label="Take requests", done=bool(mentor and mentor.get("status") == "active"), href="/app/mentoring"),
            ],
            to_do=mentor_to_do,
            earned_minor=await earned("mentoring"),
        ),
    )
