"""Real API, queues and in-app delivery against a unique local test database."""
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import httpx
import pytest

from app.core import cache, ratelimit
from app.core.config import settings
from app.core.security import create_access_token
from app.db import mongodb
from app.engines import tick, notify, policy
from app.models.reminders import OccurrenceModel
from app.models.notify import ReceiptModel, IntentModel, DeliveryModel


@pytest.fixture
async def api(local_mongo, monkeypatch):
    name = "womsakhi_reminders_test_" + uuid.uuid4().hex
    monkeypatch.setattr(settings, "DB_NAME", name)
    monkeypatch.setattr(settings, "REDIS_URL", "")
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "ENGINES_ENABLED", True)
    monkeypatch.setattr(settings, "ENGINES_LOCAL_WORKER", True)
    mongodb._client, mongodb._db = local_mongo, None
    cache.clear(); ratelimit._hits.clear()
    from app.db.indexes import ensure_indexes
    from main import app
    await ensure_indexes()
    db = mongodb.get_database()
    headers = []
    users = []
    for full_name in ["Reminder test", "Other test"]:
        row = {"full_name":full_name,"email":uuid.uuid4().hex+"@example.com","role":"Member","is_active":True,"verification_status":"active","token_version":0}
        oid = (await db.users.insert_one(row)).inserted_id
        uid = str(oid); users.append(uid)
        headers.append({"Authorization":"Bearer "+create_access_token({"sub":uid,"role":"Member","tv":0})})
        await policy.update(uid, {"quiet":{"enabled":False}, "channels":{"inapp":True,"push":False,"email":True}})
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url="http://test/api/v1") as client:
            yield client, db, headers, users
    finally:
        await local_mongo.drop_database(name)
        cache.clear(); mongodb._client, mongodb._db = None, None


WATER = {"title_key":"rem.preset.water","schedule_type":"recurring","local_time":"08:00","end_time":"21:00","interval_minutes":30,"tz":"Asia/Calcutta"}


@pytest.mark.asyncio
async def test_create_edit_pause_snooze_done_stop_and_delivery(api, monkeypatch):
    client, db, (h, other), (uid, _) = api
    from app.engines import channels
    email = AsyncMock(side_effect=AssertionError("no external messages in tests"))
    monkeypatch.setitem(channels._ADAPTERS, "email", email)
    preview = await client.post("/engines/reminders/preview",json=WATER,headers=h)
    assert preview.status_code == 200 and len(preview.json()["next"]) == 5
    assert await db.reminder_definitions.count_documents({}) == 0
    created = await client.post("/engines/reminders",json=WATER,headers=h)
    assert created.status_code == 201, created.text
    rule = created.json(); rid = rule["id"]
    assert rule["tz"] == "Asia/Kolkata" and rule["schedule"]["interval_minutes"] == 30
    first_count = await db.reminder_occurrences.count_documents({"definition_id":rid})
    assert first_count > 0
    assert (await client.post(f"/engines/reminders/{rid}/state",json={"state":"paused"},headers=other)).status_code == 404
    assert (await client.post(f"/engines/reminders/{rid}/state",json={"state":"paused"},headers=h)).json()["updated"]
    assert not (await client.get(f"/engines/reminders/{rid}/next",headers=h)).json()["next"]
    assert (await client.post(f"/engines/reminders/{rid}/state",json={"state":"scheduled"},headers=h)).json()["updated"]
    assert (await client.patch(f"/engines/reminders/{rid}",json={"schedule":{"interval_minutes":60}},headers=h)).json()["updated"]
    dates = (await client.get(f"/engines/reminders/{rid}/next",headers=h)).json()["next"]
    assert len(dates) == 5
    # Force one queued occurrence due; no real-time waiting or external provider.
    occ = await db.reminder_occurrences.find_one({"definition_id":rid,"state":"scheduled"},sort=[("due_at",1)])
    oid = str(occ["_id"])
    await db.reminder_occurrences.update_one({"_id":occ["_id"]},{"$set":{"due_at":datetime.now(timezone.utc)-timedelta(seconds=2)}})
    await tick.process_due()
    inbox = await db.member_notifications.find_one({"user_id":uid})
    assert inbox and inbox["title"] == "Time to drink water"
    assert inbox["href"] == "/app/health/reminders/water"
    assert not email.await_count
    await tick.process_due()
    assert await db.member_notifications.count_documents({"user_id":uid}) == 1
    row = (await client.get("/engines/reminders",headers=h)).json()["reminders"][0]
    assert row["due_occurrence"]["id"] == oid
    assert not (await client.post(f"/engines/occurrences/{oid}/action",json={"action":"done"},headers=other)).json()["ok"]
    assert await db[ReceiptModel.collection_name].count_documents({}) == 0
    action = f"/engines/occurrences/{oid}/action"
    assert (await client.post(action,json={"action":"snooze","minutes":15},headers=h)).json()["ok"]
    snoozed = await db.reminder_occurrences.find_one({"_id":occ["_id"]})
    assert snoozed["state"] == "snoozed"
    preview = (await client.get(f"/engines/reminders/{rid}/next", headers=h)).json()["next"]
    assert any(row["id"] == oid and row["state"] == "snoozed" for row in preview)
    assert (await client.post(action,json={"action":"snooze","minutes":15},headers=h)).json()["ok"]
    assert (await db.reminder_occurrences.find_one({"_id":occ["_id"]}))["due_at"] == snoozed["due_at"]
    assert (await client.post(action,json={"action":"done"},headers=h)).json()["ok"]
    assert (await db.reminder_occurrences.find_one({"_id":occ["_id"]}))["state"] == "completed"
    assert (await db[ReceiptModel.collection_name].find_one({"occurrence_id":oid}))["action"] == "done"
    assert (await client.post(action,json={"action":"done"},headers=h)).json()["ok"]
    assert (await client.delete(f"/engines/reminders/{rid}",headers=h)).json()["stopped"]
    assert await db.reminder_occurrences.count_documents({"definition_id":rid,"state":{"$in":["scheduled","snoozed"]}}) == 0


