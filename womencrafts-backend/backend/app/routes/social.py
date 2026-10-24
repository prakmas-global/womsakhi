"""
Community — friends, and a feed of posts with likes and comments.

── Friends ──────────────────────────────────────────────────────────────────
One `friendships` row per pair: `users` is the two ids sorted, so the pair has
one place whichever of them asked first (a unique index holds it). `status`
is "pending" while one has asked, "accepted" once the other said yes. Declining
or cancelling deletes the row — nobody is told "she said no". If she asks
someone who has already asked her, that is a yes.

── Who sees a post ──────────────────────────────────────────────────────────
She picks per post: "friends" (the default) or "everyone". An everyone-post is
read by every admitted member; a friends-post only by her and her friends.
Every read below goes through `_visible_query` / `_can_see`, so a link to a
post she may not see answers 404, not the post.

── Earlier circle posts ─────────────────────────────────────────────────────
Circles became group chats. The posts from PUBLIC circles move into this feed
once (audience "everyone", `source.circle_post`), with their replies as
comments; private-circle posts stay in their circle.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from app.core import usernames as un
from app.core.media import MediaRef, media_url
from app.core.rbac import require_active_member
from app.db.mongodb import get_database
from app.models.community import _ago
from app.models.conversation import notify
from app.routes import people
from app.routes.people import MEMBER_FILTER, PersonRow, person_row

router = APIRouter(tags=["Community"])

DAILY_REQUESTS = 40
DAILY_POSTS = 30
PAGE = 10
REPORT_REASONS = ["Rude or hurtful", "Spam or selling", "False information", "Not safe", "Something else"]


def _db():
    return get_database()


def _uid(me: dict) -> str:
    return str(me["_id"])


def _pair(a: str, b: str) -> list[str]:
    return sorted([a, b])


def _oid(raw: str, what: str = "Not found") -> ObjectId:
    if not ObjectId.is_valid(raw or ""):
        raise HTTPException(status.HTTP_404_NOT_FOUND, what)
    return ObjectId(raw)


async def friend_ids(uid: str) -> list[str]:
    rows = _db()["friendships"].find({"users": uid, "status": "accepted"}, {"users": 1})
    return [u for r in [r async for r in rows] for u in r["users"] if u != uid]


async def _member_or_404(user_id: str) -> dict:
    u = await _db()["users"].find_one({**MEMBER_FILTER, "_id": _oid(user_id, "No such member")})
    if not u:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such member")
    return u


async def _rows_for(ids: list[str], relation: str = "") -> list[PersonRow]:
    oids = [ObjectId(i) for i in ids if ObjectId.is_valid(i)]
    users = [u async for u in _db()["users"].find({**MEMBER_FILTER, "_id": {"$in": oids}})]
    members = await people._members_of(users)
    order = {i: n for n, i in enumerate(ids)}
    rows = [person_row(u, members.get(u.get("member_id") or "")) for u in users]
    rows.sort(key=lambda r: order.get(r.id, 0))
    if relation:
        for r in rows:
            r.relation = relation
    return rows


# --- relation filler for people search and profiles ---------------------------

async def _fill(me: dict, rows: list[PersonRow]) -> None:
    uid = _uid(me)
    others = [r.id for r in rows if r.id != uid]
    if not others:
        return
    found = _db()["friendships"].find({"users": {"$all": [uid]}, "$or": [{"users": o} for o in others]})
    by: dict[str, str] = {}
    async for f in found:
        other = next((u for u in f["users"] if u != uid), "")
        if f.get("status") == "accepted":
            by[other] = "friends"
        else:
            by[other] = "sent" if f.get("requester") == uid else "received"
    for r in rows:
        if r.id in by:
            r.relation = by[r.id]


if _fill not in people.RELATION_FILLERS:
    people.RELATION_FILLERS.append(_fill)


# --- friends -------------------------------------------------------------------

class FriendTarget(BaseModel):
    user_id: str


class FriendState(BaseModel):
    user_id: str
    relation: str


class RequestRow(PersonRow):
    when: str = ""
    mutual: int = 0


class FriendRequests(BaseModel):
    incoming: list[RequestRow]
    sent: list[RequestRow]


class Suggestion(PersonRow):
    reason: str = ""
    mutual: int = 0


async def _accept(f: dict, me: dict, other_id: str) -> FriendState:
    now = datetime.now(timezone.utc)
    await _db()["friendships"].update_one({"_id": f["_id"]}, {"$set": {"status": "accepted", "accepted_at": now}})
    await notify(_db(), other_id, f"{un.display_name(me)} accepted your friend request",
                 "You can now see each other's friends-only posts.", "circle",
                 f"/app/community/u/{me.get('username') or _uid(me)}")
    return FriendState(user_id=other_id, relation="friends")


@router.post("/friends/requests", response_model=FriendState, summary="Send a friend request")
async def send_request(body: FriendTarget, me: dict = Depends(require_active_member)):
    uid = _uid(me)
    if body.user_id == uid:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "You cannot add yourself")
    other = await _member_or_404(body.user_id)
    oid = str(other["_id"])
    pair = _pair(uid, oid)
    existing = await _db()["friendships"].find_one({"users": pair})
    if existing:
        if existing.get("status") == "accepted":
            return FriendState(user_id=oid, relation="friends")
        if existing.get("requester") == uid:
            return FriendState(user_id=oid, relation="sent")
        return await _accept(existing, me, oid)
    since = datetime.now(timezone.utc) - timedelta(days=1)
    if await _db()["friendships"].count_documents({"requester": uid, "created_at": {"$gte": since}}) >= DAILY_REQUESTS:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            "You have sent a lot of requests today. Try again tomorrow.")
    try:
        await _db()["friendships"].insert_one({
            "users": pair, "requester": uid, "status": "pending",
            "created_at": datetime.now(timezone.utc), "accepted_at": None,
        })
    except DuplicateKeyError:
        return await send_request(body, me)
    await notify(_db(), oid, f"{un.display_name(me)} sent you a friend request",
                 "Accept to see each other's friends-only posts.", "circle", "/app/community/friends")
    return FriendState(user_id=oid, relation="sent")


async def _pending_from(requester: str, other: str) -> Optional[dict]:
    return await _db()["friendships"].find_one(
        {"users": _pair(requester, other), "status": "pending", "requester": requester})


@router.post("/friends/requests/{user_id}/accept", response_model=FriendState, summary="Accept her request")
async def accept_request(user_id: str, me: dict = Depends(require_active_member)):
    f = await _pending_from(user_id, _uid(me))
    if not f:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That request is no longer open")
    return await _accept(f, me, user_id)


@router.post("/friends/requests/{user_id}/decline", response_model=FriendState, summary="Decline her request")
async def decline_request(user_id: str, me: dict = Depends(require_active_member)):
    f = await _pending_from(user_id, _uid(me))
    if f:
        await _db()["friendships"].delete_one({"_id": f["_id"]})
    return FriendState(user_id=user_id, relation="none")


@router.delete("/friends/requests/{user_id}", response_model=FriendState, summary="Cancel my request")
async def cancel_request(user_id: str, me: dict = Depends(require_active_member)):
    f = await _pending_from(_uid(me), user_id)
    if f:
        await _db()["friendships"].delete_one({"_id": f["_id"]})
    return FriendState(user_id=user_id, relation="none")


@router.delete("/friends/{user_id}", response_model=FriendState, summary="Unfriend")
async def unfriend(user_id: str, me: dict = Depends(require_active_member)):
    await _db()["friendships"].delete_one({"users": _pair(_uid(me), user_id), "status": "accepted"})
    return FriendState(user_id=user_id, relation="none")


@router.get("/friends", response_model=list[PersonRow], summary="My friends")
async def my_friends(me: dict = Depends(require_active_member)):
    return await _rows_for(await friend_ids(_uid(me)), "friends")


async def _mutual_counts(uid: str, others: list[str]) -> dict[str, int]:
    mine = set(await friend_ids(uid))
    if not mine or not others:
        return {}
    out: dict[str, int] = {}
    rows = _db()["friendships"].find({"status": "accepted", "users": {"$in": others}})
    async for f in rows:
        a, b = f["users"]
        for o, x in ((a, b), (b, a)):
            if o in others and x in mine:
                out[o] = out.get(o, 0) + 1
    return out


@router.get("/friends/requests", response_model=FriendRequests, summary="Requests to me, and mine")
async def requests(me: dict = Depends(require_active_member)):
    uid = _uid(me)
    rows = [f async for f in _db()["friendships"].find({"users": uid, "status": "pending"}).sort("created_at", -1)]
    inc = [(next(u for u in f["users"] if u != uid), f) for f in rows if f.get("requester") != uid]
    out = [(next(u for u in f["users"] if u != uid), f) for f in rows if f.get("requester") == uid]
    mutual = await _mutual_counts(uid, [o for o, _ in inc + out])

    async def build(pairs, relation):
        people_rows = {r.id: r for r in await _rows_for([o for o, _ in pairs], relation)}
        return [RequestRow(**people_rows[o].model_dump(), when=_ago(f.get("created_at")), mutual=mutual.get(o, 0))
                for o, f in pairs if o in people_rows]

    return FriendRequests(incoming=await build(inc, "received"), sent=await build(out, "sent"))


@router.get("/friends/suggestions", response_model=list[Suggestion], summary="People you may know")
async def suggestions(limit: int = Query(8, ge=1, le=20), me: dict = Depends(require_active_member)):
    uid = _uid(me)
    known = {uid}
    async for f in _db()["friendships"].find({"users": uid}, {"users": 1}):
        known.update(f["users"])
    mine = await friend_ids(uid)
    score: dict[str, list] = {}  # id -> [points, reason, mutual]

    # Friends of friends.
    if mine:
        async for f in _db()["friendships"].find({"status": "accepted", "users": {"$in": mine}}, {"users": 1}):
            for o in f["users"]:
                if o not in known:
                    s = score.setdefault(o, [0, "", 0])
                    s[0] += 3
                    s[2] += 1
                    s[1] = f"{s[2]} mutual friend{'s' if s[2] > 1 else ''}"
    # Women in her circles.
    circles = [c["circle_id"] async for c in _db()["circle_members"].find({"user_id": uid}, {"circle_id": 1})]
    if circles:
        names = {str(c["_id"]): c.get("name", "") async for c in _db()["circles"].find(
            {"_id": {"$in": [ObjectId(c) for c in circles if ObjectId.is_valid(c)]}}, {"name": 1})}
        async for m in _db()["circle_members"].find({"circle_id": {"$in": circles}}, {"user_id": 1, "circle_id": 1}).limit(400):
            o = m["user_id"]
            if o not in known:
                s = score.setdefault(o, [0, "", 0])
                s[0] += 2
                if not s[1]:
                    s[1] = f"In {names.get(m['circle_id']) or 'your circle'}"
    # Same city.
    city = ""
    if ObjectId.is_valid(me.get("member_id") or ""):
        mem = await _db()["members"].find_one({"_id": ObjectId(me["member_id"])}, {"display_location": 1, "location": 1})
        city = ((mem or {}).get("display_location") or (mem or {}).get("location") or "").split(",")[0].strip()
    if city:
        import re
        mids = [str(m["_id"]) async for m in _db()["members"].find(
            {"$or": [{"display_location": {"$regex": "^" + re.escape(city), "$options": "i"}},
                     {"location": {"$regex": "^" + re.escape(city), "$options": "i"}}]}, {"_id": 1}).limit(200)]
        async for u in _db()["users"].find({**MEMBER_FILTER, "member_id": {"$in": mids}}, {"_id": 1}):
            o = str(u["_id"])
            if o not in known:
                s = score.setdefault(o, [0, "", 0])
                s[0] += 1
                if not s[1]:
                    s[1] = f"Also in {city}"
    # Fill up with recently joined members so the rail is never empty.
    if len(score) < limit:
        async for u in _db()["users"].find(MEMBER_FILTER, {"_id": 1}).sort("created_at", -1).limit(limit * 3):
            o = str(u["_id"])
            if o not in known and o not in score:
                score[o] = [0, "New on WomSakhi", 0]
    ranked = sorted(score.items(), key=lambda kv: -kv[1][0])[: limit * 2]
    rows = {r.id: r for r in await _rows_for([o for o, _ in ranked])}
    out = [Suggestion(**rows[o].model_dump(), reason=s[1], mutual=s[2]) for o, s in ranked if o in rows]
    return out[:limit]


# --- the feed ------------------------------------------------------------------

Audience = Literal["friends", "everyone"]


class Author(BaseModel):
    id: str
    name: str
    username: str = ""
    avatar: str = ""
    verified: bool = False


class FeedPost(BaseModel):
    id: str
    author: Author
    text: str
    photos: list[str] = []
    audience: str
    like_count: int = 0
    liked_by_me: bool = False
    comment_count: int = 0
    mine: bool = False
    created_at: str
    when: str
    from_circle: str = ""


class FeedPage(BaseModel):
    posts: list[FeedPost]
    next: str = ""


class PostIn(BaseModel):
    text: str = Field("", max_length=2000)
    photos: list[MediaRef] = Field(default_factory=list, max_length=4)
    audience: Audience = "friends"


class PostPatch(BaseModel):
    text: Optional[str] = Field(None, max_length=2000)
    audience: Optional[Audience] = None


class LikeState(BaseModel):
    liked: bool
    like_count: int


class CommentIn(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000)


class Comment(BaseModel):
    id: str
    author: Author
    text: str
    when: str
    created_at: str
    mine: bool = False
    can_delete: bool = False


class ReportIn(BaseModel):
    reason: str = Field(..., max_length=60)


class Done(BaseModel):
    ok: bool = True
    message: str = ""


async def _authors(ids: set[str]) -> dict[str, Author]:
    oids = [ObjectId(i) for i in ids if ObjectId.is_valid(i)]
    out: dict[str, Author] = {}
    async for u in _db()["users"].find({"_id": {"$in": oids}},
                                       {"full_name": 1, "username": 1, "avatar": 1, "verification_status": 1}):
        out[str(u["_id"])] = Author(id=str(u["_id"]), name=un.display_name(u), username=u.get("username") or "",
                                     avatar=media_url(u.get("avatar", "")),
                                     verified=u.get("verification_status") == "active")
    return out


def _iso(d) -> str:
    return d.isoformat() if isinstance(d, datetime) else ""


async def _shape(posts: list[dict], uid: str) -> list[FeedPost]:
    authors = await _authors({p["author_id"] for p in posts})
    out = []
    for p in posts:
        # A post copied from a circle keeps the name it was written under.
        a = authors.get(p["author_id"]) or Author(id=p["author_id"], name=p.get("author_name") or "A member",
                                                  avatar=media_url(p.get("author_avatar", "")))
        out.append(FeedPost(
            id=str(p["_id"]), author=a, text=p.get("text", ""),
            photos=[media_url(x) for x in p.get("photos") or [] if x],
            audience=p.get("audience", "friends"), like_count=int(p.get("like_count", 0)),
            liked_by_me=uid in (p.get("likes") or []), comment_count=int(p.get("comment_count", 0)),
            mine=p["author_id"] == uid, created_at=_iso(p.get("created_at")), when=_ago(p.get("created_at")),
            from_circle=(p.get("source") or {}).get("circle_name", ""),
        ))
    return out


def _live(uid: str) -> dict:
    return {"deleted": {"$ne": True}, "hidden": {"$ne": True}, "reported_by": {"$ne": uid}}


async def _visible_query(uid: str, friends: Optional[list[str]] = None) -> dict:
    if friends is None:
        friends = await friend_ids(uid)
    return {**_live(uid), "$or": [{"audience": "everyone"}, {"author_id": {"$in": friends + [uid]}}]}


async def _can_see(post_id: str, uid: str) -> dict:
    q = await _visible_query(uid)
    post = await _db()["feed_posts"].find_one({**q, "_id": _oid(post_id, "Post not found")})
    if not post:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
    return post


async def _page(query: dict, before: str, limit: int, uid: str) -> FeedPage:
    # Newest first by when it was written — posts copied in from circles keep
    # their own dates — with the id breaking ties. The cursor is the last id.
    if before and ObjectId.is_valid(before):
        cur = await _db()["feed_posts"].find_one({"_id": ObjectId(before)}, {"created_at": 1})
        if cur:
            query = {"$and": [query, {"$or": [{"created_at": {"$lt": cur["created_at"]}},
                                              {"created_at": cur["created_at"], "_id": {"$lt": cur["_id"]}}]}]}
    rows = [p async for p in _db()["feed_posts"].find(query).sort([("created_at", -1), ("_id", -1)]).limit(limit + 1)]
    more = len(rows) > limit
    rows = rows[:limit]
    return FeedPage(posts=await _shape(rows, uid), next=str(rows[-1]["_id"]) if more and rows else "")


@router.get("/feed", response_model=FeedPage, summary="The community feed")
async def feed(tab: Literal["all", "friends", "mine"] = "all", before: str = "",
               limit: int = Query(PAGE, ge=1, le=30), me: dict = Depends(require_active_member)):
    uid = _uid(me)
    await migrate_circle_posts()
    friends = await friend_ids(uid)
    if tab == "mine":
        q = {**_live(uid), "author_id": uid}
    elif tab == "friends":
        q = {**_live(uid), "author_id": {"$in": friends}}
    else:
        q = await _visible_query(uid, friends)
    return await _page(q, before, limit, uid)


@router.get("/feed/user/{user_id}", response_model=FeedPage, summary="One member's posts I may see")
async def user_feed(user_id: str, before: str = "", limit: int = Query(PAGE, ge=1, le=30),
                    me: dict = Depends(require_active_member)):
    uid = _uid(me)
    q = {**_live(uid), "author_id": user_id}
    if user_id != uid and user_id not in await friend_ids(uid):
        q["audience"] = "everyone"
    return await _page(q, before, limit, uid)


@router.post("/feed/posts", response_model=FeedPost, status_code=status.HTTP_201_CREATED, summary="Post")
async def create_post(body: PostIn, me: dict = Depends(require_active_member)):
    uid = _uid(me)
    text = body.text.strip()
    photos = [p for p in body.photos if p][:4]
    if not text and not photos:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Write something or add a photo")
    since = datetime.now(timezone.utc) - timedelta(days=1)
    if await _db()["feed_posts"].count_documents({"author_id": uid, "created_at": {"$gte": since}}) >= DAILY_POSTS:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "That is a lot of posts for one day. Try again tomorrow.")
    doc = {"author_id": uid, "text": text, "photos": photos, "audience": body.audience,
           "likes": [], "like_count": 0, "comment_count": 0, "reported_by": [], "deleted": False,
           "created_at": datetime.now(timezone.utc)}
    doc["_id"] = (await _db()["feed_posts"].insert_one(doc)).inserted_id
    return (await _shape([doc], uid))[0]


async def _own(post_id: str, uid: str) -> dict:
    post = await _db()["feed_posts"].find_one({"_id": _oid(post_id, "Post not found"), "deleted": {"$ne": True}})
    if not post:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
    if post["author_id"] != uid:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the person who posted can change this")
    return post


@router.patch("/feed/posts/{post_id}", response_model=FeedPost, summary="Edit my post")
async def edit_post(post_id: str, body: PostPatch, me: dict = Depends(require_active_member)):
    uid = _uid(me)
    post = await _own(post_id, uid)
    patch: dict = {"updated_at": datetime.now(timezone.utc)}
    if body.text is not None:
        if not body.text.strip() and not post.get("photos"):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Write something or add a photo")
        patch["text"] = body.text.strip()
    if body.audience is not None:
        patch["audience"] = body.audience
    await _db()["feed_posts"].update_one({"_id": post["_id"]}, {"$set": patch})
    return (await _shape([{**post, **patch}], uid))[0]


@router.delete("/feed/posts/{post_id}", response_model=Done, summary="Delete my post")
async def delete_post(post_id: str, me: dict = Depends(require_active_member)):
    post = await _own(post_id, _uid(me))
    await _db()["feed_posts"].update_one({"_id": post["_id"]},
                                         {"$set": {"deleted": True, "deleted_at": datetime.now(timezone.utc)}})
    return Done(message="Post deleted")


@router.post("/feed/posts/{post_id}/like", response_model=LikeState, summary="Like or unlike")
async def like(post_id: str, me: dict = Depends(require_active_member)):
    uid = _uid(me)
    post = await _can_see(post_id, uid)
    col = _db()["feed_posts"]
    if uid in (post.get("likes") or []):
        await col.update_one({"_id": post["_id"], "likes": uid}, {"$pull": {"likes": uid}, "$inc": {"like_count": -1}})
    else:
        res = await col.update_one({"_id": post["_id"], "likes": {"$ne": uid}},
                                   {"$addToSet": {"likes": uid}, "$inc": {"like_count": 1}})
        # One "liked your post" an hour per post, however many hearts arrive.
        hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
        if res.modified_count and post["author_id"] != uid:
            claimed = await col.update_one(
                {"_id": post["_id"], "$or": [{"like_notified_at": None}, {"like_notified_at": {"$lt": hour_ago}}]},
                {"$set": {"like_notified_at": datetime.now(timezone.utc)}})
            if claimed.modified_count:
                await notify(_db(), post["author_id"], f"{un.display_name(me)} liked your post",
                             (post.get("text") or "")[:80], "circle", "/app/community")
    fresh = await col.find_one({"_id": post["_id"]}, {"likes": 1, "like_count": 1})
    return LikeState(liked=uid in (fresh.get("likes") or []), like_count=max(0, int(fresh.get("like_count", 0))))


async def _shape_comments(rows: list[dict], uid: str, post_author: str) -> list[Comment]:
    authors = await _authors({c["author_id"] for c in rows})
    return [Comment(id=str(c["_id"]), author=authors.get(c["author_id"]) or Author(id=c["author_id"], name="A member"),
                    text=c.get("text", ""), when=_ago(c.get("created_at")), created_at=_iso(c.get("created_at")),
                    mine=c["author_id"] == uid, can_delete=uid in (c["author_id"], post_author))
            for c in rows]


@router.get("/feed/posts/{post_id}/comments", response_model=list[Comment], summary="Comments on a post")
async def comments(post_id: str, me: dict = Depends(require_active_member)):
    uid = _uid(me)
    post = await _can_see(post_id, uid)
    rows = [c async for c in _db()["feed_comments"].find(
        {"post_id": post_id, "deleted": {"$ne": True}}).sort("created_at", 1).limit(200)]
    return await _shape_comments(rows, uid, post["author_id"])


@router.post("/feed/posts/{post_id}/comments", response_model=Comment, status_code=status.HTTP_201_CREATED)
async def add_comment(post_id: str, body: CommentIn, me: dict = Depends(require_active_member)):
    uid = _uid(me)
    post = await _can_see(post_id, uid)
    text = body.text.strip()
    if not text:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Write a comment first")
    doc = {"post_id": post_id, "author_id": uid, "text": text, "deleted": False, "created_at": datetime.now(timezone.utc)}
    doc["_id"] = (await _db()["feed_comments"].insert_one(doc)).inserted_id
    await _db()["feed_posts"].update_one({"_id": post["_id"]}, {"$inc": {"comment_count": 1}})
    if post["author_id"] != uid:
        await notify(_db(), post["author_id"], f"{un.display_name(me)} commented on your post",
                     text[:80], "circle", "/app/community")
    return (await _shape_comments([doc], uid, post["author_id"]))[0]


@router.delete("/feed/comments/{comment_id}", response_model=Done, summary="Delete a comment")
async def delete_comment(comment_id: str, me: dict = Depends(require_active_member)):
    uid = _uid(me)
    c = await _db()["feed_comments"].find_one({"_id": _oid(comment_id, "Comment not found"), "deleted": {"$ne": True}})
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Comment not found")
    post = await _db()["feed_posts"].find_one({"_id": _oid(c["post_id"])}, {"author_id": 1})
    if uid not in (c["author_id"], (post or {}).get("author_id")):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can delete your own comments, or any on your post")
    await _db()["feed_comments"].update_one({"_id": c["_id"]}, {"$set": {"deleted": True}})
    if post:
        await _db()["feed_posts"].update_one({"_id": post["_id"], "comment_count": {"$gt": 0}},
                                             {"$inc": {"comment_count": -1}})
    return Done(message="Comment deleted")


@router.get("/feed/report-reasons", response_model=list[str])
async def report_reasons(me: dict = Depends(require_active_member)):
    return REPORT_REASONS


@router.post("/feed/posts/{post_id}/report", response_model=Done, summary="Report a post")
async def report(post_id: str, body: ReportIn, me: dict = Depends(require_active_member)):
    uid = _uid(me)
    post = await _can_see(post_id, uid)
    if post["author_id"] == uid:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "You cannot report your own post")
    reason = body.reason if body.reason in REPORT_REASONS else "Something else"
    await _db()["feed_reports"].update_one(
        {"post_id": post_id, "reporter_id": uid},
        {"$set": {"reason": reason, "author_id": post["author_id"], "status": "open",
                  "created_at": datetime.now(timezone.utc)}},
        upsert=True)
    # She never sees it again; three different women reporting it takes it
    # down until staff look.
    await _db()["feed_posts"].update_one({"_id": post["_id"]}, {"$addToSet": {"reported_by": uid}})
    if await _db()["feed_reports"].count_documents({"post_id": post_id}) >= 3:
        await _db()["feed_posts"].update_one({"_id": post["_id"]}, {"$set": {"hidden": True}})
    return Done(message="Thank you. You will not see this post again, and our team will look at it.")


# --- earlier circle posts --------------------------------------------------------

MIGRATION = "circle_posts_to_feed_v1"


async def migrate_circle_posts(force: bool = False) -> int:
    """Copy public-circle posts (and their replies) into the feed, once. Returns posts copied."""
    db = _db()
    if not force and await db["feed_meta"].find_one({"_id": MIGRATION}):
        return 0
    public = {str(c["_id"]): c.get("name", "") async for c in db["circles"].find(
        {"is_private": {"$ne": True}}, {"name": 1})}
    copied = 0
    async for p in db["circle_posts"].find({"circle_id": {"$in": list(public)}, "hidden": {"$ne": True}}):
        likes = list(p.get("likes") or [])
        res = await db["feed_posts"].update_one(
            {"source.circle_post": str(p["_id"])},
            {"$setOnInsert": {
                "author_id": p.get("user_id", ""), "text": p.get("body", ""),
                "author_name": p.get("author_name", ""), "author_avatar": p.get("author_avatar", ""),
                "photos": [p["image"]] if p.get("image") else [], "audience": "everyone",
                "likes": likes, "like_count": len(likes), "comment_count": 0, "reported_by": [],
                "deleted": False, "created_at": p.get("created_at") or datetime.now(timezone.utc),
                "source": {"circle_post": str(p["_id"]), "circle_id": p.get("circle_id", ""),
                           "circle_name": public.get(p.get("circle_id", ""), "")},
            }}, upsert=True)
        if not res.upserted_id:
            continue
        copied += 1
        n = 0
        async for r in db["post_replies"].find({"post_id": str(p["_id"]), "hidden": {"$ne": True}}):
            await db["feed_comments"].update_one(
                {"source.reply": str(r["_id"])},
                {"$setOnInsert": {"post_id": str(res.upserted_id), "author_id": r.get("user_id", ""),
                                  "text": r.get("body", ""), "deleted": False,
                                  "created_at": r.get("created_at") or datetime.now(timezone.utc),
                                  "source": {"reply": str(r["_id"])}}},
                upsert=True)
            n += 1
        if n:
            await db["feed_posts"].update_one({"_id": res.upserted_id}, {"$set": {"comment_count": n}})
    await db["feed_meta"].update_one({"_id": MIGRATION},
                                     {"$set": {"done_at": datetime.now(timezone.utc), "copied": copied}}, upsert=True)
    return copied
