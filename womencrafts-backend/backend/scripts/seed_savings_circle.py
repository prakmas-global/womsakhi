"""
One real savings circle, so the circle screens have something true to show.

The frontend has modelled a bachat gat since it was built — a monthly share,
a pot, and a turn order — while the backend only ever had discussion circles.
This makes one of the seeded circles an actual savings circle, gives its
members a turn each, and leaves this month unpaid so the pay screen has
something to do.

Run:  venv/bin/python -m scripts.seed_savings_circle
"""
import asyncio
from datetime import datetime, timezone

from app.db.mongodb import connect_db, get_database, close_db
from app.models.community import CircleModel


async def main() -> None:
    await connect_db()
    db = get_database()

    circle = await db["circles"].find_one({"is_savings": True})
    if not circle:
        # Prefer one that already reads as a savings group, so the name and the
        # behaviour agree.
        circle = await db["circles"].find_one(
            {"$or": [{"name": {"$regex": "saving|chit|bachat", "$options": "i"}},
                     {"topic": {"$regex": "saving|chit|bachat", "$options": "i"}}]}
        ) or await db["circles"].find_one({"status": "active"})

    if not circle:
        print("no circle to convert")
        return

    members = await db["circle_members"].find({"circle_id": str(circle["_id"])}).to_list(200)

    # Round 1 began three months ago, so the circle is in round 4 and has a
    # history rather than being brand new on every screen.
    started = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    started = started.replace(year=started.year - (1 if started.month <= 3 else 0),
                              month=(started.month - 3) % 12 or 12)

    await db["circles"].update_one(
        {"_id": circle["_id"]},
        {"$set": {"is_savings": True, "monthly_minor": 50000, "round_started_on": started}},
    )

    # A turn each, in joining order — what these circles do when nobody has
    # said otherwise.
    for i, m in enumerate(members, start=1):
        await db["circle_members"].update_one({"_id": m["_id"]}, {"$set": {"turn": i}})

    fresh = await db["circles"].find_one({"_id": circle["_id"]})
    print(f"savings circle: {fresh['name']}")
    print(f"  monthly:  ₹{fresh['monthly_minor'] // 100}")
    print(f"  round:    {CircleModel.round_of(fresh)}")
    print(f"  members:  {len(members)} (turns 1–{len(members)})")
    print(f"  pot:      ₹{fresh['monthly_minor'] * len(members) // 100}")
    await close_db()


if __name__ == "__main__":
    asyncio.run(main())
