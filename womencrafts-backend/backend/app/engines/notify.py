"""
The Notification Engine: raise an intent, ask policy, deliver, record honestly.

**The four steps, and why each is separate.**

1. `raise_intent` — writes the wish, deduplicated. Before any policy runs, so
   a message that is suppressed still leaves a record and a reason.
2. `policy.evaluate` — allow, hold or suppress. The decision is stored.
3. `dispatch` — one delivery attempt per permitted channel, each retried
   independently, because a failed SMS should not resend a push that worked.
4. receipts — she pressed Done. The only state in this file that proves a
   human was involved.

**Why held messages are a first-class state rather than a sleep.** A message
raised at 22:40 is held until 07:00. Nothing waits in memory for nine hours —
Cloud Run would have destroyed that instance long before. It is a row with a
`release_after`, and the next tick after 07:00 picks it up. That is the only
design that survives an app which scales to zero.

**Why the inbox is written through an adapter.** The app already has a
`notifications` collection with routes the phone reads today. Writing a second,
parallel inbox would mean two unread counts and two places to mark something
read. So the engine writes into the existing one, which is why nothing visible
changes when the flag goes on: the inbox simply starts having more in it.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from app.db.mongodb import get_database
from app.engines import policy
from app.models.conversation import MemberNotificationModel
from app.models.notify import (AuditModel, DeliveryModel, IntentModel,
                               PolicyDecisionModel)
from app.models.reminders import OccurrenceModel, ReminderModel


def _db():
    return get_database()


def _oid(value: str):
    try:
        return ObjectId(value)
    except Exception:  # noqa: BLE001
        return None


# ── 1. raising ──────────────────────────────────────────────────────────────

async def raise_intent(
    *,
    user_id: str,
    template_key: str,
    category: str,
    klass: str,
    ref: str,
    bucket: str,
    payload: dict | None = None,
    occurrence_id: str = "",
    domain_module: str = "",
) -> str | None:
    """
    Record that something wants to reach her, then run it through policy.

    Returns the intent id, or None when this exact message already exists. The
    duplicate is caught by a unique index rather than by a read-then-write,
    because ten instances checking "does this exist?" at the same moment all
    get the same answer and all then insert.
    """
    doc = IntentModel.create_document(
        user_id=user_id, template_key=template_key, category=category,
        klass=klass, dedupe=IntentModel.dedupe_key(user_id, template_key, ref, bucket),
        payload=payload, occurrence_id=occurrence_id,
        domain_module=domain_module, domain_ref=ref)
    try:
        res = await _db()[IntentModel.collection_name].insert_one(doc)
    except DuplicateKeyError:
        # The row already exists. That is NOT automatically "already sent":
        # the worker that wrote it may have been killed before it dispatched,
        # and returning None here left the message stranded forever — for a
        # travel check-in deadline, permanently undelivered while the tick
        # reported success. So an intent still in `created` is taken over and
        # decided; one that has already been decided is left alone.
        existing = await _db()[IntentModel.collection_name].find_one(
            {"dedupe_key": doc["dedupe_key"]})
        if existing and existing.get("state") == IntentModel.STATE_CREATED:
            await _decide_and_act(str(existing["_id"]), existing)
            return str(existing["_id"])
        return None

    intent_id = str(res.inserted_id)
    doc["_id"] = res.inserted_id
    await _decide_and_act(intent_id, doc)
    return intent_id


async def raise_intent_for_occurrence(occ: dict) -> str | None:
    """A due reminder becomes a message. Called by the tick."""
    rule = await _db()[ReminderModel.collection_name].find_one(
        {"_id": _oid(occ["definition_id"])})
    if not rule:
        return None
    return await raise_intent(
        user_id=occ["user_id"],
        template_key=rule.get("title_key", "reminder.generic"),
        category=occ.get("category", "reminders"),
        klass=occ.get("klass", ReminderModel.CLASS_USER),
        ref=str(rule.get("domain", {}).get("ref") or occ["definition_id"]),
        # The occurrence id is the bucket, so a daily reminder produces one
        # message per day rather than one ever — plus the snooze generation,
        # because a snoozed occurrence is the SAME row coming round again and
        # would otherwise dedupe against its own earlier message.
        bucket=f"{occ['_id']}:{occ.get('snooze_count', 0)}",
        payload={**(rule.get("payload") or {}),
                 "series": rule.get("title_key", ""),
                 "definition_id": occ["definition_id"]},
        occurrence_id=str(occ["_id"]),
        domain_module=rule.get("domain", {}).get("module", ""))


# ── 2. deciding ─────────────────────────────────────────────────────────────

async def _decide_and_act(intent_id: str, intent: dict) -> None:
    verdict = await policy.evaluate(intent)
    await policy.record(intent_id, intent["user_id"], verdict)
    now = datetime.now(timezone.utc)

    if verdict["decision"] == PolicyDecisionModel.SUPPRESS:
        await _db()[IntentModel.collection_name].update_one(
            {"_id": _oid(intent_id)},
            {"$set": {"state": IntentModel.STATE_SUPPRESSED,
                      "held_reason": verdict["reason"], "updated_at": now}})
        return

    if verdict["decision"] == PolicyDecisionModel.HOLD:
        await _db()[IntentModel.collection_name].update_one(
            {"_id": _oid(intent_id)},
            {"$set": {"state": IntentModel.STATE_HELD,
                      "held_reason": verdict["reason"],
                      "release_after": verdict.get("release_after"),
                      "updated_at": now}})
        return

    await dispatch(intent_id, intent, verdict.get("channels") or ["inapp"])


# ── 3. delivering ───────────────────────────────────────────────────────────

async def dispatch(intent_id: str, intent: dict, channels: list[str]) -> int:
    """
    One attempt row per channel, then hand each to its adapter.

    The rows exist before anything is sent. A provider call that times out
    still leaves a record of having been tried, which is what makes the retry
    bounded rather than a thing that happens twice because the first attempt
    left no trace.
    """
    from app.engines.channels import send   # late: adapters import settings

    sent = 0
    for channel in channels:
        attempt = DeliveryModel.create_document(
            intent_id=intent_id, user_id=intent["user_id"], channel=channel)
        res = await _db()[DeliveryModel.collection_name].insert_one(attempt)
        attempt_id = res.inserted_id
        try:
            outcome = await send(channel, intent)
            await _db()[DeliveryModel.collection_name].update_one(
                {"_id": attempt_id},
                {"$set": {"state": outcome.get("state", DeliveryModel.ACCEPTED),
                          "provider": outcome.get("provider", ""),
                          "provider_message_id": outcome.get("id", ""),
                          "cost_micros": int(outcome.get("cost_micros", 0)),
                          "updated_at": datetime.now(timezone.utc)},
                 "$inc": {"attempts": 1}})
            sent += 1
        except Exception as exc:  # noqa: BLE001 - one dead channel is not all of them
            await _db()[DeliveryModel.collection_name].update_one(
                {"_id": attempt_id},
                {"$set": {"state": DeliveryModel.FAILED,
                          "error": str(exc)[:300],
                          "next_retry_at": DeliveryModel.next_retry(1),
                          "updated_at": datetime.now(timezone.utc)},
                 "$inc": {"attempts": 1}})

    await _db()[IntentModel.collection_name].update_one(
        {"_id": _oid(intent_id)},
        {"$set": {"state": IntentModel.STATE_DISPATCHED if sent
                  else IntentModel.STATE_FAILED,
                  "updated_at": datetime.now(timezone.utc)}})
    return sent


async def resume_orphans(older_than_seconds: int = 180) -> int:
    """
    Decide intents that were written and then abandoned.

    The window: `raise_intent` inserts the row, and only then dispatches.
    Cloud Run can kill the instance in between. The occurrence is left at DUE
    with no lease, which `release_dead_leases` deliberately cannot see, so
    nothing ever retries it — and the `state_created` index existed for a
    sweeper that was never written.

    This is that sweeper. Age-gated so it cannot race a worker that is simply
    mid-dispatch, and safety first, because this is the one path by which a
    check-in deadline could be lost entirely.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=max(60, older_than_seconds))
    rows = await _db()[IntentModel.collection_name].find(
        {"state": IntentModel.STATE_CREATED, "created_at": {"$lt": cutoff}},
    ).sort("created_at", 1).to_list(length=200)
    rows.sort(key=lambda r: 0 if r.get("klass") == ReminderModel.CLASS_SAFETY else 1)

    done = 0
    for intent in rows:
        # Claim it, so ten instances do not all decide the same orphan.
        taken = await _db()[IntentModel.collection_name].find_one_and_update(
            {"_id": intent["_id"], "state": IntentModel.STATE_CREATED},
            {"$set": {"state": IntentModel.STATE_QUEUED,
                      "updated_at": datetime.now(timezone.utc)}})
        if not taken:
            continue
        await _decide_and_act(str(intent["_id"]), intent)
        done += 1
    return done


