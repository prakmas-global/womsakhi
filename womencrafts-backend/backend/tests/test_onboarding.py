"""
Post-signup onboarding: answers, consents, setup, home, retention, insights.

Two halves. The pure tests at the top need nothing. The rest run the real app
in-process against the throwaway local mongod on 127.0.0.1:27099 (skipped when
it is not running). Every row written is tracked by id or by a test user's id,
and only those are cleaned up.
"""

import json
import uuid
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from bson import ObjectId

from app.core import cache, ratelimit, sessions
from app.core import email as mailer
from app.core import onboarding as ob
from app.core import skills as taxonomy
from app.core.config import settings
from app.db import mongodb
from tests.conftest import LOCAL_MONGO_DB

TAG = "obtest"


# ── pure: taxonomy and validation ───────────────────────────────────────────


def test_taxonomy_is_about_two_hundred_unique_skills_with_a_popular_dozen():
    keys = [s["key"] for s in taxonomy.SKILLS]
    assert 180 <= len(keys) <= 260
    assert len(set(keys)) == len(keys)
    assert 10 <= sum(s["popular"] for s in taxonomy.SKILLS) <= 14
    for s in taxonomy.SKILLS:
        assert s["group"] in taxonomy.GROUPS
        assert s["service_category"] in taxonomy.SERVICE_CATEGORIES


def test_skill_search_prefix_first_popular_first_and_limited():
    got = taxonomy.search("tai")
    assert got[0]["key"] == "tailoring"
    assert len(taxonomy.search("")) == 20
    assert all(s["popular"] for s in taxonomy.search("")[:10])
    assert [s["key"] for s in taxonomy.search("embroid")][:2] == ["hand_embroidery", "machine_embroidery"]
    assert taxonomy.search("zzzz") == []


@pytest.mark.parametrize("bad", [
    "https://mysite.com", "www.shop.in", "call me at x@y.com", "12345", "!!", "a",
    "Tailoring <script>", "x" * 41, "Stitching $$$",
])
def test_custom_skills_refuse_links_digits_and_symbols(bad):
    with pytest.raises(ValueError):
        ob.clean_custom_skill(bad)


@pytest.mark.parametrize("good,expected", [
    ("  Kolam   drawing ", "Kolam drawing"),
    ("3D printing", "3D printing"),
    ("Tie & dye", "Tie & dye"),
    ("ఎంబ్రాయిడరీ", "ఎంబ్రాయిడరీ"),
])
def test_custom_skills_accept_words_in_any_script(good, expected):
    assert ob.clean_custom_skill(good) == expected


def test_skills_dedupe_map_labels_to_keys_and_cap_at_ten():
    got = ob.clean_skills(["tailoring", {"custom": "TAILORING"}, {"custom": "Kolam"}, {"custom": "kolam"}])
    assert got == ["tailoring", {"custom": "Kolam"}]
    with pytest.raises(ValueError):
        ob.clean_skills([k["key"] for k in taxonomy.SKILLS[:11]])
    with pytest.raises(ValueError):
        ob.clean_skills(["not_a_skill"])
    with pytest.raises(ValueError):
        ob.clean_skills([{"custom": "x", "extra": 1}])


def test_validate_answers_keeps_skips_as_null_and_refuses_unknowns():
    assert ob.validate_answers({"goals": None}) == {"goals": None}
    assert ob.validate_answers({"goals": ["learn", "learn", "meet"]}) == {"goals": ["learn", "meet"]}
    for bad in ({"goals": ["rich"]}, {"minutes_per_day": 15}, {"minutes_per_day": True},
                {"free_times": ["night"]}, {"voice_prompts": "yes"}, {"learn_topics": ["cooking"]},
                {"meet": ["men"]}, {"income": 5}):
        with pytest.raises(ValueError):
            ob.validate_answers(bad)


# ── pure: consent rules ─────────────────────────────────────────────────────


def _p(**granted):
    return {"consents": {k: {"granted": v} for k, v in granted.items()}}


def test_employer_visibility_needs_job_updates():
    with pytest.raises(ValueError):
        ob.plan_consent_change(_p(), {"employer_visibility": True})
    assert ob.plan_consent_change(_p(), {"job_updates": True, "employer_visibility": True}) == \
        {"job_updates": True, "employer_visibility": True}
    assert ob.plan_consent_change(_p(job_updates=True), {"employer_visibility": True}) == \
        {"employer_visibility": True}
    with pytest.raises(ValueError):
        ob.plan_consent_change(_p(job_updates=True), {"job_updates": False, "employer_visibility": True})


def test_withdrawing_job_updates_withdraws_employer_visibility():
    assert ob.plan_consent_change(_p(job_updates=True, employer_visibility=True),
                                  {"job_updates": False}) == \
        {"job_updates": False, "employer_visibility": False}


# ── pure: offered, check-in, card, segment ─────────────────────────────────


