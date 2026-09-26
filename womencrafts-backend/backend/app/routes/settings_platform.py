"""
Platform settings — the parts of Settings that describe the installation itself.

One parent router, several prefixes, because main.py includes this single
`router` behind the `settings` module guard and a new file would need a
main.py edit:

  /integrations      what this process can actually reach: email, storage,
                     payments, SMS, WhatsApp, AI, push, speech, tracing —
                     each read from the configuration it runs with
  /activity-log      the audit trail, filtered and paged server-side
  /platform-logs     the platform-level slice of that trail (backups,
                     restores, schedule and organisation changes)
  /support-tickets   the inbox for tickets staff raise, and the contact
                     details shown on the support screen
  /permissions       the permission groups the Roles screen reads — untouched

── Integrations used to be eight seeded rows ──────────────────────────────
"Stripe · Connected · Last synced 10 mins ago", a Slack toggle, a webhook
signing secret typed into a seed file. Connecting one wrote a caption to a
document; nothing anywhere read it. That is gone. An integration here is a
real adapter in `app/core` and its status is whether the process holds what
that adapter needs — never a secret, only whether one is set.

── Logs: there is no system log in the database ───────────────────────────
Process output goes to stdout and, in production, to Cloud Run's logging.
The seeded `system_logs` fixture ("May 20 10:32:14 · auth · Info") was a
picture of one. The logs screen now shows the platform-level events from the
audit trail and says plainly where the process log lives.
"""

import csv
import html
import io
import statistics
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status

from app.core import mongosafe
from app.core.audit import record
from app.core.config import settings
from app.core.deps import get_current_user
from app.core.email import EmailMessageSpec, _wrap, can_deliver, get_provider, is_sandbox_domain, send
from app.core.permissions import require_permission
from app.core.serializers import page_meta, to_object_id
from app.db.mongodb import get_database
from app.models.integration import PermissionGroupModel
from app.models.staff import ActivityLogModel, PlatformSettingsModel, SupportTicketModel
from app.routes._paging import paged
from app.routes.billing import _measure, _size_label
from app.schemas.integration import PermissionGroupsResponse, PermissionStatsResponse
from app.schemas.settings_platform_admin import (
    ActivityActor,
    ActivityPage,
    ActivityPoint,
    ActivityRow,
    ActivitySlice,
    ActivitySummary,
    ActivityTopAction,
    Adapter,
    AdapterDetail,
    AdapterList,
    EmailTestResult,
    PlatformEvent,
    PlatformEventPage,
    PlatformLogSummary,
    SupportContact,
    TicketAdmin,
    TicketPage,
    TicketReplyIn,
    TicketReplyOut,
    TicketReplyResult,
    TicketStatusIn,
    TicketSummary,
)

router = APIRouter(tags=["Settings"])
integrations_router = APIRouter(prefix="/integrations", tags=["Settings"])
activity_router = APIRouter(prefix="/activity-log", tags=["Settings"])
logs_router = APIRouter(prefix="/platform-logs", tags=["Settings"])
support_router = APIRouter(prefix="/support-tickets", tags=["Settings"])
permissions_router = APIRouter(prefix="/permissions", tags=["Settings"])


def _activity():
    return get_database()[ActivityLogModel.collection_name]


def _tickets():
    return get_database()[SupportTicketModel.collection_name]


def _permission_groups():
    return get_database()[PermissionGroupModel.collection_name]


def _platform_settings():
    return get_database()[PlatformSettingsModel.collection_name]


def _iso(value) -> str:
    return value.isoformat() if isinstance(value, datetime) else ""


def _when(value) -> str:
    return value.strftime("%b %d, %Y · %I:%M %p") if isinstance(value, datetime) else ""


def _set(value: str) -> bool:
    return bool((value or "").strip())


# =============================================================================
# Integrations — real adapters only
# =============================================================================

