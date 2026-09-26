from datetime import datetime, timedelta, timezone

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request, Response, status, Depends

from app.core.deps import get_current_user
from app.core.rbac import (
    MEMBER_ROLE,
    audience_for_role,
    current_user_modules,
    role_name,
)
from app.db.mongodb import get_database
from app.core import ratelimit
from app.core.config import settings
from app.models.member import MemberModel
from app.models.user import UserModel
from app.models.verification import VerificationStatus
from app.schemas.auth import (
    AuthResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    SignInRequest,
    SignUpRequest,
    UserResponse,
)
from app.core.security import (
    TOKEN_VERSION_CLAIM,
    create_access_token,
    decode_access_token,
    hash_password,
    token_version_of,
    verify_password,
    hash_password_async,
    verify_password_async,
    token_version_in,
)
from app.core.session import COOKIE_NAME, clear_session_cookie, set_session_cookie
from app.routes.verification import send_verification_email
from app.core.two_factor import decrypt_secret, recovery_digest, verify_code

router = APIRouter(prefix="/auth", tags=["Authentication"])


async def _user_response(doc: dict) -> UserResponse:
    """
    Serialize a user plus the module keys their role can access.

    `audience` used to be supplied here and nowhere else, which meant sign-in
    reported it correctly and `/users/me` fell back to the schema default of
    "staff". Members were therefore told they were staff on every reload, and
    the member shell redirected them away from their own app.

    It is now derived inside `UserModel.to_response`, so every endpoint that
    serialises a user agrees — which is the only way this stays fixed.
    """
    return UserResponse(
        **UserModel.to_response(doc),
        modules=await current_user_modules(doc),
    )


def _token_for(doc: dict) -> str:
    """
    Issue the session token.

    `role` is embedded so the frontend proxy can send an account to the right
    app without a round-trip. It is a routing hint only — every endpoint still
    checks the role server-side, so a tampered token buys nothing.

    **`tv` is what makes "sign out everywhere" mean anything.** It carries the
    account's token version at the moment the session began, and
    `core/deps.py` refuses any token whose version is behind the account's. The
    machinery has been in place on both sides for a while and was inert purely
    because nothing minted this claim — so bumping `token_version` did nothing
    at all, on a platform where a woman may urgently need to end a session
    somebody else is holding.

    Old tokens carry no `tv` and keep working until they expire, because the
    check only fires on a token that HAS the claim. That is the safe direction:
    the alternative rejects every pre-existing session immediately, including
    the one belonging to whoever is deploying.
    """
    return create_access_token(
        {
            "sub": str(doc["_id"]),
            "email": doc["email"],
            "role": role_name(doc),
            TOKEN_VERSION_CLAIM: token_version_of(doc),
        }
    )


