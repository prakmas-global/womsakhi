from typing import Literal, Optional

from pydantic import BaseModel

SessionStatus = Literal["Active", "Signed Out"]
LogLevel = Literal["Info", "Success", "Warning", "Error"]


# --- Sessions -----------------------------------------------------------------

class SessionResponse(BaseModel):
    id: str
    device_type: str
    device: str
    details: str
    location: str
    ip: str
    status: str
    is_current: bool
    tag: Optional[str] = None
    location_note: Optional[str] = None
    last_active: Optional[str] = None
    last_active_at: Optional[str] = None
    login_time: Optional[str] = None
    logout_time: Optional[str] = None


class SessionListResponse(BaseModel):
    items: list[SessionResponse]
    total: int


class SessionStatCard(BaseModel):
    label: str
    value: str
    icon: str
    tone: str          # "violet" | "emerald" | "amber"
    note: str
    # Semantic tone, never a class name. This used to be `note_color` carrying
    # a Tailwind class straight to the browser, which put a styling decision in
    # Python where no frontend colour audit could see it — and shipped text at
    # 2.37:1. The API describes meaning; the client picks the colour.
    note_tone: Literal["ok", "subtle", "warn", "danger"] = "subtle"
    value_class: Optional[str] = None  # e.g. "text-lg" for wide values


class SessionStatsResponse(BaseModel):
    stat_cards: list[SessionStatCard]


class RevokeResult(BaseModel):
    """Result of signing out / revoking sessions."""

    revoked: int
    message: str


# --- System logs --------------------------------------------------------------

class SystemLogResponse(BaseModel):
    id: str
    time: str
    level: str
    source: str
    message: str
    user: str
    ip: str


class SystemLogListResponse(BaseModel):
    items: list[SystemLogResponse]
    total: int
    page: int
    page_size: int
    pages: int


class LogStatCard(BaseModel):
    label: str
    value: str
    icon: str
    tone: str          # "violet" | "rose" | "amber" | "sky"
    delta_note: str


class LogLevelSlice(BaseModel):
    name: str
    value: int
    color: str


class RecentError(BaseModel):
    message: str
    when: str


class SystemLogStatsResponse(BaseModel):
    stat_cards: list[LogStatCard]
    level_distribution: list[LogLevelSlice]
    level_total: str
    recent_errors: list[RecentError]
