"""
Her entitlements — what the state owes her, and where each claim stands.

── The catalogue is content; the status is data ────────────────────────────
Which schemes exist, what they pay and which papers they need is reference
material about real government programmes. It is the same for every woman and
lives with the rest of the copy, on the client.

What stands where — receiving, at risk, stopped, applied and waiting — is hers
alone, and is the only thing stored here.

── Why the default is "can-claim" and never anything else ──────────────────
The screen used to ship with its statuses written in: "Ladki Bahin · at risk ·
finish e-KYC · 9 days", a second scheme "stopped", one "receiving" and one
"waiting". Every woman who opened it read that.

Both directions of that are harmful. A woman told she is *receiving* a payment
she has never had will not go and claim it. A woman told a benefit she does
not have is *at risk in nine days* is frightened into a queue at an office for
nothing — and these are women for whom a wasted day at a government office is
a day's earnings gone.

So an entitlement she has never touched reads "you may be able to claim this",
which is the one thing that is true of everybody.
"""

from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, status as http
from pydantic import BaseModel, Field

from app.core.rbac import require_active_member
from app.db.mongodb import get_database

router = APIRouter(prefix="/me/haq", tags=["Member · Rights"])

COLLECTION = "haq_status"

#: receiving  — money arriving now
#: at-risk    — arriving, with a deadline that will stop it
#: stopped    — already stopped; this is the appeal queue
#: can-claim  — she qualifies and has not applied (the default)
#: waiting    — applied, waiting on the department
STATUSES = ("receiving", "at-risk", "stopped", "can-claim", "waiting")
DEFAULT = "can-claim"


class HaqIn(BaseModel):
    status: str
    #: The dated thing that must happen, if there is one.
    action: str = Field(default="", max_length=120)
    #: ISO date. The screen counts the days itself so it is never stale.
    due_on: str = Field(default="", max_length=40)
    stopped_because: str = Field(default="", max_length=240)


def _col():
    return get_database()[COLLECTION]


def _days_until(iso: str) -> int | None:
    """
    Whole days until a dated action, counted here rather than on the screen.

    Same rule as `late_days` in books and `due_in` in school: a day count is
    a fact about today, so it is worked out on every read. Computing it in the
    client's render also made it impure — the number changed between renders
    of the same frame.
    """
    if not iso:
        return None
    try:
        due = datetime.fromisoformat(iso)
    except ValueError:
        return None
    if due.tzinfo is None:
        due = due.replace(tzinfo=timezone.utc)
    delta = due.date() - datetime.now(timezone.utc).date()
    return delta.days


@router.get("", summary="Where each of her claims stands")
async def get_haq(me: dict = Depends(require_active_member)):
    doc = await _col().find_one({"user_id": str(me["_id"])}) or {}
    states = {
        k: {**v, "due_days": _days_until(v.get("due_on", ""))}
        for k, v in doc.get("states", {}).items()
    }
    return {
        # Keyed by scheme id. Anything absent is `can-claim` on the client,
        # which is what a woman who has never applied actually is.
        "states": states,
        "default": DEFAULT,
        "tracked": len(states),
    }


@router.put("/{scheme_id}", summary="Say where one of them stands")
async def set_haq(scheme_id: str, body: HaqIn, me: dict = Depends(require_active_member)):
    if body.status not in STATUSES:
        raise HTTPException(http.HTTP_422_UNPROCESSABLE_ENTITY, "Not a status this app knows")
    uid = str(me["_id"])
    now = datetime.now(timezone.utc)

    if body.status == DEFAULT and not body.action:
        # Back to the default is the same as never having said anything, so
        # the row goes rather than sitting there as a no-op.
        update = {"$unset": {f"states.{scheme_id}": ""},
                  "$set": {"updated_at": now},
                  "$setOnInsert": {"user_id": uid, "created_at": now}}
    else:
        update = {"$set": {f"states.{scheme_id}": {
                      "status": body.status,
                      "action": body.action.strip(),
                      "due_on": body.due_on.strip(),
                      "stopped_because": body.stopped_because.strip(),
                      "updated_at": now.isoformat(),
                  }, "updated_at": now},
                  "$setOnInsert": {"user_id": uid, "created_at": now}}

    await _col().update_one({"user_id": uid}, update, upsert=True)
    return await get_haq(me)


# ── her papers ──────────────────────────────────────────────────────────────

PAPERS_COLLECTION = "paper_state"

#: held     — she has it
#: expiring — she has it and it runs out
#: missing  — she does not (the default)
PAPER_STATES = ("held", "expiring", "missing")
PAPER_DEFAULT = "missing"


class PaperIn(BaseModel):
    state: str
    #: ISO date, only meaningful for `expiring`.
    expires: str = Field(default="", max_length=40)


def _papers():
    return get_database()[PAPERS_COLLECTION]


