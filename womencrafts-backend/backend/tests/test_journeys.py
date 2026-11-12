from bson import ObjectId

from app.routes.journeys import build_journeys


def test_new_member_has_three_direct_actions_without_false_progress():
    learn, sell, work = build_journeys({}, [], None, 0, 0)
    assert learn.href == "/app/programs?price=free"
    assert sell.href == "/app/documents/store#category"
    assert work.href == "/app/opportunities?where=Remote&view=all"
    assert not any(step.done for j in [learn, sell, work] for step in j.steps)


def test_saved_work_selects_real_next_steps():
    course = str(ObjectId())
    learn, sell, work = build_journeys({"store": {"category_key": "crafts"}}, [{"program_id": course, "status": "active", "completed_lessons": [1]}], {"skills": [{"key": "tailoring"}]}, 1, 1)
    assert learn.href == f"/app/programs/{course}"
    assert learn.steps[0].done and learn.steps[1].done and not learn.steps[2].done
    assert sell.href == "/app/collect" and not sell.steps[2].done  # A ready link is not proof she shared it.
    assert work.href == "/app/applications" and not work.steps[2].done


def test_invalid_course_reference_is_not_emitted_and_completed_course_can_restart():
    learn, _, _ = build_journeys({}, [{"program_id": "../../elsewhere", "status": "active"}], None, 0, 0)
    assert learn.href == "/app/programs?price=free"
    learn, _, _ = build_journeys({}, [{"program_id": str(ObjectId()), "status": "completed"}], None, 0, 0)
    assert all(step.done for step in learn.steps)
    assert learn.action == "Explore another skill"


async def test_journeys_are_member_scoped(local_mongo, monkeypatch):
    import uuid
    from datetime import datetime, timezone
    import httpx
    from app.core import sessions
    from app.core.config import settings
    from app.db import mongodb
    from main import app

    name = f"womsakhi_journeys_test_{uuid.uuid4().hex}"
    monkeypatch.setattr(settings, "DB_NAME", name)
    mongodb._client, mongodb._db = local_mongo, None
    db = mongodb.get_database()
    try:
        users = []
        for full_name in ["Journey Member", "Other Member"]:
            doc = {"_id": ObjectId(), "full_name": full_name, "email": f"{uuid.uuid4().hex}@example.com", "role": "Member", "is_active": True, "verification_status": "active", "token_version": 0, "email_verified_at": datetime.now(timezone.utc)}
            await db["users"].insert_one(doc)
            users.append(doc)
        await db["shop_listings"].insert_one({"user_id": str(users[1]["_id"]), "status": "live"})
        await db["applications"].insert_one({"user_id": str(users[1]["_id"])})
        token = (await sessions.start(None, users[0]))["access_token"]
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            assert (await client.get("/api/v1/me/journeys")).status_code == 401
            response = await client.get("/api/v1/me/journeys", headers={"Authorization": f"Bearer {token}"})
            assert response.status_code == 200, response.text
            sell, work = response.json()[1:]
            assert not sell["steps"][1]["done"] and not work["steps"][1]["done"]
    finally:
        await local_mongo.drop_database(name)
        mongodb._client, mongodb._db = None, None
