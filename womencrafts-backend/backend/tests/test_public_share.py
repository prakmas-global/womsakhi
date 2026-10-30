"""
Shared links (course, story, circle invite) and real meeting links.

Runs against the throwaway local mongod on 127.0.0.1:27099 (skipped when it is
not running). Every row this module writes is removed afterwards.
"""

import uuid
from datetime import datetime, timezone

import httpx
import pytest
from bson import ObjectId

from app.core import cache, ratelimit, sessions
from app.core.config import settings
from app.db import mongodb
from tests.conftest import LOCAL_MONGO_DB


def _mount(app):
    paths = {getattr(r, "path", "") for r in app.routes}
    if "/api/v1/public/courses/{course_id}" not in paths:
        from app.routes.public_share import member_router, router
        app.include_router(router, prefix="/api/v1")
        app.include_router(member_router, prefix="/api/v1")


@pytest.fixture
async def api(local_mongo, monkeypatch):
    monkeypatch.setattr(settings, "DB_NAME", LOCAL_MONGO_DB)
    monkeypatch.setattr(settings, "REDIS_URL", "")
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    mongodb._client, mongodb._db = local_mongo, None
    cache.clear()
    ratelimit._hits.clear()
    from main import app
    _mount(app)

    db = mongodb.get_database()
    made = {"users": [], "programs": [], "stories": [], "circles": [], "bookings": []}
    transport = httpx.ASGITransport(app=app)
    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://test/api/v1") as client:
            yield client, db, made
    finally:
        uids = [str(u) for u in made["users"]]
        await db["users"].delete_many({"_id": {"$in": made["users"]}})
        await db["programs"].delete_many({"_id": {"$in": made["programs"]}})
        await db["stories"].delete_many({"_id": {"$in": made["stories"]}})
        await db["circles"].delete_many({"_id": {"$in": made["circles"]}})
        await db["circle_members"].delete_many({"circle_id": {"$in": [str(c) for c in made["circles"]]}})
        await db["bookings"].delete_many({"_id": {"$in": made["bookings"]}})
        await db["member_notifications"].delete_many({"user_id": {"$in": uids}})
        await db[sessions.COLLECTION].delete_many({"user_id": {"$in": uids}})
        await db["audit_events"].delete_many({"target": {"$in": [str(b) for b in made["bookings"]]}})
        cache.clear()
        mongodb._client, mongodb._db = None, None


async def _member(db, made, name: str, *, status: str = "active", role: str = "Member", phone: str = ""):
    now = datetime.now(timezone.utc)
    doc = {
        "full_name": name, "email": f"share-{uuid.uuid4().hex[:10]}@example.com", "phone": phone,
        "email_verified_at": now, "role": role, "is_active": True, "token_version": 0,
        "verification_status": status, "created_at": now, "updated_at": now,
    }
    doc["_id"] = (await db["users"].insert_one(doc)).inserted_id
    made["users"].append(doc["_id"])
    tokens = await sessions.start(None, doc)
    return doc, {"Authorization": f"Bearer {tokens['access_token']}"}


async def test_public_course_shows_only_open_courses_and_first_names(api):
    client, db, made = api
    now = datetime.now(timezone.utc)
    live = (await db["programs"].insert_one({
        "name": "Blouse basics", "desc": "Measure and stitch", "category": "Handicrafts", "status": "Active",
        "owner_kind": "member", "owner_id": "x", "teacher_name": "Priya Sharma", "price_minor": 49900,
        "curriculum": [{"title": "Measure"}, {"title": "Cut"}], "created_at": now})).inserted_id
    draft = (await db["programs"].insert_one({"name": "Draft", "status": "Draft", "created_at": now})).inserted_id
    made["programs"] += [live, draft]
    got = await client.get(f"/public/courses/{live}")
    assert got.status_code == 200
    body = got.json()
    assert body["teacher"] == "Priya" and body["lessons"] == 2 and body["price_minor"] == 49900
    assert "owner_id" not in body
    assert (await client.get(f"/public/courses/{draft}")).status_code == 404
    assert (await client.get("/public/courses/not-an-id")).status_code == 404