def _adapters() -> list[Adapter]:
    items: list[Adapter] = []

    # --- email -----------------------------------------------------------
    provider = get_provider().name
    if provider == "mailgun":
        if is_sandbox_domain():
            email_status = "sandbox"
            summary = (
                "Mailgun is configured against a sandbox domain, which delivers only to addresses "
                "added by hand in the Mailgun dashboard. For everyone else this is the same as not sending."
            )
        else:
            email_status = "configured"
            summary = "Mailgun is configured on a verified domain; messages leave this server."
    elif provider == "smtp":
        email_status = "configured"
        summary = f"SMTP via {settings.SMTP_HOST}; messages leave this server."
    else:
        email_status = "not_configured"
        summary = (
            "No email provider is configured. Messages are written to the server's outbox/ folder "
            "and nobody receives them."
        )
    items.append(Adapter(
        key="email", name="Email", category="Messaging", status=email_status, summary=summary,
        details=[
            AdapterDetail(label="Provider", value=provider),
            AdapterDetail(label="From", value=f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM}>"),
            AdapterDetail(label="Delivers to real addresses", value="Yes" if can_deliver() else "No"),
            AdapterDetail(label="Test mode", value="On" if settings.EMAIL_TEST_MODE else "Off"),
        ],
        can_test=can_deliver(),
    ))

    # --- file storage ----------------------------------------------------
    public_bytes, public_files = _measure(settings.MEDIA_DIR)
    private_bytes, private_files = _measure(settings.PRIVATE_MEDIA_DIR)
    items.append(Adapter(
        key="storage", name="File storage", category="Storage", status="configured",
        summary="Uploads and private documents live on this server's disk. No cloud bucket is configured.",
        details=[
            AdapterDetail(label="Public media", value=f"{_size_label(public_bytes)} in {public_files} files"),
            AdapterDetail(label="Private documents", value=f"{_size_label(private_bytes)} in {private_files} files"),
            AdapterDetail(label="Max upload", value=f"{settings.MAX_UPLOAD_MB} MB (documents {settings.MAX_DOCUMENT_MB} MB)"),
            AdapterDetail(label="Document encryption key", value="Set" if _set(settings.DOCUMENT_ENCRYPTION_KEY) else "Not set"),
        ],
    ))

    # --- payments --------------------------------------------------------
    pay = (settings.PAYMENT_PROVIDER or "sandbox").strip().lower()
    if pay == "razorpay":
        keyed = _set(settings.RAZORPAY_KEY_ID) and _set(settings.RAZORPAY_KEY_SECRET)
        pay_status = "configured" if keyed else "not_configured"
        pay_summary = "Razorpay keys are set." if keyed else "Provider is Razorpay but its keys are missing."
    elif pay == "stripe":
        keyed = _set(settings.STRIPE_SECRET_KEY)
        pay_status = "configured" if keyed else "not_configured"
        pay_summary = "Stripe key is set." if keyed else "Provider is Stripe but its key is missing."
    else:
        pay_status = "sandbox"
        pay_summary = "Payments run in sandbox mode: no real money moves. WomSakhi holds no money on anyone's behalf."
    items.append(Adapter(
        key="payments", name="Payments", category="Payments", status=pay_status, summary=pay_summary,
        details=[
            AdapterDetail(label="Provider", value=pay),
            AdapterDetail(label="Enabled", value="Yes" if settings.PAYMENTS_ENABLED else "No"),
            AdapterDetail(label="Currency", value=settings.PAYMENT_CURRENCY),
            AdapterDetail(label="Webhook secret", value="Default (change it)" if settings.PAYMENT_WEBHOOK_SECRET.startswith("dev-") else "Set"),
        ],
    ))

    # --- SMS / WhatsApp ----------------------------------------------------
    sms = (settings.SMS_PROVIDER or "").strip().lower()
    sms_ok = bool(sms) and _set(settings.SMS_ACCOUNT_SID) and _set(settings.SMS_AUTH_TOKEN)
    items.append(Adapter(
        key="sms", name="SMS", category="Messaging",
        status="configured" if sms_ok else "not_configured",
        summary=f"{sms} is configured." if sms_ok else "No SMS provider is configured; nothing is sent by text.",
        details=[
            AdapterDetail(label="Provider", value=sms or "none"),
            AdapterDetail(label="Sender", value=settings.SMS_FROM or "not set"),
        ],
    ))
    wa = (settings.WHATSAPP_PROVIDER or "").strip().lower()
    wa_ok = bool(wa) and _set(settings.WHATSAPP_PHONE_ID) and _set(settings.WHATSAPP_TOKEN)
    items.append(Adapter(
        key="whatsapp", name="WhatsApp", category="Messaging",
        status="configured" if wa_ok else "not_configured",
        summary=f"{wa} is configured." if wa_ok else "No WhatsApp provider is configured; nothing is sent on WhatsApp.",
        details=[AdapterDetail(label="Provider", value=wa or "none")],
    ))

    # --- AI ----------------------------------------------------------------
    ai_ok = _set(settings.ANTHROPIC_API_KEY)
    items.append(Adapter(
        key="ai", name="AI (Claude)", category="AI",
        status="configured" if ai_ok else "not_configured",
        summary="The API key is set; the assistant can answer." if ai_ok else "No API key; the assistant cannot answer.",
        details=[
            AdapterDetail(label="Chat model", value=settings.AI_MODEL_CHAT),
            AdapterDetail(label="Reasoning model", value=settings.AI_MODEL_REASONING),
            AdapterDetail(label="Monthly budget", value=f"USD {settings.AI_MONTHLY_BUDGET_USD:.0f}"),
        ],
    ))

    # --- push / speech / tracing / cache / engines -------------------------
    push_ok = _set(settings.VAPID_PUBLIC_KEY) and _set(settings.VAPID_PRIVATE_KEY)
    items.append(Adapter(
        key="push", name="Web push", category="Messaging",
        status="configured" if push_ok else "not_configured",
        summary="VAPID keys are set; browsers can be notified." if push_ok else "No VAPID keys; no push notifications.",
        details=[AdapterDetail(label="Subject", value=settings.VAPID_SUBJECT)],
    ))
    speech_ok = _set(settings.AZURE_SPEECH_KEY)
    items.append(Adapter(
        key="speech", name="Speech (Azure)", category="AI",
        status="configured" if speech_ok else "not_configured",
        summary="Azure Speech key is set." if speech_ok else "No Azure Speech key; voice features are off.",
        details=[AdapterDetail(label="Region", value=settings.AZURE_SPEECH_REGION)],
    ))
    trace_ok = _set(settings.LANGFUSE_PUBLIC_KEY) and _set(settings.LANGFUSE_SECRET_KEY)
    items.append(Adapter(
        key="tracing", name="AI tracing (Langfuse)", category="Observability",
        status="configured" if trace_ok else "not_configured",
        summary="Langfuse keys are set; AI calls are traced." if trace_ok else "No Langfuse keys; AI calls are not traced.",
        details=[AdapterDetail(label="Host", value=settings.LANGFUSE_HOST), AdapterDetail(label="Environment", value=settings.LANGFUSE_ENV)],
    ))
    redis_ok = _set(settings.REDIS_URL)
    items.append(Adapter(
        key="redis", name="Redis", category="Infrastructure",
        status="configured" if redis_ok else "not_configured",
        summary="A Redis URL is set." if redis_ok else "No Redis; rate limits and caches are in-process only.",
        details=[AdapterDetail(label="Workers", value=str(settings.WORKERS))],
    ))
    items.append(Adapter(
        key="engines", name="Reminder engines", category="Infrastructure",
        status="configured" if settings.ENGINES_ENABLED else "not_configured",
        summary="The engine tick is enabled." if settings.ENGINES_ENABLED else "Engines are disabled; scheduled reminders do not run.",
        details=[AdapterDetail(label="Tick secret", value="Set" if _set(settings.ENGINES_TICK_SECRET) else "Not set")],
    ))

    # --- asked for, and honestly absent ------------------------------------
    for key, name, category in (
        ("slack", "Slack", "Team collaboration"),
        ("zapier", "Zapier", "Automation"),
        ("google_calendar", "Google Calendar", "Calendar"),
        ("zoom", "Zoom", "Video"),
        ("mailchimp", "Mailchimp", "Email marketing"),
    ):
        items.append(Adapter(
            key=key, name=name, category=category, status="not_available",
            summary="No adapter exists in this product. Nothing here can be connected.",
            details=[],
        ))
    return items


