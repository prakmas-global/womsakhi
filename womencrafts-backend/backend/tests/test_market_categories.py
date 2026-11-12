"""
Shop categories: staff control the tree; a store has one category; every
listing must sit in an active sub-category of it; disabling keeps what is on
sale; changing her store's category pauses what no longer fits.

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


async def _staff(db, made):
    doc, h = await _member(db, made, "Staff Admin")
    await db["users"].update_one({"_id": doc["_id"]}, {"$set": {"role": "Super Admin"}})
    doc["role"] = "Super Admin"
    tokens = await sessions.start(None, doc)
    return {"Authorization": f"Bearer {tokens['access_token']}"}


async def _listing(client, h, **over):
    body = {"kind": "service", "title": f"Cat test {uuid.uuid4().hex[:6]}", "price_minor": 30000}
    body.update(over)
    return await client.post("/shop/listings", json=body, headers=h)


async def test_a_store_lists_only_inside_its_category(api):
    client, db, made = api
    _, h = await _member(db, made, "Priya Tailor")
    tree = (await client.get("/shop/categories", headers=h)).json()
    assert tree["store_category_key"] == "" and any(c["key"] == "clothing" for c in tree["categories"])
    # No category yet: nothing can be listed.
    got = await _listing(client, h, subcategory_key="alterations")
    assert got.status_code == 409 and got.json()["error"]["code"] == "store_category_required"
    assert (await client.put("/shop/store/category", json={"category_key": "clothing"}, headers=h)).status_code == 200
    ok = await _listing(client, h, subcategory_key="alterations")
    assert ok.status_code == 201, ok.text
    assert ok.json()["category"] == "Tailoring and alterations" and ok.json()["category_key"] == "clothing"
    # Food in a tailoring shop is refused, whichever way it is asked.
    no = await _listing(client, h, subcategory_key="tiffin")
    assert no.status_code == 422 and no.json()["error"]["code"] == "subcategory_required"
    no = await _listing(client, h, category_key="food", subcategory_key="tiffin")
    assert no.status_code == 422 and no.json()["error"]["code"] == "category_outside_store"
    # A service-only sub-category can't take a product.
    no = await _listing(client, h, kind="product", subcategory_key="alterations", stock=3)
    assert no.status_code == 422 and no.json()["error"]["code"] == "kind_not_allowed"
    # Editing it into another category is refused too.
    lid = ok.json()["id"]
    no = await client.patch(f"/shop/listings/{lid}", json={"kind": "service", "title": "Tiffin",
                                                           "subcategory_key": "tiffin"}, headers=h)
    assert no.status_code == 422 and no.json()["error"]["code"] == "subcategory_required"
    price = await client.patch(f"/shop/listings/{lid}", json={"kind": "service", "title": "Alterations",
                                                              "price_minor": 25000}, headers=h)
    assert price.status_code == 200 and price.json()["subcategory_key"] == "alterations"


async def test_changing_the_store_category_pauses_what_no_longer_fits(api):
    client, db, made = api
    _, h = await _member(db, made, "Asha")
    await client.put("/shop/store/category", json={"category_key": "clothing"}, headers=h)
    lid = (await _listing(client, h, subcategory_key="blouses")).json()["id"]
    moved = (await client.put("/shop/store/category", json={"category_key": "beauty"}, headers=h)).json()
    assert moved["paused"] == 1 and moved["category_name"] == "Beauty and mehendi"
    mine = {r["id"]: r for r in (await client.get("/shop/listings", headers=h)).json()}
    assert mine[lid]["status"] == "paused" and mine[lid]["paused_reason"] == "category_changed"
    store = (await client.get("/shop/store", headers=h)).json()
    assert store["category_key"] == "beauty" and store["paused_outside"] == 1
    # It can't go back on sale outside her category ...
    back = await client.post(f"/shop/listings/{lid}/pause", params={"paused": "false"}, headers=h)
    assert back.status_code == 422
    # ... but can once she moves it under the new one.
    fixed = await client.patch(f"/shop/listings/{lid}", json={"kind": "service", "title": "Bridal mehendi",
                                                              "category_key": "beauty", "subcategory_key": "mehendi",
                                                              "status": "live"}, headers=h)
    assert fixed.status_code == 200 and fixed.json()["status"] == "live" and fixed.json()["paused_reason"] == ""


async def test_staff_control_the_tree(api):
    client, db, made = api
    sh = await _staff(db, made)
    _, h = await _member(db, made, "Neha")
    name = f"Test cat {uuid.uuid4().hex[:5]}"
    top = await client.post("/admin/market/categories", json={"name": name, "kinds": ["product"]}, headers=sh)
    assert top.status_code == 201, top.text
    key = top.json()["key"]
    sub = (await client.post("/admin/market/categories", json={"name": "Test sub", "parent_key": key, "kinds": ["product"]},
                             headers=sh)).json()
    try:
        assert (await client.post("/admin/market/categories", json={"name": "Test sub", "parent_key": key}, headers=sh)).status_code == 409
        # Members see it, choose it, and list in it.
        assert any(c["key"] == key for c in (await client.get("/shop/categories", headers=h)).json()["categories"])
        assert (await client.put("/shop/store/category", json={"category_key": key}, headers=h)).status_code == 200
        lid = (await _listing(client, h, kind="product", subcategory_key=sub["key"], stock=2)).json()["id"]
        # In use: delete is refused, disable is the answer.
        assert (await client.delete(f"/admin/market/categories/{sub['key']}", headers=sh)).status_code == 409
        tree = {c["key"]: c for c in (await client.get("/admin/market/categories", headers=sh)).json()}
        assert tree[key]["stores"] == 1 and tree[key]["subcategories"][0]["listings"] == 1
        assert (await client.patch(f"/admin/market/categories/{sub['key']}", json={"active": False}, headers=sh)).status_code == 200
        # Disabled: what is on sale stays on sale; nothing new.
        mine = {r["id"]: r for r in (await client.get("/shop/listings", headers=h)).json()}
        assert mine[lid]["status"] == "live"
        no = await _listing(client, h, kind="product", subcategory_key=sub["key"], stock=2)
        assert no.status_code == 409 and no.json()["error"]["code"] == "subcategory_disabled"
        assert all(c["key"] != sub["key"] for c in sum((c["subcategories"] for c in
                   (await client.get("/shop/categories", headers=h)).json()["categories"]), []))
        # A rename carries to the listing.
        await client.patch(f"/admin/market/categories/{sub['key']}", json={"name": "Renamed sub"}, headers=sh)
        mine = {r["id"]: r for r in (await client.get("/shop/listings", headers=h)).json()}
        assert mine[lid]["category"] == "Renamed sub"
        # Members can't touch the tree.
        assert (await client.post("/admin/market/categories", json={"name": "Nope"}, headers=h)).status_code in (401, 403)
    finally:
        await db["shop_listings"].delete_many({"subcategory_key": sub["key"]})
        await db["users"].update_many({"store.category_key": key}, {"$unset": {"store.category_key": ""}})
    assert (await client.delete(f"/admin/market/categories/{key}", headers=sh)).status_code == 409  # has a sub
    assert (await client.delete(f"/admin/market/categories/{sub['key']}", headers=sh)).status_code == 204
    assert (await client.delete(f"/admin/market/categories/{key}", headers=sh)).status_code == 204


def test_old_free_text_is_filed():
    from app.core import market_categories as mc
    rows = [{"key": "clothing", "name": "Clothing and stitching", "parent_key": None},
            {"key": "mehendi", "name": "Mehendi", "parent_key": "beauty"}]
    assert mc.resolve_legacy("Tailoring", rows) == ("clothing", "alterations")
    assert mc.resolve_legacy("mehendi", rows) == ("beauty", "mehendi")
    assert mc.resolve_legacy("Clothing", rows) == ("clothing", None)
    assert mc.resolve_legacy("Spaceships", rows) == (None, None)


async def test_the_public_shop_carries_its_category_picture(api):
    """A stranger's page gets the picture staff set for her category, to stand in for a missing cover."""
    client, db, made = api
    sh = await _staff(db, made)
    _, h = await _member(db, made, "Asha Seller")
    assert (await client.put("/shop/store/category", json={"category_key": "clothing"}, headers=h)).status_code == 200
    handle = (await client.get("/shop/store", headers=h)).json()["handle"]
    before = (await db["market_categories"].find_one({"key": "clothing"})).get("image", "")
    try:
        shop = (await client.get(f"/public/shop/{handle}")).json()
        assert shop["trade"] == "Clothing and stitching" and shop["trade_image"] == ""
        got = await client.patch("/admin/market/categories/clothing", json={"image": "/ux/art/work-dashboard-tailoring.webp"}, headers=sh)
        assert got.status_code == 200, got.text
        cache.clear()
        shop = (await client.get(f"/public/shop/{handle}")).json()
        assert shop["trade_image"] == "/ux/art/work-dashboard-tailoring.webp"
    finally:
        await db["market_categories"].update_one({"key": "clothing"}, {"$set": {"image": before}})
        cache.clear()
