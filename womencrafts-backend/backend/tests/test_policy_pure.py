"""
`app/engines/policy.py` — the two helpers that need no database.

`_in_quiet_hours` and `_next_open` are where "held for the wrong eight hours"
lives. Both take a preference document and a UTC instant and do all of their
reasoning in HER timezone, so every case below is written as a UTC instant
that falls on a *different local day* — which is exactly the shape that a
UTC-based implementation gets wrong while looking correct in a demo.

`evaluate()`, `preferences()` and the budget helpers all read collections and
are skipped here; see the `requires_mongo` marker in conftest.
"""

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest

from app.engines.policy import _in_quiet_hours, _next_open
from app.models.notify import PreferenceModel

from conftest import requires_mongo

IST = ZoneInfo("Asia/Kolkata")
LONDON = ZoneInfo("Europe/London")
UTC = timezone.utc


def prefs(tz="Asia/Kolkata", start="21:30", end="07:00", days=None,
          enabled=True, **kw):
    """
    A real preference document, built by the model rather than by hand.

    `enabled` has no constructor argument — `create_document` always writes
    True — so it is set on the nested dict afterwards, which is what an
    update through `policy.update()` would produce.
    """
    doc = PreferenceModel.create_document(
        user_id="u1", version=1, tz=tz, quiet_start=start, quiet_end=end,
        quiet_days=days, **kw)
    doc["quiet"]["enabled"] = enabled
    return doc


def at_local(tz, y, m, d, hh, mm=0):
    """A wall-clock moment in her zone, handed to the helper as UTC."""
    return datetime(y, m, d, hh, mm, tzinfo=tz).astimezone(UTC)


# ── the window that crosses midnight ────────────────────────────────────────

@pytest.mark.parametrize("hour,minute,expected,why", [
    (12, 0, False, "midday"),
    (21, 0, False, "half an hour before it starts"),
    (21, 30, True, "the first minute of the window"),
    (23, 0, True, "late evening"),
    (0, 15, True, "just past midnight — the next local day"),
    (2, 0, True, "the small hours"),
    (6, 59, True, "the last minute"),
    (7, 0, False, "the window ends exactly at 07:00"),
    (9, 0, False, "morning"),
])
def test_quiet_window_crossing_midnight(hour, minute, expected, why):
    p = prefs()
    when = at_local(IST, 2026, 6, 2, hour, minute)
    assert _in_quiet_hours(p, when) is expected, why


def test_quiet_hours_are_read_in_her_zone_not_in_utc():
    """
    2026-06-01T20:30Z is 02:00 on 2 June in Kolkata — deep inside her quiet
    window — and 20:30 the previous evening in UTC, which is outside it. The
    same instant, two answers, and only one of them is hers.
    """
    when = datetime(2026, 6, 1, 20, 30, tzinfo=UTC)
    assert when.astimezone(IST).strftime("%Y-%m-%d %H:%M") == "2026-06-02 02:00"

    assert _in_quiet_hours(prefs(tz="Asia/Kolkata"), when) is True
    assert _in_quiet_hours(prefs(tz="UTC"), when) is False


def test_a_window_that_does_not_cross_midnight_uses_the_range_branch():
    p = prefs(start="13:00", end="15:00")
    assert _in_quiet_hours(p, at_local(IST, 2026, 6, 1, 14, 0)) is True
    assert _in_quiet_hours(p, at_local(IST, 2026, 6, 1, 12, 59)) is False
    assert _in_quiet_hours(p, at_local(IST, 2026, 6, 1, 15, 0)) is False
    assert _in_quiet_hours(p, at_local(IST, 2026, 6, 1, 23, 0)) is False


# ── the switch ──────────────────────────────────────────────────────────────

def test_enabled_false_turns_quiet_hours_off_entirely():
    p = prefs(enabled=False)
    for hour in (22, 23, 2, 5):
        assert _in_quiet_hours(p, at_local(IST, 2026, 6, 2, hour)) is False


def test_quiet_hours_default_to_on_when_the_flag_is_absent():
    """`q.get("enabled", True)` — an older document without the key is quiet."""
    p = prefs()
    del p["quiet"]["enabled"]
    assert _in_quiet_hours(p, at_local(IST, 2026, 6, 1, 23, 0)) is True


def test_a_preference_document_with_no_quiet_block_uses_the_defaults():
    p = prefs()
    p.pop("quiet")
    assert _in_quiet_hours(p, at_local(IST, 2026, 6, 1, 23, 0)) is True
    assert _in_quiet_hours(p, at_local(IST, 2026, 6, 1, 12, 0)) is False


def test_an_unknown_timezone_falls_back_to_utc_instead_of_raising():
    p = prefs(tz="Mars/Phobos")
    assert _in_quiet_hours(p, datetime(2026, 6, 1, 23, 0, tzinfo=UTC)) is True
    assert _in_quiet_hours(p, datetime(2026, 6, 1, 12, 0, tzinfo=UTC)) is False


# ── the days filter ─────────────────────────────────────────────────────────