@integrations_router.get("", response_model=AdapterList, summary="What this process can reach",
    dependencies=[Depends(require_permission("settings.view"))],
)
async def list_integrations():
    items = _adapters()
    counts = {s: sum(1 for i in items if i.status == s) for s in ("configured", "sandbox", "not_configured", "not_available")}
    return AdapterList(items=items, checked_at=datetime.now(timezone.utc).isoformat(), **counts)


@integrations_router.post(
    "/email/test",
    response_model=EmailTestResult,
    summary="Send a test email to yourself",
    dependencies=[Depends(require_permission("settings.edit"))],
)
async def test_email(request: Request, me: dict = Depends(get_current_user)):
    """Sends to the caller's own address, and only when a real provider is in
    front of it. A test that "succeeds" into an outbox folder is the failure
    this product has already had once."""
    to = (me.get("email") or "").strip()
    if not to:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your account has no email address")
    if not can_deliver():
        return EmailTestResult(sent=False, to=to, message="Email is not configured to reach real addresses; nothing was sent.")
    stamp = datetime.now(timezone.utc).strftime("%d %b %Y %H:%M UTC")
    spec = EmailMessageSpec(
        to=to,
        subject="WomSakhi test message",
        html=_wrap(
            "Your email connection is working",
            f"<p>This test was sent from the WomSakhi admin dashboard on "
            f"<strong>{html.escape(stamp)}</strong>.</p>"
            "<p>Transactional messages can now reach members through the configured provider.</p>",
            "Open WomSakhi",
            settings.APP_BASE_URL.rstrip("/"),
            preheader="WomSakhi email delivery test completed successfully.",
            footer_note="This test was requested by an authorised WomSakhi administrator.",
            recipient_name=me.get("full_name", ""),
            title_accent="working",
            next_step="No action is required. Transactional email delivery is ready.",
        ),
        text=f"This is a test from the WomSakhi dashboard, sent {stamp}.",
    )
    sent = await send(spec, to)
    await record(
        me, "settings.integrations.email_test", target=to,
        detail=f"Test email to {to}: {'delivered to provider' if sent else 'provider refused it'}",
        request=request,
    )
    return EmailTestResult(
        sent=sent, to=to,
        message=f"Sent to {to}." if sent else "The provider refused the message; see the server log.",
    )


