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
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.core import mongosafe
from app.core.rbac import require_active_member
from app.db.mongodb import get_database
from app.models.growth import EventModel, MentorModel, OpportunityModel
from app.models.program import ProgramModel
from app.models.reference import ReferenceModel
from app.models.service import ServiceModel
from app.schemas.search import SearchHit, SearchResults

router = APIRouter(prefix="/search", tags=["Member"])

#: Per kind, so one big collection cannot crowd out the rest.
PER_KIND = 5

#: The order results appear in. Deliberate, not scored: a woman searching on
#: this platform is far more often looking for work or a course than for a
#: helpline, and pretending an algorithm decided that would be dishonest.
_SOURCES: list[dict[str, Any]] = [
    dict(kind="work", collection=OpportunityModel.collection_name, route="/app/opportunities",
         fields=["title", "org", "skills"], title="title", sub="org",
         filter={"status": "open"}),
    dict(kind="course", collection=ProgramModel.collection_name, route="/app/programs",
         fields=["name", "desc"], title="name", sub="category", filter={}),
    dict(kind="mentor", collection=MentorModel.collection_name, route="/app/mentors",
         fields=["name", "headline", "expertise"], title="name", sub="headline",
         filter={"status": "active"}),
    dict(kind="event", collection=EventModel.collection_name, route="/app/events",
         fields=["title", "desc"], title="title", sub="location", filter={}),
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
    term = q.strip()
    if len(term) < 2:
        # One letter matches everything, which is the same as matching nothing
        # and costs nine collection scans to find that out.
        return SearchResults(query=term, hits=[])

    # Escaped, so a woman searching for "C++" or "50% off" gets results rather
    # than a 500 from an invalid regular expression — and so that nobody can
    # send `(a+)+$` and have Mongo spend ninety seconds per document on it.
    # This was the one call site that got it right; `mongosafe` is that fix
    # made available to the other thirty-six, and using it here too means
    # there is one way to do this rather than two that agree today.
    rx = mongosafe.contains(term)
    db = get_database()

    async def _one(src: dict[str, Any]) -> tuple[dict, list[dict]]:
        query = dict(src["filter"])
        query["$or"] = [{f: rx} for f in src["fields"]]
        docs = await db[src["collection"]].find(query).to_list(PER_KIND)
        return src, docs

    found = await asyncio.gather(*[_one(s) for s in _SOURCES])

    hits: list[SearchHit] = []
    for src, docs in found:
        for d in docs:
            hits.append(SearchHit(
                id=str(d["_id"]),
                kind=src["kind"],
                title=str(d.get(src["title"], "")),
                sub=str(d.get(src["sub"], "") or ""),
                href=f"{src['route']}/{d['_id']}" if src["kind"] in ("work", "course", "mentor", "event")
                     else src["route"],
            ))
    return SearchResults(query=term, hits=hits)
