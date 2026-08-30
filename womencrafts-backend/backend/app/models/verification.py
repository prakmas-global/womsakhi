"""
Account verification.

WomSakhi is a women-only community, so an account is not simply "created" — it
is *admitted*. Every applicant walks a deliberate path and a real person makes
the final call:

    pending_email  → she must confirm she owns the address
    pending_documents → she uploads an identity document
    in_review      → a human reviews it
    active         → admitted; the app opens up
    rejected       → declined, with a reason she is told
    suspended      → previously active, access withdrawn

Only `active` accounts can use the member app. Everything else lands on a status
screen that tells her exactly where she is and what happens next — never a dead
end, never a silent failure.
"""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional


class VerificationStatus:
    PENDING_EMAIL = "pending_email"
    PENDING_DOCUMENTS = "pending_documents"
    IN_REVIEW = "in_review"
    ACTIVE = "active"
    REJECTED = "rejected"
    SUSPENDED = "suspended"

    ALL = [PENDING_EMAIL, PENDING_DOCUMENTS, IN_REVIEW, ACTIVE, REJECTED, SUSPENDED]

    # The only state that may use the member app.
    USABLE = {ACTIVE}

    LABELS = {
        PENDING_EMAIL: "Confirm your email",
        PENDING_DOCUMENTS: "Upload your ID",
        IN_REVIEW: "Being reviewed",
        ACTIVE: "Verified",
        REJECTED: "Not verified",
        SUSPENDED: "Suspended",
    }


class EmailTokenModel:
    """Single-use, expiring tokens for email confirmation and password resets."""

    collection_name = "email_tokens"

    PURPOSE_VERIFY = "verify_email"
    PURPOSE_RESET = "password_reset"

    @staticmethod
    def create_document(user_id: str, purpose: str, hours: int = 24) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,
            "purpose": purpose,
            # 43 url-safe chars of entropy — not guessable, safe in a link.
            "token": secrets.token_urlsafe(32),
            "used_at": None,
            "expires_at": now + timedelta(hours=hours),
            "created_at": now,
        }

    @staticmethod
    def is_valid(doc: Optional[dict]) -> bool:
        if not doc or doc.get("used_at"):
            return False
        expires = doc.get("expires_at")
        if not isinstance(expires, datetime):
            return False
        # Mongo hands back naive datetimes; treat them as UTC.
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        return expires > datetime.now(timezone.utc)


class DocumentModel:
    """
    An identity document submitted for review.

    The file itself lives OUTSIDE the public media folder and is never given a
    public URL — it is streamed only to a reviewing admin, and every view is
    recorded. `stored_name` is a path relative to PRIVATE_MEDIA_DIR.
    """

    collection_name = "verification_documents"

    TYPES = [
        "aadhaar",
        "pan",
        "passport",
        "voter_id",
        "driving_licence",
        "national_id",
        "other",
    ]

    TYPE_LABELS = {
        "aadhaar": "Aadhaar card",
        "pan": "PAN card",
        "passport": "Passport",
        "voter_id": "Voter ID",
        "driving_licence": "Driving licence",
        "national_id": "National ID",
        "other": "Other government ID",
    }

    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    #: A paper she keeps in her own vault. Nobody reviews it, because she did
    #: not ask anyone to — it is her passbook, kept where she can find it when
    #: an office asks. Submitting an ID for the identity check is a different
    #: act with different consequences, and stays PENDING.
    STATUS_STORED = "stored"

    @staticmethod
    def create_document(
        user_id: str,
        member_id: str,
        doc_type: str,
        original_name: str,
        stored_name: str,
        content_type: str,
        size: int,
        status: str = "",
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,
            "member_id": member_id,
            "doc_type": doc_type if doc_type in DocumentModel.TYPES else "other",
            "original_name": original_name,
            "stored_name": stored_name,   # relative to PRIVATE_MEDIA_DIR
            "content_type": content_type,
            "size": size,
            "status": status or DocumentModel.STATUS_PENDING,
            "reviewed_by": "",
            "reviewed_by_name": "",
            "reviewed_at": None,
            "review_note": "",
            # Who opened this document, and when. Identity documents are
            # sensitive; access is auditable by design.
            "access_log": [],
            # Whether the bytes on disk are AES-GCM sealed. False everywhere
            # today — the flag exists so a migration can tell the two apart
            # file by file instead of assuming a clean cutover. See
            # `app/core/docvault.py`.
            "encrypted": False,
            "created_at": now,
        }

    @staticmethod
    def to_response(doc: dict, include_private: bool = False) -> dict:
        created = doc.get("created_at")
        reviewed = doc.get("reviewed_at")
        out = {
            "id": str(doc["_id"]),
            "user_id": doc.get("user_id", ""),
            "member_id": doc.get("member_id", ""),
            "doc_type": doc.get("doc_type", "other"),
            "doc_type_label": DocumentModel.TYPE_LABELS.get(doc.get("doc_type", "other"), "Document"),
            "original_name": doc.get("original_name", ""),
            "content_type": doc.get("content_type", ""),
            "size": doc.get("size", 0),
            "status": doc.get("status", DocumentModel.STATUS_PENDING),
            "review_note": doc.get("review_note", ""),
            "reviewed_by_name": doc.get("reviewed_by_name", ""),
            "submitted": created.strftime("%b %d, %Y") if isinstance(created, datetime) else "",
            "created_at": created.isoformat() if isinstance(created, datetime) else "",
            "reviewed_at": reviewed.isoformat() if isinstance(reviewed, datetime) else "",
        }
        if include_private:
            # The entries, not just a tally.
            #
            # `read_document` has been faithfully appending to `access_log`
            # since it was written, and nothing has ever read it back — no
            # endpoint passes `include_private`, so the only way to see who
            # opened a woman's Aadhaar card is to query Mongo by hand. A count
            # would not have fixed that: "viewed 4 times" cannot answer "by
            # whom", which is the only question worth asking of this record.
            #
            # Still opt-in, because the log names staff members and does not
            # belong in the ordinary document payload.
            out["access_count"] = len(doc.get("access_log", []))
            out["access_log"] = [
                {
                    "by": entry.get("by", ""),
                    "name": entry.get("name", ""),
                    "at": entry["at"].isoformat() if isinstance(entry.get("at"), datetime) else "",
                }
                for entry in doc.get("access_log", [])
            ]
            out["encrypted"] = bool(doc.get("encrypted", False))
        return out
