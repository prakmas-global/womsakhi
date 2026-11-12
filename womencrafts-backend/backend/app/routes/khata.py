"""
My Khata — notes, money in and out, and chits (rules: app/core/khata.py).

Everything is hers. A chit is the one thing another member can see: a member
she links to it by username sees the chit's schedule, who has paid (names
only, never phones) and her own dues, and can tap "I paid" for the organiser
to confirm. Chit payments and payouts are written into the money book of
every linked member, so the two never disagree.

When she has set a PIN, every endpoint here except the PIN's own refuses with
423 unless the request carries `X-Khata-Key`, which only the right PIN mints.
"""

from __future__ import annotations

import re
import secrets
from datetime import date, datetime, timedelta, timezone
from typing import Literal, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, field_validator

from app.core import khata as k
from app.core.rbac import require_member_account
from app.core.security import decode_access_token
from app.core.session import COOKIE_NAME
from app.db.mongodb import get_database
from app.models.conversation import notify

router = APIRouter(prefix="/me/khata", tags=["Member · Khata"])

NOTES, ENTRIES, CHITS, SETTINGS = "khata_notes", "khata_entries", "khata_chits", "khata_settings"
MAX_NOTES, MAX_CHITS = 500, 30
PHONE = re.compile(r"^[6-9]\d{9}$")


def _db():
    return get_database()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(v) -> Optional[datetime]:
    if not isinstance(v, datetime):
        return None
    return v if v.tzinfo else v.replace(tzinfo=timezone.utc)


def _oid(v: str) -> ObjectId:
    try:
        return ObjectId(v)
    except Exception:  # noqa: BLE001
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")


# ── the lock ─────────────────────────────────────────────────────────────────

async def _settings(uid: str) -> dict:
    return await _db()[SETTINGS].find_one({"user_id": uid}) or {"user_id": uid}


async def khata_open(request: Request, me: dict = Depends(require_member_account)) -> dict:
    """Her account, and — if she set a PIN — a live key from unlocking it."""
    s = await _settings(str(me["_id"]))
    if s.get("pin_hash"):
        key = request.headers.get("x-khata-key", "")
        now = _now()
        live = [x for x in s.get("keys", []) if (_aware(x.get("exp")) or now) > now]
        if not key or k.key_hash(key) not in {x["h"] for x in live}:
            raise HTTPException(status.HTTP_423_LOCKED, {"code": "khata_locked", "message": "Enter your PIN to open your khata."})
    return me


class PinIn(BaseModel):
    pin: str = Field(pattern=r"^\d{4}$")
    current_pin: str = Field(default="", pattern=r"^(\d{4})?$")


class UnlockIn(BaseModel):
    pin: str = Field(pattern=r"^\d{4}$")


class SettingsPatch(BaseModel):
    hide_amounts: bool


@router.get("/settings", summary="Is my khata locked, and are amounts hidden")
async def get_settings(me: dict = Depends(require_member_account)):
    s = await _settings(str(me["_id"]))
    return {"pin_set": bool(s.get("pin_hash")), "hide_amounts": bool(s.get("hide_amounts", False))}


@router.patch("/settings", summary="Hide or show amounts")
async def edit_settings(body: SettingsPatch, me: dict = Depends(khata_open)):
    uid = str(me["_id"])
    await _db()[SETTINGS].update_one({"user_id": uid}, {"$set": {"hide_amounts": body.hide_amounts, "updated_at": _now()}}, upsert=True)
    return await get_settings(me)


