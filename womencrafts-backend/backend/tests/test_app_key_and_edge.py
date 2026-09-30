"""
The app-as-key surface is shut until the app exists, and the API edge refuses
what it should.

Offline (no database):
  · with APP_KEY_ENABLED unset, every app-key route answers exactly what an
    unknown route answers;
  · a cross-site POST (foreign Origin) is refused 403 in the error envelope; an
    allowed Origin and no Origin at all pass;
  · the docs switch is off for production and for any Cloud Run container;
  · a validation failure never logs the value she typed.

Against the throwaway local mongod (skipped when it is not running):
  · ten wrong app codes lock app-code sign-in for the day and email her, and
    the right code is then refused;
  · a TOTP step that already signed a browser in cannot sign in another;
  · the handoff peek names the account without spending the link.
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from bson import ObjectId
from fastapi import FastAPI
from pydantic import BaseModel, EmailStr

from app.core import errors
from app.core.config import settings

APP_KEY_ROUTES = [
    ("POST", "/auth/app/key", None),
    ("POST", "/auth/signin/app-code", {"email": "a@example.com", "code": "123456"}),
    ("POST", "/auth/qr/start", None),
    ("GET", "/auth/qr/abc", None),
    ("POST", "/auth/qr/abc/answer", {"allow": True}),
    ("POST", "/auth/qr/abc/poll", {"nonce": "x"}),
    ("POST", "/auth/handoff", None),
    ("POST", "/auth/handoff/peek", {"code": "x" * 30}),
    ("POST", "/auth/handoff/redeem", {"code": "x" * 30}),
]


def _switch(monkeypatch, on: bool) -> None:
    """
    Turn the app-key surface on or off for one test.

    Through the setting when config.py declares it; until then (pydantic
    refuses to set an undeclared field) through the one function the router
    asks, which reads the same `getattr(settings, "APP_KEY_ENABLED", False)`.
    """
    from app.routes import auth_app

    if "APP_KEY_ENABLED" in type(settings).model_fields:
        monkeypatch.setattr(settings, "APP_KEY_ENABLED", on)
    else:
        monkeypatch.setattr(auth_app, "app_key_enabled", lambda: on)


def _client():
    from main import app

    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test/api/v1")


# ── the gate ─────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("method,path,body", APP_KEY_ROUTES)
async def test_app_key_routes_are_404_when_switched_off(method, path, body, monkeypatch):
    _switch(monkeypatch, False)
    async with _client() as client:
        unknown = await client.request(method, "/auth/no-such-route-at-all", json=body)
        got = await client.request(method, path, json=body)
    assert got.status_code == 404, got.text
    assert unknown.status_code == 404
    # Indistinguishable from a route that does not exist (bar the request id).
    assert got.json()["error"]["message"] == unknown.json()["error"]["message"] == "Not Found"
    assert set(got.json()["error"]) == {"message", "request_id"}


def test_gate_reads_the_setting_and_defaults_off():
    from app.routes import auth_app

    declared = "APP_KEY_ENABLED" in type(settings).model_fields
    assert auth_app.app_key_enabled() is (bool(settings.APP_KEY_ENABLED) if declared else False)
    if declared:
        assert type(settings).model_fields["APP_KEY_ENABLED"].default is False


async def test_app_key_off_even_when_explicitly_false(monkeypatch):
    _switch(monkeypatch, False)
    async with _client() as client:
        got = await client.post("/auth/signin/app-code", json={"email": "a@example.com", "code": "123456"})
    assert got.status_code == 404


def test_app_key_routes_hidden_from_the_schema_by_default():
    from app.routes import auth_app
    from main import app

    if auth_app.app_key_enabled():
        pytest.skip("APP_KEY_ENABLED is on in this environment")
    ours = [r for r in app.routes if getattr(r, "path", "").startswith(("/api/v1/auth/handoff", "/api/v1/auth/qr",
                                                                          "/api/v1/auth/app/", "/api/v1/auth/signin/app-code"))]
    assert len(ours) == 9
    assert not any(r.include_in_schema for r in ours)


# ── the Origin check ────────────────────────────────────────────────────────


async def test_foreign_origin_post_is_refused():
    async with _client() as client:
        got = await client.post("/auth/signout", headers={"Origin": "https://evil.example"})
    assert got.status_code == 403
    body = got.json()["error"]
    assert "not WomSakhi" in body["message"]
    assert body["request_id"] and got.headers.get("x-request-id") == body["request_id"]


@pytest.mark.parametrize("method", ["PUT", "PATCH", "DELETE"])
async def test_foreign_origin_other_unsafe_methods_refused(method):
    async with _client() as client:
        got = await client.request(method, "/anything", headers={"Origin": "null"})
    assert got.status_code == 403


async def test_allowed_origin_passes():
    origin = settings.allowed_origins[0]
    async with _client() as client:
        # An unknown route: getting its 404 proves the request got past the check.
        got = await client.post("/no-such-route", headers={"Origin": origin + "/"})
    assert got.status_code == 404


async def test_no_origin_passes():
    async with _client() as client:
        got = await client.post("/no-such-route")
    assert got.status_code == 404


async def test_foreign_origin_get_is_not_blocked():
    async with _client() as client:
        got = await client.get("/no-such-route", headers={"Origin": "https://evil.example"})
    assert got.status_code == 404


# ── docs ─────────────────────────────────────────────────────────────────────


def test_docs_decision(monkeypatch):
    import main

    # This process: ENVIRONMENT from .env, no K_SERVICE → whatever main decided
    # must agree with the rule.
    expected = (settings.ENVIRONMENT.strip().lower() in {"development", "dev", "local"}
                and not settings.is_production)
    import os

    if os.environ.get("K_SERVICE"):
        expected = False
    assert main.DOCS_ENABLED is expected
    assert (main.app.docs_url is None) is (not expected)
    assert (main.app.openapi_url is None) is (not expected)


async def test_docs_absent_when_disabled():
    import main

    if main.DOCS_ENABLED:
        pytest.skip("docs are on in this (development) process")
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://test") as client:
        for path in ("/docs", "/redoc", "/openapi.json"):
            assert (await client.get(path)).status_code == 404


@pytest.mark.parametrize("env,expected", [
    ({"ENVIRONMENT": "development", "K_SERVICE": "womsakhi-api"}, "None None None"),  # Cloud Run, ENVIRONMENT unset
    ({"ENVIRONMENT": "production"}, "None None None"),
    ({"ENVIRONMENT": "development"}, "/docs /redoc /openapi.json"),
])
def test_docs_in_a_fresh_process(env, expected, repo_root):
    """Import main in a clean interpreter, as a container would, and read the switch."""
    import os
    import subprocess
    import sys

    child = {k: v for k, v in os.environ.items() if k != "K_SERVICE"}
    child.update(env)
    out = subprocess.run(
        [sys.executable, "-c", "import main; a = main.app; print(a.docs_url, a.redoc_url, a.openapi_url)"],
        cwd=repo_root, env=child, capture_output=True, text=True, timeout=120,
    )
    assert out.returncode == 0, out.stderr[-2000:]
    assert out.stdout.strip().splitlines()[-1] == expected


def test_docs_rule_for_deployed_environments(monkeypatch):
    """Recompute the rule the way main.py does for the cases that matter."""

    def rule(env: str, k_service: str) -> bool:
        return env.strip().lower() in {"development", "dev", "local"} and \
            env.strip().lower() not in {"production", "prod", "live"} and not k_service

    assert rule("development", "") is True
    assert rule("production", "") is False
    assert rule("development", "womsakhi-api") is False   # ENVIRONMENT unset on Cloud Run
    assert rule("staging", "") is False


# ── validation logs ─────────────────────────────────────────────────────────


def test_validation_summary_drops_input_and_ctx():
    raw = [{"type": "string_too_short", "loc": ("body", "code"), "msg": "String should have at least 6 characters",
            "input": "12345", "ctx": {"min_length": 6}},
           {"type": "value_error", "loc": ("body", "email"), "msg": "value is not a valid email address",
            "input": "priya@@example.com", "ctx": {"reason": "priya@@example.com"}}]
    out = errors.safe_validation_summary(raw)
    assert out == [
        {"loc": ["body", "code"], "type": "string_too_short", "msg": "String should have at least 6 characters"},
        {"loc": ["body", "email"], "type": "value_error", "msg": "value is not a valid email address"},
    ]
    assert "12345" not in repr(out) and "priya" not in repr(out)


async def test_validation_log_line_never_carries_the_input(caplog):
    app = FastAPI()
    errors.install(app)

    class Body(BaseModel):
        email: EmailStr
        phone: str

    @app.post("/x")
    async def _x(body: Body):  # pragma: no cover - never reached
        return {}

    secret_phone = 9876543210  # wrong type: pydantic echoes it back as `input`
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as client:
        with caplog.at_level(logging.WARNING, logger="womsakhi.error"):
            got = await client.post("/x", json={"email": "priya.secret@example", "phone": secret_phone})
    assert got.status_code == 422
    logged = "\n".join(r.getMessage() for r in caplog.records)
    assert "validation POST /x" in logged
    assert "priya.secret" not in logged and str(secret_phone) not in logged


# ── with the switch on, against the local mongod ────────────────────────────


@pytest.fixture
async def live(local_mongo, monkeypatch):
    from app.core import cache, ratelimit
    from app.core import email as mail
    from app.core import sessions
    from app.db import mongodb
    from app.routes import auth_app
    from tests.conftest import LOCAL_MONGO_DB

    monkeypatch.setattr(settings, "DB_NAME", LOCAL_MONGO_DB)
    monkeypatch.setattr(settings, "REDIS_URL", "")
    _switch(monkeypatch, True)

    # The 6-per-15-minutes rate limit would stop the test before the daily
    # lockout it is testing; that limiter has its own tests.
    async def _no_limit(*_a, **_k):
        return None

    monkeypatch.setattr(ratelimit, "check", _no_limit)
    sent: list[tuple[str, str]] = []

    async def _send(message, to):
        sent.append((to, message.subject))
        return True

    monkeypatch.setattr(mail, "can_deliver", lambda: True)
    monkeypatch.setattr(mail, "send", _send)

    mongodb._client, mongodb._db = local_mongo, None
    cache.clear()
    db = mongodb.get_database()
    created: list[ObjectId] = []
    link_ids: list[ObjectId] = []
    try:
        async with _client() as client:
            yield client, db, created, link_ids, sent
    finally:
        assert all(isinstance(i, ObjectId) for i in created) and all(isinstance(i, ObjectId) for i in link_ids)
        uids = [str(i) for i in created]
        if created:
            await db["users"].delete_many({"_id": {"$in": created}})
        if uids:
            await db[sessions.COLLECTION].delete_many({"user_id": {"$in": uids}})
            await db["activity_log"].delete_many({"user_id": {"$in": uids}})
            await db["activity_log"].delete_many({"target": {"$in": uids}, "action": {"$regex": "^security\\."}})
            await db[auth_app.FAILURES].delete_many({"user_id": {"$in": uids}})
        if link_ids:
            await db[auth_app.LINKS].delete_many({"_id": {"$in": link_ids}})
        mongodb._client, mongodb._db = None, None


async def _member(db, created) -> dict:
    tag = uuid.uuid4().hex[:10]
    now = datetime.now(timezone.utc)
    doc = {"full_name": f"Appkey {tag}", "email": f"appkey-{tag}@example.com", "phone": "",
           "email_verified_at": now, "role": "Member", "is_active": True, "token_version": 0,
           "verification_status": "active", "created_at": now, "updated_at": now}
    res = await db["users"].insert_one(doc)
    created.append(res.inserted_id)
    doc["_id"] = res.inserted_id
    return doc


async def _app_session_with_key(db, user) -> tuple[dict, str]:
    from app.core import sessions
    from app.core.two_factor import encrypt_secret, new_secret

    tokens = await sessions.start(None, user, kind=sessions.KIND_APP)
    secret = new_secret()
    await db[sessions.COLLECTION].update_one({"sid": tokens["sid"]},
                                             {"$set": {"app_totp_secret": encrypt_secret(secret)}})
    return tokens, secret


def _wrong(code: str) -> str:
    return f"{(int(code) + 500_000) % 1_000_000:06d}"


async def test_ten_wrong_codes_lock_the_day_and_email_her(live):
    from app.core.two_factor import code_at
    from app.routes import auth_app

    client, db, created, _, sent = live
    user = await _member(db, created)
    _, secret = await _app_session_with_key(db, user)
    bad = _wrong(code_at(secret))

    for n in range(1, auth_app.APP_CODE_DAILY_FAILURES + 1):
        got = await client.post("/auth/signin/app-code", json={"email": user["email"], "code": bad})
        assert got.status_code == 400, (n, got.text)
        assert got.json()["error"]["code"] == "code_wrong"

    row = await db[auth_app.FAILURES].find_one({"user_id": str(user["_id"])})
    assert row["count"] == auth_app.APP_CODE_DAILY_FAILURES and row["expires_at"]
    assert sent == [(user["email"], "WomSakhi: app code sign-in paused")]

    # Now even the right code is refused, and no session is opened.
    right = await client.post("/auth/signin/app-code", json={"email": user["email"], "code": code_at(secret)})
    assert right.status_code == 429, right.text
    assert right.json()["error"]["code"] == "app_code_locked"
    assert "set-cookie" not in right.headers
    audit = await db["activity_log"].find_one({"action": "security.app_code_locked", "target": str(user["_id"])})
    assert audit is not None
    assert len(sent) == 1  # emailed once, not on every attempt after


async def test_nine_wrong_codes_do_not_lock(live):
    from app.core.two_factor import code_at

    client, db, created, _, sent = live
    user = await _member(db, created)
    _, secret = await _app_session_with_key(db, user)
    for _ in range(9):
        await client.post("/auth/signin/app-code", json={"email": user["email"], "code": _wrong(code_at(secret))})
    ok = await client.post("/auth/signin/app-code", json={"email": user["email"], "code": code_at(secret)})
    assert ok.status_code == 200, ok.text
    assert sent == []


async def test_a_used_totp_step_cannot_sign_in_twice(live):
    from app.core.two_factor import code_at

    client, db, created, _, _ = live
    user = await _member(db, created)
    _, secret = await _app_session_with_key(db, user)
    code = code_at(secret)
    first = await client.post("/auth/signin/app-code", json={"email": user["email"], "code": code})
    assert first.status_code == 200, first.text
    again = await client.post("/auth/signin/app-code", json={"email": user["email"], "code": code})
    assert again.status_code == 400 and again.json()["error"]["code"] == "code_wrong"
    # An earlier step (still inside the drift window) is refused too.
    import time

    older = await client.post("/auth/signin/app-code",
                              json={"email": user["email"], "code": code_at(secret, int(time.time()) - 30)})
    assert older.status_code == 400


async def test_handoff_peek_names_the_account_without_spending_it(live):
    import hashlib
    import secrets as _secrets

    from app.routes import auth_app

    client, db, created, link_ids, _ = live
    user = await _member(db, created)
    app_tokens, _ = await _app_session_with_key(db, user)
    code = _secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    res = await db[auth_app.LINKS].insert_one({
        "kind": "handoff", "code_hash": hashlib.sha256(code.encode()).hexdigest(), "user_id": str(user["_id"]),
        "from_sid": app_tokens["sid"], "status": "pending",
        "created_at": now, "expires_at": now + timedelta(seconds=60),
    })
    link_ids.append(res.inserted_id)

    peek = await client.post("/auth/handoff/peek", json={"code": code})
    assert peek.status_code == 200, peek.text
    assert peek.json()["name"] == user["full_name"] and peek.json()["user_id"] == str(user["_id"])
    assert "set-cookie" not in peek.headers
    assert (await db[auth_app.LINKS].find_one({"_id": res.inserted_id}))["status"] == "pending"

    redeemed = await client.post("/auth/handoff/redeem", json={"code": code})
    assert redeemed.status_code == 200, redeemed.text
    after = await client.post("/auth/handoff/peek", json={"code": code})
    assert after.status_code == 400 and after.json()["error"]["code"] == "link_expired"
