"""
Masters — the pick-lists staff control, one system for every module.

── What a master is ─────────────────────────────────────────────────────────
A list members or staff choose from: course categories, event categories,
circle topics, doctor specialities, report reasons, languages … Each list is
DECLARED here in code (its name, module, whether it has two levels, which
records use it, what it starts with), and its ITEMS live in `master_items`,
where staff add, rename, reorder, enable, disable and delete them from the
dashboard (routes/masters.py):

    {list, key, label, parent_key, active, order, extra: {...}, created_at, updated_at}

Staff cannot invent a new list from the dashboard: a list only means
something once code reads it.

── How records use it ───────────────────────────────────────────────────────
Records store an item's LABEL, exactly as they did before masters existed
("Workshop", "Gynaecologist"), so nothing already saved had to move. Because
of that:
* a rename carries to every record that uses the old label (`USES` below);
* delete is refused while any record uses the item — disable it instead:
  what exists keeps its value, and nobody can pick it again;
* `check()` is what a route calls before saving: an active label (matched
  without regard to case) comes back canonical, anything else is a 422 that
  names the choices.

── Where lists start ────────────────────────────────────────────────────────
Each list is seeded on first read with exactly the values the app used before
it became a master, so members see no change until staff change something.

Two older masters keep their own screens and rules and are only linked from
the Masters hub: shop categories (app/core/market_categories.py) and work
categories and skills (routes/work_talent.py).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Iterable, Optional

from fastapi import HTTPException, status

from app.core.media import media_url
from app.db.mongodb import get_database

COLLECTION = "master_items"


@dataclass(frozen=True)
class Use:
    """One place a list's labels are stored: `collection.field` (a list field when `many`)."""
    collection: str
    field: str
    many: bool = False


@dataclass(frozen=True)
class ListDef:
    key: str
    module: str          # permission module: reads need <module>.view, writes <module>.edit
    section: str         # where it shows in the hub ("Learn", "Community" …)
    name: str
    description: str
    levels: int = 1      # 2 = a parent level with items under it
    extras: tuple[str, ...] = ()   # extra fields staff may set per item, e.g. ("synonyms", "icon")
    #                                "image" on the lists members see as picture tiles
    uses: tuple[Use, ...] = ()
    #: (label, extra, children) — children only when levels == 2
    seed: tuple = ()
    #: The parent level's name, for two-level lists ("Learning path").
    parent_name: str = ""


def _s(*labels: str) -> tuple:
    return tuple((l, {}, ()) for l in labels)


