"""
Model for the Dashboard screen.

The dashboard is an *aggregate* screen: almost everything it shows is rolled up
from other modules' collections (members, appointments, programs). The only
collection it owns is a single snapshot document:

    system_overview  — one doc feeding the "System Overview" card (storage gauge,
                       active sessions, system status, last backup).

Fixed platform-wide figures (the 4 KPI cards, the appointment trend, the
users-by-role donut) are NOT stored here — they are returned verbatim by the
route because no live rollup source matches those blueprint numbers.
"""

from datetime import datetime, timezone
from typing import Optional


def _num(value) -> object:
    """Render 100.0 as 100 but keep 24.6 as 24.6, for clean display strings."""
    if isinstance(value, (int, float)) and float(value).is_integer():
        return int(value)
    return value


class SystemOverviewModel:
    """
    Singleton snapshot feeding the dashboard's "System Overview" card. Stored as
    exactly one document in the `system_overview` collection.
    """

    collection_name = "system_overview"

    @staticmethod
    def create_document(
        storage_used_gb: float = 24.6,
        storage_total_gb: float = 100.0,
        storage_percent: float = 24.6,
        active_sessions: int = 18,
        system_status: str = "operational",
        status_label: str = "All systems operational",
        last_backup_at: Optional[datetime] = None,
        last_backup_type: str = "Daily backup",
    ) -> dict:
        now = datetime.now(timezone.utc)
        # Matches the UI's "May 20, 2024 02:30 AM" backup timestamp.
        backup = last_backup_at or datetime(2024, 5, 20, 2, 30, tzinfo=timezone.utc)
        return {
            "storage_used_gb": storage_used_gb,
            "storage_total_gb": storage_total_gb,
            "storage_percent": storage_percent,
            "active_sessions": active_sessions,
            "system_status": system_status,
            "status_label": status_label,
            "last_backup_at": backup,
            "last_backup_type": last_backup_type,
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        used = doc.get("storage_used_gb", 0)
        total = doc.get("storage_total_gb", 0)
        pct = doc.get("storage_percent", 0)
        backup = doc.get("last_backup_at")
        return {
            "storage_percent": pct,
            # Preformatted strings the card paints verbatim.
            "storage_percent_label": f"{_num(pct)}%",
            "storage_used_gb": used,
            "storage_total_gb": total,
            "storage_label": f"{_num(used)} GB / {_num(total)} GB",
            "active_sessions": doc.get("active_sessions", 0),
            "system_status": doc.get("system_status", "operational"),
            "status_label": doc.get("status_label", "All systems operational"),
            "last_backup_at": backup.isoformat() if isinstance(backup, datetime) else "",
            "last_backup_label": backup.strftime("%b %d, %Y %I:%M %p") if isinstance(backup, datetime) else "",
            "last_backup_type": doc.get("last_backup_type", ""),
        }
