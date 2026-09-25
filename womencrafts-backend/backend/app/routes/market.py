"""
The market, from the buyer's side — the half that did not exist.

`shop.py` answers "what do I sell, and who is waiting on me?". Every one of its
endpoints is scoped to `user_id == me`, which is correct and which left the
market screens with nothing to call: there was no way to see another woman's
listing, no way to place an order against one, and no way to ask her a question.
So `/app/market` rendered eight fixtures and three of its buttons only pretended
— an order that was a `useState` flag, a "message sent" that sent nothing, and
a Save that was forgotten on navigation.

── WomSakhi never holds her money ──────────────────────────────────────────────
An order here takes NO payment. It is a real row in the seller's order book and
nothing else, and the buyer pays the seller directly.

That is not a shortcut around an unfinished gateway; it is the product
constraint. `POST /payments/orders` creates an order against WomSakhi's own
merchant account — `provider.create_order` authenticates with the platform's
keys and the order document has no payee field at all — so money taken that way
settles to WomSakhi and would have to be paid back out to the seller. That is
custody of her money, which `wallet.py` already states this platform must not
take ("that would make us a payments company, which needs a licence we do not
have"). Buyer-to-seller settlement needs a payout rail with the seller as the
payee — Razorpay Route, a linked account, or a UPI intent addressed to her —
and choosing one is a decision this module will not make on its own.

── The ordering is the product ─────────────────────────────────────────────────
Her circle first, then women she has bought from, then everyone else. That is
the only advantage this market has over any other listings page, and it is
computed here from real memberships and her real order history — never stored,
never guessed.

What is NOT here is as deliberate. No distance: nothing in this database knows
where either woman is, so "0.4 km away" would be invented. No star rating: most
sellers have too few to mean anything. No complaint count: nothing records a
complaint against a seller, so the market does not claim "no complaints, ever".
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status

from app.core import idempotency, mongosafe
from app.core.rbac import require_active_member
from app.core.serializers import to_object_id
from app.core.media import media_url
from app.db.mongodb import get_database
from app.models.community import CircleMemberModel
from app.models.conversation import MemberNotificationModel, notify
from app.models.member_conversation import MemberConversationModel as Conv
from app.models.saved import SavedModel
from app.models.shop import ListingModel, ShopOrderModel
from app.schemas.market import (
    AskRequest,
    AskResult,
    MarketListing,
    MarketListingDetail,
    MarketSeller,
    MyMarketOrder,
    PlaceOrderRequest,
    PlacedOrder,
)

router = APIRouter(prefix="/market", tags=["Member · Market"])

#: How close a seller is to this buyer, and what that is worth in the ordering.
#: Social tie dominates everything else, because it is the only thing this
#: market has that a listings page does not.
TIE_CIRCLE = "circle"
TIE_BOUGHT = "bought-before"
TIE_NEW = "new"

_TIE_WEIGHT = {TIE_CIRCLE: 400, TIE_BOUGHT: 300, TIE_NEW: 0}
_TIE_LABEL = {
    TIE_CIRCLE: "In your circle",
    TIE_BOUGHT: "You have bought from her",
    # Not "Further away": nothing here knows how far away she is.
    TIE_NEW: "New to you",
}

#: What the buyer is told about paying. One sentence, written once, so that no
#: screen can quietly imply the platform is holding the money.
PAY_NOTE = (
    "You pay her directly when you collect it. WomSakhi does not take the "
    "money and does not hold it."
)


def _listings():
    return get_database()[ListingModel.collection_name]


def _orders():
    return get_database()[ShopOrderModel.collection_name]


def _saved():
    return get_database()[SavedModel.collection_name]


def _convos():
    return get_database()[Conv.collection_name]


def _users():
    return get_database()["users"]


def _members_of_circles():
    return get_database()[CircleMemberModel.collection_name]


def _oids(ids) -> list[ObjectId]:
    out = []
    for i in ids:
        try:
            out.append(ObjectId(i))
        except Exception:  # noqa: BLE001 — an unreadable id is simply not found
            continue
    return out


async def _circle_peers(uid: str) -> set[str]:
    """Every woman who shares a circle with her. Two queries, never one per circle."""
    circles = await _members_of_circles().distinct("circle_id", {"user_id": uid})
    if not circles:
        return set()
    peers = await _members_of_circles().distinct("user_id", {"circle_id": {"$in": circles}})
    return {p for p in peers if p != uid}


async def _seller_stats(seller_ids: list[str]) -> dict[str, dict]:
    """
    Orders finished and buyers who came back, for a whole page of sellers.

    One aggregation for every seller on the screen, not one query each: a
    market page shows thirty women, and thirty round trips to a cluster in
    another data centre is the whole cost of the screen.

    A buyer is identified by her account where the order has one and by the
    name written on it otherwise — the seeded history predates buyer accounts,
    and dropping it would under-report every seller who has been here longest.
    """
    if not seller_ids:
        return {}
    rows = await _orders().aggregate([
        {"$match": {"seller_id": {"$in": seller_ids}}},
        {"$group": {
            "_id": {
                "seller": "$seller_id",
                "buyer": {"$ifNull": ["$buyer_id", {"$ifNull": ["$buyer_name", ""]}]},
            },
            "orders": {"$sum": 1},
            "finished": {"$sum": {"$cond": [{"$in": ["$state", ["Sent", "Done"]]}, 1, 0]}},
        }},
    ]).to_list(5000)

    out: dict[str, dict] = {}
    for r in rows:
        seller = r["_id"]["seller"]
        stat = out.setdefault(seller, {"orders_done": 0, "repeat_buyers": 0})
        stat["orders_done"] += int(r.get("finished", 0))
        if int(r.get("orders", 0)) > 1 and r["_id"]["buyer"]:
            stat["repeat_buyers"] += 1
    return out


async def _bought_by_circle(listing_ids: list[str], peers: set[str]) -> dict[str, int]:
    """
    How many women she knows have ordered each listing.

    The strongest signal in a trust market, and a real count: zero until
    somebody in one of her circles actually buys the thing. It counts BUYERS,
    not orders — one woman ordering four times is one woman.
    """
    if not listing_ids or not peers:
        return {}
    rows = await _orders().aggregate([
        {"$match": {"listing_id": {"$in": listing_ids}, "buyer_id": {"$in": list(peers)}}},
        {"$group": {"_id": "$listing_id", "buyers": {"$addToSet": "$buyer_id"}}},
    ]).to_list(len(listing_ids))
    return {r["_id"]: len(r.get("buyers") or []) for r in rows}


def _tie(seller_id: str, peers: set[str], bought_from: set[str]) -> str:
    if seller_id in peers:
        return TIE_CIRCLE
    if seller_id in bought_from:
        return TIE_BOUGHT
    return TIE_NEW


def _row(
    doc: dict,
    *,
    sellers: dict[str, dict],
    stats: dict[str, dict],
    peers: set[str],
    bought_from: set[str],
    circle_counts: dict[str, int],
    saved_ids: set[str],
) -> dict:
    base = ListingModel.to_response(doc)
    listing_id = base["id"]
    seller_id = doc.get("user_id", "")
    who = sellers.get(seller_id) or {}
    stat = stats.get(seller_id) or {}
    tie = _tie(seller_id, peers, bought_from)
    base.pop("status", None)
    base.pop("views", None)
    return {
        **base,
        "seller": {
            "id": seller_id,
            # A seller whose account has gone is named as gone rather than as
            # an empty string — a blank name reads like a rendering bug.
            "name": who.get("full_name") or "A WomSakhi member",
            "avatar": media_url(who.get("avatar") or ""),
            "tie": tie,
            "tie_label": _TIE_LABEL[tie],
            "orders_done": int(stat.get("orders_done", 0)),
            "repeat_buyers": int(stat.get("repeat_buyers", 0)),
            "place": base.get("place", ""),
        },
        "bought_by_circle": int(circle_counts.get(listing_id, 0)),
        "saved": listing_id in saved_ids,
    }


def _rank(row: dict) -> int:
    s = row["seller"]
    return (
        _TIE_WEIGHT[s["tie"]]
        + s["repeat_buyers"] * 6
        + row["bought_by_circle"] * 10
        + min(s["orders_done"], 100)
    )


async def _decorate(docs: list[dict], uid: str) -> list[dict]:
    """Everything a page of listings needs, in four round trips rather than one per row."""
    if not docs:
        return []
    seller_ids = list({d.get("user_id", "") for d in docs if d.get("user_id")})
    listing_ids = [str(d["_id"]) for d in docs]

    peers, bought_from, saved_ids, seller_docs, stats = await asyncio.gather(
        _circle_peers(uid),
        _orders().distinct("seller_id", {"buyer_id": uid}),
        _saved().distinct("ref_id", {"user_id": uid, "kind": SavedModel.KIND_LISTING}),
        _users().find(
            {"_id": {"$in": _oids(seller_ids)}}, {"full_name": 1, "avatar": 1},
        ).to_list(len(seller_ids) or 1),
        _seller_stats(seller_ids),
    )
    circle_counts = await _bought_by_circle(listing_ids, peers)

    sellers = {str(u["_id"]): u for u in seller_docs}
    return [
        _row(
            d,
            sellers=sellers, stats=stats, peers=peers,
            bought_from=set(bought_from), circle_counts=circle_counts,
            saved_ids=set(saved_ids),
        )
        for d in docs
    ]


@router.get("/listings", response_model=list[MarketListing], summary="What other women are selling")
async def browse(
    kind: Optional[str] = Query(None, description="product | service"),
    category: Optional[str] = Query(None),
    q: Optional[str] = Query(None, description="Search a title, a description or a place"),
    tie: Optional[str] = Query(None, description=f"{TIE_CIRCLE} | {TIE_BOUGHT}"),
    limit: int = Query(120, ge=1, le=300),
    me: dict = Depends(require_active_member),
):
    """
    Live listings belonging to somebody else, her circle first.

    Her own shop is excluded — it is one tap away under "Your own shop", and a
    market that offers to sell you your own kurta is a market nobody trusts.
    Paused listings are excluded for the same reason: a woman who paused because
    her stock ran out must not keep taking orders.
    """
    uid = str(me["_id"])
    query: dict = {"status": ListingModel.STATUS_LIVE, "user_id": {"$ne": uid}}
    if kind in (ListingModel.KIND_PRODUCT, ListingModel.KIND_SERVICE):
        query["kind"] = kind
    if category:
        query["category"] = category
    if q and q.strip():
        query.update(mongosafe.any_of(q, ["title", "desc", "category", "place"]))

    docs = await _listings().find(query).sort("updated_at", -1).to_list(300)
    rows = await _decorate(docs, uid)
    if tie:
        rows = [r for r in rows if r["seller"]["tie"] == tie]
    rows.sort(key=_rank, reverse=True)
    return [MarketListing(**r) for r in rows[:limit]]


@router.get("/listings/{listing_id}", response_model=MarketListingDetail, summary="One thing, and the woman who makes it")
async def one_listing(
    listing_id: str,
    later: BackgroundTasks,
    me: dict = Depends(require_active_member),
):
    uid = str(me["_id"])
    doc = await _listings().find_one({"_id": to_object_id(listing_id)})
    if not doc or doc.get("status") != ListingModel.STATUS_LIVE:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "That is not for sale any more. She may have paused it.",
        )
    if doc.get("user_id") == uid:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "That is your own listing — it is in your shop, not the market.",
        )

    seller_id = doc.get("user_id", "")
    rows = await _decorate([doc], uid)
    row = rows[0]

    also, mine, thread = await asyncio.gather(
        _listings().find({
            "user_id": seller_id,
            "status": ListingModel.STATUS_LIVE,
            "_id": {"$ne": doc["_id"]},
        }).sort("updated_at", -1).to_list(8),
        _orders().find({"buyer_id": uid, "listing_id": listing_id}).sort("created_at", -1).to_list(20),
        _convos().find_one({"member_id": uid, "with_user_id": seller_id}, {"_id": 1}),
    )
    also_rows = await _decorate(also, uid)

    # She looked at it, so the view is real. After the response, because she is
    # not waiting on a counter — and a failed counter must not fail the screen.
    later.add_task(_listings().update_one, {"_id": doc["_id"]}, {"$inc": {"views": 1}})

    return MarketListingDetail(
        **row,
        also_hers=[MarketListing(**r) for r in also_rows],
        my_orders=[
            MyMarketOrder(
                **{k: v for k, v in ShopOrderModel.to_response(o).items()
                   if k in {"id", "listing_id", "title", "quantity", "total_minor",
                            "total_label", "note", "state", "placed_on"}},
                seller_id=seller_id,
                seller_name=row["seller"]["name"],
            )
            for o in mine
        ],
        conversation_id=str(thread["_id"]) if thread else None,
    )


@router.get("/orders", response_model=list[MyMarketOrder], summary="What I have ordered")
async def my_orders(me: dict = Depends(require_active_member)):
    """
    Orders she PLACED, not orders she received — `/shop/orders` is the other side.

    The seeded history has no buyer account on it, so it does not appear here.
    That is right: nobody placed those orders.
    """
    uid = str(me["_id"])
    docs = await _orders().find({"buyer_id": uid}).sort("created_at", -1).to_list(200)
    if not docs:
        return []
    sellers = {
        str(u["_id"]): u
        for u in await _users().find(
            {"_id": {"$in": _oids({d.get("seller_id", "") for d in docs})}},
            {"full_name": 1},
        ).to_list(200)
    }
    out = []
    for d in docs:
        r = ShopOrderModel.to_response(d)
        seller_id = d.get("seller_id", "")
        out.append(MyMarketOrder(
            **{k: v for k, v in r.items()
               if k in {"id", "listing_id", "title", "quantity", "total_minor",
                        "total_label", "note", "state", "placed_on"}},
            seller_id=seller_id,
            seller_name=(sellers.get(seller_id) or {}).get("full_name") or "A WomSakhi member",
        ))
    return out


@router.post(
    "/listings/{listing_id}/order",
    response_model=PlacedOrder,
    status_code=status.HTTP_201_CREATED,
    summary="Order it — no money changes hands here",
)
async def place_order(
    listing_id: str,
    body: PlaceOrderRequest,
    request: Request,
    me: dict = Depends(require_active_member),
):
    """
    A real row in her order book, and nothing else.

    **No payment is taken and none is held.** See the module docstring: routing
    a buyer's money through this platform would put WomSakhi in custody of it,
    which is the one thing this product says it must never do. The buyer pays
    the seller herself; `pay_note` is the sentence the screen must show.

    Send an `Idempotency-Key` and a double tap on a bad connection cannot become
    two orders — which matters more here than almost anywhere, because the woman
    on the other end will start cutting cloth for both of them.
    """
    return await idempotency.once(
        request, str(me["_id"]), f"market.order:{listing_id}",
        lambda: _place_order(listing_id, body, me),
    )


async def _place_order(listing_id: str, body: PlaceOrderRequest, me: dict) -> PlacedOrder:
    uid = str(me["_id"])
    oid = to_object_id(listing_id)
    listing = await _listings().find_one({"_id": oid})
    if not listing or listing.get("status") != ListingModel.STATUS_LIVE:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "That is not for sale any more. She may have paused it.")
    if listing.get("user_id") == uid:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That is your own listing.")
    if listing.get("price_mode", "fixed") != "fixed":
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Ask the seller to agree a fixed price before ordering.")

    quantity = max(1, int(body.quantity))
    stock = listing.get("stock")

    # For something she keeps in a box, the stock check and the stock write are
    # the SAME operation. Reading "6 left" and then decrementing is how two
    # buyers on a slow connection both get the last one.
    if stock is not None:
        taken = await _listings().find_one_and_update(
            {"_id": oid, "status": ListingModel.STATUS_LIVE, "stock": {"$gte": quantity}},
            {"$inc": {"stock": -quantity}, "$set": {"updated_at": datetime.now(timezone.utc)}},
        )
        if not taken:
            left = int(listing.get("stock") or 0)
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"She has only {left} left." if left else "She has none left just now.",
            )

    total = int(listing.get("price_minor") or 0) * quantity
    doc = ShopOrderModel.create_document(
        seller_id=listing.get("user_id", ""),
        buyer_id=uid,
        buyer_name=me.get("full_name", "") or "A WomSakhi member",
        listing_id=listing_id,
        title=listing.get("title", ""),
        quantity=quantity,
        total_minor=total,
        note=body.note,
        state="New",
    )
    try:
        result = await _orders().insert_one(doc)
    except Exception:
        # The stock was taken for an order that does not exist. Put it back,
        # or the next buyer is told there is none left because of a failure
        # that had nothing to do with her.
        if stock is not None:
            await _listings().update_one({"_id": oid}, {"$inc": {"stock": quantity}})
        raise
    doc["_id"] = result.inserted_id

    seller = await _users().find_one(
        {"_id": to_object_id(listing.get("user_id", ""))}, {"full_name": 1},
    ) if listing.get("user_id") else None
    seller_name = (seller or {}).get("full_name") or "A WomSakhi member"

    await notify(
        get_database(), listing.get("user_id", ""),
        title="A new order",
        body=f"{doc['buyer_name']} ordered {doc['quantity']} × {doc['title']}. "
             f"She pays you directly.",
        ntype=MemberNotificationModel.TYPE_MONEY,
        href="/app/shop",
    )

    r = ShopOrderModel.to_response(doc)
    return PlacedOrder(
        order=MyMarketOrder(
            **{k: v for k, v in r.items()
               if k in {"id", "listing_id", "title", "quantity", "total_minor",
                        "total_label", "note", "state", "placed_on"}},
            seller_id=listing.get("user_id", ""),
            seller_name=seller_name,
        ),
        seller_name=seller_name,
        pay_directly=True,
        pay_note=PAY_NOTE,
    )


async def _party(uid: str, seller_id: str) -> dict:
    """What one woman has bought from the other. Counted, not claimed."""
    rows = await _orders().find(
        {"buyer_id": uid, "seller_id": seller_id}, {"total_minor": 1},
    ).to_list(200)
    return {
        "orders": len(rows),
        "spent_minor": sum(int(r.get("total_minor") or 0) for r in rows),
        "since": "",
    }


@router.post(
    "/listings/{listing_id}/ask",
    response_model=AskResult,
    status_code=status.HTTP_201_CREATED,
    summary="Ask her something",
)
async def ask(listing_id: str, body: AskRequest, me: dict = Depends(require_active_member)):
    """
    A message that exists on both sides.

    The market's button used to set a note reading "Message sent to Sunita. She
    usually replies the same day" and send nothing at all. There is no
    member-to-member endpoint in `me_messages.py` to send it WITH — every route
    there operates on a thread that already exists, and nothing could create
    one — so starting the thread is this endpoint's job.

    A thread is a PAIR of documents that name each other: hers, where the
    question arrives unread, and the buyer's, where her reply will land. See
    `MemberConversationModel.create_document`.
    """
    uid = str(me["_id"])
    listing = await _listings().find_one({"_id": to_object_id(listing_id)})
    if not listing or listing.get("status") != ListingModel.STATUS_LIVE:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "That is not for sale any more. She may have paused it.")
    seller_id = listing.get("user_id", "")
    if seller_id == uid:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That is your own listing.")

    seller = await _users().find_one(
        {"_id": to_object_id(seller_id)}, {"full_name": 1, "avatar": 1})
    seller_name = (seller or {}).get("full_name") or "A WomSakhi member"

    text = body.text.strip()
    at = datetime.now(timezone.utc)
    party = await _party(uid, seller_id)

    # Upsert on (member_id, with_user_id) so asking twice in quick succession
    # continues the thread rather than starting a second one.
    hers = await _convos().find_one_and_update(
        {"member_id": seller_id, "with_user_id": uid},
        {"$setOnInsert": Conv.create_document(
            member_id=seller_id, kind=Conv.KIND_BUYER,
            name=me.get("full_name", "") or "A WomSakhi member",
            avatar=me.get("avatar", "") or "",
            subtitle=listing.get("title", ""),
            with_user_id=uid,
            party={"role": "Buyer", **party},
        )},
        upsert=True, return_document=True,
    )
    ours = await _convos().find_one_and_update(
        {"member_id": uid, "with_user_id": seller_id},
        {"$setOnInsert": Conv.create_document(
            member_id=uid, kind=Conv.KIND_SELLER,
            name=seller_name,
            avatar=(seller or {}).get("avatar", "") or "",
            subtitle=listing.get("title", ""),
            with_user_id=seller_id,
            party={"role": "Seller", **party},
        )},
        upsert=True, return_document=True,
    )

    await asyncio.gather(
        _convos().update_one(
            {"_id": hers["_id"]},
            {"$push": {"messages": Conv.bubble(direction="in", text=text, at=at)},
             "$set": {"counterpart_id": str(ours["_id"]), "updated_at": at}},
        ),
        _convos().update_one(
            {"_id": ours["_id"]},
            {"$push": {"messages": Conv.bubble(direction="out", text=text, at=at)},
             "$set": {"counterpart_id": str(hers["_id"]), "updated_at": at}},
        ),
    )

    await notify(
        get_database(), seller_id,
        title=f"{me.get('full_name', '') or 'A buyer'} asked about {listing.get('title', '')}",
        body=text[:140],
        ntype=MemberNotificationModel.TYPE_MESSAGE,
        href="/app/messages",
    )

    return AskResult(
        conversation_id=str(ours["_id"]),
        delivered_to=seller_name,
        text=text,
    )
