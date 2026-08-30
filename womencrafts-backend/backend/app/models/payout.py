"""
Where her money goes when she withdraws it.

Distinct from `payments.methods`, which is how the *platform* takes money in
(the gateway, the cards it accepts). This is the opposite direction and belongs
to her: her bank account, her UPI id.

**The account number is never stored in full.** Only the last four digits and
enough to display, because this application has no reason to be able to read a
member's full account number back — and a database that cannot leak it is
better than one that promises not to. The full number goes to the payment
provider at the moment a payout is made and is not kept here.

**Exactly one method is primary.** Setting a new one clears the rest in the
same operation, because two primaries means the payout code has to pick, and
whichever it picks will be the wrong one on the day it matters.
"""

from datetime import datetime, timezone

from app.core.serializers import aware


class PayoutAccountModel:
    collection_name = "payout_accounts"

    KIND_BANK = "Bank"
    KIND_UPI = "UPI"
    KINDS = (KIND_BANK, KIND_UPI)

    @staticmethod
    def create_document(
        *,
        user_id: str,
        member_id: str,
        kind: str,
        label: str,
        last4: str = "",
        ifsc: str = "",
        holder: str = "",
        upi_id: str = "",
        primary: bool = False,
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,
            "member_id": member_id,
            "kind": kind if kind in PayoutAccountModel.KINDS else PayoutAccountModel.KIND_BANK,
            "label": label.strip(),
            # Four digits is what a person needs to recognise their own account
            # and what an attacker cannot do anything with.
            "last4": last4[-4:],
            "ifsc": ifsc.strip().upper(),
            "holder": holder.strip(),
            "upi_id": upi_id.strip(),
            "primary": bool(primary),
            # A ₹1 test transfer proves the details are right before real money
            # moves. Until it lands, the account is usable but flagged.
            "verified": False,
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        kind = doc.get("kind", PayoutAccountModel.KIND_BANK)
        return {
            "id": str(doc["_id"]),
            "kind": kind,
            "label": doc.get("label", ""),
            # Formatted once, here, so no screen has to decide how to mask it.
            "detail": (
                f"•••• {doc.get('last4', '')}" if kind == PayoutAccountModel.KIND_BANK
                else doc.get("upi_id", "")
            ),
            "holder": doc.get("holder", ""),
            "ifsc": doc.get("ifsc", ""),
            "primary": bool(doc.get("primary")),
            "verified": bool(doc.get("verified")),
            "added_on": (aware(doc.get("created_at")) or datetime.now(timezone.utc)).strftime("%d %b %Y"),
        }
