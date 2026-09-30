"""
Post-signup onboarding ("Post-Auth Flow"): her answers, her consents, and what
her own WomSakhi is set up with.

The rules are in app/core/onboarding.py; this file is the HTTP surface. The
owner is always taken from the token — no endpoint accepts a user id.

Guards, and why each one:

- Answers, consents, skip, check-in, the card and My data use
  `require_member_account`: she may do all of it while she waits.
- `setup` and the item actions use `require_active_member`: they are the only
  paths that create anything in another module, and nothing is created for a
  woman who has not been admitted.
- The skills search is `require_member_account` too; it reads no personal data,
  but it is part of her flow and not a public API.
- The insights are staff only, with `analytics.view` or `users.view`, and carry
  counts alone.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from app.core import onboarding as ob
from app.core import skills as taxonomy
from app.core.audit import record
from app.core.permissions import has_permission
from app.core.rbac import require_active_member, require_member_account, require_staff
from app.db.mongodb import get_database

router = APIRouter(prefix="/me", tags=["Member · Onboarding"])
skills_router = APIRouter(prefix="/onboarding", tags=["Member · Onboarding"])
admin_router = APIRouter(prefix="/admin/onboarding", tags=["Admin · Onboarding"])


# ── shapes ──────────────────────────────────────────────────────────────────

class AnswersIn(BaseModel):
    """
    Any subset of the questions. A field left out is untouched; a field sent as
    null is a question she skipped, stored as null. One question at a time is
    fine — that is how a "Change" link on home saves.
    """

    goals: Optional[list[str]] = None
    skills: Optional[list[Any]] = None
    learn_topics: Optional[list[str]] = None
    meet: Optional[list[str]] = None
    free_times: Optional[list[str]] = None
    minutes_per_day: Optional[int] = None
    voice_prompts: Optional[bool] = None
    helper_mode: Optional[bool] = None
    shared_phone: Optional[bool] = None
    #: She reached the end of the questions.
    completed: Optional[bool] = None


class ConsentsIn(BaseModel):
    """Each purpose she answered this time: true grants, false withdraws, absent leaves it."""

    setup: Optional[bool] = None
    job_updates: Optional[bool] = None
    employer_visibility: Optional[bool] = None
    notice_version: str = Field(ob.NOTICE_VERSION, max_length=40)
    language: str = Field("", max_length=12)


class CheckinIn(BaseModel):
    still_same: bool


class KeepIn(BaseModel):
    #: For a reminder: switch it on. Off unless she says so.
    enable: bool = False


# ── helpers ─────────────────────────────────────────────────────────────────

def _uid(me: dict) -> str:
    return str(me["_id"])


def _answers_view(profile: Optional[dict]) -> dict:
    stored = ob.answers_of(profile)
    return {k: stored.get(k) for k in ob.ANSWER_KEYS}


def _item_view(item: dict, answers: dict) -> dict:
    out = {k: v for k, v in item.items() if k not in ("created_at", "proposal")}
    out["created_at"] = ob.iso(item.get("created_at"))
    out["still_chosen"] = ob.still_chosen(item, answers)
    if item.get("proposal"):
        out["proposal"] = item["proposal"]
    return out


async def _state(me: dict, profile: Optional[dict] = None) -> dict:
    uid = _uid(me)
    profile = profile if profile is not None else await ob.profile_of(uid)
    setup = await ob.setup_of(uid)
    p = profile or {}
    return {
        "answers": _answers_view(profile),
        "answered": [k for k in ob.ANSWER_KEYS if k in ob.answers_of(profile)],
        "consents": ob.consent_view(profile),
        "notice_version": ob.NOTICE_VERSION,
        "version": p.get("version", ob.QUESTIONS_VERSION),
        "offered": ob.offered(profile, me),
        "completed": bool(p.get("completed")),
        "answered_at": ob.iso(p.get("answered_at")),
        "updated_at": ob.iso(p.get("updated_at")),
        "skipped_at": ob.iso(p.get("skipped_at")),
        "last_reviewed_at": ob.iso(p.get("last_reviewed_at")),
        "checkin_due": ob.checkin_due(profile, me),
        "make_it_yours": ob.make_it_yours(profile),
        "setup": {
            # She can be set up: admitted, and she agreed to it.
            "ready": ob.is_active(me) and ob.consent_granted(profile, "setup"),
            "last_run_at": ob.iso((setup or {}).get("last_run_at")),
            "items": len((setup or {}).get("items") or []),
        },
    }


# ── her answers ─────────────────────────────────────────────────────────────

@router.get("/onboarding", summary="My onboarding answers and consents")
async def get_onboarding(me: dict = Depends(require_member_account)):
    return await _state(me)


@router.put("/onboarding", summary="Save some or all of my answers")
async def put_onboarding(body: AnswersIn, me: dict = Depends(require_member_account)):
    uid = _uid(me)
    sent = body.model_dump(include=body.model_fields_set)
    completed = sent.pop("completed", None)
    try:
        clean = ob.validate_answers(sent)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))
    if not clean and completed is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nothing to save")

    await ob.ensure_profile(uid, me.get("member_id", ""))
    at = datetime.now(timezone.utc)
    sets: dict = {f"answers.{k}": v for k, v in clean.items()}
    sets["updated_at"] = at
    sets["version"] = ob.QUESTIONS_VERSION
    if completed:
        sets["completed"] = True
        sets["completed_at"] = at
    col = get_database()[ob.PROFILES]
    await col.update_one({"user_id": uid, "answered_at": {"$exists": False}},
                         {"$set": {"answered_at": at}})
    profile = await col.find_one_and_update(
        {"user_id": uid}, {"$set": sets, "$inc": {"revision": 1}}, return_document=True)
    await ob.apply_derived(me, profile)
    return await _state(me, profile)


@router.post("/onboarding/consents", summary="Grant or withdraw a consent")
async def set_consents(body: ConsentsIn, me: dict = Depends(require_member_account)):
    uid = _uid(me)
    asked = {p: getattr(body, p) for p in ob.PURPOSES if getattr(body, p) is not None}
    if not asked:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Say which consent you are answering")
    profile = await ob.profile_of(uid)
    try:
        changes = ob.plan_consent_change(profile, asked)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            {"code": "job_updates_required", "message": str(exc)})
    profile = await ob.write_consents(
        uid, me.get("member_id", ""), changes,
        language=(body.language or me.get("locale") or "en")[:12],
        notice_version=body.notice_version or ob.NOTICE_VERSION,
    )
    if changes.get("setup"):
        await ob.apply_derived(me, profile)
    return await _state(me, profile)


@router.post("/onboarding/skip", summary="Not now")
async def skip_onboarding(me: dict = Depends(require_member_account)):
    """Offered once more after admission if she skipped while waiting; then not again."""
    uid = _uid(me)
    await ob.ensure_profile(uid, me.get("member_id", ""))
    at = datetime.now(timezone.utc)
    profile = await get_database()[ob.PROFILES].find_one_and_update(
        {"user_id": uid},
        {"$set": {"skipped_at": at, "skipped_while": "waiting" if ob.is_waiting(me) else "active"},
         "$inc": {"skip_count": 1}},
        return_document=True,
    )
    return await _state(me, profile)


@router.post("/onboarding/checkin", summary="Are these answers still you?")
async def checkin(body: CheckinIn, me: dict = Depends(require_member_account)):
    if not body.still_same:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Change the answers that are different — saving them counts as your check-in.")
    uid = _uid(me)
    profile = await get_database()[ob.PROFILES].find_one_and_update(
        {"user_id": uid}, {"$set": {"last_reviewed_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    if not profile:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "You have no answers to check yet")
    return await _state(me, profile)


@router.post("/onboarding/dismiss-card", summary="Hide the Make it yours card")
async def dismiss_card(me: dict = Depends(require_member_account)):
    uid = _uid(me)
    await ob.ensure_profile(uid, me.get("member_id", ""))
    profile = await get_database()[ob.PROFILES].find_one_and_update(
        {"user_id": uid}, {"$set": {"card_dismissed_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    return await _state(me, profile)


@router.delete("/onboarding", summary="Withdraw everything and delete my answers")
async def delete_onboarding(request: Request, me: dict = Depends(require_member_account)):
    """
    Every consent withdrawn, every answer and the work profile gone.

    Kept: the consent history (the record of what she agreed to and when is
    also what proves it was withdrawn), and the setup record, so a later
    setup cannot make again what was already made. Things already made for
    her — a draft, a kept goal — are hers and are not touched here; the Welcome
    space and her shop are left to her. Her member segment keeps its value
    but is no longer marked as coming from her answers.
    """
    uid = _uid(me)
    profile = await ob.profile_of(uid)
    if profile:
        held = [p for p in ob.PURPOSES if ob.consent_granted(profile, p)]
        if held:
            await ob.write_consents(uid, me.get("member_id", ""), {p: False for p in held},
                                    language=me.get("locale") or "en")
        await get_database()[ob.PROFILES].update_one(
            {"user_id": uid},
            {"$set": {"answers": {}, "completed": False, "deleted_at": datetime.now(timezone.utc)},
             "$unset": {"answered_at": "", "updated_at": "", "last_reviewed_at": "",
                        "completed_at": ""}},
        )
    await ob.undo_derived(me)
    await record(me, "member.onboarding_delete", target=uid,
                 detail="She withdrew her onboarding consents and deleted her answers",
                 request=request)
    return await _state(me)


# ── setting her app up ─────────────────────────────────────────────────────

@router.post("/onboarding/setup", summary="Prepare my WomSakhi from my answers")
async def setup(me: dict = Depends(require_active_member)):
    """
    Re-runnable. Prepares only what her current answers call for and has not
    been prepared before; never duplicates, never deletes. See `ob.prepare`.
    """
    uid = _uid(me)
    profile = await ob.profile_of(uid)
    if not ob.consent_granted(profile, "setup"):
        raise HTTPException(status.HTTP_409_CONFLICT, {
            "code": "consent_required",
            "message": "Say yes to using your answers to set up your WomSakhi first.",
        })
    try:
        items, created = await ob.prepare(me)
    except RuntimeError:
        raise HTTPException(status.HTTP_409_CONFLICT, {
            "code": "setup_running", "message": "We are already preparing this — one moment."})
    await get_database()[ob.PROFILES].update_one(
        {"user_id": uid}, {"$set": {"completed": True}})
    await ob.apply_derived(me, profile)
    answers = ob.answers_of(profile)
    return {"items": [_item_view(i, answers) for i in items], "created": created}


async def _find_item(uid: str, type_: str, item_id: str) -> tuple[dict, dict]:
    record_ = await ob.setup_of(uid)
    for item in (record_ or {}).get("items") or []:
        if item.get("type") == type_ and item.get("id") == item_id:
            return record_, item
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Nothing like that was prepared for you")


async def _set_item(uid: str, key: str, **fields) -> None:
    await get_database()[ob.SETUPS].update_one(
        {"user_id": uid, "items.key": key},
        {"$set": {f"items.$.{k}": v for k, v in fields.items()}},
    )


@router.post("/onboarding/items/{type_}/{item_id}/keep", summary="Keep a proposed goal or reminder")
async def keep_item(type_: str, item_id: str, body: Optional[KeepIn] = None,
                    me: dict = Depends(require_active_member)):
    from app.engines import reminders as rem
    from app.engines.wiring import _tz_of
    from app.models.goal import GoalModel
    from app.models.reminders import ReminderModel

    body = body or KeepIn()
    uid = _uid(me)
    _, item = await _find_item(uid, type_, item_id)
    db = get_database()

    if type_ == "goal":
        if item.get("state") == "kept":
            return {"item": item_view_simple(item)}
        if item.get("state") != "proposed":
            raise HTTPException(status.HTTP_409_CONFLICT, "That goal was put aside")
        p = item["proposal"]
        # The same writer POST /me/goals uses — one goals collection, one shape.
        doc = GoalModel.create_document(
            user_id=uid, member_id=me.get("member_id", ""), label=p["label"], kind=p["kind"],
            target=int(p["target"]), by=p["by"], unit=p.get("unit", ""))
        doc["onboarding_key"] = item["key"]
        existing = await db[GoalModel.collection_name].find_one({"user_id": uid, "onboarding_key": item["key"]})
        gid = str(existing["_id"]) if existing else str((await db[GoalModel.collection_name].insert_one(doc)).inserted_id)
        await _set_item(uid, item["key"], state="kept", created_id=gid)
        item.update(state="kept", created_id=gid)
        return {"item": item_view_simple(item)}

    if type_ == "reminder":
        col = db[ReminderModel.collection_name]
        if item.get("state") == "kept":
            rid = item.get("created_id", "")
            if body.enable and rid:
                # Kept while off, now switched on.
                res = await col.update_one(
                    {"_id": rem._oid(rid), "user_id": uid, "state": ReminderModel.STATE_PAUSED},
                    {"$set": {"state": ReminderModel.STATE_SCHEDULED, "updated_at": datetime.now(timezone.utc)}})
                if res.modified_count:
                    await rem.fill(rid)
                await _set_item(uid, item["key"], enabled=True)
                item["enabled"] = True
            return {"item": item_view_simple(item)}
        if item.get("state") != "proposed":
            raise HTTPException(status.HTTP_409_CONFLICT, "That reminder was put aside")
        p = item["proposal"]
        kwargs = dict(
            user_id=uid, member_id=str(me.get("member_id", "")),
            title_key="onboarding.dailyTime", schedule_type=ReminderModel.SCHEDULE_RECURRING,
            tz=await _tz_of(uid), category="reminders", klass=ReminderModel.CLASS_USER,
            local_time=p["local_time"], days=p.get("days") or [],
            payload={"title": "Your WomSakhi time",
                     "body": f"{p.get('minutes', 10)} minutes, just for you."},
            domain_module="onboarding", domain_ref=item["key"],
        )
        if body.enable:
            doc = await rem.create(**kwargs)
        else:
            # Kept, but OFF — nothing is scheduled until she switches it on.
            doc = ReminderModel.create_document(**kwargs)
            doc["state"] = ReminderModel.STATE_PAUSED
            doc["_id"] = (await col.insert_one(doc)).inserted_id
        rid = str(doc["_id"])
        await _set_item(uid, item["key"], state="kept", created_id=rid, enabled=body.enable)
        item.update(state="kept", created_id=rid, enabled=body.enable)
        return {"item": item_view_simple(item)}

    raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only a proposed goal or reminder can be kept")


def item_view_simple(item: dict) -> dict:
    out = {k: v for k, v in item.items() if k != "created_at"}
    out["created_at"] = ob.iso(item.get("created_at"))
    return out


@router.post("/onboarding/items/{type_}/{item_id}/remove", summary="Remove a draft or put a suggestion aside")
async def remove_item(type_: str, item_id: str, me: dict = Depends(require_active_member)):
    from app.models.shop import ListingModel

    uid = _uid(me)
    _, item = await _find_item(uid, type_, item_id)
    db = get_database()

    if type_ == "listing":
        from app.core.serializers import to_object_id

        res = await db[ListingModel.collection_name].delete_one(
            {"_id": to_object_id(item_id), "user_id": uid, "status": ListingModel.STATUS_DRAFT})
        if not res.deleted_count:
            live = await db[ListingModel.collection_name].find_one(
                {"_id": to_object_id(item_id), "user_id": uid}, {"_id": 1})
            if live:
                raise HTTPException(status.HTTP_409_CONFLICT,
                                    "It is published now — take it down from your shop instead.")
        await _set_item(uid, item["key"], state="removed")
    elif type_ == "saved_search":
        from app.core.serializers import to_object_id

        await db[ob.SAVED_SEARCHES].delete_one({"_id": to_object_id(item_id), "user_id": uid})
        await _set_item(uid, item["key"], state="removed")
    elif type_ in ("goal", "reminder"):
        if item.get("state") == "kept":
            raise HTTPException(status.HTTP_409_CONFLICT,
                                "It is yours now — change it from Goals or Reminders.")
        await _set_item(uid, item["key"], state="removed")
    elif type_ in ("programme", "opportunity", "circle"):
        await _set_item(uid, item["key"], state="dismissed")
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "The Welcome space is left from the circle itself")
    _, item = await _find_item(uid, type_, item_id)
    return {"item": item_view_simple(item)}


@router.get("/onboarding/items", summary="What was prepared for me")
async def list_items(me: dict = Depends(require_member_account)):
    uid = _uid(me)
    profile, setup_ = await ob.profile_of(uid), await ob.setup_of(uid)
    answers = ob.answers_of(profile)
    return {"items": [_item_view(i, answers) for i in (setup_ or {}).get("items") or []]}


# ── her data ────────────────────────────────────────────────────────────────

@router.get("/data", summary="My answers, consents and work profile")
async def my_data(me: dict = Depends(require_member_account)):
    """Settings → My data. Everything onboarding holds about her, in one place."""
    uid = _uid(me)
    profile, setup_ = await ob.profile_of(uid), await ob.setup_of(uid)
    searches = await get_database()[ob.SAVED_SEARCHES].find(
        {"user_id": uid}, {"_id": 1, "type": 1, "skills": 1, "city": 1, "created_by": 1, "created_at": 1},
    ).to_list(20)
    answers = ob.answers_of(profile)
    return {
        "answers": _answers_view(profile),
        "consents": ob.consent_view(profile),
        "consent_history": [
            {**{k: v for k, v in h.items() if k != "at"}, "at": ob.iso(h.get("at"))}
            for h in (profile or {}).get("consent_history") or []
        ],
        "work_profile": await ob.work_profile(me, profile),
        "prepared": [_item_view(i, answers) for i in (setup_ or {}).get("items") or []],
        "saved_searches": [
            {"id": str(s["_id"]), "type": s.get("type"), "skills": s.get("skills") or [],
             "city": s.get("city", ""), "created_by": s.get("created_by"),
             "created_at": ob.iso(s.get("created_at"))}
            for s in searches
        ],
    }


# ── the skills picker ───────────────────────────────────────────────────────

@skills_router.get("/skills", summary="Find a skill")
async def find_skills(q: str = Query("", max_length=40), me: dict = Depends(require_member_account)):
    return {"skills": taxonomy.search(q, limit=20),
            "groups": [{"key": k, "label": v[0]} for k, v in taxonomy.GROUPS.items()]}


# ── what women want (staff) ─────────────────────────────────────────────────

#: A count below this is not shown: a bucket of two in a small district is a
#: way to tell who they are.
MIN_BUCKET = 5


async def _can_view_insights(staff: dict = Depends(require_staff)) -> dict:
    if await has_permission(staff, "analytics.view") or await has_permission(staff, "users.view"):
        return staff
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Your role cannot view Analytics or Users")


def _buckets(counter: dict[str, int], labels: dict[str, str] | None = None) -> dict:
    shown = {k: n for k, n in counter.items() if n >= MIN_BUCKET}
    rows = sorted(shown.items(), key=lambda kv: kv[1], reverse=True)
    return {
        "buckets": [{"key": k, "label": (labels or {}).get(k, k), "count": n} for k, n in rows],
        "suppressed": sum(1 for n in counter.values() if 0 < n < MIN_BUCKET),
    }


def _pct(n: int, total: int) -> Optional[int]:
    return round(n * 100 / total) if total >= MIN_BUCKET else None


@admin_router.get("/insights", summary="What women want — anonymous counts",
                  dependencies=[Depends(_can_view_insights)])
async def insights(staff: dict = Depends(require_staff)):
    """
    Counts only. No names, no ids, no free text except a custom skill label
    that at least `MIN_BUCKET` women typed; every bucket under that is dropped
    and only the number of dropped buckets is reported.
    """
    from app.models.verification import VerificationStatus

    db = get_database()
    profiles = await db[ob.PROFILES].find(
        {"answers": {"$nin": [{}, None]}}, {"user_id": 1, "answers": 1, "consents": 1},
    ).to_list(None)
    status_of: dict[str, str] = {}
    from bson import ObjectId

    oids = []
    for p in profiles:
        try:
            oids.append(ObjectId(p["user_id"]))
        except Exception:  # noqa: BLE001
            continue
    async for u in db["users"].find({"_id": {"$in": oids}}, {"verification_status": 1}):
        status_of[str(u["_id"])] = u.get("verification_status") or "active"

    def group_of(state: str) -> str:
        if state in VerificationStatus.WAITING:
            return "applicant"
        if state == VerificationStatus.REJECTED:
            return "rejected"
        if state == VerificationStatus.ACTIVE:
            return "active"
        return "other"

    goals: dict[str, int] = {}
    skills_c: dict[str, int] = {}
    skill_labels: dict[str, str] = {}
    topics: dict[str, int] = {}
    meet: dict[str, int] = {}
    times: dict[str, int] = {}
    minutes: dict[str, int] = {}
    flags = {"voice_prompts": 0, "helper_mode": 0, "shared_phone": 0}
    consents = {p: 0 for p in ob.PURPOSES}
    by_status: dict[str, int] = {}
    goals_by_status: dict[str, dict[str, int]] = {}

    def bump(d: dict, k: str) -> None:
        d[k] = d.get(k, 0) + 1

    for p in profiles:
        a = p.get("answers") or {}
        grp = group_of(status_of.get(p.get("user_id", ""), ""))
        bump(by_status, grp)
        for g in a.get("goals") or []:
            bump(goals, g)
            bump(goals_by_status.setdefault(grp, {}), g)
        for s in ob.skill_entries(a):
            key = s["key"] if not s["custom"] else "custom:" + " ".join(s["label"].casefold().split())
            bump(skills_c, key)
            skill_labels.setdefault(key, s["label"] if not s["custom"] else s["label"].strip().capitalize())
        for t in a.get("learn_topics") or []:
            bump(topics, t)
        for m in a.get("meet") or []:
            bump(meet, m)
        for t in a.get("free_times") or []:
            bump(times, t)
        if a.get("minutes_per_day"):
            bump(minutes, str(a["minutes_per_day"]))
        for f in flags:
            if a.get(f) is True:
                flags[f] += 1
        for purpose in ob.PURPOSES:
            if ob.consent_granted(p, purpose):
                consents[purpose] += 1

    total = len(profiles)
    top_skills = _buckets(skills_c, skill_labels)
    top_skills["buckets"] = top_skills["buckets"][:20]
    return {
        "respondents": total if total >= MIN_BUCKET else None,
        "min_bucket": MIN_BUCKET,
        "goals": _buckets(goals, ob.GOAL_LABELS),
        "top_skills": top_skills,
        "learn_topics": _buckets(topics),
        "meet": _buckets(meet, ob.MEET_LABELS),
        "free_times": _buckets(times),
        "minutes_per_day": _buckets(minutes),
        "usage": _buckets(flags),
        "consent_rates": {p: _pct(n, total) for p, n in consents.items()},
        "by_status": _buckets(by_status),
        "goals_by_status": {g: _buckets(c, ob.GOAL_LABELS) for g, c in goals_by_status.items()
                            if by_status.get(g, 0) >= MIN_BUCKET},
    }
