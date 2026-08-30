"""
Certificates.

For a lot of members this is the single most valuable thing they take away — a
piece of paper with a number on it that they can show an employer. So it gets a
real record with a real, verifiable id, not a PDF generated on the fly and
forgotten.

`code` is public by design: anyone (an employer, an NGO) can check it without an
account, and it reveals only the programme and the holder's name.
"""

import hashlib
from datetime import datetime, timezone


class CertificateModel:
    collection_name = "certificates"

    @staticmethod
    def make_code(user_id: str, program_id: str, issued: datetime) -> str:
        """WS-2026-4F9C2A — stable for a given member+programme, not guessable in bulk."""
        digest = hashlib.sha256(f"{user_id}:{program_id}".encode()).hexdigest()[:6].upper()
        return f"WS-{issued.year}-{digest}"

    @staticmethod
    def create_document(
        user_id: str,
        member_id: str,
        holder_name: str,
        program_id: str,
        program_name: str,
        hours: str = "",
        grade: str = "",
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,
            "member_id": member_id,
            "holder_name": holder_name,
            "program_id": program_id,
            "program_name": program_name,
            "code": CertificateModel.make_code(user_id, program_id, now),
            "hours": hours,
            "grade": grade,
            "revoked": False,
            "issued_at": now,
            "created_at": now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        issued = doc.get("issued_at") or doc.get("created_at")
        return {
            "id": str(doc["_id"]),
            "code": doc.get("code", ""),
            "holder_name": doc.get("holder_name", ""),
            "program_id": doc.get("program_id", ""),
            "program_name": doc.get("program_name", ""),
            "hours": doc.get("hours", ""),
            "grade": doc.get("grade", ""),
            "revoked": bool(doc.get("revoked", False)),
            "issued_on": issued.strftime("%d %B %Y") if isinstance(issued, datetime) else "",
            "issued_at": issued.isoformat() if isinstance(issued, datetime) else "",
        }
