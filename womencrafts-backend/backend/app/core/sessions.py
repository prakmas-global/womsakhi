"""
Signed-in devices.

A session is one device she signed in on. It is a row in `auth_sessions`, and
it is what lets her stay signed in for a month on her own phone while every
access token stays short:

    access token    a 30-minute JWT carrying `sid`, in the httpOnly cookie
    refresh token   a random secret, httpOnly, sent only to /api/v1/auth,
                    stored here as a SHA-256 digest and ROTATED on every use

**Why rotate.** A refresh token that never changes is a month-long key worth
stealing. Rotating means a stolen copy works at most once — and the moment the
real device and the thief both present the same generation, one of them is
presenting a token that has already been spent. That is treated as theft: the
whole session ends, on both sides, and she signs in again.

**Why a row per device.** "Sign out that phone" and "is this session still
allowed" both need something to point at. `deps.get_current_user` checks the
`sid` in every access token against this table (cached for seconds), so ending
a session ends it now, not in thirty minutes.

Member sessions slide: every refresh pushes the end another MEMBER_SESSION_DAYS
out, so a woman who uses the app weekly is never asked to sign in again. Staff
sessions do not slide — they can open identity documents, and a working day is
long enough.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, Request, Response, status

from app.core import cache
from app.core.config import settings
from app.core.rbac import MEMBER_ROLE, role_name
from app.core.security import TOKEN_VERSION_CLAIM, create_access_token, token_version_of
from app.core.session import COOKIE_NAME, clear_session_cookie, set_session_cookie
from app.db.mongodb import get_database

COLLECTION = "auth_sessions"
REFRESH_COOKIE = "refresh_token"
#: Path "/" (not /api/v1/auth) so the Next.js route guard sees it on page
#: requests and can renew an expired access token before rendering — otherwise
#: a month-long session would still bounce her to /signin after 30 minutes. It
#: is httpOnly and SameSite=Lax like the access cookie, and only
#: `/auth/refresh` ever reads it.
REFRESH_PATH = "/"
#: A just-rotated refresh token presented again inside this window is a race
#: (several tabs or prefetches renewing at once), not theft: it gets a fresh
#: access token and no new refresh token. After the window it ends the session.
ROTATION_GRACE_SECONDS = 30
#: How many spent refresh generations a session remembers. Presenting any of
#: them (outside the grace above) is reuse and ends the session. At one
#: rotation per 30-minute access token that is two days of non-stop use.
SPENT_HISTORY = 100
SID_CLAIM = "sid"

KIND_WEB = "web"
KIND_APP = "app"
APP_CLIENT_HEADER = "x-womsakhi-client"


def _sessions():
    return get_database()[COLLECTION]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(value) -> Optional[datetime]:
    if not isinstance(value, datetime):
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def is_member_account(user: dict) -> bool:
    return role_name(user) == MEMBER_ROLE


def lifetime_for(user: dict) -> timedelta:
    if is_member_account(user):
        return timedelta(days=settings.MEMBER_SESSION_DAYS)
    return timedelta(hours=settings.STAFF_SESSION_HOURS)


def device_label(user_agent: str) -> str:
    """`Chrome on Android` — what she will recognise in her list of devices."""
    ua = (user_agent or "").lower()
    if "womsakhi-app" in ua:
        browser = "WomSakhi app"
    elif "edg/" in ua:
        browser = "Edge"
    elif "samsungbrowser" in ua:
        browser = "Samsung Internet"
    elif "firefox" in ua or "fxios" in ua:
        browser = "Firefox"
    elif "chrome" in ua or "crios" in ua:
        browser = "Chrome"
    elif "safari" in ua:
        browser = "Safari"
    else:
        browser = "Browser"
    if "android" in ua:
        system = "Android"
    elif "iphone" in ua:
        system = "iPhone"
    elif "ipad" in ua:
        system = "iPad"
    elif "windows" in ua:
        system = "Windows"
    elif "mac os" in ua or "macintosh" in ua:
        system = "Mac"
    elif "linux" in ua:
        system = "Linux"
    else:
        system = "an unknown device"
    return f"{browser} on {system}"


def _client_ip(request: Optional[Request]) -> str:
    """The caller's address — one rule for the whole app; see `ratelimit.client_ip`."""
    from app.core.ratelimit import client_ip

    return client_ip(request)


def is_app_request(request: Optional[Request]) -> bool:
    """Does this request come from the mobile app (which has no cookie jar)?"""
    return request is not None and request.headers.get(APP_CLIENT_HEADER, "").lower() == "app"


def access_token_for(user: dict, sid: str) -> str:
    return create_access_token({
        "sub": str(user["_id"]),
        "email": user.get("email", ""),
        "role": role_name(user),
        TOKEN_VERSION_CLAIM: token_version_of(user),
        SID_CLAIM: sid,
    })


def _set_refresh_cookie(response: Response, token: str, max_age: int) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=max_age,
        path=REFRESH_PATH,
        domain=settings.COOKIE_DOMAIN or None,
    )


