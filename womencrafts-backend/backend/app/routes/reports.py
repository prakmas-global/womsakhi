"""
Reports — real data, generated on demand, every download written down.

── What this replaced ─────────────────────────────────────────────────────
The old screen was a report *builder* in appearance only. "Reports" were six
seeded rows with a `last_generated` string; "Run now" stamped the time and
produced nothing; the stat cards read one seeded snapshot ("128 generated,
2.45M data points analysed, 18s average"); "Schedule" and "Templates" saved
or listed rows that no scheduler and no renderer ever touched.

── What a report is now ───────────────────────────────────────────────────
A definition in `CATALOGUE` below: a name, a category, a column list and a
function that reads the real collection(s). Generating one builds a CSV from
those rows, records the run in `report_runs` (who, when, how many rows, which
window) and records it in the activity log — a download of member data is an
action somebody should be able to trace. The stat cards count those runs.

There is no scheduler and no emailed delivery; nothing on the screen claims
one. When those exist they get built here, not simulated.

── Privacy ─────────────────────────────────────────────────────────────────
The safety report is counts only — category by status — because the rows
behind it can name a woman and the person she reported. Nothing here reads a
member's private vault or her in-case-of-emergency data.

── Access ──────────────────────────────────────────────────────────────────
Listing, stats and previews need `reports.view`; generating a file needs
`reports.export`.
"""

import csv
import io
import time
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any, Awaitable, Callable, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import Response

from app.core.audit import record
from app.core.deps import get_current_user
from app.core.permissions import require_permission
from app.db.mongodb import get_database
from app.schemas.report import (
    ReportDefinitionResponse,
    ReportListResponse,
    ReportPreviewResponse,
    ReportRunResponse,
    ReportsStatsResponse,
)

router = APIRouter(prefix="/reports", tags=["Reports"])

RUNS = "report_runs"

CATEGORY_COLORS = {
    "User Activity": "#8b5cf6",
    "Appointments": "#3b82f6",
    "Program & Services": "#22c55e",
    "Financial": "#f59e0b",
    "Marketing": "#f43f5e",
    "Others": "#94a3b8",
}
CATEGORY_TONE = {
    "User Activity": "violet", "Appointments": "sky", "Program & Services": "emerald",
    "Financial": "amber", "Marketing": "rose", "Others": "slate",
}


def _db():
    return get_database()


def _now() -> datetime:
    return datetime.now(timezone.utc)


# --- Windows ----------------------------------------------------------------------
def _range_bounds(label: Optional[str]) -> Optional[tuple[datetime, datetime]]:
    """The window a range label means, or None for all time."""
    now = _now()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    if label == "Today":
        return today, now
    if label == "Last 7 Days":
        return now - timedelta(days=7), now
    if label == "Last 30 Days":
        return now - timedelta(days=30), now
    if label == "This Month":
        return today.replace(day=1), now
    if label == "This Year":
        return today.replace(month=1, day=1), now
    return None


def _dated(field: str, bounds: Optional[tuple[datetime, datetime]]) -> dict:
    return {field: {"$gte": bounds[0], "$lt": bounds[1]}} if bounds else {}


# --- Helpers the builders share -----------------------------------------------------
async def _people() -> dict[str, dict]:
    """member id / user id → name and email, so a row names a person, not an id."""
    out: dict[str, dict] = {}
    async for m in _db()["members"].find({}, {"full_name": 1, "email": 1}):
        out[str(m["_id"])] = {"name": m.get("full_name", ""), "email": m.get("email", "")}
    async for u in _db()["users"].find({}, {"full_name": 1, "email": 1}):
        out.setdefault(str(u["_id"]), {"name": u.get("full_name", ""), "email": u.get("email", "")})
    return out


def _who(people: dict, doc: dict) -> tuple[str, str]:
    p = people.get(str(doc.get("member_id") or "")) or people.get(str(doc.get("user_id") or "")) or {}
    return p.get("name", ""), p.get("email", "")


def _fmt(v: Any) -> Any:
    if isinstance(v, datetime):
        return v.isoformat(timespec="minutes")
    if v is None:
        return ""
    if isinstance(v, (list, dict)):
        return str(v)
    return v


