"""
Feedback — what members said, and what staff did about it.

── What changed and why ───────────────────────────────────────────────────
The screen mixed real rows with numbers nobody measured: the "+8%" and
"+15%" on two stat cards were typed into source; "Responses This Month" was
the all-time total; the four "What are people saying?" cards came from a
seeded collection (128 mentions, +20%) that no feedback ever fed; "Top
Programs" was a second seeded list of ratings; and "Request Feedback"
returned "sent successfully" without writing or sending anything.

Now every figure is computed from the `feedback` rows and their real `date`:
this month against last month, the last 30 days against the 30 before, a
programme's rating from the ratings people actually gave it. A request is a
row in `feedback_requests`, emailed when mail can deliver and honestly
labelled when it cannot. A reply is stored on the entry and sent the same
way; an internal note is stored and never sent.

── Access ─────────────────────────────────────────────────────────────────
Reads need `feedback.view`, replies and status changes `feedback.edit`,
deletion `feedback.delete`, the CSV `feedback.export`. Every write is
recorded through `app.core.audit`.
"""

import csv
import io
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status

from app.core import mongosafe
from app.core.audit import record
from app.core.deps import get_current_user
from app.core.email import EmailMessageSpec, _wrap, can_deliver, send
from app.core.permissions import require_permission
from app.core.serializers import page_meta, to_object_id
from app.db.mongodb import get_database
from app.models.feedback import FeedbackModel
from app.routes._paging import paged
from app.schemas.feedback import (
    FeedbackListResponse,
    FeedbackOverviewResponse,
    FeedbackReplyCreate,
    FeedbackRequestCreate,
    FeedbackRequestResponse,
    FeedbackRequestRow,
    FeedbackResponse,
    FeedbackStatsResponse,
    FeedbackStatusUpdate,
    FeedbackThemeListResponse,
    ProgramRatingListResponse,
)

router = APIRouter(prefix="/feedback", tags=["Feedback"])

REQUESTS = "feedback_requests"
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _feedback():
    return get_database()[FeedbackModel.collection_name]


def _requests():
    return get_database()[REQUESTS]


def _row(doc: dict) -> dict:
    """The model's response plus the staff thread, oldest first."""
    out = FeedbackModel.to_response(doc)
    out["replies"] = [
        {
            "id": str(r.get("id", "")),
            "by": r.get("by", ""),
            "text": r.get("text", ""),
            "at": r["at"].isoformat() if isinstance(r.get("at"), datetime) else "",
            "internal": bool(r.get("internal")),
            "emailed": bool(r.get("emailed")),
        }
        for r in doc.get("replies", [])
    ]
    return out


# --- Time windows ---------------------------------------------------------------
def _now() -> datetime:
    return datetime.now(timezone.utc)


def _range_bounds(label: Optional[str]) -> Optional[tuple[datetime, datetime]]:
    """
    The window a range label means, or None for "everything". Labels are the
    ones the screen offers; anything else is treated as all time rather than
    silently filtering on a guess.
    """
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


def _in_window(doc: dict, start: datetime, end: datetime) -> bool:
    when = doc.get("date")
    if not isinstance(when, datetime):
        return False
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    return start <= when < end


def _pct_change(now_n: int, before_n: int) -> Optional[str]:
    """'+25%' style change, or None when the earlier period had nothing."""
    if before_n <= 0:
        return None
    change = round((now_n - before_n) / before_n * 100)
    return f"{abs(change)}%"


# --- Query building -------------------------------------------------------------
def _build_query(
    q: Optional[str],
    ftype: Optional[str],
    program: Optional[str],
    rating: Optional[str],
    tab: Optional[str],
    date_range: Optional[str] = None,
) -> dict:
    """Translate the toolbar filters + active tab into a Mongo query."""
    query: dict = {}

    if ftype and ftype not in ("All Types", "all"):
        query["type"] = ftype
    if program and program not in ("All Programs", "all"):
        query["program"] = program
    if rating and rating not in ("All Ratings", "all"):
        # Values arrive as "5 Stars", "4 Stars", ... — take the leading digit.
        head = rating.strip()[:1]
        if head.isdigit():
            query["rating"] = int(head)
    if q and q.strip():
        query.update(mongosafe.any_of(q, ["text", "user_name", "program"]))

    bounds = _range_bounds(date_range)
    if bounds:
        query["date"] = {"$gte": bounds[0], "$lt": bounds[1]}

    # Tabs add one more condition on top of the filters above.
    if tab == "Unresolved":
        query["status"] = {"$in": ["Open", "In Review"]}
    elif tab == "Positive":
        query.setdefault("rating", {"$gte": 4})
    elif tab == "Negative":
        query.setdefault("rating", {"$lte": 2})
    elif tab == "Suggestions":
        query["type"] = "Suggestion"

    return query


