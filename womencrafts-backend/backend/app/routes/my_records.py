"""
Small records that are hers alone — the weekly iron tablet, her last strength
(haemoglobin) test, and a few checklists (what to tell the doctor, what to do
before a move).

These screens used to keep everything in browser state: "I took it" filled a
bar that was gone on reload, "Last: 8 months ago" was the same fixture for
every woman, and "Get me ready" said everything would travel with her when
nothing did. Each of them is now one small document per member here.

Nothing in this file is ever shown to anyone else — not her circle, not staff
screens. It is not a score either: the iron record is which weeks she ticked,
nothing more.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.rbac import require_active_member
from app.db.mongodb import get_database

router = APIRouter(prefix="/me", tags=["Member · Health"])

RECORDS = "health_records"
CHECKLISTS = "my_checklists"

IST = timezone(timedelta(hours=5, minutes=30))
#: How many weeks of the iron record the screen draws.
WEEKS_SHOWN = 8

TEST_RESULTS = ("normal", "low", "very_low", "not_told")
#: Checklists a screen may keep. A fixed set, so a client cannot invent keys.
CHECKLIST_KEYS = ("doctor", "move")
MAX_ITEMS = 12


def _db():
    return get_database()


def _week(d: datetime) -> str:
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"


def _now_ist() -> datetime:
    return datetime.now(IST)


async def _record(uid: str) -> dict:
    return await _db()[RECORDS].find_one({"user_id": uid}) or {}


def _strength_view(doc: dict) -> dict:
    now = _now_ist()
    ticked = set(doc.get("iron_weeks") or [])
    weeks = []
    for i in range(WEEKS_SHOWN - 1, -1, -1):
        d = now - timedelta(weeks=i)
        key = _week(d)
        start = (d - timedelta(days=d.weekday())).date()
        weeks.append({"week": key, "starts": start.isoformat(), "took": key in ticked,
                      "label": "This week" if i == 0 else ("Last week" if i == 1 else start.strftime("%d %b"))})
    tests = sorted(doc.get("tests") or [], key=lambda t: t.get("date", ""), reverse=True)
    return {
        "weeks": weeks,
        "took_this_week": _week(now) in ticked,
        "last_test": tests[0] if tests else None,
        "tests": tests[:5],
    }


@router.get("/health/strength", summary="My iron weeks and my last strength test")
async def get_strength(me: dict = Depends(require_active_member)):
    return _strength_view(await _record(str(me["_id"])))


class IronTick(BaseModel):
    took: bool = True


@router.post("/health/strength/iron", summary="I took this week's iron tablet (or undo)")
async def tick_iron(body: IronTick, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    key = _week(_now_ist())
    op = {"$addToSet": {"iron_weeks": key}} if body.took else {"$pull": {"iron_weeks": key}}
    await _db()[RECORDS].update_one(
        {"user_id": uid}, {**op, "$set": {"updated_at": datetime.now(timezone.utc)}}, upsert=True)
    return _strength_view(await _record(uid))


class StrengthTest(BaseModel):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    result: Literal["normal", "low", "very_low", "not_told"]


@router.post("/health/strength/test", summary="Record a strength (haemoglobin) test I had")
async def record_test(body: StrengthTest, me: dict = Depends(require_active_member)):
    try:
        when = datetime.strptime(body.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Pick the date from the calendar.")
    if when > _now_ist().date():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "That date has not come yet.")
    uid = str(me["_id"])
    doc = await _record(uid)
    tests = [t for t in doc.get("tests") or [] if t.get("date") != body.date]
    tests.append({"date": body.date, "result": body.result})
    tests = sorted(tests, key=lambda t: t["date"], reverse=True)[:10]
    await _db()[RECORDS].update_one(
        {"user_id": uid}, {"$set": {"tests": tests, "updated_at": datetime.now(timezone.utc)}}, upsert=True)
    return _strength_view(await _record(uid))


# ── checklists ─────────────────────────────────────────────────────────────

class Checklist(BaseModel):
    #: The lines on it, in her order — her own words or tapped suggestions.
    items: list[str] = Field(default_factory=list, max_length=MAX_ITEMS)
    #: Which of them are done (for a to-do list such as "move").
    done: list[str] = Field(default_factory=list, max_length=MAX_ITEMS * 2)


def _check_key(key: str) -> str:
    if key not in CHECKLIST_KEYS:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown list")
    return key


@router.get("/checklists/{key}", summary="One of my checklists")
async def get_checklist(key: str, me: dict = Depends(require_active_member)):
    doc = await _db()[CHECKLISTS].find_one({"user_id": str(me["_id"]), "key": _check_key(key)}) or {}
    at = doc.get("updated_at")
    return {"key": key, "items": doc.get("items") or [], "done": doc.get("done") or [],
            "updated_at": at.isoformat() if isinstance(at, datetime) else ""}


@router.put("/checklists/{key}", summary="Save one of my checklists")
async def put_checklist(key: str, body: Checklist, me: dict = Depends(require_active_member)):
    items = [" ".join(i.split())[:160] for i in body.items if i.strip()]
    done = [" ".join(d.split())[:160] for d in body.done if d.strip()]
    now = datetime.now(timezone.utc)
    await _db()[CHECKLISTS].update_one(
        {"user_id": str(me["_id"]), "key": _check_key(key)},
        {"$set": {"items": items, "done": done, "updated_at": now}}, upsert=True)
    return {"key": key, "items": items, "done": done, "updated_at": now.isoformat()}
