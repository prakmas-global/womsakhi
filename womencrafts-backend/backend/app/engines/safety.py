"""
What happens after a check-in deadline passes.

The deadline itself was the easy half: a row, a due time, a server that fires
it. This is the half that matters — who is told, whether they answered, and
what happens when they do not.

**Delivery is not help.** SAFE-UC-032 is explicit: *"Require contact
acknowledgement and escalate to an agreed backup; delivery alone does not mean
help accepted."* A message that reached a phone in a pocket in a cinema has
done nothing. So each contact is asked to acknowledge, and silence from the
primary escalates to the backup rather than being treated as coverage.

**Nothing here asks the policy layer for permission.** Every message on this
path is `klass=safety`, which is exempt from quiet hours, the attention budget
and the fatigue pause — because each of those is otherwise a way to silence an
alert. That exemption is the whole reason the class exists.

**The test must not look real.** SAFE-UC-031: a woman needs to be able to
check that her contacts actually receive this, and her sister needs to be able
to tell that it was a test — from the message itself, not from context she may
not have.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from bson import ObjectId

from app.db.mongodb import get_database
from app.engines import notify as notify_engine
from app.engines import reminders as rem
from app.models.reminders import ReminderModel

# How long a contact has to acknowledge before the backup is tried. Short
# enough to matter, long enough that a phone in a bag is not a failure.
ACK_GRACE_MINUTES = 10


def _db():
    return get_database()


def _oid(v):
    try:
        return ObjectId(v)
    except Exception:  # noqa: BLE001
        return None


async def contacts_for(user_id: str) -> list[dict]:
    """
    Her people, primary first.

    Ordered rather than filtered: the backup is not a lesser contact, it is
    the next one to try, and the escalation walks the list.
    """
    member = await _db()["users"].find_one({"_id": _oid(user_id)}) or {}
    mid = member.get("member_id") or ""
    rows = await _db()["trusted_contacts"].find(
        {"$or": [{"member_id": mid}, {"user_id": user_id}]}).to_list(length=10)
    rows.sort(key=lambda r: 0 if r.get("is_primary") else 1)
    return rows


async def raise_alert(*, user_id: str, journey_id: str, reason: str,
                      is_test: bool = False) -> dict:
    """
    A deadline passed, or she pressed the button. Tell her people.

    Writes one durable alert, then one message per contact — each with its own
    acknowledgement state, so "who actually answered" is a fact rather than an
    assumption.
    """
    now = datetime.now(timezone.utc)
    people = await contacts_for(user_id)

    alert = {
        "user_id": user_id,
        "journey_id": journey_id,
        "reason": reason,
        # A test is marked on the RECORD, not just in the wording, so nothing
        # downstream can mistake one for the real thing.
        "is_test": bool(is_test),
        "state": "open",
        "raised_at": now,
        "contacts": [{"contact_id": str(c["_id"]),
                      "name": c.get("name", ""),
                      "phone": c.get("phone", ""),
                      "is_primary": bool(c.get("is_primary")),
                      "told_at": None, "acknowledged_at": None}
                     for c in people],
        "escalated_at": None,
        "resolved_at": None,
    }
    res = await _db()["engine_alerts"].insert_one(alert)
    alert_id = str(res.inserted_id)

    if not people:
        # Nothing to escalate to. Recorded rather than silently succeeding,
        # because "she has no contacts" is something the safety team must be
        # able to see BEFORE a deadline passes.
        await _db()["engine_alerts"].update_one(
            {"_id": res.inserted_id},
            {"$set": {"state": "no_contacts"}})
        return {"alert_id": alert_id, "told": 0, "no_contacts": True}

    primary = [c for c in people if c.get("is_primary")] or people[:1]
    told = await _tell(alert_id, user_id, primary, is_test=is_test)

    # The backup is scheduled now, not when the primary fails to answer —
    # because "fails to answer" is silence, and silence produces no event to
    # react to. This is the same reasoning as A10's follow-up.
    await rem.create(
        user_id=user_id,
        title_key="safety.escalateToBackup",
        schedule_type=ReminderModel.SCHEDULE_ONCE,
        tz="UTC",
        category="safety",
        klass=ReminderModel.CLASS_SAFETY,
        drift=ReminderModel.DRIFT_ABSOLUTE,
        domain_module="engine_alerts",
        domain_ref=alert_id,
        at=now + timedelta(minutes=ACK_GRACE_MINUTES),
        payload={"alert": alert_id, "kind": "escalation"})

    return {"alert_id": alert_id, "told": told, "no_contacts": False}


async def _tell(alert_id: str, user_id: str, people: list[dict], *,
                is_test: bool) -> int:
    """One message per contact, each separately acknowledgeable."""
    told = 0
    for c in people:
        key = "safety.alertTest" if is_test else "safety.contactAlert"
        await notify_engine.raise_intent(
            user_id=user_id,
            template_key=key,
            category="safety",
            klass=ReminderModel.CLASS_SAFETY,
            ref=alert_id,
            bucket=f"{alert_id}:{c['_id']}",
            payload={"contact": str(c["_id"]),
                     "contact_name": c.get("name", ""),
                     "phone": c.get("phone", ""),
                     # Carried so the message itself says so. A test that only
                     # looks like a test in our database is not a test.
                     "is_test": is_test,
                     "ack_url": f"/safety/ack/{alert_id}/{c['_id']}"},
            domain_module="engine_alerts")
        await _db()["engine_alerts"].update_one(
            {"_id": _oid(alert_id), "contacts.contact_id": str(c["_id"])},
            {"$set": {"contacts.$.told_at": datetime.now(timezone.utc)}})
        told += 1
    return told


async def acknowledge(*, alert_id: str, contact_id: str) -> bool:
    """
    A contact says they have it. This is the only thing that counts as help.

    Deliberately not authenticated as a member: the person acknowledging is
    her sister, who has no account. The alert id plus the contact id is the
    capability, and both are long and single-use in practice.
    """
    now = datetime.now(timezone.utc)
    res = await _db()["engine_alerts"].update_one(
        {"_id": _oid(alert_id), "contacts.contact_id": contact_id},
        {"$set": {"contacts.$.acknowledged_at": now, "state": "acknowledged"}})
    if res.modified_count:
        # Someone is coming. Stop the escalation ladder.
        await rem.reconcile(module="engine_alerts", ref=alert_id, event="completed")
    return res.modified_count > 0


async def escalate(alert_id: str) -> dict:
    """
    Nobody acknowledged. Try the next person.

    Called by the engine when the grace reminder fires, which is why it works
    when she is unconscious, out of signal, or her phone is dead — none of
    which produce an event.
    """
    alert = await _db()["engine_alerts"].find_one({"_id": _oid(alert_id)})
    if not alert or alert.get("state") in ("acknowledged", "resolved"):
        return {"escalated": 0, "reason": "already_handled"}

    untold = [c for c in alert.get("contacts", []) if not c.get("told_at")]
    if not untold:
        await _db()["engine_alerts"].update_one(
            {"_id": _oid(alert_id)},
            {"$set": {"state": "exhausted",
                      "escalated_at": datetime.now(timezone.utc)}})
        # Everyone has been told and nobody answered. That is a fact the
        # safety team has to see, not a loop to keep running.
        await _db()["safety_alerts"].insert_one({
            "user_id": alert["user_id"],
            "member_name": "",
            "note": "Trusted contacts did not acknowledge a check-in alert",
            "created_at": datetime.now(timezone.utc),
            "handled_by": "", "resolution": "", "resolved_at": None,
            "contacts_notified": len(alert.get("contacts", [])),
            "source": "engine_escalation", "alert_id": alert_id})
        return {"escalated": 0, "reason": "exhausted", "raised_to_team": True}

    people = [{"_id": c["contact_id"], "name": c.get("name", ""),
               "phone": c.get("phone", ""), "is_primary": False}
              for c in untold[:1]]
    told = await _tell(alert_id, alert["user_id"], people,
                       is_test=alert.get("is_test", False))
    await _db()["engine_alerts"].update_one(
        {"_id": _oid(alert_id)},
        {"$set": {"state": "escalated",
                  "escalated_at": datetime.now(timezone.utc)}})

    # And the next rung, for the same reason as the first.
    await rem.create(
        user_id=alert["user_id"], title_key="safety.escalateToBackup",
        schedule_type=ReminderModel.SCHEDULE_ONCE, tz="UTC",
        category="safety", klass=ReminderModel.CLASS_SAFETY,
        drift=ReminderModel.DRIFT_ABSOLUTE,
        domain_module="engine_alerts", domain_ref=alert_id,
        at=datetime.now(timezone.utc) + timedelta(minutes=ACK_GRACE_MINUTES),
        payload={"alert": alert_id, "kind": "escalation"})
    return {"escalated": told, "reason": "no_acknowledgement"}


async def resolve(*, alert_id: str, user_id: str, note: str = "") -> bool:
    """She is fine. Everything stops (SAFE-UC-030, SAFE-UC-038)."""
    res = await _db()["engine_alerts"].update_one(
        {"_id": _oid(alert_id), "user_id": user_id},
        {"$set": {"state": "resolved", "note": note,
                  "resolved_at": datetime.now(timezone.utc)}})
    if res.modified_count:
        await rem.reconcile(module="engine_alerts", ref=alert_id, event="cancelled")
        # Afterwards, once — not in the moment (SAFE-UC-029).
        await rem.create(
            user_id=user_id, title_key="safety.wellbeingFollowUp",
            schedule_type=ReminderModel.SCHEDULE_ONCE, tz="UTC",
            category="safety", klass=ReminderModel.CLASS_USER,
            domain_module="engine_alerts", domain_ref=f"{alert_id}:wellbeing",
            at=datetime.now(timezone.utc) + timedelta(hours=24),
            payload={"alert": alert_id})
    return res.modified_count > 0


async def check_battery(*, user_id: str, journey_id: str,
                        battery_percent: int, location_ok: bool) -> dict:
    """
    Warn her while the journey can still be made safe.

    SAFE-UC-025. A tracked journey whose phone is about to die is a journey
    that is about to stop being tracked, and the moment to say so is before
    the battery goes, not after.
    """
    problems = []
    if battery_percent <= 15:
        problems.append("battery")
    if not location_ok:
        problems.append("location_permission")
    if not problems:
        return {"warned": False}

    await notify_engine.raise_intent(
        user_id=user_id, template_key="travel.trackingAtRisk",
        category="safety", klass=ReminderModel.CLASS_SAFETY,
        ref=journey_id, bucket=f"{journey_id}:{'-'.join(problems)}",
        payload={"problems": problems, "battery": battery_percent},
        domain_module="travel")
    return {"warned": True, "problems": problems}


async def handle_escalation_due(occurrence: dict) -> None:
    """The grace period elapsed. Called by the tick when the reminder fires."""
    alert_id = (occurrence.get("payload") or {}).get("alert", "")
    if alert_id:
        await escalate(alert_id)
