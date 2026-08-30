from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    MONGODB_URI: str
    DB_NAME: str = "womencrafts"
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

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
    APP_BASE_URL: str = "http://localhost:3000"

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

    # Session cookie. COOKIE_SECURE must be True in production (HTTPS); it is
    # False locally because development runs on plain http://localhost.
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
