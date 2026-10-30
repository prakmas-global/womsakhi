"""
Health & Wellness — one store for everything she logs, and her health settings.

The Health module (fitness, nutrition, sleep, mental wellness, pregnancy,
records, reminders, games) keeps many small kinds of entry: a walk, a glass of
water, last night's sleep, a blood-pressure reading, a medicine she takes. Each
is a row in `health_entries`:

    {user_id, kind, date: "YYYY-MM-DD" | "", data: {...}, created_at, updated_at}

`data` is validated per kind (KINDS below) — a fixed set of fields with sizes
capped, so a client cannot store arbitrary documents. Undated kinds (an
allergy, a medicine she takes, her medical history) carry `date: ""`.

Her goals and preferences (water and step goals, diet type, which dashboard
widgets she hid, her pregnancy dates) are ONE document in `health_settings`.

What lives elsewhere, on purpose:
* periods and the cycle — `/me/cycle` (routes/cycle.py), the Fertility section;
* mood check-ins — `/engines/mood` (routes/engines.py);
* mentor sessions — `/growth/mentors` and `/mentoring`;
* doctor consultations — `/doctors` (routes/doctors.py).

Nothing here is ever shown to anyone else — not her circle, not staff screens.
"""

from __future__ import annotations

import re
from datetime import date as Date, datetime, timedelta, timezone
from typing import Any, Literal, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from app.core.media import MediaRefOptional, media_url
from app.core.rbac import require_active_member
from app.db.mongodb import get_database

router = APIRouter(prefix="/me/health", tags=["Member · Health"])

ENTRIES = "health_entries"
SETTINGS = "health_settings"
IST = timezone(timedelta(hours=5, minutes=30))
#: Writes a day per member, all kinds together — far above real use, low enough
#: that a runaway client cannot fill the collection.
DAILY_WRITES = 400


def _db():
    return get_database()


def today_ist() -> str:
    return datetime.now(IST).date().isoformat()


# ── kinds ─────────────────────────────────────────────────────────────────────

