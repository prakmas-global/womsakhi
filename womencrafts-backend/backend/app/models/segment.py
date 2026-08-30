from datetime import datetime, timezone


class SegmentModel:
    """The 'segments' collection — audience segments shown on Users → Segments."""

    collection_name = "segments"

    STATUSES = ["Active", "Inactive"]

    @staticmethod
    def create_document(
        name: str,
        desc: str = "",
        users: str = "0",
        pct: str = "0%",
        eng: int = 0,
        growth: str = "0%",
        up: bool = True,
        status: str = "Active",
        icon: str = "Users",
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "name": name.strip(),
            "desc": desc.strip(),
            "users": users,   # kept as the display string the UI shows, e.g. "3,245"
            "pct": pct,
            "eng": eng,
            "growth": growth,
            "up": up,
            "status": status,
            "icon": icon,
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "id": str(doc["_id"]),
            "name": doc.get("name", ""),
            "desc": doc.get("desc", ""),
            "users": doc.get("users", "0"),
            "pct": doc.get("pct", "0%"),
            "eng": doc.get("eng", 0),
            "growth": doc.get("growth", "0%"),
            "up": doc.get("up", True),
            "status": doc.get("status", "Active"),
            "icon": doc.get("icon", "Users"),
        }
