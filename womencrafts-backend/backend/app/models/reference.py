"""
Curated reference data: schemes, cover, health, rights, childcare, transport.

Six modules, one collection. That is a deliberate choice and worth defending,
because "one collection with a type field" is usually the wrong answer.

It is the right answer here because **the query is always the same**:

    {"topic": …, "city": …, "status": "published"}   sorted by rank

Nothing filters on the inside of a scheme or a creche. The screen asks for
"everything under Health near her" and renders whatever comes back. When the
query never looks inside the payload, the payload does not need to be a schema —
and six collections would mean six routers, six caches, six admin surfaces and
six places to forget the `status` filter.

What the payload holds differs completely between topics — a creche has opening
hours and a fee, a right has an Act and a helpline — so it is stored as a
sub-document and rendered by the screen that asked for it. The fields the
*platform* cares about (topic, city, rank, status, free) are top level, indexed,
and the same for all six.

**`free` is top level on purpose.** Cost and not knowing are the two things that
stop a woman using what she is entitled to, almost never willingness. Making
"is this free" a first-class, filterable fact rather than a string inside a blob
is the difference between a screen that can lead with it and one that cannot.
"""

from datetime import datetime, timezone


class ReferenceModel:
    collection_name = "reference"

    TOPIC_SCHEME = "scheme"        # government schemes and grants
    TOPIC_COVER = "cover"          # insurance and pension
    TOPIC_HEALTH = "health"        # checks, camps, what is free
    TOPIC_RIGHTS = "rights"        # what the law gives her
    TOPIC_FAMILY = "family"        # creches, Anganwadi, childcare
    TOPIC_TRAVEL = "travel"        # routes, safety, what a fare should be
    TOPICS = (
        TOPIC_SCHEME, TOPIC_COVER, TOPIC_HEALTH,
        TOPIC_RIGHTS, TOPIC_FAMILY, TOPIC_TRAVEL,
    )

    STATUS_PUBLISHED = "published"
    STATUS_DRAFT = "draft"

    #: Entries that apply everywhere. A national scheme is not "in Jaipur".
    EVERYWHERE = "*"

    @staticmethod
    def create_document(
        *,
        topic: str,
        title: str,
        body: str = "",
        city: str = EVERYWHERE,
        rank: int = 100,
        free: bool | None = None,
        cost_label: str = "",
        who: str = "",
        payload: dict | None = None,
    ) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "topic": topic,
            "title": title.strip(),
            "body": body.strip(),
            "city": city or ReferenceModel.EVERYWHERE,
            # Lower sorts first. Curated order, because "most useful to a woman
            # who has just opened this screen" is an editorial judgement and not
            # something an algorithm should be guessing at this stage.
            "rank": int(rank),
            "free": free,
            "cost_label": cost_label.strip(),
            "who": who.strip(),
            "payload": payload or {},
            "status": ReferenceModel.STATUS_PUBLISHED,
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict, *, mine: dict | None = None) -> dict:
        return {
            "id": str(doc["_id"]),
            "topic": doc.get("topic", ""),
            "title": doc.get("title", ""),
            "body": doc.get("body", ""),
            "city": doc.get("city", ReferenceModel.EVERYWHERE),
            "free": doc.get("free"),
            "cost_label": doc.get("cost_label", ""),
            "who": doc.get("who", ""),
            "payload": doc.get("payload") or {},
            # Whatever she has done about this entry — applied for the scheme,
            # enrolled in the cover, ticked off the health check. Null when she
            # has done nothing, which is the common case and must not require
            # the screen to guess.
            "mine": MyReferenceModel.to_response(mine) if mine else None,
        }


class MyReferenceModel:
    """
    What one woman has done about one reference entry.

    Separate from the entry itself for the reason every per-person fact is kept
    separate here: the entry is shared and cached, and a cached copy carrying
    one woman's application status would show it to the next woman who asked.
    """

    collection_name = "reference_mine"

    STATE_SAVED = "saved"          # she wants to come back to it
    STATE_APPLIED = "applied"      # she has put an application in
    STATE_ACTIVE = "active"        # she holds it — enrolled, covered
    STATE_DONE = "done"            # a health check she has had
    STATE_DECLINED = "declined"    # turned down, and why
    STATES = (STATE_SAVED, STATE_APPLIED, STATE_ACTIVE, STATE_DONE, STATE_DECLINED)

    @staticmethod
    def create_document(*, user_id: str, ref_id: str, topic: str, state: str, note: str = "") -> dict:
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,
            "ref_id": ref_id,
            "topic": topic,
            "state": state,
            "note": note.strip(),
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        moved = doc.get("updated_at") or doc.get("created_at")
        return {
            "state": doc.get("state", ""),
            "note": doc.get("note", ""),
            "since": moved.strftime("%d %b %Y") if isinstance(moved, datetime) else "",
        }
