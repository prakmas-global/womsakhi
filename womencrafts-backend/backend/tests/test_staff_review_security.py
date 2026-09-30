"""
Security fixes in the staff, verification and profile routes.

  · Accepting a staff invitation cannot lift a suspension (M5).
  · A scoped reviewer sees and acts only on applicants in her scope (L6).
  · Moving the authenticator is rate limited and emails her (L7).
  · Profile forms normalise a phone and refuse one another account holds.
  · A reviewer download with a Telugu filename does not 500.

Runs the real app in-process against the throwaway local mongod on
127.0.0.1:27099 (skipped when it is not running). Every row written here is
tracked by id and only those ids are cleaned up; no email leaves the process.
"""

import uuid
from datetime import datetime, timezone
from urllib.parse import quote

import httpx
import pytest
from bson import ObjectId

from app.core import cache, ratelimit, sessions
from app.core import email as mailer
from app.core.config import settings
from app.core.two_factor import code_at, encrypt_secret, new_secret
from app.db import mongodb
from app.models.staff_account import StaffInviteModel
from tests.conftest import LOCAL_MONGO_DB

ORIGIN_IP = "198.51.100.{n}"


@pytest.fixture
async def api(local_mongo, monkeypatch):
    monkeypatch.setattr(settings, "DB_NAME", LOCAL_MONGO_DB)
    monkeypatch.setattr(settings, "REDIS_URL", "")
    mongodb._client, mongodb._db = local_mongo, None
    cache.clear()
    ratelimit._hits.clear()
    db = mongodb.get_database()
    monkeypatch.setattr(ratelimit, "db_provider", lambda: db)

    sent: list[tuple[str, str]] = []

    async def fake_send(message, to):  # nothing leaves this process
        sent.append((to, message.subject))
        return True

    monkeypatch.setattr(mailer, "send", fake_send)
    from main import app

    created: dict[str, list] = {"users": [], "members": [], "staff_invites": [], "verification_documents": []}
    state = {"sent": sent, "files": [], "rl_keys": []}
    transport = httpx.ASGITransport(app=app)
    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://test/api/v1") as client:
            yield client, db, created, state
    finally:
        for coll, ids in created.items():
            ids = [i for i in ids if i]
            assert all(isinstance(i, ObjectId) for i in ids)
            if ids:
                await db[coll].delete_many({"_id": {"$in": ids}})
        user_ids = [str(i) for i in created["users"] if i]
        if user_ids:
            await db[sessions.COLLECTION].delete_many({"user_id": {"$in": user_ids}})
            await db["staff_invites"].delete_many({"user_id": {"$in": user_ids}})
            await db["activity_log"].delete_many({"user_id": {"$in": user_ids}})
        keys = [k for k in state["rl_keys"] if k and k.startswith("mfa:")]
        if keys:
            await db[ratelimit.COLLECTION].delete_many({"key": {"$in": keys}})
        for path in state["files"]:
            path.unlink(missing_ok=True)
        ratelimit._hits.clear()
        mongodb._client, mongodb._db = None, None


def _tag() -> str:
    return uuid.uuid4().hex[:10]


def _phone() -> str:
    return f"+9198{uuid.uuid4().int % 10**8:08d}"


async def _user(db, created, *, role="Member", **extra) -> dict:
    tag = _tag()
    now = datetime.now(timezone.utc)
    doc = {
        "full_name": f"Test {tag}", "email": f"sectest-{tag}@example.com", "phone": "",
        "email_verified_at": now, "role": role, "is_active": True, "token_version": 0,
        "verification_status": "active", "created_at": now, "updated_at": now,
    }
    doc.update(extra)
    res = await db["users"].insert_one(doc)
    created["users"].append(res.inserted_id)
    doc["_id"] = res.inserted_id
    return doc


def _bearer(tokens: dict, ip: str = "") -> dict:
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    if ip:
        headers["X-Forwarded-For"] = ip
    return headers


# ── 1. accepting an invitation does not un-suspend ──────────────────────────


async def _invited_staff(db, created) -> tuple[dict, str]:
    staff = await _user(db, created, role="Test Reviewer")
    invite, raw = StaffInviteModel.create_document(
        user_id=str(staff["_id"]), email=staff["email"], invited_by="test")
    res = await db["staff_invites"].insert_one(invite)
    created["staff_invites"].append(res.inserted_id)
    return staff, raw


