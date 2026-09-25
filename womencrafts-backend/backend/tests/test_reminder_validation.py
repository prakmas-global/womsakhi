"""Public reminder writes must produce schedulable, typed rules."""

import asyncio
from datetime import datetime
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.routes import engines


@pytest.mark.parametrize("overrides", [
    {"tz": "Mars/City"}, {"title_key": "   "},
    {"local_time": "25:00"}, {"local_time": "09:75"},
    {"local_time": "morning"}, {"days": [7]}, {"days": [-1]},
    {"days": [True]}, {"days": ["1"]},
    {"schedule_type": "once"}, {"schedule_type": "event_relative"},
    {"schedule_type": "daily"},
])
def test_invalid_reminder_is_rejected(overrides):
    with pytest.raises(ValidationError):
        engines.ReminderIn.model_validate({
            "title_key": "rem.preset.walk", "schedule_type": "recurring",
            "local_time": "09:00", **overrides,
        })


def test_end_cannot_precede_event():
    with pytest.raises(ValidationError):
        engines.ReminderIn(title_key="event", schedule_type="event_relative",
                           anchor_at="2027-01-02T10:00:00Z",
                           ends_at="2027-01-01T10:00:00Z")


def patch_setup(monkeypatch):
    collection = AsyncMock()
    collection.find_one.return_value = {
        "title_key": "rem.preset.walk", "payload": {}, "tz": "UTC",
        "category": "reminders", "ends_at": None,
        "schedule": {"type": "once", "at": datetime(2027, 1, 1)},
    }
    monkeypatch.setattr(engines, "get_database", lambda: {
        engines.ReminderModel.collection_name: collection})
    edit = AsyncMock(return_value=True)
    monkeypatch.setattr(engines.rem, "edit", edit)
    return edit


def test_patch_converts_json_date_and_preserves_schedule_type(monkeypatch):
    edit = patch_setup(monkeypatch)
    result = asyncio.run(engines.edit_reminder(
        "507f1f77bcf86cd799439011", {"schedule": {"at": "2027-02-01T10:00:00Z"}},
        {"_id": "member"}))
    assert result == {"updated": True}
    stored = edit.await_args.args[1]["schedule"]
    assert stored["type"] == "once"
    assert isinstance(stored["at"], datetime)
    assert stored["at"].tzinfo is not None


@pytest.mark.parametrize("changes", [
    {"schedule": "bad"}, {"schedule": {"at": "not-a-date"}},
    {"tz": "Unknown/Zone"}, {"schedule": {"type": "recurring", "local_time": "99:00"}},
])
def test_invalid_patch_never_writes(monkeypatch, changes):
    edit = patch_setup(monkeypatch)
    with pytest.raises(HTTPException) as error:
        asyncio.run(engines.edit_reminder("507f1f77bcf86cd799439011", changes, {"_id": "member"}))
    assert error.value.status_code == 422
    edit.assert_not_awaited()