# --- The builders: one per report, each reading real rows ---------------------------
async def _members(bounds):
    rows = []
    async for m in _db()["members"].find(_dated("created_at", bounds)).sort("created_at", -1):
        rows.append([m.get("code"), m.get("full_name"), m.get("email"), m.get("phone"), m.get("role"),
                     m.get("status"), m.get("location"), m.get("segment"), m.get("referral"),
                     m.get("verified_on"), m.get("created_at")])
    return rows


async def _bookings(bounds):
    people = await _people()
    rows = []
    async for b in _db()["bookings"].find(_dated("created_at", bounds)).sort("created_at", -1):
        name, email = _who(people, b)
        rows.append([b.get("created_at"), name, email, b.get("service_name"), b.get("date"), b.get("time"),
                     b.get("mode"), b.get("with_whom"), b.get("duration"), b.get("price"), b.get("status"),
                     b.get("cancelled_reason")])
    return rows


async def _enrollments(bounds):
    people = await _people()
    rows = []
    async for e in _db()["enrollments"].find(_dated("created_at", bounds)).sort("created_at", -1):
        name, email = _who(people, e)
        rows.append([e.get("created_at"), name, email, e.get("program_name"), e.get("status"),
                     e.get("progress"), e.get("sessions_attended"), e.get("last_activity_at"), e.get("completed_at")])
    return rows


async def _programs(bounds):
    by_program: Counter = Counter()
    done: Counter = Counter()
    async for e in _db()["enrollments"].find({}, {"program_id": 1, "status": 1, "completed_at": 1}):
        pid = str(e.get("program_id") or "")
        by_program[pid] += 1
        if e.get("completed_at") or e.get("status") == "completed":
            done[pid] += 1
    rows = []
    async for p in _db()["programs"].find({}).sort("name", 1):
        pid = str(p["_id"])
        n = by_program.get(pid, 0)
        rows.append([p.get("name"), p.get("category"), p.get("mode"), p.get("duration"), p.get("dates"),
                     p.get("status"), p.get("cap"), n, f"{round(done.get(pid, 0) / n * 100)}%" if n else ""])
    return rows


async def _services(bounds):
    by_id: Counter = Counter()
    by_name: Counter = Counter()
    async for b in _db()["bookings"].find(_dated("created_at", bounds), {"service_id": 1, "service_name": 1}):
        by_id[str(b.get("service_id") or "")] += 1
        by_name[b.get("service_name") or ""] += 1
    rows = []
    async for s in _db()["services"].find({}).sort("name", 1):
        n = by_id.get(str(s["_id"]), 0) or by_name.get(s.get("name", ""), 0)
        rows.append([s.get("name"), s.get("type"), s.get("duration"), s.get("price"), s.get("status"), n])
    return rows


async def _feedback(bounds):
    rows = []
    async for f in _db()["feedback"].find(_dated("date", bounds)).sort("date", -1):
        rows.append([f.get("date"), f.get("user_name"), f.get("user_email"), f.get("type"), f.get("program"),
                     f.get("rating"), f.get("sentiment"), f.get("status"), f.get("text")])
    return rows


async def _orders(bounds):
    people = await _people()
    rows = []
    async for o in _db()["orders"].find(_dated("created_at", bounds)).sort("created_at", -1):
        name, email = _who(people, o)
        minor = o.get("amount_minor") or 0
        refunded = o.get("refunded_minor") or 0
        rows.append([o.get("created_at"), name, email, o.get("purpose"), o.get("title"),
                     f"{minor / 100:.2f}", o.get("currency") or "INR", o.get("status"), o.get("provider"),
                     o.get("method"), f"{refunded / 100:.2f}" if refunded else "", o.get("failure_reason")])
    return rows


async def _event_registrations(bounds):
    people = await _people()
    rows = []
    async for r in _db()["event_registrations"].find(_dated("created_at", bounds)).sort("created_at", -1):
        name, email = _who(people, r)
        rows.append([r.get("created_at"), name, email, r.get("event_title"), r.get("status")])
    return rows


