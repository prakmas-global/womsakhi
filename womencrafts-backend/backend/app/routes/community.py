"""
Community: circles, the conversations in them, and success stories.

Same rule as the rest of the member app — the author is taken from the token.
A member can only edit or delete her own post, and joining a circle is the only
thing that grants read access to a private one.

Moderation model: staff hide, they never delete. `hidden: true` disappears from
every member-facing query but the record survives for the report that caused it.
"""

import asyncio
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pymongo.errors import DuplicateKeyError

from app.core import mongosafe
from app.core import idempotency
from app.core.rbac import require_active_member
from app.core.serializers import to_object_id
from app.db.mongodb import get_database
from app.models.wallet import WalletTxnModel
from app.routes.wallet import balance_minor, symbol
from app.models.community import (
    CircleContributionModel,
    CircleMemberModel,
    CircleModel,
    PostModel,
    PostReplyModel,
    StoryModel,
)
from app.schemas.community import (
    CircleCreate,
    CircleResponse,
    CircleSavingsResponse,
    ContributionResponse,
    LikeResponse,
    PostCreate,
    PostResponse,
    ReplyCreate,
    ReplyResponse,
    StoryCreate,
    StoryResponse,
)
from app.schemas.me import MessageResponse

router = APIRouter(prefix="/community", tags=["Member · Community"])


def _circles():
    return get_database()[CircleModel.collection_name]


def _circle_members():
    return get_database()[CircleMemberModel.collection_name]


def _posts():
    return get_database()[PostModel.collection_name]


def _replies():
    return get_database()[PostReplyModel.collection_name]


def _stories():
    return get_database()[StoryModel.collection_name]


async def _get_circle_or_404(circle_id: str) -> dict:
    oid = to_object_id(circle_id)
    circle = await _circles().find_one({"_id": oid, "status": "active"})
    if not circle:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That circle doesn't exist")
    return circle


async def _require_membership(circle: dict, user_id: str) -> None:
    """Private circles are readable only from the inside."""
    if not circle.get("is_private"):
        return
    joined = await _circle_members().find_one(
        {"user_id": user_id, "circle_id": str(circle["_id"])}
    )
    if not joined:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Join this circle to see what's inside")


# --- circles -----------------------------------------------------------------

@router.get("/circles", response_model=list[CircleResponse], summary="Circles I can join")
async def list_circles(
    q: str = Query("", max_length=80),
    mine: bool = Query(False, description="Only circles I've joined"),
    me: dict = Depends(require_active_member),
):
    """
    **A private circle she is not in must not appear here.** It did. `is_private`
    was stored, shown, and enforced on the circle's *posts* — and nowhere else,
    so the browse list handed back the name, topic, description, guidelines and
    member count of every private circle on the platform. Combined with
    `/circles/{id}/savings`, which never checked membership either, that was a
    complete path from a member account to who is in a women's savings group and
    who has not managed to pay this month. For some of these women that is not
    embarrassing information, it is dangerous information.

    The membership test is done in the query rather than after it, because
    filtering a page of 100 rows in Python quietly returns fewer than 100 rows
    once enough private circles exist — a privacy fix that turns into a paging
    bug the year the platform grows.

    It is also one query rather than two: the `$lookup` answers "is she in this
    one" per row, which is both the privacy filter and the `joined` flag the
    screen renders, so `mine=true` stops being a waterfall as well.
    """
    user_id = str(me["_id"])

    query: dict = {"status": "active"}
    if q.strip():
        query.update(mongosafe.any_of(q, ["name", "topic"]))

    visible = (
        {"_joined": True} if mine
        # Public circles, plus the private ones she is actually in.
        else {"$or": [{"is_private": {"$ne": True}}, {"_joined": True}]}
    )

    docs = await _circles().aggregate([
        {"$match": query},
        {"$lookup": {
            "from": CircleMemberModel.collection_name,
            # Membership rows key the circle by its id as a STRING, which is
            # why `_id` is converted rather than compared directly.
            "let": {"cid": {"$toString": "$_id"}},
            "pipeline": [
                {"$match": {"$expr": {"$and": [
                    {"$eq": ["$circle_id", "$$cid"]},
                    {"$eq": ["$user_id", user_id]},
                ]}}},
                {"$limit": 1},
            ],
            "as": "_mine",
        }},
        {"$addFields": {"_joined": {"$gt": [{"$size": "$_mine"}, 0]}}},
        {"$match": visible},
        {"$sort": {"member_count": -1}},
        {"$limit": 100},
    ]).to_list(100)

    return [CircleModel.to_response(d, bool(d.get("_joined"))) for d in docs]