async def _check_pin(s: dict, pin: str) -> None:
    """Right PIN, or a refusal — and five wrong ones lock it for a while."""
    until = _aware(s.get("locked_until"))
    if until and until > _now():
        mins = max(1, int((until - _now()).total_seconds() // 60) + 1)
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, f"Too many wrong tries. Try again in {mins} minutes.")
    if k.pin_matches(pin, s["pin_hash"], s["pin_salt"]):
        await _db()[SETTINGS].update_one({"user_id": s["user_id"]}, {"$set": {"tries": 0}, "$unset": {"locked_until": ""}})
        return
    tries = int(s.get("tries", 0)) + 1
    sets: dict = {"tries": tries}
    if tries >= k.MAX_TRIES:
        sets = {"tries": 0, "locked_until": _now() + k.LOCKOUT}
    await _db()[SETTINGS].update_one({"user_id": s["user_id"]}, {"$set": sets})
    raise HTTPException(status.HTTP_403_FORBIDDEN, "That PIN is not right.")


async def _mint_key(uid: str, s: dict) -> dict:
    key, h, exp = k.new_key()
    now = _now()
    keys = [x for x in s.get("keys", []) if (_aware(x.get("exp")) or now) > now][-4:] + [{"h": h, "exp": exp}]
    await _db()[SETTINGS].update_one({"user_id": uid}, {"$set": {"keys": keys}})
    return {"key": key, "expires_at": exp.isoformat()}


@router.put("/pin", summary="Set or change my PIN")
async def set_pin(body: PinIn, me: dict = Depends(require_member_account)):
    uid = str(me["_id"])
    s = await _settings(uid)
    if s.get("pin_hash"):
        if not body.current_pin:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Enter your current PIN to change it.")
        await _check_pin(s, body.current_pin)
    h, salt = k.hash_pin(body.pin)
    await _db()[SETTINGS].update_one({"user_id": uid}, {"$set": {"pin_hash": h, "pin_salt": salt, "keys": [], "tries": 0,
                                                                 "updated_at": _now()}}, upsert=True)
    return await _mint_key(uid, await _settings(uid))


@router.post("/unlock", summary="Open my khata with my PIN")
async def unlock(body: UnlockIn, me: dict = Depends(require_member_account)):
    uid = str(me["_id"])
    s = await _settings(uid)
    if not s.get("pin_hash"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "There is no PIN on your khata.")
    await _check_pin(s, body.pin)
    return await _mint_key(uid, s)


@router.delete("/pin", summary="Remove my PIN")
async def remove_pin(body: UnlockIn, me: dict = Depends(require_member_account)):
    uid = str(me["_id"])
    s = await _settings(uid)
    if s.get("pin_hash"):
        await _check_pin(s, body.pin)
    await _db()[SETTINGS].update_one({"user_id": uid}, {"$unset": {"pin_hash": "", "pin_salt": "", "keys": ""}})
    return {"pin_set": False}


@router.post("/forgot-pin", summary="Forgot my PIN — allowed right after signing in")
async def forgot_pin(request: Request, me: dict = Depends(require_member_account)):
    """
    A forgotten PIN is cleared only for a session she opened in the last 15
    minutes: someone who finds her phone already signed in cannot use this,
    because signing in needs the code sent to HER.
    """
    token = (request.headers.get("authorization", "").removeprefix("Bearer ").strip()
             or request.cookies.get(COOKIE_NAME, ""))
    payload = decode_access_token(token) or {}
    sess = await _db()["auth_sessions"].find_one({"sid": payload.get("sid")}) if payload.get("sid") else None
    started = _aware((sess or {}).get("created_at"))
    if not started or _now() - started > timedelta(minutes=15):
        raise HTTPException(status.HTTP_403_FORBIDDEN, {"code": "sign_in_again",
                            "message": "Sign out and sign in again, then reset your PIN within 15 minutes."})
    await _db()[SETTINGS].update_one({"user_id": str(me["_id"])}, {"$unset": {"pin_hash": "", "pin_salt": "", "keys": ""},
                                                                   "$set": {"tries": 0}})
    return {"pin_set": False}


# ── notes ────────────────────────────────────────────────────────────────────

class NoteIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    colour: str = "plain"
    pinned: bool = False
    amount_minor: Optional[int] = Field(default=None, ge=0, le=10_000_000_000)
    remind_on: Optional[date] = None

    @field_validator("colour")
    @classmethod
    def _colour(cls, v: str) -> str:
        if v not in k.NOTE_COLOURS:
            raise ValueError("Pick a colour from the list.")
        return v


class NotePatch(BaseModel):
    text: Optional[str] = Field(default=None, min_length=1, max_length=2000)
    colour: Optional[str] = None
    pinned: Optional[bool] = None
    amount_minor: Optional[int] = Field(default=None, ge=0, le=10_000_000_000)
    remind_on: Optional[date] = None
    clear_amount: bool = False
    clear_reminder: bool = False


def _note(d: dict) -> dict:
    return {"id": str(d["_id"]), "text": d.get("text", ""), "colour": d.get("colour", "plain"),
            "pinned": bool(d.get("pinned")), "amount_minor": d.get("amount_minor"),
            "remind_on": d.get("remind_on") or None, "updated_at": _aware(d.get("updated_at")).isoformat() if d.get("updated_at") else ""}


@router.get("/notes", summary="My notes")
async def list_notes(q: str = Query("", max_length=80), me: dict = Depends(khata_open)):
    find: dict = {"user_id": str(me["_id"])}
    if q.strip():
        find["text"] = {"$regex": re.escape(q.strip()), "$options": "i"}
    docs = await _db()[NOTES].find(find).sort([("pinned", -1), ("updated_at", -1)]).to_list(MAX_NOTES)
    return [_note(d) for d in docs]


@router.post("/notes", status_code=status.HTTP_201_CREATED, summary="Add a note")
async def add_note(body: NoteIn, me: dict = Depends(khata_open)):
    uid = str(me["_id"])
    if await _db()[NOTES].count_documents({"user_id": uid}) >= MAX_NOTES:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, f"You can keep {MAX_NOTES} notes. Remove one to add another.")
    doc = {"user_id": uid, **body.model_dump(), "remind_on": body.remind_on.isoformat() if body.remind_on else None,
           "created_at": _now(), "updated_at": _now()}
    doc["_id"] = (await _db()[NOTES].insert_one(doc)).inserted_id
    return _note(doc)


