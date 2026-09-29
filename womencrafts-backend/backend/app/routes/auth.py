"""
Authentication — no passwords.

Every way in is a six-digit code sent to something she controls:

    Join        email + mobile  →  code to email  →  name + "I am a woman, 18+"
    Sign in     email           →  code to email  →  signed in for 30 days
    Staff       email → code → authenticator app (required; set up on first sign-in)

Mobile numbers are required at signup and stored unverified until phone codes
are switched on (PHONE_CODES_ENABLED + a provider's keys). From then on a new
member confirms her number during signup and an existing one confirms it once,
the next time she signs in. Nothing in this file changes when that happens.

Sessions — one per device, 30 days for members, a working day for staff — live
in `app/core/sessions.py`. The codes themselves live in `app/core/codes.py`.
"""

import unicodedata
from datetime import datetime, timedelta, timezone
from typing import Optional

import phonenumbers
from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException, Request, Response, status
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr, Field, field_validator
from pymongo.errors import DuplicateKeyError

from app.core import cache, codes, ratelimit, sessions
from app.core import email as mailer
from app.core.audit import record
from app.core.config import settings
from app.core.deps import get_current_user
from app.core.rbac import MEMBER_ROLE, current_user_modules, role_name
from app.core.security import (
    TOKEN_VERSION_CLAIM,
    decode_access_token,
    token_version_in,
    token_version_of,
)
from app.core.session import COOKIE_NAME
from app.core.two_factor import (
    decrypt_secret,
    encrypt_secret,
    new_recovery_codes,
    new_secret,
    provisioning_qr_svg,
    provisioning_uri,
    recovery_digest,
    verify_code,
)
from app.db.mongodb import get_database
from app.models.member import MemberModel
from app.models.user import UserModel
from app.models.verification import VerificationStatus
from app.schemas.auth import AuthResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── helpers ─────────────────────────────────────────────────────────────────


def _users():
    return get_database()[UserModel.collection_name]


async def _user_response(doc: dict) -> UserResponse:
    """A user plus the module keys her role opens. The one serialiser for sign-in."""
    return UserResponse(**UserModel.to_response(doc), modules=await current_user_modules(doc))


async def _auth_response(user: dict, tokens: dict) -> AuthResponse:
    return AuthResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        user=await _user_response(user),
    )


async def _next_member_code(db) -> str:
    """Next 'WC-#####' code, matching the admin members directory."""
    highest = 12564
    async for row in db[MemberModel.collection_name].find({}, {"code": 1}):
        code = str(row.get("code", ""))
        if code.startswith("WC-") and code[3:].isdigit():
            highest = max(highest, int(code[3:]))
    return f"WC-{highest + 1}"


_NAME_JOINERS = set(" .'\u2019-")


def clean_person_name(value: str) -> str:
    """
    Her name as she writes it, in any script — letters (and the marks Indic
    scripts need), with spaces, dots, apostrophes and hyphens between words.
    No digits, links or symbols. The web form applies the same rule
    (src/lib/validation/fields.ts).
    """
    value = " ".join((value or "").split())
    if len(value) < 2:
        raise ValueError("Enter your full name")
    if len(value) > 80:
        raise ValueError("Keep your name under 80 characters")
    if not unicodedata.category(value[0]).startswith("L") or not all(
        unicodedata.category(ch)[0] in "LM" or ch in _NAME_JOINERS for ch in value
    ):
        raise ValueError("Use letters only — no numbers or symbols")
    return value


def normalise_phone(value: str) -> str:
    """
    An Indian mobile number in E.164 (`+919876543210`), or ValueError.

    India only at launch: SMS to other countries costs many times more, and the
    platform's safety and payment rails are Indian. Widen PHONE_ALLOWED_REGIONS
    when that changes.
    """
    raw = (value or "").strip()
    if not raw:
        raise ValueError("Enter your mobile number")
    allowed = {r.strip().upper() for r in settings.PHONE_ALLOWED_REGIONS.split(",") if r.strip()} or {"IN"}
    try:
        parsed = phonenumbers.parse(raw, "IN")
    except phonenumbers.NumberParseException as exc:
        raise ValueError("Enter a valid 10-digit mobile number") from exc
    if not phonenumbers.is_valid_number(parsed):
        raise ValueError("Enter a valid 10-digit mobile number")
    if phonenumbers.region_code_for_number(parsed) not in allowed:
        raise ValueError("Only Indian mobile numbers (+91) can be used for now")
    if phonenumbers.number_type(parsed) not in {
        phonenumbers.PhoneNumberType.MOBILE, phonenumbers.PhoneNumberType.FIXED_LINE_OR_MOBILE,
    }:
        raise ValueError("Enter a mobile number, not a landline")
    return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)


