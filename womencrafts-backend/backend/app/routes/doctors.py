"""
Doctor Consultation — a directory staff keep, and the consultations members book.

── Who adds doctors ─────────────────────────────────────────────────────────
Staff, from the admin dashboard (Appointments → Doctors). A member never sees
a doctor staff have not added and switched on, so every name on her screen is
one somebody at WomSakhi checked (`verified_at`, `registration_no`).

── Booking ─────────────────────────────────────────────────────────────────
A doctor's weekly hours (`availability`: day, start, end, slot length) make
the slots. A slot is free when it is in the future (at least LEAD_MINUTES
ahead) and no live consultation holds it. Holding is enforced by a unique
`slot_key` ("<doctor>|<start>") that a consultation carries only while it is
requested or confirmed, so two women cannot take one slot even at once.

A booking is a REQUEST. Staff (or the doctor through staff) confirm it, add
how to join, and complete it with a prescription; she is told each step.

── Money ──────────────────────────────────────────────────────────────────
No fee is collected here. `fee_minor` is what the doctor or clinic charges and
she pays them directly; 0 means free.
"""

from __future__ import annotations

from datetime import date as Date, datetime, timedelta, timezone
import re
from typing import Literal, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, field_validator
from pymongo.errors import DuplicateKeyError

from app.core import masters, mongosafe
from app.core.audit import record
from app.core.deps import get_current_user
from app.core.media import MediaRefOptional, media_url
from app.core.permissions import require_permission
from app.core.rbac import require_active_member
from app.db.mongodb import get_database
from app.models.conversation import notify

router = APIRouter(prefix="/doctors", tags=["Member · Health"])
admin_router = APIRouter(prefix="/admin/doctors", tags=["Admin · Doctors"])

DOCTORS = "doctors"
CONSULTS = "doctor_consultations"
IST = timezone(timedelta(hours=5, minutes=30))
LEAD_MINUTES = 60
DAYS_AHEAD = 30
OPEN_LIMIT = 3      # live consultations a member may hold at once
DAILY_LIMIT = 5     # bookings a day

#: The specialities the app shipped with. The list staff edit is the
#: `doctor_specialities` master (app/core/masters.py); this tuple only seeds it.
SPECIALITIES = ("Gynaecologist", "Fertility specialist", "General physician", "Paediatrician", "Nutritionist",
                "Counsellor", "Endocrinologist", "Dermatologist", "Physiotherapist", "Other")
MODES = ("Video", "Phone", "Clinic")
WEEKDAYS = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
LIVE = ("requested", "confirmed")
HHMM = r"^([01]\d|2[0-3]):[0-5]\d$"


def _db():
    return get_database()


def _oid(v: str) -> ObjectId:
    if not ObjectId.is_valid(v or ""):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    return ObjectId(v)


def _iso(d: Optional[datetime]) -> str:
    if not isinstance(d, datetime):
        return ""
    return (d if d.tzinfo else d.replace(tzinfo=timezone.utc)).isoformat()


# ── shapes ───────────────────────────────────────────────────────────────────

