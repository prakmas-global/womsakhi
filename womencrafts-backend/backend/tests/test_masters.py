"""
Masters: lists seed with today's values; members read active items; staff add,
rename (carried into records), reorder, disable, and delete only what nothing
uses; `check()` accepts active labels only; each list is guarded by its module.

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


from app.core import masters as m


async def test_lists_seed_with_todays_values_and_members_read_active(api):
    client, db, made = api
    _, h = await _member(db, made, "Asha")
    got = (await client.get("/masters", params={"lists": "event_categories,course_categories"}, headers=h)).json()
    assert [i["label"] for i in got["event_categories"]][:3] == ["Workshop", "Mela", "Webinar"]
    paths = {p["label"]: [c["label"] for c in p["children"]] for p in got["course_categories"]}
    assert paths["Money & Finance"] == ["Money & Savings"] and "Handicrafts" in paths["Entrepreneurship"]
    assert (await client.get("/masters", params={"lists": "nope"}, headers=h)).status_code == 404


async def test_check_accepts_active_labels_only(api):
    client, db, made = api
    assert await m.check("opportunity_types", "freelance") == "Freelance"
    import fastapi
    try:
        await m.check("opportunity_types", "Gig")
        raise AssertionError("should refuse")
    except fastapi.HTTPException as exc:
        assert exc.status_code == 422 and "Freelance" in exc.detail["message"]


async def test_staff_add_rename_disable_delete(api):
    client, db, made = api
    sh = await _staff(db, made)
    _, h = await _member(db, made, "Neha")
    lists = (await client.get("/admin/masters", headers=sh)).json()
    assert any(l["key"] == "event_categories" and l["can_edit"] for l in lists)
    add = await client.post("/admin/masters/event_categories/items", json={"label": "Test Fair"}, headers=sh)
    assert add.status_code == 201, add.text
    key = add.json()["key"]
    assert (await client.post("/admin/masters/event_categories/items", json={"label": "test fair"}, headers=sh)).status_code == 409
    # A record uses it; rename carries; delete refused; disable hides it from members.
    ev = (await db["events"].insert_one({"title": "Masters test event", "category": "Test Fair"})).inserted_id
    ren = await client.patch(f"/admin/masters/event_categories/items/{key}", json={"label": "Test Fair 2"}, headers=sh)
    assert ren.status_code == 200 and ren.json()["renamed_records"] == 1 and ren.json()["used"] == 1
    assert (await db["events"].find_one({"_id": ev}))["category"] == "Test Fair 2"
    no = await client.delete(f"/admin/masters/event_categories/items/{key}", headers=sh)
    assert no.status_code == 409 and no.json()["error"]["code"] == "in_use"
    await client.patch(f"/admin/masters/event_categories/items/{key}", json={"active": False}, headers=sh)
    seen = (await client.get("/masters", params={"lists": "event_categories"}, headers=h)).json()["event_categories"]
    assert all(i["label"] != "Test Fair 2" for i in seen)
    await db["events"].delete_one({"_id": ev})
    assert (await client.delete(f"/admin/masters/event_categories/items/{key}", headers=sh)).status_code == 204


async def test_two_level_lists_and_extras(api):
    client, db, made = api
    sh = await _staff(db, made)
    one = (await client.get("/admin/masters/circle_topics", headers=sh)).json()
    biz = next(i for i in one["items"] if i["label"] == "Business & Ideas")
    assert "tailoring" in biz["extra"]["synonyms"]
    # A child needs a real parent; a one-level list refuses children.
    assert (await client.post("/admin/masters/circle_topics/items", json={"label": "Test x", "parent_key": "x"}, headers=sh)).status_code == 422
    two = (await client.get("/admin/masters/course_categories", headers=sh)).json()
    parent = two["items"][0]["key"]
    kid = await client.post("/admin/masters/course_categories/items",
                            json={"label": "Test course cat", "parent_key": parent, "extra": {"icon": "Star", "bogus": 1}}, headers=sh)
    assert kid.status_code == 201 and kid.json()["extra"] == {"icon": "Star"}
    # Picture lists carry an image: library art keeps its path, an upload goes
    # back out as a URL, and members read it with the item. Others refuse it.
    pic = await client.patch(f"/admin/masters/course_categories/items/{kid.json()['key']}",
                             json={"extra": {"icon": "Star", "image": "/ux/art/earn-shop.webp"}}, headers=sh)
    assert pic.status_code == 200 and pic.json()["extra"]["image"] == "/ux/art/earn-shop.webp"
    up = await client.patch(f"/admin/masters/event_categories/items/{(await client.get('/admin/masters/event_categories', headers=sh)).json()['items'][0]['key']}",
                            json={"extra": {"image": "/media/cover/y.png"}}, headers=sh)
    assert up.status_code == 200 and up.json()["extra"]["image"].endswith("/media/cover/y.png")
    assert "image" in two["extras"]
    await client.patch(f"/admin/masters/event_categories/items/{up.json()['key']}", json={"extra": {}}, headers=sh)
    lang = (await client.get("/admin/masters/languages", headers=sh)).json()
    assert "image" not in lang["extras"]
    no = await client.delete(f"/admin/masters/course_categories/items/{parent}", headers=sh)
    assert no.status_code == 409


async def test_members_cannot_change_lists(api):
    client, db, made = api
    _, h = await _member(db, made, "Kavita")
    assert (await client.get("/admin/masters", headers=h)).json() == []
    assert (await client.post("/admin/masters/event_categories/items", json={"label": "Test nope"}, headers=h)).status_code == 403
