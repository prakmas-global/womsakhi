"""
Teach and learn, end to end: a member posts a course, another joins it, pays
the teacher directly, the teacher confirms, and the learner works through the
lessons to the end.

Runs against the throwaway local mongod on 127.0.0.1:27099 (skipped when it is
not running). Every row this module writes is removed afterwards.
"""

import uuid
from datetime import datetime, timezone

import httpx
import pytest
from bson import ObjectId

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
    made = {"users": [], "programs": []}
    transport = httpx.ASGITransport(app=app)
    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://test/api/v1") as client:
            yield client, db, made
    finally:
        uids = [str(u) for u in made["users"]]
        pids = [str(p) for p in made["programs"]]
        await db["users"].delete_many({"_id": {"$in": made["users"]}})
        await db["programs"].delete_many({"_id": {"$in": made["programs"]}})
        await db["enrollments"].delete_many({"program_id": {"$in": pids}})
        await db["book_entries"].delete_many({"user_id": {"$in": uids}})
        await db["member_notifications"].delete_many({"user_id": {"$in": uids}})
        await db[sessions.COLLECTION].delete_many({"user_id": {"$in": uids}})
        await db["certificates"].delete_many({"user_id": {"$in": uids}})
        cache.clear()
        mongodb._client, mongodb._db = None, None


async def _member(db, made, name: str, status: str = "active") -> tuple[dict, dict]:
    now = datetime.now(timezone.utc)
    doc = {
        "full_name": name, "email": f"teach-{uuid.uuid4().hex[:10]}@example.com", "phone": "",
        "email_verified_at": now, "role": "Member", "is_active": True, "token_version": 0,
        "verification_status": status, "created_at": now, "updated_at": now,
    }
    doc["_id"] = (await db["users"].insert_one(doc)).inserted_id
    made["users"].append(doc["_id"])
    tokens = await sessions.start(None, doc)
    return doc, {"Authorization": f"Bearer {tokens['access_token']}"}


def _course(**over) -> dict:
    body = {
        "name": "Blouse Stitching Basics",
        "desc": "Measure, cut and stitch a simple blouse you can sell.",
        "category": "Handicrafts",
        "price_rupees": 0,
        "upi_id": "",
        "lessons": [
            {"title": "Measurements", "detail": "Bust, waist, length", "body": "Measure over a well-fitting blouse."},
            {"title": "Cutting", "body": "Fold the fabric right side in.", "video_url": "https://youtu.be/abc"},
        ],
        "publish": True,
    }
    body.update(over)
    return body


async def _post(client, made, headers, **over) -> dict:
    got = await client.post("/teach/courses", json=_course(**over), headers=headers)
    assert got.status_code == 201, got.text
    made["programs"].append(ObjectId(got.json()["id"]))
    return got.json()


