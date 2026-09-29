"""Shapes the auth endpoints return. There are no passwords anywhere in here."""

from typing import Optional

from pydantic import BaseModel, field_validator


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
    # Mobile numbers are required but only confirmed once phone codes are on.
    phone_verified: bool = False
    #: True when the screens should ask her to add or confirm her number before
    #: carrying on (no number yet, or phone codes are live and it is unconfirmed).
    phone_action_required: bool = False
    email_verified: bool = True
    avatar: str = ""
    # Admission state — only "active" may use the member app.
    verification_status: str = "active"
    rejection_reason: str = ""
    #: When a rejected applicant may apply again (ISO), '' otherwise.
    reapply_after: str = ""
    #: Staff only: whether the authenticator is set up.
    two_factor_enabled: bool = False
    theme_id: str = "womsakhi"
    theme_primary: str = "#d21f7c"
    theme_secondary: str = "#7440a6"
    onboarding_done: list[str] = []
    onboarding_complete: bool = False


class AuthResponse(BaseModel):
    access_token: str
    #: The browser ignores both tokens and uses its httpOnly cookies; the mobile
    #: app, which has no cookie jar, keeps them in secure storage.
    refresh_token: str = ""
    token_type: str = "bearer"
    user: UserResponse


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
