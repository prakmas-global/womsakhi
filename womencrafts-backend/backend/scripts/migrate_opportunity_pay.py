"""
Lift the numbers out of `opportunities.pay`.

`pay` is free text — "₹14,000 – ₹18,000 / month", "₹180 per piece", "50%
revenue share, ₹25,000+ typical". A woman reads all of those correctly and the
database reads none of them, so the work board could not be filtered by what a
job pays, could not be sorted by it, and held rupees in a string on a platform
where every other amount is an integer in paise.

This writes `pay_low_minor`, `pay_high_minor` and `pay_period` beside the text.
The text is never touched: it is the only thing that says "+ travel" or "50%
revenue share", and dropping it to keep the numbers would be a worse trade.

**Why a period field.** ₹180 per piece against ₹15,000 per month sorts to
nonsense without one — the best-paying work on the board would be whatever
happened to quote a monthly figure. Anything that sorts must pin the period.

**Idempotent.** Re-running rewrites the same values. Pass --force to also
recompute rows that already have figures (after a parser change); by default
those are left alone so a hand-corrected band is not overwritten by the parser.

Run:  venv/bin/python -m scripts.migrate_opportunity_pay [--force] [--dry-run]
"""
import argparse
import asyncio
from collections import Counter

from app.db.mongodb import close_db, connect_db, get_database
from app.models.growth import OpportunityModel, parse_pay


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="Show what would change, write nothing")
    ap.add_argument("--force", action="store_true", help="Recompute rows that already have figures")
    args = ap.parse_args()

    await connect_db()
    db = get_database()
    coll = db[OpportunityModel.collection_name]

    docs = await coll.find({}).to_list(10000)
    print(f"{len(docs)} opportunities\n")

    updates = []
    periods: Counter = Counter()
    unparsed = []

    for d in docs:
        has_figures = d.get("pay_low_minor") is not None
        if has_figures and not args.force:
            periods[d.get("pay_period", "") or "(none)"] += 1
            continue

        text = d.get("pay", "") or ""
        low, high, period = parse_pay(text)
        periods[period or "(none)"] += 1
        if text and low == 0:
            # Money we could not read is worth seeing, not silently zeroing:
            # it is either a format the parser should learn or genuinely
            # unpaid work.
            unparsed.append((str(d["_id"]), text))

        # Two decimals under ₹100 — "₹1.20 per word" is 120 paise, and
        # printing it as "₹1" would make a correct migration look wrong.
        def money(m: int) -> str:
            return f"{m / 100:,.2f}" if 0 < m < 10000 else f"{m / 100:,.0f}"

        band = money(low) if low == high else f"{money(low)}–{money(high)}"
        print(f"  {text!r:44} -> ₹{band} / {period or '?'}   ({low}–{high} paise)")

        updates.append(
            {
                "_id": d["_id"],
                "pay_low_minor": low,
                "pay_high_minor": high,
                "pay_period": period,
            }
        )

    if unparsed:
        print(f"\n{len(unparsed)} row(s) with pay text but no readable figure:")
        for oid, text in unparsed:
            print(f"  {oid}  {text!r}")

    print("\nperiods:", dict(periods))

    if not updates:
        print("\nnothing to write — every row already has figures (use --force to redo)")
        await close_db()
        return

    if args.dry_run:
        print(f"\n--dry-run: {len(updates)} document(s) would be updated")
        await close_db()
        return

    # One bulk write, not one round trip per document. Atlas is in another data
    # centre; 20 rows would otherwise be 20 × ~50ms for no reason.
    from pymongo import UpdateOne

    result = await coll.bulk_write(
        [
            UpdateOne(
                {"_id": u.pop("_id")},
                {"$set": u},
            )
            for u in updates
        ]
    )
    print(f"\nupdated {result.modified_count} of {len(updates)} document(s)")
    await close_db()


if __name__ == "__main__":
    asyncio.run(main())
