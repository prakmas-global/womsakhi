"""
The October 2026 auth rules from the owner's testers, proved against the real
app on the throwaway local mongod (127.0.0.1:27099; skipped when it is down).

    1  the code email carries the six digits with no spaces in them
    2  one proved channel is enough: email-code joiners are not sent to confirm
       their mobile; SMS-code joiners are not sent to confirm their email
    3  unknown email / number on sign-in is told so (404 not_registered), and
       joining with a known one says "sign in" (409), both capped per IP
    4  parallel refreshes of one session all succeed; real reuse still ends it
"""

import asyncio
from datetime import timedelta

import pytest
from bson import ObjectId

from app.core import codes, ratelimit, sessions
from app.core import email as mailer
from app.core.config import settings
from app.models.user import UserModel
from app.routes import auth as auth_routes
from tests.test_auth_security_fixes import _ip, _phone, _tag, _user, api  # noqa: F401 - `api` is a fixture


def _forget(made, user: dict) -> None:
    made["users"].append(user["_id"])
    if user.get("member_id"):
        made["members"].append(ObjectId(user["member_id"]))


# ── 1: the code email ──────────────────────────────────────────────────────


@pytest.mark.parametrize("purpose", ["signup", "signin", "phone_verify"])
def test_the_code_email_has_the_digits_unspaced(purpose):
    spec = mailer.code_email("Asha", "390123", purpose)
    assert "390123" in spec.html and "3 9 0 1 2 3" not in spec.html
    assert "letter-spacing" in spec.html  # the look comes from CSS, not spaces
    assert "390123" in spec.text and "390123" in spec.subject


# ── 2: one proved channel is enough ────────────────────────────────────────


async def _join_by_email(client, db, made, sent, email=None, phone=None):
    email = email or f"own-{_tag()}@example.com"
    phone = phone or _phone()
    made["addresses"] += [email, phone]
    start = await client.post("/auth/signup/start", json={"email": email, "phone": phone})
    assert start.status_code == 200, start.text
    ticket = await client.post("/auth/signup/verify", json={"email": email, "code": sent[-1][2]})
    assert ticket.status_code == 200, ticket.text
    done = await client.post("/auth/signup/complete", json={
        "ticket": ticket.json()["ticket"], "full_name": "Asha Rao", "is_woman_18_plus": True})
    assert done.status_code == 201, done.text
    row = await db["users"].find_one({"email": email})
    _forget(made, row)
    return done.json(), row


async def test_an_email_joiner_is_not_sent_to_confirm_her_mobile(api):
    client, db, made, sent = api
    assert settings.phone_codes_live  # phone codes ON: the old rule would have stopped her
    body, row = await _join_by_email(client, db, made, sent)
    assert row["email_verified_at"] and row["phone_verified_at"] is None
    assert body["user"]["phone_action_required"] is False
    assert body["user"]["email_verified"] is True


def test_phone_action_rule():
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    base = {"role": "Member", "phone": "+919812345678"}
    assert UserModel.phone_action_required({**base, "phone": ""}) is True  # a missing number still counts
    assert UserModel.phone_action_required({**base, "email_verified_at": now}) is False
    assert UserModel.phone_action_required({**base, "phone_verified_at": now}) is False


@pytest.fixture
def firebase(monkeypatch):
    """Firebase as the SMS provider, with Google's signature check stubbed."""
    monkeypatch.setattr(settings, "PHONE_PROVIDER", "firebase")
    monkeypatch.setattr(settings, "FIREBASE_PROJECT_ID", "womsakhi-test")
    monkeypatch.setattr(settings, "FIREBASE_WEB_API_KEY", "test-key")
    vouched: dict[str, str] = {}

    async def _verify(token: str) -> str:
        return vouched.get(token, "")

    monkeypatch.setattr(codes, "verify_firebase_phone", _verify)
    return vouched


