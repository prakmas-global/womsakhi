"""
An in-process cache, kept deliberately small.

The database is a MongoDB Atlas cluster in another data centre, so a round trip
costs about 50ms whatever it fetches. That makes caching unusually valuable
here — and unusually dangerous, because the most-read documents are also the
ones where being wrong matters most.

So this module draws one hard line:

**Cache what is the same for everybody. Never cache what belongs to one woman.**

The catalogue, the mentor list, the helplines — every member gets the same
answer, it changes maybe weekly, and a minute of staleness costs nothing. Her
wallet, her bookings, her documents — a stale answer there is a wrong balance
or a booking she cancelled still showing as live, which is worse than slow.

The one exception is the signed-in user's own record, and it is an exception
with its own rules; see `USER_TTL` below.

There is no Redis and no second process. A single uvicorn worker holds this in
memory; if this ever runs multi-worker, each worker keeps its own copy and the
TTL is the only thing that bounds divergence — which is why the TTLs are short
and why every write path invalidates explicitly rather than waiting them out.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any, Awaitable, Callable, TypeVar

T = TypeVar("T")

#: How long a shared, read-mostly answer may be stale.
SHARED_TTL = 60.0

#: How long the signed-in user's own record may be stale.
#:
#: Short on purpose. This record decides whether an account is still active and
#: still admitted, so a stale copy is a deactivated woman who can still act.
#: Every write that changes any of that calls `forget_user`, so in practice the
#: window is zero — this bounds the case where somebody edits Mongo directly.
USER_TTL = 15.0

_store: dict[str, tuple[float, Any]] = {}
#: One lock per key, so two requests missing the same key make one query rather
#: than a thundering herd of identical ones.
_locks: dict[str, asyncio.Lock] = {}

_hits = 0
_misses = 0


def stats() -> tuple[int, int]:
    return _hits, _misses


async def cached(key: str, ttl: float, produce: Callable[[], Awaitable[T]]) -> T:
    """
    Return `key` from the cache, or produce it and remember it for `ttl`.

    The lock is taken only on a miss, and the cache is re-checked inside it, so
    the second caller through the door gets the first caller's answer instead of
    running the same query again.
    """
    global _hits, _misses

    now = time.monotonic()
    got = _store.get(key)
    if got is not None and got[0] > now:
        _hits += 1
        return got[1]

    lock = _locks.get(key)
    if lock is None:
        lock = _locks[key] = asyncio.Lock()

    async with lock:
        # Someone may have filled it while we waited for the lock.
        got = _store.get(key)
        if got is not None and got[0] > time.monotonic():
            _hits += 1
            return got[1]

        _misses += 1
        value = await produce()
        _store[key] = (time.monotonic() + ttl, value)
        return value


def forget(key: str) -> None:
    """Drop one key. Called by the write that made it wrong."""
    _store.pop(key, None)


def forget_prefix(prefix: str) -> None:
    """Drop a family of keys — `forget_prefix("catalog:")` after an edit."""
    for k in [k for k in _store if k.startswith(prefix)]:
        _store.pop(k, None)


def forget_user(user_id: str) -> None:
    """
    Drop a user's cached record.

    Call this from **every** write that changes whether she may act: admission,
    deactivation, role change, and her own profile. Missing one does not fail
    loudly — it fails as a woman who was just deactivated still being allowed
    in for fifteen seconds — so the list is worth keeping honest.
    """
    forget(f"user:{user_id}")


def clear() -> None:
    """Everything. For tests, and for a seed that rewrites the world."""
    _store.clear()
    _locks.clear()
