"""
Models for the Reports screen.

Two collections back this screen:

    reports           — the rows of the "All Reports" table (one doc per report)
    reports_overview  — a single snapshot document that feeds the 5 stat cards
                        and the three "Reports Overview" widgets (area trend,
                        bar trend, top-categories donut)

The overview numbers are a fixed, pre-computed snapshot (mirroring the mock
data the page shows today), NOT rollups of the 6 sample reports.
"""

from datetime import datetime, timezone
from typing import Optional


class ReportModel:
    """One report row shown in the 'All Reports' table."""

    collection_name = "reports"

    # Allowed values, kept here so routes/schemas/seed all agree.
    CATEGORIES = ["User Activity", "Appointments", "Program & Services", "Financial", "Marketing", "Others"]
    TYPES = ["Summary", "Detailed", "Custom"]
    SCHEDULES = ["Daily", "Weekly", "Monthly", "On Demand"]

    # category -> (tone, icon) exactly as the UI's CAT_META derives them.
    _CAT_META = {
        "User Activity": ("violet", "Users"),
        "Appointments": ("sky", "CalendarDays"),
        "Program & Services": ("emerald", "BriefcaseBusiness"),
        "Financial": ("amber", "DollarSign"),
        "Marketing": ("rose", "Megaphone"),
        "Others": ("slate", "Sparkles"),
    }

    @classmethod
    def tone_for(cls, category: str) -> str:
        return cls._CAT_META.get(category, ("slate", "Sparkles"))[0]

    @classmethod
    def icon_for(cls, category: str) -> str:
        return cls._CAT_META.get(category, ("slate", "Sparkles"))[1]

    @classmethod
    def create_document(
        cls,
        name: str,
        description: str = "",
        category: str = "Others",
        type: str = "Summary",
        schedule: str = "On Demand",
        schedule_detail: str = "",
        last_generated: str = "",
        created_by: str = "Admin User",
        scheduled: bool = False,
        tone: Optional[str] = None,
        icon: Optional[str] = None,
        created_at: Optional[datetime] = None,
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "name": name.strip(),
            "description": description.strip(),
            "category": category,
            # tone + icon are derived from the category when not given explicitly.
            "tone": tone or cls.tone_for(category),
            "icon": icon or cls.icon_for(category),
            "type": type,
            "schedule": schedule,
            "schedule_detail": schedule_detail,
            "last_generated": last_generated,
            "created_by": created_by,
            "scheduled": bool(scheduled),
            "created_at": created_at or now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        created = doc.get("created_at")
        return {
            "id": str(doc["_id"]),
            "name": doc.get("name", ""),
            "description": doc.get("description", ""),
            "category": doc.get("category", ""),
            "tone": doc.get("tone", "slate"),
            "icon": doc.get("icon", "Sparkles"),
            "type": doc.get("type", "Summary"),
            "schedule": doc.get("schedule", "On Demand"),
            "schedule_detail": doc.get("schedule_detail", ""),
            "last_generated": doc.get("last_generated", ""),
            "created_by": doc.get("created_by", ""),
            "scheduled": bool(doc.get("scheduled", False)),
            "created_at": created.isoformat() if isinstance(created, datetime) else "",
        }


class ReportsOverviewModel:
    """
    Singleton snapshot feeding the 5 stat cards and the 'Reports Overview'
    widgets. The trend arrays and category slices are stored verbatim so the
    charts render exactly the numbers the page shows today.
    """

    collection_name = "reports_overview"

    @staticmethod
    def create_document(
        total_reports: int,
        scheduled_reports: int,
        reports_generated: int,
        reports_generated_delta: float,
        avg_generation_time: str,
        data_points_analyzed: str,
        data_points_delta: float,
        generated_trend: list,
        data_points_trend: list,
        top_categories: list,
    ) -> dict:
        return {
            "total_reports": total_reports,
            "scheduled_reports": scheduled_reports,
            "reports_generated": reports_generated,
            "reports_generated_delta": reports_generated_delta,
            "avg_generation_time": avg_generation_time,
            "data_points_analyzed": data_points_analyzed,
            "data_points_delta": data_points_delta,
            "generated_trend": generated_trend,
            "data_points_trend": data_points_trend,
            "top_categories": top_categories,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "total_reports": doc.get("total_reports", 0),
            "scheduled_reports": doc.get("scheduled_reports", 0),
            "reports_generated": doc.get("reports_generated", 0),
            "reports_generated_delta": doc.get("reports_generated_delta", 0.0),
            "avg_generation_time": doc.get("avg_generation_time", ""),
            "data_points_analyzed": doc.get("data_points_analyzed", ""),
            "data_points_delta": doc.get("data_points_delta", 0.0),
            "generated_trend": doc.get("generated_trend", []),
            "data_points_trend": doc.get("data_points_trend", []),
            "top_categories": doc.get("top_categories", []),
        }
