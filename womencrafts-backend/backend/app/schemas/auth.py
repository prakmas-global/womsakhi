from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator


class SignUpRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    phone: str = ""
    locale: str = "en"  # the language she signed up in

    @field_validator("full_name")
    @classmethod
    def full_name_must_not_be_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Full name cannot be empty")
        return v

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class SignInRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    full_name: str
    email: str
    role: str = "Super Admin"
    is_active: bool
    created_at: str
    # RBAC — the module keys this account can open (computed from its role).
    modules: list[str] = []
    # "member" -> the member app (/app); "staff" -> the admin dashboard.
    audience: str = "staff"
    # Set for member accounts: their row in the 'members' directory.
    member_id: str = ""
    locale: str = "en"
    phone: str = ""
    avatar: str = ""
    # Admission state — only "active" may use the member app.
    verification_status: str = "active"
    rejection_reason: str = ""
    theme_id: str = "womsakhi"
    theme_primary: str = "#d21f7c"
    theme_secondary: str = "#7440a6"
    onboarding_done: list[str] = []
    onboarding_complete: bool = False


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def new_password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("New password must be at least 8 characters")
        return v


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    # Staff pick a language the same way members do — the review surface in
    # settings/appearance writes through here.
    locale: Optional[str] = None

    @field_validator("full_name")
    @classmethod
    def full_name_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Full name cannot be empty")
        return v
