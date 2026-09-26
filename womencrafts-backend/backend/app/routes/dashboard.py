"""
Dashboard routes — the admin home.

Everything on it is measured at request time from the collections other
modules own. Nothing here is a stored figure:

    stats               -> members / appointments / programmes counted and paid
                           revenue summed, each with how many arrived in the
                           last 30 days
    attention           -> what is waiting for a person: applications in
                           review, ID documents pending, open safety reports,
                           upcoming appointments
    appointment_trend   -> appointments grouped by their date label, plus the
                           four status tiles
    users_by_role       -> the members' roles
    recent_users        -> newest members, with their real directory status
    recent_appointments -> newest appointments (no scheduled_at exists, so the
                           ObjectId's own timestamp is the recency signal)
    recent_activity     -> newest `activity_log` rows — the ones
                           app.core.audit.record writes on every staff action
    system_overview     -> a timed database ping, the database's real size,
                           staff signed in during the last day, and the newest
                           completed backup

── What used to be here ────────────────────────────────────────────────────
This module owned a `system_overview` singleton — 24.6 GB of 100 GB, 18 active
sessions, a backup taken in May 2024 — seeded on first run and painted as if it
were the state of the platform. The KPI cards carried "+12.5%" deltas that
never moved, every recent member was "Active", and every appointment was dated
2024. All of that is gone: the singleton is no longer read, a delta is shown
only when it counts something, and a status is the one on the row.
"""

import asyncio
import csv
import io
import time
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, Query, Request, Response

from app.core.audit import record
from app.core.deps import get_current_user
from app.core.permissions import require_permission
from app.core.staff_scope import member_scope_query
from app.db.mongodb import get_database
from app.models.appointment import AppointmentModel
from app.models.backup import BackupModel
from app.models.member import MemberModel
from app.models.program import ProgramModel
from app.models.safety import SafetyReportModel
from app.models.staff import ActivityLogModel
from app.models.user import UserModel
from app.models.verification import DocumentModel, VerificationStatus
from app.schemas.dashboard import (
    AppointmentTrend,
    AttentionItem,
    DashboardOverview,
    RecentActivity,
    RecentAppointment,
    RecentUser,
    StatCard,
    SystemOverviewResponse,
    UsersByRole,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

#: The window every "new in the last …" figure counts over.
WINDOW_DAYS = 30


def _members():
    return get_database()[MemberModel.collection_name]


def _appointments():
    return get_database()[AppointmentModel.collection_name]


def _bookings():
    # Members' own bookings — the real appointments. The legacy `appointments`
    # collection holds staff-entered rows and the old undated fixtures.
    return get_database()["bookings"]


async def _scope_context(user: dict) -> dict | None:
    """Resolve an assigned staff scope once for all dashboard rollups."""
    query = member_scope_query(user)
    if not query:
        return None
    rows = await _members().find(query, {"full_name": 1, "email": 1}).to_list(None)
    member_ids = [str(row["_id"]) for row in rows]
    emails = [row.get("email", "") for row in rows if row.get("email")]
    users = await _users().find({"$or": [
        {"member_id": {"$in": member_ids}}, {"email": {"$in": emails}},
    ]}, {"_id": 1}).to_list(None) if rows else []
    return {
        "member_query": query,
        "member_ids": member_ids,
        "user_ids": [str(row["_id"]) for row in users],
    }


def _owned(query: dict, scope: dict | None, fields: tuple[str, ...] = ("member_id", "user_id")) -> dict:
    if scope is None:
        return query
    clauses = []
    for field in fields:
        values = scope["member_ids"] if field == "member_id" else scope["user_ids"]
        if values:
            clauses.append({field: {"$in": values}})
    gate = {"$or": clauses} if clauses else {"_id": {"$exists": False}}
    return {"$and": [query, gate]} if query else gate


async def _member_names(scope: dict | None = None) -> dict[str, str]:
    out: dict[str, str] = {}
    async for m in _members().find(scope["member_query"] if scope else {}, {"full_name": 1}):
        out[str(m["_id"])] = m.get("full_name", "")
    user_query = {"_id": {"$in": [ObjectId(v) for v in scope["user_ids"]]}} if scope else {}
    async for u in _users().find(user_query, {"full_name": 1}):
        out.setdefault(str(u["_id"]), u.get("full_name", ""))
    return out


def _programs():
    return get_database()[ProgramModel.collection_name]


def _users():
    return get_database()[UserModel.collection_name]


def _activity():
    return get_database()[ActivityLogModel.collection_name]


def _backups():
    return get_database()[BackupModel.collection_name]


def _reports():
    return get_database()[SafetyReportModel.collection_name]


def _documents():
    return get_database()[DocumentModel.collection_name]


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

_UPCOMING = ["Upcoming", "Rescheduled"]

_MONTHS = {
    m: i
    for i, m in enumerate(
        ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], 1
    )
}


