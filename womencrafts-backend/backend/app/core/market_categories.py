"""
Shop categories — the one list staff control, and the rule every listing obeys.

── The tree ─────────────────────────────────────────────────────────────────
`market_categories` holds two levels: a category ("Clothing and stitching")
and its sub-categories ("Blouses", "Alterations"). Staff add, rename, reorder,
enable, disable and delete them from the dashboard (routes/market_categories.py).
Each row:

    {key, name, parent_key: None | <category key>, kinds: ["product","service"],
     description, icon, image, active, order, created_at, updated_at}

`kinds` says what may be listed under it: a sub-category of "Food from home"
can take products and services; "Childcare" only services.

── The rule ─────────────────────────────────────────────────────────────────
A store has ONE category (`users.store.category_key`). Every product or
service she lists must sit in an ACTIVE sub-category of THAT category, and its
kind must be one the sub-category allows. The server checks this on create, on
edit, and when a paused listing is put back on sale — so a tailoring shop can
never list tiffin service, whatever the screen sends.

Disabling a category or sub-category keeps the listings already in it on sale
and stops anyone choosing it again. It can be deleted only when no store and no
listing uses it. Changing her store's category pauses (never deletes) the
listings that no longer fit.

── Where it starts ──────────────────────────────────────────────────────────
Seeded on first read from the categories the app shipped with (the same six
the listing wizard used), so production has a tree before anyone opens the
dashboard. The same first read files existing listings and stores under it,
matching their old free-text category by name.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status

from app.db.mongodb import get_database

COLLECTION = "market_categories"
KINDS = ("product", "service")

#: What the app shipped with. Keys are stable; names are staff's to change.
SEED: list[tuple[str, str, list[str], str, list[tuple[str, str, list[str]]]]] = [
    ("clothing", "Clothing and stitching", ["product", "service"], "Shirt", [
        ("kurtas", "Kurtas and suits", ["product", "service"]),
        ("sarees", "Sarees", ["product", "service"]),
        ("blouses", "Blouses", ["product", "service"]),
        ("kids-clothes", "Children's clothes", ["product", "service"]),
        ("alterations", "Tailoring and alterations", ["service"]),
        ("embroidery", "Embroidery", ["product", "service"]),
    ]),
    ("home", "Home and décor", ["product", "service"], "Home", [
        ("cushions", "Cushion covers", ["product"]),
        ("bed-linen", "Bed linen", ["product"]),
        ("curtains", "Curtains", ["product", "service"]),
        ("wall-hangings", "Wall hangings", ["product"]),
    ]),
    ("food", "Food from home", ["product", "service"], "ChefHat", [
        ("pickles", "Pickles and papad", ["product"]),
        ("snacks", "Snacks", ["product"]),
        ("tiffin", "Tiffin service", ["service"]),
        ("baking", "Baking", ["product", "service"]),
    ]),
    ("beauty", "Beauty and mehendi", ["service"], "Sparkles", [
        ("mehendi", "Mehendi", ["service"]),
        ("threading", "Threading and facial", ["service"]),
        ("bridal", "Bridal packages", ["service"]),
    ]),
    ("teaching", "Teaching and classes", ["service"], "GraduationCap", [
        ("tuition", "Tuition", ["service"]),
        ("craft-classes", "Craft classes", ["service"]),
        ("music-dance", "Music and dance", ["service"]),
    ]),
    ("care", "Care and help", ["service"], "HeartHandshake", [
        ("childcare", "Childcare", ["service"]),
        ("elder-care", "Elder care", ["service"]),
        ("house-help", "House help", ["service"]),
    ]),
    ("handicrafts", "Handicrafts and art", ["product", "service"], "Palette", [
        ("jewellery", "Jewellery", ["product"]),
        ("paintings", "Paintings and art", ["product", "service"]),
        ("gifts", "Handmade gifts", ["product"]),
        ("candles-soaps", "Candles and soaps", ["product"]),
    ]),
    ("digital", "Office and digital work", ["service"], "Laptop", [
        ("data-entry", "Data entry and typing", ["service"]),
        ("design", "Design", ["service"]),
        ("social-media", "Social media help", ["service"]),
        ("translation", "Translation", ["service"]),
    ]),
    ("repairs", "Repairs", ["service"], "Wrench", [
        ("mobile-repair", "Mobile repair", ["service"]),
        ("appliance-repair", "Appliance repair", ["service"]),
        ("machine-repair", "Sewing machine repair", ["service"]),
    ]),
    ("events", "Events and celebrations", ["service"], "PartyPopper", [
        ("decoration", "Decoration", ["service"]),
        ("catering", "Catering help", ["service"]),
        ("event-planning", "Event planning", ["service"]),
    ]),
    ("farm", "Farm and dairy", ["product"], "Sprout", [
        ("dairy", "Milk and dairy", ["product"]),
        ("vegetables", "Vegetables and fruit", ["product"]),
        ("eggs-poultry", "Eggs and poultry", ["product"]),
    ]),
]

#: Onboarding skill groups (app/core/skills.py GROUPS) → a category.
SKILL_GROUPS = {
    "tailoring_fashion": "clothing", "beauty_wellness": "beauty", "food_cooking": "food",
    "teaching_tuition": "teaching", "care_work": "care", "home_services": "care",
    "handicrafts": "handicrafts", "office_digital": "digital", "repairs_technical": "repairs",
    "events_hospitality": "events", "farming_animals": "farm", "arts_performance": "teaching",
}

#: Old free-text categories seen in stored listings, filed under the tree.
LEGACY = {
    "tailoring": ("clothing", "alterations"),
    "stitching": ("clothing", "alterations"),
    "clothing": ("clothing", None),
    "home": ("home", None),
    "beauty": ("beauty", None),
    "tuition": ("teaching", "tuition"),
    "teaching": ("teaching", None),
    "cooking": ("food", None),
    "food": ("food", None),
    "childcare": ("care", "childcare"),
    "cleaning": ("care", "house-help"),
    "repairs": ("repairs", None),
}


def _col():
    return get_database()[COLLECTION]


def slug(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")
    return s[:40] or "category"


async def ensure_seeded() -> None:
    """Write the starting tree once, then file old listings and stores under it."""
    if await _col().count_documents({}, limit=1):
        return
    now = datetime.now(timezone.utc)
    rows = []
    for i, (key, name, kinds, icon, subs) in enumerate(SEED):
        rows.append({"key": key, "name": name, "parent_key": None, "kinds": kinds, "icon": icon,
                     "description": "", "image": "", "active": True, "order": i, "created_at": now, "updated_at": now})
        for j, (skey, sname, skinds) in enumerate(subs):
            rows.append({"key": skey, "name": sname, "parent_key": key, "kinds": skinds, "icon": "",
                         "description": "", "image": "", "active": True, "order": j, "created_at": now, "updated_at": now})
    try:
        await _col().insert_many(rows, ordered=False)
    except Exception:  # noqa: BLE001 — a parallel first read seeded it; the unique index decided
        pass
    await backfill()


async def all_rows() -> list[dict]:
    await ensure_seeded()
    return [r async for r in _col().find({}).sort([("order", 1), ("name", 1)])]


def tree(rows: list[dict], *, active_only: bool) -> list[dict]:
    """Categories, each with its sub-categories, in staff's order."""
    tops = [r for r in rows if not r.get("parent_key") and (r.get("active") or not active_only)]
    out = []
    for t in tops:
        subs = [r for r in rows if r.get("parent_key") == t["key"] and (r.get("active") or not active_only)]
        out.append({**view(t), "subcategories": [view(s) for s in subs]})
    return out


