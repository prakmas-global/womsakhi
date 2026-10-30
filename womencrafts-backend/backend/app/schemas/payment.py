from typing import Optional

from pydantic import BaseModel, Field, field_validator


class PaymentMethod(BaseModel):
    key: str
    label: str


class PaymentMethodsResponse(BaseModel):
    enabled: bool
    provider: str
    currency: str
    methods: list[PaymentMethod]


class CreateOrderRequest(BaseModel):
    purpose: str          # booking | program
    reference_id: str

    @field_validator("purpose")
    @classmethod
    def known_purpose(cls, v: str) -> str:
        if v not in ("booking", "program"):
            raise ValueError("purpose must be 'booking' or 'program'")
        return v


class OrderResponse(BaseModel):
    id: str
    purpose: str
    reference_id: str
    title: str
    amount_minor: int
    amount_label: str
    currency: str
    status: str
    provider: str
    provider_order_id: str
    method: str
    failure_reason: str
    refunded_minor: int
    created: str
    created_at: str


class StartedOrderResponse(BaseModel):
    order: OrderResponse
    # Whatever the gateway's client SDK needs. Never contains a secret.
    client_payload: dict


class ConfirmPaymentRequest(BaseModel):
    method: str = "upi"
    # Signature/ids handed back by the gateway's checkout. Verified server-side.
    provider_payload: dict = {}


class RefundRequest(BaseModel):
    # None = refund the remaining balance in full.
    amount_minor: Optional[int] = None
    reason: str = ""


class RefundResponse(BaseModel):
    id: str
    order_id: str
    amount_minor: int
    amount_label: str
    reason: str
    status: str
    by_name: str
    created: str


class PaymentReference(BaseModel):
    reference: str = Field(..., min_length=1, max_length=40)

    @field_validator("reference")
    @classmethod
    def transaction_reference(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Add the transaction reference from your UPI app before submitting payment proof.")
        return value