def _sort_spec(sort: str) -> list[tuple[str, int]]:
    if sort == "Oldest First":
        return [("date", 1), ("seq", 1)]
    if sort == "Highest Rating":
        return [("rating", -1), ("date", -1)]
    if sort == "Lowest Rating":
        return [("rating", 1), ("date", -1)]
    return [("date", -1), ("seq", -1)]


# --- List --------------------------------------------------------------------
@router.get("", response_model=FeedbackListResponse, summary="List feedback",
    dependencies=[Depends(require_permission("feedback.view"))],
)
async def list_feedback(
    q: Optional[str] = Query(None, description="Search text, user or program"),
    type: Optional[str] = Query(None, description="Filter by feedback type"),
    program: Optional[str] = Query(None, description="Filter by program"),
    rating: Optional[str] = Query(None, description="Filter by rating, e.g. '5 Stars'"),
    date_range: Optional[str] = Query(None, description="Today | Last 7 Days | Last 30 Days | This Month | This Year"),
    tab: Optional[str] = Query(None, description="Active tab filter"),
    sort: str = Query("Newest First", description="Sort label from the UI"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
):
    query = _build_query(q, type, program, rating, tab, date_range)
    total, docs = await paged(_feedback(), query, sort=_sort_spec(sort), page=page, page_size=page_size)
    return FeedbackListResponse(items=[_row(d) for d in docs], **page_meta(total, page, page_size))


# --- Stats / aggregates (static paths BEFORE the dynamic /{id}) --------------
async def _all_docs() -> list[dict]:
    projection = {"rating": 1, "sentiment": 1, "type": 1, "status": 1, "user_email": 1, "date": 1, "program": 1}
    return [doc async for doc in _feedback().find({}, projection)]


@router.get("/stats", response_model=FeedbackStatsResponse, summary="Feedback stat cards",
    dependencies=[Depends(require_permission("feedback.view"))],
)
async def feedback_stats():
    docs = await _all_docs()
    now = _now()
    total = len(docs)
    ratings = [int(d.get("rating", 0)) for d in docs]
    avg = sum(ratings) / total if total else 0
    positive = sum(1 for d in docs if d.get("sentiment") == "Positive")
    positive_pct = round(positive / total * 100) if total else 0
    users = len({d.get("user_email", "") for d in docs if d.get("user_email")})

    # Positive share: the last 30 days against the 30 before them.
    last30 = [d for d in docs if _in_window(d, now - timedelta(days=30), now)]
    prev30 = [d for d in docs if _in_window(d, now - timedelta(days=60), now - timedelta(days=30))]
    positive_delta, positive_up = None, True
    if last30 and prev30:
        share_now = sum(1 for d in last30 if d.get("sentiment") == "Positive") / len(last30) * 100
        share_before = sum(1 for d in prev30 if d.get("sentiment") == "Positive") / len(prev30) * 100
        diff = round(share_now - share_before)
        positive_delta, positive_up = f"{abs(diff)} pts", diff >= 0

    # Responses: this calendar month against last calendar month.
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    prev_start = (month_start - timedelta(days=1)).replace(day=1)
    this_month = sum(1 for d in docs if _in_window(d, month_start, now))
    last_month = sum(1 for d in docs if _in_window(d, prev_start, month_start))
    responses_delta = _pct_change(this_month, last_month)

    return FeedbackStatsResponse(
        total_feedback=f"{total:,}",
        average_rating=f"{avg:.1f} / 5" if total else "—",
        positive_percentage=f"{positive_pct}%" if total else "—",
        positive_delta=positive_delta,
        positive_up=positive_up,
        responses_this_month=f"{this_month:,}",
        responses_delta=responses_delta,
        responses_up=this_month >= last_month,
        feedback_users=f"{users:,}",
        unresolved=sum(1 for d in docs if d.get("status") in ("Open", "In Review")),
        programs=sorted({d.get("program", "") for d in docs if d.get("program")}),
    )


# Overview donut slices, priority order.
_OVERVIEW_COLORS = {
    "Positive": "#22c55e",
    "Suggestion": "#3b82f6",
    "Neutral": "#f59e0b",
    "Negative": "#e6117e",
}


def _overview_bucket(doc: dict) -> str:
    """One slice per row. Sentiment wins so the slices agree with the positive
    percentage; a remaining Suggestion gets its own slice; the rest is Neutral."""
    sentiment = doc.get("sentiment")
    if sentiment == "Positive":
        return "Positive"
    if sentiment == "Negative":
        return "Negative"
    if doc.get("type") == "Suggestion":
        return "Suggestion"
    return "Neutral"


@router.get("/overview", response_model=FeedbackOverviewResponse, summary="Feedback overview donut",
    dependencies=[Depends(require_permission("feedback.view"))],
)
async def feedback_overview(date_range: Optional[str] = Query(None)):
    docs = await _all_docs()
    bounds = _range_bounds(date_range)
    if bounds:
        docs = [d for d in docs if _in_window(d, *bounds)]
    total = len(docs)
    counts = {name: 0 for name in _OVERVIEW_COLORS}
    for doc in docs:
        counts[_overview_bucket(doc)] += 1

    def _pct(value: int) -> int:
        return round(value / total * 100) if total else 0

    items = [
        {"name": name, "value": counts[name], "legend": f"{counts[name]} ({_pct(counts[name])}%)", "color": color}
        for name, color in _OVERVIEW_COLORS.items()
    ]
    return FeedbackOverviewResponse(total=f"{total:,}", center_label="Total", items=items)


# The four "what are people saying" cards: real buckets, counted in a window
# and compared with the window before it. Not themes extracted from prose —
# nothing here does that yet, and a card that pretended to would be worse
# than none.
_THEMES = [
    ("positive", "Positive feedback", "ThumbsUp", "emerald", lambda d: d.get("sentiment") == "Positive"),
    ("suggestions", "Suggestions", "Lightbulb", "violet", lambda d: d.get("type") == "Suggestion"),
    ("complaints", "Complaints", "AlertTriangle", "amber", lambda d: d.get("type") == "Complaint"),
    ("negative", "Negative feedback", "ThumbsDown", "rose", lambda d: d.get("sentiment") == "Negative"),
]


@router.get("/themes", response_model=FeedbackThemeListResponse, summary="What people are saying, by bucket",
    dependencies=[Depends(require_permission("feedback.view"))],
)
async def feedback_themes(date_range: Optional[str] = Query("Last 30 Days")):
    docs = await _all_docs()
    bounds = _range_bounds(date_range) or (_now() - timedelta(days=30), _now())
    start, end = bounds
    span = end - start
    before = (start - span, start)
    window_label = (date_range or "Last 30 Days").lower()
    items = []
    for key, label, icon, tone, pred in _THEMES:
        n = sum(1 for d in docs if pred(d) and _in_window(d, start, end))
        b = sum(1 for d in docs if pred(d) and _in_window(d, *before))
        items.append({
            "key": key, "label": label, "icon": icon, "tone": tone, "count": n,
            "mentions": f"{n:,} {'entry' if n == 1 else 'entries'} · {window_label}",
            "delta": _pct_change(n, b),
            "up": n >= b,
        })
    return FeedbackThemeListResponse(items=items, total=len(items))


@router.get("/program-ratings", response_model=ProgramRatingListResponse, summary="Programmes ranked by the ratings people gave them",
    dependencies=[Depends(require_permission("feedback.view"))],
)
async def program_ratings(limit: int = Query(8, ge=1, le=50)):
    pipeline = [
        {"$match": {"program": {"$nin": ["", None]}, "rating": {"$gt": 0}}},
        {"$group": {"_id": "$program", "avg": {"$avg": "$rating"}, "n": {"$sum": 1}}},
        {"$sort": {"avg": -1, "n": -1, "_id": 1}},
        {"$limit": limit},
    ]
    items = [
        {"name": r["_id"], "rating": f"{float(r['avg']):.1f}", "count": int(r["n"])}
        async for r in _feedback().aggregate(pipeline)
    ]
    return ProgramRatingListResponse(items=items, total=len(items))


# Older clients called this name; same data.
@router.get("/top-programs", response_model=ProgramRatingListResponse, summary="Alias of /program-ratings",
    dependencies=[Depends(require_permission("feedback.view"))],
)
async def top_programs(limit: int = Query(8, ge=1, le=50)):
    return await program_ratings(limit)


@router.get("/export", summary="Export filtered feedback as CSV",
    dependencies=[Depends(require_permission("feedback.export"))],
)
async def export_feedback(
    request: Request,
    q: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    program: Optional[str] = Query(None),
    rating: Optional[str] = Query(None),
    date_range: Optional[str] = Query(None),
    tab: Optional[str] = Query(None),
    sort: str = Query("Newest First"),
    me: dict = Depends(get_current_user),
):
    query = _build_query(q, type, program, rating, tab, date_range)
    cursor = _feedback().find(query).sort(_sort_spec(sort))

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["User", "Email", "Type", "Program", "Rating", "Date", "Status", "Feedback", "Replies"])
    n = 0
    async for doc in cursor:
        row = FeedbackModel.to_response(doc)
        writer.writerow([
            row["user"], row["email"], row["type"], row["program"],
            row["rating"], row["date"], row["status"], row["text"],
            sum(1 for r in doc.get("replies", []) if not r.get("internal")),
        ])
        n += 1

    await record(me, "feedback.export", detail=f"Exported {n} feedback {'entry' if n == 1 else 'entries'} as CSV", request=request)
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=feedback.csv"},
    )


