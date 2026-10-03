"""
The auth-core security fixes, each proved against the real app.

Runs the app in-process against the throwaway local mongod on 127.0.0.1:27099
(skipped when it is not running — never the cluster in `.env`). Every account
here has a random address, every request a random client IP, and cleanup
deletes only rows this module wrote, by id or by those random values.

    H1  test login: staff get the real flow; every fixed-code sign-in audited;
        a daily cap on wrong fixed-code tries
    M1  client IP from the END of X-Forwarded-For; atomic code attempts
    M4  every spent refresh token is remembered
    M6  unknown addresses are told so (owner decision, Oct 2026) and sent nothing
    L2  SMS allowance spent only by numbers that can use it
    L3  only a CONFIRMED number is "taken"
    L4  refresh token in JSON only for the app
    L5  sign-out after idle still ends the server session
    L8  MFA ticket, TOTP step and recovery code are single use
"""

import asyncio
import random
import threading
import time
import uuid
from datetime import datetime, timezone

import httpx
import pytest
from bson import ObjectId
from fastapi import BackgroundTasks
from starlette.requests import Request

from app.core import cache, codes, ratelimit, sessions
from app.core.config import settings
from app.core.two_factor import code_at, encrypt_secret, new_secret, recovery_digest
from app.db import mongodb
from tests.conftest import LOCAL_MONGO_DB

FIXED = "482913"


def _ip() -> str:
    return f"198.51.{random.randint(0, 255)}.{random.randint(1, 254)}"


def _tag() -> str:
    return uuid.uuid4().hex[:10]


def _phone() -> str:
    return f"+9198{uuid.uuid4().int % 10**8:08d}"


@pytest.fixture
async def api(local_mongo, monkeypatch):
    monkeypatch.setattr(settings, "DB_NAME", LOCAL_MONGO_DB)
    monkeypatch.setattr(settings, "REDIS_URL", "")
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "file")
    monkeypatch.setattr(settings, "PHONE_CODES_ENABLED", True)
    monkeypatch.setattr(settings, "PHONE_PROVIDER", "file")
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 1)
    monkeypatch.setattr(settings, "TEST_LOGIN_ALLOW_STAFF", False)
    monkeypatch.setattr(settings, "TEST_LOGIN_CODE", FIXED)
    monkeypatch.setattr(settings, "TEST_LOGIN_EMAILS", "")
    monkeypatch.setattr(settings, "SMS_DAILY_LIMIT", 10**6)
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
    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://test/api/v1",
                                     headers={"X-Forwarded-For": _ip()}) as client:
            yield client, db, made, sent
    finally:
        ids = [i for i in made["users"] if i]
        assert all(isinstance(i, ObjectId) for i in ids)
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
            await db[codes.SMS_LEDGER].delete_many({"destination": {"$in": addresses}})
        mongodb._client, mongodb._db = None, None
        ratelimit._hits.clear()


async def _user(db, made, *, role="Member", phone=None, verified_phone=True, two_factor=None) -> dict:
    tag = _tag()
    now = datetime.now(timezone.utc)
    phone = phone if phone is not None else _phone()
    doc = {
        "full_name": f"Test {tag}", "email": f"sec-{tag}@example.com", "phone": phone,
        "phone_verified_at": now if verified_phone else None, "email_verified_at": now,
        "role": role, "is_active": True, "token_version": 0,
        "verification_status": "active", "created_at": now, "updated_at": now,
    }
    if two_factor:
        doc["two_factor"] = two_factor
    res = await db["users"].insert_one(doc)
    doc["_id"] = res.inserted_id
    made["users"].append(res.inserted_id)
    made["addresses"] += [doc["email"], phone]
    return doc


def _list_for_test_login(monkeypatch, *emails):
    monkeypatch.setattr(settings, "TEST_LOGIN_EMAILS", ",".join(emails))


# ── H1: the test-login door ─────────────────────────────────────────────────


