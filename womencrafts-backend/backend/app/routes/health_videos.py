"""
Health videos — the library behind Health & Wellness → Videos.

Staff add the videos (Content permission): a YouTube link or a direct link to
an .mp4/.webm file, a category, a length and a level. Members only read the
active ones. What she has watched, saved or finished is hers, in the Health
store as `vwatch` entries (routes/health_hub.py) — nothing about her viewing
is kept on the video.

Nothing is seeded on start-up: a library of invented links would be the kind
of placeholder that looks real and plays nothing. A starter set of real,
checked public videos can be loaded on purpose with
`python -m app.core.seed_health_videos` (see that file); until staff or that
script add some, the member screen says so.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Literal, Optional
from urllib.parse import parse_qs, urlparse

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, field_validator

from app.core.audit import record
from app.core.media import MediaRefOptional, media_url
from app.core.permissions import require_permission
from app.core.rbac import require_active_member
from app.db.mongodb import get_database

router = APIRouter(prefix="/health/videos", tags=["Member · Health"])
admin_router = APIRouter(prefix="/admin/health/videos", tags=["Admin · Health videos"])

VIDEOS = "health_videos"
CATEGORIES = ("Workout", "Yoga", "Meditation", "Pregnancy", "Nutrition", "Sleep", "Fertility", "Mentoring", "Health talks")
LEVELS = ("All levels", "Beginner", "Intermediate", "Gentle")

_YT_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")


def _db():
    return get_database()


def youtube_id(url: str) -> str:
    """The 11-character id of a YouTube link, or "" when it is not one."""
    try:
        u = urlparse(url.strip())
    except ValueError:
        return ""
    host = (u.hostname or "").lower().removeprefix("www.").removeprefix("m.")
    cand = ""
    if host == "youtu.be":
        cand = u.path.lstrip("/").split("/")[0]
    elif host in ("youtube.com", "youtube-nocookie.com", "music.youtube.com"):
        if u.path == "/watch":
            cand = (parse_qs(u.query).get("v") or [""])[0]
        else:
            parts = [p for p in u.path.split("/") if p]
            if len(parts) >= 2 and parts[0] in ("embed", "shorts", "live", "v"):
                cand = parts[1]
    return cand if _YT_ID.match(cand or "") else ""


def _check_url(url: str) -> str:
    url = (url or "").strip()
    if youtube_id(url):
        return url
    u = urlparse(url)
    if u.scheme == "https" and re.search(r"\.(mp4|webm)$", u.path, re.I):
        return url
    raise ValueError("Paste a YouTube link, or an https link to an .mp4 or .webm file")


class VideoIn(BaseModel):
    title: str = Field(..., min_length=2, max_length=100)
    category: Literal["Workout", "Yoga", "Meditation", "Pregnancy", "Nutrition", "Sleep", "Fertility", "Mentoring", "Health talks"]
    url: str = Field(..., max_length=400)
    duration_sec: int = Field(..., ge=10, le=4 * 3600)
    level: Literal["All levels", "Beginner", "Intermediate", "Gentle"] = "All levels"
    description: str = Field("", max_length=400)
    thumbnail: MediaRefOptional = None
    #: Who made it, shown under the title ("WomSakhi", a channel name).
    source: str = Field("", max_length=60)
    active: bool = True
    order: int = Field(100, ge=0, le=10_000)

    @field_validator("url")
    @classmethod
    def ok_url(cls, v: str) -> str:
        return _check_url(v)


class VideoPatch(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=100)
    category: Optional[Literal["Workout", "Yoga", "Meditation", "Pregnancy", "Nutrition", "Sleep", "Fertility", "Mentoring", "Health talks"]] = None
    url: Optional[str] = Field(None, max_length=400)
    duration_sec: Optional[int] = Field(None, ge=10, le=4 * 3600)
    level: Optional[Literal["All levels", "Beginner", "Intermediate", "Gentle"]] = None
    description: Optional[str] = Field(None, max_length=400)
    thumbnail: MediaRefOptional = None
    source: Optional[str] = Field(None, max_length=60)
    active: Optional[bool] = None
    order: Optional[int] = Field(None, ge=0, le=10_000)

    @field_validator("url")
    @classmethod
    def ok_url(cls, v: Optional[str]) -> Optional[str]:
        return None if v is None else _check_url(v)


class VideoOut(BaseModel):
    id: str
    title: str
    category: str
    url: str
    #: The YouTube id when it is a YouTube link; play it with the nocookie embed.
    youtube_id: str = ""
    duration_sec: int
    level: str
    description: str = ""
    thumbnail: str = ""
    source: str = ""
    active: bool = True
    order: int = 100
    created_at: str = ""


def _out(d: dict) -> VideoOut:
    yt = youtube_id(d.get("url", ""))
    thumb = media_url(d.get("thumbnail") or "") or (f"https://i.ytimg.com/vi/{yt}/hqdefault.jpg" if yt else "")
    created = d.get("created_at")
    return VideoOut(
        id=str(d["_id"]), title=d.get("title", ""), category=d.get("category", "Workout"), url=d.get("url", ""),
        youtube_id=yt, duration_sec=int(d.get("duration_sec") or 0), level=d.get("level", "All levels"),
        description=d.get("description", ""), thumbnail=thumb, source=d.get("source", ""),
        active=bool(d.get("active", True)), order=int(d.get("order", 100)),
        created_at=created.isoformat() if isinstance(created, datetime) else "",
    )


def _oid(video_id: str) -> ObjectId:
    if not ObjectId.is_valid(video_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Video not found")
    return ObjectId(video_id)


# ── member ───────────────────────────────────────────────────────────────────

@router.get("", response_model=list[VideoOut], summary="Health videos to watch")
async def list_videos(category: str = Query("", max_length=20), _: dict = Depends(require_active_member)):
    query: dict = {"active": True}
    if category:
        if category not in CATEGORIES:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown category")
        query["category"] = category
    rows = _db()[VIDEOS].find(query).sort([("order", 1), ("created_at", -1)]).limit(300)
    return [_out(d) async for d in rows]


# ── staff ────────────────────────────────────────────────────────────────────

@admin_router.get("", response_model=list[VideoOut], summary="Every health video, active or not")
async def admin_list(_: dict = Depends(require_permission("content.view"))):
    rows = _db()[VIDEOS].find({}).sort([("order", 1), ("created_at", -1)]).limit(1000)
    return [_out(d) async for d in rows]


@admin_router.post("", response_model=VideoOut, status_code=status.HTTP_201_CREATED, summary="Add a health video")
async def admin_add(body: VideoIn, request: Request, staff: dict = Depends(require_permission("content.create"))):
    now = datetime.now(timezone.utc)
    doc = {**body.model_dump(), "created_at": now, "updated_at": now, "created_by": str(staff["_id"])}
    doc["_id"] = (await _db()[VIDEOS].insert_one(doc)).inserted_id
    await record(staff, "health_video.add", target=str(doc["_id"]), detail=body.title, request=request)
    return _out(doc)


@admin_router.patch("/{video_id}", response_model=VideoOut, summary="Change a health video")
async def admin_edit(video_id: str, body: VideoPatch, request: Request,
                     staff: dict = Depends(require_permission("content.edit"))):
    patch = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if not patch:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Nothing to change")
    patch["updated_at"] = datetime.now(timezone.utc)
    doc = await _db()[VIDEOS].find_one_and_update({"_id": _oid(video_id)}, {"$set": patch}, return_document=True)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Video not found")
    await record(staff, "health_video.edit", target=video_id, detail=", ".join(k for k in patch if k != "updated_at"),
                 request=request)
    return _out(doc)


@admin_router.delete("/{video_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a health video")
async def admin_delete(video_id: str, request: Request, staff: dict = Depends(require_permission("content.delete"))):
    doc = await _db()[VIDEOS].find_one_and_delete({"_id": _oid(video_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Video not found")
    await record(staff, "health_video.delete", target=video_id, detail=doc.get("title", ""), request=request)