async def _next_member_code(db) -> str:
    """Next 'WC-#####' code, matching the admin members directory."""
    highest = 12564
    async for row in db[MemberModel.collection_name].find({}, {"code": 1}):
        code = str(row.get("code", ""))
        if code.startswith("WC-") and code[3:].isdigit():
            highest = max(highest, int(code[3:]))
    return f"WC-{highest + 1}"


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(payload: SignUpRequest, response: Response, request: Request):
    await ratelimit.check(request, "signup", payload.email, ratelimit.SIGN_UP, ratelimit.SIGN_UP_IP)

    """
    Public sign-up — always creates a MEMBER account, never staff.

    Alongside the credential row it creates the member's profile in the
    'members' collection, so a real sign-up appears in the admin directory
    immediately and every member has a profile to hang bookings off.
    """
    db = get_database()
    collection = db[UserModel.collection_name]
    email = payload.email.lower().strip()

    existing = await collection.find_one({"email": email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    # Profile first, so the credential row can point at it.
    member_doc = MemberModel.create_document(
        full_name=payload.full_name,
        email=email,
        phone=payload.phone or "",
        role="Member",
        status="Pending",
        code=await _next_member_code(db),
    )
    member_result = await db[MemberModel.collection_name].insert_one(member_doc)

    doc = UserModel.create_document(
        full_name=payload.full_name,
        email=email,
        hashed_password=await hash_password_async(payload.password),
        role=MEMBER_ROLE,
        member_id=str(member_result.inserted_id),
        locale=payload.locale or "en",
        phone=payload.phone or "",
    )
    result = await collection.insert_one(doc)
    doc["_id"] = result.inserted_id

    # She is signed in immediately, but the account is only an APPLICATION until
    # her email is confirmed, her ID is checked and a human approves it. Signing
    # her in anyway is deliberate: she needs somewhere to see her own progress.
    try:
        await send_verification_email(doc)
    except Exception as exc:  # noqa: BLE001 - a mail outage must not fail the signup
        print(f"⚠️  Could not send the verification email: {exc}")

    token = _token_for(doc)
    set_session_cookie(response, token)
    return AuthResponse(access_token=token, user=await _user_response(doc))


@router.post("/signin", response_model=AuthResponse)
async def signin(payload: SignInRequest, response: Response, request: Request):
    # Before touching the database: an attacker guessing passwords should cost
    # us a dictionary lookup, not a round trip to Atlas for every guess.
    await ratelimit.check(request, "signin", payload.email, ratelimit.SIGN_IN, ratelimit.SIGN_IN_IP)

    db = get_database()
    collection = db[UserModel.collection_name]

    user = await collection.find_one({"email": payload.email.lower().strip()})

    # Wrong email and wrong password give the SAME answer — never reveal which
    # addresses have accounts.
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    now = datetime.now(timezone.utc)
    locked_until = user.get("locked_until")
    if isinstance(locked_until, datetime):
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        if locked_until > now:
            minutes = max(1, int((locked_until - now).total_seconds() // 60) + 1)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many failed attempts. Try again in {minutes} minute(s).",
            )

    if not await verify_password_async(payload.password, user["hashed_password"]):
        failed = int(user.get("failed_logins") or 0) + 1
        updates: dict = {"failed_logins": failed}
        if failed >= settings.MAX_FAILED_LOGINS:
            updates["locked_until"] = now + timedelta(minutes=settings.LOCKOUT_MINUTES)
            updates["failed_logins"] = 0
        await collection.update_one({"_id": user["_id"]}, {"$set": updates})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.get("is_active", True):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

    two_factor = user.get("two_factor") or {}
    if two_factor.get("enabled"):
        code = payload.two_factor_code.strip()
        if not code:
            raise HTTPException(
                status_code=status.HTTP_428_PRECONDITION_REQUIRED,
                detail={"code": "two_factor_required", "message": "Enter the code from your authenticator app."},
            )
        secret = decrypt_secret(two_factor.get("secret", ""))
        recovery = recovery_digest(code)
        recovery_codes = list(two_factor.get("recovery_codes") or [])
        if recovery in recovery_codes:
            await collection.update_one(
                {"_id": user["_id"]}, {"$pull": {"two_factor.recovery_codes": recovery}}
            )
        elif not verify_code(secret, code):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "That authentication code is not valid")

    # Successful sign-in clears the failure counter — and her rate-limit
    # budget. Otherwise a woman who mistypes four times and then gets it right
    # is two tries from being locked out for a minute, punished for eventually
    # succeeding.
    await ratelimit.forget("signin", payload.email)
    await collection.update_one(
        {"_id": user["_id"]},
        {"$set": {"failed_logins": 0, "locked_until": None, "last_login_at": now}},
    )
    token = _token_for(user)
    set_session_cookie(response, token)
    return AuthResponse(access_token=token, user=await _user_response(user))


@router.post("/refresh", summary="Keep this session alive")
async def refresh(request: Request, response: Response):
    """
    A sliding session: a woman who is using the app is not signed out of it.

    Tokens last 30 minutes and there was nothing to renew them, so a woman who
    left the app open while she cooked came back to a session that had quietly
    died — and, because `/me/shell` then answered 401, to a blank white screen
    with no message on it. Thirty minutes is a short leash for an app somebody
    opens between one job and the next.

    This is deliberately NOT a refresh token. It renews a session that is still
    valid, nothing more: present a live cookie and get a fresh one, 30 minutes
    from now. An expired session cannot be renewed here and she signs in again,
    which is the behaviour we want — the long-lived credential that would avoid
    that is also the one worth stealing, and this app holds identity documents.

    The client calls it on a timer while a screen is open and when the tab is
    focused again, so the leash only runs out after she has genuinely stopped.
    """
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "No session to refresh")
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session has expired")

    user = await get_database()[UserModel.collection_name].find_one(
        {"_id": ObjectId(payload["sub"])}
    )
    # A disabled account stops being a session immediately, not in 30 minutes.
    if not user or not user.get("is_active", True):
        clear_session_cookie(response)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "This account is no longer active")
    # A session that was ended ("sign out everywhere", a password change) must
    # not be able to renew itself into a fresh one. `get_current_user` refuses
    # a stale generation on every request; this path used to mint a new token
    # without asking, so a browser that kept refreshing outlived the revocation.
    if TOKEN_VERSION_CLAIM in payload and token_version_in(payload) < token_version_of(user):
        clear_session_cookie(response)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "This session was ended. Please sign in again.")

    # The same helper sign-in uses, so a refreshed token carries every claim
    # the original did — including the version claim that revokes sessions.
    fresh = _token_for(user)
    set_session_cookie(response, fresh)
    return {"ok": True, "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60}


@router.get("/session", summary="Am I signed in?")
async def session(request: Request):
    """
    Answers "is there a session?" with 200 either way.

    `/auth/me` 401s when signed out, which is correct REST but means every
    signed-out page load logs a console error. The app boots against this
    instead, so a visitor's console stays clean.
    """
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return {"user": None}
    payload = decode_access_token(token)
    if not payload:
        return {"user": None}
    user = await get_database()[UserModel.collection_name].find_one(
        {"_id": ObjectId(payload["sub"])}
    )
    if not user or not user.get("is_active", True):
        return {"user": None}
    return {"user": await _user_response(user)}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return await _user_response(current_user)


@router.post("/signout", summary="End the session")
async def signout(response: Response):
    """
    Clears the httpOnly cookie. The client cannot delete it itself — that is the
    point of httpOnly — so signing out has to go through the server.
    """
    clear_session_cookie(response)
    return {"message": "Signed out"}


@router.post("/signout-everywhere", summary="End every session on every device")
async def signout_everywhere(response: Response, me: dict = Depends(get_current_user)):
    """
    End every session this account has, on every device, now.

    **Why this needs to exist here and not just in settings.** Signing out on
    one phone has never touched the others, so a woman whose account was opened
    on somebody else's device — a shared phone, a husband's tablet, a cybercafé
    — had no way to close it. She could change her password, and the other
    session carried on regardless for the rest of its life.

    Bumping `token_version` invalidates every token minted before this moment,
    because each one carries the version it was issued under and
    `core/deps.py` rejects anything behind. Her CURRENT session goes too: that
    is deliberate, and the honest reading of "everywhere" — a control that
    quietly spares the device you are holding is one you cannot trust when the
    device you are holding is the problem.
    """
    db = get_database()
    await db[UserModel.collection_name].update_one(
        {"_id": ObjectId(str(me["_id"]))},
        {"$inc": {"token_version": 1}, "$set": {"updated_at": datetime.now(timezone.utc)}},
    )
    clear_session_cookie(response)
    return {"message": "Every session has been ended. Sign in again to carry on."}


# ─────────────────────────────────────────────────────────────────────────────
# Getting back in
#
# Until now the ONLY way to reset a password was for a staff member to trigger
# one (`members.py::start_password_reset`), and the link it emailed pointed at
# a `/reset-password` page that did not exist. A woman who forgot her password
# could not get back into her own account by any route at all — she had to find
# a human, and then the link she was sent led to a 404.
#
# Both halves are below. They reuse the same single-use `email_tokens` record
# the staff flow issues, so a staff-issued link and a self-service one are the
# same object and land on the same page.
# ─────────────────────────────────────────────────────────────────────────────

#: Said for every address, found or not. Telling a stranger which emails have
#: accounts is an account-enumeration oracle, and on a women-only platform that
#: is not an abstract concern: it answers "is she a member here?" for anyone
#: who wants to know.
_RESET_SENT = (
    "If that address has an account, a link to set a new password is on its "
    "way. It expires in 24 hours."
)

#: What to say when no mail provider is configured.
#:
#: The sentence above was being returned over a file adapter that writes to
#: `outbox/` and delivers nothing, so a woman locked out was told to wait for a
#: link that would never arrive. This says what is true without answering "is
#: she a member here?" — it is returned for every address, exactly like the one
#: above, so it still leaks nothing.
_RESET_NO_EMAIL = (
    "We cannot send email yet, so no link is coming. Write to "
    "support@womsakhi.com from this address and a person will reset it for you."
)


@router.post("/forgot-password", summary="Ask for a password reset link")
async def forgot_password(payload: ForgotPasswordRequest, request: Request):
    """Issue a single-use reset link and email it to her."""
    from app.core.email import can_deliver, reset_email, send
    from app.models.verification import EmailTokenModel

    await ratelimit.check(
        request, "forgot", payload.email,
        ratelimit.PASSWORD_RESET, ratelimit.PASSWORD_RESET_IP,
    )

    db = get_database()
    user = await db[UserModel.collection_name].find_one({"email": payload.email.lower()})

    # Deliberately the same answer, and the same amount of work, either way.
    if user:
        # Retire any earlier unused link so only the newest one opens.
        await db[EmailTokenModel.collection_name].delete_many(
            {
                "user_id": str(user["_id"]),
                "purpose": EmailTokenModel.PURPOSE_RESET,
                "used_at": None,
            }
        )
        token_doc = EmailTokenModel.create_document(
            str(user["_id"]), EmailTokenModel.PURPOSE_RESET, hours=24
        )
        await db[EmailTokenModel.collection_name].insert_one(token_doc)
        url = f"{settings.APP_BASE_URL}/reset-password?token={token_doc['token']}"
        await send(reset_email(user.get("full_name", ""), url), user["email"])

    # The token is still minted and still stored either way — the moment a
    # provider is configured the link she already asked for starts working,
    # and staff can read it out of `outbox/` meanwhile.
    deliverable = can_deliver()
    return {
        "message": _RESET_SENT if deliverable else _RESET_NO_EMAIL,
        "can_email": deliverable,
    }


@router.post("/reset-password", summary="Set a new password from a reset link")
async def reset_password(payload: ResetPasswordRequest, request: Request):
    """Spend the token and set the new password."""
    from app.models.verification import EmailTokenModel

    # Keyed on the token, so guessing tokens is rate limited as well as
    # unguessable — `secrets.token_urlsafe(32)` is 256 bits.
    await ratelimit.check(
        request, "reset", payload.token,
        ratelimit.PASSWORD_RESET, ratelimit.PASSWORD_RESET_IP,
    )

    db = get_database()
    record = await db[EmailTokenModel.collection_name].find_one(
        {"token": payload.token, "purpose": EmailTokenModel.PURPOSE_RESET}
    )
    if not EmailTokenModel.is_valid(record):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "That link has expired or has already been used. Ask for a new one.",
        )

    user = await db[UserModel.collection_name].find_one({"_id": ObjectId(record["user_id"])})
    if not user:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That account no longer exists.")

    now = datetime.now(timezone.utc)
    await db[UserModel.collection_name].update_one(
        {"_id": user["_id"]},
        {
            "$set": {"password": await hash_password_async(payload.password), "updated_at": now},
            # Bumped here so that the day `_token_for` starts reading it, a
            # reset ends every other session by itself. Inert until then — see
            # `core/security.py`.
            "$inc": {"token_version": 1},
        },
    )
    # Single use: spent whether or not anything else goes wrong after this.
    await db[EmailTokenModel.collection_name].update_one(
        {"_id": record["_id"]}, {"$set": {"used_at": now}}
    )
    # She has proved control of the mailbox, so let her straight in rather than
    # making her retype what she just chose.
    await ratelimit.forget("signin", user["email"])

    return {"message": "Your password has been changed. You can sign in with it now."}
