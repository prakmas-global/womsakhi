"""Exercise real backup/restore and file recovery only in a fresh local throwaway DB."""
import hashlib
import shutil
import uuid
from datetime import datetime, timezone

import pytest
from bson import ObjectId
from fastapi import HTTPException

from app.core.config import settings
from app.db import mongodb
from app.models.backup import BackupModel
from app.routes import backups
from app.schemas.backup import BackupCreate, RestoreRequest


async def test_core_journeys_survive_database_and_media_restore(local_mongo, monkeypatch, tmp_path):
    database_name = f"womsakhi_recovery_drill_{uuid.uuid4().hex}"
    assert database_name.startswith("womsakhi_recovery_drill_")
    monkeypatch.setattr(settings, "DB_NAME", database_name)
    monkeypatch.setattr(backups, "BACKUP_ROOT", tmp_path / "backups")
    backups.BACKUP_ROOT.mkdir()
    mongodb._client, mongodb._db = local_mongo, None
    db = mongodb.get_database()
    actor = {"_id": ObjectId(), "full_name": "Local Recovery Operator", "role": "Super Admin"}
    user_id = str(ObjectId())
    originals = {
        "users": {"_id": ObjectId(user_id), "store": {"name": "Recovery shop", "category_key": "crafts", "cover": "media/cover/sample.webp", "gallery": ["media/cover/sample.webp"]}},
        "enrollments": {"_id": ObjectId(), "user_id": user_id, "status": "active", "progress": 50, "completed_lessons": [1], "updated_at": datetime.now(timezone.utc)},
        "shop_listings": {"_id": ObjectId(), "user_id": user_id, "title": "Recovery sample", "status": "live", "photo": "media/cover/sample.webp"},
        "work_profiles": {"_id": ObjectId(), "user_id": user_id, "skills": [{"key": "tailoring", "visible": False}]},
        "applications": {"_id": ObjectId(), "user_id": user_id, "status": "applied"},
    }
    try:
        assert set(originals) <= set(BackupModel.FULL_SET)
        for name, row in originals.items():
            await db[name].insert_one(dict(row))
            originals[name] = await db[name].find_one({"_id": row["_id"]})
        # Private/object files require a separate backup. Test byte integrity too.
        live_media = tmp_path / "media"
        (live_media / "media/cover").mkdir(parents=True)
        (live_media / "private_media").mkdir()
        (live_media / "media/cover/sample.webp").write_bytes(b"public-test-photo")
        (live_media / "private_media/encrypted-record.bin").write_bytes(b"opaque-encrypted-test-record")
        file_hashes = {str(p.relative_to(live_media)): hashlib.sha256(p.read_bytes()).hexdigest() for p in live_media.rglob("*") if p.is_file()}
        shutil.copytree(live_media, tmp_path / "media-snapshot")
        backup = await backups.create_backup(BackupCreate(name="Local recovery drill", kind="full"), None, actor)
        assert backup.status == BackupModel.STATUS_COMPLETE, backup
        backup_file = backups.BACKUP_ROOT / f"{backup.id}.json"
        assert backup_file.is_file()
        # Confirmation must reject before any data is touched.
        with pytest.raises(HTTPException) as refusal:
            await backups.restore_backup(backup.id, RestoreRequest(confirm="wrong"), None, actor)
        assert refusal.value.status_code == 400
        for name, row in originals.items():
            assert await db[name].find_one({"_id": row["_id"]}) == row
        for name in originals:
            await db[name].delete_many({})
        shutil.rmtree(live_media)
        await backups.restore_backup(backup.id, RestoreRequest(confirm="Local recovery drill"), None, actor)
        shutil.copytree(tmp_path / "media-snapshot", live_media)
        for name, row in originals.items():
            assert await db[name].find_one({"_id": row["_id"]}) == row
        assert {str(p.relative_to(live_media)): hashlib.sha256(p.read_bytes()).hexdigest() for p in live_media.rglob("*") if p.is_file()} == file_hashes
    finally:
        await local_mongo.drop_database(database_name)
        mongodb._client, mongodb._db = None, None
