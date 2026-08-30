from datetime import datetime, timezone
from typing import Optional

from app.models.verification import VerificationStatus


class UserModel:
    """
    The 'users' collection — every account that can sign in, staff and members
    alike. One credential store, one token; the `role` decides which app the
    account lands in (see app.core.rbac).

    A member account also carries `member_id`, pointing at its row in the
    'members' collection — that row is the profile the admin directory manages,
    so a public sign-up shows up there automatically.
    """

    collection_name = "users"

    # Public sign-ups are members. Staff roles are only ever assigned by an
    # existing admin — never by the sign-up form.
    DEFAULT_ROLE = "Member"

    @staticmethod
    def create_document(
        full_name: str,
        email: str,
        hashed_password: str,
        role: str = DEFAULT_ROLE,
        member_id: Optional[str] = None,
        locale: str = "en",
        theme_id: str = "womsakhi",
        phone: str = "",
        avatar: str = "",
        verification_status: str = VerificationStatus.PENDING_EMAIL,
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "full_name": full_name,
            "email": email.lower().strip(),
            "hashed_password": hashed_password,
            "role": role,
            "member_id": member_id,   # str(ObjectId) of the linked members row
            "locale": locale,         # the account's language, follows them across devices
            # Colour theme. Only the two seeds are stored; every shade is
            # derived on the client, so the stored values cannot drift apart.
            "theme_id": theme_id,
            "theme_primary": "#d21f7c",
            "theme_secondary": "#7440a6",
            # Onboarding progress — which steps she has finished, so closing
            # the app mid-flow doesn't start her over.
            "onboarding_done": [],
            "onboarding_complete": False,
            "phone": phone,
            "avatar": avatar,
            "is_active": True,
            # Where this account is on the admission path (see models/verification).
            "verification_status": verification_status,
            "email_verified_at": None,
            "verified_at": None,
            "rejection_reason": "",
            # Brute-force protection state.
            "failed_logins": 0,
            "locked_until": None,
            "last_login_at": None,
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(document: dict) -> dict:
        """Strip sensitive fields before returning to client."""
        created = document.get("created_at")
        return {
            "id": str(document["_id"]),
            "full_name": document.get("full_name", ""),
            "email": document.get("email", ""),
            # Legacy admin accounts predate the role field; they stay Super Admin.
            "role": document.get("role") or "Super Admin",
            # Which app this account signs in to.
            #
            # Derived here rather than left to `UserResponse`, whose default is
            # "staff". `/users/me` never set the field, so every MEMBER was told
            # she was staff. The member shell checks this, saw "staff", and
            # redirected to /dashboard — which is why every member screen sat on
            # a spinner that never resolved. Sign-in set it correctly, so the
            # app worked until the first reload.
            "audience": (
                "member" if (document.get("role") or "Super Admin") == "Member" else "staff"
            ),
            "member_id": document.get("member_id") or "",
            "locale": document.get("locale") or "en",
            "theme_id": document.get("theme_id") or "womsakhi",
            "theme_primary": document.get("theme_primary") or "#d21f7c",
            "theme_secondary": document.get("theme_secondary") or "#7440a6",
            "onboarding_done": document.get("onboarding_done") or [],
            "onboarding_complete": bool(document.get("onboarding_complete", False)),
            "phone": document.get("phone", ""),
            "avatar": document.get("avatar", ""),
            "is_active": document.get("is_active", True),
            # Staff accounts are created by an admin and are active on sight;
            # only member accounts walk the verification path.
            "verification_status": document.get("verification_status")
            or VerificationStatus.ACTIVE,
            "rejection_reason": document.get("rejection_reason", ""),
            "created_at": created.isoformat() if isinstance(created, datetime) else "",
        }
