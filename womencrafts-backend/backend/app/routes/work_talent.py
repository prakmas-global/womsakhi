"""
Work by skill — the category and skill masters, her work profile, and "Find
people": a verified member looking for a tailor finds the women who said, skill
by skill, that they want to be found for it.

── The three rules this file keeps ─────────────────────────────────────────
1. One vocabulary. Categories and skills are a master list staff manage
   (`work_categories`, `work_skills`). It starts as the onboarding taxonomy in
   app/core/skills.py, with the same keys, so the skills a woman already picked
   when she joined carry straight over. Seeded on first read, not by the dev
   seeder, so production has it too.
2. Opt-in per skill. Each skill on her profile has its own "show me" switch,
   off until she turns it on. Search matches only switched-on skills, and a
   result never mentions the skills she kept to herself.
3. Her number is hers. Search shows first name, area and skills — never the
   phone. Contact is a WomSakhi chat; she can send her number into it if SHE
   chooses, or say "not interested", which closes it and hides her from that
   person for good.

Anyone who can search is a verified member (`require_active_member`); there is
no outside employer account.
"""

from __future__ import annotations

import asyncio
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from app.core import masters
from app.core import skill_master, skills as taxonomy, work_done
from app.core.audit import record
from app.core.deps import get_current_user
from app.core.onboarding import PROFILES, answers_of
from app.core.permissions import require_permission
from app.core.rbac import require_active_member, require_member_account
from app.core.skill_proof import verified_skills
from app.core.media import MediaRefOptional, media_url
from app.db.mongodb import get_database
from app.models.conversation import MemberNotificationModel, notify
from app.models.member_conversation import MemberConversationModel as Conv

router = APIRouter(prefix="/work", tags=["Member · Work"])
admin_router = APIRouter(prefix="/admin/work", tags=["Growth & Work"])

CATEGORIES = "work_categories"
SKILLS = "work_skills"
PROFILES_COL = "work_profiles"

#: How long she has done it. "learning" is honest and welcome.
LEVELS = {"learning": "Learning", "1-2": "1–2 years", "3-5": "3–5 years", "5+": "5+ years"}
_LEVEL_RANK = {"learning": 0, "1-2": 1, "3-5": 2, "5+": 3}
WORK_TYPES = ("Full-time", "Part-time", "From home", "Per order")
DAYS = ("Weekdays", "Weekends", "Mornings", "Afternoons", "Evenings")
MAX_SKILLS = 20
#: New conversations one member may open from search in a day. Enough to hire;
#: too few to spam every tailor in a city.
NEW_CHATS_PER_DAY = 20

#: A passed skill test (assessments.skill) vouches for a whole category.
#: These are the tests whose names don't match a category; any other test is
#: matched by name to a Work skill or category in the master (`_test_category`),
#: so a new test staff add vouches without a code change.
_TEST_TO_CATEGORY = {
    "tailoring": "tailoring_fashion",
    "beauty": "beauty_wellness",
    "food business": "food_cooking",
    "cooking": "food_cooking",
    "digital": "office_digital",
    "english": "teaching_tuition",
    "money": "community_finance",
}


def _db():
    return get_database()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.casefold()).strip("_")[:48]


# ── the masters ────────────────────────────────────────────────────────────

async def _ensure_seeded() -> None:
    """The onboarding taxonomy, copied once into the editable masters."""
    if await _db()[CATEGORIES].estimated_document_count():
        return
    now = _now()
    cats = [{"key": k, "name": label, "sort": i, "active": True, "created_at": now, "updated_at": now}
            for i, (k, (label, _)) in enumerate(taxonomy.GROUPS.items())]
    skills = [{"key": s["key"], "name": s["label"], "category": s["group"], "sort": i,
               "popular": bool(s["popular"]), "active": True, "created_at": now, "updated_at": now}
              for i, s in enumerate(taxonomy.SKILLS)]
    try:
        await _db()[CATEGORIES].insert_many(cats, ordered=False)
        await _db()[SKILLS].insert_many(skills, ordered=False)
    except Exception:  # noqa: BLE001 — two first readers at once; the unique index keeps one copy
        pass


async def _masters(include_inactive: bool = False) -> tuple[list[dict], list[dict]]:
    await _ensure_seeded()
    q = {} if include_inactive else {"active": True}
    cats, skills = await asyncio.gather(
        _db()[CATEGORIES].find(q).sort([("sort", 1), ("name", 1)]).to_list(500),
        _db()[SKILLS].find(q).sort([("sort", 1), ("name", 1)]).to_list(5000),
    )
    return cats, skills


async def _skill_index() -> dict[str, dict]:
    """Active skills whose category is also active, by key."""
    cats, skills = await _masters()
    live = {c["key"]: c for c in cats}
    return {s["key"]: {**s, "category_name": live[s["category"]]["name"],
                       # Its own picture, else its category's; "" lets the screen choose.
                       "picture": media_url(s.get("image") or live[s["category"]].get("image"))}
            for s in skills if s["category"] in live}


@router.get("/taxonomy", summary="Categories and their skills")
async def get_taxonomy(_: dict = Depends(require_member_account)):
    # Any member account, even one still being verified: it is a word list,
    # and she may set up her skills while she waits.
    cats, skills = await _masters()
    by_cat: dict[str, list[dict]] = {}
    for s in skills:
        by_cat.setdefault(s["category"], []).append(
            {"key": s["key"], "name": s["name"], "popular": bool(s.get("popular")),
             "image": media_url(s.get("image"))})
    return {"categories": [
        {"key": c["key"], "name": c["name"], "image": media_url(c.get("image")), "skills": by_cat.get(c["key"], [])}
        for c in cats if by_cat.get(c["key"])
    ]}


