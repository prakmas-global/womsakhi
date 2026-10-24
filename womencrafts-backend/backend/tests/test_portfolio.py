"""
Her profile's evidence: the portfolio ("What you made") and the impact counts
("Helping others") — both from real records, never fixtures.

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


@pytest.fixture
async def api(local_mongo, monkeypatch):
    monkeypatch.setattr(settings, "DB_NAME", LOCAL_MONGO_DB)
    monkeypatch.setattr(settings, "REDIS_URL", "")
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    mongodb._client, mongodb._db = local_mongo, None
    cache.clear()
    ratelimit._hits.clear()
    from main import app
    from app.routes.portfolio import router as portfolio_router

    if not any(getattr(r, "path", "").startswith("/api/v1/me/portfolio") for r in app.routes):
        app.include_router(portfolio_router, prefix="/api/v1")

    db = mongodb.get_database()
    made = {"users": [], "programs": [], "mentors": [], "opps": []}
    transport = httpx.ASGITransport(app=app)
    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://test/api/v1") as client:
            yield client, db, made
    finally:
        uids = [str(u) for u in made["users"]]
        await db["users"].delete_many({"_id": {"$in": made["users"]}})
        await db["portfolio_items"].delete_many({"user_id": {"$in": uids}})
        await db["programs"].delete_many({"_id": {"$in": made["programs"]}})
        await db["enrollments"].delete_many({"user_id": {"$in": uids}})
        await db["mentors"].delete_many({"_id": {"$in": made["mentors"]}})
        await db["mentorship_requests"].delete_many({"user_id": {"$in": uids}})
        await db["circle_members"].delete_many({"user_id": {"$in": uids}})
        await db["opportunities"].delete_many({"_id": {"$in": made["opps"]}})
        await db["applications"].delete_many({"user_id": {"$in": uids}})
        await db["course_questions"].delete_many({"program_id": {"$in": [str(p) for p in made["programs"]]}})
        await db[sessions.COLLECTION].delete_many({"user_id": {"$in": uids}})
        cache.clear()
        mongodb._client, mongodb._db = None, None


async def _member(db, made, name: str, *, status: str = "active"):
    now = datetime.now(timezone.utc)
    doc = {
        "full_name": name, "email": f"pf-{uuid.uuid4().hex[:10]}@example.com", "phone": "+919800000123",
        "email_verified_at": now, "role": "Member", "is_active": True, "token_version": 0,
        "verification_status": status, "created_at": now, "updated_at": now,
    }
    doc["_id"] = (await db["users"].insert_one(doc)).inserted_id
    made["users"].append(doc["_id"])
    tokens = await sessions.start(None, doc)
    return doc, {"Authorization": f"Bearer {tokens['access_token']}"}


async def test_portfolio_add_list_hide_and_others_see_only_shown(api):
    client, db, made = api
    asha, ha = await _member(db, made, "Asha Maker")
    _, hb = await _member(db, made, "Bina Buyer")

    one = await client.post("/me/portfolio", json={"title": "Bridal blouse", "photo": "/api/v1/uploads/x.webp",
                                                   "made_for": "A wedding in Jaipur", "year": 2025}, headers=ha)
    assert one.status_code == 201, one.text
    two = await client.post("/me/portfolio", json={"title": "Practice piece", "photo": "/api/v1/uploads/y.webp",
                                                   "visible": False}, headers=ha)
    assert two.status_code == 201
    mine = (await client.get("/me/portfolio", headers=ha)).json()
    assert [m["title"] for m in mine] == ["Practice piece", "Bridal blouse"]

    seen = (await client.get(f"/me/portfolio/of/{asha['_id']}", headers=hb)).json()
    assert seen["first_name"] == "Asha" and [i["title"] for i in seen["items"]] == ["Bridal blouse"]
    assert "+919800000123" not in str(seen)

    # Hide the shown one: nobody else sees anything.
    pid = one.json()["id"]
    assert (await client.patch(f"/me/portfolio/{pid}", json={"visible": False}, headers=ha)).json()["visible"] is False
    assert (await client.get(f"/me/portfolio/of/{asha['_id']}", headers=hb)).json()["items"] == []
    # Only she can change or remove her pieces.
    assert (await client.delete(f"/me/portfolio/{pid}", headers=hb)).status_code == 404
    assert (await client.delete(f"/me/portfolio/{pid}", headers=ha)).status_code == 200
    assert len((await client.get("/me/portfolio", headers=ha)).json()) == 1


async def test_portfolio_validation_and_limit(api, monkeypatch):
    from app.routes import portfolio
    monkeypatch.setattr(portfolio, "MAX_ITEMS", 1)
    client, db, made = api
    _, ha = await _member(db, made, "Limit Maker")
    assert (await client.post("/me/portfolio", json={"title": "No photo", "photo": "not-a-url"}, headers=ha)).status_code == 422
    assert (await client.post("/me/portfolio", json={"title": "Old", "photo": "/u.webp", "year": 1800}, headers=ha)).status_code == 422
    assert (await client.post("/me/portfolio", json={"title": "First", "photo": "/u.webp"}, headers=ha)).status_code == 201
    assert (await client.post("/me/portfolio", json={"title": "Second", "photo": "/u.webp"}, headers=ha)).status_code == 429
    _, hp = await _member(db, made, "Pending Maker", status="pending")
    assert (await client.get("/me/portfolio", headers=hp)).status_code == 403


async def test_impact_is_counted_from_real_records(api):
    client, db, made = api
    t, ht = await _member(db, made, "Teacher Tara")
    l1, _ = await _member(db, made, "Learner One")
    l2, _ = await _member(db, made, "Learner Two")
    m1, _ = await _member(db, made, "Mentee One")
    w1, _ = await _member(db, made, "Worker One")
    tid = str(t["_id"])

    empty = (await client.get("/me/portfolio/impact", headers=ht)).json()
    assert empty["women_helped"] == 0 and empty["courses"] == 0

    now = datetime.now(timezone.utc)
    prog = (await db["programs"].insert_one({"name": "Test course", "owner_id": tid, "created_at": now})).inserted_id
    made["programs"].append(prog)
    await db["enrollments"].insert_many([
        {"user_id": str(l1["_id"]), "program_id": str(prog), "status": "completed"},
        {"user_id": str(l2["_id"]), "program_id": str(prog), "status": "active"},
        {"user_id": str(m1["_id"]), "program_id": str(prog), "status": "pending"},   # not yet learning
    ])
    ment = (await db["mentors"].insert_one({"owner_id": tid, "sessions_done": 3})).inserted_id
    made["mentors"].append(ment)
    await db["mentorship_requests"].insert_many([
        {"user_id": str(m1["_id"]), "mentor_id": str(ment), "status": "closed"},
        {"user_id": str(l1["_id"]), "mentor_id": str(ment), "status": "closed"},      # same woman twice → once
    ])
    await db["circle_members"].insert_many([
        {"user_id": tid, "circle_id": "c-test", "role": "host"},
        {"user_id": str(w1["_id"]), "circle_id": "c-test", "role": "member"},
    ])
    opp = (await db["opportunities"].insert_one({"title": "Test job", "owner_id": tid, "status": "open"})).inserted_id
    made["opps"].append(opp)
    await db["applications"].insert_one({"user_id": str(w1["_id"]), "opportunity_id": str(opp), "status": "offered"})
    await db["course_questions"].insert_one({"program_id": str(prog), "answers": [
        {"user_id": tid, "verified": True}, {"user_id": tid, "verified": False}, {"user_id": "someone", "verified": True}]})

    got = (await client.get("/me/portfolio/impact", headers=ht)).json()
    assert got["courses"] == 1 and got["learners"] == 2 and got["finished_course"] == 1
    assert got["mentoring_sessions"] == 3 and got["mentees"] == 2
    assert got["answers"] == 2 and got["verified_answers"] == 1
    assert got["circles_hosted"] == 1 and got["circle_members"] == 1
    assert got["women_hired"] == 1
    # learners (l1, l2) + mentees (m1, l1) + hired (w1) → 4 different women
    assert got["women_helped"] == 4