async def test_a_paid_course_from_post_to_certificate(api):
    client, db, made = api
    teacher, t = await _member(db, made, "Priya Teacher")
    learner, l = await _member(db, made, "Asha Learner")

    course = await _post(client, made, t, price_rupees=499, upi_id="priya@okaxis")
    assert course["live"] and course["price_minor"] == 49900 and course["lesson_count"] == 2

    # Live in Learn, with her name and price — and never her lesson text.
    catalog = (await client.get("/catalog/programs", headers=l)).json()
    row = next(r for r in catalog if r["id"] == course["id"])
    assert row["teacher_name"] == "Priya Teacher" and row["price_minor"] == 49900 and row["owner_kind"] == "member"
    assert all("body" not in m and "video_url" not in m for m in row["curriculum"])
    assert "upi_id" not in row

    # Before joining: the outline, no lessons, no UPI id.
    detail = (await client.get(f"/me/programs/{course['id']}/detail", headers=l)).json()
    assert not detail["can_learn"] and detail["upi_id"] == "" and "body" not in detail["curriculum"][0]

    joined = await client.post(f"/me/programs/{course['id']}/enroll", headers=l)
    assert joined.status_code == 201 and joined.json()["status"] == "pending"
    detail = (await client.get(f"/me/programs/{course['id']}/detail", headers=l)).json()
    assert detail["upi_id"] == "priya@okaxis" and detail["payment_status"] == "awaiting" and not detail["can_learn"]
    # Lessons stay shut while she has not been confirmed.
    shut = await client.post(f"/me/programs/{course['id']}/lessons/1/complete", headers=l)
    assert shut.status_code == 403

    claimed = await client.post(f"/me/programs/{course['id']}/paid", json={"reference": "UTR123"}, headers=l)
    assert claimed.status_code == 200 and claimed.json()["payment_status"] == "claimed"

    learners = (await client.get(f"/teach/courses/{course['id']}/learners", headers=t)).json()
    assert learners[0]["name"] == "Asha Learner" and learners[0]["payment_status"] == "claimed"
    assert learners[0]["reference"] == "UTR123"
    # Only the teacher can confirm.
    assert (await client.post(f"/teach/learners/{learners[0]['enrollment_id']}/confirm", headers=l)).status_code == 404
    ok = await client.post(f"/teach/learners/{learners[0]['enrollment_id']}/confirm", headers=t)
    assert ok.status_code == 200 and ok.json()["status"] == "active"
    again = await client.post(f"/teach/learners/{learners[0]['enrollment_id']}/confirm", headers=t)
    assert again.status_code == 409

    # Earn: her income book and her teaching numbers.
    entry = await db["book_entries"].find_one({"user_id": str(teacher["_id"])})
    assert entry["minor"] == 49900 and entry["via"] == "course" and entry["who"] == "Asha Learner"
    summary = (await client.get("/teach/summary", headers=t)).json()
    assert summary["earned_minor"] == 49900 and summary["month_minor"] == 49900 and summary["learners"] == 1

    # Now the lessons open, with their text and video.
    detail = (await client.get(f"/me/programs/{course['id']}/detail", headers=l)).json()
    assert detail["can_learn"] and detail["curriculum"][1]["video_url"] == "https://youtu.be/abc"
    one = (await client.post(f"/me/programs/{course['id']}/lessons/1/complete", headers=l)).json()
    assert one["progress"] == 50 and one["curriculum"][0]["done"] and not one["curriculum"][1]["done"]
    two = (await client.post(f"/me/programs/{course['id']}/lessons/2/complete", headers=l)).json()
    assert two["progress"] == 100 and two["status"] == "completed"
    cert = await client.post(f"/me/programs/{course['id']}/certificate", headers=l)
    assert cert.status_code == 200, cert.text


async def test_a_free_course_opens_at_once(api):
    client, db, made = api
    _, t = await _member(db, made, "Neha Teacher")
    _, l = await _member(db, made, "Rekha Learner")
    course = await _post(client, made, t)
    joined = await client.post(f"/me/programs/{course['id']}/enroll", headers=l)
    assert joined.status_code == 201 and joined.json()["status"] == "active"
    detail = (await client.get(f"/me/programs/{course['id']}/detail", headers=l)).json()
    assert detail["can_learn"] and detail["curriculum"][0]["body"]


async def test_a_declined_payment_gives_the_seat_back(api):
    client, db, made = api
    _, t = await _member(db, made, "Kavita Teacher")
    _, l = await _member(db, made, "Sunita Learner")
    course = await _post(client, made, t, price_rupees=299, upi_id="kavita@oksbi")
    await client.post(f"/me/programs/{course['id']}/enroll", headers=l)
    eid = (await client.get(f"/teach/courses/{course['id']}/learners", headers=t)).json()[0]["enrollment_id"]
    no = await client.post(f"/teach/learners/{eid}/decline", json={"note": "Not received"}, headers=t)
    assert no.status_code == 200 and no.json()["status"] == "withdrawn"
    program = await db["programs"].find_one({"_id": ObjectId(course["id"])})
    assert program["enrolled"] == 0
    # She can try again.
    assert (await client.post(f"/me/programs/{course['id']}/enroll", headers=l)).status_code == 201


async def test_rules_for_posting_and_joining(api):
    client, db, made = api
    _, t = await _member(db, made, "Owner")
    _, waiting = await _member(db, made, "Still In Review", status="in_review")
    # A paid course needs a UPI id, and a price of at least Rs 10.
    no_upi = await client.post("/teach/courses", json=_course(price_rupees=100), headers=t)
    assert no_upi.status_code == 422
    too_cheap = await client.post("/teach/courses", json=_course(price_rupees=5, upi_id="a@okaxis"), headers=t)
    assert too_cheap.status_code == 422
    # Only verified members teach.
    assert (await client.post("/teach/courses", json=_course(), headers=waiting)).status_code == 403
    course = await _post(client, made, t)
    # Not her own.
    assert (await client.post(f"/me/programs/{course['id']}/enroll", headers=t)).status_code == 409
    # A draft is not in Learn.
    draft = await _post(client, made, t, name="Draft Course Here", publish=False)
    catalog = (await client.get("/catalog/programs", headers=t)).json()
    assert draft["id"] not in {r["id"] for r in catalog}
    assert next(r for r in catalog if r["id"] == course["id"])["is_mine"]
    # Someone else's course is not hers to edit.
    _, other = await _member(db, made, "Other")
    assert (await client.put(f"/teach/courses/{course['id']}", json=_course(), headers=other)).status_code == 404


