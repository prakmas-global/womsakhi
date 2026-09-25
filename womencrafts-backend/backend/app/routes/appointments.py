"""
Appointments — one admin view of every session on the platform.

── Two collections, one list ──────────────────────────────────────────────
Sessions reach this screen from two places:

  * `bookings`      — sessions members booked themselves in the member app.
                      That app reads them back through /me/bookings, and its
                      `Booking` type is a closed union: status is exactly
                      upcoming | completed | cancelled, plus `cancelled_reason`.
                      This file never writes outside that vocabulary. What an
                      admin adds — a confirmation, a no-show, an internal note,
                      a history line — is an additive field the member
                      endpoints ignore, so her screen keeps working unchanged.
  * `appointments`  — sessions staff entered by hand (a walk-in, a phone call).
                      Same field names and the same storage vocabulary as a
                      booking, so one shaping function serves both.

The admin API speaks a richer vocabulary on top of that storage:

    booked      status upcoming, not yet confirmed by staff
    confirmed   status upcoming, `confirmed_at` set
    completed   status completed
    cancelled   status cancelled
    no_show     status cancelled, `no_show: true`

A no-show is stored as a cancellation on purpose. The member app counts
`completed` as sessions she attended; a session she missed is not one of
those, and the reason it shows her says so.

── The fixture rows that used to be seeded here ───────────────────────────
This file used to insert eighteen made-up appointments dated "May 20" with
no year whenever the collection was empty, and the screen rendered them as
if they were real. `seed()` still exists because `seed_all` imports it, but
it inserts nothing. Rows that were seeded earlier carry no parseable date and
surface as "undated": the admin can give them a real date or delete them.

── Why it loads everything and filters in Python ──────────────────────────
Both collections together hold a few hundred rows. Merging two collections
and looking up member names is one pass here and four round trips to Atlas;
pushing the filter into two separate Mongo queries and re-merging the pages
would be more code for no visible difference at this size. Revisit past a few
thousand rows.
"""

from __future__ import annotations

from datetime import datetime, time, timedelta, timezone
from typing import Literal, Optional
from zoneinfo import ZoneInfo

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, field_validator
from pymongo import ReturnDocument

from app.core.audit import record
from app.core.deps import get_current_user
from app.core.permissions import require_permission
from app.core.serializers import aware, page_meta
from app.db.mongodb import get_database
from app.models.appointment import AppointmentModel
from app.models.enrollment import BookingModel

router = APIRouter(prefix="/appointments", tags=["Appointments"])

#: Members book in Indian time; "today" is measured where they are.
IST = ZoneInfo("Asia/Kolkata")

SOURCE_MEMBER = "member"
SOURCE_STAFF = "staff"
SOURCES = (SOURCE_MEMBER, SOURCE_STAFF)

BOOKED = "booked"
CONFIRMED = "confirmed"
COMPLETED = "completed"
CANCELLED = "cancelled"
NO_SHOW = "no_show"
ADMIN_STATUSES = (BOOKED, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW)
#: Statuses a session can still move out of.
OPEN = (BOOKED, CONFIRMED)

STATUS_LABEL = {
    BOOKED: "Awaiting confirmation",
    CONFIRMED: "Confirmed",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    NO_SHOW: "No-show",
}

NO_SHOW_REASON = "Did not attend (marked by staff)"

#: What `duration` strings look like in both collections: "60 min", "1 hour",
#: "1.5 hours", "120 min". Anything unreadable is treated as an hour.
DEFAULT_DURATION_MIN = 60

Scope = Literal["today", "upcoming", "past", "all"]


# ── Collections ─────────────────────────────────────────────────────────────

def _bookings():
    return get_database()[BookingModel.collection_name]


def _staff():
    return get_database()[AppointmentModel.collection_name]


def _members():
    return get_database()["members"]


def _users():
    return get_database()["users"]


def _services():
    return get_database()["services"]


def _col(source: str):
    return _bookings() if source == SOURCE_MEMBER else _staff()


# ── Refs: "member:<id>" | "staff:<id>" ──────────────────────────────────────

