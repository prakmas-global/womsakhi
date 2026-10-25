"""
The one-screen way in: `/auth/start`, then `/auth/verify` — which signs a known
woman in, or creates the account for a new address there and then. Plus adding
an email later (`/auth/email/start`, `/auth/email/verify`).

Runs the app in-process against the throwaway local mongod on 127.0.0.1:27099
(skipped when it is not running — never the cluster in `.env`). Every address
is random and cleanup deletes only rows this module wrote.
"""

import random
import uuid
from datetime import datetime, timezone

import httpx
import pytest
from bson import ObjectId

from app.core import cache, codes, ratelimit, sessions
from app.core.config import settings
from app.db import mongodb
from tests.conftest import LOCAL_MONGO_DB


def _ip() -> str:
    return f"198.51.{random.randint(0, 255)}.{random.randint(1, 254)}"


def _email() -> str:
    return f"one-{uuid.uuid4().hex[:10]}@example.com"


def _digits() -> str:
    return f"98{uuid.uuid4().int % 10**8:08d}"


@pytest.fixture
async def api(local_mongo, monkeypatch):
    monkeypatch.setattr(settings, "DB_NAME", LOCAL_MONGO_DB)
    monkeypatch.setattr(settings, "REDIS_URL", "")
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "file")
    monkeypatch.setattr(settings, "PHONE_CODES_ENABLED", True)
    monkeypatch.setattr(settings, "PHONE_PROVIDER", "file")
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 1)
    monkeypatch.setattr(settings, "TEST_LOGIN_EMAILS", "")
    monkeypatch.setattr(settings, "SMS_DAILY_LIMIT", 10**6)
    monkeypatch.setattr(settings, "SMS_PER_NUMBER_DAILY", 10**6)
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
    made = {"addresses": []}
    transport = httpx.ASGITransport(app=app)
    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://test/api/v1",
                                     headers={"X-Forwarded-For": _ip()}) as client:
            yield client, db, made, sent
    finally:
        emails = [a for a in made["addresses"] if "@example.com" in a]
        phones = [a for a in made["addresses"] if a.startswith("+91")]
        users = await db["users"].find(
            {"$or": [{"email": {"$in": emails}}, {"phone": {"$in": phones}}]}, {"_id": 1}).to_list(None)
        ids = [u["_id"] for u in users]
        if ids:
            await db["users"].delete_many({"_id": {"$in": ids}})
            await db[sessions.COLLECTION].delete_many({"user_id": {"$in": [str(i) for i in ids]}})
            await db["activity_log"].delete_many({"user_id": {"$in": [str(i) for i in ids]}})
        await db["members"].delete_many({"$or": [{"email": {"$in": emails}}, {"phone": {"$in": phones}}]})
        await db[codes.COLLECTION].delete_many({"destination": {"$in": emails + phones}})
        await db[codes.SMS_LEDGER].delete_many({"destination": {"$in": phones}})
        mongodb._client, mongodb._db = None, None
        ratelimit._hits.clear()


async def _user(db, made, *, role="Member", email=None, phone=None, phone_verified=True,
                signup_proof=None, email_verified=True, two_factor=None) -> dict:
    now = datetime.now(timezone.utc)
    doc = {
        "full_name": "Test Member", "email": email or _email(), "phone": phone or f"+91{_digits()}",
        "phone_verified_at": now if phone_verified else None,
        "email_verified_at": now if email_verified else None,
        "role": role, "is_active": True, "token_version": 0,
        "verification_status": "active", "created_at": now, "updated_at": now,
    }
    if signup_proof:
        doc["signup_proof"] = signup_proof
    if two_factor:
        doc["two_factor"] = two_factor
    res = await db["users"].insert_one(doc)
    doc["_id"] = res.inserted_id
    made["addresses"] += [doc["email"], doc["phone"]]
    return doc


# ── new women ───────────────────────────────────────────────────────────────


