"""Shapes for a member's own conversations."""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class Bubble(BaseModel):
    dir: str
    text: str = ""
    file: Optional[dict] = None
    order: Optional[dict] = None
    at: Optional[datetime] = None
    read: bool = False


class ConversationRow(BaseModel):
    id: str
    kind: str
    name: str
    avatar: str = ""
    online: bool = False
    subtitle: str = ""
    preview: str = ""
    last_at: Optional[datetime] = None
    unread: int = 0
    # When the oldest unanswered incoming message arrived, or null.
    waiting_since: Optional[datetime] = None
    starred: bool = False
    context: Optional[dict] = None
    party: dict[str, Any] = {}


class ConversationDetail(ConversationRow):
    messages: list[Bubble] = []


class SendMessage(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)


class StarRequest(BaseModel):
    starred: bool


class MessageResponse(BaseModel):
    message: str


class InboxSummary(BaseModel):
    """The three figures above the inbox."""

    waiting: int = 0
    open_order_minor: int = 0
    reply_minutes: Optional[int] = None
    counts: dict[str, int] = {}
