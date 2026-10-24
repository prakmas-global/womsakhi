"""
Haq's scheme catalogue — on the server, managed by staff.

── Why it moved here ───────────────────────────────────────────────────────
The catalogue used to be a constant in the app (components/ux/haq/data.ts):
seven schemes, Maharashtra's Ladki Bahin among them, shown to every woman in
every state. A scheme that changes — and they do, every budget — could not be
corrected without a release, and a woman in Assam was told about money she can
never claim.

It now reads the curated `reference` collection, topic "scheme" — the same rows
staff already publish, edit and archive at /admin/resources. Haq's own fields
ride in the entry's `payload`:

    haq_id        stable key her status is stored under (older statuses were
                  keyed "h1".."h7"; seeded rows keep those keys so nothing she
                  marked is lost)
    state         "all" or the name of one state / union territory
    eligibility   tags from ELIGIBILITY — who it is for, as tap questions
    papers        paper ids from her Papers list ("aadhaar", "bank", …)
    needs         the same documents in words, for any that are not papers
    amount_minor, amount, cadence, body_name, online, link, helpline,
    where, steps, open_now, open_note, category

Only `published` rows are shown. Nothing about any woman is stored here; where
her own claim stands stays in routes/haq.py.
"""

from __future__ import annotations

import re

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.rbac import require_active_member
from app.db.mongodb import get_database
from app.models.reference import ReferenceModel

router = APIRouter(prefix="/haq", tags=["Member · Rights"])

#: The states and union territories, for her dropdown and the `state` field.
STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
    "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
    "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
]

#: Who a scheme is for, asked as one tap each. A scheme with none is for anyone.
ELIGIBILITY = {
    "widow": "I am a widow",
    "pregnant": "I am pregnant, or have a baby under one",
    "daughter": "I have a daughter under ten",
    "senior": "A parent over 60 lives with me",
    "ration": "My family has a ration card",
    "business": "I run, or want to start, a small business",
    "craft": "I do a traditional craft — tailoring, pottery, weaving…",
    "lpg": "We cook on wood or coal, not gas",
}

#: Words in a document name → her Papers list, for rows that did not say.
_PAPER_WORDS = [
    ("aadhaar", "aadhaar"), ("bank", "bank"), ("passbook", "bank"), ("ration", "ration"),
    ("life cert", "life-cert"), ("mother and child", "mcp-card"), ("mcp", "mcp-card"),
    ("birth cert", "birth-cert"), ("age proof", "age-proof"),
]

#: Statuses that mean "she is getting it, or has applied" — for the count.
_CLAIMING = ["receiving", "at-risk", "waiting"]
#: Below this, a count could point at a person; say nothing.
MIN_TO_SHOW = 5


def _ref():
    return get_database()[ReferenceModel.collection_name]


def state_from(location: str) -> str:
    """The state named in a free-text location ("Kukatpally, Telangana"), or ""."""
    low = (location or "").casefold()
    for s in sorted(STATES, key=len, reverse=True):
        if re.search(rf"\b{re.escape(s.casefold())}\b", low):
            return s
    return ""


def _papers(payload: dict) -> list[str]:
    if payload.get("papers"):
        return [p for p in payload["papers"] if isinstance(p, str)]
    out: list[str] = []
    for need in payload.get("needs") or []:
        low = str(need).casefold()
        for word, pid in _PAPER_WORDS:
            if word in low and pid not in out:
                out.append(pid)
    return out


def scheme_out(doc: dict) -> dict:
    p = doc.get("payload") or {}
    return {
        "id": str(doc["_id"]),
        "key": p.get("haq_id") or str(doc["_id"]),
        "name": doc.get("title", ""),
        "body_name": p.get("body_name", ""),
        "gives": doc.get("body", ""),
        "who": doc.get("who", ""),
        "category": p.get("category", ""),
        "amount_minor": int(p.get("amount_minor") or 0),
        "amount": p.get("amount", ""),
        "cadence": p.get("cadence", ""),
        "state": p.get("state") or "all",
        "eligibility": [t for t in p.get("eligibility") or [] if t in ELIGIBILITY],
        "papers": _papers(p),
        "needs": [str(n) for n in p.get("needs") or []],
        "online": bool(p.get("online")),
        "link": p.get("link", ""),
        "helpline": p.get("helpline", ""),
        "where": p.get("where", ""),
        "steps": [str(s) for s in p.get("steps") or []],
        "open_now": p.get("open_now", True) is not False,
        "open_note": p.get("open_note", ""),
        "free": doc.get("free"),
        "cost_label": doc.get("cost_label", ""),
    }


