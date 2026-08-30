"""
Run the deep seed by hand.

    python3 scripts/seed_depth.py            # converge everything
    python3 scripts/seed_depth.py --report   # counts only, change nothing

Runs standalone so seeding does not require a server restart, and so the effect
of a fixture change can be seen immediately.
"""
import argparse, asyncio, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.mongodb import connect_db, get_database, close_db  # noqa: E402
from app.core import seed_depth  # noqa: E402

WATCH = [
    "services", "programs", "mentors", "circles", "circle_members", "circle_posts",
    "bookings", "enrollments", "certificates", "trusted_contacts",
    "wallet_transactions", "events", "event_registrations", "backups",
    "verification_documents", "members", "users",
]


async def counts():
    db = get_database()
    return {c: await db[c].count_documents({}) for c in WATCH}


async def main(report_only: bool) -> None:
    await connect_db()
    before = await counts()

    if not report_only:
        removed = await seed_depth.remove_check_accounts()
        if removed:
            print("  removed check accounts:",
                  ", ".join(f"{k}={v}" for k, v in sorted(removed.items())))
        else:
            print("  no check accounts to remove")

        if hasattr(seed_depth, "seed_depth_all"):
            await seed_depth.seed_depth_all()

    after = await counts()
    print(f"\n  {'collection':26} {'before':>7} {'after':>7}")
    for c in WATCH:
        arrow = "" if before[c] == after[c] else "  ←"
        print(f"  {c:26} {before[c]:>7} {after[c]:>7}{arrow}")
    await close_db()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", action="store_true", help="counts only, change nothing")
    asyncio.run(main(ap.parse_args().report))