# --- Requests ------------------------------------------------------------------
@router.get("/requests", response_model=list[FeedbackRequestRow], summary="Feedback requests sent recently",
    dependencies=[Depends(require_permission("feedback.view"))],
)
async def list_requests(limit: int = Query(20, ge=1, le=100)):
    cursor = _requests().find({}).sort("created_at", -1).limit(limit)
    return [
        {
            "id": str(r["_id"]),
            "recipient": r.get("recipient_email", ""),
            "recipient_name": r.get("recipient_name", ""),
            "program": r.get("program", ""),
            "requested_by": r.get("requested_by_name", ""),
            "emailed": bool(r.get("emailed")),
            "at": r["created_at"].isoformat() if isinstance(r.get("created_at"), datetime) else "",
        }
        async for r in cursor
    ]


@router.post("/requests", response_model=FeedbackRequestResponse, status_code=status.HTTP_201_CREATED,
    summary="Ask a member for feedback", dependencies=[Depends(require_permission("feedback.edit"))],
)
async def request_feedback(payload: FeedbackRequestCreate, request: Request, me: dict = Depends(get_current_user)):
    """
    Writes the request down, and emails it when mail can actually leave this
    machine. The response says which happened; the screen repeats it. It used
    to say "sent successfully" and do neither.
    """
    email = payload.recipient.strip().lower()
    if not _EMAIL.match(email):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Enter her email address")
    member = await get_database()["users"].find_one({"email": email}, {"full_name": 1})
    name = (member or {}).get("full_name", "") or ""

    emailed = False
    if can_deliver():
        greeting = f"Hi {name.split(' ')[0]}," if name else "Hi,"
        about = f" about <b>{payload.program.strip()}</b>" if payload.program.strip() else ""
        note = f"<p>{payload.message.strip()}</p>" if payload.message.strip() else ""
        html = _wrap(
            "We'd love your feedback",
            f"<p>{greeting}</p><p>The WomSakhi team would like to hear how it went{about}.</p>{note}"
            "<p>Reply to this email, or leave your feedback in the app.</p>",
        )
        text = f"{greeting}\n\nThe WomSakhi team would like to hear how it went{about.replace('<b>', '').replace('</b>', '')}.\n\n{payload.message.strip()}".strip()
        emailed = await send(EmailMessageSpec(to=email, subject="We'd love your feedback", html=html, text=text), email)

    doc = {
        "recipient_email": email,
        "recipient_name": name,
        "recipient_id": str(member["_id"]) if member else "",
        "program": payload.program.strip(),
        "message": payload.message.strip()[:2000],
        "requested_by": str(me.get("_id", "")),
        "requested_by_name": me.get("full_name", "") or me.get("email", ""),
        "emailed": emailed,
        "created_at": _now(),
    }
    result = await _requests().insert_one(doc)
    who = name or email
    await record(me, "feedback.request", target=str(result.inserted_id),
                 detail=f"Asked {who} for feedback{' on ' + payload.program.strip() if payload.program.strip() else ''}"
                        f"{' (emailed)' if emailed else ' (saved; email not configured)'}", request=request)
    return FeedbackRequestResponse(
        id=str(result.inserted_id),
        emailed=emailed,
        message=(f"Request emailed to {who}." if emailed
                 else f"Request saved for {who}. Email is not set up on this server, so nothing was sent."),
    )