async def _join_by_sms(client, made, vouched, email, phone, token_phone=None):
    made["addresses"] += [email, phone]
    token = f"firebase-id-token-{_tag()}"
    vouched[token] = token_phone or phone
    allowed = await client.post("/auth/sms/allowance", json={"phone": phone, "purpose": "signup"})
    assert allowed.status_code == 200, allowed.text
    return await client.post("/auth/signup/firebase",
                             json={"email": email, "phone": phone, "id_token": token, "locale": "en"})


async def test_an_sms_joiner_has_her_number_confirmed_and_is_not_asked_for_email(api, firebase):
    client, db, made, sent = api
    email, phone = f"own-sms-{_tag()}@example.com", _phone()
    ticket = await _join_by_sms(client, made, firebase, email, phone)
    assert ticket.status_code == 200, ticket.text
    done = await client.post("/auth/signup/complete", json={
        "ticket": ticket.json()["ticket"], "full_name": "Meena Devi", "is_woman_18_plus": True})
    assert done.status_code == 201, done.text
    row = await db["users"].find_one({"email": email})
    _forget(made, row)
    assert row["phone_verified_at"] and row["email_verified_at"] is None
    assert row["verification_status"] == "pending_documents"  # not stopped at "confirm your email"
    user = done.json()["user"]
    assert user["phone_verified"] is True and user["phone_action_required"] is False
    assert user["email_verified"] is False
    assert not [x for x in sent if x[1] == email]  # no email code was ever sent

    # Her session works.
    me = await client.get("/auth/me", headers={"Authorization": f"Bearer {done.json()['access_token']}"})
    assert me.status_code == 200 and me.json()["phone_verified"] is True

    # The typed, unproved email is not a way in...
    by_email = await client.post("/auth/signin/start", json={"email": email})
    assert by_email.status_code == 409 and by_email.json()["error"]["code"] == "email_unconfirmed"
    # ...but her confirmed number is.
    token = f"firebase-id-token-{_tag()}"
    firebase[token] = phone
    assert (await client.post("/auth/sms/allowance", json={"phone": phone, "purpose": "signin"})).status_code == 200
    signed = await client.post("/auth/signin/firebase", json={"id_token": token})
    assert signed.status_code == 200, signed.text

    # And she cannot join a second time with that number.
    again = await client.post("/auth/sms/allowance", json={"phone": phone, "purpose": "signup"})
    assert again.status_code == 409 and again.json()["error"]["code"] == "phone_taken"


async def test_a_later_email_code_proves_the_email_too(api, firebase):
    client, db, made, sent = api
    email, phone = f"own-later-{_tag()}@example.com", _phone()
    ticket = await _join_by_sms(client, made, firebase, email, phone)
    done = await client.post("/auth/signup/complete", json={
        "ticket": ticket.json()["ticket"], "full_name": "Meena Devi", "is_woman_18_plus": True})
    row = await db["users"].find_one({"email": email})
    _forget(made, row)
    assert done.status_code == 201
    from fastapi import BackgroundTasks
    from starlette.requests import Request
    request = Request({"type": "http", "headers": [], "client": ("127.0.0.1", 1)})
    proved = await auth_routes._finish_member_email_proof(row, request, BackgroundTasks())
    assert proved["email_verified_at"] is not None
    assert UserModel.to_response(proved)["email_verified"] is True


async def test_an_sms_proof_for_another_number_is_refused(api, firebase):
    client, db, made, _ = api
    email, phone = f"own-mm-{_tag()}@example.com", _phone()
    r = await _join_by_sms(client, made, firebase, email, phone, token_phone=_phone())
    assert r.status_code == 400 and r.json()["error"]["code"] == "phone_mismatch"
    assert await db["users"].count_documents({"email": email}) == 0


async def test_sms_signup_is_off_without_firebase(api):
    client, _, made, _ = api
    r = await client.post("/auth/signup/firebase", json={
        "email": f"own-off-{_tag()}@example.com", "phone": _phone(), "id_token": "x" * 30})
    assert r.status_code == 400 and r.json()["error"]["code"] == "phone_codes_off"


