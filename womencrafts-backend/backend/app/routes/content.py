import csv
import io
import re
from datetime import datetime, timedelta, timezone
from math import ceil
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.core import mongosafe
from app.core.permissions import require_permission
from app.core.deps import get_current_user
from app.core.serializers import to_object_id
from app.db.mongodb import get_database
from app.models.content import (
    ContentActivityModel,
    ContentItemModel,
    ContentStatsModel,
)
from app.routes._paging import paged
from app.schemas.content import (
    ContentActivityResponse,
    ContentBulkAction,
    ContentBulkResult,
    ContentCreate,
    ContentListResponse,
    ContentResponse,
    ContentStatsResponse,
    ContentStatusUpdate,
    ContentUpdate,
)

router = APIRouter(prefix="/content", tags=["Content"])


def _items():
    return get_database()[ContentItemModel.collection_name]


def _activities():
    return get_database()[ContentActivityModel.collection_name]


def _stats():
    return get_database()[ContentStatsModel.collection_name]


# The tabs shown above the table map onto a content type ('All Content' = no gate).
TAB_TYPE = {
    "All Content": None,
    "Pages": "Page",
    "Blog Posts": "Blog Post",
    "Media": "Media",
    "Testimonials": "Testimonial",
    "FAQs": "FAQ",
    "Banners": "Banner",
}

# The Author filter dropdown, in the order the UI lists them.
AUTHORS = ["Neha Verma", "Priya Sharma", "Ritika Singh", "Anjali Mehta"]

# The Content Overview donut's 5 fixed, coloured slices (order + colour are the
# UI's design, only the counts change). Real content types are folded into these
# buckets; anything not mapped lands in "Others".
_OVERVIEW_BUCKETS = [
    ("Pages", "#22c55e"),
    ("Blog Posts", "#3b82f6"),
    ("Media", "#f59e0b"),
    ("Banners", "#a855f7"),
    ("Others", "#e6117e"),
]
_TYPE_TO_BUCKET = {
    "Page": "Pages",
    "Blog Post": "Blog Posts",
    "Media": "Media",
    "Banner": "Banners",
    # FAQ / Program / Testimonial / anything else -> "Others"
}

# Storage Usage has no per-item source; these are the fixed figures the widget
# paints when the seeded content_stats singleton is unavailable.
_STORAGE_DEFAULTS = {"storage_used_gb": 24.6, "storage_total_gb": 100, "storage_percent": 24.6}


def _now_label() -> str:
    """The 'May 20, 2024 10:30 AM' style stamp the UI shows for Last Updated."""
    return datetime.now(timezone.utc).strftime("%b %d, %Y %I:%M %p")


def _slugify(title: str) -> str:
    """Auto-slug: '/' + title lowercased with whitespace collapsed to hyphens."""
    return "/" + re.sub(r"\s+", "-", title.strip().lower())


def _filter_query(
    type: Optional[str],
    status: Optional[str],
    author: Optional[str],
    q: Optional[str],
    tab: Optional[str] = None,
    published_only: bool = False,
) -> dict:
    """Translate the screen's filters into a Mongo query (shared by list + export)."""
    query: dict = {}

    # Tab and the Type dropdown both constrain type; the UI ANDs them, so two
    # different values can never both match -> force an empty result set.
    type_constraints = []
    tab_type = TAB_TYPE.get(tab) if tab else None
    if tab_type:
        type_constraints.append(tab_type)
    if type and type not in ("All Types", "all"):
        type_constraints.append(type)
    distinct_types = set(type_constraints)
    if len(distinct_types) == 1:
        query["type"] = type_constraints[0]
    elif len(distinct_types) > 1:
        query["type"] = {"$in": []}

    # Status dropdown + the 'Published only' extra filter combine the same way.
    status_constraints = []
    if status and status not in ("All Status", "all"):
        status_constraints.append(status)
    if published_only:
        status_constraints.append("Published")
    distinct_status = set(status_constraints)
    if len(distinct_status) == 1:
        query["status"] = status_constraints[0]
    elif len(distinct_status) > 1:
        query["status"] = {"$in": []}

    if author and author not in ("All Authors", "all"):
        query["author"] = author

    if q and q.strip():
        query.update(mongosafe.any_of(q, ["title", "slug"]))

    return query


