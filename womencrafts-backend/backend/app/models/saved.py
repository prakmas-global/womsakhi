"""
Everything she pressed the bookmark on.

**One collection for every kind of saveable thing**, rather than a `saved_jobs`,
a `saved_courses` and a `saved_events`. The Saved screen shows them mixed and
sorted by when she saved them; three collections would mean three queries and a
merge in Python every time she opens it, and a fourth the day something new
becomes saveable.

A row is `(user_id, kind, ref_id)` and nothing else. Deliberately no copy of the
title or the price: a saved job whose pay changed must show the new pay, and a
denormalised copy is a promise the platform cannot keep. The screen joins to the
real record — one `$in` per kind, not one per row.
"""

from datetime import datetime, timezone


class SavedModel:
    collection_name = "saved"

    KIND_JOB = "job"
    KIND_PROGRAM = "program"
    KIND_EVENT = "event"
    KIND_SCHEME = "scheme"
    KIND_MENTOR = "mentor"
    KIND_SERVICE = "service"
    KINDS = (KIND_JOB, KIND_PROGRAM, KIND_EVENT, KIND_SCHEME, KIND_MENTOR, KIND_SERVICE)

    @staticmethod
    def create_document(*, user_id: str, kind: str, ref_id: str) -> dict:
        return {
            "user_id": user_id,
            "kind": kind,
            "ref_id": ref_id,
            "created_at": datetime.now(timezone.utc),
        }

    @staticmethod
    def to_response(doc: dict, subject: dict | None = None) -> dict:
        when = doc.get("created_at")
        return {
            "id": str(doc["_id"]),
            "kind": doc.get("kind", ""),
            "ref_id": doc.get("ref_id", ""),
            # A saved thing whose subject has since been removed is still worth
            # showing: finding out it closed is information, and silently
            # dropping the row looks like the app lost her bookmark.
            "gone": subject is None,
            "title": (subject or {}).get("title") or (subject or {}).get("name") or "No longer listed",
            "sub": SavedModel._subtitle(doc.get("kind", ""), subject),
            "saved_on": when.strftime("%d %b %Y") if isinstance(when, datetime) else "",
        }

    @staticmethod
    def _subtitle(kind: str, subject: dict | None) -> str:
        if not subject:
            return ""
        if kind == SavedModel.KIND_JOB:
            return f"{subject.get('org', '')} · {subject.get('pay', '')}".strip(" ·")
        if kind == SavedModel.KIND_MENTOR:
            return subject.get("headline", "")
        if kind == SavedModel.KIND_EVENT:
            return f"{subject.get('date', '')} · {subject.get('location', '')}".strip(" ·")
        return subject.get("desc") or subject.get("description") or ""
