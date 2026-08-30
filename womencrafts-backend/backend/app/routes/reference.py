"""
Schemes, cover, health, rights, childcare and getting about.

Six member screens, one router, because they ask the same question: *what is
available to a woman like me, near me, and what have I done about it?*

Two rules run through all of them, and they come from what actually stops
members using what they are entitled to:

**Say what is free.** Cost and not knowing are the two barriers — almost never
willingness. So `free` is a top-level, filterable fact and `?free_only=true` is
a supported query, not something the screen has to work out by reading strings.

**Near her, plus everywhere.** A national scheme applies to a woman in Jaipur;
so does an Anganwadi 800 metres away. One query returns both — `city ∈ {hers, *}`
— because two queries and a merge is two round trips, and this data is the same
for everyone in a city, so the shared half is cached.
"""

from __future__ import annotations

import asyncio
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core import cache
from app.core.rbac import require_active_member
from app.db.mongodb import get_database
from app.models.reference import MyReferenceModel, ReferenceModel
from app.schemas.reference import MarkRequest, ReferenceResponse

router = APIRouter(tags=["Member · What she is entitled to"])

#: Each topic gets its own path, because six screens with six names read better
#: than one endpoint with a query parameter — and because a URL that says what
#: it returns is easier to debug at three in the morning.
_PATHS = {
    "/schemes": ReferenceModel.TOPIC_SCHEME,
    "/cover": ReferenceModel.TOPIC_COVER,
    "/wellbeing/health": ReferenceModel.TOPIC_HEALTH,
    "/wellbeing/rights": ReferenceModel.TOPIC_RIGHTS,
    "/wellbeing/family": ReferenceModel.TOPIC_FAMILY,
    "/wellbeing/travel": ReferenceModel.TOPIC_TRAVEL,
}


def _ref():
    return get_database()[ReferenceModel.collection_name]


def _mine():
    return get_database()[MyReferenceModel.collection_name]


async def _entries(topic: str, city: str, uid: str, free_only: bool) -> list[ReferenceResponse]:
    query: dict = {
        "topic": topic,
        "status": ReferenceModel.STATUS_PUBLISHED,
        # Hers and everywhere, in one pass.
        "city": {"$in": [city, ReferenceModel.EVERYWHERE]},
    }
    if free_only:
        query["free"] = True

    async def _load() -> list[dict]:
        return await _ref().find(query).sort([("rank", 1), ("title", 1)]).to_list(200)

    # The list is the same for every woman in this city; what she has done about
    # each entry is hers alone. Shared half cached, personal half always fresh,
    # merged here — and both go together, so two queries cost one round trip.
    docs, mine_rows = await asyncio.gather(
        cache.cached(f"ref:{topic}:{city}:{int(free_only)}", cache.SHARED_TTL, _load),
        _mine().find({"user_id": uid, "topic": topic}).to_list(300),
    )
    mine = {r["ref_id"]: r for r in mine_rows}
    return [ReferenceResponse(**ReferenceModel.to_response(d, mine=mine.get(str(d["_id"])))) for d in docs]


def _register(path: str, topic: str, summary: str) -> None:
    @router.get(path, response_model=list[ReferenceResponse], summary=summary, name=f"list_{topic}")
    async def _list(  # noqa: ANN202 - the decorator publishes the signature
        city: Optional[str] = Query(None, description="Defaults to the city on her profile"),
        free_only: bool = Query(False, description="Only what costs her nothing"),
        me: dict = Depends(require_active_member),
    ):
        where = city or me.get("location") or ReferenceModel.EVERYWHERE
        return await _entries(topic, where, str(me["_id"]), free_only)


for _path, _topic in _PATHS.items():
    _register(_path, _topic, {
        ReferenceModel.TOPIC_SCHEME: "Money I may be owed",
        ReferenceModel.TOPIC_COVER: "Insurance and pension I could have",
        ReferenceModel.TOPIC_HEALTH: "Health checks and what is free",
        ReferenceModel.TOPIC_RIGHTS: "What the law gives me",
        ReferenceModel.TOPIC_FAMILY: "Childcare near me",
        ReferenceModel.TOPIC_TRAVEL: "Getting there, and what it should cost",
    }[_topic])


@router.post(
    "/reference/{ref_id}/mark",
    response_model=ReferenceResponse,
    summary="Record what I have done about this",
)
async def mark(ref_id: str, body: MarkRequest, me: dict = Depends(require_active_member)):
    if body.state not in MyReferenceModel.STATES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That is not a state we record")

    from app.core.serializers import to_object_id
    entry = await _ref().find_one({"_id": to_object_id(ref_id)})
    if not entry:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That is no longer listed")

    uid = str(me["_id"])
    now_doc = MyReferenceModel.create_document(
        user_id=uid, ref_id=ref_id, topic=entry.get("topic", ""), state=body.state, note=body.note,
    )
    # Upsert: pressing "applied" twice on a slow connection is one application,
    # and the second press must not fail in a way that looks like the first did.
    fresh = await _mine().find_one_and_update(
        {"user_id": uid, "ref_id": ref_id},
        {
            "$set": {"state": body.state, "note": body.note, "updated_at": now_doc["updated_at"]},
            "$setOnInsert": {
                "user_id": uid, "ref_id": ref_id,
                "topic": now_doc["topic"], "created_at": now_doc["created_at"],
            },
        },
        upsert=True,
        return_document=True,
    )
    return ReferenceResponse(**ReferenceModel.to_response(entry, mine=fresh))


