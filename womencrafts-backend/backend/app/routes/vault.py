"""
Her vault.

Nothing in here holds money. Every endpoint reads or writes her *earmarks* —
her own record of which part of what she already has is spoken for, and for
what. See `app/models/vault.py` for why that is both the licensing position
and the honest one.

Two invariants this module exists to keep:

  1. A pocket's balance is always the sum of its movements, computed on read.
     No stored total, so no drift, so the number on the screen can never
     disagree with the history underneath it.

  2. Taking money back out is never treated as a failure. It is not styled
     as one on the screen and it is not counted as one here. The emergency
     pocket working is her taking money out of it.
"""

from collections import defaultdict
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, model_validator

from app.core.rbac import require_active_member
from app.db.mongodb import get_database
from app.models.vault import (
    GUARD_KEYS,
    SHOW_KEYS,
    TRIGGERS,
    PocketModel,
    VaultGuardsModel,
    VaultMoveModel,
    VaultRuleModel,
)

router = APIRouter(prefix="/me/vault", tags=["Member · Money"])


# ── what comes in ───────────────────────────────────────────────────────────

class PocketIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    note: str = Field(default="", max_length=140)
    instant: bool = True
    icon: str = "Lock"
    tint: str = "--ux-tint-violet"
    ink: str = "--ux-violet"
    goal_minor: int | None = Field(default=None, ge=0)


class PocketPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    note: str | None = Field(default=None, max_length=140)
    instant: bool | None = None
    icon: str | None = None
    tint: str | None = None
    ink: str | None = None
    goal_minor: int | None = Field(default=None, ge=0)


class MoveIn(BaseModel):
    pocket_id: str
    what: str = Field(default="", max_length=140)
    #: Signed. Positive sets aside, negative takes back out.
    minor: int
    source: str = "her"
    rule_id: str | None = None
    on: datetime | None = None

    @model_validator(mode="after")
    def _not_zero(self):
        if self.minor == 0:
            raise ValueError("A movement of nothing is not a movement")
        return self


class RuleIn(BaseModel):
    trigger: str
    pocket_id: str
    keep_minor: int | None = Field(default=None, ge=1)
    keep_pct: int | None = Field(default=None, ge=1, le=100)
    over_minor: int | None = Field(default=None, ge=0)
    on: bool = True

    @model_validator(mode="after")
    def _exactly_one_amount(self):
        if bool(self.keep_minor) == bool(self.keep_pct):
            raise ValueError("A rule keeps either an amount or a share, not both and not neither")
        if self.trigger not in TRIGGERS:
            raise ValueError("Not a trigger this app knows")
        return self


class RulePatch(BaseModel):
    on: bool | None = None
    keep_minor: int | None = Field(default=None, ge=1)
    keep_pct: int | None = Field(default=None, ge=1, le=100)
    over_minor: int | None = Field(default=None, ge=0)


class GuardsPatch(BaseModel):
    hide_amount: bool | None = None
    pin_to_move: bool | None = None
    quiet_notifications: bool | None = None
    quick_exit: bool | None = None


class ShowingPatch(BaseModel):
    finished_orders: bool | None = None
    shop: bool | None = None
    classes: bool | None = None
    month_earnings: bool | None = None


# ── plumbing ────────────────────────────────────────────────────────────────

def _pockets():
    return get_database()[PocketModel.collection_name]


def _moves():
    return get_database()[VaultMoveModel.collection_name]


def _rules():
    return get_database()[VaultRuleModel.collection_name]


def _guards():
    return get_database()[VaultGuardsModel.collection_name]


def _oid(v: str, what: str = "pocket") -> ObjectId:
    try:
        return ObjectId(v)
    except (InvalidId, TypeError):
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No such {what}")


async def _balances(user_id: str) -> tuple[dict[str, int], dict[str, int]]:
    """Every pocket's balance and movement count, in one pass over her moves."""
    minor: dict[str, int] = defaultdict(int)
    count: dict[str, int] = defaultdict(int)
    async for m in _moves().find({"user_id": user_id}):
        pid = m.get("pocket_id", "")
        minor[pid] += int(m.get("minor", 0))
        count[pid] += 1
    return minor, count


async def _own_pocket(user_id: str, pocket_id: str) -> dict:
    doc = await _pockets().find_one({"_id": _oid(pocket_id), "user_id": user_id})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such pocket")
    return doc