def _parse_ref(ref: str) -> tuple[str, ObjectId]:
    """
    A row is identified by its source and its id together, because the two
    collections' ids could in principle collide and an action against the
    wrong one would be a silent write to somebody else's session.

    A bare id (no prefix) is read as a staff row — the shape the old URLs used.
    """
    source, _, raw = ref.partition(":")
    if not raw:
        source, raw = SOURCE_STAFF, source
    if source not in SOURCES:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Appointment not found")
    try:
        return source, ObjectId(raw)
    except (InvalidId, TypeError):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Appointment not found")


async def _load_one(ref: str) -> tuple[str, dict]:
    source, oid = _parse_ref(ref)
    doc = await _col(source).find_one({"_id": oid})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Appointment not found")
    return source, doc


# ── Dates and times ─────────────────────────────────────────────────────────

_TIME_FORMATS = ("%I:%M %p", "%I %p", "%H:%M")


def _parse_time_label(raw: str) -> Optional[time]:
    """
    "10:00 AM" (a member slot), "14:30" (an <input type=time>), or the legacy
    "09:00 - 10:00 AM" range, whose start and meridiem are what matter.
    """
    s = (raw or "").strip()
    if " - " in s:
        start, rest = s.split(" - ", 1)
        meridiem = rest.strip().split(" ")[-1].upper()
        s = f"{start.strip()} {meridiem}" if meridiem in ("AM", "PM") else start.strip()
    for fmt in _TIME_FORMATS:
        try:
            return datetime.strptime(s.upper(), fmt).time()
        except ValueError:
            continue
    return None


def _time_label(t: time) -> str:
    """The member app's slot format: zero-padded, "09:00 AM"."""
    return t.strftime("%I:%M %p")


def _parse_iso_date(raw: str):
    try:
        return datetime.strptime((raw or "").strip(), "%Y-%m-%d").date()
    except ValueError:
        return None


def _starts_at(doc: dict) -> Optional[datetime]:
    """
    The session as an instant in Indian time, or None when the row cannot
    say — a legacy "May 20" label has no year, and guessing one would put a
    fixture back on the calendar as if it were real.
    """
    d = _parse_iso_date(doc.get("date", ""))
    if d is None:
        return None
    t = _parse_time_label(doc.get("time", "")) or time(0, 0)
    return datetime.combine(d, t).replace(tzinfo=IST)


def _duration_minutes(raw: Optional[str]) -> int:
    s = (raw or "").strip().lower()
    if not s:
        return DEFAULT_DURATION_MIN
    head = s.split(" ")[0]
    try:
        n = float(head)
    except ValueError:
        return DEFAULT_DURATION_MIN
    if "hour" in s or "hr" in s:
        return int(round(n * 60))
    return int(round(n))


def _iso(when) -> Optional[str]:
    if isinstance(when, datetime):
        return aware(when).isoformat()
    return None


def _when_label(doc: dict) -> str:
    """For an audit line: '22 Aug 2026, 11:00 AM' or the raw labels if undated."""
    s = _starts_at(doc)
    if s:
        return s.strftime("%-d %b %Y, %I:%M %p")
    return f'{doc.get("date", "")} {doc.get("time", "")}'.strip() or "no date"


# ── Status ──────────────────────────────────────────────────────────────────

def _admin_status(doc: dict) -> str:
    raw = str(doc.get("status") or "").lower()
    if raw == "cancelled":
        return NO_SHOW if doc.get("no_show") else CANCELLED
    if raw == "completed":
        return COMPLETED
    # upcoming, the legacy "Rescheduled", or anything unrecognised: still on.
    return CONFIRMED if doc.get("confirmed_at") else BOOKED


# ── Shaping ─────────────────────────────────────────────────────────────────

def _entry_out(e: dict) -> dict:
    return {
        "action": e.get("action", ""),
        "text": e.get("text", ""),
        "by_name": e.get("by_name", ""),
        "at": _iso(e.get("at")) or "",
        "detail": e.get("detail", ""),
    }