# =============================================================================
# Activity log — the audit trail, filtered where the data is
# =============================================================================

_MAX_SPAN_DAYS = 366


def _parse_day(value: Optional[str], *, end: bool = False) -> Optional[datetime]:
    """'YYYY-MM-DD' → an aware UTC datetime at the start (or end) of that day."""
    if not value:
        return None
    try:
        day = datetime.strptime(value.strip(), "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Dates are YYYY-MM-DD")
    return day + timedelta(days=1) if end else day


#: The default window when the screen does not name one. The client sets the
#: same default so the date inputs show what the server used.
DEFAULT_RANGE_DAYS = 90


def _range(date_from: Optional[str], date_to: Optional[str]) -> tuple[datetime, datetime]:
    """Default: the last 90 days. Never more than a year, so a summary cannot
    become a table scan by accident."""
    now = datetime.now(timezone.utc)
    end = _parse_day(date_to, end=True) or (now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1))
    start = _parse_day(date_from) or (end - timedelta(days=DEFAULT_RANGE_DAYS))
    if start >= end:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The range ends before it starts")
    if (end - start).days > _MAX_SPAN_DAYS:
        start = end - timedelta(days=_MAX_SPAN_DAYS)
    return start, end


def _activity_query(
    user_id: str, category: str, q: str, start: datetime, end: datetime, base: Optional[dict] = None,
) -> dict:
    query: dict = dict(base or {})
    query["created_at"] = {"$gte": start, "$lt": end}
    if user_id:
        query["user_id"] = user_id
    if category:
        query["category"] = category
    if q and q.strip():
        query.update(mongosafe.any_of(q.strip(), ["action", "detail", "target", "user_name", "ip"]))
    return query


def _activity_row(doc: dict) -> ActivityRow:
    base = ActivityLogModel.to_response(doc)
    return ActivityRow(user_id=str(doc.get("user_id", "") or ""), **base)


@activity_router.get("", response_model=ActivityPage, summary="Audit trail, paged",
    dependencies=[Depends(require_permission("settings.view"))],
)
async def activity_list(
    user_id: str = Query("", max_length=40),
    category: str = Query("", max_length=40),
    q: str = Query("", max_length=120),
    date_from: str = Query("", alias="from", max_length=10),
    date_to: str = Query("", alias="to", max_length=10),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
):
    start, end = _range(date_from, date_to)
    total, docs = await paged(
        _activity(), _activity_query(user_id, category, q, start, end),
        sort="created_at", direction=-1, page=page, page_size=page_size,
    )
    return ActivityPage(items=[_activity_row(d) for d in docs], **page_meta(total, page, page_size))


