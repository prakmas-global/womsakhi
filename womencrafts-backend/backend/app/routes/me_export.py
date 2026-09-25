"""
Everything we hold about her, in one file she can keep.

Under the DPDP Act 2023 a Data Principal has the right to know what a Data
Fiduciary holds about her and to have it in a usable form. There was no way to
do that here: `/me/export` was a 404, and the only exports in the product were
staff-side reports about members rather than a member's own copy of herself.

Three decisions worth stating, because each could reasonably have gone the
other way:

**It is JSON, not a PDF.** "Usable form" means she can open it, and also that
she can take it somewhere else. A PDF is readable and useless to import; JSON
is both, and the screen that offers it says in her own words what is inside.

**It reads her rows, not the whole record.** Every query below is scoped to her
`user_id`. Nothing walks a collection unscoped, so a bug here leaks nothing —
the worst it can do is return less of her own data than it should.

**Identity documents are named but not included.** Her verification photographs
are the single most sensitive thing in this database, and a download link with
her passport in it, sitting in a phone's Downloads folder, is a worse outcome
than not having them in the file. The export says what was submitted and when;
the images themselves stay behind the audited staff route.
"""

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends

from app.core.rbac import require_active_member
from app.db.mongodb import get_database

router = APIRouter(prefix="/me", tags=["Member"])

#: Friendlier names for the collections she is most likely to look for. Only a
#: relabelling — a collection missing from here is still exported, under its
#: own name. That direction matters: a list that decides what she GETS drifts
#: the moment somebody adds a feature, and this export is a legal right.
LABELS = {
    "enrollments": "courses_joined",
    "certificates": "certificates",
    "bookings": "sessions_booked",
    "applications": "job_applications",
    "circle_members": "circles_joined",
    "circle_contributions": "circle_payments",
    "circle_posts": "circle_posts",
    "post_replies": "circle_replies",
    "wallet_transactions": "money",
    "payout_accounts": "where_money_goes",
    "shop_listings": "things_you_sell",
    "goals": "goals",
    "reminder_definitions": "reminders",
    "member_notifications": "messages_we_sent_you",
    "member_messages": "messages_you_sent_us",
    "cycle_profiles": "cycle_settings",
    "cycle_days": "cycle_diary",
    "trusted_contacts": "trusted_contacts",
    "safety_alerts": "safety_alerts",
    "safety_reports": "safety_reports",
    "support_requests": "support_requests",
    "event_registrations": "events",
    "mentorship_requests": "mentor_requests",
    "sakhi_conversations": "sakhi_chats",
    "sakhi_messages": "sakhi_messages",
    "sakhi_memory": "what_sakhi_remembers",
    "stories": "your_stories",
    "school_fees": "school_fees",
    "benefit_claims": "scheme_claims",
    "care_tasks": "care_circle_tasks",
    "health_habits": "health_habits",
    "skill_swaps": "skill_swaps",
    "feedback": "feedback_you_gave",
}

#: Collections NOT exported, and why. Everything else she has a row in is.
#:
#:   secrets        a live token in a downloaded file is a way into her account
#:   plumbing       delivery attempts, queued intents, layout state — ours, not
#:                  hers, and meaningless outside this system
#:   metering       what her usage cost us
#:
#: Her identity documents are handled separately below: named, never attached.
SKIP = {
    "email_tokens", "device_subscriptions", "sessions",
    "delivery_attempts", "notification_intents", "reminder_occurrences",
    "user_layouts", "preference_versions", "policy_decisions",
    "ai_usage", "audit_events", "activity_log",
    "verification_documents",
}

#: Field names never written into an export, whatever collection they are in.
#: A live token in a file sitting in her Downloads folder is a way into her
#: account; a document URL is a way to her passport.
NEVER = {
    "password", "password_hash", "hashed_password", "passwordHash",
    "token", "access_token", "refresh_token", "otp", "secret",
    "document_url", "document_path", "id_image", "file_url", "image_url",
}

def _clean(doc: dict) -> dict:
    """A row as she would read it: no internal ids, no secrets."""
    out = {}
    for k, v in doc.items():
        if k in NEVER or k.endswith("_hash"):
            continue
        if k == "_id":
            continue
        if isinstance(v, ObjectId):
            v = str(v)
        elif isinstance(v, datetime):
            v = v.isoformat()
        elif isinstance(v, list):
            v = [str(x) if isinstance(x, ObjectId) else x for x in v]
        out[k] = v
    return out


@router.get("/export", summary="Download everything we hold about you")
async def export_me(me: dict = Depends(require_active_member)):
    db = get_database()
    uid = str(me["_id"])

    data: dict = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "about": (
            "Everything WomSakhi holds about you. Your identity documents are "
            "listed but not included — they are the most sensitive thing we "
            "hold, and a copy of them in your downloads folder is a risk to "
            "you, not a right you are missing."
        ),
        "you": _clean(me),
    }

    # Every collection she has a row in, not a list somebody remembered to
    # update. Each query is scoped to her `user_id`, so this can only ever
    # return less of her own data — never anyone else's.
    for collection in sorted(await db.list_collection_names()):
        if collection in SKIP:
            continue
        try:
            rows = await db[collection].find({"user_id": uid}).to_list(5000)
        except Exception:
            continue
        if rows:
            data[LABELS.get(collection, collection)] = [_clean(r) for r in rows]

    # Named, never attached. See the note at the top of this file.
    docs = await db["verification_documents"].find(
        {"user_id": uid}, {"kind": 1, "created_at": 1, "status": 1}
    ).to_list(50)
    if docs:
        data["identity_documents_submitted"] = [_clean(d) for d in docs]

    return data
