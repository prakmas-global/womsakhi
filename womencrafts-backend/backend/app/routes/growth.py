"""
Events, mentors, and paid work.

The livelihood half of the product. A member finishes a programme and this is
where she goes next: a workshop to attend, a woman to learn from, an order or a
job to apply for — with a status she can actually watch move.

Ownership rule is unchanged: every "mine" query is filtered by the user id on
the token, and no endpoint accepts a member id from the client.
"""

import asyncio

from datetime import date, datetime, timedelta, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core import mongosafe
from app.core.rbac import require_active_member
from app.core.serializers import to_object_id
from app.core import cache
from app.db.mongodb import get_database
from app.models.conversation import notify
from app.models.growth import (
    ApplicationModel,
    EventModel,
    EventRegistrationModel,
    MentorModel,
    MentorshipRequestModel,
    OpportunityModel,
)
from app.schemas.growth import (
    ApplicationCreate,
    ApplicationResponse,
    EventResponse,
    MentorResponse,
    MentorshipRequestCreate,
    MentorshipRequestResponse,
    OpportunityResponse,
)
from app.schemas.me import MessageResponse

router = APIRouter(prefix="/growth", tags=["Member · Growth"])


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


def _today() -> str:
    return date.today().isoformat()


# --- events ------------------------------------------------------------------

@router.get("/events", response_model=list[EventResponse], summary="Workshops and events")
async def list_events(
    category: str = Query("", max_length=60),
    mode: str = Query("", max_length=20),
    mine: bool = Query(False, description="Only the ones I've registered for"),
    past: bool = Query(False, description="Include events that have already happened"),
    me: dict = Depends(require_active_member),
):
    user_id = str(me["_id"])

    query: dict = {"status": "published"}
    if not past:
        query["date"] = {"$gte": _today()}
    if category:
        query["category"] = category
    if mode:
        query["mode"] = mode

    order = 1 if not past else -1

    async def _registered_ids() -> set[str]:
        regs = await _registrations().find(
            {"user_id": user_id, "status": "registered"}, {"event_id": 1}
        ).to_list(500)
        return {r["event_id"] for r in regs}

    if mine:
        # A real dependency: her registrations decide which events to fetch, so
        # this one has to wait. Two round trips is the floor here.
        registered = await _registered_ids()
        if not registered:
            return []
        query["_id"] = {"$in": [ObjectId(e) for e in registered]}
        docs = await _events().find(query).sort("date", order).to_list(100)
    else:
        # Browsing the calendar, her registrations only tick "you're going" on
        # the way out — the board itself is built from the query string. Sent
        # together they cost one trip to Atlas rather than two.
        registered, docs = await asyncio.gather(
            _registered_ids(),
            _events().find(query).sort("date", order).to_list(100),
        )

    return [EventModel.to_response(d, str(d["_id"]) in registered) for d in docs]


@router.get("/events/{event_id}", response_model=EventResponse, summary="One event")
async def get_event(event_id: str, me: dict = Depends(require_active_member)):
    doc = await _events().find_one({"_id": to_object_id(event_id), "status": "published"})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That event doesn't exist")
    reg = await _registrations().find_one(
        {"user_id": str(me["_id"]), "event_id": event_id, "status": "registered"}
    )
    return EventModel.to_response(doc, bool(reg))


@router.post("/events/{event_id}/register", response_model=EventResponse, summary="Register for an event")
async def register_for_event(event_id: str, me: dict = Depends(require_active_member)):
    user_id = str(me["_id"])
    oid = to_object_id(event_id)
    event = await _events().find_one({"_id": oid, "status": "published"})
    if not event:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That event doesn't exist")
    if event.get("date") and event["date"] < _today():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That event has already happened")

    existing = await _registrations().find_one({"user_id": user_id, "event_id": event_id})
    if existing and existing.get("status") == "registered":
        return EventModel.to_response(event, True)

    seats = event.get("seats", 0) or 0
    if seats:
        # Claim the seat and check capacity in ONE atomic update. Doing it as a
        # read-then-write lets two members take the last seat at the same time.
        claimed = await _events().find_one_and_update(
            {"_id": oid, "$expr": {"$lt": ["$registered_count", "$seats"]}},
            {"$inc": {"registered_count": 1}},
            return_document=True,
        )
        if not claimed:
            raise HTTPException(status.HTTP_409_CONFLICT, "This event is full")
        event = claimed
    else:
        await _events().update_one({"_id": oid}, {"$inc": {"registered_count": 1}})
        event["registered_count"] = event.get("registered_count", 0) + 1

    if existing:
        await _registrations().update_one(
            {"_id": existing["_id"]}, {"$set": {"status": "registered"}}
        )
    else:
        await _registrations().insert_one(
            EventRegistrationModel.create_document(
                user_id, me.get("member_id", ""), event_id, event.get("title", "")
            )
        )

    db = get_database()
    await notify(
        db, user_id,
        "You're registered",
        f"{event.get('title', 'The event')} · {event.get('date', '')} at {event.get('time', '')}",
        "event", f"/app/events/{event_id}",
    )
    return EventModel.to_response(event, True)


