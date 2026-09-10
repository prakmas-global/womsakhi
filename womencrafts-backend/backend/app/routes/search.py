"""
One search box across everything she can reach.

**Why this is not a Mongo `$text` index.** A text index is per-collection, and
the thing she wants is one ranked list across nine of them. Running nine text
searches and merging them is the same number of round trips as running nine
regex searches, and the regexes are anchored to a prefix so they use the
ordinary indexes that already exist. When this outgrows that — and it will, at
the point where "tailoring" should also match "stitching" — the answer is a real
search engine, not a text index, and this endpoint is the seam to put it behind.

Three things make it usable rather than merely correct:

- **Nine queries, one round trip.** They are independent, so `gather` sends them
  together. Serially this would be nine × 50ms; together it is one.
- **Ranked by kind, not by score.** A woman typing "tailor" wants work and
  courses before she wants a mela. Relevance scoring across nine differently
  shaped collections would be false precision; a deliberate order is honest and
  she can see it.
- **Bounded per kind.** Five from each, so one crowded collection cannot fill
  the whole list.
"""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.core import mongosafe
from app.core.rbac import require_active_member
from app.db.mongodb import get_database
from app.models.growth import EventModel, MentorModel, OpportunityModel
from app.models.program import ProgramModel
from app.models.reference import ReferenceModel
from app.models.service import ServiceModel
from app.schemas.search import SearchAnswer, SearchHit, SearchResults

router = APIRouter(prefix="/search", tags=["Member"])

#: Per kind, so one big collection cannot crowd out the rest.
PER_KIND = 5

#: Her own things, searched with her id in the query so one member can never
#: see another's. These were missing entirely: searching "Neha" — the name of
#: the woman who had just ordered from her — returned nothing, because the box
#: only ever looked at the shared catalogue.
_MINE: list[dict[str, Any]] = [
    # `scope` is the field that ties a row to her. It is not the same name
    # everywhere — the older collections key on member_id, the newer ones on
    # user_id — and guessing one for all of them returns an empty list rather
    # than an error, which is the failure that looks like "search is broken".
    dict(kind="person", collection="member_conversations", route="/app/messages",
         scope="member_id", fields=["name", "subtitle"], title="name", sub="subtitle",
         tag_field="kind"),
    dict(kind="booking", collection="bookings", route="/app/bookings",
         scope="member_id", fields=["service_name", "with_whom"], title="service_name",
         sub="with_whom", tag_field="status"),
    dict(kind="doc", collection="verification_documents", route="/app/documents",
         scope="user_id", fields=["original_name", "doc_type"], title="original_name",
         sub="doc_type", tag_field="status"),
    dict(kind="certificate", collection="certificates", route="/app/certificates",
         scope="user_id", fields=["program_name", "code"], title="program_name", sub="code"),
    dict(kind="enrolment", collection="enrollments", route="/app/programs",
         scope="member_id", fields=["program_name"], title="program_name", sub="status",
         tag_field="status"),
    dict(kind="money", collection="wallet_transactions", route="/app/wallet",
         scope="user_id", fields=["label", "source"], title="label", sub="source",
         tag_field="kind", amount="amount_minor"),
]

#: Things she can do, matched on the words she would use rather than on a
#: collection. An action is a result: "message Neha" should not make her find
#: Neha first and then hunt for the button.
_ACTIONS: list[dict[str, str]] = [
    dict(kind="do", title="Message someone", sub="Open a conversation",
         href="/app/messages", kw="message write reply chat talk baat sandesh"),
    dict(kind="do", title="Raise a safety alert", sub="Reaches the team straight away",
         href="/app/safety", kw="safety alert help emergency danger madad suraksha"),
    dict(kind="do", title="Ask Sakhi", sub="Any question, in your own words",
         href="/app/sakhi", kw="ask sakhi question help poochho sawal"),
    dict(kind="do", title="Add a document", sub="Aadhaar, PAN, bank or a registration",
         href="/app/documents", kw="add upload document aadhaar pan bank kagaz"),
    dict(kind="do", title="Book a session", sub="With a mentor or a service",
         href="/app/explore", kw="book session appointment mentor milna"),
    dict(kind="do", title="See your money", sub="What came in, what went out",
         href="/app/wallet", kw="money wallet balance paisa kamai earnings income"),
    dict(kind="do", title="Set your quiet hours", sub="Stop the phone at night",
         href="/app/settings/quiet-hours", kw="quiet hours night silent sona"),
]

