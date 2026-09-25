import csv
import io
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.core import mongosafe
from app.core.permissions import require_permission
from app.core.deps import get_current_user
from app.core.serializers import page_meta, to_object_id
from app.db.mongodb import get_database
from app.models.feedback import FeedbackModel, FeedbackThemeModel, ProgramRatingModel
from app.routes._paging import paged
from app.schemas.feedback import (
    FeedbackListResponse,
    FeedbackOverviewResponse,
    FeedbackRequestCreate,
    FeedbackRequestResponse,
    FeedbackResponse,
    FeedbackStatsResponse,
    FeedbackStatusUpdate,
    FeedbackThemeListResponse,
    ProgramRatingListResponse,
)

router = APIRouter(prefix="/feedback", tags=["Feedback"])


def _feedback():
    return get_database()[FeedbackModel.collection_name]


def _themes():
    return get_database()[FeedbackThemeModel.collection_name]


def _program_ratings():
    return get_database()[ProgramRatingModel.collection_name]


async def _feedback_docs() -> list[dict]:
    """Load the real feedback rows once, for the aggregate endpoints."""
    projection = {"rating": 1, "sentiment": 1, "type": 1, "status": 1, "user_email": 1}
    return [doc async for doc in _feedback().find({}, projection)]


# Overview donut slices, in the exact order/colour the UI paints, priority order.
_OVERVIEW_COLORS = {
    "Positive": "#22c55e",
    "Suggestion": "#3b82f6",
    "Neutral": "#f59e0b",
    "Negative": "#e6117e",
}


def _overview_bucket(doc: dict) -> str:
    """Assign a feedback row to exactly one donut slice. Sentiment wins so the
    Positive/Negative slices match the sentiment-based positive_percentage; a
    remaining Suggestion falls into its own slice, everything else is Neutral."""
    sentiment = doc.get("sentiment")
    if sentiment == "Positive":
        return "Positive"
    if sentiment == "Negative":
        return "Negative"
    if doc.get("type") == "Suggestion":
        return "Suggestion"
    return "Neutral"


