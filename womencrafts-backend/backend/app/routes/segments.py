"""
Audience segments — saved groupings of the members directory.

A segment stores a RULE (`segment`, `role`, `status`, each optional) and every
number the screen shows is counted from `members` on the request. The seeded
rows used to carry `users: "3,245"` and `growth: "18.6%"` as typed strings,
which the screen rendered as though they were counts of anyone.

Writes are guarded by `users.<action>` and recorded in the audit log.
"""

import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.core import mongosafe
from app.core.audit import record
from app.core.deps import get_current_user
from app.core.permissions import require_permission
from app.core.serializers import aware, to_object_id
from app.db.mongodb import get_database
from app.models.member import MemberModel
from app.models.segment import SegmentModel
from app.schemas.segment import (
    SegmentCreate,
    SegmentGrowthResponse,
    SegmentListResponse,
    SegmentResponse,
    SegmentUpdate,
)

router = APIRouter(prefix="/segments", tags=["Users"])


def _segments():
    return get_database()[SegmentModel.collection_name]


def _exact(name: str) -> dict:
    """Whole-string, case-insensitive: 'artisans' and 'Artisans' are one segment."""
    return {"$regex": f"^{re.escape(name.strip())}$", "$options": "i"}


async def _member_facts() -> list[dict]:
    """The four fields a rule can look at, for every member, in one query."""
    projection = {"segment": 1, "role": 1, "status": 1, "created_at": 1}
    return [doc async for doc in get_database()[MemberModel.collection_name].find({}, projection)]


def _live(doc: dict, members: list[dict], now: datetime) -> dict:
    rule = SegmentModel.rule_for(doc)
    matched = [m for m in members if SegmentModel.matches(rule, m)]
    since_30 = now - timedelta(days=30)
    since_60 = now - timedelta(days=60)
    new_30 = prev_30 = 0
    for m in matched:
        when = aware(m.get("created_at"))
        if when is None:
            continue
        if when >= since_30:
            new_30 += 1
        elif when >= since_60:
            prev_30 += 1
    return {
        "member_count": len(matched),
        "active_count": sum(1 for m in matched if (m.get("status") or "") == "Active"),
        "new_30d": new_30,
        "prev_30d": prev_30,
        "members_total": len(members),
    }


async def _segment_or_404(segment_id: str) -> dict:
    doc = await _segments().find_one({"_id": to_object_id(segment_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Segment not found")
    return doc


@router.get("", response_model=SegmentListResponse, summary="List segments with live member counts",
    dependencies=[Depends(require_permission("users.view"))],
)
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

    members = await _member_facts()
    now = datetime.now(timezone.utc)
    docs = [doc async for doc in _segments().find(query).sort("_id", 1)]
    items = [SegmentModel.to_response(doc, _live(doc, members, now)) for doc in docs]

    # Members no active segment claims — the honest answer to "who is left out?"
    rules = [SegmentModel.rule_for(d) for d in docs if d.get("status", "Active") == "Active"]
    unsegmented = sum(1 for m in members if not any(SegmentModel.matches(r, m) for r in rules))
    return SegmentListResponse(
        items=items, total=len(items), members_total=len(members), unsegmented=unsegmented,
    )


@router.get("/growth", response_model=SegmentGrowthResponse,
    summary="Each segment's size at the end of each of the last N weeks",
    dependencies=[Depends(require_permission("users.view"))],
)
async def segment_growth(
    weeks: int = Query(8, ge=4, le=26),
    _: dict = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    this_monday = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    ends = [this_monday - timedelta(weeks=weeks - 1 - i) + timedelta(weeks=1) for i in range(weeks)]
    labels = [f"{(e - timedelta(weeks=1)).strftime('%b')} {(e - timedelta(weeks=1)).day}" for e in ends]

    members = await _member_facts()
    series = []
    async for doc in _segments().find({"status": "Active"}).sort("_id", 1):
        rule = SegmentModel.rule_for(doc)
        stamps = [
            aware(m.get("created_at"))
            for m in members
            if SegmentModel.matches(rule, m)
        ]
        stamps = [s for s in stamps if s is not None]
        series.append({
            "id": str(doc["_id"]),
            "name": doc.get("name", ""),
            "points": [sum(1 for s in stamps if s < end) for end in ends],
        })
    return SegmentGrowthResponse(labels=labels, series=series)


@router.post("", response_model=SegmentResponse, status_code=status.HTTP_201_CREATED,
    summary="Create a segment", dependencies=[Depends(require_permission("users.create"))],
)
async def create_segment(payload: SegmentCreate, request: Request, me: dict = Depends(get_current_user)):
    if await _segments().find_one({"name": _exact(payload.name)}):
        raise HTTPException(status.HTTP_409_CONFLICT, "A segment with this name already exists")
    doc = SegmentModel.create_document(
        name=payload.name, desc=payload.desc, status=payload.status, icon=payload.icon,
        rule=payload.rule.model_dump(exclude_none=True),
    )
    result = await _segments().insert_one(doc)
    doc["_id"] = result.inserted_id
    await record(
        me, "user.segment_create", target=str(doc["_id"]),
        detail=f"Created segment '{doc['name']}' matching {doc['rule'] or 'all members'}",
        request=request,
    )
    members = await _member_facts()
    return SegmentResponse(**SegmentModel.to_response(doc, _live(doc, members, datetime.now(timezone.utc))))


@router.get("/{segment_id}", response_model=SegmentResponse, summary="Get a segment",
    dependencies=[Depends(require_permission("users.view"))],
)
async def get_segment(segment_id: str, _: dict = Depends(get_current_user)):
    doc = await _segment_or_404(segment_id)
    members = await _member_facts()
    return SegmentResponse(**SegmentModel.to_response(doc, _live(doc, members, datetime.now(timezone.utc))))


@router.patch("/{segment_id}", response_model=SegmentResponse, summary="Update a segment",
    dependencies=[Depends(require_permission("users.edit"))],
)
async def update_segment(
    segment_id: str, payload: SegmentUpdate, request: Request, me: dict = Depends(get_current_user),
):
    oid = to_object_id(segment_id)
    updates = payload.model_dump(exclude_unset=True)
    if "rule" in updates:
        updates["rule"] = SegmentModel.clean_rule(payload.rule.model_dump(exclude_none=True) if payload.rule else {})
    if not updates:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nothing to change")
    if updates.get("name"):
        clash = await _segments().find_one({"name": _exact(updates["name"]), "_id": {"$ne": oid}})
        if clash:
            raise HTTPException(status.HTTP_409_CONFLICT, "Another segment already uses this name")
    updates["updated_at"] = datetime.now(timezone.utc)
    doc = await _segments().find_one_and_update({"_id": oid}, {"$set": updates}, return_document=True)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Segment not found")
    fields = ", ".join(k for k in updates if k != "updated_at")
    await record(
        me, "user.segment_update", target=str(oid),
        detail=f"Edited segment '{doc['name']}': {fields}", request=request,
    )
    members = await _member_facts()
    return SegmentResponse(**SegmentModel.to_response(doc, _live(doc, members, datetime.now(timezone.utc))))


@router.delete("/{segment_id}", summary="Delete a segment",
    dependencies=[Depends(require_permission("users.delete"))],
)
async def delete_segment(segment_id: str, request: Request, me: dict = Depends(get_current_user)):
    doc = await _segment_or_404(segment_id)
    await _segments().delete_one({"_id": doc["_id"]})
    await record(
        me, "user.segment_delete", target=str(doc["_id"]),
        detail=f"Deleted segment '{doc.get('name', '')}' (members untouched)", request=request,
    )
    return {"message": "Segment deleted"}
