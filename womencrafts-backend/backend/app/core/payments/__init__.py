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
    PaymentConfigError,
    PaymentProvider,
    PaymentProviderError,
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
    """Return the configured gateway; an unknown name is a deployment error."""
    name = settings.PAYMENT_PROVIDER.lower()
    cls = _PROVIDERS.get(name)
    if cls is None:
        raise PaymentConfigError(f"Payment provider '{name}' is not installed")
    return cls()


__all__ = [
    "ALL_METHODS",
    "METHOD_LABELS",
    "PaymentConfigError",
    "PaymentProvider",
    "PaymentProviderError",
    "ProviderOrder",
    "ProviderPayment",
    "ProviderRefund",
    "get_provider",
]
