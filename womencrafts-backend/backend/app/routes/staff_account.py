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

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel

from app.core import cache
from app.core.audit import record
from app.core.deps import get_current_user
from app.core.permissions import require_permission
from app.core.rbac import (
    MEMBER_ROLE,
    current_user_modules,
    modules_for_role,
    require_staff,
    role_name,
)
from app.core.security import (
    decode_access_token,
    hash_password,
    hash_password_async,
    token_version_of,
    verify_password,
    verify_password_async,
)
from app.core.session import COOKIE_NAME, clear_session_cookie, set_session_cookie
from app.core.media import media_url
from app.db.mongodb import get_database
from app.models.role import RoleModel
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


# The platform's configuration is NOT the caller's own account. It used to sit
# behind `require_staff` alone, which meant a Viewer could rename the
# organisation; it now needs the settings module's own permissions.
@router.get(
    "/settings", response_model=PlatformSettings, summary="Platform settings",
    dependencies=[Depends(require_permission("settings.view"))],
)
async def get_settings(_: dict = Depends(require_staff)):
    return PlatformSettings(**PlatformSettingsModel.to_response(await _load_settings()))


@router.put(
    "/settings", response_model=PlatformSettings, summary="Update platform settings",
    dependencies=[Depends(require_permission("settings.edit"))],
)
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
    changed = sorted(k for k in updates if k != "updated_at")
    await record(
        me, "settings.platform", target=PlatformSettingsModel.SINGLETON,
        detail="Changed " + ", ".join(changed), request=request,
    )
    return PlatformSettings(**PlatformSettingsModel.to_response(doc))


@router.get(
    "/settings/health", response_model=list[SystemHealthItem], summary="System health",
    dependencies=[Depends(require_permission("settings.view"))],
)
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
        # Her record is cached per request for a few seconds; without this the
        # shell kept showing the old name until the TTL ran out.
        cache.forget_user(str(me["_id"]))
        changed = sorted(k for k in updates if k != "updated_at")
        if changed == ["avatar"]:
            action = "settings.avatar_remove" if not updates["avatar"] else "settings.avatar"
        else:
            action = "settings.profile"
        await record(
            me, action, target=str(me["_id"]),
            detail="Changed " + ", ".join(changed), request=request,
        )
    else:
        fresh = await _users().find_one({"_id": me["_id"]})
    return await my_profile(fresh)


class PasswordChanged(BaseModel):
    message: str
    #: True when every OTHER session was ended by the change (always, now).
    other_sessions_ended: bool
    #: A fresh token for the device that made the change. The browser gets it
    #: as the cookie; this is for header-based clients whose old token has
    #: just stopped working.
    access_token: str


@router.post("/profile/password", response_model=PasswordChanged, summary="Change my password")
async def change_password(
    body: dict, request: Request, response: Response, me: dict = Depends(require_staff)
):
    """
    Set a new password, and end every other session on the account.

    Changing the password used to leave every existing session running — the
    one thing a woman does when she suspects somebody else is in her account
    did nothing about that somebody. Bumping `token_version` ends them all;
    this device is then re-issued a token under the new version so she is not
    thrown out of the screen she is standing on.
    """
    from app.routes.auth import _token_for  # local: auth imports a lot

    current = (body or {}).get("current_password") or ""
    new = (body or {}).get("new_password") or ""
    if len(new) < 8:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Use at least 8 characters")
    if not await verify_password_async(current, me.get("hashed_password", "")):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your current password is not right")
    if await verify_password_async(new, me.get("hashed_password", "")):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That's the same as your current password")

    now = datetime.now(timezone.utc)
    fresh = await _users().find_one_and_update(
        {"_id": me["_id"]},
        {
            "$set": {
                "hashed_password": await hash_password_async(new),
                "password_changed_at": now,
                "updated_at": now,
            },
            "$inc": {"token_version": 1},
        },
        return_document=True,
    )
    cache.forget_user(str(me["_id"]))
    token = _token_for(fresh)
    set_session_cookie(response, token)
    await record(
        me, "settings.password", target=str(me["_id"]),
        detail="Changed own password; every other session was ended", request=request,
    )
    return PasswordChanged(
        message="Password changed. Every other session on this account has been signed out.",
        other_sessions_ended=True,
        access_token=token,
    )


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
    on = sum(1 for c in channels.values() for v in c.values() if v)
    await record(
        me, "settings.notification_prefs", target=str(me["_id"]),
        detail=f"{on} channel switches on across {len(channels)} events; quiet hours "
               + ("on" if (body.quiet_hours or {}).get("enabled") else "off"),
        request=request,
    )
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


