"""
The gate every message passes.

One function decides whether anything reaches her, and it records why. No
module dispatches directly — that is NOTIFY-UC-001, and it is the only way
"she got four things from four modules in one evening" can be prevented, since
no module can see what the others are doing.

**Three answers, not two.** allow / **hold** / suppress. Hold is the one that
makes quiet hours humane: a reminder that arrives at 22:40 is not thrown away,
it waits until 07:00 and arrives when she is awake. Throwing it away would lose
her the thing she asked to be reminded of; sending it would wake her.

**The budget is global, deliberately.** Catalogue §24.4: *"Digest budgets apply
across all modules so each module cannot consume its own independent
allowance."* Two optional messages a day, four hours apart — across Learn,
Earn, Circle, Cycle and everything else together. A per-module budget is how
products end up sending eleven notifications and believing each one was
restrained.

**Fatigue is measured, not assumed.** Two prompts in a series that she never
answers pause that series. Not because silence means distress — the catalogue
forbids inferring that — but because two ignored messages are evidence the
series is not wanted, which is a claim about the *messages*, not about her.

**Safety is outside all of it.** A safety class message is never held, never
budgeted, never fatigue-paused. It is checked for consent and nothing else.
Any other design eventually silences an alert to respect a quiet hour.
"""

from __future__ import annotations

from datetime import datetime, time, timedelta, timezone

from app.core.config import settings
from app.db.mongodb import get_database
from app.engines.schedule import parse_local_time, zone
from app.models.notify import PolicyDecisionModel, PreferenceModel
from app.models.reminders import ReminderModel


def _db():
    return get_database()


async def preferences(user_id: str) -> dict:
    """
    Her current settings, creating the default set on first use.

    Read fresh at dispatch rather than carried on the intent, because Off has
    to take effect on work that is already queued (NOTIFY-UC-010). An intent
    that captured preferences when it was raised would keep sending for hours
    after she turned it off.
    """
    doc = await _db()[PreferenceModel.collection_name].find_one(
        {"user_id": user_id}, sort=[("version", -1)])
    if doc:
        return doc
    fresh = PreferenceModel.create_document(user_id=user_id, version=1)
    await _db()[PreferenceModel.collection_name].insert_one(fresh)
    return fresh


async def update(user_id: str, changes: dict) -> dict:
    """
    A new version, never a mutation.

    So a decision made an hour ago can still be explained against the
    preferences that were true when it was made.
    """
    current = await preferences(user_id)
    nxt = {**current, **changes}
    nxt.pop("_id", None)
    nxt["user_id"] = user_id
    nxt["version"] = int(current.get("version", 1)) + 1
    nxt["created_at"] = datetime.now(timezone.utc)
    await _db()[PreferenceModel.collection_name].insert_one(nxt)
    return nxt


def _in_quiet_hours(prefs: dict, when: datetime) -> bool:
    """
    Is `when` inside her quiet window, in HER timezone?

    The window normally crosses midnight (21:30 → 07:00), so the comparison is
    an OR rather than a range. Computing this in UTC is the classic way to hold
    a message for the wrong eight hours.
    """
    q = prefs.get("quiet") or {}
    if not q.get("enabled", True):
        return False
    tz = zone(prefs.get("tz") or "UTC")
    local = when.astimezone(tz)
    start = parse_local_time(q.get("start") or "21:30")
    end = parse_local_time(q.get("end") or "07:00")
    now_t = local.time()
    days = [int(d) % 7 for d in (q.get("days") or [])]

    if start <= end:
        inside = start <= now_t < end
        night = local.date()
    else:
        # The window crosses midnight, so "Monday night" runs from Monday
        # 21:30 to TUESDAY 07:00. Taking the weekday from the instant's own
        # calendar day judged the post-midnight half against the wrong night:
        # a woman who chose Monday nights was woken at 02:00 on Tuesday, and
        # silenced at 02:00 on Monday — a night she had not selected.
        after_midnight = now_t < end
        inside = now_t >= start or after_midnight
        night = local.date() - timedelta(days=1) if after_midnight else local.date()

    if not inside:
        return False
    return (not days) or (night.weekday() in days)


