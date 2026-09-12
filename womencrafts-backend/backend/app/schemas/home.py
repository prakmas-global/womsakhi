"""
The shape of the member's home screen.

Every model here exists for one reason: the home screen was built against a
file of twenty-five invented constants — a balance of ₹24,350, a client called
BrandStory, a ranking that said she was "ahead of 68% of women in your circle".
This is the contract that replaces them with what the database actually knows.

Two rules govern what may appear below, and both are about trust rather than
tidiness:

**Nothing is flattened that already has a shape.** `progress`, `circles`,
`stories`, `opportunities` and `notifications` are the SAME models their own
endpoints return, exactly as `MeShell` and `MeJourney` decided before this.
A flattened copy is a second definition of the same thing, and the day one of
them gains a field the other silently does not.

**Nothing is invented.** Where the mock showed a number this system does not
know — how many days in a row she has opened the app, how she compares to
other women, how many minutes of a course are left — the field is here and it
is `None`, with a comment saying what would have to exist for it to be a
number. A null the screen can hide is honest; a plausible figure is not, and
on an app about money a plausible figure is the whole problem.
"""

from typing import Optional

from pydantic import BaseModel

from app.schemas.catalog import CatalogProgram
from app.schemas.community import CircleResponse, StoryResponse
from app.schemas.growth import OpportunityResponse
from app.schemas.me import (
    HomeMoney,
    MemberNotification,
    ProgressResponse,
    UnreadCounts,
)


# --- who she is --------------------------------------------------------------

class HomeProfileStep(BaseModel):
    """
    One thing she could still fill in — and only things this system can check.

    The mock listed "Verify your phone number" as a step. Nothing on this
    platform verifies a phone number, so a tick beside it would have meant
    nothing and the step could never have been completed. Every step here is a
    field that is either stored or empty, so `done` is a fact.
    """

    key: str
    label: str
    done: bool
    href: str


class HomeProfile(BaseModel):
    """
    How complete her profile is, counted once.

    The mock computed this twice — a rail that counted the steps and said 60%,
    and a hand-set `profilePct` of 80 on the same screen. `pct` here is derived
    from `steps` and nothing else, so the two cannot disagree.
    """

    pct: int
    steps: list[HomeProfileStep]


class HomeMe(BaseModel):
    first: str
    name: str
    avatar: str
    #: She has been admitted — a human read her documents and let her in. This
    #: is always true behind the member gate, which is the point: every woman
    #: who can see this screen passed that review. It is NOT a separate
    #: identity-verified badge, because there isn't one.
    verified: bool
    unread: UnreadCounts
    profile: HomeProfile


# --- what she is learning ----------------------------------------------------

class HomeLesson(BaseModel):
    n: int
    title: str
    #: Whatever the programme's own curriculum said — often "", because most
    #: programmes were seeded without durations. Empty means unknown, and the
    #: card must say nothing rather than guess.
    duration: str = ""
    done: bool


class HomeJourney(BaseModel):
    """
    The course she is working on now — the enrolment she touched most recently.

    `None` when she has joined no programme. That is a first run, not an error:
    the screen shows her somewhere to start rather than an empty progress ring.
    """

    enrollment_id: str
    program_id: str
    title: str
    category: str = ""
    cover: str = ""
    pct: int
    done: int
    total: int
    #: The next three lessons, so the card can list them without a second call.
    up_next: list[HomeLesson]
    href: str
    #: Minutes left in the course. Null until programmes carry per-lesson
    #: durations — summing empty strings would be an invented number, and this
    #: is the one the mock printed most confidently ("96 min left").
    left_mins: Optional[int] = None


class HomeNextStep(BaseModel):
    """
    The one thing to do next, and why it is the one.

    `because` is the field that matters. "Finish this lesson" is an
    instruction; "one lesson left before your certificate" is a reason, and a
    reason is something she can disagree with. It is arithmetic on her
    enrolment — how many lessons remain — never a motivational line.
    """

    title: str
    because: str
    href: str
    cta: str
    icon: str
    duration: str = ""


# --- money -------------------------------------------------------------------