async def test_invite_then_suspend_then_accept_leaves_her_suspended(api):
    client, db, created, _ = api
    admin = await _user(db, created, role="Super Admin")
    admin_tokens = await sessions.start(None, admin)
    staff, raw = await _invited_staff(db, created)

    suspended = await client.post(f"/staff/{staff['_id']}/suspend", headers=_bearer(admin_tokens))
    assert suspended.status_code == 200, suspended.text
    assert suspended.json()["state"] == "suspended"
    # Suspending voids her open invitation.
    assert await db["staff_invites"].count_documents({"user_id": str(staff["_id"])}) == 0

    accepted = await client.post("/staff/accept", json={"token": raw})
    assert accepted.status_code == 400
    assert accepted.json()["error"]["message"] == "This invitation is no longer valid"
    fresh = await db["users"].find_one({"_id": staff["_id"]})
    assert fresh["is_active"] is False and not fresh.get("invite_accepted_at")


async def test_a_live_invite_for_a_suspended_account_is_refused(api):
    """Second lock: even an invite that survived (e.g. issued before this fix) cannot revive her."""
    client, db, created, _ = api
    staff, raw = await _invited_staff(db, created)
    await db["users"].update_one({"_id": staff["_id"]}, {"$set": {"is_active": False}})

    accepted = await client.post("/staff/accept", json={"token": raw})
    assert accepted.status_code == 400
    assert accepted.json()["error"]["message"] == "This invitation is no longer valid"
    fresh = await db["users"].find_one({"_id": staff["_id"]})
    assert fresh["is_active"] is False and not fresh.get("invite_accepted_at")
    invite = await db["staff_invites"].find_one({"user_id": str(staff["_id"])})
    assert invite["accepted_at"] is None  # not burned either


async def test_an_active_invitee_can_still_accept(api):
    client, db, created, _ = api
    staff, raw = await _invited_staff(db, created)
    accepted = await client.post("/staff/accept", json={"token": raw})
    assert accepted.status_code == 200, accepted.text
    fresh = await db["users"].find_one({"_id": staff["_id"]})
    assert fresh["is_active"] is True and fresh.get("invite_accepted_at")
    again = await client.post("/staff/accept", json={"token": raw})
    assert again.status_code == 400


# ── 2. reviewer scope, and 5. the Telugu filename ────────────────────────────


async def _applicant(db, created, tag: str, location: str, *, filename: str) -> tuple[dict, dict]:
    from app.routes.verification import PRIVATE_ROOT

    now = datetime.now(timezone.utc)
    member = {"full_name": f"Applicant {tag}", "email": f"sectest-m-{tag}@example.com",
              "status": "Pending", "role": "Member", "location": location, "created_at": now}
    res = await db["members"].insert_one(member)
    created["members"].append(res.inserted_id)
    user = await _user(db, created, member_id=str(res.inserted_id), full_name=f"Applicant {tag}",
                       verification_status="in_review")
    stored = f"sectest-{uuid.uuid4().hex}.jpg"
    (PRIVATE_ROOT / stored).write_bytes(b"\xff\xd8\xff test bytes")
    doc = {"user_id": str(user["_id"]), "member_id": str(res.inserted_id), "doc_type": "aadhaar",
           "status": "pending", "stored_name": stored, "original_name": filename,
           "content_type": "image/jpeg", "size": 16, "created_at": now, "access_log": []}
    dres = await db["verification_documents"].insert_one(doc)
    created["verification_documents"].append(dres.inserted_id)
    doc["_id"] = dres.inserted_id
    return user, doc


