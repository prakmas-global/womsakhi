"""
A brake on the endpoints worth attacking.

Only sign-in, sign-up and password reset. Rate-limiting the whole API would
punish a woman on a bad connection whose phone retries, and would do nothing
useful — reading her own bookings a hundred times is not an attack, it is a
train tunnel.

**Per IP *and* per identifier.** Per-IP alone lets one attacker spread across a
botnet and try one password on ten thousand accounts. Per-identifier alone lets
one attacker sit on one IP and try ten thousand passwords on one account. Both
together close both, and neither costs more than a dictionary lookup.

**Shared across every server.** Production runs several Cloud Run instances,
and a counter held in one instance's memory lets an attacker multiply the
budget by the instance count. So the counters live in a shared store: Redis
when `REDIS_URL` is set, otherwise MongoDB (`rate_limits`, one row per key per
window, cleaned up by a TTL index). Process memory is only the fallback for
when that store itself fails — see `_local_check`.
"""

from __future__ import annotations

import asyncio
import logging
import math
import time
from collections import deque
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional

from fastapi import HTTPException, Request, status
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.core import shared_state

log = logging.getLogger(__name__)

#: Per identifier: strict. Six goes a minute at one account is generous for a
#: woman typing on a phone keyboard and useless for guessing a password.
SIGN_IN = (6, 60.0)
SIGN_UP = (4, 300.0)

#: Per IP: **deliberately loose**, and this is the important one to get right.
#:
#: The first version used the same six-a-minute limit for both, and it locked
#: this developer out of his own test account after seven wrong passwords from
#: one address. On this platform that is not a lab curiosity — women sign in
#: from a Common Service Centre, a community hall, or a carrier NAT that puts a
#: whole district behind one address. A tight per-IP limit does not stop an
#: attacker with a botnet; it stops twenty women at one computer centre.
#:
#: So per-IP is set where it costs a script something and costs a shared
#: connection nothing. The real protection against guessing is the per-account
#: limit above, and the account lockout that already existed.
SIGN_IN_IP = (60, 60.0)
SIGN_UP_IP = (20, 300.0)

#: Endpoints that were never wired up, with budgets chosen the same way as the
#: ones above: strict per account, loose per IP, and nothing that could lock a
#: computer centre out of a shared connection.
#:
#: **Documents.** Ten megabytes a file, no limit on how many. One authenticated
#: account can fill the disk that holds every other woman's identity documents,
#: and it does not even need to be malicious — a retry loop on a bad connection
#: does it by accident. Six an hour is more IDs than any real applicant submits.
DOCUMENT_UPLOAD = (6, 3600.0)
DOCUMENT_UPLOAD_IP = (40, 3600.0)

#: **Confirmation email resends.** The token is 256 bits, so this is not about
#: guessing it. It is about the mail: an unbounded resend is a way to make a
#: woman's inbox fill with WomSakhi messages, and on a shared or watched phone
#: that is not a nuisance, it is a disclosure. It is also our SMTP bill.
EMAIL_RESEND = (3, 900.0)
EMAIL_RESEND_IP = (30, 900.0)

#: **Password reset.** Both halves — asking for a link, and spending one. Guessing
#: `secrets.token_urlsafe(32)` is not feasible; this is here so that the reset
#: *consumer*, when it is written, cannot be used to enumerate live tokens or to
#: hammer an account. Keyed on the token for the consumer, the email for the
#: request.
PASSWORD_RESET = (5, 900.0)
PASSWORD_RESET_IP = (40, 900.0)

# Deliberately absent: the safety alert. There is no budget, no bucket and no
# limit on `POST /safety/alerts`, and there must never be one. A woman pressing
# that button twice because the first press did not visibly do anything must
# get an alert both times. The failure mode of a rate limit here is a 429 in
# front of someone in danger, and no amount of abuse-prevention is worth it.

_hits: dict[str, deque[float]] = {}


def client_ip(request: Optional[Request]) -> str:
    """
    The caller's address, or '' when there is none.

    Behind a proxy the socket address is the proxy, so the answer comes from
    X-Forwarded-For — but from its END, not its start. Each proxy APPENDS the
    address it received the request from; Cloud Run's Google front end appends
    the real client. Whatever sits before that was written by the client and
    can say anything, so reading the FIRST entry let one attacker be a new IP
    on every request. With TRUSTED_PROXY_HOPS proxies in front, the client is
    the entry that many places from the end. With 0, or no header, it is the
    socket peer.
    """
    if request is None:
        return ""
    from app.core.config import settings

    hops = int(getattr(settings, "TRUSTED_PROXY_HOPS", 1) or 0)
    fwd = request.headers.get("x-forwarded-for", "")
    if hops > 0 and fwd:
        entries = [e.strip() for e in fwd.split(",") if e.strip()]
        if entries:
            return entries[-hops] if len(entries) >= hops else entries[0]
    return request.client.host if request.client else ""