async def _applications(bounds):
    people = await _people()
    rows = []
    async for a in _db()["applications"].find(_dated("created_at", bounds)).sort("created_at", -1):
        name, email = _who(people, a)
        rows.append([a.get("created_at"), name, email, a.get("opportunity_title"), a.get("org"),
                     a.get("status"), a.get("updated_at")])
    return rows


async def _safety_summary(bounds):
    """Counts only. The rows behind them can name a woman and whom she reported."""
    counts: Counter = Counter()
    async for r in _db()["safety_reports"].find(_dated("created_at", bounds), {"category": 1, "status": 1}):
        counts[(r.get("category") or "Uncategorised", r.get("status") or "unknown")] += 1
    return [[cat, st, n] for (cat, st), n in sorted(counts.items())]


async def _activity_log(bounds):
    rows = []
    async for a in _db()["activity_log"].find(_dated("created_at", bounds)).sort("created_at", -1).limit(5000):
        rows.append([a.get("created_at"), a.get("user_name"), a.get("action"), a.get("category"),
                     a.get("target"), a.get("detail"), a.get("ip")])
    return rows


Builder = Callable[[Optional[tuple[datetime, datetime]]], Awaitable[list[list[Any]]]]

#: key → definition. Order is the order the screen lists them in.
CATALOGUE: dict[str, dict] = {
    "members": dict(
        name="Members directory", category="User Activity", icon="Users", dated=True,
        description="Every member in the directory with her role, status, segment and how she found WomSakhi.",
        columns=["Code", "Name", "Email", "Phone", "Role", "Status", "Location", "Segment", "Referral", "Verified on", "Joined"],
        build=_members,
    ),
    "bookings": dict(
        name="Bookings & appointments", category="Appointments", icon="CalendarDays", dated=True,
        description="Every session a member booked: the service, when, how, what it cost and what became of it.",
        columns=["Booked at", "Member", "Email", "Service", "Date", "Time", "Mode", "With", "Duration", "Price", "Status", "Cancelled reason"],
        build=_bookings,
    ),
    "enrollments": dict(
        name="Programme enrolments", category="Program & Services", icon="GraduationCap", dated=True,
        description="Who joined which programme, how far she has got, and when she last showed up.",
        columns=["Enrolled at", "Member", "Email", "Programme", "Status", "Progress %", "Sessions attended", "Last activity", "Completed at"],
        build=_enrollments,
    ),
    "programs": dict(
        name="Programme catalogue", category="Program & Services", icon="BriefcaseBusiness", dated=False,
        description="Each programme with its capacity, live enrolment count and completion rate.",
        columns=["Programme", "Category", "Mode", "Duration", "Dates", "Status", "Capacity", "Enrolled (live)", "Completion rate"],
        build=_programs,
    ),
    "services": dict(
        name="Services & bookings", category="Program & Services", icon="BriefcaseBusiness", dated=True,
        description="Each service with the number of times it was booked in the chosen window.",
        columns=["Service", "Type", "Duration", "Price", "Status", "Bookings"],
        build=_services,
    ),
    "feedback": dict(
        name="Feedback", category="Program & Services", icon="MessageSquareHeart", dated=True,
        description="What members wrote about programmes and services, with rating, sentiment and status.",
        columns=["Date", "Member", "Email", "Type", "Programme", "Rating", "Sentiment", "Status", "Feedback"],
        build=_feedback,
    ),
    "orders": dict(
        name="Payments & orders", category="Financial", icon="DollarSign", dated=True,
        description="Every order a member placed, with amount, provider, status and any refund.",
        columns=["Created at", "Member", "Email", "Purpose", "Title", "Amount", "Currency", "Status", "Provider", "Method", "Refunded", "Failure reason"],
        build=_orders,
    ),
    "event-registrations": dict(
        name="Event registrations", category="Marketing", icon="Megaphone", dated=True,
        description="Who registered for which event.",
        columns=["Registered at", "Member", "Email", "Event", "Status"],
        build=_event_registrations,
    ),
    "applications": dict(
        name="Opportunity applications", category="Others", icon="FileText", dated=True,
        description="Applications members made to opportunities, and where each one stands.",
        columns=["Applied at", "Member", "Email", "Opportunity", "Organisation", "Status", "Last updated"],
        build=_applications,
    ),
    "safety-summary": dict(
        name="Safety reports (summary)", category="Others", icon="ShieldAlert", dated=True,
        description="How many safety reports were filed, by category and status. Counts only.",
        privacy_note="No report text, reporter or subject is included: the rows behind these counts can name a woman and the person she reported.",
        columns=["Category", "Status", "Reports"],
        build=_safety_summary,
    ),
    "activity-log": dict(
        name="Staff activity log", category="Others", icon="FileClock", dated=True,
        description="Who did what on the dashboard: every recorded staff action, newest first (up to 5,000 rows).",
        columns=["At", "Staff", "Action", "Category", "Target", "Detail", "IP"],
        build=_activity_log,
    ),
}


