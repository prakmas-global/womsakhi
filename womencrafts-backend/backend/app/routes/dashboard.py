"""
Dashboard routes — the aggregate/overview screen.

Most of what this screen shows is rolled up live from other modules'
collections:

    recent_users        -> newest `members`      (created_at desc)
    recent_appointments -> newest `appointments` (_id desc, no scheduled_at field)

The rest are fixed platform-wide figures the UI paints verbatim (the 4 KPI
cards, the 12-point appointment trend + status tiles, the users-by-role donut).
Those have no matching live rollup source — e.g. the donut counts the platform's
1,248 users across role types that don't map onto the small `members` demo set —
so we return the blueprint's exact numbers, per the Phase 8 plan.

The one collection this module owns is the `system_overview` singleton, seeded
by seed() at the bottom of this file.
"""

import asyncio
from datetime import datetime

from fastapi import APIRouter, Depends, Query

from app.core.deps import get_current_user
from app.core.permissions import require_permission
from app.db.mongodb import get_database
from app.models.appointment import AppointmentModel
from app.models.dashboard import SystemOverviewModel
from app.models.member import MemberModel
from app.models.program import ProgramModel
from app.schemas.dashboard import (
    AppointmentTrend,
    DashboardOverview,
    RecentAppointment,
    RecentUser,
    StatCard,
    SystemOverviewResponse,
    UsersByRole,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def _members():
    return get_database()[MemberModel.collection_name]


def _appointments():
    return get_database()[AppointmentModel.collection_name]


def _system_overview_col():
    return get_database()[SystemOverviewModel.collection_name]


# Role → ring colour for the users-by-role donut.
_ROLE_COLORS = {
    "Member": "#22c55e",
    "Instructor": "#8b5cf6",
    "Supervisor": "#3b82f6",
    "Admin": "#e6117e",
    "Super Admin": "#a855f7",
}

# Appointment statuses (Upcoming/Rescheduled/...) mapped to the dashboard's
# Recent Appointments vocabulary (Completed/Scheduled/Cancelled).
_STATUS_MAP = {
    "Upcoming": "Scheduled",
    "Rescheduled": "Scheduled",
    "Completed": "Completed",
    "Cancelled": "Cancelled",
}


def _money_to_int(amount: str) -> int:
    """Pull the numeric value out of a display string like '₹2,999' -> 2999."""
    digits = "".join(ch for ch in str(amount) if ch.isdigit())
    return int(digits) if digits else 0


def _programs():
    return get_database()[ProgramModel.collection_name]


def _start_time(time_range: str) -> str:
    """From a "09:00 - 10:00 AM" range, build the "09:00 AM" start label the UI
    shows. Falls back to the raw string when it can't be split."""
    if " - " in time_range:
        start, rest = time_range.split(" - ", 1)
        meridiem = rest.strip().split(" ")[-1]
        return f"{start.strip()} {meridiem}".strip()
    return time_range


# --- Rollup builders (shared by /overview and the granular endpoints) ---------

async def _build_stats() -> list[StatCard]:
    """The 4 KPI cards, computed live from the real collections."""
    db = get_database()
    # Four numbers from four collections, none of which needs any other. One
    # wave rather than four trips to a cluster in another data centre.
    total_users, total_appts, total_programs, paid_invoices = await asyncio.gather(
        _members().count_documents({}),
        _appointments().count_documents({}),
        _programs().count_documents({}),
        db["invoices"].find({"status": "Paid"}).to_list(None),
    )
    revenue = sum(_money_to_int(inv.get("amount", "0")) for inv in paid_invoices)
    return [
        StatCard(key="total_users", label="Total Users", value=f"{total_users:,}", delta="12.5%", delta_dir="up", tone="violet", icon="Users", href="/dashboard/users"),
        StatCard(key="appointments", label="Appointments", value=f"{total_appts:,}", delta="8.3%", delta_dir="up", tone="emerald", icon="CalendarCheck", href="/dashboard/appointments"),
        StatCard(key="revenue", label="Revenue", value=f"₹{revenue:,}", delta="15.7%", delta_dir="up", tone="amber", icon="ShoppingBag", href="/dashboard/reports"),
        StatCard(key="programs", label="Programs", value=f"{total_programs:,}", delta="6.2%", delta_dir="up", tone="sky", icon="BookMarked", href="/dashboard/programs"),
    ]


async def _build_trend(range: str) -> AppointmentTrend:
    """Status tiles + a per-day series, both computed from real appointments."""
    docs = [d async for d in _appointments().find({}, {"status": 1, "date": 1})]
    total = len(docs)
    completed = sum(1 for d in docs if d.get("status") == "Completed")
    cancelled = sum(1 for d in docs if d.get("status") == "Cancelled")
    scheduled = sum(1 for d in docs if d.get("status") in ("Upcoming", "Rescheduled"))
    tiles = [
        {"label": "Total", "value": f"{total:,}", "tone": "text-slate-800 bg-slate-50", "href": "/dashboard/appointments"},
        {"label": "Completed", "value": f"{completed:,}", "tone": "text-emerald-600 bg-emerald-50", "href": "/dashboard/appointments?status=completed"},
        {"label": "Scheduled", "value": f"{scheduled:,}", "tone": "text-sky-600 bg-sky-50", "href": "/dashboard/appointments?status=scheduled"},
        {"label": "Cancelled", "value": f"{cancelled:,}", "tone": "text-rose-500 bg-rose-50", "href": "/dashboard/appointments?status=cancelled"},
    ]
    by_date: dict[str, int] = {}
    for d in docs:
        label = d.get("date", "")
        if label:
            by_date[label] = by_date.get(label, 0) + 1

    def _day_num(label: str) -> int:
        parts = label.split()
        return int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0

    series = [{"label": k, "value": v} for k, v in sorted(by_date.items(), key=lambda kv: _day_num(kv[0]))]
    return AppointmentTrend(range=range, series=series, tiles=tiles)


async def _build_by_role() -> UsersByRole:
    """Users-by-role donut, computed from the members' actual roles."""
    counts: dict[str, int] = {}
    async for doc in _members().find({}, {"role": 1}):
        role = doc.get("role", "Member")
        counts[role] = counts.get(role, 0) + 1
    total = sum(counts.values())
    ordered = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)

    def _pct(v: int) -> str:
        return f"{round(v / total * 100, 1)}%" if total else "0%"

    segments = [{"name": name, "value": val, "color": _ROLE_COLORS.get(name, "#c4b5fd")} for name, val in ordered]
    legend = [{"name": name, "value": f"{val:,} ({_pct(val)})", "color": _ROLE_COLORS.get(name, "#c4b5fd")} for name, val in ordered]
    return UsersByRole(segments=segments, legend=legend, center_value=f"{total:,}", center_label="Total")


