"""
Response shapes for the settings-platform admin screens.

Everything here describes something measured or stored — a count of rows, a
file on disk, a flag read from the process configuration. Nothing describes a
plan nobody bought or a card nobody entered; those shapes were removed rather
than kept "for later".
"""

from typing import Optional

from pydantic import BaseModel, field_validator

from app.schemas.backup import BackupItem


# --- activity log (settings/activity) ----------------------------------------

class ActivityRow(BaseModel):
    id: str
    user_id: str
    user_name: str
    action: str
    category: str
    target: str
    detail: str
    ip: str
    when: str
    created_at: str


class ActivityPage(BaseModel):
    items: list[ActivityRow]
    total: int
    page: int
    page_size: int
    pages: int


class ActivitySlice(BaseModel):
    name: str
    value: int
    pct: str


class ActivityPoint(BaseModel):
    label: str
    value: int


class ActivityTopAction(BaseModel):
    action: str
    category: str
    n: int


class ActivitySummary(BaseModel):
    """Every number is a count over the rows the same filters select."""

    total: int
    today: int
    last_7_days: int
    actors: int
    by_category: list[ActivitySlice]
    timeline: list[ActivityPoint]
    top_actions: list[ActivityTopAction]
    range_from: str
    range_to: str


class ActivityActor(BaseModel):
    user_id: str
    user_name: str
    actions: int


# --- platform events (settings/logs) -----------------------------------------

class PlatformEvent(BaseModel):
    id: str
    when: str
    created_at: str
    #: Inferred from the action string; the screen says so.
    severity: str  # info | warning | error
    source: str
    action: str
    message: str
    user_name: str
    ip: str


class PlatformEventPage(BaseModel):
    items: list[PlatformEvent]
    total: int
    page: int
    page_size: int
    pages: int


class PlatformLogSummary(BaseModel):
    total: int
    by_severity: dict[str, int]
    sources: list[str]
    #: Where the process log actually goes — never the database.
    process_log_destination: str
    environment: str
    note: str


# --- support (settings/support) ----------------------------------------------

class TicketReplyOut(BaseModel):
    body: str
    by: str
    when: str


class TicketAdmin(BaseModel):
    id: str
    reference: str
    subject: str
    message: str
    category: str
    priority: str
    status: str
    replies: list[TicketReplyOut]
    raised_on: str
    created_at: str
    updated_at: str
    user_id: str
    user_name: str
    user_email: str
    #: Hours from being raised to the first reply; None until someone replies.
    first_reply_hours: Optional[float] = None


class TicketPage(BaseModel):
    items: list[TicketAdmin]
    total: int
    page: int
    page_size: int
    pages: int


class TicketSummary(BaseModel):
    total: int
    open: int
    in_progress: int
    resolved: int
    raisers: int
    replied: int
    #: Median of first_reply_hours over replied tickets; None when nothing has
    #: been answered yet. Never a promise.
    median_first_reply_hours: Optional[float] = None


class TicketReplyIn(BaseModel):
    body: str

    @field_validator("body")
    @classmethod
    def has_body(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) < 2:
            raise ValueError("Write a reply first")
        if len(v) > 4000:
            raise ValueError("Keep the reply under 4000 characters")
        return v


class TicketStatusIn(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def known(cls, v: str) -> str:
        if v not in ("open", "in_progress", "resolved"):
            raise ValueError("Status must be open, in_progress or resolved")
        return v


class TicketReplyResult(BaseModel):
    ticket: TicketAdmin
    #: True only when a real provider accepted the message.
    email_sent: bool
    email_note: str


class SupportContact(BaseModel):
    email: str
    phone: str
    #: Where these values come from, so the screen can say it.
    source: str
    #: Whether a reply typed here can also reach her by email.
    email_delivery: bool
    email_note: str


# --- integrations (settings/integrations) ------------------------------------

class AdapterDetail(BaseModel):
    label: str
    value: str


class Adapter(BaseModel):
    key: str
    name: str
    category: str
    #: configured | sandbox | not_configured | not_available
    status: str
    summary: str
    details: list[AdapterDetail]
    #: The screen offers "Send a test" only where a real send can happen.
    can_test: bool = False


class AdapterList(BaseModel):
    items: list[Adapter]
    checked_at: str
    configured: int
    sandbox: int
    not_configured: int
    not_available: int


class EmailTestResult(BaseModel):
    sent: bool
    to: str
    message: str


# --- billing (settings/billing) ----------------------------------------------

class PlanFeature(BaseModel):
    key: str
    label: str
    included: bool


class PlanInfo(BaseModel):
    tier: str
    label: str
    features: list[PlanFeature]
    note: str


class SeatCounts(BaseModel):
    staff: int
    super_admins: int
    active_staff: int
    members: int


class StorageInfo(BaseModel):
    bytes: int
    label: str
    files: int
    location: str


class BillingInfoOut(BaseModel):
    company: str = ""
    email: str = ""
    gstin: str = ""
    address: str = ""


class PaymentsInfo(BaseModel):
    provider: str
    enabled: bool
    custody: bool
    note: str


class BillingOverview(BaseModel):
    plan: PlanInfo
    seats: SeatCounts
    storage: StorageInfo
    billing_info: BillingInfoOut
    billing_info_saved: bool
    billing_info_updated_at: str
    payments: PaymentsInfo
    invoices_total: int


class BillingInfoIn(BaseModel):
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
        return v[:200]

    @field_validator("gstin", "address")
    @classmethod
    def trim(cls, v: str) -> str:
        return (v or "").strip()[:400]


# --- backups (settings/backup) -----------------------------------------------

class BackupRow(BackupItem):
    #: Whether the file the row points at is on this server's disk.
    file_present: bool
    file_note: str = ""


class BackupSummary(BaseModel):
    on_disk: int
    records: int
    missing_files: int
    last_backup_at: str
    last_backup_name: str
    storage_bytes: int
    storage_label: str
    location: str
    schedule_enabled: bool
    schedule_label: str
    #: There is no scheduler process; the schedule is a stored preference.
    runs_automatically: bool
