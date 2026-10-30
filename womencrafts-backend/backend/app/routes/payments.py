"""Direct-UPI payment activity for this release, with recipient confirmation.

Members pay the provider outside WomSakhi and submit a transaction reference.
Course and mentoring owners check their own accounts and confirm receipt.
A claim never creates wallet credit or counts as recipient confirmation.
Legacy gateway routes remain disabled while DIRECT_UPI_ONLY is true.
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


def _require_gateway_mode():
    if settings.DIRECT_UPI_ONLY:
        raise HTTPException(501, "Pay the provider directly by UPI and submit your transaction reference on the course or session page. Gateway checkout is not available in this release.")


def _orders():
    return get_database()[OrderModel.collection_name]


@router.get("/methods", response_model=PaymentMethodsResponse, summary="How she can pay")
async def payment_methods(_: dict = Depends(require_active_member)):
    """
    Only ever the methods the configured provider can actually take — offering a
    method that fails at the last step is worse than not offering it.
    """
    if settings.DIRECT_UPI_ONLY:
        return PaymentMethodsResponse(enabled=settings.PAYMENTS_ENABLED, provider="direct_upi", currency=settings.PAYMENT_CURRENCY, methods=[{"key": "upi", "label": "Pay recipient directly by UPI"}])
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
    _require_gateway_mode()
    return await idempotency.once(
        request, str(me["_id"]), "payments.create_order",
        lambda: _create_order(payload, me),
    )


async def _create_order(payload: CreateOrderRequest, me: dict):
    _require_gateway_mode()
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
    _require_gateway_mode()
    return await idempotency.once(
        request, str(me["_id"]), f"payments.confirm:{order_id}",
        lambda: _confirm(order_id, payload, me),
    )


async def _confirm(order_id: str, payload: ConfirmPaymentRequest, me: dict):
    _require_gateway_mode()
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
    _require_gateway_mode()
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


@router.get("/activity", summary="My direct UPI payments and recipient confirmations")
async def payment_activity(me: dict = Depends(require_active_member)):
    """Read existing payment states; never mint wallet credit or infer confirmation from a claim."""
    uid = str(me["_id"])
    db = get_database()
    owned = await db[ProgramModel.collection_name].find({"owner_id": uid}, {"name": 1, "teacher_name": 1}).to_list(500)
    own_ids = [str(row["_id"]) for row in owned]
    enrolled = await db["enrollments"].find({
        "$or": [{"user_id": uid}, {"program_id": {"$in": own_ids}}],
        "payment.amount_minor": {"$gt": 0},
    }).sort("updated_at", -1).to_list(500)
    ids = {row.get("program_id", "") for row in enrolled}
    programs = {str(row["_id"]): row for row in await db[ProgramModel.collection_name].find(
        {"_id": {"$in": [to_object_id(value) for value in ids if len(value) == 24 and all(c in "0123456789abcdefABCDEF" for c in value)]}},
        {"name": 1, "teacher_name": 1, "owner_id": 1},
    ).to_list(1000)}
    items = []

    def iso(value):
        return (value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value).isoformat() if isinstance(value, datetime) else ""

    def manual(row, *, kind, title, recipient, href):
        pay = row.get("payment") or {}
        state = pay.get("status", "awaiting")
        state = state if state in {"awaiting", "claimed", "paid", "declined"} else "awaiting"
        if row.get("status") == "withdrawn" and state not in {"paid", "declined"}:
            state = "cancelled"
        items.append({
            "id": f"{kind}:{row['_id']}", "kind": kind, "direction": "sent" if row.get("user_id") == uid else "received",
            "title": title, "recipient": recipient, "amount_minor": int(pay.get("amount_minor") or row.get("price_minor") or 0),
            "status": state, "reference": pay.get("reference", ""), "note": pay.get("note", ""), "href": href,
            "submitted_at": iso(pay.get("claimed_at")), "confirmed_at": iso(pay.get("confirmed_at")),
            "updated_at": iso(row.get("updated_at") or row.get("created_at")), "method": "upi", "legacy": False, "currency": settings.PAYMENT_CURRENCY.upper(),
        })

    for row in enrolled:
        program = programs.get(row.get("program_id", ""), {})
        pid = row.get("program_id", "")
        manual(row, kind="course", title=program.get("name") or row.get("program_name") or "Course payment",
               recipient=program.get("teacher_name") or "Course provider",
               href=f"/app/programs/{pid}" if row.get("user_id") == uid else f"/app/teach/{pid}?tab=learners")
    sessions = await db["mentorship_requests"].find({
        "$or": [{"user_id": uid}, {"owner_id": uid}], "payment.amount_minor": {"$gt": 0},
    }).sort("updated_at", -1).to_list(500)
    for row in sessions:
        manual(row, kind="mentoring", title=f"Mentoring with {row.get('mentor_name') or 'your mentor'}",
               recipient=row.get("mentor_name") or "Mentor",
               href="/app/mentors" if row.get("user_id") == uid else "/app/mentoring")
    # Preserve older payment history without offering the gateway or inventing a UPI confirmation.
    for row in await _orders().find({"user_id": uid}).sort("created_at", -1).to_list(200):
        items.append({
            "id": f"legacy:{row['_id']}", "kind": "legacy", "direction": "sent", "title": row.get("title") or "Earlier payment record",
            "recipient": "Earlier platform record", "amount_minor": int(row.get("amount_minor") or 0),
            "status": row.get("status", "created"), "reference": "", "note": "", "submitted_at": "", "confirmed_at": iso(row.get("paid_at")),
            "updated_at": iso(row.get("updated_at") or row.get("created_at")), "method": row.get("method", ""), "legacy": True, "currency": row.get("currency") or settings.PAYMENT_CURRENCY.upper(),
            "href": f"/app/programs/{row['reference_id']}" if row.get("purpose") == "program" else "/app/bookings",
        })
    items.sort(key=lambda row: row["updated_at"], reverse=True)
    return {"items": items, "currency": settings.PAYMENT_CURRENCY.upper(), "mode": "direct_upi", "limit_per_source": 500}
