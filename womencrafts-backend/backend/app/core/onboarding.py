"""
Post-signup onboarding: what she told us, what she agreed to, and what we
prepared from it.

── The rules this module exists to keep ────────────────────────────────────
1. **She may answer while she waits.** Answers and consents are hers from the
   day she signs up. Nothing is made in any other module until she is admitted
   (`verification_status == "active"`), and then only by `prepare()`.
2. **Everything made for her is private.** A listing is a DRAFT nobody else
   can see, programmes, jobs and circles are SUGGESTIONS, a goal or a reminder
   is a PROPOSAL until she keeps it. The only thing she is put into is the
   official, read-only Welcome space.
3. **Consent is per purpose, never pre-set.** `setup` lets us use her answers
   to shape her own app. `job_updates` keeps a work profile and tells her about
   work, even before admission. `employer_visibility` lets employers search that
   work profile (name, skills, city — never her phone) and needs `job_updates`.
4. **It is not one-time.** She can change any answer at any time. `prepare()`
   is re-runnable: every prepared thing has a key naming the answer it came
   from (`listing:skill=tailoring`), and a key once prepared is never prepared
   again — and never deleted or modified because she changed her mind.

── Where it lives ──────────────────────────────────────────────────────────
`onboarding_profiles` — one document per user: `answers` (a sub-document, so
deleting them is one `$unset`), `consents` (current state per purpose),
`consent_history` (every grant and withdrawal), and the flow's bookkeeping.
A separate collection rather than fields on `users` because the user document
is loaded on every request by the auth dependency and cached; because the
admin insights aggregate over answers alone; and because retention deletes
answers on a schedule without touching the account.

`onboarding_setups` — one document per user: the prepared items and their
keys. Separate from the profile on purpose: deleting her answers must not make
the next `prepare()` forget what it already made, or it would make it twice.

`saved_searches` — her private saved job search, made by onboarding.
"""

from __future__ import annotations

import logging
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.core import cache
from app.core import skills as taxonomy
from app.core.config import settings
from app.db.mongodb import get_database

log = logging.getLogger("womsakhi.onboarding")

PROFILES = "onboarding_profiles"
SETUPS = "onboarding_setups"
SAVED_SEARCHES = "saved_searches"

#: The questionnaire's version. Bump when a question's meaning changes, so old
#: answers can be told apart from new ones.
QUESTIONS_VERSION = 1
#: The consent notice she was shown. A new wording is a new version, and a
#: grant under an old notice is still a grant under that notice — the record
#: says which.
NOTICE_VERSION = "onboarding-v1"

# ── the vocabulary ──────────────────────────────────────────────────────────

GOALS = ("learn", "earn_home", "find_job", "sell", "shop", "meet", "feel_good", "just_looking")
GOAL_LABELS = {
    "learn": "Learn", "earn_home": "Earn", "find_job": "Find work", "sell": "Sell",
    "shop": "Shop", "meet": "Meet", "feel_good": "Feel good", "just_looking": "Look around",
}
#: The learning categories the app already has (frontend
#: components/ux/learning/data.ts `CATEGORIES`), as keys.
LEARN_TOPICS = ("digital", "career", "money", "personal", "technology", "health")
#: Which programme categories each topic covers, as words. The catalogue's
#: categories are wider and wordier than the six the learning screen shows —
#: "Digital Literacy", "Personal Development", "Entrepreneurship" — so a
#: category belongs to a topic when one of its words is in the topic's list.
TOPIC_WORDS = {
    "digital": {"digital", "computer", "computers", "internet", "smartphone", "online", "whatsapp"},
    "career": {"career", "careers", "job", "jobs", "interview", "employability", "workplace"},
    "money": {"money", "finance", "financial", "business", "entrepreneurship", "savings", "banking"},
    "personal": {"personal", "confidence", "leadership", "communication", "life"},
    "technology": {"technology", "tech", "coding", "computer", "computers", "digital"},
    "health": {"health", "wellness", "wellbeing", "nutrition", "hygiene"},
}


def topic_of_category(category: str, topics: list[str]) -> Optional[str]:
    """The first of her topics this programme category belongs to, or None."""
    words = set(re.split(r"[^\w]+", (category or "").casefold()))
    return next((t for t in topics if words & TOPIC_WORDS.get(t, set())), None)


MEET = ("women_near_me", "same_skill", "new_mothers", "starting_business")
MEET_LABELS = {
    "women_near_me": "Women near me", "same_skill": "Same skill",
    "new_mothers": "New mothers", "starting_business": "Starting a business",
}
FREE_TIMES = ("morning", "afternoon", "evening", "weekends")
MINUTES = (10, 20, 30)
#: When a proposed reminder fires, per free time. Weekends = Saturday (0=Mon).
REMINDER_AT = {
    "morning": ("08:00", []),
    "afternoon": ("13:00", []),
    "evening": ("19:30", []),
    "weekends": ("10:00", [5]),
}

ANSWER_KEYS = (
    "goals", "skills", "learn_topics", "meet", "free_times", "minutes_per_day",
    "voice_prompts", "helper_mode", "shared_phone",
)

PURPOSES = ("setup", "job_updates", "employer_visibility")

MAX_SKILLS = 10
MAX_CUSTOM_LEN = 40

#: Days after which "is this still you?" is asked.
CHECKIN_DAYS = 90

#: Member segments derived from answers — the same five the admin form offers.
SEGMENT_JOB = "Job Seeker"
SEGMENT_ENTREPRENEUR = "Entrepreneur"
SEGMENT_STUDENT = "Student"
SEGMENT_ARTISAN = "Artisan"

