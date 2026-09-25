"""
Content — the pages, posts, media and banners on the public site.

── What changed and why ───────────────────────────────────────────────────
Three things on this screen were invented. "Recent Activity" was a seeded
list ("Neha Verma published About Us, May 2024") that no edit ever fed;
"Storage Usage" was 24.6 GB of 100 GB typed into a seed row; and the author
of every item was a name picked from a dropdown of four people who do not
work here. "Move to Trash" deleted the row outright while the screen
promised it could be restored, and "Scheduled" was a label with no date.

Now: the activity feed is the audit log filtered to content actions; storage
is the sum of the files actually uploaded; the author is the staff account
that created the item; Trash is a state a row can come back from; and a
scheduled item carries the time it goes live, which the member-facing read
honours without a scheduler.

── Access ──────────────────────────────────────────────────────────────────
Reads need `content.view`; creating `content.create`; editing `content.edit`;
publishing, unpublishing, scheduling and bulk actions `content.approve`;
trashing and permanent deletion `content.delete`. Every write is recorded.
"""

import csv
import io
import re
from datetime import datetime, timezone
from math import ceil
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status

from app.core import mongosafe
from app.core.audit import record
from app.core.deps import get_current_user
from app.core.permissions import require_permission
from app.core.serializers import to_object_id
from app.db.mongodb import get_database
from app.models.content import ContentItemModel
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

TRASH = "Trash"


def _items():
    return get_database()[ContentItemModel.collection_name]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _label(dt: Optional[datetime]) -> str:
    return dt.strftime("%b %d, %Y %I:%M %p") if isinstance(dt, datetime) else ""


def _iso(dt) -> Optional[str]:
    return dt.isoformat() if isinstance(dt, datetime) else None


def _row(doc: dict) -> dict:
    out = ContentItemModel.to_response(doc)
    out["updated"] = _label(doc.get("updated_at")) or out.get("updated", "")
    out["updated_at"] = _iso(doc.get("updated_at")) or ""
    out["publish_at"] = _iso(doc.get("publish_at"))
    return out


def _slugify(title: str) -> str:
    return "/" + re.sub(r"[^a-z0-9]+", "-", title.strip().lower()).strip("-")


def _normalise_slug(slug: str) -> str:
    slug = slug.strip()
    return slug if slug.startswith("/") else "/" + slug


async def _slug_free(slug: str, except_id=None) -> None:
    q: dict = {"slug": slug}
    if except_id is not None:
        q["_id"] = {"$ne": except_id}
    if await _items().find_one(q, {"_id": 1}):
        raise HTTPException(status.HTTP_409_CONFLICT, f"'{slug}' is already used by another item")


def _check_schedule(status_value: Optional[str], publish_at: Optional[datetime], existing: Optional[datetime] = None) -> Optional[datetime]:
    """A scheduled item needs a future time; anything else drops the time."""
    if status_value != "Scheduled":
        return None
    when = publish_at or existing
    if when is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Pick when it should go live")
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    if when <= _now():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "That time has already passed — publish it now instead")
    return when


async def _publish_due() -> int:
    """
    Scheduled items whose time has come become Published.

    Nothing runs on a timer here, so the flip happens when somebody looks: the
    member-facing read already treats a due item as published, and this writes
    that fact back so both sides agree.
    """
    res = await _items().update_many(
        {"status": "Scheduled", "publish_at": {"$lte": _now()}},
        {"$set": {"status": "Published", "s_tone": ContentItemModel.s_tone_for("Published"),
                  "last_updated": _label(_now()), "updated_at": _now()}},
    )
    return res.modified_count


# The tabs shown above the table map onto a content type ('All Content' = no gate).
TAB_TYPE = {
    "All Content": None, "Pages": "Page", "Blog Posts": "Blog Post", "Media": "Media",
    "Testimonials": "Testimonial", "FAQs": "FAQ", "Banners": "Banner", "Trash": None,
}