class HomeEarnings(BaseModel):
    """
    Her money, and the only context that makes a number mean anything.

    `money` is `HomeMoney` unchanged — the model that already decided what a
    home screen may say about a woman's earnings. The rest is the sparkline,
    taken from the same twelve-month aggregation the Earn screen's rail reads.
    """

    money: HomeMoney
    #: Twelve months of credits, oldest first, in minor units. A month with no
    #: earnings is a 0, not a gap — an empty month is information.
    series_minor: list[int]
    series_labels: list[str]
    #: Where the money came from, largest first. Empty for a member who has
    #: never been credited.
    sources: list[dict]
    #: This month against last, as a percentage. **Null when last month was
    #: zero** — everything is an infinite increase on nothing, and "+∞%" or a
    #: silent "+100%" is the kind of flattery that costs trust the first time
    #: she checks it against her own records.
    delta_pct: Optional[float] = None
    #: Always null. The mock said "ahead of 68% of women in your circle";
    #: nothing on this platform ranks women against each other, and building
    #: that is a product decision, not a missing query.
    better_than_pct: Optional[int] = None


# --- what is coming --------------------------------------------------------

class HomeUpcoming(BaseModel):
    """
    One row of "what's on" — a booked session or a workshop she registered for.

    This is the only block here that is flattened rather than nested, and it
    earns it: the card shows the two in one date-ordered list, so merging them
    on the server is the difference between one sorted list and a screen doing
    date arithmetic across two response shapes to decide what is next.

    `kind` keeps the origin, so tapping a row still goes to the right place.
    """

    id: str
    kind: str          # "booking" | "event"
    title: str
    date: str          # ISO, the sort key
    day: str           # "16"
    month: str         # "SEP"
    time: str
    mode: str = ""
    with_whom: str = ""
    href: str


# --- what to do next ---------------------------------------------------------

class HomeRecommendation(CatalogProgram):
    """
    A programme she has not joined, with the reason it is being shown.

    Inherits `CatalogProgram` rather than wrapping it so the card renders from
    the same fields as the catalogue — one shape, one place to change.
    """

    #: Why this one. Derived from her own enrolments, never a ranking model
    #: this codebase does not have.
    reason: str = ""


# --- the whole screen --------------------------------------------------------

class MeHome(BaseModel):
    """
    Everything `/app` shows, in one request.

    Replaces `/me/profile` + `/me/unread` + `/me/progress` + `/me/summary` +
    `/wallet/insights` + `/me/programs` + `/catalog/programs` +
    `/growth/opportunities` + `/growth/events` + `/community/circles` +
    `/community/stories` + `/me/notifications` — eleven requests from a phone
    on a connection that is usually worse than the one this was measured on.
    """

    me: HomeMe
    #: Null when she has joined no programme yet — a first-run screen, not an error.
    journey: Optional[HomeJourney] = None
    next_step: Optional[HomeNextStep] = None
    #: Null, not zeroes, when the query behind it failed — see `unavailable`.
    #: "You have completed 0 programmes" is a different sentence from "we could
    #: not reach your record", and only one of them is true.
    progress: Optional[ProgressResponse] = None
    #: Null for the same reason, and it matters more here: a balance of ₹0
    #: rendered because a query timed out is the single most damaging thing
    #: this screen could say.
    earnings: Optional[HomeEarnings] = None
    upcoming: list[HomeUpcoming]
    recommended: list[HomeRecommendation]
    opportunities: list[OpportunityResponse]
    circles: list[CircleResponse]
    stories: list[StoryResponse]
    notifications: list[MemberNotification]
    #: Always null. A streak needs a record of which days she opened the app
    #: and nothing writes one — there is no activity log in this database, only
    #: a single `last_activity_at` per enrolment, which cannot tell five days
    #: in a row from five visits in one afternoon.
    streak: Optional[dict] = None
    #: Blocks that failed or timed out, by name.
    #:
    #: **This is the difference between "you have no circles" and "we could not
    #: reach your circles".** Without it a slow query and an empty life look
    #: identical to the screen, and it would cheerfully tell a woman who is in
    #: three savings circles that she is in none.
    unavailable: list[str] = []
