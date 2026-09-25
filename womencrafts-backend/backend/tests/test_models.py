"""
`app/models/reminders.py` and `app/models/notify.py` — the invariants that
protect correctness.

Two of these keys are the only thing standing between a retried tick and a
second buzz in her pocket: they are written into unique indexes
(`app/db/indexes.py`, `idem_unique` and `dedupe_unique`), so if the key is not
stable the database cannot reject the duplicate. Everything here is pure.
"""

import os
import time as time_module
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest

from app.models.notify import (
    AuditModel,
    DeliveryModel,
    IntentModel,
    OutboxModel,
    PolicyDecisionModel,
    PreferenceModel,
    ReceiptModel,
    SubscriptionModel,
)
from app.models.reminders import OccurrenceModel, ReminderModel

IST = ZoneInfo("Asia/Kolkata")
UTC = timezone.utc
DUE = datetime(2026, 6, 1, 1, 30, tzinfo=UTC)


# ── OccurrenceModel.idempotency_key ─────────────────────────────────────────

def test_idempotency_key_is_stable_for_the_same_inputs():
    a = OccurrenceModel.idempotency_key("def1", DUE, 3)
    b = OccurrenceModel.idempotency_key("def1", DUE, 3)
    assert a == b == "def1:1780277400:3"


@pytest.mark.parametrize("definition_id,due_at,version", [
    ("def2", DUE, 3),                                  # the definition changed
    ("def1", DUE + timedelta(minutes=1), 3),           # the instant changed
    ("def1", DUE + timedelta(days=1), 3),
    ("def1", DUE, 4),                                  # the rule was edited
])
def test_idempotency_key_changes_when_any_component_changes(definition_id,
                                                            due_at, version):
    assert (OccurrenceModel.idempotency_key(definition_id, due_at, version)
            != OccurrenceModel.idempotency_key("def1", DUE, 3))


def test_idempotency_key_is_the_instant_not_the_wall_clock():
    """
    07:00 in Kolkata and 01:30 UTC are the same moment. Two workers holding
    the same instant in different representations must collide, not both
    insert.
    """
    same_moment = DUE.astimezone(IST)
    assert same_moment.strftime("%H:%M") == "07:00"
    assert (OccurrenceModel.idempotency_key("def1", same_moment, 3)
            == OccurrenceModel.idempotency_key("def1", DUE, 3))


def test_idempotency_key_ignores_sub_second_differences():
    """
    Deliberate: `int(timestamp())`. Two materialisations of the same minute
    that differ by microseconds produce ONE key, so the duplicate is rejected
    rather than inserted alongside.
    """
    assert (OccurrenceModel.idempotency_key("def1", DUE.replace(microsecond=500000), 3)
            == OccurrenceModel.idempotency_key("def1", DUE, 3))


def test_a_version_bump_makes_the_old_occurrence_recognisable():
    """Editing a rule must not silently reuse the key of a stale occurrence."""
    keys = {OccurrenceModel.idempotency_key("def1", DUE, v) for v in range(1, 6)}
    assert len(keys) == 5


def test_create_document_stores_exactly_that_key():
    doc = OccurrenceModel.create_document(
        definition_id="def1", user_id="u1", due_at=DUE, version=3)
    assert doc["idem"] == OccurrenceModel.idempotency_key("def1", DUE, 3)
    assert doc["schedule_version"] == 3
    assert doc["state"] == OccurrenceModel.STATE_SCHEDULED
    assert doc["attempts"] == 0
    assert doc["lease_owner"] == "" and doc["lease_expires_at"] is None


@pytest.mark.skipif(not hasattr(time_module, "tzset"),
                    reason="needs tzset to pin the process timezone")
