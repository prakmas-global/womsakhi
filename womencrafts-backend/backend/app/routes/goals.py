"""
Her goals.

Until this existed, `/me/goals` was a 404. The client had `apiGoals`,
`apiAddGoal`, `apiMoveGoal` and `apiDropGoal`, a whole `/app/goals` screen and
three others reading from it — and every one of those requests failed, so she
could set a goal, watch it appear, and find it gone on reload.

The model was already here (`app/models/goal.py`), already on the `goals`
collection, and already read by the money-goal card on `/me/home`. Only the
endpoints were missing, so this uses that model rather than a second store —
two collections of goals would mean the card and the screen disagreeing.

── Progress is computed, never stored ──────────────────────────────────────
A money goal sums her earnings since she set it; a learning goal counts the
courses she has finished since then. Only a `count` goal — "speak to four new
buyers" — is hers to move, because nothing here can observe it.

Measuring forward from `created_at` matters: a woman who sets a "₹20,000 this
year" goal in November should not open it already complete because of what she
earned in March.
"""

from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.rbac import require_active_member
from app.core.serializers import aware
from app.db.mongodb import get_database
from app.models.books import BookEntryModel
from app.models.enrollment import EnrollmentModel
from app.models.goal import GoalModel

router = APIRouter(prefix="/me/goals", tags=["Member · Journey"])


class GoalIn(BaseModel):
    label: str = Field(min_length=1, max_length=120)
    kind: str = GoalModel.KIND_COUNT
    target: int = Field(0, ge=0)
    #: A goal without a date is a wish. The screen says so before it saves.
    by: str = Field(default="", max_length=40)
    unit: str = Field(default="", max_length=24)


class GoalPatch(BaseModel):
    current: int = Field(ge=0)


class GoalDetailsPatch(BaseModel):
    label: str = Field(min_length=1, max_length=120)
    target: int = Field(ge=0)
    by: str = Field(default="", max_length=40)
    unit: str = Field(default="", max_length=24)
    note: str = Field(default="", max_length=500)


def _col():
    return get_database()[GoalModel.collection_name]


def _oid(v: str) -> ObjectId:
    try:
        return ObjectId(v)
    except (InvalidId, TypeError):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such goal")


async def _all(uid: str) -> list[dict]:
    """
    Every open goal, with the measurable ones counted.

    One pass over her books and one over her enrolments, shared by all her
    goals, rather than a query per goal.
    """
    docs = await _col().find(
        {"user_id": uid, "status": {"$ne": GoalModel.STATUS_DROPPED}}
    ).sort("created_at", -1).to_list(200)
    if not docs:
        return []

    db = get_database()
    paid: list[dict] = []
    if any(d.get("kind") == GoalModel.KIND_MONEY for d in docs):
        paid = await db[BookEntryModel.collection_name].find(
            {"user_id": uid, "state": "paid"}
        ).to_list(5000)

    done: list[dict] = []
    if any(d.get("kind") == GoalModel.KIND_SKILL for d in docs):
        done = await db[EnrollmentModel.collection_name].find(
            {"user_id": uid, "status": EnrollmentModel.STATUS_COMPLETED}
        ).to_list(500)

    out = []
    for d in docs:
        kind = d.get("kind", GoalModel.KIND_COUNT)
        if kind == GoalModel.KIND_COUNT:
            # Hers to move; `to_response` reads the stored value.
            out.append(GoalModel.to_response(d))
            continue
        since = aware(d.get("created_at"))
        if kind == GoalModel.KIND_MONEY:
            current = sum(int(e.get("minor", 0)) for e in paid if _after(e.get("on"), since))
        else:
            current = sum(
                1 for e in done
                if _after(e.get("updated_at") or e.get("created_at"), since)
            )
        out.append(GoalModel.to_response(d, current=current))
    return out


def _after(when, since) -> bool:
    """Whether `when` falls on or after `since`, both made tz-aware."""
    when, since = aware(when), aware(since)
    if not when or not since:
        return False
    return when >= since


@router.get("", summary="Everything she is working towards")
async def list_goals(me: dict = Depends(require_active_member)):
    return await _all(str(me["_id"]))


@router.post("", status_code=status.HTTP_201_CREATED, summary="Set a goal")
async def add_goal(body: GoalIn, me: dict = Depends(require_active_member)):
    if body.kind not in GoalModel.KINDS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Not a kind of goal this app knows")
    uid = str(me["_id"])
    await _col().insert_one(GoalModel.create_document(
        user_id=uid, member_id=me.get("member_id", ""), **body.model_dump(),
    ))
    # The whole list back, which is what every caller uses.
    return await _all(uid)


@router.patch("/{goal_id}", summary="Move a goal she counts herself")
async def move_goal(goal_id: str, body: GoalPatch, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    doc = await _col().find_one({"_id": _oid(goal_id), "user_id": uid})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such goal")
    if doc.get("kind") != GoalModel.KIND_COUNT:
        # Refused rather than quietly ignored. A money goal that could be set
        # by hand is one that can be made to say anything.
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This goal counts itself — it cannot be moved by hand",
        )
    current = max(0, int(body.current))
    target = int(doc.get("target", 0))
    await _col().update_one({"_id": doc["_id"]}, {"$set": {
        "current": current,
        "status": GoalModel.STATUS_REACHED if target and current >= target else GoalModel.STATUS_OPEN,
        "updated_at": datetime.now(timezone.utc),
    }})
    return await _all(uid)


@router.patch("/{goal_id}/details", summary="Edit a goal's details")
async def edit_goal_details(
    goal_id: str, body: GoalDetailsPatch, me: dict = Depends(require_active_member),
):
    uid = str(me["_id"])
    res = await _col().update_one(
        {"_id": _oid(goal_id), "user_id": uid, "status": {"$ne": GoalModel.STATUS_DROPPED}},
        {"$set": {
            "label": body.label.strip(), "target": body.target, "by": body.by.strip(),
            "unit": body.unit.strip(), "note": body.note.strip(),
            "updated_at": datetime.now(timezone.utc),
        }},
    )
    if not res.matched_count:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such goal")
    return await _all(uid)


@router.delete("/{goal_id}", summary="Drop a goal")
async def drop_goal(goal_id: str, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    # Marked dropped rather than deleted: the money-goal card and anything
    # else reading this collection filters on status, and a hard delete would
    # lose that she had ever set it.
    res = await _col().update_one(
        {"_id": _oid(goal_id), "user_id": uid},
        {"$set": {"status": GoalModel.STATUS_DROPPED, "updated_at": datetime.now(timezone.utc)}},
    )
    if not res.matched_count:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such goal")
    return await _all(uid)