# ── her work profile ───────────────────────────────────────────────────────

class SkillChoice(BaseModel):
    key: str = Field(min_length=1, max_length=64)
    level: str = Field(default="", max_length=10)
    visible: bool = False


class WorkProfileIn(BaseModel):
    skills: list[SkillChoice] = Field(default_factory=list)
    work_types: list[str] = Field(default_factory=list)
    days: list[str] = Field(default_factory=list)
    area: str = Field(default="", max_length=80)
    city: str = Field(default="", max_length=80)


async def _member_city(user: dict) -> str:
    if not user.get("member_id"):
        return ""
    try:
        m = await _db()["members"].find_one({"_id": ObjectId(user["member_id"])},
                                            {"display_location": 1, "location": 1})
    except Exception:  # noqa: BLE001
        return ""
    return ((m or {}).get("display_location") or (m or {}).get("location") or "").split(",")[0].strip()


async def _profile_doc(uid: str) -> Optional[dict]:
    return await _db()[PROFILES_COL].find_one({"user_id": uid})


def _test_category(skill: str) -> str:
    """The Work category a passed test in `skill` vouches for, or ""."""
    name = " ".join(skill.split()).casefold()
    if name in _TEST_TO_CATEGORY:
        return _TEST_TO_CATEGORY[name]
    hit = skill_master.by_label(name)
    if hit:
        return hit["group"]
    for g in skill_master.groups():
        if g["label"].casefold() == name or g["key"] == name.replace(" ", "_"):
            return g["key"]
    return ""


def _verified_categories(rows: list[dict]) -> dict[str, str]:
    """category key -> the test's skill name, for her passed tests."""
    out: dict[str, str] = {}
    for r in rows:
        cat = _test_category(r.get("skill") or "")
        if cat:
            out.setdefault(cat, r.get("code", ""))
    return out


async def _profile_view(uid: str, user: dict, doc: Optional[dict]) -> dict:
    await skill_master.refresh()
    index = await _skill_index()
    proofs = _verified_categories((await verified_skills([uid])).get(uid, []))
    if doc is None:
        # First visit: the skills she picked when she joined, all switched off.
        onboarding = await _db()[PROFILES].find_one({"user_id": uid})
        picked = [k for k in (answers_of(onboarding).get("skills") or []) if isinstance(k, str)]
        doc = {"skills": [{"key": k, "level": "", "visible": False} for k in picked if k in index],
               "work_types": [], "days": [], "area": "", "city": await _member_city(user), "saved": False}
    skills = []
    for s in doc.get("skills") or []:
        meta = index.get(s.get("key", ""))
        if not meta:
            continue  # retired by staff since she picked it
        skills.append({
            "key": meta["key"], "name": meta["name"], "category": meta["category"],
            "category_name": meta["category_name"], "level": s.get("level", ""),
            "visible": bool(s.get("visible")), "verified": meta["category"] in proofs,
            "image": meta["picture"],
        })
    return {
        "skills": skills,
        "work_types": doc.get("work_types") or [],
        "days": doc.get("days") or [],
        "area": doc.get("area", ""),
        "city": doc.get("city", ""),
        "saved": doc.get("saved", True),
        "shown_for": sum(1 for s in skills if s["visible"]),
        "levels": [{"key": k, "label": v} for k, v in LEVELS.items()],
        "work_type_options": list(WORK_TYPES),
        "day_options": list(DAYS),
    }


