"""
Deep seed — enough data that every screen shows what it was designed to show.

## Why a second seeder

The original seeders fill a collection only if it is empty. That was the right
instinct — never clobber real data — but it has a failure mode: once a table has
a single row it never grows again. `bookings` sat at 1 for months, so "My
bookings" was empty for all 54 members, and the screen looked unfinished when it
was merely starving.

## Idempotent by construction

Every document written here carries a stable `seed_key`. Writes are upserts on
that key, so running this twice produces the same database as running it once,
and editing a fixture updates the row rather than adding a duplicate.

Documents *without* a `seed_key` are never touched. Anything a real person
created is invisible to this module.

## Convergent, not just additive

`prune` removes seeded rows whose key is no longer generated. Without it the
data only ever grows: reducing a fixture list would leave the old rows behind
and the collection would drift away from what the code says it contains.

## Deterministic

A fixed RNG seed, so the same fixtures produce the same dates, prices and
pairings on every machine. A screenshot taken today is comparable with one taken
next month, and a check that measures "12 upcoming bookings" keeps measuring 12.
"""

from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable

from app.db.mongodb import get_database

# Fixed so the seed is reproducible. Changing it reshuffles every generated
# pairing, which invalidates any check that counts rows — change deliberately.
RNG_SEED = 20260817

SEED_KEY = "seed_key"

# Accounts created by the automated checks. They sign up through the real API,
# so they are indistinguishable from members except by their address — and left
# alone they inflate the member directory a little more on every test run.
CHECK_ACCOUNT_PATTERNS = [
    r"^check\.\d+@example\.com$",
    r"^audit\.\d+@example\.com$",
    r"^contrast\.\d+@example\.com$",
    r"^layout\.test\.\d+@example\.com$",
    r"^sweep\.\d+@example\.com$",
    r"^rail\.\d+@example\.com$",
    r"^smooth\.\d+@example\.com$",
    r"^perm.*test.*@(example\.com|womsakhi\.com)$",
]


def now() -> datetime:
    return datetime.now(timezone.utc)


def rng() -> random.Random:
    """A fresh deterministic generator, so call order cannot leak between seeders."""
    return random.Random(RNG_SEED)


async def upsert_seeded(
    collection: str,
    docs: Iterable[dict[str, Any]],
    natural_key: list[str] | None = None,
) -> int:
    """
    Write each doc, keyed on `seed_key` — or on its NATURAL key when it has one.

    Several join tables carry a real uniqueness constraint: `enrollments` is
    unique on (user_id, program_id), `circle_members` on (user_id, circle_id).
    Matching only on `seed_key` meant a legacy row without one was invisible to
    the upsert, so the insert collided with the index and the whole seed died.

    Matching on the natural key updates whatever row already represents that
    fact, whoever wrote it, and the `seed_key` comes along in the payload. The
    database's own notion of identity wins over this module's bookkeeping.

    `$setOnInsert` protects `created_at` so re-running does not make every row
    look freshly created — which would scramble any screen that sorts by it.
    """
    db = get_database()
    written = 0
    for doc in docs:
        match = {k: doc[k] for k in natural_key} if natural_key else {SEED_KEY: doc[SEED_KEY]}
        payload = {k: v for k, v in doc.items() if k != "created_at"}
        payload["updated_at"] = now()
        await db[collection].update_one(
            match,
            {"$set": payload, "$setOnInsert": {"created_at": doc.get("created_at", now())}},
            upsert=True,
        )
        written += 1
    return written


async def prune(collection: str, keep_keys: set[str]) -> int:
    """
    Drop seeded rows this module no longer generates.

    Scoped to documents that carry a `seed_key`, so nothing a person created can
    be removed by shrinking a fixture list.
    """
    db = get_database()
    result = await db[collection].delete_many(
        {SEED_KEY: {"$exists": True, "$nin": list(keep_keys)}}
    )
    return result.deleted_count


async def adopt_legacy(collection: str, match_field: str, docs: list[dict[str, Any]]) -> int:
    """
    Claim pre-existing rows that this seed now owns, instead of duplicating them.

    The original seeders wrote rows with no `seed_key`. Seeding a fixture with
    the same name alongside one produces two "Beauty & Makeup" services — and
    worse, the old row is the one other records point at. A booking references
    a `service_id`; delete that row and the booking renders as a blank line.

    So the OLDEST matching row wins: it keeps its `_id`, and therefore every
    reference to it, and simply gains the `seed_key`. Any younger twin is
    removed. Adoption preserves history; deletion would break it.
    """
    db = get_database()
    adopted = 0
    for doc in docs:
        value = doc.get(match_field)
        if value is None:
            continue
        rows = await db[collection].find({match_field: value}).sort("created_at", 1).to_list(length=None)
        if not rows:
            continue
        keeper, twins = rows[0], rows[1:]
        if keeper.get(SEED_KEY) != doc[SEED_KEY]:
            await db[collection].update_one({"_id": keeper["_id"]}, {"$set": {SEED_KEY: doc[SEED_KEY]}})
            adopted += 1
        if twins:
            await db[collection].delete_many({"_id": {"$in": [t["_id"] for t in twins]}})
    return adopted


async def converge(
    collection: str,
    docs: list[dict[str, Any]],
    natural_key: list[str] | None = None,
) -> tuple[int, int]:
    """Upsert this set and remove any seeded row outside it."""
    written = await upsert_seeded(collection, docs, natural_key)
    removed = await prune(collection, {d[SEED_KEY] for d in docs})
    return written, removed


# --------------------------------------------------------------------------- #
# B1 — remove accounts the automated checks created
# --------------------------------------------------------------------------- #

async def remove_check_accounts() -> dict[str, int]:
    """
    Delete accounts the browser checks signed up, and everything hanging off them.

    They are created through the real signup endpoint on purpose — testing as a
    genuine member is the only way to catch what a seeded admin cannot. The cost
    is that each run leaves a real account behind, and the member directory grows
    by one every time anybody runs the suite.

    Anything referencing the removed users goes too; a booking whose member no
    longer exists renders as a blank row rather than an error, which is worse
    than either outcome because nobody notices it.
    """
    db = get_database()
    pattern = "|".join(CHECK_ACCOUNT_PATTERNS)

    users = await db["users"].find({"email": {"$regex": pattern}}).to_list(length=None)
    members = await db["members"].find({"email": {"$regex": pattern}}).to_list(length=None)

    user_ids = [str(u["_id"]) for u in users]
    member_ids = [str(m["_id"]) for m in members]
    removed: dict[str, int] = {}

    dependents = [
        "bookings", "enrollments", "circle_members", "event_registrations",
        "wallet_transactions", "certificates", "trusted_contacts",
        "member_notifications", "conversations", "member_messages",
        "applications", "mentorship_requests", "safety_alerts", "safety_reports",
        "support_requests", "user_layouts", "verification_documents", "sessions",
    ]
    for coll in dependents:
        r = await db[coll].delete_many(
            {"$or": [{"user_id": {"$in": user_ids}}, {"member_id": {"$in": member_ids}}]}
        )
        if r.deleted_count:
            removed[coll] = r.deleted_count

    for coll, ids in (("users", users), ("members", members)):
        if ids:
            r = await db[coll].delete_many({"_id": {"$in": [d["_id"] for d in ids]}})
            removed[coll] = r.deleted_count

    return removed


