"""
Calendar — everything that has a date, on one grid.

── What changed and why ───────────────────────────────────────────────────
The calendar lived in May 2024: the screen's "today" was a constant, the
upcoming list defaulted to 2024-05-20, and the only rows were five seeded
appointments with invented attendees. Meanwhile the platform held 139 real
bookings, 31 published events and 28 programmes with dates, none of which
the calendar showed.

Now `/calendar/agenda` merges the real dated collections — member bookings,
community events, programme start and end dates — with the staff's own
calendar entries, for whatever window the screen is looking at. Staff
entries keep their create/edit/delete, guarded and audited. Nothing else on
the grid is editable here: a booking is changed on Appointments, an event on
Events, a programme on Programmes, and each item links there.
"""

import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.core import mongosafe
from app.core.audit import record
from app.core.deps import get_current_user
from app.core.permissions import require_permission
from app.core.serializers import page_meta
from app.db.mongodb import get_database
from app.models.calendar import CalendarEventModel
from app.schemas.calendar import (
    AgendaResponse,
    CalendarEventCreate,
    CalendarEventListResponse,
    CalendarEventResponse,
    CalendarEventUpdate,
    CalendarStatsResponse,
)

router = APIRouter(prefix="/calendar", tags=["Calendar"])

SOURCE_COLORS = {
    "booking": "#e6117e",     # brand
    "event": "#8b5cf6",       # violet
    "programme": "#22c55e",   # emerald
    "staff": "#3b82f6",       # sky
}


def _events():
    return get_database()[CalendarEventModel.collection_name]


