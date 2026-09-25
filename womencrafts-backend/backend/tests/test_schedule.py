"""
`app/engines/schedule.py` — turning a rule into instants.

These are the tests the module's own docstring promises ("Both are asserted in
the tests"). Everything here is pure: no database, no clock, no network.

A note on the two DST days, because the dates matter and are easy to get
wrong. In **Europe/London** the spring transition is at 01:00 GMT → 02:00 BST,
so the hour that does not exist on 29 March 2026 is **01:00–01:59**, not
02:00–02:59. A 02:30 London reminder is an ordinary day. The 02:00–03:00 gap
belongs to Central European time, so **Europe/Berlin** is used where a 02:30
wall clock has to land in the gap. Both are covered below.
"""

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest

from app.engines.schedule import (
    MAX_LOOKAHEAD_DAYS,
    materialise,
    next_occurrence,
    parse_local_time,
    rebuild_for_zone,
    zone,
)

IST = ZoneInfo("Asia/Kolkata")
LONDON = ZoneInfo("Europe/London")
BERLIN = ZoneInfo("Europe/Berlin")
DUBAI = ZoneInfo("Asia/Dubai")
UTC = timezone.utc


def U(y, m, d, hh=0, mm=0):
    """A UTC instant, written short."""
    return datetime(y, m, d, hh, mm, tzinfo=UTC)


def daily(local_time="07:00", days=None):
    return {"type": "recurring", "local_time": local_time, "days": list(days or [])}


# ── zone() ──────────────────────────────────────────────────────────────────

def test_zone_returns_the_named_zone():
    assert zone("Asia/Kolkata") is ZoneInfo("Asia/Kolkata")


@pytest.mark.parametrize("name", ["", None, "Mars/Phobos", "Asia/Nowhere",
                                  "not a zone", "UTC+5:30"])
def test_unknown_zone_falls_back_to_utc_rather_than_raising(name):
    """A bad tz on one member's row must not take down a whole tick."""
    assert zone(name) == ZoneInfo("UTC")


# ── parse_local_time() ──────────────────────────────────────────────────────

@pytest.mark.parametrize("value,expected", [
    ("07:30", (7, 30)),
    ("00:00", (0, 0)),
    ("23:59", (23, 59)),
    ("7:5", (7, 5)),           # unpadded is still readable
    ("07:30:45", (7, 30)),     # seconds are ignored, not an error
    ("99:99", (23, 59)),       # clamped, not rejected
    ("-1:-1", (0, 0)),         # clamped the other way
])
def test_parse_local_time_reads_or_clamps(value, expected):
    t = parse_local_time(value)
    assert (t.hour, t.minute) == expected


@pytest.mark.parametrize("value", ["", None, "abc", "07", ":", "07:xx", "  "])
def test_malformed_local_time_falls_back_to_nine_am(value):
    """The documented fallback. Never an exception — a tick must not die."""
    t = parse_local_time(value)
    assert (t.hour, t.minute) == (9, 0)


# ── daily recurring, no DST in play ─────────────────────────────────────────

def test_daily_seven_am_in_kolkata_is_0130_utc():
    got = next_occurrence(schedule=daily("07:00"), tz_name="Asia/Kolkata",
                          after=U(2026, 3, 1))
    assert got == U(2026, 3, 1, 1, 30)
    assert got.astimezone(IST).strftime("%H:%M") == "07:00"


def test_daily_recomputes_from_the_local_wall_clock_not_by_adding_24h():
    """
    The bug the module exists to prevent: a 07:00 London habit is 07:00 UTC in
    winter and 06:00 UTC in summer. Adding 24 hours would drift an hour.
    """
    winter = next_occurrence(schedule=daily("07:00"), tz_name="Europe/London",
                             after=U(2026, 1, 15))
    summer = next_occurrence(schedule=daily("07:00"), tz_name="Europe/London",
                             after=U(2026, 7, 15))
    assert winter.hour == 7 and summer.hour == 6
    assert winter.astimezone(LONDON).hour == summer.astimezone(LONDON).hour == 7