@router.post(
    "/circles",
    response_model=CircleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start a circle",
)
async def create_circle(
    body: CircleCreate,
    request: Request,
    me: dict = Depends(require_active_member),
):
    """
    Start a circle. The woman who starts it is its first member and its host.

    Sending an `Idempotency-Key` means a double tap on a bad connection makes
    one circle, not two — and two circles with the same name and half the
    members each is a mess that has to be untangled by hand.
    """
    return await idempotency.once(
        request, str(me["_id"]), "community.create_circle",
        lambda: _create_circle(body, me),
    )


async def _create_circle(body: CircleCreate, me: dict):
    uid = str(me["_id"])
    doc = CircleModel.create_document(
        name=body.name.strip(),
        topic=body.topic.strip(),
        desc=body.desc.strip(),
        is_private=body.is_private,
        created_by=uid,
        is_savings=body.is_savings,
        # A share only means anything on a circle that collects money. Storing
        # one on a community circle would put a Pay button on it later.
        monthly_minor=body.monthly_minor if body.is_savings else 0,
    )
    result = await _circles().insert_one(doc)
    circle_id = str(result.inserted_id)

    # She is in the circle she just started — as its host, and as turn 1 if it
    # saves. A circle whose founder has to remember to join it is a bug.
    await _circle_members().insert_one(
        CircleMemberModel.create_document(
            uid, circle_id, role=CircleMemberModel.ROLE_HOST,
            turn=1 if body.is_savings else 0,
        )
    )
    await _circles().update_one({"_id": result.inserted_id}, {"$set": {"member_count": 1}})

    doc["_id"] = result.inserted_id
    doc["member_count"] = 1
    return CircleModel.to_response(doc, True)


@router.get("/circles/{circle_id}", response_model=CircleResponse, summary="One circle")
async def get_circle(circle_id: str, me: dict = Depends(require_active_member)):
    circle = await _get_circle_or_404(circle_id)
    user_id = str(me["_id"])
    # Same reasoning as the list: a private circle is readable from the inside
    # only. Public circles pass straight through — `_require_membership`
    # returns immediately for them and costs no query.
    await _require_membership(circle, user_id)
    joined = await _circle_members().find_one({"user_id": user_id, "circle_id": circle_id})
    return CircleModel.to_response(circle, bool(joined))


@router.post("/circles/{circle_id}/join", response_model=CircleResponse, summary="Join a circle")
async def join_circle(circle_id: str, me: dict = Depends(require_active_member)):
    """
    **A private circle cannot be joined from the outside.**

    Without this, hiding private circles from the browse list would have been
    theatre: the id is all `join` needed, and joining is what grants the read
    access every other check in this file defers to.

    Which means, today, that a private circle contains exactly the people who
    were already in it — its creator, and anyone who joined before this. There
    is no invitation mechanism yet, so there is no way in. That is the honest
    state of the feature and the screen should say so rather than offering a
    button that quietly worked around the privacy setting.
    """
    circle = await _get_circle_or_404(circle_id)
    user_id = str(me["_id"])

    existing = await _circle_members().find_one({"user_id": user_id, "circle_id": circle_id})
    if not existing and circle.get("is_private"):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "This circle is private — someone already in it has to bring you in.",
        )
    if not existing:
        await _circle_members().insert_one(
            CircleMemberModel.create_document(user_id, circle_id)
        )
        await _circles().update_one({"_id": circle["_id"]}, {"$inc": {"member_count": 1}})
        circle["member_count"] = circle.get("member_count", 0) + 1
    return CircleModel.to_response(circle, True)


@router.post("/circles/{circle_id}/leave", response_model=CircleResponse, summary="Leave a circle")
async def leave_circle(circle_id: str, me: dict = Depends(require_active_member)):
    circle = await _get_circle_or_404(circle_id)
    user_id = str(me["_id"])

    removed = await _circle_members().delete_one({"user_id": user_id, "circle_id": circle_id})
    if removed.deleted_count:
        # Guard the counter — a stale double-leave must not push it negative.
        await _circles().update_one(
            {"_id": circle["_id"], "member_count": {"$gt": 0}}, {"$inc": {"member_count": -1}}
        )
        circle["member_count"] = max(circle.get("member_count", 1) - 1, 0)
    return CircleModel.to_response(circle, False)


