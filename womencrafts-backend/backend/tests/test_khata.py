"""
My Khata: notes, money in and out, chits (auction, draw, fixed) and the PIN.

Runs against the throwaway local mongod on 127.0.0.1:27099 (skipped when it is
not running). Every row this module writes is removed afterwards.
"""

import uuid
from datetime import date, datetime, timedelta, timezone

import httpx
import pytest

from app.core import cache, ratelimit, sessions
from app.core import khata as k
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
        for col in ("khata_notes", "khata_entries", "khata_settings", "member_notifications"):
            await db[col].delete_many({"user_id": {"$in": uids}})
        await db["khata_chits"].delete_many({"owner_id": {"$in": uids}})
        await db[sessions.COLLECTION].delete_many({"user_id": {"$in": uids}})
        cache.clear()
        mongodb._client, mongodb._db = None, None


async def _member(db, made, name: str, username: str = ""):
    now = datetime.now(timezone.utc)
    doc = {"full_name": name, "email": f"khata-{uuid.uuid4().hex[:10]}@example.com", "email_verified_at": now,
           "role": "Member", "is_active": True, "token_version": 0, "verification_status": "active",
           "created_at": now, "updated_at": now}
    if username:
        doc["username"] = username
    doc["_id"] = (await db["users"].insert_one(doc)).inserted_id
    made["users"].append(doc["_id"])
    tokens = await sessions.start(None, doc)
    return doc, {"Authorization": f"Bearer {tokens['access_token']}"}


def _months_ago(n: int) -> str:
    d = date.today()
    total = d.year * 12 + d.month - 1 - n
    return f"{total // 12:04d}-{total % 12 + 1:02d}"


def test_auction_maths():
    """₹1 lakh, 20 members, 5% commission, bid ₹20,000: she gets ₹80,000, everyone pays ₹4,250."""
    chit = {"value_minor": 1_00_000_00, "members_count": 20, "monthly_minor": 5_000_00, "method": "auction", "commission_pct": 5}
    got = k.settle(chit, 20_000_00)
    assert got["payout_minor"] == 80_000_00
    assert got["commission_minor"] == 5_000_00
    assert got["dividend_minor"] == 750_00          # (20,000 − 5,000) / 20
    assert got["due_minor"] == 4_250_00
    assert k.check_bid(chit, 4_000_00)              # below the commission
    assert k.check_bid(chit, 41_000_00)             # above 40%
    assert k.check_bid(chit, 40_000_00) is None
    fixed = {**chit, "method": "fixed", "commission_pct": 0}
    assert k.settle(fixed, 0)["payout_minor"] == 1_00_000_00 and k.settle(fixed, 0)["due_minor"] == 5_000_00


async def test_notes_and_money_book(api):
    client, db, made = api
    _, h = await _member(db, made, "Lakshmi Devi")
    n = await client.post("/me/khata/notes", json={"text": "Buy school shoes for Riya", "colour": "yellow", "pinned": True,
                                                   "amount_minor": 60000}, headers=h)
    assert n.status_code == 201, n.text
    await client.post("/me/khata/notes", json={"text": "Call aunty about the chit"}, headers=h)
    notes = (await client.get("/me/khata/notes", headers=h)).json()
    assert notes[0]["pinned"] and notes[0]["amount_minor"] == 60000
    assert len((await client.get("/me/khata/notes", params={"q": "chit"}, headers=h)).json()) == 1
    assert (await client.post("/me/khata/notes", json={"text": "x", "colour": "neon"}, headers=h)).status_code == 422
    edited = await client.patch(f"/me/khata/notes/{n.json()['id']}", json={"clear_amount": True, "pinned": False}, headers=h)
    assert edited.json()["amount_minor"] is None and not edited.json()["pinned"]

    assert (await client.post("/me/khata/entries", json={"kind": "in", "amount_minor": 1200000, "note": "Tailoring orders",
                                                          "category": "sales"}, headers=h)).status_code == 201
    out = await client.post("/me/khata/entries", json={"kind": "out", "amount_minor": 350000, "note": "Groceries",
                                                        "category": "food"}, headers=h)
    assert out.status_code == 201
    assert (await client.post("/me/khata/entries", json={"kind": "out", "amount_minor": 100, "category": "sales"},
                              headers=h)).status_code == 422          # sales is not a spend
    book = (await client.get("/me/khata/entries", headers=h)).json()
    assert book["in_minor"] == 1200000 and book["out_minor"] == 350000 and book["left_minor"] == 850000
    assert book["by_category"]["food"] == 350000
    assert (await client.delete(f"/me/khata/entries/{out.json()['id']}", headers=h)).status_code == 200


