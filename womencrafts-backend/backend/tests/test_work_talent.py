"""
Work by skill: the masters, her opt-in profile, "Find people", and the chat
that follows — including the parts that protect her (hidden skills stay
hidden, the number is hers to share, "not interested" is final).

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
    made = {"users": []}
    transport = httpx.ASGITransport(app=app)
    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://test/api/v1") as client:
            yield client, db, made
    finally:
        uids = [str(u) for u in made["users"]]
        await db["users"].delete_many({"_id": {"$in": made["users"]}})
        await db["work_profiles"].delete_many({"user_id": {"$in": uids}})
        await db["member_conversations"].delete_many({"member_id": {"$in": uids}})
        await db["member_notifications"].delete_many({"user_id": {"$in": uids}})
        await db[sessions.COLLECTION].delete_many({"user_id": {"$in": uids}})
        await db["work_skills"].delete_many({"name": {"$regex": "^Test skill"}})
        await db["opportunities"].delete_many({"$or": [{"owner_id": {"$in": uids}}, {"title": {"$regex": "^Test job"}}]})
        await db["applications"].delete_many({"user_id": {"$in": uids}})
        await db["onboarding_profiles"].delete_many({"user_id": {"$in": uids}})
        await db["work_categories"].delete_many({"name": {"$regex": "^Test category"}})
        await db["portfolio_items"].delete_many({"user_id": {"$in": uids}})
        cache.clear()
        mongodb._client, mongodb._db = None, None


async def _member(db, made, name: str, *, phone: str = "", status: str = "active", role: str = "Member"):
    now = datetime.now(timezone.utc)
    doc = {
        "full_name": name, "email": f"work-{uuid.uuid4().hex[:10]}@example.com", "phone": phone,
        "email_verified_at": now, "role": role, "is_active": True, "token_version": 0,
        "verification_status": status, "created_at": now, "updated_at": now,
    }
    doc["_id"] = (await db["users"].insert_one(doc)).inserted_id
    made["users"].append(doc["_id"])
    tokens = await sessions.start(None, doc)
    return doc, {"Authorization": f"Bearer {tokens['access_token']}"}


async def _save(client, h, skills, **over):
    body = {"skills": skills, "work_types": ["Part-time"], "days": ["Weekdays"], "area": "Kukatpally", "city": "Hyderabad"}
    body.update(over)
    got = await client.put("/work/profile", json=body, headers=h)
    assert got.status_code == 200, got.text
    return got.json()


async def test_masters_are_seeded_from_the_onboarding_taxonomy(api):
    client, db, made = api
    _, h = await _member(db, made, "Asha Rani")
    got = await client.get("/work/taxonomy", headers=h)
    assert got.status_code == 200
    cats = {c["key"]: c for c in got.json()["categories"]}
    assert "tailoring_fashion" in cats
    assert any(s["key"] == "blouse_stitching" for s in cats["tailoring_fashion"]["skills"])


async def test_only_switched_on_skills_are_found_and_hidden_ones_never_shown(api):
    client, db, made = api
    sunita, hs = await _member(db, made, "Sunita Devi", phone="+919800000001")
    _, hh = await _member(db, made, "Meena Boutique")

    prof = await _save(client, hs, [
        {"key": "blouse_stitching", "level": "3-5", "visible": True},
        {"key": "mehendi", "level": "1-2", "visible": False},
    ])
    assert prof["shown_for"] == 1

    found = (await client.get("/work/talent", params={"skills": "blouse_stitching"}, headers=hh)).json()
    row = next(r for r in found["results"] if r["user_id"] == str(sunita["_id"]))
    assert row["first_name"] == "Sunita"
    assert [s["key"] for s in row["skills"]] == ["blouse_stitching"]
    assert "Mehendi" not in row["also"]                 # hidden skill never leaks
    assert "phone" not in row and "+919800000001" not in str(row)

    hidden = (await client.get("/work/talent", params={"skills": "mehendi"}, headers=hh)).json()
    assert all(r["user_id"] != str(sunita["_id"]) for r in hidden["results"])

    # By category: all skills in it, still only switched-on ones.
    by_cat = (await client.get("/work/talent", params={"category": "tailoring_fashion"}, headers=hh)).json()
    assert any(r["user_id"] == str(sunita["_id"]) for r in by_cat["results"])
    # She never appears in her own search.
    mine = (await client.get("/work/talent", params={"skills": "blouse_stitching"}, headers=hs)).json()
    assert all(r["user_id"] != str(sunita["_id"]) for r in mine["results"])


async def test_filters_level_city_and_work_type(api):
    client, db, made = api
    a, ha = await _member(db, made, "Kamala Learner")
    _, hh = await _member(db, made, "Hirer One")
    await _save(client, ha, [{"key": "alterations", "level": "learning", "visible": True}],
                city="Vijayawada", work_types=["From home"])
    q = {"skills": "alterations"}
    ids = lambda r: {x["user_id"] for x in r.json()["results"]}  # noqa: E731
    assert str(a["_id"]) in ids(await client.get("/work/talent", params=q, headers=hh))
    assert str(a["_id"]) not in ids(await client.get("/work/talent", params={**q, "level": "3-5"}, headers=hh))
    assert str(a["_id"]) not in ids(await client.get("/work/talent", params={**q, "city": "Pune"}, headers=hh))
    assert str(a["_id"]) in ids(await client.get("/work/talent", params={**q, "city": "vijaya"}, headers=hh))
    assert str(a["_id"]) not in ids(await client.get("/work/talent", params={**q, "work_type": "Full-time"}, headers=hh))


async def test_unverified_members_cannot_search_and_are_not_found(api):
    client, db, made = api
    _, hp = await _member(db, made, "Pending Person", status="pending")
    assert (await client.get("/work/talent", params={"skills": "tailoring"}, headers=hp)).status_code == 403
    w, hw = await _member(db, made, "Will Verify")
    await _save(client, hw, [{"key": "tailoring", "level": "5+", "visible": True}])
    await db["users"].update_one({"_id": w["_id"]}, {"$set": {"verification_status": "pending"}})
    _, hh = await _member(db, made, "Hirer Two")
    got = (await client.get("/work/talent", params={"skills": "tailoring"}, headers=hh)).json()
    assert all(r["user_id"] != str(w["_id"]) for r in got["results"])


async def test_chat_share_number_and_not_interested(api):
    client, db, made = api
    her, hs = await _member(db, made, "Lakshmi Tailor", phone="+919811111111")
    _, hh = await _member(db, made, "Rekha Hires")
    await _save(client, hs, [{"key": "blouse_stitching", "level": "5+", "visible": True}])

    got = await client.post(f"/work/talent/{her['_id']}/message",
                            json={"text": "I need 20 blouses stitched this month.", "skills": ["blouse_stitching"]},
                            headers=hh)
    assert got.status_code == 201, got.text
    mine_id = got.json()["conversation_id"]

    inbox = (await client.get("/me/conversations", headers=hs)).json()
    hers = next(c for c in inbox if c["kind"] == "work")
    assert hers["party"]["role"] == "Looking to hire" and "Blouse stitching" in hers["subtitle"]
    # Her number is not anywhere until she shares it.
    thread = (await client.get(f"/me/conversations/{mine_id}", headers=hh)).json()
    assert "+919811111111" not in str(thread)

    assert (await client.post(f"/work/conversations/{hers['id']}/share-number", headers=hs)).status_code == 200
    thread = (await client.get(f"/me/conversations/{mine_id}", headers=hh)).json()
    assert "+919811111111" in thread["messages"][-1]["text"]

    assert (await client.post(f"/work/conversations/{hers['id']}/not-interested", headers=hs)).status_code == 200
    thread = (await client.get(f"/me/conversations/{mine_id}", headers=hh)).json()
    assert thread["closed"] is True
    assert (await client.post(f"/me/conversations/{mine_id}/messages", json={"text": "Please?"}, headers=hh)).status_code == 409
    again = await client.post(f"/work/talent/{her['_id']}/message", json={"text": "Trying again with more pay"}, headers=hh)
    assert again.status_code == 403
    found = (await client.get("/work/talent", params={"skills": "blouse_stitching"}, headers=hh)).json()
    assert all(r["user_id"] != str(her["_id"]) for r in found["results"])


async def test_cannot_message_someone_who_is_not_opted_in(api):
    client, db, made = api
    quiet, hq = await _member(db, made, "Quiet Person")
    _, hh = await _member(db, made, "Hirer Three")
    await _save(client, hq, [{"key": "tailoring", "level": "5+", "visible": False}])
    got = await client.post(f"/work/talent/{quiet['_id']}/message", json={"text": "Can you stitch for me?"}, headers=hh)
    assert got.status_code == 404


async def test_new_chats_are_limited_per_day(api, monkeypatch):
    from app.routes import work_talent
    monkeypatch.setattr(work_talent, "NEW_CHATS_PER_DAY", 2)
    client, db, made = api
    _, hh = await _member(db, made, "Busy Hirer")
    targets = []
    for i in range(3):
        t, ht = await _member(db, made, f"Worker {i}")
        await _save(client, ht, [{"key": "tailoring", "level": "1-2", "visible": True}])
        targets.append(t)
    codes = [(await client.post(f"/work/talent/{t['_id']}/message", json={"text": "Work available near you"}, headers=hh)).status_code
             for t in targets]
    assert codes == [201, 201, 429]


async def test_staff_manage_the_masters_and_members_see_changes(api):
    client, db, made = api
    _, hadmin = await _member(db, made, "Staff Admin", role="Super Admin")
    _, hm = await _member(db, made, "Member Reader")
    got = await client.post("/admin/work/categories", json={"name": "Test category Solar"}, headers=hadmin)
    assert got.status_code == 201, got.text
    cat = got.json()["key"]
    sk = (await client.post("/admin/work/skills", json={"category": cat, "name": "Test skill panel cleaning"}, headers=hadmin)).json()["key"]
    tax = (await client.get("/work/taxonomy", headers=hm)).json()["categories"]
    assert any(c["key"] == cat and c["skills"][0]["key"] == sk for c in tax)
    # Retire it: members no longer see it.
    assert (await client.patch(f"/admin/work/skills/{sk}", json={"active": False}, headers=hadmin)).status_code == 200
    tax = (await client.get("/work/taxonomy", headers=hm)).json()["categories"]
    assert not any(c["key"] == cat for c in tax)        # an empty category is not offered
    # A member cannot touch the masters.
    assert (await client.post("/admin/work/categories", json={"name": "Test category Nope"}, headers=hm)).status_code in (401, 403)


def _job(**over):
    body = {"title": "Test job: 2 tailors for a boutique", "skill_keys": ["blouse_stitching", "alterations"],
            "kind": "Job", "mode": "On-site", "location": "Kukatpally", "pay": "₹12,000 / month", "openings": 2}
    body.update(over)
    return body


async def test_home_recommendations_include_open_work(api):
    from app.models.growth import OpportunityModel

    client, db, made = api
    _, headers = await _member(db, made, "Home Reader")
    job = OpportunityModel.create_document(title="Test job: home recommendation", category="tailoring")
    job_id = str((await db["opportunities"].insert_one(job)).inserted_id)
    response = await client.get("/me/home", headers=headers)
    assert response.status_code == 200, response.text
    home = response.json()
    assert "opportunities" not in home["unavailable"]
    assert any(row["id"] == job_id for row in home["opportunities"])


async def test_member_posts_a_job_and_matching_women_find_and_apply(api):
    client, db, made = api
    boss, hb = await _member(db, made, "Meera Boutique")
    asha, ha = await _member(db, made, "Asha Stitches")
    other, ho = await _member(db, made, "Ravi Cook")
    await _save(client, ha, [{"key": "blouse_stitching", "level": "5+", "visible": False}])  # hidden still matches for HER
    await _save(client, ho, [{"key": "tailoring", "level": "1-2", "visible": True}])
    await db["onboarding_profiles"].insert_one({"user_id": str(asha["_id"]), "consents": {"job_updates": {"granted": True}}})

    got = await client.post("/work/jobs", json=_job(), headers=hb)
    assert got.status_code == 201, got.text
    job = got.json()
    assert job["owner_kind"] == "member" and job["skills"] == ["Blouse stitching", "Alterations and re-fitting"]
    assert job["category"] == "tailoring_fashion"
    # She was told: a woman with the skill who allows job updates.
    assert await db["member_notifications"].count_documents({"user_id": str(asha["_id"]), "title": {"$regex": "New work for your skills"}}) == 1

    mine = (await client.get("/growth/opportunities", params={"for_me": True}, headers=ha)).json()
    row = next(r for r in mine if r["id"] == job["id"])
    assert row["match"]["have"] == ["Blouse stitching"] and row["match"]["missing"] == ["Alterations and re-fitting"]
    others = (await client.get("/growth/opportunities", params={"for_me": True}, headers=ho)).json()
    assert all(r["id"] != job["id"] for r in others)          # tailoring != these two skills
    by_cat = (await client.get("/growth/opportunities", params={"category": "tailoring_fashion"}, headers=ho)).json()
    assert any(r["id"] == job["id"] for r in by_cat)

    # The poster cannot apply to her own post.
    assert (await client.post(f"/growth/opportunities/{job['id']}/apply", json={}, headers=hb)).status_code == 400
    applied = await client.post(f"/growth/opportunities/{job['id']}/apply", json={"note": "I can start Monday"}, headers=ha)
    assert applied.status_code == 201, applied.text
    assert applied.json()["skills"][0]["name"] == "Blouse stitching"
    assert await db["member_notifications"].count_documents({"user_id": str(boss["_id"]), "title": {"$regex": "applied"}}) == 1

    people = (await client.get(f"/work/jobs/{job['id']}/applicants", headers=hb)).json()
    assert people[0]["first_name"] == "Asha" and people[0]["skills"][0]["level"] == "5+ years"
    assert "phone" not in people[0]
    # Only the poster sees applicants.
    assert (await client.get(f"/work/jobs/{job['id']}/applicants", headers=ha)).status_code == 404

    app_id = people[0]["application_id"]
    assert (await client.post(f"/work/applications/{app_id}/move", json={"status": "closed"}, headers=hb)).status_code == 422
    assert (await client.post(f"/work/applications/{app_id}/move", json={"status": "shortlisted"}, headers=hb)).status_code == 200
    mine_apps = (await client.get("/growth/applications", headers=ha)).json()
    assert mine_apps[0]["status"] == "shortlisted"
    chat = await client.post(f"/work/applications/{app_id}/message", json={"text": "Can you come on Monday at 10?"}, headers=hb)
    assert chat.status_code == 201, chat.text
    inbox = (await client.get("/me/conversations", headers=ha)).json()
    assert any(c["kind"] == "work" and "Test job" in c["subtitle"] for c in inbox)

    posts = (await client.get("/work/jobs/mine", headers=hb)).json()
    assert posts[0]["applicant_count"] == 1
    assert (await client.post(f"/work/jobs/{job['id']}/close", headers=hb)).status_code == 200
    assert all(r["id"] != job["id"] for r in (await client.get("/growth/opportunities", headers=ha)).json())


async def test_job_post_rules(api, monkeypatch):
    from app.routes import work_talent
    monkeypatch.setattr(work_talent, "MAX_OPEN_POSTS", 1)
    client, db, made = api
    _, hb = await _member(db, made, "Rules Boss")
    assert (await client.post("/work/jobs", json=_job(skill_keys=["no_such_skill"]), headers=hb)).status_code == 422
    assert (await client.post("/work/jobs", json=_job(), headers=hb)).status_code == 201
    assert (await client.post("/work/jobs", json=_job(), headers=hb)).status_code == 429
    _, hp = await _member(db, made, "Pending Boss", status="pending")
    assert (await client.post("/work/jobs", json=_job(), headers=hp)).status_code == 403


async def test_staff_job_form_uses_skill_keys_and_old_jobs_are_backfilled(api, monkeypatch):
    from app.routes import work_talent
    client, db, made = api
    _, hadmin = await _member(db, made, "Staff Poster", role="Super Admin")
    got = await client.post("/admin/growth/opportunities", json={
        "title": "Test job: machine operator", "org": "Sri Garments", "skill_keys": ["tailoring"]}, headers=hadmin)
    assert got.status_code == 201, got.text
    assert got.json()["skills"] == ["Tailoring"] and got.json()["category"] == "tailoring_fashion"

    await db["opportunities"].insert_one({"title": "Test job: old typed skills", "status": "open",
                                          "skills": ["Tailoring", "Something unknown"], "created_at": datetime.now(timezone.utc)})
    monkeypatch.setattr(work_talent, "_backfilled", False)
    _, hm = await _member(db, made, "Board Reader")
    await client.get("/growth/opportunities", headers=hm)
    old = await db["opportunities"].find_one({"title": "Test job: old typed skills"})
    assert old["skill_keys"] == ["tailoring"] and old["category"] == "tailoring_fashion"


async def test_find_work_search_expiry_and_saved(api):
    client, db, made = api
    _, hb = await _member(db, made, "Search Boss")
    _, hm = await _member(db, made, "Search Member")
    job = (await client.post("/work/jobs", json=_job(location="Kukatpally"), headers=hb)).json()
    await db["opportunities"].insert_one({"title": "Test job: expired one", "status": "open", "kind": "Job",
                                          "deadline": "2020-01-01", "skills": [], "created_at": datetime.now(timezone.utc)})
    ids = lambda r: [x["id"] for x in r.json()]  # noqa: E731
    assert job["id"] in ids(await client.get("/growth/opportunities", params={"q": "kukatpally"}, headers=hm))
    assert job["id"] in ids(await client.get("/growth/opportunities", params={"q": "blouse"}, headers=hm))
    assert job["id"] not in ids(await client.get("/growth/opportunities", params={"q": "zzqx"}, headers=hm))
    every = (await client.get("/growth/opportunities", headers=hm)).json()
    assert all(r["title"] != "Test job: expired one" for r in every)
    assert ids(await client.get("/growth/opportunities", params={"saved": True}, headers=hm)) == []
    await client.post(f"/growth/opportunities/{job['id']}/save", headers=hm)
    assert ids(await client.get("/growth/opportunities", params={"saved": True}, headers=hm)) == [job["id"]]
    assert job["id"] in ids(await client.get("/growth/opportunities", params={"kind": "Job", "mode": "On-site"}, headers=hm))
    assert job["id"] not in ids(await client.get("/growth/opportunities", params={"kind": "Freelance"}, headers=hm))


async def test_saved_jobs_are_one_list(api):
    """Saved in Find work shows on Home → Saved, and the other way round."""
    client, db, made = api
    _, hb = await _member(db, made, "Saved Boss")
    m, hm = await _member(db, made, "Saved Member")
    job = (await client.post("/work/jobs", json=_job(), headers=hb)).json()
    job2 = (await client.post("/work/jobs", json=_job(title="Test job: second one"), headers=hb)).json()
    await client.post(f"/growth/opportunities/{job['id']}/save", headers=hm)
    assert [s["ref_id"] for s in (await client.get("/saved", params={"kind": "job"}, headers=hm)).json()] == [job["id"]]
    await client.post("/saved", json={"kind": "job", "ref_id": job2["id"]}, headers=hm)
    ids = {r["id"] for r in (await client.get("/growth/opportunities", params={"saved": True}, headers=hm)).json()}
    assert ids == {job["id"], job2["id"]}
    await client.post(f"/growth/opportunities/{job['id']}/save", headers=hm)   # unsave
    assert [s["ref_id"] for s in (await client.get("/saved", params={"kind": "job"}, headers=hm)).json()] == [job2["id"]]
    # The old per-user list is moved across on first read.
    await db["users"].update_one({"_id": m["_id"]}, {"$set": {"saved_opportunities": [job["id"]]}})
    ids = {r["id"] for r in (await client.get("/growth/opportunities", params={"saved": True}, headers=hm)).json()}
    assert ids == {job["id"], job2["id"]}
    assert "saved_opportunities" not in await db["users"].find_one({"_id": m["_id"]})
    await db["saved"].delete_many({"user_id": str(m["_id"])})


async def test_categories_and_skills_carry_a_picture(api):
    """Staff set a picture (an upload or library art); a skill without one shows its category's."""
    client, db, made = api
    _, hadmin = await _member(db, made, "Staff Admin", role="Super Admin")
    _, hm = await _member(db, made, "Member Pictures")
    cat = (await client.post("/admin/work/categories", json={"name": "Test category Pictures", "image": "/ux/art/earn-shop.webp"},
                             headers=hadmin)).json()["key"]
    own = (await client.post("/admin/work/skills", json={"category": cat, "name": "Test skill with photo",
                                                        "image": "http://localhost:8020/media/cover/x.png"}, headers=hadmin)).json()["key"]
    plain = (await client.post("/admin/work/skills", json={"category": cat, "name": "Test skill plain"}, headers=hadmin)).json()["key"]
    # Library art keeps the app's own path; an upload is stored as a path, sent back as a URL.
    assert (await db["work_categories"].find_one({"key": cat}))["image"] == "/ux/art/earn-shop.webp"
    assert (await db["work_skills"].find_one({"key": own}))["image"] == "media/cover/x.png"
    tax = {c["key"]: c for c in (await client.get("/work/taxonomy", headers=hm)).json()["categories"]}
    assert tax[cat]["image"] == "/ux/art/earn-shop.webp"
    skills = {s["key"]: s for s in tax[cat]["skills"]}
    assert skills[own]["image"].endswith("/media/cover/x.png") and skills[plain]["image"] == ""
    # In her profile, the plain skill borrows the category's picture.
    got = await client.put("/work/profile", json={"skills": [{"key": plain, "level": "", "visible": False}],
                                                  "work_types": [], "days": [], "area": "", "city": ""}, headers=hm)
    assert got.status_code == 200, got.text
    assert got.json()["skills"][0]["image"] == "/ux/art/earn-shop.webp"
    # "" goes back to automatic.
    assert (await client.patch(f"/admin/work/categories/{cat}", json={"image": ""}, headers=hadmin)).status_code == 200
    tax = {c["key"]: c for c in (await client.get("/work/taxonomy", headers=hm)).json()["categories"]}
    assert tax[cat]["image"] == ""


