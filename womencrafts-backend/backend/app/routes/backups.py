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

── Rows that point at nothing ─────────────────────────────────────────────
The collection was seeded with five "daily-2026MMDD" rows whose filenames
(`womsakhi-20260725.archive.gz` …) never existed on any disk. Every row now
carries `file_present`, checked against the backup directory when it is
listed, and the screen says which ones are records without a file. A backup
you cannot download is not a backup, and the count on the screen only counts
the ones on disk.

── The schedule is a preference, not a job ────────────────────────────────
There is no scheduler process. `PUT /backups/schedule/current` stores what
the organisation wants; nothing reads it back at 02:00. The summary says
`runs_automatically: false` so the screen cannot imply otherwise.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse

from app.core.audit import record
from app.core.config import settings
from app.core.permissions import require_permission
from app.core.rbac import require_staff, require_super_admin
from app.core.serializers import to_object_id
from app.db.mongodb import get_database
from app.models.backup import BackupModel
from app.schemas.backup import BackupCreate, BackupSchedule, BackupScheduleUpdate, RestoreRequest
from app.schemas.me import MessageResponse
from app.schemas.settings_platform_admin import BackupRow, BackupSummary

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


def _file_for(doc: dict) -> Path | None:
    """The file a row points at, or None when it is outside the backup root
    or absent. Resolve-and-check even though we wrote the name ourselves."""
    name = doc.get("filename")
    if not name:
        return None
    path = (BACKUP_ROOT / name).resolve()
    if not str(path).startswith(str(BACKUP_ROOT.resolve())) or not path.is_file():
        return None
    return path


def _row(doc: dict) -> BackupRow:
    base = BackupModel.to_response(doc)
    present = _file_for(doc) is not None
    note = ""
    if not present:
        if doc.get("status") == BackupModel.STATUS_FAILED:
            note = "This run failed; there is no file."
        elif doc.get("filename"):
            note = "The file this record points at is not on this server."
        else:
            note = "No file was written."
    base["downloadable"] = present and doc.get("status") == BackupModel.STATUS_COMPLETE
    return BackupRow(file_present=present, file_note=note, **base)


@router.get("", response_model=list[BackupRow], summary="Backup history")
async def list_backups(_: dict = Depends(require_permission("settings.view"))):
    docs = await _backups().find({}).sort("created_at", -1).to_list(200)
    return [_row(d) for d in docs]


@router.get("/summary", response_model=BackupSummary, summary="What is on disk, and what is only a preference")
async def backup_summary(_: dict = Depends(require_permission("settings.view"))):
    docs = await _backups().find({}).sort("created_at", -1).to_list(500)
    on_disk = [d for d in docs if _file_for(d) is not None]
    storage = 0
    for d in on_disk:
        path = _file_for(d)
        try:
            storage += path.stat().st_size if path else 0
        except OSError:
            continue
    last = on_disk[0] if on_disk else None
    sched = await get_database()["platform_settings"].find_one({"_key": SCHEDULE_KEY}) or {}
    enabled = bool(sched.get("enabled", False))
    freq, at = sched.get("frequency", "Daily"), sched.get("time", "02:00")
    return BackupSummary(
        on_disk=len(on_disk),
        records=len(docs),
        missing_files=len(docs) - len(on_disk),
        last_backup_at=last["created_at"].isoformat() if last and isinstance(last.get("created_at"), datetime) else "",
        last_backup_name=last.get("name", "") if last else "",
        storage_bytes=storage,
        storage_label=BackupModel.human_size(storage),
        location=f"This server, under {settings.PRIVATE_MEDIA_DIR}/backups — never a public URL.",
        schedule_enabled=enabled,
        schedule_label=(f"{freq} at {at}" if enabled else "Off"),
        runs_automatically=False,
    )


