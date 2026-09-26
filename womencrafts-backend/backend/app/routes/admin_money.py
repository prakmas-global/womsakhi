"""
Staff side of money: payment orders, refunds, withdrawals, the ledger, payout
accounts and referrals.

── The platform holds no money ───────────────────────────────────────────────
Nothing in this file moves a rupee. The organisation is not licensed for
custody, and the screens say so in plain words. Concretely:

  * A REFUND is a request to the payment provider (the sandbox today). The
    provider moves the money; this file records that it was asked to.
  * "MARK PAID" on a withdrawal records a transfer the organisation already
    made from its own bank — the UTR / reference is the evidence. It does not
    trigger a transfer, and it cannot.
  * "MARK FAILED" restores her balance by writing a reversing CREDIT row
    (`source="payout_reversal"`). The ledger is append-only: nothing here
    edits or deletes a wallet row.
  * A MANUAL ADJUSTMENT is a ledger correction with a mandatory reason, and
    the reason is what the audit row carries.

── Why the two staff endpoints moved here from payments.py ───────────────────
`GET /payments/admin/orders` and `POST /payments/admin/orders/{id}/refund`
were guarded by `require_staff` only — any staff account, whatever its role,
could refund any payment, and nothing was written to the audit trail. They now
live here under `money.view` / `money.approve` with an audit record, and the
old paths are gone.

── Every endpoint names its action, every write is audited ───────────────────
`main.py` gates the whole router on the "money" module; each endpoint adds
the action (`money.view`, `.edit`, `.approve`, `.export`). Every POST/PUT
calls `record(...)` after the write succeeds, with the human reason where
there is one.

── What is never exposed ─────────────────────────────────────────────────────
A payout account's full number is not stored (see models/payout.py), and this
file only ever sends `PayoutAccountModel.to_response`, i.e. the masked form.
A member's row here is her name and avatar — not her email, phone or vault.
"""

import asyncio
import csv
import io
from datetime import datetime, timedelta, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, Field

from app.core import mongosafe
from app.core.audit import record
from app.core.config import settings
from app.core.deps import get_current_user
from app.core.media import media_url
from app.core.payments import get_provider
from app.core.permissions import require_permission
from app.core.serializers import aware, page_meta, to_object_id
from app.db.mongodb import get_database
from app.models.conversation import MemberNotificationModel, notify
from app.models.member import MemberModel
from app.models.org import OrgSettingsModel
from app.models.payment import OrderModel, RefundModel
from app.models.payout import PayoutAccountModel
from app.models.user import UserModel
from app.models.verification import VerificationStatus
from app.models.wallet import WalletTxnModel
from app.routes.wallet import balance_minor, symbol

router = APIRouter(prefix="/admin/money", tags=["Money & Payouts (staff)"])

#: A withdrawal row's lifecycle on the staff side. Absent means pending: the
#: member-side write in payout.py does not set it, and the one real pending
#: row predates this file.
PAYOUT_PENDING = "pending"
PAYOUT_PAID = "paid"
PAYOUT_FAILED = "failed"

SOURCE_PAYOUT = "payout"
SOURCE_PAYOUT_REVERSAL = "payout_reversal"
SOURCE_ADJUSTMENT = "adjustment"

#: When a referral earns its reward.
REFERRAL_CONDITIONS = ("joined", "signed_up")


# --- collections -------------------------------------------------------------

def _orders():
    return get_database()[OrderModel.collection_name]


def _refunds():
    return get_database()[RefundModel.collection_name]


def _txns():
    return get_database()[WalletTxnModel.collection_name]


def _accounts():
    return get_database()[PayoutAccountModel.collection_name]


def _users():
    return get_database()[UserModel.collection_name]


def _members():
    return get_database()[MemberModel.collection_name]


def _org():
    return get_database()[OrgSettingsModel.collection_name]


# --- small helpers -----------------------------------------------------------

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(when) -> str:
    got = aware(when) if isinstance(when, datetime) else None
    return got.isoformat() if got else ""


def _money(minor: int) -> str:
    return f"{symbol()}{int(minor) / 100:,.2f}"


def _who(me: dict) -> str:
    return me.get("full_name", "") or me.get("email", "")


def _parse_day(raw: str, *, end: bool = False) -> Optional[datetime]:
    """'2026-09-01' → an aware datetime; the end of that day when `end`."""
    raw = (raw or "").strip()
    if not raw:
        return None
    try:
        got = datetime.fromisoformat(raw[:19].replace("Z", ""))
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Not a date: {raw}")
    if got.tzinfo is None:
        got = got.replace(tzinfo=timezone.utc)
    if end and len(raw) <= 10:
        got = got + timedelta(days=1) - timedelta(microseconds=1)
    return got


def _date_filter(from_: str, to: str, field: str = "created_at") -> dict:
    lo, hi = _parse_day(from_), _parse_day(to, end=True)
    if not lo and not hi:
        return {}
    span: dict = {}
    if lo:
        span["$gte"] = lo
    if hi:
        span["$lte"] = hi
    return {field: span}