def _for_state(state: str) -> dict:
    """Schemes for everyone, plus her state's. No state chosen: everyone's only."""
    everyone = [{"payload.state": {"$in": ["all", "", None]}}, {"payload.state": {"$exists": False}}]
    if state:
        everyone.append({"payload.state": {"$regex": f"^{re.escape(state)}$", "$options": "i"}})
    return {"topic": ReferenceModel.TOPIC_SCHEME,
            "status": {"$in": [ReferenceModel.STATUS_PUBLISHED, None]},
            "$or": everyone}


@router.get("/schemes", summary="Schemes for all of India, and for her state")
async def list_schemes(
    state: str = Query("", max_length=60, description="One of `states`; empty = all-India only"),
    _: dict = Depends(require_active_member),
):
    chosen = next((s for s in STATES if s.casefold() == state.strip().casefold()), "")
    docs = await _ref().find(_for_state(chosen)).sort([("rank", 1), ("title", 1)]).to_list(300)
    return {
        "state": chosen,
        "states": STATES,
        "eligibility": [{"key": k, "label": v} for k, v in ELIGIBILITY.items()],
        "schemes": [scheme_out(d) for d in docs],
    }


async def _find(key: str) -> dict | None:
    q = {"topic": ReferenceModel.TOPIC_SCHEME, "status": {"$in": [ReferenceModel.STATUS_PUBLISHED, None]}}
    doc = await _ref().find_one({**q, "payload.haq_id": key})
    if not doc and ObjectId.is_valid(key):
        doc = await _ref().find_one({**q, "_id": ObjectId(key)})
    return doc


@router.get("/schemes/{key}", summary="One scheme, and how many women here are claiming it")
async def get_scheme(key: str, _: dict = Depends(require_active_member)):
    doc = await _find(key)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That scheme is not in the list any more.")
    out = scheme_out(doc)
    k = out["key"]
    # Counted across members, shown only when it cannot point at one woman.
    n = 0
    if "." not in k and "$" not in k:
        n = await get_database()["haq_status"].count_documents({f"states.{k}.status": {"$in": _CLAIMING}})
    out["claiming"] = n if n >= MIN_TO_SHOW else None
    return out


# ── development seed ───────────────────────────────────────────────────────

