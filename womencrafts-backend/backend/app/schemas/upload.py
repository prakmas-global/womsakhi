from typing import Literal

from pydantic import BaseModel

Kind = Literal["avatar", "cover", "attachment"]


class UploadResponse(BaseModel):
    id: str
    original_name: str
    stored_name: str
    url: str
    content_type: str
    size: int
    size_label: str
    kind: str
    uploaded_by: str
    uploaded_by_name: str
    uploaded: str
    created_at: str


class UploadListResponse(BaseModel):
    items: list[UploadResponse]
    total: int
    page: int
    page_size: int
    pages: int


class UploadStatsResponse(BaseModel):
    total: int
    total_bytes: int
    total_label: str
    by_kind: dict[str, int]


class DeleteResponse(BaseModel):
    message: str
