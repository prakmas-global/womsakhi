"""
Count and time every database operation, in the request's own context.

**The first attempt at this did not work, and the reason is worth writing down.**
It used pymongo's `CommandListener`, which is the documented way to observe the
driver — but motor runs pymongo's operations on a thread pool, so the listener
fires on a *worker* thread. A `ContextVar` set there belongs to that thread's
context and is invisible to the coroutine that made the call. Every request
reported zero queries while plainly making a dozen.

So the timing happens where the `await` happens instead: a thin proxy around
the database handle. `get_database()` hands back a `Db` rather than motor's
own object, and every operation it exposes is wrapped so the clock starts and
stops inside the caller's context, where the ContextVar lives.

The proxy is deliberately dumb. It does not validate, translate or cache — it
forwards, and records how long the forwarding took. Anything cleverer would be
a second place where a query can go wrong.
"""

from __future__ import annotations

import time
from typing import Any

from app.core.observability import record_query

#: Operations that return a value directly and can simply be timed.
_AWAITED = frozenset({
    "find_one", "insert_one", "insert_many", "update_one", "update_many",
    "replace_one", "delete_one", "delete_many", "count_documents",
    "estimated_document_count", "find_one_and_update", "find_one_and_replace",
    "find_one_and_delete", "distinct", "bulk_write", "create_index",
    "create_indexes", "drop_index", "drop", "list_indexes",
})

#: Operations that return a cursor. The work happens when it is drained.
_CURSORS = frozenset({"find", "aggregate", "list_indexes"})

#: Operations that change a document, and so may invalidate a cached copy.
_WRITES = frozenset({
    "update_one", "update_many", "replace_one", "delete_one", "delete_many",
    "find_one_and_update", "find_one_and_replace", "find_one_and_delete",
})


def _invalidate(collection: str, filt: Any) -> None:
    """
    Drop a cached user record when the user document behind it changes.

    **Why here and not at the call sites.** There are nineteen places that write
    to `users`, spread over seven routers, and the failure mode of forgetting
    one is not a crash — it is a woman who was deactivated fifteen seconds ago
    still being allowed in. A rule that has to be remembered nineteen times is
    a rule that will be broken once.

    The proxy already sees every operation, so it enforces this in the one place
    that cannot be bypassed.
    """
    if collection != "users":
        return
    from app.core import cache      # local import: cache must not import db

    if isinstance(filt, dict):
        ident = filt.get("_id")
        if ident is not None:
            cache.forget_user(str(ident))
            return
    # A filter we cannot read precisely — a bulk status change, say. Drop every
    # cached user rather than guess which one moved.
    cache.forget_prefix("user:")


class Cursor:
    """Wraps a motor cursor so draining it is what gets timed, not creating it."""

    __slots__ = ("_c",)

    def __init__(self, cursor: Any) -> None:
        self._c = cursor

    # Chainable builders return a new wrapper so `.sort(...).limit(...)` works.
    def sort(self, *a: Any, **k: Any) -> "Cursor":
        return Cursor(self._c.sort(*a, **k))

    def limit(self, *a: Any, **k: Any) -> "Cursor":
        return Cursor(self._c.limit(*a, **k))

    def skip(self, *a: Any, **k: Any) -> "Cursor":
        return Cursor(self._c.skip(*a, **k))

    async def to_list(self, *a: Any, **k: Any) -> list:
        started = time.perf_counter()
        try:
            return await self._c.to_list(*a, **k)
        finally:
            record_query((time.perf_counter() - started) * 1000)

    def __aiter__(self) -> Any:
        # One query, however many documents come back: the round trips are
        # batched by the driver, and counting each document would make an
        # honest single query look like a hundred.
        outer = self

        async def gen():
            started = time.perf_counter()
            counted = False
            try:
                async for doc in outer._c:
                    if not counted:
                        record_query((time.perf_counter() - started) * 1000)
                        counted = True
                    yield doc
            finally:
                if not counted:
                    record_query((time.perf_counter() - started) * 1000)

        return gen()

    def __getattr__(self, name: str) -> Any:
        return getattr(self._c, name)


class Collection:
    __slots__ = ("_c", "_name")

    def __init__(self, collection: Any, name: str = "") -> None:
        self._c = collection
        self._name = name

    def __getattr__(self, name: str) -> Any:
        attr = getattr(self._c, name)

        if name in _CURSORS:
            def make_cursor(*a: Any, **k: Any) -> Cursor:
                return Cursor(attr(*a, **k))
            return make_cursor

        if name in _AWAITED:
            is_write = name in _WRITES
            coll = self._name

            async def timed(*a: Any, **k: Any) -> Any:
                started = time.perf_counter()
                try:
                    return await attr(*a, **k)
                finally:
                    record_query((time.perf_counter() - started) * 1000)
                    # After the write, not before: a write that raised changed
                    # nothing, and dropping the cache for it would be a free
                    # round trip for the next reader with nothing to show for it.
                    if is_write and a:
                        _invalidate(coll, a[0])
            return timed

        return attr


class Db:
    """Stands in for the motor database, handing out instrumented collections."""

    __slots__ = ("_db", "_cache")

    def __init__(self, db: Any) -> None:
        self._db = db
        self._cache: dict[str, Collection] = {}

    def __getitem__(self, name: str) -> Collection:
        got = self._cache.get(name)
        if got is None:
            got = self._cache[name] = Collection(self._db[name], name)
        return got

    def __getattr__(self, name: str) -> Any:
        # `db.users` is the same as `db["users"]`, but `db.command(...)` and
        # `db.list_collection_names()` must still reach the real object.
        if name.startswith("_"):
            raise AttributeError(name)
        attr = getattr(self._db, name, None)
        if attr is None or callable(attr):
            return attr if attr is not None else self[name]
        return attr