def test_the_local_day_is_hers_not_utcs():
    """
    At 23:00 UTC it is already tomorrow in Hyderabad. Starting the search from
    the UTC date would skip her 07:00.
    """
    got = next_occurrence(schedule=daily("07:00"), tz_name="Asia/Kolkata",
                          after=U(2026, 3, 1, 23, 0))   # = 04:30 IST on 2 Mar
    assert got.astimezone(IST).date() == datetime(2026, 3, 2).date()


# ── spring forward ──────────────────────────────────────────────────────────

SPRING_WINDOW = dict(after=U(2026, 3, 27), horizon=U(2026, 4, 1))


@pytest.mark.parametrize("tz_name,tzinfo,local_time,in_the_gap", [
    # London: 01:00 → 02:00 on 29 Mar, so 01:30 is the hour that vanishes.
    ("Europe/London", LONDON, "01:30", True),
    # The case the brief names. In London 02:30 is NOT in the gap; it is
    # asserted anyway because it must still fire exactly once.
    ("Europe/London", LONDON, "02:30", False),
    # Berlin: 02:00 → 03:00, so here 02:30 really does not exist.
    ("Europe/Berlin", BERLIN, "02:30", True),
])
def test_spring_forward_fires_once_per_local_day(tz_name, tzinfo, local_time,
                                                 in_the_gap):
    got = materialise(schedule=daily(local_time), tz_name=tz_name, **SPRING_WINDOW)

    local_days = [g.astimezone(tzinfo).date() for g in got]
    assert len(got) == 5, f"expected one per calendar day, got {got}"
    assert len(set(got)) == len(got), "duplicate instants"
    assert len(set(local_days)) == 5, "two instants on one local day"
    assert got == sorted(got), "instants must be strictly increasing"

    # The transition day is present exactly once — never skipped, never doubled.
    transition = datetime(2026, 3, 29).date()
    assert local_days.count(transition) == 1

    if in_the_gap:
        # The wall clock asked for does not exist that morning, so it lands at
        # the start of the hour that does, rather than raising.
        on_the_day = got[local_days.index(transition)]
        assert on_the_day.astimezone(tzinfo).strftime("%H:%M") != local_time
        assert on_the_day.astimezone(tzinfo).date() == transition
    else:
        assert got[local_days.index(transition)].astimezone(
            tzinfo).strftime("%H:%M") == local_time


def test_spring_forward_returns_distinct_instants_even_second_by_second():
    """
    Stepping `after` forward from each result — what `materialise` does — must
    never yield the same instant twice across the transition.
    """
    seen = []
    cursor = U(2026, 3, 28)
    for _ in range(4):
        nxt = next_occurrence(schedule=daily("01:30"), tz_name="Europe/London",
                              after=cursor)
        seen.append(nxt)
        cursor = nxt
    assert len(set(seen)) == len(seen)
    assert seen == sorted(seen)


# ── autumn back ─────────────────────────────────────────────────────────────

AUTUMN_WINDOW = dict(after=U(2026, 10, 23), horizon=U(2026, 10, 28))


@pytest.mark.parametrize("tz_name,tzinfo,local_time", [
    ("Europe/London", LONDON, "01:30"),   # 02:00 BST → 01:00 GMT on 25 Oct
    ("Europe/Berlin", BERLIN, "02:30"),   # 03:00 CEST → 02:00 CET
])
def test_autumn_back_fires_once_per_local_day(tz_name, tzinfo, local_time):
    got = materialise(schedule=daily(local_time), tz_name=tz_name, **AUTUMN_WINDOW)

    local_days = [g.astimezone(tzinfo).date() for g in got]
    assert len(got) == 5
    assert len(set(got)) == len(got)
    assert len(set(local_days)) == 5, (
        "the repeated hour produced two instants on one local day: " + repr(got))
    assert got == sorted(got)

    transition = datetime(2026, 10, 25).date()
    assert local_days.count(transition) == 1
    on_the_day = got[local_days.index(transition)]
    # Every day keeps the wall clock she asked for, including this one.
    assert on_the_day.astimezone(tzinfo).strftime("%H:%M") == local_time
    # fold=0 — the FIRST of the two 01:30s, which is the earlier real instant.
    assert on_the_day.astimezone(tzinfo).utcoffset() == timedelta(hours=1 if
                                                                 tz_name == "Europe/London" else 2)


