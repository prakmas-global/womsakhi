from typing import Literal, Optional

from pydantic import BaseModel, field_validator

RoleType = Literal["System", "Custom"]
RoleStatus = Literal["Active", "Inactive"]


class RoleResponse(BaseModel):
    id: str
    name: str
    desc: str
    users: int
    type: str
    perms: int
    status: str
    icon: str
    modules: list[str] = []
    created: str


class RoleModulesUpdate(BaseModel):
    modules: list[str]


class PermissionAction(BaseModel):
    key: str
    action: str
    label: str
    granted: bool


class PermissionGroup(BaseModel):
    module: str
    label: str
    granted: int
    total: int
    actions: list[PermissionAction]


class RolePermissions(BaseModel):
    """One role's granular permissions, grouped the way the screen renders them."""
    role_id: str
    role_name: str
    is_super_admin: bool
    granted: int
    total: int
    groups: list[PermissionGroup]


class RolePermissionsUpdate(BaseModel):
    permissions: list[str]


class RoleListResponse(BaseModel):
    items: list[RoleResponse]
    total: int


class RoleCreate(BaseModel):
    name: str
    desc: str = ""
    users: int = 0
    type: RoleType = "Custom"
    perms: int = 0
    status: RoleStatus = "Active"
    icon: str = "ShieldCheck"
    modules: Optional[list[str]] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Role name cannot be empty")
        return v


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    desc: Optional[str] = None
    users: Optional[int] = None
    type: Optional[RoleType] = None
    perms: Optional[int] = None
    status: Optional[RoleStatus] = None
    icon: Optional[str] = None
    modules: Optional[list[str]] = None
