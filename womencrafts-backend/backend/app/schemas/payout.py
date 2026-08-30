"""Request and response shapes for payout accounts and withdrawals."""

from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.models.payout import PayoutAccountModel


class PayoutAccountResponse(BaseModel):
    id: str
    kind: str
    label: str
    detail: str
    holder: str
    ifsc: str
    primary: bool
    verified: bool
    added_on: str


class AddBankAccount(BaseModel):
    kind: str = Field(PayoutAccountModel.KIND_BANK)
    account_number: str = Field(..., min_length=6, max_length=20)
    # Asked twice on the screen for a reason: one wrong digit sends her money to
    # a stranger, and there is no getting it back.
    confirm_account_number: str = Field(..., min_length=6, max_length=20)
    ifsc: str = Field(..., min_length=11, max_length=11)
    holder: str = Field(..., min_length=2, max_length=80)
    label: str = Field("", max_length=60)

    @field_validator("confirm_account_number")
    @classmethod
    def _match(cls, v: str, info):
        if v != (info.data.get("account_number") or ""):
            raise ValueError("The two account numbers do not match")
        return v


class AddUpi(BaseModel):
    kind: str = Field(PayoutAccountModel.KIND_UPI)
    upi_id: str = Field(..., min_length=4, max_length=80)
    label: str = Field("", max_length=60)

    @field_validator("upi_id")
    @classmethod
    def _looks_like_upi(cls, v: str) -> str:
        if "@" not in v:
            raise ValueError("A UPI id looks like yourname@bank")
        return v.strip()


class WithdrawRequest(BaseModel):
    amount_minor: int = Field(..., gt=0, description="In paise")
    account_id: Optional[str] = Field(None, description="Defaults to her primary account")


class WithdrawResult(BaseModel):
    id: str
    amount_minor: int
    amount_label: str
    to: str
    #: When it lands, in words she can plan around — never "processing".
    arrives: str
    balance_after_minor: int