def _to_datetime(value: str) -> datetime:
    """Parse a 'YYYY-MM-DD' day string into a midnight-UTC datetime, else 422."""
    try:
        return datetime.strptime(value, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Date must be in YYYY-MM-DD format")


def _minutes(time: str) -> int:
    """Minutes past midnight from a loose 'H:MM' or 'H:MM AM' time; blanks sort last."""
    match = re.match(r"^\s*(\d{1,2}):(\d{2})\s*([AaPp][Mm])?", time or "")
    if not match:
        return 24 * 60
    h, m = int(match.group(1)), int(match.group(2))
    ampm = (match.group(3) or "").upper()
    if ampm == "PM" and h < 12:
        h += 12
    if ampm == "AM" and h == 12:
        h = 0
    return h * 60 + m


def _sort_key(doc: dict):
    date = doc.get("date") or datetime.min.replace(tzinfo=timezone.utc)
    return (date, _minutes(doc.get("time", "")))


async def _next_id() -> int:
    highest = 99
    async for doc in _events().find({}, {"event_id": 1}):
        eid = doc.get("event_id")
        if isinstance(eid, int):
            highest = max(highest, eid)
    return highest + 1


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


# --- The merged agenda ------------------------------------------------------------------
_PROGRAMME_DATES = re.compile(r"^\s*([A-Za-z]{3})\s+(\d{1,2})\s*[-–]\s*([A-Za-z]{3})\s+(\d{1,2}),\s*(\d{4})\s*$")


def _programme_span(label: str) -> Optional[tuple[str, str]]:
    """'Aug 12 - Sep 09, 2026' → ('2026-08-12', '2026-09-09'); anything else → None."""
    m = _PROGRAMME_DATES.match(label or "")
    if not m:
        return None
    try:
        year = int(m.group(5))
        start = datetime.strptime(f"{m.group(1)} {m.group(2)} {year}", "%b %d %Y")
        end = datetime.strptime(f"{m.group(3)} {m.group(4)} {year}", "%b %d %Y")
        if end < start:  # a span that crosses the new year
            end = end.replace(year=year + 1)
        return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
    except ValueError:
        return None


async def _people() -> dict[str, str]:
    out: dict[str, str] = {}
    async for m in get_database()["members"].find({}, {"full_name": 1}):
        out[str(m["_id"])] = m.get("full_name", "")
    async for u in get_database()["users"].find({}, {"full_name": 1}):
        out.setdefault(str(u["_id"]), u.get("full_name", ""))
    return out


async def _agenda(start: str, end: str, sources: set[str]) -> tuple[list[dict], dict[str, int]]:
    items: list[dict] = []
    db = get_database()

    if "booking" in sources:
        people = await _people()
        async for b in db["bookings"].find({"date": {"$gte": start, "$lte": end}}):
            who = people.get(str(b.get("member_id") or "")) or people.get(str(b.get("user_id") or "")) or "Member"
            items.append({
                "key": f"booking:{b['_id']}", "source": "booking", "title": b.get("service_name") or "Booking",
                "date": b.get("date", ""), "time": b.get("time", ""), "subtitle": who,
                "status": b.get("status", ""), "href": "/dashboard/appointments",
                "category": "Bookings", "color": SOURCE_COLORS["booking"],
            })

    if "event" in sources:
        async for e in db["events"].find({"date": {"$gte": start, "$lte": end}}):
            items.append({
                "key": f"event:{e['_id']}", "source": "event", "title": e.get("title", "Event"),
                "date": e.get("date", ""), "time": e.get("time", ""),
                "subtitle": e.get("location") or e.get("mode") or "",
                "status": e.get("status", ""), "href": "/dashboard/events",
                "category": "Events", "color": SOURCE_COLORS["event"],
            })

    if "programme" in sources:
        async for p in db["programs"].find({}, {"name": 1, "dates": 1, "status": 1, "days": 1}):
            span = _programme_span(p.get("dates", ""))
            if not span:
                continue
            for label, day in (("starts", span[0]), ("ends", span[1])):
                if start <= day <= end:
                    items.append({
                        "key": f"programme:{p['_id']}:{label}", "source": "programme",
                        "title": f"{p.get('name', 'Programme')} {label}", "date": day, "time": "",
                        "subtitle": p.get("days") or "", "status": p.get("status", ""),
                        "href": "/dashboard/programs", "category": "Programmes", "color": SOURCE_COLORS["programme"],
                    })

    if "staff" in sources:
        async for s in _events().find({"date": {"$gte": _to_datetime(start), "$lte": _to_datetime(end)}}):
            r = CalendarEventModel.to_response(s)
            items.append({
                "key": f"staff:{r['id']}", "source": "staff", "title": r["title"], "date": r["date"],
                "time": r["time"], "subtitle": r["attendee"], "status": "", "href": "",
                "category": r["category"] or "Staff", "color": r["color"] or SOURCE_COLORS["staff"],
            })

    items.sort(key=lambda i: (i["date"], _minutes(i["time"]), i["title"]))
    counts: dict[str, int] = {}
    for i in items:
        counts[i["source"]] = counts.get(i["source"], 0) + 1
    return items, counts


@router.get("/agenda", response_model=AgendaResponse, summary="Everything dated in a window: bookings, events, programmes, staff entries",
    dependencies=[Depends(require_permission("calendar.view"))],
)
async def agenda(
    start: str = Query(..., description="YYYY-MM-DD inclusive"),
    end: str = Query(..., description="YYYY-MM-DD inclusive"),
    sources: str = Query("booking,event,programme,staff", description="Comma-separated subset"),
):
    _to_datetime(start); _to_datetime(end)
    if end < start:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "end is before start")
    if (_to_datetime(end) - _to_datetime(start)).days > 62:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Ask for at most two months at a time")
    wanted = {s.strip() for s in sources.split(",") if s.strip() in SOURCE_COLORS}
    items, counts = await _agenda(start, end, wanted)
    return AgendaResponse(start=start, end=end, items=items, counts=counts)


@router.get("/upcoming", response_model=AgendaResponse, summary="The next things on the calendar, from today",
    dependencies=[Depends(require_permission("calendar.view"))],
)
async def upcoming(days: int = Query(30, ge=1, le=62), limit: int = Query(8, ge=1, le=50)):
    start = _today()
    end = (datetime.now(timezone.utc) + timedelta(days=days)).strftime("%Y-%m-%d")
    items, counts = await _agenda(start, end, set(SOURCE_COLORS))
    return AgendaResponse(start=start, end=end, items=items[:limit], counts=counts)


