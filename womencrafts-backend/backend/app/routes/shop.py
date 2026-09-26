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

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.core.rbac import require_active_member
from app.core.serializers import to_object_id
from app.db.mongodb import get_database
from app.core.audit import record
from app.models.shop import ListingModel, ReviewModel, ShopOperationModel, ShopOrderModel
from app.schemas.shop import (
    ListingCreate,
    ListingResponse,
    OrderResponse,
    ReplyRequest,
    ReviewResponse,
    ShopSummary,
    ShopOperationCreate,
    ShopOperationResponse,
    ShopOperationUpdate,
)

router = APIRouter(prefix="/shop", tags=["Member · Work"])


def _listings():
    return get_database()[ListingModel.collection_name]


def _orders():
    return get_database()[ShopOrderModel.collection_name]


def _reviews():
    return get_database()[ReviewModel.collection_name]


def _operations():
    return get_database()[ShopOperationModel.collection_name]


def _users():
    return get_database()["users"]


#: Rows a moderator has hidden stay on disk and out of her lists. See
#: admin_market.py — hiding never deletes, so the record outlives the decision.
NOT_HIDDEN = {"hidden": {"$ne": True}}


def _refuse_if_suspended(me: dict) -> None:
    """A seller staff have suspended can neither list nor re-publish."""
    if me.get("seller_suspended"):
        reason = (me.get("seller_suspension") or {}).get("reason", "")
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Your shop is suspended, so nothing can be listed just now."
            + (f" Reason: {reason}" if reason else ""),
        )


#: Everything a handle may contain. Lowercase, digits and single hyphens — the
#: characters that survive being read down a phone and typed back in.
_SLUG_OK = "abcdefghijklmnopqrstuvwxyz0123456789"


def _slug(name: str) -> str:
    out = []
    for ch in name.strip().lower():
        if ch in _SLUG_OK:
            out.append(ch)
        elif out and out[-1] != "-":
            out.append("-")
    return "".join(out).strip("-")[:24]


async def handle_for(me: dict) -> str:
    """
    Her shop's handle — one per member, minted the first time it is needed and
    never changed after.

    **Why it is not derived from her id.** The old one was
    `womsakhi.in/<member_id>`, which was three wrong things at once: it matched
    no route in the app, so every link she copied and sent was a 404 in a
    customer's chat under her name; it was a domain-and-path rather than a
    handle; and it put an internal identifier into a WhatsApp group. This is a
    slug of her FIRST name, so what goes out is `/s/priya` — recognisable,
    sayable, and it discloses nothing that the page it opens does not already
    show.

    **Why a first name and a counter rather than a longer, unique-by-design
    string.** Uniqueness is the database's job, not the string's: a unique index
    on `shop_handle` decides, and a name already taken simply takes the next
    number. Encoding the id into the handle to dodge the collision would have
    put the id back in the URL, which is the thing being removed.
    """
    got = (me.get("shop_handle") or "").strip()
    if got:
        return got

    first = (me.get("full_name") or "").strip().split(" ")[0]
    base = _slug(first) or "shop"
    for n in range(1, 80):
        candidate = base if n == 1 else f"{base}-{n}"
        try:
            updated = await _users().find_one_and_update(
                {"_id": me["_id"], "$or": [{"shop_handle": {"$exists": False}},
                           {"shop_handle": {"$in": [None, ""]}}]},
                {"$set": {"shop_handle": candidate}},
                return_document=ReturnDocument.AFTER,
            )
        except DuplicateKeyError:
            # Somebody already holds this one. Take the next number.
            continue
        if updated and updated.get("shop_handle"):
            me["shop_handle"] = updated["shop_handle"]
            return me["shop_handle"]
        # No match: she was given a handle by a request that raced this one.
        fresh = await _users().find_one({"_id": me["_id"]}, {"shop_handle": 1})
        if fresh and fresh.get("shop_handle"):
            me["shop_handle"] = fresh["shop_handle"]
            return me["shop_handle"]
    # Eighty women called Priya. Vanishingly unlikely, and a handle she can
    # still share beats refusing to give her one.
    return f"{base}-{str(me['_id'])[-6:]}"


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
        _listings().count_documents({"user_id": uid, **NOT_HIDDEN}),
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
        # The bare handle, which `/s/<handle>` resolves and
        # `GET /public/shop/<handle>` serves. See `handle_for`.
        handle=await handle_for(me),
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
    query: dict = {"user_id": str(me["_id"]), **NOT_HIDDEN}
    if kind:
        query["kind"] = kind
    docs = await _listings().find(query).sort("updated_at", -1).to_list(300)

    # How many orders each listing has actually had. One grouped pass over her
    # orders rather than a query per listing — a woman with sixty listings
    # should not cost sixty round trips to draw one table.
    counts: dict[str, int] = {}
    async for row in _orders().aggregate([
        {"$match": {"seller_id": str(me["_id"])}},
        {"$group": {"_id": "$listing_id", "n": {"$sum": 1}}},
    ]):
        counts[str(row["_id"])] = int(row["n"])

    out = []
    for d in docs:
        d["orders"] = counts.get(str(d["_id"]), 0)
        out.append(ListingResponse(**ListingModel.to_response(d)))
    return out


@router.post(
    "/listings",
    response_model=ListingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="List something new",
)
async def create_listing(body: ListingCreate, me: dict = Depends(require_active_member)):
    _refuse_if_suspended(me)
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
        {"_id": to_object_id(listing_id), "user_id": str(me["_id"]), **NOT_HIDDEN},
        {"$set": {**body.model_dump(exclude_unset=True), "updated_at": datetime.now(timezone.utc)}},
    )
    if not updated:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That listing is not yours, or is gone")
    fresh = await _listings().find_one({"_id": to_object_id(listing_id)})
    return ListingResponse(**ListingModel.to_response(fresh))


