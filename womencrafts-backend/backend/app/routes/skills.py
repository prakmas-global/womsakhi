"""
Proving a skill, and getting confident with a phone.

**The marking happens here, not on the phone.** The questions go out without
their answers and the answers come back as indices; the server decides the
score. A client-side test is not a test, and a certificate that can be earned by
reading the JSON is worth nothing to the employer it is shown to.
"""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException, status

from app.core import cache
from app.core.rbac import require_active_member
from app.core.serializers import to_object_id
from app.db.mongodb import get_database
from app.models.skills import AssessmentModel, AttemptModel, DigitalStepModel
from app.schemas.skills import (
    AssessmentResponse,
    AttemptRequest,
    AttemptResponse,
    DigitalStepResponse,
)

router = APIRouter(tags=["Member · Learn"])


def _assessments():
    return get_database()[AssessmentModel.collection_name]


def _attempts():
    return get_database()[AttemptModel.collection_name]


def _steps():
    return get_database()[DigitalStepModel.collection_name]


def _progress():
    return get_database()[DigitalStepModel.PROGRESS_COLLECTION]


# ── Prove your skills ──────────────────────────────────────────────────────

@router.get("/assess", response_model=list[AssessmentResponse], summary="Skill tests I can take")
async def list_assessments(me: dict = Depends(require_active_member)):
    async def _load() -> list[dict]:
        return await _assessments().find({"status": "published"}).sort("skill", 1).to_list(100)

    uid = str(me["_id"])
    docs, attempts = await asyncio.gather(
        cache.cached("assess:list", cache.SHARED_TTL, _load),
        # Every attempt she has made, in one query rather than one per test.
        _attempts().find({"user_id": uid}).to_list(500),
    )

    # Her best per test, and how many times she has tried. Computed here rather
    # than with an aggregation because the rows are already in memory and a
    # second round trip to count them would cost more than the loop.
    best: dict[str, dict] = {}
    for a in attempts:
        key = a.get("assessment_id", "")
        got = best.setdefault(key, {"score": 0, "passed": False, "attempts": 0})
        got["attempts"] += 1
        if int(a.get("score", 0)) >= got["score"]:
            got["score"] = int(a.get("score", 0))
        got["passed"] = got["passed"] or bool(a.get("passed"))

    return [
        AssessmentResponse(**AssessmentModel.to_response(d, best=best.get(str(d["_id"]))))
        for d in docs
    ]


@router.get("/assess/{assessment_id}", response_model=AssessmentResponse, summary="Take this test")
async def get_assessment(assessment_id: str, me: dict = Depends(require_active_member)):
    doc = await _assessments().find_one({"_id": to_object_id(assessment_id), "status": "published"})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That test is not available")
    # Questions included, correct answers stripped by `to_response`.
    return AssessmentResponse(**AssessmentModel.to_response(doc, with_questions=True))


@router.post(
    "/assess/{assessment_id}/attempt",
    response_model=AttemptResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit my answers",
)
async def submit(
    assessment_id: str,
    body: AttemptRequest,
    me: dict = Depends(require_active_member),
):
    doc = await _assessments().find_one({"_id": to_object_id(assessment_id), "status": "published"})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That test is not available")

    questions = doc.get("questions") or []
    if not questions:
        raise HTTPException(status.HTTP_409_CONFLICT, "That test has no questions yet")

    # Unanswered counts as wrong rather than as an error. A woman who ran out of
    # time should get her score for what she did answer, not a rejection.
    right = sum(
        1
        for i, q in enumerate(questions)
        if i < len(body.answers) and body.answers[i] == int(q.get("answer", -1))
    )
    score = round(right * 100 / len(questions))
    passed = score >= int(doc.get("pass_mark", 60))

    attempt = AttemptModel.create_document(
        user_id=str(me["_id"]), member_id=me.get("member_id", ""),
        assessment_id=assessment_id, score=score, passed=passed, answers=body.answers,
    )
    result = await _attempts().insert_one(attempt)
    attempt["_id"] = result.inserted_id
    return AttemptResponse(**AttemptModel.to_response(attempt))


# ── Using a phone ──────────────────────────────────────────────────────────

@router.get("/digital", response_model=list[DigitalStepResponse], summary="Getting confident with a phone")
async def list_steps(me: dict = Depends(require_active_member)):
    async def _load() -> list[dict]:
        return await _steps().find({}).sort("n", 1).to_list(50)

    uid = str(me["_id"])
    docs, done_rows = await asyncio.gather(
        cache.cached("digital:steps", cache.SHARED_TTL, _load),
        _progress().find({"user_id": uid}, {"step_id": 1}).to_list(100),
    )
    done = {r["step_id"] for r in done_rows}
    return [
        DigitalStepResponse(**DigitalStepModel.to_response(d, done=str(d["_id"]) in done))
        for d in docs
    ]


