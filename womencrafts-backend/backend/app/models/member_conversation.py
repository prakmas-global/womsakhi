"""
A member's own conversations.

Deliberately NOT the `conversations` collection. That one is the staff inbox:
it has no owner field, so every row in it belongs to everybody, which is fine
for a shared support queue and completely wrong for a woman's private threads
with her buyers. This collection is scoped by `member_id` on every query.

The thread is embedded rather than kept in a second collection. A member's
conversation is bounded — tens of messages, not millions — and embedding means
opening one is a single read with no join. If a thread ever outgrows a document
this is the decision to revisit first.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from app.core.media import media_url


def _now() -> datetime:
    return datetime.now(timezone.utc)


class MemberConversationModel:
    collection_name = "member_conversations"

    # Who she is talking to. The kind drives the colour of the ring, the tag,
    # and which context a thread is allowed to carry.
    KIND_BUYER = "buyer"
    #: The other direction. A thread with a woman SHE is buying from — which had
    #: nowhere to live, so the market's "Ask her something" button showed
    #: "Message sent" and sent nothing. Filing it under `buyer` would have put
    #: the tag "Buyer" on a woman who is selling to her, which is a small lie on
    #: every row.
    KIND_SELLER = "seller"
    KIND_MENTOR = "mentor"
    KIND_CIRCLE = "circle"
    KIND_TEAM = "team"
    KINDS = (KIND_BUYER, KIND_SELLER, KIND_MENTOR, KIND_CIRCLE, KIND_TEAM)

    @staticmethod
    def bubble(*, direction: str, text: str = "", file: Optional[dict] = None,
               order: Optional[dict] = None, at: Optional[datetime] = None,
               read: bool = False) -> dict:
        return {
            "dir": "out" if direction == "out" else "in",
            "text": text,
            "file": file,
            # An order placed *in* the conversation, kept at the moment it
            # happened. The header strip shows the order's state now; this
            # shows what was agreed then, which is what a dispute turns on.
            "order": order,
            "at": at or _now(),
            # Only meaningful on an outgoing bubble: whether *she* has been read.
            "read": bool(read),
        }

    @staticmethod
    def create_document(
        *,
        member_id: str,
        kind: str,
        name: str,
        avatar: str = "",
        online: bool = False,
        subtitle: str = "",
        context: Optional[dict] = None,
        party: Optional[dict] = None,
        messages: Optional[list[dict]] = None,
        starred: bool = False,
        with_user_id: str = "",
        counterpart_id: str = "",
    ) -> dict:
        """
        `with_user_id` / `counterpart_id` are what make a thread two-sided.

        A conversation document is ONE woman's view of a thread. That is right
        for a circle and for the team, and it is not enough for two members
        talking to each other: her reply has to arrive somewhere. So a
        member-to-member thread is a PAIR of documents that name each other,
        and `send` writes the mirror. Empty on every seeded thread, which still
        behaves exactly as before.
        """
        rows = messages or []
        return {
            "member_id": member_id,
            # The other member, when there is one.
            "with_user_id": with_user_id,
            # Her document for the same thread.
            "counterpart_id": counterpart_id,
            "kind": kind if kind in MemberConversationModel.KINDS else MemberConversationModel.KIND_BUYER,
            "name": name.strip(),
            "avatar": avatar,
            "online": bool(online),
            "subtitle": subtitle,
            # What the conversation is ABOUT — an order, a session, a pot round.
            # Optional, because a circle chat is about nothing in particular.
            "context": context,
            # What is known about the other person, for the panel beside the
            # thread. Stored rather than derived: a buyer is not a WomSakhi
            # account, so there is no user row to count orders from.
            "party": party or {},
            "messages": rows,
            "starred": bool(starred),
            "created_at": _now(),
            "updated_at": rows[-1]["at"] if rows else _now(),
        }

    # ---- derived, never stored -------------------------------------------
    #
    # `unread` and `waiting_since` are computed on read rather than kept in
    # sync on write. Two writers and one counter is how unread badges start
    # lying, and the thread is right here in the document anyway.

    @staticmethod
    def _unread(rows: list[dict]) -> int:
        return sum(1 for b in rows if b.get("dir") == "in" and not b.get("read"))

    @staticmethod
    def _waiting_since(rows: list[dict]) -> Optional[datetime]:
        """When the oldest still-unanswered incoming message arrived.

        Walks back from the end and stops at her last reply — everything after
        it is what she has not answered. Returns None when the last word was
        hers, because then nobody is waiting.
        """
        oldest = None
        for b in reversed(rows):
            if b.get("dir") == "out":
                break
            oldest = b.get("at")
        return oldest

    # Only a person expecting an answer counts as waiting. A circle chatting
    # among itself and a team announcement are unanswered too, but nobody is
    # sitting there wondering why she has not replied — and putting them in
    # "waiting for your reply" is how that section stops meaning anything.
    #
    # A seller thread is answerable too: a woman who asked a question about
    # something she wants to buy is waiting for exactly the same reason.
    ANSWERABLE = (KIND_BUYER, KIND_SELLER, KIND_MENTOR)

    @staticmethod
    def awaits_reply(doc: dict):
        if doc.get("kind") not in MemberConversationModel.ANSWERABLE:
            return None
        return MemberConversationModel._waiting_since(doc.get("messages") or [])

    @staticmethod
    def to_response(doc: dict, *, with_messages: bool = False) -> dict[str, Any]:
        rows = doc.get("messages") or []
        last = rows[-1] if rows else None
        out = {
            "id": str(doc["_id"]),
            "kind": doc.get("kind", MemberConversationModel.KIND_BUYER),
            "name": doc.get("name", ""),
            "avatar": media_url(doc.get("avatar", "")),
            "online": bool(doc.get("online")),
            "subtitle": doc.get("subtitle", ""),
            "preview": (last or {}).get("text") or ("Photo" if (last or {}).get("file") else ""),
            "last_at": (last or {}).get("at"),
            "unread": MemberConversationModel._unread(rows),
            "waiting_since": MemberConversationModel.awaits_reply(doc),
            "starred": bool(doc.get("starred")),
            "context": doc.get("context"),
            "party": doc.get("party") or {},
        }
        if with_messages:
            out["messages"] = [
                {
                    "dir": b.get("dir", "in"),
                    "text": b.get("text", ""),
                    "file": b.get("file"),
                    "order": b.get("order"),
                    "at": b.get("at"),
                    "read": bool(b.get("read")),
                }
                for b in rows
            ]
        return out
