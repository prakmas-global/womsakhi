"""
Programmes — the admin side.

── What changed ───────────────────────────────────────────────────────────────
The programme document carries an `enrolled` counter that the member app bumps
on join and leave, and that the seed wrote by hand (98 / 150 on a programme
with seven real enrolment rows). Every number this router returns to the admin
screen is now COUNTED from the `enrollments` collection: who is enrolled, how
many finished, how far the rest have got. The stored counter is still returned
— as `seat_counter` — because the member catalogue reads it for "seats left",
and an admin needs to see when it disagrees with reality and be able to fix it.

Every write is guarded by a `programs.*` permission and written to the audit
trail. The member-facing shapes (`ProgramModel.to_response`, catalog, me) are
not touched; this file only ever adds fields on top of them.
"""

import asyncio
import csv
import io
from datetime import datetime, timedelta, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status

from app.core import mongosafe
from app.core.audit import record
from app.core.deps import get_current_user
from app.core.permissions import require_permission
from app.core.serializers import page_meta, to_object_id
from app.db.mongodb import get_database
from app.models.conversation import MemberNotificationModel, notify
from app.models.enrollment import EnrollmentModel
from app.models.program import ProgramModel
from app.routes.catalog import OPEN_PROGRAM_STATUSES
from app.schemas.program_admin import (
    AdminCategory,
    AdminProgramCreate,
    AdminProgramUpdate,
    AdminProgramList,
    AdminProgramOverview,
    AdminProgramRow,
    AdminProgramStats,
    EnrolmentList,
    EnrolmentRow,
    EnrolmentStatusUpdate,
    ModulesUpdate,
    OverviewPoint,
)

router = APIRouter(prefix="/programs", tags=["Programs"])


def _programs():
    return get_database()[ProgramModel.collection_name]


def _enrollments():
    return get_database()[EnrollmentModel.collection_name]


def _users():
    return get_database()["users"]


#: Statuses that mean "running now". The seed wrote "Running"; the admin form
#: writes "Active"; the catalogue also knows "Ongoing" and "Published".
LIVE_STATUSES = ("Active", "Running", "Ongoing", "Published")

_SORTS = {
    "Newest First": ("created_at", -1),
    "Oldest First": ("created_at", 1),
    # Sorted after the live count is known — see list_programs.
    "Most Enrolled": ("created_at", -1),
    "Completion Rate": ("created_at", -1),
}

_EMPTY_ROLL = {"active": 0, "completed": 0, "withdrawn": 0, "progress": 0}


# --- Small helpers -----------------------------------------------------------

def _naive_utc(dt) -> Optional[datetime]:
    """Motor hands back naive UTC datetimes; anything we compare against them
    must be naive too, or Python raises. Aware inputs are converted, not
    trusted to already be UTC."""
    if not isinstance(dt, datetime):
        return None
    return dt.astimezone(timezone.utc).replace(tzinfo=None) if dt.tzinfo else dt


def _iso(dt) -> str:
    d = _naive_utc(dt)
    return d.replace(tzinfo=timezone.utc).isoformat() if d else ""


def _display(dt) -> str:
    d = _naive_utc(dt)
    return d.strftime("%b %d, %Y") if d else ""


def _format_schedule(raw: str) -> str:
    """A date input gives '2026-10-01'; the screen shows 'Oct 01, 2026'. Free
    text ('Oct 01 - Nov 26, 2026') is kept as typed."""
    s = (raw or "").strip()
    if not s:
        return ""
    try:
        return datetime.strptime(s, "%Y-%m-%d").strftime("%b %d, %Y")
    except ValueError:
        return s[:80]


def _derive(roll: dict) -> tuple[int, int, int]:
    """(enrolled, completion_rate, avg_progress) from one programme's rollup."""
    enrolled = roll["active"] + roll["completed"]
    rate = round(roll["completed"] / enrolled * 100) if enrolled else 0
    avg = round(roll["progress"] / enrolled) if enrolled else 0
    return enrolled, rate, max(0, min(100, avg))


