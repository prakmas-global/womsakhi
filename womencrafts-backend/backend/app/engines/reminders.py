"""
The Reminder Engine: creating rules, keeping occurrences ahead of the clock,
and reconciling both when the thing they are about changes.

**Materialise ahead, not all at once.** A daily reminder with no end date has
no last occurrence, so "create them all" is not a thing that can be done. Rows
are created to a horizon — far enough ahead that an outage cannot leave the
engine with nothing to fire, short enough that editing a rule invalidates a
handful of rows rather than a decade of them.

**Reconciliation is the hard requirement.** The catalogue asks for it plainly:
*"Cancel or recalculate when the source task changes... Do not continue
reminders for an already satisfied condition."* A booking moves and the
reminder must move with it; an order is fulfilled and its chase must stop. This
is the behaviour that separates a scheduler from a nuisance, and `reconcile()`
is where it lives.

**Version, not delete.** Editing bumps `version` on the rule. Occurrences carry
the version they were built from, so stale ones are *recognisable* — the tick
discards them when it claims them. Deleting rows a worker may already hold is
how you get a message sent after it was cancelled.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.core.config import settings
from app.db.mongodb import get_database
from app.engines import schedule as sched
from app.models.notify import AuditModel
from app.models.reminders import OccurrenceModel, ReminderModel

# How far ahead occurrences exist. Two days covers a weekend outage without
# making an edit expensive.
HORIZON_HOURS = 48


def _db():
    return get_database()


def _oid(value: str):
    try:
        return ObjectId(value)
    except Exception:  # noqa: BLE001
        return None



def _floor(rule: dict, latest: dict | None, now: datetime) -> datetime:
    """
    The instant `materialise` must look strictly after.

    This was `starts_at`, which defaults to the moment the rule was created,
    and that silently swallowed a whole class of reminder: a one-off booked for
    14:00 and created at 14:00:05 — a clock skew, a slow request, a retried
    call — produced no occurrence at all and no error. The caller got silence.

    So the floor comes from the schedule itself rather than from creation time.
    For a one-off and an event-relative rule the instant IS the schedule, and
    `starts_at` has no business gating it. Only a recurring rule has a genuine
    start date, because only a recurring rule has instants before it.

    A first fill still cannot reach far into the past: `expire_stale` sweeps
    anything older than the catch-up window, so a rule backdated a week
    materialises and is then expired rather than delivering a week of
    yesterdays (REM-UC-008).
    """
    if latest:
        return latest["due_at"]

    sc = rule.get("schedule") or {}
    kind = sc.get("type")
    one_second = timedelta(seconds=1)

    if kind == ReminderModel.SCHEDULE_ONCE and isinstance(sc.get("at"), datetime):
        return sc["at"] - one_second
    if kind == ReminderModel.SCHEDULE_EVENT and isinstance(sc.get("anchor_at"), datetime):
        anchor = sc["anchor_at"]
        if anchor.tzinfo is None:
            anchor = anchor.replace(tzinfo=timezone.utc)
        return anchor + timedelta(minutes=int(sc.get("offset_minutes") or 0)) - one_second

    # Recurring: her start date, or now for a rule with no explicit start.
    return rule.get("starts_at") or now


# ── creating and editing ────────────────────────────────────────────────────

async def create(**kwargs) -> dict:
    """Write the rule, then fill the horizon with its occurrences."""
    doc = ReminderModel.create_document(**kwargs)
    res = await _db()[ReminderModel.collection_name].insert_one(doc)
    doc["_id"] = res.inserted_id
    await fill(str(res.inserted_id))
    return doc


async def ensure(*, user_id: str, module: str, ref: str, title_key: str,
                 **kwargs) -> dict | None:
    """
    Create this reminder, or update the one that already exists.

    The sweeps below run every hour over every goal, event and savings round
    in the product. Without an upsert they would create a duplicate reminder
    on every pass — twenty-four a day, per goal. Identity is
    (member, module, ref, title_key), which is exactly "this reminder, about
    this thing, for this purpose".

    Returns None when nothing changed, so a sweep can report real work rather
    than the number of rows it looked at.
    """
    existing = await _db()[ReminderModel.collection_name].find_one(
        {"user_id": user_id, "domain.module": module, "domain.ref": ref,
         "title_key": title_key,
         "state": {"$ne": ReminderModel.STATE_CANCELLED}})

    if existing is None:
        return await create(user_id=user_id, domain_module=module,
                            domain_ref=ref, title_key=title_key, **kwargs)

    # It exists. Only re-time it if the source actually moved — an edit bumps
    # the version and cancels her pending occurrences, so doing it needlessly
    # every hour would mean she never accumulates one.
    want = kwargs.get("at") or kwargs.get("anchor_at")
    if want is None:
        return None
    have = (existing.get("schedule") or {}).get("at") or \
           (existing.get("schedule") or {}).get("anchor_at")
    if have is not None and have.tzinfo is None:
        have = have.replace(tzinfo=timezone.utc)
    if have is not None and abs((want - have).total_seconds()) < 60:
        return None

    sc = dict(existing.get("schedule") or {})
    if sc.get("type") == ReminderModel.SCHEDULE_EVENT:
        sc["anchor_at"] = want
    else:
        sc["at"] = want
    await edit(str(existing["_id"]), {"schedule": sc})
    return existing


async def fill(definition_id: str, *, horizon_hours: int = HORIZON_HOURS) -> int:
    """
    Create any missing occurrences between now and the horizon.

    Idempotent by construction: the unique `idem` index rejects a duplicate, so
    running this twice — or from two instances at once — produces one row.
    That is why the insert is per-document with the duplicate swallowed rather
    than an `insert_many`, which would abort the whole batch on the first
    collision.
    """
    oid = _oid(definition_id)
    if not oid:
        return 0
    rule = await _db()[ReminderModel.collection_name].find_one({"_id": oid})
    if not rule or rule.get("state") != ReminderModel.STATE_SCHEDULED:
        return 0

    now = datetime.now(timezone.utc)
    horizon = now + timedelta(hours=horizon_hours)

    # Start after the latest occurrence already created, so a second run does
    # not reconsider instants that exist.
    latest = await _db()[OccurrenceModel.collection_name].find_one(
        {"definition_id": definition_id, "schedule_version": rule.get("version", 1)},
        sort=[("due_at", -1)],
    )
    after = _floor(rule, latest, now)
    if after.tzinfo is None:
        after = after.replace(tzinfo=timezone.utc)

    instants = sched.materialise(
        schedule=rule.get("schedule") or {},
        tz_name=rule.get("tz") or "UTC",
        after=after,
        horizon=horizon,
        ends_at=rule.get("ends_at"),
    )

    made = 0
    for when in instants:
        occ = OccurrenceModel.create_document(
            definition_id=definition_id,
            user_id=rule["user_id"],
            due_at=when,
            version=rule.get("version", 1),
            intended_local=(rule.get("schedule") or {}).get("local_time", ""),
            tz=rule.get("tz") or "UTC",
            klass=rule.get("klass", ReminderModel.CLASS_USER),
            category=rule.get("category", "reminders"),
        )
        try:
            await _db()[OccurrenceModel.collection_name].insert_one(occ)
            made += 1
        except DuplicateKeyError:
            # Another instance created it first. Correct outcome, not an error.
            continue
    return made


async def edit(definition_id: str, changes: dict) -> bool:
    """
    Change a rule and invalidate what it already scheduled.

    Only a change to WHEN it fires bumps the version. Renaming a reminder must
    not throw away the occurrences, because that would silently reset a series
    she has been keeping.
    """
    oid = _oid(definition_id)
    if not oid:
        return False
    timing = {"schedule", "tz", "drift", "starts_at", "ends_at"}
    retimed = bool(timing & set(changes))

    update = {"$set": {**changes, "updated_at": datetime.now(timezone.utc)}}
    if retimed:
        update["$inc"] = {"version": 1}

    rule = await _db()[ReminderModel.collection_name].find_one_and_update(
        {"_id": oid}, update, return_document=ReturnDocument.AFTER)
    if not rule:
        return False

    if retimed:
        # Cancel what has not been claimed. A row a worker already holds is
        # left alone and discarded by the tick when it sees the old version —
        # pulling it out from under a live dispatch is how a message escapes
        # after cancellation.
        await _db()[OccurrenceModel.collection_name].update_many(
            {"definition_id": definition_id,
             "schedule_version": {"$lt": rule.get("version", 1)},
             "state": OccurrenceModel.STATE_SCHEDULED},
            {"$set": {"state": OccurrenceModel.STATE_CANCELLED,
                      "updated_at": datetime.now(timezone.utc)}},
        )
        await fill(definition_id)
    return True


async def cancel(definition_id: str, *, reason: str = "cancelled") -> bool:
    """Stop a rule and everything it has queued."""
    oid = _oid(definition_id)
    if not oid:
        return False
    now = datetime.now(timezone.utc)
    await _db()[ReminderModel.collection_name].update_one(
        {"_id": oid}, {"$set": {"state": ReminderModel.STATE_CANCELLED,
                                "updated_at": now}})
    await _db()[OccurrenceModel.collection_name].update_many(
        {"definition_id": definition_id,
         "state": {"$in": [OccurrenceModel.STATE_SCHEDULED,
                           OccurrenceModel.STATE_SNOOZED]}},
        {"$set": {"state": OccurrenceModel.STATE_CANCELLED,
                  "last_error": reason, "updated_at": now}},
    )
    return True


# ── reconciliation: the source of truth moved ───────────────────────────────

async def reconcile(*, module: str, ref: str, event: str,
                    new_anchor: datetime | None = None) -> dict:
    """
    The thing this reminder is about has changed. Catch up.

    Called from the outbox worker, so it is driven by a durable event rather
    than by whichever request happened to notice — which is what makes it
    survive the process dying between the two writes.
    """
    now = datetime.now(timezone.utc)
    rules = await _db()[ReminderModel.collection_name].find(
        {"domain.module": module, "domain.ref": ref,
         "state": ReminderModel.STATE_SCHEDULED},
    ).to_list(length=200)

    moved = stopped = 0
    for rule in rules:
        rid = str(rule["_id"])
        if event in ("cancelled", "completed", "fulfilled", "expired", "withdrawn"):
            # An already-satisfied condition must not keep reminding her.
            await cancel(rid, reason=f"{module}.{event}")
            stopped += 1
            continue
        if event == "moved" and new_anchor is not None:
            sc = dict(rule.get("schedule") or {})
            sc["anchor_at"] = new_anchor
            if sc.get("type") == ReminderModel.SCHEDULE_ONCE:
                sc["at"] = new_anchor
            await edit(rid, {"schedule": sc})
            moved += 1

    if moved or stopped:
        await _db()[AuditModel.collection_name].insert_one(
            AuditModel.create_document(
                actor="system", action="reminder.reconcile",
                target=f"{module}:{ref}",
                meta={"event": event, "moved": moved, "stopped": stopped, "at": now}))
    return {"moved": moved, "stopped": stopped}


# ── the member's own answers ────────────────────────────────────────────────

async def complete(occurrence_id: str, *, user_id: str, via: str = "inapp") -> bool:
    """
    Done. Recorded once, and it does not end the series.

    The guard on `user_id` is not decoration: an occurrence id in a push
    payload is guessable enough that completing someone else's reminder must be
    impossible server-side, not merely unlikely.
    """
    oid = _oid(occurrence_id)
    if not oid:
        return False
    now = datetime.now(timezone.utc)
    res = await _db()[OccurrenceModel.collection_name].update_one(
        {"_id": oid, "user_id": user_id,
         "state": {"$nin": [OccurrenceModel.STATE_COMPLETED,
                            OccurrenceModel.STATE_CANCELLED]}},
        {"$set": {"state": OccurrenceModel.STATE_COMPLETED,
                  "completed_at": now, "completed_via": via, "updated_at": now}},
    )
    return res.modified_count > 0


async def snooze(occurrence_id: str, *, user_id: str, minutes: int = 60) -> bool:
    """Later. Moves this occurrence only, never the series."""
    oid = _oid(occurrence_id)
    if not oid:
        return False
    now = datetime.now(timezone.utc)
    res = await _db()[OccurrenceModel.collection_name].update_one(
        {"_id": oid, "user_id": user_id,
         "state": {"$in": [OccurrenceModel.STATE_SCHEDULED,
                           OccurrenceModel.STATE_DUE,
                           OccurrenceModel.STATE_SNOOZED]}},
        {"$set": {"state": OccurrenceModel.STATE_SNOOZED,
                  "due_at": now + timedelta(minutes=max(5, minutes)),
                  # Releasing the lease lets the tick pick it up again at the
                  # new time instead of waiting for the old lease to lapse.
                  "lease_owner": "", "lease_expires_at": None,
                  "updated_at": now},
         # Snooze reuses the same row, so without this the message built an
         # IDENTICAL dedupe key an hour later, hit the unique index, and was
         # silently dropped — "Later" did nothing at all and the tick counted
         # it as delivered. The generation is what makes the second message a
         # different message.
         "$inc": {"snooze_count": 1}},
    )
    return res.modified_count > 0


async def stop_series(definition_id: str, *, user_id: str) -> bool:
    """Stop. The whole series, at her request."""
    rule = await _db()[ReminderModel.collection_name].find_one(
        {"_id": _oid(definition_id), "user_id": user_id})
    if not rule:
        return False
    return await cancel(definition_id, reason="member_stopped")


async def retune_for_zone(user_id: str, *, old_tz: str, new_tz: str) -> int:
    """
    She changed timezone. Move what needs moving, and nothing else.

    `rebuild_for_zone` implemented the `keep_local` / `keep_instant`
    distinction the whole `drift` field exists for — and nothing called it, so
    a woman who flew Hyderabad → Dubai and updated her timezone kept getting
    her 07:00 habit at 05:30 for two days until the horizon happened to be
    topped up again. This is the caller.

    Safety deadlines are `keep_instant` and are deliberately untouched: a
    check-in deadline is elapsed time and must not move because she crossed a
    border (REM-UC-002, REM-UC-009).
    """
    if not new_tz or old_tz == new_tz:
        return 0

    rules = await _db()[ReminderModel.collection_name].find(
        {"user_id": user_id, "state": ReminderModel.STATE_SCHEDULED,
         "drift": {"$ne": ReminderModel.DRIFT_ABSOLUTE}},
    ).to_list(length=500)

    moved = 0
    for rule in rules:
        rid = str(rule["_id"])
        pending = await _db()[OccurrenceModel.collection_name].find(
            {"definition_id": rid, "state": OccurrenceModel.STATE_SCHEDULED},
        ).sort("due_at", 1).to_list(length=200)
        if not pending:
            continue

        instants = sched.rebuild_for_zone(
            schedule=rule.get("schedule") or {},
            old_tz=old_tz or rule.get("tz") or "UTC",
            new_tz=new_tz,
            drift=rule.get("drift") or ReminderModel.DRIFT_LOCAL,
            pending=[sched.aware(p["due_at"]) for p in pending])

        # The rule's own zone has to change too, or the next top-up rebuilds
        # the old times straight back.
        await _db()[ReminderModel.collection_name].update_one(
            {"_id": rule["_id"]},
            {"$set": {"tz": new_tz, "updated_at": datetime.now(timezone.utc)},
             "$inc": {"version": 1}})
        version = int(rule.get("version", 1)) + 1

        for old_row, when in zip(pending, instants):
            if when == sched.aware(old_row["due_at"]):
                continue
            # A new idem, because the instant is what the key is built from.
            await _db()[OccurrenceModel.collection_name].update_one(
                {"_id": old_row["_id"]},
                {"$set": {"due_at": when, "tz": new_tz,
                          "schedule_version": version,
                          "idem": OccurrenceModel.idempotency_key(rid, when, version),
                          "updated_at": datetime.now(timezone.utc)}})
            moved += 1
    return moved


# ── housekeeping ────────────────────────────────────────────────────────────

async def expire_stale() -> int:
    """
    Let old optional work die rather than arrive late in a heap.

    The catalogue's instruction after an outage is explicit: *"expire old
    encouragement instead of sending a burst."* Anything older than the
    catch-up window is expired — except safety, which has its own reviewed
    recovery policy and is never silently dropped here (REM-UC-008/009).
    """
    cutoff = datetime.now(timezone.utc) - timedelta(
        minutes=settings.ENGINES_CATCHUP_MINUTES)
    res = await _db()[OccurrenceModel.collection_name].update_many(
        {"state": {"$in": [OccurrenceModel.STATE_SCHEDULED,
                           OccurrenceModel.STATE_SNOOZED]},
         "due_at": {"$lt": cutoff},
         "klass": {"$ne": ReminderModel.CLASS_SAFETY}},
        {"$set": {"state": OccurrenceModel.STATE_EXPIRED,
                  "updated_at": datetime.now(timezone.utc)}},
    )
    return res.modified_count


async def release_dead_leases() -> int:
    """
    Work whose worker died returns to the pool.

    No lock to release and nothing to clean up after a crash: the lease simply
    stops being valid, and the next tick claims the row.
    """
    res = await _db()[OccurrenceModel.collection_name].update_many(
        {"state": OccurrenceModel.STATE_DUE,
         "lease_expires_at": {"$lt": datetime.now(timezone.utc)}},
        {"$set": {"state": OccurrenceModel.STATE_SCHEDULED,
                  "lease_owner": "", "lease_expires_at": None}},
    )
    return res.modified_count


async def top_up_horizons(limit: int = 60) -> int:
    """
    Keep recurring rules supplied with occurrences.

    Two things this gets wrong if written the obvious way, and both are
    silent. Without a sort the same 500 rules come back every tick, so rule
    501 onward is NEVER topped up — its occurrences simply run out 48 hours
    after it was last edited and the reminder stops, with nothing to show for
    it. And without a per-rule guard, one member's malformed schedule raises
    inside the loop and stops every other member's series being topped up too.

    So: least-recently-filled first, which rotates fairly through any number
    of rules, and each rule fails alone.

    The batch is small on purpose. Filling every rule took 12 seconds at 365
    reminders and grows linearly — on a minute tick that is a tick spending
    most of its life on work that is 48 hours ahead of when it is needed.
    Sixty per tick still cycles thousands of rules within minutes, and the
    `filled_at` sort guarantees nothing is starved.
    """
    # Only rules that are actually running out. Asking every recurring rule
    # every minute cost 7 seconds a tick with nothing to do — 120 round trips
    # to confirm there was no work. This is one indexed query that returns
    # only the rules with fewer than 24 hours of occurrences left.
    soon = datetime.now(timezone.utc) + timedelta(hours=24)
    rules = await _db()[ReminderModel.collection_name].find(
        {"state": ReminderModel.STATE_SCHEDULED,
         "schedule.type": ReminderModel.SCHEDULE_RECURRING,
         "$or": [{"horizon_until": None},
                 {"horizon_until": {"$exists": False}},
                 {"horizon_until": {"$lt": soon}}]},
    ).sort("filled_at", 1).to_list(length=limit)

    made = 0
    for r in rules:
        try:
            made += await fill(str(r["_id"]))
            latest = await _db()[OccurrenceModel.collection_name].find_one(
                {"definition_id": str(r["_id"])}, sort=[("due_at", -1)])
            await _db()[ReminderModel.collection_name].update_one(
                {"_id": r["_id"]},
                {"$set": {"filled_at": datetime.now(timezone.utc),
                          # How far ahead this rule is supplied. The tick
                          # filters on it, so a rule with two days of
                          # occupancy is not re-examined sixty times an hour.
                          "horizon_until": (latest or {}).get("due_at")}})
        except Exception as exc:  # noqa: BLE001 - one bad rule is not all of them
            await _db()[ReminderModel.collection_name].update_one(
                {"_id": r["_id"]},
                {"$set": {"fill_error": str(exc)[:300],
                          "filled_at": datetime.now(timezone.utc)}})
    return made
