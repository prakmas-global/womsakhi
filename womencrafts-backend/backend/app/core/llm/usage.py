"""
What each answer cost, and the ceiling it is not allowed to cross.

Two locks, because either one can be misconfigured: the console has a spend
limit, and so do we. This is ours. A runaway loop or a bad prompt should stop
the assistant, not empty the account — and an assistant that stops still leaves
every screen in the app working, because Sakhi is an addition to the product,
never the only way through it.

Cost is computed from a table rather than read back from the API, so it is
known the moment a turn ends and can be charged against the month immediately.
Prices are per million tokens.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from app.core.config import settings
from app.core.llm.base import Usage

COLLECTION = "ai_usage"

# USD per 1M tokens: (input, output). Cache reads bill at a tenth of input,
# cache writes at 1.25x — the same shape for every model on the price list.
PRICES: dict[str, tuple[float, float]] = {
    "claude-opus-5": (5.00, 25.00),
    "claude-sonnet-5": (3.00, 15.00),
    "claude-haiku-4-5-20251001": (1.00, 5.00),
    "claude-haiku-4-5": (1.00, 5.00),
}
_FALLBACK_PRICE = (5.00, 25.00)


def cost_usd(model: str, usage: Usage) -> float:
    """What one turn cost. Unknown models are priced as the dearest we use, so
    a mistake here shows up as an early stop rather than a silent overspend."""
    price_in, price_out = PRICES.get(model, _FALLBACK_PRICE)
    million = 1_000_000
    return (
        usage.input_tokens * price_in / million
        + usage.output_tokens * price_out / million
        + usage.cache_read_tokens * (price_in * 0.1) / million
        + usage.cache_write_tokens * (price_in * 1.25) / million
    )


def _month_key(when: Optional[datetime] = None) -> str:
    when = when or datetime.now(timezone.utc)
    return when.strftime("%Y-%m")


async def record(db, *, user_id: str, model: str, usage: Usage, surface: str) -> float:
    """Write one line to the ledger and return what it cost."""
    amount = cost_usd(model, usage)
    await db[COLLECTION].insert_one({
        "user_id": user_id,
        "surface": surface,              # "member" | "staff" | "internal"
        "model": model,
        "month": _month_key(),
        "input_tokens": usage.input_tokens,
        "output_tokens": usage.output_tokens,
        "cache_read_tokens": usage.cache_read_tokens,
        "cache_write_tokens": usage.cache_write_tokens,
        "cost_usd": amount,
        "created_at": datetime.now(timezone.utc),
    })
    return amount


async def month_to_date_usd(db) -> float:
    cursor = db[COLLECTION].aggregate([
        {"$match": {"month": _month_key()}},
        {"$group": {"_id": None, "total": {"$sum": "$cost_usd"}}},
    ])
    rows = await cursor.to_list(length=1)
    return float(rows[0]["total"]) if rows else 0.0


async def budget_state(db) -> dict:
    spent = await month_to_date_usd(db)
    limit = float(settings.AI_MONTHLY_BUDGET_USD)
    return {
        "spent_usd": round(spent, 4),
        "limit_usd": limit,
        "remaining_usd": round(max(0.0, limit - spent), 4),
        "exhausted": spent >= limit,
        "month": _month_key(),
    }


async def within_budget(db) -> bool:
    state = await budget_state(db)
    return not state["exhausted"]
