"""
Her cycle — the only health record this platform keeps about a woman's body.

── Why this exists, after the research said not to build it ────────────────
`components/ux/wellness/data.ts` records the case against a cycle tracker:
the market is saturated, India's DPDP Act forbids behavioural monitoring of
anyone under 18, and period data is the most enforcement-exposed category in
consumer software. The owner decided to build it anyway (2026-09-18), because
it is the everyday reason a woman opens a health app. See
`womsakhi/decisions/ADR-017`. What follows is how it is built so that those
risks are designed out rather than accepted:

* **Adults only, asked before anything is stored.** Setup requires her to say
  she is 18 or over. If she is not, no profile is created and nothing about
  her is written; the guides stay open to her.
* **Hers alone.** Every read and write is keyed on the user id from her token
  (ADR-007). There is no staff route, no admin view, no export to anyone but
  her, and no Sakhi tool that reads it.
* **Progressive, optional detail.** A one-tap period answer remains enough.
  Flow, pain, fertility signs, sleep, medicines and other sensitive fields are
  blank unless she deliberately adds them in the advanced log. The API never
  infers or fills a sensitive answer for her.
* **Gone when she says.** One request deletes every row, including the
  reminders already in her feed.
"""

from __future__ import annotations

from datetime import datetime, timezone

# What she can say about how she feels. Kept short on purpose: every extra
# option is a decision she has to make at 7am with cramps.
MOODS = ("happy", "calm", "tired", "irritable", "sad")
FEELINGS = ("energetic", "calm", "anxious", "irritable", "emotional", "low", "confident", "tired")
SYMPTOMS = (
    "cramps", "headache", "bloating", "back-pain", "acne", "mood-swings",
    "fatigue", "breast-tenderness", "food-cravings", "trouble-sleeping", "nausea", "none",
)
FLOWS = ("spotting", "light", "medium", "heavy")
SLEEP_QUALITY = ("poor", "fair", "good", "restful")
CERVICAL_MUCUS = ("dry", "sticky", "creamy", "watery", "egg-white")
OVULATION_TESTS = ("not-taken", "negative", "high", "peak", "positive")
PREGNANCY_TESTS = ("not-taken", "negative", "positive", "unclear")
INTIMACY = ("none", "protected", "unprotected")
TRACKING_GOALS = ("understand-cycle", "trying-to-conceive", "symptom-care", "perimenopause")
CONDITIONS = ("pcos", "endometriosis", "fibroids", "thyroid", "pmdd", "anaemia", "none")

DEFAULT_TZ = "Asia/Kolkata"

DEFAULT_REMINDERS = {
    # The master switch. Off means nothing from this module reaches her feed.
    "smart": True,
    "checkin": True,
    "checkin_time": "09:00",
    "upcoming": True,
    "ovulation": True,
    "pill": False,
    "pill_time": "21:00",
    "long_period": True,
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


class CycleProfileModel:
    collection_name = "cycle_profiles"

    @staticmethod
    def create_document(
        *,
        user_id: str,
        tz: str,
        typical_cycle: int,
        typical_period: int,
        declared_last_start: str | None,
    ) -> dict:
        now = _now()
        return {
            "user_id": user_id,
            # She told us she is 18 or over. Stored so the answer is on record
            # for the DPDP question "how did you know", not re-asked daily.
            "adult_confirmed_at": now,
            "tz": tz,
            "typical_cycle": int(typical_cycle),
            "typical_period": int(typical_period),
            # A setup answer, used until she logs a real period.
            "declared_last_start": declared_last_start,
            "tracking_goal": "understand-cycle",
            "conditions": [],
            "predictions": {"period": True, "fertility": True, "phase": True},
            "care_sharing": {"phase": False, "mood": False, "support_tips": False},
            "reminders": dict(DEFAULT_REMINDERS),
            # Hides the Home card and makes every reminder read neutrally — for
            # a phone that is shared, or seen over her shoulder.
            "discreet": False,
            "created_at": now,
            "updated_at": now,
        }


class CycleDayModel:
    collection_name = "cycle_days"

    @staticmethod
    def blank(user_id: str, on: str) -> dict:
        now = _now()
        return {
            "user_id": user_id,
            "date": on,              # her local date, YYYY-MM-DD
            "period": None,          # True / False / None = not answered
            "mood": None,
            "feelings": [],
            "symptoms": [],
            "symptom_severity": {},
            "flow": None,
            "pain": None,
            "energy": None,
            "sleep_hours": None,
            "sleep_quality": None,
            "basal_temp_c": None,
            "weight_kg": None,
            "water_glasses": None,
            "exercise_minutes": None,
            "cervical_mucus": None,
            "ovulation_test": None,
            "pregnancy_test": None,
            "intimacy": None,
            "medications_taken": [],
            "note": "",
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "date": doc.get("date", ""),
            "period": doc.get("period"),
            "mood": doc.get("mood"),
            "feelings": list(doc.get("feelings") or []),
            "symptoms": list(doc.get("symptoms") or []),
            "symptom_severity": dict(doc.get("symptom_severity") or {}),
            "flow": doc.get("flow"),
            "pain": doc.get("pain"),
            "energy": doc.get("energy"),
            "sleep_hours": doc.get("sleep_hours"),
            "sleep_quality": doc.get("sleep_quality"),
            "basal_temp_c": doc.get("basal_temp_c"),
            "weight_kg": doc.get("weight_kg"),
            "water_glasses": doc.get("water_glasses"),
            "exercise_minutes": doc.get("exercise_minutes"),
            "cervical_mucus": doc.get("cervical_mucus"),
            "ovulation_test": doc.get("ovulation_test"),
            "pregnancy_test": doc.get("pregnancy_test"),
            "intimacy": doc.get("intimacy"),
            "medications_taken": list(doc.get("medications_taken") or []),
            "note": doc.get("note") or "",
        }