def test_a_naive_due_at_produces_a_different_key_than_the_same_utc_instant():
    """
    A naive `due_at` must key the SAME as the aware instant it represents.

    `int(due_at.timestamp())` on a naive datetime is read in the machine's
    local zone. Motor is created without `tz_aware=True`, so a `due_at` read
    back out of Mongo is naive UTC — and recomputing this key from a stored
    document on a non-UTC server used to produce a different string, defeating
    the unique index that is the only thing stopping a duplicate send. The key
    now normalises to UTC first; this pins that, with the process timezone
    forced to a non-UTC one so the test cannot pass by accident.
    """
    previous = os.environ.get("TZ")
    try:
        os.environ["TZ"] = "Asia/Kolkata"
        time_module.tzset()
        naive_utc = DUE.replace(tzinfo=None)      # what Mongo hands back
        assert (OccurrenceModel.idempotency_key("def1", naive_utc, 3)
                == OccurrenceModel.idempotency_key("def1", DUE, 3))
    finally:
        if previous is None:
            os.environ.pop("TZ", None)
        else:
            os.environ["TZ"] = previous
        time_module.tzset()


# ── IntentModel.dedupe_key ──────────────────────────────────────────────────

def test_dedupe_key_is_stable():
    args = ("u1", "reminder.due", "occ1", "2026-06-01")
    assert (IntentModel.dedupe_key(*args) == IntentModel.dedupe_key(*args)
            == "u1:reminder.due:occ1:2026-06-01")


@pytest.mark.parametrize("args", [
    ("u2", "reminder.due", "occ1", "2026-06-01"),   # a different member
    ("u1", "order.shipped", "occ1", "2026-06-01"),  # a different template
    ("u1", "reminder.due", "occ2", "2026-06-01"),   # a different occurrence
    ("u1", "reminder.due", "occ1", "2026-06-02"),   # the next day's bucket
])
def test_dedupe_key_changes_when_any_component_changes(args):
    assert (IntentModel.dedupe_key(*args)
            != IntentModel.dedupe_key("u1", "reminder.due", "occ1", "2026-06-01"))


def test_the_same_event_twice_in_one_bucket_is_one_key():
    """A duplicated domain event and a double tick must collide."""
    keys = {IntentModel.dedupe_key("u1", "circle.payment_due", "circle9",
                                   "2026-06-01") for _ in range(5)}
    assert len(keys) == 1


def test_intent_document_carries_the_key_and_an_expiry():
    doc = IntentModel.create_document(
        user_id="u1", template_key="reminder.due", category="reminders",
        klass=ReminderModel.CLASS_USER,
        dedupe=IntentModel.dedupe_key("u1", "reminder.due", "occ1", "b"))
    assert doc["dedupe_key"] == "u1:reminder.due:occ1:b"
    assert doc["state"] == IntentModel.STATE_CREATED
    # "Two hours late is a nudge; nine hours late is a stranger waking her."
    assert timedelta(hours=5) < doc["expires_at"] - doc["created_at"] <= timedelta(hours=6)


# ── DeliveryModel.next_retry ────────────────────────────────────────────────

@pytest.mark.parametrize("attempts,seconds", [
    (0, 30), (1, 30), (2, 120), (3, 600), (4, 1800),
    (5, 1800), (99, 1800), (-3, 30),
])
def test_next_retry_backs_off_and_then_holds_at_the_last_step(attempts, seconds):
    before = datetime.now(UTC)
    got = DeliveryModel.next_retry(attempts)
    delta = (got - before).total_seconds()
    assert seconds <= delta <= seconds + 2
    assert got.tzinfo == UTC


def test_next_retry_never_exceeds_the_last_backoff_step():
    cap = DeliveryModel.BACKOFF_SECONDS[-1]
    now = datetime.now(UTC)
    for attempts in range(0, DeliveryModel.MAX_ATTEMPTS + 20):
        assert (DeliveryModel.next_retry(attempts) - now).total_seconds() <= cap + 2


