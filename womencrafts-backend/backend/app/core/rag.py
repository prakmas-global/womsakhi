"""
Answering from the library, not just pointing at it.

`search_library` used to hand back a list of titles. A woman asking "what should
I charge?" got "here are three guides" — which is a search box wearing an
assistant's face. She still has to go and read them, on a phone, possibly in her
third language.

This retrieves the PASSAGES that answer her, so the model can reply in her own
words and say where it came from. That is the difference between a search result
and an answer.

── Why paragraphs, not whole articles ──────────────────────────────────────
A guide is a thousand words about pricing. Embed it whole and its meaning is an
average of everything in it, so the paragraph that actually answers "what do I
do when a customer bargains?" is diluted by nine others. Embedding paragraph by
paragraph keeps each idea findable on its own. It also keeps the model's context
small: three relevant paragraphs instead of three entire articles, which matters
on a request path measured in tokens.

── Why passages are returned rather than summarised here ───────────────────
The model does the summarising, in her language, in the reply she is already
reading. Summarising twice would cost a second call and lose the wording of the
source.
"""

from __future__ import annotations

import re
from typing import Any, Optional

from app.core import semantic
from app.core.plaintext import strip_markdown

# Paragraphs shorter than this are headings or one-liners; they are joined to
# the paragraph that follows rather than retrieved alone.
_MIN_WORDS = 18
_MAX_WORDS = 190


def _paragraphs(text: str) -> list[str]:
    # Cleaned here, not just before synthesis. The guides are written with bold
    # headings; hand those to the model and it quotes them back verbatim, and
    # the voice reads the asterisks out. Removing the formatting at the source
    # means there is nothing to copy.
    raw = [p.strip() for p in re.split(r"\n\s*\n", strip_markdown(text)) if p.strip()]
    out: list[str] = []
    for para in raw:
        para = re.sub(r"\s+", " ", para)
        if out and len(para.split()) < _MIN_WORDS:
            out[-1] = f"{out[-1]} {para}"
        elif out and len(out[-1].split()) < _MIN_WORDS:
            out[-1] = f"{out[-1]} {para}"
        else:
            out.append(para)
    # A very long paragraph is split on sentence ends rather than mid-thought.
    final: list[str] = []
    for para in out:
        words = para.split()
        if len(words) <= _MAX_WORDS:
            final.append(para)
            continue
        chunk: list[str] = []
        for sentence in re.split(r"(?<=[.!?])\s+", para):
            if chunk and len(" ".join(chunk).split()) + len(sentence.split()) > _MAX_WORDS:
                final.append(" ".join(chunk))
                chunk = []
            chunk.append(sentence)
        if chunk:
            final.append(" ".join(chunk))
    return final


def passages(docs: list[dict[str, Any]]) -> list[dict[str, str]]:
    """Every retrievable passage in the library, with the guide it came from."""
    out: list[dict[str, str]] = []
    for d in docs:
        title = d.get("title") or ""
        for para in _paragraphs(d.get("body") or ""):
            out.append({
                "title": title,
                "slug": d.get("slug") or "",
                # The title travels with the passage into the embedding. A
                # paragraph about "what to charge" does not contain the word
                # pricing; its heading does.
                "text": para,
                "embed": f"{title} — {para}",
            })
    return out


def search(query: str, docs: list[dict[str, Any]], k: int = 2,
           floor: float = 0.22) -> Optional[list[dict[str, str]]]:
    """The passages that answer `query`. None means fall back to titles.

    Two, not three. Every passage is billed in full on the next call — nothing
    about a tool result is cached — and three were 796 tokens. The third was
    almost never the one the answer came from.
    """
    if not query.strip():
        return None
    chunks = passages(docs)
    if not chunks:
        return None

    scored = semantic.score(query, [{"name": c["embed"]} for c in chunks])
    if scored is None:
        return None

    ranked = sorted(zip(chunks, scored), key=lambda p: p[1], reverse=True)
    # Below the floor a passage is noise. Handing the model an irrelevant
    # paragraph is worse than handing it nothing: it will try to use it.
    hits = [{**c, "score": round(s, 3)} for c, s in ranked[:k] if s >= floor]
    for h in hits:
        h.pop("embed", None)
    return hits
