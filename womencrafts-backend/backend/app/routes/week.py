"""
Her week.

Everything already on her calendar, for one seven-day window: the sessions she
has booked and the events she has registered for. Nothing is generated and
nothing is suggested — a calendar that shows her things she has not agreed to
is a calendar she cannot trust to tell her where she has to be.

── What this replaced ──────────────────────────────────────────────────────
A hardcoded week in the screen itself: "Morning Walk 7:00–8:00 AM", a "UI/UX
Course" on Monday, "Yoga Session" at four. Identical for every woman, and
pinned to the 13th–19th whatever week it actually was — so the column marked
"today" was almost never today.

── Times ───────────────────────────────────────────────────────────────────
Bookings and events store their time as a human label ("10:00 AM"), not as a
timestamp. The label is what she was shown when she booked, so it is what she
is shown here; `hour` is parsed off it purely so the grid knows where to draw
the block, and is null when the label cannot be read rather than guessed at.
"""

from datetime import date, datetime, timedelta, timezone
import re

from bson import ObjectId

from fastapi import APIRouter, Depends, Query

from app.core.rbac import require_active_member
from app.db.mongodb import get_database
from app.models.enrollment import BookingModel
from app.models.growth import EventModel, EventRegistrationModel

router = APIRouter(prefix="/me/week", tags=["Member · Journey"])

#: Which lane a thing sits in. The screen colours by this, so it is decided
#: once here rather than per screen.
_EVENT_CATEGORY = {
    "learning": "learning", "course": "learning", "workshop": "learning",
    "health": "health", "wellness": "health",
    "work": "work", "business": "work", "jobs": "work",
    "community": "community", "circle": "community",
    "money": "money", "finance": "money",
    "mentoring": "mentoring", "mentor": "mentoring",
}

_TIME = re.compile(r"^\s*(\d{1,2})(?::(\d{2}))?\s*([AaPp])?\.?[Mm]?")
#: The marker at the END of a range, e.g. the "PM" in "4:00 - 5:00 PM".
_TRAILING_AP = re.compile(r"([AaPp])\.?[Mm]\.?\s*$")


def _hour(label: str) -> float | None:
    """
    The hour a label like "10:00 AM" or "4:00 - 5:00 PM" starts at.

    Returns None rather than a guess when the label cannot be read — a block
    drawn at the wrong hour is worse than a block in a list.

    A range usually carries its AM/PM once, at the end: "4:00 - 5:00 PM". Read
    only from the front, that is a 4 with no marker, and a yoga class at four
    in the afternoon gets drawn at four in the morning. So when the start has
    no marker of its own, the one at the end applies to it.
    """
    text = label or ""
    m = _TIME.match(text)
    if not m:
        return None
    h = int(m.group(1))
    mins = int(m.group(2) or 0)
    ap = (m.group(3) or "").lower()
    if not ap:
        tail = _TRAILING_AP.search(text)
        if tail:
            ap = tail.group(1).lower()
    if ap == "p" and h != 12:
        h += 12
    elif ap == "a" and h == 12:
        h = 0
    if not 0 <= h <= 23:
        return None
    return h + mins / 60


def _duration_hours(text: str) -> float:
    """Hours from "90 min" / "1.5 hours" / "2 hr". Defaults to one hour."""
    if not text:
        return 1.0
    t = str(text).lower()
    m = re.search(r"(\d+(?:\.\d+)?)", t)
    if not m:
        return 1.0
    n = float(m.group(1))
    if "min" in t:
        return max(0.25, n / 60)
    return max(0.25, n)


@router.get("", summary="Everything already on her calendar this week")
async def my_week(
    start: str | None = Query(None, description="ISO date of the Sunday to start from"),
    me: dict = Depends(require_active_member),
):
    db = get_database()
    uid = str(me["_id"])

    # The week she asked for, or the one containing today. Sunday-first, to
    # match the grid the screen draws.
    try:
        anchor = date.fromisoformat(start) if start else datetime.now(timezone.utc).date()
    except ValueError:
        anchor = datetime.now(timezone.utc).date()
    first = anchor - timedelta(days=(anchor.weekday() + 1) % 7)
    days = [first + timedelta(days=i) for i in range(7)]
    keys = {d.isoformat() for d in days}

    items: list[dict] = []

    # Sessions she has booked. Cancelled ones are left out — she is not
    # expected anywhere, so nothing should be drawn.
    async for b in db[BookingModel.collection_name].find({
        "user_id": uid,
        "status": {"$ne": BookingModel.STATUS_CANCELLED},
        "date": {"$in": list(keys)},
    }):
        label = b.get("time", "")
        items.append({
            "id": str(b.get("_id", "")),
            "kind": "booking",
            "title": b.get("service_name", "Session"),
            "date": b.get("date", ""),
            "time": label,
            "hour": _hour(label),
            "hours": _duration_hours(b.get("duration", "")),
            "category": "mentoring" if b.get("with_whom") else "learning",
            "icon": "UserRound" if b.get("with_whom") else "GraduationCap",
            "where": b.get("mode", ""),
            "with_whom": b.get("with_whom", ""),
            "href": "/app/bookings",
        })

    # Events she actually registered for. Browsing one is not attending it,
    # so only rows in `event_registrations` count.
    reg_ids = [r.get("event_id") async for r in db[EventRegistrationModel.collection_name].find(
        {"user_id": uid, "status": {"$ne": "cancelled"}}
    )]
    if reg_ids:
        oids = []
        for r in reg_ids:
            try:
                oids.append(ObjectId(r))
            except Exception:
                continue
        async for e in db[EventModel.collection_name].find({"_id": {"$in": oids}, "date": {"$in": list(keys)}}):
            label = e.get("time", "")
            cat = _EVENT_CATEGORY.get(str(e.get("category", "")).lower(), "community")
            items.append({
                "id": str(e.get("_id", "")),
                "kind": "event",
                "title": e.get("title", "Event"),
                "date": e.get("date", ""),
                "time": label,
                "hour": _hour(label),
                "hours": _duration_hours(e.get("duration", "")),
                "category": cat,
                "icon": "CalendarDays",
                "where": e.get("venue") or e.get("mode", ""),
                "with_whom": e.get("host", ""),
                "href": f"/app/events/{e.get('_id', '')}",
            })

    items.sort(key=lambda i: (i["date"], i["hour"] if i["hour"] is not None else 99))

    today = datetime.now(timezone.utc).date().isoformat()
    return {
        "start": first.isoformat(),
        "days": [
            {"date": d.isoformat(), "label": d.strftime("%a"), "day": d.day,
             "today": d.isoformat() == today}
            for d in days
        ],
        "items": items,
        "count": len(items),
        # Things with a readable time go in the grid; the rest are listed
        # under it rather than dropped.
        "untimed": sum(1 for i in items if i["hour"] is None),
    }
