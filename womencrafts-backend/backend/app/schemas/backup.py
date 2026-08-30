from typing import Literal

from pydantic import BaseModel, field_validator


class BackupItem(BaseModel):
    id: str
    name: str
    kind: str
    collections: list[str]
    collection_count: int
    note: str
    status: str
    doc_count: int
    size_bytes: int
    size: str
    error: str
    created_by_name: str
    created_on: str
    created_at: str
    downloadable: bool


class BackupCreate(BaseModel):
    name: str = ""
    kind: Literal["full", "custom"] = "full"
    collections: list[str] = []
    note: str = ""

    @field_validator("name")
    @classmethod
    def trim(cls, v: str) -> str:
        if v and len(v) > 120:
            raise ValueError("Keep the name under 120 characters")
        return (v or "").strip()


class RestoreRequest(BaseModel):
    """`confirm` must equal the backup's name — see routes/backups.restore_backup."""
    confirm: str
    collections: list[str] = []


class BackupSchedule(BaseModel):
    enabled: bool
    frequency: str
    time: str
    keep_last: int
    note: str = ""


class BackupScheduleUpdate(BaseModel):
    enabled: bool = False
    frequency: str = "Daily"
    time: str = "02:00"
    keep_last: int = 7

    @field_validator("frequency")
    @classmethod
    def known(cls, v: str) -> str:
        if v not in ("Hourly", "Daily", "Weekly", "Monthly"):
            raise ValueError("Unknown frequency")
        return v

    @field_validator("keep_last")
    @classmethod
    def sane(cls, v: int) -> int:
        if not (1 <= v <= 365):
            raise ValueError("Keep between 1 and 365 backups")
        return v
