from typing import Literal, Optional

from pydantic import BaseModel, field_validator

Category = Literal[
    "Digital Literacy",
    "Entrepreneurship",
    "Handicrafts",
    "Personal Development",
    "Sustainability",
]
Mode = Literal["Online", "Offline", "Hybrid"]
ProgramStatus = Literal["Active", "Upcoming", "Completed", "Draft", "Archived"]


class ProgramResponse(BaseModel):
    id: str
    name: str
    desc: str
    category: str
    cat_tone: str
    mode: str
    duration: str
    dates: str
    days: str
    enrolled: int
    cap: int
    pct: int
    status: str
    note: str
    bar: str


class ProgramListResponse(BaseModel):
    items: list[ProgramResponse]
    total: int
    page: int
    page_size: int
    pages: int


class ProgramCreate(BaseModel):
    name: str
    desc: str = ""
    category: Category = "Digital Literacy"
    mode: Mode = "Online"
    duration: str = ""
    cap: int = 0
    startDate: str = ""
    days: str = ""
    status: ProgramStatus = "Draft"

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Program name cannot be empty")
        return v

    @field_validator("cap")
    @classmethod
    def cap_not_negative(cls, v: int) -> int:
        return max(0, v)


class ProgramUpdate(BaseModel):
    name: Optional[str] = None
    desc: Optional[str] = None
    category: Optional[Category] = None
    mode: Optional[Mode] = None
    duration: Optional[str] = None
    cap: Optional[int] = None
    startDate: Optional[str] = None
    days: Optional[str] = None
    enrolled: Optional[int] = None
    status: Optional[ProgramStatus] = None

    @field_validator("cap")
    @classmethod
    def cap_not_negative(cls, v: Optional[int]) -> Optional[int]:
        return None if v is None else max(0, v)

    @field_validator("enrolled")
    @classmethod
    def enrolled_not_negative(cls, v: Optional[int]) -> Optional[int]:
        return None if v is None else max(0, v)


class ProgramStatsResponse(BaseModel):
    total_programs: int
    active_programs: int
    upcoming_programs: int
    total_enrollments: int
    completion_rate: int


class OverviewPoint(BaseModel):
    label: str
    value: int


class ProgramOverviewResponse(BaseModel):
    range: str
    series: list[OverviewPoint]
    new_programs: int
    enrollments: str
    completions: str


class CategoryItem(BaseModel):
    name: str
    value: int
    color: str
