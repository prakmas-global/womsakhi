"""
Command Center — what needs doing, how the platform is doing, and a box that
answers questions from the data.

── What this replaced ─────────────────────────────────────────────────────
The "AI Command Center" was theatre. Four seeded "agents" reported 2,451
WhatsApp messages sent and a 98% success rate; a health gauge averaged five
seeded scores; insights spoke of "Texas" and "Los Angeles"; a timeline said
"AI approved 12 new listings" at 10:03 AM; a memory panel counted 12,458
documents indexed by nothing; the chat replied with one canned paragraph
whatever you typed. None of it touched a member, a booking or a rupee.

── What it is now ─────────────────────────────────────────────────────────
No AI model runs here, and the screen says so. Everything is computed from
the platform's own rows:

  priorities  the queues that are waiting: reviews, reports, replies…
  health      measured indicators with the figures behind each one
  insights    this week against last, where there is data to compare
  tasks       a real to-do list for staff: created, assigned, done, audited
  ask         a fixed set of questions answered from live counts

── Access ──────────────────────────────────────────────────────────────────
Reads need `ai.view`; task writes `ai.edit`. Task writes are recorded.
"""

import asyncio
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status

from app.core.audit import record
from app.core.deps import get_current_user
from app.core.permissions import require_permission
from app.core.serializers import to_object_id
from app.db.mongodb import get_database
from app.schemas.ai import (
    ActivityRow,
    AskRequest,
    AskResponse,
    HealthIndicator,
    HealthResponse,
    Insight,
    OverviewResponse,
    Priority,
    TaskCreate,
    TaskResponse,
    TaskStats,
    TaskUpdate,
)

router = APIRouter(prefix="/ai", tags=["Command Center"])

TASKS = "staff_tasks"
NOTE = ("No AI model runs behind this screen. Every figure is counted from the platform's own records "
        "when you open it; the tasks are yours; the question box answers a fixed set of questions from live data.")


def _db():
    return get_database()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt) -> Optional[str]:
    return dt.isoformat() if isinstance(dt, datetime) else None


def _pct(part: int, whole: int) -> Optional[int]:
    return round(part / whole * 100) if whole else None


# --- Priorities: the queues that are waiting ----------------------------------------------
async def _waiting_threads() -> int:
    """Members whose last message has had no team reply."""
    last: dict[str, str] = {}
    async for m in _db()["member_messages"].find({}, {"user_id": 1, "sender": 1, "created_at": 1}).sort("created_at", 1):
        last[str(m.get("user_id"))] = m.get("sender", "")
    return sum(1 for s in last.values() if s == "member")


async def _priorities() -> list[dict]:
    db = _db()
    # Eight independent questions, asked at once rather than one after another.
    keys = ["verification", "safety", "messages", "feedback", "support", "applications", "stories", "appointments"]
    values = await asyncio.gather(
        db["users"].count_documents({"verification_status": "in_review"}),
        db["safety_reports"].count_documents({"status": {"$in": ["open", "reviewing"]}}),
        _waiting_threads(),
        db["feedback"].count_documents({"status": {"$in": ["Open", "In Review"]}}),
        db["support_requests"].count_documents({"status": "pending"}),
        db["applications"].count_documents({"status": {"$in": ["applied", "shortlisted"]}}),
        db["stories"].count_documents({"status": "pending"}),
        db["appointments"].count_documents({"date": {"$not": {"$regex": r"\d{4}"}}}),
    )
    counts = dict(zip(keys, values))
    spec = [
        ("verification", "UserCheck", "violet", "ID document{s} waiting for review", "/dashboard/users/verification"),
        ("safety", "ShieldAlert", "rose", "safety report{s} open", "/dashboard/safety/reports"),
        ("messages", "MessageSquare", "sky", "member{s} waiting for a reply", "/dashboard/messages"),
        ("support", "HandCoins", "amber", "support-fund request{s} pending", "/dashboard/support-fund"),
        ("feedback", "MessageSquareHeart", "brand", "feedback entr{ies} unresolved", "/dashboard/feedback"),
        ("applications", "FileText", "violet", "application{s} to decide", "/dashboard/applications"),
        ("stories", "BookOpen", "emerald", "stor{ies} waiting for review", "/dashboard/stories"),
        ("appointments", "CalendarX", "amber", "legacy appointment{s} with no date", "/dashboard/appointments?undated=true"),
    ]
    out = []
    for key, icon, tone, template, href in spec:
        n = counts[key]
        if n == 0:
            continue
        word = template.replace("{s}", "" if n == 1 else "s").replace("{ies}", "y" if n == 1 else "ies")
        out.append({"key": key, "icon": icon, "tone": tone, "count": n, "text": f"{n:,} {word}", "href": href})
    return out


