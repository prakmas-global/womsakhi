"""Request and response shapes for skill exchange."""

from typing import Optional

from pydantic import BaseModel, Field


class SwapResponse(BaseModel):
    id: str
    who: str
    avatar: str
    skill: str
    detail: str
    wants: str
    place: str
    online: bool
    tags: list[str]
    status: str
    asked: bool
    mine: bool


class SwapCreate(BaseModel):
    skill: str = Field(..., min_length=2, max_length=80, description="What she can teach")
    wants: str = Field(..., min_length=2, max_length=80, description="What she wants to learn")
    detail: str = Field("", max_length=600)
    place: str = Field("", max_length=80)
    online: bool = False
    tags: list[str] = []


class Agreement(BaseModel):
    """
    What the two of them actually settled.

    Stored once and pinned above the conversation, because an agreement that
    lives only in a chat thread is one both women remember differently a month
    later — and neither of them is lying.
    """

    i_teach: str = Field(..., max_length=120)
    she_teaches: str = Field(..., max_length=120)
    sessions_each: int = Field(..., ge=1, le=52)


class Message(BaseModel):
    mine: bool
    text: str
    at: str


class ExchangeResponse(BaseModel):
    id: str
    swap_id: str
    agreed: bool
    agreement: Optional[Agreement] = None
    messages: list[Message]


class SendMessage(BaseModel):
    text: str = Field(..., min_length=1, max_length=1200)


class ThreadSummary(BaseModel):
    """
    One live exchange, from her side.

    `you_teach` and `you_learn` are named from HER point of view rather than
    stored that way, because the same agreement reads backwards depending on
    who is looking at it — and a screen that shows her own side as the other
    woman's gets somebody to turn up expecting to be taught.
    """

    id: str
    swap_id: str
    with_whom: str
    avatar: str
    you_teach: str
    you_learn: str
    state: str
    next_step: str
