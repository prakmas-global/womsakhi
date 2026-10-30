"""
Shop categories — read by members, controlled by staff. Rules live in
app/core/market_categories.py.

Member (`/shop/categories`, `/shop/store/category`):
    the active tree, and choosing her store's one category. Changing it pauses
    the listings that no longer fit; nothing is deleted.

Staff (`/admin/market/categories`, the Market module's permissions):
    the whole tree with how many stores and listings use each row; add, rename,
    reorder, enable, disable; delete only what nothing uses.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator

from app.core import cache, market_categories as mc
from app.core.audit import record
from app.core.deps import get_current_user
from app.core.media import MediaRefOptional
from app.core.permissions import require_permission
from app.core.rbac import require_active_member
from app.db.mongodb import get_database

router = APIRouter(tags=["Member · Work"])
admin_router = APIRouter(prefix="/admin/market/categories", tags=["Market & Shops (staff)"])


def _db():
    return get_database()


# ── member ───────────────────────────────────────────────────────────────────

class SubOut(BaseModel):
    key: str
    name: str
    parent_key: Optional[str] = None
    kinds: list[str]
    description: str = ""
    icon: str = ""
    image: str = ""
    active: bool = True
    order: int = 0


class CategoryOut(SubOut):
    subcategories: list[SubOut] = []


class MyCategories(BaseModel):
    #: Her store's category, "" until she chooses one.
    store_category_key: str = ""
    #: Active categories and their active sub-categories, in staff's order.
    categories: list[CategoryOut]


@router.get("/shop/categories", response_model=MyCategories, summary="What a shop can sell, and mine")
async def my_categories(me: dict = Depends(require_active_member)):
    rows = await mc.all_rows()
    fresh = await _db()["users"].find_one({"_id": me["_id"]}, {"store": 1}) or {}
    return MyCategories(store_category_key=((fresh.get("store") or {}).get("category_key") or ""),
                        categories=mc.tree(rows, active_only=True))


class StoreCategoryIn(BaseModel):
    category_key: str = Field(..., min_length=1, max_length=40)


class StoreCategoryOut(BaseModel):
    category_key: str
    category_name: str
    #: Listings put on pause because they sit outside the new category.
    paused: int = 0
    paused_titles: list[str] = []


@router.put("/shop/store/category", response_model=StoreCategoryOut, summary="Choose what my shop sells")
async def set_store_category(body: StoreCategoryIn, me: dict = Depends(require_active_member)):
    cat = await mc.by_key(body.category_key)
    if not cat or cat.get("parent_key"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Pick one of the categories shown.")
    if not cat.get("active", True):
        raise HTTPException(status.HTTP_409_CONFLICT, {
            "code": "category_disabled", "message": f"“{cat['name']}” isn't open to new shops right now. Pick another."})
    uid = str(me["_id"])
    now = datetime.now(timezone.utc)
    await _db()["users"].update_one({"_id": me["_id"]},
                                    {"$set": {"store.category_key": cat["key"], "store.updated_at": now}})
    # Paused, never deleted: she can move them under the new category, or
    # switch back, and they return exactly as they were.
    outside = {"user_id": uid, "status": "live", "category_key": {"$ne": cat["key"]}}
    titles = [d.get("title", "") async for d in _db()["shop_listings"].find(outside, {"title": 1}).limit(50)]
    res = await _db()["shop_listings"].update_many(
        outside, {"$set": {"status": "paused", "paused_reason": "category_changed", "updated_at": now}})
    await record(me, "store.category", detail=f"{cat['key']}; paused {res.modified_count}")
    if me.get("shop_handle"):
        cache.forget(f"public:shop:{me['shop_handle']}")
    return StoreCategoryOut(category_key=cat["key"], category_name=cat["name"],
                            paused=res.modified_count, paused_titles=titles[: res.modified_count])


# ── staff ────────────────────────────────────────────────────────────────────

class AdminRow(SubOut):
    #: Stores whose category this is (categories only).
    stores: int = 0
    #: Listings filed here, and how many are on sale.
    listings: int = 0
    live_listings: int = 0
    can_delete: bool = False


class AdminCategory(AdminRow):
    subcategories: list[AdminRow] = []


class CategoryIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=60)
    parent_key: Optional[str] = Field(None, max_length=40)
    kinds: list[Literal["product", "service"]] = Field(default_factory=lambda: ["product", "service"], min_length=1)
    description: str = Field("", max_length=200)
    icon: str = Field("", max_length=40)
    image: MediaRefOptional = None
    active: bool = True

    @field_validator("name")
    @classmethod
    def tidy(cls, v: str) -> str:
        return " ".join(v.split())


class CategoryPatch(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=60)
    kinds: Optional[list[Literal["product", "service"]]] = Field(None, min_length=1)
    description: Optional[str] = Field(None, max_length=200)
    icon: Optional[str] = Field(None, max_length=40)
    image: MediaRefOptional = None
    active: Optional[bool] = None


class ReorderIn(BaseModel):
    parent_key: Optional[str] = None
    keys: list[str] = Field(..., min_length=1, max_length=200)


async def _usage() -> tuple[dict, dict, dict]:
    db = _db()
    stores: dict[str, int] = {}
    async for g in db["users"].aggregate([{"$match": {"store.category_key": {"$nin": ["", None]}}},
                                          {"$group": {"_id": "$store.category_key", "n": {"$sum": 1}}}]):
        stores[g["_id"]] = g["n"]
    listings: dict[str, int] = {}
    live: dict[str, int] = {}
    for field in ("category_key", "subcategory_key"):
        async for g in db["shop_listings"].aggregate([
            {"$match": {field: {"$nin": ["", None]}}},
            {"$group": {"_id": f"${field}", "n": {"$sum": 1},
                        "live": {"$sum": {"$cond": [{"$eq": ["$status", "live"]}, 1, 0]}}}}]):
            listings[g["_id"]] = listings.get(g["_id"], 0) + g["n"]
            live[g["_id"]] = live.get(g["_id"], 0) + g["live"]
    return stores, listings, live


def _admin_row(r: dict, stores: dict, listings: dict, live: dict, has_subs: bool = False) -> dict:
    used = stores.get(r["key"], 0) + listings.get(r["key"], 0)
    return {**mc.view(r), "stores": stores.get(r["key"], 0), "listings": listings.get(r["key"], 0),
            "live_listings": live.get(r["key"], 0), "can_delete": used == 0 and not has_subs}


@admin_router.get("", response_model=list[AdminCategory], summary="The whole tree, with usage",
                  dependencies=[Depends(require_permission("market.view"))])
async def admin_tree():
    rows = await mc.all_rows()
    stores, listings, live = await _usage()
    out = []
    for t in [r for r in rows if not r.get("parent_key")]:
        subs = [r for r in rows if r.get("parent_key") == t["key"]]
        out.append({**_admin_row(t, stores, listings, live, has_subs=bool(subs)),
                    "subcategories": [_admin_row(s, stores, listings, live) for s in subs]})
    return out


async def _unique_key(name: str) -> str:
    base = mc.slug(name)
    key, n = base, 2
    while await _db()[mc.COLLECTION].find_one({"key": key}, {"_id": 1}):
        key, n = f"{base}-{n}", n + 1
    return key


@admin_router.post("", response_model=AdminRow, status_code=status.HTTP_201_CREATED, summary="Add a category or sub-category",
                   dependencies=[Depends(require_permission("market.create"))])
async def admin_add(body: CategoryIn, request: Request, me: dict = Depends(get_current_user)):
    await mc.ensure_seeded()
    col = _db()[mc.COLLECTION]
    if body.parent_key:
        parent = await col.find_one({"key": body.parent_key})
        if not parent or parent.get("parent_key"):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "A sub-category goes under a top-level category.")
    clash = await col.find_one({"parent_key": body.parent_key or None,
                                "name": {"$regex": f"^{re.escape(body.name)}$", "$options": "i"}})
    if clash:
        raise HTTPException(status.HTTP_409_CONFLICT, f"“{body.name}” is already here.")
    now = datetime.now(timezone.utc)
    last = await col.find({"parent_key": body.parent_key or None}).sort("order", -1).limit(1).to_list(1)
    doc = {"key": await _unique_key(body.name), "name": body.name, "parent_key": body.parent_key or None,
           "kinds": body.kinds, "description": body.description.strip(), "icon": body.icon.strip(),
           "image": body.image or "", "active": body.active,
           "order": (last[0].get("order", 0) + 1) if last else 0, "created_at": now, "updated_at": now}
    await col.insert_one(doc)
    await record(me, "market.category.add", target=doc["key"], detail=body.name, request=request)
    return _admin_row(doc, {}, {}, {})


@admin_router.patch("/{key}", response_model=AdminRow, summary="Rename, enable, disable or change one",
                    dependencies=[Depends(require_permission("market.edit"))])
async def admin_edit(key: str, body: CategoryPatch, request: Request, me: dict = Depends(get_current_user)):
    col = _db()[mc.COLLECTION]
    row = await col.find_one({"key": key})
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such category")
    sets = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if "name" in sets:
        sets["name"] = " ".join(sets["name"].split())
    if not sets:
        return _admin_row(row, *(await _usage()))
    sets["updated_at"] = datetime.now(timezone.utc)
    await col.update_one({"_id": row["_id"]}, {"$set": sets})
    if "name" in sets and row.get("parent_key"):
        # Listings show their sub-category's name; a rename carries to them.
        await _db()["shop_listings"].update_many({"subcategory_key": key}, {"$set": {"category": sets["name"]}})
    await record(me, "market.category.edit", target=key,
                 detail=", ".join(f"{k}={v}" for k, v in sets.items() if k != "updated_at"), request=request)
    fresh = await col.find_one({"_id": row["_id"]})
    stores, listings, live = await _usage()
    has_subs = bool(await col.count_documents({"parent_key": key}, limit=1))
    return _admin_row(fresh, stores, listings, live, has_subs=has_subs)


@admin_router.delete("/{key}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete one nothing uses",
                     dependencies=[Depends(require_permission("market.delete"))])
async def admin_delete(key: str, request: Request, me: dict = Depends(get_current_user)):
    col = _db()[mc.COLLECTION]
    row = await col.find_one({"key": key})
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such category")
    if await col.count_documents({"parent_key": key}, limit=1):
        raise HTTPException(status.HTTP_409_CONFLICT, {"code": "has_subcategories",
                            "message": "Delete or move its sub-categories first, or disable it instead."})
    stores, listings, _ = await _usage()
    used_by = stores.get(key, 0), listings.get(key, 0)
    if any(used_by):
        raise HTTPException(status.HTTP_409_CONFLICT, {"code": "in_use",
                            "message": f"{used_by[0]} shops and {used_by[1]} listings use it. Disable it instead: "
                                       "what is on sale stays on sale, and nobody can choose it again."})
    await col.delete_one({"_id": row["_id"]})
    await record(me, "market.category.delete", target=key, detail=row.get("name", ""), request=request)


@admin_router.post("/reorder", status_code=status.HTTP_204_NO_CONTENT, summary="Set the order",
                   dependencies=[Depends(require_permission("market.edit"))])
async def admin_reorder(body: ReorderIn, request: Request, me: dict = Depends(get_current_user)):
    col = _db()[mc.COLLECTION]
    have = {r["key"] async for r in col.find({"parent_key": body.parent_key or None}, {"key": 1})}
    if set(body.keys) != have:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Send every key at this level, once.")
    for i, k in enumerate(body.keys):
        await col.update_one({"key": k}, {"$set": {"order": i}})
    await record(me, "market.category.reorder", target=body.parent_key or "top", request=request)