# --- Health: measured indicators, each explained ----------------------------------------
async def _health() -> dict:
    db = _db()
    now = _now()
    month_ago = now - timedelta(days=30)

    # Five indicators, nine independent reads, one round of waiting.
    (members, verified, recent, fb, waiting, thread_ids, programmes, visible) = await asyncio.gather(
        db["users"].count_documents({"role": "Member"}),                                          # 1. verified share
        db["users"].count_documents({"role": "Member", "verification_status": "active"}),
        db["bookings"].find({"created_at": {"$gte": month_ago}}, {"status": 1}).to_list(None),     # 2. bookings kept
        db["feedback"].find({}, {"sentiment": 1}).to_list(None),                                  # 3. positive feedback
        _waiting_threads(),                                                                       # 4. members answered
        db["member_messages"].distinct("user_id"),
        db["programs"].count_documents({"status": {"$nin": ["Archived", "Completed"]}}),          # 5. programmes visible
        db["programs"].count_documents({"status": {"$in": ["Ongoing", "Upcoming", "Active", "Published", "Running"]}}),
    )
    kept = sum(1 for b in recent if b.get("status") != "cancelled")
    positive = sum(1 for f in fb if f.get("sentiment") == "Positive")
    threads = len(thread_ids)

    indicators = [
        {"key": "verified", "icon": "UserCheck", "tone": "violet", "label": "Members verified",
         "value": _pct(verified, members), "measures": "Members whose ID has been approved, out of all members",
         "detail": f"{verified:,} of {members:,}"},
        {"key": "kept", "icon": "CalendarCheck", "tone": "emerald", "label": "Bookings kept",
         "value": _pct(kept, len(recent)), "measures": "Bookings made in the last 30 days that were not cancelled",
         "detail": f"{kept:,} of {len(recent):,}" if recent else "No bookings in the last 30 days"},
        {"key": "positive", "icon": "Smile", "tone": "amber", "label": "Positive feedback",
         "value": _pct(positive, len(fb)), "measures": "Feedback entries with a positive sentiment, all time",
         "detail": f"{positive:,} of {len(fb):,}" if fb else "No feedback yet"},
        {"key": "answered", "icon": "MessageSquare", "tone": "sky", "label": "Members answered",
         "value": _pct(threads - waiting, threads), "measures": "Members who wrote to the team and have a reply to their last message",
         "detail": f"{threads - waiting:,} of {threads:,}" if threads else "Nobody has written yet"},
        {"key": "visible", "icon": "GraduationCap", "tone": "brand", "label": "Programmes visible",
         "value": _pct(visible, programmes), "measures": "Current programmes members can see in the catalogue",
         "detail": f"{visible:,} of {programmes:,}" if programmes else "No current programmes"},
    ]
    measured = [i["value"] for i in indicators if i["value"] is not None]
    overall = round(sum(measured) / len(measured)) if measured else None
    if overall is None:
        rating, color = "Nothing to measure yet", "#94a3b8"
    elif overall >= 85:
        rating, color = "Strong", "#22c55e"
    elif overall >= 65:
        rating, color = "Steady", "#22c55e"
    elif overall >= 45:
        rating, color = "Needs work", "#f59e0b"
    else:
        rating, color = "Needs attention", "#ef4444"
    return {"overall": overall, "rating": rating, "color": color, "measured": len(measured), "indicators": indicators}