@router.post("/listings/{listing_id}/pause", response_model=ListingResponse, summary="Pause or restore it")
async def pause_listing(
    listing_id: str, paused: bool = True, me: dict = Depends(require_active_member),
):
    """
    Take a listing out of the shop without deleting it.

    `status` has existed on the model since the beginning with two values, and
    nothing could ever set the second one: `PATCH` takes a `ListingCreate`,
    which has no `status` field, so every listing was live from the moment it
    was made until it was deleted. A woman whose stock has run out, or who is
    away for a wedding, had only one lever — destroy the listing and rebuild it
    later, losing its reviews with it.
    """
    if not paused:
        _refuse_if_suspended(me)
    updated = await _listings().find_one_and_update(
        # Scoped by user_id as well as _id: a listing id in a URL must never be
        # enough to change somebody else's shop.
        {"_id": to_object_id(listing_id), "user_id": str(me["_id"]), **NOT_HIDDEN},
        {"$set": {"status": ListingModel.STATUS_PAUSED if paused else ListingModel.STATUS_LIVE,
                  "updated_at": datetime.now(timezone.utc)}},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That listing is not yours, or is gone")
    return ListingResponse(**ListingModel.to_response(updated))


@router.delete("/listings/{listing_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Take it down")
async def delete_listing(listing_id: str, me: dict = Depends(require_active_member)):
    await _listings().delete_one({"_id": to_object_id(listing_id), "user_id": str(me["_id"])})
    return None


@router.get("/operations", response_model=list[ShopOperationResponse], summary="My selling workflows")
async def list_operations(
    kind: Optional[str] = Query(None),
    include_archived: bool = Query(False),
    me: dict = Depends(require_active_member),
):
    if kind and kind not in ShopOperationModel.KINDS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown shop workflow")
    query: dict = {"user_id": str(me["_id"])}
    if kind:
        query["kind"] = kind
    if not include_archived:
        query["archived"] = {"$ne": True}
    docs = await _operations().find(query).sort("updated_at", -1).to_list(300)
    return [ShopOperationResponse(**ShopOperationModel.to_response(d)) for d in docs]


@router.post("/operations", response_model=ShopOperationResponse, status_code=status.HTTP_201_CREATED)
async def create_operation(
    body: ShopOperationCreate,
    request: Request,
    me: dict = Depends(require_active_member),
):
    data = body.model_dump()
    if len(data["details"]) > 20 or any(len(str(k)) > 60 or len(str(v)) > 500 for k, v in data["details"].items()):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Workflow details are too large")
    doc = ShopOperationModel.create_document(user_id=str(me["_id"]), **data)
    result = await _operations().insert_one(doc)
    doc["_id"] = result.inserted_id
    await record(me, "shop.operation.create", target=str(result.inserted_id), detail=body.kind, request=request)
    return ShopOperationResponse(**ShopOperationModel.to_response(doc))


@router.patch("/operations/{operation_id}", response_model=ShopOperationResponse)
async def update_operation(
    operation_id: str,
    body: ShopOperationUpdate,
    request: Request,
    me: dict = Depends(require_active_member),
):
    changes = body.model_dump(exclude_unset=True)
    details = changes.get("details")
    if details is not None and (len(details) > 20 or any(len(str(k)) > 60 or len(str(v)) > 500 for k, v in details.items())):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Workflow details are too large")
    changes["updated_at"] = datetime.now(timezone.utc)
    updated = await _operations().find_one_and_update(
        {"_id": to_object_id(operation_id), "user_id": str(me["_id"]), "archived": {"$ne": True}},
        {"$set": changes},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That workflow is not yours, or is gone")
    await record(me, "shop.operation.update", target=operation_id, detail=updated.get("kind", ""), request=request)
    return ShopOperationResponse(**ShopOperationModel.to_response(updated))


@router.delete("/operations/{operation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_operation(
    operation_id: str,
    request: Request,
    me: dict = Depends(require_active_member),
):
    updated = await _operations().find_one_and_update(
        {"_id": to_object_id(operation_id), "user_id": str(me["_id"]), "archived": {"$ne": True}},
        {"$set": {"archived": True, "updated_at": datetime.now(timezone.utc)}},
    )
    if not updated:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That workflow is not yours, or is gone")
    await record(me, "shop.operation.archive", target=operation_id, detail=updated.get("kind", ""), request=request)
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
    docs = await _reviews().find({"seller_id": str(me["_id"]), **NOT_HIDDEN}).sort("created_at", -1).to_list(200)
    return [ReviewResponse(**ReviewModel.to_response(d)) for d in docs]


@router.post("/reviews/{review_id}/reply", response_model=ReviewResponse, summary="Reply to a review")
async def reply(review_id: str, body: ReplyRequest, me: dict = Depends(require_active_member)):
    updated = await _reviews().find_one_and_update(
        {"_id": to_object_id(review_id), "seller_id": str(me["_id"]), **NOT_HIDDEN},
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

    # Who already has a shop, in ONE round trip.
    #
    # This asked the question per member — `count_documents({"user_id": uid})`
    # inside the loop — which is up to two hundred serial round trips to Atlas
    # on a connection whose latency is the whole cost. Measured on boot: 1,072ms
    # of a 2,776ms seed, thirty-nine per cent of it, and 3.4x the next worst
    # seeder. `distinct` answers the same question once.
    seeded = set(await _listings().distinct("user_id"))

    now = datetime.now(timezone.utc)
    for me in members:
        uid, mid = str(me["_id"]), me.get("member_id", "")
        if uid in seeded:
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