async def test_new_email_code_creates_the_account(api):
    client, db, made, sent = api
    email = _email()
    made["addresses"].append(email)
    start = await client.post("/auth/start", json={"email": email})
    assert start.status_code == 200, start.text
    assert start.json()["mode"] == "signup" and start.json()["channel"] == "email"
    assert len(sent) == 1 and sent[0][1] == email

    verified = await client.post("/auth/verify", json={"email": email, "code": sent[0][2], "agreed": True})
    assert verified.status_code == 200, verified.text
    body = verified.json()
    assert body["status"] == "created" and body["access_token"]
    assert body["user"]["verification_status"] == "pending_documents"
    user = await db["users"].find_one({"email": email})
    # Only what the code proved: no name (the reviewer enters it), no mobile yet.
    assert user["full_name"] == "" and user["phone"] == ""
    assert user["email_verified_at"] is not None and user["phone_verified_at"] is None
    assert user["declared_woman_18_plus_at"] is not None and user["signup_proof"] == "email"
    assert body["user"]["phone_action_required"] is False  # asked later, by the reminder
    assert await db[sessions.COLLECTION].find_one({"user_id": str(user["_id"])})


async def test_new_mobile_code_creates_the_account_without_an_email(api):
    client, db, made, sent = api
    phone = f"+91{_digits()}"
    made["addresses"].append(phone)
    start = await client.post("/auth/start", json={"phone": phone[3:]})
    assert start.status_code == 200, start.text
    assert start.json()["mode"] == "signup" and start.json()["channel"] == "sms"
    assert sent and sent[-1][0] == codes.SMS and sent[-1][1] == phone

    verified = await client.post("/auth/verify", json={"phone": phone, "code": sent[-1][2], "agreed": True})
    assert verified.status_code == 200 and verified.json()["status"] == "created", verified.text
    user = await db["users"].find_one({"phone": phone})
    assert user["email"] == "" and user["phone_verified_at"] is not None
    assert user["email_verified_at"] is None and user["signup_proof"] == "phone"


async def test_two_mobile_only_accounts_do_not_collide_on_the_empty_email(api):
    from app.db.indexes import ensure_indexes

    client, db, made, sent = api
    await ensure_indexes()
    for _ in range(2):
        phone = f"+91{_digits()}"
        made["addresses"].append(phone)
        await client.post("/auth/start", json={"phone": phone})
        got = await client.post("/auth/verify", json={"phone": phone, "code": sent[-1][2], "agreed": True})
        assert got.status_code == 200 and got.json()["status"] == "created", got.text
    assert "email_unique" not in await db["users"].index_information()


async def test_a_new_account_needs_the_declaration(api):
    client, db, made, sent = api
    email = _email()
    made["addresses"].append(email)
    await client.post("/auth/start", json={"email": email})
    got = await client.post("/auth/verify", json={"email": email, "code": sent[-1][2]})
    assert got.status_code == 422 and got.json()["error"]["code"] == "declaration_required"
    assert not await db["users"].find_one({"email": email})


async def test_a_mobile_member_adds_her_email_later(api):
    client, db, made, sent = api
    phone = f"+91{_digits()}"
    made["addresses"].append(phone)
    await client.post("/auth/start", json={"phone": phone})
    token = (await client.post("/auth/verify", json={"phone": phone, "code": sent[-1][2], "agreed": True})
             ).json()["access_token"]
    auth = {"Authorization": f"Bearer {token}"}

    taken = await _user(db, made)
    refused = await client.post("/auth/email/start", json={"email": taken["email"]}, headers=auth)
    assert refused.status_code == 409 and refused.json()["error"]["code"] == "email_taken"

    email = _email()
    made["addresses"].append(email)
    start = await client.post("/auth/email/start", json={"email": email}, headers=auth)
    assert start.status_code == 200, start.text
    assert sent[-1][1] == email
    wrong = "000000" if sent[-1][2] != "000000" else "111111"
    assert (await client.post("/auth/email/verify", json={"email": email, "code": wrong}, headers=auth)).status_code == 400
    done = await client.post("/auth/email/verify", json={"email": email, "code": sent[-1][2]}, headers=auth)
    assert done.status_code == 200, done.text
    user = await db["users"].find_one({"phone": phone})
    assert user["email"] == email and user["email_verified_at"] is not None

    # Add only: an address she already has is changed through support.
    again = await client.post("/auth/email/start", json={"email": _email()}, headers=auth)
    assert again.status_code == 409 and again.json()["error"]["code"] == "email_present"


