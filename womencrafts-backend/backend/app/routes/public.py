"""
The handful of things anyone may read without an account.

Everything else in this API requires a session. These do not, because they are
read by the sign-in screen — before there is a session to have.

**Why this exists at all.** The sign-in page carried four headline figures
("10K+ Jobs Posted", "50K+ Members" and so on) that were typed into a constant
by hand. Every stats endpoint in this app is staff-authenticated, so there was
nothing for the page to read and the numbers were simply invented. A woman
deciding whether to trust a platform with a photograph of her Aadhaar card was
being shown made-up evidence that she should.

So these are the real counts, and they will be small until they are not. A true
small number is worth more here than a large false one — and the page falls back
to a promise rather than printing an unimpressive figure, so nothing has to be
exaggerated to look respectable.
"""

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, HTTPException, status

from app.core import cache
from app.core.media import media_url
from app.db.mongodb import get_database
from app.models.certificate import CertificateModel
from app.models.shop import ListingModel
from app.schemas.shop import ListingCard, PublicShop

router = APIRouter(prefix="/public", tags=["Public"])

#: Long, because these move slowly and this endpoint is unauthenticated — it is
#: the one surface a stranger can hit repeatedly, so it must not be a free way
#: to make the database work.
_TTL = 300.0


@router.get("/stats", summary="Real platform counts, for the sign-in page")
async def public_stats() -> dict:
    """
    Four counts, actually counted.

    Only what is already public on the platform: how many openings are live,
    how many courses are open to join, how many women are members, how many savings
    circles are running. No names, nothing about any individual.
    """

    async def produce() -> dict:
        db = get_database()
        # Only what a visitor would legitimately be told about. `members` is the
        # profile directory, which is the count of women who have actually
        # joined — `users` also holds staff logins.
        #
        # LIVE counts, not totals. This endpoint said "how many openings are
        # live" while counting every opportunity ever posted — 20, of which 12
        # were closed. A woman who reads "20 jobs" and finds 8 has been told a
        # true-sounding number that lied to her, which is the exact failure
        # this endpoint was written to end. Same for the other three: 10 of the
        # 28 courses have finished or are archived, and 9 of the 37 member
        # records are pending review, inactive or rejected.
        #
        # Casing differs per collection because the collections do: staff-side
        # records were seeded Title Case, member-side ones lower. Matching both
        # would hide a future rename, so each one matches what its own
        # collection actually stores.
        counts = {
            "jobs": await db["opportunities"].count_documents({"status": "open"}),
            "courses": await db["programs"].count_documents(
                {"status": {"$in": ["Running", "Upcoming"]}}
            ),
            # Minus the accounts our own check scripts create.
            # `checks/_shared.mjs::memberToken()` signs up `check.<timestamp>
            # @example.com`, approves it, and leaves it Active — and because
            # dev points at the SAME Atlas cluster as production, every browser
            # test run raised the member count on a public marketing page. Five
            # had accumulated in one afternoon. A number that goes up when
            # nobody joined is not a count, it is an artefact of our tooling.
            "members": await db["members"].count_documents(
                {"status": "Active", "email": {"$not": {"$regex": r"^check\."}}}
            ),
            "circles": await db["circles"].count_documents({"status": "active"}),
        }
        return counts

    return await cache.cached("public:stats", _TTL, produce)


@router.get("/auth-providers", summary="Which social sign-ins actually work")
async def auth_providers() -> dict:
    """
    What the sign-in page may offer.

    The comp has "Continue with Google" and "Continue with Apple". This backend
    has no OAuth of any kind, so both were buttons that could only ever answer a
    press by doing nothing — on the one screen where "nothing happened" reads as
    "this app is broken" and she leaves.

    The page now asks this first and renders only what is listed. Today that is
    an empty list, so the row does not appear at all. Wire a provider up, add it
    here, and the button returns by itself.
    """
    from app.core.config import settings

    available: list[str] = []
    # Each entry needs BOTH a working server flow and configured credentials.
    # Listing one without the other is how a dead button gets shipped.
    if getattr(settings, "GOOGLE_CLIENT_ID", "") and getattr(settings, "GOOGLE_CLIENT_SECRET", ""):
        available.append("google")
    if getattr(settings, "APPLE_CLIENT_ID", "") and getattr(settings, "APPLE_KEY_ID", ""):
        available.append("apple")
    return {"providers": available}


