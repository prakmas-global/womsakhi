"""
Community: friend requests, who sees which post, likes, comments, reports,
the people-search relation, and the one-time move of public circle posts.

Runs against the throwaway local mongod on 127.0.0.1:27099 (skipped when it is
not running). Every row this module writes is removed afterwards.
"""

import uuid
from datetime import datetime, timezone

import httpx
import pytest

from app.core import cache, ratelimit, sessions
from app.core.config import settings
from app.db import mongodb
from tests.conftest import LOCAL_MONGO_DB


@pytest.fixture
async def api(local_mongo, monkeypatch):
    monkeypatch.setattr(settings, "DB_NAME", LOCAL_MONGO_DB)
    monkeypatch.setattr(settings, "REDIS_URL", "")
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    mongodb._client, mongodb._db = local_mongo, None
    cache.clear()
    ratelimit._hits.clear()
    from main import app

    db = mongodb.get_database()
    made = {"users": [], "circles": []}
    transport = httpx.ASGITransport(app=app)
    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://test/api/v1") as client:
            yield client, db, made
    finally:
        uids = [str(u) for u in made["users"]]
        cids = [str(c) for c in made["circles"]]
        await db["users"].delete_many({"_id": {"$in": made["users"]}})
        await db[sessions.COLLECTION].delete_many({"user_id": {"$in": uids}})
        await db["friendships"].delete_many({"users": {"$in": uids}})
        posts = [str(p["_id"]) async for p in db["feed_posts"].find({"author_id": {"$in": uids}}, {"_id": 1})]
        await db["feed_comments"].delete_many({"$or": [{"post_id": {"$in": posts}}, {"author_id": {"$in": uids}}]})
        await db["feed_reports"].delete_many({"post_id": {"$in": posts}})
        await db["feed_posts"].delete_many({"author_id": {"$in": uids}})
        await db["member_notifications"].delete_many({"user_id": {"$in": uids}})
        await db["circles"].delete_many({"_id": {"$in": made["circles"]}})
        await db["circle_posts"].delete_many({"circle_id": {"$in": cids}})
        await db["post_replies"].delete_many({"user_id": {"$in": uids}})
        cache.clear()
        mongodb._client, mongodb._db = None, None


async def _member(db, made, name: str, *, status: str = "active", **extra):
    now = datetime.now(timezone.utc)
    doc = {
        "full_name": name, "email": f"soc-{uuid.uuid4().hex[:10]}@example.com",
        "email_verified_at": now, "role": "Member", "is_active": True, "token_version": 0,
        "verification_status": status, "created_at": now, "updated_at": now, **extra,
    }
    doc["_id"] = (await db["users"].insert_one(doc)).inserted_id
    made["users"].append(doc["_id"])
    tokens = await sessions.start(None, doc)
    return str(doc["_id"]), {"Authorization": f"Bearer {tokens['access_token']}"}


async def _friends(client, a, ha, b, hb):
    assert (await client.post("/friends/requests", json={"user_id": b}, headers=ha)).json()["relation"] == "sent"
    assert (await client.post(f"/friends/requests/{a}/accept", headers=hb)).json()["relation"] == "friends"


async def test_friend_request_accept_and_unfriend(api):
    client, db, made = api
    a, ha = await _member(db, made, "Asha")
    b, hb = await _member(db, made, "Bina")
    assert (await client.post("/friends/requests", json={"user_id": a}, headers=ha)).status_code == 422
    sent = await client.post("/friends/requests", json={"user_id": b}, headers=ha)
    assert sent.json()["relation"] == "sent"
    again = await client.post("/friends/requests", json={"user_id": b}, headers=ha)
    assert again.json()["relation"] == "sent"
    reqs = (await client.get("/friends/requests", headers=hb)).json()
    assert [r["id"] for r in reqs["incoming"]] == [a] and reqs["sent"] == []
    assert [r["id"] for r in (await client.get("/friends/requests", headers=ha)).json()["sent"]] == [b]
    assert await db["member_notifications"].count_documents({"user_id": b}) == 1
    assert (await client.post(f"/friends/requests/{a}/accept", headers=hb)).json()["relation"] == "friends"
    assert [f["id"] for f in (await client.get("/friends", headers=ha)).json()] == [b]
    assert (await client.delete(f"/friends/{a}", headers=hb)).json()["relation"] == "none"
    assert (await client.get("/friends", headers=ha)).json() == []


async def test_decline_cancel_and_crossing_requests(api):
    client, db, made = api
    a, ha = await _member(db, made, "Asha")
    b, hb = await _member(db, made, "Bina")
    await client.post("/friends/requests", json={"user_id": b}, headers=ha)
    await client.post(f"/friends/requests/{a}/decline", headers=hb)
    assert (await client.get("/friends/requests", headers=ha)).json()["sent"] == []
    await client.post("/friends/requests", json={"user_id": b}, headers=ha)
    await client.delete(f"/friends/requests/{b}", headers=ha)
    assert (await client.get("/friends/requests", headers=hb)).json()["incoming"] == []
    # She asks; then he asks her back — that is a yes.
    await client.post("/friends/requests", json={"user_id": b}, headers=ha)
    crossed = await client.post("/friends/requests", json={"user_id": a}, headers=hb)
    assert crossed.json()["relation"] == "friends"
    # Accepting a request that is not there.
    assert (await client.post(f"/friends/requests/{b}/accept", headers=ha)).status_code == 404