# ─────────────────────────────────────────────────────────────────────────────
# My account — the facts the Settings screens used to invent.
#
# Everything below is scoped to the caller. There is no id in any path and no
# way to ask about somebody else, which is why `require_staff` is the right
# guard rather than a module permission: every staff role owns her own account.
# ─────────────────────────────────────────────────────────────────────────────

def _iso(value) -> str:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()
    return ""


def _session_token(request: Request) -> str:
    header = request.headers.get("authorization", "")
    if header.lower().startswith("bearer "):
        return header[7:].strip()
    return request.cookies.get(COOKIE_NAME, "")


class ThisSession(BaseModel):
    #: When the token this request arrived with was minted (sign-in, or the
    #: last silent refresh), and when it lapses if she stops using the app.
    started_at: str
    expires_at: str
    #: The session generation the token belongs to. Behind the account's
    #: generation means it has already been ended.
    generation: int


class Origin(BaseModel):
    """One address this account has acted from, taken from the audit trail."""
    ip: str
    first_seen: str
    last_seen: str
    actions: int


class ActivitySummary(BaseModel):
    total: int
    this_month: int
    last_at: str


class TwoFactor(BaseModel):
    available: bool
    enabled: bool
    note: str


class MyAccount(BaseModel):
    id: str
    full_name: str
    email: str
    phone: str
    avatar: str
    role: str
    is_active: bool
    modules: list[str]
    created_at: str
    last_login_at: str
    password_changed_at: str
    #: How many times every session has been ended (a password change or
    #: "sign out everywhere"). The account's current session generation.
    token_version: int
    sessions_ended_at: str
    #: Failed attempts since the last successful sign-in.
    failed_logins: int
    locked_until: str
    two_factor: TwoFactor
    this_session: ThisSession
    #: Sign-in records the time, not the device — so there is no per-device
    #: list to show, and this says so rather than showing an invented one.
    devices_recorded: bool
    devices_note: str
    origins: list[Origin]
    activity: ActivitySummary
    tickets_open: int
    #: Notification preferences are stored, but nothing sends staff
    #: notifications by channel yet — see `/notifications/defaults`.
    prefs_applied: bool


_TWO_FACTOR_NOTE = (
    "Two-factor sign-in is not available yet. There is no authenticator "
    "library installed on the server, so there is nothing here to switch on."
)

_DEVICES_NOTE = (
    "Signing in records when it happened, not which device it happened on, "
    "so there is no per-device list yet. What you can do is end every "
    "session on every device at once."
)


async def _origins(uid: str, limit: int = 10) -> list[Origin]:
    rows = await _activity().aggregate([
        {"$match": {"user_id": uid, "ip": {"$nin": ["", None]}}},
        {"$group": {
            "_id": "$ip",
            "first": {"$min": "$created_at"},
            "last": {"$max": "$created_at"},
            "n": {"$sum": 1},
        }},
        {"$sort": {"last": -1}},
        {"$limit": limit},
    ]).to_list(limit)
    return [
        Origin(ip=r["_id"], first_seen=_iso(r["first"]), last_seen=_iso(r["last"]), actions=r["n"])
        for r in rows
    ]


@router.get("/me/account", response_model=MyAccount, summary="The facts about my own account")
async def my_account(request: Request, me: dict = Depends(require_staff)):
    uid = str(me["_id"])
    # Read the row, not the cached copy: this screen is where she checks that
    # a change she just made took, and a stale answer here is the wrong one.
    doc = await _users().find_one({"_id": me["_id"]}) or me

    payload = decode_access_token(_session_token(request)) or {}
    started = payload.get("iat")
    expires = payload.get("exp")
    this_session = ThisSession(
        started_at=_iso(datetime.fromtimestamp(started, tz=timezone.utc)) if started else "",
        expires_at=_iso(datetime.fromtimestamp(expires, tz=timezone.utc)) if expires else "",
        generation=int(payload.get("tv") or 0),
    )

    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last = await _activity().find_one({"user_id": uid}, sort=[("created_at", -1)])
    activity = ActivitySummary(
        total=await _activity().count_documents({"user_id": uid}),
        this_month=await _activity().count_documents({"user_id": uid, "created_at": {"$gte": month_start}}),
        last_at=_iso((last or {}).get("created_at")),
    )

    return MyAccount(
        id=uid,
        full_name=doc.get("full_name", ""),
        email=doc.get("email", ""),
        phone=doc.get("phone", "") or "",
        avatar=media_url(doc.get("avatar", "") or ""),
        role=role_name(doc),
        is_active=bool(doc.get("is_active", True)),
        modules=await current_user_modules(doc),
        created_at=_iso(doc.get("created_at")),
        last_login_at=_iso(doc.get("last_login_at")),
        password_changed_at=_iso(doc.get("password_changed_at")),
        token_version=token_version_of(doc),
        sessions_ended_at=_iso(doc.get("sessions_ended_at")),
        failed_logins=int(doc.get("failed_logins") or 0),
        locked_until=_iso(doc.get("locked_until")),
        two_factor=TwoFactor(available=False, enabled=False, note=_TWO_FACTOR_NOTE),
        this_session=this_session,
        devices_recorded=False,
        devices_note=_DEVICES_NOTE,
        origins=await _origins(uid),
        activity=activity,
        tickets_open=await _tickets().count_documents(
            {"user_id": uid, "status": {"$ne": SupportTicketModel.STATUS_RESOLVED}}
        ),
        prefs_applied=False,
    )


