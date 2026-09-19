from typing import Optional

from pydantic import BaseModel, field_validator


# --- events ------------------------------------------------------------------

class EventResponse(BaseModel):
    id: str
    title: str
    desc: str
    category: str
    cover: str
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
    seats_left: int
    full: bool
    registered: bool


# --- mentors -----------------------------------------------------------------

class MentorResponse(BaseModel):
    id: str
    name: str
    headline: str
    focus: str = ""
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
    requested: bool


class MentorshipRequestCreate(BaseModel):
    goal: str
    preferred_time: str = ""

    @field_validator("goal")
    @classmethod
    def has_goal(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Tell her what you'd like help with")
        if len(v.strip()) > 1000:
            raise ValueError("Keep it under 1000 characters")
        return v.strip()


class MentorshipRequestResponse(BaseModel):
    id: str
    mentor_id: str
    mentor_name: str
    goal: str
    preferred_time: str
    status: str
    when: str


# --- opportunities -----------------------------------------------------------

class OpportunityResponse(BaseModel):
    id: str
    title: str
    org: str
    kind: str
    desc: str
    location: str
    mode: str
    pay: str
    #: The numbers inside `pay`, in paise, so the board can be filtered and
    #: sorted. Defaulted rather than required: an opportunity written before
    #: the migration has none, and 0 says "we don't know" honestly.
    pay_low_minor: int = 0
    pay_high_minor: int = 0
    #: What the figures are per — month, year, week, day, hour, word, piece.
    #: Empty when the text did not say. Comparing across periods is meaningless,
    #: so a caller that sorts must pin this first.
    pay_period: str = ""
    skills: list[str]
    openings: int
    deadline: str
    deadline_label: str
    experience: str
    cover: str
    contact_note: str
    applicant_count: int
    status: str
    applied: bool
    saved: bool
    posted: str


class ApplicationCreate(BaseModel):
    note: str = ""
    phone: str = ""

    @field_validator("note")
    @classmethod
    def note_length(cls, v: str) -> str:
        if v and len(v) > 2000:
            raise ValueError("Keep your note under 2000 characters")
        return (v or "").strip()


class ApplicationResponse(BaseModel):
    id: str
    opportunity_id: str
    opportunity_title: str
    org: str
    note: str
    status: str
    step: int
    steps: int
    staff_note: str
    applied_on: str