async def _phone_taken(phone: str, except_user_id: Optional[ObjectId] = None) -> bool:
    query: dict = {"phone": phone}
    if except_user_id is not None:
        query["_id"] = {"$ne": except_user_id}
    return await _users().find_one(query, {"_id": 1}) is not None


# Short-lived signed tickets that carry one step of a flow to the next (signup
# after the email is proved; staff sign-in between the email code and the
# authenticator). Signed with a key DERIVED from the JWT secret, so a ticket can
# never be presented as a session token — `get_current_user` would not even
# decode it.


def _ticket_key() -> str:
    return f"{settings.JWT_SECRET_KEY}:auth-ticket"


def _make_ticket(purpose: str, minutes: int, **claims) -> str:
    now = datetime.now(timezone.utc)
    body = {**claims, "purpose": purpose, "iat": now, "exp": now + timedelta(minutes=minutes)}
    return jwt.encode(body, _ticket_key(), algorithm=settings.JWT_ALGORITHM)


def _read_ticket(token: str, purpose: str) -> dict:
    expired = HTTPException(
        status.HTTP_400_BAD_REQUEST,
        {"code": "ticket_expired", "message": "This step took too long. Please start again."},
    )
    try:
        body = jwt.decode(token or "", _ticket_key(), algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        raise expired
    if body.get("purpose") != purpose:
        raise expired
    return body


async def _notify_super_admins_of_member_login(user: dict, occurred_at: datetime) -> None:
    """Send after the login response; notification failure never blocks access."""
    if role_name(user) != MEMBER_ROLE:
        return
    try:
        admins = await _users().find(
            {"role": "Super Admin", "is_active": {"$ne": False}, "email": {"$type": "string", "$ne": ""}},
            {"email": 1, "full_name": 1},
        ).limit(20).to_list(length=20)
        stamp = occurred_at.strftime("%d %b %Y, %H:%M UTC")
        for admin in admins:
            address = (admin.get("email") or "").strip()
            if address:
                await mailer.send(
                    mailer.member_login_alert_email(
                        admin.get("full_name", ""), user.get("full_name", ""), user.get("email", ""),
                        user.get("verification_status", ""), stamp, str(user["_id"]),
                    ),
                    address,
                )
    except Exception as exc:  # noqa: BLE001 - a notice must never break login
        print(f"⚠️  Could not send member login notice: {exc}")


# ── what the screens need to know ───────────────────────────────────────────


@router.get("/options", summary="Which ways in are switched on")
async def auth_options():
    """Lets the screens offer phone sign-in the day it is switched on, with no release."""
    return {
        "phone_codes": settings.phone_codes_live,
        "phone_provider": settings.PHONE_PROVIDER.strip().lower() if settings.phone_codes_live else "",
        "firebase_project_id": settings.FIREBASE_PROJECT_ID if settings.phone_codes_live else "",
        # Public web config for Google's SDK, only when Firebase is the provider.
        "firebase": (
            {
                "apiKey": settings.FIREBASE_WEB_API_KEY,
                "authDomain": settings.FIREBASE_AUTH_DOMAIN or f"{settings.FIREBASE_PROJECT_ID}.firebaseapp.com",
                "projectId": settings.FIREBASE_PROJECT_ID,
                "appId": settings.FIREBASE_APP_ID,
            }
            if settings.phone_codes_live and settings.PHONE_PROVIDER.strip().lower() == "firebase" else None
        ),
        "code_length": 6,
        "code_ttl_seconds": settings.AUTH_CODE_TTL_MINUTES * 60,
        "resend_seconds": settings.AUTH_CODE_RESEND_SECONDS,
        "phone_regions": [r.strip() for r in settings.PHONE_ALLOWED_REGIONS.split(",") if r.strip()],
    }


# ── join ────────────────────────────────────────────────────────────────────


class SignupStart(BaseModel):
    email: EmailStr
    phone: str
    locale: str = Field("en", max_length=8)

    @field_validator("phone")
    @classmethod
    def _phone(cls, value: str) -> str:
        return normalise_phone(value)


class CodeCheck(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=12)


class SignupComplete(BaseModel):
    ticket: str
    full_name: str = Field(max_length=80)
    is_woman_18_plus: bool
    locale: str = Field("en", max_length=8)

    @field_validator("full_name")
    @classmethod
    def _name(cls, value: str) -> str:
        return clean_person_name(value)


@router.post("/signup/start", summary="Join: send a code to her email")
async def signup_start(payload: SignupStart, request: Request):
    """
    The same answer for every address, whether or not it already has an account.

    A new address gets a code. An address that already has an account gets an
    email saying so, with a sign-in link, and no code — so this endpoint cannot
    be used to find out who is a member, and a woman who forgot she joined is
    told how to get back in rather than seeing an error.
    """
    email = codes.normalise_email(payload.email)
    existing = await _users().find_one({"email": email}, {"full_name": 1, "is_active": 1})
    if existing and existing.get("is_active", True):
        # She already has an account: send a SIGN-IN code, worded for this
        # situation. Typed into the same "check your email" box it signs her
        # in (see `signup_verify`), so a woman who forgot she joined gets in
        # instead of hitting "code expired". The screen's answer is identical
        # either way, so nobody else learns that this address is a member.
        issued = await codes.issue(
            request, purpose=codes.SIGNIN, channel=codes.EMAIL, destination=email,
            user_id=str(existing["_id"]), name=existing.get("full_name", ""), template="existing_member",
        )
    elif existing:
        issued = await codes.issue(request, purpose=codes.SIGNUP, channel=codes.EMAIL,
                                   destination=email, send=False)
    else:
        issued = await codes.issue(
            request, purpose=codes.SIGNUP, channel=codes.EMAIL, destination=email,
            payload={"phone": payload.phone, "locale": payload.locale},
        )
    return {
        "message": f"We've sent a 6-digit code to {issued.destination}.",
        "channel": issued.channel,
        "destination": issued.destination,
        "expires_in": issued.expires_in,
        "resend_in": issued.resend_in,
    }


@router.post("/signup/verify", summary="Join: check the email code")
async def signup_verify(payload: CodeCheck, request: Request, response: Response, background: BackgroundTasks):
    """
    Spend the code and hand back a 20-minute ticket for the last step.

    If the address already has an account, the code she was sent is a sign-in
    code (see `signup_start`): it signs her in here, and the answer carries
    `signed_in: true` with her session instead of a ticket.
    """
    email = codes.normalise_email(payload.email)
    if not await codes.has_live(codes.SIGNUP, email) and await codes.has_live(codes.SIGNIN, email):
        spent = await codes.verify(request, purpose=codes.SIGNIN, destination=email, code=payload.code)
        user = await _users().find_one({"_id": ObjectId(spent["user_id"])}) if spent.get("user_id") else None
        if not user or not user.get("is_active", True):
            raise HTTPException(status.HTTP_400_BAD_REQUEST,
                                {"code": "code_expired", "message": codes.CODE_MISMATCH_MESSAGE})
        if role_name(user) != MEMBER_ROLE:
            raise HTTPException(status.HTTP_409_CONFLICT, {
                "code": "email_taken",
                "message": "This email belongs to a staff account. Use Sign in — staff also need their authenticator app.",
            })
        user = await _finish_member_email_proof(user, request, background)
        now = datetime.now(timezone.utc)
        await _users().update_one({"_id": user["_id"]}, {"$set": {"last_login_at": now}})
        tokens = await sessions.start(response, user, request, method="email_code")
        auth = await _auth_response(user, tokens)
        return {"signed_in": True, **auth.model_dump()}
    spent = await codes.verify(request, purpose=codes.SIGNUP, destination=email, code=payload.code)
    if await _users().find_one({"email": email}, {"_id": 1}):
        raise HTTPException(status.HTTP_409_CONFLICT,
                            {"code": "email_taken", "message": "This email already has an account. Sign in instead."})
    phone = (spent.get("payload") or {}).get("phone", "")
    if not phone:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            {"code": "ticket_expired", "message": "Please start again."})
    if await _phone_taken(phone):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {"code": "phone_taken",
             "message": "This mobile number is already linked to another account. Use a different number, "
                        "or sign in with the email you used before."},
        )
    ticket = _make_ticket("signup", 20, email=email, phone=phone,
                          locale=(spent.get("payload") or {}).get("locale", "en"))
    return {"ticket": ticket, "expires_in": 20 * 60}


