"""Saved payout details and a compatibility endpoint for deferred bank payouts.

This release does not initiate bank transfers or debit credits for withdrawals.
Existing payout details remain owner-scoped and available for account upkeep.
"""

from __future__ import annotations

from typing import Union

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.rbac import require_active_member
from app.core.serializers import to_object_id
from app.db.mongodb import get_database
from app.models.payout import PayoutAccountModel
from app.schemas.payout import (
    AddBankAccount,
    AddUpi,
    PayoutAccountResponse,
    WithdrawRequest,
    WithdrawResult,
)

router = APIRouter(prefix="/me/payout", tags=["Member · Money"])

def _accounts():
    return get_database()[PayoutAccountModel.collection_name]


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


@router.post("/withdraw", response_model=WithdrawResult, summary="Bank payouts are unavailable in this release")
async def withdraw(
    body: WithdrawRequest,
    request: Request,
    me: dict = Depends(require_active_member),
):
    # Keep the URL for older clients, but fail before idempotency, account reads
    # or ledger writes. There is no bank-transfer integration in this release.
    raise HTTPException(
        status.HTTP_501_NOT_IMPLEMENTED,
        "Bank payouts are planned for a future release. No credits have been deducted.",
    )
