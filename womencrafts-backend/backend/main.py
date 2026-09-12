import threading
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles

from app.core import errors
from app.core.config import settings
from app.core.payments import PaymentConfigError, PaymentProviderError
from app.core.errors import RequestIdMiddleware
from app.core.headers import SecurityHeadersMiddleware
from app.core.observability import TimingMiddleware
from app.core.rbac import module_guard
from app.core.seed_all import seed_all
from app.db.indexes import ensure_indexes
from app.db.mongodb import connect_db, close_db
from app.routes.public import router as public_router
from app.routes.auth import router as auth_router
from app.routes.users import router as users_router
from app.routes.members import router as members_router
from app.routes.roles import router as roles_router
from app.routes.segments import router as segments_router
from app.routes.appointments import router as appointments_router
from app.routes.programs import router as programs_router
from app.routes.calendar import router as calendar_router
from app.routes.analytics import router as analytics_router
from app.routes.services import router as services_router
from app.routes.messages import router as messages_router
from app.routes.reports import router as reports_router
from app.routes.content import router as content_router
from app.routes.feedback import router as feedback_router
from app.routes.ai import router as ai_router
from app.routes.notifications import router as notifications_router
from app.routes.dashboard import router as dashboard_router
from app.routes.billing import router as billing_router
from app.routes.settings_security import router as settings_security_router
from app.routes.settings_platform import router as settings_platform_router
from app.routes.uploads import MEDIA_ROOT, router as uploads_router
from app.routes.verification import router as verification_router
from app.routes.me import router as me_router
from app.routes.home import router as home_router
from app.routes.me_messages import router as me_messages_router
from app.routes.catalog import router as catalog_router
from app.routes.payments import router as payments_router
from app.routes.community import router as community_router
from app.routes.growth import router as growth_router
from app.routes.exchange import router as exchange_router
from app.routes.money import router as money_router
from app.routes.group_buy import router as group_buy_router
from app.routes.payout import router as payout_router
from app.routes.shop import router as shop_router
from app.routes.reference import router as reference_router
from app.routes.search import router as search_router
from app.routes.skills import router as skills_router
from app.routes.saved import router as saved_router
from app.routes.safety import router as safety_router
from app.routes.wallet import router as wallet_router
from app.routes.admin_community import router as admin_community_router
from app.routes.admin_growth import router as admin_growth_router
from app.routes.admin_safety import router as admin_safety_router
from app.routes.staff_account import router as staff_account_router
from app.routes.backups import router as backups_router
from app.routes.theme import router as theme_router
from app.routes.layout import router as layout_router
from app.routes.sakhi import router as sakhi_router
from app.routes.org import router as org_router