@router.get("", response_model=ContentListResponse, summary="List content items")
async def list_content(
    tab: Optional[str] = Query(None, description="Active tab; maps to a content type"),
    type: Optional[str] = Query(None, description="Filter by type"),
    status: Optional[str] = Query(None, description="Filter by status"),
    author: Optional[str] = Query(None, description="Filter by author"),
    q: Optional[str] = Query(None, description="Search by title or slug"),
    published_only: bool = Query(False, description="Force status = Published"),
    page: int = Query(1, ge=1),
    page_size: int = Query(8, ge=1, le=100),
    _: dict = Depends(get_current_user),
):
    query = _filter_query(type, status, author, q, tab=tab, published_only=published_only)

    total, docs = await paged(
        _items(), query,
        sort="created_at", direction=-1,  # newest first — new items surface at the top
        page=page, page_size=page_size,
    )
    total_pages = max(1, ceil(total / page_size)) if page_size else 1
    start = (page - 1) * page_size
    items = [ContentItemModel.to_response(doc) for doc in docs]
    return ContentListResponse(
        items=items,
        total=total,
        showing_from=0 if total == 0 else start + 1,
        showing_to=min(start + page_size, total),
        page=page,
        total_pages=total_pages,
    )


def _pct(part: int, total: int) -> float:
    """Percentage of `total`, rounded to 1 decimal — the UI's '(71.8%)' format."""
    return round(part / total * 100, 1) if total else 0.0


async def _build_stats() -> ContentStatsResponse:
    """Compute the content stat snapshot live from the `content_items` collection.

    Everything derivable from the real documents is counted here: the total, the
    status breakdown (top cards), and the type breakdown that feeds both the
    Content Overview donut and the Content Categories bars. Only Storage Usage —
    which has no per-item source — is read from the seeded content_stats
    singleton (falling back to fixed defaults)."""
    docs = [d async for d in _items().find({}, {"type": 1, "status": 1})]
    total = len(docs)

    # --- Status breakdown (top cards). Trashing deletes the document, so there
    # is no live source for a 'trash' status -> anything outside the three known
    # statuses is counted as trash, which is 0 in practice.
    def _status_count(name: str) -> int:
        return sum(1 for d in docs if d.get("status") == name)

    published = _status_count("Published")
    draft = _status_count("Draft")
    scheduled = _status_count("Scheduled")
    trash = sum(1 for d in docs if d.get("status") not in ("Published", "Draft", "Scheduled"))

    # --- Type breakdown, feeding both the overview donut and the category bars.
    type_counts: dict[str, int] = {}
    for d in docs:
        t = d.get("type", "")
        type_counts[t] = type_counts.get(t, 0) + 1

    # Overview donut: fold real types into the 5 fixed, coloured buckets.
    bucket_counts: dict[str, int] = {name: 0 for name, _ in _OVERVIEW_BUCKETS}
    for t, c in type_counts.items():
        bucket_counts[_TYPE_TO_BUCKET.get(t, "Others")] += c
    overview = [
        {
            "name": name,
            "value": bucket_counts[name],
            "color": color,
            "label": f"{bucket_counts[name]} ({_pct(bucket_counts[name], total)}%)",
        }
        for name, color in _OVERVIEW_BUCKETS
    ]

    # Category bars: one bar per actual content type, largest first (ties A→Z).
    ordered_types = sorted(type_counts.items(), key=lambda kv: (-kv[1], kv[0]))
    categories = [
        {"name": t, "value": _pct(c, total), "label": f"{c} ({_pct(c, total)}%)"}
        for t, c in ordered_types
    ]

    # Storage Usage: no per-item source, so keep the seeded figures (or defaults).
    storage = await _stats().find_one({}) or {}
    return ContentStatsResponse(
        total_content=total,
        published=published, published_pct=_pct(published, total),
        draft=draft, draft_pct=_pct(draft, total),
        scheduled=scheduled, scheduled_pct=_pct(scheduled, total),
        trash=trash, trash_pct=_pct(trash, total),
        overview=overview,
        overview_total=str(total),
        categories=categories,
        storage_used_gb=storage.get("storage_used_gb", _STORAGE_DEFAULTS["storage_used_gb"]),
        storage_total_gb=storage.get("storage_total_gb", _STORAGE_DEFAULTS["storage_total_gb"]),
        storage_percent=storage.get("storage_percent", _STORAGE_DEFAULTS["storage_percent"]),
    )


