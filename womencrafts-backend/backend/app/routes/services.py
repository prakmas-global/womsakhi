import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core import mongosafe
from app.core.deps import get_current_user
from app.core.serializers import page_meta, to_object_id
from app.db.mongodb import get_database
from app.models.service import (
    assign_slots,
    ServiceModel,
    ServiceTypeModel,
    color_for_type,
    icon_for_service,
    icon_for_type,
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


# --- Stats rail / header presentation metadata --------------------------------
# The 5 KPI stat cards. Only the presentation (label/icon/tone and the fixed
# growth delta) is fixed here; every `value` is computed live from the real
# services/service_types collections by _build_service_stats() below.
_STAT_CARD_META = [
    {"key": "total", "label": "Total Services", "icon": "Briefcase", "tone": "brand", "delta": "12.5%"},
    {"key": "active", "label": "Active Services", "icon": "LayoutGrid", "tone": "violet", "delta": "9.8%"},
    {"key": "types", "label": "Service Types", "icon": "Leaf", "tone": "emerald", "delta": "8.3%"},
    {"key": "bookings", "label": "Total Bookings", "icon": "Clock", "tone": "amber", "delta": "14.6%"},
    {"key": "rating", "label": "Avg. Rating", "icon": "Star", "tone": "brand", "delta": "0.3"},
]


def _to_int(value) -> int:
    """Coerce a stored bookings value to int, tolerating None/strings."""
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _rating_to_float(value) -> float:
    """Parse a rating label like '4.9' to a float; non-numeric -> 0.0."""
    try:
        return float(str(value))
    except (TypeError, ValueError):
        return 0.0


async def _build_service_stats() -> ServiceStatsResponse:
    """Stat cards, the overview donut and the popular list — all computed live
    from the real `services` / `service_types` collections.

    - stat cards: total services, active count, service-type count, summed
      bookings and the average rating.
    - overview donut: booking share (%) per category, biggest slice first, with
      the total bookings as its centre value.
    - popular: the real services ranked by their `bookings` field (top 5).
    """
    services = [s async for s in _services().find({})]
    total_services = len(services)
    active = sum(1 for s in services if s.get("status") == "Active")
    total_types = await _service_types().count_documents({})
    total_bookings = sum(_to_int(s.get("bookings")) for s in services)
    ratings = [r for r in (_rating_to_float(s.get("rating")) for s in services) if r > 0]
    avg_rating = sum(ratings) / len(ratings) if ratings else 0.0

    card_values = {
        "total": f"{total_services:,}",
        "active": f"{active:,}",
        "types": f"{total_types:,}",
        "bookings": f"{total_bookings:,}",
        "rating": f"{avg_rating:.1f} / 5",
    }
    stats = [{**meta, "value": card_values[meta["key"]]} for meta in _STAT_CARD_META]

    # Overview donut — booking share (%) by category, largest first.
    bookings_by_type: dict[str, int] = {}
    for s in services:
        bookings_by_type[s.get("type", "")] = (
            bookings_by_type.get(s.get("type", ""), 0) + _to_int(s.get("bookings"))
        )
    ordered = sorted(
        ((name, bk) for name, bk in bookings_by_type.items() if bk > 0),
        key=lambda kv: kv[1],
        reverse=True,
    )
    overview = (
        [
            {"name": name, "value": round(bk / total_bookings * 100), "color": color_for_type(name)}
            for name, bk in ordered
        ]
        if total_bookings
        else []
    )

    # Popular services — real services ranked by their bookings field (top 5).
    top = sorted(services, key=lambda s: _to_int(s.get("bookings")), reverse=True)[:5]
    popular = [
        {
            "icon": icon_for_service(s.get("name", ""), s.get("type", "")),
            "name": s.get("name", ""),
            "bookings": f"{_to_int(s.get('bookings')):,} bookings",
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
async def _slot_map() -> dict[str, int]:
    """Colour slots for every category, so a row's colour never depends on paging."""
    names = await _service_types().distinct("name")
    names += await _services().distinct("type")
    return assign_slots(names)


@services_router.get("", response_model=ServiceListResponse, summary="List services")
async def list_services(
    q: Optional[str] = Query(None, description="Search by service name"),
    status: Optional[str] = Query(None, description="Filter by status: All Services|Active|Inactive"),
    type: Optional[str] = Query(None, description="Filter by type: Fashion|Beauty|Photography|Digital|Wellness"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    _: dict = Depends(get_current_user),
):
    query: dict = {}
    if status and status not in ("All Services", "All Status", "all"):
        query["status"] = status
    if type and type not in ("All Types", "all"):
        query["type"] = type
    if q and q.strip():
        query["name"] = mongosafe.contains(q)

    # Three round trips became one. The count and the page are the same filter
    # asked twice (see `_paging`), and the colour slots are a different question
    # entirely — nothing in the page depends on them, so waiting for the rows
    # before asking for the palette was a trip to Atlas spent on ordering that
    # did not matter.
    (total, docs), slots = await asyncio.gather(
        paged(_services(), query, sort="created_at", direction=-1,
              page=page, page_size=page_size),
        _slot_map(),
    )
    items = []
    for doc in docs:
        row = ServiceModel.to_response(doc)
        row["slot"] = slots.get(doc.get("type", ""), row.get("slot", 1))
        items.append(row)
    return ServiceListResponse(items=items, **page_meta(total, page, page_size))


@services_router.get("/stats", response_model=ServiceStatsResponse, summary="Service stat cards, overview donut & popular list")
async def service_stats(
    range: str = Query("This Month", description="Today | This Week | This Month | This Year"),
    _: dict = Depends(get_current_user),
):
    return await _build_service_stats()


@services_router.get("/types", response_model=list[str], summary="Distinct service types (Filters dropdown)")
async def available_types(_: dict = Depends(get_current_user)):
    # Distinct types present in the services table, kept in on-screen order.
    seen: list[str] = []
    async for doc in _services().find({}, {"type": 1}).sort("created_at", -1):
        t = doc.get("type")
        if t and t not in seen:
            seen.append(t)
    return seen


@services_router.post("", response_model=ServiceResponse, status_code=status.HTTP_201_CREATED, summary="Add a new service")
async def create_service(payload: ServiceCreate, _: dict = Depends(get_current_user)):
    doc = ServiceModel.create_document(
        name=payload.name,
        type=payload.type,
        duration=payload.duration,
        price=payload.price.strip() or "₹0",
        status=payload.status,
        description=payload.description,
        bookings=0,
        rating="0.0",
    )
    result = await _services().insert_one(doc)
    doc["_id"] = result.inserted_id
    return ServiceResponse(**ServiceModel.to_response(doc))


@services_router.get("/{service_id}", response_model=ServiceResponse, summary="Get a service")
async def get_service(service_id: str, _: dict = Depends(get_current_user)):
    doc = await _services().find_one({"_id": to_object_id(service_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Service not found")
    return ServiceResponse(**ServiceModel.to_response(doc))


@services_router.put("/{service_id}", response_model=ServiceResponse, summary="Edit a service")
async def update_service(service_id: str, payload: ServiceUpdate, _: dict = Depends(get_current_user)):
    oid = to_object_id(service_id)
    updates = payload.model_dump(exclude_unset=True)

    # Blank price leaves the existing price untouched (matches the UI form).
    if "price" in updates:
        price = (updates["price"] or "").strip()
        if price:
            updates["price"] = price
        else:
            updates.pop("price")

    # Changing the type re-derives its accent tone (icon is derived on read).
    if updates.get("type"):
        updates["tone"] = tone_for_type(updates["type"])

    updates["updated_at"] = datetime.now(timezone.utc)
    doc = await _services().find_one_and_update(
        {"_id": oid},
        {"$set": updates},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Service not found")
    return ServiceResponse(**ServiceModel.to_response(doc))


@services_router.patch("/{service_id}/status", response_model=ServiceResponse, summary="Activate / deactivate a service")
async def set_service_status(service_id: str, payload: ServiceStatusUpdate, _: dict = Depends(get_current_user)):
    oid = to_object_id(service_id)
    doc = await _services().find_one({"_id": oid})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Service not found")

    # Explicit status wins; otherwise toggle Active <-> Inactive.
    new_status = payload.status or ("Inactive" if doc.get("status") == "Active" else "Active")
    doc = await _services().find_one_and_update(
        {"_id": oid},
        {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    return ServiceResponse(**ServiceModel.to_response(doc))


@services_router.delete("/{service_id}", summary="Delete a service")
async def delete_service(service_id: str, _: dict = Depends(get_current_user)):
    result = await _services().delete_one({"_id": to_object_id(service_id)})
    if result.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Service not found")
    return {"message": "Service deleted"}


# =============================================================================
# Service types (categories)
# =============================================================================
@types_router.get("", response_model=ServiceTypeListResponse, summary="List service types")
async def list_service_types(
    q: Optional[str] = Query(None, description="Search by type name"),
    status: Optional[str] = Query(None, description="Filter by status: Active|Inactive"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    _: dict = Depends(get_current_user),
):
    query: dict = {}
    if status and status not in ("All Status", "all"):
        query["status"] = status
    if q and q.strip():
        query["name"] = mongosafe.contains(q)

    (total, docs), slots = await asyncio.gather(
        paged(_service_types(), query, sort="created_at", direction=-1,
              page=page, page_size=page_size),
        _slot_map(),
    )
    items = []
    for doc in docs:
        row = ServiceTypeModel.to_response(doc)
        row["slot"] = slots.get(doc.get("name", ""), row.get("slot", 1))
        row["color"] = f"var(--cat-{row['slot']})"
        items.append(row)
    return ServiceTypeListResponse(items=items, **page_meta(total, page, page_size))


@types_router.post("", response_model=ServiceTypeResponse, status_code=status.HTTP_201_CREATED, summary="Add a new type")
async def create_service_type(payload: ServiceTypeCreate, _: dict = Depends(get_current_user)):
    if await _service_types().find_one({"name": payload.name.strip()}):
        raise HTTPException(status.HTTP_409_CONFLICT, "A service type with this name already exists")
    # color/icon are derived from the name inside the model; services starts at 0.
    doc = ServiceTypeModel.create_document(
        name=payload.name,
        desc=payload.desc,
        status=payload.status,
        pop=payload.pop,
        services=0,
    )
    result = await _service_types().insert_one(doc)
    doc["_id"] = result.inserted_id
    return ServiceTypeResponse(**ServiceTypeModel.to_response(doc))


@types_router.put("/{type_id}", response_model=ServiceTypeResponse, summary="Edit a type")
async def update_service_type(type_id: str, payload: ServiceTypeUpdate, _: dict = Depends(get_current_user)):
    oid = to_object_id(type_id)
    updates = payload.model_dump(exclude_unset=True)
    updates["updated_at"] = datetime.now(timezone.utc)
    doc = await _service_types().find_one_and_update(
        {"_id": oid},
        {"$set": updates},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Service type not found")
    return ServiceTypeResponse(**ServiceTypeModel.to_response(doc))


@types_router.delete("/{type_id}", summary="Delete a type")
async def delete_service_type(type_id: str, _: dict = Depends(get_current_user)):
    result = await _service_types().delete_one({"_id": to_object_id(type_id)})
    if result.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Service type not found")
    return {"message": "Service type deleted"}


# Attach both prefixed sub-routers to the single router main.py includes.
router.include_router(services_router)
router.include_router(types_router)


# =============================================================================
# Seed — the exact mock data the Services screen renders today
# =============================================================================
# 5 services (the SERVICES array on the screen).
_SERVICES = [
    dict(name="Tailoring & Stitching", type="Fashion", duration="60 min", price="₹499", status="Active", bookings=842, rating="4.9"),
    dict(name="Beauty & Makeup", type="Beauty", duration="90 min", price="₹899", status="Active", bookings=721, rating="4.8"),
    dict(name="Mehndi Design", type="Beauty", duration="45 min", price="₹299", status="Active", bookings=612, rating="4.7"),
    dict(name="Photography", type="Photography", duration="120 min", price="₹1,499", status="Active", bookings=487, rating="4.9"),
    dict(name="Digital Marketing", type="Digital", duration="60 min", price="₹999", status="Inactive", bookings=156, rating="4.6"),
]

# 5 service types (the TYPES array on the screen).
_TYPES = [
    dict(name="Fashion", desc="Clothing, tailoring, and fashion related services", services=28, status="Active", pop=85, color="#e6117e"),
    dict(name="Beauty", desc="Makeup, skincare, hair and beauty services", services=34, status="Active", pop=90, color="#8b5cf6"),
    dict(name="Photography", desc="Photography and videography services", services=18, status="Active", pop=70, color="#f59e0b"),
    dict(name="Digital", desc="Digital marketing and online services", services=22, status="Active", pop=65, color="#3b82f6"),
    dict(name="Wellness", desc="Health, fitness and wellness services", services=14, status="Inactive", pop=40, color="#22c55e"),
]


async def seed() -> None:
    """Seed the services & service_types collections with the exact UI mock data, only if empty."""
    db = get_database()

    if await db[ServiceModel.collection_name].count_documents({}) == 0:
        base = datetime.now(timezone.utc)
        docs = [
            ServiceModel.create_document(
                name=s["name"], type=s["type"], duration=s["duration"],
                price=s["price"], status=s["status"], bookings=s["bookings"],
                rating=s["rating"],
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
                name=t["name"], desc=t["desc"], services=t["services"],
                status=t["status"], pop=t["pop"], color=t["color"],
                created_at=base - timedelta(seconds=i),
            )
            for i, t in enumerate(_TYPES)
        ]
        await db[ServiceTypeModel.collection_name].insert_many(docs)
        print(f"🌱 Seeded {len(docs)} service types")
