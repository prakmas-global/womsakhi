"""
The staff member's own account, and the platform's settings.

Four things that had screens in the admin app but nowhere to save to:

  * platform settings — one document, the whole organisation's configuration
  * notification preferences — per staff account, a channel matrix
  * activity log — who did what, append-only
  * support tickets — staff asking us for help

The activity log is the important one. Every consequential admin action writes a
row, which means "who changed this?" has an answer that isn't a guess.
"""

from datetime import datetime, timezone
from typing import Optional


class PlatformSettingsModel:
    """One document. `_key` keeps it a singleton no matter how it's written."""

    collection_name = "platform_settings"
    SINGLETON = "platform"

    @staticmethod
    def defaults() -> dict:
        now = datetime.now(timezone.utc)
        return {
            "_key": PlatformSettingsModel.SINGLETON,
            # identity
            "org_name": "WomSakhi",
            "tagline": "Empowering Women",
            "support_email": "support@womsakhi.com",
            "support_phone": "",
            "website": "https://www.womsakhi.com",
            # regional
            "timezone": "Asia/Kolkata (GMT+5:30)",
            "currency": "INR",
            "date_format": "DD/MM/YYYY",
            "default_locale": "en",
            # how the platform behaves
            "allow_signups": True,
            "require_document_verification": True,
            "auto_approve_members": False,
            "maintenance_mode": False,
            "maintenance_message": "We're doing a little maintenance. Back shortly.",
            "session_timeout_minutes": 30,
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        d = {k: v for k, v in (doc or {}).items() if k not in ("_id", "_key")}
        updated = d.pop("created_at", None), d.pop("updated_at", None)
        d["updated_at"] = updated[1].isoformat() if isinstance(updated[1], datetime) else ""
        return d


class StaffNotificationPrefsModel:
    """
    Which channels a staff account wants, per kind of event.

    Stored as a flat map so adding an event type later doesn't need a migration:
    missing keys simply fall back to the defaults below.
    """

    collection_name = "staff_notification_prefs"

    # key -> (title, description, email, sms, push, in_app)
    EVENTS = [
        ("new_appointment", "New Appointment", "When a new appointment is created or booked.", True, True, True, True),
        ("appointment_reminder", "Appointment Reminders", "Reminders before upcoming appointments.", True, True, True, True),
        ("appointment_update", "Appointment Updates", "Changes or updates to an existing appointment.", True, False, True, True),
        ("new_member", "New Member Registration", "When a woman registers and needs admitting.", True, False, False, True),
        ("enrollment", "Programme Enrolments", "When a member joins a programme.", True, False, True, True),
        ("payment", "Payments & Billing", "Payment confirmations, invoices and failures.", True, True, True, True),
        ("safety_alert", "Safety Alerts", "A member has raised an alert or filed a report.", True, True, True, True),
        ("support_fund", "Support Fund Requests", "A member has asked for help with a fee.", True, False, True, True),
        ("story_review", "Stories Awaiting Review", "A member has submitted a success story.", False, False, True, True),
        ("system", "System Alerts", "Important system updates and alerts.", True, True, True, True),
    ]

    QUIET_DEFAULT = {"enabled": False, "from": "22:00", "to": "07:00"}

    @staticmethod
    def create_document(user_id: str) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,
            "channels": {
                key: {"email": e, "sms": s, "push": p, "in_app": i}
                for key, _t, _d, e, s, p, i in StaffNotificationPrefsModel.EVENTS
            },
            "quiet_hours": dict(StaffNotificationPrefsModel.QUIET_DEFAULT),
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: Optional[dict], user_id: str) -> dict:
        stored = (doc or {}).get("channels", {}) or {}
        rows = []
        for key, title, desc, e, s, p, i in StaffNotificationPrefsModel.EVENTS:
            saved = stored.get(key) or {}
            rows.append(
                {
                    "key": key,
                    "title": title,
                    "description": desc,
                    "email": bool(saved.get("email", e)),
                    "sms": bool(saved.get("sms", s)),
                    "push": bool(saved.get("push", p)),
                    "in_app": bool(saved.get("in_app", i)),
                }
            )
        return {
            "rows": rows,
            "quiet_hours": (doc or {}).get("quiet_hours")
            or dict(StaffNotificationPrefsModel.QUIET_DEFAULT),
        }


class ActivityLogModel:
    """
    Append-only record of what staff did.

    Never updated, never deleted. An audit trail you can edit is not an audit
    trail.
    """

    collection_name = "activity_log"

    # Buckets the breakdown chart groups by.
    CATEGORIES = [
        "Users",
        "Appointments",
        "Programs",
        "Content",
        "Community",
        "Growth",
        "Safety",
        "Settings",
        "Reports",
    ]

    @staticmethod
    def create_document(
        user_id: str,
        user_name: str,
        action: str,
        category: str = "Settings",
        target: str = "",
        detail: str = "",
        ip: str = "",
    ) -> dict:
        return {
            "user_id": user_id,
            "user_name": user_name,
            "action": action,
            "category": category if category in ActivityLogModel.CATEGORIES else "Settings",
            "target": target,
            "detail": detail,
            "ip": ip,
            "created_at": datetime.now(timezone.utc),
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        when = doc.get("created_at")
        return {
            "id": str(doc["_id"]),
            "user_name": doc.get("user_name", ""),
            "action": doc.get("action", ""),
            "category": doc.get("category", ""),
            "target": doc.get("target", ""),
            "detail": doc.get("detail", ""),
            "ip": doc.get("ip", ""),
            "when": when.strftime("%b %d, %Y · %I:%M %p") if isinstance(when, datetime) else "",
            "created_at": when.isoformat() if isinstance(when, datetime) else "",
        }


class SupportTicketModel:
    """A staff member asking the platform team for help."""

    collection_name = "support_tickets"

    PRIORITIES = ["Low", "Normal", "High", "Urgent"]
    CATEGORIES = [
        "Account & access",
        "A bug or something broken",
        "Billing",
        "Feature request",
        "Data or reporting",
        "Something else",
    ]
    STATUS_OPEN = "open"
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_RESOLVED = "resolved"

    @staticmethod
    def make_reference(count: int) -> str:
        return f"WS-{datetime.now(timezone.utc).strftime('%y%m')}-{count + 1:04d}"

    @staticmethod
    def create_document(
        user_id: str,
        user_name: str,
        user_email: str,
        subject: str,
        message: str,
        category: str = "Something else",
        priority: str = "Normal",
        reference: str = "",
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,
            "user_name": user_name,
            "user_email": user_email,
            "reference": reference,
            "subject": subject,
            "message": message,
            "category": category if category in SupportTicketModel.CATEGORIES else "Something else",
            "priority": priority if priority in SupportTicketModel.PRIORITIES else "Normal",
            "status": SupportTicketModel.STATUS_OPEN,
            "replies": [],
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        created = doc.get("created_at")
        return {
            "id": str(doc["_id"]),
            "reference": doc.get("reference", ""),
            "subject": doc.get("subject", ""),
            "message": doc.get("message", ""),
            "category": doc.get("category", ""),
            "priority": doc.get("priority", "Normal"),
            "status": doc.get("status", "open"),
            "replies": [
                {
                    "body": r.get("body", ""),
                    "by": r.get("by", ""),
                    "when": r["at"].strftime("%b %d, %Y")
                    if isinstance(r.get("at"), datetime)
                    else "",
                }
                for r in (doc.get("replies") or [])
            ],
            "raised_on": created.strftime("%b %d, %Y") if isinstance(created, datetime) else "",
        }