@pytest.mark.parametrize("weekday,day_of_june,expected", [
    (0, 1, True),    # Monday 1 June 2026
    (1, 2, False),   # Tuesday
    (2, 3, False),
    (6, 7, False),   # Sunday
])
def test_days_restricts_quiet_hours_to_the_chosen_weekdays(weekday, day_of_june,
                                                           expected):
    p = prefs(days=[0])
    when = at_local(IST, 2026, 6, day_of_june, 23, 0)
    assert when.astimezone(IST).weekday() == weekday
    assert _in_quiet_hours(p, when) is expected


def test_an_empty_days_list_means_every_night():
    p = prefs(days=[])
    for day in range(1, 8):
        assert _in_quiet_hours(p, at_local(IST, 2026, 6, day, 23, 0)) is True


@pytest.mark.parametrize("days,expected_weekday", [([7], 0), ([-1], 6)])
def test_out_of_range_days_are_normalised(days, expected_weekday):
    p = prefs(days=days)
    for day in range(1, 8):
        when = at_local(IST, 2026, 6, day, 23, 0)
        assert _in_quiet_hours(p, when) is (
            when.astimezone(IST).weekday() == expected_weekday)


def test_a_midnight_crossing_window_belongs_to_the_night_it_started():
    p = prefs(days=[0])                      # Monday nights only
    monday_night = at_local(IST, 2026, 6, 1, 23, 0)
    still_monday_night = at_local(IST, 2026, 6, 2, 2, 0)   # Tuesday 02:00
    sunday_night_spill = at_local(IST, 2026, 6, 1, 2, 0)   # Monday 02:00

    assert _in_quiet_hours(p, monday_night) is True
    assert _in_quiet_hours(p, still_monday_night) is True, (
        "02:00 on Tuesday is still Monday night")
    assert _in_quiet_hours(p, sunday_night_spill) is False, (
        "02:00 on Monday belongs to Sunday night, which was not chosen")


# ── _next_open ──────────────────────────────────────────────────────────────

def test_next_open_is_in_the_future_and_in_utc():
    p = prefs()
    when = at_local(IST, 2026, 6, 1, 23, 0)
    got = _next_open(p, when)
    assert got > when
    assert got.tzinfo == UTC


def test_next_open_returns_this_mornings_end_when_it_is_still_ahead():
    """At 02:00 the window ends in five hours, not in twenty-nine."""
    p = prefs()
    when = at_local(IST, 2026, 6, 2, 2, 0)
    got = _next_open(p, when)
    assert got.astimezone(IST).strftime("%Y-%m-%d %H:%M") == "2026-06-02 07:00"
    assert got - when == timedelta(hours=5)


def test_next_open_rolls_to_tomorrow_when_todays_end_has_passed():
    p = prefs()
    when = at_local(IST, 2026, 6, 1, 23, 0)
    got = _next_open(p, when)
    assert got.astimezone(IST).strftime("%Y-%m-%d %H:%M") == "2026-06-02 07:00"
    assert got - when == timedelta(hours=8)


@pytest.mark.parametrize("end,expected", [
    ("07:00", "07:00"), ("06:15", "06:15"), ("08:00", "08:00"),
    ("", "07:00"),            # blank is replaced before parsing, not clamped
    ("99:99", "23:59"),
])
def test_next_open_lands_on_the_configured_end_time(end, expected):
    p = prefs(end=end)
    got = _next_open(p, at_local(IST, 2026, 6, 1, 23, 30))
    assert got.astimezone(IST).strftime("%H:%M") == expected


@pytest.mark.parametrize("hour", [22, 23, 0, 1, 3, 6])
def test_a_held_message_is_released_outside_the_quiet_window(hour):
    """The contract between the two helpers: the release moment is not quiet."""
    p = prefs()
    when = at_local(IST, 2026, 6, 2, hour, 0)
    assert _in_quiet_hours(p, when) is True
    release = _next_open(p, when)
    assert release > when
    assert _in_quiet_hours(p, release) is False


def test_next_open_does_not_raise_across_a_dst_gap():
    """
    29 March 2026, Europe/London: 01:00–02:00 local does not exist. A quiet
    window ending at 01:30 must still produce an instant.
    """
    p = prefs(tz="Europe/London", start="22:00", end="01:30")
    when = datetime(2026, 3, 28, 23, 0, tzinfo=LONDON).astimezone(UTC)
    got = _next_open(p, when)
    assert got.tzinfo == UTC
    assert got > when


def test_next_open_ignores_the_days_filter():
    """
    Characterising current behaviour, not endorsing it: with Monday-only quiet
    hours a message held at 23:00 Monday is released at 07:00 Tuesday, though
    Tuesday is not a quiet day and the window really ends at midnight. It over-
    holds by seven hours. Same root cause as the xfail above.
    """
    p = prefs(days=[0])
    got = _next_open(p, at_local(IST, 2026, 6, 1, 23, 0))
    assert got.astimezone(IST).strftime("%Y-%m-%d %H:%M") == "2026-06-02 07:00"


# ── what is deliberately not tested here ────────────────────────────────────

@requires_mongo
def test_evaluate_holds_an_optional_message_during_quiet_hours():
    """`policy.evaluate()` reads preference_versions and policy_decisions."""
    raise AssertionError("unreachable: skipped above")


@requires_mongo
def test_discretionary_budget_is_shared_across_modules():
    """`_discretionary_today()` counts rows in policy_decisions."""
    raise AssertionError("unreachable: skipped above")