def test_autumn_back_does_not_produce_the_repeated_hour_twice():
    """The named failure: a reminder that fires twice on one morning a year."""
    got = materialise(schedule=daily("01:30"), tz_name="Europe/London",
                      after=U(2026, 10, 24, 12, 0), horizon=U(2026, 10, 26))
    assert got == [U(2026, 10, 25, 0, 30)]


# ── weekday filtering ───────────────────────────────────────────────────────

def test_days_filter_selects_monday_wednesday_friday():
    got = materialise(schedule=daily("07:00", days=[0, 2, 4]),
                      tz_name="Asia/Kolkata",
                      after=U(2026, 6, 1), horizon=U(2026, 6, 15))
    weekdays = {g.astimezone(IST).weekday() for g in got}
    assert weekdays == {0, 2, 4}
    assert len(got) == 6
    assert len(set(got)) == len(got)


def test_days_filter_is_evaluated_in_her_zone_not_utc():
    """
    00:30 Monday in Kolkata is 19:00 *Sunday* in UTC. If the filter were
    applied to the UTC weekday this returns nothing at all.
    """
    got = materialise(schedule=daily("00:30", days=[0]), tz_name="Asia/Kolkata",
                      after=U(2026, 6, 1), horizon=U(2026, 6, 22))
    assert got, "the Monday filter was applied to the UTC day"
    for g in got:
        assert g.astimezone(IST).weekday() == 0
        assert g.weekday() == 6      # Sunday in UTC — the whole point


@pytest.mark.parametrize("days,expected", [
    ([7], {0}),        # 7 % 7 == Monday
    ([-1], {6}),       # -1 % 7 == Sunday in Python
    ([0, 0, 0], {0}),  # duplicates are harmless
])
def test_out_of_range_days_are_normalised_not_rejected(days, expected):
    got = materialise(schedule=daily("07:00", days=days), tz_name="Asia/Kolkata",
                      after=U(2026, 6, 1), horizon=U(2026, 6, 22))
    assert {g.astimezone(IST).weekday() for g in got} == expected


# ── once ────────────────────────────────────────────────────────────────────

def test_once_returns_the_instant_when_it_is_after():
    at = U(2026, 5, 1, 10, 0)
    assert next_occurrence(schedule={"type": "once", "at": at},
                           tz_name="Asia/Kolkata", after=at - timedelta(seconds=1)) == at


@pytest.mark.parametrize("delta", [timedelta(0), timedelta(seconds=1),
                                   timedelta(days=30)])
def test_once_is_strictly_after_so_it_cannot_be_materialised_twice(delta):
    at = U(2026, 5, 1, 10, 0)
    assert next_occurrence(schedule={"type": "once", "at": at},
                           tz_name="UTC", after=at + delta) is None


def test_once_treats_a_naive_instant_as_utc():
    naive = datetime(2026, 5, 1, 10, 0)
    assert next_occurrence(schedule={"type": "once", "at": naive},
                           tz_name="UTC", after=U(2026, 1, 1)) == U(2026, 5, 1, 10, 0)


@pytest.mark.parametrize("at", [None, "2026-05-01T10:00:00", 1780000000, {}])
def test_once_without_a_usable_instant_returns_none(at):
    assert next_occurrence(schedule={"type": "once", "at": at},
                           tz_name="UTC", after=U(2026, 1, 1)) is None


@pytest.mark.parametrize("schedule", [{}, {"type": "weekly"}, {"type": ""},
                                      {"type": None}])
def test_unknown_or_empty_schedule_types_return_none(schedule):
    assert next_occurrence(schedule=schedule, tz_name="UTC",
                           after=U(2026, 1, 1)) is None


def test_a_recurring_rule_with_no_local_time_uses_the_nine_am_fallback():
    assert next_occurrence(schedule={"type": "recurring"}, tz_name="UTC",
                           after=U(2026, 1, 1)) == U(2026, 1, 1, 9, 0)


def test_a_none_schedule_should_be_tolerated_like_an_empty_one():
    assert next_occurrence(schedule=None, tz_name="UTC",
                           after=U(2026, 1, 1)) is None


# ── event_relative ──────────────────────────────────────────────────────────