async def test_listed_member_signs_in_with_fixed_code_and_it_is_audited(api, monkeypatch):
    client, db, made, sent = api
    her = await _user(db, made)
    _list_for_test_login(monkeypatch, her["email"])
    assert (await client.post("/auth/signin/start", json={"email": her["email"]})).status_code == 200
    assert sent == []  # nothing is sent to a test member
    got = await client.post("/auth/signin/verify", json={"email": her["email"], "code": FIXED})
    assert got.status_code == 200, got.text
    audit = await db["activity_log"].find_one({"user_id": str(her["_id"]), "action": "security.signin"})
    assert audit and "test_code" in audit["detail"]
    row = await db[sessions.COLLECTION].find_one({"user_id": str(her["_id"])})
    assert row["method"] == "test_code"


async def test_listed_staff_gets_a_real_code_then_the_authenticator(api, monkeypatch):
    client, db, made, sent = api
    secret = new_secret()
    admin = await _user(db, made, role="Super Admin",
                        two_factor={"enabled": True, "secret": encrypt_secret(secret), "recovery_codes": []})
    _list_for_test_login(monkeypatch, admin["email"])
    assert (await client.post("/auth/signin/start", json={"email": admin["email"]})).status_code == 200
    assert len(sent) == 1 and sent[0][1] == admin["email"] and sent[0][2] != FIXED
    fixed = await client.post("/auth/signin/verify", json={"email": admin["email"], "code": FIXED})
    assert fixed.status_code == 400
    real = await client.post("/auth/signin/verify", json={"email": admin["email"], "code": sent[0][2]})
    assert real.status_code == 428 and real.json()["error"]["code"] == "two_factor_required"
    assert not await db[sessions.COLLECTION].find_one({"user_id": str(admin["_id"])})


async def test_staff_fixed_code_only_with_the_setting_and_always_audited(api, monkeypatch):
    client, db, made, sent = api
    admin = await _user(db, made, role="Super Admin")
    _list_for_test_login(monkeypatch, admin["email"])
    monkeypatch.setattr(settings, "TEST_LOGIN_ALLOW_STAFF", True)
    await client.post("/auth/signin/start", json={"email": admin["email"]})
    assert sent == []
    got = await client.post("/auth/signin/verify", json={"email": admin["email"], "code": FIXED})
    assert got.status_code == 200, got.text
    audit = await db["activity_log"].find_one({"user_id": str(admin["_id"]), "action": "security.signin"})
    assert audit and "test_code" in audit["detail"] and "authenticator skipped" in audit["detail"]


async def test_ten_wrong_fixed_code_tries_lock_the_address_for_the_day(api, monkeypatch):
    client, db, made, _ = api
    her = await _user(db, made)
    _list_for_test_login(monkeypatch, her["email"])
    monkeypatch.setattr(codes, "VERIFY_LIMIT", (1000, 3600.0))
    try:
        wrong = 0
        while wrong < 10:
            # The fixed code has no send limits, so "void it, ask again" is free —
            # which is exactly what the daily cap is for.
            assert (await client.post("/auth/signin/start", json={"email": her["email"]})).status_code == 200
            for _ in range(min(5, 10 - wrong)):
                r = await client.post("/auth/signin/verify", json={"email": her["email"], "code": "000000"})
                assert r.status_code == 400
                wrong += 1
        await client.post("/auth/signin/start", json={"email": her["email"]})
        locked = await client.post("/auth/signin/verify", json={"email": her["email"], "code": FIXED})
        assert locked.status_code == 400 and locked.json()["error"]["code"] == "code_expired"
        assert await codes.test_code_locked(her["email"])
    finally:
        await db[ratelimit.COLLECTION].delete_many(
            {"key": f"{codes.TEST_CODE_FAIL_BUCKET}:id:{her['email']}"})


# ── M1: the client IP ───────────────────────────────────────────────────────


