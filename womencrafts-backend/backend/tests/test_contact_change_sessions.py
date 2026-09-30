"""
Changing how she signs in ends the sessions that should not survive it.

  · She changes her own number → every OTHER device is signed out; the one she
    made the change on stays signed in.
  · Staff change her email or number → every device is signed out.

Runs the real app in-process against the throwaway local mongod (skipped when
it is not running). Every row written here carries a random marker and only
those ids are cleaned up.
"""

import uuid
from datetime import datetime, timezone

import httpx
import pytest
from bson import ObjectId

from app.core import cache, sessions
from app.core.config import settings
from app.db import mongodb
from tests.conftest import LOCAL_MONGO_DB


@pytest.fixture
async def api(local_mongo, monkeypatch):
    monkeypatch.setattr(settings, "DB_NAME", LOCAL_MONGO_DB)
    monkeypatch.setattr(settings, "REDIS_URL", "")
    mongodb._client, mongodb._db = local_mongo, None
    cache.clear()
    from main import app

    db = mongodb.get_database()
    created: dict[str, list] = {"users": [], "members": []}
    transport = httpx.ASGITransport(app=app)
    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://test/api/v1") as client:
            yield client, db, created
    finally:
        for coll, ids in created.items():
            ids = [i for i in ids if i]
            assert all(isinstance(i, ObjectId) for i in ids)
            if ids:
                await db[coll].delete_many({"_id": {"$in": ids}})
        user_ids = [str(i) for i in created["users"] if i]
        if user_ids:
            await db[sessions.COLLECTION].delete_many({"user_id": {"$in": user_ids}})
        mongodb._client, mongodb._db = None, None


async def _user(db, created, *, role="Member", member_id="", phone="+919800000000") -> dict:
    tag = uuid.uuid4().hex[:10]
    now = datetime.now(timezone.utc)
    doc = {
        "full_name": f"Test {tag}", "email": f"ctest-{tag}@example.com", "phone": phone,
        "phone_verified_at": now, "email_verified_at": now,
        "role": role, "is_active": True, "token_version": 0,
        "verification_status": "active", "created_at": now, "updated_at": now,
    }
    if member_id:
        doc["member_id"] = member_id
    res = await db["users"].insert_one(doc)
    created["users"].append(res.inserted_id)
    doc["_id"] = res.inserted_id
    return doc


def _bearer(tokens: dict) -> dict:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


async def _signed_in(client, tokens) -> bool:
    got = await client.get("/auth/me", headers=_bearer(tokens))
    assert got.status_code in (200, 401), got.text
    return got.status_code == 200


async def _refreshes(client, tokens) -> bool:
    got = await client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert got.status_code in (200, 401), got.text
    return got.status_code == 200


async def test_changing_her_phone_signs_out_her_other_devices(api):
    client, db, created = api
    user = await _user(db, created, phone=f"+9198{uuid.uuid4().int % 10**8:08d}")
    here = await sessions.start(None, user)
    phone_there = await sessions.start(None, user)
    laptop_there = await sessions.start(None, user)
    assert await _signed_in(client, here) and await _signed_in(client, phone_there)

    new_phone = f"+9197{uuid.uuid4().int % 10**8:08d}"
    changed = await client.post("/auth/phone", json={"phone": new_phone}, headers=_bearer(here))
    assert changed.status_code == 200, changed.text
    assert changed.json() == {"phone": new_phone, "phone_verified": False}

    # The other devices are out: access refused now, refresh refused too.
    assert not await _signed_in(client, phone_there)
    assert not await _refreshes(client, phone_there)
    assert not await _signed_in(client, laptop_there)
    # This device carries on.
    assert await _signed_in(client, here)
    assert await _refreshes(client, here)

    rows = await db[sessions.COLLECTION].find({"user_id": str(user["_id"])}).to_list(10)
    reasons = {r["sid"]: r.get("revoked_reason") for r in rows}
    assert reasons[here["sid"]] is None
    assert reasons[phone_there["sid"]] == reasons[laptop_there["sid"]] == "phone_changed"
    audit = await db["activity_log"].find_one({"user_id": str(user["_id"]), "action": "security.phone_changed"})
    assert audit and "signed out 2 other devices" in audit["detail"]
    await db["activity_log"].delete_many({"user_id": str(user["_id"])})


async def test_saving_the_same_number_is_not_a_change(api):
    client, db, created = api
    phone = f"+9196{uuid.uuid4().int % 10**8:08d}"
    user = await _user(db, created, phone=phone)
    here = await sessions.start(None, user)
    there = await sessions.start(None, user)
    same = await client.post("/auth/phone", json={"phone": phone}, headers=_bearer(here))
    assert same.status_code == 200 and same.json()["phone_verified"] is True
    assert await _signed_in(client, there)