@router.patch("/notes/{note_id}", summary="Change a note")
async def edit_note(note_id: str, body: NotePatch, me: dict = Depends(khata_open)):
    d = await _db()[NOTES].find_one({"_id": _oid(note_id), "user_id": str(me["_id"])})
    if not d:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That note is not here.")
    if body.colour is not None and body.colour not in k.NOTE_COLOURS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Pick a colour from the list.")
    sets = {f: v for f, v in body.model_dump(exclude={"clear_amount", "clear_reminder"}).items() if v is not None}
    if "remind_on" in sets:
        sets["remind_on"] = sets["remind_on"].isoformat()
    if body.clear_amount:
        sets["amount_minor"] = None
    if body.clear_reminder:
        sets["remind_on"] = None
    sets["updated_at"] = _now()
    await _db()[NOTES].update_one({"_id": d["_id"]}, {"$set": sets})
    return _note({**d, **sets})


@router.delete("/notes/{note_id}", summary="Remove a note")
async def delete_note(note_id: str, me: dict = Depends(khata_open)):
    res = await _db()[NOTES].delete_one({"_id": _oid(note_id), "user_id": str(me["_id"])})
    if not res.deleted_count:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That note is not here.")
    return {"ok": True}


# ── money in and out ─────────────────────────────────────────────────────────

class EntryIn(BaseModel):
    kind: Literal["in", "out"]
    amount_minor: int = Field(gt=0, le=10_000_000_000)
    note: str = Field(default="", max_length=140)
    category: str = ""
    on: Optional[date] = None

    @field_validator("note")
    @classmethod
    def _tidy(cls, v: str) -> str:
        return " ".join(v.split())


class EntryPatch(BaseModel):
    amount_minor: Optional[int] = Field(default=None, gt=0, le=10_000_000_000)
    note: Optional[str] = Field(default=None, max_length=140)
    category: Optional[str] = None
    on: Optional[date] = None


def _check_category(kind: str, category: str) -> str:
    if not category:
        return "other_in" if kind == "in" else "other_out"
    allowed = k.IN_CATEGORIES if kind == "in" else k.OUT_CATEGORIES
    if category not in allowed:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Pick what it was for from the list.")
    return category


def _check_day(on: Optional[date]) -> str:
    on = on or date.today()
    if on > date.today() + timedelta(days=1):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "That day has not come yet.")
    return on.isoformat()


def _entry(d: dict) -> dict:
    return {"id": str(d["_id"]), "kind": d["kind"], "amount_minor": d["amount_minor"], "note": d.get("note", ""),
            "category": d.get("category", ""), "on": d.get("on", ""),
            # From a chit: written by the chit, changed only there.
            "source": d.get("source", "me"), "chit_id": d.get("chit_id", ""), "booking_id": d.get("booking_id", ""), "commitment_id": d.get("commitment_id", "")}