def _req(xff: str = "", peer: str = "10.0.0.1") -> Request:
    headers = [(b"x-forwarded-for", xff.encode())] if xff else []
    return Request({"type": "http", "method": "POST", "path": "/", "headers": headers,
                    "client": (peer, 1234), "query_string": b""})


def test_a_forged_forwarded_for_prefix_does_not_change_the_key(monkeypatch):
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 1)
    real = ratelimit.client_ip(_req("203.0.113.7"))
    assert real == "203.0.113.7"
    for _ in range(20):
        forged = ", ".join(f"{random.randint(1, 250)}.{random.randint(0, 255)}.0.{random.randint(1, 254)}"
                           for _ in range(random.randint(1, 4)))
        assert ratelimit.client_ip(_req(f"{forged}, 203.0.113.7")) == real
        assert sessions._client_ip(_req(f"{forged}, 203.0.113.7")) == real


def test_proxy_hops_setting(monkeypatch):
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 2)
    assert ratelimit.client_ip(_req("1.1.1.1, 203.0.113.7, 35.191.0.1")) == "203.0.113.7"
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 0)
    assert ratelimit.client_ip(_req("1.1.1.1", peer="10.9.9.9")) == "10.9.9.9"
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 1)
    assert ratelimit.client_ip(_req("", peer="10.9.9.9")) == "10.9.9.9"
    assert ratelimit._client_ip(Request({"type": "http", "headers": [], "client": None})) == "unknown"


# ── M1: one code, five tries, however fast they arrive ─────────────────────


async def test_twenty_parallel_wrong_guesses_count_at_most_five(api, monkeypatch):
    client, db, made, sent = api
    her = await _user(db, made)
    monkeypatch.setattr(codes, "VERIFY_LIMIT", (1000, 3600.0))
    monkeypatch.setattr(codes, "VERIFY_LIMIT_IP", (1000, 3600.0))
    assert (await client.post("/auth/signin/start", json={"email": her["email"]})).status_code == 200
    real = sent[-1][2]
    wrong = "000000" if real != "000000" else "111111"
    answers = await asyncio.gather(*[
        client.post("/auth/signin/verify", json={"email": her["email"], "code": wrong}) for _ in range(20)
    ])
    kinds = [r.json()["error"]["code"] for r in answers]
    assert all(r.status_code == 400 for r in answers)
    assert kinds.count("code_wrong") == 4 and kinds.count("code_voided") == 1
    assert kinds.count("code_expired") == 15
    row = await db[codes.COLLECTION].find_one({"destination": her["email"], "purpose": "signin"},
                                              sort=[("created_at", -1)])
    assert row["attempts"] == 5 and row["voided"] and row["consumed_at"]
    # Voided means voided: the right code does not work now either.
    late = await client.post("/auth/signin/verify", json={"email": her["email"], "code": real})
    assert late.status_code == 400


async def test_tries_left_message_is_unchanged(api):
    client, db, made, sent = api
    her = await _user(db, made)
    await client.post("/auth/signin/start", json={"email": her["email"]})
    wrong = "000000" if sent[-1][2] != "000000" else "111111"
    r = await client.post("/auth/signin/verify", json={"email": her["email"], "code": wrong})
    err = r.json()["error"]
    assert (err["code"], err["message"], err["attempts_left"]) == (
        "code_wrong", "That code isn't right. 4 tries left.", 4)
    ok = await client.post("/auth/signin/verify", json={"email": her["email"], "code": sent[-1][2]})
    assert ok.status_code == 200


# ── M4: the refresh-token family ────────────────────────────────────────────


async def _refresh(client, token):
    return await client.post("/auth/refresh", json={"refresh_token": token})