async def test_sms_signup_for_a_known_email_says_sign_in(api, firebase):
    client, db, made, _ = api
    her = await _user(db, made)
    r = await _join_by_sms(client, made, firebase, her["email"], _phone())
    assert r.status_code == 409 and r.json()["error"]["code"] == "already_registered"


# ── 3: unknown and known addresses are told ────────────────────────────────


async def test_unknown_email_and_number_on_signin(api):
    client, db, made, sent = api
    email = f"own-new-{_tag()}@example.com"
    made["addresses"].append(email)
    r = await client.post("/auth/signin/start", json={"email": email})
    assert r.status_code == 404
    assert r.json()["error"] | {"request_id": None} == {
        "code": "not_registered", "message": "This is a new email for WomSakhi. Please sign up first.",
        "request_id": None}
    assert sent == []


async def test_server_sms_signin_for_unknown_number(api):
    client, _, made, sent = api  # PHONE_PROVIDER=file: the server sends the SMS itself
    number = _phone()
    made["addresses"].append(number)
    r = await client.post("/auth/signin/start", json={"phone": number})
    assert r.status_code == 404
    assert r.json()["error"]["message"] == "This is a new mobile number for WomSakhi. Please sign up first."
    assert sent == []


async def test_joining_with_a_known_email_says_sign_in(api):
    client, db, made, sent = api
    her = await _user(db, made)
    r = await client.post("/auth/signup/start", json={"email": her["email"], "phone": _phone()})
    assert r.status_code == 409 and r.json()["error"]["code"] == "already_registered"
    assert "sign in" in r.json()["error"]["message"].lower()
    assert sent == []  # no sign-in code is sent behind her back any more


async def test_lookup_answers_are_capped_per_ip(api):
    client, _, made, _ = api
    ip = _ip()
    answers = []
    for _ in range(auth_routes.LOOKUP_ANSWERS_PER_IP[0] + 1):
        email = f"own-scan-{_tag()}@example.com"
        made["addresses"].append(email)
        r = await client.post("/auth/signin/start", json={"email": email}, headers={"X-Forwarded-For": ip})
        answers.append(r.status_code)
    assert answers[:-1] == [404] * auth_routes.LOOKUP_ANSWERS_PER_IP[0]
    assert answers[-1] == 429
    # Another IP is unaffected.
    other = await client.post("/auth/signin/start", json={"email": f"own-x-{_tag()}@example.com"},
                              headers={"X-Forwarded-For": _ip()})
    assert other.status_code == 404
    ratelimit._hits.clear()


# ── 4: parallel refreshes ──────────────────────────────────────────────────


async def test_five_parallel_refreshes_with_one_cookie_all_succeed(api):
    client, db, made, _ = api
    her = await _user(db, made)
    started = await sessions.start(None, her)
    cookie = {"Cookie": f"{sessions.REFRESH_COOKIE}={started['refresh_token']}"}
    answers = await asyncio.gather(*[client.post("/auth/refresh", headers=cookie) for _ in range(5)])
    assert [a.status_code for a in answers] == [200] * 5, [a.text for a in answers]
    row = await db[sessions.COLLECTION].find_one({"sid": started["sid"]})
    assert row["revoked_at"] is None
    assert len(row["spent_refresh_hashes"]) == 1  # rotated once, not five times
    # Exactly one answer carried the new refresh cookie; the rest were grace.
    rotated = [a for a in answers if f"{sessions.REFRESH_COOKIE}=" in a.headers.get("set-cookie", "")]
    assert len(rotated) == 1


