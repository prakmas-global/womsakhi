"""
Verified skills — what a passed skill test is worth outside the test page.

A member who passes a test in "Prove your skills" earns:

  * a CERTIFICATE (the same `certificates` collection courses use, with
    `program_id = "skill:<test id>"`), so it sits in Certificates, prints, and
    checks out at /verify/<code> for an employer with no account; and
  * a VERIFIED SKILL badge, shown wherever someone decides whether to trust
    her: her profile, her public shop, her mentor card, and on the
    applications staff review for paid work.

Only her best result counts, and a skill only appears once she has passed.
"""

from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId

from app.db.mongodb import get_database
from app.models.certificate import CertificateModel
from app.models.skills import AssessmentModel, AttemptModel

SKILL_PREFIX = "skill:"


def _certificates():
    return get_database()[CertificateModel.collection_name]


async def issue_certificate(me: dict, test: dict, score: int) -> str:
    """Her certificate for a passed test — once; a better score updates the grade."""
    uid = str(me["_id"])
    program_id = f"{SKILL_PREFIX}{test['_id']}"
    existing = await _certificates().find_one({"user_id": uid, "program_id": program_id, "revoked": {"$ne": True}})
    if existing:
        best = int(str(existing.get("grade", "0")).rstrip("%") or 0)
        if score > best:
            await _certificates().update_one({"_id": existing["_id"]}, {"$set": {"grade": f"{score}%"}})
        return existing.get("code", "")
    doc = CertificateModel.create_document(
        user_id=uid,
        member_id=me.get("member_id", ""),
        holder_name=me.get("full_name", ""),
        program_id=program_id,
        program_name=f"Verified skill: {test.get('skill', '')} — {test.get('title', '')}".strip(" —"),
        hours=f"{int(test.get('minutes') or 0)}-minute skill test" if test.get("minutes") else "Skill test",
        grade=f"{score}%",
    )
    doc["kind"] = "skill"
    await _certificates().insert_one(doc)
    return doc["code"]


async def verified_skills(user_ids: list[str]) -> dict[str, list[dict]]:
    """For each member: the skills she has proved — skill, test title, best score, certificate code."""
    ids = [u for u in {*user_ids} if u]
    if not ids:
        return {}
    db = get_database()
    rows = await db[AttemptModel.collection_name].aggregate([
        {"$match": {"user_id": {"$in": ids}, "passed": True}},
        {"$group": {"_id": {"u": "$user_id", "a": "$assessment_id"}, "score": {"$max": "$score"},
                    "first": {"$min": "$created_at"}}},
    ]).to_list(None)
    if not rows:
        return {}
    test_ids = list({r["_id"]["a"] for r in rows})
    tests = {
        str(t["_id"]): t for t in await db[AssessmentModel.collection_name].find(
            {"_id": {"$in": [ObjectId(t) for t in test_ids if ObjectId.is_valid(t)]}}, {"skill": 1, "title": 1}
        ).to_list(None)
    }
    codes = {
        (c["user_id"], c["program_id"][len(SKILL_PREFIX):]): c.get("code", "")
        for c in await _certificates().find(
            {"user_id": {"$in": ids}, "program_id": {"$in": [f"{SKILL_PREFIX}{t}" for t in test_ids]}, "revoked": {"$ne": True}},
            {"user_id": 1, "program_id": 1, "code": 1},
        ).to_list(None)
    }
    out: dict[str, list[dict]] = {}
    for r in sorted(rows, key=lambda r: r.get("first") or datetime.now(timezone.utc)):
        uid, aid = r["_id"]["u"], r["_id"]["a"]
        t = tests.get(aid)
        if not t:
            continue
        out.setdefault(uid, []).append({
            "skill": t.get("skill", ""), "title": t.get("title", ""),
            "score": int(r.get("score") or 0), "code": codes.get((uid, aid), ""),
        })
    return out