@router.get("/entries", summary="Money in and out, for a month")
async def list_entries(month: str = Query("", pattern=r"^(\d{4}-\d{2})?$"), me: dict = Depends(khata_open)):
    month = month or date.today().strftime("%Y-%m")
    docs = await _db()[ENTRIES].find({"user_id": str(me["_id"]), "on": {"$regex": f"^{month}"}}) \
        .sort([("on", -1), ("created_at", -1)]).to_list(2000)
    got_in = sum(d["amount_minor"] for d in docs if d["kind"] == "in")
    got_out = sum(d["amount_minor"] for d in docs if d["kind"] == "out")
    by_cat: dict[str, int] = {}
    for d in docs:
        by_cat[d.get("category", "")] = by_cat.get(d.get("category", ""), 0) + d["amount_minor"]
    return {"month": month, "items": [_entry(d) for d in docs], "in_minor": got_in, "out_minor": got_out,
            "left_minor": got_in - got_out, "by_category": by_cat,
            "categories": {"in": list(k.IN_CATEGORIES), "out": list(k.OUT_CATEGORIES)}}


@router.post("/entries", status_code=status.HTTP_201_CREATED, summary="Write down money in or out")
async def add_entry(body: EntryIn, me: dict = Depends(khata_open)):
    doc = {"user_id": str(me["_id"]), "kind": body.kind, "amount_minor": body.amount_minor, "note": body.note,
           "category": _check_category(body.kind, body.category), "on": _check_day(body.on), "source": "me",
           "created_at": _now(), "updated_at": _now()}
    doc["_id"] = (await _db()[ENTRIES].insert_one(doc)).inserted_id
    return _entry(doc)


async def _own_entry(entry_id: str, uid: str) -> dict:
    d = await _db()[ENTRIES].find_one({"_id": _oid(entry_id), "user_id": uid})
    if not d:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That entry is not here.")
    if d.get("source") == "bill":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This came from a bill. Undo its payment in Bills & plans to correct it.")
    if d.get("source") == "chit":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This came from your chit. Change it in the chit.")
    if d.get("source") == "rental":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This came from a rental. It is kept as the rental recorded it.")
    return d


@router.patch("/entries/{entry_id}", summary="Change an entry")
async def edit_entry(entry_id: str, body: EntryPatch, me: dict = Depends(khata_open)):
    d = await _own_entry(entry_id, str(me["_id"]))
    sets: dict = {"updated_at": _now()}
    if body.amount_minor is not None:
        sets["amount_minor"] = body.amount_minor
    if body.note is not None:
        sets["note"] = " ".join(body.note.split())
    if body.category is not None:
        sets["category"] = _check_category(d["kind"], body.category)
    if body.on is not None:
        sets["on"] = _check_day(body.on)
    await _db()[ENTRIES].update_one({"_id": d["_id"]}, {"$set": sets})
    return _entry({**d, **sets})


@router.delete("/entries/{entry_id}", summary="Remove an entry")
async def delete_entry(entry_id: str, me: dict = Depends(khata_open)):
    d = await _own_entry(entry_id, str(me["_id"]))
    await _db()[ENTRIES].delete_one({"_id": d["_id"]})
    return {"ok": True}


# ── chits ────────────────────────────────────────────────────────────────────

class MemberIn(BaseModel):
    name: str = Field(default="", max_length=60)
    phone: str = Field(default="", max_length=15)
    #: A WomSakhi username — links her, so she can see the chit and her dues.
    username: str = Field(default="", max_length=40)


class ChitIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    value_rupees: int = Field(ge=1_000, le=1_00_00_000)
    members_count: int = Field(ge=2, le=100)
    start_month: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    method: Literal["auction", "draw", "fixed"]
    commission_pct: float = Field(default=0, ge=0, le=k.MAX_COMMISSION_PCT)
    #: organiser — she runs it; member — she pays into someone else's.
    my_role: Literal["organiser", "member"]
    #: Is she one of the members who pays and takes a turn? (An organiser may not be.)
    i_am_member: bool = True
    members: list[MemberIn] = Field(default_factory=list, max_length=100)


class ChitPatch(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=60)
    status: Optional[Literal["running", "closed"]] = None


class MemberPatch(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=60)
    phone: Optional[str] = Field(default=None, max_length=15)


class OrderIn(BaseModel):
    member_ids: list[str] = Field(min_length=1, max_length=100)


class DecideIn(BaseModel):
    member_id: str = ""
    bid_rupees: Optional[int] = Field(default=None, ge=0)
    draw: bool = False


class PaidIn(BaseModel):
    member_id: str
    paid: bool