async def test_a_thief_who_rotates_twice_is_still_caught(api):
    client, db, made, _ = api
    her = await _user(db, made)
    stolen = (await sessions.start(None, her))["refresh_token"]
    one = await _refresh(client, stolen)
    assert one.status_code == 200
    two = await _refresh(client, one.json()["refresh_token"])
    assert two.status_code == 200
    thief_now = two.json()["refresh_token"]
    # The real device wakes up holding N — two generations back.
    real = await _refresh(client, stolen)
    assert real.status_code == 401
    row = await db[sessions.COLLECTION].find_one({"user_id": str(her["_id"])})
    assert row["revoked_at"] and row["revoked_reason"] == "refresh_reuse"
    assert (await _refresh(client, thief_now)).status_code == 401


async def test_the_grace_window_is_only_for_the_previous_token(api):
    client, db, made, _ = api
    her = await _user(db, made)
    first = (await sessions.start(None, her))["refresh_token"]
    second = (await _refresh(client, first)).json()["refresh_token"]
    # Immediately previous, inside 30 s: a race, answered with an access token.
    raced = await _refresh(client, first)
    assert raced.status_code == 200 and raced.json()["refresh_token"] == ""
    await _refresh(client, second)
    # `first` is now two back: reuse, even though it rotated seconds ago.
    assert (await _refresh(client, first)).status_code == 401
    row = await db[sessions.COLLECTION].find_one({"user_id": str(her["_id"])})
    assert row["revoked_reason"] == "refresh_reuse"
    assert len(row["spent_refresh_hashes"]) == 2


# ── M6 (replaced Oct 2026): unknown addresses are told so ─────────────────
#
# Owner decision: an email or number with no account answers 404
# `not_registered` and is sent nothing (the old "same answer for everybody"
# left women waiting for codes that were never coming). The cooldown still
# holds for real accounts; the per-IP lookup cap is in test_auth_owner_rules.


async def test_unknown_signin_is_told_and_sent_nothing(api):
    client, db, made, sent = api
    her = await _user(db, made)
    stranger = f"sec-nobody-{_tag()}@example.com"
    made["addresses"].append(stranger)
    first_real = await client.post("/auth/signin/start", json={"email": her["email"]})
    first_unknown = await client.post("/auth/signin/start", json={"email": stranger})
    assert first_real.status_code == 200
    assert "has a WomSakhi account" not in first_real.json()["message"]
    assert first_unknown.status_code == 404
    assert first_unknown.json()["error"]["code"] == "not_registered"
    assert first_unknown.json()["error"]["message"] == "This is a new email for WomSakhi. Please sign up first."
    assert await db[codes.COLLECTION].count_documents({"destination": stranger}) == 0
    again_real = await client.post("/auth/signin/start", json={"email": her["email"]})
    assert again_real.status_code == 429 and again_real.json()["error"]["code"] == "resend_too_soon"
    assert [s[1] for s in sent] == [her["email"]]  # the stranger was sent nothing


async def test_issue_sends_after_the_answer_when_given_background_tasks(api):
    _, db, made, sent = api
    her = await _user(db, made)
    tasks = BackgroundTasks()
    await codes.issue(_req(xff=_ip()), purpose=codes.SIGNIN, channel=codes.EMAIL,
                      destination=her["email"], user_id=str(her["_id"]), background=tasks)
    assert sent == [] and len(tasks.tasks) == 1  # not sent while the request is answered
    await tasks()
    assert len(sent) == 1 and sent[0][1] == her["email"]


async def test_a_failed_background_send_frees_the_address(api, monkeypatch):
    _, db, made, _ = api
    her = await _user(db, made)

    async def _fails(*_a, **_k):
        return False

    monkeypatch.setattr(codes, "_deliver", _fails)
    tasks = BackgroundTasks()
    await codes.issue(_req(xff=_ip()), purpose=codes.SIGNIN, channel=codes.EMAIL,
                      destination=her["email"], user_id=str(her["_id"]), background=tasks)
    await tasks()
    row = await db[codes.COLLECTION].find_one({"destination": her["email"]})
    assert row["failed"] and row["consumed_at"]  # so "resend" is not held by the cooldown