class _K(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


Text40 = Field("", max_length=40)
Text80 = Field("", max_length=80)
Text200 = Field("", max_length=200)
HHMM = r"^([01]\d|2[0-3]):[0-5]\d$"


class Workout(_K):
    activity: str = Field(..., min_length=1, max_length=40)
    minutes: int = Field(..., ge=1, le=600)
    steps: int = Field(0, ge=0, le=100_000)
    kcal: int = Field(0, ge=0, le=5000)
    intensity: str = Text40
    #: The routine she followed, when she used a guided workout ("yoga").
    routine: str = Text40
    note: str = Text200


class Meal(_K):
    mealType: Literal["Breakfast", "Lunch", "Evening snack", "Dinner"]
    time: str = Field("", pattern=r"^$|" + HHMM)
    food: str = Field(..., min_length=1, max_length=120)
    kcal: int = Field(0, ge=0, le=5000)
    protein: int = Field(0, ge=0, le=300)
    recipe: str = Text40


class PlannedMeal(_K):
    mealType: Literal["Breakfast", "Lunch", "Evening snack", "Dinner"]
    food: str = Field(..., min_length=1, max_length=120)
    recipe: str = Text40
    eaten: bool = False


class Water(_K):
    ml: int = Field(..., ge=10, le=3000)


class Sleep(_K):
    bed: str = Field(..., pattern=HHMM)
    wake: str = Field(..., pattern=HHMM)
    quality: Literal["Poor", "Fair", "Good", "Great"] = "Good"
    factors: list[str] = Field(default_factory=list, max_length=10)
    note: str = Text200


class Journal(_K):
    type: Literal["Reflection", "Gratitude", "Affirmation"] = "Reflection"
    text: str = Field(..., min_length=1, max_length=2000)


class CalmActivity(_K):
    type: str = Field(..., min_length=1, max_length=40)
    minutes: int = Field(..., ge=1, le=180)


class Symptoms(_K):
    symptoms: list[str] = Field(..., min_length=1, max_length=20)
    severity: str = Text40
    note: str = Text200


class Kick(_K):
    count: int = Field(..., ge=0, le=500)
    seconds: int = Field(..., ge=0, le=6 * 3600)


class Contraction(_K):
    #: One timing session: each contraction's length and the gap before it.
    lengths: list[int] = Field(default_factory=list, max_length=200)
    gaps: list[int] = Field(default_factory=list, max_length=200)


class Measure(_K):
    type: str = Field(..., min_length=1, max_length=40)
    #: As she read it: "62.5", or "120/80" for blood pressure.
    value: str = Field(..., min_length=1, max_length=12)
    note: str = Text200

    @field_validator("value")
    @classmethod
    def number_like(cls, v: str) -> str:
        if not re.fullmatch(r"\d{1,4}(\.\d{1,2})?(/\d{1,3})?", v):
            raise ValueError("Write the reading as a number, or blood pressure as 120/80")
        return v


class Allergy(_K):
    name: str = Field(..., min_length=1, max_length=80)
    reaction: str = Field("", max_length=120)
    severity: Literal["Mild", "Moderate", "Severe"] = "Mild"


class Medication(_K):
    name: str = Field(..., min_length=1, max_length=80)
    dose: str = Field("", max_length=60)
    schedule: str = Text80
    status: Literal["Taking now", "Stopped"] = "Taking now"
    reason: str = Text80
    #: Days she ticked "taken" — YYYY-MM-DD, newest kept.
    taken: list[str] = Field(default_factory=list, max_length=120)


class History(_K):
    cat: Literal["Previous condition", "Surgery", "Vaccination", "Family history", "Other"] = "Previous condition"
    condition: str = Field(..., min_length=1, max_length=100)
    since: str = Field("", max_length=12)
    note: str = Field("", max_length=300)


class Document(_K):
    title: str = Field(..., min_length=1, max_length=100)
    type: Literal["Lab report", "Prescription", "Scan report", "Vaccination", "Discharge summary", "Other"] = "Lab report"
    provider: str = Text80
    file: MediaRefOptional = None
    note: str = Text200
    #: She may want to show it in a consultation (Records → Consultation).
    shareable: bool = False
    #: A private paper she attached (routes/health_files.py), and its name.
    file_id: str = Field("", max_length=40)
    file_name: str = Field("", max_length=120)


REM_CATS = ("Doctor appointment", "Medicine", "Health check", "Vaccination", "Pregnancy visit",
            "Water", "Workout", "Mentor session", "Other")


class Reminder(_K):
    title: str = Field(..., min_length=1, max_length=80)
    category: str = Field("Other", max_length=40)
    time: str = Field("", pattern=r"^$|" + HHMM)
    repeat: Literal["Once", "Every day", "Every week", "Every month"] = "Once"
    where: str = Text80
    note: str = Text200
    #: Days she marked it done (one per occurrence); a Once reminder is done when
    #: this holds its date.
    done: list[str] = Field(default_factory=list, max_length=200)
    cancelled: bool = False
    #: "YYYY-MM-DDTHH:MM" she pushed today's occurrence to ("" when not snoozed).
    snooze: str = Field("", pattern=r"^$|^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$")


class GameSession(_K):
    game: str = Field(..., min_length=1, max_length=30)
    seconds: int = Field(..., ge=0, le=4 * 3600)
    score: int = Field(0, ge=0, le=1_000_000)
    scoreLabel: str = Text40
    mood: str = Text40


class VideoWatch(_K):
    video_id: str = Field(..., min_length=1, max_length=40)
    favorite: bool = False
    completed: bool = False
    seconds: int = Field(0, ge=0, le=6 * 3600)


#: kind → (model, dated). Dated kinds need a date; undated kinds keep "".
KINDS: dict[str, tuple[type[_K], bool]] = {
    "workout": (Workout, True),
    "meal": (Meal, True),
    "plan": (PlannedMeal, True),
    "water": (Water, True),
    "sleep": (Sleep, True),
    "journal": (Journal, True),
    "activity": (CalmActivity, True),
    "symptom": (Symptoms, True),
    "pregsym": (Symptoms, True),
    "kick": (Kick, True),
    "contraction": (Contraction, True),
    "measure": (Measure, True),
    "allergy": (Allergy, False),
    "medication": (Medication, False),
    "history": (History, False),
    "document": (Document, True),
    "reminder": (Reminder, True),
    "game": (GameSession, True),
    "vwatch": (VideoWatch, False),
}


def _valid_date(d: str, dated: bool) -> str:
    d = (d or "").strip()[:10]
    if not d:
        if dated:
            return today_ist()
        return ""
    try:
        day = Date.fromisoformat(d)
    except ValueError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Pick a valid date.")
    # A reminder, a planned meal or a document date may be ahead; a log may not
    # be more than a day in the future (a time-zone edge, not a typo).
    if day < Date(2000, 1, 1) or day > Date.fromisoformat(today_ist()) + timedelta(days=400):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "That date is out of range.")
    return day.isoformat()


