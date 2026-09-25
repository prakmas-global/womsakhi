"""
Proof of who she has been.

A record of standing: the things she has actually done, counted, so that a
shop, a landlord or a new circle in a new town has something to go on besides
her word.

── Why every count here is a count, never an estimate ──────────────────────
This is a document she hands to someone deciding whether to trust her. The
moment one number on it is generous, the whole page is worth nothing — and she
is the one standing there when it is checked.

So each figure below is a query against rows she created, and a figure with no
rows behind it is zero. Nothing is smoothed, nothing is rounded up, and there
is no "score".

── What this replaced ──────────────────────────────────────────────────────
A fixture. Fourteen pot rounds "never late", 87 finished orders, 11 returning
buyers, nine straight months with earnings and eight women vouching for her —
identical for every woman who opened the screen, under a heading that said
"proof you keep your word", on a page with a Share button.

── Nothing bad can be written here ─────────────────────────────────────────
There is no negative count and no way to add one. A record that could be
marked against her is a record she cannot afford to build, and it would turn
the whole module into a credit score by the back door.
"""

from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.core.rbac import require_active_member
from app.db.mongodb import get_database
from app.models.books import BookEntryModel
from app.models.community import CircleContributionModel, CircleMemberModel

router = APIRouter(prefix="/me/standing", tags=["Member · Journey"])


@router.get("", summary="Her record of standing, counted from her own rows")
async def standing(me: dict = Depends(require_active_member)):
    db = get_database()
    uid = str(me["_id"])

    paid = await db[BookEntryModel.collection_name].find(
        {"user_id": uid, "state": "paid"}
    ).to_list(5000)

    # Buyers who came back: anyone who paid her more than once. Names are
    # matched case-insensitively because she types them by hand each time.
    by_buyer: dict[str, int] = defaultdict(int)
    months: set[tuple[int, int]] = set()
    earliest: datetime | None = None
    for e in paid:
        who = str(e.get("who", "")).strip().lower()
        if who:
            by_buyer[who] += 1
        on = e.get("on")
        if isinstance(on, datetime):
            months.add((on.year, on.month))
            if earliest is None or on < earliest:
                earliest = on
    repeat = sum(1 for n in by_buyer.values() if n > 1)

    # Pot rounds she has paid into, and the women who are in a circle with her.
    contributions = await db[CircleContributionModel.collection_name].count_documents({"user_id": uid})

    mine = [m async for m in db[CircleMemberModel.collection_name].find({"user_id": uid})]
    circle_ids = [m.get("circle_id") for m in mine if m.get("circle_id")]
    vouch = 0
    if circle_ids:
        # Everyone in her circles except her. These are women who can be asked
        # about her by name, which is the whole point of the line.
        others = await db[CircleMemberModel.collection_name].distinct(
            "user_id", {"circle_id": {"$in": circle_ids}, "user_id": {"$ne": uid}}
        )
        vouch = len(others)

    since = earliest.strftime("%B %Y") if earliest else ""
    first_join = min((m.get("created_at") for m in mine if m.get("created_at")), default=None)
    circle_since = first_join.strftime("%B %Y") if isinstance(first_join, datetime) else ""

    proofs = [
        {"id": "p1", "label": "Paid into the pot, every round",
         "detail": f"{contributions} {'round' if contributions == 1 else 'rounds'}",
         "since": circle_since, "icon": "Coins",
         "tint": "--ux-tint-violet", "ink": "--ux-violet", "count": contributions},
        {"id": "p2", "label": "Orders finished", "detail": "Delivered and paid for",
         "since": since, "icon": "Package",
         "tint": "--ux-tint-green", "ink": "--ux-green-ink", "count": len(paid)},
        {"id": "p3", "label": "Buyers who came back", "detail": "Bought more than once",
         "since": since, "icon": "Repeat",
         "tint": "--ux-tint-blue", "ink": "--ux-blue-ink", "count": repeat},
        {"id": "p4", "label": "Months with earnings", "detail": "Counted from your books",
         "since": since, "icon": "TrendingUp",
         "tint": "--ux-tint-amber", "ink": "--ux-amber-ink", "count": len(months)},
        {"id": "p5", "label": "Women who vouch for you", "detail": "In your circle, by name",
         "since": circle_since, "icon": "Users",
         "tint": "--ux-tint-pink", "ink": "--ux-pink-ink", "count": vouch},
    ]

    # How long her record actually runs. The screen said "nine months" to
    # everyone, including a woman who joined last Tuesday.
    if earliest:
        now = datetime.now(timezone.utc)
        if earliest.tzinfo is None:
            earliest = earliest.replace(tzinfo=timezone.utc)
        span = max(1, (now.year - earliest.year) * 12 + now.month - earliest.month + 1)
    else:
        span = 0

    return {
        "proofs": proofs,
        "months": span,
        "since": since,
        # True only when there is something real to show. Below this the
        # screen offers no shareable record at all.
        "has_record": any(p["count"] > 0 for p in proofs),
    }
