from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, field_validator
from app.core.media import MediaRef, MediaRefOptional

Role = Literal["Member", "Instructor", "Supervisor", "Admin"]
Status = Literal["Active", "Inactive", "Pending", "Rejected"]
Segment = Literal["Entrepreneur", "Student", "Artisan", "Job Seeker", "Support Seeker"]


class MemberResponse(BaseModel):
    id: str
    code: str
    full_name: str
    email: str
    phone: str
    role: str
    status: str
    location: str
    segment: str
    gender: str
    dob: str
    referral: str
    engagement: int
    verified_on: str
    avatar: str
    joined: str
    created_at: str


class MemberListResponse(BaseModel):
    items: list[MemberResponse]
    total: int
    page: int
    page_size: int
    pages: int


class MemberCreate(BaseModel):
    full_name: str
    email: EmailStr
    phone: str = ""
    role: Role = "Member"
    status: Status = "Active"
    location: str = ""
    segment: Segment = "Entrepreneur"
    gender: str = "Female"
    dob: str = ""
    referral: str = ""
    engagement: int = 0
    avatar: MediaRef = ""  # URL returned by POST /uploads

    @field_validator("full_name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Full name cannot be empty")
        return v

    @field_validator("engagement")
    @classmethod
    def engagement_in_range(cls, v: int) -> int:
        return max(0, min(100, v))


class MemberUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    role: Optional[Role] = None
    status: Optional[Status] = None
    location: Optional[str] = None
    segment: Optional[Segment] = None
    gender: Optional[str] = None
    dob: Optional[str] = None
    referral: Optional[str] = None
    engagement: Optional[int] = None
    verified_on: Optional[str] = None
    avatar: MediaRefOptional = None

    @field_validator("engagement")
    @classmethod
    def engagement_in_range(cls, v: Optional[int]) -> Optional[int]:
        return None if v is None else max(0, min(100, v))


class MemberStatusUpdate(BaseModel):
    status: Status
    reason: str = ""


class MemberStatsResponse(BaseModel):
    total: int
    active: int
    inactive: int
    pending: int
    rejected: int
    # Accounts that completed verification — counted from `users`, where the
    # verification path actually lives.
    verified: int
    new_this_month: int
    new_last_month: int
    by_role: dict[str, int]
    by_segment: dict[str, int]
    by_status: dict[str, int]


# ── Admin actions that need a reason ─────────────────────────────────────────
# A suspension, rejection or deletion with no reason is an action nobody can
# explain later. The reason goes into the audit row and, where it is hers to
# know, into the notice she receives.


class ReasonRequest(BaseModel):
    reason: str = ""

    @field_validator("reason")
    @classmethod
    def trim(cls, v: str) -> str:
        return (v or "").strip()[:400]


class RequiredReasonRequest(ReasonRequest):
    @field_validator("reason")
    @classmethod
    def required(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("A reason is needed")
        return v[:400]


class BulkStatusRequest(BaseModel):
    ids: list[str]
    status: Literal["Active", "Inactive"]
    reason: str = ""

    @field_validator("ids")
    @classmethod
    def some_ids(cls, v: list[str]) -> list[str]:
        cleaned = [s for s in dict.fromkeys(v or []) if s]
        if not cleaned:
            raise ValueError("Pick at least one member")
        return cleaned[:200]


class BulkRegionRequest(BaseModel):
    ids: list[str]
    region: str
    reason: str = ""

    @field_validator("ids")
    @classmethod
    def some_member_ids(cls, v: list[str]) -> list[str]:
        cleaned = [s for s in dict.fromkeys(v or []) if s]
        if not cleaned:
            raise ValueError("Pick at least one member")
        return cleaned[:200]

    @field_validator("region")
    @classmethod
    def valid_region(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("Choose a region")
        return v[:120]

    @field_validator("reason")
    @classmethod
    def trim_reason(cls, v: str) -> str:
        return (v or "").strip()[:400]


# ── The profile screen ────────────────────────────────────────────────────────
# The directory row (`members`) plus the login behind it (`users`), plus what
# she has actually done on the platform — counted from the collections that
# record it, never from a stored score.


class AccountSummary(BaseModel):
    """The `users` row, with nothing a staff member has no business seeing."""
    id: str
    verification_status: str
    verification_label: str
    verified_at: str
    email_verified_at: str
    is_active: bool
    locale: str
    onboarding_complete: bool
    last_login_at: str
    rejection_reason: str
    created_at: str
    #: What she said she needed at intake — the context staff use to help her.
    needs: list[str] = []
    #: Set when she asked for her account to be deleted; "" otherwise.
    deletion_requested_at: str = ""
    deletion_reason: str = ""


class DeletionRequestRow(BaseModel):
    """One woman who asked us to delete her account, still waiting for a human."""
    user_id: str
    member_id: str
    name: str
    email: str
    code: str
    reason: str
    requested_at: str
    days_waiting: int
    #: The statutory window the member screen promises: "within 30 days".
    overdue: bool


class DeletionRequestList(BaseModel):
    items: list[DeletionRequestRow]
    total: int
    overdue: int


class ActivityCounts(BaseModel):
    bookings: int = 0
    enrolments: int = 0
    posts: int = 0
    replies: int = 0
    circles: int = 0
    events: int = 0
    applications: int = 0
    orders: int = 0
    total: int = 0


class ProfileEnrolment(BaseModel):
    id: str
    program_name: str
    status: str
    progress: int
    started: str


class ProfileBooking(BaseModel):
    id: str
    service_name: str
    date: str
    time: str
    mode: str
    status: str


class ProfileAuditRow(BaseModel):
    id: str
    by: str
    action: str
    detail: str
    when: str


class MemberProfileResponse(BaseModel):
    member: MemberResponse
    account: Optional[AccountSummary] = None
    activity: ActivityCounts
    enrolments: list[ProfileEnrolment]
    bookings: list[ProfileBooking]
    history: list[ProfileAuditRow]


class GrowthPoint(BaseModel):
    label: str
    value: int
    new: int


class MemberGrowthResponse(BaseModel):
    points: list[GrowthPoint]
    weeks: int


class BulkStatusResponse(BaseModel):
    changed: int
    skipped: int
    message: str
