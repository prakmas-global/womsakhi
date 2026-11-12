"""Interval reminders stay on their local daily grid, including after downtime."""
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest
from pydantic import ValidationError

from app.engines import schedule
from app.engines.reminders import _floor
from app.routes.engines import ReminderIn


def slots(after, **changes):
    return schedule.materialise(schedule={"type": "recurring", "local_time": "08:00", "end_time": "09:00", "interval_minutes": 30, **changes},
        tz_name="Asia/Kolkata", after=after, horizon=after + timedelta(days=3), limit=8)


def test_half_hour_slots_and_next_day():
    at = datetime(2026, 10, 31, 2, 29, tzinfo=timezone.utc)  # 07:59 IST
    result = slots(at)
    assert [d.astimezone(ZoneInfo("Asia/Kolkata")).strftime("%d %H:%M") for d in result[:5]] == [
        "31 08:00", "31 08:30", "31 09:00", "01 08:00", "01 08:30"]
    assert slots(result[0])[0] == result[1]  # exclusive boundary, no duplicate


def test_selected_weekday_and_end_date():
    at = datetime(2026, 10, 30, tzinfo=timezone.utc)
    result = slots(at, days=[5])  # Saturday, matching Python weekday
    assert len(result) == 3 and all(d.astimezone(ZoneInfo("Asia/Kolkata")).weekday() == 5 for d in result)
    end = result[1]
    assert schedule.materialise(schedule={"type":"recurring", "local_time":"08:00", "end_time":"09:00", "interval_minutes":30},
        tz_name="Asia/Kolkata", after=at, horizon=end+timedelta(days=1), ends_at=end)[-1] == end


@pytest.mark.parametrize("change", [
    {"interval_minutes":1}, {"interval_minutes":-1}, {"interval_minutes":721},
    {"interval_minutes":True}, {"interval_minutes":"30"}, {"end_time":"bad"},
    {"end_time":"08:00"}, {"end_time":"07:00"}, {"interval_minutes":0},
    {"schedule_type":"once", "at":"2026-11-01T08:00:00Z"},
])
def test_invalid_interval_never_saves(change):
    with pytest.raises(ValidationError):
        ReminderIn.model_validate({"title_key":"rem.preset.water", "schedule_type":"recurring",
            "local_time":"08:00", "end_time":"21:00", "interval_minutes":30, **change})


@pytest.mark.parametrize("day", ["2026-03-29", "2026-10-25"])
def test_dst_has_sorted_unique_instants(day):
    at = datetime.fromisoformat(day).replace(tzinfo=timezone.utc)-timedelta(seconds=1)
    result = schedule.materialise(schedule={"type":"recurring", "local_time":"00:00", "end_time":"04:00", "interval_minutes":30},
        tz_name="Europe/London", after=at, horizon=at+timedelta(hours=7))
    assert result == sorted(set(result))
    assert all(d.astimezone(ZoneInfo("Europe/London")).hour <= 4 for d in result)


def test_timezone_change_preserves_each_interval_slot():
    pending = [datetime(2026,10,31,h,m,tzinfo=timezone.utc) for h,m in [(2,30),(3,0),(3,30)]]
    moved = schedule.rebuild_for_zone(schedule={"type":"recurring", "local_time":"08:00", "interval_minutes":30},
        old_tz="Asia/Kolkata", new_tz="Asia/Dubai", drift="keep_local", pending=pending)
    assert [d.astimezone(ZoneInfo("Asia/Dubai")).strftime("%H:%M") for d in moved] == ["08:00","08:30","09:00"]


def test_edit_of_old_series_starts_from_now():
    now = datetime.now(timezone.utc)
    assert _floor({"schedule":{"type":"recurring"}, "starts_at":now-timedelta(days=90)},None,now) >= now-timedelta(seconds=1)
