"""
Payment provider abstraction.

WomSakhi has no gateway account yet and no settled revenue model, so payments
are built as a PORT with swappable adapters rather than wired to one vendor:

    provider.create_order(...)  -> an order the client can pay
    provider.verify(...)        -> did this payment really succeed?
    provider.refund(...)        -> give it back
    provider.parse_webhook(...) -> what the gateway is telling us

Adding Razorpay/Stripe/PayPal later means writing one adapter and setting
PAYMENT_PROVIDER — no route, screen or database change.

MONEY IS ALWAYS AN INTEGER IN THE CURRENCY'S MINOR UNIT (paise, cents). Floats
lose money: 0.1 + 0.2 != 0.3 in binary, and that error compounds across refunds
and reconciliation. Every gateway worth using does the same.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


# Methods a member might pay with. Which are actually offered depends on the
# provider and her country — the UI asks the provider rather than assuming.
METHOD_UPI = "upi"
METHOD_CARD = "card"
METHOD_NETBANKING = "netbanking"
METHOD_WALLET = "wallet"
METHOD_EMI = "emi"
METHOD_PAYLATER = "paylater"
METHOD_CASH = "cash"          # paid at the centre; recorded, not processed

ALL_METHODS = [
    METHOD_UPI,
    METHOD_CARD,
    METHOD_NETBANKING,
    METHOD_WALLET,
    METHOD_EMI,
    METHOD_PAYLATER,
    METHOD_CASH,
]

METHOD_LABELS = {
    METHOD_UPI: "UPI",
    METHOD_CARD: "Card",
    METHOD_NETBANKING: "Net banking",
    METHOD_WALLET: "Wallet",
    METHOD_EMI: "EMI",
    METHOD_PAYLATER: "Pay later",
    METHOD_CASH: "Pay at the centre",
}


@dataclass
class ProviderOrder:
    """What the client needs to start paying."""
    provider_order_id: str
    amount_minor: int
    currency: str
    # Anything the client SDK needs (key id, session url, UPI intent…). Never
    # put a secret in here — it goes to the browser.
    client_payload: dict = field(default_factory=dict)


@dataclass
class ProviderPayment:
    """The result of an attempt, normalised across providers."""
    provider_payment_id: str
    status: str            # "captured" | "failed" | "pending"
    amount_minor: int
    method: str = ""
    failure_reason: str = ""
    raw: dict = field(default_factory=dict)


@dataclass
class ProviderRefund:
    provider_refund_id: str
    status: str            # "processed" | "pending" | "failed"
    amount_minor: int
    raw: dict = field(default_factory=dict)


class PaymentProvider:
    """The port every gateway adapter implements."""

    name = "base"
    #: Methods this provider can actually take. The checkout screen renders
    #: exactly these — never a method that will fail at the last step.
    supported_methods: list[str] = []

    async def create_order(
        self,
        amount_minor: int,
        currency: str,
        reference: str,
        notes: Optional[dict] = None,
    ) -> ProviderOrder:
        raise NotImplementedError

    async def verify(self, payload: dict) -> ProviderPayment:
        """Confirm a payment the client says succeeded. NEVER trust the client alone."""
        raise NotImplementedError

    async def refund(self, provider_payment_id: str, amount_minor: int) -> ProviderRefund:
        raise NotImplementedError

    def parse_webhook(self, body: bytes, headers: dict) -> Optional[ProviderPayment]:
        """Verify the signature and translate the event, or return None if it isn't ours."""
        raise NotImplementedError