async def test_auction_chit_with_a_linked_member(api):
    client, db, made = api
    org, ho = await _member(db, made, "Sarita Organiser")
    meena, hm = await _member(db, made, "Meena Member", username="meena.k")
    _, hx = await _member(db, made, "Outsider")
    chit = await client.post("/me/khata/chits", headers=ho, json={
        "name": "Ward 5 chit", "value_rupees": 100000, "members_count": 20, "start_month": _months_ago(1),
        "method": "auction", "commission_pct": 5, "my_role": "organiser", "i_am_member": False,
        "members": [{"name": "Kamala", "phone": "9876543210"}, {"username": "@meena.k"}]})
    assert chit.status_code == 201, chit.text
    c = chit.json()
    assert c["monthly_minor"] == 5_000_00 and c["month_now"] == 2 and len(c["members"]) == 2
    kamala = next(m for m in c["members"] if m["name"] == "Kamala")
    meena_row = next(m for m in c["members"] if m["linked"])
    assert await db["member_notifications"].count_documents({"user_id": str(meena["_id"]), "title": {"$regex": "Ward 5"}}) == 1

    # Not yet: month 3 has not come.
    assert (await client.post(f"/me/khata/chits/{c['id']}/months/3/decide", json={"member_id": kamala["id"], "bid_rupees": 20000},
                              headers=ho)).status_code == 400
    bad = await client.post(f"/me/khata/chits/{c['id']}/months/1/decide", json={"member_id": kamala["id"], "bid_rupees": 50000}, headers=ho)
    assert bad.status_code == 422                       # over 40%
    ok = await client.post(f"/me/khata/chits/{c['id']}/months/1/decide", json={"member_id": kamala["id"], "bid_rupees": 20000}, headers=ho)
    assert ok.status_code == 200, ok.text
    m1 = ok.json()["months"][0]
    assert m1["payout_minor"] == 80_000_00 and m1["due_minor"] == 4_250_00 and m1["winner"] == kamala["id"]
    # She cannot win twice.
    again = await client.post(f"/me/khata/chits/{c['id']}/months/2/decide", json={"member_id": kamala["id"], "bid_rupees": 10000}, headers=ho)
    assert again.status_code == 409

    # Meena sees it, without phones, and says she paid; the organiser confirms.
    seen = (await client.get(f"/me/khata/chits/{c['id']}", headers=hm)).json()
    assert seen["viewer"] == "member" and all("phone" not in m for m in seen["members"])
    assert seen["my_due_minor"] == 4_250_00 + 5_000_00          # month 1 after dividend, month 2 not yet decided
    assert (await client.post(f"/me/khata/chits/{c['id']}/months/1/i-paid", headers=hm)).status_code == 200
    assert meena_row["id"] in (await client.get(f"/me/khata/chits/{c['id']}", headers=ho)).json()["months"][0]["claimed"]
    paid = await client.post(f"/me/khata/chits/{c['id']}/months/1/payments", json={"member_id": meena_row["id"], "paid": True}, headers=ho)
    assert paid.json()["months"][0]["paid"] == [meena_row["id"]]
    # Her money book has it, written by the chit; the organiser's has her commission.
    mine = (await client.get("/me/khata/entries", params={"month": _months_ago(1)}, headers=hm)).json()
    line = next(i for i in mine["items"] if i["source"] == "chit")
    assert line["kind"] == "out" and line["amount_minor"] == 4_250_00 and line["category"] == "chit_payment"
    assert (await client.delete(f"/me/khata/entries/{line['id']}", headers=hm)).status_code == 400
    theirs = (await client.get("/me/khata/entries", params={"month": _months_ago(1)}, headers=ho)).json()
    assert any(i["category"] == "chit_commission" and i["amount_minor"] == 5_000_00 for i in theirs["items"])

    # Nobody else sees it; members cannot run it.
    assert (await client.get(f"/me/khata/chits/{c['id']}", headers=hx)).status_code == 404
    assert (await client.post(f"/me/khata/chits/{c['id']}/months/2/decide", json={"member_id": meena_row["id"], "bid_rupees": 9000},
                              headers=hm)).status_code == 404
    assert any(x["id"] == c["id"] for x in (await client.get("/me/khata/chits", headers=hm)).json())
    # Removing it removes its lines from every book.
    assert (await client.delete(f"/me/khata/chits/{c['id']}", headers=ho)).status_code == 200
    assert not await db["khata_entries"].count_documents({"chit_id": c["id"]})


