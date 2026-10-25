"""
Usernames — one per woman, unique the way Instagram's are, hers to pick.

── The rules ────────────────────────────────────────────────────────────────
* 3 to 20 characters: small letters, numbers, "." and "_". At least one
  letter, no dot at either end, no two dots together. Stored lower-case, so
  "Priya.Sews" and "priya.sews" are the same name and only one woman holds it.
* Unique. The partial unique index `users.username_unique` is what decides a
  race; the check before it only makes the common case answer nicely.
* She can change it once every 90 days. The first time she sets one is free;
  every set stamps `username_changed_at`, and the next change opens 90 days
  after that.

── Which name other women see ───────────────────────────────────────────────
`display_name(user)` is the one rule: her username if she has set one,
otherwise the name on her account — the name staff checked against her papers
when they verified her. Every screen that shows one woman to another uses it.
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Optional

COOLDOWN_DAYS = 90
MIN_LEN, MAX_LEN = 3, 20

_SHAPE = re.compile(r"^[a-z0-9._]+$")

# Names that would let someone pass as staff, the app, or a helpline.
RESERVED = {
    "admin", "administrator", "root", "staff", "support", "help", "helpdesk", "helpline",
    "womsakhi", "womsakhiapp", "womsakhi_official", "official", "sakhi", "team", "moderator",
    "mod", "system", "security", "police", "bank", "upi", "paytm", "gpay", "phonepe",
    "verify", "verified", "account", "accounts", "me", "you", "null", "undefined",
}


def normalise(raw: str) -> str:
    """What she typed, as it would be stored: trimmed, no leading @, lower-case."""
    return (raw or "").strip().lstrip("@").lower()


def problem(name: str) -> Optional[str]:
    """Why `name` (already normalised) cannot be a username, or None if it can."""
    if len(name) < MIN_LEN:
        return f"Use at least {MIN_LEN} characters."
    if len(name) > MAX_LEN:
        return f"Use at most {MAX_LEN} characters."
    if not _SHAPE.match(name):
        return "Use only small letters, numbers, dots (.) and underscores (_)."
    if not re.search(r"[a-z]", name):
        return "Add at least one letter."
    if name.startswith(".") or name.endswith("."):
        return "A username cannot start or end with a dot."
    if ".." in name:
        return "Two dots cannot sit together."
    if reserved(name):
        return "That name is kept for WomSakhi. Try another."
    return None


# Words that make a name look official wherever they appear in it
# ("adminpriya", "womsakhi.help", "support_team").
_OFFICIAL = ("womsakhi", "admin", "official", "moderator", "helpline", "support", "staff")


def reserved(name: str) -> bool:
    return name in RESERVED or any(w in name for w in _OFFICIAL)


def display_name(user: dict) -> str:
    """The one name other members see: her username, else her verified account name."""
    return (user or {}).get("username") or (user or {}).get("full_name") or "A member"


def name_locked(user: dict) -> bool:
    """A verified member's name is the one staff read off her ID. Only staff
    change it after that; she changes her username instead."""
    user = user or {}
    return (user.get("role") or "") == "Member" and user.get("verification_status") == "active"


def _aware(d: Optional[datetime]) -> Optional[datetime]:
    if d is None:
        return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def next_change_at(user: dict) -> Optional[datetime]:
    """When she may change her username again; None means she may now."""
    last = _aware(user.get("username_changed_at"))
    if not user.get("username") or last is None:
        return None
    nxt = last + timedelta(days=COOLDOWN_DAYS)
    return nxt if nxt > datetime.now(timezone.utc) else None


def suggestions_from(full_name: str, taken: set[str], want: str = "") -> list[str]:
    """A few free names built from her own name — so she can tap one instead of typing."""
    parts = [re.sub(r"[^a-z0-9]", "", p) for p in (full_name or "").lower().split()]
    parts = [p for p in parts if p]
    want = normalise(want)
    if reserved(want):
        want = ""  # never build ideas on a name she was refused for looking official
    base = want or ".".join(parts[:2]) or "sakhi"
    base = re.sub(r"[^a-z0-9._]", "", base).strip(".")[: MAX_LEN - 4] or "sakhi"
    first = parts[0] if parts else base
    pool = [base, base.replace(".", "_"), f"{first}.sakhi", f"{base}{len(base)}",
            f"{first}_{(parts[1][:1] if len(parts) > 1 else 'w')}", f"the.{first}"]
    pool += [f"{base}{n}" for n in (1, 7, 21, 99, 108)]
    out: list[str] = []
    for c in pool:
        c = c[:MAX_LEN]
        if c not in taken and c not in out and problem(c) is None:
            out.append(c)
        if len(out) == 4:
            break
    return out