# --------------------------------------------------------------------------- #
# B2 — the catalogue: what a member can book, learn and who can teach her
# --------------------------------------------------------------------------- #

# Services a member can book. Drawn from what the platform's members actually
# do — tailoring, beauty, food, crafts, and the digital and business skills that
# turn any of those into an income.
SERVICES: list[tuple[str, str, str, int, int, float]] = [
    # (name, type, tone, minutes, rupees, rating)
    ("Tailoring & Stitching", "Tailoring", "brand", 60, 499, 4.9),
    ("Blouse Fitting & Alterations", "Tailoring", "brand", 45, 349, 4.7),
    ("Saree Draping & Finishing", "Tailoring", "brand", 45, 399, 4.6),
    ("Pattern Making Basics", "Tailoring", "brand", 90, 649, 4.5),
    ("Embroidery — Hand", "Handicrafts", "amber", 90, 599, 4.8),
    ("Embroidery — Machine", "Handicrafts", "amber", 90, 699, 4.6),
    ("Crochet & Knitting", "Handicrafts", "amber", 60, 449, 4.7),
    ("Block Printing", "Handicrafts", "amber", 120, 899, 4.8),
    ("Tie & Dye / Bandhani", "Handicrafts", "amber", 120, 849, 4.6),
    ("Jewellery Making", "Handicrafts", "amber", 90, 749, 4.7),
    ("Candle & Soap Making", "Handicrafts", "amber", 90, 649, 4.5),
    ("Beauty & Makeup", "Beauty", "violet", 90, 899, 4.8),
    ("Bridal Makeup Masterclass", "Beauty", "violet", 180, 2499, 4.9),
    ("Mehndi Design", "Beauty", "violet", 45, 299, 4.7),
    ("Hair Styling Basics", "Beauty", "violet", 60, 549, 4.5),
    ("Threading & Facial", "Beauty", "violet", 60, 399, 4.4),
    ("Home Cooking for Orders", "Food", "sky", 120, 799, 4.8),
    ("Bakery & Cake Decorating", "Food", "sky", 150, 1299, 4.9),
    ("Pickles & Preserves", "Food", "sky", 90, 599, 4.6),
    ("Tiffin Service Setup", "Food", "sky", 90, 699, 4.7),
    ("Food Safety & Packaging", "Food", "sky", 60, 449, 4.5),
    ("Digital Skills — Smartphone", "Digital", "emerald", 60, 299, 4.7),
    ("WhatsApp Business Setup", "Digital", "emerald", 60, 399, 4.8),
    ("Instagram for Small Business", "Digital", "emerald", 90, 599, 4.8),
    ("Product Photography at Home", "Digital", "emerald", 90, 649, 4.7),
    ("Online Payments & UPI", "Digital", "emerald", 45, 249, 4.6),
    ("Basic Computer & Typing", "Digital", "emerald", 90, 449, 4.4),
    ("Canva for Marketing", "Digital", "emerald", 60, 399, 4.6),
    ("Pricing Your Work", "Business", "rose", 60, 499, 4.9),
    ("Bookkeeping for Small Business", "Business", "rose", 90, 649, 4.6),
    ("Customer Handling & Sales", "Business", "rose", 60, 449, 4.5),
    ("Registering Your Business", "Business", "rose", 90, 549, 4.4),
    ("Applying for a Small Loan", "Business", "rose", 60, 399, 4.6),
    ("Government Schemes for Women", "Business", "rose", 60, 0, 4.8),
    ("Career Counselling", "Career", "sky", 45, 0, 4.7),
    ("Interview Preparation", "Career", "sky", 60, 349, 4.6),
    ("Resume & Application Help", "Career", "sky", 45, 249, 4.5),
    ("Spoken English — Beginner", "Career", "sky", 60, 399, 4.7),
    ("Spoken English — Confidence", "Career", "sky", 60, 449, 4.6),
    ("Financial Literacy & Saving", "Business", "rose", 60, 0, 4.8),
]


