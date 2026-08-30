"""
Skill exchange: teach one, learn one. No money moves.

**The agreement is a document, not a chat message.** Two women who agree "four
hours of tailoring for four hours of English" and leave it in a conversation
will remember it differently in a month, and neither of them will be lying. So
what was agreed — who teaches what, how many sessions each — is stored once and
pinned above the thread.
"""

from datetime import datetime, timezone

from app.core.serializers import aware


class SwapModel:
    """An offer: what she can teach, and what she wants to learn."""

    collection_name = "skill_swaps"

    STATUS_OPEN = "open"
    STATUS_MATCHED = "matched"
    STATUS_CLOSED = "closed"

    @staticmethod
    def create_document(
        *, user_id: str, member_id: str, who: str, avatar: str = "",
        skill: str, detail: str = "", wants: str = "",
        place: str = "", online: bool = False, tags: list[str] | None = None,
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,
            "member_id": member_id,
            "who": who.strip(),
            "avatar": avatar,
            "skill": skill.strip(),
            "detail": detail.strip(),
            "wants": wants.strip(),
            "place": place.strip(),
            "online": bool(online),
            "tags": tags or [],
            "status": SwapModel.STATUS_OPEN,
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict, *, asked: bool = False, mine: bool = False) -> dict:
        return {
            "id": str(doc["_id"]),
            "who": doc.get("who", ""),
            "avatar": doc.get("avatar", ""),
            "skill": doc.get("skill", ""),
            "detail": doc.get("detail", ""),
            "wants": doc.get("wants", ""),
            "place": doc.get("place", ""),
            "online": bool(doc.get("online")),
            "tags": list(doc.get("tags") or []),
            "status": doc.get("status", SwapModel.STATUS_OPEN),
            "asked": asked,
            "mine": mine,
        }


class ExchangeModel:
    """One live exchange between two women, and what they agreed."""

    collection_name = "skill_exchanges"

    @staticmethod
    def create_document(*, swap_id: str, asker_id: str, owner_id: str, opening: str = "") -> dict:
        now = datetime.now(timezone.utc)
        return {
            "swap_id": swap_id,
            "asker_id": asker_id,
            "owner_id": owner_id,
            # Null until they settle it. A blank agreement shown as agreed is
            # exactly the misunderstanding this module exists to prevent.
            "agreement": None,
            "messages": (
                [{"from": asker_id, "text": opening.strip(), "at": now}] if opening.strip() else []
            ),
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict, *, me_id: str) -> dict:
        agreed = doc.get("agreement")
        return {
            "id": str(doc["_id"]),
            "swap_id": doc.get("swap_id", ""),
            "agreed": bool(agreed),
            "agreement": agreed,
            "messages": [
                {
                    "mine": m.get("from") == me_id,
                    "text": m.get("text", ""),
                    "at": (aware(m.get("at")) or datetime.now(timezone.utc)).strftime("%d %b, %I:%M %p"),
                }
                for m in (doc.get("messages") or [])
            ],
        }
