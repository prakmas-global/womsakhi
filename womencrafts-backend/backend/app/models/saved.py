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
    #: Something another woman sells in the market. The market's Save button
    #: was a `useState` array — it forgot everything the moment she navigated,
    #: because there was no kind here for it to be saved as.
    KIND_LISTING = "listing"
    #: Something another woman wrote in a circle. The bookmark on a post wrote
    #: to `localStorage` and nowhere else, so the answer she kept was on one
    #: handset — gone when she next signed in on another, and gone for good if
    #: that was somebody else's phone she had borrowed.
    KIND_POST = "post"
    KINDS = (
        KIND_JOB, KIND_PROGRAM, KIND_EVENT, KIND_SCHEME,
        KIND_MENTOR, KIND_SERVICE, KIND_LISTING, KIND_POST,
    )

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
            "title": SavedModel._title(doc.get("kind", ""), subject),
            "sub": SavedModel._subtitle(doc.get("kind", ""), subject),
            "href": SavedModel._href(doc.get("kind", ""), subject),
            "saved_on": when.strftime("%d %b %Y") if isinstance(when, datetime) else "",
        }

    @staticmethod
    def _href(kind: str, subject: dict | None) -> str:
        """
        Where the Saved screen should send her, when `/<route>/<ref_id>` is wrong.

        Empty for every kind whose own id IS the address — a saved job lives at
        `/app/opportunities/<id>` and always will. A post does not: its id
        addresses nothing, it is a paragraph inside a circle, so the only link
        that opens it has to name the circle it was written in.
        """
        if not subject:
            return ""
        if kind == SavedModel.KIND_POST:
            circle = subject.get("circle_id") or ""
            return f"/app/circles/{circle}#{subject['_id']}" if circle else "/app/circles"
        return ""

    @staticmethod
    def _title(kind: str, subject: dict | None) -> str:
        if not subject:
            return "No longer listed"
        if kind == SavedModel.KIND_POST:
            # A post has neither a title nor a name — it is somebody's words.
            # Its first line is what the circle screens already use as its
            # heading, so the Saved list says the same thing they do.
            first = (subject.get("body") or "").strip().splitlines()
            line = first[0].strip() if first else ""
            return (line[:88] + "…") if len(line) > 88 else (line or "A post in your circle")
        return subject.get("title") or subject.get("name") or "No longer listed"

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
        if kind == SavedModel.KIND_LISTING:
            # The price is the thing she saved it for, and it is stored in
            # minor units — so it is formatted here rather than left to a
            # screen that would have to guess the unit.
            price = int(subject.get("price_minor") or 0)
            rate = subject.get("rate") or ""
            money = f"₹{price // 100:,}" + (f" {rate}" if rate else "")
            return " · ".join(x for x in (money, subject.get("place") or "") if x)
        if kind == SavedModel.KIND_POST:
            # Who said it. The body is already the title, so repeating it here
            # would give her the same sentence twice and tell her nothing.
            return subject.get("author_name") or ""
        return subject.get("desc") or subject.get("description") or ""
