from datetime import datetime, timezone
from typing import Optional


# The "synced" caption each integration shows depends only on its status —
# mirrors the frontend's setStatus() so the same text appears everywhere.
def synced_for(status: str) -> str:
    if status == "Connected":
        return "Last synced: just now"
    if status == "Inactive":
        return "Not connected"
    return "Never connected"


def connected_label(dt: Optional[datetime]) -> Optional[str]:
    """Turn a connected-at datetime into the 'Recently Connected' caption,
    e.g. 'Connected on May 20, 2024 at 10:30 AM'. None when never connected."""
    if not dt:
        return None
    return dt.strftime("Connected on %b %d, %Y at %I:%M %p")


class IntegrationModel:
    """
    The 'integrations' collection — every card on the Settings → Integrations
    screen (icon, category, status and the Manage-modal toggles). Icons are
    stored by their lucide NAME (a string) so the frontend can render them.
    """

    collection_name = "integrations"

    STATUSES = ["Connected", "Inactive", "Not Connected"]

    @staticmethod
    def create_document(
        name: str,
        icon: str,
        tone: str,
        category: str,
        cat_tone: str,
        desc: str = "",
        status: str = "Not Connected",
        synced: Optional[str] = None,
        notifications: bool = False,
        auto_sync: bool = False,
        connected_at: Optional[datetime] = None,
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "name": name.strip(),
            "icon": icon,          # lucide icon name, e.g. "Calendar"
            "tone": tone,          # accent tone the icon chip uses
            "category": category,
            "cat_tone": cat_tone,  # tone of the category badge
            "desc": desc.strip(),
            "status": status,
            "synced": synced if synced is not None else synced_for(status),
            "notifications": notifications,
            "auto_sync": auto_sync,
            "connected_at": connected_at,  # datetime|None, powers Recently Connected
            "created_at": now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "id": str(doc["_id"]),
            "name": doc.get("name", ""),
            "icon": doc.get("icon", "Puzzle"),
            "tone": doc.get("tone", "slate"),
            "category": doc.get("category", ""),
            "cat_tone": doc.get("cat_tone", "slate"),
            "desc": doc.get("desc", ""),
            "status": doc.get("status", "Not Connected"),
            "synced": doc.get("synced", ""),
            "notifications": doc.get("notifications", False),
            "auto_sync": doc.get("auto_sync", False),
            "connected_at": connected_label(doc.get("connected_at")),
        }


class PermissionGroupModel:
    """
    The 'permission_groups' collection — the 10 permission buckets listed in the
    Role Details panel of Settings → Roles & Permissions (name + '6 / 6' count).
    """

    collection_name = "permission_groups"

    @staticmethod
    def create_document(
        name: str,
        count: str,
        total: int,
        order: int = 0,
    ) -> dict:
        return {
            "name": name.strip(),
            "count": count,   # display string the UI shows verbatim, e.g. "6 / 6"
            "total": total,   # number of permissions in the group
            "order": order,   # keeps the on-screen ordering
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "id": str(doc["_id"]),
            "name": doc.get("name", ""),
            "count": doc.get("count", ""),
            "total": doc.get("total", 0),
            "order": doc.get("order", 0),
        }


class IntegrationRequestModel:
    """
    The 'integration_requests' collection — submissions from the
    'Request an Integration' modal. Starts empty (seed 0).
    """

    collection_name = "integration_requests"

    @staticmethod
    def create_document(
        service: str,
        category: str = "Payments",
        details: str = "",
        created_at: Optional[datetime] = None,
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "service": service.strip(),
            "category": category,
            "details": details.strip(),
            "created_at": created_at or now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        created = doc.get("created_at")
        return {
            "id": str(doc["_id"]),
            "service": doc.get("service", ""),
            "category": doc.get("category", ""),
            "details": doc.get("details", ""),
            "createdAt": created.isoformat() if created else None,
        }


class WebhookConfigModel:
    """
    The 'webhook_config' collection — the single row behind the Manage Webhooks
    modal (endpoint URL + signing secret).
    """

    collection_name = "webhook_config"

    @staticmethod
    def create_document(url: str, signing_secret: str) -> dict:
        return {
            "url": url.strip(),
            "signing_secret": signing_secret,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "url": doc.get("url", ""),
            "signing_secret": doc.get("signing_secret", ""),
        }
