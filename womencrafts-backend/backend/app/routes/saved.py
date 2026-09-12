"""
Her bookmarks, across everything.

Every bookmark button in the member app pointed nowhere until this existed.

The interesting part is the read. She has saved a job, two courses, a mela and a
scheme; the screen shows them in one list, newest first. The naive shape is a
lookup per row — five saves, five queries, and fifty saves is fifty. Instead the
rows are **grouped by kind and fetched one query per kind**, so the cost is the
number of *sorts of thing* she saves, not the number of things. That is at most
six, and in practice two or three, and they all go together.
"""

from __future__ import annotations

import asyncio
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.rbac import require_active_member
from app.db.mongodb import get_database
from app.models.community import PostModel
from app.models.growth import EventModel, MentorModel, OpportunityModel
from app.models.program import ProgramModel
from app.models.saved import SavedModel
from app.models.service import ServiceModel
from app.models.shop import ListingModel
from app.schemas.saved import SaveRequest, SavedResponse

router = APIRouter(prefix="/saved", tags=["Member"])

#: Which collection holds each kind of saveable thing. A kind with no entry here
#: is still saved and still listed — it simply shows as "no longer listed"
#: rather than crashing the screen, which is what a half-built module should do.
_COLLECTIONS: dict[str, str] = {
    SavedModel.KIND_JOB: OpportunityModel.collection_name,
    SavedModel.KIND_PROGRAM: ProgramModel.collection_name,
    SavedModel.KIND_SERVICE: ServiceModel.collection_name,
    SavedModel.KIND_MENTOR: MentorModel.collection_name,
    SavedModel.KIND_EVENT: EventModel.collection_name,
    SavedModel.KIND_LISTING: ListingModel.collection_name,
    SavedModel.KIND_POST: PostModel.collection_name,
    # No schemes collection yet. A kind with no entry here is still saved and
    # still listed — it shows as "no longer listed" rather than crashing the
    # screen, which is what a half-built module should do.
}


def _saved():
    return get_database()[SavedModel.collection_name]


@router.get("", response_model=list[SavedResponse], summary="Everything I saved")
async def list_saved(
    kind: Optional[str] = Query(None, description=" | ".join(SavedModel.KINDS)),
    me: dict = Depends(require_active_member),
):
    query: dict = {"user_id": str(me["_id"])}
    if kind:
        query["kind"] = kind
    rows = await _saved().find(query).sort("created_at", -1).to_list(300)
    if not rows:
        return []

    # Group first, then one query per kind — not one per row.
    by_kind: dict[str, list[ObjectId]] = {}
    for r in rows:
        collection = _COLLECTIONS.get(r.get("kind", ""))
        if not collection:
            continue
        try:
            by_kind.setdefault(collection, []).append(ObjectId(r["ref_id"]))
        except Exception:  # noqa: BLE001 - an unreadable id is a missing subject
            continue

    db = get_database()
    fetched = await asyncio.gather(*[
        db[collection].find({"_id": {"$in": ids}}).to_list(len(ids))
        for collection, ids in by_kind.items()
    ])
    subjects: dict[str, dict] = {}
    for docs in fetched:
        for d in docs:
            subjects[str(d["_id"])] = d

    return [SavedResponse(**SavedModel.to_response(r, subjects.get(r.get("ref_id", "")))) for r in rows]


@router.post("", response_model=SavedResponse, status_code=status.HTTP_201_CREATED, summary="Save it")
async def save(body: SaveRequest, me: dict = Depends(require_active_member)):
    if body.kind not in SavedModel.KINDS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That is not something you can save")

    uid = str(me["_id"])
    # Upsert, not insert. Pressing the bookmark twice — which a slow connection
    # makes likely — must leave one bookmark, not a duplicate row and a 409 she
    # cannot act on. The unique index makes this safe under a race.
    doc = await _saved().find_one_and_update(
        {"user_id": uid, "kind": body.kind, "ref_id": body.ref_id},
        {"$setOnInsert": SavedModel.create_document(
            user_id=uid, kind=body.kind, ref_id=body.ref_id,
        )},
        upsert=True,
        return_document=True,
    )
    collection = _COLLECTIONS.get(body.kind)
    subject = None
    if collection:
        try:
            subject = await get_database()[collection].find_one({"_id": ObjectId(body.ref_id)})
        except Exception:  # noqa: BLE001
            subject = None
    return SavedResponse(**SavedModel.to_response(doc, subject))


@router.delete("/{kind}/{ref_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Unsave it")
async def unsave(kind: str, ref_id: str, me: dict = Depends(require_active_member)):
    # No 404 on a bookmark that is already gone: she pressed unsave and it is
    # unsaved, which is the outcome she asked for.
    await _saved().delete_one({"user_id": str(me["_id"]), "kind": kind, "ref_id": ref_id})
    return None