def _shape(source: str, doc: dict, people: dict[str, dict]) -> dict:
    starts = _starts_at(doc)
    minutes = _duration_minutes(doc.get("duration"))
    ends = starts + timedelta(minutes=minutes) if starts else None

    if source == SOURCE_MEMBER:
        who = people.get(doc.get("member_id") or "") or people.get(f"u:{doc.get('user_id', '')}") or {}
        name = who.get("full_name") or "Member"
        contact = who.get("phone") or who.get("email") or ""
        service = doc.get("service_name", "")
    else:
        name = doc.get("name", "")
        contact = doc.get("phone") or doc.get("email") or ""
        service = doc.get("service", "")

    st = _admin_status(doc)
    legacy_rescheduled = 1 if str(doc.get("status")) == "Rescheduled" else 0
    return {
        "id": str(doc["_id"]),
        "ref": f"{source}:{doc['_id']}",
        "source": source,
        "name": name,
        "member_id": (doc.get("member_id") or "") if source == SOURCE_MEMBER else "",
        "contact": contact,
        "service": service,
        "service_id": doc.get("service_id", "") or "",
        "date": doc.get("date", "") or "",
        "time": doc.get("time", "") or "",
        "starts_at": starts.isoformat() if starts else None,
        "ends_at": ends.isoformat() if ends else None,
        "undated": starts is None,
        "duration": doc.get("duration") or "",
        "duration_minutes": minutes,
        "mode": doc.get("mode", "") or "",
        "with_whom": doc.get("with_whom", "") or "",
        "status": st,
        "status_label": STATUS_LABEL[st],
        "note": doc.get("note") or doc.get("notes") or "",
        "cancelled_reason": doc.get("cancelled_reason") or "",
        "no_show": bool(doc.get("no_show")),
        "rescheduled_count": int(doc.get("rescheduled_count") or legacy_rescheduled),
        "confirmed_at": _iso(doc.get("confirmed_at")),
        "completed_at": _iso(doc.get("completed_at")),
        "cancelled_at": _iso(doc.get("cancelled_at")),
        "internal_notes": [_entry_out(n) for n in (doc.get("internal_notes") or [])],
        "history": [_entry_out(h) for h in (doc.get("history") or [])],
        "created_by_name": doc.get("created_by_name", "") or "",
        "created_at": _iso(doc.get("created_at")),
        "updated_at": _iso(doc.get("updated_at")),
    }


async def _people_for(bookings: list[dict]) -> dict[str, dict]:
    """Names and a contact for every booking's member, in two queries."""
    member_ids, user_ids = [], []
    for b in bookings:
        for key, bucket in (("member_id", member_ids), ("user_id", user_ids)):
            raw = b.get(key) or ""
            try:
                bucket.append(ObjectId(raw))
            except (InvalidId, TypeError):
                continue
    out: dict[str, dict] = {}
    fields = {"full_name": 1, "phone": 1, "email": 1}
    if member_ids:
        async for m in _members().find({"_id": {"$in": member_ids}}, fields):
            out[str(m["_id"])] = m
    if user_ids:
        async for u in _users().find({"_id": {"$in": user_ids}}, fields):
            out[f"u:{u['_id']}"] = u
    return out


async def _shape_one(source: str, doc: dict) -> dict:
    people = await _people_for([doc]) if source == SOURCE_MEMBER else {}
    return _shape(source, doc, people)


async def _load_all() -> list[dict]:
    """Every session from both collections, shaped, with `_starts` kept as a
    datetime for sorting and scoping (stripped before it leaves)."""
    bookings = [d async for d in _bookings().find({})]
    staff = [d async for d in _staff().find({})]
    people = await _people_for(bookings)
    rows = [_shape(SOURCE_MEMBER, d, people) for d in bookings]
    rows += [_shape(SOURCE_STAFF, d, {}) for d in staff]
    for r in rows:
        r["_starts"] = datetime.fromisoformat(r["starts_at"]) if r["starts_at"] else None
    return rows


def _strip(rows: list[dict]) -> list[dict]:
    """Copies without the private sort key. Copies, because the caller's other
    lists still share these dicts and still need `_starts`."""
    return [{k: v for k, v in r.items() if k != "_starts"} for r in rows]


