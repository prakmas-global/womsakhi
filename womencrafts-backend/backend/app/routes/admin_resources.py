"""
Staff side of the reference catalogue (schemes, cover, health, rights, family,
travel, helplines, guidance) and the wellbeing cards.

Every endpoint is behind the "resources" module guard (main.py) and names its
action (resources.view / .create / .edit / .delete / .approve); every write is
audited.

── Nothing reaches a member unreviewed ──────────────────────────────────────
A catalogue entry is born a `draft`. It becomes visible on a member screen only
when someone holding `resources.approve` publishes it, and that person's name
and the moment are written on the row. A wellbeing card is born `reviewed:
False`, which `engines/mood.py` treats as "does not exist". Both are the same
idea: the person who types and the person who signs off are allowed to be
different people, and the product refuses to show anything that only one of
them has touched.

── Rows are archived, never deleted ─────────────────────────────────────────
A member may have marked a scheme "applied" — that mark points at this row by
id. Deleting the row would leave her record pointing at nothing, so a catalogue
entry can only be archived, and an archived entry can be brought back. A
wellbeing card CAN be deleted, but only while it is unreviewed: once reviewed
it may have been shown to someone, and a card that was shown is a card that
should stay explainable.

── Uptake is a count ────────────────────────────────────────────────────────
`reference_mine` is each woman's private record of what she has done. Staff
see "41 members marked this"; they never see who. No endpoint here returns a
row from that collection, only aggregates over it.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.core import cache, mongosafe
from app.core.audit import record
from app.core.deps import get_current_user
from app.core.permissions import require_permission
from app.core.serializers import aware, page_meta, to_object_id
from app.db.mongodb import get_database
from app.models.reference import MyReferenceModel, ReferenceModel
from app.schemas.me import MessageResponse
from app.schemas.resources_admin import (
    ActivityPage,
    ActivityRow,
    ActivityUpsert,
    CardPage,
    CardRow,
    CardUpsert,
    CatalogueCounts,
    ReferencePage,
    ReferenceRow,
    ReferenceUpsert,
    ResourcesSummary,
    ReviewCounts,
    TopicCount,
)

router = APIRouter(prefix="/admin/resources", tags=["Resources catalogue (staff)"])

TOPIC_LABELS = {
    ReferenceModel.TOPIC_SCHEME: "Schemes",
    ReferenceModel.TOPIC_COVER: "Insurance & pension",
    ReferenceModel.TOPIC_HEALTH: "Health",
    ReferenceModel.TOPIC_RIGHTS: "Rights",
    ReferenceModel.TOPIC_FAMILY: "Family & childcare",
    ReferenceModel.TOPIC_TRAVEL: "Getting about",
    ReferenceModel.TOPIC_HELPLINE: "Helplines",
    ReferenceModel.TOPIC_GUIDANCE: "Guidance",
}

STATUSES = (
    ReferenceModel.STATUS_PUBLISHED,
    ReferenceModel.STATUS_DRAFT,
    ReferenceModel.STATUS_ARCHIVED,
)

#: The two wellbeing collections `engines/mood.py` reads, by the word the URL
#: uses for them.
WELLBEING = {
    "cards": ("support_cards", "support card"),
    "activities": ("wellbeing_activities", "activity"),
}

#: The member cache keys `routes/reference.py` writes. Dropped after every
#: catalogue write so a published entry appears now, not in a minute.
_MEMBER_CACHE_PREFIX = "ref:"


def _ref():
    return get_database()[ReferenceModel.collection_name]


def _mine():
    return get_database()[MyReferenceModel.collection_name]


def _wellbeing(kind: str):
    if kind not in WELLBEING:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Record not found")
    return get_database()[WELLBEING[kind][0]]


# --- shared helpers ------------------------------------------------------------

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value) -> str:
    got = aware(value) if isinstance(value, datetime) else None
    return got.isoformat() if got else ""


def _actor_name(me: dict) -> str:
    return me.get("full_name") or me.get("email") or ""


def _status_of(doc: dict) -> str:
    """A row written before the workflow existed has no status; it was live."""
    return doc.get("status") or ReferenceModel.STATUS_PUBLISHED


def _status_clause(wanted: str) -> dict | str:
    """
    The Mongo clause for one status. `published` also matches rows with no
    status field, so the 47 entries seeded before this screen existed keep
    counting as what they always were.
    """
    if wanted == ReferenceModel.STATUS_PUBLISHED:
        return {"$in": [ReferenceModel.STATUS_PUBLISHED, None]}
    return wanted


def _label(topic: str) -> str:
    return TOPIC_LABELS.get(topic, topic or "—")


async def _uptake_for(ids: list[str]) -> dict[str, int]:
    """{ref_id: how many members marked it} — one aggregate for a page."""
    if not ids:
        return {}
    rows = await _mine().aggregate([
        {"$match": {"ref_id": {"$in": ids}}},
        {"$group": {"_id": "$ref_id", "n": {"$sum": 1}}},
    ]).to_list(len(ids) + 1)
    return {str(r["_id"]): int(r["n"]) for r in rows}


async def _uptake_by_state(ref_id: str) -> dict[str, int]:
    rows = await _mine().aggregate([
        {"$match": {"ref_id": ref_id}},
        {"$group": {"_id": "$state", "n": {"$sum": 1}}},
    ]).to_list(20)
    got = {str(r["_id"]): int(r["n"]) for r in rows}
    return {s: got.get(s, 0) for s in MyReferenceModel.STATES}


def _ref_row(d: dict, uptake: int = 0, by_state: dict[str, int] | None = None) -> ReferenceRow:
    return ReferenceRow(
        id=str(d["_id"]),
        topic=d.get("topic", ""),
        title=d.get("title", ""),
        body=d.get("body", ""),
        city=d.get("city") or ReferenceModel.EVERYWHERE,
        rank=int(d.get("rank", 100) or 0),
        free=d.get("free"),
        cost_label=d.get("cost_label", ""),
        who=d.get("who", ""),
        payload=d.get("payload") or {},
        status=_status_of(d),
        reviewed_by=d.get("reviewed_by", "") or "",
        reviewed_at=_iso(d.get("reviewed_at")),
        created_at=_iso(d.get("created_at")),
        updated_at=_iso(d.get("updated_at")),
        uptake=uptake,
        uptake_by_state=by_state or {},
    )


async def _ref_rows(docs: list[dict]) -> list[ReferenceRow]:
    uptake = await _uptake_for([str(d["_id"]) for d in docs])
    return [_ref_row(d, uptake.get(str(d["_id"]), 0)) for d in docs]


async def _one_ref(doc: dict) -> ReferenceRow:
    rid = str(doc["_id"])
    by_state = await _uptake_by_state(rid)
    return _ref_row(doc, sum(by_state.values()), by_state)


async def _load_ref(ref_id: str) -> dict:
    doc = await _ref().find_one({"_id": to_object_id(ref_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That entry doesn't exist")
    return doc


async def _topic_counts() -> list[TopicCount]:
    rows = await _ref().aggregate([
        {"$group": {
            "_id": {"topic": "$topic", "status": {"$ifNull": ["$status", ReferenceModel.STATUS_PUBLISHED]}},
            "n": {"$sum": 1},
        }},
    ]).to_list(500)
    by: dict[str, dict[str, int]] = {t: {"published": 0, "draft": 0, "archived": 0} for t in ReferenceModel.TOPICS}
    for r in rows:
        topic = str(r["_id"].get("topic") or "")
        st = str(r["_id"].get("status") or ReferenceModel.STATUS_PUBLISHED)
        bucket = by.setdefault(topic, {"published": 0, "draft": 0, "archived": 0})
        # An unknown status was never shown to anyone, so it counts as a draft
        # rather than vanishing from the tiles.
        bucket[st if st in bucket else "draft"] += int(r["n"])
    out = []
    for topic in list(ReferenceModel.TOPICS) + sorted(t for t in by if t not in ReferenceModel.TOPICS):
        c = by[topic]
        out.append(TopicCount(
            topic=topic, label=_label(topic),
            published=c["published"], draft=c["draft"], archived=c["archived"],
            total=c["published"] + c["draft"] + c["archived"],
        ))
    return out


async def _review_counts(kind: str) -> ReviewCounts:
    coll = _wellbeing(kind)
    total, reviewed = await asyncio.gather(
        coll.count_documents({}),
        coll.count_documents({"reviewed": True}),
    )
    return ReviewCounts(total=total, reviewed=reviewed, unreviewed=total - reviewed)


# --- summary -------------------------------------------------------------------

@router.get(
    "/summary", response_model=ResourcesSummary, summary="The numbers on the tiles",
    dependencies=[Depends(require_permission("resources.view"))],
)
async def summary():
    topics, marks, cards, activities = await asyncio.gather(
        _topic_counts(),
        _mine().count_documents({}),
        _review_counts("cards"),
        _review_counts("activities"),
    )
    return ResourcesSummary(
        catalogue=CatalogueCounts(
            published=sum(t.published for t in topics),
            draft=sum(t.draft for t in topics),
            archived=sum(t.archived for t in topics),
            total=sum(t.total for t in topics),
            marks=marks,
        ),
        topics=topics,
        cards=cards,
        activities=activities,
    )


@router.get(
    "/topics", response_model=list[TopicCount], summary="Every topic, with how many entries it holds",
    dependencies=[Depends(require_permission("resources.view"))],
)
async def topics():
    return await _topic_counts()


# --- catalogue -----------------------------------------------------------------

@router.get(
    "/catalogue", response_model=ReferencePage, summary="Catalogue entries, one topic or all",
    dependencies=[Depends(require_permission("resources.view"))],
)
async def list_catalogue(
    topic: str = Query("", max_length=20),
    q: str = Query("", max_length=80),
    city: str = Query("", max_length=60),
    free: str = Query("", pattern="^(|free|paid|unknown)$"),
    status_filter: str = Query("", alias="status", max_length=12),
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=50),
):
    query: dict = {}
    if topic:
        if topic not in ReferenceModel.TOPICS:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "That is not a topic the catalogue has")
        query["topic"] = topic
    if q.strip():
        query.update(mongosafe.any_of(q, ["title", "body", "who"]))
    if city.strip():
        # "*" is a literal marker for everywhere; anything else is a name.
        query["city"] = city.strip() if city.strip() == ReferenceModel.EVERYWHERE else mongosafe.contains(city)
    if free == "free":
        query["free"] = True
    elif free == "paid":
        query["free"] = False
    elif free == "unknown":
        query["free"] = None
    if status_filter:
        if status_filter not in STATUSES:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Status is published, draft or archived")
        query["status"] = _status_clause(status_filter)

    total = await _ref().count_documents(query)
    docs = (
        await _ref().find(query)
        .sort([("topic", 1), ("rank", 1), ("title", 1)])
        .skip((page - 1) * page_size)
        .limit(page_size)
        .to_list(page_size)
    )
    return ReferencePage(items=await _ref_rows(docs), meta=page_meta(total, page, page_size))


@router.get(
    "/catalogue/{ref_id}", response_model=ReferenceRow, summary="One entry, with its uptake by state",
    dependencies=[Depends(require_permission("resources.view"))],
)
async def get_entry(ref_id: str):
    return await _one_ref(await _load_ref(ref_id))


@router.post(
    "/catalogue", response_model=ReferenceRow, status_code=status.HTTP_201_CREATED,
    summary="Add an entry (as a draft)",
    dependencies=[Depends(require_permission("resources.create"))],
)
async def create_entry(body: ReferenceUpsert, request: Request, me: dict = Depends(get_current_user)):
    doc = ReferenceModel.create_document(
        topic=body.topic, title=body.title, body=body.body, city=body.city, rank=body.rank,
        free=body.free, cost_label=body.cost_label, who=body.who, payload=body.payload,
    )
    # Born a draft. `create_document` defaults to published because the seed
    # uses it; a person typing on this screen does not get that shortcut.
    doc["status"] = ReferenceModel.STATUS_DRAFT
    doc["created_by"] = str(me.get("_id", ""))
    result = await _ref().insert_one(doc)
    doc["_id"] = result.inserted_id
    await record(
        me, "resources.create", target=str(result.inserted_id),
        detail=f"Added '{body.title}' to {_label(body.topic)} as a draft ({body.city})",
        request=request,
    )
    return _ref_row(doc)


@router.put(
    "/catalogue/{ref_id}", response_model=ReferenceRow, summary="Edit an entry",
    dependencies=[Depends(require_permission("resources.edit"))],
)
async def update_entry(
    ref_id: str, body: ReferenceUpsert, request: Request, me: dict = Depends(get_current_user)
):
    updates = body.model_dump()
    updates["updated_at"] = _now()
    doc = await _ref().find_one_and_update(
        {"_id": to_object_id(ref_id)}, {"$set": updates}, return_document=True
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That entry doesn't exist")
    cache.forget_prefix(_MEMBER_CACHE_PREFIX)
    await record(
        me, "resources.edit", target=ref_id,
        detail=f"Edited '{body.title}' in {_label(body.topic)} ({_status_of(doc)})",
        request=request,
    )
    return await _one_ref(doc)


@router.post(
    "/catalogue/{ref_id}/approve", response_model=ReferenceRow, summary="Publish a draft",
    dependencies=[Depends(require_permission("resources.approve"))],
)
async def approve_entry(ref_id: str, request: Request, me: dict = Depends(get_current_user)):
    existing = await _load_ref(ref_id)
    current = _status_of(existing)
    if current == ReferenceModel.STATUS_PUBLISHED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That entry is already published")
    if current == ReferenceModel.STATUS_ARCHIVED:
        raise HTTPException(status.HTTP_409_CONFLICT, "Bring it back from the archive first")
    now = _now()
    doc = await _ref().find_one_and_update(
        {"_id": existing["_id"]},
        {"$set": {
            "status": ReferenceModel.STATUS_PUBLISHED,
            "reviewed_by": _actor_name(me), "reviewed_by_id": str(me.get("_id", "")),
            "reviewed_at": now, "updated_at": now,
        }},
        return_document=True,
    )
    cache.forget_prefix(_MEMBER_CACHE_PREFIX)
    await record(
        me, "resources.approve", target=ref_id,
        detail=f"Published '{existing.get('title', '')}' in {_label(existing.get('topic', ''))}",
        request=request,
    )
    return await _one_ref(doc)


@router.post(
    "/catalogue/{ref_id}/unpublish", response_model=ReferenceRow, summary="Take a published entry back to draft",
    dependencies=[Depends(require_permission("resources.approve"))],
)
async def unpublish_entry(ref_id: str, request: Request, me: dict = Depends(get_current_user)):
    existing = await _load_ref(ref_id)
    if _status_of(existing) != ReferenceModel.STATUS_PUBLISHED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only a published entry can be taken back to draft")
    doc = await _ref().find_one_and_update(
        {"_id": existing["_id"]},
        {"$set": {"status": ReferenceModel.STATUS_DRAFT, "updated_at": _now()}},
        return_document=True,
    )
    cache.forget_prefix(_MEMBER_CACHE_PREFIX)
    await record(
        me, "resources.unpublish", target=ref_id,
        detail=f"Took '{existing.get('title', '')}' back to draft — members no longer see it",
        request=request,
    )
    return await _one_ref(doc)


@router.post(
    "/catalogue/{ref_id}/archive", response_model=ReferenceRow, summary="Archive an entry (never deleted)",
    dependencies=[Depends(require_permission("resources.delete"))],
)
async def archive_entry(ref_id: str, request: Request, me: dict = Depends(get_current_user)):
    existing = await _load_ref(ref_id)
    if _status_of(existing) == ReferenceModel.STATUS_ARCHIVED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That entry is already archived")
    now = _now()
    doc = await _ref().find_one_and_update(
        {"_id": existing["_id"]},
        {"$set": {
            "status": ReferenceModel.STATUS_ARCHIVED,
            "archived_by": _actor_name(me), "archived_at": now, "updated_at": now,
        }},
        return_document=True,
    )
    cache.forget_prefix(_MEMBER_CACHE_PREFIX)
    await record(
        me, "resources.archive", target=ref_id,
        detail=f"Archived '{existing.get('title', '')}' from {_label(existing.get('topic', ''))}",
        request=request,
    )
    return await _one_ref(doc)


@router.post(
    "/catalogue/{ref_id}/unarchive", response_model=ReferenceRow, summary="Bring an archived entry back as a draft",
    dependencies=[Depends(require_permission("resources.delete"))],
)
async def unarchive_entry(ref_id: str, request: Request, me: dict = Depends(get_current_user)):
    existing = await _load_ref(ref_id)
    if _status_of(existing) != ReferenceModel.STATUS_ARCHIVED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That entry is not archived")
    # Back as a draft, not straight to published: whoever archived it had a
    # reason, and someone with approve should look before members see it again.
    doc = await _ref().find_one_and_update(
        {"_id": existing["_id"]},
        {
            "$set": {"status": ReferenceModel.STATUS_DRAFT, "updated_at": _now()},
            "$unset": {"archived_by": "", "archived_at": ""},
        },
        return_document=True,
    )
    await record(
        me, "resources.unarchive", target=ref_id,
        detail=f"Restored '{existing.get('title', '')}' to drafts",
        request=request,
    )
    return await _one_ref(doc)


# --- wellbeing: support cards and activities ----------------------------------

def _card_row(d: dict) -> CardRow:
    return CardRow(
        id=str(d["_id"]),
        title=d.get("title", "") or "",
        body=d.get("body", "") or "",
        kind=d.get("kind", "word") or "word",
        moods=[str(m) for m in (d.get("moods") or [])],
        styles=[str(s) for s in (d.get("styles") or [])],
        minutes=int(d.get("minutes", 0) or 0),
        reviewed=bool(d.get("reviewed")),
        reviewed_by=str(d.get("reviewed_by", "") or ""),
        reviewed_at=_iso(d.get("reviewed_at")),
        seeded=bool(d.get("seed_key")),
        created_at=_iso(d.get("created_at")),
        updated_at=_iso(d.get("updated_at")),
    )


def _activity_row(d: dict) -> ActivityRow:
    return ActivityRow(
        id=str(d["_id"]),
        text=d.get("text", "") or "",
        minutes=int(d.get("minutes", 0) or 0),
        icon=d.get("icon", "") or "",
        reviewed=bool(d.get("reviewed")),
        reviewed_by=str(d.get("reviewed_by", "") or ""),
        reviewed_at=_iso(d.get("reviewed_at")),
        seeded=bool(d.get("seed_key")),
        created_at=_iso(d.get("created_at")),
        updated_at=_iso(d.get("updated_at")),
    )


def _wb_row(kind: str, d: dict) -> CardRow | ActivityRow:
    return _card_row(d) if kind == "cards" else _activity_row(d)


def _wb_title(kind: str, d: dict) -> str:
    return (d.get("title") if kind == "cards" else d.get("text")) or ""


def _reviewed_clause(wanted: str) -> dict:
    if wanted == "reviewed":
        return {"reviewed": True}
    if wanted == "unreviewed":
        # Missing counts as unreviewed: the engine's filter is `reviewed: True`.
        return {"reviewed": {"$ne": True}}
    return {}


async def _load_wb(kind: str, item_id: str) -> dict:
    doc = await _wellbeing(kind).find_one({"_id": to_object_id(item_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"That {WELLBEING[kind][1]} doesn't exist")
    return doc


async def _page(coll, query: dict, page: int, page_size: int) -> tuple[list[dict], dict]:
    total = await coll.count_documents(query)
    docs = (
        await coll.find(query)
        .sort([("reviewed", 1), ("created_at", -1)])
        .skip((page - 1) * page_size)
        .limit(page_size)
        .to_list(page_size)
    )
    return docs, page_meta(total, page, page_size)


@router.get(
    "/wellbeing/cards", response_model=CardPage, summary="Support cards, reviewed and waiting",
    dependencies=[Depends(require_permission("resources.view"))],
)
async def list_cards(
    q: str = Query("", max_length=80),
    reviewed: str = Query("", pattern="^(|reviewed|unreviewed)$"),
    mood: str = Query("", max_length=12),
    style: str = Query("", max_length=12),
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=50),
):
    query: dict = dict(_reviewed_clause(reviewed))
    if q.strip():
        query.update(mongosafe.any_of(q, ["title", "body"]))
    if mood:
        query["moods"] = mood
    if style:
        query["styles"] = style
    docs, meta = await _page(_wellbeing("cards"), query, page, page_size)
    return CardPage(items=[_card_row(d) for d in docs], meta=meta)


@router.get(
    "/wellbeing/activities", response_model=ActivityPage, summary="Reset activities, reviewed and waiting",
    dependencies=[Depends(require_permission("resources.view"))],
)
async def list_activities(
    q: str = Query("", max_length=80),
    reviewed: str = Query("", pattern="^(|reviewed|unreviewed)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=50),
):
    query: dict = dict(_reviewed_clause(reviewed))
    if q.strip():
        query.update(mongosafe.any_of(q, ["text"]))
    docs, meta = await _page(_wellbeing("activities"), query, page, page_size)
    return ActivityPage(items=[_activity_row(d) for d in docs], meta=meta)


@router.post(
    "/wellbeing/cards", response_model=CardRow, status_code=status.HTTP_201_CREATED,
    summary="Write a support card (unreviewed until someone signs it off)",
    dependencies=[Depends(require_permission("resources.create"))],
)
async def create_card(body: CardUpsert, request: Request, me: dict = Depends(get_current_user)):
    now = _now()
    doc = {
        **body.model_dump(),
        # A record that a person read it, not a default.
        "reviewed": False, "reviewed_by": "",
        "created_by": str(me.get("_id", "")), "created_at": now, "updated_at": now,
    }
    result = await _wellbeing("cards").insert_one(doc)
    doc["_id"] = result.inserted_id
    await record(
        me, "resources.card.create", target=str(result.inserted_id),
        detail=f"Wrote support card '{body.title}' for {', '.join(body.moods)} — awaiting review",
        request=request,
    )
    return _card_row(doc)


@router.put(
    "/wellbeing/cards/{item_id}", response_model=CardRow, summary="Edit a support card",
    dependencies=[Depends(require_permission("resources.edit"))],
)
async def update_card(
    item_id: str, body: CardUpsert, request: Request, me: dict = Depends(get_current_user)
):
    existing = await _load_wb("cards", item_id)
    updates = body.model_dump()
    updates["updated_at"] = _now()
    # A review is a record that a person read THESE words. Change the words and
    # the record no longer describes the card, so it goes back to waiting.
    words_changed = (
        existing.get("title", "") != body.title or existing.get("body", "") != body.body
    )
    if words_changed and existing.get("reviewed"):
        updates["reviewed"] = False
        updates["reviewed_by"] = ""
        updates["reviewed_at"] = None
    doc = await _wellbeing("cards").find_one_and_update(
        {"_id": existing["_id"]}, {"$set": updates}, return_document=True
    )
    await record(
        me, "resources.card.edit", target=item_id,
        detail=f"Edited support card '{body.title}'"
        + (" — words changed, back to awaiting review" if words_changed and existing.get("reviewed") else ""),
        request=request,
    )
    return _card_row(doc)


@router.post(
    "/wellbeing/activities", response_model=ActivityRow, status_code=status.HTTP_201_CREATED,
    summary="Add a reset activity (unreviewed until someone signs it off)",
    dependencies=[Depends(require_permission("resources.create"))],
)
async def create_activity(body: ActivityUpsert, request: Request, me: dict = Depends(get_current_user)):
    now = _now()
    doc = {
        **body.model_dump(),
        "reviewed": False, "reviewed_by": "",
        "created_by": str(me.get("_id", "")), "created_at": now, "updated_at": now,
    }
    result = await _wellbeing("activities").insert_one(doc)
    doc["_id"] = result.inserted_id
    await record(
        me, "resources.activity.create", target=str(result.inserted_id),
        detail=f"Added activity '{body.text}' ({body.minutes} min) — awaiting review",
        request=request,
    )
    return _activity_row(doc)


@router.put(
    "/wellbeing/activities/{item_id}", response_model=ActivityRow, summary="Edit a reset activity",
    dependencies=[Depends(require_permission("resources.edit"))],
)
async def update_activity(
    item_id: str, body: ActivityUpsert, request: Request, me: dict = Depends(get_current_user)
):
    existing = await _load_wb("activities", item_id)
    updates = body.model_dump()
    updates["updated_at"] = _now()
    words_changed = existing.get("text", "") != body.text
    if words_changed and existing.get("reviewed"):
        updates["reviewed"] = False
        updates["reviewed_by"] = ""
        updates["reviewed_at"] = None
    doc = await _wellbeing("activities").find_one_and_update(
        {"_id": existing["_id"]}, {"$set": updates}, return_document=True
    )
    await record(
        me, "resources.activity.edit", target=item_id,
        detail=f"Edited activity '{body.text}'"
        + (" — words changed, back to awaiting review" if words_changed and existing.get("reviewed") else ""),
        request=request,
    )
    return _activity_row(doc)


@router.post(
    "/wellbeing/{kind}/{item_id}/review", response_model=CardRow | ActivityRow,
    summary="Mark a card or activity reviewed — it can now be shown",
    dependencies=[Depends(require_permission("resources.approve"))],
)
async def review_wellbeing(
    kind: str, item_id: str, request: Request, me: dict = Depends(get_current_user)
):
    existing = await _load_wb(kind, item_id)
    if existing.get("reviewed"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"That {WELLBEING[kind][1]} is already reviewed")
    now = _now()
    doc = await _wellbeing(kind).find_one_and_update(
        {"_id": existing["_id"]},
        {"$set": {
            "reviewed": True, "reviewed_by": _actor_name(me),
            "reviewed_by_id": str(me.get("_id", "")), "reviewed_at": now, "updated_at": now,
        }},
        return_document=True,
    )
    await record(
        me, "resources.review", target=item_id,
        detail=f"Reviewed {WELLBEING[kind][1]} '{_wb_title(kind, existing)}' — it can now be shown",
        request=request,
    )
    return _wb_row(kind, doc)


@router.post(
    "/wellbeing/{kind}/{item_id}/unreview", response_model=CardRow | ActivityRow,
    summary="Withdraw a review — the card stops being shown",
    dependencies=[Depends(require_permission("resources.approve"))],
)
async def unreview_wellbeing(
    kind: str, item_id: str, request: Request, me: dict = Depends(get_current_user)
):
    existing = await _load_wb(kind, item_id)
    if not existing.get("reviewed"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"That {WELLBEING[kind][1]} is not reviewed")
    doc = await _wellbeing(kind).find_one_and_update(
        {"_id": existing["_id"]},
        {"$set": {"reviewed": False, "reviewed_by": "", "reviewed_at": None, "updated_at": _now()}},
        return_document=True,
    )
    await record(
        me, "resources.unreview", target=item_id,
        detail=f"Withdrew review of {WELLBEING[kind][1]} '{_wb_title(kind, existing)}' — no longer shown",
        request=request,
    )
    return _wb_row(kind, doc)


@router.delete(
    "/wellbeing/{kind}/{item_id}", response_model=MessageResponse,
    summary="Delete an unreviewed card or activity",
    dependencies=[Depends(require_permission("resources.delete"))],
)
async def delete_wellbeing(
    kind: str, item_id: str, request: Request, me: dict = Depends(get_current_user)
):
    existing = await _load_wb(kind, item_id)
    if existing.get("reviewed"):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"A reviewed {WELLBEING[kind][1]} may have been shown to someone. Withdraw the review first.",
        )
    await _wellbeing(kind).delete_one({"_id": existing["_id"]})
    await record(
        me, "resources.delete", target=item_id,
        detail=f"Deleted unreviewed {WELLBEING[kind][1]} '{_wb_title(kind, existing)}'",
        request=request,
    )
    return MessageResponse(message=f"The {WELLBEING[kind][1]} was deleted")
