"""
The member's home screen, in one request.

`/app` was the last screen in the member app still drawing itself from a file
of invented constants: a balance of ₹24,350, a client called BrandStory that
does not exist, a ranking that told her she was "ahead of 68% of women in your
circle". Eleven endpoints already knew the real answers and the screen called
none of them.

This module is the one call that replaces that file. It follows the shape
`/me/shell` and `/me/journey` already set here, for the reasons they set it:

**Every block is fetched through the function its own endpoint uses.** Not a
copy of that function's query — the function. A second copy of the circle
privacy filter, or of the arithmetic that turns her enrolments into a
percentage, is a second place for the two to drift, and the first time they
drift one of them is wrong on a screen she opens every morning.

**One wave, not eleven round trips.** The Atlas cluster is in another data
centre: a round trip costs about 22ms whatever it fetches, so what decides how
this screen feels is how many times the phone — and then the server — asks.
Every block is handed to a single `gather`, and a helper that gathers
internally does not cost a second wave, because its awaitables are scheduled
when the outer one is.

**A slow block cannot hold the screen.** Each one is bounded by a timeout and
falls back to empty. Eleven blocks in one request means eleven chances for one
struggling query to take the whole of home with it, which is a worse failure
than the eleven requests this replaces — those degraded one card at a time.

**Nothing is invented.** Where the screen used to show a figure this database
does not hold, the field is null and says why. See `app/schemas/home.py`.
"""

from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime
from typing import Awaitable, Optional, TypeVar

from fastapi import APIRouter, Depends

from app.core.rbac import require_active_member
from app.db.mongodb import get_database
from app.models.enrollment import EnrollmentModel
from app.models.program import ProgramModel
from app.schemas.home import (
    HomeEarnings,
    HomeJourney,
    HomeLesson,
    HomeMe,
    HomeNextStep,
    HomeProfile,
    HomeProfileStep,
    HomeRecommendation,
    HomeUpcoming,
    MeHome,
)
from app.schemas.me import HomeMoney, UnreadCounts

router = APIRouter(prefix="/me", tags=["Member"])

log = logging.getLogger("womsakhi.home")

#: How long any one block may take before the screen goes on without it.
#:
#: Four seconds, not forty: this is a phone, and a woman who waits longer than
#: that has already decided the app is broken. It is deliberately far above a
#: healthy query (the whole endpoint measures well under 200ms) so it only ever
#: fires on something genuinely stuck.
BLOCK_TIMEOUT = 4.0

#: How many rows each list block returns. The home screen shows a handful of
#: each and links to the full list; fetching a hundred circles to render three
#: is bytes over a metered connection for nothing.
CIRCLES = 4
STORIES = 4
OPPORTUNITIES = 4
RECOMMENDED = 6
NOTIFICATIONS = 8
UPCOMING = 5
UP_NEXT = 3

T = TypeVar("T")


async def _block(name: str, coro: Awaitable[T], default: T, missing: list[str]) -> T:
    """
    Run one block, and never let it take the screen with it.

    A failure is recorded by NAME rather than swallowed, because the difference
    between "she is in no circles" and "we could not reach her circles" is
    invisible to the screen otherwise — and getting it wrong means telling a
    woman who is in three savings circles that she is in none.
    """
    try:
        return await asyncio.wait_for(coro, BLOCK_TIMEOUT)
    except asyncio.TimeoutError:
        log.warning("home block %s timed out after %ss", name, BLOCK_TIMEOUT)
    except Exception:  # noqa: BLE001 - one broken block must not 500 the screen
        log.exception("home block %s failed", name)
    missing.append(name)
    return default


# --- who she is --------------------------------------------------------------

#: The profile fields this system can actually check, in the order they are
#: worth asking for.
#:
#: The mock's list included "Verify your phone number". Nothing here verifies a
#: phone number, so that step could never have been ticked and the percentage
#: above it could never have reached 100 — a progress bar that cannot finish is
#: worse than no progress bar. Every step below is a stored field that is
#: either filled or empty, so `done` is a fact rather than a guess.
PROFILE_STEPS = [
    ("avatar", "Add a photo"),
    ("phone", "Add your phone number"),
    ("location", "Say where you are"),
    ("bio", "Tell us about yourself"),
    ("dob", "Add your date of birth"),
]


def _profile(fields: dict) -> HomeProfile:
    """Completeness, counted once from the steps rather than set by hand."""
    steps = [
        HomeProfileStep(
            key=key,
            label=label,
            done=bool(str(fields.get(key) or "").strip()),
            href="/app/profile",
        )
        for key, label in PROFILE_STEPS
    ]
    done = sum(1 for s in steps if s.done)
    return HomeProfile(pct=round(done / len(steps) * 100) if steps else 0, steps=steps)


# --- what she is learning ----------------------------------------------------