def _client_ip(request: Request) -> str:
    return client_ip(request) or "unknown"


# ── the MongoDB store ───────────────────────────────────────────────────────
#
# Used whenever `REDIS_URL` is empty, which is how production runs. One row per
# (bucket, key, window start):
#
#     {_id: "code:signin:id:her@x.com|1790000000", bucket, key, window_start,
#      count, expires_at}
#
# A FIXED window, like the Redis path, and for the same reason: one atomic
# `$inc` upsert is one round trip and cannot be torn, where a sliding window
# would need a read, a trim and a write that two servers can interleave. The
# window start is aligned to the epoch, so every server computes the same row
# for the same moment without talking to each other. When the window ends, the
# next hit lands on a new row; the old one is deleted by the TTL index on
# `expires_at` (see app/db/indexes.py). The TTL sweep runs about once a minute,
# which is fine: an expired row is never read again, only removed.

COLLECTION = "rate_limits"
#: Wall-clock seconds. A name of its own so a test can move time forward.
_wall = time.time
#: A slow database must not become a slow sign-in. Past this the check gives up
#: and counts locally, the way a Redis timeout does.
MONGO_TIMEOUT_SECONDS = 1.5


def _default_db():
    from app.db.mongodb import get_database

    return get_database()


#: Swappable so tests can point the store at a throwaway mongod without going
#: through `connect_db()` (the suite guards against a global client).
db_provider: Callable[[], object] = _default_db

_last_warning = 0.0


def _warn(what: str, exc: BaseException) -> None:
    """Log a store failure — at most once a minute, so an outage is one line, not ten thousand."""
    global _last_warning
    now = time.monotonic()
    if now - _last_warning >= 60:
        _last_warning = now
        log.warning("rate limiter: MongoDB store %s failed (%s: %s); counting in this process "
                    "until it answers again", what, type(exc).__name__, exc)


