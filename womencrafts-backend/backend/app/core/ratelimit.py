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

In-process, like the cache, with the same caveat: one uvicorn worker holds this
in memory, and multi-worker means each worker has its own budget. That is a
weaker limit, not a broken one — and the day this runs behind more than one
worker, this is a Redis counter with the same interface.
"""

from __future__ import annotations

import time
from collections import deque

from fastapi import HTTPException, Request, status

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


def _client_ip(request: Request) -> str:
    # Behind a proxy the socket address is the proxy. The first hop in
    # X-Forwarded-For is the client — trusted here because this only ever runs
    # behind our own ingress; exposed directly, that header is spoofable and
    # this should read the socket instead.
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def check(
    request: Request,
    bucket: str,
    identifier: str,
    limit: tuple[int, float],
    ip_limit: tuple[int, float] | None = None,
) -> None:
    """Raise 429 if this identifier — or, far more loosely, this IP — has had too many goes."""
    now = time.monotonic()
    checks = [(f"{bucket}:id:{identifier.lower()}", limit)]
    if ip_limit:
        checks.append((f"{bucket}:ip:{_client_ip(request)}", ip_limit))

    for key, (attempts, window) in checks:
        seen = _hits.setdefault(key, deque())
        # Drop what has aged out. The deque is ordered, so this stops at the
        # first live entry rather than walking the whole thing.
        while seen and now - seen[0] > window:
            seen.popleft()
        if len(seen) >= attempts:
            wait = int(window - (now - seen[0])) + 1
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                f"Too many tries. Wait {wait} seconds and try again.",
                headers={"Retry-After": str(wait)},
            )
        seen.append(now)


def forget(bucket: str, identifier: str) -> None:
    """
    Clear an identifier's budget after a success.

    Without this, a woman who mistypes her password four times and then gets it
    right is still two tries from being locked out of her own account for a
    minute — punished for eventually succeeding.
    """
    _hits.pop(f"{bucket}:id:{identifier.lower()}", None)
