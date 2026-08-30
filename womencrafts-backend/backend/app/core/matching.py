"""
Guided intake — turning "what do you need?" into real suggestions.

This is the AI seam of the product, built so it works TODAY without a model and
can be handed to one later without touching anything around it:

    match(text, needs, services, programs) -> ranked suggestions with reasons

The current implementation is transparent keyword scoring. Swapping in an LLM
means replacing the body of `rank()` — the inputs, the output shape and every
caller stay exactly as they are. Keeping a deterministic path also means the
feature degrades gracefully if a model is ever slow or unavailable, which
matters when the person asking is looking for help.
"""

from __future__ import annotations

import re
from typing import Iterable, Optional

from app.core import semantic

_MEANING_REASON = "Close to what you described"

# The needs a member picks from, in her words rather than ours. Each carries the
# vocabulary people actually use, and what in the catalogue tends to answer it.
NEEDS = [
    {
        "key": "earn",
        "label": "Earn an income",
        "hint": "Start earning with a skill",
        "keywords": [
            "money", "income", "earn", "job", "work", "salary", "employment",
            "kamana", "paisa", "naukri", "rozgar", "livelihood", "career",
        ],
        "service_types": ["Fashion", "Beauty", "Photography", "Digital"],
        "program_categories": ["Entrepreneurship", "Digital Literacy", "Handicrafts"],
    },
    {
        "key": "business",
        "label": "Start a business",
        "hint": "Turn an idea into something real",
        "keywords": [
            "business", "shop", "startup", "sell", "selling", "customers",
            "vyapar", "dukan", "entrepreneur", "own", "boutique", "orders",
        ],
        "service_types": ["Digital", "Photography"],
        "program_categories": ["Entrepreneurship", "Sustainability"],
    },
    {
        "key": "skill",
        "label": "Learn a skill",
        "hint": "Something practical, hands-on",
        "keywords": [
            "learn", "skill", "training", "course", "class", "teach", "sikhna",
            "stitching", "tailoring", "sewing", "mehndi", "makeup", "beauty",
            "craft", "handicraft", "photography", "design",
        ],
        "service_types": ["Fashion", "Beauty", "Photography"],
        "program_categories": ["Handicrafts", "Digital Literacy", "Sustainability"],
    },
    {
        "key": "digital",
        "label": "Get better with phone & computer",
        "hint": "Digital confidence",
        "keywords": [
            "computer", "phone", "mobile", "internet", "online", "digital",
            "whatsapp", "instagram", "marketing", "typing", "email", "app",
        ],
        "service_types": ["Digital"],
        "program_categories": ["Digital Literacy"],
    },
    {
        "key": "confidence",
        "label": "Build confidence",
        "hint": "Speak up, lead, decide",
        "keywords": [
            "confidence", "confident", "leadership", "lead", "speak", "shy",
            "self", "growth", "personality", "himmat", "decision", "voice",
        ],
        "service_types": [],
        "program_categories": ["Personal Development"],
    },
    {
        "key": "support",
        "label": "Talk to someone",
        "hint": "Guidance and a listening ear",
        "keywords": [
            "help", "support", "talk", "advice", "guidance", "counsel", "alone",
            "stress", "worried", "problem", "madad", "safe", "listen",
        ],
        "service_types": [],
        "program_categories": ["Personal Development"],
    },
]

NEEDS_BY_KEY = {n["key"]: n for n in NEEDS}


# Words that carry no intent. Without this, "Mentions and" shows up as a reason
# and any item sharing a filler word looks like a match.
STOPWORDS = {
    "and", "the", "for", "with", "you", "your", "want", "need", "like", "have",
    "how", "who", "what", "when", "where", "this", "that", "there", "here",
    "can", "will", "from", "about", "into", "out", "not", "but", "any", "all",
    "some", "more", "very", "just", "know", "get", "got", "make", "made",
    "hai", "hain", "kar", "karna", "mujhe", "mera", "meri", "apna", "apni",
    "women", "woman", "girl", "girls", "help",
}


def _words(text: str) -> set[str]:
    return {
        w
        for w in re.split(r"[^a-z0-9]+", (text or "").lower())
        if len(w) > 2 and w not in STOPWORDS
    }


def detect_needs(text: str) -> list[str]:
    """Which needs her own words point at, best first."""
    words = _words(text)
    if not words:
        return []
    scored = []
    for need in NEEDS:
        hits = len(words & set(need["keywords"]))
        if hits:
            scored.append((hits, need["key"]))
    scored.sort(reverse=True)
    return [key for _, key in scored]


