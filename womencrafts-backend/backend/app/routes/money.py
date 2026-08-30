"""
Goals, and one request for the whole Earn screen.

Two things live here.

**Goals**, because nothing stored them. Money goals read their progress from
the ledger rather than keeping a copy: a goal that says "₹24,350 of ₹30,000"
while the wallet says something else is a goal she stops believing, and the
moment progress becomes a stored number it starts drifting from the thing it
measures.

**`/money/overview`**, because Earn opened with four separate requests —
balance, insights, payout accounts, goal. Against an Atlas cluster in another
data centre that is four round trips of about 50ms each for one screen. Sent
together they cost one.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.rbac import require_active_member
from app.core.serializers import to_object_id
from app.db.mongodb import get_database
from app.models.enrollment import EnrollmentModel
from app.models.goal import GoalModel
from app.models.payout import PayoutAccountModel
from app.models.wallet import WalletTxnModel
from app.routes.wallet import balance_minor
from app.schemas.goal import GoalCreate, GoalProgress, GoalResponse

router = APIRouter(tags=["Member · Money"])


def _goals():
    return get_database()[GoalModel.collection_name]


def _txns():
    return get_database()[WalletTxnModel.collection_name]


async def _earned_this_month(user_id: str) -> int:
    """Credits since the first of the month. One aggregation, not a scan."""
    start = datetime.now(timezone.utc).replace(
        day=1, hour=0, minute=0, second=0, microsecond=0,
    )
    rows = await _txns().aggregate([
        {"$match": {"user_id": user_id, "kind": WalletTxnModel.KIND_CREDIT,
                    "created_at": {"$gte": start}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount_minor"}}},
    ]).to_list(1)
    return int(rows[0]["total"]) if rows else 0


async def _lessons_done(user_id: str) -> int:
    rows = await get_database()[EnrollmentModel.collection_name].aggregate([
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": None, "total": {"$sum": "$sessions_attended"}}},
    ]).to_list(1)
    return int(rows[0]["total"]) if rows else 0


async def _measure(user_id: str) -> tuple[int, int]:
    """
    Both measurements a goal can be scored against: money earned, lessons done.

    They are fetched **once for the whole list**, not once per goal — three
    money goals must not mean three aggregations of the same ledger.

    They used to be fetched only when a goal of that kind existed, which read
    like thrift and was not. The saving was two queries that execute in about
    0ms against collections this size; the cost was that they could not be
    asked until the goals came back, because you cannot know the kinds until
    you have the rows. That is a whole round trip to another data centre —
    22ms — to avoid work that takes none. Asking unconditionally lets them ride
    along with the goals query itself.
    """
    earned, lessons = await asyncio.gather(
        _earned_this_month(user_id), _lessons_done(user_id),
    )
    return earned, lessons


def _fill_progress(docs: list[dict], earned: int, lessons: int) -> list[GoalResponse]:
    """Score each goal against whichever measurement its kind is counted by."""
    out = []
    for d in docs:
        kind = d.get("kind")
        current = (earned if kind == GoalModel.KIND_MONEY
                   else lessons if kind == GoalModel.KIND_SKILL
                   else None)   # counted by her; `to_response` uses the stored one
        out.append(GoalResponse(**GoalModel.to_response(d, current=current)))
    return out


async def _with_progress(docs: list[dict], user_id: str) -> list[GoalResponse]:
    """Measure, then fill. Kept for callers that already hold the goals only."""
    earned, lessons = await _measure(user_id)
    return _fill_progress(docs, earned, lessons)


@router.get("/me/goals", response_model=list[GoalResponse], summary="What I am working towards")
async def list_goals(me: dict = Depends(require_active_member)):
    """
    Her goals and the numbers they are scored against, in one round trip.

    The goals query and the two measurements ask three different questions of
    the database and none of them needs the others' answer, so they go
    together — see `_measure` for why this beats fetching the measurements
    conditionally afterwards.
    """
    uid = str(me["_id"])
    docs, (earned, lessons) = await asyncio.gather(
        _goals().find(
            {"user_id": uid, "status": {"$ne": GoalModel.STATUS_DROPPED}}
        ).sort("created_at", -1).to_list(50),
        _measure(uid),
    )
    return _fill_progress(docs, earned, lessons)


@router.post(
    "/me/goals",
    response_model=list[GoalResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Set a goal",
)
async def create_goal(body: GoalCreate, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    # Five open goals is already more than anyone works towards at once, and a
    # screen of twenty is a screen she stops opening.
    if await _goals().count_documents({"user_id": uid, "status": GoalModel.STATUS_OPEN}) >= 5:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Five goals at a time is plenty. Finish or drop one before adding another.",
        )
    await _goals().insert_one(GoalModel.create_document(
        user_id=uid, member_id=me.get("member_id", ""), **body.model_dump(),
    ))
    return await list_goals(me)


@router.patch("/me/goals/{goal_id}", response_model=list[GoalResponse], summary="Move a goal along")
async def move_goal(goal_id: str, body: GoalProgress, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    goal = await _goals().find_one({"_id": to_object_id(goal_id), "user_id": uid})
    if not goal:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That goal is not yours, or is gone")
    if goal.get("kind") != GoalModel.KIND_COUNT:
        # A money goal that could be edited by hand is a money goal that can be
        # made to say anything, which is the opposite of what it is for.
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This one counts itself from your earnings — it is not moved by hand.",
        )
    await _goals().update_one(
        {"_id": goal["_id"]},
        {"$set": {"current": body.current, "updated_at": datetime.now(timezone.utc)}},
    )
    return await list_goals(me)


@router.delete("/me/goals/{goal_id}", response_model=list[GoalResponse], summary="Drop a goal")
async def drop_goal(goal_id: str, me: dict = Depends(require_active_member)):
    # Marked dropped rather than deleted: a goal she set and did not reach is
    # part of her own record, and the platform should not quietly erase it.
    await _goals().update_one(
        {"_id": to_object_id(goal_id), "user_id": str(me["_id"])},
        {"$set": {"status": GoalModel.STATUS_DROPPED, "updated_at": datetime.now(timezone.utc)}},
    )
    return await list_goals(me)


@router.get("/money/overview", summary="Everything the Earn screen needs")
async def overview(me: dict = Depends(require_active_member)):
    """
    One request instead of four.

    Balance, ledger, payout accounts and goals are independent questions, so
    they go together and the screen waits for the slowest rather than the sum.
    """
    uid = str(me["_id"])
    db = get_database()

    balance, txns, accounts, goals, (earned, lessons) = await asyncio.gather(
        balance_minor(uid),
        # Only the fields the list renders. The document carries a reference id
        # and a member id that no screen shows, and on two hundred rows that is
        # bandwidth spent on nothing.
        _txns().find(
            {"user_id": uid},
            {"kind": 1, "label": 1, "source": 1, "amount_minor": 1, "created_at": 1, "status": 1},
        ).sort("created_at", -1).to_list(200),
        db[PayoutAccountModel.collection_name]
            .find({"user_id": uid}).sort([("primary", -1), ("created_at", -1)]).to_list(20),
        _goals().find({"user_id": uid, "status": {"$ne": GoalModel.STATUS_DROPPED}})
            .sort("created_at", -1).to_list(50),
        # The goals' progress numbers ride along here too. Scoring them after
        # the gather meant this endpoint was two round trips wearing one
        # request's clothes.
        _measure(uid),
    )

    from app.routes.wallet import symbol
    sym = symbol()
    return {
        "balance_minor": balance,
        "balance_label": f"{sym}{balance / 100:,.0f}",
        "transactions": [WalletTxnModel.to_response(t, sym) for t in txns],
        "accounts": [PayoutAccountModel.to_response(a) for a in accounts],
        "goals": [g.model_dump() for g in _fill_progress(goals, earned, lessons)],
    }
