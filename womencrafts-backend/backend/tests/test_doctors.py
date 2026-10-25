"""
Doctor Consultation: staff add doctors, members see only active ones, slots
come from weekly hours minus live bookings, one slot cannot be booked twice,
and a consultation moves requested → confirmed → completed (with a
prescription she can read) or cancelled.

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
        await db["doctor_consultations"].delete_many({"user_id": {"$in": uids}})
        await db["doctors"].delete_many({"name": {"$regex": "^Dr Test "}})
        await db["member_notifications"].delete_many({"user_id": {"$in": uids}})
        cache.clear()
        mongodb._client, mongodb._db = None, None


async def _member(db, made, name: str, role: str = "Member"):
    now = datetime.now(timezone.utc)
    doc = {
        "full_name": name, "email": f"st-{uuid.uuid4().hex[:10]}@example.com",
        "email_verified_at": now, "role": role, "is_active": True, "token_version": 0,
        "verification_status": "active", "created_at": now, "updated_at": now,
    }
    doc["_id"] = (await db["users"].insert_one(doc)).inserted_id
    made["users"].append(doc["_id"])
    tokens = await sessions.start(None, doc)
    return doc, {"Authorization": f"Bearer {tokens['access_token']}"}


from datetime import timedelta as _td

from app.routes.doctors import IST


ALL_WEEK = [{"day": d, "start": "09:00", "end": "21:00", "slot_minutes": 30}
            for d in ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")]


async def _doctor(client, sh, **over):
    body = {"name": f"Dr Test {uuid.uuid4().hex[:5]}", "speciality": "Gynaecologist", "languages": ["Hindi", "English"],
            "modes": ["Video", "Clinic"], "fee_minor": 30000, "availability": ALL_WEEK, **over}
    got = await client.post("/admin/doctors", json=body, headers=sh)
    assert got.status_code == 201, got.text
    return got.json()


def _tomorrow():
    return (datetime.now(IST) + _td(days=1)).date().isoformat()


async def test_staff_add_members_see_only_active(api):
    client, db, made = api
    _, sh = await _member(db, made, "Staff One", role="Super Admin")
    _, h = await _member(db, made, "Asha")
    on = await _doctor(client, sh)
    off = await _doctor(client, sh, active=False)
    names = [d["name"] for d in (await client.get("/doctors", headers=h)).json()]
    assert on["name"] in names and off["name"] not in names
    assert on["verified"] is True and on["days"] == ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    assert (await client.get(f"/doctors/{off['id']}", headers=h)).status_code == 404
    # A member cannot add doctors.
    assert (await client.post("/admin/doctors", json={"name": "Dr Test x", "speciality": "Other"}, headers=h)).status_code == 403
    filt = (await client.get("/doctors", params={"speciality": "Counsellor"}, headers=h)).json()
    assert on["name"] not in [d["name"] for d in filt]


async def test_book_flow_and_no_double_booking(api):
    client, db, made = api
    _, sh = await _member(db, made, "Staff One", role="Super Admin")
    _, h = await _member(db, made, "Asha")
    _, h2 = await _member(db, made, "Bina")
    doc = await _doctor(client, sh)
    day = (await client.get(f"/doctors/{doc['id']}/slots", params={"date": _tomorrow()}, headers=h)).json()
    assert len(day["slots"]) == 24
    slot = day["slots"][3]
    got = await client.post(f"/doctors/{doc['id']}/book", json={"start": slot, "mode": "Video", "reason": "Irregular periods",
                                                               "symptoms": ["Cramps"]}, headers=h)
    assert got.status_code == 201, got.text
    c = got.json()
    assert c["status"] == "requested" and c["prescription"] is None and c["doctor_name"] == doc["name"]
    # Same slot again, by someone else: refused, and it has left the list.
    again = await client.post(f"/doctors/{doc['id']}/book", json={"start": slot, "mode": "Video", "reason": "x y"}, headers=h2)
    assert again.status_code == 409 and again.json()["error"]["code"] == "slot_taken"
    assert slot not in (await client.get(f"/doctors/{doc['id']}/slots", params={"date": _tomorrow()}, headers=h2)).json()["slots"]
    # A mode she does not offer, a made-up time, the past: refused.
    assert (await client.post(f"/doctors/{doc['id']}/book", json={"start": day["slots"][5], "mode": "Phone", "reason": "a b"}, headers=h2)).status_code == 422
    bad = (datetime.now(IST) + _td(days=1)).replace(hour=9, minute=7, second=0, microsecond=0).isoformat()
    assert (await client.post(f"/doctors/{doc['id']}/book", json={"start": bad, "mode": "Video", "reason": "a b"}, headers=h2)).status_code == 409
    past = (datetime.now(IST) - _td(days=1)).isoformat()
    assert (await client.post(f"/doctors/{doc['id']}/book", json={"start": past, "mode": "Video", "reason": "a b"}, headers=h2)).status_code == 409
    mine = (await client.get("/doctors/consultations/mine", headers=h)).json()
    assert [m["id"] for m in mine] == [c["id"]]
    assert set(mine[0]) >= {"id", "doctor_id", "doctor_name", "speciality", "start", "mode", "status", "prescription"}
    assert (await client.get("/doctors/consultations/mine", headers=h2)).json() == []


async def test_staff_confirm_complete_with_prescription(api):
    client, db, made = api
    _, sh = await _member(db, made, "Staff One", role="Super Admin")
    me, h = await _member(db, made, "Asha")
    doc = await _doctor(client, sh)
    slot = (await client.get(f"/doctors/{doc['id']}/slots", params={"date": _tomorrow()}, headers=h)).json()["slots"][0]
    c = (await client.post(f"/doctors/{doc['id']}/book", json={"start": slot, "mode": "Clinic", "reason": "Check-up"}, headers=h)).json()
    queue = (await client.get("/admin/doctors/consultations", params={"status": "requested"}, headers=sh)).json()
    assert c["id"] in [q["id"] for q in queue]
    ok = await client.post(f"/admin/doctors/consultations/{c['id']}/confirm", json={"join_info": "Room 4, City Clinic"}, headers=sh)
    assert ok.status_code == 200 and ok.json()["status"] == "confirmed"
    done = await client.post(f"/admin/doctors/consultations/{c['id']}/complete",
                             json={"prescription": "Iron tablet once a day for 30 days."}, headers=sh)
    assert done.status_code == 200
    mine = (await client.get("/doctors/consultations/mine", headers=h)).json()[0]
    assert mine["status"] == "completed" and mine["prescription"].startswith("Iron") and mine["join_info"] == "Room 4, City Clinic"
    assert (await client.post(f"/doctors/consultations/{c['id']}/cancel", headers=h)).status_code == 409
    notes = [n["title"] async for n in db["member_notifications"].find({"user_id": str(me["_id"])})]
    assert "Your prescription is ready" in notes and "Your consultation is confirmed" in notes
    # The slot is free again once the consultation is closed? No — it is in the past
    # or completed; a cancelled one frees it:
    slot2 = (await client.get(f"/doctors/{doc['id']}/slots", params={"date": _tomorrow()}, headers=h)).json()["slots"][1]
    c2 = (await client.post(f"/doctors/{doc['id']}/book", json={"start": slot2, "mode": "Video", "reason": "Follow up"}, headers=h)).json()
    assert (await client.post(f"/doctors/consultations/{c2['id']}/cancel", headers=h)).json()["status"] == "cancelled"
    assert slot2 in (await client.get(f"/doctors/{doc['id']}/slots", params={"date": _tomorrow()}, headers=h)).json()["slots"]


async def test_open_booking_limit(api):
    client, db, made = api
    _, sh = await _member(db, made, "Staff One", role="Super Admin")
    _, h = await _member(db, made, "Asha")
    doc = await _doctor(client, sh)
    slots = (await client.get(f"/doctors/{doc['id']}/slots", params={"date": _tomorrow()}, headers=h)).json()["slots"]
    for s in slots[:3]:
        assert (await client.post(f"/doctors/{doc['id']}/book", json={"start": s, "mode": "Video", "reason": "a b"}, headers=h)).status_code == 201
    assert (await client.post(f"/doctors/{doc['id']}/book", json={"start": slots[4], "mode": "Video", "reason": "a b"}, headers=h)).status_code == 429


async def test_share_records_with_consent_then_stop(api):
    """She shares only what she ticks and agrees to; staff see it, never her notes; she can stop sharing before the visit."""
    client, db, made = api
    _, sh = await _member(db, made, "Staff One", role="Super Admin")
    _, h = await _member(db, made, "Asha")
    doc = await _doctor(client, sh)
    slots = (await client.get(f"/doctors/{doc['id']}/slots", params={"date": _tomorrow()}, headers=h)).json()["slots"]
    shared = [{"kind": "allergy", "label": "Penicillin", "detail": "Severe"},
              {"kind": "reading", "label": "Haemoglobin: 10.2 g/dL", "detail": "2026-10-01"}]
    body = {"start": slots[1], "mode": "Video", "reason": "Tiredness", "shared": shared}
    # Ticked without agreeing: refused.
    assert (await client.post(f"/doctors/{doc['id']}/book", json=body, headers=h)).status_code == 422
    got = await client.post(f"/doctors/{doc['id']}/book", json={**body, "share_consent": True}, headers=h)
    assert got.status_code == 201, got.text
    c = got.json()
    assert [x["label"] for x in c["shared"]] == ["Penicillin", "Haemoglobin: 10.2 g/dL"] and c["shared_at"]

    noted = await client.post(f"/doctors/consultations/{c['id']}/notes", json={"notes": "Ask about iron tablets"}, headers=h)
    assert noted.json()["member_notes"] == "Ask about iron tablets"
    staff = (await client.get("/admin/doctors/consultations", headers=sh)).json()
    row = next(x for x in staff if x["id"] == c["id"])
    assert len(row["shared"]) == 2 and row["member_notes"] == ""

    # Stop sharing one, then adding a new one again needs consent.
    less = await client.post(f"/doctors/consultations/{c['id']}/shared", json={"shared": shared[:1]}, headers=h)
    assert [x["label"] for x in less.json()["shared"]] == ["Penicillin"]
    more = shared[:1] + [{"kind": "medication", "label": "Iron", "detail": ""}]
    assert (await client.post(f"/doctors/consultations/{c['id']}/shared", json={"shared": more}, headers=h)).status_code == 422
    assert (await client.post(f"/doctors/consultations/{c['id']}/shared", json={"shared": [], "share_consent": False}, headers=h)).json()["shared"] == []
    # Someone else cannot touch it.
    _, h2 = await _member(db, made, "Bina")
    assert (await client.post(f"/doctors/consultations/{c['id']}/notes", json={"notes": "x"}, headers=h2)).status_code == 404


async def test_reschedule_frees_the_old_slot(api):
    client, db, made = api
    _, sh = await _member(db, made, "Staff One", role="Super Admin")
    _, h = await _member(db, made, "Asha")
    doc = await _doctor(client, sh)
    slots = (await client.get(f"/doctors/{doc['id']}/slots", params={"date": _tomorrow()}, headers=h)).json()["slots"]
    c = (await client.post(f"/doctors/{doc['id']}/book", json={"start": slots[2], "mode": "Video", "reason": "Check-up"}, headers=h)).json()
    await client.post(f"/admin/doctors/consultations/{c['id']}/confirm", json={"join_info": "https://meet.example/abc"}, headers=sh)
    moved = await client.post(f"/doctors/consultations/{c['id']}/reschedule", json={"start": slots[6]}, headers=h)
    assert moved.status_code == 200, moved.text
    m = moved.json()
    # Back to the team to confirm; the old joining details no longer hold.
    assert m["status"] == "requested" and m["join_info"] == "" and m["rescheduled_from"]
    free = (await client.get(f"/doctors/{doc['id']}/slots", params={"date": _tomorrow()}, headers=h)).json()["slots"]
    assert slots[2] in free and slots[6] not in free
    # A time that is not free is refused.
    bad = (datetime.now(IST) + _td(days=1)).replace(hour=9, minute=7, second=0, microsecond=0).isoformat()
    assert (await client.post(f"/doctors/consultations/{c['id']}/reschedule", json={"start": bad}, headers=h)).status_code == 409
