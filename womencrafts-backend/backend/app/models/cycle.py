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
* **As little as possible.** One answer a day — was she on her period — plus
  how she felt, if she chooses to say. No flow volume, no sexual activity, no
  contraception, no pregnancy test result. Nothing that would matter more in
  the wrong hands than it helps her in hers.
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
            "note": doc.get("note") or "",
        }
