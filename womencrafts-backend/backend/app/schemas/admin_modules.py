"""Request/response shapes for the staff side of the member modules."""

from typing import Optional

from pydantic import BaseModel, field_validator


def _required(v: str, message: str) -> str:
    if not v or not v.strip():
        raise ValueError(message)
    return v.strip()


# --- events ------------------------------------------------------------------

class EventUpsert(BaseModel):
    title: str
    desc: str = ""
    category: str = "Workshop"
    date: str = ""
    time: str = ""
    duration: str = ""
    mode: str = "Online"
    venue: str = ""
    host: str = ""
    seats: int = 0
    fee: float = 0
    language: str = ""
    status: str = "published"

    @field_validator("title")
    @classmethod
    def has_title(cls, v: str) -> str:
        return _required(v, "Give the event a title")

    @field_validator("seats")
    @classmethod
    def sane_seats(cls, v: int) -> int:
        if v < 0 or v > 100000:
            raise ValueError("Seats must be between 0 (unlimited) and 100000")
        return v


class AdminEvent(BaseModel):
    id: str
    title: str
    desc: str
    category: str
    #: The event's image. The handler passes it (it excludes only "registered"
    #: and "full"); without a slot it was dropped, so the admin event list
    #: showed no covers while the member-facing one did.
    cover: str = ""
    date: str
    date_label: str
    time: str
    duration: str
    mode: str
    venue: str
    host: str
    language: str
    fee: float
    seats: int
    registered_count: int
    seats_left: int
    status: str


