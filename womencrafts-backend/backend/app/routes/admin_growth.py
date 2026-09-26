"""
Staff side of events, mentors and paid work.

The member routers are read-mostly and scoped to one account. These are the
opposite: they create the inventory members browse, and they move applications
along the ladder that members watch.

── Every number is counted, not stored ──────────────────────────────────────
The documents carry counters — `registered_count`, `applicant_count`,
`sessions_done` — and the seeders fill them with plausible figures that no row
backs. A staff screen showing "33 registered" for an event nobody has signed up
to is worse than showing nothing, so every count here is an aggregate over the
rows it claims to summarise: registrations, applications, requests, sessions.
The member routers still maintain their counters for seat-capacity checks; that
is their concern and it is untouched.

── Every status change tells the member, and every write is audited ─────────
A pipeline that staff can move silently is how people end up waiting three
weeks for news that already exists. And a decision nobody can attribute is a
decision nobody can question — `record()` writes who, what, which row and why.
"""

import asyncio
import csv
import io
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status

from app.core import mongosafe
from app.core.audit import record
from app.core.deps import get_current_user
from app.core.permissions import require_permission
from app.core.serializers import to_object_id
from app.db.mongodb import get_database
from app.models.conversation import notify
from app.models.growth import (
    ApplicationModel,
    EventModel,
    EventRegistrationModel,
    MentorModel,
    MentorshipRequestModel,
    OpportunityModel,
    parse_pay,
)
from app.models.user import UserModel
from app.schemas.growth_admin import (
    ApplicationDecide,
    ApplicationRow,
    AttendeeStatus,
    EventAttendee,
    EventCancel,
    EventRow,
    EventUpsert,
    GrowthSummary,
    HistoryEntry,
    MentorRequestDecide,
    MentorRequestRow,
    MentorRow,
    MentorSessionCreate,
    MentorSessionRow,
    MentorUpsert,
    OpportunityRow,
    OpportunityUpsert,
)
from app.schemas.me import MessageResponse

router = APIRouter(prefix="/admin/growth", tags=["Staff · Growth"])

#: Sessions staff log after they happen. Its own collection so "sessions" on
#: the mentor screen is a count of things that occurred, not a seeded integer.
SESSIONS_COLLECTION = "mentor_sessions"

#: A registration that still holds a seat.
_HOLDING_SEAT = {"$in": ["registered", "attended"]}


def _events():
    return get_database()[EventModel.collection_name]


def _registrations():
    return get_database()[EventRegistrationModel.collection_name]


def _mentors():
    return get_database()[MentorModel.collection_name]


def _requests():
    return get_database()[MentorshipRequestModel.collection_name]


def _sessions():
    return get_database()[SESSIONS_COLLECTION]


def _opportunities():
    return get_database()[OpportunityModel.collection_name]


def _applications():
    return get_database()[ApplicationModel.collection_name]


def _users():
    return get_database()[UserModel.collection_name]


# --- shared helpers ------------------------------------------------------------

def _day(value) -> str:
    return value.strftime("%b %d, %Y") if isinstance(value, datetime) else ""


def _today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _actor_name(me: dict) -> str:
    return me.get("full_name") or me.get("email") or ""


async def _member_map(user_ids: list[str]) -> dict[str, dict]:
    """One lookup for a page of rows, instead of one per row."""
    oids = []
    for uid in set(user_ids):
        try:
            oids.append(ObjectId(uid))
        except Exception:  # noqa: BLE001 - a malformed id just means no match
            continue
    if not oids:
        return {}
    rows = await _users().find(
        {"_id": {"$in": oids}},
        {"full_name": 1, "email": 1, "phone": 1, "member_id": 1},
    ).to_list(len(oids))
    return {str(r["_id"]): r for r in rows}


async def _count_by(coll, match: dict, key: str) -> dict[str, int]:
    """{value of `key`: how many rows match} — one aggregate for a whole page."""
    rows = await coll.aggregate([
        {"$match": match},
        {"$group": {"_id": f"${key}", "n": {"$sum": 1}}},
    ]).to_list(10000)
    return {str(r["_id"]): int(r["n"]) for r in rows}


# --- events --------------------------------------------------------------------

def _event_row(d: dict, registered: int, attended: int) -> EventRow:
    base = EventModel.to_response(d)
    seats = int(base["seats"] or 0)
    return EventRow(
        **{k: v for k, v in base.items() if k not in ("registered", "full", "seats_left")},
        registered_count=registered,
        attended_count=attended,
        seats_left=max(seats - registered, 0) if seats else 0,
        status=d.get("status", "draft"),
        cancel_reason=d.get("cancel_reason", ""),
    )


