"""
The staff member's own account, and the platform's settings.

These endpoints back the six admin screens that previously had no server side at
all — they rendered fixed arrays and their Save buttons did nothing.

`log_activity` lives here and is imported by the other routers. It is
deliberately best-effort: an audit write that fails must never roll back the
action it was recording, because losing the action is worse than losing the note
about it.
"""

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.core.deps import get_current_user
from app.core.rbac import current_user_modules, require_staff
from app.core.security import hash_password, verify_password, hash_password_async, verify_password_async
from app.core.media import media_url
from app.db.mongodb import get_database
from app.models.staff import (
    ActivityLogModel,
    PlatformSettingsModel,
    StaffNotificationPrefsModel,
    SupportTicketModel,
)
from app.models.user import UserModel
from app.schemas.me import MessageResponse
from app.schemas.staff import (
    ActivityItem,
    ActivityOverview,
    PlatformSettings,
    PlatformSettingsUpdate,
    StaffNotificationPrefs,
    StaffNotificationPrefsUpdate,
    StaffProfile,
    StaffProfileUpdate,
    StaffStats,
    SystemHealthItem,
    Ticket,
    TicketCreate,
)

router = APIRouter(prefix="/staff", tags=["Staff · Account"])


def _settings():
    return get_database()[PlatformSettingsModel.collection_name]


def _prefs():
    return get_database()[StaffNotificationPrefsModel.collection_name]


def _activity():
    return get_database()[ActivityLogModel.collection_name]


def _tickets():
    return get_database()[SupportTicketModel.collection_name]


def _users():
    return get_database()[UserModel.collection_name]


async def log_activity(
    user: dict,
    action: str,
    category: str = "Settings",
    target: str = "",
    detail: str = "",
    request: Request | None = None,
) -> None:
    """
    Record a staff action. Never raises — see the module docstring.

    Other routers import this; it is the single way anything gets into the
    audit trail.
    """
    try:
        ip = ""
        if request is not None and request.client:
            ip = request.client.host or ""
        await _activity().insert_one(
            ActivityLogModel.create_document(
                user_id=str(user.get("_id", "")),
                user_name=user.get("full_name", ""),
                action=action,
                category=category,
                target=target,
                detail=detail,
                ip=ip,
            )
        )
    except Exception as exc:  # noqa: BLE001
        print(f"⚠️  Could not write activity log: {exc}")


# --- platform settings -------------------------------------------------------

async def _load_settings() -> dict:
    doc = await _settings().find_one({"_key": PlatformSettingsModel.SINGLETON})
    if not doc:
        doc = PlatformSettingsModel.defaults()
        await _settings().insert_one(doc)
    return doc


@router.get("/settings", response_model=PlatformSettings, summary="Platform settings")
async def get_settings(_: dict = Depends(require_staff)):
    return PlatformSettings(**PlatformSettingsModel.to_response(await _load_settings()))


@router.put("/settings", response_model=PlatformSettings, summary="Update platform settings")
async def update_settings(
    body: PlatformSettingsUpdate,
    request: Request,
    me: dict = Depends(require_staff),
):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        return PlatformSettings(**PlatformSettingsModel.to_response(await _load_settings()))

    await _load_settings()  # make sure the singleton exists before updating it
    updates["updated_at"] = datetime.now(timezone.utc)
    doc = await _settings().find_one_and_update(
        {"_key": PlatformSettingsModel.SINGLETON}, {"$set": updates}, return_document=True
    )
    await log_activity(
        me, "Updated platform settings", "Settings",
        detail=", ".join(sorted(k for k in updates if k != "updated_at")),
        request=request,
    )
    return PlatformSettings(**PlatformSettingsModel.to_response(doc))


