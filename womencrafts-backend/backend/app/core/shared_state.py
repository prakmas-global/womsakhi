"""
The one piece of state that cannot live inside a single process.

**Why this exists.** The cache (`core/cache.py`) and the rate limiter
(`core/ratelimit.py`) both keep their state in a module-level dict. That is
correct and fast for one worker and quietly wrong for two, in different ways:

  · **The cache** just gets colder — each worker keeps its own copy, so the hit
    rate falls. Wasteful, not dangerous.
  · **The rate limiter is a security control, and it multiplies.**
    `MAX_FAILED_LOGINS = 5` with four workers is up to twenty password attempts
    before a lockout, because each worker counts to five on its own. Nothing
    reports this. The setting still says five, the code still reads five, and
    an attacker gets four times the guesses.

So this module gives both a shared backend when `REDIS_URL` is set, and leaves
them exactly as they were when it is not — a single worker on a laptop needs no
Redis and should not be made to install one.

`available()` is what `main.py` checks before allowing more than one worker.
"""

from __future__ import annotations

from typing import Optional

from app.core.config import settings

_client = None
_checked = False


def _connect():
    """Lazily open one connection pool per process. Never raises."""
    global _client, _checked
    if _checked:
        return _client
    _checked = True
    url = getattr(settings, "REDIS_URL", "")
    if not url:
        return None
    try:
        import redis.asyncio as redis_asyncio

        _client = redis_asyncio.from_url(
            url,
            encoding="utf-8",
            decode_responses=True,
            # A slow Redis must never become a slow sign-in. Both callers fall
            # back to their in-process behaviour when this times out, which is
            # degraded but working, and better than a page that will not load.
            socket_timeout=1.5,
            socket_connect_timeout=1.5,
        )
    except Exception as exc:  # noqa: BLE001
        print(f"⚠️  REDIS_URL is set but the client could not be created: {exc}")
        _client = None
    return _client


def client():
    return _connect()


def configured() -> bool:
    """Is a shared backend even asked for?"""
    return bool(getattr(settings, "REDIS_URL", ""))


async def available() -> bool:
    """Is it actually reachable? Asked at startup, not on the request path."""
    c = _connect()
    if c is None:
        return False
    try:
        return bool(await c.ping())
    except Exception:  # noqa: BLE001
        return False


async def hit(key: str, window_seconds: float) -> Optional[int]:
    """
    Count one attempt against `key` and return the running total.

    A pipeline, so INCR and EXPIRE are one round trip: two calls would let a
    process die between them and leave a counter with no expiry, which locks
    somebody out permanently rather than for fifteen minutes.

    `None` means Redis did not answer — the caller falls back to counting in
    process, which is the behaviour it had before this module existed.
    """
    c = _connect()
    if c is None:
        return None
    try:
        pipe = c.pipeline()
        pipe.incr(key, 1)
        pipe.expire(key, int(window_seconds) + 1)
        count, _ = await pipe.execute()
        return int(count)
    except Exception:  # noqa: BLE001
        return None


async def forget(key: str) -> None:
    """Clear one counter — after a successful sign-in, say."""
    c = _connect()
    if c is None:
        return
    try:
        await c.delete(key)
    except Exception:  # noqa: BLE001
        pass