# ── the vault ───────────────────────────────────────────────────────────────

@router.get("", summary="Her pockets, and what is in each")
async def get_vault(me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    minor, count = await _balances(uid)

    rows = await _pockets().find({"user_id": uid}).sort("created_at", 1).to_list(100)
    pockets = [
        PocketModel.to_response(p, minor=minor.get(str(p["_id"]), 0), moves=count.get(str(p["_id"]), 0))
        for p in rows
    ]

    return {
        "pockets": pockets,
        # The sum of her own earmarks. Never called a balance, because
        # WomSakhi does not hold it.
        "total_minor": sum(p["minor"] for p in pockets),
        # What she can reach today with nobody's permission.
        "instant_minor": sum(p["minor"] for p in pockets if p["instant"]),
        "count": len(pockets),
    }


@router.post("/pockets", status_code=status.HTTP_201_CREATED, summary="Name a new pocket")
async def add_pocket(body: PocketIn, me: dict = Depends(require_active_member)):
    doc = PocketModel.create_document(user_id=str(me["_id"]), **body.model_dump())
    res = await _pockets().insert_one(doc)
    doc["_id"] = res.inserted_id
    return PocketModel.to_response(doc)


@router.patch("/pockets/{pocket_id}", summary="Rename it, or change the goal")
async def edit_pocket(pocket_id: str, body: PocketPatch, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    await _own_pocket(uid, pocket_id)
    patch = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if patch:
        patch["updated_at"] = datetime.now(timezone.utc)
        await _pockets().update_one({"_id": _oid(pocket_id)}, {"$set": patch})
    doc = await _own_pocket(uid, pocket_id)
    minor, count = await _balances(uid)
    return PocketModel.to_response(doc, minor=minor.get(pocket_id, 0), moves=count.get(pocket_id, 0))


@router.delete("/pockets/{pocket_id}", summary="Remove a pocket")
async def remove_pocket(pocket_id: str, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    await _own_pocket(uid, pocket_id)
    # Her history goes with it. The alternative is orphaned movements that
    # still count toward a total with no pocket to explain them.
    await _moves().delete_many({"user_id": uid, "pocket_id": pocket_id})
    await _pockets().delete_one({"_id": _oid(pocket_id), "user_id": uid})
    return {"ok": True}


# ── movements ───────────────────────────────────────────────────────────────

@router.get("/moves", summary="Everything that moved, newest first")
async def list_moves(limit: int = 100, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    names = {str(p["_id"]): p.get("name", "") async for p in _pockets().find({"user_id": uid})}
    rows = await _moves().find({"user_id": uid}).sort("on", -1).to_list(max(1, min(limit, 500)))
    moves = [VaultMoveModel.to_response(m, pocket_name=names.get(m.get("pocket_id", ""), "")) for m in rows]
    return {
        "moves": moves,
        "in_minor": sum(m["minor"] for m in moves if m["minor"] > 0),
        "out_minor": -sum(m["minor"] for m in moves if m["minor"] < 0),
        "count": len(moves),
    }


@router.post("/moves", status_code=status.HTTP_201_CREATED, summary="Set money aside, or take it back")
async def add_move(body: MoveIn, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    pocket = await _own_pocket(uid, body.pocket_id)

    # She cannot take out more than she put in. Not a punishment — a pocket
    # that could go negative would be WomSakhi inventing a debt she does not
    # have to anyone.
    if body.minor < 0:
        minor, _ = await _balances(uid)
        held = minor.get(body.pocket_id, 0)
        if held + body.minor < 0:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"There is less than that in {pocket.get('name', 'this pocket')}",
            )

    doc = VaultMoveModel.create_document(user_id=uid, **body.model_dump())
    res = await _moves().insert_one(doc)
    doc["_id"] = res.inserted_id
    return VaultMoveModel.to_response(doc, pocket_name=pocket.get("name", ""))


@router.delete("/moves/{move_id}", summary="Undo an entry she typed wrong")
async def remove_move(move_id: str, me: dict = Depends(require_active_member)):
    res = await _moves().delete_one({"_id": _oid(move_id, "entry"), "user_id": str(me["_id"])})
    if not res.deleted_count:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such entry")
    return {"ok": True}


# ── rules ───────────────────────────────────────────────────────────────────

@router.get("/rules", summary="What she saves without deciding each time")
async def list_rules(me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    names = {str(p["_id"]): p.get("name", "") async for p in _pockets().find({"user_id": uid})}

    # What each rule actually produced. Counted from the moves it wrote, so a
    # rule she has never once acted on reads zero instead of a projection.
    saved: dict[str, int] = defaultdict(int)
    async for m in _moves().find({"user_id": uid, "source": "rule"}):
        if m.get("rule_id"):
            saved[m["rule_id"]] += int(m.get("minor", 0))

    rows = await _rules().find({"user_id": uid}).sort("created_at", 1).to_list(50)
    rules = [
        VaultRuleModel.to_response(
            r,
            pocket_name=names.get(r.get("pocket_id", ""), ""),
            saved_minor=saved.get(str(r["_id"]), 0),
        )
        for r in rows
    ]
    return {
        "rules": rules,
        "saved_minor": sum(r["saved_minor"] for r in rules if r["on"]),
        "count": len(rules),
    }


@router.post("/rules", status_code=status.HTTP_201_CREATED, summary="Add a rule")
async def add_rule(body: RuleIn, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    pocket = await _own_pocket(uid, body.pocket_id)
    doc = VaultRuleModel.create_document(user_id=uid, **body.model_dump())
    res = await _rules().insert_one(doc)
    doc["_id"] = res.inserted_id
    return VaultRuleModel.to_response(doc, pocket_name=pocket.get("name", ""))


@router.patch("/rules/{rule_id}", summary="Turn it on or off, or change the amount")
async def edit_rule(rule_id: str, body: RulePatch, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    doc = await _rules().find_one({"_id": _oid(rule_id, "rule"), "user_id": uid})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such rule")
    patch = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if patch:
        await _rules().update_one({"_id": doc["_id"]}, {"$set": patch})
        doc.update(patch)
    pocket = await _pockets().find_one({"_id": _oid(doc.get("pocket_id", ""))}) or {}
    return VaultRuleModel.to_response(doc, pocket_name=pocket.get("name", ""))


@router.delete("/rules/{rule_id}", summary="Remove a rule")
async def remove_rule(rule_id: str, me: dict = Depends(require_active_member)):
    res = await _rules().delete_one({"_id": _oid(rule_id, "rule"), "user_id": str(me["_id"])})
    if not res.deleted_count:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such rule")
    return {"ok": True}


# ── privacy ─────────────────────────────────────────────────────────────────

@router.get("/guards", summary="Her shared-handset settings")
async def get_guards(me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    doc = await _guards().find_one({"user_id": uid})
    if not doc:
        # Never written until she changes something, but the defaults are the
        # private ones either way.
        doc = VaultGuardsModel.create_document(user_id=uid)
    return VaultGuardsModel.to_response(doc)


@router.patch("/guards", summary="Change one of them")
async def edit_guards(body: GuardsPatch, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    patch = {k: v for k, v in body.model_dump(exclude_unset=True).items()
             if v is not None and k in GUARD_KEYS}
    doc = await _write_guard_doc(uid, patch)
    return VaultGuardsModel.to_response(doc)


async def _write_guard_doc(uid: str, patch: dict) -> dict:
    """
    One upsert, shared by the guards and the showing screens.

    $set and $setOnInsert may not touch the same path, so the seed keeps only
    what this call is not already writing.
    """
    if patch:
        skip = set(patch) | {"updated_at"}
        seed = {k: v for k, v in VaultGuardsModel.create_document(user_id=uid).items()
                if k not in skip}
        await _guards().update_one(
            {"user_id": uid},
            {"$set": {**patch, "updated_at": datetime.now(timezone.utc)}, "$setOnInsert": seed},
            upsert=True,
        )
    return await _guards().find_one({"user_id": uid}) or VaultGuardsModel.create_document(user_id=uid)


@router.get("/showing", summary="What someone holding her phone can see")
async def get_showing(me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    doc = await _guards().find_one({"user_id": uid}) or VaultGuardsModel.create_document(user_id=uid)
    return VaultGuardsModel.showing_response(doc)


@router.patch("/showing", summary="Change what shows")
async def edit_showing(body: ShowingPatch, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    patch = {k: v for k, v in body.model_dump(exclude_unset=True).items()
             if v is not None and k in SHOW_KEYS}
    doc = await _write_guard_doc(uid, patch)
    return VaultGuardsModel.showing_response(doc)
