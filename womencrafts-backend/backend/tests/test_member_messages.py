"""
Message ids, edit and pin on a member's conversations.

The pure half runs everywhere. The API half runs against the throwaway local
mongod on 127.0.0.1:27099 (see conftest) and skips cleanly without it; every
row it writes carries this run's marker and is removed by id afterwards.
"""

import uuid
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from bson import ObjectId

from app.core import cache, ratelimit, sessions
from app.core.config import settings
from app.db import mongodb
from app.models.member_conversation import MemberConversationModel as Conv
from tests.conftest import LOCAL_MONGO_DB

MARK = "msgtest"


# ── pure ────────────────────────────────────────────────────────────────────

def test_new_bubbles_carry_an_id_and_no_edit():
    b = Conv.bubble(direction="out", text="hello")
    assert len(b["id"]) == 32 and b["edited_at"] is None
    assert Conv.bubble(direction="in", text="x", bubble_id="abc")["id"] == "abc"


def test_missing_ids_backfills_positionally_and_leaves_existing_ones():
    rows = [{"id": "keep", "dir": "in"}, {"dir": "out"}, {"dir": "in", "id": ""}]
    patch = Conv.missing_ids(rows)
    assert set(patch) == {"messages.1.id", "messages.2.id"}
    assert rows[0]["id"] == "keep" and rows[1]["id"] == patch["messages.1.id"]
    assert Conv.missing_ids(rows) == {}


def test_editable_is_own_text_inside_fifteen_minutes():
    now = datetime.now(timezone.utc)
    fresh = {"dir": "out", "text": "hi", "at": now - timedelta(minutes=14)}
    assert Conv.editable(fresh, now)
    # Naive datetimes come back from Motor; they are UTC.
    assert Conv.editable({**fresh, "at": (now - timedelta(minutes=1)).replace(tzinfo=None)}, now)
    assert not Conv.editable({**fresh, "at": now - timedelta(minutes=16)}, now)
    assert not Conv.editable({**fresh, "dir": "in"}, now)
    assert not Conv.editable({**fresh, "order": {"title": "x"}}, now)


def test_response_marks_pinned_bubbles_and_lists_pins():
    doc = {"_id": ObjectId(), "messages": [{"id": "a", "dir": "in", "text": "x"},
                                           {"id": "b", "dir": "out", "text": "y"}],
           "pinned": ["b"]}
    out = Conv.to_response(doc, with_messages=True)
    assert out["pinned"] == ["b"]
    assert [m["pinned"] for m in out["messages"]] == [False, True]


# ── against the local mongod ────────────────────────────────────────────────

@pytest.fixture
async def api(local_mongo, monkeypatch):
    monkeypatch.setattr(settings, "DB_NAME", LOCAL_MONGO_DB)
    monkeypatch.setattr(settings, "REDIS_URL", "")
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    mongodb._client, mongodb._db = local_mongo, None
    cache.clear()
    ratelimit._hits.clear()
    db = mongodb.get_database()
    monkeypatch.setattr(ratelimit, "db_provider", lambda: db)
    from main import app

    created: dict[str, list] = {"users": [], "members": [], "member_conversations": []}
    transport = httpx.ASGITransport(app=app)
    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://test/api/v1") as client:
            yield client, db, created
    finally:
        uids = [str(i) for i in created["users"] if i]
        assert all(isinstance(i, ObjectId) for i in created["users"])
        if uids:
            await db[sessions.COLLECTION].delete_many({"user_id": {"$in": uids}})
        for coll, ids in created.items():
            ids = [i for i in ids if i]
            assert all(isinstance(i, ObjectId) for i in ids)
            if ids:
                await db[coll].delete_many({"_id": {"$in": ids}})
        cache.clear()
        ratelimit._hits.clear()
        mongodb._client, mongodb._db = None, None


async def _member(db, created) -> tuple[dict, dict]:
    tag = uuid.uuid4().hex[:10]
    now = datetime.now(timezone.utc)
    m = await db["members"].insert_one({"full_name": f"{MARK} {tag}", "email": f"{MARK}-{tag}@example.com",
                                        "role": "Member", "status": "Active", "created_at": now})
    created["members"].append(m.inserted_id)
    user = {"full_name": f"{MARK} {tag}", "email": f"{MARK}-{tag}@example.com",
            "phone": f"+9197{uuid.uuid4().int % 10**8:08d}", "email_verified_at": now,
            "role": "Member", "is_active": True, "token_version": 0, "verification_status": "active",
            "member_id": str(m.inserted_id), "created_at": now, "updated_at": now}
    u = await db["users"].insert_one(user)
    created["users"].append(u.inserted_id)
    user["_id"] = u.inserted_id
    tokens = await sessions.start(None, user)
    return user, {"Authorization": f"Bearer {tokens['access_token']}"}


async def _pair(db, created, a: dict, b: dict, messages_a=None, messages_b=None) -> tuple[str, str]:
    """A member-to-member thread: two documents naming each other."""
    da = Conv.create_document(member_id=str(a["_id"]), kind="seller", name=b["full_name"],
                              with_user_id=str(b["_id"]), messages=messages_a)
    db_ = Conv.create_document(member_id=str(b["_id"]), kind="buyer", name=a["full_name"],
                               with_user_id=str(a["_id"]), messages=messages_b)
    ra = await db[Conv.collection_name].insert_one(da)
    rb = await db[Conv.collection_name].insert_one(db_)
    created["member_conversations"] += [ra.inserted_id, rb.inserted_id]
    await db[Conv.collection_name].update_one({"_id": ra.inserted_id}, {"$set": {"counterpart_id": str(rb.inserted_id)}})
    await db[Conv.collection_name].update_one({"_id": rb.inserted_id}, {"$set": {"counterpart_id": str(ra.inserted_id)}})
    return str(ra.inserted_id), str(rb.inserted_id)