def _definition(key: str) -> dict:
    d = CATALOGUE.get(key)
    if not d:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such report")
    return d


async def _last_runs() -> dict[str, dict]:
    """Latest run per report, plus run counts, from report_runs."""
    latest: dict[str, dict] = {}
    counts: Counter = Counter()
    async for r in _db()[RUNS].find({}).sort("created_at", -1):
        counts[r.get("report_key", "")] += 1
        latest.setdefault(r.get("report_key", ""), r)
    return {"latest": latest, "counts": counts}


def _run_summary(r: Optional[dict]) -> Optional[dict]:
    if not r:
        return None
    return {
        "at": r["created_at"].isoformat() if isinstance(r.get("created_at"), datetime) else "",
        "by": r.get("run_by_name", ""),
        "rows": int(r.get("rows", 0)),
        "range_label": r.get("range_label", "All time"),
    }


# --- Endpoints ----------------------------------------------------------------------
@router.get("", response_model=ReportListResponse, summary="The reports that can be generated",
    dependencies=[Depends(require_permission("reports.view"))],
)
async def list_reports(
    q: Optional[str] = Query(None, description="Search name, description or category"),
    category: Optional[str] = Query(None),
):
    runs = await _last_runs()
    items = []
    needle = (q or "").strip().lower()
    for key, d in CATALOGUE.items():
        if category and category not in ("All Categories", "all") and d["category"] != category:
            continue
        if needle and needle not in f"{d['name']} {d['description']} {d['category']}".lower():
            continue
        items.append({
            "key": key, "name": d["name"], "description": d["description"], "category": d["category"],
            "tone": CATEGORY_TONE.get(d["category"], "slate"), "icon": d["icon"], "columns": d["columns"],
            "dated": d["dated"], "privacy_note": d.get("privacy_note", ""),
            "last_run": _run_summary(runs["latest"].get(key)), "runs": runs["counts"].get(key, 0),
        })
    return ReportListResponse(items=items, total=len(items))


@router.get("/stats", response_model=ReportsStatsResponse, summary="How the reports are being used",
    dependencies=[Depends(require_permission("reports.view"))],
)
async def report_stats():
    now = _now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    prev_start = (month_start - timedelta(days=1)).replace(day=1)
    runs = [r async for r in _db()[RUNS].find({}, {"report_key": 1, "report_name": 1, "category": 1, "rows": 1, "created_at": 1, "run_by_name": 1}).sort("created_at", -1)]

    def _in(r, a, b):
        t = r.get("created_at")
        return isinstance(t, datetime) and a <= (t if t.tzinfo else t.replace(tzinfo=timezone.utc)) < b

    this_month = [r for r in runs if _in(r, month_start, now)]
    last_month = [r for r in runs if _in(r, prev_start, month_start)]
    delta = None
    if last_month:
        change = round((len(this_month) - len(last_month)) / len(last_month) * 100)
        delta = f"{abs(change)}%"

    by_cat: Counter = Counter(r.get("category", "Others") for r in runs)
    total_runs = sum(by_cat.values())
    top = [
        {"name": name, "value": round(n / total_runs * 100), "runs": n, "color": CATEGORY_COLORS.get(name, "#94a3b8")}
        for name, n in by_cat.most_common()
    ] if total_runs else []
    by_key: Counter = Counter(r.get("report_key", "") for r in runs)
    most = [
        {"key": k, "name": CATALOGUE.get(k, {}).get("name", k), "runs": n}
        for k, n in by_key.most_common(5) if k in CATALOGUE
    ]
    last = runs[0] if runs else None
    return ReportsStatsResponse(
        available=len(CATALOGUE),
        generated_this_month=len(this_month),
        generated_last_month=len(last_month),
        generated_delta=delta,
        generated_up=len(this_month) >= len(last_month),
        rows_this_month=sum(int(r.get("rows", 0)) for r in this_month),
        last_generated_at=last["created_at"].isoformat() if last and isinstance(last.get("created_at"), datetime) else None,
        last_generated_by=(last or {}).get("run_by_name", ""),
        top_categories=top,
        most_used=most,
    )


