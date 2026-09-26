from unittest.mock import AsyncMock

import pytest
from pymongo.errors import DuplicateKeyError

from app.engines import tick, wiring


class _Db(dict):
    pass


@pytest.mark.asyncio
async def test_sweep_uses_recoverable_lease_and_marks_completion(monkeypatch):
    collection = AsyncMock()
    collection.find_one_and_update.return_value = {"_id": "hour", "attempts": 2}
    db = _Db(engine_sweeps=collection)
    monkeypatch.setattr(tick, "_db", lambda: db)
    run_sync = AsyncMock(return_value={"goals": 1})
    monkeypatch.setattr(wiring, "run_sync", run_sync)

    result = await tick.run_sweep()

    assert result == {"goals": 1}
    claim_filter = collection.find_one_and_update.await_args.args[0]
    assert {"lease_expires_at": {"$exists": False}} in claim_filter["$or"]
    update = collection.update_one.await_args.args[1]
    assert update["$set"]["result"] == {"goals": 1}
    assert update["$unset"] == {"lease_expires_at": ""}


@pytest.mark.asyncio
async def test_unfinished_duplicate_sweep_stays_retryable(monkeypatch):
    collection = AsyncMock()
    collection.find_one_and_update.side_effect = DuplicateKeyError("busy")
    collection.find_one.return_value = {"_id": "hour", "lease_expires_at": "future"}
    db = _Db(engine_sweeps=collection)
    monkeypatch.setattr(tick, "_db", lambda: db)
    run_sync = AsyncMock()
    monkeypatch.setattr(wiring, "run_sync", run_sync)

    with pytest.raises(RuntimeError, match="already running"):
        await tick.run_sweep()
    run_sync.assert_not_awaited()


@pytest.mark.asyncio
async def test_finished_duplicate_sweep_is_idempotent(monkeypatch):
    collection = AsyncMock()
    collection.find_one_and_update.side_effect = DuplicateKeyError("done")
    collection.find_one.return_value = {"_id": "hour", "finished_at": "done"}
    db = _Db(engine_sweeps=collection)
    monkeypatch.setattr(tick, "_db", lambda: db)
    run_sync = AsyncMock()
    monkeypatch.setattr(wiring, "run_sync", run_sync)

    assert await tick.run_sweep() is None
    run_sync.assert_not_awaited()