LISTS: dict[str, ListDef] = {d.key: d for d in [
    ListDef(
        "course_categories", "programs", "Learn", "Course categories",
        "What a course is about. Grouped into learning paths, which the Learn home shows.",
        levels=2, parent_name="Learning path", extras=("icon", "note", "image"),
        uses=(Use("programs", "category"),),
        seed=(
            ("Career & Jobs", {"icon": "Briefcase", "note": "Get job ready"},
             _s("Digital Literacy", "Languages", "Personal Development")),
            ("Entrepreneurship", {"icon": "TrendingUp", "note": "Start and grow"},
             _s("Entrepreneurship", "Handicrafts", "Cooking & Food", "Beauty & Care", "Sustainability")),
            ("Money & Finance", {"icon": "BadgeIndianRupee", "note": "Financial independence"}, _s("Money & Savings")),
            ("Health & Wellness", {"icon": "Heart", "note": "A happier you"}, _s("Health & Wellness")),
        ),
    ),
    ListDef(
        "mentor_topics", "learning", "Learn", "Mentor topics",
        "What mentors help with. Groups are the topics members filter by; "
        "items are what a mentor ticks on her profile. Synonyms widen a group's match.",
        levels=2, parent_name="Topic group", extras=("icon", "synonyms", "image"),
        uses=(Use("mentors", "expertise", many=True),),
        seed=(
            ("Women's health", {"icon": "HeartPulse", "synonyms": ["women's health", "womens health", "health", "gynec", "gynaec", "pcos", "period"]}, ()),
            ("Pregnancy", {"icon": "Baby", "synonyms": ["pregnan", "maternal", "new mother"]}, ()),
            ("Fertility", {"icon": "Flower2", "synonyms": ["fertil", "pcos", "menstru"]}, ()),
            ("Nutrition", {"icon": "Apple", "synonyms": ["nutrition", "diet", "anaemia", "anemia"]}, ()),
            ("Mental wellness", {"icon": "Brain", "synonyms": ["mental", "counsel", "wellbeing", "well-being", "stress", "anxiety"]}, ()),
            ("Fitness", {"icon": "Dumbbell", "synonyms": ["fitness", "yoga", "exercise"]}, ()),
            ("Career", {"icon": "Briefcase", "synonyms": ["career", "interview", "workplace", "teaching", "leadership", "digital literacy"]},
             _s("Spoken English", "Communication", "Digital marketing")),
            ("Money", {"icon": "Wallet", "synonyms": ["money", "finance", "saving", "loan", "credit", "bookkeeping", "pricing"]},
             _s("Savings", "Bookkeeping", "Pricing", "Getting a loan")),
            ("Business", {"icon": "Store", "synonyms": ["business", "online selling", "marketing", "export", "operations", "whatsapp", "enterprise"]},
             _s("Getting started", "Finding customers", "Online selling")),
            ("Crafts & skills", {"icon": "Scissors", "synonyms": ["handicraft", "tailoring", "beauty", "mehendi", "craft", "food"]},
             _s("Tailoring", "Mehendi", "Beauty", "Cooking and tiffin", "Baking")),
            ("Rights & family", {"icon": "Scale", "synonyms": ["legal", "rights", "family", "parent"]}, ()),
        ),
    ),
    ListDef(
        "swap_skills", "learning", "Learn", "Skill swap tags",
        "Skills members offer to teach each other, shown as filters in Learn from each other.",
        uses=(Use("skill_swaps", "tags", many=True),), extras=("image",),
        seed=_s("Tailoring", "English", "Photography", "Bookkeeping", "Baking", "Social media", "Mehendi", "Computer basics"),
    ),
    ListDef(
        "opportunity_types", "growth", "Work", "Opportunity types",
        "The kinds of work posted in Find work: what members filter by and staff pick when posting.",
        uses=(Use("opportunities", "kind"),), extras=("image",),
        seed=_s("Job", "Internship", "Freelance", "Craft order", "Training"),
    ),
    ListDef(
        "event_categories", "growth", "Community", "Event categories",
        "What kind of event it is. Members filter Events by these.",
        uses=(Use("events", "category"),), extras=("image",),
        seed=_s("Workshop", "Mela", "Webinar", "Meet-up", "Talk", "Training"),
    ),
    ListDef(
        "circle_topics", "community", "Community", "Circle topics",
        "What a circle is about. Synonyms file older free-text topics under the right one.",
        extras=("icon", "synonyms", "image"),
        uses=(Use("circles", "topic"),),
        seed=(
            ("Business & Ideas", {"icon": "Lightbulb", "synonyms": ["business", "ideas", "craft", "crafts", "handmade", "food", "cooking", "beauty", "tailoring", "selling"]}, ()),
            ("Health & Wellness", {"icon": "HeartPulse", "synonyms": ["health", "wellness", "fitness", "mental health"]}, ()),
            ("Career & Skills", {"icon": "Briefcase", "synonyms": ["career", "careers", "skills", "digital", "digital literacy", "learning", "study", "work"]}, ()),
            ("Money & Finance", {"icon": "Wallet", "synonyms": ["money", "finance", "savings", "budgeting"]}, ()),
            ("Family & Life", {"icon": "Heart", "synonyms": ["family", "life", "parenting", "support", "work & family", "work and family", "home"]}, ()),
            ("Success Stories", {"icon": "Award", "synonyms": ["stories", "success", "success stories"]}, ()),
            ("Safety & Rights", {"icon": "ShieldCheck", "synonyms": ["safety", "rights", "legal", "law"]}, ()),
        ),
    ),
    ListDef(
        "circle_tags", "community", "Community", "Circle tags",
        "Suggested tags when a member starts a circle.",
        uses=(Use("circles", "tags", many=True),),
        seed=_s("business", "handmade", "women", "india", "tailoring", "cooking", "savings", "health", "study", "mehendi", "parenting", "first-job"),
    ),
    ListDef(
        "feed_report_reasons", "community", "Community", "Post report reasons",
        "Why a member reports a post in the Community feed.",
        uses=(Use("feed_reports", "reason"),),
        seed=_s("Rude or hurtful", "Spam or selling", "False information", "Not safe", "Something else"),
    ),
    ListDef(
        "safety_report_categories", "safety", "Help & safety", "Safety report categories",
        "Categories of a safety report, and the reasons a member picks when reporting a person. "
        "Add or disable; avoid renaming, since filed reports keep the category they were filed under.",
        levels=2, parent_name="Category",
        uses=(Use("safety_reports", "category"),),
        seed=(
            ("Harassment or abuse", {}, _s("Harassment or bullying")),
            ("A man on the platform", {}, ()),
            ("Fake or impersonating account", {}, _s("Fake or impersonating account")),
            ("Money or fraud", {}, _s("Asked for money, OTP or bank details", "Payment outside WomSakhi")),
            ("Something in a circle or post", {}, ()),
            ("Inappropriate or sexual content", {}, _s("Inappropriate or sexual content")),
            ("Threats or safety concern", {}, _s("Threats or safety concern")),
            ("Something else", {}, _s("Something else")),
        ),
    ),
    ListDef(
        "doctor_specialities", "appointments", "Health", "Doctor specialities",
        "What a doctor practises. Members find doctors by these.",
        extras=("icon", "image"),
        uses=(Use("doctors", "speciality"),),
        seed=_s("Gynaecologist", "Fertility specialist", "General physician", "Paediatrician", "Nutritionist",
                "Counsellor", "Endocrinologist", "Dermatologist", "Physiotherapist", "Other"),
    ),
    ListDef(
        "health_video_categories", "content", "Health", "Health video categories",
        "Shelves in the Health videos library.",
        uses=(Use("health_videos", "category"),), extras=("image",),
        seed=_s("Workout", "Yoga", "Meditation", "Pregnancy", "Nutrition", "Sleep", "Fertility", "Mentoring", "Health talks"),
    ),
    ListDef(
        "languages", "settings", "Everywhere", "Languages",
        "Languages a mentor, doctor or event can be in. The app's own display languages are separate.",
        uses=(Use("mentors", "languages", many=True), Use("doctors", "languages", many=True), Use("events", "language")),
        seed=_s("Hindi", "English", "Telugu", "Tamil", "Kannada", "Malayalam", "Marathi", "Bengali", "Gujarati",
                "Urdu", "Punjabi", "Odia", "Bhojpuri", "Hindi & English"),
    ),
    ListDef(
        "feedback_types", "feedback", "Support", "Feedback types",
        "What a member is telling us when she sends feedback. Staff filter feedback by these; "
        "“counts as” puts a type in the Suggestions or Complaints cards. "
        "Only the types with a note show on the member's feedback form.",
        extras=("icon", "note", "counts_as"),
        uses=(Use("feedback", "type"),),
        seed=(
            ("An idea", {"icon": "Lightbulb", "note": "Something you wish this app did", "counts_as": "Suggestion"}, ()),
            ("Something is broken", {"icon": "Bug", "note": "A screen or number that is wrong", "counts_as": "Complaint"}, ()),
            ("Something is confusing", {"icon": "HelpCircle", "note": "You could not work out how to do it", "counts_as": "Complaint"}, ()),
            ("Something good", {"icon": "Heart", "note": "What worked, so we keep it", "counts_as": "Praise"}, ()),
            ("Program Feedback", {"icon": "GraduationCap", "note": "", "counts_as": ""}, ()),
            ("Suggestion", {"icon": "Lightbulb", "note": "", "counts_as": "Suggestion"}, ()),
            ("Complaint", {"icon": "AlertTriangle", "note": "", "counts_as": "Complaint"}, ()),
        ),
    ),
    ListDef(
        "support_ticket_categories", "settings", "Support", "Staff support ticket categories",
        "What a staff member's support ticket is about.",
        uses=(Use("support_tickets", "category"),),
        seed=_s("Account & access", "A bug or something broken", "Billing", "Feature request", "Data or reporting", "Something else"),
    ),
    ListDef(
        "rental_categories", "market", "Earn", "Rent & borrow categories",
        "What women rent out to each other (routes/rentals.py). Members browse and list by these.",
        extras=("icon", "image"),
        uses=(Use("rental_items", "category"),),
        seed=tuple((label, {"icon": icon}, ()) for label, icon in (
            ("Sarees & lehengas", "Shirt"), ("Party & wedding wear", "Sparkles"), ("Jewellery", "Gem"),
            ("Baby & kids", "Baby"), ("Kitchen & big vessels", "CookingPot"), ("Event & decor", "PartyPopper"),
            ("Sewing & craft machines", "Scissors"), ("Home appliances", "Plug"), ("Tools", "Wrench"),
            ("Books & study", "BookOpen"), ("Travel & luggage", "Luggage"), ("Something else", "Package"),
        )),
    ),
]}