async def test_smtp_runs_off_the_event_loop(monkeypatch):
    from app.core import email as mailer

    seen = {}

    class FakeSMTP:
        def __init__(self, *a, **k):
            seen["thread"] = threading.get_ident()

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def starttls(self, **k):
            pass

        def login(self, *a):
            pass

        def send_message(self, msg):
            time.sleep(0.01)

    monkeypatch.setattr(mailer.smtplib, "SMTP", FakeSMTP)
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.invalid")
    monkeypatch.setattr(settings, "SMTP_USE_SSL", False)
    monkeypatch.setattr(settings, "SMTP_USER", "")
    msg = mailer.EmailMessageSpec(to="x@example.com", subject="s", html="<p>h</p>", text="t")
    assert await mailer.SmtpEmailProvider().send(msg) is True
    assert seen["thread"] != threading.get_ident()


# ── L4: the refresh token stays in the cookie for browsers ─────────────────


async def test_refresh_token_in_the_body_only_for_the_app(api, monkeypatch):
    client, db, made, _ = api
    her = await _user(db, made)
    _list_for_test_login(monkeypatch, her["email"])
    await client.post("/auth/signin/start", json={"email": her["email"]})
    web = await client.post("/auth/signin/verify", json={"email": her["email"], "code": FIXED})
    assert web.status_code == 200 and web.json()["refresh_token"] == ""
    assert web.cookies.get(sessions.REFRESH_COOKIE)
    await db[codes.COLLECTION].delete_many({"destination": her["email"]})
    await client.post("/auth/signin/start", json={"email": her["email"]})
    app_ = await client.post("/auth/signin/verify", json={"email": her["email"], "code": FIXED},
                             headers={"X-WomSakhi-Client": "app"})
    assert app_.status_code == 200 and len(app_.json()["refresh_token"]) > 20


# ── L5: sign-out after idle ─────────────────────────────────────────────────


async def test_signout_with_only_the_refresh_cookie_ends_the_session(api):
    client, db, made, _ = api
    her = await _user(db, made)
    tokens = await sessions.start(None, her)
    # Access token long gone: only the refresh cookie arrives.
    out = await client.post("/auth/signout", headers={"Cookie": f"{sessions.REFRESH_COOKIE}={tokens['refresh_token']}"})
    assert out.status_code == 200
    row = await db[sessions.COLLECTION].find_one({"sid": tokens["sid"]})
    assert row["revoked_at"] and row["revoked_reason"] == "signed_out"
    assert (await _refresh(client, tokens["refresh_token"])).status_code == 401


async def test_app_signout_with_the_refresh_token_in_the_body(api):
    client, db, made, _ = api
    her = await _user(db, made)
    tokens = await sessions.start(None, her)
    out = await client.post("/auth/signout", json={"refresh_token": tokens["refresh_token"]})
    assert out.status_code == 200
    assert (await db[sessions.COLLECTION].find_one({"sid": tokens["sid"]}))["revoked_at"]


# ── L8: nothing in the second factor works twice ────────────────────────────


async def _staff_ticket(client, admin, sent):
    await client.post("/auth/signin/start", json={"email": admin["email"]})
    got = await client.post("/auth/signin/verify", json={"email": admin["email"], "code": sent[-1][2]})
    assert got.status_code == 428, got.text
    return got.json()["error"]["ticket"]


async def _fresh_staff(db, made, recovery=()):
    secret = new_secret()
    admin = await _user(db, made, role="Super Admin", two_factor={
        "enabled": True, "secret": encrypt_secret(secret),
        "recovery_codes": [recovery_digest(c) for c in recovery]})
    return admin, secret


async def test_mfa_ticket_is_single_use(api):
    client, db, made, sent = api
    admin, secret = await _fresh_staff(db, made)
    ticket = await _staff_ticket(client, admin, sent)
    now = int(time.time())
    first = await client.post("/auth/two-factor/verify", json={"ticket": ticket, "code": code_at(secret, now)})
    assert first.status_code == 200, first.text
    # Replayed ticket, even with the NEXT valid code.
    again = await client.post("/auth/two-factor/verify", json={"ticket": ticket, "code": code_at(secret, now + 30)})
    assert again.status_code == 400 and again.json()["error"]["code"] == "ticket_expired"