# --- Insights: this week against last, where there is data -------------------------------------
async def _insights() -> list[dict]:
    db = _db()
    now = _now()
    week, fortnight = now - timedelta(days=7), now - timedelta(days=14)

    async def counts(coll: str, extra: Optional[dict] = None, field: str = "created_at") -> tuple[int, int]:
        base = extra or {}
        this = await db[coll].count_documents({**base, field: {"$gte": week, "$lt": now}})
        prev = await db[coll].count_documents({**base, field: {"$gte": fortnight, "$lt": week}})
        return this, prev

    def sentence(this: int, prev: int, noun: str) -> Optional[tuple[str, str]]:
        if this == 0 and prev == 0:
            return None
        if prev == 0:
            return f"{this:,} {noun} this week", "and none the week before."
        change = round((this - prev) / prev * 100)
        direction = "up" if change > 0 else "down" if change < 0 else "level"
        return (f"{this:,} {noun} this week",
                f"{direction} {abs(change)}% on last week's {prev:,}." if change else f"the same as last week ({prev:,}).")

    out = []
    m_this, m_prev = await counts("members")
    s = sentence(m_this, m_prev, "new members")
    if s:
        out.append({"key": "members", "icon": "Users", "tone": "violet", "title": s[0], "description": s[1], "href": "/dashboard/users"})
    b_this, b_prev = await counts("bookings")
    s = sentence(b_this, b_prev, "bookings")
    if s:
        out.append({"key": "bookings", "icon": "CalendarCheck", "tone": "emerald", "title": s[0], "description": s[1], "href": "/dashboard/appointments"})
    c_this, c_prev = await counts("bookings", {"status": "cancelled"})
    if c_this or c_prev:
        s = sentence(c_this, c_prev, "cancellations")
        if s:
            out.append({"key": "cancellations", "icon": "CalendarX", "tone": "rose" if c_this > c_prev else "amber", "title": s[0], "description": s[1], "href": "/dashboard/appointments?status=cancelled"})
    f_this, f_prev = await counts("feedback", field="date")
    s = sentence(f_this, f_prev, "feedback entries")
    if s:
        out.append({"key": "feedback", "icon": "MessageSquareHeart", "tone": "brand", "title": s[0], "description": s[1], "href": "/dashboard/feedback"})
    e_this, e_prev = await counts("enrollments")
    s = sentence(e_this, e_prev, "programme enrolments")
    if s:
        out.append({"key": "enrollments", "icon": "GraduationCap", "tone": "sky", "title": s[0], "description": s[1], "href": "/dashboard/programs"})
    r_this, r_prev = await counts("safety_reports")
    if r_this or r_prev:
        s = sentence(r_this, r_prev, "safety reports")
        if s:
            out.append({"key": "safety", "icon": "ShieldAlert", "tone": "rose", "title": s[0], "description": s[1], "href": "/dashboard/safety/reports"})
    return out


@router.get("/overview", response_model=OverviewResponse, summary="Priorities, measured health and this-week insights",
    dependencies=[Depends(require_permission("ai.view"))],
)
async def overview():
    priorities, h, insights = await asyncio.gather(_priorities(), _health(), _insights())
    return OverviewResponse(
        generated_at=_now().isoformat(), note=NOTE,
        priorities=[Priority(**p) for p in priorities],
        health=HealthResponse(**{**h, "indicators": [HealthIndicator(**i) for i in h["indicators"]]}),
        insights=[Insight(**i) for i in insights],
    )


# --- Staff tasks: a real to-do list ---------------------------------------------------------------
def _task_row(doc: dict) -> dict:
    due = doc.get("due") or ""
    return {
        "id": str(doc["_id"]), "title": doc.get("title", ""), "notes": doc.get("notes", ""),
        "priority": doc.get("priority", "medium"), "due": due, "done": bool(doc.get("done")),
        "done_at": _iso(doc.get("done_at")), "href": doc.get("href", ""),
        "assignee_id": doc.get("assignee_id", ""), "assignee_name": doc.get("assignee_name", ""),
        "created_by_name": doc.get("created_by_name", ""), "created_at": _iso(doc.get("created_at")) or "",
        "overdue": bool(due) and not doc.get("done") and due < _now().strftime("%Y-%m-%d"),
    }


