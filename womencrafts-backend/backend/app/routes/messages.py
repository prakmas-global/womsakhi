from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core import mongosafe
from app.core.deps import get_current_user
from app.core.serializers import page_meta, to_object_id
from app.core.permissions import require_permission
from app.db.mongodb import get_database
from app.models.message import ConversationModel, MessageModel, MessageStatsModel
from app.schemas.message import (
    BroadcastCreate,
    BroadcastResult,
    ConversationCreate,
    ConversationFlagUpdate,
    ConversationListResponse,
    ConversationResponse,
    MessageCreate,
    MessageStatsResponse,
    SimpleListResponse,
    StatsRange,
)

router = APIRouter(prefix="/messages", tags=["Messages"])


def _conversations():
    return get_database()[ConversationModel.collection_name]


def _stats():
    return get_database()[MessageStatsModel.collection_name]


async def _display_total() -> int:
    """The grand total shown in the 'Showing 1 to N of N' footer.

    It is the real number of conversation rows we store — computed live from
    the `conversations` collection, not a seeded vanity count.
    """
    return await _conversations().count_documents({})


# Donut ring colours, kept from the seeded Messages Overview palette.
_OVERVIEW_COLORS = {"Sent": "#8b5cf6", "Received": "#3b82f6"}


async def _compute_stats() -> dict:
    """Compute the Messages statistics live from the `conversations` collection.

    Everything is derived from the stored conversation rows and their embedded
    message bubbles, EXCEPT avgResponseTime — that has no timestamp source, so
    the seeded label is kept verbatim.

        totalConversations     -> real conversation count
        messagesSent/Received  -> embedded bubbles counted by direction (out/in)
        resolvedConversations  -> conversations with nothing pending (unread == 0)
        overview donut         -> Sent vs Received message breakdown
        topContacts            -> conversations ranked by real message count
    """
    convos = [doc async for doc in _conversations().find({})]
    total_conversations = len(convos)

    messages_sent = 0
    messages_received = 0
    resolved = 0
    contacts: list[tuple[str, int, int]] = []  # (name, message_count, unread)
    for c in convos:
        bubbles = c.get("messages", []) or []
        messages_sent += sum(1 for b in bubbles if b.get("dir") == "out")
        messages_received += sum(1 for b in bubbles if b.get("dir") == "in")
        if int(c.get("unread", 0) or 0) == 0:
            resolved += 1
        contacts.append((c.get("name", ""), len(bubbles), int(c.get("unread", 0) or 0)))

    overview_total = messages_sent + messages_received

    def _pct(v: int) -> str:
        return f"{round(v / overview_total * 100, 1)}%" if overview_total else "0%"

    overview = [
        {"name": "Sent", "value": messages_sent, "pct": _pct(messages_sent), "color": _OVERVIEW_COLORS["Sent"]},
        {"name": "Received", "value": messages_received, "pct": _pct(messages_received), "color": _OVERVIEW_COLORS["Received"]},
    ]

    top_contacts = [
        {"name": name, "count": count, "badge": unread}
        for name, count, unread in sorted(contacts, key=lambda t: t[1], reverse=True)[:5]
    ]

    # avgResponseTime has no timestamp source — keep the seeded display label.
    stats_doc = await _stats().find_one({}, {"avgResponseTime": 1}) or {}

    return {
        "total_conversations": total_conversations,
        "messages_sent": messages_sent,
        "messages_received": messages_received,
        "avg_response_time": stats_doc.get("avgResponseTime", "2h 15m"),
        "resolved_conversations": resolved,
        "overview_total": overview_total,
        "overview": overview,
        "top_contacts": top_contacts,
    }


# Static template / automation lists shown in their respective modals.
_TEMPLATES = [
    "Welcome message",
    "Program brochure",
    "Appointment confirmation",
    "Workshop reminder",
]
_AUTOMATIONS = [
    "Auto-reply when away",
    "New enrollment notification",
    "Appointment reminder",
    "Weekly digest",
]


