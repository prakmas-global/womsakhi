from typing import Literal, Optional

from pydantic import BaseModel, field_validator

# --- Allowed values, kept in sync with the models / seed / frontend -----------

BillingStatus = Literal["Active", "Cancelled"]
PlanName = Literal["Basic Plan", "Professional Plan", "Enterprise Plan"]
InvoiceStatus = Literal["Paid", "Pending", "Failed"]
CardBrand = Literal["Mastercard", "Visa", "American Express", "RuPay"]


# --- Nested pieces ------------------------------------------------------------

class CardResponse(BaseModel):
    brand: str = ""
    last4: str = ""
    expiry: str = ""
    is_primary: bool = True


class BillingInfoResponse(BaseModel):
    company: str = ""
    email: str = ""
    gstin: str = ""
    address: str = ""


class FeatureItem(BaseModel):
    icon: str
    label: str
    sub: str


class UsageItem(BaseModel):
    icon: str
    label: str
    value: str
    pct: int
    color: str


class BillingSummaryResponse(BaseModel):
    """The Billing Summary card. Amounts are derived from plan_price + tax_percent."""

    plan: str
    billing_cycle: str
    subtotal: str
    tax_percent: int
    taxes: str
    total: str
    currency: str


# --- Account (singleton) ------------------------------------------------------

class BillingAccountResponse(BaseModel):
    id: str
    plan: str
    plan_price: str
    plan_description: str
    status: str
    billing_cycle: str
    next_billing_date: str
    usage_reset_date: str
    auto_pay: bool
    card: CardResponse
    billing_info: BillingInfoResponse
    features: list[FeatureItem]
    usage: list[UsageItem]
    summary: BillingSummaryResponse


class UsageOverviewResponse(BaseModel):
    """Powers the Usage Overview card / Plan Details modal."""

    usage: list[UsageItem]
    usage_reset_date: str


# --- Plans --------------------------------------------------------------------

class PlanResponse(BaseModel):
    id: str
    name: str
    price: str
    description: str
    billing_cycle: str
    order: int
    current: bool = False


# --- Invoices -----------------------------------------------------------------

class InvoiceResponse(BaseModel):
    id: str
    invoice_number: str
    date: str
    period: str
    description: str
    plan: str
    amount: str
    status: str


class InvoiceListResponse(BaseModel):
    items: list[InvoiceResponse]
    total: int
    page: int
    page_size: int
    pages: int


# --- Request bodies -----------------------------------------------------------

class ChangePlanRequest(BaseModel):
    """Confirm Plan on the Change Plan modal."""

    plan_name: PlanName


class UpdatePaymentRequest(BaseModel):
    """Save Card on the Payment Method modal. Only brand + last4 + expiry are kept."""

    number: str
    expiry: str
    name: Optional[str] = None
    cvc: Optional[str] = None
    brand: CardBrand = "Mastercard"

    @field_validator("number", "expiry")
    @classmethod
    def not_empty(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("Card number and expiry are required")
        return v


class AutoPayRequest(BaseModel):
    """Auto-pay toggle."""

    auto_pay: bool


class BillingInfoUpdate(BaseModel):
    """Save Changes on the Billing Information modal."""

    company: str
    email: str
    gstin: str = ""
    address: str = ""

    @field_validator("company", "email")
    @classmethod
    def required(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("Company name and billing email are required")
        return v
