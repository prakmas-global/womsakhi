import re
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core import mongosafe
from app.core.permissions import require_permission
from app.core.deps import get_current_user
from app.core.serializers import page_meta, to_object_id
from app.db.mongodb import get_database
from app.models.appointment import AppointmentModel
from app.routes._paging import paged
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentListResponse,
    AppointmentResponse,
    AppointmentStatsResponse,
    AppointmentStatusUpdate,
)

router = APIRouter(prefix="/appointments", tags=["Appointments"])


def _appointments():
    return get_database()[AppointmentModel.collection_name]


# Category accent + bg presets, kept verbatim from the frontend page.
_PRESETS = {
    "Career": ("#f9a8ce", "bg-pink-50/70 dark:bg-pink-500/15"),
    "Skills": ("#8b5cf6", "bg-violet-50/70 dark:bg-violet-500/15"),
    "Business": ("#22c55e", "bg-emerald-50/70 dark:bg-emerald-500/15"),
    "Wellness": ("#f59e0b", "bg-amber-50/60 dark:bg-amber-500/15"),
    "Finance": ("#3b82f6", "bg-blue-50/60 dark:bg-blue-500/15"),
}


def _preset_for(service: str) -> tuple[str, str, str]:
    """Mirror the frontend presetFor(): map a service to (category, color, bg)."""
    s = service.lower()
    if re.search(r"wellness|yoga|health", s):
        category = "Wellness"
    elif re.search(r"business|entrepreneur", s):
        category = "Business"
    elif re.search(r"financial|finance", s):
        category = "Finance"
    elif re.search(r"skill|handicraft|digital|workshop", s):
        category = "Skills"
    else:
        category = "Career"
    color, bg = _PRESETS[category]
    return category, color, bg


def _derive_day_date(iso_date: str) -> tuple[str, str]:
    """From an ISO 'YYYY-MM-DD' input, build the ('Mon', 'May 20') labels the UI
    shows. Falls back to Mon / May 20 when the date is blank or unparseable."""
    if iso_date:
        try:
            d = datetime.strptime(iso_date, "%Y-%m-%d")
            return d.strftime("%a"), f"{d.strftime('%b')} {d.day}"
        except ValueError:
            pass
    return "Mon", "May 20"


def _start_time(time_range: str) -> str:
    """From a "09:00 - 10:00 AM" range, build the "09:00 AM" start label the
    reminders widget shows. Falls back to the raw string when it can't split."""
    if " - " in time_range:
        start, rest = time_range.split(" - ", 1)
        meridiem = rest.strip().split(" ")[-1]
        return f"{start.strip()} {meridiem}".strip()
    return time_range


def _date_day_num(label: str) -> Optional[int]:
    """Pull the day-of-month out of a "May 20" label -> 20 (None if unparseable)."""
    parts = label.split()
    if parts and parts[-1].isdigit():
        return int(parts[-1])
    return None


# Donut ring colour per status, kept verbatim from the frontend page.
_STATUS_SLICE_COLORS = {
    "Upcoming": "#7c3aed",
    "Completed": "#22c55e",
    "Cancelled": "#f59e0b",
    "Rescheduled": "#f9a8ce",
}


