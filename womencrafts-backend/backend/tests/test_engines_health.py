"""Operator endpoint regressions without connecting to a database."""

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.routes import engines


@pytest.mark.parametrize("key", [None, "", "wrong", "different-unicode-\u00e9"])
def test_internal_key_rejects_invalid_values(monkeypatch, key):
    monkeypatch.setattr(engines.settings, "ENGINES_TICK_SECRET", "operator-secret")
    assert not engines._authorised(key)


def test_internal_key_requires_configured_secret(monkeypatch):
    monkeypatch.setattr(engines.settings, "ENGINES_TICK_SECRET", "")
    assert not engines._authorised("")
    monkeypatch.setattr(engines.settings, "ENGINES_TICK_SECRET", "operator-secret")
    assert engines._authorised("operator-secret")


@pytest.mark.parametrize("naive", [True, False])
def test_health_handles_mongo_timestamp_formats(monkeypatch, naive):
    due = datetime.now(timezone.utc) - timedelta(minutes=5)
    if naive:
        due = due.replace(tzinfo=None)
    collection = AsyncMock()
    collection.find_one.return_value = {"due_at": due}
    collection.count_documents.return_value = 1
    monkeypatch.setattr(engines, "get_database", lambda: {
        model.collection_name: collection for model in (
            engines.OccurrenceModel, engines.IntentModel, engines.DeliveryModel)
    })
    monkeypatch.setattr(engines.settings, "ENGINES_TICK_SECRET", "operator-secret")
    result = asyncio.run(engines.engines_health("operator-secret"))
    assert 300 <= result["lag_seconds"] < 305
    assert result["due_now"] == 1


def test_health_refuses_unauthenticated_access(monkeypatch):
    monkeypatch.setattr(engines.settings, "ENGINES_TICK_SECRET", "operator-secret")
    with pytest.raises(HTTPException) as error:
        asyncio.run(engines.engines_health(None))
    assert error.value.status_code == 401
