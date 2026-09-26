"""
Staff side of the marketplace: listings, orders, reviews, group buys and sellers.

Every endpoint is behind the "market" module guard (main.py) and names its
action (market.view / .edit / ...); every write is audited with the row id as
its target, so an investigator can pull every staff action against one
listing, one order or one seller.

── Moderation hides, it never deletes ──────────────────────────────────────
A listing or a review that caused a complaint has to outlive the complaint,
or there is nothing to review the decision against. So hiding sets `hidden`
and a `moderation` block (state, reason, who, when) on the row and the member
queries in `shop.py` / `market.py` exclude it. Restoring clears the flag and
keeps the note. Removing is hiding with a stronger word on the record.

── What staff never see here ───────────────────────────────────────────────
A buyer or a seller is shown by name and avatar only. No email, no phone, no
address — the market screens are for running the market, not for reaching
women outside it. The People module is where contact details live, behind
its own permission.

── Group buys: the staff half that did not exist ───────────────────────────
`group_buy.py` says "the order is placed by staff when the threshold is met".
Nothing anywhere could do that, so every buy that reached its number sat on
"met" forever and every woman who joined was never told anything. Placing
the order, closing without one, cancelling and marking delivered each write a
`member_notifications` row to every joiner — the inbox the member app
actually reads (see `app/engines/notify.py`, `write_inbox`).
"""

from __future__ import annotations

import asyncio
import csv
import io
from datetime import datetime, timedelta, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, Field, field_validator

from app.core import cache, mongosafe
from app.core.audit import record
from app.core.deps import get_current_user
from app.core.media import media_url
from app.core.permissions import require_permission
from app.core.serializers import aware, to_object_id
from app.db.mongodb import get_database
from app.models.conversation import MemberNotificationModel, notify
from app.models.groupbuy import GroupBuyJoinerModel, GroupBuyModel
from app.models.shop import ListingModel, ReviewModel, ShopOrderModel
from app.models.staff import ActivityLogModel
from app.models.user import UserModel

router = APIRouter(prefix="/admin/market", tags=["Market & Shops (staff)"])

KITCHEN = "kitchen_progress"

#: The three states a moderated row can be in. Stored on `moderation.state`.
MOD_VISIBLE = "visible"
MOD_HIDDEN = "hidden"
MOD_REMOVED = "removed"

#: Where a member is sent when a market notification is tapped.
HREF_SHOP = "/app/shop"
HREF_GROUP_BUY = "/app/group-buy"
HREF_MARKET_ORDERS = "/app/market"

OPEN_ORDER_STATES = ("New", "Making", "Ready")
PAID_ORDER_STATES = ("Sent", "Done")


# ── collections ────────────────────────────────────────────────────────────

def _listings():
    return get_database()[ListingModel.collection_name]


def _orders():
    return get_database()[ShopOrderModel.collection_name]


def _reviews():
    return get_database()[ReviewModel.collection_name]


def _buys():
    return get_database()[GroupBuyModel.collection_name]


def _joiners():
    return get_database()[GroupBuyJoinerModel.collection_name]


def _users():
    return get_database()[UserModel.collection_name]


def _kitchen():
    return get_database()[KITCHEN]


def _audit():
    return get_database()[ActivityLogModel.collection_name]


# ── small helpers ──────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(v) -> str:
    got = aware(v) if isinstance(v, datetime) else None
    return got.isoformat() if got else ""


def _actor_name(me: dict) -> str:
    return me.get("full_name", "") or me.get("email", "") or "Staff"


def _oids(ids) -> list[ObjectId]:
    out = []
    for i in set(ids):
        try:
            out.append(ObjectId(i))
        except Exception:  # noqa: BLE001 — an unreadable id is simply not found
            continue
    return out


def _paging(page: int, page_size: int) -> tuple[int, int]:
    return max(1, page), max(5, min(50, page_size))


def _pages(total: int, page_size: int) -> int:
    return max(1, (total + page_size - 1) // page_size) if page_size else 1


async def _people(user_ids) -> dict[str, dict]:
    """
    Name, avatar and member code for a set of accounts — and nothing else.

    The projection is the privacy rule: email and phone are never read here,
    so no response built from this map can leak them by accident.
    """
    oids = _oids(user_ids)
    if not oids:
        return {}
    rows = await _users().find(
        {"_id": {"$in": oids}},
        {"full_name": 1, "avatar": 1, "member_id": 1, "seller_suspended": 1,
         "seller_suspension": 1, "created_at": 1},
    ).to_list(len(oids))
    return {str(r["_id"]): r for r in rows}


def _person(user_id: str, people: dict[str, dict], fallback: str = "") -> dict:
    who = people.get(user_id) or {}
    return {
        "id": user_id,
        # A seller whose account has gone is named as gone rather than as an
        # empty string — a blank name reads like a rendering bug.
        "name": who.get("full_name") or fallback or ("A WomSakhi member" if user_id else "—"),
        "avatar": media_url(who.get("avatar") or ""),
        "member_id": who.get("member_id", "") or "",
        "suspended": bool(who.get("seller_suspended")),
    }


def _moderation(doc: dict) -> dict:
    m = doc.get("moderation") or {}
    return {
        "state": m.get("state") or (MOD_HIDDEN if doc.get("hidden") else MOD_VISIBLE),
        "reason": m.get("reason", "") or "",
        "by": m.get("by", "") or "",
        "at": _iso(m.get("at")),
    }


def _csv(rows: list[list], filename: str) -> Response:
    buf = io.StringIO()
    csv.writer(buf).writerows(rows)
    stamp = _now().strftime("%Y-%m-%d")
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="womsakhi-{filename}-{stamp}.csv"'},
    )


