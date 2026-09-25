"""
Committing a domain change and its event together.

**The window this closes.** A booking moves. Two writes follow: the booking
document, and the outbox event that tells the Reminder Engine to recalculate.
Between them the process can die — Cloud Run can and does stop an instance
mid-request when it scales down. The booking is then Thursday and the reminder
is still Tuesday, permanently, with nothing anywhere recording the
disagreement. Nobody notices until a woman misses her session.

A transaction removes the window. Atlas runs a replica set, so this is
available without any extra infrastructure.

**Why it degrades instead of failing.** A single-node Mongo (a laptop, a CI
container) cannot start a transaction and raises. Refusing to work there would
make the whole engine undevelopable locally, so `atomic()` falls back to
running the same body without a session. That is genuinely weaker — the window
comes back — which is why it says so out loud on the first fallback rather than
hiding it. Production is Atlas; the fallback is for a laptop.

Usage:

    async with atomic() as session:
        await db.bookings.update_one({...}, {...}, session=session)
        await db.outbox.insert_one(event, session=session)
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from app.db.mongodb import _client

_warned = False


def _transactions_available() -> bool:
    """
    True when the deployment can actually start one.

    Read from the live topology rather than from configuration: a URI can say
    `mongodb+srv` and still resolve to something that will not support this,
    and finding that out at the first write is too late.
    """
    if _client is None:
        return False
    try:
        topology = _client.topology_description.topology_type_name
    except Exception:  # noqa: BLE001 - never let a probe break a request
        return False
    return topology in ("ReplicaSetWithPrimary", "Sharded", "LoadBalanced")


@asynccontextmanager
async def atomic():
    """
    Yield a session that commits everything or nothing.

    Yields `None` where transactions are unavailable, and every caller passes
    `session=session` regardless — Motor accepts `session=None` as "no session",
    so the same code works both ways with no branching at the call site.
    """
    global _warned
    from app.db.mongodb import _client as client   # re-read: set at startup

    if client is None or not _transactions_available():
        if not _warned:
            _warned = True
            print("⚠️  Transactions unavailable (not a replica set). "
                  "Domain change and outbox event are committed separately — "
                  "a crash between them can lose the event. Fine locally, "
                  "not fine in production.")
        yield None
        return

    async with await client.start_session() as session:
        async with session.start_transaction():
            yield session