@router.post("/signup/complete", response_model=AuthResponse, status_code=status.HTTP_201_CREATED,
             summary="Join: name and declaration; creates the account")
async def signup_complete(payload: SignupComplete, request: Request, response: Response):
    """
    Create the member account and sign her in on this device.

    Her email is proved by the code. Her account starts at `pending_documents`:
    the next screen asks for a selfie and an ID photo, and a person reviews
    them. Until then she can read learning content and set up her profile —
    nothing social, nothing with money (see `rbac.require_member_account`).
    """
    body = _read_ticket(payload.ticket, "signup")
    if not payload.is_woman_18_plus:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            {"code": "declaration_required",
             "message": "WomSakhi is a community for women aged 18 and over. Please confirm to continue."},
        )
    email, phone = body["email"], body["phone"]
    locale = payload.locale or body.get("locale") or "en"
    db = get_database()
    if await _phone_taken(phone):
        raise HTTPException(status.HTTP_409_CONFLICT,
                            {"code": "phone_taken", "message": "This mobile number is already linked to another account."})

    now = datetime.now(timezone.utc)
    member_doc = MemberModel.create_document(
        full_name=payload.full_name, email=email, phone=phone, country="IN",
        role="Member", status="Pending", code=await _next_member_code(db),
    )
    member_result = await db[MemberModel.collection_name].insert_one(member_doc)
    user = UserModel.create_document(
        full_name=payload.full_name, email=email, hashed_password="", role=MEMBER_ROLE,
        member_id=str(member_result.inserted_id), locale=locale, phone=phone, country="IN",
        verification_status=VerificationStatus.PENDING_DOCUMENTS,
    )
    user.update({"email_verified_at": now, "phone_verified_at": None, "declared_woman_18_plus_at": now})
    try:
        result = await _users().insert_one(user)
    except DuplicateKeyError:
        await db[MemberModel.collection_name].delete_one({"_id": member_result.inserted_id})
        raise HTTPException(status.HTTP_409_CONFLICT,
                            {"code": "email_taken", "message": "This email already has an account. Sign in instead."})
    user["_id"] = result.inserted_id

    tokens = await sessions.start(response, user, request, method="signup")
    await record(user, "member.signup", target=str(user["_id"]),
                 detail="Created an account with an email code", request=request)
    return await _auth_response(user, tokens)


