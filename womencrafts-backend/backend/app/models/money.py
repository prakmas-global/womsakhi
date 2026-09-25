"""
What she has promised to pay, and what is actually coming.

── Why this is not a budget ────────────────────────────────────────────────
Budgeting tools assume a predictable month: a salary in, categories out, a
variance report at the end. That describes almost nobody here. Her income
arrives in uneven pieces from different people, and the useful question is
never "did you stay under ₹2,000 on food" — it is **"is there enough for the
things that cannot wait"**.

So there are no categories, no limits, no score, and nothing turns red. A
woman who had to spend it did not overspend. The only warning this data
supports is the one that actually costs her money: counting a maybe as money.

── Only commitments are stored ─────────────────────────────────────────────
Money coming IN is not a collection. It is read off her books — an `owed` row
is work she has delivered and is waiting to be paid for, and a `promised` row
is work she has agreed to do and has not done yet. Those are precisely the
"agreed" and "not agreed yet" halves this screen has to keep apart, and she
has already typed them once. Asking her to type them again would guarantee the
two sets disagreed.
"""

from datetime import datetime, timezone

#: Ranked by consequence, never by amount. A ₹1,800 school fee that loses a
#: term test outranks ₹3,500 of rent that can be a week late, because the cost
#: of missing them is not the same. Sorting by size would teach her the wrong
#: thing about which one to worry about.
WEIGHTS = ("cannot-wait", "should-pay", "can-move")


class CommitmentModel:
    collection_name = "money_commitments"

    @staticmethod
    def create_document(
        *,
        user_id: str,
        what: str,
        minor: int,
        due: datetime | None = None,
        if_missed: str = "",
        weight: str = "should-pay",
        icon: str = "Circle",
        tint: str = "--ux-surface-2",
        ink: str = "--ux-muted",
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,
            "what": what.strip()[:120],
            "minor": max(0, int(minor)),
            "due": due,
            # What actually happens if it is missed. Empty where nothing much
            # does — and a commitment with nothing at stake should say so
            # rather than have a consequence invented for it.
            "if_missed": if_missed.strip()[:160],
            "weight": weight if weight in WEIGHTS else "should-pay",
            "icon": icon,
            "tint": tint,
            "ink": ink,
            "paid": False,
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        due = doc.get("due")
        return {
            "id": str(doc.get("_id", "")),
            "what": doc.get("what", ""),
            "minor": int(doc.get("minor", 0)),
            "due": due.isoformat() if isinstance(due, datetime) else "",
            "if_missed": doc.get("if_missed", ""),
            "weight": doc.get("weight", "should-pay"),
            "icon": doc.get("icon", "Circle"),
            "tint": doc.get("tint", "--ux-surface-2"),
            "ink": doc.get("ink", "--ux-muted"),
            "paid": bool(doc.get("paid", False)),
        }