async def test_pending_member_cannot_be_added(api):
    client, db, made = api
    a, ha = await _member(db, made, "Asha")
    w, _ = await _member(db, made, "Waiting", status="pending_review")
    assert (await client.post("/friends/requests", json={"user_id": w}, headers=ha)).status_code == 404


async def test_people_rows_carry_the_relation(api):
    client, db, made = api
    tag = uuid.uuid4().hex[:6]
    a, ha = await _member(db, made, "Asha", username=f"so{tag}.asha")
    b, hb = await _member(db, made, "Bina", username=f"so{tag}.bina")
    c, hc = await _member(db, made, "Chitra", username=f"so{tag}.chitra")
    await client.post("/friends/requests", json={"user_id": b}, headers=ha)
    await client.post("/friends/requests", json={"user_id": a}, headers=hc)
    rows = {r["id"]: r["relation"] for r in (await client.get("/people/search", params={"q": f"so{tag}"}, headers=ha)).json()}
    assert rows == {b: "sent", c: "received"}
    await client.post(f"/friends/requests/{c}/accept", headers=ha)
    card = (await client.get(f"/people/u/so{tag}.chitra", headers=ha)).json()
    assert card["relation"] == "friends" and card["friends"] == 1


async def test_friends_only_posts_stay_with_friends(api):
    client, db, made = api
    a, ha = await _member(db, made, "Asha")
    b, hb = await _member(db, made, "Bina")
    s, hs = await _member(db, made, "Stranger")
    await _friends(client, a, ha, b, hb)
    p_friends = (await client.post("/feed/posts", json={"text": "Just for friends"}, headers=ha)).json()
    p_all = (await client.post("/feed/posts", json={"text": "For everyone", "audience": "everyone"}, headers=ha)).json()
    assert p_friends["audience"] == "friends" and p_friends["author"]["name"] == "Asha"
    ids = lambda r: [p["id"] for p in r.json()["posts"]]
    assert set(ids(await client.get("/feed", headers=hb))) >= {p_friends["id"], p_all["id"]}
    seen = ids(await client.get("/feed", headers=hs))
    assert p_all["id"] in seen and p_friends["id"] not in seen
    assert ids(await client.get(f"/feed/user/{a}", headers=hs)) == [p_all["id"]]
    assert (await client.get(f"/feed/posts/{p_friends['id']}/comments", headers=hs)).status_code == 404
    assert (await client.post(f"/feed/posts/{p_friends['id']}/like", headers=hs)).status_code == 404
    assert set(ids(await client.get("/feed", params={"tab": "friends"}, headers=hb))) == {p_friends["id"], p_all["id"]}
    assert set(ids(await client.get("/feed", params={"tab": "mine"}, headers=ha))) == {p_friends["id"], p_all["id"]}
    # Changing the audience opens it up.
    await client.patch(f"/feed/posts/{p_friends['id']}", json={"audience": "everyone"}, headers=ha)
    assert p_friends["id"] in ids(await client.get("/feed", headers=hs))
    assert (await client.patch(f"/feed/posts/{p_friends['id']}", json={"text": "x"}, headers=hs)).status_code == 403
    assert (await client.post("/feed/posts", json={"text": "  "}, headers=ha)).status_code == 422


async def test_paging(api):
    client, db, made = api
    a, ha = await _member(db, made, "Asha")
    for n in range(5):
        await client.post("/feed/posts", json={"text": f"post {n}"}, headers=ha)
    first = (await client.get("/feed", params={"tab": "mine", "limit": 3}, headers=ha)).json()
    assert [p["text"] for p in first["posts"]] == ["post 4", "post 3", "post 2"] and first["next"]
    rest = (await client.get("/feed", params={"tab": "mine", "limit": 3, "before": first["next"]}, headers=ha)).json()
    assert [p["text"] for p in rest["posts"]] == ["post 1", "post 0"] and rest["next"] == ""


async def test_likes_toggle_and_notify_once(api):
    client, db, made = api
    a, ha = await _member(db, made, "Asha")
    b, hb = await _member(db, made, "Bina")
    c, hc = await _member(db, made, "Chitra")
    post = (await client.post("/feed/posts", json={"text": "Hello", "audience": "everyone"}, headers=ha)).json()
    url = f"/feed/posts/{post['id']}/like"
    assert (await client.post(url, headers=hb)).json() == {"liked": True, "like_count": 1}
    assert (await client.post(url, headers=hc)).json() == {"liked": True, "like_count": 2}
    assert (await client.post(url, headers=hb)).json() == {"liked": False, "like_count": 1}
    likes_note = await db["member_notifications"].count_documents({"user_id": a, "title": {"$regex": "liked"}})
    assert likes_note == 1
    feed = (await client.get("/feed", headers=hc)).json()["posts"]
    mine = next(p for p in feed if p["id"] == post["id"])
    assert mine["liked_by_me"] is True and mine["like_count"] == 1


