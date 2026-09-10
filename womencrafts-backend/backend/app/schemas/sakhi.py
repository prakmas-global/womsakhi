"""Request and response shapes for the assistant."""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)
    conversation_id: Optional[str] = None


class ConfirmRequest(BaseModel):
    conversation_id: str
    action_id: str
    approve: bool


class SakhiMessage(BaseModel):
    id: str
    kind: str
    text: str
    meta: dict = {}
    created_at: Optional[datetime] = None


class PendingAction(BaseModel):
    id: str
    tool: str
    sentence: str


class Conversation(BaseModel):
    id: str
    title: str
    audience: str
    locale: str = "en"
    message_count: int = 0
    pinned: bool = False
    pending_action: Optional[dict] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class RenameRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)


class PinRequest(BaseModel):
    pinned: bool


class FeedbackRequest(BaseModel):
    """Thumbs on one answer. `None` clears it, which is how a mis-tap is undone."""

    helpful: bool | None = None


class SaveRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=8000)
    conversation_id: str = ""


class SavedAnswer(BaseModel):
    id: str
    text: str
    conversation_id: str = ""
    created_at: datetime | None = None


class ConversationDetail(Conversation):
    messages: list[SakhiMessage] = []


class SpeakRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=1200)
    locale: Optional[str] = None


class SpeechResponse(BaseModel):
    """Audio plus the mouth track that goes with it.

    They travel together on purpose: the browser needs both to start at the same
    instant, and a second round trip for the timings would guarantee they don't.
    """
    audio: str                 # base64 mp3
    mime: str = "audio/mpeg"
    duration_ms: int = 0
    mouth: list[dict] = []
    voice: str = ""


class SakhiMemory(BaseModel):
    id: str
    fact: str
    created_at: Optional[datetime] = None


class SakhiStatus(BaseModel):
    """What the client needs to decide whether to show her at all."""
    enabled: bool
    provider: str
    voice: bool
    budget: dict
    disclosure: str


class MessageResponse(BaseModel):
    message: str
