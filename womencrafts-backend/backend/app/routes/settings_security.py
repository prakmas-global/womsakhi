"""
Settings › Sessions and Settings › System Logs.

Both resources live in this one module and are exposed through a single parent
`router` (so main.py includes just one thing). The parent mounts two child
routers:

    /sessions      → active sessions, history, stats, sign-out / revoke
    /system-logs   → audit log list, stats and detail
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core import mongosafe
from app.core.deps import get_current_user
from app.core.serializers import page_meta, to_object_id
from app.db.mongodb import get_database
from app.models.session import SessionModel, SystemLogModel
from app.routes._paging import paged
from app.schemas.session import (
    RevokeResult,
    SessionListResponse,
    SessionResponse,
    SessionStatsResponse,
    SystemLogListResponse,
    SystemLogResponse,
    SystemLogStatsResponse,
)

sessions_router = APIRouter(prefix="/sessions", tags=["Settings"])
logs_router = APIRouter(prefix="/system-logs", tags=["Settings"])


def _sessions():
    return get_database()[SessionModel.collection_name]


def _logs():
    return get_database()[SystemLogModel.collection_name]


def _search_clause(q: str, fields: list[str]) -> dict:
    """Build a case-insensitive OR-regex clause over the given fields."""
    return mongosafe.any_of(q, fields)


def _log_when(time_label: str) -> str:
    """Turn a stored log timestamp ("May 20 09:58:33") into the Recent Errors
    "when" label ("May 20, 09:58 AM"). Falls back to the raw string if the
    stored value doesn't parse."""
    try:
        dt = datetime.strptime(time_label.strip(), "%b %d %H:%M:%S")
        return dt.strftime("%b %d, %I:%M %p")
    except (ValueError, AttributeError):
        return time_label


# ==============================================================================
# Sessions
# ==============================================================================

@sessions_router.get("", response_model=SessionListResponse, summary="List active sessions")
async def list_active_sessions(
    q: Optional[str] = Query(None, description="Search device, details, location or IP"),
    _: dict = Depends(get_current_user),
):
    query: dict = {"status": "Active"}
    if q and q.strip():
        query.update(_search_clause(q, ["device", "details", "location", "ip"]))
    # Current session first, then by creation order.
    cursor = _sessions().find(query).sort([("is_current", -1), ("_id", 1)])
    items = [SessionModel.to_response(doc) async for doc in cursor]
    return SessionListResponse(items=items, total=len(items))


@sessions_router.get("/stats", response_model=SessionStatsResponse, summary="Session stat cards")
async def session_stats(_: dict = Depends(get_current_user)):
    """The four stat cards on top of the Sessions screen. Counts are derived
    live; the current session supplies the "Last Active" labels."""
    active_count = await _sessions().count_documents({"status": "Active"})
    trusted_count = await _sessions().count_documents(
        {"status": "Active", "location_note": "Trusted Device"}
    )
    current = await _sessions().find_one({"status": "Active", "is_current": True})
    last_active = (current or {}).get("last_active") or "2 mins ago"
    last_active_at = (current or {}).get("last_active_at") or "May 20, 2024 10:30 AM"

    return SessionStatsResponse(
        stat_cards=[
            {
                "label": "Active Sessions",
                "value": str(active_count),
                "icon": "MonitorSmartphone",
                "tone": "violet",
                "note": "Currently signed in",
                "note_tone": "ok",
            },
            {
                "label": "Trusted Devices",
                "value": str(trusted_count),
                "icon": "ShieldCheck",
                "tone": "emerald",
                "note": "Your trusted devices",
                "note_tone": "ok",
            },
            {
                "label": "Last Active",
                "value": last_active,
                "icon": "Clock",
                "tone": "amber",
                "note": last_active_at,
                "note_tone": "subtle",
                "value_class": "text-lg",
            },
            {
                "label": "Security Status",
                "value": "Secure",
                "icon": "Lock",
                "tone": "emerald",
                "note": "All sessions are secure",
                "note_tone": "subtle",
                "value_class": "text-lg",
            },
        ]
    )


# NOTE: this module returns semantic tones ("ok", "subtle", "warn"), never a
# class name. An earlier version sent `note_color: "text-slate-400"` straight
# through to the browser, which meant the frontend's colour audit could not see
# it — a class name in Python is invisible to every check that greps
# TypeScript — and it rendered text at 2.37:1 on the sessions screen.
#
# The API describes MEANING. The client decides what colour that is.
@sessions_router.get("/history", response_model=SessionListResponse, summary="Session history")
async def session_history(
    q: Optional[str] = Query(None, description="Search device, details, location or IP"),
    _: dict = Depends(get_current_user),
):
    """Past (signed-out) sessions shown in the Session History table."""
    query: dict = {"status": "Signed Out"}
    if q and q.strip():
        query.update(_search_clause(q, ["device", "details", "location", "ip"]))
    cursor = _sessions().find(query).sort("_id", 1)
    items = [SessionModel.to_response(doc) async for doc in cursor]
    return SessionListResponse(items=items, total=len(items))


