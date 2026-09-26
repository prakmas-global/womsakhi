"""
Staff side of learning: assessments, digital-literacy steps and certificates.

Every endpoint is behind the "learning" module guard (main.py) and names its
action (learning.view / .create / .edit / .delete / .approve / .export);
every write is audited.

── What the member side already does, and what this must not break ──────────
`routes/skills.py` grades an attempt on the server against the assessment's
`questions[]` — each `{"ask", "options": [...], "answer": <index>}`. The
question editor below keeps exactly that shape, because a question that
grades differently from the one the woman answered is not a correction, it
is a lie about her score. Editing a question that already has attempts is
allowed (typos happen) but the response says how many attempts exist so the
screen can warn.

Member screens cache the published list for a minute (`assess:list`,
`digital:steps`). Every write here forgets those keys, so a test an admin
just unpublished is gone from the phone on the next request, not in a minute.

── Certificates: the code is the certificate ─────────────────────────────────
`CertificateModel.make_code` is deterministic for member + programme + year.
That is the point — a woman who claims twice gets the same number — but it
means a second document for the same pair would carry the same code and a
verifier would find two answers. So a manual issue refuses ANY existing row
for that pair, revoked or not: a revoked one is reinstated, not re-created,
and a name correction ("reissue") rewrites the holder on the same row and
keeps the number the employer already holds.

Revoking sets the flag the member side (`me.py`) already filters on; nothing
else in the codebase ever set it.

── What this file must never expose ──────────────────────────────────────────
A member's name, avatar and member number — what her certificate says and
what a moderator sees beside her post. Not her email, not her phone, not her
vault. The member picker searches by email but does not return it.
"""

from __future__ import annotations

import asyncio
import csv
import io
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, Field, field_validator

from app.core import cache, mongosafe
from app.core.audit import record
from app.core.deps import get_current_user
from app.core.media import media_url
from app.core.permissions import require_permission
from app.core.serializers import aware, page_meta, to_object_id
from app.db.mongodb import get_database
from app.models.certificate import CertificateModel
from app.models.program import ProgramModel
from app.models.skills import AssessmentModel, AttemptModel, DigitalStepModel
from app.models.user import UserModel

router = APIRouter(prefix="/admin/learning", tags=["Learning & Certificates (staff)"])

ASSESSMENT_STATUSES = ("draft", "published", "archived")


# ── collections ──────────────────────────────────────────────────────────────

def _assessments():
    return get_database()[AssessmentModel.collection_name]


def _attempts():
    return get_database()[AttemptModel.collection_name]


def _steps():
    return get_database()[DigitalStepModel.collection_name]


def _progress():
    return get_database()[DigitalStepModel.PROGRESS_COLLECTION]


def _certificates():
    return get_database()[CertificateModel.collection_name]


def _users():
    return get_database()[UserModel.collection_name]


def _programs():
    return get_database()[ProgramModel.collection_name]


# ── shared helpers ───────────────────────────────────────────────────────────

def _iso(when) -> str:
    when = aware(when) if isinstance(when, datetime) else None
    return when.isoformat() if when else ""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _required(value: str, message: str) -> str:
    value = (value or "").strip()
    if not value:
        raise ValueError(message)
    return value


def _who(me: dict) -> str:
    return me.get("full_name", "") or me.get("email", "")


async def _member_map(user_ids: list[str]) -> dict[str, dict]:
    """One lookup for a page of rows, instead of one per row. Name, avatar, member number."""
    oids = []
    for uid in set(user_ids):
        try:
            oids.append(ObjectId(uid))
        except Exception:  # noqa: BLE001 - a malformed id just means no match
            continue
    if not oids:
        return {}
    rows = await _users().find(
        {"_id": {"$in": oids}}, {"full_name": 1, "avatar": 1, "member_id": 1}
    ).to_list(len(oids))
    return {str(r["_id"]): r for r in rows}


def _csv_response(rows: list[list], name: str) -> Response:
    buf = io.StringIO()
    csv.writer(buf).writerows(rows)
    stamp = _now().strftime("%Y-%m-%d")
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="womsakhi-{name}-{stamp}.csv"'},
    )


# ═════════════════════════════════════════════════════════════════════════════
# Assessments
# ═════════════════════════════════════════════════════════════════════════════

class QuestionOut(BaseModel):
    n: int
    ask: str
    options: list[str]
    #: The correct index. Staff see it; the member endpoint strips it.
    answer: int


class AssessmentRow(BaseModel):
    id: str
    skill: str
    title: str
    blurb: str
    minutes: int
    pass_mark: int
    status: str
    question_count: int
    #: Attempts that still count — invalidated ones are left out of both.
    attempt_count: int
    pass_count: int
    #: 0–100, or None when nobody has tried yet. Never a fake zero.
    pass_rate: Optional[int] = None
    created_at: str
    updated_at: str
    questions: list[QuestionOut] = []


class AssessmentSummary(BaseModel):
    total: int
    published: int
    draft: int
    archived: int
    attempts: int
    pass_rate: Optional[int] = None


class AssessmentPage(BaseModel):
    items: list[AssessmentRow]
    total: int
    page: int
    page_size: int
    pages: int
    summary: AssessmentSummary


class AssessmentInput(BaseModel):
    skill: str = ""
    title: str
    blurb: str = ""
    minutes: int = Field(20, ge=1, le=240)
    pass_mark: int = Field(60, ge=1, le=100)
    status: str = "draft"

    @field_validator("title")
    @classmethod
    def has_title(cls, v: str) -> str:
        return _required(v, "Give the test a title")

    @field_validator("status")
    @classmethod
    def known_status(cls, v: str) -> str:
        v = (v or "draft").strip().lower()
        if v not in ASSESSMENT_STATUSES:
            raise ValueError("Status must be draft, published or archived")
        return v


