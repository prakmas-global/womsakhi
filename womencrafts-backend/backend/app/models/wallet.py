"""
Her money on the platform: a credit balance, and a way to ask for help paying.

Amounts are integers in the minor unit (paise) everywhere, exactly as in
`payment.py`. Floats and money do not mix, and a balance that drifts by a paisa
per refund destroys trust faster than any bug on a screen she can see.

The balance is NOT stored. It is summed from the ledger, which means it can never
disagree with the transactions she is shown.
"""

from datetime import datetime, timezone


class WalletTxnModel:
    """One immutable line in her ledger."""

    collection_name = "wallet_transactions"

    KIND_CREDIT = "credit"
    KIND_DEBIT = "debit"

    # Where credits come from — kept as constants so reporting can group them.
    SOURCE_REFUND = "refund"
    SOURCE_REFERRAL = "referral"
    SOURCE_SCHOLARSHIP = "scholarship"
    SOURCE_GOODWILL = "goodwill"
    SOURCE_SPEND = "spend"

    @staticmethod
    def create_document(
        user_id: str,
        member_id: str,
        kind: str,
        amount_minor: int,
        source: str,
        label: str,
        reference_id: str = "",
    ) -> dict:
        return {
            "user_id": user_id,
            "member_id": member_id,
            "kind": kind,
            "amount_minor": int(amount_minor),
            "source": source,
            "label": label,
            "reference_id": reference_id,
            "created_at": datetime.now(timezone.utc),
        }

    @staticmethod
    def to_response(doc: dict, currency_symbol: str = "₹") -> dict:
        created = doc.get("created_at")
        minor = int(doc.get("amount_minor", 0))
        signed = minor if doc.get("kind") == WalletTxnModel.KIND_CREDIT else -minor
        return {
            "id": str(doc["_id"]),
            "kind": doc.get("kind", ""),
            "label": doc.get("label", ""),
            "source": doc.get("source", ""),
            "amount_minor": minor,
            "amount_label": f"{'+' if signed >= 0 else '−'}{currency_symbol}{minor / 100:,.0f}",
            "when": created.strftime("%b %d, %Y") if isinstance(created, datetime) else "",
        }


class SupportRequestModel:
    """
    "I want to do this programme but I can't pay for it."

    Asking is the hardest part, so the form is short and the language is plain.
    Staff decide; an approval writes a scholarship credit into the wallet.
    """

    collection_name = "support_requests"

    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_PARTIAL = "partial"
    STATUS_DECLINED = "declined"

    @staticmethod
    def create_document(
        user_id: str,
        member_id: str,
        member_name: str,
        what_for: str,
        reason: str,
        amount_needed_minor: int = 0,
        household_income: str = "",
        dependants: int = 0,
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,
            "member_id": member_id,
            "member_name": member_name,
            "what_for": what_for,
            "reason": reason,
            "amount_needed_minor": int(amount_needed_minor),
            "household_income": household_income,
            "dependants": dependants,
            "status": SupportRequestModel.STATUS_PENDING,
            "granted_minor": 0,
            "staff_note": "",
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict, currency_symbol: str = "₹") -> dict:
        created = doc.get("created_at")
        granted = int(doc.get("granted_minor", 0))
        return {
            "id": str(doc["_id"]),
            "what_for": doc.get("what_for", ""),
            "reason": doc.get("reason", ""),
            "amount_needed_label": f"{currency_symbol}{int(doc.get('amount_needed_minor', 0)) / 100:,.0f}",
            "granted_label": f"{currency_symbol}{granted / 100:,.0f}" if granted else "",
            "status": doc.get("status", "pending"),
            "staff_note": doc.get("staff_note", ""),
            "asked_on": created.strftime("%b %d, %Y") if isinstance(created, datetime) else "",
        }
