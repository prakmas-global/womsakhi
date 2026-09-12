from typing import Optional

from pydantic import BaseModel, field_validator
from app.core.media import MediaRef, MediaRefOptional


# --- platform settings -------------------------------------------------------

class PlatformSettings(BaseModel):
    org_name: str
    tagline: str
    support_email: str
    support_phone: str
    website: str
    timezone: str
    currency: str
    date_format: str
    default_locale: str
    allow_signups: bool
    require_document_verification: bool
    auto_approve_members: bool
    maintenance_mode: bool
    maintenance_message: str
    session_timeout_minutes: int
    updated_at: str = ""


class PlatformSettingsUpdate(BaseModel):
    org_name: Optional[str] = None
    tagline: Optional[str] = None
    support_email: Optional[str] = None
    support_phone: Optional[str] = None
    website: Optional[str] = None
    timezone: Optional[str] = None
    currency: Optional[str] = None
    date_format: Optional[str] = None
    default_locale: Optional[str] = None
    allow_signups: Optional[bool] = None
    require_document_verification: Optional[bool] = None
    auto_approve_members: Optional[bool] = None
    maintenance_mode: Optional[bool] = None
    maintenance_message: Optional[str] = None
    session_timeout_minutes: Optional[int] = None

    @field_validator("org_name")
    @classmethod
    def name_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("The organisation needs a name")
        return v

    @field_validator("session_timeout_minutes")
    @classmethod
    def sane_timeout(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and not (5 <= v <= 1440):
            raise ValueError("Session timeout must be between 5 minutes and 24 hours")
        return v


class SystemHealthItem(BaseModel):
    name: str
    status: str          # ok | degraded | down
    detail: str


# --- staff profile -----------------------------------------------------------

class StaffProfile(BaseModel):
    id: str
    full_name: str
    email: str
    phone: str
    avatar: str
    role: str
    modules: list[str]
    created_at: str
    last_active: str = ""


class StaffProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    avatar: MediaRefOptional = None

    @field_validator("full_name")
    @classmethod
    def name_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("Your name cannot be empty")
        return v


class StaffStats(BaseModel):
    """The tiles on the staff profile screen — all counted from real records."""
    logins_this_month: int
    actions_performed: int
    members_managed: int
    content_published: int
    reports_generated: int


# --- notification preferences ------------------------------------------------

class NotificationRow(BaseModel):
    key: str
    title: str
    description: str
    email: bool
    sms: bool
    push: bool
    in_app: bool


class QuietHours(BaseModel):
    enabled: bool
    from_: str = ""
    to: str = ""

    model_config = {"populate_by_name": True}


class StaffNotificationPrefs(BaseModel):
    rows: list[NotificationRow]
    quiet_hours: dict


class StaffNotificationPrefsUpdate(BaseModel):
    rows: list[NotificationRow]
    quiet_hours: Optional[dict] = None


# --- activity ----------------------------------------------------------------

class ActivityItem(BaseModel):
    id: str
    user_name: str
    action: str
    category: str
    target: str
    detail: str
    ip: str
    when: str
    created_at: str


class ActivityPoint(BaseModel):
    label: str
    value: int


class ActivitySlice(BaseModel):
    name: str
    value: int
    pct: str


class ActivityOverview(BaseModel):
    total: int
    today: int
    this_week: int
    timeline: list[ActivityPoint]
    breakdown: list[ActivitySlice]


# --- support tickets ---------------------------------------------------------

class TicketCreate(BaseModel):
    subject: str
    message: str
    category: str = "Something else"
    priority: str = "Normal"

    @field_validator("subject")
    @classmethod
    def has_subject(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Give it a subject")
        if len(v) > 160:
            raise ValueError("Keep the subject under 160 characters")
        return v.strip()

    @field_validator("message")
    @classmethod
    def has_message(cls, v: str) -> str:
        if not v or len(v.strip()) < 15:
            raise ValueError("Tell us a little more so we can help")
        if len(v) > 8000:
            raise ValueError("Keep it under 8000 characters")
        return v.strip()


class TicketReply(BaseModel):
    body: str
    by: str
    when: str


class Ticket(BaseModel):
    id: str
    reference: str
    subject: str
    message: str
    category: str
    priority: str
    status: str
    replies: list[TicketReply]
    raised_on: str