def test_skip_while_waiting_is_offered_once_more_after_approval_then_never():
    waiting, active = {"verification_status": "in_review"}, {"verification_status": "active"}
    assert ob.offered(None, waiting)
    once = {"skip_count": 1, "skipped_while": "waiting"}
    assert not ob.offered(once, waiting)
    assert ob.offered(once, active)
    assert not ob.offered({"skip_count": 2, "skipped_while": "active"}, active)
    assert not ob.offered({"skip_count": 1, "skipped_while": "active"}, active)
    assert not ob.offered({"completed": True}, active)


def test_checkin_due_after_ninety_days_for_active_members_only():
    now = datetime.now(timezone.utc)
    active, waiting = {"verification_status": "active"}, {"verification_status": "in_review"}
    old = {"answers": {"goals": ["learn"]}, "updated_at": now - timedelta(days=91)}
    assert ob.checkin_due(old, active)
    assert not ob.checkin_due(old, waiting)
    assert not ob.checkin_due({**old, "last_reviewed_at": now - timedelta(days=10)}, active)
    assert not ob.checkin_due({**old, "updated_at": now - timedelta(days=89)}, active)
    assert not ob.checkin_due({"answers": {}, "updated_at": now - timedelta(days=200)}, active)
    assert ob.checkin_due(old, active, at=now) and not ob.checkin_due(old, active, at=now - timedelta(days=5))


def test_make_it_yours_card():
    full = {"answers": {"goals": ["meet"], "meet": ["new_mothers"], "free_times": ["morning"],
                        "minutes_per_day": 10}}
    assert not ob.make_it_yours(full)
    assert ob.make_it_yours({"answers": {"goals": ["learn"]}})  # topics, times, minutes missing
    assert ob.make_it_yours({"answers": {}, "skipped_at": datetime.now(timezone.utc)})
    assert not ob.make_it_yours({"answers": {"goals": ["learn"]},
                                 "card_dismissed_at": datetime.now(timezone.utc)})
    assert not ob.make_it_yours(None)


@pytest.mark.parametrize("answers,segment", [
    ({"goals": ["find_job", "sell"]}, "Job Seeker"),
    ({"goals": ["sell"], "skills": ["candle_making"]}, "Artisan"),
    ({"goals": ["earn_home"], "skills": ["tailoring"]}, "Entrepreneur"),
    ({"goals": ["sell"]}, "Entrepreneur"),
    ({"goals": ["learn"]}, "Student"),
    ({"goals": ["learn", "just_looking"]}, "Student"),
    ({"goals": ["learn", "meet"]}, None),
    ({"goals": ["shop"]}, None),
    ({}, None),
])
def test_segment_mapping(answers, segment):
    assert ob.segment_for(answers) == segment


def test_needs_mapping():
    assert ob.needs_for({"goals": ["earn_home", "learn", "find_job", "feel_good", "shop"]}) == \
        ["earn", "business", "skill", "confidence"]


def test_theme_accepts_tour_steps_but_not_others():
    from app.routes.theme import OnboardingStep, _onboarding_of

    assert OnboardingStep(step="tour-1").step == "tour-1"
    assert OnboardingStep(step="tour-7").step == "tour-7"
    for bad in ("tour-8", "tour-0", "tour-x", "tours-1"):
        with pytest.raises(ValueError):
            OnboardingStep(step=bad)
    state = _onboarding_of({"onboarding_done": ["welcome", "tour-2", "tour-1"]})
    assert state.done == ["welcome"] and state.tour_done == ["tour-1", "tour-2"]
    assert state.next_step == "appearance"


def test_retention_is_wired_into_the_hourly_sweep():
    import inspect

    from app.engines import wiring

    assert "purge_rejected_onboarding" in inspect.getsource(wiring.run_sync)


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

    async def fake_send(message, to):  # nothing leaves this process
        return True

    monkeypatch.setattr(mailer, "send", fake_send)
    ob._indexed = False
    from main import app

    started = datetime.now(timezone.utc) - timedelta(seconds=2)
    created: dict[str, list] = {"users": [], "members": [], "circles": [], "programs": [],
                                "opportunities": [], "enrollments": []}
    transport = httpx.ASGITransport(app=app)
    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://test/api/v1") as client:
            yield client, db, created
    finally:
        uids = [str(i) for i in created["users"] if i]
        assert all(isinstance(i, ObjectId) for i in created["users"])
        if uids:
            for coll in ("onboarding_profiles", "onboarding_setups", "saved_searches", "shop_listings",
                         "goals", "reminder_definitions", "reminder_occurrences", "circle_members",
                         sessions.COLLECTION, "activity_log", "enrollments"):
                await db[coll].delete_many({"user_id": {"$in": uids}})
        for coll, ids in created.items():
            ids = [i for i in ids if i]
            assert all(isinstance(i, ObjectId) for i in ids)
            if ids:
                await db[coll].delete_many({"_id": {"$in": ids}})
        # A Welcome circle this run seeded (development only) goes with it.
        await db["circles"].delete_many({"seeded_by": "onboarding-dev-seed",
                                         "created_at": {"$gte": started}})
        cache.clear()
        ratelimit._hits.clear()
        mongodb._client, mongodb._db = None, None