async def _event_rows(docs: list[dict]) -> list[EventRow]:
    ids = [str(d["_id"]) for d in docs]
    if not ids:
        return []
    holding, attended = await asyncio.gather(
        _count_by(_registrations(), {"event_id": {"$in": ids}, "status": _HOLDING_SEAT}, "event_id"),
        _count_by(_registrations(), {"event_id": {"$in": ids}, "status": "attended"}, "event_id"),
    )
    return [_event_row(d, holding.get(str(d["_id"]), 0), attended.get(str(d["_id"]), 0)) for d in docs]


async def _one_event(doc: dict) -> EventRow:
    return (await _event_rows([doc]))[0]


@router.get("/events", response_model=list[EventRow], summary="All events",
    dependencies=[Depends(require_permission("growth.view"))],
)
async def list_events(
    q: str = Query("", max_length=80),
    status_filter: str = Query("", alias="status", max_length=20),
    me: dict = Depends(get_current_user),
):
    query: dict = {}
    if status_filter:
        query["status"] = status_filter
    if q.strip():
        query.update(mongosafe.any_of(q, ["title", "host"]))
    docs = await _events().find(query).sort("date", -1).to_list(300)
    return await _event_rows(docs)


@router.post(
    "/events",
    response_model=EventRow,
    status_code=status.HTTP_201_CREATED,
    summary="Create an event",
    dependencies=[Depends(require_permission("growth.create"))],
)
async def create_event(body: EventUpsert, request: Request, me: dict = Depends(get_current_user)):
    doc = EventModel.create_document(
        title=body.title, desc=body.desc, category=body.category, date_iso=body.date,
        time=body.time, duration=body.duration, mode=body.mode, venue=body.venue,
        host=body.host, seats=body.seats, fee=body.fee, language=body.language,
        status=body.status,
    )
    result = await _events().insert_one(doc)
    doc["_id"] = result.inserted_id
    await record(
        me, "growth.event.create", target=str(result.inserted_id),
        detail=f"Created event '{body.title}' on {body.date or 'no date'} ({body.status})",
        request=request,
    )
    return _event_row(doc, 0, 0)


@router.put("/events/{event_id}", response_model=EventRow, summary="Update an event",
    dependencies=[Depends(require_permission("growth.edit"))],
)
async def update_event(
    event_id: str, body: EventUpsert, request: Request, me: dict = Depends(get_current_user)
):
    updates = body.model_dump()
    updates["updated_at"] = datetime.now(timezone.utc)
    doc = await _events().find_one_and_update(
        {"_id": to_object_id(event_id)}, {"$set": updates}, return_document=True
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That event doesn't exist")
    await record(
        me, "growth.event.edit", target=event_id,
        detail=f"Edited event '{body.title}' ({body.status})",
        request=request,
    )
    return await _one_event(doc)


@router.post("/events/{event_id}/cancel", response_model=EventRow, summary="Cancel an event",
    dependencies=[Depends(require_permission("growth.delete"))],
)
async def cancel_event(
    event_id: str, body: EventCancel, request: Request, me: dict = Depends(get_current_user)
):
    """
    Cancelling, never deleting: members have this in their calendar, so they get
    told — with the reason — rather than finding an empty screen.
    """
    oid = to_object_id(event_id)
    existing = await _events().find_one({"_id": oid})
    if not existing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That event doesn't exist")
    if existing.get("status") == "cancelled":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That event is already cancelled")

    now = datetime.now(timezone.utc)
    doc = await _events().find_one_and_update(
        {"_id": oid},
        {"$set": {
            "status": "cancelled", "cancel_reason": body.reason,
            "cancelled_by": _actor_name(me), "cancelled_at": now, "updated_at": now,
        }},
        return_document=True,
    )

    db = get_database()
    told = 0
    async for reg in _registrations().find({"event_id": event_id, "status": _HOLDING_SEAT}):
        await notify(
            db, reg["user_id"],
            "An event has been cancelled",
            f"{doc.get('title', 'The event')} on {doc.get('date', '')} is no longer going ahead. {body.reason}",
            "event", "/app/events",
        )
        told += 1
    await record(
        me, "growth.event.cancel", target=event_id,
        detail=f"Cancelled '{doc.get('title', '')}' — {body.reason} ({told} registered told)",
        request=request,
    )
    return await _one_event(doc)


def _attendee(r: dict, u: dict) -> EventAttendee:
    return EventAttendee(
        id=str(r["_id"]),
        name=u.get("full_name", "—"),
        email=u.get("email", ""),
        phone=u.get("phone", ""),
        member_code=u.get("member_id", ""),
        status=r.get("status", "registered"),
        registered_on=_day(r.get("created_at")),
    )


async def _attendees_of(event_id: str) -> list[EventAttendee]:
    regs = await _registrations().find({"event_id": event_id}).sort("created_at", 1).to_list(5000)
    members = await _member_map([r["user_id"] for r in regs])
    return [_attendee(r, members.get(r["user_id"], {})) for r in regs]


@router.get(
    "/events/{event_id}/attendees",
    response_model=list[EventAttendee],
    summary="Who is coming",
    dependencies=[Depends(require_permission("growth.view"))],
)
async def event_attendees(event_id: str, me: dict = Depends(get_current_user)):
    return await _attendees_of(event_id)


@router.get(
    "/events/{event_id}/attendees/export",
    summary="The attendee list as a CSV",
    dependencies=[Depends(require_permission("growth.view"))],
)
async def export_attendees(event_id: str, request: Request, me: dict = Depends(get_current_user)):
    event = await _events().find_one({"_id": to_object_id(event_id)})
    if not event:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That event doesn't exist")
    rows = [["Name", "Member code", "Email", "Phone", "Status", "Registered on"]]
    for a in await _attendees_of(event_id):
        rows.append([a.name, a.member_code, a.email, a.phone, a.status, a.registered_on])
    buf = io.StringIO()
    csv.writer(buf).writerows(rows)
    slug = "".join(c if c.isalnum() else "-" for c in event.get("title", "event").lower()).strip("-")[:40] or "event"
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    # A read, but one that leaves the building: names and phone numbers on a
    # file somebody downloaded. Recorded for that reason.
    await record(
        me, "growth.event.export", target=event_id,
        detail=f"Downloaded the attendee list of '{event.get('title', '')}' as CSV ({len(rows) - 1} rows)",
        request=request,
    )
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="womsakhi-{slug}-attendees-{stamp}.csv"'},
    )