async def release_held() -> int:
    """
    Quiet hours are over. Send what waited — and drop what went stale waiting.

    Both halves matter. A reminder held overnight is still wanted at 07:00; an
    optional nudge whose moment passed six hours ago is not, and sending it
    anyway is how a considerate design turns into a morning pile-up.
    """
    now = datetime.now(timezone.utc)
    released = 0

    stale = await _db()[IntentModel.collection_name].update_many(
        {"state": IntentModel.STATE_HELD, "expires_at": {"$lt": now}},
        {"$set": {"state": IntentModel.STATE_EXPIRED, "updated_at": now}})

    # CLAIMED one at a time, not listed and looped. Ten instances tick in the
    # same second; a plain find handed all ten the identical 500 rows and each
    # dispatched them, so the 07:00 drain produced up to ten inbox rows and ten
    # buzzes for one reminder — and ten ALLOW decisions, which then read as ten
    # against an attention budget of two and suppressed the rest of her day.
    while released < 500:
        intent = await _db()[IntentModel.collection_name].find_one_and_update(
            {"state": IntentModel.STATE_HELD, "release_after": {"$lte": now}},
            {"$set": {"state": IntentModel.STATE_QUEUED, "updated_at": now}},
            sort=[("release_after", 1)])
        if not intent:
            break
        # Re-evaluated, not just released: her preferences may have changed
        # during the hours it waited, and Off must take effect on unsent work.
        await _decide_and_act(str(intent["_id"]), intent)
        released += 1

    if stale.modified_count:
        # An expired optional prompt is evidence the series is not landing.
        # Bounded by expires_at, which IS indexed — the old filter on
        # `updated_at` had no index and fetched every intent ever expired.
        for intent in await _db()[IntentModel.collection_name].find(
                {"state": IntentModel.STATE_EXPIRED,
                 "expires_at": {"$gte": now - timedelta(hours=24), "$lt": now}},
        ).to_list(length=200):
            if intent.get("klass") == ReminderModel.CLASS_DISCRETIONARY:
                await policy.note_unanswered(
                    intent["user_id"],
                    (intent.get("payload") or {}).get("series", ""))
    return released