@router.get("/stats", response_model=ContentStatsResponse, summary="Content stat snapshot")
async def content_stats(_: dict = Depends(get_current_user)):
    return await _build_stats()


@router.get("/activity", response_model=list[ContentActivityResponse], summary="Recent activity feed")
@router.get("/activities", response_model=list[ContentActivityResponse], include_in_schema=False)
async def content_activity(
    limit: int = Query(4, ge=1, le=50),
    _: dict = Depends(get_current_user),
):
    cursor = _activities().find({}).sort("order", 1).limit(limit)
    return [ContentActivityResponse(**ContentActivityModel.to_response(doc)) async for doc in cursor]


@router.get("/authors", response_model=list[str], summary="Distinct authors")
async def content_authors(_: dict = Depends(get_current_user)):
    present = set(await _items().distinct("author"))
    # Keep the known authors in their UI order, then append any extras.
    ordered = [a for a in AUTHORS if a in present]
    ordered += sorted(a for a in present if a not in AUTHORS)
    return ordered


@router.get("/export", summary="Export filtered content as CSV")
async def export_content(
    type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    author: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    _: dict = Depends(get_current_user),
):
    query = _filter_query(type, status, author, q)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Title", "Slug", "Type", "Status", "Author", "Last Updated"])
    cursor = _items().find(query).sort("created_at", -1)
    async for doc in cursor:
        row = ContentItemModel.to_response(doc)
        writer.writerow([row["title"], row["slug"], row["type"], row["status"], row["author"], row["updated"]])
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="content-export.csv"'},
    )


@router.post("", response_model=ContentResponse, status_code=status.HTTP_201_CREATED, summary="Create content", dependencies=[Depends(require_permission("content.create"))])
async def create_content(payload: ContentCreate, _: dict = Depends(get_current_user)):
    slug = payload.slug.strip() or _slugify(payload.title)
    doc = ContentItemModel.create_document(
        title=payload.title,
        slug=slug,
        type=payload.type,
        status=payload.status,
        author=payload.author,
        description=payload.description,
        cover=payload.cover,
        last_updated=_now_label(),
    )
    result = await _items().insert_one(doc)
    doc["_id"] = result.inserted_id
    return ContentResponse(**ContentItemModel.to_response(doc))


@router.post("/bulk", response_model=ContentBulkResult, summary="Bulk publish / draft / trash", dependencies=[Depends(require_permission("content.edit"))])
async def bulk_content(payload: ContentBulkAction, _: dict = Depends(get_current_user)):
    oids = [to_object_id(i) for i in payload.ids]
    query = {"_id": {"$in": oids}}

    if payload.action == "trash":
        result = await _items().delete_many(query)
        return ContentBulkResult(action="trash", affected=result.deleted_count, message="Moved to trash")

    new_status = "Published" if payload.action == "publish" else "Draft"
    updates = {
        "status": new_status,
        "s_tone": ContentItemModel.s_tone_for(new_status),
        "last_updated": _now_label(),
        "updated_at": datetime.now(timezone.utc),
    }
    result = await _items().update_many(query, {"$set": updates})
    verb = "Published" if payload.action == "publish" else "Moved to draft"
    return ContentBulkResult(action=payload.action, affected=result.modified_count, message=verb)


