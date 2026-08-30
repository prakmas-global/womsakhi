"""
Sandbox provider — the one that runs today.

No gateway account, no keys, no network. It behaves like a real provider
(orders, verification, refunds, signed webhooks) so the entire checkout journey
can be built and tested now, and so a demo never depends on someone else's
uptime.

It is deliberately NOT a no-op that always succeeds: a `pay_fail` reference or a
zero amount fails, because the failure path is the one that actually needs
designing.
"""

import hashlib
import hmac
import json
import uuid
from typing import Optional

from app.core.config import settings
from app.core.payments.base import (
    ALL_METHODS,
    METHOD_CARD,
    METHOD_CASH,
    METHOD_NETBANKING,
    METHOD_UPI,
    METHOD_WALLET,
    PaymentProvider,
    ProviderOrder,
    ProviderPayment,
    ProviderRefund,
)


class SandboxProvider(PaymentProvider):
    name = "sandbox"
    supported_methods = [METHOD_UPI, METHOD_CARD, METHOD_NETBANKING, METHOD_WALLET, METHOD_CASH]

    async def create_order(self, amount_minor, currency, reference, notes=None) -> ProviderOrder:
        return ProviderOrder(
            provider_order_id=f"sbox_order_{uuid.uuid4().hex[:16]}",
            amount_minor=amount_minor,
            currency=currency,
            client_payload={
                "provider": self.name,
                "reference": reference,
                # A real provider would return a UPI intent / checkout URL here.
                "upi_intent": f"upi://pay?pa=womsakhi@sandbox&am={amount_minor / 100:.2f}&cu={currency}",
                "test_mode": True,
            },
        )

    async def verify(self, payload: dict) -> ProviderPayment:
        amount = int(payload.get("amount_minor") or 0)
        method = payload.get("method") or METHOD_UPI

        # Deterministic failure paths, so the sad path is testable.
        if amount <= 0:
            return ProviderPayment(
                provider_payment_id="",
                status="failed",
                amount_minor=amount,
                method=method,
                failure_reason="Amount must be greater than zero",
            )
        if str(payload.get("reference", "")).endswith("pay_fail"):
            return ProviderPayment(
                provider_payment_id=f"sbox_pay_{uuid.uuid4().hex[:16]}",
                status="failed",
                amount_minor=amount,
                method=method,
                failure_reason="The bank declined this payment (sandbox)",
            )

        return ProviderPayment(
            provider_payment_id=f"sbox_pay_{uuid.uuid4().hex[:16]}",
            status="captured",
            amount_minor=amount,
            method=method,
            raw={"sandbox": True},
        )

    async def refund(self, provider_payment_id: str, amount_minor: int) -> ProviderRefund:
        return ProviderRefund(
            provider_refund_id=f"sbox_rfnd_{uuid.uuid4().hex[:16]}",
            status="processed",
            amount_minor=amount_minor,
            raw={"sandbox": True},
        )

    def parse_webhook(self, body: bytes, headers: dict) -> Optional[ProviderPayment]:
        """
        Same shape as a real webhook, including signature verification — so the
        handler is exercised now rather than written for the first time on the
        day money starts moving.
        """
        signature = headers.get("x-womsakhi-signature") or headers.get("X-WomSakhi-Signature")
        expected = hmac.new(
            settings.PAYMENT_WEBHOOK_SECRET.encode(), body, hashlib.sha256
        ).hexdigest()
        if not signature or not hmac.compare_digest(signature, expected):
            return None

        event = json.loads(body or b"{}")
        return ProviderPayment(
            provider_payment_id=event.get("payment_id", ""),
            status=event.get("status", "pending"),
            amount_minor=int(event.get("amount_minor") or 0),
            method=event.get("method", ""),
            raw=event,
        )