def clear_cookies(response: Response) -> None:
    clear_session_cookie(response)
    response.delete_cookie(key=REFRESH_COOKIE, path=REFRESH_PATH, domain=settings.COOKIE_DOMAIN or None)


async def start(
    response: Optional[Response],
    user: dict,
    request: Optional[Request] = None,
    *,
    kind: str = KIND_WEB,
    method: str = "email_code",
) -> dict:
    """
    Open a session for `user` on this device and set its cookies.

    Returns `{access_token, refresh_token, sid, expires_at}`. A browser uses the
    cookies and can ignore the body; the mobile app has no cookie jar and keeps
    the two tokens from the body in secure storage instead.
    """
    # The mobile app announces itself; only an app session can later approve a
    # browser sign-in (see routes/auth_app.py). A header is enough to *label*
    # a session — it grants nothing until the app has signed in with a code.
    if is_app_request(request):
        kind = KIND_APP
    now = _now()
    sid = secrets.token_urlsafe(18)
    refresh = secrets.token_urlsafe(32)
    lifetime = lifetime_for(user)
    user_agent = (request.headers.get("user-agent", "") if request else "")[:300]
    doc = {
        "sid": sid,
        "user_id": str(user["_id"]),
        "kind": kind,
        "method": method,
        "label": device_label(user_agent),
        "user_agent": user_agent,
        "ip": _client_ip(request),
        "token_version": token_version_of(user),
        "refresh_hash": _digest(refresh),
        "prev_refresh_hash": None,
        "spent_refresh_hashes": [],
        "created_at": now,
        "last_used_at": now,
        "expires_at": now + lifetime,
        "revoked_at": None,
    }
    await _sessions().insert_one(doc)
    access = access_token_for(user, sid)
    if response is not None:
        set_session_cookie(response, access)
        _set_refresh_cookie(response, refresh, int(lifetime.total_seconds()))
    return {"access_token": access, "refresh_token": refresh, "sid": sid,
            "expires_at": doc["expires_at"].isoformat(), "kind": kind}


async def _revoke_where(query: dict, reason: str) -> int:
    now = _now()
    rows = await _sessions().find({**query, "revoked_at": None}, {"sid": 1}).to_list(1000)
    if not rows:
        return 0
    await _sessions().update_many(
        {"sid": {"$in": [r["sid"] for r in rows]}},
        {"$set": {"revoked_at": now, "revoked_reason": reason}},
    )
    for row in rows:
        cache.forget(f"session:{row['sid']}")
    return len(rows)


async def revoke(sid: str, reason: str = "signed_out") -> int:
    if not sid:
        return 0
    return await _revoke_where({"sid": sid}, reason)


async def revoke_all(user_id: str, reason: str = "signed_out_everywhere", keep_sid: str = "") -> int:
    if not user_id:
        return 0
    query: dict = {"user_id": user_id}
    if keep_sid:
        query["sid"] = {"$ne": keep_sid}
    return await _revoke_where(query, reason)


async def is_live(sid: str) -> bool:
    """Is this session still allowed? Cached briefly; `revoke` forgets the entry."""

    async def _load() -> bool:
        row = await _sessions().find_one({"sid": sid}, {"revoked_at": 1, "expires_at": 1})
        if not row or row.get("revoked_at"):
            return False
        expires = _aware(row.get("expires_at"))
        return bool(expires and expires > _now())

    return await cache.cached(f"session:{sid}", cache.USER_TTL, _load)


