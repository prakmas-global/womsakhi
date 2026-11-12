"""
Onboarding skills, read from the Work skills master.

Onboarding used to offer and accept only the hard-coded list in
app/core/skills.py, so a skill staff added in the dashboard (Work → Skills,
collections `work_categories` / `work_skills`, routes/work_talent.py) was never
offered to a woman joining, and was refused if sent. The master was seeded from
that same list with the same keys, so stored answers stay valid.

Onboarding's helpers are synchronous and called from many places, so this
keeps an in-process copy of the master:

* `await refresh()` reloads it (at most every `TTL` seconds); the onboarding
  router calls it before every request, and staff edits call `forget()`;
* `lookup(key)` knows every skill in the master, active or not, so a skill
  she already chose keeps counting after staff disable it;
* `search()` and `groups()` offer ACTIVE skills in ACTIVE categories only;
* until the first load (or if the database can't be read), everything falls
  back to the built-in list in app/core/skills.py.
"""

from __future__ import annotations

import time
from typing import Optional

from app.core import skills as builtin

TTL = 30.0

_skills: Optional[dict[str, dict]] = None      # key → entry, active or not
_groups: Optional[list[dict]] = None           # active categories, in order
_loaded_at = 0.0


def forget() -> None:
    global _loaded_at
    _loaded_at = 0.0


def _entry(s: dict, cats: dict[str, dict]) -> dict:
    group = s.get("category", "")
    cat = cats.get(group) or {}
    builtin_row = builtin.SKILLS_BY_KEY.get(s["key"]) or {}
    return {
        "key": s["key"], "label": s.get("name", ""), "group": group,
        "group_label": cat.get("name", ""), "popular": bool(s.get("popular")),
        # The shop service category a draft listing from this skill starts in.
        "service_category": builtin_row.get("service_category")
        or (builtin.GROUPS.get(group, ("", "Other"))[1]),
        "active": bool(s.get("active", True)) and bool(cat.get("active", True)),
    }


async def refresh(force: bool = False) -> None:
    global _skills, _groups, _loaded_at
    if not force and _skills is not None and time.monotonic() - _loaded_at < TTL:
        return
    try:
        from app.routes.work_talent import CATEGORIES, SKILLS, _ensure_seeded
        from app.db.mongodb import get_database

        await _ensure_seeded()
        db = get_database()
        cats = [c async for c in db[CATEGORIES].find({}).sort([("sort", 1), ("name", 1)])]
        rows = [s async for s in db[SKILLS].find({}).sort([("sort", 1), ("name", 1)])]
    except Exception:  # noqa: BLE001 — keep what we have (or the built-in list)
        return
    by_cat = {c["key"]: c for c in cats}
    _skills = {s["key"]: _entry(s, by_cat) for s in rows}
    _groups = [{"key": c["key"], "label": c.get("name", "")} for c in cats if c.get("active", True)]
    _loaded_at = time.monotonic()


def _all() -> dict[str, dict]:
    if _skills is not None:
        return _skills
    return {k: {**s, "active": True} for k, s in builtin.SKILLS_BY_KEY.items()}


def lookup(key: str) -> Optional[dict]:
    """Any skill the master knows (active or not), by key."""
    return _all().get(key)


def by_label(text: str) -> Optional[dict]:
    """An ACTIVE skill whose label is `text` (ignoring case and spacing)."""
    t = " ".join((text or "").split()).casefold()
    for s in _all().values():
        if s["active"] and s["label"].casefold() == t:
            return s
    return None


def groups() -> list[dict]:
    if _groups is not None:
        return _groups
    return [{"key": k, "label": v[0]} for k, v in builtin.GROUPS.items()]


def search(q: str = "", limit: int = 20) -> list[dict]:
    """Same ranking as skills.search, over the ACTIVE master skills."""
    pool = [s for s in _all().values() if s["active"]]
    needle = " ".join((q or "").split()).casefold()
    if not needle:
        return sorted(pool, key=lambda s: not s["popular"])[:limit]
    scored = []
    for i, s in enumerate(pool):
        label = s["label"].casefold()
        if label.startswith(needle):
            tier = 0
        elif any(w.startswith(needle) for w in label.split()) or s["key"].startswith(needle.replace(" ", "_")):
            tier = 1
        elif needle in label or needle in (s.get("group_label") or "").casefold():
            tier = 2
        else:
            continue
        scored.append((tier, not s["popular"], i, s))
    scored.sort(key=lambda t: t[:3])
    return [t[3] for t in scored[:limit]]
