"""
"Did they pay her?" — answered only by women who worked for them.

Nothing here is seeded and nothing is scored. Every figure is counted from
reports at read time, and an employer below the reporting threshold returns
`enough: false` so the screen can say so rather than imply a clean record.
"""

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.rbac import require_active_member
from app.db.mongodb import get_database
from app.models.employers import (
    OUTCOMES, EmployerModel, EmployerReportModel, summarise,
)

router = APIRouter(prefix="/work/employers", tags=["Member · Work"])


class EmployerIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    kind: str = Field(default="", max_length=60)


class ReportIn(BaseModel):
    outcome: str
    what: str = Field(default="", max_length=140)
    amount_minor: int = Field(default=0, ge=0)
    days_late: int = Field(default=0, ge=0)


def _employers():
    return get_database()[EmployerModel.collection_name]


def _reports():
    return get_database()[EmployerReportModel.collection_name]


def _oid(v: str) -> ObjectId:
    try:
        return ObjectId(v)
    except (InvalidId, TypeError):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such employer")


@router.get("", summary="Employers other women have reported on")
async def list_employers(q: str = "", me: dict = Depends(require_active_member)):
    query: dict = {}
    if q.strip():
        query["name_key"] = {"$regex": q.strip().lower()[:60]}
    rows = await _employers().find(query).sort("name_key", 1).to_list(200)
    if not rows:
        return {"employers": [], "reported_total": 0}

    ids = [str(r["_id"]) for r in rows]
    reports = await _reports().find({"employer_id": {"$in": ids}}).to_list(5000)
    by_employer: dict[str, list] = {i: [] for i in ids}
    for r in reports:
        by_employer.setdefault(r["employer_id"], []).append(r)

    out = [summarise(r, by_employer.get(str(r["_id"]), [])) for r in rows]
    # The ones she can actually learn something from first; then the rest, so
    # an unreported employer is still findable rather than hidden.
    out.sort(key=lambda e: (not e["enough"], e["name"].lower()))
    return {"employers": out, "reported_total": len(reports)}


@router.post("", status_code=status.HTTP_201_CREATED, summary="Add an employer nobody has listed")
async def add_employer(body: EmployerIn, me: dict = Depends(require_active_member)):
    key = body.name.strip().lower()[:120]
    existing = await _employers().find_one({"name_key": key})
    if existing:
        # Not an error. Two women naming the same business should land on one
        # record, and telling her "already exists" would only make her invent
        # a spelling to get past it.
        return summarise(existing, await _reports().find({"employer_id": str(existing["_id"])}).to_list(500))

    doc = EmployerModel.create_document(name=body.name, kind=body.kind, added_by=str(me["_id"]))
    res = await _employers().insert_one(doc)
    doc["_id"] = res.inserted_id
    return summarise(doc, [])


@router.post("/{employer_id}/report", status_code=status.HTTP_201_CREATED,
             summary="Say whether they paid you")
async def report(employer_id: str, body: ReportIn, me: dict = Depends(require_active_member)):
    if body.outcome not in OUTCOMES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"outcome must be one of {', '.join(OUTCOMES)}")

    employer = await _employers().find_one({"_id": _oid(employer_id)})
    if not employer:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such employer")

    uid = str(me["_id"])
    # One woman, one report per employer. Without this a single person could
    # move a business's record on her own, and the number would mean nothing.
    await _reports().update_one(
        {"employer_id": employer_id, "user_id": uid},
        {"$set": EmployerReportModel.create_document(
            employer_id=employer_id, user_id=uid, outcome=body.outcome,
            what=body.what, amount_minor=body.amount_minor, days_late=body.days_late)},
        upsert=True,
    )
    rows = await _reports().find({"employer_id": employer_id}).to_list(500)
    return summarise(employer, rows)


@router.get("/mine", summary="What I have reported")
async def my_reports(me: dict = Depends(require_active_member)):
    rows = await _reports().find({"user_id": str(me["_id"])}).to_list(200)
    if not rows:
        return {"reports": []}
    ids = [_oid(r["employer_id"]) for r in rows]
    names = {str(e["_id"]): e.get("name", "")
             for e in await _employers().find({"_id": {"$in": ids}}).to_list(200)}
    return {"reports": [{
        "employer_id": r["employer_id"],
        "employer": names.get(r["employer_id"], ""),
        "outcome": r.get("outcome", ""),
        "what": r.get("what", ""),
        "amount_minor": r.get("amount_minor", 0),
        "days_late": r.get("days_late", 0),
    } for r in rows]}