def _next_open(prefs: dict, when: datetime) -> datetime:
    """
    When the quiet window ends — the moment a held message may go.

    Held messages are re-evaluated on release rather than sent blind, so a
    slightly early release costs nothing: policy simply holds it again. An
    hour LATE, though, is an hour she did not get something she asked for, so
    this errs towards the earliest honest moment.
    """
    tz = zone(prefs.get("tz") or "UTC")
    end = parse_local_time(((prefs.get("quiet") or {}).get("end")) or "07:00")
    local = when.astimezone(tz)
    candidate = datetime.combine(local.date(), end).replace(tzinfo=tz)
    if candidate <= local:
        candidate = datetime.combine(local.date() + timedelta(days=1), end).replace(tzinfo=tz)
    return candidate.astimezone(timezone.utc)


async def _discretionary_today(user_id: str, prefs: dict, when: datetime) -> tuple[int, datetime | None]:
    """
    How much of today's optional allowance is spent, and when the last one went.

    Counted from allowed decisions rather than from delivery attempts: a
    message the provider later failed to deliver still consumed her attention
    budget if we decided to send it. Counting deliveries would let a flaky
    provider quietly multiply how much she is interrupted.
    """
    tz = zone(prefs.get("tz") or "UTC")
    local_midnight = datetime.combine(
        when.astimezone(tz).date(), time(0, 0)).replace(tzinfo=tz).astimezone(timezone.utc)
    rows = await _db()[PolicyDecisionModel.collection_name].find(
        {"user_id": user_id,
         "decision": PolicyDecisionModel.ALLOW,
         "reason": "discretionary",
         "decided_at": {"$gte": local_midnight}},
    ).sort("decided_at", -1).to_list(length=20)
    last = rows[0]["decided_at"] if rows else None
    if last is not None and last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    return len(rows), last


