"""
Health videos: staff add and edit them under the Content permission, members
see only active ones, links must be YouTube or a direct video file, and the
YouTube id and thumbnail are derived.

Runs against the throwaway local mongod on 127.0.0.1:27099 (skipped when it is
not running). Every row this module writes is removed afterwards.
"""

import uuid
from datetime import datetime, timedelta, timezone

import httpx
import pytest

from app.core import cache, ratelimit, sessions
from app.core.config import settings
from app.db import mongodb
from tests.conftest import LOCAL_MONGO_DB


@pytest.fixture
async def api(local_mongo, monkeypatch):
    monkeypatch.setattr(settings, "DB_NAME", LOCAL_MONGO_DB)
    monkeypatch.setattr(settings, "REDIS_URL", "")
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    mongodb._client, mongodb._db = local_mongo, None
    cache.clear()
    ratelimit._hits.clear()
    from main import app

    db = mongodb.get_database()
    made = {"users": []}
    transport = httpx.ASGITransport(app=app)
    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://test/api/v1") as client:
            yield client, db, made
    finally:
        uids = [str(u) for u in made["users"]]
        await db["users"].delete_many({"_id": {"$in": made["users"]}})
        await db[sessions.COLLECTION].delete_many({"user_id": {"$in": uids}})
        await db["health_videos"].delete_many({"title": {"$regex": "^Test video"}})
        await db["member_notifications"].delete_many({"user_id": {"$in": uids}})
        cache.clear()
        mongodb._client, mongodb._db = None, None


async def _member(db, made, name: str, role: str = "Member"):
    now = datetime.now(timezone.utc)
    doc = {
        "full_name": name, "email": f"st-{uuid.uuid4().hex[:10]}@example.com",
        "email_verified_at": now, "role": role, "is_active": True, "token_version": 0,
        "verification_status": "active", "created_at": now, "updated_at": now,
    }
    doc["_id"] = (await db["users"].insert_one(doc)).inserted_id
    made["users"].append(doc["_id"])
    tokens = await sessions.start(None, doc)
    return doc, {"Authorization": f"Bearer {tokens['access_token']}"}


from app.routes.health_videos import youtube_id

YT = "https://www.youtube.com/watch?v=abcdefghijk"


def test_youtube_ids_from_every_link_shape():
    for url in (YT, "https://youtu.be/abcdefghijk", "https://www.youtube.com/embed/abcdefghijk",
                "https://youtube.com/shorts/abcdefghijk?feature=share", "https://m.youtube.com/watch?v=abcdefghijk&t=3"):
        assert youtube_id(url) == "abcdefghijk", url
    assert youtube_id("https://vimeo.com/123") == "" and youtube_id("https://youtu.be/short") == ""


async def test_staff_manage_members_watch(api):
    client, db, made = api
    _, sh = await _member(db, made, "Content Staff", role="Super Admin")
    _, mh = await _member(db, made, "Member Woman")
    got = await client.post("/admin/health/videos", json={"title": "Test video yoga", "category": "Yoga", "url": YT,
                                                         "duration_sec": 600, "level": "Beginner"}, headers=sh)
    assert got.status_code == 201, got.text
    v = got.json()
    assert v["youtube_id"] == "abcdefghijk" and v["thumbnail"].endswith("/abcdefghijk/hqdefault.jpg")
    hidden = (await client.post("/admin/health/videos", json={"title": "Test video hidden", "category": "Sleep",
              "url": "https://cdn.example.org/a.mp4", "duration_sec": 60, "active": False}, headers=sh)).json()
    mine = [x["title"] for x in (await client.get("/health/videos", headers=mh)).json()]
    assert "Test video yoga" in mine and "Test video hidden" not in mine
    assert [x["title"] for x in (await client.get("/health/videos", params={"category": "Yoga"}, headers=mh)).json() if x["title"].startswith("Test")] == ["Test video yoga"]
    edited = await client.patch(f"/admin/health/videos/{hidden['id']}", json={"active": True}, headers=sh)
    assert edited.status_code == 200 and edited.json()["active"] is True
    assert "Test video hidden" in [x["title"] for x in (await client.get("/health/videos", headers=mh)).json()]
    assert (await client.delete(f"/admin/health/videos/{hidden['id']}", headers=sh)).status_code == 204


async def test_members_cannot_manage_and_bad_links_are_refused(api):
    client, db, made = api
    _, sh = await _member(db, made, "Content Staff", role="Super Admin")
    _, mh = await _member(db, made, "Member Woman")
    body = {"title": "Test video x", "category": "Yoga", "url": YT, "duration_sec": 60}
    assert (await client.post("/admin/health/videos", json=body, headers=mh)).status_code == 403
    for url in ("http://example.org/a.mp4", "https://example.org/page", "javascript:alert(1)"):
        assert (await client.post("/admin/health/videos", json={**body, "url": url}, headers=sh)).status_code == 422, url