def _clean_phone(p: str) -> str:
    digits = re.sub(r"\D", "", p or "")[-10:]
    if digits and not PHONE.match(digits):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "A mobile number has 10 digits and starts with 6, 7, 8 or 9.")
    return digits


async def _find_user(username: str) -> Optional[dict]:
    name = username.strip().lstrip("@").lower()
    if not name:
        return None
    return await _db()["users"].find_one({"username": name, "verification_status": "active", "is_active": {"$ne": False}},
                                         {"full_name": 1, "username": 1})


async def _member_row(m: MemberIn, chit: dict, owner_id: str) -> dict:
    row = {"id": secrets.token_hex(5), "name": " ".join(m.name.split()), "phone": _clean_phone(m.phone),
           "user_id": "", "order": 0}
    if m.username.strip():
        u = await _find_user(m.username)
        if not u:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"No verified member is called @{m.username.strip().lstrip('@')}.")
        uid = str(u["_id"])
        if uid == owner_id or any(x.get("user_id") == uid for x in chit.get("members", [])):
            raise HTTPException(status.HTTP_409_CONFLICT, "She is already in this chit.")
        row["user_id"] = uid
        row["name"] = row["name"] or u.get("full_name") or u.get("username", "")
    if not row["name"]:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Give each member a name.")
    return row


def _viewer(chit: dict, uid: str) -> str:
    if chit["owner_id"] == uid:
        return "owner"
    if any(m.get("user_id") == uid for m in chit.get("members", [])):
        return "member"
    return ""


