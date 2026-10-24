"""
Mentor reviews: a learner rates a session that happened, once; the mentor's
page shows real reviews, a counted average, sessions given and women who came
back — nothing invented.

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
    from app.routes import mentor_reviews

    if not any(getattr(r, "path", "").endswith("/growth/mentors/{mentor_id}/reviews") for r in app.routes):
        app.include_router(mentor_reviews.router, prefix="/api/v1")

    db = mongodb.get_database()
    made = {"users": [], "mentors": []}
    transport = httpx.ASGITransport(app=app)
    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://test/api/v1") as client:
            yield client, db, made
    finally:
        uids = [str(u) for u in made["users"]]
        mids = [str(m) for m in made["mentors"]]
        await db["users"].delete_many({"_id": {"$in": made["users"]}})
        await db["mentors"].delete_many({"_id": {"$in": made["mentors"]}})
        await db["mentorship_requests"].delete_many({"mentor_id": {"$in": mids}})
        await db["mentor_reviews"].delete_many({"mentor_id": {"$in": mids}})
        await db["member_notifications"].delete_many({"user_id": {"$in": uids}})
        await db[sessions.COLLECTION].delete_many({"user_id": {"$in": uids}})
        cache.clear()
        mongodb._client, mongodb._db = None, None


async def _member(db, made, name: str):
    now = datetime.now(timezone.utc)
    doc = {
        "full_name": name, "email": f"rev-{uuid.uuid4().hex[:10]}@example.com", "phone": "",
        "email_verified_at": now, "role": "Member", "is_active": True, "token_version": 0,
        "verification_status": "active", "created_at": now, "updated_at": now,
    }
    doc["_id"] = (await db["users"].insert_one(doc)).inserted_id
    made["users"].append(doc["_id"])
    tokens = await sessions.start(None, doc)
    return doc, {"Authorization": f"Bearer {tokens['access_token']}"}


async def _mentor(db, made):
    now = datetime.now(timezone.utc)
    doc = {"name": "Test Mentor Kamala", "headline": "Tailoring", "status": "active", "expertise": ["Tailoring"],
           "languages": ["Hindi"], "rating": 4.9, "rating_count": 99, "sessions_done": 300, "created_at": now}
    doc["_id"] = (await db["mentors"].insert_one(doc)).inserted_id
    made["mentors"].append(doc["_id"])
    return str(doc["_id"])


async def _session(db, mentor_id, user, status="closed"):
    now = datetime.now(timezone.utc)
    return str((await db["mentorship_requests"].insert_one({
        "user_id": str(user["_id"]), "mentor_id": mentor_id, "mentor_name": "Test Mentor Kamala",
        "goal": "Pricing", "status": status, "created_at": now, "updated_at": now,
    })).inserted_id)


async def test_rate_once_after_the_session_and_page_counts_real_rows(api):
    client, db, made = api
    mid = await _mentor(db, made)
    asha, ha = await _member(db, made, "Asha Learner")
    bina, hb = await _member(db, made, "Bina Learner")
    s1 = await _session(db, mid, asha)
    await _session(db, mid, asha)               # Asha came back for a second
    s3 = await _session(db, mid, bina)
    pending = await _session(db, mid, bina, status="accepted")

    # Invented stored figures are replaced by counted ones.
    page = (await client.get(f"/growth/mentors/{mid}/reviews", headers=ha)).json()
    assert page["rating"] == 0.0 and page["rating_count"] == 0 and page["sessions_done"] == 3
    assert page["learners"] == 2 and page["came_back"] == 1 and page["reviews"] == []

    assert (await client.post(f"/growth/mentors/requests/{pending}/review", json={"rating": 5}, headers=hb)).status_code == 409
    assert (await client.post(f"/growth/mentors/requests/{s1}/review", json={"rating": 5}, headers=hb)).status_code == 404
    got = await client.post(f"/growth/mentors/requests/{s1}/review", json={"rating": 5, "text": "She showed me how to price"}, headers=ha)
    assert got.status_code == 201, got.text
    assert (await client.post(f"/growth/mentors/requests/{s1}/review", json={"rating": 1}, headers=ha)).status_code == 409
    assert (await client.post(f"/growth/mentors/requests/{s3}/review", json={"rating": 4}, headers=hb)).status_code == 201

    page = (await client.get(f"/growth/mentors/{mid}/reviews", headers=hb)).json()
    assert page["rating"] == 4.5 and page["rating_count"] == 2
    assert page["reviews"][-1]["first_name"] == "Asha" and page["reviews"][-1]["text"] == "She showed me how to price"
    assert "user_id" not in page["reviews"][0]

    mine = (await client.get("/growth/mentors/requests/reviewed", headers=ha)).json()
    assert mine == {s1: 5}
    listed = (await client.get("/growth/mentors", headers=ha)).json()
    row = next(m for m in listed if m["id"] == mid)
    assert row["rating"] == 4.5 and row["sessions_done"] == 3
