"""
Shapes for the staff side of Growth: events, mentors, work and applications.

Kept apart from `admin_modules.py` — that file is shared by three modules'
rebuilds, and every row shape here carries counts read from rows rather than
from stored counters, which is the whole point of the rebuild.
"""

from typing import Optional

from pydantic import BaseModel, field_validator

from app.schemas.admin_modules import (  # noqa: F401 — re-exported for the router
    EventAttendee,
    EventUpsert,
    MentorUpsert,
    OpportunityUpsert,
)


def _required(v: str, message: str) -> str:
    if not v or not v.strip():
        raise ValueError(message)
    return v.strip()


# --- the numbers on the tiles -------------------------------------------------

class EventCounts(BaseModel):
    total: int
    published: int
    draft: int
    cancelled: int
    upcoming: int
    registrations: int


class MentorCounts(BaseModel):
    total: int
    active: int
    retired: int
    pending_requests: int
    mentees: int
    sessions: int


class RequestCounts(BaseModel):
    total: int
    pending: int
    accepted: int
    declined: int


class OpportunityCounts(BaseModel):
    total: int
    open: int
    closed: int
    applications: int
    openings: int


class ApplicationCounts(BaseModel):
    total: int
    applied: int
    shortlisted: int
    interview: int
    offered: int
    closed: int
    withdrawn: int


class GrowthSummary(BaseModel):
    """Every count each of the five screens shows, counted from rows, in one call."""
    events: EventCounts
    mentors: MentorCounts
    requests: RequestCounts
    opportunities: OpportunityCounts
    applications: ApplicationCounts


# --- events -------------------------------------------------------------------

class EventRow(BaseModel):
    id: str
    title: str
    desc: str
    category: str
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
    #: Counted from `event_registrations` with status "registered" — not the
    #: stored counter, which the seed fills to 55% of the seats with no rows.
    registered_count: int
    attended_count: int = 0
    seats_left: int
    status: str
    cancel_reason: str = ""


class EventCancel(BaseModel):
    reason: str = ""

    @field_validator("reason")
    @classmethod
    def has_reason(cls, v: str) -> str:
        return _required(v, "Say why — everyone registered is told this")


class AttendeeStatus(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def known(cls, v: str) -> str:
        if v not in ("registered", "attended", "cancelled"):
            raise ValueError("Status must be registered, attended or cancelled")
        return v


# --- mentors ------------------------------------------------------------------

class MentorRow(BaseModel):
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
    status: str
    #: All three counted from rows: pending requests, accepted requests, and
    #: sessions staff have logged. The seeded `rating`/`sessions_done` on the
    #: document are not sent here — they were random numbers.
    open_requests: int = 0
    mentees: int = 0
    sessions: int = 0
    created_on: str = ""


class MentorSessionCreate(BaseModel):
    #: The accepted request the session belongs to. Names the member without
    #: the client sending a user id.
    request_id: str
    held_on: str = ""
    note: str = ""

    @field_validator("request_id")
    @classmethod
    def has_request(cls, v: str) -> str:
        return _required(v, "Pick which mentee the session was with")


class MentorSessionRow(BaseModel):
    id: str
    mentor_id: str
    request_id: str
    member_name: str
    held_on: str
    note: str
    logged_by: str
    logged_on: str


class MentorRequestRow(BaseModel):
    id: str
    member_name: str
    member_email: str
    member_code: str = ""
    mentor_id: str
    mentor_name: str
    goal: str
    preferred_time: str
    status: str
    staff_note: str
    when: str
    decided_by: str = ""
    decided_on: str = ""


class MentorRequestDecide(BaseModel):
    status: str
    staff_note: str = ""
    #: Set to hand the request to a different mentor than the one she asked
    #: for — because that one is full, or retired, or not the right fit.
    mentor_id: Optional[str] = None

    @field_validator("status")
    @classmethod
    def known(cls, v: str) -> str:
        if v not in ("pending", "accepted", "declined", "closed"):
            raise ValueError("Unknown status")
        return v

    @field_validator("staff_note")
    @classmethod
    def trimmed(cls, v: str) -> str:
        return (v or "").strip()


# --- opportunities ------------------------------------------------------------

class OpportunityRow(BaseModel):
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
    #: Counted from `applications` rows that are not withdrawn.
    applicant_count: int
    status: str
    posted: str


# --- applications -------------------------------------------------------------

class HistoryEntry(BaseModel):
    status: str
    at: str
    by: str = ""
    note: str = ""


class ApplicationRow(BaseModel):
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
    updated_on: str = ""
    history: list[HistoryEntry] = []


class ApplicationDecide(BaseModel):
    status: str
    staff_note: str = ""

    @field_validator("status")
    @classmethod
    def known(cls, v: str) -> str:
        allowed = ("applied", "shortlisted", "interview", "offered", "closed")
        if v not in allowed:
            raise ValueError("Unknown status")
        return v

    @field_validator("staff_note")
    @classmethod
    def trimmed(cls, v: str) -> str:
        return (v or "").strip()