# ── women who already have an account ───────────────────────────────────────


async def test_known_email_signs_in(api):
    client, db, made, sent = api
    her = await _user(db, made)
    start = await client.post("/auth/start", json={"email": her["email"]})
    assert start.json()["mode"] == "signin"
    got = await client.post("/auth/verify", json={"email": her["email"], "code": sent[-1][2]})
    assert got.status_code == 200, got.text
    assert got.json()["status"] == "signed_in" and got.json()["user"]["email"] == her["email"]
    assert await db[sessions.COLLECTION].find_one({"user_id": str(her["_id"])})


async def test_known_confirmed_mobile_signs_in(api):
    client, db, made, sent = api
    her = await _user(db, made)
    start = await client.post("/auth/start", json={"phone": her["phone"][3:]})
    assert start.json()["mode"] == "signin" and start.json()["channel"] == "sms"
    got = await client.post("/auth/verify", json={"phone": her["phone"], "code": sent[-1][2]})
    assert got.status_code == 200 and got.json()["status"] == "signed_in", got.text


async def test_wrong_code_is_an_answer_not_a_sign_in(api):
    client, db, made, sent = api
    her = await _user(db, made)
    await client.post("/auth/start", json={"email": her["email"]})
    wrong = "000000" if sent[-1][2] != "000000" else "111111"
    got = await client.post("/auth/verify", json={"email": her["email"], "code": wrong})
    assert got.status_code == 400 and got.json()["error"]["code"] == "code_wrong"


async def test_staff_email_goes_on_to_the_authenticator(api):
    from app.core.two_factor import encrypt_secret, new_secret

    client, db, made, sent = api
    admin = await _user(db, made, role="Super Admin",
                        two_factor={"enabled": True, "secret": encrypt_secret(new_secret()), "recovery_codes": []})
    await client.post("/auth/start", json={"email": admin["email"]})
    got = await client.post("/auth/verify", json={"email": admin["email"], "code": sent[-1][2]})
    assert got.status_code == 428 and got.json()["error"]["code"] == "two_factor_required"


# ── dead ends, said before any code is sent ─────────────────────────────────


async def test_staff_mobile_is_told_to_use_email(api):
    client, db, made, sent = api
    admin = await _user(db, made, role="Admin")
    got = await client.post("/auth/start", json={"phone": admin["phone"]})
    assert got.status_code == 403 and got.json()["error"]["code"] == "staff_use_email"
    assert sent == []


async def test_unconfirmed_mobile_is_told_to_use_email(api):
    client, db, made, sent = api
    her = await _user(db, made, phone_verified=False)
    got = await client.post("/auth/start", json={"phone": her["phone"]})
    assert got.status_code == 409 and got.json()["error"]["code"] == "phone_unconfirmed"
    assert sent == []


async def test_unproved_email_is_told_to_use_mobile(api):
    client, db, made, sent = api
    her = await _user(db, made, signup_proof="phone", email_verified=False)
    got = await client.post("/auth/start", json={"email": her["email"]})
    assert got.status_code == 409 and got.json()["error"]["code"] == "email_unconfirmed"
    assert sent == []


async def test_one_identifier_at_a_time(api):
    client, db, made, sent = api
    both = await client.post("/auth/start", json={"email": _email(), "phone": _digits()})
    assert both.status_code == 422 and both.json()["error"]["code"] == "one_identifier"
    bad = await client.post("/auth/start", json={"phone": "12345"})
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "phone_invalid"


async def test_an_email_code_stamps_an_old_unproved_email(api):
    """Accounts from before email codes have no stamp; signing in by email proves it."""
    client, db, made, sent = api
    her = await _user(db, made, phone_verified=False, email_verified=False)
    await client.post("/auth/start", json={"email": her["email"]})
    got = await client.post("/auth/verify", json={"email": her["email"], "code": sent[-1][2]})
    assert got.status_code == 200 and got.json()["user"]["phone_action_required"] is False, got.text
    assert (await db["users"].find_one({"_id": her["_id"]}))["email_verified_at"] is not None
