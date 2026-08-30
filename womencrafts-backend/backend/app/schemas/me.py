from typing import Optional

from pydantic import BaseModel, field_validator

from app.schemas.auth import UserResponse
from app.schemas.community import CircleResponse
from app.schemas.shop import ShopSummary
from app.schemas.wallet import ReferralResponse


class MeProfileResponse(BaseModel):
    id: str
    full_name: str
    email: str
    role: str
    member_id: str
    locale: str
    phone: str
    avatar: str
    is_active: bool
    verification_status: str
    rejection_reason: str
    created_at: str
    # from the linked members profile
    code: str = ""
    location: str = ""
    segment: str = ""
    dob: str = ""
    #: A line she writes about herself. The account screen has always had this
    #: field; until now it had nowhere to go, so it showed a sentence somebody
    #: else wrote — "I sew, and I am learning to sell online."
    bio: str = ""


class MeProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    avatar: Optional[str] = None
    locale: Optional[str] = None
    location: Optional[str] = None
    dob: Optional[str] = None
    bio: Optional[str] = None

    @field_validator("full_name")
    @classmethod
    def name_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("Your name cannot be empty")
        return v


class BookingResponse(BaseModel):
    id: str
    service_id: str
    service_name: str
    date: str
    time: str
    mode: str
    with_whom: str
    duration: str
    price: float
    note: str
    status: str
    cancelled_reason: str
    booked_on: str
    created_at: str


class BookingCreate(BaseModel):
    service_id: str
    date: str  # ISO, e.g. "2026-08-20"
    time: str  # slot label, e.g. "10:00 AM"
    mode: str = "Online"
    note: str = ""

    @field_validator("date")
    @classmethod
    def date_required(cls, v: str) -> str:
        if not (v or "").strip():
            raise ValueError("Please choose a date")
        return v.strip()

    @field_validator("time")
    @classmethod
    def time_required(cls, v: str) -> str:
        if not (v or "").strip():
            raise ValueError("Please choose a time")
        return v.strip()


class CancelRequest(BaseModel):
    reason: str = ""


class EnrollmentResponse(BaseModel):
    id: str
    program_id: str
    program_name: str
    status: str
    progress: int
    sessions_attended: int
    joined: str
    created_at: str
    category: str = ""
    mode: str = ""
    duration: str = ""
    dates: str = ""
    days: str = ""
    desc: str = ""
    cover: str = ""


class ProgressUpdate(BaseModel):
    progress: int
    sessions_attended: Optional[int] = None

    @field_validator("progress")
    @classmethod
    def clamp(cls, v: int) -> int:
        return max(0, min(100, v))


class HomeMoney(BaseModel):
    """
    What the home screen may say about her money.

    Every field here is counted from the ledger. The screen it feeds used to
    read a constant: "₹24,350 earned this month" to a woman who had earned
    ₹3,000, "₹4,200 pending from BrandStory" — a client that does not exist —
    and "ahead of 68% of women in your circle", a ranking nothing computes.

    Three of those had to be dropped rather than wired, because nothing in this
    system knows them: who owes her, when it is due, and how she compares to
    other women. A home screen that says less and is true is the whole point.
    """

    earned_this_month_minor: int = 0
    last_month_minor: int = 0
    #: Credits the ledger has not settled. Stated when it exists, absent when
    #: it does not — saying "₹0 is on its way" invents a worry.
    pending_minor: int = 0
    balance_minor: int = 0
    #: Her own money goal, if she set one. Null is not "no goal shown", it is
    #: an invitation to set one.
    goal_minor: int = 0
    goal_label: str = ""


class MeSummaryResponse(BaseModel):
    full_name: str
    upcoming_bookings: list[BookingResponse]
    active_programs: list[EnrollmentResponse]
    total_bookings: int
    total_programs: int
    completed_programs: int
    money: HomeMoney = HomeMoney()


class MessageResponse(BaseModel):
    message: str


class IntakeRequest(BaseModel):
    """What she told us — free text, taps, or both."""
    text: str = ""
    needs: list[str] = []


class IntakeNeed(BaseModel):
    key: str
    label: str
    hint: str


class IntakeSuggestion(BaseModel):
    id: str
    name: str
    kind: str          # "service" | "program"
    description: str
    reason: str        # why this was suggested — never an unexplained result
    meta: str = ""     # duration / category, whatever is worth showing


class IntakeResponse(BaseModel):
    needs: list[str]
    matched: bool      # False = we could not read her intent, showing popular instead
    services: list[IntakeSuggestion]
    programs: list[IntakeSuggestion]


class MemberMessage(BaseModel):
    id: str
    sender: str        # "member" | "team"
    sender_name: str
    body: str
    sent_at: str
    sent_label: str