def _tag() -> str:
    return uuid.uuid4().hex[:10]


async def _member(db, created, *, status="active", role="Member", location="Hyderabad",
                  segment_source="", **extra) -> tuple[dict, dict]:
    tag = _tag()
    now = datetime.now(timezone.utc)
    member = {"full_name": f"Obtest {tag}", "email": f"{TAG}-{tag}@example.com",
              "phone": f"+9198{uuid.uuid4().int % 10**8:08d}", "role": role, "status": "Active",
              "location": location, "segment": "Entrepreneur", "segment_source": segment_source,
              "created_at": now, "updated_at": now}
    m = await db["members"].insert_one(member)
    created["members"].append(m.inserted_id)
    user = {"full_name": member["full_name"], "email": member["email"], "phone": member["phone"],
            "email_verified_at": now, "role": role, "is_active": True, "token_version": 0,
            "verification_status": status, "member_id": str(m.inserted_id), "locale": "te",
            "created_at": now, "updated_at": now}
    user.update(extra)
    u = await db["users"].insert_one(user)
    created["users"].append(u.inserted_id)
    user["_id"] = u.inserted_id
    tokens = await sessions.start(None, user)
    return user, {"Authorization": f"Bearer {tokens['access_token']}"}


async def _approve(db, user):
    await db["users"].update_one({"_id": user["_id"]}, {"$set": {"verification_status": "active"}})
    cache.forget_user(str(user["_id"]))


FULL = {
    "goals": ["earn_home", "find_job", "meet"],
    "skills": ["tailoring", {"custom": "Kolam drawing"}],
    "meet": ["same_skill", "new_mothers"],
    "free_times": ["evening", "weekends"],
    "minutes_per_day": 20,
    "voice_prompts": True, "helper_mode": False, "shared_phone": None,
}


async def _answered(client, h, answers=None, consents=None):
    r = await client.put("/me/onboarding", json={**(answers or FULL), "completed": True}, headers=h)
    assert r.status_code == 200, r.text
    r = await client.post("/me/onboarding/consents", json=consents or {"setup": True}, headers=h)
    assert r.status_code == 200, r.text
    return r.json()


async def _others(db, uid: str) -> dict:
    """Counts of everything setup could create in another module."""
    return {
        "listings": await db["shop_listings"].count_documents({"user_id": uid}),
        "goals": await db["goals"].count_documents({"user_id": uid}),
        "reminders": await db["reminder_definitions"].count_documents({"user_id": uid}),
        "circles_joined": await db["circle_members"].count_documents({"user_id": uid}),
        "searches": await db["saved_searches"].count_documents({"user_id": uid}),
        "applications": await db["applications"].count_documents({"user_id": uid}),
        "enrollments": await db["enrollments"].count_documents({"user_id": uid}),
    }


# ── answers, validation, guards ─────────────────────────────────────────────


