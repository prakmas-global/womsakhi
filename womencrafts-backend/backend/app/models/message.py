"""
The staff side of a member's thread with the team.

The messages themselves live in `member_messages` (see models/conversation.py):
one row per message, `user_id` naming the member whose thread it is, `sender`
saying which side wrote it. That collection is what the member app reads
(`GET /me/messages`, the `/me/unread` badge), so the admin inbox reads and
writes the same rows rather than keeping a copy that could drift.

What that collection cannot hold is the *state of the thread* — who on the
team is looking after it, and whether it is done. That is this document: one
per member, keyed by `user_id`, created lazily the first time staff assign or
resolve a thread. A member with messages and no row here has an open,
unassigned thread, which is the honest default.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional


def _now() -> datetime:
    return datetime.now(timezone.utc)


class SupportThreadModel:
    collection_name = "member_threads"

    STATUS_OPEN = "open"
    STATUS_RESOLVED = "resolved"

    @staticmethod
    def create_document(*, user_id: str) -> dict:
        return {
            "user_id": user_id,
            "status": SupportThreadModel.STATUS_OPEN,
            # Staff account looking after this thread. Empty = nobody yet.
            "assigned_to": "",
            "assigned_name": "",
            "assigned_at": None,
            "assigned_by": "",
            "resolved_at": None,
            "resolved_by": "",
            "resolved_by_name": "",
            "created_at": _now(),
            "updated_at": _now(),
        }

    @staticmethod
    def effective_status(state: Optional[dict], last_member_at: Optional[datetime]) -> tuple[str, bool]:
        """
        (status, reopened_by_member)

        A thread marked resolved stays resolved only until the member writes
        again. Her message after the resolution is a new question, and hiding
        it under "resolved" is how a woman gets ignored. Derived rather than
        written on her send, because her send goes through /me and this module
        does not touch that path.
        """
        if not state or state.get("status") != SupportThreadModel.STATUS_RESOLVED:
            return SupportThreadModel.STATUS_OPEN, False
        resolved_at = state.get("resolved_at")
        if (
            isinstance(resolved_at, datetime)
            and isinstance(last_member_at, datetime)
            and _aware(last_member_at) > _aware(resolved_at)
        ):
            return SupportThreadModel.STATUS_OPEN, True
        return SupportThreadModel.STATUS_RESOLVED, False

    @staticmethod
    def assignee(state: Optional[dict]) -> Optional[dict[str, Any]]:
        if not state or not state.get("assigned_to"):
            return None
        return {"id": state["assigned_to"], "name": state.get("assigned_name", "")}


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
