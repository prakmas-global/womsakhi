"""
Usernames: the shape rules, one woman per name, the 90-day change limit, the
name other members see, and finding a member by hers.

Runs against the throwaway local mongod on 127.0.0.1:27099 (skipped when it is
not running). Every row this module writes is removed afterwards.
"""

import uuid
from datetime import datetime, timedelta, timezone

import httpx
import pytest

from app.core import cache, ratelimit, sessions, usernames
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
        await db["audit_logs"].delete_many({"action": "username.set", "actor_id": {"$in": uids}})
        cache.clear()
        mongodb._client, mongodb._db = None, None


async def _member(db, made, name: str, *, status: str = "active", role: str = "Member", **extra):
    now = datetime.now(timezone.utc)
    doc = {
        "full_name": name, "email": f"un-{uuid.uuid4().hex[:10]}@example.com",
        "email_verified_at": now, "role": role, "is_active": True, "token_version": 0,
        "verification_status": status, "created_at": now, "updated_at": now, **extra,
    }
    doc["_id"] = (await db["users"].insert_one(doc)).inserted_id
    made["users"].append(doc["_id"])
    tokens = await sessions.start(None, doc)
    return doc, {"Authorization": f"Bearer {tokens['access_token']}"}


def _u(prefix="t"):
    return f"{prefix}{uuid.uuid4().hex[:8]}"


def test_shape_rules():
    ok = ["priya", "priya.sews", "asha_99", "a1b"]
    bad = ["ab", "x" * 21, "Priya!", "123", ".priya", "priya.", "pri..ya", "admin", "womsakhi.help", "adminrr.apps", "team.support", "has space"]
    for n in ok:
        assert usernames.problem(n) is None, n
    for n in bad:
        assert usernames.problem(usernames.normalise(n) if n != "Priya!" else n) is not None, n
    assert usernames.normalise("  @Priya.Sews ") == "priya.sews"


def test_ideas_never_echo_an_official_looking_name():
    ideas = usernames.suggestions_from("RR Apps", set(), "admin")
    assert ideas and not any("admin" in i for i in ideas)


def test_display_name_prefers_username():
    assert usernames.display_name({"full_name": "Priya Sharma"}) == "Priya Sharma"
    assert usernames.display_name({"full_name": "Priya Sharma", "username": "priya.sews"}) == "priya.sews"


async def test_set_then_cooldown_blocks_a_second_change(api):
    client, db, made = api
    _, h = await _member(db, made, "Priya Sharma")
    name = _u("priya")
    got = await client.put("/me/username", json={"username": name.upper()}, headers=h)
    assert got.status_code == 200, got.text
    body = got.json()
    assert body["username"] == name and body["display_name"] == name and body["can_change"] is False
    assert body["next_change_at"]

    again = await client.put("/me/username", json={"username": _u("other")}, headers=h)
    assert again.status_code == 409 and again.json()["error"]["code"] == "username_cooldown"

    # The session user and the profile both carry it.
    prof = (await client.get("/me/profile", headers=h)).json()
    assert prof["username"] == name and prof["display_name"] == name and prof["username_next_change_at"]


async def test_change_allowed_after_ninety_days(api):
    client, db, made = api
    old = _u("old")
    _, h = await _member(db, made, "Asha Rani", username=old,
                         username_changed_at=datetime.now(timezone.utc) - timedelta(days=91))
    new = _u("new")
    got = await client.put("/me/username", json={"username": new}, headers=h)
    assert got.status_code == 200, got.text
    assert got.json()["username"] == new
    # Her old name is free again for someone else.
    _, h2 = await _member(db, made, "Other Woman")
    chk = (await client.get("/me/username/check", params={"u": old}, headers=h2)).json()
    assert chk["available"] is True