def _window(window: float, now: float) -> tuple[int, int]:
    """(start, end) of the fixed window `now` falls in, in whole epoch seconds."""
    size = max(1, int(math.ceil(window)))
    start = int(now // size) * size
    return start, start + size


async def _mongo_hit(bucket: str, key: str, window: float) -> Optional[tuple[int, int]]:
    """
    Count one attempt against `key`. Returns (count, seconds until the window
    ends), or None if the store did not answer — the caller then counts locally.

    One `find_one_and_update(upsert=True)`: the increment and the read of the
    new total are the same operation, so two servers hitting the same key at
    the same instant both count, and each sees its own total.

    Two upserts racing to CREATE the same row can both miss and both try to
    insert; one wins, the other gets DuplicateKeyError. Retrying once is enough,
    because by then the row exists and the retry is a plain `$inc`.
    """
    now = _wall()
    start, end = _window(window, now)
    row_id = f"{key}|{start}"
    try:
        coll = db_provider()[COLLECTION]
    except Exception as exc:  # noqa: BLE001 — not connected, misconfigured
        _warn("lookup", exc)
        return None

    async def _once():
        return await coll.find_one_and_update(
            {"_id": row_id},
            {
                "$inc": {"count": 1},
                "$setOnInsert": {
                    "bucket": bucket,
                    "key": key,
                    "window_start": datetime.fromtimestamp(start, timezone.utc),
                    "expires_at": datetime.fromtimestamp(end, timezone.utc) + timedelta(seconds=1),
                },
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
            projection={"count": 1},
        )

    try:
        try:
            row = await asyncio.wait_for(_once(), MONGO_TIMEOUT_SECONDS)
        except DuplicateKeyError:
            row = await asyncio.wait_for(_once(), MONGO_TIMEOUT_SECONDS)
    except Exception as exc:  # noqa: BLE001 — timeout, network, second duplicate
        _warn("increment", exc)
        return None
    if not row:
        return None
    return int(row.get("count") or 0), max(1, int(math.ceil(end - now)))


async def _mongo_forget(key: str) -> None:
    try:
        coll = db_provider()[COLLECTION]
        await asyncio.wait_for(coll.delete_many({"key": key}), MONGO_TIMEOUT_SECONDS)
    except Exception as exc:  # noqa: BLE001
        _warn("forget", exc)


def _too_many(wait: int) -> HTTPException:
    return HTTPException(
        status.HTTP_429_TOO_MANY_REQUESTS,
        f"Too many tries. Wait {wait} seconds and try again.",
        headers={"Retry-After": str(wait)},
    )


def _local_check(key: str, attempts: int, window: float, now: float) -> None:
    """
    The in-process sliding window: what this module did before it was shared,
    and now only the fallback for when the shared store errors.

    ── Why a store failure fails OPEN ──────────────────────────────────────
    If Mongo (or Redis) does not answer, the choice is between refusing the
    request and letting it through with a weaker limit. Refusing would turn a
    database hiccup into "nobody can sign in", on the one screen every woman
    has to pass, and a 500 on sign-in is indistinguishable from the app being
    down. Letting it through costs little: this local counter still caps each
    server, the per-code wrong-guess limits in `codes.py` still hold (they live
    in the codes collection), and the outage is short and logged. So a failed
    store degrades the limit to per-instance, it never removes it and never
    blocks a sign-in.
    """
    seen = _hits.setdefault(key, deque())
    # Drop what has aged out. The deque is ordered, so this stops at the
    # first live entry rather than walking the whole thing.
    while seen and now - seen[0] > window:
        seen.popleft()
    if len(seen) >= attempts:
        raise _too_many(int(window - (now - seen[0])) + 1)
    seen.append(now)


async def check(
    request: Request,
    bucket: str,
    identifier: str,
    limit: tuple[int, float],
    ip_limit: tuple[int, float] | None = None,
) -> None:
    """
    Raise 429 if this identifier — or, far more loosely, this IP — has had too
    many goes.

    ── Shared when it can be, in-process when it cannot ─────────────────────
    Counting in a module-level dict is correct for one worker and a security
    hole for two: `MAX_FAILED_LOGINS = 5` across four workers is up to twenty
    password attempts before a lockout, because each worker counts to five by
    itself. Nothing reports that. The setting still reads five.

    So the counters are shared and the limit means what it says however many
    servers there are: in Redis when `REDIS_URL` is set, in MongoDB when it is
    not. If the store does not answer in time, this falls back to counting in
    process — degraded but working, because a slow store must never become a
    failed sign-in (see `_local_check`).

    Both shared counters are a FIXED window where the local one is
    sliding. That is a real difference: at a window boundary a fixed window can
    allow up to two windows' worth in quick succession. It is the standard
    trade for a distributed limiter, and it is the right one here — the
    alternative is a sorted-set implementation whose failure modes are far
    worse than a brief doubling of an already generous allowance.
    """
    now = time.monotonic()
    checks = [(f"{bucket}:id:{identifier.lower()}", limit)]
    if ip_limit:
        checks.append((f"{bucket}:ip:{_client_ip(request)}", ip_limit))

    for key, (attempts, window) in checks:
        if shared_state.configured():
            shared = await shared_state.hit(f"rl:{key}", window)
            if shared is not None:
                if shared > attempts:
                    raise _too_many(int(window))
                continue
        else:
            counted = await _mongo_hit(bucket, key, window)
            if counted is not None:
                total, wait = counted
                if total > attempts:
                    raise _too_many(wait)
                continue
        _local_check(key, attempts, window, now)


async def _mongo_peek(key: str, window: float) -> Optional[int]:
    now = _wall()
    start, _ = _window(window, now)
    try:
        coll = db_provider()[COLLECTION]
        row = await asyncio.wait_for(coll.find_one({"_id": f"{key}|{start}"}, {"count": 1}),
                                     MONGO_TIMEOUT_SECONDS)
    except Exception as exc:  # noqa: BLE001
        _warn("peek", exc)
        return None
    return int((row or {}).get("count") or 0)


async def failures(bucket: str, identifier: str, window: float) -> int:
    """
    How many failures `record_failure` has counted for this identifier in the
    current fixed window — WITHOUT counting one. For caps that only failures
    should spend ("ten wrong tries today locks it"), where `check` would also
    charge the successful attempts.
    """
    key = f"{bucket}:id:{identifier.lower()}"
    if shared_state.configured():
        try:
            raw = await shared_state.client().get(f"rl:{key}")
            return int(raw or 0)
        except Exception:  # noqa: BLE001
            pass
    else:
        counted = await _mongo_peek(key, window)
        if counted is not None:
            return counted
    seen = _hits.get(key) or deque()
    now = time.monotonic()
    return sum(1 for t in seen if now - t <= window)


async def record_failure(bucket: str, identifier: str, window: float) -> int:
    """Count one failure against the identifier; returns the running total."""
    key = f"{bucket}:id:{identifier.lower()}"
    if shared_state.configured():
        shared = await shared_state.hit(f"rl:{key}", window)
        if shared is not None:
            return shared
    else:
        counted = await _mongo_hit(bucket, key, window)
        if counted is not None:
            return counted[0]
    seen = _hits.setdefault(key, deque())
    seen.append(time.monotonic())
    return len(seen)


async def forget(bucket: str, identifier: str) -> None:
    """
    Clear an identifier's budget after a success.

    Without this, a woman who mistypes her password four times and then gets it
    right is still two tries from being locked out of her own account for a
    minute — punished for eventually succeeding.
    """
    key = f"{bucket}:id:{identifier.lower()}"
    if shared_state.configured():
        await shared_state.forget(f"rl:{key}")
    else:
        await _mongo_forget(key)
    _hits.pop(key, None)
