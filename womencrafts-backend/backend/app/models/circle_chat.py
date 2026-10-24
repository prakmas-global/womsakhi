"""
A circle's group chat — WhatsApp-style messages, replacing the old discussion
wall (`circle_posts` stays, read-only, as "Earlier posts").

Two kinds of message share one collection:

* `text` — something a member wrote (and optionally a photo, or a reply).
* `system` — a line the app writes when the group changes: she joined, left,
  was added or removed, the name changed. Centred in the chat, never "mine".

A deleted message keeps its row and loses its words, so a reply that quoted it
still points somewhere and the conversation does not silently rearrange.

The system-message helper lives here, not in a route file, because joining
happens in three places (`routes/community.py` join/leave,
`routes/public_share.py` invite links, `routes/circle_chat.py` invites) and
none of them should import another route module to say "Priya joined".
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId

from app.core.usernames import display_name


class CircleMessageModel:
    collection_name = "circle_messages"

    KIND_TEXT = "text"
    KIND_SYSTEM = "system"

    @staticmethod
    def create_document(
        circle_id: str, user_id: str, text: str, *, photo: str = "",
        reply_to: str = "", kind: str = KIND_TEXT,
    ) -> dict:
        return {
            "circle_id": circle_id,
            "user_id": user_id,
            "text": text,
            "photo": photo,
            "reply_to": reply_to,
            "kind": kind,
            "deleted": False,
            "created_at": datetime.now(timezone.utc),
        }


async def post_system(db, circle_id: str, text: str, *, actor_id: str = "") -> None:
    """Write 'Priya joined' into the circle's chat, and move it up her list."""
    try:
        now = datetime.now(timezone.utc)
        await db[CircleMessageModel.collection_name].insert_one(
            CircleMessageModel.create_document(circle_id, actor_id, text, kind=CircleMessageModel.KIND_SYSTEM)
        )
        if ObjectId.is_valid(circle_id):
            await db["circles"].update_one({"_id": ObjectId(circle_id)}, {"$set": {"last_message_at": now}})
    except Exception as exc:  # noqa: BLE001 — a missing system line must never undo a join
        print(f"⚠️  Could not write circle system message for {circle_id}: {exc}")


def who(user: Optional[dict]) -> str:
    """The name the chat shows for a member: her username, else her account name."""
    return display_name(user or {})