def _day_bounds(from_: Optional[str], to: Optional[str]) -> dict:
    """`from`/`to` as YYYY-MM-DD, inclusive, into a `created_at` clause."""
    clause: dict = {}
    for key, raw, end in (("$gte", from_, False), ("$lt", to, True)):
        if not raw:
            continue
        try:
            day = datetime.strptime(raw.strip()[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Dates are YYYY-MM-DD")
        clause[key] = day + timedelta(days=1) if end else day
    return {"created_at": clause} if clause else {}


# ── request bodies ─────────────────────────────────────────────────────────

class ReasonIn(BaseModel):
    reason: str = Field("", max_length=400)

    @field_validator("reason")
    @classmethod
    def _trim(cls, v: str) -> str:
        return (v or "").strip()


class RequiredReasonIn(ReasonIn):
    reason: str = Field(..., min_length=3, max_length=400)


class GroupBuyUpsert(BaseModel):
    item: str = Field(..., min_length=2, max_length=120)
    unit: str = Field("", max_length=60)
    alone_minor: int = Field(..., ge=0)
    together_minor: int = Field(..., ge=0)
    needed: int = Field(..., ge=1, le=10_000)
    closes_at: datetime
    supplier: str = Field("", max_length=120)
    note: str = Field("", max_length=400)

    @field_validator("item", "unit", "supplier", "note")
    @classmethod
    def _trim(cls, v: str) -> str:
        return (v or "").strip()

    @field_validator("closes_at")
    @classmethod
    def _aware(cls, v: datetime) -> datetime:
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)


class PlaceOrderIn(BaseModel):
    reference: str = Field("", max_length=120)
    note: str = Field("", max_length=400)

    @field_validator("reference", "note")
    @classmethod
    def _trim(cls, v: str) -> str:
        return (v or "").strip()


# ── summary ────────────────────────────────────────────────────────────────

@router.get(
    "/summary",
    summary="The market at a glance",
    dependencies=[Depends(require_permission("market.view"))],
)
async def summary():
    """Counts only — every one of them a query, none of them remembered."""
    (
        l_total, l_live, l_paused, l_hidden,
        o_total, o_open, o_done, o_cancelled,
        r_total, r_hidden,
        gb_open, gb_met, gb_ordered, gb_closed,
        seller_ids, suspended,
    ) = await asyncio.gather(
        _listings().count_documents({}),
        _listings().count_documents({"status": ListingModel.STATUS_LIVE, "hidden": {"$ne": True}}),
        _listings().count_documents({"status": ListingModel.STATUS_PAUSED, "hidden": {"$ne": True}}),
        _listings().count_documents({"hidden": True}),
        _orders().count_documents({}),
        _orders().count_documents({"state": {"$in": list(OPEN_ORDER_STATES)}}),
        _orders().count_documents({"state": {"$in": list(PAID_ORDER_STATES)}}),
        _orders().count_documents({"state": ShopOrderModel.STATE_CANCELLED}),
        _reviews().count_documents({}),
        _reviews().count_documents({"hidden": True}),
        _buys().count_documents({"status": GroupBuyModel.STATUS_OPEN}),
        _buys().count_documents({"status": GroupBuyModel.STATUS_MET}),
        _buys().count_documents({"status": GroupBuyModel.STATUS_ORDERED}),
        _buys().count_documents({"status": GroupBuyModel.STATUS_CLOSED}),
        _listings().distinct("user_id"),
        _users().count_documents({"seller_suspended": True}),
    )
    return {
        "listings": {"total": l_total, "live": l_live, "paused": l_paused, "hidden": l_hidden},
        "orders": {"total": o_total, "open": o_open, "done": o_done, "cancelled": o_cancelled},
        "reviews": {"total": r_total, "hidden": r_hidden},
        "group_buys": {"open": gb_open, "met": gb_met, "ordered": gb_ordered, "closed": gb_closed},
        "sellers": {"total": len([s for s in seller_ids if s]), "suspended": suspended},
    }


# ── listings ───────────────────────────────────────────────────────────────

def _listing_query(q: str, status_: str, kind: str, seller: str) -> dict:
    query: dict = {}
    if status_ == "hidden":
        query["hidden"] = True
    elif status_ in (ListingModel.STATUS_LIVE, ListingModel.STATUS_PAUSED):
        query["status"] = status_
        query["hidden"] = {"$ne": True}
    if kind in (ListingModel.KIND_PRODUCT, ListingModel.KIND_SERVICE):
        query["kind"] = kind
    if seller:
        query["user_id"] = seller
    if q and q.strip():
        query.update(mongosafe.any_of(q, ["title", "desc", "category", "place"]))
    return query


async def _order_counts(listing_ids: list[str]) -> dict[str, int]:
    if not listing_ids:
        return {}
    rows = await _orders().aggregate([
        {"$match": {"listing_id": {"$in": listing_ids}}},
        {"$group": {"_id": "$listing_id", "n": {"$sum": 1}}},
    ]).to_list(len(listing_ids))
    return {str(r["_id"]): int(r["n"]) for r in rows}


def _listing_row(doc: dict, people: dict[str, dict], orders: int) -> dict:
    base = ListingModel.to_response(doc)
    base["orders"] = orders
    return {
        **base,
        "updated_at": _iso(doc.get("updated_at")),
        "hidden": bool(doc.get("hidden")),
        "moderation": _moderation(doc),
        "seller": _person(doc.get("user_id", ""), people),
    }


async def _listing_rows(docs: list[dict]) -> list[dict]:
    if not docs:
        return []
    people, counts = await asyncio.gather(
        _people([d.get("user_id", "") for d in docs]),
        _order_counts([str(d["_id"]) for d in docs]),
    )
    return [_listing_row(d, people, counts.get(str(d["_id"]), 0)) for d in docs]


@router.get(
    "/listings",
    summary="Every listing on the market, paged",
    dependencies=[Depends(require_permission("market.view"))],
)
async def list_listings(
    q: str = Query("", max_length=120),
    status_: str = Query("", alias="status", max_length=12, description="live | paused | hidden | (all)"),
    kind: str = Query("", max_length=12),
    seller: str = Query("", max_length=32),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=5, le=50),
):
    page, page_size = _paging(page, page_size)
    query = _listing_query(q, status_, kind, seller)
    total, docs = await asyncio.gather(
        _listings().count_documents(query),
        _listings().find(query).sort("updated_at", -1)
        .skip((page - 1) * page_size).limit(page_size).to_list(page_size),
    )
    return {
        "items": await _listing_rows(docs),
        "total": total, "page": page, "page_size": page_size, "pages": _pages(total, page_size),
    }


@router.get(
    "/listings/export",
    summary="The listings as a CSV, with the same filters as the list",
    dependencies=[Depends(require_permission("market.export"))],
)
async def export_listings(
    request: Request,
    q: str = Query("", max_length=120),
    status_: str = Query("", alias="status", max_length=12),
    kind: str = Query("", max_length=12),
    seller: str = Query("", max_length=32),
    me: dict = Depends(get_current_user),
):
    docs = await _listings().find(_listing_query(q, status_, kind, seller)).sort("updated_at", -1).to_list(5000)
    rows = [["Listing id", "Title", "Kind", "Category", "Place", "Price", "Stock", "Status",
             "Hidden", "Moderation", "Seller", "Seller member code", "Orders", "Views", "Listed on"]]
    for r in await _listing_rows(docs):
        rows.append([
            r["id"], r["title"], r["kind"], r["category"], r["place"], r["price_label"],
            "" if r["stock"] is None else r["stock"], r["status"], "yes" if r["hidden"] else "no",
            r["moderation"]["reason"], r["seller"]["name"], r["seller"]["member_id"],
            r["orders"], r["views"], r["created_at"][:10],
        ])
    # A read, but one that leaves the building. Recorded for that reason.
    await record(me, "market.listing.export", detail=f"Downloaded {len(rows) - 1} listings as CSV", request=request)
    return _csv(rows, "listings")


