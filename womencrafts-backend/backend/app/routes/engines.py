"""
The engines' HTTP surface: one internal endpoint, and the member's own controls.

**`/internal/engines/tick` is the only way time enters this system.** Cloud
Scheduler calls it once a minute. It is authenticated two ways and neither is
optional:

- In production, Cloud Run IAM. The scheduler job carries an OIDC token and
  Cloud Run rejects an unauthenticated call before it ever reaches Python.
- In every environment, a shared secret in a header — and **an empty secret refuses every
  call** rather than allowing them, because a scheduler endpoint that is open
  when misconfigured is a way for anyone to drain a queue or trigger a send.

It returns counts rather than 204, so the scheduler's log shows what a minute
actually did and the ops console has something to read.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from secrets import compare_digest
import re
from typing import Annotated, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator

from app.core.config import settings
from app.core.deps import get_current_user
from app.db.mongodb import get_database
from app.engines import notify as notify_engine
from app.engines import policy, tick
from app.engines.schedule import aware
from app.engines import reminders as rem
from app.models.notify import (DeliveryModel, IntentModel, PreferenceModel,
                               ReceiptModel, SubscriptionModel)
from app.models.reminders import OccurrenceModel, ReminderModel
from app.models.wellbeing import HealthHabitModel

router = APIRouter(prefix="/engines", tags=["Engines"])
internal = APIRouter(prefix="/internal/engines", tags=["Engines — internal"])


# ── the tick ────────────────────────────────────────────────────────────────

def _authorised(x_engines_key: str | None) -> bool:
    secret = (settings.ENGINES_TICK_SECRET or "").strip()
    if not secret:
        # Fail closed in every environment, including behind Cloud Run IAM.
        return False
    return compare_digest((x_engines_key or "").encode(), secret.encode())


@internal.post("/tick", summary="Run one scheduling pass")
async def run_tick(x_engines_key: str | None = Header(default=None)):
    if not _authorised(x_engines_key):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authorised")
    return await tick.run_tick()


@internal.post("/sweep", summary="Run the domain sweeps")
async def run_sweep(x_engines_key: str | None = Header(default=None)):
    """
    Separate from the tick, and on a slower schedule.

    The sweeps take tens of seconds over a real database; the tick must finish
    in milliseconds. Sharing one endpoint meant one call an hour ran for 47
    seconds against a 60-second deadline, which is not a margin.
    """
    if not _authorised(x_engines_key):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authorised")
    return await tick.run_sweep() or {"skipped": "another instance has this hour"}


@internal.get("/health", summary="Queue depth and lag")
async def engines_health(x_engines_key: str | None = Header(default=None)):
    """
    What an operator needs at 3am: is anything overdue, and by how long.

    Kept behind the same key as the tick because queue depth tells an attacker
    when the system is struggling.
    """
    if not _authorised(x_engines_key):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authorised")
    db = get_database()
    now = datetime.now(timezone.utc)
    oldest = await db[OccurrenceModel.collection_name].find_one(
        {"state": OccurrenceModel.STATE_SCHEDULED, "due_at": {"$lte": now}},
        sort=[("due_at", 1)])
    return {
        "enabled": settings.ENGINES_ENABLED,
        "due_now": await db[OccurrenceModel.collection_name].count_documents(
            {"state": OccurrenceModel.STATE_SCHEDULED, "due_at": {"$lte": now}}),
        "held": await db[IntentModel.collection_name].count_documents(
            {"state": IntentModel.STATE_HELD}),
        "failed_deliveries": await db[DeliveryModel.collection_name].count_documents(
            {"state": DeliveryModel.FAILED}),
        "dead_letter": await db[DeliveryModel.collection_name].count_documents(
            {"state": DeliveryModel.EXPIRED}),
        # The number that matters. Anything above a few minutes means the
        # scheduler is not calling, or a tick is dying part-way.
        "lag_seconds": max(0, int((now - aware(oldest["due_at"])).total_seconds())) if oldest else 0,
    }


# ── her reminders ───────────────────────────────────────────────────────────

class ReminderIn(BaseModel):
    title_key: str = Field(min_length=1, max_length=120)
    schedule_type: Literal["once", "recurring", "event_relative"] = "once"
    tz: str = "UTC"
    category: str = "reminders"
    at: datetime | None = None
    local_time: str = ""
    days: list[Annotated[int, Field(strict=True, ge=0, le=6)]] = Field(default_factory=list)
    offset_minutes: int = 0
    anchor_at: datetime | None = None
    ends_at: datetime | None = None
    payload: dict = Field(default_factory=dict)

    @field_validator("title_key")
    @classmethod
    def meaningful_title(cls, value):
        if not value.strip():
            raise ValueError("Give the reminder a title")
        return value.strip()

    @field_validator("tz")
    @classmethod
    def valid_timezone(cls, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Choose a valid IANA timezone")
        return value

    @field_validator("at", "anchor_at", "ends_at")
    @classmethod
    def normalize_instant(cls, value):
        return aware(value)

    @model_validator(mode="after")
    def valid_schedule(self):
        if self.schedule_type == "once" and self.at is None:
            raise ValueError("A one-off reminder needs a date and time")
        if self.schedule_type == "recurring" and not re.fullmatch(
                r"(?:[01]\d|2[0-3]):[0-5]\d", self.local_time):
            raise ValueError("Choose a time in HH:MM format")
        if self.schedule_type == "event_relative" and self.anchor_at is None:
            raise ValueError("An event reminder needs the event date and time")
        due = self.at if self.schedule_type == "once" else None
        if self.schedule_type == "event_relative":
            try:
                due = self.anchor_at + timedelta(minutes=self.offset_minutes)
            except OverflowError:
                raise ValueError("The event offset is outside the supported date range")
        if due and self.ends_at and due > self.ends_at:
            raise ValueError("The reminder cannot end before it is due")
        return self


@router.get("/reminders", summary="Her reminders")
async def list_reminders(me: dict = Depends(get_current_user)):
    db = get_database()
    rows = await db[ReminderModel.collection_name].find(
        {"user_id": str(me["_id"]), "state": {"$ne": ReminderModel.STATE_CANCELLED}},
    ).sort("created_at", -1).to_list(length=200)
    return {"reminders": [ReminderModel.to_response(r) for r in rows]}


@router.post("/reminders", status_code=status.HTTP_201_CREATED,
             summary="Create one from a preset")
async def create_reminder(body: ReminderIn, me: dict = Depends(get_current_user)):
    """
    An unknown `schedule_type` is refused, not quietly downgraded.

    `ReminderModel.create_document` falls back to `once` for anything it does
    not recognise, and a `once` with no instant materialises to nothing — so a
    client sending "daily" got a 201, an id, and a reminder that would never
    fire, with no error anywhere to find. The vocabulary is exactly three
    words and this is where they are checked.
    """
    if body.schedule_type not in ReminderModel.SCHEDULES:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"schedule_type must be one of {', '.join(ReminderModel.SCHEDULES)}")
    if body.schedule_type == ReminderModel.SCHEDULE_ONCE and body.at is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            "a one-off reminder needs `at`")
    if body.schedule_type == ReminderModel.SCHEDULE_RECURRING and not body.local_time:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            "a repeating reminder needs `local_time`")
    doc = await rem.create(
        user_id=str(me["_id"]),
        member_id=str(me.get("member_id", "")),
        title_key=body.title_key,
        schedule_type=body.schedule_type,
        tz=body.tz,
        category=body.category,
        # A member-created reminder is never `safety` — that class is reserved
        # for the travel engine and cannot be claimed from the public API.
        klass=ReminderModel.CLASS_USER,
        at=body.at, local_time=body.local_time, days=body.days,
        offset_minutes=body.offset_minutes, anchor_at=body.anchor_at,
        ends_at=body.ends_at, payload=body.payload)
    return ReminderModel.to_response(doc)


@router.get("/reminders/{definition_id}/next", summary="When it fires next")
async def next_times(definition_id: str, me: dict = Depends(get_current_user)):
    """
    The plain-language preview the catalogue requires before recurrence starts
    (REM-UC-001, REM-UC-011). Real computed instants, not a description of the
    rule — so what she is shown is what will actually happen.
    """
    db = get_database()
    rows = await db[OccurrenceModel.collection_name].find(
        {"definition_id": definition_id, "user_id": str(me["_id"]),
         "state": OccurrenceModel.STATE_SCHEDULED},
    ).sort("due_at", 1).to_list(length=5)
    out = [OccurrenceModel.to_response(r) for r in rows]

    # The queue only reaches 48 hours ahead, because occurrences are filled a
    # horizon at a time rather than forever. For anything weekly that means
    # nothing is queued yet on most days — and a preview that answers "nothing
    # is due" for a reminder set two minutes ago is worse than no preview: she
    # concludes it did not save.
    #
    # So the rest is computed from the rule. Marked `projected`, because these
    # are what WILL be queued rather than what has been, and a screen should
    # not be able to confuse the two.
    if len(out) < 5:
        rule = await db[ReminderModel.collection_name].find_one(
            {"_id": rem._oid(definition_id), "user_id": str(me["_id"])})
        if rule and rule.get("state") == ReminderModel.STATE_SCHEDULED:
            from app.engines import schedule as sched
            last = out[-1]["due_at"] if out else datetime.now(timezone.utc)
            if isinstance(last, datetime) and last.tzinfo is None:
                last = last.replace(tzinfo=timezone.utc)
            for when in sched.materialise(
                    schedule=rule.get("schedule") or {},
                    tz_name=rule.get("tz") or "UTC",
                    after=last,
                    horizon=last + timedelta(days=120),
                    ends_at=rule.get("ends_at"),
                    limit=5 - len(out)):
                out.append({"id": "", "definition_id": definition_id,
                            "due_at": when, "state": "projected",
                            "category": rule.get("category", "reminders"),
                            "completed_at": None})
    return {"next": out}


@router.patch("/reminders/{definition_id}", summary="Change it")
async def edit_reminder(definition_id: str, changes: dict,
                        me: dict = Depends(get_current_user)):
    db = get_database()
    owned = await db[ReminderModel.collection_name].find_one(
        {"_id": rem._oid(definition_id), "user_id": str(me["_id"])})
    if not owned:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such reminder")
    allowed = {"title_key", "payload", "schedule", "tz", "ends_at", "category"}
    clean = {k: v for k, v in changes.items() if k in allowed}
    schedule = dict(owned.get("schedule") or {})
    if "schedule" in clean:
        if not isinstance(clean["schedule"], dict):
            raise HTTPException(422, "schedule must be an object")
        schedule.update(clean["schedule"])
    candidate = {**owned, **clean}
    try:
        validated = ReminderIn.model_validate({
            **{k: candidate.get(k) for k in ("title_key", "payload", "tz", "ends_at", "category")},
            **{k: v for k, v in schedule.items() if k in ReminderIn.model_fields},
            "schedule_type": schedule.get("type", "once"),
        })
    except ValidationError as exc:
        raise HTTPException(422, [{"loc": list(e["loc"]), "msg": e["msg"],
                                   "type": e["type"]} for e in exc.errors()])
    values = validated.model_dump()
    for key in clean.keys() - {"schedule"}:
        clean[key] = values[key]
    if "schedule" in clean:
        clean["schedule"] = {"type": validated.schedule_type, **{
            k: values[k] for k in ("at", "local_time", "days", "offset_minutes", "anchor_at")}}
    ok = await rem.edit(definition_id, clean)
    return {"updated": ok}


@router.delete("/reminders/{definition_id}", summary="Stop the series")
async def stop_reminder(definition_id: str, me: dict = Depends(get_current_user)):
    return {"stopped": await rem.stop_series(definition_id, user_id=str(me["_id"]))}


# ── her answers ─────────────────────────────────────────────────────────────

class ActionIn(BaseModel):
    action: str
    via: str = "inapp"
    minutes: int = 60


@router.post("/occurrences/{occurrence_id}/action",
             summary="Done, Later, Skip or Stop")
async def act(occurrence_id: str, body: ActionIn,
              me: dict = Depends(get_current_user)):
    """
    The four quick actions, no typing required (REM-UC-003).

    Authorised server-side against her own user id, because an occurrence id
    travels in a push payload and must not be enough on its own to complete
    somebody else's reminder.
    """
    if body.action not in ReceiptModel.ACTIONS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown action")
    ok = await notify_engine.record_action(
        occurrence_id=occurrence_id, user_id=str(me["_id"]),
        action=body.action, via=body.via, detail={"minutes": body.minutes})
    return {"ok": ok}


class FollowUpIn(BaseModel):
    happened: bool


@router.post("/occurrences/{occurrence_id}/happened",
             summary="Did the session actually take place?")
async def answer_followup(occurrence_id: str, body: FollowUpIn,
                          me: dict = Depends(get_current_user)):
    """
    A10's second stage, answered.

    Two taps — yes or no — and the answer goes back to the booking, not just
    into the message. That is the catalogue's rule made literal: *"Responses
    return to the owning domain; opening a message does not complete its
    task."* A "no" is the one this exists for: it is how a mentor who does not
    turn up becomes a fact somebody can act on, rather than a woman quietly
    giving up.
    """
    from app.engines.domain import answer_followup as record_answer

    out = await record_answer(user_id=str(me["_id"]),
                              occurrence_id=occurrence_id,
                              happened=body.happened)
    if not out.get("ok"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such follow-up")
    return out


# ── her settings ────────────────────────────────────────────────────────────

class PrefsIn(BaseModel):
    tz: str | None = None
    mode: str | None = None
    quiet_start: str | None = None
    quiet_end: str | None = None
    quiet_enabled: bool | None = None
    channels: dict | None = None
    discretionary_per_day: int | None = None
    min_gap_minutes: int | None = None
    paused_until: datetime | None = None


@router.get("/preferences", summary="How she is told")
async def get_prefs(me: dict = Depends(get_current_user)):
    prefs = await policy.preferences(str(me["_id"]))
    prefs.pop("_id", None)
    return prefs


@router.put("/preferences", summary="Less often, In-app only, Pause or Off")
async def set_prefs(body: PrefsIn, me: dict = Depends(get_current_user)):
    """
    Takes effect on work that is already queued, not just on what comes next
    (NOTIFY-UC-010) — held intents are re-evaluated against the newest version
    when the tick releases them, so Off at 22:00 stops the 07:00 delivery.
    """
    current = await policy.preferences(str(me["_id"]))
    changes: dict = {}
    if body.tz is not None:
        changes["tz"] = body.tz
    if body.mode in PreferenceModel.MODES:
        changes["mode"] = body.mode
    quiet = dict(current.get("quiet") or {})
    if body.quiet_start is not None:
        quiet["start"] = body.quiet_start
    if body.quiet_end is not None:
        quiet["end"] = body.quiet_end
    if body.quiet_enabled is not None:
        quiet["enabled"] = bool(body.quiet_enabled)
    changes["quiet"] = quiet
    if body.channels is not None:
        changes["channels"] = {k: bool(v) for k, v in body.channels.items()
                               if k in PreferenceModel.CHANNELS}
    budget = dict(current.get("budget") or {})
    if body.discretionary_per_day is not None:
        budget["discretionary_per_day"] = max(0, int(body.discretionary_per_day))
    if body.min_gap_minutes is not None:
        budget["min_gap_minutes"] = max(0, int(body.min_gap_minutes))
    changes["budget"] = budget
    if body.paused_until is not None:
        changes["paused_until"] = body.paused_until

    prefs = await policy.update(str(me["_id"]), changes)

    # A timezone change has to reach the reminders she already has, or her
    # 07:00 habit keeps firing at the old wall clock until the horizon is
    # next rebuilt — up to two days of arriving at the wrong hour.
    old_tz = current.get("tz") or "UTC"
    if body.tz and body.tz != old_tz:
        try:
            await rem.retune_for_zone(str(me["_id"]), old_tz=old_tz, new_tz=body.tz)
        except Exception as exc:  # noqa: BLE001 - never fail a settings save
            print(f"⚠️  Timezone retune for {me['_id']} failed: {exc}")

    prefs.pop("_id", None)
    return prefs


@router.get("/channels", summary="Which ways of reaching her actually work")
async def channels(me: dict = Depends(get_current_user)):
    """
    What the settings screen is allowed to offer her.

    Every adapter in `engines/channels.py` refuses with `*_not_configured`
    when its provider is missing, and that refusal is invisible from the
    client: the toggle saves, the preference stores, and nothing is ever
    delivered. So the screen asks first, and shows an unavailable channel as
    unavailable instead of as a switch she has turned on.

    `inapp` is always true — it needs no provider and costs nothing, which is
    why it is also the one channel the policy layer treats as a floor.
    """
    return {
        "inapp": True,
        "push": bool(settings.VAPID_PRIVATE_KEY and settings.VAPID_PUBLIC_KEY),
        "email": bool(settings.SMTP_HOST),
        "sms": bool(settings.SMS_PROVIDER),
        "whatsapp": bool(settings.WHATSAPP_PROVIDER),
        # Feature 80. Nothing is wired behind it yet, and saying so here keeps
        # the claim in one place rather than in a comment on a screen.
        "voice": False,
        # Whether anything DISPATCHES at all.
        #
        # A configured channel is not a delivered message: `ENGINES_ENABLED` is
        # the switch on the tick loop, and with it off every reminder she sets
        # is stored, scheduled, listed back to her — and never sent. She had no
        # way to know. The only endpoint carrying this was
        # `/internal/engines/health`, which is key-protected and staff-only.
        #
        # Named `delivering` rather than `enabled` because that is the question
        # her screen is actually asking: will this arrive?
        "delivering": bool(settings.ENGINES_ENABLED),
    }


@router.get("/why/{intent_id}", summary="Why this reminder?")
async def why(intent_id: str, me: dict = Depends(get_current_user)):
    """
    The plain-language answer the catalogue asks for.

    It reads the stored decision rather than re-deriving one, so what she is
    told is what actually happened — including when the reason has since
    stopped being true.
    """
    from app.models.notify import PolicyDecisionModel
    db = get_database()
    row = await db[PolicyDecisionModel.collection_name].find_one(
        {"intent_id": intent_id, "user_id": str(me["_id"])},
        sort=[("decided_at", -1)])
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No decision recorded")
    return {"decision": row["decision"], "reason": row["reason"],
            "at": row["decided_at"], "channels": row.get("channels", [])}


# ── web push ────────────────────────────────────────────────────────────────

class SubIn(BaseModel):
    endpoint: str
    p256dh: str
    auth: str
    user_agent: str = ""


@router.get("/push/key", summary="The public VAPID key")
async def push_key():
    return {"key": settings.VAPID_PUBLIC_KEY, "enabled": bool(settings.VAPID_PUBLIC_KEY)}


@router.post("/push/subscribe", summary="Register this browser")
async def subscribe(body: SubIn, me: dict = Depends(get_current_user)):
    db = get_database()
    doc = SubscriptionModel.create_document(
        user_id=str(me["_id"]), endpoint=body.endpoint,
        p256dh=body.p256dh, auth=body.auth, user_agent=body.user_agent)
    # Upsert on the endpoint: re-subscribing the same browser refreshes the
    # row rather than adding a second one to push to forever.
    await db[SubscriptionModel.collection_name].update_one(
        {"endpoint": body.endpoint},
        {"$set": {**doc, "invalid_at": None}}, upsert=True)
    return {"ok": True}


@router.delete("/push/subscribe", summary="Remove this browser")
async def unsubscribe(endpoint: str, me: dict = Depends(get_current_user)):
    db = get_database()
    res = await db[SubscriptionModel.collection_name].delete_one(
        {"endpoint": endpoint, "user_id": str(me["_id"])})
    return {"removed": res.deleted_count}

# ── the operations console ──────────────────────────────────────────────────

@internal.get("/ops", summary="What is stuck, and why")
async def ops(x_engines_key: str | None = Header(default=None), limit: int = 25):
    """
    Everything an operator needs to answer "is it working?" in one call.

    Queue lag is the headline: anything above a few minutes means Cloud
    Scheduler is not calling, or a tick is dying part-way through. The
    suppression breakdown is the second thing to look at, because a spike in
    `budget_exhausted` is a product problem (something is raising too many
    optional messages) rather than an infrastructure one.

    Behind the same key as the tick: queue depth tells an attacker when the
    system is struggling.
    """
    if not _authorised(x_engines_key):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authorised")
    db = get_database()
    now = datetime.now(timezone.utc)

    suppression = await db[__import__(
        "app.models.notify", fromlist=["PolicyDecisionModel"]
    ).PolicyDecisionModel.collection_name].aggregate([
        {"$match": {"decided_at": {"$gte": now - timedelta(days=1)}}},
        {"$group": {"_id": {"d": "$decision", "r": "$reason"}, "n": {"$sum": 1}}},
        {"$sort": {"n": -1}}, {"$limit": 20},
    ]).to_list(length=20)

    dead = await db[DeliveryModel.collection_name].find(
        {"state": DeliveryModel.EXPIRED}).sort("updated_at", -1).to_list(length=limit)

    overdue = await db[OccurrenceModel.collection_name].find(
        {"state": OccurrenceModel.STATE_SCHEDULED, "due_at": {"$lte": now}},
    ).sort("due_at", 1).to_list(length=limit)

    return {
        "now": now,
        "enabled": settings.ENGINES_ENABLED,
        "queue": {
            "due_now": len(overdue),
            "oldest_due": overdue[0]["due_at"] if overdue else None,
            "held": await db[IntentModel.collection_name].count_documents(
                {"state": IntentModel.STATE_HELD}),
            "outbox_unprocessed": await db["outbox"].count_documents(
                {"processed_at": None}),
        },
        "delivery": {
            "failed": await db[DeliveryModel.collection_name].count_documents(
                {"state": DeliveryModel.FAILED}),
            "dead_letter": len(dead),
            "recent_dead": [{"id": str(d["_id"]), "channel": d.get("channel"),
                             "error": d.get("error", "")[:120]} for d in dead[:10]],
        },
        "suppression_24h": [{"decision": r["_id"]["d"], "reason": r["_id"]["r"],
                             "count": r["n"]} for r in suppression],
        "by_channel_24h": await db[DeliveryModel.collection_name].aggregate([
            {"$match": {"created_at": {"$gte": now - timedelta(days=1)}}},
            {"$group": {"_id": {"c": "$channel", "s": "$state"},
                        "n": {"$sum": 1},
                        "cost": {"$sum": "$cost_micros"}}},
            {"$sort": {"n": -1}},
        ]).to_list(length=40),
    }


@internal.post("/replay/{attempt_id}", summary="Retry one dead-lettered delivery")
async def replay(attempt_id: str, x_engines_key: str | None = Header(default=None)):
    """
    Put a dead-lettered attempt back in the queue.

    Deliberately one at a time and manual. A bulk replay after a provider
    outage is how a hundred women get a message at once for something that
    stopped mattering hours ago.
    """
    if not _authorised(x_engines_key):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authorised")
    db = get_database()
    res = await db[DeliveryModel.collection_name].update_one(
        {"_id": rem._oid(attempt_id), "state": DeliveryModel.EXPIRED},
        {"$set": {"state": DeliveryModel.FAILED, "attempts": 0,
                  "next_retry_at": datetime.now(timezone.utc),
                  "updated_at": datetime.now(timezone.utc)}})
    return {"requeued": res.modified_count}

# ── safety: contacts, acknowledgement, escalation ───────────────────────────

class AlertIn(BaseModel):
    journey_id: str
    reason: str = "missed_checkin"
    is_test: bool = False


@router.post("/safety/alert", summary="Tell her people")
async def raise_alert(body: AlertIn, me: dict = Depends(get_current_user)):
    from app.engines import safety as safety_engine
    return await safety_engine.raise_alert(
        user_id=str(me["_id"]), journey_id=body.journey_id,
        reason=body.reason, is_test=body.is_test)


@router.post("/safety/ack/{alert_id}/{contact_id}", summary="A contact answers")
async def ack(alert_id: str, contact_id: str):
    """
    Deliberately unauthenticated.

    The person acknowledging is her sister, who has no account. The alert id
    plus the contact id IS the capability — requiring a login here would mean
    the acknowledgement never happens, and an unacknowledged alert escalates.
    """
    from app.engines import safety as safety_engine
    ok = await safety_engine.acknowledge(alert_id=alert_id, contact_id=contact_id)
    if not ok:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such alert")
    return {"acknowledged": True}


@router.post("/safety/resolve/{alert_id}", summary="She is fine")
async def resolve_alert(alert_id: str, note: str = "",
                        me: dict = Depends(get_current_user)):
    from app.engines import safety as safety_engine
    return {"resolved": await safety_engine.resolve(
        alert_id=alert_id, user_id=str(me["_id"]), note=note)}


class BatteryIn(BaseModel):
    journey_id: str
    battery_percent: int
    location_ok: bool = True


@router.post("/safety/tracking-health", summary="Battery and permission check")
async def tracking_health(body: BatteryIn, me: dict = Depends(get_current_user)):
    from app.engines import safety as safety_engine
    return await safety_engine.check_battery(
        user_id=str(me["_id"]), journey_id=body.journey_id,
        battery_percent=body.battery_percent, location_ok=body.location_ok)


class JourneyIn(BaseModel):
    journey_id: str
    minutes: int = 30


@router.post("/travel/start", summary="Begin a tracked journey")
async def travel_start(body: JourneyIn, me: dict = Depends(get_current_user)):
    from app.engines import wiring
    return {"deadline_id": await wiring.travel_start(
        user_id=str(me["_id"]), journey_id=body.journey_id,
        minutes=body.minutes)}


@router.post("/travel/checkin", summary="I am fine — reset the clock")
async def travel_checkin(body: JourneyIn, me: dict = Depends(get_current_user)):
    from app.engines import wiring
    return {"deadline_id": await wiring.travel_checkin(
        user_id=str(me["_id"]), journey_id=body.journey_id,
        minutes=body.minutes)}


@router.post("/travel/end", summary="Arrived")
async def travel_end(body: JourneyIn, me: dict = Depends(get_current_user)):
    from app.engines import wiring
    await wiring.travel_end(journey_id=body.journey_id)
    return {"ended": True}


# ── mood ────────────────────────────────────────────────────────────────────

class MoodIn(BaseModel):
    mood: str
    note: str = ""
    style: str | None = None


@router.post("/mood/check-in", summary="How are you today?")
async def mood_check_in(body: MoodIn, me: dict = Depends(get_current_user)):
    from app.engines import mood as mood_engine
    out = await mood_engine.check_in(user_id=str(me["_id"]), mood=body.mood,
                                     note=body.note, style=body.style)
    if not out.get("ok"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown mood")
    return out


@router.get("/mood/card", summary="One card, if she wants one")
async def mood_card(mood: str | None = None, me: dict = Depends(get_current_user)):
    from app.engines import mood as mood_engine
    chosen = mood if mood in mood_engine.MOODS else None
    return {"card": await mood_engine.support_card(user_id=str(me["_id"]), mood=chosen)}


@router.get("/mood/activity", summary="Something to do, not read")
async def mood_activity(me: dict = Depends(get_current_user)):
    from app.engines import mood as mood_engine
    return {"activity": await mood_engine.reset_activity(user_id=str(me["_id"]))}


class ActivityActionIn(BaseModel):
    action: Literal["started", "completed", "skipped", "saved", "unsaved"]


@router.post("/mood/activity/{activity_id}/action", summary="Save or record an activity")
async def mood_activity_action(
    activity_id: str, body: ActivityActionIn, me: dict = Depends(get_current_user),
):
    from app.engines import mood as mood_engine
    ok = await mood_engine.activity_action(
        user_id=str(me["_id"]), activity_id=activity_id, action=body.action,
    )
    if not ok:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That activity is no longer available")
    return {"ok": True, "action": body.action}


@router.get("/mood/activities/saved", summary="Activities I kept")
async def mood_saved_activities(me: dict = Depends(get_current_user)):
    from app.engines import mood as mood_engine
    return {"activities": await mood_engine.saved_activities(user_id=str(me["_id"]))}


@router.put("/mood/encouragement", summary="General, scripture or none")
async def set_encouragement(choice: str, me: dict = Depends(get_current_user)):
    from app.engines import mood as mood_engine
    ok = await mood_engine.set_encouragement(user_id=str(me["_id"]), choice=choice)
    if not ok:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown choice")
    return {"set": choice}


# ── habits, shopping, and the assistant ─────────────────────────────────────

@router.get("/habits", summary="The habits and screenings she keeps")
async def list_habits(me: dict = Depends(get_current_user)):
    """
    The read side of "I took it".

    `record_adherence` existed with nothing to call it: there was no way for a
    screen to learn which habits she has, so the write endpoint could only ever
    be reached by guessing an id. This returns the list, and — deliberately —
    only **whether today is already marked**, not a streak, a percentage or a
    count of missed days.

    That restraint is the feature. Her adherence log is her record, not a
    score, and the moment a screen can draw "4 of 7 days" it becomes a way to
    feel behind about medicine.
    """
    db = get_database()
    today = datetime.now(timezone.utc).date().isoformat()
    rows = await db[HealthHabitModel.collection_name].find(
        {"user_id": str(me["_id"]), "active": True},
    ).sort("next_due", 1).to_list(length=100)
    return {
        "habits": [{
            "id": str(r["_id"]),
            "kind": r.get("kind", "habit"),
            "label": r.get("label", ""),
            "note": r.get("note", ""),
            "local_time": r.get("local_time", ""),
            "every_days": r.get("every_days", 1),
            "next_due": r.get("next_due", ""),
            "done_today": today in (r.get("adherence") or []),
        } for r in rows],
    }


@router.post("/habits/{habit_id}/taken", summary="I took it")
async def habit_taken(habit_id: str, me: dict = Depends(get_current_user)):
    from app.engines import wiring
    return {"recorded": await wiring.record_adherence(
        user_id=str(me["_id"]), habit_id=habit_id)}


@router.post("/shopping", summary="Add an item to remind me about")
async def shopping(item: str, me: dict = Depends(get_current_user)):
    from app.engines import wiring
    return {"id": await wiring.add_shopping_item(user_id=str(me["_id"]), item=item)}


@router.get("/suggest-time", summary="Propose an hour — she confirms it")
async def suggest_time(what: str, me: dict = Depends(get_current_user)):
    """
    A suggestion, validated against her quiet hours before it is offered.

    It fills in a field. It does not create a reminder, and a model outage
    returns the deterministic default rather than an error (REM-UC-007).
    """
    from app.engines import assist
    prefs = await policy.preferences(str(me["_id"]))
    return await assist.suggest_time(user_id=str(me["_id"]), what=what,
                                     tz_name=prefs.get("tz") or "Asia/Kolkata")