class Hours(BaseModel):
    day: Literal["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    start: str = Field(..., pattern=HHMM)
    end: str = Field(..., pattern=HHMM)
    slot_minutes: int = Field(20, ge=10, le=120)

    @field_validator("end")
    @classmethod
    def after_start(cls, v: str, info):
        start = info.data.get("start")
        if start and v <= start:
            raise ValueError("End time must be after the start time")
        return v


class DoctorUpsert(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    #: A label from the `doctor_specialities` master (app/core/masters.py), checked on save.
    speciality: str = Field(..., min_length=1, max_length=80)
    qualifications: str = Field("", max_length=120)
    registration_no: str = Field("", max_length=40)
    #: Labels from the `languages` master, checked on save.
    languages: list[str] = Field(default_factory=list, max_length=10)
    experience_years: int = Field(0, ge=0, le=60)
    fee_minor: int = Field(0, ge=0, le=10_000_00)
    modes: list[Literal["Video", "Phone", "Clinic"]] = Field(default_factory=lambda: ["Video"], min_length=1, max_length=3)
    clinic: str = Field("", max_length=120)
    city: str = Field("", max_length=60)
    photo: MediaRefOptional = None
    bio: str = Field("", max_length=800)
    availability: list[Hours] = Field(default_factory=list, max_length=21)
    active: bool = True


class DoctorOut(BaseModel):
    id: str
    name: str
    speciality: str
    qualifications: str = ""
    registration_no: str = ""
    languages: list[str] = []
    experience_years: int = 0
    fee_minor: int = 0
    modes: list[str] = []
    clinic: str = ""
    city: str = ""
    photo: str = ""
    bio: str = ""
    availability: list[Hours] = []
    active: bool = True
    verified: bool = False
    #: Days of the week she can be booked, in order — for a card.
    days: list[str] = []
    #: The next free slot (ISO), or "" — computed for lists.
    next_slot: str = ""
    consultations_done: int = 0


def _doctor_out(d: dict, next_slot: str = "", done: int = 0) -> DoctorOut:
    hours = [Hours(**h) for h in d.get("availability") or []]
    return DoctorOut(
        id=str(d["_id"]), name=d.get("name", ""), speciality=d.get("speciality", "Other"),
        qualifications=d.get("qualifications", ""), registration_no=d.get("registration_no", ""),
        languages=d.get("languages") or [], experience_years=int(d.get("experience_years") or 0),
        fee_minor=int(d.get("fee_minor") or 0), modes=d.get("modes") or [], clinic=d.get("clinic", ""),
        city=d.get("city", ""), photo=media_url(d.get("photo") or ""), bio=d.get("bio", ""),
        availability=hours, active=bool(d.get("active", True)), verified=bool(d.get("verified_at")),
        days=[w for w in WEEKDAYS if any(h.day == w for h in hours)], next_slot=next_slot, consultations_done=done,
    )


class SharedItem(BaseModel):
    """One thing from her Health Records she chose to show the doctor — a copy, taken when she shared it."""
    kind: Literal["medication", "allergy", "reading", "document", "history"]
    label: str = Field(..., min_length=1, max_length=120)
    detail: str = Field("", max_length=200)


class Consultation(BaseModel):
    id: str
    doctor_id: str
    doctor_name: str
    speciality: str
    #: ISO date-time of the slot (UTC offset included).
    start: str
    mode: str
    status: Literal["requested", "confirmed", "completed", "cancelled"]
    #: The prescription text, once completed; None before.
    prescription: Optional[str] = None
    prescription_file: str = ""
    prescription_at: str = ""
    reason: str = ""
    symptoms: list[str] = []
    #: How to join (a video link, a phone note, the clinic address) — set on confirm.
    join_info: str = ""
    fee_minor: int = 0
    clinic: str = ""
    city: str = ""
    doctor_photo: str = ""
    cancel_reason: str = ""
    cancelled_by: str = ""
    created_at: str = ""
    #: What she chose to share from her records, with her consent; she can stop sharing until it happens.
    shared: list[SharedItem] = []
    shared_at: str = ""
    #: Her own notes for this visit. Private: never sent to staff.
    member_notes: str = ""
    #: The earlier time, when she moved it.
    rescheduled_from: str = ""


class AdminConsultation(Consultation):
    user_id: str
    member_name: str = ""
    staff_note: str = ""


def _consult_out(c: dict, admin: bool = False) -> Consultation:
    rx = c.get("prescription") or {}
    base = dict(
        id=str(c["_id"]), doctor_id=c.get("doctor_id", ""), doctor_name=c.get("doctor_name", ""),
        speciality=c.get("speciality", ""), start=_iso(c.get("start")), mode=c.get("mode", ""),
        status=c.get("status", "requested"),
        prescription=(rx.get("text") or "") if c.get("status") == "completed" and rx else None,
        prescription_file=media_url(rx.get("file") or "") if rx else "",
        prescription_at=_iso(rx.get("at")) if rx else "",
        reason=c.get("reason", ""), symptoms=c.get("symptoms") or [], join_info=c.get("join_info", ""),
        fee_minor=int(c.get("fee_minor") or 0), clinic=c.get("clinic", ""), city=c.get("city", ""),
        doctor_photo=media_url(c.get("doctor_photo") or ""), cancel_reason=c.get("cancel_reason", ""),
        cancelled_by=c.get("cancelled_by", ""), created_at=_iso(c.get("created_at")),
        shared=[SharedItem(**x) for x in (c.get("shared") or [])], shared_at=_iso(c.get("shared_at")),
        member_notes="" if admin else c.get("member_notes", ""),
        rescheduled_from=_iso(c.get("rescheduled_from")),
    )
    if admin:
        return AdminConsultation(**base, user_id=c.get("user_id", ""), member_name=c.get("member_name", ""),
                                 staff_note=c.get("staff_note", ""))
    return Consultation(**base)


# ── slots ────────────────────────────────────────────────────────────────────

def _slots_for(doc: dict, day: Date, taken: set[str], now: datetime) -> list[datetime]:
    weekday = WEEKDAYS[day.weekday()]
    out: list[datetime] = []
    for h in doc.get("availability") or []:
        if h.get("day") != weekday:
            continue
        step = int(h.get("slot_minutes") or 20)
        cur = datetime.combine(day, datetime.strptime(h["start"], "%H:%M").time(), IST)
        end = datetime.combine(day, datetime.strptime(h["end"], "%H:%M").time(), IST)
        while cur + timedelta(minutes=step) <= end:
            if cur >= now + timedelta(minutes=LEAD_MINUTES) and _iso(cur.astimezone(timezone.utc)) not in taken:
                out.append(cur)
            cur += timedelta(minutes=step)
    return sorted(set(out))


async def _taken(doctor_id: str, start: datetime, end: datetime) -> set[str]:
    rows = _db()[CONSULTS].find({"doctor_id": doctor_id, "status": {"$in": list(LIVE)},
                                 "start": {"$gte": start, "$lt": end}}, {"start": 1})
    return {_iso(r["start"]) async for r in rows}


async def _next_slot(doc: dict, now: datetime) -> str:
    day0 = now.astimezone(IST).date()
    taken = await _taken(str(doc["_id"]), now, now + timedelta(days=15))
    for i in range(15):
        slots = _slots_for(doc, day0 + timedelta(days=i), taken, now)
        if slots:
            return slots[0].isoformat()
    return ""


async def _active_doctor(doctor_id: str) -> dict:
    doc = await _db()[DOCTORS].find_one({"_id": _oid(doctor_id), "active": True})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That doctor is not available")
    return doc


# ── member ───────────────────────────────────────────────────────────────────

@router.get("", response_model=list[DoctorOut], summary="Doctors I can consult")
async def list_doctors(
    speciality: str = Query("", max_length=80),
    language: str = Query("", max_length=30),
    mode: str = Query("", max_length=10),
    q: str = Query("", max_length=60),
    me: dict = Depends(require_active_member),
):
    query: dict = {"active": True}
    if speciality:
        # Any label in the master, matched without regard to case ("?speciality=gynaecologist").
        query["speciality"] = {"$regex": f"^{re.escape(speciality.strip())}$", "$options": "i"}
    if language:
        query["languages"] = language
    if mode:
        query["modes"] = mode
    if q.strip():
        query.update(mongosafe.any_of(q, ["name", "speciality", "clinic", "city", "qualifications"]))
    docs = await _db()[DOCTORS].find(query).sort("name", 1).to_list(200)
    now = datetime.now(timezone.utc)
    done = {r["_id"]: r["n"] async for r in _db()[CONSULTS].aggregate([
        {"$match": {"status": "completed"}}, {"$group": {"_id": "$doctor_id", "n": {"$sum": 1}}}])}
    return [_doctor_out(d, await _next_slot(d, now), done.get(str(d["_id"]), 0)) for d in docs]


@router.get("/consultations/mine", response_model=list[Consultation], summary="My consultations")
async def my_consultations(me: dict = Depends(require_active_member)):
    rows = _db()[CONSULTS].find({"user_id": str(me["_id"])}).sort("start", -1).limit(200)
    return [_consult_out(c) async for c in rows]


@router.post("/consultations/{consult_id}/cancel", response_model=Consultation, summary="Cancel my consultation")
async def cancel_mine(consult_id: str, me: dict = Depends(require_active_member)):
    c = await _db()[CONSULTS].find_one({"_id": _oid(consult_id), "user_id": str(me["_id"])})
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    if c.get("status") not in LIVE:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only a consultation that has not happened can be cancelled.")
    now = datetime.now(timezone.utc)
    await _db()[CONSULTS].update_one({"_id": c["_id"]}, {
        "$set": {"status": "cancelled", "cancelled_by": "member", "cancel_reason": "Cancelled by you", "updated_at": now},
        "$unset": {"slot_key": ""}})
    c.update(status="cancelled", cancelled_by="member", cancel_reason="Cancelled by you")
    return _consult_out(c)


async def _mine(consult_id: str, me: dict) -> dict:
    c = await _db()[CONSULTS].find_one({"_id": _oid(consult_id), "user_id": str(me["_id"])})
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    return c


class ShareIn(BaseModel):
    shared: list[SharedItem] = Field(default_factory=list, max_length=30)
    share_consent: bool = False


@router.post("/consultations/{consult_id}/shared", response_model=Consultation,
             summary="Change what I share with the doctor (empty stops sharing)")
async def set_shared(consult_id: str, body: ShareIn, me: dict = Depends(require_active_member)):
    c = await _mine(consult_id, me)
    if c.get("status") not in LIVE:
        raise HTTPException(status.HTTP_409_CONFLICT, "Sharing can only change before the consultation.")
    before = {(x.get("kind"), x.get("label")) for x in c.get("shared") or []}
    added = [x for x in body.shared if (x.kind, x.label) not in before]
    _need_consent(added, body.share_consent)
    now = datetime.now(timezone.utc)
    sets = {"shared": [x.model_dump() for x in body.shared], "updated_at": now}
    if added:
        sets["shared_at"] = now
    await _db()[CONSULTS].update_one({"_id": c["_id"]}, {"$set": sets})
    c.update(sets)
    return _consult_out(c)


class NotesIn(BaseModel):
    notes: str = Field("", max_length=2000)


@router.post("/consultations/{consult_id}/notes", response_model=Consultation, summary="My private notes for a visit")
async def set_notes(consult_id: str, body: NotesIn, me: dict = Depends(require_active_member)):
    c = await _mine(consult_id, me)
    await _db()[CONSULTS].update_one({"_id": c["_id"]}, {"$set": {"member_notes": body.notes.strip()}})
    c["member_notes"] = body.notes.strip()
    return _consult_out(c)


class RescheduleIn(BaseModel):
    start: str = Field(..., max_length=40)


@router.post("/consultations/{consult_id}/reschedule", response_model=Consultation, summary="Move my consultation")
async def reschedule(consult_id: str, body: RescheduleIn, me: dict = Depends(require_active_member)):
    c = await _mine(consult_id, me)
    if c.get("status") not in LIVE:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only a consultation that has not happened can be moved.")
    doc = await _active_doctor(c["doctor_id"])
    start_utc = await _free_start(doc, c["doctor_id"], body.start)
    now = datetime.now(timezone.utc)
    # A new time goes back to the team to confirm with the doctor, so the old joining details no longer hold.
    sets = {"start": start_utc, "slot_key": f"{c['doctor_id']}|{_iso(start_utc)}", "status": "requested",
            "join_info": "", "rescheduled_from": c.get("start"), "updated_at": now}
    try:
        await _db()[CONSULTS].update_one({"_id": c["_id"]}, {"$set": sets})
    except DuplicateKeyError:
        raise HTTPException(status.HTTP_409_CONFLICT, {"code": "slot_taken",
                            "message": "Someone took that time a moment ago. Pick another one."})
    c.update(sets)
    when = start_utc.astimezone(IST).strftime("%a %d %b, %I:%M %p")
    await notify(_db(), str(me["_id"]), "New time requested",
                 f"{c.get('doctor_name')} · {when}. We will confirm it and tell you how to join.",
                 "health", "/app/health/doctors?tab=consultations")
    return _consult_out(c)


@router.get("/{doctor_id}", response_model=DoctorOut, summary="One doctor")
async def one_doctor(doctor_id: str, me: dict = Depends(require_active_member)):
    doc = await _active_doctor(doctor_id)
    return _doctor_out(doc, await _next_slot(doc, datetime.now(timezone.utc)))


class SlotDay(BaseModel):
    date: str
    slots: list[str]


@router.get("/{doctor_id}/slots", response_model=SlotDay, summary="Free times on a day")
async def slots(doctor_id: str, on: str = Query(..., alias="date", max_length=10),
                me: dict = Depends(require_active_member)):
    doc = await _active_doctor(doctor_id)
    try:
        day = Date.fromisoformat(on)
    except ValueError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Pick a valid date.")
    now = datetime.now(timezone.utc)
    if day < now.astimezone(IST).date() or day > now.astimezone(IST).date() + timedelta(days=DAYS_AHEAD):
        return SlotDay(date=on, slots=[])
    start = datetime.combine(day, datetime.min.time(), IST)
    taken = await _taken(doctor_id, start, start + timedelta(days=1))
    return SlotDay(date=on, slots=[s.isoformat() for s in _slots_for(doc, day, taken, now)])


class BookIn(BaseModel):
    start: str = Field(..., max_length=40)
    mode: Literal["Video", "Phone", "Clinic"]
    reason: str = Field(..., min_length=2, max_length=300)
    symptoms: list[str] = Field(default_factory=list, max_length=12)
    #: Records she ticks to show the doctor. Nothing is shared unless she ticks it and agrees.
    shared: list[SharedItem] = Field(default_factory=list, max_length=30)
    share_consent: bool = False


def _need_consent(shared: list[SharedItem], consent: bool) -> None:
    if shared and not consent:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            "Tick that you agree to share these with the doctor, or untick them.")


async def _free_start(doc: dict, doctor_id: str, raw: str) -> datetime:
    """The UTC start for `raw`, if it is one of the doctor's free slots now."""
    try:
        start = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Pick a time from the list.")
    if start.tzinfo is None:
        start = start.replace(tzinfo=IST)
    now = datetime.now(timezone.utc)
    day = start.astimezone(IST).date()
    taken = await _taken(doctor_id, datetime.combine(day, datetime.min.time(), IST),
                         datetime.combine(day, datetime.min.time(), IST) + timedelta(days=1))
    free = {s.astimezone(timezone.utc) for s in _slots_for(doc, day, taken, now)}
    start_utc = start.astimezone(timezone.utc)
    if start_utc not in free:
        raise HTTPException(status.HTTP_409_CONFLICT, {"code": "slot_taken",
                            "message": "That time is no longer free. Pick another one."})
    return start_utc


@router.post("/{doctor_id}/book", response_model=Consultation, status_code=status.HTTP_201_CREATED,
             summary="Ask for a consultation")
async def book(doctor_id: str, body: BookIn, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    doc = await _active_doctor(doctor_id)
    if body.mode not in (doc.get("modes") or []):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"{doc.get('name')} does not offer {body.mode} consultations.")
    _need_consent(body.shared, body.share_consent)
    start_utc = await _free_start(doc, doctor_id, body.start)
    start = start_utc
    now = datetime.now(timezone.utc)
    db = _db()
    if await db[CONSULTS].count_documents({"user_id": uid, "status": {"$in": list(LIVE)}}) >= OPEN_LIMIT:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            f"You already have {OPEN_LIMIT} consultations booked. Cancel one or wait until it is done.")
    if await db[CONSULTS].count_documents({"user_id": uid, "created_at": {"$gte": now - timedelta(days=1)}}) >= DAILY_LIMIT:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "That is a lot of bookings for one day. Try again tomorrow.")
    c = {
        "user_id": uid, "member_name": me.get("full_name", ""), "doctor_id": doctor_id,
        "doctor_name": doc.get("name", ""), "speciality": doc.get("speciality", ""),
        "doctor_photo": doc.get("photo") or "", "fee_minor": int(doc.get("fee_minor") or 0),
        "clinic": doc.get("clinic", ""), "city": doc.get("city", ""),
        "start": start_utc, "mode": body.mode, "reason": body.reason.strip(),
        "symptoms": [s.strip()[:40] for s in body.symptoms if s.strip()],
        "status": "requested", "slot_key": f"{doctor_id}|{_iso(start_utc)}",
        "created_at": now, "updated_at": now,
    }
    if body.shared:
        c.update(shared=[x.model_dump() for x in body.shared], shared_at=now)
    try:
        c["_id"] = (await db[CONSULTS].insert_one(c)).inserted_id
    except DuplicateKeyError:
        raise HTTPException(status.HTTP_409_CONFLICT, {"code": "slot_taken",
                            "message": "Someone took that time a moment ago. Pick another one."})
    when = start.astimezone(IST).strftime("%a %d %b, %I:%M %p")
    await notify(db, uid, "Consultation requested",
                 f"{doc.get('name')} · {when}. We will confirm it and tell you how to join.",
                 "health", "/app/health/doctors?tab=consultations")
    return _consult_out(c)