#: What she might type, in the words she would actually use. A woman running a
#: tailoring business types "silai" long before she types "tailoring", and a
#: box that only speaks English tells her the app is not for her.
_ALSO: dict[str, str] = {
    "silai": "tailoring stitching", "\u0938\u093f\u0932\u093e\u0908": "tailoring stitching",
    "kapda": "cloth fabric", "\u0915\u092a\u0921\u093c\u093e": "cloth fabric",
    "paisa": "money payment", "\u092a\u0948\u0938\u093e": "money payment",
    "paise": "money payment", "rupaye": "money",
    "bachat": "savings circle", "\u092c\u091a\u0924": "savings circle",
    "kamai": "earnings income", "\u0915\u092e\u093e\u0908": "earnings income",
    "karza": "loan credit", "\u0915\u0930\u094d\u091c": "loan credit",
    "madad": "help safety", "\u092e\u0926\u0926": "help safety",
    "seekho": "course learn", "padhai": "course learn",
    "dukan": "shop product", "\u0926\u0941\u0915\u093e\u0928": "shop product",
    "grahak": "buyer customer order", "\u0917\u094d\u0930\u093e\u0939\u0915": "buyer customer order",
    "naukri": "work job opportunity", "kaam": "work job opportunity",
}


def _also(term: str) -> str | None:
    """The English she meant, when she did not type English."""
    low = term.lower()
    for k, v in _ALSO.items():
        if k in low:
            return v
    return None

#: The order results appear in. Deliberate, not scored: a woman searching on
#: this platform is far more often looking for work or a course than for a
#: helpline, and pretending an algorithm decided that would be dishonest.
_SOURCES: list[dict[str, Any]] = [
    dict(kind="work", collection=OpportunityModel.collection_name, route="/app/opportunities",
         fields=["title", "org", "skills"], title="title", sub="org",
         filter={"status": "open"}),
    # Without a status filter this returned archived programmes as live
    # results, and made the query a collection scan for want of an equality
    # prefix on the existing index.
    dict(kind="course", collection=ProgramModel.collection_name, route="/app/programs",
         fields=["name", "desc"], title="name", sub="category",
         filter={"status": {"$in": ["Running", "Upcoming"]}}),
    dict(kind="mentor", collection=MentorModel.collection_name, route="/app/mentors",
         fields=["name", "headline", "expertise"], title="name", sub="headline",
         filter={"status": "active"}),
    # Same again: a cancelled event was being offered as something to attend.
    dict(kind="event", collection=EventModel.collection_name, route="/app/events",
         fields=["title", "desc"], title="title", sub="location",
         filter={"status": {"$nin": ["cancelled", "Cancelled", "archived", "Archived"]}}),
    dict(kind="service", collection=ServiceModel.collection_name, route="/app/explore",
         fields=["name", "description"], title="name", sub="type",
         filter={"status": "Active"}),
    dict(kind="scheme", collection=ReferenceModel.collection_name, route="/app/support-fund",
         fields=["title", "body", "who"], title="title", sub="cost_label",
         filter={"topic": ReferenceModel.TOPIC_SCHEME, "status": "published"}),
    dict(kind="cover", collection=ReferenceModel.collection_name, route="/app/cover",
         fields=["title", "body"], title="title", sub="cost_label",
         filter={"topic": ReferenceModel.TOPIC_COVER, "status": "published"}),
    dict(kind="health", collection=ReferenceModel.collection_name, route="/app/health",
         fields=["title", "body"], title="title", sub="cost_label",
         filter={"topic": ReferenceModel.TOPIC_HEALTH, "status": "published"}),
    dict(kind="right", collection=ReferenceModel.collection_name, route="/app/rights",
         fields=["title", "body"], title="title", sub="cost_label",
         filter={"topic": ReferenceModel.TOPIC_RIGHTS, "status": "published"}),
]


