"""
Her store — the name, the pictures, and whether she is open for orders.

Kept on her account as `users.store`:

    {name, tagline, logo, cover, gallery, open, away_reason, back_on, closed_at, updated_at}

── Open and closed ──────────────────────────────────────────────────────────
`open` is the switch she flips. Closing can carry a day she is back
(`back_on`, a YYYY-MM-DD date); on that day the shop counts as open again
without her doing anything, so a woman who went to her mother's for a week is
not left closed for a month because she forgot. With no date she stays closed
until she opens it herself.

While she is closed:
* her listings leave the market's browse list;
* a listing opened from a saved or shared link says she is away, and an order
  for it is refused (409 `shop_closed`) — never taken and left waiting;
* her public shop page still shows what she makes, under an "away" note.
Orders she already has are untouched.

Every check goes through `is_open(user)`, so the auto-reopen is one rule.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Optional

from app.core.media import media_url

AWAY_REASONS = ["On holiday", "Festival time", "Not keeping well", "Too many orders", "Family function", "Taking a break"]


def _today() -> date:
    # India is the only market; the date she picks is an Indian date.
    return (datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)).date()


def _parse(day: str) -> Optional[date]:
    try:
        return date.fromisoformat((day or "")[:10])
    except ValueError:
        return None


def is_open(user: Optional[dict]) -> bool:
    store = (user or {}).get("store") or {}
    if store.get("open", True):
        return True
    back = _parse(store.get("back_on") or "")
    return back is not None and back <= _today()


def first_name(user: dict) -> str:
    full = (user.get("full_name") or "").strip()
    return full.split(" ")[0] if full else "A WomSakhi member"


def store_name(user: dict) -> str:
    """Her shop's name, or "<first name>'s shop" until she names it."""
    store = user.get("store") or {}
    return (store.get("name") or "").strip() or f"{first_name(user)}'s shop"


def view(user: dict) -> dict:
    """The store as the screens read it. `open` is the effective state."""
    store = user.get("store") or {}
    open_now = is_open(user)
    return {
        "name": (store.get("name") or "").strip(),
        "display_name": store_name(user),
        "tagline": store.get("tagline") or "",
        "logo": media_url(store.get("logo") or ""),
        "cover": media_url(store.get("cover") or ""),
        "gallery": [media_url(photo) for photo in (store.get("gallery") or []) if photo],
        "open": open_now,
        "away_reason": "" if open_now else (store.get("away_reason") or ""),
        "back_on": "" if open_now else (store.get("back_on") or ""),
    }


def away_line(user: dict) -> str:
    """What a buyer reads while she is closed."""
    v = view(user)
    if v["open"]:
        return ""
    back = _parse(v["back_on"])
    when = f" — back on {back.strftime('%d %b')}" if back else ""
    why = f" ({v['away_reason'].lower()})" if v["away_reason"] else ""
    return f"{v['display_name']} is not taking orders right now{why}{when}."


# Mongo filter for sellers whose shop is closed today — for the market's browse.
def closed_filter() -> dict:
    today = _today().isoformat()
    return {
        "store.open": False,
        "$or": [{"store.back_on": {"$in": [None, ""]}}, {"store.back_on": {"$exists": False}},
                {"store.back_on": {"$gt": today}}],
    }