#: Onboarding goal -> the /me/intake needs (app/core/matching.py NEEDS keys).
GOAL_NEEDS = {
    "earn_home": ("earn", "business"),
    "sell": ("earn", "business"),
    "learn": ("skill",),
    "find_job": ("earn",),
    "feel_good": ("confidence",),
}

# ── small helpers ───────────────────────────────────────────────────────────


def _db():
    return get_database()


def now() -> datetime:
    return datetime.now(timezone.utc)


def aware(value: Any) -> Optional[datetime]:
    if not isinstance(value, datetime):
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def iso(value: Any) -> Optional[str]:
    got = aware(value)
    return got.isoformat() if got else None


_indexed = False


async def ensure_indexes() -> None:
    """
    The two unique indexes the idempotency depends on, created on first use.

    Also declared in app/db/indexes.py for a deploy; created here as well so a
    process that never ran `ensure_indexes()` — a test, a script — still cannot
    grow two profiles or two setup records for one woman under a race.
    """
    global _indexed
    if _indexed:
        return
    db = _db()
    await db[PROFILES].create_index("user_id", unique=True, name="user_unique")
    await db[SETUPS].create_index("user_id", unique=True, name="user_unique")
    await db[SAVED_SEARCHES].create_index(
        [("user_id", 1), ("onboarding_key", 1)], name="user_onboarding_key")
    _indexed = True


# ── validation ──────────────────────────────────────────────────────────────

_LINKISH = re.compile(r"(https?:|www\.|://|@|\b[\w-]+\.(com|in|org|net|co|io|me|app|xyz)\b)", re.I)
#: Punctuation a skill name may carry between words: "Tie & dye", "Pre-school",
#: "Children's clothing", "Bags/pouches", "Cake, cookies".
_SKILL_JOINERS = set(" &-'’./,()+")


def clean_custom_skill(value: str) -> str:
    """
    A skill she typed herself, in the spirit of `auth.clean_person_name`:
    letters in any script (with the marks Indic scripts need), a few joiners,
    digits only beside letters ("3D printing"), and no links or symbols.
    """
    text = " ".join((value or "").split())
    if len(text) < 2:
        raise ValueError("Type a skill of at least 2 letters")
    if len(text) > MAX_CUSTOM_LEN:
        raise ValueError(f"Keep a skill under {MAX_CUSTOM_LEN} characters")
    if _LINKISH.search(text):
        raise ValueError("A skill cannot be a link or an address")
    letters = 0
    for ch in text:
        cat = unicodedata.category(ch)
        if cat[0] in "LM":
            letters += cat[0] == "L"
        elif cat[0] == "N" or ch in _SKILL_JOINERS:
            continue
        else:
            raise ValueError("Use letters only — no symbols")
    if letters < 2:
        raise ValueError("A skill needs words, not only numbers")
    if not unicodedata.category(text[0]).startswith(("L", "N")):
        raise ValueError("Start the skill with a letter")
    return text


def clean_skills(raw: list[Any]) -> list[Any]:
    """
    Keys from the taxonomy and `{"custom": text}` entries, de-duplicated, at
    most `MAX_SKILLS` in all. A custom entry whose text IS a taxonomy label is
    stored as that key, so "tailoring" typed by hand counts with the rest.
    """
    out: list[Any] = []
    seen: set[str] = set()
    for item in raw:
        if isinstance(item, str):
            if item not in taxonomy.SKILLS_BY_KEY:
                raise ValueError(f"Unknown skill: {item[:40]}")
            key, value = item, item
        elif isinstance(item, dict) and set(item) == {"custom"} and isinstance(item["custom"], str):
            text = clean_custom_skill(item["custom"])
            match = taxonomy.by_label(text)
            if match:
                key, value = match["key"], match["key"]
            else:
                key, value = "custom:" + text.casefold(), {"custom": text}
        else:
            raise ValueError('Each skill is a key or {"custom": "text"}')
        if key in seen:
            continue
        seen.add(key)
        out.append(value)
    if len(out) > MAX_SKILLS:
        raise ValueError(f"Choose at most {MAX_SKILLS} skills")
    return out


def _choices(raw: list[Any], allowed: tuple, what: str) -> list:
    out = []
    for v in raw:
        if v not in allowed:
            raise ValueError(f"Unknown {what}: {str(v)[:40]}")
        if v not in out:
            out.append(v)
    return out


def validate_answers(values: dict) -> dict:
    """
    One partial update, validated. A key present with `None` is a question she
    skipped, and is stored as null — never defaulted to anything.
    """
    clean: dict = {}
    for key, value in values.items():
        if key not in ANSWER_KEYS:
            raise ValueError(f"Unknown question: {key}")
        if value is None:
            clean[key] = None
            continue
        if key in ("goals", "learn_topics", "meet", "free_times", "skills"):
            if not isinstance(value, list):
                raise ValueError(f"{key} must be a list")
            if key == "goals":
                clean[key] = _choices(value, GOALS, "goal")
            elif key == "learn_topics":
                clean[key] = _choices(value, LEARN_TOPICS, "learning topic")
            elif key == "meet":
                clean[key] = _choices(value, MEET, "choice")
            elif key == "free_times":
                clean[key] = _choices(value, FREE_TIMES, "time")
            else:
                clean[key] = clean_skills(value)
        elif key == "minutes_per_day":
            if isinstance(value, bool) or value not in MINUTES:
                raise ValueError("minutes_per_day is 10, 20 or 30")
            clean[key] = int(value)
        else:
            if not isinstance(value, bool):
                raise ValueError(f"{key} is true or false")
            clean[key] = value
    return clean


# ── reading her profile ─────────────────────────────────────────────────────


async def profile_of(uid: str) -> Optional[dict]:
    return await _db()[PROFILES].find_one({"user_id": uid})


async def setup_of(uid: str) -> Optional[dict]:
    return await _db()[SETUPS].find_one({"user_id": uid})


