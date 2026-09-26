"""
Moderation records against a member, inside one circle.

Two kinds of row live here: a **warning** (a note she was told about, kept so
the next moderator can see it is not the first) and a **mute** (a window during
which the member side refuses her posts and replies in that circle).

── Why a collection of its own, not a flag on `circle_members` ──────────────
A membership row is deleted when she leaves the circle and created again when
she rejoins. A mute stored on that row would vanish with it, so leaving and
rejoining would be the way round a mute. Kept here, keyed on
`(circle_id, user_id)`, the record outlives her membership and the member
side finds it whether or not she is in the circle at the moment she writes.

── Scope ─────────────────────────────────────────────────────────────────────
A mute is per circle, not platform-wide. Silencing a woman everywhere is an
account action (suspension, in the Members module), with its own review. This
is the lighter tool: "not in this room, not this week".
"""

from datetime import datetime, timezone
from typing import Optional

from app.core.serializers import aware


class CircleModerationModel:
    collection_name = "circle_moderation"

    KIND_WARNING = "warning"
    KIND_MUTE = "mute"

    #: A circle_members role that marks a member as one the staff trust to
    #: keep an eye on the room. `CircleMemberModel` knows `member` and `host`;
    #: this sits between them. The member app does not yet act on it — see the
    #: note on the roster screen.
    ROLE_MODERATOR = "moderator"

    @staticmethod
    def create_document(
        kind: str,
        circle_id: str,
        user_id: str,
        reason: str,
        by_id: str,
        by_name: str,
        until: Optional[datetime] = None,
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "kind": kind,
            "circle_id": circle_id,
            "user_id": user_id,
            "reason": reason[:400],
            "by_id": by_id,
            "by_name": by_name,
            # Only a mute has an end. A warning is a fact, not a state.
            "until": until,
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def active_mute_query(circle_id: str, user_id: str) -> dict:
        """The filter both sides use: a mute that has not run out yet."""
        return {
            "kind": CircleModerationModel.KIND_MUTE,
            "circle_id": circle_id,
            "user_id": user_id,
            "until": {"$gt": datetime.now(timezone.utc)},
        }

    @staticmethod
    def until_label(doc: Optional[dict]) -> str:
        when = aware((doc or {}).get("until"))
        return when.strftime("%d %b %Y") if when else ""