# Descriptions for the Swagger UI tag groups.
tags_metadata = [
    {"name": "Authentication", "description": "Sign up, sign in, and the current session."},
    {"name": "Account", "description": "The signed-in user's own profile and password."},
    {"name": "Users", "description": "The platform members directory, their roles, and audience segments."},
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Refuse to be a live service with development settings ────────────────
    #
    # Every one of these was a real hole: a session cookie over plain HTTP, a
    # webhook secret anyone could read off GitHub, identity documents in the
    # clear, an email path that silently wrote to disk. None of them announce
    # themselves at runtime — the app works perfectly with all six wrong, which
    # is exactly why they survived this long.
    #
    # In production this stops the process. In development it prints and
    # continues, because a local machine is meant to run on sandbox payments
    # and file email.
    problems = settings.unsafe_for_production()
    if problems:
        if settings.is_production:
            listing = "\n".join(f"  {i}. {p}" for i, p in enumerate(problems, 1))
            raise RuntimeError(
                "Refusing to start in production with unsafe settings.\n\n"
                f"{listing}\n\n"
                "Fix these in the environment, or set ENVIRONMENT=development if "
                "this is not a live service."
            )
        print(f"ℹ️  {len(problems)} setting(s) are fine locally but must be fixed before launch:")
        for i, p in enumerate(problems, 1):
            print(f"     {i}. {p.split('.')[0]}.")

    # Say out loud whether shared state is on. A rate limiter that silently
    # counts per process is the kind of thing nobody notices until it matters.
    from app.core import shared_state

    if shared_state.configured():
        if await shared_state.available():
            print(f"✅ Shared state: Redis reachable — the rate limit is global across {settings.WORKERS} worker(s)")
        else:
            print("⚠️  REDIS_URL is set but Redis is NOT reachable. Falling back to per-process "
                  "counters: the login lockout will be enforced separately by each worker.")
    elif settings.WORKERS > 1:
        print(f"⚠️  {settings.WORKERS} workers with no REDIS_URL — the login lockout is per process.")

    try:
        await connect_db()
        await ensure_indexes()
        await seed_all()
    except Exception as exc:  # noqa: BLE001 - never let a DB outage block startup
        print(f"⚠️  Starting without a database connection: {exc}")

    # Load the matching model now, off the request path. Cold load is tens of
    # seconds; letting the first woman who describes what she needs pay for it
    # would be the slowest moment in the product. Off the main thread so a slow
    # disk does not hold up the port binding, and failure is not fatal —
    # matching falls back to keywords.
    def _warm() -> None:
        try:
            from app.core import semantic
            semantic.warm()
        except Exception as exc:  # noqa: BLE001
            print(f"⚠️  Semantic matching unavailable, using keywords: {exc}")

    # Identity documents are readable by their owner and nobody else on the
    # box. The directory is created by `routes/verification.py` with whatever
    # the process umask happens to be — 0755 here, which means every account on
    # the host can walk a woman's Aadhaar card. Narrowed on every boot rather
    # than once at creation, because a deploy that restores from a backup or
    # rsyncs the folder brings the old mode back with it.
    try:
        private_root = Path(settings.PRIVATE_MEDIA_DIR)
        if not private_root.is_absolute():
            private_root = Path(__file__).resolve().parent / settings.PRIVATE_MEDIA_DIR
        if private_root.is_dir():
            private_root.chmod(0o700)
            for child in private_root.rglob("*"):
                child.chmod(0o700 if child.is_dir() else 0o600)
    except Exception as exc:  # noqa: BLE001 - a permissions failure must not block startup
        print(f"⚠️  Could not tighten permissions on private media: {exc}")

    threading.Thread(target=_warm, name="warm-matching", daemon=True).start()

    yield
    await close_db()


app = FastAPI(
    title="WomSakhi API",
    version="1.1.0",
    description=(
        "Backend API for the WomSakhi platform.\n\n"
        "**Authentication** — sign up / sign in / current session.  \n"
        "**Users** — the members directory, roles, and audience segments."
    ),
    lifespan=lifespan,
    openapi_tags=tags_metadata,
)

# Order matters: middleware wraps outward-in, so timing must be added LAST to
# be the outermost layer and see the whole request including compression.
#
# GZip at 500 bytes. The catalogue is 12KB of JSON that compresses to about a
# tenth; on a 2G connection that is two seconds against two hundred
# milliseconds, and this API's users are on 2G.
# ── When the payment gateway is the thing that broke ─────────────────────────
#
# No route wrapped these, so a missing key or an unreachable gateway reached a
# member as a bare 500. That matters more than it looks: a woman who sees
# "something went wrong" while paying does not know whether her money left, and
# the honest answer — that nothing was taken and it is our problem, not hers —
# is the difference between her trying again and her never trusting the wallet.
@app.exception_handler(PaymentProviderError)
async def _payment_provider_failed(request: Request, exc: PaymentProviderError):
    config_problem = isinstance(exc, PaymentConfigError)
    if config_problem:
        # The real reason goes to the log, never to her — it names our keys.
        print(f"⚠️  Payment provider is misconfigured: {exc}")
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "detail": (
                "Payments are unavailable right now. Nothing has been taken from "
                "you — please try again shortly."
                if config_problem
                else f"The payment service could not complete that. Nothing has been "
                     f"taken from you. ({exc})"
            )
        },
    )


app.add_middleware(GZipMiddleware, minimum_size=500)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # Without this the browser cannot read either header from JavaScript, and
    # a timing header nobody can read is a timing header nobody looks at.
    expose_headers=["Server-Timing", "X-Query-Count", "X-Request-Id"],
)

app.add_middleware(TimingMiddleware)

# Outermost, so every response — including one produced by an exception handler
# below — carries the id, and so every log line inside the request can find it.
app.add_middleware(RequestIdMiddleware)

# Added last, so it is the outermost layer and every response leaves with these
# headers — a 500 from an exception handler and a CORS preflight included. It
# only ever uses `setdefault`, so a route that sets its own header still wins.
app.add_middleware(SecurityHeadersMiddleware)

# One shape for every failure, and never a stack trace on a phone.
errors.install(app)

# Routers (all under /api/v1).
# Data modules are guarded by RBAC — module_guard(<key>) 403s if the caller's
# role can't open that module. Auth + the account's own profile stay unguarded.
def _mod(key: str):
    return [Depends(module_guard(key))]


