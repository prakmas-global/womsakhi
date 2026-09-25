"""
What AI is allowed to do here, and the wall it cannot cross.

The catalogue's architecture contract is one sentence: *"AI returns a
constrained proposal — approved content ID, allowed time window or concise
draft — then deterministic validation accepts, revises or rejects it."*

So every function below has the same shape. The model is asked for one of a
small set of answers, the answer is checked against rules written in Python,
and a rejected proposal falls back to a deterministic default. The model never
writes to the database, never picks a recipient, never moves a deadline and
never decides whether something is urgent.

**Three things it may never touch, and why each is a hard rule:**

- **Escalation and crisis wording.** CRISIS-UC-004. A model that is confident
  and wrong about risk is worse than no model, because it is trusted.
- **Safety deadlines.** They are elapsed time, agreed with her. A suggestion
  that shifts one by twenty minutes is a suggestion that she is found twenty
  minutes later.
- **Clinical thresholds and medication schedules.** Not from a guess, ever.

**And it must be optional.** AI-UC-008: with no API key, or with the provider
down, every caller here returns its deterministic default and the product
keeps working. That is why each returns a plain value rather than raising.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, time, timedelta, timezone

import httpx

from app.core.config import settings
from app.db.mongodb import get_database
from app.engines.schedule import parse_local_time, zone

# The window a suggested time must fall inside, whatever the model says.
EARLIEST = time(6, 0)
LATEST = time(21, 0)


def _db():
    return get_database()


def enabled() -> bool:
    return bool(settings.ANTHROPIC_API_KEY)


async def _ask(prompt: str, *, max_tokens: int = 200) -> str:
    """
    One call, short, and never fatal.

    Any failure returns an empty string, because every caller has a
    deterministic answer ready and a model outage must not remove a feature.
    """
    if not enabled():
        return ""
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            r = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": settings.ANTHROPIC_API_KEY,
                         "anthropic-version": "2023-06-01",
                         "content-type": "application/json"},
                json={"model": settings.AI_MODEL_ROUTING,
                      "max_tokens": max_tokens,
                      "messages": [{"role": "user", "content": prompt}]})
        r.raise_for_status()
        blocks = r.json().get("content") or []
        return "".join(b.get("text", "") for b in blocks).strip()
    except Exception:  # noqa: BLE001 - see the note above
        return ""


# ── 1 · suggest a time (REM-UC-007) ─────────────────────────────────────────

async def suggest_time(*, user_id: str, what: str,
                       tz_name: str = "Asia/Kolkata") -> dict:
    """
    Propose an hour for a reminder she is creating. Never set one.

    Returns `{"local_time", "why", "source"}`. The model's answer is parsed,
    clamped into her waking window and checked against her quiet hours; if any
    of that fails, the deterministic default stands. She still confirms it —
    this fills in a field, it does not commit a schedule.
    """
    fallback = {"local_time": "09:00", "why": "Morning, before the day starts",
                "source": "default"}
    if not enabled():
        return fallback

    prefs = await _db()["preference_versions"].find_one(
        {"user_id": user_id}, sort=[("version", -1)]) or {}
    quiet = prefs.get("quiet") or {}

    text = await _ask(
        "Suggest one time of day for this reminder, for a woman in India who "
        "works from home.\n"
        f"Reminder: {what}\n"
        f"She sleeps roughly {quiet.get('start', '21:30')} to "
        f"{quiet.get('end', '07:00')}.\n"
        'Answer ONLY as JSON: {"time":"HH:MM","why":"six words"}',
        max_tokens=100)
    if not text:
        return fallback

    try:
        m = re.search(r"\{.*\}", text, re.S)
        data = json.loads(m.group(0)) if m else {}
        proposed = parse_local_time(str(data.get("time", "")))
    except (ValueError, AttributeError, json.JSONDecodeError):
        return fallback

    # Deterministic validation. The model proposes; this decides.
    if not (EARLIEST <= proposed <= LATEST):
        return fallback
    q_start = parse_local_time(quiet.get("start") or "21:30")
    q_end = parse_local_time(quiet.get("end") or "07:00")
    in_quiet = (proposed >= q_start or proposed < q_end) if q_start > q_end \
        else (q_start <= proposed < q_end)
    if in_quiet:
        return fallback

    why = str(data.get("why", ""))[:60] or "Suggested"
    return {"local_time": proposed.strftime("%H:%M"), "why": why,
            "source": "suggested"}


# ── 2 · shorten a message in her language ───────────────────────────────────

async def shorten(*, text: str, locale: str = "en", limit: int = 90) -> str:
    """
    A shorter line for a small screen, in her language.

    Rejected and the original returned if the model comes back longer than the
    limit, empty, or with a different number of `{placeholders}` — that last
    check is what stops a "helpful" rewrite from dropping her name out of the
    sentence.
    """
    if not enabled() or len(text) <= limit:
        return text

    want = set(re.findall(r"\{[a-zA-Z0-9_]+\}", text))
    out = await _ask(
        f"Rewrite this notification in {locale}, under {limit} characters, "
        "plain and warm. Keep every {placeholder} exactly. Reply with the "
        f"rewritten line only.\n\n{text}", max_tokens=150)

    if not out or len(out) > limit:
        return text
    if set(re.findall(r"\{[a-zA-Z0-9_]+\}", out)) != want:
        return text
    return out


# ── 3 · rank what she opted into ────────────────────────────────────────────

async def rank(*, user_id: str, candidates: list[dict],
               budget: int) -> list[dict]:
    """
    Order material she has already opted into, and cut it to the budget.

    It may **reduce or suppress, never exceed** — §24.4. So the list is
    truncated to `budget` by this function regardless of what the model says,
    and a model that returns nonsense leaves the original order intact.

    Nothing new enters the list here: ranking is not selection, and a thing
    she did not opt into cannot be ranked into existence.
    """
    if len(candidates) <= budget:
        return candidates[:budget]
    if not enabled():
        return candidates[:budget]

    listing = "\n".join(
        f"{i}. {c.get('title', '')}" for i, c in enumerate(candidates[:20]))
    out = await _ask(
        "Order these by which is most useful to a woman building an income "
        f"from home. Reply ONLY with the numbers, most useful first, comma "
        f"separated.\n\n{listing}", max_tokens=60)

    order = [int(n) for n in re.findall(r"\d+", out or "")
             if int(n) < len(candidates)]
    seen, ranked = set(), []
    for i in order:
        if i not in seen:
            seen.add(i)
            ranked.append(candidates[i])
    for i, c in enumerate(candidates):
        if i not in seen:
            ranked.append(c)
    # The cut is ours, not the model's.
    return ranked[:budget]


# ── the wall ────────────────────────────────────────────────────────────────

def may_decide(kind: str) -> bool:
    """
    A single place that says no, so no future caller has to remember.

    Every one of these is a decision a model is confident about and wrong
    about at exactly the wrong moment.
    """
    return kind not in {
        "escalation",          # CRISIS-UC-004
        "risk_level",
        "crisis_wording",
        "safety_deadline",     # elapsed time, agreed with her
        "medication_schedule",
        "clinical_threshold",
        "recipient_selection",
        "stock_level",         # §24.5: AI does not invent a shortage
    }
