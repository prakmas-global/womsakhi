"""
Sample doctors for Health & Wellness → Doctor Consultation, for development.

The doctor directory is staff-kept (see routes/doctors.py), so a fresh database
shows "Doctors are being added". This fills it with ten sample doctors across
the specialities, with weekly hours, so the whole flow — find, book, confirm,
complete, prescription — can be tried. Every row is marked `demo: True`, its
registration number starts with DEMO- and its bio says it is a sample, so no
one mistakes it for a real doctor; `--remove` takes all of it out again.

    python -m app.core.seed_demo_doctors                    # add the doctors not there yet
    python -m app.core.seed_demo_doctors --dry-run          # say what would be added
    python -m app.core.seed_demo_doctors --for EMAIL        # also give that member sample consultations
    python -m app.core.seed_demo_doctors --remove           # delete every sample doctor and sample consultation

Doctors are loaded through the model staff use (`DoctorUpsert`). Running it
twice adds nothing. Refuses in production, always: sample doctors must never
reach real members.
"""

from __future__ import annotations

import asyncio
import sys
from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.db.mongodb import get_database
from app.routes.doctors import CONSULTS, DOCTORS, IST, DoctorUpsert, _iso, _slots_for, _taken

SAMPLE = "Sample profile for testing — not a real doctor."


def _hours(days: list[str], start: str, end: str, slot: int = 20) -> list[dict]:
    return [{"day": d, "start": start, "end": end, "slot_minutes": slot} for d in days]


WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"]

DOCTORS_DATA: list[dict] = [
    dict(name="Dr. Meera Iyer", speciality="Gynaecologist", qualifications="MBBS, MS (Obstetrics & Gynaecology)",
         languages=["English", "Hindi", "Tamil"], experience_years=14, fee_minor=500_00, modes=["Video", "Clinic"],
         clinic="Sakhi Women's Clinic, T. Nagar", city="Chennai",
         bio="Periods, PCOS, pregnancy care and menopause. Unhurried visits, plain explanations.",
         availability=_hours(["Mon", "Wed", "Fri"], "10:00", "13:00") + _hours(["Sat"], "09:00", "12:00")),
    dict(name="Dr. Ananya Rao", speciality="Fertility specialist", qualifications="MBBS, DGO, Fellowship in Reproductive Medicine",
         languages=["English", "Telugu", "Hindi"], experience_years=11, fee_minor=800_00, modes=["Video", "Clinic"],
         clinic="Bloom Fertility Centre, Banjara Hills", city="Hyderabad",
         bio="Trying to conceive, irregular cycles, PCOS and fertility tests — what they mean and what comes next.",
         availability=_hours(["Tue", "Thu"], "11:00", "15:00", 30)),
    dict(name="Dr. Farah Sheikh", speciality="General physician", qualifications="MBBS, MD (General Medicine)",
         languages=["English", "Hindi", "Urdu"], experience_years=9, fee_minor=300_00, modes=["Video", "Phone"],
         city="Lucknow", bio="Fever, tiredness, anaemia, BP and sugar checks — and when to see a specialist.",
         availability=_hours(WEEKDAYS + ["Sat"], "17:00", "20:00", 15)),
    dict(name="Dr. Kavitha Nair", speciality="Paediatrician", qualifications="MBBS, MD (Paediatrics)",
         languages=["English", "Malayalam", "Tamil"], experience_years=16, fee_minor=500_00, modes=["Video", "Clinic"],
         clinic="Little Steps Child Clinic, Kadavanthra", city="Kochi",
         bio="Newborn care, feeding, vaccinations and growth — questions from expecting and new mothers welcome.",
         availability=_hours(["Mon", "Tue", "Thu"], "09:30", "12:30")),
    dict(name="Ritu Malhotra", speciality="Nutritionist", qualifications="MSc Food & Nutrition, Registered Dietitian",
         languages=["Hindi", "English", "Punjabi"], experience_years=8, fee_minor=400_00, modes=["Video", "Phone"],
         city="Delhi", bio="Simple Indian meal plans for anaemia, PCOS, pregnancy and weight — vegetarian or not.",
         availability=_hours(WEEKDAYS, "14:00", "18:00", 30)),
    dict(name="Dr. Sneha Kulkarni", speciality="Counsellor", qualifications="MPhil Clinical Psychology (RCI registered)",
         languages=["Marathi", "Hindi", "English"], experience_years=7, fee_minor=600_00, modes=["Video", "Phone"],
         city="Pune", bio="Stress, low mood, anxiety, family pressure and postpartum feelings. A safe, private space to talk.",
         availability=_hours(["Mon", "Wed", "Fri"], "16:00", "20:00", 45) + _hours(["Sun"], "10:00", "13:00", 45)),
    dict(name="Dr. Lakshmi Venkatesh", speciality="Endocrinologist", qualifications="MD (Medicine), DM (Endocrinology)",
         languages=["Tamil", "English", "Kannada"], experience_years=12, fee_minor=700_00, modes=["Video", "Clinic"],
         clinic="Hormone & Diabetes Care, Jayanagar", city="Bengaluru",
         bio="Thyroid, PCOS, diabetes and weight changes — reading your reports together.",
         availability=_hours(["Tue", "Wed", "Sat"], "10:00", "13:00")),
    dict(name="Dr. Priyanka Das", speciality="Dermatologist", qualifications="MBBS, MD (Dermatology)",
         languages=["Bengali", "Hindi", "English"], experience_years=6, fee_minor=500_00, modes=["Video"],
         city="Kolkata", bio="Acne, pigmentation, hair fall and skin changes in pregnancy.",
         availability=_hours(["Mon", "Thu", "Sat"], "18:00", "21:00")),
    dict(name="Neha Joshi", speciality="Physiotherapist", qualifications="BPT, MPT (Women's Health)",
         languages=["Hindi", "Gujarati", "English"], experience_years=10, fee_minor=400_00, modes=["Video", "Clinic"],
         clinic="MoveWell Physio, Navrangpura", city="Ahmedabad",
         bio="Back pain, pelvic floor, pregnancy and post-delivery recovery exercises.",
         availability=_hours(["Tue", "Thu", "Sat"], "08:00", "11:00", 30)),
    dict(name="Dr. Shalini Verma", speciality="Gynaecologist", qualifications="MBBS, DNB (Obstetrics & Gynaecology)",
         languages=["Hindi", "English"], experience_years=20, fee_minor=0, modes=["Phone", "Video"],
         city="Jaipur", bio="Free phone advice on Saturdays for WomSakhi members: periods, pregnancy, contraception.",
         availability=_hours(["Sat"], "10:00", "14:00", 15) + _hours(["Wed"], "15:00", "17:00", 15)),
]