def answers_of(profile: Optional[dict]) -> dict:
    return dict((profile or {}).get("answers") or {})


def has_answers(profile: Optional[dict]) -> bool:
    return any(v not in (None, [], "") for v in answers_of(profile).values())


def consent_granted(profile: Optional[dict], purpose: str) -> bool:
    return bool((((profile or {}).get("consents") or {}).get(purpose) or {}).get("granted"))


def skill_entries(answers: dict) -> list[dict]:
    """Her skills as `{key, label, group, service_category, custom}`."""
    out = []
    for item in answers.get("skills") or []:
        if isinstance(item, str) and item in taxonomy.SKILLS_BY_KEY:
            s = taxonomy.SKILLS_BY_KEY[item]
            out.append({"key": s["key"], "label": s["label"], "group": s["group"],
                        "service_category": s["service_category"], "custom": False})
        elif isinstance(item, dict) and item.get("custom"):
            text = item["custom"]
            out.append({"key": "custom:" + text.casefold(), "label": text, "group": "",
                        "service_category": "Other", "custom": True})
    return out


def is_waiting(user: dict) -> bool:
    from app.models.verification import VerificationStatus

    return (user.get("verification_status") or "") in VerificationStatus.WAITING


def is_active(user: dict) -> bool:
    from app.models.verification import VerificationStatus

    return (user.get("verification_status") or VerificationStatus.ACTIVE) == VerificationStatus.ACTIVE


def offered(profile: Optional[dict], user: dict) -> bool:
    """
    Whether the app should open the flow by itself.

    Never once it is completed. A skip made while she was still waiting earns
    one more offer after she is admitted — the questions read differently once
    the app is open to her — and a second skip, or a skip made after
    admission, is final. She can always open it herself from Settings.
    """
    p = profile or {}
    if p.get("completed"):
        return False
    skips = int(p.get("skip_count") or 0)
    if skips == 0:
        return True
    return skips == 1 and p.get("skipped_while") == "waiting" and is_active(user)


def partly_answered(answers: dict) -> bool:
    """A question she was asked and has no answer to — skipped or not reached."""
    goals = answers.get("goals") or []
    asked = ["goals", "free_times", "minutes_per_day"]
    if set(goals) & {"earn_home", "sell", "find_job"}:
        asked.append("skills")
    if "learn" in goals:
        asked.append("learn_topics")
    if "meet" in goals:
        asked.append("meet")
    return any(answers.get(k) in (None, []) for k in asked)


def checkin_due(profile: Optional[dict], user: dict, at: Optional[datetime] = None) -> bool:
    """
    True once `CHECKIN_DAYS` have passed since she last changed or confirmed
    her answers, and only for an admitted member who has answers to confirm.
    """
    if not profile or not has_answers(profile) or not is_active(user):
        return False
    stamps = [aware(profile.get(k)) for k in ("updated_at", "last_reviewed_at", "answered_at")]
    latest = max((s for s in stamps if s), default=None)
    if not latest:
        return False
    return (at or now()) - latest >= timedelta(days=CHECKIN_DAYS)


def make_it_yours(profile: Optional[dict]) -> bool:
    """The home card inviting her back: skipped or partly answered, not dismissed."""
    p = profile or {}
    if not p or p.get("card_dismissed_at"):
        return False
    return bool(p.get("skipped_at")) or partly_answered(answers_of(p))


def reason(goal: str, detail: str = "") -> str:
    label = GOAL_LABELS.get(goal, goal)
    return f"Because you chose {label}" + (f" · {detail}" if detail else "")


# ── consents ────────────────────────────────────────────────────────────────


def consent_view(profile: Optional[dict]) -> dict:
    """Each purpose's current state. `granted` is None until she has answered."""
    stored = (profile or {}).get("consents") or {}
    out = {}
    for purpose in PURPOSES:
        c = stored.get(purpose) or {}
        out[purpose] = {
            "granted": c.get("granted") if "granted" in c else None,
            "at": iso(c.get("at")),
            "notice_version": c.get("notice_version"),
            "language": c.get("language"),
        }
    return out


def plan_consent_change(profile: Optional[dict], asked: dict[str, bool]) -> dict[str, bool]:
    """
    The changes to write, with the two rules applied:

    - `employer_visibility` can only be granted while `job_updates` is (asked
      for together, or already held). Refused, not silently dropped.
    - Withdrawing `job_updates` withdraws `employer_visibility` with it — a
      search over a work profile that no longer exists is not a thing.
    """
    changes = {k: bool(v) for k, v in asked.items() if v is not None}
    job = changes.get("job_updates", consent_granted(profile, "job_updates"))
    if changes.get("employer_visibility") and not job:
        raise ValueError("Employers can only see your work profile if you keep it — "
                         "turn on job updates first.")
    if changes.get("job_updates") is False and consent_granted(profile, "employer_visibility"):
        changes["employer_visibility"] = False
    return changes


async def write_consents(uid: str, member_id: str, changes: dict[str, bool], language: str,
                         notice_version: str = NOTICE_VERSION) -> dict:
    at = now()
    await ensure_profile(uid, member_id)
    sets: dict = {"updated_consents_at": at}
    history = []
    for purpose, granted in changes.items():
        record = {"granted": granted, "at": at, "notice_version": notice_version,
                  "language": language}
        sets[f"consents.{purpose}"] = record
        history.append({"purpose": purpose, **record})
    return await _db()[PROFILES].find_one_and_update(
        {"user_id": uid},
        {"$set": sets, "$push": {"consent_history": {"$each": history, "$slice": -200}}},
        return_document=ReturnDocument.AFTER,
    )


