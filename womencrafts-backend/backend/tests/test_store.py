"""
Her store: its name and pictures, and closing it while she is away — her
listings leave the market, an order is refused with her away note, the public
page says so, and on the day she said she is back it opens by itself.

Runs against the throwaway local mongod on 127.0.0.1:27099 (skipped when it is
not running). Every row this module writes is removed afterwards.
"""

import uuid
from datetime import datetime, timedelta, timezone

import httpx
import pytest

from app.core import cache, ratelimit, sessions, store
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
        await db["shop_listings"].delete_many({"user_id": {"$in": uids}})
        await db["shop_orders"].delete_many({"$or": [{"seller_id": {"$in": uids}}, {"buyer_id": {"$in": uids}}]})
        await db["member_notifications"].delete_many({"user_id": {"$in": uids}})
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


async def _shop_with_listing(client, db, made):
    seller, sh = await _member(db, made, "Priya Sharma")
    title = f"Store test kurti {uuid.uuid4().hex[:6]}"
    got = await client.post("/shop/listings", json={"kind": "product", "title": title, "price_minor": 45000,
                                                     "stock": 5, "category": "Clothing"}, headers=sh)
    assert got.status_code == 201, got.text
    return seller, sh, got.json()["id"], title


def _day(n: int) -> str:
    return (store._today() + timedelta(days=n)).isoformat()


async def test_name_and_pictures(api):
    client, db, made = api
    _, sh = await _member(db, made, "Priya Sharma")
    first = (await client.get("/shop/store", headers=sh)).json()
    assert first["display_name"] == "Priya's shop" and first["open"] is True and first["handle"]
    got = await client.put("/shop/store", json={"name": "  Priya   Stitches ", "tagline": "Blouses in 3 days",
                                                "logo": "media/avatar/x.png"}, headers=sh)
    assert got.status_code == 200, got.text
    body = got.json()
    assert body["name"] == "Priya Stitches" and body["display_name"] == "Priya Stitches"
    assert body["tagline"] == "Blouses in 3 days" and body["logo"].endswith("media/avatar/x.png")


async def test_closing_hides_her_listings_and_refuses_orders(api):
    client, db, made = api
    seller, sh, listing_id, title = await _shop_with_listing(client, db, made)
    _, bh = await _member(db, made, "Buyer Woman")

    browse = (await client.get("/market/listings", params={"q": title}, headers=bh)).json()
    assert [r["id"] for r in browse] == [listing_id]
    assert browse[0]["seller"]["shop_name"] == "Priya's shop" and browse[0]["seller"]["open"] is True

    closed = await client.put("/shop/store/availability",
                              json={"open": False, "back_on": _day(5), "away_reason": "On holiday"}, headers=sh)
    assert closed.status_code == 200, closed.text
    assert closed.json()["open"] is False and closed.json()["back_on"] == _day(5)

    assert (await client.get("/market/listings", params={"q": title}, headers=bh)).json() == []
    one = (await client.get(f"/market/listings/{listing_id}", headers=bh)).json()
    assert one["seller"]["open"] is False and "on holiday" in one["seller"]["away_line"]
    order = await client.post(f"/market/listings/{listing_id}/order", json={"quantity": 1}, headers=bh)
    assert order.status_code == 409 and order.json()["error"]["code"] == "shop_closed"
    assert "not taking orders" in order.json()["error"]["message"]

    shop = (await client.get(f"/public/shop/{closed.json()['handle']}")).json()
    assert shop["open"] is False and shop["away_line"] and shop["listing_count"] == 1

    reopened = await client.put("/shop/store/availability", json={"open": True}, headers=sh)
    assert reopened.json()["open"] is True and reopened.json()["back_on"] == ""
    assert [r["id"] for r in (await client.get("/market/listings", params={"q": title}, headers=bh)).json()] == [listing_id]
    order = await client.post(f"/market/listings/{listing_id}/order", json={"quantity": 1}, headers=bh)
    assert order.status_code == 201, order.text


async def test_it_opens_by_itself_on_the_day_she_is_back(api):
    client, db, made = api
    seller, sh, listing_id, title = await _shop_with_listing(client, db, made)
    _, bh = await _member(db, made, "Buyer Woman")
    # Closed last week "until today" — as if the date has now arrived.
    await db["users"].update_one({"_id": seller["_id"]},
                                 {"$set": {"store.open": False, "store.back_on": _day(0)}})
    assert (await client.get("/shop/store", headers=sh)).json()["open"] is True
    assert [r["id"] for r in (await client.get("/market/listings", params={"q": title}, headers=bh)).json()] == [listing_id]


async def test_closed_until_she_opens_it(api):
    client, db, made = api
    seller, sh, listing_id, title = await _shop_with_listing(client, db, made)
    _, bh = await _member(db, made, "Buyer Woman")
    got = await client.put("/shop/store/availability", json={"open": False}, headers=sh)
    assert got.json()["open"] is False and got.json()["back_on"] == ""
    assert (await client.get("/market/listings", params={"q": title}, headers=bh)).json() == []


async def test_back_on_must_be_a_future_day(api):
    client, db, made = api
    _, sh = await _member(db, made, "Priya Sharma")
    for bad in (_day(0), _day(-2), _day(200), "next week"):
        got = await client.put("/shop/store/availability", json={"open": False, "back_on": bad}, headers=sh)
        assert got.status_code == 422, bad