# ── sign in ─────────────────────────────────────────────────────────────────


class SigninStart(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None


class SigninVerify(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    code: str = Field(min_length=4, max_length=12)


def _identifier(email: Optional[str], phone: Optional[str]) -> tuple[str, str]:
    """(field, value) to look her up by. Phone only once phone codes are live."""
    if phone and not email:
        if not settings.server_sends_sms:
            raise HTTPException(status.HTTP_400_BAD_REQUEST,
                                {"code": "phone_codes_off", "message": "Sign in with your email for now."})
        try:
            return "phone", normalise_phone(phone)
        except ValueError as exc:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))
    if not email:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Enter your email address")
    return "email", codes.normalise_email(email)


@router.post("/signin/start", summary="Sign in: send a code")
async def signin_start(payload: SigninStart, request: Request):
    """
    The same answer whether or not the address has an account — a stranger
    cannot use this to ask "is she a member here?". Only a real, active account
    is actually sent a code.
    """
    field, value = _identifier(payload.email, payload.phone)
    user = await _users().find_one({field: value})
    live = bool(user and user.get("is_active", True))
    if field == "phone" and live and not user.get("phone_verified_at"):
        live = False  # an unconfirmed number cannot be a way in
    channel = codes.SMS if field == "phone" else codes.EMAIL
    issued = await codes.issue(
        request, purpose=codes.SIGNIN, channel=channel, destination=value,
        user_id=str(user["_id"]) if live else "", name=(user or {}).get("full_name", ""), send=live,
    )
    return {
        "message": f"If {issued.destination} has a WomSakhi account, we've sent it a 6-digit code.",
        "channel": issued.channel,
        "destination": issued.destination,
        "expires_in": issued.expires_in,
        "resend_in": issued.resend_in,
    }


async def _finish_member_email_proof(user: dict, request: Request, background: BackgroundTasks) -> dict:
    """
    A code to her inbox proves the address. An account that joined under the
    old flow and never clicked its confirmation link is moved on here, so it is
    not stuck on "confirm your email" when she has just done exactly that.
    """
    if role_name(user) != MEMBER_ROLE or user.get("verification_status") != VerificationStatus.PENDING_EMAIL:
        return user
    from app.routes.verification import _submit_ready_application

    now = datetime.now(timezone.utc)
    await _users().update_one(
        {"_id": user["_id"], "verification_status": VerificationStatus.PENDING_EMAIL},
        {"$set": {"verification_status": VerificationStatus.PENDING_DOCUMENTS,
                  "email_verified_at": now, "updated_at": now}},
    )
    await _submit_ready_application(user["_id"], background, request)
    cache.forget_user(str(user["_id"]))
    return await _users().find_one({"_id": user["_id"]}) or user