def view(r: dict) -> dict:
    from app.core.media import media_url
    return {
        "key": r["key"], "name": r.get("name", ""), "parent_key": r.get("parent_key") or None,
        "kinds": list(r.get("kinds") or KINDS), "description": r.get("description", ""),
        "icon": r.get("icon", ""), "image": media_url(r.get("image") or ""),
        "active": bool(r.get("active", True)), "order": int(r.get("order", 0)),
    }


async def by_key(key: str) -> Optional[dict]:
    await ensure_seeded()
    return await _col().find_one({"key": key}) if key else None


def resolve_legacy(text: str, rows: list[dict]) -> tuple[Optional[str], Optional[str]]:
    """(category_key, subcategory_key) for an old free-text category, or (None, None)."""
    t = (text or "").strip().lower()
    if not t:
        return None, None
    for r in rows:
        if r.get("name", "").lower() == t or r["key"] == t:
            return (r["parent_key"], r["key"]) if r.get("parent_key") else (r["key"], None)
    if t in LEGACY:
        return LEGACY[t]
    return None, None


async def file_skill(label: str, group: str, kind: str = "service") -> tuple[str, str]:
    """(category_key, subcategory_key) for an onboarding skill, or ("", "")."""
    rows = await all_rows()
    cat, sub = resolve_legacy(label, rows)
    if not cat:
        cat = SKILL_GROUPS.get(group, "")
    if cat and not sub:
        subs = [r for r in rows if r.get("parent_key") == cat and r.get("active", True) and kind in (r.get("kinds") or KINDS)]
        sub = subs[0]["key"] if subs else None
    return cat or "", sub or ""


