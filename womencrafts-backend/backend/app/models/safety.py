"""
Safety.

On a women-only platform this is not a settings sub-page, it is a first-class
part of the product. Three things live here:

  * trusted contacts — who she wants reached if she raises an alert
  * alerts — a one-tap "I need help", logged so staff can act and so there is a
    record afterwards
  * reports — someone behaved badly, and she needs it dealt with quietly

Reports may be filed anonymously. When they are, `user_id` is still stored (we
cannot act on a report we cannot follow up, and abuse of the report system is
itself a safety problem) but the member's identity is never returned to anyone
outside staff. That trade-off is deliberate and is stated to her in the UI.
"""

from datetime import datetime, timezone
from typing import Optional


# India-wide numbers, correct at the time of writing. Kept in code rather than
# the database on purpose: this list must work even if the database is down, and
# it must not be editable by anyone who gets into the admin panel.
HELPLINES = [
    {
        "name": "Women's Helpline (All India)",
        "number": "181",
        "desc": "Free, 24×7. Any woman in distress — violence, harassment, or if you just need someone.",
        "urgent": True,
    },
    {
        "name": "Emergency (Police / Fire / Ambulance)",
        "number": "112",
        "desc": "One number for every emergency, anywhere in India.",
        "urgent": True,
    },
    {
        "name": "Domestic Abuse — NCW",
        "number": "7827170170",
        "desc": "National Commission for Women. WhatsApp and calls.",
        "urgent": False,
    },
    {
        "name": "Childline",
        "number": "1098",
        "desc": "For a child in danger or needing care.",
        "urgent": False,
    },
    {
        "name": "Mental health — Tele-MANAS",
        "number": "14416",
        "desc": "Free counselling, 24×7, in 20+ languages.",
        "urgent": False,
    },
    {
        "name": "Cyber crime",
        "number": "1930",
        "desc": "Online fraud, blackmail, or images shared without consent.",
        "urgent": False,
    },
]


class TrustedContactModel:
    collection_name = "trusted_contacts"

    MAX_PER_MEMBER = 5

    @staticmethod
    def create_document(
        user_id: str,
        name: str,
        phone: str,
        relation: str = "",
        notify_on_alert: bool = True,
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,
            "name": name,
            "phone": phone,
            "relation": relation,
            "notify_on_alert": notify_on_alert,
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "id": str(doc["_id"]),
            "name": doc.get("name", ""),
            "phone": doc.get("phone", ""),
            "relation": doc.get("relation", ""),
            "notify_on_alert": bool(doc.get("notify_on_alert", True)),
        }


class SafetyAlertModel:
    """A raised alarm. Never deleted — only resolved."""

    collection_name = "safety_alerts"

    STATUS_OPEN = "open"
    STATUS_ACKNOWLEDGED = "acknowledged"
    STATUS_RESOLVED = "resolved"

    @staticmethod
    def create_document(
        user_id: str,
        member_id: str,
        member_name: str,
        note: str = "",
        location: str = "",
        contacts_notified: int = 0,
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,
            "member_id": member_id,
            "member_name": member_name,
            "note": note,
            "location": location,
            "contacts_notified": contacts_notified,
            "status": SafetyAlertModel.STATUS_OPEN,
            "handled_by": "",
            "resolution": "",
            "created_at": now,
            "resolved_at": None,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        created = doc.get("created_at")
        return {
            "id": str(doc["_id"]),
            "note": doc.get("note", ""),
            "status": doc.get("status", "open"),
            "contacts_notified": doc.get("contacts_notified", 0),
            "resolution": doc.get("resolution", ""),
            "raised_at": created.strftime("%b %d, %Y · %I:%M %p") if isinstance(created, datetime) else "",
        }


class SafetyReportModel:
    """Report a person, a post, or something that happened."""

    collection_name = "safety_reports"

    CATEGORIES = [
        "Harassment or abuse",
        "A man on the platform",
        "Fake or impersonating account",
        "Money or fraud",
        "Something in a circle or post",
        "Something else",
    ]

    STATUS_OPEN = "open"
    STATUS_REVIEWING = "reviewing"
    STATUS_ACTIONED = "actioned"
    STATUS_CLOSED = "closed"

    @staticmethod
    def create_document(
        user_id: str,
        category: str,
        details: str,
        about: str = "",
        anonymous: bool = False,
        evidence: str = "",
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,
            "category": category,
            "details": details,
            "about": about,           # who or what, free text
            "anonymous": anonymous,
            "evidence": evidence,     # optional uploaded image path
            "status": SafetyReportModel.STATUS_OPEN,
            "staff_note": "",
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        created = doc.get("created_at")
        return {
            "id": str(doc["_id"]),
            "category": doc.get("category", ""),
            "details": doc.get("details", ""),
            "about": doc.get("about", ""),
            "anonymous": bool(doc.get("anonymous", False)),
            "status": doc.get("status", "open"),
            "filed_on": created.strftime("%b %d, %Y") if isinstance(created, datetime) else "",
        }
