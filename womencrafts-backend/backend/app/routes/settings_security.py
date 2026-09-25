"""
Settings › Sessions and Settings › System Logs.

Both resources live in this one module and are exposed through a single parent
`router` (so main.py includes just one thing). The parent mounts two child
routers:

    /sessions      → active sessions, history, stats, sign-out / revoke
    /system-logs   → audit log list, stats and detail
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.core import mongosafe
from app.core.audit import record
from app.core.deps import get_current_user
from app.core.security import token_version_of
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
#
# Every query below is scoped to the caller. The collection also holds seeded
# demonstration rows with no `user_id` at all; they are deliberately left in
# the database and simply never match, so no screen shows them as hers.
#
# Sign-in does not write a row here (see `routes/auth.py::signin`), so for a
# real account these lists are honestly empty. The Sessions screen says so and
# offers the control that IS real: ending every session by bumping the
# account's token version — `staff_account.py::sign_out_everywhere`.
# ==============================================================================

def _mine(me: dict) -> dict:
    return {"user_id": str(me["_id"])}


def _when(value) -> str:
    """An absolute label for a stat card, from a real datetime only."""
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.strftime("%b %d, %Y %I:%M %p UTC")
    return ""


@sessions_router.get("", response_model=SessionListResponse, summary="List active sessions")
async def list_active_sessions(
    q: Optional[str] = Query(None, description="Search device, details, location or IP"),
    me: dict = Depends(get_current_user),
):
    query: dict = {"status": "Active", **_mine(me)}
    if q and q.strip():
        query.update(_search_clause(q, ["device", "details", "location", "ip"]))
    # Current session first, then by creation order.
    cursor = _sessions().find(query).sort([("is_current", -1), ("_id", 1)])
    items = [SessionModel.to_response(doc) async for doc in cursor]
    return SessionListResponse(items=items, total=len(items))


@sessions_router.get("/stats", response_model=SessionStatsResponse, summary="Session stat cards")
async def session_stats(me: dict = Depends(get_current_user)):
    """
    The stat cards on top of the Sessions screen, from the caller's account.

    This used to fall back to "2 mins ago" and a date in 2024 whenever there
    was no current row — which was always, because nothing writes one. Every
    value here now comes from a real field, and a field that is empty is
    shown as empty.
    """
    recorded = await _sessions().count_documents({"status": "Active", **_mine(me)})
    last_login = me.get("last_login_at")
    generation = token_version_of(me)
    ended_at = me.get("sessions_ended_at")

    return SessionStatsResponse(
        stat_cards=[
            {
                "label": "Recorded devices",
                "value": str(recorded),
                "icon": "MonitorSmartphone",
                "tone": "violet",
                "note": "Sign-in does not record the device yet" if recorded == 0 else "Devices with a recorded session",
                "note_tone": "subtle",
            },
            {
                "label": "Last signed in",
                "value": _when(last_login) or "Not recorded",
                "icon": "Clock",
                "tone": "amber",
                "note": "Your most recent successful sign-in" if last_login else "No sign-in has been recorded on this account",
                "note_tone": "subtle",
                "value_class": "text-lg",
            },
            {
                "label": "Sessions ended everywhere",
                "value": str(generation),
                "icon": "ShieldCheck",
                "tone": "emerald",
                "note": f"Last on {_when(ended_at)}" if ended_at else "Never, on this account",
                "note_tone": "subtle",
            },
            {
                "label": "Failed sign-in attempts",
                "value": str(int(me.get("failed_logins") or 0)),
                "icon": "Lock",
                "tone": "violet",
                "note": "Since your last successful sign-in",
                "note_tone": "warn" if int(me.get("failed_logins") or 0) > 0 else "ok",
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
    me: dict = Depends(get_current_user),
):
    """Past (signed-out) sessions shown in the Session History table."""
    query: dict = {"status": "Signed Out", **_mine(me)}
    if q and q.strip():
        query.update(_search_clause(q, ["device", "details", "location", "ip"]))
    cursor = _sessions().find(query).sort("_id", 1)
    items = [SessionModel.to_response(doc) async for doc in cursor]
    return SessionListResponse(items=items, total=len(items))


@sessions_router.post("/revoke-others", response_model=RevokeResult, summary="Sign out all other recorded sessions")
async def revoke_other_sessions(request: Request, me: dict = Depends(get_current_user)):
    """
    Remove every recorded session of the caller's except the current one.

    Scoped to her own rows: this used to `delete_many` across the whole
    collection, so anyone signed in could wipe everybody's sessions. It only
    removes RECORDS — a stateless token keeps working until it expires — so
    the real control is `POST /staff/me/sign-out-everywhere`, which the
    screen uses. This endpoint stays for any client that still calls it.
    """
    result = await _sessions().delete_many({"status": "Active", "is_current": False, **_mine(me)})
    n = result.deleted_count
    if n:
        await record(me, "settings.sessions_revoke", target=str(me["_id"]),
                     detail=f"Removed {n} recorded session(s)", request=request)
    return RevokeResult(revoked=n, message=f"Signed out {n} other session{'' if n == 1 else 's'}")


@sessions_router.delete("/{session_id}", response_model=RevokeResult, summary="Sign out a single session")
async def revoke_session(session_id: str, request: Request, me: dict = Depends(get_current_user)):
    oid = to_object_id(session_id)
    # Hers or nothing: a row that is not hers answers 404, not 403, so the
    # id space of other people's sessions is not confirmed either way.
    doc = await _sessions().find_one({"_id": oid, **_mine(me)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    if doc.get("is_current"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot sign out your current session")
    await _sessions().delete_one({"_id": oid, **_mine(me)})
    await record(me, "settings.sessions_revoke", target=str(me["_id"]),
                 detail=f"Removed recorded session {doc.get('device', '')}".strip(), request=request)
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
    """
    Seed the system_logs collection when empty.

    Sessions are NOT seeded any more. The seeded rows belonged to nobody (no
    `user_id`) and were shown to whoever was signed in as her own devices —
    a fixture rendered as data. Rows already in the database are left where
    they are; every session query is now scoped to the caller, so they never
    surface. `_SEED_ACTIVE` / `_SEED_HISTORY` are kept only as documentation
    of the old shape.
    """
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