# --- Conversations ------------------------------------------------------------
@router.get("/conversations", response_model=ConversationListResponse, summary="List conversations",
    dependencies=[Depends(require_permission("messages.view"))],
)
async def list_conversations(
    q: Optional[str] = Query(None, description="Search by name or preview"),
    filter: str = Query("all", description="all | unread | starred | attachments"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    _: dict = Depends(get_current_user),
):
    query: dict = {}
    if filter == "unread":
        query["unread"] = {"$gt": 0}
    elif filter == "starred":
        query["starred"] = True
    elif filter == "attachments":
        query["messages.file"] = {"$exists": True}
    if q and q.strip():
        query.update(mongosafe.any_of(q, ["name", "preview"]))

    cursor = (
        _conversations()
        .find(query)
        .sort("_id", 1)
        .skip((page - 1) * page_size)
        .limit(page_size)
    )
    items = [ConversationModel.to_response(doc) async for doc in cursor]
    # The footer total is the real conversation count, computed from the DB.
    return ConversationListResponse(items=items, **page_meta(await _display_total(), page, page_size))


@router.post(
    "/conversations",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start a new conversation",
    dependencies=[Depends(require_permission("messages.create"))],
)
async def create_conversation(payload: ConversationCreate, _: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    name = payload.name.strip()
    body = (payload.body or "").strip()

    # Mirror the UI's ensureConvo: reuse an existing thread with the same name.
    existing = await _conversations().find_one({"name": name})
    if existing:
        sets: dict = {"active": True, "updated_at": now}
        push: dict = {}
        if body:
            push["messages"] = MessageModel.build(dir="out", text=body, time="Now")
            sets["preview"] = body
            sets["time"] = "Now"
        update: dict = {"$set": sets}
        if push:
            update["$push"] = push
        doc = await _conversations().find_one_and_update(
            {"_id": existing["_id"]},
            update,
            return_document=True,
        )
        return ConversationResponse(**ConversationModel.to_response(doc))

    messages = [{"dir": "out", "text": body, "time": "Now"}] if body else []
    doc = ConversationModel.create_document(
        name=name,
        preview=body or "New conversation",
        time="Now",
        active=True,
        messages=messages,
    )
    result = await _conversations().insert_one(doc)
    doc["_id"] = result.inserted_id
    return ConversationResponse(**ConversationModel.to_response(doc))


@router.get(
    "/conversations/{conversation_id}",
    response_model=ConversationResponse,
    summary="Get a conversation with its full thread",
    dependencies=[Depends(require_permission("messages.view"))],
)
async def get_conversation(conversation_id: str, _: dict = Depends(get_current_user)):
    doc = await _conversations().find_one({"_id": to_object_id(conversation_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    return ConversationResponse(**ConversationModel.to_response(doc))


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=ConversationResponse,
    summary="Append a message (composer send or attachment)",
    dependencies=[Depends(require_permission("messages.create"))],
)
async def add_message(conversation_id: str, payload: MessageCreate, _: dict = Depends(get_current_user)):
    oid = to_object_id(conversation_id)
    conv = await _conversations().find_one({"_id": oid})
    if not conv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")

    bubble = MessageModel.build(
        dir=payload.dir,
        text=payload.text,
        file=payload.file.model_dump() if payload.file else None,
        time=payload.time or "Now",
    )
    # Preview = the text, or the file name for an attachment (matches the UI).
    preview = bubble.get("text") or (bubble.get("file", {}) or {}).get("name") or conv.get("preview", "")
    doc = await _conversations().find_one_and_update(
        {"_id": oid},
        {
            "$push": {"messages": bubble},
            "$set": {"preview": preview, "time": bubble["time"], "updated_at": datetime.now(timezone.utc)},
        },
        return_document=True,
    )
    return ConversationResponse(**ConversationModel.to_response(doc))


@router.patch(
    "/conversations/{conversation_id}",
    response_model=ConversationResponse,
    summary="Update conversation flags (star / unread / archive / read)",
    dependencies=[Depends(require_permission("messages.edit"))],
)
async def update_conversation(
    conversation_id: str, payload: ConversationFlagUpdate, _: dict = Depends(get_current_user)
):
    oid = to_object_id(conversation_id)
    conv = await _conversations().find_one({"_id": oid})
    if not conv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")

    sets: dict = {}
    action = payload.action
    if action == "star":
        sets["starred"] = True
    elif action == "unstar":
        sets["starred"] = False
    elif action == "toggle_star":
        sets["starred"] = not bool(conv.get("starred", False))
    elif action == "mark_unread":
        sets["unread"] = int(conv.get("unread", 0)) or 1
    elif action == "archive":
        sets["unread"] = 0
        sets["starred"] = False
    elif action == "read":
        sets["unread"] = 0

    # Direct overrides win over the action shortcut.
    if payload.starred is not None:
        sets["starred"] = payload.starred
    if payload.unread is not None:
        sets["unread"] = payload.unread
    if payload.active is not None:
        sets["active"] = payload.active

    sets["updated_at"] = datetime.now(timezone.utc)
    doc = await _conversations().find_one_and_update(
        {"_id": oid},
        {"$set": sets},
        return_document=True,
    )
    return ConversationResponse(**ConversationModel.to_response(doc))


@router.delete("/conversations/{conversation_id}", summary="Delete a conversation",
    dependencies=[Depends(require_permission("messages.delete"))],
)
async def delete_conversation(conversation_id: str, _: dict = Depends(get_current_user)):
    result = await _conversations().delete_one({"_id": to_object_id(conversation_id)})
    if result.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    return {"message": "Conversation deleted"}


# --- Broadcast ----------------------------------------------------------------
@router.post("/broadcast", response_model=BroadcastResult, summary="Broadcast a message to a group",
    dependencies=[Depends(require_permission("messages.create"))],
)
async def broadcast(payload: BroadcastCreate, _: dict = Depends(get_current_user)):
    if payload.recipients == "Starred contacts":
        sent = await _conversations().count_documents({"starred": True})
    else:
        sent = await _conversations().count_documents({})
    return BroadcastResult(
        message=f"Broadcast queued for {payload.recipients}",
        recipients=payload.recipients,
        sent=sent,
    )


# --- Stats / lookups ----------------------------------------------------------
@router.get("/stats", response_model=MessageStatsResponse, summary="Messages statistics",
    dependencies=[Depends(require_permission("messages.view"))],
)
async def message_stats(
    range: StatsRange = Query("This Month", description="Reporting range (currently static)"),
    _: dict = Depends(get_current_user),
):
    data = await _compute_stats()
    return MessageStatsResponse(**data, range=range)


@router.get("/contacts", response_model=SimpleListResponse, summary="Recipient options for New Message",
    dependencies=[Depends(require_permission("messages.view"))],
)
async def contacts(_: dict = Depends(get_current_user)):
    names = [doc.get("name", "") async for doc in _conversations().find({}, {"name": 1}).sort("_id", 1)]
    return SimpleListResponse(items=names)


@router.get("/templates", response_model=SimpleListResponse, summary="Message templates",
    dependencies=[Depends(require_permission("messages.view"))],
)
async def templates(_: dict = Depends(get_current_user)):
    return SimpleListResponse(items=list(_TEMPLATES))


@router.get("/automations", response_model=SimpleListResponse, summary="Automated messages",
    dependencies=[Depends(require_permission("messages.view"))],
)
async def automations(_: dict = Depends(get_current_user)):
    return SimpleListResponse(items=list(_AUTOMATIONS))


# --- Seeding ------------------------------------------------------------------

# The exact 7 conversations (with their embedded threads) the UI ships with.
# messages transcribed verbatim from INITIAL_THREADS in the frontend page.
_SEED_CONVERSATIONS = [
    dict(
        name="Priya Sharma",
        preview="Hi, I would like to know more about...",
        time="10:30 AM",
        unread=2,
        active=True,
        messages=[
            dict(dir="in", text="Hi, I would like to know more about the Handicrafts Training Program.", time="10:28 AM"),
            dict(dir="out", text="Hello Priya! Thank you for your interest in our Handicrafts Training Program. I'd be happy to share more details. What would you like to know?", time="10:29 AM"),
            dict(dir="in", text="What are the course fees and duration?", time="10:30 AM"),
            dict(dir="out", text="The course duration is 8 weeks and the fee is Rs.4,999. We also offer early bird discounts. Would you like me to send you the brochure?", time="10:31 AM"),
            dict(dir="in", text="Yes, please send me the brochure.", time="10:31 AM"),
            dict(dir="out", file={"name": "Handicrafts_Program_Brochure.pdf", "size": "1.4 MB"}, time="10:32 AM"),
        ],
    ),
    dict(
        name="Neha Verma",
        preview="Thank you for the information!",
        time="9:15 AM",
        starred=True,
        messages=[
            dict(dir="out", text="Hi Neha, here are the details you asked for regarding the tailoring workshop.", time="9:10 AM"),
            dict(dir="in", text="Thank you for the information!", time="9:15 AM"),
            dict(dir="out", text="You're most welcome. Let me know if you need anything else!", time="9:16 AM"),
        ],
    ),
    dict(
        name="Anjali Mehta",
        preview="Can I reschedule my appointment?",
        time="Yesterday",
        unread=1,
        messages=[
            dict(dir="in", text="Can I reschedule my appointment?", time="Yesterday"),
            dict(dir="out", text="Of course! Which day works best for you?", time="Yesterday"),
        ],
    ),
    dict(
        name="Ritika Singh",
        preview="Please send me the workshop details.",
        time="Yesterday",
        messages=[
            dict(dir="in", text="Please send me the workshop details.", time="Yesterday"),
            dict(dir="out", text="Sure Ritika, I'll share the full schedule with you shortly.", time="Yesterday"),
        ],
    ),
    dict(
        name="Sneha Patil",
        preview="Do you have any upcoming events?",
        time="May 19",
        unread=3,
        messages=[
            dict(dir="in", text="Do you have any upcoming events?", time="May 19"),
            dict(dir="out", text="Yes! We have a craft fair and two workshops next month.", time="May 19"),
            dict(dir="in", text="That sounds great, please add me to the list.", time="May 19"),
        ],
    ),
    dict(
        name="Kavita Joshi",
        preview="Thanks for your support",
        time="May 18",
        starred=True,
        messages=[
            dict(dir="out", text="We really appreciate you being part of our community, Kavita.", time="May 18"),
            dict(dir="in", text="Thanks for your support", time="May 18"),
        ],
    ),
    dict(
        name="Pooja Gupta",
        preview="I'm interested in your training program.",
        time="May 18",
        messages=[
            dict(dir="in", text="I'm interested in your training program.", time="May 18"),
            dict(dir="out", text="Wonderful! I'll send you the enrollment details right away.", time="May 18"),
        ],
    ),
]

# The single message_stats summary document — 5 stat cards + donut + top contacts.
_SEED_STATS = dict(
    totalConversations=248,
    messagesSent=1286,
    messagesReceived=1132,
    avgResponseTime="2h 15m",
    resolvedConversations=186,
    overviewTotal=1286,
    overview=[
        {"name": "Sent", "value": 568, "pct": "44.1%", "color": "#8b5cf6"},
        {"name": "Received", "value": 542, "pct": "42.1%", "color": "#3b82f6"},
        {"name": "System", "value": 96, "pct": "7.5%", "color": "#22c55e"},
        {"name": "Notifications", "value": 56, "pct": "4.3%", "color": "#f59e0b"},
        {"name": "Other", "value": 24, "pct": "1.9%", "color": "#e6117e"},
    ],
    topContacts=[
        {"name": "Priya Sharma", "count": 12, "badge": 5},
        {"name": "Neha Verma", "count": 9, "badge": 3},
        {"name": "Anjali Mehta", "count": 8, "badge": 2},
        {"name": "Ritika Singh", "count": 7, "badge": 2},
        {"name": "Sneha Patil", "count": 6, "badge": 1},
    ],
)


async def seed() -> None:
    """Seed conversations (with embedded threads) and the stats summary, if empty."""
    convos = _conversations()
    if await convos.count_documents({}) == 0:
        docs = [ConversationModel.create_document(**c) for c in _SEED_CONVERSATIONS]
        await convos.insert_many(docs)
        bubble_count = sum(len(c["messages"]) for c in _SEED_CONVERSATIONS)
        print(f"🌱 Seeded {len(docs)} conversations ({bubble_count} messages)")

    stats = _stats()
    if await stats.count_documents({}) == 0:
        await stats.insert_one(MessageStatsModel.create_document(**_SEED_STATS))
        print("🌱 Seeded 1 message_stats summary")