def _col():
    return get_database()[COLLECTION]


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")[:48] or "item"


def definition(list_key: str) -> ListDef:
    d = LISTS.get(list_key)
    if not d:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such list")
    return d


#: Lists whose seeded items were already given any newer extra fields this process.
_EXTRAS_FILLED: set[str] = set()


async def _fill_new_extras(d: ListDef) -> None:
    """
    A list seeded before an extra field existed gets that field on its seeded
    items, once per process. Only a MISSING field is filled, so nothing staff
    set is ever overwritten.
    """
    if d.key in _EXTRAS_FILLED:
        return
    _EXTRAS_FILLED.add(d.key)
    seeds = {label.lower(): extra for label, extra, _ in d.seed}
    seeds.update({cl.lower(): ce for _, _, kids in d.seed for cl, ce, _ in kids})
    async for r in _col().find({"list": d.key}, {"label": 1, "extra": 1}):
        have = r.get("extra") or {}
        missing = {f"extra.{k}": v for k, v in (seeds.get(r["label"].lower()) or {}).items() if k not in have}
        if missing:
            await _col().update_one({"_id": r["_id"]}, {"$set": missing})


async def ensure_seeded(list_key: str) -> None:
    d = definition(list_key)
    if await _col().count_documents({"list": list_key}, limit=1):
        await _fill_new_extras(d)
        return
    now = datetime.now(timezone.utc)
    rows, used = [], set()

    def key_for(label: str) -> str:
        k, n = slug(label), 2
        while k in used:
            k, n = f"{slug(label)}-{n}", n + 1
        used.add(k)
        return k

    for i, (label, extra, children) in enumerate(d.seed):
        pk = key_for(label)
        rows.append({"list": list_key, "key": pk, "label": label, "parent_key": None, "active": True,
                     "order": i, "extra": dict(extra), "created_at": now, "updated_at": now})
        for j, (cl, ce, _) in enumerate(children):
            rows.append({"list": list_key, "key": key_for(cl), "label": cl, "parent_key": pk, "active": True,
                         "order": j, "extra": dict(ce), "created_at": now, "updated_at": now})
    if rows:
        try:
            await _col().insert_many(rows, ordered=False)
        except Exception:  # noqa: BLE001 — a parallel first read seeded it; the unique index decided
            pass


