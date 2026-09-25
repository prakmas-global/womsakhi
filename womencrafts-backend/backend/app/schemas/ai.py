from typing import Any, Literal, Optional

from pydantic import BaseModel, field_validator


class Priority(BaseModel):
    key: str
    icon: str
    tone: str
    count: int
    text: str
    href: str


class HealthIndicator(BaseModel):
    key: str
    icon: str
    tone: str
    label: str
    value: Optional[int] = None    # 0–100; None when there is nothing to measure yet
    measures: str                  # what the number actually is
    detail: str                    # the figures behind it


class HealthResponse(BaseModel):
    overall: Optional[int] = None
    rating: str
    color: str
    measured: int                  # how many indicators had data
    indicators: list[HealthIndicator]


class Insight(BaseModel):
    key: str
    icon: str
    tone: str
    title: str
    description: str
    href: str


class OverviewResponse(BaseModel):
    generated_at: str
    note: str                      # what this screen is and is not
    priorities: list[Priority]
    health: HealthResponse
    insights: list[Insight]


class TaskResponse(BaseModel):
    id: str
    title: str
    notes: str
    priority: Literal["high", "medium", "low"]
    due: str                       # YYYY-MM-DD or ""
    done: bool
    done_at: Optional[str] = None
    href: str
    assignee_id: str
    assignee_name: str
    created_by_name: str
    created_at: str
    overdue: bool


class TaskCreate(BaseModel):
    title: str
    notes: str = ""
    priority: Literal["high", "medium", "low"] = "medium"
    due: str = ""
    href: str = ""
    assignee_id: str = ""          # "" = unassigned, "me" = the caller

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Give the task a title")
        return v[:200]


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None
    priority: Optional[Literal["high", "medium", "low"]] = None
    due: Optional[str] = None
    href: Optional[str] = None
    assignee_id: Optional[str] = None
    done: Optional[bool] = None


class TaskStats(BaseModel):
    open: int
    done: int
    overdue: int
    mine: int


class ActivityRow(BaseModel):
    id: str
    at: str
    who: str
    action: str
    category: str
    detail: str


class AskRequest(BaseModel):
    question: str


class AskResponse(BaseModel):
    answer: str
    figures: dict[str, Any] = {}
    href: str = ""
    understood: bool               # False when the question is outside what can be answered
    can_answer: list[str]          # the questions this box can answer
