"""
Razorpay adapter — the one that matters most for an Indian audience.

Razorpay is the single integration that unlocks UPI, cards, net banking,
wallets, EMI and pay-later in one contract, which is why "every payment method"
in practice means "one good aggregator", not fifty integrations.

This adapter is complete. It talks to Razorpay's REST API over `httpx`, which
the project already depends on, rather than the `razorpay` SDK — the three
calls needed are plain authenticated JSON requests, and a synchronous SDK
inside an async service would block the event loop on every payment.

Signature verification is the part that must never be improvised: `verify`
checks the HMAC the browser returns AND re-fetches the payment server-side,
because a valid signature only proves the browser was told a payment id — it
does not prove the money was captured, or that it was the right amount.

All that is left is an account:
  1. set PAYMENT_PROVIDER=razorpay in .env
  2. set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (Dashboard → Settings → API Keys)
  3. set PAYMENT_WEBHOOK_SECRET to the webhook signing secret
     (Dashboard → Settings → Webhooks), which is a DIFFERENT value from the
     key secret — a very common and silent mix-up
"""

import hashlib
import hmac
import json
from typing import Any, Optional

import httpx

from app.core.config import settings
from app.core.payments.base import (
    METHOD_CARD,
    METHOD_EMI,
    METHOD_NETBANKING,
    METHOD_PAYLATER,
    METHOD_UPI,
    METHOD_WALLET,
    PaymentConfigError,
    PaymentProvider,
    PaymentProviderError,
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

    #: Razorpay's REST root. Test and live keys hit the same host; the key
    #: itself decides which mode you are in, so there is no URL to switch.
    API = "https://api.razorpay.com/v1"

    #: Beyond this a payment attempt is abandoned rather than left hanging. A
    #: woman staring at a spinner needs an answer, even a disappointing one.
    TIMEOUT = 20.0

    def _auth(self) -> tuple[str, str]:
        if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
            raise PaymentConfigError(
                "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are not set, so no payment "
                "can be taken. Set them in .env, or set PAYMENT_PROVIDER=sandbox."
            )
        return (settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)

    async def _call(self, method: str, path: str, payload: Optional[dict] = None) -> dict[str, Any]:
        """One authenticated request, with Razorpay's error surfaced as itself."""
        async with httpx.AsyncClient(timeout=self.TIMEOUT) as client:
            response = await client.request(
                method, f"{self.API}{path}", auth=self._auth(), json=payload
            )
        try:
            body = response.json()
        except ValueError:
            body = {}
        if response.status_code >= 400:
            # Razorpay nests the useful sentence; falling back to the status
            # code alone would give a member "something went wrong" while the
            # real reason ("amount exceeds maximum") sat one key away.
            detail = (body.get("error") or {}).get("description") or response.text[:200]
            raise PaymentProviderError(f"Razorpay refused this ({response.status_code}): {detail}")
        return body

    async def create_order(self, amount_minor, currency, reference, notes=None) -> ProviderOrder:
        order = await self._call(
            "POST",
            "/orders",
            {
                # Razorpay counts in the minor unit, which is what this app
                # stores end to end — so there is no conversion here, and there
                # must never be one.
                "amount": int(amount_minor),
                "currency": currency.upper(),
                "receipt": reference,
                "notes": notes or {},
            },
        )
        return ProviderOrder(
            provider_order_id=order.get("id", ""),
            amount_minor=int(order.get("amount") or amount_minor),
            currency=order.get("currency", currency.upper()),
            client_payload={
                # The key ID is public — it is meant to be in the browser. The
                # SECRET never appears here; that is what signs and verifies.
                "key": settings.RAZORPAY_KEY_ID,
                "order_id": order.get("id", ""),
                "amount": int(order.get("amount") or amount_minor),
                "currency": order.get("currency", currency.upper()),
                "name": "WomSakhi",
            },
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

        # A good signature proves the browser was handed this payment id by
        # Razorpay. It does NOT prove the money was captured, nor how much. Both
        # of those are asked of Razorpay directly, because the browser is not a
        # source of truth about whether it paid.
        payment = await self._call("GET", f"/payments/{payment_id}")
        captured = payment.get("status") == "captured"
        return ProviderPayment(
            provider_payment_id=payment.get("id", payment_id),
            status="captured" if captured else ("failed" if payment.get("status") == "failed" else "pending"),
            amount_minor=int(payment.get("amount") or 0),
            method=payment.get("method", ""),
            failure_reason=payment.get("error_description") or "",
            raw=payment,
        )

    async def refund(self, provider_payment_id: str, amount_minor: int) -> ProviderRefund:
        refund = await self._call(
            "POST", f"/payments/{provider_payment_id}/refund", {"amount": int(amount_minor)}
        )
        # Razorpay returns "processed" | "pending" | "failed"; the interface
        # uses the same three words, so this passes straight through.
        return ProviderRefund(
            provider_refund_id=refund.get("id", ""),
            status=refund.get("status", "pending"),
            amount_minor=int(refund.get("amount") or amount_minor),
            raw=refund,
        )

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