async def test_a_lost_race_is_served_by_the_grace_path(api, monkeypatch):
    """Force the race: both refreshes read the row before either writes."""
    client, db, made, _ = api
    her = await _user(db, made)
    started = await sessions.start(None, her)
    real_find = sessions._sessions

    gate = asyncio.Event()
    reads = {"n": 0}

    class _Coll:
        def __init__(self, inner):
            self._inner = inner

        def __getattr__(self, name):
            return getattr(self._inner, name)

        async def find_one(self, query, *a, **k):
            out = await self._inner.find_one(query, *a, **k)
            if "refresh_hash" in query and len(query) == 1:
                reads["n"] += 1
                if reads["n"] >= 2:
                    gate.set()
                await asyncio.wait_for(gate.wait(), 2)
            return out

    monkeypatch.setattr(sessions, "_sessions", lambda: _Coll(real_find()))
    body = {"refresh_token": started["refresh_token"]}
    a, b = await asyncio.gather(client.post("/auth/refresh", json=body), client.post("/auth/refresh", json=body))
    assert (a.status_code, b.status_code) == (200, 200), (a.text, b.text)
    assert sorted(bool(x.json()["refresh_token"]) for x in (a, b)) == [False, True]
    monkeypatch.setattr(sessions, "_sessions", real_find)
    row = await db[sessions.COLLECTION].find_one({"sid": started["sid"]})
    assert row["revoked_at"] is None


async def test_a_stale_token_after_the_grace_window_still_ends_the_session(api):
    client, db, made, _ = api
    her = await _user(db, made)
    started = await sessions.start(None, her)
    first = await client.post("/auth/refresh", json={"refresh_token": started["refresh_token"]})
    assert first.status_code == 200
    await db[sessions.COLLECTION].update_one(
        {"sid": started["sid"]},
        {"$set": {"rotated_at": (await db[sessions.COLLECTION].find_one({"sid": started["sid"]}))["rotated_at"]
                  - timedelta(seconds=sessions.ROTATION_GRACE_SECONDS + 5)}})
    stale = await client.post("/auth/refresh", json={"refresh_token": started["refresh_token"]})
    assert stale.status_code == 401 and stale.json()["error"]["code"] == "session_ended"
    row = await db[sessions.COLLECTION].find_one({"sid": started["sid"]})
    assert row["revoked_at"] and row["revoked_reason"] == "refresh_reuse"


# ── owner clarification: a clear choice of channel ─────────────────────────


async def test_signup_check_sends_nothing_and_names_the_channels(api, firebase):
    client, db, made, sent = api
    email, phone = f"own-chk-{_tag()}@example.com", _phone()
    made["addresses"] += [email, phone]
    r = await client.post("/auth/signup/check", json={"email": email, "phone": phone})
    assert r.status_code == 200 and r.json()["channels"] == ["email", "sms"]
    assert sent == [] and await db[codes.COLLECTION].count_documents({"destination": email}) == 0
    her = await _user(db, made)
    known = await client.post("/auth/signup/check", json={"email": her["email"], "phone": _phone()})
    assert known.status_code == 409 and known.json()["error"]["code"] == "already_registered"
    taken = await client.post("/auth/signup/check", json={"email": email, "phone": her["phone"]})
    assert taken.status_code == 409 and taken.json()["error"]["code"] == "phone_taken"


async def test_signup_check_offers_email_only_without_firebase(api):
    client, _, made, _ = api
    email, phone = f"own-chk2-{_tag()}@example.com", _phone()
    made["addresses"] += [email, phone]
    r = await client.post("/auth/signup/check", json={"email": email, "phone": phone})
    assert r.json()["channels"] == ["email"]


async def test_signin_offers_the_other_channel_when_both_are_proved(api, firebase):
    client, db, made, sent = api
    her = await _user(db, made)  # email and phone both proved
    r = await client.post("/auth/signin/start", json={"email": her["email"]})
    assert r.status_code == 200
    assert r.json()["alternate"]["channel"] == "sms"
    assert r.json()["alternate"]["destination"].endswith(her["phone"][-4:])
    a = await client.post("/auth/sms/allowance", json={"phone": her["phone"], "purpose": "signin"})
    assert a.json()["alternate"]["channel"] == "email"
    assert her["email"] not in str(a.json())  # masked, not the address


