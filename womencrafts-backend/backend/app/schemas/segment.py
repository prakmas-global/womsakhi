from typing import Literal, Optional

from pydantic import BaseModel, field_validator

SegmentStatus = Literal["Active", "Inactive"]


class SegmentResponse(BaseModel):
    id: str
    name: str
    desc: str
    users: str
    pct: str
    eng: int
    growth: str
    up: bool
    status: str
    icon: str


class SegmentListResponse(BaseModel):
    items: list[SegmentResponse]
    total: int


class SegmentCreate(BaseModel):
    name: str
    desc: str = ""
    users: str = "0"
    pct: str = "0%"
    eng: int = 0
    growth: str = "0%"
    up: bool = True
    status: SegmentStatus = "Active"
    icon: str = "Users"

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Segment name cannot be empty")
        return v


class SegmentUpdate(BaseModel):
    name: Optional[str] = None
    desc: Optional[str] = None
    users: Optional[str] = None
    pct: Optional[str] = None
    eng: Optional[int] = None
    growth: Optional[str] = None
    up: Optional[bool] = None
    status: Optional[SegmentStatus] = None
    icon: Optional[str] = None
