"""
Staff side of events, mentors and paid work.

The member routers are read-mostly and scoped to one account. These are the
opposite: they create the inventory members browse, and they move applications
along the ladder that members watch.

Every status change here notifies the member it belongs to. A pipeline that
staff can move silently is how people end up waiting three weeks for news that
already exists.
"""

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core import mongosafe
from app.core.permissions import require_permission
from app.core.deps import get_current_user
from app.core.serializers import to_object_id
from app.db.mongodb import get_database
from app.models.conversation import notify
from app.routes.staff_account import log_activity
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
from app.schemas.admin_modules import (
    AdminApplication,
    AdminEvent,
    AdminMentor,
    AdminMentorRequest,
    AdminOpportunity,
    ApplicationDecision,
    EventAttendee,
    EventUpsert,
    MentorRequestDecision,
    MentorUpsert,
    OpportunityUpsert,
)
from app.schemas.me import MessageResponse

router = APIRouter(prefix="/admin/growth", tags=["Staff · Growth"])


def _events():
    return get_database()[EventModel.collection_name]


def _registrations():
    return get_database()[EventRegistrationModel.collection_name]


def _mentors():
    return get_database()[MentorModel.collection_name]


def _requests():
    return get_database()[MentorshipRequestModel.collection_name]


def _opportunities():
    return get_database()[OpportunityModel.collection_name]


def _applications():
    return get_database()[ApplicationModel.collection_name]


def _users():
    return get_database()[UserModel.collection_name]


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


# --- events ------------------------------------------------------------------