@router.post("/signin/verify", response_model=AuthResponse, summary="Sign in: check the code")
async def signin_verify(payload: SigninVerify, request: Request, response: Response, background: BackgroundTasks):
    """
    Members are in. Staff go on to their authenticator: this answers 428 with a
    short ticket and either `two_factor_required` (enter the app's code) or
    `two_factor_setup_required` (scan this, then enter the app's code), and the
    next call is `/auth/two-factor/verify` or `/auth/two-factor/enroll`.
    """
    field, value = _identifier(payload.email, payload.phone)
    spent = await codes.verify(request, purpose=codes.SIGNIN, destination=value, code=payload.code)
    user = await _users().find_one({"_id": ObjectId(spent["user_id"])}) if spent.get("user_id") else None
    if not user or not user.get("is_active", True):
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            {"code": "code_expired", "message": codes.CODE_MISMATCH_MESSAGE})

    test_login = field == "email" and codes.is_test_login(codes.EMAIL, value)
    if role_name(user) != MEMBER_ROLE and not test_login:
        two_factor = user.get("two_factor") or {}
        if two_factor.get("enabled"):
            ticket = _make_ticket("mfa", 10, sub=str(user["_id"]), tv=token_version_of(user))
            raise HTTPException(status.HTTP_428_PRECONDITION_REQUIRED, {
                "code": "two_factor_required",
                "message": "Enter the 6-digit code from your authenticator app.",
                "ticket": ticket,
            })
        secret = new_secret()
        await _users().update_one({"_id": user["_id"]},
                                  {"$set": {"two_factor_pending_secret": encrypt_secret(secret)}})
        ticket = _make_ticket("mfa_setup", 15, sub=str(user["_id"]), tv=token_version_of(user))
        raise HTTPException(status.HTTP_428_PRECONDITION_REQUIRED, {
            "code": "two_factor_setup_required",
            "message": "Staff accounts need an authenticator app. Scan the code, then enter the 6 digits it shows.",
            "ticket": ticket,
            "secret": secret,
            "provisioning_uri": provisioning_uri(secret, user.get("email", "")),
            "qr_svg": provisioning_qr_svg(provisioning_uri(secret, user.get("email", ""))),
        })

    if field == "email":
        user = await _finish_member_email_proof(user, request, background)
    now = datetime.now(timezone.utc)
    await _users().update_one({"_id": user["_id"]}, {"$set": {"last_login_at": now}})
    tokens = await sessions.start(response, user, request, method="test_code" if test_login else f"{field}_code")
    background.add_task(_notify_super_admins_of_member_login, dict(user), now)
    return await _auth_response(user, tokens)


class TwoFactorStep(BaseModel):
    ticket: str
    code: str = Field(min_length=6, max_length=20)


async def _staff_from_ticket(body: dict) -> dict:
    user = await _users().find_one({"_id": ObjectId(body["sub"])})
    if not user or not user.get("is_active", True) or token_version_of(user) != int(body.get("tv") or 0):
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            {"code": "ticket_expired", "message": "Please sign in again."})
    return user


@router.post("/two-factor/verify", response_model=AuthResponse, summary="Staff sign-in: authenticator code")
async def two_factor_verify(payload: TwoFactorStep, request: Request, response: Response):
    body = _read_ticket(payload.ticket, "mfa")
    await ratelimit.check(request, "mfa", body["sub"], (6, 900.0), (60, 900.0))
    user = await _staff_from_ticket(body)
    config = user.get("two_factor") or {}
    code = payload.code.strip()
    digest = recovery_digest(code)
    if digest in (config.get("recovery_codes") or []):
        await _users().update_one({"_id": user["_id"]}, {"$pull": {"two_factor.recovery_codes": digest}})
        method = "recovery_code"
    elif verify_code(decrypt_secret(config.get("secret", "")), code):
        method = "authenticator"
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            {"code": "code_wrong", "message": "That code isn't right. Check your authenticator app."})
    await ratelimit.forget("mfa", body["sub"])
    now = datetime.now(timezone.utc)
    await _users().update_one({"_id": user["_id"]}, {"$set": {"last_login_at": now}})
    tokens = await sessions.start(response, user, request, method=f"email_code+{method}")
    await record(user, "security.signin", target=str(user["_id"]),
                 detail=f"Signed in with an email code and {method.replace('_', ' ')}", request=request)
    return await _auth_response(user, tokens)