async def ensure_profile(uid: str, member_id: str = "") -> None:
    await ensure_indexes()
    try:
        await _db()[PROFILES].update_one(
            {"user_id": uid},
            {"$setOnInsert": {
                "user_id": uid, "member_id": member_id, "answers": {},
                "consents": {}, "consent_history": [], "version": QUESTIONS_VERSION,
                "completed": False, "skip_count": 0, "revision": 0, "created_at": now(),
            }},
            upsert=True,
        )
    except DuplicateKeyError:
        pass  # a concurrent request created it — which is what we wanted


# ── what follows from her answers: segment and needs ────────────────────────


def segment_for(answers: dict) -> Optional[str]:
    """
    Her member segment from her answers, or None to leave it alone.

    Order: looking for a job says the most about what she needs from us, then
    handicraft skills (an artisan selling her work), then earning or selling,
    then learning when learning is all she chose.
    """
    goals = set(answers.get("goals") or [])
    groups = {s["group"] for s in skill_entries(answers)}
    if "find_job" in goals:
        return SEGMENT_JOB
    if groups & taxonomy.ARTISAN_GROUPS:
        return SEGMENT_ARTISAN
    if goals & {"earn_home", "sell"}:
        return SEGMENT_ENTREPRENEUR
    if goals and goals <= {"learn", "just_looking"} and "learn" in goals:
        return SEGMENT_STUDENT
    return None


def needs_for(answers: dict) -> list[str]:
    out: list[str] = []
    for goal in answers.get("goals") or []:
        for need in GOAL_NEEDS.get(goal, ()):
            if need not in out:
                out.append(need)
    return out


async def apply_derived(user: dict, profile: Optional[dict]) -> None:
    """
    Fill the member segment and Sakhi's intake needs from her answers.

    Only for an admitted member who granted `setup` — these are uses of her
    answers, and that consent is the one that covers them. A segment staff
    chose (`segment_source == "staff"`) is never overwritten.
    """
    if not is_active(user) or not consent_granted(profile, "setup"):
        return
    answers = answers_of(profile)
    db = _db()
    segment = segment_for(answers)
    if segment and user.get("member_id"):
        try:
            await db["members"].update_one(
                {"_id": ObjectId(user["member_id"]), "segment_source": {"$ne": "staff"}},
                {"$set": {"segment": segment, "segment_source": "onboarding",
                          "updated_at": now()}},
            )
        except Exception:  # noqa: BLE001 - a malformed member id must not fail her save
            log.warning("onboarding: could not set segment for %s", user.get("_id"))

    needs = needs_for(answers)
    ctx = user.get("ai_context") or {}
    before = [n for n in (ctx.get("needs") or []) if n not in (ctx.get("onboarding_needs") or [])]
    merged = before + [n for n in needs if n not in before]
    await db["users"].update_one(
        {"_id": user["_id"]},
        {"$set": {"ai_context.needs": merged, "ai_context.onboarding_needs": needs,
                  "ai_context.updated_at": now()}},
    )
    cache.forget_user(str(user["_id"]))


async def undo_derived(user: dict) -> None:
    """Take back the needs her answers added. The segment stays: see DELETE."""
    ctx = user.get("ai_context") or {}
    mine = ctx.get("onboarding_needs") or []
    if not mine and "onboarding_needs" not in ctx:
        return
    kept = [n for n in (ctx.get("needs") or []) if n not in mine]
    await _db()["users"].update_one(
        {"_id": user["_id"]},
        {"$set": {"ai_context.needs": kept}, "$unset": {"ai_context.onboarding_needs": ""}},
    )
    if user.get("member_id"):
        try:
            await _db()["members"].update_one(
                {"_id": ObjectId(user["member_id"]), "segment_source": "onboarding"},
                {"$set": {"segment_source": ""}},
            )
        except Exception:  # noqa: BLE001
            pass
    cache.forget_user(str(user["_id"]))


# ── the work profile ────────────────────────────────────────────────────────


def _wants(answers: dict) -> list[str]:
    goals = answers.get("goals") or []
    labels = [s["label"] for s in skill_entries(answers)]
    out = []
    for skill in labels or [""]:
        if "find_job" in goals:
            out.append(f"A job in {skill.lower()}" if skill else "A job")
        if "earn_home" in goals:
            out.append(f"{skill} work from home" if skill else "Work from home")
        if "sell" in goals and skill:
            out.append(f"{skill} orders")
    return list(dict.fromkeys(out))


async def work_profile(user: dict, profile: Optional[dict]) -> Optional[dict]:
    """
    The view employers and job updates work from. It exists only while she
    holds `job_updates`; withdraw it and this is None.
    """
    if not consent_granted(profile, "job_updates"):
        return None
    answers = answers_of(profile)
    city = ""
    if user.get("member_id"):
        try:
            member = await _db()["members"].find_one(
                {"_id": ObjectId(user["member_id"])}, {"display_location": 1, "location": 1})
        except Exception:  # noqa: BLE001
            member = None
        city = ((member or {}).get("display_location") or (member or {}).get("location") or "").strip()
    return {
        "name": user.get("full_name", ""),
        "mobile": user.get("phone", ""),
        "email": user.get("email", ""),
        "city": city,
        "languages": [user.get("locale") or "en"],
        "skills": [s["label"] for s in skill_entries(answers)],
        "wants": _wants(answers),
        "free_times": answers.get("free_times") or [],
        "verified": is_active(user),
        "visible_to_employers": consent_granted(profile, "employer_visibility"),
        #: What an employer's search would show — the phone is never in it.
        "employers_see": ["name", "skills", "city"] if consent_granted(profile, "employer_visibility") else [],
    }


# ── preparing her app ───────────────────────────────────────────────────────

#: What a circle's members see about her. Said on every suggestion so she
#: decides with it in front of her.
CIRCLE_SHOWS = "Members will see your first name and photo; your phone stays hidden."

