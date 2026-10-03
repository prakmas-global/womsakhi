"""No admin follow-up email once the applicant is approved (owner-reported bug)."""
from datetime import datetime, timedelta, timezone

from app.engines import verification_followups as vf
from app.models.verification import VerificationStatus


async def test_no_followup_after_approval(local_mongo, monkeypatch):
    db = local_mongo["womsakhi_authtest"]
    monkeypatch.setattr(vf, "_users", lambda: db["users"])
    sent = []

    async def fake_send(spec, to):
        sent.append(to)
        return True

    monkeypatch.setattr(vf, "send", fake_send)
    now = datetime.now(timezone.utc)
    staff = await db.users.insert_one({"email": "zz-fu-sa@example.com", "role": "Super Admin",
                                       "is_active": True, "seed_marker": "zz-followup"})
    member = await db.users.insert_one({
        "email": "zz-fu-m@example.com", "role": "Member", "full_name": "Zz Fu",
        "verification_status": VerificationStatus.IN_REVIEW,
        "verification_review_requested_at": now - timedelta(days=2),
        "verification_next_reminder_at": now - timedelta(minutes=1),
        "seed_marker": "zz-followup",
    })
    try:
        claimed = await db.users.find_one({"_id": member.inserted_id})
        # Approved between the claim and the send.
        await db.users.update_one({"_id": member.inserted_id},
                                  {"$set": {"verification_status": VerificationStatus.ACTIVE}})
        assert await vf.send_review_alert(claimed, 2) == 0
        assert sent == []
        # And an approved member is never claimed again.
        result = await vf.run_due(limit=5)
        assert "zz-fu-sa@example.com" not in sent, result
    finally:
        await db.users.delete_many({"_id": {"$in": [member.inserted_id, staff.inserted_id]},
                                    "seed_marker": "zz-followup"})