async def test_public_story_only_when_published_and_respects_name_choice(api):
    client, db, made = api
    author, _ = await _member(db, made, "Sunita Devi")
    _, hm = await _member(db, made, "Reader Rani")
    pub = (await db["stories"].insert_one({"user_id": str(author["_id"]), "author_name": "Sunita Devi", "allow_name": True,
                                           "title": "My shop", "body": "It began…", "status": "published",
                                           "published_at": datetime.now(timezone.utc), "likes": []})).inserted_id
    anon = (await db["stories"].insert_one({"user_id": str(author["_id"]), "author_name": "A WomSakhi member", "allow_name": False,
                                            "title": "Quiet", "body": "…", "status": "published", "likes": []})).inserted_id
    pend = (await db["stories"].insert_one({"user_id": str(author["_id"]), "title": "Not yet", "status": "pending"})).inserted_id
    made["stories"] += [pub, anon, pend]
    got = (await client.get(f"/public/stories/{pub}")).json()
    assert got["author"] == "Sunita" and "user_id" not in got
    assert (await client.get(f"/public/stories/{anon}")).json()["author"] == "A WomSakhi member"
    assert (await client.get(f"/public/stories/{pend}")).status_code == 404
    # Messaging the author: only when she put her name to it.
    assert (await client.get(f"/community/stories/{pub}/author", headers=hm)).json()["user_id"] == str(author["_id"])
    assert (await client.get(f"/community/stories/{anon}/author", headers=hm)).json()["user_id"] == ""
    assert (await client.get(f"/community/stories/{pub}/author")).status_code in (401, 403)


async def test_circle_invite_link_lets_her_into_a_private_circle(api):
    client, db, made = api
    host, hh = await _member(db, made, "Host Hema")
    other, ho = await _member(db, made, "Other Olga")
    guest, hg = await _member(db, made, "Guest Geeta")
    cid = (await db["circles"].insert_one({"name": "Saree sellers", "desc": "We share orders", "is_private": True,
                                           "status": "active", "member_count": 1, "created_by": str(host["_id"])})).inserted_id
    made["circles"].append(cid)
    await db["circle_members"].insert_one({"user_id": str(host["_id"]), "circle_id": str(cid), "role": "host", "turn": 0})

    assert (await client.post(f"/community/circles/{cid}/invite-code", headers=ho)).status_code == 403
    code = (await client.post(f"/community/circles/{cid}/invite-code", headers=hh)).json()["code"]
    assert (await client.post(f"/community/circles/{cid}/invite-code", headers=hh)).json()["code"] == code  # stable
    pub = (await client.get(f"/public/circles/invite/{code}")).json()
    assert pub["name"] == "Saree sellers" and pub["member_count"] == 1 and "created_by" not in pub
    assert (await client.post(f"/community/circles/{cid}/join", headers=hg)).status_code == 403  # private from outside
    joined = await client.post(f"/community/circles/join/{code}", headers=hg)
    assert joined.status_code == 200 and joined.json()["already"] is False
    assert (await client.post(f"/community/circles/join/{code}", headers=hg)).json()["already"] is True
    assert (await db["circles"].find_one({"_id": cid}))["member_count"] == 2
    assert (await client.get("/public/circles/invite/nope")).status_code == 404


async def test_booking_meeting_is_set_by_staff_and_she_is_told(api):
    client, db, made = api
    her, hm = await _member(db, made, "Booker Bina")
    _, hs = await _member(db, made, "Staff Sita", role="Super Admin")
    bid = (await db["bookings"].insert_one({
        "user_id": str(her["_id"]), "member_id": "", "service_id": "", "service_name": "Career guidance",
        "date": "2099-01-10", "time": "10:00 AM", "mode": "Online", "status": "upcoming", "with_whom": "",
        "duration": "30 min", "price": 0, "note": "", "cancelled_reason": "", "created_at": datetime.now(timezone.utc)})).inserted_id
    made["bookings"].append(bid)
    mine = (await client.get("/me/bookings", headers=hm)).json()
    assert next(b for b in mine if b["id"] == str(bid))["meeting"] == ""
    bad = await client.post(f"/appointments/member:{bid}/meeting", json={"meeting": "http://insecure"}, headers=hs)
    assert bad.status_code == 422
    ok = await client.post(f"/appointments/member:{bid}/meeting", json={"meeting": "https://meet.google.com/abc-defg-hij"}, headers=hs)
    assert ok.status_code == 200, ok.text
    assert ok.json()["meeting"].startswith("https://")
    mine = (await client.get("/me/bookings", headers=hm)).json()
    assert next(b for b in mine if b["id"] == str(bid))["meeting"] == "https://meet.google.com/abc-defg-hij"
    assert await db["member_notifications"].count_documents({"user_id": str(her["_id"]), "title": {"$regex": "How to join"}}) == 1
    assert (await client.post(f"/appointments/member:{bid}/meeting", json={"meeting": "x"}, headers=hm)).status_code in (401, 403)
