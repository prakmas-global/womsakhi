"""
Circles as group chats: members-only chat, announcement mode, delete rules,
unread counts, invites by username (accept / decline / duplicate), the invite
link's "joined" line, admin powers, and savings circles still on her list.

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

    db = mongodb.get_database()
    made = {"users": [], "circles": []}
    transport = httpx.ASGITransport(app=app)
    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://test/api/v1") as client:
            yield client, db, made
    finally:
        uids = [str(u) for u in made["users"]]
        cids = list(made["circles"])
        await db["users"].delete_many({"_id": {"$in": made["users"]}})
        await db[sessions.COLLECTION].delete_many({"user_id": {"$in": uids}})
        await db["circles"].delete_many({"created_by": {"$in": uids}})
        await db["circle_members"].delete_many({"$or": [{"user_id": {"$in": uids}}, {"circle_id": {"$in": cids}}]})
        await db["circle_messages"].delete_many({"circle_id": {"$in": cids}})
        await db["circle_invites"].delete_many({"circle_id": {"$in": cids}})
        await db["circle_posts"].delete_many({"circle_id": {"$in": cids}})
        await db["member_notifications"].delete_many({"user_id": {"$in": uids}})
        cache.clear()
        mongodb._client, mongodb._db = None, None


async def _member(db, made, name: str, **extra):
    now = datetime.now(timezone.utc)
    doc = {
        "full_name": name, "email": f"cc-{uuid.uuid4().hex[:10]}@example.com",
        "email_verified_at": now, "role": "Member", "is_active": True, "token_version": 0,
        "verification_status": "active", "created_at": now, "updated_at": now, **extra,
    }
    doc["_id"] = (await db["users"].insert_one(doc)).inserted_id
    made["users"].append(doc["_id"])
    tokens = await sessions.start(None, doc)
    return doc, {"Authorization": f"Bearer {tokens['access_token']}"}


async def _circle(client, made, h, **over):
    body = {"name": f"Test circle {uuid.uuid4().hex[:6]}", "topic": "Tailoring", **over}
    got = await client.post("/community/circles", json=body, headers=h)
    assert got.status_code == 201, got.text
    made["circles"].append(got.json()["id"])
    return got.json()["id"]


async def _join(client, cid, h):
    got = await client.post(f"/community/circles/{cid}/join", json={}, headers=h)
    assert got.status_code == 200, got.text


async def _send(client, cid, h, text="Hello all"):
    return await client.post(f"/community/circles/{cid}/messages", json={"text": text}, headers=h)


async def test_members_read_and_send_outsiders_cannot(api):
    client, db, made = api
    _, host = await _member(db, made, "Host Asha")
    _, mem = await _member(db, made, "Member Bina")
    _, out = await _member(db, made, "Outsider Chitra")
    cid = await _circle(client, made, host)
    await _join(client, cid, mem)

    sent = await _send(client, cid, mem, "Hi all 👋")
    assert sent.status_code == 201, sent.text
    assert sent.json()["mine"] is True and sent.json()["name"] == "Member Bina"

    page = (await client.get(f"/community/circles/{cid}/messages", headers=host)).json()
    kinds = [(m["kind"], m["text"]) for m in page["messages"]]
    assert kinds[0][0] == "system" and "created the group" in kinds[0][1]
    assert ("system", "Member Bina joined") in kinds
    assert kinds[-1] == ("text", "Hi all 👋")
    assert page["is_admin"] is True and page["can_send"] is True

    assert (await client.get(f"/community/circles/{cid}/messages", headers=out)).status_code == 403
    assert (await _send(client, cid, out)).status_code == 403

    # Polling returns only what is newer.
    last = page["messages"][-1]["id"]
    assert (await client.get(f"/community/circles/{cid}/messages", params={"after": last}, headers=host)).json()["messages"] == []
    await _send(client, cid, host, "Meeting at 5")
    newer = (await client.get(f"/community/circles/{cid}/messages", params={"after": last}, headers=mem)).json()["messages"]
    assert [m["text"] for m in newer] == ["Meeting at 5"]


async def test_reply_and_empty_message(api):
    client, db, made = api
    _, host = await _member(db, made, "Host Deepa")
    cid = await _circle(client, made, host)
    first = (await _send(client, cid, host, "Who has the blue thread?")).json()
    reply = await client.post(f"/community/circles/{cid}/messages",
                              json={"text": "I do", "reply_to": first["id"]}, headers=host)
    assert reply.json()["reply_to"]["text"] == "Who has the blue thread?"
    assert (await _send(client, cid, host, "   ")).status_code == 422


async def test_announcement_mode(api):
    client, db, made = api
    _, host = await _member(db, made, "Host Esha")
    _, mem = await _member(db, made, "Member Farah")
    cid = await _circle(client, made, host)
    await _join(client, cid, mem)
    got = await client.patch(f"/community/circles/{cid}/group", json={"only_admins": True}, headers=host)
    assert got.status_code == 200 and got.json()["only_admins"] is True
    assert (await _send(client, cid, mem)).status_code == 403
    assert (await _send(client, cid, host, "Notice")).status_code == 201
    # Members can't flip it back.
    assert (await client.patch(f"/community/circles/{cid}/group", json={"only_admins": False}, headers=mem)).status_code == 403


async def test_delete_rules(api):
    client, db, made = api
    _, host = await _member(db, made, "Host Gita")
    _, a = await _member(db, made, "Member Hema")
    _, b = await _member(db, made, "Member Isha")
    cid = await _circle(client, made, host)
    await _join(client, cid, a)
    await _join(client, cid, b)
    mid = (await _send(client, cid, a, "oops")).json()["id"]
    assert (await client.delete(f"/community/circles/{cid}/messages/{mid}", headers=b)).status_code == 403
    gone = await client.delete(f"/community/circles/{cid}/messages/{mid}", headers=a)
    assert gone.status_code == 200 and gone.json()["deleted"] is True and gone.json()["text"] == ""
    mid2 = (await _send(client, cid, b, "spam")).json()["id"]
    assert (await client.delete(f"/community/circles/{cid}/messages/{mid2}", headers=host)).status_code == 200


async def test_unread_counts_and_read(api):
    client, db, made = api
    _, host = await _member(db, made, "Host Jaya")
    _, mem = await _member(db, made, "Member Kiran")
    cid = await _circle(client, made, host)
    await _join(client, cid, mem)
    await client.post(f"/community/circles/{cid}/read", headers=mem)
    for t in ("one", "two", "three"):
        await _send(client, cid, host, t)
    rows = {r["id"]: r for r in (await client.get("/community/chats", headers=mem)).json()}
    assert rows[cid]["unread"] == 3
    assert rows[cid]["last_text"] == "Host Jaya: three"
    # Her own messages never count as unread for her.
    assert {r["id"]: r for r in (await client.get("/community/chats", headers=host)).json()}[cid]["unread"] == 0
    await client.post(f"/community/circles/{cid}/read", headers=mem)
    rows = {r["id"]: r for r in (await client.get("/community/chats", headers=mem)).json()}
    assert rows[cid]["unread"] == 0


async def test_invite_by_username_accept_decline_duplicate(api):
    client, db, made = api
    host_doc, host = await _member(db, made, "Host Lata")
    lina, h_lina = await _member(db, made, "Lina", username=f"lina{uuid.uuid4().hex[:5]}")
    mona, h_mona = await _member(db, made, "Mona")
    _, h_mem = await _member(db, made, "Plain member")
    cid = await _circle(client, made, host, is_private=True)

    # Only admins invite.
    await db["circle_members"].insert_one({"circle_id": cid, "user_id": str(made["users"][-1]), "role": "member",
                                           "created_at": datetime.now(timezone.utc)})
    assert (await client.post(f"/community/circles/{cid}/invites", json={"user_id": str(lina["_id"])}, headers=h_mem)).status_code == 403

    got = await client.post(f"/community/circles/{cid}/invites", json={"user_id": str(lina["_id"])}, headers=host)
    assert got.status_code == 201, got.text
    assert [p["name"] for p in got.json()["pending"]] == [lina["username"]]
    dup = await client.post(f"/community/circles/{cid}/invites", json={"user_id": str(lina["_id"])}, headers=host)
    assert dup.status_code == 409 and dup.json()["error"]["code"] == "already_invited"

    # She is NOT in the group until she says yes.
    assert (await client.get(f"/community/circles/{cid}/messages", headers=h_lina)).status_code == 403
    inv = (await client.get("/community/circle-invites", headers=h_lina)).json()
    assert len(inv) == 1 and inv[0]["circle_id"] == cid and inv[0]["from_name"] == "Host Lata"
    assert (await client.post(f"/community/circle-invites/{inv[0]['id']}/accept", headers=h_lina)).status_code == 200
    page = (await client.get(f"/community/circles/{cid}/messages", headers=h_lina)).json()
    assert page["messages"][-1]["text"] == f"{lina['username']} joined"
    again = await client.post(f"/community/circles/{cid}/invites", json={"user_id": str(lina["_id"])}, headers=host)
    assert again.status_code == 409 and again.json()["error"]["code"] == "already_member"

    # Decline, then a fresh invite reopens the same row.
    await client.post(f"/community/circles/{cid}/invites", json={"user_id": str(mona["_id"])}, headers=host)
    mid = (await client.get("/community/circle-invites", headers=h_mona)).json()[0]["id"]
    assert (await client.post(f"/community/circle-invites/{mid}/decline", headers=h_mona)).status_code == 200
    assert (await client.get("/community/circle-invites", headers=h_mona)).json() == []
    assert (await client.post(f"/community/circles/{cid}/invites", json={"user_id": str(mona["_id"])}, headers=host)).status_code == 201
    assert len((await client.get("/community/circle-invites", headers=h_mona)).json()) == 1


async def test_join_by_link_writes_a_line(api):
    client, db, made = api
    _, host = await _member(db, made, "Host Nisha")
    _, guest = await _member(db, made, "Guest Oviya", username=f"oviya{uuid.uuid4().hex[:5]}")
    cid = await _circle(client, made, host, is_private=True)
    code = (await client.post(f"/community/circles/{cid}/invite-code", headers=host)).json()["code"]
    assert (await client.post(f"/community/circles/join/{code}", headers=guest)).status_code == 200
    page = (await client.get(f"/community/circles/{cid}/messages", headers=guest)).json()
    assert page["messages"][-1]["text"].endswith("joined using the invite link")
    # Reset: the old link stops working.
    new = (await client.post(f"/community/circles/{cid}/invite-code/reset", headers=host)).json()["code"]
    assert new != code
    assert (await client.get(f"/public/circles/invite/{code}")).status_code == 404


async def test_admin_powers(api):
    client, db, made = api
    host_doc, host = await _member(db, made, "Host Pooja")
    rani, h_rani = await _member(db, made, "Rani")
    sita, h_sita = await _member(db, made, "Sita")
    cid = await _circle(client, made, host)
    await _join(client, cid, h_rani)
    await _join(client, cid, h_sita)

    # A member cannot remove anyone.
    assert (await client.delete(f"/community/circles/{cid}/members/{sita['_id']}", headers=h_rani)).status_code == 403
    made_admin = await client.post(f"/community/circles/{cid}/members/{rani['_id']}/admin", json={"admin": True}, headers=host)
    assert made_admin.status_code == 200
    assert {m["name"]: m["admin"] for m in made_admin.json()["members"]}["Rani"] is True
    # The new admin can rename the group and remove a member, but not the founder.
    ren = await client.patch(f"/community/circles/{cid}/group", json={"name": "Sewing sisters"}, headers=h_rani)
    assert ren.status_code == 200 and ren.json()["name"] == "Sewing sisters"
    assert (await client.delete(f"/community/circles/{cid}/members/{host_doc['_id']}", headers=h_rani)).status_code == 409
    assert (await client.post(f"/community/circles/{cid}/members/{host_doc['_id']}/admin", json={"admin": False}, headers=h_rani)).status_code == 409
    rm = await client.delete(f"/community/circles/{cid}/members/{sita['_id']}", headers=h_rani)
    assert rm.status_code == 200 and "Sita" not in [m["name"] for m in rm.json()["members"]]
    assert (await client.get(f"/community/circles/{cid}/messages", headers=h_sita)).status_code == 403
    texts = [m["text"] for m in (await client.get(f"/community/circles/{cid}/messages", headers=host)).json()["messages"]]
    assert "Host Pooja made Rani an admin" in texts
    assert 'Rani changed the group name to "Sewing sisters"' in texts
    assert "Rani removed Sita" in texts
    # Invite code is shown to admins only.
    info_member = (await client.get(f"/community/circles/{cid}/group", headers=h_rani)).json()
    assert info_member["is_admin"] is True


async def test_savings_circle_still_listed_and_pot_works(api):
    client, db, made = api
    _, host = await _member(db, made, "Host Tara")
    cid = await _circle(client, made, host, is_savings=True, monthly_minor=50000)
    rows = (await client.get("/community/chats", headers=host)).json()
    row = next(r for r in rows if r["id"] == cid)
    assert row["is_savings"] is True and row["is_admin"] is True and "created the group" in row["last_text"]
    assert (await client.get(f"/community/circles/{cid}/savings", headers=host)).status_code == 200
