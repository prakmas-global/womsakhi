"""
Group buy "Tell me next time": a watcher row, notified once when staff open
the next round of the same item.

Work by skill: the masters, her opt-in profile, "Find people", and the chat
that follows — including the parts that protect her (hidden skills stay
hidden, the number is hers to share, "not interested" is final).

Runs against the throwaway local mongod on 127.0.0.1:27099 (skipped when it is
not running). Every row this module writes is removed afterwards.
"""

import uuid
from datetime import datetime, timezone

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
        await db["group_buys"].delete_many({"item": {"$regex": "^Test thread"}})
        await db["group_buy_watchers"].delete_many({"user_id": {"$in": uids}})
        await db["work_profiles"].delete_many({"user_id": {"$in": uids}})
        await db["member_conversations"].delete_many({"member_id": {"$in": uids}})
        await db["member_notifications"].delete_many({"user_id": {"$in": uids}})
        await db[sessions.COLLECTION].delete_many({"user_id": {"$in": uids}})
        await db["work_skills"].delete_many({"name": {"$regex": "^Test skill"}})
        await db["opportunities"].delete_many({"$or": [{"owner_id": {"$in": uids}}, {"title": {"$regex": "^Test job"}}]})
        await db["applications"].delete_many({"user_id": {"$in": uids}})
        await db["onboarding_profiles"].delete_many({"user_id": {"$in": uids}})
        await db["work_categories"].delete_many({"name": {"$regex": "^Test category"}})
        cache.clear()
        mongodb._client, mongodb._db = None, None


async def _member(db, made, name: str, *, phone: str = "", status: str = "active", role: str = "Member"):
    now = datetime.now(timezone.utc)
    doc = {
        "full_name": name, "email": f"work-{uuid.uuid4().hex[:10]}@example.com", "phone": phone,
        "email_verified_at": now, "role": role, "is_active": True, "token_version": 0,
        "verification_status": status, "created_at": now, "updated_at": now,
    }
    doc["_id"] = (await db["users"].insert_one(doc)).inserted_id
    made["users"].append(doc["_id"])
    tokens = await sessions.start(None, doc)
    return doc, {"Authorization": f"Bearer {tokens['access_token']}"}



from datetime import timedelta  # noqa: E402


async def test_tell_me_next_time_is_saved_and_fires_once(api):
    client, db, made = api
    m, hm = await _member(db, made, "Gita Buyer")
    _, hs = await _member(db, made, "Staff Opener", role="Super Admin")
    closes = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    first = await client.post("/admin/market/group-buys", json={
        "item": "Test thread reels", "unit": "per box", "alone_minor": 9000, "together_minor": 6000,
        "needed": 1, "closes_at": closes}, headers=hs)
    assert first.status_code == 201, first.text
    buy_id = first.json()["id"]

    got = await client.post(f"/group-buy/{buy_id}/notify-me", headers=hm)
    assert got.status_code == 200 and got.json()["watching"] is True
    listed = [b for b in (await client.get("/group-buy", headers=hm)).json() if b["id"] == buy_id]
    assert listed and listed[0]["watching"] is True

    again = await client.post("/admin/market/group-buys", json={
        "item": "test THREAD  reels", "unit": "per box", "alone_minor": 9000, "together_minor": 6000,
        "needed": 5, "closes_at": closes}, headers=hs)
    assert again.status_code == 201
    told = await db["member_notifications"].count_documents({"user_id": str(m["_id"]), "title": {"$regex": "open again"}})
    assert told == 1
    assert await db["group_buy_watchers"].count_documents({"user_id": str(m["_id"])}) == 0   # once, then cleared

    await client.post(f"/group-buy/{buy_id}/notify-me", headers=hm)
    assert (await client.delete(f"/group-buy/{buy_id}/notify-me", headers=hm)).status_code == 204
    assert await db["group_buy_watchers"].count_documents({"user_id": str(m["_id"])}) == 0
