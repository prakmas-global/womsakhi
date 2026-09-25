from typing import Literal, Optional

from pydantic import BaseModel, field_validator

FeedbackType = Literal["Program Feedback", "Suggestion", "Complaint"]
FeedbackStatus = Literal["Resolved", "In Review", "Open"]
Sentiment = Literal["Positive", "Neutral", "Negative"]


class FeedbackReplyResponse(BaseModel):
    id: str
    by: str
    text: str
    at: str
    internal: bool      # a note for staff; she never sees it
    emailed: bool       # the reply actually left by email


class FeedbackResponse(BaseModel):
    id: str
    seq: int
    face: str
    face_tone: str
    text: str
    user: str
    email: str
    type: str
    t_type: str
    program: str
    rating: int
    sentiment: str
    date: str
    status: str
    s_tone: str
    created_at: str
    replies: list[FeedbackReplyResponse] = []


class FeedbackListResponse(BaseModel):
    items: list[FeedbackResponse]
    total: int
    page: int
    page_size: int
    pages: int


class FeedbackStatusUpdate(BaseModel):
    status: FeedbackStatus


class FeedbackReplyCreate(BaseModel):
    text: str
    internal: bool = False

    @field_validator("text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Write something first")
        return v[:4000]


class FeedbackRequestCreate(BaseModel):
    recipient: str      # her email
    program: str = ""
    message: str = ""


class FeedbackRequestResponse(BaseModel):
    id: str
    emailed: bool
    message: str


class FeedbackRequestRow(BaseModel):
    id: str
    recipient: str
    recipient_name: str
    program: str
    requested_by: str
    emailed: bool
    at: str


class FeedbackStatsResponse(BaseModel):
    # The stat cards, as the strings the UI prints. A delta is None when there
    # is nothing to compare against, and the card then shows no arrow.
    total_feedback: str
    average_rating: str
    positive_percentage: str
    positive_delta: Optional[str] = None
    positive_up: bool = True
    responses_this_month: str
    responses_delta: Optional[str] = None
    responses_up: bool = True
    feedback_users: str
    unresolved: int = 0
    programs: list[str] = []


class FeedbackOverviewItem(BaseModel):
    name: str
    value: int
    legend: str
    color: str


class FeedbackOverviewResponse(BaseModel):
    total: str
    center_label: str
    items: list[FeedbackOverviewItem]


class FeedbackThemeResponse(BaseModel):
    key: str
    label: str
    icon: str
    tone: str
    count: int
    mentions: str
    delta: Optional[str] = None
    up: bool = True


class FeedbackThemeListResponse(BaseModel):
    items: list[FeedbackThemeResponse]
    total: int


class ProgramRatingResponse(BaseModel):
    name: str
    rating: str
    count: int


class ProgramRatingListResponse(BaseModel):
    items: list[ProgramRatingResponse]
    total: int
