"""
What Sakhi can do for a staff member.

The member tool set is scoped by ownership: no tool takes an id, so she
physically cannot reach another woman's data ([[ADR-007]]). Staff work the
opposite way — their whole job is other people's records — so the scoping here
is by **permission** instead, and it is checked per call rather than once at the
start of the conversation.

**Her role is read at call time, not baked into the prompt.** A conversation can
outlive a permission change; a tool that trusted a module list captured when the
chat opened would keep answering after access was revoked. `current_user_modules`
is consulted on every single call.

**Everything here reads. Nothing writes.** Approving an admission, resolving a
safety alert or refunding money are decisions with a person's name attached, and
the confirm gate ([[ADR-014]]) is not a substitute for that. Staff writes stay on
the screens where the audit trail already records who did what.

**Identity documents are never reachable.** Not summarised, not described, not
counted in a way that reveals content. They are staff-only through one audited
endpoint ([[ADR-011]]) and that endpoint is deliberately not wired to a model.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.core import mongosafe
from app.core.llm.base import ToolSpec
from app.core.rbac import current_user_modules
from app.core.sakhi.tools import Tool
from app.db.mongodb import get_database


def _now():
    return datetime.now(timezone.utc)


async def _allowed(me: dict, module: str) -> bool:
    return module in await current_user_modules(me)


def _denied(module: str) -> dict:
    # Says which permission is missing rather than returning an empty result.
    # "No members found" for a permissions problem is the failure mode
    # [[Empty is not the same as broken]] is about — it reads as fact.
    return {"error": f"Your role cannot open the {module} module.", "permission": module}


# --- reads -------------------------------------------------------------------

async def _find_members(me: dict, args: dict) -> dict:
    if not await _allowed(me, "users"):
        return _denied("users")
    query = (args.get("query") or "").strip()
    filters: dict = {}
    if query:
        # Escaped. Sakhi builds this argument from what a staff member typed at
        # her, so it is user input taking one extra hop, not a literal — see
        # `core/mongosafe.py` for the 97-second pattern that motivates it.
        filters.update(
            mongosafe.any_of(query, ["full_name", "email", "code", "location"])
        )
    if args.get("status"):
        filters["status"] = args["status"]
    cursor = get_database()["members"].find(filters).sort("created_at", -1).limit(10)
    return {"members": [
        {"code": d.get("code"), "name": d.get("full_name"), "status": d.get("status"),
         "location": d.get("location"), "segment": d.get("segment")}
        async for d in cursor
    ]}


async def _admissions_queue(me: dict, args: dict) -> dict:
    if not await _allowed(me, "users"):
        return _denied("users")
    cursor = get_database()["users"].find(
        {"role": "Member", "verification_status": {"$in": ["in_review", "pending_documents"]}},
        {"full_name": 1, "verification_status": 1, "created_at": 1},
    ).sort("created_at", 1).limit(20)
    rows = [{"name": d.get("full_name"), "stage": d.get("verification_status")} async for d in cursor]
    # Counts and stages only. Never anything about the documents themselves.
    return {"waiting": len(rows), "applicants": rows}


async def _appointments_window(me: dict, args: dict) -> dict:
    if not await _allowed(me, "appointments"):
        return _denied("appointments")
    days = max(1, min(int(args.get("days") or 7), 60))
    start = _now()
    end = start + timedelta(days=days)
    cursor = get_database()["bookings"].find(
        {"created_at": {"$gte": start - timedelta(days=365)}, "status": "upcoming"}
    ).sort("date", 1).limit(200)
    rows = [d async for d in cursor]
    upcoming = [r for r in rows if r.get("date", "") <= end.strftime("%Y-%m-%d")]
    by_service: dict[str, int] = {}
    for r in upcoming:
        by_service[r.get("service_name", "—")] = by_service.get(r.get("service_name", "—"), 0) + 1
    return {
        "window_days": days,
        "upcoming": len(upcoming),
        "by_service": sorted(by_service.items(), key=lambda kv: -kv[1])[:8],
    }


async def _safety_open(me: dict, args: dict) -> dict:
    if not await _allowed(me, "safety"):
        return _denied("safety")
    db = get_database()
    alerts = await db["safety_alerts"].count_documents({"status": {"$ne": "stood_down"}})
    reports = await db["safety_reports"].count_documents({"status": {"$in": ["open", "in_review"]}})
    # Counts, not content. A safety report is somebody's worst week and it is
    # read by a person on the safety screen, not paraphrased by an assistant.
    return {"open_alerts": alerts, "open_reports": reports,
            "note": "Open the Safety module to read these. Details are not available here."}


async def _programme_health(me: dict, args: dict) -> dict:
    if not await _allowed(me, "programs"):
        return _denied("programs")
    db = get_database()
    out = []
    async for p in db["programs"].find({}, {"name": 1, "cap": 1, "enrolled": 1, "status": 1}).limit(30):
        cap, enrolled = int(p.get("cap") or 0), int(p.get("enrolled") or 0)
        out.append({"name": p.get("name"), "status": p.get("status"), "enrolled": enrolled,
                    "seats_left": max(0, cap - enrolled) if cap else None,
                    "full": bool(cap and enrolled >= cap)})
    return {"programmes": sorted(out, key=lambda r: -(r["enrolled"] or 0))[:10]}


async def _platform_numbers(me: dict, args: dict) -> dict:
    if not await _allowed(me, "dashboard"):
        return _denied("dashboard")
    db = get_database()
    since = _now() - timedelta(days=int(args.get("days") or 30))
    return {
        "window_days": int(args.get("days") or 30),
        "members_total": await db["members"].count_documents({}),
        "members_new": await db["members"].count_documents({"created_at": {"$gte": since}}),
        "bookings_new": await db["bookings"].count_documents({"created_at": {"$gte": since}}),
        "enrolments_new": await db["enrollments"].count_documents({"created_at": {"$gte": since}}),
        "programmes": await db["programs"].count_documents({}),
    }


STAFF_TOOLS: list[Tool] = [
    Tool(ToolSpec(
        name="find_members",
        description="Search the member directory by name, email, code or town. Read-only.",
        input_schema={"type": "object", "properties": {
            "query": {"type": "string"},
            "status": {"type": "string", "enum": ["Active", "Pending", "Inactive", "Rejected"]},
        }, "required": []},
    ), _find_members),
    Tool(ToolSpec(
        name="admissions_queue",
        description="Who is waiting to be admitted, and at which stage. No document details.",
        input_schema={"type": "object", "properties": {}, "required": []},
    ), _admissions_queue),
    Tool(ToolSpec(
        name="appointments_window",
        description="Upcoming bookings in the next N days, and which services they are for.",
        input_schema={"type": "object", "properties": {
            "days": {"type": "integer", "description": "1–60, default 7"}}, "required": []},
    ), _appointments_window),
    Tool(ToolSpec(
        name="safety_open",
        description="How many safety alerts and reports are open. Counts only — never their contents.",
        input_schema={"type": "object", "properties": {}, "required": []},
    ), _safety_open),
    Tool(ToolSpec(
        name="programme_health",
        description="Programmes by enrolment, with seats left and which are full.",
        input_schema={"type": "object", "properties": {}, "required": []},
    ), _programme_health),
    Tool(ToolSpec(
        name="platform_numbers",
        description="Headline counts over a window: members, new members, bookings, enrolments.",
        input_schema={"type": "object", "properties": {
            "days": {"type": "integer", "description": "default 30"}}, "required": []},
    ), _platform_numbers),
]


def staff_tools() -> list[Tool]:
    return STAFF_TOOLS
