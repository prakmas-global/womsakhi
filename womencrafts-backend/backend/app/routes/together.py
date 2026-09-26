"""
Women helping women — assisting, teaching, and who is nearby.

── Three collections, all of them relationships ────────────────────────────
`assisting`  — a woman she helps use the app, and the consent that permits it
`tasks`      — what that woman needs done, waiting for her
`lessons`    — a skill she will teach, or one she wants to learn

Every one of these used to be written into the screen. "Lakshmi Bai, since
March, cannot read the screen, consent given 12 March, 34 things done, ₹680
earned." A named woman, a recorded consent, and a running total — shown to
everybody, none of it real.

── Consent is a record, not a checkbox ─────────────────────────────────────
Assisting means one woman operating the app as another. That is the most
dangerous permission in this product: it is exactly what financial abuse looks
like when it is not consented to. So `consent_on` is written once when the
woman being helped agrees, it is shown on both their screens, and either of
them can end it. The fixture had four such consents already granted, dated,
and attributed to women who did not exist.
"""

from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.rbac import require_active_member
from app.db.mongodb import get_database
from app.models.community import CircleMemberModel

router = APIRouter(prefix="/me/together", tags=["Member · Community"])

ASSISTING = "assist_links"
TASKS = "assist_tasks"
LESSONS = "lessons"


class AssistIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    because: str = Field(default="", max_length=120)
    owns_phone: bool = False
    #: Only ever true when the woman being helped has actually said yes.
    consented: bool = False


class TaskIn(BaseModel):
    link_id: str
    what: str = Field(min_length=1, max_length=160)
    urgent: bool = False


class LessonIn(BaseModel):
    what: str = Field(min_length=1, max_length=120)
    pays_in: str = Field(default="", max_length=40)
    icon: str = "Sparkles"
    tint: str = "--ux-tint-pink"
    ink: str = "--ux-pink-ink"


def _links():
    return get_database()[ASSISTING]


def _tasks():
    return get_database()[TASKS]


def _lessons():
    return get_database()[LESSONS]


def _oid(v: str, what: str) -> ObjectId:
    try:
        return ObjectId(v)
    except (InvalidId, TypeError):
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No such {what}")


@router.get("", summary="Who she helps, what is waiting, and what she teaches")
async def get_together(me: dict = Depends(require_active_member)):
    uid = str(me["_id"])

    links = []
    # A link safety staff revoked is over: it leaves her screen along with its tasks.
    async for d in _links().find({"user_id": uid, "revoked_at": None}).sort("created_at", 1):
        consent = d.get("consent_on")
        links.append({
            "id": str(d["_id"]),
            "name": d.get("name", ""),
            "because": d.get("because", ""),
            "owns_phone": bool(d.get("owns_phone", False)),
            "since": d.get("created_at").strftime("%B") if isinstance(d.get("created_at"), datetime) else "",
            # Shown on the screen so she can see exactly what was agreed and when.
            "consent_on": consent.strftime("%-d %B") if isinstance(consent, datetime) else "",
            "consented": bool(consent),
            "done_count": int(d.get("done_count", 0)),
            "last_did": d.get("last_did", ""),
        })

    queue = []
    names = {l["id"]: l["name"] for l in links}
    async for t in _tasks().find({"user_id": uid, "done": {"$ne": True}}).sort("created_at", 1):
        queue.append({
            "id": str(t["_id"]),
            "link_id": t.get("link_id", ""),
            "who": names.get(t.get("link_id", ""), ""),
            "what": t.get("what", ""),
            "urgent": bool(t.get("urgent", False)),
        })
    queue.sort(key=lambda q: not q["urgent"])

    teaching = []
    async for l in _lessons().find({"user_id": uid}).sort("created_at", -1):
        teaching.append({
            "id": str(l["_id"]),
            "what": l.get("what", ""),
            "from": l.get("from_name", ""),
            "pays_in": l.get("pays_in", ""),
            "learners": int(l.get("learners", 0)),
            "icon": l.get("icon", "Sparkles"),
            "tint": l.get("tint", "--ux-tint-pink"),
            "ink": l.get("ink", "--ux-pink-ink"),
            "mine": True,
        })

    return {
        "helping": links,
        "queue": queue,
        "teaching": teaching,
        "helped_count": len(links),
        # Only consented links count. An un-consented one is a draft, and
        # counting it would be counting a permission nobody gave.
        "consented_count": sum(1 for l in links if l["consented"]),
        "waiting": len(queue),
    }


@router.post("/helping", status_code=status.HTTP_201_CREATED, summary="Start helping someone")
async def add_link(body: AssistIn, me: dict = Depends(require_active_member)):
    now = datetime.now(timezone.utc)
    await _links().insert_one({
        "user_id": str(me["_id"]),
        "name": body.name.strip(), "because": body.because.strip(),
        "owns_phone": body.owns_phone,
        # Written only when she says the other woman has agreed.
        "consent_on": now if body.consented else None,
        "done_count": 0, "last_did": "",
        "created_at": now, "updated_at": now,
    })
    return await get_together(me)