@pytest.fixture
async def review_setup(api):
    client, db, created, state = api
    from app.routes.verification import PRIVATE_ROOT

    tag = _tag()
    inside_region, outside_region = f"InTown-{tag}", f"OutTown-{tag}"
    inside, inside_doc = await _applicant(db, created, f"in-{tag}", inside_region,
                                          filename="ఆధార్ కార్డు.jpg")
    outside, outside_doc = await _applicant(db, created, f"out-{tag}", outside_region,
                                            filename="aadhaar.jpg")
    state["files"] += [PRIVATE_ROOT / inside_doc["stored_name"], PRIVATE_ROOT / outside_doc["stored_name"]]
    scoped = await _user(db, created, role=f"Test Reviewer {tag}", extra_permissions=["users.approve"],
                         staff_scope={"mode": "assigned", "regions": [inside_region]})
    unscoped = await _user(db, created, role=f"Test Reviewer {tag}", extra_permissions=["users.approve"])
    admin = await _user(db, created, role="Super Admin")
    return {
        "client": client, "db": db, "tag": tag, "sent": state["sent"],
        "inside": inside, "inside_doc": inside_doc, "outside": outside, "outside_doc": outside_doc,
        "scoped": scoped, "scoped_t": await sessions.start(None, scoped),
        "unscoped_t": await sessions.start(None, unscoped),
        "admin": admin, "admin_t": await sessions.start(None, admin),
    }


async def _queue_ids(s, tokens) -> tuple[set[str], dict]:
    got = await s["client"].get("/verification/queue", params={"state": "all", "q": s["tag"]},
                                headers=_bearer(tokens))
    assert got.status_code == 200, got.text
    body = got.json()
    return {row["user_id"] for row in body["items"]}, body["counts"]


async def test_scoped_reviewer_sees_only_her_scope_in_the_queue(review_setup):
    s = review_setup
    inside, outside = str(s["inside"]["_id"]), str(s["outside"]["_id"])
    ids, counts = await _queue_ids(s, s["scoped_t"])
    assert ids == {inside}
    # The tab counts are scoped too: only the one in-scope applicant is counted.
    assert sum(counts.values()) == 1 and counts["in_review"] == 1
    # Super Admin and an unscoped reviewer are unchanged.
    assert (await _queue_ids(s, s["admin_t"]))[0] == {inside, outside}
    assert (await _queue_ids(s, s["unscoped_t"]))[0] == {inside, outside}


async def test_scoped_reviewer_cannot_open_an_applicant_outside_her_scope(review_setup):
    s = review_setup
    client = s["client"]
    out = await client.get(f"/verification/applicants/{s['outside']['_id']}", headers=_bearer(s["scoped_t"]))
    assert out.status_code == 404 and out.json()["error"]["message"] == "Applicant not found"
    inn = await client.get(f"/verification/applicants/{s['inside']['_id']}", headers=_bearer(s["scoped_t"]))
    assert inn.status_code == 200, inn.text
    admin = await client.get(f"/verification/applicants/{s['outside']['_id']}", headers=_bearer(s["admin_t"]))
    assert admin.status_code == 200


async def test_scoped_reviewer_cannot_read_a_document_outside_her_scope(review_setup):
    s = review_setup
    client, db = s["client"], s["db"]
    out = await client.get(f"/verification/documents/{s['outside_doc']['_id']}/file",
                           headers=_bearer(s["scoped_t"]))
    assert out.status_code == 404
    # A refused read leaves no trace of her in the access log.
    row = await db["verification_documents"].find_one({"_id": s["outside_doc"]["_id"]})
    assert row["access_log"] == []
    # The unscoped reviewer still can.
    ok = await client.get(f"/verification/documents/{s['outside_doc']['_id']}/file",
                          headers=_bearer(s["unscoped_t"]))
    assert ok.status_code == 200


async def test_a_telugu_filename_downloads_with_rfc5987(review_setup):
    s = review_setup
    got = await s["client"].get(f"/verification/documents/{s['inside_doc']['_id']}/file",
                                headers=_bearer(s["scoped_t"]))
    assert got.status_code == 200, got.text
    assert got.content == b"\xff\xd8\xff test bytes"
    disposition = got.headers["content-disposition"]
    assert disposition == (
        "attachment; filename=\"document.jpg\"; filename*=UTF-8''" + quote("ఆధార్ కార్డు.jpg", safe="")
    )


def test_disposition_fallback_cannot_break_out_of_the_header():
    from app.routes.verification import _attachment_disposition

    value = _attachment_disposition('id "card"\r\nX-Evil: 1.pdf')
    value.encode("latin-1")  # sendable as a header
    assert "\r" not in value and "\n" not in value
    assert value.startswith('attachment; filename="id cardX-Evil: 1.pdf"; filename*=UTF-8\'\'')
    assert _attachment_disposition("plain.png") == "attachment; filename=\"plain.png\"; filename*=UTF-8''plain.png"


