"""
Her health reminders (Health → Appointments & Reminders) on the Reminder Engine.

A reminder she sets is a `health_entries` row of kind "reminder" (routes/
health_hub.py): title, category, date, time, repeat, done days, snooze. This
module turns it into one engine rule, so it reaches her bell on the minute tick
like every other reminder — with her quiet hours, her attention budget and her
Done / Later / Stop answers, none of which this file re-implements.

* **When it changes, the rule is rebuilt** (`sync_one`, called by the routes).
  Cancelling and recreating is right for an edit she made: her time or repeat
  moved, and stale occurrences must not fire.
* **Every hour, the rule is ensured** (`sweep`, from the engine's hourly pass).
  That is what carries a monthly reminder on to next month, and recovers any
  rule a failed request never made. `ensure` is idempotent, so the sweep does
  not churn her occurrences.

Schedules, in her time zone, `reminderLead` minutes early (Health settings):
    Once         one instant: her date at her time (09:00 if none)
    Every day    recurring at that local time
    Every week   recurring on that weekday
    Every month  the next date with that day-of-month, as a one-off; the sweep
                 makes the following one after it passes

**What the message says.** Never her words: a reminder titled "thyroid tablet"
would be on a shared phone's lock screen. The title and body are neutral and
the detail is one tap away, inside the app.
"""

from __future__ import annotations

import calendar
from datetime import date, datetime, timedelta, timezone

from app.db.mongodb import get_database
from app.engines import reminders as rem
from app.models.reminders import ReminderModel

MODULE = "health_reminders"
TITLE_KEY = "reminders.healthDue"
PAYLOAD = {"title": "A reminder you set is due",
           "body": "Open Health · Appointments & Reminders to see it."}


def _db():
    return get_database()


async def _tz_of(user_id: str) -> str:
    prefs = await _db()["preference_versions"].find_one({"user_id": user_id}, sort=[("version", -1)])
    return (prefs or {}).get("tz") or "Asia/Kolkata"


async def _lead(user_id: str) -> int:
    s = await _db()["health_settings"].find_one({"user_id": user_id}, {"reminderLead": 1}) or {}
    try:
        return max(0, min(1440, int(s.get("reminderLead", 0) or 0)))
    except (TypeError, ValueError):
        return 0


def _hhmm(raw: str) -> tuple[int, int]:
    try:
        return int(raw[:2]), int(raw[3:5])
    except (ValueError, IndexError):
        return 9, 0


def _local(day: date, hhmm: str, tz_name: str) -> datetime:
    from app.engines.schedule import zone
    h, m = _hhmm(hhmm or "09:00")
    return datetime(day.year, day.month, day.day, h, m, tzinfo=zone(tz_name)).astimezone(timezone.utc)


def next_monthly(start: date, today: date, done: set[str]) -> date:
    """The next date on/after today with `start`'s day of month, not already done."""
    y, m = today.year, today.month
    for _ in range(14):
        d = date(y, m, min(start.day, calendar.monthrange(y, m)[1]))
        if d >= today and d >= start and d.isoformat() not in done:
            return d
        m += 1
        if m > 12:
            y, m = y + 1, 1
    return today


def plan(entry: dict, tz: str, lead: int, now: datetime) -> dict | None:
    """The engine schedule for one entry, or None when nothing should fire."""
    data = entry.get("data") or {}
    if data.get("cancelled"):
        return None
    try:
        start = date.fromisoformat(entry.get("date") or "")
    except ValueError:
        return None
    hhmm = data.get("time") or "09:00"
    repeat = data.get("repeat") or "Once"
    done = set(data.get("done") or [])
    from app.engines.schedule import zone
    today_local = now.astimezone(zone(tz)).date()

    if repeat in ("Every day", "Every week"):
        h, m = _hhmm(hhmm)
        mins = h * 60 + m - lead
        shift = 0
        while mins < 0:
            mins += 1440
            shift -= 1
        local_time = f"{mins // 60:02d}:{mins % 60:02d}"
        days: list[int] = []
        if repeat == "Every week":
            days = [(start.weekday() + shift) % 7]
        return {"schedule_type": ReminderModel.SCHEDULE_RECURRING, "local_time": local_time, "days": days,
                "starts_at": _local(start, "00:00", tz)}

    if repeat == "Every month":
        day = next_monthly(start, today_local, done)
    else:
        if start.isoformat() in done:
            return None
        day = start
    at = _local(day, hhmm, tz) - timedelta(minutes=lead)
    # A snooze moves the one occurrence it was set on.
    snooze = data.get("snooze") or ""
    if snooze[:10] == day.isoformat():
        try:
            at = _local(day, snooze[11:16], tz)
        except Exception:  # noqa: BLE001
            pass
    if at < now - timedelta(minutes=5):
        return None
    return {"schedule_type": ReminderModel.SCHEDULE_ONCE, "at": at}


async def _ensure(user_id: str, entry: dict, entry_id: str, now: datetime) -> bool:
    tz = await _tz_of(user_id)
    p = plan(entry, tz, await _lead(user_id), now)
    if not p:
        return False
    out = await rem.ensure(user_id=user_id, module=MODULE, ref=entry_id, title_key=TITLE_KEY, tz=tz,
                           category="reminders", klass=ReminderModel.CLASS_USER,
                           payload={**PAYLOAD, "entry": entry_id}, **p)
    return out is not None


async def sync_one(user_id: str, entry: dict | None, *, entry_id: str) -> str:
    """Rebuild the rule for one entry after she changed it. Returns what happened."""
    await rem.reconcile(module=MODULE, ref=entry_id, event="cancelled")
    if entry is None:
        return "stopped"
    made = await _ensure(user_id, entry, entry_id, datetime.now(timezone.utc))
    return "scheduled" if made else "stopped"


async def sweep() -> int:
    """Hourly: make sure every live reminder has its rule (and the next monthly one)."""
    now = datetime.now(timezone.utc)
    yesterday = (now - timedelta(days=1)).date().isoformat()
    made = 0
    rows = _db()["health_entries"].find({
        "kind": "reminder", "data.cancelled": {"$ne": True},
        "$or": [{"data.repeat": {"$in": ["Every day", "Every week", "Every month"]}},
                {"date": {"$gte": yesterday}}],
    })
    async for entry in rows:
        try:
            made += 1 if await _ensure(entry["user_id"], entry, str(entry["_id"]), now) else 0
        except Exception:  # noqa: BLE001 — one bad row must not stop the pass
            continue
    return made
