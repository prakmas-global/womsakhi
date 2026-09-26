"""Numbered email follow-ups for member applications awaiting review."""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from pymongo import ReturnDocument

from app.core.email import send, verification_review_alert_email
from app.db.mongodb import get_database
from app.models.user import UserModel
from app.models.verification import VerificationStatus


def _users():
    return get_database()[UserModel.collection_name]


async def _recipients(applicant: dict) -> list[dict]:
    """Assigned reviewer plus super admins, deduplicated by account id."""
    clauses = [{"role": "Super Admin"}]
    assigned = applicant.get("verification_assignee_id")
    if assigned:
        from bson import ObjectId
        try:
            clauses.append({"_id": ObjectId(assigned)})
        except Exception:  # malformed legacy assignment; super admins still receive it
            pass
    rows = await _users().find(
        {"$or": clauses, "role": {"$ne": "Member"}, "is_active": {"$ne": False}},
        {"email": 1, "full_name": 1},
    ).limit(20).to_list(length=20)
    return list({str(row["_id"]): row for row in rows if row.get("email")}.values())


async def send_review_alert(applicant: dict, reminder_number: int) -> int:
    recipients = await _recipients(applicant)
    results = await asyncio.gather(*[
        send(
            verification_review_alert_email(
                admin.get("full_name", ""),
                applicant.get("full_name", ""),
                applicant.get("email", ""),
                applicant.get("verification_status", ""),
                str(applicant["_id"]),
                reminder_number,
            ),
            admin["email"],
        )
        for admin in recipients
    ], return_exceptions=True)
    return sum(result is True for result in results)


def _next_due(now: datetime, number: int) -> datetime:
    # First three follow-ups are daily. Thereafter use a three-day cadence so
    # a long queue remains visible without exhausting transactional mail.
    return now + timedelta(days=1 if number < 3 else 3)


async def run_due(limit: int = 5) -> dict:
    """Claim and send a bounded batch; called by the minute engine tick."""
    now = datetime.now(timezone.utc)
    sent = 0
    claimed = 0
    for _ in range(limit):
        applicant = await _users().find_one_and_update(
            {
                "role": "Member",
                "verification_status": VerificationStatus.IN_REVIEW,
                "verification_review_requested_at": {"$exists": True},
                "verification_next_reminder_at": {"$lte": now},
                "$or": [
                    {"verification_reminder_claimed_at": {"$exists": False}},
                    {"verification_reminder_claimed_at": {"$lte": now - timedelta(minutes=5)}},
                ],
            },
            {
                "$inc": {"verification_reminder_count": 1},
                "$set": {"verification_reminder_claimed_at": now},
            },
            sort=[("verification_next_reminder_at", 1)],
            return_document=ReturnDocument.AFTER,
        )
        if not applicant:
            break
        claimed += 1
        number = int(applicant.get("verification_reminder_count") or 1)
        # Move the deadline before SMTP. A provider outage cannot make the
        # next minute send the same numbered reminder again.
        await _users().update_one(
            {"_id": applicant["_id"]},
            {"$set": {"verification_next_reminder_at": _next_due(now, number)}},
        )
        sent += await send_review_alert(applicant, number)
    return {"claimed": claimed, "emails_sent": sent}
