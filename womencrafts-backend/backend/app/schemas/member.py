from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, field_validator

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
    avatar: str = ""  # URL returned by POST /uploads

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
    avatar: Optional[str] = None

    @field_validator("engagement")
    @classmethod
    def engagement_in_range(cls, v: Optional[int]) -> Optional[int]:
        return None if v is None else max(0, min(100, v))


class MemberStatusUpdate(BaseModel):
    status: Status


class MemberStatsResponse(BaseModel):
    total: int
    active: int
    inactive: int
    pending: int
    rejected: int
    avg_engagement: float
    by_role: dict[str, int]
    by_segment: dict[str, int]
