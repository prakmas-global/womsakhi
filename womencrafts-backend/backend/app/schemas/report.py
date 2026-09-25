from typing import Any, Optional

from pydantic import BaseModel


class ReportRunSummary(BaseModel):
    at: str            # ISO timestamp of the generation
    by: str            # staff name
    rows: int
    range_label: str


class ReportDefinitionResponse(BaseModel):
    key: str
    name: str
    description: str
    category: str
    tone: str
    icon: str
    columns: list[str]
    dated: bool                       # whether a date range narrows it
    privacy_note: str = ""
    last_run: Optional[ReportRunSummary] = None
    runs: int = 0                     # how many times it has been generated


class ReportListResponse(BaseModel):
    items: list[ReportDefinitionResponse]
    total: int


class ReportRunResponse(BaseModel):
    id: str
    report_key: str
    report_name: str
    category: str
    by: str
    at: str
    rows: int
    range_label: str
    duration_ms: int


class CategorySlice(BaseModel):
    name: str
    value: int        # share of all generations, %
    runs: int
    color: str


class MostUsed(BaseModel):
    key: str
    name: str
    runs: int


class ReportsStatsResponse(BaseModel):
    available: int
    generated_this_month: int
    generated_last_month: int
    generated_delta: Optional[str] = None   # None when last month had nothing to compare
    generated_up: bool = True
    rows_this_month: int
    last_generated_at: Optional[str] = None
    last_generated_by: str = ""
    top_categories: list[CategorySlice]
    most_used: list[MostUsed]


class ReportPreviewResponse(BaseModel):
    key: str
    name: str
    columns: list[str]
    total: int
    range_label: str
    rows: list[list[Any]]   # first few rows, as printable cells
