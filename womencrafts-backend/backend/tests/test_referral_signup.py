"""
Refer a friend: `/signup?ref=CODE` is recorded, and her count goes up.

Runs the app in-process against the throwaway local mongod on 127.0.0.1:27099
(skipped when it is not running — never the cluster in `.env`). Every account
has a random address and every referrer a random code; cleanup deletes only
rows this module wrote, by id or by those random values.
"""

import random
import re
import uuid
from datetime import datetime, timezone

import httpx
import pytest
from bson import ObjectId

from app.core import cache, codes, ratelimit, sessions
from app.core.config import settings
from app.db import mongodb
from tests.conftest import LOCAL_MONGO_DB

FIXED = "482913"
_UNSET = object()


def _ip() -> str:
    return f"198.51.{random.randint(0, 255)}.{random.randint(1, 254)}"


def _tag() -> str:
    return uuid.uuid4().hex[:10]


def _phone() -> str:
    return f"+9197{uuid.uuid4().int % 10**8:08d}"


@pytest.fixture
async def api(local_mongo, monkeypatch):
    monkeypatch.setattr(settings, "DB_NAME", LOCAL_MONGO_DB)
    monkeypatch.setattr(settings, "REDIS_URL", "")
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "file")
    monkeypatch.setattr(settings, "PHONE_CODES_ENABLED", False)
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 1)
    monkeypatch.setattr(settings, "TEST_LOGIN_ALLOW_STAFF", False)
    monkeypatch.setattr(settings, "TEST_LOGIN_CODE", FIXED)
    monkeypatch.setattr(settings, "TEST_LOGIN_EMAILS", "")
    mongodb._client, mongodb._db = local_mongo, None
    cache.clear()
    ratelimit._hits.clear()

    sent: list[tuple[str, str, str]] = []

    async def _capture(channel, destination, code, purpose, name="", template=""):
        sent.append((channel, destination, code))
        return True

    monkeypatch.setattr(codes, "_deliver", _capture)

    from main import app

    db = mongodb.get_database()
    made = {"users": [], "members": [], "addresses": []}
    transport = httpx.ASGITransport(app=app)

    def client():
        return httpx.AsyncClient(transport=transport, base_url="http://test/api/v1",
                                 headers={"X-Forwarded-For": _ip()})

    try:
        yield client, db, made, sent
    finally:
        ids = [i for i in made["users"] if isinstance(i, ObjectId)]
        user_ids = [str(i) for i in ids]
        addresses = [a for a in made["addresses"] if a and ("@example.com" in a or a.startswith("+91"))]
        if ids:
            await db["users"].delete_many({"_id": {"$in": ids}})
            await db[sessions.COLLECTION].delete_many({"user_id": {"$in": user_ids}})
            await db["activity_log"].delete_many({"user_id": {"$in": user_ids}})
        members = [i for i in made["members"] if isinstance(i, ObjectId)]
        if members:
            await db["members"].delete_many({"_id": {"$in": members}})
        if addresses:
            await db[codes.COLLECTION].delete_many({"destination": {"$in": addresses}})
        mongodb._client, mongodb._db = None, None
        ratelimit._hits.clear()


async def _referrer(db, made, *, code=_UNSET) -> dict:
    """An admitted member with a member row and (unless told otherwise) an invite code of her own."""
    tag = _tag()
    now = datetime.now(timezone.utc)
    email, phone = f"ref-{tag}@example.com", _phone()
    if code is _UNSET:
        code = f"WC-T{tag[:8].upper()}"
    row = {"full_name": f"Referrer {tag}", "email": email, "phone": phone,
           "role": "Member", "status": "Active", "created_at": now, "updated_at": now}
    if code is not None:  # None: no `code` field at all
        row["code"] = code
    member = await db["members"].insert_one(row)
    made["members"].append(member.inserted_id)
    user = {
        "full_name": f"Referrer {tag}", "email": email, "phone": phone, "member_id": str(member.inserted_id),
        "phone_verified_at": now, "email_verified_at": now, "role": "Member", "is_active": True,
        "token_version": 0, "verification_status": "active", "created_at": now, "updated_at": now,
    }
    res = await db["users"].insert_one(user)
    user["_id"] = res.inserted_id
    made["users"].append(res.inserted_id)
    made["addresses"] += [email, phone]
    return {**user, "code": code}


async def _count(client_factory, monkeypatch, referrer: dict) -> dict:
    """Her own `/me/referrals`, signed in as her."""
    monkeypatch.setattr(settings, "TEST_LOGIN_EMAILS", referrer["email"])
    cache.clear()
    async with client_factory() as c:
        assert (await c.post("/auth/signin/start", json={"email": referrer["email"]})).status_code == 200
        got = await c.post("/auth/signin/verify", json={"email": referrer["email"], "code": FIXED})
        assert got.status_code == 200, got.text
        mine = await c.get("/me/referrals")
        assert mine.status_code == 200, mine.text
        return mine.json()


async def _join(client_factory, db, made, sent, *, ref=_UNSET, email=None) -> tuple[httpx.Response, dict | None, str]:
    """Sign up through the email code; returns the complete answer, the user row and the ticket."""
    email = email or f"new-{_tag()}@example.com"
    phone = _phone()
    made["addresses"] += [email, phone]
    async with client_factory() as c:
        start = await c.post("/auth/signup/start", json={"email": email, "phone": phone})
        assert start.status_code == 200, start.text
        ticket = await c.post("/auth/signup/verify", json={"email": email, "code": sent[-1][2]})
        assert ticket.status_code == 200, ticket.text
        body = {"ticket": ticket.json()["ticket"], "full_name": "New Friend", "is_woman_18_plus": True}
        if ref is not _UNSET:
            body["ref"] = ref
        done = await c.post("/auth/signup/complete", json=body)
    row = await db["users"].find_one({"email": email})
    if row:
        made["users"].append(row["_id"])
        if row.get("member_id"):
            made["members"].append(ObjectId(row["member_id"]))
    return done, row, ticket.json()["ticket"]