@router.get("/profile", summary="My work profile")
async def get_profile(me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    return await _profile_view(uid, me, await _profile_doc(uid))


@router.put("/profile", summary="Save my work profile")
async def put_profile(body: WorkProfileIn, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    index = await _skill_index()
    seen: set[str] = set()
    skills = []
    for s in body.skills:
        if s.key in seen:
            continue
        if s.key not in index:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "One of those skills is no longer offered. Pick it again.")
        if s.level and s.level not in LEVELS:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Pick how long you have done it from the list.")
        seen.add(s.key)
        skills.append({"key": s.key, "level": s.level, "visible": s.visible,
                       "category": index[s.key]["category"]})
    if len(skills) > MAX_SKILLS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Up to {MAX_SKILLS} skills.")
    doc = {
        "user_id": uid,
        "skills": skills,
        "work_types": [w for w in body.work_types if w in WORK_TYPES],
        "days": [d for d in body.days if d in DAYS],
        "area": " ".join(body.area.split()),
        "city": " ".join(body.city.split()),
        "saved": True,
        "updated_at": _now(),
    }
    await _db()[PROFILES_COL].update_one(
        {"user_id": uid}, {"$set": doc, "$setOnInsert": {"created_at": _now(), "blocked": []}}, upsert=True)
    return await _profile_view(uid, me, await _profile_doc(uid))


# ── find people ────────────────────────────────────────────────────────────

@router.get("/talent", summary="Women who opted in for these skills")
async def find_talent(
    category: str = Query("", max_length=64),
    skills: str = Query("", max_length=800, description="Comma-separated skill keys"),
    city: str = Query("", max_length=80),
    work_type: str = Query("", max_length=20),
    level: str = Query("", max_length=10),
    verified_only: bool = Query(False),
    page: int = Query(1, ge=1, le=50),
    me: dict = Depends(require_active_member),
):
    uid = str(me["_id"])
    index = await _skill_index()
    wanted = [k for k in (x.strip() for x in skills.split(",")) if k in index]
    if not wanted and category:
        wanted = [k for k, s in index.items() if s["category"] == category]
    if not wanted:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Pick a category or at least one skill.")

    q: dict = {
        "user_id": {"$ne": uid},
        "blocked": {"$ne": uid},  # she said "not interested" to this person
        "skills": {"$elemMatch": {"key": {"$in": wanted}, "visible": True}},
    }
    if work_type in WORK_TYPES:
        q["work_types"] = work_type
    if city.strip():
        rx = {"$regex": re.escape(city.strip()), "$options": "i"}
        q["$or"] = [{"city": rx}, {"area": rx}]
    docs = await _db()[PROFILES_COL].find(q).sort("updated_at", -1).to_list(400)

    min_rank = _LEVEL_RANK.get(level, -1)
    ids = [d["user_id"] for d in docs]
    users = {str(u["_id"]): u for u in await _db()["users"].find(
        {"_id": {"$in": [ObjectId(i) for i in ids if ObjectId.is_valid(i)]},
         "verification_status": "active"},
        {"full_name": 1, "avatar": 1}).to_list(400)}
    proofs = await verified_skills(list(users))
    open_threads = {c["with_user_id"]: str(c["_id"]) async for c in _db()[Conv.collection_name].find(
        {"member_id": uid, "kind": Conv.KIND_WORK, "with_user_id": {"$in": list(users)}},
        {"with_user_id": 1})}

    results = []
    await skill_master.refresh()
    for d in docs:
        u = users.get(d["user_id"])
        if not u:
            continue  # no longer an active member
        cats = _verified_categories(proofs.get(d["user_id"], []))
        matched = []
        for s in d.get("skills") or []:
            meta = index.get(s.get("key", ""))
            if not meta or not s.get("visible") or s["key"] not in wanted:
                continue
            if min_rank >= 0 and _LEVEL_RANK.get(s.get("level", ""), -1) < min_rank:
                continue
            matched.append({"key": meta["key"], "name": meta["name"], "level": LEVELS.get(s.get("level", ""), ""),
                            "verified": meta["category"] in cats, "image": meta["picture"]})
        if not matched:
            continue
        if verified_only and not any(m["verified"] for m in matched):
            continue
        # Other skills she is happy to be found for — never the hidden ones.
        also = [index[s["key"]]["name"] for s in d.get("skills") or []
                if s.get("visible") and s.get("key") in index and s["key"] not in wanted][:4]
        results.append({
            "user_id": d["user_id"],
            "first_name": (u.get("full_name") or "A member").split()[0],
            "avatar": media_url(u.get("avatar", "")),
            "area": d.get("area", ""),
            "city": d.get("city", ""),
            "skills": matched,
            "also": also,
            "work_types": d.get("work_types") or [],
            "days": d.get("days") or [],
            "verified": any(m["verified"] for m in matched),
            "conversation_id": open_threads.get(d["user_id"], ""),
        })
    results.sort(key=lambda r: (not r["verified"], -len(r["skills"])))
    size = 24
    shown = results[(page - 1) * size: page * size]
    await _attach_work(shown, {index[k]["category"] for k in wanted if k in index})
    done = await work_done.counts_for([r["user_id"] for r in shown])
    for r in shown:
        r["jobs_done"] = done.get(r["user_id"], {}).get("done", 0)
        r["jobs_confirmed"] = done.get(r["user_id"], {}).get("confirmed", 0)
    return {"total": len(results), "page": page, "results": shown}


async def _attach_work(rows: list[dict], categories: set[str]) -> None:
    """
    Her own photos of work she finished — the pieces she switched to shown in
    her portfolio (routes/portfolio.py), never the hidden ones. Up to four per
    card, the ones in the kind of work being searched for first: a photo of a
    blouse she stitched says more to someone hiring a tailor than any stock
    picture, and more than any line she could write.
    """
    if not rows:
        return
    from app.routes.portfolio import COLLECTION as PORTFOLIO
    ids = [r["user_id"] for r in rows]
    by_user: dict[str, list[dict]] = {}
    async for d in _db()[PORTFOLIO].find({"user_id": {"$in": ids}, "visible": True},
                                         {"user_id": 1, "photo": 1, "title": 1, "category": 1}).sort("created_at", -1):
        by_user.setdefault(d["user_id"], []).append(d)
    for r in rows:
        pieces = sorted(by_user.get(r["user_id"], []), key=lambda d: d.get("category") not in categories)
        r["work"] = [{"photo": media_url(d.get("photo", "")), "title": d.get("title", "")} for d in pieces[:4]]
        r["work_count"] = len(pieces)


class StartChat(BaseModel):
    # "hi" is how most chats start; the tap-to-add lines carry the detail.
    text: str = Field(min_length=2, max_length=1000)
    skills: list[str] = Field(default_factory=list, max_length=10)


@router.post("/talent/{user_id}/message", status_code=status.HTTP_201_CREATED, summary="Message her about work")
async def message_talent(user_id: str, body: StartChat, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    if user_id == uid:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That is your own profile.")
    prof = await _profile_doc(user_id)
    if not prof or not any(s.get("visible") for s in prof.get("skills") or []):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "She is not looking for work right now.")
    if uid in (prof.get("blocked") or []):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "She is not looking for this work right now.")
    her = await _db()["users"].find_one({"_id": ObjectId(user_id), "verification_status": "active"},
                                        {"full_name": 1, "avatar": 1})
    if not her:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "She is not looking for work right now.")

    existing = await _db()[Conv.collection_name].find_one(
        {"member_id": uid, "with_user_id": user_id, "kind": Conv.KIND_WORK})
    if existing and existing.get("closed"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "She is not looking for this work right now.")
    if not existing:
        since = _now() - timedelta(days=1)
        opened = await _db()[Conv.collection_name].count_documents(
            {"member_id": uid, "kind": Conv.KIND_WORK, "party.role": "Can do the work", "created_at": {"$gte": since}})
        if opened >= NEW_CHATS_PER_DAY:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                                f"You can start {NEW_CHATS_PER_DAY} new conversations a day. Try again tomorrow.")

    index = await _skill_index()
    about = ", ".join(index[k]["name"] for k in body.skills if k in index) or "Work"
    return await _open_work_chat(me, user_id, body.text.strip(), about)