async def _chit(chit_id: str, uid: str, owner: bool = False) -> dict:
    d = await _db()[CHITS].find_one({"_id": _oid(chit_id)})
    who = _viewer(d, uid) if d else ""
    if not who or (owner and who != "owner"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That chit is not here.")
    return d


def _won(chit: dict) -> dict[str, int]:
    """member id → the month she took the pot."""
    return {mo["winner"]: int(n) for n, mo in (chit.get("months") or {}).items() if mo.get("winner")}


def _view(chit: dict, uid: str, *, full: bool) -> dict:
    """The chit as this person may see it: phones only for the organiser."""
    who = _viewer(chit, uid)
    now = k.month_index(chit["start_month"])
    n = chit["members_count"]
    months_doc = chit.get("months") or {}
    won = _won(chit)
    mine = next((m for m in chit["members"] if m.get("user_id") == uid), None)
    collected = owed = my_due = 0
    months = []
    for i in range(1, n + 1):
        mo = months_doc.get(str(i), {})
        due = mo.get("due_minor", chit["monthly_minor"])
        pays = mo.get("payments", {})
        paid = [mid for mid, p in pays.items() if p.get("paid")]
        if i <= now:
            collected += due * len(paid)
            owed += due * (len(chit["members"]) - len(paid))
            if mine and not pays.get(mine["id"], {}).get("paid"):
                my_due += due
        months.append({
            "month": i, "label": k.month_label(chit["start_month"], i),
            "when": "past" if i < now else "now" if i == now else "later",
            "winner": mo.get("winner", ""), "how": mo.get("how", ""),
            "bid_minor": mo.get("bid_minor", 0), "payout_minor": mo.get("payout_minor", 0),
            "dividend_minor": mo.get("dividend_minor", 0), "due_minor": due,
            "commission_minor": mo.get("commission_minor", 0),
            "paid": paid, "claimed": [mid for mid, p in pays.items() if p.get("claimed") and not p.get("paid")],
        })
    out = {
        "id": str(chit["_id"]), "name": chit["name"], "viewer": who, "my_role": chit["my_role"],
        # Her first name, so a linked member knows whose record it is.
        "owner_name": chit.get("owner_name", ""),
        "value_minor": chit["value_minor"], "members_count": n, "monthly_minor": chit["monthly_minor"],
        "start_month": chit["start_month"], "end_month": k.month_label(chit["start_month"], n),
        "method": chit["method"], "commission_pct": chit.get("commission_pct", 0), "status": chit.get("status", "running"),
        "month_now": now, "members_added": len(chit["members"]),
        "collected_minor": collected, "owed_minor": owed if who == "owner" else 0,
        "my_member_id": mine["id"] if mine else "", "my_due_minor": my_due,
        "i_won": bool(mine and mine["id"] in won), "my_turn_month": won.get(mine["id"], 0) if mine else 0,
    }
    if full:
        out["months"] = months
        out["members"] = [{
            "id": m["id"], "name": m["name"], "order": m.get("order", 0), "linked": bool(m.get("user_id")),
            "is_me": m.get("user_id") == uid, "won_month": won.get(m["id"], 0),
            **({"phone": m.get("phone", "")} if who == "owner" else {}),
        } for m in sorted(chit["members"], key=lambda m: (m.get("order") or 999, m["name"].lower()))]
        out["max_bid_minor"] = int(chit["value_minor"] * k.MAX_BID_PCT / 100)
        out["min_bid_minor"] = k.commission_of(chit["value_minor"], chit.get("commission_pct", 0))
    return out


async def _sync_book(chit: dict) -> None:
    """
    Her chit, in the money book of everyone linked to it: each month she paid
    goes out as "Chit payment", the month she took the pot comes in as "Chit
    payout", and the organiser's commission comes in as hers. Rewritten whole,
    so a corrected month never leaves a stale line behind.
    """
    cid = str(chit["_id"])
    await _db()[ENTRIES].delete_many({"chit_id": cid, "source": "chit"})
    rows = []
    now = _now()
    by_member = {m["id"]: m for m in chit["members"]}

    def line(uid: str, kind: str, minor: int, cat: str, month: int, note: str) -> None:
        if uid and minor > 0:
            rows.append({"user_id": uid, "kind": kind, "amount_minor": minor, "category": cat,
                         "note": f"{chit['name']} — {note}", "on": k.month_label(chit["start_month"], month) + "-01",
                         "source": "chit", "chit_id": cid, "month": month, "created_at": now, "updated_at": now})

    for n, mo in (chit.get("months") or {}).items():
        month = int(n)
        for mid, p in (mo.get("payments") or {}).items():
            m = by_member.get(mid)
            if m and p.get("paid"):
                line(m.get("user_id", ""), "out", mo.get("due_minor", chit["monthly_minor"]), "chit_payment", month, f"month {month}")
        w = by_member.get(mo.get("winner", ""))
        if w:
            line(w.get("user_id", ""), "in", mo.get("payout_minor", 0), "chit_payout", month, f"took the pot, month {month}")
        if chit["my_role"] == "organiser":
            line(chit["owner_id"], "in", mo.get("commission_minor", 0), "chit_commission", month, f"commission, month {month}")
    if rows:
        await _db()[ENTRIES].insert_many(rows)


async def _save(chit: dict, sets: dict) -> dict:
    sets["updated_at"] = _now()
    fresh = await _db()[CHITS].find_one_and_update({"_id": chit["_id"]}, {"$set": sets}, return_document=True)
    await _sync_book(fresh)
    return fresh


@router.get("/chits", summary="Chits I run or pay into")
async def list_chits(me: dict = Depends(khata_open)):
    uid = str(me["_id"])
    docs = await _db()[CHITS].find({"$or": [{"owner_id": uid}, {"members.user_id": uid}]}).sort("created_at", -1).to_list(100)
    return [_view(d, uid, full=False) for d in docs]


@router.post("/chits", status_code=status.HTTP_201_CREATED, summary="Start a chit record")
async def add_chit(body: ChitIn, me: dict = Depends(khata_open)):
    uid = str(me["_id"])
    if await _db()[CHITS].count_documents({"owner_id": uid}) >= MAX_CHITS:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, f"You can keep {MAX_CHITS} chits.")
    if not -120 <= k.month_index(body.start_month) <= 13:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Pick a start month within the last ten years.")
    value = body.value_rupees * 100
    chit: dict = {"owner_id": uid, "owner_name": (me.get("full_name") or "").split(" ")[0],
                  "name": " ".join(body.name.split()), "value_minor": value,
                  "members_count": body.members_count, "monthly_minor": round(value / body.members_count),
                  "start_month": body.start_month, "method": body.method, "commission_pct": body.commission_pct,
                  "my_role": body.my_role, "status": "running", "members": [], "months": {},
                  "created_at": _now(), "updated_at": _now()}
    if body.i_am_member:
        chit["members"].append({"id": secrets.token_hex(5), "name": (me.get("full_name") or "Me").split()[0],
                                "phone": "", "user_id": uid, "order": 0})
    if len(body.members) + len(chit["members"]) > body.members_count:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"This chit has {body.members_count} places.")
    for m in body.members:
        chit["members"].append(await _member_row(m, chit, uid))
    chit["_id"] = (await _db()[CHITS].insert_one(chit)).inserted_id
    await _tell_linked(chit, me, [m for m in chit["members"] if m.get("user_id") and m["user_id"] != uid])
    return _view(chit, uid, full=True)


