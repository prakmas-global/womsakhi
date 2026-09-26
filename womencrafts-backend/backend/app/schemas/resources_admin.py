"""
Shapes for the staff side of Resources: the reference catalogue and the
wellbeing cards.

Two rules shaped these:

- **Uptake is a count, never a list.** `reference_mine` is a woman's private
  record of what she has done about an entry. Staff may know that forty women
  marked a scheme "applied"; they may never see which forty.
- **A card carries its review state in the fields the engine reads.**
  `moods`, `styles`, `reviewed` are what `engines/mood.py` filters on, so the
  shapes here keep those names exactly.
"""

from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator

from app.engines.mood import MOODS, STYLES
from app.models.reference import ReferenceModel

CARD_KINDS = ("word", "do")


def _required(v: str, message: str) -> str:
    if not v or not v.strip():
        raise ValueError(message)
    return v.strip()


# --- paging -------------------------------------------------------------------

class PageMeta(BaseModel):
    total: int
    page: int
    page_size: int
    pages: int


# --- the catalogue ------------------------------------------------------------

class ReferenceUpsert(BaseModel):
    topic: str
    title: str
    body: str = ""
    city: str = ReferenceModel.EVERYWHERE
    rank: int = Field(100, ge=0, le=100000)
    free: Optional[bool] = None
    cost_label: str = ""
    who: str = ""
    payload: dict[str, Any] = Field(default_factory=dict)

    @field_validator("topic")
    @classmethod
    def _topic(cls, v: str) -> str:
        if v not in ReferenceModel.TOPICS:
            raise ValueError("That is not a topic the catalogue has")
        return v

    @field_validator("title")
    @classmethod
    def _title(cls, v: str) -> str:
        return _required(v, "A title is needed")

    @field_validator("city")
    @classmethod
    def _city(cls, v: str) -> str:
        return (v or "").strip() or ReferenceModel.EVERYWHERE


class ReferenceRow(BaseModel):
    id: str
    topic: str
    title: str
    body: str
    city: str
    rank: int
    free: Optional[bool]
    cost_label: str
    who: str
    payload: dict[str, Any]
    status: str
    reviewed_by: str
    reviewed_at: str
    created_at: str
    updated_at: str
    #: How many members have marked this entry, in any state. A count only.
    uptake: int
    #: The same count split by state — saved / applied / active / done /
    #: declined. Filled on the detail call, empty on the list.
    uptake_by_state: dict[str, int] = Field(default_factory=dict)


class ReferencePage(BaseModel):
    items: list[ReferenceRow]
    meta: PageMeta


class TopicCount(BaseModel):
    topic: str
    label: str
    published: int
    draft: int
    archived: int
    total: int


class CatalogueCounts(BaseModel):
    published: int
    draft: int
    archived: int
    total: int
    #: Rows in reference_mine across the whole catalogue. A count only.
    marks: int


class ReviewCounts(BaseModel):
    total: int
    reviewed: int
    unreviewed: int


class ResourcesSummary(BaseModel):
    catalogue: CatalogueCounts
    topics: list[TopicCount]
    cards: ReviewCounts
    activities: ReviewCounts


# --- wellbeing ----------------------------------------------------------------

class CardUpsert(BaseModel):
    title: str
    body: str
    kind: str = "word"
    moods: list[str]
    styles: list[str]
    minutes: int = Field(0, ge=0, le=60)

    @field_validator("title")
    @classmethod
    def _title(cls, v: str) -> str:
        return _required(v, "A title is needed")

    @field_validator("body")
    @classmethod
    def _body(cls, v: str) -> str:
        return _required(v, "The card needs some words")

    @field_validator("kind")
    @classmethod
    def _kind(cls, v: str) -> str:
        if v not in CARD_KINDS:
            raise ValueError("A card is either something to read (word) or something to do (do)")
        return v

    @field_validator("moods")
    @classmethod
    def _moods(cls, v: list[str]) -> list[str]:
        cleaned = [m for m in dict.fromkeys(v) if m]
        if not cleaned:
            raise ValueError("Pick at least one mood the card answers")
        bad = [m for m in cleaned if m not in MOODS]
        if bad:
            raise ValueError(f"Unknown mood: {', '.join(bad)}")
        return cleaned

    @field_validator("styles")
    @classmethod
    def _styles(cls, v: list[str]) -> list[str]:
        cleaned = [s for s in dict.fromkeys(v) if s]
        if not cleaned:
            raise ValueError("Pick at least one style the card suits")
        bad = [s for s in cleaned if s not in STYLES]
        if bad:
            raise ValueError(f"Unknown style: {', '.join(bad)}")
        return cleaned


class CardRow(BaseModel):
    id: str
    title: str
    body: str
    kind: str
    moods: list[str]
    styles: list[str]
    minutes: int
    reviewed: bool
    reviewed_by: str
    reviewed_at: str
    #: Came from the engine's seed rather than a person on this screen.
    seeded: bool
    created_at: str
    updated_at: str


class CardPage(BaseModel):
    items: list[CardRow]
    meta: PageMeta


class ActivityUpsert(BaseModel):
    text: str
    #: Finishable in under fifteen minutes with nothing to buy and nobody to
    #: ask — the engine's own rule, enforced where the row is made.
    minutes: int = Field(..., ge=1, le=15)
    icon: str = ""

    @field_validator("text")
    @classmethod
    def _text(cls, v: str) -> str:
        return _required(v, "Say what to do")

    @field_validator("icon")
    @classmethod
    def _icon(cls, v: str) -> str:
        return (v or "").strip()[:40]


class ActivityRow(BaseModel):
    id: str
    text: str
    minutes: int
    icon: str
    reviewed: bool
    reviewed_by: str
    reviewed_at: str
    seeded: bool
    created_at: str
    updated_at: str


class ActivityPage(BaseModel):
    items: list[ActivityRow]
    meta: PageMeta
