"""Personal bill plans and their linked notebook expenses.

The workspace uses GET /commitments and the khata entry/note APIs. A bill is
paid when its owned source=bill expense exists; retries reuse one deterministic
entry ID. Undo removes that expense and naturally reopens the plan. Legacy
paid flags are preserved without manufacturing transaction history.

GET /me/money remains a compatibility aggregate for older clients. Its wallet
and receivable projections are not the personal notebook's cash/bank balance.
All money endpoints honor the existing notebook PIN.
"""

from datetime import date, datetime, timedelta, timezone
from hashlib import sha256

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from app.core.rbac import require_active_member
from app.db.mongodb import get_database
from app.models.books import BookEntryModel
from app.models.money import WEIGHTS, CommitmentModel
from app.routes.wallet import balance_minor
from app.routes.khata import khata_open, ENTRIES, _check_day, _entry

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
async def get_money(me: dict = Depends(khata_open), _: dict = Depends(require_active_member)):
    uid = str(me["_id"])

    rows = await _col().find({"user_id": uid, "paid": {"$ne": True}}).to_list(200)
    paid_refs = {p["commitment_id"] async for p in get_database()[ENTRIES].find({"user_id": uid, "source": "bill"}, {"commitment_id": 1})}
    commitments = [CommitmentModel.to_response(r) for r in rows if str(r["_id"]) not in paid_refs]
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
async def add_commitment(body: CommitmentIn, me: dict = Depends(khata_open), _: dict = Depends(require_active_member)):
    if not body.what.strip():
        raise HTTPException(422, "Give the bill or plan a name.")
    if body.weight not in WEIGHTS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Not a weight this app knows")
    doc = CommitmentModel.create_document(user_id=str(me["_id"]), **body.model_dump())
    res = await _col().insert_one(doc)
    doc["_id"] = res.inserted_id
    return CommitmentModel.to_response(doc)


@router.patch("/commitments/{cid}", summary="Change it, or mark it paid")
async def edit_commitment(cid: str, body: CommitmentPatch, me: dict = Depends(khata_open), _: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    doc = await _col().find_one({"_id": _oid(cid), "user_id": uid})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such commitment")
    if await _bill_entry(cid, uid):
        raise HTTPException(409, "Undo the recorded payment before changing this bill.")
    patch = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None or k == "due"}
    if "what" in patch:
        patch["what"] = patch["what"].strip()
        if not patch["what"]:
            raise HTTPException(422, "Give the bill or plan a name.")
    if patch.get("weight") and patch["weight"] not in WEIGHTS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Not a weight this app knows")
    if patch:
        patch["updated_at"] = datetime.now(timezone.utc)
        await _col().update_one({"_id": doc["_id"]}, {"$set": patch})
        doc.update(patch)
    return CommitmentModel.to_response(doc)


@router.delete("/commitments/{cid}", summary="Remove a commitment")
async def remove_commitment(cid: str, me: dict = Depends(khata_open), _: dict = Depends(require_active_member)):
    if await _bill_entry(cid, str(me["_id"])):
        raise HTTPException(409, "Undo the recorded payment before removing this bill.")
    res = await _col().delete_one({"_id": _oid(cid), "user_id": str(me["_id"])})
    if not res.deleted_count:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such commitment")
    return {"ok": True}


# A paid bill has one canonical expense. Its existence is the paid state,
# so there is no second paid flag that can drift or fail halfway through.
def _payment_id(cid: str, uid: str) -> ObjectId:
    return ObjectId(sha256(f"bill:{uid}:{_oid(cid)}".encode()).hexdigest()[:24])


async def _bill_entry(cid: str, uid: str):
    cid = str(_oid(cid))
    return await get_database()[ENTRIES].find_one({"_id": _payment_id(cid, uid), "user_id": uid, "source": "bill", "commitment_id": cid})


class PaymentRecord(BaseModel):
    on: date | None = None


@router.get("/commitments", summary="Upcoming and completed bills; no wallet estimate")
async def list_commitments(me: dict = Depends(khata_open), _: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    rows = await _col().find({"user_id": uid}).sort("created_at", -1).to_list(1000)
    payments = {p["commitment_id"]: p async for p in get_database()[ENTRIES].find({"user_id": uid, "source": "bill"})}
    result = []
    for doc in rows:
        row = CommitmentModel.to_response(doc)
        payment = payments.get(str(doc["_id"]))
        row.update(paid=bool(payment or doc.get("paid")), payment_entry_id=str(payment["_id"]) if payment else "",
                   paid_on=payment.get("on", "") if payment else "", recorded_minor=payment["amount_minor"] if payment else None,
                   legacy_paid=bool(doc.get("paid") and not payment))
        result.append(row)
    return result


@router.post("/commitments/{cid}/payment", summary="Record a bill payment once in the money notebook")
async def record_payment(cid: str, body: PaymentRecord, me: dict = Depends(khata_open), _: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    cid = str(_oid(cid))
    doc = await _col().find_one({"_id": _oid(cid), "user_id": uid})
    if not doc:
        raise HTTPException(404, "That bill is not here.")
    existing = await _bill_entry(cid, uid)
    if existing:
        return _entry(existing)
    if doc.get("paid"):
        raise HTTPException(409, "This plan was already marked done. Reopen it before recording an expense.")
    if doc.get("minor", 0) <= 0:
        raise HTTPException(422, "Set a positive bill amount before recording payment.")
    today = (datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)).date()
    if body.on and body.on > today:
        raise HTTPException(422, "Record only payments you have already made. Keep future payments as plans.")
    row = {"user_id": uid, "kind": "out", "amount_minor": doc["minor"], "note": doc["what"],
           "category": "other_out", "on": _check_day(body.on or (datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)).date()), "source": "bill", "commitment_id": cid,
           "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}
    # Deterministic _id is the concurrency guard: retried taps cannot add another expense.
    try:
        await get_database()[ENTRIES].update_one({"_id": _payment_id(cid, uid), "user_id": uid}, {"$setOnInsert": row}, upsert=True)
    except DuplicateKeyError:
        pass  # Another identical request may have inserted the same canonical expense.
    saved = await _bill_entry(cid, uid)
    if not saved:
        raise HTTPException(409, "The payment record changed. Refresh your money notebook and try again.")
    return _entry(saved)


@router.delete("/commitments/{cid}/payment", summary="Undo the linked expense and reopen the bill")
async def undo_payment(cid: str, me: dict = Depends(khata_open), _: dict = Depends(require_active_member)):
    cid = str(_oid(cid))
    uid = str(me["_id"])
    if not await _col().find_one({"_id": _oid(cid), "user_id": uid}):
        raise HTTPException(404, "That bill is not here.")
    await get_database()[ENTRIES].delete_one({"_id": _payment_id(cid, uid), "user_id": uid, "source": "bill", "commitment_id": cid})
    return {"ok": True}