async def test_scoped_reviewer_cannot_decide_outside_her_scope(review_setup):
    s = review_setup
    client, db = s["client"], s["db"]
    out_id = s["outside"]["_id"]
    reason = {"reason": "Photo is blurred, please take it again"}
    for path, body in (("approve", None), ("reject", reason), ("request-resubmission", reason)):
        got = await client.post(f"/verification/{out_id}/{path}", json=body, headers=_bearer(s["scoped_t"]))
        assert got.status_code == 404, (path, got.text)
    fresh = await db["users"].find_one({"_id": out_id})
    assert fresh["verification_status"] == "in_review"
    assert await db["verification_documents"].count_documents({"_id": s["outside_doc"]["_id"], "status": "pending"}) == 1
    assert s["sent"] == []

    # Inside her scope she can act.
    inn = await client.post(f"/verification/{s['inside']['_id']}/request-resubmission", json=reason,
                            headers=_bearer(s["scoped_t"]))
    assert inn.status_code == 200, inn.text


async def test_assigning_checks_the_assignees_scope(review_setup):
    s = review_setup
    client = s["client"]
    body = {"admin_id": str(s["scoped"]["_id"])}
    out = await client.post(f"/verification/{s['outside']['_id']}/assign", json=body, headers=_bearer(s["admin_t"]))
    assert out.status_code == 400 and "scope" in out.json()["error"]["message"]
    inn = await client.post(f"/verification/{s['inside']['_id']}/assign", json=body, headers=_bearer(s["admin_t"]))
    assert inn.status_code == 200, inn.text


# ── 3. moving the authenticator ──────────────────────────────────────────────


async def _staff_with_authenticator(db, created) -> tuple[dict, str]:
    secret = new_secret()
    staff = await _user(db, created, role="Super Admin",
                        two_factor={"enabled": True, "secret": encrypt_secret(secret), "recovery_codes": []})
    return staff, secret


async def test_moving_the_authenticator_is_rate_limited(api):
    client, db, created, state = api
    staff, secret = await _staff_with_authenticator(db, created)
    tokens = await sessions.start(None, staff)
    ip = ORIGIN_IP.format(n=uuid.uuid4().int % 250 + 1)
    state["rl_keys"] += [f"mfa:id:{staff['_id']}", f"mfa:ip:{ip}"]

    wrong = "000000" if code_at(secret) != "000000" else "111111"
    for _ in range(6):
        got = await client.post("/staff/me/two-factor/setup", json={"code": wrong}, headers=_bearer(tokens, ip))
        assert got.status_code == 400, got.text
    blocked = await client.post("/staff/me/two-factor/setup", json={"code": wrong}, headers=_bearer(tokens, ip))
    assert blocked.status_code == 429 and blocked.headers.get("retry-after")
    # Even the right code waits out the window: that is what makes it a limit.
    right = await client.post("/staff/me/two-factor/setup", json={"code": code_at(secret)},
                              headers=_bearer(tokens, ip))
    assert right.status_code == 429
    fresh = await db["users"].find_one({"_id": staff["_id"]})
    assert not fresh.get("two_factor_pending_secret")


async def test_moving_the_authenticator_emails_her(api):
    client, db, created, state = api
    staff, secret = await _staff_with_authenticator(db, created)
    tokens = await sessions.start(None, staff)
    ip = ORIGIN_IP.format(n=uuid.uuid4().int % 250 + 1)
    state["rl_keys"] += [f"mfa:id:{staff['_id']}", f"mfa:ip:{ip}"]

    started = await client.post("/staff/me/two-factor/setup", json={"code": code_at(secret)},
                                headers=_bearer(tokens, ip))
    assert started.status_code == 200, started.text
    assert state["sent"] == []  # nothing has changed yet
    new = started.json()["secret"]
    enabled = await client.post("/staff/me/two-factor/enable", json={"code": code_at(new)},
                                headers=_bearer(tokens, ip))
    assert enabled.status_code == 200, enabled.text
    assert state["sent"] == [(staff["email"], "WomSakhi — your authenticator was changed")]


# ── 4. profile phone input ───────────────────────────────────────────────────


