from typing import Literal, Optional

from pydantic import BaseModel, field_validator

ReportCategory = Literal[
    "User Activity", "Appointments", "Program & Services", "Financial", "Marketing", "Others"
]
ReportType = Literal["Summary", "Detailed", "Custom"]
ReportSchedule = Literal["Daily", "Weekly", "Monthly", "On Demand"]


class ReportResponse(BaseModel):
    id: str
    name: str
    description: str
    category: str
    tone: str
    icon: str
    type: str
    schedule: str
    schedule_detail: str
    last_generated: str
    created_by: str
    scheduled: bool
    created_at: str


class ReportListResponse(BaseModel):
    items: list[ReportResponse]
    total: int
    page: int
    page_size: int
    pages: int


class ReportCreate(BaseModel):
    name: str
    # The create modal may leave these blank; blanks fall back to the defaults
    # below on the server (cat -> Others, type -> Summary, sched -> On Demand).
    category: Optional[ReportCategory] = None
    type: Optional[ReportType] = None
    schedule: Optional[ReportSchedule] = None
    description: str = ""

    @field_validator("category", "type", "schedule", mode="before")
    @classmethod
    def blank_to_none(cls, v):
        return None if v in ("", None) else v

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Report name cannot be empty")
        return v


class ReportUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[ReportCategory] = None
    type: Optional[ReportType] = None
    schedule: Optional[ReportSchedule] = None

    @field_validator("category", "type", "schedule", mode="before")
    @classmethod
    def blank_to_none(cls, v):
        return None if v in ("", None) else v


# --- Reports Overview (stats singleton) --------------------------------------
class GeneratedPoint(BaseModel):
    label: str
    value: int


class CategorySlice(BaseModel):
    name: str
    value: int
    color: str


class ReportsOverviewResponse(BaseModel):
    total_reports: int
    scheduled_reports: int
    reports_generated: int
    reports_generated_delta: float
    avg_generation_time: str
    data_points_analyzed: str
    data_points_delta: float
    generated_trend: list[GeneratedPoint]
    data_points_trend: list[float]
    top_categories: list[CategorySlice]


# --- Side panels / modals -----------------------------------------------------
class RecentReportResponse(BaseModel):
    name: str
    last_generated: str
    icon: str


class ScheduledReportResponse(BaseModel):
    name: str
    schedule_detail: str
    status: str


class TemplateResponse(BaseModel):
    category: str
    name: str
    description: str
    tone: str
    icon: str
    status: str
