"""
Pass it on — things women near her are giving away or swapping.

── Community, not catalogue ────────────────────────────────────────────────
Every row here was posted by a real woman. The screen used to show five
invented ones — a school uniform from Kavita Rao 0.6km away, maternity kurtas
from Meera Joshi — so a woman could walk to meet somebody who did not exist.

── No prices, ever ─────────────────────────────────────────────────────────
`wants` is what she would like in return, in her own words: "Free", "Anything
for a 2-year-old", "Borrow and return after Diwali". There is no amount field
and there is not going to be one. The moment this has prices it is a
marketplace, it needs the payments licence the rest of the product is blocked
on, and the reason it works — that it is neighbours helping each other —
is gone.
"""

from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.rbac import require_active_member
from app.db.mongodb import get_database
from app.models.community import CircleMemberModel

router = APIRouter(prefix="/community/swap", tags=["Member · Community"])

COLLECTION = "swap_items"

CONDITIONS = ("as new", "good", "worn but fine")


class SwapIn(BaseModel):
    what: str = Field(min_length=1, max_length=120)
    size: str = Field(default="", max_length=40)
    condition: str = "good"
    #: What she would like in return, in her words. Never an amount.
    wants: str = Field(default="Free", max_length=120)
    icon: str = "Package"
    tint: str = "--ux-tint-blue"
    ink: str = "--ux-blue-ink"


def _col():
    return get_database()[COLLECTION]


def _oid(v: str) -> ObjectId:
    try:
        return ObjectId(v)
    except (InvalidId, TypeError):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such item")


def _row(doc: dict, uid: str) -> dict:
    return {
        "id": str(doc["_id"]),
        "what": doc.get("what", ""),
        "from": doc.get("from_name", ""),
        "size": doc.get("size", ""),
        "condition": doc.get("condition", "good"),
        "wants": doc.get("wants", "Free"),
        "icon": doc.get("icon", "Package"),
        "tint": doc.get("tint", "--ux-tint-blue"),
        "ink": doc.get("ink", "--ux-blue-ink"),
        "taken": bool(doc.get("taken", False)),
        # So the screen can offer "remove" on her own rows and nobody else's.
        "mine": doc.get("user_id") == uid,
    }


async def _circle_sisters(uid: str) -> list[str]:
    """
    Everyone who shares a circle with her, plus her.

    The board is scoped to this rather than open to the whole platform. The
    screen says these things are going spare *near her* and that she will
    collect them in person from *a woman she knows* — so it must not list a
    stranger three states away, and it must not become a way for anyone with
    an account to work out what she has and where to meet her.
    """
    db = get_database()
    mine = await db[CircleMemberModel.collection_name].distinct("circle_id", {"user_id": uid})
    if not mine:
        return [uid]
    sisters = await db[CircleMemberModel.collection_name].distinct(
        "user_id", {"circle_id": {"$in": mine}}
    )
    return list({*sisters, uid})


@router.get("", summary="What women in her circles are passing on")
async def list_swaps(
    mine: bool = Query(False, description="Only her own"),
    me: dict = Depends(require_active_member),
):
    uid = str(me["_id"])
    query: dict = {"user_id": uid} if mine else {"user_id": {"$in": await _circle_sisters(uid)}}
    docs = await _col().find(query).sort("created_at", -1).to_list(200)
    rows = [_row(d, uid) for d in docs]
    # Things still available first; taken ones stay visible so she can see the
    # board is alive rather than empty.
    rows.sort(key=lambda r: r["taken"])
    return {"items": rows, "available": sum(1 for r in rows if not r["taken"]), "count": len(rows)}


@router.post("", status_code=status.HTTP_201_CREATED, summary="Offer something")
async def add_swap(body: SwapIn, me: dict = Depends(require_active_member)):
    data = body.model_dump()
    if data["condition"] not in CONDITIONS:
        data["condition"] = "good"
    now = datetime.now(timezone.utc)
    await _col().insert_one({
        "user_id": str(me["_id"]),
        # Her name is taken from the session, never from the request.
        "from_name": me.get("full_name", ""),
        **data, "taken": False, "created_at": now, "updated_at": now,
    })
    return await list_swaps(False, me)


@router.post("/{item_id}/taken", summary="Mark it gone")
async def mark_taken(item_id: str, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    # Only the woman who offered it can close it. Anyone else marking a row
    # taken would let one person clear the whole board.
    res = await _col().update_one(
        {"_id": _oid(item_id), "user_id": uid},
        {"$set": {"taken": True, "updated_at": datetime.now(timezone.utc)}},
    )
    if not res.matched_count:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such item of yours")
    return await list_swaps(False, me)


@router.delete("/{item_id}", summary="Take it off the board")
async def remove_swap(item_id: str, me: dict = Depends(require_active_member)):
    res = await _col().delete_one({"_id": _oid(item_id), "user_id": str(me["_id"])})
    if not res.deleted_count:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such item of yours")
    return await list_swaps(False, me)