# --- savings circles ---------------------------------------------------------

def _contributions():
    return get_database()[CircleContributionModel.collection_name]


async def _savings_state(circle: dict, uid: str) -> dict:
    """
    Everything the pay screen shows, in one pass.

    The three reads are independent, so they go together — sequenced, this
    costs three round trips to Atlas before she sees what she owes.
    """
    circle_id = str(circle["_id"])
    round_no = CircleModel.round_of(circle)
    monthly = int(circle.get("monthly_minor", 0))

    members, paid_rows = await asyncio.gather(
        _circle_members().find({"circle_id": circle_id}).sort("turn", 1).to_list(200),
        _contributions().find({"circle_id": circle_id, "round": round_no}).to_list(200),
    )

    # One query for every name, not one query per member. Eleven women in a
    # circle is eleven round trips the naive way, and this screen is opened
    # every month by every one of them.
    ids = [ObjectId(m["user_id"]) for m in members if ObjectId.is_valid(m.get("user_id", ""))]
    users = await get_database()["users"].find(
        {"_id": {"$in": ids}}, {"full_name": 1, "name": 1, "avatar": 1}
    ).to_list(200)
    named = {str(u["_id"]): u for u in users}

    who_paid = {r["user_id"] for r in paid_rows}
    rows = []
    for m in members:
        u = named.get(m["user_id"], {})
        rows.append({
            "name": u.get("full_name") or u.get("name") or "A member",
            "avatar": u.get("avatar", "") or "",
            "turn": int(m.get("turn", 0)),
            "paid": m["user_id"] in who_paid,
            "you": m["user_id"] == uid,
        })

    # Turn 0 means no order has been agreed, and round 0 means the circle does
    # not collect money. Matching them against each other named a woman as this
    # month's recipient of a pot that does not exist.
    turn_taker = ""
    if round_no >= 1:
        turn_taker = next((r["name"] for r in rows if r["turn"] >= 1 and r["turn"] == round_no), "")
    return {
        "circle_id": circle_id,
        "is_savings": bool(circle.get("is_savings", False)),
        "monthly_minor": monthly,
        "round": round_no,
        "collected_minor": sum(int(r.get("amount_minor", 0)) for r in paid_rows),
        "pot_minor": monthly * len(members),
        "members_total": len(members),
        "members_paid": len(who_paid),
        "you_paid": uid in who_paid,
        "whose_turn": turn_taker,
        "members": rows,
    }


@router.get(
    "/circles/{circle_id}/savings",
    response_model=CircleSavingsResponse,
    summary="What this month costs, and who has paid",
)
async def circle_savings(circle_id: str, me: dict = Depends(require_active_member)):
    """
    Membership-gated, like the posts in the same circle already were.

    This endpoint returns every member's full name beside whether she has paid
    this round. It was reachable by anybody signed in who knew the circle id,
    which for a private savings group is the most sensitive thing this
    application holds about a woman: who she saves money with, and that she is
    the one who could not pay. `list_posts` and `create_post` two screens down
    already got this right; this is the same call they make.
    """
    circle = await _get_circle_or_404(circle_id)
    user_id = str(me["_id"])
    await _require_membership(circle, user_id)
    return CircleSavingsResponse(**await _savings_state(circle, user_id))


@router.post(
    "/circles/{circle_id}/contribute",
    response_model=ContributionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Pay into a savings circle",
)
async def contribute(
    circle_id: str,
    request: Request,
    me: dict = Depends(require_active_member),
):
    """
    Pay this round's contribution.

    **Paying twice for one round is impossible by construction**, not by a
    check: `(circle_id, user_id, round)` is a unique index, so a double tap on
    a bad connection loses the second insert rather than moving money twice.
    An `Idempotency-Key` header makes the retry return the first answer instead
    of a refusal.
    """
    return await idempotency.once(
        request, str(me["_id"]), "community.contribute",
        lambda: _contribute(circle_id, me),
    )


