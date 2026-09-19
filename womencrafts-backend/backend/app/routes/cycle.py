"""
The cycle tracker's API. Stores her answers; `core/cycle.py` works out the rest.

── One request for the whole screen ─────────────────────────────────────────
`GET /me/cycle` returns everything every cycle screen draws — status, the
month's calendar, the week strip, insights, history, recent moods — because
Atlas is in another data centre and each extra round trip is ~50ms she waits
through. Two queries (profile, days) run together; everything else is
arithmetic.

── Her day, not the server's ────────────────────────────────────────────────
"Today" is her local date. At 1am in Mumbai it is still yesterday in UTC, and
a check-in filed under the wrong date is a period that starts a day early.
The phone sends its IANA zone; it is kept on the profile so reminders built
without a request (see `tick`) use the same clock.

── Reminders without a scheduler ────────────────────────────────────────────
There is no job runner on Cloud Run and none is needed yet. `tick` runs when
she opens the app — it rides along on the unread-badge request every screen
already makes — and files anything that has come due into her notification
feed, once, keyed so a second tick the same day files nothing. A phone push
while the app is closed needs a scheduler and push keys; that is the next step
and it calls this same function.
"""

from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo.errors import DuplicateKeyError

from app.core import cycle as engine
from app.core.rbac import require_active_member
from app.db.mongodb import get_database
from app.models.conversation import MemberNotificationModel
from app.models.cycle import DEFAULT_REMINDERS, DEFAULT_TZ, CycleDayModel, CycleProfileModel
from app.schemas.cycle import CycleDayUpdate, CycleReminders, CycleSettings, CycleSetup

router = APIRouter(prefix="/me/cycle", tags=["Member · Cycle"])

# How far back a log may be written or read. Six cycles of up to 60 days is the
# most any average looks at; two years is room to correct an old entry.
HISTORY_DAYS = 400
EDIT_BACK_DAYS = 730

REMINDER_PREFIX = "cycle:"


def _profiles():
    return get_database()[CycleProfileModel.collection_name]


def _days():
    return get_database()[CycleDayModel.collection_name]


def _notes():
    return get_database()[MemberNotificationModel.collection_name]