def _check_due(due: str) -> str:
    due = (due or "").strip()
    if due and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", due):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Due date must be YYYY-MM-DD")
    return due


async def _assignee(assignee_id: str, me: dict) -> tuple[str, str]:
    if not assignee_id:
        return "", ""
    if assignee_id == "me":
        return str(me.get("_id", "")), me.get("full_name", "") or me.get("email", "")
    user = await _db()["users"].find_one({"_id": to_object_id(assignee_id), "role": {"$ne": "Member"}}, {"full_name": 1, "email": 1})
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That staff account does not exist")
    return str(user["_id"]), user.get("full_name", "") or user.get("email", "")


@router.get("/tasks", response_model=list[TaskResponse], summary="Staff tasks",
    dependencies=[Depends(require_permission("ai.view"))],
)
async def list_tasks(
    show: str = Query("open", description="open | done | all"),
    mine: bool = Query(False),
    me: dict = Depends(get_current_user),
):
    q: dict = {}
    if show == "open":
        q["done"] = {"$ne": True}
    elif show == "done":
        q["done"] = True
    if mine:
        q["assignee_id"] = str(me.get("_id", ""))
    docs = [d async for d in _db()[TASKS].find(q)]
    rank = {"high": 0, "medium": 1, "low": 2}
    docs.sort(key=lambda d: (bool(d.get("done")), d.get("due") or "9999", rank.get(d.get("priority"), 1), -(d.get("created_at") or _now()).timestamp()))
    return [TaskResponse(**_task_row(d)) for d in docs[:200]]


@router.get("/tasks/stats", response_model=TaskStats, summary="Task counts",
    dependencies=[Depends(require_permission("ai.view"))],
)
async def task_stats(me: dict = Depends(get_current_user)):
    today = _now().strftime("%Y-%m-%d")
    coll = _db()[TASKS]
    return TaskStats(
        open=await coll.count_documents({"done": {"$ne": True}}),
        done=await coll.count_documents({"done": True}),
        overdue=await coll.count_documents({"done": {"$ne": True}, "due": {"$ne": "", "$lt": today}}),
        mine=await coll.count_documents({"done": {"$ne": True}, "assignee_id": str(me.get("_id", ""))}),
    )


@router.post("/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED, summary="Add a task",
    dependencies=[Depends(require_permission("ai.edit"))],
)
async def create_task(payload: TaskCreate, request: Request, me: dict = Depends(get_current_user)):
    aid, aname = await _assignee(payload.assignee_id, me)
    doc = {
        "title": payload.title, "notes": payload.notes.strip()[:2000], "priority": payload.priority,
        "due": _check_due(payload.due), "href": payload.href.strip()[:300], "done": False, "done_at": None,
        "assignee_id": aid, "assignee_name": aname,
        "created_by": str(me.get("_id", "")), "created_by_name": me.get("full_name", "") or me.get("email", ""),
        "created_at": _now(), "updated_at": _now(),
    }
    result = await _db()[TASKS].insert_one(doc)
    doc["_id"] = result.inserted_id
    await record(me, "task.create", target=str(doc["_id"]),
                 detail=f"Added task '{payload.title}'{' for ' + aname if aname else ''}{' due ' + doc['due'] if doc['due'] else ''}", request=request)
    return TaskResponse(**_task_row(doc))