async def backfill() -> dict:
    """File listings and stores that predate the tree. Safe to run again."""
    db = get_database()
    rows = [r async for r in _col().find({})]
    listings = stores = 0
    async for doc in db["shop_listings"].find({"category_key": {"$exists": False}}, {"category": 1, "user_id": 1}):
        cat, sub = resolve_legacy(doc.get("category", ""), rows)
        await db["shop_listings"].update_one({"_id": doc["_id"]},
                                             {"$set": {"category_key": cat or "", "subcategory_key": sub or ""}})
        listings += 1
    # A store takes the category most of her listings are in.
    pipeline = [{"$match": {"category_key": {"$nin": ["", None]}}},
                {"$group": {"_id": {"u": "$user_id", "c": "$category_key"}, "n": {"$sum": 1}}},
                {"$sort": {"n": -1}}]
    seen: set[str] = set()
    async for g in db["shop_listings"].aggregate(pipeline):
        uid = g["_id"]["u"]
        if uid in seen:
            continue
        seen.add(uid)
        from bson import ObjectId
        if not ObjectId.is_valid(uid):
            continue
        res = await db["users"].update_one(
            {"_id": ObjectId(uid), "$or": [{"store.category_key": {"$exists": False}}, {"store.category_key": ""}]},
            {"$set": {"store.category_key": g["_id"]["c"]}})
        stores += res.modified_count
    return {"listings": listings, "stores": stores}


async def check_listing(store_category: str, category_key: str, subcategory_key: str, kind: str) -> tuple[dict, dict]:
    """
    The rule. Raises 409/422 with a sentence she can act on, or returns
    (category row, sub-category row).
    """
    if not store_category:
        raise HTTPException(status.HTTP_409_CONFLICT, {
            "code": "store_category_required",
            "message": "Choose what your shop sells first, in Store settings.",
        })
    if category_key and category_key != store_category:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, {
            "code": "category_outside_store",
            "message": "Your shop can only list things in its own category. Change your shop's category in Store settings to list this.",
        })
    cat = await by_key(store_category)
    if not cat or cat.get("parent_key"):
        raise HTTPException(status.HTTP_409_CONFLICT, {
            "code": "store_category_missing",
            "message": "Your shop's category no longer exists. Choose another in Store settings.",
        })
    if not cat.get("active", True):
        raise HTTPException(status.HTTP_409_CONFLICT, {
            "code": "category_disabled",
            "message": f"WomSakhi has paused new listings in “{cat['name']}”. What you already have stays on sale.",
        })
    sub = await by_key(subcategory_key)
    if not sub or sub.get("parent_key") != cat["key"]:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, {
            "code": "subcategory_required",
            "message": f"Pick what kind of {cat['name'].lower()} this is.",
        })
    if not sub.get("active", True):
        raise HTTPException(status.HTTP_409_CONFLICT, {
            "code": "subcategory_disabled",
            "message": f"WomSakhi has paused new listings in “{sub['name']}”. Pick another.",
        })
    if kind not in (sub.get("kinds") or KINDS):
        noun = "a product" if kind == "product" else "a service"
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, {
            "code": "kind_not_allowed",
            "message": f"“{sub['name']}” can't be listed as {noun}.",
        })
    return cat, sub