async def _tell_linked(chit: dict, me: dict, rows: list[dict]) -> None:
    who = (me.get("full_name") or "A member").split()[0]
    for m in rows:
        await notify(_db(), m["user_id"], title=f"{who} added you to the chit “{chit['name']}”",
                     body="See the months, who has paid and what you owe in My Khata → Chits.",
                     ntype="account", href=f"/app/khata/chits/{chit['_id']}")


@router.get("/chits/{chit_id}", summary="One chit, month by month")
async def get_chit(chit_id: str, me: dict = Depends(khata_open)):
    uid = str(me["_id"])
    return _view(await _chit(chit_id, uid), uid, full=True)


@router.patch("/chits/{chit_id}", summary="Rename or close a chit")
async def edit_chit(chit_id: str, body: ChitPatch, me: dict = Depends(khata_open)):
    uid = str(me["_id"])
    c = await _chit(chit_id, uid, owner=True)
    sets = {f: v for f, v in body.model_dump().items() if v is not None}
    return _view(await _save(c, sets), uid, full=True)


@router.delete("/chits/{chit_id}", summary="Remove a chit record")
async def delete_chit(chit_id: str, me: dict = Depends(khata_open)):
    c = await _chit(chit_id, str(me["_id"]), owner=True)
    await _db()[CHITS].delete_one({"_id": c["_id"]})
    await _db()[ENTRIES].delete_many({"chit_id": str(c["_id"]), "source": "chit"})
    return {"ok": True}


@router.post("/chits/{chit_id}/members", status_code=status.HTTP_201_CREATED, summary="Add a member")
async def add_member(chit_id: str, body: MemberIn, me: dict = Depends(khata_open)):
    uid = str(me["_id"])
    c = await _chit(chit_id, uid, owner=True)
    if len(c["members"]) >= c["members_count"]:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"All {c['members_count']} places are filled.")
    row = await _member_row(body, c, uid)
    fresh = await _save(c, {"members": [*c["members"], row]})
    if row["user_id"]:
        await _tell_linked(fresh, me, [row])
    return _view(fresh, uid, full=True)


@router.patch("/chits/{chit_id}/members/{member_id}", summary="Change a member's name or phone")
async def edit_member(chit_id: str, member_id: str, body: MemberPatch, me: dict = Depends(khata_open)):
    uid = str(me["_id"])
    c = await _chit(chit_id, uid, owner=True)
    rows = []
    for m in c["members"]:
        if m["id"] == member_id:
            m = {**m, **({"name": " ".join(body.name.split())} if body.name else {}),
                 **({"phone": _clean_phone(body.phone)} if body.phone is not None else {})}
        rows.append(m)
    if not any(m["id"] == member_id for m in c["members"]):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That member is not in this chit.")
    return _view(await _save(c, {"members": rows}), uid, full=True)


@router.delete("/chits/{chit_id}/members/{member_id}", summary="Remove a member who has not paid or won")
async def remove_member(chit_id: str, member_id: str, me: dict = Depends(khata_open)):
    uid = str(me["_id"])
    c = await _chit(chit_id, uid, owner=True)
    for mo in (c.get("months") or {}).values():
        if mo.get("winner") == member_id or (mo.get("payments") or {}).get(member_id, {}).get("paid"):
            raise HTTPException(status.HTTP_409_CONFLICT, "She has paid or taken a pot, so she stays in the record.")
    return _view(await _save(c, {"members": [m for m in c["members"] if m["id"] != member_id]}), uid, full=True)


@router.put("/chits/{chit_id}/order", summary="Set the order members take the pot (fixed chits)")
async def set_order(chit_id: str, body: OrderIn, me: dict = Depends(khata_open)):
    uid = str(me["_id"])
    c = await _chit(chit_id, uid, owner=True)
    ids = [m["id"] for m in c["members"]]
    if sorted(body.member_ids) != sorted(ids):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Put every member in the order, once each.")
    pos = {mid: i + 1 for i, mid in enumerate(body.member_ids)}
    return _view(await _save(c, {"members": [{**m, "order": pos[m["id"]]} for m in c["members"]]}), uid, full=True)


