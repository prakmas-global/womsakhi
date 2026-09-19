"""Request shapes for the cycle tracker. Responses are plain dicts — see routes/cycle.py."""

from __future__ import annotations

import re

from pydantic import BaseModel, Field, field_validator

from app.models.cycle import FEELINGS, MOODS, SYMPTOMS

_TIME = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class CycleSetup(BaseModel):
    #: She says she is 18 or over. False means nothing is stored at all.
    adult: bool
    #: When her last period started, if she is not on one today. Optional:
    #: "not sure" is a real answer and the tracker still works without it.
    last_start: str | None = Field(None, description="YYYY-MM-DD")
    typical_cycle: int = Field(28, ge=15, le=60)
    typical_period: int = Field(5, ge=1, le=15)
    tz: str = Field("", max_length=64)

    @field_validator("last_start")
    @classmethod
    def _date(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        if not _DATE.match(v):
            raise ValueError("Use YYYY-MM-DD")
        return v


class CycleDayUpdate(BaseModel):
    """Only the fields sent are changed — a mood save must not clear her answer."""

    period: bool | None = None
    mood: str | None = None
    feelings: list[str] | None = Field(None, max_length=len(FEELINGS))
    symptoms: list[str] | None = Field(None, max_length=len(SYMPTOMS))
    note: str | None = Field(None, max_length=500)
    tz: str = Field("", max_length=64)

    @field_validator("mood")
    @classmethod
    def _mood(cls, v: str | None) -> str | None:
        if v is not None and v not in MOODS:
            raise ValueError(f"One of: {', '.join(MOODS)}")
        return v

    @field_validator("feelings")
    @classmethod
    def _feelings(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        bad = [f for f in v if f not in FEELINGS]
        if bad:
            raise ValueError(f"Unknown: {', '.join(bad)}")
        return list(dict.fromkeys(v))

    @field_validator("symptoms")
    @classmethod
    def _symptoms(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        bad = [s for s in v if s not in SYMPTOMS]
        if bad:
            raise ValueError(f"Unknown: {', '.join(bad)}")
        v = list(dict.fromkeys(v))
        # "None" means none. Sent alongside cramps it is a contradiction, and
        # the specific answer is the one to keep.
        return [s for s in v if s != "none"] if len(v) > 1 else v


class CycleReminders(BaseModel):
    smart: bool | None = None
    checkin: bool | None = None
    checkin_time: str | None = None
    upcoming: bool | None = None
    ovulation: bool | None = None
    pill: bool | None = None
    pill_time: str | None = None
    long_period: bool | None = None

    @field_validator("checkin_time", "pill_time")
    @classmethod
    def _time(cls, v: str | None) -> str | None:
        if v is not None and not _TIME.match(v):
            raise ValueError("Use HH:MM, 24-hour")
        return v


class CycleSettings(BaseModel):
    discreet: bool | None = None
    typical_cycle: int | None = Field(None, ge=15, le=60)
    typical_period: int | None = Field(None, ge=1, le=15)