async def test_a_staff_email_change_ends_every_session(api):
    client, db, created = api
    tag = uuid.uuid4().hex[:10]
    member = {"full_name": f"Member {tag}", "email": f"ctest-m-{tag}@example.com",
              "phone": "+919811111111", "status": "Active", "role": "Member",
              "created_at": datetime.now(timezone.utc)}
    res = await db["members"].insert_one(member)
    created["members"].append(res.inserted_id)
    her = await _user(db, created, member_id=str(res.inserted_id))
    await db["users"].update_one({"_id": her["_id"]}, {"$set": {"email": member["email"]}})
    her = await db["users"].find_one({"_id": her["_id"]})
    admin = await _user(db, created, role="Super Admin", phone="")
    admin_tokens = await sessions.start(None, admin)
    one = await sessions.start(None, her)
    two = await sessions.start(None, her)
    assert await _signed_in(client, one) and await _signed_in(client, two)

    new_email = f"ctest-new-{tag}@example.com"
    edited = await client.patch(f"/members/{res.inserted_id}", json={"email": new_email},
                                headers=_bearer(admin_tokens))
    assert edited.status_code == 200, edited.text

    for tokens in (one, two):
        assert not await _signed_in(client, tokens)
        assert not await _refreshes(client, tokens)
    assert await _signed_in(client, admin_tokens)
    fresh = await db["users"].find_one({"_id": her["_id"]})
    assert fresh["email"] == new_email and fresh["token_version"] == 1
    audit = await db["activity_log"].find_one({"user_id": str(admin["_id"]), "action": "member.end_sessions"})
    assert audit and "signed out of every device (2 sessions)" in audit["detail"]
    await db["activity_log"].delete_many({"user_id": str(admin["_id"])})


async def test_a_staff_edit_that_keeps_her_email_ends_nothing(api):
    client, db, created = api
    tag = uuid.uuid4().hex[:10]
    member = {"full_name": f"Member {tag}", "email": f"ctest-m-{tag}@example.com",
              "phone": "+919822222222", "status": "Active", "role": "Member",
              "created_at": datetime.now(timezone.utc)}
    res = await db["members"].insert_one(member)
    created["members"].append(res.inserted_id)
    her = await _user(db, created, member_id=str(res.inserted_id), phone="+919822222222")
    await db["users"].update_one({"_id": her["_id"]}, {"$set": {"email": member["email"]}})
    admin = await _user(db, created, role="Super Admin", phone="")
    admin_tokens = await sessions.start(None, admin)
    one = await sessions.start(None, await db["users"].find_one({"_id": her["_id"]}))

    edited = await client.patch(f"/members/{res.inserted_id}",
                                json={"email": member["email"], "phone": "+919822222222", "full_name": "Renamed"},
                                headers=_bearer(admin_tokens))
    assert edited.status_code == 200, edited.text
    assert await _signed_in(client, one)
    await db["activity_log"].delete_many({"user_id": str(admin["_id"])})


async def test_changing_her_phone_on_her_profile_follows_the_same_rule(api):
    """PATCH /me/profile can also change the number; it must not be a side door."""
    client, db, created = api
    user = await _user(db, created, phone=f"+9195{uuid.uuid4().int % 10**8:08d}")
    here = await sessions.start(None, user)
    there = await sessions.start(None, user)

    # Name only: nothing ends.
    renamed = await client.patch("/me/profile", json={"full_name": "New Name"}, headers=_bearer(here))
    assert renamed.status_code == 200, renamed.text
    assert await _signed_in(client, there)

    new_phone = f"+9194{uuid.uuid4().int % 10**8:08d}"
    changed = await client.patch("/me/profile", json={"phone": new_phone}, headers=_bearer(here))
    assert changed.status_code == 200, changed.text
    assert not await _signed_in(client, there)
    assert not await _refreshes(client, there)
    assert await _signed_in(client, here)
    fresh = await db["users"].find_one({"_id": user["_id"]})
    assert fresh["phone"] == new_phone and fresh["phone_verified_at"] is None
    await db["activity_log"].delete_many({"user_id": str(user["_id"])})


async def test_a_staff_member_changing_her_own_phone_keeps_this_device(api):
    client, db, created = api
    staff = await _user(db, created, role="Super Admin", phone=f"+9193{uuid.uuid4().int % 10**8:08d}")
    here = await sessions.start(None, staff)
    there = await sessions.start(None, staff)
    new_phone = f"+9192{uuid.uuid4().int % 10**8:08d}"
    changed = await client.put("/staff/profile", json={"phone": new_phone}, headers=_bearer(here))
    assert changed.status_code == 200, changed.text
    assert not await _signed_in(client, there)
    assert await _signed_in(client, here)
    await db["activity_log"].delete_many({"user_id": str(staff["_id"])})