app.include_router(public_router, prefix="/api/v1")   # no session required
app.include_router(auth_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")  # /users/me — own profile
# A member's own threads. Unguarded by module RBAC on purpose: these are
# hers, and every query inside is scoped to her session.
app.include_router(me_messages_router, prefix="/api/v1")
app.include_router(members_router, prefix="/api/v1", dependencies=_mod("users"))
app.include_router(roles_router, prefix="/api/v1", dependencies=_mod("users"))
app.include_router(segments_router, prefix="/api/v1", dependencies=_mod("users"))
app.include_router(appointments_router, prefix="/api/v1", dependencies=_mod("appointments"))
app.include_router(programs_router, prefix="/api/v1", dependencies=_mod("programs"))
app.include_router(calendar_router, prefix="/api/v1", dependencies=_mod("calendar"))
app.include_router(analytics_router, prefix="/api/v1", dependencies=_mod("analytics"))
app.include_router(services_router, prefix="/api/v1", dependencies=_mod("services"))
app.include_router(messages_router, prefix="/api/v1", dependencies=_mod("messages"))
app.include_router(reports_router, prefix="/api/v1", dependencies=_mod("reports"))
app.include_router(content_router, prefix="/api/v1", dependencies=_mod("content"))
app.include_router(feedback_router, prefix="/api/v1", dependencies=_mod("feedback"))
app.include_router(ai_router, prefix="/api/v1", dependencies=_mod("ai"))
app.include_router(notifications_router, prefix="/api/v1")  # personal (topbar bell) — baseline
app.include_router(dashboard_router, prefix="/api/v1", dependencies=_mod("dashboard"))
app.include_router(billing_router, prefix="/api/v1", dependencies=_mod("settings"))
app.include_router(settings_security_router, prefix="/api/v1", dependencies=_mod("settings"))
app.include_router(settings_platform_router, prefix="/api/v1", dependencies=_mod("settings"))
app.include_router(uploads_router, prefix="/api/v1")  # images — any module may upload
# Account admission: members submit, staff review. Guarded per-endpoint
# (applicants must reach their own status while still unverified).
app.include_router(verification_router, prefix="/api/v1")
# The member app. Every endpoint scopes to the caller's own account and
# requires an ADMITTED member — see routes/me.require_active_member.
app.include_router(me_router, prefix="/api/v1")
# `/me/home` — the home screen's own composed endpoint. A separate module
# rather than another thousand lines in routes/me.py, and it carries the same
# `/me` prefix so the screen's call sits with the rest of her data.
app.include_router(home_router, prefix="/api/v1")
app.include_router(catalog_router, prefix="/api/v1")
app.include_router(payments_router, prefix="/api/v1")
# The rest of the member app. Each of these routers depends on
# core.deps.require_active_member, so admission is enforced in one place.
app.include_router(community_router, prefix="/api/v1")
app.include_router(growth_router, prefix="/api/v1")
app.include_router(reference_router, prefix="/api/v1")
app.include_router(group_buy_router, prefix="/api/v1")
app.include_router(shop_router, prefix="/api/v1")
app.include_router(exchange_router, prefix="/api/v1")
app.include_router(payout_router, prefix="/api/v1")
app.include_router(money_router, prefix="/api/v1")
app.include_router(skills_router, prefix="/api/v1")
app.include_router(search_router, prefix="/api/v1")
app.include_router(saved_router, prefix="/api/v1")
app.include_router(safety_router, prefix="/api/v1")
app.include_router(wallet_router, prefix="/api/v1")
# The staff side of those same modules, each behind its own RBAC module key.
app.include_router(admin_community_router, prefix="/api/v1", dependencies=_mod("community"))
app.include_router(admin_growth_router, prefix="/api/v1", dependencies=_mod("growth"))
app.include_router(admin_safety_router, prefix="/api/v1", dependencies=_mod("safety"))
# A staff member's own account and the platform settings. Guarded by
# require_staff rather than a module key: every staff role owns its own profile.
app.include_router(staff_account_router, prefix="/api/v1")
app.include_router(backups_router, prefix="/api/v1")
# Colour theme — everyone owns their own, so this is guarded per-endpoint
# rather than by a module key.
app.include_router(theme_router, prefix="/api/v1")
# Personal layout — everyone owns the arrangement of their own app, so this
# is baseline like /theme, not behind a module guard.
app.include_router(layout_router, prefix="/api/v1")
# Sakhi, the assistant. Baseline like /theme: she is part of her own app,
# not an admin module, and every endpoint is scoped to the caller.
app.include_router(sakhi_router, prefix="/api/v1")
# Organisation settings — the org.* tier. Guarded per-endpoint by both
# Super Admin AND the entitlement, so neither alone is enough.
app.include_router(org_router, prefix="/api/v1")

# Serve the uploaded images. A <img src="http://localhost:8010/media/…"> in the
# frontend reads straight from here.
app.mount("/media", StaticFiles(directory=MEDIA_ROOT), name="media")


@app.get("/", tags=["Health"])
def root():
    return {"message": "Welcome to WomSakhi API"}


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8020, reload=True)
