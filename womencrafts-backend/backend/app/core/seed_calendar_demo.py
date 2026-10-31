"""Add labelled calendar examples to active development members, without deliveries."""
from collections import Counter
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from zoneinfo import ZoneInfo

from bson import ObjectId

from app.models.enrollment import BookingModel
from app.models.growth import EventModel, EventRegistrationModel
from app.models.service import ServiceModel

BATCH = "calendar-demo-v1"
NOTE = "[DEMO] Calendar practice only. No real appointment, payment or live meeting."


async def seed_calendar_demo(db, users, now=None):
    now = now or datetime.now(timezone.utc)
    local_now = now.astimezone(ZoneInfo("Asia/Kolkata"))
    today = local_now.date()
    first = today - timedelta(days=(today.weekday()+1)%7)
    inserted = Counter()

    async def add(collection, key, document):
        oid = ObjectId(sha256(f"{BATCH}:{collection}:{key}".encode()).hexdigest()[:24])
        document.update(demo_batch=BATCH, demo_key=key, demo_data=True)
        result = await db[collection].update_one({"_id":oid},{"$setOnInsert":document},upsert=True)
        if result.upserted_id: inserted[collection] += 1
        return str(oid)

    service = await add("services", "practice-service", ServiceModel.create_document(
        "[DEMO] Calendar practice session", duration="45 min", price="₹0", status="Inactive", description=NOTE))
    patterns = [
        (0,"Wellness","Stretch and self-care break","07:30 AM","30 min"),
        (1,"Business","Plan your home-business week","11:00 AM","45 min"),
        (2,"Community","Community planning — time to be confirmed","","45 min"),
        (3,"Finance","Pricing and household budget","04:00 PM","45 min"),
        (5,"Community","Women supporting women","06:00 PM","30 min"),
        (6,"Workshop","Photograph handmade products","11:00 AM","60 min"),
    ]
    for week in range(2):
        for day,category,title,clock,duration in patterns:
            date = (first+timedelta(days=week*7+day)).isoformat()
            event = await add("events", f"{first}:{week}:{day}", EventModel.create_document(
                f"[DEMO] {title}", desc=NOTE, category=category, cover="/ux/art/scene-woman-writing-notes.webp",
                date_iso=date, time=clock, duration=duration, mode="Online", venue="[DEMO] No live meeting",
                host="[DEMO] WomSakhi practice group", seats=max(20,len(users)), fee=0, language="English"))
            # The attendee counter and registrations are created together only
            # for a newly inserted demo event; rerunning never resets a member's choices.
            for user in users:
                uid = str(user["_id"])
                await add("event_registrations",f"{event}:{uid}",EventRegistrationModel.create_document(
                    uid,str(user.get("member_id") or ""),event,f"[DEMO] {title}"))
            count = await db.event_registrations.count_documents({"event_id":event,"status":{"$ne":"cancelled"}})
            await db.events.update_one({"_id":ObjectId(event),"demo_batch":BATCH},{"$set":{"registered_count":count}})
        for user in users:
            uid = str(user["_id"])
            for day,title,clock,duration,mentor in [
                (2,"Tailoring practice lesson","10:00 AM","45 min",False),
                (4,"Mentor: price your handmade work","02:30 PM","30 min",True),
                (6,"Craft photography practice","02:00 PM","60 min",False),
            ]:
                date = (first+timedelta(days=week*7+day)).isoformat()
                booking = BookingModel.create_document(uid,str(user.get("member_id") or ""),service,
                    f"[DEMO] {title}",date,clock,note=NOTE,with_whom="[DEMO] Practice mentor" if mentor else "",duration=duration)
                start = datetime.strptime(f"{date} {clock}","%Y-%m-%d %I:%M %p").replace(tzinfo=ZoneInfo("Asia/Kolkata"))
                if start < local_now: booking["status"] = "completed"
                await add("bookings",f"{first}:{week}:{uid}:{day}",booking)
    return {"batch":BATCH,"from":first.isoformat(),"through":(first+timedelta(days=13)).isoformat(),
            "members":len(users),"activities_per_member":18,"inserted":dict(inserted),
            "note":NOTE}
