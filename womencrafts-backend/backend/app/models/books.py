"""
Her books: what she sold, who owes her, and what she has promised.

── Why this is a first-class collection and not a view over orders ──────────
Most of what she sells does not happen on this platform. IFC found 61% of women
selling on Jumia also sell through WhatsApp, and a nationwide evaluation of
rural e-commerce found no income gains for producers at all. So the ledger has
to hold the sale that happened over WhatsApp, in person, or inside her circle —
none of which has an order record here, and none of which ever will.

Own the ledger, not the storefront.

── Why the proof matters more than the dashboard ───────────────────────────
Once the ledger exists, proof of income is nearly free, and proof of income is
the thing she cannot get anywhere else. No payslip, no filings, money arriving
as cash and UPI from thirty different people. She cannot rent a room, enrol a
child or stand as a guarantor without it. `monthly_rows` below is that proof,
counted from her own entries — never estimated, never smoothed.
"""

from datetime import datetime, timezone

#: How she was actually paid, and where the sale happened. Not a payment
#: method: "whatsapp" is where the conversation was, and that is the fact she
#: remembers when she is entering it a week later.
VIA = ("whatsapp", "shop", "person", "circle")

#: paid  — the money arrived
#: owed  — she delivered and is waiting
#: promised — she has committed to do it; no money either way yet
STATES = ("paid", "owed", "promised")


class BookEntryModel:
    collection_name = "book_entries"

    @staticmethod
    def create_document(
        *,
        user_id: str,
        who: str,
        what: str,
        minor: int,
        state: str = "paid",
        via: str = "person",
        on: datetime | None = None,
        due: datetime | None = None,
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,
            "who": who.strip()[:80],
            "what": what.strip()[:140],
            # Paise, like every other amount in this product. A rupee float
            # would round her money.
            "minor": max(0, int(minor)),
            "state": state if state in STATES else "paid",
            "via": via if via in VIA else "person",
            # When the sale happened — hers to set, because she enters things
            # late and "today" would quietly file a Tuesday sale on Friday.
            "on": on or now,
            # Only meaningful for `owed` and `promised`.
            "due": due,
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        on = doc.get("on")
        due = doc.get("due")
        return {
            "id": str(doc.get("_id", "")),
            "who": doc.get("who", ""),
            "what": doc.get("what", ""),
            "minor": int(doc.get("minor", 0)),
            "state": doc.get("state", "paid"),
            "via": doc.get("via", "person"),
            "on": on.isoformat() if isinstance(on, datetime) else "",
            "due": due.isoformat() if isinstance(due, datetime) else "",
            # Counted here so every screen says the same number of days.
            "late_days": BookEntryModel._late_days(doc),
        }

    @staticmethod
    def _late_days(doc: dict) -> int:
        due = doc.get("due")
        if doc.get("state") != "owed" or not isinstance(due, datetime):
            return 0
        if due.tzinfo is None:
            due = due.replace(tzinfo=timezone.utc)
        days = (datetime.now(timezone.utc) - due).days
        return days if days > 0 else 0
