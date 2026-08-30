from datetime import datetime, timezone
from typing import Optional


class MessageModel:
    """
    A single chat bubble that lives inside a conversation's 'messages' array.

    Messages are NOT their own collection — they are embedded under
    conversations.messages — so this class is just a small helper that keeps
    every bubble shaped the same way (a text bubble OR a file bubble).
    """

    DIRECTIONS = ["in", "out"]

    @staticmethod
    def build(
        dir: str = "out",
        text: Optional[str] = None,
        file: Optional[dict] = None,
        time: str = "Now",
    ) -> dict:
        bubble: dict = {
            "dir": dir if dir in MessageModel.DIRECTIONS else "out",
            "time": time,
        }
        if file:
            bubble["file"] = {
                "name": str(file.get("name", "")),
                "size": str(file.get("size", "")),
            }
        else:
            bubble["text"] = (text or "").strip()
        return bubble

    @staticmethod
    def to_response(bubble: dict) -> dict:
        out: dict = {"dir": bubble.get("dir", "out"), "time": bubble.get("time", "")}
        if bubble.get("file"):
            f = bubble["file"]
            out["file"] = {"name": f.get("name", ""), "size": f.get("size", "")}
            out["text"] = None
        else:
            out["text"] = bubble.get("text", "")
            out["file"] = None
        return out


class ConversationModel:
    """
    The 'conversations' collection — one row per chat shown in the left pane,
    with its full message thread embedded in the 'messages' array.
    """

    collection_name = "conversations"

    @staticmethod
    def create_document(
        name: str,
        preview: str = "",
        time: str = "Now",
        unread: int = 0,
        starred: bool = False,
        active: bool = False,
        messages: Optional[list] = None,
        created_at: Optional[datetime] = None,
    ) -> dict:
        now = datetime.now(timezone.utc)
        bubbles = [MessageModel.build(**m) for m in (messages or [])]
        return {
            "name": name.strip(),
            "preview": preview.strip(),
            "time": time,
            "unread": int(unread or 0),
            "starred": bool(starred),
            "active": bool(active),
            "messages": bubbles,
            "created_at": created_at or now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        bubbles = doc.get("messages", []) or []
        return {
            "id": str(doc["_id"]),
            "name": doc.get("name", ""),
            "preview": doc.get("preview", ""),
            "time": doc.get("time", ""),
            "unread": doc.get("unread", 0),
            "starred": bool(doc.get("starred", False)),
            "active": bool(doc.get("active", False)),
            "has_attachment": any(bool(b.get("file")) for b in bubbles),
            "messages": [MessageModel.to_response(b) for b in bubbles],
        }


class MessageStatsModel:
    """
    The 'message_stats' collection — a single summary document that feeds the
    5 stat cards, the Messages Overview donut, and the Top Contacts rail.
    """

    collection_name = "message_stats"

    @staticmethod
    def create_document(
        totalConversations: int = 0,
        messagesSent: int = 0,
        messagesReceived: int = 0,
        avgResponseTime: str = "",
        resolvedConversations: int = 0,
        overviewTotal: int = 0,
        overview: Optional[list] = None,
        topContacts: Optional[list] = None,
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "totalConversations": int(totalConversations),
            "messagesSent": int(messagesSent),
            "messagesReceived": int(messagesReceived),
            "avgResponseTime": avgResponseTime,
            "resolvedConversations": int(resolvedConversations),
            "overviewTotal": int(overviewTotal),
            "overview": overview or [],
            "topContacts": topContacts or [],
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "totalConversations": doc.get("totalConversations", 0),
            "messagesSent": doc.get("messagesSent", 0),
            "messagesReceived": doc.get("messagesReceived", 0),
            "avgResponseTime": doc.get("avgResponseTime", ""),
            "resolvedConversations": doc.get("resolvedConversations", 0),
            "overviewTotal": doc.get("overviewTotal", 0),
            "overview": doc.get("overview", []),
            "topContacts": doc.get("topContacts", []),
        }