def _build_query(
    q: Optional[str],
    ftype: Optional[str],
    program: Optional[str],
    rating: Optional[str],
    tab: Optional[str],
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
    """Map the UI's sort labels onto Mongo sort specs."""
    if sort == "Oldest First":
        return [("seq", 1)]
    if sort == "Highest Rating":
        return [("rating", -1), ("seq", -1)]
    if sort == "Lowest Rating":
        return [("rating", 1), ("seq", -1)]
    # "Newest First" (default)
    return [("seq", -1)]


# --- List --------------------------------------------------------------------
@router.get("", response_model=FeedbackListResponse, summary="List feedback",
    dependencies=[Depends(require_permission("feedback.view"))],
)
async def list_feedback(
    q: Optional[str] = Query(None, description="Search text, user or program"),
    type: Optional[str] = Query(None, description="Filter by feedback type"),
    program: Optional[str] = Query(None, description="Filter by program"),
    rating: Optional[str] = Query(None, description="Filter by rating, e.g. '5 Stars'"),
    date_range: Optional[str] = Query(None, description="Display-only date range"),
    tab: Optional[str] = Query(None, description="Active tab filter"),
    sort: str = Query("Newest First", description="Sort label from the UI"),
    page: int = Query(1, ge=1),
    page_size: int = Query(5, ge=1, le=100),
    _: dict = Depends(get_current_user),
):
    query = _build_query(q, type, program, rating, tab)
    total, docs = await paged(
        _feedback(), query,
        sort=_sort_spec(sort), page=page, page_size=page_size,
    )
    items = [FeedbackModel.to_response(doc) for doc in docs]
    return FeedbackListResponse(items=items, **page_meta(total, page, page_size))


# --- Stats / aggregates (static paths BEFORE the dynamic /{id}) --------------
@router.get("/stats", response_model=FeedbackStatsResponse, summary="Feedback stat cards",
    dependencies=[Depends(require_permission("feedback.view"))],
)
async def feedback_stats(_: dict = Depends(get_current_user)):
    """Headline figures for the five cards, computed live from the real
    `feedback` collection. The period-over-period deltas have no historical
    source in the DB, so they stay as the blueprint figures."""
    docs = await _feedback_docs()
    total = len(docs)
    ratings = [int(d.get("rating", 0)) for d in docs]
    avg = sum(ratings) / total if total else 0
    positive = sum(1 for d in docs if d.get("sentiment") == "Positive")
    positive_pct = round(positive / total * 100) if total else 0
    users = len({d.get("user_email", "") for d in docs if d.get("user_email")})
    return FeedbackStatsResponse(
        total_feedback=f"{total:,}",
        average_rating=f"{avg:.1f} / 5",
        positive_percentage=f"{positive_pct}%",
        positive_delta="8%",
        responses_this_month=f"{total:,}",
        responses_delta="15%",
        feedback_users=f"{users:,}",
    )


@router.get("/overview", response_model=FeedbackOverviewResponse, summary="Feedback overview donut",
    dependencies=[Depends(require_permission("feedback.view"))],
)
async def feedback_overview(
    date_range: Optional[str] = Query(None, description="Display-only date range"),
    _: dict = Depends(get_current_user),
):
    docs = await _feedback_docs()
    total = len(docs)
    counts = {name: 0 for name in _OVERVIEW_COLORS}
    for doc in docs:
        counts[_overview_bucket(doc)] += 1

    def _pct(value: int) -> int:
        return round(value / total * 100) if total else 0

    items = [
        {
            "name": name,
            "value": counts[name],
            "legend": f"{counts[name]} ({_pct(counts[name])}%)",
            "color": color,
        }
        for name, color in _OVERVIEW_COLORS.items()
    ]
    return FeedbackOverviewResponse(total=f"{total:,}", center_label="Total", items=items)


@router.get("/top-programs", response_model=ProgramRatingListResponse, summary="Top programs by feedback",
    dependencies=[Depends(require_permission("feedback.view"))],
)
async def top_programs(_: dict = Depends(get_current_user)):
    cursor = _program_ratings().find({}).sort([("rating", -1), ("seq", 1)])
    items = [ProgramRatingModel.to_response(doc) async for doc in cursor]
    return ProgramRatingListResponse(items=items, total=len(items))


# Alias for the same data under the /program-ratings prefix.
@router.get("/program-ratings", response_model=ProgramRatingListResponse, summary="Program ratings",
    dependencies=[Depends(require_permission("feedback.view"))],
)
async def program_ratings(_: dict = Depends(get_current_user)):
    cursor = _program_ratings().find({}).sort([("rating", -1), ("seq", 1)])
    items = [ProgramRatingModel.to_response(doc) async for doc in cursor]
    return ProgramRatingListResponse(items=items, total=len(items))


@router.get("/themes", response_model=FeedbackThemeListResponse, summary="Common feedback themes",
    dependencies=[Depends(require_permission("feedback.view"))],
)
async def feedback_themes(_: dict = Depends(get_current_user)):
    cursor = _themes().find({}).sort("seq", 1)
    items = [FeedbackThemeModel.to_response(doc) async for doc in cursor]
    return FeedbackThemeListResponse(items=items, total=len(items))


@router.get("/export", summary="Export filtered feedback as CSV",
    dependencies=[Depends(require_permission("feedback.export"))],
)
async def export_feedback(
    q: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    program: Optional[str] = Query(None),
    rating: Optional[str] = Query(None),
    date_range: Optional[str] = Query(None),
    tab: Optional[str] = Query(None),
    sort: str = Query("Newest First"),
    _: dict = Depends(get_current_user),
):
    query = _build_query(q, type, program, rating, tab)
    cursor = _feedback().find(query).sort(_sort_spec(sort))

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["User", "Email", "Type", "Program", "Rating", "Date", "Status", "Feedback"])
    async for doc in cursor:
        row = FeedbackModel.to_response(doc)
        writer.writerow([
            row["user"], row["email"], row["type"], row["program"],
            row["rating"], row["date"], row["status"], row["text"],
        ])

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=feedback.csv"},
    )


@router.post("/requests", response_model=FeedbackRequestResponse, summary="Send a feedback request", dependencies=[Depends(require_permission("feedback.edit"))])
async def request_feedback(payload: FeedbackRequestCreate, _: dict = Depends(get_current_user)):
    # The Request Feedback modal — fire-and-forget, nothing is persisted.
    if not payload.recipient.strip():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Recipient is required")
    return FeedbackRequestResponse(message="Feedback request sent successfully.")