@router.get("/{item_id}", response_model=ContentResponse, summary="Get a content item")
async def get_content(item_id: str, _: dict = Depends(get_current_user)):
    doc = await _items().find_one({"_id": to_object_id(item_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Content not found")
    return ContentResponse(**ContentItemModel.to_response(doc))


@router.put("/{item_id}", response_model=ContentResponse, summary="Edit a content item", dependencies=[Depends(require_permission("content.edit"))])
async def update_content(item_id: str, payload: ContentUpdate, _: dict = Depends(get_current_user)):
    oid = to_object_id(item_id)
    doc = await _items().find_one({"_id": oid})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Content not found")

    updates = payload.model_dump(exclude_unset=True)

    if updates.get("title"):
        updates["title"] = updates["title"].strip()

    # Changing the type re-derives its badge tone and icon.
    if updates.get("type"):
        updates["tone"] = ContentItemModel.tone_for(updates["type"])
        updates["icon"] = ContentItemModel.icon_for(updates["type"])

    # Changing the status re-derives its status-dot tone.
    if updates.get("status"):
        updates["s_tone"] = ContentItemModel.s_tone_for(updates["status"])

    # A blank slug keeps the existing one (matches the edit form behaviour).
    if "slug" in updates:
        slug = (updates["slug"] or "").strip()
        if slug:
            updates["slug"] = slug
        else:
            updates.pop("slug")

    updates["last_updated"] = _now_label()
    updates["updated_at"] = datetime.now(timezone.utc)
    doc = await _items().find_one_and_update(
        {"_id": oid},
        {"$set": updates},
        return_document=True,
    )
    return ContentResponse(**ContentItemModel.to_response(doc))


@router.patch("/{item_id}/status", response_model=ContentResponse, summary="Change content status", dependencies=[Depends(require_permission("content.approve"))])
async def set_content_status(item_id: str, payload: ContentStatusUpdate, _: dict = Depends(get_current_user)):
    oid = to_object_id(item_id)
    doc = await _items().find_one_and_update(
        {"_id": oid},
        {"$set": {
            "status": payload.status,
            "s_tone": ContentItemModel.s_tone_for(payload.status),
            "last_updated": _now_label(),
            "updated_at": datetime.now(timezone.utc),
        }},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Content not found")
    return ContentResponse(**ContentItemModel.to_response(doc))


@router.delete("/{item_id}", summary="Move a content item to trash / delete", dependencies=[Depends(require_permission("content.delete"))])
async def delete_content(item_id: str, _: dict = Depends(get_current_user)):
    result = await _items().delete_one({"_id": to_object_id(item_id)})
    if result.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Content not found")
    return {"message": "Content deleted"}


# --- Seed --------------------------------------------------------------------
# The exact eight rows the UI renders today (INITIAL_ROWS on the Content screen).
_ITEMS = [
    dict(title="About Us", slug="/about-us", type="Page", status="Published", author="Neha Verma", updated="May 20, 2024 10:30 AM"),
    dict(title="Empowering Women Through Handicrafts", slug="/blog/empowering-women", type="Blog Post", status="Published", author="Priya Sharma", updated="May 19, 2024 03:15 PM"),
    dict(title="Summer Workshop Banner", slug="/banners/summer-workshop", type="Banner", status="Scheduled", author="Ritika Singh", updated="May 21, 2024 09:00 AM"),
    dict(title="Our Services", slug="/services", type="Page", status="Published", author="Neha Verma", updated="May 18, 2024 11:45 AM"),
    dict(title="Sewing Basics for Beginners", slug="/programs/sewing-basics", type="Program", status="Draft", author="Anjali Mehta", updated="May 18, 2024 09:20 AM"),
    dict(title="Frequently Asked Questions", slug="/faqs", type="FAQ", status="Published", author="Priya Sharma", updated="May 17, 2024 02:40 PM"),
    dict(title="Our Impact", slug="/impact", type="Page", status="Draft", author="Ritika Singh", updated="May 16, 2024 10:10 AM"),
    dict(title="Handmade Bags Collection", slug="/media/handmade-bags.jpg", type="Media", status="Published", author="Anjali Mehta", updated="May 15, 2024 04:30 PM"),
]

# The Recent Activity feed (ACTIVITY on the screen), top to bottom.
_ACTIVITIES = [
    dict(icon="CircleCheck", tone="emerald", text='Page "About Us" published', meta="May 20, 2024 at 10:30 AM by Neha Verma"),
    dict(icon="Pencil", tone="violet", text='Blog post "Empowering Women…" updated', meta="May 19, 2024 at 03:15 PM by Priya Sharma"),
    dict(icon="CalendarClock", tone="amber", text='Banner "Summer Workshop" scheduled', meta="May 18, 2024 at 11:45 AM by Ritika Singh"),
    dict(icon="Trash2", tone="rose", text='FAQ "Returns Policy" moved to trash', meta="May 17, 2024 at 01:20 PM by Admin User"),
]

# The Content Overview donut (values + colours) with its legend labels.
_OVERVIEW = [
    dict(name="Pages", value=48, color="#22c55e", label="48 (30.8%)"),
    dict(name="Blog Posts", value=62, color="#3b82f6", label="62 (39.7%)"),
    dict(name="Media", value=24, color="#f59e0b", label="24 (15.4%)"),
    dict(name="Banners", value=12, color="#a855f7", label="12 (7.7%)"),
    dict(name="Others", value=10, color="#e6117e", label="10 (6.4%)"),
]

# The Content Categories progress bars.
_CATEGORIES = [
    dict(name="Women Empowerment", value=29, label="18 (29.0%)"),
    dict(name="Handicrafts", value=25.8, label="16 (25.8%)"),
    dict(name="Training & Workshops", value=22.6, label="14 (22.6%)"),
    dict(name="Success Stories", value=12.9, label="8 (12.9%)"),
    dict(name="Events", value=9.7, label="6 (9.7%)"),
]


async def seed() -> None:
    """Seed the content collections with the exact UI mock data, only if empty."""
    db = get_database()

    if await db[ContentItemModel.collection_name].count_documents({}) == 0:
        base = datetime.now(timezone.utc)
        docs = [
            ContentItemModel.create_document(
                title=it["title"], slug=it["slug"], type=it["type"], status=it["status"],
                author=it["author"], last_updated=it["updated"],
                # Descending created_at preserves the on-screen row order.
                created_at=base - timedelta(seconds=i),
            )
            for i, it in enumerate(_ITEMS)
        ]
        await db[ContentItemModel.collection_name].insert_many(docs)
        print(f"🌱 Seeded {len(docs)} content items")

    if await db[ContentActivityModel.collection_name].count_documents({}) == 0:
        docs = [
            ContentActivityModel.create_document(
                icon=a["icon"], tone=a["tone"], text=a["text"], meta=a["meta"], order=i,
            )
            for i, a in enumerate(_ACTIVITIES)
        ]
        await db[ContentActivityModel.collection_name].insert_many(docs)
        print(f"🌱 Seeded {len(docs)} content activities")

    if await db[ContentStatsModel.collection_name].count_documents({}) == 0:
        doc = ContentStatsModel.create_document(
            total_content=156,
            published=112, published_pct=71.8,
            draft=28, draft_pct=17.9,
            scheduled=12, scheduled_pct=7.7,
            trash=4, trash_pct=2.6,
            overview=_OVERVIEW,
            overview_total="156",
            categories=_CATEGORIES,
            storage_used_gb=24.6, storage_total_gb=100, storage_percent=24.6,
        )
        await db[ContentStatsModel.collection_name].insert_one(doc)
        print("🌱 Seeded content stats")