async def test_no_two_women_share_a_name(api):
    client, db, made = api
    name = _u("kavita")
    await _member(db, made, "Kavita One", username=name)
    _, h = await _member(db, made, "Kavita Two")
    chk = (await client.get("/me/username/check", params={"u": name.title()}, headers=h)).json()
    assert chk["available"] is False and "already" in chk["reason"]
    assert chk["suggestions"] and name not in chk["suggestions"]
    put = await client.put("/me/username", json={"username": name}, headers=h)
    assert put.status_code == 409 and put.json()["error"]["code"] == "username_taken"


async def test_invalid_name_is_refused_with_a_reason(api):
    client, db, made = api
    _, h = await _member(db, made, "Neha")
    put = await client.put("/me/username", json={"username": "pri..ya"}, headers=h)
    assert put.status_code == 422 and put.json()["error"]["code"] == "username_invalid"


async def test_search_finds_admitted_members_by_username_only(api):
    client, db, made = api
    tag = uuid.uuid4().hex[:6]
    _, h = await _member(db, made, "Searcher")
    await _member(db, made, "Found Her", username=f"sx{tag}.found")
    await _member(db, made, "Still Waiting", username=f"sx{tag}.wait", status="pending_review")
    await _member(db, made, "A Staffer", username=f"sx{tag}.staff", role="Admin")
    rows = (await client.get("/people/search", params={"q": f"@sx{tag}"}, headers=h)).json()
    assert [r["username"] for r in rows] == [f"sx{tag}.found"]
    assert rows[0]["name"] == f"sx{tag}.found" and rows[0]["verified"] is True
    assert "email" not in rows[0] and "phone" not in rows[0]
    card = await client.get(f"/people/u/sx{tag}.found", headers=h)
    assert card.status_code == 200 and card.json()["relation"] == "none"
    assert (await client.get(f"/people/u/sx{tag}.wait", headers=h)).status_code == 404


# --- the verified name is locked --------------------------------------------

async def test_verified_member_cannot_change_her_name(api):
    client, db, made = api
    _, h = await _member(db, made, "Lakshmi Devi")
    prof = (await client.get("/me/profile", headers=h)).json()
    assert prof["name_locked"] is True
    refused = await client.patch("/me/profile", json={"full_name": "Someone Else"}, headers=h)
    assert refused.status_code == 409 and refused.json()["error"]["code"] == "name_locked"
    also = await client.put("/users/me", json={"full_name": "Someone Else"}, headers=h)
    assert also.status_code == 409
    # Sending her name back unchanged (a settings form saving other fields) is fine.
    same = await client.patch("/me/profile", json={"full_name": "Lakshmi Devi", "bio": "I sew"}, headers=h)
    assert same.status_code == 200, same.text
    assert (await db["users"].find_one({"_id": _["_id"]}))["full_name"] == "Lakshmi Devi"
    # Her username she can still set.
    assert (await client.put("/me/username", json={"username": _u("lakshmi")}, headers=h)).status_code == 200


async def test_member_waiting_for_review_can_still_fix_her_name(api):
    client, db, made = api
    _, h = await _member(db, made, "Lakshmi Dvi", status="in_review")
    got = await client.patch("/me/profile", json={"full_name": "Lakshmi Devi"}, headers=h)
    assert got.status_code == 200, got.text
    assert got.json()["name_locked"] is False and got.json()["full_name"] == "Lakshmi Devi"


async def test_approving_from_her_profile_needs_the_name_on_her_id(api):
    client, db, made = api
    staff, sh = await _member(db, made, "Reviewer", role="Super Admin")
    now = datetime.now(timezone.utc)
    mid = (await db["members"].insert_one({"full_name": "Typed Name", "email": f"m-{uuid.uuid4().hex[:8]}@example.com",
                                           "status": "Pending", "created_at": now, "updated_at": now})).inserted_id
    try:
        her, _h = await _member(db, made, "Typed Name", status="in_review", member_id=str(mid))
        got = await client.post(f"/members/{mid}/approve", json={"reason": ""}, headers=sh)
        assert got.status_code == 422 and got.json()["error"]["code"] == "name_invalid"
    finally:
        await db["members"].delete_one({"_id": mid})