MEET_WORDS = {
    "new_mothers": ("mother", "mom", "mum", "baby", "parent", "maa"),
    "starting_business": ("business", "entrepreneur", "startup", "seller", "sell", "shop", "udyam"),
}


def _words(text: str) -> set[str]:
    return {w for w in re.split(r"[^\w]+", (text or "").casefold()) if len(w) > 2}


async def _city_of(user: dict) -> str:
    if not user.get("member_id"):
        return ""
    try:
        member = await _db()["members"].find_one(
            {"_id": ObjectId(user["member_id"])}, {"display_location": 1, "location": 1})
    except Exception:  # noqa: BLE001
        return ""
    return ((member or {}).get("display_location") or (member or {}).get("location") or "").strip()


def _item(key: str, type_: str, title: str, state: str, visibility: str, why: str,
          source: str, id_: str = "", **extra) -> dict:
    return {"key": key, "type": type_, "id": id_ or key.split("=", 1)[-1].split(":", 1)[-1],
            "title": title, "state": state, "visibility": visibility, "reason": why,
            "source": source, "created_at": now(), **extra}


def _goal_proposals(answers: dict) -> list[dict]:
    """One proposed goal per thing she chose. Nothing is created until she keeps it."""
    goals = answers.get("goals") or []
    skills = skill_entries(answers)
    first = skills[0]["label"] if skills else ""
    by = (now() + timedelta(days=90)).date().isoformat()
    soon = (now() + timedelta(days=30)).date().isoformat()
    out = []
    if "earn_home" in goals or "sell" in goals:
        g = "earn_home" if "earn_home" in goals else "sell"
        out.append(("earn", g, first, {
            "label": f"Earn my first ₹1,000 from {first.lower()}" if first else "Earn my first ₹1,000",
            "kind": "money", "target": 100_000, "by": by, "unit": "₹"}))
    if "find_job" in goals:
        out.append(("find_job", "find_job", first, {
            "label": "Apply to 3 jobs that fit me", "kind": "count", "target": 3, "by": soon, "unit": "jobs"}))
    if "learn" in goals:
        out.append(("learn", "learn", "", {
            "label": "Finish my first course", "kind": "skill", "target": 1, "by": by, "unit": "courses"}))
    if "meet" in goals:
        out.append(("meet", "meet", "", {
            "label": "Say hello in 2 circles", "kind": "count", "target": 2, "by": soon, "unit": "circles"}))
    if "shop" in goals:
        out.append(("shop", "shop", "", {
            "label": "Save 3 things I would like to buy", "kind": "count", "target": 3, "by": soon, "unit": "items"}))
    if "feel_good" in goals:
        out.append(("feel_good", "feel_good", "", {
            "label": "Take 10 minutes for myself, 3 times a week", "kind": "count", "target": 3,
            "by": soon, "unit": "times"}))
    if "just_looking" in goals and not out:
        out.append(("just_looking", "just_looking", "", {
            "label": "Look around 3 parts of WomSakhi", "kind": "count", "target": 3, "by": soon, "unit": "parts"}))
    return out


async def _suggest_programmes(topics: list[str], limit: int = 3) -> list[tuple[dict, str]]:
    from app.models.program import ProgramModel
    from app.routes.catalog import OPEN_PROGRAM_STATUSES

    if not topics:
        return []
    docs = await _db()[ProgramModel.collection_name].find(
        {"status": {"$in": OPEN_PROGRAM_STATUSES}},
        {"name": 1, "category": 1, "enrolled": 1, "created_at": 1},
    ).sort("created_at", -1).to_list(500)
    matched = [(d, topic_of_category(d.get("category", ""), topics)) for d in docs]
    matched = [(d, t) for d, t in matched if t]
    picked: list[tuple[dict, str]] = []
    # One per topic first, in her order — her order is her priority — then
    # fill any slots left from the same topics.
    for topic in topics:
        hit = next(((d, t) for d, t in matched if t == topic), None)
        if hit and len(picked) < limit:
            picked.append(hit)
    for d, t in matched:
        if len(picked) >= limit:
            break
        if all(p[0]["_id"] != d["_id"] for p in picked):
            picked.append((d, t))
    return picked


def _job_terms(answers: dict) -> set[str]:
    terms: set[str] = set()
    for s in skill_entries(answers):
        terms |= _words(s["label"])
    return terms - {"and", "the", "work", "other", "for", "from", "running", "making", "selling"}


async def matching_jobs(skills_words: set[str], city: str = "", limit: int = 3,
                        since: Optional[datetime] = None, exclude: set[str] | None = None) -> list[dict]:
    """Open opportunities whose skills, title or description share a word with hers."""
    from app.models.growth import OpportunityModel

    query: dict = {"status": "open"}
    if since:
        query["created_at"] = {"$gt": since}
    docs = await _db()[OpportunityModel.collection_name].find(
        query, {"title": 1, "org": 1, "skills": 1, "desc": 1, "location": 1, "mode": 1, "created_at": 1},
    ).sort("created_at", -1).to_list(300)
    scored = []
    for d in docs:
        if exclude and str(d["_id"]) in exclude:
            continue
        text = " ".join([d.get("title", ""), " ".join(map(str, d.get("skills") or [])), d.get("desc", "")])
        hits = len(skills_words & _words(text)) if skills_words else 0
        if skills_words and not hits:
            continue
        near = bool(city) and city.casefold() in (d.get("location") or "").casefold()
        scored.append((hits, near, d))
    scored.sort(key=lambda t: (t[0], t[1]), reverse=True)
    return [t[2] for t in scored[:limit]]


