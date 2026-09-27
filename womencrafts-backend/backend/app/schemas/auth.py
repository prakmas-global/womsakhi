from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator
import phonenumbers


def _valid_password(value: str, label: str = "Password") -> str:
    if len(value) < 8:
        raise ValueError(f"{label} must be at least 8 characters")
    if len(value.encode("utf-8")) > 72:
        raise ValueError(f"{label} must be at most 72 bytes")
    if not any(character.isalpha() for character in value):
        raise ValueError(f"{label} must include at least one letter")
    if not any(character.isdigit() for character in value):
        raise ValueError(f"{label} must include at least one number")
    if not any(not character.isalnum() and not character.isspace() for character in value):
        raise ValueError(f"{label} must include at least one symbol")
    return value


class SignUpRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    country: str
    phone: str
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
        return _valid_password(v)

    @field_validator("country")
    @classmethod
    def country_is_required(cls, value: str) -> str:
        value = value.strip().upper()
        if len(value) != 2 or value not in phonenumbers.SUPPORTED_REGIONS:
            raise ValueError("Select a valid country")
        return value

    @field_validator("phone")
    @classmethod
    def phone_matches_country(cls, value: str, info) -> str:
        country = info.data.get("country", "")
        if not value.strip():
            raise ValueError("Mobile number is required")
        try:
            parsed = phonenumbers.parse(value, country or None)
        except phonenumbers.NumberParseException as exc:
            raise ValueError("Enter a valid mobile number for the selected country") from exc
        if not phonenumbers.is_valid_number(parsed) or phonenumbers.region_code_for_number(parsed) != country:
            raise ValueError("Enter a valid mobile number for the selected country")
        return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)


class SignInRequest(BaseModel):
    email: EmailStr
    password: str
    two_factor_code: str = ""


class ForgotPasswordRequest(BaseModel):
    """Just the address. The answer is the same whether or not it exists."""

    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """The token out of the emailed link, and what she wants instead."""

    token: str
    password: str

    @field_validator("token")
    @classmethod
    def token_must_be_present(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("That link is missing its reset code")
        return v

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        return _valid_password(v)


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
        return _valid_password(v, "New password")


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