@router.post("/events/{event_id}/cancel", response_model=EventResponse, summary="Cancel my registration")
async def cancel_registration(event_id: str, me: dict = Depends(require_active_member)):
    user_id = str(me["_id"])
    oid = to_object_id(event_id)
    event = await _events().find_one({"_id": oid})
    if not event:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That event doesn't exist")

    updated = await _registrations().update_one(
        {"user_id": user_id, "event_id": event_id, "status": "registered"},
        {"$set": {"status": "cancelled"}},
    )
    if updated.modified_count:
        await _events().update_one(
            {"_id": oid, "registered_count": {"$gt": 0}}, {"$inc": {"registered_count": -1}}
        )
        event["registered_count"] = max(event.get("registered_count", 1) - 1, 0)
    return EventModel.to_response(event, False)


# --- mentors -----------------------------------------------------------------

@router.get("/mentors", response_model=list[MentorResponse], summary="Mentors")
async def list_mentors(
    q: str = Query("", max_length=80),
    expertise: str = Query("", max_length=60),
    me: dict = Depends(require_active_member),
):
    user_id = str(me["_id"])

    query: dict = {"status": "active"}
    filtered = False
    if expertise:
        query["expertise"] = expertise
        filtered = True
    if q.strip():
        query.update(mongosafe.any_of(q, ["name", "headline", "expertise"]))
        filtered = True

    async def _load() -> list[dict]:
        return await (
            _mentors().find(query).sort([("rating", -1), ("sessions_done", -1)]).to_list(100)
        )

    # The mentor list is the same for everybody; whether she has already asked
    # one is not. Shared half cached, personal half fetched, merged here — and
    # the two run together, so both cost one round trip rather than two.
    docs, open_requests = await asyncio.gather(
        _load() if filtered else cache.cached("growth:mentors", cache.SHARED_TTL, _load),
        _requests().find(
            {"user_id": user_id, "status": {"$in": ["pending", "accepted"]}}, {"mentor_id": 1}
        ).to_list(200),
    )
    requested = {r["mentor_id"] for r in open_requests}
    return [MentorModel.to_response(d, str(d["_id"]) in requested) for d in docs]


@router.get("/mentors/{mentor_id}", response_model=MentorResponse, summary="One mentor")
async def get_mentor(mentor_id: str, me: dict = Depends(require_active_member)):
    doc = await _mentors().find_one({"_id": to_object_id(mentor_id), "status": "active"})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That mentor isn't available")
    req = await _requests().find_one(
        {"user_id": str(me["_id"]), "mentor_id": mentor_id, "status": {"$in": ["pending", "accepted"]}}
    )
    return MentorModel.to_response(doc, bool(req))


@router.post(
    "/mentors/{mentor_id}/request",
    response_model=MentorshipRequestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ask a mentor for time",
)
async def request_mentor(
    mentor_id: str,
    body: MentorshipRequestCreate,
    me: dict = Depends(require_active_member),
):
    user_id = str(me["_id"])
    mentor = await _mentors().find_one({"_id": to_object_id(mentor_id), "status": "active"})
    if not mentor:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That mentor isn't available")

    open_req = await _requests().find_one(
        {"user_id": user_id, "mentor_id": mentor_id, "status": {"$in": ["pending", "accepted"]}}
    )
    if open_req:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "You already have a request with her — we'll come back to you on it.",
        )

    doc = MentorshipRequestModel.create_document(
        user_id=user_id,
        member_id=me.get("member_id", ""),
        mentor_id=mentor_id,
        mentor_name=mentor.get("name", ""),
        goal=body.goal,
        preferred_time=body.preferred_time,
    )
    result = await _requests().insert_one(doc)
    doc["_id"] = result.inserted_id

    db = get_database()
    await notify(
        db, user_id,
        "We've passed your request on",
        f"You asked {mentor.get('name', 'a mentor')} for time. We'll introduce you once she confirms.",
        "mentorship", "/app/mentors",
    )
    return MentorshipRequestModel.to_response(doc)


