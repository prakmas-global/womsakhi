from typing import Literal

from pydantic import BaseModel

FeedbackType = Literal["Program Feedback", "Suggestion", "Complaint"]
FeedbackStatus = Literal["Resolved", "In Review", "Open"]
Sentiment = Literal["Positive", "Neutral", "Negative"]


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


class FeedbackListResponse(BaseModel):
    items: list[FeedbackResponse]
    total: int
    page: int
    page_size: int
    pages: int


class FeedbackStatusUpdate(BaseModel):
    status: FeedbackStatus


class FeedbackRequestCreate(BaseModel):
    recipient: str
    program: str = ""
    message: str = ""


class FeedbackRequestResponse(BaseModel):
    message: str


class FeedbackStatsResponse(BaseModel):
    # The five stat cards, as the exact strings the UI prints.
    total_feedback: str
    average_rating: str
    positive_percentage: str
    positive_delta: str
    responses_this_month: str
    responses_delta: str
    feedback_users: str


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
    id: str
    seq: int
    label: str
    icon: str
    tone: str
    mentions: str
    delta: str
    up: bool


class FeedbackThemeListResponse(BaseModel):
    items: list[FeedbackThemeResponse]
    total: int


class ProgramRatingResponse(BaseModel):
    id: str
    seq: int
    name: str
    rating: str


class ProgramRatingListResponse(BaseModel):
    items: list[ProgramRatingResponse]
    total: int