def _money_to_int(amount: str) -> int:
    """Pull the numeric value out of a display string like '₹2,999' -> 2999."""
    digits = "".join(ch for ch in str(amount) if ch.isdigit())
    return int(digits) if digits else 0


def _start_time(time_range: str) -> str:
    """From a "09:00 - 10:00 AM" range, build the "09:00 AM" start label the UI
    shows. Falls back to the raw string when it can't be split."""
    if " - " in time_range:
        start, rest = time_range.split(" - ", 1)
        meridiem = rest.strip().split(" ")[-1]
        return f"{start.strip()} {meridiem}".strip()
    return time_range


def _label_key(label: str) -> tuple[int, int]:
    """Sort key for a 'May 20' label: month first, then day. Sorting on the day
    alone, as this used to, interleaved January with June."""
    parts = label.split()
    month = _MONTHS.get(parts[0][:3].title(), 0) if parts else 0
    day = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0
    return (month, day)


def _parse_label_date(label: str) -> datetime | None:
    """'May 20, 2024' -> an aware datetime; None when it is not that shape."""
    try:
        return datetime.strptime(str(label).strip(), "%b %d, %Y").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _since(days: int = WINDOW_DAYS) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


def _delta(n: int, what: str) -> tuple[str, str]:
    """A count of arrivals, shown only when there were some. Zero is not a
    trend, and a fixed "+12.5%" that never moved was not one either."""
    return (f"+{n:,}", what) if n > 0 else ("", "")


def _human_bytes(n: int) -> str:
    value = float(n)
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if value < 1024 or unit == "TB":
            return f"{value:.0f} {unit}" if unit == "B" else f"{value:.1f} {unit}"
        value /= 1024
    return f"{n} B"


def _fmt_when(dt: datetime | None) -> str:
    return dt.strftime("%b %d, %Y %I:%M %p") if isinstance(dt, datetime) else ""


# --- Rollup builders (shared by /overview, the granular endpoints and /export) --

async def _build_stats(scope: dict | None = None, days: int = WINDOW_DAYS) -> list[StatCard]:
    """The 4 KPI cards, each counted from its collection, with how many arrived
    in the last 30 days beside it."""
    db = get_database()
    since = _since(days)
    # Appointments carry no created_at; the ObjectId was minted when the row
    # was, so its embedded timestamp is the honest signal.
    since_oid = ObjectId.from_datetime(since)
    (
        total_users, new_users,
        legacy_appts, new_legacy_appts,
        total_bookings, new_bookings,
        total_programs, new_programs,
        paid_invoices,
    ) = await asyncio.gather(
        _members().count_documents(scope["member_query"] if scope else {}),
        _members().count_documents({"$and": [scope["member_query"], {"created_at": {"$gte": since}}]} if scope else {"created_at": {"$gte": since}}),
        _appointments().count_documents({} if scope is None else {"_id": {"$exists": False}}),
        _appointments().count_documents({"_id": {"$gte": since_oid}} if scope is None else {"_id": {"$exists": False}}),
        _bookings().count_documents(_owned({}, scope)),
        _bookings().count_documents(_owned({"created_at": {"$gte": since}}, scope)),
        _programs().count_documents({}),
        _programs().count_documents({"created_at": {"$gte": since}}),
        db["invoices"].find({"status": "Paid"}, {"amount": 1, "date": 1}).to_list(None),
    )
    total_appts = legacy_appts + total_bookings
    new_appts = new_legacy_appts + new_bookings
    revenue = sum(_money_to_int(inv.get("amount", "0")) for inv in paid_invoices)
    recent_revenue = 0
    for inv in paid_invoices:
        paid_on = _parse_label_date(inv.get("date", ""))
        if paid_on and paid_on >= since:
            recent_revenue += _money_to_int(inv.get("amount", "0"))

    window = f"new in the last {days} days"
    d_users, n_users = _delta(new_users, window)
    d_appts, n_appts = _delta(new_appts, window)
    d_programs, n_programs = _delta(new_programs, window)
    d_rev, n_rev = (
        (f"+₹{recent_revenue:,}", f"paid in the last {days} days") if recent_revenue > 0 else ("", "")
    )
    return [
        StatCard(key="total_users", label="Members", value=f"{total_users:,}", delta=d_users, delta_dir="up", delta_note=n_users, tone="violet", icon="Users", href="/dashboard/users"),
        StatCard(key="appointments", label="Appointments", value=f"{total_appts:,}", delta=d_appts, delta_dir="up", delta_note=n_appts, tone="emerald", icon="CalendarCheck", href="/dashboard/appointments"),
        StatCard(key="revenue", label="Revenue (paid invoices)", value=f"₹{revenue:,}", delta=d_rev, delta_dir="up", delta_note=n_rev, tone="amber", icon="ShoppingBag", href="/dashboard/money/orders"),
        StatCard(key="programs", label="Programmes", value=f"{total_programs:,}", delta=d_programs, delta_dir="up", delta_note=n_programs, tone="sky", icon="BookMarked", href="/dashboard/programs"),
    ]