@router.post("/two-factor/enroll", summary="Staff sign-in: finish authenticator setup")
async def two_factor_enroll(payload: TwoFactorStep, request: Request, response: Response):
    """Confirm the app works, turn it on, hand back recovery codes, and sign in."""
    body = _read_ticket(payload.ticket, "mfa_setup")
    await ratelimit.check(request, "mfa", body["sub"], (6, 900.0), (60, 900.0))
    user = await _staff_from_ticket(body)
    secret = decrypt_secret(user.get("two_factor_pending_secret", ""))
    if not secret:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            {"code": "ticket_expired", "message": "Please sign in again."})
    if not verify_code(secret, payload.code):
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            {"code": "code_wrong",
                             "message": "That code isn't right. Make sure your phone's time is set automatically."})
    recovery = new_recovery_codes()
    now = datetime.now(timezone.utc)
    await _users().update_one(
        {"_id": user["_id"]},
        {"$set": {"two_factor": {"enabled": True, "secret": encrypt_secret(secret),
                                 "recovery_codes": [recovery_digest(c) for c in recovery], "enabled_at": now},
                  "last_login_at": now, "updated_at": now},
         "$unset": {"two_factor_pending_secret": ""}},
    )
    cache.forget_user(str(user["_id"]))
    user = await _users().find_one({"_id": user["_id"]})
    tokens = await sessions.start(response, user, request, method="email_code+authenticator_setup")
    await record(user, "security.two_factor_enabled", target=str(user["_id"]),
                 detail="Authenticator set up at sign-in", request=request)
    auth = await _auth_response(user, tokens)
    return {**auth.model_dump(), "recovery_codes": recovery}


# ── staying signed in ───────────────────────────────────────────────────────


class RefreshBody(BaseModel):
    refresh_token: str = ""


