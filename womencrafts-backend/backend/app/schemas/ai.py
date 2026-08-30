from typing import Optional

from pydantic import BaseModel, field_validator

# Enums the UI uses — kept as Literal so Swagger renders proper dropdowns.
Tone = str  # one of: brand | violet | emerald | amber | sky | rose (presentation only)


class AiPriorityResponse(BaseModel):
    id: str
    text: str
    icon: str
    tone: str
    order: int


class AiHealthMetricResponse(BaseModel):
    id: str
    label: str
    value: int
    icon: str
    tone: str
    trend: str
    order: int


class AiHealthStatsResponse(BaseModel):
    """The Business Health Score radial gauge summary."""

    overall: int
    rating: str
    color: str
    center_label: str
    note: str


class AiTaskResponse(BaseModel):
    id: str
    title: str
    due: str
    priority: str
    icon: str
    done: bool
    order: int


class AiTaskStatsResponse(BaseModel):
    """Tab-badge counts for the High / Medium priority tabs."""

    high: int
    medium: int
    total: int


class AiTaskUpdate(BaseModel):
    """Toggle a task's completion. If 'done' is omitted, the flag is flipped."""

    done: Optional[bool] = None


class AiAgentResponse(BaseModel):
    id: str
    name: str
    icon: str
    tone: str
    metric: str
    label: str
    rate: str
    last_active: str
    status: str
    order: int


class AiInsightResponse(BaseModel):
    id: str
    title: str
    description: str
    action: str
    icon: str
    tone: str
    order: int


class AiActionResponse(BaseModel):
    id: str
    title: str
    description: str
    icon: str
    tone: str
    order: int


class AiActivityResponse(BaseModel):
    id: str
    time: str
    text: str
    status: str
    icon: str
    tone: str
    order: int


class AiMemoryStatResponse(BaseModel):
    id: str
    label: str
    value: str
    sub: str
    icon: str
    tone: str
    order: int


class AiPromptResponse(BaseModel):
    id: str
    text: str
    kind: str
    order: int


class AiChatRequest(BaseModel):
    question: str

    @field_validator("question")
    @classmethod
    def question_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Question cannot be empty")
        return v


class AiChatResponse(BaseModel):
    reply: str