@router.patch(
    "/events/{event_id}/attendees/{registration_id}",
    response_model=EventAttendee,
    summary="Mark her attended, or take her off the list",
    dependencies=[Depends(require_permission("growth.edit"))],
)
async def update_attendee(
    event_id: str,
    registration_id: str,
    body: AttendeeStatus,
    request: Request,
    me: dict = Depends(get_current_user),
):
    oid = to_object_id(event_id)
    reg = await _registrations().find_one({"_id": to_object_id(registration_id), "event_id": event_id})
    if not reg:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That registration doesn't exist")
    was = reg.get("status", "registered")
    if was == body.status:
        members = await _member_map([reg["user_id"]])
        return _attendee(reg, members.get(reg["user_id"], {}))

    # The member router's seat counter counts rows that hold a seat. Keep it
    # honest across staff edits too, or the capacity check on the member side
    # drifts away from the list staff are looking at.
    if body.status == "cancelled":
        await _events().update_one(
            {"_id": oid, "registered_count": {"$gt": 0}}, {"$inc": {"registered_count": -1}}
        )
    elif was == "cancelled":
        event = await _events().find_one({"_id": oid})
        seats = (event or {}).get("seats", 0) or 0
        if seats:
            claimed = await _events().find_one_and_update(
                {"_id": oid, "$expr": {"$lt": ["$registered_count", "$seats"]}},
                {"$inc": {"registered_count": 1}},
            )
            if not claimed:
                raise HTTPException(status.HTTP_409_CONFLICT, "This event is full")
        else:
            await _events().update_one({"_id": oid}, {"$inc": {"registered_count": 1}})

    reg = await _registrations().find_one_and_update(
        {"_id": reg["_id"]},
        {"$set": {"status": body.status, "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    if body.status == "cancelled":
        await notify(
            get_database(), reg["user_id"],
            "Your event registration was cancelled",
            f"The team took you off the list for {reg.get('event_title', 'an event')}. "
            "If that's a mistake, message us and we'll put you back.",
            "event", "/app/events",
        )
    members = await _member_map([reg["user_id"]])
    u = members.get(reg["user_id"], {})
    await record(
        me, f"growth.attendee.{body.status}", target=registration_id,
        detail=f"{u.get('full_name', 'A member')} marked {body.status} for '{reg.get('event_title', '')}' (was {was})",
        request=request,
    )
    return _attendee(reg, u)


# --- mentors -------------------------------------------------------------------

def _mentor_row(d: dict, pending: int, accepted: int, sessions: int) -> MentorRow:
    base = MentorModel.to_response(d)
    return MentorRow(
        id=base["id"], name=base["name"], headline=base["headline"], bio=base["bio"],
        photo=base["photo"], expertise=base["expertise"], languages=base["languages"],
        experience_years=base["experience_years"], location=base["location"],
        availability=base["availability"],
        status=d.get("status", "active"),
        open_requests=pending, mentees=accepted, sessions=sessions,
        created_on=_day(d.get("created_at")),
    )


async def _mentor_rows(docs: list[dict]) -> list[MentorRow]:
    ids = [str(d["_id"]) for d in docs]
    if not ids:
        return []
    pending, accepted, sessions = await asyncio.gather(
        _count_by(_requests(), {"mentor_id": {"$in": ids}, "status": "pending"}, "mentor_id"),
        _count_by(_requests(), {"mentor_id": {"$in": ids}, "status": "accepted"}, "mentor_id"),
        _count_by(_sessions(), {"mentor_id": {"$in": ids}}, "mentor_id"),
    )
    return [
        _mentor_row(d, pending.get(str(d["_id"]), 0), accepted.get(str(d["_id"]), 0), sessions.get(str(d["_id"]), 0))
        for d in docs
    ]


async def _one_mentor(doc: dict) -> MentorRow:
    return (await _mentor_rows([doc]))[0]


@router.get("/mentors", response_model=list[MentorRow], summary="All mentors",
    dependencies=[Depends(require_permission("growth.view"))],
)
async def list_mentors(
    q: str = Query("", max_length=80),
    status_filter: str = Query("", alias="status", max_length=20),
    me: dict = Depends(get_current_user),
):
    query: dict = {}
    if status_filter:
        query["status"] = status_filter
    if q.strip():
        query.update(mongosafe.any_of(q, ["name", "headline", "expertise"]))
    docs = await _mentors().find(query).sort("created_at", -1).to_list(300)
    return await _mentor_rows(docs)


@router.post(
    "/mentors",
    response_model=MentorRow,
    status_code=status.HTTP_201_CREATED,
    summary="Add a mentor",
    dependencies=[Depends(require_permission("growth.create"))],
)
async def create_mentor(body: MentorUpsert, request: Request, me: dict = Depends(get_current_user)):
    doc = MentorModel.create_document(
        name=body.name, headline=body.headline, bio=body.bio, photo=body.photo,
        expertise=body.expertise, languages=body.languages,
        experience_years=body.experience_years, location=body.location,
        availability=body.availability, status=body.status,
    )
    result = await _mentors().insert_one(doc)
    doc["_id"] = result.inserted_id
    await record(
        me, "growth.mentor.create", target=str(result.inserted_id),
        detail=f"Added mentor {body.name} ({', '.join(body.expertise) or 'no expertise listed'})",
        request=request,
    )
    return _mentor_row(doc, 0, 0, 0)


@router.put("/mentors/{mentor_id}", response_model=MentorRow, summary="Update a mentor",
    dependencies=[Depends(require_permission("growth.edit"))],
)
async def update_mentor(
    mentor_id: str, body: MentorUpsert, request: Request, me: dict = Depends(get_current_user)
):
    updates = body.model_dump()
    updates["updated_at"] = datetime.now(timezone.utc)
    doc = await _mentors().find_one_and_update(
        {"_id": to_object_id(mentor_id)}, {"$set": updates}, return_document=True
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That mentor doesn't exist")
    # Requests carry her name denormalised; a rename must follow it there.
    await _requests().update_many({"mentor_id": mentor_id}, {"$set": {"mentor_name": body.name}})
    await record(
        me, "growth.mentor.edit", target=mentor_id,
        detail=f"Edited mentor {body.name} ({body.status})",
        request=request,
    )
    return await _one_mentor(doc)


async def _set_mentor_status(mentor_id: str, new_status: str) -> dict:
    doc = await _mentors().find_one_and_update(
        {"_id": to_object_id(mentor_id)},
        {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That mentor doesn't exist")
    return doc


@router.delete("/mentors/{mentor_id}", response_model=MentorRow, summary="Retire a mentor",
    dependencies=[Depends(require_permission("growth.delete"))],
)
async def retire_mentor(mentor_id: str, request: Request, me: dict = Depends(get_current_user)):
    """She stops appearing to members. Her record, requests and sessions stay."""
    doc = await _set_mentor_status(mentor_id, "retired")
    await record(
        me, "growth.mentor.retire", target=mentor_id,
        detail=f"Retired mentor {doc.get('name', '')} — no longer shown to members",
        request=request,
    )
    return await _one_mentor(doc)


@router.post("/mentors/{mentor_id}/reactivate", response_model=MentorRow, summary="Bring a mentor back",
    dependencies=[Depends(require_permission("growth.edit"))],
)
async def reactivate_mentor(mentor_id: str, request: Request, me: dict = Depends(get_current_user)):
    doc = await _set_mentor_status(mentor_id, "active")
    await record(
        me, "growth.mentor.reactivate", target=mentor_id,
        detail=f"Reactivated mentor {doc.get('name', '')} — shown to members again",
        request=request,
    )
    return await _one_mentor(doc)


def _session_row(s: dict) -> MentorSessionRow:
    return MentorSessionRow(
        id=str(s["_id"]),
        mentor_id=s.get("mentor_id", ""),
        request_id=s.get("request_id", ""),
        member_name=s.get("member_name", "—"),
        held_on=s.get("held_on", ""),
        note=s.get("note", ""),
        logged_by=s.get("logged_by", ""),
        logged_on=_day(s.get("created_at")),
    )


@router.get("/mentors/{mentor_id}/sessions", response_model=list[MentorSessionRow],
    summary="Sessions she has given",
    dependencies=[Depends(require_permission("growth.view"))],
)
async def mentor_sessions(mentor_id: str, me: dict = Depends(get_current_user)):
    docs = await _sessions().find({"mentor_id": mentor_id}).sort("created_at", -1).to_list(500)
    return [_session_row(s) for s in docs]


@router.post("/mentors/{mentor_id}/sessions", response_model=MentorSessionRow,
    status_code=status.HTTP_201_CREATED,
    summary="Log a session that happened",
    dependencies=[Depends(require_permission("growth.create"))],
)
async def log_session(
    mentor_id: str, body: MentorSessionCreate, request: Request, me: dict = Depends(get_current_user)
):
    mentor = await _mentors().find_one({"_id": to_object_id(mentor_id)})
    if not mentor:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That mentor doesn't exist")
    req = await _requests().find_one({"_id": to_object_id(body.request_id), "mentor_id": mentor_id})
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That request isn't with this mentor")
    if req.get("status") != "accepted":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Only an accepted request can have a session logged against it"
        )
    members = await _member_map([req["user_id"]])
    member_name = members.get(req["user_id"], {}).get("full_name", "—")
    now = datetime.now(timezone.utc)
    doc = {
        "mentor_id": mentor_id,
        "request_id": body.request_id,
        "user_id": req["user_id"],
        "member_name": member_name,
        "held_on": body.held_on or _today(),
        "note": body.note.strip(),
        "logged_by": _actor_name(me),
        "logged_by_id": str(me.get("_id", "")),
        "created_at": now,
    }
    result = await _sessions().insert_one(doc)
    doc["_id"] = result.inserted_id
    # The member directory sorts on this counter; a real session should move it.
    await _mentors().update_one({"_id": mentor["_id"]}, {"$inc": {"sessions_done": 1}})
    await record(
        me, "growth.session.log", target=str(result.inserted_id),
        detail=f"Logged a session: {mentor.get('name', '')} with {member_name} on {doc['held_on']}",
        request=request,
    )
    return _session_row(doc)


# --- mentorship requests -------------------------------------------------------

def _request_row(d: dict, members: dict[str, dict]) -> MentorRequestRow:
    u = members.get(d.get("user_id", ""), {})
    return MentorRequestRow(
        **MentorshipRequestModel.to_response(d),
        member_name=u.get("full_name", "—"),
        member_email=u.get("email", ""),
        member_code=u.get("member_id", ""),
        staff_note=d.get("staff_note", ""),
        decided_by=d.get("decided_by", ""),
        decided_on=_day(d.get("decided_at")),
    )


@router.get(
    "/mentor-requests",
    response_model=list[MentorRequestRow],
    summary="Mentorship requests",
    dependencies=[Depends(require_permission("growth.view"))],
)
async def list_mentor_requests(
    status_filter: str = Query("", alias="status", max_length=20),
    mentor_id: str = Query("", max_length=40),
    me: dict = Depends(get_current_user),
):
    query: dict = {}
    if status_filter:
        query["status"] = status_filter
    if mentor_id:
        query["mentor_id"] = mentor_id
    docs = await _requests().find(query).sort("created_at", -1).to_list(300)
    members = await _member_map([d["user_id"] for d in docs])
    return [_request_row(d, members) for d in docs]


@router.patch(
    "/mentor-requests/{request_id}",
    response_model=MentorRequestRow,
    summary="Decide a mentorship request, or hand it to another mentor",
    dependencies=[Depends(require_permission("growth.approve"))],
)
async def decide_mentor_request(
    request_id: str,
    body: MentorRequestDecide,
    request: Request,
    me: dict = Depends(get_current_user),
):
    oid = to_object_id(request_id)
    existing = await _requests().find_one({"_id": oid})
    if not existing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That request doesn't exist")
    if body.status == "declined" and not body.staff_note:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Say why — she is told this")

    now = datetime.now(timezone.utc)
    updates: dict = {"status": body.status, "staff_note": body.staff_note, "updated_at": now}
    if body.status != "pending":
        updates["decided_by"] = _actor_name(me)
        updates["decided_at"] = now

    reassigned_from = ""
    if body.mentor_id and body.mentor_id != existing.get("mentor_id"):
        mentor = await _mentors().find_one({"_id": to_object_id(body.mentor_id), "status": "active"})
        if not mentor:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "That mentor isn't active")
        reassigned_from = existing.get("mentor_name", "")
        updates["mentor_id"] = body.mentor_id
        updates["mentor_name"] = mentor.get("name", "")
        updates["reassigned_from"] = reassigned_from

    doc = await _requests().find_one_and_update({"_id": oid}, {"$set": updates}, return_document=True)

    mentor_name = doc.get("mentor_name", "Your mentor")
    if body.status == "accepted":
        title = f"We've matched you with {mentor_name}" if reassigned_from else f"{mentor_name} said yes"
        msg = body.staff_note or "We'll be in touch to set up a time."
        if reassigned_from and not body.staff_note:
            msg = f"{reassigned_from} couldn't take this on, so we've introduced you to {mentor_name} instead. We'll be in touch to set up a time."
    elif body.status == "declined":
        title, msg = "About your mentorship request", body.staff_note
    elif body.status == "closed":
        title, msg = "Your mentorship request was closed", body.staff_note or "Thank you — this one is complete."
    else:
        title, msg = "Your mentorship request was updated", body.staff_note
    if msg:
        await notify(get_database(), doc["user_id"], title, msg, "mentorship", "/app/mentors")

    members = await _member_map([doc["user_id"]])
    who = members.get(doc["user_id"], {}).get("full_name", "a member")
    detail = f"Request from {who} to {mentor_name} marked {body.status}"
    if reassigned_from:
        detail += f" (handed over from {reassigned_from})"
    if body.staff_note:
        detail += f": {body.staff_note[:160]}"
    await record(me, f"growth.request.{body.status}", target=request_id, detail=detail, request=request)
    return _request_row(doc, members)


# --- opportunities -------------------------------------------------------------

def _opportunity_row(d: dict, applicants: int) -> OpportunityRow:
    base = OpportunityModel.to_response(d)
    return OpportunityRow(
        **{k: v for k, v in base.items() if k not in ("applied", "saved", "cover", "applicant_count")},
        applicant_count=applicants,
    )


async def _opportunity_rows(docs: list[dict]) -> list[OpportunityRow]:
    ids = [str(d["_id"]) for d in docs]
    if not ids:
        return []
    applicants = await _count_by(
        _applications(),
        {"opportunity_id": {"$in": ids}, "status": {"$ne": ApplicationModel.STATUS_WITHDRAWN}},
        "opportunity_id",
    )
    return [_opportunity_row(d, applicants.get(str(d["_id"]), 0)) for d in docs]


async def _one_opportunity(doc: dict) -> OpportunityRow:
    return (await _opportunity_rows([doc]))[0]


@router.get("/opportunities", response_model=list[OpportunityRow], summary="All opportunities",
    dependencies=[Depends(require_permission("growth.view"))],
)
async def list_opportunities(
    q: str = Query("", max_length=80),
    kind: str = Query("", max_length=30),
    status_filter: str = Query("", alias="status", max_length=20),
    me: dict = Depends(get_current_user),
):
    query: dict = {}
    if kind:
        query["kind"] = kind
    if status_filter:
        query["status"] = status_filter
    if q.strip():
        query.update(mongosafe.any_of(q, ["title", "org", "skills"]))
    docs = await _opportunities().find(query).sort("created_at", -1).to_list(300)
    return await _opportunity_rows(docs)


@router.post(
    "/opportunities",
    response_model=OpportunityRow,
    status_code=status.HTTP_201_CREATED,
    summary="Post an opportunity",
    dependencies=[Depends(require_permission("growth.create"))],
)
async def create_opportunity(
    body: OpportunityUpsert, request: Request, me: dict = Depends(get_current_user)
):
    doc = OpportunityModel.create_document(
        title=body.title, org=body.org, kind=body.kind, desc=body.desc,
        location=body.location, mode=body.mode, pay=body.pay, skills=body.skills,
        openings=body.openings, deadline=body.deadline, experience=body.experience,
        contact_note=body.contact_note, status=body.status,
        pay_low_minor=body.pay_low_minor, pay_high_minor=body.pay_high_minor,
        pay_period=body.pay_period,
    )
    result = await _opportunities().insert_one(doc)
    doc["_id"] = result.inserted_id
    await record(
        me, "growth.opportunity.create", target=str(result.inserted_id),
        detail=f"Posted {body.kind.lower()} '{body.title}' at {body.org or 'an unnamed employer'} ({body.openings} openings, {body.status})",
        request=request,
    )
    return _opportunity_row(doc, 0)


@router.put(
    "/opportunities/{opp_id}",
    response_model=OpportunityRow,
    summary="Update an opportunity",
    dependencies=[Depends(require_permission("growth.edit"))],
)
async def update_opportunity(
    opp_id: str, body: OpportunityUpsert, request: Request, me: dict = Depends(get_current_user)
):
    updates = body.model_dump()
    updates["updated_at"] = datetime.now(timezone.utc)

    # `model_dump()` includes the three pay overrides, and they are None unless
    # the caller set them — `$set`ting that straight in would null the figures
    # on every ordinary edit, leaving the board unfilterable again one save
    # after the migration fixed it. Re-derive from the text instead, and let an
    # explicit override win.
    low, high, period = parse_pay(body.pay)
    if body.pay_low_minor is not None:
        low = int(body.pay_low_minor)
    if body.pay_high_minor is not None:
        high = int(body.pay_high_minor)
    if body.pay_period is not None:
        period = body.pay_period
    if high < low:
        low, high = high, low
    updates["pay_low_minor"], updates["pay_high_minor"], updates["pay_period"] = low, high, period

    doc = await _opportunities().find_one_and_update(
        {"_id": to_object_id(opp_id)}, {"$set": updates}, return_document=True
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That opportunity doesn't exist")
    # Applications carry the title and employer denormalised.
    await _applications().update_many(
        {"opportunity_id": opp_id}, {"$set": {"opportunity_title": body.title, "org": body.org}}
    )
    await record(
        me, "growth.opportunity.edit", target=opp_id,
        detail=f"Edited '{body.title}' at {body.org or 'an unnamed employer'} ({body.status})",
        request=request,
    )
    return await _one_opportunity(doc)


async def _set_opportunity_status(opp_id: str, new_status: str) -> dict:
    doc = await _opportunities().find_one_and_update(
        {"_id": to_object_id(opp_id)},
        {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That opportunity doesn't exist")
    return doc


@router.delete("/opportunities/{opp_id}", response_model=OpportunityRow, summary="Close it",
    dependencies=[Depends(require_permission("growth.delete"))],
)
async def close_opportunity(opp_id: str, request: Request, me: dict = Depends(get_current_user)):
    """Closed, never deleted — women have applications against it."""
    doc = await _set_opportunity_status(opp_id, "closed")
    await record(
        me, "growth.opportunity.close", target=opp_id,
        detail=f"Closed '{doc.get('title', '')}' at {doc.get('org', '')} — no longer accepts applications",
        request=request,
    )
    return await _one_opportunity(doc)


@router.post("/opportunities/{opp_id}/reopen", response_model=OpportunityRow, summary="Open it again",
    dependencies=[Depends(require_permission("growth.edit"))],
)
async def reopen_opportunity(opp_id: str, request: Request, me: dict = Depends(get_current_user)):
    doc = await _set_opportunity_status(opp_id, "open")
    await record(
        me, "growth.opportunity.reopen", target=opp_id,
        detail=f"Reopened '{doc.get('title', '')}' at {doc.get('org', '')}",
        request=request,
    )
    return await _one_opportunity(doc)


# --- applications --------------------------------------------------------------

def _history(d: dict) -> list[HistoryEntry]:
    out = []
    for h in d.get("history", []) or []:
        at = h.get("at")
        out.append(HistoryEntry(
            status=h.get("status", ""),
            at=at.isoformat() if isinstance(at, datetime) else str(at or ""),
            by=h.get("by", ""),
            note=h.get("note", ""),
        ))
    return out


def _application_row(d: dict, members: dict[str, dict]) -> ApplicationRow:
    u = members.get(d.get("user_id", ""), {})
    base = ApplicationModel.to_response(d)
    return ApplicationRow(
        id=base["id"],
        opportunity_id=base["opportunity_id"],
        opportunity_title=base["opportunity_title"],
        org=base["org"],
        note=base["note"],
        status=base["status"],
        staff_note=base["staff_note"],
        applied_on=base["applied_on"],
        updated_on=_day(d.get("updated_at")),
        member_name=u.get("full_name", "—"),
        member_email=u.get("email", ""),
        member_phone=d.get("phone") or u.get("phone", ""),
        member_code=u.get("member_id", ""),
        history=_history(d),
    )


@router.get("/applications", response_model=list[ApplicationRow], summary="Applications",
    dependencies=[Depends(require_permission("growth.view"))],
)
async def list_applications(
    opportunity_id: str = Query("", max_length=40),
    status_filter: str = Query("", alias="status", max_length=20),
    me: dict = Depends(get_current_user),
):
    query: dict = {}
    if opportunity_id:
        query["opportunity_id"] = opportunity_id
    if status_filter:
        query["status"] = status_filter
    docs = await _applications().find(query).sort("created_at", -1).to_list(500)
    members = await _member_map([d["user_id"] for d in docs])
    return [_application_row(d, members) for d in docs]


@router.patch(
    "/applications/{app_id}",
    response_model=ApplicationRow,
    summary="Move an application along",
    dependencies=[Depends(require_permission("growth.approve"))],
)
async def decide_application(
    app_id: str, body: ApplicationDecide, request: Request, me: dict = Depends(get_current_user)
):
    oid = to_object_id(app_id)
    existing = await _applications().find_one({"_id": oid})
    if not existing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That application doesn't exist")
    if existing.get("status") == ApplicationModel.STATUS_WITHDRAWN:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "She withdrew this one — it can't be moved")
    if existing.get("status") == body.status:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"It is already {body.status}")
    if body.status == ApplicationModel.STATUS_CLOSED and not body.staff_note:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Say why — a decline with no reason is the thing everyone hates")

    now = datetime.now(timezone.utc)
    doc = await _applications().find_one_and_update(
        {"_id": oid},
        {
            "$set": {"status": body.status, "staff_note": body.staff_note, "updated_at": now},
            "$push": {"history": {
                "status": body.status, "at": now, "by": _actor_name(me), "note": body.staff_note,
            }},
        },
        return_document=True,
    )

    headlines = {
        "shortlisted": "You've been shortlisted",
        "interview": "They'd like to interview you",
        "offered": "You have an offer",
        "closed": "About your application",
        "applied": "Your application was updated",
    }
    await notify(
        get_database(), doc["user_id"],
        headlines.get(body.status, "Your application was updated"),
        body.staff_note or f"{doc.get('opportunity_title', '')} at {doc.get('org', '')}.",
        "opportunity", "/app/applications",
    )

    members = await _member_map([doc["user_id"]])
    who = members.get(doc["user_id"], {}).get("full_name", "a member")
    await record(
        me, f"growth.application.{body.status}", target=app_id,
        detail=f"{who}'s application for '{doc.get('opportunity_title', '')}' moved {existing.get('status', '')} → {body.status}"
               + (f": {body.staff_note[:160]}" if body.staff_note else ""),
        request=request,
    )
    return _application_row(doc, members)


# --- the numbers on the tiles -----------------------------------------------------

@router.get("/summary", response_model=GrowthSummary, summary="Every count the five screens show",
    dependencies=[Depends(require_permission("growth.view"))],
)
async def summary(me: dict = Depends(get_current_user)):
    """
    Counted from rows, over the whole collection — not over whichever page a
    screen happens to have loaded, and never from a stored counter.
    """
    ev, reg, men, req, ses, opp, app = (
        _events(), _registrations(), _mentors(), _requests(), _sessions(), _opportunities(), _applications()
    )
    today = _today()

    async def openings_total() -> int:
        rows = await opp.aggregate([
            {"$match": {"status": "open"}},
            {"$group": {"_id": None, "n": {"$sum": {"$ifNull": ["$openings", 0]}}}},
        ]).to_list(1)
        return int(rows[0]["n"]) if rows else 0

    (
        e_total, e_pub, e_draft, e_canc, e_up, e_regs,
        m_total, m_active, m_retired, r_pending, r_accepted, r_declined, r_total, s_total,
        o_total, o_open, o_closed, o_apps, o_openings,
        a_total, a_applied, a_short, a_int, a_off, a_closed, a_wd,
    ) = await asyncio.gather(
        ev.count_documents({}),
        ev.count_documents({"status": "published"}),
        ev.count_documents({"status": "draft"}),
        ev.count_documents({"status": "cancelled"}),
        ev.count_documents({"status": "published", "date": {"$gte": today}}),
        reg.count_documents({"status": _HOLDING_SEAT}),
        men.count_documents({}),
        men.count_documents({"status": "active"}),
        men.count_documents({"status": "retired"}),
        req.count_documents({"status": "pending"}),
        req.count_documents({"status": "accepted"}),
        req.count_documents({"status": "declined"}),
        req.count_documents({}),
        ses.count_documents({}),
        opp.count_documents({}),
        opp.count_documents({"status": "open"}),
        opp.count_documents({"status": "closed"}),
        app.count_documents({"status": {"$ne": ApplicationModel.STATUS_WITHDRAWN}}),
        openings_total(),
        app.count_documents({}),
        app.count_documents({"status": "applied"}),
        app.count_documents({"status": "shortlisted"}),
        app.count_documents({"status": "interview"}),
        app.count_documents({"status": "offered"}),
        app.count_documents({"status": "closed"}),
        app.count_documents({"status": "withdrawn"}),
    )
    return GrowthSummary(
        events={"total": e_total, "published": e_pub, "draft": e_draft, "cancelled": e_canc,
                "upcoming": e_up, "registrations": e_regs},
        mentors={"total": m_total, "active": m_active, "retired": m_retired,
                 "pending_requests": r_pending, "mentees": r_accepted, "sessions": s_total},
        requests={"total": r_total, "pending": r_pending, "accepted": r_accepted, "declined": r_declined},
        opportunities={"total": o_total, "open": o_open, "closed": o_closed,
                       "applications": o_apps, "openings": o_openings},
        applications={"total": a_total, "applied": a_applied, "shortlisted": a_short,
                      "interview": a_int, "offered": a_off, "closed": a_closed, "withdrawn": a_wd},
    )
