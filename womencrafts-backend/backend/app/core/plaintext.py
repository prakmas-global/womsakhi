"""
Taking the formatting out of text meant to be heard or spoken back.

Markdown is for eyes. A voice reads "**" as "asterisk asterisk", and a woman
asking what to charge heard "asterisk asterisk What should I charge asterisk
asterisk" — because the library guides are written with bold headings, and the
model quotes them back exactly as it found them.

Two callers, one rule:

  * `rag` cleans retrieved passages before the model sees them, so there is
    nothing to copy in the first place.
  * `voice` cleans whatever reaches synthesis, whatever wrote it, because the
    model can still add formatting of its own.

Fixing only one of those leaves the other open, and the failure is silent — the
text on screen looks fine and only the audio is wrong.
"""

from __future__ import annotations

import re

_LINK = re.compile(r"\[([^\]]+)\]\([^)]*\)")            # [text](url) -> text
_EMPH = re.compile(r"(\*{1,3}|_{1,3})(?=\S)(.+?)(?<=\S)\1", re.S)
_HEAD = re.compile(r"^\s{0,3}#{1,6}\s*", re.M)
_BULLET = re.compile(r"^\s{0,3}[-*+•]\s+", re.M)
_NUM = re.compile(r"^\s{0,3}\d+[.)]\s+", re.M)
_CODE = re.compile(r"`{1,3}([^`]*)`{1,3}", re.S)
_RULE = re.compile(r"^\s*([-*_]\s*){3,}$", re.M)
_LEFTOVER = re.compile(r"[*_`#]+")
_GAPS = re.compile(r"\n{2,}")


def strip_markdown(text: str) -> str:
    """The same words, with the formatting removed. Leaves ₹, %, — alone."""
    out = _RULE.sub("", text or "")
    out = _LINK.sub(r"\1", out)
    out = _CODE.sub(r"\1", out)
    out = _HEAD.sub("", out)
    out = _BULLET.sub("", out)
    out = _NUM.sub("", out)
    for _ in range(3):                      # **bold _inside_ bold**
        out = _EMPH.sub(r"\2", out)
    out = _LEFTOVER.sub("", out)
    return _GAPS.sub("\n", out).strip()
