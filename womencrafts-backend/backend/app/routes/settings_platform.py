from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core import mongosafe
from app.core.deps import get_current_user
from app.core.permissions import require_permission
from app.core.serializers import page_meta, to_object_id
from app.db.mongodb import get_database
from app.models.integration import (
    IntegrationModel,
    IntegrationRequestModel,
    PermissionGroupModel,
    WebhookConfigModel,
    synced_for,
)
from app.routes._paging import paged
from app.schemas.integration import (
    IntegrationListResponse,
    IntegrationOverviewResponse,
    IntegrationRecentItem,
    IntegrationRequestCreate,
    IntegrationRequestResponse,
    IntegrationResponse,
    IntegrationStatsResponse,
    IntegrationUpdate,
    PermissionGroupsResponse,
    PermissionStatsResponse,
    WebhookResponse,
    WebhookUpdate,
)

# One parent router carrying both prefixes used by the Settings screens:
#   /integrations  — the Integrations page (cards, stats, webhook, requests)
#   /permissions   — the Roles & Permissions page (permission groups + stats)
# main.py includes this single `router`; each sub-router keeps its own prefix.
router = APIRouter(tags=["Settings"])
integrations_router = APIRouter(prefix="/integrations", tags=["Settings"])
permissions_router = APIRouter(prefix="/permissions", tags=["Settings"])


def _integrations():
    return get_database()[IntegrationModel.collection_name]


def _permission_groups():
    return get_database()[PermissionGroupModel.collection_name]


def _integration_requests():
    return get_database()[IntegrationRequestModel.collection_name]


def _webhooks():
    return get_database()[WebhookConfigModel.collection_name]


# The number of "available" integrations the header stat shows verbatim.
_AVAILABLE_INTEGRATIONS = "32"
# Total platform permissions the Roles & Permissions header shows verbatim.
_TOTAL_PERMISSIONS = "126"


def _round_pct(part: int, whole: int) -> str:
    """Round-half-up percentage label (matches the frontend's Math.round)."""
    if not whole:
        return ""
    return f"{int(part / whole * 100 + 0.5)}%"


def _apply_status(updates: dict, new_status: str) -> None:
    """Set status + its synced caption, clearing toggles when not Connected —
    mirrors the frontend's setStatus()."""
    updates["status"] = new_status
    updates["synced"] = synced_for(new_status)
    if new_status != "Connected":
        updates["notifications"] = False
        updates["auto_sync"] = False


# =============================================================================
# Integrations
# =============================================================================
# Tab labels map to a status the list should filter by.
_TAB_STATUS = {"Active": "Connected", "Inactive": "Inactive", "Available": "Not Connected"}


