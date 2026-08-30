from typing import Literal, Optional

from pydantic import AliasChoices, BaseModel, Field, field_validator, model_validator

# Enums (Literal so Swagger renders proper dropdowns) ---------------------------
Direction = Literal["in", "out"]
FilterKind = Literal["all", "unread", "starred", "attachments"]
FlagAction = Literal["star", "unstar", "toggle_star", "mark_unread", "archive", "read"]
BroadcastAudience = Literal["All users", "Active users", "Workshop enrollees", "Starred contacts"]
StatsRange = Literal["This Week", "This Month", "This Quarter", "This Year"]


class MessageFile(BaseModel):
    name: str
    size: str


class MessageBubble(BaseModel):
    dir: str
    text: Optional[str] = None
    file: Optional[MessageFile] = None
    time: str


class ConversationResponse(BaseModel):
    id: str
    name: str
    preview: str
    time: str
    unread: int
    starred: bool
    active: bool
    has_attachment: bool
    messages: list[MessageBubble]


class ConversationListResponse(BaseModel):
    items: list[ConversationResponse]
    total: int
    page: int
    page_size: int
    pages: int


class ConversationCreate(BaseModel):
    # The New Message modal posts a recipient name; accept either key.
    name: str = Field(..., validation_alias=AliasChoices("name", "recipient"))
    body: str = ""

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("Recipient is required")
        return v


class MessageCreate(BaseModel):
    dir: Direction = "out"
    text: Optional[str] = None
    file: Optional[MessageFile] = None
    time: Optional[str] = None

    @model_validator(mode="after")
    def require_text_or_file(self) -> "MessageCreate":
        if not (self.text and self.text.strip()) and not self.file:
            raise ValueError("Provide either 'text' or 'file'")
        return self


class ConversationFlagUpdate(BaseModel):
    # High-level action (matches the chat menu) …
    action: Optional[FlagAction] = None
    # … or direct flag overrides.
    starred: Optional[bool] = None
    unread: Optional[int] = None
    active: Optional[bool] = None


class BroadcastCreate(BaseModel):
    recipients: BroadcastAudience = "All users"
    body: str

    @field_validator("body")
    @classmethod
    def body_not_empty(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("Broadcast message cannot be empty")
        return v


class OverviewSlice(BaseModel):
    name: str
    value: int
    pct: str
    color: str


class TopContact(BaseModel):
    name: str
    count: int
    badge: int


class MessageStatsResponse(BaseModel):
    total_conversations: int
    messages_sent: int
    messages_received: int
    avg_response_time: str
    resolved_conversations: int
    overview_total: int
    overview: list[OverviewSlice]
    top_contacts: list[TopContact]
    range: str = "This Month"


class SimpleListResponse(BaseModel):
    """Plain string list used for contacts, templates and automations."""

    items: list[str]


class BroadcastResult(BaseModel):
    message: str
    recipients: str
    sent: int
