"""
The handful of things anyone may read without an account.

Everything else in this API requires a session. These do not, because they are
read by the sign-in screen — before there is a session to have.

**Why this exists at all.** The sign-in page carried four headline figures
("10K+ Jobs Posted", "50K+ Members" and so on) that were typed into a constant
by hand. Every stats endpoint in this app is staff-authenticated, so there was
nothing for the page to read and the numbers were simply invented. A woman
deciding whether to trust a platform with a photograph of her Aadhaar card was
being shown made-up evidence that she should.

So these are the real counts, and they will be small until they are not. A true
small number is worth more here than a large false one — and the page falls back
to a promise rather than printing an unimpressive figure, so nothing has to be
exaggerated to look respectable.
"""

from fastapi import APIRouter

from app.core import cache
from app.db.mongodb import get_database

router = APIRouter(prefix="/public", tags=["Public"])

#: Long, because these move slowly and this endpoint is unauthenticated — it is
#: the one surface a stranger can hit repeatedly, so it must not be a free way
#: to make the database work.
_TTL = 300.0


@router.get("/stats", summary="Real platform counts, for the sign-in page")
async def public_stats() -> dict:
    """
    Four counts, actually counted.

    Only what is already public on the platform: how many openings are live,
    how many courses exist, how many women have joined, how many savings
    circles are running. No names, nothing about any individual.
    """

    async def produce() -> dict:
        db = get_database()
        # Only what a visitor would legitimately be told about. `members` is the
        # profile directory, which is the count of women who have actually
        # joined — `users` also holds staff logins.
        counts = {
            "jobs": await db["opportunities"].count_documents({}),
            "courses": await db["programs"].count_documents({}),
            "members": await db["members"].count_documents({}),
            "circles": await db["circles"].count_documents({}),
        }
        return counts

    return await cache.cached("public:stats", _TTL, produce)


@router.get("/auth-providers", summary="Which social sign-ins actually work")
async def auth_providers() -> dict:
    """
    What the sign-in page may offer.

    The comp has "Continue with Google" and "Continue with Apple". This backend
    has no OAuth of any kind, so both were buttons that could only ever answer a
    press by doing nothing — on the one screen where "nothing happened" reads as
    "this app is broken" and she leaves.

    The page now asks this first and renders only what is listed. Today that is
    an empty list, so the row does not appear at all. Wire a provider up, add it
    here, and the button returns by itself.
    """
    from app.core.config import settings

    available: list[str] = []
    # Each entry needs BOTH a working server flow and configured credentials.
    # Listing one without the other is how a dead button gets shipped.
    if getattr(settings, "GOOGLE_CLIENT_ID", "") and getattr(settings, "GOOGLE_CLIENT_SECRET", ""):
        available.append("google")
    if getattr(settings, "APPLE_CLIENT_ID", "") and getattr(settings, "APPLE_KEY_ID", ""):
        available.append("apple")
    return {"providers": available}