@router.get(
    "/mentors/requests/mine",
    response_model=list[MentorshipRequestResponse],
    summary="My mentorship requests",
)
async def my_mentor_requests(me: dict = Depends(require_active_member)):
    docs = await _requests().find({"user_id": str(me["_id"])}).sort("created_at", -1).to_list(100)
    return [MentorshipRequestModel.to_response(d) for d in docs]


# --- opportunities -----------------------------------------------------------

@router.get("/opportunities", response_model=list[OpportunityResponse], summary="Work I can apply for")
async def list_opportunities(
    q: str = Query("", max_length=80),
    kind: str = Query("", max_length=30),
    mode: str = Query("", max_length=20),
    saved: bool = Query(False, description="Only the ones I saved"),
    pay_min_minor: int = Query(
        0, ge=0,
        description="Only work paying at least this much, in paise. Pair it with `period`.",
    ),
    period: str = Query(
        "", max_length=10,
        description="month | year | week | day | hour | word | piece — what the pay is per.",
    ),
    sort: str = Query(
        "recent", pattern="^(recent|pay_high|pay_low)$",
        description="recent (default) | pay_high | pay_low",
    ),
    me: dict = Depends(require_active_member),
):
    """
    The work board.

    `pay_min_minor` and `sort` became possible only once the pay figures were
    lifted out of the display string; before that `pay` was text like
    "₹14,000 – ₹18,000 / month" and neither a filter nor a sort could touch it.

    **Sorting by pay without pinning `period` is refused.** ₹180 per piece and
    ₹15,000 per month are not comparable, and a board that ranked them together
    would put the worst-paid piecework at the top for looking like a big number
    — or the other way about. Better to ask which one she means.
    """
    user_id = str(me["_id"])
    saved_ids = set(me.get("saved_opportunities", []) or [])

    if sort != "recent" and not period:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Sorting by pay needs a period — pay per month and pay per piece aren't the same scale.",
        )

    query: dict = {"status": "open"}
    if kind:
        query["kind"] = kind
    if mode:
        query["mode"] = mode
    if period:
        query["pay_period"] = period
    if pay_min_minor:
        # Match on the TOP of the band: "₹14,000 – ₹18,000" should still appear
        # for a woman asking for ₹16,000. Filtering on the low end would hide
        # work she can actually get.
        query["pay_high_minor"] = {"$gte": pay_min_minor}
    if saved:
        if not saved_ids:
            return []
        query["_id"] = {"$in": [ObjectId(o) for o in saved_ids]}
    if q.strip():
        query.update(mongosafe.any_of(q, ["title", "org", "skills"]))

    order = {
        "recent": [("created_at", -1)],
        "pay_high": [("pay_high_minor", -1), ("created_at", -1)],
        "pay_low": [("pay_low_minor", 1), ("created_at", -1)],
    }[sort]

    # Her applications and the board itself have nothing to say to each other —
    # the query is built from `me` and the query string, not from the
    # applications. Sent together they cost one trip to Atlas instead of two.
    apps, docs = await asyncio.gather(
        _applications().find(
            {"user_id": user_id, "status": {"$ne": ApplicationModel.STATUS_WITHDRAWN}},
            {"opportunity_id": 1},
        ).to_list(500),
        _opportunities().find(query).sort(order).to_list(100),
    )
    applied = {a["opportunity_id"] for a in apps}
    return [
        OpportunityModel.to_response(d, str(d["_id"]) in applied, str(d["_id"]) in saved_ids)
        for d in docs
    ]