def test_backoff_is_monotonic_and_bounded():
    waits = [(DeliveryModel.next_retry(a) - datetime.now(UTC)).total_seconds()
             for a in range(1, len(DeliveryModel.BACKOFF_SECONDS) + 1)]
    assert waits == sorted(waits)
    assert len(DeliveryModel.BACKOFF_SECONDS) < DeliveryModel.MAX_ATTEMPTS


# ── coercion of invalid enum values ─────────────────────────────────────────

def _reminder(**kw):
    base = dict(user_id="u1", title_key="reminder.water", schedule_type="recurring",
                tz="Asia/Kolkata")
    return ReminderModel.create_document(**{**base, **kw})


@pytest.mark.parametrize("klass,expected", [
    ("safety", "safety"),
    ("transactional", "transactional"),
    ("discretionary", "discretionary"),
    ("SAFETY", ReminderModel.CLASS_USER),      # case matters; unknown -> user
    ("urgent", ReminderModel.CLASS_USER),
    ("", ReminderModel.CLASS_USER),
    (None, ReminderModel.CLASS_USER),
])
def test_unknown_klass_becomes_class_user(klass, expected):
    assert _reminder(klass=klass)["klass"] == expected


@pytest.mark.parametrize("schedule_type,expected", [
    ("recurring", "recurring"),
    ("event_relative", "event_relative"),
    ("cron", ReminderModel.SCHEDULE_ONCE),
    ("", ReminderModel.SCHEDULE_ONCE),
    (None, ReminderModel.SCHEDULE_ONCE),
])
def test_unknown_schedule_type_becomes_once(schedule_type, expected):
    assert _reminder(schedule_type=schedule_type)["schedule"]["type"] == expected


@pytest.mark.parametrize("category,expected", [
    ("orders", "orders"), ("safety", "safety"),
    ("marketing", "reminders"), ("", "reminders"),
])
def test_unknown_category_becomes_reminders(category, expected):
    assert _reminder(category=category)["category"] == expected


@pytest.mark.parametrize("drift,expected", [
    ("keep_instant", "keep_instant"),
    ("keep_local", "keep_local"),
    ("absolute", ReminderModel.DRIFT_LOCAL),
    ("", ReminderModel.DRIFT_LOCAL),
])
def test_unknown_drift_becomes_keep_local(drift, expected):
    assert _reminder(drift=drift)["drift"] == expected


@pytest.mark.parametrize("tz,expected", [("Asia/Kolkata", "Asia/Kolkata"),
                                         ("", "UTC"), (None, "UTC")])
def test_a_blank_timezone_becomes_utc(tz, expected):
    assert _reminder(tz=tz)["tz"] == expected


def test_a_new_rule_starts_scheduled_at_version_one():
    doc = _reminder()
    assert doc["state"] == ReminderModel.STATE_SCHEDULED
    assert doc["version"] == 1
    assert doc["starts_at"] is not None and doc["ends_at"] is None


def test_schedule_fields_are_normalised():
    doc = _reminder(days=(0, 2), offset_minutes="-15", local_time="07:30")
    assert doc["schedule"]["days"] == [0, 2]          # a list, never a tuple
    assert doc["schedule"]["offset_minutes"] == -15   # an int, never a string
    assert doc["schedule"]["local_time"] == "07:30"


@pytest.mark.parametrize("mode,expected", [
    ("off", "off"), ("inapp_only", "inapp_only"),
    ("silent", PreferenceModel.MODE_ALL), ("", PreferenceModel.MODE_ALL),
])
def test_unknown_preference_mode_becomes_all(mode, expected):
    assert PreferenceModel.create_document(user_id="u1", version=1,
                                           mode=mode)["mode"] == expected


def test_default_channels_are_inapp_only():
    """Everything but the inbox is opt-in."""
    doc = PreferenceModel.create_document(user_id="u1", version=1)
    assert doc["channels"]["inapp"] is True
    assert not any(doc["channels"][c] for c in
                   ("push", "email", "sms", "whatsapp", "voice"))
    assert doc["budget"] == {"discretionary_per_day": 2, "min_gap_minutes": 240}
    assert doc["fatigue"] == {} and doc["paused_until"] is None


