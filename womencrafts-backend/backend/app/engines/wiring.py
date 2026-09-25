"""
Where the engine meets the product: the ten asks that were "configuration".

**Sweeps, not call sites.** The obvious way to wire this is to find every
route that creates a goal, an event registration or a savings round and add a
line. That is fifteen places that each have to remember, plus every place
written next year. It also cannot fix the data that already exists — 5 goals,
31 events and 45 circles were in this database before the engine was.

So the deadlines that *live in data* are swept: once an hour, look at what is
coming and make sure a reminder exists for it. Idempotent through
`reminders.ensure`, so a sweep that runs twenty-four times a day creates one
reminder, not twenty-four. A goal whose date moves has its reminder moved on
the next pass; a goal that is reached has it cancelled.

Things that *happen* — a booking, an order, a journey starting — stay
event-driven, because there is a moment and it matters.

**Every sweep is opt-out, never opt-in.** A reminder exists for every goal
with a date, because she set the date. The attention budget and quiet hours
are what protect her from volume, not a reluctance to schedule — and she can
stop any series with one tap (REM-UC-003).
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone

from bson import ObjectId

from app.db.mongodb import get_database
from app.engines import reminders as rem
from app.engines.schedule import aware, zone
from app.models.reminders import ReminderModel

# How far ahead a sweep looks. Beyond this there is nothing useful to say, and
# a reminder created three months early is one she has forgotten agreeing to.
LOOKAHEAD_DAYS = 45


def _db():
    return get_database()


def _oid(v):
    try:
        return ObjectId(v)
    except Exception:  # noqa: BLE001
        return None


def _at_local(day: date, hhmm: str, tz_name: str) -> datetime:
    """
    A wall-clock time on a local day, as a UTC instant.

    Times in this database are display labels a person reads — "6:00 PM",
    "11:00 AM" — not 24-hour strings. Splitting on the colon gave `int("00 PM")`
    and killed the whole events sweep with one exception.
    """
    tz = zone(tz_name)
    raw = (hhmm or "09:00").strip()
    for fmt in ("%I:%M %p", "%I %p", "%H:%M", "%H"):
        try:
            t = datetime.strptime(raw, fmt).time()
            break
        except ValueError:
            continue
    else:
        t = time(9, 0)
    return datetime.combine(day, t).replace(tzinfo=tz).astimezone(timezone.utc)


MONTHS = ("january", "february", "march", "april", "may", "june", "july",
          "august", "september", "october", "november", "december")


def _parse_day(value) -> date | None:
    """
    A date from whatever is actually stored, or None.

    `goals.by` is deliberately free text — the screen asks "By when? Your own
    words are fine" — so it holds "by December", "soon", "before Diwali". A
    reminder can only be built from something with a day in it, and guessing
    at "soon" would put a reminder at an hour she never chose. So a bare month
    resolves to its last day (the honest reading of "by December") and
    anything else returns None and is skipped.
    """
    if isinstance(value, datetime):
        return value.date()
    raw = str(value or "").strip().lower()
    if not raw:
        return None

    for fmt in ("%Y-%m-%d", "%d %b %Y", "%d %B %Y", "%b %d, %Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(str(value).strip(), fmt).date()
        except (ValueError, TypeError):
            continue

    today = datetime.now(timezone.utc).date()
    for i, name in enumerate(MONTHS, start=1):
        if name in raw or raw.endswith(name[:3]):
            year = today.year if i >= today.month else today.year + 1
            nxt = date(year + (i == 12), 1 if i == 12 else i + 1, 1)
            return nxt - timedelta(days=1)          # the last day of that month
    return None


async def _tz_of(user_id: str) -> str:
    prefs = await _db()["preference_versions"].find_one(
        {"user_id": user_id}, sort=[("version", -1)])
    return (prefs or {}).get("tz") or "Asia/Kolkata"


# ── A7 · goal deadlines ─────────────────────────────────────────────────────

async def sync_goals() -> int:
    """
    A reminder a week before a goal's date, and one on the day.

    A goal without a date is a wish — the model says so — so `by` is always
    there. Reached and dropped goals are reconciled away rather than nagged
    at, which is the difference between a goal tracker and a guilt machine.
    """
    now = datetime.now(timezone.utc)
    horizon = (now + timedelta(days=LOOKAHEAD_DAYS)).date()
    made = 0

    async for goal in _db()["goals"].find({"status": "open"}):
        day = _parse_day(goal.get("by"))
        if not day or day > horizon:
            continue
        uid = goal.get("user_id") or ""
        if not uid:
            continue
        tz = await _tz_of(uid)
        ref = str(goal["_id"])

        for offset, key in ((-7, "goals.aWeekLeft"), (0, "goals.dueToday")):
            when = _at_local(day + timedelta(days=offset), "09:00", tz)
            if when < now - timedelta(hours=1):
                continue
            out = await rem.ensure(
                user_id=uid, module="goals", ref=ref, title_key=key,
                schedule_type=ReminderModel.SCHEDULE_ONCE, tz=tz,
                category="reminders", klass=ReminderModel.CLASS_USER,
                at=when, payload={"label": goal.get("label", ""), "goal": ref})
            made += 1 if out else 0

    # A goal reached stops reminding. Nothing else has to remember to do this.
    async for goal in _db()["goals"].find({"status": {"$in": ["reached", "dropped"]}}):
        await rem.reconcile(module="goals", ref=str(goal["_id"]), event="completed")
    return made


# ── A8 · events and webinars ────────────────────────────────────────────────

async def sync_events() -> int:
    """
    The day before, and an hour before — for events she actually registered for.

    Sweeping registrations rather than events is the point: 31 events and 116
    registrations, and a reminder for an event she never signed up to is spam.
    """
    now = datetime.now(timezone.utc)
    horizon = (now + timedelta(days=LOOKAHEAD_DAYS)).date()
    made = 0

    async for reg in _db()["event_registrations"].find(
            {"status": {"$nin": ["cancelled", "withdrawn"]}}):
        uid = reg.get("user_id") or ""
        if not uid:
            continue
        ev = await _db()["events"].find_one({"_id": _oid(reg.get("event_id"))}) or {}
        day = _parse_day(ev.get("date") or reg.get("date"))
        if not day or day > horizon:
            continue
        tz = await _tz_of(uid)
        starts = _at_local(day, ev.get("time") or "10:00", tz)
        ref = str(reg["_id"])

        for minutes, key in ((-1440, "events.tomorrow"), (-60, "events.inAnHour")):
            if starts + timedelta(minutes=minutes) < now - timedelta(hours=1):
                continue
            out = await rem.ensure(
                user_id=uid, module="events", ref=ref, title_key=key,
                schedule_type=ReminderModel.SCHEDULE_EVENT, tz=tz,
                category="learning", klass=ReminderModel.CLASS_TRANSACTIONAL,
                anchor_at=starts, offset_minutes=minutes,
                payload={"title": ev.get("title") or reg.get("event_title", ""),
                         "event": str(ev.get("_id", ""))})
            made += 1 if out else 0
    return made


# ── savings circles · MONEY-UC-005 ──────────────────────────────────────────

async def sync_savings_circles() -> int:
    """
    A contribution reminder, three days before the month turns.

    The catalogue is specific about the shape: *"opt-in contribution reminder
    without public shaming or exposing amounts to outsiders"*. So it goes to
    each member privately, it never names who has not paid, and the amount is
    in her own reminder only — nothing about it reaches a circle post or a
    notification preview.
    """
    now = datetime.now(timezone.utc)
    made = 0

    async for circle in _db()["circles"].find({"is_savings": True}):
        cid = str(circle["_id"])
        # The 25th: early enough to move money, late enough to be about this
        # month rather than an abstraction.
        first_next = (now.replace(day=1) + timedelta(days=32)).replace(day=1)
        due_day = (first_next - timedelta(days=6)).date()

        async for m in _db()["circle_members"].find({"circle_id": cid}):
            uid = m.get("user_id") or ""
            if not uid:
                continue
            tz = await _tz_of(uid)
            when = _at_local(due_day, "10:00", tz)
            if when < now:
                continue
            out = await rem.ensure(
                user_id=uid, module="circles", ref=f"{cid}:{due_day:%Y-%m}",
                title_key="circles.contributionDue",
                schedule_type=ReminderModel.SCHEDULE_ONCE, tz=tz,
                category="circles", klass=ReminderModel.CLASS_USER,
                at=when,
                payload={"circle": circle.get("name", ""),
                         # Her amount, in her reminder. Never in a preview and
                         # never in anyone else's.
                         "amount_minor": circle.get("monthly_minor", 0)})
            made += 1 if out else 0
    return made


# ── A5 · the cycle ──────────────────────────────────────────────────────────

async def sync_cycle() -> int:
    """
    Predicted period, from what she logged — and nothing inferred beyond it.

    `PUT /cycle/reminders` has stored her preferences since the cycle tracker
    shipped and nothing has ever sent them. This is the first code that does.

    The content is deliberately blank: `channels.is_sensitive` masks every
    `cycle.*` template to "WomSakhi — you have something to look at", so a
    predicted period never appears on a shared lock screen (CYCLE-UC-017).
    """
    now = datetime.now(timezone.utc)
    made = 0

    async for prof in _db()["cycle_profiles"].find({}):
        uid = prof.get("user_id") or ""
        wants = prof.get("reminders") or {}
        if not uid or not any(wants.values()):
            continue
        tz = await _tz_of(uid)

        # The daily ones need no prediction, and they are the ones actually
        # switched on in this database: `checkin` at `checkin_time`, `pill` at
        # `pill_time`. Gating the whole sweep on a predicted date meant the
        # settings she saved were never acted on at all.
        for flag, time_key, key in (("checkin", "checkin_time", "cycle.logToday"),
                                    ("pill", "pill_time", "cycle.takeYourPill")):
            if not wants.get(flag):
                continue
            out = await rem.ensure(
                user_id=uid, module="cycle", ref=f"{uid}:{flag}", title_key=key,
                schedule_type=ReminderModel.SCHEDULE_RECURRING, tz=tz,
                category="reminders", klass=ReminderModel.CLASS_USER,
                local_time=wants.get(time_key) or "09:00", days=[],
                payload={"series": key})
            made += 1 if out else 0

        last = _parse_day(prof.get("declared_last_start"))
        length = int(prof.get("typical_cycle") or 28)
        if not last or not (20 <= length <= 45):
            continue
        nxt = last + timedelta(days=length)
        while _at_local(nxt, "08:00", tz) < now:
            nxt += timedelta(days=length)

        plan = []
        if wants.get("period") or wants.get("upcoming"):
            plan.append((-2, "cycle.periodSoon"))
        if wants.get("log"):
            plan.append((0, "cycle.logToday"))
        for offset, key in plan:
            when = _at_local(nxt + timedelta(days=offset), "08:00", tz)
            out = await rem.ensure(
                user_id=uid, module="cycle", ref=f"{uid}:{nxt:%Y-%m-%d}",
                title_key=key, schedule_type=ReminderModel.SCHEDULE_ONCE,
                tz=tz, category="reminders", klass=ReminderModel.CLASS_USER,
                at=when, payload={"predicted": str(nxt)})
            made += 1 if out else 0
    return made


# ── seller tasks ────────────────────────────────────────────────────────────

async def sync_seller_tasks() -> int:
    """
    An order sitting unmoved is money waiting. One nudge, not a campaign.

    Only for orders that have genuinely stalled — two days in the same state —
    because an order placed this morning does not need chasing this afternoon.
    """
    now = datetime.now(timezone.utc)
    stale = now - timedelta(days=2)
    made = 0

    async for order in _db()["shop_orders"].find(
            # Capitalised exactly as the shop writes them. Matching lowercase
            # silently found nothing across 321 real orders.
            {"state": {"$in": ["New", "Making", "Ready"]},
             "updated_at": {"$lt": stale}}):
        uid = order.get("seller_id") or ""
        if not uid:
            continue
        tz = await _tz_of(uid)
        out = await rem.ensure(
            user_id=uid, module="shop_orders", ref=str(order["_id"]),
            title_key="documents.orderWaiting",
            schedule_type=ReminderModel.SCHEDULE_ONCE, tz=tz,
            category="orders", klass=ReminderModel.CLASS_TRANSACTIONAL,
            at=_at_local(now.date() + timedelta(days=1), "10:00", tz),
            payload={"title": order.get("title", ""), "order": str(order["_id"])})
        made += 1 if out else 0

    # Delivered or cancelled: stop chasing.
    async for order in _db()["shop_orders"].find(
            {"state": {"$in": ["Sent", "Done", "Cancelled"]}}):
        await rem.reconcile(module="shop_orders", ref=str(order["_id"]),
                            event="completed")
    return made


# ── A1 / A11 / A12 / A13 · the daily rhythm ─────────────────────────────────

async def sync_daily_digests() -> int:
    """
    Two recurring reminders per member: the morning list, and the evening line.

    One rule each, recurring daily — not a row per day. That is what makes
    A1, A11, A12 and A13 the same feature rather than four: the *content* is
    assembled at dispatch from her calendar, goals and orders, while the
    *schedule* is one reminder she can move or stop like any other.

    Discretionary, so both sit inside the shared attention budget and cannot
    crowd out something she actually asked for.
    """
    made = 0
    # Every active member, not every member who already has a preference
    # document — nobody has one until the engine writes it, so keying off that
    # collection meant the digests existed for precisely nobody.
    async for user in _db()["users"].find(
            {"role": "Member", "verification_status": "active"},
            {"_id": 1, "timezone": 1}):
        uid = str(user["_id"])
        prefs = await _db()["preference_versions"].find_one(
            {"user_id": uid}, sort=[("version", -1)])
        if prefs and prefs.get("mode") == "off":
            continue
        tz = (prefs or {}).get("tz") or user.get("timezone") or "Asia/Kolkata"

        for local_time, key in (("07:30", "day.morningPriorities"),
                                ("20:30", "day.endOfDay")):
            out = await rem.ensure(
                user_id=uid, module="day", ref=f"{uid}:{key}", title_key=key,
                schedule_type=ReminderModel.SCHEDULE_RECURRING, tz=tz,
                category="reminders", klass=ReminderModel.CLASS_DISCRETIONARY,
                local_time=local_time, days=[],
                payload={"series": key, "assembled": True})
            made += 1 if out else 0
    return made


async def assemble_day(user_id: str, *, evening: bool = False) -> dict:
    """
    What today actually holds — read at dispatch, not when the rule was made.

    A digest whose content was fixed a week ago is a digest that lies. This is
    why the daily reminders carry `assembled: True` and no body: the body is
    this, computed from her real bookings, events, goals and orders in the
    moment the message is rendered.
    """
    tz = zone(await _tz_of(user_id))
    today = datetime.now(timezone.utc).astimezone(tz).date()

    bookings = await _db()["bookings"].count_documents(
        {"user_id": user_id, "date": str(today), "status": "upcoming"})
    goals_due = await _db()["goals"].count_documents(
        {"user_id": user_id, "status": "open", "by": str(today)})
    orders = await _db()["shop_orders"].count_documents(
        {"seller_id": user_id, "state": {"$in": ["placed", "accepted", "making"]}})

    if evening:
        done = await _db()["action_receipts"].count_documents(
            {"user_id": user_id, "action": "done",
             "at": {"$gte": datetime.combine(today, time(0, 0)).replace(tzinfo=tz)}})
        return {"kind": "evening", "done": done, "orders_open": orders}
    return {"kind": "morning", "bookings": bookings,
            "goals_due": goals_due, "orders_open": orders}


# ── A2 · travel sessions ────────────────────────────────────────────────────

async def travel_start(*, user_id: str, journey_id: str,
                       minutes: int = 30) -> str:
    """
    A check-in deadline that outlives the browser.

    SAFE-UC-036. Safety class, `keep_instant` drift, and therefore exempt from
    quiet hours, the attention budget and the fatigue pause — every one of
    which would otherwise be a way to silence it.
    """
    from app.engines.domain import schedule_deadline

    return await schedule_deadline(
        user_id=user_id, module="travel", ref=journey_id,
        at=datetime.now(timezone.utc) + timedelta(minutes=max(5, minutes)),
        title_key="travel.checkInDue")


async def travel_checkin(*, user_id: str, journey_id: str,
                         minutes: int = 30) -> str:
    """
    She checked in. The old deadline dies, the next one starts.

    Cancel-then-create rather than moving the existing one, so there is never
    an instant where no deadline exists — the reconcile cancels only after the
    replacement is written.
    """
    new_id = await travel_start(user_id=user_id, journey_id=journey_id,
                                minutes=minutes)
    await rem.reconcile(module="travel", ref=journey_id, event="completed")
    return new_id


async def travel_end(*, journey_id: str) -> None:
    """Arrived, or cancelled. Nothing further escalates (SAFE-UC-038)."""
    await rem.reconcile(module="travel", ref=journey_id, event="cancelled")


# ── school fees ─────────────────────────────────────────────────────────────

async def sync_school_fees() -> int:
    """
    A week before each instalment, and on the day.

    Per instalment, not per term: a fee paid in three parts is three
    deadlines, and one reminder about "the term" is how the second is missed.
    """
    now = datetime.now(timezone.utc)
    horizon = (now + timedelta(days=LOOKAHEAD_DAYS)).date()
    made = 0

    async for fee in _db()["school_fees"].find({"status": "due"}):
        day = _parse_day(fee.get("due_on"))
        uid = fee.get("user_id") or ""
        if not day or not uid or day > horizon:
            continue
        tz = await _tz_of(uid)
        ref = str(fee["_id"])
        for offset, key in ((-7, "school.feeNextWeek"), (0, "school.feeDueToday")):
            when = _at_local(day + timedelta(days=offset), "09:00", tz)
            if when < now - timedelta(hours=1):
                continue
            out = await rem.ensure(
                user_id=uid, module="school_fees", ref=ref, title_key=key,
                schedule_type=ReminderModel.SCHEDULE_ONCE, tz=tz,
                category="reminders", klass=ReminderModel.CLASS_USER, at=when,
                payload={"label": fee.get("label", ""),
                         "child": fee.get("child_name", ""),
                         "amount_minor": fee.get("amount_minor", 0)})
            made += 1 if out else 0

    async for fee in _db()["school_fees"].find({"status": {"$in": ["paid", "waived"]}}):
        await rem.reconcile(module="school_fees", ref=str(fee["_id"]),
                            event="completed")
    return made


# ── care circle ─────────────────────────────────────────────────────────────

async def sync_care_tasks() -> int:
    """
    The reminder goes to whoever took the task on, two hours before.

    Not to the woman who needs the meal — she is not the one who has to
    remember. CARE-UC-004's "each has an owner" is the whole point.
    """
    now = datetime.now(timezone.utc)
    made = 0
    async for task in _db()["care_tasks"].find({"status": "open"}):
        uid = task.get("user_id") or ""
        due = aware(task.get("due_at"))
        if not uid or not due or due > now + timedelta(days=LOOKAHEAD_DAYS):
            continue
        out = await rem.ensure(
            user_id=uid, module="care_tasks", ref=str(task["_id"]),
            title_key="care.taskSoon",
            schedule_type=ReminderModel.SCHEDULE_EVENT,
            tz=await _tz_of(uid), category="circles",
            klass=ReminderModel.CLASS_USER,
            anchor_at=due, offset_minutes=-120,
            payload={"label": task.get("label", ""),
                     "for": task.get("for_member", "")})
        made += 1 if out else 0

    async for task in _db()["care_tasks"].find(
            {"status": {"$in": ["done", "cancelled"]}}):
        await rem.reconcile(module="care_tasks", ref=str(task["_id"]),
                            event="completed")
    return made


# ── benefits and schemes ────────────────────────────────────────────────────

async def sync_benefit_claims() -> int:
    """
    Two weeks before a scheme closes, and three days before.

    BENEFIT-UC-006 wants this to survive *"closing date changes"* — which it
    does, because the date is swept from her claim every hour rather than
    frozen into a reminder when she first tracked it.
    """
    now = datetime.now(timezone.utc)
    horizon = (now + timedelta(days=LOOKAHEAD_DAYS)).date()
    made = 0

    async for claim in _db()["benefit_claims"].find(
            {"state": {"$in": ["tracking", "applied"]}}):
        day = _parse_day(claim.get("closes_on"))
        uid = claim.get("user_id") or ""
        if not day or not uid or day > horizon:
            continue
        tz = await _tz_of(uid)
        ref = str(claim["_id"])
        for offset, key in ((-14, "benefit.closesInTwoWeeks"),
                            (-3, "benefit.closesSoon")):
            when = _at_local(day + timedelta(days=offset), "10:00", tz)
            if when < now - timedelta(hours=1):
                continue
            out = await rem.ensure(
                user_id=uid, module="benefit_claims", ref=ref, title_key=key,
                schedule_type=ReminderModel.SCHEDULE_ONCE, tz=tz,
                category="reminders", klass=ReminderModel.CLASS_USER, at=when,
                payload={"scheme": claim.get("scheme_name", ""),
                         "papers": claim.get("papers_needed", [])})
            made += 1 if out else 0

    async for claim in _db()["benefit_claims"].find(
            {"state": {"$in": ["received", "refused", "expired"]}}):
        await rem.reconcile(module="benefit_claims", ref=str(claim["_id"]),
                            event="completed")
    return made


# ── habits, medication and screenings ───────────────────────────────────────

async def sync_health_habits() -> int:
    """
    One recurring rule per habit, at the interval she chose.

    A daily tablet and a two-yearly screening are the same feature at
    different cadences, so `every_days` becomes either a daily recurrence or a
    dated one-off — and the engine owns the recurrence either way.
    """
    now = datetime.now(timezone.utc)
    made = 0
    async for habit in _db()["health_habits"].find({"active": True}):
        uid = habit.get("user_id") or ""
        if not uid:
            continue
        tz = await _tz_of(uid)
        every = int(habit.get("every_days") or 1)
        ref = str(habit["_id"])
        key = {"medication": "health.takeYourTablet",
               "screening": "health.screeningDue"}.get(
                   habit.get("kind", ""), "health.habitToday")

        if every <= 7:
            # Daily or weekly: a recurring rule, which she can move or stop.
            out = await rem.ensure(
                user_id=uid, module="health_habits", ref=ref, title_key=key,
                schedule_type=ReminderModel.SCHEDULE_RECURRING, tz=tz,
                category="reminders", klass=ReminderModel.CLASS_USER,
                local_time=habit.get("local_time") or "09:00",
                days=[] if every == 1 else [0],
                payload={"label": habit.get("label", ""), "series": key,
                         "habit": ref})
        else:
            # Monthly or longer: a dated one-off, re-created after each is done.
            day = _parse_day(habit.get("next_due"))
            if not day:
                continue
            when = _at_local(day, habit.get("local_time") or "09:00", tz)
            if when < now - timedelta(hours=1):
                continue
            out = await rem.ensure(
                user_id=uid, module="health_habits", ref=ref, title_key=key,
                schedule_type=ReminderModel.SCHEDULE_ONCE, tz=tz,
                category="reminders", klass=ReminderModel.CLASS_USER, at=when,
                payload={"label": habit.get("label", ""), "habit": ref,
                         "note": habit.get("note", "")})
        made += 1 if out else 0
    return made


async def record_adherence(*, user_id: str, habit_id: str) -> bool:
    """
    She took it. Her record, never a score.

    HEALTH-UC-011's adherence log. Appended to her own habit document and
    shown to nobody else — the catalogue is clear that a health record is not
    a performance the platform gets to grade.
    """
    today = datetime.now(timezone.utc).date().isoformat()
    res = await _db()["health_habits"].update_one(
        {"_id": _oid(habit_id), "user_id": user_id},
        {"$addToSet": {"adherence": today},
         "$set": {"updated_at": datetime.now(timezone.utc)}})
    return res.modified_count > 0


# ── jobs, applications and interviews ───────────────────────────────────────

async def sync_job_deadlines() -> int:
    """
    A closing date she saved is a deadline she can still act on.

    Swept from `saved` rather than from every opening in the product: a
    reminder about a job she never looked at is spam, and one about a job she
    bookmarked is the reason she bookmarked it.
    """
    now = datetime.now(timezone.utc)
    horizon = (now + timedelta(days=LOOKAHEAD_DAYS)).date()
    made = 0

    async for row in _db()["saved"].find({"kind": {"$in": ["job", "opportunity"]}}):
        uid = row.get("user_id") or ""
        if not uid:
            continue
        src = (await _db()["jobs"].find_one({"_id": _oid(row.get("ref_id"))})
               or await _db()["opportunities"].find_one({"_id": _oid(row.get("ref_id"))})
               or {})
        day = _parse_day(src.get("closes_on") or src.get("deadline"))
        if not day or day > horizon:
            continue
        tz = await _tz_of(uid)
        when = _at_local(day - timedelta(days=2), "09:00", tz)
        if when < now - timedelta(hours=1):
            continue
        out = await rem.ensure(
            user_id=uid, module="jobs", ref=str(row["_id"]),
            title_key="jobs.closesSoon",
            schedule_type=ReminderModel.SCHEDULE_ONCE, tz=tz,
            category="learning", klass=ReminderModel.CLASS_USER, at=when,
            payload={"title": src.get("title") or src.get("org", ""),
                     "closes": str(day)})
        made += 1 if out else 0
    return made


async def sync_applications() -> int:
    """
    A week of silence on an application is worth one nudge, not a campaign.

    Most employers reply within three days, so seven is the point at which
    following up is useful rather than anxious.
    """
    now = datetime.now(timezone.utc)
    made = 0
    async for app in _db()["applications"].find({}):
        state = str(app.get("status") or app.get("state") or "").lower()
        if state in ("hired", "rejected", "withdrawn", "closed"):
            await rem.reconcile(module="applications", ref=str(app["_id"]),
                                event="completed")
            continue
        uid = app.get("user_id") or ""
        created = aware(app.get("created_at"))
        if not uid or not created:
            continue
        when = created + timedelta(days=7)
        if when < now - timedelta(days=1) or when > now + timedelta(days=LOOKAHEAD_DAYS):
            continue
        out = await rem.ensure(
            user_id=uid, module="applications", ref=str(app["_id"]),
            title_key="applications.followUp",
            schedule_type=ReminderModel.SCHEDULE_ONCE,
            tz=await _tz_of(uid), category="learning",
            klass=ReminderModel.CLASS_USER, at=when,
            payload={"title": app.get("opportunity_title", ""),
                     "org": app.get("org", "")})
        made += 1 if out else 0
    return made


# ── circle digests ──────────────────────────────────────────────────────────

async def sync_circle_digests() -> int:
    """
    One weekly digest per circle she is in — never a notification per post.

    CIRCLE-UC-021. A circle with thirty-five posts is thirty-five
    interruptions if each one is told; it is one line if they are gathered.
    Discretionary, so it competes for the same attention budget as everything
    else rather than having its own.
    """
    made = 0
    seen: set[str] = set()
    async for m in _db()["circle_members"].find({}):
        uid = m.get("user_id") or ""
        if not uid or uid in seen:
            continue
        seen.add(uid)
        out = await rem.ensure(
            user_id=uid, module="circles", ref=f"{uid}:digest",
            title_key="circles.weeklyDigest",
            schedule_type=ReminderModel.SCHEDULE_RECURRING,
            tz=await _tz_of(uid), category="circles",
            klass=ReminderModel.CLASS_DISCRETIONARY,
            local_time="18:00", days=[6],          # Sunday evening
            payload={"series": "circles.weeklyDigest", "assembled": True})
        made += 1 if out else 0
    return made


# ── a shopping list she can be reminded about ───────────────────────────────

async def add_shopping_item(*, user_id: str, item: str,
                            remind_at: datetime | None = None) -> str:
    """
    A14, without a basket module.

    There is no cart in this backend, so the list IS the reminder: one entry
    per item, with an optional time. That is genuinely what the ask was —
    *"shopping list with automatic item reminders"* — and it does not need a
    checkout to be useful.
    """
    tz = await _tz_of(user_id)
    when = remind_at or _at_local(
        datetime.now(timezone.utc).date() + timedelta(days=1), "10:00", tz)
    doc = await rem.create(
        user_id=user_id, title_key="shopping.item",
        schedule_type=ReminderModel.SCHEDULE_ONCE, tz=tz,
        category="orders", klass=ReminderModel.CLASS_USER,
        domain_module="shopping", domain_ref=f"{user_id}:{item[:40]}",
        at=when, payload={"item": item})
    return str(doc["_id"])


# ── the hourly pass ─────────────────────────────────────────────────────────

async def run_sync() -> dict:
    """
    Every sweep, once an hour, each failing alone.

    Hourly rather than per-tick because none of this changes minute to minute,
    and sixty times the work for the same result is sixty times the cost. Each
    sweep is wrapped because one malformed goal must not stop the events pass.
    """
    out: dict = {}
    for name, fn in (("goals", sync_goals), ("events", sync_events),
                     ("circles", sync_savings_circles), ("cycle", sync_cycle),
                     ("orders", sync_seller_tasks), ("digests", sync_daily_digests),
                     ("school", sync_school_fees), ("care", sync_care_tasks),
                     ("benefits", sync_benefit_claims),
                     ("habits", sync_health_habits),
                     ("jobs", sync_job_deadlines),
                     ("applications", sync_applications),
                     ("circle_digests", sync_circle_digests)):
        try:
            out[name] = await fn()
        except Exception as exc:  # noqa: BLE001
            out[name] = f"failed: {str(exc)[:120]}"
    return out