@router.post("/refresh", summary="Keep this session alive")
async def refresh(request: Request, response: Response, body: Optional[RefreshBody] = Body(None)):
    """
    Swap a refresh token for a fresh pair.

    The browser sends its refresh cookie (path-scoped to /api/v1/auth, so no
    other request ever carries it). The mobile app has no cookie jar and sends
    the token in the body; it gets the new pair back in the body too.

    A browser still holding a session from before devices existed — a live
    access token and no refresh cookie — is moved onto a device session here
    rather than signed out mid-task.
    """
    from_body = bool(body and body.refresh_token)
    token = body.refresh_token if from_body else request.cookies.get(sessions.REFRESH_COOKIE, "")
    if token:
        user, tokens = await sessions.rotate(request, None if from_body else response, token)
        out = {"ok": True, "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60}
        if from_body:
            # An empty refresh token means "keep the one you have" (a race
            # inside the rotation grace window; see core/sessions.py).
            out.update(access_token=tokens["access_token"], refresh_token=tokens["refresh_token"])
        return out

    legacy = decode_access_token(request.cookies.get(COOKIE_NAME, ""))
    if legacy and not legacy.get(sessions.SID_CLAIM):
        user = await _users().find_one({"_id": ObjectId(legacy["sub"])})
        if user and user.get("is_active", True) and not (
            TOKEN_VERSION_CLAIM in legacy and token_version_in(legacy) < token_version_of(user)
        ):
            await sessions.start(response, user, request, method="legacy_upgrade")
            return {"ok": True, "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60}
    sessions.clear_cookies(response)
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, {"code": "session_ended", "message": "Please sign in again."})


@router.get("/session", summary="Am I signed in?")
async def session(request: Request):
    """200 either way, so a signed-out page load logs no console error."""
    payload = decode_access_token(request.cookies.get(COOKIE_NAME, ""))
    if not payload:
        return {"user": None}
    user = await _users().find_one({"_id": ObjectId(payload["sub"])})
    if not user or not user.get("is_active", True):
        return {"user": None}
    if TOKEN_VERSION_CLAIM in payload and token_version_in(payload) < token_version_of(user):
        return {"user": None}
    sid = payload.get(sessions.SID_CLAIM)
    if sid and not await sessions.is_live(str(sid)):
        return {"user": None}
    return {"user": await _user_response(user)}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return await _user_response(current_user)


@router.post("/signout", summary="Sign out of this device")
async def signout(request: Request, response: Response, body: Optional[RefreshBody] = Body(None)):
    """Ends this device's session on the server as well as clearing its cookies."""
    sid = sessions.sid_from_request(request)
    if sid:
        await sessions.revoke(sid, reason="signed_out")
    sessions.clear_cookies(response)
    return {"message": "Signed out"}


@router.post("/signout-everywhere", summary="Sign out of every device")
async def signout_everywhere(request: Request, response: Response, me: dict = Depends(get_current_user)):
    """
    End every session this account has, on every device, now — including this
    one. A control that quietly spares the device you are holding is one you
    cannot trust when the device you are holding is the problem.
    """
    await _users().update_one(
        {"_id": ObjectId(str(me["_id"]))},
        {"$inc": {"token_version": 1}, "$set": {"updated_at": datetime.now(timezone.utc)}},
    )
    await sessions.revoke_all(str(me["_id"]))
    cache.forget_user(str(me["_id"]))
    sessions.clear_cookies(response)
    await record(me, "security.signout_everywhere", target=str(me["_id"]),
                 detail="Signed out of every device", request=request)
    return {"message": "Every session has been ended. Sign in again to carry on."}


@router.get("/sessions", summary="My signed-in devices")
async def my_sessions(request: Request, me: dict = Depends(get_current_user)):
    return {"sessions": await sessions.list_for(str(me["_id"]), sessions.sid_from_request(request))}


@router.delete("/sessions/{sid}", summary="Sign out one device")
async def end_session(sid: str, request: Request, me: dict = Depends(get_current_user)):
    owned = await get_database()[sessions.COLLECTION].find_one({"sid": sid, "user_id": str(me["_id"])})
    if not owned:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Device not found")
    await sessions.revoke(sid, reason="removed_by_owner")
    await record(me, "security.remove_device", target=str(me["_id"]),
                 detail=f"Signed out {owned.get('label', 'a device')}", request=request)
    return {"message": f"Signed out {owned.get('label', 'that device')}."}


# ── her mobile number ───────────────────────────────────────────────────────


class PhoneIn(BaseModel):
    phone: str

    @field_validator("phone")
    @classmethod
    def _phone(cls, value: str) -> str:
        return normalise_phone(value)


class PhoneCode(BaseModel):
    code: str = Field(min_length=4, max_length=12)


class FirebasePhone(BaseModel):
    id_token: str = Field(min_length=20)


@router.post("/phone", summary="Add or change my mobile number")
async def set_phone(payload: PhoneIn, request: Request, me: dict = Depends(get_current_user)):
    """
    Saved unconfirmed. When phone codes are switched on the screen follows up
    with `/auth/phone/start`; until then an admin checks it during review.
    """
    if payload.phone == me.get("phone") :
        return {"phone": payload.phone, "phone_verified": bool(me.get("phone_verified_at"))}
    if await _phone_taken(payload.phone, except_user_id=me["_id"]):
        raise HTTPException(status.HTTP_409_CONFLICT,
                            {"code": "phone_taken", "message": "This mobile number is already linked to another account."})
    now = datetime.now(timezone.utc)
    await _users().update_one({"_id": me["_id"]},
                              {"$set": {"phone": payload.phone, "phone_verified_at": None, "updated_at": now}})
    if me.get("member_id"):
        try:
            await get_database()[MemberModel.collection_name].update_one(
                {"_id": ObjectId(me["member_id"])}, {"$set": {"phone": payload.phone}})
        except Exception:  # noqa: BLE001 - the directory row is a mirror, not the record
            pass
    cache.forget_user(str(me["_id"]))
    await record(me, "security.phone_changed", target=str(me["_id"]), detail="Mobile number updated", request=request)
    return {"phone": payload.phone, "phone_verified": False}


@router.post("/phone/start", summary="Send a code to my mobile number")
async def phone_start(request: Request, me: dict = Depends(get_current_user)):
    if not settings.server_sends_sms:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            {"code": "phone_codes_off", "message": "Phone confirmation isn't switched on yet."})
    if not me.get("phone"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Add your mobile number first.")
    issued = await codes.issue(request, purpose=codes.PHONE_VERIFY, channel=codes.SMS,
                               destination=me["phone"], user_id=str(me["_id"]), name=me.get("full_name", ""))
    return {"message": f"We've sent a code to {issued.destination}.", "destination": issued.destination,
            "expires_in": issued.expires_in, "resend_in": issued.resend_in}


async def _mark_phone_verified(me: dict, request: Request) -> dict:
    now = datetime.now(timezone.utc)
    await _users().update_one({"_id": me["_id"]}, {"$set": {"phone_verified_at": now, "updated_at": now}})
    cache.forget_user(str(me["_id"]))
    await record(me, "security.phone_verified", target=str(me["_id"]), detail="Mobile number confirmed", request=request)
    return {"phone": me.get("phone", ""), "phone_verified": True}


@router.post("/phone/verify", summary="Confirm my mobile number with its code")
async def phone_verify(payload: PhoneCode, request: Request, me: dict = Depends(get_current_user)):
    if not me.get("phone"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Add your mobile number first.")
    await codes.verify(request, purpose=codes.PHONE_VERIFY, destination=me["phone"], code=payload.code)
    return await _mark_phone_verified(me, request)


@router.post("/phone/firebase", summary="Confirm my mobile number with Firebase")
async def phone_firebase(payload: FirebasePhone, request: Request, me: dict = Depends(get_current_user)):
    """
    Firebase sends and checks the SMS itself; the app hands us the ID token it
    got back. We check Google's signature and that the number inside it is the
    number on her account — and never use Firebase for the session itself.
    """
    if not settings.phone_codes_live or settings.PHONE_PROVIDER.strip().lower() != "firebase":
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            {"code": "phone_codes_off", "message": "Phone confirmation isn't switched on yet."})
    await ratelimit.check(request, "firebase_phone", str(me["_id"]), (10, 3600.0), (60, 3600.0))
    phone = await codes.verify_firebase_phone(payload.id_token)
    if not phone or phone != me.get("phone"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            {"code": "phone_mismatch", "message": "That confirmation doesn't match the number on your account."})
    return await _mark_phone_verified(me, request)


class FirebaseSignin(BaseModel):
    id_token: str = Field(min_length=20)


@router.post("/signin/firebase", response_model=AuthResponse, summary="Sign in with a confirmed mobile number")
async def signin_firebase(payload: FirebaseSignin, request: Request, response: Response, background: BackgroundTasks):
    """
    Firebase has already sent and checked the SMS; the browser hands us the ID
    token it got back. We check Google's signature and read the number from it.

    Only a number she has CONFIRMED on her account is a way in — an unconfirmed
    one could have been typed by anybody. Members only: staff sign in with an
    email code and their authenticator.
    """
    if not settings.phone_codes_live or settings.PHONE_PROVIDER.strip().lower() != "firebase":
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            {"code": "phone_codes_off", "message": "Sign in with your email for now."})
    await ratelimit.check(request, "firebase_signin", sessions._client_ip(request) or "unknown", (20, 3600.0))
    phone = await codes.verify_firebase_phone(payload.id_token)
    if not phone:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            {"code": "code_wrong", "message": "We couldn't confirm that code. Please try again."})
    user = await _users().find_one({"phone": phone, "phone_verified_at": {"$ne": None}})
    if not user or not user.get("is_active", True):
        raise HTTPException(status.HTTP_404_NOT_FOUND, {
            "code": "phone_unknown",
            "message": "No account is linked to this number yet. Sign in with your email, then confirm your number.",
        })
    if role_name(user) != MEMBER_ROLE:
        raise HTTPException(status.HTTP_403_FORBIDDEN, {
            "code": "staff_use_email",
            "message": "Staff sign in with their email and authenticator app.",
        })
    now = datetime.now(timezone.utc)
    await _users().update_one({"_id": user["_id"]}, {"$set": {"last_login_at": now}})
    tokens = await sessions.start(response, user, request, method="phone_code")
    background.add_task(_notify_super_admins_of_member_login, dict(user), now)
    return await _auth_response(user, tokens)


