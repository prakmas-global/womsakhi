"""Shapes for the staff inbox (routes/messages.py)."""

from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

ThreadFilter = Literal["all", "awaiting", "unread", "mine", "unassigned", "resolved"]
ThreadStatus = Literal["open", "resolved"]


class Assignee(BaseModel):
    id: str
    name: str


class ThreadMessage(BaseModel):
    id: str
    sender: str            # "member" | "team"
    sender_name: str
    body: str
    sent_at: str           # ISO 8601
    sent_label: str
    # Whether the *other* side has read it. Stored flags, not a guess.
    read_by_member: bool
    read_by_team: bool


class ThreadRow(BaseModel):
    user_id: str
    full_name: str
    email: str
    avatar: str
    message_count: int
    unread: int                       # her messages the team has not read
    last_message: str
    last_sender: str                  # "member" | "team" | ""
    last_at: Optional[str] = None     # ISO
    last_label: str = ""
    # When the oldest still-unanswered message from her arrived. None when the
    # last word was the team's.
    waiting_since: Optional[str] = None
    status: ThreadStatus = "open"
    reopened: bool = False            # she wrote again after it was resolved
    resolved_at: Optional[str] = None
    resolved_by_name: str = ""
    assigned_to: Optional[Assignee] = None


class ThreadCounts(BaseModel):
    all: int
    awaiting: int
    unread: int          # threads with at least one unread message
    mine: int
    unassigned: int
    resolved: int


class ThreadListResponse(BaseModel):
    items: list[ThreadRow]
    total: int
    page: int
    page_size: int
    pages: int
    counts: ThreadCounts


class MemberCard(BaseModel):
    """What the panel beside a thread may show. Nothing private: no vault,
    no in-case-of-emergency data, no documents."""
    id: str
    full_name: str
    email: str
    avatar: str
    joined_at: Optional[str] = None
    verification_status: str = ""
    is_active: bool = True


class ThreadDetail(ThreadRow):
    member: MemberCard
    messages: list[ThreadMessage]
    first_at: Optional[str] = None
    last_team_at: Optional[str] = None
    last_member_at: Optional[str] = None
    assigned_at: Optional[str] = None


class ReplyRequest(BaseModel):
    body: str

    @field_validator("body")
    @classmethod
    def not_empty(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("Write something first")
        return v[:2000]


class StartThreadRequest(ReplyRequest):
    user_id: str = Field(min_length=1)


class AssignRequest(BaseModel):
    # Empty / null clears the assignment.
    staff_id: Optional[str] = None


class MemberHit(BaseModel):
    id: str
    full_name: str
    email: str
    avatar: str
    has_thread: bool


class StaffOption(BaseModel):
    id: str
    full_name: str
    role: str


class MessageStats(BaseModel):
    threads: int
    open: int
    resolved: int
    awaiting_reply: int
    unread_messages: int
    sent_by_team: int
    received_from_members: int
    received_this_week: int
    sent_this_week: int
    # Median minutes from a member's message to the team's next reply, over
    # every measured pair. None until at least one reply has been sent.
    median_first_reply_minutes: Optional[int] = None
    replies_measured: int = 0
    # Share of measured replies that came within 24 hours. None when unmeasured.
    replied_within_24h_pct: Optional[int] = None


class SimpleMessage(BaseModel):
    message: str
