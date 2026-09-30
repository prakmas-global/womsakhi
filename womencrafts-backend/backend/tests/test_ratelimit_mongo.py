"""
The MongoDB rate-limit store, against the throwaway local mongod.

Production runs several Cloud Run instances and no Redis, so this store is what
makes a limit of six mean six rather than six per instance. Every test uses a
fresh random identifier, so they cannot see each other's counters.
"""

import asyncio
import uuid

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.core import ratelimit
from app.core.config import settings
from tests.conftest import LOCAL_MONGO_DB


def _request(ip: str = "203.0.113.9") -> Request:
    return Request({"type": "http", "method": "POST", "path": "/", "headers": [],
                    "client": (ip, 1234), "query_string": b""})


@pytest.fixture
async def store(local_mongo, monkeypatch):
    db = local_mongo[LOCAL_MONGO_DB]
    monkeypatch.setattr(settings, "REDIS_URL", "")
    monkeypatch.setattr(ratelimit, "db_provider", lambda: db)
    ratelimit._hits.clear()
    bucket = f"test_rl_{uuid.uuid4().hex[:10]}"
    yield db[ratelimit.COLLECTION], bucket
    assert bucket.startswith("test_rl_")  # never an empty or broad cleanup filter
    await db[ratelimit.COLLECTION].delete_many({"bucket": bucket})
    ratelimit._hits.clear()


async def test_the_limit_is_hit_exactly_at_n(store):
    coll, bucket = store
    for _ in range(5):
        await ratelimit.check(_request(), bucket, "Her@Example.com", (5, 600.0))
    with pytest.raises(HTTPException) as refused:
        await ratelimit.check(_request(), bucket, "her@example.com", (5, 600.0))
    assert refused.value.status_code == 429
    wait = int(refused.value.headers["Retry-After"])
    assert 1 <= wait <= 600
    assert refused.value.detail == f"Too many tries. Wait {wait} seconds and try again."
    # Counted in the shared store, not in this process.
    row = await coll.find_one({"key": f"{bucket}:id:her@example.com"})
    assert row["count"] == 6 and row["bucket"] == bucket and row["expires_at"]
    assert ratelimit._hits == {}


async def test_the_ip_budget_is_counted_separately(store):
    _, bucket = store
    for n in range(3):
        await ratelimit.check(_request(), bucket, f"woman{n}@example.com", (5, 600.0), (3, 600.0))
    with pytest.raises(HTTPException) as refused:
        await ratelimit.check(_request(), bucket, "woman9@example.com", (5, 600.0), (3, 600.0))
    assert refused.value.status_code == 429
    # A different address on a different connection is untouched.
    await ratelimit.check(_request("198.51.100.1"), bucket, "woman9@example.com", (5, 600.0), (3, 600.0))


async def test_the_window_expires(store, monkeypatch):
    _, bucket = store
    clock = [1_800_000_000.0]
    monkeypatch.setattr(ratelimit, "_wall", lambda: clock[0])
    for _ in range(2):
        await ratelimit.check(_request(), bucket, "her@example.com", (2, 60.0))
    with pytest.raises(HTTPException) as refused:
        await ratelimit.check(_request(), bucket, "her@example.com", (2, 60.0))
    assert refused.value.headers["Retry-After"] == "60"
    clock[0] += 59
    with pytest.raises(HTTPException) as refused:
        await ratelimit.check(_request(), bucket, "her@example.com", (2, 60.0))
    assert refused.value.headers["Retry-After"] == "1"
    clock[0] += 1  # the next window
    await ratelimit.check(_request(), bucket, "her@example.com", (2, 60.0))


async def test_forget_clears_the_budget(store):
    coll, bucket = store
    for _ in range(3):
        await ratelimit.check(_request(), bucket, "her@example.com", (3, 600.0))
    with pytest.raises(HTTPException):
        await ratelimit.check(_request(), bucket, "her@example.com", (3, 600.0))
    await ratelimit.forget(bucket, "HER@example.com")
    assert await coll.count_documents({"key": f"{bucket}:id:her@example.com"}) == 0
    await ratelimit.check(_request(), bucket, "her@example.com", (3, 600.0))


async def test_concurrent_increments_both_count(store):
    """Two servers creating the same row at once: both hits count, neither errors."""
    coll, bucket = store
    key = f"{bucket}:id:her@example.com"
    results = await asyncio.gather(*[ratelimit._mongo_hit(bucket, key, 600.0) for _ in range(20)])
    assert all(r is not None for r in results)
    assert sorted(r[0] for r in results) == list(range(1, 21))
    assert (await coll.find_one({"key": key}))["count"] == 20


async def test_a_duplicate_key_on_upsert_is_retried_once(store, monkeypatch):
    from pymongo.errors import DuplicateKeyError

    coll, bucket = store
    real = coll.find_one_and_update
    calls = []

    async def racing(*args, **kwargs):
        calls.append(1)
        if len(calls) == 1:
            raise DuplicateKeyError("E11000 duplicate key")
        return await real(*args, **kwargs)

    class _Db:
        def __getitem__(self, name):
            class _C:
                find_one_and_update = staticmethod(racing)
            return _C()

    monkeypatch.setattr(ratelimit, "db_provider", lambda: _Db())
    got = await ratelimit._mongo_hit(bucket, f"{bucket}:id:her@example.com", 600.0)
    assert got is not None and got[0] == 1 and len(calls) == 2


async def test_a_store_failure_fails_open_to_the_local_counter(monkeypatch):
    """A broken store must never 500 a sign-in; it degrades to per-process counting."""
    monkeypatch.setattr(settings, "REDIS_URL", "")

    def broken():
        raise RuntimeError("Database client is not initialized")

    monkeypatch.setattr(ratelimit, "db_provider", broken)
    ratelimit._hits.clear()
    bucket = f"test_rl_{uuid.uuid4().hex[:10]}"
    await ratelimit.check(_request(), bucket, "her@example.com", (2, 600.0))
    await ratelimit.check(_request(), bucket, "her@example.com", (2, 600.0))
    with pytest.raises(HTTPException) as refused:
        await ratelimit.check(_request(), bucket, "her@example.com", (2, 600.0))
    assert refused.value.status_code == 429
    await ratelimit.forget(bucket, "her@example.com")
    await ratelimit.check(_request(), bucket, "her@example.com", (2, 600.0))
    ratelimit._hits.clear()


def test_the_ttl_index_is_registered():
    from app.db.indexes import INDEXES

    docs = {m.document["name"]: m.document for m in INDEXES["rate_limits"]}
    assert docs["ttl"]["key"] == {"expires_at": 1} and docs["ttl"]["expireAfterSeconds"] == 0
    assert docs["key"]["key"] == {"key": 1}
