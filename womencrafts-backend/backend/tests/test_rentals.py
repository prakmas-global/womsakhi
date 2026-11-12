"""
Rent & borrow: listing, the board, dates that never double-book, the whole
handover → return → deposit flow, reviews both ways, the money book, and staff.

Runs against the throwaway local mongod on 127.0.0.1:27099 (skipped when it is
not running). Every row this module writes is removed afterwards.
"""

import uuid
from datetime import date, datetime, timedelta, timezone

import httpx
import pytest
from bson import ObjectId

from app.core import cache, ratelimit, sessions
from app.core import rentals as r
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
        await db["rental_items"].delete_many({"owner_id": {"$in": uids}})
        await db["rental_bookings"].delete_many({"owner_id": {"$in": uids}})
        await db["rental_reviews"].delete_many({"by_user_id": {"$in": uids}})
        from app.models.reminders import ReminderModel
        for col in ("khata_entries", "member_notifications", ReminderModel.collection_name, "reminder_occurrences"):
            await db[col].delete_many({"user_id": {"$in": uids}})
        await db[sessions.COLLECTION].delete_many({"user_id": {"$in": uids}})
        cache.clear()
        mongodb._client, mongodb._db = None, None


async def _member(db, made, name: str, role: str = "Member", status: str = "active"):
    now = datetime.now(timezone.utc)
    doc = {"full_name": name, "email": f"rent-{uuid.uuid4().hex[:10]}@example.com", "email_verified_at": now,
           "role": role, "is_active": True, "token_version": 0, "verification_status": status,
           "created_at": now, "updated_at": now}
    doc["_id"] = (await db["users"].insert_one(doc)).inserted_id
    made["users"].append(doc["_id"])
    tokens = await sessions.start(None, doc)
    return doc, {"Authorization": f"Bearer {tokens['access_token']}"}


def _item(**over):
    body = {"title": "Red bridal lehenga", "category": "Sarees & lehengas", "about": "Worn once. Size M.",
            "photos": ["/ux/art/work-dashboard-tailoring.webp"], "condition": "like_new",
            "price_day_rupees": 500, "price_week_rupees": 2500, "deposit_rupees": 3000,
            "min_days": 2, "max_days": 10, "handover": "pickup", "area": "Kukatpally", "city": "Hyderabad",
            "rules": ["Dry clean only"]}
    body.update(over)
    return body


def _d(n: int) -> str:
    return (date.today() + timedelta(days=n)).isoformat()


def test_pricing():
    item = {"price_day_minor": 500_00, "price_week_minor": 2500_00, "deposit_minor": 3000_00, "min_days": 2, "max_days": 10}
    assert r.rent_for(item, 3) == 1500_00
    assert r.rent_for(item, 7) == 2500_00                    # a week at the weekly price
    assert r.rent_for(item, 9) == 2500_00 + 1000_00          # a week and two days
    q = r.quote(item, date(2026, 11, 1), date(2026, 11, 7))
    assert q["days"] == 7 and q["saved_by_week_minor"] == 1000_00 and q["pay_at_pickup_minor"] == 5500_00
    assert r.check_dates(item, date.today(), date.today())       # shorter than min_days
    assert r.check_dates(item, date.today() - timedelta(days=1), date.today() + timedelta(days=2))
    assert r.overlaps("2026-11-01", "2026-11-05", "2026-11-05", "2026-11-08")
    assert not r.overlaps("2026-11-01", "2026-11-04", "2026-11-05", "2026-11-08")


async def test_listing_and_board(api):
    client, db, made = api
    _, ho = await _member(db, made, "Sunita Owner")
    _, hr = await _member(db, made, "Rekha Renter")
    _, hw = await _member(db, made, "Waiting Member", status="pending")
    bad = await client.post("/rentals", json=_item(category="Spaceships"), headers=ho)
    assert bad.status_code == 422
    assert (await client.post("/rentals", json=_item(price_week_rupees=4000), headers=ho)).status_code == 422  # week ≥ 7 days
    got = await client.post("/rentals", json=_item(), headers=ho)
    assert got.status_code == 201, got.text
    item = got.json()
    assert item["price_day_minor"] == 500_00 and item["deposit_minor"] == 3000_00 and item["mine"]
    board = (await client.get("/rentals", params={"city": "Hyderabad"}, headers=hr)).json()
    assert any(c["id"] == item["id"] for c in board)
    assert all(c["id"] != item["id"] for c in (await client.get("/rentals", headers=ho)).json())   # not her own
    assert (await client.get("/rentals", params={"mine": True}, headers=ho)).json()[0]["id"] == item["id"]
    assert (await client.get("/rentals", headers=hw)).status_code == 403                          # verified only
    assert "phone" not in str(await client.get(f"/rentals/{item['id']}", headers=hr))
    # Paused things leave the board.
    await client.patch(f"/rentals/{item['id']}", json={"status": "paused"}, headers=ho)
    assert all(c["id"] != item["id"] for c in (await client.get("/rentals", headers=hr)).json())