async def _enrolment_rollup() -> dict[str, dict]:
    """Per programme: how many active / completed / withdrawn enrolments, and
    the summed progress of the ones that count. One aggregate, not one query
    per programme."""
    out: dict[str, dict] = {}
    pipeline = [
        {"$group": {
            "_id": {"program": "$program_id", "status": "$status"},
            "n": {"$sum": 1},
            "progress": {"$sum": {"$ifNull": ["$progress", 0]}},
        }},
    ]
    async for row in _enrollments().aggregate(pipeline):
        key = row["_id"] or {}
        pid = str(key.get("program") or "")
        st = key.get("status") or EnrollmentModel.STATUS_ACTIVE
        r = out.setdefault(pid, dict(_EMPTY_ROLL))
        n = int(row.get("n") or 0)
        if st == EnrollmentModel.STATUS_WITHDRAWN:
            r["withdrawn"] += n
        elif st == EnrollmentModel.STATUS_COMPLETED:
            r["completed"] += n
            r["progress"] += int(row.get("progress") or 0)
        else:
            r["active"] += n
            r["progress"] += int(row.get("progress") or 0)
    return out


def _admin_row(doc: dict, rollup: dict[str, dict]) -> dict:
    """The member shape plus the live figures. `enrolled` and `pct` are
    OVERRIDDEN with counted values; the stored counter moves to `seat_counter`."""
    base = ProgramModel.to_response(doc)
    roll = rollup.get(str(doc["_id"])) or _EMPTY_ROLL
    enrolled, rate, avg = _derive(roll)
    cap = int(doc.get("cap") or 0)
    modules = [m for m in (doc.get("curriculum") or []) if isinstance(m, dict)]
    base.update(
        enrolled=enrolled,
        pct=min(100, round(enrolled / cap * 100)) if cap else 0,
        curriculum=modules,
        seat_counter=int(doc.get("enrolled") or 0),
        active_enrolled=roll["active"],
        completed=roll["completed"],
        withdrawn=roll["withdrawn"],
        completion_rate=rate,
        avg_progress=avg,
        module_count=len(modules),
        visible_to_members=doc.get("status") in OPEN_PROGRAM_STATUSES,
        created_at=_iso(doc.get("created_at")),
        updated_at=_iso(doc.get("updated_at")),
    )
    return base


