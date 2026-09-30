"""
One-time sign-in codes.

WomSakhi has no passwords. Signing up and signing in both prove control of an
address — today an email inbox, later a mobile number — with a six-digit code
that lives five minutes. Every code on the platform is issued and checked here,
whatever channel carries it, so the rules below are the same everywhere:

    six random digits          `secrets`, never `random`
    five minutes to live       AUTH_CODE_TTL_MINUTES
    five wrong tries           then the code is void and she asks for another
    thirty seconds between     AUTH_CODE_RESEND_SECONDS, so "resend" cannot flood
    five an hour               AUTH_CODE_MAX_PER_HOUR per address

**Only a keyed digest is stored.** The code exists long enough to be sent and is
never written down: a database read cannot sign anybody in. The digest is keyed
with the JWT secret and bound to purpose + address, so a code minted for one
address cannot be replayed against another even by someone who can read rows.

**Channels are adapters.** `email` works today through the configured mail
provider. `sms` is wired to MSG91 and switched off until PHONE_CODES_ENABLED
and its keys are set; Firebase phone codes are verified on the client and
checked by `verify_firebase_phone` instead, because Firebase sends and checks
its own codes.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, Request, status
from pymongo import ReturnDocument

from app.core import ratelimit
from app.core.config import settings
from app.db.mongodb import get_database

logger = logging.getLogger(__name__)

COLLECTION = "auth_codes"

# Purposes. A code for one can never be spent on another.
SIGNIN = "signin"
SIGNUP = "signup"
PHONE_VERIFY = "phone_verify"
PURPOSES = {SIGNIN, SIGNUP, PHONE_VERIFY}

# Channels.
EMAIL = "email"
SMS = "sms"
CHANNELS = {EMAIL, SMS}

#: Wrong-code attempts per address inside the window, across codes. The per-code
#: cap voids one code; this stops "ask for a new code, guess five, repeat".
VERIFY_LIMIT = (15, 3600.0)
VERIFY_LIMIT_IP = (120, 3600.0)
#: Codes sent per IP per hour, across addresses — the SMS-pumping brake.
SEND_LIMIT_IP = (40, 3600.0)


@dataclass
class Issued:
    """What the caller may tell the client. Never contains the code."""

    channel: str
    destination: str
    expires_in: int
    resend_in: int


def _codes():
    return get_database()[COLLECTION]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(value) -> Optional[datetime]:
    if not isinstance(value, datetime):
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def normalise_email(value: str) -> str:
    return (value or "").strip().lower()


def digest(purpose: str, destination: str, code: str) -> str:
    message = f"{purpose}:{destination}:{code}".encode("utf-8")
    return hmac.new(settings.JWT_SECRET_KEY.encode("utf-8"), message, hashlib.sha256).hexdigest()


def new_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def mask(channel: str, destination: str) -> str:
    """`p****@gmail.com` / `+91 ******3210` — enough to recognise, not to harvest."""
    if channel == EMAIL and "@" in destination:
        local, _, domain = destination.partition("@")
        return f"{local[:1]}{'*' * max(3, len(local) - 1)}@{domain}"
    digits = destination[-4:]
    return f"{destination[:3]} ******{digits}" if destination.startswith("+") else f"******{digits}"


# ── delivery ────────────────────────────────────────────────────────────────


async def _deliver(channel: str, destination: str, code: str, purpose: str, name: str = "",
                   template: str = "") -> bool:
    """Hand one code to its channel. Returns whether the provider accepted it."""
    if channel == EMAIL:
        from app.core import email as mailer

        return await mailer.send(mailer.code_email(name, code, template or purpose), destination)
    if channel == SMS:
        return await _send_sms(destination, code)
    return False


async def _send_sms(destination: str, code: str) -> bool:
    """
    MSG91 "flow" send with our own code as the template variable.

    The template text is fixed and DLT-registered; only `otp` changes. It must
    end with the WebOTP line (`@app.womsakhi.com #{otp}`) so Android fills the
    code in by itself. Nothing is sent unless phone codes are switched on and
    the keys exist — a half-configured provider fails closed here.
    """
    if not settings.server_sends_sms:
        return False
    if settings.PHONE_PROVIDER.strip().lower() == "brevo":
        return await _send_sms_brevo(destination, code)
    if settings.PHONE_PROVIDER.strip().lower() == "file" and not settings.is_production:
        return _send_sms_file(destination, code)
    import httpx

    payload = {
        "template_id": settings.MSG91_TEMPLATE_ID,
        "short_url": "0",
        "recipients": [{"mobiles": destination.lstrip("+"), "otp": code}],
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.post(
                "https://control.msg91.com/api/v5/flow",
                json=payload,
                headers={"authkey": settings.MSG91_AUTH_KEY, "accept": "application/json"},
            )
        if response.status_code >= 300:
            logger.warning("codes: MSG91 refused a send (%s): %s", response.status_code, response.text[:200])
            return False
        return True
    except Exception:  # noqa: BLE001 - a provider outage is a failed send, not a 500
        logger.exception("codes: MSG91 send failed")
        return False


def _send_sms_file(destination: str, code: str) -> bool:
    """Development: write the SMS to outbox/ like the file email adapter does."""
    import json
    from pathlib import Path

    outbox = Path(__file__).resolve().parents[2] / "outbox"
    outbox.mkdir(parents=True, exist_ok=True)
    stamp = _now().strftime("%Y%m%d-%H%M%S-%f")
    (outbox / f"{stamp}-sms-{destination.lstrip('+')}.json").write_text(
        json.dumps({"to": destination, "subject": f"{code} is your WomSakhi code (SMS)", "text": code}),
        encoding="utf-8",
    )
    return True


async def _send_sms_brevo(destination: str, code: str) -> bool:
    """
    Brevo transactional SMS. The text must match the DLT-approved template word
    for word (only the code varies), and ends with the WebOTP line so Android
    offers to fill the code in by itself.
    """
    import httpx

    domain = settings.APP_BASE_URL.split("://", 1)[-1].split("/", 1)[0]
    content = (
        f"{code} is your WomSakhi code. It expires in {settings.AUTH_CODE_TTL_MINUTES} minutes. "
        f"Do not share it with anyone.\n\n@{domain} #{code}"
    )
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.post(
                "https://api.brevo.com/v3/transactionalSMS/send",
                json={"sender": settings.BREVO_SMS_SENDER, "recipient": destination.lstrip("+"),
                      "content": content, "type": "transactional", "tag": "womsakhi-code"},
                headers={"api-key": settings.BREVO_API_KEY, "accept": "application/json",
                         "content-type": "application/json"},
            )
        if response.status_code >= 300:
            logger.warning("codes: Brevo refused an SMS (%s): %s", response.status_code, response.text[:200])
            return False
        return True
    except Exception:  # noqa: BLE001 - a provider outage is a failed send, not a 500
        logger.exception("codes: Brevo SMS send failed")
        return False


# ── issue ───────────────────────────────────────────────────────────────────


def is_test_login(channel: str, destination: str) -> bool:
    """A development test account, which signs in with the fixed code."""
    return channel == EMAIL and normalise_email(destination) in settings.test_login_emails


#: Wrong fixed-code tries per test address are counted in this bucket, per UTC day.
TEST_CODE_FAIL_BUCKET = "test_code_fail"
TEST_CODE_FAIL_WINDOW = 86400.0


async def test_code_locked(destination: str) -> bool:
    """Has this test address had too many wrong fixed-code tries today?"""
    cap = int(settings.TEST_LOGIN_MAX_FAILURES_PER_DAY or 0)
    if cap <= 0:
        return False
    return await ratelimit.failures(TEST_CODE_FAIL_BUCKET, destination, TEST_CODE_FAIL_WINDOW) >= cap


def _background_send(background, channel: str, destination: str, code: str, purpose: str,
                     name: str, template: str, row_id) -> None:
    """Deliver after the answer has gone; a failed send frees the address to ask again."""

    async def _run() -> None:
        try:
            ok = await _deliver(channel, destination, code, purpose, name, template)
        except Exception:  # noqa: BLE001 - a send is never allowed to crash the worker
            logger.exception("codes: background send failed")
            ok = False
        if not ok:
            logger.warning("codes: could not send a %s %s code", purpose, channel)
            await _codes().update_one({"_id": row_id, "consumed_at": None},
                                      {"$set": {"consumed_at": _now(), "failed": True}})

    background.add_task(_run)


async def issue(
    request: Request,
    *,
    purpose: str,
    channel: str,
    destination: str,
    user_id: str = "",
    name: str = "",
    payload: Optional[dict] = None,
    send: bool = True,
    template: str = "",
    allow_fixed: bool = False,
    background=None,
) -> Issued:
    """
    Mint a code, retire any earlier one for the same address, and send it.

    `send=False` goes through the SAME steps — cooldown, rate limits, retiring
    the earlier code, writing a row — but the row holds the digest of a secret
    nobody is ever told, and nothing is sent. Sign-in uses it for an address
    that has no account, so the answer, the second-call cooldown (429
    `resend_too_soon`) and the wrong-code replies are identical, and the
    endpoint cannot be used to ask "is she a member here?".

    `allow_fixed`: the caller has checked the account may use the fixed test
    code (a listed MEMBER, or staff with TEST_LOGIN_ALLOW_STAFF). Otherwise a
    listed address gets a real code like anyone else.

    `background`: a FastAPI BackgroundTasks. When given, delivery happens
    after the response, so the time to answer does not depend on whether a
    message was really sent (a slow SMTP handshake used to say "member").
    """
    if purpose not in PURPOSES or channel not in CHANNELS:
        raise ValueError(f"unknown code purpose/channel: {purpose}/{channel}")

    now = _now()
    # A team test account sends nothing, so the send limits (which protect
    # inboxes and cost) do not apply; the wrong-code limits in verify() do,
    # and so does a daily cap on wrong fixed-code tries.
    fixed = send and allow_fixed and is_test_login(channel, destination)
    latest = await _codes().find_one(
        {"purpose": purpose, "destination": destination, "consumed_at": None},
        sort=[("created_at", -1)],
    )
    created = _aware((latest or {}).get("created_at"))
    if not fixed and created and (now - created).total_seconds() < settings.AUTH_CODE_RESEND_SECONDS:
        wait = settings.AUTH_CODE_RESEND_SECONDS - int((now - created).total_seconds())
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            {"code": "resend_too_soon", "message": f"Wait {wait} seconds before asking for another code.",
             "retry_after": wait},
            headers={"Retry-After": str(wait)},
        )

    if not fixed:
        await ratelimit.check(
            request, f"code:{purpose}", destination,
            (settings.AUTH_CODE_MAX_PER_HOUR, 3600.0), SEND_LIMIT_IP,
        )

    issued = Issued(
        channel=channel,
        destination=mask(channel, destination),
        expires_in=settings.AUTH_CODE_TTL_MINUTES * 60,
        resend_in=settings.AUTH_CODE_RESEND_SECONDS,
    )
    if not send and channel == SMS:
        # Same refusal a real send would get once today's allowance is gone.
        await reserve_sms(destination, purpose, dry_run=True)

    # Only the newest code for an address is ever live.
    await _codes().update_many(
        {"purpose": purpose, "destination": destination, "consumed_at": None},
        {"$set": {"consumed_at": now, "superseded": True}},
    )
    # No account (send=False): a code nobody knows, so the row behaves like a
    # real one — cooldown, tries left, voided — and can never be spent.
    code = settings.TEST_LOGIN_CODE.strip() if fixed else (new_code() if send else secrets.token_hex(16))
    record = {
        "purpose": purpose,
        "channel": channel,
        "destination": destination,
        "user_id": user_id if send else "",
        "code_digest": digest(purpose, destination, code),
        "attempts": 0,
        "payload": payload or {},
        "created_at": now,
        "expires_at": now + timedelta(minutes=settings.AUTH_CODE_TTL_MINUTES),
        "consumed_at": None,
    }
    if fixed:
        record["fixed"] = True
    if not send:
        record["decoy"] = True
    inserted = await _codes().insert_one(record)

    if fixed or not send:
        return issued  # a test account or no account: nothing is sent
    if channel == SMS:
        await reserve_sms(destination, purpose)
    if background is not None:
        _background_send(background, channel, destination, code, purpose, name, template,
                         inserted.inserted_id)
        return issued
    if not await _deliver(channel, destination, code, purpose, name, template):
        await _codes().update_one({"_id": inserted.inserted_id}, {"$set": {"consumed_at": now, "failed": True}})
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            {"code": "send_failed", "message": "We couldn't send your code just now. Try again in a minute."},
        )
    return issued


# ── the daily SMS allowance ─────────────────────────────────────────────────

SMS_LEDGER = "sms_ledger"

SMS_LIMIT_REACHED = {
    "code": "sms_limit",
    "message": "We can't send more SMS codes today. Please use the code we send to your email instead.",
}


def _ist_day() -> str:
    ist = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist).strftime("%Y-%m-%d")


#: Ledger rows that spend the platform allowance. Rows written with
#: `counts: False` (an allowance asked for a number no account can use) only
#: count against that number, so the answer looks the same without the cost.
SPENDS_ALLOWANCE = {"counts": {"$ne": False}}


async def sms_used_today() -> int:
    return await get_database()[SMS_LEDGER].count_documents({"day": _ist_day(), **SPENDS_ALLOWANCE})


async def reserve_sms(destination: str, purpose: str, *, dry_run: bool = False, counts: bool = True) -> None:
    """
    Count one SMS against today's allowance, or refuse (429 `sms_limit`).

    Every SMS goes through here first — including Firebase's, which the
    browser sends itself: the screen asks for an allowance before it lets
    Firebase send, so the platform never sends more than SMS_DAILY_LIMIT a
    day (10 = Firebase's free tier) or more than SMS_PER_NUMBER_DAILY to one
    number. The day is counted in India time.
    """
    day = _ist_day()
    ledger = get_database()[SMS_LEDGER]
    if settings.SMS_DAILY_LIMIT > 0:
        sent_today = await ledger.count_documents({"day": day, **SPENDS_ALLOWANCE})
        if sent_today >= settings.SMS_DAILY_LIMIT:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, SMS_LIMIT_REACHED)
    if settings.SMS_PER_NUMBER_DAILY > 0:
        to_number = await ledger.count_documents({"day": day, "destination": destination})
        if to_number >= settings.SMS_PER_NUMBER_DAILY:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, {
                "code": "sms_limit",
                "message": "Too many SMS codes to this number today. Please use the code we send to your email.",
            })
    if dry_run:
        return
    row = {"day": day, "destination": destination, "purpose": purpose,
           "provider": settings.PHONE_PROVIDER, "created_at": _now()}
    if not counts:
        row["counts"] = False
    await ledger.insert_one(row)


async def has_live(purpose: str, destination: str) -> bool:
    """Is there an unspent, unexpired code for this purpose and address?"""
    return await _codes().find_one({
        "purpose": purpose, "destination": destination,
        "consumed_at": None, "expires_at": {"$gt": _now()},
    }, {"_id": 1}) is not None


# ── verify ──────────────────────────────────────────────────────────────────

# One message for "expired", "never sent" and "sent to a different address", so
# a stranger cannot tell which — while still pointing her at the likely slip.
CODE_MISMATCH_MESSAGE = (
    "That code doesn't match, or it has expired. "
    "Check the email or mobile number and the code, or ask for a new one."
)
_EXPIRED = {"code": "code_expired", "message": CODE_MISMATCH_MESSAGE}


async def verify(request: Request, *, purpose: str, destination: str, code: str) -> dict:
    """
    Spend a code. Returns its record (with `payload` and `user_id`) or raises 400.

    Wrong answers count against the code (five voids it) and against the
    address (fifteen an hour), so neither "guess five, ask again" nor a slow
    spread of guesses gets anywhere near a million.

    **Every try is paid for before it is judged.** The attempt is taken with
    one conditional `$inc` (`attempts < MAX`, unspent) and only then is the
    digest compared. Reading the count and incrementing it separately let a
    burst of parallel guesses all read "0 tries used" and get far more than
    five goes at one code.
    """
    await ratelimit.check(request, f"verify:{purpose}", destination, VERIFY_LIMIT, VERIFY_LIMIT_IP)

    clean = "".join(ch for ch in str(code or "") if ch.isdigit())
    now = _now()
    record = await _codes().find_one(
        {"purpose": purpose, "destination": destination, "consumed_at": None},
        sort=[("created_at", -1)],
    )
    expires = _aware((record or {}).get("expires_at"))
    if not record or not expires or expires <= now:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, _EXPIRED)
    fixed = bool(record.get("fixed"))
    if fixed and await test_code_locked(destination):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, _EXPIRED)

    claimed = await _codes().find_one_and_update(
        {"_id": record["_id"], "consumed_at": None,
         "attempts": {"$lt": settings.AUTH_CODE_MAX_ATTEMPTS}},
        {"$inc": {"attempts": 1}},
        return_document=ReturnDocument.AFTER,
    )
    if not claimed:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, _EXPIRED)

    if len(clean) != 6 or not hmac.compare_digest(claimed["code_digest"], digest(purpose, destination, clean)):
        if fixed:
            await ratelimit.record_failure(TEST_CODE_FAIL_BUCKET, destination, TEST_CODE_FAIL_WINDOW)
        left = settings.AUTH_CODE_MAX_ATTEMPTS - int(claimed.get("attempts") or 0)
        if left <= 0:
            await _codes().update_one({"_id": record["_id"], "consumed_at": None},
                                      {"$set": {"consumed_at": now, "voided": True}})
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                {"code": "code_voided", "message": "Too many wrong tries. Ask for a new code."},
            )
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            {"code": "code_wrong",
             "message": f"That code isn't right. {left} {'try' if left == 1 else 'tries'} left.",
             "attempts_left": left},
        )

    # Single use, even when two requests race with the same right answer.
    spent = await _codes().find_one_and_update(
        {"_id": record["_id"], "consumed_at": None},
        {"$set": {"consumed_at": now}},
        return_document=ReturnDocument.AFTER,
    )
    if not spent:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, _EXPIRED)
    await ratelimit.forget(f"verify:{purpose}", destination)
    return spent


# ── Firebase phone codes ────────────────────────────────────────────────────
#
# With PHONE_PROVIDER=firebase, Firebase sends the SMS and checks the code on the
# client, then gives the client an ID token. We verify that token ourselves —
# Google's signature, our project as audience, Google's issuer, not expired —
# and read the phone number out of it. No Firebase SDK on the server: the
# signing certificates are public and `jose` + `cryptography` already do RS256.

_FIREBASE_CERTS_URL = (
    "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
)
_firebase_certs: dict = {"keys": {}, "fetched": 0.0}


async def _firebase_keys() -> dict:
    import time

    import httpx
    from cryptography import x509
    from cryptography.hazmat.primitives import serialization

    if _firebase_certs["keys"] and time.time() - _firebase_certs["fetched"] < 3600:
        return _firebase_certs["keys"]
    async with httpx.AsyncClient(timeout=6.0) as client:
        response = await client.get(_FIREBASE_CERTS_URL)
    response.raise_for_status()
    keys = {}
    for kid, pem in response.json().items():
        cert = x509.load_pem_x509_certificate(pem.encode("utf-8"))
        keys[kid] = cert.public_key().public_bytes(
            serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
        ).decode("utf-8")
    _firebase_certs.update(keys=keys, fetched=time.time())
    return keys


async def verify_firebase_phone(id_token: str) -> str:
    """The E.164 phone number a genuine Firebase ID token vouches for, or ''."""
    from jose import JWTError, jwt

    project = settings.FIREBASE_PROJECT_ID
    if not project:
        return ""
    try:
        header = jwt.get_unverified_header(id_token)
        key = (await _firebase_keys()).get(header.get("kid", ""))
        if not key:
            return ""
        claims = jwt.decode(
            id_token, key, algorithms=["RS256"], audience=project,
            issuer=f"https://securetoken.google.com/{project}",
            options={"verify_at_hash": False},
        )
    except (JWTError, Exception):  # noqa: BLE001 - any failure is "not vouched for"
        logger.info("codes: rejected a Firebase phone token")
        return ""
    return str(claims.get("phone_number") or "")
