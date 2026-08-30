"""
Wallet and the support fund.

The balance is never stored as a number on the member. It is summed from the
ledger on every read, so the figure she sees and the transactions she can scroll
through are the same data — they cannot drift apart.

Credits are the platform's own money (refunds, referral thank-yous, granted
scholarships). They are not a wallet she can top up or cash out; that would make
us a payments company, which needs a licence we do not have.

**Fee help is ours; schemes are the government's.** `/wallet/fee-help` is her
asking US to cover a programme fee. The member app's `/app/support-fund` screen
lists government schemes, which we neither decide nor pay. The endpoint used to
be called `/wallet/support`, which read like both.
"""

import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import settings
from app.core.rbac import require_active_member
from app.db.mongodb import get_database
from app.models.conversation import notify
from app.models.goal import GoalModel
from app.models.wallet import SupportRequestModel, WalletTxnModel
from app.schemas.wallet import (
    SupportRequestCreate,
    SupportRequestResponse,
    WalletResponse,
)

router = APIRouter(prefix="/wallet", tags=["Member · Money"])

_SYMBOLS = {"INR": "₹", "USD": "$", "EUR": "€", "GBP": "£", "AED": "د.إ"}


def symbol() -> str:
    return _SYMBOLS.get(settings.PAYMENT_CURRENCY.upper(), settings.PAYMENT_CURRENCY.upper() + " ")


def _txns():
    return get_database()[WalletTxnModel.collection_name]


def _support():
    return get_database()[SupportRequestModel.collection_name]


async def balance_minor(user_id: str) -> int:
    """Sum the ledger. Credits add, debits subtract; never allowed below zero."""
    pipeline = [
        {"$match": {"user_id": user_id}},
        {
            "$group": {
                "_id": "$kind",
                "total": {"$sum": "$amount_minor"},
            }
        },
    ]
    rows = await _txns().aggregate(pipeline).to_list(10)
    totals = {r["_id"]: int(r["total"]) for r in rows}
    return max(
        totals.get(WalletTxnModel.KIND_CREDIT, 0) - totals.get(WalletTxnModel.KIND_DEBIT, 0),
        0,
    )


@router.get("", response_model=WalletResponse, summary="My balance and transactions")
async def my_wallet(me: dict = Depends(require_active_member)):
    """
    Her balance and her ledger, in one pass over the ledger.

    These were two requests — sum the transactions, then fetch the
    transactions — over the *same collection* with the *same match*. Against a
    cluster in another data centre that is two round trips of about 22ms each
    to read one set of rows twice. `$facet` runs both branches over a single
    `$match` and returns them in one document.

    Summing on the server rather than adding up `docs` here is deliberate and
    stays that way: the list is capped at 200 rows, so a woman with a longer
    history would have had her balance quietly computed from the visible page.
    A balance that is wrong for the members who used the platform most is worse
    than a balance that costs a query.
    """
    user_id = str(me["_id"])
    rows = await _txns().aggregate([
        {"$match": {"user_id": user_id}},
        {"$facet": {
            "totals": [{"$group": {"_id": "$kind", "total": {"$sum": "$amount_minor"}}}],
            "recent": [{"$sort": {"created_at": -1}}, {"$limit": 200}],
        }},
    ]).to_list(1)

    facet = rows[0] if rows else {}
    totals = {r["_id"]: int(r["total"]) for r in facet.get("totals", [])}
    total = max(
        totals.get(WalletTxnModel.KIND_CREDIT, 0) - totals.get(WalletTxnModel.KIND_DEBIT, 0),
        0,
    )
    docs = facet.get("recent", [])

    sym = symbol()
    return {
        "balance_minor": total,
        "balance_label": f"{sym}{total / 100:,.0f}",
        "currency": settings.PAYMENT_CURRENCY.upper(),
        "transactions": [WalletTxnModel.to_response(d, sym) for d in docs],
    }


# --- fee help ----------------------------------------------------------------
#
# This was `/wallet/support`, and the name was doing real damage.
#
# "Support" here means one specific thing: *she is asking us to help her pay for
# a programme*. It is our money, our decision, and an approval writes a
# scholarship credit into her wallet. But the member app also has a screen at
# `/app/support-fund` listing GOVERNMENT schemes she may be entitled to —
# nothing to do with us, nothing we decide, money we do not hold. Two different
# pots of money, two different answers to "who do I ask", one word.
#
# `/wallet/fee-help` says which one it is. The old path still answers, marked
# deprecated in the schema, because the frontend is being worked on in parallel
# and a rename that 404s callers is not a rename, it is an outage.

@router.get(
    "/fee-help",
    response_model=list[SupportRequestResponse],
    summary="My requests for help paying",
)
@router.get(
    "/support",
    response_model=list[SupportRequestResponse],
    summary="My requests for help paying (deprecated — use /wallet/fee-help)",
    deprecated=True,
)
async def my_support_requests(me: dict = Depends(require_active_member)):
    docs = await _support().find({"user_id": str(me["_id"])}).sort("created_at", -1).to_list(50)
    return [SupportRequestModel.to_response(d, symbol()) for d in docs]


