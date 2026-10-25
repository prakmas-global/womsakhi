"""
Health Records and Appointments & Reminders: her reminders become Reminder
Engine rules (once, daily, weekly, monthly, lead time, done, snooze, delete),
the hourly sweep, private health papers only she can open, and the additive
record fields.

Runs against the throwaway local mongod on 127.0.0.1:27099 (skipped when it is
not running). Every row this module writes is removed afterwards.
"""

import uuid
from datetime import datetime, timedelta, timezone

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
        await db[sessions.COLLECTION].delete_many({"user_id": {"$in": uids}})
        await db["health_entries"].delete_many({"user_id": {"$in": uids}})
        await db["health_settings"].delete_many({"user_id": {"$in": uids}})
        await db["member_notifications"].delete_many({"user_id": {"$in": uids}})
        await db["reminder_definitions"].delete_many({"user_id": {"$in": uids}})
        await db["reminder_occurrences"].delete_many({"user_id": {"$in": uids}})
        async for f in db["health_files"].find({"user_id": {"$in": uids}}):
            from app.routes.verification import PRIVATE_ROOT
            (PRIVATE_ROOT / f["stored_name"]).unlink(missing_ok=True)
        await db["health_files"].delete_many({"user_id": {"$in": uids}})
        cache.clear()
        mongodb._client, mongodb._db = None, None


async def _member(db, made, name: str):
    now = datetime.now(timezone.utc)
    doc = {
        "full_name": name, "email": f"st-{uuid.uuid4().hex[:10]}@example.com",
        "email_verified_at": now, "role": "Member", "is_active": True, "token_version": 0,
        "verification_status": "active", "created_at": now, "updated_at": now,
    }
    doc["_id"] = (await db["users"].insert_one(doc)).inserted_id
    made["users"].append(doc["_id"])
    tokens = await sessions.start(None, doc)
    return doc, {"Authorization": f"Bearer {tokens['access_token']}"}


from datetime import date

from app.engines import health_reminders as hr
from app.routes.health_hub import today_ist

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


async def _rules(db, uid, entry_id, live=True):
    q = {"user_id": uid, "domain.module": hr.MODULE, "domain.ref": entry_id}
    if live:
        q["state"] = {"$ne": "cancelled"}
    return await db["reminder_definitions"].find(q).to_list(20)


def _later_today_or_tomorrow():
    t = date.fromisoformat(today_ist())
    return (t + timedelta(days=1)).isoformat()


async def test_once_reminder_makes_one_rule_and_done_or_delete_stops_it(api):
    client, db, made = api
    me, h = await _member(db, made, "Asha")
    uid = str(me["_id"])
    day = _later_today_or_tomorrow()
    got = await client.post("/me/health/entries", headers=h, json={
        "kind": "reminder", "date": day,
        "data": {"title": "Thyroid tablet", "category": "Medicine", "time": "09:00", "repeat": "Once"}})
    assert got.status_code == 201, got.text
    rid = got.json()["id"]
    rules = await _rules(db, uid, rid)
    assert len(rules) == 1 and rules[0]["schedule"]["type"] == "once"
    # Her words never reach the message: a shared phone's lock screen shows this.
    assert rules[0]["payload"]["title"] == hr.PAYLOAD["title"] and "Thyroid" not in str(rules[0]["payload"])
    occ = await db["reminder_occurrences"].count_documents({"definition_id": str(rules[0]["_id"]), "state": "scheduled"})
    assert occ == 1

    # Marking that day done stops it.
    await client.patch(f"/me/health/entries/{rid}", headers=h, json={"data": {"done": [day]}})
    assert await _rules(db, uid, rid) == []
    # Undo brings it back; deleting stops it again.
    await client.patch(f"/me/health/entries/{rid}", headers=h, json={"data": {"done": []}})
    assert len(await _rules(db, uid, rid)) == 1
    assert (await client.delete(f"/me/health/entries/{rid}", headers=h)).status_code == 204
    assert await _rules(db, uid, rid) == []