@router.get("/listings/{listing_id}", summary="One thing she sells, for a buyer with no account")
async def public_listing(listing_id: str) -> dict:
    """
    The page behind the link she sends on WhatsApp.

    **What was wrong.** "Share" on a listing in My Shop copied
    `<origin>/shop/<id>` and said *"Link copied — send it on WhatsApp"*. There
    was no `/shop/<id>` route: every one of those links was a 404 arriving in a
    customer's chat, under her name, from a button that had already told her it
    worked. A dead link to a buyer is worse than no share button at all.

    **Why unauthenticated.** The buyer is the whole point and the buyer has no
    account — she is a neighbour, a cousin, someone from the market. Requiring a
    sign-in to look at a ₹400 blouse is the same as having no link.

    **What it does not carry.** No phone number, no email, no order history, no
    seller id. A first name, and the place she typed on the listing herself.
    A paused or deleted listing is a 404 rather than a page saying "unavailable"
    — a buyer should not be shown something she cannot buy.
    """

    async def produce() -> dict:
        db = get_database()
        try:
            oid = ObjectId(listing_id)
        except (InvalidId, TypeError):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "That page is not here")
        doc = await db[ListingModel.collection_name].find_one({"_id": oid})
        if not doc or doc.get("status") == ListingModel.STATUS_PAUSED:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "That page is not here")

        row = ListingModel.to_response(doc)
        seller = None
        try:
            seller = await db["users"].find_one(
                {"_id": ObjectId(doc.get("user_id", ""))}, {"full_name": 1}
            )
        except (InvalidId, TypeError):
            seller = None
        full = (seller or {}).get("full_name", "").strip()
        return {
            "id": row["id"],
            "kind": row["kind"],
            "title": row["title"],
            "desc": row["desc"],
            "price_minor": row["price_minor"],
            "price_label": row["price_label"],
            "rate": row["rate"],
            "out_of_stock": row["out_of_stock"],
            "low_stock": row["low_stock"],
            "category": row["category"],
            "place": row["place"],
            "photo": media_url(row["photo"]),
            # A first name only. She is being shown to strangers here, and her
            # full name is not needed to sell a blouse to a neighbour.
            "seller_first": full.split(" ")[0] if full else "",
        }

    # Short, because a price or a stock count that is half a minute stale is
    # fine and a page a stranger can hammer must not be a free query.
    return await cache.cached(f"public:listing:{listing_id}", 30.0, produce)


@router.get("/shop/{handle}", response_model=PublicShop, summary="A woman's shop, by her handle")
async def public_shop(handle: str) -> PublicShop:
    """
    The page behind the link she shares on WhatsApp.

    **Why it exists.** The Collect screen's "Copy link" built
    `womsakhi.com/s/<handle>` from a FIXTURE, so every member in the app shared
    the same handle — `priya-tailoring` — and the page behind it resolved with
    `h === SHOP.handle ? SHOP : null`, which means every woman who was not the
    fixture sent her customers to "This shop is not here". Meanwhile
    `/shop/summary` returned `womsakhi.in/<member_id>`, a shape no route in the
    app could resolve at all. Three separate ideas of a handle, none of which
    reached a real shop.

    **A handle that does not exist is a 404, not an empty shop.** A stranger who
    follows a mistyped link must be told the shop is not there. A page saying
    "no items" about a woman who does not exist is a worse answer than nothing,
    because it reads as her having closed.

    **A shop with no live listings is NOT a 404.** She exists, she has paused
    everything, and the page can say so truthfully.

    **What it does not carry.** No phone, no email, no address, no order
    history, no member id, no user id, no surname — see `PublicShop`. And no way
    to pay: this platform cannot take a payment without holding her money, so
    buying is arranged between her and the buyer directly.

    **Why unauthenticated.** The buyer is the whole point and the buyer has no
    account — she is a neighbour, a cousin, someone from the market.
    """

    async def produce() -> PublicShop:
        db = get_database()
        slug = (handle or "").strip().lower()
        # The handle is matched exactly, never as a pattern: it arrives from a
        # URL a stranger controls, and a regex built from it would let one
        # request read every shop at once.
        owner = await db["users"].find_one(
            {"shop_handle": slug}, {"full_name": 1, "shop_handle": 1},
        ) if slug else None
        if not owner:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "This shop is not here")

        docs = await db[ListingModel.collection_name].find(
            {"user_id": str(owner["_id"]), "status": ListingModel.STATUS_LIVE},
        ).sort("updated_at", -1).to_list(120)

        rows = []
        for d in docs:
            row = ListingModel.to_response(d)
            row.pop("status", None)
            row.pop("views", None)
            row["photo"] = media_url(row["photo"])
            rows.append(ListingCard(**row))

        # Her trade and her place are not asked for anywhere — so they are read
        # off what she has already written on her own listings, and only when
        # they agree. The most common answer, or nothing.
        def commonest(field: str) -> str:
            counts: dict[str, int] = {}
            for d in docs:
                value = (d.get(field) or "").strip()
                if value:
                    counts[value] = counts.get(value, 0) + 1
            return max(counts, key=counts.get) if counts else ""

        full = (owner.get("full_name") or "").strip()
        return PublicShop(
            handle=owner.get("shop_handle", slug),
            # A first name only, exactly as `/public/listing` does. This link
            # gets forwarded to people she has never met.
            name=full.split(" ")[0] if full else "A WomSakhi member",
            trade=commonest("category"),
            place=commonest("place"),
            listings=rows,
            listing_count=len(rows),
        )

    # Short, because a price or a stock count half a minute stale is fine and a
    # page a stranger can hammer must not be a free query.
    return await cache.cached(f"public:shop:{handle}", 30.0, produce)


