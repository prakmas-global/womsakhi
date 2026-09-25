"""
The tick: the only thing in this system that knows what time it is.

**Why it is an HTTP endpoint and not a loop.** The API runs on Cloud Run with
`--min-instances 0`. It scales to zero. A loop inside the web process therefore
stops existing exactly when nobody is using the app — which is precisely when a
woman's travel check-in deadline needs to fire. So time arrives from outside:
Cloud Scheduler calls this once a minute, which both wakes an instance and
gives it work to do. That is the whole reason SAFE-UC-036 is achievable at all.

**Why every step assumes concurrency.** `--max-instances 10` means ten
instances can be running this same second. Nothing here may depend on being
alone:

- Work is *claimed*, one document at a time, with `find_one_and_update`. Mongo
  makes that atomic, so exactly one worker wins each row.
- A claim is a **lease**, not a lock: it carries an expiry. A worker that dies
  mid-dispatch leaves a lease that lapses, and the row returns to the pool on
  its own. There is nothing to release and nothing to clean up.
- Every row carries an idempotency key with a unique index, so even a
  double-claimed row cannot produce two messages.

**Why the batch is bounded.** A tick that tried to drain a backlog would hold
an instance open past the request timeout and be killed halfway. Bounded work,
called again a minute later, drains the same backlog without ever being killed
mid-flight.

**Order matters, and it is not arbitrary:**

1. release dead leases — before claiming, so crashed work is available again
2. expire stale optional work — before dispatch, so an outage does not deliver
   a heap of yesterday's encouragement (REM-UC-008)
3. claim and dispatch due occurrences — safety first
4. release held notifications whose quiet hours have ended
5. retry failed deliveries whose backoff has elapsed
6. top up horizons — last, because it is the only step that can be skipped
   without anyone noticing
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

from app.core.config import settings
from app.db.mongodb import get_database
from app.engines import reminders as rem
from app.models.reminders import OccurrenceModel, ReminderModel

# Identifies this process in a lease. Useful in the ops console when two
# instances are fighting over the same work and you need to see which is which.
WORKER_ID = f"{os.getenv('K_REVISION', 'local')}:{uuid.uuid4().hex[:8]}"


def _db():
    return get_database()


async def claim_due(limit: int) -> list[dict]:
    """
    Take up to `limit` occurrences that are due, safety first.

    One `find_one_and_update` per row rather than a bulk update, because the
    atomic swap IS the claim: two instances running this loop interleave
    harmlessly, each winning some rows and losing others. A bulk update would
    hand the same rows to both.
    """
    now = datetime.now(timezone.utc)
    claimed: list[dict] = []
    for _ in range(max(0, limit)):
        doc = await _db()[OccurrenceModel.collection_name].find_one_and_update(
            {"state": {"$in": [OccurrenceModel.STATE_SCHEDULED,
                               OccurrenceModel.STATE_SNOOZED]},
             "due_at": {"$lte": now}},
            {"$set": {"state": OccurrenceModel.STATE_DUE,
                      "lease_owner": WORKER_ID,
                      "lease_expires_at": OccurrenceModel.lease_until(
                          settings.ENGINES_LEASE_SECONDS),
                      "updated_at": now},
             "$inc": {"attempts": 1}},
            # A safety deadline outranks an encouragement that happens to be
            # due in the same second. Within a class, oldest first. Sorted on
            # the numeric priority, never the class name — see the note on
            # ReminderModel.PRIORITY.
            sort=[("priority", 1), ("due_at", 1)],
            return_document=True,
        )
        if not doc:
            break
        claimed.append(doc)
    return claimed


async def _still_current(occ: dict) -> bool:
    """
    Is this occurrence still what its rule says?

    The race this closes: she edits a 7am reminder to 9am while a worker holds
    the 7am row. The edit cannot delete a claimed row without risking a message
    escaping mid-dispatch, so it bumps the version instead and this check
    discards the stale one at the last possible moment.
    """
    rule = await _db()[ReminderModel.collection_name].find_one(
        {"_id": rem._oid(occ["definition_id"])})
    if not rule:
        return False
    if rule.get("state") != ReminderModel.STATE_SCHEDULED:
        return False
    return int(rule.get("version", 1)) == int(occ.get("schedule_version", 1))


async def process_due(limit: int | None = None) -> dict:
    """Claim what is due and hand each one to the Notification Engine."""
    from app.engines import notify   # imported here: notify imports policy,
                                     # policy imports settings — a module-level
                                     # import would make the cycle real.

    limit = limit or settings.ENGINES_TICK_BATCH
    claimed = await claim_due(limit)
    raised = skipped = failed = 0

    for occ in claimed:
        occ_id = str(occ["_id"])
        try:
            if not await _still_current(occ):
                await _db()[OccurrenceModel.collection_name].update_one(
                    {"_id": occ["_id"]},
                    {"$set": {"state": OccurrenceModel.STATE_CANCELLED,
                              "last_error": "stale_schedule_version",
                              "lease_owner": "", "lease_expires_at": None}})
                skipped += 1
                continue

            # Re-checked immediately before the send, not only before the
            # work. The earlier check reads the rule and then an unbounded
            # amount happens — policy, then a live HTTP call to a provider —
            # so a reminder she moved or cancelled in that window still went
            # out. This is the last moment at which it can be stopped.
            if not await _still_current(occ):
                await _db()[OccurrenceModel.collection_name].update_one(
                    {"_id": occ["_id"]},
                    {"$set": {"state": OccurrenceModel.STATE_CANCELLED,
                              "last_error": "cancelled_before_dispatch",
                              "lease_owner": "", "lease_expires_at": None}})
                skipped += 1
                continue

            # A safety escalation is not a message, it is an ACTION: try the
            # next contact. Handled before the notification path so a failure
            # to render never stops someone being told.
            rule = await _db()[ReminderModel.collection_name].find_one(
                {"_id": rem._oid(occ["definition_id"])}) or {}
            if (rule.get("payload") or {}).get("kind") == "escalation":
                from app.engines import safety as safety_engine
                await safety_engine.handle_escalation_due(rule)

            intent_id = await notify.raise_intent_for_occurrence(occ)
            await _db()[OccurrenceModel.collection_name].update_one(
                {"_id": occ["_id"]},
                {"$set": {"intent_id": intent_id or "",
                          # It stays DUE with the lease dropped. Not completed:
                          # the reminder's job ends when the intent is raised,
                          # but whether she ACTS on it is a separate fact that
                          # only an action receipt can record — opening a
                          # message is not completing a task. And DUE is not in
                          # `claim_due`'s filter, so dropping the lease cannot
                          # cause it to be picked up and sent a second time.
                          "state": OccurrenceModel.STATE_DUE,
                          "lease_owner": "", "lease_expires_at": None,
                          "updated_at": datetime.now(timezone.utc)}})
            raised += 1
        except Exception as exc:  # noqa: BLE001 - one bad row must not stop the tick
            failed += 1
            await _db()[OccurrenceModel.collection_name].update_one(
                {"_id": occ["_id"]},
                {"$set": {"state": OccurrenceModel.STATE_SCHEDULED,
                          "lease_owner": "", "lease_expires_at": None,
                          "last_error": str(exc)[:300]}})
    return {"claimed": len(claimed), "raised": raised,
            "skipped_stale": skipped, "failed": failed}


async def run_sweep() -> dict | None:
    """
    The domain sweeps — on their OWN schedule, not inside the minute tick.

    Measured: a full sweep over this database takes **47 seconds**. Cloud
    Scheduler's attempt deadline is 60, so riding inside `run_tick` meant one
    tick an hour came within thirteen seconds of being killed mid-flight —
    and a tick killed part-way is a tick whose remaining steps never ran.

    So it is a second endpoint on a second schedule, and the minute tick stays
    in milliseconds. The hour claim stays because ten instances still share
    the job: whoever inserts the hour's row does the work.
    """
    from app.engines import wiring

    hour = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H")
    try:
        await _db()["engine_sweeps"].insert_one(
            {"_id": hour, "started_at": datetime.now(timezone.utc),
             "worker": WORKER_ID})
    except Exception:  # noqa: BLE001 - duplicate key: someone else has it
        return None

    out = await wiring.run_sync()
    await _db()["engine_sweeps"].update_one(
        {"_id": hour}, {"$set": {"finished_at": datetime.now(timezone.utc),
                                 "result": out}})
    return out


async def run_tick() -> dict:
    """
    One pass. Safe to call concurrently, safe to call twice, safe to miss.

    Returns counts rather than nothing, so Cloud Scheduler's log and the ops
    console both show what a minute actually did.
    """
    if not settings.ENGINES_ENABLED:
        return {"enabled": False}

    from app.engines import notify

    from app.engines import domain

    started = datetime.now(timezone.utc)
    # Before anything else: a booking that moved five seconds ago should move
    # its reminder before that reminder is considered for dispatch.
    outbox = await domain.drain_outbox()
    released = await rem.release_dead_leases()
    expired = await rem.expire_stale()
    due = await process_due()
    resumed = await notify.resume_orphans()
    unheld = await notify.release_held()
    retried = await notify.retry_failed()
    topped = await rem.top_up_horizons()

    return {
        "enabled": True,
        "worker": WORKER_ID,
        "outbox": outbox,
        "leases_released": released,
        "expired": expired,
        **due,
        "resumed_orphans": resumed,
        "unheld": unheld,
        "retried": retried,
        "horizon_added": topped,
        "ms": int((datetime.now(timezone.utc) - started).total_seconds() * 1000),
    }