def _csv_response(rows: list[list], filename: str) -> Response:
    buf = io.StringIO()
    csv.writer(buf).writerows(rows)
    return Response(
        content=buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


async def _people(user_ids: list[str]) -> dict[str, dict]:
    """Name and avatar for a set of user ids — nothing else about her."""
    oids = [ObjectId(u) for u in set(user_ids) if u and ObjectId.is_valid(u)]
    if not oids:
        return {}
    rows = await _users().find(
        {"_id": {"$in": oids}}, {"full_name": 1, "avatar": 1, "member_id": 1},
    ).to_list(len(oids))
    return {
        str(r["_id"]): {
            "user_id": str(r["_id"]),
            "name": r.get("full_name", "") or "Member",
            "avatar": media_url(r.get("avatar", "")),
            "member_id": r.get("member_id") or "",
        }
        for r in rows
    }


def _nobody(user_id: str) -> dict:
    return {"user_id": user_id, "name": "Account removed", "avatar": "", "member_id": ""}


async def _user_ids_named(q: str) -> list[str]:
    """User ids whose name or email matches — so a list can be searched by person."""
    rows = await _users().find(
        mongosafe.any_of(q, ["full_name", "email"]), {"_id": 1},
    ).to_list(100)
    return [str(r["_id"]) for r in rows]


async def _member_of(user_id: str) -> dict:
    user = await _users().find_one({"_id": to_object_id(user_id)})
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    return user


def _provider_note() -> dict:
    provider = get_provider()
    return {
        "provider": provider.name,
        "sandbox": provider.name.lower() == "sandbox",
        "currency": settings.PAYMENT_CURRENCY.upper(),
    }


# =============================================================================
# 1. Payments
# =============================================================================

def _order_out(doc: dict, people: dict[str, dict], refunds: Optional[list[dict]] = None) -> dict:
    out = OrderModel.to_response(doc)
    out["user_id"] = doc.get("user_id", "")
    out["member"] = people.get(doc.get("user_id", ""), _nobody(doc.get("user_id", "")))
    out["refunded_label"] = OrderModel.money(int(doc.get("refunded_minor") or 0), doc.get("currency", "INR"))
    out["provider_payment_id"] = doc.get("provider_payment_id", "")
    out["paid_at"] = _iso(doc.get("paid_at"))
    out["updated_at"] = _iso(doc.get("updated_at"))
    out["refundable_minor"] = (
        max(int(doc.get("amount_minor") or 0) - int(doc.get("refunded_minor") or 0), 0)
        if doc.get("status") == OrderModel.STATUS_PAID else 0
    )
    if refunds is not None:
        out["refunds"] = [
            {**RefundModel.to_response(r), "created_at": _iso(r.get("created_at"))}
            for r in refunds
        ]
    return out


async def _orders_query(status_filter: str, q: str, from_: str, to: str) -> dict:
    clauses: list[dict] = []
    if status_filter and status_filter != "all":
        clauses.append({"status": status_filter})
    span = _date_filter(from_, to)
    if span:
        clauses.append(span)
    if q.strip():
        ids = await _user_ids_named(q)
        text = mongosafe.any_of(q, ["title", "provider_order_id", "provider_payment_id", "reference_id"])
        clauses.append({"$or": [text, {"user_id": {"$in": ids}}] if ids else [text]})
    if not clauses:
        return {}
    return {"$and": clauses} if len(clauses) > 1 else clauses[0]


@router.get(
    "/orders",
    summary="Every payment, paged",
    dependencies=[Depends(require_permission("money.view"))],
)
async def list_orders(
    status_filter: str = Query("all", alias="status", max_length=20),
    q: str = Query("", max_length=80),
    from_: str = Query("", alias="from", max_length=32),
    to: str = Query("", max_length=32),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=5, le=50),
):
    query = await _orders_query(status_filter, q, from_, to)
    total, rows = await asyncio.gather(
        _orders().count_documents(query),
        _orders().find(query).sort("created_at", -1)
        .skip((page - 1) * page_size).limit(page_size).to_list(page_size),
    )
    people = await _people([r.get("user_id", "") for r in rows])
    return {
        "orders": [_order_out(r, people) for r in rows],
        "pagination": page_meta(total, page, page_size),
        **_provider_note(),
    }


@router.get(
    "/orders/summary",
    summary="Counts and sums by status",
    dependencies=[Depends(require_permission("money.view"))],
)
async def orders_summary():
    by_status, refunds, last30 = await asyncio.gather(
        _orders().aggregate([
            {"$group": {"_id": "$status", "count": {"$sum": 1}, "amount_minor": {"$sum": "$amount_minor"},
                        "refunded_minor": {"$sum": {"$ifNull": ["$refunded_minor", 0]}}}},
        ]).to_list(20),
        _refunds().aggregate([
            {"$group": {"_id": None, "count": {"$sum": 1}, "amount_minor": {"$sum": "$amount_minor"}}},
        ]).to_list(1),
        _orders().aggregate([
            {"$match": {"status": {"$in": [OrderModel.STATUS_PAID, OrderModel.STATUS_REFUNDED]},
                        "paid_at": {"$gte": _now() - timedelta(days=30)}}},
            {"$group": {"_id": None, "count": {"$sum": 1}, "amount_minor": {"$sum": "$amount_minor"}}},
        ]).to_list(1),
    )
    statuses = {
        r["_id"] or "created": {
            "count": int(r["count"]),
            "amount_minor": int(r["amount_minor"] or 0),
            "refunded_minor": int(r.get("refunded_minor") or 0),
        }
        for r in by_status
    }
    for s in (OrderModel.STATUS_CREATED, OrderModel.STATUS_PAID, OrderModel.STATUS_FAILED,
              OrderModel.STATUS_REFUNDED, OrderModel.STATUS_CANCELLED):
        statuses.setdefault(s, {"count": 0, "amount_minor": 0, "refunded_minor": 0})
    # Money that actually arrived: paid + (fully) refunded orders' gross, less
    # everything sent back.
    gross = statuses[OrderModel.STATUS_PAID]["amount_minor"] + statuses[OrderModel.STATUS_REFUNDED]["amount_minor"]
    refunded = int(refunds[0]["amount_minor"]) if refunds else 0
    return {
        "total": sum(v["count"] for v in statuses.values()),
        "by_status": statuses,
        "gross_minor": gross,
        "refunded_minor": refunded,
        "refund_count": int(refunds[0]["count"]) if refunds else 0,
        "net_minor": max(gross - refunded, 0),
        "last_30_days": {
            "count": int(last30[0]["count"]) if last30 else 0,
            "amount_minor": int(last30[0]["amount_minor"]) if last30 else 0,
        },
        **_provider_note(),
    }


@router.get(
    "/orders/export.csv",
    summary="The filtered payments as CSV",
    dependencies=[Depends(require_permission("money.export"))],
)
async def export_orders(
    status_filter: str = Query("all", alias="status", max_length=20),
    q: str = Query("", max_length=80),
    from_: str = Query("", alias="from", max_length=32),
    to: str = Query("", max_length=32),
):
    query = await _orders_query(status_filter, q, from_, to)
    rows = await _orders().find(query).sort("created_at", -1).to_list(5000)
    people = await _people([r.get("user_id", "") for r in rows])
    out: list[list] = [[
        "order_id", "created_at", "member", "title", "purpose", "status", "amount",
        "refunded", "currency", "method", "provider", "provider_order_id",
        "provider_payment_id", "paid_at", "failure_reason",
    ]]
    for r in rows:
        out.append([
            str(r["_id"]), _iso(r.get("created_at")),
            people.get(r.get("user_id", ""), {}).get("name", ""),
            r.get("title", ""), r.get("purpose", ""), r.get("status", ""),
            f"{int(r.get('amount_minor') or 0) / 100:.2f}",
            f"{int(r.get('refunded_minor') or 0) / 100:.2f}",
            r.get("currency", "INR"), r.get("method", ""), r.get("provider", ""),
            r.get("provider_order_id", ""), r.get("provider_payment_id", ""),
            _iso(r.get("paid_at")), r.get("failure_reason", ""),
        ])
    return _csv_response(out, "payments.csv")