async def test_member_profile_phone_is_normalised(api):
    client, db, created, _ = api
    user = await _user(db, created)
    tokens = await sessions.start(None, user)
    phone = _phone()
    typed = f"0{phone[3:8]} {phone[8:]}"  # "098xxx xxxxx", as she might type it
    got = await client.patch("/me/profile", json={"phone": typed}, headers=_bearer(tokens))
    assert got.status_code == 200, got.text
    fresh = await db["users"].find_one({"_id": user["_id"]})
    assert fresh["phone"] == phone and fresh["phone_verified_at"] is None

    bad = await client.patch("/me/profile", json={"phone": "12345"}, headers=_bearer(tokens))
    assert bad.status_code == 422
    assert (await db["users"].find_one({"_id": user["_id"]}))["phone"] == phone


async def test_member_profile_refuses_a_number_another_account_holds(api):
    client, db, created, _ = api
    taken = _phone()
    await _user(db, created, phone=taken, phone_verified_at=datetime.now(timezone.utc))
    user = await _user(db, created, full_name="Before Name")
    tokens = await sessions.start(None, user)
    other_device = await sessions.start(None, user)
    got = await client.patch("/me/profile", json={"phone": taken, "full_name": "After Name"},
                             headers=_bearer(tokens))
    assert got.status_code == 409
    error = got.json()["error"]
    assert error["code"] == "phone_taken"
    assert error["message"] == "This mobile number is already linked to another account."
    fresh = await db["users"].find_one({"_id": user["_id"]})
    assert fresh["phone"] == "" and fresh["full_name"] == "Before Name"  # nothing saved
    me = await client.get("/auth/me", headers=_bearer(other_device))
    assert me.status_code == 200  # and nobody signed out


async def test_staff_profile_phone_is_normalised_and_checked(api):
    client, db, created, _ = api
    taken = _phone()
    await _user(db, created, phone=taken, phone_verified_at=datetime.now(timezone.utc))
    staff = await _user(db, created, role="Super Admin")
    tokens = await sessions.start(None, staff)

    clash = await client.put("/staff/profile", json={"phone": taken[3:]}, headers=_bearer(tokens))
    assert clash.status_code == 409
    assert clash.json()["error"]["code"] == "phone_taken"

    bad = await client.put("/staff/profile", json={"phone": "not a number"}, headers=_bearer(tokens))
    assert bad.status_code == 422

    phone = _phone()
    ok = await client.put("/staff/profile", json={"phone": phone[3:]}, headers=_bearer(tokens))
    assert ok.status_code == 200, ok.text
    assert ok.json()["phone"] == phone
    fresh = await db["users"].find_one({"_id": staff["_id"]})
    assert fresh["phone"] == phone and fresh["phone_verified_at"] is None

    # Her own number, typed differently, is not a change and not a clash.
    same = await client.put("/staff/profile", json={"phone": f"0{phone[3:]}"}, headers=_bearer(tokens))
    assert same.status_code == 200


# ── follow-ups: support threads, staff phone edits, member-set location ─────


async def test_support_threads_obey_the_reviewers_scope(review_setup):
    from app.models.conversation import MemberMessageModel

    s = review_setup
    client, db = s["client"], s["db"]
    rows = []
    for who in ("inside", "outside"):
        user = s[who]
        rows.append(MemberMessageModel.create_document(
            user_id=str(user["_id"]), member_id=user["member_id"], body=f"help {s['tag']}"))
    res = await db["member_messages"].insert_many(rows)
    try:
        inside, outside = str(s["inside"]["_id"]), str(s["outside"]["_id"])

        async def thread_ids(tokens) -> set[str]:
            got = await client.get("/verification/threads", headers=_bearer(tokens))
            assert got.status_code == 200, got.text
            return {t["user_id"] for t in got.json()} & {inside, outside}

        assert await thread_ids(s["scoped_t"]) == {inside}
        assert await thread_ids(s["admin_t"]) == {inside, outside}
        assert await thread_ids(s["unscoped_t"]) == {inside, outside}

        out = await client.post(f"/verification/threads/{outside}/reply", json={"body": "Hello there"},
                                headers=_bearer(s["scoped_t"]))
        assert out.status_code == 404 and out.json()["error"]["message"] == "Member not found"
        assert await db["member_messages"].count_documents({"user_id": outside, "sender": "team"}) == 0
        inn = await client.post(f"/verification/threads/{inside}/reply", json={"body": "Hello there"},
                                headers=_bearer(s["scoped_t"]))
        assert inn.status_code == 201, inn.text
    finally:
        ids = list(res.inserted_ids)
        assert ids and all(isinstance(i, ObjectId) for i in ids)
        await db["member_messages"].delete_many({"_id": {"$in": ids}})
        uids = [str(s["inside"]["_id"]), str(s["outside"]["_id"])]
        await db["member_messages"].delete_many({"user_id": {"$in": uids}, "sender": "team"})
        await db["member_notifications"].delete_many({"user_id": {"$in": uids}})