async def _build_attention(scope: dict | None = None) -> list[AttentionItem]:
    """What is waiting for a person. Each tile links to the screen where she
    deals with it, and each count is the same query that screen runs."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    in_review, docs_pending, open_reports, upcoming_legacy, upcoming_bookings = await asyncio.gather(
        _users().count_documents({"role": "Member", "verification_status": VerificationStatus.IN_REVIEW,
                                  **({"_id": {"$in": [ObjectId(v) for v in scope["user_ids"]]}} if scope else {})}),
        _documents().count_documents(_owned({"status": DocumentModel.STATUS_PENDING}, scope)),
        _reports().count_documents(_owned({"status": {"$in": [SafetyReportModel.STATUS_OPEN, SafetyReportModel.STATUS_REVIEWING]}}, scope)),
        _appointments().count_documents({"status": {"$in": _UPCOMING}} if scope is None else {"_id": {"$exists": False}}),
        _bookings().count_documents(_owned({"status": "upcoming", "date": {"$gte": today}}, scope)),
    )
    upcoming = upcoming_legacy + upcoming_bookings
    return [
        AttentionItem(key="verifications", label="Applications to review", value=in_review, note="Women waiting to be admitted", tone="amber", icon="ShieldCheck", href="/dashboard/users/verification"),
        AttentionItem(key="documents", label="ID documents pending", value=docs_pending, note="Uploaded, not yet checked", tone="sky", icon="FileCheck", href="/dashboard/users/verification"),
        AttentionItem(key="safety", label="Open safety reports", value=open_reports, note="Open or being reviewed", tone="rose", icon="ShieldAlert", href="/dashboard/safety/reports"),
        AttentionItem(key="appointments", label="Upcoming appointments", value=upcoming, note="Scheduled or rescheduled", tone="emerald", icon="CalendarClock", href="/dashboard/appointments?status=scheduled"),
    ]


async def _build_trend(scope: dict | None = None, days: int = WINDOW_DAYS) -> AppointmentTrend:
    """Status tiles over every appointment there is — members' bookings and the
    staff-entered rows — and a per-month series of bookings over the last
    twelve months. Bookings carry a real date; the legacy rows carry a 'May 20'
    label with no year, so they count in the tiles but not on the line."""
    legacy = [d async for d in _appointments().find({} if scope is None else {"_id": {"$exists": False}}, {"status": 1})]
    bookings = [d async for d in _bookings().find(_owned({}, scope), {"status": 1, "date": 1})]

    def _legacy_bucket(st: str) -> str:
        return "completed" if st == "Completed" else "cancelled" if st == "Cancelled" else "scheduled" if st in _UPCOMING else "other"

    def _booking_bucket(st: str) -> str:
        return "completed" if st == "completed" else "cancelled" if st in ("cancelled", "no_show") else "scheduled" if st in ("upcoming", "confirmed") else "other"

    buckets = [_legacy_bucket(d.get("status", "")) for d in legacy] + [_booking_bucket(d.get("status", "")) for d in bookings]
    total = len(buckets)
    completed = buckets.count("completed")
    cancelled = buckets.count("cancelled")
    scheduled = buckets.count("scheduled")
    tiles = [
        {"label": "Total", "value": f"{total:,}", "tone": "text-slate-800 bg-slate-50", "href": "/dashboard/appointments"},
        {"label": "Completed", "value": f"{completed:,}", "tone": "text-emerald-600 bg-emerald-50", "href": "/dashboard/appointments?status=completed"},
        {"label": "Scheduled", "value": f"{scheduled:,}", "tone": "text-sky-600 bg-sky-50", "href": "/dashboard/appointments?status=scheduled"},
        {"label": "Cancelled", "value": f"{cancelled:,}", "tone": "text-rose-500 bg-rose-50", "href": "/dashboard/appointments?status=cancelled"},
    ]

    # A readable number of buckets for the chosen fast filter. Each point is a
    # real booking date, and empty periods stay visible instead of vanishing.
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=days - 1)
    bucket_days = 1 if days <= 14 else 7
    buckets: list[tuple] = []
    cursor = start
    while cursor <= today:
        end = min(cursor + timedelta(days=bucket_days - 1), today)
        label = cursor.strftime("%d %b") if cursor == end else f"{cursor.strftime('%d %b')}–{end.strftime('%d %b')}"
        buckets.append((cursor, end, label))
        cursor = end + timedelta(days=1)
    values = [0 for _ in buckets]
    for row in bookings:
        try:
            booked = datetime.strptime((row.get("date") or "")[:10], "%Y-%m-%d").date()
        except ValueError:
            continue
        for i, (begin, end, _) in enumerate(buckets):
            if begin <= booked <= end:
                values[i] += 1
                break
    series = [{"label": bucket[2], "value": values[i]} for i, bucket in enumerate(buckets)]
    return AppointmentTrend(range=f"Bookings, last {days} days", series=series, tiles=tiles)


async def _build_by_role(scope: dict | None = None) -> UsersByRole:
    """Users-by-role donut, computed from the members' actual roles."""
    counts: dict[str, int] = {}
    async for doc in _members().find(scope["member_query"] if scope else {}, {"role": 1}):
        role = doc.get("role", "Member")
        counts[role] = counts.get(role, 0) + 1
    total = sum(counts.values())
    ordered = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)

    def _pct(v: int) -> str:
        return f"{round(v / total * 100, 1)}%" if total else "0%"

    segments = [{"name": name, "value": val, "color": _ROLE_COLORS.get(name, "#c4b5fd")} for name, val in ordered]
    legend = [{"name": name, "value": f"{val:,} ({_pct(val)})", "color": _ROLE_COLORS.get(name, "#c4b5fd")} for name, val in ordered]
    return UsersByRole(segments=segments, legend=legend, center_value=f"{total:,}", center_label="Members")


