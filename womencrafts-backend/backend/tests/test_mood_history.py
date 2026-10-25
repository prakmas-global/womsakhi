"""
Mood check-ins for Mental Wellness: feelings saved with the check-in, the
history read from cycle_days (both vocabularies), taking a day back, and
another woman never seeing hers.

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
        await db["cycle_days"].delete_many({"user_id": {"$in": uids}})
        await db["preference_versions"].delete_many({"user_id": {"$in": uids}})
        await db["member_notifications"].delete_many({"user_id": {"$in": uids}})
        cache.clear()
        mongodb._client, mongodb._db = None, None


async def _member(db, made, name: str):
    now = datetime.now(timezone.utc)
    doc = {
        "full_name": name, "email": f"st-{uuid.uuid4().hex[:10]}@example.com",
        "email_verified_at": now, "role": "Member", "is_active": True, "token_version": 0,
        "verification_status": "active", "created_at": now, "updated_at": now,
    }
    doc["_id"] = (await db["users"].insert_one(doc)).inserted_id
    made["users"].append(doc["_id"])
    tokens = await sessions.start(None, doc)
    return doc, {"Authorization": f"Bearer {tokens['access_token']}"}


async def test_check_in_with_feelings_then_history_and_clear(api):
    client, db, made = api
    me, h = await _member(db, made, "Asha")
    got = await client.post("/engines/mood/check-in",
                            json={"mood": "anxious", "feelings": ["anxious", "tired", "made-up"], "note": "Exams"}, headers=h)
    assert got.status_code == 200, got.text
    hist = (await client.get("/engines/mood/history", params={"days": 30}, headers=h)).json()["days"]
    assert len(hist) == 1 and hist[0]["mood"] == "anxious" and hist[0]["feelings"] == ["anxious", "tired"]
    day = hist[0]["date"]
    # A day logged in the cycle tracker's words shows up too.
    await db["cycle_days"].insert_one({"user_id": str(me["_id"]), "date": "2000-01-01", "mood": "calm"})
    old = (await client.get("/engines/mood/history", params={"days": 366}, headers=h)).json()["days"]
    assert [d["date"] for d in old] == [day]  # older than a year: out of range
    _, other = await _member(db, made, "Bina")
    assert (await client.get("/engines/mood/history", headers=other)).json()["days"] == []
    assert (await client.delete(f"/engines/mood/{day}", headers=other)).status_code == 404
    assert (await client.delete(f"/engines/mood/{day}", headers=h)).status_code == 200
    assert (await client.get("/engines/mood/history", headers=h)).json()["days"] == []
    assert (await client.delete("/engines/mood/not-a-date", headers=h)).status_code == 422


async def test_check_in_without_feelings_keeps_earlier_ones(api):
    client, db, made = api
    _, h = await _member(db, made, "Asha")
    await client.post("/engines/mood/check-in", json={"mood": "low", "feelings": ["low"]}, headers=h)
    await client.post("/engines/mood/check-in", json={"mood": "good"}, headers=h)
    hist = (await client.get("/engines/mood/history", headers=h)).json()["days"]
    assert hist[0]["mood"] == "good" and hist[0]["feelings"] == ["low"]