@router.get("/settings/health", response_model=list[SystemHealthItem], summary="System health")
async def system_health(_: dict = Depends(require_staff)):
    """
    Real checks, not a row of green ticks.

    Anything we cannot genuinely verify reports what it actually is — a service
    that is not configured says so rather than claiming to be healthy.
    """
    from app.core.config import settings as cfg

    db = get_database()
    items: list[SystemHealthItem] = []

    try:
        await db.command("ping")
        names = await db.list_collection_names()
        items.append(SystemHealthItem(name="Database", status="ok", detail=f"{len(names)} collections"))
    except Exception as exc:  # noqa: BLE001
        items.append(SystemHealthItem(name="Database", status="down", detail=str(exc)[:80]))

    items.append(SystemHealthItem(name="API", status="ok", detail="Responding"))

    import os
    from app.routes.uploads import MEDIA_ROOT

    try:
        n = sum(len(files) for _r, _d, files in os.walk(MEDIA_ROOT))
        items.append(SystemHealthItem(name="Storage", status="ok", detail=f"{n} files"))
    except Exception:  # noqa: BLE001
        items.append(SystemHealthItem(name="Storage", status="degraded", detail="Cannot read media directory"))

    items.append(
        SystemHealthItem(
            name="Email",
            status="ok" if cfg.SMTP_HOST else "degraded",
            detail="SMTP configured" if cfg.SMTP_HOST else "Writing to outbox/ (no SMTP host set)",
        )
    )
    items.append(
        SystemHealthItem(
            name="Payments",
            status="ok" if cfg.PAYMENT_PROVIDER != "sandbox" else "degraded",
            detail=f"Provider: {cfg.PAYMENT_PROVIDER}",
        )
    )
    items.append(
        SystemHealthItem(
            name="AI (Sakhi)",
            status="ok" if cfg.ANTHROPIC_API_KEY else "degraded",
            detail="Key configured" if cfg.ANTHROPIC_API_KEY else "No API key set",
        )
    )
    return items


# --- my profile --------------------------------------------------------------

@router.get("/profile", response_model=StaffProfile, summary="My staff profile")
async def my_profile(me: dict = Depends(require_staff)):
    created = me.get("created_at")
    last = await _activity().find_one({"user_id": str(me["_id"])}, sort=[("created_at", -1)])
    last_at = (last or {}).get("created_at")
    return StaffProfile(
        id=str(me["_id"]),
        full_name=me.get("full_name", ""),
        email=me.get("email", ""),
        phone=me.get("phone", ""),
        avatar=media_url(me.get("avatar", "")),
        role=me.get("role", ""),
        modules=await current_user_modules(me),
        created_at=created.strftime("%b %d, %Y") if isinstance(created, datetime) else "",
        last_active=last_at.strftime("%b %d, %Y · %I:%M %p") if isinstance(last_at, datetime) else "",
    )


@router.put("/profile", response_model=StaffProfile, summary="Update my staff profile")
async def update_my_profile(
    body: StaffProfileUpdate, request: Request, me: dict = Depends(require_staff)
):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc)
        # The write hands back the updated document, so the re-read that used
        # to follow it is gone. A PATCH that changed nothing still has to
        # answer with her profile, which is what the `else` is for.
        fresh = await _users().find_one_and_update(
            {"_id": me["_id"]}, {"$set": updates}, return_document=True,
        )
        await log_activity(me, "Updated own profile", "Settings", request=request)
    else:
        fresh = await _users().find_one({"_id": me["_id"]})
    return await my_profile(fresh)


@router.post("/profile/password", response_model=MessageResponse, summary="Change my password")
async def change_password(
    body: dict, request: Request, me: dict = Depends(require_staff)
):
    current = (body or {}).get("current_password") or ""
    new = (body or {}).get("new_password") or ""
    if len(new) < 8:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Use at least 8 characters")
    if not await verify_password_async(current, me.get("hashed_password", "")):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your current password is not right")
    if await verify_password_async(new, me.get("hashed_password", "")):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That's the same as your current password")

    await _users().update_one(
        {"_id": me["_id"]},
        {"$set": {"hashed_password": await hash_password_async(new), "updated_at": datetime.now(timezone.utc)}},
    )
    await log_activity(me, "Changed own password", "Settings", request=request)
    return {"message": "Password changed"}


@router.get("/profile/stats", response_model=StaffStats, summary="My activity tiles")
async def my_stats(me: dict = Depends(require_staff)):
    uid = str(me["_id"])
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    db = get_database()

    return StaffStats(
        logins_this_month=await db["user_sessions"].count_documents(
            {"user_id": uid, "created_at": {"$gte": month_start}}
        )
        if "user_sessions" in await db.list_collection_names()
        else 0,
        actions_performed=await _activity().count_documents({"user_id": uid}),
        members_managed=await _users().count_documents({"role": "Member"}),
        content_published=await db["content"].count_documents({"status": "Published"})
        if "content" in await db.list_collection_names()
        else 0,
        reports_generated=await db["reports"].count_documents({})
        if "reports" in await db.list_collection_names()
        else 0,
    )


# --- notification preferences ------------------------------------------------

@router.get(
    "/notifications", response_model=StaffNotificationPrefs, summary="My notification settings"
)
async def get_prefs(me: dict = Depends(require_staff)):
    doc = await _prefs().find_one({"user_id": str(me["_id"])})
    return StaffNotificationPrefsModel.to_response(doc, str(me["_id"]))