@router.get(
    "/orders/{order_id}",
    summary="One payment, with its refunds",
    dependencies=[Depends(require_permission("money.view"))],
)
async def one_order(order_id: str):
    order = await _orders().find_one({"_id": to_object_id(order_id)})
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    people, refunds = await asyncio.gather(
        _people([order.get("user_id", "")]),
        _refunds().find({"order_id": str(order["_id"])}).sort("created_at", -1).to_list(50),
    )
    return {**_order_out(order, people, refunds), **_provider_note()}


class RefundBody(BaseModel):
    # None = the remaining balance in full.
    amount_minor: Optional[int] = Field(None, ge=1)
    reason: str = Field(..., min_length=3, max_length=400)


@router.post(
    "/orders/{order_id}/refund",
    summary="Ask the provider to refund a payment",
    dependencies=[Depends(require_permission("money.approve"))],
)
async def refund_order(
    order_id: str,
    body: RefundBody,
    request: Request,
    me: dict = Depends(get_current_user),
):
    """
    The provider moves the money; this records that it was asked to. Moved
    here from payments.py, where any staff account could do it unaudited.
    """
    order = await _orders().find_one({"_id": to_object_id(order_id)})
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    if order.get("status") != OrderModel.STATUS_PAID:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only a paid order can be refunded")

    paid = int(order["amount_minor"])
    already = int(order.get("refunded_minor") or 0)
    amount = body.amount_minor or (paid - already)
    if amount <= 0 or already + amount > paid:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Refund exceeds what was paid")

    provider = get_provider()
    result = await provider.refund(order.get("provider_payment_id", ""), amount)

    doc = RefundModel.create_document(
        order_id=str(order["_id"]),
        user_id=order["user_id"],
        amount_minor=amount,
        reason=body.reason.strip(),
        provider_refund_id=result.provider_refund_id,
        status=result.status,
        by_name=_who(me),
    )
    doc["by_id"] = str(me.get("_id", ""))
    inserted = await _refunds().insert_one(doc)
    doc["_id"] = inserted.inserted_id

    total_refunded = already + amount
    fresh = await _orders().find_one_and_update(
        {"_id": order["_id"]},
        {"$set": {
            "refunded_minor": total_refunded,
            "status": OrderModel.STATUS_REFUNDED if total_refunded >= paid else OrderModel.STATUS_PAID,
            "updated_at": _now(),
        }},
        return_document=True,
    )
    await record(
        me, "money.refund", target=str(order["_id"]),
        detail=(
            f"Refunded {OrderModel.money(amount, order.get('currency', 'INR'))} of "
            f"{OrderModel.money(paid, order.get('currency', 'INR'))} for “{order.get('title', '')}” "
            f"via {provider.name} — {body.reason.strip()}"
        ),
        request=request,
    )
    await notify(
        get_database(), order["user_id"],
        title="Refund issued",
        body=f"{OrderModel.money(amount, order.get('currency', 'INR'))} for {order.get('title', '')}.",
        ntype=MemberNotificationModel.TYPE_ACCOUNT,
        href="/app/bookings",
    )
    people = await _people([order.get("user_id", "")])
    refunds = await _refunds().find({"order_id": str(order["_id"])}).sort("created_at", -1).to_list(50)
    return {
        "refund": {**RefundModel.to_response(doc), "created_at": _iso(doc.get("created_at"))},
        "order": _order_out(fresh or order, people, refunds),
    }


# =============================================================================
# 2. Withdrawals
# =============================================================================

_PENDING_CLAUSE = {"$or": [{"payout_status": {"$exists": False}}, {"payout_status": PAYOUT_PENDING}]}


def _withdrawal_status(doc: dict) -> str:
    return doc.get("payout_status") or PAYOUT_PENDING


async def _withdrawals_query(status_filter: str, q: str, from_: str, to: str) -> dict:
    clauses: list[dict] = [{"kind": WalletTxnModel.KIND_DEBIT, "source": SOURCE_PAYOUT}]
    if status_filter == PAYOUT_PENDING:
        clauses.append(_PENDING_CLAUSE)
    elif status_filter in (PAYOUT_PAID, PAYOUT_FAILED):
        clauses.append({"payout_status": status_filter})
    span = _date_filter(from_, to)
    if span:
        clauses.append(span)
    if q.strip():
        ids = await _user_ids_named(q)
        text = mongosafe.any_of(q, ["label", "payout_utr"])
        clauses.append({"$or": [text, {"user_id": {"$in": ids}}] if ids else [text]})
    return {"$and": clauses}


async def _withdrawal_rows(rows: list[dict]) -> list[dict]:
    people, accounts = await asyncio.gather(
        _people([r.get("user_id", "") for r in rows]),
        _accounts().find({"_id": {"$in": [
            ObjectId(r["reference_id"]) for r in rows
            if r.get("reference_id") and ObjectId.is_valid(r["reference_id"])
        ]}}).to_list(len(rows) or 1),
    )
    by_account = {str(a["_id"]): PayoutAccountModel.to_response(a) for a in accounts}
    out = []
    for r in rows:
        minor = int(r.get("amount_minor") or 0)
        out.append({
            "id": str(r["_id"]),
            "user_id": r.get("user_id", ""),
            "member": people.get(r.get("user_id", ""), _nobody(r.get("user_id", ""))),
            "amount_minor": minor,
            "amount_label": _money(minor),
            "label": r.get("label", ""),
            # Masked, always — see the module note.
            "account": by_account.get(r.get("reference_id", "")),
            "requested_at": _iso(r.get("created_at")),
            "payout_status": _withdrawal_status(r),
            "utr": r.get("payout_utr", ""),
            "paid_at": _iso(r.get("payout_paid_at")),
            "paid_by": r.get("payout_paid_by", ""),
            "note": r.get("payout_note", ""),
            "failed_reason": r.get("payout_failed_reason", ""),
            "failed_at": _iso(r.get("payout_failed_at")),
            "failed_by": r.get("payout_failed_by", ""),
            "reversal_id": r.get("payout_reversal_id", ""),
        })
    return out


@router.get(
    "/withdrawals",
    summary="Withdrawal requests, paged",
    dependencies=[Depends(require_permission("money.view"))],
)
async def list_withdrawals(
    status_filter: str = Query(PAYOUT_PENDING, alias="status", max_length=20),
    q: str = Query("", max_length=80),
    from_: str = Query("", alias="from", max_length=32),
    to: str = Query("", max_length=32),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=5, le=50),
):
    query = await _withdrawals_query(status_filter, q, from_, to)
    total, rows = await asyncio.gather(
        _txns().count_documents(query),
        _txns().find(query).sort("created_at", -1)
        .skip((page - 1) * page_size).limit(page_size).to_list(page_size),
    )
    return {
        "withdrawals": await _withdrawal_rows(rows),
        "pagination": page_meta(total, page, page_size),
    }