@pytest.mark.parametrize("offset,expected_hour,expected_minute", [
    (-15, 9, 45),      # fifteen minutes before the session
    (-1440, 10, 0),    # a day before the deadline
    (0, 10, 0),
    (30, 10, 30),
])
def test_event_relative_offsets(offset, expected_hour, expected_minute):
    anchor = U(2026, 5, 1, 10, 0)
    got = next_occurrence(
        schedule={"type": "event_relative", "anchor_at": anchor,
                  "offset_minutes": offset},
        tz_name="Asia/Kolkata", after=U(2026, 1, 1))
    assert (got.hour, got.minute) == (expected_hour, expected_minute)
    if offset < 0:
        assert got < anchor
    elif offset > 0:
        assert got > anchor


def test_event_relative_in_the_past_returns_none():
    anchor = U(2026, 5, 1, 10, 0)
    assert next_occurrence(
        schedule={"type": "event_relative", "anchor_at": anchor,
                  "offset_minutes": -15},
        tz_name="UTC", after=U(2026, 5, 1, 9, 50)) is None


def test_event_relative_without_an_anchor_returns_none():
    assert next_occurrence(schedule={"type": "event_relative", "anchor_at": None,
                                     "offset_minutes": -15},
                           tz_name="UTC", after=U(2026, 1, 1)) is None


# ── materialise ─────────────────────────────────────────────────────────────

def test_materialise_stops_at_the_horizon():
    got = materialise(schedule=daily("07:00"), tz_name="Asia/Kolkata",
                      after=U(2026, 6, 1), horizon=U(2026, 6, 10))
    assert len(got) == 9
    assert all(g <= U(2026, 6, 10) for g in got)


def test_materialise_respects_ends_at():
    got = materialise(schedule=daily("07:00"), tz_name="Asia/Kolkata",
                      after=U(2026, 6, 1), horizon=U(2026, 12, 1),
                      ends_at=U(2026, 6, 5))
    assert [g.astimezone(IST).day for g in got] == [1, 2, 3, 4]


@pytest.mark.parametrize("limit", [1, 3, 10])
def test_materialise_respects_limit(limit):
    got = materialise(schedule=daily("07:00"), tz_name="Asia/Kolkata",
                      after=U(2026, 6, 1), horizon=U(2027, 6, 1), limit=limit)
    assert len(got) == limit


def test_materialise_never_returns_duplicates_over_a_long_run():
    got = materialise(schedule=daily("07:00"), tz_name="Europe/London",
                      after=U(2026, 1, 1), horizon=U(2027, 1, 1), limit=400)
    assert len(set(got)) == len(got)
    assert got == sorted(got)
    assert len({g.astimezone(LONDON).date() for g in got}) == len(got)


def test_materialise_is_idempotent_when_resumed_from_its_last_instant():
    """
    How `fill()` uses it: the second pass starts after the last row it made
    and must not re-produce it.
    """
    first = materialise(schedule=daily("07:00"), tz_name="Asia/Kolkata",
                        after=U(2026, 6, 1), horizon=U(2026, 6, 5))
    second = materialise(schedule=daily("07:00"), tz_name="Asia/Kolkata",
                         after=first[-1], horizon=U(2026, 6, 8))
    assert not set(first) & set(second)


@pytest.mark.parametrize("schedule", [
    {"type": "once", "at": U(2026, 6, 2, 8, 0)},
    {"type": "event_relative", "anchor_at": U(2026, 6, 2, 8, 0),
     "offset_minutes": -15},
])
def test_one_off_rules_produce_exactly_one_instant(schedule):
    got = materialise(schedule=schedule, tz_name="Asia/Kolkata",
                      after=U(2026, 6, 1), horizon=U(2026, 12, 1))
    assert len(got) == 1


def test_materialise_returns_nothing_when_the_horizon_is_behind_after():
    assert materialise(schedule=daily("07:00"), tz_name="Asia/Kolkata",
                       after=U(2026, 6, 10), horizon=U(2026, 6, 1)) == []


def test_lookahead_is_bounded():
    """A rule that can never match must return, not loop."""
    assert MAX_LOOKAHEAD_DAYS <= 400
    # 2 and 3 June 2026 are a Tuesday and a Wednesday, so a Monday-only rule
    # has nothing to produce inside the window and must simply return.
    got = materialise(schedule=daily("07:00", days=[0]), tz_name="Asia/Kolkata",
                      after=U(2026, 6, 2), horizon=U(2026, 6, 3))
    assert got == []