def _validate(kind: str, data: dict) -> dict:
    spec = KINDS.get(kind)
    if not spec:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Unknown kind: {kind}")
    try:
        return spec[0](**(data or {})).model_dump()
    except ValidationError as exc:
        first = exc.errors()[0]
        where = ".".join(str(p) for p in first.get("loc", ()))
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            {"code": "invalid_entry", "message": f"{where}: {first.get('msg', 'not valid')}".strip(": ")})


class EntryIn(BaseModel):
    kind: str = Field(..., max_length=20)
    date: str = Field("", max_length=10)
    data: dict[str, Any] = Field(default_factory=dict)


class EntryPatch(BaseModel):
    date: Optional[str] = Field(None, max_length=10)
    data: Optional[dict[str, Any]] = None


class EntryOut(BaseModel):
    id: str
    kind: str
    date: str
    data: dict[str, Any]
    created_at: str
    updated_at: str


def _out(doc: dict) -> EntryOut:
    data = dict(doc.get("data") or {})
    if doc.get("kind") == "document" and data.get("file"):
        data["file_url"] = media_url(data["file"])
    return EntryOut(
        id=str(doc["_id"]), kind=doc["kind"], date=doc.get("date") or "", data=data,
        created_at=doc["created_at"].isoformat() if isinstance(doc.get("created_at"), datetime) else "",
        updated_at=doc["updated_at"].isoformat() if isinstance(doc.get("updated_at"), datetime) else "",
    )


async def _own(entry_id: str, uid: str) -> dict:
    if not ObjectId.is_valid(entry_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    doc = await _db()[ENTRIES].find_one({"_id": ObjectId(entry_id), "user_id": uid})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    return doc


async def _guard_rate(uid: str) -> None:
    since = datetime.now(timezone.utc) - timedelta(days=1)
    if await _db()[ENTRIES].count_documents({"user_id": uid, "updated_at": {"$gte": since}}) >= DAILY_WRITES:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "That is a lot of entries for one day. Try again tomorrow.")


@router.get("/entries", response_model=list[EntryOut], summary="What I logged")
async def list_entries(
    kind: str = Query(..., description="One kind, or several separated by commas"),
    start: str = Query("", alias="from", max_length=10),
    end: str = Query("", alias="to", max_length=10),
    limit: int = Query(500, ge=1, le=2000),
    me: dict = Depends(require_active_member),
):
    kinds = [k for k in (kind or "").split(",") if k]
    bad = [k for k in kinds if k not in KINDS]
    if not kinds or bad:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Unknown kind: {', '.join(bad) or kind}")
    query: dict = {"user_id": str(me["_id"]), "kind": {"$in": kinds}}
    rng: dict = {}
    if start:
        rng["$gte"] = _valid_date(start, True)
    if end:
        rng["$lte"] = _valid_date(end, True)
    if rng:
        # Undated kinds have date "" and are always returned whole.
        query["$or"] = [{"date": rng}, {"date": ""}]
    rows = _db()[ENTRIES].find(query).sort([("date", -1), ("created_at", -1)]).limit(limit)
    return [_out(d) async for d in rows]


