"""Request shapes for the cycle tracker. Responses are plain dicts — see routes/cycle.py."""

from __future__ import annotations

import re

from pydantic import BaseModel, Field, field_validator

from app.models.cycle import (
    CERVICAL_MUCUS,
    CONDITIONS,
    FEELINGS,
    FLOWS,
    INTIMACY,
    MOODS,
    OVULATION_TESTS,
    PREGNANCY_TESTS,
    SLEEP_QUALITY,
    SYMPTOMS,
    TRACKING_GOALS,
)

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
    symptom_severity: dict[str, int] | None = None
    flow: str | None = None
    pain: int | None = Field(None, ge=0, le=10)
    energy: int | None = Field(None, ge=1, le=5)
    sleep_hours: float | None = Field(None, ge=0, le=24)
    sleep_quality: str | None = None
    basal_temp_c: float | None = Field(None, ge=34, le=42)
    weight_kg: float | None = Field(None, ge=20, le=400)
    water_glasses: int | None = Field(None, ge=0, le=40)
    exercise_minutes: int | None = Field(None, ge=0, le=600)
    cervical_mucus: str | None = None
    ovulation_test: str | None = None
    pregnancy_test: str | None = None
    intimacy: str | None = None
    medications_taken: list[str] | None = Field(None, max_length=30)
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

    @field_validator("symptom_severity")
    @classmethod
    def _severity(cls, v: dict[str, int] | None) -> dict[str, int] | None:
        if v is None:
            return None
        bad = [k for k in v if k not in SYMPTOMS or k == "none"]
        if bad:
            raise ValueError(f"Unknown symptoms: {', '.join(bad)}")
        if any(not isinstance(n, int) or n < 1 or n > 3 for n in v.values()):
            raise ValueError("Symptom severity is 1, 2 or 3")
        return v

    @field_validator("flow")
    @classmethod
    def _flow(cls, v: str | None) -> str | None:
        if v is not None and v not in FLOWS:
            raise ValueError(f"One of: {', '.join(FLOWS)}")
        return v

    @field_validator("sleep_quality")
    @classmethod
    def _sleep_quality(cls, v: str | None) -> str | None:
        if v is not None and v not in SLEEP_QUALITY:
            raise ValueError(f"One of: {', '.join(SLEEP_QUALITY)}")
        return v

    @field_validator("cervical_mucus")
    @classmethod
    def _mucus(cls, v: str | None) -> str | None:
        if v is not None and v not in CERVICAL_MUCUS:
            raise ValueError(f"One of: {', '.join(CERVICAL_MUCUS)}")
        return v

    @field_validator("ovulation_test")
    @classmethod
    def _ovulation_test(cls, v: str | None) -> str | None:
        if v is not None and v not in OVULATION_TESTS:
            raise ValueError(f"One of: {', '.join(OVULATION_TESTS)}")
        return v

    @field_validator("pregnancy_test")
    @classmethod
    def _pregnancy_test(cls, v: str | None) -> str | None:
        if v is not None and v not in PREGNANCY_TESTS:
            raise ValueError(f"One of: {', '.join(PREGNANCY_TESTS)}")
        return v

    @field_validator("intimacy")
    @classmethod
    def _intimacy(cls, v: str | None) -> str | None:
        if v is not None and v not in INTIMACY:
            raise ValueError(f"One of: {', '.join(INTIMACY)}")
        return v

    @field_validator("medications_taken")
    @classmethod
    def _medications(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return None
        clean = [x.strip() for x in v if x.strip()]
        if any(len(x) > 120 for x in clean):
            raise ValueError("Medicine names must be 120 characters or fewer")
        return list(dict.fromkeys(clean))


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
    tracking_goal: str | None = None
    conditions: list[str] | None = Field(None, max_length=len(CONDITIONS))
    period_predictions: bool | None = None
    fertility_predictions: bool | None = None
    phase_predictions: bool | None = None
    share_phase: bool | None = None
    share_mood: bool | None = None
    share_support_tips: bool | None = None

    @field_validator("tracking_goal")
    @classmethod
    def _goal(cls, v: str | None) -> str | None:
        if v is not None and v not in TRACKING_GOALS:
            raise ValueError(f"One of: {', '.join(TRACKING_GOALS)}")
        return v

    @field_validator("conditions")
    @classmethod
    def _conditions(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return None
        bad = [x for x in v if x not in CONDITIONS]
        if bad:
            raise ValueError(f"Unknown: {', '.join(bad)}")
        v = list(dict.fromkeys(v))
        return [x for x in v if x != "none"] if len(v) > 1 else v


class CycleMedicineCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    dose: str = Field("", max_length=80)
    times: list[str] = Field(default_factory=list, max_length=6)
    instructions: str = Field("", max_length=240)

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError("Medicine name is required")
        return clean

    @field_validator("times")
    @classmethod
    def _times(cls, v: list[str]) -> list[str]:
        if any(not _TIME.match(x) for x in v):
            raise ValueError("Medicine times use HH:MM, 24-hour")
        return sorted(set(v))


class CycleMedicineUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=120)
    dose: str | None = Field(None, max_length=80)
    times: list[str] | None = Field(None, max_length=6)
    instructions: str | None = Field(None, max_length=240)
    active: bool | None = None

    @field_validator("name")
    @classmethod
    def _update_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        clean = v.strip()
        if not clean:
            raise ValueError("Medicine name is required")
        return clean

    @field_validator("times")
    @classmethod
    def _update_times(cls, v: list[str] | None) -> list[str] | None:
        if v is not None and any(not _TIME.match(x) for x in v):
            raise ValueError("Medicine times use HH:MM, 24-hour")
        return sorted(set(v)) if v is not None else None