async def _build_recent_users(limit: int, scope: dict | None = None) -> list[RecentUser]:
    """Newest members registered, with the status their directory row holds."""
    cursor = _members().find(scope["member_query"] if scope else {}).sort("created_at", -1).limit(limit)
    out: list[RecentUser] = []
    async for doc in cursor:
        joined = doc.get("created_at")
        out.append(
            RecentUser(
                name=doc.get("full_name", ""),
                email=doc.get("email", ""),
                date=joined.strftime("%b %d, %Y") if isinstance(joined, datetime) else "",
                status=doc.get("status") or "",
            )
        )
    return out


async def _build_recent_appointments(limit: int, scope: dict | None = None) -> list[RecentAppointment]:
    """Newest bookings members made, by when they were made; topped up with
    the newest staff-entered rows if there are too few. A booking's date is a
    real date; a legacy row's date is the label it holds, with no year
    invented for it."""
    names = await _member_names(scope)
    out: list[RecentAppointment] = []
    async for doc in _bookings().find(_owned({}, scope)).sort("created_at", -1).limit(limit):
        who = names.get(str(doc.get("member_id") or "")) or names.get(str(doc.get("user_id") or "")) or "Member"
        out.append(RecentAppointment(
            title=doc.get("service_name", ""), who=who, date=doc.get("date", ""),
            time=_start_time(doc.get("time", "")), status=(doc.get("status") or "").replace("_", " ").capitalize(),
        ))
    if len(out) < limit and scope is None:
        async for doc in _appointments().find().sort("_id", -1).limit(limit - len(out)):
            out.append(RecentAppointment(
                title=doc.get("service", ""), who=doc.get("name", ""), date=doc.get("date", ""),
                time=_start_time(doc.get("time", "")), status=_STATUS_MAP.get(doc.get("status", ""), doc.get("status", "")),
            ))
    return out


async def _build_recent_activity(limit: int, scope: dict | None = None, actor_id: str = "") -> list[RecentActivity]:
    """The newest staff actions, straight from the audit trail."""
    query = {}
    if scope is not None:
        query = {"$or": [{"user_id": actor_id}, {"target": {"$in": scope["member_ids"]}}]}
    docs = await _activity().find(query).sort("created_at", -1).to_list(limit)
    return [RecentActivity(**ActivityLogModel.to_response(d)) for d in docs]