async def _suggest_circles(user: dict, answers: dict, exclude: set[str], limit: int = 3) -> list[tuple[dict, str]]:
    from app.models.community import CircleModel

    meet = answers.get("meet") or []
    city = await _city_of(user) if "women_near_me" in meet else ""
    skill_words = _job_terms(answers) if "same_skill" in meet else set()
    docs = await _db()[CircleModel.collection_name].find(
        {"status": "active", "is_private": {"$ne": True}, "official_welcome": {"$ne": True},
         "is_savings": {"$ne": True}},
        {"name": 1, "topic": 1, "tags": 1, "member_count": 1},
    ).sort("member_count", -1).to_list(300)
    scored = []
    for d in docs:
        if str(d["_id"]) in exclude:
            continue
        words = _words(" ".join([d.get("name", ""), d.get("topic", ""), " ".join(d.get("tags") or [])]))
        why, score = "", 0
        if city and _words(city) & words:
            score, why = score + 3, f"Near you · {city}"
        if skill_words and skill_words & words:
            score, why = score + 2, why or "Same skill"
        for choice, vocab in MEET_WORDS.items():
            if choice in meet and set(vocab) & words:
                score, why = score + 1, why or MEET_LABELS[choice]
        scored.append((score, int(d.get("member_count") or 0), d, why))
    scored.sort(key=lambda t: (t[0], t[1]), reverse=True)
    return [(t[2], t[3] or "Popular with women here") for t in scored[:limit]]


async def welcome_circle(create_if_missing: bool) -> Optional[dict]:
    """
    The official, read-only Welcome space — the only circle anyone is put in.

    Found by `official_welcome: true`. When there is none and this is not
    production, one is made (`seeded_by: "onboarding-dev-seed"`), so the flow
    can be exercised end to end on a fresh development database. Production
    never seeds it: staff create it from the admin circles screen and set the
    flag, and until they do nobody is joined to anything.
    """
    from app.models.community import CircleModel

    col = _db()[CircleModel.collection_name]
    doc = await col.find_one({"official_welcome": True, "status": "active"}, sort=[("created_at", 1)])
    if doc or not create_if_missing or settings.is_production:
        return doc
    seed = CircleModel.create_document(
        name="Welcome to WomSakhi", topic="Welcome",
        desc="News and tips from the WomSakhi team. Only the team posts here.",
        created_by="system", who_posts="hosts", tags=["welcome", "official"],
    )
    seed.update({"official_welcome": True, "read_only": True, "seeded_by": "onboarding-dev-seed"})
    res = await col.insert_one(seed)
    seed["_id"] = res.inserted_id
    log.info("onboarding: seeded a development Welcome circle %s", res.inserted_id)
    return seed


async def _join_welcome(uid: str, circle: dict) -> None:
    from app.models.community import CircleMemberModel, CircleModel

    cid = str(circle["_id"])
    res = await _db()[CircleMemberModel.collection_name].update_one(
        {"user_id": uid, "circle_id": cid},
        {"$setOnInsert": CircleMemberModel.create_document(uid, cid)},
        upsert=True,
    )
    if res.upserted_id is not None:
        await _db()[CircleModel.collection_name].update_one(
            {"_id": circle["_id"]}, {"$inc": {"member_count": 1}})


async def _draft_listing(user: dict, skill: dict, key: str, city: str) -> dict:
    """Her draft, made at most once per key even across a crash mid-setup."""
    from app.models.shop import ListingModel

    uid = str(user["_id"])
    col = _db()[ListingModel.collection_name]
    existing = await col.find_one({"user_id": uid, "onboarding_key": key})
    if existing:
        return existing
    doc = ListingModel.create_document(
        user_id=uid, member_id=user.get("member_id", ""), kind=ListingModel.KIND_SERVICE,
        title=skill["label"], category=skill["service_category"], place=city,
        status=ListingModel.STATUS_DRAFT, delivery="service", price_mode="quote",
    )
    doc["onboarding_key"] = key
    res = await col.insert_one(doc)
    doc["_id"] = res.inserted_id
    return doc


async def _saved_search(uid: str, words: list[str], city: str) -> tuple[dict, bool]:
    """
    Her private saved job search. One per woman from onboarding; later runs
    only ADD skills she has added — never remove any, because removing a goal
    or a skill must not quietly change something she already has.
    """
    col = _db()[SAVED_SEARCHES]
    key = "saved_search:jobs"
    existing = await col.find_one({"user_id": uid, "onboarding_key": key})
    if existing:
        missing = [w for w in words if w not in (existing.get("skills") or [])]
        if missing:
            await col.update_one({"_id": existing["_id"]},
                                 {"$push": {"skills": {"$each": missing}}, "$set": {"updated_at": now()}})
        return existing, False
    doc = {"user_id": uid, "type": "jobs", "skills": words, "city": city,
           "created_by": "onboarding", "onboarding_key": key, "private": True,
           "created_at": now(), "updated_at": now()}
    res = await col.insert_one(doc)
    doc["_id"] = res.inserted_id
    return doc, True


def _desired(user: dict, answers: dict) -> list[tuple[str, str, str]]:
    """
    The (key, goal, detail) of everything her CURRENT answers call for. Keys
    name the answer they came from, so the same answers always give the same
    keys — which is what makes a second run a no-op.
    """
    goals = answers.get("goals") or []
    skills = skill_entries(answers)
    want: list[tuple[str, str, str]] = []
    if skills and ("earn_home" in goals or "sell" in goals):
        goal = "earn_home" if "earn_home" in goals else "sell"
        want.append((f"listing:skill={skills[0]['key']}", goal, skills[0]["label"]))
    if "find_job" in goals or "earn_home" in goals:
        want.append(("saved_search:jobs", "find_job" if "find_job" in goals else "earn_home", ""))
    for gkey, goal, detail, _ in _goal_proposals(answers):
        want.append((f"goal:{gkey}", goal, detail))
    free = answers.get("free_times") or []
    if free:
        want.append((f"reminder:{free[0]}", "", free[0]))
    return want


