"""
Work done through WomSakhi — the end of an application's ladder.

An application climbed applied → shortlisted → interview → offered and
stopped there, so nothing anywhere recorded that the work was actually done.
That record is the most valuable thing a woman can show the next person
hiring: not what she says she can do, but what she did, for whom, and what
they said about it.

**Who says it was done.** Whoever posted the work confirms it — the member
who posted the job, or WomSakhi staff for a job the team listed. Their word
is what makes it "confirmed by the employer", with an optional star rating
and a few words of praise tapped from a list. She can also mark it done
herself the day she finishes; it then shows as hers until the poster
confirms, and the poster is asked to.

Only an application that reached **offered** can be marked done: work nobody
offered her was not done through WomSakhi.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId

from app.db.mongodb import get_database
from app.models.growth import ApplicationModel, OpportunityModel

COMPLETED = ApplicationModel.STATUS_COMPLETED

#: What a poster can say about the work, in taps.
PRAISE = ("On time", "Great quality", "Easy to work with", "Would hire again", "Went the extra mile")


def _apps():
    return get_database()[ApplicationModel.collection_name]


def can_finish(app: dict) -> bool:
    """Offered, or done by her and not yet confirmed (the poster confirming it)."""
    status = app.get("status")
    if status == ApplicationModel.STATUS_OFFERED:
        return True
    return status == COMPLETED and not (app.get("completion") or {}).get("confirmed")


async def mark_done(app: dict, *, by: str, by_name: str, rating: Optional[int] = None,
                    praise: Optional[list[str]] = None, note: str = "") -> dict:
    """
    Close the application as work done. `by` is "employer" (the poster or
    staff — confirmed) or "worker" (her — until the poster confirms).
    """
    now = datetime.now(timezone.utc)
    before = app.get("completion") or {}
    employer = by == "employer"
    completion = {
        "confirmed": employer or bool(before.get("confirmed")),
        "marked_by": before.get("marked_by") or by,
        "rating": rating if employer and rating else before.get("rating"),
        "praise": [p for p in (praise or []) if p in PRAISE][:5] if employer else before.get("praise", []),
        "note": note.strip()[:300] if employer else before.get("note", ""),
        "done_at": before.get("done_at") or now,
        "confirmed_at": now if employer else before.get("confirmed_at"),
    }
    return await _apps().find_one_and_update(
        {"_id": app["_id"]},
        {"$set": {"status": COMPLETED, "completion": completion, "updated_at": now},
         "$push": {"history": {"status": COMPLETED, "at": now, "by": by_name,
                               "note": "Confirmed the work was done" if employer else "Said the work is done"}}},
        return_document=True,
    )


def _when(v) -> str:
    return v.strftime("%b %Y") if isinstance(v, datetime) else ""


async def history_for(user_id: str) -> list[dict]:
    """Her finished work, newest first, with what the poster said about it."""
    apps = await _apps().find({"user_id": user_id, "status": COMPLETED}).sort("updated_at", -1).to_list(200)
    ids = [ObjectId(a["opportunity_id"]) for a in apps if ObjectId.is_valid(a.get("opportunity_id", ""))]
    jobs = {str(j["_id"]): j for j in await get_database()[OpportunityModel.collection_name].find(
        {"_id": {"$in": ids}}, {"title": 1, "org": 1, "kind": 1, "category": 1, "pay": 1, "location": 1, "mode": 1,
                                "owner_kind": 1}).to_list(len(ids) or 1)}
    out = []
    for a in apps:
        j = jobs.get(a.get("opportunity_id", ""), {})
        c = a.get("completion") or {}
        out.append({
            "id": str(a["_id"]),
            "title": j.get("title") or a.get("opportunity_title", ""),
            "org": j.get("org") or a.get("org", ""),
            "kind": j.get("kind", ""),
            "category": j.get("category", ""),
            "pay": j.get("pay", ""),
            "place": j.get("location", "") or j.get("mode", ""),
            #: "staff" — a job the WomSakhi team listed; "member" — another member's post.
            "posted_by": j.get("owner_kind") or "staff",
            "skills": [s.get("name", "") for s in (a.get("skills") or []) if s.get("name")],
            "done": _when(c.get("done_at")),
            "confirmed": bool(c.get("confirmed")),
            "rating": c.get("rating"),
            "praise": c.get("praise") or [],
            "note": c.get("note", ""),
        })
    return out


async def counts_for(user_ids: list[str]) -> dict[str, dict]:
    """For cards: how many jobs each woman finished, and how many the poster confirmed."""
    if not user_ids:
        return {}
    rows = await _apps().aggregate([
        {"$match": {"user_id": {"$in": user_ids}, "status": COMPLETED}},
        {"$group": {"_id": "$user_id", "done": {"$sum": 1},
                    "confirmed": {"$sum": {"$cond": ["$completion.confirmed", 1, 0]}}}},
    ]).to_list(None)
    return {r["_id"]: {"done": r["done"], "confirmed": r["confirmed"]} for r in rows}
