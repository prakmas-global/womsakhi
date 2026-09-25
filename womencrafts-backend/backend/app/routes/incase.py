"""
In case something happens.

Six plain questions, answered once, so that a week in hospital or worse does
not leave her family guessing. The most valuable answer is the least dramatic
one: where the papers are.

── Why the questions live here and the answers live in Mongo ───────────────
The six questions are the same for everyone — they are the product, arrived at
by asking what actually goes wrong when a woman is suddenly not there. Her
answers are hers alone.

Until this existed, the screen carried three answers already filled in: a
sister called Sunita, papers in "the steel almirah, top shelf, blue folder",
and Sunita again for the circle. They were the same for every woman who opened
it, and anything she typed over them lived in React state and was gone on
reload.

That is the worst failure mode in this product. She reads "3 of 6 answered",
believes her instructions are written down, and they are not — so on the day
it matters nobody knows who to ring or where the papers are.

── Private, and deliberately plain ─────────────────────────────────────────
No sharing, no export, no "trusted contact can view". Every one of those turns
a place she can be honest into a place she must be careful, and a woman being
careful here writes nothing useful down.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.rbac import require_active_member
from app.db.mongodb import get_database

router = APIRouter(prefix="/me/incase", tags=["Member · Safety"])

COLLECTION = "incase_answers"

#: The six. Order matters: it runs from the call that has to be made in the
#: first hour to the things that surface weeks later.
QUESTIONS = [
    {"id": "w1", "question": "Who should be told first?",
     "why": "So it is not left to whoever happens to be in the house", "icon": "PhoneCall"},
    {"id": "w2", "question": "Where are the papers?",
     "why": "Aadhaar, bank book, the children's certificates", "icon": "FolderCheck"},
    {"id": "w3", "question": "Who continues the shop?",
     "why": "So the machine and the customers do not simply stop", "icon": "Store"},
    {"id": "w4", "question": "Who takes your place in the pot?",
     "why": "The circle needs to know, or your months are lost", "icon": "Coins"},
    {"id": "w5", "question": "Who looks after the children?",
     "why": "Named, so nobody argues about it later", "icon": "Baby"},
    {"id": "w6", "question": "What is in your name?",
     "why": "Land, an account, a policy — most women never write this down", "icon": "Landmark"},
]

_IDS = {q["id"] for q in QUESTIONS}


class AnswerIn(BaseModel):
    #: Empty clears it. Clearing must be as easy as writing — an answer that
    #: has stopped being true is worse than no answer.
    answer: str = Field(default="", max_length=400)


def _col():
    return get_database()[COLLECTION]


@router.get("", summary="The six questions, and what she has written")
async def get_incase(me: dict = Depends(require_active_member)):
    doc = await _col().find_one({"user_id": str(me["_id"])}) or {}
    answers = doc.get("answers", {})
    wishes = [{**q, "answer": answers.get(q["id"], "")} for q in QUESTIONS]
    return {
        "wishes": wishes,
        "answered": sum(1 for w in wishes if w["answer"]),
        "total": len(wishes),
        "updated_at": doc.get("updated_at").isoformat() if doc.get("updated_at") else "",
    }


@router.put("/{wish_id}", summary="Write or change one answer")
async def set_answer(wish_id: str, body: AnswerIn, me: dict = Depends(require_active_member)):
    uid = str(me["_id"])
    if wish_id not in _IDS:
        # Not a missing record — the question genuinely does not exist.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such question")

    now = datetime.now(timezone.utc)
    text = body.answer.strip()
    if text:
        update = {"$set": {f"answers.{wish_id}": text, "updated_at": now},
                  "$setOnInsert": {"user_id": uid, "created_at": now}}
    else:
        # Unset rather than store "", so "answered" counts what is actually
        # written rather than what has been visited.
        update = {"$unset": {f"answers.{wish_id}": ""},
                  "$set": {"updated_at": now},
                  "$setOnInsert": {"user_id": uid, "created_at": now}}
    await _col().update_one({"user_id": uid}, update, upsert=True)
    return await get_incase(me)