@router.get("/opportunities/{opp_id}", response_model=OpportunityResponse, summary="One opportunity")
async def get_opportunity(opp_id: str, me: dict = Depends(require_active_member)):
    doc = await _opportunities().find_one({"_id": to_object_id(opp_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That opportunity doesn't exist")
    applied = await _applications().find_one(
        {
            "user_id": str(me["_id"]),
            "opportunity_id": opp_id,
            "status": {"$ne": ApplicationModel.STATUS_WITHDRAWN},
        }
    )
    saved_ids = set(me.get("saved_opportunities", []) or [])
    return OpportunityModel.to_response(doc, bool(applied), opp_id in saved_ids)


@router.post("/opportunities/{opp_id}/save", response_model=MessageResponse, summary="Save or unsave")
async def toggle_saved(opp_id: str, me: dict = Depends(require_active_member)):
    doc = await _opportunities().find_one({"_id": to_object_id(opp_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That opportunity doesn't exist")

    users = get_database()["users"]
    saved = opp_id in set(me.get("saved_opportunities", []) or [])
    await users.update_one(
        {"_id": me["_id"]},
        {"$pull" if saved else "$addToSet": {"saved_opportunities": opp_id}},
    )
    return {"message": "Removed from saved" if saved else "Saved"}


@router.post(
    "/opportunities/{opp_id}/apply",
    response_model=ApplicationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Apply",
)
async def apply(opp_id: str, body: ApplicationCreate, me: dict = Depends(require_active_member)):
    user_id = str(me["_id"])
    oid = to_object_id(opp_id)
    opp = await _opportunities().find_one({"_id": oid})
    if not opp:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That opportunity doesn't exist")
    if opp.get("status") != "open":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Applications for this have closed")
    if opp.get("deadline") and opp["deadline"] < _today():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The deadline for this has passed")

    existing = await _applications().find_one({"user_id": user_id, "opportunity_id": opp_id})
    if existing and existing.get("status") != ApplicationModel.STATUS_WITHDRAWN:
        raise HTTPException(status.HTTP_409_CONFLICT, "You've already applied for this")
    if existing:
        # She withdrew and is applying again — the unique index means we replace
        # the old record rather than adding a second one.
        await _applications().delete_one({"_id": existing["_id"]})

    doc = ApplicationModel.create_document(
        user_id=user_id,
        member_id=me.get("member_id", ""),
        opportunity_id=opp_id,
        opportunity_title=opp.get("title", ""),
        org=opp.get("org", ""),
        note=body.note,
        phone=body.phone or me.get("phone", ""),
    )
    result = await _applications().insert_one(doc)
    doc["_id"] = result.inserted_id
    await _opportunities().update_one({"_id": oid}, {"$inc": {"applicant_count": 1}})

    db = get_database()
    await notify(
        db, user_id,
        "Application sent",
        f"{opp.get('title', '')} at {opp.get('org', '')}. We'll tell you the moment it moves.",
        "opportunity", "/app/applications",
    )
    return ApplicationModel.to_response(doc)


@router.get("/applications", response_model=list[ApplicationResponse], summary="My applications")
async def my_applications(me: dict = Depends(require_active_member)):
    docs = await _applications().find({"user_id": str(me["_id"])}).sort("created_at", -1).to_list(200)
    return [ApplicationModel.to_response(d) for d in docs]


@router.post(
    "/applications/{app_id}/withdraw",
    response_model=ApplicationResponse,
    summary="Withdraw an application",
)
async def withdraw(app_id: str, me: dict = Depends(require_active_member)):
    user_id = str(me["_id"])
    now = datetime.now(timezone.utc)
    doc = await _applications().find_one_and_update(
        {
            "_id": to_object_id(app_id),
            "user_id": user_id,
            "status": {"$nin": [ApplicationModel.STATUS_WITHDRAWN, ApplicationModel.STATUS_CLOSED]},
        },
        {
            "$set": {"status": ApplicationModel.STATUS_WITHDRAWN, "updated_at": now},
            "$push": {"history": {"status": ApplicationModel.STATUS_WITHDRAWN, "at": now}},
        },
        return_document=True,
    )
    if not doc:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "That application isn't yours, or it's already closed"
        )
    await _opportunities().update_one(
        {"_id": to_object_id(doc["opportunity_id"]), "applicant_count": {"$gt": 0}},
        {"$inc": {"applicant_count": -1}},
    )
    return ApplicationModel.to_response(doc)


# --- seed --------------------------------------------------------------------

# (days from today, title, category, mode, time, duration, host, seats, venue, language, desc)
_SEED_EVENTS = [
    (3, "Price your work without apologising", "Workshop", "Online", "6:00 PM", "90 min",
     "Lakshmi Reddy", 60, "", "Hindi & English",
     "The most common reason women's businesses stay small is under-pricing. We'll cost a real product together, line by line, and you'll leave with your own number."),
    (6, "WhatsApp Business, start to finish", "Workshop", "Online", "11:00 AM", "2 hours",
     "Priya Nair", 40, "", "Hindi",
     "Catalogue, auto-replies, payment links and labels. Bring your phone charged — you'll set it up live, not watch a slideshow."),
    (10, "Craft mela — sell with us for a day", "Mela", "In person", "10:00 AM", "Full day",
     "WomSakhi team", 25, "Community Hall, Sector 12", "All languages",
     "A stall, a table and footfall, at no cost to you. You keep everything you take. We handle the permissions and the publicity."),
    (14, "Know your rights at work", "Talk", "Online", "5:30 PM", "1 hour",
     "Adv. Ritu Bansal", 0, "", "Hindi & English",
     "Maternity leave, equal pay, and what the POSH Act actually entitles you to. A lawyer answers your questions, plainly."),
    (18, "Interview practice — bring your nerves", "Workshop", "Online", "4:00 PM", "2 hours",
     "Neha Gupta", 20, "", "Hindi",
     "Small group, real mock interviews, honest feedback. Especially for women returning after a break."),
    (24, "Managing money when income is uneven", "Workshop", "In person", "3:00 PM", "2 hours",
     "Kavita Sharma", 35, "WomSakhi Centre, Ground Floor", "Hindi",
     "Saving when some months are good and some are empty. Simple methods that work on a real, irregular income."),
]

_SEED_MENTORS = [
    ("Lakshmi Reddy", "Runs a 12-woman tailoring unit in Hyderabad",
     ["Tailoring", "Pricing", "Small business"], ["Telugu", "Hindi", "English"], 14, "Hyderabad",
     "Weekends",
     "I started on one machine in 2011 with no idea what I was doing. I know exactly which mistakes cost the most, because I made all of them. Ask me about pricing, staff, or the first big order that scares you."),
    ("Adv. Ritu Bansal", "Employment lawyer, 9 years",
     ["Legal", "Workplace rights", "Registration"], ["Hindi", "English", "Punjabi"], 9, "Delhi",
     "Tuesday & Thursday evenings",
     "I help women understand what the law already gives them. Most of my work is telling someone she has a stronger position than she thought."),
    ("Priya Nair", "Digital trainer, taught 2,000+ women",
     ["Digital Literacy", "WhatsApp Business", "Online selling"], ["Malayalam", "Hindi", "English"], 7, "Kochi",
     "Weekday mornings",
     "If technology has ever made you feel stupid, that was bad teaching, not you. I go at your pace and I don't mind repeating things."),
    ("Dr. Anjali Kumar", "Community health physician",
     ["Health", "Nutrition", "Wellbeing"], ["Hindi", "English"], 16, "Jaipur",
     "Sunday afternoons",
     "General health questions women often don't get time to ask a doctor properly. I can't diagnose over a call, but I can tell you when something genuinely needs seeing."),
    ("Fatima Sheikh", "Exports handloom to three countries",
     ["Handloom", "Export", "Sourcing"], ["Urdu", "Hindi", "English"], 11, "Lucknow",
     "By arrangement",
     "Getting a craft product out of your district and into another country is mostly paperwork and patience. I'll show you the order it goes in."),
    ("Kavita Sharma", "Financial counsellor for self-employed women",
     ["Money", "Savings", "Loans"], ["Hindi", "Marathi", "English"], 12, "Pune",
     "Weekday evenings",
     "Bank loans, chit funds, and what to do when the income is different every month. No jargon, and no judgement about what's already happened."),
]

# (title, org, kind, mode, location, pay, skills, openings, days-to-deadline, experience, desc)
_SEED_OPPORTUNITIES = [
    ("Tailors for a boutique order — 200 blouses", "Ananya Boutique", "Craft order", "Remote",
     "Anywhere (courier)", "₹180 per piece", ["Tailoring", "Blouse stitching"], 8, 12, "Can stitch a lined blouse",
     "A confirmed order of 200 lined blouses, split across eight tailors. Fabric and measurements are couriered to you; you courier the finished pieces back. Payment within 7 days of delivery, per piece, no deductions."),
    ("Data entry executive", "Sunrise Services", "Job", "On-site", "Pune", "₹14,000 – ₹18,000 / month",
     ["Typing", "MS Excel", "Basic computers"], 3, 20, "Freshers welcome",
     "Full-time data entry for an insurance back-office. Training given. Women-only floor, 9:30 to 5:30, no night shifts, and the office is a two-minute walk from the bus stop."),
    ("Beautician — salon chair, revenue share", "Glow Studio", "Job", "On-site", "Bengaluru",
     "50% revenue share, ₹25,000+ typical", ["Beauty", "Hair", "Skin care"], 2, 25, "1+ year, or our certificate",
     "Not a salary job — a chair in an established salon and half of what your clients pay. Products provided. Several of our members earn more here than they did on a fixed wage."),
    ("Embroidery artisans for a festive collection", "Rangoli Exports", "Craft order", "Remote",
     "Lucknow & nearby", "₹450 – ₹900 per piece", ["Chikankari", "Embroidery", "Handwork"], 15, 18, "Chikankari experience",
     "Festive collection for an export buyer. Piece rate depends on the density of the work; the ₹900 pieces take about two days. Raw material supplied. Late payment has never happened with this buyer — we've placed 40 members with them since 2024."),
    ("Anganwadi support worker", "District Programme", "Job", "On-site", "Jaipur (rural blocks)",
     "₹11,000 / month + travel", ["Childcare", "Record keeping", "Local language"], 6, 30, "Class 10 pass",
     "Supporting anganwadi centres with nutrition records and mothers' meetings. Government-linked posting with a proper appointment letter."),
    ("Freelance content writer (Hindi)", "Digital Bharat Media", "Freelance", "Remote", "Anywhere",
     "₹1.20 per word", ["Hindi writing", "Research"], 4, 15, "Writing samples needed",
     "Articles of 800–1,200 words on health, schemes and personal finance for a Hindi readership. Work from home, your own hours, paid every fortnight."),
    ("Trainee — solar panel installation", "GreenVolt Energy", "Internship", "On-site", "Ahmedabad",
     "₹9,000 / month stipend", ["Willing to learn", "Physically active work"], 10, 22, "No experience needed",
     "Six-month paid traineeship in a trade that almost no women in this state work in yet. Safety gear, training and a certificate provided; the company has committed to hiring at least half the batch."),
    ("Kitchen partner — tiffin service", "Ghar Ka Khana", "Freelance", "On-site", "Delhi NCR",
     "₹55 per tiffin, 20–40 a day", ["Cooking", "Hygiene", "Time keeping"], 12, 10, "Home kitchen",
     "Cook from your own kitchen. They collect at 11am, handle the delivery and the customers, and pay weekly. Most partners earn ₹15,000–₹30,000 a month."),
]


async def seed() -> None:
    """Fill events, mentors and opportunities once, on an empty database."""
    events = _events()
    if await events.count_documents({}) == 0:
        today = date.today()
        for days, title, category, mode, time, duration, host, seats, venue, language, desc in _SEED_EVENTS:
            doc = EventModel.create_document(
                title=title, desc=desc, category=category, mode=mode, venue=venue,
                date_iso=(today + timedelta(days=days)).isoformat(),
                time=time, duration=duration, host=host, seats=seats, language=language,
            )
            # A plausible fill, so seat counts read like a real event listing.
            doc["registered_count"] = min(int(seats * 0.55), seats) if seats else 0
            await events.insert_one(doc)

    mentors = _mentors()
    if await mentors.count_documents({}) == 0:
        for i, (name, headline, expertise, languages, years, location, availability, bio) in enumerate(_SEED_MENTORS):
            doc = MentorModel.create_document(
                name=name, headline=headline, bio=bio, expertise=expertise,
                languages=languages, experience_years=years, location=location,
                availability=availability,
            )
            doc["rating"] = round(4.6 + (i % 4) * 0.1, 1)
            doc["rating_count"] = 12 + i * 9
            doc["sessions_done"] = 20 + i * 17
            await mentors.insert_one(doc)

    opportunities = _opportunities()
    if await opportunities.count_documents({}) == 0:
        today = date.today()
        for title, org, kind, mode, location, pay, skills, openings, days, experience, desc in _SEED_OPPORTUNITIES:
            await opportunities.insert_one(
                OpportunityModel.create_document(
                    title=title, org=org, kind=kind, mode=mode, location=location, pay=pay,
                    skills=skills, openings=openings, experience=experience, desc=desc,
                    deadline=(today + timedelta(days=days)).isoformat(),
                    contact_note="Apply here and we'll pass your details on. We check every employer before listing them.",
                )
            )