async def _build_system_overview() -> SystemOverviewResponse:
    """Measured: a timed ping, dbStats, a real sign-in query, the newest
    completed backup. Anything that cannot be measured says so."""
    db = get_database()
    started = time.perf_counter()
    try:
        await db.command("ping")
        db_ok = True
        latency_ms = max(1, round((time.perf_counter() - started) * 1000))
    except Exception:  # noqa: BLE001 — the point is to report it, not raise
        db_ok = False
        latency_ms = 0

    storage_bytes = 0
    collections = 0
    if db_ok:
        try:
            stats = await db.command("dbStats")
            storage_bytes = int(stats.get("dataSize", 0) or 0)
            collections = int(stats.get("collections", 0) or 0)
        except Exception:  # noqa: BLE001
            pass

    signed_in = 0
    backup = None
    if db_ok:
        signed_in, backups = await asyncio.gather(
            _users().count_documents({"role": {"$ne": "Member"}, "last_login_at": {"$gte": _since(1)}}),
            _backups().find({"status": BackupModel.STATUS_COMPLETE}).sort("created_at", -1).limit(1).to_list(1),
        )
        backup = backups[0] if backups else None

    backup_at = (backup or {}).get("finished_at") or (backup or {}).get("created_at")
    kind = (backup or {}).get("kind", "")
    return SystemOverviewResponse(
        database_ok=db_ok,
        database_latency_ms=latency_ms,
        status_label=f"Database reachable · {latency_ms} ms" if db_ok else "Database unreachable",
        storage_bytes=storage_bytes,
        storage_label=(
            f"{_human_bytes(storage_bytes)} of data in {collections} collections" if db_ok else "Not measured"
        ),
        collections=collections,
        staff_signed_in_24h=signed_in,
        last_backup_at=backup_at.isoformat() if isinstance(backup_at, datetime) else "",
        last_backup_label=_fmt_when(backup_at if isinstance(backup_at, datetime) else None),
        last_backup_type={"full": "Full backup", "custom": "Custom backup"}.get(kind, kind.title() if kind else ""),
    )


async def _build_overview(user: dict, days: int = WINDOW_DAYS) -> DashboardOverview:
    # Eight independent builders in one wave; nothing here reads anything
    # another produces, and the screen opens on every sign-in.
    scope = await _scope_context(user)
    (
        stats, attention, appointment_trend, users_by_role,
        recent_users, recent_appointments, recent_activity, system_overview,
    ) = await asyncio.gather(
        _build_stats(scope, days),
        _build_attention(scope),
        _build_trend(scope, days),
        _build_by_role(scope),
        _build_recent_users(5, scope),
        _build_recent_appointments(5, scope),
        _build_recent_activity(8, scope, str(user.get("_id", ""))),
        _build_system_overview(),
    )
    return DashboardOverview(
        generated_at=datetime.now(timezone.utc).isoformat(),
        stats=stats,
        attention=attention,
        appointment_trend=appointment_trend,
        users_by_role=users_by_role,
        recent_users=recent_users,
        recent_appointments=recent_appointments,
        recent_activity=recent_activity,
        system_overview=system_overview,
    )


# --- Endpoints ----------------------------------------------------------------

@router.get("/overview", response_model=DashboardOverview, summary="Full dashboard bundle",
    dependencies=[Depends(require_permission("dashboard.view"))],
)
async def dashboard_overview(days: int = Query(WINDOW_DAYS, ge=7, le=90), me: dict = Depends(get_current_user)):
    """One call hydrating the whole screen."""
    return await _build_overview(me, days)


@router.get("/stats", response_model=list[StatCard], summary="4 KPI cards",
    dependencies=[Depends(require_permission("dashboard.view"))],
)
async def dashboard_stats(days: int = Query(WINDOW_DAYS, ge=7, le=90), me: dict = Depends(get_current_user)):
    return await _build_stats(await _scope_context(me), days)


@router.get("/attention", response_model=list[AttentionItem], summary="What is waiting for a person",
    dependencies=[Depends(require_permission("dashboard.view"))],
)
async def dashboard_attention(me: dict = Depends(get_current_user)):
    return await _build_attention(await _scope_context(me))


