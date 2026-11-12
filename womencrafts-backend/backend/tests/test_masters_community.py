"""
Community, Work and Help masters in use: event categories, opportunity types,
circle topics (with synonym folding) and tags, feed report reasons and safety
report categories are checked against the masters by the routes that write them.

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
        await db["events"].delete_many({"title": {"$regex": "^Masters test"}})
        await db["opportunities"].delete_many({"title": {"$regex": "^Masters test"}})
        await db["circles"].delete_many({"name": {"$regex": "^Masters test"}})
        await db["circle_members"].delete_many({"user_id": {"$in": uids}})
        await db["feed_posts"].delete_many({"author_id": {"$in": uids}})
        await db["feed_reports"].delete_many({"reporter_id": {"$in": uids}})
        await db["safety_reports"].delete_many({"user_id": {"$in": uids}})
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


async def test_event_category_must_be_in_the_master(api):
    client, db, made = api
    sh = await _staff(db, made)
    ok = await client.post("/admin/growth/events", json={"title": "Masters test event", "category": "meet-up"}, headers=sh)
    assert ok.status_code == 201, ok.text
    assert ok.json()["category"] == "Meet-up"
    no = await client.post("/admin/growth/events", json={"title": "Masters test event 2", "category": "Party"}, headers=sh)
    assert no.status_code == 422 and no.json()["error"]["code"] == "not_in_master"
    # Disabling a category never blocks editing an event already in it.
    key = next(i["key"] for i in (await client.get("/admin/masters/event_categories", headers=sh)).json()["items"]
               if i["label"] == "Meet-up")
    await client.patch(f"/admin/masters/event_categories/items/{key}", json={"active": False}, headers=sh)
    try:
        ev = ok.json()["id"]
        same = await client.put(f"/admin/growth/events/{ev}", json={"title": "Masters test event", "category": "Meet-up"}, headers=sh)
        assert same.status_code == 200, same.text
        moved = await client.post("/admin/growth/events", json={"title": "Masters test event 3", "category": "Meet-up"}, headers=sh)
        assert moved.status_code == 422
    finally:
        await client.patch(f"/admin/masters/event_categories/items/{key}", json={"active": True}, headers=sh)


async def test_opportunity_type_must_be_in_the_master(api):
    client, db, made = api
    sh = await _staff(db, made)
    ok = await client.post("/admin/growth/opportunities", json={"title": "Masters test job", "kind": "freelance"}, headers=sh)
    assert ok.status_code == 201, ok.text
    assert ok.json()["kind"] == "Freelance"
    no = await client.post("/admin/growth/opportunities", json={"title": "Masters test job 2", "kind": "Gig"}, headers=sh)
    assert no.status_code == 422
    # A type staff add is accepted at once, and kept (not coerced to "Job").
    add = (await client.post("/admin/masters/opportunity_types/items", json={"label": "Test Apprenticeship"}, headers=sh)).json()
    new = await client.post("/admin/growth/opportunities", json={"title": "Masters test job 3", "kind": "Test Apprenticeship"}, headers=sh)
    assert new.status_code == 201 and new.json()["kind"] == "Test Apprenticeship"
    await db["opportunities"].delete_many({"title": "Masters test job 3"})
    await client.delete(f"/admin/masters/opportunity_types/items/{add['key']}", headers=sh)


async def test_circle_topic_folds_synonyms_and_tags_stay_forgiving(api):
    client, db, made = api
    _, h = await _member(db, made, "Circle Host")
    got = await client.post("/community/circles", json={"name": "Masters test circle", "topic": "Careers",
                                                         "tags": ["#Tailoring", "made-up-tag", "savings"]}, headers=h)
    assert got.status_code == 201, got.text
    assert got.json()["topic"] == "Career & Skills"
    assert sorted(got.json().get("tags") or (await db["circles"].find_one({"name": "Masters test circle"}))["tags"]) == ["savings", "tailoring"]
    exact = await client.post("/community/circles", json={"name": "Masters test circle 2", "topic": "money & finance"}, headers=h)
    assert exact.status_code == 201 and exact.json()["topic"] == "Money & Finance"
    no = await client.post("/community/circles", json={"name": "Masters test circle 3", "topic": "Astrology"}, headers=h)
    assert no.status_code == 422 and no.json()["error"]["code"] == "not_in_master"
    none = await client.post("/community/circles", json={"name": "Masters test circle 4"}, headers=h)
    assert none.status_code == 201 and none.json()["topic"] == ""


async def test_report_reasons_come_from_the_masters(api):
    client, db, made = api
    _, author = await _member(db, made, "Poster")
    _, reader = await _member(db, made, "Reader")
    assert "Spam or selling" in (await client.get("/feed/report-reasons", headers=reader)).json()
    post = (await client.post("/feed/posts", json={"text": "Masters test post", "audience": "everyone"}, headers=author)).json()
    r = await client.post(f"/feed/posts/{post['id']}/report", json={"reason": "spam or selling"}, headers=reader)
    assert r.status_code == 200
    assert (await db["feed_reports"].find_one({"post_id": post["id"]}))["reason"] == "Spam or selling"
    # Unknown reasons are filed as "Something else": reporting never fails for her.
    # (She no longer sees a post she reported, so a second woman reports it.)
    _, other = await _member(db, made, "Another reader")
    r2 = await client.post(f"/feed/posts/{post['id']}/report", json={"reason": "Ugly"}, headers=other)
    assert r2.status_code == 200, r2.text
    assert {d["reason"] async for d in db["feed_reports"].find({"post_id": post["id"]})} == {"Spam or selling", "Something else"}


async def test_safety_report_category_or_reason(api):
    client, db, made = api
    _, h = await _member(db, made, "Asha")
    details = "Someone in a circle asked me to share my bank OTP."
    a = await client.post("/safety/reports", json={"category": "money or fraud", "details": details}, headers=h)
    assert a.status_code == 201 and a.json()["category"] == "Money or fraud"
    b = await client.post("/safety/reports", json={"category": "Asked for money, OTP or bank details", "details": details}, headers=h)
    assert b.status_code == 201 and b.json()["category"] == "Money or fraud"
    c = await client.post("/safety/reports", json={"category": "Bad vibes", "details": details}, headers=h)
    assert c.status_code == 422
