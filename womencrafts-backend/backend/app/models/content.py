from datetime import datetime, timezone
from typing import Optional

from app.core.media import media_url


class ContentItemModel:
    """
    The 'content_items' collection — every page/post/media/banner shown in the
    Content screen table (list, detail modal, add/edit modal, bulk actions).
    """

    collection_name = "content_items"

    # Allowed values, kept here so routes/schemas/seed all agree.
    TYPES = ["Page", "Blog Post", "Media", "Banner", "FAQ", "Program", "Testimonial"]
    STATUSES = ["Published", "Draft", "Scheduled"]

    # Type -> badge tone / lucide icon name, mirrored from the UI maps.
    TYPE_TONE = {
        "Page": "violet",
        "Blog Post": "emerald",
        "Media": "sky",
        "Banner": "amber",
        "FAQ": "amber",
        "Program": "brand",
        "Testimonial": "violet",
    }
    TYPE_ICON = {
        "Page": "FileText",
        "Blog Post": "Newspaper",
        "Media": "ImageIcon",
        "Banner": "Megaphone",
        "FAQ": "HelpCircle",
        "Program": "FileStack",
        "Testimonial": "MessageSquareQuote",
    }
    # Status -> status-dot tone (sTone), mirrored from the UI STATUS_TONE map.
    STATUS_TONE = {
        "Published": "emerald",
        "Scheduled": "sky",
        "Draft": "amber",
    }

    @staticmethod
    def tone_for(content_type: str) -> str:
        return ContentItemModel.TYPE_TONE.get(content_type, "violet")

    @staticmethod
    def icon_for(content_type: str) -> str:
        return ContentItemModel.TYPE_ICON.get(content_type, "FileText")

    @staticmethod
    def s_tone_for(status: str) -> str:
        return ContentItemModel.STATUS_TONE.get(status, "amber")

    @staticmethod
    def create_document(
        title: str,
        slug: str = "",
        type: str = "Page",
        status: str = "Draft",
        author: str = "Neha Verma",
        description: str = "",
        # The article itself. Everything in this collection used to be a title
        # and nothing else — the whole library held 0 words of prose — so the
        # assistant could list what existed and never answer from it.
        body: str = "",
        last_updated: str = "",
        cover: str = "",
        audience_mode: str = "everyone",
        audience_values: Optional[list[str]] = None,
        tone: Optional[str] = None,
        s_tone: Optional[str] = None,
        icon: Optional[str] = None,
        created_at: Optional[datetime] = None,
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "title": title.strip(),
            "slug": slug.strip(),
            "type": type,
            "status": status,
            "author": author,
            "description": description.strip(),
            "body": body.strip(),
            "last_updated": last_updated,
            "cover": cover,
            "audience_mode": audience_mode,
            "audience_values": audience_values or [],
            # tone/s_tone/icon are derived from type & status unless supplied.
            "tone": tone or ContentItemModel.tone_for(type),
            "s_tone": s_tone or ContentItemModel.s_tone_for(status),
            "icon": icon or ContentItemModel.icon_for(type),
            "created_at": created_at or now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "id": str(doc["_id"]),
            "title": doc.get("title", ""),
            "slug": doc.get("slug", ""),
            "type": doc.get("type", ""),
            "tone": doc.get("tone", "violet"),
            "status": doc.get("status", "Draft"),
            # snake_case 's_tone' / 'updated' to match the props the UI reads.
            "s_tone": doc.get("s_tone", "amber"),
            "author": doc.get("author", ""),
            "description": doc.get("description", ""),
            "updated": doc.get("last_updated", ""),
            "icon": doc.get("icon", "FileText"),
            "cover": media_url(doc.get("cover", "")),
            "audience_mode": doc.get("audience_mode", "everyone"),
            "audience_values": doc.get("audience_values", []),
        }


class ContentActivityModel:
    """
    The 'content_activities' collection — the Recent Activity feed on the
    Content screen right rail (4 entries: published / updated / scheduled / trash).
    """

    collection_name = "content_activities"

    @staticmethod
    def create_document(
        icon: str,
        tone: str,
        text: str,
        meta: str,
        order: int = 0,
        created_at: Optional[datetime] = None,
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "icon": icon,
            "tone": tone,
            "text": text,
            "meta": meta,
            "order": order,
            "created_at": created_at or now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "id": str(doc["_id"]),
            "icon": doc.get("icon", ""),
            "tone": doc.get("tone", ""),
            "text": doc.get("text", ""),
            "meta": doc.get("meta", ""),
        }


class ContentStatsModel:
    """
    The 'content_stats' collection — a single seeded snapshot that feeds the 5
    stat cards, the Content Overview donut, the Content Categories bars, and the
    Storage Usage widget. Fixed figures, NOT computed from the 8 sample rows.
    """

    collection_name = "content_stats"

    @staticmethod
    def create_document(
        total_content: int,
        published: int,
        published_pct: float,
        draft: int,
        draft_pct: float,
        scheduled: int,
        scheduled_pct: float,
        trash: int,
        trash_pct: float,
        overview: list,
        overview_total: str,
        categories: list,
        storage_used_gb: float,
        storage_total_gb: float,
        storage_percent: float,
    ) -> dict:
        return {
            "total_content": total_content,
            "published": published,
            "published_pct": published_pct,
            "draft": draft,
            "draft_pct": draft_pct,
            "scheduled": scheduled,
            "scheduled_pct": scheduled_pct,
            "trash": trash,
            "trash_pct": trash_pct,
            "overview": overview,
            "overview_total": overview_total,
            "categories": categories,
            "storage_used_gb": storage_used_gb,
            "storage_total_gb": storage_total_gb,
            "storage_percent": storage_percent,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "total_content": doc.get("total_content", 0),
            "published": doc.get("published", 0),
            "published_pct": doc.get("published_pct", 0.0),
            "draft": doc.get("draft", 0),
            "draft_pct": doc.get("draft_pct", 0.0),
            "scheduled": doc.get("scheduled", 0),
            "scheduled_pct": doc.get("scheduled_pct", 0.0),
            "trash": doc.get("trash", 0),
            "trash_pct": doc.get("trash_pct", 0.0),
            "overview": doc.get("overview", []),
            "overview_total": doc.get("overview_total", ""),
            "categories": doc.get("categories", []),
            "storage_used_gb": doc.get("storage_used_gb", 0.0),
            "storage_total_gb": doc.get("storage_total_gb", 0.0),
            "storage_percent": doc.get("storage_percent", 0.0),
        }