async def _current_course(uid: str) -> Optional[dict]:
    """
    The course she is working on now, with the programme document attached.

    Most recently touched, not furthest along: a woman who is 90% through a
    course she abandoned in March and two lessons into one she opened last
    night should come back to the one she opened last night.

    This does not go through `/me/programs`, and the reason is the curriculum:
    `EnrollmentResponse` carries the programme's name, dates and cover but not
    its module list, so the "up next" lessons cannot be named from it. Reading
    the full programme document is the only way to say which lesson is next
    instead of just how far along she is.

    It is the same `$lookup` shape `/me/programs` uses, for the same reason —
    the join happens on the side of the wire where the data already is, so this
    is one round trip rather than the two a fetch-then-fetch would cost. And
    `onError: None` rather than `$toObjectId` so a deleted or malformed
    programme reference leaves her home screen standing.
    """
    rows = await get_database()[EnrollmentModel.collection_name].aggregate([
        {"$match": {"user_id": uid, "status": EnrollmentModel.STATUS_ACTIVE}},
        # `last_activity_at` is what moves when she marks a lesson done, so
        # it is the closest thing here to "the one she is actually working on".
        # `created_at` breaks the tie for enrolments old enough not to have it.
        {"$sort": {"last_activity_at": -1, "created_at": -1}},
        {"$limit": 1},
        {"$lookup": {
            "from": ProgramModel.collection_name,
            "let": {"pid": {"$convert": {
                "input": "$program_id", "to": "objectId", "onError": None, "onNull": None,
            }}},
            "pipeline": [
                {"$match": {"$expr": {"$eq": ["$_id", "$$pid"]}}},
                {"$limit": 1},
            ],
            "as": "_program",
        }},
    ]).to_list(1)
    return rows[0] if rows else None


def _journey(row: Optional[dict]) -> tuple[Optional[HomeJourney], Optional[HomeNextStep]]:
    """
    Her course card and the one next step, from the same enrolment.

    They are built together on purpose: the next step IS the first unfinished
    lesson of the course on the card, and computing them apart is how a screen
    ends up telling her to continue one course while showing the progress of
    another.
    """
    # Imported here rather than at the top: these are peers in the route
    # package, and importing them at module level would make the package's
    # import order load-bearing — the rule `/me/shell` already set.
    from app.routes.me import _curriculum_for, _module_count, _reached

    if not row:
        return None, None
    program = (row.get("_program") or [None])[0]
    if not program:
        # The enrolment survived, the programme did not. A card with no name is
        # worse than no card; her progress numbers are still in `progress`.
        return None, None

    # `or`, not `get(..., default)`: a programme row with an empty name returns
    # "" from `get` and the sentence built below would read "6 lessons left in ."
    name = program.get("name") or "this course"
    pct = int(row.get("progress") or 0)
    attended = int(row.get("sessions_attended") or 0)
    total = _module_count(program)
    done = _reached(pct, attended, total)
    modules = _curriculum_for(program, done)
    program_id = str(program["_id"])

    lessons = [
        HomeLesson(n=i + 1, title=m.get("title", ""), duration=m.get("duration", ""),
                   done=bool(m.get("done")))
        for i, m in enumerate(modules)
    ]
    remaining = [item for item in lessons if not item.done]

    journey = HomeJourney(
        enrollment_id=str(row["_id"]),
        program_id=program_id,
        title=program.get("name", ""),
        category=program.get("category", ""),
        cover=program.get("cover", ""),
        pct=pct,
        done=done,
        total=total,
        up_next=remaining[:UP_NEXT],
        href=f"/app/programs/{program_id}",
        # left_mins stays null — see the schema. Summing durations that are
        # almost always "" would produce a confident, wrong number.
    )

    if not remaining:
        # Every lesson done but the enrolment still open: the honest next step
        # is the certificate, which is a real thing she can claim.
        return journey, HomeNextStep(
            title="Claim your certificate",
            because=f"You finished every lesson in {name}.",
            href="/app/certificates",
            cta="Claim",
            icon="Award",
        )

    nxt = remaining[0]
    left = len(remaining)
    # The reason, as arithmetic. "Finish this lesson" is an instruction; "one
    # lesson left before your certificate" is a reason, and she can disagree
    # with a reason.
    because = (
        f"It is the last lesson in {name}."
        if left == 1
        else f"{left} lessons left in {name}."
    )
    return journey, HomeNextStep(
        title=nxt.title,
        because=because,
        href=f"/app/programs/{program_id}/lesson/{nxt.n}",
        cta="Continue",
        icon="PlayCircle",
        duration=nxt.duration,
    )


# --- what is coming ----------------------------------------------------------

_MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN",
           "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]