# ── bad input on the recurring path ─────────────────────────────────────────

def test_unknown_timezone_on_a_recurring_rule_falls_back_to_utc():
    got = next_occurrence(schedule=daily("07:00"), tz_name="Mars/Phobos",
                          after=U(2026, 6, 1))
    assert got == U(2026, 6, 1, 7, 0)


@pytest.mark.parametrize("local_time,expected", [
    ("", (9, 0)),
    (None, (9, 0)),
    ("99:99", (23, 59)),
    ("garbage", (9, 0)),
])
def test_malformed_local_time_still_produces_an_instant(local_time, expected):
    got = next_occurrence(schedule={"type": "recurring", "local_time": local_time,
                                    "days": []},
                          tz_name="Asia/Kolkata", after=U(2026, 6, 1))
    assert got is not None
    assert (got.astimezone(IST).hour, got.astimezone(IST).minute) == expected


# ── rebuild_for_zone ────────────────────────────────────────────────────────

PENDING = [U(2026, 6, 1, 1, 30), U(2026, 6, 2, 1, 30)]   # 07:00 IST


def test_keep_instant_returns_the_input_unchanged():
    """A safety deadline is elapsed time. Crossing a border moves nothing."""
    got = rebuild_for_zone(schedule=daily("07:00"), old_tz="Asia/Kolkata",
                           new_tz="Asia/Dubai", drift="keep_instant",
                           pending=PENDING)
    assert got == PENDING
    assert got is not PENDING       # a copy, so the caller's list is safe


def test_keep_local_preserves_the_wall_clock_in_the_new_zone():
    """Her 7am habit is 7am in Dubai too."""
    got = rebuild_for_zone(schedule=daily("07:00"), old_tz="Asia/Kolkata",
                           new_tz="Asia/Dubai", drift="keep_local",
                           pending=PENDING)
    assert [g.astimezone(DUBAI).strftime("%Y-%m-%d %H:%M") for g in got] == [
        "2026-06-01 07:00", "2026-06-02 07:00"]
    assert got != PENDING           # the instants really did move


def test_keep_local_takes_the_calendar_day_from_the_old_zone():
    """
    23:30 IST on 1 June is 18:00 UTC on 1 June. The day she meant is the 1st,
    read in Kolkata, not whatever day it happens to be in the new zone.
    """
    pending = [U(2026, 6, 1, 18, 0)]
    got = rebuild_for_zone(schedule=daily("23:30"), old_tz="Asia/Kolkata",
                           new_tz="Asia/Dubai", drift="keep_local",
                           pending=pending)
    assert got[0].astimezone(DUBAI).strftime("%Y-%m-%d %H:%M") == "2026-06-01 23:30"


@pytest.mark.parametrize("drift", ["keep_local", "keep_instant"])
def test_rebuild_with_nothing_pending_is_empty(drift):
    assert rebuild_for_zone(schedule=daily("07:00"), old_tz="Asia/Kolkata",
                            new_tz="Asia/Dubai", drift=drift, pending=[]) == []


def test_rebuild_survives_an_unknown_new_zone():
    got = rebuild_for_zone(schedule=daily("07:00"), old_tz="Asia/Kolkata",
                           new_tz="Mars/Phobos", drift="keep_local",
                           pending=PENDING)
    assert [g.astimezone(UTC).strftime("%H:%M") for g in got] == ["07:00", "07:00"]


def test_keep_local_must_not_invent_nine_am_for_a_one_off():
    schedule = {"type": "once", "at": U(2026, 6, 1, 8, 30), "local_time": "",
                "days": [], "offset_minutes": 0, "anchor_at": None}
    pending = [U(2026, 6, 1, 8, 30)]            # 14:00 IST
    got = rebuild_for_zone(schedule=schedule, old_tz="Asia/Kolkata",
                           new_tz="Asia/Dubai", drift="keep_local",
                           pending=pending)
    assert got[0].astimezone(DUBAI).strftime("%H:%M") != "09:00", (
        f"a 14:00 one-off became {got[0].astimezone(DUBAI):%H:%M} in Dubai")
