from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core import mongosafe
from app.core.deps import get_current_user
from app.core.serializers import page_meta, to_object_id
from app.db.mongodb import get_database
from app.models.notification import NotificationChannelModel, NotificationModel
from app.schemas.notification import (
    ChannelListResponse,
    ChannelResponse,
    ChannelUpdate,
    MessageResponse,
    NotificationGroupedResponse,
    NotificationListResponse,
    NotificationResponse,
    NotificationStatsResponse,
    ReadAllResponse,
)

router = APIRouter(prefix="/notifications", tags=["Notifications"])

# The order the feed prints its date buckets.
GROUP_ORDER = ["Today", "Yesterday", "Earlier"]


def _notifications():
    return get_database()[NotificationModel.collection_name]


def _channels():
    return get_database()[NotificationChannelModel.collection_name]


def _feed_query(
    tab: Optional[str],
    ntype: Optional[str],
    group: Optional[str],
    unread: Optional[bool],
    q: Optional[str],
) -> dict:
    """Translate the tab + toolbar filters into a Mongo query, mirroring the
    frontend's tab logic (the System tab covers both 'system' and 'alert')."""
    query: dict = {}

    if tab == "unread":
        query["unread"] = True
    elif tab == "system":
        query["type"] = {"$in": ["system", "alert"]}
    elif tab and tab not in ("all", "All", ""):
        # appointment | message tabs filter straight by type
        query["type"] = tab

    if ntype and ntype not in ("all", "All Types"):
        query["type"] = ntype
    if group and group not in ("all", "All Time"):
        query["group"] = group
    if unread is not None:
        query["unread"] = unread
    if q and q.strip():
        query.update(mongosafe.any_of(q, ["title", "desc"]))

    return query