def _zone(name: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(name or DEFAULT_TZ)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo(DEFAULT_TZ)


def _local_now(tz: str | None) -> datetime:
    return datetime.now(timezone.utc).astimezone(_zone(tz))


def _parse(d: str) -> date:
    try:
        return date.fromisoformat(d)
    except ValueError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Dates are YYYY-MM-DD")


async def _load(uid: str, today: date) -> tuple[dict | None, list[dict]]:
    since = (today - timedelta(days=HISTORY_DAYS)).isoformat()
    return await asyncio.gather(
        _profiles().find_one({"user_id": uid}),
        _days().find({"user_id": uid, "date": {"$gte": since}}).sort("date", 1).to_list(HISTORY_DAYS + 5),
    )


def _to_days(rows: list[dict]) -> list[engine.Day]:
    out = []
    for r in rows:
        try:
            on = date.fromisoformat(r["date"])
        except (KeyError, ValueError):
            continue
        out.append(engine.Day(
            on=on, period=r.get("period"), mood=r.get("mood"),
            feelings=list(r.get("feelings") or []), symptoms=list(r.get("symptoms") or []),
            note=r.get("note") or "",
        ))
    return out


def _state(profile: dict, days: list[engine.Day], today: date) -> engine.State:
    declared = profile.get("declared_last_start")
    return engine.compute(
        days, today,
        typical_cycle=int(profile.get("typical_cycle") or engine.DEFAULT_CYCLE),
        typical_period=int(profile.get("typical_period") or engine.DEFAULT_PERIOD),
        declared_last_start=date.fromisoformat(declared) if declared else None,
    )


def _iso(d: date | None) -> str | None:
    return d.isoformat() if d else None


def _phases(s: engine.State) -> list[dict]:
    """The coloured bar: where each phase starts and ends, by cycle day."""
    ov = engine.ovulation_day(s.avg_cycle, s.avg_period)
    return [
        {"key": "menstrual", "label": "Period", "from": 1, "to": s.avg_period},
        {"key": "follicular", "label": "Follicular", "from": s.avg_period + 1, "to": ov - 2},
        {"key": "ovulation", "label": "Ovulation", "from": ov - 1, "to": ov + 1},
        {"key": "luteal", "label": "Luteal", "from": ov + 2, "to": s.avg_cycle},
    ]


def _payload(profile: dict | None, rows: list[dict], today: date, month: str | None) -> dict:
    if not profile:
        return {"setup": False, "today": today.isoformat()}
    days = _to_days(rows)
    s = _state(profile, days, today)
    by_date = {r["date"]: r for r in rows}

    try:
        y, m = (int(x) for x in (month or today.strftime("%Y-%m")).split("-"))
        date(y, m, 1)
    except ValueError:
        y, m = today.year, today.month
    marks = engine.marks_for_month(s, y, m)

    def cell(d: date) -> dict:
        r = by_date.get(d.isoformat())
        return {
            "date": d.isoformat(),
            "marks": marks_all.get(d, []),
            "logged": bool(r and (r.get("period") is not None or r.get("mood") or r.get("symptoms"))),
            "period": r.get("period") if r else None,
        }

    # The week strip can cross a month edge, so it gets marks of its own.
    marks_all = dict(marks)
    for d in (today - timedelta(days=today.weekday()), today + timedelta(days=6 - today.weekday())):
        if (d.year, d.month) != (y, m):
            marks_all.update(engine.marks_for_month(s, d.year, d.month))
    if (today.year, today.month) != (y, m):
        marks_all.update(engine.marks_for_month(s, today.year, today.month))

    first = date(y, m, 1)
    nxt = date(y + (m == 12), m % 12 + 1, 1)
    month_cells = []
    d = first
    while d < nxt:
        month_cells.append(cell(d))
        d += timedelta(days=1)

    # For the moods chart and "what's on your mind" — the last month, oldest first.
    moods = [
        {"date": r.on.isoformat(), "mood": r.mood, "feelings": r.feelings}
        for r in days if (today - r.on).days <= 30 and (r.mood or r.feelings)
    ]
    counts: dict[str, int] = {}
    for r in days:
        if (today - r.on).days <= 90:
            for sym in r.symptoms:
                if sym != "none":
                    counts[sym] = counts.get(sym, 0) + 1
    notes = [
        {"date": r.on.isoformat(), "note": r.note}
        for r in reversed(days) if r.note
    ][:10]
    today_row = by_date.get(today.isoformat())

    return {
        "setup": True,
        "today": today.isoformat(),
        "tz": profile.get("tz") or DEFAULT_TZ,
        "profile": {
            "typical_cycle": profile.get("typical_cycle"),
            "typical_period": profile.get("typical_period"),
            "discreet": bool(profile.get("discreet")),
            "reminders": {**DEFAULT_REMINDERS, **(profile.get("reminders") or {})},
        },
        "log": CycleDayModel.to_response(today_row) if today_row else None,
        "status": {
            "has_history": s.has_history,
            "on_period": s.on_period,
            "period_day": s.period_day,
            "avg_cycle": s.avg_cycle,
            "avg_period": s.avg_period,
            "measured_cycles": s.measured_cycles,
            "cycle_day": s.cycle_day,
            "phase": s.phase,
            "phase_label": engine.PHASE_LABEL.get(s.phase or "", ""),
            "last_start": _iso(s.last_start),
            "next_start": _iso(s.next_start),
            "days_until": s.days_until,
            "ovulation": _iso(s.ovulation),
            "fertile_start": _iso(s.fertile_start),
            "fertile_end": _iso(s.fertile_end),
            "long_level": s.long_level,
            "long_threshold": s.long_threshold,
            # Has she answered the one daily question yet?
            "checked_in": bool(today_row and today_row.get("period") is not None),
        },
        "phases": _phases(s),
        "calendar": {"month": f"{y:04d}-{m:02d}", "days": month_cells},
        # This calendar week, Monday to Sunday — what the Home card draws.
        "week": [cell(today - timedelta(days=today.weekday()) + timedelta(days=k)) for k in range(7)],
        "insights": engine.insights(s, days),
        "history": engine.history(s),
        "moods": moods,
        "symptom_counts": counts,
        "notes": notes,
    }


# ── Reading ────────────────────────────────────────────────────────────────

@router.get("", summary="My cycle — everything the tracker draws")
async def my_cycle(
    month: str | None = Query(None, pattern=r"^\d{4}-\d{2}$"),
    tz: str = Query("", max_length=64),
    me: dict = Depends(require_active_member),
):
    uid = str(me["_id"])
    # One round trip: the history window is 400 days, so loading it against
    # a guessed "today" that is off by a day at a date line changes nothing.
    profile, rows = await _load(uid, _local_now(tz or DEFAULT_TZ).date())
    today = _local_now(tz or (profile or {}).get("tz")).date()
    if profile and tz and tz != profile.get("tz") and _zone(tz).key == tz:
        # She has travelled, or set up on another phone. Follow the phone.
        await _profiles().update_one({"_id": profile["_id"]}, {"$set": {"tz": tz}})
        profile["tz"] = tz
    if profile:
        await _file_due(uid, profile, rows, _local_now(profile.get("tz")))
    return _payload(profile, rows, today, month)


# ── Writing ────────────────────────────────────────────────────────────────

@router.put("/setup", summary="Start tracking")
async def setup(body: CycleSetup, me: dict = Depends(require_active_member)):
    if not body.adult:
        # Nothing is written. The DPDP Act forbids tracking anyone under 18,
        # and "we stored it but did not use it" is still storing it.
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "The tracker is for women 18 and over. The guides are open to everyone.",
        )
    uid = str(me["_id"])
    tz = body.tz if body.tz and _zone(body.tz).key == body.tz else DEFAULT_TZ
    today = _local_now(tz).date()
    if body.last_start:
        ls = _parse(body.last_start)
        if ls > today or (today - ls).days > 120:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "That date is in the future or more than four months ago.",
            )
    existing = await _profiles().find_one({"user_id": uid})
    if existing:
        await _profiles().update_one({"_id": existing["_id"]}, {"$set": {
            "tz": tz, "typical_cycle": body.typical_cycle, "typical_period": body.typical_period,
            "declared_last_start": body.last_start or existing.get("declared_last_start"),
            "updated_at": datetime.now(timezone.utc),
        }})
    else:
        try:
            await _profiles().insert_one(CycleProfileModel.create_document(
                user_id=uid, tz=tz, typical_cycle=body.typical_cycle,
                typical_period=body.typical_period, declared_last_start=body.last_start,
            ))
        except DuplicateKeyError:
            pass   # two taps on "Let's get started" — the first one won
    return await my_cycle(month=None, tz=tz, me=me)