@router.get("/papers", summary="Which papers she actually holds")
async def get_papers(me: dict = Depends(require_active_member)):
    """
    Which document is which is reference material and lives with the copy.
    Whether she HAS it is hers, and starts at "missing" for everything.

    The fixture had five of seven already held, a ration card expiring in 24
    days and a life certificate missing — the same for everybody. A woman who
    believes her ration card is on file does not go and get it, and a woman
    told hers expires in 24 days makes a trip for nothing.
    """
    doc = await _papers().find_one({"user_id": str(me["_id"])}) or {}
    return {
        "states": doc.get("states", {}),
        "default": PAPER_DEFAULT,
        "held": sum(1 for v in doc.get("states", {}).values() if v.get("state") == "held"),
    }


@router.put("/papers/{paper_id}", summary="Say whether she has one")
async def set_paper(paper_id: str, body: PaperIn, me: dict = Depends(require_active_member)):
    if body.state not in PAPER_STATES:
        raise HTTPException(http.HTTP_422_UNPROCESSABLE_ENTITY, "Not a state this app knows")
    uid = str(me["_id"])
    now = datetime.now(timezone.utc)
    if body.state == PAPER_DEFAULT:
        update = {"$unset": {f"states.{paper_id}": ""}, "$set": {"updated_at": now},
                  "$setOnInsert": {"user_id": uid, "created_at": now}}
    else:
        update = {"$set": {f"states.{paper_id}": {
                      "state": body.state, "expires": body.expires.strip(),
                  }, "updated_at": now},
                  "$setOnInsert": {"user_id": uid, "created_at": now}}
    await _papers().update_one({"user_id": uid}, update, upsert=True)
    return await get_papers(me)


# ── what the state owes her ─────────────────────────────────────────────────

LATE_COLLECTION = "late_payments"


class LateIn(BaseModel):
    what: str = Field(min_length=1, max_length=120)
    due_on: datetime
    paid_on: datetime | None = None
    owed_minor: int = Field(0, ge=0)


class LatePatch(BaseModel):
    filed: bool | None = None
    paid_on: datetime | None = None


def _late():
    return get_database()[LATE_COLLECTION]


def _oid(v: str) -> ObjectId:
    try:
        return ObjectId(v)
    except (InvalidId, TypeError):
        raise HTTPException(http.HTTP_404_NOT_FOUND, "No such payment")


@router.get("/late", summary="Payments that came late, or have not come")
async def get_late(me: dict = Depends(require_active_member)):
    rows = []
    async for d in _late().find({"user_id": str(me["_id"])}).sort("due_on", -1):
        due = d.get("due_on")
        paid = d.get("paid_on")
        # Counted from the dates, never stored. A stored "28 days late" stops
        # being true the next morning.
        if isinstance(due, datetime):
            if due.tzinfo is None:
                due = due.replace(tzinfo=timezone.utc)
            end = paid if isinstance(paid, datetime) else datetime.now(timezone.utc)
            if end.tzinfo is None:
                end = end.replace(tzinfo=timezone.utc)
            days = max(0, (end - due).days)
        else:
            days = 0
        rows.append({
            "id": str(d["_id"]),
            "what": d.get("what", ""),
            "due_on": due.strftime("%-d %B") if isinstance(due, datetime) else "",
            "paid_on": paid.strftime("%-d %B") if isinstance(paid, datetime) else "",
            "days_late": days,
            "owed_minor": int(d.get("owed_minor", 0)),
            "filed": bool(d.get("filed", False)),
        })
    return {
        "late": rows,
        # Only what she has not yet filed a complaint about.
        "owed_minor": sum(r["owed_minor"] for r in rows if not r["filed"]),
        "count": len(rows),
    }


@router.post("/late", status_code=http.HTTP_201_CREATED, summary="Record a late payment")
async def add_late(body: LateIn, me: dict = Depends(require_active_member)):
    now = datetime.now(timezone.utc)
    await _late().insert_one({
        "user_id": str(me["_id"]), **body.model_dump(),
        "filed": False, "created_at": now,
    })
    return await get_late(me)


@router.patch("/late/{late_id}", summary="Mark it filed, or paid")
async def edit_late(late_id: str, body: LatePatch, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    patch = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if patch:
        res = await _late().update_one({"_id": _oid(late_id), "user_id": uid}, {"$set": patch})
        if not res.matched_count:
            raise HTTPException(http.HTTP_404_NOT_FOUND, "No such payment")
    return await get_late(me)


@router.delete("/late/{late_id}", summary="Remove it")
async def remove_late(late_id: str, me: dict = Depends(require_active_member)):
    res = await _late().delete_one({"_id": _oid(late_id), "user_id": str(me["_id"])})
    if not res.deleted_count:
        raise HTTPException(http.HTTP_404_NOT_FOUND, "No such payment")
    return await get_late(me)
