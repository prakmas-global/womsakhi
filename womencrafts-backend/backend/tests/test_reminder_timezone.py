"""
The reminder timezone must resolve in the production image, not just on a Mac.

Production runs python:3.11-slim, which may have no /usr/share/zoneinfo (or
only the canonical names, with the backward links split into tzdata-legacy).
There every ZoneInfo() failed, and POST /engines/reminders answered 422
"Choose a valid IANA timezone" for the "Asia/Calcutta" that Chrome on Windows
sends. A developer machine hides this because it has a system tz database, so
these tests hide it too.
"""

import os
import subprocess
import sys
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.routes import engines

BACKEND = Path(__file__).resolve().parents[1]


def run_without_system_tz(code: str) -> subprocess.CompletedProcess:
    """Run `code` in a fresh interpreter whose zoneinfo search path is empty,
    so only the `tzdata` wheel can answer."""
    env = {**os.environ, "PYTHONTZPATH": "", "PYTHONPATH": str(BACKEND)}
    return subprocess.run([sys.executable, "-c", code], cwd=BACKEND, env=env,
                          capture_output=True, text=True, timeout=120)


def test_system_tz_database_is_really_hidden():
    out = run_without_system_tz("import zoneinfo; print(repr(zoneinfo.TZPATH))")
    assert out.returncode == 0, out.stderr
    assert out.stdout.strip() == "()"


def test_tzdata_alone_resolves_reminder_zones():
    code = (
        "from app.routes.engines import ReminderIn, PrefsIn\n"
        "for tz in ('Asia/Kolkata', 'Asia/Calcutta', 'UTC', 'Europe/London'):\n"
        "    r = ReminderIn(title_key='t', schedule_type='recurring', local_time='09:00', tz=tz)\n"
        "    print(tz, '->', r.tz)\n"
        "print('prefs', PrefsIn(tz='Asia/Calcutta').tz)\n"
        "from app.engines.schedule import zone\n"
        "print('schedule', zone('Asia/Kolkata').key)\n"
        "from app.routes import appointments, cycle\n"
        "print('appointments', appointments.IST.key)\n"
    )
    out = run_without_system_tz(code)
    assert out.returncode == 0, out.stderr
    lines = out.stdout.splitlines()
    assert "Asia/Calcutta -> Asia/Kolkata" in lines
    assert "Asia/Kolkata -> Asia/Kolkata" in lines
    assert "prefs Asia/Kolkata" in lines
    # schedule.zone() swallows a failure and falls back to UTC; prove it did not.
    assert "schedule Asia/Kolkata" in lines
    assert "appointments Asia/Kolkata" in lines


@pytest.mark.parametrize("given, stored", [
    ("Asia/Calcutta", "Asia/Kolkata"),
    ("Asia/Kolkata", "Asia/Kolkata"),
    (" Asia/Kolkata ", "Asia/Kolkata"),
    ("Europe/Kiev", "Europe/Kyiv"),
    ("UTC", "UTC"),
])
def test_alias_is_stored_canonical(given, stored):
    rule = engines.ReminderIn(title_key="rem.preset.walk", schedule_type="recurring",
                              local_time="09:00", tz=given)
    assert rule.tz == stored


def test_prefs_alias_is_canonical_and_nonsense_rejected():
    assert engines.PrefsIn(tz="Asia/Calcutta").tz == "Asia/Kolkata"
    assert engines.PrefsIn().tz is None
    with pytest.raises(ValidationError):
        engines.PrefsIn(tz="Mars/City")


def test_unknown_zone_still_rejected():
    with pytest.raises(ValidationError, match="valid IANA timezone"):
        engines.ReminderIn(title_key="t", schedule_type="recurring",
                           local_time="09:00", tz="Mars/City")