@router.put("/days/{on}", summary="Log a day — period, mood, symptoms, note")
async def log_day(on: str, body: CycleDayUpdate, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    profile = await _profiles().find_one({"user_id": uid})
    if not profile:
        raise HTTPException(status.HTTP_409_CONFLICT, "Start the tracker first.")
    tz = body.tz or profile.get("tz")
    today = _local_now(tz).date()
    day = _parse(on)
    if day > today:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "That day hasn't happened yet.")
    if (today - day).days > EDIT_BACK_DAYS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "That is more than two years ago.")

    sent = body.model_fields_set - {"tz"}
    if not sent:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Nothing to save.")
    changes = {k: getattr(body, k) for k in sent}
    if "note" in changes:
        changes["note"] = (changes["note"] or "").strip()
    changes["updated_at"] = datetime.now(timezone.utc)
    blank = CycleDayModel.blank(uid, day.isoformat())
    await _days().update_one(
        {"user_id": uid, "date": day.isoformat()},
        {"$set": changes,
         "$setOnInsert": {k: v for k, v in blank.items() if k not in changes}},
        upsert=True,
    )
    if "period" in changes and body.period is not None:
        # Her own log replaces the setup guess once it covers the same ground.
        declared = profile.get("declared_last_start")
        if declared and body.period and day >= date.fromisoformat(declared):
            await _profiles().update_one({"_id": profile["_id"]},
                                         {"$set": {"declared_last_start": None}})
    return await my_cycle(month=None, tz=tz or "", me=me)