async def _open_work_chat(me: dict, other_id: str, text: str, about: str, *,
                          me_role: str = "Can do the work", other_role: str = "Looking to hire") -> dict:
    """
    The two-sided work thread between `me` and `other_id`, with `text` as the
    newest message. `me_role` is what the OTHER person is to me ("Can do the
    work"); `other_role` is what I am to her. Refuses a thread she closed.
    """
    uid = str(me["_id"])
    other = await _db()["users"].find_one({"_id": ObjectId(other_id), "verification_status": "active"},
                                          {"full_name": 1, "avatar": 1})
    if not other:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That member is not available.")
    existing = await _db()[Conv.collection_name].find_one(
        {"member_id": uid, "with_user_id": other_id, "kind": Conv.KIND_WORK})
    if existing and existing.get("closed"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This conversation is closed.")
    at = _now()
    my_name = me.get("full_name", "") or "A WomSakhi member"
    other_name = other.get("full_name") or "A WomSakhi member"
    theirs = await _db()[Conv.collection_name].find_one_and_update(
        {"member_id": other_id, "with_user_id": uid, "kind": Conv.KIND_WORK},
        {"$setOnInsert": Conv.create_document(
            member_id=other_id, kind=Conv.KIND_WORK, name=my_name, avatar=me.get("avatar", "") or "",
            subtitle=f"Work: {about}", with_user_id=uid, party={"role": other_role},
        )},
        upsert=True, return_document=True,
    )
    ours = await _db()[Conv.collection_name].find_one_and_update(
        {"member_id": uid, "with_user_id": other_id, "kind": Conv.KIND_WORK},
        {"$setOnInsert": Conv.create_document(
            member_id=uid, kind=Conv.KIND_WORK, name=other_name, avatar=other.get("avatar", "") or "",
            subtitle=f"Work: {about}", with_user_id=other_id, party={"role": me_role},
        )},
        upsert=True, return_document=True,
    )
    bubble = Conv.bubble(direction="out", text=text, at=at)
    await asyncio.gather(
        _db()[Conv.collection_name].update_one(
            {"_id": theirs["_id"]},
            {"$push": {"messages": Conv.bubble(direction="in", text=text, at=at, bubble_id=bubble["id"])},
             "$set": {"counterpart_id": str(ours["_id"]), "updated_at": at}}),
        _db()[Conv.collection_name].update_one(
            {"_id": ours["_id"]},
            {"$push": {"messages": bubble}, "$set": {"counterpart_id": str(theirs["_id"]), "updated_at": at}}),
    )
    await notify(
        _db(), other_id,
        title=f"{my_name.split()[0]} wants to talk about work: {about}",
        body=text[:140], ntype=MemberNotificationModel.TYPE_MESSAGE, href="/app/messages",
    )
    return {"conversation_id": str(ours["_id"]), "delivered_to": other_name.split()[0]}


async def _work_thread(conversation_id: str, uid: str) -> dict:
    try:
        doc = await _db()[Conv.collection_name].find_one(
            {"_id": ObjectId(conversation_id), "member_id": uid, "kind": Conv.KIND_WORK})
    except Exception:  # noqa: BLE001
        doc = None
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    return doc


async def _say(doc: dict, text: str) -> None:
    """Her message into her copy and its twin, like `me_messages.send`."""
    b = Conv.bubble(direction="out", text=text)
    await _db()[Conv.collection_name].update_one(
        {"_id": doc["_id"]}, {"$push": {"messages": b}, "$set": {"updated_at": b["at"]}})
    if doc.get("counterpart_id"):
        await _db()[Conv.collection_name].update_one(
            {"_id": ObjectId(doc["counterpart_id"])},
            {"$push": {"messages": Conv.bubble(direction="in", text=text, at=b["at"], bubble_id=b["id"])},
             "$set": {"updated_at": b["at"]}})


@router.post("/conversations/{conversation_id}/share-number", summary="Send my phone number into this chat")
async def share_number(conversation_id: str, me: dict = Depends(require_active_member)):
    doc = await _work_thread(conversation_id, str(me["_id"]))
    if doc.get("closed"):
        raise HTTPException(status.HTTP_409_CONFLICT, "This conversation is closed.")
    phone = (me.get("phone") or "").strip()
    if not phone:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Add your mobile number in My details first.")
    await _say(doc, f"My number is {phone}. You can call or WhatsApp me.")
    return {"ok": True}


@router.post("/conversations/{conversation_id}/not-interested", summary="Close this chat and stay hidden from them")
async def not_interested(conversation_id: str, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    doc = await _work_thread(conversation_id, uid)
    if not doc.get("closed"):
        await _say(doc, "Thank you, but I am not interested in this work. This chat is now closed.")
    other_id = doc.get("with_user_id", "")
    ids = [doc["_id"]] + ([ObjectId(doc["counterpart_id"])] if doc.get("counterpart_id") else [])
    await asyncio.gather(
        _db()[Conv.collection_name].update_many({"_id": {"$in": ids}}, {"$set": {"closed": True}}),
        _db()[PROFILES_COL].update_one({"user_id": uid}, {"$addToSet": {"blocked": other_id}}, upsert=True),
    )
    return {"ok": True}


# ── staff: the masters ─────────────────────────────────────────────────────

# `image`: an upload or a picture from the app's own library; "" goes back to
# the automatic one (members' screens pick it from the name).

class CategoryIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    image: MediaRefOptional = Field(default=None, max_length=500)


class CategoryPatch(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=60)
    active: Optional[bool] = None
    sort: Optional[int] = Field(default=None, ge=0, le=10000)
    image: MediaRefOptional = Field(default=None, max_length=500)


class SkillIn(BaseModel):
    category: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=2, max_length=60)
    popular: bool = False
    image: MediaRefOptional = Field(default=None, max_length=500)


class SkillPatch(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=60)
    category: Optional[str] = Field(default=None, min_length=1, max_length=64)
    active: Optional[bool] = None
    popular: Optional[bool] = None
    sort: Optional[int] = Field(default=None, ge=0, le=10000)
    image: MediaRefOptional = Field(default=None, max_length=500)


def _exact(name: str) -> dict:
    return {"$regex": f"^{re.escape(' '.join(name.split()))}$", "$options": "i"}


@admin_router.get("/taxonomy", dependencies=[Depends(require_permission("growth.view"))])
async def admin_taxonomy(_: dict = Depends(get_current_user)):
    cats, skills = await _masters(include_inactive=True)
    rows = await _db()[PROFILES_COL].aggregate([
        {"$unwind": "$skills"},
        {"$group": {"_id": "$skills.key", "members": {"$sum": 1},
                    "shown": {"$sum": {"$cond": ["$skills.visible", 1, 0]}}}},
    ]).to_list(None)
    use = {r["_id"]: r for r in rows}
    by_cat: dict[str, list[dict]] = {}
    for s in skills:
        u = use.get(s["key"], {})
        by_cat.setdefault(s["category"], []).append({
            "key": s["key"], "name": s["name"], "active": s.get("active", True),
            "popular": bool(s.get("popular")), "sort": s.get("sort", 0), "image": media_url(s.get("image")),
            "members": u.get("members", 0), "shown": u.get("shown", 0),
        })
    return {"categories": [{
        "key": c["key"], "name": c["name"], "active": c.get("active", True), "sort": c.get("sort", 0),
        "image": media_url(c.get("image")),
        "skills": by_cat.get(c["key"], []),
        "members": sum(s["members"] for s in by_cat.get(c["key"], [])),
    } for c in cats]}


@admin_router.post("/categories", status_code=201, dependencies=[Depends(require_permission("growth.create"))])
async def add_category(body: CategoryIn, request: Request, user: dict = Depends(get_current_user)):
    await _ensure_seeded()
    name = " ".join(body.name.split())
    if await _db()[CATEGORIES].find_one({"name": _exact(name)}):
        raise HTTPException(status.HTTP_409_CONFLICT, "A category with that name already exists.")
    key = _slug(name) or "category"
    while await _db()[CATEGORIES].find_one({"key": key}):
        key += "_x"
    last = await _db()[CATEGORIES].find_one(sort=[("sort", -1)])
    await _db()[CATEGORIES].insert_one({"key": key, "name": name, "sort": (last or {}).get("sort", 0) + 1,
                                        "image": body.image or "", "active": True, "created_at": _now(), "updated_at": _now()})
    await record(user, "work.category.add", target=key, detail=name, request=request)
    skill_master.forget()  # onboarding offers the change at once
    return {"key": key}


@admin_router.patch("/categories/{key}", dependencies=[Depends(require_permission("growth.edit"))])
async def edit_category(key: str, body: CategoryPatch, request: Request, user: dict = Depends(get_current_user)):
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    if "name" in patch:
        patch["name"] = " ".join(patch["name"].split())
        if await _db()[CATEGORIES].find_one({"name": _exact(patch["name"]), "key": {"$ne": key}}):
            raise HTTPException(status.HTTP_409_CONFLICT, "A category with that name already exists.")
    res = await _db()[CATEGORIES].update_one({"key": key}, {"$set": {**patch, "updated_at": _now()}})
    if not res.matched_count:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    await record(user, "work.category.edit", target=key, detail=str(patch), request=request)
    skill_master.forget()  # onboarding offers the change at once
    return {"ok": True}


@admin_router.post("/skills", status_code=201, dependencies=[Depends(require_permission("growth.create"))])
async def add_skill(body: SkillIn, request: Request, user: dict = Depends(get_current_user)):
    await _ensure_seeded()
    if not await _db()[CATEGORIES].find_one({"key": body.category}):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    name = " ".join(body.name.split())
    if await _db()[SKILLS].find_one({"category": body.category, "name": _exact(name)}):
        raise HTTPException(status.HTTP_409_CONFLICT, "That skill is already in this category.")
    key = _slug(name) or "skill"
    while await _db()[SKILLS].find_one({"key": key}):
        key += "_x"
    last = await _db()[SKILLS].find_one({"category": body.category}, sort=[("sort", -1)])
    await _db()[SKILLS].insert_one({"key": key, "name": name, "category": body.category,
                                    "sort": (last or {}).get("sort", 0) + 1, "popular": body.popular,
                                    "image": body.image or "", "active": True, "created_at": _now(), "updated_at": _now()})
    await record(user, "work.skill.add", target=key, detail=name, request=request)
    skill_master.forget()  # onboarding offers the change at once
    return {"key": key}


@admin_router.patch("/skills/{key}", dependencies=[Depends(require_permission("growth.edit"))])
async def edit_skill(key: str, body: SkillPatch, request: Request, user: dict = Depends(get_current_user)):
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    if "category" in patch and not await _db()[CATEGORIES].find_one({"key": patch["category"]}):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    if "name" in patch:
        patch["name"] = " ".join(patch["name"].split())
    res = await _db()[SKILLS].update_one({"key": key}, {"$set": {**patch, "updated_at": _now()}})
    if not res.matched_count:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Skill not found")
    if "category" in patch:
        # Her profile stores the category beside each key, for the search index.
        await _db()[PROFILES_COL].update_many(
            {"skills.key": key}, {"$set": {"skills.$[s].category": patch["category"]}},
            array_filters=[{"s.key": key}])
    await record(user, "work.skill.edit", target=key, detail=str(patch), request=request)
    skill_master.forget()  # onboarding offers the change at once
    return {"ok": True}


# ── jobs on the same masters ───────────────────────────────────────────────
#
# Find work (routes/growth.py) and the staff job form (routes/admin_growth.py)
# use these helpers, so a job's skills are the same keys a woman's profile has.

async def resolve_job_skills(category: str, keys: list[str]) -> tuple[str, list[str], list[str]]:
    """(category, skill keys, skill names) — validated against the masters."""
    index = await _skill_index()
    keys = [k for k in dict.fromkeys(keys) if k in index][:10]
    if keys and not category:
        category = index[keys[0]]["category"]
    return category, keys, [index[k]["name"] for k in keys]


async def category_names() -> dict[str, str]:
    cats, _ = await _masters(include_inactive=True)
    return {c["key"]: c["name"] for c in cats}


async def my_skill_map(uid: str) -> dict[str, dict]:
    """Her listed skills by key — hidden ones too: her own matching is private."""
    doc = await _profile_doc(uid)
    if not doc:
        onboarding = await _db()[PROFILES].find_one({"user_id": uid})
        doc = {"skills": [{"key": k, "level": ""} for k in (answers_of(onboarding).get("skills") or [])
                          if isinstance(k, str)]}
    index = await _skill_index()
    await skill_master.refresh()
    proofs = _verified_categories((await verified_skills([uid])).get(uid, []))
    return {s["key"]: {"key": s["key"], "name": index[s["key"]]["name"],
                       "level": LEVELS.get(s.get("level", ""), ""),
                       "verified": index[s["key"]]["category"] in proofs}
            for s in doc.get("skills") or [] if s.get("key") in index}


def match_for(job_keys: list[str], job_names: list[str], mine: dict[str, dict]) -> dict:
    names = dict(zip(job_keys, job_names))
    have = [mine[k] for k in job_keys if k in mine]
    return {
        "have": [h["name"] for h in have],
        "missing": [names.get(k, k) for k in job_keys if k not in mine],
        "verified": [h["name"] for h in have if h["verified"]],
        "of": len(job_keys),
    }


_backfilled = False


async def backfill_job_skill_keys() -> None:
    """Older jobs had only typed skills; give them keys where a name matches. Once per process."""
    global _backfilled
    if _backfilled:
        return
    _backfilled = True
    _, skills = await _masters(include_inactive=True)
    by_name = {s["name"].casefold(): s for s in skills}
    col = _db()["opportunities"]
    async for d in col.find({"skill_keys": {"$exists": False}}, {"skills": 1}):
        hits = [by_name[n.strip().casefold()] for n in d.get("skills") or [] if n.strip().casefold() in by_name]
        await col.update_one({"_id": d["_id"]}, {"$set": {
            "skill_keys": [h["key"] for h in hits],
            "category": hits[0]["category"] if hits else "",
            "owner_kind": "staff",
        }})


async def notify_matching_women(job: dict, exclude: str = "") -> int:
    """'New work for your skills' to women who listed one AND allow job updates."""
    keys = job.get("skill_keys") or []
    if not keys:
        return 0
    profiles = await _db()[PROFILES_COL].find(
        {"skills.key": {"$in": keys}, "user_id": {"$ne": exclude}}, {"user_id": 1}).to_list(500)
    if not profiles:
        return 0
    consent = {p["user_id"] async for p in _db()[PROFILES].find(
        {"user_id": {"$in": [p["user_id"] for p in profiles]}, "consents.job_updates.granted": True},
        {"user_id": 1})}
    sent = 0
    for p in profiles:
        if p["user_id"] not in consent:
            continue
        await notify(
            _db(), p["user_id"],
            title=f"New work for your skills: {job.get('title', '')}",
            body=", ".join(job.get("skills") or [])[:140],
            ntype="opportunity", href=f"/app/opportunities/{job['_id']}",
        )
        sent += 1
    return sent


class JobIn(BaseModel):
    title: str = Field(min_length=4, max_length=100)
    category: str = Field(default="", max_length=64)
    skill_keys: list[str] = Field(min_length=1, max_length=10)
    kind: str = Field(default="Job", max_length=20)
    mode: str = Field(default="On-site", max_length=20)
    location: str = Field(default="", max_length=80)
    pay: str = Field(default="", max_length=80)
    openings: int = Field(default=1, ge=1, le=500)
    deadline: str = Field(default="", max_length=10)
    desc: str = Field(default="", max_length=2000)
    experience: str = Field(default="", max_length=40)


MAX_OPEN_POSTS = 5
_JOB_MODES = ("On-site", "Remote", "Hybrid")


async def _my_job(job_id: str, uid: str) -> dict:
    try:
        doc = await _db()["opportunities"].find_one({"_id": ObjectId(job_id), "owner_id": uid})
    except Exception:  # noqa: BLE001
        doc = None
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That job post isn't yours or doesn't exist.")
    return doc


async def _job_fields(body: JobIn, current: Optional[dict] = None) -> dict:
    category, keys, names = await resolve_job_skills(body.category, body.skill_keys)
    # The type comes from the `opportunity_types` master. A post keeping the
    # type it already has is not re-checked, so disabling a type never blocks
    # editing what was posted under it.
    kind = (body.kind or "Job").strip()
    if not (current and kind.lower() == (current.get("kind") or "").lower()):
        kind = await masters.check("opportunity_types", kind, field="type of work")
    if not keys:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Pick at least one skill from the list.")
    if body.deadline and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", body.deadline):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Pick the last date from the calendar.")
    return {"title": " ".join(body.title.split()), "category": category, "skill_keys": keys, "skills": names,
            "kind": kind,
            "mode": body.mode if body.mode in _JOB_MODES else "On-site",
            "location": body.location.strip(), "pay": body.pay.strip(), "openings": body.openings,
            "deadline": body.deadline, "desc": body.desc.strip(), "experience": body.experience.strip()}