@router.post("/entries", response_model=EntryOut, status_code=status.HTTP_201_CREATED, summary="Log something")
async def add_entry(body: EntryIn, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    await _guard_rate(uid)
    data = _validate(body.kind, body.data)
    now = datetime.now(timezone.utc)
    doc = {"user_id": uid, "kind": body.kind, "date": _valid_date(body.date, KINDS[body.kind][1]),
           "data": data, "created_at": now, "updated_at": now}
    doc["_id"] = (await _db()[ENTRIES].insert_one(doc)).inserted_id
    if doc["kind"] == "reminder":
        await _sync_reminder(uid, doc)
    return _out(doc)


@router.patch("/entries/{entry_id}", response_model=EntryOut, summary="Change something I logged")
async def edit_entry(entry_id: str, body: EntryPatch, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    doc = await _own(entry_id, uid)
    sets: dict = {"updated_at": datetime.now(timezone.utc)}
    if body.data is not None:
        # A patch merges onto what is there, then the whole is validated again.
        sets["data"] = _validate(doc["kind"], {**(doc.get("data") or {}), **body.data})
    if body.date is not None:
        sets["date"] = _valid_date(body.date, KINDS[doc["kind"]][1])
    await _db()[ENTRIES].update_one({"_id": doc["_id"]}, {"$set": sets})
    if doc["kind"] == "reminder":
        await _sync_reminder(uid, {**doc, **sets})
    return _out({**doc, **sets})


@router.delete("/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete something I logged")
async def delete_entry(entry_id: str, me: dict = Depends(require_active_member)):
    doc = await _own(entry_id, str(me["_id"]))
    await _db()[ENTRIES].delete_one({"_id": doc["_id"]})
    if doc["kind"] == "reminder":
        await _sync_reminder(str(me["_id"]), None, entry_id=str(doc["_id"]))


async def _sync_reminder(uid: str, doc: dict | None, *, entry_id: str = "") -> None:
    """Keep the Reminder Engine's rule in step (app/engines/health_reminders.py).
    Never fails the request: her entry is saved whatever the scheduler does."""
    from app.engines import health_reminders
    try:
        await health_reminders.sync_one(uid, doc, entry_id=entry_id or str((doc or {}).get("_id", "")))
    except Exception:  # noqa: BLE001
        import logging
        logging.getLogger(__name__).exception("health reminder sync failed")


# ── her settings ─────────────────────────────────────────────────────────────

DIETS = ("Vegetarian", "Eggetarian", "Non-vegetarian", "Vegan")
#: Diets no longer offered, and what a saved one now reads as.
RETIRED_DIETS = {"Jain": "Vegetarian"}


class Pregnancy(_K):
    basis: Literal["lmp", "due"] = "lmp"
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    doctor: str = Text80
    hospital: str = Text80


class HealthSettings(_K):
    name: str = Text40
    waterGoal: int = Field(8, ge=1, le=20)          # glasses of 250 ml
    stepsGoal: int = Field(6000, ge=500, le=40000)
    activeGoal: int = Field(30, ge=5, le=300)       # minutes a day
    sleepGoal: float = Field(8, ge=4, le=12)        # hours
    bedtime: str = Field("22:30", pattern=HHMM)
    kcalGoal: int = Field(1800, ge=800, le=5000)
    proteinGoal: int = Field(55, ge=10, le=300)
    diet: str = Field("Vegetarian", max_length=20)
    healthGoal: str = Text40
    heightCm: int = Field(0, ge=0, le=250)
    bloodGroup: str = Field("", max_length=4)
    emergencyContact: str = Text80
    dashHidden: list[str] = Field(default_factory=list, max_length=20)
    favoriteGames: list[str] = Field(default_factory=list, max_length=20)
    fitnessPlan: str = Text40
    challenges: list[str] = Field(default_factory=list, max_length=10)
    privateMode: bool = False
    reminderLead: int = Field(30, ge=0, le=1440)    # minutes before
    pregnancy: Optional[Pregnancy] = None
    #: Ticked items of her checklists, by list: "preconception", "fert-questions",
    #: "preg-care", "preg-questions", "bag". Item keys are the screen's own ids.
    checks: dict[str, list[str]] = Field(default_factory=dict)
    #: Her bedtime routine, in her words (Sleep → Bedtime). Ticks for tonight
    #: are kept in `checks["bedtime"]` as "YYYY-MM-DD:<index>".
    sleepRoutine: list[str] = Field(default_factory=list, max_length=12)
    #: Show Fertility / Pregnancy in her menu and on the Health home.
    trackCycle: bool = True
    trackPreg: bool = True
    #: The first-visit setup (four short steps) is done or skipped.
    onboarded: bool = False
    dob: str = Field("", pattern=r"^(\d{4}-\d{2}-\d{2})?$")
    #: What she wants from Health & Wellness, the movement she enjoys, and food she avoids.
    goals: list[str] = Field(default_factory=list, max_length=10)
    exercise: list[str] = Field(default_factory=list, max_length=10)
    restrictions: list[str] = Field(default_factory=list, max_length=12)

    @field_validator("goals", "exercise", "restrictions")
    @classmethod
    def short_choices(cls, v: list[str]) -> list[str]:
        return list(dict.fromkeys(str(x).strip()[:40] for x in v if str(x).strip()))

    @field_validator("sleepRoutine")
    @classmethod
    def short_steps(cls, v: list[str]) -> list[str]:
        return [str(x).strip()[:60] for x in v if str(x).strip()]

    @field_validator("checks")
    @classmethod
    def small_checks(cls, v: dict[str, list[str]]) -> dict[str, list[str]]:
        if len(v) > 20:
            raise ValueError("Too many checklists")
        out: dict[str, list[str]] = {}
        for k, items in v.items():
            if not re.fullmatch(r"[a-z0-9-]{1,30}", k) or len(items) > 80:
                raise ValueError("A checklist name or size is not valid")
            out[k] = list(dict.fromkeys(str(i)[:40] for i in items))
        return out

    @field_validator("diet")
    @classmethod
    def known_diet(cls, v: str) -> str:
        v = RETIRED_DIETS.get(v, v)
        if v and v not in DIETS:
            raise ValueError(f"Pick one of: {', '.join(DIETS)}")
        return v


@router.get("/settings", response_model=HealthSettings, summary="My health goals and preferences")
async def get_settings(me: dict = Depends(require_active_member)):
    doc = await _db()[SETTINGS].find_one({"user_id": str(me["_id"])}) or {}
    doc.pop("_id", None); doc.pop("user_id", None); doc.pop("updated_at", None)
    try:
        return HealthSettings(**doc)
    except ValidationError:
        return HealthSettings()


@router.put("/settings", response_model=HealthSettings, summary="Change my health goals and preferences")
async def put_settings(patch: dict[str, Any], me: dict = Depends(require_active_member)):
    """Merge `patch` onto what she has, then validate the whole. `pregnancy: null` clears it."""
    uid = str(me["_id"])
    have = await _db()[SETTINGS].find_one({"user_id": uid}) or {}
    have.pop("_id", None); have.pop("user_id", None); have.pop("updated_at", None)
    try:
        merged = HealthSettings(**{**have, **(patch or {})})
    except ValidationError as exc:
        first = exc.errors()[0]
        where = ".".join(str(p) for p in first.get("loc", ()))
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            {"code": "invalid_settings", "message": f"{where}: {first.get('msg', 'not valid')}"})
    await _db()[SETTINGS].update_one(
        {"user_id": uid},
        {"$set": {**merged.model_dump(), "updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return merged


# ── her data: take it all with her, or delete it all ─────────────────────────

@router.get("/export", summary="Everything Health & Wellness keeps about me")
async def export_all(me: dict = Depends(require_active_member)):
    """Her settings, every entry and the list of papers she kept (names only; she opens each one herself)."""
    from app.routes.health_files import FILES
    uid = str(me["_id"])
    entries = [_out(d).model_dump() async for d in _db()[ENTRIES].find({"user_id": uid}).sort([("date", 1), ("created_at", 1)])]
    files = [{"name": f.get("original_name", ""), "type": f.get("content_type", ""), "size": int(f.get("size") or 0),
              "kept_on": f["created_at"].isoformat() if isinstance(f.get("created_at"), datetime) else ""}
             async for f in _db()[FILES].find({"user_id": uid})]
    return {"exported_at": datetime.now(timezone.utc).isoformat(), "settings": (await get_settings(me)).model_dump(),
            "entries": entries, "files": files}


@router.delete("", status_code=status.HTTP_204_NO_CONTENT, summary="Delete all my Health & Wellness data")
async def delete_all(me: dict = Depends(require_active_member)):
    """Every entry, her settings and her kept papers (the files too). Reminders leave the scheduler with them."""
    from app.routes.health_files import FILES
    from app.routes.verification import PRIVATE_ROOT
    uid = str(me["_id"])
    reminders = [str(d["_id"]) async for d in _db()[ENTRIES].find({"user_id": uid, "kind": "reminder"}, {"_id": 1})]
    await _db()[ENTRIES].delete_many({"user_id": uid})
    for rid in reminders:
        await _sync_reminder(uid, None, entry_id=rid)
    root = PRIVATE_ROOT.resolve()
    async for f in _db()[FILES].find({"user_id": uid}, {"stored_name": 1}):
        target = (PRIVATE_ROOT / f.get("stored_name", "")).resolve()
        if root in target.parents:
            target.unlink(missing_ok=True)
    await _db()[FILES].delete_many({"user_id": uid})
    await _db()[SETTINGS].delete_one({"user_id": uid})


# ── a week at a glance, for the Health home ─────────────────────────────────

class DaySummary(BaseModel):
    date: str
    water_ml: int = 0
    active_minutes: int = 0
    steps: int = 0
    kcal: int = 0
    sleep_hours: float = 0
    workouts: int = 0
    meals: int = 0
    calm_minutes: int = 0


def sleep_hours(bed: str, wake: str) -> float:
    try:
        b = int(bed[:2]) * 60 + int(bed[3:5]); w = int(wake[:2]) * 60 + int(wake[3:5])
    except (ValueError, IndexError):
        return 0.0
    mins = (w - b) % (24 * 60)
    return round(mins / 60, 1)


@router.get("/summary", response_model=list[DaySummary], summary="My last days, added up")
async def summary(days: int = Query(7, ge=1, le=90), me: dict = Depends(require_active_member)):
    end = Date.fromisoformat(today_ist())
    start = end - timedelta(days=days - 1)
    out = {(start + timedelta(days=i)).isoformat(): DaySummary(date=(start + timedelta(days=i)).isoformat())
           for i in range(days)}
    rows = _db()[ENTRIES].find({"user_id": str(me["_id"]),
                                "kind": {"$in": ["water", "workout", "meal", "sleep", "activity"]},
                                "date": {"$gte": start.isoformat(), "$lte": end.isoformat()}})
    async for r in rows:
        day = out.get(r.get("date"))
        if not day:
            continue
        d = r.get("data") or {}
        k = r["kind"]
        if k == "water":
            day.water_ml += int(d.get("ml") or 0)
        elif k == "workout":
            day.active_minutes += int(d.get("minutes") or 0)
            day.steps += int(d.get("steps") or 0)
            day.workouts += 1
        elif k == "meal":
            day.kcal += int(d.get("kcal") or 0)
            day.meals += 1
        elif k == "sleep":
            day.sleep_hours = round(day.sleep_hours + sleep_hours(d.get("bed", ""), d.get("wake", "")), 1)
        elif k == "activity":
            day.calm_minutes += int(d.get("minutes") or 0)
    return list(out.values())