class SmsAllowanceIn(BaseModel):
    phone: str
    purpose: str = Field("signin", pattern="^(signin|phone_verify)$")

    @field_validator("phone")
    @classmethod
    def _phone(cls, value: str) -> str:
        return normalise_phone(value)


@router.post("/sms/allowance", summary="Ask before Firebase sends an SMS code")
async def sms_allowance(payload: SmsAllowanceIn, request: Request):
    """
    Firebase sends its SMS from the browser, where we cannot count it — so the
    screen asks here first. Refused with `sms_limit` once today's allowance is
    used (SMS_DAILY_LIMIT; 10 = Firebase's free tier), and the screen offers the
    email code instead. Also rate-limited per IP so it cannot be used to burn
    the allowance for everyone.
    """
    if not settings.phone_codes_live:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            {"code": "phone_codes_off", "message": "Sign in with your email for now."})
    await ratelimit.check(request, "sms_allowance", payload.phone, (5, 3600.0), (15, 3600.0))
    await codes.reserve_sms(payload.phone, payload.purpose)
    return {"ok": True}


@router.post("/phone/later", summary="Confirm my number tomorrow (SMS allowance used up)")
async def phone_later(me: dict = Depends(get_current_user)):
    """
    Only when today's SMS allowance really is used up — otherwise confirming
    now is the answer. Postpones the "confirm your number" step by a day.
    """
    ist = timezone(timedelta(hours=5, minutes=30))
    day = datetime.now(ist).strftime("%Y-%m-%d")
    used = await get_database()[codes.SMS_LEDGER].count_documents({"day": day})
    if settings.SMS_DAILY_LIMIT <= 0 or used < settings.SMS_DAILY_LIMIT:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "SMS codes are available — confirm your number now.")
    until = datetime.now(timezone.utc) + timedelta(days=1)
    await _users().update_one({"_id": me["_id"]}, {"$set": {"phone_confirm_deferred_until": until}})
    cache.forget_user(str(me["_id"]))
    return {"deferred_until": until.isoformat()}