@router.post("/digital/{step_id}/done", response_model=list[DigitalStepResponse], summary="Mark a step done")
async def mark_done(step_id: str, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    # Upsert, so pressing it twice leaves one record and no error.
    await _progress().update_one(
        {"user_id": uid, "step_id": step_id},
        {"$setOnInsert": {"user_id": uid, "step_id": step_id}},
        upsert=True,
    )
    return await list_steps(me)


@router.delete("/digital/{step_id}/done", response_model=list[DigitalStepResponse], summary="Undo a step")
async def mark_undone(step_id: str, me: dict = Depends(require_active_member)):
    await _progress().delete_one({"user_id": str(me["_id"]), "step_id": step_id})
    return await list_steps(me)


# ── seed ───────────────────────────────────────────────────────────────────

async def seed() -> None:
    if await _assessments().count_documents({}) == 0:
        await _assessments().insert_many([
            AssessmentModel.create_document(
                skill="Tailoring", title="Stitching to measure", minutes=20, pass_mark=60,
                blurb="Twenty minutes on your phone. Nobody watches, and you may take it again.",
                questions=[
                    dict(ask="A customer's bust measures 36 inches. How much ease do you add for a fitted blouse?",
                         options=["None", "Half an inch", "One to two inches", "Four inches"], answer=2),
                    dict(ask="Which stitch is strongest for a seam that will be under strain?",
                         options=["Running stitch", "Backstitch", "Basting stitch", "Blanket stitch"], answer=1),
                    dict(ask="A customer says the sleeve is too tight at the arm. What do you check first?",
                         options=["The hem", "The armhole depth", "The neckline", "The button placement"], answer=1),
                    dict(ask="What should you do before cutting an expensive fabric?",
                         options=["Cut and adjust after", "Make a paper pattern first",
                                  "Ask the customer to choose again", "Wash the fabric"], answer=1),
                ]),
            AssessmentModel.create_document(
                skill="Money", title="Running the books", minutes=15, pass_mark=60,
                blurb="What you actually need to know to price your work and keep a record.",
                questions=[
                    dict(ask="A piece costs you ₹200 in material and four hours of your time. If your "
                             "hour is worth ₹100, what is the least you should charge?",
                         options=["₹200", "₹400", "₹600", "₹1,000"], answer=2),
                    dict(ask="Which of these is a cost you must count even though nobody bills you for it?",
                         options=["Thread", "Your own hours", "Electricity", "Delivery"], answer=1),
                    dict(ask="A customer asks for a discount on a bulk order. What must you check first?",
                         options=["Whether you like them", "Whether the lower price still covers your costs",
                                  "What others charge", "Nothing — always say yes"], answer=1),
                ]),
            AssessmentModel.create_document(
                skill="Digital", title="Selling on a phone", minutes=15, pass_mark=60,
                blurb="Photographs, captions, and getting paid without being cheated.",
                questions=[
                    dict(ask="When is the best light for photographing what you make?",
                         options=["Midday sun", "Near a window in the morning", "Under a tube light", "At night with flash"], answer=1),
                    dict(ask="A buyer sends a screenshot saying they have paid. What do you do?",
                         options=["Post the order", "Check your own bank message first",
                                  "Ask for another screenshot", "Give a discount"], answer=1),
                    dict(ask="Someone asks for your UPI PIN to 'send' you money. This is:",
                         options=["Normal", "A fraud — a PIN is only ever for paying",
                                  "Fine if they seem trustworthy", "Required for large amounts"], answer=1),
                ]),
        ])

    if await _steps().count_documents({}) == 0:
        await _steps().insert_many([
            DigitalStepModel.create_document(n=1, label="Finding your way around the phone", minutes=10,
                                             note="Settings, storage, and what to do when it says it is full."),
            DigitalStepModel.create_document(n=2, label="Taking a photograph worth selling from", minutes=15,
                                             note="Light, background, and holding it still."),
            DigitalStepModel.create_document(n=3, label="WhatsApp for customers, not just family", minutes=15,
                                             note="A business profile, a catalogue, and replying quickly."),
            DigitalStepModel.create_document(n=4, label="Getting paid by UPI", minutes=10,
                                             note="Your own QR code, and checking the money actually arrived."),
            DigitalStepModel.create_document(n=5, label="Spotting a fraud message", minutes=10,
                                             note="Nobody needs your PIN or your OTP. Nobody."),
            DigitalStepModel.create_document(n=6, label="Keeping your account safe", minutes=10,
                                             note="A password that is not your birthday, and what to do if you lose the phone."),
        ])