async def test_staff_can_hide_a_member_course_but_not_rewrite_its_lessons(api):
    client, db, made = api
    teacher, t = await _member(db, made, "Member Teacher")
    course = await _post(client, made, t)
    now = datetime.now(timezone.utc)
    admin = {"full_name": "Admin", "email": f"adm-{uuid.uuid4().hex[:8]}@example.com", "role": "Super Admin",
             "is_active": True, "token_version": 0, "verification_status": "active", "created_at": now, "updated_at": now}
    admin["_id"] = (await db["users"].insert_one(admin)).inserted_id
    made["users"].append(admin["_id"])
    a = {"Authorization": f"Bearer {(await sessions.start(None, admin))['access_token']}"}
    rewrite = await client.put(f"/programs/{course['id']}/modules", json={"modules": [{"title": "X"}]}, headers=a)
    assert rewrite.status_code == 409
    hidden = await client.post(f"/programs/{course['id']}/archive", headers=a)
    assert hidden.status_code == 200, hidden.text
    # Hidden from Learn, and she cannot put it back herself.
    assert course["id"] not in {r["id"] for r in (await client.get("/catalog/programs", headers=t)).json()}
    assert (await client.post(f"/teach/courses/{course['id']}/publish", headers=t)).status_code == 409


# ── mentoring ───────────────────────────────────────────────────────────────


def _mentor_body(**over) -> dict:
    body = {
        "headline": "I run a tailoring unit of 12 women",
        "bio": "Twelve years of stitching and running a small unit. I can help you price, plan and find customers.",
        "expertise": ["Tailoring", "Pricing"], "languages": ["Hindi", "English"],
        "experience_years": 12, "session_mode": "Video call", "session_minutes": 30,
        "price_rupees": 0, "upi_id": "",
    }
    body.update(over)
    return body


async def test_a_member_becomes_a_mentor_and_runs_a_paid_session(api):
    client, db, made = api
    mentor, m = await _member(db, made, "Lakshmi Mentor")
    learner, l = await _member(db, made, "Asha Learner")
    # Live at once, no approval.
    prof = await client.put("/mentoring/me", json=_mentor_body(price_rupees=200, upi_id="lakshmi@okaxis"), headers=m)
    assert prof.status_code == 200 and prof.json()["live"], prof.text
    mid = prof.json()["id"]
    try:
        listed = (await client.get("/growth/mentors", headers=l)).json()
        row = next(r for r in listed if r["id"] == mid)
        assert row["owner_kind"] == "member" and row["price_minor"] == 20000 and "upi_id" not in row
        # Not her own.
        assert (await client.post(f"/growth/mentors/{mid}/request", json={"goal": "x"}, headers=m)).status_code == 409

        asked = await client.post(f"/growth/mentors/{mid}/request", json={"goal": "Help me price my blouses"}, headers=l)
        assert asked.status_code == 201, asked.text
        incoming = (await client.get("/mentoring/requests", headers=m)).json()
        rid = incoming[0]["id"]
        assert incoming[0]["learner"] == "Asha Learner" and incoming[0]["status"] == "pending"
        # Only she answers it.
        assert (await client.post(f"/mentoring/requests/{rid}/accept", json={"scheduled_for": "Sat 11am", "meeting": "https://meet.google.com/abc"}, headers=l)).status_code == 404
        ok = await client.post(f"/mentoring/requests/{rid}/accept", json={"scheduled_for": "Sat 11am", "meeting": "https://meet.google.com/abc"}, headers=m)
        assert ok.status_code == 200 and ok.json()["payment_status"] == "awaiting"

        mine = (await client.get("/growth/mentors/requests/mine", headers=l)).json()[0]
        # Paid and unpaid: she sees where to pay, not yet how to meet.
        assert mine["upi_id"] == "lakshmi@okaxis" and mine["meeting"] == "" and mine["scheduled_for"] == "Sat 11am"
        claimed = await client.post(f"/growth/mentors/requests/{rid}/paid", json={"reference": "UTR9"}, headers=l)
        assert claimed.status_code == 200 and claimed.json()["payment_status"] == "claimed"
        got = await client.post(f"/mentoring/requests/{rid}/payment-received", headers=m)
        assert got.status_code == 200 and got.json()["payment_status"] == "paid"
        mine = (await client.get("/growth/mentors/requests/mine", headers=l)).json()[0]
        assert mine["meeting"] == "https://meet.google.com/abc" and mine["upi_id"] == ""
        entry = await db["book_entries"].find_one({"user_id": str(mentor["_id"]), "via": "mentoring"})
        assert entry["minor"] == 20000

        assert (await client.post(f"/mentoring/requests/{rid}/done", headers=m)).json()["status"] == "closed"
        services = (await client.get("/services/me", headers=m)).json()
        assert services["mentor"]["active"] and services["mentor"]["earned_minor"] == 20000
        assert not services["seller"]["active"] and not services["teacher"]["active"]

        # Paused: gone from Mentors.
        await client.post("/mentoring/me/pause", headers=m)
        assert mid not in {r["id"] for r in (await client.get("/growth/mentors", headers=l)).json()}
    finally:
        await db["mentors"].delete_one({"_id": ObjectId(mid)})
        await db["mentorship_requests"].delete_many({"mentor_id": mid})