async def _build_recent_users(limit: int) -> list[RecentUser]:
    """Newest members registered, mapped to the Recent Users list shape."""
    cursor = _members().find().sort("created_at", -1).limit(limit)
    out: list[RecentUser] = []
    async for doc in cursor:
        joined = doc.get("created_at")
        out.append(
            RecentUser(
                name=doc.get("full_name", ""),
                email=doc.get("email", ""),
                date=joined.strftime("%b %d, %Y") if isinstance(joined, datetime) else "",
                status="Active",
            )
        )
    return out


async def _build_recent_appointments(limit: int) -> list[RecentAppointment]:
    """Newest appointments (appointments carry no scheduled_at, so _id desc is
    the only recency signal), mapped to the Recent Appointments list shape."""
    cursor = _appointments().find().sort("_id", -1).limit(limit)
    out: list[RecentAppointment] = []
    async for doc in cursor:
        date = doc.get("date", "")
        out.append(
            RecentAppointment(
                title=doc.get("service", ""),
                who=doc.get("name", ""),
                date=f"{date}, 2024" if date else "",
                time=_start_time(doc.get("time", "")),
                status=_STATUS_MAP.get(doc.get("status", ""), doc.get("status", "")),
            )
        )
    return out


async def _build_system_overview() -> SystemOverviewResponse:
    """Read the owned singleton; fall back to defaults if it isn't seeded yet."""
    doc = await _system_overview_col().find_one({})
    if not doc:
        doc = SystemOverviewModel.create_document()
    return SystemOverviewResponse(**SystemOverviewModel.to_response(doc))


