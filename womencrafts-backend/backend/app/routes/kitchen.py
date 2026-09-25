"""
Her food licence, and the hygiene points an inspector actually checks.

── What was wrong with this screen ─────────────────────────────────────────
It shipped with her progress already filled in: "Aadhaar and a photo — done",
"Your kitchen address — done", two steps to go. Every woman saw two of four
steps ticked on a licence she had never started.

That is worse than it looks. A woman who believes her FSSAI registration is
half done does not start it — and selling cooked food without one is the thing
that gets a stall shut down and her stock taken.

── The steps are the law; the ticks are hers ───────────────────────────────
What the registration requires is the same for everybody and stays with the
copy. Which of them she has done is stored here, and starts empty.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.rbac import require_active_member
from app.db.mongodb import get_database

router = APIRouter(prefix="/me/kitchen", tags=["Member · Work"])

COLLECTION = "kitchen_progress"


class StepIn(BaseModel):
    done: bool


@router.get("", summary="How far she has got with the licence")
async def get_kitchen(me: dict = Depends(require_active_member)):
    doc = await _col().find_one({"user_id": str(me["_id"])}) or {}
    return {
        # Ids she has ticked. Absent means not done, which is where everyone
        # starts — see the module note.
        "done": sorted(doc.get("done", [])),
        "hygiene": sorted(doc.get("hygiene", [])),
        "licence_no": doc.get("licence_no", ""),
    }


def _col():
    return get_database()[COLLECTION]


@router.put("/steps/{step_id}", summary="Tick or untick a licence step")
async def set_step(step_id: str, body: StepIn, me: dict = Depends(require_active_member)):
    return await _flip(me, "done", step_id, body.done)


@router.put("/hygiene/{point_id}", summary="Tick or untick a hygiene point")
async def set_hygiene(point_id: str, body: StepIn, me: dict = Depends(require_active_member)):
    return await _flip(me, "hygiene", point_id, body.done)


async def _flip(me: dict, field: str, key: str, on: bool):
    uid = str(me["_id"])
    now = datetime.now(timezone.utc)
    op = {"$addToSet": {field: key}} if on else {"$pull": {field: key}}
    await _col().update_one(
        {"user_id": uid},
        {**op, "$set": {"updated_at": now}, "$setOnInsert": {"user_id": uid, "created_at": now}},
        upsert=True,
    )
    return await get_kitchen(me)


class LicenceIn(BaseModel):
    licence_no: str = ""


@router.put("/licence", summary="Record the licence number once she has it")
async def set_licence(body: LicenceIn, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    now = datetime.now(timezone.utc)
    await _col().update_one(
        {"user_id": uid},
        {"$set": {"licence_no": body.licence_no.strip()[:40], "updated_at": now},
         "$setOnInsert": {"user_id": uid, "created_at": now}},
        upsert=True,
    )
    return await get_kitchen(me)