@integrations_router.get("", response_model=IntegrationListResponse, summary="List integrations")
async def list_integrations(
    tab: Optional[str] = Query(None, description="All Integrations|Active|Inactive|Available"),
    status: Optional[str] = Query(None, description="All Status|Connected|Inactive|Not Connected"),
    category: Optional[str] = Query(None, description="Filter by category"),
    q: Optional[str] = Query(None, description="Search name / description / category"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    _: dict = Depends(get_current_user),
):
    query: dict = {}
    # Tab sets a status constraint; an explicit status filter takes precedence.
    if tab and tab in _TAB_STATUS:
        query["status"] = _TAB_STATUS[tab]
    if status and status not in ("All Status", "all"):
        query["status"] = status
    if category and category not in ("All Categories", "all"):
        query["category"] = category
    if q and q.strip():
        query.update(mongosafe.any_of(q, ["name", "desc", "category"]))

    total, docs = await paged(
        _integrations(), query,
        sort="_id", direction=1,  # creation order keeps the on-screen ordering
        page=page, page_size=page_size,
    )
    items = [IntegrationModel.to_response(doc) for doc in docs]
    return IntegrationListResponse(items=items, **page_meta(total, page, page_size))


@integrations_router.get("/stats", response_model=IntegrationStatsResponse, summary="Integration stat cards")
async def integration_stats(_: dict = Depends(get_current_user)):
    total = await _integrations().count_documents({})
    connected = await _integrations().count_documents({"status": "Connected"})
    return IntegrationStatsResponse(
        total_integrations=total,
        active_integrations=connected,
        available_integrations=_AVAILABLE_INTEGRATIONS,
        sync_status="All Good",
        last_checked="5 mins ago",
    )


@integrations_router.get("/overview", response_model=IntegrationOverviewResponse, summary="Integration overview donut")
async def integration_overview(_: dict = Depends(get_current_user)):
    total = await _integrations().count_documents({})
    connected = await _integrations().count_documents({"status": "Connected"})
    inactive = await _integrations().count_documents({"status": "Inactive"})
    not_connected = await _integrations().count_documents({"status": "Not Connected"})
    overview = [
        {"name": "Connected", "value": connected, "color": "#22c55e", "pct": _round_pct(connected, total)},
        {"name": "Inactive", "value": inactive, "color": "#f59e0b", "pct": _round_pct(inactive, total) if inactive else ""},
        {"name": "Not Connected", "value": not_connected, "color": "#cbd5e1", "pct": ""},
    ]
    return IntegrationOverviewResponse(overview=overview, total=total)


@integrations_router.get("/categories", response_model=list[str], summary="Distinct categories (filter menu)")
async def integration_categories(_: dict = Depends(get_current_user)):
    seen: list[str] = ["All Categories"]
    async for doc in _integrations().find({}, {"category": 1}).sort("_id", 1):
        c = doc.get("category")
        if c and c not in seen:
            seen.append(c)
    return seen


@integrations_router.get("/recent", response_model=list[IntegrationRecentItem], summary="Recently connected list")
async def integration_recent(
    limit: int = Query(3, ge=1, le=20),
    _: dict = Depends(get_current_user),
):
    cursor = (
        _integrations()
        .find({"connected_at": {"$ne": None}})
        .sort("connected_at", -1)
        .limit(limit)
    )
    items: list[dict] = []
    async for doc in cursor:
        resp = IntegrationModel.to_response(doc)
        items.append({"name": resp["name"], "icon": resp["icon"], "tone": resp["tone"], "when": resp["connected_at"] or ""})
    return items


@integrations_router.get("/webhook", response_model=WebhookResponse, summary="Get webhook config")
async def get_webhook(_: dict = Depends(get_current_user)):
    doc = await _webhooks().find_one({})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Webhook config not found")
    return WebhookResponse(**WebhookConfigModel.to_response(doc))


@integrations_router.put("/webhook", response_model=WebhookResponse, summary="Update webhook URL", dependencies=[Depends(require_permission("settings.edit"))])
async def update_webhook(payload: WebhookUpdate, _: dict = Depends(get_current_user)):
    doc = await _webhooks().find_one({})
    if not doc:
        # No row yet — create one so the modal always has something to save.
        new_doc = WebhookConfigModel.create_document(url=payload.url, signing_secret="whsec_9f2c1a7b4e8d5c3a")
        result = await _webhooks().insert_one(new_doc)
        new_doc["_id"] = result.inserted_id
        return WebhookResponse(**WebhookConfigModel.to_response(new_doc))
    doc = await _webhooks().find_one_and_update(
        {"_id": doc["_id"]},
        {"$set": {"url": payload.url.strip()}},
        return_document=True,
    )
    return WebhookResponse(**WebhookConfigModel.to_response(doc))


@integrations_router.post(
    "/requests",
    response_model=IntegrationRequestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Request a custom integration",
    dependencies=[Depends(require_permission("settings.edit"))],
)
async def create_integration_request(payload: IntegrationRequestCreate, _: dict = Depends(get_current_user)):
    doc = IntegrationRequestModel.create_document(
        service=payload.service, category=payload.category, details=payload.details
    )
    result = await _integration_requests().insert_one(doc)
    doc["_id"] = result.inserted_id
    return IntegrationRequestResponse(**IntegrationRequestModel.to_response(doc))


@integrations_router.patch("/{integration_id}", response_model=IntegrationResponse, summary="Update an integration (toggle / connect / disconnect)", dependencies=[Depends(require_permission("settings.edit"))])
async def update_integration(integration_id: str, payload: IntegrationUpdate, _: dict = Depends(get_current_user)):
    oid = to_object_id(integration_id)
    doc = await _integrations().find_one({"_id": oid})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Integration not found")

    updates: dict = {}

    # A lifecycle action wins over an explicit status.
    if payload.action == "connect":
        _apply_status(updates, "Connected")
        updates["connected_at"] = datetime.now(timezone.utc)
    elif payload.action == "disconnect":
        _apply_status(updates, "Not Connected" if doc.get("status") == "Inactive" else "Inactive")
    elif payload.action == "sync":
        updates["synced"] = "Last synced: just now"
    elif payload.status:
        _apply_status(updates, payload.status)
        if payload.status == "Connected":
            updates["connected_at"] = datetime.now(timezone.utc)

    # Toggle settings only apply while connected (or becoming connected).
    connected_after = updates.get("status", doc.get("status")) == "Connected"
    if payload.notifications is not None and connected_after:
        updates["notifications"] = payload.notifications
    if payload.auto_sync is not None and connected_after:
        updates["auto_sync"] = payload.auto_sync

    if updates:
        doc = await _integrations().find_one_and_update(
            {"_id": oid},
            {"$set": updates},
            return_document=True,
        )
    return IntegrationResponse(**IntegrationModel.to_response(doc))


@integrations_router.post("/{integration_id}/connect", response_model=IntegrationResponse, summary="Connect an integration", dependencies=[Depends(require_permission("settings.edit"))])
async def connect_integration(integration_id: str, _: dict = Depends(get_current_user)):
    oid = to_object_id(integration_id)
    updates: dict = {"connected_at": datetime.now(timezone.utc)}
    _apply_status(updates, "Connected")
    doc = await _integrations().find_one_and_update(
        {"_id": oid},
        {"$set": updates},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Integration not found")
    return IntegrationResponse(**IntegrationModel.to_response(doc))


@integrations_router.post("/{integration_id}/disconnect", response_model=IntegrationResponse, summary="Disconnect an integration", dependencies=[Depends(require_permission("settings.edit"))])
async def disconnect_integration(integration_id: str, _: dict = Depends(get_current_user)):
    oid = to_object_id(integration_id)
    doc = await _integrations().find_one({"_id": oid})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Integration not found")
    updates: dict = {}
    # Connected -> Inactive; Inactive -> Not Connected (matches the UI).
    _apply_status(updates, "Not Connected" if doc.get("status") == "Inactive" else "Inactive")
    doc = await _integrations().find_one_and_update(
        {"_id": oid},
        {"$set": updates},
        return_document=True,
    )
    return IntegrationResponse(**IntegrationModel.to_response(doc))


@integrations_router.post("/{integration_id}/sync", response_model=IntegrationResponse, summary="Sync an integration now", dependencies=[Depends(require_permission("settings.edit"))])
async def sync_integration(integration_id: str, _: dict = Depends(get_current_user)):
    oid = to_object_id(integration_id)
    doc = await _integrations().find_one_and_update(
        {"_id": oid},
        {"$set": {"synced": "Last synced: just now"}},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Integration not found")
    return IntegrationResponse(**IntegrationModel.to_response(doc))


@integrations_router.delete("/{integration_id}", summary="Remove an integration", dependencies=[Depends(require_permission("settings.edit"))])
async def delete_integration(integration_id: str, _: dict = Depends(get_current_user)):
    result = await _integrations().delete_one({"_id": to_object_id(integration_id)})
    if result.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Integration not found")
    return {"message": "Integration removed"}


# =============================================================================
# Permissions (Roles & Permissions page — permission groups)
# =============================================================================
@permissions_router.get("", response_model=PermissionGroupsResponse, summary="List permission groups")
async def list_permission_groups(_: dict = Depends(get_current_user)):
    cursor = _permission_groups().find({}).sort("order", 1)
    groups = [PermissionGroupModel.to_response(doc) async for doc in cursor]
    return PermissionGroupsResponse(groups=groups, total=len(groups))


@permissions_router.get("/stats", response_model=PermissionStatsResponse, summary="Permission stats")
async def permission_stats(_: dict = Depends(get_current_user)):
    """
    Counted from the real permission catalogue, not a seeded constant — the
    number here and the number on the role panel are the same number.
    """
    from app.core.permissions import CATALOGUE, total_count

    return PermissionStatsResponse(
        total_permissions=str(total_count()),
        permission_groups=len(CATALOGUE),
        covered_permissions=total_count(),
    )


# Attach both prefixed sub-routers to the single router main.py includes.
router.include_router(integrations_router)
router.include_router(permissions_router)


# =============================================================================
# Seed — the exact mock data the Settings Integrations & Roles screens render
# =============================================================================
# 8 integrations (the INITIAL_INTEGRATIONS array). connected_at is set only for
# the 3 shown in "Recently Connected"; the other connected ones stay None.
_MAY = timezone.utc
_INTEGRATIONS = [
    dict(name="Google Calendar", icon="Calendar", tone="sky", category="Calendar", cat_tone="sky",
         desc="Sync appointments and events with Google Calendar.", status="Connected",
         synced="Last synced: 2 mins ago", notifications=True, auto_sync=True,
         connected_at=datetime(2024, 5, 20, 10, 30, tzinfo=_MAY)),
    dict(name="Stripe", icon="CreditCard", tone="violet", category="Payments", cat_tone="violet",
         desc="Accept online payments and manage transactions securely.", status="Connected",
         synced="Last synced: 10 mins ago", notifications=True, auto_sync=True,
         connected_at=datetime(2024, 5, 18, 14, 15, tzinfo=_MAY)),
    dict(name="Mailchimp", icon="Mail", tone="amber", category="Email Marketing", cat_tone="amber",
         desc="Sync contacts and send email campaigns.", status="Connected",
         synced="Last synced: 1 hour ago", notifications=False, auto_sync=True,
         connected_at=datetime(2024, 5, 17, 11, 45, tzinfo=_MAY)),
    dict(name="Twilio", icon="MessageSquare", tone="rose", category="SMS", cat_tone="rose",
         desc="Send SMS notifications and alerts to your users.", status="Connected",
         synced="Last synced: 5 mins ago", notifications=True, auto_sync=False, connected_at=None),
    dict(name="Zoom", icon="Video", tone="blue", category="Video Conferencing", cat_tone="blue",
         desc="Create and manage meeting sessions with Zoom.", status="Connected",
         synced="Last synced: 15 mins ago", notifications=True, auto_sync=True, connected_at=None),
    dict(name="WhatsApp Business", icon="MessageCircle", tone="emerald", category="Messaging", cat_tone="emerald",
         desc="Send WhatsApp messages and notifications.", status="Inactive",
         synced="Not connected", notifications=False, auto_sync=False, connected_at=None),
    dict(name="Slack", icon="Hash", tone="brand", category="Team Collaboration", cat_tone="brand",
         desc="Send alerts and updates to Slack channels.", status="Not Connected",
         synced="Never connected", notifications=False, auto_sync=False, connected_at=None),
    dict(name="Razorpay", icon="Wallet", tone="blue", category="Payments", cat_tone="blue",
         desc="Accept payments using multiple payment methods.", status="Not Connected",
         synced="Never connected", notifications=False, auto_sync=False, connected_at=None),
]

# 10 permission groups (the PERMISSION_GROUPS array — name + "count").
_PERMISSION_GROUPS = [
    ("Dashboard", "6 / 6", 6),
    ("User Management", "12 / 12", 12),
    ("Appointments", "10 / 10", 10),
    ("Programs", "9 / 9", 9),
    ("Content Management", "8 / 8", 8),
    ("Reports & Analytics", "15 / 15", 15),
    ("Messages", "6 / 6", 6),
    ("Settings", "12 / 12", 12),
    ("System", "9 / 9", 9),
    ("Others", "19 / 19", 19),
]

# The single webhook config row behind the Manage Webhooks modal.
_WEBHOOK = dict(url="https://api.womsakhi.com/webhooks/incoming", signing_secret="whsec_9f2c1a7b4e8d5c3a")


async def seed() -> None:
    """Seed the settings collections with the exact UI mock data, only if empty.
    (integration_requests intentionally starts empty.)"""
    db = get_database()

    if await db[IntegrationModel.collection_name].count_documents({}) == 0:
        docs = [IntegrationModel.create_document(**i) for i in _INTEGRATIONS]
        await db[IntegrationModel.collection_name].insert_many(docs)
        print(f"🌱 Seeded {len(docs)} integrations")

    if await db[PermissionGroupModel.collection_name].count_documents({}) == 0:
        docs = [
            PermissionGroupModel.create_document(name=name, count=count, total=total, order=i)
            for i, (name, count, total) in enumerate(_PERMISSION_GROUPS)
        ]
        await db[PermissionGroupModel.collection_name].insert_many(docs)
        print(f"🌱 Seeded {len(docs)} permission groups")

    if await db[WebhookConfigModel.collection_name].count_documents({}) == 0:
        await db[WebhookConfigModel.collection_name].insert_one(
            WebhookConfigModel.create_document(url=_WEBHOOK["url"], signing_secret=_WEBHOOK["signing_secret"])
        )
        print("🌱 Seeded webhook config")