async def _contribute(circle_id: str, me: dict):
    circle = await _get_circle_or_404(circle_id)
    uid = str(me["_id"])

    if not circle.get("is_savings"):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This circle does not collect money.",
        )

    member = await _circle_members().find_one({"user_id": uid, "circle_id": circle_id})
    if not member:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "You are not in this circle, so there is nothing to pay into.",
        )

    amount = int(circle.get("monthly_minor", 0))
    if amount <= 0:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This circle has not set what each month costs yet.",
        )

    round_no = CircleModel.round_of(circle)

    # Summed from the ledger, never taken from the request — the same rule the
    # withdrawal path follows, because this is the same money.
    available = await balance_minor(uid)
    if amount > available:
        sym = symbol()
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"You have {sym}{available / 100:,.0f}, and this month's share is "
            f"{sym}{amount / 100:,.0f}.",
        )

    txn = WalletTxnModel.create_document(
        user_id=uid, member_id=me.get("member_id", ""),
        kind=WalletTxnModel.KIND_DEBIT, amount_minor=amount,
        source=WalletTxnModel.SOURCE_SPEND,
        label=f"{circle.get('name', 'Savings circle')} — round {round_no}",
        reference_id=circle_id,
    )
    # The id is minted here rather than left to the insert, so the contribution
    # can name the ledger entry it made while still being written first — the
    # claim has to win or lose at the unique index before any money moves.
    txn["_id"] = ObjectId()

    doc = CircleContributionModel.create_document(
        circle_id=circle_id, user_id=uid, member_id=me.get("member_id", ""),
        round_no=round_no, amount_minor=amount, txn_id=str(txn["_id"]),
    )
    try:
        await _contributions().insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "You have already paid this month. Nothing has been taken twice.",
        )

    # The claim is made before the money moves, so a race loses at the index
    # rather than at the ledger. If the debit then fails, the claim is released
    # — otherwise she could never pay this round at all.
    try:
        await get_database()[WalletTxnModel.collection_name].insert_one(txn)
    except Exception:
        await _contributions().delete_one({"_id": doc["_id"]})
        raise

    state = await _savings_state(circle, uid)
    sym = symbol()
    return ContributionResponse(
        id=str(doc["_id"]),
        round=round_no,
        amount_minor=amount,
        amount_label=f"{sym}{amount / 100:,.0f}",
        paid_on=datetime.now(timezone.utc).strftime("%d %b %Y"),
        members_paid=state["members_paid"],
        members_total=state["members_total"],
        whose_turn=state["whose_turn"],
    )


# --- posts -------------------------------------------------------------------

@router.get("/circles/{circle_id}/posts", response_model=list[PostResponse], summary="Posts in a circle")
async def list_posts(
    circle_id: str,
    limit: int = Query(50, ge=1, le=100),
    me: dict = Depends(require_active_member),
):
    circle = await _get_circle_or_404(circle_id)
    user_id = str(me["_id"])
    await _require_membership(circle, user_id)

    docs = (
        await _posts()
        .find({"circle_id": circle_id, "hidden": {"$ne": True}})
        .sort([("pinned", -1), ("created_at", -1)])
        .to_list(limit)
    )
    return [PostModel.to_response(d, user_id) for d in docs]


@router.post(
    "/circles/{circle_id}/posts",
    response_model=PostResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Say something in a circle",
)
async def create_post(
    circle_id: str,
    body: PostCreate,
    me: dict = Depends(require_active_member),
):
    circle = await _get_circle_or_404(circle_id)
    user_id = str(me["_id"])

    # Posting always requires membership, public circle or not — a circle anyone
    # can shout into is not a circle.
    joined = await _circle_members().find_one({"user_id": user_id, "circle_id": circle_id})
    if not joined:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Join this circle before posting")

    doc = PostModel.create_document(
        circle_id=circle_id,
        user_id=user_id,
        author_name=me.get("full_name", ""),
        author_avatar=me.get("avatar", ""),
        body=body.body,
        image=body.image,
    )
    result = await _posts().insert_one(doc)
    await _circles().update_one({"_id": circle["_id"]}, {"$inc": {"post_count": 1}})
    doc["_id"] = result.inserted_id
    return PostModel.to_response(doc, user_id)


