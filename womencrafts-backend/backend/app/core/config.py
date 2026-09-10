from pydantic import model_validator
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    MONGODB_URI: str
    DB_NAME: str = "womencrafts"
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Which browser origins may call this API.
    #
    # This was two hardcoded localhost ports in main.py until it moved here,
    # and that is a deployment trap worth naming: the deployed API rejects
    # every call from the deployed site, the browser shows a CORS error, and
    # the server log shows a perfectly healthy request. It reads as a frontend
    # bug for as long as you let it. Comma-separated; set to the real origins
    # in production and never to "*" — this API is called with credentials,
    # and a wildcard with credentials is rejected by every browser anyway.
    ALLOWED_ORIGINS: str = "http://localhost:3100,http://localhost:3000"

    # Uploads — where images are written, the host the browser loads them from,
    # and how big a single file may be.
    MEDIA_DIR: str = "media"
    MEDIA_BASE_URL: str = "http://localhost:8020"
    MAX_UPLOAD_MB: int = 5

    # Identity documents. Kept in a SEPARATE directory that is never mounted for
    # static serving — they are only readable through an authenticated,
    # admin-only endpoint. Never point this at MEDIA_DIR.
    PRIVATE_MEDIA_DIR: str = "private_media"
    MAX_DOCUMENT_MB: int = 10
    # Encryption at rest for those documents — 32 bytes, base64 or hex.
    # Blank means OFF, which is the current state; see app/core/docvault.py for
    # what it protects against and why it is not derived from JWT_SECRET_KEY.
    DOCUMENT_ENCRYPTION_KEY: str = ""

    # Where the frontend lives, for links inside emails.
    # 3100, not 3000. This is the host every emailed link is built from —
    # verification, password reset, approval — and port 3000 on a dev machine
    # is very often something else entirely. Set it to the real domain in
    # production; a wrong value here silently sends people somewhere else.
    APP_BASE_URL: str = "http://localhost:3100"

    # Email. Leave SMTP_HOST empty in development: messages are written to
    # backend/outbox/ instead of being sent.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False
    EMAIL_FROM: str = "no-reply@womsakhi.com"
    EMAIL_FROM_NAME: str = "WomSakhi"
    EMAIL_TOKEN_HOURS: int = 24

    # Auth hardening
    MAX_FAILED_LOGINS: int = 5      # attempts before a temporary lockout
    LOCKOUT_MINUTES: int = 15

    # Payments. "sandbox" needs no account and runs the full journey locally;
    # switch to "razorpay" (or another adapter) once keys exist.
    PAYMENT_PROVIDER: str = "sandbox"
    PAYMENT_CURRENCY: str = "INR"
    PAYMENT_WEBHOOK_SECRET: str = "dev-webhook-secret-change-me"
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    STRIPE_SECRET_KEY: str = ""
    # Master switch: with payments off, everything in the app is free and the
    # checkout step is skipped entirely.
    PAYMENTS_ENABLED: bool = True

    # --- AI: Sakhi's brain (console.anthropic.com) ---
    # Blank = the mock provider, so everything still runs without a key.
    ANTHROPIC_API_KEY: str = ""
    # The model that answers her. Sonnet, and this is the one place where the
    # cheaper model turned out to be the more expensive one.
    #
    # Haiku 4.5 costs a third of Sonnet per token, which is why it was chosen.
    # But Haiku will not cache a prompt prefix under 4096 tokens, and Sakhi's —
    # her instructions plus twenty-four tool schemas — is about 3400. So every
    # single member turn paid full price for the whole tool list, for ever.
    # Sonnet caches from 1024, so the same prefix costs a tenth from the second
    # call onward.
    #
    # Measured rather than argued, over a realistic twelve-question sitting
    # (scripts/bench_cost.py):
    #
    #     Haiku    $0.04593    $0.00383/call     0% served from cache
    #     Sonnet   $0.02722    $0.00227/call    96% served from cache
    #
    # Sonnet is 41% cheaper on a warm cache, and still cheaper on a cold one
    # once the sitting runs past about nine calls — the measured median is
    # thirteen. It is also a considerably better model, which is not the reason
    # for the change but is not nothing either.
    #
    # If the prefix ever grows past 4096 tokens, re-run the benchmark: Haiku
    # starts caching at that point and the arithmetic may flip back.
    AI_MODEL_CHAT: str = "claude-haiku-4-5"
    # Kept for work that genuinely reasons — the staff copilot's analysis, and
    # anywhere a wrong answer is expensive. Set AI_ESCALATE_WRITES to use it
    # for turns that change her records.
    AI_MODEL_REASONING: str = "claude-opus-5"
    AI_MODEL_ROUTING: str = "claude-haiku-4-5"       # classification, titles
    # Speech costs money per character. Only synthesise when she actually spoke
    # to Sakhi — a woman who typed her question can read the answer.
    AI_SPEAK_ONLY_WHEN_SPOKEN_TO: bool = True
    AI_MAX_OUTPUT_TOKENS: int = 1024
    # Our own spend ceiling, independent of the console's. Two locks, because
    # either one can be misconfigured.
    AI_MONTHLY_BUDGET_USD: float = 25.0

    # --- Observability: Langfuse (see docs/langfuse.md) ---
    # Blank keys = tracing is a silent no-op. A dashboard being down, slow or
    # unpaid must never be the reason a woman cannot get an answer.
    LANGFUSE_PUBLIC_KEY: str = ""
    LANGFUSE_SECRET_KEY: str = ""
    # REGION MATTERS. This project is on US cloud; the library defaults to EU,
    # and pointing at the wrong one fails quietly — traces just never appear.
    LANGFUSE_HOST: str = "https://us.cloud.langfuse.com"
    LANGFUSE_ENV: str = "development"

    # --- AI: Sakhi's voice + lip-sync visemes (see docs/azure-speech.md) ---
    AZURE_SPEECH_KEY: str = ""
    AZURE_SPEECH_REGION: str = "centralindia"

    # --- Which machine is this? ---------------------------------------------
    # "development" or "production". Everything below that could be unsafe is
    # decided from this rather than from a human remembering to flip a flag,
    # because the failure mode of forgetting is a live platform serving session
    # cookies over plain HTTP and accepting forged payment webhooks.
    ENVIRONMENT: str = "development"

    # --- Shared state, for when there is more than one worker ----------------
    # Empty means "one worker, in-process state", which is right for a laptop.
    # Set it and the cache and the rate limiter become shared — see
    # `app/core/shared_state.py` for why the rate limiter in particular stops
    # being a security control the moment there are two of it.
    REDIS_URL: str = ""
    #: How many worker processes this is being run with. Declared rather than
    #: detected, because uvicorn and gunicorn announce it differently and a
    #: guard that silently fails to notice is not a guard.
    WORKERS: int = 1

    # Session cookie. Never sent over plain HTTP in production — `secure=True`
    # is forced below rather than left to a .env line, so the only way to ship
    # an insecure cookie is to deliberately set ENVIRONMENT to something other
    # than production.
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"

    # Which hosts the session cookie is offered to.
    #
    # Empty means host-only: the cookie goes back only to the exact host that
    # set it. That is right in development, where the API and the site are both
    # `localhost` and cookies ignore the port — so one cookie serves both.
    #
    # In production they are two hosts, `app.womsakhi.com` and
    # `api.womsakhi.com`, and BOTH need to read this cookie: the browser sends
    # it to the API, and the Next server reads it to decide whether to render
    # the member shell at all. Host-only means the site never sees it and every
    # signed-in page bounces to /signin while the API insists the login worked.
    # Set it to `.womsakhi.com`.
    #
    # It CANNOT be made to work across two `*.run.app` hosts at any value:
    # `run.app` is on the Public Suffix List, so browsers refuse a cookie
    # scoped to it. The custom domain is a requirement for login, not a polish
    # step.
    COOKIE_DOMAIN: str = ""

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.strip().lower() in {"production", "prod", "live"}

    @model_validator(mode="after")
    def _harden_for_production(self) -> "Settings":
        """
        In production, derive the settings that must not be got wrong.

        `COOKIE_SECURE` was a plain default of False. That is right for
        localhost and catastrophic anywhere else, and "remember to set it in
        the production .env" is not a control — it is a hope. Deriving it from
        ENVIRONMENT means the unsafe value is unreachable in production
        regardless of what the .env says.
        """
        if self.is_production:
            object.__setattr__(self, "COOKIE_SECURE", True)
        return self

    def unsafe_for_production(self) -> list[str]:
        """
        Everything that would be a real hole if this booted as a live service.

        Returned rather than raised so the caller decides: `main.py` refuses to
        start in production and merely warns in development, which keeps local
        work friction-free while making it impossible to deploy these by
        accident. Each entry is written to be actionable on its own.
        """
        problems: list[str] = []

        if self.PAYMENT_WEBHOOK_SECRET in {"", "dev-webhook-secret-change-me"}:
            problems.append(
                "PAYMENT_WEBHOOK_SECRET is unset or still the placeholder. Anyone "
                "who can reach the webhook URL could forge a 'payment captured' "
                "event and be given goods for free. Copy the signing secret from "
                "the payment provider's dashboard."
            )
        if self.PAYMENT_PROVIDER.strip().lower() == "sandbox":
            problems.append(
                "PAYMENT_PROVIDER is 'sandbox'. Checkout, withdrawals and savings "
                "circles move numbers in the database and no real money. Set it to "
                "'razorpay' and supply RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET."
            )
        if self.PAYMENT_PROVIDER.strip().lower() == "razorpay" and not (
            self.RAZORPAY_KEY_ID and self.RAZORPAY_KEY_SECRET
        ):
            problems.append(
                "PAYMENT_PROVIDER is 'razorpay' but RAZORPAY_KEY_ID / "
                "RAZORPAY_KEY_SECRET are empty, so every payment will fail."
            )
        if not self.SMTP_HOST:
            problems.append(
                "SMTP_HOST is empty, so no email is delivered — it is written to "
                "disk instead. Email verification gates signup, so nobody can "
                "finish joining, and no password reset link ever arrives."
            )
        if not self.DOCUMENT_ENCRYPTION_KEY:
            problems.append(
                "DOCUMENT_ENCRYPTION_KEY is empty, so identity documents are "
                "written to disk in the clear. Generate one with: python -m "
                "app.core.docvault"
            )
        if self.JWT_SECRET_KEY in {"", "change-me", "secret", "dev"}:
            problems.append("JWT_SECRET_KEY is unset or a placeholder — anyone can mint a session.")
        # More than one worker without shared state is not a slow app — it is a
        # rate limiter that no longer limits. Each worker counts to
        # MAX_FAILED_LOGINS on its own, so the real allowance is that number
        # times the worker count, and nothing anywhere reports it.
        if self.WORKERS > 1 and not self.REDIS_URL:
            problems.append(
                f"WORKERS is {self.WORKERS} but REDIS_URL is empty. The rate limiter "
                f"counts per process, so the {self.MAX_FAILED_LOGINS}-attempt lockout "
                f"becomes {self.WORKERS * self.MAX_FAILED_LOGINS} attempts. Set REDIS_URL, "
                "or run one worker."
            )
        if self.APP_BASE_URL.startswith("http://localhost"):
            problems.append(
                f"APP_BASE_URL is still {self.APP_BASE_URL}. Every emailed link — "
                "verification, password reset — would point at a developer's laptop."
            )
        return problems

    @property
    def allowed_origins(self) -> list[str]:
        """`ALLOWED_ORIGINS` split and cleaned. Empty entries are dropped so a
        trailing comma in an env var cannot add an origin called ""."""
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
