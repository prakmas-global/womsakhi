"""
Everything that belongs to the signed-in member.

The rule for this whole module, without exception: **the owner is taken from the
token**. No endpoint accepts a user id, member id or "whose" parameter, so there
is no id to tamper with — a member physically cannot address another member's
data. Ids in paths only ever identify a record, and every lookup is filtered by
her user id as well.

She must also be `active` (admitted) to touch any of it — `require_active_member`
enforces that on the whole router.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.rbac import require_active_member
from app.core import semantic
from app.core.matching import NEEDS, rank
from app.core.rbac import is_member
from app.core.serializers import to_object_id
from app.core.media import media_url
from app.db.mongodb import get_database
from app.models.goal import GoalModel
from app.models.wallet import WalletTxnModel
from app.routes.verification import save_document_file
from app.models.certificate import CertificateModel
from app.models.conversation import MemberMessageModel, MemberNotificationModel, notify
from app.models.enrollment import BookingModel, EnrollmentModel
from app.models.member import MemberModel
from app.models.payment import OrderModel
from app.models.program import ProgramModel
from app.models.service import ServiceModel
from app.models.user import UserModel
from app.models.verification import DocumentModel, VerificationStatus
from app.schemas.me import (
    BookingCreate,
    IntakeNeed,
    IntakeRequest,
    IntakeResponse,
    IntakeSuggestion,
    BookingResponse,
    CancelRequest,
    EnrollmentResponse,
    MeProfileResponse,
    MeProfileUpdate,
    HomeMoney,
    MeSummaryResponse,
    MemberMessage,
    MemberNotification,
    MessageResponse,
    ProgressUpdate,
    SendMessageRequest,
    UnreadCounts,
    Achievement,
    ChangePasswordBody,
    DeleteAccountRequest,
    FeedbackRequest,
    LibraryItem,
    MeJourney,
    MeShell,
    NotificationPrefs,
    ProgressResponse,
)
from app.schemas.wallet import (
    CertificateResponse,
    MyDocument,
    ProgramDetail,
    ReferralResponse,
)

router = APIRouter(prefix="/me", tags=["Member"])

log = logging.getLogger("womsakhi.me")


def _bookings():
    return get_database()[BookingModel.collection_name]


def _enrollments():
    return get_database()[EnrollmentModel.collection_name]


def _programs():
    return get_database()[ProgramModel.collection_name]


def _services():
    return get_database()[ServiceModel.collection_name]



# --- the whole shell, and the whole journey screen ---------------------------
#
# These two are the same idea `/me/summary` and `/money/overview` already
# apply, pushed at the two places that were still paying for it in requests
# rather than in queries.
#
# The rule they follow, and the reason they are not just "an endpoint that
# calls five endpoints": every leaf here is either a helper that gathers
# internally or a plain awaitable, and they are all handed to ONE `gather`. A
# nested `gather` does not cost a second wave — the inner awaitables are
# scheduled when the outer one is, so the whole thing is one round trip and
# the screen waits for the slowest query rather than the sum of all of them.
#
# The endpoints they replace are all still here. The frontend is being worked
# on in parallel by other people, and an endpoint that disappears the day a
# faster one appears is not an optimisation, it is an outage.


@router.get("/shell", response_model=MeShell, summary="Everything the member shell needs")
async def shell(me: dict = Depends(require_active_member)):
    """
    One request, one round trip, instead of six requests and eight queries.

    Every member screen booted by firing `/auth/session`, `/layout/me`,
    `/layout/me/features`, `/me/progress` and `/me/unread` — and the app fired
    that set **twice**. Six requests and eight queries before the screen asked
    for anything of its own; at ~22ms a round trip that is the better part of a
    second of a woman looking at a spinner, on a phone, on a connection that is
    usually worse than the one this was measured on.

    Nothing here is new data and nothing is computed differently. `user` is
    serialised from the document the auth dependency already holds — no query
    at all, where `/auth/session` re-read it — and `features` is a pure
    function of that document. So the only queries left are the layout row and
    the four that progress and the badges genuinely need.
    """
    # Local imports: `layout` and `auth` are peers of this module and importing
    # them at the top would make the route package's import order load-bearing.
    # `money.py` already reaches for `wallet` the same way.
    from app.core.entitlements import enabled_features
    from app.routes.auth import _user_response
    from app.routes.layout import _read as _read_layout

    uid = str(me["_id"])
    db = get_database()

    (
        user, layout, (booking_rows, enrolments), unread_notifications, unread_messages,
    ) = await asyncio.gather(
        # Costs no round trip for a member — `current_user_modules` returns []
        # for the member role without asking the database. It is in the gather
        # anyway so that the day a member role gains modules, this endpoint
        # gets slower by nothing instead of by a round trip.
        _user_response(me),
        _read_layout(uid),
        _progress_rows(uid),
        db[MemberNotificationModel.collection_name].count_documents(
            {"user_id": uid, "unread": True}
        ),
        db[MemberMessageModel.collection_name].count_documents(
            {"user_id": uid, "read_by_member": False}
        ),
    )

    return MeShell(
        user=user,
        layout=layout,
        features=enabled_features(me),
        progress=_progress_response(me, booking_rows, enrolments),
        unread=UnreadCounts(notifications=unread_notifications, messages=unread_messages),
    )


@router.get("/journey", response_model=MeJourney, summary="Everything the progress screen needs")
async def journey(me: dict = Depends(require_active_member)):
    """
    `/app/progress` in one request instead of five.

    It was `/me/progress`, `/wallet/insights`, `/shop/summary`, `/me/referrals`
    and `/community/circles` — five requests, fourteen queries, and because
    three of those endpoints ran their own waterfalls internally it was more
    round trips than requests.

    Each of the five is called through the same helper its own endpoint uses,
    so the five sections cannot drift from the five screens that already read
    them. They are all in one `gather`, so the fourteen queries leave together.
    """
    from app.routes.community import list_circles
    from app.routes.shop import summary as shop_summary
    from app.routes.wallet import insights as wallet_insights

    uid = str(me["_id"])

    (booking_rows, enrolments), insights, shop, referrals, circles = await asyncio.gather(
        _progress_rows(uid),
        wallet_insights(me),
        shop_summary(me),
        _referrals(me),
        # Called with explicit arguments, not defaults: read straight off the
        # function these would be FastAPI `Query` objects, not values, and
        # `q.strip()` would blow up inside it. This is the browse list — the
        # same thing the screen asks for with no filters on.
        list_circles(q="", mine=False, me=me),
    )

    return MeJourney(
        progress=_progress_response(me, booking_rows, enrolments),
        insights=insights,
        shop=shop,
        referrals=referrals,
        circles=circles,
    )


# --- profile -----------------------------------------------------------------

@router.get("/profile", response_model=MeProfileResponse, summary="My profile")
async def my_profile(me: dict = Depends(require_active_member)):
    profile = None
    if me.get("member_id"):
        profile = await get_database()[MemberModel.collection_name].find_one(
            {"_id": ObjectId(me["member_id"])}
        )
    return MeProfileResponse(
        **UserModel.to_response(me),
        code=(profile or {}).get("code", ""),
        location=(profile or {}).get("location", ""),
        segment=(profile or {}).get("segment", ""),
        dob=(profile or {}).get("dob", ""),
        bio=(profile or {}).get("bio", ""),
    )


@router.patch("/profile", response_model=MeProfileResponse, summary="Update my profile")
async def update_my_profile(payload: MeProfileUpdate, me: dict = Depends(require_active_member)):
    now = datetime.now(timezone.utc)
    user_updates: dict = {"updated_at": now}
    member_updates: dict = {"updated_at": now}

    if payload.full_name is not None:
        user_updates["full_name"] = payload.full_name.strip()
        member_updates["full_name"] = payload.full_name.strip()
    if payload.phone is not None:
        user_updates["phone"] = payload.phone.strip()
        member_updates["phone"] = payload.phone.strip()
    if payload.avatar is not None:
        user_updates["avatar"] = payload.avatar
        member_updates["avatar"] = payload.avatar
    if payload.locale is not None:
        user_updates["locale"] = payload.locale
    if payload.location is not None:
        member_updates["location"] = payload.location.strip()
    if payload.dob is not None:
        member_updates["dob"] = payload.dob
    if payload.bio is not None:
        member_updates["bio"] = payload.bio.strip()[:600]

    await get_database()[UserModel.collection_name].update_one(
        {"_id": me["_id"]}, {"$set": user_updates}
    )
    if me.get("member_id") and len(member_updates) > 1:
        await get_database()[MemberModel.collection_name].update_one(
            {"_id": ObjectId(me["member_id"])}, {"$set": member_updates}
        )

    fresh = await get_database()[UserModel.collection_name].find_one({"_id": me["_id"]})
    return await my_profile(fresh)


# --- home summary ------------------------------------------------------------

async def _programs_by_id(enrollments: list[dict]) -> dict[str, dict]:
    """
    Every program referenced by these enrolments, in one query.

    This exists because the obvious loop — for each enrolment, look up its
    program — cost 20 round trips and 638ms on `/me/programs`. The database is
    an Atlas cluster in another data centre: a round trip is about 50ms whatever
    it fetches, so the number that decides how slow a screen feels is how many
    times it asks, not how much it asks for.

    Asking once for all of them makes it one.

    Ids that are not valid ObjectIds are dropped rather than raising: a deleted
    or malformed reference must leave a woman's list of courses standing, just
    with that row's title missing.
    """
    ids = []
    for e in enrollments:
        raw = e.get("program_id")
        if not raw:
            continue
        try:
            ids.append(ObjectId(raw))
        except Exception:  # noqa: BLE001 - a bad id is a missing program, not an error
            continue
    if not ids:
        return {}
    docs = await _programs().find({"_id": {"$in": ids}}).to_list(len(ids))
    return {str(d["_id"]): d for d in docs}


@router.get("/summary", response_model=MeSummaryResponse, summary="What my home screen needs")
async def my_summary(me: dict = Depends(require_active_member)):
    """
    One request for the home screen, so a phone on a slow connection makes one
    call — and one round trip's worth of waiting, not nine.

    Six of the queries below do not depend on each other. Awaited one at a time
    they cost 315ms; `gather` sends them together and the screen waits for the
    slowest rather than the sum. The two that DO depend on each other — the
    enrolments, then the programs they name — stay in order, and are two
    queries rather than one per enrolment.
    """
    uid = str(me["_id"])
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_start = (month_start - timedelta(days=1)).replace(day=1)

    (
        upcoming_docs, enrolment_docs, total_bookings, total_programs, completed,
        money_rows, pending_rows, balance_rows, money_goal,
    ) = await asyncio.gather(
        _bookings()
        .find({"user_id": uid, "status": BookingModel.STATUS_UPCOMING, "date": {"$gte": today}})
        .sort("date", 1)
        .limit(3)
        .to_list(3),
        _enrollments()
        .find({"user_id": uid, "status": EnrollmentModel.STATUS_ACTIVE})
        .limit(3)
        .to_list(3),
        _bookings().count_documents({"user_id": uid}),
        _enrollments().count_documents({"user_id": uid}),
        _enrollments().count_documents(
            {"user_id": uid, "status": EnrollmentModel.STATUS_COMPLETED}
        ),
        # This month and last, in one pass over the ledger rather than two.
        get_database()[WalletTxnModel.collection_name].aggregate([
            {"$match": {"user_id": uid, "kind": WalletTxnModel.KIND_CREDIT,
                        "created_at": {"$gte": last_start}}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m", "date": "$created_at"}},
                "total": {"$sum": "$amount_minor"},
            }},
        ]).to_list(4),
        get_database()[WalletTxnModel.collection_name].aggregate([
            {"$match": {"user_id": uid, "kind": WalletTxnModel.KIND_CREDIT, "status": "pending"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount_minor"}}},
        ]).to_list(1),
        get_database()[WalletTxnModel.collection_name].aggregate([
            {"$match": {"user_id": uid}},
            {"$group": {"_id": "$kind", "total": {"$sum": "$amount_minor"}}},
        ]).to_list(4),
        get_database()[GoalModel.collection_name].find_one(
            {"user_id": uid, "kind": GoalModel.KIND_MONEY, "status": GoalModel.STATUS_OPEN},
            sort=[("created_at", -1)],
        ),
    )

    programs = await _programs_by_id(enrolment_docs)

    by_month = {r["_id"]: int(r["total"]) for r in money_rows}
    signed = {r["_id"]: int(r["total"]) for r in balance_rows}

    return MeSummaryResponse(
        full_name=me.get("full_name", ""),
        upcoming_bookings=[BookingModel.to_response(b) for b in upcoming_docs],
        active_programs=[
            EnrollmentModel.to_response(e, programs.get(str(e.get("program_id"))))
            for e in enrolment_docs
        ],
        total_bookings=total_bookings,
        total_programs=total_programs,
        completed_programs=completed,
        money=HomeMoney(
            earned_this_month_minor=by_month.get(now.strftime("%Y-%m"), 0),
            last_month_minor=by_month.get(last_start.strftime("%Y-%m"), 0),
            pending_minor=int(pending_rows[0]["total"]) if pending_rows else 0,
            balance_minor=signed.get(WalletTxnModel.KIND_CREDIT, 0)
            - signed.get(WalletTxnModel.KIND_DEBIT, 0),
            goal_minor=int((money_goal or {}).get("target", 0)),
            goal_label=(money_goal or {}).get("label", ""),
        ),
    )


@router.get("/bookings", response_model=list[BookingResponse], summary="My bookings")
async def my_bookings(
    state: Optional[str] = Query(None, description="upcoming | completed | cancelled"),
    me: dict = Depends(require_active_member),
):
    query: dict = {"user_id": str(me["_id"])}
    if state in BookingModel.STATUSES:
        query["status"] = state
    cursor = _bookings().find(query).sort("date", -1)
    return [BookingResponse(**BookingModel.to_response(b)) async for b in cursor]


@router.post(
    "/bookings",
    response_model=BookingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Book a session",
)
async def create_booking(payload: BookingCreate, me: dict = Depends(require_active_member)):
    service = await _services().find_one({"_id": to_object_id(payload.service_id)})
    if not service:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That service is no longer available")

    # One member cannot hold the same slot twice.
    clash = await _bookings().find_one({
        "user_id": str(me["_id"]),
        "service_id": payload.service_id,
        "date": payload.date,
        "time": payload.time,
        "status": BookingModel.STATUS_UPCOMING,
    })
    if clash:
        raise HTTPException(status.HTTP_409_CONFLICT, "You already have this slot booked.")

    doc = BookingModel.create_document(
        user_id=str(me["_id"]),
        member_id=me.get("member_id") or "",
        service_id=payload.service_id,
        service_name=service.get("name", ""),
        date=payload.date,
        time=payload.time,
        mode=payload.mode,
        note=payload.note,
        duration=service.get("duration", ""),
        # Prices are display strings ("₹649", "Free"), so they go through the
        # one parser that understands them. A plain float() here raised a 500
        # on every FREE service — see [[ADR-008 Money is stored in minor units]].
        price=OrderModel.parse_price(service.get("price")) / 100,
    )
    result = await _bookings().insert_one(doc)
    doc["_id"] = result.inserted_id

    await notify(
        get_database(), str(me["_id"]),
        title="Session booked",
        body=f"{service.get('name', 'Your session')} on {payload.date} at {payload.time}.",
        ntype=MemberNotificationModel.TYPE_BOOKING,
        href="/app/bookings",
    )
    return BookingResponse(**BookingModel.to_response(doc))


@router.post("/bookings/{booking_id}/cancel", response_model=BookingResponse, summary="Cancel a booking")
async def cancel_booking(
    booking_id: str,
    payload: CancelRequest,
    me: dict = Depends(require_active_member),
):
    # Filtered by her user id as well as the record id — a booking that isn't
    # hers simply does not exist as far as this endpoint is concerned.
    booking = await _bookings().find_one(
        {"_id": to_object_id(booking_id), "user_id": str(me["_id"])}
    )
    if not booking:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found")
    if booking.get("status") != BookingModel.STATUS_UPCOMING:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That booking can no longer be cancelled")

    fresh = await _bookings().find_one_and_update(
        {"_id": booking["_id"]},
        {"$set": {
            "status": BookingModel.STATUS_CANCELLED,
            "cancelled_reason": payload.reason,
            "updated_at": datetime.now(timezone.utc),
        }},
        return_document=True,
    )
    return BookingResponse(**BookingModel.to_response(fresh))


# --- programs ----------------------------------------------------------------

@router.get("/programs", response_model=list[EnrollmentResponse], summary="Programs I've joined")
async def my_programs(
    state: Optional[str] = Query(None, description="active | completed | withdrawn"),
    me: dict = Depends(require_active_member),
):
    query: dict = {"user_id": str(me["_id"])}
    if state in EnrollmentModel.STATUSES:
        query["status"] = state

    # **One query, not two — and certainly not one per enrolment.**
    #
    # This was a loop (20 round trips, 638ms), then two round trips: read the
    # enrolments, then read every program they name. Two is honest but it is
    # still a *waterfall* — the second request cannot be sent until the first
    # comes back, so it costs the full 22ms rather than nothing, and unlike the
    # gathers elsewhere in this file there is no way to overlap it, because the
    # ids to look up are the answer to the first query.
    #
    # `$lookup` moves the join to the side of the wire where the data already
    # is. `$convert ... onError: None` rather than `$toObjectId` because a
    # malformed or deleted program reference must leave her list of courses
    # standing with that row's title missing, exactly as `_programs_by_id`
    # already chose — a woman losing sight of the course she is enrolled in
    # because somebody typo'd an id is not a trade worth making.
    rows = await _enrollments().aggregate([
        {"$match": query},
        {"$sort": {"created_at": -1}},
        {"$limit": 200},
        {"$lookup": {
            "from": ProgramModel.collection_name,
            "let": {"pid": {"$convert": {
                "input": "$program_id", "to": "objectId", "onError": None, "onNull": None,
            }}},
            "pipeline": [
                {"$match": {"$expr": {"$eq": ["$_id", "$$pid"]}}},
                {"$limit": 1},
            ],
            "as": "_program",
        }},
    ]).to_list(200)

    return [
        EnrollmentResponse(**EnrollmentModel.to_response(
            e, (e.get("_program") or [None])[0],
        ))
        for e in rows
    ]


@router.post(
    "/programs/{program_id}/enroll",
    response_model=EnrollmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Join a program",
)
async def enroll(program_id: str, me: dict = Depends(require_active_member)):
    program = await _programs().find_one({"_id": to_object_id(program_id)})
    if not program:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That program is no longer available")

    existing = await _enrollments().find_one({"user_id": str(me["_id"]), "program_id": program_id})
    if existing:
        if existing.get("status") == EnrollmentModel.STATUS_WITHDRAWN:
            # Re-joining after leaving is fine; pick up where the record is.
            fresh = await _enrollments().find_one_and_update(
                {"_id": existing["_id"]},
                {"$set": {"status": EnrollmentModel.STATUS_ACTIVE, "updated_at": datetime.now(timezone.utc)}},
                return_document=True,
            )
            return EnrollmentResponse(**EnrollmentModel.to_response(fresh, program))
        raise HTTPException(status.HTTP_409_CONFLICT, "You've already joined this program.")

    cap = int(program.get("cap") or 0)
    enrolled = int(program.get("enrolled") or 0)
    if cap and enrolled >= cap:
        raise HTTPException(status.HTTP_409_CONFLICT, "This program is full.")

    doc = EnrollmentModel.create_document(
        user_id=str(me["_id"]),
        member_id=me.get("member_id") or "",
        program_id=program_id,
        program_name=program.get("name", ""),
    )
    result = await _enrollments().insert_one(doc)
    doc["_id"] = result.inserted_id

    # Keep the admin-facing counter honest.
    await _programs().update_one({"_id": program["_id"]}, {"$inc": {"enrolled": 1}})

    await notify(
        get_database(), str(me["_id"]),
        title="You joined a program",
        body=program.get("name", ""),
        ntype=MemberNotificationModel.TYPE_PROGRAM,
        href="/app/programs",
    )
    return EnrollmentResponse(**EnrollmentModel.to_response(doc, program))


@router.post("/programs/{program_id}/leave", response_model=MessageResponse, summary="Leave a program")
async def leave_program(program_id: str, me: dict = Depends(require_active_member)):
    existing = await _enrollments().find_one(
        {"user_id": str(me["_id"]), "program_id": program_id, "status": EnrollmentModel.STATUS_ACTIVE}
    )
    if not existing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "You're not enrolled in this program")

    await _enrollments().update_one(
        {"_id": existing["_id"]},
        {"$set": {"status": EnrollmentModel.STATUS_WITHDRAWN, "updated_at": datetime.now(timezone.utc)}},
    )
    await _programs().update_one(
        {"_id": to_object_id(program_id), "enrolled": {"$gt": 0}}, {"$inc": {"enrolled": -1}}
    )
    return MessageResponse(message="You've left this program.")


@router.patch(
    "/programs/{program_id}/progress",
    response_model=EnrollmentResponse,
    summary="Record progress in a program",
)
async def update_progress(
    program_id: str,
    payload: ProgressUpdate,
    me: dict = Depends(require_active_member),
):
    existing = await _enrollments().find_one({"user_id": str(me["_id"]), "program_id": program_id})
    if not existing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "You're not enrolled in this program")

    now = datetime.now(timezone.utc)
    updates: dict = {"progress": payload.progress, "last_activity_at": now, "updated_at": now}
    if payload.sessions_attended is not None:
        updates["sessions_attended"] = payload.sessions_attended
    if payload.progress >= 100:
        updates["status"] = EnrollmentModel.STATUS_COMPLETED
        updates["completed_at"] = now

    fresh = await _enrollments().find_one_and_update(
        {"_id": existing["_id"]},
        {"$set": updates},
        return_document=True,
    )
    program = await _programs().find_one({"_id": to_object_id(program_id)})
    return EnrollmentResponse(**EnrollmentModel.to_response(fresh, program))


# --- guided intake -----------------------------------------------------------

@router.get("/intake/needs", response_model=list[IntakeNeed], summary="The things she can ask for")
async def intake_needs(me: dict = Depends(require_active_member)):
    return [IntakeNeed(key=n["key"], label=n["label"], hint=n["hint"]) for n in NEEDS]


@router.post("/intake", response_model=IntakeResponse, summary="Tell us what you need")
async def intake(payload: IntakeRequest, me: dict = Depends(require_active_member)):
    """
    Turns "I want to earn from home" into real, explainable suggestions.

    The matching itself lives in app.core.matching so it can be swapped for a
    model later without changing this endpoint or the screen that calls it. Her
    answers are also kept on the account as context for that future model.
    """
    services = [
        ServiceModel.to_response(d)
        async for d in _services().find({"status": {"$in": ["Active"]}})
    ]
    programs = [
        ProgramModel.to_response(d)
        async for d in _programs().find(
            {"status": {"$in": ["Ongoing", "Upcoming", "Active", "Published"]}}
        )
    ]

    # Same forward pass, same reason — and this one runs it twice over the
    # whole catalogue.
    result = await asyncio.to_thread(rank, payload.text, payload.needs, services, programs)

    # Remember what she asked for — this is the context an assistant will use.
    await get_database()[UserModel.collection_name].update_one(
        {"_id": me["_id"]},
        {"$set": {
            "ai_context": {
                "last_intake_text": payload.text[:500],
                "needs": result["needs"],
                "updated_at": datetime.now(timezone.utc),
            }
        }},
    )

    return IntakeResponse(
        needs=result["needs"],
        matched=result["matched"],
        services=[
            IntakeSuggestion(
                id=s["id"], name=s["name"], kind="service",
                description=s.get("description", ""), reason=s.get("reason", ""),
                meta=s.get("duration", ""),
            )
            for s in result["services"]
        ],
        programs=[
            IntakeSuggestion(
                id=p["id"], name=p["name"], kind="program",
                description=p.get("desc", ""), reason=p.get("reason", ""),
                meta=p.get("category", ""),
            )
            for p in result["programs"]
        ],
    )


# --- messages ----------------------------------------------------------------

#: Strong references to the fire-and-forget writes below. Without this the only
#: reference to a bare `create_task` is the event loop's weak one, and the
#: garbage collector is free to cancel it mid-flight — a documented asyncio
#: footgun, and one that would show up as messages that sometimes stay unread.
_detached: set[asyncio.Task] = set()


def _after_response(coro) -> None:
    """
    Run a write the caller must not wait for.

    A failure here is logged, never raised: the request it belonged to has
    already been answered, so there is nobody left to raise at.
    """
    task = asyncio.create_task(coro)
    _detached.add(task)
    task.add_done_callback(_detached.discard)
    task.add_done_callback(
        lambda t: (not t.cancelled() and t.exception() is not None)
        and log.warning("detached write failed: %r", t.exception())
    )


@router.get("/messages", response_model=list[MemberMessage], summary="My thread with the team")
async def my_messages(me: dict = Depends(require_active_member)):
    """
    One thread per member — she never has to pick a recipient.

    **The mark-as-read no longer blocks the reply.** Opening the thread clears
    the unread flags, and that write was awaited before the messages were
    returned — so every read of the thread cost a second trip to Atlas for
    something she is not waiting to hear about. Nothing in the response depends
    on it: the items were already serialised from documents read *before* the
    update, so the thread she sees is identical either way.

    If the write is lost (the process dies in the gap), the worst case is a
    badge that reappears once and clears the next time she opens the thread.
    That is a far better failure than 22ms on every read.
    """
    db = get_database()
    uid = str(me["_id"])
    cursor = db[MemberMessageModel.collection_name].find({"user_id": uid}).sort("created_at", 1)
    items = [MemberMessage(**MemberMessageModel.to_response(m)) async for m in cursor]

    _after_response(
        db[MemberMessageModel.collection_name].update_many(
            {"user_id": uid, "read_by_member": False},
            {"$set": {"read_by_member": True}},
        )
    )
    return items


@router.post(
    "/messages",
    response_model=MemberMessage,
    status_code=status.HTTP_201_CREATED,
    summary="Write to the team",
)
async def send_message(payload: SendMessageRequest, me: dict = Depends(require_active_member)):
    doc = MemberMessageModel.create_document(
        user_id=str(me["_id"]),
        member_id=me.get("member_id") or "",
        body=payload.body,
        sender=MemberMessageModel.FROM_MEMBER,
        sender_name=me.get("full_name", ""),
    )
    result = await get_database()[MemberMessageModel.collection_name].insert_one(doc)
    doc["_id"] = result.inserted_id
    return MemberMessage(**MemberMessageModel.to_response(doc))


# --- notifications -----------------------------------------------------------

@router.get("/notifications", response_model=list[MemberNotification], summary="My notifications")
async def my_notifications(me: dict = Depends(require_active_member)):
    cursor = (
        get_database()[MemberNotificationModel.collection_name]
        .find({"user_id": str(me["_id"])})
        .sort("created_at", -1)
        .limit(50)
    )
    return [MemberNotification(**MemberNotificationModel.to_response(n)) async for n in cursor]


@router.get("/unread", response_model=UnreadCounts, summary="Unread badges")
async def unread_counts(me: dict = Depends(require_active_member)):
    """
    Two badge numbers, one round trip.

    Written as keyword arguments to `UnreadCounts(...)` these read as one
    expression, but Python evaluates them left to right — so the messages count
    did not leave until the notifications count came back, and two different
    collections that have nothing to say to each other cost two trips to Atlas.
    They are the cheapest queries in the app and they were the whole 52ms.
    """
    db = get_database()
    uid = str(me["_id"])
    notifications, messages = await asyncio.gather(
        db[MemberNotificationModel.collection_name].count_documents(
            {"user_id": uid, "unread": True}
        ),
        db[MemberMessageModel.collection_name].count_documents(
            {"user_id": uid, "read_by_member": False}
        ),
    )
    return UnreadCounts(notifications=notifications, messages=messages)


@router.post("/notifications/read-all", response_model=MessageResponse, summary="Mark all as read")
async def read_all(me: dict = Depends(require_active_member)):
    await get_database()[MemberNotificationModel.collection_name].update_many(
        {"user_id": str(me["_id"]), "unread": True}, {"$set": {"unread": False}}
    )
    return MessageResponse(message="All caught up.")


@router.post("/notifications/{notification_id}/read", response_model=MessageResponse, summary="Mark one as read")
async def read_one(notification_id: str, me: dict = Depends(require_active_member)):
    # Scoped by her user id too — she can only ever mark her own.
    await get_database()[MemberNotificationModel.collection_name].update_one(
        {"_id": to_object_id(notification_id), "user_id": str(me["_id"])},
        {"$set": {"unread": False}},
    )
    return MessageResponse(message="Marked as read.")


# --- library -----------------------------------------------------------------

@router.get("/library", response_model=list[LibraryItem], summary="Articles and guides for me")
async def library(
    q: Optional[str] = Query(None, description="Search title or description"),
    type: Optional[str] = Query(None, description="Filter by content type"),
    me: dict = Depends(require_active_member),
):
    """
    The published side of the admin Content module.

    Only `Published` items ever reach a member — drafts, scheduled and trashed
    content stay invisible, so nothing half-written is ever read by a member.
    """
    from app.models.content import ContentItemModel

    query: dict = {"status": "Published"}
    if type and type.lower() not in ("all", "all types"):
        query["type"] = type

    saved = set((me.get("saved_content") or []))
    docs = [
        doc
        async for doc in get_database()[ContentItemModel.collection_name]
        .find(query)
        .sort("created_at", -1)
    ]

    # Searching by meaning rather than by substring.
    #
    # A regex on title and description only finds a guide if she happens to type
    # a word it already contains — so "pricing" found nothing at all, and a woman
    # searching in Telugu found nothing ever, because no title is written in
    # Telugu. The same model that ranks the catalogue ranks these.
    #
    # A substring match is still an excellent signal when it happens, so it wins
    # outright; meaning only decides the rest.
    if q and q.strip():
        needle = q.strip().lower()
        # Off the event loop.
        #
        # `semantic.score` is a PyTorch forward pass. Run inline it froze the
        # whole worker: measured, a concurrent request that normally answers in
        # 0.9ms took 5,304ms while one cold search ran, and 564ms warm. One
        # woman searching the library stopped every other woman using the app.
        scores = await asyncio.to_thread(semantic.score, q.strip(), docs)
        if scores is None:
            docs = [
                d for d in docs
                if needle in (d.get("title") or "").lower()
                or needle in (d.get("description") or "").lower()
            ]
        else:
            ranked = sorted(
                zip(docs, scores),
                key=lambda pair: (
                    needle in (pair[0].get("title") or "").lower(),
                    pair[1],
                ),
                reverse=True,
            )
            # Below this a result is noise, and an honest "nothing here" is more
            # use to her than the least-irrelevant guide in the library.
            docs = [d for d, sc in ranked if sc >= 0.18 or needle in (d.get("title") or "").lower()]

    return [
        LibraryItem(
            id=str(doc["_id"]),
            title=doc.get("title", ""),
            type=doc.get("type", ""),
            description=doc.get("description", ""),
            author=doc.get("author", ""),
            cover=media_url(doc.get("cover", "")),
            icon=doc.get("icon", "FileText"),
            updated=doc.get("last_updated", ""),
            saved=str(doc["_id"]) in saved,
        )
        for doc in docs
    ]


@router.post("/library/{item_id}/save", response_model=MessageResponse, summary="Save or unsave an article")
async def toggle_saved(item_id: str, me: dict = Depends(require_active_member)):
    saved = list(me.get("saved_content") or [])
    if item_id in saved:
        saved.remove(item_id)
        message = "Removed from your saved list."
    else:
        saved.append(item_id)
        message = "Saved for later."
    await get_database()[UserModel.collection_name].update_one(
        {"_id": me["_id"]}, {"$set": {"saved_content": saved}}
    )
    return MessageResponse(message=message)


# --- one booking -------------------------------------------------------------

@router.get("/bookings/{booking_id}", response_model=BookingResponse, summary="One of my bookings")
async def one_booking(booking_id: str, me: dict = Depends(require_active_member)):
    doc = await _bookings().find_one(
        {"_id": to_object_id(booking_id), "user_id": str(me["_id"])}
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found")
    return BookingResponse(**BookingModel.to_response(doc))


# --- feedback ----------------------------------------------------------------

@router.post("/feedback", response_model=MessageResponse, summary="Share how it went")
async def leave_feedback(payload: FeedbackRequest, me: dict = Depends(require_active_member)):
    """Her rating lands in the same feedback module the team already reviews."""
    from app.models.feedback import FeedbackModel

    db = get_database()
    seq = await db[FeedbackModel.collection_name].count_documents({}) + 1
    sentiment = "Positive" if payload.rating >= 4 else "Neutral" if payload.rating == 3 else "Negative"

    doc = FeedbackModel.create_document(
        seq=seq,
        text=payload.text,
        user_name=me.get("full_name", ""),
        user_email=me.get("email", ""),
        type=payload.type,
        program=payload.program,
        rating=payload.rating,
        sentiment=sentiment,
    )
    await db[FeedbackModel.collection_name].insert_one(doc)
    return MessageResponse(message="Thank you — this genuinely helps us improve.")


# --- settings ----------------------------------------------------------------

@router.get("/settings/notifications", response_model=NotificationPrefs, summary="My notification settings")
async def get_notification_prefs(me: dict = Depends(require_active_member)):
    return NotificationPrefs(**(me.get("notification_prefs") or {}))


@router.put("/settings/notifications", response_model=NotificationPrefs, summary="Update notification settings")
async def set_notification_prefs(payload: NotificationPrefs, me: dict = Depends(require_active_member)):
    await get_database()[UserModel.collection_name].update_one(
        {"_id": me["_id"]}, {"$set": {"notification_prefs": payload.model_dump()}}
    )
    return payload


@router.post("/settings/password", response_model=MessageResponse, summary="Change my password")
async def change_my_password(payload: ChangePasswordBody, me: dict = Depends(require_active_member)):
    from app.core.security import hash_password, verify_password, hash_password_async, verify_password_async

    if not await verify_password_async(payload.current_password, me["hashed_password"]):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That isn't your current password")
    if payload.current_password == payload.new_password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Please choose a different password")

    await get_database()[UserModel.collection_name].update_one(
        {"_id": me["_id"]},
        {"$set": {"hashed_password": await hash_password_async(payload.new_password),
                  "updated_at": datetime.now(timezone.utc)}},
    )
    return MessageResponse(message="Your password has been changed.")


@router.post("/settings/delete-account", response_model=MessageResponse, summary="Ask us to delete my account")
async def request_deletion(payload: DeleteAccountRequest, me: dict = Depends(require_active_member)):
    """
    A REQUEST, not an instant wipe.

    Deleting immediately would strand her bookings and destroy records the team
    may be legally required to keep for a period. So we suspend access now, tell
    the team, and let a human complete the erasure properly.
    """
    now = datetime.now(timezone.utc)
    await get_database()[UserModel.collection_name].update_one(
        {"_id": me["_id"]},
        {"$set": {
            "deletion_requested_at": now,
            "deletion_reason": payload.reason[:500],
            "verification_status": VerificationStatus.SUSPENDED,
            "updated_at": now,
        }},
    )
    return MessageResponse(
        message="We've received your request. Our team will complete it within 30 days, "
                "and you'll get an email when it's done."
    )


# --- progress ----------------------------------------------------------------

ACHIEVEMENTS = [
    ("first_booking", "First step", "Booked your first session", "CalendarCheck"),
    ("first_program", "Learner", "Joined your first program", "GraduationCap"),
    ("three_sessions", "Committed", "Attended three sessions", "Flame"),
    ("halfway", "Halfway there", "Reached 50% in a program", "TrendingUp"),
    ("completed", "Graduate", "Completed a whole program", "Award"),
]


async def _progress_rows(uid: str) -> tuple[list[dict], list[dict]]:
    """
    The two queries `/me/progress` is built from, sent together.

    Split out from the endpoint so `/me/shell` and `/me/journey` can fold them
    into their own `gather` rather than paying a second round trip to reach
    them — a helper that awaits internally is still one wave of queries, and
    nesting `gather` inside `gather` issues everything at once.
    """
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return await asyncio.gather(
        _bookings().aggregate([
            {"$match": {"user_id": uid}},
            {"$group": {
                "_id": "$status",
                "n": {"$sum": 1},
                # Upcoming only counts if it has not already happened.
                "future": {"$sum": {"$cond": [{"$gte": ["$date", today]}, 1, 0]}},
            }},
        ]).to_list(20),
        # Only the three fields this endpoint reads. A projection is free to
        # write and stops a 4KB notes field crossing the wire for every row.
        _enrollments()
        .find({"user_id": uid}, {"status": 1, "sessions_attended": 1, "progress": 1})
        .to_list(500),
    )


def _progress_response(
    me: dict, booking_rows: list[dict], enrolments: list[dict],
) -> ProgressResponse:
    """The arithmetic half — no database, so it can be reused anywhere."""
    by_status = {r["_id"]: r for r in booking_rows}
    attended = int(by_status.get(BookingModel.STATUS_COMPLETED, {}).get("n", 0))
    upcoming = int(by_status.get(BookingModel.STATUS_UPCOMING, {}).get("future", 0))

    active = sum(1 for e in enrolments if e.get("status") == EnrollmentModel.STATUS_ACTIVE)
    completed = sum(1 for e in enrolments if e.get("status") == EnrollmentModel.STATUS_COMPLETED)
    sessions_in_programs = sum(int(e.get("sessions_attended") or 0) for e in enrolments)
    best_progress = max((int(e.get("progress") or 0) for e in enrolments), default=0)

    total_sessions = attended + sessions_in_programs
    joined = me.get("created_at")

    earned = {
        "first_booking": (attended + upcoming) > 0,
        "first_program": (active + completed) > 0,
        "three_sessions": total_sessions >= 3,
        "halfway": best_progress >= 50,
        "completed": completed > 0,
    }

    return ProgressResponse(
        member_since=joined.strftime("%B %Y") if isinstance(joined, datetime) else "",
        sessions_attended=total_sessions,
        sessions_upcoming=upcoming,
        programs_active=active,
        programs_completed=completed,
        # An hour a session is a reasonable stand-in until sessions carry real durations.
        learning_hours=total_sessions,
        completion_rate=best_progress,
        achievements=[
            Achievement(key=k, title=t, description=d, icon=i, earned=earned.get(k, False))
            for k, t, d, i in ACHIEVEMENTS
        ],
    )


@router.get("/progress", response_model=ProgressResponse, summary="How far I've come")
async def my_progress(me: dict = Depends(require_active_member)):
    """
    Her journey so far, in two queries.

    It was five, and three of them were asking for a number the fourth already
    had: the enrolment scan reads every enrolment anyway, so counting the active
    and completed ones in memory costs nothing and saves two round trips. The
    booking counts collapse into one `$group`, because Mongo can count by status
    in a single pass and the alternative is asking twice for two halves of the
    same answer.

    Two queries against a cluster in another data centre is about 100ms. Five
    was 176ms, and the difference is not the work — it is the asking.
    """
    booking_rows, enrolments = await _progress_rows(str(me["_id"]))
    return _progress_response(me, booking_rows, enrolments)


# --- one programme, in depth -------------------------------------------------

def _module_count(program: dict) -> int:
    """How many modules a programme has, without building them twice."""
    return len(_curriculum_for(program, 0))


def _curriculum_for(program: dict, sessions_attended: int) -> list[dict]:
    """
    The week-by-week outline.

    Programmes created through the admin panel can carry a real `curriculum`
    array. Older ones don't, so we derive an honest outline from the duration
    rather than showing her an empty screen — and we never invent lesson titles
    we don't have, only "Week n".
    """
    raw = program.get("curriculum") or []
    if raw:
        modules = [
            {
                "title": (m or {}).get("title", ""),
                "detail": (m or {}).get("detail", ""),
                "duration": (m or {}).get("duration", ""),
            }
            for m in raw
        ]
    else:
        weeks = 0
        for token in str(program.get("duration", "")).split():
            if token.isdigit():
                weeks = int(token)
                break
        weeks = min(weeks, 24) or 4
        modules = [
            {"title": f"Week {n}", "detail": "", "duration": ""} for n in range(1, weeks + 1)
        ]

    # Mark off what she has actually attended — no guessing beyond the count.
    for i, m in enumerate(modules):
        m["done"] = i < sessions_attended
    return modules


def _reached(progress: int, sessions_attended: int, total: int) -> int:
    """
    How many modules she has finished, from the two numbers that record it.

    `sessions_attended` counts sessions; `progress` is a percentage. They are
    two views of one fact and nothing forced them to agree, so a lesson marked
    finished moved the percentage and left every module flagged unfinished —
    she came back to a course that had forgotten her. Taking whichever is
    further along means neither can silently undo the other.
    """
    from_pct = round((max(0, min(100, progress)) / 100) * total) if total else 0
    reached = max(int(sessions_attended or 0), from_pct)
    # Capped at the course's own length. `sessions_attended` counts SESSIONS,
    # not modules, and a woman who went to six sessions of a four-module course
    # came back as "6 of 4 done" — on Home, the first screen she sees. Taking
    # the further-along number is right; letting it run past the end is not.
    return min(reached, total) if total else reached


@router.get("/programs/{program_id}/detail", response_model=ProgramDetail, summary="One programme, in full")
async def program_detail(program_id: str, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    # Three independent lookups, awaited one after another, cost three round
    # trips to Atlas — about 75ms of the 84ms this endpoint took. Neither the
    # enrolment nor the certificate needs the programme: both are keyed on her
    # id and the path parameter, which are known before any of them run.
    program, enrollment, certificate = await asyncio.gather(
        _programs().find_one({"_id": to_object_id(program_id)}),
        _enrollments().find_one({"user_id": uid, "program_id": program_id}),
        get_database()[CertificateModel.collection_name].find_one(
            {"user_id": uid, "program_id": program_id, "revoked": {"$ne": True}}
        ),
    )
    if not program:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That programme doesn't exist")

    joined_at = enrollment.get("created_at") if enrollment else None
    attended = int((enrollment or {}).get("sessions_attended") or 0)

    return ProgramDetail(
        id=str(program["_id"]),
        name=program.get("name", ""),
        category=program.get("category", ""),
        desc=program.get("desc", ""),
        mode=program.get("mode", ""),
        duration=program.get("duration", ""),
        dates=program.get("dates", ""),
        days=program.get("days", ""),
        cover=media_url(program.get("cover", "")),
        seats=int(program.get("cap") or 0),
        enrolled=bool(enrollment and enrollment.get("status") != EnrollmentModel.STATUS_WITHDRAWN),
        progress=int((enrollment or {}).get("progress") or 0),
        sessions_attended=attended,
        status=(enrollment or {}).get("status", ""),
        joined_on=joined_at.strftime("%b %d, %Y") if isinstance(joined_at, datetime) else "",
        curriculum=_curriculum_for(
            program,
            _reached(int((enrollment or {}).get("progress") or 0), attended, _module_count(program)),
        ),
        certificate_code=(certificate or {}).get("code", ""),
    )


# --- certificates ------------------------------------------------------------

@router.get("/certificates", response_model=list[CertificateResponse], summary="My certificates")
async def my_certificates(me: dict = Depends(require_active_member)):
    docs = (
        await get_database()[CertificateModel.collection_name]
        .find({"user_id": str(me["_id"]), "revoked": {"$ne": True}})
        .sort("issued_at", -1)
        .to_list(100)
    )
    return [CertificateModel.to_response(d) for d in docs]


@router.post(
    "/programs/{program_id}/certificate",
    response_model=CertificateResponse,
    summary="Claim the certificate for a programme I've completed",
)
async def claim_certificate(program_id: str, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    certificates = get_database()[CertificateModel.collection_name]

    existing = await certificates.find_one(
        {"user_id": uid, "program_id": program_id, "revoked": {"$ne": True}}
    )
    if existing:
        return CertificateModel.to_response(existing)

    # Completion is decided by the enrollment record, never by the request.
    enrollment = await _enrollments().find_one({"user_id": uid, "program_id": program_id})
    if not enrollment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "You haven't joined that programme")
    if enrollment.get("status") != EnrollmentModel.STATUS_COMPLETED:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Finish the programme first — your certificate appears here the moment you do.",
        )

    program = await _programs().find_one({"_id": to_object_id(program_id)})
    doc = CertificateModel.create_document(
        user_id=uid,
        member_id=me.get("member_id", ""),
        holder_name=me.get("full_name", ""),
        program_id=program_id,
        program_name=(program or {}).get("name", enrollment.get("program_name", "")),
        hours=(program or {}).get("duration", ""),
    )
    result = await certificates.insert_one(doc)
    doc["_id"] = result.inserted_id

    await notify(
        get_database(), uid,
        "Your certificate is ready",
        f"{doc['program_name']} — certificate {doc['code']}.",
        "program", "/app/certificates",
    )
    return CertificateModel.to_response(doc)


# --- my documents ------------------------------------------------------------

@router.post(
    "/documents",
    response_model=MyDocument,
    status_code=status.HTTP_201_CREATED,
    summary="Keep a paper in my vault",
)
async def add_document(
    file: UploadFile = File(..., description="Photo or PDF of the paper"),
    doc_type: str = Form("other", description="aadhaar | pan | passport | voter_id | driving_licence | national_id | other"),
    me: dict = Depends(require_active_member),
):
    """
    Add a paper to her own vault.

    **Deliberately not the identity-check endpoint.** That one puts the account
    into review and emails a reviewer, which is right when she is proving who
    she is and wrong when she is filing her bank passbook so a scheme office
    can be answered next week. It also refuses outright once she is verified —
    so the vault, wired to it, could never accept a paper from anyone who had
    finished signing up.
    """
    stored_name, _ext, size = await save_document_file(file, me)
    doc = DocumentModel.create_document(
        user_id=str(me["_id"]),
        member_id=me.get("member_id") or "",
        doc_type=doc_type,
        original_name=file.filename or stored_name,
        stored_name=stored_name,
        content_type=file.content_type or "",
        size=size,
        status=DocumentModel.STATUS_STORED,
    )
    result = await get_database()[DocumentModel.collection_name].insert_one(doc)
    doc["_id"] = result.inserted_id
    created = doc.get("created_at")
    return MyDocument(
        id=str(doc["_id"]),
        doc_type=DocumentModel.TYPE_LABELS.get(doc["doc_type"], "Document"),
        doc_kind=doc["doc_type"],
        filename=doc["original_name"],
        status=doc["status"],
        uploaded_on=created.strftime("%b %d, %Y") if created else "",
        note="",
        size=int(doc["size"]),
    )


@router.get("/documents", response_model=list[MyDocument], summary="Documents I've sent")
async def my_documents(me: dict = Depends(require_active_member)):
    """
    What she uploaded and where it got to.

    Returns metadata only — never a URL. The files themselves are readable
    exclusively through the staff-only streaming endpoint, which is the whole
    point of keeping them outside the public media directory.
    """
    docs = (
        await get_database()[DocumentModel.collection_name]
        .find({"user_id": str(me["_id"])})
        .sort("created_at", -1)
        .to_list(50)
    )
    out = []
    for d in docs:
        created = d.get("created_at")
        out.append(
            MyDocument(
                id=str(d["_id"]),
                doc_type=DocumentModel.TYPE_LABELS.get(d.get("doc_type", ""), d.get("doc_type", "")),
                doc_kind=d.get("doc_type", "other"),
                filename=d.get("original_name", ""),
                status=d.get("status", "pending"),
                uploaded_on=created.strftime("%b %d, %Y") if isinstance(created, datetime) else "",
                note=d.get("review_note", "") or "",
                size=int(d.get("size", 0) or 0),
            )
        )
    return out


# --- referrals ---------------------------------------------------------------

async def _count_referrals(code: str) -> tuple[int, int]:
    """
    Invited, and of those how many were admitted — two numbers, one pass.

    Asked as two `count_documents` this is the same filter sent twice, and the
    second cannot leave until the first is answered.
    """
    rows = await get_database()[UserModel.collection_name].aggregate([
        {"$match": {"referred_by": code}},
        {"$group": {
            "_id": None,
            "invited": {"$sum": 1},
            "joined": {"$sum": {
                "$cond": [{"$eq": ["$verification_status", VerificationStatus.ACTIVE]}, 1, 0],
            }},
        }},
    ]).to_list(1)
    row = rows[0] if rows else {}
    return int(row.get("invited", 0)), int(row.get("joined", 0))


async def _referrals(me: dict) -> ReferralResponse:
    """
    Her invite code and how far it has travelled, normally in one query.

    This was three round trips: read her member row for the code, count who
    used it, count who stuck. The counts collapse into one `$group`, and the
    member lookup that has to come first — the code *is* the filter, so there
    is nothing to count until it is known — is folded into the same query with
    a `$lookup` that runs the count on the server, where her code already is.

    The `$$code` guard is not decoration. A member row saved without a `code`
    would make `$$code` missing, and `{$eq: ["$referred_by", "$$code"]}` would
    then match every user who was never referred by anybody — reporting the
    whole platform as her invitees. She would be told she had invited four
    hundred women. The `$ne null` in front of it makes that case count nothing,
    and the fallback path below asks the question properly.
    """
    rows = []
    if me.get("member_id"):
        rows = await get_database()[MemberModel.collection_name].aggregate([
            {"$match": {"_id": to_object_id(me["member_id"])}},
            {"$limit": 1},
            {"$lookup": {
                "from": UserModel.collection_name,
                "let": {"code": "$code"},
                "pipeline": [
                    {"$match": {"$expr": {"$and": [
                        {"$ne": [{"$ifNull": ["$$code", None]}, None]},
                        {"$ne": ["$$code", ""]},
                        {"$eq": ["$referred_by", "$$code"]},
                    ]}}},
                    {"$group": {
                        "_id": None,
                        "invited": {"$sum": 1},
                        "joined": {"$sum": {"$cond": [
                            {"$eq": ["$verification_status", VerificationStatus.ACTIVE]}, 1, 0,
                        ]}},
                    }},
                ],
                "as": "_referred",
            }},
            {"$project": {"code": 1, "_referred": 1}},
        ]).to_list(1)

    code = (rows[0] if rows else {}).get("code") or ""
    if code:
        tally = ((rows[0].get("_referred") or [{}])[0]) or {}
        invited, joined = int(tally.get("invited", 0)), int(tally.get("joined", 0))
    else:
        # No member row, or one with no code yet. Her user id's tail is the
        # stand-in, and it needs its own count — a second round trip, on a path
        # that should not exist once every member has a code.
        code = me.get("member_id", "")[-6:].upper()
        invited, joined = await _count_referrals(code)

    return ReferralResponse(
        code=code,
        link=f"{settings.APP_BASE_URL}/signup?ref={code}",
        invited=invited,
        joined=joined,
        credit_per_join_label="",  # set once the referral reward is agreed
        message=(
            f"I'm learning with WomSakhi — it's women only, and it's free to join. "
            f"Use my code {code} when you sign up."
        ),
    )


@router.get("/referrals", response_model=ReferralResponse, summary="Invite another woman")
async def my_referrals(me: dict = Depends(require_active_member)):
    """
    Her invite code is her member code — one identifier, nothing new to remember,
    and nothing that leaks her email or phone to whoever she shares it with.
    """
    return await _referrals(me)
