"""
Proving a skill, and getting confident with a phone.

Two small modules that share a shape: an ordered set of steps a woman works
through, and a record of where she got to.

**An attempt is never overwritten.** Taking an assessment again writes a new
attempt, so "I passed on the third try" stays true and a worse later score
cannot erase a better earlier one. The screen shows her best; the record keeps
them all.
"""

from datetime import datetime, timezone

from app.core.serializers import aware


class AssessmentModel:
    """One skill test — twenty minutes on a phone, no invigilator."""

    collection_name = "assessments"

    @staticmethod
    def create_document(
        *,
        skill: str,
        title: str,
        blurb: str = "",
        minutes: int = 20,
        pass_mark: int = 60,
        questions: list[dict] | None = None,
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "skill": skill.strip(),
            "title": title.strip(),
            "blurb": blurb.strip(),
            "minutes": int(minutes),
            "pass_mark": int(pass_mark),
            "questions": questions or [],
            "status": "published",
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict, *, best: dict | None = None, with_questions: bool = False) -> dict:
        out = {
            "id": str(doc["_id"]),
            "skill": doc.get("skill", ""),
            "title": doc.get("title", ""),
            "blurb": doc.get("blurb", ""),
            "minutes": int(doc.get("minutes", 20)),
            "pass_mark": int(doc.get("pass_mark", 60)),
            "question_count": len(doc.get("questions") or []),
            "best_score": int(best.get("score", 0)) if best else None,
            "passed": bool(best.get("passed")) if best else False,
            "attempts": int(best.get("attempts", 0)) if best else 0,
            "questions": [],
        }
        if with_questions:
            # The correct answer is stripped on the way out. Sending it to the
            # phone and trusting the phone not to look is not a test.
            out["questions"] = [
                {"n": i + 1, "ask": q.get("ask", ""), "options": list(q.get("options") or [])}
                for i, q in enumerate(doc.get("questions") or [])
            ]
        return out


class AttemptModel:
    collection_name = "assessment_attempts"

    @staticmethod
    def create_document(
        *, user_id: str, member_id: str, assessment_id: str,
        score: int, passed: bool, answers: list[int],
    ) -> dict:
        return {
            "user_id": user_id,
            "member_id": member_id,
            "assessment_id": assessment_id,
            "score": int(score),
            "passed": bool(passed),
            "answers": answers,
            "created_at": datetime.now(timezone.utc),
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        when = aware(doc.get("created_at"))
        return {
            "id": str(doc["_id"]),
            "assessment_id": doc.get("assessment_id", ""),
            "score": int(doc.get("score", 0)),
            "passed": bool(doc.get("passed")),
            "taken_on": when.strftime("%d %b %Y") if when else "",
        }


class DigitalStepModel:
    """
    Getting confident with a phone — six steps, in order.

    In order and not skippable at random, because they build on each other:
    there is no point teaching UPI safety to someone who cannot yet find her
    storage settings.
    """

    collection_name = "digital_steps"
    PROGRESS_COLLECTION = "digital_progress"

    @staticmethod
    def create_document(*, n: int, label: str, note: str = "", minutes: int = 10) -> dict:
        return {
            "n": int(n),
            "label": label.strip(),
            "note": note.strip(),
            "minutes": int(minutes),
            "created_at": datetime.now(timezone.utc),
        }

    @staticmethod
    def to_response(doc: dict, *, done: bool = False) -> dict:
        return {
            "id": str(doc["_id"]),
            "n": int(doc.get("n", 0)),
            "label": doc.get("label", ""),
            "note": doc.get("note", ""),
            "minutes": int(doc.get("minutes", 10)),
            "done": done,
        }