@router.get("/appointments/trend", response_model=AppointmentTrend, summary="Appointments overview trend",
    dependencies=[Depends(require_permission("dashboard.view"))],
)
async def dashboard_appointments_trend(
    days: int = Query(WINDOW_DAYS, ge=7, le=90),
    me: dict = Depends(get_current_user),
):
    return await _build_trend(await _scope_context(me), days)


@router.get("/users/by-role", response_model=UsersByRole, summary="Users-by-role donut",
    dependencies=[Depends(require_permission("dashboard.view"))],
)
async def dashboard_users_by_role(me: dict = Depends(get_current_user)):
    return await _build_by_role(await _scope_context(me))


@router.get("/users/recent", response_model=list[RecentUser], summary="Recently registered users",
    dependencies=[Depends(require_permission("dashboard.view"))],
)
async def dashboard_recent_users(
    limit: int = Query(5, ge=1, le=50),
    me: dict = Depends(get_current_user),
):
    return await _build_recent_users(limit, await _scope_context(me))


@router.get("/appointments/recent", response_model=list[RecentAppointment], summary="Recent appointments",
    dependencies=[Depends(require_permission("dashboard.view"))],
)
async def dashboard_recent_appointments(
    limit: int = Query(5, ge=1, le=50),
    me: dict = Depends(get_current_user),
):
    return await _build_recent_appointments(limit, await _scope_context(me))


@router.get("/activity/recent", response_model=list[RecentActivity], summary="Newest staff actions",
    dependencies=[Depends(require_permission("dashboard.view"))],
)
async def dashboard_recent_activity(
    limit: int = Query(8, ge=1, le=50),
    me: dict = Depends(get_current_user),
):
    scope = await _scope_context(me)
    return await _build_recent_activity(limit, scope, str(me.get("_id", "")))


@router.get("/system-overview", response_model=SystemOverviewResponse, summary="System overview card",
    dependencies=[Depends(require_permission("dashboard.view"))],
)
async def dashboard_system_overview(_: dict = Depends(get_current_user)):
    return await _build_system_overview()


@router.get("/export", summary="Download the home screen as CSV",
    dependencies=[Depends(require_permission("dashboard.export"))],
)
async def dashboard_export(request: Request, days: int = Query(WINDOW_DAYS, ge=7, le=90), me: dict = Depends(get_current_user)):
    """Every figure and list on the home, as it stands right now, in one CSV.

    An export is data leaving the building — member names and emails among it —
    so it is recorded in the audit trail the way a write is."""
    o = await _build_overview(me, days)
    rows: list[list[str]] = [["section", "label", "value", "note"]]
    for s in o.stats:
        rows.append(["stat", s.label, s.value, f"{s.delta} {s.delta_note}".strip()])
    for a in o.attention:
        rows.append(["attention", a.label, str(a.value), a.note])
    for seg in o.users_by_role.segments:
        rows.append(["members_by_role", seg.name, str(seg.value), ""])
    for t in o.appointment_trend.tiles:
        rows.append(["appointments", t.label, t.value, ""])
    for p in o.appointment_trend.series:
        rows.append(["appointments_by_date", p.label, str(p.value), ""])
    sys_ = o.system_overview
    rows.append(["system", "Database", sys_.status_label, ""])
    rows.append(["system", "Data stored", sys_.storage_label, ""])
    rows.append(["system", "Staff signed in (24 h)", str(sys_.staff_signed_in_24h), ""])
    rows.append(["system", "Last backup", sys_.last_backup_label or "None yet", sys_.last_backup_type])
    for u in o.recent_users:
        rows.append(["recent_member", u.name, u.email, f"{u.date} · {u.status}".strip(" ·")])
    for a in o.recent_appointments:
        rows.append(["recent_appointment", a.title, a.who, f"{a.date} {a.time} · {a.status}".strip()])
    for e in o.recent_activity:
        rows.append(["activity", e.user_name, e.action, f"{e.when} · {e.detail}".strip(" ·")])

    buf = io.StringIO()
    csv.writer(buf).writerows(rows)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    await record(
        me, "dashboard.export",
        detail=f"Downloaded the home snapshot as CSV ({len(rows) - 1} rows)",
        request=request,
    )
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="womsakhi-dashboard-{stamp}.csv"'},
    )


# --- Seed ---------------------------------------------------------------------

async def seed() -> None:
    """Nothing to seed. This module used to insert a `system_overview` singleton
    of invented figures; the card now measures the platform instead, so there
    is no document to create. Kept because seed_all imports it."""
    return None