async def test_people_hiring_see_her_shown_work_first(api):
    """Her portfolio's shown pieces ride on her card — matching work first, hidden ones never."""
    client, db, made = api
    lata, hl = await _member(db, made, "Lata Tailor")
    _, hh = await _member(db, made, "Hiring Boutique")
    await _save(client, hl, [{"key": "blouse_stitching", "level": "5+", "visible": True}])
    for title, cat, shown in [("Cake for a birthday", "food_cooking", True), ("Bridal blouse", "tailoring_fashion", True),
                              ("Secret sample", "tailoring_fashion", False)]:
        got = await client.post("/me/portfolio", json={"title": title, "photo": "/media/cover/x.png", "category": cat,
                                                       "visible": shown}, headers=hl)
        assert got.status_code == 201, got.text
    found = (await client.get("/work/talent", params={"skills": "blouse_stitching"}, headers=hh)).json()
    row = next(r for r in found["results"] if r["user_id"] == str(lata["_id"]))
    assert [w["title"] for w in row["work"]] == ["Bridal blouse", "Cake for a birthday"]   # tailoring first
    assert row["work_count"] == 2 and "Secret sample" not in str(row)
    assert row["work"][0]["photo"].endswith("/media/cover/x.png")


async def test_work_done_through_womsakhi_from_offer_to_her_profile(api):
    """Offered → she says done → the poster confirms with stars and praise → it is on her work profile and her card."""
    client, db, made = api
    _, hb = await _member(db, made, "Kavya Boutique")
    asha, ha = await _member(db, made, "Asha Stitches")
    await _save(client, ha, [{"key": "blouse_stitching", "level": "5+", "visible": True}])
    job = (await client.post("/work/jobs", json=_job(), headers=hb)).json()
    await client.post(f"/growth/opportunities/{job['id']}/apply", json={"note": "Ready"}, headers=ha)
    app_id = (await client.get(f"/work/jobs/{job['id']}/applicants", headers=hb)).json()[0]["application_id"]

    # Not done before it was offered — by either side.
    assert (await client.post(f"/work/my-applications/{app_id}/done", headers=ha)).status_code == 400
    early = await client.post(f"/work/applications/{app_id}/move", json={"status": "completed"}, headers=hb)
    assert early.status_code == 400
    assert (await client.post(f"/work/applications/{app_id}/move", json={"status": "offered"}, headers=hb)).status_code == 200

    # She says it is done: hers, not yet confirmed; the poster is asked.
    assert (await client.post(f"/work/my-applications/{app_id}/done", headers=ha)).status_code == 200
    hist = (await client.get("/work/history", headers=ha)).json()
    assert hist["items"][0]["title"] == job["title"] and hist["items"][0]["confirmed"] is False
    assert hist["items"][0]["posted_by"] == "member" and "Blouse stitching" in hist["items"][0]["skills"]
    assert (await client.get("/growth/applications", headers=ha)).json()[0]["done"] == "mine"

    # The poster confirms, with stars and praise (an unknown word is dropped).
    ok = await client.post(f"/work/applications/{app_id}/move", headers=hb, json={
        "status": "completed", "rating": 5, "praise": ["On time", "Would hire again", "Bribed me"], "note": "Lovely finish"})
    assert ok.status_code == 200, ok.text
    item = (await client.get("/work/history", headers=ha)).json()["items"][0]
    assert item["confirmed"] and item["rating"] == 5 and item["praise"] == ["On time", "Would hire again"]
    assert item["note"] == "Lovely finish"
    assert (await client.get("/growth/applications", headers=ha)).json()[0]["done"] == "confirmed"

    # Her card says so to the next person hiring.
    _, hh = await _member(db, made, "Next Hirer")
    found = (await client.get("/work/talent", params={"skills": "blouse_stitching"}, headers=hh)).json()
    row = next(r for r in found["results"] if r["user_id"] == str(asha["_id"]))
    assert row["jobs_done"] == 1 and row["jobs_confirmed"] == 1
    # Nobody else's history leaks into hers.
    assert (await client.get("/work/history", headers=hh)).json()["items"] == []