def _clock(time: str) -> int:
    """
    A loose time as minutes past midnight, so two sources sort into one list.

    Bookings store "09:00" and events store "5:00 PM", and they have to end up
    in one chronological list. The staff calendar's `_minutes` is not reused
    here because it reads "5:00 PM" as five in the morning — harmless in a
    diary that only ever writes 24-hour times, wrong the moment an evening
    webinar has to sort below a morning class.

    An unparseable time sorts to the end of its own day rather than the start,
    so a row with no time never jumps ahead of one that has one.
    """
    match = re.match(r"^\s*(\d{1,2}):(\d{2})\s*([AaPp])?", time or "")
    if not match:
        return 24 * 60
    hour, minute = int(match.group(1)), int(match.group(2))
    half = (match.group(3) or "").lower()
    if half == "p" and hour != 12:
        hour += 12
    elif half == "a" and hour == 12:
        hour = 0
    return hour * 60 + minute


def _day_month(iso: str) -> tuple[str, str]:
    """"2026-09-16" -> ("16", "SEP"). Unparseable dates render no badge."""
    try:
        when = datetime.strptime(iso[:10], "%Y-%m-%d")
    except (ValueError, TypeError):
        return "", ""
    return f"{when.day:02d}", _MONTHS[when.month - 1]


def _upcoming(bookings: list, events: list) -> list[HomeUpcoming]:
    """
    Her sessions and her workshops, merged into one date-ordered list.

    Merged on the server because the card shows them as one list. Left apart,
    the screen would have to do date arithmetic across two response shapes to
    work out which of the two is actually next — and the answer would be wrong
    the first time a workshop fell between two bookings.
    """
    rows: list[tuple[tuple[str, int], HomeUpcoming]] = []

    for b in bookings:
        date = getattr(b, "date", "") or ""
        day, month = _day_month(date)
        rows.append((
            (date, _clock(getattr(b, "time", ""))),
            HomeUpcoming(
                id=getattr(b, "id", ""), kind="booking",
                title=getattr(b, "service_name", ""),
                date=date, day=day, month=month,
                time=getattr(b, "time", ""), mode=getattr(b, "mode", ""),
                with_whom=getattr(b, "with_whom", ""),
                href="/app/bookings",
            ),
        ))

    for e in events:
        # `list_events` hands back plain dicts, not models — it builds its rows
        # with `EventModel.to_response` and lets FastAPI do the coercion.
        date = e.get("date", "") or ""
        day, month = _day_month(date)
        rows.append((
            (date, _clock(e.get("time", ""))),
            HomeUpcoming(
                id=e.get("id", ""), kind="event", title=e.get("title", ""),
                date=date, day=day, month=month,
                time=e.get("time", ""), mode=e.get("mode", ""),
                with_whom=e.get("host", ""),
                href=f"/app/events/{e.get('id', '')}",
            ),
        ))

    rows.sort(key=lambda r: r[0])
    return [row for _, row in rows[:UPCOMING]]


# --- what to learn next ------------------------------------------------------

def _recommended(catalogue: list, journey: Optional[HomeJourney]) -> list[HomeRecommendation]:
    """
    Programmes she has not joined, the ones like what she is already doing first.

    `reason` is derived from her own enrolment and nothing else. There is no
    ranking model in this codebase, and a card that says "recommended for you"
    with no reason behind it is a card that eventually recommends something
    absurd and takes the rest of the screen's credibility with it.

    `app/core/matching.py` could score these properly, but it re-ranks the
    whole catalogue on every call and is CPU work on the request path — right
    for the intake screen a woman waits on once, wrong for the screen that
    opens every time she unlocks her phone.
    """
    category = (journey.category if journey else "") or ""

    scored: list[tuple[bool, HomeRecommendation]] = []
    for program in catalogue:
        if program.joined or program.is_full:
            continue
        same = bool(category) and program.category == category
        scored.append((same, HomeRecommendation(
            **program.model_dump(),
            reason=(f"More {category.lower()}, like the course you are doing" if same
                    else "New in the catalogue"),
        )))

    # Her category first, catalogue order within each group. Sorted on the flag
    # rather than on `reason` itself, so rewording the sentence a woman reads
    # cannot quietly reshuffle what she is shown. `sort` is stable, so the
    # newest-first order the catalogue already applied survives inside a group.
    scored.sort(key=lambda row: not row[0])
    return [rec for _, rec in scored[:RECOMMENDED]]


# --- money -------------------------------------------------------------------

def _earnings(money: HomeMoney, insights: dict) -> HomeEarnings:
    """
    Her money card: the figures from `/me/summary`, the sparkline from
    `/wallet/insights`. Neither number is computed a second time here.
    """
    last = int(money.last_month_minor or 0)
    this = int(money.earned_this_month_minor or 0)
    return HomeEarnings(
        money=money,
        series_minor=[int(v) for v in insights.get("monthly_minor", [])],
        series_labels=list(insights.get("month_labels", [])),
        sources=list(insights.get("sources", [])),
        # Null when last month was zero. Everything is an infinite increase on
        # nothing, and a screen that answers that with "+100%" is flattering
        # her with arithmetic she can check against her own records.
        delta_pct=round((this - last) / last * 100, 1) if last else None,
    )