def still_chosen(item: dict, answers: dict) -> bool:
    """Whether the answer an item came from is still one of her answers."""
    current = {k for k, _, _ in _desired({}, answers)}
    key = item.get("key", "")
    if key in current or key == "welcome":
        return True
    goals = answers.get("goals") or []
    src = item.get("source", "")
    return bool(src) and src in goals


async def prepare(user: dict) -> tuple[list[dict], int]:
    """
    Prepare what her current answers call for and has not been prepared yet.

    Returns (all items, how many were new this run). Re-runnable by design:
    a key already in her setup record is skipped whatever state it is in — a
    listing she removed is not made again, a goal she kept is not proposed
    again. Nothing here ever deletes or edits an item because an answer went
    away; the item stays, and `still_chosen` tells the screen.
    """
    await ensure_indexes()
    uid = str(user["_id"])
    col = _db()[SETUPS]
    try:
        await col.update_one(
            {"user_id": uid},
            {"$setOnInsert": {"user_id": uid, "items": [], "runs": 0, "created_at": now()}},
            upsert=True,
        )
    except DuplicateKeyError:
        pass

    # A short lease, so two taps on a slow connection cannot both prepare.
    at = now()
    record = await col.find_one_and_update(
        {"user_id": uid, "$or": [{"lock_until": {"$exists": False}}, {"lock_until": {"$lte": at}}]},
        {"$set": {"lock_until": at + timedelta(seconds=60)}},
        return_document=ReturnDocument.AFTER,
    )
    if record is None:
        raise RuntimeError("busy")

    try:
        profile = await profile_of(uid)
        answers = answers_of(profile)
        done = {i["key"] for i in record.get("items") or []}
        new: list[dict] = []
        goals = answers.get("goals") or []
        skills = skill_entries(answers)
        city = await _city_of(user)

        for key, goal, detail in _desired(user, answers):
            if key in done:
                continue
            if key.startswith("listing:"):
                skill = skills[0]
                doc = await _draft_listing(user, skill, key, city)
                new.append(_item(key, "listing", doc.get("title", skill["label"]), "draft", "only_you",
                                 reason(goal, skill["label"]), goal, str(doc["_id"])))
            elif key == "saved_search:jobs":
                words = sorted(_job_terms(answers))
                doc, _ = await _saved_search(uid, words, city)
                what = ", ".join(s["label"] for s in skills[:3]) or "work near you"
                new.append(_item(key, "saved_search", f"New jobs for {what}", "saved", "only_you",
                                 reason(goal, skills[0]["label"] if skills else ""), goal, str(doc["_id"])))
            elif key.startswith("goal:"):
                gkey = key.split(":", 1)[1]
                spec = next(p for p in _goal_proposals(answers) if p[0] == gkey)
                new.append(_item(key, "goal", spec[3]["label"], "proposed", "only_you",
                                 reason(spec[1], spec[2]), spec[1], gkey, proposal=spec[3]))
            elif key.startswith("reminder:"):
                slot = key.split(":", 1)[1]
                local, days = REMINDER_AT[slot]
                minutes = answers.get("minutes_per_day") or 10
                when = "Saturdays" if slot == "weekends" else f"every {slot}"
                new.append(_item(key, "reminder", f"{minutes} minutes for you, {when} at {local}",
                                 "proposed", "only_you", f"Because you said you are free in the {slot}"
                                 if slot != "weekends" else "Because you said you are free at weekends",
                                 "", slot, proposal={"local_time": local, "days": days, "minutes": minutes}))

        # Suggestions: keyed by what they point at, so the same programme,
        # job or circle is never suggested twice.
        items = record.get("items") or []
        if "learn" in goals:
            # Three on the first run; after that, one for each topic she adds.
            # Driven by her answers, not by the catalogue growing, so a run
            # with the same answers suggests nothing new.
            covered = {i.get("topic") for i in items if i.get("type") == "programme"}
            topics = [t for t in (answers.get("learn_topics") or []) if t not in covered]
            if topics:
                limit = 3 if not covered else len(topics)
                for doc, topic in await _suggest_programmes(topics, limit=limit):
                    key = f"programme:{doc['_id']}"
                    if key not in done:
                        new.append(_item(key, "programme", doc.get("name", ""), "suggested", "public",
                                         reason("learn", topic.capitalize()), "learn", str(doc["_id"]),
                                         topic=topic))
        if "find_job" in goals and not any(i.get("type") == "opportunity" for i in items):
            # Once, when she first chooses it. New work after that reaches her
            # through the saved search, not through more setup items.
            for doc in await matching_jobs(_job_terms(answers), city):
                key = f"job:{doc['_id']}"
                new.append(_item(key, "opportunity", doc.get("title", ""), "suggested", "public",
                                 reason("find_job", skills[0]["label"] if skills else ""),
                                 "find_job", str(doc["_id"])))
        if "meet" in goals:
            already = sum(1 for k in done if k.startswith("circle:"))
            if already < 3:
                seen = {k.split(":", 1)[1] for k in done if k.startswith("circle:")}
                for doc, why in await _suggest_circles(user, answers, seen, limit=3 - already):
                    key = f"circle:{doc['_id']}"
                    new.append(_item(key, "circle", doc.get("name", ""), "suggested", "public",
                                     reason("meet", why), "meet", str(doc["_id"]), shows=CIRCLE_SHOWS))

        if "welcome" not in done:
            circle = await welcome_circle(create_if_missing=True)
            if circle:
                await _join_welcome(uid, circle)
                new.append(_item("welcome", "welcome", circle.get("name", "Welcome"), "joined",
                                 "members", "Everyone starts here — only the team posts", "",
                                 str(circle["_id"]), shows=CIRCLE_SHOWS))

        update: dict = {"$set": {"last_run_at": now()}, "$inc": {"runs": 1},
                        "$unset": {"lock_until": ""}}
        if not record.get("first_run_at"):
            update["$set"]["first_run_at"] = now()
        if new:
            update["$push"] = {"items": {"$each": new}}
        fresh = await col.find_one_and_update({"user_id": uid}, update,
                                              return_document=ReturnDocument.AFTER)
    except BaseException:
        await col.update_one({"user_id": uid}, {"$unset": {"lock_until": ""}})
        raise
    return (fresh or {}).get("items") or [], len(new)


