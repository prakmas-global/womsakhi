"""
The thirteen sweeps, safety escalation, mood and the AI wall — against a real
database, with the flag on.

Not collected by pytest: it needs MongoDB and it writes. Run it by hand:

    ./venv/bin/python tests/acceptance_wiring.py
"""
import asyncio, os, sys
from datetime import datetime, timedelta, timezone
sys.path.insert(0, "/Users/praveenmaddela/Desktop/PRAKMAS-GLOBAL/womencrafts-backend/backend")
os.chdir("/Users/praveenmaddela/Desktop/PRAKMAS-GLOBAL/womencrafts-backend/backend")
from app.core.config import settings
settings.ENGINES_ENABLED = True
from app.db.mongodb import connect_db, close_db, get_database
from app.db.indexes import ensure_indexes
from app.core.seed_wellbeing import seed_wellbeing
from app.engines import mood, safety, wiring, tick, assist

ok = fail = 0
def check(label, got, want=None, truthy=False):
    global ok, fail
    good = bool(got) if truthy else got == want
    print(f"  {'PASS' if good else 'FAIL'}  {label:<52} {got!r}")
    if good: ok += 1
    else: fail += 1

async def main():
    await connect_db(); await ensure_indexes()
    db = get_database()

    print("── seed the four missing domains ──")
    seeded = await seed_wellbeing()
    for k, v in seeded.items(): print(f"   {k:<16} {v}")
    cards = await mood.seed_cards()
    acts = await mood.seed_activities()
    print(f"   support_cards    {cards}")
    print(f"   activities       {acts}")

    print("\n── all 13 sweeps ──")
    out = await wiring.run_sync()
    for k, v in out.items(): print(f"   {k:<16} {v}")
    fails = [k for k, v in out.items() if isinstance(v, str)]
    check("no sweep raised", fails, [])

    total = await db["reminder_definitions"].count_documents({})
    print(f"\n   reminders created: {total}")
    check("every domain produced reminders",
          await db["reminder_definitions"].distinct("domain.module"), truthy=True)
    async for r in db["reminder_definitions"].aggregate([
            {"$group": {"_id": "$domain.module", "n": {"$sum": 1}}},
            {"$sort": {"n": -1}}]):
        print(f"      {str(r['_id'] or '-'):<16} {r['n']}")

    print("\n── idempotent? ──")
    before = total
    await wiring.run_sync()
    after = await db["reminder_definitions"].count_documents({})
    check("second sweep created nothing", after, before)

    print("\n── safety escalation, end to end ──")
    # A member who ACTUALLY has trusted contacts — picking any member meant
    # the escalation path silently reported "no contacts" and never ran.
    mids = await db["trusted_contacts"].distinct("member_id")
    member = await db["users"].find_one({"member_id": {"$in": mids}})
    uid = str(member["_id"])
    print(f"   using member with {await db['trusted_contacts'].count_documents({'member_id': member.get('member_id')})} contacts")
    got = await safety.raise_alert(user_id=uid, journey_id="J1", reason="missed_checkin")
    check("contacts were told", got.get("told", 0) >= 1 or got.get("no_contacts"), True)
    if not got.get("no_contacts"):
        aid = got["alert_id"]
        esc = await db["reminder_definitions"].count_documents(
            {"domain.module": "engine_alerts", "domain.ref": aid})
        check("backup escalation scheduled", esc, 1)
        alert = await db["engine_alerts"].find_one({"_id": __import__("bson").ObjectId(aid)})
        cid = alert["contacts"][0]["contact_id"]
        check("acknowledgement accepted",
              await safety.acknowledge(alert_id=aid, contact_id=cid), True)
        live = await db["reminder_occurrences"].count_documents(
            {"definition_id": {"$in": [str(d["_id"]) async for d in
             db["reminder_definitions"].find({"domain.ref": aid})]},
             "state": "scheduled"})
        check("acknowledging stopped the ladder", live, 0)
        check("wellbeing follow-up after resolve",
              await safety.resolve(alert_id=aid, user_id=uid), True)

    print("\n── mood ──")
    res = await mood.check_in(user_id=uid, mood="tired", style="practical")
    check("check-in accepted", res.get("ok"), True)
    check("one reviewed card returned", (res.get("card") or {}).get("title"), truthy=True)
    check("'good' returns no card",
          (await mood.check_in(user_id=uid, mood="good")).get("card"), None)
    check("activity available",
          (await mood.reset_activity(user_id=uid)), truthy=True)
    check("one prompt per day", await mood.daily_prompt_allowed(uid), True)

    print("\n── the AI wall ──")
    for k in ("escalation", "risk_level", "crisis_wording", "safety_deadline",
              "medication_schedule", "stock_level"):
        check(f"AI may not decide {k}", assist.may_decide(k), False)
    check("AI may draft a reminder time", assist.may_decide("reminder_time"), True)
    t = await assist.suggest_time(user_id=uid, what="take the iron tablet")
    check("suggestion inside waking hours",
          "06:00" <= t["local_time"] <= "21:00", True)
    check("placeholders survive shortening",
          "{name}" in await assist.shorten(
              text="Hello {name}, your session with the mentor starts soon "
                   "and you should get ready now please", limit=40), True)

    print("\n── the minute tick must stay fast ──")
    import time as _t
    t0 = _t.monotonic()
    res = await tick.run_tick()
    ms = int((_t.monotonic() - t0) * 1000)
    check("tick ran clean", res.get("enabled"), True)
    check("tick well inside the 60s deadline", ms < 15000, True)
    print(f"   tick took {ms} ms")

    await close_db()
    print(f"\n{'='*64}\n  {ok} passed, {fail} failed\n{'='*64}")
    return 1 if fail else 0

sys.exit(asyncio.run(main()))