async def evaluate(intent: dict, *, now: datetime | None = None) -> dict:
    """
    allow / hold / suppress, with a reason and the channels permitted.

    The order of the checks is the design. Consent before anything, because a
    withdrawn consent outranks every other consideration. Safety immediately
    after, because nothing below it may ever apply to a safety message.
    """
    now = now or datetime.now(timezone.utc)
    user_id = intent["user_id"]
    klass = intent.get("klass", ReminderModel.CLASS_USER)
    prefs = await preferences(user_id)
    version = int(prefs.get("version", 1))

    def decide(decision: str, reason: str, channels=None, release=None, used=0):
        return {"decision": decision, "reason": reason,
                "channels": channels or [], "release_after": release,
                "preference_version": version, "budget_used": used}

    # 1. Consent. Off means off, including for work already queued.
    mode = prefs.get("mode", PreferenceModel.MODE_ALL)
    if mode == PreferenceModel.MODE_OFF and klass != ReminderModel.CLASS_SAFETY:
        return decide(PolicyDecisionModel.SUPPRESS, "mode_off")

    # 2. Safety is outside every rule below this line. Checked for consent
    #    above, and then it goes.
    if klass == ReminderModel.CLASS_SAFETY:
        return decide(PolicyDecisionModel.ALLOW, "safety",
                      channels=_channels_for(prefs, klass, all_channels=True))

    # 3. Paused until a date she chose.
    paused = prefs.get("paused_until")
    if paused is not None:
        if paused.tzinfo is None:
            paused = paused.replace(tzinfo=timezone.utc)
        if paused > now:
            if klass == ReminderModel.CLASS_TRANSACTIONAL:
                # A refund or a security notice is not something she paused.
                return decide(PolicyDecisionModel.ALLOW, "transactional_during_pause",
                              channels=_channels_for(prefs, klass))
            return decide(PolicyDecisionModel.SUPPRESS, "paused")

    # 4. Only important: transactional and above survive.
    if mode == PreferenceModel.MODE_IMPORTANT and klass == ReminderModel.CLASS_DISCRETIONARY:
        return decide(PolicyDecisionModel.SUPPRESS, "mode_important")

    # 5. Fatigue. Two unanswered prompts pause that series — a statement about
    #    the messages, not an inference about her.
    series = (intent.get("payload") or {}).get("series") or intent.get("template_key", "")
    fatigue = (prefs.get("fatigue") or {}).get(series)
    if fatigue and klass == ReminderModel.CLASS_DISCRETIONARY:
        until = fatigue if isinstance(fatigue, datetime) else None
        if until and (until.tzinfo is None):
            until = until.replace(tzinfo=timezone.utc)
        if until and until > now:
            return decide(PolicyDecisionModel.SUPPRESS, "fatigue_pause")

    # 6. Quiet hours. Transactional facts still arrive — an order confirmation
    #    at 22:00 is information she wants, not an interruption she did not ask
    #    for — but nothing optional does.
    if _in_quiet_hours(prefs, now) and klass != ReminderModel.CLASS_TRANSACTIONAL:
        return decide(PolicyDecisionModel.HOLD, "quiet_hours",
                      release=_next_open(prefs, now))

    # 7. The shared budget, across every module.
    if klass == ReminderModel.CLASS_DISCRETIONARY:
        used, last = await _discretionary_today(user_id, prefs, now)
        budget = prefs.get("budget") or {}
        cap = int(budget.get("discretionary_per_day",
                             settings.ENGINES_DISCRETIONARY_PER_DAY))
        gap = int(budget.get("min_gap_minutes", settings.ENGINES_MIN_GAP_MINUTES))
        # Reserved, not merely counted. Two instances evaluating two nudges
        # in the same second both read used=0 and both were allowed, so a cap
        # of two became three or four. The reservation is the ALLOW row
        # itself, written before this returns, so the second evaluator sees it.
        if used < cap and (last is None or (now - last) >= timedelta(minutes=gap)):
            reserved = await _reserve_discretionary(user_id, version, now, cap)
            if reserved is None:
                return decide(PolicyDecisionModel.SUPPRESS, "budget_exhausted", used=cap)
            return decide(PolicyDecisionModel.ALLOW, "discretionary",
                          channels=_channels_for(prefs, klass), used=reserved)
        if used >= cap:
            # Tomorrow, not "soon". A held optional message that queues up
            # overnight would arrive as the burst this is meant to prevent.
            return decide(PolicyDecisionModel.SUPPRESS, "budget_exhausted", used=used)
        if last is not None and (now - last) < timedelta(minutes=gap):
            return decide(PolicyDecisionModel.HOLD, "min_gap",
                          release=last + timedelta(minutes=gap), used=used)
        return decide(PolicyDecisionModel.ALLOW, "discretionary",
                      channels=_channels_for(prefs, klass), used=used)

    return decide(PolicyDecisionModel.ALLOW, klass,
                  channels=_channels_for(prefs, klass))


def _channels_for(prefs: dict, klass: str, *, all_channels: bool = False) -> list[str]:
    """
    Which channels this message may use.

    In-app is always included: it needs no permission, costs nothing, and is
    the surface that still works when every other channel is off or refused.
    Everything else is opt-in, and `inapp_only` collapses to just the inbox
    however many providers are configured.
    """
    if prefs.get("mode") == PreferenceModel.MODE_INAPP and not all_channels:
        return ["inapp"]
    chosen = prefs.get("channels") or {}
    out = ["inapp"]

    if all_channels:
        # A safety alert uses every transport that physically exists, not the
        # ones she ticked for ordinary messages. Every channel defaults to
        # false, so honouring those defaults meant a missed travel check-in
        # wrote one inbox row and sent NOTHING to her phone — invisible until
        # she opened the app, which is the exact scenario a check-in deadline
        # covers. The catalogue is unambiguous: safety alerts "always reach
        # you, whatever is set here."
        #
        # Each adapter still declines when it has no credentials or no
        # subscription, so this asks for everything and takes what works.
        return ["inapp", "push", "sms", "whatsapp", "email"]

    for ch in ("push", "email", "sms", "whatsapp", "voice"):
        if chosen.get(ch):
            out.append(ch)
    if klass == ReminderModel.CLASS_DISCRETIONARY:
        # Never three transports for a nudge. §24.4: *"Do not send push, email
        # and SMS simultaneously for ordinary encouragement."*
        out = [c for c in out if c in ("inapp", "push")]
    return out


