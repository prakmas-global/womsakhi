"""
Services & Types — what the platform offers, and the categories it sits in.

── What changed and why ───────────────────────────────────────────────────
The screen used to show numbers nobody measured: every service carried a
seeded `bookings` (842, 721 …) and a `rating` ("4.9") that no appointment or
review ever produced, the five stat cards had growth deltas fixed in source
("12.5%"), and a type's "popularity" was a number an admin typed into a box.
Those are gone. Bookings are now the appointments that name the service,
counted live; a type's share is its slice of those bookings; nothing on the
screen claims a rating because nothing here rates a service.

The five types were also a `Literal` in the schema, so a Super Admin who
created a sixth type could never assign a service to it. A type is now any
name in `service_types`, checked on write.

── Access ─────────────────────────────────────────────────────────────────
Reads need `services.view`; each write names its own action and is recorded
through `app.core.audit`, so a deleted service can be traced to a person.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.core import mongosafe
from app.core.audit import record
from app.core.deps import get_current_user
from app.core.permissions import require_permission
from app.core.serializers import page_meta, to_object_id
from app.db.mongodb import get_database
from app.models.service import (
    assign_slots,
    ServiceModel,
    ServiceTypeModel,
    color_for_type,
    icon_for_service,
    tone_for_type,
)
from app.routes._paging import paged
from app.schemas.service import (
    ServiceCreate,
    ServiceListResponse,
    ServiceResponse,
    ServiceStatsResponse,
    ServiceStatusUpdate,
    ServiceTypeCreate,
    ServiceTypeListResponse,
    ServiceTypeResponse,
    ServiceTypeUpdate,
    ServiceUpdate,
)

# One parent router that carries both prefixes used by the Services screen:
#   /services       — the services table + stats + type helper
#   /service-types  — the categories (types) table
# main.py includes this single `router`; the sub-routers keep their own prefix.
router = APIRouter(tags=["Services"])
services_router = APIRouter(prefix="/services", tags=["Services"])
types_router = APIRouter(prefix="/service-types", tags=["Services"])

def _services():
    return get_database()[ServiceModel.collection_name]


def _service_types():
    return get_database()[ServiceTypeModel.collection_name]


def _appointments():
    return get_database()["appointments"]


# --- Live counts ---------------------------------------------------------------
async def _bookings_by_service() -> dict[str, int]:
    """
    Real bookings: every appointment, grouped by the service it names.

    This is the only source of a booking on the platform, so it is the only
    number the screen may call one. A service nobody has booked shows 0, which
    is the truth and not a bug.
    """
    out: dict[str, int] = {}
    async for row in _appointments().aggregate([{"$group": {"_id": "$service", "n": {"$sum": 1}}}]):
        if row["_id"]:
            out[row["_id"]] = row["n"]
    return out


async def _services_by_type() -> dict[str, int]:
    out: dict[str, int] = {}
    async for row in _services().aggregate([{"$group": {"_id": "$type", "n": {"$sum": 1}}}]):
        if row["_id"]:
            out[row["_id"]] = row["n"]
    return out


async def _slot_map() -> dict[str, int]:
    """Colour slots for every category, so a row's colour never depends on paging."""
    names = await _service_types().distinct("name")
    names += await _services().distinct("type")
    return assign_slots(names)


def _service_row(doc: dict, slots: dict[str, int], bookings: dict[str, int]) -> dict:
    row = ServiceModel.to_response(doc)
    row["slot"] = slots.get(doc.get("type", ""), row.get("slot", 1))
    row["bookings"] = bookings.get(doc.get("name", ""), 0)
    return row