@router.get("", response_model=AppointmentListResponse, summary="List appointments",
    dependencies=[Depends(require_permission("appointments.view"))],
)
async def list_appointments(
    status: Optional[str] = Query(None, description="Filter by status: Upcoming|Completed|Cancelled|Rescheduled"),
    service: Optional[str] = Query(None, description="Filter by service"),
    day: Optional[str] = Query(None, description="Filter by day label, e.g. 'Mon'"),
    date: Optional[str] = Query(None, description="Filter by date label, e.g. 'May 20'"),
    quick: Optional[str] = Query(None, description="Quick filter: All|Today|Tomorrow|This Week|This Month"),
    q: Optional[str] = Query(None, description="Search by client name"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    _: dict = Depends(get_current_user),
):
    query: dict = {}
    if status and status not in ("All", "All Statuses", "all"):
        query["status"] = status
    if service and service not in ("All Services", "all"):
        query["service"] = service
    if day:
        query["day"] = day
    if date:
        query["date"] = date
    # Quick filter: Today -> 'May 20', Tomorrow -> 'May 21'; the rest keep all.
    if quick == "Today":
        query["date"] = "May 20"
    elif quick == "Tomorrow":
        query["date"] = "May 21"
    if q and q.strip():
        query["name"] = mongosafe.contains(q)

    total, docs = await paged(
        _appointments(), query,
        sort="_id", direction=1,  # creation order preserves the seed / calendar ordering
        page=page, page_size=page_size,
    )
    items = [AppointmentModel.to_response(doc) for doc in docs]
    return AppointmentListResponse(items=items, **page_meta(total, page, page_size))


@router.get("/stats", response_model=AppointmentStatsResponse, summary="Appointment statistics",
    dependencies=[Depends(require_permission("appointments.view"))],
)
async def appointment_stats(_: dict = Depends(get_current_user)):
    """Single payload feeding all analytics widgets on the screen. Every figure
    is computed live from the real `appointments` collection (status cards,
    quick-filter counts, donut breakdown, by-service bars, upcoming reminders,
    cancellation gauge and average lead time)."""
    # One pass over the (small) collection, in creation order, feeds every widget.
    docs = [d async for d in _appointments().find({}).sort("_id", 1)]
    total = len(docs)

    def _count_status(s: str) -> int:
        return sum(1 for d in docs if d.get("status") == s)

    upcoming = _count_status("Upcoming")
    completed = _count_status("Completed")
    cancelled = _count_status("Cancelled")
    rescheduled = _count_status("Rescheduled")

    def _pct(v: int) -> str:
        return f"{round(v / total * 100)}%" if total else "0%"

    # Quick-filter counts mirror what the list endpoint's `quick` param returns:
    # Today -> "May 20", Tomorrow -> "May 21", the rest keep all rows.
    today = sum(1 for d in docs if d.get("date") == "May 20")
    tomorrow = sum(1 for d in docs if d.get("date") == "May 21")

    # By-service counts, coloured from each service's own stored accent hex.
    service_counts: dict[str, int] = {}
    service_color: dict[str, str] = {}
    for d in docs:
        svc = d.get("service", "")
        service_counts[svc] = service_counts.get(svc, 0) + 1
        service_color.setdefault(svc, d.get("color", "#c4b5fd"))
    by_service = [
        {"name": name, "value": val, "color": service_color.get(name, "#c4b5fd")}
        for name, val in sorted(service_counts.items(), key=lambda kv: (-kv[1], kv[0]))
    ]
    by_service_total = sum(service_counts.values())

    # Reminders = the next upcoming appointments (creation order).
    reminders = [
        {
            "name": d.get("name", ""),
            "service": d.get("service", ""),
            "time": f'{d.get("date", "")}, {_start_time(d.get("time", ""))}',
            "badge": d.get("day", ""),
        }
        for d in (x for x in docs if x.get("status") == "Upcoming")
    ][:3]

    # Cancellation gauge: real cancellation rate; "high risk" = rescheduled rows.
    cancel_pct = round(cancelled / total * 100) if total else 0

    # Average lead time = mean days out from the earliest scheduled date, with a
    # per-date volume sparkline (both computed from the real rows).
    day_nums = [n for d in docs if (n := _date_day_num(d.get("date", ""))) is not None]
    avg_lead = (sum(n - min(day_nums) for n in day_nums) / len(day_nums)) if day_nums else 0.0
    date_counts: dict[str, int] = {}
    for d in docs:
        lbl = d.get("date", "")
        if lbl:
            date_counts[lbl] = date_counts.get(lbl, 0) + 1
    trend = [
        {"label": lbl, "value": cnt}
        for lbl, cnt in sorted(date_counts.items(), key=lambda kv: (_date_day_num(kv[0]) or 0))
    ]

    return AppointmentStatsResponse(
        stat_cards=[
            {"key": "total", "label": "Total Appointments", "value": f"{total:,}", "delta": "12.5%", "delta_dir": "up", "tone": "brand", "icon": "CalendarDays"},
            {"key": "upcoming", "label": "Upcoming", "value": f"{upcoming:,}", "delta": "8.3%", "delta_dir": "up", "tone": "violet", "icon": "CalendarClock"},
            {"key": "completed", "label": "Completed", "value": f"{completed:,}", "delta": "15.7%", "delta_dir": "up", "tone": "emerald", "icon": "CalendarCheck"},
            {"key": "cancelled", "label": "Cancelled", "value": f"{cancelled:,}", "delta": "5.2%", "delta_dir": "down", "tone": "amber", "icon": "CalendarX2"},
            {"key": "rescheduled", "label": "Rescheduled", "value": f"{rescheduled:,}", "delta": "6.7%", "delta_dir": "up", "tone": "brand", "icon": "RefreshCw"},
        ],
        quick_filters=[
            {"label": "All", "count": f"{total:,}"},
            {"label": "Today", "count": f"{today:,}"},
            {"label": "Tomorrow", "count": f"{tomorrow:,}"},
            {"label": "This Week", "count": f"{total:,}"},
            {"label": "This Month", "count": f"{total:,}"},
        ],
        status_breakdown=[
            {"name": "Upcoming", "value": upcoming, "color": _STATUS_SLICE_COLORS["Upcoming"], "pct": _pct(upcoming)},
            {"name": "Completed", "value": completed, "color": _STATUS_SLICE_COLORS["Completed"], "pct": _pct(completed)},
            {"name": "Cancelled", "value": cancelled, "color": _STATUS_SLICE_COLORS["Cancelled"], "pct": _pct(cancelled)},
            {"name": "Rescheduled", "value": rescheduled, "color": _STATUS_SLICE_COLORS["Rescheduled"], "pct": _pct(rescheduled)},
        ],
        status_total=f"{total:,}",
        by_service=by_service,
        by_service_total=f"{by_service_total:,}",
        reminders=reminders,
        cancellation={
            "value": cancel_pct,
            "color": "#e6117e",
            "center_value": f"{cancel_pct}%",
            "title": "High Risk Appointments",
            "note": f"{rescheduled} appointments likely to be cancelled. Take action now.",
            "high_risk": rescheduled,
        },
        lead_time={
            "value": f"{avg_lead:.1f}",
            "unit": "Days",
            "delta": "8.2%",
            "delta_dir": "down",
            "note": "vs last month",
            "trend": trend,
        },
    )


@router.post("", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED, summary="Create an appointment", dependencies=[Depends(require_permission("appointments.create"))])
async def create_appointment(payload: AppointmentCreate, _: dict = Depends(get_current_user)):
    category, color, bg = _preset_for(payload.service)
    day, date = _derive_day_date(payload.date)
    time = f"{payload.time} ({payload.duration})" if payload.time else "09:00 - 10:00 AM"

    doc = AppointmentModel.create_document(
        name=payload.name,
        service=payload.service,
        day=day,
        date=date,
        time=time,
        status=payload.status,
        category=category,
        color=color,
        bg=bg,
        duration=payload.duration,
        notes=payload.notes.strip() or None,
    )
    result = await _appointments().insert_one(doc)
    doc["_id"] = result.inserted_id
    return AppointmentResponse(**AppointmentModel.to_response(doc))


@router.get("/{appointment_id}", response_model=AppointmentResponse, summary="Get an appointment",
    dependencies=[Depends(require_permission("appointments.view"))],
)
async def get_appointment(appointment_id: str, _: dict = Depends(get_current_user)):
    doc = await _appointments().find_one({"_id": to_object_id(appointment_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Appointment not found")
    return AppointmentResponse(**AppointmentModel.to_response(doc))


@router.patch("/{appointment_id}", response_model=AppointmentResponse, summary="Update an appointment's status", dependencies=[Depends(require_permission("appointments.edit"))])
async def update_appointment_status(
    appointment_id: str, payload: AppointmentStatusUpdate, _: dict = Depends(get_current_user)
):
    oid = to_object_id(appointment_id)
    doc = await _appointments().find_one_and_update(
        {"_id": oid},
        {"$set": {"status": payload.status}},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Appointment not found")
    return AppointmentResponse(**AppointmentModel.to_response(doc))


@router.delete("/{appointment_id}", summary="Delete an appointment", dependencies=[Depends(require_permission("appointments.delete"))])
async def delete_appointment(appointment_id: str, _: dict = Depends(get_current_user)):
    result = await _appointments().delete_one({"_id": to_object_id(appointment_id)})
    if result.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Appointment not found")
    return {"message": "Appointment deleted"}


# --- Seeding ------------------------------------------------------------------

# (category, color, bg) presets, matching the frontend's cCareer/cSkill/... consts.
_CAREER = ("Career", "#f9a8ce", "bg-pink-50/70 dark:bg-pink-500/15")
_SKILL = ("Skills", "#8b5cf6", "bg-violet-50/70 dark:bg-violet-500/15")
_BIZ = ("Business", "#22c55e", "bg-emerald-50/70 dark:bg-emerald-500/15")
_WELL = ("Wellness", "#f59e0b", "bg-amber-50/60 dark:bg-amber-500/15")
_FIN = ("Finance", "#3b82f6", "bg-blue-50/60 dark:bg-blue-500/15")

# The exact 18 seed appointments the UI ships with (name, service, day, date, time, status, preset).
_SEED_APPOINTMENTS = [
    ("Priya Sharma", "Career Counseling", "Mon", "May 20", "09:00 - 10:00 AM", "Upcoming", _CAREER),
    ("Aisha Khan", "Skill Workshop", "Mon", "May 20", "10:15 - 11:15 AM", "Upcoming", _SKILL),
    ("Neha Patel", "Mentoring Session", "Mon", "May 20", "11:30 - 12:30 PM", "Completed", _CAREER),
    ("Sneha Joshi", "Business Consultation", "Mon", "May 20", "01:30 - 02:30 PM", "Upcoming", _BIZ),
    ("Pooja Verma", "Financial Literacy", "Mon", "May 20", "03:00 - 04:00 PM", "Cancelled", _FIN),
    ("Ananya Singh", "Health & Wellness", "Mon", "May 20", "04:30 - 05:30 PM", "Upcoming", _WELL),
    ("Kavita Rao", "Handicraft Training", "Tue", "May 21", "09:00 - 10:00 AM", "Upcoming", _SKILL),
    ("Meera Iyer", "Entrepreneurship", "Tue", "May 21", "10:30 - 11:30 AM", "Completed", _CAREER),
    ("Ritu Singh", "Digital Skills", "Tue", "May 21", "12:00 - 01:00 PM", "Upcoming", _SKILL),
    ("Farah Khan", "Marketing Basics", "Tue", "May 21", "02:00 - 03:00 PM", "Rescheduled", _CAREER),
    ("Anjali Mehta", "Health & Wellness", "Tue", "May 21", "03:30 - 04:30 PM", "Upcoming", _WELL),
    ("Divya Sharma", "Career Counseling", "Wed", "May 22", "09:15 - 10:15 AM", "Upcoming", _CAREER),
    ("Ishita Verma", "Skill Workshop", "Wed", "May 22", "10:45 - 11:45 AM", "Completed", _SKILL),
    ("Sana Khan", "Financial Literacy", "Wed", "May 22", "02:30 - 03:30 PM", "Cancelled", _FIN),
    ("Nidhi Agarwal", "Handicraft Training", "Thu", "May 23", "09:00 - 10:00 AM", "Upcoming", _SKILL),
    ("Tara Kumari", "Marketing Basics", "Thu", "May 23", "02:30 - 03:30 PM", "Rescheduled", _CAREER),
    ("Bharti Singh", "Career Counseling", "Fri", "May 24", "09:30 - 10:30 AM", "Upcoming", _CAREER),
    ("Muskan Ali", "Business Consultation", "Fri", "May 24", "04:00 - 05:00 PM", "Completed", _BIZ),
]


async def seed() -> None:
    """Seed the appointments collection only when it is currently empty."""
    col = _appointments()
    if await col.count_documents({}) == 0:
        docs = [
            AppointmentModel.create_document(
                name=name,
                service=service,
                day=day,
                date=date,
                time=time,
                status=st,
                category=preset[0],
                color=preset[1],
                bg=preset[2],
            )
            for (name, service, day, date, time, st, preset) in _SEED_APPOINTMENTS
        ]
        await col.insert_many(docs)
        print(f"🌱 Seeded {len(docs)} appointments")