@router.delete("/posts/{post_id}", response_model=MessageResponse, summary="Delete my post")
async def delete_post(post_id: str, me: dict = Depends(require_active_member)):
    user_id = str(me["_id"])
    # The user_id in the filter is what makes this safe: a member cannot delete
    # a post that isn't hers, whatever id she sends.
    post = await _posts().find_one_and_delete({"_id": to_object_id(post_id), "user_id": user_id})
    if not post:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That post isn't yours or no longer exists")

    await _replies().delete_many({"post_id": post_id})
    await _circles().update_one(
        {"_id": to_object_id(post["circle_id"]), "post_count": {"$gt": 0}},
        {"$inc": {"post_count": -1}},
    )
    return {"message": "Post deleted"}


@router.post("/posts/{post_id}/like", response_model=LikeResponse, summary="Like or unlike a post")
async def toggle_like(post_id: str, me: dict = Depends(require_active_member)):
    user_id = str(me["_id"])
    oid = to_object_id(post_id)
    post = await _posts().find_one({"_id": oid, "hidden": {"$ne": True}})
    if not post:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That post no longer exists")

    liked = user_id in (post.get("likes") or [])
    op = "$pull" if liked else "$addToSet"
    updated = await _posts().find_one_and_update(
        {"_id": oid}, {op: {"likes": user_id}}, return_document=True
    )
    likes = updated.get("likes", []) or []
    return {"likes": len(likes), "liked_by_me": user_id in likes}


# --- replies -----------------------------------------------------------------

@router.get("/posts/{post_id}/replies", response_model=list[ReplyResponse], summary="Replies to a post")
async def list_replies(post_id: str, me: dict = Depends(require_active_member)):
    user_id = str(me["_id"])
    post = await _posts().find_one({"_id": to_object_id(post_id), "hidden": {"$ne": True}})
    if not post:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That post no longer exists")
    circle = await _get_circle_or_404(post["circle_id"])
    await _require_membership(circle, user_id)

    docs = (
        await _replies()
        .find({"post_id": post_id, "hidden": {"$ne": True}})
        .sort("created_at", 1)
        .to_list(200)
    )
    return [PostReplyModel.to_response(d, user_id) for d in docs]


@router.post(
    "/posts/{post_id}/replies",
    response_model=ReplyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Reply to a post",
)
async def create_reply(post_id: str, body: ReplyCreate, me: dict = Depends(require_active_member)):
    user_id = str(me["_id"])
    oid = to_object_id(post_id)
    post = await _posts().find_one({"_id": oid, "hidden": {"$ne": True}})
    if not post:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That post no longer exists")

    joined = await _circle_members().find_one(
        {"user_id": user_id, "circle_id": post["circle_id"]}
    )
    if not joined:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Join this circle before replying")

    doc = PostReplyModel.create_document(
        post_id=post_id,
        user_id=user_id,
        author_name=me.get("full_name", ""),
        author_avatar=me.get("avatar", ""),
        body=body.body,
    )
    result = await _replies().insert_one(doc)
    await _posts().update_one({"_id": oid}, {"$inc": {"reply_count": 1}})
    doc["_id"] = result.inserted_id
    return PostReplyModel.to_response(doc, user_id)


@router.delete("/replies/{reply_id}", response_model=MessageResponse, summary="Delete my reply")
async def delete_reply(reply_id: str, me: dict = Depends(require_active_member)):
    user_id = str(me["_id"])
    reply = await _replies().find_one_and_delete(
        {"_id": to_object_id(reply_id), "user_id": user_id}
    )
    if not reply:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That reply isn't yours or no longer exists")
    await _posts().update_one(
        {"_id": to_object_id(reply["post_id"]), "reply_count": {"$gt": 0}},
        {"$inc": {"reply_count": -1}},
    )
    return {"message": "Reply deleted"}


# --- success stories ---------------------------------------------------------

@router.get("/stories", response_model=list[StoryResponse], summary="Success stories")
async def list_stories(
    mine: bool = Query(False, description="Only the ones I submitted"),
    me: dict = Depends(require_active_member),
):
    user_id = str(me["_id"])
    if mine:
        # Her own drafts and pending submissions are visible only to her.
        query = {"user_id": user_id}
    else:
        query = {"status": StoryModel.STATUS_PUBLISHED}

    docs = (
        await _stories()
        .find(query)
        .sort([("featured", -1), ("published_at", -1), ("created_at", -1)])
        .to_list(100)
    )
    return [StoryModel.to_response(d, user_id) for d in docs]