def _open_month(c: dict, month: int) -> None:
    if not 1 <= month <= c["members_count"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This chit has no such month.")
    if month > k.month_index(c["start_month"]):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That month has not come yet.")


@router.post("/chits/{chit_id}/months/{month}/decide", summary="Who takes this month's pot")
async def decide(chit_id: str, month: int, body: DecideIn, me: dict = Depends(khata_open)):
    uid = str(me["_id"])
    c = await _chit(chit_id, uid, owner=True)
    _open_month(c, month)
    won = {mid: m for mid, m in _won(c).items() if m != month}
    eligible = [m for m in c["members"] if m["id"] not in won]
    if not eligible:
        raise HTTPException(status.HTTP_409_CONFLICT, "Everyone has already taken a pot.")
    how, winner = c["method"], body.member_id
    if body.draw:
        if c["method"] != "draw":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "This chit does not pick by draw.")
        winner = secrets.choice(eligible)["id"]
    elif not winner and c["method"] == "fixed":
        winner = next((m["id"] for m in eligible if m.get("order") == month), "")
        if not winner:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Set the order first, or pick who takes it.")
    elif winner:
        how = "picked" if c["method"] != "auction" else "auction"
    if not winner:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Pick who takes this month's pot.")
    if winner in won:
        raise HTTPException(status.HTTP_409_CONFLICT, "She has already taken a pot.")
    if not any(m["id"] == winner for m in c["members"]):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That member is not in this chit.")
    bid = 0
    if c["method"] == "auction":
        if body.bid_rupees is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Enter the winning bid.")
        bid = body.bid_rupees * 100
        if problem := k.check_bid(c, bid):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, problem)
    mo = {**(c.get("months") or {}).get(str(month), {}), **k.settle(c, bid),
          "winner": winner, "how": "draw" if body.draw else how, "decided_at": _now()}
    months = {**(c.get("months") or {}), str(month): mo}
    fresh = await _save(c, {"months": months})
    w = next(m for m in fresh["members"] if m["id"] == winner)
    if w.get("user_id") and w["user_id"] != uid:
        await notify(_db(), w["user_id"], title=f"You take the pot in “{c['name']}” this month",
                     body=f"₹{mo['payout_minor'] // 100:,} for month {month}.", ntype="account",
                     href=f"/app/khata/chits/{c['_id']}")
    return _view(fresh, uid, full=True)


@router.post("/chits/{chit_id}/months/{month}/payments", summary="Mark a member paid or not paid")
async def mark_paid(chit_id: str, month: int, body: PaidIn, me: dict = Depends(khata_open)):
    uid = str(me["_id"])
    c = await _chit(chit_id, uid, owner=True)
    _open_month(c, month)
    if not any(m["id"] == body.member_id for m in c["members"]):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That member is not in this chit.")
    months = {**(c.get("months") or {})}
    mo = {**months.get(str(month), {})}
    pays = {**mo.get("payments", {})}
    pays[body.member_id] = {"paid": body.paid, "on": _now().date().isoformat() if body.paid else "", "claimed": False}
    mo["payments"] = pays
    mo.setdefault("due_minor", c["monthly_minor"])
    months[str(month)] = mo
    return _view(await _save(c, {"months": months}), uid, full=True)


@router.post("/chits/{chit_id}/months/{month}/i-paid", summary="Tell the organiser I paid")
async def i_paid(chit_id: str, month: int, me: dict = Depends(khata_open)):
    uid = str(me["_id"])
    c = await _chit(chit_id, uid)
    _open_month(c, month)
    mine = next((m for m in c["members"] if m.get("user_id") == uid), None)
    if not mine or c["owner_id"] == uid:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only a member can tell the organiser she paid.")
    months = {**(c.get("months") or {})}
    mo = {**months.get(str(month), {})}
    pays = {**mo.get("payments", {})}
    if pays.get(mine["id"], {}).get("paid"):
        return _view(c, uid, full=True)
    pays[mine["id"]] = {"paid": False, "claimed": True, "claimed_at": _now()}
    mo["payments"] = pays
    months[str(month)] = mo
    fresh = await _save(c, {"months": months})
    await notify(_db(), c["owner_id"], title=f"{mine['name']} says she paid — “{c['name']}”",
                 body=f"Month {month}. Confirm it when the money reaches you.", ntype="account",
                 href=f"/app/khata/chits/{c['_id']}")
    return _view(fresh, uid, full=True)