async def _reserve_discretionary(user_id: str, version: int,
                                 now: datetime, cap: int) -> int | None:
    """
    Take one of today's optional slots, atomically.

    Writes the ALLOW decision immediately rather than waiting for `record`,
    then re-counts. If the re-count is over the cap this reservation loses the
    race, is withdrawn, and the message is suppressed. That is a compare-and-
    set built from the rows that already exist, which is cheaper and more
    honest than a counter that can drift away from the decisions it claims to
    describe.
    """
    from bson import ObjectId

    placeholder = PolicyDecisionModel.create_document(
        intent_id="", user_id=user_id, decision=PolicyDecisionModel.ALLOW,
        reason="discretionary", preference_version=version, budget_used=0)
    res = await _db()[PolicyDecisionModel.collection_name].insert_one(placeholder)

    prefs = await preferences(user_id)
    used, _ = await _discretionary_today(user_id, prefs, now)
    if used > cap:
        await _db()[PolicyDecisionModel.collection_name].delete_one(
            {"_id": res.inserted_id})
        return None
    return used


async def record(intent_id: str, user_id: str, verdict: dict) -> None:
    """Keep the decision. This is the answer to 'why did she not get this?'"""
    if (verdict["decision"] == PolicyDecisionModel.ALLOW
            and verdict["reason"] == "discretionary"):
        # The slot was already reserved during evaluation. Claim that row
        # rather than writing a second one, which would count this message
        # twice against her own attention budget.
        claimed = await _db()[PolicyDecisionModel.collection_name].find_one_and_update(
            {"user_id": user_id, "intent_id": "",
             "decision": PolicyDecisionModel.ALLOW, "reason": "discretionary"},
            {"$set": {"intent_id": intent_id,
                      "channels": verdict.get("channels") or [],
                      "budget_used": verdict.get("budget_used", 0)}},
            sort=[("decided_at", -1)])
        if claimed:
            return

    await _db()[PolicyDecisionModel.collection_name].insert_one(
        PolicyDecisionModel.create_document(
            intent_id=intent_id, user_id=user_id,
            decision=verdict["decision"], reason=verdict["reason"],
            preference_version=verdict["preference_version"],
            channels=verdict.get("channels"),
            release_after=verdict.get("release_after"),
            budget_used=verdict.get("budget_used", 0)))


async def note_unanswered(user_id: str, series: str, *, strikes: int = 2,
                          pause_days: int = 7) -> None:
    """
    Count an ignored prompt, and pause the series at the second one.

    Called when an optional message expires without an action receipt. The
    counter lives on the preference document so it is versioned with
    everything else and visible to her in settings, rather than hidden in a
    cache that nobody can inspect.
    """
    prefs = await preferences(user_id)
    misses = dict(prefs.get("misses") or {})
    misses[series] = int(misses.get(series, 0)) + 1
    changes: dict = {"misses": misses}
    if misses[series] >= strikes:
        fatigue = dict(prefs.get("fatigue") or {})
        fatigue[series] = datetime.now(timezone.utc) + timedelta(days=pause_days)
        changes["fatigue"] = fatigue
        misses[series] = 0
    await update(user_id, changes)
