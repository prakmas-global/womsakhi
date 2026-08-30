from datetime import datetime, timezone
from typing import Optional


class CalendarEventModel:
    """
    The 'calendar_events' collection — the scheduled events shown on the
    Calendar screen (month/week/day grid, the sidebar legend and the
    "Upcoming Events" list).
    """

    collection_name = "calendar_events"

    # The five legend categories and the exact dot colour the UI paints for each.
    CATEGORIES = ["Career", "Skills", "Business", "Wellness", "Finance"]
    CATEGORY_COLORS = {
        "Career": "#f9a8ce",
        "Skills": "#8b5cf6",
        "Business": "#22c55e",
        "Wellness": "#f59e0b",
        "Finance": "#3b82f6",
    }

    @staticmethod
    def create_document(
        event_id: int,
        title: str,
        category: str,
        date: datetime,
        time: str = "",
        attendee: str = "",
        notes: str = "",
        color: Optional[str] = None,
        created_at: Optional[datetime] = None,
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            # a small integer id the UI uses to cross-reference events
            "event_id": event_id,
            "title": title.strip(),
            "category": category,
            # the day the event lives on, stored midnight-UTC
            "date": date,
            "time": (time or "").strip(),
            "attendee": (attendee or "").strip(),
            "notes": (notes or "").strip(),
            # colour is derived from the category, exactly like the UI preset
            "color": color or CalendarEventModel.CATEGORY_COLORS.get(category, "#f9a8ce"),
            "created_at": created_at or now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        date = doc.get("date")
        created = doc.get("created_at")
        return {
            "id": doc.get("event_id", 0),
            "title": doc.get("title", ""),
            "category": doc.get("category", ""),
            # ISO day string the frontend can parse, e.g. "2024-05-20"
            "date": date.strftime("%Y-%m-%d") if isinstance(date, datetime) else "",
            "time": doc.get("time", ""),
            "attendee": doc.get("attendee", ""),
            "notes": doc.get("notes", ""),
            "color": doc.get("color", ""),
            "created_at": created.isoformat() if isinstance(created, datetime) else "",
        }
