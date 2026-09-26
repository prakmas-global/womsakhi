from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from bson import ObjectId

from app.core import cache
from app.core.security import TOKEN_VERSION_CLAIM, decode_access_token, token_version_in, token_version_of
from app.core.session import COOKIE_NAME
from app.db.mongodb import get_database
from app.models.user import UserModel

# auto_error=False: a missing header is not an error here, because the session
# may be arriving in the httpOnly cookie instead.
_security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_security),
) -> dict:
    """
    Resolve the caller from the session cookie, or an Authorization header.

    The cookie is the browser's path (httpOnly, so JS never sees the token); the
    header stays supported for scripts, tests and non-browser clients.
    """
    token = credentials.credentials if credentials else request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    # Cached for a few seconds. This lookup ran on every one of the 380
    # endpoints, so it was a round trip — about 50ms to another data centre —
    # that every screen paid before it did any of its own work.
    #
    # The staleness window is bounded twice over: a short TTL, and an explicit
    # `cache.forget_user` on every write that changes whether she may act. See
    # `core/cache.py` for why this is the one per-person thing that is cached.
    async def _load() -> Optional[dict]:
        db = get_database()
        return await db[UserModel.collection_name].find_one({"_id": ObjectId(payload["sub"])})

    user = await cache.cached(f"user:{payload['sub']}", cache.USER_TTL, _load)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not user.get("is_active", True):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account deactivated")

    # Has this session been revoked wholesale? See `security.token_version_of`
    # for why "sign out everywhere" has to mean something on this platform.
    #
    # NOTE, and this is the part that matters: the check only fires on a token
    # that CARRIES a `tv` claim, and nothing mints one yet — `routes/auth.py::
    # _token_for` has to add `TOKEN_VERSION_CLAIM` for this to do any work.
    # Until it does, bumping `token_version` on a user document has NO effect.
    #
    # It is written this way round on purpose. The alternative — reject any
    # token whose claim is behind the account — locks a woman out permanently
    # the moment someone bumps her version, because the token she gets from
    # signing in again would also have no claim and would also be behind. A
    # revocation switch that does nothing is a bug to be finished; one that
    # cannot be undone by signing in again is a woman with no account.
    # A claim of 0 IS a claim: every account starts at generation 0, so the
    # first "sign out everywhere" or password change bumps it to 1, and a
    # token still saying 0 must be refused. Only a token with no claim at all —
    # one minted before the claim existed — is let through, for the reason
    # above.
    if TOKEN_VERSION_CLAIM in payload and token_version_in(payload) < token_version_of(user):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This session was ended. Please sign in again.",
        )
    return user
