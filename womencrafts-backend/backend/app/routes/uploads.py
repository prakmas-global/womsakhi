"""
File uploads.

The admin picks an image, we check it's really an image and not too big, write
it to `media/<kind>/<random>.<ext>` on disk, and hand back a URL. Any screen can
then store that URL on its own record (a member's avatar, a content cover, …).

What is STORED is the relative path; the absolute URL is built on the way out.
app/core/media.py has the whole story.
"""

import re
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status

from app.core import mongosafe
from app.core.audit import record
from app.core.config import settings
from app.core.deps import get_current_user
from app.core.rbac import SUPER_ADMIN
from app.core.serializers import page_meta, to_object_id
from app.db.mongodb import get_database
from app.models.upload import UploadModel
from app.routes._paging import paged
from app.schemas.upload import (
    DeleteResponse,
    UploadListResponse,
    UploadResponse,
    UploadStatsResponse,
)

router = APIRouter(prefix="/uploads", tags=["Uploads"])

# Where the bytes live. Created on first import so the static mount always works.
MEDIA_ROOT = Path(settings.MEDIA_DIR)
if not MEDIA_ROOT.is_absolute():
    MEDIA_ROOT = Path(__file__).resolve().parents[2] / settings.MEDIA_DIR
MEDIA_ROOT.mkdir(parents=True, exist_ok=True)

# Read the incoming file in chunks so a huge upload never lands in memory.
CHUNK = 1024 * 1024


def _uploads():
    return get_database()[UploadModel.collection_name]


def _ownership_scope(user: dict) -> dict:
    # Missing roles must not inherit the legacy administrative default here.
    return {} if user.get("role") == SUPER_ADMIN else {"uploaded_by": str(user["_id"])}


def _safe_stem(name: str) -> str:
    """Keep a readable slice of the original filename in the stored name."""
    stem = Path(name or "").stem[:40]
    stem = re.sub(r"[^a-zA-Z0-9._-]+", "-", stem).strip("-.")
    return stem.lower() or "image"


@router.post(
    "",
    response_model=UploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload an image",
)
async def upload_file(
    file: UploadFile = File(..., description="The image to upload"),
    kind: str = Form("attachment", description="avatar | cover | attachment"),
    current_user: dict = Depends(get_current_user),
):
    extension = UploadModel.extension_for(file.content_type or "")
    if not extension:
        allowed = ", ".join(sorted(UploadModel.ALLOWED_TYPES))
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            f"'{file.content_type}' isn't a supported image. Allowed: {allowed}",
        )

    kind = kind if kind in UploadModel.KINDS else "attachment"
    folder = MEDIA_ROOT / kind
    folder.mkdir(parents=True, exist_ok=True)

    stored_name = f"{_safe_stem(file.filename)}-{uuid.uuid4().hex[:10]}{extension}"
    destination = folder / stored_name

    # Stream to disk, stopping the moment the file goes over the size limit.
    limit = settings.MAX_UPLOAD_MB * 1024 * 1024
    size = 0
    try:
        with destination.open("wb") as out:
            while chunk := await file.read(CHUNK):
                size += len(chunk)
                if size > limit:
                    out.close()
                    destination.unlink(missing_ok=True)
                    raise HTTPException(
                        status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        f"That image is larger than the {settings.MAX_UPLOAD_MB} MB limit.",
                    )
                out.write(chunk)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 - disk problems shouldn't 500 silently
        destination.unlink(missing_ok=True)
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Could not save the file: {exc}")

    document = UploadModel.create_document(
        original_name=file.filename or stored_name,
        stored_name=f"{kind}/{stored_name}",
        # A PATH, not a URL. The host is added by UploadModel.to_response from
        # whatever MEDIA_BASE_URL this process runs with — baking it in here is
        # what put `http://localhost:8020` into production. See app/core/media.py.
        url=f"media/{kind}/{stored_name}",
        content_type=file.content_type or "",
        size=size,
        kind=kind,
        uploaded_by=str(current_user["_id"]),
        uploaded_by_name=current_user.get("full_name", ""),
    )
    result = await _uploads().insert_one(document)
    saved = await _uploads().find_one({"_id": result.inserted_id})
    return UploadResponse(**UploadModel.to_response(saved))


@router.get("", response_model=UploadListResponse, summary="List uploaded files")
async def list_uploads(
    kind: Optional[str] = Query(None, description="Filter by avatar | cover | attachment"),
    q: Optional[str] = Query(None, description="Search the original file name"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
):
    query: dict = _ownership_scope(current_user)
    if kind and kind in UploadModel.KINDS:
        query["kind"] = kind
    if q and q.strip():
        query["original_name"] = mongosafe.contains(q)

    total, docs = await paged(
        _uploads(), query,
        sort="created_at", direction=-1, page=page, page_size=page_size,
    )
    items = [UploadModel.to_response(doc) for doc in docs]
    return UploadListResponse(items=items, **page_meta(total, page, page_size))


@router.get("/stats", response_model=UploadStatsResponse, summary="Media library totals")
async def upload_stats(current_user: dict = Depends(get_current_user)):
    total = 0
    total_bytes = 0
    by_kind = {k: 0 for k in UploadModel.KINDS}
    async for doc in _uploads().find(_ownership_scope(current_user), {"size": 1, "kind": 1}):
        total += 1
        total_bytes += doc.get("size", 0)
        by_kind[doc.get("kind", "attachment")] = by_kind.get(doc.get("kind", "attachment"), 0) + 1
    return UploadStatsResponse(
        total=total,
        total_bytes=total_bytes,
        total_label=UploadModel.size_label(total_bytes),
        by_kind=by_kind,
    )


@router.delete("/{upload_id}", response_model=DeleteResponse, summary="Delete an uploaded file")
async def delete_upload(
    upload_id: str,
    current_user: dict = Depends(get_current_user),
    request: Request = None,  # type: ignore[assignment]
):
    query = {"_id": to_object_id(upload_id), **_ownership_scope(current_user)}
    doc = await _uploads().find_one(query)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found")

    # Never leave a broken image behind. These are the fields that can hold an
    # upload URL in the current data model; array fields use the same equality
    # predicate in MongoDB.
    url = doc.get("url", "")
    references = (
        ("content_items", "cover"), ("members", "avatar"), ("users", "avatar"),
        ("circles", "cover"), ("circles", "icon"), ("circle_posts", "image"),
        ("stories", "cover"), ("events", "cover"), ("opportunities", "cover"),
        ("shop_listings", "photo"), ("shop_listings", "photos"),
    )
    used_by = 0
    db = get_database()
    for collection, field in references:
        used_by += await db[collection].count_documents({field: url}, limit=1)
    if used_by:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This file is still used by an app record. Replace it there before removing it from the library.",
        )

    # Remove the bytes too, but never let a missing file block the delete.
    stored = (doc.get("stored_name") or "").lstrip("/")
    target = (MEDIA_ROOT / stored).resolve()
    if stored and target.is_file() and MEDIA_ROOT.resolve() in target.parents:
        target.unlink(missing_ok=True)

    await _uploads().delete_one(query)
    await record(current_user, "media.delete", target=upload_id,
                 detail=f"Deleted media file '{doc.get('original_name', '')}'", request=request)
    return DeleteResponse(message="File deleted")