@router.get(
    "/withdrawals/summary",
    summary="Pending, paid and failed — counts and sums",
    dependencies=[Depends(require_permission("money.view"))],
)
async def withdrawals_summary():
    rows = await _txns().aggregate([
        {"$match": {"kind": WalletTxnModel.KIND_DEBIT, "source": SOURCE_PAYOUT}},
        {"$group": {
            "_id": {"$ifNull": ["$payout_status", PAYOUT_PENDING]},
            "count": {"$sum": 1}, "amount_minor": {"$sum": "$amount_minor"},
        }},
    ]).to_list(10)
    out = {s: {"count": 0, "amount_minor": 0} for s in (PAYOUT_PENDING, PAYOUT_PAID, PAYOUT_FAILED)}
    for r in rows:
        out[r["_id"] or PAYOUT_PENDING] = {"count": int(r["count"]), "amount_minor": int(r["amount_minor"] or 0)}
    oldest = await _txns().find_one(
        {"kind": WalletTxnModel.KIND_DEBIT, "source": SOURCE_PAYOUT, **_PENDING_CLAUSE},
        sort=[("created_at", 1)],
    )
    return {
        "by_status": out,
        "oldest_pending_at": _iso(oldest.get("created_at")) if oldest else "",
        "currency": settings.PAYMENT_CURRENCY.upper(),
    }


@router.get(
    "/withdrawals/export.csv",
    summary="The filtered withdrawals as CSV",
    dependencies=[Depends(require_permission("money.export"))],
)
async def export_withdrawals(
    status_filter: str = Query("all", alias="status", max_length=20),
    q: str = Query("", max_length=80),
    from_: str = Query("", alias="from", max_length=32),
    to: str = Query("", max_length=32),
):
    query = await _withdrawals_query(status_filter, q, from_, to)
    rows = await _withdrawal_rows(await _txns().find(query).sort("created_at", -1).to_list(5000))
    out: list[list] = [[
        "withdrawal_id", "requested_at", "member", "amount", "account", "holder",
        "status", "utr", "paid_at", "paid_by", "failed_reason", "failed_at",
    ]]
    for r in rows:
        acct = r["account"] or {}
        out.append([
            r["id"], r["requested_at"], r["member"]["name"], f"{r['amount_minor'] / 100:.2f}",
            f"{acct.get('kind', '')} {acct.get('detail', '')}".strip() if acct else "removed",
            acct.get("holder", ""), r["payout_status"], r["utr"], r["paid_at"], r["paid_by"],
            r["failed_reason"], r["failed_at"],
        ])
    return _csv_response(out, "withdrawals.csv")


async def _pending_withdrawal(txn_id: str) -> dict:
    txn = await _txns().find_one({"_id": to_object_id(txn_id), "kind": WalletTxnModel.KIND_DEBIT,
                                  "source": SOURCE_PAYOUT})
    if not txn:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Withdrawal not found")
    if _withdrawal_status(txn) != PAYOUT_PENDING:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"This withdrawal was already marked {_withdrawal_status(txn)}",
        )
    return txn


class MarkPaidBody(BaseModel):
    utr: str = Field(..., min_length=4, max_length=80)
    paid_at: str = Field("", max_length=32)
    note: str = Field("", max_length=300)


@router.post(
    "/withdrawals/{txn_id}/mark-paid",
    summary="Record a bank transfer the organisation made",
    dependencies=[Depends(require_permission("money.approve"))],
)
async def mark_withdrawal_paid(
    txn_id: str,
    body: MarkPaidBody,
    request: Request,
    me: dict = Depends(get_current_user),
):
    """Records; moves nothing. The UTR is the evidence the transfer happened."""
    txn = await _pending_withdrawal(txn_id)
    paid_at = _parse_day(body.paid_at) or _now()
    await _txns().update_one(
        {"_id": txn["_id"], **_PENDING_CLAUSE},
        {"$set": {
            "payout_status": PAYOUT_PAID,
            "payout_utr": body.utr.strip(),
            "payout_paid_at": paid_at,
            "payout_paid_by": _who(me),
            "payout_paid_by_id": str(me.get("_id", "")),
            "payout_note": body.note.strip(),
            "payout_updated_at": _now(),
        }},
    )
    amount = _money(int(txn.get("amount_minor") or 0))
    await record(
        me, "money.withdrawal.paid", target=str(txn["_id"]),
        detail=f"Recorded {amount} paid out (UTR {body.utr.strip()})"
               + (f" — {body.note.strip()}" if body.note.strip() else ""),
        request=request,
    )
    await notify(
        get_database(), txn["user_id"],
        title="Your withdrawal was sent",
        body=f"{amount} has been transferred. Bank reference: {body.utr.strip()}.",
        ntype=MemberNotificationModel.TYPE_ACCOUNT,
        href="/app/earn",
    )
    rows = await _withdrawal_rows([await _txns().find_one({"_id": txn["_id"]})])
    return rows[0]


class MarkFailedBody(BaseModel):
    reason: str = Field(..., min_length=5, max_length=400)


@router.post(
    "/withdrawals/{txn_id}/mark-failed",
    summary="Record a failed transfer and restore her balance",
    dependencies=[Depends(require_permission("money.approve"))],
)
async def mark_withdrawal_failed(
    txn_id: str,
    body: MarkFailedBody,
    request: Request,
    me: dict = Depends(get_current_user),
):
    """
    The ledger is append-only, so her balance comes back as a reversing
    CREDIT row rather than by deleting the debit — the failed attempt stays
    on record with its reason.
    """
    txn = await _pending_withdrawal(txn_id)
    reason = body.reason.strip()
    reversal = WalletTxnModel.create_document(
        user_id=txn["user_id"], member_id=txn.get("member_id", ""),
        kind=WalletTxnModel.KIND_CREDIT, amount_minor=int(txn.get("amount_minor") or 0),
        source=SOURCE_PAYOUT_REVERSAL,
        label=f"Withdrawal returned — {reason}",
        reference_id=str(txn["_id"]),
    )
    reversal["reversed_by"] = _who(me)
    reversal["reversed_by_id"] = str(me.get("_id", ""))
    inserted = await _txns().insert_one(reversal)
    await _txns().update_one(
        {"_id": txn["_id"]},
        {"$set": {
            "payout_status": PAYOUT_FAILED,
            "payout_failed_reason": reason,
            "payout_failed_at": _now(),
            "payout_failed_by": _who(me),
            "payout_failed_by_id": str(me.get("_id", "")),
            "payout_reversal_id": str(inserted.inserted_id),
            "payout_updated_at": _now(),
        }},
    )
    amount = _money(int(txn.get("amount_minor") or 0))
    await record(
        me, "money.withdrawal.failed", target=str(txn["_id"]),
        detail=f"Marked {amount} withdrawal failed and restored her balance — {reason}",
        request=request,
    )
    await notify(
        get_database(), txn["user_id"],
        title="Your withdrawal could not be sent",
        body=f"{amount} is back in your balance. Reason: {reason}",
        ntype=MemberNotificationModel.TYPE_ACCOUNT,
        href="/app/earn",
    )
    rows = await _withdrawal_rows([await _txns().find_one({"_id": txn["_id"]})])
    return rows[0]


