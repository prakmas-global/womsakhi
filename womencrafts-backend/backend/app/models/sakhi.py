"""
Conversations with Sakhi, and the turns inside them.

Two collections, and one decision worth explaining.

A conversation stores every turn in the exact shape the model API needs, not in
a prettier shape for the screen. The alternative — store display text, rebuild
the API payload on the way out — loses the tool_use blocks, and the API requires
those back verbatim alongside their results or it rejects the request. So the
API shape is the stored shape, and the SCREEN is the thing that gets derived
([[Derive, never store what you can compute]]).

`kind` is what separates them. Every row has a role the API understands; `kind`
records what it means to us — which rows a person should see, and which exist
only so the next request is well-formed.

These are personal data. Every read is filtered by `user_id`, and the delete
endpoint really deletes.
"""

from datetime import datetime, timezone
from typing import Any, Optional


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ConversationModel:
    collection_name = "sakhi_conversations"

    AUDIENCE_MEMBER = "member"
    AUDIENCE_STAFF = "staff"

    @staticmethod
    def create_document(
        *,
        user_id: str,
        audience: str = AUDIENCE_MEMBER,
        title: str = "",
        locale: str = "en",
    ) -> dict:
        return {
            "user_id": user_id,
            "audience": audience if audience in (ConversationModel.AUDIENCE_MEMBER, ConversationModel.AUDIENCE_STAFF) else ConversationModel.AUDIENCE_MEMBER,
            "title": title or "New conversation",
            "locale": locale or "en",
            # Set when a write tool is waiting on her yes. One at a time, on
            # purpose: a queue of pending changes is a queue of things she has
            # to hold in her head.
            "pending_action": None,
            "message_count": 0,
            "cost_usd": 0.0,
            "created_at": _now(),
            "updated_at": _now(),
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "id": str(doc["_id"]),
            "title": doc.get("title", ""),
            "audience": doc.get("audience", ConversationModel.AUDIENCE_MEMBER),
            "locale": doc.get("locale", "en"),
            "message_count": int(doc.get("message_count") or 0),
            "pending_action": doc.get("pending_action"),
            "created_at": doc.get("created_at"),
            "updated_at": doc.get("updated_at"),
        }


class SakhiMessageModel:
    collection_name = "sakhi_messages"

    # What a row means to us.
    KIND_USER = "user"              # she typed it — shown
    KIND_ASSISTANT = "assistant"    # Sakhi said it — shown
    KIND_TOOL_RESULT = "tool_result"  # plumbing — replayed, never shown
    KIND_SAFETY = "safety"          # the gate answered, no model involved — shown
    KIND_ACTION = "action"          # a write ran, or she declined it — shown

    # Rows a person sees.
    VISIBLE = [KIND_USER, KIND_ASSISTANT, KIND_SAFETY, KIND_ACTION]
    # Rows the model is sent. The safety reply is deliberately absent: it was
    # written by a person, and replaying it would teach the model to imitate it.
    REPLAYED = [KIND_USER, KIND_ASSISTANT, KIND_TOOL_RESULT]

    @staticmethod
    def create_document(
        *,
        conversation_id: str,
        user_id: str,
        kind: str,
        role: str,
        content: Any,
        text: str = "",
        meta: Optional[dict] = None,
    ) -> dict:
        return {
            "conversation_id": conversation_id,
            "user_id": user_id,
            "kind": kind,
            "role": role,            # "user" | "assistant" — what the API sees
            "content": content,      # API-shaped: a string, or a list of blocks
            "text": text,            # the same turn as readable text, for the screen
            "meta": meta or {},      # helplines, tool name, action outcome
            "created_at": _now(),
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "id": str(doc["_id"]),
            "kind": doc.get("kind", SakhiMessageModel.KIND_ASSISTANT),
            "text": doc.get("text", ""),
            "meta": doc.get("meta") or {},
            "created_at": doc.get("created_at"),
        }
