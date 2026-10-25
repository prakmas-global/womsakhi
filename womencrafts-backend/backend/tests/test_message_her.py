"""
Message her — starting a thread with one member.

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



async def test_message_her_starts_and_continues_one_thread(api):
    client, db, made = api
    a, ha = await _member(db, made, "Anita Asker")
    b, hb = await _member(db, made, "Bina Answer")
    _, hp = await _member(db, made, "Pending Person", status="pending")

    got = await client.post("/me/conversations/start", json={"user_id": str(b["_id"]), "text": "Hello! Is the uniform still there?", "about": "Swap: school uniform"}, headers=ha)
    assert got.status_code == 201, got.text
    conv = got.json()
    assert conv["kind"] == "member" and conv["subtitle"] == "Swap: school uniform"
    again = await client.post("/me/conversations/start", json={"user_id": str(b["_id"]), "text": "I can collect it Sunday"}, headers=ha)
    assert again.json()["id"] == conv["id"] and len(again.json()["messages"]) == 2

    theirs = [c for c in (await client.get("/me/conversations", headers=hb)).json() if c["kind"] == "member"]
    assert len(theirs) == 1 and theirs[0]["unread"] == 2
    reply = await client.post(f"/me/conversations/{theirs[0]['id']}/messages", json={"text": "Yes, come Sunday"}, headers=hb)
    assert reply.status_code == 200
    mine = (await client.get(f"/me/conversations/{conv['id']}", headers=ha)).json()
    assert mine["messages"][-1]["text"] == "Yes, come Sunday" and mine["messages"][-1]["dir"] == "in"

    assert (await client.post("/me/conversations/start", json={"user_id": str(a["_id"]), "text": "me"}, headers=ha)).status_code == 400
    assert (await client.post("/me/conversations/start", json={"user_id": str(b["_id"]), "text": "hi there"}, headers=hp)).status_code == 403
    pending_target = (await db["users"].find_one({"full_name": "Pending Person"}))["_id"]
    assert (await client.post("/me/conversations/start", json={"user_id": str(pending_target), "text": "hi there"}, headers=ha)).status_code == 404

    await db["member_conversations"].update_many({"member_id": str(a["_id"])}, {"$set": {"closed": True}})
    assert (await client.post("/me/conversations/start", json={"user_id": str(b["_id"]), "text": "still there?"}, headers=ha)).status_code == 403