@sessions_router.post("/revoke-others", response_model=RevokeResult, summary="Sign out all other sessions")
async def revoke_other_sessions(_: dict = Depends(get_current_user)):
    """Sign out every active session except the current one (Revoke All Other
    Sessions / Secure My Account)."""
    result = await _sessions().delete_many({"status": "Active", "is_current": False})
    n = result.deleted_count
    return RevokeResult(revoked=n, message=f"Signed out {n} other session{'' if n == 1 else 's'}")


@sessions_router.delete("/{session_id}", response_model=RevokeResult, summary="Sign out a single session")
async def revoke_session(session_id: str, _: dict = Depends(get_current_user)):
    oid = to_object_id(session_id)
    doc = await _sessions().find_one({"_id": oid})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    if doc.get("is_current"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot sign out your current session")
    await _sessions().delete_one({"_id": oid})
    return RevokeResult(revoked=1, message="Session signed out")


# ==============================================================================
# System logs
# ==============================================================================

@logs_router.get("", response_model=SystemLogListResponse, summary="List system logs")
async def list_logs(
    level: Optional[str] = Query(None, description="Filter by level: Info|Success|Warning|Error"),
    source: Optional[str] = Query(None, description="Filter by source/action, e.g. 'auth'"),
    q: Optional[str] = Query(None, description="Search message, source, user, IP, level or time"),
    range: Optional[str] = Query(None, description="Time range label (accepted; display only)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    _: dict = Depends(get_current_user),
):
    query: dict = {}
    if level and level not in ("All Levels", "all"):
        query["level"] = level
    if source and source not in ("All Sources", "all"):
        query["source"] = source
    if q and q.strip():
        query.update(_search_clause(q, ["message", "source", "user", "ip", "level", "time"]))

    total, docs = await paged(
        _logs(), query,
        sort="_id", direction=1,  # seed order = newest first
        page=page, page_size=page_size,
    )
    items = [SystemLogModel.to_response(doc) for doc in docs]
    return SystemLogListResponse(items=items, **page_meta(total, page, page_size))


# Log level → donut ring colour (order matches the Log Levels donut).
_LEVEL_COLORS = {
    "Info": "#3b82f6",
    "Success": "#22c55e",
    "Warning": "#f59e0b",
    "Error": "#f43f5e",
}


@logs_router.get("/stats", response_model=SystemLogStatsResponse, summary="System log statistics")
async def log_stats(_: dict = Depends(get_current_user)):
    """The four stat cards, the Log Levels donut and the Recent Errors list, all
    computed live from the real `system_logs` collection."""
    logs = _logs()

    total = await logs.count_documents({})

    # Count per level in a single grouped pass (defaults keep every level slice).
    counts: dict[str, int] = {lvl: 0 for lvl in SystemLogModel.LEVELS}
    async for row in logs.aggregate([{"$group": {"_id": "$level", "n": {"$sum": 1}}}]):
        if row["_id"] in counts:
            counts[row["_id"]] = row["n"]

    # Newest error-level logs (seed order = newest first, i.e. _id ascending).
    recent_errors = [
        {"message": doc.get("message", ""), "when": _log_when(doc.get("time", ""))}
        async for doc in logs.find({"level": "Error"}).sort("_id", 1).limit(3)
    ]

    return SystemLogStatsResponse(
        stat_cards=[
            {"label": "Total Logs", "value": f"{total:,}", "icon": "ScrollText", "tone": "violet", "delta_note": "All time"},
            {"label": "Errors", "value": f"{counts['Error']:,}", "icon": "CircleAlert", "tone": "rose", "delta_note": "Last 24 hours"},
            {"label": "Warnings", "value": f"{counts['Warning']:,}", "icon": "TriangleAlert", "tone": "amber", "delta_note": "Last 24 hours"},
            {"label": "Info", "value": f"{counts['Info']:,}", "icon": "Info", "tone": "sky", "delta_note": "Last 24 hours"},
        ],
        level_distribution=[
            {"name": lvl, "value": counts[lvl], "color": _LEVEL_COLORS[lvl]}
            for lvl in SystemLogModel.LEVELS
        ],
        level_total=f"{total:,}",
        recent_errors=recent_errors,
    )


@logs_router.get("/sources", summary="Distinct log sources for the filter menu")
async def log_sources(_: dict = Depends(get_current_user)):
    """Distinct source values, prefixed with 'All Sources' for the dropdown."""
    sources = await _logs().distinct("source")
    return {"sources": ["All Sources", *sorted(sources)]}


@logs_router.get("/{log_id}", response_model=SystemLogResponse, summary="Get a single log")
async def get_log(log_id: str, _: dict = Depends(get_current_user)):
    doc = await _logs().find_one({"_id": to_object_id(log_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Log not found")
    return SystemLogResponse(**SystemLogModel.to_response(doc))


# ==============================================================================
# Parent router — main.py includes just this one.
# ==============================================================================

router = APIRouter(tags=["Settings"])
router.include_router(sessions_router)
router.include_router(logs_router)


# ==============================================================================
# Seeding
# ==============================================================================

# (device_type, device, details, location, ip, is_current, tag, location_note,
#  last_active, last_active_at) — the two rows in the "Active Sessions" table.
_SEED_ACTIVE = [
    ("Monitor", "Chrome on Windows", "Windows 11 · Chrome 124.0.6367.91",
     "Mumbai, Maharashtra, India", "103.21.244.18", True, "Current Session",
     "Current Location", "2 mins ago", "May 20, 2024 10:30 AM"),
    ("Smartphone", "iPhone 14 Pro", "iOS 17.4.1 · Mobile Safari",
     "Pune, Maharashtra, India", "103.45.67.89", False, None,
     "Trusted Device", "1 hour ago", "May 20, 2024 09:30 AM"),
]

# (device_type, device, details, location, ip, login_time, logout_time)
#  — the five rows in the "Session History" table.
_SEED_HISTORY = [
    ("Monitor", "Chrome on Windows", "Windows 11 · Chrome 124.0.6367.91",
     "Mumbai, Maharashtra, India", "103.21.244.18",
     "May 20, 2024 07:45 AM", "May 20, 2024 10:28 AM"),
    ("Smartphone", "iPhone 14 Pro", "iOS 17.4.1 · Mobile Safari",
     "Pune, Maharashtra, India", "103.45.67.89",
     "May 19, 2024 08:20 PM", "May 19, 2024 09:15 PM"),
    ("Monitor", "Chrome on Windows", "Windows 10 · Chrome 123.0.6312.86",
     "Delhi, India", "111.93.123.45",
     "May 18, 2024 11:10 AM", "May 18, 2024 06:45 PM"),
    ("Smartphone", "Samsung Galaxy S23", "Android 14 · Chrome Mobile",
     "Bengaluru, Karnataka, India", "182.68.90.12",
     "May 17, 2024 03:30 PM", "May 17, 2024 05:20 PM"),
    ("Monitor", "Edge on Windows", "Windows 11 · Edge 124.0.2478.80",
     "Hyderabad, Telangana, India", "106.51.78.32",
     "May 16, 2024 09:05 AM", "May 16, 2024 12:40 PM"),
]

# (time, level, source, message, user, ip) — the ten rows the log table ships with.
_SEED_LOGS = [
    ("May 20 10:32:14", "Info", "auth", "User admin@womsakhi.com signed in", "Admin User", "103.21.244.18"),
    ("May 20 10:30:02", "Success", "backup", "Daily backup completed (4.25 GB)", "System", "-"),
    ("May 20 10:15:47", "Warning", "email", "SMTP retry for notification #4821", "System", "-"),
    ("May 20 09:58:33", "Error", "payment", "Stripe webhook signature mismatch", "System", "-"),
    ("May 20 09:45:10", "Info", "users", "New user Priya Sharma created", "Admin User", "103.21.244.18"),
    ("May 20 09:30:00", "Success", "appointments", "Appointment #APT-2456 approved", "Admin User", "103.21.244.18"),
    ("May 20 09:12:20", "Warning", "api", "Rate limit near threshold (/api/v1/users)", "System", "-"),
    ("May 20 08:50:05", "Error", "integration", "WhatsApp Business token expired", "System", "-"),
    ("May 19 11:20:41", "Info", "content", "Page 'About Us' published", "Neha Verma", "49.36.12.90"),
    ("May 19 06:45:12", "Success", "settings", "System settings updated", "Admin User", "103.21.244.18"),
]


async def seed() -> None:
    """Seed the sessions and system_logs collections, each only when empty."""
    sessions = _sessions()
    if await sessions.count_documents({}) == 0:
        docs = [
            SessionModel.create_document(
                device_type=dt, device=dev, details=det, location=loc, ip=ip,
                status="Active", is_current=cur, tag=tag, location_note=note,
                last_active=la, last_active_at=laa,
            )
            for (dt, dev, det, loc, ip, cur, tag, note, la, laa) in _SEED_ACTIVE
        ] + [
            SessionModel.create_document(
                device_type=dt, device=dev, details=det, location=loc, ip=ip,
                status="Signed Out", is_current=False,
                login_time=login, logout_time=logout,
            )
            for (dt, dev, det, loc, ip, login, logout) in _SEED_HISTORY
        ]
        await sessions.insert_many(docs)
        print(f"🌱 Seeded {len(docs)} sessions")

    logs = _logs()
    if await logs.count_documents({}) == 0:
        docs = [
            SystemLogModel.create_document(
                time=t, level=lvl, source=src, message=msg, user=usr, ip=ip,
            )
            for (t, lvl, src, msg, usr, ip) in _SEED_LOGS
        ]
        await logs.insert_many(docs)
        print(f"🌱 Seeded {len(docs)} system logs")