# =============================================================================
# 3. Ledger
# =============================================================================

def _txn_out(doc: dict, people: dict[str, dict]) -> dict:
    out = WalletTxnModel.to_response(doc, symbol())
    out["user_id"] = doc.get("user_id", "")
    out["member"] = people.get(doc.get("user_id", ""), _nobody(doc.get("user_id", "")))
    out["reference_id"] = doc.get("reference_id", "")
    out["created_at"] = _iso(doc.get("created_at"))
    out["payout_status"] = doc.get("payout_status", "") if doc.get("source") == SOURCE_PAYOUT else ""
    out["by"] = doc.get("adjusted_by") or doc.get("reversed_by") or doc.get("credited_by") or ""
    out["reason"] = doc.get("reason", "")
    return out


async def _ledger_query(user_id: str, kind: str, source: str, q: str, from_: str, to: str) -> dict:
    clauses: list[dict] = []
    if user_id:
        clauses.append({"user_id": user_id})
    if kind in (WalletTxnModel.KIND_CREDIT, WalletTxnModel.KIND_DEBIT):
        clauses.append({"kind": kind})
    if source and source != "all":
        clauses.append({"source": source})
    span = _date_filter(from_, to)
    if span:
        clauses.append(span)
    if q.strip():
        ids = await _user_ids_named(q)
        text = mongosafe.any_of(q, ["label", "reference_id"])
        clauses.append({"$or": [text, {"user_id": {"$in": ids}}] if ids else [text]})
    if not clauses:
        return {}
    return {"$and": clauses} if len(clauses) > 1 else clauses[0]


@router.get(
    "/ledger",
    summary="Every wallet transaction, paged",
    dependencies=[Depends(require_permission("money.view"))],
)
async def list_ledger(
    user_id: str = Query("", max_length=40),
    kind: str = Query("", max_length=10),
    source: str = Query("all", max_length=40),
    q: str = Query("", max_length=80),
    from_: str = Query("", alias="from", max_length=32),
    to: str = Query("", max_length=32),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=5, le=50),
):
    query = await _ledger_query(user_id, kind, source, q, from_, to)
    total, rows = await asyncio.gather(
        _txns().count_documents(query),
        _txns().find(query).sort("created_at", -1)
        .skip((page - 1) * page_size).limit(page_size).to_list(page_size),
    )
    people = await _people([r.get("user_id", "") for r in rows])
    return {
        "transactions": [_txn_out(r, people) for r in rows],
        "pagination": page_meta(total, page, page_size),
        "currency": settings.PAYMENT_CURRENCY.upper(),
    }


@router.get(
    "/ledger/summary",
    summary="Credits, debits and the split by source",
    dependencies=[Depends(require_permission("money.view"))],
)
async def ledger_summary():
    by_kind, by_source, holders = await asyncio.gather(
        _txns().aggregate([
            {"$group": {"_id": "$kind", "count": {"$sum": 1}, "amount_minor": {"$sum": "$amount_minor"}}},
        ]).to_list(5),
        _txns().aggregate([
            {"$group": {"_id": {"source": "$source", "kind": "$kind"},
                        "count": {"$sum": 1}, "amount_minor": {"$sum": "$amount_minor"}}},
            {"$sort": {"amount_minor": -1}},
        ]).to_list(50),
        _txns().aggregate([
            {"$group": {"_id": "$user_id", "net": {"$sum": {
                "$cond": [{"$eq": ["$kind", WalletTxnModel.KIND_CREDIT]}, "$amount_minor",
                          {"$multiply": ["$amount_minor", -1]}]}}}},
            {"$match": {"net": {"$gt": 0}}},
            {"$group": {"_id": None, "members": {"$sum": 1}, "held_minor": {"$sum": "$net"}}},
        ]).to_list(1),
    )
    kinds = {r["_id"]: {"count": int(r["count"]), "amount_minor": int(r["amount_minor"] or 0)} for r in by_kind}
    credits = kinds.get(WalletTxnModel.KIND_CREDIT, {"count": 0, "amount_minor": 0})
    debits = kinds.get(WalletTxnModel.KIND_DEBIT, {"count": 0, "amount_minor": 0})
    return {
        "credits": credits,
        "debits": debits,
        "net_minor": credits["amount_minor"] - debits["amount_minor"],
        "members_with_balance": int(holders[0]["members"]) if holders else 0,
        "held_minor": int(holders[0]["held_minor"]) if holders else 0,
        "by_source": [
            {"source": r["_id"].get("source") or "other", "kind": r["_id"].get("kind", ""),
             "count": int(r["count"]), "amount_minor": int(r["amount_minor"] or 0)}
            for r in by_source
        ],
        "sources": sorted({(r["_id"].get("source") or "other") for r in by_source}),
        "currency": settings.PAYMENT_CURRENCY.upper(),
    }


@router.get(
    "/ledger/export.csv",
    summary="The filtered ledger as CSV",
    dependencies=[Depends(require_permission("money.export"))],
)
async def export_ledger(
    user_id: str = Query("", max_length=40),
    kind: str = Query("", max_length=10),
    source: str = Query("all", max_length=40),
    q: str = Query("", max_length=80),
    from_: str = Query("", alias="from", max_length=32),
    to: str = Query("", max_length=32),
):
    query = await _ledger_query(user_id, kind, source, q, from_, to)
    rows = await _txns().find(query).sort("created_at", -1).to_list(10000)
    people = await _people([r.get("user_id", "") for r in rows])
    out: list[list] = [["transaction_id", "created_at", "member", "kind", "source", "amount",
                        "label", "reference_id", "by", "reason", "payout_status"]]
    for r in rows:
        out.append([
            str(r["_id"]), _iso(r.get("created_at")),
            people.get(r.get("user_id", ""), {}).get("name", ""),
            r.get("kind", ""), r.get("source", ""),
            f"{int(r.get('amount_minor') or 0) / 100:.2f}", r.get("label", ""),
            r.get("reference_id", ""),
            r.get("adjusted_by") or r.get("reversed_by") or r.get("credited_by") or "",
            r.get("reason", ""), r.get("payout_status", ""),
        ])
    return _csv_response(out, "ledger.csv")