@router.get("/runs", response_model=list[ReportRunResponse], summary="Recent generations",
    dependencies=[Depends(require_permission("reports.view"))],
)
async def recent_runs(limit: int = Query(8, ge=1, le=100)):
    out = []
    async for r in _db()[RUNS].find({}).sort("created_at", -1).limit(limit):
        out.append({
            "id": str(r["_id"]), "report_key": r.get("report_key", ""), "report_name": r.get("report_name", ""),
            "category": r.get("category", ""), "by": r.get("run_by_name", ""),
            "at": r["created_at"].isoformat() if isinstance(r.get("created_at"), datetime) else "",
            "rows": int(r.get("rows", 0)), "range_label": r.get("range_label", "All time"),
            "duration_ms": int(r.get("duration_ms", 0)),
        })
    return out


@router.get("/{key}/preview", response_model=ReportPreviewResponse, summary="The first rows, and how many there are",
    dependencies=[Depends(require_permission("reports.view"))],
)
async def preview_report(key: str, date_range: Optional[str] = Query(None), limit: int = Query(8, ge=1, le=50)):
    d = _definition(key)
    bounds = _range_bounds(date_range) if d["dated"] else None
    rows = await d["build"](bounds)
    return ReportPreviewResponse(
        key=key, name=d["name"], columns=d["columns"], total=len(rows),
        range_label=(date_range or "All time") if d["dated"] else "All time",
        rows=[[_fmt(c) for c in r] for r in rows[:limit]],
    )


@router.get("/{key}/generate", summary="Generate the report as CSV",
    dependencies=[Depends(require_permission("reports.export"))],
)
async def generate_report(key: str, request: Request, date_range: Optional[str] = Query(None), me: dict = Depends(get_current_user)):
    d = _definition(key)
    bounds = _range_bounds(date_range) if d["dated"] else None
    label = (date_range or "All time") if d["dated"] else "All time"
    started = time.monotonic()
    rows = await d["build"](bounds)
    duration_ms = int((time.monotonic() - started) * 1000)

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(d["columns"])
    for r in rows:
        w.writerow([_fmt(c) for c in r])

    run = {
        "report_key": key, "report_name": d["name"], "category": d["category"],
        "run_by": str(me.get("_id", "")), "run_by_name": me.get("full_name", "") or me.get("email", ""),
        "range_label": label, "start": bounds[0] if bounds else None, "end": bounds[1] if bounds else None,
        "rows": len(rows), "duration_ms": duration_ms, "created_at": _now(),
    }
    result = await _db()[RUNS].insert_one(run)
    await record(me, "report.generate", target=str(result.inserted_id),
                 detail=f"Generated '{d['name']}' ({label}): {len(rows)} row{'s' if len(rows) != 1 else ''}", request=request)
    filename = f"{key}-{_now().strftime('%Y%m%d-%H%M')}.csv"
    return Response(
        content=buf.getvalue(), media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


async def seed() -> None:
    """
    Nothing to seed. Reports are defined in code and generated from the real
    collections; the old `reports` and `reports_overview` rows this used to
    insert are no longer read by anything.
    """
    return None