@router.get("/stories/{story_id}", response_model=StoryResponse, summary="One story")
async def get_story(story_id: str, me: dict = Depends(require_active_member)):
    user_id = str(me["_id"])
    doc = await _stories().find_one({"_id": to_object_id(story_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That story doesn't exist")
    # Unpublished stories are readable only by their author.
    if doc.get("status") != StoryModel.STATUS_PUBLISHED and doc.get("user_id") != user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That story doesn't exist")
    return StoryModel.to_response(doc, user_id)


@router.post(
    "/stories",
    response_model=StoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Share my story",
)
async def submit_story(body: StoryCreate, me: dict = Depends(require_active_member)):
    user_id = str(me["_id"])
    doc = StoryModel.create_document(
        user_id=user_id,
        author_name=me.get("full_name", ""),
        author_avatar=me.get("avatar", ""),
        title=body.title,
        body=body.body,
        program=body.program,
        cover=body.cover,
        allow_name=body.allow_name,
    )
    result = await _stories().insert_one(doc)
    doc["_id"] = result.inserted_id
    return StoryModel.to_response(doc, user_id)


@router.post("/stories/{story_id}/like", response_model=LikeResponse, summary="Like a story")
async def like_story(story_id: str, me: dict = Depends(require_active_member)):
    user_id = str(me["_id"])
    oid = to_object_id(story_id)
    doc = await _stories().find_one({"_id": oid, "status": StoryModel.STATUS_PUBLISHED})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That story doesn't exist")

    liked = user_id in (doc.get("likes") or [])
    op = "$pull" if liked else "$addToSet"
    updated = await _stories().find_one_and_update(
        {"_id": oid}, {op: {"likes": user_id}}, return_document=True
    )
    likes = updated.get("likes", []) or []
    return {"likes": len(likes), "liked_by_me": user_id in likes}


# --- seed --------------------------------------------------------------------

_SEED_CIRCLES = [
    {
        "name": "Tailoring & Stitching Sisters",
        "topic": "Craft",
        "desc": "Patterns, fabric sources, pricing your work, and the machine that keeps jamming.",
        "guidelines": "Share what you know. Nobody here is a beginner for asking.",
    },
    {
        "name": "First-Time Business Owners",
        "topic": "Business",
        "desc": "Starting small: registration, pricing, finding your first ten customers.",
        "guidelines": "No selling to each other. Advice only.",
    },
    {
        "name": "Digital Skills Help Desk",
        "topic": "Digital Literacy",
        "desc": "Phone, laptop, UPI, WhatsApp Business, government portals. Ask anything.",
        "guidelines": "There is no silly question in this circle.",
    },
    {
        "name": "Mothers Who Earn",
        "topic": "Work & family",
        "desc": "Working around school hours, childcare, and the guilt nobody talks about.",
        "guidelines": "What's said here stays here.",
    },
    {
        "name": "Job Seekers Together",
        "topic": "Careers",
        "desc": "Interviews, resumes, first jobs after a long gap. We practise together.",
        "guidelines": "Celebrate every offer, however small.",
    },
    {
        "name": "Health & Wellbeing",
        "topic": "Health",
        "desc": "Sleep, periods, stress, and finding a doctor you trust.",
        "guidelines": "We share experiences, not medical advice.",
        "is_private": True,
    },
]

_SEED_POSTS = {
    "Tailoring & Stitching Sisters": [
        ("Meera Joshi", "Finished my first set of 20 blouses for a boutique order today. Six months ago I couldn't cut a straight line. Thank you to everyone in this circle who answered my questions at 11pm."),
        ("Fatima Sheikh", "Where do you all buy lining fabric in bulk? The shop near me has doubled its price and I can't pass that on to customers."),
        ("Lakshmi Reddy", "Tip that took me two years to learn: charge for the fabric separately from the stitching. Customers argue far less, and you stop losing money when cloth prices move."),
    ],
    "Digital Skills Help Desk": [
        ("Sunita Devi", "How do I put my shop on Google Maps? A customer said she couldn't find us and I didn't know what to tell her."),
        ("Priya Nair", "For anyone nervous about UPI — start by sending ₹1 to yourself from your own two apps. Once you've seen it work, the fear goes."),
    ],
    "First-Time Business Owners": [
        ("Anjali Kumar", "Registered my Udyam certificate this week. It took 20 minutes and cost nothing. If you're putting it off like I did, don't."),
        ("Ritu Bansal", "How much did you all charge for your very first order? I keep undercharging because I feel guilty asking."),
    ],
    "Mothers Who Earn": [
        ("Kavita Sharma", "I get my work done between 5am and 7am before the house wakes up. It's not ideal but it's mine. What's your window?"),
    ],
    "Job Seekers Together": [
        ("Neha Gupta", "Got the job. Data entry, ₹14,000, ten minutes from home. My third interview after an eight-year gap. It is possible."),
        ("Shabana Ali", "Does anyone have questions they were asked in a receptionist interview? I have one on Monday and I'm terrified."),
    ],
}

_SEED_STORIES = [
    {
        "author": "Meera Joshi",
        "title": "From one machine in my kitchen to a shop with two staff",
        "program": "Tailoring & Stitching",
        "body": (
            "I started with a second-hand machine my mother-in-law was going to sell. "
            "I could stitch, but I had no idea what to charge, and I said yes to work that lost me money.\n\n"
            "The tailoring programme taught me the cutting properly, but honestly the thing that changed "
            "everything was learning to write down my costs. Once I could see that a blouse took me two "
            "hours and ₹90 of material, I stopped charging ₹150 for it.\n\n"
            "Two years on I have a small shop on the main road and two women working with me. Both of them "
            "were in my batch."
        ),
    },
    {
        "author": "Sunita Devi",
        "title": "I was afraid of the phone. Now I run my orders on it.",
        "program": "Digital Skills for Women",
        "body": (
            "My son set up my phone and I was too embarrassed to tell him I didn't understand any of it. "
            "I would ask my neighbour to check my messages.\n\n"
            "In the digital programme nobody laughed at me. The teacher made me do the same thing ten times "
            "until my hands remembered it. I learned WhatsApp, then photos, then UPI.\n\n"
            "Last month I took forty orders on my phone and I have never once needed my neighbour."
        ),
    },
    {
        "author": "Neha Gupta",
        "title": "Back at work after eight years at home",
        "program": "",
        "body": (
            "When my younger one started school I wanted to work again, but every form asked what I had been "
            "doing since 2018 and I didn't know how to write 'raising two children' in a way anyone would respect.\n\n"
            "The job seekers circle here practised interviews with me. Someone told me to say the gap out loud in "
            "the first minute instead of hiding it. That was the advice that worked.\n\n"
            "I'm three months into a data entry job now. It isn't a career yet. It's a start, and it's mine."
        ),
    },
]


async def seed() -> None:
    """Fill the community collections once, on an empty database."""
    circles = _circles()
    if await circles.count_documents({}) == 0:
        for c in _SEED_CIRCLES:
            doc = CircleModel.create_document(
                name=c["name"],
                topic=c.get("topic", ""),
                desc=c.get("desc", ""),
                guidelines=c.get("guidelines", ""),
                is_private=c.get("is_private", False),
            )
            result = await circles.insert_one(doc)

            posts = _SEED_POSTS.get(c["name"], [])
            for author, body in posts:
                await _posts().insert_one(
                    PostModel.create_document(
                        circle_id=str(result.inserted_id),
                        user_id="",          # seeded voices, not real accounts
                        author_name=author,
                        author_avatar="",
                        body=body,
                    )
                )
            # Seeded circles start with a plausible size so the first real member
            # doesn't walk into an empty room.
            await circles.update_one(
                {"_id": result.inserted_id},
                {"$set": {"post_count": len(posts), "member_count": 12 + len(posts) * 7}},
            )

    stories = _stories()
    if await stories.count_documents({}) == 0:
        now = datetime.now(timezone.utc)
        for i, s in enumerate(_SEED_STORIES):
            doc = StoryModel.create_document(
                user_id="",
                author_name=s["author"],
                author_avatar="",
                title=s["title"],
                body=s["body"],
                program=s.get("program", ""),
            )
            doc["status"] = StoryModel.STATUS_PUBLISHED
            doc["published_at"] = now
            doc["featured"] = i == 0
            await stories.insert_one(doc)