# --- List --------------------------------------------------------------------
@router.get("", response_model=NotificationListResponse, summary="List notifications")
async def list_notifications(
    tab: Optional[str] = Query(None, description="Tab: all|unread|appointment|message|system (system = system+alert)"),
    type: Optional[str] = Query(None, description="Filter by a single notification type"),
    group: Optional[str] = Query(None, description="Filter by group: Today|Yesterday|Earlier"),
    q: Optional[str] = Query(None, description="Search title + description"),
    unread: Optional[bool] = Query(None, description="Only unread (true) / only read (false)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    _: dict = Depends(get_current_user),
):
    # Count and page in one pass, not two.
    #
    # `count_documents` then `find` is the same filter asked twice, and against
    # a cluster in another data centre the second question cannot leave until
    # the first is answered — two round trips, about 22ms each, for one screen
    # of notifications. `$facet` runs both branches over a single `$match`.
    query = _feed_query(tab, type, group, unread, q)
    rows = await _notifications().aggregate([
        {"$match": query},
        {"$facet": {
            "total": [{"$count": "n"}],
            # Seed order keeps Today -> Yesterday -> Earlier ordering.
            "items": [
                {"$sort": {"_id": 1}},
                {"$skip": (page - 1) * page_size},
                {"$limit": page_size},
            ],
        }},
    ]).to_list(1)

    facet = rows[0] if rows else {}
    count_bucket = facet.get("total") or []
    total = int(count_bucket[0]["n"]) if count_bucket else 0
    items = [NotificationModel.to_response(doc) for doc in facet.get("items", [])]
    return NotificationListResponse(items=items, **page_meta(total, page, page_size))


# --- Static paths BEFORE the dynamic /{id} ------------------------------------
@router.get("/grouped", response_model=NotificationGroupedResponse, summary="Feed bucketed into sections")
async def grouped_notifications(
    tab: Optional[str] = Query(None, description="Tab: all|unread|appointment|message|system"),
    q: Optional[str] = Query(None, description="Search title + description"),
    _: dict = Depends(get_current_user),
):
    """Same rows as the list, already bucketed into Today / Yesterday / Earlier
    sections (empty sections omitted), in GROUP_ORDER."""
    query = _feed_query(tab, None, None, None, q)
    rows = [NotificationModel.to_response(doc) async for doc in _notifications().find(query).sort("_id", 1)]

    sections = []
    for g in GROUP_ORDER:
        bucket = [r for r in rows if r["group"] == g]
        if bucket:
            sections.append({"group": g, "rows": bucket})

    unread = sum(1 for r in rows if r["unread"])
    return NotificationGroupedResponse(sections=sections, total=len(rows), unread=unread)


# By-Category donut: the 8 notification types folded into the 5 display buckets
# the UI paints. appointment/message/payment/system map 1:1; every other type
# (user/alert/feedback/program) lands in "Other".
_CATEGORY_DONUT = [
    ("Appointments", ("appointment",), "#8b5cf6"),
    ("Messages", ("message",), "#0ea5e9"),
    ("Payments", ("payment",), "#f59e0b"),
    ("System", ("system",), "#94a3b8"),
    ("Other", ("user", "alert", "feedback", "program"), "#e6117e"),
]


@router.get("/stats", response_model=NotificationStatsResponse, summary="Notification stat cards + category donut")
async def notification_stats(_: dict = Depends(get_current_user)):
    """5 stat cards plus the By-Category donut, all computed live from the real
    `notifications` collection: total / unread (live flags) / today (group) /
    mentions (message type) / alerts (alert+system) and the per-type donut."""
    docs = [d async for d in _notifications().find({}, {"type": 1, "group": 1, "unread": 1})]

    total = len(docs)
    unread = sum(1 for d in docs if d.get("unread"))
    today = sum(1 for d in docs if d.get("group") == "Today")
    mentions = sum(1 for d in docs if d.get("type") == "message")
    alerts = sum(1 for d in docs if d.get("type") in ("alert", "system"))

    categories = [
        {"name": name, "value": sum(1 for d in docs if d.get("type") in types), "color": color}
        for (name, types, color) in _CATEGORY_DONUT
    ]

    return NotificationStatsResponse(
        stat_cards=[
            {"key": "total", "label": "Total Notifications", "value": f"{total:,}", "icon": "Bell", "tone": "violet", "delta_note": "All time"},
            {"key": "unread", "label": "Unread", "value": str(unread), "icon": "BellDot", "tone": "brand", "delta_note": "Needs attention"},
            {"key": "today", "label": "Today", "value": str(today), "icon": "Clock", "tone": "sky", "delta": "8%"},
            {"key": "mentions", "label": "Mentions", "value": str(mentions), "icon": "AtSign", "tone": "amber", "delta_note": "This week"},
            {"key": "alerts", "label": "Alerts", "value": str(alerts), "icon": "AlertTriangle", "tone": "rose", "delta_note": "Action needed"},
        ],
        categories=categories,
        category_total=str(total),
        center_label="Total",
    )


@router.get("/channels", response_model=ChannelListResponse, summary="Delivery channel toggles")
async def list_channels(_: dict = Depends(get_current_user)):
    cursor = _channels().find({}).sort("_id", 1)
    items = [NotificationChannelModel.to_response(doc) async for doc in cursor]
    return ChannelListResponse(items=items, total=len(items))


@router.patch("/channels/{label}", response_model=ChannelResponse, summary="Enable/disable a delivery channel")
async def set_channel(label: str, payload: ChannelUpdate, _: dict = Depends(get_current_user)):
    doc = await _channels().find_one_and_update(
        {"label": label},
        {"$set": {"on": payload.on}},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Channel not found")
    return ChannelResponse(**NotificationChannelModel.to_response(doc))


@router.patch("/read-all", response_model=ReadAllResponse, summary="Mark all notifications as read")
@router.post("/read-all", response_model=ReadAllResponse, summary="Mark all notifications as read")
async def mark_all_read(_: dict = Depends(get_current_user)):
    result = await _notifications().update_many({"unread": True}, {"$set": {"unread": False}})
    return ReadAllResponse(updated_count=result.modified_count)


@router.delete("", response_model=MessageResponse, summary="Clear all notifications")
async def clear_all(_: dict = Depends(get_current_user)):
    result = await _notifications().delete_many({})
    return MessageResponse(message=f"Cleared {result.deleted_count} notifications")


# --- Dynamic /{id} routes come last ------------------------------------------
@router.patch("/{notification_id}/read", response_model=NotificationResponse, summary="Mark a notification as read")
async def mark_read(notification_id: str, _: dict = Depends(get_current_user)):
    oid = to_object_id(notification_id)
    doc = await _notifications().find_one_and_update(
        {"_id": oid},
        {"$set": {"unread": False}},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    return NotificationResponse(**NotificationModel.to_response(doc))


@router.delete("/{notification_id}", response_model=MessageResponse, summary="Dismiss a notification")
async def dismiss_notification(notification_id: str, _: dict = Depends(get_current_user)):
    result = await _notifications().delete_one({"_id": to_object_id(notification_id)})
    if result.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    return MessageResponse(message="Notification dismissed")


# --- Seed --------------------------------------------------------------------

# The exact 12 notifications the UI ships with (NOTIFICATIONS in lib/notifications.ts).
_NOTIFICATIONS = [
    ("appointment", "New appointment booked", "Priya Sharma booked a Career Counseling session for 10:00 AM.", "10 min ago", "Today", True),
    ("message", "New message from Aisha Khan", "“Thank you so much for the skill workshop — it was incredibly helpful!”", "32 min ago", "Today", True),
    ("user", "New user registered", "Neha Verma just created an account and joined the community.", "1 hour ago", "Today", True),
    ("payment", "Payment received", "₹2,999 subscription payment received from Kavita Rao.", "2 hours ago", "Today", True),
    ("feedback", "New 5-star feedback", "Meera Iyer left a 5-star review for “Digital Skills for Women”.", "3 hours ago", "Today", True),
    ("alert", "High cancellation risk detected", "AI predicts 15 appointments are likely to be cancelled today.", "Yesterday, 6:40 PM", "Yesterday", False),
    ("program", "Program enrollment milestone", "Entrepreneurship Bootcamp crossed 100 enrollments 🎉.", "Yesterday, 2:15 PM", "Yesterday", False),
    ("system", "Backup completed successfully", "Daily backup finished (4.25 GB) with no errors.", "Yesterday, 10:30 AM", "Yesterday", False),
    ("appointment", "Appointment rescheduled", "Ritu Singh moved “Digital Skills” to May 22, 12:00 PM.", "Mon, 4:20 PM", "Earlier", False),
    ("message", "Support ticket resolved", "Your ticket #4821 has been marked as resolved.", "Mon, 11:05 AM", "Earlier", False),
    ("system", "New login detected", "A new sign-in from Mumbai, India on Chrome (macOS).", "Sun, 9:15 AM", "Earlier", False),
    ("payment", "Invoice generated", "Invoice INV-2024-0052 is ready to view and download.", "Sun, 8:00 AM", "Earlier", False),
]

# The exact 4 delivery channels (CHANNELS on the notifications page).
_CHANNELS = [
    ("Email", "Mail", True),
    ("Push", "MonitorSmartphone", True),
    ("SMS", "Smartphone", False),
    ("In-App", "MessageSquare", True),
]


async def seed() -> None:
    """Seed the notification collections only when each is currently empty."""
    notifications = _notifications()
    if await notifications.count_documents({}) == 0:
        docs = [
            NotificationModel.create_document(
                type=ntype, title=title, desc=desc, time=time, group=group, unread=unread
            )
            for (ntype, title, desc, time, group, unread) in _NOTIFICATIONS
        ]
        await notifications.insert_many(docs)
        print(f"🌱 Seeded {len(docs)} notifications")

    channels = _channels()
    if await channels.count_documents({}) == 0:
        docs = [
            NotificationChannelModel.create_document(label=label, icon=icon, on=on)
            for (label, icon, on) in _CHANNELS
        ]
        await channels.insert_many(docs)
        print(f"🌱 Seeded {len(docs)} notification channels")