@router.patch("/tasks/{task_id}", response_model=TaskResponse, summary="Edit, assign, or tick a task",
    dependencies=[Depends(require_permission("ai.edit"))],
)
async def update_task(task_id: str, payload: TaskUpdate, request: Request, me: dict = Depends(get_current_user)):
    doc = await _db()[TASKS].find_one({"_id": to_object_id(task_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    updates = payload.model_dump(exclude_unset=True)
    if "title" in updates:
        updates["title"] = (updates["title"] or "").strip()[:200]
        if not updates["title"]:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Give the task a title")
    if "due" in updates:
        updates["due"] = _check_due(updates["due"] or "")
    if "assignee_id" in updates:
        updates["assignee_id"], updates["assignee_name"] = await _assignee(updates["assignee_id"] or "", me)
    if "done" in updates:
        updates["done_at"] = _now() if updates["done"] else None
    updates["updated_at"] = _now()
    doc = await _db()[TASKS].find_one_and_update({"_id": doc["_id"]}, {"$set": updates}, return_document=True)
    if "done" in updates:
        verb, detail = ("task.done", f"Finished task '{doc.get('title', '')}'") if updates["done"] else ("task.reopen", f"Reopened task '{doc.get('title', '')}'")
    elif "assignee_id" in updates:
        verb, detail = "task.assign", f"Assigned task '{doc.get('title', '')}' to {updates.get('assignee_name') or 'nobody'}"
    else:
        verb, detail = "task.edit", f"Edited task '{doc.get('title', '')}': {', '.join(sorted(k for k in updates if k != 'updated_at'))}"
    await record(me, verb, target=task_id, detail=detail, request=request)
    return TaskResponse(**_task_row(doc))


@router.delete("/tasks/{task_id}", summary="Delete a task",
    dependencies=[Depends(require_permission("ai.edit"))],
)
async def delete_task(task_id: str, request: Request, me: dict = Depends(get_current_user)):
    doc = await _db()[TASKS].find_one({"_id": to_object_id(task_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    await _db()[TASKS].delete_one({"_id": doc["_id"]})
    await record(me, "task.delete", target=task_id, detail=f"Deleted task '{doc.get('title', '')}'", request=request)
    return {"message": "Task deleted"}


# --- Activity: the audit log, newest first ---------------------------------------------------------
@router.get("/activity", response_model=list[ActivityRow], summary="Latest recorded staff actions",
    dependencies=[Depends(require_permission("ai.view"))],
)
async def activity(limit: int = Query(10, ge=1, le=50)):
    out = []
    async for a in _db()["activity_log"].find({}).sort("created_at", -1).limit(limit):
        out.append({"id": str(a["_id"]), "at": _iso(a.get("created_at")) or "", "who": a.get("user_name", ""),
                    "action": a.get("action", ""), "category": a.get("category", ""), "detail": a.get("detail", "")})
    return out


# --- Ask: a fixed set of questions, answered from live counts ---------------------------------------
CAN_ANSWER = [
    "What needs attention?",
    "How many new members this week?",
    "How many members do we have?",
    "Who is waiting for a reply?",
    "How many bookings this week?",
    "How is feedback looking?",
    "When was the last backup?",
    "How many programmes are running?",
]


@router.post("/ask", response_model=AskResponse, summary="Answer one of the supported questions from live data",
    dependencies=[Depends(require_permission("ai.view"))],
)
async def ask(payload: AskRequest):
    q = payload.question.lower()
    db = _db()
    now = _now()
    week = now - timedelta(days=7)

    def has(*words: str) -> bool:
        return all(w in q for w in words)

    if has("attention") or has("needs") or has("focus") or has("today"):
        ps = await _priorities()
        if not ps:
            return AskResponse(answer="Nothing is waiting: every queue is empty.", understood=True, can_answer=CAN_ANSWER)
        return AskResponse(answer="Waiting right now: " + "; ".join(p["text"] for p in ps) + ".",
                           figures={p["key"]: p["count"] for p in ps}, href=ps[0]["href"], understood=True, can_answer=CAN_ANSWER)
    if has("new members") or (has("members") and has("week")):
        n = await db["members"].count_documents({"created_at": {"$gte": week}})
        return AskResponse(answer=f"{n:,} member{'s' if n != 1 else ''} joined in the last 7 days.", figures={"new_members_7d": n}, href="/dashboard/users", understood=True, can_answer=CAN_ANSWER)
    if has("how many members") or has("members do we"):
        total = await db["members"].count_documents({})
        active = await db["members"].count_documents({"status": "Active"})
        return AskResponse(answer=f"{total:,} members in the directory, {active:,} of them active.", figures={"members": total, "active": active}, href="/dashboard/users", understood=True, can_answer=CAN_ANSWER)
    if has("waiting") and (has("reply") or has("message")):
        n = await _waiting_threads()
        return AskResponse(answer=f"{n:,} member{'s are' if n != 1 else ' is'} waiting for a reply from the team." if n else "Nobody is waiting for a reply.", figures={"waiting": n}, href="/dashboard/messages", understood=True, can_answer=CAN_ANSWER)
    if has("bookings"):
        n = await db["bookings"].count_documents({"created_at": {"$gte": week}})
        c = await db["bookings"].count_documents({"created_at": {"$gte": week}, "status": "cancelled"})
        return AskResponse(answer=f"{n:,} booking{'s' if n != 1 else ''} in the last 7 days, {c:,} cancelled.", figures={"bookings_7d": n, "cancelled_7d": c}, href="/dashboard/appointments", understood=True, can_answer=CAN_ANSWER)
    if has("feedback"):
        fb = [f async for f in db["feedback"].find({}, {"sentiment": 1, "status": 1, "rating": 1})]
        if not fb:
            return AskResponse(answer="No feedback has been written yet.", understood=True, can_answer=CAN_ANSWER)
        pos = sum(1 for f in fb if f.get("sentiment") == "Positive")
        unresolved = sum(1 for f in fb if f.get("status") in ("Open", "In Review"))
        avg = sum(int(f.get("rating", 0)) for f in fb) / len(fb)
        return AskResponse(answer=f"{len(fb):,} feedback entries, average rating {avg:.1f} / 5, {round(pos / len(fb) * 100)}% positive, {unresolved:,} unresolved.",
                           figures={"entries": len(fb), "average": round(avg, 1), "positive_pct": round(pos / len(fb) * 100), "unresolved": unresolved}, href="/dashboard/feedback", understood=True, can_answer=CAN_ANSWER)
    if has("backup"):
        b = await db["backups"].find_one({"status": "complete"}, sort=[("finished_at", -1)])
        if not b or not isinstance(b.get("finished_at"), datetime):
            return AskResponse(answer="No completed backup is recorded.", href="/dashboard/settings/backup", understood=True, can_answer=CAN_ANSWER)
        fin = b["finished_at"] if b["finished_at"].tzinfo else b["finished_at"].replace(tzinfo=timezone.utc)
        days = (now - fin).days
        return AskResponse(answer=f"The last completed backup finished {days} day{'s' if days != 1 else ''} ago ({fin.strftime('%d %b %Y')}, '{b.get('name', '')}').", figures={"days_ago": days}, href="/dashboard/settings/backup", understood=True, can_answer=CAN_ANSWER)
    if has("programme") or has("program"):
        running = await db["programs"].count_documents({"status": {"$in": ["Running", "Ongoing", "Active", "Published"]}})
        upcoming = await db["programs"].count_documents({"status": "Upcoming"})
        return AskResponse(answer=f"{running:,} programme{'s' if running != 1 else ''} running and {upcoming:,} upcoming.", figures={"running": running, "upcoming": upcoming}, href="/dashboard/programs", understood=True, can_answer=CAN_ANSWER)
    return AskResponse(answer="I can only answer a fixed set of questions from the platform's data — pick one below.", understood=False, can_answer=CAN_ANSWER)


@router.get("/report", summary="The overview as CSV",
    dependencies=[Depends(require_permission("ai.view"))],
)
async def report(request: Request, me: dict = Depends(get_current_user)):
    h = await _health()
    ps = await _priorities()
    ins = await _insights()
    lines = [["Section", "Item", "Value", "Detail"]]
    lines += [["Health", i["label"], "" if i["value"] is None else f"{i['value']}%", i["detail"]] for i in h["indicators"]]
    lines += [["Waiting", p["text"], str(p["count"]), p["href"]] for p in ps]
    lines += [["This week", i["title"], "", i["description"]] for i in ins]
    cell = lambda v: '"' + str(v).replace('"', '""') + '"'  # noqa: E731
    csv = "\n".join(",".join(cell(c) for c in row) for row in lines)
    await record(me, "report.generate", detail="Downloaded the Command Center overview as CSV", request=request)
    return Response(content=csv, media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="command-center.csv"'})


async def seed() -> None:
    """Nothing to seed. The nine invented AI collections are no longer read."""
    return None
