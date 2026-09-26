"""Region catalogue with live member and administrator assignment counts."""

import asyncio
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.core.audit import record
from app.core.deps import get_current_user
from app.core.permissions import require_permission
from app.core.serializers import to_object_id
from app.db.mongodb import get_database

router = APIRouter(prefix="/regions", tags=["Users"])


class RegionIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str = Field(default="", max_length=500)
    status: str = Field(default="Active", pattern="^(Active|Inactive)$")


class RegionPatch(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    status: str | None = Field(default=None, pattern="^(Active|Inactive)$")


def _regions():
    return get_database()["regions"]


def _exact(value: str) -> dict:
    return {"$regex": f"^{re.escape(value.strip())}$", "$options": "i"}


async def _shape(doc: dict) -> dict:
    db = get_database()
    name = doc.get("name", "")
    return {
        "id": str(doc["_id"]),
        "name": name,
        "description": doc.get("description", ""),
        "status": doc.get("status", "Active"),
        "member_count": await db.members.count_documents({"location": name}),
        "admin_count": await db.users.count_documents({
            "role": {"$ne": "Member"}, "staff_scope.mode": "assigned",
            "staff_scope.regions": name,
        }),
        "created_at": doc.get("created_at").isoformat() if isinstance(doc.get("created_at"), datetime) else "",
    }


async def _one(region_id: str) -> dict:
    doc = await _regions().find_one({"_id": to_object_id(region_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Region not found")
    return doc


@router.get("", dependencies=[Depends(require_permission("users.view"))])
async def list_regions(_: dict = Depends(get_current_user)):
    db = get_database()
    # Existing member locations are promoted into the catalogue so an older
    # installation never starts with an empty Region screen.
    known = {d.get("name", "") async for d in _regions().find({}, {"name": 1})}
    now = datetime.now(timezone.utc)
    for name in await db.members.distinct("location"):
        name = str(name).strip()
        if name and name not in known:
            await _regions().insert_one({"name": name, "description": "", "status": "Active",
                                         "created_at": now, "updated_at": now})
    docs = await _regions().find({}).sort("name", 1).to_list(500)
    # Each card needs two independent counts. Awaiting them region by region
    # made network latency additive (about one second for the seeded list).
    # Motor can safely overlap these reads through the configured pool.
    return {"regions": await asyncio.gather(*(_shape(doc) for doc in docs))}


@router.post("", status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_permission("users.create"))])
async def create_region(body: RegionIn, request: Request, me: dict = Depends(get_current_user)):
    name = body.name.strip()
    if await _regions().find_one({"name": _exact(name)}):
        raise HTTPException(status.HTTP_409_CONFLICT, "A region with this name already exists")
    now = datetime.now(timezone.utc)
    doc = {"name": name, "description": body.description.strip(), "status": body.status,
           "created_at": now, "updated_at": now}
    doc["_id"] = (await _regions().insert_one(doc)).inserted_id
    await record(me, "region.create", target=str(doc["_id"]), detail=f"Created region '{name}'", request=request)
    return await _shape(doc)


@router.patch("/{region_id}", dependencies=[Depends(require_permission("users.edit"))])
async def update_region(region_id: str, body: RegionPatch, request: Request,
                        me: dict = Depends(get_current_user)):
    doc = await _one(region_id)
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nothing to change")
    old_name = doc.get("name", "")
    if changes.get("name"):
        changes["name"] = changes["name"].strip()
        clash = await _regions().find_one({"name": _exact(changes["name"]), "_id": {"$ne": doc["_id"]}})
        if clash:
            raise HTTPException(status.HTTP_409_CONFLICT, "Another region already uses this name")
    if "description" in changes:
        changes["description"] = (changes["description"] or "").strip()
    changes["updated_at"] = datetime.now(timezone.utc)
    updated = await _regions().find_one_and_update({"_id": doc["_id"]}, {"$set": changes}, return_document=True)
    if changes.get("name") and changes["name"] != old_name:
        db = get_database()
        await db.members.update_many({"location": old_name}, {"$set": {"location": changes["name"], "updated_at": changes["updated_at"]}})
        await db.users.update_many({"staff_scope.regions": old_name}, {"$set": {"staff_scope.regions.$": changes["name"]}, "$inc": {"token_version": 1}})
    await record(me, "region.update", target=region_id,
                 detail=f"Edited region '{old_name}': {', '.join(k for k in changes if k != 'updated_at')}", request=request)
    return await _shape(updated)


@router.delete("/{region_id}", dependencies=[Depends(require_permission("users.delete"))])
async def archive_region(region_id: str, request: Request, me: dict = Depends(get_current_user)):
    doc = await _one(region_id)
    if doc.get("status") == "Inactive":
        raise HTTPException(status.HTTP_409_CONFLICT, "This region is already archived")
    now = datetime.now(timezone.utc)
    await _regions().update_one({"_id": doc["_id"]}, {"$set": {
        "status": "Inactive", "archived_at": now, "updated_at": now,
    }})
    await record(me, "region.archive", target=region_id,
                 detail=f"Archived region '{doc.get('name', '')}' with relationships kept", request=request)
    return {"message": "Region archived"}