async def test_no_alternate_when_the_phone_is_unconfirmed(api, firebase):
    client, db, made, _ = api
    her = await _user(db, made, verified_phone=False)
    r = await client.post("/auth/signin/start", json={"email": her["email"]})
    assert r.status_code == 200 and r.json()["alternate"] is None


async def test_switch_from_sms_to_email_signs_her_in(api, firebase):
    client, db, made, sent = api
    her = await _user(db, made)
    start = await client.post("/auth/signin/start", json={"phone": her["phone"], "via": "email"})
    assert start.status_code == 200, start.text
    assert start.json()["channel"] == "email" and sent[-1][1] == her["email"]
    assert start.json()["alternate"] is None  # she just switched; no ping-pong offer
    wrong = await client.post("/auth/signin/verify", json={"phone": her["phone"], "via": "email", "code": "000000"})
    assert wrong.status_code == 400 or sent[-1][2] == "000000"
    ok = await client.post("/auth/signin/verify", json={"phone": her["phone"], "via": "email", "code": sent[-1][2]})
    assert ok.status_code == 200, ok.text
    assert ok.json()["user"]["email"] == her["email"]


async def test_switch_to_email_refused_for_an_unproved_email(api, firebase):
    client, db, made, _ = api
    email, phone = f"own-sw-{_tag()}@example.com", _phone()
    ticket = await _join_by_sms(client, made, firebase, email, phone)
    done = await client.post("/auth/signup/complete", json={
        "ticket": ticket.json()["ticket"], "full_name": "Meena Devi", "is_woman_18_plus": True})
    _forget(made, await db["users"].find_one({"email": email}))
    assert done.status_code == 201
    r = await client.post("/auth/signin/start", json={"phone": phone, "via": "email"})
    assert r.status_code == 409 and r.json()["error"]["code"] == "email_unconfirmed"


# ── owner bug: no email to staff on every member sign-in ───────────────────


async def test_a_member_signin_emails_no_staff(api, monkeypatch):
    client, db, made, sent = api
    await _user(db, made, role="Super Admin")
    her = await _user(db, made)
    mails: list[tuple[str, str]] = []

    async def _send(message, to, *a, **k):
        mails.append((to, message.subject))
        return True

    monkeypatch.setattr(mailer, "send", _send)
    await client.post("/auth/signin/start", json={"email": her["email"]})
    ok = await client.post("/auth/signin/verify", json={"email": her["email"], "code": sent[-1][2]})
    assert ok.status_code == 200
    assert mails == []
    assert not hasattr(mailer, "member_login_alert_email")
    logged = await db["activity_log"].find_one({"user_id": str(her["_id"]), "action": "security.signin"})
    assert logged is not None  # still in the activity log


# ── "Skip for now" on /app/phone ───────────────────────────────────────────


async def test_phone_later_is_a_voluntary_skip_with_a_proved_email(api):
    client, db, made, _ = api
    her = await _user(db, made, verified_phone=False)  # email proved
    tokens = await sessions.start(None, her)
    r = await client.post("/auth/phone/later", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert r.status_code == 200 and r.json()["deferred_until"]


async def test_phone_later_still_refused_without_a_proved_email(api, monkeypatch):
    client, db, made, _ = api
    her = await _user(db, made, verified_phone=False)
    await db["users"].update_one({"_id": her["_id"]}, {"$set": {"email_verified_at": None}})
    tokens = await sessions.start(None, her)
    r = await client.post("/auth/phone/later", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert r.status_code == 400


def test_the_code_is_first_and_the_images_are_stills():
    spec = mailer.code_email("Asha", "390123", "signin")
    html = spec.html
    assert ".gif" not in html
    assert "logo-still.jpg" in html and "lotus-still.png" in html and "Animated" not in html
    assert html.index("390123", html.index("<body")) < html.index("logo-still.jpg")  # code above the logo
    assert "390123" in html[:html.index("<table")]  # in the preheader too