_OVERVIEW_BUCKETS = [("Pages", "#22c55e"), ("Blog Posts", "#3b82f6"), ("Media", "#f59e0b"), ("Banners", "#a855f7"), ("Others", "#e6117e")]
_TYPE_TO_BUCKET = {"Page": "Pages", "Blog Post": "Blog Posts", "Media": "Media", "Banner": "Banners"}


def _filter_query(type: Optional[str], status_value: Optional[str], author: Optional[str], q: Optional[str],
                  tab: Optional[str] = None, published_only: bool = False) -> dict:
    """Translate the screen's filters into a Mongo query (shared by list + export)."""
    query: dict = {}

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

    # Trash is its own place: shown only when asked for, never mixed in.
    in_trash = tab == "Trash" or status_value == TRASH
    if in_trash:
        query["status"] = TRASH
    else:
        status_constraints = []
        if status_value and status_value not in ("All Status", "all"):
            status_constraints.append(status_value)
        if published_only:
            status_constraints.append("Published")
        distinct_status = set(status_constraints)
        if len(distinct_status) == 1:
            query["status"] = status_constraints[0]
        elif len(distinct_status) > 1:
            query["status"] = {"$in": []}
        else:
            query["status"] = {"$ne": TRASH}

    if author and author not in ("All Authors", "all"):
        query["author"] = author
    if q and q.strip():
        query.update(mongosafe.any_of(q, ["title", "slug"]))
    return query


@router.get("", response_model=ContentListResponse, summary="List content items",
    dependencies=[Depends(require_permission("content.view"))],
)
async def list_content(
    tab: Optional[str] = Query(None, description="Active tab; maps to a content type, or Trash"),
    type: Optional[str] = Query(None),
    status_: Optional[str] = Query(None, alias="status"),
    author: Optional[str] = Query(None),
    q: Optional[str] = Query(None, description="Search by title or slug"),
    published_only: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(8, ge=1, le=200),
):
    await _publish_due()
    query = _filter_query(type, status_, author, q, tab=tab, published_only=published_only)
    total, docs = await paged(_items(), query, sort="updated_at", direction=-1, page=page, page_size=page_size)
    total_pages = max(1, ceil(total / page_size)) if page_size else 1
    start = (page - 1) * page_size
    return ContentListResponse(
        items=[_row(d) for d in docs], total=total,
        showing_from=0 if total == 0 else start + 1, showing_to=min(start + page_size, total),
        page=page, total_pages=total_pages,
    )


def _pct(part: int, total: int) -> float:
    return round(part / total * 100, 1) if total else 0.0


def _size_label(n: int) -> str:
    if n < 1024:
        return f"{n} B"
    if n < 1024 ** 2:
        return f"{n / 1024:.1f} KB"
    if n < 1024 ** 3:
        return f"{n / 1024 ** 2:.1f} MB"
    return f"{n / 1024 ** 3:.2f} GB"


@router.get("/stats", response_model=ContentStatsResponse, summary="Content stat snapshot, counted live",
    dependencies=[Depends(require_permission("content.view"))],
)
async def content_stats():
    await _publish_due()
    docs = [d async for d in _items().find({}, {"type": 1, "status": 1})]
    live = [d for d in docs if d.get("status") != TRASH]
    total = len(live)
    published = sum(1 for d in live if d.get("status") == "Published")
    draft = sum(1 for d in live if d.get("status") == "Draft")
    scheduled = sum(1 for d in live if d.get("status") == "Scheduled")
    trash = len(docs) - total

    type_counts: dict[str, int] = {}
    for d in live:
        type_counts[d.get("type", "")] = type_counts.get(d.get("type", ""), 0) + 1
    bucket_counts = {name: 0 for name, _ in _OVERVIEW_BUCKETS}
    for t, c in type_counts.items():
        bucket_counts[_TYPE_TO_BUCKET.get(t, "Others")] += c
    overview = [
        {"name": name, "value": bucket_counts[name], "color": color, "label": f"{bucket_counts[name]} ({_pct(bucket_counts[name], total)}%)"}
        for name, color in _OVERVIEW_BUCKETS if bucket_counts[name] > 0
    ]
    categories = [
        {"name": t, "value": _pct(c, total), "label": f"{c} ({_pct(c, total)}%)"}
        for t, c in sorted(type_counts.items(), key=lambda kv: (-kv[1], kv[0]))
    ]

    # Storage: the files that were actually uploaded, whatever they were for.
    used, files = 0, 0
    async for u in get_database()["uploads"].find({}, {"size": 1}):
        used += int(u.get("size") or 0)
        files += 1

    return ContentStatsResponse(
        total_content=total,
        published=published, published_pct=_pct(published, total),
        draft=draft, draft_pct=_pct(draft, total),
        scheduled=scheduled, scheduled_pct=_pct(scheduled, total),
        trash=trash, trash_pct=_pct(trash, len(docs)),
        overview=overview, overview_total=str(total), categories=categories,
        storage_used_bytes=used, storage_files=files,
        storage_label=f"{_size_label(used)} in {files} file{'s' if files != 1 else ''}" if files else "No files uploaded yet",
    )


