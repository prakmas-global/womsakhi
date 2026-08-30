from typing import Literal, Optional

from pydantic import BaseModel, field_validator

ContentType = Literal["Page", "Blog Post", "Media", "Banner", "FAQ", "Program", "Testimonial"]
ContentStatus = Literal["Published", "Draft", "Scheduled"]
BulkActionName = Literal["publish", "draft", "trash"]


class ContentResponse(BaseModel):
    id: str
    title: str
    slug: str
    type: str
    tone: str
    status: str
    s_tone: str
    author: str
    description: str
    updated: str
    icon: str
    cover: str


class ContentListResponse(BaseModel):
    items: list[ContentResponse]
    total: int
    showing_from: int
    showing_to: int
    page: int
    total_pages: int


class ContentCreate(BaseModel):
    title: str
    type: ContentType = "Page"
    status: ContentStatus = "Draft"
    author: str = "Neha Verma"
    slug: str = ""
    description: str = ""
    cover: str = ""  # URL from POST /uploads

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
    author: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    cover: Optional[str] = None

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Title cannot be empty")
        return v


class ContentStatusUpdate(BaseModel):
    status: ContentStatus


class ContentBulkAction(BaseModel):
    ids: list[str]
    action: BulkActionName


class ContentBulkResult(BaseModel):
    action: BulkActionName
    affected: int
    message: str


# --- Stats (singleton snapshot) ----------------------------------------------
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
    total_content: int
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
    storage_used_gb: float
    storage_total_gb: float
    storage_percent: float


class ContentActivityResponse(BaseModel):
    id: str
    icon: str
    tone: str
    text: str
    meta: str
