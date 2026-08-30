"""
What she sells, and what she has sold.

**Products and services are one collection with a `kind`.** To her they are one
thing — what she earns from — and the screen shows them together under "What
you sell". They are separated only where the questions genuinely differ: a
service has a rate and a travel distance, a product has stock. Two collections
would mean two queries for one list and a merge in Python on every load.

Most women on this platform earn from their *time*, not from stock — tailoring
to measure, mehendi, tuition, cooking, childcare — so a shop that could only
list things in boxes had no room for how most of its members actually work.
"""

from datetime import datetime, timezone

from app.core.serializers import aware


class ListingModel:
    """One thing she sells: a product or a service."""

    collection_name = "shop_listings"

    KIND_PRODUCT = "product"
    KIND_SERVICE = "service"

    RATE_HOUR = "per hour"
    RATE_VISIT = "per visit"
    RATE_PIECE = "per piece"
    RATE_MONTH = "per month"
    RATES = (RATE_HOUR, RATE_VISIT, RATE_PIECE, RATE_MONTH)

    STATUS_LIVE = "live"
    STATUS_PAUSED = "paused"

    @staticmethod
    def create_document(
        *,
        user_id: str,
        member_id: str,
        kind: str,
        title: str,
        desc: str = "",
        price_minor: int = 0,
        rate: str = "",
        stock: int | None = None,
        category: str = "",
        place: str = "",
        travels_km: int = 0,
        photo: str = "",
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,
            "member_id": member_id,
            "kind": kind if kind in (ListingModel.KIND_PRODUCT, ListingModel.KIND_SERVICE)
                    else ListingModel.KIND_PRODUCT,
            "title": title.strip(),
            "desc": desc.strip(),
            "price_minor": int(price_minor),
            "rate": rate if rate in ListingModel.RATES else "",
            # None means "not something you count" — a service has no stock, and
            # storing 0 would render as "out of stock" on a tailor's listing.
            "stock": None if stock is None else max(0, int(stock)),
            "category": category.strip(),
            "place": place.strip(),
            "travels_km": int(travels_km),
            "photo": photo,
            "status": ListingModel.STATUS_LIVE,
            "views": 0,
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        price = int(doc.get("price_minor", 0))
        rate = doc.get("rate", "")
        stock = doc.get("stock")
        return {
            "id": str(doc["_id"]),
            "kind": doc.get("kind", ListingModel.KIND_PRODUCT),
            "title": doc.get("title", ""),
            "desc": doc.get("desc", ""),
            "price_minor": price,
            # Formatted once so the rate never gets lost between screens: a
            # tailor charging "₹400" and "₹400 per piece" are different offers.
            "price_label": f"₹{price // 100:,}" + (f" {rate}" if rate else ""),
            "rate": rate,
            "stock": stock,
            "low_stock": stock is not None and 0 < stock <= 3,
            "out_of_stock": stock == 0,
            "category": doc.get("category", ""),
            "place": doc.get("place", ""),
            "travels_km": int(doc.get("travels_km", 0)),
            "photo": doc.get("photo", ""),
            "status": doc.get("status", ListingModel.STATUS_LIVE),
            "views": int(doc.get("views", 0)),
        }


class ShopOrderModel:
    """An order a buyer placed with her."""

    collection_name = "shop_orders"

    STATES = ("New", "Making", "Ready", "Sent", "Done", "Cancelled")
    #: What comes next, so the screen's one button always knows what it does.
    NEXT = {"New": "Making", "Making": "Ready", "Ready": "Sent", "Sent": "Done"}

    STATE_CANCELLED = "Cancelled"
    #: Where a seller may still call it off. Once it has been sent it is with
    #: the buyer, and cancelling is a refund conversation rather than a state
    #: change she can make alone.
    CANCELLABLE = ("New", "Making", "Ready")

    @staticmethod
    def create_document(
        *, seller_id: str, buyer_name: str, listing_id: str, title: str,
        quantity: int, total_minor: int, note: str = "", state: str = "New",
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "seller_id": seller_id,
            "buyer_name": buyer_name.strip(),
            "listing_id": listing_id,
            "title": title.strip(),
            "quantity": max(1, int(quantity)),
            "total_minor": int(total_minor),
            "note": note.strip(),
            "state": state if state in ShopOrderModel.STATES else "New",
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        when = aware(doc.get("created_at"))
        state = doc.get("state", "New")
        total = int(doc.get("total_minor", 0))
        return {
            "id": str(doc["_id"]),
            "buyer_name": doc.get("buyer_name", ""),
            "listing_id": doc.get("listing_id", ""),
            "title": doc.get("title", ""),
            "quantity": int(doc.get("quantity", 1)),
            "total_minor": total,
            "total_label": f"₹{total // 100:,}",
            "note": doc.get("note", ""),
            "state": state,
            "next_state": ShopOrderModel.NEXT.get(state),
            # The question she opens this screen with is "is anyone waiting on
            # me?", so the answer is a field rather than something the screen
            # has to work out from a list of states.
            "needs_her": state in ("New", "Making", "Ready"),
            "placed_on": when.strftime("%d %b") if when else "",
        }


class ReviewModel:
    collection_name = "shop_reviews"

    @staticmethod
    def create_document(
        *, seller_id: str, buyer_name: str, order_id: str,
        stars: int, text: str = "", what: str = "",
    ) -> dict:
        return {
            "seller_id": seller_id,
            "buyer_name": buyer_name.strip(),
            "order_id": order_id,
            "stars": max(1, min(5, int(stars))),
            "text": text.strip(),
            "what": what.strip(),
            "reply": "",
            "created_at": datetime.now(timezone.utc),
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        when = aware(doc.get("created_at"))
        return {
            "id": str(doc["_id"]),
            "who": doc.get("buyer_name", ""),
            "stars": int(doc.get("stars", 5)),
            "text": doc.get("text", ""),
            "what": doc.get("what", ""),
            "reply": doc.get("reply", ""),
            "when": when.strftime("%d %b %Y") if when else "",
        }