async def test_send_gives_both_copies_the_same_id_and_edit_mirrors(api):
    client, db, created = api
    a, ha = await _member(db, created)
    b, hb = await _member(db, created)
    ca, cb = await _pair(db, created, a, b)

    r = await client.post(f"/me/conversations/{ca}/messages", json={"text": "Price is **280**"}, headers=ha)
    assert r.status_code == 200, r.text
    mid = r.json()["messages"][-1]["id"]
    assert mid

    theirs = (await client.get(f"/me/conversations/{cb}", headers=hb)).json()["messages"]
    assert theirs[-1]["id"] == mid and theirs[-1]["dir"] == "in"

    r = await client.patch(f"/me/conversations/{ca}/messages/{mid}", json={"text": "Price is **300**"}, headers=ha)
    assert r.status_code == 200, r.text
    mine = r.json()["messages"][-1]
    assert mine["text"] == "Price is **300**" and mine["edited_at"]

    theirs = (await client.get(f"/me/conversations/{cb}", headers=hb)).json()["messages"]
    assert theirs[-1]["text"] == "Price is **300**" and theirs[-1]["edited_at"]


async def test_edit_refuses_her_messages_other_threads_and_old_ones(api):
    client, db, created = api
    a, ha = await _member(db, created)
    b, hb = await _member(db, created)
    ca, cb = await _pair(db, created, a, b)
    mid = (await client.post(f"/me/conversations/{ca}/messages", json={"text": "hi"}, headers=ha)).json()["messages"][-1]["id"]

    # The recipient cannot edit the mirrored copy — it is an incoming bubble there.
    r = await client.patch(f"/me/conversations/{cb}/messages/{mid}", json={"text": "changed"}, headers=hb)
    assert r.status_code == 403
    # Nor can she reach the sender's document at all.
    r = await client.patch(f"/me/conversations/{ca}/messages/{mid}", json={"text": "changed"}, headers=hb)
    assert r.status_code == 404
    # Unknown message id.
    r = await client.patch(f"/me/conversations/{ca}/messages/nope", json={"text": "x"}, headers=ha)
    assert r.status_code == 404
    # Too long.
    r = await client.patch(f"/me/conversations/{ca}/messages/{mid}", json={"text": "x" * 4001}, headers=ha)
    assert r.status_code == 422

    # Past the window.
    old = datetime.now(timezone.utc) - timedelta(minutes=16)
    await db[Conv.collection_name].update_one(
        {"_id": ObjectId(ca)}, {"$set": {"messages.$[b].at": old}}, array_filters=[{"b.id": mid}])
    r = await client.patch(f"/me/conversations/{ca}/messages/{mid}", json={"text": "late"}, headers=ha)
    assert r.status_code == 403
    assert "15 minutes" in r.json().get("detail", "") or "15 minutes" in r.text


async def test_old_bubbles_get_ids_on_read_and_keep_them(api):
    client, db, created = api
    a, ha = await _member(db, created)
    legacy = [{"dir": "in", "text": "old one", "file": None, "order": None,
               "at": datetime.now(timezone.utc) - timedelta(days=2), "read": True}]
    doc = Conv.create_document(member_id=str(a["_id"]), kind="buyer", name=f"{MARK} buyer", messages=legacy)
    res = await db[Conv.collection_name].insert_one(doc)
    created["member_conversations"].append(res.inserted_id)

    first = (await client.get(f"/me/conversations/{res.inserted_id}", headers=ha)).json()["messages"][0]["id"]
    again = (await client.get(f"/me/conversations/{res.inserted_id}", headers=ha)).json()["messages"][0]["id"]
    assert first and first == again


async def test_pins_cap_at_three_and_unpin(api):
    client, db, created = api
    a, ha = await _member(db, created)
    b, _ = await _member(db, created)
    ca, _cb = await _pair(db, created, a, b)
    ids = []
    for i in range(4):
        r = await client.post(f"/me/conversations/{ca}/messages", json={"text": f"m{i}"}, headers=ha)
        ids.append(r.json()["messages"][-1]["id"])

    for mid in ids[:3]:
        r = await client.post(f"/me/conversations/{ca}/messages/{mid}/pin", headers=ha)
        assert r.status_code == 200, r.text
    assert r.json()["pinned"] == ids[:3]
    # Pinning again is a no-op, not a fourth pin.
    assert (await client.post(f"/me/conversations/{ca}/messages/{ids[0]}/pin", headers=ha)).status_code == 200

    r = await client.post(f"/me/conversations/{ca}/messages/{ids[3]}/pin", headers=ha)
    assert r.status_code == 409

    r = await client.delete(f"/me/conversations/{ca}/messages/{ids[0]}/pin", headers=ha)
    assert r.status_code == 200 and r.json()["pinned"] == ids[1:3]
    r = await client.post(f"/me/conversations/{ca}/messages/{ids[3]}/pin", headers=ha)
    assert r.status_code == 200 and r.json()["pinned"] == [ids[1], ids[2], ids[3]]
    assert [m["pinned"] for m in r.json()["messages"]] == [False, True, True, True]

    # Unknown message cannot be pinned.
    assert (await client.post(f"/me/conversations/{ca}/messages/nope/pin", headers=ha)).status_code == 404
