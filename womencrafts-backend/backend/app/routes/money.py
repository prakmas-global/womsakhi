"""
Is there enough for the things that cannot wait?

The whole endpoint answers that one question. `covers_must` is the answer;
everything else is the working.

Three sources, deliberately:

  in hand   — her wallet balance, summed from the ledger by `wallet.py`
  coming    — her books: `owed` is agreed, `promised` is not
  going out — her own commitments, the only thing this module stores

The agreed/not-agreed split is the part that matters. Counting a maybe as
money is how a woman commits to a school fee she cannot cover, so unagreed
money is returned separately and is never added into what she can spend.
"""

from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.rbac import require_active_member
from app.db.mongodb import get_database
from app.models.books import BookEntryModel
from app.models.money import WEIGHTS, CommitmentModel
from app.routes.wallet import balance_minor

router = APIRouter(prefix="/me/money", tags=["Member · Money"])

#: Ranked by consequence. Used to order the list, so every screen agrees.
_ORDER = {w: i for i, w in enumerate(WEIGHTS)}


class CommitmentIn(BaseModel):
    what: str = Field(min_length=1, max_length=120)
    minor: int = Field(ge=0)
    due: datetime | None = None
    if_missed: str = Field(default="", max_length=160)
    weight: str = "should-pay"
    icon: str = "Circle"
    tint: str = "--ux-surface-2"
    ink: str = "--ux-muted"


class CommitmentPatch(BaseModel):
    what: str | None = Field(default=None, max_length=120)
    minor: int | None = Field(default=None, ge=0)
    due: datetime | None = None
    if_missed: str | None = Field(default=None, max_length=160)
    weight: str | None = None
    paid: bool | None = None


def _col():
    return get_database()[CommitmentModel.collection_name]


def _books():
    return get_database()[BookEntryModel.collection_name]


def _oid(v: str) -> ObjectId:
    try:
        return ObjectId(v)
    except (InvalidId, TypeError):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such commitment")


@router.get("", summary="Is there enough for the things that cannot wait?")
async def get_money(me: dict = Depends(require_active_member)):
    uid = str(me["_id"])

    rows = await _col().find({"user_id": uid, "paid": {"$ne": True}}).to_list(200)
    commitments = [CommitmentModel.to_response(r) for r in rows]
    commitments.sort(key=lambda c: (_ORDER.get(c["weight"], 9), c["due"] or "9999"))

    # Money coming, read off her books rather than stored twice. `owed` is
    # work she has delivered and is waiting to be paid for — agreed. `promised`
    # is work she has agreed to do and has not done — not agreed, and never
    # counted as money she can spend.
    incoming = []
    async for e in _books().find({"user_id": uid, "state": {"$in": ["owed", "promised"]}}):
        row = BookEntryModel.to_response(e)
        certain = row["state"] == "owed"
        incoming.append({
            "id": row["id"],
            "from": f"{row['who']}{' — ' + row['what'] if row['what'] else ''}",
            "minor": row["minor"],
            "when": _when_words(row, certain),
            "certain": certain,
        })
    incoming.sort(key=lambda i: (not i["certain"], -i["minor"]))

    in_hand = await balance_minor(uid)
    must_pay = sum(c["minor"] for c in commitments if c["weight"] == "cannot-wait")
    committed = sum(c["minor"] for c in commitments)
    sure = sum(i["minor"] for i in incoming if i["certain"])
    maybe = sum(i["minor"] for i in incoming if not i["certain"])

    return {
        "commitments": commitments,
        "incoming": incoming,
        "in_hand_minor": in_hand,
        "must_pay_minor": must_pay,
        "committed_minor": committed,
        "sure_minor": sure,
        # Shown, never added. See the module note.
        "maybe_minor": maybe,
        "spare_minor": in_hand + sure - committed,
        # The answer, in one boolean, worked out in one place so that the
        # heading and the numbers underneath it can never disagree.
        "covers_must": in_hand + sure >= must_pay,
    }


def _when_words(row: dict, certain: bool) -> str:
    """When it is expected, in the words she would use."""
    if not certain:
        return "not agreed yet"
    if row["late_days"] > 0:
        return f"{row['late_days']} days late"
    due = row.get("due") or ""
    if not due:
        return "no date agreed"
    try:
        d = datetime.fromisoformat(due)
    except ValueError:
        return "no date agreed"
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    days = (d - datetime.now(timezone.utc)).days
    if days <= 0:
        return "today"
    if days == 1:
        return "tomorrow"
    if days < 7:
        return f"in {days} days"
    return f"by {d.strftime('%-d %B')}"


@router.post("/commitments", status_code=status.HTTP_201_CREATED, summary="Something she has to pay")
async def add_commitment(body: CommitmentIn, me: dict = Depends(require_active_member)):
    if body.weight not in WEIGHTS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Not a weight this app knows")
    doc = CommitmentModel.create_document(user_id=str(me["_id"]), **body.model_dump())
    res = await _col().insert_one(doc)
    doc["_id"] = res.inserted_id
    return CommitmentModel.to_response(doc)


@router.patch("/commitments/{cid}", summary="Change it, or mark it paid")
async def edit_commitment(cid: str, body: CommitmentPatch, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    doc = await _col().find_one({"_id": _oid(cid), "user_id": uid})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such commitment")
    patch = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if patch.get("weight") and patch["weight"] not in WEIGHTS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Not a weight this app knows")
    if patch:
        patch["updated_at"] = datetime.now(timezone.utc)
        await _col().update_one({"_id": doc["_id"]}, {"$set": patch})
        doc.update(patch)
    return CommitmentModel.to_response(doc)


@router.delete("/commitments/{cid}", summary="Remove a commitment")
async def remove_commitment(cid: str, me: dict = Depends(require_active_member)):
    res = await _col().delete_one({"_id": _oid(cid), "user_id": str(me["_id"])})
    if not res.deleted_count:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such commitment")
    return {"ok": True}