@router.put("/reminders", summary="Which reminders, and when")
async def set_reminders(body: CycleReminders, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    sent = {f"reminders.{k}": getattr(body, k) for k in body.model_fields_set}
    if sent:
        res = await _profiles().update_one(
            {"user_id": uid}, {"$set": {**sent, "updated_at": datetime.now(timezone.utc)}},
        )
        if not res.matched_count:
            raise HTTPException(status.HTTP_409_CONFLICT, "Start the tracker first.")
    return await my_cycle(month=None, tz="", me=me)


@router.put("/settings", summary="Discreet mode and her usual lengths")
async def set_settings(body: CycleSettings, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    sent = {k: getattr(body, k) for k in body.model_fields_set}
    if sent:
        res = await _profiles().update_one(
            {"user_id": uid}, {"$set": {**sent, "updated_at": datetime.now(timezone.utc)}},
        )
        if not res.matched_count:
            raise HTTPException(status.HTTP_409_CONFLICT, "Start the tracker first.")
    return await my_cycle(month=None, tz="", me=me)


@router.delete("", summary="Delete everything the tracker holds about me")
async def erase(me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    p, d, n = await asyncio.gather(
        _profiles().delete_many({"user_id": uid}),
        _days().delete_many({"user_id": uid}),
        # The reminders in her feed say things about her cycle too.
        _notes().delete_many({"user_id": uid, "dedupe_key": {"$regex": f"^{REMINDER_PREFIX}"}}),
    )
    return {"message": "Deleted. Nothing about your cycle is kept.",
            "deleted": {"profile": p.deleted_count, "days": d.deleted_count, "reminders": n.deleted_count}}


@router.get("/export", summary="Everything the tracker holds about me")
async def export(me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    profile, rows = await asyncio.gather(
        _profiles().find_one({"user_id": uid}, {"_id": 0, "user_id": 0}),
        _days().find({"user_id": uid}, {"_id": 0, "user_id": 0}).sort("date", 1).to_list(5000),
    )
    for doc in [profile or {}, *rows]:
        for k, v in list(doc.items()):
            if isinstance(v, datetime):
                doc[k] = v.isoformat()
    return {"profile": profile, "days": rows}


# ── Reminders ──────────────────────────────────────────────────────────────

def _after(now: datetime, hhmm: str) -> bool:
    h, m = (int(x) for x in (hhmm or "09:00").split(":"))
    return (now.hour, now.minute) >= (h, m)


def due(profile: dict, s: engine.State, now: datetime, today_row: dict | None) -> list[dict]:
    """
    What has come due, as feed rows. Each carries a key that makes it
    once-only: once a day for the check-in, once a cycle for the heads-up.

    Discreet mode rewrites every one of them to say nothing about her body —
    a notification is the most visible thing an app does, on a lock screen,
    in front of whoever is holding the phone.
    """
    r = {**DEFAULT_REMINDERS, **(profile.get("reminders") or {})}
    if not r.get("smart"):
        return []
    quiet = bool(profile.get("discreet"))
    today = now.date().isoformat()
    out: list[dict] = []

    def add(key: str, title: str, body: str, href: str) -> None:
        if quiet:
            title, body = "A reminder you asked for", "Open WomSakhi when you have a moment."
        out.append({"key": REMINDER_PREFIX + key, "title": title, "body": body, "href": href})

    answered = bool(today_row and today_row.get("period") is not None)
    if r.get("checkin") and not answered and _after(now, r.get("checkin_time", "09:00")):
        if s.on_period and s.period_day:
            add(f"checkin:{today}", "Your daily check-in",
                f"Still on your period today? You're on day {s.period_day}. One tap and you're done.",
                "/app/health/cycle/log")
        else:
            add(f"checkin:{today}", "Your daily check-in",
                "Are you on your period today? One tap and you're done.",
                "/app/health/cycle/log")

    if (r.get("upcoming") and not s.on_period and s.next_start
            and s.days_until is not None and 0 < s.days_until <= 2):
        add(f"upcoming:{s.next_start.isoformat()}",
            f"Your period may start in {s.days_until} day{'s' if s.days_until != 1 else ''}",
            "A good time to keep pads handy and go easy on yourself.",
            "/app/health/cycle")

    if (r.get("ovulation") and s.fertile_start and s.fertile_end
            and s.fertile_start <= now.date() <= s.fertile_end and not s.on_period):
        add(f"fertile:{s.fertile_start.isoformat()}", "Your fertile window has started",
            "It usually lasts about six days. This is a guide to your body, not contraception.",
            "/app/health/cycle")

    if r.get("pill") and _after(now, r.get("pill_time", "21:00")):
        add(f"pill:{today}", "Time for your tablet",
            "Your daily medicine reminder.", "/app/health/cycle/today")

    if r.get("long_period") and s.long_level and s.last_start:
        start = s.last_start.isoformat()
        if s.long_level == "doctor":
            add(f"doctor:{start}", "Your period has lasted more than 7 days",
                "That is worth checking with a doctor. Here is where to go, and who to ask.",
                "/app/health/cycle/check")
        else:
            add(f"long:{start}", f"Your period has continued for {s.period_day} days",
                "Most periods last 2 to 7 days. Here is what can help, and who to ask.",
                "/app/health/cycle/check")
    return out


async def _file_due(uid: str, profile: dict, rows: list[dict], now: datetime) -> int:
    s = _state(profile, _to_days(rows), now.date())
    today_row = next((r for r in rows if r.get("date") == now.date().isoformat()), None)
    filed = 0
    for item in due(profile, s, now, today_row):
        doc = MemberNotificationModel.create_document(
            user_id=uid, title=item["title"], body=item["body"],
            ntype=MemberNotificationModel.TYPE_HEALTH, href=item["href"],
        )
        doc["dedupe_key"] = item["key"]
        try:
            await _notes().insert_one(doc)
            filed += 1
        except DuplicateKeyError:
            pass   # already told her — the unique index is the once-only rule
    return filed


async def tick(uid: str) -> int:
    """
    File whatever has come due for her, and say how many were new.

    Cheap when she does not track: one indexed lookup that finds nothing.
    """
    # Both at once: this rides on the badge request, and a second round trip
    # to Atlas would be ~25ms on every screen for every woman who tracks.
    profile, rows = await _load(uid, _local_now(DEFAULT_TZ).date())
    if not profile or not (profile.get("reminders") or {}).get("smart", True):
        return 0
    return await _file_due(uid, profile, rows, _local_now(profile.get("tz")))


# ── Health mentors ─────────────────────────────────────────────────────────

# The people "Talk to a mentor" leads to. Demo data like every other mentor in
# this database (see core/seed_depth.py) — before launch these must be real,
# registered practitioners, verified the same way members are.
HEALTH_MENTORS = [
    ("Dr. Ananya Rao", "Gynecologist · 10+ yrs",
     "Supports menstrual health, PCOS, hormonal balance", "Bengaluru", 12,
     "Weekday evenings", ["Women's Health", "Gynecology", "PCOS"], ["English", "Kannada", "Hindi"],
     "/ux/art/avatar-woman-teal-shirt.webp"),
    ("Dr. Meera Kulkarni", "Women's Wellness Coach",
     "Period care, nutrition, lifestyle", "Pune", 9,
     "Mornings", ["Women's Health", "Mental Wellness", "Period care"], ["Marathi", "Hindi", "English"],
     "/ux/art/avatar-woman-pink-glasses.webp"),
    ("Priya Menon", "Nutrition Expert",
     "Food, weight, hormone balance", "Kochi", 7,
     "Flexible", ["Nutrition", "Women's Health"], ["Malayalam", "English"],
     "/ux/art/avatar-woman-blue-saree.webp"),
    ("Sana Qadri", "Counsellor · stress and mood",
     "Stress, anxiety, low mood around your cycle", "Hyderabad", 8,
     "Weekday evenings", ["Mental Wellness"], ["Urdu", "Telugu", "English"],
     "/ux/art/avatar-woman-hijab.webp"),
]


async def seed() -> None:
    """Add the health mentors if they are missing. Never removes anyone."""
    from app.core.seed_depth import SEED_KEY, upsert_seeded

    docs = []
    for name, headline, focus, location, years, availability, expertise, languages, photo in HEALTH_MENTORS:
        docs.append({
            SEED_KEY: f"mentor:{name}",
            "name": name,
            "headline": headline,
            "focus": focus,
            "bio": f"{headline}. {focus}. Ask me anything — there is no silly question about your body.",
            "photo": photo,
            "expertise": expertise,
            "languages": languages,
            "experience_years": years,
            "location": location,
            "availability": availability,
            "rating": 4.9,
            "rating_count": 40 + years,
            "sessions_done": 60 + years * 9,
            "status": "active",
            "created_at": datetime.now(timezone.utc) - timedelta(days=120),
        })
    await upsert_seeded("mentors", docs)