# ── staff ────────────────────────────────────────────────────────────────────

@admin_router.get("", response_model=list[DoctorOut], summary="All doctors",
                  dependencies=[Depends(require_permission("appointments.view"))])
async def admin_list(q: str = Query("", max_length=60)):
    query: dict = {}
    if q.strip():
        query.update(mongosafe.any_of(q, ["name", "speciality", "clinic", "city"]))
    docs = await _db()[DOCTORS].find(query).sort([("active", -1), ("name", 1)]).to_list(500)
    done = {r["_id"]: r["n"] async for r in _db()[CONSULTS].aggregate([
        {"$match": {"status": "completed"}}, {"$group": {"_id": "$doctor_id", "n": {"$sum": 1}}}])}
    return [_doctor_out(d, done=done.get(str(d["_id"]), 0)) for d in docs]


async def _vetted(body: "DoctorUpsert", current: Optional[dict] = None) -> "DoctorUpsert":
    """
    Speciality and languages as the masters spell them, or a 422 naming the
    choices. What the doctor already has passes unchecked, so disabling an
    item never blocks editing a doctor who uses it.
    """
    current = current or {}
    if body.speciality.strip().lower() != (current.get("speciality") or "").strip().lower():
        body.speciality = await masters.check("doctor_specialities", body.speciality, field="speciality")
    else:
        body.speciality = current["speciality"]
    have = {c.lower(): c for c in (current.get("languages") or [])}
    out: list[str] = []
    for lang in body.languages:
        c = have.get(lang.strip().lower()) or await masters.check("languages", lang, field="language")
        if c not in out:
            out.append(c)
    body.languages = out
    return body