async def test_totp_step_cannot_be_reused_or_go_backwards(api):
    client, db, made, sent = api
    admin, secret = await _fresh_staff(db, made)
    now = int(time.time())
    used = code_at(secret, now)
    t1 = await _staff_ticket(client, admin, sent)
    assert (await client.post("/auth/two-factor/verify", json={"ticket": t1, "code": used})).status_code == 200
    await db[codes.COLLECTION].delete_many({"destination": admin["email"]})
    t2 = await _staff_ticket(client, admin, sent)
    same = await client.post("/auth/two-factor/verify", json={"ticket": t2, "code": used})
    assert same.status_code == 400 and "already been used" in same.json()["error"]["message"]
    older = await client.post("/auth/two-factor/verify", json={"ticket": t2, "code": code_at(secret, now - 30)})
    assert older.status_code == 400
    newer = await client.post("/auth/two-factor/verify", json={"ticket": t2, "code": code_at(secret, now + 30)})
    assert newer.status_code == 200, newer.text


async def test_one_recovery_code_cannot_be_spent_twice_in_parallel(api):
    client, db, made, sent = api
    admin, _ = await _fresh_staff(db, made, recovery=["ABCD-1234", "EEEE-9999"])
    t1 = await _staff_ticket(client, admin, sent)
    await db[codes.COLLECTION].delete_many({"destination": admin["email"]})
    t2 = await _staff_ticket(client, admin, sent)
    a, b = await asyncio.gather(
        client.post("/auth/two-factor/verify", json={"ticket": t1, "code": "ABCD-1234"}),
        client.post("/auth/two-factor/verify", json={"ticket": t2, "code": "ABCD-1234"}),
    )
    assert sorted([a.status_code, b.status_code]) == [200, 400]
    left = (await db["users"].find_one({"_id": admin["_id"]}))["two_factor"]["recovery_codes"]
    assert left == [recovery_digest("EEEE-9999")]


# ── L2: the SMS allowance ───────────────────────────────────────────────────


async def test_unknown_numbers_are_told_and_spend_nothing(api):
    client, db, made, _ = api
    before = await codes.sms_used_today()
    for _ in range(10):
        number = _phone()
        made["addresses"].append(number)
        r = await client.post("/auth/sms/allowance", json={"phone": number, "purpose": "signin"},
                              headers={"X-Forwarded-For": _ip()})
        assert r.status_code == 404 and r.json()["error"]["code"] == "not_registered"
        assert r.json()["error"]["message"] == "This is a new mobile number for WomSakhi. Please sign up first."
    assert await codes.sms_used_today() == before
    her = await _user(db, made)
    real = await client.post("/auth/sms/allowance", json={"phone": her["phone"], "purpose": "signin"})
    assert real.status_code == 200 and real.json()["ok"] is True
    assert await codes.sms_used_today() == before + 1


async def test_an_unconfirmed_number_is_not_a_way_in(api):
    client, db, made, _ = api
    her = await _user(db, made, verified_phone=False)
    before = await codes.sms_used_today()
    r = await client.post("/auth/sms/allowance", json={"phone": her["phone"], "purpose": "signin"})
    assert r.status_code == 404 and await codes.sms_used_today() == before