async def _db():
    from app.db import mongodb
    if mongodb._client is None:
        await mongodb.connect_db()
    return get_database()


async def add_doctors(db, dry_run: bool) -> dict[str, dict]:
    have = {d["name"]: d async for d in db[DOCTORS].find({"demo": True})}
    added = 0
    for i, row in enumerate(DOCTORS_DATA):
        if row["name"] in have:
            continue
        body = DoctorUpsert(**{**row, "registration_no": f"DEMO-{i + 1:04d}", "bio": f"{row['bio']} {SAMPLE}"})
        print(f"  + {body.speciality:<21} {body.name} · {body.city}")
        added += 1
        if dry_run:
            continue
        now = datetime.now(timezone.utc)
        doc = {**body.model_dump(), "availability": [h.model_dump() for h in body.availability],
               "verified_at": now, "verified_by": "demo-seed", "demo": True, "created_at": now, "updated_at": now}
        doc["_id"] = (await db[DOCTORS].insert_one(doc)).inserted_id
        have[doc["name"]] = doc
    print(f"{'Would add' if dry_run else 'Added'} {added} sample doctors; {len(DOCTORS_DATA) - added} already there.")
    return have


async def add_consultations(db, email: str, doctors: dict[str, dict], dry_run: bool) -> None:
    """Four consultations for one member: confirmed and requested ahead, one done with a prescription, one cancelled."""
    user = await db["users"].find_one({"email": email.strip().lower()})
    if not user:
        print(f"No account with the email {email}.")
        return
    uid = str(user["_id"])
    if await db[CONSULTS].count_documents({"user_id": uid, "demo": True}):
        print("That member already has sample consultations.")
        return
    now = datetime.now(timezone.utc)

    async def next_free(doc: dict, after_days: int = 1) -> datetime:
        day0 = now.astimezone(IST).date()
        taken = await _taken(str(doc["_id"]), now, now + timedelta(days=30))
        for i in range(after_days, 30):
            slots = _slots_for(doc, day0 + timedelta(days=i), taken, now)
            if slots:
                return slots[0].astimezone(timezone.utc)
        return now + timedelta(days=7)

    def base(doc: dict, start: datetime, mode: str, reason: str, symptoms: list[str], status: str) -> dict:
        return {
            "user_id": uid, "member_name": user.get("full_name", ""), "doctor_id": str(doc["_id"]),
            "doctor_name": doc["name"], "speciality": doc["speciality"], "doctor_photo": doc.get("photo") or "",
            "fee_minor": int(doc.get("fee_minor") or 0), "clinic": doc.get("clinic", ""), "city": doc.get("city", ""),
            "start": start, "mode": mode, "reason": reason, "symptoms": symptoms, "status": status,
            "demo": True, "created_at": now - timedelta(days=1), "updated_at": now,
        }

    meera, ritu, farah, priyanka = (doctors[n] for n in ("Dr. Meera Iyer", "Ritu Malhotra", "Dr. Farah Sheikh", "Dr. Priyanka Das"))
    s1, s2 = await next_free(meera, 2), await next_free(ritu, 3)
    past = datetime.combine((now - timedelta(days=12)).astimezone(IST).date(), datetime.strptime("18:00", "%H:%M").time(), IST)
    rows = [
        {**base(meera, s1, "Video", "Irregular periods for the last three months", ["Cramps", "Tiredness"], "confirmed"),
         "slot_key": f"{meera['_id']}|{_iso(s1)}",
         "join_info": "Join from this page 10 minutes before the start; the doctor will call you on video. (Sample)"},
        {**base(ritu, s2, "Phone", "A vegetarian diet plan for low haemoglobin", ["Tiredness"], "requested"),
         "slot_key": f"{ritu['_id']}|{_iso(s2)}"},
        {**base(farah, past.astimezone(timezone.utc), "Video", "Feeling tired all the time, short of breath on stairs",
                ["Tiredness", "Headache"], "completed"),
         "prescription": {"text": "1. Ferrous ascorbate + folic acid — 1 tablet after lunch, for 3 months.\n"
                                  "2. Vitamin D3 60,000 IU — 1 sachet once a week, for 8 weeks.\n"
                                  "3. Eat more green leafy vegetables, dates, jaggery and lentils.\n"
                                  "Repeat haemoglobin test after 6 weeks.\n(Sample prescription for testing.)",
                          "file": "", "at": past.astimezone(timezone.utc) + timedelta(hours=1), "by": "demo-seed"},
         "completed_at": past.astimezone(timezone.utc) + timedelta(hours=1)},
        {**base(priyanka, (now - timedelta(days=5)).replace(minute=0, second=0, microsecond=0), "Video",
                "Hair fall for two months", [], "cancelled"),
         "cancelled_by": "staff", "cancel_reason": "The doctor was unavailable that day — please book another time. (Sample)"},
    ]
    for r in rows:
        print(f"  + {r['status']:<10} {r['doctor_name']} · {r['start'].astimezone(IST):%a %d %b %I:%M %p}")
    if not dry_run:
        await db[CONSULTS].insert_many(rows)
    print(f"{'Would add' if dry_run else 'Added'} {len(rows)} sample consultations for {email}.")


async def remove(db, dry_run: bool) -> None:
    ids = [str(d["_id"]) async for d in db[DOCTORS].find({"demo": True}, {"_id": 1})]
    consult_q = {"$or": [{"demo": True}, {"doctor_id": {"$in": ids}}]}
    n_consults = await db[CONSULTS].count_documents(consult_q)
    if not dry_run:
        await db[CONSULTS].delete_many(consult_q)
        await db[DOCTORS].delete_many({"demo": True})
    print(f"{'Would remove' if dry_run else 'Removed'} {len(ids)} sample doctors and {n_consults} consultations with them.")


async def main(argv: list[str]) -> None:
    if settings.is_production:
        print("Refusing: sample doctors are for development only.")
        return
    dry_run = "--dry-run" in argv
    db = await _db()
    if "--remove" in argv:
        await remove(db, dry_run)
        return
    doctors = await add_doctors(db, dry_run)
    if "--for" in argv:
        i = argv.index("--for")
        if i + 1 < len(argv):
            if dry_run and len(doctors) < len(DOCTORS_DATA):
                print("(Sample consultations need the doctors added first — run without --dry-run.)")
            else:
                await add_consultations(db, argv[i + 1], doctors, dry_run)


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:]))