# --- the screen --------------------------------------------------------------

@router.get("/home", response_model=MeHome, summary="Everything the home screen needs")
async def home(me: dict = Depends(require_active_member)):
    """
    `/app` in one request instead of eleven.

    **Every block is her own.** The owner comes from the token, like everywhere
    else in the member app — there is no member id in the path or the query
    string, so there is no id to tamper with. The shared blocks
    (`recommended`, `stories`) are the same public lists their own endpoints
    serve; the personal ones are filtered by her user id inside the functions
    called here, not after them.

    **Empty is not an error.** A woman who signed up this morning has no
    circles, no bookings, no stories and no earnings. She gets empty lists and
    a null journey, and the screen shows her a first run — never a 404, and
    never a card of zeroes pretending to be a record.
    """
    # Local imports for the same reason `/me/shell` uses them: these are peers
    # in the route package and importing them at module level would make the
    # package's import order load-bearing. `catalog` in particular imports back
    # out of `me`.
    from app.routes.catalog import list_programs
    from app.routes.community import list_circles, list_stories
    from app.routes.growth import list_events, list_opportunities
    from app.routes.me import (
        _progress_response,
        _progress_rows,
        my_notifications,
        my_profile,
        my_summary,
        unread_counts,
    )
    from app.routes.wallet import insights as wallet_insights

    uid = str(me["_id"])
    missing: list[str] = []

    # One wave. Each entry is either a plain awaitable or a helper that gathers
    # internally, and a nested gather does not cost a second round trip — its
    # awaitables are scheduled when this one is. So the screen waits for the
    # slowest block rather than the sum of all of them, which is the entire
    # reason this endpoint exists.
    (
        profile, unread, summary, insights, progress_rows, course,
        catalogue, opportunities, events, circles, stories, notifications,
    ) = await asyncio.gather(
        _block("profile", my_profile(me), None, missing),
        _block("unread", unread_counts(me), UnreadCounts(notifications=0, messages=0), missing),
        _block("summary", my_summary(me), None, missing),
        _block("insights", wallet_insights(me), {}, missing),
        _block("progress", _progress_rows(uid), None, missing),
        _block("journey", _current_course(uid), None, missing),
        # Called with explicit arguments, not defaults: read straight off the
        # function these would be FastAPI `Query` objects rather than values,
        # and the first `.strip()` inside would blow up on one.
        _block("recommended", list_programs(q=None, category=None, me=me), [], missing),
        _block(
            "opportunities",
            list_opportunities(q="", kind="", mode="", saved=False, pay_min_minor=0,
                               period="", sort="recent", me=me),
            [], missing,
        ),
        _block("events", list_events(category="", mode="", mine=True, past=False, me=me),
               [], missing),
        _block("circles", list_circles(q="", mine=True, me=me), [], missing),
        _block("stories", list_stories(mine=False, me=me), [], missing),
        _block("notifications", my_notifications(me), [], missing),
    )

    journey, next_step = _journey(course)

    # The profile document, when it arrived. When it did not, her name and
    # photo still come off the token's own user document — no query — so the
    # greeting survives a slow members collection. Only the completeness rail
    # is lost, and `unavailable` says so.
    fields = profile.model_dump() if profile else {
        "full_name": me.get("full_name", ""), "avatar": me.get("avatar", ""),
        "phone": me.get("phone", ""),
    }
    name = fields.get("full_name") or me.get("full_name", "")

    return MeHome(
        me=HomeMe(
            first=name.split(" ")[0] if name else "",
            name=name,
            avatar=fields.get("avatar") or "",
            # True for everyone who can reach this line — she was admitted by a
            # human who read her documents. See the schema.
            verified=True,
            unread=unread,
            profile=_profile(fields),
        ),
        journey=journey,
        next_step=next_step,
        # Null rather than a row of zeroes when the query behind it failed —
        # `_progress_response` is pure arithmetic, so it is only run on rows
        # that actually arrived.
        progress=_progress_response(me, *progress_rows) if progress_rows else None,
        earnings=_earnings(summary.money, insights) if summary else None,
        upcoming=_upcoming(summary.upcoming_bookings if summary else [], events),
        recommended=_recommended(catalogue, journey),
        opportunities=opportunities[:OPPORTUNITIES],
        circles=circles[:CIRCLES],
        stories=stories[:STORIES],
        notifications=notifications[:NOTIFICATIONS],
        unavailable=missing,
    )
