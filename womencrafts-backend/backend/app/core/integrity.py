"""
Referential integrity, declared in one place.

**Mongo has no foreign keys, and nothing here cascades on delete.** Nothing
enforces that `bookings.service_id` points at a service that exists, so deleting
a service leaves every booking for it pointing at nothing. Measured on
2026-08-30, in a seeded database with no real users: two already dangling — one
booking, one enrolment. With real members that number only grows, and each one
is a woman whose record renders as a blank or a crash.

**Why a declared graph rather than checks scattered through the routes.** A rule
written next to one delete endpoint is a rule the next delete endpoint does not
know about. There is one list of links below, one function that cleans up after
a delete, and one that audits the whole database — so adding a collection means
editing one place, and forgetting to is visible in the audit rather than silent.

Three ways a link can be resolved when its target dies:

  CASCADE  the row only exists because of its parent — a circle's members die
           with the circle, because "membership of a deleted circle" is not a
           thing that can be true.
  ORPHAN   the row is hers and survives — a wallet transaction is a record of
           money that actually moved, and deleting it to tidy up a reference
           would be falsifying her ledger. The pointer is cleared instead.
  BLOCK    the delete is refused. Nothing uses this yet; it is here because the
           day something must not be deletable, the rule belongs in this table
           rather than in an endpoint.

Run it:

    python -m app.core.integrity check     what is dangling right now
    python -m app.core.integrity repair    apply the rule for each one
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from bson import ObjectId

from app.db.mongodb import get_database

CASCADE = "cascade"
ORPHAN = "orphan"
BLOCK = "block"


@dataclass(frozen=True)
class Link:
    """`collection.field` points at `target._id`."""

    collection: str
    field: str
    target: str
    on_delete: str = CASCADE
    #: True when the field holds a list of ids rather than one.
    many: bool = False


#: Every link this database actually has. Order is irrelevant; `repair` resolves
#: cascades repeatedly until nothing changes, so a chain cleans up in one run.
LINKS: tuple[Link, ...] = (
    # Things that only exist because of their parent.
    Link("bookings", "service_id", "services", CASCADE),
    Link("enrollments", "program_id", "programs", CASCADE),
    Link("applications", "opportunity_id", "opportunities", CASCADE),
    Link("circle_members", "circle_id", "circles", CASCADE),
    Link("circle_posts", "circle_id", "circles", CASCADE),
    Link("post_replies", "post_id", "circle_posts", CASCADE),
    Link("event_registrations", "event_id", "events", CASCADE),
    Link("shop_reviews", "listing_id", "shop_listings", CASCADE),
    Link("group_buy_joiners", "group_buy_id", "group_buys", CASCADE),
    Link("assessment_attempts", "assessment_id", "assessments", CASCADE),
    Link("mentorship_requests", "mentor_id", "mentors", CASCADE),
    Link("verification_documents", "user_id", "users", CASCADE),
    Link("sakhi_messages", "conversation_id", "sakhi_conversations", CASCADE),
    Link("member_notifications", "user_id", "users", CASCADE),
    Link("member_messages", "user_id", "users", CASCADE),
    Link("email_tokens", "user_id", "users", CASCADE),
    Link("trusted_contacts", "user_id", "users", CASCADE),
    Link("reference_mine", "ref_id", "reference", CASCADE),
    Link("saved", "user_id", "users", CASCADE),

    # Records of things that really happened. The pointer goes; the row stays.
    Link("circle_contributions", "circle_id", "circles", ORPHAN),
    Link("shop_orders", "listing_id", "shop_listings", ORPHAN),
    Link("wallet_transactions", "user_id", "users", ORPHAN),
    Link("orders", "user_id", "users", ORPHAN),
    Link("certificates", "program_id", "programs", ORPHAN),
)


def _links_into(target: str) -> Iterable[Link]:
    return (l for l in LINKS if l.target == target)


def _as_object_id(value):
    try:
        return ObjectId(str(value))
    except Exception:  # noqa: BLE001 - a malformed id is itself a dangling one
        return None


async def cascade_delete(target: str, target_id) -> dict[str, int]:
    """
    Clean up after deleting one row. Call this from the delete endpoint.

    Returns what it touched, so an endpoint can report it and an audit line can
    say more than "deleted". Recurses one level for CASCADE links whose own
    children have links — a circle's posts have replies.
    """
    db = get_database()
    oid = _as_object_id(target_id)
    keys = [k for k in ({str(target_id), oid} if oid else {str(target_id)}) if k is not None]
    touched: dict[str, int] = {}

    for link in _links_into(target):
        query = {link.field: {"$in": keys}}
        if link.on_delete == ORPHAN:
            res = await db[link.collection].update_many(query, {"$set": {link.field: None}})
            if res.modified_count:
                touched[f"{link.collection}.{link.field} cleared"] = res.modified_count
            continue

        # CASCADE: take the children's own children with them before the
        # children are gone and their ids are unknowable.
        doomed = [d["_id"] async for d in db[link.collection].find(query, {"_id": 1})]
        for child_id in doomed:
            for grandchild in _links_into(link.collection):
                sub = await cascade_delete(link.collection, child_id)
                touched.update({k: touched.get(k, 0) + v for k, v in sub.items()})
                break  # one pass is enough; cascade_delete already recurses
        res = await db[link.collection].delete_many(query)
        if res.deleted_count:
            touched[f"{link.collection} deleted"] = res.deleted_count

    return touched


async def audit() -> list[dict]:
    """Every dangling reference in the database, with the rule that applies."""
    db = get_database()
    findings: list[dict] = []
    for link in LINKS:
        rows = [
            d async for d in db[link.collection]
            .find({link.field: {"$exists": True, "$nin": [None, ""]}}, {link.field: 1})
        ]
        if not rows:
            continue
        wanted = {oid for oid in (_as_object_id(r.get(link.field)) for r in rows) if oid}
        alive = {
            str(d["_id"]) async for d in db[link.target]
            .find({"_id": {"$in": list(wanted)}}, {"_id": 1})
        }
        bad = [r["_id"] for r in rows if str(r.get(link.field)) not in alive]
        if bad:
            findings.append({
                "collection": link.collection, "field": link.field, "target": link.target,
                "rule": link.on_delete, "count": len(bad), "ids": bad,
            })
    return findings


async def repair() -> dict[str, int]:
    """Apply each link's rule to what the audit found. Safe to re-run."""
    db = get_database()
    fixed: dict[str, int] = {}
    for finding in await audit():
        link = next(
            l for l in LINKS
            if l.collection == finding["collection"] and l.field == finding["field"]
        )
        ids = finding["ids"]
        if link.on_delete == ORPHAN:
            res = await db[link.collection].update_many(
                {"_id": {"$in": ids}}, {"$set": {link.field: None}}
            )
            fixed[f"{link.collection}.{link.field} cleared"] = res.modified_count
        else:
            res = await db[link.collection].delete_many({"_id": {"$in": ids}})
            fixed[f"{link.collection} deleted"] = res.deleted_count
    return fixed


def _cli(argv: list[str]) -> int:
    import asyncio

    command = (argv[0] if argv else "check").lower()

    async def run() -> int:
        from app.db.mongodb import connect_db

        await connect_db()
        if command == "check":
            findings = await audit()
            if not findings:
                print("  no dangling references")
                return 0
            total = sum(f["count"] for f in findings)
            print(f"  {total} dangling reference(s):\n")
            for f in findings:
                print(f"    {f['count']:>5}  {f['collection']}.{f['field']} → {f['target']}"
                      f"   (rule: {f['rule']})")
            print("\n  Fix with:  python -m app.core.integrity repair")
            return 1
        if command == "repair":
            fixed = await repair()
            if not fixed:
                print("  nothing to repair")
                return 0
            for what, n in fixed.items():
                print(f"  {n:>5}  {what}")
            left = sum(f["count"] for f in await audit())
            print(f"\n  {left} dangling reference(s) remaining")
            return 0 if left == 0 else 1
        print(__doc__.strip().splitlines()[0])
        print("\n  python -m app.core.integrity check")
        print("  python -m app.core.integrity repair")
        return 0

    return asyncio.run(run())


if __name__ == "__main__":  # pragma: no cover
    import sys

    raise SystemExit(_cli(sys.argv[1:]))
