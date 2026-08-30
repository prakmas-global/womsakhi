"""
Buying together: wholesale prices for women who cannot each order a sack.

The whole module turns on **the threshold**. A group buy is a promise that if
enough women join, everyone pays the lower price — and the promise is only worth
anything if the count is exact. So `joined` is incremented atomically and the
threshold is compared inside the same update, for the same reason an event seat
is: two women joining at the same moment on the last place is not an edge case,
it is what happens when a buy is announced.

**She pays nothing unless it goes ahead.** That is stated on the screen and it
is why joining creates a row and not a charge. The order is placed by staff when
the threshold is met, and only then is anyone asked for money.
"""

from datetime import datetime, timezone

from app.core.serializers import aware


class GroupBuyModel:
    collection_name = "group_buys"

    STATUS_OPEN = "open"
    STATUS_MET = "met"              # enough joined; staff are placing the order
    STATUS_ORDERED = "ordered"
    STATUS_CLOSED = "closed"        # closed without reaching the number

    @staticmethod
    def create_document(
        *,
        item: str,
        unit: str,
        alone_minor: int,
        together_minor: int,
        needed: int,
        closes_at: datetime,
        supplier: str = "",
        note: str = "",
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "item": item.strip(),
            "unit": unit.strip(),
            # Both prices stored, so the saving is computed once and cannot be
            # rendered two different ways on two screens.
            "alone_minor": int(alone_minor),
            "together_minor": int(together_minor),
            "needed": int(needed),
            "joined": 0,
            "supplier": supplier.strip(),
            "note": note.strip(),
            "status": GroupBuyModel.STATUS_OPEN,
            "closes_at": closes_at,
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict, *, joined_by_me: bool = False) -> dict:
        alone = int(doc.get("alone_minor", 0))
        together = int(doc.get("together_minor", 0))
        needed = int(doc.get("needed", 0))
        joined = int(doc.get("joined", 0))
        closes = aware(doc.get("closes_at"))
        return {
            "id": str(doc["_id"]),
            "item": doc.get("item", ""),
            "unit": doc.get("unit", ""),
            "alone_minor": alone,
            "together_minor": together,
            # The saving as a number, not an adjective. "Cheaper" persuades
            # nobody who is counting; "₹340 less per sack" does.
            "saving_minor": max(0, alone - together),
            "saving_label": (
                f"₹{(alone - together) // 100:,} less {doc.get('unit', '')}".strip()
                if alone > together else ""
            ),
            "needed": needed,
            "joined": joined,
            "still_needed": max(0, needed - joined),
            "full": joined >= needed if needed else False,
            "supplier": doc.get("supplier", ""),
            "note": doc.get("note", ""),
            "status": doc.get("status", GroupBuyModel.STATUS_OPEN),
            "closes": closes.strftime("%d %b") if closes else "",
            "closed": bool(closes and closes < datetime.now(timezone.utc)),
            "joined_by_me": joined_by_me,
        }


class GroupBuyJoinerModel:
    collection_name = "group_buy_joiners"

    @staticmethod
    def create_document(*, user_id: str, member_id: str, buy_id: str, quantity: int = 1) -> dict:
        return {
            "user_id": user_id,
            "member_id": member_id,
            "buy_id": buy_id,
            "quantity": max(1, int(quantity)),
            "created_at": datetime.now(timezone.utc),
        }
