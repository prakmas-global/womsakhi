"""
Masters — read by every screen, controlled by staff. Rules live in app/core/masters.py.

Anyone signed in (`/masters?lists=a,b`): the active items of the lists a
screen needs, in staff's order.

Staff (`/admin/masters`): every list with item counts, grouped by section;
each list's items with how many records use them; add, rename, reorder,
enable, disable, and delete what nothing uses. Each list is guarded by its own
module's permissions (`<module>.view` to read, `<module>.edit` to change).
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, field_validator

from app.core import masters as m
from app.core.audit import record
from app.core.media import media_url, to_media_path
from app.core.deps import get_current_user
from app.core.permissions import has_permission
from app.db.mongodb import get_database

router = APIRouter(prefix="/masters", tags=["Masters"])
admin_router = APIRouter(prefix="/admin/masters", tags=["Masters (staff)"])


# ── anyone signed in ─────────────────────────────────────────────────────────

@router.get("", summary="The active items of some lists")
async def read_lists(lists: str = Query(..., description="List keys, comma-separated"),
                     _: dict = Depends(get_current_user)) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key in [k for k in lists.split(",") if k][:20]:
        d = m.definition(key)
        out[key] = m.as_tree(d, await m.rows(key, active_only=True))
    return out


# ── staff ────────────────────────────────────────────────────────────────────

async def _need(user: dict, d: m.ListDef, action: str) -> None:
    if not await has_permission(user, f"{d.module}.{action}"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You don't have access to change this list.")


class ItemIn(BaseModel):
    label: str = Field(..., min_length=1, max_length=80)
    parent_key: Optional[str] = Field(None, max_length=60)
    active: bool = True
    extra: dict[str, Any] = Field(default_factory=dict)

    @field_validator("label")
    @classmethod
    def tidy(cls, v: str) -> str:
        return " ".join(v.split())


class ItemPatch(BaseModel):
    label: Optional[str] = Field(None, min_length=1, max_length=80)
    active: Optional[bool] = None
    extra: Optional[dict[str, Any]] = None


class ReorderIn(BaseModel):
    parent_key: Optional[str] = None
    keys: list[str] = Field(..., min_length=1, max_length=500)


def _clean_extra(d: m.ListDef, extra: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in (extra or {}).items():
        if k not in d.extras:
            continue
        if k == "image":
            # An upload, or a picture from the app's own library. Empty means
            # "pick one from the name" on screen.
            path = to_media_path(str(v or "").strip()[:500])
            if path:
                out[k] = path
        elif k == "synonyms":
            words = v if isinstance(v, list) else str(v).split(",")
            out[k] = [str(w).strip().lower()[:40] for w in words if str(w).strip()][:40]
        else:
            out[k] = str(v).strip()[:120]
    return out


def _list_meta(d: m.ListDef) -> dict:
    return {"key": d.key, "name": d.name, "description": d.description, "section": d.section, "module": d.module,
            "levels": d.levels, "parent_name": d.parent_name, "extras": list(d.extras),
            "used_in": [f"{u.collection}.{u.field}" for u in d.uses]}


@admin_router.get("", summary="Every list, grouped by section")
async def admin_lists(user: dict = Depends(get_current_user)) -> list[dict]:
    out = []
    for d in m.LISTS.values():
        if not await has_permission(user, f"{d.module}.view"):
            continue
        items = await m.rows(d.key)
        out.append({**_list_meta(d), "items": len(items), "active_items": sum(1 for i in items if i.get("active", True)),
                    "can_edit": await has_permission(user, f"{d.module}.edit")})
    return out


@admin_router.get("/{list_key}", summary="One list, with how many records use each item")
async def admin_list(list_key: str, user: dict = Depends(get_current_user)) -> dict:
    d = m.definition(list_key)
    await _need(user, d, "view")
    items = await m.rows(list_key)
    used = await m.usage(d)
    has_children = {i["parent_key"] for i in items if i.get("parent_key")}

    def row(i: dict) -> dict:
        n = used.get(i["label"].lower(), 0)
        return {**m.view(i), "used": n, "can_delete": n == 0 and i["key"] not in has_children}

    tree = m.as_tree(d, items)
    if d.levels == 2:
        flat = {i["key"]: i for i in items}
        tree = [{**row(flat[p["key"]]), "children": [row(flat[c["key"]]) for c in p["children"]]} for p in tree]
    else:
        tree = [row(i) for i in items]
    return {**_list_meta(d), "can_edit": await has_permission(user, f"{d.module}.edit"), "items": tree}


@admin_router.post("/{list_key}/items", status_code=status.HTTP_201_CREATED, summary="Add an item")
async def admin_add(list_key: str, body: ItemIn, request: Request, user: dict = Depends(get_current_user)) -> dict:
    d = m.definition(list_key)
    await _need(user, d, "edit")
    await m.ensure_seeded(list_key)
    col = get_database()[m.COLLECTION]
    if body.parent_key:
        if d.levels != 2:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "This list has one level.")
        parent = await col.find_one({"list": list_key, "key": body.parent_key, "parent_key": None})
        if not parent:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Pick a {d.parent_name.lower() or 'group'} to put it under.")
    if await col.find_one({"list": list_key, "label": {"$regex": f"^{re.escape(body.label)}$", "$options": "i"}}):
        raise HTTPException(status.HTTP_409_CONFLICT, f"“{body.label}” is already in this list.")
    key, n = m.slug(body.label), 2
    while await col.find_one({"list": list_key, "key": key}, {"_id": 1}):
        key, n = f"{m.slug(body.label)}-{n}", n + 1
    last = await col.find({"list": list_key, "parent_key": body.parent_key or None}).sort("order", -1).limit(1).to_list(1)
    now = datetime.now(timezone.utc)
    doc = {"list": list_key, "key": key, "label": body.label, "parent_key": body.parent_key or None,
           "active": body.active, "order": (last[0].get("order", 0) + 1) if last else 0,
           "extra": _clean_extra(d, body.extra), "created_at": now, "updated_at": now}
    await col.insert_one(doc)
    await record(user, "masters.add", target=f"{list_key}:{key}", detail=body.label, request=request)
    return {**m.view(doc), "used": 0, "can_delete": True}


@admin_router.patch("/{list_key}/items/{key}", summary="Rename, enable, disable or edit an item")
async def admin_edit(list_key: str, key: str, body: ItemPatch, request: Request,
                     user: dict = Depends(get_current_user)) -> dict:
    d = m.definition(list_key)
    await _need(user, d, "edit")
    col = get_database()[m.COLLECTION]
    item = await col.find_one({"list": list_key, "key": key})
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such item")
    sets: dict[str, Any] = {"updated_at": datetime.now(timezone.utc)}
    carried = 0
    if body.label is not None:
        label = " ".join(body.label.split())
        if label.lower() != item["label"].lower() and await col.find_one(
                {"list": list_key, "label": {"$regex": f"^{re.escape(label)}$", "$options": "i"}}):
            raise HTTPException(status.HTTP_409_CONFLICT, f"“{label}” is already in this list.")
        if label != item["label"]:
            sets["label"] = label
            carried = await m.carry_rename(d, item["label"], label)
    if body.active is not None:
        sets["active"] = body.active
    if body.extra is not None:
        sets["extra"] = _clean_extra(d, body.extra)
    await col.update_one({"_id": item["_id"]}, {"$set": sets})
    await record(user, "masters.edit", target=f"{list_key}:{key}",
                 detail=", ".join(f"{k}={v}" for k, v in sets.items() if k != "updated_at") + (f"; {carried} records renamed" if carried else ""),
                 request=request)
    fresh = await col.find_one({"_id": item["_id"]})
    used = (await m.usage(d)).get(fresh["label"].lower(), 0)
    return {**m.view(fresh), "used": used, "renamed_records": carried,
            "can_delete": used == 0 and not await col.count_documents({"list": list_key, "parent_key": key}, limit=1)}


@admin_router.delete("/{list_key}/items/{key}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete an item nothing uses")
async def admin_delete(list_key: str, key: str, request: Request, user: dict = Depends(get_current_user)):
    d = m.definition(list_key)
    await _need(user, d, "edit")
    col = get_database()[m.COLLECTION]
    item = await col.find_one({"list": list_key, "key": key})
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such item")
    if await col.count_documents({"list": list_key, "parent_key": key}, limit=1):
        raise HTTPException(status.HTTP_409_CONFLICT, {"code": "has_children",
                            "message": "Delete or move what is under it first, or disable it instead."})
    used = (await m.usage(d)).get(item["label"].lower(), 0)
    if used:
        raise HTTPException(status.HTTP_409_CONFLICT, {"code": "in_use",
                            "message": f"{used} records use “{item['label']}”. Disable it instead: they keep it, and nobody can pick it again."})
    await col.delete_one({"_id": item["_id"]})
    await record(user, "masters.delete", target=f"{list_key}:{key}", detail=item["label"], request=request)


@admin_router.post("/{list_key}/reorder", status_code=status.HTTP_204_NO_CONTENT, summary="Set the order at one level")
async def admin_reorder(list_key: str, body: ReorderIn, request: Request, user: dict = Depends(get_current_user)):
    d = m.definition(list_key)
    await _need(user, d, "edit")
    col = get_database()[m.COLLECTION]
    have = {r["key"] async for r in col.find({"list": list_key, "parent_key": body.parent_key or None}, {"key": 1})}
    if set(body.keys) != have:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Send every key at this level, once.")
    for i, k in enumerate(body.keys):
        await col.update_one({"list": list_key, "key": k}, {"$set": {"order": i}})
    await record(user, "masters.reorder", target=list_key, request=request)