@router.get("/events", response_model=list[AdminEvent], summary="All events",
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
    return [
        AdminEvent(
            **{
                k: v
                for k, v in EventModel.to_response(d).items()
                if k not in ("registered", "full")
            },
            registered_count=d.get("registered_count", 0),
            status=d.get("status", "draft"),
        )
        for d in docs
    ]


@router.post(
    "/events",
    response_model=AdminEvent,
    status_code=status.HTTP_201_CREATED,
    summary="Create an event",
    dependencies=[Depends(require_permission("growth.create"))],
)
async def create_event(body: EventUpsert, me: dict = Depends(get_current_user)):
    doc = EventModel.create_document(
        title=body.title, desc=body.desc, category=body.category, date_iso=body.date,
        time=body.time, duration=body.duration, mode=body.mode, venue=body.venue,
        host=body.host, seats=body.seats, fee=body.fee, language=body.language,
        status=body.status,
    )
    result = await _events().insert_one(doc)
    doc["_id"] = result.inserted_id
    await log_activity(me, "Created an event", "Growth", target=body.title)
    return AdminEvent(
        **{k: v for k, v in EventModel.to_response(doc).items() if k not in ("registered", "full")},
        registered_count=0,
        status=doc.get("status", "draft"),
    )


@router.put("/events/{event_id}", response_model=AdminEvent, summary="Update an event", dependencies=[Depends(require_permission("growth.edit"))])
async def update_event(event_id: str, body: EventUpsert, me: dict = Depends(get_current_user)):
    updates = body.model_dump()
    updates["updated_at"] = datetime.now(timezone.utc)
    doc = await _events().find_one_and_update(
        {"_id": to_object_id(event_id)}, {"$set": updates}, return_document=True
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That event doesn't exist")
    await log_activity(me, "Updated an event", "Growth", target=body.title)
    return AdminEvent(
        **{k: v for k, v in EventModel.to_response(doc).items() if k not in ("registered", "full")},
        registered_count=doc.get("registered_count", 0),
        status=doc.get("status", "draft"),
    )


@router.delete("/events/{event_id}", response_model=MessageResponse, summary="Cancel an event", dependencies=[Depends(require_permission("growth.delete"))])
async def cancel_event(event_id: str, me: dict = Depends(get_current_user)):
    """
    Cancelling, never deleting: members have this in their calendar, so they get
    told rather than finding an empty screen.
    """
    oid = to_object_id(event_id)
    doc = await _events().find_one_and_update(
        {"_id": oid}, {"$set": {"status": "cancelled"}}, return_document=True
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That event doesn't exist")

    db = get_database()
    async for reg in _registrations().find({"event_id": event_id, "status": "registered"}):
        await notify(
            db, reg["user_id"],
            "An event has been cancelled",
            f"{doc.get('title', 'The event')} on {doc.get('date', '')} is no longer going ahead. We're sorry.",
            "event", "/app/events",
        )
    return {"message": "Event cancelled and everyone registered has been told"}


@router.get(
    "/events/{event_id}/attendees",
    response_model=list[EventAttendee],
    summary="Who is coming",
    dependencies=[Depends(require_permission("growth.view"))],
)
async def event_attendees(event_id: str, me: dict = Depends(get_current_user)):
    regs = await _registrations().find({"event_id": event_id}).sort("created_at", 1).to_list(1000)
    members = await _member_map([r["user_id"] for r in regs])
    out = []
    for r in regs:
        u = members.get(r["user_id"], {})
        created = r.get("created_at")
        out.append(
            EventAttendee(
                id=str(r["_id"]),
                name=u.get("full_name", "—"),
                email=u.get("email", ""),
                phone=u.get("phone", ""),
                member_code=u.get("member_id", ""),
                status=r.get("status", "registered"),
                registered_on=created.strftime("%b %d, %Y") if isinstance(created, datetime) else "",
            )
        )
    return out


# --- mentors -----------------------------------------------------------------

@router.get("/mentors", response_model=list[AdminMentor], summary="All mentors",
    dependencies=[Depends(require_permission("growth.view"))],
)
async def list_mentors(q: str = Query("", max_length=80), me: dict = Depends(get_current_user)):
    query: dict = {}
    if q.strip():
        query.update(mongosafe.any_of(q, ["name", "headline"]))
    docs = await _mentors().find(query).sort("created_at", -1).to_list(300)

    pending = await _requests().aggregate([
        {"$match": {"status": "pending"}},
        {"$group": {"_id": "$mentor_id", "n": {"$sum": 1}}},
    ]).to_list(500)
    counts = {p["_id"]: p["n"] for p in pending}

    return [
        AdminMentor(
            **{k: v for k, v in MentorModel.to_response(d).items() if k != "requested"},
            status=d.get("status", "active"),
            open_requests=counts.get(str(d["_id"]), 0),
        )
        for d in docs
    ]


@router.post(
    "/mentors",
    response_model=AdminMentor,
    status_code=status.HTTP_201_CREATED,
    summary="Add a mentor",
    dependencies=[Depends(require_permission("growth.create"))],
)
async def create_mentor(body: MentorUpsert, me: dict = Depends(get_current_user)):
    doc = MentorModel.create_document(
        name=body.name, headline=body.headline, bio=body.bio, photo=body.photo,
        expertise=body.expertise, languages=body.languages,
        experience_years=body.experience_years, location=body.location,
        availability=body.availability, status=body.status,
    )
    result = await _mentors().insert_one(doc)
    doc["_id"] = result.inserted_id
    await log_activity(me, "Added a mentor", "Growth", target=body.name)
    return AdminMentor(
        **{k: v for k, v in MentorModel.to_response(doc).items() if k != "requested"},
        status=doc["status"],
        open_requests=0,
    )


@router.put("/mentors/{mentor_id}", response_model=AdminMentor, summary="Update a mentor", dependencies=[Depends(require_permission("growth.edit"))])
async def update_mentor(mentor_id: str, body: MentorUpsert, me: dict = Depends(get_current_user)):
    updates = body.model_dump()
    updates["updated_at"] = datetime.now(timezone.utc)
    doc = await _mentors().find_one_and_update(
        {"_id": to_object_id(mentor_id)}, {"$set": updates}, return_document=True
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That mentor doesn't exist")
    await log_activity(me, "Updated a mentor", "Growth", target=body.name)
    return AdminMentor(
        **{k: v for k, v in MentorModel.to_response(doc).items() if k != "requested"},
        status=doc.get("status", "active"),
        open_requests=await _requests().count_documents({"mentor_id": mentor_id, "status": "pending"}),
    )


@router.delete("/mentors/{mentor_id}", response_model=MessageResponse, summary="Retire a mentor", dependencies=[Depends(require_permission("growth.delete"))])
async def retire_mentor(mentor_id: str, me: dict = Depends(get_current_user)):
    updated = await _mentors().update_one(
        {"_id": to_object_id(mentor_id)}, {"$set": {"status": "retired"}}
    )
    if not updated.matched_count:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That mentor doesn't exist")
    return {"message": "Mentor retired — she no longer appears to members"}


@router.get(
    "/mentor-requests",
    response_model=list[AdminMentorRequest],
    summary="Mentorship requests",
    dependencies=[Depends(require_permission("growth.view"))],
)
async def list_mentor_requests(
    status_filter: str = Query("", alias="status", max_length=20),
    me: dict = Depends(get_current_user),
):
    query = {"status": status_filter} if status_filter else {}
    docs = await _requests().find(query).sort("created_at", -1).to_list(300)
    members = await _member_map([d["user_id"] for d in docs])
    return [
        AdminMentorRequest(
            **MentorshipRequestModel.to_response(d),
            member_name=members.get(d["user_id"], {}).get("full_name", "—"),
            member_email=members.get(d["user_id"], {}).get("email", ""),
            staff_note=d.get("staff_note", ""),
        )
        for d in docs
    ]


@router.patch(
    "/mentor-requests/{request_id}",
    response_model=AdminMentorRequest,
    summary="Decide a mentorship request",
    dependencies=[Depends(require_permission("growth.approve"))],
)
async def decide_mentor_request(
    request_id: str,
    body: MentorRequestDecision,
    me: dict = Depends(get_current_user),
):
    doc = await _requests().find_one_and_update(
        {"_id": to_object_id(request_id)},
        {
            "$set": {
                "status": body.status,
                "staff_note": body.staff_note,
                "updated_at": datetime.now(timezone.utc),
            }
        },
        return_document=True,
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That request doesn't exist")

    if body.status == "accepted":
        title, msg = (
            f"{doc.get('mentor_name', 'Your mentor')} said yes",
            body.staff_note or "We'll be in touch to set up a time.",
        )
    elif body.status == "declined":
        title, msg = (
            "About your mentorship request",
            body.staff_note or "She can't take this on right now. We can suggest someone else.",
        )
    else:
        title, msg = "Your mentorship request was updated", body.staff_note

    if title:
        await notify(get_database(), doc["user_id"], title, msg, "mentorship", "/app/mentors")

    members = await _member_map([doc["user_id"]])
    await log_activity(me, "Decided a mentorship request", "Growth", target=doc.get("mentor_name", ""))
    return AdminMentorRequest(
        **MentorshipRequestModel.to_response(doc),
        member_name=members.get(doc["user_id"], {}).get("full_name", "—"),
        member_email=members.get(doc["user_id"], {}).get("email", ""),
        staff_note=doc.get("staff_note", ""),
    )


# --- opportunities -----------------------------------------------------------

@router.get("/opportunities", response_model=list[AdminOpportunity], summary="All opportunities",
    dependencies=[Depends(require_permission("growth.view"))],
)
async def list_opportunities(
    q: str = Query("", max_length=80),
    kind: str = Query("", max_length=30),
    me: dict = Depends(get_current_user),
):
    query: dict = {}
    if kind:
        query["kind"] = kind
    if q.strip():
        query.update(mongosafe.any_of(q, ["title", "org"]))
    docs = await _opportunities().find(query).sort("created_at", -1).to_list(300)
    return [
        AdminOpportunity(
            **{
                k: v
                for k, v in OpportunityModel.to_response(d).items()
                if k not in ("applied", "saved", "cover")
            }
        )
        for d in docs
    ]


@router.post(
    "/opportunities",
    response_model=AdminOpportunity,
    status_code=status.HTTP_201_CREATED,
    summary="Post an opportunity",
    dependencies=[Depends(require_permission("growth.create"))],
)
async def create_opportunity(body: OpportunityUpsert, me: dict = Depends(get_current_user)):
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
    await log_activity(me, "Posted an opportunity", "Growth", target=body.title)
    return AdminOpportunity(
        **{
            k: v
            for k, v in OpportunityModel.to_response(doc).items()
            if k not in ("applied", "saved", "cover")
        }
    )


@router.put(
    "/opportunities/{opp_id}",
    response_model=AdminOpportunity,
    summary="Update an opportunity",
    dependencies=[Depends(require_permission("growth.edit"))],
)
async def update_opportunity(
    opp_id: str, body: OpportunityUpsert, me: dict = Depends(get_current_user)
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
    await log_activity(me, "Updated an opportunity", "Growth", target=body.title)
    return AdminOpportunity(
        **{
            k: v
            for k, v in OpportunityModel.to_response(doc).items()
            if k not in ("applied", "saved", "cover")
        }
    )


@router.delete("/opportunities/{opp_id}", response_model=MessageResponse, summary="Close it", dependencies=[Depends(require_permission("growth.delete"))])
async def close_opportunity(opp_id: str, me: dict = Depends(get_current_user)):
    updated = await _opportunities().update_one(
        {"_id": to_object_id(opp_id)}, {"$set": {"status": "closed"}}
    )
    if not updated.matched_count:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That opportunity doesn't exist")
    return {"message": "Closed — it no longer accepts applications"}


@router.get("/applications", response_model=list[AdminApplication], summary="Applications",
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
    out = []
    for d in docs:
        u = members.get(d["user_id"], {})
        base = ApplicationModel.to_response(d)
        out.append(
            AdminApplication(
                id=base["id"],
                opportunity_id=base["opportunity_id"],
                opportunity_title=base["opportunity_title"],
                org=base["org"],
                note=base["note"],
                status=base["status"],
                staff_note=base["staff_note"],
                applied_on=base["applied_on"],
                member_name=u.get("full_name", "—"),
                member_email=u.get("email", ""),
                member_phone=d.get("phone") or u.get("phone", ""),
                member_code=u.get("member_id", ""),
            )
        )
    return out


@router.patch(
    "/applications/{app_id}",
    response_model=AdminApplication,
    summary="Move an application along",
    dependencies=[Depends(require_permission("growth.approve"))],
)
async def decide_application(
    app_id: str, body: ApplicationDecision, me: dict = Depends(get_current_user)
):
    now = datetime.now(timezone.utc)
    doc = await _applications().find_one_and_update(
        {"_id": to_object_id(app_id)},
        {
            "$set": {"status": body.status, "staff_note": body.staff_note, "updated_at": now},
            "$push": {"history": {"status": body.status, "at": now}},
        },
        return_document=True,
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That application doesn't exist")

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
    u = members.get(doc["user_id"], {})
    base = ApplicationModel.to_response(doc)
    await log_activity(me, "Moved an application", "Growth", target=doc.get("opportunity_title", ""))
    return AdminApplication(
        id=base["id"],
        opportunity_id=base["opportunity_id"],
        opportunity_title=base["opportunity_title"],
        org=base["org"],
        note=base["note"],
        status=base["status"],
        staff_note=base["staff_note"],
        applied_on=base["applied_on"],
        member_name=u.get("full_name", "—"),
        member_email=u.get("email", ""),
        member_phone=doc.get("phone") or u.get("phone", ""),
        member_code=u.get("member_id", ""),
    )
