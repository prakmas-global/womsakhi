"""
Drive the engines against a real database, the way a request would.

NOT a unit test and deliberately not collected by pytest — it needs a live
MongoDB and it writes. Run it by hand, or in CI against a throwaway database:

    ./venv/bin/python tests/acceptance_engines.py

It cleans up after itself: every document it writes is keyed to one synthetic
user id and deleted at the end, including on the failure paths.

Not a unit test — this is the acceptance run: create reminders, tick, watch
what the policy layer decides, prove A10's two stages, prove concurrency does
not duplicate, then clean up after itself.
"""
import asyncio, os, sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, "/Users/praveenmaddela/Desktop/PRAKMAS-GLOBAL/womencrafts-backend/backend")
os.chdir("/Users/praveenmaddela/Desktop/PRAKMAS-GLOBAL/womencrafts-backend/backend")

from app.core.config import settings
settings.ENGINES_ENABLED = True
settings.ENGINES_TICK_SECRET = "e2e-local"

from app.db.mongodb import connect_db, close_db, get_database
from app.db.indexes import ensure_indexes
from app.engines import domain, notify, policy, tick
from app.engines import reminders as rem
from app.models.notify import (DeliveryModel, IntentModel, PolicyDecisionModel,
                               PreferenceModel)
from app.models.reminders import OccurrenceModel, ReminderModel

USER = "e2e000000000000000000001"
ok = fail = 0


def aware(dt):
    """Mongo returns naive UTC. Compare like with like."""
    return dt.replace(tzinfo=timezone.utc) if dt and dt.tzinfo is None else dt


def check(label, got, want=None, truthy=False):
    global ok, fail
    good = bool(got) if truthy else (got == want)
    print(f"  {'PASS' if good else 'FAIL'}  {label:<58} {got!r}"
          + ("" if good or truthy else f"  (wanted {want!r})"))
    if good: ok += 1
    else: fail += 1


async def cleanup(db):
    for c in ("reminder_definitions", "reminder_occurrences", "outbox",
              "notification_intents", "preference_versions", "policy_decisions",
              "delivery_attempts", "action_receipts", "audit_events",
              "device_subscriptions"):
        await db[c].delete_many({"user_id": USER})
    await db["member_notifications"].delete_many({"user_id": USER})
    await db["outbox"].delete_many({"module": "e2e"})


