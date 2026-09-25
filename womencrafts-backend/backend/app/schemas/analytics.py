from typing import Literal

from typing import Optional

from pydantic import BaseModel

Direction = Literal["up", "down"]
PageTone = Literal["emerald", "amber", "rose"]


class StatCard(BaseModel):
    """One of the 5 headline stat cards at the top of the Analytics page."""

    key: str
    label: str
    value: str
    icon: str
    tone: str
    delta: Optional[str] = None  # None when the previous period had nothing to compare
    delta_dir: Direction


class RealtimeResponse(BaseModel):
    """The 'Realtime' live-visitors block on the bottom-right of the page."""

    active: int
    change: int
    change_dir: Direction


class SummaryResponse(BaseModel):
    """5 stat cards + the realtime block (also served at /analytics/stats)."""

    stats: list[StatCard]
    members_total: int = 0  # every member in the directory, for the by-segment donut centre
    realtime: RealtimeResponse


class TrafficPointResponse(BaseModel):
    order: int
    label: str
    value: int


class DeviceResponse(BaseModel):
    name: str
    value: int
    color: str


class SourceResponse(BaseModel):
    label: str
    value: int
    color: str


class EngagementPointResponse(BaseModel):
    order: int
    label: str
    sessions: int
    users: int


class TopPageResponse(BaseModel):
    page: str
    views: str
    unique: str
    bounce: int
    time: str
    tone: str


class ReferrerResponse(BaseModel):
    name: str
    visits: str
    pct: int
    color: str


class OverviewResponse(BaseModel):
    """
    Everything the page needs in one call: the stat cards, the realtime block,
    and every chart/table dataset — mirrors how the screen loads at once.
    """

    stats: list[StatCard]
    realtime: RealtimeResponse
    traffic: list[TrafficPointResponse]
    devices: list[DeviceResponse]
    sources: list[SourceResponse]
    engagement: list[EngagementPointResponse]
    top_pages: list[TopPageResponse]
    referrers: list[ReferrerResponse]