class QuestionInput(BaseModel):
    ask: str
    options: list[str]
    answer: int = Field(..., ge=0)

    @field_validator("ask")
    @classmethod
    def has_ask(cls, v: str) -> str:
        return _required(v, "Write the question")

    @field_validator("options")
    @classmethod
    def enough_options(cls, v: list[str]) -> list[str]:
        cleaned = [(o or "").strip() for o in v]
        if len(cleaned) < 2 or any(not o for o in cleaned):
            raise ValueError("Give at least two options, none of them blank")
        if len(cleaned) > 8:
            raise ValueError("Eight options is the most a phone screen can show")
        return cleaned

    def as_doc(self) -> dict:
        if self.answer >= len(self.options):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "The correct answer must be one of the options")
        return {"ask": self.ask, "options": self.options, "answer": int(self.answer)}


class ReorderBody(BaseModel):
    #: Question indices (0-based) in their new order — a permutation.
    order: list[int]


class InvalidateBody(BaseModel):
    reason: str = ""

    @field_validator("reason")
    @classmethod
    def has_reason(cls, v: str) -> str:
        return _required(v, "Say why this attempt should not count")


class AttemptRow(BaseModel):
    id: str
    user_id: str
    name: str
    avatar: str
    member_id: str
    score: int
    passed: bool
    invalidated: bool
    invalidated_reason: str = ""
    invalidated_at: str = ""
    invalidated_by: str = ""
    at: str


class AttemptPage(BaseModel):
    items: list[AttemptRow]
    total: int
    page: int
    page_size: int
    pages: int


async def _attempt_stats(assessment_ids: list[str] | None = None) -> dict[str, dict]:
    """{assessment_id: {"n": tries that count, "passed": how many passed}} in one aggregate."""
    match: dict = {"invalidated": {"$ne": True}}
    if assessment_ids is not None:
        match["assessment_id"] = {"$in": assessment_ids}
    rows = await _attempts().aggregate([
        {"$match": match},
        {"$group": {
            "_id": "$assessment_id",
            "n": {"$sum": 1},
            "passed": {"$sum": {"$cond": [{"$eq": ["$passed", True]}, 1, 0]}},
        }},
    ]).to_list(10000)
    return {str(r["_id"]): {"n": int(r["n"]), "passed": int(r["passed"])} for r in rows}


def _rate(passed: int, n: int) -> Optional[int]:
    return round(passed * 100 / n) if n > 0 else None


def _assessment_row(doc: dict, stats: dict, *, with_questions: bool = False) -> AssessmentRow:
    s = stats.get(str(doc["_id"]), {"n": 0, "passed": 0})
    questions = doc.get("questions") or []
    return AssessmentRow(
        id=str(doc["_id"]),
        skill=doc.get("skill", ""),
        title=doc.get("title", ""),
        blurb=doc.get("blurb", ""),
        minutes=int(doc.get("minutes", 20)),
        pass_mark=int(doc.get("pass_mark", 60)),
        status=doc.get("status", "draft"),
        question_count=len(questions),
        attempt_count=s["n"],
        pass_count=s["passed"],
        pass_rate=_rate(s["passed"], s["n"]),
        created_at=_iso(doc.get("created_at")),
        updated_at=_iso(doc.get("updated_at")),
        questions=[
            QuestionOut(n=i + 1, ask=q.get("ask", ""), options=list(q.get("options") or []),
                        answer=int(q.get("answer", 0)))
            for i, q in enumerate(questions)
        ] if with_questions else [],
    )