# What each session actually gives her.
#
# These are not marketing copy. They are the text the matcher reads: a woman
# types "I need money to buy a second machine for my shop" and nothing in the
# catalogue can answer her unless something in it contains the idea of borrowing
# money for equipment. Every service used to ship with `description: ""`, which
# is why matching stalled at 76% and why the five failures were all questions
# whose answer existed but could not be found.
#
# So each line is written in HER words rather than ours — what she will be able
# to do afterwards, and the everyday ways of saying it. The embedding model
# matches on meaning across all eighteen languages, so this English text is what
# makes a Telugu or Punjabi sentence findable too.
SERVICE_BLURBS: dict[str, str] = {
    "Tailoring & Stitching": "Learn to stitch clothes properly — measuring, cutting, seams and finishing — so you can take orders from home and earn from sewing.",
    "Blouse Fitting & Alterations": "Take in, let out and re-fit blouses and readymade clothes. Alteration work is steady, quick to learn, and customers come back.",
    "Saree Draping & Finishing": "Draping, pinning, pico and fall work. A small skill that pairs well with tailoring and bridal work.",
    "Pattern Making Basics": "Draft your own patterns instead of copying an old piece, so you can stitch to any size and take custom orders.",
    "Embroidery — Hand": "Hand embroidery — thread work, mirror work and beading — to add value to plain cloth and charge more for the same garment.",
    "Embroidery — Machine": "Machine embroidery for faster, repeatable designs when you have more orders than hours.",
    "Crochet & Knitting": "Crochet and knitting for shawls, baby items and home pieces you can make between other work and sell.",
    "Block Printing": "Hand block printing on cloth — carving, dyes and repeat printing — for fabric you design yourself.",
    "Tie & Dye / Bandhani": "Tie and dye and bandhani techniques for dupattas, sarees and fabric that sells at craft melas.",
    "Jewellery Making": "Make earrings, necklaces and bangles from beads, thread and wire — low material cost, good margins.",
    "Candle & Soap Making": "Make candles and soaps at home for festivals, gifting and regular orders. Small setup, quick to start.",
    "Beauty & Makeup": "Everyday and party makeup, skin preparation and hygiene, so you can take clients at home or at a salon.",
    "Bridal Makeup Masterclass": "Full bridal makeup — trials, long-wear technique and pricing a wedding booking. Bridal work pays the most in beauty.",
    "Mehndi Design": "Mehndi and henna design for weddings and festivals. Seasonal work that pays well for the hours.",
    "Hair Styling Basics": "Cutting, blow-dry, straightening and simple bridal hairstyles for salon work or home clients.",
    "Threading & Facial": "Threading, waxing and basic facials — the daily services that bring customers back every month.",
    "Home Cooking for Orders": "Cook from your own kitchen for paying customers — quantities, costing, hygiene and taking regular orders.",
    "Bakery & Cake Decorating": "Baking and decorating cakes for birthdays and weddings, including pricing an order and taking it safely to the customer.",
    "Pickles & Preserves": "Make pickles, jams and masalas that keep, so you can cook once and sell for months.",
    "Tiffin Service Setup": "Start a tiffin or dabba service from home — menu, daily quantities, delivery and collecting money on time.",
    "Food Safety & Packaging": "Keep cooked food safe, label it properly and package it so it reaches the customer well. Needed before you sell food to anyone.",
    "Digital Skills — Smartphone": "Use your phone with confidence — typing, files, forms, and the apps you need to run work from it.",
    "WhatsApp Business Setup": "Set up WhatsApp Business to show your work, reply to customers and take orders without losing messages.",
    "Instagram for Small Business": "Put your work on Instagram, reach customers outside your area and turn messages into orders.",
    "Product Photography at Home": "Photograph what you make using daylight and a phone, so it looks worth what you are charging.",
    "Online Payments & UPI": "Accept UPI and online payments safely, keep a record of what came in, and avoid the common frauds.",
    "Basic Computer & Typing": "Computer basics — files, typing, email and simple documents — the skills an office or data entry job asks for.",
    "Canva for Marketing": "Make your own posters, price lists and cards on the phone, so you do not pay someone every time.",
    "Pricing Your Work": "Work out what to charge — materials, your hours and profit — so you stop taking orders that lose you money.",
    "Bookkeeping for Small Business": "Keep accounts for your shop or work: what came in, what went out, what you are owed, and what you actually earned.",
    "Customer Handling & Sales": "Talk to customers, handle bargaining and complaints, and turn an enquiry into a sale without dropping your price.",
    "Registering Your Business": "Register your business properly — Udyam, GST, a shop licence — and understand which ones apply to you.",
    "Applying for a Small Loan": "Borrow money for a machine, materials or shop space: which loans exist, what papers you need, and what you will repay.",
    "Government Schemes for Women": "Find the government schemes and subsidies you qualify for, and get the paperwork right the first time.",
    "Career Counselling": "Talk through what work suits you, what it pays, and what the next step actually is. Free.",
    "Interview Preparation": "Practise interviews — the usual questions, gaps in work, and how to talk about what you can do.",
    "Resume & Application Help": "Write a resume and fill in job applications, including how to describe years spent at home.",
    "Spoken English — Beginner": "Start speaking English for work and customers, from the beginning, without embarrassment.",
    "Spoken English — Confidence": "Speak English with more confidence in interviews, on calls and with customers.",
    "Financial Literacy & Saving": "Handle money with confidence — saving, bank accounts, interest, and staying out of debt traps. Free.",
}


def _service_docs() -> list[dict[str, Any]]:
    r = rng()
    docs = []
    for i, (name, type_, tone, mins, rupees, rating) in enumerate(SERVICES):
        # A free session is a deliberate signal, not a missing price: counselling,
        # scheme guidance and financial literacy are the ones a woman most needs
        # before she has any income to pay with.
        docs.append({
            SEED_KEY: f"service:{name}",
            "name": name,
            "type": type_,
            "tone": tone,
            "duration": f"{mins} min",
            "price": "Free" if rupees == 0 else f"₹{rupees:,}",
            "price_minor": rupees * 100,
            "status": "Active" if i < len(SERVICES) - 2 else "Inactive",
            "bookings": r.randint(40, 900),
            "rating": f"{rating}",
            "description": SERVICE_BLURBS.get(name, ""),
            "created_at": now() - timedelta(days=r.randint(60, 400)),
        })
    return docs


def _library_docs() -> list[dict[str, Any]]:
    """The guides Sakhi answers from. See app/core/library_content.py."""
    from app.core.library_content import GUIDES

    r = rng()
    return [
        {
            SEED_KEY: f"content:{slug}",
            "title": title,
            "slug": slug,
            "type": type_,
            "status": "Published",
            "author": "WomSakhi",
            "description": desc,
            "body": body,
            "icon": "FileText",
            "tone": "brand",
            "s_tone": "brand",
            "last_updated": (now() - timedelta(days=r.randint(3, 90))).strftime("%d %b %Y"),
            "created_at": now() - timedelta(days=r.randint(30, 200)),
        }
        for slug, title, type_, desc, body in GUIDES
    ]



PROGRAMS: list[tuple[str, str, str, str, int, int]] = [
    # (name, category, tone, mode, weeks, capacity)
    ("Tailoring Foundation", "Tailoring", "brand", "Offline", 6, 40),
    ("Tailoring Advanced & Boutique Setup", "Tailoring", "brand", "Offline", 8, 30),
    ("Handicrafts Mastery Program", "Handicrafts", "amber", "Offline", 6, 60),
    ("Block Printing Intensive", "Handicrafts", "amber", "Offline", 4, 25),
    ("Jewellery Making for Market", "Handicrafts", "amber", "Hybrid", 5, 30),
    ("Beauty & Salon Skills", "Beauty", "violet", "Offline", 8, 35),
    ("Bridal Makeup Professional", "Beauty", "violet", "Offline", 6, 20),
    ("Mehndi Artistry", "Beauty", "violet", "Hybrid", 4, 30),
    ("Home Bakery Business", "Food", "sky", "Hybrid", 6, 40),
    ("Tiffin & Catering Setup", "Food", "sky", "Offline", 5, 35),
    ("Food Preservation & Packaging", "Food", "sky", "Offline", 4, 30),
    ("Digital Skills for Women", "Digital", "emerald", "Online", 4, 80),
    ("Selling Online — Marketplace Basics", "Digital", "emerald", "Online", 5, 60),
    ("Social Media for Small Business", "Digital", "emerald", "Online", 4, 70),
    ("Product Photography & Listing", "Digital", "emerald", "Hybrid", 3, 40),
    ("Start Your Own Business", "Business", "rose", "Hybrid", 10, 50),
    ("Bookkeeping & Taxes Made Simple", "Business", "rose", "Online", 5, 60),
    ("Pricing, Costing & Profit", "Business", "rose", "Online", 3, 60),
    ("Access to Credit & Loans", "Business", "rose", "Hybrid", 4, 45),
    ("Financial Literacy Foundation", "Business", "rose", "Online", 4, 100),
    ("Spoken English for Work", "Career", "sky", "Online", 8, 80),
    ("Job Readiness & Interviews", "Career", "sky", "Hybrid", 5, 55),
    ("Computer Basics & Data Entry", "Career", "sky", "Offline", 6, 45),
    ("Leadership for Women in Work", "Career", "sky", "Hybrid", 6, 30),
    ("Know Your Rights at Work", "Career", "sky", "Online", 3, 100),
]