async def test_a_valid_ref_is_stored_and_her_count_goes_up(api, monkeypatch):
    client, db, made, sent = api
    her = await _referrer(db, made)
    before = await _count(client, monkeypatch, her)
    assert before["code"] == her["code"]
    assert before["invited"] == 0

    # The link carries the code; lower case and stray spaces still count.
    done, row, _ = await _join(client, db, made, sent, ref=f"  {her['code'].lower()} ")
    assert done.status_code == 201, done.text
    assert row["referred_by"] == her["code"]

    after = await _count(client, monkeypatch, her)
    assert after["invited"] == 1
    assert after["joined"] == 0  # she is still pending documents


@pytest.mark.parametrize("ref", ["", "   ", "WC-NOSUCHCODE", "not a code!", "x" * 40, "y" * 5000, 12345, None])
async def test_an_unknown_or_empty_ref_is_ignored(api, ref):
    client, db, made, sent = api
    done, row, _ = await _join(client, db, made, sent, ref=ref)
    assert done.status_code == 201, done.text
    assert "referred_by" not in row


async def test_no_ref_at_all_still_joins(api):
    client, db, made, sent = api
    done, row, _ = await _join(client, db, made, sent)
    assert done.status_code == 201, done.text
    assert "referred_by" not in row


async def test_her_own_code_is_ignored(api):
    """A member row with her own email (e.g. added by staff) cannot refer her."""
    client, db, made, sent = api
    email = f"self-{_tag()}@example.com"
    now = datetime.now(timezone.utc)
    code = f"WC-S{_tag()[:8].upper()}"
    m = await db["members"].insert_one({"full_name": "Self", "email": email, "code": code,
                                        "created_at": now, "updated_at": now})
    made["members"].append(m.inserted_id)
    done, row, _ = await _join(client, db, made, sent, ref=code, email=email)
    assert done.status_code == 201, done.text
    assert "referred_by" not in row


async def test_a_ref_cannot_be_applied_twice(api, monkeypatch):
    client, db, made, sent = api
    first, second = await _referrer(db, made), await _referrer(db, made)
    done, row, ticket = await _join(client, db, made, sent, ref=first["code"])
    assert done.status_code == 201, done.text

    # Replaying the same ticket with another code creates nothing and changes nothing.
    async with client() as c:
        again = await c.post("/auth/signup/complete", json={
            "ticket": ticket, "full_name": "New Friend", "is_woman_18_plus": True, "ref": second["code"]})
    assert again.status_code == 409, again.text
    assert await db["users"].count_documents({"email": row["email"]}) == 1
    assert (await db["users"].find_one({"_id": row["_id"]}))["referred_by"] == first["code"]

    # And the same code a second time counts the woman once, not twice.
    assert (await _count(client, monkeypatch, first))["invited"] == 1
    assert (await _count(client, monkeypatch, second))["invited"] == 0


# ── a member row with no code gets a real one ──────────────────────────────


@pytest.mark.parametrize("missing", [None, ""])
async def test_a_member_without_a_code_is_given_a_real_one(api, monkeypatch, missing):
    client, db, made, sent = api
    her = await _referrer(db, made, code=missing)
    member_oid = ObjectId(her["member_id"])

    first = await _count(client, monkeypatch, her)
    assert re.fullmatch(r"WC-\d{5,}", first["code"]), first
    assert first["link"].endswith(f"/signup?ref={first['code']}")
    assert first["code"] in first["message"]
    assert first["code"] != her["member_id"][-6:].upper()  # never the stand-in
    assert (await db["members"].find_one({"_id": member_oid}))["code"] == first["code"]
    assert await db["members"].count_documents({"code": first["code"]}) == 1

    # The same code the second time, not a fresh one.
    second = await _count(client, monkeypatch, her)
    assert second["code"] == first["code"]

    # And a friend who signs up with it is counted.
    done, row, _ = await _join(client, db, made, sent, ref=first["code"])
    assert done.status_code == 201, done.text
    assert row["referred_by"] == first["code"]
    assert (await _count(client, monkeypatch, her))["invited"] == 1


async def test_parallel_first_calls_mint_one_code(api):
    """Two of her requests at once end with one code, and both are told that one."""
    import asyncio

    from app.routes.me import _ensure_member_code

    client, db, made, sent = api
    her = await _referrer(db, made, code=None)
    member_oid = ObjectId(her["member_id"])
    got = await asyncio.gather(*[_ensure_member_code(member_oid) for _ in range(6)])
    stored = (await db["members"].find_one({"_id": member_oid}))["code"]
    assert stored and set(got) == {stored}


async def test_two_members_minting_at_once_get_different_codes(api):
    import asyncio

    from app.routes.me import _ensure_member_code

    client, db, made, sent = api
    a, b = await _referrer(db, made, code=None), await _referrer(db, made, code=None)
    codes_ = await asyncio.gather(_ensure_member_code(ObjectId(a["member_id"])),
                                  _ensure_member_code(ObjectId(b["member_id"])))
    assert all(codes_) and codes_[0] != codes_[1]
