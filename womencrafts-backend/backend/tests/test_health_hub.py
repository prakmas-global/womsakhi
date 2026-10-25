"""
The Health store: entries validated per kind, her own only, ranges, merging
edits, settings merge and pregnancy clear, and the week summary.

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


async def test_log_and_read_back_by_kind_and_range(api):
    client, db, made = api
    _, h = await _member(db, made, "Asha")
    t = today_ist()
    for body in ({"kind": "water", "data": {"ml": 250}}, {"kind": "water", "data": {"ml": 500}},
                 {"kind": "workout", "data": {"activity": "Yoga", "minutes": 20, "steps": 1500}},
                 {"kind": "sleep", "data": {"bed": "22:30", "wake": "06:30", "quality": "Good"}},
                 {"kind": "allergy", "data": {"name": "Dust", "severity": "Mild"}}):
        got = await client.post("/me/health/entries", json=body, headers=h)
        assert got.status_code == 201, got.text
    water = (await client.get("/me/health/entries", params={"kind": "water"}, headers=h)).json()
    assert [w["data"]["ml"] for w in water] and all(w["date"] == t for w in water) and len(water) == 2
    both = (await client.get("/me/health/entries", params={"kind": "water,allergy", "from": t, "to": t}, headers=h)).json()
    assert {e["kind"] for e in both} == {"water", "allergy"}
    assert next(e for e in both if e["kind"] == "allergy")["date"] == ""
    week = (await client.get("/me/health/summary", params={"days": 7}, headers=h)).json()
    assert len(week) == 7 and week[-1]["date"] == t
    assert week[-1]["water_ml"] == 750 and week[-1]["active_minutes"] == 20 and week[-1]["sleep_hours"] == 8.0


async def test_bad_data_is_refused_with_a_reason(api):
    client, db, made = api
    _, h = await _member(db, made, "Asha")
    for body in ({"kind": "water", "data": {"ml": 0}}, {"kind": "nope", "data": {}},
                 {"kind": "measure", "data": {"type": "Weight", "value": "abc"}},
                 {"kind": "meal", "data": {"mealType": "Brunch", "food": "x"}},
                 {"kind": "water", "data": {"ml": 250, "extra": 1}}):
        got = await client.post("/me/health/entries", json=body, headers=h)
        assert got.status_code == 422, body
    ok = await client.post("/me/health/entries", json={"kind": "measure", "data": {"type": "Blood pressure", "value": "120/80"}}, headers=h)
    assert ok.status_code == 201


async def test_edit_merges_and_only_she_can_touch_it(api):
    client, db, made = api
    _, h = await _member(db, made, "Asha")
    _, other = await _member(db, made, "Bina")
    med = (await client.post("/me/health/entries", json={"kind": "medication", "data": {"name": "Iron", "dose": "1 tablet"}}, headers=h)).json()
    got = await client.patch(f"/me/health/entries/{med['id']}", json={"data": {"status": "Stopped"}}, headers=h)
    assert got.status_code == 200 and got.json()["data"] == {**med["data"], "status": "Stopped"}
    assert (await client.patch(f"/me/health/entries/{med['id']}", json={"data": {"status": "x"}}, headers=other)).status_code == 404
    assert (await client.delete(f"/me/health/entries/{med['id']}", headers=other)).status_code == 404
    assert (await client.get("/me/health/entries", params={"kind": "medication"}, headers=other)).json() == []
    assert (await client.delete(f"/me/health/entries/{med['id']}", headers=h)).status_code == 204


async def test_settings_merge_and_pregnancy_clear(api):
    client, db, made = api
    _, h = await _member(db, made, "Asha")
    assert (await client.get("/me/health/settings", headers=h)).json()["waterGoal"] == 8
    got = await client.put("/me/health/settings", json={"waterGoal": 10, "pregnancy": {"basis": "lmp", "date": "2026-06-01"}}, headers=h)
    assert got.status_code == 200 and got.json()["pregnancy"]["date"] == "2026-06-01"
    got = await client.put("/me/health/settings", json={"diet": "Vegan"}, headers=h)
    assert got.json()["waterGoal"] == 10 and got.json()["diet"] == "Vegan" and got.json()["pregnancy"]
    got = await client.put("/me/health/settings", json={"pregnancy": None}, headers=h)
    assert got.json()["pregnancy"] is None
    assert (await client.put("/me/health/settings", json={"diet": "Pizza"}, headers=h)).status_code == 422


async def test_onboarding_settings_export_and_delete_all(api):
    client, db, made = api
    _, h = await _member(db, made, "Asha")
    _, h2 = await _member(db, made, "Bina")
    got = await client.put("/me/health/settings", headers=h, json={
        "onboarded": True, "dob": "1994-05-02", "goals": ["Sleep better", "Sleep better", "Eat better"],
        "exercise": ["Yoga"], "restrictions": ["No onion or garlic"], "trackPreg": False})
    assert got.status_code == 200, got.text
    s = got.json()
    assert s["onboarded"] is True and s["goals"] == ["Sleep better", "Eat better"] and s["trackPreg"] is False and s["trackCycle"] is True
    assert (await client.put("/me/health/settings", headers=h, json={"dob": "May 1994"})).status_code == 422

    today = (await client.get("/me/health/summary", params={"days": 1}, headers=h)).json()[0]["date"]
    for body in ({"kind": "water", "date": today, "data": {"ml": 250}},
                 {"kind": "reminder", "date": today, "data": {"title": "Iron", "category": "Medicine", "time": "21:00", "repeat": "Every day"}}):
        assert (await client.post("/me/health/entries", headers=h, json=body)).status_code == 201
    await client.post("/me/health/entries", headers=h2, json={"kind": "water", "date": today, "data": {"ml": 500}})

    out = (await client.get("/me/health/export", headers=h)).json()
    assert {e["kind"] for e in out["entries"]} == {"water", "reminder"} and out["settings"]["dob"] == "1994-05-02"
    assert all(e["data"].get("ml") != 500 for e in out["entries"])  # never someone else's

    assert (await client.delete("/me/health", headers=h)).status_code == 204
    assert (await client.get("/me/health/entries", params={"kind": "water"}, headers=h)).json() == []
    assert (await client.get("/me/health/settings", headers=h)).json()["onboarded"] is False
    # Hers only: Bina's water is still there.
    assert len((await client.get("/me/health/entries", params={"kind": "water"}, headers=h2)).json()) == 1
