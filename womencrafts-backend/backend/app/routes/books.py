"""
Her ledger, and the proof of income it turns into.

Every figure here is counted from her own rows. Nothing is estimated, nothing
is smoothed, and a month she earned nothing in says zero rather than being
quietly dropped — a statement with a gap in it is one a landlord will not take.
"""

from collections import defaultdict
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.rbac import require_active_member
from app.db.mongodb import get_database
from app.models.books import STATES, VIA, BookEntryModel

router = APIRouter(prefix="/me/books", tags=["Member · Money"])


class EntryIn(BaseModel):
    who: str = Field(min_length=1, max_length=80)
    what: str = Field(default="", max_length=140)
    minor: int = Field(ge=0)
    state: str = "paid"
    via: str = "person"
    on: datetime | None = None
    due: datetime | None = None


class EntryPatch(BaseModel):
    who: str | None = Field(default=None, max_length=80)
    what: str | None = Field(default=None, max_length=140)
    minor: int | None = Field(default=None, ge=0)
    state: str | None = None
    via: str | None = None
    on: datetime | None = None
    due: datetime | None = None


def _col():
    return get_database()[BookEntryModel.collection_name]


def _oid(v: str) -> ObjectId:
    try:
        return ObjectId(v)
    except (InvalidId, TypeError):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such entry")


@router.get("", summary="Everything in her books")
async def list_entries(me: dict = Depends(require_active_member)):
    rows = await _col().find({"user_id": str(me["_id"])}).sort("on", -1).to_list(1000)
    entries = [BookEntryModel.to_response(r) for r in rows]

    def total(state: str) -> int:
        return sum(e["minor"] for e in entries if e["state"] == state)

    return {
        "entries": entries,
        # Named for what she would call them, not for accounting terms.
        "paid_minor": total("paid"),
        "owed_minor": total("owed"),
        "promised_minor": total("promised"),
        # The one number that should make her act today.
        "late_count": sum(1 for e in entries if e["late_days"] > 0),
    }


@router.post("", status_code=status.HTTP_201_CREATED, summary="Write something down")
async def add_entry(body: EntryIn, me: dict = Depends(require_active_member)):
    if body.state not in STATES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"state must be one of {', '.join(STATES)}")
    if body.via not in VIA:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"via must be one of {', '.join(VIA)}")
    doc = BookEntryModel.create_document(
        user_id=str(me["_id"]), who=body.who, what=body.what, minor=body.minor,
        state=body.state, via=body.via, on=body.on, due=body.due,
    )
    res = await _col().insert_one(doc)
    doc["_id"] = res.inserted_id
    return BookEntryModel.to_response(doc)