def _in_scope(r: dict, scope: str, now: datetime) -> bool:
    s = r["_starts"]
    if scope == "today":
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        return s is not None and day_start <= s < day_start + timedelta(days=1)
    if scope == "upcoming":
        return s is not None and s >= now and r["status"] in OPEN
    if scope == "past":
        return (s is not None and s < now) or r["status"] not in OPEN
    return True


def _sort(rows: list[dict], scope: str) -> list[dict]:
    """Soonest first for what is ahead; most recent first for what is behind.
    Undated rows go last either way — they are the ones needing attention,
    not the ones needing to be first."""
    far = datetime.max.replace(tzinfo=IST)
    if scope in ("today", "upcoming"):
        return sorted(rows, key=lambda r: r["_starts"] or far)
    return sorted(rows, key=lambda r: (r["_starts"] is None, -(r["_starts"] or far).timestamp()))


# ── Reads ───────────────────────────────────────────────────────────────────

@router.get(
    "", summary="List appointments across members' bookings and staff entries",
    dependencies=[Depends(require_permission("appointments.view"))],
)
async def list_appointments(
    scope: Scope = Query("upcoming"),
    status_filter: Optional[str] = Query(None, alias="status", description="booked|confirmed|completed|cancelled|no_show"),
    service: Optional[str] = Query(None),
    source: Optional[str] = Query(None, description="member|staff"),
    undated: Optional[bool] = Query(None, description="true = only rows with no real date"),
    q: Optional[str] = Query(None, description="Search by name, service or contact"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    _: dict = Depends(get_current_user),
):
    now = datetime.now(IST)
    rows = await _load_all()

    # Tab counts are of the scope alone, before the other filters, so the
    # numbers on the tabs do not shrink when a filter is on.
    counts = {s: sum(1 for r in rows if _in_scope(r, s, now)) for s in ("today", "upcoming", "past", "all")}

    rows = [r for r in rows if _in_scope(r, scope, now)]
    if status_filter and status_filter in ADMIN_STATUSES:
        rows = [r for r in rows if r["status"] == status_filter]
    if service:
        rows = [r for r in rows if r["service"] == service]
    if source in SOURCES:
        rows = [r for r in rows if r["source"] == source]
    if undated is not None:
        rows = [r for r in rows if r["undated"] == undated]
    if q and q.strip():
        needle = q.strip().lower()
        rows = [r for r in rows if needle in f'{r["name"]} {r["service"]} {r["contact"]}'.lower()]

    rows = _sort(rows, scope)
    total = len(rows)
    start = (page - 1) * page_size
    items = _strip(rows[start:start + page_size])
    return {"items": items, "counts": counts, **page_meta(total, page, page_size)}


@router.get(
    "/stats", summary="Live appointment figures",
    dependencies=[Depends(require_permission("appointments.view"))],
)
async def appointment_stats(_: dict = Depends(get_current_user)):
    now = datetime.now(IST)
    month_ago = now - timedelta(days=30)
    rows = await _load_all()

    def starts(r):
        return r["_starts"]

    today = [r for r in rows if _in_scope(r, "today", now) and r["status"] in (*OPEN, COMPLETED)]
    upcoming = [r for r in rows if _in_scope(r, "upcoming", now)]
    needs_confirmation = [r for r in upcoming if r["status"] == BOOKED]
    completed_30d = [
        r for r in rows
        if r["status"] == COMPLETED and starts(r) is not None and month_ago <= starts(r) <= now
    ]

    def _missed_recently(r):
        if r["status"] not in (CANCELLED, NO_SHOW):
            return False
        cancelled = datetime.fromisoformat(r["cancelled_at"]) if r["cancelled_at"] else None
        s = starts(r)
        return (s is not None and s >= month_ago) or (cancelled is not None and cancelled >= month_ago)

    missed_30d = [r for r in rows if _missed_recently(r)]

    by_status = {s: sum(1 for r in rows if r["status"] == s) for s in ADMIN_STATUSES}
    service_counts: dict[str, int] = {}
    for r in rows:
        if r["service"]:
            service_counts[r["service"]] = service_counts.get(r["service"], 0) + 1
    by_service = [
        {"name": name, "value": n}
        for name, n in sorted(service_counts.items(), key=lambda kv: (-kv[1], kv[0]))
    ][:8]

    catalogue = [
        s.get("name", "")
        async for s in _services().find({"status": "Active"}, {"name": 1}).sort("name", 1)
    ]
    services = sorted({*(n for n in catalogue if n), *service_counts.keys()}, key=str.lower)

    return {
        "today": len(today),
        "today_unconfirmed": sum(1 for r in today if r["status"] == BOOKED),
        "upcoming": len(upcoming),
        "needs_confirmation": len(needs_confirmation),
        "completed_30d": len(completed_30d),
        "missed_30d": len(missed_30d),
        "no_show_30d": sum(1 for r in missed_30d if r["status"] == NO_SHOW),
        "total": len(rows),
        "undated": sum(1 for r in rows if r["_starts"] is None),
        "by_status": by_status,
        "by_source": {s: sum(1 for r in rows if r["source"] == s) for s in SOURCES},
        "by_service": by_service,
        "services": services,
        "as_of": now.isoformat(),
    }


@router.get(
    "/{ref}", summary="One appointment, with its notes and history",
    dependencies=[Depends(require_permission("appointments.view"))],
)
async def get_appointment(ref: str, _: dict = Depends(get_current_user)):
    source, doc = await _load_one(ref)
    return await _shape_one(source, doc)


# ── Writes ──────────────────────────────────────────────────────────────────

class StaffAppointmentCreate(BaseModel):
    """A session staff enter by hand. Stored in the same shape as a booking."""

    name: str
    phone: str = ""
    service: str
    date: str                       # ISO 'YYYY-MM-DD'
    time: str                       # 'HH:MM' from the input, or '10:00 AM'
    duration: str = "60 min"
    mode: Literal["Online", "In person"] = "In person"
    with_whom: str = ""
    note: str = ""

    @field_validator("name", "service")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("This field cannot be empty")
        return v[:120]

    @field_validator("date")
    @classmethod
    def _real_date(cls, v: str) -> str:
        if _parse_iso_date(v) is None:
            raise ValueError("Date must be YYYY-MM-DD")
        return v.strip()

    @field_validator("time")
    @classmethod
    def _real_time(cls, v: str) -> str:
        t = _parse_time_label(v)
        if t is None:
            raise ValueError("Time must be HH:MM or like 10:00 AM")
        return _time_label(t)


class RescheduleBody(BaseModel):
    date: str
    time: str

    @field_validator("date")
    @classmethod
    def _date_ok(cls, v: str) -> str:
        if _parse_iso_date(v) is None:
            raise ValueError("Date must be YYYY-MM-DD")
        return v.strip()

    @field_validator("time")
    @classmethod
    def _time_ok(cls, v: str) -> str:
        t = _parse_time_label(v)
        if t is None:
            raise ValueError("Time must be HH:MM or like 10:00 AM")
        return _time_label(t)


class CancelBody(BaseModel):
    reason: str

    @field_validator("reason")
    @classmethod
    def _reason_given(cls, v: str) -> str:
        v = " ".join(v.split())
        if len(v) < 3:
            raise ValueError("Say why — she will read this reason")
        return v[:300]


class NoteBody(BaseModel):
    text: str

    @field_validator("text")
    @classmethod
    def _text_given(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("The note is empty")
        return v[:1000]


def _actor(me: dict) -> tuple[str, str]:
    return str(me.get("_id", "")), (me.get("full_name") or me.get("email") or "")


def _entry(me: dict, action: str, detail: str = "", text: str = "") -> dict:
    by, by_name = _actor(me)
    e = {"action": action, "by": by, "by_name": by_name, "at": datetime.now(timezone.utc), "detail": detail}
    if text:
        e["text"] = text
    return e


async def _apply(source: str, doc: dict, me: dict, *, action: str, detail: str,
                 set_fields: Optional[dict] = None, inc: Optional[dict] = None,
                 push: Optional[dict] = None) -> dict:
    """One update: the change, `updated_at`, and a history line, atomically."""
    update: dict = {
        "$set": {**(set_fields or {}), "updated_at": datetime.now(timezone.utc)},
        "$push": {"history": _entry(me, action, detail), **(push or {})},
    }
    if inc:
        update["$inc"] = inc
    new = await _col(source).find_one_and_update(
        {"_id": doc["_id"]}, update, return_document=ReturnDocument.AFTER,
    )
    if not new:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Appointment not found")
    return new


def _must_be_open(doc: dict, verb: str) -> str:
    st = _admin_status(doc)
    if st not in OPEN:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"This appointment is already {STATUS_LABEL[st].lower()}; it cannot be {verb}.",
        )
    return st


@router.post(
    "", status_code=status.HTTP_201_CREATED, summary="Enter an appointment by hand",
    dependencies=[Depends(require_permission("appointments.create"))],
)
async def create_appointment(
    payload: StaffAppointmentCreate, request: Request, me: dict = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    by, by_name = _actor(me)
    doc = {
        "name": payload.name,
        "phone": payload.phone.strip()[:40],
        "service": payload.service,
        "service_id": "",
        "date": payload.date,
        "time": payload.time,
        "duration": payload.duration.strip() or "60 min",
        "mode": payload.mode,
        "with_whom": payload.with_whom.strip()[:120],
        "note": payload.note.strip()[:1000],
        "status": BookingModel.STATUS_UPCOMING,
        "cancelled_reason": "",
        "no_show": False,
        "confirmed_at": None,
        "rescheduled_count": 0,
        "internal_notes": [],
        "history": [_entry(me, "created", f"{payload.date} {payload.time}")],
        "created_by": by,
        "created_by_name": by_name,
        "created_at": now,
        "updated_at": now,
    }
    res = await _staff().insert_one(doc)
    doc["_id"] = res.inserted_id
    await record(me, "appointment.create", target=str(res.inserted_id),
                 detail=f"{payload.name} · {payload.service} · {_when_label(doc)}", request=request)
    return _shape(SOURCE_STAFF, doc, {})


@router.post(
    "/{ref}/confirm", summary="Confirm a booked appointment",
    dependencies=[Depends(require_permission("appointments.edit"))],
)
async def confirm_appointment(ref: str, request: Request, me: dict = Depends(get_current_user)):
    source, doc = await _load_one(ref)
    st = _must_be_open(doc, "confirmed")
    if st == CONFIRMED:
        raise HTTPException(status.HTTP_409_CONFLICT, "This appointment is already confirmed.")
    by, _ = _actor(me)
    new = await _apply(source, doc, me, action="confirmed", detail="",
                       set_fields={"confirmed_at": datetime.now(timezone.utc), "confirmed_by": by})
    shaped = await _shape_one(source, new)
    await record(me, "appointment.confirm", target=str(doc["_id"]),
                 detail=f'{shaped["name"]} · {shaped["service"]} · {_when_label(new)}', request=request)
    return shaped


@router.post(
    "/{ref}/reschedule", summary="Move an appointment to another date and time",
    dependencies=[Depends(require_permission("appointments.edit"))],
)
async def reschedule_appointment(
    ref: str, body: RescheduleBody, request: Request, me: dict = Depends(get_current_user),
):
    source, doc = await _load_one(ref)
    _must_be_open(doc, "moved")
    before = _when_label(doc)
    if doc.get("date") == body.date and doc.get("time") == body.time:
        raise HTTPException(status.HTTP_409_CONFLICT, "That is already its date and time.")
    new = await _apply(
        source, doc, me, action="rescheduled", detail=f"{before} → {body.date} {body.time}",
        set_fields={"date": body.date, "time": body.time},
        inc={"rescheduled_count": 1},
        push={"rescheduled_from": {"date": doc.get("date", ""), "time": doc.get("time", "")}},
    )
    shaped = await _shape_one(source, new)
    await record(me, "appointment.reschedule", target=str(doc["_id"]),
                 detail=f'{shaped["name"]}: {before} → {_when_label(new)}', request=request)
    return shaped


@router.post(
    "/{ref}/cancel", summary="Cancel an appointment, with the reason she will see",
    dependencies=[Depends(require_permission("appointments.edit"))],
)
async def cancel_appointment(
    ref: str, body: CancelBody, request: Request, me: dict = Depends(get_current_user),
):
    source, doc = await _load_one(ref)
    _must_be_open(doc, "cancelled")
    by, _ = _actor(me)
    new = await _apply(
        source, doc, me, action="cancelled", detail=body.reason,
        set_fields={
            "status": BookingModel.STATUS_CANCELLED,
            "cancelled_reason": body.reason,
            "cancelled_at": datetime.now(timezone.utc),
            "cancelled_by": by,
            "no_show": False,
        },
    )
    shaped = await _shape_one(source, new)
    await record(me, "appointment.cancel", target=str(doc["_id"]),
                 detail=f'{shaped["name"]} · {shaped["service"]} · {_when_label(new)}: {body.reason}',
                 request=request)
    return shaped


@router.post(
    "/{ref}/complete", summary="Mark an appointment as completed",
    dependencies=[Depends(require_permission("appointments.edit"))],
)
async def complete_appointment(ref: str, request: Request, me: dict = Depends(get_current_user)):
    source, doc = await _load_one(ref)
    _must_be_open(doc, "marked completed")
    by, _ = _actor(me)
    new = await _apply(
        source, doc, me, action="completed", detail="",
        set_fields={
            "status": BookingModel.STATUS_COMPLETED,
            "completed_at": datetime.now(timezone.utc),
            "completed_by": by,
        },
    )
    shaped = await _shape_one(source, new)
    await record(me, "appointment.complete", target=str(doc["_id"]),
                 detail=f'{shaped["name"]} · {shaped["service"]} · {_when_label(new)}', request=request)
    return shaped


@router.post(
    "/{ref}/no-show", summary="Record that she did not attend",
    dependencies=[Depends(require_permission("appointments.edit"))],
)
async def no_show_appointment(ref: str, request: Request, me: dict = Depends(get_current_user)):
    source, doc = await _load_one(ref)
    _must_be_open(doc, "marked as a no-show")
    by, _ = _actor(me)
    new = await _apply(
        source, doc, me, action="no_show", detail=NO_SHOW_REASON,
        set_fields={
            "status": BookingModel.STATUS_CANCELLED,
            "no_show": True,
            "cancelled_reason": NO_SHOW_REASON,
            "cancelled_at": datetime.now(timezone.utc),
            "cancelled_by": by,
        },
    )
    shaped = await _shape_one(source, new)
    await record(me, "appointment.no_show", target=str(doc["_id"]),
                 detail=f'{shaped["name"]} · {shaped["service"]} · {_when_label(new)}', request=request)
    return shaped


@router.post(
    "/{ref}/notes", summary="Add an internal note (staff only ever see it)",
    dependencies=[Depends(require_permission("appointments.edit"))],
)
async def add_appointment_note(
    ref: str, body: NoteBody, request: Request, me: dict = Depends(get_current_user),
):
    source, doc = await _load_one(ref)
    new = await _apply(
        source, doc, me, action="note", detail="",
        push={"internal_notes": _entry(me, "note", text=body.text)},
    )
    shaped = await _shape_one(source, new)
    await record(me, "appointment.note", target=str(doc["_id"]),
                 detail=f'{shaped["name"]}: {body.text[:120]}', request=request)
    return shaped


@router.delete(
    "/{ref}", summary="Delete a staff-entered appointment",
    dependencies=[Depends(require_permission("appointments.delete"))],
)
async def delete_appointment(ref: str, request: Request, me: dict = Depends(get_current_user)):
    source, doc = await _load_one(ref)
    if source == SOURCE_MEMBER:
        # Her booking is her record. Cancelling with a reason keeps it on her
        # screen with an explanation; deleting would make it vanish.
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This is a member's own booking. Cancel it with a reason instead of deleting it.",
        )
    await _staff().delete_one({"_id": doc["_id"]})
    await record(me, "appointment.delete", target=str(doc["_id"]),
                 detail=f'{doc.get("name", "")} · {doc.get("service", "")} · {_when_label(doc)}',
                 request=request)
    return {"message": "Appointment deleted"}


# ── Seeding ─────────────────────────────────────────────────────────────────

async def seed() -> None:
    """
    Nothing to seed. Real sessions come from members booking them and from
    staff entering them; an empty diary is shown as empty. Kept because
    `seed_all` imports this name.
    """
    return None