_SEED = [
    dict(title="Ladki Bahin", rank=5, who="Women aged 21 to 65 living in Maharashtra",
         body="A monthly payment into her own bank account", free=True, cost_label="No fee",
         payload=dict(haq_id="h1", state="Maharashtra", body_name="Government of Maharashtra",
                      amount_minor=150000, amount="₹1,500", cadence="every month", category="Monthly money",
                      eligibility=[], papers=["aadhaar", "bank"],
                      needs=["Aadhaar", "Bank account linked to Aadhaar"], online=True,
                      link="https://ladakibahin.maharashtra.gov.in",
                      where="Online, or at the anganwadi or ward office",
                      steps=["Check your bank account is linked to Aadhaar",
                             "Apply on the portal or at the anganwadi",
                             "Finish e-KYC each year so the payment does not stop"])),
    dict(title="Widow pension", rank=6, who="Widows with a low household income",
         body="A monthly pension from the state", free=True, cost_label="No fee",
         payload=dict(haq_id="h2", state="all", body_name="State social welfare (NSAP)",
                      amount_minor=90000, amount="₹500–₹1,500 (by state)", cadence="every month",
                      category="Pension", eligibility=["widow"], papers=["aadhaar", "life-cert", "bank"],
                      needs=["Aadhaar", "Husband's death certificate", "Bank passbook", "Life certificate (yearly)"],
                      online=False, link="https://nsap.nic.in", where="Block or tehsil social welfare office",
                      steps=["Ask for the widow pension form at the block office",
                             "Attach the death certificate, Aadhaar and passbook",
                             "Give a life certificate every year — missing it stops the pension"])),
    dict(title="Maternity benefit (PMMVY)", rank=7, who="Pregnant women and new mothers",
         body="₹5,000 for a first child, in two parts", free=True, cost_label="No fee",
         payload=dict(haq_id="h3", state="all", body_name="Ministry of Women & Child Development",
                      amount_minor=500000, amount="₹5,000", cadence="once", category="Mother & child",
                      eligibility=["pregnant"], papers=["aadhaar", "bank", "mcp-card"],
                      needs=["Aadhaar", "Bank account", "Mother and child protection card"], online=True,
                      link="https://pmmvy.wcd.gov.in", where="Your anganwadi worker can apply with you",
                      steps=["Register the pregnancy at the anganwadi",
                             "Apply with your MCP card, Aadhaar and bank details",
                             "The second part comes after the first vaccinations"])),
    dict(title="Ujjwala gas connection", rank=8, who="Women in poor households without an LPG connection",
         body="A free gas connection, and a subsidy on refills", free=True, cost_label="Free connection",
         payload=dict(haq_id="h4", state="all", body_name="Ministry of Petroleum (PMUY)",
                      amount_minor=30000, amount="Subsidy on each refill", cadence="each refill",
                      category="Household", eligibility=["lpg", "ration"], papers=["aadhaar", "bank", "ration"],
                      needs=["Aadhaar", "Ration card", "Bank account"], online=True,
                      link="https://pmuy.gov.in", where="Any LPG distributor near you",
                      steps=["Apply online or at an LPG distributor",
                             "Give Aadhaar, ration card and bank details",
                             "The connection is in the woman's name"])),
    dict(title="Ration card food grain", rank=9, who="Families on the ration card list",
         body="Free or cheap grain for the household every month", free=True, cost_label="Free",
         payload=dict(haq_id="h5", state="all", body_name="Public Distribution System (NFSA)",
                      amount_minor=0, amount="Grain for the family", cadence="every month",
                      category="Food", eligibility=["ration"], papers=["aadhaar", "ration"],
                      needs=["Aadhaar", "Ration card"], online=False, link="https://nfsa.gov.in",
                      where="Your ration shop and the ration office",
                      steps=["Keep every family member's Aadhaar linked to the card",
                             "Re-verify the family list when asked, or names are removed",
                             "Complain at the ration office if you are refused"])),
    dict(title="Sukanya Samriddhi (girl child savings)", rank=10, who="Parents of a daughter under ten",
         body="A high-interest savings account in your daughter's name", free=True, cost_label="From ₹250 a year",
         payload=dict(haq_id="h6", state="all", body_name="Post Office / banks",
                      amount_minor=25000, amount="From ₹250 a year", cadence="you choose",
                      category="Savings", eligibility=["daughter"], papers=["aadhaar", "birth-cert"],
                      needs=["Daughter's birth certificate", "Your Aadhaar"], online=False,
                      link="https://www.indiapost.gov.in", where="Any post office or main bank branch",
                      steps=["Take her birth certificate and your Aadhaar to the post office",
                             "Open the account with as little as ₹250",
                             "Deposit any amount each year until she is 15"])),
    dict(title="Old age pension", rank=11, who="A parent over 60 in a poor household",
         body="A monthly pension for an older parent living with you", free=True, cost_label="No fee",
         payload=dict(haq_id="h7", state="all", body_name="State social welfare (NSAP)",
                      amount_minor=60000, amount="₹200–₹1,000 (by state)", cadence="every month",
                      category="Pension", eligibility=["senior"], papers=["aadhaar", "age-proof", "bank"],
                      needs=["Their Aadhaar", "Age proof", "Bank passbook"], online=False,
                      link="https://nsap.nic.in", where="Block or tehsil social welfare office",
                      steps=["Ask for the old age pension form at the block office",
                             "Attach age proof, Aadhaar and passbook",
                             "Ask for a receipt with a number to follow up"])),
]


async def seed() -> None:
    """Haq's schemes as reference rows — by title, so staff edits are never overwritten."""
    for row in _SEED:
        if await _ref().find_one({"topic": ReferenceModel.TOPIC_SCHEME, "title": row["title"]}, {"_id": 1}):
            continue
        await _ref().insert_one(ReferenceModel.create_document(topic=ReferenceModel.TOPIC_SCHEME, **row))
    # Existing reference schemes (loans, savings) are for everyone; say so once.
    await _ref().update_many(
        {"topic": ReferenceModel.TOPIC_SCHEME, "payload.state": {"$exists": False}},
        {"$set": {"payload.state": "all"}})