@activity_router.get("/summary", response_model=ActivitySummary, summary="Counts over the filtered rows",
    dependencies=[Depends(require_permission("settings.view"))],
)
async def activity_summary(
    user_id: str = Query("", max_length=40),
    category: str = Query("", max_length=40),
    q: str = Query("", max_length=120),
    date_from: str = Query("", alias="from", max_length=10),
    date_to: str = Query("", alias="to", max_length=10),
):
    start, end = _range(date_from, date_to)
    query = _activity_query(user_id, category, q, start, end)
    coll = _activity()
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    facets = await coll.aggregate([
        {"$match": query},
        {"$facet": {
            "total": [{"$count": "n"}],
            "today": [{"$match": {"created_at": {"$gte": today_start}}}, {"$count": "n"}],
            "week": [{"$match": {"created_at": {"$gte": today_start - timedelta(days=6)}}}, {"$count": "n"}],
            "actors": [{"$group": {"_id": "$user_id"}}, {"$count": "n"}],
            "by_category": [{"$group": {"_id": "$category", "n": {"$sum": 1}}}, {"$sort": {"n": -1}}],
            "by_day": [{"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}}, "n": {"$sum": 1}}}],
            "top_actions": [
                {"$group": {"_id": {"action": "$action", "category": "$category"}, "n": {"$sum": 1}}},
                {"$sort": {"n": -1}}, {"$limit": 6},
            ],
        }},
    ]).to_list(1)
    f = facets[0] if facets else {}

    def count(key: str) -> int:
        rows = f.get(key) or []
        return int(rows[0]["n"]) if rows else 0

    cat_rows = f.get("by_category") or []
    cat_total = sum(int(r["n"]) for r in cat_rows)
    by_category = [
        ActivitySlice(
            name=r["_id"] or "Other", value=int(r["n"]),
            pct=f"{int(r['n']) / cat_total * 100:.1f}%" if cat_total else "0%",
        )
        for r in cat_rows
    ]

    per_day = {r["_id"]: int(r["n"]) for r in (f.get("by_day") or [])}
    span_days = (end - start).days
    timeline: list[ActivityPoint] = []
    if span_days <= 92:
        for i in range(span_days):
            d = (start + timedelta(days=i)).date()
            timeline.append(ActivityPoint(label=d.strftime("%b %d"), value=per_day.get(d.isoformat(), 0)))
    else:
        # A year of daily points is noise; one bar per week keeps the shape.
        cursor = start
        while cursor < end:
            week_end = min(cursor + timedelta(days=7), end)
            n = sum(
                per_day.get((cursor + timedelta(days=i)).date().isoformat(), 0)
                for i in range((week_end - cursor).days)
            )
            timeline.append(ActivityPoint(label=f"w/c {cursor.strftime('%b %d')}", value=n))
            cursor = week_end

    return ActivitySummary(
        total=count("total"),
        today=count("today"),
        last_7_days=count("week"),
        actors=count("actors"),
        by_category=by_category,
        timeline=timeline,
        top_actions=[
            ActivityTopAction(action=r["_id"].get("action", ""), category=r["_id"].get("category", ""), n=int(r["n"]))
            for r in (f.get("top_actions") or [])
        ],
        range_from=start.date().isoformat(),
        range_to=(end - timedelta(days=1)).date().isoformat(),
    )


@activity_router.get("/actors", response_model=list[ActivityActor], summary="Who appears in the trail",
    dependencies=[Depends(require_permission("settings.view"))],
)
async def activity_actors():
    rows = await _activity().aggregate([
        {"$group": {"_id": "$user_id", "user_name": {"$last": "$user_name"}, "n": {"$sum": 1}}},
        {"$sort": {"n": -1}},
        {"$limit": 200},
    ]).to_list(200)
    return [
        ActivityActor(user_id=str(r["_id"] or ""), user_name=r.get("user_name") or "System", actions=int(r["n"]))
        for r in rows
    ]


@activity_router.get("/categories", response_model=list[str], summary="Category vocabulary",
    dependencies=[Depends(require_permission("settings.view"))],
)
async def activity_categories():
    seen = list(ActivityLogModel.CATEGORIES)
    for c in await _activity().distinct("category"):
        if c and c not in seen:
            seen.append(c)
    return seen


def _csv_response(rows: list[list[str]], filename: str) -> Response:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerows(rows)
    return Response(
        content=buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"', "Cache-Control": "no-store"},
    )


@activity_router.get("/export.csv", summary="The filtered trail as CSV",
    dependencies=[Depends(require_permission("settings.view"))],
)
async def activity_export(
    request: Request,
    user_id: str = Query("", max_length=40),
    category: str = Query("", max_length=40),
    q: str = Query("", max_length=120),
    date_from: str = Query("", alias="from", max_length=10),
    date_to: str = Query("", alias="to", max_length=10),
    me: dict = Depends(get_current_user),
):
    start, end = _range(date_from, date_to)
    query = _activity_query(user_id, category, q, start, end)
    docs = await _activity().find(query).sort("created_at", -1).to_list(20_000)
    rows = [["created_at", "when", "who", "user_id", "action", "category", "target", "detail", "ip"]]
    for d in docs:
        r = _activity_row(d)
        rows.append([r.created_at, r.when, r.user_name, r.user_id, r.action, r.category, r.target, r.detail, r.ip])
    # A copy of who-did-what leaving the system is itself something to know about.
    await record(
        me, "settings.activity.export", target="activity_log",
        detail=f"Exported {len(docs)} audit rows ({start.date()} to {(end - timedelta(days=1)).date()})",
        request=request,
    )
    return _csv_response(rows, f"activity-{start.date()}-to-{(end - timedelta(days=1)).date()}.csv")


# =============================================================================
# Platform events — the settings-level slice of the trail
# =============================================================================

#: What counts as a platform event: anything in the Settings bucket, plus
#: anything written with no actor (a process, not a person).
_PLATFORM_BASE: dict = {"$or": [{"category": "Settings"}, {"user_id": {"$in": ["", None]}}]}


def _severity(action: str, detail: str) -> str:
    a, d = (action or "").lower(), (detail or "").lower()
    if "failed" in d or "fail" in a or "error" in d:
        return "error"
    if "restore" in a or "delete" in a or "suspend" in a:
        return "warning"
    return "info"


def _source(action: str, category: str) -> str:
    if "." in (action or ""):
        parts = action.split(".")
        return ".".join(parts[:-1]) if len(parts) > 1 else parts[0]
    return (category or "settings").lower()


def _event(doc: dict) -> PlatformEvent:
    action = doc.get("action", "") or ""
    detail = doc.get("detail", "") or ""
    when = doc.get("created_at")
    return PlatformEvent(
        id=str(doc["_id"]),
        when=_when(when),
        created_at=_iso(when),
        severity=_severity(action, detail),
        source=_source(action, doc.get("category", "")),
        action=action,
        message=detail or (f"{action} — {doc.get('target')}" if doc.get("target") else action),
        user_name=doc.get("user_name") or "System",
        ip=doc.get("ip", "") or "",
    )


def _platform_query(q: str, source: str, severity: str) -> dict:
    """Severity and source are derived, so they cannot be pushed into Mongo;
    the list endpoint filters them in Python over a bounded window."""
    query: dict = dict(_PLATFORM_BASE)
    if q and q.strip():
        query = {"$and": [query, mongosafe.any_of(q.strip(), ["action", "detail", "target", "user_name", "ip"])]}
    return query


async def _platform_rows(q: str, source: str, severity: str) -> list[PlatformEvent]:
    docs = await _activity().find(_platform_query(q, source, severity)).sort("created_at", -1).to_list(5000)
    events = [_event(d) for d in docs]
    if source:
        events = [e for e in events if e.source == source]
    if severity:
        events = [e for e in events if e.severity == severity]
    return events


@logs_router.get("", response_model=PlatformEventPage, summary="Platform events, paged",
    dependencies=[Depends(require_permission("settings.view"))],
)
async def platform_logs(
    q: str = Query("", max_length=120),
    source: str = Query("", max_length=60),
    severity: str = Query("", max_length=10),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
):
    events = await _platform_rows(q, source, severity)
    total = len(events)
    start = (page - 1) * page_size
    return PlatformEventPage(items=events[start:start + page_size], **page_meta(total, page, page_size))


@logs_router.get("/summary", response_model=PlatformLogSummary, summary="Where the logs are, and how many",
    dependencies=[Depends(require_permission("settings.view"))],
)
async def platform_log_summary():
    events = await _platform_rows("", "", "")
    by_sev = {"info": 0, "warning": 0, "error": 0}
    sources: list[str] = []
    for e in events:
        by_sev[e.severity] = by_sev.get(e.severity, 0) + 1
        if e.source not in sources:
            sources.append(e.source)
    env = (settings.ENVIRONMENT or "development").lower()
    return PlatformLogSummary(
        total=len(events),
        by_severity=by_sev,
        sources=sorted(sources),
        process_log_destination="Cloud Run logging (stdout)" if env == "production" else "The terminal running uvicorn (stdout)",
        environment=env,
        note=(
            "WomSakhi keeps no system log in the database. What is listed here is the platform-level "
            "slice of the audit trail: backups, restores, schedule and organisation changes, and anything "
            "written by a process rather than a person. Severity is inferred from the action."
        ),
    )


@logs_router.get("/export.csv", summary="Platform events as CSV",
    dependencies=[Depends(require_permission("settings.view"))],
)
async def platform_logs_export(
    q: str = Query("", max_length=120),
    source: str = Query("", max_length=60),
    severity: str = Query("", max_length=10),
):
    events = await _platform_rows(q, source, severity)
    rows = [["created_at", "when", "severity", "source", "action", "message", "who", "ip"]]
    rows += [[e.created_at, e.when, e.severity, e.source, e.action, e.message, e.user_name, e.ip] for e in events]
    return _csv_response(rows, f"platform-events-{datetime.now(timezone.utc):%Y%m%d}.csv")


# =============================================================================
# Support — the inbox behind the "Contact support" screen
# =============================================================================

def _ticket_admin(doc: dict) -> TicketAdmin:
    created = doc.get("created_at")
    replies = doc.get("replies") or []
    first_reply_hours = None
    if isinstance(created, datetime) and replies and isinstance(replies[0].get("at"), datetime):
        first_at = replies[0]["at"]
        if first_at.tzinfo is None:
            first_at = first_at.replace(tzinfo=timezone.utc)
        c = created if created.tzinfo else created.replace(tzinfo=timezone.utc)
        first_reply_hours = round(max(0.0, (first_at - c).total_seconds() / 3600), 1)
    return TicketAdmin(
        id=str(doc["_id"]),
        reference=doc.get("reference", ""),
        subject=doc.get("subject", ""),
        message=doc.get("message", ""),
        category=doc.get("category", ""),
        priority=doc.get("priority", "Normal"),
        status=doc.get("status", "open"),
        replies=[
            TicketReplyOut(body=r.get("body", ""), by=r.get("by", ""), when=_when(r.get("at")))
            for r in replies
        ],
        raised_on=created.strftime("%b %d, %Y") if isinstance(created, datetime) else "",
        created_at=_iso(created),
        updated_at=_iso(doc.get("updated_at")),
        user_id=str(doc.get("user_id", "") or ""),
        user_name=doc.get("user_name", "") or "",
        user_email=doc.get("user_email", "") or "",
        first_reply_hours=first_reply_hours,
    )


@support_router.get("/contact", response_model=SupportContact, summary="How to reach the platform team",
    dependencies=[Depends(require_permission("settings.view"))],
)
async def support_contact():
    """Read from the platform settings row a Super Admin edits on the General
    settings screen — one source, so the two screens cannot disagree."""
    row = await _platform_settings().find_one({"_key": PlatformSettingsModel.SINGLETON}) or {}
    deliver = can_deliver()
    return SupportContact(
        email=(row.get("support_email") or "").strip(),
        phone=(row.get("support_phone") or "").strip(),
        source="Set on Settings › General by a Super Admin",
        email_delivery=deliver,
        email_note=(
            "Replies typed here are also emailed to the person who raised the ticket."
            if deliver
            else "Email is not configured to reach real addresses on this installation, so a reply is seen "
                 "only on this screen."
        ),
    )


@support_router.get("", response_model=TicketPage, summary="Every ticket staff have raised",
    dependencies=[Depends(require_permission("settings.edit"))],
)
async def support_inbox(
    status_filter: str = Query("", alias="status", max_length=20),
    q: str = Query("", max_length=120),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    query: dict = {}
    if status_filter in ("open", "in_progress", "resolved"):
        query["status"] = status_filter
    if q and q.strip():
        query.update(mongosafe.any_of(q.strip(), ["subject", "message", "reference", "user_name", "user_email"]))
    total, docs = await paged(
        _tickets(), query, sort=[("status", 1), ("created_at", -1)], page=page, page_size=page_size,
    )
    return TicketPage(items=[_ticket_admin(d) for d in docs], **page_meta(total, page, page_size))


@support_router.get("/summary", response_model=TicketSummary, summary="Ticket counts, and how fast replies came",
    dependencies=[Depends(require_permission("settings.edit"))],
)
async def support_summary():
    coll = _tickets()
    facets = await coll.aggregate([{"$facet": {
        "total": [{"$count": "n"}],
        "by_status": [{"$group": {"_id": "$status", "n": {"$sum": 1}}}],
        "raisers": [{"$group": {"_id": "$user_id"}}, {"$count": "n"}],
        "replied": [{"$match": {"replies.0": {"$exists": True}}}, {"$project": {"created_at": 1, "first": {"$arrayElemAt": ["$replies.at", 0]}}}],
    }}]).to_list(1)
    f = facets[0] if facets else {}
    by_status = {r["_id"]: int(r["n"]) for r in (f.get("by_status") or [])}
    hours: list[float] = []
    for r in f.get("replied") or []:
        c, first = r.get("created_at"), r.get("first")
        if isinstance(c, datetime) and isinstance(first, datetime):
            hours.append(max(0.0, (first - c).total_seconds() / 3600))
    total_rows = f.get("total") or []
    raiser_rows = f.get("raisers") or []
    return TicketSummary(
        total=int(total_rows[0]["n"]) if total_rows else 0,
        open=by_status.get("open", 0),
        in_progress=by_status.get("in_progress", 0),
        resolved=by_status.get("resolved", 0),
        raisers=int(raiser_rows[0]["n"]) if raiser_rows else 0,
        replied=len(hours),
        median_first_reply_hours=round(statistics.median(hours), 1) if hours else None,
    )


@support_router.post(
    "/{ticket_id}/reply",
    response_model=TicketReplyResult,
    summary="Answer a ticket",
    dependencies=[Depends(require_permission("settings.edit"))],
)
async def support_reply(
    ticket_id: str, body: TicketReplyIn, request: Request, me: dict = Depends(get_current_user)
):
    oid = to_object_id(ticket_id)
    doc = await _tickets().find_one({"_id": oid})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That ticket doesn't exist")
    now = datetime.now(timezone.utc)
    by = me.get("full_name") or me.get("email") or "Staff"
    updates: dict = {"updated_at": now}
    if doc.get("status") == SupportTicketModel.STATUS_OPEN:
        updates["status"] = SupportTicketModel.STATUS_IN_PROGRESS
    doc = await _tickets().find_one_and_update(
        {"_id": oid},
        {"$push": {"replies": {"body": body.body, "by": by, "by_id": str(me["_id"]), "at": now}}, "$set": updates},
        return_document=True,
    )

    # Four different truths, each said as itself: no address, no provider,
    # sent, or refused. Collapsing "refused" into "not configured" would tell
    # an admin to fix a setting that is already set.
    sent = False
    to = (doc.get("user_email") or "").strip()
    if not to:
        note = "The ticket has no email address on it; she will see the reply on the support screen."
    elif not can_deliver():
        note = "Email is not configured to reach real addresses on this installation; she will see the reply on the support screen."
    else:
        ref = doc.get("reference", "")
        spec = EmailMessageSpec(
            to=to,
            subject=f"Reply to your ticket {ref}: {doc.get('subject', '')}",
            html=_wrap(
                f"A reply to your support ticket {ref}",
                f"<p>{html.escape(by)} replied to <strong>{html.escape(ref)}</strong>:</p>"
                f"<div style='border-left:3px solid #c21868;padding:2px 0 2px 16px;margin:18px 0;color:#514658;'>"
                f"{html.escape(body.body).replace(chr(10), '<br>')}</div>",
                "Open WomSakhi support",
                f"{settings.APP_BASE_URL.rstrip('/')}/app/help",
                preheader=f"WomSakhi replied to support ticket {ref}.",
                footer_note="You received this because you contacted WomSakhi support.",
                recipient_name=doc.get("user_name", ""),
                title_accent="reply",
                next_step="Open support to continue the conversation if you still need help.",
            ),
            text=f"{by} replied to {ref}:\n\n{body.body}",
        )
        sent = await send(spec, to)
        note = (f"Also emailed to {to}." if sent
                else f"The email provider refused the message to {to}; she will see the reply on the support screen.")

    await record(
        me, "settings.support.reply", target=doc.get("reference", ""),
        detail=f"Replied to {doc.get('reference', '')} from {doc.get('user_name', '')}"
               + (" (emailed)" if sent else " (shown on screen only)"),
        request=request,
    )
    return TicketReplyResult(ticket=_ticket_admin(doc), email_sent=sent, email_note=note)


@support_router.patch(
    "/{ticket_id}/status",
    response_model=TicketAdmin,
    summary="Move a ticket between open, in progress and resolved",
    dependencies=[Depends(require_permission("settings.edit"))],
)
async def support_set_status(
    ticket_id: str, body: TicketStatusIn, request: Request, me: dict = Depends(get_current_user)
):
    oid = to_object_id(ticket_id)
    doc = await _tickets().find_one_and_update(
        {"_id": oid},
        {"$set": {"status": body.status, "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That ticket doesn't exist")
    await record(
        me, "settings.support.status", target=doc.get("reference", ""),
        detail=f"Marked {doc.get('reference', '')} as {body.status.replace('_', ' ')}",
        request=request,
    )
    return _ticket_admin(doc)


# =============================================================================
# Permissions (Roles & Permissions page — permission groups). Not this
# module's screen; kept exactly as it was.
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


# Attach every prefixed sub-router to the single router main.py includes.
router.include_router(integrations_router)
router.include_router(activity_router)
router.include_router(logs_router)
router.include_router(support_router)
router.include_router(permissions_router)


# =============================================================================
# Seed — only the permission groups the Roles screen still reads. The
# integration cards and the webhook row are no longer seeded: nothing reads
# them, and a "Connected" Stripe that never existed is not data.
# =============================================================================
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


async def seed() -> None:
    db = get_database()
    if await db[PermissionGroupModel.collection_name].count_documents({}) == 0:
        docs = [
            PermissionGroupModel.create_document(name=name, count=count, total=total, order=i)
            for i, (name, count, total) in enumerate(_PERMISSION_GROUPS)
        ]
        await db[PermissionGroupModel.collection_name].insert_many(docs)
        print(f"🌱 Seeded {len(docs)} permission groups")