def _job_row(d: dict, applicants: int, cats: dict[str, str]) -> dict:
    from app.models.growth import OpportunityModel
    return {**OpportunityModel.to_response(d), "applicant_count": applicants,
            "category_name": cats.get(d.get("category", ""), "")}


@router.post("/jobs", status_code=201, summary="Post a job (verified members)")
async def post_job(body: JobIn, me: dict = Depends(require_active_member)):
    from app.models.growth import OpportunityModel
    uid = str(me["_id"])
    if await _db()["opportunities"].count_documents({"owner_id": uid, "status": "open"}) >= MAX_OPEN_POSTS:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            f"You can have {MAX_OPEN_POSTS} open job posts. Close one to post another.")
    f = await _job_fields(body)
    doc = OpportunityModel.create_document(
        title=f["title"], org=me.get("full_name", "") or "A WomSakhi member", kind=f["kind"], desc=f["desc"],
        location=f["location"], mode=f["mode"], pay=f["pay"], skills=f["skills"], openings=f["openings"],
        deadline=f["deadline"], experience=f["experience"],
        contact_note="Apply here. She will message you in WomSakhi.",
        category=f["category"], skill_keys=f["skill_keys"], owner_kind="member", owner_id=uid,
    )
    doc["_id"] = (await _db()["opportunities"].insert_one(doc)).inserted_id
    await notify_matching_women(doc, exclude=uid)
    return _job_row(doc, 0, await category_names())


