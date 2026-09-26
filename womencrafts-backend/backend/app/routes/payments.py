"""
Payments.

Two rules run through everything here:

  1. **Never trust the client about money.** The amount is computed server-side
     from the catalogue, never read from the request. A payment is only marked
     paid after the PROVIDER confirms it — a browser saying "I paid" is a claim,
     not evidence.
  2. **An order belongs to the person who created it.** Every member-facing
     query is scoped by the user id in the token, exactly like /me.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core import idempotency
from app.core.config import settings
from app.core.payments import METHOD_LABELS, get_provider
from app.core.serializers import to_object_id
from app.db.mongodb import get_database
from app.models.conversation import MemberNotificationModel, notify
from app.models.enrollment import BookingModel
from app.models.payment import OrderModel
from app.models.program import ProgramModel
from app.models.service import ServiceModel
from app.routes.me import require_active_member
from app.schemas.payment import (
    ConfirmPaymentRequest,
    CreateOrderRequest,
    OrderResponse,
    PaymentMethodsResponse,
    StartedOrderResponse,
)

router = APIRouter(prefix="/payments", tags=["Payments"])


def _orders():
    return get_database()[OrderModel.collection_name]


@router.get("/methods", response_model=PaymentMethodsResponse, summary="How she can pay")
async def payment_methods(_: dict = Depends(require_active_member)):
    """
    Only ever the methods the configured provider can actually take — offering a
    method that fails at the last step is worse than not offering it.
    """
    provider = get_provider()
    return PaymentMethodsResponse(
        enabled=settings.PAYMENTS_ENABLED,
        provider=provider.name,
        currency=settings.PAYMENT_CURRENCY,
        methods=[
            {"key": m, "label": METHOD_LABELS.get(m, m)} for m in provider.supported_methods
        ],
    )


async def _price_for(purpose: str, reference_id: str) -> tuple[int, str]:
    """Server-side price + title. The client never tells us what something costs."""
    db = get_database()
    if purpose == OrderModel.PURPOSE_BOOKING:
        booking = await db[BookingModel.collection_name].find_one({"_id": to_object_id(reference_id)})
        if not booking:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found")
        service = await db[ServiceModel.collection_name].find_one({"name": booking.get("service_name")})
        price = (service or {}).get("price", booking.get("price", 0))
        return OrderModel.parse_price(price), booking.get("service_name", "Session")

    program = await db[ProgramModel.collection_name].find_one({"_id": to_object_id(reference_id)})
    if not program:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Program not found")
    return OrderModel.parse_price(program.get("fee") or program.get("price") or 0), program.get("name", "Program")


@router.post(
    "/orders",
    response_model=StartedOrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start a payment",
)
async def create_order(
    payload: CreateOrderRequest,
    request: Request,
    me: dict = Depends(require_active_member),
):
    """
    Send an `Idempotency-Key` header and a retry cannot become a second order.

    A woman on 2G presses Confirm, the spinner sits, she is not sure, she
    presses again. Without the key that is two orders; with it, the second
    press gets the first one's answer back.
    """
    return await idempotency.once(
        request, str(me["_id"]), "payments.create_order",
        lambda: _create_order(payload, me),
    )


async def _create_order(payload: CreateOrderRequest, me: dict):
    if not settings.PAYMENTS_ENABLED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Payments are currently disabled.")

    amount_minor, title = await _price_for(payload.purpose, payload.reference_id)
    if amount_minor <= 0:
        # Free things must not create an order — an empty checkout is a dead end.
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This is free — no payment needed.")

    # Already paid for — never let her pay twice.
    paid = await _orders().find_one({
        "user_id": str(me["_id"]),
        "purpose": payload.purpose,
        "reference_id": payload.reference_id,
        "status": OrderModel.STATUS_PAID,
    })
    if paid:
        raise HTTPException(status.HTTP_409_CONFLICT, "You've already paid for this.")

    provider = get_provider()

    # Order creation is IDEMPOTENT: opening checkout twice, or tapping back and
    # retrying, reuses the open order rather than littering the ledger with
    # abandoned ones. (A *failed* order is left alone — a fresh attempt after a
    # decline deserves its own record, because that history is what you need
    # when someone disputes a charge.)
    open_order = await _orders().find_one({
        "user_id": str(me["_id"]),
        "purpose": payload.purpose,
        "reference_id": payload.reference_id,
        "status": OrderModel.STATUS_CREATED,
    })
    if open_order and int(open_order.get("amount_minor") or 0) == amount_minor:
        return StartedOrderResponse(
            order=OrderResponse(**OrderModel.to_response(open_order)),
            client_payload=(
                await provider.create_order(
                    amount_minor=amount_minor,
                    currency=settings.PAYMENT_CURRENCY,
                    reference=str(open_order["_id"]),
                    notes={"member": me.get("full_name", ""), "reused": True},
                )
            ).client_payload,
        )
    doc = OrderModel.create_document(
        user_id=str(me["_id"]),
        member_id=me.get("member_id") or "",
        purpose=payload.purpose,
        reference_id=payload.reference_id,
        title=title,
        amount_minor=amount_minor,
        currency=settings.PAYMENT_CURRENCY,
        provider=provider.name,
    )
    result = await _orders().insert_one(doc)
    doc["_id"] = result.inserted_id

    provider_order = await provider.create_order(
        amount_minor=amount_minor,
        currency=settings.PAYMENT_CURRENCY,
        reference=str(result.inserted_id),
        notes={"member": me.get("full_name", ""), "purpose": payload.purpose},
    )
    await _orders().update_one(
        {"_id": result.inserted_id},
        {"$set": {"provider_order_id": provider_order.provider_order_id}},
    )
    doc["provider_order_id"] = provider_order.provider_order_id

    return StartedOrderResponse(
        order=OrderResponse(**OrderModel.to_response(doc)),
        client_payload=provider_order.client_payload,
    )


@router.post("/orders/{order_id}/confirm", response_model=OrderResponse, summary="Confirm a payment")
async def confirm(
    order_id: str,
    payload: ConfirmPaymentRequest,
    request: Request,
    me: dict = Depends(require_active_member),
):
    """
    The client reports back, the PROVIDER decides. The amount sent to the
    provider is the one stored on the order, never one supplied by the browser.

    Idempotent on `Idempotency-Key`: this is the single most consequential
    button in the app, and the one most likely to be pressed twice.
    """
    return await idempotency.once(
        request, str(me["_id"]), f"payments.confirm:{order_id}",
        lambda: _confirm(order_id, payload, me),
    )


async def _confirm(order_id: str, payload: ConfirmPaymentRequest, me: dict):
    order = await _orders().find_one({"_id": to_object_id(order_id), "user_id": str(me["_id"])})
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    if order.get("status") == OrderModel.STATUS_PAID:
        return OrderResponse(**OrderModel.to_response(order))

    provider = get_provider()
    verification = dict(payload.provider_payload or {})
    verification.update(
        amount_minor=int(order["amount_minor"]),
        method=payload.method,
        reference=str(order["_id"]),
    )
    result = await provider.verify(verification)

    now = datetime.now(timezone.utc)
    updates = {
        "method": result.method or payload.method,
        "provider_payment_id": result.provider_payment_id,
        "updated_at": now,
    }
    if result.status == "captured":
        updates.update(status=OrderModel.STATUS_PAID, paid_at=now, failure_reason="")
    elif result.status == "failed":
        updates.update(status=OrderModel.STATUS_FAILED, failure_reason=result.failure_reason)

    fresh = await _orders().find_one_and_update(
        {"_id": order["_id"]},
        {"$set": updates},
        return_document=True,
    )

    if result.status == "captured":
        await notify(
            get_database(), str(me["_id"]),
            title="Payment received",
            body=f"{OrderModel.money(int(order['amount_minor']), order.get('currency', 'INR'))} for {order.get('title', '')}.",
            ntype=MemberNotificationModel.TYPE_BOOKING,
            href="/app/bookings",
        )
    return OrderResponse(**OrderModel.to_response(fresh))


@router.get("/orders/{order_id}", response_model=OrderResponse, summary="One payment")
async def one_order(order_id: str, me: dict = Depends(require_active_member)):
    """
    The checkout screen needs the order it is about, not every order she has
    ever made. Filtering by `user_id` here is the authorisation check, not a
    convenience: without it, changing the id in the address bar reads somebody
    else's payment.
    """
    order = await _orders().find_one({"_id": to_object_id(order_id), "user_id": str(me["_id"])})
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    return OrderResponse(**OrderModel.to_response(order))


@router.get("/orders", response_model=list[OrderResponse], summary="My payments")
async def my_orders(me: dict = Depends(require_active_member)):
    cursor = _orders().find({"user_id": str(me["_id"])}).sort("created_at", -1)
    return [OrderResponse(**OrderModel.to_response(o)) async for o in cursor]


# --- staff -------------------------------------------------------------------
#
# The two staff endpoints that lived here (`GET /payments/admin/orders` and
# `POST /payments/admin/orders/{id}/refund`) were guarded by `require_staff`
# only — any staff role could refund any payment, unaudited. They now live in
# admin_money.py under `money.view` / `money.approve` with an audit record.


# --- webhook -----------------------------------------------------------------

@router.post("/webhook", summary="Gateway webhook", include_in_schema=False)
async def webhook(request: Request):
    """
    The gateway's own word, and the only source that can be trusted when the
    browser closes mid-payment. Unsigned or unrecognised events are dropped
    silently — a 200 with no action, so a bad actor learns nothing.
    """
    body = await request.body()
    event = get_provider().parse_webhook(body, dict(request.headers))
    if not event or not event.provider_payment_id:
        return {"received": True}

    order = await _orders().find_one({"provider_payment_id": event.provider_payment_id})
    if not order:
        return {"received": True}

    now = datetime.now(timezone.utc)
    if event.status == "captured" and order.get("status") != OrderModel.STATUS_PAID:
        await _orders().update_one(
            {"_id": order["_id"]},
            {"$set": {"status": OrderModel.STATUS_PAID, "paid_at": now, "updated_at": now}},
        )
    elif event.status == "failed":
        await _orders().update_one(
            {"_id": order["_id"]},
            {"$set": {
                "status": OrderModel.STATUS_FAILED,
                "failure_reason": event.failure_reason,
                "updated_at": now,
            }},
        )
    return {"received": True}
