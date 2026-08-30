"""
Every response says how long it took and how many times it asked the database.

The reason this exists rather than a profiler: the cost of this API is almost
entirely round trips to a MongoDB Atlas cluster in another data centre, and a
round trip costs about 50ms whatever it fetches. So the number that predicts
how slow an endpoint feels is not how much work it does — it is how many times
it asks. `/me/programs` was 712ms because it asked fourteen times.

A profiler shows you the 712ms. This shows you the fourteen.

Two things are published:

- **`Server-Timing`** on every response, which browsers render natively in the
  network tab. `db;dur=680, app;dur=32, total;dur=712` is readable without
  tooling, by anyone, on the surface where the slowness was noticed.
- **`X-Query-Count`**, because "fourteen queries" is the actionable half.

And anything slow enough to notice is logged with the route that caused it, so
a regression announces itself instead of waiting for a complaint.
"""

from __future__ import annotations

import logging
import time
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.types import ASGIApp

log = logging.getLogger("womsakhi.perf")

class Counter:
    """
    A mutable tally the endpoint can add to and the middleware can read.

    **Why a mutable object rather than two integer ContextVars.** Starlette's
    `BaseHTTPMiddleware` runs the downstream app in a *child* task. A context is
    copied downward when a task is spawned, never merged back — so every
    `ContextVar.set()` the endpoint made wrote into its own copy, and the
    middleware read the zero it had put there itself. Every request reported no
    queries while plainly making a dozen.

    Storing one object and mutating it in place sidesteps the copy entirely:
    parent and child hold the same reference, so what the child adds the parent
    can see.
    """

    __slots__ = ("queries", "db_ms")

    def __init__(self) -> None:
        self.queries = 0
        self.db_ms = 0.0

    def add(self, elapsed_ms: float) -> None:
        self.queries += 1
        self.db_ms += elapsed_ms


_counter: ContextVar[Counter | None] = ContextVar("db_counter", default=None)

#: A request that takes longer than this is worth a line in the log.
SLOW_MS = 200.0
#: So is one that asks the database more times than this.
CHATTY_QUERIES = 5


def record_query(elapsed_ms: float) -> None:
    """Called by the instrumented database proxy for each operation."""
    c = _counter.get()
    if c is not None:          # outside a request (startup, seeding) — no tally
        c.add(elapsed_ms)


class TimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        counter = Counter()
        token = _counter.set(counter)
        started = time.perf_counter()
        try:
            response = await call_next(request)
        finally:
            total_ms = (time.perf_counter() - started) * 1000
            _counter.reset(token)

        # `db` is the SUM of time spent in database calls, which can legitimately
        # exceed the wall clock — that happens exactly when queries were run
        # concurrently, which is the goal. Reporting `app = total - db` made
        # that look like an error and clamped to a meaningless zero, so both
        # numbers are published plainly instead and the ratio between them is
        # the signal: db ≈ total means serial, db > total means gathered.
        response.headers["Server-Timing"] = (
            f"db;dur={counter.db_ms:.1f}, wall;dur={total_ms:.1f}"
        )
        response.headers["X-Query-Count"] = str(counter.queries)

        if total_ms >= SLOW_MS or counter.queries > CHATTY_QUERIES:
            # The route pattern, not the URL: "/me/programs" groups, and
            # "/me/programs/6a82…/detail" does not.
            route = request.scope.get("route")
            where = getattr(route, "path", request.url.path)
            log.warning(
                "slow %s %s — %.0fms total, %.0fms in %d %s",
                request.method, where, total_ms, counter.db_ms, counter.queries,
                "query" if counter.queries == 1 else "queries",
            )
        return response
