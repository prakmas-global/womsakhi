from typing import Literal, Optional

from pydantic import BaseModel

NotifType = Literal[
    "appointment",
    "message",
    "user",
    "payment",
    "alert",
    "feedback",
    "program",
    "system",
]
NotifGroup = Literal["Today", "Yesterday", "Earlier"]


class NotificationResponse(BaseModel):
    id: str
    type: str
    title: str
    desc: str
    time: str
    group: str
    unread: bool


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    total: int
    page: int
    page_size: int
    pages: int


# --- Grouped feed (Today / Yesterday / Earlier sections) ----------------------

class NotificationSection(BaseModel):
    group: str
    rows: list[NotificationResponse]


class NotificationGroupedResponse(BaseModel):
    sections: list[NotificationSection]
    total: int
    unread: int


# --- Stats payload (5 stat cards + By-Category donut) -------------------------

class NotifStatCard(BaseModel):
    key: str
    label: str
    value: str
    icon: str
    tone: str
    delta: Optional[str] = None
    delta_note: Optional[str] = None


class NotifCategory(BaseModel):
    name: str
    value: int
    color: str


class NotificationStatsResponse(BaseModel):
    stat_cards: list[NotifStatCard]
    categories: list[NotifCategory]
    category_total: str
    center_label: str


# --- Delivery channels --------------------------------------------------------

class ChannelResponse(BaseModel):
    id: str
    label: str
    icon: str
    on: bool


class ChannelListResponse(BaseModel):
    items: list[ChannelResponse]
    total: int


class ChannelUpdate(BaseModel):
    on: bool


# --- Simple mutation results --------------------------------------------------

class ReadAllResponse(BaseModel):
    updated_count: int


class MessageResponse(BaseModel):
    message: str
