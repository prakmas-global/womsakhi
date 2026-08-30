from pydantic import BaseModel, field_validator


class Helpline(BaseModel):
    name: str
    number: str
    desc: str
    urgent: bool


class TrustedContactResponse(BaseModel):
    id: str
    name: str
    phone: str
    relation: str
    notify_on_alert: bool


class TrustedContactCreate(BaseModel):
    name: str
    phone: str
    relation: str = ""
    notify_on_alert: bool = True

    @field_validator("name")
    @classmethod
    def has_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Who is this?")
        return v.strip()

    @field_validator("phone")
    @classmethod
    def has_phone(cls, v: str) -> str:
        digits = "".join(c for c in (v or "") if c.isdigit())
        if len(digits) < 7:
            raise ValueError("That doesn't look like a phone number")
        return v.strip()


class AlertCreate(BaseModel):
    note: str = ""
    location: str = ""

    @field_validator("note")
    @classmethod
    def note_length(cls, v: str) -> str:
        return (v or "").strip()[:2000]


class AlertResponse(BaseModel):
    id: str
    note: str
    status: str
    contacts_notified: int
    resolution: str
    raised_at: str


class ReportCreate(BaseModel):
    category: str
    details: str
    about: str = ""
    anonymous: bool = False
    evidence: str = ""

    @field_validator("category")
    @classmethod
    def has_category(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Choose what this is about")
        return v.strip()

    @field_validator("details")
    @classmethod
    def has_details(cls, v: str) -> str:
        if not v or len(v.strip()) < 10:
            raise ValueError("Please tell us a little more so we can act on it")
        if len(v) > 6000:
            raise ValueError("Keep it under 6000 characters")
        return v.strip()


class ReportResponse(BaseModel):
    id: str
    category: str
    details: str
    about: str
    anonymous: bool
    status: str
    filed_on: str


class SafetyCentre(BaseModel):
    """Everything the safety screen needs in one request."""
    helplines: list[Helpline]
    contacts: list[TrustedContactResponse]
    open_alert: AlertResponse | None = None
    reports: list[ReportResponse]
