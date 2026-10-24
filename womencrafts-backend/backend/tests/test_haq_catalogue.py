"""
Haq: the scheme catalogue from the server, her state, her answers, her status.

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
    from app.routes.haq_catalogue import router as haq_catalogue_router

    if not any(getattr(r, "path", "") == "/api/v1/haq/schemes" for r in app.routes):
        app.include_router(haq_catalogue_router, prefix="/api/v1")

    db = mongodb.get_database()
    made = {"users": []}
    transport = httpx.ASGITransport(app=app)
    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://test/api/v1") as client:
            yield client, db, made
    finally:
        uids = [str(u) for u in made["users"]]
        await db["users"].delete_many({"_id": {"$in": made["users"]}})
        await db["haq_status"].delete_many({"user_id": {"$in": uids}})
        await db["reference"].delete_many({"title": {"$regex": "^Test scheme"}})
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



from app.models.reference import ReferenceModel


async def _scheme(db, title, **payload):
    doc = ReferenceModel.create_document(topic="scheme", title=title, body="Money for women", payload=payload)
    doc["_id"] = (await db["reference"].insert_one(doc)).inserted_id
    return doc


async def test_catalogue_is_filtered_by_state(api):
    client, db, made = api
    _, h = await _member(db, made, "Haq Member")
    await _scheme(db, "Test scheme all India", haq_id="test-all", state="all", eligibility=["widow"],
                  needs=["Aadhaar card", "Bank passbook"])
    await _scheme(db, "Test scheme Telangana", haq_id="test-tg", state="Telangana")
    await _scheme(db, "Test scheme Kerala", haq_id="test-kl", state="Kerala")

    got = (await client.get("/haq/schemes", params={"state": "telangana"}, headers=h)).json()
    names = [s["name"] for s in got["schemes"]]
    assert got["state"] == "Telangana"
    assert "Test scheme all India" in names and "Test scheme Telangana" in names
    assert "Test scheme Kerala" not in names
    allin = next(s for s in got["schemes"] if s["key"] == "test-all")
    assert allin["papers"] == ["aadhaar", "bank"] and allin["eligibility"] == ["widow"]
    none = [s["name"] for s in (await client.get("/haq/schemes", headers=h)).json()["schemes"]]
    assert "Test scheme Telangana" not in none and "Test scheme all India" in none

    # Drafts are not shown.
    await db["reference"].update_one({"title": "Test scheme all India"}, {"$set": {"status": "draft"}})
    names = [s["name"] for s in (await client.get("/haq/schemes", params={"state": "Telangana"}, headers=h)).json()["schemes"]]
    assert "Test scheme all India" not in names


async def test_status_defaults_to_not_checked_and_profile_is_saved(api):
    client, db, made = api
    _, h = await _member(db, made, "Haq Answers")
    got = (await client.get("/me/haq", headers=h)).json()
    assert got["default"] == "unknown" and got["profile"]["answered"] is False
    saved = (await client.put("/me/haq/profile", json={"state": "kerala", "tags": ["widow", "nonsense"]}, headers=h)).json()
    assert saved["profile"] == {"state": "Kerala", "tags": ["widow"], "answered": True}
    put = await client.put("/me/haq/test-all", json={"status": "waiting", "action": "Wait for the call"}, headers=h)
    assert put.json()["states"]["test-all"]["status"] == "waiting"
    back = await client.put("/me/haq/test-all", json={"status": "unknown"}, headers=h)
    assert "test-all" not in back.json()["states"]


async def test_claiming_count_only_shown_from_five(api):
    client, db, made = api
    _, h = await _member(db, made, "Haq Counter")
    await _scheme(db, "Test scheme counted", haq_id="test-count", state="all")
    one = (await client.get("/haq/schemes/test-count", headers=h)).json()
    assert one["name"] == "Test scheme counted" and one["claiming"] is None
    for i in range(5):
        _, hi = await _member(db, made, f"Claimer {i}")
        await client.put("/me/haq/test-count", json={"status": "receiving"}, headers=hi)
    assert (await client.get("/haq/schemes/test-count", headers=h)).json()["claiming"] == 5
    assert (await client.get("/haq/schemes/nope-404", headers=h)).status_code == 404


async def test_seed_is_idempotent(api):
    client, db, made = api
    from app.routes.haq_catalogue import seed
    await seed(); await seed()
    assert await db["reference"].count_documents({"topic": "scheme", "title": "Ladki Bahin"}) == 1
    _, h = await _member(db, made, "Seed Reader")
    mh = [s["name"] for s in (await client.get("/haq/schemes", params={"state": "Maharashtra"}, headers=h)).json()["schemes"]]
    other = [s["name"] for s in (await client.get("/haq/schemes", params={"state": "Assam"}, headers=h)).json()["schemes"]]
    assert "Ladki Bahin" in mh and "Ladki Bahin" not in other and "Widow pension" in other
