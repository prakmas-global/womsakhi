"""Request and response shapes for organisation settings."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator
from app.core.media import MediaRef, MediaRefOptional


class OrgSettings(BaseModel):
    name: str = ""
    logo: str = ""
    wordmark: str = ""
    default_theme_id: str = ""
    default_primary: str = ""
    default_secondary: str = ""
    default_mode: str = ""
    domain: str = ""
    domain_status: str = "unset"
    domain_token: str = ""
    domain_checked_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class BrandingUpdate(BaseModel):
    name: str = Field("", max_length=80)
    logo: MediaRef = Field("", max_length=500)
    wordmark: str = Field("", max_length=500)


class DefaultThemeUpdate(BaseModel):
    theme_id: str = Field("", max_length=60)
    # Sent by the client from its own preset table — see the model docstring.
    primary: str = Field("", max_length=9)
    secondary: str = Field("", max_length=9)
    mode: Literal["", "light", "dark"] = ""


class DomainUpdate(BaseModel):
    domain: str = Field("", max_length=253)

    @field_validator("domain")
    @classmethod
    def looks_like_a_domain(cls, v: str) -> str:
        v = (v or "").strip().lower().removeprefix("http://").removeprefix("https://").strip("/")
        if not v:
            return ""
        if " " in v or "." not in v or v.startswith(".") or v.endswith("."):
            raise ValueError("That doesn't look like a domain name")
        return v


class LayoutTemplate(BaseModel):
    id: str
    name: str
    role: str
    app: str = "staff"
    applied_at: Optional[datetime] = None
    applied_count: int = 0
    created_at: Optional[datetime] = None


class LayoutTemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    role: str = Field(..., min_length=1, max_length=60)
    app: Literal["staff", "member"] = "staff"
    # Omitted means "save what I am looking at" — the caller's own layout.
    layout: Optional[dict] = None


class ApplyResult(BaseModel):
    applied_count: int
    message: str


class MessageResponse(BaseModel):
    message: str
