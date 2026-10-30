"""
Pregnancy and fertility on the Health store: checklists kept in settings
(validated, merged as a whole), pregnancy dates, and the pregnancy entry kinds
(symptoms, kick counts, contraction timings, antenatal visits as reminders).
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
        await db["health_entries"].delete_many({"user_id": {"$in": uids}})
        await db["health_settings"].delete_many({"user_id": {"$in": uids}})
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


from app.routes.health_hub import today_ist


async def test_checklists_save_and_validate(api):
    client, db, made = api
    _, h = await _member(db, made, "Asha")
    got = await client.put("/me/health/settings", json={"checks": {"bag": ["bag-0", "bag-1", "bag-1"], "anc": ["anc1"]}}, headers=h)
    assert got.status_code == 200, got.text
    assert got.json()["checks"] == {"bag": ["bag-0", "bag-1"], "anc": ["anc1"]}
    # Other settings are untouched by a checklist save, and the reverse.
    got = await client.put("/me/health/settings", json={"waterGoal": 9}, headers=h)
    assert got.json()["checks"]["anc"] == ["anc1"] and got.json()["waterGoal"] == 9
    for bad in ({"Bad Name": ["x"]}, {f"l{i}": [] for i in range(21)}, {"bag": [f"i{i}" for i in range(81)]}):
        assert (await client.put("/me/health/settings", json={"checks": bad}, headers=h)).status_code == 422


async def test_pregnancy_dates_and_entries(api):
    client, db, made = api
    _, h = await _member(db, made, "Aisha")
    got = await client.put("/me/health/settings", json={"pregnancy": {"basis": "lmp", "date": "2026-05-20", "hospital": "Koti Maternity Hospital"}}, headers=h)
    assert got.status_code == 200 and got.json()["pregnancy"]["hospital"] == "Koti Maternity Hospital"
    assert (await client.put("/me/health/settings", json={"pregnancy": {"basis": "later", "date": "2026-05-20"}}, headers=h)).status_code == 422
    t = today_ist()
    for kind, data in (("pregsym", {"symptoms": ["Nausea", "Back pain"], "severity": "Mild"}),
                       ("kick", {"count": 10, "seconds": 1500}),
                       ("contraction", {"lengths": [55, 62, 60], "gaps": [400, 330]}),
                       ("reminder", {"title": "Antenatal check-up", "category": "Pregnancy visit", "time": "10:00", "repeat": "Once", "where": "Koti"})):
        r = await client.post("/me/health/entries", json={"kind": kind, "data": data, "date": t}, headers=h)
        assert r.status_code == 201, (kind, r.text)
    rows = (await client.get("/me/health/entries", params={"kind": "pregsym,kick,contraction,reminder"}, headers=h)).json()
    assert {r["kind"] for r in rows} == {"pregsym", "kick", "contraction", "reminder"}
    visit = next(r for r in rows if r["kind"] == "reminder")
    done = await client.patch(f"/me/health/entries/{visit['id']}", json={"data": {"done": [t]}}, headers=h)
    assert done.status_code == 200 and done.json()["data"]["done"] == [t] and done.json()["data"]["title"] == "Antenatal check-up"
    assert (await client.post("/me/health/entries", json={"kind": "pregsym", "data": {"symptoms": []}}, headers=h)).status_code == 422
    assert (await client.put("/me/health/settings", json={"pregnancy": None}, headers=h)).json()["pregnancy"] is None
