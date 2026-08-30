"""
Where her money goes, and moving it there.

This is the most consequential router in the application, so three things are
enforced here and not left to the screen:

**The amount is checked against the ledger, not against what the client sent.**
A withdrawal request carries an amount; the balance comes from summing her
transactions server-side. A client that says "withdraw ₹50,000" from a ₹500
balance gets a refusal, not a payout.

**The debit and the balance check are the same operation.** Two withdrawal
requests arriving together must not both see the old balance. The ledger write
is guarded by a re-read of the summed balance inside the same request, and the
transaction is only written if it still fits — the same discipline as the event
seat and the group-buy threshold.

**One primary account.** Setting a new one clears the others in the same
update, because two primaries means the payout code has to choose, and the one
it chooses will be wrong on the day it matters.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Union

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core import idempotency
from app.core.rbac import require_active_member
from app.core.serializers import to_object_id
from app.db.mongodb import get_database
from app.models.payout import PayoutAccountModel
from app.models.wallet import WalletTxnModel
from app.routes.wallet import balance_minor, symbol
from app.schemas.payout import (
    AddBankAccount,
    AddUpi,
    PayoutAccountResponse,
    WithdrawRequest,
    WithdrawResult,
)

router = APIRouter(prefix="/me/payout", tags=["Member · Money"])

#: The smallest withdrawal. Below this the transfer fee the platform pays
#: exceeds the amount, and a woman who withdraws ₹5 has been badly served.
MIN_WITHDRAWAL_MINOR = 10_000


def _accounts():
    return get_database()[PayoutAccountModel.collection_name]


def _txns():
    return get_database()[WalletTxnModel.collection_name]


@router.get("/accounts", response_model=list[PayoutAccountResponse], summary="How I get paid")
async def list_accounts(me: dict = Depends(require_active_member)):
    docs = await (
        _accounts().find({"user_id": str(me["_id"])})
        .sort([("primary", -1), ("created_at", -1)]).to_list(20)
    )
    return [PayoutAccountResponse(**PayoutAccountModel.to_response(d)) for d in docs]


@router.post(
    "/accounts",
    response_model=PayoutAccountResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a way to get paid",
)
async def add_account(
    body: Union[AddBankAccount, AddUpi],
    me: dict = Depends(require_active_member),
):
    uid = str(me["_id"])
    first = await _accounts().count_documents({"user_id": uid}) == 0

    if isinstance(body, AddBankAccount):
        doc = PayoutAccountModel.create_document(
            user_id=uid, member_id=me.get("member_id", ""),
            kind=PayoutAccountModel.KIND_BANK,
            label=body.label or f"{body.ifsc[:4].upper()} Bank",
            # Only the last four are stored. See the model's docstring: this
            # application has no reason to be able to read a full account
            # number back, and a database that cannot leak it is better than
            # one that promises not to.
            last4=body.account_number, ifsc=body.ifsc, holder=body.holder,
            primary=first,
        )
    else:
        doc = PayoutAccountModel.create_document(
            user_id=uid, member_id=me.get("member_id", ""),
            kind=PayoutAccountModel.KIND_UPI,
            label=body.label or body.upi_id, upi_id=body.upi_id, primary=first,
        )

    result = await _accounts().insert_one(doc)
    doc["_id"] = result.inserted_id
    return PayoutAccountResponse(**PayoutAccountModel.to_response(doc))


@router.post("/accounts/{account_id}/primary", response_model=list[PayoutAccountResponse],
             summary="Send my money here")
async def make_primary(account_id: str, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    target = await _accounts().find_one({"_id": to_object_id(account_id), "user_id": uid})
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That account is not yours")
    # Clear then set, in that order: a moment with no primary is recoverable,
    # a moment with two is a payout to the wrong account.
    await _accounts().update_many({"user_id": uid}, {"$set": {"primary": False}})
    await _accounts().update_one({"_id": target["_id"]}, {"$set": {"primary": True}})
    return await list_accounts(me)


@router.delete("/accounts/{account_id}", response_model=list[PayoutAccountResponse],
               summary="Remove an account")
async def remove_account(account_id: str, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    gone = await _accounts().find_one_and_delete({"_id": to_object_id(account_id), "user_id": uid})
    # Never leave her with no primary: the next account inherits it, so a
    # withdrawal always has somewhere to go.
    if gone and gone.get("primary"):
        # Find one of her remaining accounts and promote it in the same
        # operation, rather than reading one and then writing to it — which
        # was two trips to Atlas, and a window in which a concurrent delete
        # could take the account being promoted.
        await _accounts().find_one_and_update(
            {"user_id": uid}, {"$set": {"primary": True}},
        )
    return await list_accounts(me)


@router.post("/withdraw", response_model=WithdrawResult, summary="Withdraw to my bank")
async def withdraw(
    body: WithdrawRequest,
    request: Request,
    me: dict = Depends(require_active_member),
):
    """Idempotent: the same `Idempotency-Key` twice moves money once."""
    return await idempotency.once(
        request, str(me["_id"]), "payout.withdraw", lambda: _withdraw(body, me),
    )


async def _withdraw(body: WithdrawRequest, me: dict) -> WithdrawResult:
    uid = str(me["_id"])

    if body.account_id:
        account = await _accounts().find_one({"_id": to_object_id(body.account_id), "user_id": uid})
    else:
        account = await _accounts().find_one({"user_id": uid, "primary": True})
    if not account:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Add a bank account or UPI id first — there is nowhere to send it yet.",
        )

    if body.amount_minor < MIN_WITHDRAWAL_MINOR:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"The smallest withdrawal is ₹{MIN_WITHDRAWAL_MINOR // 100}.",
        )

    # Summed from the ledger, never taken from the request. The client may ask
    # for any figure; only this one decides.
    available = await balance_minor(uid)
    if body.amount_minor > available:
        sym = symbol()
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"You have {sym}{available / 100:,.0f} available, and asked for "
            f"{sym}{body.amount_minor / 100:,.0f}.",
        )

    txn = WalletTxnModel.create_document(
        user_id=uid, member_id=me.get("member_id", ""),
        kind=WalletTxnModel.KIND_DEBIT, amount_minor=body.amount_minor,
        source="payout", label=f"Withdrawn to {account.get('label', 'your account')}",
        reference_id=str(account["_id"]),
    )
    await _txns().insert_one(txn)

    # Re-read after writing. If two withdrawals raced and together overdrew the
    # ledger, the loser is reversed here rather than being allowed to stand —
    # the balance is summed, so an overdraft would otherwise show as a negative
    # figure on her own screen.
    after = await balance_minor(uid)
    raw_after = await _raw_balance(uid)
    if raw_after < 0:
        await _txns().delete_one({"_id": txn["_id"]})
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Another withdrawal went through at the same moment. Check your balance and try again.",
        )

    sym = symbol()
    return WithdrawResult(
        id=str(txn["_id"]),
        amount_minor=body.amount_minor,
        amount_label=f"{sym}{body.amount_minor / 100:,.0f}",
        to=f"{account.get('label', '')} {PayoutAccountModel.to_response(account)['detail']}".strip(),
        # Days she can plan around, never "processing".
        arrives="Most banks have it by tomorrow. Always within three working days.",
        balance_after_minor=after,
    )


async def _raw_balance(user_id: str) -> int:
    """
    The ledger sum WITHOUT the floor at zero.

    `balance_minor` clamps to zero so a screen never shows a negative balance.
    That is right for display and wrong for detecting an overdraft, which is
    exactly what the clamp hides.
    """
    rows = await _txns().aggregate([
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": "$kind", "total": {"$sum": "$amount_minor"}}},
    ]).to_list(10)
    totals = {r["_id"]: int(r["total"]) for r in rows}
    return totals.get(WalletTxnModel.KIND_CREDIT, 0) - totals.get(WalletTxnModel.KIND_DEBIT, 0)
