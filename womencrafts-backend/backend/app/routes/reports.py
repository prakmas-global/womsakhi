import csv
import io
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response

from app.core import mongosafe
from app.core.deps import get_current_user
from app.core.serializers import page_meta, to_object_id
from app.core.permissions import require_permission
from app.db.mongodb import get_database
from app.models.report import ReportModel, ReportsOverviewModel
from app.routes._paging import paged
from app.schemas.report import (
    RecentReportResponse,
    ReportCreate,
    ReportListResponse,
    ReportResponse,
    ReportsOverviewResponse,
    ReportUpdate,
    ScheduledReportResponse,
    TemplateResponse,
)

router = APIRouter(prefix="/reports", tags=["Reports"])


def _reports():
    return get_database()[ReportModel.collection_name]


def _overview():
    return get_database()[ReportsOverviewModel.collection_name]


def _build_query(q: Optional[str], category: Optional[str], type_: Optional[str]) -> dict:
    """Shared filter used by the list and the CSV export."""
    query: dict = {}
    if category and category not in ("All Categories", "all"):
        query["category"] = category
    if type_ and type_ not in ("All Types", "all"):
        query["type"] = type_
    if q and q.strip():
        query.update(mongosafe.any_of(q, ["name", "description", "category"]))
    return query


# category -> donut ring colour (mirrors the UI's CAT_META tone palette).
_CATEGORY_COLORS = {
    "User Activity": "#8b5cf6",
    "Appointments": "#3b82f6",
    "Program & Services": "#22c55e",
    "Financial": "#f59e0b",
    "Marketing": "#f43f5e",
    "Others": "#cbd5e1",
}


async def _build_overview() -> dict:
    """
    Stat-card + widget numbers for /stats. Everything with a per-report source is
    computed live from the real `reports` collection:

        total_reports      -> reports.count
        scheduled_reports  -> reports where scheduled == True
        reports_generated  -> reports that have actually been generated
                              (a non-empty last_generated stamp)
        top_categories     -> real per-category distribution (donut/bars)

    The rate/trend figures that have NO per-report source (deltas, average
    generation time, data-points totals, the two trend series) are read verbatim
    from the seeded reports_overview snapshot.
    """
    overview = ReportsOverviewModel.to_response(await _overview().find_one({}) or {})

    docs = [
        d
        async for d in _reports().find(
            {}, {"category": 1, "scheduled": 1, "last_generated": 1}
        )
    ]
    total = len(docs)
    scheduled = sum(1 for d in docs if d.get("scheduled"))
    generated = sum(1 for d in docs if str(d.get("last_generated", "")).strip())

    counts: dict[str, int] = {}
    for d in docs:
        cat = d.get("category", "Others")
        counts[cat] = counts.get(cat, 0) + 1

    def _cat_rank(name: str) -> int:
        return (
            ReportModel.CATEGORIES.index(name)
            if name in ReportModel.CATEGORIES
            else len(ReportModel.CATEGORIES)
        )

    # Highest count first; ties fall back to the canonical category order.
    ordered = sorted(counts.items(), key=lambda kv: (-kv[1], _cat_rank(kv[0])))
    top_categories = [
        {"name": name, "value": val, "color": _CATEGORY_COLORS.get(name, "#cbd5e1")}
        for name, val in ordered
    ]

    overview.update(
        total_reports=total,
        scheduled_reports=scheduled,
        reports_generated=generated,
        top_categories=top_categories,
    )
    return overview


def _now_stamp() -> str:
    """Format 'now' as the UI's 'May 20, 2024 10:30 AM' last-generated string."""
    now = datetime.now(timezone.utc)
    hour = now.hour % 12 or 12
    ampm = "AM" if now.hour < 12 else "PM"
    return f"{now.strftime('%b')} {now.day}, {now.year} {hour:02d}:{now.minute:02d} {ampm}"


# --- list + overview + side panels -------------------------------------------
@router.get("", response_model=ReportListResponse, summary="List reports",
    dependencies=[Depends(require_permission("reports.view"))],
)
async def list_reports(
    q: Optional[str] = Query(None, description="Search by name, description or category"),
    category: Optional[str] = Query(None, description="Filter by category"),
    type: Optional[str] = Query(None, description="Filter by type"),
    page: int = Query(1, ge=1),
    page_size: int = Query(6, ge=1, le=100),
    _: dict = Depends(get_current_user),
):
    query = _build_query(q, category, type)
    # Footer total is the real number of reports matching the filter — and it
    # arrives with the page rather than costing a second trip to fetch.
    total, docs = await paged(
        _reports(), query,
        sort="created_at", direction=-1, page=page, page_size=page_size,
    )
    items = [ReportModel.to_response(doc) for doc in docs]
    return ReportListResponse(items=items, **page_meta(total, page, page_size))


