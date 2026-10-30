"""
Circle topics and tags, read from the masters (app/core/masters.py).

A circle's topic must be an active `circle_topics` label. Words people used
before topics were a list ("Craft", "Careers", "Work & family") are folded
into a topic through that topic's synonyms, so an old app or an old link
still lands somewhere sensible instead of being refused. Only a word no topic
claims is refused.

Tags stay forgiving: a tag in the `circle_tags` master keeps the master's
spelling, a tag the circle already had is kept, and anything else is dropped
rather than refusing the whole save. Five at most.
"""

from __future__ import annotations

import re
from typing import Iterable

from app.core import masters


async def fold_topic(value: str, current: str = "") -> str:
    """The canonical topic label for `value`; "" stays "" (a circle may have no topic)."""
    v = " ".join((value or "").split())
    if not v:
        return ""
    if current and v.lower() == current.strip().lower():
        return current
    rows = await masters.rows("circle_topics", active_only=True)
    low = v.lower()
    for r in rows:
        if r["label"].lower() == low:
            return r["label"]
    for r in rows:
        if low in [s.lower() for s in (r.get("extra") or {}).get("synonyms") or []]:
            return r["label"]
    words = set(re.findall(r"[a-z]+", low))
    for r in rows:
        for syn in (r.get("extra") or {}).get("synonyms") or []:
            if " " not in syn and syn in words:
                return r["label"]
    return await masters.check("circle_topics", v, field="circle topic")


async def clean_tags(tags: Iterable[str], current: Iterable[str] = ()) -> list[str]:
    known = {l.lower(): l for l in await masters.labels("circle_tags")}
    had = {t.lower(): t for t in current or []}
    out: list[str] = []
    for t in tags or []:
        k = t.strip().lower().lstrip("#")
        if not k:
            continue
        keep = known.get(k) or had.get(k)
        if keep and keep not in out:
            out.append(keep)
    return out[:5]
