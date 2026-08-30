from datetime import datetime, timezone
from typing import Optional


class RoleModel:
    """The 'roles' collection — user roles shown on the Users → Roles screen."""

    collection_name = "roles"

    TYPES = ["System", "Custom"]
    STATUSES = ["Active", "Inactive"]

    @staticmethod
    def create_document(
        name: str,
        desc: str = "",
        users: int = 0,
        type: str = "Custom",
        perms: int = 0,
        status: str = "Active",
        icon: str = "ShieldCheck",
        created: Optional[str] = None,
        modules: Optional[list] = None,
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "name": name.strip(),
            "desc": desc.strip(),
            "users": users,
            "type": type,
            "perms": perms,
            "status": status,
            "icon": icon,
            # module keys this role can open (RBAC).
            "modules": modules if modules is not None else ["dashboard"],
            # human "created" label the UI shows; defaults to today.
            "created": created or now.strftime("%b %d, %Y"),
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "id": str(doc["_id"]),
            "name": doc.get("name", ""),
            "desc": doc.get("desc", ""),
            "users": doc.get("users", 0),
            "type": doc.get("type", "Custom"),
            "perms": doc.get("perms", 0),
            "status": doc.get("status", "Active"),
            "icon": doc.get("icon", "ShieldCheck"),
            "modules": doc.get("modules", []),
            "created": doc.get("created", ""),
        }