# What each programme covers.
#
# The generated line these replace — "6 weeks of practical tailoring training" —
# was true and useless: every programme in a category produced the same sentence,
# so nothing could be told apart by meaning. These say what she will actually
# come away able to do.
PROGRAM_BLURBS: dict[str, str] = {
    "Tailoring Foundation": "Start sewing from nothing: machine handling, measuring, cutting and finishing a garment you can sell.",
    "Tailoring Advanced & Boutique Setup": "Go from stitching alone to running a boutique — advanced cutting, pricing, hiring help and handling bulk orders.",
    "Handicrafts Mastery Program": "Work in several crafts to a standard people pay for, and learn which ones sell in your area.",
    "Block Printing Intensive": "Block printing end to end — carving, dyeing, repeats and finishing fabric ready for sale.",
    "Jewellery Making for Market": "Make jewellery people buy: designs that sell, material costs, and where to sell them.",
    "Beauty & Salon Skills": "Salon-standard beauty work — skin, hair, threading and makeup — with the hygiene practice clients expect.",
    "Bridal Makeup Professional": "Bridal makeup as a business: trials, long-wear technique, quoting a wedding and building a portfolio.",
    "Mehndi Artistry": "Bridal and festival mehndi designs, speed, and charging properly for wedding season work.",
    "Home Bakery Business": "Run a bakery from your kitchen — baking, decorating, costing, orders and safe delivery.",
    "Tiffin & Catering Setup": "Set up a tiffin or catering service: menus, daily quantities, staff, delivery and getting paid on time.",
    "Food Preservation & Packaging": "Make pickles, masalas and preserves that keep, and package and label them for sale.",
    "Digital Skills for Women": "Use a phone and computer for work — messages, forms, payments, and finding information yourself.",
    "Selling Online — Marketplace Basics": "Sell what you make on online marketplaces: listing, photos, pricing, delivery and returns.",
    "Social Media for Small Business": "Use WhatsApp, Instagram and Facebook to reach customers beyond your street and turn messages into orders.",
    "Product Photography & Listing": "Photograph and describe your products so they sell online without you explaining every one.",
    "Start Your Own Business": "Take an idea to a working business: plan, registration, costing, customers and the first months of running it.",
    "Bookkeeping & Taxes Made Simple": "Keep proper accounts and understand what tax applies to you, without needing an accountant for everything.",
    "Pricing, Costing & Profit": "Work out your real costs and set prices that leave you a profit instead of just covering materials.",
    "Access to Credit & Loans": "Borrow money safely for your work: which loans and schemes exist, the papers needed, and what repayment really costs.",
    "Financial Literacy Foundation": "Manage money with confidence — saving, banking, interest, insurance and avoiding debt traps.",
    "Spoken English for Work": "Speak English well enough for customers, interviews and calls, starting from wherever you are now.",
    "Job Readiness & Interviews": "Get ready to apply: resume, applications, interviews, and explaining years spent at home.",
    "Computer Basics & Data Entry": "Computer skills for office and data entry work — typing, spreadsheets, documents and accuracy.",
    "Leadership for Women in Work": "Speak up, lead a team, and handle difficult situations at work with confidence.",
    "Know Your Rights at Work": "Know your rights — pay, hours, safety, maternity and harassment — and what to do when they are broken.",
}


def _program_docs() -> list[dict[str, Any]]:
    r = rng()
    docs = []
    today = now().date()
    for i, (name, category, tone, mode, weeks, cap) in enumerate(PROGRAMS):
        # A spread of running / upcoming / completed, so the programme screens
        # have every state to render rather than twenty identical rows.
        phase = i % 3
        if phase == 0:
            start = today - timedelta(days=r.randint(7, 30)); status = "Running"
        elif phase == 1:
            start = today + timedelta(days=r.randint(5, 45)); status = "Upcoming"
        else:
            start = today - timedelta(days=r.randint(80, 200)); status = "Completed"
        end = start + timedelta(weeks=weeks)
        enrolled = cap if status == "Completed" else r.randint(int(cap * 0.4), cap)
        docs.append({
            SEED_KEY: f"program:{name}",
            "name": name,
            "desc": PROGRAM_BLURBS.get(
                name,
                f"{weeks} weeks of practical {category.lower()} training, taught by women who do this work.",
            ),
            "category": category,
            "cat_tone": tone,
            "mode": mode,
            "duration": f"{weeks} Weeks",
            "dates": f"{start:%b %d} - {end:%b %d, %Y}",
            "days": r.choice(["Mon, Wed, Fri", "Tue, Thu, Sat", "Sat, Sun", "Mon to Fri"]),
            "enrolled": enrolled,
            "cap": cap,
            "pct": round(enrolled / cap * 100),
            "status": status,
            "note": {
                "Running": "In progress",
                "Upcoming": f"Starts {(start - today).days} days from now",
                "Completed": "Finished",
            }[status],
            "bar": tone,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "created_at": now() - timedelta(days=r.randint(30, 300)),
        })
    return docs


