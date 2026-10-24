"""
Questions and answers on a course — so a doubt does not stop her.

Anyone taking the course (joined and confirmed) and the course's teacher can
ask and answer. A question can be about one lesson, so it shows beside that
lesson too. The teacher can mark any answer as correct — a green check that
tells everyone "this is right" — and her own answers carry a "Teacher" badge.

Read and write are for the people in the course only: the questions often quote
the lessons, and on a paid course those are not for everyone.

    asked     → the teacher is told
    answered  → whoever asked is told
    verified  → whoever answered is told
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator

from app.core.rbac import require_active_member
from app.core.serializers import to_object_id
from app.db.mongodb import get_database
from app.models.conversation import notify
from app.models.enrollment import EnrollmentModel
from app.models.program import ProgramModel

router = APIRouter(prefix="/courses", tags=["Member"])

COLLECTION = "course_questions"


def _questions():
    return get_database()[COLLECTION]


async def _course_and_role(program_id: str, me: dict) -> tuple[dict, bool]:
    """The course, and whether she is its teacher. 403 unless she is in it."""
    program = await get_database()[ProgramModel.collection_name].find_one({"_id": to_object_id(program_id)})
    if not program:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That course doesn't exist")
    uid = str(me["_id"])
    if program.get("owner_id") == uid:
        return program, True
    enrolled = await get_database()[EnrollmentModel.collection_name].find_one(
        {"user_id": uid, "program_id": program_id, "status": {"$in": EnrollmentModel.LEARNING}}, {"_id": 1})
    if not enrolled:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Join the course to see and ask questions.")
    return program, False


# ── shapes ──────────────────────────────────────────────────────────────────


class QuestionIn(BaseModel):
    body: str = Field(min_length=5, max_length=1500)
    #: The lesson it is about (1-based), or none for the whole course.
    lesson: Optional[int] = Field(None, ge=1, le=100)

    @field_validator("body")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()


class AnswerIn(BaseModel):
    body: str = Field(min_length=2, max_length=3000)

    @field_validator("body")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()


class AnswerOut(BaseModel):
    id: str
    author: str
    body: str
    when: str
    by_teacher: bool
    verified: bool
    mine: bool


class QuestionOut(BaseModel):
    id: str
    author: str
    body: str
    lesson: Optional[int]
    lesson_title: str = ""
    when: str
    by_teacher: bool
    mine: bool
    answers: list[AnswerOut]
    #: True once the teacher has marked an answer correct, or answered it herself.
    resolved: bool


class QAOut(BaseModel):
    is_teacher: bool
    teacher_name: str
    questions: list[QuestionOut]
    unanswered: int


def _when(v) -> str:
    return v.strftime("%b %d, %Y") if isinstance(v, datetime) else ""


def _shape(doc: dict, program: dict, uid: str) -> QuestionOut:
    owner = program.get("owner_id", "")
    lessons = program.get("curriculum") or []
    answers = [
        AnswerOut(
            id=a["id"], author=a.get("author", "A member"), body=a.get("body", ""), when=_when(a.get("created_at")),
            by_teacher=bool(owner) and a.get("user_id") == owner, verified=bool(a.get("verified")),
            mine=a.get("user_id") == uid,
        )
        for a in doc.get("answers") or []
    ]
    # Verified first, then the teacher's, then oldest first — the order a reader wants.
    answers.sort(key=lambda a: (not a.verified, not a.by_teacher))
    n = doc.get("lesson")
    return QuestionOut(
        id=str(doc["_id"]), author=doc.get("author", "A member"), body=doc.get("body", ""), lesson=n,
        lesson_title=(lessons[n - 1] or {}).get("title", "") if n and 0 < n <= len(lessons) else "",
        when=_when(doc.get("created_at")), by_teacher=bool(owner) and doc.get("user_id") == owner,
        mine=doc.get("user_id") == uid, answers=answers,
        resolved=any(a.verified or a.by_teacher for a in answers),
    )


async def _payload(program_id: str, program: dict, me: dict, is_teacher: bool, lesson: Optional[int] = None) -> QAOut:
    query: dict = {"program_id": program_id}
    if lesson:
        query["lesson"] = lesson
    docs = await _questions().find(query).sort("created_at", -1).to_list(300)
    uid = str(me["_id"])
    questions = [_shape(d, program, uid) for d in docs]
    return QAOut(
        is_teacher=is_teacher, teacher_name=program.get("teacher_name") or "WomSakhi team",
        questions=questions, unanswered=sum(1 for q in questions if not q.answers),
    )


# ── reading ─────────────────────────────────────────────────────────────────


@router.get("/{program_id}/qa", response_model=QAOut, summary="Questions and answers on a course")
async def list_qa(program_id: str, lesson: Optional[int] = Query(None, ge=1, le=100),
                  me: dict = Depends(require_active_member)):
    program, is_teacher = await _course_and_role(program_id, me)
    return await _payload(program_id, program, me, is_teacher, lesson)


# ── asking and answering ────────────────────────────────────────────────────


@router.post("/{program_id}/qa", response_model=QuestionOut, status_code=status.HTTP_201_CREATED, summary="Ask a question")
async def ask(program_id: str, body: QuestionIn, me: dict = Depends(require_active_member)):
    program, _ = await _course_and_role(program_id, me)
    lessons = program.get("curriculum") or []
    if body.lesson and body.lesson > max(len(lessons), 1):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That lesson is not in this course.")
    now = datetime.now(timezone.utc)
    doc = {
        "program_id": program_id, "user_id": str(me["_id"]), "author": me.get("full_name") or "A member",
        "body": body.body, "lesson": body.lesson, "answers": [], "created_at": now, "updated_at": now,
    }
    doc["_id"] = (await _questions().insert_one(doc)).inserted_id
    if program.get("owner_id") and program["owner_id"] != str(me["_id"]):
        await notify(get_database(), program["owner_id"],
                     f"New question on {program.get('name', 'your course')}", body.body[:140],
                     "program", f"/app/programs/{program_id}#questions")
    return _shape(doc, program, str(me["_id"]))


async def _question(program_id: str, question_id: str) -> dict:
    doc = await _questions().find_one({"_id": to_object_id(question_id), "program_id": program_id})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That question is gone")
    return doc


@router.post("/{program_id}/qa/{question_id}/answers", response_model=QuestionOut, summary="Answer a question")
async def answer(program_id: str, question_id: str, body: AnswerIn, me: dict = Depends(require_active_member)):
    program, _ = await _course_and_role(program_id, me)
    q = await _question(program_id, question_id)
    now = datetime.now(timezone.utc)
    a = {"id": uuid4().hex, "user_id": str(me["_id"]), "author": me.get("full_name") or "A member",
         "body": body.body, "verified": False, "created_at": now}
    fresh = await _questions().find_one_and_update(
        {"_id": q["_id"]}, {"$push": {"answers": a}, "$set": {"updated_at": now}}, return_document=True)
    if q.get("user_id") != str(me["_id"]):
        await notify(get_database(), q["user_id"], f"{a['author']} answered your question",
                     body.body[:140], "program", f"/app/programs/{program_id}#questions")
    return _shape(fresh, program, str(me["_id"]))


@router.post("/{program_id}/qa/{question_id}/answers/{answer_id}/verify", response_model=QuestionOut,
             summary="Teacher: mark an answer correct (or take the mark back)")
async def verify(program_id: str, question_id: str, answer_id: str, me: dict = Depends(require_active_member)):
    program, is_teacher = await _course_and_role(program_id, me)
    if not is_teacher:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the course's teacher can mark an answer correct.")
    q = await _question(program_id, question_id)
    target = next((a for a in q.get("answers") or [] if a.get("id") == answer_id), None)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That answer is gone")
    now_verified = not target.get("verified")
    fresh = await _questions().find_one_and_update(
        {"_id": q["_id"], "answers.id": answer_id},
        {"$set": {"answers.$.verified": now_verified, "answers.$.verified_at": datetime.now(timezone.utc) if now_verified else None}},
        return_document=True,
    )
    if now_verified and target.get("user_id") != str(me["_id"]):
        await notify(get_database(), target["user_id"], "Your answer was marked correct",
                     f"{program.get('teacher_name') or 'The teacher'} verified your answer on {program.get('name', 'the course')}.",
                     "program", f"/app/programs/{program_id}#questions")
    return _shape(fresh, program, str(me["_id"]))


@router.delete("/{program_id}/qa/{question_id}", status_code=status.HTTP_204_NO_CONTENT,
               summary="Remove a question (hers, or any on her course)")
async def delete_question(program_id: str, question_id: str, me: dict = Depends(require_active_member)):
    _, is_teacher = await _course_and_role(program_id, me)
    q = await _question(program_id, question_id)
    if not is_teacher and q.get("user_id") != str(me["_id"]):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only remove your own question.")
    await _questions().delete_one({"_id": q["_id"]})


@router.delete("/{program_id}/qa/{question_id}/answers/{answer_id}", response_model=QuestionOut,
               summary="Remove an answer (hers, or any on her course)")
async def delete_answer(program_id: str, question_id: str, answer_id: str, me: dict = Depends(require_active_member)):
    program, is_teacher = await _course_and_role(program_id, me)
    q = await _question(program_id, question_id)
    target = next((a for a in q.get("answers") or [] if a.get("id") == answer_id), None)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That answer is gone")
    if not is_teacher and target.get("user_id") != str(me["_id"]):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only remove your own answer.")
    fresh = await _questions().find_one_and_update(
        {"_id": q["_id"]}, {"$pull": {"answers": {"id": answer_id}}}, return_document=True)
    return _shape(fresh, program, str(me["_id"]))