async def test_a_rental_from_request_to_closed(api):
    client, db, made = api
    owner, ho = await _member(db, made, "Sunita Owner")
    renter, hr = await _member(db, made, "Rekha Renter")
    other, hx = await _member(db, made, "Kavya Other")
    item = (await client.post("/rentals", json=_item(), headers=ho)).json()
    iid = item["id"]

    quote = (await client.get(f"/rentals/{iid}/quote", params={"start": _d(0), "end": _d(2)}, headers=hr)).json()
    assert quote["ok"] and quote["rent_minor"] == 1500_00 and quote["pay_at_pickup_minor"] == 4500_00
    bk = await client.post(f"/rentals/{iid}/book", json={"start": _d(0), "end": _d(2), "note": "For my sister's wedding"}, headers=hr)
    assert bk.status_code == 201, bk.text
    bid = bk.json()["id"]
    assert (await client.post(f"/rentals/{iid}/book", json={"start": _d(5), "end": _d(6)}, headers=hr)).status_code == 409  # one open ask
    # Another woman asks for overlapping days; only one can be accepted.
    bx = (await client.post(f"/rentals/{iid}/book", json={"start": _d(1), "end": _d(3)}, headers=hx)).json()["id"]
    assert (await client.post(f"/rentals/bookings/{bid}/accept", headers=hr)).status_code == 403     # not the owner
    assert (await client.post(f"/rentals/bookings/{bid}/accept", headers=ho)).status_code == 200
    assert (await client.post(f"/rentals/bookings/{bx}/accept", headers=ho)).status_code == 409      # dates held
    assert (await client.get(f"/rentals/{iid}/quote", params={"start": _d(1), "end": _d(2)}, headers=hx)).json()["ok"] is False
    assert (await client.get(f"/rentals/{iid}", headers=hx)).json()["busy"] == [{"start": _d(0), "end": _d(2)}]
    # Pickup day is on her reminders.
    from app.models.reminders import ReminderModel
    assert await db[ReminderModel.collection_name].count_documents(
        {"user_id": str(renter["_id"]), "domain.module": "rentals", "title_key": "rent.pickupToday"}) == 1

    ho_view = (await client.post(f"/rentals/bookings/{bid}/handover", headers=ho, json={
        "rent_paid": True, "deposit_paid": True, "condition": "like_new", "photos": ["/ux/art/earn-shop.webp"]})).json()
    assert ho_view["status"] == "active" and ho_view["rent_paid"] and ho_view["photos_out"][0].endswith("earn-shop.webp")
    # A deduction needs a reason, and can never exceed the deposit.
    assert (await client.post(f"/rentals/bookings/{bid}/return", json={"condition": "damaged", "deduction_rupees": 500}, headers=ho)).status_code == 422
    assert (await client.post(f"/rentals/bookings/{bid}/return", json={"condition": "damaged", "deduction_rupees": 9000, "note": "x"}, headers=ho)).status_code == 422
    back = (await client.post(f"/rentals/bookings/{bid}/return", headers=ho,
                              json={"condition": "damaged", "deduction_rupees": 500, "note": "A small stain on the dupatta"})).json()
    assert back["status"] == "returned" and back["deposit_back_minor"] == 2500_00
    # Both money books have it: rent plus what was kept.
    mine = await db["khata_entries"].find_one({"user_id": str(owner["_id"]), "source": "rental"})
    theirs = await db["khata_entries"].find_one({"user_id": str(renter["_id"]), "source": "rental"})
    assert mine["kind"] == "in" and mine["amount_minor"] == 2000_00 and mine["category"] == "rent_earned"
    assert theirs["kind"] == "out" and theirs["amount_minor"] == 2000_00 and theirs["category"] == "rent_paid"

    assert (await client.post(f"/rentals/bookings/{bid}/deposit-back", headers=ho)).status_code == 403
    closed = (await client.post(f"/rentals/bookings/{bid}/deposit-back", headers=hr)).json()
    assert closed["status"] == "closed"
    # A problem raised goes to staff, who settle it.
    assert (await client.post(f"/rentals/bookings/{bid}/problem", json={"text": "The stain was already there"}, headers=hr)).status_code == 200

    # Reviews: once per side, praise only from that side's list; ratings come from real reviews.
    rv = await client.post(f"/rentals/bookings/{bid}/review", json={"stars": 5, "praise": ["Clean and as shown", "Returned on time"]}, headers=hr)
    assert rv.status_code == 201 and rv.json()["i_reviewed"]
    assert (await client.post(f"/rentals/bookings/{bid}/review", json={"stars": 4}, headers=hr)).status_code == 409
    assert (await client.post(f"/rentals/bookings/{bid}/review", json={"stars": 4, "praise": ["Took good care"]}, headers=ho)).status_code == 201
    saved = await db["rental_reviews"].find_one({"booking_id": bid, "about": "owner"})
    assert saved["praise"] == ["Clean and as shown"]
    card = (await client.get(f"/rentals/{iid}", headers=hx)).json()
    assert card["owner"]["stars"] == 5.0 and card["owner"]["reviews"] == 1 and card["times_rented"] == 1

    staff, hs = await _member(db, made, "Staff Settler", role="Super Admin")
    probs = (await client.get("/admin/rentals/bookings", params={"problems": True}, headers=hs)).json()
    assert any(p["id"] == bid for p in probs)
    assert (await client.post(f"/admin/rentals/bookings/{bid}/settle", json={"note": "Photos show the stain was new. Deduction stands."},
                              headers=hs)).status_code == 200
    assert (await client.get("/admin/rentals/bookings", headers=hr)).status_code in (401, 403)