# ── home ────────────────────────────────────────────────────────────────────

#: Which home blocks each goal brings forward. Names are MeHome's own fields,
#: plus `shop_feed`, which the frontend draws from the market.
ORDER_HINTS = {
    "earn_home": ("earnings", "opportunities"),
    "sell": ("earnings", "shop_feed"),
    "find_job": ("opportunities",),
    "learn": ("recommended", "journey"),
    "meet": ("circles", "stories"),
    "shop": ("shop_feed",),
    "feel_good": ("stories",),
}


async def new_job_matches(uid: str) -> dict:
    """What her saved job search has found since she saved it."""
    search = await _db()[SAVED_SEARCHES].find_one({"user_id": uid, "type": "jobs"},
                                                  sort=[("created_at", 1)])
    if not search:
        return {"count": 0, "items": []}
    docs = await matching_jobs(set(search.get("skills") or []), search.get("city", ""),
                               limit=50, since=aware(search.get("created_at")))
    return {
        "count": len(docs),
        "items": [{"id": str(d["_id"]), "title": d.get("title", ""), "org": d.get("org", ""),
                   "location": d.get("location", "")} for d in docs[:3]],
    }


async def home_personal(user: dict) -> Optional[dict]:
    """
    The `personal` block of `/me/home`, or None when she has never opened the
    flow — the home screen then stays exactly as it was.
    """
    from app.models.enrollment import EnrollmentModel
    from app.models.shop import ListingModel

    uid = str(user["_id"])
    profile = await profile_of(uid)
    # A member who has never answered (every existing member, on launch day) is
    # invited once by the "Make WomSakhi yours" card; her home is otherwise
    # unchanged. Dismissing the card ends the invitation.
    invite = not (profile and (has_answers(profile) or profile.get("skipped_at")))
    if invite and (profile or {}).get("card_dismissed_at"):
        return None
    answers = answers_of(profile) if profile else {}
    goals = answers.get("goals") or []
    skills = skill_entries(answers)
    first = skills[0]["label"] if skills else ""

    order: list[str] = []
    reasons: dict[str, str] = {}
    for goal in goals:
        for block in ORDER_HINTS.get(goal, ()):
            if block not in order:
                order.append(block)
                detail = first if goal in ("earn_home", "sell", "find_job") else ""
                if goal == "learn" and answers.get("learn_topics"):
                    detail = answers["learn_topics"][0].capitalize()
                reasons[block] = reason(goal, detail)

    db = _db()
    live = await db[ListingModel.collection_name].count_documents(
        {"user_id": uid, "status": ListingModel.STATUS_LIVE, "hidden": {"$ne": True}}, limit=1)
    lesson = await db[EnrollmentModel.collection_name].count_documents(
        {"user_id": uid, "$or": [{"sessions_attended": {"$gte": 1}}, {"progress": {"$gt": 0}},
                                 {"status": EnrollmentModel.STATUS_COMPLETED}]}, limit=1)
    checklist = [
        {"key": "account", "label": "Create your account", "done": True, "href": "/app/settings"},
        {"key": "verified", "label": "Photos approved", "done": is_active(user), "href": "/app/verify"},
        {"key": "publish", "label": "Publish your service", "done": bool(live), "href": "/app/shop"},
        {"key": "lesson", "label": "Finish lesson 1", "done": bool(lesson), "href": "/app/programs"},
    ]
    return {
        "goals": goals,
        "order": order,
        "shop_feed": "shop" in goals or "sell" in goals,
        "reasons": reasons,
        "checklist": checklist,
        "make_it_yours": invite or make_it_yours(profile),
        "checkin_due": checkin_due(profile, user),
        "new_job_matches": await new_job_matches(uid),
    }


# ── retention ───────────────────────────────────────────────────────────────


async def purge_rejected(at: Optional[datetime] = None) -> int:
    """
    Delete the onboarding answers of women refused longer ago than the
    reapply window, unless she kept `job_updates`.

    Within `REAPPLY_AFTER_DAYS` nothing changes — she may reapply and pick up
    where she was. After it, answers kept only to set up an app she will not
    open are data with no purpose, so they go. A woman who asked to keep her
    work profile keeps it; it reads `verified: false` from her status.
    Consent records stay: they are the proof of what she agreed to and when.
    """
    at = at or now()
    cutoff = at - timedelta(days=settings.REAPPLY_AFTER_DAYS)
    users = await _db()["users"].find(
        {"verification_status": "rejected",
         "$or": [{"reapply_after": {"$lte": at}},
                 {"reapply_after": {"$exists": False}, "updated_at": {"$lte": cutoff}}]},
        {"_id": 1},
    ).to_list(None)
    ids = [str(u["_id"]) for u in users]
    if not ids:
        return 0
    res = await _db()[PROFILES].update_many(
        {"user_id": {"$in": ids}, "consents.job_updates.granted": {"$ne": True},
         "answers": {"$nin": [{}, None]}},
        {"$set": {"answers": {}, "purged_at": at, "purge_reason": "rejected_retention"}},
    )
    return int(res.modified_count)