@pytest.mark.asyncio
async def test_stopped_held_occurrence_never_delivers(api):
    client, db, (h,_), (uid,_) = api
    await policy.update(uid,{"quiet":{"enabled":True,"start":"00:00","end":"23:59","days":[]}})
    created = (await client.post("/engines/reminders",json=WATER,headers=h)).json()
    rid = created["id"]
    occ = await db.reminder_occurrences.find_one({"definition_id":rid},sort=[("due_at",1)])
    await db.reminder_occurrences.update_one({"_id":occ["_id"]},{"$set":{"due_at":datetime.now(timezone.utc)-timedelta(seconds=2)}})
    await tick.process_due()
    intent = await db[IntentModel.collection_name].find_one({"user_id":uid})
    assert intent["state"] == IntentModel.STATE_HELD
    await client.delete(f"/engines/reminders/{rid}",headers=h)
    await policy.update(uid,{"quiet":{"enabled":False}})
    await db[IntentModel.collection_name].update_one({"_id":intent["_id"]},{"$set":{"release_after":datetime.now(timezone.utc)-timedelta(seconds=1)}})
    await notify.release_held()
    assert await db.member_notifications.count_documents({"user_id":uid}) == 0


@pytest.mark.asyncio
async def test_one_off_done_finishes_only_that_reminder(api):
    client, db, (h,_), _ = api
    created = (await client.post("/engines/reminders", json={"title_key":"rem.preset.callBack",
        "schedule_type":"once", "at":(datetime.now(timezone.utc)+timedelta(minutes=5)).isoformat()}, headers=h)).json()
    occ = await db.reminder_occurrences.find_one({"definition_id":created["id"]})
    result = await client.post(f"/engines/occurrences/{occ['_id']}/action",json={"action":"done"},headers=h)
    assert result.json()["ok"]
    rule = (await client.get("/engines/reminders",headers=h)).json()["reminders"][0]
    assert rule["state"] == "completed" and rule["due_occurrence"] is None
