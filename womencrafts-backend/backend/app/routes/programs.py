from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core import mongosafe
from app.core.permissions import require_permission
from app.core.deps import get_current_user
from app.core.serializers import page_meta, to_object_id
from app.db.mongodb import get_database
from app.models.program import ProgramModel
from app.routes._paging import paged
from app.schemas.program import (
    CategoryItem,
    ProgramCreate,
    ProgramListResponse,
    ProgramOverviewResponse,
    ProgramResponse,
    ProgramStatsResponse,
    ProgramUpdate,
)

router = APIRouter(prefix="/programs", tags=["Programs"])


def _programs():
    return get_database()[ProgramModel.collection_name]


# Sort labels the UI offers -> (mongo field, direction).
# "Newest First" is the default; seed docs carry descending created_at so the
# initial order matches the screen and freshly created programs surface first.
_SORTS = {
    "Newest First": ("created_at", -1),
    "Oldest First": ("created_at", 1),
    "Most Enrolled": ("enrolled", -1),
}

# Program Overview area-trend (W1..W8). This is a purely visual 8-week sparkline:
# the programs collection is a snapshot with no per-document weekly time-series to
# source it from (all seed docs share one created_at). Mirroring the dashboard's
# treatment of figures "with no matching live rollup source", it stays fixed while
# every genuinely derivable aggregate below is computed from the real documents.
_OVERVIEW_SERIES = [
    {"label": label, "value": value}
    for label, value in zip(
        ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"],
        [40, 55, 48, 70, 66, 82, 78, 90],
    )
]


# --- Rollup builders (compute the Programs KPIs/overview/categories live) -----

async def _build_stats() -> ProgramStatsResponse:
    """The 5 KPI cards, computed live from the real programs collection."""
    docs = [d async for d in _programs().find({}, {"status": 1, "enrolled": 1, "pct": 1})]
    total = len(docs)
    active = sum(1 for d in docs if d.get("status") == "Active")
    upcoming = sum(1 for d in docs if d.get("status") == "Upcoming")
    total_enrolled = sum(int(d.get("enrolled", 0)) for d in docs)
    # Completion rate = the average per-program completion (the pct field), rounded.
    completion_rate = round(sum(int(d.get("pct", 0)) for d in docs) / total) if total else 0
    return ProgramStatsResponse(
        total_programs=total,
        active_programs=active,
        upcoming_programs=upcoming,
        total_enrollments=total_enrolled,
        completion_rate=completion_rate,
    )


async def _build_overview(range: str) -> ProgramOverviewResponse:
    """The Program Overview trend + its three summary figures. The summary figures
    are computed from the real collection; the W1..W8 series is the fixed visual
    sparkline (see _OVERVIEW_SERIES)."""
    docs = [d async for d in _programs().find({}, {"status": 1, "enrolled": 1})]
    total_programs = len(docs)
    total_enrolled = sum(int(d.get("enrolled", 0)) for d in docs)
    # "Completions" ~ learners enrolled in programs that have finished.
    completed_enrolled = sum(
        int(d.get("enrolled", 0)) for d in docs if d.get("status") == "Completed"
    )
    return ProgramOverviewResponse(
        range=range,
        series=_OVERVIEW_SERIES,
        new_programs=total_programs,
        enrollments=f"+{total_enrolled}",
        completions=f"+{completed_enrolled}",
    )


async def _build_categories() -> list[CategoryItem]:
    """Top Categories rail / donut — each category's share of total enrollment,
    painted with its canonical bar colour, sorted by enrollment descending."""
    enrolled_by_cat: dict[str, int] = {}
    async for d in _programs().find({}, {"category": 1, "enrolled": 1}):
        cat = d.get("category", "")
        if not cat:
            continue
        enrolled_by_cat[cat] = enrolled_by_cat.get(cat, 0) + int(d.get("enrolled", 0))
    total = sum(enrolled_by_cat.values())
    ordered = sorted(enrolled_by_cat.items(), key=lambda kv: kv[1], reverse=True)
    return [
        CategoryItem(
            name=name,
            value=round(enrolled / total * 100) if total else 0,
            color=ProgramModel.bar_for(name),
        )
        for name, enrolled in ordered
    ]