class SendMessageRequest(BaseModel):
    body: str

    @field_validator("body")
    @classmethod
    def not_empty(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("Write something first")
        return v[:2000]


class MemberNotification(BaseModel):
    id: str
    type: str
    icon: str
    title: str
    body: str
    href: str
    unread: bool
    when: str
    created_at: str


class UnreadCounts(BaseModel):
    notifications: int
    messages: int


# --- library (published content she can read) ---------------------------------

class LibraryItem(BaseModel):
    id: str
    title: str
    type: str
    description: str
    author: str
    cover: str
    icon: str
    updated: str
    saved: bool = False


# --- feedback -----------------------------------------------------------------

class FeedbackRequest(BaseModel):
    text: str
    rating: int = 5
    type: str = "Program Feedback"
    program: str = ""

    @field_validator("text")
    @classmethod
    def text_required(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("Please tell us a little about your experience")
        return v[:2000]

    @field_validator("rating")
    @classmethod
    def rating_range(cls, v: int) -> int:
        return max(1, min(5, v))


# --- settings -----------------------------------------------------------------

class NotificationPrefs(BaseModel):
    """
    What reaches her, and how.

    The screen offered eight switches against five fields here. The three with
    nowhere to go — money, orders and circle activity — would have been
    accepted, discarded, and shown back as "Saved.": a switch that moves and
    means nothing, which is worse than a switch that is not there.

    Defaults are deliberate. Everything about her own money and her own orders
    is on; the two that are really marketing — new programs, and SMS, which
    costs her nothing but arrives whether she has data or not — are off until
    she asks for them.
    """

    booking_reminders: bool = True
    program_updates: bool = True
    messages: bool = True
    new_programs: bool = False
    email_copies: bool = True
    #: Money arriving, leaving, or failing to arrive.
    money: bool = True
    #: Orders in her shop.
    orders: bool = True
    #: Her circles — a contribution due, somebody's turn coming up.
    circles: bool = True
    #: Text messages. Off by default: they reach her whether she has data or
    #: not, which is the point, and also the reason not to assume consent.
    sms: bool = False


class ChangePasswordBody(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def strong_enough(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Use at least 8 characters")
        return v


class DeleteAccountRequest(BaseModel):
    reason: str = ""
    confirm: str

    @field_validator("confirm")
    @classmethod
    def must_confirm(cls, v: str) -> str:
        if (v or "").strip().upper() != "DELETE":
            raise ValueError('Type DELETE to confirm')
        return v


# --- progress / achievements --------------------------------------------------

class Achievement(BaseModel):
    key: str
    title: str
    description: str
    icon: str
    earned: bool
    earned_on: str = ""


class ProgressResponse(BaseModel):
    member_since: str
    sessions_attended: int
    sessions_upcoming: int
    programs_active: int
    programs_completed: int
    learning_hours: int
    completion_rate: int
    achievements: list[Achievement]


# --- the two composed screens -------------------------------------------------
#
# Both of these exist for one reason: a round trip to the Atlas cluster costs
# about 22ms whatever it fetches, so the number that decides how a screen feels
# is how many times the phone asks, not how much it asks for. Neither adds a
# field that did not already exist somewhere — each is the same data the app was
# already fetching, arriving in one request instead of five or six.
#
# The nested shapes are deliberately the SAME models the individual endpoints
# return, not flattened copies. A flattened copy is a second definition of the
# same thing, and the day one of them gains a field the other silently does not.

class MeShell(BaseModel):
    """
    Everything the member shell needs before a screen fetches anything of its own.

    Replaces `/auth/session` + `/layout/me` + `/layout/me/features` +
    `/me/progress` + `/me/unread`.

    **There is no null `user` here.** `/auth/session` answers 200 with
    `{"user": null}` when signed out, on purpose — see its docstring. This one
    is behind the member gate, so signed-out is a 401 and `user` is always a
    real user. A caller that used `session.user === null` to mean "signed out"
    must read the status code here instead.
    """

    user: UserResponse
    #: Exactly `/layout/me`. Free-form because the layout engine's keys are the
    #: layout engine's business, and pinning them here would mean editing two
    #: files every time a pane learns a new setting.
    layout: dict
    #: Exactly `/layout/me/features` — the entitlement map. Costs no query.
    features: dict[str, bool]
    progress: ProgressResponse
    unread: UnreadCounts


class MeJourney(BaseModel):
    """
    Everything `/app/progress` shows, in one request.

    Replaces `/me/progress` + `/wallet/insights` + `/shop/summary` +
    `/me/referrals` + `/community/circles`.
    """

    progress: ProgressResponse
    #: Exactly `/wallet/insights`. Free-form for the same reason as `layout`:
    #: it is a chart payload whose series are the chart's business, and `goal`
    #: is legitimately null when she has not set one.
    insights: dict
    shop: ShopSummary
    referrals: ReferralResponse
    #: Exactly `/community/circles` with no filters — the browse list.
    circles: list[CircleResponse]