# --- Detail / mutations (dynamic /{id} comes last) ---------------------------
async def _doc_or_404(feedback_id: str) -> dict:
    doc = await _feedback().find_one({"_id": to_object_id(feedback_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Feedback not found")
    return doc


def _snippet(doc: dict, n: int = 60) -> str:
    text = (doc.get("text") or "").strip()
    return text if len(text) <= n else text[: n - 1] + "…"


@router.get("/{feedback_id}", response_model=FeedbackResponse, summary="Get a feedback entry",
    dependencies=[Depends(require_permission("feedback.view"))],
)
async def get_feedback(feedback_id: str):
    return FeedbackResponse(**_row(await _doc_or_404(feedback_id)))


@router.post("/{feedback_id}/replies", response_model=FeedbackResponse, summary="Reply to her, or leave an internal note",
    dependencies=[Depends(require_permission("feedback.edit"))],
)
async def reply_to_feedback(feedback_id: str, payload: FeedbackReplyCreate, request: Request, me: dict = Depends(get_current_user)):
    doc = await _doc_or_404(feedback_id)
    emailed = False
    to = (doc.get("user_email") or "").strip().lower()
    if not payload.internal and to and can_deliver():
        html = _wrap(
            "A reply to your feedback",
            f"<p>Hi {(doc.get('user_name') or '').split(' ')[0] or 'there'},</p>"
            f"<p>You wrote:</p><blockquote>{_snippet(doc, 400)}</blockquote>"
            f"<p>{payload.text}</p><p>— {me.get('full_name', '') or 'The WomSakhi team'}</p>",
        )
        emailed = await send(EmailMessageSpec(to=to, subject="A reply to your feedback", html=html, text=payload.text), to)

    reply = {
        "id": str(ObjectId()),
        "by": me.get("full_name", "") or me.get("email", ""),
        "by_id": str(me.get("_id", "")),
        "text": payload.text,
        "at": _now(),
        "internal": payload.internal,
        "emailed": emailed,
    }
    updates: dict = {"updated_at": _now()}
    # Answering something is looking at it; an Open entry moves to In Review.
    if doc.get("status") == "Open":
        updates["status"] = "In Review"
    doc = await _feedback().find_one_and_update(
        {"_id": doc["_id"]}, {"$push": {"replies": reply}, "$set": updates}, return_document=True,
    )
    await record(
        me, "feedback.note" if payload.internal else "feedback.reply", target=feedback_id,
        detail=(f"Left a note on feedback from {doc.get('user_name', '')}" if payload.internal
                else f"Replied to {doc.get('user_name', '')}{' by email' if emailed else ' (stored; email not configured)'}"),
        request=request,
    )
    return FeedbackResponse(**_row(doc))


@router.patch("/{feedback_id}/status", response_model=FeedbackResponse, summary="Change feedback status",
    dependencies=[Depends(require_permission("feedback.edit"))],
)
async def set_feedback_status(feedback_id: str, payload: FeedbackStatusUpdate, request: Request, me: dict = Depends(get_current_user)):
    before = await _doc_or_404(feedback_id)
    doc = await _feedback().find_one_and_update(
        {"_id": before["_id"]},
        {"$set": {"status": payload.status, "updated_at": _now()}},
        return_document=True,
    )
    if before.get("status") != payload.status:
        await record(me, "feedback.status", target=feedback_id,
                     detail=f"Marked feedback from {doc.get('user_name', '')} as {payload.status} (was {before.get('status', '')})",
                     request=request)
    return FeedbackResponse(**_row(doc))


@router.delete("/{feedback_id}", summary="Delete a feedback entry",
    dependencies=[Depends(require_permission("feedback.delete"))],
)
async def delete_feedback(feedback_id: str, request: Request, me: dict = Depends(get_current_user)):
    doc = await _doc_or_404(feedback_id)
    await _feedback().delete_one({"_id": doc["_id"]})
    await record(me, "feedback.delete", target=feedback_id,
                 detail=f"Deleted feedback from {doc.get('user_name', '')}: “{_snippet(doc)}”", request=request)
    return {"message": "Feedback deleted"}


async def seed() -> None:
    """
    Nothing to seed. Feedback is what members write; an empty list on a fresh
    database is the truth, and the invented rows this used to insert (five
    made-up women praising made-up programmes) read as data to everyone who
    saw them. The seeded theme and programme-rating collections are no
    longer read by anything.
    """
    return None