@router.put(
    "/notifications", response_model=StaffNotificationPrefs, summary="Update notification settings"
)
async def update_prefs(
    body: StaffNotificationPrefsUpdate, request: Request, me: dict = Depends(require_staff)
):
    known = {k for k, *_ in StaffNotificationPrefsModel.EVENTS}
    channels = {
        r.key: {"email": r.email, "sms": r.sms, "push": r.push, "in_app": r.in_app}
        for r in body.rows
        if r.key in known
    }
    doc = await _prefs().find_one_and_update(
        {"user_id": str(me["_id"])},
        {
            "$set": {
                "channels": channels,
                "quiet_hours": body.quiet_hours or StaffNotificationPrefsModel.QUIET_DEFAULT,
                "updated_at": datetime.now(timezone.utc),
            },
            "$setOnInsert": {"user_id": str(me["_id"]), "created_at": datetime.now(timezone.utc)},
        },
        upsert=True,
        return_document=True,
    )
    await log_activity(me, "Updated notification preferences", "Settings", request=request)
    return StaffNotificationPrefsModel.to_response(doc, str(me["_id"]))


# --- activity ----------------------------------------------------------------

@router.get("/activity", response_model=list[ActivityItem], summary="Activity log")
async def activity(
    mine: bool = Query(True, description="Only my own actions"),
    category: str = Query("", max_length=40),
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(100, ge=1, le=500),
    me: dict = Depends(require_staff),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    query: dict = {"created_at": {"$gte": since}}
    if mine:
        query["user_id"] = str(me["_id"])
    if category:
        query["category"] = category
    docs = await _activity().find(query).sort("created_at", -1).to_list(limit)
    return [ActivityLogModel.to_response(d) for d in docs]


@router.get("/activity/overview", response_model=ActivityOverview, summary="Activity charts")
async def activity_overview(
    mine: bool = Query(True),
    days: int = Query(8, ge=1, le=90),
    me: dict = Depends(require_staff),
):
    """Both charts on the activity screen, aggregated in the database."""
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days - 1)
    since = since.replace(hour=0, minute=0, second=0, microsecond=0)

    base: dict = {}
    if mine:
        base["user_id"] = str(me["_id"])

    day_rows = await _activity().aggregate([
        {"$match": {**base, "created_at": {"$gte": since}}},
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                    "n": {"$sum": 1}}},
    ]).to_list(400)
    per_day = {r["_id"]: r["n"] for r in day_rows}

    timeline = []
    for i in range(days):
        d = (since + timedelta(days=i)).date()
        timeline.append({"label": d.strftime("%b %d"), "value": per_day.get(d.isoformat(), 0)})

    cat_rows = await _activity().aggregate([
        {"$match": {**base, "created_at": {"$gte": since}}},
        {"$group": {"_id": "$category", "n": {"$sum": 1}}},
        {"$sort": {"n": -1}},
    ]).to_list(50)
    total_cat = sum(r["n"] for r in cat_rows) or 1
    breakdown = [
        {"name": r["_id"] or "Other", "value": r["n"], "pct": f"{r['n'] / total_cat * 100:.1f}%"}
        for r in cat_rows
    ]

    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    return ActivityOverview(
        total=await _activity().count_documents(base),
        today=await _activity().count_documents({**base, "created_at": {"$gte": today_start}}),
        this_week=await _activity().count_documents({**base, "created_at": {"$gte": week_start}}),
        timeline=timeline,
        breakdown=breakdown,
    )


# --- support tickets ---------------------------------------------------------

@router.get("/support", response_model=list[Ticket], summary="My support tickets")
async def my_tickets(me: dict = Depends(require_staff)):
    docs = await _tickets().find({"user_id": str(me["_id"])}).sort("created_at", -1).to_list(100)
    return [SupportTicketModel.to_response(d) for d in docs]


@router.post(
    "/support",
    response_model=Ticket,
    status_code=status.HTTP_201_CREATED,
    summary="Raise a support ticket",
)
async def raise_ticket(body: TicketCreate, request: Request, me: dict = Depends(require_staff)):
    if body.category not in SupportTicketModel.CATEGORIES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choose one of the listed categories")

    count = await _tickets().count_documents({})
    doc = SupportTicketModel.create_document(
        user_id=str(me["_id"]),
        user_name=me.get("full_name", ""),
        user_email=me.get("email", ""),
        subject=body.subject,
        message=body.message,
        category=body.category,
        priority=body.priority,
        reference=SupportTicketModel.make_reference(count),
    )
    result = await _tickets().insert_one(doc)
    doc["_id"] = result.inserted_id
    await log_activity(
        me, "Raised a support ticket", "Settings", target=doc["reference"], request=request
    )
    return SupportTicketModel.to_response(doc)
