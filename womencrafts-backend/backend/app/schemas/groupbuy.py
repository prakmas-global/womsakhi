"""Request and response shapes for buying together."""

from pydantic import BaseModel, Field


class GroupBuyResponse(BaseModel):
    id: str
    item: str
    unit: str
    alone_minor: int
    together_minor: int
    saving_minor: int
    saving_label: str
    needed: int
    joined: int
    still_needed: int
    full: bool
    supplier: str
    note: str
    status: str
    closes: str
    closed: bool
    joined_by_me: bool


class JoinRequest(BaseModel):
    quantity: int = Field(1, ge=1, le=50, description="How many units she wants")
