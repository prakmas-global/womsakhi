"""
Provider selection.

`PAYMENT_PROVIDER` in settings picks the adapter. Everything else in the app
talks to the interface, so switching gateway is a config change.

Razorpay / Stripe / PayPal adapters are stubbed with their real method sets so
the checkout UI already renders the right options; each needs its SDK call
filled in plus API keys, and nothing around it changes.
"""

from app.core.config import settings
from app.core.payments.base import (
    ALL_METHODS,
    METHOD_LABELS,
    PaymentProvider,
    ProviderOrder,
    ProviderPayment,
    ProviderRefund,
)
from app.core.payments.sandbox import SandboxProvider

_PROVIDERS: dict[str, type[PaymentProvider]] = {
    "sandbox": SandboxProvider,
}

try:  # optional adapters, only if their module is present
    from app.core.payments.razorpay import RazorpayProvider

    _PROVIDERS["razorpay"] = RazorpayProvider
except ImportError:  # pragma: no cover
    pass


def get_provider() -> PaymentProvider:
    """The configured gateway, falling back to sandbox rather than crashing."""
    cls = _PROVIDERS.get(settings.PAYMENT_PROVIDER.lower(), SandboxProvider)
    return cls()


__all__ = [
    "ALL_METHODS",
    "METHOD_LABELS",
    "PaymentProvider",
    "ProviderOrder",
    "ProviderPayment",
    "ProviderRefund",
    "get_provider",
]