MENTORS: list[tuple[str, str, str, int, str, list[str], list[str]]] = [
    ("Lakshmi Reddy", "Runs a 12-woman tailoring unit in Hyderabad",
     "Hyderabad", 14, "Weekends", ["Tailoring", "Business"], ["Telugu", "Hindi", "English"]),
    ("Fatima Sheikh", "Bridal makeup artist, 400+ weddings",
     "Mumbai", 11, "Weekday evenings", ["Beauty", "Pricing"], ["Hindi", "Marathi", "Urdu"]),
    ("Sunita Devi", "Took a home kitchen to a 30-order-a-day tiffin service",
     "Patna", 9, "Mornings", ["Food", "Operations"], ["Hindi", "Bhojpuri"]),
    ("Rekha Nair", "Chartered accountant; helps women register businesses",
     "Kochi", 16, "Weekends", ["Business", "Compliance"], ["Malayalam", "English"]),
    ("Anjali Mehta", "Sells handmade jewellery to 4 countries from Jaipur",
     "Jaipur", 8, "Flexible", ["Handicrafts", "Export"], ["Hindi", "English"]),
    ("Priyanka Das", "Teaches digital skills to first-time smartphone users",
     "Kolkata", 6, "Weekday evenings", ["Digital", "Teaching"], ["Bengali", "Hindi", "English"]),
    ("Meenakshi Iyer", "Runs a block-printing cooperative of 40 women",
     "Madurai", 18, "Weekends", ["Handicrafts", "Cooperatives"], ["Tamil", "English"]),
    ("Gurpreet Kaur", "Built a bakery from one oven; now supplies 9 cafes",
     "Ludhiana", 10, "Mornings", ["Food", "Business"], ["Punjabi", "Hindi"]),
    ("Shabana Qureshi", "Employment lawyer; workplace rights and harassment",
     "Delhi", 13, "Weekday evenings", ["Legal", "Rights"], ["Hindi", "Urdu", "English"]),
    ("Vidya Kulkarni", "Microfinance officer; loans for women-run businesses",
     "Pune", 12, "Weekends", ["Finance", "Credit"], ["Marathi", "Hindi", "English"]),
    ("Nafisa Ali", "Embroidery specialist, trains for export quality",
     "Lucknow", 20, "Flexible", ["Handicrafts", "Quality"], ["Hindi", "Urdu"]),
    ("Deepa Menon", "Career counsellor; returning to work after a break",
     "Bengaluru", 9, "Weekday evenings", ["Career", "Counselling"], ["Malayalam", "English"]),
    ("Kalpana Yadav", "Dairy and pickle enterprise across 6 villages",
     "Indore", 15, "Mornings", ["Food", "Rural enterprise"], ["Hindi"]),
    ("Ritu Chawla", "Instagram growth for small makers",
     "Chandigarh", 5, "Flexible", ["Digital", "Marketing"], ["Hindi", "Punjabi", "English"]),
    ("Sarita Bhosale", "Self-help group federation lead, 300 members",
     "Nashik", 22, "Weekends", ["Cooperatives", "Leadership"], ["Marathi", "Hindi"]),
    ("Zainab Ansari", "Spoken English coach for first-generation learners",
     "Hyderabad", 7, "Weekday evenings", ["Career", "English"], ["Urdu", "Telugu", "English"]),
    ("Manju Sharma", "Crochet and knitting; sells through 3 marketplaces",
     "Dehradun", 11, "Flexible", ["Handicrafts", "Online selling"], ["Hindi", "English"]),
    ("Latha Krishnan", "Runs a salon chain of 4; trains and hires women",
     "Chennai", 17, "Weekends", ["Beauty", "Hiring"], ["Tamil", "English"]),
    ("Farida Begum", "Tailoring trainer for women with disabilities",
     "Bhopal", 13, "Mornings", ["Tailoring", "Accessibility"], ["Hindi", "Urdu"]),
    ("Neelam Joshi", "Helps women apply for government schemes",
     "Ahmedabad", 10, "Weekday evenings", ["Schemes", "Paperwork"], ["Gujarati", "Hindi"]),
]


def _mentor_docs() -> list[dict[str, Any]]:
    r = rng()
    docs = []
    for name, headline, location, years, availability, expertise, languages in MENTORS:
        docs.append({
            SEED_KEY: f"mentor:{name}",
            "name": name,
            "headline": headline,
            "bio": f"{headline}. Happy to talk to anyone starting out — ask me anything.",
            "photo": "",
            "expertise": expertise,
            "languages": languages,
            "experience_years": years,
            "location": location,
            "availability": availability,
            "rating": round(r.uniform(4.3, 5.0), 1),
            "rating_count": r.randint(6, 90),
            "sessions_done": r.randint(8, 220),
            "status": "active",
            "created_at": now() - timedelta(days=r.randint(60, 500)),
        })
    return docs


async def seed_catalogue() -> dict[str, tuple[int, int]]:
    """Services, programmes and mentors — what the platform offers."""
    out = {}
    for coll, docs in (
        ("services", _service_docs()),
        ("programs", _program_docs()),
        ("mentors", _mentor_docs()),
        ("content_items", _library_docs()),
    ):
        # Adopt first: claim any row the original seeders left behind so it is
        # updated in place rather than duplicated, and so records pointing at
        # its `_id` keep working.
        await adopt_legacy(coll, "name", docs)
        out[coll] = await converge(coll, docs)
    return out


async def seed_depth_all() -> dict[str, Any]:
    """Everything, in dependency order. Safe to run repeatedly."""
    report: dict[str, Any] = {}
    report["member_logins"] = await seed_member_logins()
    report.update(await seed_catalogue())
    # Circles before the join tables — membership is generated against whatever
    # circles exist, so seeding them afterwards would leave the new ones empty.
    report["circles"] = await seed_circles()
    report.update(await seed_join_tables())
    report.update(await seed_completions())
    report.update(await seed_verification_queue())
    # Last: notifications are generated FROM her bookings, enrolments and
    # certificates, so they must already exist.
    report["member_notifications"] = await seed_member_notifications()
    return report


# --------------------------------------------------------------------------- #
# B3 — the join tables
#
# These matter more than the catalogue. There were 54 members and 29 events but
# ONE registration, so "My events" was empty for everybody. A screen with no
# rows looks unfinished even when the code behind it is complete — the fix is
# data, not design.
# --------------------------------------------------------------------------- #

# Every seeded member gets a working login, with this password.
#
# Not a secret: these are demo accounts on demo data, and a demo you cannot sign
# in to is a screenshot. Real credentials live in `backend/.env` — see ADR-011
# and the Secrets note. Never reuse this for anything that matters.
DEMO_PASSWORD = "Womsakhi!2026"


async def seed_member_logins() -> int:
    """
    Give each seeded member an account she can actually sign in with.

    The directory (`members`) and the credential store (`users`) are separate —
    a member row on its own is a name in a list, not somebody who can log in.
    Without this, the member app has no one to be: every "my bookings", "my
    programmes" and "my circles" screen is empty because nothing can own a row.

    Only Active members get a login. Pending, Inactive and Rejected members are
    deliberately left without one, because those states exist precisely to be
    seen from the staff side — and a rejected applicant who can still sign in
    would be a bug worth catching.
    """
    from app.core.security import hash_password
    from app.models.user import UserModel

    db = get_database()
    created = 0
    hashed = hash_password(DEMO_PASSWORD)

    async for m in db["members"].find({"status": "Active"}):
        email = (m.get("email") or "").lower().strip()
        if not email:
            continue
        existing = await db["users"].find_one({"email": email})
        if existing:
            # Keep the link fresh, but never touch a password that already works.
            await db["users"].update_one(
                {"_id": existing["_id"]},
                {"$set": {"member_id": str(m["_id"]), "verification_status": "active"}},
            )
            continue
        doc = UserModel.create_document(
            full_name=m.get("full_name", "Member"),
            email=email,
            hashed_password=hashed,
            role="Member",
            member_id=str(m["_id"]),
            phone=m.get("phone", ""),
            verification_status="active",
        )
        doc[SEED_KEY] = f"user:{email}"
        doc["onboarding_complete"] = True
        await db["users"].insert_one(doc)
        created += 1
    return created


async def _member_users() -> list[tuple[str, str, str]]:
    """(user_id, member_id, name) for everyone who can hold a booking."""
    db = get_database()
    out = []
    async for m in db["members"].find({"status": {"$in": ["Active", "Pending"]}}):
        user = await db["users"].find_one({"email": m.get("email", "")})
        if user:
            out.append((str(user["_id"]), str(m["_id"]), m.get("full_name", "Member")))
    return out


