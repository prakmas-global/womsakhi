from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator, field_validator
from app.core.media import MediaRef, MediaRefOptional

ContentType = Literal["Page", "Blog Post", "Media", "Banner", "FAQ", "Program", "Testimonial"]
ContentStatus = Literal["Published", "Draft", "Scheduled"]
BulkActionName = Literal["publish", "draft", "trash", "restore", "delete"]
AudienceMode = Literal["everyone", "regions", "segments"]


class AudienceFields(BaseModel):
    audience_mode: AudienceMode = "everyone"
    audience_values: list[str] = Field(default_factory=list, max_length=50)

    @model_validator(mode="after")
    def valid_audience(self):
        self.audience_values = list(dict.fromkeys(v.strip() for v in self.audience_values if v.strip()))
        if self.audience_mode == "everyone":
            self.audience_values = []
        elif not self.audience_values:
            raise ValueError("Choose at least one region or segment")
        return self


class ContentResponse(BaseModel):
    id: str
    title: str
    slug: str
    type: str
    tone: str
    status: str            # Published | Draft | Scheduled | Trash
    s_tone: str
    author: str            # the staff account that created it
    description: str
    updated: str           # human label, from updated_at
    updated_at: str        # ISO
    publish_at: Optional[str] = None   # ISO, for Scheduled
    icon: str
    cover: str
    audience_mode: AudienceMode = "everyone"
    audience_values: list[str] = Field(default_factory=list)


class ContentListResponse(BaseModel):
    items: list[ContentResponse]
    total: int
    showing_from: int
    showing_to: int
    page: int
    total_pages: int


class ContentCreate(AudienceFields):
    title: str
    type: ContentType = "Page"
    status: ContentStatus = "Draft"
    slug: str = ""
    description: str = ""
    cover: MediaRef = ""  # URL from POST /uploads
    publish_at: Optional[datetime] = None   # required when status is Scheduled

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Title cannot be empty")
        return v


class ContentUpdate(BaseModel):
    title: Optional[str] = None
    type: Optional[ContentType] = None
    status: Optional[ContentStatus] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    cover: MediaRefOptional = None
    publish_at: Optional[datetime] = None
    audience_mode: Optional[AudienceMode] = None
    audience_values: Optional[list[str]] = Field(default=None, max_length=50)

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Title cannot be empty")
        return v

    @model_validator(mode="after")
    def clean_audience(self):
        if self.audience_values is not None:
            self.audience_values = list(dict.fromkeys(v.strip() for v in self.audience_values if v.strip()))
        if self.audience_mode == "everyone":
            self.audience_values = []
        elif self.audience_mode in ("regions", "segments") and not self.audience_values:
            raise ValueError("Choose at least one region or segment")
        return self


class ContentStatusUpdate(BaseModel):
    status: ContentStatus
    publish_at: Optional[datetime] = None


class ContentBulkAction(BaseModel):
    ids: list[str]
    action: BulkActionName


class ContentBulkResult(BaseModel):
    action: BulkActionName
    affected: int
    message: str


# --- Stats, counted live -----------------------------------------------------------
class OverviewSlice(BaseModel):
    name: str
    value: int
    color: str
    label: str


class CategoryBar(BaseModel):
    name: str
    value: float
    label: str


class ContentStatsResponse(BaseModel):
    total_content: int      # everything that is not in Trash
    published: int
    published_pct: float
    draft: int
    draft_pct: float
    scheduled: int
    scheduled_pct: float
    trash: int
    trash_pct: float
    overview: list[OverviewSlice]
    overview_total: str
    categories: list[CategoryBar]
    storage_used_bytes: int     # sum of uploaded file sizes
    storage_files: int
    storage_label: str          # e.g. "12.4 MB in 31 files"


class ContentActivityResponse(BaseModel):
    id: str
    icon: str
    tone: str
    text: str
    meta: str
