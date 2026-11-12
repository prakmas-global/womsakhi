"""The optional local clock cannot send external email/SMS or run in production."""
import asyncio
from unittest.mock import AsyncMock

import pytest

from app.core.config import settings
from app.engines import channels, local_worker, tick


def test_local_worker_disabled_by_default_and_in_production(monkeypatch):
    monkeypatch.setattr(settings, "ENGINES_ENABLED", True)
    monkeypatch.setattr(settings, "ENGINES_LOCAL_WORKER", False)
    assert local_worker.start() is None
    monkeypatch.setattr(settings, "ENGINES_LOCAL_WORKER", True)
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    assert local_worker.start() is None


@pytest.mark.asyncio
async def test_local_worker_runs_tick_records_heartbeat_and_cancels(monkeypatch):
    operation = AsyncMock(return_value={"enabled":True})
    monkeypatch.setattr(tick, "run_tick", operation)
    collection = AsyncMock()
    monkeypatch.setattr(local_worker, "get_database", lambda: {"engine_runtime":collection})
    monkeypatch.setattr(local_worker.asyncio, "sleep", AsyncMock(side_effect=asyncio.CancelledError))
    with pytest.raises(asyncio.CancelledError):
        await local_worker.run()
    operation.assert_awaited_once()
    assert collection.update_one.await_args.args[1]["$set"]["channels"] == ["inapp","push"]


@pytest.mark.asyncio
async def test_local_worker_never_calls_email_adapter(monkeypatch):
    monkeypatch.setattr(settings, "ENGINES_LOCAL_WORKER", True)
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    adapter = AsyncMock()
    monkeypatch.setitem(channels._ADAPTERS, "email", adapter)
    with pytest.raises(RuntimeError, match="external_channel_disabled"):
        await channels.send("email", {})
    adapter.assert_not_awaited()


@pytest.mark.asyncio
async def test_delivery_availability_matches_local_worker_channels(monkeypatch):
    from app.routes import engines
    monkeypatch.setattr(settings, "ENGINES_LOCAL_WORKER", True)
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "SMTP_HOST", "configured.example.com")
    monkeypatch.setattr(settings, "SMS_PROVIDER", "twilio")
    monkeypatch.setattr(settings, "WHATSAPP_PROVIDER", "configured")
    result = await engines.channels({})
    assert result["inapp"] and not any(result[c] for c in ("email", "sms", "whatsapp"))
