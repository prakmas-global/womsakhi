"""
A member's conversations — buyers, mentors, circles and the team.

Every query is scoped by `member_id`. There is no endpoint here that takes an
owner: the owner is whoever the session says it is, and a guessed conversation
id cannot even confirm that someone else's thread exists.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status

from app.core.rbac import require_active_member
from app.db.mongodb import get_database
from app.models.member_conversation import MemberConversationModel as Conv
from app.schemas.me_messages import (
    ConversationDetail,
    ConversationRow,
    InboxSummary,
    MessageResponse,
    SendMessage,
    StarRequest,
)

router = APIRouter(prefix="/me", tags=["Member"])


def _col():
    return get_database()[Conv.collection_name]


async def _mine(conversation_id: str, member_id: str) -> dict:
    try:
        oid = ObjectId(conversation_id)
    except Exception:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    doc = await _col().find_one({"_id": oid, "member_id": member_id})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    return doc


@router.get("/conversations", response_model=list[ConversationRow], summary="My conversations")
async def my_conversations(
    kind: Optional[str] = Query(None, description="buyer | mentor | circle | team"),
    q: Optional[str] = Query(None, description="Search a name or the last message"),
    me: dict = Depends(require_active_member),
):
    """Ordered by who has waited longest, then by recency.

    Not purely by recency, which is what every chat app does and what is wrong
    here: a member is running a shop, and a buyer who asked a question two days
    ago matters more than a circle that chatted a minute ago. The sort is done
    in Python because "how long has she waited" is derived from the thread, not
    a stored field — see `MemberConversationModel`.
    """
    query: dict = {"member_id": str(me["_id"])}
    if kind in Conv.KINDS:
        query["kind"] = kind

    rows = [Conv.to_response(d) async for d in _col().find(query)]

    if q and q.strip():
        needle = q.strip().lower()
        rows = [r for r in rows if needle in r["name"].lower() or needle in (r["preview"] or "").lower()]

    def order(row: dict):
        waiting = row.get("waiting_since")
        last = row.get("last_at") or datetime.min.replace(tzinfo=timezone.utc)
        # Waiting threads first, oldest wait at the top; then the rest, newest first.
        return (0, waiting) if waiting else (1, -last.timestamp())

    rows.sort(key=lambda r: (order(r)[0], order(r)[1]))
    return [ConversationRow(**r) for r in rows]


@router.get("/conversations/summary", response_model=InboxSummary, summary="The figures above my inbox")
async def inbox_summary(me: dict = Depends(require_active_member)):
    """Waiting count, money tied up in open orders, and her median reply time.

    The reply time is measured, not claimed: every incoming message followed by
    one of hers contributes a gap, and the median of those gaps is the answer.
    Median rather than mean because one forgotten thread from last month should
    not tell her she takes two days to reply.
    """
    rows = [d async for d in _col().find({"member_id": str(me["_id"])})]

    waiting = 0
    open_minor = 0
    gaps: list[float] = []
    counts = {k: 0 for k in Conv.KINDS}

    for doc in rows:
        counts[doc.get("kind", Conv.KIND_BUYER)] = counts.get(doc.get("kind", Conv.KIND_BUYER), 0) + 1
        thread = doc.get("messages") or []
        if Conv.awaits_reply(doc):
            waiting += 1

        ctx = doc.get("context") or {}
        if ctx.get("kind") == "order" and not ctx.get("settled"):
            open_minor += int(ctx.get("amount_minor") or 0)

        asked: Optional[datetime] = None
        for b in thread:
            if b.get("dir") == "in":
                if asked is None:
                    asked = b.get("at")
            elif asked is not None and b.get("at"):
                gaps.append((b["at"] - asked).total_seconds() / 60)
                asked = None

    median = None
    if gaps:
        gaps.sort()
        mid = len(gaps) // 2
        median = int(gaps[mid] if len(gaps) % 2 else (gaps[mid - 1] + gaps[mid]) / 2)

    return InboxSummary(
        waiting=waiting, open_order_minor=open_minor, reply_minutes=median, counts=counts
    )


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail, summary="One conversation")
async def one_conversation(
    conversation_id: str,
    later: BackgroundTasks,
    me: dict = Depends(require_active_member),
):
    """Opening a thread marks it read — that is what opening it means."""
    doc = await _mine(conversation_id, str(me["_id"]))

    # She waited a round trip to Atlas for a write whose result the reply never
    # reads: the response below marks the bubbles read in memory regardless.
    # So the write goes out after the thread is on her screen. If it were to
    # fail, the worst case is the badge still showing one unread until she
    # opens the thread again.
    later.add_task(
        _col().update_one,
        {"_id": doc["_id"]}, {"$set": {"messages.$[b].read": True}},
        array_filters=[{"b.dir": "in", "b.read": False}],
    )
    for b in doc.get("messages") or []:
        if b.get("dir") == "in":
            b["read"] = True
    return ConversationDetail(**Conv.to_response(doc, with_messages=True))


@router.patch(
    "/conversations/{conversation_id}/star",
    response_model=ConversationDetail,
    summary="Star or unstar a conversation",
)
async def star(conversation_id: str, body: StarRequest, me: dict = Depends(require_active_member)):
    """What "mark as a good buyer" writes to."""
    doc = await _mine(conversation_id, str(me["_id"]))
    await _col().update_one({"_id": doc["_id"]}, {"$set": {"starred": bool(body.starred)}})
    doc["starred"] = bool(body.starred)
    return ConversationDetail(**Conv.to_response(doc, with_messages=True))


@router.post(
    "/conversations/{conversation_id}/unread",
    response_model=ConversationDetail,
    summary="Mark a conversation unread again",
)
async def mark_unread(conversation_id: str, me: dict = Depends(require_active_member)):
    """Puts the last thing she was sent back on her list.

    Opening a thread marks it read, which is right — but a member who opens one
    on the bus and cannot deal with it then needs a way to put it back. Only the
    final incoming run is reset, not the whole history, because that is the part
    she still owes an answer to.
    """
    doc = await _mine(conversation_id, str(me["_id"]))
    rows = doc.get("messages") or []
    for i in range(len(rows) - 1, -1, -1):
        if rows[i].get("dir") == "out":
            break
        rows[i]["read"] = False
    await _col().update_one({"_id": doc["_id"]}, {"$set": {"messages": rows}})
    return ConversationDetail(**Conv.to_response(doc, with_messages=True))


@router.delete(
    "/conversations/{conversation_id}",
    response_model=MessageResponse,
    summary="Delete a conversation",
)
async def delete_conversation(conversation_id: str, me: dict = Depends(require_active_member)):
    """Really deletes. What she said to a buyer is hers, and 'archived' is not
    what she means when she asks for it to be gone."""
    doc = await _mine(conversation_id, str(me["_id"]))
    await _col().delete_one({"_id": doc["_id"]})
    return MessageResponse(message="Deleted")


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=ConversationDetail,
    summary="Send a message",
)
async def send(conversation_id: str, body: SendMessage, me: dict = Depends(require_active_member)):
    """
    Her message, and — where the thread has another member on the end of it —
    the same message arriving in that member's inbox.

    Without the mirror, a market thread was a one-way drop: the buyer's question
    reached the seller and the seller's reply reached nobody. `counterpart_id`
    is set only on threads the market opened, so every seeded conversation goes
    through here exactly as it did before.
    """
    doc = await _mine(conversation_id, str(me["_id"]))
    bubble = Conv.bubble(direction="out", text=body.text.strip())
    await _col().update_one(
        {"_id": doc["_id"]},
        {"$push": {"messages": bubble}, "$set": {"updated_at": bubble["at"]}},
    )

    other = doc.get("counterpart_id")
    if other:
        try:
            # Her "out" is the other woman's "in", unread until she opens it.
            await _col().update_one(
                {"_id": ObjectId(other)},
                {"$push": {"messages": Conv.bubble(
                    direction="in", text=bubble["text"], at=bubble["at"],
                )}, "$set": {"updated_at": bubble["at"]}},
            )
        except Exception as exc:  # noqa: BLE001
            # Her own copy is already written and she can see it. A failed
            # mirror must not read to her as a failed send.
            print(f"⚠️  Could not mirror a message into {other}: {exc}")

    doc.setdefault("messages", []).append(bubble)
    return ConversationDetail(**Conv.to_response(doc, with_messages=True))
