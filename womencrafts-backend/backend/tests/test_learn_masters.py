"""
Learn masters: course categories, mentor topics and skill swap tags are checked
on the server against the staff-controlled lists, and onboarding offers and
accepts skills from the Work skills master (including one staff just added).

Runs against the throwaway local mongod on 127.0.0.1:27099 (skipped when it is
not running). Every row this module writes is removed afterwards.
"""

import uuid
from datetime import datetime, timedelta, timezone

import httpx
from bson import ObjectId
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
        await db["programs"].delete_many({"name": {"$regex": "^Learn masters test"}})
        await db["mentors"].delete_many({"owner_id": {"$in": uids}})
        await db["skill_swaps"].delete_many({"user_id": {"$in": uids}})
        await db["work_skills"].delete_many({"name": {"$regex": "^Test skill"}})
        await db["onboarding_profiles"].delete_many({"user_id": {"$in": uids}})
        await db["events"].delete_many({"title": {"$regex": "^Masters test"}})
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


from app.core import skill_master


def _course(category: str) -> dict:
    return {"name": "Learn masters test course", "desc": "A test course with enough words in it to pass.",
            "category": category, "lessons": [{"title": "First lesson"}]}


async def test_course_categories_are_checked_on_the_server(api):
    client, db, made = api
    _, h = await _member(db, made, "Asha Teacher")
    ok = await client.post("/teach/courses", json=_course("handicrafts"), headers=h)
    assert ok.status_code == 201, ok.text
    assert ok.json()["category"] == "Handicrafts"  # spelled as the master spells it
    bad = await client.post("/teach/courses", json=_course("Spaceships"), headers=h)
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "not_in_master"
    # A learning path is a group, not a category a course can sit in.
    path = await client.post("/teach/courses", json=_course("Career & Jobs"), headers=h)
    assert path.status_code == 422
    sh = await _staff(db, made)
    no = await client.post("/programs", json={"name": "Learn masters test admin", "category": "Spaceships"}, headers=sh)
    assert no.status_code == 422
    yes = await client.post("/programs", json={"name": "Learn masters test admin", "category": "Money & Savings"}, headers=sh)
    assert yes.status_code == 201, yes.text
    # An old category on an existing course survives an edit that doesn't change it.
    pid = yes.json()["id"]
    await db["programs"].update_one({"_id": ObjectId(pid)}, {"$set": {"category": "Business"}})
    keep = await client.patch(f"/programs/{pid}", json={"name": "Learn masters test admin 2"}, headers=sh)
    assert keep.status_code == 200, keep.text


async def test_mentor_topics_and_swap_tags(api):
    client, db, made = api
    _, h = await _member(db, made, "Mentor Meena")
    body = {"headline": "I help women price their work", "bio": "Twelve years of selling handmade work, happy to share how.",
            "expertise": ["pricing", "Business"], "languages": ["Hindi"]}
    ok = await client.put("/mentoring/me", json=body, headers=h)
    assert ok.status_code == 200, ok.text
    assert ok.json()["expertise"] == ["Pricing", "Business"]
    bad = await client.put("/mentoring/me", json={**body, "expertise": ["Astrology"]}, headers=h)
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "not_in_master"
    swap = await client.post("/exchange/swaps", json={"skill": "Tailoring", "wants": "English",
                                                      "tags": ["tailoring", "Rocket science", "English"]}, headers=h)
    assert swap.status_code == 201, swap.text
    assert swap.json()["tags"] == ["Tailoring", "English"]


async def test_onboarding_offers_and_accepts_a_skill_staff_added(api):
    client, db, made = api
    sh = await _staff(db, made)
    _, h = await _member(db, made, "New Member")
    name = "Test skill Kantha quilting"
    add = await client.post("/admin/work/skills", json={"category": "handicrafts", "name": name}, headers=sh)
    assert add.status_code == 201, add.text
    key = add.json()["key"]
    found = (await client.get("/onboarding/skills", params={"q": "Test skill Kantha"}, headers=h)).json()
    assert [s["key"] for s in found["skills"]] == [key]
    saved = await client.put("/me/onboarding", json={"skills": [key]}, headers=h)
    assert saved.status_code == 200, saved.text
    # Disabled: no longer offered, but the answer she already gave stays valid.
    assert (await client.patch(f"/admin/work/skills/{key}", json={"active": False}, headers=sh)).status_code == 200
    gone = (await client.get("/onboarding/skills", params={"q": "Test skill Kantha"}, headers=h)).json()
    assert gone["skills"] == []
    again = await client.put("/me/onboarding", json={"skills": [key]}, headers=h)
    assert again.status_code == 200, again.text
    skill_master.forget()