@router.get("/jobs/mine", summary="My job posts")
async def my_jobs(me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    docs = await _db()["opportunities"].find({"owner_id": uid}).sort("created_at", -1).to_list(100)
    counts = {r["_id"]: r["n"] for r in await _db()["applications"].aggregate([
        {"$match": {"opportunity_id": {"$in": [str(d["_id"]) for d in docs]}, "status": {"$ne": "withdrawn"}}},
        {"$group": {"_id": "$opportunity_id", "n": {"$sum": 1}}}]).to_list(None)}
    cats = await category_names()
    return [_job_row(d, counts.get(str(d["_id"]), 0), cats) for d in docs]


@router.put("/jobs/{job_id}", summary="Edit my job post")
async def edit_job(job_id: str, body: JobIn, me: dict = Depends(require_active_member)):
    from app.models.growth import parse_pay
    doc = await _my_job(job_id, str(me["_id"]))
    f = await _job_fields(body, doc)
    low, high, period = parse_pay(f["pay"])
    await _db()["opportunities"].update_one({"_id": doc["_id"]}, {"$set": {
        **f, "pay_low_minor": low, "pay_high_minor": high, "pay_period": period, "updated_at": _now()}})
    await _db()["applications"].update_many({"opportunity_id": job_id}, {"$set": {"opportunity_title": f["title"]}})
    return _job_row(await _db()["opportunities"].find_one({"_id": doc["_id"]}), 0, await category_names())


@router.post("/jobs/{job_id}/{action}", summary="Close or reopen my job post")
async def set_job_status(job_id: str, action: str, me: dict = Depends(require_active_member)):
    if action not in ("close", "reopen"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown action")
    uid = str(me["_id"])
    doc = await _my_job(job_id, uid)
    if action == "reopen" and await _db()["opportunities"].count_documents({"owner_id": uid, "status": "open"}) >= MAX_OPEN_POSTS:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, f"You can have {MAX_OPEN_POSTS} open job posts.")
    await _db()["opportunities"].update_one(
        {"_id": doc["_id"]}, {"$set": {"status": "closed" if action == "close" else "open", "updated_at": _now()}})
    return {"ok": True}


@router.get("/jobs/{job_id}/applicants", summary="Who applied to my job post")
async def job_applicants(job_id: str, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    await _my_job(job_id, uid)
    apps = await _db()["applications"].find(
        {"opportunity_id": job_id, "status": {"$ne": "withdrawn"}}).sort("created_at", -1).to_list(500)
    ids = [a["user_id"] for a in apps]
    users = {str(u["_id"]): u for u in await _db()["users"].find(
        {"_id": {"$in": [ObjectId(i) for i in ids if ObjectId.is_valid(i)]}}, {"full_name": 1, "avatar": 1}).to_list(500)}
    profiles = {p["user_id"]: p for p in await _db()[PROFILES_COL].find(
        {"user_id": {"$in": ids}}, {"user_id": 1, "area": 1, "city": 1}).to_list(500)}
    threads = {c["with_user_id"]: str(c["_id"]) async for c in _db()[Conv.collection_name].find(
        {"member_id": uid, "kind": Conv.KIND_WORK, "with_user_id": {"$in": ids}}, {"with_user_id": 1})}
    out = []
    for a in apps:
        u, pr = users.get(a["user_id"], {}), profiles.get(a["user_id"], {})
        created = a.get("created_at")
        out.append({
            "application_id": str(a["_id"]), "user_id": a["user_id"],
            "first_name": (u.get("full_name") or "A member").split()[0], "avatar": media_url(u.get("avatar", "")),
            "area": pr.get("area", ""), "city": pr.get("city", ""),
            "skills": a.get("skills") or [], "note": a.get("note", ""), "status": a.get("status", "applied"),
            # Work done: confirmed by this poster, or only said by her so far.
            "done": ("confirmed" if (a.get("completion") or {}).get("confirmed") else "mine")
                    if a.get("status") == work_done.COMPLETED else "",
            "applied_on": created.strftime("%b %d, %Y") if isinstance(created, datetime) else "",
            "conversation_id": threads.get(a["user_id"], ""),
        })
    return out


class ApplicantMove(BaseModel):
    status: str = Field(pattern="^(shortlisted|interview|offered|closed|completed)$")
    note: str = Field(default="", max_length=500)
    #: Work done only: how it went, in stars and taps (app/core/work_done.py).
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    praise: list[str] = Field(default_factory=list, max_length=5)


async def _my_application(app_id: str, uid: str) -> tuple[dict, dict]:
    try:
        app = await _db()["applications"].find_one({"_id": ObjectId(app_id)})
    except Exception:  # noqa: BLE001
        app = None
    if not app:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    job = await _my_job(app["opportunity_id"], uid)
    return app, job


@router.post("/applications/{app_id}/move", summary="Shortlist, interview, offer or say no")
async def move_applicant(app_id: str, body: ApplicantMove, me: dict = Depends(require_active_member)):
    app, job = await _my_application(app_id, str(me["_id"]))
    if app.get("status") == "withdrawn":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "She withdrew this application.")
    if body.status == "closed" and not body.note.strip():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Say why, kindly — tap a reason.")
    if body.status == work_done.COMPLETED:
        if not work_done.can_finish(app):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Offer her the work first; mark it done once she has done it.")
        await work_done.mark_done(app, by="employer", by_name=me.get("full_name", ""),
                                  rating=body.rating, praise=body.praise, note=body.note)
        await notify(_db(), app["user_id"], title="Your work was confirmed",
                     body=f"{job.get('org') or job.get('title', '')} confirmed the work is done. It is on your work profile now.",
                     ntype="opportunity", href="/app/work/profile")
        return {"ok": True}
    at = _now()
    await _db()["applications"].update_one({"_id": app["_id"]}, {
        "$set": {"status": body.status, "staff_note": body.note.strip(), "updated_at": at},
        "$push": {"history": {"status": body.status, "at": at, "by": me.get("full_name", ""), "note": body.note.strip()}}})
    heads = {"shortlisted": "You've been shortlisted", "interview": "They'd like to talk to you",
             "offered": "You have an offer", "closed": "About your application"}
    await notify(_db(), app["user_id"], title=heads[body.status],
                 body=body.note.strip() or f"{job.get('title', '')} — posted by {job.get('org', '')}.",
                 ntype="opportunity", href="/app/applications")
    return {"ok": True}


@router.post("/my-applications/{app_id}/done", summary="I finished this work")
async def i_finished(app_id: str, me: dict = Depends(require_active_member)):
    """
    She says the work is done. It shows on her profile as hers to claim until
    whoever posted the work confirms it — and they are asked to.
    """
    uid = str(me["_id"])
    try:
        app = await _db()["applications"].find_one({"_id": ObjectId(app_id), "user_id": uid})
    except Exception:  # noqa: BLE001
        app = None
    if not app:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    if app.get("status") != "offered":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can mark work done once you have been offered it.")
    await work_done.mark_done(app, by="worker", by_name=me.get("full_name", ""))
    job = await _db()["opportunities"].find_one({"_id": ObjectId(app["opportunity_id"])}, {"owner_id": 1, "title": 1}) \
        if ObjectId.is_valid(app.get("opportunity_id", "")) else None
    if job and job.get("owner_id"):
        first = (me.get("full_name") or "She").split()[0]
        await notify(_db(), job["owner_id"], title=f"{first} says the work is done",
                     body=f"{job.get('title', 'Your job')}: confirm it, so it counts on her work profile.",
                     ntype="opportunity", href="/app/work/posts")
    return {"ok": True}


@router.get("/history", summary="My work done through WomSakhi")
async def my_work_history(me: dict = Depends(require_member_account)):
    return {"items": await work_done.history_for(str(me["_id"])), "praise": list(work_done.PRAISE)}


@router.post("/applications/{app_id}/message", status_code=201, summary="Message someone who applied")
async def message_applicant(app_id: str, body: StartChat, me: dict = Depends(require_active_member)):
    app, job = await _my_application(app_id, str(me["_id"]))
    prof = await _profile_doc(app["user_id"]) or {}
    if str(me["_id"]) in (prof.get("blocked") or []):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "She is not looking for this work right now.")
    # She applied, so she asked to be contacted about this job.
    return await _open_work_chat(me, app["user_id"], body.text.strip(), job.get("title", "Work"))