async def seed_join_tables() -> dict[str, tuple[int, int]]:
    db = get_database()
    r = rng()
    people = await _member_users()
    if not people:
        return {}

    services = await db["services"].find({"status": "Active"}).to_list(length=None)
    programs = await db["programs"].find({}).to_list(length=None)
    circles = await db["circles"].find({}).to_list(length=None)
    events = await db["events"].find({}).to_list(length=None)

    today = now().date()

    # ── bookings: a spread of past, upcoming and cancelled ────────────────────
    # All three states on purpose. Seeding only upcoming ones would leave the
    # history and cancellation screens looking broken for want of a row.
    bookings = []
    for i in range(60):
        uid, mid, name = people[i % len(people)]
        svc = services[r.randrange(len(services))]
        if i % 5 == 0:
            day, status = today - timedelta(days=r.randint(2, 90)), "cancelled"
        elif i % 5 in (1, 2):
            day, status = today - timedelta(days=r.randint(1, 120)), "completed"
        else:
            day, status = today + timedelta(days=r.randint(1, 40)), "upcoming"
        bookings.append({
            SEED_KEY: f"booking:{i}",
            "user_id": uid, "member_id": mid,
            "service_id": str(svc["_id"]), "service_name": svc["name"],
            "date": day.isoformat(),
            "time": r.choice(["09:00 AM", "10:30 AM", "12:00 PM", "02:30 PM", "04:00 PM", "06:00 PM"]),
            "mode": r.choice(["Online", "Offline"]),
            "with_whom": "", "duration": svc.get("duration", "60 min"),
            "price": (svc.get("price_minor", 0) or 0) / 100,
            "note": "", "status": status,
            "cancelled_reason": "Could not attend" if status == "cancelled" else "",
            "created_at": now() - timedelta(days=r.randint(1, 150)),
        })

    # ── enrolments ────────────────────────────────────────────────────────────
    # `enrollments` carries a unique index on (user_id, program_id) — a member
    # cannot enrol on the same programme twice, which is correct. Random pairing
    # violated it immediately, so the pairs are generated as a distinct set
    # rather than sampled and hoped over.
    enrollments = []
    pairs = [(p_i, u_i) for p_i in range(len(programs)) for u_i in range(len(people))]
    r.shuffle(pairs)
    # 60 rather than 40. Certificates are derived strictly from COMPLETED
    # enrolments — a certificate for an unfinished course would be a lie the
    # screen tells, and it would make the progress screens contradict each
    # other. So the way to have more certificates is to have more finished
    # courses, not to mint certificates directly.
    for i, (p_i, u_i) in enumerate(pairs[:85]):
        uid, mid, _ = people[u_i]
        prog = programs[p_i]
        status = prog.get("status", "Running")
        if status == "Completed":
            state, progress = "completed", 100
        elif status == "Upcoming":
            state, progress = "active", 0
        else:
            state, progress = "active", r.choice([10, 25, 40, 55, 70, 85])
        enrollments.append({
            SEED_KEY: f"enrollment:{i}",
            "user_id": uid, "member_id": mid,
            "program_id": str(prog["_id"]), "program_name": prog["name"],
            "status": state, "progress": progress,
            "sessions_attended": round(progress / 10),
            "last_activity_at": now() - timedelta(days=r.randint(0, 25)),
            "completed_at": now() - timedelta(days=r.randint(5, 60)) if state == "completed" else None,
            "created_at": now() - timedelta(days=r.randint(20, 220)),
        })

    # ── circle membership ─────────────────────────────────────────────────────
    # Distinct (member, circle) pairs, for the same reason as enrolments: a
    # person is either in a circle or not.
    circle_members = []
    seen: set[tuple[str, str]] = set()
    for c in circles:
        k = min(len(people), r.randint(3, max(3, len(people))))
        for uid, mid, _ in r.sample(people, k=k):
            pair = (uid, str(c["_id"]))
            if pair in seen:
                continue
            seen.add(pair)
            circle_members.append({
                SEED_KEY: f"circle_member:{uid}:{c['_id']}",
                "user_id": uid, "member_id": mid, "circle_id": str(c["_id"]),
                "created_at": now() - timedelta(days=r.randint(5, 300)),
            })

    # ── event registrations ───────────────────────────────────────────────────
    event_regs = []
    seen_ev: set[tuple[str, str]] = set()
    for e in events:
        k = min(len(people), r.randint(2, 6))
        for uid, mid, _ in r.sample(people, k=k):
            pair = (uid, str(e["_id"]))
            if pair in seen_ev:
                continue
            seen_ev.add(pair)
            event_regs.append({
                SEED_KEY: f"event_reg:{uid}:{e['_id']}",
                "user_id": uid, "member_id": mid,
                "event_id": str(e["_id"]), "event_title": e.get("title", ""),
                "status": "registered",
                "created_at": now() - timedelta(days=r.randint(1, 60)),
            })

    return {
        "bookings": await converge("bookings", bookings),
        # Natural keys mirror the unique indexes these collections carry.
        "enrollments": await converge("enrollments", enrollments, ["user_id", "program_id"]),
        "circle_members": await converge("circle_members", circle_members, ["user_id", "circle_id"]),
        "event_registrations": await converge("event_registrations", event_regs, ["user_id", "event_id"]),
    }


# --------------------------------------------------------------------------- #
# B4 + B5 — the collections that were completely empty
# --------------------------------------------------------------------------- #