async def test_waiting_member_answers_and_consents_but_cannot_set_up(api):
    client, db, created = api
    user, h = await _member(db, created, status="in_review")

    r = await client.get("/me/onboarding", headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["offered"] is True and body["completed"] is False
    assert body["consents"]["setup"]["granted"] is None  # never pre-set
    assert all(v is None for v in body["answers"].values())

    state = await _answered(client, h)
    assert state["answers"]["skills"] == ["tailoring", {"custom": "Kolam drawing"}]
    assert state["answers"]["shared_phone"] is None and "shared_phone" in state["answered"]
    assert state["consents"]["setup"]["granted"] is True
    assert state["consents"]["setup"]["notice_version"] == "onboarding-v1"
    assert state["consents"]["setup"]["language"] == "te"
    assert state["setup"]["ready"] is False

    r = await client.post("/me/onboarding/setup", headers=h)
    assert r.status_code == 403
    r = await client.post("/me/onboarding/items/goal/earn/keep", headers=h)
    assert r.status_code == 403
    # Nothing exists anywhere else for her while she waits — segment included.
    assert await _others(db, str(user["_id"])) == {k: 0 for k in await _others(db, str(user["_id"]))}
    member = await db["members"].find_one({"_id": ObjectId(user["member_id"])})
    assert member["segment_source"] == ""
    # Skills search works while waiting.
    r = await client.get("/onboarding/skills", params={"q": "tai"}, headers=h)
    assert r.status_code == 200 and r.json()["skills"][0]["key"] == "tailoring"


async def test_rejected_and_staff_accounts_are_refused(api):
    client, db, created = api
    _, rejected = await _member(db, created, status="rejected")
    _, staff = await _member(db, created, role="Super Admin")
    for h in (rejected, staff):
        assert (await client.get("/me/onboarding", headers=h)).status_code == 403
        assert (await client.put("/me/onboarding", json={"goals": ["learn"]}, headers=h)).status_code == 403
    assert (await client.get("/me/onboarding")).status_code == 401


async def test_put_validates_and_saves_one_question_at_a_time(api):
    client, db, created = api
    user, h = await _member(db, created)
    for bad in ({"goals": ["rich"]}, {"skills": ["nope"]}, {"skills": [{"custom": "www.x.com"}]},
                {"skills": [{"custom": "98765"}]}, {"minutes_per_day": 15},
                {"skills": [k["key"] for k in taxonomy.SKILLS[:11]]}):
        r = await client.put("/me/onboarding", json=bad, headers=h)
        assert r.status_code == 422, (bad, r.text)
    assert (await client.put("/me/onboarding", json={}, headers=h)).status_code == 400

    r = await client.put("/me/onboarding", json={"goals": ["learn"]}, headers=h)
    first = r.json()["updated_at"]
    r = await client.put("/me/onboarding", json={"learn_topics": ["digital", "money"]}, headers=h)
    assert r.status_code == 200
    body = r.json()
    assert body["answers"]["goals"] == ["learn"]  # untouched by a one-question save
    assert body["answers"]["learn_topics"] == ["digital", "money"]
    assert body["updated_at"] >= first
    doc = await db["onboarding_profiles"].find_one({"user_id": str(user["_id"])})
    assert doc["revision"] == 2 and "free_times" not in doc["answers"]  # never defaulted


async def test_consent_rules_over_http(api):
    client, db, created = api
    user, h = await _member(db, created, status="pending_documents")
    r = await client.post("/me/onboarding/consents", json={"employer_visibility": True}, headers=h)
    assert r.status_code == 422
    r = await client.post("/me/onboarding/consents",
                          json={"job_updates": True, "employer_visibility": True, "language": "hi"}, headers=h)
    assert r.status_code == 200
    c = r.json()["consents"]
    assert c["job_updates"]["granted"] and c["employer_visibility"]["granted"]
    assert c["setup"]["granted"] is None
    r = await client.post("/me/onboarding/consents", json={"job_updates": False}, headers=h)
    c = r.json()["consents"]
    assert c["job_updates"]["granted"] is False and c["employer_visibility"]["granted"] is False
    doc = await db["onboarding_profiles"].find_one({"user_id": str(user["_id"])})
    assert [(x["purpose"], x["granted"]) for x in doc["consent_history"]] == [
        ("job_updates", True), ("employer_visibility", True),
        ("job_updates", False), ("employer_visibility", False)]
    assert doc["consent_history"][0]["language"] == "hi"


async def test_work_profile_exists_only_with_job_updates_and_never_shows_phone(api):
    client, db, created = api
    user, h = await _member(db, created, status="in_review")
    await client.put("/me/onboarding", json=FULL, headers=h)
    r = await client.get("/me/data", headers=h)
    assert r.status_code == 200 and r.json()["work_profile"] is None

    await client.post("/me/onboarding/consents", json={"job_updates": True}, headers=h)
    wp = (await client.get("/me/data", headers=h)).json()["work_profile"]
    assert wp["verified"] is False and wp["city"] == "Hyderabad" and wp["languages"] == ["te"]
    assert wp["skills"] == ["Tailoring", "Kolam drawing"]
    assert wp["mobile"] == user["phone"] and wp["employers_see"] == []
    assert "A job in tailoring" in wp["wants"] and "Tailoring work from home" in wp["wants"]

    await client.post("/me/onboarding/consents", json={"employer_visibility": True}, headers=h)
    wp = (await client.get("/me/data", headers=h)).json()["work_profile"]
    assert wp["employers_see"] == ["name", "skills", "city"] and "mobile" not in wp["employers_see"]


# ── setup ───────────────────────────────────────────────────────────────────


async def test_setup_needs_consent_and_is_idempotent(api):
    client, db, created = api
    user, h = await _member(db, created, status="in_review")
    uid = str(user["_id"])
    await client.put("/me/onboarding", json=FULL, headers=h)
    await _approve(db, user)
    r = await client.post("/me/onboarding/setup", headers=h)
    assert r.status_code == 409  # no `setup` consent yet
    await client.post("/me/onboarding/consents", json={"setup": True}, headers=h)

    r = await client.post("/me/onboarding/setup", headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    items = {i["key"]: i for i in body["items"]}
    assert body["created"] == len(body["items"])

    listing = items["listing:skill=tailoring"]
    assert listing["state"] == "draft" and listing["visibility"] == "only_you"
    assert listing["reason"] == "Because you chose Earn · Tailoring"
    doc = await db["shop_listings"].find_one({"_id": ObjectId(listing["id"])})
    assert doc["status"] == "draft" and doc["kind"] == "service" and doc["category"] == "Tailoring"
    assert items["saved_search:jobs"]["state"] == "saved"
    assert items["goal:earn"]["state"] == "proposed" and items["goal:find_job"]["state"] == "proposed"
    reminder = items["reminder:evening"]
    assert reminder["state"] == "proposed" and reminder["proposal"]["local_time"] == "19:30"
    assert items["welcome"]["state"] == "joined"
    assert all(i["still_chosen"] for i in body["items"])
    # Proposals are proposals: no goal, no reminder, no application exists.
    before = await _others(db, uid)
    assert before["goals"] == 0 and before["reminders"] == 0 and before["applications"] == 0
    assert before["listings"] == 1 and before["searches"] == 1 and before["circles_joined"] == 1

    # Segment and intake needs follow her answers once she is admitted.
    member = await db["members"].find_one({"_id": ObjectId(user["member_id"])})
    assert member["segment"] == "Job Seeker" and member["segment_source"] == "onboarding"
    fresh = await db["users"].find_one({"_id": user["_id"]})
    assert fresh["ai_context"]["needs"] == ["earn", "business"]

    again = await client.post("/me/onboarding/setup", headers=h)
    assert again.status_code == 200 and again.json()["created"] == 0
    assert len(again.json()["items"]) == len(body["items"])
    assert await _others(db, uid) == before


async def test_rerun_adds_only_the_new_goal_and_removing_a_goal_deletes_nothing(api):
    client, db, created = api
    user, h = await _member(db, created)
    uid = str(user["_id"])
    prog = await db["programs"].insert_one({"name": f"Digital basics {TAG}", "category": "Digital",
                                            "status": "Ongoing", "created_at": datetime.now(timezone.utc)})
    created["programs"].append(prog.inserted_id)
    await _answered(client, h, {"goals": ["earn_home"], "skills": ["tailoring"],
                                "free_times": ["morning"], "minutes_per_day": 10})
    first = (await client.post("/me/onboarding/setup", headers=h)).json()
    keys1 = {i["key"] for i in first["items"]}
    assert keys1 == {"listing:skill=tailoring", "saved_search:jobs", "goal:earn", "reminder:morning", "welcome"}
    before = await _others(db, uid)

    # She adds Learn from a "Change" link: only the learning things appear.
    await client.put("/me/onboarding", json={"goals": ["earn_home", "learn"]}, headers=h)
    await client.put("/me/onboarding", json={"learn_topics": ["digital"]}, headers=h)
    second = (await client.post("/me/onboarding/setup", headers=h)).json()
    new = {i["key"] for i in second["items"]} - keys1
    assert "goal:learn" in new
    assert f"programme:{prog.inserted_id}" in new
    assert all(k.startswith(("goal:learn", "programme:")) for k in new), new
    assert second["created"] == len(new)
    assert await _others(db, uid) == before  # suggestions and proposals create nothing

    # Nothing changes, nothing is made.
    third = (await client.post("/me/onboarding/setup", headers=h)).json()
    assert third["created"] == 0

    # She drops Earn: the draft stays, untouched, and is marked no longer chosen.
    await client.put("/me/onboarding", json={"goals": ["learn"]}, headers=h)
    fourth = (await client.post("/me/onboarding/setup", headers=h)).json()
    assert fourth["created"] == 0
    listing = next(i for i in fourth["items"] if i["type"] == "listing")
    assert listing["still_chosen"] is False and listing["state"] == "draft"
    assert await db["shop_listings"].count_documents({"_id": ObjectId(listing["id"])}) == 1
    assert await _others(db, uid) == before


async def test_draft_listing_is_hers_alone_until_she_publishes(api):
    client, db, created = api
    owner, h = await _member(db, created)
    buyer, hb = await _member(db, created)
    await db["users"].update_one({"_id": owner["_id"]}, {"$set": {"shop_handle": f"ob-{_tag()}"}})
    handle = (await db["users"].find_one({"_id": owner["_id"]}))["shop_handle"]
    cache.forget_user(str(owner["_id"]))
    await _answered(client, h, {"goals": ["sell"], "skills": ["mehendi"]})
    items = (await client.post("/me/onboarding/setup", headers=h)).json()["items"]
    lid = next(i["id"] for i in items if i["type"] == "listing")

    mine = (await client.get("/shop/listings", headers=h)).json()
    assert any(r["id"] == lid and r["status"] == "draft" for r in mine)
    market = (await client.get("/market/listings", params={"q": "Mehendi"}, headers=hb)).json()
    assert all(r["id"] != lid for r in market)
    assert (await client.get(f"/market/listings/{lid}", headers=hb)).status_code == 404
    assert (await client.get(f"/public/listings/{lid}")).status_code == 404
    shop = (await client.get(f"/public/shop/{handle}")).json()
    assert all(r["id"] != lid for r in shop["listings"])
    saved = await client.post("/saved", json={"kind": "listing", "ref_id": lid}, headers=hb)
    assert "Mehendi" not in saved.text
    await db["saved"].delete_many({"user_id": str(buyer["_id"])})

    # Published through the shop's own lever, it behaves like any live listing.
    r = await client.post(f"/shop/listings/{lid}/pause", params={"paused": "false"}, headers=h)
    assert r.status_code == 200 and r.json()["status"] == "live"
    market = (await client.get("/market/listings", params={"q": "Mehendi"}, headers=hb)).json()
    assert any(r["id"] == lid for r in market)
    cache.clear()
    assert (await client.get(f"/public/listings/{lid}")).status_code == 200


async def test_no_circle_is_joined_except_welcome(api):
    client, db, created = api
    user, h = await _member(db, created)
    now = datetime.now(timezone.utc)
    for name, private in ((f"New mothers who earn {TAG}", False), (f"Tailoring together {TAG}", False),
                          (f"Private tailors {TAG}", True)):
        c = await db["circles"].insert_one({"name": name, "topic": "", "tags": [], "is_private": private,
                                            "status": "active", "member_count": 999, "created_at": now})
        created["circles"].append(c.inserted_id)
    await _answered(client, h, {"goals": ["meet"], "meet": ["new_mothers", "same_skill"],
                                "skills": ["tailoring"]})
    items = (await client.post("/me/onboarding/setup", headers=h)).json()["items"]
    circles = [i for i in items if i["type"] == "circle"]
    welcome = next(i for i in items if i["type"] == "welcome")
    assert 1 <= len(circles) <= 3
    assert all(c["state"] == "suggested" and "phone stays hidden" in c["shows"] for c in circles)
    private_id = str(created["circles"][2])
    assert private_id not in {c["id"] for c in circles}
    assert {c["id"] for c in circles} & {str(created["circles"][0]), str(created["circles"][1])}
    joined = await db["circle_members"].distinct("circle_id", {"user_id": str(user["_id"])})
    assert joined == [welcome["id"]]
    wc = await db["circles"].find_one({"_id": ObjectId(welcome["id"])})
    assert wc["official_welcome"] is True and wc["who_posts"] == "hosts"


async def test_keep_and_remove(api):
    client, db, created = api
    user, h = await _member(db, created)
    uid = str(user["_id"])
    await _answered(client, h, {"goals": ["earn_home"], "skills": ["tailoring"], "free_times": ["weekends"]})
    items = (await client.post("/me/onboarding/setup", headers=h)).json()["items"]
    lid = next(i["id"] for i in items if i["type"] == "listing")

    r = await client.post("/me/onboarding/items/goal/earn/keep", headers=h)
    assert r.status_code == 200 and r.json()["item"]["state"] == "kept"
    await client.post("/me/onboarding/items/goal/earn/keep", headers=h)
    goals = await db["goals"].find({"user_id": uid}).to_list(10)
    assert len(goals) == 1 and goals[0]["kind"] == "money" and goals[0]["target"] == 100_000
    assert (await client.post("/me/onboarding/items/goal/earn/remove", headers=h)).status_code == 409

    r = await client.post("/me/onboarding/items/reminder/weekends/keep", json={"enable": False}, headers=h)
    assert r.status_code == 200 and r.json()["item"]["enabled"] is False
    rem = await db["reminder_definitions"].find_one({"user_id": uid})
    assert rem["state"] == "paused" and rem["schedule"]["local_time"] == "10:00" and rem["schedule"]["days"] == [5]
    assert await db["reminder_occurrences"].count_documents({"user_id": uid}) == 0
    r = await client.post("/me/onboarding/items/reminder/weekends/keep", json={"enable": True}, headers=h)
    assert r.json()["item"]["enabled"] is True
    assert (await db["reminder_definitions"].find_one({"user_id": uid}))["state"] == "scheduled"
    assert await db["reminder_definitions"].count_documents({"user_id": uid}) == 1

    assert (await client.post(f"/me/onboarding/items/listing/{lid}/keep", headers=h)).status_code == 400
    r = await client.post(f"/me/onboarding/items/listing/{lid}/remove", headers=h)
    assert r.status_code == 200 and r.json()["item"]["state"] == "removed"
    assert await db["shop_listings"].count_documents({"user_id": uid}) == 0
    assert (await client.post("/me/onboarding/items/goal/nope/keep", headers=h)).status_code == 404
    # Removed stays removed: a re-run does not make it again.
    assert (await client.post("/me/onboarding/setup", headers=h)).json()["created"] == 0
    assert await db["shop_listings"].count_documents({"user_id": uid}) == 0


# ── home ────────────────────────────────────────────────────────────────────


async def test_home_without_answers_invites_once_and_changes_nothing_else(api):
    """An existing member who never answered gets only the invitation card;
    no order, no reasons. Dismissing it returns her home to exactly as before."""
    client, db, created = api
    _, h = await _member(db, created)
    r = await client.get("/me/home", headers=h)
    assert r.status_code == 200, r.text
    personal = r.json()["personal"]
    assert personal["make_it_yours"] is True
    assert personal["order"] == [] and personal["reasons"] == {}
    r = await client.post("/me/onboarding/dismiss-card", headers=h)
    assert r.status_code == 200, r.text
    r = await client.get("/me/home", headers=h)
    assert r.json()["personal"] is None


async def test_home_personal_block_and_honest_checklist(api):
    client, db, created = api
    user, h = await _member(db, created)
    uid = str(user["_id"])
    await _answered(client, h, {"goals": ["earn_home", "learn"], "skills": ["tailoring"]})
    items = (await client.post("/me/onboarding/setup", headers=h)).json()["items"]
    lid = next(i["id"] for i in items if i["type"] == "listing")

    p = (await client.get("/me/home", headers=h)).json()["personal"]
    assert p["order"][:2] == ["earnings", "opportunities"] and "recommended" in p["order"]
    assert p["reasons"]["earnings"] == "Because you chose Earn · Tailoring"
    check = {c["key"]: c["done"] for c in p["checklist"]}
    assert check == {"account": True, "verified": True, "publish": False, "lesson": False}
    assert p["make_it_yours"] is True  # topics, times and minutes unanswered

    # Publishing the draft and attending a first lesson flip exactly those two.
    await client.post(f"/shop/listings/{lid}/pause", params={"paused": "false"}, headers=h)
    e = await db["enrollments"].insert_one({"user_id": uid, "program_id": "x", "status": "active",
                                            "progress": 0, "sessions_attended": 1})
    created["enrollments"].append(e.inserted_id)
    p = (await client.get("/me/home", headers=h)).json()["personal"]
    check = {c["key"]: c["done"] for c in p["checklist"]}
    assert check["publish"] is True and check["lesson"] is True

    # A new job matching her saved search surfaces on home.
    assert p["new_job_matches"]["count"] == 0
    opp = await db["opportunities"].insert_one({
        "title": f"Tailoring helper {TAG}", "org": "Boutique", "skills": ["Tailoring"], "status": "open",
        "location": "Hyderabad", "desc": "", "created_at": datetime.now(timezone.utc) + timedelta(seconds=1)})
    created["opportunities"].append(opp.inserted_id)
    p = (await client.get("/me/home", headers=h)).json()["personal"]
    assert p["new_job_matches"]["count"] >= 1
    assert str(opp.inserted_id) in {i["id"] for i in p["new_job_matches"]["items"]}

    r = await client.post("/me/onboarding/dismiss-card", headers=h)
    assert r.json()["make_it_yours"] is False
    assert (await client.get("/me/home", headers=h)).json()["personal"]["make_it_yours"] is False


async def test_skip_then_offered_once_more_after_approval(api):
    client, db, created = api
    user, h = await _member(db, created, status="in_review")
    r = await client.post("/me/onboarding/skip", headers=h)
    assert r.json()["offered"] is False and r.json()["make_it_yours"] is True
    await _approve(db, user)
    assert (await client.get("/me/onboarding", headers=h)).json()["offered"] is True
    r = await client.post("/me/onboarding/skip", headers=h)
    assert r.json()["offered"] is False


async def test_checkin_endpoint(api):
    client, db, created = api
    user, h = await _member(db, created)
    assert (await client.post("/me/onboarding/checkin", json={"still_same": True}, headers=h)).status_code == 404
    await client.put("/me/onboarding", json={"goals": ["learn"]}, headers=h)
    old = datetime.now(timezone.utc) - timedelta(days=100)
    await db["onboarding_profiles"].update_one({"user_id": str(user["_id"])},
                                               {"$set": {"updated_at": old, "answered_at": old}})
    assert (await client.get("/me/onboarding", headers=h)).json()["checkin_due"] is True
    assert (await client.post("/me/onboarding/checkin", json={"still_same": False}, headers=h)).status_code == 400
    r = await client.post("/me/onboarding/checkin", json={"still_same": True}, headers=h)
    assert r.status_code == 200 and r.json()["checkin_due"] is False and r.json()["last_reviewed_at"]


async def test_staff_segment_is_not_overwritten(api):
    client, db, created = api
    user, h = await _member(db, created, segment_source="staff")
    await _answered(client, h, {"goals": ["find_job"]})
    member = await db["members"].find_one({"_id": ObjectId(user["member_id"])})
    assert member["segment"] == "Entrepreneur" and member["segment_source"] == "staff"


async def test_delete_withdraws_everything_and_is_audited(api):
    client, db, created = api
    user, h = await _member(db, created)
    uid = str(user["_id"])
    await _answered(client, h, FULL, {"setup": True, "job_updates": True, "employer_visibility": True})
    r = await client.delete("/me/onboarding", headers=h)
    assert r.status_code == 200
    body = r.json()
    assert all(v is None for v in body["answers"].values())
    assert all(c["granted"] is False for c in body["consents"].values())
    data = (await client.get("/me/data", headers=h)).json()
    assert data["work_profile"] is None and data["answers"]["goals"] is None
    assert await db["activity_log"].count_documents({"user_id": uid, "action": "member.onboarding_delete"}) == 1
    fresh = await db["users"].find_one({"_id": user["_id"]})
    assert "earn" not in fresh["ai_context"]["needs"]


# ── retention ───────────────────────────────────────────────────────────────


async def test_retention_deletes_answers_of_long_rejected_without_job_consent(api):
    client, db, created = api
    past = datetime.now(timezone.utc) - timedelta(days=1)
    future = datetime.now(timezone.utc) + timedelta(days=3)
    plain, h1 = await _member(db, created, status="in_review")
    keeper, h2 = await _member(db, created, status="in_review")
    recent, h3 = await _member(db, created, status="in_review")
    await _answered(client, h1, FULL, {"setup": True})
    await _answered(client, h2, FULL, {"setup": True, "job_updates": True})
    await _answered(client, h3, FULL, {"setup": True})
    for u, when in ((plain, past), (keeper, past), (recent, future)):
        await db["users"].update_one({"_id": u["_id"]}, {"$set": {"verification_status": "rejected",
                                                                  "reapply_after": when}})
    purged = await ob.purge_rejected()
    assert purged >= 1
    p1 = await db["onboarding_profiles"].find_one({"user_id": str(plain["_id"])})
    p2 = await db["onboarding_profiles"].find_one({"user_id": str(keeper["_id"])})
    p3 = await db["onboarding_profiles"].find_one({"user_id": str(recent["_id"])})
    assert p1["answers"] == {} and p1["consent_history"]  # the consent record stays
    assert p2["answers"]["skills"] == FULL["skills"]
    assert p3["answers"]["goals"] == FULL["goals"]  # still inside the reapply window
    wp = await ob.work_profile(await db["users"].find_one({"_id": keeper["_id"]}), p2)
    assert wp and wp["verified"] is False


# ── insights ────────────────────────────────────────────────────────────────


def test_buckets_suppress_under_five():
    from app.routes.onboarding import _buckets

    got = _buckets({"learn": 7, "sell": 4, "meet": 5, "shop": 0})
    assert [b["key"] for b in got["buckets"]] == ["learn", "meet"]
    assert got["suppressed"] == 1


async def test_insights_are_anonymous_and_guarded(api):
    client, db, created = api
    secret = f"Zqx{_tag()}craft"
    people = []
    for n in range(6):
        u, h = await _member(db, created)
        people.append(u)
        await client.put("/me/onboarding", json={"goals": ["learn"], "learn_topics": ["digital"]}, headers=h)
    lone, hl = await _member(db, created)
    people.append(lone)
    await client.put("/me/onboarding", json={"goals": ["sell"], "skills": [{"custom": secret}]}, headers=hl)

    _, admin = await _member(db, created, role="Super Admin")
    r = await client.get("/admin/onboarding/insights", headers=admin)
    assert r.status_code == 200, r.text
    text = r.text
    body = r.json()
    learn = next(b for b in body["goals"]["buckets"] if b["key"] == "learn")
    assert learn["count"] >= 6
    assert secret.lower() not in text.lower()  # one woman's free text never appears
    for u in people:
        assert str(u["_id"]) not in text and u["email"] not in text and u["full_name"] not in text
        assert u["member_id"] not in text
    for group in (body["goals"], body["top_skills"], body["learn_topics"], body["by_status"]):
        assert all(b["count"] >= 5 for b in group["buckets"])
    json.dumps(body)

    _, agent = await _member(db, created, role="Support Agent")
    assert (await client.get("/admin/onboarding/insights", headers=agent)).status_code == 403
    _, member = await _member(db, created)
    assert (await client.get("/admin/onboarding/insights", headers=member)).status_code == 403


async def test_tour_step_saves_over_http(api):
    client, db, created = api
    _, h = await _member(db, created, status="in_review")
    r = await client.post("/theme/onboarding/step", json={"step": "tour-3"}, headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["tour_done"] == ["tour-3"]
    assert (await client.post("/theme/onboarding/step", json={"step": "tour-9"}, headers=h)).status_code == 422


def test_programme_categories_match_topics_by_word():
    assert ob.topic_of_category("Digital Literacy", ["digital"]) == "digital"
    assert ob.topic_of_category("Personal Development", ["money", "personal"]) == "personal"
    assert ob.topic_of_category("Entrepreneurship", ["money"]) == "money"
    assert ob.topic_of_category("Handicrafts", ["digital", "money"]) is None