async def _load_assessment(assessment_id: str) -> dict:
    doc = await _assessments().find_one({"_id": to_object_id(assessment_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That test doesn't exist")
    return doc


def _forget_assessments() -> None:
    cache.forget("assess:list")


@router.get(
    "/assessments/export",
    summary="Every test with its attempt counts, as CSV",
    dependencies=[Depends(require_permission("learning.export"))],
)
async def export_assessments(request: Request, me: dict = Depends(get_current_user)):
    docs = await _assessments().find({}).sort("title", 1).to_list(1000)
    stats = await _attempt_stats()
    rows = [["Title", "Skill", "Status", "Questions", "Pass mark", "Minutes", "Attempts", "Passed", "Pass rate", "Updated"]]
    for d in docs:
        r = _assessment_row(d, stats)
        rows.append([r.title, r.skill, r.status, r.question_count, r.pass_mark, r.minutes,
                     r.attempt_count, r.pass_count, "" if r.pass_rate is None else r.pass_rate, r.updated_at])
    await record(me, "learning.export", target="assessments",
                 detail=f"Downloaded the assessment list as CSV ({len(rows) - 1} rows)", request=request)
    return _csv_response(rows, "assessments")


@router.get(
    "/assessments",
    response_model=AssessmentPage,
    summary="Every skill test, with how it is being passed",
    dependencies=[Depends(require_permission("learning.view"))],
)
async def list_assessments(
    q: str = Query("", max_length=80),
    status_filter: str = Query("", alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    me: dict = Depends(get_current_user),
):
    match: dict = {}
    if q.strip():
        match.update(mongosafe.any_of(q.strip(), ["title", "skill", "blurb"]))
    if status_filter in ASSESSMENT_STATUSES:
        match["status"] = status_filter

    total, docs, stats, all_docs = await asyncio.gather(
        _assessments().count_documents(match),
        _assessments().find(match).sort([("status", 1), ("skill", 1), ("title", 1)])
        .skip((page - 1) * page_size).limit(page_size).to_list(page_size),
        _attempt_stats(),
        _assessments().find({}, {"status": 1}).to_list(1000),
    )
    by_status = {s: 0 for s in ASSESSMENT_STATUSES}
    for d in all_docs:
        by_status[d.get("status", "draft")] = by_status.get(d.get("status", "draft"), 0) + 1
    tries = sum(s["n"] for s in stats.values())
    passed = sum(s["passed"] for s in stats.values())
    return AssessmentPage(
        items=[_assessment_row(d, stats) for d in docs],
        **page_meta(total, page, page_size),
        summary=AssessmentSummary(
            total=len(all_docs), published=by_status["published"], draft=by_status["draft"],
            archived=by_status["archived"], attempts=tries, pass_rate=_rate(passed, tries),
        ),
    )


@router.post(
    "/assessments",
    response_model=AssessmentRow,
    status_code=status.HTTP_201_CREATED,
    summary="Write a new test",
    dependencies=[Depends(require_permission("learning.create"))],
)
async def create_assessment(body: AssessmentInput, request: Request, me: dict = Depends(get_current_user)):
    doc = AssessmentModel.create_document(
        skill=body.skill or "General", title=body.title, blurb=body.blurb,
        minutes=body.minutes, pass_mark=body.pass_mark,
    )
    # A test with no questions cannot be taken; it starts unpublished whatever
    # the form said, and is published from the questions screen.
    doc["status"] = "draft" if body.status == "published" else body.status
    result = await _assessments().insert_one(doc)
    doc["_id"] = result.inserted_id
    _forget_assessments()
    await record(me, "learning.assessment.create", target=str(doc["_id"]),
                 detail=f"Created the test '{doc['title']}' ({doc['status']})", request=request)
    return _assessment_row(doc, {}, with_questions=True)


@router.get(
    "/assessments/{assessment_id}",
    response_model=AssessmentRow,
    summary="One test, with its questions and answers",
    dependencies=[Depends(require_permission("learning.view"))],
)
async def get_assessment(assessment_id: str, me: dict = Depends(get_current_user)):
    doc = await _load_assessment(assessment_id)
    stats = await _attempt_stats([assessment_id])
    return _assessment_row(doc, stats, with_questions=True)


@router.put(
    "/assessments/{assessment_id}",
    response_model=AssessmentRow,
    summary="Change a test's title, blurb, pass mark or status",
    dependencies=[Depends(require_permission("learning.edit"))],
)
async def update_assessment(
    assessment_id: str, body: AssessmentInput, request: Request, me: dict = Depends(get_current_user)
):
    doc = await _load_assessment(assessment_id)
    if body.status == "published" and not (doc.get("questions") or []):
        raise HTTPException(status.HTTP_409_CONFLICT, "Add at least one question before publishing")
    was = doc.get("status")
    changes = {
        "skill": body.skill.strip() or doc.get("skill", "General"),
        "title": body.title, "blurb": body.blurb.strip(),
        "minutes": body.minutes, "pass_mark": body.pass_mark, "status": body.status,
        "updated_at": _now(),
    }
    await _assessments().update_one({"_id": doc["_id"]}, {"$set": changes})
    doc.update(changes)
    _forget_assessments()
    note = f"Edited the test '{doc['title']}'"
    if was != body.status:
        note += f" — now {body.status}"
    await record(me, "learning.assessment.edit", target=assessment_id, detail=note, request=request)
    stats = await _attempt_stats([assessment_id])
    return _assessment_row(doc, stats, with_questions=True)


@router.delete(
    "/assessments/{assessment_id}",
    summary="Delete a test nobody has taken",
    dependencies=[Depends(require_permission("learning.delete"))],
)
async def delete_assessment(assessment_id: str, request: Request, me: dict = Depends(get_current_user)):
    doc = await _load_assessment(assessment_id)
    tries = await _attempts().count_documents({"assessment_id": assessment_id})
    if tries:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{tries} attempt{'s' if tries != 1 else ''} on record — archive it instead, so their scores keep a test to point at",
        )
    await _assessments().delete_one({"_id": doc["_id"]})
    _forget_assessments()
    await record(me, "learning.assessment.delete", target=assessment_id,
                 detail=f"Deleted the test '{doc.get('title', '')}' (no attempts)", request=request)
    return {"message": "Deleted"}


# ── questions ────────────────────────────────────────────────────────────────

async def _save_questions(doc: dict, questions: list[dict]) -> None:
    await _assessments().update_one(
        {"_id": doc["_id"]}, {"$set": {"questions": questions, "updated_at": _now()}}
    )
    _forget_assessments()


@router.post(
    "/assessments/{assessment_id}/questions",
    response_model=AssessmentRow,
    status_code=status.HTTP_201_CREATED,
    summary="Add a question at the end",
    dependencies=[Depends(require_permission("learning.edit"))],
)
async def add_question(
    assessment_id: str, body: QuestionInput, request: Request, me: dict = Depends(get_current_user)
):
    doc = await _load_assessment(assessment_id)
    questions = list(doc.get("questions") or [])
    questions.append(body.as_doc())
    await _save_questions(doc, questions)
    doc["questions"] = questions
    await record(me, "learning.question.add", target=assessment_id,
                 detail=f"Added question {len(questions)} to '{doc.get('title', '')}'", request=request)
    return _assessment_row(doc, await _attempt_stats([assessment_id]), with_questions=True)


@router.put(
    "/assessments/{assessment_id}/questions/{index}",
    response_model=AssessmentRow,
    summary="Rewrite one question",
    dependencies=[Depends(require_permission("learning.edit"))],
)
async def edit_question(
    assessment_id: str, index: int, body: QuestionInput, request: Request,
    me: dict = Depends(get_current_user),
):
    doc = await _load_assessment(assessment_id)
    questions = list(doc.get("questions") or [])
    if index < 0 or index >= len(questions):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That question doesn't exist")
    questions[index] = body.as_doc()
    await _save_questions(doc, questions)
    doc["questions"] = questions
    await record(me, "learning.question.edit", target=assessment_id,
                 detail=f"Rewrote question {index + 1} of '{doc.get('title', '')}'", request=request)
    return _assessment_row(doc, await _attempt_stats([assessment_id]), with_questions=True)


@router.delete(
    "/assessments/{assessment_id}/questions/{index}",
    response_model=AssessmentRow,
    summary="Remove one question",
    dependencies=[Depends(require_permission("learning.edit"))],
)
async def remove_question(
    assessment_id: str, index: int, request: Request, me: dict = Depends(get_current_user)
):
    doc = await _load_assessment(assessment_id)
    questions = list(doc.get("questions") or [])
    if index < 0 or index >= len(questions):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That question doesn't exist")
    if len(questions) == 1 and doc.get("status") == "published":
        raise HTTPException(status.HTTP_409_CONFLICT, "A published test needs at least one question — unpublish it first")
    questions.pop(index)
    await _save_questions(doc, questions)
    doc["questions"] = questions
    await record(me, "learning.question.remove", target=assessment_id,
                 detail=f"Removed question {index + 1} from '{doc.get('title', '')}'", request=request)
    return _assessment_row(doc, await _attempt_stats([assessment_id]), with_questions=True)


@router.post(
    "/assessments/{assessment_id}/questions/reorder",
    response_model=AssessmentRow,
    summary="Put the questions in a new order",
    dependencies=[Depends(require_permission("learning.edit"))],
)
async def reorder_questions(
    assessment_id: str, body: ReorderBody, request: Request, me: dict = Depends(get_current_user)
):
    doc = await _load_assessment(assessment_id)
    questions = list(doc.get("questions") or [])
    if sorted(body.order) != list(range(len(questions))):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "The order must list every question exactly once")
    questions = [questions[i] for i in body.order]
    await _save_questions(doc, questions)
    doc["questions"] = questions
    await record(me, "learning.question.reorder", target=assessment_id,
                 detail=f"Reordered the questions of '{doc.get('title', '')}'", request=request)
    return _assessment_row(doc, await _attempt_stats([assessment_id]), with_questions=True)


# ── attempts ─────────────────────────────────────────────────────────────────

def _attempt_row(a: dict, person: dict) -> AttemptRow:
    return AttemptRow(
        id=str(a["_id"]),
        user_id=a.get("user_id", ""),
        name=person.get("full_name", "") or "A member",
        avatar=media_url(person.get("avatar", "")),
        member_id=person.get("member_id", "") or a.get("member_id", "") or "",
        score=int(a.get("score", 0)),
        passed=bool(a.get("passed")),
        invalidated=bool(a.get("invalidated")),
        invalidated_reason=a.get("invalidated_reason", "") or "",
        invalidated_at=_iso(a.get("invalidated_at")),
        invalidated_by=a.get("invalidated_by", "") or "",
        at=_iso(a.get("created_at")),
    )


@router.get(
    "/assessments/{assessment_id}/attempts/export",
    summary="Every attempt at this test, as CSV",
    dependencies=[Depends(require_permission("learning.export"))],
)
async def export_attempts(assessment_id: str, request: Request, me: dict = Depends(get_current_user)):
    doc = await _load_assessment(assessment_id)
    attempts = await _attempts().find({"assessment_id": assessment_id}).sort("created_at", -1).to_list(5000)
    people = await _member_map([a.get("user_id", "") for a in attempts])
    rows = [["Name", "Member code", "Score", "Passed", "Counts", "Reason", "Taken at"]]
    for a in attempts:
        r = _attempt_row(a, people.get(a.get("user_id", ""), {}))
        rows.append([r.name, r.member_id, r.score, "yes" if r.passed else "no",
                     "no" if r.invalidated else "yes", r.invalidated_reason, r.at])
    slug = "".join(c if c.isalnum() else "-" for c in doc.get("title", "test").lower()).strip("-")[:40] or "test"
    await record(me, "learning.export", target=assessment_id,
                 detail=f"Downloaded the attempts at '{doc.get('title', '')}' as CSV ({len(rows) - 1} rows)",
                 request=request)
    return _csv_response(rows, f"{slug}-attempts")


@router.get(
    "/assessments/{assessment_id}/attempts",
    response_model=AttemptPage,
    summary="Who has taken this test, and how they did",
    dependencies=[Depends(require_permission("learning.view"))],
)
async def list_attempts(
    assessment_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    me: dict = Depends(get_current_user),
):
    await _load_assessment(assessment_id)
    match = {"assessment_id": assessment_id}
    total, attempts = await asyncio.gather(
        _attempts().count_documents(match),
        _attempts().find(match).sort("created_at", -1)
        .skip((page - 1) * page_size).limit(page_size).to_list(page_size),
    )
    people = await _member_map([a.get("user_id", "") for a in attempts])
    return AttemptPage(
        items=[_attempt_row(a, people.get(a.get("user_id", ""), {})) for a in attempts],
        **page_meta(total, page, page_size),
    )


@router.post(
    "/assessments/{assessment_id}/attempts/{attempt_id}/invalidate",
    response_model=AttemptRow,
    summary="Strike an attempt from her record",
    dependencies=[Depends(require_permission("learning.edit"))],
)
async def invalidate_attempt(
    assessment_id: str, attempt_id: str, body: InvalidateBody, request: Request,
    me: dict = Depends(get_current_user),
):
    doc = await _load_assessment(assessment_id)
    attempt = await _attempts().find_one({"_id": to_object_id(attempt_id), "assessment_id": assessment_id})
    if not attempt:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That attempt doesn't exist")
    if attempt.get("invalidated"):
        raise HTTPException(status.HTTP_409_CONFLICT, "That attempt is already struck out")
    changes = {
        "invalidated": True,
        "invalidated_reason": body.reason,
        "invalidated_at": _now(),
        "invalidated_by": _who(me),
    }
    await _attempts().update_one({"_id": attempt["_id"]}, {"$set": changes})
    attempt.update(changes)
    people = await _member_map([attempt.get("user_id", "")])
    row = _attempt_row(attempt, people.get(attempt.get("user_id", ""), {}))
    await record(me, "learning.attempt.invalidate", target=attempt_id,
                 detail=f"Struck out {row.name}'s {row.score}% attempt at '{doc.get('title', '')}': {body.reason}",
                 request=request)
    return row


# ═════════════════════════════════════════════════════════════════════════════
# Digital steps
# ═════════════════════════════════════════════════════════════════════════════

class StepRow(BaseModel):
    id: str
    n: int
    label: str
    note: str
    minutes: int
    #: Members who have marked this step done.
    done_count: int
    created_at: str


class StepsOut(BaseModel):
    items: list[StepRow]
    #: Distinct members with at least one step done — the top of the funnel.
    members_started: int
    completions: int


class StepInput(BaseModel):
    label: str
    note: str = ""
    minutes: int = Field(10, ge=1, le=240)

    @field_validator("label")
    @classmethod
    def has_label(cls, v: str) -> str:
        return _required(v, "Give the step a name")


class StepOrderBody(BaseModel):
    #: Step ids in their new order — every step, exactly once.
    order: list[str]


def _forget_steps() -> None:
    cache.forget("digital:steps")


async def _done_counts() -> dict[str, int]:
    rows = await _progress().aggregate([
        {"$group": {"_id": "$step_id", "n": {"$sum": 1}}},
    ]).to_list(1000)
    return {str(r["_id"]): int(r["n"]) for r in rows}


def _step_row(doc: dict, counts: dict[str, int]) -> StepRow:
    return StepRow(
        id=str(doc["_id"]), n=int(doc.get("n", 0)), label=doc.get("label", ""),
        note=doc.get("note", ""), minutes=int(doc.get("minutes", 10)),
        done_count=counts.get(str(doc["_id"]), 0), created_at=_iso(doc.get("created_at")),
    )


async def _steps_out() -> StepsOut:
    docs, counts, started = await asyncio.gather(
        _steps().find({}).sort("n", 1).to_list(200),
        _done_counts(),
        _progress().distinct("user_id"),
    )
    return StepsOut(
        items=[_step_row(d, counts) for d in docs],
        members_started=len(started),
        completions=sum(counts.values()),
    )


async def _renumber() -> None:
    """Keep n = 1..k with no gaps after a delete, so the member screen's order is honest."""
    docs = await _steps().find({}, {"n": 1}).sort("n", 1).to_list(200)
    for i, d in enumerate(docs, start=1):
        if int(d.get("n", 0)) != i:
            await _steps().update_one({"_id": d["_id"]}, {"$set": {"n": i}})


@router.get(
    "/digital-steps",
    response_model=StepsOut,
    summary="The phone-confidence steps, in order, with how many finished each",
    dependencies=[Depends(require_permission("learning.view"))],
)
async def list_steps(me: dict = Depends(get_current_user)):
    return await _steps_out()


@router.post(
    "/digital-steps",
    response_model=StepsOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a step at the end",
    dependencies=[Depends(require_permission("learning.create"))],
)
async def create_step(body: StepInput, request: Request, me: dict = Depends(get_current_user)):
    last = await _steps().find_one({}, sort=[("n", -1)])
    n = int((last or {}).get("n", 0)) + 1
    doc = DigitalStepModel.create_document(n=n, label=body.label, note=body.note, minutes=body.minutes)
    result = await _steps().insert_one(doc)
    _forget_steps()
    await record(me, "learning.step.create", target=str(result.inserted_id),
                 detail=f"Added step {n} '{body.label}'", request=request)
    return await _steps_out()


@router.put(
    "/digital-steps/{step_id}",
    response_model=StepsOut,
    summary="Rename or re-describe a step",
    dependencies=[Depends(require_permission("learning.edit"))],
)
async def update_step(step_id: str, body: StepInput, request: Request, me: dict = Depends(get_current_user)):
    doc = await _steps().find_one({"_id": to_object_id(step_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That step doesn't exist")
    await _steps().update_one(
        {"_id": doc["_id"]},
        {"$set": {"label": body.label, "note": body.note.strip(), "minutes": body.minutes}},
    )
    _forget_steps()
    await record(me, "learning.step.edit", target=step_id,
                 detail=f"Edited step {doc.get('n', 0)} '{body.label}'", request=request)
    return await _steps_out()


@router.delete(
    "/digital-steps/{step_id}",
    response_model=StepsOut,
    summary="Remove a step nobody has done yet",
    dependencies=[Depends(require_permission("learning.delete"))],
)
async def delete_step(step_id: str, request: Request, me: dict = Depends(get_current_user)):
    doc = await _steps().find_one({"_id": to_object_id(step_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That step doesn't exist")
    done = await _progress().count_documents({"step_id": step_id})
    if done:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{done} member{'s have' if done != 1 else ' has'} finished this step — it can be renamed but not removed",
        )
    await _steps().delete_one({"_id": doc["_id"]})
    await _renumber()
    _forget_steps()
    await record(me, "learning.step.delete", target=step_id,
                 detail=f"Removed step {doc.get('n', 0)} '{doc.get('label', '')}'", request=request)
    return await _steps_out()


@router.post(
    "/digital-steps/reorder",
    response_model=StepsOut,
    summary="Put the steps in a new order",
    dependencies=[Depends(require_permission("learning.edit"))],
)
async def reorder_steps(body: StepOrderBody, request: Request, me: dict = Depends(get_current_user)):
    docs = await _steps().find({}, {"_id": 1}).to_list(200)
    have = {str(d["_id"]) for d in docs}
    if sorted(body.order) != sorted(have) or len(body.order) != len(have):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "The order must list every step exactly once")
    for i, sid in enumerate(body.order, start=1):
        await _steps().update_one({"_id": ObjectId(sid)}, {"$set": {"n": i}})
    _forget_steps()
    await record(me, "learning.step.reorder", target="digital_steps",
                 detail=f"Reordered the {len(body.order)} phone-confidence steps", request=request)
    return await _steps_out()


# ═════════════════════════════════════════════════════════════════════════════
# Certificates
# ═════════════════════════════════════════════════════════════════════════════

class CertificateRow(BaseModel):
    id: str
    code: str
    holder_name: str
    user_id: str
    member_id: str
    avatar: str = ""
    program_id: str
    program_name: str
    hours: str = ""
    grade: str = ""
    issued_at: str
    revoked: bool
    revoked_reason: str = ""
    revoked_at: str = ""
    revoked_by: str = ""
    reissued_at: str = ""
    #: Who issued it: "member" when she claimed it herself, else the admin's name.
    issued_by: str = ""


class CertificateSummary(BaseModel):
    total: int
    valid: int
    revoked: int
    this_month: int


class CertificatePage(BaseModel):
    items: list[CertificateRow]
    total: int
    page: int
    page_size: int
    pages: int
    summary: CertificateSummary


class VerifyOut(BaseModel):
    found: bool
    code: str
    valid: bool = False
    holder_name: str = ""
    member_id: str = ""
    program_name: str = ""
    issued_at: str = ""
    revoked_reason: str = ""
    revoked_at: str = ""


class RevokeBody(BaseModel):
    reason: str = ""

    @field_validator("reason")
    @classmethod
    def has_reason(cls, v: str) -> str:
        return _required(v, "Say why the certificate is being withdrawn")


class ReissueBody(BaseModel):
    holder_name: str

    @field_validator("holder_name")
    @classmethod
    def has_name(cls, v: str) -> str:
        return _required(v, "Give the corrected name")


class IssueBody(BaseModel):
    user_id: str
    program_id: str
    holder_name: str = ""
    hours: str = ""
    grade: str = ""

    @field_validator("user_id")
    @classmethod
    def has_user(cls, v: str) -> str:
        return _required(v, "Say which member")

    @field_validator("program_id")
    @classmethod
    def has_program(cls, v: str) -> str:
        return _required(v, "Say which programme")


class ProgrammeOption(BaseModel):
    id: str
    name: str
    status: str = ""


class MemberOption(BaseModel):
    id: str
    full_name: str
    member_id: str = ""
    avatar: str = ""


def _certificate_row(doc: dict, person: dict | None = None) -> CertificateRow:
    person = person or {}
    issued = doc.get("issued_at") or doc.get("created_at")
    return CertificateRow(
        id=str(doc["_id"]),
        code=doc.get("code", ""),
        holder_name=doc.get("holder_name", ""),
        user_id=doc.get("user_id", ""),
        member_id=doc.get("member_id", "") or person.get("member_id", "") or "",
        avatar=media_url(person.get("avatar", "")),
        program_id=doc.get("program_id", ""),
        program_name=doc.get("program_name", ""),
        hours=doc.get("hours", "") or "",
        grade=doc.get("grade", "") or "",
        issued_at=_iso(issued),
        revoked=bool(doc.get("revoked", False)),
        revoked_reason=doc.get("revoked_reason", "") or "",
        revoked_at=_iso(doc.get("revoked_at")),
        revoked_by=doc.get("revoked_by", "") or "",
        reissued_at=_iso(doc.get("reissued_at")),
        issued_by=doc.get("issued_by", "") or "member",
    )


def _forget_public(code: str) -> None:
    cache.forget(f"public:cert:{code}")


async def _load_certificate(certificate_id: str) -> dict:
    doc = await _certificates().find_one({"_id": to_object_id(certificate_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That certificate doesn't exist")
    return doc


@router.get(
    "/certificates/export",
    summary="Every certificate, as CSV",
    dependencies=[Depends(require_permission("learning.export"))],
)
async def export_certificates(request: Request, me: dict = Depends(get_current_user)):
    docs = await _certificates().find({}).sort("issued_at", -1).to_list(10000)
    rows = [["Code", "Holder", "Member code", "Programme", "Hours", "Grade", "Issued", "Status", "Revoked reason", "Revoked at"]]
    for d in docs:
        r = _certificate_row(d)
        rows.append([r.code, r.holder_name, r.member_id, r.program_name, r.hours, r.grade, r.issued_at,
                     "revoked" if r.revoked else "valid", r.revoked_reason, r.revoked_at])
    await record(me, "learning.export", target="certificates",
                 detail=f"Downloaded the certificate register as CSV ({len(rows) - 1} rows)", request=request)
    return _csv_response(rows, "certificates")


@router.get(
    "/certificates/verify/{code}",
    response_model=VerifyOut,
    summary="Look a certificate up by its number",
    dependencies=[Depends(require_permission("learning.view"))],
)
async def verify_certificate(code: str, me: dict = Depends(get_current_user)):
    code = code.strip().upper()
    # Newest first: if two rows ever shared a code, the current one answers.
    doc = await _certificates().find_one({"code": code}, sort=[("issued_at", -1)])
    if not doc:
        return VerifyOut(found=False, code=code)
    r = _certificate_row(doc)
    return VerifyOut(
        found=True, code=r.code, valid=not r.revoked, holder_name=r.holder_name, member_id=r.member_id,
        program_name=r.program_name, issued_at=r.issued_at,
        revoked_reason=r.revoked_reason, revoked_at=r.revoked_at,
    )


@router.get(
    "/certificates/programmes",
    response_model=list[ProgrammeOption],
    summary="Programmes a certificate can be issued for",
    dependencies=[Depends(require_permission("learning.view"))],
)
async def certificate_programmes(me: dict = Depends(get_current_user)):
    docs = await _programs().find({}, {"name": 1, "status": 1}).sort("name", 1).to_list(500)
    return [ProgrammeOption(id=str(d["_id"]), name=d.get("name", ""), status=d.get("status", "")) for d in docs]


@router.get(
    "/certificates/members",
    response_model=list[MemberOption],
    summary="Find a member to issue to",
    dependencies=[Depends(require_permission("learning.view"))],
)
async def certificate_members(q: str = Query("", max_length=80), me: dict = Depends(get_current_user)):
    term = q.strip()
    if len(term) < 2:
        return []
    # Searchable by email so the right woman can be found; the email itself is
    # not returned — the name and member number are what the certificate carries.
    match = {"role": UserModel.DEFAULT_ROLE, **mongosafe.any_of(term, ["full_name", "email", "member_id"])}
    docs = await _users().find(match, {"full_name": 1, "member_id": 1, "avatar": 1}).sort("full_name", 1).to_list(12)
    return [
        MemberOption(id=str(d["_id"]), full_name=d.get("full_name", ""),
                     member_id=d.get("member_id", "") or "", avatar=media_url(d.get("avatar", "")))
        for d in docs
    ]


@router.get(
    "/certificates",
    response_model=CertificatePage,
    summary="The certificate register",
    dependencies=[Depends(require_permission("learning.view"))],
)
async def list_certificates(
    q: str = Query("", max_length=80),
    state: str = Query("", description="valid | revoked | (blank for all)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    me: dict = Depends(get_current_user),
):
    match: dict = {}
    if q.strip():
        match.update(mongosafe.any_of(q.strip(), ["holder_name", "program_name", "code", "member_id"]))
    if state == "valid":
        match["revoked"] = {"$ne": True}
    elif state == "revoked":
        match["revoked"] = True

    month_start = _now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    total, docs, all_n, revoked_n, month_n = await asyncio.gather(
        _certificates().count_documents(match),
        _certificates().find(match).sort("issued_at", -1)
        .skip((page - 1) * page_size).limit(page_size).to_list(page_size),
        _certificates().count_documents({}),
        _certificates().count_documents({"revoked": True}),
        _certificates().count_documents({"issued_at": {"$gte": month_start}}),
    )
    people = await _member_map([d.get("user_id", "") for d in docs])
    return CertificatePage(
        items=[_certificate_row(d, people.get(d.get("user_id", ""))) for d in docs],
        **page_meta(total, page, page_size),
        summary=CertificateSummary(total=all_n, valid=all_n - revoked_n, revoked=revoked_n, this_month=month_n),
    )


@router.post(
    "/certificates",
    response_model=CertificateRow,
    status_code=status.HTTP_201_CREATED,
    summary="Issue a certificate by hand",
    dependencies=[Depends(require_permission("learning.create"))],
)
async def issue_certificate(body: IssueBody, request: Request, me: dict = Depends(get_current_user)):
    user = await _users().find_one({"_id": to_object_id(body.user_id)}, {"full_name": 1, "member_id": 1, "role": 1})
    if not user or user.get("role") != UserModel.DEFAULT_ROLE:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That member doesn't exist")
    program = await _programs().find_one({"_id": to_object_id(body.program_id)})
    if not program:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That programme doesn't exist")

    # Any existing row, revoked or not — see the module note on codes.
    existing = await _certificates().find_one({"user_id": body.user_id, "program_id": body.program_id})
    if existing:
        if existing.get("revoked"):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"She already holds {existing.get('code', '')} for this programme, revoked — reinstate that one instead",
            )
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"She already holds {existing.get('code', '')} for this programme",
        )

    doc = CertificateModel.create_document(
        user_id=body.user_id,
        member_id=user.get("member_id", "") or "",
        holder_name=body.holder_name.strip() or user.get("full_name", ""),
        program_id=body.program_id,
        program_name=program.get("name", ""),
        hours=body.hours.strip() or program.get("duration", "") or "",
        grade=body.grade.strip(),
    )
    doc["issued_by"] = _who(me)
    result = await _certificates().insert_one(doc)
    doc["_id"] = result.inserted_id
    await record(me, "learning.certificate.issue", target=str(doc["_id"]),
                 detail=f"Issued {doc['code']} ({doc['program_name']}) to {doc['holder_name']} by hand",
                 request=request)
    return _certificate_row(doc, user)


@router.post(
    "/certificates/{certificate_id}/revoke",
    response_model=CertificateRow,
    summary="Withdraw a certificate",
    dependencies=[Depends(require_permission("learning.approve"))],
)
async def revoke_certificate(
    certificate_id: str, body: RevokeBody, request: Request, me: dict = Depends(get_current_user)
):
    doc = await _load_certificate(certificate_id)
    if doc.get("revoked"):
        raise HTTPException(status.HTTP_409_CONFLICT, "That certificate is already revoked")
    changes = {
        "revoked": True, "revoked_reason": body.reason, "revoked_at": _now(), "revoked_by": _who(me),
    }
    await _certificates().update_one(
        {"_id": doc["_id"]},
        {"$set": changes, "$push": {"history": {"action": "revoke", "at": changes["revoked_at"],
                                                "by": changes["revoked_by"], "reason": body.reason}}},
    )
    doc.update(changes)
    _forget_public(doc.get("code", ""))
    await record(me, "learning.certificate.revoke", target=certificate_id,
                 detail=f"Revoked {doc.get('code', '')} ({doc.get('program_name', '')}) held by "
                        f"{doc.get('holder_name', '')}: {body.reason}", request=request)
    return _certificate_row(doc)


@router.post(
    "/certificates/{certificate_id}/reinstate",
    response_model=CertificateRow,
    summary="Make a revoked certificate valid again",
    dependencies=[Depends(require_permission("learning.approve"))],
)
async def reinstate_certificate(certificate_id: str, request: Request, me: dict = Depends(get_current_user)):
    doc = await _load_certificate(certificate_id)
    if not doc.get("revoked"):
        raise HTTPException(status.HTTP_409_CONFLICT, "That certificate is not revoked")
    now = _now()
    changes = {"revoked": False, "revoked_reason": "", "revoked_at": None, "revoked_by": "",
               "reinstated_at": now, "reinstated_by": _who(me)}
    await _certificates().update_one(
        {"_id": doc["_id"]},
        {"$set": changes, "$push": {"history": {"action": "reinstate", "at": now, "by": _who(me),
                                                "reason": doc.get("revoked_reason", "")}}},
    )
    doc.update(changes)
    _forget_public(doc.get("code", ""))
    await record(me, "learning.certificate.reinstate", target=certificate_id,
                 detail=f"Reinstated {doc.get('code', '')} ({doc.get('program_name', '')}) held by "
                        f"{doc.get('holder_name', '')}", request=request)
    return _certificate_row(doc)


@router.post(
    "/certificates/{certificate_id}/reissue",
    response_model=CertificateRow,
    summary="Reissue with the holder's name corrected",
    dependencies=[Depends(require_permission("learning.edit"))],
)
async def reissue_certificate(
    certificate_id: str, body: ReissueBody, request: Request, me: dict = Depends(get_current_user)
):
    doc = await _load_certificate(certificate_id)
    if doc.get("revoked"):
        raise HTTPException(status.HTTP_409_CONFLICT, "Reinstate it first — a revoked certificate cannot be reissued")
    old = doc.get("holder_name", "")
    if body.holder_name == old:
        raise HTTPException(status.HTTP_409_CONFLICT, "That is already the name on it")
    now = _now()
    changes = {"holder_name": body.holder_name, "reissued_at": now, "reissued_by": _who(me)}
    await _certificates().update_one(
        {"_id": doc["_id"]},
        {"$set": changes, "$push": {"history": {"action": "reissue", "at": now, "by": _who(me),
                                                "reason": f"name corrected from '{old}'"}}},
    )
    doc.update(changes)
    _forget_public(doc.get("code", ""))
    await record(me, "learning.certificate.reissue", target=certificate_id,
                 detail=f"Reissued {doc.get('code', '')} ({doc.get('program_name', '')}): "
                        f"'{old}' is now '{body.holder_name}'", request=request)
    return _certificate_row(doc)


@router.delete(
    "/certificates/{certificate_id}",
    summary="Delete a certificate that was issued by hand in error",
    dependencies=[Depends(require_permission("learning.delete"))],
)
async def delete_certificate(certificate_id: str, request: Request, me: dict = Depends(get_current_user)):
    """
    Only a hand-issued one, and only while it is revoked. A certificate a
    woman earned is withdrawn (revoke), never erased — the number she has
    already shown an employer must still answer, even if the answer is "no".
    """
    doc = await _load_certificate(certificate_id)
    if not doc.get("issued_by"):
        raise HTTPException(status.HTTP_409_CONFLICT, "She earned this one — revoke it rather than erase it")
    if not doc.get("revoked"):
        raise HTTPException(status.HTTP_409_CONFLICT, "Revoke it first, with the reason, then delete")
    await _certificates().delete_one({"_id": doc["_id"]})
    _forget_public(doc.get("code", ""))
    await record(me, "learning.certificate.delete", target=certificate_id,
                 detail=f"Deleted hand-issued {doc.get('code', '')} ({doc.get('program_name', '')}) "
                        f"for {doc.get('holder_name', '')}", request=request)
    return {"message": "Deleted"}