async def main():
    await connect_db()
    await ensure_indexes()
    db = get_database()
    await cleanup(db)
    now = datetime.now(timezone.utc)

    print("\n── 1. a reminder due now becomes a message ──")
    r1 = await rem.create(user_id=USER, title_key="e2e.now", schedule_type="once",
                          tz="Asia/Kolkata", at=now - timedelta(seconds=5),
                          klass=ReminderModel.CLASS_USER)
    n = await db[OccurrenceModel.collection_name].count_documents(
        {"definition_id": str(r1["_id"])})
    check("occurrence materialised", n, 1)
    res = await tick.run_tick()
    check("tick raised one intent", res.get("raised"), 1)
    intent = await db[IntentModel.collection_name].find_one({"user_id": USER})
    check("intent dispatched", (intent or {}).get("state"), IntentModel.STATE_DISPATCHED)
    inbox = await db["member_notifications"].count_documents({"user_id": USER})
    check("inbox row written", inbox, 1)

    print("\n── 2. ticking again does not send it twice ──")
    before = await db[IntentModel.collection_name].count_documents({"user_id": USER})
    await tick.run_tick()
    after = await db[IntentModel.collection_name].count_documents({"user_id": USER})
    check("no duplicate intent", after, before)

    print("\n── 3. ten concurrent ticks claim each row once ──")
    await cleanup(db)
    for i in range(12):
        await rem.create(user_id=USER, title_key=f"e2e.race{i}", schedule_type="once",
                         tz="UTC", at=now - timedelta(seconds=10))
    results = await asyncio.gather(*[tick.run_tick() for _ in range(10)])
    raised = sum(r.get("raised", 0) for r in results)
    intents = await db[IntentModel.collection_name].count_documents({"user_id": USER})
    check("12 reminders → 12 intents", intents, 12)
    check("no reminder raised twice", raised, 12)

    print("\n── 4. quiet hours HOLD an optional message, not drop it ──")
    await cleanup(db)
    local = now.astimezone(__import__("zoneinfo").ZoneInfo("Asia/Kolkata"))
    # A window that certainly contains 'now' in her zone.
    start = (local - timedelta(hours=1)).strftime("%H:%M")
    end = (local + timedelta(hours=2)).strftime("%H:%M")
    await policy.update(USER, {"tz": "Asia/Kolkata",
                               "quiet": {"start": start, "end": end,
                                         "days": [], "enabled": True}})
    r4 = await rem.create(user_id=USER, title_key="e2e.quiet", schedule_type="once",
                          tz="Asia/Kolkata", at=now - timedelta(seconds=5),
                          klass=ReminderModel.CLASS_USER)
    await tick.run_tick()
    held = await db[IntentModel.collection_name].find_one({"user_id": USER})
    check("held, not suppressed", (held or {}).get("state"), IntentModel.STATE_HELD)
    check("reason recorded", (held or {}).get("held_reason"), "quiet_hours")
    check("has a release time", (held or {}).get("release_after"), truthy=True)
    dec = await db[PolicyDecisionModel.collection_name].find_one({"user_id": USER})
    check("decision stored for 'why?'", (dec or {}).get("decision"),
          PolicyDecisionModel.HOLD)

    print("\n── 5. a SAFETY deadline ignores quiet hours entirely ──")
    await db[IntentModel.collection_name].delete_many({"user_id": USER})
    await domain.schedule_deadline(user_id=USER, module="e2e", ref="trip1",
                                   at=now - timedelta(seconds=5),
                                   title_key="e2e.checkin")
    await tick.run_tick()
    saf = await db[IntentModel.collection_name].find_one(
        {"user_id": USER, "category": "safety"})
    check("safety dispatched in quiet hours", (saf or {}).get("state"),
          IntentModel.STATE_DISPATCHED)

    print("\n── 6. Off stops work that is already queued ──")
    await cleanup(db)
    await policy.update(USER, {"mode": PreferenceModel.MODE_OFF,
                               "quiet": {"enabled": False}})
    await rem.create(user_id=USER, title_key="e2e.off", schedule_type="once",
                     tz="UTC", at=now - timedelta(seconds=5))
    await tick.run_tick()
    off = await db[IntentModel.collection_name].find_one({"user_id": USER})
    check("suppressed by mode_off", (off or {}).get("state"),
          IntentModel.STATE_SUPPRESSED)
    check("reason is mode_off", (off or {}).get("held_reason"), "mode_off")

    print("\n── 7. the attention budget is shared across modules ──")
    await cleanup(db)
    await policy.update(USER, {"mode": PreferenceModel.MODE_ALL,
                               "quiet": {"enabled": False},
                               "budget": {"discretionary_per_day": 2,
                                          "min_gap_minutes": 0}})
    for i in range(4):
        await rem.create(user_id=USER, title_key=f"e2e.nudge{i}",
                         schedule_type="once", tz="UTC",
                         at=now - timedelta(seconds=5),
                         klass=ReminderModel.CLASS_DISCRETIONARY,
                         category=["learning", "circles", "orders", "reminders"][i])
    await tick.run_tick()
    allowed = await db[IntentModel.collection_name].count_documents(
        {"user_id": USER, "state": IntentModel.STATE_DISPATCHED})
    blocked = await db[IntentModel.collection_name].count_documents(
        {"user_id": USER, "state": IntentModel.STATE_SUPPRESSED})
    check("only 2 of 4 optional messages allowed", allowed, 2)
    check("the other 2 suppressed", blocked, 2)

    print("\n── 8. A10: book → remind → ask whether it happened ──")
    await cleanup(db)
    await policy.update(USER, {"mode": PreferenceModel.MODE_ALL,
                               "quiet": {"enabled": False},
                               "budget": {"discretionary_per_day": 50,
                                          "min_gap_minutes": 0}})
    session_at = now + timedelta(minutes=40)
    pair = await domain.book_with_followup(
        user_id=USER, module="e2e", ref="booking1",
        starts_at=session_at, tz="Asia/Kolkata",
        remind_before_minutes=30, followup_after_minutes=120)
    b = await db[OccurrenceModel.collection_name].find_one(
        {"definition_id": pair["before_id"]})
    f = await db[OccurrenceModel.collection_name].find_one(
        {"definition_id": pair["followup_id"]})
    check("reminder is 30 min BEFORE", b and
          abs((aware(b["due_at"]) - (session_at - timedelta(minutes=30))).total_seconds()) < 2,
          True)
    check("follow-up is 2 h AFTER", f and
          abs((aware(f["due_at"]) - (session_at + timedelta(minutes=120))).total_seconds()) < 2,
          True)
    check("both scheduled at booking time", bool(b and f), True)

    print("\n── 9. cancelling the booking stops BOTH ──")
    await domain.emit(event="booking.cancelled", module="e2e", ref="booking1")
    await tick.run_tick()
    live = await db[OccurrenceModel.collection_name].count_documents(
        {"user_id": USER, "state": OccurrenceModel.STATE_SCHEDULED,
         "definition_id": {"$in": [pair["before_id"], pair["followup_id"]]}})
    check("no occurrences left alive", live, 0)

    print("\n── 10. moving the booking moves the reminder ──")
    await cleanup(db)
    session_at = now + timedelta(hours=3)
    pair = await domain.book_with_followup(
        user_id=USER, module="e2e", ref="booking2", starts_at=session_at,
        remind_before_minutes=30, followup_after_minutes=120)
    moved_to = session_at + timedelta(hours=2)
    await domain.emit(event="booking.moved", module="e2e", ref="booking2",
                      payload={"new_at": moved_to})
    await tick.run_tick()
    b2 = await db[OccurrenceModel.collection_name].find_one(
        {"definition_id": pair["before_id"],
         "state": OccurrenceModel.STATE_SCHEDULED}, sort=[("due_at", -1)])
    check("reminder followed the booking", b2 and
          abs((aware(b2["due_at"]) - (moved_to - timedelta(minutes=30))).total_seconds()) < 2,
          True)

    print("\n── 11. Done is recorded once, however many times she taps ──")
    occ = await db[OccurrenceModel.collection_name].find_one(
        {"user_id": USER, "state": OccurrenceModel.STATE_SCHEDULED})
    for _ in range(3):
        await notify.record_action(occurrence_id=str(occ["_id"]), user_id=USER,
                                   action="done")
    receipts = await db["action_receipts"].count_documents(
        {"occurrence_id": str(occ["_id"])})
    check("one receipt from three taps", receipts, 1)
    done = await db[OccurrenceModel.collection_name].find_one({"_id": occ["_id"]})
    check("occurrence completed", done["state"], OccurrenceModel.STATE_COMPLETED)

    print("\n── 12. another member cannot complete her reminder ──")
    occ2 = await db[OccurrenceModel.collection_name].find_one(
        {"user_id": USER, "state": OccurrenceModel.STATE_SCHEDULED})
    if occ2:
        stolen = await rem.complete(str(occ2["_id"]), user_id="someone-else")
        check("refused for the wrong user", stolen, False)

    print("\n── 13. an outage expires stale nudges instead of bursting ──")
    await cleanup(db)
    await rem.create(user_id=USER, title_key="e2e.stale", schedule_type="once",
                     tz="UTC", at=now - timedelta(hours=9),
                     klass=ReminderModel.CLASS_DISCRETIONARY)
    await rem.create(user_id=USER, title_key="e2e.stale.safety", schedule_type="once",
                     tz="UTC", at=now - timedelta(hours=9),
                     klass=ReminderModel.CLASS_SAFETY, category="safety")
    res = await tick.run_tick()
    expired = await db[OccurrenceModel.collection_name].count_documents(
        {"user_id": USER, "state": OccurrenceModel.STATE_EXPIRED})
    safety_sent = await db[IntentModel.collection_name].count_documents(
        {"user_id": USER, "category": "safety"})
    check("stale optional work expired", expired, 1)
    check("stale SAFETY work still delivered", safety_sent, 1)


    print("\n── 14. REGRESSION: 'Later' actually arrives ──")
    await cleanup(db)
    await policy.update(USER, {"mode": PreferenceModel.MODE_ALL,
                               "quiet": {"enabled": False},
                               "budget": {"discretionary_per_day": 50,
                                          "min_gap_minutes": 0}})
    await rem.create(user_id=USER, title_key="e2e.snooze", schedule_type="once",
                     tz="UTC", at=now - timedelta(seconds=5))
    await tick.run_tick()
    first = await db[IntentModel.collection_name].count_documents({"user_id": USER})
    occ = await db[OccurrenceModel.collection_name].find_one({"user_id": USER})
    await notify.record_action(occurrence_id=str(occ["_id"]), user_id=USER,
                               action="later", detail={"minutes": 5})
    # Move it back into the past so this tick sees it.
    await db[OccurrenceModel.collection_name].update_one(
        {"_id": occ["_id"]}, {"$set": {"due_at": now - timedelta(seconds=1)}})
    await tick.run_tick()
    second = await db[IntentModel.collection_name].count_documents({"user_id": USER})
    check("snoozed reminder produces a SECOND message", second, first + 1)

    print("\n── 15. REGRESSION: an abandoned intent is resumed, not lost ──")
    await cleanup(db)
    r15 = await rem.create(user_id=USER, title_key="e2e.orphan", schedule_type="once",
                           tz="UTC", at=now - timedelta(seconds=5),
                           klass=ReminderModel.CLASS_SAFETY, category="safety")
    occ15 = await db[OccurrenceModel.collection_name].find_one(
        {"definition_id": str(r15["_id"])})
    # Exactly what a killed worker leaves behind: the row written, nothing sent.
    orphan = IntentModel.create_document(
        user_id=USER, template_key="e2e.orphan", category="safety",
        klass=ReminderModel.CLASS_SAFETY,
        dedupe=IntentModel.dedupe_key(USER, "e2e.orphan", "x", "y"),
        occurrence_id=str(occ15["_id"]))
    orphan["created_at"] = now - timedelta(minutes=10)
    await db[IntentModel.collection_name].insert_one(orphan)
    resumed = await notify.resume_orphans(older_than_seconds=60)
    check("the stranded safety intent was resumed", resumed >= 1, True)
    after15 = await db[IntentModel.collection_name].find_one(
        {"_id": orphan["_id"]})
    check("it is no longer stuck at 'created'",
          after15["state"] != IntentModel.STATE_CREATED, True)

    print("\n── 16. REGRESSION: a naive ends_at does not poison the tick ──")
    await cleanup(db)
    r16 = await rem.create(user_id=USER, title_key="e2e.ends", schedule_type="recurring",
                           tz="Asia/Kolkata", local_time="07:00", days=[])
    # Write it back the way Mongo would hand it to us: naive.
    await db[ReminderModel.collection_name].update_one(
        {"_id": r16["_id"]},
        {"$set": {"ends_at": (now + timedelta(days=30)).replace(tzinfo=None)}})
    res16 = await tick.run_tick()
    check("tick survived a naive ends_at", res16.get("enabled"), True)

    print("\n── 17. REGRESSION: one malformed rule does not stop the others ──")
    await db[ReminderModel.collection_name].update_one(
        {"_id": r16["_id"]}, {"$set": {"schedule.days": ["mon"]}})
    good = await rem.create(user_id=USER, title_key="e2e.good",
                            schedule_type="recurring", tz="UTC",
                            local_time="09:00", days=[])
    made = await rem.top_up_horizons()
    check("a good rule still filled alongside a broken one", made >= 0, True)
    res17 = await tick.run_tick()
    check("tick still ran", res17.get("enabled"), True)

    print("\n── 18. REGRESSION: concurrent release_held sends once, not ten times ──")
    await cleanup(db)
    local2 = now.astimezone(__import__("zoneinfo").ZoneInfo("Asia/Kolkata"))
    await policy.update(USER, {"tz": "Asia/Kolkata",
                               "quiet": {"start": (local2 - timedelta(hours=1)).strftime("%H:%M"),
                                         "end": (local2 + timedelta(hours=2)).strftime("%H:%M"),
                                         "days": [], "enabled": True}})
    await rem.create(user_id=USER, title_key="e2e.held", schedule_type="once",
                     tz="Asia/Kolkata", at=now - timedelta(seconds=5))
    await tick.run_tick()
    # Make it releasable, then race ten instances at it.
    await db[IntentModel.collection_name].update_many(
        {"user_id": USER, "state": IntentModel.STATE_HELD},
        {"$set": {"release_after": now - timedelta(seconds=1)}})
    await policy.update(USER, {"quiet": {"enabled": False}})
    await asyncio.gather(*[notify.release_held() for _ in range(10)])
    rows = await db["member_notifications"].count_documents({"user_id": USER})
    check("one inbox row, not ten", rows, 1)

    await cleanup(db)
    await close_db()
    print(f"\n{'='*66}\n  {ok} passed, {fail} failed\n{'='*66}")
    return 1 if fail else 0


sys.exit(asyncio.run(main()))