async def test_staff_confirm_work_done_on_a_job_the_team_listed(api):
    client, db, made = api
    _, hadmin = await _member(db, made, "Staff Confirmer", role="Super Admin")
    meena, hm = await _member(db, made, "Meena Worker")
    posted = await client.post("/admin/growth/opportunities", json={
        "title": "Test job: uniform stitching", "org": "Govt School", "skill_keys": ["tailoring"]}, headers=hadmin)
    assert posted.status_code in (200, 201), posted.text
    opp = posted.json()["id"]
    await db["opportunities"].update_one({"_id": __import__("bson").ObjectId(opp)}, {"$set": {"status": "open"}})
    applied = await client.post(f"/growth/opportunities/{opp}/apply", json={}, headers=hm)
    assert applied.status_code == 201, applied.text
    app_id = applied.json()["id"]
    early = await client.patch(f"/admin/growth/applications/{app_id}", json={"status": "completed"}, headers=hadmin)
    assert early.status_code == 400
    assert (await client.patch(f"/admin/growth/applications/{app_id}", json={"status": "offered"}, headers=hadmin)).status_code == 200
    done = await client.patch(f"/admin/growth/applications/{app_id}", json={"status": "completed", "staff_note": "Delivered 40 uniforms"}, headers=hadmin)
    assert done.status_code == 200, done.text
    item = (await client.get("/work/history", headers=hm)).json()["items"][0]
    assert item["confirmed"] and item["posted_by"] == "staff" and item["org"] == "Govt School"
    assert item["note"] == "Delivered 40 uniforms"
    await db["applications"].delete_many({"user_id": str(meena["_id"])})
