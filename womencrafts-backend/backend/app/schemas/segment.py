from typing import Literal, Optional

from pydantic import BaseModel, field_validator

SegmentStatus = Literal["Active", "Inactive"]


class SegmentRule(BaseModel):
    """
    What a segment matches. Every field is optional; a field left out (None)
    means "any", and an explicit "" means "not set" — so "members with no
    segment yet" is expressible without a sentinel.
    """
    segment: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None


class SegmentResponse(BaseModel):
    id: str
    name: str
    desc: str
    status: str
    icon: str
    # Only the keys that are set, so a client never sees `"role": null` and
    # mistakes it for "role is null".
    rule: dict[str, str]
    # Counted live from the members directory on every read.
    member_count: int
    active_count: int
    active_pct: float
    pct_of_total: float
    new_30d: int
    prev_30d: int
    created_at: str
    # The older display fields, still filled — from the live numbers above —
    # so nothing that read them breaks.
    users: str
    pct: str
    eng: int
    growth: str
    up: bool


class SegmentListResponse(BaseModel):
    items: list[SegmentResponse]
    total: int
    members_total: int
    unsegmented: int


class SegmentCreate(BaseModel):
    name: str
    desc: str = ""
    status: SegmentStatus = "Active"
    icon: str = "Users"
    rule: SegmentRule = SegmentRule()

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Segment name cannot be empty")
        return v[:80]


class SegmentUpdate(BaseModel):
    name: Optional[str] = None
    desc: Optional[str] = None
    status: Optional[SegmentStatus] = None
    icon: Optional[str] = None
    rule: Optional[SegmentRule] = None

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if not v:
            raise ValueError("Segment name cannot be empty")
        return v[:80]


class SegmentSeries(BaseModel):
    id: str
    name: str
    points: list[int]


class SegmentGrowthResponse(BaseModel):
    labels: list[str]
    series: list[SegmentSeries]
