"""
Buying together — wholesale prices for women who cannot each order a sack.

Two things are enforced here rather than trusted to the screen:

**She pays nothing unless it goes ahead.** Joining writes a row; it does not
charge her. Money is asked for once staff place the order, and not before. A
module that took payment on join would have to refund every buy that fell short,
and refunds on this platform take days she cannot spare.

**The count is exact.** `joined` moves by `$inc` and the threshold is read back
from the same update, so two women joining the last place at the same moment
both count and exactly one of them tips it over. Reading, comparing in Python
and writing back would lose one of them — and the one it loses is the one who
does not get the price.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core import cache
from app.core.rbac import require_active_member
from app.core.serializers import to_object_id
from app.db.mongodb import get_database
from app.models.groupbuy import GroupBuyJoinerModel, GroupBuyModel
from app.schemas.groupbuy import GroupBuyResponse, JoinRequest

router = APIRouter(prefix="/group-buy", tags=["Member · Work"])


def _buys():
    return get_database()[GroupBuyModel.collection_name]


def _joiners():
    return get_database()[GroupBuyJoinerModel.collection_name]


#: "Tell me next time" — one row per woman per item, removed once she is told.
WATCHERS = "group_buy_watchers"


def _watchers():
    return get_database()[WATCHERS]


def item_key(item: str) -> str:
    """The same thing bought again, whatever the round: case and spacing ignored."""
    return " ".join((item or "").casefold().split())


async def notify_watchers(buy: dict) -> int:
    """A new round of something she asked about has opened: tell her, once."""
    from app.models.conversation import notify

    key = item_key(buy.get("item", ""))
    if not key:
        return 0
    rows = await _watchers().find({"item_key": key}).to_list(1000)
    for w in rows:
        await notify(
            get_database(), w["user_id"],
            f"Buying together: {buy.get('item', '')} is open again",
            f"{buy.get('unit', '')} — join before it closes.".strip(" —"),
            "market", "/app/group-buy",
        )
    if rows:
        await _watchers().delete_many({"_id": {"$in": [w["_id"] for w in rows]}})
    return len(rows)


@router.get("", response_model=list[GroupBuyResponse], summary="What is being bought together")
async def list_buys(
    open_only: bool = Query(True, description="Hide buys that have closed"),
    me: dict = Depends(require_active_member),
):
    query: dict = {}
    if open_only:
        query["status"] = {"$in": [GroupBuyModel.STATUS_OPEN, GroupBuyModel.STATUS_MET]}

    async def _load() -> list[dict]:
        return await _buys().find(query).sort("closes_at", 1).to_list(100)

    uid = str(me["_id"])
    docs, mine, watching = await asyncio.gather(
        cache.cached(f"groupbuy:{int(open_only)}", cache.SHARED_TTL, _load),
        _joiners().find({"user_id": uid}, {"buy_id": 1}).to_list(200),
        _watchers().find({"user_id": uid}, {"item_key": 1}).to_list(200),
    )
    joined = {j["buy_id"] for j in mine}
    watched = {w["item_key"] for w in watching}
    return [
        GroupBuyResponse(**GroupBuyModel.to_response(d, joined_by_me=str(d["_id"]) in joined),
                         watching=item_key(d.get("item", "")) in watched)
        for d in docs
    ]


@router.post("/{buy_id}/notify-me", response_model=GroupBuyResponse, summary="Tell me when the next round opens")
async def notify_me(buy_id: str, me: dict = Depends(require_active_member)):
    """
    For a buy that is already full (or closing): "Tell me next time" used to
    say "We will tell you" and record nothing. Now it is a row, and the next
    round of the same item — opened by staff — notifies her and clears it.
    """
    buy = await _buys().find_one({"_id": to_object_id(buy_id)})
    if not buy:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That buy is not listed")
    uid = str(me["_id"])
    key = item_key(buy.get("item", ""))
    await _watchers().update_one(
        {"user_id": uid, "item_key": key},
        {"$setOnInsert": {"user_id": uid, "item_key": key, "item": buy.get("item", ""),
                          "buy_id": buy_id, "created_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    mine = await _joiners().find_one({"user_id": uid, "buy_id": buy_id})
    return GroupBuyResponse(**GroupBuyModel.to_response(buy, joined_by_me=bool(mine)), watching=True)


@router.delete("/{buy_id}/notify-me", status_code=status.HTTP_204_NO_CONTENT, summary="Stop telling me")
async def stop_notify(buy_id: str, me: dict = Depends(require_active_member)):
    buy = await _buys().find_one({"_id": to_object_id(buy_id)})
    if buy:
        await _watchers().delete_one({"user_id": str(me["_id"]), "item_key": item_key(buy.get("item", ""))})
    return None


@router.post("/{buy_id}/join", response_model=GroupBuyResponse, summary="Join this buy")
async def join(buy_id: str, body: JoinRequest, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    oid = to_object_id(buy_id)

    buy = await _buys().find_one({"_id": oid})
    if not buy:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That buy is not listed")
    if buy.get("status") not in (GroupBuyModel.STATUS_OPEN, GroupBuyModel.STATUS_MET):
        raise HTTPException(status.HTTP_409_CONFLICT, "This buy has closed")

    existing = await _joiners().find_one({"user_id": uid, "buy_id": buy_id})
    if existing:
        # A retry, not a second join.
        fresh = await _buys().find_one({"_id": oid})
        return GroupBuyResponse(**GroupBuyModel.to_response(fresh, joined_by_me=True))

    await _joiners().insert_one(GroupBuyJoinerModel.create_document(
        user_id=uid, member_id=me.get("member_id", ""), buy_id=buy_id, quantity=body.quantity,
    ))
    # One atomic step: add her, and flip to "met" in the same operation if she
    # is the one who completed it. A separate read-then-set would let two
    # simultaneous joiners each think they were not the last.
    await _buys().update_one({"_id": oid}, {"$inc": {"joined": 1}})
    await _buys().update_one(
        {"_id": oid, "status": GroupBuyModel.STATUS_OPEN, "$expr": {"$gte": ["$joined", "$needed"]}},
        {"$set": {"status": GroupBuyModel.STATUS_MET, "updated_at": datetime.now(timezone.utc)}},
    )
    cache.forget_prefix("groupbuy:")

    fresh = await _buys().find_one({"_id": oid})
    return GroupBuyResponse(**GroupBuyModel.to_response(fresh, joined_by_me=True))


@router.delete("/{buy_id}/join", status_code=status.HTTP_204_NO_CONTENT, summary="Leave this buy")
async def leave(buy_id: str, me: dict = Depends(require_active_member)):
    removed = await _joiners().delete_one({"user_id": str(me["_id"]), "buy_id": buy_id})
    if removed.deleted_count:
        await _buys().update_one(
            {"_id": to_object_id(buy_id), "joined": {"$gt": 0}}, {"$inc": {"joined": -1}},
        )
        # Dropping back below the number reopens it. A buy stuck on "met" with
        # too few joiners would have staff placing an order nobody is paying for.
        await _buys().update_one(
            {"_id": to_object_id(buy_id), "status": GroupBuyModel.STATUS_MET,
             "$expr": {"$lt": ["$joined", "$needed"]}},
            {"$set": {"status": GroupBuyModel.STATUS_OPEN}},
        )
        cache.forget_prefix("groupbuy:")
    return None


async def seed() -> None:
    coll = _buys()
    if await coll.count_documents({}) > 0:
        return
    now = datetime.now(timezone.utc)
    rows = [
        dict(item="Cotton thread — mixed colours", unit="per box of 50 reels",
             alone_minor=95_000, together_minor=62_000, needed=12,
             closes_at=now + timedelta(days=9), supplier="Jaipur Threads",
             note="Enough for about two months of steady stitching."),
        dict(item="Plain cotton fabric", unit="per 20-metre roll",
             alone_minor=240_000, together_minor=178_000, needed=8,
             closes_at=now + timedelta(days=5), supplier="Bagru Mills"),
        dict(item="Mehendi cones", unit="per box of 100",
             alone_minor=110_000, together_minor=74_000, needed=10,
             closes_at=now + timedelta(days=16), supplier="Rajasthan Naturals"),
        dict(item="Packing boxes and tape", unit="per 100 boxes",
             alone_minor=85_000, together_minor=54_000, needed=15,
             closes_at=now + timedelta(days=21), supplier="PackRight",
             note="For anyone posting orders. Fits a folded kurta."),
    ]
    await coll.insert_many([GroupBuyModel.create_document(**r) for r in rows])