@router.get("/stats", response_model=ReportsOverviewResponse, summary="Stat cards + overview widgets",
    dependencies=[Depends(require_permission("reports.view"))],
)
async def report_stats(_: dict = Depends(get_current_user)):
    return ReportsOverviewResponse(**await _build_overview())


@router.get("/recent", response_model=list[RecentReportResponse], summary="Recent Reports panel",
    dependencies=[Depends(require_permission("reports.view"))],
)
async def recent_reports(
    limit: int = Query(4, ge=1, le=50),
    _: dict = Depends(get_current_user),
):
    cursor = _reports().find({}).sort("created_at", -1).limit(limit)
    return [
        RecentReportResponse(
            name=doc.get("name", ""),
            last_generated=doc.get("last_generated", ""),
            icon=doc.get("icon", "Sparkles"),
        )
        async for doc in cursor
    ]


@router.get("/scheduled", response_model=list[ScheduledReportResponse], summary="Scheduled Reports panel",
    dependencies=[Depends(require_permission("reports.view"))],
)
async def scheduled_reports(_: dict = Depends(get_current_user)):
    cursor = _reports().find({"scheduled": True}).sort("created_at", -1)
    return [
        ScheduledReportResponse(
            name=doc.get("name", ""),
            schedule_detail=doc.get("schedule_detail", ""),
            status="Active",
        )
        async for doc in cursor
    ]


@router.get("/templates", response_model=list[TemplateResponse], summary="Manage Templates modal",
    dependencies=[Depends(require_permission("reports.view"))],
)
async def report_templates(_: dict = Depends(get_current_user)):
    """One reusable template per category, derived like the UI's Templates modal."""
    return [
        TemplateResponse(
            category=cat,
            name=f"{cat} Template",
            description=f"Reusable layout for {cat.lower()} reports",
            tone=ReportModel.tone_for(cat),
            icon=ReportModel.icon_for(cat),
            status="Active",
        )
        for cat in ReportModel.CATEGORIES
    ]


@router.get("/export", summary="Export filtered reports as CSV",
    dependencies=[Depends(require_permission("reports.export"))],
)
async def export_reports(
    q: Optional[str] = Query(None, description="Search by name, description or category"),
    category: Optional[str] = Query(None, description="Filter by category"),
    type: Optional[str] = Query(None, description="Filter by type"),
    _: dict = Depends(get_current_user),
):
    query = _build_query(q, category, type)
    header = ["Report Name", "Description", "Category", "Type", "Schedule", "Last Generated", "Created By"]

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(header)
    async for doc in _reports().find(query).sort("created_at", -1):
        writer.writerow([
            doc.get("name", ""),
            doc.get("description", ""),
            doc.get("category", ""),
            doc.get("type", ""),
            doc.get("schedule", ""),
            doc.get("last_generated", ""),
            doc.get("created_by", ""),
        ])

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="reports-export.csv"'},
    )


# --- create ------------------------------------------------------------------
@router.post("", response_model=ReportResponse, status_code=status.HTTP_201_CREATED, summary="Create a report",
    dependencies=[Depends(require_permission("reports.create"))],
)
async def create_report(payload: ReportCreate, _: dict = Depends(get_current_user)):
    category = payload.category or "Others"
    doc = ReportModel.create_document(
        name=payload.name,
        description=payload.description,
        category=category,
        type=payload.type or "Summary",
        schedule=payload.schedule or "On Demand",
        last_generated="May 21, 2024 10:00 AM",
        created_by="Admin User",
    )
    result = await _reports().insert_one(doc)
    doc["_id"] = result.inserted_id
    return ReportResponse(**ReportModel.to_response(doc))


