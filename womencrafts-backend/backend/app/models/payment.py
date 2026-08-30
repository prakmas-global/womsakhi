"""
Orders, payments and refunds.

An ORDER is the intent to pay for something; a PAYMENT is an attempt against it.
They are separate because one order can have several attempts — she tries UPI, it
fails, she tries a card. Collapsing them loses that history, which is exactly the
history you need when someone says "it took my money twice".

Amounts are integers in the minor unit (paise). See core/payments/base.py.
"""

from datetime import datetime, timezone
from typing import Optional


class OrderModel:
    collection_name = "orders"

    # What is being paid for. Adding a kind never changes the payment code.
    PURPOSE_BOOKING = "booking"
    PURPOSE_PROGRAM = "program"
    PURPOSES = [PURPOSE_BOOKING, PURPOSE_PROGRAM]

    STATUS_CREATED = "created"
    STATUS_PAID = "paid"
    STATUS_FAILED = "failed"
    STATUS_REFUNDED = "refunded"
    STATUS_CANCELLED = "cancelled"

    @staticmethod
    def create_document(
        user_id: str,
        member_id: str,
        purpose: str,
        reference_id: str,
        title: str,
        amount_minor: int,
        currency: str,
        provider: str,
        provider_order_id: str = "",
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,
            "member_id": member_id,
            "purpose": purpose if purpose in OrderModel.PURPOSES else OrderModel.PURPOSE_BOOKING,
            "reference_id": reference_id,   # the booking/program this pays for
            "title": title,                 # what she'll see on the receipt
            "amount_minor": amount_minor,
            "currency": currency,
            "status": OrderModel.STATUS_CREATED,
            "provider": provider,
            "provider_order_id": provider_order_id,
            "provider_payment_id": "",
            "method": "",
            "failure_reason": "",
            "refunded_minor": 0,
            "paid_at": None,
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        created = doc.get("created_at")
        amount = int(doc.get("amount_minor") or 0)
        currency = doc.get("currency", "INR")
        return {
            "id": str(doc["_id"]),
            "purpose": doc.get("purpose", ""),
            "reference_id": doc.get("reference_id", ""),
            "title": doc.get("title", ""),
            "amount_minor": amount,
            "amount_label": OrderModel.money(amount, currency),
            "currency": currency,
            "status": doc.get("status", "created"),
            "provider": doc.get("provider", ""),
            "provider_order_id": doc.get("provider_order_id", ""),
            "method": doc.get("method", ""),
            "failure_reason": doc.get("failure_reason", ""),
            "refunded_minor": int(doc.get("refunded_minor") or 0),
            "created": created.strftime("%d %b %Y") if isinstance(created, datetime) else "",
            "created_at": created.isoformat() if isinstance(created, datetime) else "",
        }

    @staticmethod
    def money(amount_minor: int, currency: str = "INR") -> str:
        """Minor units → something a person reads. ₹1,499.00"""
        symbol = {"INR": "₹", "USD": "$", "EUR": "€", "GBP": "£"}.get(currency, currency + " ")
        return f"{symbol}{amount_minor / 100:,.2f}"

    @staticmethod
    def parse_price(raw, currency: str = "INR") -> int:
        """
        '₹499' / '499' / 499.0 → 49900 paise.

        Services store price as a display STRING, so this is the one place that
        turns presentation back into money — carefully, and only once.
        """
        if raw is None:
            return 0
        if isinstance(raw, (int, float)):
            return int(round(float(raw) * 100))
        cleaned = "".join(c for c in str(raw) if c.isdigit() or c == ".")
        if not cleaned:
            return 0
        try:
            return int(round(float(cleaned) * 100))
        except ValueError:
            return 0


class RefundModel:
    collection_name = "refunds"

    @staticmethod
    def create_document(
        order_id: str,
        user_id: str,
        amount_minor: int,
        reason: str,
        provider_refund_id: str,
        status: str,
        by_name: str = "",
    ) -> dict:
        return {
            "order_id": order_id,
            "user_id": user_id,
            "amount_minor": amount_minor,
            "reason": reason,
            "provider_refund_id": provider_refund_id,
            "status": status,
            "by_name": by_name,
            "created_at": datetime.now(timezone.utc),
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        created = doc.get("created_at")
        return {
            "id": str(doc["_id"]),
            "order_id": doc.get("order_id", ""),
            "amount_minor": int(doc.get("amount_minor") or 0),
            "amount_label": OrderModel.money(int(doc.get("amount_minor") or 0)),
            "reason": doc.get("reason", ""),
            "status": doc.get("status", ""),
            "by_name": doc.get("by_name", ""),
            "created": created.strftime("%d %b %Y") if isinstance(created, datetime) else "",
        }
