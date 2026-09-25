"""
Staff accounts, and the invitations that create them.

── Why this exists ─────────────────────────────────────────────────────────
Until now there was no way to create a staff login at all. `/auth/signup` is
the only endpoint that writes to `users` and it hardcodes `role="Member"`;
`POST /members` writes to the member *directory* and never creates a login, so
anyone added there could not sign in. The single Super Admin was seeded by
hand, and there was no second one.

So a platform whose whole premise is "the Super Admin runs this" had exactly
one such account, no way to make another, and no way to hand a colleague
narrower access.

── A password is never chosen for her ──────────────────────────────────────
Creating an account does not set a password. It creates an invitation: a
single-use token, hashed at rest, that lets the invitee set her own. An admin
who types a colleague's first password knows that password, and on a platform
that holds women's ID documents and their money that is not a footnote.

The raw token is returned exactly once, at creation, so it can be emailed —
or, while the sending domain is still a sandbox, copied and handed over
another way. It is never readable again.

── Deactivating, not deleting ──────────────────────────────────────────────
A staff account that acted on someone's case is part of that case's history.
Removing the row would orphan every audit entry pointing at it, so accounts
are suspended and keep their id.
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

#: How long an invitation is good for. Long enough to survive a weekend,
#: short enough that a forwarded link is not a standing back door.
INVITE_TTL_HOURS = 72

#: Staff account states. `invited` has no password yet and cannot sign in.
INVITED = "invited"
ACTIVE = "active"
SUSPENDED = "suspended"
STATES = (INVITED, ACTIVE, SUSPENDED)


def hash_token(raw: str) -> str:
    """
    Invitation tokens are stored as a SHA-256 digest, never in the clear.

    They are high-entropy random strings rather than passwords, so a fast hash
    is the right tool — the thing bcrypt defends against (guessing a
    low-entropy secret) does not apply, and it keeps the lookup a single
    indexed read.
    """
    return hashlib.sha256(raw.encode()).hexdigest()


class StaffInviteModel:
    collection_name = "staff_invites"

    @staticmethod
    def create_document(*, user_id: str, email: str, invited_by: str) -> tuple[dict, str]:
        """Returns the document to store and the raw token to hand over once."""
        raw = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        return (
            {
                "user_id": user_id,
                "email": email.lower().strip(),
                # Only the digest is kept. See `hash_token`.
                "token_hash": hash_token(raw),
                "invited_by": invited_by,
                "expires_at": now + timedelta(hours=INVITE_TTL_HOURS),
                "accepted_at": None,
                "created_at": now,
            },
            raw,
        )

    @staticmethod
    def is_live(doc: dict) -> bool:
        """Unused and unexpired."""
        if not doc or doc.get("accepted_at"):
            return False
        expires = doc.get("expires_at")
        if not isinstance(expires, datetime):
            return False
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        return expires > datetime.now(timezone.utc)


class StaffAccountModel:
    """
    A staff member, as the admin screens see her.

    This is a view over `users` rather than its own collection — one account,
    one row, one password. A second table of staff would be a second answer to
    "who is this person", and the two would drift.
    """

    @staticmethod
    def state(doc: dict) -> str:
        if not doc.get("is_active", True):
            return SUSPENDED
        if not doc.get("hashed_password"):
            return INVITED
        return ACTIVE

    @staticmethod
    def to_response(doc: dict, *, modules: list[str] | None = None,
                    permissions: list[str] | None = None) -> dict:
        last = doc.get("last_login_at")
        created = doc.get("created_at")
        return {
            "id": str(doc.get("_id", "")),
            "full_name": doc.get("full_name", ""),
            "email": doc.get("email", ""),
            "role": doc.get("role", ""),
            "phone": doc.get("phone", ""),
            "avatar": doc.get("avatar", ""),
            "state": StaffAccountModel.state(doc),
            # What she can actually open and do, resolved from her role plus
            # any per-person grant. The screen shows this, not the role's
            # defaults, because the two can differ.
            "modules": modules or [],
            "permissions": permissions or [],
            # Per-person adjustments, kept separate so the UI can show what is
            # inherited and what was granted to her specifically.
            "extra_permissions": list(doc.get("extra_permissions") or []),
            "denied_permissions": list(doc.get("denied_permissions") or []),
            "last_login_at": last.isoformat() if isinstance(last, datetime) else "",
            "created_at": created.isoformat() if isinstance(created, datetime) else "",
        }