def test_quiet_hours_are_enabled_on_a_fresh_preference_document():
    """
    Characterising what the code does. NOTE: the comment beside this field in
    app/models/notify.py says "Off by default", and the value written is True.
    The value matches `policy._in_quiet_hours`, which also defaults to on
    (`q.get("enabled", True)`), so the comment is what is out of date.
    """
    doc = PreferenceModel.create_document(user_id="u1", version=1)
    assert doc["quiet"]["enabled"] is True
    assert doc["quiet"]["start"] == "21:30" and doc["quiet"]["end"] == "07:00"


def test_version_is_coerced_to_an_int():
    assert PreferenceModel.create_document(user_id="u1", version="7")["version"] == 7


# ── the smaller records ─────────────────────────────────────────────────────

@pytest.mark.parametrize("seconds,expected", [(10, 30), (0, 30), (-5, 30),
                                              (120, 120), (600, 600)])
def test_a_lease_is_never_shorter_than_thirty_seconds(seconds, expected):
    """A lease shorter than a dispatch would let two workers hold one row."""
    before = datetime.now(UTC)
    delta = (OccurrenceModel.lease_until(seconds) - before).total_seconds()
    assert expected <= delta <= expected + 2


def test_delivery_document_starts_unattempted():
    doc = DeliveryModel.create_document(intent_id="i1", user_id="u1",
                                        channel="push", cost_micros="250")
    assert doc["state"] == DeliveryModel.CREATED
    assert doc["attempts"] == 0 and doc["next_retry_at"] is None
    assert doc["cost_micros"] == 250          # counted before dispatch, as an int


def test_provider_accepted_is_not_delivered():
    """The states are deliberately distinct; collapsing them is the bug."""
    assert DeliveryModel.ACCEPTED != DeliveryModel.DELIVERED != DeliveryModel.OPENED
    assert len(set(DeliveryModel.STATES)) == len(DeliveryModel.STATES)


def test_policy_decision_records_the_preference_version_it_used():
    doc = PolicyDecisionModel.create_document(
        intent_id="i1", user_id="u1", decision=PolicyDecisionModel.HOLD,
        reason="quiet_hours", preference_version="4",
        release_after=DUE, budget_used="1")
    assert doc["preference_version"] == 4 and doc["budget_used"] == 1
    assert doc["release_after"] == DUE
    assert doc["channels"] == []


@pytest.mark.parametrize("model,kwargs,key", [
    (ReceiptModel, dict(occurrence_id="o1", user_id="u1", action="done"), "action"),
    (SubscriptionModel, dict(user_id="u1", endpoint="https://e", p256dh="p",
                             auth="a"), "endpoint"),
    (AuditModel, dict(actor="system", action="tick", target="o1"), "action"),
    (OutboxModel, dict(event="booking.moved", module="bookings", ref="b1",
                       idem="booking.moved:b1"), "idem"),
])
def test_the_small_records_build_without_a_database(model, kwargs, key):
    doc = model.create_document(**kwargs)
    assert doc[key] == kwargs[key]


def test_reminder_to_response_hides_internals_and_keeps_the_version():
    doc = _reminder(local_time="07:30", days=[0, 2, 4])
    doc["_id"] = "abc123"
    out = ReminderModel.to_response(doc)
    assert out["id"] == "abc123"
    assert out["schedule"]["local_time"] == "07:30"
    assert out["schedule"]["days"] == [0, 2, 4]
    assert out["version"] == 1
    assert "user_id" not in out and "created_by" not in out


def test_occurrence_to_response_is_safe_on_a_partial_document():
    assert OccurrenceModel.to_response({}) == {
        "id": "", "definition_id": "", "due_at": None,
        "state": OccurrenceModel.STATE_SCHEDULED, "category": "reminders",
        "completed_at": None}