# ── seed ───────────────────────────────────────────────────────────────────

#: Real Indian entitlements, not placeholders.
#:
#: This is the one module where invented content would be actively harmful: a
#: woman who walks into a bank asking for a scheme that does not exist has been
#: sent there by us. Every entry below is a real, current programme, with the
#: figure it actually pays and the paper it actually asks for. Where a number
#: could have changed, the entry says where to check rather than asserting it.
_SEED = [
    # ── Schemes ────────────────────────────────────────────────────────
    dict(topic="scheme", rank=10, title="Pradhan Mantri Mudra Yojana",
         who="Any woman running or starting a small business",
         body="A business loan with no collateral and no guarantor. Three tiers — Shishu up to "
              "₹50,000, Kishore up to ₹5 lakh, Tarun up to ₹10 lakh.",
         free=True, cost_label="No fee to apply",
         payload=dict(body_name="Government of India", amount="Up to ₹10 lakh", category="Loan",
                      deadline="Open all year",
                      needs=["Aadhaar", "PAN card", "Bank passbook", "Udyam registration"],
                      where="Any bank where you already have an account",
                      steps=["Ask for the Mudra form at your own bank branch",
                             "Take Aadhaar, PAN and your passbook",
                             "Ask for an acknowledgement slip with a reference number",
                             "Most decisions take three to six weeks"])),
    dict(topic="scheme", rank=20, title="Mahila Samman Savings Certificate",
         who="Any woman or girl, no income limit",
         body="A two-year deposit at a fixed rate, part of it withdrawable after a year.",
         free=True, cost_label="No fee",
         payload=dict(body_name="Post Office", amount="₹1,000 to ₹2 lakh", category="Savings",
                      deadline="Check current availability at the counter",
                      needs=["Aadhaar", "PAN card"], where="Any post office",
                      steps=["Ask at the post office counter for Form-I",
                             "Take Aadhaar and PAN", "Deposit by cash or cheque"])),
    dict(topic="scheme", rank=30, title="Stand-Up India",
         who="Women setting up a NEW manufacturing, services or trading business",
         body="A bank loan for a business you have not started yet. Not for one already trading.",
         free=True, cost_label="No fee to apply",
         payload=dict(body_name="Government of India", amount="₹10 lakh to ₹1 crore",
                      category="Loan", deadline="Open all year",
                      needs=["Aadhaar", "PAN card", "Project report", "Bank account"],
                      where="Any scheduled commercial bank branch")),
    dict(topic="scheme", rank=40, title="PM Vishwakarma",
         who="Women in eighteen traditional trades — tailoring, pottery, basket weaving and others",
         body="Tool money, skills training with a daily stipend, and a collateral-free loan after it.",
         free=True, cost_label="Free, and the training is paid",
         payload=dict(body_name="Government of India", amount="₹15,000 toolkit + loans to ₹3 lakh",
                      category="Grant", deadline="Open all year",
                      needs=["Aadhaar", "Bank account", "Proof of trade"],
                      where="A Common Service Centre")),

    # ── Insurance & pension ────────────────────────────────────────────
    dict(topic="cover", rank=10, title="Pradhan Mantri Suraksha Bima Yojana",
         who="Anyone 18–70 with a bank account",
         body="₹2 lakh if something happens to you, ₹1 lakh for partial disability.",
         free=False, cost_label="₹20 a year",
         payload=dict(kind="Accident", pays="₹2 lakh", renews="1 June each year",
                      steps=["Ask at the bank where you already have an account",
                             "Take Aadhaar and your passbook",
                             "Sign the auto-debit line so it cannot lapse without you noticing"])),
    dict(topic="cover", rank=20, title="Pradhan Mantri Jeevan Jyoti Bima Yojana",
         who="Anyone 18–50 with a bank account",
         body="₹2 lakh to your family. Renews each year until you are 55.",
         free=False, cost_label="₹436 a year",
         payload=dict(kind="Life", pays="₹2 lakh to your family", renews="1 June each year")),
    dict(topic="cover", rank=30, title="Atal Pension Yojana",
         who="Anyone 18–40 with a bank account",
         body="A guaranteed monthly pension from sixty. The younger you start, the less it costs.",
         free=False, cost_label="From ₹42 a month at eighteen",
         payload=dict(kind="Pension", pays="₹1,000–₹5,000 a month from sixty")),
    dict(topic="cover", rank=40, title="Ayushman Bharat — PM-JAY",
         who="Households on the SECC list",
         body="Hospital treatment with nothing to pay at the counter, at any empanelled hospital.",
         free=True, cost_label="Free if you qualify",
         payload=dict(kind="Health", pays="₹5 lakh of hospital treatment a year",
                      steps=["Check your name at pmjay.gov.in or any CSC",
                             "Get the Ayushman card made — it is free"])),

    # ── Health ─────────────────────────────────────────────────────────
    dict(topic="health", rank=10, title="Haemoglobin test",
         body="Half the women who take this one are anaemic and did not know. It takes a finger "
              "prick and five minutes.",
         free=True, cost_label="Free at any government health centre",
         payload=dict(every="Once a year", where="Primary Health Centre or an Anganwadi camp")),
    dict(topic="health", rank=20, title="Blood pressure check",
         body="No symptoms until it is serious. Two minutes, and any health centre will do it.",
         free=True, cost_label="Free", payload=dict(every="Every six months", where="Any PHC")),
    dict(topic="health", rank=30, title="Cervical cancer screening",
         body="Caught early it is almost always curable. Caught late it usually is not.",
         free=True, cost_label="Free for women over thirty",
         payload=dict(every="Every five years after thirty", where="District hospital")),
    dict(topic="health", rank=40, title="Iron and folic acid tablets",
         body="Free at every Anganwadi, for every woman of childbearing age. Most do not ask.",
         free=True, cost_label="Free", payload=dict(where="Your ward Anganwadi")),

    # ── Rights ─────────────────────────────────────────────────────────
    dict(topic="rights", rank=10, title="Equal pay for equal work",
         body="Paying a woman less than a man for the same work is illegal, whatever the trade.",
         payload=dict(law="Code on Wages, 2019",
                      what_to_do="Complain to the Labour Commissioner. It costs nothing.")),
    dict(topic="rights", rank=20, title="Maternity leave — 26 weeks, paid",
         body="For any workplace with ten or more people. It cannot be refused, and you cannot be "
              "dismissed for taking it.",
         payload=dict(law="Maternity Benefit (Amendment) Act, 2017",
                      what_to_do="Ask in writing and keep a copy")),
    dict(topic="rights", rank=30, title="A workplace free of harassment",
         body="Every workplace with ten or more people must have an Internal Committee, and you "
              "may complain to it.",
         payload=dict(law="POSH Act, 2013",
                      what_to_do="Complain in writing within three months. A local committee exists "
                                 "if your workplace is smaller.")),
    dict(topic="rights", rank=40, title="A free lawyer",
         body="Every woman in India is entitled to free legal aid, whatever she earns.",
         free=True, cost_label="Free",
         payload=dict(law="Legal Services Authorities Act, 1987",
                      what_to_do="Call 15100, any day, any time")),

    # ── Family & childcare ─────────────────────────────────────────────
    dict(topic="family", rank=10, title="Your ward Anganwadi",
         body="Free childcare, a hot meal, and immunisation for under-sixes. Every ward has one, "
              "and most women do not know theirs exists.",
         free=True, cost_label="Free, whatever you earn",
         payload=dict(ages="6 months – 6 years", hours="9am – 4pm", meals=True,
                      steps=["Ask any neighbour where the ward Anganwadi is",
                             "Take your child's Aadhaar and immunisation card"])),
    dict(topic="family", rank=20, title="Palna creche scheme",
         body="Day care for working mothers, subsidised. Longer hours than an Anganwadi.",
         free=False, cost_label="A small monthly fee, by income",
         payload=dict(ages="6 months – 6 years", hours="7:30am – 5:30pm", meals=True)),
    dict(topic="family", rank=30, title="Free immunisation",
         body="Every vaccine on the national schedule is free at any government centre.",
         free=True, cost_label="Free", payload=dict(where="Any PHC or Anganwadi")),

    # ── Getting about ──────────────────────────────────────────────────
    dict(topic="travel", rank=10, title="What an auto should actually cost",
         body="Insist on the meter. If it is refused, the fare table is on the back of the "
              "driver's seat and it is the law.",
         payload=dict(tip="Note the number plate before you get in and message it to someone")),
    dict(topic="travel", rank=20, title="Women's helpline — 181",
         body="Any hour, any day, anywhere in India. It is free from any phone, even one with no "
              "balance.",
         free=True, cost_label="Free",
         payload=dict(number="181", tip="Works with no balance and no SIM")),
    dict(topic="travel", rank=30, title="Travelling after dark",
         body="Sit near the driver or near other women. Tell one person where you are going and "
              "when you expect to be back.",
         payload=dict(tip="Share your journey from the Getting about screen before you leave")),
]


async def seed() -> None:
    """Fill the reference collection if empty. Never overwrites edited entries."""
    coll = _ref()
    if await coll.count_documents({}) > 0:
        return
    await coll.insert_many([ReferenceModel.create_document(**row) for row in _SEED])