# --- Detail / mutations (dynamic /{id} comes last) ---------------------------
@router.get("/{feedback_id}", response_model=FeedbackResponse, summary="Get a feedback entry",
    dependencies=[Depends(require_permission("feedback.view"))],
)
async def get_feedback(feedback_id: str, _: dict = Depends(get_current_user)):
    doc = await _feedback().find_one({"_id": to_object_id(feedback_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Feedback not found")
    return FeedbackResponse(**FeedbackModel.to_response(doc))


@router.patch("/{feedback_id}/status", response_model=FeedbackResponse, summary="Change feedback status", dependencies=[Depends(require_permission("feedback.edit"))])
async def set_feedback_status(feedback_id: str, payload: FeedbackStatusUpdate, _: dict = Depends(get_current_user)):
    oid = to_object_id(feedback_id)
    doc = await _feedback().find_one_and_update(
        {"_id": oid},
        {"$set": {"status": payload.status, "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Feedback not found")
    return FeedbackResponse(**FeedbackModel.to_response(doc))


@router.delete("/{feedback_id}", summary="Delete a feedback entry", dependencies=[Depends(require_permission("feedback.delete"))])
async def delete_feedback(feedback_id: str, _: dict = Depends(get_current_user)):
    result = await _feedback().delete_one({"_id": to_object_id(feedback_id)})
    if result.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Feedback not found")
    return {"message": "Feedback deleted"}


# --- Seed --------------------------------------------------------------------
def _dt(label: str) -> datetime:
    """Parse a 'Jun 20, 2024 10:30 AM' label into a timezone-aware datetime."""
    return datetime.strptime(label, "%b %d, %Y %I:%M %p").replace(tzinfo=timezone.utc)


# Exact rows from the Feedback screen (INITIAL_ROWS).
_FEEDBACK = [
    dict(seq=1, sentiment="Positive", text="Amazing program! The Digital Skills for Women course helped me gain confidence and new skills.", user_name="Priya Sharma", user_email="priya.sharma@email.com", type="Program Feedback", program="Digital Skills for Women", rating=5, status="Resolved", date="Jun 20, 2024 10:30 AM"),
    dict(seq=2, sentiment="Neutral", text="Good experience overall. Would love to see more advanced content in the Entrepreneurship Bootcamp.", user_name="Neha Verma", user_email="neha.verma@email.com", type="Suggestion", program="Entrepreneurship Bootcamp", rating=4, status="In Review", date="Jun 19, 2024 04:15 PM"),
    dict(seq=3, sentiment="Negative", text="The session was informative but the timing was not convenient for me. Please consider weekend batches.", user_name="Aisha Khan", user_email="aisha.khan@email.com", type="Complaint", program="Leadership for Change", rating=2, status="Open", date="Jun 18, 2024 09:45 AM"),
    dict(seq=4, sentiment="Positive", text="Loved the hands-on activities in the Handicrafts Mastery Program. The instructor was excellent!", user_name="Kavita Joshi", user_email="kavita.joshi@email.com", type="Program Feedback", program="Handicrafts Mastery Program", rating=5, status="Resolved", date="Jun 17, 2024 02:20 PM"),
    dict(seq=5, sentiment="Neutral", text="Could you add more resources and reading materials for better understanding?", user_name="Meera Patel", user_email="meera.patel@email.com", type="Suggestion", program="Sustainable Fashion Workshop", rating=4, status="In Review", date="Jun 16, 2024 11:05 AM"),
]

# Exact "What are people saying?" cards (THEMES).
_THEMES = [
    dict(seq=1, label="Great Instructors", icon="ThumbsUp", tone="emerald", mentions=128, delta=20, up=True),
    dict(seq=2, label="Practical Learning", icon="BookOpen", tone="violet", mentions=96, delta=15, up=True),
    dict(seq=3, label="Better Scheduling", icon="Clock", tone="amber", mentions=54, delta=5, up=False),
    dict(seq=4, label="More Resources", icon="FileText", tone="sky", mentions=42, delta=10, up=True),
]

# Exact "Top Programs by Feedback" list (TOP_PROGRAMS).
_PROGRAM_RATINGS = [
    dict(seq=1, name="Digital Skills for Women", rating=4.8),
    dict(seq=2, name="Entrepreneurship Bootcamp", rating=4.6),
    dict(seq=3, name="Handicrafts Mastery Program", rating=4.5),
    dict(seq=4, name="Leadership for Change", rating=4.4),
    dict(seq=5, name="Sustainable Fashion Workshop", rating=4.3),
]


async def seed() -> None:
    """Seed the feedback collections only when each is currently empty."""
    db = get_database()

    if await db[FeedbackModel.collection_name].count_documents({}) == 0:
        docs = [
            FeedbackModel.create_document(
                seq=f["seq"], text=f["text"], user_name=f["user_name"],
                user_email=f["user_email"], type=f["type"], program=f["program"],
                rating=f["rating"], sentiment=f["sentiment"], status=f["status"],
                date=_dt(f["date"]),
            )
            for f in _FEEDBACK
        ]
        await db[FeedbackModel.collection_name].insert_many(docs)
        print(f"🌱 Seeded {len(docs)} feedback entries")

    if await db[FeedbackThemeModel.collection_name].count_documents({}) == 0:
        docs = [FeedbackThemeModel.create_document(**t) for t in _THEMES]
        await db[FeedbackThemeModel.collection_name].insert_many(docs)
        print(f"🌱 Seeded {len(docs)} feedback themes")

    if await db[ProgramRatingModel.collection_name].count_documents({}) == 0:
        docs = [ProgramRatingModel.create_document(**p) for p in _PROGRAM_RATINGS]
        await db[ProgramRatingModel.collection_name].insert_many(docs)
        print(f"🌱 Seeded {len(docs)} program ratings")