async def _row_for(program_id: str) -> dict:
    oid = to_object_id(program_id)
    doc, rollup = await asyncio.gather(
        _programs().find_one({"_id": oid}), _enrolment_rollup(),
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Program not found")
    return _admin_row(doc, rollup)


async def _get_or_404(program_id: str) -> dict:
    doc = await _programs().find_one({"_id": to_object_id(program_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Program not found")
    return doc


async def _sync_seat_counter(program_id: str) -> None:
    """Write the live count back onto the programme so the member catalogue's
    'seats left' and 'full' match who is actually enrolled."""
    n = await _enrollments().count_documents({
        "program_id": program_id,
        "status": {"$ne": EnrollmentModel.STATUS_WITHDRAWN},
    })
    doc = await _programs().find_one({"_id": to_object_id(program_id)}, {"cap": 1})
    cap = int((doc or {}).get("cap") or 0)
    await _programs().update_one(
        {"_id": to_object_id(program_id)},
        {"$set": {
            "enrolled": n,
            "pct": min(100, round(n / cap * 100)) if cap else 0,
            "updated_at": datetime.now(timezone.utc),
        }},
    )


# --- Rollup builders ---------------------------------------------------------

async def _build_stats() -> AdminProgramStats:
    docs, rollup = await asyncio.gather(
        _programs().find({}, {"status": 1}).to_list(5000),
        _enrolment_rollup(),
    )
    ids = {str(d["_id"]) for d in docs}
    # Enrolments pointing at a programme that no longer exists are not counted
    # anywhere — they belong to nothing an admin can open.
    live = {pid: r for pid, r in rollup.items() if pid in ids}
    active_e = sum(r["active"] for r in live.values())
    completed_e = sum(r["completed"] for r in live.values())
    withdrawn_e = sum(r["withdrawn"] for r in live.values())
    progress = sum(r["progress"] for r in live.values())
    total_e = active_e + completed_e

    learners = await _enrollments().distinct("user_id", {
        "program_id": {"$in": list(ids)},
        "status": {"$ne": EnrollmentModel.STATUS_WITHDRAWN},
    }) if ids else []

    by_status = [d.get("status") for d in docs]
    return AdminProgramStats(
        total_programs=len(docs),
        active_programs=sum(1 for s in by_status if s in LIVE_STATUSES),
        upcoming_programs=sum(1 for s in by_status if s == "Upcoming"),
        total_enrollments=total_e,
        completion_rate=round(completed_e / total_e * 100) if total_e else 0,
        completed_programs=sum(1 for s in by_status if s == "Completed"),
        draft_programs=sum(1 for s in by_status if s == "Draft"),
        archived_programs=sum(1 for s in by_status if s == "Archived"),
        visible_programs=sum(1 for s in by_status if s in OPEN_PROGRAM_STATUSES),
        learners=len(learners),
        active_enrollments=active_e,
        completed_enrollments=completed_e,
        withdrawn_enrollments=withdrawn_e,
        avg_progress=max(0, min(100, round(progress / total_e))) if total_e else 0,
    )


def _next_month(d: datetime) -> datetime:
    return datetime(d.year + (d.month == 12), 1 if d.month == 12 else d.month + 1, 1)


def _buckets(range_: str, now: datetime) -> tuple[list[tuple[datetime, datetime, str]], str]:
    """The time buckets one overview point counts — (start, end, label)."""
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    if range_ == "This Week":
        starts = [today - timedelta(days=6 - i) for i in range(7)]
        return [(s, s + timedelta(days=1), s.strftime("%a")) for s in starts], "day"
    if range_ == "This Year":
        firsts: list[datetime] = []
        y, m = today.year, today.month
        for back in range(11, -1, -1):
            mm, yy = m - back, y
            while mm <= 0:
                mm, yy = mm + 12, yy - 1
            firsts.append(datetime(yy, mm, 1))
        return [(s, _next_month(s), s.strftime("%b")) for s in firsts], "month"
    weeks = 13 if range_ == "This Quarter" else 4
    starts = [today - timedelta(days=7 * (weeks - 1 - i)) for i in range(weeks)]
    return [(s, s + timedelta(days=7), s.strftime("%d %b")) for s in starts], "week"


async def _build_overview(range_: str) -> AdminProgramOverview:
    """Enrolments joined per bucket, plus how many programmes were created and
    how many enrolments finished, all inside the range."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    buckets, unit = _buckets(range_, now)
    since, until = buckets[0][0], buckets[-1][1]
    since_aware = since.replace(tzinfo=timezone.utc)

    enrol_rows, completed_n, new_programs = await asyncio.gather(
        _enrollments().find(
            {"created_at": {"$gte": since_aware}}, {"created_at": 1},
        ).to_list(50000),
        _enrollments().count_documents({
            "status": EnrollmentModel.STATUS_COMPLETED,
            "completed_at": {"$gte": since_aware},
        }),
        _programs().count_documents({"created_at": {"$gte": since_aware}}),
    )

    counts = [0] * len(buckets)
    joined = 0
    for e in enrol_rows:
        at = _naive_utc(e.get("created_at"))
        if at is None:
            continue
        for i, (s, end, _) in enumerate(buckets):
            if s <= at < end:
                counts[i] += 1
                joined += 1
                break

    return AdminProgramOverview(
        range=range_,
        series=[OverviewPoint(label=b[2], value=counts[i]) for i, b in enumerate(buckets)],
        new_programs=int(new_programs),
        enrollments=f"+{joined}",
        completions=f"+{int(completed_n)}",
        bucket=unit,
        since=since.replace(tzinfo=timezone.utc).isoformat(),
        until=until.replace(tzinfo=timezone.utc).isoformat(),
    )


async def _build_categories() -> list[AdminCategory]:
    """Each category's share of live enrolments, counted through the
    programmes in it. Categories with programmes but nobody enrolled still
    appear, at zero — an honest rail shows the catalogue as it is."""
    docs, rollup = await asyncio.gather(
        _programs().find({}, {"category": 1}).to_list(5000),
        _enrolment_rollup(),
    )
    count_by_cat: dict[str, int] = {}
    programs_by_cat: dict[str, int] = {}
    for d in docs:
        cat = d.get("category") or ""
        if not cat:
            continue
        roll = rollup.get(str(d["_id"])) or _EMPTY_ROLL
        count_by_cat[cat] = count_by_cat.get(cat, 0) + roll["active"] + roll["completed"]
        programs_by_cat[cat] = programs_by_cat.get(cat, 0) + 1
    total = sum(count_by_cat.values())
    ordered = sorted(count_by_cat.items(), key=lambda kv: (-kv[1], kv[0]))
    return [
        AdminCategory(
            name=name,
            value=round(n / total * 100) if total else 0,
            color=ProgramModel.bar_for(name),
            count=n,
            programs=programs_by_cat.get(name, 0),
        )
        for name, n in ordered
    ]


# --- Reads -------------------------------------------------------------------

@router.get("", response_model=AdminProgramList, summary="List programs",
    dependencies=[Depends(require_permission("programs.view"))],
)
async def list_programs(
    q: Optional[str] = Query(None, description="Search by program name or description"),
    status: Optional[str] = Query(None, description="Filter by status; 'Active' also matches Running/Ongoing/Published"),
    category: Optional[str] = Query(None, description="Filter by category"),
    mode: Optional[str] = Query(None, description="Filter by delivery mode"),
    tab: Optional[str] = Query(None, description="Active tab; acts as an extra status gate"),
    sort: str = Query("Newest First", description="Newest First | Oldest First | Most Enrolled | Completion Rate"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=500),
    _: dict = Depends(get_current_user),
):
    query: dict = {}

    def _status_clause(s: str):
        return {"$in": list(LIVE_STATUSES)} if s == "Active" else s

    if status and status not in ("All Status", "all"):
        query["status"] = _status_clause(status)
    if category and category not in ("All Categories", "all"):
        query["category"] = category
    if mode and mode not in ("All Modes", "all"):
        query["mode"] = mode
    if tab and tab not in ("All Programs", "All", "all"):
        query["status"] = _status_clause(tab)
    if q and q.strip():
        query.update(mongosafe.any_of(q, ["name", "desc"]))

    field, direction = _SORTS.get(sort, _SORTS["Newest First"])
    docs, rollup = await asyncio.gather(
        _programs().find(query).sort(field, direction).to_list(5000),
        _enrolment_rollup(),
    )
    rows = [_admin_row(d, rollup) for d in docs]
    # The live count is only known after the rollup, so these two sorts happen
    # here rather than in Mongo.
    if sort == "Most Enrolled":
        rows.sort(key=lambda r: (-r["enrolled"], r["name"].lower()))
    elif sort == "Completion Rate":
        rows.sort(key=lambda r: (-r["completion_rate"], -r["completed"], r["name"].lower()))

    total = len(rows)
    start = (page - 1) * page_size
    return AdminProgramList(items=rows[start:start + page_size], **page_meta(total, page, page_size))


@router.get("/stats", response_model=AdminProgramStats, summary="Program KPI cards",
    dependencies=[Depends(require_permission("programs.view"))],
)
async def program_stats(_: dict = Depends(get_current_user)):
    return await _build_stats()


@router.get("/overview", response_model=AdminProgramOverview, summary="Enrolments over time",
    dependencies=[Depends(require_permission("programs.view"))],
)
async def program_overview(
    range: str = Query("This Month", description="This Week | This Month | This Quarter | This Year"),
    _: dict = Depends(get_current_user),
):
    return await _build_overview(range)


@router.get("/categories", response_model=list[AdminCategory], summary="Top categories rail",
    dependencies=[Depends(require_permission("programs.view"))],
)
async def program_categories(_: dict = Depends(get_current_user)):
    return await _build_categories()


@router.get("/{program_id}", response_model=AdminProgramRow, summary="Get a program",
    dependencies=[Depends(require_permission("programs.view"))],
)
async def get_program(program_id: str, _: dict = Depends(get_current_user)):
    return AdminProgramRow(**await _row_for(program_id))


# --- Programme writes ---------------------------------------------------------

@router.post("", response_model=AdminProgramRow, status_code=status.HTTP_201_CREATED, summary="Create a program",
    dependencies=[Depends(require_permission("programs.create"))],
)
async def create_program(payload: AdminProgramCreate, request: Request, me: dict = Depends(get_current_user)):
    dates = _format_schedule(payload.startDate) or "To be scheduled"
    note = "Coming soon" if payload.status == "Upcoming" else payload.status
    doc = ProgramModel.create_document(
        name=payload.name,
        desc=payload.desc.strip(),
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
    await record(
        me, "program.create", target=str(doc["_id"]),
        detail=f"Created programme '{doc['name']}' ({payload.category}, {payload.mode}) as {payload.status}",
        request=request,
    )
    return AdminProgramRow(**_admin_row(doc, {}))


@router.patch("/{program_id}", response_model=AdminProgramRow, summary="Update a program",
    dependencies=[Depends(require_permission("programs.edit"))],
)
async def update_program(program_id: str, payload: AdminProgramUpdate, request: Request, me: dict = Depends(get_current_user)):
    oid = to_object_id(program_id)
    before = await _get_or_404(program_id)

    updates = payload.model_dump(exclude_unset=True)
    if "startDate" in updates:
        start = _format_schedule(updates.pop("startDate") or "")
        if start:
            updates["dates"] = start

    if updates.get("category"):
        updates["cat_tone"] = ProgramModel.tone_for(updates["category"])
        updates["bar"] = ProgramModel.bar_for(updates["category"])

    for key in ("name", "desc", "duration", "days"):
        if key in updates and isinstance(updates[key], str):
            updates[key] = updates[key].strip()
    if "name" in updates and not updates["name"]:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Program name cannot be empty")

    # Stored pct stays what the member catalogue expects: counter / cap.
    if "cap" in updates:
        cap = int(updates["cap"] or 0)
        counter = int(before.get("enrolled") or 0)
        updates["pct"] = min(100, round(counter / cap * 100)) if cap else 0

    if "status" in updates and updates["status"] != before.get("status"):
        updates["note"] = {
            "Upcoming": "Coming soon", "Completed": "Completed", "Archived": "Archived",
            "Draft": "Hidden from members", "Active": "Open to members",
        }.get(updates["status"], updates["status"])

    updates["updated_at"] = datetime.now(timezone.utc)
    doc = await _programs().find_one_and_update({"_id": oid}, {"$set": updates}, return_document=True)

    changed = sorted(
        k for k in updates
        if k not in ("updated_at", "cat_tone", "bar", "pct", "note") and before.get(k) != updates[k]
    )
    await record(
        me, "program.edit", target=program_id,
        detail=f"Edited '{doc.get('name', '')}': {', '.join(changed) or 'no field changed'}",
        request=request,
    )
    return AdminProgramRow(**_admin_row(doc, await _enrolment_rollup()))


@router.delete("/{program_id}", summary="Delete a program",
    dependencies=[Depends(require_permission("programs.delete"))],
)
async def delete_program(program_id: str, request: Request, me: dict = Depends(get_current_user)):
    doc = await _get_or_404(program_id)
    attached = await _enrollments().count_documents({"program_id": program_id})
    if attached:
        # Their history — progress, certificates keyed on this id — would be
        # orphaned. Archiving hides it from members and keeps all of that.
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{attached} member{'s have' if attached != 1 else ' has'} an enrolment record on this programme. "
            "Archive it instead so their history stays intact.",
        )
    result = await _programs().delete_one({"_id": doc["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Program not found")
    await record(
        me, "program.delete", target=program_id,
        detail=f"Deleted programme '{doc.get('name', '')}' (no enrolments)", request=request,
    )
    return {"message": "Program deleted"}


async def _set_status(program_id: str, new_status: str, note: str, extra: Optional[dict] = None) -> dict:
    updates = {"status": new_status, "note": note, "updated_at": datetime.now(timezone.utc)}
    if extra:
        updates.update(extra)
    doc = await _programs().find_one_and_update(
        {"_id": to_object_id(program_id)}, {"$set": updates}, return_document=True,
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Program not found")
    return doc


@router.post("/{program_id}/publish", response_model=AdminProgramRow, summary="Open a program to members",
    dependencies=[Depends(require_permission("programs.edit"))],
)
async def publish_program(program_id: str, request: Request, me: dict = Depends(get_current_user)):
    before = await _get_or_404(program_id)
    if before.get("status") == "Archived":
        raise HTTPException(status.HTTP_409_CONFLICT, "An archived programme cannot be published. Edit its status first.")
    # "Upcoming" is already listed in the catalogue; publishing a programme
    # that has not started keeps it Upcoming rather than pretending it runs.
    target = "Upcoming" if before.get("status") == "Upcoming" else "Active"
    doc = await _set_status(program_id, target, "Open to members")
    await record(
        me, "program.publish", target=program_id,
        detail=f"Published '{doc.get('name', '')}' — members can now see and join it", request=request,
    )
    return AdminProgramRow(**_admin_row(doc, await _enrolment_rollup()))


@router.post("/{program_id}/unpublish", response_model=AdminProgramRow, summary="Hide a program from members",
    dependencies=[Depends(require_permission("programs.edit"))],
)
async def unpublish_program(program_id: str, request: Request, me: dict = Depends(get_current_user)):
    await _get_or_404(program_id)
    doc = await _set_status(program_id, "Draft", "Hidden from members")
    await record(
        me, "program.unpublish", target=program_id,
        detail=f"Unpublished '{doc.get('name', '')}' — hidden from the member catalogue; existing enrolments kept",
        request=request,
    )
    return AdminProgramRow(**_admin_row(doc, await _enrolment_rollup()))


@router.post("/{program_id}/complete", response_model=AdminProgramRow, summary="Mark a program completed",
    dependencies=[Depends(require_permission("programs.edit"))],
)
async def complete_program(program_id: str, request: Request, me: dict = Depends(get_current_user)):
    await _get_or_404(program_id)
    doc = await _set_status(program_id, "Completed", "Completed")
    await record(
        me, "program.complete", target=program_id,
        detail=f"Marked '{doc.get('name', '')}' completed", request=request,
    )
    return AdminProgramRow(**_admin_row(doc, await _enrolment_rollup()))


@router.post("/{program_id}/archive", response_model=AdminProgramRow, summary="Archive a program",
    dependencies=[Depends(require_permission("programs.edit"))],
)
async def archive_program(program_id: str, request: Request, me: dict = Depends(get_current_user)):
    await _get_or_404(program_id)
    doc = await _set_status(program_id, "Archived", "Archived")
    await record(
        me, "program.archive", target=program_id,
        detail=f"Archived '{doc.get('name', '')}'", request=request,
    )
    return AdminProgramRow(**_admin_row(doc, await _enrolment_rollup()))


@router.put("/{program_id}/modules", response_model=AdminProgramRow, summary="Replace a program's modules",
    dependencies=[Depends(require_permission("programs.edit"))],
)
async def set_modules(program_id: str, payload: ModulesUpdate, request: Request, me: dict = Depends(get_current_user)):
    before = await _get_or_404(program_id)
    modules = [m.model_dump() for m in payload.modules]
    doc = await _programs().find_one_and_update(
        {"_id": before["_id"]},
        {"$set": {"curriculum": modules, "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    was = len([m for m in (before.get("curriculum") or []) if isinstance(m, dict)])
    await record(
        me, "program.modules", target=program_id,
        detail=f"Set the modules of '{doc.get('name', '')}': {len(modules)} module{'s' if len(modules) != 1 else ''} (was {was})",
        request=request,
    )
    return AdminProgramRow(**_admin_row(doc, await _enrolment_rollup()))


# --- Enrolments (who is in it) -----------------------------------------------

async def _people(user_ids: set[str]) -> dict[str, dict]:
    valid = [ObjectId(u) for u in user_ids if ObjectId.is_valid(u)]
    if not valid:
        return {}
    rows = await _users().find(
        {"_id": {"$in": valid}}, {"full_name": 1, "email": 1, "member_id": 1},
    ).to_list(len(valid))
    return {str(r["_id"]): r for r in rows}


def _enrolment_row(e: dict, person: Optional[dict]) -> dict:
    person = person or {}
    return {
        "id": str(e["_id"]),
        "user_id": str(e.get("user_id") or ""),
        "member_id": person.get("member_id") or e.get("member_id") or "",
        # The account may since have been deleted; the enrolment still happened.
        "name": person.get("full_name") or ("Member (account removed)" if not person else "Member"),
        "email": person.get("email") or "",
        "status": e.get("status") or EnrollmentModel.STATUS_ACTIVE,
        "progress": max(0, min(100, int(e.get("progress") or 0))),
        "sessions_attended": int(e.get("sessions_attended") or 0),
        "enrolled_at": _iso(e.get("created_at")),
        "joined": _display(e.get("created_at")),
        "completed_at": _iso(e.get("completed_at")),
        "last_activity_at": _iso(e.get("last_activity_at")),
    }


async def _enrolments_of(program_id: str, state: Optional[str]) -> tuple[dict, list[dict]]:
    program = await _get_or_404(program_id)
    query: dict = {"program_id": program_id}
    if state in EnrollmentModel.STATUSES:
        query["status"] = state
    rows = await _enrollments().find(query).sort("created_at", -1).to_list(10000)
    people = await _people({str(r.get("user_id") or "") for r in rows})
    return program, [_enrolment_row(r, people.get(str(r.get("user_id") or ""))) for r in rows]


@router.get("/{program_id}/enrollments", response_model=EnrolmentList, summary="Who is enrolled",
    dependencies=[Depends(require_permission("programs.view"))],
)
async def program_enrollments(
    program_id: str,
    state: Optional[str] = Query(None, description="active | completed | withdrawn"),
    _: dict = Depends(get_current_user),
):
    program, items = await _enrolments_of(program_id, state)
    # The summary figures always describe the whole programme, whatever the
    # state filter shows.
    rollup = await _enrolment_rollup()
    roll = rollup.get(program_id) or _EMPTY_ROLL
    _, rate, avg = _derive(roll)
    return EnrolmentList(
        program_id=program_id,
        program_name=program.get("name", ""),
        items=[EnrolmentRow(**i) for i in items],
        total=len(items),
        active=roll["active"],
        completed=roll["completed"],
        withdrawn=roll["withdrawn"],
        completion_rate=rate,
        avg_progress=avg,
    )


@router.get("/{program_id}/enrollments/export", summary="Download the enrolment list as CSV",
    dependencies=[Depends(require_permission("programs.export"))],
)
async def export_enrollments(
    program_id: str,
    request: Request,
    state: Optional[str] = Query(None, description="active | completed | withdrawn"),
    me: dict = Depends(get_current_user),
):
    """Names and emails leave the building here, so it is written to the audit
    trail the way a write is."""
    program, items = await _enrolments_of(program_id, state)
    rows: list[list[str]] = [[
        "Name", "Member ID", "Email", "Status", "Progress %", "Sessions attended",
        "Enrolled on", "Completed on", "Last activity",
    ]]
    for i in items:
        rows.append([
            i["name"], i["member_id"], i["email"], i["status"], str(i["progress"]),
            str(i["sessions_attended"]), i["enrolled_at"][:10], i["completed_at"][:10],
            i["last_activity_at"][:10],
        ])
    buf = io.StringIO()
    csv.writer(buf).writerows(rows)
    slug = "".join(c if c.isalnum() else "-" for c in program.get("name", "programme").lower()).strip("-")[:40] or "programme"
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    await record(
        me, "program.export", target=program_id,
        detail=f"Downloaded the enrolment list of '{program.get('name', '')}' as CSV ({len(rows) - 1} rows"
               + (f", {state} only" if state in EnrollmentModel.STATUSES else "") + ")",
        request=request,
    )
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="womsakhi-{slug}-learners-{stamp}.csv"'},
    )


@router.patch("/{program_id}/enrollments/{enrollment_id}", response_model=EnrolmentRow, summary="Change one enrolment",
    dependencies=[Depends(require_permission("programs.edit"))],
)
async def set_enrollment_status(
    program_id: str,
    enrollment_id: str,
    payload: EnrolmentStatusUpdate,
    request: Request,
    me: dict = Depends(get_current_user),
):
    program = await _get_or_404(program_id)
    existing = await _enrollments().find_one({"_id": to_object_id(enrollment_id), "program_id": program_id})
    if not existing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That enrolment is not on this programme")

    now = datetime.now(timezone.utc)
    updates: dict = {"status": payload.status, "updated_at": now}
    if payload.status == EnrollmentModel.STATUS_COMPLETED:
        updates.update(progress=100, completed_at=now, last_activity_at=now)
    elif payload.status == EnrollmentModel.STATUS_ACTIVE:
        updates["completed_at"] = None
        if int(existing.get("progress") or 0) >= 100:
            # Reinstating after completion means there is more to do.
            updates["progress"] = 99
    if payload.reason:
        updates["admin_note"] = payload.reason.strip()[:300]

    fresh = await _enrollments().find_one_and_update(
        {"_id": existing["_id"]}, {"$set": updates}, return_document=True,
    )
    await _sync_seat_counter(program_id)

    people = await _people({str(existing.get("user_id") or "")})
    row = _enrolment_row(fresh, people.get(str(existing.get("user_id") or "")))
    verb = {"completed": "Marked", "withdrawn": "Removed", "active": "Reinstated"}[payload.status]
    await record(
        me, f"program.enrolment_{payload.status}", target=program_id,
        detail=f"{verb} {row['name']} {'as completed on' if payload.status == 'completed' else 'from' if payload.status == 'withdrawn' else 'on'} '{program.get('name', '')}'"
               + (f" — {payload.reason.strip()}" if payload.reason and payload.reason.strip() else ""),
        request=request,
    )

    uid = str(existing.get("user_id") or "")
    if uid and payload.status != existing.get("status"):
        title, body = {
            "completed": ("You completed a programme", f"{program.get('name', '')} is marked complete. Well done."),
            "withdrawn": ("You were removed from a programme", f"You are no longer enrolled in {program.get('name', '')}."),
            "active": ("You are back on a programme", f"Your place on {program.get('name', '')} is active again."),
        }[payload.status]
        await notify(
            get_database(), uid, title=title, body=body,
            ntype=MemberNotificationModel.TYPE_PROGRAM, href="/app/programs",
        )
    return EnrolmentRow(**row)


@router.post("/{program_id}/enrollments/resync", response_model=AdminProgramRow, summary="Set the seat counter to the live count",
    dependencies=[Depends(require_permission("programs.edit"))],
)
async def resync_seats(program_id: str, request: Request, me: dict = Depends(get_current_user)):
    before = await _get_or_404(program_id)
    await _sync_seat_counter(program_id)
    row = await _row_for(program_id)
    await record(
        me, "program.resync", target=program_id,
        detail=f"Set the seat counter of '{before.get('name', '')}' to the live count: {row['seat_counter']} (was {int(before.get('enrolled') or 0)})",
        request=request,
    )
    return AdminProgramRow(**row)


# --- Seed --------------------------------------------------------------------
# Kept for `seed_all`, which only runs it on an EMPTY collection.
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