@router.post(
    "/fee-help",
    response_model=SupportRequestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ask for help paying",
)
@router.post(
    "/support",
    response_model=SupportRequestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ask for help paying (deprecated — use /wallet/fee-help)",
    deprecated=True,
)
async def request_support(body: SupportRequestCreate, me: dict = Depends(require_active_member)):
    user_id = str(me["_id"])

    # One open request at a time. Several in flight helps nobody: staff can't
    # tell which is current, and she can't tell which one they answered.
    open_request = await _support().find_one(
        {"user_id": user_id, "status": SupportRequestModel.STATUS_PENDING}
    )
    if open_request:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "You already have a request with us. We'll come back to you on it soon.",
        )

    doc = SupportRequestModel.create_document(
        user_id=user_id,
        member_id=me.get("member_id", ""),
        member_name=me.get("full_name", ""),
        what_for=body.what_for,
        reason=body.reason,
        amount_needed_minor=int(round(body.amount_needed * 100)),
        household_income=body.household_income,
        dependants=body.dependants,
    )
    result = await _support().insert_one(doc)
    doc["_id"] = result.inserted_id

    db = get_database()
    await notify(
        db, user_id,
        "We've received your request",
        "Someone will look at it this week. Nothing about it is shared outside our team.",
        "account", "/app/support-fund",
    )
    return SupportRequestModel.to_response(doc, symbol())


# ── insights ───────────────────────────────────────────────────────────────

@router.get("/insights", summary="Where my money comes from, and the trend")
async def insights(me: dict = Depends(require_active_member)):
    """
    The rail on the Earn screen: sources, twelve months, and her goal.

    **One aggregation, not thirteen queries.** The obvious shape is a count per
    month; against a cluster in another data centre that is thirteen round
    trips for a chart. `$group` by year-month does it in one pass, and the
    twelve buckets are filled in here — including the empty ones, because a
    month with no earnings is information and a gap in the chart is a bug.
    """
    from collections import OrderedDict
    from datetime import timedelta

    uid = str(me["_id"])
    now = datetime.now(timezone.utc)
    twelve_ago = (now - timedelta(days=365)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    by_month, by_source, withdrawn, money_goal = await asyncio.gather(
        _txns().aggregate([
            {"$match": {"user_id": uid, "kind": WalletTxnModel.KIND_CREDIT,
                        "created_at": {"$gte": twelve_ago}}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m", "date": "$created_at"}},
                "total": {"$sum": "$amount_minor"},
            }},
        ]).to_list(24),
        _txns().aggregate([
            {"$match": {"user_id": uid, "kind": WalletTxnModel.KIND_CREDIT}},
            {"$group": {"_id": "$source", "total": {"$sum": "$amount_minor"}}},
            {"$sort": {"total": -1}},
        ]).to_list(20),
        _txns().aggregate([
            {"$match": {"user_id": uid, "kind": WalletTxnModel.KIND_DEBIT, "source": "payout"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount_minor"}}},
        ]).to_list(1),
        # Her money goal, gathered with the rest rather than after it — a
        # fourth concurrent query costs nothing on top of the slowest one,
        # a fourth sequential one costs another trip to Atlas.
        get_database()[GoalModel.collection_name].find_one(
            {"user_id": uid, "kind": GoalModel.KIND_MONEY, "status": GoalModel.STATUS_OPEN},
            sort=[("created_at", -1)],
        ),
    )

    found = {r["_id"]: int(r["total"]) for r in by_month}
    months: "OrderedDict[str, int]" = OrderedDict()
    cursor = twelve_ago
    while cursor <= now:
        months[cursor.strftime("%Y-%m")] = found.get(cursor.strftime("%Y-%m"), 0)
        cursor = (cursor.replace(day=28) + timedelta(days=4)).replace(day=1)

    values = list(months.values())[-12:]
    labels = [datetime.strptime(k, "%Y-%m").strftime("%b") for k in list(months)[-12:]]

    # A tone per source so the split chart is stable between loads — derived
    # from the source name, not assigned by position, which would reshuffle the
    # colours every time a new source appeared.
    TONES = ["--ux-brand-600", "--ux-green", "--ux-blue", "--ux-orange", "--ux-pink", "--ux-violet"]
    sources = [
        {"name": str(r["_id"] or "Other").replace("_", " ").title(),
         "minor": int(r["total"]),
         "tone": TONES[sum(ord(c) for c in str(r["_id"] or "")) % len(TONES)]}
        for r in by_source if int(r["total"]) > 0
    ]

    this_month = months.get(now.strftime("%Y-%m"), 0)
    return {
        "monthly_minor": values,
        "month_labels": labels,
        "sources": sources,
        "withdrawn_minor": int(withdrawn[0]["total"]) if withdrawn else 0,
        # A goal she has not set is not a goal. Null rather than an invented
        # target, so the screen can invite her to set one instead of showing
        # her progress towards a number she never chose.
        #
        # This used to read `earning_goal_minor` off the user document, a field
        # that predates the goals collection and that nothing has written since.
        # She could set five goals on the Goals screen and this rail would still
        # say she had none.
        "goal": (
            {"label": money_goal.get("label", ""),
             "target_minor": int(money_goal.get("target", 0)),
             "current_minor": this_month}
            if money_goal and int(money_goal.get("target", 0)) > 0 else None
        ),
    }
