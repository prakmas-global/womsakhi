from pydantic import BaseModel, field_validator


class WalletTxn(BaseModel):
    id: str
    kind: str
    label: str
    source: str
    amount_minor: int
    amount_label: str
    when: str


class WalletResponse(BaseModel):
    balance_minor: int
    balance_label: str
    currency: str
    transactions: list[WalletTxn]


class SupportRequestCreate(BaseModel):
    what_for: str
    reason: str
    amount_needed: float = 0
    household_income: str = ""
    dependants: int = 0

    @field_validator("what_for")
    @classmethod
    def has_what(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("What would you like help paying for?")
        return v.strip()

    @field_validator("reason")
    @classmethod
    def has_reason(cls, v: str) -> str:
        if not v or len(v.strip()) < 20:
            raise ValueError("Tell us a little about your situation so we can help properly")
        return v.strip()

    @field_validator("amount_needed")
    @classmethod
    def sane_amount(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Amount cannot be negative")
        if v > 500000:
            raise ValueError("That's beyond what this fund can grant — please message the team instead")
        return v

    @field_validator("dependants")
    @classmethod
    def sane_dependants(cls, v: int) -> int:
        if v < 0 or v > 30:
            raise ValueError("Please enter a real number")
        return v


class SupportRequestResponse(BaseModel):
    id: str
    what_for: str
    reason: str
    amount_needed_label: str
    granted_label: str
    status: str
    staff_note: str
    asked_on: str


class CertificateResponse(BaseModel):
    id: str
    code: str
    holder_name: str
    program_id: str
    program_name: str
    hours: str
    grade: str
    revoked: bool
    issued_on: str
    issued_at: str


class MyDocument(BaseModel):
    id: str
    #: Already the human label ("Aadhaar card"), not the key.
    doc_type: str
    #: The key, so a screen can offer to replace the right slot.
    doc_kind: str = "other"
    filename: str
    status: str
    uploaded_on: str
    note: str = ""
    #: Bytes. The vault showed a size picked from a hardcoded list of three
    #: because this was not carried.
    size: int = 0


class ReferralResponse(BaseModel):
    code: str
    link: str
    invited: int
    joined: int
    credit_per_join_label: str
    message: str


class ProgramDetail(BaseModel):
    """One programme, plus where she has got to in it."""
    id: str
    name: str
    category: str
    desc: str
    mode: str
    duration: str
    dates: str
    days: str
    cover: str
    seats: int
    enrolled: bool
    progress: int
    sessions_attended: int
    status: str
    joined_on: str
    curriculum: list[dict]
    certificate_code: str = ""
