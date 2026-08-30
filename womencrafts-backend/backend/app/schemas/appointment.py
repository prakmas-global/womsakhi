from typing import Literal, Optional

from pydantic import BaseModel, field_validator

ApptStatus = Literal["Upcoming", "Completed", "Cancelled", "Rescheduled"]
ApptService = Literal[
    "Career Counseling",
    "Skill Workshop",
    "Mentoring Session",
    "Business Consultation",
    "Financial Literacy",
    "Health & Wellness",
    "Handicraft Training",
    "Entrepreneurship",
    "Digital Skills",
    "Marketing Basics",
]


class AppointmentResponse(BaseModel):
    id: str
    name: str
    service: str
    day: str
    date: str
    time: str
    status: str
    category: str
    color: str
    bg: str
    duration: Optional[str] = None
    notes: Optional[str] = None


class AppointmentListResponse(BaseModel):
    items: list[AppointmentResponse]
    total: int
    page: int
    page_size: int
    pages: int


class AppointmentCreate(BaseModel):
    """Body of the New Appointment modal. The server derives day/date labels,
    category, color and bg from these (mirroring the frontend's submit logic)."""

    name: str
    service: ApptService = "Career Counseling"
    date: str = ""              # ISO 'YYYY-MM-DD' from the date input (optional)
    time: str = ""             # 'HH:MM' from the start-time input (optional)
    duration: str = "1 hour"
    status: ApptStatus = "Upcoming"
    notes: str = ""

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Client name cannot be empty")
        return v


class AppointmentStatusUpdate(BaseModel):
    """Powers Cancel Appointment / Reschedule / Mark Complete on the detail modal."""

    status: ApptStatus


# --- Stats payload (feeds every analytics widget on the screen) ----------------

class ApptStatCard(BaseModel):
    key: str
    label: str
    value: str
    delta: str
    delta_dir: str  # "up" | "down"
    tone: str
    icon: str


class ApptQuickFilter(BaseModel):
    label: str
    count: str


class ApptStatusSlice(BaseModel):
    name: str
    value: int
    color: str
    pct: str


class ApptServiceSlice(BaseModel):
    name: str
    value: int
    color: str


class ApptReminder(BaseModel):
    name: str
    service: str
    time: str
    badge: str


class ApptCancellation(BaseModel):
    value: int
    color: str
    center_value: str
    title: str
    note: str
    high_risk: int


class ApptTrendPoint(BaseModel):
    label: str
    value: int


class ApptLeadTime(BaseModel):
    value: str
    unit: str
    delta: str
    delta_dir: str
    note: str
    trend: list[ApptTrendPoint]


class AppointmentStatsResponse(BaseModel):
    stat_cards: list[ApptStatCard]
    quick_filters: list[ApptQuickFilter]
    status_breakdown: list[ApptStatusSlice]
    status_total: str
    by_service: list[ApptServiceSlice]
    by_service_total: str
    reminders: list[ApptReminder]
    cancellation: ApptCancellation
    lead_time: ApptLeadTime
