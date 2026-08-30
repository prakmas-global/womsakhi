from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core import mongosafe
from app.core.deps import get_current_user
from app.core.serializers import to_object_id
from app.db.mongodb import get_database
from app.models.segment import SegmentModel
from app.schemas.segment import (
    SegmentCreate,
    SegmentListResponse,
    SegmentResponse,
    SegmentUpdate,
)

router = APIRouter(prefix="/segments", tags=["Users"])


def _segments():
    return get_database()[SegmentModel.collection_name]


@router.get("", response_model=SegmentListResponse, summary="List segments")
async def list_segments(
    q: Optional[str] = Query(None, description="Search by segment name"),
    status: Optional[str] = Query(None, description="Filter by status"),
    _: dict = Depends(get_current_user),
):
    query: dict = {}
    if status and status not in ("all", "All"):
        query["status"] = status
    if q and q.strip():
        query["name"] = mongosafe.contains(q)

    items = [SegmentModel.to_response(doc) async for doc in _segments().find(query).sort("_id", 1)]
    return SegmentListResponse(items=items, total=len(items))


@router.post("", response_model=SegmentResponse, status_code=status.HTTP_201_CREATED, summary="Create a segment")
async def create_segment(payload: SegmentCreate, _: dict = Depends(get_current_user)):
    if await _segments().find_one({"name": payload.name.strip()}):
        raise HTTPException(status.HTTP_409_CONFLICT, "A segment with this name already exists")
    doc = SegmentModel.create_document(**payload.model_dump())
    result = await _segments().insert_one(doc)
    doc["_id"] = result.inserted_id
    return SegmentResponse(**SegmentModel.to_response(doc))


@router.get("/{segment_id}", response_model=SegmentResponse, summary="Get a segment")
async def get_segment(segment_id: str, _: dict = Depends(get_current_user)):
    doc = await _segments().find_one({"_id": to_object_id(segment_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Segment not found")
    return SegmentResponse(**SegmentModel.to_response(doc))


@router.patch("/{segment_id}", response_model=SegmentResponse, summary="Update a segment")
async def update_segment(segment_id: str, payload: SegmentUpdate, _: dict = Depends(get_current_user)):
    oid = to_object_id(segment_id)
    updates = payload.model_dump(exclude_unset=True)
    updates["updated_at"] = datetime.now(timezone.utc)
    doc = await _segments().find_one_and_update(
        {"_id": oid},
        {"$set": updates},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Segment not found")
    return SegmentResponse(**SegmentModel.to_response(doc))


@router.delete("/{segment_id}", summary="Delete a segment")
async def delete_segment(segment_id: str, _: dict = Depends(get_current_user)):
    result = await _segments().delete_one({"_id": to_object_id(segment_id)})
    if result.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Segment not found")
    return {"message": "Segment deleted"}