# --- Staff entries: the one thing this screen owns ----------------------------------------
@router.get("/events", response_model=CalendarEventListResponse, summary="List staff calendar entries",
    dependencies=[Depends(require_permission("calendar.view"))],
)
async def list_events(
    category: Optional[str] = Query(None),
    start: Optional[str] = Query(None, description="YYYY-MM-DD inclusive"),
    end: Optional[str] = Query(None, description="YYYY-MM-DD inclusive"),
    q: Optional[str] = Query(None, description="Search by title or attendee"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
):
    query: dict = {}
    if category and category not in ("All Categories", "all", "All"):
        query["category"] = category
    date_window: dict = {}
    if start:
        date_window["$gte"] = _to_datetime(start)
    if end:
        date_window["$lte"] = _to_datetime(end)
    if date_window:
        query["date"] = date_window
    if q and q.strip():
        query.update(mongosafe.any_of(q, ["title", "attendee"]))
    docs = [doc async for doc in _events().find(query)]
    docs.sort(key=_sort_key)
    total = len(docs)
    page_slice = docs[(page - 1) * page_size:(page - 1) * page_size + page_size]
    return CalendarEventListResponse(items=[CalendarEventModel.to_response(d) for d in page_slice], **page_meta(total, page, page_size))


@router.get("/events/upcoming", response_model=list[CalendarEventResponse], summary="Upcoming staff entries",
    dependencies=[Depends(require_permission("calendar.view"))],
)
async def upcoming_events(after: Optional[str] = Query(None, description="YYYY-MM-DD; defaults to today"), limit: int = Query(4, ge=1, le=50)):
    after_dt = _to_datetime(after or _today())
    docs = [doc async for doc in _events().find({"date": {"$gte": after_dt}})]
    docs.sort(key=_sort_key)
    return [CalendarEventModel.to_response(doc) for doc in docs[:limit]]


@router.get("/events/stats", response_model=CalendarStatsResponse, summary="Per-category counts of staff entries",
    dependencies=[Depends(require_permission("calendar.view"))],
)
async def event_stats():
    by_category: dict[str, int] = {}
    total = 0
    async for doc in _events().find({}, {"category": 1}):
        total += 1
        by_category[doc.get("category", "")] = by_category.get(doc.get("category", ""), 0) + 1
    return CalendarStatsResponse(total=total, by_category=by_category)


@router.post("/events", response_model=CalendarEventResponse, status_code=status.HTTP_201_CREATED, summary="Create a staff calendar entry",
    dependencies=[Depends(require_permission("calendar.create"))],
)
async def create_event(payload: CalendarEventCreate, request: Request, me: dict = Depends(get_current_user)):
    doc = CalendarEventModel.create_document(
        event_id=await _next_id(), title=payload.title, category=payload.category,
        date=_to_datetime(payload.date), time=payload.time, attendee=payload.attendee, notes=payload.notes,
    )
    doc["created_by"] = str(me.get("_id", ""))
    doc["created_by_name"] = me.get("full_name", "") or me.get("email", "")
    result = await _events().insert_one(doc)
    doc["_id"] = result.inserted_id
    await record(me, "calendar.create", target=str(doc["event_id"]),
                 detail=f"Added '{payload.title}' on {payload.date}{' at ' + payload.time if payload.time else ''}", request=request)
    return CalendarEventResponse(**CalendarEventModel.to_response(doc))


@router.get("/events/{event_id}", response_model=CalendarEventResponse, summary="Get a staff entry",
    dependencies=[Depends(require_permission("calendar.view"))],
)
async def get_event(event_id: int):
    doc = await _events().find_one({"event_id": event_id})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    return CalendarEventResponse(**CalendarEventModel.to_response(doc))


@router.patch("/events/{event_id}", response_model=CalendarEventResponse, summary="Update a staff entry",
    dependencies=[Depends(require_permission("calendar.edit"))],
)
async def update_event(event_id: int, payload: CalendarEventUpdate, request: Request, me: dict = Depends(get_current_user)):
    updates = payload.model_dump(exclude_unset=True)
    if "date" in updates:
        updates["date"] = _to_datetime(updates["date"])
    if "category" in updates:
        updates["color"] = CalendarEventModel.CATEGORY_COLORS.get(updates["category"], "#f9a8ce")
    updates["updated_at"] = datetime.now(timezone.utc)
    doc = await _events().find_one_and_update({"event_id": event_id}, {"$set": updates}, return_document=True)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    changed = sorted(k for k in updates if k not in ("updated_at", "color"))
    await record(me, "calendar.edit", target=str(event_id), detail=f"Edited '{doc.get('title', '')}': {', '.join(changed) or 'nothing'}", request=request)
    return CalendarEventResponse(**CalendarEventModel.to_response(doc))


@router.delete("/events/{event_id}", summary="Delete a staff entry",
    dependencies=[Depends(require_permission("calendar.delete"))],
)
async def delete_event(event_id: int, request: Request, me: dict = Depends(get_current_user)):
    doc = await _events().find_one({"event_id": event_id})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    await _events().delete_one({"_id": doc["_id"]})
    await record(me, "calendar.delete", target=str(event_id), detail=f"Deleted '{doc.get('title', '')}'", request=request)
    return {"message": "Event deleted"}


async def seed() -> None:
    """Nothing to seed: the grid is fed by the real bookings, events and programmes."""
    return None
