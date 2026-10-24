from datetime import datetime, timezone
from typing import Optional


class ProgramModel:
    """
    The 'programs' collection — every course in Learn, whoever wrote it.

    Staff create programmes from the dashboard. A verified MEMBER can also teach
    one (routes/teach.py): it carries `owner_kind: "member"`, her `owner_id` and
    `teacher_name`, and may have a price. A paid member course is paid to HER,
    directly by UPI — WomSakhi never holds the money (see routes/market.py) —
    so the course stores the UPI id the learner pays and the teacher confirms
    each payment herself. Courses with no `owner_kind` are staff courses.

    A lesson (`curriculum[i]`) is {title, detail, duration} and, for courses
    with real content, `body` (the lesson text) and `video_url` (a link).
    """

    collection_name = "programs"

    # Allowed values, kept here so routes/schemas/seed all agree.
    CATEGORIES = [
        "Digital Literacy",
        "Entrepreneurship",
        "Handicrafts",
        "Personal Development",
        "Sustainability",
        "Health & Wellness",
        "Cooking & Food",
        "Beauty & Care",
        "Money & Savings",
        "Languages",
    ]

    OWNER_STAFF = "staff"
    OWNER_MEMBER = "member"
    MODES = ["Online", "Offline", "Hybrid"]
    STATUSES = ["Active", "Upcoming", "Completed", "Draft", "Archived"]

    # Category -> badge tone / progress-bar colour, mirrored from the UI maps.
    CAT_TONE = {
        "Digital Literacy": "violet",
        "Entrepreneurship": "brand",
        "Handicrafts": "amber",
        "Personal Development": "sky",
        "Sustainability": "emerald",
        "Health & Wellness": "emerald",
        "Cooking & Food": "amber",
        "Beauty & Care": "brand",
        "Money & Savings": "sky",
        "Languages": "violet",
    }
    CAT_BAR = {
        "Digital Literacy": "#8b5cf6",
        "Entrepreneurship": "#e6117e",
        "Handicrafts": "#f59e0b",
        "Personal Development": "#3b82f6",
        "Sustainability": "#14b8a6",
        "Health & Wellness": "#10b981",
        "Cooking & Food": "#f59e0b",
        "Beauty & Care": "#e6117e",
        "Money & Savings": "#0ea5e9",
        "Languages": "#8b5cf6",
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
            # The OUTLINE only — titles, a line, a length. A lesson's text and
            # video are hers to read once she has joined, so they are served by
            # /me/programs/{id}/detail and never by the open catalogue.
            "curriculum": ProgramModel.outline(doc),
            "owner_kind": doc.get("owner_kind") or ProgramModel.OWNER_STAFF,
            "owner_id": doc.get("owner_id", ""),
            "teacher_name": doc.get("teacher_name") or "WomSakhi team",
            "price_minor": int(doc.get("price_minor") or 0),
        }

    @staticmethod
    def outline(doc: dict) -> list[dict]:
        return [
            {
                "title": (m or {}).get("title", ""),
                "detail": (m or {}).get("detail", ""),
                "duration": (m or {}).get("duration", ""),
                # A free preview lesson anyone can open before joining.
                "preview": bool((m or {}).get("preview")),
            }
            for m in (doc.get("curriculum") or [])
        ]

    @staticmethod
    def is_paid(doc: dict) -> bool:
        return int(doc.get("price_minor") or 0) > 0
