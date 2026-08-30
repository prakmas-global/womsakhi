"""
Community — circles, the conversations inside them, and success stories.

The point of a women-only platform is not the catalogue; it's the other women.
These three collections are what turn a list of programs into somewhere she comes
back to.

Author details (name, avatar) are SNAPSHOTTED onto each post rather than joined
at read time. A feed reads far more often than a member renames herself, and the
alternative is an N+1 lookup on every scroll.
"""

from datetime import datetime, timezone
from typing import Optional

from app.core.serializers import aware


def _ago(when: Optional[datetime]) -> str:
    """'2 hours ago' — feeds read better in relative time."""
    if not isinstance(when, datetime):
        return ""
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    seconds = (datetime.now(timezone.utc) - when).total_seconds()
    if seconds < 60:
        return "just now"
    for limit, div, unit in (
        (3600, 60, "minute"),
        (86400, 3600, "hour"),
        (604800, 86400, "day"),
        (2629800, 604800, "week"),
    ):
        if seconds < limit:
            n = int(seconds // div)
            return f"{n} {unit}{'s' if n != 1 else ''} ago"
    return when.strftime("%b %d, %Y")


class CircleModel:
    """A group of members around one subject — 'Tailoring beginners', 'Mothers who earn'."""

    collection_name = "circles"

    @staticmethod
    def create_document(
        name: str,
        topic: str = "",
        desc: str = "",
        cover: str = "",
        guidelines: str = "",
        is_private: bool = False,
        created_by: str = "",
        is_savings: bool = False,
        monthly_minor: int = 0,
        round_started_on: "datetime | None" = None,
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "name": name,
            "topic": topic,
            "desc": desc,
            "cover": cover,
            "guidelines": guidelines,
            "is_private": is_private,
            # Whether this circle collects money, stated rather than guessed.
            # The screens used to decide it with a regex on the circle's name —
            # so "Savings tips" grew a Pay button and a bachat gat called
            # "Ladies Group" did not. What a circle does is not a naming
            # convention.
            "is_savings": is_savings,
            "monthly_minor": int(monthly_minor),
            # Round 1 begins here; every later round is counted from it, so
            # nothing has to run on a schedule to move a circle along.
            "round_started_on": round_started_on or now,
            "member_count": 0,
            "post_count": 0,
            "status": "active",
            "created_by": created_by,
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict, joined: bool = False) -> dict:
        return {
            "id": str(doc["_id"]),
            "name": doc.get("name", ""),
            "topic": doc.get("topic", ""),
            "desc": doc.get("desc", ""),
            "cover": doc.get("cover", ""),
            "guidelines": doc.get("guidelines", ""),
            "is_private": bool(doc.get("is_private", False)),
            "member_count": doc.get("member_count", 0),
            "post_count": doc.get("post_count", 0),
            "joined": joined,
            "is_savings": bool(doc.get("is_savings", False)),
            "monthly_minor": int(doc.get("monthly_minor", 0)),
            "round": CircleModel.round_of(doc),
        }

    @staticmethod
    def round_of(doc: dict) -> int:
        """
        Which round a circle is in, counted from the day it started.

        Derived rather than stored, so no scheduled job has to tick circles
        forward — and a circle nobody looked at for three months is in the
        round it should be in, not the one it was left on.
        """
        if not doc.get("is_savings"):
            return 0
        started = aware(doc.get("round_started_on"))
        if not started:
            return 1
        now = datetime.now(timezone.utc)
        months = (now.year - started.year) * 12 + (now.month - started.month)
        return max(1, months + 1)


class CircleMemberModel:
    """Who is in a circle. Also the permission check for reading a private one."""

    collection_name = "circle_members"

    ROLE_MEMBER = "member"
    ROLE_HOST = "host"

    @staticmethod
    def create_document(
        user_id: str, circle_id: str, role: str = ROLE_MEMBER, turn: int = 0,
    ) -> dict:
        return {
            "user_id": user_id,
            "circle_id": circle_id,
            "role": role,
            # Which round this member takes the pot. Joining order by default,
            # because that is what these circles do when nobody says otherwise
            # — and a turn nobody agreed is worse than an obvious one.
            "turn": int(turn),
            "created_at": datetime.now(timezone.utc),
        }


class PostModel:
    """One message in a circle. Replies hang off it."""

    collection_name = "circle_posts"

    @staticmethod
    def create_document(
        circle_id: str,
        user_id: str,
        author_name: str,
        author_avatar: str,
        body: str,
        image: str = "",
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "circle_id": circle_id,
            "user_id": user_id,
            "author_name": author_name,
            "author_avatar": author_avatar,
            "body": body,
            "image": image,
            "likes": [],            # user ids — small, and lets us show "you liked this"
            "reply_count": 0,
            "pinned": False,
            "hidden": False,        # staff moderation, never a hard delete
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict, viewer_id: str = "") -> dict:
        likes = doc.get("likes", []) or []
        return {
            "id": str(doc["_id"]),
            "circle_id": doc.get("circle_id", ""),
            "author_name": doc.get("author_name", ""),
            "author_avatar": doc.get("author_avatar", ""),
            "body": doc.get("body", ""),
            "image": doc.get("image", ""),
            "likes": len(likes),
            "liked_by_me": viewer_id in likes,
            "mine": doc.get("user_id", "") == viewer_id,
            "reply_count": doc.get("reply_count", 0),
            "pinned": bool(doc.get("pinned", False)),
            "when": _ago(doc.get("created_at")),
        }


class PostReplyModel:
    collection_name = "post_replies"

    @staticmethod
    def create_document(
        post_id: str,
        user_id: str,
        author_name: str,
        author_avatar: str,
        body: str,
    ) -> dict:
        return {
            "post_id": post_id,
            "user_id": user_id,
            "author_name": author_name,
            "author_avatar": author_avatar,
            "body": body,
            "hidden": False,
            "created_at": datetime.now(timezone.utc),
        }

    @staticmethod
    def to_response(doc: dict, viewer_id: str = "") -> dict:
        return {
            "id": str(doc["_id"]),
            "author_name": doc.get("author_name", ""),
            "author_avatar": doc.get("author_avatar", ""),
            "body": doc.get("body", ""),
            "mine": doc.get("user_id", "") == viewer_id,
            "when": _ago(doc.get("created_at")),
        }


class StoryModel:
    """
    A member's success story.

    Submitted by her, published by staff — never auto-published. The whole value
    of this screen is that everything on it is true, and that needs a human.
    """

    collection_name = "stories"

    STATUS_PENDING = "pending"
    STATUS_PUBLISHED = "published"
    STATUS_DECLINED = "declined"

    @staticmethod
    def create_document(
        user_id: str,
        author_name: str,
        author_avatar: str,
        title: str,
        body: str,
        program: str = "",
        cover: str = "",
        allow_name: bool = True,
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,
            "author_name": author_name if allow_name else "A WomSakhi member",
            "author_avatar": author_avatar if allow_name else "",
            "allow_name": allow_name,
            "title": title,
            "body": body,
            "program": program,
            "cover": cover,
            "status": StoryModel.STATUS_PENDING,
            "likes": [],
            "featured": False,
            "created_at": now,
            "published_at": None,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict, viewer_id: str = "") -> dict:
        likes = doc.get("likes", []) or []
        published = doc.get("published_at") or doc.get("created_at")
        return {
            "id": str(doc["_id"]),
            "author_name": doc.get("author_name", ""),
            "author_avatar": doc.get("author_avatar", ""),
            "title": doc.get("title", ""),
            "body": doc.get("body", ""),
            "program": doc.get("program", ""),
            "cover": doc.get("cover", ""),
            "status": doc.get("status", StoryModel.STATUS_PENDING),
            "featured": bool(doc.get("featured", False)),
            "likes": len(likes),
            "liked_by_me": viewer_id in likes,
            "mine": doc.get("user_id", "") == viewer_id,
            "when": published.strftime("%b %d, %Y") if isinstance(published, datetime) else "",
        }


class CircleContributionModel:
    """
    One member's payment into a savings circle, for one round.

    **The unique index is the rule, not a convenience.** A woman must not be
    able to pay twice for the same round — not by pressing the button twice on
    a bad connection, and not by two requests arriving together. `(circle_id,
    user_id, round)` is unique, so the second insert loses and the second
    payment never happens. Checking first and then writing is the race this
    exists to close.
    """

    collection_name = "circle_contributions"

    @staticmethod
    def create_document(
        circle_id: str,
        user_id: str,
        member_id: str,
        round_no: int,
        amount_minor: int,
        txn_id: str = "",
    ) -> dict:
        return {
            "circle_id": circle_id,
            "user_id": user_id,
            "member_id": member_id,
            "round": int(round_no),
            "amount_minor": int(amount_minor),
            # The ledger entry this payment made, so a dispute can be traced
            # from either end.
            "txn_id": txn_id,
            "created_at": datetime.now(timezone.utc),
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        when = aware(doc.get("created_at"))
        return {
            "id": str(doc["_id"]),
            "round": int(doc.get("round", 0)),
            "amount_minor": int(doc.get("amount_minor", 0)),
            "paid_on": when.strftime("%d %b %Y") if when else "",
        }
