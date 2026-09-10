from typing import Optional

from pydantic import BaseModel, Field, field_validator


def _required(v: str, what: str) -> str:
    if not v or not v.strip():
        raise ValueError(what)
    return v.strip()


# --- circles -----------------------------------------------------------------

class CircleResponse(BaseModel):
    id: str
    name: str
    topic: str
    desc: str
    cover: str
    guidelines: str
    is_private: bool
    member_count: int
    post_count: int
    joined: bool
    #: Whether this circle collects money. Stated, not inferred from its name.
    is_savings: bool = False
    #: What each member pays per round, in minor units like every other amount.
    monthly_minor: int = 0
    #: Which round it is in. 0 when the circle does not collect money.
    round: int = 0


class CircleCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    topic: str = Field(default="", max_length=80)
    desc: str = Field(default="", max_length=600)
    is_private: bool = False
    #: A savings circle collects money. Said explicitly, because everything
    #: downstream — the Pay button, the pot, the turn order — hangs off it.
    is_savings: bool = False
    #: Each member's share per round, in minor units. Ignored unless savings.
    monthly_minor: int = Field(default=0, ge=0, le=10_000_000)


class CircleMemberRow(BaseModel):
    name: str
    avatar: str = ""
    #: The round she takes the pot. 0 when no order has been agreed.
    turn: int = 0
    paid: bool = False
    you: bool = False


class CircleSavingsResponse(BaseModel):
    """What the pay screen needs, in one request."""

    circle_id: str
    is_savings: bool
    monthly_minor: int
    round: int
    #: Everyone's contribution for this round added up, as it stands now.
    collected_minor: int
    #: What the pot is worth when everyone has paid.
    pot_minor: int
    members_total: int
    members_paid: int
    you_paid: bool
    #: Whose turn it is this round, if an order has been agreed.
    whose_turn: str = ""
    members: list[CircleMemberRow] = []


class ContributionResponse(BaseModel):
    id: str
    round: int
    amount_minor: int
    amount_label: str
    paid_on: str
    #: How many have paid after this payment, so the screen need not re-ask.
    members_paid: int
    members_total: int
    whose_turn: str = ""


class PostResponse(BaseModel):
    id: str
    circle_id: str
    author_name: str
    author_avatar: str
    body: str
    image: str
    likes: int
    liked_by_me: bool
    mine: bool
    reply_count: int
    pinned: bool
    when: str


class PostCreate(BaseModel):
    body: str
    image: str = ""

    @field_validator("body")
    @classmethod
    def has_body(cls, v: str) -> str:
        v = _required(v, "Write something first")
        if len(v) > 4000:
            raise ValueError("That's a bit long — keep it under 4000 characters")
        return v


class ReplyResponse(BaseModel):
    id: str
    author_name: str
    author_avatar: str
    body: str
    mine: bool
    when: str


class ReplyCreate(BaseModel):
    body: str

    @field_validator("body")
    @classmethod
    def has_body(cls, v: str) -> str:
        v = _required(v, "Write a reply first")
        if len(v) > 2000:
            raise ValueError("Keep replies under 2000 characters")
        return v


class LikeResponse(BaseModel):
    likes: int
    liked_by_me: bool


# --- stories -----------------------------------------------------------------

class StoryResponse(BaseModel):
    id: str
    author_name: str
    author_avatar: str
    title: str
    body: str
    program: str
    cover: str
    status: str
    featured: bool
    likes: int
    liked_by_me: bool
    mine: bool
    when: str


class StoryCreate(BaseModel):
    title: str
    body: str
    program: str = ""
    cover: str = ""
    allow_name: bool = True

    @field_validator("title")
    @classmethod
    def has_title(cls, v: str) -> str:
        v = _required(v, "Give your story a title")
        if len(v) > 140:
            raise ValueError("Keep the title under 140 characters")
        return v

    @field_validator("body")
    @classmethod
    def has_body(cls, v: str) -> str:
        v = _required(v, "Tell us your story")
        if len(v) < 40:
            raise ValueError("Tell us a little more — at least a few sentences")
        if len(v) > 8000:
            raise ValueError("That's very long — keep it under 8000 characters")
        return v


class CommunityOverview(BaseModel):
    """
    Everything `/app/circles` shows, in one request.

    The screen used to need three, in a fixed order: her circles, and only once
    those landed could it know WHICH circle the pot and the wall are about, so
    the other two waited on the first. That ordering is real — but it is the
    server's to resolve, where the step between them costs one query rather
    than a round trip from her phone.

    `circle_id` is the circle the other two fields describe, so the screen does
    not have to repeat the server's choice of which circle that is. It is null
    — with `savings` null and `posts` empty — when she has not joined one yet,
    which is a normal state for a new member and not an error.
    """

    circles: list[CircleResponse]
    circle_id: str | None = None
    savings: CircleSavingsResponse | None = None
    posts: list[PostResponse] = []