async def test_a_free_mentor_shows_how_to_meet_on_accepting(api):
    client, db, made = api
    _, m = await _member(db, made, "Free Mentor")
    _, l = await _member(db, made, "Learner Two")
    mid = (await client.put("/mentoring/me", json=_mentor_body(), headers=m)).json()["id"]
    try:
        await client.post(f"/growth/mentors/{mid}/request", json={"goal": "Start a tiffin service"}, headers=l)
        rid = (await client.get("/mentoring/requests", headers=m)).json()[0]["id"]
        await client.post(f"/mentoring/requests/{rid}/accept", json={"scheduled_for": "Mon 5pm", "meeting": "Call 98765 43210"}, headers=m)
        mine = (await client.get("/growth/mentors/requests/mine", headers=l)).json()[0]
        assert mine["meeting"] == "Call 98765 43210" and mine["payment_status"] == ""
        # A paid profile needs a UPI id.
        bad = await client.put("/mentoring/me", json=_mentor_body(price_rupees=100), headers=m)
        assert bad.status_code == 422
    finally:
        await db["mentors"].delete_one({"_id": ObjectId(mid)})
        await db["mentorship_requests"].delete_many({"mentor_id": mid})


# ── course Q&A ──────────────────────────────────────────────────────────────


async def test_course_questions_answers_and_the_teachers_green_check(api):
    client, db, made = api
    teacher, t = await _member(db, made, "Teacher Q")
    asker, a = await _member(db, made, "Asker Q")
    helper, h = await _member(db, made, "Helper Q")
    _, outsider = await _member(db, made, "Outsider Q")
    course = await _post(client, made, t)
    cid = course["id"]
    try:
        for hdr in (a, h):
            assert (await client.post(f"/me/programs/{cid}/enroll", headers=hdr)).status_code == 201
        # Only people in the course.
        assert (await client.get(f"/courses/{cid}/qa", headers=outsider)).status_code == 403
        assert (await client.post(f"/courses/{cid}/qa", json={"body": "Hello there"}, headers=outsider)).status_code == 403

        q = await client.post(f"/courses/{cid}/qa", json={"body": "How much margin for the seam?", "lesson": 2}, headers=a)
        assert q.status_code == 201, q.text
        qid = q.json()["id"]
        assert q.json()["lesson_title"] == "Cutting"
        ans = await client.post(f"/courses/{cid}/qa/{qid}/answers", json={"body": "Half an inch."}, headers=h)
        assert ans.status_code == 200 and not ans.json()["resolved"]
        aid = ans.json()["answers"][0]["id"]

        # A learner cannot verify; the teacher can, and it shows.
        assert (await client.post(f"/courses/{cid}/qa/{qid}/answers/{aid}/verify", headers=a)).status_code == 403
        ok = await client.post(f"/courses/{cid}/qa/{qid}/answers/{aid}/verify", headers=t)
        assert ok.status_code == 200 and ok.json()["answers"][0]["verified"] and ok.json()["resolved"]

        listed = (await client.get(f"/courses/{cid}/qa", headers=h)).json()
        assert listed["questions"][0]["answers"][0]["verified"] and listed["unanswered"] == 0
        assert (await client.get(f"/courses/{cid}/qa?lesson=1", headers=h)).json()["questions"] == []

        # The teacher answers: her answer carries the badge and resolves it.
        q2 = (await client.post(f"/courses/{cid}/qa", json={"body": "Which fabric to start with?"}, headers=a)).json()
        mine = (await client.post(f"/courses/{cid}/qa/{q2['id']}/answers", json={"body": "Cotton."}, headers=t)).json()
        assert mine["answers"][0]["by_teacher"] and mine["resolved"]

        # Someone else's answer is not hers to remove; the teacher can remove any.
        assert (await client.delete(f"/courses/{cid}/qa/{qid}/answers/{aid}", headers=a)).status_code == 403
        assert (await client.delete(f"/courses/{cid}/qa/{qid}", headers=t)).status_code == 204
        note = await db["member_notifications"].find_one({"user_id": str(helper["_id"]), "title": "Your answer was marked correct"})
        assert note
    finally:
        await db["course_questions"].delete_many({"program_id": cid})


