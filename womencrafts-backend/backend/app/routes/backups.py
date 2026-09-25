"""
Backup and restore.

Real exports to real files. Three deliberate constraints:

  * Backups are written under PRIVATE_MEDIA_DIR, never the public media root.
    A dump contains every member's details; it must not be reachable by URL.

  * Restore is Super Admin only AND requires the caller to type the backup's
    name back. It overwrites live collections, so it needs to be hard to do by
    accident and impossible to do by misclick.

  * Identity documents and email tokens are never exported. See
    BackupModel.NEVER_INCLUDE.
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.permissions import require_permission
from app.core.rbac import require_staff, require_super_admin
from app.core.serializers import to_object_id
from app.db.mongodb import get_database
from app.models.backup import BackupModel
from app.routes.staff_account import log_activity
from app.schemas.backup import (
    BackupCreate,
    BackupItem,
    BackupSchedule,
    BackupScheduleUpdate,
    RestoreRequest,
)
from app.schemas.me import MessageResponse

router = APIRouter(prefix="/backups", tags=["Staff · Backup"])

BACKUP_ROOT = Path(settings.PRIVATE_MEDIA_DIR) / "backups"
BACKUP_ROOT.mkdir(parents=True, exist_ok=True)


def _backups():
    return get_database()[BackupModel.collection_name]


def _encode(value):
    """Make a Mongo document JSON-serialisable without losing type information."""
    if isinstance(value, ObjectId):
        return {"$oid": str(value)}
    if isinstance(value, datetime):
        return {"$date": value.isoformat()}
    if isinstance(value, dict):
        return {k: _encode(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_encode(v) for v in value]
    return value


def _decode(value):
    if isinstance(value, dict):
        if set(value.keys()) == {"$oid"}:
            return ObjectId(value["$oid"])
        if set(value.keys()) == {"$date"}:
            return datetime.fromisoformat(value["$date"])
        return {k: _decode(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_decode(v) for v in value]
    return value


@router.get("", response_model=list[BackupItem], summary="Backup history")
async def list_backups(_: dict = Depends(require_permission("settings.view"))):
    docs = await _backups().find({}).sort("created_at", -1).to_list(200)
    return [BackupModel.to_response(d) for d in docs]


@router.post(
    "",
    response_model=BackupItem,
    status_code=status.HTTP_201_CREATED,
    summary="Run a backup now",
    dependencies=[Depends(require_permission("settings.edit"))],
)
async def create_backup(body: BackupCreate, me: dict = Depends(require_staff)):
    db = get_database()
    existing = set(await db.list_collection_names())

    if body.kind == "full":
        chosen = [c for c in BackupModel.FULL_SET if c in existing]
    else:
        chosen = [
            c for c in body.collections
            if c in existing and c not in BackupModel.NEVER_INCLUDE
        ]
    if not chosen:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choose at least one collection to back up")

    doc = BackupModel.create_document(
        name=body.name.strip() or f"Backup {datetime.now(timezone.utc):%d %b %Y}",
        kind=body.kind,
        collections=chosen,
        created_by=str(me["_id"]),
        created_by_name=me.get("full_name", ""),
        note=body.note,
    )
    result = await _backups().insert_one(doc)
    doc["_id"] = result.inserted_id

    payload: dict = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "database": settings.DB_NAME,
        "collections": {},
    }
    total = 0
    try:
        for name in chosen:
            rows = await db[name].find({}).to_list(100_000)
            payload["collections"][name] = [_encode(r) for r in rows]
            total += len(rows)

        filename = f"{result.inserted_id}.json"
        path = BACKUP_ROOT / filename
        path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

        await _backups().update_one(
            {"_id": result.inserted_id},
            {"$set": {
                "status": BackupModel.STATUS_COMPLETE,
                "doc_count": total,
                "size_bytes": path.stat().st_size,
                "filename": filename,
                "finished_at": datetime.now(timezone.utc),
            }},
        )
    except Exception as exc:  # noqa: BLE001 - a failed backup must be visible, not silent
        await _backups().update_one(
            {"_id": result.inserted_id},
            {"$set": {"status": BackupModel.STATUS_FAILED, "error": str(exc)[:300],
                      "finished_at": datetime.now(timezone.utc)}},
        )

    await log_activity(
        me, "Ran a backup", "Settings", target=doc["name"],
        detail=f"{len(chosen)} collections, {total} documents",
    )
    fresh = await _backups().find_one({"_id": result.inserted_id})
    return BackupModel.to_response(fresh)


@router.get("/collections", summary="What can be backed up")
async def backup_collections(_: dict = Depends(require_permission("settings.view"))):
    db = get_database()
    existing = set(await db.list_collection_names())
    out = []
    for name in BackupModel.FULL_SET:
        if name not in existing:
            continue
        out.append({"name": name, "documents": await db[name].count_documents({})})
    return {
        "collections": out,
        "excluded": BackupModel.NEVER_INCLUDE,
        "excluded_reason": "Identity documents and sign-in tokens are never exported.",
    }


@router.get("/{backup_id}/download", summary="Download a backup")
async def download_backup(backup_id: str, me: dict = Depends(require_super_admin)):
    doc = await _backups().find_one({"_id": to_object_id(backup_id)})
    if not doc or not doc.get("filename"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That backup doesn't exist")

    path = (BACKUP_ROOT / doc["filename"]).resolve()
    # The filename comes from our own insert, but resolve-and-check anyway:
    # a path that escapes the backup root must never be served.
    if not str(path).startswith(str(BACKUP_ROOT.resolve())) or not path.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That backup file is missing")

    await log_activity(me, "Downloaded a backup", "Settings", target=doc.get("name", ""))
    safe = "".join(c for c in doc.get("name", "backup") if c.isalnum() or c in " -_").strip()
    return FileResponse(
        path,
        media_type="application/json",
        filename=f"{safe or 'backup'}.json",
        headers={"Cache-Control": "no-store"},
    )


@router.delete("/{backup_id}", response_model=MessageResponse, summary="Delete a backup")
async def delete_backup(backup_id: str, me: dict = Depends(require_super_admin)):
    doc = await _backups().find_one_and_delete({"_id": to_object_id(backup_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That backup doesn't exist")
    if doc.get("filename"):
        try:
            (BACKUP_ROOT / doc["filename"]).unlink(missing_ok=True)
        except OSError:
            pass
    await log_activity(me, "Deleted a backup", "Settings", target=doc.get("name", ""))
    return {"message": "Backup deleted"}


@router.post("/{backup_id}/restore", response_model=MessageResponse, summary="Restore from a backup")
async def restore_backup(
    backup_id: str, body: RestoreRequest, me: dict = Depends(require_super_admin)
):
    """
    Overwrites live collections with the contents of a backup.

    Requires the backup's exact name to be typed back. This is the single most
    destructive action in the platform, so it is deliberately awkward.
    """
    doc = await _backups().find_one({"_id": to_object_id(backup_id)})
    if not doc or doc.get("status") != BackupModel.STATUS_COMPLETE:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That backup isn't available to restore")
    if body.confirm.strip() != doc.get("name", ""):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Type the backup's name exactly to confirm the restore",
        )

    path = (BACKUP_ROOT / doc["filename"]).resolve()
    if not str(path).startswith(str(BACKUP_ROOT.resolve())) or not path.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That backup file is missing")

    payload = json.loads(path.read_text(encoding="utf-8"))
    db = get_database()
    restored = 0
    touched: list[str] = []

    for name, rows in (payload.get("collections") or {}).items():
        if name in BackupModel.NEVER_INCLUDE:
            continue
        if body.collections and name not in body.collections:
            continue
        decoded = [_decode(r) for r in rows]
        await db[name].delete_many({})
        if decoded:
            await db[name].insert_many(decoded)
        restored += len(decoded)
        touched.append(name)

    await log_activity(
        me, "RESTORED FROM A BACKUP", "Settings", target=doc.get("name", ""),
        detail=f"{len(touched)} collections, {restored} documents replaced",
    )
    return {
        "message": f"Restored {restored} documents across {len(touched)} collections. "
                   f"Sign out and back in to pick up any account changes."
    }


# --- schedule ----------------------------------------------------------------

SCHEDULE_KEY = "backup_schedule"


@router.get("/schedule/current", response_model=BackupSchedule, summary="Backup schedule")
async def get_schedule(_: dict = Depends(require_staff)):
    doc = await get_database()["platform_settings"].find_one({"_key": SCHEDULE_KEY})
    return BackupSchedule(
        enabled=bool((doc or {}).get("enabled", False)),
        frequency=(doc or {}).get("frequency", "Daily"),
        time=(doc or {}).get("time", "02:00"),
        keep_last=int((doc or {}).get("keep_last", 7)),
        note="Scheduled runs need a scheduler process; this stores the intent.",
    )


@router.put(
    "/schedule/current",
    response_model=BackupSchedule,
    summary="Update the backup schedule",
    dependencies=[Depends(require_permission("settings.edit"))],
)
async def set_schedule(body: BackupScheduleUpdate, me: dict = Depends(require_staff)):
    await get_database()["platform_settings"].update_one(
        {"_key": SCHEDULE_KEY},
        {"$set": {
            "_key": SCHEDULE_KEY,
            "enabled": body.enabled,
            "frequency": body.frequency,
            "time": body.time,
            "keep_last": body.keep_last,
            "updated_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    await log_activity(me, "Changed the backup schedule", "Settings",
                       detail=f"{body.frequency} at {body.time}" if body.enabled else "disabled")
    return await get_schedule(me)
