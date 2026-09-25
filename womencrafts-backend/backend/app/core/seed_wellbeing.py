"""
Seed the four new domains against real members.

**Why seed at all.** School fees, care tasks, benefit claims and health habits
had no collections, so the sweeps that schedule them had nothing to sweep and
could not be proven. Seeding gives the engine real rows with real dates, owned
by real member ids — which is the difference between "the code runs" and "the
reminder arrives".

**Idempotent, and it never invents a member.** Every row is keyed by
`seed_key` like the rest of this codebase, so running it twice changes
nothing. It attaches only to accounts that already exist; if there are no
active members it does nothing rather than creating fictional people.

**Dates are relative to today**, not fixed, so a seed run in March and one in
September both produce deadlines the sweeps will actually pick up.
"""

from datetime import datetime, timedelta, timezone

from app.db.mongodb import get_database
from app.models.wellbeing import (BenefitClaimModel, CareTaskModel,
                                  HealthHabitModel, SchoolFeeModel)


async def seed_wellbeing() -> dict:
    db = get_database()
    now = datetime.now(timezone.utc)
    today = now.date()

    members = await db["users"].find(
        {"role": "Member", "verification_status": "active"},
        {"_id": 1, "member_id": 1, "full_name": 1},
    ).to_list(length=12)
    if not members:
        return {"skipped": "no active members"}

    made = {"school_fees": 0, "care_tasks": 0,
            "benefit_claims": 0, "health_habits": 0}

    # ── school fees ────────────────────────────────────────────────────────
    fees = [("Term 2 fees", 450000, 12), ("Books and uniform", 120000, 26),
            ("Exam fee", 80000, 54)]
    for i, m in enumerate(members[:6]):
        uid, mid = str(m["_id"]), m.get("member_id") or ""
        for label, amount, in_days in fees:
            key = f"seed:fee:{uid}:{label}"
            if await db[SchoolFeeModel.collection_name].find_one({"seed_key": key}):
                continue
            doc = SchoolFeeModel.create_document(
                user_id=uid, member_id=mid,
                child_name=["Ananya", "Riya", "Meera"][i % 3],
                school="Government High School",
                label=label, amount_minor=amount,
                due_on=str(today + timedelta(days=in_days)))
            doc["seed_key"] = key
            await db[SchoolFeeModel.collection_name].insert_one(doc)
            made["school_fees"] += 1

    # ── care tasks ─────────────────────────────────────────────────────────
    circle = await db["circles"].find_one({})
    cid = str(circle["_id"]) if circle else "seed-circle"
    tasks = [("meal", "Take dinner to Lakshmi", 1),
             ("transport", "Lift to the clinic appointment", 3),
             ("childcare", "Mind the children on Thursday", 5),
             ("errand", "Collect her ration", 8)]
    for i, m in enumerate(members[:5]):
        uid = str(m["_id"])
        kind, label, in_days = tasks[i % len(tasks)]
        key = f"seed:care:{uid}:{kind}"
        if await db[CareTaskModel.collection_name].find_one({"seed_key": key}):
            continue
        doc = CareTaskModel.create_document(
            circle_id=cid, owner_user_id=uid,
            for_member=members[(i + 1) % len(members)].get("full_name", "a member"),
            kind=kind, label=label,
            due_at=now + timedelta(days=in_days, hours=2))
        doc["seed_key"] = key
        await db[CareTaskModel.collection_name].insert_one(doc)
        made["care_tasks"] += 1

    # ── benefit claims ─────────────────────────────────────────────────────
    schemes = [
        ("pmmvy", "Pradhan Mantri Matru Vandana Yojana", 21,
         ["Aadhaar", "Bank passbook", "MCP card"]),
        ("ujjwala", "PM Ujjwala Yojana — LPG connection", 40,
         ["Aadhaar", "Ration card"]),
        ("sukanya", "Sukanya Samriddhi account", 9,
         ["Birth certificate", "Aadhaar"]),
    ]
    for i, m in enumerate(members[:6]):
        uid, mid = str(m["_id"]), m.get("member_id") or ""
        skey, name, in_days, papers = schemes[i % len(schemes)]
        key = f"seed:benefit:{uid}:{skey}"
        if await db[BenefitClaimModel.collection_name].find_one({"seed_key": key}):
            continue
        doc = BenefitClaimModel.create_document(
            user_id=uid, member_id=mid, scheme_key=skey, scheme_name=name,
            closes_on=str(today + timedelta(days=in_days)), papers_needed=papers)
        doc["seed_key"] = key
        await db[BenefitClaimModel.collection_name].insert_one(doc)
        made["benefit_claims"] += 1

    # ── health habits and screenings ───────────────────────────────────────
    habits = [
        (HealthHabitModel.KIND_MEDICATION, "Iron tablet", 7, "20:00",
         "Free from the anganwadi. One a week, not one a day."),
        (HealthHabitModel.KIND_HABIT, "Ten minutes of stretching", 1, "07:00",
         "For the shoulders and the lower back."),
        (HealthHabitModel.KIND_SCREENING, "Blood test for strength", 180, "09:00",
         "Free at the government centre."),
        (HealthHabitModel.KIND_SCREENING, "Blood pressure check", 90, "09:30", ""),
    ]
    for i, m in enumerate(members[:8]):
        uid, mid = str(m["_id"]), m.get("member_id") or ""
        kind, label, every, at, note = habits[i % len(habits)]
        key = f"seed:habit:{uid}:{label}"
        if await db[HealthHabitModel.collection_name].find_one({"seed_key": key}):
            continue
        doc = HealthHabitModel.create_document(
            user_id=uid, member_id=mid, kind=kind, label=label,
            every_days=every, local_time=at, note=note,
            next_due=str(today + timedelta(days=min(every, 14))))
        doc["seed_key"] = key
        await db[HealthHabitModel.collection_name].insert_one(doc)
        made["health_habits"] += 1

    return made