async def test_free_preview_lessons_open_before_joining(api):
    client, db, made = api
    _, t = await _member(db, made, "Preview Teacher")
    _, l = await _member(db, made, "Preview Learner")
    lessons = [
        {"title": "Welcome", "body": "What you will make.", "video_url": "https://youtu.be/teaser1", "preview": True},
        {"title": "Measuring", "body": "Paid content.", "video_url": "https://youtu.be/paid1"},
    ]
    course = await _post(client, made, t, price_rupees=299, upi_id="teacher@okaxis", lessons=lessons)
    detail = (await client.get(f"/me/programs/{course['id']}/detail", headers=l)).json()
    assert not detail["can_learn"]
    assert detail["curriculum"][0]["preview"] and detail["curriculum"][0]["video_url"] == "https://youtu.be/teaser1"
    assert "video_url" not in detail["curriculum"][1] and "body" not in detail["curriculum"][1]
    row = next(r for r in (await client.get("/catalog/programs", headers=l)).json() if r["id"] == course["id"])
    assert row["curriculum"][0]["preview"] and "video_url" not in row["curriculum"][0]
    # Watching a preview is not progress: the lessons still need joining.
    assert (await client.post(f"/me/programs/{course['id']}/lessons/1/complete", headers=l)).status_code == 403
    too_many = [dict(x, preview=True) for x in lessons] + [{"title": "Third", "preview": True}]
    assert (await client.post("/teach/courses", json=_course(lessons=too_many), headers=t)).status_code == 422


# ── prove your skills: certificate and verified-skill badge ────────────────


async def test_passing_a_skill_test_gives_a_certificate_and_a_badge(api):
    from app.models.skills import AssessmentModel

    client, db, made = api
    her, h = await _member(db, made, "Skill Prover")
    test = AssessmentModel.create_document(
        skill="Tailoring", title="Test tailoring", minutes=10, pass_mark=70,
        questions=[{"ask": f"Q{i}", "options": ["a", "b"], "answer": 1} for i in range(4)],
    )
    test["_id"] = (await db["assessments"].insert_one(test)).inserted_id
    tid = str(test["_id"])
    try:
        fail = await client.post(f"/assess/{tid}/attempt", json={"answers": [0, 0, 1, 1]}, headers=h)
        assert fail.status_code == 201 and not fail.json()["passed"] and fail.json()["certificate_code"] == ""
        assert (await client.get("/me/skills", headers=h)).json() == []

        ok = await client.post(f"/assess/{tid}/attempt", json={"answers": [1, 1, 1, 0]}, headers=h)
        assert ok.status_code == 201 and ok.json()["passed"] and ok.json()["score"] == 75
        code = ok.json()["certificate_code"]
        assert code
        better = await client.post(f"/assess/{tid}/attempt", json={"answers": [1, 1, 1, 1]}, headers=h)
        assert better.json()["certificate_code"] == code  # one certificate, best grade

        skills = (await client.get("/me/skills", headers=h)).json()
        assert skills == [{"skill": "Tailoring", "title": "Test tailoring", "score": 100, "code": code}]
        profile = (await client.get("/me/profile", headers=h)).json()
        assert profile["verified_skills"][0]["skill"] == "Tailoring"
        certs = (await client.get("/me/certificates", headers=h)).json()
        assert any(c["code"] == code and "Verified skill" in c["program_name"] and c["grade"] == "100%" for c in certs)
        public = await client.get(f"/public/certificates/{code}")
        assert public.status_code == 200, public.text
    finally:
        await db["assessments"].delete_one({"_id": test["_id"]})
        await db["assessment_attempts"].delete_many({"assessment_id": tid})
