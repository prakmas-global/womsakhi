"""
Sample data for the reminder and notification engines.

WHY THIS EXISTS
    The engines are correct and completely invisible: `reminders` and
    `member_notifications` start empty, so every engine screen renders its
    empty state and nothing can be judged by looking at it. This fills one
    member's account with rows that cover every module, every schedule shape
    and every class, so the screens can be exercised for real.

WHAT IT IS NOT
    Not a production seed and not wired into `seed_all`. It writes for ONE
    member, marks everything it writes, and can take it all away again.

    Run it:      ./venv/bin/python scripts/seed_engine_demo.py
    Undo it:     ./venv/bin/python scripts/seed_engine_demo.py --clear
    Someone else: --email her@address

EVERY ROW IS MARKED
    `payload.demo = True` on reminders, `demo: True` on notifications. --clear
    deletes exactly those and nothing else, so a real reminder she set by hand
    while testing survives the reset.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.mongodb import close_db, connect_db, get_database   # noqa: E402
from app.models.conversation import MemberNotificationModel     # noqa: E402
from app.models.reminders import ReminderModel                  # noqa: E402

TZ = "Asia/Kolkata"
MARK = "demo"

R = ReminderModel


def _in(hours: float) -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=hours)


# ── the reminders ───────────────────────────────────────────────────────────
#
# Ordered the way the screen lists them, and chosen so that between them they
# cover: all three schedule types, all four classes, all five categories, a
# preset key and an engine key, and a row from every module that can make one.
#
# `klass` matters on screen: anything that is not `user` wears the "We set this
# for you" pill, which is how she tells her own reminder from the app's.
REMINDERS = [
    # ── the ones she set herself (no pill) ──────────────────────────────
    dict(title_key="rem.preset.tablet", klass=R.CLASS_USER, category="reminders",
         module="health", schedule="recurring", local_time="20:00", days=[]),
    dict(title_key="rem.preset.study", klass=R.CLASS_USER, category="learning",
         module="learn", schedule="recurring", local_time="19:00", days=[0, 2, 4]),
    dict(title_key="rem.preset.circle", klass=R.CLASS_USER, category="circles",
         module="circles", schedule="recurring", local_time="09:00", days=[4]),
    dict(title_key="rem.preset.supplies", klass=R.CLASS_USER, category="orders",
         module="shop", schedule="recurring", local_time="10:00", days=[0]),
    dict(title_key="rem.preset.children", klass=R.CLASS_USER, category="reminders",
         module="family", schedule="recurring", local_time="15:30", days=[0, 1, 2, 3, 4]),
    dict(title_key="rem.preset.water", klass=R.CLASS_USER, category="reminders",
         module="health", schedule="recurring", local_time="12:00", days=[]),
    dict(title_key="rem.preset.clinic", klass=R.CLASS_USER, category="reminders",
         module="health", schedule="once", at=_in(30)),
    dict(title_key="rem.preset.charge", klass=R.CLASS_USER, category="reminders",
         module="day", schedule="recurring", local_time="21:00", days=[]),

    # ── the ones the engine set for her (pill) ──────────────────────────
    # Money / circles
    dict(title_key="circles.contributionDue", klass=R.CLASS_TRANSACTIONAL, category="circles",
         module="circles", schedule="once", at=_in(20), ref="circle:demo-1"),
    dict(title_key="circles.weeklyDigest", klass=R.CLASS_DISCRETIONARY, category="circles",
         module="circles", schedule="recurring", local_time="18:00", days=[6]),
    dict(title_key="school.feeNextWeek", klass=R.CLASS_TRANSACTIONAL, category="reminders",
         module="school_fees", schedule="once", at=_in(36), ref="fee:demo-1"),
    dict(title_key="benefit.closesSoon", klass=R.CLASS_TRANSACTIONAL, category="reminders",
         module="benefit_claims", schedule="once", at=_in(44), ref="claim:demo-1"),

    # Work / earn
    dict(title_key="jobs.closesSoon", klass=R.CLASS_TRANSACTIONAL, category="reminders",
         module="jobs", schedule="once", at=_in(14), ref="job:demo-1"),
    dict(title_key="applications.followUp", klass=R.CLASS_DISCRETIONARY, category="reminders",
         module="applications", schedule="once", at=_in(60), ref="appl:demo-1"),
    dict(title_key="documents.orderWaiting", klass=R.CLASS_TRANSACTIONAL, category="orders",
         module="documents", schedule="once", at=_in(6), ref="order:demo-1"),
    dict(title_key="shopping.item", klass=R.CLASS_DISCRETIONARY, category="orders",
         module="shopping", schedule="recurring", local_time="10:30", days=[5]),

    # Learning
    dict(title_key="mentors.session", klass=R.CLASS_TRANSACTIONAL, category="learning",
         module="mentors", schedule="event_relative", offset=-60, anchor=_in(26),
         ref="session:demo-1"),
    dict(title_key="events.tomorrow", klass=R.CLASS_DISCRETIONARY, category="learning",
         module="events", schedule="once", at=_in(24), ref="event:demo-1"),

    # Goals
    dict(title_key="goals.aWeekLeft", klass=R.CLASS_DISCRETIONARY, category="reminders",
         module="goals", schedule="once", at=_in(40), ref="goal:demo-1"),

    # Health
    dict(title_key="health.takeYourTablet", klass=R.CLASS_TRANSACTIONAL, category="reminders",
         module="health_habits", schedule="recurring", local_time="08:00", days=[]),
    dict(title_key="cycle.logToday", klass=R.CLASS_DISCRETIONARY, category="reminders",
         module="cycle", schedule="recurring", local_time="21:30", days=[]),
    dict(title_key="health.screeningDue", klass=R.CLASS_TRANSACTIONAL, category="reminders",
         module="health", schedule="once", at=_in(72), ref="screening:demo-1"),

    # Care circle
    dict(title_key="care.taskSoon", klass=R.CLASS_TRANSACTIONAL, category="reminders",
         module="care", schedule="once", at=_in(10), ref="care:demo-1"),

    # The day
    dict(title_key="day.morningPriorities", klass=R.CLASS_DISCRETIONARY, category="reminders",
         module="day", schedule="recurring", local_time="07:30", days=[]),

    # Safety. Exempt from quiet hours, the daily cap and pause — which is why
    # one belongs in any sample: it is the row that proves those exemptions.
    dict(title_key="travel.checkInDue", klass=R.CLASS_SAFETY, category="safety",
         module="travel", schedule="once", at=_in(2), ref="journey:demo-1"),
]


# ── the inbox ───────────────────────────────────────────────────────────────
#
# What the engine would have delivered over the last few days. These are
# sentences, not keys: `member_notifications` stores rendered text, because it
# is a record of what was actually SAID to her.
NOTIFICATIONS = [
    ("reminder", "Circle money is due on Friday",
     "₹500 to Career Growth Circle. Set 3 days ahead, as you asked.",
     "/app/circles", 1),
    ("money", "₹1,200 reached your wallet",
     "From order #WC-4481. Nothing is held back.", "/app/wallet", 3),
    ("circle", "Meera paid her instalment",
     "Career Growth Circle is now 5 of 6 for this month.", "/app/circles", 5),
    ("program", "You are 10% through Bridal Makeup Professional",
     "Twenty minutes tomorrow finishes lesson two.", "/app/programs", 8),
    ("booking", "Your mentor session moved",
     "Career Guidance with Ananya is now Oct 3, 11:00 AM.", "/app/bookings", 14),
    ("health", "Time to log today",
     "One tap. Only you can see it.", "/app/health/today", 20),
    ("event", "Women in Tech – Career Talk is tomorrow",
     "Online, 6:00 PM. You said you would come.", "/app/events", 26),
    ("mentorship", "Kavita accepted your request",
     "She mentors women selling online.", "/app/mentors", 32),
    ("money", "School fee due next week",
     "₹2,400 for Riya. Seven days from today.", "/app/money", 40),
    ("safety", "You arrived safely",
     "Your journey to Kothapet closed at 7:42 PM. Nobody was alerted.",
     "/app/travel/journey", 50),
    ("message", "Two new messages in Moms & Motherhood",
     "", "/app/messages", 62),
    ("account", "Your certificate is ready",
     "Financial Basics for Women. Download or share it.", "/app/certificates", 80),
]


async def run(email: str, clear: bool) -> None:
    await connect_db()
    db = get_database()

    user = await db["users"].find_one({"email": email}, {"_id": 1, "full_name": 1})
    if not user:
        raise SystemExit(f"No user with email {email!r}. Pass --email.")
    uid = str(user["_id"])
    who = user.get("full_name") or email

    rem = db[R.collection_name]
    notes = db[MemberNotificationModel.collection_name]

    # Always clear first, so running twice does not double every row.
    gone_r = (await rem.delete_many({"user_id": uid, f"payload.{MARK}": True})).deleted_count
    gone_n = (await notes.delete_many({"user_id": uid, MARK: True})).deleted_count
    if clear:
        print(f"Cleared {gone_r} reminders and {gone_n} notifications for {who}.")
        await close_db()
        return
    if gone_r or gone_n:
        print(f"Replacing {gone_r} reminders and {gone_n} notifications.")

    docs = []
    for r in REMINDERS:
        doc = R.create_document(
            user_id=uid,
            title_key=r["title_key"],
            schedule_type=r["schedule"],
            tz=TZ,
            klass=r["klass"],
            category=r["category"],
            domain_module=r.get("module", ""),
            domain_ref=r.get("ref", ""),
            at=r.get("at"),
            local_time=r.get("local_time", ""),
            days=r.get("days"),
            offset_minutes=r.get("offset", 0),
            anchor_at=r.get("anchor"),
            payload={MARK: True},
            created_by="member" if r["klass"] == R.CLASS_USER else "system",
        )
        docs.append(doc)
    await rem.insert_many(docs)

    now = datetime.now(timezone.utc)
    ndocs = []
    for ntype, title, body, href, hours_ago in NOTIFICATIONS:
        d = MemberNotificationModel.create_document(
            user_id=uid, title=title, body=body, ntype=ntype, href=href)
        d["created_at"] = now - timedelta(hours=hours_ago)
        # The first four are still unread, the rest already seen — so the badge
        # shows a believable number instead of every row shouting at once.
        d["unread"] = hours_ago <= 14
        d[MARK] = True
        ndocs.append(d)
    await notes.insert_many(ndocs)

    unread = sum(1 for n in ndocs if n["unread"])
    print(f"{who} <{email}>")
    print(f"  {len(docs)} reminders  "
          f"({sum(1 for r in REMINDERS if r['klass'] == R.CLASS_USER)} hers, "
          f"{len(REMINDERS) - sum(1 for r in REMINDERS if r['klass'] == R.CLASS_USER)} set by the engine)")
    print(f"  {len(ndocs)} notifications ({unread} unread)")
    await close_db()


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--email", default="member@womsakhi.com")
    ap.add_argument("--clear", action="store_true", help="remove the demo rows and stop")
    a = ap.parse_args()
    asyncio.run(run(a.email, a.clear))