async def _service_or_404(service_id: str) -> dict:
    doc = await _services().find_one({"_id": to_object_id(service_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Service not found")
    return doc


async def _type_must_exist(name: str) -> None:
    if not await _service_types().find_one({"name": name}):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"'{name}' is not a service type yet. Add it under Service Types first.",
        )


# --- Stats -----------------------------------------------------------------------
_CARD_META = [
    {"key": "total", "label": "Total Services", "icon": "Briefcase", "tone": "brand"},
    {"key": "active", "label": "Active Services", "icon": "LayoutGrid", "tone": "violet"},
    {"key": "inactive", "label": "Inactive Services", "icon": "Power", "tone": "amber"},
    {"key": "types", "label": "Service Types", "icon": "Leaf", "tone": "emerald"},
    {"key": "bookings", "label": "Total Bookings", "icon": "Clock", "tone": "sky"},
]


async def _build_service_stats() -> ServiceStatsResponse:
    """
    Stat cards, the overview donut and the popular list — every value computed
    from `services`, `service_types` and `appointments` as they are right now.

    No growth deltas: appointments carry no timestamp yet, so there is no
    "last month" to compare against. A card with no history shows no arrow
    rather than one somebody made up.
    """
    services, total_types, bookings = await asyncio.gather(
        _services().find({}).to_list(None),
        _service_types().count_documents({}),
        _bookings_by_service(),
    )
    total = len(services)
    active = sum(1 for s in services if s.get("status") == "Active")
    booked = {s.get("name", ""): bookings.get(s.get("name", ""), 0) for s in services}
    total_bookings = sum(booked.values())

    values = {
        "total": f"{total:,}",
        "active": f"{active:,}",
        "inactive": f"{total - active:,}",
        "types": f"{total_types:,}",
        "bookings": f"{total_bookings:,}",
    }
    stats = [{**meta, "value": values[meta["key"]]} for meta in _CARD_META]

    by_type: dict[str, int] = {}
    for s in services:
        by_type[s.get("type", "")] = by_type.get(s.get("type", ""), 0) + booked[s.get("name", "")]
    ordered = sorted(((n, b) for n, b in by_type.items() if n and b > 0), key=lambda kv: kv[1], reverse=True)
    overview = [
        {"name": n, "value": round(b / total_bookings * 100), "color": color_for_type(n)}
        for n, b in ordered
    ] if total_bookings else []

    top = sorted((s for s in services if booked[s.get("name", "")] > 0),
                 key=lambda s: booked[s.get("name", "")], reverse=True)[:5]
    popular = [
        {
            "icon": icon_for_service(s.get("name", ""), s.get("type", "")),
            "name": s.get("name", ""),
            "bookings": f"{booked[s.get('name', '')]:,} booking{'s' if booked[s.get('name', '')] != 1 else ''}",
            "tone": tone_for_type(s.get("type", "")),
        }
        for s in top
    ]

    return ServiceStatsResponse(
        stats=stats,
        overview=overview,
        overview_total=f"{total_bookings:,}",
        overview_label="Total Bookings",
        popular=popular,
    )


# =============================================================================
# Services
# =============================================================================
@services_router.get("", response_model=ServiceListResponse, summary="List services", dependencies=[Depends(require_permission("services.view"))])
async def list_services(
    q: Optional[str] = Query(None, description="Search by service name"),
    status: Optional[str] = Query(None, description="Filter by status: All Services|Active|Inactive"),
    type: Optional[str] = Query(None, description="Filter by type name"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
):
    query: dict = {}
    if status and status not in ("All Services", "All Status", "all"):
        query["status"] = status
    if type and type not in ("All Types", "all"):
        query["type"] = type
    if q and q.strip():
        query["name"] = mongosafe.contains(q)

    (total, docs), slots, bookings = await asyncio.gather(
        paged(_services(), query, sort="created_at", direction=-1, page=page, page_size=page_size),
        _slot_map(),
        _bookings_by_service(),
    )
    items = [_service_row(doc, slots, bookings) for doc in docs]
    return ServiceListResponse(items=items, **page_meta(total, page, page_size))


@services_router.get("/stats", response_model=ServiceStatsResponse, summary="Service stat cards, overview donut & popular list", dependencies=[Depends(require_permission("services.view"))])
async def service_stats():
    return await _build_service_stats()


@services_router.get("/types", response_model=list[str], summary="Type names in use (Filters dropdown)", dependencies=[Depends(require_permission("services.view"))])
async def available_types():
    seen: list[str] = []
    async for doc in _services().find({}, {"type": 1}).sort("created_at", -1):
        t = doc.get("type")
        if t and t not in seen:
            seen.append(t)
    return seen


@services_router.post("", response_model=ServiceResponse, status_code=status.HTTP_201_CREATED, summary="Add a new service", dependencies=[Depends(require_permission("services.create"))])
async def create_service(payload: ServiceCreate, request: Request, me: dict = Depends(get_current_user)):
    await _type_must_exist(payload.type)
    doc = ServiceModel.create_document(
        name=payload.name,
        type=payload.type,
        duration=payload.duration,
        price=payload.price.strip() or "₹0",
        status=payload.status,
        description=payload.description,
    )
    result = await _services().insert_one(doc)
    doc["_id"] = result.inserted_id
    await record(me, "service.create", target=str(doc["_id"]),
                 detail=f"Added service '{payload.name}' under {payload.type}", request=request)
    return ServiceResponse(**_service_row(doc, await _slot_map(), {}))


@services_router.get("/{service_id}", response_model=ServiceResponse, summary="Get a service", dependencies=[Depends(require_permission("services.view"))])
async def get_service(service_id: str):
    doc = await _service_or_404(service_id)
    slots, bookings = await asyncio.gather(_slot_map(), _bookings_by_service())
    return ServiceResponse(**_service_row(doc, slots, bookings))


@services_router.get("/{service_id}/bookings", summary="Recent appointments that booked this service", dependencies=[Depends(require_permission("services.view"))])
async def service_bookings(service_id: str, limit: int = Query(10, ge=1, le=50)):
    """
    The appointments behind the bookings number, newest first, so the count on
    the card is something an admin can open rather than take on trust.
    """
    doc = await _service_or_404(service_id)
    cursor = _appointments().find({"service": doc.get("name", "")}).sort("_id", -1).limit(limit)
    items = [
        {
            "id": str(a["_id"]),
            "name": a.get("name", ""),
            "date": a.get("date", ""),
            "time": a.get("time", ""),
            "status": a.get("status", ""),
        }
        async for a in cursor
    ]
    total = await _appointments().count_documents({"service": doc.get("name", "")})
    return {"items": items, "total": total}


@services_router.put("/{service_id}", response_model=ServiceResponse, summary="Edit a service", dependencies=[Depends(require_permission("services.edit"))])
async def update_service(service_id: str, payload: ServiceUpdate, request: Request, me: dict = Depends(get_current_user)):
    oid = to_object_id(service_id)
    before = await _service_or_404(service_id)
    updates = payload.model_dump(exclude_unset=True)

    # Blank price leaves the existing price untouched (matches the UI form).
    if "price" in updates:
        price = (updates["price"] or "").strip()
        if price:
            updates["price"] = price
        else:
            updates.pop("price")

    if updates.get("type"):
        await _type_must_exist(updates["type"])
        updates["tone"] = tone_for_type(updates["type"])

    updates["updated_at"] = datetime.now(timezone.utc)
    doc = await _services().find_one_and_update({"_id": oid}, {"$set": updates}, return_document=True)
    changed = sorted(k for k in updates if k not in ("updated_at", "tone") and before.get(k) != updates[k])
    await record(me, "service.edit", target=service_id,
                 detail=f"Edited '{doc.get('name', '')}': {', '.join(changed) or 'no field changed'}", request=request)
    slots, bookings = await asyncio.gather(_slot_map(), _bookings_by_service())
    return ServiceResponse(**_service_row(doc, slots, bookings))


@services_router.patch("/{service_id}/status", response_model=ServiceResponse, summary="Activate / deactivate a service", dependencies=[Depends(require_permission("services.edit"))])
async def set_service_status(service_id: str, payload: ServiceStatusUpdate, request: Request, me: dict = Depends(get_current_user)):
    oid = to_object_id(service_id)
    doc = await _service_or_404(service_id)
    # Explicit status wins; otherwise toggle Active <-> Inactive.
    new_status = payload.status or ("Inactive" if doc.get("status") == "Active" else "Active")
    doc = await _services().find_one_and_update(
        {"_id": oid},
        {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    await record(me, "service.status", target=service_id,
                 detail=f"{'Activated' if new_status == 'Active' else 'Deactivated'} '{doc.get('name', '')}'", request=request)
    slots, bookings = await asyncio.gather(_slot_map(), _bookings_by_service())
    return ServiceResponse(**_service_row(doc, slots, bookings))


@services_router.delete("/{service_id}", summary="Delete a service", dependencies=[Depends(require_permission("services.delete"))])
async def delete_service(service_id: str, request: Request, me: dict = Depends(get_current_user)):
    doc = await _service_or_404(service_id)
    await _services().delete_one({"_id": doc["_id"]})
    await record(me, "service.delete", target=service_id,
                 detail=f"Deleted service '{doc.get('name', '')}' ({doc.get('type', '')})", request=request)
    return {"message": "Service deleted"}


# =============================================================================
# Service types (categories)
# =============================================================================
def _type_row(doc: dict, slots: dict[str, int], per_type: dict[str, int],
              bookings_by_type: dict[str, int], total_bookings: int) -> dict:
    row = ServiceTypeModel.to_response(doc)
    name = doc.get("name", "")
    row["slot"] = slots.get(name, row.get("slot", 1))
    row["color"] = f"var(--cat-{row['slot']})"
    row["services"] = per_type.get(name, 0)
    row["pop"] = round(bookings_by_type.get(name, 0) / total_bookings * 100) if total_bookings else 0
    return row


async def _type_context():
    """Everything a type row needs that is counted rather than stored."""
    slots, per_type, bookings, services = await asyncio.gather(
        _slot_map(), _services_by_type(), _bookings_by_service(),
        _services().find({}, {"name": 1, "type": 1}).to_list(None),
    )
    by_type: dict[str, int] = {}
    for s in services:
        by_type[s.get("type", "")] = by_type.get(s.get("type", ""), 0) + bookings.get(s.get("name", ""), 0)
    return slots, per_type, by_type, sum(by_type.values())


@types_router.get("", response_model=ServiceTypeListResponse, summary="List service types", dependencies=[Depends(require_permission("services.view"))])
async def list_service_types(
    q: Optional[str] = Query(None, description="Search by type name"),
    status: Optional[str] = Query(None, description="Filter by status: Active|Inactive"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
):
    query: dict = {}
    if status and status not in ("All Status", "all"):
        query["status"] = status
    if q and q.strip():
        query["name"] = mongosafe.contains(q)

    (total, docs), ctx = await asyncio.gather(
        paged(_service_types(), query, sort="created_at", direction=-1, page=page, page_size=page_size),
        _type_context(),
    )
    items = [_type_row(doc, *ctx) for doc in docs]
    return ServiceTypeListResponse(items=items, **page_meta(total, page, page_size))


@types_router.post("", response_model=ServiceTypeResponse, status_code=status.HTTP_201_CREATED, summary="Add a new type", dependencies=[Depends(require_permission("services.create"))])
async def create_service_type(payload: ServiceTypeCreate, request: Request, me: dict = Depends(get_current_user)):
    if await _service_types().find_one({"name": payload.name.strip()}):
        raise HTTPException(status.HTTP_409_CONFLICT, "A service type with this name already exists")
    doc = ServiceTypeModel.create_document(name=payload.name, desc=payload.desc, status=payload.status)
    result = await _service_types().insert_one(doc)
    doc["_id"] = result.inserted_id
    await record(me, "service.type.create", target=str(doc["_id"]),
                 detail=f"Added service type '{payload.name}'", request=request)
    return ServiceTypeResponse(**_type_row(doc, *await _type_context()))


@types_router.put("/{type_id}", response_model=ServiceTypeResponse, summary="Edit a type", dependencies=[Depends(require_permission("services.edit"))])
async def update_service_type(type_id: str, payload: ServiceTypeUpdate, request: Request, me: dict = Depends(get_current_user)):
    oid = to_object_id(type_id)
    before = await _service_types().find_one({"_id": oid})
    if not before:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Service type not found")
    updates = payload.model_dump(exclude_unset=True)
    new_name = (updates.get("name") or "").strip()
    if new_name and new_name != before.get("name"):
        if await _service_types().find_one({"name": new_name, "_id": {"$ne": oid}}):
            raise HTTPException(status.HTTP_409_CONFLICT, "A service type with this name already exists")
        updates["name"] = new_name
    elif "name" in updates:
        updates.pop("name")

    updates["updated_at"] = datetime.now(timezone.utc)
    doc = await _service_types().find_one_and_update({"_id": oid}, {"$set": updates}, return_document=True)

    # Renaming a category must carry its services with it, or they would keep
    # a type name that no longer exists and vanish from every filter.
    moved = 0
    if "name" in updates:
        res = await _services().update_many(
            {"type": before.get("name")},
            {"$set": {"type": updates["name"], "tone": tone_for_type(updates["name"]),
                      "updated_at": updates["updated_at"]}},
        )
        moved = res.modified_count
    detail = f"Edited service type '{before.get('name', '')}'"
    if moved:
        detail += f" → '{updates['name']}' ({moved} service{'s' if moved != 1 else ''} moved)"
    await record(me, "service.type.edit", target=type_id, detail=detail, request=request)
    return ServiceTypeResponse(**_type_row(doc, *await _type_context()))


@types_router.delete("/{type_id}", summary="Delete a type", dependencies=[Depends(require_permission("services.delete"))])
async def delete_service_type(type_id: str, request: Request, me: dict = Depends(get_current_user)):
    doc = await _service_types().find_one({"_id": to_object_id(type_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Service type not found")
    # A type that services still sit under cannot go: deleting it would leave
    # them under a name that no longer exists, invisible to every filter.
    in_use = await _services().count_documents({"type": doc.get("name", "")})
    if in_use:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{in_use} service{'s' if in_use != 1 else ''} still use{'' if in_use != 1 else 's'} "
            f"'{doc.get('name', '')}'. Move or delete them first.",
        )
    await _service_types().delete_one({"_id": doc["_id"]})
    await record(me, "service.type.delete", target=type_id,
                 detail=f"Deleted service type '{doc.get('name', '')}'", request=request)
    return {"message": "Service type deleted"}


# Attach both prefixed sub-routers to the single router main.py includes.
router.include_router(services_router)
router.include_router(types_router)


# =============================================================================
# Seed — starter catalogue for an empty database. Names only: bookings are
# counted from appointments, never written here.
# =============================================================================
_SERVICES = [
    dict(name="Tailoring & Stitching", type="Fashion", duration="60 min", price="₹499", status="Active"),
    dict(name="Beauty & Makeup", type="Beauty", duration="90 min", price="₹899", status="Active"),
    dict(name="Mehndi Design", type="Beauty", duration="45 min", price="₹299", status="Active"),
    dict(name="Photography", type="Photography", duration="120 min", price="₹1,499", status="Active"),
    dict(name="Digital Marketing", type="Digital", duration="60 min", price="₹999", status="Inactive"),
]

_TYPES = [
    dict(name="Fashion", desc="Clothing, tailoring, and fashion related services", status="Active", color="#e6117e"),
    dict(name="Beauty", desc="Makeup, skincare, hair and beauty services", status="Active", color="#8b5cf6"),
    dict(name="Photography", desc="Photography and videography services", status="Active", color="#f59e0b"),
    dict(name="Digital", desc="Digital marketing and online services", status="Active", color="#3b82f6"),
    dict(name="Wellness", desc="Health, fitness and wellness services", status="Inactive", color="#22c55e"),
]


async def seed() -> None:
    """Seed the services & service_types collections with a starter catalogue, only if empty."""
    db = get_database()

    if await db[ServiceModel.collection_name].count_documents({}) == 0:
        base = datetime.now(timezone.utc)
        docs = [
            ServiceModel.create_document(
                name=s["name"], type=s["type"], duration=s["duration"],
                price=s["price"], status=s["status"],
                # Descending created_at keeps the on-screen order (newest first).
                created_at=base - timedelta(seconds=i),
            )
            for i, s in enumerate(_SERVICES)
        ]
        await db[ServiceModel.collection_name].insert_many(docs)
        print(f"🌱 Seeded {len(docs)} services")

    if await db[ServiceTypeModel.collection_name].count_documents({}) == 0:
        base = datetime.now(timezone.utc)
        docs = [
            ServiceTypeModel.create_document(
                name=t["name"], desc=t["desc"], status=t["status"], color=t["color"],
                created_at=base - timedelta(seconds=i),
            )
            for i, t in enumerate(_TYPES)
        ]
        await db[ServiceTypeModel.collection_name].insert_many(docs)
        print(f"🌱 Seeded {len(docs)} service types")
