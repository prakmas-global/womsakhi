"""Request and response shapes for assessments and digital literacy."""

from typing import Optional

from pydantic import BaseModel, Field


class Question(BaseModel):
    n: int
    ask: str
    options: list[str]


class AssessmentResponse(BaseModel):
    id: str
    skill: str
    title: str
    blurb: str
    minutes: int
    pass_mark: int
    question_count: int
    best_score: Optional[int] = None
    passed: bool
    attempts: int
    questions: list[Question] = []


class AttemptRequest(BaseModel):
    answers: list[int] = Field(..., description="Chosen option index per question, in order")


class AttemptResponse(BaseModel):
    id: str
    assessment_id: str
    score: int
    passed: bool
    taken_on: str


class DigitalStepResponse(BaseModel):
    id: str
    n: int
    label: str
    note: str
    minutes: int
    done: bool
