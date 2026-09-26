"""Pure regression checks for the private, progressive cycle tracker fields."""

from datetime import date

import pytest
from pydantic import ValidationError

from app.models.cycle import CycleDayModel, CycleProfileModel
from app.routes.cycle import _payload
from app.schemas.cycle import CycleDayUpdate, CycleMedicineCreate, CycleSettings


def test_new_cycle_profile_uses_private_conservative_defaults():
    profile = CycleProfileModel.create_document(
        user_id="member-1", tz="Asia/Kolkata", typical_cycle=28,
        typical_period=5, declared_last_start=None,
    )
    assert profile["tracking_goal"] == "understand-cycle"
    assert profile["conditions"] == []
    assert profile["predictions"] == {"period": True, "fertility": True, "phase": True}
    assert profile["care_sharing"] == {"phase": False, "mood": False, "support_tips": False}


def test_blank_day_contains_every_optional_advanced_field():
    day = CycleDayModel.blank("member-1", date(2026, 9, 26))
    for key in (
        "flow", "pain", "energy", "sleep_hours", "sleep_quality", "basal_temp_c",
        "weight_kg", "water_glasses", "exercise_minutes", "cervical_mucus",
        "ovulation_test", "pregnancy_test", "intimacy", "medications_taken",
    ):
        assert key in day


def test_advanced_daily_log_accepts_valid_health_observations():
    log = CycleDayUpdate(
        period=True, flow="medium", pain=4, energy=3, sleep_hours=7.5,
        sleep_quality="good", basal_temp_c=36.62, weight_kg=61.4,
        water_glasses=8, exercise_minutes=25, cervical_mucus="creamy",
        ovulation_test="negative", pregnancy_test="not-taken", intimacy="protected",
        symptom_severity={"cramps": 2}, medications_taken=["medicine-1"],
    )
    assert log.flow == "medium" and log.symptom_severity == {"cramps": 2}
    assert log.basal_temp_c == 36.62 and log.medications_taken == ["medicine-1"]


@pytest.mark.parametrize("field,value", [
    ("pain", 11), ("energy", 0), ("sleep_hours", 25), ("basal_temp_c", 43),
    ("weight_kg", 10), ("water_glasses", 41), ("exercise_minutes", 601),
])
def test_advanced_daily_log_rejects_unsafe_numeric_values(field, value):
    with pytest.raises(ValidationError):
        CycleDayUpdate(**{field: value})


def test_settings_validate_goals_conditions_and_sharing_preferences():
    settings = CycleSettings(
        tracking_goal="trying-to-conceive", conditions=["pcos", "thyroid"],
        period_predictions=True, fertility_predictions=True, phase_predictions=False,
        share_phase=True, share_mood=False, share_support_tips=True,
    )
    assert settings.conditions == ["pcos", "thyroid"]
    assert settings.share_support_tips is True


def test_medicine_requires_a_real_name_and_valid_times():
    assert CycleMedicineCreate(name="Iron", dose="10 mg", times=["09:00"]).name == "Iron"
    with pytest.raises(ValidationError):
        CycleMedicineCreate(name="   ")
    with pytest.raises(ValidationError):
        CycleMedicineCreate(name="Iron", times=["25:90"])


def test_disabled_predictions_are_removed_from_every_response_surface():
    profile = CycleProfileModel.create_document(
        user_id="member-1", tz="Asia/Kolkata", typical_cycle=28,
        typical_period=5, declared_last_start="2026-09-02",
    )
    profile["predictions"] = {"period": False, "fertility": False, "phase": False}
    result = _payload(profile, [], date(2026, 9, 26), "2026-09")
    assert result["status"]["next_start"] is None
    assert result["status"]["fertile_start"] is None
    assert result["status"]["ovulation"] is None
    assert result["status"]["phase"] is None
    assert all(not ({"predicted", "fertile", "ovulation"} & set(day["marks"]))
               for day in result["calendar"]["days"] + result["week"])