_VERB_ICON = {
    "create": ("FileText", "violet"), "edit": ("Pencil", "violet"), "publish": ("CircleCheck", "emerald"),
    "unpublish": ("PencilLine", "amber"), "schedule": ("CalendarClock", "sky"), "trash": ("Trash2", "rose"),
    "restore": ("RotateCcw", "emerald"), "delete": ("Trash2", "rose"), "export": ("Download", "sky"),
}


@router.get("/activity", response_model=list[ContentActivityResponse], summary="Recent content actions, from the audit log",
    dependencies=[Depends(require_permission("content.view"))],
)
async def content_activity(limit: int = Query(6, ge=1, le=50)):
    out = []
    cursor = get_database()["activity_log"].find({"action": {"$regex": "^content\\."}}).sort("created_at", -1).limit(limit)
    async for a in cursor:
        verb = a.get("action", "").split(".")[-1]
        icon, tone = _VERB_ICON.get(verb, ("FileText", "violet"))
        when = a.get("created_at")
        out.append({
            "id": str(a["_id"]), "icon": icon, "tone": tone, "text": a.get("detail", "") or a.get("action", ""),
            "meta": f"{_label(when)} by {a.get('user_name', '')}".strip(),
        })
    return out


@router.get("/authors", response_model=list[str], summary="Staff who have created content",
    dependencies=[Depends(require_permission("content.view"))],
)
async def content_authors():
    return sorted(a for a in await _items().distinct("author") if a)