@router.post("/helping/{link_id}/consent", summary="Record that she agreed")
async def give_consent(link_id: str, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    res = await _links().update_one(
        {"_id": _oid(link_id, "link"), "user_id": uid},
        {"$set": {"consent_on": datetime.now(timezone.utc)}},
    )
    if not res.matched_count:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such person")
    return await get_together(me)


@router.delete("/helping/{link_id}", summary="Stop helping, and end the consent")
async def end_link(link_id: str, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    res = await _links().delete_one({"_id": _oid(link_id, "link"), "user_id": uid})
    if not res.deleted_count:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such person")
    await _tasks().delete_many({"user_id": uid, "link_id": link_id})
    return await get_together(me)


@router.post("/queue", status_code=status.HTTP_201_CREATED, summary="Something she needs doing")
async def add_task(body: TaskIn, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    if not await _links().find_one({"_id": _oid(body.link_id, "link"), "user_id": uid, "revoked_at": None}):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such person")
    now = datetime.now(timezone.utc)
    await _tasks().insert_one({
        "user_id": uid, "link_id": body.link_id, "what": body.what.strip(),
        "urgent": body.urgent, "done": False, "created_at": now,
    })
    return await get_together(me)


@router.post("/queue/{task_id}/done", summary="Mark it done")
async def finish_task(task_id: str, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    task = await _tasks().find_one({"_id": _oid(task_id, "task"), "user_id": uid})
    if not task:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such task")
    now = datetime.now(timezone.utc)
    await _tasks().update_one({"_id": task["_id"]}, {"$set": {"done": True, "done_at": now}})
    # Her running count is incremented from the work actually done, never set.
    await _links().update_one(
        {"_id": _oid(task.get("link_id", ""), "link"), "user_id": uid},
        {"$inc": {"done_count": 1}, "$set": {"last_did": task.get("what", ""), "updated_at": now}},
    )
    return await get_together(me)


@router.get("/sisters", summary="Women she shares a circle with, and what they do")
async def sisters(me: dict = Depends(require_active_member)):
    """
    Real women, from her own circles.

    The fixture here was four neighbours — "Rekha, sells vegetables, 0.4km,
    you buy from her every week and she has no one who stitches" — complete
    with a distance and a worked-out reason the two of them fit.

    Neither is computable. Nothing in this product knows how far apart two
    women live, and nothing knows that she buys vegetables from Rekha. So
    what comes back is what is true: her name, what she sells if she has a
    shop, where she says she is, and that they are in a circle together.
    """
    db = get_database()
    uid = str(me["_id"])

    circle_ids = await db[CircleMemberModel.collection_name].distinct("circle_id", {"user_id": uid})
    if not circle_ids:
        return {"sisters": [], "count": 0}

    others = await db[CircleMemberModel.collection_name].distinct(
        "user_id", {"circle_id": {"$in": circle_ids}, "user_id": {"$ne": uid}}
    )
    if not others:
        return {"sisters": [], "count": 0}

    # What each of them sells, from her listings — one pass, not one query
    # per woman.
    trades: dict[str, str] = {}
    async for row in db["shop_listings"].aggregate([
        {"$match": {"user_id": {"$in": others}}},
        {"$group": {"_id": {"u": "$user_id", "c": "$category"}, "n": {"$sum": 1}}},
        {"$sort": {"n": -1}},
    ]):
        u = row["_id"]["u"]
        if u not in trades and row["_id"].get("c"):
            trades[u] = row["_id"]["c"]

    # Fetch both collections in batches. The previous loop made two Atlas
    # round trips per woman (29 queries and ~800 ms in the seeded account).
    valid_ids: list[ObjectId] = []
    for oid in others:
        try:
            valid_ids.append(ObjectId(oid))
        except (InvalidId, TypeError):
            continue
    users = await db["users"].find({"_id": {"$in": valid_ids}}).to_list(len(valid_ids))
    emails = [u.get("email", "") for u in users if u.get("email")]
    members = await db["members"].find(
        {"email": {"$in": emails}}, {"email": 1, "location": 1, "avatar": 1}
    ).to_list(len(emails))
    member_by_email = {m.get("email", ""): m for m in members}

    rows = []
    for u in users:
        oid = str(u["_id"])
        member = member_by_email.get(u.get("email", ""), {})
        rows.append({
            "id": oid,
            "name": u.get("full_name", ""),
            # Her trade, or nothing. Never a guess.
            "trade": trades.get(oid, ""),
            "where": member.get("location", ""),
            "avatar": member.get("avatar", ""),
        })
    rows.sort(key=lambda r: (not r["trade"], r["name"]))
    return {"sisters": rows[:24], "count": len(rows)}


@router.post("/lessons", status_code=status.HTTP_201_CREATED, summary="Offer to teach something")
async def add_lesson(body: LessonIn, me: dict = Depends(require_active_member)):
    now = datetime.now(timezone.utc)
    await _lessons().insert_one({
        "user_id": str(me["_id"]),
        "from_name": me.get("full_name", ""),
        **body.model_dump(), "learners": 0, "created_at": now,
    })
    return await get_together(me)


@router.delete("/lessons/{lesson_id}", summary="Withdraw it")
async def remove_lesson(lesson_id: str, me: dict = Depends(require_active_member)):
    res = await _lessons().delete_one({"_id": _oid(lesson_id, "lesson"), "user_id": str(me["_id"])})
    if not res.deleted_count:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such lesson")
    return await get_together(me)