async def retry_failed() -> int:
    """Bounded retries with backoff. Five attempts, then the dead-letter."""
    from app.engines.channels import send

    now = datetime.now(timezone.utc)
    # Claimed, for the same reason as release_held: ten instances retrying the
    # same SMS at once burned all five attempts in one tick, so a message that
    # would have succeeded on the second try was dead-lettered instead.
    rows = []
    while len(rows) < 200:
        row = await _db()[DeliveryModel.collection_name].find_one_and_update(
            {"state": DeliveryModel.FAILED,
             "next_retry_at": {"$lte": now},
             "attempts": {"$lt": DeliveryModel.MAX_ATTEMPTS}},
            {"$set": {"state": DeliveryModel.QUEUED, "updated_at": now}},
            sort=[("next_retry_at", 1)])
        if not row:
            break
        rows.append(row)

    done = 0
    for row in rows:
        intent = await _db()[IntentModel.collection_name].find_one(
            {"_id": _oid(row["intent_id"])})
        if not intent:
            continue
        # The state is rechecked here, not just at raise time: an order
        # cancelled during the backoff must not still be chased.
        if intent.get("state") in (IntentModel.STATE_SUPPRESSED,
                                   IntentModel.STATE_EXPIRED):
            await _db()[DeliveryModel.collection_name].update_one(
                {"_id": row["_id"]},
                {"$set": {"state": DeliveryModel.SUPPRESSED, "updated_at": now}})
            continue
        try:
            outcome = await send(row["channel"], intent)
            await _db()[DeliveryModel.collection_name].update_one(
                {"_id": row["_id"]},
                {"$set": {"state": outcome.get("state", DeliveryModel.ACCEPTED),
                          "provider_message_id": outcome.get("id", ""),
                          "error": "", "updated_at": now},
                 "$inc": {"attempts": 1}})
            done += 1
        except Exception as exc:  # noqa: BLE001
            attempts = int(row.get("attempts", 0)) + 1
            state = (DeliveryModel.FAILED if attempts < DeliveryModel.MAX_ATTEMPTS
                     else DeliveryModel.EXPIRED)
            await _db()[DeliveryModel.collection_name].update_one(
                {"_id": row["_id"]},
                {"$set": {"state": state, "error": str(exc)[:300],
                          "next_retry_at": DeliveryModel.next_retry(attempts),
                          "updated_at": now},
                 "$inc": {"attempts": 1}})
            if state == DeliveryModel.EXPIRED:
                await _db()[AuditModel.collection_name].insert_one(
                    AuditModel.create_document(
                        actor="system", action="delivery.dead_letter",
                        target=str(row["_id"]), user_id=row.get("user_id", ""),
                        meta={"channel": row.get("channel"), "error": str(exc)[:200]}))
    return done