@router.get(
    "/listings/{listing_id}",
    summary="One listing, its seller and its orders",
    dependencies=[Depends(require_permission("market.view"))],
)
async def listing_detail(listing_id: str):
    doc = await _listings().find_one({"_id": to_object_id(listing_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That listing doesn't exist")
    rows = await _listing_rows([doc])
    orders = await _orders().find({"listing_id": listing_id}).sort("created_at", -1).to_list(50)
    people = await _people([o.get("buyer_id", "") for o in orders if o.get("buyer_id")])
    return {
        **rows[0],
        "recent_orders": [_order_row(o, people) for o in orders],
        "history": await _history(listing_id),
    }


async def _moderate_listing(
    listing_id: str, *, state: str, reason: str, me: dict, request: Request, verb: str,
) -> dict:
    oid = to_object_id(listing_id)
    doc = await _listings().find_one({"_id": oid})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That listing doesn't exist")
    hidden = state != MOD_VISIBLE
    if bool(doc.get("hidden")) == hidden and (doc.get("moderation") or {}).get("state", MOD_VISIBLE) == state:
        raise HTTPException(status.HTTP_409_CONFLICT, f"That listing is already {state}")
    now = _now()
    await _listings().update_one(
        {"_id": oid},
        {"$set": {
            "hidden": hidden,
            "moderation": {
                "state": state, "reason": reason,
                "by": _actor_name(me), "by_id": str(me.get("_id", "")), "at": now,
            },
            "updated_at": now,
        }},
    )
    title = doc.get("title", "")
    seller_id = doc.get("user_id", "")
    if seller_id:
        if hidden:
            await notify(
                get_database(), seller_id,
                title=f"Your listing “{title}” has been taken off the market",
                body=(f"A moderator {'removed' if state == MOD_REMOVED else 'hid'} it. Reason: {reason}"
                      if reason else "A moderator took it out of view."),
                ntype=MemberNotificationModel.TYPE_ACCOUNT, href=HREF_SHOP,
            )
        else:
            await notify(
                get_database(), seller_id,
                title=f"Your listing “{title}” is back on the market",
                body=reason or "A moderator restored it.",
                ntype=MemberNotificationModel.TYPE_ACCOUNT, href=HREF_SHOP,
            )
    await record(
        me, f"market.listing.{verb}", target=listing_id,
        detail=f"{verb.capitalize()} listing '{title}'" + (f" — {reason}" if reason else ""),
        request=request,
    )
    fresh = await _listings().find_one({"_id": oid})
    return (await _listing_rows([fresh]))[0]


@router.post(
    "/listings/{listing_id}/hide",
    summary="Take a listing out of every member's view (kept on record)",
    dependencies=[Depends(require_permission("market.edit"))],
)
async def hide_listing(listing_id: str, body: RequiredReasonIn, request: Request, me: dict = Depends(get_current_user)):
    return await _moderate_listing(listing_id, state=MOD_HIDDEN, reason=body.reason, me=me, request=request, verb="hide")


@router.post(
    "/listings/{listing_id}/restore",
    summary="Put a hidden or removed listing back",
    dependencies=[Depends(require_permission("market.edit"))],
)
async def restore_listing(listing_id: str, body: ReasonIn, request: Request, me: dict = Depends(get_current_user)):
    return await _moderate_listing(listing_id, state=MOD_VISIBLE, reason=body.reason, me=me, request=request, verb="restore")


@router.post(
    "/listings/{listing_id}/remove",
    summary="Remove a listing from the market — hidden with a stronger word, never deleted",
    dependencies=[Depends(require_permission("market.delete"))],
)
async def remove_listing(listing_id: str, body: RequiredReasonIn, request: Request, me: dict = Depends(get_current_user)):
    return await _moderate_listing(listing_id, state=MOD_REMOVED, reason=body.reason, me=me, request=request, verb="remove")


# ── orders ─────────────────────────────────────────────────────────────────

def _order_query(status_: str, q: str, seller: str, from_: str, to: str) -> dict:
    query: dict = {}
    if status_ and status_ != "All":
        if status_ == "open":
            query["state"] = {"$in": list(OPEN_ORDER_STATES)}
        elif status_ in ShopOrderModel.STATES:
            query["state"] = status_
    if seller:
        query["seller_id"] = seller
    if q and q.strip():
        query.update(mongosafe.any_of(q, ["title", "buyer_name", "note"]))
    query.update(_day_bounds(from_, to))
    return query


def _order_row(doc: dict, people: dict[str, dict]) -> dict:
    base = ShopOrderModel.to_response(doc)
    cancel = doc.get("staff_cancel") or {}
    return {
        **base,
        "seller_id": doc.get("seller_id", ""),
        "placed_at": _iso(doc.get("created_at")),
        "updated_at": _iso(doc.get("updated_at")),
        # A buyer with an account is named from her account; a seeded order
        # names whoever was written on it. Never a contact detail either way.
        "buyer": _person(doc.get("buyer_id", ""), people, fallback=doc.get("buyer_name", "")),
        "seller": _person(doc.get("seller_id", ""), people),
        "staff_cancel": {
            "reason": cancel.get("reason", ""), "by": cancel.get("by", ""), "at": _iso(cancel.get("at")),
        } if cancel else None,
    }


async def _order_rows(docs: list[dict]) -> list[dict]:
    if not docs:
        return []
    people = await _people(
        [d.get("buyer_id", "") for d in docs if d.get("buyer_id")]
        + [d.get("seller_id", "") for d in docs]
    )
    return [_order_row(d, people) for d in docs]


@router.get(
    "/orders",
    summary="Every order on the market, paged",
    dependencies=[Depends(require_permission("market.view"))],
)
async def list_orders(
    status_: str = Query("", alias="status", max_length=12, description="open | New | Making | Ready | Sent | Done | Cancelled"),
    q: str = Query("", max_length=120),
    seller: str = Query("", max_length=32),
    from_: str = Query("", alias="from", max_length=10),
    to: str = Query("", max_length=10),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=5, le=50),
):
    page, page_size = _paging(page, page_size)
    query = _order_query(status_, q, seller, from_, to)
    total, docs = await asyncio.gather(
        _orders().count_documents(query),
        _orders().find(query).sort("created_at", -1)
        .skip((page - 1) * page_size).limit(page_size).to_list(page_size),
    )
    return {
        "items": await _order_rows(docs),
        "total": total, "page": page, "page_size": page_size, "pages": _pages(total, page_size),
    }


@router.get(
    "/orders/export",
    summary="The orders as a CSV, with the same filters as the list",
    dependencies=[Depends(require_permission("market.export"))],
)
async def export_orders(
    request: Request,
    status_: str = Query("", alias="status", max_length=12),
    q: str = Query("", max_length=120),
    seller: str = Query("", max_length=32),
    from_: str = Query("", alias="from", max_length=10),
    to: str = Query("", max_length=10),
    me: dict = Depends(get_current_user),
):
    docs = await _orders().find(_order_query(status_, q, seller, from_, to)).sort("created_at", -1).to_list(5000)
    rows = [["Order id", "Placed on", "Item", "Quantity", "Total (₹)", "State", "Buyer", "Seller",
             "Seller member code", "Note", "Cancelled by staff"]]
    for r in await _order_rows(docs):
        rows.append([
            r["id"], r["placed_at"][:10], r["title"], r["quantity"], r["total_minor"] / 100,
            r["state"], r["buyer"]["name"], r["seller"]["name"], r["seller"]["member_id"],
            r["note"], (r["staff_cancel"] or {}).get("reason", ""),
        ])
    await record(me, "market.order.export", detail=f"Downloaded {len(rows) - 1} orders as CSV", request=request)
    return _csv(rows, "orders")


async def _history(target: str) -> list[dict]:
    """Every staff action recorded against this row, oldest first."""
    rows = await _audit().find({"target": target}).sort("created_at", 1).to_list(100)
    return [
        {"at": _iso(r.get("created_at")), "action": r.get("action", ""),
         "who": r.get("user_name", ""), "detail": r.get("detail", "")}
        for r in rows
    ]


@router.get(
    "/orders/{order_id}",
    summary="One order, with its timeline",
    dependencies=[Depends(require_permission("market.view"))],
)
async def order_detail(order_id: str):
    doc = await _orders().find_one({"_id": to_object_id(order_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That order doesn't exist")
    row = (await _order_rows([doc]))[0]
    listing = await _listings().find_one({"_id": ObjectId(doc["listing_id"])}, {"title": 1, "hidden": 1, "status": 1}) \
        if ObjectId.is_valid(doc.get("listing_id", "")) else None

    # The timeline is only what the row can prove: when it was placed, when
    # it last changed and to what, and every staff action against it. There
    # is no per-step log on orders, so intermediate steps are not invented.
    timeline = [{
        "at": row["placed_at"], "label": "Placed",
        "who": row["buyer"]["name"], "detail": f"{row['quantity']} × {row['title']}",
    }]
    if row["updated_at"] and row["updated_at"] != row["placed_at"] and row["state"] != "New":
        cancel = row["staff_cancel"]
        timeline.append({
            "at": row["updated_at"], "label": f"Now {row['state']}",
            "who": cancel["by"] if cancel else row["seller"]["name"],
            "detail": cancel["reason"] if cancel else "",
        })
    for h in await _history(order_id):
        timeline.append({"at": h["at"], "label": h["action"], "who": h["who"], "detail": h["detail"]})
    timeline.sort(key=lambda t: t["at"])
    return {
        **row,
        "listing": {
            "id": doc.get("listing_id", ""),
            "title": (listing or {}).get("title", "") or row["title"],
            "exists": listing is not None,
            "hidden": bool((listing or {}).get("hidden")),
            "status": (listing or {}).get("status", ""),
        },
        "timeline": timeline,
    }


@router.post(
    "/orders/{order_id}/cancel",
    summary="Cancel an order on the seller's behalf, with a reason both sides are told",
    dependencies=[Depends(require_permission("market.edit"))],
)
async def force_cancel_order(order_id: str, body: RequiredReasonIn, request: Request, me: dict = Depends(get_current_user)):
    oid = to_object_id(order_id)
    doc = await _orders().find_one({"_id": oid})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That order doesn't exist")
    state = doc.get("state", "")
    if state == ShopOrderModel.STATE_CANCELLED:
        raise HTTPException(status.HTTP_409_CONFLICT, "That order is already cancelled")
    if state == "Done":
        raise HTTPException(status.HTTP_409_CONFLICT, "That order is finished; there is nothing left to cancel")

    now = _now()
    await _orders().update_one(
        {"_id": oid},
        {"$set": {
            "state": ShopOrderModel.STATE_CANCELLED, "updated_at": now,
            "staff_cancel": {"reason": body.reason, "by": _actor_name(me), "by_id": str(me.get("_id", "")), "at": now},
        }},
    )
    # An order placed through the market took its quantity off the shelf when
    # it was placed (see market.py). Give it back — a seeded order never took
    # any, and has no buyer account, so it is left alone.
    if doc.get("buyer_id") and ObjectId.is_valid(doc.get("listing_id", "")):
        await _listings().update_one(
            {"_id": ObjectId(doc["listing_id"]), "stock": {"$ne": None}},
            {"$inc": {"stock": int(doc.get("quantity", 1))}},
        )

    title = doc.get("title", "")
    tell = f"Order for {doc.get('quantity', 1)} × {title} was cancelled by WomSakhi staff. Reason: {body.reason}"
    if doc.get("seller_id"):
        await notify(get_database(), doc["seller_id"], title="An order was cancelled", body=tell,
                     ntype=MemberNotificationModel.TYPE_MONEY, href=HREF_SHOP)
    if doc.get("buyer_id"):
        await notify(get_database(), doc["buyer_id"], title="Your order was cancelled", body=tell,
                     ntype=MemberNotificationModel.TYPE_MONEY, href=HREF_MARKET_ORDERS)
    await record(
        me, "market.order.cancel", target=order_id,
        detail=f"Cancelled order '{title}' ({state}) — {body.reason}", request=request,
    )
    fresh = await _orders().find_one({"_id": oid})
    return (await _order_rows([fresh]))[0]


# ── reviews ────────────────────────────────────────────────────────────────

def _review_query(q: str, state: str, stars: int, seller: str) -> dict:
    query: dict = {}
    if state == "hidden":
        query["hidden"] = True
    elif state == "visible":
        query["hidden"] = {"$ne": True}
    if stars:
        query["stars"] = stars
    if seller:
        query["seller_id"] = seller
    if q and q.strip():
        query.update(mongosafe.any_of(q, ["text", "buyer_name", "what", "reply"]))
    return query


def _review_row(doc: dict, people: dict[str, dict]) -> dict:
    return {
        **ReviewModel.to_response(doc),
        "created_at": _iso(doc.get("created_at")),
        "order_id": doc.get("order_id", ""),
        "hidden": bool(doc.get("hidden")),
        "moderation": _moderation(doc),
        "seller": _person(doc.get("seller_id", ""), people),
    }


async def _review_rows(docs: list[dict]) -> list[dict]:
    if not docs:
        return []
    people = await _people([d.get("seller_id", "") for d in docs])
    return [_review_row(d, people) for d in docs]


@router.get(
    "/reviews",
    summary="Every review on the market, paged",
    dependencies=[Depends(require_permission("market.view"))],
)
async def list_reviews(
    q: str = Query("", max_length=120),
    state: str = Query("", max_length=10, description="visible | hidden | (all)"),
    stars: int = Query(0, ge=0, le=5),
    seller: str = Query("", max_length=32),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=5, le=50),
):
    page, page_size = _paging(page, page_size)
    query = _review_query(q, state, stars, seller)
    total, docs, hidden = await asyncio.gather(
        _reviews().count_documents(query),
        _reviews().find(query).sort("created_at", -1)
        .skip((page - 1) * page_size).limit(page_size).to_list(page_size),
        _reviews().count_documents({"hidden": True}),
    )
    return {
        "items": await _review_rows(docs),
        "total": total, "page": page, "page_size": page_size, "pages": _pages(total, page_size),
        "hidden_total": hidden,
    }


async def _moderate_review(review_id: str, *, hidden: bool, reason: str, me: dict, request: Request) -> dict:
    oid = to_object_id(review_id)
    doc = await _reviews().find_one({"_id": oid})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That review doesn't exist")
    if bool(doc.get("hidden")) == hidden:
        raise HTTPException(status.HTTP_409_CONFLICT, "That review is already " + ("hidden" if hidden else "visible"))
    now = _now()
    await _reviews().update_one(
        {"_id": oid},
        {"$set": {
            "hidden": hidden,
            "moderation": {"state": MOD_HIDDEN if hidden else MOD_VISIBLE, "reason": reason,
                           "by": _actor_name(me), "by_id": str(me.get("_id", "")), "at": now},
        }},
    )
    verb = "hide" if hidden else "restore"
    await record(
        me, f"market.review.{verb}", target=review_id,
        detail=f"{verb.capitalize()}d a {int(doc.get('stars', 0))}-star review by {doc.get('buyer_name', '')}"
               + (f" — {reason}" if reason else ""),
        request=request,
    )
    fresh = await _reviews().find_one({"_id": oid})
    return (await _review_rows([fresh]))[0]


@router.post(
    "/reviews/{review_id}/hide",
    summary="Hide a review from the seller's page (kept on record)",
    dependencies=[Depends(require_permission("market.edit"))],
)
async def hide_review(review_id: str, body: RequiredReasonIn, request: Request, me: dict = Depends(get_current_user)):
    return await _moderate_review(review_id, hidden=True, reason=body.reason, me=me, request=request)


@router.post(
    "/reviews/{review_id}/restore",
    summary="Put a hidden review back",
    dependencies=[Depends(require_permission("market.edit"))],
)
async def restore_review(review_id: str, body: ReasonIn, request: Request, me: dict = Depends(get_current_user)):
    return await _moderate_review(review_id, hidden=False, reason=body.reason, me=me, request=request)


# ── group buys ─────────────────────────────────────────────────────────────

def _buy_row(doc: dict, joiner_count: int) -> dict:
    base = GroupBuyModel.to_response(doc)
    cancelled = doc.get("cancelled") or {}
    return {
        **base,
        "closes_at": _iso(doc.get("closes_at")),
        "created_at": _iso(doc.get("created_at")),
        "updated_at": _iso(doc.get("updated_at")),
        # `joined` is the counter the member app races on; `joiner_count` is
        # the rows that actually exist. Both are shown so a drift is visible.
        "joiner_count": joiner_count,
        "ordered_at": _iso(doc.get("ordered_at")),
        "ordered_by": doc.get("ordered_by", "") or "",
        "order_reference": doc.get("order_reference", "") or "",
        "order_note": doc.get("order_note", "") or "",
        "delivered_at": _iso(doc.get("delivered_at")),
        "delivered_by": doc.get("delivered_by", "") or "",
        "closed_at": _iso(doc.get("closed_at")),
        "closed_by": doc.get("closed_by", "") or "",
        "close_note": doc.get("close_note", "") or "",
        "cancelled": {
            "reason": cancelled.get("reason", ""), "by": cancelled.get("by", ""), "at": _iso(cancelled.get("at")),
        } if cancelled else None,
        "stage": (
            "cancelled" if cancelled
            else "delivered" if doc.get("delivered_at")
            else doc.get("status", GroupBuyModel.STATUS_OPEN)
        ),
    }


async def _joiner_counts(buy_ids: list[str]) -> dict[str, int]:
    if not buy_ids:
        return {}
    rows = await _joiners().aggregate([
        {"$match": {"buy_id": {"$in": buy_ids}}},
        {"$group": {"_id": "$buy_id", "n": {"$sum": 1}}},
    ]).to_list(len(buy_ids))
    return {str(r["_id"]): int(r["n"]) for r in rows}


async def _buy_rows(docs: list[dict]) -> list[dict]:
    counts = await _joiner_counts([str(d["_id"]) for d in docs])
    return [_buy_row(d, counts.get(str(d["_id"]), 0)) for d in docs]


async def _buy_or_404(buy_id: str) -> dict:
    doc = await _buys().find_one({"_id": to_object_id(buy_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That group buy doesn't exist")
    return doc


async def _tell_joiners(buy_id: str, *, title: str, body: str, ntype: str = MemberNotificationModel.TYPE_MONEY) -> int:
    """One inbox row per joiner — the inbox the member app reads."""
    joiners = await _joiners().find({"buy_id": buy_id}, {"user_id": 1}).to_list(10_000)
    told = 0
    for j in joiners:
        if j.get("user_id"):
            await notify(get_database(), j["user_id"], title=title, body=body, ntype=ntype, href=HREF_GROUP_BUY)
            told += 1
    return told


@router.get(
    "/group-buys",
    summary="Every group buy, paged",
    dependencies=[Depends(require_permission("market.view"))],
)
async def list_group_buys(
    status_: str = Query("", alias="status", max_length=10, description="open | met | ordered | closed | (all)"),
    q: str = Query("", max_length=120),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=5, le=50),
):
    page, page_size = _paging(page, page_size)
    query: dict = {}
    if status_ in (GroupBuyModel.STATUS_OPEN, GroupBuyModel.STATUS_MET,
                   GroupBuyModel.STATUS_ORDERED, GroupBuyModel.STATUS_CLOSED):
        query["status"] = status_
    if q and q.strip():
        query.update(mongosafe.any_of(q, ["item", "supplier", "note"]))
    total, docs = await asyncio.gather(
        _buys().count_documents(query),
        _buys().find(query).sort("created_at", -1)
        .skip((page - 1) * page_size).limit(page_size).to_list(page_size),
    )
    return {
        "items": await _buy_rows(docs),
        "total": total, "page": page, "page_size": page_size, "pages": _pages(total, page_size),
    }


@router.get(
    "/group-buys/export",
    summary="Every group buy as a CSV",
    dependencies=[Depends(require_permission("market.export"))],
)
async def export_group_buys(request: Request, me: dict = Depends(get_current_user)):
    docs = await _buys().find({}).sort("created_at", -1).to_list(5000)
    rows = [["Buy id", "Item", "Unit", "Supplier", "Alone (₹)", "Together (₹)", "Needed", "Joined",
             "Joiner rows", "Status", "Stage", "Closes", "Ordered on", "Order reference", "Delivered on", "Cancel reason"]]
    for r in await _buy_rows(docs):
        rows.append([
            r["id"], r["item"], r["unit"], r["supplier"], r["alone_minor"] / 100, r["together_minor"] / 100,
            r["needed"], r["joined"], r["joiner_count"], r["status"], r["stage"], r["closes_at"][:10],
            r["ordered_at"][:10], r["order_reference"], r["delivered_at"][:10],
            (r["cancelled"] or {}).get("reason", ""),
        ])
    await record(me, "market.groupbuy.export", detail=f"Downloaded {len(rows) - 1} group buys as CSV", request=request)
    return _csv(rows, "group-buys")


@router.post(
    "/group-buys",
    status_code=status.HTTP_201_CREATED,
    summary="Open a new group buy",
    dependencies=[Depends(require_permission("market.create"))],
)
async def create_group_buy(body: GroupBuyUpsert, request: Request, me: dict = Depends(get_current_user)):
    doc = GroupBuyModel.create_document(
        item=body.item, unit=body.unit, alone_minor=body.alone_minor, together_minor=body.together_minor,
        needed=body.needed, closes_at=body.closes_at, supplier=body.supplier, note=body.note,
    )
    doc["created_by"] = _actor_name(me)
    doc["created_by_id"] = str(me.get("_id", ""))
    result = await _buys().insert_one(doc)
    doc["_id"] = result.inserted_id
    cache.forget_prefix("groupbuy:")
    await record(
        me, "market.groupbuy.create", target=str(result.inserted_id),
        detail=f"Opened group buy '{body.item}' — {body.needed} needed, closes {body.closes_at.date().isoformat()}",
        request=request,
    )
    return _buy_row(doc, 0)


@router.put(
    "/group-buys/{buy_id}",
    summary="Change a group buy that has not been ordered yet",
    dependencies=[Depends(require_permission("market.edit"))],
)
async def update_group_buy(buy_id: str, body: GroupBuyUpsert, request: Request, me: dict = Depends(get_current_user)):
    doc = await _buy_or_404(buy_id)
    if doc.get("status") not in (GroupBuyModel.STATUS_OPEN, GroupBuyModel.STATUS_MET):
        raise HTTPException(status.HTTP_409_CONFLICT, "That buy has been ordered or closed; it can no longer be edited")
    now = _now()
    joined = int(doc.get("joined", 0))
    # Changing the number can tip a buy over its threshold or back under it;
    # the status follows, the way the join/leave endpoints keep it.
    new_status = GroupBuyModel.STATUS_MET if joined >= body.needed else GroupBuyModel.STATUS_OPEN
    await _buys().update_one(
        {"_id": doc["_id"]},
        {"$set": {
            "item": body.item, "unit": body.unit, "alone_minor": body.alone_minor,
            "together_minor": body.together_minor, "needed": body.needed, "closes_at": body.closes_at,
            "supplier": body.supplier, "note": body.note, "status": new_status, "updated_at": now,
        }},
    )
    cache.forget_prefix("groupbuy:")
    await record(me, "market.groupbuy.edit", target=buy_id, detail=f"Edited group buy '{body.item}'", request=request)
    return (await _buy_rows([await _buy_or_404(buy_id)]))[0]


@router.post(
    "/group-buys/{buy_id}/place-order",
    summary="Place the supplier order: met → ordered, every joiner is told",
    dependencies=[Depends(require_permission("market.approve"))],
)
async def place_group_order(buy_id: str, body: PlaceOrderIn, request: Request, me: dict = Depends(get_current_user)):
    doc = await _buy_or_404(buy_id)
    if doc.get("status") != GroupBuyModel.STATUS_MET:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Only a buy that has reached its number can be ordered"
            if doc.get("status") == GroupBuyModel.STATUS_OPEN else "That buy has already been ordered or closed",
        )
    now = _now()
    await _buys().update_one(
        {"_id": doc["_id"], "status": GroupBuyModel.STATUS_MET},
        {"$set": {
            "status": GroupBuyModel.STATUS_ORDERED, "ordered_at": now, "ordered_by": _actor_name(me),
            "ordered_by_id": str(me.get("_id", "")), "order_reference": body.reference, "order_note": body.note,
            "updated_at": now,
        }},
    )
    cache.forget_prefix("groupbuy:")
    item = doc.get("item", "")
    together = int(doc.get("together_minor", 0))
    told = await _tell_joiners(
        buy_id,
        title=f"Ordered: {item}",
        body=(f"Enough of you joined, so the order has been placed"
              + (f" with {doc['supplier']}" if doc.get("supplier") else "")
              + f". Your price is ₹{together // 100:,} {doc.get('unit', '')}".rstrip()
              + ". You will be told when it arrives and how to collect it."
              + (f" {body.note}" if body.note else "")),
    )
    await record(
        me, "market.groupbuy.order", target=buy_id,
        detail=f"Placed the order for '{item}' ({int(doc.get('joined', 0))} joined); told {told} joiners"
               + (f" — ref {body.reference}" if body.reference else ""),
        request=request,
    )
    return {**(await _buy_rows([await _buy_or_404(buy_id)]))[0], "told": told}


@router.post(
    "/group-buys/{buy_id}/close",
    summary="Close a buy that did not reach its number; joiners are told nothing is owed",
    dependencies=[Depends(require_permission("market.edit"))],
)
async def close_group_buy(buy_id: str, body: ReasonIn, request: Request, me: dict = Depends(get_current_user)):
    doc = await _buy_or_404(buy_id)
    if doc.get("status") not in (GroupBuyModel.STATUS_OPEN, GroupBuyModel.STATUS_MET):
        raise HTTPException(status.HTTP_409_CONFLICT, "That buy has already been ordered or closed")
    now = _now()
    await _buys().update_one(
        {"_id": doc["_id"]},
        {"$set": {"status": GroupBuyModel.STATUS_CLOSED, "closed_at": now, "closed_by": _actor_name(me),
                  "closed_by_id": str(me.get("_id", "")), "close_note": body.reason, "updated_at": now}},
    )
    cache.forget_prefix("groupbuy:")
    item = doc.get("item", "")
    told = await _tell_joiners(
        buy_id,
        title=f"Closed without an order: {item}",
        body=(f"Only {int(doc.get('joined', 0))} of the {int(doc.get('needed', 0))} needed joined, so it did not go ahead. "
              "You owe nothing." + (f" {body.reason}" if body.reason else "")),
    )
    await record(
        me, "market.groupbuy.close", target=buy_id,
        detail=f"Closed '{item}' without an order; told {told} joiners" + (f" — {body.reason}" if body.reason else ""),
        request=request,
    )
    return {**(await _buy_rows([await _buy_or_404(buy_id)]))[0], "told": told}


@router.post(
    "/group-buys/{buy_id}/cancel",
    summary="Call a buy off, with a reason every joiner is told",
    dependencies=[Depends(require_permission("market.delete"))],
)
async def cancel_group_buy(buy_id: str, body: RequiredReasonIn, request: Request, me: dict = Depends(get_current_user)):
    doc = await _buy_or_404(buy_id)
    if doc.get("status") == GroupBuyModel.STATUS_CLOSED:
        raise HTTPException(status.HTTP_409_CONFLICT, "That buy is already closed")
    if doc.get("delivered_at"):
        raise HTTPException(status.HTTP_409_CONFLICT, "That buy has been delivered; it cannot be cancelled")
    now = _now()
    await _buys().update_one(
        {"_id": doc["_id"]},
        {"$set": {"status": GroupBuyModel.STATUS_CLOSED, "updated_at": now,
                  "cancelled": {"reason": body.reason, "by": _actor_name(me), "by_id": str(me.get("_id", "")), "at": now}}},
    )
    cache.forget_prefix("groupbuy:")
    item = doc.get("item", "")
    told = await _tell_joiners(
        buy_id,
        title=f"Called off: {item}",
        body=f"WomSakhi staff cancelled this group buy. Reason: {body.reason}. You owe nothing.",
    )
    await record(
        me, "market.groupbuy.cancel", target=buy_id,
        detail=f"Cancelled '{item}' ({doc.get('status')}); told {told} joiners — {body.reason}", request=request,
    )
    return {**(await _buy_rows([await _buy_or_404(buy_id)]))[0], "told": told}


@router.post(
    "/group-buys/{buy_id}/delivered",
    summary="The goods arrived: every joiner is told to collect",
    dependencies=[Depends(require_permission("market.edit"))],
)
async def deliver_group_buy(buy_id: str, body: ReasonIn, request: Request, me: dict = Depends(get_current_user)):
    doc = await _buy_or_404(buy_id)
    if doc.get("status") != GroupBuyModel.STATUS_ORDERED:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only an ordered buy can be marked delivered")
    if doc.get("delivered_at"):
        raise HTTPException(status.HTTP_409_CONFLICT, "That buy is already marked delivered")
    now = _now()
    await _buys().update_one(
        {"_id": doc["_id"]},
        {"$set": {"delivered_at": now, "delivered_by": _actor_name(me), "delivered_by_id": str(me.get("_id", "")),
                  "delivery_note": body.reason, "updated_at": now}},
    )
    cache.forget_prefix("groupbuy:")
    item = doc.get("item", "")
    told = await _tell_joiners(
        buy_id,
        title=f"Arrived: {item}",
        body="Your group buy has arrived." + (f" {body.reason}" if body.reason else " Staff will tell you where to collect it."),
    )
    await record(
        me, "market.groupbuy.deliver", target=buy_id,
        detail=f"Marked '{item}' delivered; told {told} joiners" + (f" — {body.reason}" if body.reason else ""),
        request=request,
    )
    return {**(await _buy_rows([await _buy_or_404(buy_id)]))[0], "told": told}


async def _joiner_rows(buy_id: str) -> list[dict]:
    joiners = await _joiners().find({"buy_id": buy_id}).sort("created_at", 1).to_list(10_000)
    people = await _people([j.get("user_id", "") for j in joiners])
    return [
        {
            "id": str(j["_id"]),
            **_person(j.get("user_id", ""), people),
            "quantity": int(j.get("quantity", 1)),
            "joined_at": _iso(j.get("created_at")),
        }
        for j in joiners
    ]


@router.get(
    "/group-buys/{buy_id}/joiners",
    summary="Who has joined this buy",
    dependencies=[Depends(require_permission("market.view"))],
)
async def group_buy_joiners(buy_id: str):
    await _buy_or_404(buy_id)
    return await _joiner_rows(buy_id)


@router.get(
    "/group-buys/{buy_id}/joiners/export",
    summary="The joiner list as a CSV",
    dependencies=[Depends(require_permission("market.export"))],
)
async def export_joiners(buy_id: str, request: Request, me: dict = Depends(get_current_user)):
    doc = await _buy_or_404(buy_id)
    rows = [["Name", "Member code", "Quantity", "Joined on"]]
    for j in await _joiner_rows(buy_id):
        rows.append([j["name"], j["member_id"], j["quantity"], j["joined_at"][:10]])
    await record(
        me, "market.groupbuy.export", target=buy_id,
        detail=f"Downloaded the joiner list of '{doc.get('item', '')}' as CSV ({len(rows) - 1} rows)", request=request,
    )
    slug = "".join(c if c.isalnum() else "-" for c in doc.get("item", "buy").lower()).strip("-")[:40] or "buy"
    return _csv(rows, f"{slug}-joiners")


@router.get(
    "/group-buys/{buy_id}",
    summary="One group buy",
    dependencies=[Depends(require_permission("market.view"))],
)
async def group_buy_detail(buy_id: str):
    doc = await _buy_or_404(buy_id)
    row = (await _buy_rows([doc]))[0]
    return {**row, "joiners": await _joiner_rows(buy_id), "history": await _history(buy_id)}


# ── sellers ────────────────────────────────────────────────────────────────

async def _seller_rows(seller_ids: list[str]) -> list[dict]:
    """
    Everything the sellers screen shows, for a set of accounts, in five
    round trips rather than five per seller.
    """
    if not seller_ids:
        return []
    people, listing_stats, order_stats, review_stats, kitchens = await asyncio.gather(
        _people(seller_ids),
        _listings().aggregate([
            {"$match": {"user_id": {"$in": seller_ids}}},
            {"$group": {
                "_id": "$user_id",
                "total": {"$sum": 1},
                "hidden": {"$sum": {"$cond": [{"$eq": ["$hidden", True]}, 1, 0]}},
                "live": {"$sum": {"$cond": [{"$and": [{"$eq": ["$status", ListingModel.STATUS_LIVE]},
                                                      {"$ne": ["$hidden", True]}]}, 1, 0]}},
                "paused": {"$sum": {"$cond": [{"$and": [{"$eq": ["$status", ListingModel.STATUS_PAUSED]},
                                                        {"$ne": ["$hidden", True]}]}, 1, 0]}},
                "first": {"$min": "$created_at"},
            }},
        ]).to_list(len(seller_ids)),
        _orders().aggregate([
            {"$match": {"seller_id": {"$in": seller_ids}}},
            {"$group": {
                "_id": "$seller_id",
                "total": {"$sum": 1},
                "open": {"$sum": {"$cond": [{"$in": ["$state", list(OPEN_ORDER_STATES)]}, 1, 0]}},
                "done": {"$sum": {"$cond": [{"$in": ["$state", list(PAID_ORDER_STATES)]}, 1, 0]}},
                "cancelled": {"$sum": {"$cond": [{"$eq": ["$state", ShopOrderModel.STATE_CANCELLED]}, 1, 0]}},
                "earned_minor": {"$sum": {"$cond": [{"$in": ["$state", list(PAID_ORDER_STATES)]}, "$total_minor", 0]}},
            }},
        ]).to_list(len(seller_ids)),
        _reviews().aggregate([
            {"$match": {"seller_id": {"$in": seller_ids}, "hidden": {"$ne": True}}},
            {"$group": {"_id": "$seller_id", "count": {"$sum": 1}, "stars": {"$avg": "$stars"}}},
        ]).to_list(len(seller_ids)),
        _kitchen().find({"user_id": {"$in": seller_ids}}).to_list(len(seller_ids)),
    )
    listings = {str(r["_id"]): r for r in listing_stats}
    orders = {str(r["_id"]): r for r in order_stats}
    reviews = {str(r["_id"]): r for r in review_stats}
    kitchen = {r.get("user_id", ""): r for r in kitchens}

    out = []
    for sid in seller_ids:
        who = people.get(sid) or {}
        ls = listings.get(sid) or {}
        os_ = orders.get(sid) or {}
        rv = reviews.get(sid) or {}
        kt = kitchen.get(sid) or {}
        susp = who.get("seller_suspension") or {}
        out.append({
            **_person(sid, people),
            "account_exists": sid in people,
            "since": _iso(who.get("created_at")) or _iso(ls.get("first")),
            "listings": {
                "total": int(ls.get("total", 0)), "live": int(ls.get("live", 0)),
                "paused": int(ls.get("paused", 0)), "hidden": int(ls.get("hidden", 0)),
            },
            "orders": {
                "total": int(os_.get("total", 0)), "open": int(os_.get("open", 0)),
                "done": int(os_.get("done", 0)), "cancelled": int(os_.get("cancelled", 0)),
                "earned_minor": int(os_.get("earned_minor", 0)),
            },
            "reviews": {
                "count": int(rv.get("count", 0)),
                "rating": round(float(rv.get("stars") or 0), 1) if rv.get("count") else 0.0,
            },
            "suspension": {
                "reason": susp.get("reason", ""), "by": susp.get("by", ""), "at": _iso(susp.get("at")),
            } if who.get("seller_suspended") else None,
            "kitchen": {
                "licence_no": kt.get("licence_no", "") or "",
                "steps_done": len(kt.get("done", []) or []),
                "verified": bool(kt.get("licence_verified")),
                "verified_by": kt.get("licence_verified_by", "") or "",
                "verified_at": _iso(kt.get("licence_verified_at")),
            },
        })
    return out


@router.get(
    "/sellers",
    summary="Every member who has listed something, paged",
    dependencies=[Depends(require_permission("market.view"))],
)
async def list_sellers(
    q: str = Query("", max_length=120),
    state: str = Query("", max_length=12, description="suspended | active | licensed | (all)"),
    sort: str = Query("listings", max_length=12, description="listings | orders | name | newest"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=5, le=50),
):
    """
    A seller is anyone with a listing. There is no sellers collection, so the
    set is the distinct `user_id`s on listings — a few dozen today — and the
    filter, sort and page happen here rather than in a query the collection
    could not answer.
    """
    page, page_size = _paging(page, page_size)
    seller_ids = [s for s in await _listings().distinct("user_id") if s]
    rows = await _seller_rows(seller_ids)

    term = (q or "").strip().lower()
    if term:
        rows = [r for r in rows if term in r["name"].lower() or term in (r["member_id"] or "").lower()]
    if state == "suspended":
        rows = [r for r in rows if r["suspended"]]
    elif state == "active":
        rows = [r for r in rows if not r["suspended"]]
    elif state == "licensed":
        rows = [r for r in rows if r["kitchen"]["licence_no"]]

    keys = {
        "orders": lambda r: (-r["orders"]["total"], r["name"].lower()),
        "name": lambda r: r["name"].lower(),
        "newest": lambda r: r["since"],
    }
    rows.sort(key=keys.get(sort, lambda r: (-r["listings"]["total"], r["name"].lower())), reverse=(sort == "newest"))

    total = len(rows)
    start = (page - 1) * page_size
    return {
        "items": rows[start:start + page_size],
        "total": total, "page": page, "page_size": page_size, "pages": _pages(total, page_size),
        "suspended_total": sum(1 for r in rows if r["suspended"]),
        "licensed_total": sum(1 for r in rows if r["kitchen"]["licence_no"]),
    }


@router.get(
    "/sellers/export",
    summary="The sellers as a CSV",
    dependencies=[Depends(require_permission("market.export"))],
)
async def export_sellers(request: Request, me: dict = Depends(get_current_user)):
    seller_ids = [s for s in await _listings().distinct("user_id") if s]
    rows = [["Seller id", "Name", "Member code", "Listings", "Live", "Hidden", "Orders", "Open", "Done",
             "Earned (₹)", "Reviews", "Rating", "Suspended", "Licence no", "Licence verified"]]
    for r in await _seller_rows(seller_ids):
        rows.append([
            r["id"], r["name"], r["member_id"], r["listings"]["total"], r["listings"]["live"], r["listings"]["hidden"],
            r["orders"]["total"], r["orders"]["open"], r["orders"]["done"], r["orders"]["earned_minor"] / 100,
            r["reviews"]["count"], r["reviews"]["rating"], "yes" if r["suspended"] else "no",
            r["kitchen"]["licence_no"], "yes" if r["kitchen"]["verified"] else "no",
        ])
    await record(me, "market.seller.export", detail=f"Downloaded {len(rows) - 1} sellers as CSV", request=request)
    return _csv(rows, "sellers")


@router.get(
    "/sellers/{user_id}",
    summary="One seller: her listings, recent orders and reviews",
    dependencies=[Depends(require_permission("market.view"))],
)
async def seller_detail(user_id: str):
    to_object_id(user_id)  # 404 on a malformed id before any query runs
    rows = await _seller_rows([user_id])
    row = rows[0] if rows else None
    if not row or (not row["account_exists"] and row["listings"]["total"] == 0):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That seller doesn't exist")
    listings, orders, reviews = await asyncio.gather(
        _listings().find({"user_id": user_id}).sort("updated_at", -1).to_list(300),
        _orders().find({"seller_id": user_id}).sort("created_at", -1).to_list(20),
        _reviews().find({"seller_id": user_id}).sort("created_at", -1).to_list(20),
    )
    return {
        **row,
        "listing_rows": await _listing_rows(listings),
        "recent_orders": await _order_rows(orders),
        "recent_reviews": await _review_rows(reviews),
        "history": await _history(user_id),
    }


async def _seller_or_404(user_id: str) -> dict:
    who = await _users().find_one({"_id": to_object_id(user_id)}, {"full_name": 1, "seller_suspended": 1, "role": 1})
    if not who:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That account doesn't exist")
    return who


@router.post(
    "/sellers/{user_id}/suspend",
    summary="Stop her selling: listings leave the market, nothing new can be listed",
    dependencies=[Depends(require_permission("market.edit"))],
)
async def suspend_seller(user_id: str, body: RequiredReasonIn, request: Request, me: dict = Depends(get_current_user)):
    who = await _seller_or_404(user_id)
    if who.get("seller_suspended"):
        raise HTTPException(status.HTTP_409_CONFLICT, "She is already suspended from selling")
    now = _now()
    await _users().update_one(
        {"_id": who["_id"]},
        {"$set": {"seller_suspended": True,
                  "seller_suspension": {"reason": body.reason, "by": _actor_name(me), "by_id": str(me.get("_id", "")), "at": now}}},
    )
    await notify(
        get_database(), user_id,
        title="Your shop has been suspended",
        body=f"Your listings are off the market and you cannot list anything new for now. Reason: {body.reason}",
        ntype=MemberNotificationModel.TYPE_ACCOUNT, href=HREF_SHOP,
    )
    await record(
        me, "market.seller.suspend", target=user_id,
        detail=f"Suspended {who.get('full_name', '')} from selling — {body.reason}", request=request,
    )
    return (await _seller_rows([user_id]))[0]


@router.post(
    "/sellers/{user_id}/unsuspend",
    summary="Let her sell again",
    dependencies=[Depends(require_permission("market.edit"))],
)
async def unsuspend_seller(user_id: str, body: ReasonIn, request: Request, me: dict = Depends(get_current_user)):
    who = await _seller_or_404(user_id)
    if not who.get("seller_suspended"):
        raise HTTPException(status.HTTP_409_CONFLICT, "She is not suspended")
    now = _now()
    await _users().update_one(
        {"_id": who["_id"]},
        {"$set": {"seller_suspended": False,
                  "seller_suspension_lifted": {"note": body.reason, "by": _actor_name(me), "by_id": str(me.get("_id", "")), "at": now}},
         "$unset": {"seller_suspension": ""}},
    )
    await notify(
        get_database(), user_id,
        title="Your shop is open again",
        body=body.reason or "Your listings are back on the market.",
        ntype=MemberNotificationModel.TYPE_ACCOUNT, href=HREF_SHOP,
    )
    await record(
        me, "market.seller.unsuspend", target=user_id,
        detail=f"Lifted the selling suspension on {who.get('full_name', '')}" + (f" — {body.reason}" if body.reason else ""),
        request=request,
    )
    return (await _seller_rows([user_id]))[0]


@router.post(
    "/sellers/{user_id}/licence/verify",
    summary="Mark her FSSAI licence number as checked",
    dependencies=[Depends(require_permission("market.approve"))],
)
async def verify_licence(user_id: str, body: ReasonIn, request: Request, me: dict = Depends(get_current_user)):
    who = await _seller_or_404(user_id)
    kt = await _kitchen().find_one({"user_id": user_id})
    if not kt or not (kt.get("licence_no") or "").strip():
        raise HTTPException(status.HTTP_409_CONFLICT, "She has not recorded a licence number yet")
    if kt.get("licence_verified"):
        raise HTTPException(status.HTTP_409_CONFLICT, "That licence is already marked verified")
    now = _now()
    await _kitchen().update_one(
        {"_id": kt["_id"]},
        {"$set": {"licence_verified": True, "licence_verified_by": _actor_name(me),
                  "licence_verified_by_id": str(me.get("_id", "")), "licence_verified_at": now,
                  "licence_note": body.reason, "updated_at": now}},
    )
    await notify(
        get_database(), user_id,
        title="Your food licence is verified",
        body=f"WomSakhi checked licence {kt['licence_no']} and marked it verified.",
        ntype=MemberNotificationModel.TYPE_ACCOUNT, href="/app/kitchen",
    )
    await record(
        me, "market.licence.verify", target=user_id,
        detail=f"Verified FSSAI licence {kt['licence_no']} of {who.get('full_name', '')}" + (f" — {body.reason}" if body.reason else ""),
        request=request,
    )
    return (await _seller_rows([user_id]))[0]


@router.post(
    "/sellers/{user_id}/licence/unverify",
    summary="Withdraw the verified mark on her licence",
    dependencies=[Depends(require_permission("market.approve"))],
)
async def unverify_licence(user_id: str, body: RequiredReasonIn, request: Request, me: dict = Depends(get_current_user)):
    who = await _seller_or_404(user_id)
    kt = await _kitchen().find_one({"user_id": user_id})
    if not kt or not kt.get("licence_verified"):
        raise HTTPException(status.HTTP_409_CONFLICT, "That licence is not marked verified")
    now = _now()
    await _kitchen().update_one(
        {"_id": kt["_id"]},
        {"$set": {"licence_verified": False, "licence_verified_by": "", "licence_verified_by_id": "",
                  "licence_verified_at": None, "licence_note": body.reason, "updated_at": now}},
    )
    await notify(
        get_database(), user_id,
        title="Your food licence needs another look",
        body=f"The verified mark on licence {kt.get('licence_no', '')} was withdrawn. Reason: {body.reason}",
        ntype=MemberNotificationModel.TYPE_ACCOUNT, href="/app/kitchen",
    )
    await record(
        me, "market.licence.unverify", target=user_id,
        detail=f"Withdrew the verified mark on licence {kt.get('licence_no', '')} of {who.get('full_name', '')} — {body.reason}",
        request=request,
    )
    return (await _seller_rows([user_id]))[0]