@router.get("", response_model=SearchResults, summary="Search everything")
async def search(
    q: str = Query("", max_length=80),
    me: dict = Depends(require_active_member),
):
    started = time.perf_counter()
    term = q.strip()
    if len(term) < 2:
        # One letter matches everything, which is the same as matching nothing
        # and costs nine collection scans to find that out.
        return SearchResults(query=term, hits=[])

    # If she typed Hindi, search the English too — both, so "silai" finds the
    # tailoring course and a document actually named "silai" alike.
    english = _also(term)
    terms = [term] + ([english] if english else [])

    # Escaped, so a woman searching for "C++" or "50% off" gets results rather
    # than a 500 from an invalid regular expression — and so that nobody can
    # send `(a+)+$` and have Mongo spend ninety seconds per document on it.
    db = get_database()
    uid = str(me["_id"])

    def _or(fields: list[str]) -> list[dict]:
        # A translation is a phrase — "silai" becomes "tailoring stitching" —
        # and searching for that phrase literally matches nothing. Each word
        # is its own clause.
        # Two words at most, longest first. Every extra word multiplies by the
        # number of fields, and a five-word query was building forty regex
        # clauses per collection to find the same rows the first two found.
        words = sorted({w for t in terms for w in t.split() if len(w) > 1},
                       key=len, reverse=True)[:2]
        return [{f: mongosafe.contains(w)} for w in words for f in fields]

    async def _shared(src: dict[str, Any]) -> tuple[dict, list[dict]]:
        query = dict(src["filter"])
        query["$or"] = _or(src["fields"])
        return src, await db[src["collection"]].find(query).to_list(PER_KIND)

    async def _hers(src: dict[str, Any]) -> tuple[dict, list[dict]]:
        # Her id is part of the query, not a filter applied afterwards — the
        # database never returns another member's row in the first place.
        query = {src["scope"]: uid, "$or": _or(src["fields"])}
        return src, await db[src["collection"]].find(query).to_list(PER_KIND)

    # `low` only needs `terms`, which exists above — so the answer can be
    # fetched alongside the sources instead of after them. Awaiting it
    # separately cost a second round trip on every keystroke.
    low = " ".join(terms).lower()

    found_and_answer = await asyncio.gather(
        *[_shared(s) for s in _SOURCES],
        *[_hers(s) for s in _MINE],
        _answer(low, db, uid),
    )
    found, answer = found_and_answer[:-1], found_and_answer[-1]

    hits: list[SearchHit] = []
    mine_kinds = {s["kind"] for s in _MINE}
    for src, docs in found:
        for d in docs:
            kind = src["kind"]
            tag = str(d.get(src["tag_field"], "") or "") if src.get("tag_field") else ""
            amount = ""
            if src.get("amount"):
                # Minor units in the database, rupees on the screen — ADR-008.
                minor = d.get(src["amount"]) or 0
                sign = "+" if d.get("kind") == "credit" else "\u2212"
                amount = f"{sign}\u20b9{minor / 100:,.0f}"
            hits.append(SearchHit(
                id=str(d["_id"]),
                kind=kind,
                title=str(d.get(src["title"], "") or ""),
                sub=str(d.get(src["sub"], "") or ""),
                href=f"{src['route']}/{d['_id']}"
                     if kind in ("work", "course", "mentor", "event", "booking")
                     else src["route"],
                group="mine" if kind in mine_kinds else "app",
                amount=amount,
                tag=tag.title() if tag else "",
            ))

    # The same document uploaded three times is one answer to her question,
    # not three. Deduped per kind, keeping the first.
    seen: set[tuple[str, str]] = set()
    unique: list[SearchHit] = []
    for h in hits:
        key = (h.kind, h.title.strip().lower())
        if key in seen:
            continue
        seen.add(key)
        unique.append(h)
    hits = unique

    # Actions match on the words she would use for them, in either language.
    for a in _ACTIONS:
        if any(w and w in a["kw"] for w in low.split()):
            hits.append(SearchHit(id=a["href"], kind="do", title=a["title"], sub=a["sub"],
                                  href=a["href"], group="do"))

    # Hers first, then what she can do, then the catalogue.
    rank = {"mine": 0, "do": 1, "app": 2}
    hits.sort(key=lambda h: rank[h.group])

    took = (time.perf_counter() - started) * 1000
    return SearchResults(query=term, hits=hits, answer=answer, took_ms=round(took, 1))


async def _answer(low: str, db, uid: str) -> SearchAnswer | None:
    """
    Some questions have one true answer, and a list of links is a worse
    response than the number itself.
    """
    if not any(w in low for w in ("earn", "income", "money", "made", "balance", "wallet")):
        return None

    txns = await db["wallet_transactions"].find({"user_id": uid}).to_list(500)
    if not txns:
        return None

    now = datetime.now(timezone.utc)

    def _month(t: dict) -> bool:
        d = t.get("created_at")
        if not isinstance(d, datetime):
            return False
        return (d.year, d.month) == (now.year, now.month)

    # Amounts are stored in minor units, and "kind" says the direction — the
    # figure itself is always positive, so summing it without reading the kind
    # would report money leaving as money earned.
    inc = [t for t in txns if _month(t) and t.get("kind") == "credit"]
    out = [t for t in txns if _month(t) and t.get("kind") == "debit"]

    # A quiet month is a real answer, but "₹0" alone is not a useful one — so
    # when nothing has come in yet, say so and answer with the last month that
    # had something, labelled as that month rather than as this one.
    label = now.strftime("%B")
    lead = ""
    if not inc and not out:
        dated = [t for t in txns if isinstance(t.get("created_at"), datetime)]
        if not dated:
            return None
        last = max(dated, key=lambda t: t["created_at"])["created_at"]
        inc = [t for t in txns if t.get("kind") == "credit"
               and isinstance(t.get("created_at"), datetime)
               and (t["created_at"].year, t["created_at"].month) == (last.year, last.month)]
        out = [t for t in txns if t.get("kind") == "debit"
               and isinstance(t.get("created_at"), datetime)
               and (t["created_at"].year, t["created_at"].month) == (last.year, last.month)]
        label = last.strftime("%B")
        lead = f"Nothing yet in {now.strftime('%B')}. "

    earned = sum(t.get("amount_minor", 0) for t in inc) / 100
    spent = sum(t.get("amount_minor", 0) for t in out) / 100
    detail = (lead + f"From {len(inc)} payment{'s' if len(inc) != 1 else ''} in."
              + (f" \u20b9{spent:,.0f} went out." if out else ""))

    return SearchAnswer(
        label=label,
        value=f"\u20b9{earned:,.0f}",
        detail=detail,
        href="/app/wallet",
        action="Open your wallet",
    )
