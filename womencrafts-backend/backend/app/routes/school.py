"""
Her children, and the school dates that cost money when they are missed.

── Why this is a collection and not a fixture ──────────────────────────────
The screen shipped with two children written into it: Anaya in Class 4 at
"Govt. Primary, Sector 9" and Vihaan in Class 8, with ₹8,400 of fees and
₹5,200 already saved towards them. Every woman who opened it saw that family,
including women with no children and women with five.

And it was not only names. Six dated tasks came with them — a scholarship
renewal in 12 days, an RTE seat to confirm in 3 — so a woman could read a
deadline that was not hers and go to a school office about a seat that did
not exist.

── Ranked by what it costs to miss ─────────────────────────────────────────
A ₹420 late fee that compounds at ₹50 a day outranks a ₹900 uniform that can
wait a month. The `kind` decides the picture; the due date decides the order.
"""

from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.rbac import require_active_member
from app.db.mongodb import get_database

router = APIRouter(prefix="/me/school", tags=["Member · Family"])

CHILDREN = "member_children"
TASKS = "school_tasks"

#: fee | form | date | buy | paper — what kind of thing it is, which decides
#: the icon and whether it costs money.
KINDS = ("fee", "form", "date", "buy", "paper")


class ChildIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    cls: str = Field(default="", max_length=40)
    school: str = Field(default="", max_length=120)
    fee_minor: int = Field(0, ge=0)
    saved_minor: int = Field(0, ge=0)


class ChildPatch(BaseModel):
    name: str | None = Field(default=None, max_length=60)
    cls: str | None = Field(default=None, max_length=40)
    school: str | None = Field(default=None, max_length=120)
    fee_minor: int | None = Field(default=None, ge=0)
    saved_minor: int | None = Field(default=None, ge=0)


class TaskIn(BaseModel):
    child_id: str = ""
    what: str = Field(min_length=1, max_length=120)
    detail: str = Field(default="", max_length=200)
    kind: str = "date"
    due: datetime | None = None
    cost_minor: int = Field(0, ge=0)


class TaskPatch(BaseModel):
    done: bool | None = None
    what: str | None = Field(default=None, max_length=120)
    detail: str | None = Field(default=None, max_length=200)
    due: datetime | None = None
    cost_minor: int | None = Field(default=None, ge=0)


def _children():
    return get_database()[CHILDREN]


def _tasks():
    return get_database()[TASKS]


def _oid(v: str, what: str) -> ObjectId:
    try:
        return ObjectId(v)
    except (InvalidId, TypeError):
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No such {what}")


def _days_until(due) -> int | None:
    """Whole days from today. Negative is overdue, None when she set no date."""
    if not isinstance(due, datetime):
        return None
    if due.tzinfo is None:
        due = due.replace(tzinfo=timezone.utc)
    return (due.date() - datetime.now(timezone.utc).date()).days


@router.get("", summary="Her children, and what is coming up")
async def get_school(me: dict = Depends(require_active_member)):
    uid = str(me["_id"])

    kids = []
    async for c in _children().find({"user_id": uid}).sort("created_at", 1):
        kids.append({
            "id": str(c["_id"]),
            "name": c.get("name", ""),
            "cls": c.get("cls", ""),
            "school": c.get("school", ""),
            "fee_minor": int(c.get("fee_minor", 0)),
            "saved_minor": int(c.get("saved_minor", 0)),
        })

    rows = []
    async for t in _tasks().find({"user_id": uid}):
        due = t.get("due")
        rows.append({
            "id": str(t["_id"]),
            "child_id": t.get("child_id", ""),
            "what": t.get("what", ""),
            "detail": t.get("detail", ""),
            "kind": t.get("kind", "date"),
            "due": due.isoformat() if isinstance(due, datetime) else "",
            # Counted here so every screen says the same number of days, and
            # so a stored "in 6 days" can never go stale.
            "due_in": _days_until(due),
            "cost_minor": int(t.get("cost_minor", 0)),
            "done": bool(t.get("done", False)),
        })
    # Soonest first; anything undated sits after the dated ones rather than
    # jumping to the top as a zero.
    rows.sort(key=lambda r: (r["done"], r["due_in"] if r["due_in"] is not None else 9999))

    pending = [r for r in rows if not r["done"]]
    return {
        "children": kids,
        "tasks": rows,
        "due_minor": sum(r["cost_minor"] for r in pending),
        "fee_minor": sum(k["fee_minor"] for k in kids),
        "saved_minor": sum(k["saved_minor"] for k in kids),
        "pending": len(pending),
    }


@router.post("/children", status_code=status.HTTP_201_CREATED, summary="Add a child")
async def add_child(body: ChildIn, me: dict = Depends(require_active_member)):
    now = datetime.now(timezone.utc)
    await _children().insert_one({
        "user_id": str(me["_id"]), **body.model_dump(),
        "created_at": now, "updated_at": now,
    })
    return await get_school(me)


@router.patch("/children/{child_id}", summary="Change a child's details")
async def edit_child(child_id: str, body: ChildPatch, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    patch = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if patch:
        patch["updated_at"] = datetime.now(timezone.utc)
        res = await _children().update_one({"_id": _oid(child_id, "child"), "user_id": uid}, {"$set": patch})
        if not res.matched_count:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "No such child")
    return await get_school(me)


@router.delete("/children/{child_id}", summary="Remove a child")
async def remove_child(child_id: str, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    res = await _children().delete_one({"_id": _oid(child_id, "child"), "user_id": uid})
    if not res.deleted_count:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such child")
    # Her dates go with the child, so nothing is left pointing at nobody.
    await _tasks().delete_many({"user_id": uid, "child_id": child_id})
    return await get_school(me)


@router.post("/tasks", status_code=status.HTTP_201_CREATED, summary="Add something coming up")
async def add_task(body: TaskIn, me: dict = Depends(require_active_member)):
    data = body.model_dump()
    if data["kind"] not in KINDS:
        data["kind"] = "date"
    now = datetime.now(timezone.utc)
    await _tasks().insert_one({
        "user_id": str(me["_id"]), **data, "done": False,
        "created_at": now, "updated_at": now,
    })
    return await get_school(me)


@router.patch("/tasks/{task_id}", summary="Mark it done, or change it")
async def edit_task(task_id: str, body: TaskPatch, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    patch = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if patch:
        patch["updated_at"] = datetime.now(timezone.utc)
        res = await _tasks().update_one({"_id": _oid(task_id, "task"), "user_id": uid}, {"$set": patch})
        if not res.matched_count:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "No such task")
    return await get_school(me)


@router.delete("/tasks/{task_id}", summary="Remove it")
async def remove_task(task_id: str, me: dict = Depends(require_active_member)):
    res = await _tasks().delete_one({"_id": _oid(task_id, "task"), "user_id": str(me["_id"])})
    if not res.deleted_count:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such task")
    return await get_school(me)
