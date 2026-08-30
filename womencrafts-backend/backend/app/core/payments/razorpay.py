"""
Razorpay adapter — the one that matters most for an Indian audience.

Razorpay is the single integration that unlocks UPI, cards, net banking,
wallets, EMI and pay-later in one contract, which is why "every payment method"
in practice means "one good aggregator", not fifty integrations.

The wiring here is complete EXCEPT the three SDK calls, which need an account
and keys. Signature verification is real and already correct — it is the part
that must not be improvised later, because it is what stops a forged "payment
succeeded" callback.

To finish:
  1. pip install razorpay, add it to requirements.txt
  2. set PAYMENT_PROVIDER=razorpay, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET,
     PAYMENT_WEBHOOK_SECRET in .env
  3. replace the three `raise NotImplementedError` blocks with the SDK calls
     noted above each one
"""

import hashlib
import hmac
import json
from typing import Optional

from app.core.config import settings
from app.core.payments.base import (
    METHOD_CARD,
    METHOD_EMI,
    METHOD_NETBANKING,
    METHOD_PAYLATER,
    METHOD_UPI,
    METHOD_WALLET,
    PaymentProvider,
    ProviderOrder,
    ProviderPayment,
    ProviderRefund,
)


class RazorpayProvider(PaymentProvider):
    name = "razorpay"
    supported_methods = [
        METHOD_UPI,
        METHOD_CARD,
        METHOD_NETBANKING,
        METHOD_WALLET,
        METHOD_EMI,
        METHOD_PAYLATER,
    ]

    async def create_order(self, amount_minor, currency, reference, notes=None) -> ProviderOrder:
        # client.order.create({"amount": amount_minor, "currency": currency,
        #                      "receipt": reference, "notes": notes or {}})
        raise NotImplementedError(
            "Add the Razorpay SDK call here and set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET."
        )

    async def verify(self, payload: dict) -> ProviderPayment:
        """
        Razorpay Checkout returns order_id + payment_id + signature. The
        signature is HMAC-SHA256 of "order_id|payment_id" with the key secret —
        verifying it is what proves the browser isn't lying about paying.
        """
        order_id = payload.get("razorpay_order_id", "")
        payment_id = payload.get("razorpay_payment_id", "")
        signature = payload.get("razorpay_signature", "")

        expected = hmac.new(
            settings.RAZORPAY_KEY_SECRET.encode(),
            f"{order_id}|{payment_id}".encode(),
            hashlib.sha256,
        ).hexdigest()

        if not signature or not hmac.compare_digest(expected, signature):
            return ProviderPayment(
                provider_payment_id=payment_id,
                status="failed",
                amount_minor=int(payload.get("amount_minor") or 0),
                failure_reason="Payment signature did not verify",
            )

        # client.payment.fetch(payment_id) -> confirm status/amount server-side
        raise NotImplementedError("Add client.payment.fetch(payment_id) to confirm the capture.")

    async def refund(self, provider_payment_id: str, amount_minor: int) -> ProviderRefund:
        # client.payment(provider_payment_id).refund({"amount": amount_minor})
        raise NotImplementedError("Add the Razorpay refund SDK call here.")

    def parse_webhook(self, body: bytes, headers: dict) -> Optional[ProviderPayment]:
        signature = headers.get("x-razorpay-signature") or headers.get("X-Razorpay-Signature")
        expected = hmac.new(
            settings.PAYMENT_WEBHOOK_SECRET.encode(), body, hashlib.sha256
        ).hexdigest()
        if not signature or not hmac.compare_digest(signature, expected):
            return None

        event = json.loads(body or b"{}")
        entity = (
            event.get("payload", {}).get("payment", {}).get("entity", {})
        )
        status_map = {"captured": "captured", "failed": "failed", "authorized": "pending"}
        return ProviderPayment(
            provider_payment_id=entity.get("id", ""),
            status=status_map.get(entity.get("status", ""), "pending"),
            amount_minor=int(entity.get("amount") or 0),
            method=entity.get("method", ""),
            failure_reason=entity.get("error_description", "") or "",
            raw=event,
        )
