import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core import mongosafe
from app.core.deps import get_current_user
from app.core.serializers import page_meta
from app.core.permissions import require_permission
from app.db.mongodb import get_database
from app.models.calendar import CalendarEventModel
from app.schemas.calendar import (
    CalendarEventCreate,
    CalendarEventListResponse,
    CalendarEventResponse,
    CalendarEventUpdate,
    CalendarStatsResponse,
)

router = APIRouter(prefix="/calendar", tags=["Calendar"])


def _events():
    return get_database()[CalendarEventModel.collection_name]


def _to_datetime(value: str) -> datetime:
    """Parse a 'YYYY-MM-DD' day string into a midnight-UTC datetime, else 422."""
    try:
        return datetime.strptime(value, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Date must be in YYYY-MM-DD format"
        )


def _minutes(time: str) -> int:
    """Turn a loose 'H:MM' time into minutes-past-midnight for chronological sort.

    Events with no time sort to the end of their day.
    """
    match = re.match(r"^(\d{1,2}):(\d{2})", time or "")
    if not match:
        return 24 * 60
    return int(match.group(1)) * 60 + int(match.group(2))


def _sort_key(doc: dict):
    date = doc.get("date") or datetime.min.replace(tzinfo=timezone.utc)
    return (date, _minutes(doc.get("time", "")))


async def _next_id() -> int:
    """Next integer event id — floored at 100 to mirror the frontend's numbering."""
    highest = 99
    async for doc in _events().find({}, {"event_id": 1}):
        eid = doc.get("event_id")
        if isinstance(eid, int):
            highest = max(highest, eid)
    return highest + 1


@router.get("/events", response_model=CalendarEventListResponse, summary="List calendar events",
    dependencies=[Depends(require_permission("calendar.view"))],
)
async def list_events(
    category: Optional[str] = Query(None, description="Filter by legend category"),
    start: Optional[str] = Query(None, description="Window start (YYYY-MM-DD, inclusive)"),
    end: Optional[str] = Query(None, description="Window end (YYYY-MM-DD, inclusive)"),
    q: Optional[str] = Query(None, description="Search by title or attendee"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    _: dict = Depends(get_current_user),
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
    page_slice = docs[(page - 1) * page_size : (page - 1) * page_size + page_size]
    items = [CalendarEventModel.to_response(doc) for doc in page_slice]
    return CalendarEventListResponse(items=items, **page_meta(total, page, page_size))


@router.get(
    "/events/upcoming",
    response_model=list[CalendarEventResponse],
    summary="Upcoming events for the sidebar",
    dependencies=[Depends(require_permission("calendar.view"))],
)
async def upcoming_events(
    after: str = Query("2024-05-20", description="Include events on/after this day (YYYY-MM-DD)"),
    limit: int = Query(4, ge=1, le=50),
    _: dict = Depends(get_current_user),
):
    after_dt = _to_datetime(after)
    docs = [doc async for doc in _events().find({"date": {"$gte": after_dt}})]
    docs.sort(key=_sort_key)
    return [CalendarEventModel.to_response(doc) for doc in docs[:limit]]


@router.get("/events/stats", response_model=CalendarStatsResponse, summary="Per-category event counts",
    dependencies=[Depends(require_permission("calendar.view"))],
)
async def event_stats(_: dict = Depends(get_current_user)):
    docs = [doc async for doc in _events().find({})]
    by_category: dict[str, int] = {}
    for doc in docs:
        cat = doc.get("category", "")
        by_category[cat] = by_category.get(cat, 0) + 1
    return CalendarStatsResponse(total=len(docs), by_category=by_category)


@router.post(
    "/events",
    response_model=CalendarEventResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a calendar event",
    dependencies=[Depends(require_permission("calendar.create"))],
)
async def create_event(payload: CalendarEventCreate, _: dict = Depends(get_current_user)):
    doc = CalendarEventModel.create_document(
        event_id=await _next_id(),
        title=payload.title,
        category=payload.category,
        date=_to_datetime(payload.date),
        time=payload.time,
        attendee=payload.attendee,
        notes=payload.notes,
    )
    result = await _events().insert_one(doc)
    doc["_id"] = result.inserted_id
    return CalendarEventResponse(**CalendarEventModel.to_response(doc))


@router.get("/events/{event_id}", response_model=CalendarEventResponse, summary="Get an event",
    dependencies=[Depends(require_permission("calendar.view"))],
)
async def get_event(event_id: int, _: dict = Depends(get_current_user)):
    doc = await _events().find_one({"event_id": event_id})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    return CalendarEventResponse(**CalendarEventModel.to_response(doc))


@router.patch("/events/{event_id}", response_model=CalendarEventResponse, summary="Update an event",
    dependencies=[Depends(require_permission("calendar.edit"))],
)
async def update_event(event_id: int, payload: CalendarEventUpdate, _: dict = Depends(get_current_user)):
    updates = payload.model_dump(exclude_unset=True)

    if "date" in updates:
        updates["date"] = _to_datetime(updates["date"])
    if "category" in updates:
        # keep the dot colour in step with the category, like the UI preset
        updates["color"] = CalendarEventModel.CATEGORY_COLORS.get(updates["category"], "#f9a8ce")

    updates["updated_at"] = datetime.now(timezone.utc)
    doc = await _events().find_one_and_update(
        {"event_id": event_id},
        {"$set": updates},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    return CalendarEventResponse(**CalendarEventModel.to_response(doc))


@router.delete("/events/{event_id}", summary="Delete an event",
    dependencies=[Depends(require_permission("calendar.delete"))],
)
async def delete_event(event_id: int, _: dict = Depends(get_current_user)):
    result = await _events().delete_one({"event_id": event_id})
    if result.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    return {"message": "Event deleted"}


async def seed() -> None:
    """Seed the exact events shown on the Calendar screen, only if empty."""
    events = _events()
    if await events.count_documents({}) > 0:
        return

    def day(year: int, month: int, d: int) -> datetime:
        return datetime(year, month, d, tzinfo=timezone.utc)

    # Transcribed verbatim from INITIAL_EVENTS on the Calendar page (May 2024).
    records = [
        dict(event_id=1, title="Career Counseling", category="Career", date=day(2024, 5, 20), time="9:00", attendee="Priya Sharma", notes=""),
        dict(event_id=2, title="Skill Workshop", category="Skills", date=day(2024, 5, 20), time="10:15", attendee="Aisha Khan", notes=""),
        dict(event_id=3, title="Business Consult", category="Business", date=day(2024, 5, 21), time="1:30", attendee="Sneha Joshi", notes=""),
        dict(event_id=4, title="Handicraft Training", category="Skills", date=day(2024, 5, 22), time="", attendee="Kavita Rao", notes=""),
        dict(event_id=5, title="Financial Literacy", category="Finance", date=day(2024, 5, 24), time="3:00", attendee="Rekha Nair", notes=""),
    ]
    docs = [CalendarEventModel.create_document(**r) for r in records]
    await events.insert_many(docs)
    print(f"🌱 Seeded {len(docs)} calendar events")
