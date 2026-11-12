"""
Masters wired into Health, Support and Languages: doctor specialities and
languages, health video categories, mentor languages, feedback types (member
form and staff filter), and staff support ticket categories — each checked
against its master, matched without regard to case, and existing values kept.

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
        await db["shop_listings"].delete_many({"user_id": {"$in": uids}})
        await db["master_items"].delete_many({"label": {"$regex": "^Test "}})
        await db["doctors"].delete_many({"name": {"$regex": "^Dr Masters"}})
        await db["health_videos"].delete_many({"title": {"$regex": "^Masters video"}})
        await db["feedback"].delete_many({"text": {"$regex": "^Masters feedback"}})
        await db["support_tickets"].delete_many({"subject": {"$regex": "^Masters ticket"}})
        await db["mentors"].delete_many({"owner_id": {"$in": uids}})
        await db["shop_orders"].delete_many({"$or": [{"seller_id": {"$in": uids}}, {"buyer_id": {"$in": uids}}]})
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


async def _staff(db, made):
    doc, h = await _member(db, made, "Staff Admin")
    await db["users"].update_one({"_id": doc["_id"]}, {"$set": {"role": "Super Admin"}})
    doc["role"] = "Super Admin"
    tokens = await sessions.start(None, doc)
    return {"Authorization": f"Bearer {tokens['access_token']}"}


async def test_doctor_speciality_and_languages_come_from_masters(api):
    client, db, made = api
    sh = await _staff(db, made)
    _, h = await _member(db, made, "Asha")
    base = {"name": "Dr Masters One", "availability": []}
    bad = await client.post("/admin/doctors", json={**base, "speciality": "Astrologer"}, headers=sh)
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "not_in_master"
    bad = await client.post("/admin/doctors", json={**base, "speciality": "Gynaecologist", "languages": ["Klingon"]}, headers=sh)
    assert bad.status_code == 422
    ok = await client.post("/admin/doctors", json={**base, "speciality": "gynaecologist", "languages": ["hindi", "English"]}, headers=sh)
    assert ok.status_code == 201, ok.text
    assert ok.json()["speciality"] == "Gynaecologist" and ok.json()["languages"] == ["Hindi", "English"]
    found = (await client.get("/doctors", params={"speciality": "GYNAECOLOGIST"}, headers=h)).json()
    assert any(d["name"] == "Dr Masters One" for d in found)
    # A speciality staff add appears and is accepted; once disabled, the doctor using it can still be edited.
    add = (await client.post("/admin/masters/doctor_specialities/items", json={"label": "Test Ayurveda"}, headers=sh)).json()
    doc = (await client.post("/admin/doctors", json={**base, "name": "Dr Masters Two", "speciality": "Test Ayurveda"}, headers=sh)).json()
    await client.patch(f"/admin/masters/doctor_specialities/items/{add['key']}", json={"active": False}, headers=sh)
    edit = await client.put(f"/admin/doctors/{doc['id']}", json={**base, "name": "Dr Masters Two", "speciality": "Test Ayurveda",
                                                                 "bio": "Edited"}, headers=sh)
    assert edit.status_code == 200, edit.text
    again = await client.post("/admin/doctors", json={**base, "name": "Dr Masters Three", "speciality": "Test Ayurveda"}, headers=sh)
    assert again.status_code == 422


async def test_video_category_from_master(api):
    client, db, made = api
    sh = await _staff(db, made)
    _, h = await _member(db, made, "Asha")
    base = {"title": "Masters video one", "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "duration_sec": 120}
    assert (await client.post("/admin/health/videos", json={**base, "category": "Karaoke"}, headers=sh)).status_code == 422
    ok = await client.post("/admin/health/videos", json={**base, "category": "yoga"}, headers=sh)
    assert ok.status_code == 201 and ok.json()["category"] == "Yoga"
    shelf = (await client.get("/health/videos", params={"category": "YOGA"}, headers=h)).json()
    assert any(v["title"] == "Masters video one" for v in shelf)
    assert (await client.get("/health/videos", params={"category": "Nothing here"}, headers=h)).json() == []


async def test_mentor_languages_checked(api):
    client, db, made = api
    _, h = await _member(db, made, "Neha")
    body = {"headline": "I help women price their tailoring", "bio": "Ten years of running a tailoring shop from home in Pune.",
            "expertise": ["Pricing"], "languages": ["Klingon"]}
    bad = await client.put("/mentoring/me", json=body, headers=h)
    assert bad.status_code == 422
    ok = await client.put("/mentoring/me", json={**body, "languages": ["marathi", "Hindi"]}, headers=h)
    assert ok.status_code == 200, ok.text and ok.json()["languages"] == ["Marathi", "Hindi"]


async def test_feedback_types_member_and_staff(api):
    client, db, made = api
    sh = await _staff(db, made)
    _, h = await _member(db, made, "Kavita")
    bad = await client.post("/me/feedback", json={"text": "Masters feedback bad", "type": "Rant"}, headers=h)
    assert bad.status_code == 422
    ok = await client.post("/me/feedback", json={"text": "Masters feedback idea", "type": "an idea", "rating": 4}, headers=h)
    assert ok.status_code == 200, ok.text
    row = await db["feedback"].find_one({"text": "Masters feedback idea"})
    assert row["type"] == "An idea"
    listed = (await client.get("/feedback", params={"type": "An idea", "page_size": 100}, headers=sh)).json()["items"]
    assert any(i["text"] == "Masters feedback idea" for i in listed)
    tab = (await client.get("/feedback", params={"tab": "Suggestions", "page_size": 100}, headers=sh)).json()["items"]
    assert any(i["text"] == "Masters feedback idea" for i in tab)


async def test_support_ticket_category_from_master(api):
    client, db, made = api
    sh = await _staff(db, made)
    base = {"subject": "Masters ticket", "message": "The export button does nothing at all."}
    bad = await client.post("/staff/support", json={**base, "category": "Gossip"}, headers=sh)
    assert bad.status_code == 422
    ok = await client.post("/staff/support", json={**base, "category": "billing"}, headers=sh)
    assert ok.status_code == 201, ok.text and ok.json()["category"] == "Billing"