async def seed_completions() -> dict[str, Any]:
    """
    Certificates, trusted contacts, wallet history and backups.

    Every one of these was at zero, so four screens rendered an empty state
    permanently — including the certificate a member earns, which is the single
    most tangible thing the platform gives her.
    """
    db = get_database()
    r = rng()
    people = await _member_users()
    if not people:
        return {}

    # ── certificates: only for enrolments that actually finished ─────────────
    # Issuing a certificate for an unfinished course would be a lie the screen
    # tells, and it would make the progress screens contradict each other.
    certificates = []
    i = 0
    async for e in db["enrollments"].find({"status": "completed"}):
        member = await db["members"].find_one({"_id": __import__("bson").ObjectId(e["member_id"])}) \
            if e.get("member_id") else None
        certificates.append({
            SEED_KEY: f"certificate:{e['user_id']}:{e['program_id']}",
            "user_id": e["user_id"], "member_id": e.get("member_id", ""),
            "holder_name": (member or {}).get("full_name", "Member"),
            "program_id": e["program_id"], "program_name": e.get("program_name", ""),
            "code": f"WS-CERT-{2026}-{i + 1001}",
            # A string, because `CertificateResponse.hours` is declared `str`.
            # Seeding it as an int returned a 500 from /me/certificates — the
            # second fixture/schema mismatch after `backups.collections`, which
            # is why `checks/api.mjs` now exercises every endpoint.
            "hours": str(r.choice([24, 32, 40, 48, 60])),
            "grade": r.choice(["Pass", "Merit", "Distinction"]),
            "revoked": False,
            "issued_at": e.get("completed_at") or now() - timedelta(days=r.randint(5, 90)),
            "created_at": e.get("completed_at") or now() - timedelta(days=r.randint(5, 90)),
        })
        i += 1

    # ── trusted contacts ─────────────────────────────────────────────────────
    # Two each. One contact is a single point of failure on a safety feature,
    # and the screen is designed to show a list.
    RELATIONS = [
        ("Sister", "+91 98200 11223"), ("Mother", "+91 98200 33445"),
        ("Friend", "+91 98200 55667"), ("Neighbour", "+91 98200 77889"),
        ("Cousin", "+91 98200 99001"), ("Colleague", "+91 98200 22334"),
    ]
    contacts = []
    for idx, (uid, mid, name) in enumerate(people):
        for j in range(2):
            rel, phone = RELATIONS[(idx * 2 + j) % len(RELATIONS)]
            contacts.append({
                SEED_KEY: f"trusted_contact:{uid}:{j}",
                "user_id": uid, "member_id": mid,
                "name": f"{rel} of {name.split()[0]}",
                "relation": rel, "phone": phone,
                "is_primary": j == 0,
                "created_at": now() - timedelta(days=r.randint(20, 300)),
            })

    # ── wallet history ───────────────────────────────────────────────────────
    # Amounts in minor units per ADR-008. Credits are grants and refunds;
    # debits are fees paid — so a balance actually moves over time instead of
    # only ever growing.
    LEDGER = [
        ("credit", "scholarship", "Fee support · programme fee", 250000),
        ("credit", "scholarship", "Fee support · materials", 120000),
        ("credit", "refund", "Refund · cancelled session", 49900),
        ("credit", "referral", "Referral bonus", 20000),
        ("debit", "booking", "Session fee · Tailoring & Stitching", 49900),
        ("debit", "booking", "Session fee · Beauty & Makeup", 89900),
        ("debit", "program", "Programme fee · instalment", 150000),
        ("debit", "booking", "Session fee · Mehndi Design", 29900),
    ]
    wallet = []
    n = 0
    for uid, mid, _ in people:
        for j in range(r.randint(8, 14)):
            kind, source, label, amount = LEDGER[(n + j) % len(LEDGER)]
            wallet.append({
                SEED_KEY: f"wallet:{uid}:{j}",
                "user_id": uid, "member_id": mid,
                "kind": kind, "amount_minor": amount,
                "source": source, "label": label, "reference_id": "",
                "created_at": now() - timedelta(days=r.randint(1, 300)),
            })
            n += 1

    # ── backups ──────────────────────────────────────────────────────────────
    # Shaped from `BackupModel.create_document`, not invented. The first attempt
    # set `collections` to a count rather than the list of names the schema
    # declares, and the endpoint died with `object of type 'int' has no len()` —
    # a 500 on a screen that had previously been fine only because the
    # collection was empty and the failing code never ran.
    BACKED_UP = [
        "users", "members", "roles", "services", "programs", "bookings",
        "enrollments", "circles", "circle_posts", "events", "wallet_transactions",
        "safety_alerts", "safety_reports", "certificates",
    ]
    backups = []
    for j in range(5):
        when = now() - timedelta(days=j * 7 + 1)
        size = r.randint(18_000_000, 42_000_000)
        backups.append({
            SEED_KEY: f"backup:{j}",
            "name": f"daily-{when:%Y%m%d}",
            "kind": "full" if j else "custom",
            "collections": BACKED_UP if j else BACKED_UP[:6],
            "note": "" if j else "Before the pricing change",
            "status": "complete",
            "doc_count": r.randint(400, 1800),
            "size_bytes": size,
            "filename": f"womsakhi-{when:%Y%m%d}.archive.gz",
            "error": "",
            "created_by": "admin@womsakhi.com",
            "created_by_name": "Admin User",
            "created_at": when,
            "finished_at": when + timedelta(seconds=r.randint(20, 180)),
        })

    return {
        "certificates": await converge("certificates", certificates, ["user_id", "program_id"]),
        "trusted_contacts": await converge("trusted_contacts", contacts),
        "wallet_transactions": await converge("wallet_transactions", wallet),
        "backups": await converge("backups", backups),
    }


# --------------------------------------------------------------------------- #
# B5 — the verification queue
# --------------------------------------------------------------------------- #

async def seed_verification_queue() -> dict[str, Any]:
    """
    Applicants waiting to be reviewed, with documents staff can actually open.

    The queue reads `users` where `verification_status` is `in_review`. Every
    seeded login was `active`, so the queue was empty and the whole review
    screen — one of the busiest in the staff app — had nothing to show.

    ## About the documents

    These are generated placeholder images, not identity documents. No real
    Aadhaar or PAN number exists anywhere in this data, and none should: per
    ADR-011 an ID document is the most sensitive thing the system holds, and
    seeding realistic-looking ones would put a plausible fake identity into a
    database that gets copied to laptops.

    But the record has to point at a file that EXISTS. A queue row whose "view
    document" button 404s is a dead control, and dead controls are exactly what
    was cleared out of the admin module earlier — reintroducing one here to save
    a few lines would be a poor trade.
    """
    import io
    import os

    db = get_database()
    r = rng()

    media_dir = os.getenv("PRIVATE_MEDIA_DIR", "private_media")
    os.makedirs(media_dir, exist_ok=True)

    # Applicants, invented — not drawn from the member directory, because a
    # person who is already an active member is not awaiting review.
    APPLICANTS = [
        ("Rukhsana Bano", "rukhsana.bano@example.com", "+91 90112 33445", "aadhaar"),
        ("Sunanda Patil", "sunanda.patil@example.com", "+91 90223 44556", "pan"),
        ("Jyoti Kumari", "jyoti.kumari@example.com", "+91 90334 55667", "voter_id"),
        ("Asha Bhosale", "asha.bhosale@example.com", "+91 90445 66778", "aadhaar"),
        ("Nirmala Devi", "nirmala.devi@example.com", "+91 90556 77889", "driving_licence"),
        ("Salma Khatoon", "salma.khatoon@example.com", "+91 90667 88990", "aadhaar"),
    ]

    from app.core.security import hash_password
    from app.models.user import UserModel

    hashed = hash_password(DEMO_PASSWORD)
    docs_written = 0
    created_users = 0

    for i, (name, email, phone, doc_type) in enumerate(APPLICANTS):
        member = await db["members"].find_one({"email": email})
        if not member:
            res = await db["members"].insert_one({
                SEED_KEY: f"applicant_member:{email}",
                "code": f"WC-2{6000 + i}",
                "full_name": name, "email": email, "phone": phone,
                "role": "Member", "status": "Pending",
                "location": r.choice(["Mumbai", "Patna", "Jaipur", "Kochi", "Indore", "Lucknow"]),
                "joined": f"{now():%b %d, %Y}",
                "created_at": now() - timedelta(days=r.randint(1, 14)),
                "updated_at": now(),
            })
            member_id = str(res.inserted_id)
        else:
            member_id = str(member["_id"])

        user = await db["users"].find_one({"email": email})
        if not user:
            doc = UserModel.create_document(
                full_name=name, email=email, hashed_password=hashed,
                role="Member", member_id=member_id, phone=phone,
                verification_status="in_review",
            )
            doc[SEED_KEY] = f"applicant_user:{email}"
            res = await db["users"].insert_one(doc)
            user_id = str(res.inserted_id)
            created_users += 1
        else:
            user_id = str(user["_id"])
            await db["users"].update_one(
                {"_id": user["_id"]}, {"$set": {"verification_status": "in_review"}}
            )

        # A 1×1 PNG. Enough for the streaming endpoint to serve something real,
        # small enough that nobody mistakes it for a document.
        stored_name = f"seed-{doc_type}-{i}.png"
        path = os.path.join(media_dir, stored_name)
        if not os.path.exists(path):
            png = bytes.fromhex(
                "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
                "1f15c4890000000a49444154789c6360000002000100" "05fe02fea7"
                "9c9e1c0000000049454e44ae426082"
            )
            with open(path, "wb") as fh:
                fh.write(png)

        await db["verification_documents"].update_one(
            {"user_id": user_id, "doc_type": doc_type},
            {"$set": {
                SEED_KEY: f"verification_doc:{email}",
                "user_id": user_id, "member_id": member_id,
                "doc_type": doc_type,
                "original_name": f"{doc_type}.png",
                "stored_name": stored_name,
                "content_type": "image/png",
                "size": len(png) if 'png' in dir() else 95,
                "status": "pending",
                "updated_at": now(),
            }, "$setOnInsert": {"created_at": now() - timedelta(days=r.randint(1, 10))}},
            upsert=True,
        )
        docs_written += 1

    return {"applicants": created_users, "verification_documents": docs_written}