async def test_draw_and_fixed_chits(api):
    client, db, made = api
    _, h = await _member(db, made, "Anitha")
    body = {"name": "Family chit", "value_rupees": 50000, "members_count": 5, "start_month": _months_ago(2),
            "commission_pct": 0, "my_role": "member", "i_am_member": True,
            "members": [{"name": n} for n in ("Ammu", "Bindu", "Chitra", "Devi")]}
    draw = (await client.post("/me/khata/chits", json={**body, "method": "draw"}, headers=h)).json()
    for month in (1, 2, 3):
        r = await client.post(f"/me/khata/chits/{draw['id']}/months/{month}/decide", json={"draw": True}, headers=h)
        assert r.status_code == 200, r.text
    winners = [m["winner"] for m in r.json()["months"][:3]]
    assert len(set(winners)) == 3 and r.json()["months"][0]["payout_minor"] == 50000_00

    fixed = (await client.post("/me/khata/chits", json={**body, "method": "fixed"}, headers=h)).json()
    assert (await client.post(f"/me/khata/chits/{fixed['id']}/months/1/decide", json={}, headers=h)).status_code == 422
    order = [m["id"] for m in reversed(fixed["members"])]
    assert (await client.put(f"/me/khata/chits/{fixed['id']}/order", json={"member_ids": order[:-1]}, headers=h)).status_code == 422
    assert (await client.put(f"/me/khata/chits/{fixed['id']}/order", json={"member_ids": order}, headers=h)).status_code == 200
    got = (await client.post(f"/me/khata/chits/{fixed['id']}/months/1/decide", json={}, headers=h)).json()
    assert got["months"][0]["winner"] == order[0]
    # Her own payment, marked by her, lands in her book.
    me_row = next(m for m in got["members"] if m["is_me"])
    await client.post(f"/me/khata/chits/{fixed['id']}/months/1/payments", json={"member_id": me_row["id"], "paid": True}, headers=h)
    book = (await client.get("/me/khata/entries", params={"month": _months_ago(2)}, headers=h)).json()
    assert any(i["category"] == "chit_payment" and i["amount_minor"] == 10000_00 for i in book["items"])


async def test_pin_locks_the_khata(api):
    client, db, made = api
    _, h = await _member(db, made, "Revathi")
    assert (await client.get("/me/khata/settings", headers=h)).json() == {"pin_set": False, "hide_amounts": False}
    key = (await client.put("/me/khata/pin", json={"pin": "4321"}, headers=h)).json()["key"]
    locked = await client.get("/me/khata/notes", headers=h)
    assert locked.status_code == 423
    assert (await client.get("/me/khata/notes", headers={**h, "X-Khata-Key": key})).status_code == 200
    assert (await client.post("/me/khata/unlock", json={"pin": "0000"}, headers=h)).status_code == 403
    fresh = (await client.post("/me/khata/unlock", json={"pin": "4321"}, headers=h)).json()["key"]
    assert (await client.get("/me/khata/entries", headers={**h, "X-Khata-Key": fresh})).status_code == 200
    # Changing it needs the old one.
    assert (await client.put("/me/khata/pin", json={"pin": "1111"}, headers=h)).status_code == 422
    for _ in range(5):
        await client.post("/me/khata/unlock", json={"pin": "9999"}, headers=h)
    assert (await client.post("/me/khata/unlock", json={"pin": "4321"}, headers=h)).status_code == 429
    # Forgot PIN works for a session she just opened.
    assert (await client.post("/me/khata/forgot-pin", headers=h)).json() == {"pin_set": False}
    assert (await client.get("/me/khata/notes", headers=h)).status_code == 200
    # …but not for an old one.
    await client.put("/me/khata/pin", json={"pin": "2468"}, headers=h)
    await db[sessions.COLLECTION].update_many({"user_id": str(made["users"][-1])},
                                              {"$set": {"created_at": datetime.now(timezone.utc) - timedelta(hours=2)}})
    assert (await client.post("/me/khata/forgot-pin", headers=h)).status_code == 403