async def test_lead_time_and_repeats(api):
    client, db, made = api
    me, h = await _member(db, made, "Asha")
    uid = str(me["_id"])
    await client.put("/me/health/settings", headers=h, json={"reminderLead": 30})
    t = today_ist()
    daily = (await client.post("/me/health/entries", headers=h, json={
        "kind": "reminder", "date": t, "data": {"title": "Water", "category": "Hydration", "time": "08:00", "repeat": "Every day"}})).json()
    rule = (await _rules(db, uid, daily["id"]))[0]
    assert rule["schedule"]["type"] == "recurring" and rule["schedule"]["local_time"] == "07:30" and rule["schedule"]["days"] == []

    weekly = (await client.post("/me/health/entries", headers=h, json={
        "kind": "reminder", "date": t, "data": {"title": "Yoga", "category": "Workout", "time": "00:15", "repeat": "Every week"}})).json()
    rule = (await _rules(db, uid, weekly["id"]))[0]
    # 00:15 less 30 minutes is 23:45 the evening before.
    assert rule["schedule"]["local_time"] == "23:45"
    assert rule["schedule"]["days"] == [(date.fromisoformat(t).weekday() - 1) % 7]

    cancelled = await client.patch(f"/me/health/entries/{daily['id']}", headers=h, json={"data": {"cancelled": True}})
    assert cancelled.status_code == 200 and await _rules(db, uid, daily["id"]) == []


def test_next_monthly_skips_done_and_clamps_short_months():
    start = date(2026, 1, 31)
    assert hr.next_monthly(start, date(2026, 2, 10), set()) == date(2026, 2, 28)
    assert hr.next_monthly(start, date(2026, 2, 10), {"2026-02-28"}) == date(2026, 3, 31)
    assert hr.next_monthly(date(2026, 5, 15), date(2026, 5, 16), set()) == date(2026, 6, 15)


def test_plan_past_once_and_snooze():
    now = datetime(2026, 10, 25, 6, 0, tzinfo=timezone.utc)  # 11:30 IST
    past = {"date": "2026-10-25", "data": {"title": "x", "time": "09:00", "repeat": "Once"}}
    assert hr.plan(past, "Asia/Kolkata", 0, now) is None
    snoozed = {"date": "2026-10-25", "data": {"title": "x", "time": "09:00", "repeat": "Once", "snooze": "2026-10-25T12:00"}}
    p = hr.plan(snoozed, "Asia/Kolkata", 0, now)
    assert p and p["at"] == datetime(2026, 10, 25, 6, 30, tzinfo=timezone.utc)


async def test_sweep_restores_a_missing_rule(api):
    client, db, made = api
    me, h = await _member(db, made, "Asha")
    uid = str(me["_id"])
    got = (await client.post("/me/health/entries", headers=h, json={
        "kind": "reminder", "date": today_ist(),
        "data": {"title": "Check-up", "category": "Doctor appointment", "time": "10:00", "repeat": "Every month"}})).json()
    await db["reminder_definitions"].delete_many({"user_id": uid})
    assert await hr.sweep() >= 1
    assert len(await _rules(db, uid, got["id"])) == 1
    # Idempotent: a second pass changes nothing.
    before = await db["reminder_definitions"].count_documents({"user_id": uid})
    await hr.sweep()
    assert await db["reminder_definitions"].count_documents({"user_id": uid}) == before


async def test_private_papers_are_hers_alone(api):
    client, db, made = api
    _, h = await _member(db, made, "Asha")
    _, other = await _member(db, made, "Bina")
    up = await client.post("/me/health/files", headers=h, files={"file": ("thyroid.png", PNG, "image/png")})
    assert up.status_code == 201, up.text
    fid = up.json()["id"]
    assert up.json()["name"] == "thyroid.png"
    doc = await client.post("/me/health/entries", headers=h, json={
        "kind": "document", "date": today_ist(),
        "data": {"title": "Thyroid test", "type": "Lab report", "file_id": fid, "file_name": "thyroid.png", "shareable": True}})
    assert doc.status_code == 201 and doc.json()["data"]["file_id"] == fid
    mine = await client.get(f"/me/health/files/{fid}", headers=h)
    assert mine.status_code == 200 and mine.content.startswith(b"\x89PNG") and "no-store" in mine.headers["cache-control"]
    assert (await client.get(f"/me/health/files/{fid}", headers=other)).status_code == 404
    assert (await client.delete(f"/me/health/files/{fid}", headers=other)).status_code == 404
    bad = await client.post("/me/health/files", headers=h, files={"file": ("x.txt", b"hello", "text/plain")})
    assert bad.status_code == 415
    assert (await client.delete(f"/me/health/files/{fid}", headers=h)).status_code == 204
    assert (await client.get(f"/me/health/files/{fid}", headers=h)).status_code == 404


async def test_record_fields(api):
    client, db, made = api
    _, h = await _member(db, made, "Asha")
    ok = await client.post("/me/health/entries", headers=h, json={
        "kind": "history", "data": {"cat": "Family history", "condition": "Mother: diabetes", "note": "Since 2010"}})
    assert ok.status_code == 201 and ok.json()["data"]["note"] == "Since 2010"
    bad = await client.post("/me/health/entries", headers=h, json={
        "kind": "reminder", "date": today_ist(), "data": {"title": "x", "snooze": "tomorrow"}})
    assert bad.status_code == 422
