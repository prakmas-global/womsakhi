"""
What Sakhi remembers about her between conversations.

Without this she is amnesiac by design: each conversation replays only its own
turns, so a woman who explained on Tuesday that she can only meet on Sundays
has to explain it again on Thursday. For someone typing slowly in her second
language, that is not a small tax.

Four rules shape what may be stored, and they are enforced here rather than
asked for in a prompt:

**Only durable facts.** "I can only meet on Sundays" is worth keeping. "What
sessions do I have?" is not. A memory store that fills with chatter stops being
useful and starts being a privacy liability with no upside.

**Never anything from a distress turn.** If the safety gate fired, that
conversation produced no memory at all. A woman who reached out in a crisis
should not find the app quietly repeating it back to her weeks later, and a
record of her worst day is the last thing that should sit in a database
enriching a prompt.

**Never identifiers.** No document numbers, no addresses, no phone numbers,
no anything that belongs in [[ADR-011 ID documents are never publicly reachable]].

**Hers to see and delete.** Every fact is listed in the app and removable one by
one or all at once. Memory the user cannot inspect is surveillance, whatever the
intent.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Optional

from app.core.llm import Message, get_llm
from app.core.llm.usage import record

COLLECTION = "sakhi_memory"

# How many facts ride along in the prompt. Kept small on purpose: the whole
# point is a short, relevant preamble, and an unbounded list would quietly grow
# into the most expensive part of every request.
RECALL_LIMIT = 12
MAX_FACT_CHARS = 160

# Things that must never be written down, however she phrased them.
_FORBIDDEN = re.compile(
    r"\b(?:\d[\d\s-]{7,}\d)\b"                 # phone / document numbers
    r"|\b[\w.+-]+@[\w-]+\.[\w.]+\b"            # email addresses
    r"|\b(?:aadhaar|aadhar|pan card|passport|account number|ifsc|upi id|password|otp)\b",
    re.I,
)

EXTRACT_SYSTEM = """You read one conversation between a woman and an assistant inside WomSakhi, and write down only what is worth remembering for NEXT time.

Keep a fact only if it is:
- durable — true next month, not just today
- about HER — what she wants, what constrains her, what she is working towards
- useful to an assistant helping her — it would change a suggestion

Examples worth keeping:
  "Can only attend sessions on Sundays"
  "Wants to start a tailoring business from home"
  "Is more comfortable reading Tamil than English"

Never write down:
- anything about violence, abuse, self-harm or a crisis — not one word
- phone numbers, document numbers, addresses, emails, passwords
- what she asked in passing, or anything the assistant did for her
- anything you inferred rather than were told

Most conversations produce NOTHING. That is the normal answer — return an empty list rather than reaching.

Return JSON only: {"facts": ["…", "…"]}. Each fact one short sentence, in English, written about her in the third person."""


def _collection(db):
    return db[COLLECTION]


def _clean(fact: str) -> Optional[str]:
    fact = " ".join((fact or "").split())[:MAX_FACT_CHARS]
    if len(fact) < 8:
        return None
    if _FORBIDDEN.search(fact):
        return None
    return fact


async def recall(db, user_id: str) -> list[dict]:
    """Her remembered facts, newest first."""
    cursor = _collection(db).find({"user_id": user_id}).sort("created_at", -1).limit(RECALL_LIMIT)
    return [
        {"id": str(d["_id"]), "fact": d.get("fact", ""), "created_at": d.get("created_at")}
        async for d in cursor
    ]


async def remember(db, user_id: str, facts: list[str], conversation_id: str = "") -> int:
    """Store new facts, skipping ones we already hold.

    Deduplication is on the exact cleaned string. It is deliberately dumb: a
    near-duplicate is harmless, and a clever matcher that silently merges two
    different constraints would be worse than a slightly repetitive list.
    """
    existing = {d["fact"] async for d in _collection(db).find({"user_id": user_id}, {"fact": 1})}
    fresh = []
    for raw in facts:
        fact = _clean(raw)
        if fact and fact not in existing:
            existing.add(fact)
            fresh.append({
                "user_id": user_id,
                "fact": fact,
                "conversation_id": conversation_id,
                "created_at": datetime.now(timezone.utc),
            })
    if fresh:
        await _collection(db).insert_many(fresh)
    return len(fresh)


async def forget(db, user_id: str, memory_id: Optional[str] = None) -> int:
    """Delete one fact, or all of them. Really deletes."""
    from app.core.serializers import to_object_id

    if memory_id:
        result = await _collection(db).delete_one(
            {"_id": to_object_id(memory_id), "user_id": user_id}
        )
    else:
        result = await _collection(db).delete_many({"user_id": user_id})
    return result.deleted_count


async def learn_from(db, *, user_id: str, conversation_id: str, transcript: str) -> int:
    """Read a finished exchange and keep anything durable.

    Runs on the cheap model, after her answer has already been sent — she never
    waits for this. A failure here is silent by design: not remembering
    something is a small loss, and an error thrown after the stream has closed
    would surface as a broken conversation for no reason.
    """
    if not transcript.strip():
        return 0
    try:
        turn = await get_llm().complete(
            system=EXTRACT_SYSTEM,
            messages=[Message(role="user", content=transcript[:6000])],
            max_tokens=400,
        )
        import json

        text = turn.text.strip()
        if text.startswith("```"):
            text = re.sub(r"^```[a-zA-Z]*\n?|\n?```$", "", text).strip()
        facts = json.loads(text).get("facts") or []
        if not isinstance(facts, list):
            return 0
        stored = await remember(db, user_id, [str(f) for f in facts], conversation_id)
        await record(db, user_id=user_id, model=turn.model, usage=turn.usage, surface="memory")
        return stored
    except Exception:
        return 0