@router.patch("/{entry_id}", summary="Change one — usually to mark it paid")
async def edit_entry(entry_id: str, body: EntryPatch, me: dict = Depends(require_active_member)):
    patch = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if patch.get("state") and patch["state"] not in STATES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "unknown state")
    if patch.get("via") and patch["via"] not in VIA:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "unknown via")
    # Paid means the waiting is over; a due date left behind would keep
    # counting days late against money that has already arrived.
    if patch.get("state") == "paid":
        patch["due"] = None
    patch["updated_at"] = datetime.now(timezone.utc)

    doc = await _col().find_one_and_update(
        {"_id": _oid(entry_id), "user_id": str(me["_id"])},
        {"$set": patch},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such entry")
    return BookEntryModel.to_response(doc)


@router.delete("/{entry_id}", summary="Remove one")
async def delete_entry(entry_id: str, me: dict = Depends(require_active_member)):
    res = await _col().delete_one({"_id": _oid(entry_id), "user_id": str(me["_id"])})
    if not res.deleted_count:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such entry")
    return {"ok": True}


@router.get("/proof", summary="Proof of income, counted from her own rows")
async def proof(months: int = 6, me: dict = Depends(require_active_member)):
    """
    What a landlord, a school or a scheme will actually accept.

    Only `paid` rows count. Owed and promised money is real to her and means
    nothing to anybody assessing her, and putting it in a statement is the
    fastest way to have the whole statement disbelieved.
    """
    months = max(1, min(int(months), 24))
    rows = await _col().find(
        {"user_id": str(me["_id"]), "state": "paid"}
    ).to_list(5000)

    by_month: dict[str, dict] = defaultdict(lambda: {"minor": 0, "orders": 0, "customers": set()})
    for r in rows:
        on = r.get("on")
        if not isinstance(on, datetime):
            continue
        key = f"{on.year}-{on.month:02d}"
        b = by_month[key]
        b["minor"] += int(r.get("minor", 0))
        b["orders"] += 1
        if r.get("who"):
            b["customers"].add(r["who"].strip().lower())

    # Every month in the window, including the empty ones. A statement that
    # silently skips a bad month is a statement nobody can rely on.
    now = datetime.now(timezone.utc)
    out = []
    y, m = now.year, now.month
    for _ in range(months):
        key = f"{y}-{m:02d}"
        b = by_month.get(key, {"minor": 0, "orders": 0, "customers": set()})
        out.append({
            "month": datetime(y, m, 1).strftime("%B %Y"),
            "minor": b["minor"],
            "orders": b["orders"],
            "customers": len(b["customers"]),
        })
        m -= 1
        if m == 0:
            m, y = 12, y - 1
    out.reverse()

    total = sum(r["minor"] for r in out)
    earning_months = sum(1 for r in out if r["minor"] > 0)
    return {
        "months": out,
        "total_minor": total,
        "months_counted": len(out),
        "months_with_earnings": earning_months,
        # The sentence that actually goes on the statement.
        "average_minor": round(total / len(out)) if out else 0,
    }


# ── her year, as it actually is ─────────────────────────────────────────────

#: The trade calendar. This part is not her data and never was — wedding
#: season runs November to February for every tailor in the country, and the
#: advice attached to each window is craft knowledge, not a measurement.
#:
#: What WAS invented, and is now computed below, is the money and the
#: countdown. The fixture said every rush was worth ₹38,000 to her and was
#: always "6 weeks away", whatever she earned and whatever month it was —
#: on a screen whose entire purpose is to warn her *while there is still time
#: to prepare*.
SEASONS = [
    {"id": "sn1", "name": "Wedding season", "when": "November to February",
     "months": [11, 12, 1, 2], "shape": "rush", "icon": "Crown",
     "prepare": "Buy lining and thread now — prices go up 30% once it starts"},
    {"id": "sn2", "name": "Diwali", "when": "Late October",
     "months": [10], "shape": "rush", "icon": "Sparkles",
     "prepare": "Take bookings by the first week of October or they go elsewhere"},
    {"id": "sn3", "name": "School reopening", "when": "June",
     "months": [6], "shape": "rush", "icon": "Shirt",
     "prepare": "Ask the hostel in April. They order once and it covers three months"},
    {"id": "sn4", "name": "Monsoon", "when": "July to September",
     "months": [7, 8, 9], "shape": "quiet", "icon": "CloudRain",
     "prepare": "Do not commit to a big pot instalment. This is when the money thins"},
    {"id": "sn5", "name": "Exam months", "when": "March and April",
     "months": [3, 4], "shape": "quiet", "icon": "BookOpen",
     "prepare": "Mothers stop spending. A good time to do alterations and repairs"},
]


def _weeks_until(months: list[int], today: datetime) -> int:
    """
    Whole weeks until the window opens, 0 while she is inside it.

    Counted from the real date rather than stored, because a countdown that
    does not count down is worse than no countdown: it tells her she has six
    weeks to prepare on the morning the season starts.
    """
    if today.month in months:
        return 0
    best = None
    for m in months:
        year = today.year if m > today.month else today.year + 1
        start = datetime(year, m, 1, tzinfo=timezone.utc)
        days = (start - today).days
        if days >= 0 and (best is None or days < best):
            best = days
    return (best // 7) if best is not None else 0


@router.get("/seasons", summary="Her year, and what each season was actually worth")
async def seasons(me: dict = Depends(require_active_member)):
    now = datetime.now(timezone.utc)

    # Only money that actually arrived. A season judged on what she was
    # promised would tell her to buy stock for orders that never paid.
    paid = await _col().find(
        {"user_id": str(me["_id"]), "state": "paid"}
    ).to_list(5000)

    by_month: dict[int, int] = defaultdict(int)
    months_seen: set[tuple[int, int]] = set()
    for e in paid:
        on = e.get("on")
        if not isinstance(on, datetime):
            continue
        by_month[on.month] += int(e.get("minor", 0))
        months_seen.add((on.year, on.month))

    rows = []
    for s in SEASONS:
        # What these months have been worth to her, across every year she has
        # written down. Zero when she has not been through one yet, and the
        # screen says so rather than showing a confident number.
        earned = sum(by_month.get(m, 0) for m in s["months"])
        covered = sum(1 for (_y, m) in months_seen if m in s["months"])
        rows.append({
            **{k: s[k] for k in ("id", "name", "when", "shape", "icon", "prepare")},
            "weeks_ahead": _weeks_until(s["months"], now),
            "earned_minor": earned,
            # How many of the season's months she has any record for. Below
            # the full count, the figure is a partial year and is labelled so.
            "months_recorded": covered,
            "months_in_season": len(s["months"]),
            "now": now.month in s["months"],
        })

    rows.sort(key=lambda r: r["weeks_ahead"])
    return {
        "seasons": rows,
        "rush_minor": sum(r["earned_minor"] for r in rows if r["shape"] == "rush"),
        "quiet_minor": sum(r["earned_minor"] for r in rows if r["shape"] == "quiet"),
        # The screen needs to know whether ANY of this is grounded, so that a
        # woman in her first month is not shown a year-shaped story about
        # herself built out of nothing.
        "months_of_history": len(months_seen),
    }