class EventAttendee(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    member_code: str
    status: str
    registered_on: str


# --- mentors -----------------------------------------------------------------

class MentorUpsert(BaseModel):
    name: str
    headline: str = ""
    bio: str = ""
    photo: str = ""
    expertise: list[str] = []
    languages: list[str] = []
    experience_years: int = 0
    location: str = ""
    availability: str = ""
    status: str = "active"

    @field_validator("name")
    @classmethod
    def has_name(cls, v: str) -> str:
        return _required(v, "The mentor needs a name")


class AdminMentor(BaseModel):
    id: str
    name: str
    headline: str
    bio: str
    photo: str
    expertise: list[str]
    languages: list[str]
    experience_years: int
    location: str
    availability: str
    rating: float
    rating_count: int
    sessions_done: int
    status: str
    open_requests: int = 0


class AdminMentorRequest(BaseModel):
    id: str
    member_name: str
    member_email: str
    mentor_id: str
    mentor_name: str
    goal: str
    preferred_time: str
    status: str
    staff_note: str
    when: str


class MentorRequestDecision(BaseModel):
    status: str
    staff_note: str = ""

    @field_validator("status")
    @classmethod
    def known(cls, v: str) -> str:
        if v not in ("pending", "accepted", "declined", "closed"):
            raise ValueError("Unknown status")
        return v


# --- opportunities -----------------------------------------------------------

class OpportunityUpsert(BaseModel):
    title: str
    org: str = ""
    kind: str = "Job"
    desc: str = ""
    location: str = ""
    #: Free text, as it always was — "₹14,000 – ₹18,000 / month", "+ travel",
    #: "50% revenue share". The numbers are read out of it on save.
    pay: str = ""
    #: Override the parsed figures when you know the real band. Leave them
    #: unset and `pay` is parsed; that is the normal path.
    pay_low_minor: Optional[int] = None
    pay_high_minor: Optional[int] = None
    pay_period: Optional[str] = None
    mode: str = "On-site"
    skills: list[str] = []
    openings: int = 1
    deadline: str = ""
    experience: str = ""
    contact_note: str = ""
    status: str = "open"

    @field_validator("title")
    @classmethod
    def has_title(cls, v: str) -> str:
        return _required(v, "Give the opportunity a title")

    @field_validator("openings")
    @classmethod
    def sane_openings(cls, v: int) -> int:
        if v < 1 or v > 10000:
            raise ValueError("Openings must be at least 1")
        return v


class AdminOpportunity(BaseModel):
    id: str
    title: str
    org: str
    kind: str
    desc: str
    location: str
    mode: str
    pay: str
    pay_low_minor: int = 0
    pay_high_minor: int = 0
    pay_period: str = ""
    skills: list[str]
    openings: int
    deadline: str
    deadline_label: str
    experience: str
    contact_note: str
    applicant_count: int
    status: str
    posted: str


class AdminApplication(BaseModel):
    id: str
    member_name: str
    member_email: str
    member_phone: str
    member_code: str
    opportunity_id: str
    opportunity_title: str
    org: str
    note: str
    status: str
    staff_note: str
    applied_on: str


class ApplicationDecision(BaseModel):
    status: str
    staff_note: str = ""

    @field_validator("status")
    @classmethod
    def known(cls, v: str) -> str:
        allowed = ("applied", "shortlisted", "interview", "offered", "closed")
        if v not in allowed:
            raise ValueError("Unknown status")
        return v


# --- community ---------------------------------------------------------------

class CircleUpsert(BaseModel):
    name: str
    topic: str = ""
    desc: str = ""
    guidelines: str = ""
    is_private: bool = False
    status: str = "active"

    @field_validator("name")
    @classmethod
    def has_name(cls, v: str) -> str:
        return _required(v, "Give the circle a name")


class AdminCircle(BaseModel):
    id: str
    name: str
    topic: str
    desc: str
    guidelines: str
    is_private: bool
    member_count: int
    post_count: int
    status: str
    #: A bachat gat, not a discussion group — it holds real money.
    #: `CircleModel.to_response` has always sent these three; there was no slot
    #: for them here, so pydantic dropped them and the admin circle list could
    #: not tell a savings circle from a chat, nor say what the monthly share
    #: was or which round it had reached.
    is_savings: bool = False
    monthly_minor: int = 0
    round: int = 0


class AdminPost(BaseModel):
    id: str
    circle_id: str
    circle_name: str
    author_name: str
    #: Sent by `PostModel.to_response` and dropped here for want of a slot.
    #: Note `AdminStory` excludes it deliberately, in the handler — this one
    #: never made that choice, it just had nowhere to put it.
    author_avatar: str = ""
    body: str
    likes: int
    reply_count: int
    pinned: bool
    hidden: bool
    when: str


class AdminStory(BaseModel):
    id: str
    author_name: str
    member_email: str
    title: str
    body: str
    program: str
    status: str
    featured: bool
    likes: int
    when: str


class StoryDecision(BaseModel):
    status: str
    featured: Optional[bool] = None

    @field_validator("status")
    @classmethod
    def known(cls, v: str) -> str:
        if v not in ("pending", "published", "declined"):
            raise ValueError("Unknown status")
        return v


# --- safety ------------------------------------------------------------------

class AdminAlert(BaseModel):
    id: str
    member_name: str
    member_email: str
    member_phone: str
    note: str
    location: str
    contacts_notified: int
    status: str
    handled_by: str
    resolution: str
    raised_at: str
    contacts: list[dict] = []


class AlertDecision(BaseModel):
    status: str
    resolution: str = ""

    @field_validator("status")
    @classmethod
    def known(cls, v: str) -> str:
        if v not in ("open", "acknowledged", "resolved"):
            raise ValueError("Unknown status")
        return v


class AdminReport(BaseModel):
    id: str
    member_name: str
    member_email: str
    anonymous: bool
    category: str
    about: str
    details: str
    status: str
    staff_note: str
    filed_on: str


class ReportDecision(BaseModel):
    status: str
    staff_note: str = ""

    @field_validator("status")
    @classmethod
    def known(cls, v: str) -> str:
        if v not in ("open", "reviewing", "actioned", "closed"):
            raise ValueError("Unknown status")
        return v


# --- support fund ------------------------------------------------------------

class AdminSupportRequest(BaseModel):
    id: str
    member_name: str
    member_email: str
    member_code: str
    what_for: str
    reason: str
    amount_needed_minor: int
    amount_needed_label: str
    household_income: str
    dependants: int
    granted_minor: int
    granted_label: str
    status: str
    staff_note: str
    asked_on: str


class SupportDecision(BaseModel):
    status: str
    granted: float = 0
    staff_note: str = ""

    @field_validator("status")
    @classmethod
    def known(cls, v: str) -> str:
        if v not in ("approved", "partial", "declined"):
            raise ValueError("Unknown decision")
        return v

    @field_validator("granted")
    @classmethod
    def sane(cls, v: float) -> float:
        if v < 0 or v > 500000:
            raise ValueError("Amount out of range")
        return v


# --- shared ------------------------------------------------------------------

class ModuleCounts(BaseModel):
    """Badge counts for the staff sidebar — what is waiting for a human."""
    pending_stories: int
    open_alerts: int
    open_reports: int
    pending_support: int
    new_applications: int
    pending_mentor_requests: int