# --- detail / edit / delete / run --------------------------------------------
@router.get("/{report_id}", response_model=ReportResponse, summary="Get a report",
    dependencies=[Depends(require_permission("reports.view"))],
)
async def get_report(report_id: str, _: dict = Depends(get_current_user)):
    doc = await _reports().find_one({"_id": to_object_id(report_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report not found")
    return ReportResponse(**ReportModel.to_response(doc))


@router.put("/{report_id}", response_model=ReportResponse, summary="Update a report",
    dependencies=[Depends(require_permission("reports.create"))],
)
async def update_report(report_id: str, payload: ReportUpdate, _: dict = Depends(get_current_user)):
    oid = to_object_id(report_id)
    updates = payload.model_dump(exclude_unset=True)

    # Changing the category re-derives its badge tone and row icon (as in the UI).
    if updates.get("category"):
        updates["tone"] = ReportModel.tone_for(updates["category"])
        updates["icon"] = ReportModel.icon_for(updates["category"])

    updates["updated_at"] = datetime.now(timezone.utc)
    doc = await _reports().find_one_and_update(
        {"_id": oid},
        {"$set": updates},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report not found")
    return ReportResponse(**ReportModel.to_response(doc))


@router.delete("/{report_id}", summary="Delete a report",
    dependencies=[Depends(require_permission("reports.create"))],
)
async def delete_report(report_id: str, _: dict = Depends(get_current_user)):
    result = await _reports().delete_one({"_id": to_object_id(report_id)})
    if result.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report not found")
    return {"message": "Report deleted"}


@router.post("/{report_id}/run", response_model=ReportResponse, summary="Regenerate a report now",
    dependencies=[Depends(require_permission("reports.create"))],
)
async def run_report(report_id: str, _: dict = Depends(get_current_user)):
    oid = to_object_id(report_id)
    doc = await _reports().find_one_and_update(
        {"_id": oid},
        {"$set": {"last_generated": _now_stamp(), "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report not found")
    return ReportResponse(**ReportModel.to_response(doc))


# --- seed --------------------------------------------------------------------
# The exact six reports the UI renders today (INITIAL_REPORTS on the screen),
# plus the single Reports Overview snapshot feeding the stat cards + widgets.
# The three "scheduled" rows carry the schedule_detail strings from the
# Scheduled Reports panel; the others are one-off / on-demand.
_REPORTS = [
    dict(name="User Activity Report", description="Overview of user registrations and activity", category="User Activity", type="Summary", schedule="Daily", last_generated="May 20, 2024 10:30 AM", created_by="Neha Verma", scheduled=True, schedule_detail="Daily at 09:00 AM"),
    dict(name="Appointments Report", description="Detailed appointment analytics", category="Appointments", type="Detailed", schedule="Weekly", last_generated="May 20, 2024 09:15 AM", created_by="Ritika Singh", scheduled=True, schedule_detail="Every Monday at 09:00 AM"),
    dict(name="Services Performance", description="Performance of services and bookings", category="Program & Services", type="Summary", schedule="Weekly", last_generated="May 19, 2024 11:45 PM", created_by="Anjali Mehta", scheduled=True, schedule_detail="Every Monday at 10:00 AM"),
    dict(name="Revenue Report", description="Financial summary and revenue insights", category="Financial", type="Detailed", schedule="Monthly", last_generated="May 1, 2024 08:00 AM", created_by="Priya Sharma", scheduled=False, schedule_detail=""),
    dict(name="Marketing Campaign Report", description="Campaign performance and leads", category="Marketing", type="Summary", schedule="Monthly", last_generated="May 18, 2024 02:20 PM", created_by="Admin User", scheduled=False, schedule_detail=""),
    dict(name="Custom Report - Donors", description="Donor contributions and insights", category="Others", type="Custom", schedule="On Demand", last_generated="May 20, 2024 01:05 PM", created_by="Neha Verma", scheduled=False, schedule_detail=""),
]

_OVERVIEW = dict(
    total_reports=42,
    scheduled_reports=16,
    reports_generated=128,
    reports_generated_delta=28.6,
    avg_generation_time="18s",
    data_points_analyzed="2.45M",
    data_points_delta=15.3,
    generated_trend=[
        {"label": "Apr 21", "value": 18},
        {"label": "Apr 28", "value": 32},
        {"label": "May 5", "value": 45},
        {"label": "May 12", "value": 60},
        {"label": "May 19", "value": 80},
    ],
    data_points_trend=[0.8, 1.1, 0.9, 1.4, 1.2, 1.6, 1.3, 1.9, 1.5, 1.8, 2.0, 1.7],
    top_categories=[
        {"name": "User Activity", "value": 35, "color": "#8b5cf6"},
        {"name": "Appointments", "value": 25, "color": "#3b82f6"},
        {"name": "Program & Services", "value": 20, "color": "#22c55e"},
        {"name": "Financial", "value": 12, "color": "#f59e0b"},
        {"name": "Others", "value": 8, "color": "#cbd5e1"},
    ],
)


async def seed() -> None:
    """Seed the reports + reports_overview collections, each only when empty."""
    db = get_database()

    if await db[ReportModel.collection_name].count_documents({}) == 0:
        base = datetime.now(timezone.utc)
        docs = [
            ReportModel.create_document(
                name=r["name"], description=r["description"], category=r["category"],
                type=r["type"], schedule=r["schedule"], schedule_detail=r["schedule_detail"],
                last_generated=r["last_generated"], created_by=r["created_by"],
                scheduled=r["scheduled"],
                # Descending created_at preserves the on-screen order (newest first).
                created_at=base - timedelta(seconds=i),
            )
            for i, r in enumerate(_REPORTS)
        ]
        await db[ReportModel.collection_name].insert_many(docs)
        print(f"🌱 Seeded {len(docs)} reports")

    if await db[ReportsOverviewModel.collection_name].count_documents({}) == 0:
        await db[ReportsOverviewModel.collection_name].insert_one(
            ReportsOverviewModel.create_document(**_OVERVIEW)
        )
        print("🌱 Seeded 1 reports overview")
