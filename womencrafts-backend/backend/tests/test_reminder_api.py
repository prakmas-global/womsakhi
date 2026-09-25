"""
The schedule vocabulary, checked at the door.

This suite exists because of a bug that produced no error anywhere: a client
sent `schedule_type="daily"`, `ReminderModel.create_document` did not recognise
it, fell back to `once`, and `once` with no `at` materialises to nothing. The
call returned 201 with an id. The reminder was real, visible in her list, and
would never fire — and nothing in the logs, the tests or the database said so.

So these tests assert the two halves of the fix:

- the vocabulary is exactly three words, and a fourth is refused rather than
  quietly reinterpreted;
- each of the three, given what it needs, actually produces instants.
"""

from datetime import datetime, timedelta, timezone

import pytest

from app.engines import schedule as sched
from app.models.reminders import ReminderModel


def _rule(**over) -> dict:
    base = dict(user_id="u", title_key="rem.preset.tablet", schedule_type="recurring",
                tz="Asia/Kolkata", klass=ReminderModel.CLASS_USER, local_time="20:00")
    base.update(over)
    return ReminderModel.create_document(**base)


class TestVocabulary:
    def test_exactly_three_kinds(self):
        assert ReminderModel.SCHEDULES == ("once", "recurring", "event_relative")

    @pytest.mark.parametrize("word", ["daily", "weekly", "monthly", "relative", ""])
    def test_an_unknown_word_still_degrades_in_the_model(self, word):
        """
        The model's fallback is unchanged and this records why that is safe now.

        It stays lenient because a stored document from an older version must
        still load. The refusal belongs at the API boundary — see
        `routes/engines.py::create_reminder` — and this test is the reminder
        that the model alone will NOT catch it.
        """
        doc = _rule(schedule_type=word)
        assert doc["schedule"]["type"] == ReminderModel.SCHEDULE_ONCE

    def test_the_degraded_case_produces_nothing(self):
        """The exact shape of the original bug: accepted, stored, never fires."""
        doc = _rule(schedule_type="daily")          # what the client used to send
        now = datetime.now(timezone.utc)
        out = sched.materialise(schedule=doc["schedule"], tz_name=doc["tz"],
                                after=now, horizon=now + timedelta(days=30),
                                ends_at=None)
        assert out == [], "a one-off with no instant must produce nothing"


class TestEachKindActuallyFires:
    def test_recurring_with_no_days_is_every_day(self):
        doc = _rule(days=[])
        now = datetime.now(timezone.utc)
        out = sched.materialise(schedule=doc["schedule"], tz_name=doc["tz"],
                                after=now, horizon=now + timedelta(days=7), ends_at=None)
        assert len(out) >= 6, f"expected roughly one a day, got {len(out)}"

    def test_recurring_with_days_fires_only_on_those(self):
        # 1 = Tuesday, 3 = Thursday, matching Python's weekday()
        doc = _rule(days=[1, 3])
        now = datetime.now(timezone.utc)
        out = sched.materialise(schedule=doc["schedule"], tz_name=doc["tz"],
                                after=now, horizon=now + timedelta(days=28), ends_at=None)
        assert out, "a weekly reminder must produce instants over four weeks"
        from zoneinfo import ZoneInfo
        local_days = {i.astimezone(ZoneInfo("Asia/Kolkata")).weekday() for i in out}
        assert local_days <= {1, 3}, f"fired on {local_days}, expected only Tue/Thu"

    def test_weekly_may_have_nothing_inside_the_48_hour_horizon(self):
        """
        Why the preview projects instead of reading the queue.

        Occurrences are only filled 48 hours ahead, so a Tuesday reminder set
        on a Friday has none — and a preview that reported "nothing is due"
        would tell her it had not saved.
        """
        doc = _rule(days=[1, 3])
        friday = datetime(2026, 9, 25, 12, 0, tzinfo=timezone.utc)   # a Friday
        near = sched.materialise(schedule=doc["schedule"], tz_name=doc["tz"],
                                 after=friday, horizon=friday + timedelta(hours=48),
                                 ends_at=None)
        far = sched.materialise(schedule=doc["schedule"], tz_name=doc["tz"],
                                after=friday, horizon=friday + timedelta(days=28),
                                ends_at=None)
        assert near == [] and far, "the horizon, not the rule, is why the queue is empty"

    def test_once_needs_its_instant(self):
        now = datetime.now(timezone.utc)
        soon = now + timedelta(hours=3)
        with_at = _rule(schedule_type="once", at=soon, local_time="")
        out = sched.materialise(schedule=with_at["schedule"], tz_name=with_at["tz"],
                                after=now, horizon=now + timedelta(days=2), ends_at=None)
        assert len(out) == 1

        without = _rule(schedule_type="once", at=None, local_time="")
        assert sched.materialise(schedule=without["schedule"], tz_name=without["tz"],
                                 after=now, horizon=now + timedelta(days=30),
                                 ends_at=None) == []
