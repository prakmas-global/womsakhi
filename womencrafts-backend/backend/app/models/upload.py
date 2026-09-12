from datetime import datetime, timezone
from typing import Optional

from app.core.media import media_url


class UploadModel:
    """
    The 'uploads' collection — one row per file the admin uploads.

    The bytes live on disk under the backend's media folder; this collection
    only remembers where a file went and who put it there, so any screen can
    show a library of everything that has been uploaded.
    """

    collection_name = "uploads"

    # What the file is for. Keeps the media library filterable.
    KINDS = ["avatar", "cover", "attachment"]

    # Only real image types are accepted (SVG is left out on purpose — it can
    # carry scripts, and these files are served straight back to the browser).
    ALLOWED_TYPES = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
        "image/avif": ".avif",
    }

    @staticmethod
    def extension_for(content_type: str) -> Optional[str]:
        """The file extension we store this content type under, or None if we don't accept it."""
        return UploadModel.ALLOWED_TYPES.get((content_type or "").lower())

    @staticmethod
    def create_document(
        original_name: str,
        stored_name: str,
        url: str,
        content_type: str,
        size: int,
        kind: str = "attachment",
        uploaded_by: str = "",
        uploaded_by_name: str = "",
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "original_name": original_name,
            "stored_name": stored_name,      # the name on disk
            "url": url,                      # a PATH — media/<kind>/<name>. See app/core/media.py
            "content_type": content_type,
            "size": size,                    # bytes
            "kind": kind if kind in UploadModel.KINDS else "attachment",
            "uploaded_by": uploaded_by,
            "uploaded_by_name": uploaded_by_name,
            "created_at": now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        created = doc.get("created_at")
        size = doc.get("size", 0)
        return {
            "id": str(doc["_id"]),
            "original_name": doc.get("original_name", ""),
            "stored_name": doc.get("stored_name", ""),
            "url": media_url(doc.get("url", "")),
            "content_type": doc.get("content_type", ""),
            "size": size,
            "size_label": UploadModel.size_label(size),
            "kind": doc.get("kind", "attachment"),
            "uploaded_by": doc.get("uploaded_by", ""),
            "uploaded_by_name": doc.get("uploaded_by_name", ""),
            "uploaded": created.strftime("%b %d, %Y") if isinstance(created, datetime) else "",
            "created_at": created.isoformat() if isinstance(created, datetime) else "",
        }

    @staticmethod
    def size_label(size: int) -> str:
        """'842 KB' / '1.4 MB' — what the UI prints next to a file."""
        if size < 1024:
            return f"{size} B"
        if size < 1024 * 1024:
            return f"{round(size / 1024)} KB"
        return f"{size / (1024 * 1024):.1f} MB"