class SessionsEnded(BaseModel):
    message: str
    #: The account's new session generation.
    generation: int


@router.post(
    "/me/sign-out-everywhere", response_model=SessionsEnded,
    summary="End every session on every device, including this one",
)
async def sign_out_everywhere(request: Request, response: Response, me: dict = Depends(require_staff)):
    """
    The same switch `/auth/signout-everywhere` throws, with two things that
    one lacks: an audit line naming who threw it, and a record on the account
    of when, so the Sessions screen can show it.

    Her CURRENT session ends too. That is the honest reading of "everywhere":
    a control that spares the device you are holding cannot be trusted when
    the device you are holding is the problem.
    """
    now = datetime.now(timezone.utc)
    fresh = await _users().find_one_and_update(
        {"_id": me["_id"]},
        {"$inc": {"token_version": 1}, "$set": {"sessions_ended_at": now, "updated_at": now}},
        return_document=True,
    )
    cache.forget_user(str(me["_id"]))
    await record(
        me, "settings.sign_out_everywhere", target=str(me["_id"]),
        detail="Ended every session on every device", request=request,
    )
    clear_session_cookie(response)
    return SessionsEnded(
        message="Every session has been ended. Sign in again to carry on.",
        generation=token_version_of(fresh or {}),
    )


# --- the role I hold ---------------------------------------------------------

class RoleSummary(BaseModel):
    name: str
    desc: str
    status: str
    modules: list[str]
    is_mine: bool


class MyRoles(BaseModel):
    current: RoleSummary
    #: Always False on this platform: an account holds exactly one role, and
    #: only a Super Admin can change it, from Staff. Sent explicitly so the
    #: screen says that rather than offering a switch that does nothing.
    holds_multiple: bool
    can_switch: bool
    note: str
    roles: list[RoleSummary]
    all_modules: list[str]


_ROLE_NOTE = (
    "Your account holds one role. Switching between roles is not something this "
    "platform does: an account has exactly one role, and only a Super Admin can "
    "change it, from Staff."
)


@router.get("/me/roles", response_model=MyRoles, summary="My role, and what each role can open")
async def my_roles(me: dict = Depends(require_staff)):
    from app.core.rbac import ALL_MODULES

    mine = role_name(me)
    roles: list[RoleSummary] = []
    async for r in get_database()[RoleModel.collection_name].find({}).sort("name", 1):
        name = r.get("name", "")
        if not name or name == MEMBER_ROLE:
            continue
        roles.append(RoleSummary(
            name=name,
            desc=r.get("desc", ""),
            status=r.get("status", "Active"),
            modules=await modules_for_role(name),
            is_mine=(name == mine),
        ))
    current = next((r for r in roles if r.is_mine), None) or RoleSummary(
        name=mine, desc="", status="Active", modules=await modules_for_role(mine), is_mine=True,
    )
    # Her actual access may be narrower or wider than her role's default.
    current = current.model_copy(update={"modules": await current_user_modules(me)})
    return MyRoles(
        current=current,
        holds_multiple=False,
        can_switch=False,
        note=_ROLE_NOTE,
        roles=roles,
        all_modules=list(ALL_MODULES),
    )


# --- notification defaults ---------------------------------------------------

class NotificationDefaults(BaseModel):
    rows: list[dict]
    quiet_hours: dict
    #: Nothing reads these preferences when a notification is sent — there is
    #: no staff notification sender yet. Stored, not applied.
    applied: bool
    applied_note: str


_PREFS_NOTE = (
    "These choices are saved to your account, but nothing sends staff "
    "notifications by email, SMS or push yet — so they are stored, not applied. "
    "In-app notices are the only channel that exists today."
)


@router.get(
    "/notifications/defaults", response_model=NotificationDefaults,
    summary="The starting preferences, and whether they are applied",
)
async def notification_defaults(_: dict = Depends(require_staff)):
    fresh = StaffNotificationPrefsModel.to_response(None, "")
    return NotificationDefaults(
        rows=fresh["rows"], quiet_hours=fresh["quiet_hours"],
        applied=False, applied_note=_PREFS_NOTE,
    )