async def test_comments_and_who_may_delete(api):
    client, db, made = api
    a, ha = await _member(db, made, "Asha")
    b, hb = await _member(db, made, "Bina")
    c, hc = await _member(db, made, "Chitra")
    post = (await client.post("/feed/posts", json={"text": "Tips?", "audience": "everyone"}, headers=ha)).json()
    url = f"/feed/posts/{post['id']}/comments"
    cb = (await client.post(url, json={"text": "Try this"}, headers=hb)).json()
    cc = (await client.post(url, json={"text": "And this"}, headers=hc)).json()
    listed = (await client.get(url, headers=hb)).json()
    assert [x["text"] for x in listed] == ["Try this", "And this"]
    assert listed[0]["can_delete"] is True and listed[1]["can_delete"] is False
    assert (await client.delete(f"/feed/comments/{cc['id']}", headers=hb)).status_code == 403
    assert (await client.delete(f"/feed/comments/{cc['id']}", headers=ha)).status_code == 200  # post author
    assert (await client.delete(f"/feed/comments/{cb['id']}", headers=hb)).status_code == 200  # own
    feed = (await client.get("/feed", params={"tab": "mine"}, headers=ha)).json()["posts"]
    assert feed[0]["comment_count"] == 0
    assert await db["member_notifications"].count_documents({"user_id": a, "title": {"$regex": "commented"}}) == 2


async def test_delete_and_report(api):
    client, db, made = api
    a, ha = await _member(db, made, "Asha")
    b, hb = await _member(db, made, "Bina")
    post = (await client.post("/feed/posts", json={"text": "Buy now!!", "audience": "everyone"}, headers=ha)).json()
    assert (await client.delete(f"/feed/posts/{post['id']}", headers=hb)).status_code == 403
    r = await client.post(f"/feed/posts/{post['id']}/report", json={"reason": "Spam or selling"}, headers=hb)
    assert r.status_code == 200
    assert post["id"] not in [p["id"] for p in (await client.get("/feed", headers=hb)).json()["posts"]]
    assert (await client.delete(f"/feed/posts/{post['id']}", headers=ha)).status_code == 200
    assert (await client.get("/feed", params={"tab": "mine"}, headers=ha)).json()["posts"] == []


async def test_public_circle_posts_move_once(api):
    from app.routes.social import migrate_circle_posts
    client, db, made = api
    a, ha = await _member(db, made, "Asha")
    b, hb = await _member(db, made, "Bina")
    now = datetime.now(timezone.utc)
    pub = (await db["circles"].insert_one({"name": "Open bakers", "is_private": False, "status": "active"})).inserted_id
    prv = (await db["circles"].insert_one({"name": "Quiet one", "is_private": True, "status": "active"})).inserted_id
    made["circles"] += [pub, prv]
    p1 = (await db["circle_posts"].insert_one({"circle_id": str(pub), "user_id": a, "body": "Open post",
                                               "likes": [b], "created_at": now})).inserted_id
    await db["circle_posts"].insert_one({"circle_id": str(prv), "user_id": a, "body": "Private post", "created_at": now})
    await db["post_replies"].insert_one({"post_id": str(p1), "user_id": b, "body": "Nice", "created_at": now})
    assert await migrate_circle_posts(force=True) >= 1
    assert await migrate_circle_posts(force=True) == 0
    moved = await db["feed_posts"].find_one({"source.circle_post": str(p1)})
    assert moved["audience"] == "everyone" and moved["like_count"] == 1 and moved["comment_count"] == 1
    assert await db["feed_posts"].count_documents({"author_id": a, "text": "Private post"}) == 0
    shown = next(p for p in (await client.get("/feed", params={"tab": "mine"}, headers=ha)).json()["posts"]
                 if p["text"] == "Open post")
    assert shown["from_circle"] == "Open bakers"
    assert [c["text"] for c in (await client.get(f"/feed/posts/{shown['id']}/comments", headers=hb)).json()] == ["Nice"]


async def test_suggestions_skip_people_she_knows(api):
    client, db, made = api
    a, ha = await _member(db, made, "Asha")
    b, hb = await _member(db, made, "Bina")
    c, hc = await _member(db, made, "Chitra")
    await _friends(client, a, ha, b, hb)
    await _friends(client, b, hb, c, hc)
    rows = (await client.get("/friends/suggestions", params={"limit": 20}, headers=ha)).json()
    ids = [r["id"] for r in rows]
    assert b not in ids and a not in ids
    top = next(r for r in rows if r["id"] == c)
    assert top["mutual"] == 1 and "mutual" in top["reason"]
