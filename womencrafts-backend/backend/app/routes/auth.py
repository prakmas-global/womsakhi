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
from app.schemas.auth import SignUpRequest, SignInRequest, AuthResponse, UserResponse
from app.core.security import decode_access_token, hash_password, verify_password, create_access_token
from app.core.session import COOKIE_NAME, clear_session_cookie, set_session_cookie
from app.routes.verification import send_verification_email

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
    """
    return create_access_token(
        {"sub": str(doc["_id"]), "email": doc["email"], "role": role_name(doc)}
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
    ratelimit.check(request, "signup", payload.email, ratelimit.SIGN_UP, ratelimit.SIGN_UP_IP)

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
        status="Active",
        code=await _next_member_code(db),
    )
    member_result = await db[MemberModel.collection_name].insert_one(member_doc)

    doc = UserModel.create_document(
        full_name=payload.full_name,
        email=email,
        hashed_password=hash_password(payload.password),
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
    ratelimit.check(request, "signin", payload.email, ratelimit.SIGN_IN, ratelimit.SIGN_IN_IP)

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

    if not verify_password(payload.password, user["hashed_password"]):
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

    # Successful sign-in clears the failure counter — and her rate-limit
    # budget. Otherwise a woman who mistypes four times and then gets it right
    # is two tries from being locked out for a minute, punished for eventually
    # succeeding.
    ratelimit.forget("signin", payload.email)
    await collection.update_one(
        {"_id": user["_id"]},
        {"$set": {"failed_logins": 0, "locked_until": None, "last_login_at": now}},
    )
    token = _token_for(user)
    set_session_cookie(response, token)
    return AuthResponse(access_token=token, user=await _user_response(user))


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
