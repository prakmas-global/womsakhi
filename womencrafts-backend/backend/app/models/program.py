from datetime import datetime, timezone
from typing import Optional


class ProgramModel:
    """
    The 'programs' collection — the learning/development programs shown on the
    Programs screen (list + grid cards, detail modal, create/edit modal).
    """

    collection_name = "programs"

    # Allowed values, kept here so routes/schemas/seed all agree.
    CATEGORIES = [
        "Digital Literacy",
        "Entrepreneurship",
        "Handicrafts",
        "Personal Development",
        "Sustainability",
    ]
    MODES = ["Online", "Offline", "Hybrid"]
    STATUSES = ["Active", "Upcoming", "Completed", "Draft", "Archived"]

    # Category -> badge tone / progress-bar colour, mirrored from the UI maps.
    CAT_TONE = {
        "Digital Literacy": "violet",
        "Entrepreneurship": "brand",
        "Handicrafts": "amber",
        "Personal Development": "sky",
        "Sustainability": "emerald",
    }
    CAT_BAR = {
        "Digital Literacy": "#8b5cf6",
        "Entrepreneurship": "#e6117e",
        "Handicrafts": "#f59e0b",
        "Personal Development": "#3b82f6",
        "Sustainability": "#14b8a6",
    }

    @staticmethod
    def tone_for(category: str) -> str:
        return ProgramModel.CAT_TONE.get(category, "violet")

    @staticmethod
    def bar_for(category: str) -> str:
        return ProgramModel.CAT_BAR.get(category, "#8b5cf6")

    @staticmethod
    def create_document(
        name: str,
        desc: str = "",
        category: str = "Digital Literacy",
        cat_tone: Optional[str] = None,
        mode: str = "Online",
        duration: str = "",
        dates: str = "",
        days: str = "",
        enrolled: int = 0,
        cap: int = 0,
        pct: Optional[int] = None,
        status: str = "Draft",
        note: str = "",
        bar: Optional[str] = None,
        created_at: Optional[datetime] = None,
    ) -> dict:
        now = datetime.now(timezone.utc)
        # pct is derived from enrolled/cap unless an exact value is supplied (seed).
        computed_pct = pct if pct is not None else (round(enrolled / cap * 100) if cap else 0)
        return {
            "name": name.strip(),
            "desc": desc.strip(),
            "category": category,
            "cat_tone": cat_tone or ProgramModel.tone_for(category),
            "mode": mode,
            "duration": duration,
            "dates": dates,
            "days": days,
            "enrolled": enrolled,
            "cap": cap,
            "pct": computed_pct,
            "status": status,
            "note": note or status,
            "bar": bar or ProgramModel.bar_for(category),
            "created_at": created_at or now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "id": str(doc["_id"]),
            "name": doc.get("name", ""),
            "desc": doc.get("desc", ""),
            "category": doc.get("category", ""),
            # snake_case, matching the property the UI reads (p.cat_tone).
            "cat_tone": doc.get("cat_tone", "violet"),
            "mode": doc.get("mode", ""),
            "duration": doc.get("duration", ""),
            "dates": doc.get("dates", ""),
            "days": doc.get("days", ""),
            "enrolled": doc.get("enrolled", 0),
            "cap": doc.get("cap", 0),
            "pct": doc.get("pct", 0),
            "status": doc.get("status", "Draft"),
            "note": doc.get("note", ""),
            "bar": doc.get("bar", "#8b5cf6"),
        }
