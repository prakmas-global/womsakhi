"""
What a real conversation actually costs, per model.

Modelling this from a price table kept giving different answers depending on
assumptions nobody had measured, so this runs the same conversation through each
candidate model and totals what the API actually reports.

The thing being measured is not the per-token price. It is whether the prompt
CACHES: Haiku 4.5 does not cache a prefix under 4096 tokens, and Sakhi's is
about 3400, so every member turn has always paid full price for the whole tool
list. Sonnet 5 caches from 1024, so the same prefix is 10% of the price from the
second call onward — which can make the more expensive model the cheaper one.

    venv/bin/python scripts/bench_cost.py
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.llm.usage import PRICES  # noqa: E402

# A realistic sitting. The measured median is 13 API calls per user-hour, and
# one question is often two calls (the model reaches for a tool, then answers),
# so this is roughly what one woman's hour looks like.
TURNS = [
    "What programmes am I in?",
    "What should I charge for my work?",
    "Do I have any sessions booked?",
    "A customer has not paid me. What do I do?",
    "What certificates have I earned?",
    "How much money is in my wallet?",
    "What events are coming up?",
    "Is there any work I can apply for?",
    "What must I be careful about selling food from home?",
    "Who can mentor me on selling online?",
    "How many circles am I in?",
    "Am I allowed maternity leave?",
]


async def run(model: str) -> dict:
    from app.core.llm.claude import ClaudeProvider
    from app.core.llm.base import Message
    from app.core.sakhi.prompt import MEMBER_SYSTEM
    from app.core.sakhi.tools import MEMBER_TOOLS

    provider = ClaudeProvider()
    specs = [t.spec for t in MEMBER_TOOLS]
    history: list[Message] = []
    total = {"in": 0, "out": 0, "read": 0, "write": 0, "usd": 0.0, "calls": 0}
    price_in, price_out = PRICES.get(model, (5.00, 25.00))

    for text in TURNS:
        history.append(Message(role="user", content=text))
        turn = None
        async for ev in provider.astream(
            system=MEMBER_SYSTEM, messages=history, tools=specs,
            model=model, max_tokens=400,
        ):
            if ev.get("type") == "turn":
                turn = ev["turn"]
        if turn is None:
            continue
        u = turn.usage
        total["in"] += u.input_tokens
        total["out"] += u.output_tokens
        total["read"] += u.cache_read_tokens
        total["write"] += u.cache_write_tokens
        total["calls"] += 1
        total["usd"] += (
            u.input_tokens * price_in
            + u.output_tokens * price_out
            + u.cache_read_tokens * price_in * 0.1
            + u.cache_write_tokens * price_in * 1.25
        ) / 1_000_000
        history.append(Message(role="assistant", content=turn.text or "."))
    return total


async def main() -> int:
    results: dict[str, tuple[float, int]] = {}
    for model in ("claude-haiku-4-5", "claude-sonnet-5"):
        t = await run(model)
        n = max(t["calls"], 1)
        print(f"\n  {model}")
        print(f"    {t['calls']} calls over {len(TURNS)} questions")
        print(f"    input {t['in']:6}   cached-read {t['read']:6}   cache-write {t['write']:6}   output {t['out']:5}")
        cached = t["read"] / max(t["read"] + t["in"], 1)
        print(f"    served from cache: {100*cached:.0f}%")
        print(f"    total ${t['usd']:.5f}   per call ${t['usd']/n:.5f}")
        results[model] = (t["usd"], n)
    if len(results) == 2:
        (h, hn), (s_, sn) = results["claude-haiku-4-5"], results["claude-sonnet-5"]
        cheaper, dearer = ("Sonnet", "Haiku") if s_ < h else ("Haiku", "Sonnet")
        diff = abs(s_ - h) / max(h, s_) * 100
        print(f"\n  over this sitting: {cheaper} is {diff:.0f}% cheaper than {dearer}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