# --------------------------------------------------------------------------- #
# Circles — the community side
# --------------------------------------------------------------------------- #

CIRCLES: list[tuple[str, str, str, bool]] = [
    # (name, topic, description, private)
    ("Tailoring & Stitching Sisters", "Craft",
     "Patterns, fabric sources, pricing your work.", False),
    ("Embroidery Circle", "Craft",
     "Hand and machine. Share what you are working on.", False),
    ("Block Print & Natural Dye", "Craft",
     "Techniques, suppliers, and what actually sells.", False),
    ("Jewellery Makers", "Craft",
     "Materials, tools, and finding buyers beyond your town.", False),
    ("Crochet & Knitting", "Craft",
     "Patterns swapped freely. Beginners very welcome.", False),
    ("Home Bakers", "Food",
     "Costing, packaging, and surviving festival season.", False),
    ("Tiffin & Catering", "Food",
     "Daily orders, delivery, and keeping quality steady.", False),
    ("Pickles & Preserves", "Food",
     "Shelf life, labelling, and selling outside the family.", False),
    ("Beauty & Salon Owners", "Beauty",
     "Running a salon: staff, rent, regulars.", False),
    ("Bridal Season", "Beauty",
     "Peak-season pricing, bookings and saying no.", False),
    ("Mehndi Artists", "Beauty",
     "Designs, timing, and charging what it is worth.", False),
    ("First Business", "Business",
     "For anyone in the first year. No question is too basic.", False),
    ("Pricing & Profit", "Business",
     "What to charge. The hardest question, asked properly.", False),
    ("Selling Online", "Digital",
     "Marketplaces, listings, photos, returns.", False),
    ("WhatsApp & Instagram", "Digital",
     "Reaching customers without paying for ads.", False),
    ("Learning English", "Career",
     "Practise here. Mistakes are the point.", False),
    ("Back to Work", "Career",
     "Returning after a break — CVs, interviews, confidence.", False),
    ("Loans & Schemes", "Money",
     "What is available, and what the paperwork really needs.", False),
    ("Balancing Home & Work", "Support",
     "Honest talk about time, family and guilt.", True),
    ("Safety & Support", "Support",
     "A private circle. Moderated closely. You will be believed.", True),
]


def _circle_docs() -> list[dict[str, Any]]:
    r = rng()
    return [
        {
            SEED_KEY: f"circle:{name}",
            "name": name,
            "topic": topic,
            "desc": desc,
            "cover": "",
            "guidelines": "Share what you know. Nobody here is an expert at everything.",
            "is_private": private,
            "member_count": r.randint(8, 120),
            "post_count": r.randint(3, 40),
            "status": "active",
            "created_by": "",
            "created_at": now() - timedelta(days=r.randint(30, 500)),
        }
        for name, topic, desc, private in CIRCLES
    ]


async def seed_circles() -> tuple[int, int]:
    docs = _circle_docs()
    await adopt_legacy("circles", "name", docs)
    return await converge("circles", docs)


async def seed_member_notifications() -> tuple[int, int]:
    """
    Give every seeded member her own notifications.

    187 existed, all belonging to one account, so `/app/notifications` was
    permanently empty for everyone else — the screen with the single most
    obvious "is this thing working?" signal in the member app.

    Generated from what she has actually done: a booking she holds, a programme
    she is enrolled on. A notification about a session that does not exist would
    make the screens contradict each other the moment she tapped through.
    """
    db = get_database()
    r = rng()
    people = await _member_users()
    docs = []

    for uid, mid, name in people:
        booking = await db["bookings"].find_one({"user_id": uid, "status": "upcoming"})
        enrolment = await db["enrollments"].find_one({"user_id": uid})
        cert = await db["certificates"].find_one({"user_id": uid})

        items: list[tuple[str, str, str, str]] = []
        if booking:
            items.append(("booking", "Session confirmed",
                          f"{booking.get('service_name','Your session')} on "
                          f"{booking.get('date','')} at {booking.get('time','')}.",
                          "/app/bookings"))
            items.append(("booking", "A reminder about tomorrow",
                          f"{booking.get('service_name','Your session')} is coming up. "
                          "Cancel free up to 24 hours before.", "/app/bookings"))
        if enrolment:
            items.append(("program", "New material added",
                          f"There is a new session in {enrolment.get('program_name','your programme')}.",
                          "/app/programs"))
        if cert:
            items.append(("certificate", "Your certificate is ready",
                          f"{cert.get('program_name','Your programme')} — download or share it.",
                          "/app/certificates"))
        items += [
            ("circle", "Someone replied to you",
             "A member answered your question in Pricing & Profit.", "/app/circles"),
            ("event", "A workshop you might want",
             "Price your work without apologising — Saturday, online, free.", "/app/events"),
            ("wallet", "Fee support approved",
             "Your support request was approved and the credit is in your wallet.", "/app/wallet"),
        ]

        for j, (kind, title, body, href) in enumerate(items):
            docs.append({
                SEED_KEY: f"notif:{uid}:{j}",
                "user_id": uid,
                "type": kind,
                "title": title,
                "body": body,
                "href": href,
                # A mix, so the unread badge and the read style both render.
                "unread": j < 3,
                "created_at": now() - timedelta(days=j, hours=r.randint(0, 20)),
            })

    return await converge("member_notifications", docs)
