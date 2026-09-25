"""
Where the rest of the app meets the engines.

**Two functions the domain calls, and nothing else.** `emit()` to say something
happened, `book_with_followup()` for the pattern that turns out to be most of
the product. Everything downstream — which reminders exist, which move, which
stop — is decided here rather than in twenty route handlers that each have to
remember.

**A10 is the shape that matters.** The team asked for: *"reminder for follow-up
task, if the appointment took place or not."* That is two schedules where the
second depends on an outcome nobody knows yet:

    booked ──▶ reminder, 30 min before ──▶ session happens (or does not)
                                       └─▶ follow-up, 2 h after: did it?
                                           └─▶ her answer returns to bookings

The follow-up cannot be written when the answer arrives, because nothing
arrives if the session is simply missed — the silence is the case we most need
to catch. So both are scheduled at booking time, and the follow-up is cancelled
by reconciliation if the booking is cancelled first. If the engine handles
this, it handles the other thirteen asks.
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone

from pymongo.errors import DuplicateKeyError

from app.core.txn import atomic
from app.db.mongodb import get_database
from app.engines import reminders as rem
from app.models.notify import OutboxModel
from app.models.reminders import ReminderModel


def _db():
    return get_database()


async def emit(*, event: str, module: str, ref: str, payload: dict | None = None,
               session=None) -> bool:
    """
    Record that something happened, in the caller's transaction.

    The `session` argument is the whole point. A route that moves a booking
    passes its own session, so the booking and this event commit together or
    not at all. Calling it without one still works — it is simply weaker, and
    the fallback in `core/txn` says so out loud.
    """
    # The key was a second-resolution wall clock, which got it wrong in both
    # directions: a handler retried a second later wrote a SECOND event, and
    # two genuinely different events in the same second silently collided.
    # Content-derived instead, with an explicit key when the caller has one.
    idem = (payload or {}).pop("idem", "") or _idem(module, ref, event, payload)
    doc = OutboxModel.create_document(event=event, module=module, ref=ref,
                                      idem=idem, payload=payload)
    try:
        await _db()[OutboxModel.collection_name].insert_one(doc, session=session)
        return True
    except DuplicateKeyError:
        # Genuinely already recorded. The only failure that is a success.
        return True
    # Anything else propagates. Swallowing it here aborted the caller's
    # transaction silently, which is precisely the lost-event window that
    # core/txn.py exists to close — the booking would commit with no event.


def _idem(module: str, ref: str, event: str, payload: dict | None) -> str:
    """
    A key derived from what happened, not from when we noticed.

    Includes the payload, so "moved to Thursday" and "moved to Friday" are two
    events, while the same move recorded twice is one.
    """
    body = repr(sorted((payload or {}).items()))
    digest = hashlib.sha1(f"{module}:{ref}:{event}:{body}".encode()).hexdigest()[:16]
    return f"{module}:{ref}:{event}:{digest}"


async def drain_outbox(limit: int = 200) -> dict:
    """
    Turn durable events into engine work.

    At-least-once: an event may be processed twice if a worker dies between
    acting and marking it done. Everything it calls is idempotent, so twice is
    harmless — which is the trade that makes the delivery guarantee achievable
    at all.
    """
    # Claimed one at a time. A plain find gave all ten instances the same
    # rows, and `_handle` is NOT idempotent — it calls `edit`, which does
    # `$inc: {version: 1}`, so ten concurrent drains took a rule from version
    # 1 to 11 and left a window with zero live occurrences.
    now = datetime.now(timezone.utc)
    rows = []
    while len(rows) < limit:
        row = await _db()[OutboxModel.collection_name].find_one_and_update(
            {"processed_at": None, "claimed_until": {"$not": {"$gt": now}}},
            {"$set": {"claimed_until": now + timedelta(seconds=120)}},
            sort=[("created_at", 1)])
        if not row:
            break
        rows.append(row)

    handled = failed = 0
    for row in rows:
        try:
            await _handle(row)
            await _db()[OutboxModel.collection_name].update_one(
                {"_id": row["_id"]},
                {"$set": {"processed_at": datetime.now(timezone.utc)}})
            handled += 1
        except Exception as exc:  # noqa: BLE001
            failed += 1
            await _db()[OutboxModel.collection_name].update_one(
                {"_id": row["_id"]},
                # Release the claim so the next tick retries it.
                {"$set": {"last_error": str(exc)[:300], "claimed_until": None},
                 "$inc": {"attempts": 1}})
    return {"handled": handled, "failed": failed}


async def _handle(row: dict) -> None:
    event = row.get("event", "")
    module = row.get("module", "")
    ref = row.get("ref", "")
    payload = row.get("payload") or {}

    # "booking.moved" → the reminder moves with it. "order.fulfilled" → its
    # chase stops. One mapping, so a new module gets this behaviour by emitting
    # an event rather than by writing scheduling code.
    _, _, action = event.partition(".")
    if action in ("cancelled", "completed", "fulfilled", "expired", "withdrawn"):
        await rem.reconcile(module=module, ref=ref, event=action)
        return
    if action == "moved":
        when = payload.get("new_at")
        if isinstance(when, datetime):
            await rem.reconcile(module=module, ref=ref, event="moved", new_anchor=when)
        return


# ── A10: book, remind, then ask whether it happened ─────────────────────────

async def book_with_followup(
    *,
    user_id: str,
    module: str,
    ref: str,
    starts_at: datetime,
    tz: str = "UTC",
    remind_before_minutes: int = 30,
    followup_after_minutes: int = 120,
    subject_key: str = "mentors.session",
) -> dict:
    """
    Both halves of A10, scheduled at booking time.

    The follow-up is scheduled *now*, not when the session ends, because the
    case worth catching is the one where nothing happens at all. A follow-up
    created by a "session finished" event would never exist for the woman whose
    mentor did not turn up — which is precisely who needs to be asked.
    """
    before = await rem.create(
        user_id=user_id,
        title_key=f"{subject_key}.before",
        schedule_type=ReminderModel.SCHEDULE_EVENT,
        tz=tz,
        category="learning",
        klass=ReminderModel.CLASS_TRANSACTIONAL,
        domain_module=module,
        domain_ref=ref,
        anchor_at=starts_at,
        offset_minutes=-abs(remind_before_minutes),
        payload={"ref": ref, "kind": "before"})

    after = await rem.create(
        user_id=user_id,
        title_key=f"{subject_key}.followup",
        schedule_type=ReminderModel.SCHEDULE_EVENT,
        tz=tz,
        category="learning",
        # Not transactional: it is a question, and a question at 23:00 is an
        # interruption. It waits for the morning like any other optional
        # message.
        klass=ReminderModel.CLASS_USER,
        domain_module=module,
        domain_ref=ref,
        anchor_at=starts_at,
        offset_minutes=abs(followup_after_minutes),
        payload={"ref": ref, "kind": "followup",
                 "asks": "did_it_happen",
                 # The two answers the follow-up offers. Quick replies, no
                 # typing — the same rule as every other action in the engine.
                 "answers": ["yes", "no"]})

    return {"before_id": str(before["_id"]), "followup_id": str(after["_id"])}


async def answer_followup(*, user_id: str, occurrence_id: str,
                          happened: bool) -> dict:
    """
    Her answer to "did it happen?", returned to the domain that owns the task.

    This is the catalogue's rule made concrete: *"Responses return to the
    owning domain; opening a message does not complete its task."* The receipt
    completes the reminder; the booking's own state is what actually changes.
    """
    from app.engines import notify

    db = _db()
    occ = await db["reminder_occurrences"].find_one(
        {"_id": rem._oid(occurrence_id), "user_id": user_id})
    if not occ:
        return {"ok": False, "reason": "not_found"}

    rule = await db[ReminderModel.collection_name].find_one(
        {"_id": rem._oid(occ["definition_id"])})
    ref = (rule or {}).get("domain", {}).get("ref", "")
    module = (rule or {}).get("domain", {}).get("module", "")

    await notify.record_action(occurrence_id=occurrence_id, user_id=user_id,
                               action="done", via="inapp",
                               detail={"happened": happened})

    async with atomic() as session:
        await db["bookings"].update_one(
            {"_id": rem._oid(ref)},
            {"$set": {"attendance": "attended" if happened else "no_show",
                      "attendance_at": datetime.now(timezone.utc)}},
            session=session)
        # A session that did not happen is a fact the mentoring module needs
        # to act on — rebooking, or a word with the mentor. It emits rather
        # than deciding here, because that is the owning domain's judgement.
        await emit(event="booking.attendance_recorded", module=module, ref=ref,
                   payload={"happened": happened, "user_id": user_id},
                   session=session)

    return {"ok": True, "happened": happened, "ref": ref}


async def schedule_deadline(*, user_id: str, module: str, ref: str,
                            at: datetime, title_key: str) -> str:
    """
    A safety deadline: elapsed time, server-side, never suppressed.

    `drift=keep_instant` so crossing a timezone does not move it, and
    `klass=safety` so quiet hours, the attention budget and the fatigue pause
    can none of them touch it (SAFE-UC-036, REM-UC-009).
    """
    doc = await rem.create(
        user_id=user_id,
        title_key=title_key,
        schedule_type=ReminderModel.SCHEDULE_ONCE,
        tz="UTC",
        category="safety",
        klass=ReminderModel.CLASS_SAFETY,
        drift=ReminderModel.DRIFT_ABSOLUTE,
        domain_module=module,
        domain_ref=ref,
        at=at,
        payload={"ref": ref})
    return str(doc["_id"])