async def rows(list_key: str, *, active_only: bool = False) -> list[dict]:
    await ensure_seeded(list_key)
    q: dict[str, Any] = {"list": list_key}
    if active_only:
        q["active"] = True
    return [r async for r in _col().find(q).sort([("order", 1), ("label", 1)])]


def view(r: dict) -> dict:
    extra = dict(r.get("extra") or {})
    if extra.get("image"):
        extra["image"] = media_url(extra["image"])
    return {"key": r["key"], "label": r["label"], "parent_key": r.get("parent_key") or None,
            "active": bool(r.get("active", True)), "order": int(r.get("order", 0)), "extra": extra}


def as_tree(d: ListDef, items: list[dict]) -> list[dict]:
    """Two-level lists come back as parents with `children`; one-level lists flat."""
    if d.levels == 1:
        return [view(r) for r in items]
    out = []
    for p in [r for r in items if not r.get("parent_key")]:
        out.append({**view(p), "children": [view(c) for c in items if c.get("parent_key") == p["key"]]})
    return out


async def labels(list_key: str, *, level: Optional[str] = None) -> list[str]:
    """Active labels, in staff's order. `level`: "parent" or "child" for two-level lists."""
    out = []
    for r in await rows(list_key, active_only=True):
        if level == "parent" and r.get("parent_key"):
            continue
        if level == "child" and not r.get("parent_key"):
            continue
        out.append(r["label"])
    return out