@router.post(
    "",
    response_model=BackupRow,
    status_code=status.HTTP_201_CREATED,
    summary="Run a backup now",
    dependencies=[Depends(require_permission("settings.edit"))],
)
async def create_backup(body: BackupCreate, request: Request, me: dict = Depends(require_staff)):
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
        name=body.name.strip() or f"Backup {datetime.now(timezone.utc):%d %b %Y %H:%M}",
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
    failure = ""
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
        failure = str(exc)[:300]
        await _backups().update_one(
            {"_id": result.inserted_id},
            {"$set": {"status": BackupModel.STATUS_FAILED, "error": failure,
                      "finished_at": datetime.now(timezone.utc)}},
        )

    await record(
        me, "settings.backup.run", target=str(result.inserted_id),
        detail=(f"Backup '{doc['name']}' FAILED: {failure}" if failure
                else f"Ran backup '{doc['name']}': {len(chosen)} collections, {total} documents"),
        request=request,
    )
    fresh = await _backups().find_one({"_id": result.inserted_id})
    return _row(fresh)


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
async def download_backup(backup_id: str, request: Request, me: dict = Depends(require_super_admin)):
    doc = await _backups().find_one({"_id": to_object_id(backup_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That backup doesn't exist")
    path = _file_for(doc)
    if path is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That backup's file is not on this server")

    await record(
        me, "settings.backup.download", target=str(doc["_id"]),
        detail=f"Downloaded backup '{doc.get('name', '')}' ({BackupModel.human_size(doc.get('size_bytes', 0))})",
        request=request,
    )
    safe = "".join(c for c in doc.get("name", "backup") if c.isalnum() or c in " -_").strip()
    return FileResponse(
        path,
        media_type="application/json",
        filename=f"{safe or 'backup'}.json",
        headers={"Cache-Control": "no-store"},
    )


@router.delete("/{backup_id}", response_model=MessageResponse, summary="Delete a backup")
async def delete_backup(backup_id: str, request: Request, me: dict = Depends(require_super_admin)):
    doc = await _backups().find_one_and_delete({"_id": to_object_id(backup_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That backup doesn't exist")
    had_file = False
    path = _file_for(doc)
    if path is not None:
        try:
            path.unlink(missing_ok=True)
            had_file = True
        except OSError:
            pass
    await record(
        me, "settings.backup.delete", target=str(doc["_id"]),
        detail=f"Deleted backup '{doc.get('name', '')}'" + ("" if had_file else " (record only; no file was on disk)"),
        request=request,
    )
    return {"message": "Backup deleted"}


@router.post("/{backup_id}/restore", response_model=MessageResponse, summary="Restore from a backup")
async def restore_backup(
    backup_id: str, body: RestoreRequest, request: Request, me: dict = Depends(require_super_admin)
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
    path = _file_for(doc)
    if path is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That backup's file is not on this server")

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

    await record(
        me, "settings.backup.restore", target=str(doc["_id"]),
        detail=f"RESTORED from backup '{doc.get('name', '')}': {len(touched)} collections, {restored} documents replaced",
        request=request,
    )
    return {
        "message": f"Restored {restored} documents across {len(touched)} collections. "
                   f"Sign out and back in to pick up any account changes."
    }


# --- schedule ----------------------------------------------------------------

SCHEDULE_KEY = "backup_schedule"

_SCHEDULE_NOTE = (
    "A stored preference. No scheduler process runs on this installation, so nothing "
    "happens at this time by itself — backups run when someone presses Back up now."
)


@router.get("/schedule/current", response_model=BackupSchedule, summary="Backup schedule")
async def get_schedule(_: dict = Depends(require_staff)):
    doc = await get_database()["platform_settings"].find_one({"_key": SCHEDULE_KEY})
    return BackupSchedule(
        enabled=bool((doc or {}).get("enabled", False)),
        frequency=(doc or {}).get("frequency", "Daily"),
        time=(doc or {}).get("time", "02:00"),
        keep_last=int((doc or {}).get("keep_last", 7)),
        note=_SCHEDULE_NOTE,
    )


@router.put(
    "/schedule/current",
    response_model=BackupSchedule,
    summary="Update the backup schedule",
    dependencies=[Depends(require_permission("settings.edit"))],
)
async def set_schedule(body: BackupScheduleUpdate, request: Request, me: dict = Depends(require_staff)):
    await get_database()["platform_settings"].update_one(
        {"_key": SCHEDULE_KEY},
        {"$set": {
            "_key": SCHEDULE_KEY,
            "enabled": body.enabled,
            "frequency": body.frequency,
            "time": body.time,
            "keep_last": body.keep_last,
            "updated_at": datetime.now(timezone.utc),
            "updated_by": str(me["_id"]),
        }},
        upsert=True,
    )
    await record(
        me, "settings.backup.schedule", target=SCHEDULE_KEY,
        detail=(f"Set the backup preference to {body.frequency} at {body.time}, keep last {body.keep_last}"
                if body.enabled else "Turned the backup preference off"),
        request=request,
    )
    return await get_schedule(me)