@router.get("/export", summary="Export filtered content as CSV",
    dependencies=[Depends(require_permission("content.view"))],
)
async def export_content(
    request: Request,
    type: Optional[str] = Query(None), status_: Optional[str] = Query(None, alias="status"),
    author: Optional[str] = Query(None), q: Optional[str] = Query(None), tab: Optional[str] = Query(None),
    me: dict = Depends(get_current_user),
):
    query = _filter_query(type, status_, author, q, tab=tab)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Title", "Slug", "Type", "Status", "Author", "Goes live", "Last Updated"])
    n = 0
    async for doc in _items().find(query).sort("updated_at", -1):
        r = _row(doc)
        writer.writerow([r["title"], r["slug"], r["type"], r["status"], r["author"], r["publish_at"] or "", r["updated_at"]])
        n += 1
    await record(me, "content.export", detail=f"Exported {n} content item{'s' if n != 1 else ''} as CSV", request=request)
    return Response(content=buffer.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": 'attachment; filename="content-export.csv"'})


@router.post("", response_model=ContentResponse, status_code=status.HTTP_201_CREATED, summary="Create content",
    dependencies=[Depends(require_permission("content.create"))],
)
async def create_content(payload: ContentCreate, request: Request, me: dict = Depends(get_current_user)):
    slug = _normalise_slug(payload.slug) if payload.slug.strip() else _slugify(payload.title)
    await _slug_free(slug)
    publish_at = _check_schedule(payload.status, payload.publish_at)
    doc = ContentItemModel.create_document(
        title=payload.title, slug=slug, type=payload.type, status=payload.status,
        author=me.get("full_name", "") or me.get("email", ""),
        description=payload.description, cover=payload.cover, last_updated=_label(_now()),
    )
    doc["publish_at"] = publish_at
    doc["author_id"] = str(me.get("_id", ""))
    result = await _items().insert_one(doc)
    doc["_id"] = result.inserted_id
    await record(me, "content.create", target=str(doc["_id"]),
                 detail=f"Created {payload.type.lower()} “{payload.title}” as {payload.status.lower()}", request=request)
    return ContentResponse(**_row(doc))


@router.post("/bulk", response_model=ContentBulkResult, summary="Bulk publish / draft / trash / restore / delete",
    dependencies=[Depends(require_permission("content.approve"))],
)
async def bulk_content(payload: ContentBulkAction, request: Request, me: dict = Depends(get_current_user)):
    oids = [to_object_id(i) for i in payload.ids]
    if not oids:
        return ContentBulkResult(action=payload.action, affected=0, message="Nothing selected")
    query = {"_id": {"$in": oids}}
    if payload.action == "delete":
        # Only what is already in Trash can be destroyed.
        res = await _items().delete_many({**query, "status": TRASH})
        affected, msg = res.deleted_count, "Deleted permanently"
    else:
        new_status = {"publish": "Published", "draft": "Draft", "trash": TRASH, "restore": "Draft"}[payload.action]
        if payload.action == "restore":
            query["status"] = TRASH
        res = await _items().update_many(query, {"$set": {
            "status": new_status, "s_tone": ContentItemModel.s_tone_for(new_status),
            "last_updated": _label(_now()), "updated_at": _now(), "publish_at": None,
        }})
        affected = res.modified_count
        msg = {"publish": "Published", "draft": "Moved to draft", "trash": "Moved to Trash", "restore": "Restored to draft"}[payload.action]
    await record(me, f"content.{payload.action}", detail=f"Bulk: {msg.lower()} {affected} item{'s' if affected != 1 else ''}", request=request)
    return ContentBulkResult(action=payload.action, affected=affected, message=msg)


async def _doc_or_404(item_id: str) -> dict:
    doc = await _items().find_one({"_id": to_object_id(item_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Content not found")
    return doc


@router.get("/{item_id}", response_model=ContentResponse, summary="Get a content item",
    dependencies=[Depends(require_permission("content.view"))],
)
async def get_content(item_id: str):
    return ContentResponse(**_row(await _doc_or_404(item_id)))


@router.put("/{item_id}", response_model=ContentResponse, summary="Edit a content item",
    dependencies=[Depends(require_permission("content.edit"))],
)
async def update_content(item_id: str, payload: ContentUpdate, request: Request, me: dict = Depends(get_current_user)):
    doc = await _doc_or_404(item_id)
    updates = payload.model_dump(exclude_unset=True)
    if updates.get("title"):
        updates["title"] = updates["title"].strip()
    if updates.get("type"):
        updates["tone"] = ContentItemModel.tone_for(updates["type"])
        updates["icon"] = ContentItemModel.icon_for(updates["type"])
    if "slug" in updates:
        slug = (updates["slug"] or "").strip()
        if slug:
            updates["slug"] = _normalise_slug(slug)
            await _slug_free(updates["slug"], except_id=doc["_id"])
        else:
            updates.pop("slug")
    new_status = updates.get("status", doc.get("status"))
    if "status" in updates or "publish_at" in updates:
        updates["publish_at"] = _check_schedule(new_status, updates.get("publish_at"), doc.get("publish_at"))
        updates["s_tone"] = ContentItemModel.s_tone_for(new_status)
    updates["last_updated"] = _label(_now())
    updates["updated_at"] = _now()
    doc = await _items().find_one_and_update({"_id": doc["_id"]}, {"$set": updates}, return_document=True)
    changed = sorted(k for k in updates if k not in ("last_updated", "updated_at", "tone", "icon", "s_tone"))
    await record(me, "content.edit", target=item_id,
                 detail=f"Edited “{doc.get('title', '')}”: {', '.join(changed) or 'nothing changed'}", request=request)
    return ContentResponse(**_row(doc))


@router.patch("/{item_id}/status", response_model=ContentResponse, summary="Publish, unpublish or schedule",
    dependencies=[Depends(require_permission("content.approve"))],
)
async def set_content_status(item_id: str, payload: ContentStatusUpdate, request: Request, me: dict = Depends(get_current_user)):
    doc = await _doc_or_404(item_id)
    if doc.get("status") == TRASH:
        raise HTTPException(status.HTTP_409_CONFLICT, "Restore it from Trash first")
    publish_at = _check_schedule(payload.status, payload.publish_at, doc.get("publish_at"))
    doc = await _items().find_one_and_update(
        {"_id": doc["_id"]},
        {"$set": {"status": payload.status, "s_tone": ContentItemModel.s_tone_for(payload.status),
                  "publish_at": publish_at, "last_updated": _label(_now()), "updated_at": _now()}},
        return_document=True,
    )
    verb = {"Published": "publish", "Draft": "unpublish", "Scheduled": "schedule"}[payload.status]
    detail = {"publish": f"Published “{doc.get('title', '')}”", "unpublish": f"Moved “{doc.get('title', '')}” to draft",
              "schedule": f"Scheduled “{doc.get('title', '')}” for {_label(publish_at)}"}[verb]
    await record(me, f"content.{verb}", target=item_id, detail=detail, request=request)
    return ContentResponse(**_row(doc))


@router.delete("/{item_id}", summary="Move a content item to Trash",
    dependencies=[Depends(require_permission("content.delete"))],
)
async def trash_content(item_id: str, request: Request, me: dict = Depends(get_current_user)):
    doc = await _doc_or_404(item_id)
    if doc.get("status") == TRASH:
        raise HTTPException(status.HTTP_409_CONFLICT, "It is already in Trash")
    await _items().update_one({"_id": doc["_id"]}, {"$set": {
        "status": TRASH, "s_tone": "rose", "previous_status": doc.get("status"),
        "publish_at": None, "last_updated": _label(_now()), "updated_at": _now(),
    }})
    await record(me, "content.trash", target=item_id, detail=f"Moved “{doc.get('title', '')}” to Trash", request=request)
    return {"message": "Moved to Trash"}


@router.post("/{item_id}/restore", response_model=ContentResponse, summary="Bring an item back from Trash",
    dependencies=[Depends(require_permission("content.edit"))],
)
async def restore_content(item_id: str, request: Request, me: dict = Depends(get_current_user)):
    doc = await _doc_or_404(item_id)
    if doc.get("status") != TRASH:
        raise HTTPException(status.HTTP_409_CONFLICT, "It is not in Trash")
    # Back as a draft, never straight to the public site.
    doc = await _items().find_one_and_update(
        {"_id": doc["_id"]},
        {"$set": {"status": "Draft", "s_tone": ContentItemModel.s_tone_for("Draft"),
                  "last_updated": _label(_now()), "updated_at": _now()}},
        return_document=True,
    )
    await record(me, "content.restore", target=item_id, detail=f"Restored “{doc.get('title', '')}” from Trash as a draft", request=request)
    return ContentResponse(**_row(doc))


@router.delete("/{item_id}/permanent", summary="Delete an item in Trash for good",
    dependencies=[Depends(require_permission("content.delete"))],
)
async def delete_content_permanently(item_id: str, request: Request, me: dict = Depends(get_current_user)):
    doc = await _doc_or_404(item_id)
    if doc.get("status") != TRASH:
        raise HTTPException(status.HTTP_409_CONFLICT, "Move it to Trash first")
    await _items().delete_one({"_id": doc["_id"]})
    await record(me, "content.delete", target=item_id, detail=f"Deleted “{doc.get('title', '')}” permanently", request=request)
    return {"message": "Deleted permanently"}


async def seed() -> None:
    """
    Nothing to seed. Content is what staff write; the eight invented pages by
    four invented authors, the seeded activity feed and the seeded storage
    snapshot this used to insert are no longer read by anything.
    """
    return None
