"""
A double tap on a bad connection must not pay twice.

This is not a theoretical concern on this platform. A woman on 2G presses
"Confirm payment", the spinner sits there, she is not sure it went through, and
she presses it again. Without this, that is two payments — and getting one back
takes days she cannot spare.

**How it works.** The client sends an `Idempotency-Key` — any string it makes
up, one per intent, reused on retry. The first request through claims the key by
inserting it, does the work, and stores the response against it. A second
request with the same key gets the stored response back instead of doing the
work again.

**The claim is a unique index, not a check.** Reading "has this key been used?"
and then writing it is exactly the race the whole mechanism exists to close: two
retries arriving together both read "no". `insert_one` against a unique index
makes the database decide, and exactly one of them wins.

**A key in flight returns 409, not the old answer.** If the first request has
not finished, there is no stored response to return and the honest answer is
"this is already happening" — better than a second charge, and better than a
silent success the client would read as a second payment.

Keys expire after 24 hours by a TTL index. A retry a day later is a new intent.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Callable, Awaitable, Optional

from fastapi import HTTPException, Request, status
from pymongo.errors import DuplicateKeyError

from app.db.mongodb import get_database

COLLECTION = "idempotency_keys"
HEADER = "Idempotency-Key"

STATE_RUNNING = "running"
STATE_DONE = "done"


def key_from(request: Request) -> Optional[str]:
    got = request.headers.get(HEADER, "").strip()
    return got[:128] or None


async def once(
    request: Request,
    user_id: str,
    scope: str,
    do: Callable[[], Awaitable[Any]],
) -> Any:
    """
    Run `do` at most once for this (user, scope, key).

    Without a key, `do` runs normally — the header is opt-in, and a client that
    does not send one is no worse off than before. With a key, the second call
    gets the first call's answer.

    `scope` keeps keys from colliding across endpoints: a client that reuses one
    key for a withdrawal and a booking should get two actions, not one.
    """
    key = key_from(request)
    if not key:
        return await do()

    coll = get_database()[COLLECTION]
    claim = {
        "user_id": user_id,
        "scope": scope,
        "key": key,
        "state": STATE_RUNNING,
        "response": None,
        "created_at": datetime.now(timezone.utc),
    }

    try:
        await coll.insert_one(claim)
    except DuplicateKeyError:
        existing = await coll.find_one({"user_id": user_id, "scope": scope, "key": key})
        if existing and existing.get("state") == STATE_DONE:
            return existing.get("response")
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "That is already going through. Give it a moment rather than trying again.",
        )

    try:
        result = await do()
    except Exception:
        # A failure must not be remembered as a success. Releasing the key lets
        # her genuinely retry, which is what she is trying to do.
        await coll.delete_one({"user_id": user_id, "scope": scope, "key": key})
        raise

    # Pydantic models are not BSON. Store what the client will actually receive.
    stored = result
    if hasattr(result, "model_dump"):
        stored = result.model_dump(mode="json")

    await coll.update_one(
        {"user_id": user_id, "scope": scope, "key": key},
        {"$set": {"state": STATE_DONE, "response": stored}},
    )
    return result
