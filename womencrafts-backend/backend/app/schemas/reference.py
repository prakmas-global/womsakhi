"""Request and response shapes for curated reference data."""

from typing import Any, Optional

from pydantic import BaseModel, Field

from app.models.reference import MyReferenceModel


class MyState(BaseModel):
    state: str
    note: str
    since: str


class ReferenceResponse(BaseModel):
    id: str
    topic: str
    title: str
    body: str
    city: str
    # `free` is deliberately three-valued. True is free, False costs money, and
    # None means nobody has established which — and a screen that renders None
    # as "paid" tells a woman something untrue about what she is entitled to.
    free: Optional[bool] = None
    cost_label: str
    who: str
    payload: dict[str, Any]
    mine: Optional[MyState] = None


class MarkRequest(BaseModel):
    state: str = Field(..., description=" | ".join(MyReferenceModel.STATES))
    note: str = Field("", max_length=600)