async def rotate(request: Request, response: Optional[Response], refresh_token: str) -> tuple[dict, dict]:
    """
    Spend a refresh token and hand back a fresh pair. Returns (user, tokens).

    Presenting an already-rotated token means two holders of one session: the
    session is ended and both are sent to sign in again.
    """
    from bson import ObjectId

    from app.models.user import UserModel

    ended = HTTPException(status.HTTP_401_UNAUTHORIZED,
                          {"code": "session_ended", "message": "Please sign in again."})
    if not refresh_token:
        raise ended
    digest = _digest(refresh_token)
    row = await _sessions().find_one({"refresh_hash": digest})
    if not row:
        reused = await _find_spent(digest)
        if not reused or reused.get("revoked_at"):
            raise ended
        # Only the IMMEDIATELY previous token gets the race grace; any older
        # generation is a second holder, however recently it rotated.
        rotated = _aware(reused.get("rotated_at"))
        if (reused.get("prev_refresh_hash") == digest and rotated
                and (_now() - rotated).total_seconds() <= ROTATION_GRACE_SECONDS):
            return await _grace_access(reused, response)
        await revoke(reused["sid"], reason="refresh_reuse")
        raise ended
    now = _now()
    expires = _aware(row.get("expires_at"))
    if row.get("revoked_at") or not expires or expires <= now:
        raise ended

    user = await get_database()[UserModel.collection_name].find_one({"_id": ObjectId(row["user_id"])})
    if not user or not user.get("is_active", True):
        await revoke(row["sid"], reason="account_inactive")
        raise ended
    if token_version_of(user) > int(row.get("token_version") or 0):
        await revoke(row["sid"], reason="token_version")
        raise ended

    fresh = secrets.token_urlsafe(32)
    updates = {
        "refresh_hash": _digest(fresh),
        "prev_refresh_hash": digest,
        "rotated_at": now,
        "last_used_at": now,
        "ip": _client_ip(request) or row.get("ip", ""),
    }
    if is_member_account(user):
        updates["expires_at"] = now + lifetime_for(user)
    result = await _sessions().update_one(
        {"_id": row["_id"], "refresh_hash": digest},
        {"$set": updates,
         # Every spent generation is remembered (the last SPENT_HISTORY), not
         # just the one before: a thief who rotates twice has moved the real
         # device two generations back, and that must still be caught.
         "$push": {"spent_refresh_hashes": {"$each": [digest], "$slice": -SPENT_HISTORY}}},
    )
    if result.modified_count != 1:
        # Lost a race with another refresh of the same generation.
        raise ended

    new_expiry = _aware(updates.get("expires_at")) or expires
    access = access_token_for(user, row["sid"])
    if response is not None:
        set_session_cookie(response, access)
        _set_refresh_cookie(response, fresh, max(60, int((new_expiry - now).total_seconds())))
    return user, {"access_token": access, "refresh_token": fresh, "sid": row["sid"],
                  "expires_at": new_expiry.isoformat()}


_spent_index_ready = False


async def _ensure_spent_index() -> None:
    """
    The spent-hash lookup needs an index or it scans every session. Created
    here, once per process, because app/db/indexes.py belongs to another
    change; it is idempotent, and harmless to add there too.
    """
    global _spent_index_ready
    if _spent_index_ready:
        return
    try:
        await _sessions().create_index("spent_refresh_hashes", name="spent_refresh", sparse=True)
        _spent_index_ready = True
    except Exception:  # noqa: BLE001 - a missing index is slow, not wrong
        pass


async def _find_spent(digest: str) -> Optional[dict]:
    """The session that once issued this (since-rotated) refresh token, if any."""
    await _ensure_spent_index()
    return await _sessions().find_one(
        {"$or": [{"prev_refresh_hash": digest}, {"spent_refresh_hashes": digest}]})


async def sid_for_refresh(refresh_token: str) -> str:
    """The session a refresh token — current or already spent — belongs to, or ''."""
    if not refresh_token:
        return ""
    digest = _digest(refresh_token)
    row = await _sessions().find_one({"refresh_hash": digest}, {"sid": 1})
    if not row:
        row = await _find_spent(digest)
    return str((row or {}).get("sid") or "")


async def _grace_access(row: dict, response: Optional[Response]) -> tuple[dict, dict]:
    """A fresh access token for a session whose refresh just rotated under a race."""
    from bson import ObjectId

    from app.models.user import UserModel

    ended = HTTPException(status.HTTP_401_UNAUTHORIZED,
                          {"code": "session_ended", "message": "Please sign in again."})
    expires = _aware(row.get("expires_at"))
    if not expires or expires <= _now():
        raise ended
    user = await get_database()[UserModel.collection_name].find_one({"_id": ObjectId(row["user_id"])})
    if not user or not user.get("is_active", True) or token_version_of(user) > int(row.get("token_version") or 0):
        raise ended
    access = access_token_for(user, row["sid"])
    if response is not None:
        set_session_cookie(response, access)
    return user, {"access_token": access, "refresh_token": "", "sid": row["sid"],
                  "expires_at": expires.isoformat()}


async def list_for(user_id: str, current_sid: str = "") -> list[dict]:
    now = _now()
    out = []
    async for row in _sessions().find(
        {"user_id": user_id, "revoked_at": None, "expires_at": {"$gt": now}}
    ).sort("last_used_at", -1).limit(50):
        out.append({
            "id": row["sid"],
            "label": row.get("label", "") or "Unknown device",
            "kind": row.get("kind", KIND_WEB),
            "ip": row.get("ip", ""),
            "created_at": _aware(row.get("created_at")).isoformat() if row.get("created_at") else "",
            "last_used_at": _aware(row.get("last_used_at")).isoformat() if row.get("last_used_at") else "",
            "expires_at": _aware(row.get("expires_at")).isoformat() if row.get("expires_at") else "",
            "current": row["sid"] == current_sid,
        })
    return out


def sid_from_request(request: Request) -> str:
    """The `sid` of the access token this request carries, or ''."""
    from app.core.security import decode_access_token

    header = request.headers.get("authorization", "")
    token = header[7:] if header.lower().startswith("bearer ") else request.cookies.get(COOKIE_NAME, "")
    payload = decode_access_token(token) if token else None
    return str((payload or {}).get(SID_CLAIM) or "")