@admin_router.post("", response_model=DoctorOut, status_code=status.HTTP_201_CREATED, summary="Add a doctor",
                   dependencies=[Depends(require_permission("appointments.create"))])
async def admin_add(body: DoctorUpsert, request: Request, me: dict = Depends(get_current_user)):
    body = await _vetted(body)
    now = datetime.now(timezone.utc)
    doc = {**body.model_dump(), "availability": [h.model_dump() for h in body.availability],
           "verified_at": now, "verified_by": str(me["_id"]), "created_at": now, "updated_at": now}
    doc["_id"] = (await _db()[DOCTORS].insert_one(doc)).inserted_id
    await record(me, "doctors.add", target=str(doc["_id"]), detail=f"{body.name} · {body.speciality}", request=request)
    return _doctor_out(doc)


@admin_router.put("/{doctor_id}", response_model=DoctorOut, summary="Edit a doctor",
                  dependencies=[Depends(require_permission("appointments.edit"))])
async def admin_edit(doctor_id: str, body: DoctorUpsert, request: Request, me: dict = Depends(get_current_user)):
    body = await _vetted(body, await _db()[DOCTORS].find_one({"_id": _oid(doctor_id)}, {"speciality": 1, "languages": 1}))
    sets = {**body.model_dump(), "availability": [h.model_dump() for h in body.availability],
            "updated_at": datetime.now(timezone.utc)}
    doc = await _db()[DOCTORS].find_one_and_update({"_id": _oid(doctor_id)}, {"$set": sets}, return_document=True)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That doctor does not exist")
    await _db()[CONSULTS].update_many({"doctor_id": doctor_id, "status": {"$in": list(LIVE)}},
                                      {"$set": {"doctor_name": body.name, "speciality": body.speciality}})
    await record(me, "doctors.edit", target=doctor_id, detail=f"{body.name} ({'on' if body.active else 'off'})", request=request)
    return _doctor_out(doc)


