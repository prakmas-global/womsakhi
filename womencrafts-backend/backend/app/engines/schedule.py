"""
Turning a rule into instants.

This is the part that is easy to write and hard to get right, so the reasoning
is here rather than in a commit message.

**Why a stored UTC instant is not enough.** "Remind me at 7am every day" is not
a fixed interval. Between March and November a 7am reminder in Europe/London is
06:00 UTC and then 07:00 UTC, and a scheduler that adds 24 hours to the last
instant drifts an hour twice a year and never comes back. So a recurring
schedule is recomputed from her **local wall clock** every time, and the UTC
instant is the answer, not the source.

**Why a stored local time is not enough either.** A travel check-in deadline is
elapsed time: "if I have not heard from you in 30 minutes, tell my sister."
That must not move because she crossed a border. So the rule carries `drift`,
and safety deadlines use `keep_instant` while ordinary habits use `keep_local`
(REM-UC-002, REM-UC-009).

**The two days that break naive code, and what happens here.**

- *Spring forward.* 02:30 does not exist on the morning a zone jumps to 03:00.
  `ZoneInfo` resolves it to a real instant rather than raising, and the
  reminder lands at the start of the hour that does exist. It fires once.
- *Autumn back.* 01:30 happens twice. `fold=0` picks the first, which is the
  earlier real instant, and because the next occurrence is computed from the
  following calendar day rather than by adding 24 hours, the second 01:30 is
  never also produced. It fires once.

Both are asserted in the tests. A reminder that fires twice on one morning a
year is the kind of bug that is dismissed as a fluke and never fixed.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

# A schedule that produces nothing for this long has stopped being a schedule.
# It bounds the search rather than looping forever on a rule whose days list
# can never match (an empty list means "every day", but a corrupted one may
# match nothing at all).
MAX_LOOKAHEAD_DAYS = 400


def zone(name: str) -> ZoneInfo:
    """Her zone, or UTC. An unknown name must never crash a tick."""
    try:
        return ZoneInfo(name or "UTC")
    except (ZoneInfoNotFoundError, ValueError, KeyError):
        return ZoneInfo("UTC")


def parse_local_time(value: str) -> time:
    """`"07:30"` → 07:30. Anything unreadable becomes 09:00, never an error."""
    try:
        hh, mm = (value or "").split(":")[:2]
        return time(hour=max(0, min(23, int(hh))), minute=max(0, min(59, int(mm))))
    except (ValueError, AttributeError):
        return time(hour=9, minute=0)


def _instant(day: date, at: time, tz: ZoneInfo) -> datetime:
    """
    A wall-clock time on a given day, as a real UTC instant.

    `fold=0` is the deliberate choice on a repeated hour: take the first
    occurrence. Combined with day-by-day stepping, the repeated hour produces
    exactly one instant rather than two.
    """
    local = datetime.combine(day, at).replace(tzinfo=tz, fold=0)
    return local.astimezone(timezone.utc)



def _weekdays(value) -> list[int]:
    """
    A clean 0-6 list from whatever is actually stored.

    `days` reaches this from a member PATCH, so it can be `3`, `["mon"]` or
    `[None]`. The old comprehension raised on all three — and because
    `top_up_horizons` had no per-rule guard, one member's malformed list
    raised inside the tick and stopped every OTHER member's recurring series
    being topped up. A single bad field is not allowed to be a cluster-wide
    outage.

    Unreadable entries are dropped rather than defaulted, so a list that means
    nothing behaves as "every day" — visible and harmless — instead of firing
    on a day she never chose.
    """
    if value is None or isinstance(value, (str, bytes, int, float)):
        return []
    out: list[int] = []
    try:
        for d in value:
            try:
                out.append(int(d) % 7)
            except (TypeError, ValueError):
                continue
    except TypeError:
        return []
    return out


def aware(value):
    """
    A datetime from Mongo, made comparable.

    Motor is created without `tz_aware=True`, so every datetime read back is
    NAIVE UTC while everything this code creates is aware. Comparing the two
    raises `TypeError`, and that is not theoretical: `ends_at` is a field a
    member can set through the public API, and one recurring reminder with an
    end date was enough to raise inside the tick on every instance, every
    minute.
    """
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def next_occurrence(
    *,
    schedule: dict,
    tz_name: str,
    after: datetime,
    ends_at: datetime | None = None,
) -> datetime | None:
    """
    The first instant strictly after `after`, or None if the rule is finished.

    `after` is exclusive so that materialising twice cannot produce the same
    instant twice — the caller passes the last instant it created.
    """
    schedule = schedule or {}
    kind = schedule.get("type") or "once"
    ends_at = aware(ends_at)
    after = aware(after)

    if kind == "once":
        at = schedule.get("at")
        if not isinstance(at, datetime):
            return None
        at = at if at.tzinfo else at.replace(tzinfo=timezone.utc)
        if ends_at and at > ends_at:
            return None
        return at if at > after else None

    if kind == "event_relative":
        anchor = schedule.get("anchor_at")
        if not isinstance(anchor, datetime):
            return None
        anchor = anchor if anchor.tzinfo else anchor.replace(tzinfo=timezone.utc)
        # Negative offsets mean "before", which is what almost every one of
        # these is: fifteen minutes before the session, a day before the
        # deadline.
        when = anchor + timedelta(minutes=int(schedule.get("offset_minutes") or 0))
        if ends_at and when > ends_at:
            return None
        return when if when > after else None

    if kind != "recurring":
        return None

    tz = zone(tz_name)
    at = parse_local_time(schedule.get("local_time") or "")
    days = _weekdays(schedule.get("days"))

    # Start from her local day, not UTC's. At 23:00 UTC it is already tomorrow
    # in Hyderabad, and computing "today" from UTC would skip a day for her.
    cursor = after.astimezone(tz).date()
    for _ in range(MAX_LOOKAHEAD_DAYS):
        if not days or cursor.weekday() in days:
            candidate = _instant(cursor, at, tz)
            if candidate > after:
                if ends_at and candidate > ends_at:
                    return None
                return candidate
        cursor += timedelta(days=1)
    return None


def materialise(
    *,
    schedule: dict,
    tz_name: str,
    after: datetime,
    horizon: datetime,
    ends_at: datetime | None = None,
    limit: int = 64,
) -> list[datetime]:
    """
    Every instant between `after` and `horizon`.

    Occurrences are created a horizon ahead rather than all at once, for two
    reasons. A daily reminder with no end date is infinite, so "all of them" is
    not a set. And a rule that changes — she moves it to 9am — should invalidate
    a few rows, not rewrite a decade of them.

    `limit` is a safety rail: a corrupted schedule that somehow matched every
    minute would otherwise fill the collection before anyone noticed.
    """
    schedule = schedule or {}
    out: list[datetime] = []
    ends_at = aware(ends_at)
    cursor = aware(after)
    horizon = aware(horizon)
    while len(out) < limit:
        nxt = next_occurrence(schedule=schedule, tz_name=tz_name,
                              after=cursor, ends_at=ends_at)
        if nxt is None or nxt > horizon:
            break
        out.append(nxt)
        cursor = nxt
        if schedule.get("type") != "recurring":
            break     # one-off and event-relative rules have exactly one
    return out


def rebuild_for_zone(
    *,
    schedule: dict,
    old_tz: str,
    new_tz: str,
    drift: str,
    pending: list[datetime],
) -> list[datetime]:
    """
    What happens to already-scheduled instants when she changes timezone.

    The catalogue asks the question rather than assuming an answer, and the two
    answers are genuinely different products:

    - `keep_local` — her 7am habit is 7am in Dubai too. The instants move.
    - `keep_instant` — a safety deadline is elapsed time. Nothing moves, ever.

    Anything not explicitly a safety deadline keeps local time, because that is
    what "remind me every morning" means to the person who set it.
    """
    if drift == "keep_instant" or not pending:
        return list(pending)

    src, dst = zone(old_tz), zone(new_tz)
    # `local_time` is only set on a RECURRING rule. Reading it for a one-off
    # returned the 09:00 fallback and quietly rewrote a 14:00 appointment
    # reminder to 09:00 the moment she travelled. So the wall clock comes from
    # the instant itself, which is correct for every schedule type and needs no
    # field that may not be there.
    stated = (schedule or {}).get("local_time") or ""
    fixed = parse_local_time(stated) if stated else None

    moved: list[datetime] = []
    for inst in pending:
        local = inst.astimezone(src)
        # The calendar day is taken in the OLD zone — that is the day she meant
        # when she set it — and the same wall-clock time is then read in the
        # new one.
        moved.append(_instant(local.date(), fixed or local.timetz().replace(tzinfo=None), dst))
    return moved