@router.get("", response_model=ProgramListResponse, summary="List programs",
    dependencies=[Depends(require_permission("programs.view"))],
)
async def list_programs(
    q: Optional[str] = Query(None, description="Search by program name or description"),
    status: Optional[str] = Query(None, description="Filter by status"),
    category: Optional[str] = Query(None, description="Filter by category"),
    mode: Optional[str] = Query(None, description="Filter by delivery mode"),
    tab: Optional[str] = Query(None, description="Active tab; acts as an extra status gate"),
    sort: str = Query("Newest First", description="Newest First | Oldest First | Most Enrolled"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    _: dict = Depends(get_current_user),
):
    query: dict = {}
    if status and status not in ("All Status", "all"):
        query["status"] = status
    if category and category not in ("All Categories", "all"):
        query["category"] = category
    if mode and mode not in ("All Modes", "all"):
        query["mode"] = mode
    # The tab is an additional status gate (All Programs = no gate).
    if tab and tab not in ("All Programs", "all"):
        query["status"] = tab
    if q and q.strip():
        query.update(mongosafe.any_of(q, ["name", "desc"]))

    field, direction = _SORTS.get(sort, _SORTS["Newest First"])
    total, docs = await paged(
        _programs(), query,
        sort=field, direction=direction, page=page, page_size=page_size,
    )
    items = [ProgramModel.to_response(doc) for doc in docs]
    return ProgramListResponse(items=items, **page_meta(total, page, page_size))


@router.get("/stats", response_model=ProgramStatsResponse, summary="Program KPI cards",
    dependencies=[Depends(require_permission("programs.view"))],
)
async def program_stats(_: dict = Depends(get_current_user)):
    return await _build_stats()


@router.get("/overview", response_model=ProgramOverviewResponse, summary="Program overview trend",
    dependencies=[Depends(require_permission("programs.view"))],
)
async def program_overview(
    range: str = Query("This Month", description="This Week | This Month | This Quarter | This Year"),
    _: dict = Depends(get_current_user),
):
    return await _build_overview(range)


@router.get("/categories", response_model=list[CategoryItem], summary="Top categories rail",
    dependencies=[Depends(require_permission("programs.view"))],
)
async def program_categories(_: dict = Depends(get_current_user)):
    return await _build_categories()


@router.post("", response_model=ProgramResponse, status_code=status.HTTP_201_CREATED, summary="Create a program", dependencies=[Depends(require_permission("programs.create"))])
async def create_program(payload: ProgramCreate, _: dict = Depends(get_current_user)):
    dates = payload.startDate.strip() or "To be scheduled"
    note = "Coming soon" if payload.status == "Upcoming" else payload.status
    doc = ProgramModel.create_document(
        name=payload.name,
        desc=payload.desc.strip() or "New program.",
        category=payload.category,
        mode=payload.mode,
        duration=payload.duration.strip() or "—",
        dates=dates,
        days=payload.days.strip() or "—",
        enrolled=0,
        cap=payload.cap,
        pct=0,
        status=payload.status,
        note=note,
    )
    result = await _programs().insert_one(doc)
    doc["_id"] = result.inserted_id
    return ProgramResponse(**ProgramModel.to_response(doc))


@router.get("/{program_id}", response_model=ProgramResponse, summary="Get a program",
    dependencies=[Depends(require_permission("programs.view"))],
)
async def get_program(program_id: str, _: dict = Depends(get_current_user)):
    doc = await _programs().find_one({"_id": to_object_id(program_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Program not found")
    return ProgramResponse(**ProgramModel.to_response(doc))


@router.patch("/{program_id}", response_model=ProgramResponse, summary="Update a program", dependencies=[Depends(require_permission("programs.edit"))])
async def update_program(program_id: str, payload: ProgramUpdate, _: dict = Depends(get_current_user)):
    oid = to_object_id(program_id)
    doc = await _programs().find_one({"_id": oid})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Program not found")

    updates = payload.model_dump(exclude_unset=True)

    # startDate maps onto the display 'dates' string; blank leaves it as-is.
    if "startDate" in updates:
        start = (updates.pop("startDate") or "").strip()
        if start:
            updates["dates"] = start

    # Changing the category re-derives its badge tone and progress-bar colour.
    if updates.get("category"):
        updates["cat_tone"] = ProgramModel.tone_for(updates["category"])
        updates["bar"] = ProgramModel.bar_for(updates["category"])

    # Recompute pct from the final enrolled/cap (only when a real cap exists).
    enrolled = updates.get("enrolled", doc.get("enrolled", 0))
    cap = updates.get("cap", doc.get("cap", 0))
    if cap:
        updates["pct"] = round(enrolled / cap * 100)

    updates["updated_at"] = datetime.now(timezone.utc)
    doc = await _programs().find_one_and_update(
        {"_id": oid},
        {"$set": updates},
        return_document=True,
    )
    return ProgramResponse(**ProgramModel.to_response(doc))


@router.delete("/{program_id}", summary="Delete a program", dependencies=[Depends(require_permission("programs.delete"))])
async def delete_program(program_id: str, _: dict = Depends(get_current_user)):
    result = await _programs().delete_one({"_id": to_object_id(program_id)})
    if result.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Program not found")
    return {"message": "Program deleted"}


@router.post("/{program_id}/complete", response_model=ProgramResponse, summary="Mark a program completed", dependencies=[Depends(require_permission("programs.edit"))])
async def complete_program(program_id: str, _: dict = Depends(get_current_user)):
    oid = to_object_id(program_id)
    doc = await _programs().find_one_and_update(
        {"_id": oid},
        {"$set": {"status": "Completed", "note": "Completed", "pct": 100, "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Program not found")
    return ProgramResponse(**ProgramModel.to_response(doc))


@router.post("/{program_id}/archive", response_model=ProgramResponse, summary="Archive a program", dependencies=[Depends(require_permission("programs.edit"))])
async def archive_program(program_id: str, _: dict = Depends(get_current_user)):
    oid = to_object_id(program_id)
    doc = await _programs().find_one_and_update(
        {"_id": oid},
        {"$set": {"status": "Archived", "note": "Archived", "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Program not found")
    return ProgramResponse(**ProgramModel.to_response(doc))


# --- Seed --------------------------------------------------------------------
# The exact five programs the UI renders today (PROGRAMS array on the screen).
_PROGRAMS = [
    dict(name="Digital Skills for Women", desc="Empowering women with essential digital skills for the modern world.", category="Digital Literacy", catTone="violet", mode="Online", duration="8 Weeks", dates="May 15 - Jul 10, 2024", days="Mon, Wed, Fri", enrolled=156, cap=200, pct=78, status="Active", note="Ongoing", bar="#8b5cf6"),
    dict(name="Entrepreneurship Bootcamp", desc="Learn to build, launch and grow your own successful business.", category="Entrepreneurship", catTone="brand", mode="Hybrid", duration="10 Weeks", dates="Jun 01 - Aug 10, 2024", days="Sat, Sun", enrolled=98, cap=150, pct=65, status="Active", note="Ongoing", bar="#22c55e"),
    dict(name="Handicrafts Mastery Program", desc="Advanced techniques in traditional and modern handicrafts.", category="Handicrafts", catTone="amber", mode="Offline", duration="6 Weeks", dates="Jul 05 - Aug 15, 2024", days="Tue, Thu, Sat", enrolled=45, cap=60, pct=75, status="Upcoming", note="Starts in 12 days", bar="#f59e0b"),
    dict(name="Leadership for Change", desc="Build leadership skills and drive positive change in your community.", category="Personal Development", catTone="sky", mode="Online", duration="6 Weeks", dates="Aug 20 - Sep 30, 2024", days="Mon, Wed", enrolled=0, cap=100, pct=0, status="Upcoming", note="Starts in 58 days", bar="#3b82f6"),
    dict(name="Sustainable Fashion Workshop", desc="Learn sustainable fashion practices and eco-friendly designs.", category="Sustainability", catTone="emerald", mode="Offline", duration="4 Weeks", dates="Mar 10 - Apr 05, 2024", days="Sat, Sun", enrolled=120, cap=120, pct=100, status="Completed", note="Completed", bar="#22c55e"),
]


async def seed() -> None:
    """Seed the programs collection with the exact UI mock data, only if empty."""
    db = get_database()
    if await db[ProgramModel.collection_name].count_documents({}) == 0:
        base = datetime.now(timezone.utc)
        docs = [
            ProgramModel.create_document(
                name=p["name"], desc=p["desc"], category=p["category"], cat_tone=p["catTone"],
                mode=p["mode"], duration=p["duration"], dates=p["dates"], days=p["days"],
                enrolled=p["enrolled"], cap=p["cap"], pct=p["pct"], status=p["status"],
                note=p["note"], bar=p["bar"],
                # Descending created_at preserves the on-screen order for "Newest First".
                created_at=base - timedelta(seconds=i),
            )
            for i, p in enumerate(_PROGRAMS)
        ]
        await db[ProgramModel.collection_name].insert_many(docs)
        print(f"🌱 Seeded {len(docs)} programs")
