from datetime import datetime, timezone
from typing import Optional


class MemberModel:
    """
    The 'members' collection — the platform's user directory shown on the
    Users screen (separate from the 'users' collection used for admin logins).
    """

    collection_name = "members"

    # Allowed values, kept here so routes/schemas/seed all agree.
    ROLES = ["Member", "Instructor", "Supervisor", "Admin"]
    STATUSES = ["Active", "Inactive", "Pending", "Rejected"]
    SEGMENTS = ["Entrepreneur", "Student", "Artisan", "Job Seeker", "Support Seeker"]

    @staticmethod
    def create_document(
        full_name: str,
        email: str,
        phone: str = "",
        role: str = "Member",
        status: str = "Active",
        location: str = "",
        segment: str = "Entrepreneur",
        gender: str = "Female",
        dob: str = "",
        referral: str = "",
        engagement: int = 0,
        verified_on: str = "",
        code: Optional[str] = None,
        avatar: str = "",
        created_at: Optional[datetime] = None,
    ) -> dict:
        now = datetime.now(timezone.utc)
        joined = created_at or now
        return {
            "code": code or "",
            "full_name": full_name.strip(),
            "email": email.lower().strip(),
            "phone": phone.strip(),
            "role": role,
            "status": status,
            "location": location.strip(),
            "segment": segment,
            "gender": gender,
            "dob": dob,
            "referral": referral,
            "engagement": engagement,
            "verified_on": verified_on,
            "avatar": avatar,
            "created_at": joined,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        joined_at = doc.get("created_at")
        return {
            "id": str(doc["_id"]),
            "code": doc.get("code", ""),
            "full_name": doc.get("full_name", ""),
            "email": doc.get("email", ""),
            "phone": doc.get("phone", ""),
            "role": doc.get("role", "Member"),
            "status": doc.get("status", "Active"),
            "location": doc.get("location", ""),
            "segment": doc.get("segment", ""),
            "gender": doc.get("gender", ""),
            "dob": doc.get("dob", ""),
            "referral": doc.get("referral", ""),
            "engagement": doc.get("engagement", 0),
            "verified_on": doc.get("verified_on", ""),
            "avatar": doc.get("avatar", ""),
            # "joined" is the human date the UI shows; derived from created_at.
            "joined": joined_at.strftime("%b %d, %Y") if isinstance(joined_at, datetime) else "",
            "created_at": joined_at.isoformat() if isinstance(joined_at, datetime) else "",
        }
