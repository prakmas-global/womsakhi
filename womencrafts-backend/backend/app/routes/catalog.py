"""
The member-facing catalogue: services she can book, programs she can join.

The admin has richer endpoints for the same collections, but those are guarded
by admin modules a member will never hold. This router exposes the same data
READ-ONLY, filtered to what is actually open to her (nothing draft, archived or
inactive ever appears), and shaped for the member app.
"""

import asyncio
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core import mongosafe
from app.core import cache
from app.core.serializers import to_object_id
from app.db.mongodb import get_database
from app.models.enrollment import EnrollmentModel
from app.models.program import ProgramModel
from app.models.service import ServiceModel
from app.routes.me import require_active_member
from app.schemas.catalog import CatalogProgram, CatalogService

router = APIRouter(prefix="/catalog", tags=["Member"])

# The catalogue is the same for every member and changes when staff edit it —
# weekly at most. Caching it turns a 50ms round trip into a dictionary lookup
# for everyone after the first, which on a screen that opens the moment she
# lands is the difference between waiting and not.
#
# Only the unfiltered list is cached. A search or a category filter is a
# different question each time, and a cache keyed on free text is a memory leak
# with extra steps.
CATALOG_PREFIX = "catalog:"

# Only these ever reach a member. Anything else is staff work-in-progress.
OPEN_SERVICE_STATUSES = ["Active"]
OPEN_PROGRAM_STATUSES = ["Ongoing", "Upcoming", "Active", "Published"]


@router.get("/services", response_model=list[CatalogService], summary="Services I can book")
async def list_services(
    q: Optional[str] = Query(None, description="Search name or description"),
    type: Optional[str] = Query(None, description="Filter by service type"),
    me: dict = Depends(require_active_member),
):
    query: dict = {"status": {"$in": OPEN_SERVICE_STATUSES}}
    filtered = False
    if type and type.lower() not in ("all", "all types"):
        query["type"] = type
        filtered = True
    if q and q.strip():
        query.update(mongosafe.any_of(q, ["name", "description"]))
        filtered = True

    async def _load() -> list[CatalogService]:
        docs = await (
            get_database()[ServiceModel.collection_name]
            .find(query).sort("bookings", -1).to_list(500)
        )
        return [CatalogService(**ServiceModel.to_response(d)) for d in docs]

    if filtered:
        return await _load()
    return await cache.cached(f"{CATALOG_PREFIX}services", cache.SHARED_TTL, _load)


@router.get("/services/{service_id}", response_model=CatalogService, summary="One service")
async def get_service(service_id: str, me: dict = Depends(require_active_member)):
    doc = await get_database()[ServiceModel.collection_name].find_one(
        {"_id": to_object_id(service_id), "status": {"$in": OPEN_SERVICE_STATUSES}}
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Service not found")
    return CatalogService(**ServiceModel.to_response(doc))


@router.get("/programs", response_model=list[CatalogProgram], summary="Programs I can join")
async def list_programs(
    q: Optional[str] = Query(None, description="Search name or description"),
    category: Optional[str] = Query(None, description="Filter by category"),
    me: dict = Depends(require_active_member),
):
    query: dict = {"status": {"$in": OPEN_PROGRAM_STATUSES}}
    filtered = False
    if category and category.lower() not in ("all", "all categories"):
        query["category"] = category
        filtered = True
    if q and q.strip():
        query.update(mongosafe.any_of(q, ["name", "desc"]))
        filtered = True

    async def _load() -> list[dict]:
        return await (
            get_database()[ProgramModel.collection_name]
            .find(query).sort("created_at", -1).to_list(500)
        )

    # The programme list is the same for everybody; which ones she has joined is
    # not. So the shared half is cached and the personal half is fetched every
    # time, and they are merged here. Caching the merged answer would hand one
    # woman's enrolments to the next woman who asked — which is the reason
    # `core/cache.py` refuses to cache anything per-person.
    docs, joined_rows = await asyncio.gather(
        _load() if filtered else cache.cached(f"{CATALOG_PREFIX}programs", cache.SHARED_TTL, _load),
        get_database()[EnrollmentModel.collection_name]
        .find(
            {"user_id": str(me["_id"]), "status": EnrollmentModel.STATUS_ACTIVE},
            {"program_id": 1},
        )
        .to_list(500),
    )
    joined = {r.get("program_id") for r in joined_rows}

    out = []
    for doc in docs:
        payload = ProgramModel.to_response(doc)
        cap = int(payload.get("cap") or 0)
        enrolled = int(payload.get("enrolled") or 0)
        out.append(
            CatalogProgram(
                **payload,
                joined=payload["id"] in joined,
                seats_left=max(0, cap - enrolled) if cap else None,
                is_full=bool(cap and enrolled >= cap),
            )
        )
    return out


@router.get("/programs/{program_id}", response_model=CatalogProgram, summary="One program")
async def get_program(program_id: str, me: dict = Depends(require_active_member)):
    doc = await get_database()[ProgramModel.collection_name].find_one(
        {"_id": to_object_id(program_id), "status": {"$in": OPEN_PROGRAM_STATUSES}}
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Program not found")

    payload = ProgramModel.to_response(doc)
    joined = await get_database()[EnrollmentModel.collection_name].find_one({
        "user_id": str(me["_id"]),
        "program_id": program_id,
        "status": EnrollmentModel.STATUS_ACTIVE,
    })
    cap = int(payload.get("cap") or 0)
    enrolled = int(payload.get("enrolled") or 0)
    return CatalogProgram(
        **payload,
        joined=bool(joined),
        seats_left=max(0, cap - enrolled) if cap else None,
        is_full=bool(cap and enrolled >= cap),
    )