async def test_phone_verify_allowance_needs_her_session(api):
    client, db, made, _ = api
    her = await _user(db, made, verified_phone=False)
    anon = await client.post("/auth/sms/allowance", json={"phone": her["phone"], "purpose": "phone_verify"})
    assert anon.status_code == 401
    tokens = await sessions.start(None, her)
    before = await codes.sms_used_today()
    mine = await client.post("/auth/sms/allowance", json={"phone": her["phone"], "purpose": "phone_verify"},
                             headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert mine.status_code == 200 and await codes.sms_used_today() == before + 1


async def test_the_per_number_cap_still_holds(api, monkeypatch):
    client, db, made, _ = api
    monkeypatch.setattr(settings, "SMS_PER_NUMBER_DAILY", 2)
    number = (await _user(db, made))["phone"]
    answers = [await client.post("/auth/sms/allowance", json={"phone": number, "purpose": "signin"},
                                 headers={"X-Forwarded-For": _ip()}) for _ in range(3)]
    assert [a.status_code for a in answers] == [200, 200, 429]


# ── L3: a number is taken only once it is confirmed ────────────────────────


async def test_an_unconfirmed_claim_does_not_block_the_real_owner(api):
    client, db, made, sent = api
    number = _phone()
    await _user(db, made, phone=number, verified_phone=False)  # the squatter
    email = f"sec-owner-{_tag()}@example.com"
    made["addresses"].append(email)
    start = await client.post("/auth/signup/start", json={"email": email, "phone": number})
    assert start.status_code == 200, start.text
    ticket = await client.post("/auth/signup/verify", json={"email": email, "code": sent[-1][2]})
    assert ticket.status_code == 200, ticket.text
    done = await client.post("/auth/signup/complete", json={
        "ticket": ticket.json()["ticket"], "full_name": "Real Owner", "is_woman_18_plus": True})
    assert done.status_code == 201, done.text
    owner = await db["users"].find_one({"email": email})
    made["users"].append(owner["_id"])
    if owner.get("member_id"):
        made["members"].append(ObjectId(owner["member_id"]))


async def test_a_confirmed_number_is_taken(api):
    client, db, made, sent = api
    number = _phone()
    await _user(db, made, phone=number, verified_phone=True)
    email = f"sec-late-{_tag()}@example.com"
    made["addresses"].append(email)
    # Told at the first step now, before any code is sent.
    r = await client.post("/auth/signup/start", json={"email": email, "phone": number})
    assert r.status_code == 409 and r.json()["error"]["code"] == "phone_taken"
    assert not [x for x in sent if x[1] == email]


async def test_two_unconfirmed_holders_cannot_both_confirm(api):
    client, db, made, sent = api
    number = _phone()
    a = await _user(db, made, phone=number, verified_phone=False)
    b = await _user(db, made, phone=number, verified_phone=False)
    ta, tb = await sessions.start(None, a), await sessions.start(None, b)
    ha = {"Authorization": f"Bearer {ta['access_token']}", "X-Forwarded-For": _ip()}
    hb = {"Authorization": f"Bearer {tb['access_token']}", "X-Forwarded-For": _ip()}
    assert (await client.post("/auth/phone/start", headers=ha)).status_code == 200
    code_a = sent[-1][2]
    ok = await client.post("/auth/phone/verify", json={"code": code_a}, headers=ha)
    assert ok.status_code == 200, ok.text
    await db[codes.COLLECTION].delete_many({"destination": number})
    assert (await client.post("/auth/phone/start", headers=hb)).status_code == 200
    refused = await client.post("/auth/phone/verify", json={"code": sent[-1][2]}, headers=hb)
    assert refused.status_code == 409 and refused.json()["error"]["code"] == "phone_taken"
    confirmed = await db["users"].count_documents({"phone": number, "phone_verified_at": {"$ne": None}})
    assert confirmed == 1


async def test_parallel_confirmations_leave_at_most_one(api):
    from app.routes import auth

    _, db, made, _ = api
    number = _phone()
    holders = [await _user(db, made, phone=number, verified_phone=False) for _ in range(4)]
    results = await asyncio.gather(*[auth._mark_phone_verified(h, None) for h in holders],
                                   return_exceptions=True)
    assert sum(1 for r in results if isinstance(r, dict)) <= 1
    confirmed = await db["users"].count_documents({"phone": number, "phone_verified_at": {"$ne": None}})
    assert confirmed <= 1
