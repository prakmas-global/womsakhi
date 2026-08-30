"""
Her business: what she sells, what she has sold, and what buyers said.

**One request for the whole screen.** My Business shows a summary, her orders,
her listings and her reviews at once. Four endpoints would be four round trips
to a cluster in another data centre; `/shop` returns all four, gathered, and
costs one.

Orders needing her come first within the list, because this screen is checked
between other work: the question is always "is anyone waiting on me?" and it
should be answered before she has to look for it.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.rbac import require_active_member
from app.core.serializers import to_object_id
from app.db.mongodb import get_database
from app.models.shop import ListingModel, ReviewModel, ShopOrderModel
from app.schemas.shop import (
    ListingCreate,
    ListingResponse,
    OrderResponse,
    ReplyRequest,
    ReviewResponse,
    ShopSummary,
)

router = APIRouter(prefix="/shop", tags=["Member · Work"])


def _listings():
    return get_database()[ListingModel.collection_name]


def _orders():
    return get_database()[ShopOrderModel.collection_name]


def _reviews():
    return get_database()[ReviewModel.collection_name]


@router.get("/summary", response_model=ShopSummary, summary="My business at a glance")
async def summary(me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_start = (month_start - timedelta(days=1)).replace(day=1)
    week_start = now - timedelta(days=7)

    # Five questions, one round trip.
    orders, reviews, listing_count = await asyncio.gather(
        _orders().find(
            {"seller_id": uid},
            {"state": 1, "total_minor": 1, "created_at": 1, "buyer_name": 1},
        ).to_list(2000),
        _reviews().find({"seller_id": uid}, {"stars": 1}).to_list(500),
        _listings().count_documents({"user_id": uid}),
    )

    def paid(o: dict) -> bool:
        return o.get("state") in ("Sent", "Done")

    def when(o: dict) -> datetime:
        got = o.get("created_at")
        return got.replace(tzinfo=timezone.utc) if got and got.tzinfo is None else (got or now)

    month = sum(int(o.get("total_minor", 0)) for o in orders if paid(o) and when(o) >= month_start)
    last = sum(
        int(o.get("total_minor", 0)) for o in orders
        if paid(o) and last_start <= when(o) < month_start
    )
    # Seven buckets, oldest first, so the sparkline reads left to right.
    week = [0] * 7
    for o in orders:
        w = when(o)
        if w >= week_start:
            week[min(6, (now - w).days)] += 1
    week.reverse()

    # Buyers who came back, as a share of buyers. Counted from her own orders
    # rather than stored, so it cannot drift from the list she can scroll.
    buyers: dict[str, int] = {}
    for o in orders:
        name = (o.get("buyer_name") or "").strip().lower()
        if name:
            buyers[name] = buyers.get(name, 0) + 1
    repeat = round(sum(1 for n in buyers.values() if n > 1) * 100 / len(buyers)) if buyers else 0

    stars = [int(r.get("stars", 0)) for r in reviews if r.get("stars")]
    return ShopSummary(
        name=me.get("full_name", "") + "'s work",
        handle=f"womsakhi.in/{me.get('member_id', '') or uid[-6:]}".lower(),
        rating=round(sum(stars) / len(stars), 1) if stars else 0.0,
        review_count=len(stars),
        needs_her=sum(1 for o in orders if o.get("state") in ("New", "Making", "Ready")),
        month_minor=month,
        last_month_minor=last,
        listings=listing_count,
        week_orders=week,
        repeat_buyers_pct=repeat,
    )


@router.get("/listings", response_model=list[ListingResponse], summary="What I sell")
async def list_listings(
    kind: Optional[str] = Query(None, description="product | service"),
    me: dict = Depends(require_active_member),
):
    query: dict = {"user_id": str(me["_id"])}
    if kind:
        query["kind"] = kind
    docs = await _listings().find(query).sort("updated_at", -1).to_list(300)
    return [ListingResponse(**ListingModel.to_response(d)) for d in docs]


@router.post(
    "/listings",
    response_model=ListingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="List something new",
)
async def create_listing(body: ListingCreate, me: dict = Depends(require_active_member)):
    doc = ListingModel.create_document(
        user_id=str(me["_id"]), member_id=me.get("member_id", ""), **body.model_dump(),
    )
    result = await _listings().insert_one(doc)
    doc["_id"] = result.inserted_id
    return ListingResponse(**ListingModel.to_response(doc))


@router.patch("/listings/{listing_id}", response_model=ListingResponse, summary="Change it")
async def update_listing(
    listing_id: str, body: ListingCreate, me: dict = Depends(require_active_member),
):
    # Scoped by user_id as well as _id: a listing id in a URL must never be
    # enough to edit somebody else's shop.
    updated = await _listings().find_one_and_update(
        {"_id": to_object_id(listing_id), "user_id": str(me["_id"])},
        {"$set": {**body.model_dump(), "updated_at": datetime.now(timezone.utc)}},
    )
    if not updated:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That listing is not yours, or is gone")
    fresh = await _listings().find_one({"_id": to_object_id(listing_id)})
    return ListingResponse(**ListingModel.to_response(fresh))


@router.delete("/listings/{listing_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Take it down")
async def delete_listing(listing_id: str, me: dict = Depends(require_active_member)):
    await _listings().delete_one({"_id": to_object_id(listing_id), "user_id": str(me["_id"])})
    return None


@router.get("/orders", response_model=list[OrderResponse], summary="Orders I have had")
async def list_orders(
    state: Optional[str] = Query(None),
    me: dict = Depends(require_active_member),
):
    query: dict = {"seller_id": str(me["_id"])}
    if state and state != "All":
        query["state"] = state
    docs = await _orders().find(query).sort("created_at", -1).to_list(300)
    rows = [ShopOrderModel.to_response(d) for d in docs]
    # Anyone waiting on her, first. Within that, oldest first — the person who
    # has been waiting longest should not be at the bottom.
    rows.sort(key=lambda r: (not r["needs_her"], r["placed_on"]))
    return [OrderResponse(**r) for r in rows]


@router.post("/orders/{order_id}/advance", response_model=OrderResponse, summary="Move it along")
async def advance(order_id: str, me: dict = Depends(require_active_member)):
    order = await _orders().find_one({"_id": to_object_id(order_id), "seller_id": str(me["_id"])})
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That order is not yours, or is gone")
    nxt = ShopOrderModel.NEXT.get(order.get("state", ""))
    if not nxt:
        raise HTTPException(status.HTTP_409_CONFLICT, "That order is already finished")
    await _orders().update_one(
        {"_id": order["_id"]},
        {"$set": {"state": nxt, "updated_at": datetime.now(timezone.utc)}},
    )
    order["state"] = nxt
    return OrderResponse(**ShopOrderModel.to_response(order))


@router.post("/orders/{order_id}/cancel", response_model=OrderResponse, summary="Call an order off")
async def cancel_order(order_id: str, me: dict = Depends(require_active_member)):
    """
    Cancel an order she has not sent yet.

    The order screens had a Cancel button that set a local flag: the word
    changed on her screen, the buyer's order was untouched, and she went on
    believing it was called off.
    """
    order = await _orders().find_one({"_id": to_object_id(order_id), "seller_id": str(me["_id"])})
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That order is not yours, or is gone")

    state = order.get("state", "")
    if state == ShopOrderModel.STATE_CANCELLED:
        return OrderResponse(**ShopOrderModel.to_response(order))
    if state not in ShopOrderModel.CANCELLABLE:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "That one has already gone out. Talk to the buyer about sending it back.",
        )

    await _orders().update_one(
        {"_id": order["_id"]},
        {"$set": {"state": ShopOrderModel.STATE_CANCELLED, "updated_at": datetime.now(timezone.utc)}},
    )
    order["state"] = ShopOrderModel.STATE_CANCELLED
    return OrderResponse(**ShopOrderModel.to_response(order))


@router.get("/reviews", response_model=list[ReviewResponse], summary="What buyers said")
async def list_reviews(me: dict = Depends(require_active_member)):
    docs = await _reviews().find({"seller_id": str(me["_id"])}).sort("created_at", -1).to_list(200)
    return [ReviewResponse(**ReviewModel.to_response(d)) for d in docs]


@router.post("/reviews/{review_id}/reply", response_model=ReviewResponse, summary="Reply to a review")
async def reply(review_id: str, body: ReplyRequest, me: dict = Depends(require_active_member)):
    updated = await _reviews().find_one_and_update(
        {"_id": to_object_id(review_id), "seller_id": str(me["_id"])},
        {"$set": {"reply": body.reply}},
    )
    if not updated:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That review is not on your shop")
    updated["reply"] = body.reply
    return ReviewResponse(**ReviewModel.to_response(updated))


# ── seed ───────────────────────────────────────────────────────────────────

async def seed() -> None:
    """
    Give every member a shop with a history.

    **Every member, not "the first one".** The first version took whichever
    member `find_one` happened to return and attached the demo shop to them —
    which turned out to be `test123@gmail.com` out of fifteen accounts, so the
    screens looked empty for everybody else including the account actually used
    for testing. Seeding per member costs a few hundred documents once and
    removes the question of which account the data landed on.

    Non-destructive per member: a woman who already has a listing is skipped,
    so this can run on every boot without touching real shops.
    """
    users = get_database()["users"]
    members = await users.find(
        {"role": {"$regex": "^member$", "$options": "i"}}
    ).to_list(200)
    if not members:
        return

    now = datetime.now(timezone.utc)
    for me in members:
        uid, mid = str(me["_id"]), me.get("member_id", "")
        if await _listings().count_documents({"user_id": uid}) > 0:
            continue

        # What she sells: things AND time, because most women here earn from
        # their time — tailoring to measure, mehendi, tuition, cooking.
        listings = [
            ListingModel.create_document(
                user_id=uid, member_id=mid, kind=ListingModel.KIND_PRODUCT,
                title="Hand-block printed kurta",
                desc="Bagru block print on soft cotton. Made to order in any size.",
                price_minor=140_000, stock=6, category="Clothing", place="Jaipur"),
            ListingModel.create_document(
                user_id=uid, member_id=mid, kind=ListingModel.KIND_PRODUCT,
                title="Embroidered cushion covers, pair",
                desc="Mirror work on handloom cotton. Sixteen inches.",
                price_minor=80_000, stock=2, category="Home", place="Jaipur"),
            ListingModel.create_document(
                user_id=uid, member_id=mid, kind=ListingModel.KIND_SERVICE,
                title="Blouse stitching to measure",
                desc="Bring the fabric; I take the measurements at your home.",
                price_minor=45_000, rate=ListingModel.RATE_PIECE, category="Tailoring",
                place="Sector 12", travels_km=5),
            ListingModel.create_document(
                user_id=uid, member_id=mid, kind=ListingModel.KIND_SERVICE,
                title="Bridal mehendi",
                desc="Full hands and feet. Book at least a week before.",
                price_minor=250_000, rate=ListingModel.RATE_VISIT, category="Beauty",
                place="Jaipur", travels_km=20),
        ]
        result = await _listings().insert_many(listings)
        ids = [str(i) for i in result.inserted_ids]

        orders = [
            ShopOrderModel.create_document(
                seller_id=uid, buyer_name="Anjali Mehta", listing_id=ids[0],
                title=listings[0]["title"], quantity=2, total_minor=280_000,
                note="Both in medium, please.", state="New"),
            ShopOrderModel.create_document(
                seller_id=uid, buyer_name="Ritu Bansal", listing_id=ids[2],
                title=listings[2]["title"], quantity=1, total_minor=45_000, state="Making"),
            ShopOrderModel.create_document(
                seller_id=uid, buyer_name="Sunita Devi", listing_id=ids[1],
                title=listings[1]["title"], quantity=1, total_minor=80_000, state="Ready"),
            ShopOrderModel.create_document(
                seller_id=uid, buyer_name="Farah Khan", listing_id=ids[3],
                title=listings[3]["title"], quantity=1, total_minor=250_000, state="Done"),
            ShopOrderModel.create_document(
                seller_id=uid, buyer_name="Meera Joshi", listing_id=ids[0],
                title=listings[0]["title"], quantity=1, total_minor=140_000, state="Sent"),
        ]
        for i, o in enumerate(orders):
            o["created_at"] = now - timedelta(days=i * 3)
        await _orders().insert_many(orders)

        await _reviews().insert_many([
            ReviewModel.create_document(
                seller_id=uid, buyer_name="Farah Khan", order_id="", stars=5,
                what=listings[3]["title"],
                text="She came on time and stayed until every guest was done. "
                     "I have already given her number to two people."),
            ReviewModel.create_document(
                seller_id=uid, buyer_name="Sunita Devi", order_id="", stars=5,
                what=listings[1]["title"],
                text="The mirror work is much finer than the photographs show."),
            ReviewModel.create_document(
                seller_id=uid, buyer_name="Ritu Bansal", order_id="", stars=4,
                what=listings[2]["title"],
                text="Fit is perfect. Took two days longer than she said."),
        ])
