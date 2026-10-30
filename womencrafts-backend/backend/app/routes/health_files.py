"""
Her health papers — a lab report, a prescription, a scan — kept privately.

`/uploads` writes to the public media folder, which is right for a shop photo
and wrong for a thyroid report. These go where identity documents go: the
private store (`save_document_file` in routes/verification.py — one folder per
account, encrypted at rest when a key is configured), and only she can read
them back. A Health Records "document" entry (routes/health_hub.py) points at
one of these by `file_id`.

Nothing here is readable by staff or anyone else; there is no staff route.
"""

from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from pydantic import BaseModel

from app.core import docvault
from app.core.rbac import require_active_member
from app.db.mongodb import get_database
from app.routes.verification import PRIVATE_ROOT, save_document_file

router = APIRouter(prefix="/me/health/files", tags=["Member · Health"])

FILES = "health_files"
#: Papers a member may keep. Generous for a lifetime of reports, small enough
#: that the private store cannot be filled by one account.
MAX_FILES = 300


def _db():
    return get_database()


class HealthFile(BaseModel):
    id: str
    name: str
    content_type: str
    size: int
    created_at: str


def _out(doc: dict) -> HealthFile:
    created = doc.get("created_at")
    return HealthFile(id=str(doc["_id"]), name=doc.get("original_name", ""), content_type=doc.get("content_type", ""),
                      size=int(doc.get("size", 0) or 0),
                      created_at=created.isoformat() if isinstance(created, datetime) else "")


async def _own(file_id: str, uid: str) -> dict:
    if not ObjectId.is_valid(file_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    doc = await _db()[FILES].find_one({"_id": ObjectId(file_id), "user_id": uid})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    return doc


@router.post("", response_model=HealthFile, status_code=status.HTTP_201_CREATED, summary="Keep a health paper privately")
async def upload(file: UploadFile = File(..., description="Photo or PDF"), me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    if await _db()[FILES].count_documents({"user_id": uid}) >= MAX_FILES:
        raise HTTPException(status.HTTP_409_CONFLICT, "You have kept a lot of papers. Delete an old one first.")
    stored_name, _ext, size = await save_document_file(file, me)
    doc = {"user_id": uid, "stored_name": stored_name, "original_name": (file.filename or "document")[:120],
           "content_type": file.content_type or "", "size": size, "created_at": datetime.now(timezone.utc)}
    doc["_id"] = (await _db()[FILES].insert_one(doc)).inserted_id
    return _out(doc)


@router.get("/{file_id}", summary="Open one of my health papers")
async def read(file_id: str, me: dict = Depends(require_active_member)):
    doc = await _own(file_id, str(me["_id"]))
    target = (PRIVATE_ROOT / doc["stored_name"]).resolve()
    if PRIVATE_ROOT.resolve() not in target.parents or not target.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That file is missing")
    try:
        payload = docvault.read_file(target)
    except docvault.VaultUnavailable as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, str(exc))
    return Response(content=payload, media_type=doc.get("content_type") or "application/octet-stream",
                    headers={"Content-Disposition": "inline", "Cache-Control": "no-store, private"})


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete one of my health papers")
async def delete(file_id: str, me: dict = Depends(require_active_member)):
    doc = await _own(file_id, str(me["_id"]))
    target = (PRIVATE_ROOT / doc["stored_name"]).resolve()
    if PRIVATE_ROOT.resolve() in target.parents:
        target.unlink(missing_ok=True)
    await _db()[FILES].delete_one({"_id": doc["_id"]})