@admin_router.get("/consultations", response_model=list[AdminConsultation], summary="Consultation requests",
                  dependencies=[Depends(require_permission("appointments.view"))])
async def admin_consultations(status_filter: str = Query("", alias="status", max_length=20),
                              doctor_id: str = Query("", max_length=40)):
    query: dict = {}
    if status_filter:
        query["status"] = status_filter
    if doctor_id:
        query["doctor_id"] = doctor_id
    rows = _db()[CONSULTS].find(query).sort("start", 1 if status_filter in LIVE else -1).limit(500)
    return [_consult_out(c, admin=True) async for c in rows]


async def _staff_consult(consult_id: str) -> dict:
    c = await _db()[CONSULTS].find_one({"_id": _oid(consult_id)})
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    return c


class ConfirmIn(BaseModel):
    join_info: str = Field("", max_length=300)
    staff_note: str = Field("", max_length=300)


@admin_router.post("/consultations/{consult_id}/confirm", response_model=AdminConsultation, summary="Confirm it",
                   dependencies=[Depends(require_permission("appointments.edit"))])
async def admin_confirm(consult_id: str, body: ConfirmIn, request: Request, me: dict = Depends(get_current_user)):
    c = await _staff_consult(consult_id)
    if c.get("status") not in LIVE:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only a requested consultation can be confirmed.")
    sets = {"status": "confirmed", "join_info": body.join_info.strip(), "staff_note": body.staff_note.strip(),
            "confirmed_at": datetime.now(timezone.utc), "confirmed_by": str(me["_id"]),
            "updated_at": datetime.now(timezone.utc)}
    await _db()[CONSULTS].update_one({"_id": c["_id"]}, {"$set": sets})
    c.update(sets)
    when = c["start"].replace(tzinfo=timezone.utc).astimezone(IST).strftime("%a %d %b, %I:%M %p") if isinstance(c.get("start"), datetime) else ""
    await notify(_db(), c["user_id"], "Your consultation is confirmed",
                 f"{c.get('doctor_name')} · {when}. {body.join_info.strip()}".strip(),
                 "health", "/app/health/doctors?tab=consultations")
    await record(me, "doctors.consult.confirm", target=consult_id, detail=c.get("doctor_name", ""), request=request)
    return _consult_out(c, admin=True)


