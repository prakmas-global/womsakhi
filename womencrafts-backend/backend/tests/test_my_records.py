"""
Her own small records: iron weeks, strength tests, checklists. Hers alone.

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
    from app.routes.my_records import router as records_router

    # Mounted by main.py once the parent wires it; until then, here.
    if not any(getattr(r, "path", "") == "/api/v1/me/health/strength" for r in app.routes):
        app.include_router(records_router, prefix="/api/v1")

    db = mongodb.get_database()
    made = {"users": []}
    transport = httpx.ASGITransport(app=app)
    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://test/api/v1") as client:
            yield client, db, made
    finally:
        uids = [str(u) for u in made["users"]]
        await db["users"].delete_many({"_id": {"$in": made["users"]}})
        await db["health_records"].delete_many({"user_id": {"$in": uids}})
        await db["my_checklists"].delete_many({"user_id": {"$in": uids}})
        await db[sessions.COLLECTION].delete_many({"user_id": {"$in": uids}})
        cache.clear()
        mongodb._client, mongodb._db = None, None


async def _member(db, made, name: str, status: str = "active"):
    now = datetime.now(timezone.utc)
    doc = {
        "full_name": name, "email": f"rec-{uuid.uuid4().hex[:10]}@example.com", "phone": "",
        "email_verified_at": now, "role": "Member", "is_active": True, "token_version": 0,
        "verification_status": status, "created_at": now, "updated_at": now,
    }
    doc["_id"] = (await db["users"].insert_one(doc)).inserted_id
    made["users"].append(doc["_id"])
    tokens = await sessions.start(None, doc)
    return doc, {"Authorization": f"Bearer {tokens['access_token']}"}


async def test_iron_weeks_and_strength_tests(api):
    client, db, made = api
    _, h = await _member(db, made, "Iron Woman")
    view = (await client.get("/me/health/strength", headers=h)).json()
    assert len(view["weeks"]) == 8 and not view["took_this_week"] and view["last_test"] is None

    view = (await client.post("/me/health/strength/iron", json={"took": True}, headers=h)).json()
    assert view["took_this_week"] and view["weeks"][-1]["took"] and view["weeks"][-1]["label"] == "This week"
    view = (await client.post("/me/health/strength/iron", json={"took": False}, headers=h)).json()
    assert not view["took_this_week"]

    assert (await client.post("/me/health/strength/test", json={"date": "2999-01-01", "result": "low"}, headers=h)).status_code == 422
    assert (await client.post("/me/health/strength/test", json={"date": "2026-01-10", "result": "bad"}, headers=h)).status_code == 422
    await client.post("/me/health/strength/test", json={"date": "2025-12-01", "result": "low"}, headers=h)
    view = (await client.post("/me/health/strength/test", json={"date": "2026-02-01", "result": "normal"}, headers=h)).json()
    assert view["last_test"] == {"date": "2026-02-01", "result": "normal"} and len(view["tests"]) == 2


async def test_checklists_are_hers_alone(api):
    client, db, made = api
    _, ha = await _member(db, made, "List A")
    _, hb = await _member(db, made, "List B")
    got = await client.put("/me/checklists/doctor", json={"items": ["Hot flushes at night", "  ", "Joint pain"]}, headers=ha)
    assert got.status_code == 200 and got.json()["items"] == ["Hot flushes at night", "Joint pain"]
    assert (await client.get("/me/checklists/doctor", headers=ha)).json()["items"] == ["Hot flushes at night", "Joint pain"]
    assert (await client.get("/me/checklists/doctor", headers=hb)).json()["items"] == []
    await client.put("/me/checklists/move", json={"done": ["proof", "papers"]}, headers=ha)
    assert (await client.get("/me/checklists/move", headers=ha)).json()["done"] == ["proof", "papers"]
    assert (await client.get("/me/checklists/secrets", headers=ha)).status_code == 404
    _, hp = await _member(db, made, "Pending", status="pending")
    assert (await client.get("/me/health/strength", headers=hp)).status_code == 403