async def test_cancel_decline_expire_and_staff_hide(api):
    client, db, made = api
    owner, ho = await _member(db, made, "Sunita Owner")
    _, hr = await _member(db, made, "Rekha Renter")
    iid = (await client.post("/rentals", json=_item(deposit_rupees=0, price_week_rupees=None), headers=ho)).json()["id"]
    b1 = (await client.post(f"/rentals/{iid}/book", json={"start": _d(3), "end": _d(4)}, headers=hr)).json()["id"]
    declined = (await client.post(f"/rentals/bookings/{b1}/decline", json={"reason": "Away that week"}, headers=ho)).json()
    assert declined["status"] == "declined" and declined["reason"] == "Away that week"
    b2 = (await client.post(f"/rentals/{iid}/book", json={"start": _d(5), "end": _d(6)}, headers=hr)).json()["id"]
    await client.post(f"/rentals/bookings/{b2}/accept", headers=ho)
    assert (await client.post(f"/rentals/bookings/{b2}/handover", json={"rent_paid": True, "deposit_paid": False}, headers=ho)).status_code == 400  # too early
    assert (await client.post(f"/rentals/bookings/{b2}/cancel", json={"reason": "Plans changed"}, headers=hr)).json()["status"] == "cancelled"
    # A request nobody answered lapses once its first day has gone.
    b3 = (await client.post(f"/rentals/{iid}/book", json={"start": _d(0), "end": _d(1)}, headers=hr)).json()["id"]
    await db["rental_bookings"].update_one({"_id": ObjectId(b3)}, {"$set": {"start": _d(-1)}})
    assert (await client.get(f"/rentals/bookings/{b3}", headers=hr)).json()["status"] == "expired"
    # No deposit: returning it closes it at once.
    b4 = (await client.post(f"/rentals/{iid}/book", json={"start": _d(0), "end": _d(1)}, headers=hr)).json()["id"]
    await client.post(f"/rentals/bookings/{b4}/accept", headers=ho)
    await client.post(f"/rentals/bookings/{b4}/handover", json={"rent_paid": True, "deposit_paid": False}, headers=ho)
    assert (await client.post(f"/rentals/bookings/{b4}/return", json={"condition": "fine"}, headers=ho)).json()["status"] == "closed"

    _, hs = await _member(db, made, "Staff Hider", role="Super Admin")
    assert (await client.patch(f"/admin/rentals/items/{iid}", json={"hidden": True}, headers=hs)).status_code == 422   # needs a reason
    assert (await client.patch(f"/admin/rentals/items/{iid}", json={"hidden": True, "reason": "Photo is not the item"}, headers=hs)).status_code == 200
    assert all(c["id"] != iid for c in (await client.get("/rentals", headers=hr)).json())
    assert (await client.get(f"/rentals/{iid}", headers=hr)).status_code == 404
    assert (await client.get(f"/rentals/{iid}", headers=ho)).json()["hidden"] is True       # she still sees hers
    mine = (await client.get("/rentals/bookings/mine", params={"side": "owner"}, headers=ho)).json()
    assert {b["status"] for b in mine} >= {"declined", "cancelled", "expired", "closed"}