# ── the inbox, written into the one that already exists ─────────────────────

async def write_inbox(intent: dict, *, title: str, desc: str) -> None:
    """
    Add a row to the inbox **the member's phone actually reads**.

    There are two notification collections in this database and they serve
    different people. `notifications` is the operator dashboard's; the app a
    woman opens reads `member_notifications` through `/me/notifications`. This
    wrote into the first one, which meant every reminder the engine has ever
    produced landed in a console she has no access to — the tick fired, the
    policy allowed it, the delivery recorded, and nothing appeared on her
    screen. The fix is one collection, and it is hers.

    `occurrence_id` rides along because it is what lets the row offer Done,
    Later, Skip and Stop. Without it the inbox can say something is due and do
    nothing about it, which is a reminder that has to be obeyed somewhere else.
    """
    doc = MemberNotificationModel.create_document(
        user_id=intent["user_id"],
        title=title,
        body=desc,
        ntype=_inbox_type(intent.get("category", "reminders")),
        # Tapping it goes to the list she can act on, not to a dead end.
        href="/app/reminders",
    )
    doc.update({
        "intent_id": str(intent.get("_id", "")),
        "occurrence_id": intent.get("occurrence_id", ""),
        "category": intent.get("category", "reminders"),
    })
    await _db()[MemberNotificationModel.collection_name].insert_one(doc)


def _inbox_type(category: str) -> str:
    """
    An engine category, as one of the types her screen already has an icon for.

    The old map returned the dashboard's vocabulary — "payment", "alert",
    "system" — none of which `MemberNotificationModel.ICONS` knows, so even a
    row in the right collection would have arrived as a generic bell.
    """
    return {
        "orders": MemberNotificationModel.TYPE_MONEY,
        "circles": MemberNotificationModel.TYPE_CIRCLE,
        "learning": MemberNotificationModel.TYPE_PROGRAM,
        "safety": MemberNotificationModel.TYPE_SAFETY,
        "health": MemberNotificationModel.TYPE_HEALTH,
        "bookings": MemberNotificationModel.TYPE_BOOKING,
        "reminders": MemberNotificationModel.TYPE_REMINDER,
    }.get(category, MemberNotificationModel.TYPE_REMINDER)


# ── receipts: the answer coming back ────────────────────────────────────────

async def record_action(*, occurrence_id: str, user_id: str, action: str,
                        via: str = "inapp", detail: dict | None = None) -> bool:
    """
    She acted. Write the receipt, then tell the domain that owns the task.

    Unique per occurrence, so a double tap or a retried request records once.
    """
    from app.engines import reminders as rem
    from app.models.notify import ReceiptModel

    try:
        await _db()[ReceiptModel.collection_name].insert_one(
            ReceiptModel.create_document(occurrence_id=occurrence_id,
                                         user_id=user_id, action=action,
                                         via=via, detail=detail))
    except DuplicateKeyError:
        return True     # already recorded; the second tap is not an error

    if action == ReceiptModel.DONE:
        return await rem.complete(occurrence_id, user_id=user_id, via=via)
    if action == ReceiptModel.LATER:
        return await rem.snooze(occurrence_id, user_id=user_id,
                                minutes=int((detail or {}).get("minutes", 60)))
    if action == ReceiptModel.SKIP:
        return await rem.complete(occurrence_id, user_id=user_id, via=via)
    if action == ReceiptModel.STOP:
        occ = await _db()[OccurrenceModel.collection_name].find_one(
            {"_id": _oid(occurrence_id), "user_id": user_id})
        if not occ:
            return False
        return await rem.stop_series(occ["definition_id"], user_id=user_id)
    return True