def _score_item(
    item: dict,
    name_field: str,
    desc_field: str,
    type_field: str,
    matched_types: set[str],
    words: set[str],
) -> tuple[int, list[str]]:
    """
    Points, plus the human reasons behind them.

    Popularity only ever breaks ties — it can never qualify something on its own,
    or she gets shown a beauty course after asking about computers.
    """
    score = 0
    reasons: list[str] = []

    item_type = (item.get(type_field) or "").strip()
    if item_type and item_type in matched_types:
        score += 5
        reasons.append(f"Matches what you're looking for in {item_type.lower()}")

    haystack = _words(f"{item.get(name_field, '')} {item.get(desc_field, '')}")
    overlap = words & haystack
    if overlap:
        score += 2 * len(overlap)
        reasons.append(f"You mentioned {', '.join(sorted(overlap)[:2])}")

    # Nothing genuine matched — no score, no suggestion.
    if not reasons:
        return 0, []

    popularity = int(item.get("bookings") or item.get("enrolled") or 0)
    if popularity:
        score += min(3, popularity // 10)

    return score, reasons


def rank(
    text: str,
    needs: Iterable[str],
    services: list[dict],
    programs: list[dict],
    limit: int = 4,
) -> dict:
    """
    Rank the catalogue against what she told us.

    Returns {"needs": [...], "services": [...], "programs": [...]}, where each
    suggestion carries a `reason` — never show a recommendation you can't explain.
    """
    chosen = [n for n in needs if n in NEEDS_BY_KEY]
    if not chosen:
        chosen = detect_needs(text)
    # Nothing recognised: fall back to showing the most popular, honestly labelled.
    fallback = not chosen

    matched_service_types: set[str] = set()
    matched_program_categories: set[str] = set()
    for key in chosen:
        need = NEEDS_BY_KEY[key]
        matched_service_types.update(need["service_types"])
        matched_program_categories.update(need["program_categories"])

    words = _words(text)

    # Meaning first, keywords second.
    #
    # Keyword scoring alone got 19% on the evaluation set, and the failure was
    # not evenly spread: a sentence in Telugu, Tamil, Kannada, Bengali, Punjabi
    # or Urdu matched no keyword at all, fell to the fallback, and returned the
    # same default list whatever was asked. Embeddings take that to 76% — and,
    # more to the point, take her own script from 17% to 67%.
    #
    # The keyword score is still added rather than replaced. It carries the
    # `reason` shown to her, and an exact name match should still beat a merely
    # similar one. Semantic similarity sits on a 0..1 cosine, so it is scaled to
    # be decisive without erasing a strong literal hit.
    sem_services = semantic.score(text, services) if text.strip() else None
    sem_programs = semantic.score(text, programs) if text.strip() else None
    semantic_on = sem_services is not None

    # When meaning is available it decides the order on its own.
    #
    # Blending the keyword score in was tried and measured across weights, and
    # it only ever made things worse: at a low weight English fell from 89% to
    # 56%, and every weight high enough to stop the damage was, by definition,
    # ignoring keywords anyway. The keyword scorer ranks by broad need category,
    # so "earn money from home by stitching" fires `earn` and surfaces Beauty &
    # Makeup ahead of Tailoring. There is no weight at which that helps.
    #
    # It still earns its place as the fallback below, and its `reason` text is
    # kept when it has one, because "matches what you're looking for in
    # tailoring" says more to her than "close to what you described".
    def _rank(items, sem, name_key, desc_key, cat_key, wanted):
        out = []
        for idx, item in enumerate(items):
            kw_score, reasons = _score_item(item, name_key, desc_key, cat_key, wanted, words)
            if sem is not None:
                score = sem[idx]
            else:
                score = kw_score
                if fallback:
                    score += 1
                    reasons = ["Popular with women near you"]
            if score > 0:
                out.append((score, {**item, "reason": reasons[0] if reasons else _MEANING_REASON}))
        return out

    scored_services = _rank(services, sem_services, "name", "description", "type", matched_service_types)
    scored_programs = _rank(programs, sem_programs, "name", "desc", "category", matched_program_categories)

    scored_services.sort(key=lambda x: x[0], reverse=True)
    scored_programs.sort(key=lambda x: x[0], reverse=True)

    return {
        "needs": chosen,
        # `matched` says whether we understood her, not whether a keyword fired.
        # Understanding her sentence by meaning IS understanding her.
        "services": [item for _, item in scored_services[:limit]],
        "programs": [item for _, item in scored_programs[:limit]],
        "matched": semantic_on or not fallback,
    }