class CompleteIn(BaseModel):
    prescription: str = Field(..., min_length=2, max_length=3000)
    file: MediaRefOptional = None
    staff_note: str = Field("", max_length=300)


@admin_router.post("/consultations/{consult_id}/complete", response_model=AdminConsultation,
                   summary="Mark it done, with the prescription",
                   dependencies=[Depends(require_permission("appointments.edit"))])
async def admin_complete(consult_id: str, body: CompleteIn, request: Request, me: dict = Depends(get_current_user)):
    c = await _staff_consult(consult_id)
    if c.get("status") not in LIVE:
        raise HTTPException(status.HTTP_409_CONFLICT, "This consultation is already closed.")
    now = datetime.now(timezone.utc)
    sets = {"status": "completed", "prescription": {"text": body.prescription.strip(), "file": body.file or "",
                                                    "at": now, "by": str(me["_id"])},
            "staff_note": body.staff_note.strip() or c.get("staff_note", ""), "completed_at": now, "updated_at": now}
    await _db()[CONSULTS].update_one({"_id": c["_id"]}, {"$set": sets, "$unset": {"slot_key": ""}})
    c.update(sets)
    await notify(_db(), c["user_id"], "Your prescription is ready",
                 f"From your consultation with {c.get('doctor_name')}.", "health",
                 "/app/health/doctors?tab=prescriptions")
    await record(me, "doctors.consult.complete", target=consult_id, detail=c.get("doctor_name", ""), request=request)
    return _consult_out(c, admin=True)


class CancelIn(BaseModel):
    reason: str = Field(..., min_length=2, max_length=300)


@admin_router.post("/consultations/{consult_id}/cancel", response_model=AdminConsultation, summary="Cancel it",
                   dependencies=[Depends(require_permission("appointments.edit"))])
async def admin_cancel(consult_id: str, body: CancelIn, request: Request, me: dict = Depends(get_current_user)):
    c = await _staff_consult(consult_id)
    if c.get("status") not in LIVE:
        raise HTTPException(status.HTTP_409_CONFLICT, "This consultation is already closed.")
    sets = {"status": "cancelled", "cancelled_by": "staff", "cancel_reason": body.reason.strip(),
            "updated_at": datetime.now(timezone.utc)}
    await _db()[CONSULTS].update_one({"_id": c["_id"]}, {"$set": sets, "$unset": {"slot_key": ""}})
    c.update(sets)
    await notify(_db(), c["user_id"], "Your consultation was cancelled",
                 f"{c.get('doctor_name')}: {body.reason.strip()} You can book another time.", "health",
                 "/app/health/doctors?tab=consultations")
    await record(me, "doctors.consult.cancel", target=consult_id, detail=body.reason.strip(), request=request)
    return _consult_out(c, admin=True)
