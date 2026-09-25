"""
Mood, and the one card that follows it.

This is the part of the product most likely to be built badly, so the limits
come first:

- **A card shown after she checks in is a reply, not permission to start a
  series.** The catalogue says it outright. One voluntary tap produces one
  response; it does not enrol her in a daily push.
- **Silence means nothing.** Not distress, not consent, not worsening health,
  not disinterest. It is the single strongest instruction in §24.4 and it is
  why nothing here reads an absence as a signal.
- **Frequency never rises because she seems low.** No product may notice
  sadness and respond by asking for more attention.
- **Every card is reviewed before it can be shown.** `reviewed: true` is a
  record that a person read it, not a default — and an unreviewed card is
  simply not eligible, rather than shown with a disclaimer.

**One check-in record, three readers.** DAY-UC-003 asks that the daily
check-in be reused by Cycle and Wellbeing rather than each asking her
separately. So the mood lives in `cycle_days` — the collection that already
holds her day — and this module reads it rather than starting a fourth.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from bson import ObjectId

from app.db.mongodb import get_database
from app.engines import notify as notify_engine
from app.engines.schedule import zone
from app.models.reminders import ReminderModel

# What she can pick. Deliberately plain and few: a fifteen-point scale is a
# questionnaire, and she is not filling in a questionnaire.
MOODS = ("good", "tired", "low", "anxious", "angry", "unwell")

# How she would like to be met. CYCLE-UC-034 — the style is hers to choose,
# because the same words land differently on different days.
STYLES = ("practical", "gentle", "quiet", "none")


def _db():
    return get_database()


def _oid(v):
    try:
        return ObjectId(v)
    except Exception:  # noqa: BLE001
        return None


async def check_in(*, user_id: str, mood: str, note: str = "",
                   style: str | None = None) -> dict:
    """
    One tap. Written to the day she already has, not to a new collection.

    Returns the single card that follows, if she wants one — and nothing at
    all if her style is `none` or the mood is `good`, because a woman who says
    she is fine does not need to be handled.
    """
    if mood not in MOODS:
        return {"ok": False, "reason": "unknown_mood"}

    tz = zone(await _tz(user_id))
    today = datetime.now(timezone.utc).astimezone(tz).date().isoformat()

    await _db()["cycle_days"].update_one(
        {"user_id": user_id, "date": today},
        {"$set": {"mood": mood, "note": note or "",
                  "updated_at": datetime.now(timezone.utc)},
         "$setOnInsert": {"created_at": datetime.now(timezone.utc),
                          "period": False, "symptoms": [], "feelings": []}},
        upsert=True)

    if style:
        await _db()["preference_versions"].update_one(
            {"user_id": user_id},
            {"$set": {"support_style": style}}, upsert=False)

    card = await support_card(user_id=user_id, mood=mood)
    return {"ok": True, "mood": mood, "card": card}


async def support_card(*, user_id: str, mood: str | None = None) -> dict | None:
    """
    One reviewed card, chosen for how she said she feels.

    `good` returns nothing. So does a style of `quiet` or `none`. This is not
    an oversight — a product that always has something to say is a product
    that talks over her.
    """
    prefs = await _db()["preference_versions"].find_one(
        {"user_id": user_id}, sort=[("version", -1)]) or {}
    style = prefs.get("support_style") or "practical"
    if style in ("quiet", "none"):
        return None

    if mood is None:
        tz = zone(prefs.get("tz") or "Asia/Kolkata")
        today = datetime.now(timezone.utc).astimezone(tz).date().isoformat()
        day = await _db()["cycle_days"].find_one(
            {"user_id": user_id, "date": today}) or {}
        mood = day.get("mood")
    if not mood or mood == "good":
        return None

    card = await _db()["support_cards"].find_one(
        {"moods": mood, "styles": style, "reviewed": True})
    if not card:
        card = await _db()["support_cards"].find_one(
            {"moods": mood, "reviewed": True})
    if not card:
        return None
    return {"id": str(card["_id"]), "kind": card.get("kind", "word"),
            "title": card.get("title", ""), "body": card.get("body", ""),
            "minutes": card.get("minutes", 0)}


async def reset_activity(*, user_id: str) -> dict | None:
    """
    CYCLE-UC-018 — something to *do*, not something to read.

    Drawn from `content_activities`, which already exists in this database and
    already carries a tone.
    """
    # NOT `content_activities` — that is the admin content feed, and reading
    # it offered a woman having a bad afternoon "Blog post updated". Its own
    # collection, reviewed like the cards.
    row = await _db()["wellbeing_activities"].find_one({"reviewed": True})
    if not row:
        return None
    return {"id": str(row["_id"]), "text": row.get("text", ""),
            "minutes": row.get("minutes", 0), "icon": row.get("icon", "")}


async def set_encouragement(*, user_id: str, choice: str) -> bool:
    """
    General, a chosen scripture, or none — without losing the app (DAY-UC-013).

    `none` is a first-class answer, not a degraded one, and SPIRIT-UC-004
    requires that turning spiritual prompts off touches nothing else. So this
    writes one field and cancels one series; every other notification
    preference is untouched.
    """
    if choice not in ("general", "scripture", "none"):
        return False
    from app.engines import policy
    await policy.update(user_id, {"encouragement": choice})

    if choice != "scripture":
        from app.engines import reminders as rem
        await rem.reconcile(module="spirit", ref=user_id, event="cancelled")
    return True


async def daily_prompt_allowed(user_id: str) -> bool:
    """
    At most one proactive wellbeing prompt per LOCAL day (§24.4).

    Counted in her own timezone, because "one a day" means one of her days.
    The attention budget limits volume across all modules; this limits *this*
    series specifically, and both apply.
    """
    prefs = await _db()["preference_versions"].find_one(
        {"user_id": user_id}, sort=[("version", -1)]) or {}
    tz = zone(prefs.get("tz") or "Asia/Kolkata")
    local_midnight = datetime.now(timezone.utc).astimezone(tz).replace(
        hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
    sent = await _db()["notification_intents"].count_documents(
        {"user_id": user_id, "klass": ReminderModel.CLASS_DISCRETIONARY,
         "template_key": {"$regex": "^day\\.|^mood\\."},
         "created_at": {"$gte": local_midnight},
         "state": {"$in": ["dispatched", "queued"]}})
    return sent < 1


async def offer_prompt(user_id: str) -> str | None:
    """
    Ask how she is — at most once a day, and never because she seems low.

    The only signal used is the clock. Nothing here reads her recent moods to
    decide whether to ask more often, which is the specific behaviour §24.4
    forbids: *"Do not increase frequency because someone is lonely, sad, young
    or unlikely to return."*
    """
    if not await daily_prompt_allowed(user_id):
        return None
    return await notify_engine.raise_intent(
        user_id=user_id, template_key="mood.howAreYou",
        category="reminders", klass=ReminderModel.CLASS_DISCRETIONARY,
        ref=user_id,
        bucket=datetime.now(timezone.utc).date().isoformat(),
        payload={"series": "mood.howAreYou"},
        domain_module="mood")


async def seed_cards() -> int:
    """
    A small reviewed set, so the feature is usable rather than theoretical.

    Marked `reviewed: True` because these say nothing clinical and nothing
    about safety — they are ordinary human sentences. Anything that touches
    symptoms, medication or a crisis route stays `reviewed: False` until a
    person who is qualified has read it, and is therefore not shown.
    """
    cards = [
        ("tired", "practical", "word", "Tired is information",
         "Not weakness. If it has lasted weeks, the blood test at the "
         "government centre is free and worth an hour.", 0),
        ("tired", "gentle", "word", "You have done enough today",
         "Whatever is left will still be there tomorrow.", 0),
        ("low", "gentle", "word", "This will pass",
         "It does not feel like it while it is happening. It still passes.", 0),
        ("low", "practical", "do", "Ten minutes outside",
         "Light and moving air change how a low afternoon feels. "
         "Ten minutes is enough.", 10),
        ("anxious", "practical", "do", "Four slow breaths",
         "In for four, hold for four, out for six. Three times.", 2),
        ("anxious", "gentle", "word", "You are allowed to not know yet",
         "Nothing has to be decided this minute.", 0),
        ("angry", "practical", "do", "Put it in words first",
         "Write the message you want to send. Do not send it today.", 5),
        ("unwell", "practical", "word", "Rest is the work today",
         "If it is fever, pain that stops you working, or bleeding that "
         "soaks a pad every hour, go to the centre.", 0),
    ]
    made = 0
    for mood, style, kind, title, body, minutes in cards:
        key = f"seed:card:{mood}:{style}"
        if await _db()["support_cards"].find_one({"seed_key": key}):
            continue
        await _db()["support_cards"].insert_one({
            "seed_key": key, "moods": [mood], "styles": [style], "kind": kind,
            "title": title, "body": body, "minutes": minutes,
            # A record that a person read it, not a default.
            "reviewed": True, "reviewed_by": "founding team",
            "created_at": datetime.now(timezone.utc)})
        made += 1
    return made


async def seed_activities() -> int:
    """
    A few small things to actually do. Minutes, not moods.

    Every one is finishable in under fifteen minutes with nothing to buy and
    nobody to ask, because a suggestion that needs money or company is a
    suggestion for somebody else's afternoon.
    """
    rows = [
        ("Step outside for ten minutes", 10, "Sun"),
        ("Four slow breaths — in for four, out for six", 2, "Wind"),
        ("Drink a glass of water and sit down for five", 5, "Droplet"),
        ("Write the thing that is bothering you. Do not send it", 5, "PenLine"),
        ("Put on one song you like and do nothing else", 4, "Music"),
        ("Stretch your shoulders and neck", 3, "Activity"),
        ("Message one woman you have not spoken to this week", 5, "MessageCircle"),
    ]
    made = 0
    for text, minutes, icon in rows:
        key = f"seed:activity:{text[:24]}"
        if await _db()["wellbeing_activities"].find_one({"seed_key": key}):
            continue
        await _db()["wellbeing_activities"].insert_one({
            "seed_key": key, "text": text, "minutes": minutes, "icon": icon,
            "reviewed": True, "reviewed_by": "founding team",
            "created_at": datetime.now(timezone.utc)})
        made += 1
    return made


async def _tz(user_id: str) -> str:
    prefs = await _db()["preference_versions"].find_one(
        {"user_id": user_id}, sort=[("version", -1)])
    return (prefs or {}).get("tz") or "Asia/Kolkata"