async def _directory_member(db, created, *, phone="") -> tuple[dict, dict]:
    tag = _tag()
    member = {"full_name": f"Member {tag}", "email": f"sectest-d-{tag}@example.com", "phone": phone,
              "status": "Active", "role": "Member", "location": f"HomeTown-{tag}",
              "created_at": datetime.now(timezone.utc)}
    res = await db["members"].insert_one(member)
    created["members"].append(res.inserted_id)
    member["_id"] = res.inserted_id
    user = await _user(db, created, member_id=str(res.inserted_id), email=member["email"], phone=phone,
                       phone_verified_at=datetime.now(timezone.utc) if phone else None)
    return member, user


async def test_staff_edit_of_a_members_phone_is_normalised_and_checked(api):
    client, db, created, _ = api
    admin = await _user(db, created, role="Super Admin")
    admin_t = await sessions.start(None, admin)
    old = _phone()
    member, user = await _directory_member(db, created, phone=old)
    her = await sessions.start(None, user)
    taken = _phone()
    await _user(db, created, phone=taken, phone_verified_at=datetime.now(timezone.utc))

    clash = await client.patch(f"/members/{member['_id']}", json={"phone": taken[3:], "full_name": "Changed"},
                               headers=_bearer(admin_t))
    assert clash.status_code == 409
    assert clash.json()["error"]["code"] == "phone_taken"
    assert clash.json()["error"]["message"] == "This mobile number is already linked to another account."
    bad = await client.patch(f"/members/{member['_id']}", json={"phone": "99"}, headers=_bearer(admin_t))
    assert bad.status_code == 422
    row = await db["members"].find_one({"_id": member["_id"]})
    assert row["phone"] == old and row["full_name"] == member["full_name"]  # nothing saved
    assert (await client.get("/auth/me", headers=_bearer(her))).status_code == 200

    # Her own number, typed differently, is not a change: nobody is signed out.
    same = await client.patch(f"/members/{member['_id']}", json={"phone": f"0{old[3:]}"}, headers=_bearer(admin_t))
    assert same.status_code == 200, same.text
    assert (await client.get("/auth/me", headers=_bearer(her))).status_code == 200

    new = _phone()
    ok = await client.patch(f"/members/{member['_id']}", json={"phone": new[3:8] + " " + new[8:]},
                            headers=_bearer(admin_t))
    assert ok.status_code == 200, ok.text
    fresh = await db["users"].find_one({"_id": user["_id"]})
    assert fresh["phone"] == new and fresh["phone_verified_at"] is None
    assert (await db["members"].find_one({"_id": member["_id"]}))["phone"] == new
    # The existing rule still holds: a staff change of her number ends every session.
    assert (await client.get("/auth/me", headers=_bearer(her))).status_code == 401


async def test_a_member_cannot_move_herself_into_another_scope(api):
    client, db, created, _ = api
    member, user = await _directory_member(db, created)
    tokens = await sessions.start(None, user)
    got = await client.patch("/me/profile", json={"location": "Somewhere Else"}, headers=_bearer(tokens))
    assert got.status_code == 200, got.text
    # She sees what she typed …
    assert got.json()["location"] == "Somewhere Else"
    row = await db["members"].find_one({"_id": member["_id"]})
    # … but the directory field staff scope keys on is untouched.
    assert row["location"] == member["location"]
    assert row["display_location"] == "Somewhere Else"

    # Staff still set the scope-deciding location through members.py.
    admin = await _user(db, created, role="Super Admin")
    edited = await client.patch(f"/members/{member['_id']}", json={"location": "Staff Town"},
                                headers=_bearer(await sessions.start(None, admin)))
    assert edited.status_code == 200, edited.text
    assert (await db["members"].find_one({"_id": member["_id"]}))["location"] == "Staff Town"