# --- Endpoints ----------------------------------------------------------------

@router.get("/overview", response_model=DashboardOverview, summary="Full dashboard bundle",
    dependencies=[Depends(require_permission("dashboard.view"))],
)
async def dashboard_overview(_: dict = Depends(get_current_user)):
    """One call hydrating the whole screen: KPI cards, appointment trend + tiles,
    users-by-role donut, recent users, recent appointments and system overview."""
    # Six independent builders. Awaited one at a time inside the constructor
    # they serialise, and so does everything inside them — about nine round
    # trips for a screen that opens on every sign-in. Nothing here reads
    # anything another produces.
    (
        stats, appointment_trend, users_by_role,
        recent_users, recent_appointments, system_overview,
    ) = await asyncio.gather(
        _build_stats(),
        _build_trend("This Month"),
        _build_by_role(),
        _build_recent_users(5),
        _build_recent_appointments(5),
        _build_system_overview(),
    )
    return DashboardOverview(
        stats=stats,
        appointment_trend=appointment_trend,
        users_by_role=users_by_role,
        recent_users=recent_users,
        recent_appointments=recent_appointments,
        system_overview=system_overview,
    )


@router.get("/stats", response_model=list[StatCard], summary="4 KPI cards",
    dependencies=[Depends(require_permission("dashboard.view"))],
)
async def dashboard_stats(_: dict = Depends(get_current_user)):
    return await _build_stats()


@router.get("/appointments/trend", response_model=AppointmentTrend, summary="Appointments overview trend",
    dependencies=[Depends(require_permission("dashboard.view"))],
)
async def dashboard_appointments_trend(
    range: str = Query("This Month", description="This Week | This Month | This Quarter | This Year"),
    _: dict = Depends(get_current_user),
):
    return await _build_trend(range)


@router.get("/users/by-role", response_model=UsersByRole, summary="Users-by-role donut",
    dependencies=[Depends(require_permission("dashboard.view"))],
)
async def dashboard_users_by_role(_: dict = Depends(get_current_user)):
    return await _build_by_role()


@router.get("/users/recent", response_model=list[RecentUser], summary="Recently registered users",
    dependencies=[Depends(require_permission("dashboard.view"))],
)
async def dashboard_recent_users(
    limit: int = Query(5, ge=1, le=50),
    _: dict = Depends(get_current_user),
):
    return await _build_recent_users(limit)


@router.get("/appointments/recent", response_model=list[RecentAppointment], summary="Recent appointments",
    dependencies=[Depends(require_permission("dashboard.view"))],
)
async def dashboard_recent_appointments(
    limit: int = Query(5, ge=1, le=50),
    _: dict = Depends(get_current_user),
):
    return await _build_recent_appointments(limit)


@router.get("/system-overview", response_model=SystemOverviewResponse, summary="System overview card",
    dependencies=[Depends(require_permission("dashboard.view"))],
)
async def dashboard_system_overview(_: dict = Depends(get_current_user)):
    return await _build_system_overview()


# --- Seed ---------------------------------------------------------------------

async def seed() -> None:
    """Seed ONLY the system_overview singleton (exactly 1 doc) when empty.
    All other dashboard figures are rollups or fixed blueprint numbers, so no
    other collection is created here."""
    col = _system_overview_col()
    if await col.count_documents({}) == 0:
        await col.insert_one(SystemOverviewModel.create_document())
        print("🌱 Seeded 1 system overview")