async def check(list_key: str, value: str, *, level: Optional[str] = None, field: str = "") -> str:
    """The canonical active label for `value`, or a 422 naming the choices."""
    v = (value or "").strip()
    choices = await labels(list_key, level=level)
    for c in choices:
        if c.lower() == v.lower():
            return c
    what = field or LISTS[list_key].name.lower().rstrip("s")
    shown = ", ".join(choices[:12]) + ("…" if len(choices) > 12 else "")
    raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, {
        "code": "not_in_master", "list": list_key,
        "message": f"Pick a {what} from the list: {shown}." if choices else f"There are no {what}s to pick from yet.",
    })


async def check_many(list_key: str, values: Iterable[str], **kw) -> list[str]:
    out: list[str] = []
    for v in values:
        c = await check(list_key, v, **kw)
        if c not in out:
            out.append(c)
    return out


async def usage(d: ListDef) -> dict[str, int]:
    """How many records use each label (case-insensitive), across every place the list is stored."""
    db = get_database()
    counts: dict[str, int] = {}
    for u in d.uses:
        pipeline: list[dict] = []
        if u.many:
            pipeline.append({"$unwind": f"${u.field}"})
        pipeline += [{"$match": {u.field: {"$type": "string", "$ne": ""}}},
                     {"$group": {"_id": {"$toLower": f"${u.field}"}, "n": {"$sum": 1}}}]
        async for g in db[u.collection].aggregate(pipeline):
            counts[g["_id"]] = counts.get(g["_id"], 0) + g["n"]
    return counts


async def carry_rename(d: ListDef, old: str, new: str) -> int:
    """A renamed item's new label written into every record that used the old one."""
    db = get_database()
    changed = 0
    for u in d.uses:
        if u.many:
            res = await db[u.collection].update_many(
                {u.field: old}, {"$set": {f"{u.field}.$[x]": new}}, array_filters=[{"x": old}])
        else:
            res = await db[u.collection].update_many({u.field: old}, {"$set": {u.field: new}})
        changed += res.modified_count
        if res.modified_count and u.collection in CACHED_FROM:
            # Pages built from these records are cached; drop them so the new
            # label shows now, not when the cache happens to expire.
            from app.core import cache
            cache.forget_prefix(CACHED_FROM[u.collection])
    return changed


#: Collections whose records feed a shared cache, and that cache's key prefix.
CACHED_FROM = {"programs": "catalog:"}