# ── an alert somebody was sent ───────────────────────────────────────────────
#
# WHY THIS IS PUBLIC
#
# A woman raises an alert and her trusted contacts are two phone numbers. There
# is no SMS provider, no WhatsApp and no voice line, so nothing in this system
# can reach them; `contacts_notified` only ever counted how many people she had
# named. What CAN reach them is her own phone — she forwards a link from
# whichever app she already uses, and it opens for whoever she sent it to.
#
# So these two must work with no account, on a borrowed phone, in one tap. Her
# sister is not going to sign up in the middle of it.
#
# WHAT GUARDS IT
#
# `share_token` — 256 bits, minted per alert. Holding the link is the whole
# permission, which is the point: it is meant to be forwarded. The alert id
# alone is not enough, because ids show up in logs and staff screens and this
# link is not.
#
# WHAT IS DELIBERATELY NOT HERE
#
# Her address, her phone number, her documents, her circles, her money. A link
# she forwards in a hurry can end up anywhere, so it carries only what somebody
# needs in order to help: her name, when she raised it, and what she typed.

from datetime import datetime, timezone   # noqa: E402

from pydantic import BaseModel            # noqa: E402

from app.models.safety import SafetyAlertModel   # noqa: E402


class AlertAck(BaseModel):
    #: What to call whoever pressed the button. Free text, never matched
    #: against her contacts: the person who picks it up may not be one of them.
    name: str = ""


async def _alert_by_token(alert_id: str, token: str) -> dict:
    if not token:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    try:
        oid = ObjectId(alert_id)
    except (InvalidId, TypeError):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    doc = await get_database()[SafetyAlertModel.collection_name].find_one(
        {"_id": oid, "share_token": token}
    )
    # The same 404 for a wrong id and a wrong token, so this cannot be used to
    # discover which alerts exist.
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    return doc


@router.get("/safety/alert/{alert_id}", summary="An alert somebody sent you")
async def shared_alert(alert_id: str, t: str = ""):
    doc = await _alert_by_token(alert_id, t)
    raised = doc.get("created_at")
    acks = doc.get("acknowledgements") or []
    return {
        "name": doc.get("member_name", ""),
        "note": doc.get("note", ""),
        "raised_at": raised.isoformat() if isinstance(raised, datetime) else "",
        "status": doc.get("status", "open"),
        # So the second person to open it knows somebody is already on it, and
        # the fifth does not think nobody is.
        "acknowledged_by": [a.get("name", "") for a in acks if a.get("name")],
        "acknowledged": bool(acks),
    }


@router.post("/safety/alert/{alert_id}/ack", summary="Tell her you have got it")
async def acknowledge_shared_alert(alert_id: str, body: AlertAck, t: str = ""):
    """
    The only thing on this record that counts as help arriving.

    Appends rather than replaces: several people may be on their way, and the
    one who arrives is not always the one who answered first.
    """
    doc = await _alert_by_token(alert_id, t)
    name = (body.name or "").strip()[:60]
    await get_database()[SafetyAlertModel.collection_name].update_one(
        {"_id": doc["_id"]},
        {
            "$push": {"acknowledgements": {
                "name": name,
                "at": datetime.now(timezone.utc),
            }},
            # Staff see this move the moment somebody answers, so an alert
            # nobody has picked up stays visibly unanswered.
            "$set": {"status": SafetyAlertModel.STATUS_ACKNOWLEDGED},
        },
    )
    return {"ok": True}


@router.get("/certificates/{code}", summary="Is this certificate real? For an employer with no account")
async def public_certificate(code: str) -> dict:
    """
    What the number on her certificate resolves to.

    `CertificateModel` says the code is public by design: an employer or an
    NGO checks it without an account. This is that check. It carries her
    first name, the programme, the date, and whether it still stands —
    nothing else. Not her member number, not her user id, not the grade.

    A revoked certificate answers `valid: false` rather than 404, because the
    person asking is holding a piece of paper that says otherwise and needs
    to be told so. A number that was never issued is a 404.
    """
    code = code.strip().upper()

    async def produce() -> dict:
        doc = await get_database()[CertificateModel.collection_name].find_one(
            {"code": code}, sort=[("issued_at", -1)]
        )
        if not doc:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "No certificate carries that number")
        row = CertificateModel.to_response(doc)
        full = (row["holder_name"] or "").strip()
        return {
            "code": row["code"],
            "holder_first": full.split(" ")[0] if full else "",
            "programme": row["program_name"],
            "issued_on": row["issued_on"],
            "valid": not row["revoked"],
        }

    # Short, and forgotten by admin_learning.py the moment a revoke lands, so
    # a withdrawn certificate never verifies for a minute after it shouldn't.
    return await cache.cached(f"public:cert:{code}", 60.0, produce)
