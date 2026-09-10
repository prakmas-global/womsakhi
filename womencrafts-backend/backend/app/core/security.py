"""
Passwords and session tokens.

**bcrypt at cost 12**, which is `gensalt()`'s default and current practice — a
hash takes about 0.24s on this machine, which is nothing once per sign-in and
ruinous a billion times over in an offline crack. It is deliberately NOT raised
further: cost 14 is four times slower, and the thing it would defend against
(someone who already has the database) is better answered by not losing the
database. Revisit if commodity GPUs move.

**The 72-byte wall.** bcrypt has only ever hashed the first 72 bytes of a
password. Older bindings truncated silently; bcrypt 5 raises instead — so a
woman signing up with a long passphrase, or anything a password manager
generated, got a 500 and no account. That was live, and it is fixed by
truncating here, explicitly, at the one boundary that touches bcrypt.

Pre-hashing with SHA-256 would remove the limit properly, and it is the usual
advice. It is not done here because it would invalidate every hash already in
the database — every existing member locked out of her own account to fix an
edge case none of them have hit. If this is ever revisited, it has to be a
migration that re-hashes on next successful sign-in, not a flag day.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings

#: What bcrypt actually reads. Everything past this was never part of the hash.
BCRYPT_MAX_BYTES = 72


def _bcrypt_bytes(password: str) -> bytes:
    """
    Encode a password the way bcrypt will actually consume it.

    Slicing bytes can cut a multi-byte character in half, which looks alarming
    and is harmless: bcrypt hashes bytes, not text, and the same input always
    produces the same 72 bytes. Names and passphrases in Hindi or Tamil hit this
    sooner than English ones — 72 bytes is only about 24 Devanagari characters —
    so it is not a hypothetical here.
    """
    return password.encode("utf-8")[:BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_bcrypt_bytes(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Check a password against a stored hash. Never raises.

    `checkpw` throws ValueError("Invalid salt") on a stored value that is not a
    bcrypt hash — an empty string, a legacy row, a half-finished migration. That
    reached the client as a 500 while a wrong password returned 401, which told
    an attacker which accounts had unusable hashes. A failure to verify is a
    failed sign-in, and it looks exactly like every other failed sign-in.
    """
    if not plain_password or not hashed_password:
        return False
    try:
        return bcrypt.checkpw(_bcrypt_bytes(plain_password), hashed_password.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Mint a session token.

    `iat` rides along so a token can be aged independently of `exp`, and so an
    audit line can say when a session began rather than when it will end.

    `tv` is the account's token version — see `token_version_of` below.
    """
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "iat": now})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError:
        return None


# --- revoking a session that is already out there ----------------------------

TOKEN_VERSION_CLAIM = "tv"


def token_version_of(user: dict) -> int:
    """
    The account's current session generation.

    Signing out clears the cookie in *her* browser. It does nothing to a token
    someone else already copied — and on this platform that is the whole point
    of signing out. A woman who realises her partner has been reading her
    account needs "end every session, now" to mean it, not "end it here and
    hope", and a stateless JWT cannot do that on its own.

    So every token carries the generation it was minted in, and
    `deps.get_current_user` refuses a token from an older one. Bumping
    `token_version` on her user document invalidates every session she has,
    everywhere, on the next request.

    Accounts created before this existed have no field and no claim, and both
    read as 0 — so nothing already signed in is thrown out by adding it.
    """
    try:
        return int(user.get("token_version") or 0)
    except (TypeError, ValueError):
        return 0


def token_version_in(payload: dict) -> int:
    try:
        return int(payload.get(TOKEN_VERSION_CLAIM) or 0)
    except (TypeError, ValueError):
        return 0


# ── The same two, off the event loop ────────────────────────────────────────
#
# bcrypt is deliberately slow — that is its whole job — and it is CPU work, so
# awaiting it inline freezes the single worker for 250-400ms. Every other
# woman's request waits behind one woman signing in. The sync versions above
# stay for any caller that is not in an async context.

async def hash_password_async(password: str) -> str:
    return await asyncio.to_thread(hash_password, password)


async def verify_password_async(plain_password: str, hashed_password: str) -> bool:
    return await asyncio.to_thread(verify_password, plain_password, hashed_password)