@router.get(
    "/ledger/members/{user_id}",
    summary="One member's balance, summed from her ledger",
    dependencies=[Depends(require_permission("money.view"))],
)
async def member_balance(user_id: str):
    user = await _member_of(user_id)
    uid = str(user["_id"])
    totals, count, last = await asyncio.gather(
        _txns().aggregate([
            {"$match": {"user_id": uid}},
            {"$group": {"_id": "$kind", "total": {"$sum": "$amount_minor"}}},
        ]).to_list(5),
        _txns().count_documents({"user_id": uid}),
        _txns().find_one({"user_id": uid}, sort=[("created_at", -1)]),
    )
    got = {r["_id"]: int(r["total"]) for r in totals}
    credits = got.get(WalletTxnModel.KIND_CREDIT, 0)
    debits = got.get(WalletTxnModel.KIND_DEBIT, 0)
    return {
        "member": (await _people([uid])).get(uid, _nobody(uid)),
        "balance_minor": max(credits - debits, 0),
        "raw_minor": credits - debits,
        "credits_minor": credits,
        "debits_minor": debits,
        "transactions": int(count),
        "last_activity_at": _iso(last.get("created_at")) if last else "",
        "currency": settings.PAYMENT_CURRENCY.upper(),
    }


class AdjustmentBody(BaseModel):
    user_id: str = Field(..., min_length=24, max_length=24)
    kind: str = Field(..., pattern="^(credit|debit)$")
    amount_minor: int = Field(..., ge=1, le=100_000_000)
    reason: str = Field(..., min_length=5, max_length=400)


@router.post(
    "/ledger/adjustments",
    summary="A ledger correction, with the reason on record",
    dependencies=[Depends(require_permission("money.edit"))],
)
async def add_adjustment(
    body: AdjustmentBody,
    request: Request,
    me: dict = Depends(get_current_user),
):
    """A correction to what the ledger says, never a transfer. The reason is
    mandatory and is what the audit row carries."""
    user = await _member_of(body.user_id)
    uid = str(user["_id"])
    reason = body.reason.strip()
    if body.kind == WalletTxnModel.KIND_DEBIT:
        available = await balance_minor(uid)
        if body.amount_minor > available:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"She has {_money(available)}; a debit of {_money(body.amount_minor)} would take her below zero.",
            )
    doc = WalletTxnModel.create_document(
        user_id=uid, member_id=user.get("member_id") or "",
        kind=body.kind, amount_minor=body.amount_minor,
        source=SOURCE_ADJUSTMENT, label=f"Adjustment — {reason}",
    )
    doc["reason"] = reason
    doc["adjusted_by"] = _who(me)
    doc["adjusted_by_id"] = str(me.get("_id", ""))
    inserted = await _txns().insert_one(doc)
    doc["_id"] = inserted.inserted_id
    await record(
        me, "money.adjust", target=uid,
        detail=f"{body.kind.title()} of {_money(body.amount_minor)} to {user.get('full_name', '')}'s ledger — {reason}",
        request=request,
    )
    await notify(
        get_database(), uid,
        title="Your balance was adjusted",
        body=f"{'+' if body.kind == 'credit' else '−'}{_money(body.amount_minor)}: {reason}",
        ntype=MemberNotificationModel.TYPE_ACCOUNT,
        href="/app/earn",
    )
    people = await _people([uid])
    return {
        "transaction": _txn_out(doc, people),
        "balance_minor": await balance_minor(uid),
    }


# =============================================================================
# 4. Payout accounts
# =============================================================================

def _account_out(doc: dict, people: dict[str, dict]) -> dict:
    out = PayoutAccountModel.to_response(doc)   # masked: last four only
    out["user_id"] = doc.get("user_id", "")
    out["member"] = people.get(doc.get("user_id", ""), _nobody(doc.get("user_id", "")))
    out["created_at"] = _iso(doc.get("created_at"))
    out["verified_by"] = doc.get("verified_by", "")
    out["verified_at"] = _iso(doc.get("verified_at"))
    out["unverified_reason"] = doc.get("unverified_reason", "")
    return out


async def _accounts_query(q: str, kind: str, verified: str) -> dict:
    clauses: list[dict] = []
    if kind in PayoutAccountModel.KINDS:
        clauses.append({"kind": kind})
    if verified == "yes":
        clauses.append({"verified": True})
    elif verified == "no":
        clauses.append({"verified": {"$ne": True}})
    if q.strip():
        ids = await _user_ids_named(q)
        text = mongosafe.any_of(q, ["label", "holder", "ifsc", "upi_id", "last4"])
        clauses.append({"$or": [text, {"user_id": {"$in": ids}}] if ids else [text]})
    if not clauses:
        return {}
    return {"$and": clauses} if len(clauses) > 1 else clauses[0]


@router.get(
    "/payout-accounts",
    summary="Members' payout accounts, masked, paged",
    dependencies=[Depends(require_permission("money.view"))],
)
async def list_payout_accounts(
    q: str = Query("", max_length=80),
    kind: str = Query("", max_length=10),
    verified: str = Query("all", max_length=5),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=5, le=50),
):
    query = await _accounts_query(q, kind, verified)
    total, rows, counts = await asyncio.gather(
        _accounts().count_documents(query),
        _accounts().find(query).sort("created_at", -1)
        .skip((page - 1) * page_size).limit(page_size).to_list(page_size),
        _accounts().aggregate([
            {"$group": {"_id": {"$eq": ["$verified", True]}, "n": {"$sum": 1}}},
        ]).to_list(2),
    )
    people = await _people([r.get("user_id", "") for r in rows])
    tally = {bool(r["_id"]): int(r["n"]) for r in counts}
    return {
        "accounts": [_account_out(r, people) for r in rows],
        "pagination": page_meta(total, page, page_size),
        "summary": {
            "total": tally.get(True, 0) + tally.get(False, 0),
            "verified": tally.get(True, 0),
            "unverified": tally.get(False, 0),
        },
    }


