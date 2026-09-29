"""
The WomSakhi app as her key to the website.

Three ways a phone that is already signed in to the app can sign a browser in,
none of which costs an SMS:

    QR          the website shows a QR code; she scans it in the app, sees which
                browser and where it is, and taps Allow
    App code    the app shows six digits that change every 30 seconds; she
                types them on the website next to her email
    Open web    "Open on web" inside the app mints a one-time link that signs
                the browser in and dies after 60 seconds

Only an APP session can do any of this (`kind == "app"` in `auth_sessions`,
set when the app signs in with `X-WomSakhi-Client: app`). A browser session
cannot approve another browser — otherwise one stolen cookie would be a key
that makes more keys.

Members only. Staff sign in with an email code and their authenticator app.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field
from pymongo import ReturnDocument

from app.core import codes, ratelimit, sessions
from app.core.audit import record
from app.core.deps import get_current_user
from app.core.rbac import MEMBER_ROLE, role_name
from app.core.two_factor import decrypt_secret, encrypt_secret, new_secret, verify_code
from app.db.mongodb import get_database
from app.models.user import UserModel
from app.routes.auth import _auth_response
from app.schemas.auth import AuthResponse

router = APIRouter(prefix="/auth", tags=["Authentication · App key"])

LINKS = "auth_links"
QR_SECONDS = 120
HANDOFF_SECONDS = 60


def _links():
    return get_database()[LINKS]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _aware(value):
    if isinstance(value, datetime) and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


async def require_app_session(request: Request, me: dict = Depends(get_current_user)) -> tuple[dict, dict]:
    """The caller, and the app session they are calling from. 403 for a browser."""
    sid = sessions.sid_from_request(request)
    row = await get_database()[sessions.COLLECTION].find_one({"sid": sid}) if sid else None
    if not row or row.get("kind") != sessions.KIND_APP:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the WomSakhi app can do this.")
    if role_name(me) != MEMBER_ROLE:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Staff sign in with their authenticator app.")
    return me, row


# ── the 30-second app code ──────────────────────────────────────────────────


@router.post("/app/key", summary="App: create this phone's sign-in key")
async def create_app_key(ctx: tuple = Depends(require_app_session)):
    """
    Returns a secret the app stores in the phone's keystore and uses to show a
    six-digit code every 30 seconds. One per app session: signing that phone
    out, or removing it from her devices, retires its key with it.
    """
    me, row = ctx
    secret = new_secret()
    await get_database()[sessions.COLLECTION].update_one(
        {"_id": row["_id"]}, {"$set": {"app_totp_secret": encrypt_secret(secret), "app_key_at": _now()}}
    )
    await record(me, "security.app_key", target=str(me["_id"]), detail=f"App key created on {row.get('label', '')}")
    return {"secret": secret, "digits": 6, "period": 30}


class AppCodeSignin(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=8)


@router.post("/signin/app-code", response_model=AuthResponse, summary="Sign in with the code the app shows")
async def signin_with_app_code(payload: AppCodeSignin, request: Request, response: Response):
    email = codes.normalise_email(payload.email)
    await ratelimit.check(request, "app_code", email, (6, 900.0), (60, 900.0))
    wrong = HTTPException(status.HTTP_400_BAD_REQUEST,
                          {"code": "code_wrong", "message": "That code isn't right. Check the WomSakhi app on your phone."})
    user = await get_database()[UserModel.collection_name].find_one({"email": email})
    if not user or not user.get("is_active", True) or role_name(user) != MEMBER_ROLE:
        raise wrong
    now = _now()
    async for row in get_database()[sessions.COLLECTION].find({
        "user_id": str(user["_id"]), "kind": sessions.KIND_APP, "revoked_at": None,
        "expires_at": {"$gt": now}, "app_totp_secret": {"$exists": True},
    }):
        if verify_code(decrypt_secret(row["app_totp_secret"]), payload.code):
            await ratelimit.forget("app_code", email)
            tokens = await sessions.start(response, user, request, method="app_code")
            await record(user, "security.signin", target=str(user["_id"]),
                         detail=f"Signed in on the web with the code from {row.get('label', 'her phone')}",
                         request=request)
            return await _auth_response(user, tokens)
    raise wrong


# ── QR sign-in ──────────────────────────────────────────────────────────────


@router.post("/qr/start", summary="Website: start a QR sign-in")
async def qr_start(request: Request):
    """
    The QR carries only an id. The `nonce` stays in this browser and is needed
    to collect the session, so a photo of somebody else's screen is useless.
    """
    await ratelimit.check(request, "qr_start", sessions._client_ip(request) or "unknown", (20, 600.0))
    qid, nonce = secrets.token_urlsafe(12), secrets.token_urlsafe(24)
    now = _now()
    user_agent = request.headers.get("user-agent", "")[:300]
    await _links().insert_one({
        "kind": "qr", "qid": qid, "nonce_hash": _digest(nonce), "status": "pending",
        "label": sessions.device_label(user_agent), "ip": sessions._client_ip(request),
        "created_at": now, "expires_at": now + timedelta(seconds=QR_SECONDS),
    })
    return {"qid": qid, "nonce": nonce, "qr": f"womsakhi://signin?q={qid}", "expires_in": QR_SECONDS}


async def _live_qr(qid: str) -> dict:
    row = await _links().find_one({"kind": "qr", "qid": qid})
    if not row or _aware(row.get("expires_at")) <= _now():
        raise HTTPException(status.HTTP_404_NOT_FOUND, {"code": "qr_expired", "message": "This QR code has expired."})
    return row


@router.get("/qr/{qid}", summary="App: who is asking to sign in")
async def qr_context(qid: str, ctx: tuple = Depends(require_app_session)):
    """What the app shows before she allows it: the browser, where, and when."""
    row = await _live_qr(qid)
    if row["status"] != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, "This sign-in was already answered.")
    return {"label": row.get("label", ""), "ip": row.get("ip", ""),
            "requested_at": _aware(row["created_at"]).isoformat()}


class QrAnswer(BaseModel):
    allow: bool


@router.post("/qr/{qid}/answer", summary="App: allow or refuse a QR sign-in")
async def qr_answer(qid: str, body: QrAnswer, request: Request, ctx: tuple = Depends(require_app_session)):
    me, row = ctx
    await _live_qr(qid)
    answered = await _links().find_one_and_update(
        {"kind": "qr", "qid": qid, "status": "pending"},
        {"$set": {"status": "approved" if body.allow else "refused", "user_id": str(me["_id"]),
                  "approved_by_sid": row["sid"], "answered_at": _now()}},
        return_document=ReturnDocument.AFTER,
    )
    if not answered:
        raise HTTPException(status.HTTP_409_CONFLICT, "This sign-in was already answered.")
    await record(me, "security.qr_answer", target=str(me["_id"]),
                 detail=f"{'Allowed' if body.allow else 'Refused'} a QR sign-in on {answered.get('label', '')}",
                 request=request)
    return {"status": answered["status"]}


class QrPoll(BaseModel):
    nonce: str


@router.post("/qr/{qid}/poll", summary="Website: has the app answered?")
async def qr_poll(qid: str, body: QrPoll, request: Request, response: Response):
    """
    `pending` until she answers. On `approved` this response carries the new
    session's cookies — once: the row is marked used in the same step.
    """
    row = await _links().find_one({"kind": "qr", "qid": qid})
    if not row or not secrets.compare_digest(row.get("nonce_hash", ""), _digest(body.nonce)):
        raise HTTPException(status.HTTP_404_NOT_FOUND, {"code": "qr_expired", "message": "This QR code has expired."})
    if _aware(row.get("expires_at")) <= _now() and row["status"] == "pending":
        return {"status": "expired"}
    if row["status"] != "approved":
        return {"status": row["status"]}
    claimed = await _links().find_one_and_update(
        {"_id": row["_id"], "status": "approved"}, {"$set": {"status": "used", "used_at": _now()}},
    )
    if not claimed:
        return {"status": "used"}
    user = await get_database()[UserModel.collection_name].find_one({"_id": ObjectId(row["user_id"])})
    if not user or not user.get("is_active", True):
        return {"status": "refused"}
    tokens = await sessions.start(response, user, request, method="qr")
    auth = await _auth_response(user, tokens)
    return {"status": "approved", **auth.model_dump()}


# ── "Open on web" from inside the app ───────────────────────────────────────


@router.post("/handoff", summary="App: a one-time link that opens the website signed in")
async def handoff_start(request: Request, ctx: tuple = Depends(require_app_session)):
    """
    The app opens `https://app.womsakhi.com/h#<code>`. The code sits in the URL
    fragment, which browsers never send to a server or put in a Referer, and the
    page trades it for a session with one POST.
    """
    me, row = ctx
    await ratelimit.check(request, "handoff", str(me["_id"]), (20, 600.0))
    code = secrets.token_urlsafe(32)
    now = _now()
    await _links().insert_one({
        "kind": "handoff", "code_hash": _digest(code), "user_id": str(me["_id"]),
        "from_sid": row["sid"], "status": "pending",
        "created_at": now, "expires_at": now + timedelta(seconds=HANDOFF_SECONDS),
    })
    return {"code": code, "path": f"/h#{code}", "expires_in": HANDOFF_SECONDS}


class HandoffRedeem(BaseModel):
    code: str = Field(min_length=20, max_length=100)


@router.post("/handoff/redeem", response_model=AuthResponse, summary="Website: open the one-time link")
async def handoff_redeem(body: HandoffRedeem, request: Request, response: Response):
    await ratelimit.check(request, "handoff_redeem", sessions._client_ip(request) or "unknown", (30, 600.0))
    now = _now()
    row = await _links().find_one_and_update(
        {"kind": "handoff", "code_hash": _digest(body.code), "status": "pending", "expires_at": {"$gt": now}},
        {"$set": {"status": "used", "used_at": now}},
    )
    if not row or not await sessions.is_live(row.get("from_sid", "")):
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            {"code": "link_expired", "message": "This link has expired. Open it from the app again."})
    user = await get_database()[UserModel.collection_name].find_one({"_id": ObjectId(row["user_id"])})
    if not user or not user.get("is_active", True):
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            {"code": "link_expired", "message": "This link has expired. Open it from the app again."})
    tokens = await sessions.start(response, user, request, method="app_handoff")
    return await _auth_response(user, tokens)
