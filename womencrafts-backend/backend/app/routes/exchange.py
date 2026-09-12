"""
Skill exchange — teach one, learn one.

No money moves here, which is the point: a woman who cannot pay for a class can
still pay in hours. What she can teach is worth exactly as much as what she
wants to learn, and the agreement records both sides so neither is left doing
more than she agreed to.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core import mongosafe
from app.core.rbac import require_active_member
from app.core.serializers import to_object_id
from app.core.media import media_url
from app.db.mongodb import get_database
from app.models.exchange import ExchangeModel, SwapModel
from app.schemas.exchange import (
    Agreement,
    ExchangeResponse,
    ThreadSummary,
    SendMessage,
    SwapCreate,
    SwapResponse,
)

router = APIRouter(prefix="/exchange", tags=["Member · Learn"])


def _swaps():
    return get_database()[SwapModel.collection_name]


def _threads():
    return get_database()[ExchangeModel.collection_name]


@router.get("/swaps", response_model=list[SwapResponse], summary="What others are offering")
async def list_swaps(
    q: str = Query("", max_length=60),
    tag: Optional[str] = Query(None),
    mine: bool = Query(False, description="Only what I have offered"),
    me: dict = Depends(require_active_member),
):
    uid = str(me["_id"])
    query: dict = {"status": {"$ne": SwapModel.STATUS_CLOSED}}
    if mine:
        query["user_id"] = uid
    else:
        # Her own offers are excluded from Browse: nobody swaps with herself,
        # and a list that includes them wastes the top of the screen.
        query["user_id"] = {"$ne": uid}
    if tag:
        query["tags"] = tag
    if q.strip():
        query.update(mongosafe.any_of(q, ["skill", "wants", "detail"]))

    docs, threads = await asyncio.gather(
        _swaps().find(query).sort("created_at", -1).to_list(200),
        _threads().find({"asker_id": uid}, {"swap_id": 1}).to_list(200),
    )
    asked = {t.get("swap_id") for t in threads}
    return [
        SwapResponse(**SwapModel.to_response(
            d, asked=str(d["_id"]) in asked, mine=d.get("user_id") == uid,
        ))
        for d in docs
    ]


@router.post(
    "/swaps",
    response_model=SwapResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Offer to teach something",
)
async def create_swap(body: SwapCreate, me: dict = Depends(require_active_member)):
    doc = SwapModel.create_document(
        user_id=str(me["_id"]), member_id=me.get("member_id", ""),
        who=me.get("full_name", ""), avatar=me.get("avatar", ""),
        **body.model_dump(),
    )
    result = await _swaps().insert_one(doc)
    doc["_id"] = result.inserted_id
    return SwapResponse(**SwapModel.to_response(doc, mine=True))


@router.post("/swaps/{swap_id}/ask", response_model=ExchangeResponse, summary="Ask about a swap")
async def ask(swap_id: str, body: SendMessage, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    swap = await _swaps().find_one({"_id": to_object_id(swap_id)})
    if not swap:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "She may have taken that offer down")
    if swap.get("user_id") == uid:
        raise HTTPException(status.HTTP_409_CONFLICT, "That is your own offer")

    # One thread per pair per swap. Asking twice continues the conversation
    # rather than starting a second one she would have to notice.
    existing = await _threads().find_one({"swap_id": swap_id, "asker_id": uid})
    if existing:
        fresh = await _threads().find_one_and_update(
            {"_id": existing["_id"]},
            {"$push": {"messages": {"from": uid, "text": body.text, "at": datetime.now(timezone.utc)}},
             "$set": {"updated_at": datetime.now(timezone.utc)}},
            return_document=True,
        )
        return ExchangeResponse(**ExchangeModel.to_response(fresh, me_id=uid))

    doc = ExchangeModel.create_document(
        swap_id=swap_id, asker_id=uid, owner_id=swap.get("user_id", ""), opening=body.text,
    )
    result = await _threads().insert_one(doc)
    doc["_id"] = result.inserted_id
    return ExchangeResponse(**ExchangeModel.to_response(doc, me_id=uid))


@router.get("/threads", response_model=list[ThreadSummary], summary="My live exchanges")
async def my_threads(me: dict = Depends(require_active_member)):
    """
    Every exchange she is in, from either side.

    Named from the OTHER woman's point of view — "you teach X, you learn Y" —
    because the same agreement reads backwards depending on who is looking at
    it, and a screen that shows her own side as the other woman's is a screen
    that gets somebody to turn up expecting to be taught.
    """
    uid = str(me["_id"])
    threads = await _threads().find(
        {"$or": [{"asker_id": uid}, {"owner_id": uid}]}
    ).sort("updated_at", -1).to_list(100)
    if not threads:
        return []

    # The swaps and the other women, in two queries rather than two per thread.
    swap_ids, other_ids = [], []
    for t in threads:
        try:
            swap_ids.append(to_object_id(t.get("swap_id", "")))
        except Exception:  # noqa: BLE001
            pass
        other = t["owner_id"] if t.get("asker_id") == uid else t.get("asker_id")
        if other:
            try:
                other_ids.append(to_object_id(other))
            except Exception:  # noqa: BLE001
                pass

    db = get_database()
    swaps, others = await asyncio.gather(
        _swaps().find({"_id": {"$in": swap_ids}}).to_list(len(swap_ids) or 1),
        db["users"].find({"_id": {"$in": other_ids}},
                         {"full_name": 1, "avatar": 1}).to_list(len(other_ids) or 1),
    )
    by_swap = {str(s["_id"]): s for s in swaps}
    by_user = {str(u["_id"]): u for u in others}

    out = []
    for t in threads:
        mine_is_asker = t.get("asker_id") == uid
        other_id = t["owner_id"] if mine_is_asker else t.get("asker_id", "")
        other = by_user.get(other_id, {})
        swap = by_swap.get(t.get("swap_id", ""), {})
        agreed = t.get("agreement") or {}
        messages = t.get("messages") or []
        last_was_hers = bool(messages) and messages[-1].get("from") != uid

        out.append(ThreadSummary(
            id=str(t["_id"]),
            swap_id=t.get("swap_id", ""),
            with_whom=other.get("full_name", "A member"),
            avatar=media_url(other.get("avatar", "")),
            # The asker learns what the owner offered, and teaches what the
            # owner wanted. Reversed for the owner.
            you_teach=(agreed.get("i_teach") if agreed else
                       (swap.get("wants") if mine_is_asker else swap.get("skill", ""))) or "",
            you_learn=(agreed.get("she_teaches") if agreed else
                       (swap.get("skill") if mine_is_asker else swap.get("wants", ""))) or "",
            state="Agreed" if agreed else ("She replied" if last_was_hers else "Waiting"),
            next_step=(
                f"{agreed.get('sessions_each', 0)} sessions each — agree a time between you"
                if agreed else
                "She has written back — read it" if last_was_hers
                else "Waiting for her to reply"
            ),
        ))
    return out


@router.get("/threads/{thread_id}", response_model=ExchangeResponse, summary="One exchange")
async def get_thread(thread_id: str, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    # Either side may read it; nobody else may. Scoped in the query rather than
    # checked after, so there is no window where the wrong document is loaded.
    doc = await _threads().find_one({
        "_id": to_object_id(thread_id),
        "$or": [{"asker_id": uid}, {"owner_id": uid}],
    })
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That exchange is not here")
    return ExchangeResponse(**ExchangeModel.to_response(doc, me_id=uid))


@router.post("/threads/{thread_id}/say", response_model=ExchangeResponse, summary="Send a message")
async def say(thread_id: str, body: SendMessage, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    updated = await _threads().find_one_and_update(
        {"_id": to_object_id(thread_id), "$or": [{"asker_id": uid}, {"owner_id": uid}]},
        {"$push": {"messages": {"from": uid, "text": body.text, "at": datetime.now(timezone.utc)}},
         "$set": {"updated_at": datetime.now(timezone.utc)}},
    )
    if not updated:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That exchange is not here")
    fresh = await _threads().find_one({"_id": to_object_id(thread_id)})
    return ExchangeResponse(**ExchangeModel.to_response(fresh, me_id=uid))


@router.post("/threads/{thread_id}/agree", response_model=ExchangeResponse, summary="Record what we agreed")
async def agree(thread_id: str, body: Agreement, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    updated = await _threads().find_one_and_update(
        {"_id": to_object_id(thread_id), "$or": [{"asker_id": uid}, {"owner_id": uid}]},
        {"$set": {"agreement": body.model_dump(), "updated_at": datetime.now(timezone.utc)}},
    )
    if not updated:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That exchange is not here")
    # Both offers come off Browse once they are matched.
    await _swaps().update_one(
        {"_id": to_object_id(updated.get("swap_id", "000000000000000000000000"))},
        {"$set": {"status": SwapModel.STATUS_MATCHED}},
    )
    fresh = await _threads().find_one({"_id": to_object_id(thread_id)})
    return ExchangeResponse(**ExchangeModel.to_response(fresh, me_id=uid))


async def seed() -> None:
    if await _swaps().count_documents({}) > 0:
        return
    users = get_database()["users"]
    others = await users.find({"role": {"$regex": "^member$", "$options": "i"}}).to_list(6)
    if not others:
        return

    rows = [
        ("Tailoring — blouse to measure", "Reading and writing English", "Patna",
         ["Tailoring", "English"]),
        ("Cooking for a tiffin service", "Using a smartphone", "Lucknow", ["Cooking", "Digital"]),
        ("Mehendi, bridal and simple", "Book-keeping", "Jaipur", ["Beauty", "Money"]),
        ("Spoken English, one hour a week", "Hand embroidery", "Jaipur", ["English", "Craft"]),
        ("Basic accounts for a small shop", "Tailoring", "Bagru", ["Money", "Tailoring"]),
    ]
    docs = []
    for i, (skill, wants, place, tags) in enumerate(rows):
        u = others[i % len(others)]
        docs.append(SwapModel.create_document(
            user_id=str(u["_id"]), member_id=u.get("member_id", ""),
            who=u.get("full_name", "A member"), avatar=u.get("avatar", ""),
            skill=skill, wants=wants, place=place, tags=tags,
            detail="Happy to meet at my place or yours, whichever is easier.",
        ))
    await _swaps().insert_many(docs)