async def _account_or_404(account_id: str) -> dict:
    doc = await _accounts().find_one({"_id": to_object_id(account_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payout account not found")
    return doc


class VerifyBody(BaseModel):
    note: str = Field("", max_length=300)


@router.post(
    "/payout-accounts/{account_id}/verify",
    summary="Mark an account verified (a ₹1 test transfer landed)",
    dependencies=[Depends(require_permission("money.approve"))],
)
async def verify_payout_account(
    account_id: str,
    body: VerifyBody,
    request: Request,
    me: dict = Depends(get_current_user),
):
    doc = await _account_or_404(account_id)
    if doc.get("verified"):
        raise HTTPException(status.HTTP_409_CONFLICT, "Already verified")
    fresh = await _accounts().find_one_and_update(
        {"_id": doc["_id"]},
        {"$set": {
            "verified": True, "verified_by": _who(me), "verified_by_id": str(me.get("_id", "")),
            "verified_at": _now(), "verified_note": body.note.strip(),
            "unverified_reason": "", "updated_at": _now(),
        }},
        return_document=True,
    )
    masked = PayoutAccountModel.to_response(fresh)
    await record(
        me, "money.payout_account.verify", target=str(doc["_id"]),
        detail=f"Verified {masked['kind']} account {masked['detail']} ({masked['label']})"
               + (f" — {body.note.strip()}" if body.note.strip() else ""),
        request=request,
    )
    await notify(
        get_database(), doc["user_id"],
        title="Your payout account is verified",
        body=f"{masked['label']} {masked['detail']} is ready for withdrawals.",
        ntype=MemberNotificationModel.TYPE_ACCOUNT,
        href="/app/earn",
    )
    return _account_out(fresh, await _people([doc["user_id"]]))


class UnverifyBody(BaseModel):
    reason: str = Field(..., min_length=3, max_length=300)


@router.post(
    "/payout-accounts/{account_id}/unverify",
    summary="Withdraw verification, with a reason",
    dependencies=[Depends(require_permission("money.approve"))],
)
async def unverify_payout_account(
    account_id: str,
    body: UnverifyBody,
    request: Request,
    me: dict = Depends(get_current_user),
):
    doc = await _account_or_404(account_id)
    if not doc.get("verified"):
        raise HTTPException(status.HTTP_409_CONFLICT, "Not verified")
    fresh = await _accounts().find_one_and_update(
        {"_id": doc["_id"]},
        {"$set": {
            "verified": False, "verified_by": "", "verified_by_id": "", "verified_at": None,
            "unverified_reason": body.reason.strip(), "unverified_by": _who(me),
            "unverified_at": _now(), "updated_at": _now(),
        }},
        return_document=True,
    )
    masked = PayoutAccountModel.to_response(fresh)
    await record(
        me, "money.payout_account.unverify", target=str(doc["_id"]),
        detail=f"Withdrew verification of {masked['kind']} account {masked['detail']} — {body.reason.strip()}",
        request=request,
    )
    return _account_out(fresh, await _people([doc["user_id"]]))


# =============================================================================
# 5. Referrals
# =============================================================================

_REFERRAL_DEFAULT = {"reward_minor": 0, "condition": "joined", "enabled": False}


async def _referral_config() -> dict:
    doc = await _org().find_one({"singleton": True}, {"referral": 1}) or {}
    cfg = {**_REFERRAL_DEFAULT, **(doc.get("referral") or {})}
    return {
        "reward_minor": int(cfg.get("reward_minor") or 0),
        "reward_label": _money(int(cfg.get("reward_minor") or 0)),
        "condition": cfg.get("condition") if cfg.get("condition") in REFERRAL_CONDITIONS else "joined",
        "enabled": bool(cfg.get("enabled")),
        "updated_at": _iso(cfg.get("updated_at")),
        "updated_by": cfg.get("updated_by", ""),
    }


@router.get(
    "/referrals/config",
    summary="The referral reward, as configured",
    dependencies=[Depends(require_permission("money.view"))],
)
async def referral_config():
    return await _referral_config()


class ReferralConfigBody(BaseModel):
    reward_minor: int = Field(..., ge=0, le=10_000_000)
    condition: str = Field("joined", pattern="^(joined|signed_up)$")
    enabled: bool = False


@router.put(
    "/referrals/config",
    summary="Set the referral reward",
    dependencies=[Depends(require_permission("money.edit"))],
)
async def set_referral_config(
    body: ReferralConfigBody,
    request: Request,
    me: dict = Depends(get_current_user),
):
    if body.enabled and body.reward_minor <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Set a reward before switching referrals on")
    now = _now()
    await _org().update_one(
        {"singleton": True},
        {"$set": {
            "referral": {
                "reward_minor": body.reward_minor, "condition": body.condition,
                "enabled": body.enabled, "updated_at": now, "updated_by": _who(me),
            },
            "updated_at": now,
        }, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    await record(
        me, "money.referral.config", target="org_settings",
        detail=(
            f"Referral reward set to {_money(body.reward_minor)} per "
            f"{'admitted member' if body.condition == 'joined' else 'sign-up'}, "
            f"{'on' if body.enabled else 'off'}"
        ),
        request=request,
    )
    return await _referral_config()


async def _referrers_for(codes: list[str]) -> dict[str, dict]:
    """
    Invite code → the referrer's person block.

    A code is the member row's `code`; the account behind it is the user whose
    `member_id` points at that row. Two queries, both `$in`.
    """
    wanted = [c for c in set(codes) if c]
    if not wanted:
        return {}
    members = await _members().find({"code": {"$in": wanted}}, {"code": 1}).to_list(len(wanted))
    by_member_id = {str(m["_id"]): m.get("code", "") for m in members}
    if not by_member_id:
        return {}
    users = await _users().find(
        {"member_id": {"$in": list(by_member_id)}}, {"full_name": 1, "avatar": 1, "member_id": 1},
    ).to_list(len(by_member_id))
    out: dict[str, dict] = {}
    for u in users:
        code = by_member_id.get(u.get("member_id") or "")
        if code:
            out[code] = {
                "user_id": str(u["_id"]),
                "name": u.get("full_name", "") or "Member",
                "avatar": media_url(u.get("avatar", "")),
                "member_id": u.get("member_id") or "",
                "code": code,
            }
    return out


_REFERRED = {"referred_by": {"$exists": True, "$nin": ["", None]}}


async def _referral_rows(users: list[dict]) -> list[dict]:
    ids = [str(u["_id"]) for u in users]
    referrers, credits = await asyncio.gather(
        _referrers_for([u.get("referred_by", "") for u in users]),
        _txns().find({"source": WalletTxnModel.SOURCE_REFERRAL, "reference_id": {"$in": ids}}).to_list(len(ids) or 1),
    )
    credited = {c["reference_id"]: c for c in credits}
    out = []
    for u in users:
        uid = str(u["_id"])
        credit = credited.get(uid)
        out.append({
            "referred_user_id": uid,
            "referred": {
                "user_id": uid,
                "name": u.get("full_name", "") or "Member",
                "avatar": media_url(u.get("avatar", "")),
                "member_id": u.get("member_id") or "",
            },
            "joined_at": _iso(u.get("created_at")),
            "status": u.get("verification_status", "") or "",
            "admitted": u.get("verification_status") == VerificationStatus.ACTIVE,
            "code": u.get("referred_by", ""),
            "referrer": referrers.get(u.get("referred_by", "")),
            "credited": credit is not None,
            "credited_minor": int(credit.get("amount_minor") or 0) if credit else 0,
            "credited_at": _iso(credit.get("created_at")) if credit else "",
            "credited_by": (credit or {}).get("credited_by", ""),
        })
    return out


@router.get(
    "/referrals",
    summary="Who invited whom, paged",
    dependencies=[Depends(require_permission("money.view"))],
)
async def list_referrals(
    q: str = Query("", max_length=80),
    state: str = Query("all", max_length=12),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=5, le=50),
):
    clauses: list[dict] = [_REFERRED]
    if q.strip():
        clauses.append({"$or": [
            mongosafe.any_of(q, ["full_name", "referred_by"]),
        ]})
    if state == "credited":
        ids = await _txns().distinct("reference_id", {"source": WalletTxnModel.SOURCE_REFERRAL})
        clauses.append({"_id": {"$in": [ObjectId(i) for i in ids if ObjectId.is_valid(i)]}})
    elif state == "uncredited":
        ids = await _txns().distinct("reference_id", {"source": WalletTxnModel.SOURCE_REFERRAL})
        clauses.append({"_id": {"$nin": [ObjectId(i) for i in ids if ObjectId.is_valid(i)]}})
    elif state == "admitted":
        clauses.append({"verification_status": VerificationStatus.ACTIVE})
    query = {"$and": clauses}
    total, rows = await asyncio.gather(
        _users().count_documents(query),
        _users().find(query, {"full_name": 1, "avatar": 1, "member_id": 1, "created_at": 1,
                              "verification_status": 1, "referred_by": 1})
        .sort("created_at", -1).skip((page - 1) * page_size).limit(page_size).to_list(page_size),
    )
    return {
        "referrals": await _referral_rows(rows),
        "pagination": page_meta(total, page, page_size),
    }


@router.get(
    "/referrals/summary",
    summary="Invited, admitted, credited — and the top inviters",
    dependencies=[Depends(require_permission("money.view"))],
)
async def referrals_summary():
    tally, credits, top, cfg = await asyncio.gather(
        _users().aggregate([
            {"$match": _REFERRED},
            {"$group": {"_id": None, "invited": {"$sum": 1}, "joined": {"$sum": {
                "$cond": [{"$eq": ["$verification_status", VerificationStatus.ACTIVE]}, 1, 0]}}}},
        ]).to_list(1),
        _txns().aggregate([
            {"$match": {"source": WalletTxnModel.SOURCE_REFERRAL}},
            {"$group": {"_id": None, "count": {"$sum": 1}, "amount_minor": {"$sum": "$amount_minor"}}},
        ]).to_list(1),
        _users().aggregate([
            {"$match": _REFERRED},
            {"$group": {"_id": "$referred_by", "invited": {"$sum": 1}, "joined": {"$sum": {
                "$cond": [{"$eq": ["$verification_status", VerificationStatus.ACTIVE]}, 1, 0]}}}},
            {"$sort": {"joined": -1, "invited": -1}},
            {"$limit": 5},
        ]).to_list(5),
        _referral_config(),
    )
    referrers = await _referrers_for([t["_id"] for t in top])
    return {
        "invited": int(tally[0]["invited"]) if tally else 0,
        "joined": int(tally[0]["joined"]) if tally else 0,
        "credited": int(credits[0]["count"]) if credits else 0,
        "credited_minor": int(credits[0]["amount_minor"]) if credits else 0,
        "config": cfg,
        "top": [
            {"code": t["_id"], "invited": int(t["invited"]), "joined": int(t["joined"]),
             "referrer": referrers.get(t["_id"])}
            for t in top
        ],
    }


class CreditBody(BaseModel):
    # None = the configured reward.
    amount_minor: Optional[int] = Field(None, ge=1, le=10_000_000)
    note: str = Field("", max_length=300)


@router.post(
    "/referrals/{referred_user_id}/credit",
    summary="Credit the inviter's wallet for this referral",
    dependencies=[Depends(require_permission("money.approve"))],
)
async def credit_referral(
    referred_user_id: str,
    body: CreditBody,
    request: Request,
    me: dict = Depends(get_current_user),
):
    """Idempotent per referred woman: the second click is refused, not paid twice."""
    referred = await _member_of(referred_user_id)
    code = referred.get("referred_by") or ""
    if not code:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nobody invited this member")
    cfg = await _referral_config()
    if cfg["condition"] == "joined" and referred.get("verification_status") != VerificationStatus.ACTIVE:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "She has not been admitted yet — the reward is for admitted members")
    amount = body.amount_minor or cfg["reward_minor"]
    if amount <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Set a reward amount first")
    referrer = (await _referrers_for([code])).get(code)
    if not referrer:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"No member holds the invite code {code}")

    uid = str(referred["_id"])
    already = await _txns().find_one({"source": WalletTxnModel.SOURCE_REFERRAL, "reference_id": uid})
    if already:
        raise HTTPException(status.HTTP_409_CONFLICT, "This referral was already credited")

    doc = WalletTxnModel.create_document(
        user_id=referrer["user_id"], member_id=referrer.get("member_id", ""),
        kind=WalletTxnModel.KIND_CREDIT, amount_minor=int(amount),
        source=WalletTxnModel.SOURCE_REFERRAL,
        label=f"Thank you for inviting {referred.get('full_name', '') or 'a member'}",
        reference_id=uid,
    )
    doc["credited_by"] = _who(me)
    doc["credited_by_id"] = str(me.get("_id", ""))
    doc["note"] = body.note.strip()
    inserted = await _txns().insert_one(doc)
    doc["_id"] = inserted.inserted_id
    # A second request that raced past the check above lands a duplicate; the
    # later of the two is removed so the ledger holds exactly one credit.
    dupes = await _txns().find(
        {"source": WalletTxnModel.SOURCE_REFERRAL, "reference_id": uid}, {"_id": 1},
    ).sort("_id", 1).to_list(5)
    if len(dupes) > 1 and dupes[0]["_id"] != doc["_id"]:
        await _txns().delete_one({"_id": doc["_id"]})
        raise HTTPException(status.HTTP_409_CONFLICT, "This referral was already credited")

    await record(
        me, "money.referral.credit", target=uid,
        detail=f"Credited {_money(int(amount))} to {referrer['name']} for inviting {referred.get('full_name', '')}"
               + (f" — {body.note.strip()}" if body.note.strip() else ""),
        request=request,
    )
    await notify(
        get_database(), referrer["user_id"],
        title="Thank you for inviting a friend",
        body=f"{_money(int(amount))} has been added to your balance.",
        ntype=MemberNotificationModel.TYPE_ACCOUNT,
        href="/app/earn",
    )
    rows = await _referral_rows([referred])
    return rows[0]
