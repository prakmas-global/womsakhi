from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, field_validator

Category = Literal["Career", "Skills", "Business", "Wellness", "Finance"]


def _valid_date(value: str) -> str:
    """Accept only 'YYYY-MM-DD' day strings (the format the date picker sends)."""
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except (ValueError, TypeError):
        raise ValueError("Date must be in YYYY-MM-DD format")
    return value


class CalendarEventResponse(BaseModel):
    id: int
    title: str
    category: str
    date: str
    time: str
    attendee: str
    notes: str
    color: str
    created_at: str


class CalendarEventListResponse(BaseModel):
    items: list[CalendarEventResponse]
    total: int
    page: int
    page_size: int
    pages: int


class CalendarEventCreate(BaseModel):
    title: str
    category: Category = "Career"
    date: str
    time: str = ""
    attendee: str = ""
    notes: str = ""

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Event title cannot be empty")
        return v

    @field_validator("date")
    @classmethod
    def date_format(cls, v: str) -> str:
        return _valid_date(v)


class CalendarEventUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[Category] = None
    date: Optional[str] = None
    time: Optional[str] = None
    attendee: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Event title cannot be empty")
        return v

    @field_validator("date")
    @classmethod
    def date_format(cls, v: Optional[str]) -> Optional[str]:
        return None if v is None else _valid_date(v)


class CalendarStatsResponse(BaseModel):
    total: int
    by_category: dict[str, int]
