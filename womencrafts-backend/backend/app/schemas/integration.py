from typing import Literal, Optional

from pydantic import BaseModel, field_validator

IntegrationStatus = Literal["Connected", "Inactive", "Not Connected"]
IntegrationAction = Literal["connect", "disconnect", "sync"]


# --- Integrations -------------------------------------------------------------
class IntegrationResponse(BaseModel):
    id: str
    name: str
    icon: str
    tone: str
    category: str
    cat_tone: str
    desc: str
    status: str
    synced: str
    notifications: bool
    auto_sync: bool
    connected_at: Optional[str] = None


class IntegrationListResponse(BaseModel):
    items: list[IntegrationResponse]
    total: int
    page: int
    page_size: int
    pages: int


class IntegrationUpdate(BaseModel):
    """Body of PATCH /integrations/{id}. Powers the Manage-modal toggles and can
    also flip status via an action (connect / disconnect / sync)."""

    action: Optional[IntegrationAction] = None
    status: Optional[IntegrationStatus] = None
    notifications: Optional[bool] = None
    auto_sync: Optional[bool] = None


class IntegrationStatsResponse(BaseModel):
    total_integrations: int
    active_integrations: int
    available_integrations: str
    sync_status: str
    last_checked: str


class IntegrationOverviewSlice(BaseModel):
    name: str
    value: int
    color: str
    pct: str


class IntegrationOverviewResponse(BaseModel):
    overview: list[IntegrationOverviewSlice]
    total: int


class IntegrationRecentItem(BaseModel):
    name: str
    icon: str
    tone: str
    when: str


# --- Webhooks -----------------------------------------------------------------
class WebhookResponse(BaseModel):
    url: str
    signing_secret: str


class WebhookUpdate(BaseModel):
    url: str

    @field_validator("url")
    @classmethod
    def url_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Webhook URL is required")
        return v


# --- Integration requests -----------------------------------------------------
class IntegrationRequestCreate(BaseModel):
    service: str
    category: str = "Payments"
    details: str = ""

    @field_validator("service")
    @classmethod
    def service_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Service name is required")
        return v


class IntegrationRequestResponse(BaseModel):
    id: str
    service: str
    category: str
    details: str
    createdAt: Optional[str] = None


# --- Permission groups (Roles & Permissions page) -----------------------------
class PermissionGroupResponse(BaseModel):
    id: str
    name: str
    count: str
    total: int
    order: int


class PermissionGroupsResponse(BaseModel):
    groups: list[PermissionGroupResponse]
    total: int


class PermissionStatsResponse(BaseModel):
    total_permissions: str
    permission_groups: int
    covered_permissions: int
