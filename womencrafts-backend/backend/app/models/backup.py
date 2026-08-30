"""
Backups.

The admin screen for this was entirely fictional — including a Restore button.
That is worse than having no screen at all: somebody would press it during a
real incident and believe their data had come back.

A backup here is a real JSON export of chosen collections, written to a file
under the private media root (never the public one — a backup contains every
member's details, including the ones we keep behind an authenticated endpoint).
"""

from datetime import datetime, timezone
from typing import Optional


class BackupModel:
    collection_name = "backups"

    STATUS_RUNNING = "running"
    STATUS_COMPLETE = "complete"
    STATUS_FAILED = "failed"

    # What a "full" backup covers. Deliberately explicit rather than "every
    # collection": a new collection should be a decision, not an accident.
    FULL_SET = [
        "users", "members", "roles", "segments",
        "bookings", "enrollments", "appointments", "programs", "services",
        "orders", "refunds", "wallet_transactions", "support_requests",
        "circles", "circle_members", "circle_posts", "post_replies", "stories",
        "events", "event_registrations", "mentors", "mentorship_requests",
        "opportunities", "applications", "certificates",
        "trusted_contacts", "safety_alerts", "safety_reports",
        "member_messages", "member_notifications", "content", "feedback",
        "platform_settings", "activity_log", "support_tickets",
    ]

    # Collections holding identity documents or auth material are excluded even
    # from a "full" backup — a JSON dump of them is a liability, and they are
    # recoverable by other means.
    NEVER_INCLUDE = ["verification_documents", "email_tokens"]

    @staticmethod
    def create_document(
        name: str,
        kind: str,
        collections: list[str],
        created_by: str,
        created_by_name: str = "",
        note: str = "",
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "name": name,
            "kind": kind,                 # full | custom
            "collections": collections,
            "note": note,
            "status": BackupModel.STATUS_RUNNING,
            "doc_count": 0,
            "size_bytes": 0,
            "filename": "",
            "error": "",
            "created_by": created_by,
            "created_by_name": created_by_name,
            "created_at": now,
            "finished_at": None,
        }

    @staticmethod
    def human_size(n: int) -> str:
        step = 1024.0
        size = float(n)
        for unit in ("B", "KB", "MB", "GB"):
            if size < step:
                return f"{size:.0f} {unit}" if unit == "B" else f"{size:.1f} {unit}"
            size /= step
        return f"{size:.1f} TB"

    @staticmethod
    def to_response(doc: dict) -> dict:
        created = doc.get("created_at")
        return {
            "id": str(doc["_id"]),
            "name": doc.get("name", ""),
            "kind": doc.get("kind", "full"),
            "collections": doc.get("collections", []),
            "collection_count": len(doc.get("collections", []) or []),
            "note": doc.get("note", ""),
            "status": doc.get("status", "running"),
            "doc_count": doc.get("doc_count", 0),
            "size_bytes": doc.get("size_bytes", 0),
            "size": BackupModel.human_size(doc.get("size_bytes", 0)),
            "error": doc.get("error", ""),
            "created_by_name": doc.get("created_by_name", ""),
            "created_on": created.strftime("%b %d, %Y · %I:%M %p")
            if isinstance(created, datetime)
            else "",
            "created_at": created.isoformat() if isinstance(created, datetime) else "",
            "downloadable": bool(doc.get("filename")) and doc.get("status") == "complete",
        }
