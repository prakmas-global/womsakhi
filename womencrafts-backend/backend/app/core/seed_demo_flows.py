"""
Demo data for every member module — made through the real API, by real members.

Development only. Each step signs in as one of the demo members and calls the
same endpoint the app calls, so every row is valid and connected the way a real
one would be: Priya posts a job and Neha applies to it; Sneha asks Kavita for
mentoring, Kavita accepts, they meet, and Sneha rates it.

    MONGODB_URI=mongodb://127.0.0.1:27018 DB_NAME=womencrafts \\
        venv/bin/python -m app.core.seed_demo_flows

Runs once per database (marker `demo_seed/flows_v1`); `--force` runs it again.
Every step prints ✓ or ✗ with the server's reason, and a failure never stops
the steps after it.
"""

from __future__ import annotations

import asyncio
import sys
from datetime import date, datetime, timedelta, timezone

import httpx

from app.core import sessions
from app.core.config import settings
from app.db.mongodb import get_database

MARKER = "flows_v1"
PEOPLE = {
    "P": "priya.sharma@example.com",
    "A": "aisha.khan@example.com",
    "N": "neha.patel@example.com",
    "S": "sneha.joshi@example.com",
    "K": "kavita.rao@example.com",
    "R": "rrappsdevelopment@gmail.com",
}

ok = 0
bad: list[str] = []


def _day(n: int) -> str:
    return (date.today() + timedelta(days=n)).isoformat()


STAFF_JOBS = [
    # title, org, kind, mode, location, pay, skill names, openings, days to deadline, description
    ("Spoken English tutor — evening batch", "Bright Path Tuition Centre", "Job", "On-site", "Kothrud, Pune",
     "₹8,000 / month", ["spoken english", "tuition"], 2, 21,
     "Teach simple spoken English to 10 women, 6 to 8 pm, Monday to Friday. Material provided."),
    ("Data entry from home", "Sai Logistics", "Freelance", "Remote", "Work from home",
     "₹10,000 / month", ["data entry", "typing"], 3, 18,
     "Enter delivery records into Excel, 4 hours a day, from your phone or laptop. Training given."),
    ("Accounts assistant (Tally)", "Sri Lakshmi Traders", "Job", "On-site", "Banjara Hills, Hyderabad",
     "₹15,000 / month", ["bookkeeping", "tally"], 1, 25,
     "Keep daily sales and purchase entries in Tally for a wholesale shop. 10 am to 5 pm, Sunday off."),
    ("Mehendi artist for wedding season", "Shubh Events", "Freelance", "On-site", "Maninagar, Ahmedabad",
     "₹2,000 per function", ["mehendi"], 4, 30,
     "Bridal and guest mehendi at weddings from November to February. Cones provided; travel paid."),
    ("Cook for a working women's hostel", "Sakhi Niwas Hostel", "Job", "On-site", "Tolichowki, Hyderabad",
     "₹13,000 / month", ["home cooking", "tiffin"], 1, 15,
     "Breakfast and dinner for 30 women. Vegetarian and non-veg. Kitchen help provided."),
    ("Home tutor for Class 5 maths", "A parent in Kothrud", "Freelance", "On-site", "Kothrud, Pune",
     "₹3,000 / month", ["tuition"], 1, 12, "Three evenings a week, one child. Near Karve Road."),
]


async def _staff_jobs(db, skill) -> None:
    """Open jobs from local businesses, tagged with master skills, so every
    demo member has work that fits in "For my skills"."""
    global ok
    from app.models.growth import OpportunityModel
    from app.routes.work_talent import resolve_job_skills
    for title, org, kind, mode, loc, pay, names, openings, days, desc in STAFF_JOBS:
        if await db["opportunities"].find_one({"title": title}):
            print(f"  · {title} (already there)")
            continue
        keys = [skill(n) for n in names if skill(n)]
        category, keys, skill_names = await resolve_job_skills("", keys)
        doc = OpportunityModel.create_document(
            title=title, org=org, kind=kind, desc=desc, location=loc, mode=mode, pay=pay, skills=skill_names,
            openings=openings, deadline=_day(days), contact_note="Apply here and we'll pass your details on.",
            category=category, skill_keys=keys, owner_kind="staff")
        await db["opportunities"].insert_one(doc)
        ok += 1
        print(f"  ✓ {title} ({', '.join(skill_names)})")
    # The data-entry job was tagged only "typing" and "Excel".
    de = skill("data entry")
    if de:
        await db["opportunities"].update_many({"title": "Data entry executive"}, {"$addToSet": {"skill_keys": de, "skills": "Data entry"}})


async def main(force: bool = False, only: set[str] | None = None) -> None:
    global ok
    if getattr(settings, "ENVIRONMENT", "") == "production":
        print("Refusing to seed demo data in production.")
        return
    from app.db import mongodb
    if mongodb._client is None:
        await mongodb.connect_db()
    db = get_database()
    if not force and not only and await db["demo_seed"].find_one({"_id": MARKER}):
        print("Demo flows already seeded (use --force to run again).")
        return

    from main import app

    users = {k: await db["users"].find_one({"email": e}) for k, e in PEOPLE.items()}
    missing = [PEOPLE[k] for k, u in users.items() if not u]
    if missing:
        print("Missing demo members:", ", ".join(missing))
        return
    for u in users.values():
        if u.get("verification_status") != "active":
            await db["users"].update_one({"_id": u["_id"]}, {"$set": {"verification_status": "active"}})
    heads = {}
    for k, u in users.items():
        t = await sessions.start(None, u)
        heads[k] = {"Authorization": f"Bearer {t['access_token']}"}
    uid = {k: str(u["_id"]) for k, u in users.items()}

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://seed/api/v1", timeout=60) as c:

        async def call(who: str, method: str, path: str, label: str, **kw):
            global ok
            if not on:
                return None
            r = await c.request(method, path, headers=heads[who], **kw)
            if r.status_code < 400:
                ok += 1
                print(f"  ✓ {label}")
                try:
                    return r.json()
                except Exception:  # noqa: BLE001
                    return {}
            msg = r.text[:160].replace("\n", " ")
            bad.append(f"{label}: {r.status_code} {msg}")
            print(f"  ✗ {label} — {r.status_code} {msg}")
            return None

        on = True

        def want(section: str) -> bool:
            return not only or section in only

        async def get(who: str, path: str, **kw):
            r = await c.get(path, headers=heads[who], **kw)
            return r.json() if r.status_code < 400 else None

        # The masters, so skills are picked by name.
        tax = (await get("P", "/work/taxonomy")) or {"categories": []}
        by_name = {s["name"].casefold(): s["key"] for cat in tax["categories"] for s in cat["skills"]}

        def skill(*names: str) -> str:
            for n in names:
                for label, key in by_name.items():
                    if n.casefold() in label:
                        return key
            return ""

        on = want("staffjobs")
        if on:
            print("Jobs from local businesses (posted by the WomSakhi team)")
            await _staff_jobs(db, skill)
        on = want("consents")
        if on: print("Consents (job updates)")
        for k in PEOPLE:
            await call(k, "POST", "/me/onboarding/consents", f"{k} allows job updates",
                       json={"setup": True, "job_updates": True, "employer_visibility": True})

        on = want("profiles")
        if on: print("Work profiles")
        profiles = {
            "P": ([("blouse stitching", "5+"), ("alterations", "3-5")], "Kukatpally", "Hyderabad", ["Part-time", "From home"]),
            "A": ([("tiffin", "3-5"), ("home cooking", "5+")], "Tolichowki", "Hyderabad", ["Full-time"]),
            "N": ([("blouse stitching", "5+"), ("mehendi", "5+")], "Maninagar", "Ahmedabad", ["Per order"]),
            "S": ([("spoken english", "3-5"), ("tuition", "1-2")], "Kothrud", "Pune", ["Part-time", "From home"]),
            "K": ([("bookkeeping", "5+"), ("tally", "3-5")], "Banjara Hills", "Hyderabad", ["Part-time"]),
            "R": ([("data entry", "1-2")], "", "Hyderabad", ["From home"]),
        }
        for k, (sk, area, city, types) in profiles.items():
            picks = [{"key": skill(n), "level": lv, "visible": True} for n, lv in sk if skill(n)]
            await call(k, "PUT", "/work/profile", f"{k} work profile ({len(picks)} skills)",
                       json={"skills": picks, "work_types": types, "days": ["Weekdays"], "area": area, "city": city})

        on = want("jobs")
        if on: print("Jobs, applications, hiring")
        blouse, alter = skill("blouse stitching"), skill("alterations")
        job_p = await call("P", "POST", "/work/jobs", "Priya posts: 2 helpers for blouse orders", json={
            "title": "2 helpers for blouse orders", "skill_keys": [k for k in (blouse, alter) if k], "kind": "Job",
            "mode": "On-site", "location": "Kukatpally, Hyderabad", "pay": "₹12,000 / month", "openings": 2,
            "deadline": _day(20), "experience": "1+ years", "desc": "Work from 10 to 6. Lunch provided."})
        cook = skill("tiffin", "home cooking", "cooking")
        job_a = await call("A", "POST", "/work/jobs", "Aisha posts: cook for tiffin service", json={
            "title": "Cook for my tiffin service", "skill_keys": [cook] if cook else [], "kind": "Freelance",
            "mode": "On-site", "location": "Tolichowki, Hyderabad", "pay": "₹500 / day", "openings": 1, "deadline": _day(14)})
        app_n = None
        if job_p:
            app_n = await call("N", "POST", f"/growth/opportunities/{job_p['id']}/apply", "Neha applies to Priya's job",
                               json={"note": "I have done this work before. I can start this week."})
        if job_a:
            await call("K", "POST", f"/growth/opportunities/{job_a['id']}/apply", "Kavita applies to Aisha's job",
                       json={"note": "I live nearby"})
        if app_n:
            await call("P", "POST", f"/work/applications/{app_n['id']}/move", "Priya shortlists Neha", json={"status": "shortlisted"})
            await call("P", "POST", f"/work/applications/{app_n['id']}/message", "Priya messages Neha",
                       json={"text": "Can you come for a trial on Monday at 10?"})
        await call("R", "POST", f"/work/talent/{uid['S']}/message", "RR Apps asks Sneha about tuition",
                   json={"text": "Hi Sneha, I need spoken English classes for my daughter. Are you free on weekends?",
                         "skills": [skill("spoken english")]})

        on = want("money")
        if on: print("Goals, money, books")
        goals = {
            "P": {"label": "Buy a new sewing machine", "kind": "money", "target": 1500000, "by": "In 6 months"},
            "A": {"label": "Emergency fund", "kind": "money", "target": 2000000, "by": "In a year"},
            "N": {"label": "Bridal mehendi orders", "kind": "count", "target": 10, "by": "Before Diwali", "unit": "orders"},
            "S": {"label": "Finish the Spoken English course", "kind": "skill", "target": 1, "by": "In 3 months"},
            "K": {"label": "Children's school fees", "kind": "money", "target": 4500000, "by": "Before school starts"},
            "R": {"label": "Start a shop", "kind": "money", "target": 5000000, "by": "In a year"},
        }
        for k, g in goals.items():
            await call(k, "POST", "/me/goals", f"{k} goal: {g['label']}", json=g)
        for k, what, minor, due in [("A", "Electricity bill", 120000, _day(5)), ("S", "School fee", 350000, _day(12)),
                                    ("K", "Rent", 600000, _day(3))]:
            await call(k, "POST", "/me/money/commitments", f"{k} has to pay: {what}",
                       json={"what": what, "minor": minor, "due": due, "if_missed": "A late fee"})
        await call("P", "POST", "/me/books", "Priya's book: Meena owes ₹1,800",
                   json={"who": "Meena (buyer)", "what": "3 blouses", "minor": 180000, "state": "owed", "due": _day(7)})
        await call("K", "POST", "/me/books", "Kavita's book: Lakshmi paid ₹900",
                   json={"who": "Lakshmi", "what": "Accounts for March", "minor": 90000, "state": "paid"})

        on = want("portfolio")
        if on: print("Portfolio")
        for k, title, photo, for_ in [
            ("P", "Silk blouse with boat neck", "/ux/art/course-sewing-machine.webp", "A bride in Kukatpally"),
            ("P", "Kids' school uniforms", "/ux/art/scene-woman-packing-orders.webp", "A school in my area"),
            ("N", "Bridal mehendi, full hands", "/ux/art/course-teaching-another-woman.webp", "A wedding"),
        ]:
            await call(k, "POST", "/me/portfolio", f"{k} portfolio: {title}",
                       json={"title": title, "photo": photo, "made_for": for_, "year": date.today().year, "visible": True})

        on = want("mentoring")
        if on: print("Mentoring: Kavita mentors, Aisha learns and rates")
        await call("K", "PUT", "/mentoring/me", "Kavita becomes a mentor", json={
            "headline": "I help women keep simple books for their business",
            "bio": "I have kept accounts for small shops for 8 years. I can show you a simple money book.",
            "expertise": ["Bookkeeping", "Pricing"], "languages": ["Telugu", "Hindi", "English"], "experience_years": 8,
            "location": "Hyderabad", "availability": "Saturdays", "session_mode": "Video call", "session_minutes": 30,
            "price_rupees": 0, "upi_id": ""})
        kav = await get("K", "/mentoring/me") if on else None
        if kav:
            req = await call("A", "POST", f"/growth/mentors/{kav['id']}/request", "Aisha asks Kavita for a session",
                             json={"goal": "I want help with keeping accounts for my tiffin service", "preferred_time": "Saturday morning"})
            incoming = await get("K", "/mentoring/requests") or []
            mine = next((r for r in incoming if req and r.get("id") == req.get("id")), incoming[0] if incoming else None)
            if mine:
                await call("K", "POST", f"/mentoring/requests/{mine['id']}/accept", "Kavita accepts",
                           json={"scheduled_for": "Sat, 10 am", "meeting": "I will WhatsApp video call you"})
                await call("K", "POST", f"/mentoring/requests/{mine['id']}/done", "Kavita marks the session done")
                await call("A", "POST", f"/growth/mentors/requests/{mine['id']}/review", "Aisha rates the session ★★★★★",
                           json={"rating": 5, "text": "She showed me a simple money book. Very kind and clear."})
        # Priya's earlier closed session with Neha, rated.
        mine_reqs = await get("P", "/growth/mentors/requests/mine") or []
        done_req = next((r for r in mine_reqs if r.get("status") == "closed"), None)
        if done_req:
            await call("P", "POST", f"/growth/mentors/requests/{done_req['id']}/review", "Priya rates her session with Neha",
                       json={"rating": 4, "text": "Useful tips on pricing bridal mehendi."})

        on = want("circles")
        if on: print("Circles")
        circles = await get("A", "/community/circles") or []
        circles = circles if isinstance(circles, list) else circles.get("circles", [])
        circle = next((x for x in circles if x.get("joined") or x.get("is_member")), circles[0] if circles else None)
        if circle:
            await call("A", "POST", f"/community/circles/{circle['id']}/join", "Aisha in a circle")
            post = await call("A", "POST", f"/community/circles/{circle['id']}/posts", "Aisha posts in the circle",
                              json={"body": "Does anyone know where to buy steel tiffin boxes in bulk near Tolichowki?"})
            await call("P", "POST", f"/community/circles/{circle['id']}/join", "Priya joins the circle")
            if post and post.get("id"):
                await call("P", "POST", f"/community/posts/{post['id']}/replies", "Priya replies",
                           json={"body": "Try the wholesale market in Begum Bazaar — they give a discount for 50+."})

        on = want("saved")
        if on: print("Group buy, saved")
        buys = await get("K", "/group-buy") or []
        buys = buys if isinstance(buys, list) else buys.get("items", [])
        if buys:
            await call("K", "POST", f"/group-buy/{buys[0]['id']}/join", "Kavita joins a group buy", json={"quantity": 1})
            await call("N", "POST", f"/group-buy/{buys[-1]['id']}/notify-me", "Neha: tell me next time")
        opps = await get("P", "/growth/opportunities") or []
        if opps:
            await call("S", "POST", "/saved", "Sneha saves a job", json={"kind": "job", "ref_id": opps[0]["id"]})
        progs = await get("S", "/catalog/programs") or []
        progs = progs if isinstance(progs, list) else progs.get("items", progs.get("programs", []))
        if progs:
            await call("S", "POST", "/saved", "Sneha saves a course", json={"kind": "program", "ref_id": progs[0]["id"]})

        on = want("health")
        if on: print("Haq, reminders, health")
        await call("A", "PUT", "/me/haq/profile", "Aisha sets her state", json={"state": "Telangana", "tags": ["ration_card", "business"]})
        schemes = (await get("A", "/haq/schemes", params={"state": "Telangana"}) or {}).get("schemes", [])
        if schemes:
            await call("A", "PUT", f"/me/haq/{schemes[0]['id']}", f"Aisha marks {schemes[0].get('name', 'a scheme')}",
                       json={"status": "waiting", "action": "Visit the office with Aadhaar", "due_on": _day(10)})
        await call("A", "POST", "/engines/reminders", "Aisha sets a reminder", json={
            "title_key": "rem.preset.deadline", "schedule_type": "once", "tz": "Asia/Kolkata",
            "at": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()})
        await call("A", "POST", "/me/health/strength/iron", "Aisha ticks iron this week", json={"took": True})
        await call("A", "POST", "/me/health/strength/test", "Aisha logs a blood test", json={"date": _day(-60), "result": "low"})
        await call("K", "PUT", "/me/checklists/doctor", "Kavita's three things for the doctor",
                   json={"items": ["Tired all day", "Poor sleep", "Back pain"], "done": []})
        await call("P", "PUT", "/me/checklists/move", "Priya's moving checklist",
                   json={"items": ["proof", "papers", "circle"], "done": ["papers"]})
        await call("S", "PUT", "/me/cycle/setup", "Sneha sets up cycle tracking",
                   json={"adult": True, "last_start": _day(-10), "typical_cycle": 28, "typical_period": 5, "tz": "Asia/Kolkata"})
        await call("S", "PUT", f"/me/cycle/days/{_day(0)}", "Sneha logs today", json={"mood": "calm", "energy": 4, "tz": "Asia/Kolkata"})
        covers = await get("K", "/cover") or []
        if covers:
            await call("K", "POST", f"/reference/{covers[0]['id']}/mark", f"Kavita has {covers[0].get('title', 'cover')}",
                       json={"state": "active"})

        on = want("misc")
        if on: print("School, selling tools, swaps, digital, messages")
        child = await call("S", "POST", "/me/school/children", "Sneha adds her daughter",
                           json={"name": "Riya", "cls": "Class 5", "school": "Government school", "fee_minor": 1200000})
        kid = ((child or {}).get("children") or [{}])[-1].get("id")
        if kid:
            await call("S", "POST", "/me/school/tasks", "Sneha: school fee date",
                       json={"child_id": kid, "what": "School fees", "kind": "fee", "cost_minor": 300000,
                             "due": (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()})
        await call("P", "POST", "/shop/operations", "Priya books a blouse fitting", json={
            "kind": "slot", "title": "Blouse fitting", "contact": "Meena", "amount_minor": 50000, "status": "scheduled",
            "due_on": f"{_day(2)}T11:00", "note": "At my home"})
        await call("A", "POST", "/shop/operations", "Aisha adds a monthly tiffin customer", json={
            "kind": "subscription", "title": "Monthly tiffin", "contact": "Farah", "amount_minor": 250000,
            "status": "waiting", "due_on": f"{_day(5)}T10:00", "note": "Lunch on weekdays"})
        await call("N", "POST", "/community/swap", "Neha offers a school uniform",
                   json={"what": "School uniform", "size": "Class 3–5", "condition": "Good", "wants": "Free"})
        await call("P", "POST", "/me/conversations/start", "Priya messages Neha about the uniform",
                   json={"user_id": uid["N"], "text": "Hi Neha, is the school uniform still there? I can collect on Sunday.",
                         "about": "Swap: School uniform"})
        await call("R", "POST", "/me/conversations/start", "RR Apps messages Priya",
                   json={"user_id": uid["P"], "text": "Hi Priya, I loved your blouse work. Do you take orders?", "about": "Her work"})
        swap_k = await call("K", "POST", "/exchange/swaps", "Kavita offers a skill swap",
                            json={"skill": "Bookkeeping for a small shop", "wants": "Spoken English", "online": True,
                                  "tags": ["Bookkeeping", "English"]})
        if swap_k and swap_k.get("id"):
            await call("S", "POST", f"/exchange/swaps/{swap_k['id']}/ask", "Sneha proposes the swap",
                       json={"text": "I can teach you spoken English in return for bookkeeping lessons."})
        steps = await get("A", "/digital") or []
        steps = steps if isinstance(steps, list) else steps.get("steps", [])
        if steps:
            await call("A", "POST", f"/digital/{steps[0]['id']}/done", "Aisha finishes a phone-basics step")

        on = want("social")
        if on:
            print("Community: usernames, friends, posts, likes and comments")
            from bson import ObjectId
            names = {"P": "priya.sews", "A": "aisha.bakes", "N": "neha.codes", "S": "sneha.stitches",
                     "K": "kavita.teaches", "R": "rr.apps"}
            for k, name in names.items():
                if not users[k].get("username"):
                    await call(k, "PUT", "/me/username", f"{k} picks @{name}", json={"username": name})
            for a, b in [("P", "A"), ("P", "N"), ("A", "S"), ("K", "P"), ("R", "P"), ("R", "A"), ("S", "N")]:
                asked = await call(a, "POST", "/friends/requests", f"{a} asks {b} to be friends", json={"user_id": uid[b]})
                if (asked or {}).get("relation") == "sent":
                    await call(b, "POST", f"/friends/requests/{uid[a]}/accept", f"{b} accepts {a}")
            # One request left waiting for RR Apps to answer.
            await call("N", "POST", "/friends/requests", "Neha asks RR Apps to be friends", json={"user_id": uid["R"]})
            await call("K", "POST", "/friends/requests", "Kavita asks RR Apps to be friends", json={"user_id": uid["R"]})

            A_ = "/ux/art/"
            posts = [
                ("P", "everyone", "Finished 12 blouses for a wedding order this week! 🎉 Three months ago I could not "
                 "cut a pattern without help. Thank you to everyone in my circle who kept pushing me.",
                 [A_ + "course-sewing-machine.webp"]),
                ("A", "friends", "Trying a new ragi laddoo recipe for my tiffin customers. Does anyone know how long "
                 "they keep without a fridge in summer?", [A_ + "course-cooking-packing-orders.webp"]),
                ("N", "everyone", "Question for women who sell online: is Canva on the phone enough for making product "
                 "posters, or should I learn something else first?", []),
                ("S", "everyone", "Got my first payment for stitching school uniforms today. ₹4,500 — and the school "
                 "wants 40 more next month! Small steps really do add up.", [A_ + "course-holding-certificate.webp"]),
                ("K", "everyone", "Tip that changed my shop: write every sale in a notebook the SAME day. After three "
                 "months the bank accepted it as proof of income for my loan.", []),
                ("R", "friends", "Hello everyone! New here and so happy to find this community. I build apps and "
                 "websites — happy to help anyone who wants to take her business online.", []),
                ("P", "friends", "Need help: a customer wants a boat-neck blouse with a deep back. Has anyone stitched "
                 "this style? Any pattern you trust?", []),
                ("A", "everyone", "Our circle met at the park this Sunday — 14 women, one big tiffin, and so many "
                 "ideas. Next month we are planning a small mela stall together!",
                 [A_ + "circle-women-talking.webp", A_ + "course-handmade-market-stall.webp"]),
            ]
            made_posts = {}
            for who, aud, text, photos in posts:
                have = await db["feed_posts"].find_one({"author_id": uid[who], "text": text})
                if have:
                    made_posts[text[:20]] = str(have["_id"])
                    print(f"  · {who} post (already there)")
                    continue
                r = await call(who, "POST", "/feed/posts", f"{who} posts ({aud})", json={"text": text, "audience": aud})
                if r and r.get("id"):
                    made_posts[text[:20]] = r["id"]
                    if photos:
                        await db["feed_posts"].update_one({"_id": ObjectId(r["id"])}, {"$set": {"photos": photos}})
            likes = {"Finished 12 blouses": ["A", "N", "K", "R"], "Got my first payme": ["P", "A", "K", "R", "N"],
                     "Tip that changed my": ["S", "P", "R"], "Our circle met at t": ["P", "S", "R"],
                     "Question for women ": ["R"], "Trying a new ragi l": ["P", "S"]}
            for key, who_all in likes.items():
                pid = next((v for k2, v in made_posts.items() if k2.startswith(key[:18])), None)
                if not pid:
                    continue
                post = await db["feed_posts"].find_one({"_id": ObjectId(pid)}, {"likes": 1})
                for w in who_all:
                    if uid[w] not in (post or {}).get("likes", []):
                        await call(w, "POST", f"/feed/posts/{pid}/like", f"{w} likes a post")
            comments = [
                ("Finished 12 blouses", "A", "So proud of you ❤️ Your work is beautiful."),
                ("Finished 12 blouses", "K", "Congratulations! Write it all in your book — this is proof of income too."),
                ("Got my first payme", "P", "Congratulations! 🎉 Forty more is a big order — tell us if you need hands."),
                ("Got my first payme", "N", "This made my day!"),
                ("Question for women ", "R", "Canva is plenty to start. I can show you a few templates — message me."),
                ("Trying a new ragi l", "S", "Mine keep about 5 days in an airtight steel box."),
                ("Need help: a custo", "A", "Following this 👀"),
                ("Our circle met at t", "R", "Lovely! Count me in for the mela."),
            ]
            for key, who, text in comments:
                pid = next((v for k2, v in made_posts.items() if k2.startswith(key[:18])), None)
                if pid and not await db["feed_comments"].find_one({"post_id": pid, "author_id": uid[who], "text": text}):
                    await call(who, "POST", f"/feed/posts/{pid}/comments", f"{who} comments", json={"text": text})

        on = want("groupchat")
        if on:
            print("Circle group chats")
            from bson import ObjectId
            # Three groups, each talking: an open tailoring group RR Apps is in
            # (with unread messages), a savings circle she joined by link, and a
            # private group that has invited her by username — waiting for her.

            async def group(name: str, who: str, body: dict) -> str:
                have = await db["circles"].find_one({"name": name, "status": "active"})
                if have:
                    print(f"  · {name} (already there)")
                    return str(have["_id"])
                r = await call(who, "POST", "/community/circles", f"{who} starts {name}", json={"name": name, **body})
                return (r or {}).get("id", "")

            async def in_group(cid: str, k: str) -> bool:
                return bool(await db["circle_members"].find_one({"circle_id": cid, "user_id": uid[k]}))

            async def by_link(cid: str, host: str, k: str) -> None:
                if await in_group(cid, k):
                    return
                code = ((await call(host, "POST", f"/community/circles/{cid}/invite-code", f"{host} makes an invite link")) or {}).get("code")
                if code:
                    await call(k, "POST", f"/community/circles/join/{code}", f"{k} joins by the link")

            async def talk(cid: str, lines: list[tuple[str, str]], rr_read_after: int) -> None:
                """Send the lines, spread them over the last day and a half, and
                leave RR Apps having read up to line `rr_read_after`."""
                if await db["circle_messages"].count_documents({"circle_id": cid, "kind": "text"}):
                    print("  · chat already has messages")
                    return
                for k, text in lines:
                    await call(k, "POST", f"/community/circles/{cid}/messages", f"{k}: {text[:28]}", json={"text": text})
                rows = await db["circle_messages"].find({"circle_id": cid}).sort("_id", 1).to_list(200)
                now = datetime.now(timezone.utc)
                step = timedelta(minutes=47)
                stamps = [now - step * (len(rows) - i) for i in range(len(rows))]
                for row, at in zip(rows, stamps):
                    await db["circle_messages"].update_one({"_id": row["_id"]}, {"$set": {"created_at": at}})
                texts = [r for r in rows if r.get("kind") == "text"]
                if 0 <= rr_read_after < len(texts):
                    seen = stamps[rows.index(texts[rr_read_after])] + timedelta(seconds=30)
                    await db["circle_members"].update_one({"circle_id": cid, "user_id": uid["R"]},
                                                          {"$set": {"last_read_at": seen}})
                await db["circles"].update_one({"_id": ObjectId(cid)}, {"$set": {"last_message_at": stamps[-1]}})

            sew = await group("Sewing Sisters Hyderabad", "P", {
                "topic": "Tailoring", "desc": "Tailoring tips, orders we can share, and fabric deals around Hyderabad.",
                "cover": "/ux/art/course-sewing-machine.webp"})
            if sew:
                for k in ("A", "N", "R"):
                    if not await in_group(sew, k):
                        await call(k, "POST", f"/community/circles/{sew}/join", f"{k} joins Sewing Sisters")
                await talk(sew, [
                    ("P", "Welcome everyone! 🧵 This is our group for tailoring tips, orders and fabric deals."),
                    ("A", "Hi all 👋 So happy to be here."),
                    ("N", "Does anyone have a good pattern for a princess-cut kurti?"),
                    ("P", "Yes! I will share a photo of mine tonight."),
                    ("R", "Hello! I can help anyone who wants to sell online — just ask."),
                    ("A", "Fabric sale at Begum Bazaar this Saturday — 20% off on cotton."),
                    ("N", "Count me in ✋ Who wants to go together?"),
                    ("P", "Let's meet at the bus stop at 10. See you there!"),
                ], rr_read_after=4)

            gat = await group("Bachat Gat — Kothrud", "S", {
                "topic": "Savings", "desc": "Ten women, ₹500 each month, one of us takes the pot in turn.",
                "is_private": True, "is_savings": True, "monthly_minor": 50000,
                "cover": "/ux/art/course-counting-coins-calculator.webp"})
            if gat:
                await by_link(gat, "S", "K")
                await by_link(gat, "S", "R")
                await talk(gat, [
                    ("S", "Namaste sisters 🙏 This month's ₹500 is due by the 10th."),
                    ("K", "Paid today ✅"),
                    ("R", "Paying tonight. Whose turn is it this round?"),
                    ("S", "Kavita's turn this month — congratulations Kavita! 🎉"),
                    ("K", "Thank you! 🙏 It goes to my new sewing machine."),
                ], rr_read_after=2)

            tech = await group("Women in Tech — Pune", "N", {
                "topic": "Career & Skills", "desc": "Learning to code, design and sell online — together.",
                "is_private": True, "cover": "/ux/art/work-dashboard-data.webp"})
            if tech:
                await by_link(tech, "N", "A")
                await talk(tech, [
                    ("N", "Started this group for anyone learning web or app skills 💻"),
                    ("A", "Thank you Neha! I just finished the Canva course."),
                    ("N", "Great! Next week let's try making a simple shop page."),
                ], rr_read_after=-1)
                if not await in_group(tech, "R") and not await db["circle_invites"].find_one(
                        {"circle_id": tech, "to_id": uid["R"], "status": "pending"}):
                    await call("N", "POST", f"/community/circles/{tech}/invites", "Neha invites RR Apps by username",
                               json={"user_id": uid["R"]})

        on = want("health_nutrition_sleep")
        if on:
            print("Health: meals, water, meal plans and sleep (last 10 days)")
            meal_days = [
                [("Breakfast", "Vegetable poha", 280, 6, "poha"), ("Lunch", "Dal, rice and sabzi", 500, 16, ""), ("Dinner", "2 roti with sabzi", 350, 10, "")],
                [("Breakfast", "2 idli with sambar", 250, 8, ""), ("Lunch", "Rajma bowl", 450, 17, "rajma"), ("Evening snack", "Roasted chana chaat", 180, 9, "chana"), ("Dinner", "Vegetable khichdi", 380, 13, "khichdi")],
                [("Breakfast", "Moong dal chilla", 260, 14, "chilla"), ("Lunch", "Palak dal with rice", 420, 16, "palak"), ("Dinner", "Paneer bhurji with roti", 430, 22, "paneer")],
                [("Breakfast", "Tea with milk", 80, 3, ""), ("Lunch", "Curd rice with pomegranate", 330, 9, "curdrice"), ("Evening snack", "Fruit", 80, 1, ""), ("Dinner", "Dal, rice and sabzi", 500, 16, "")],
            ]
            nights = [("22:30", "06:30", "Good", []), ("23:15", "06:15", "Fair", ["Screen in bed"]), ("22:00", "06:00", "Great", []),
                      ("23:45", "06:30", "Poor", ["Stress", "Caffeine late"]), ("22:45", "06:45", "Good", []),
                      ("22:15", "06:30", "Good", ["Exercise today"]), ("00:10", "07:00", "Fair", ["Late meal"])]
            for who, n_days in (("R", 10), ("P", 8), ("A", 6)):
                have = await get(who, "/me/health/entries", params={"kind": "sleep", "from": _day(-11)}) or []
                if have:
                    print(f"  · {who} already has sleep entries — skipped")
                    continue
                for i in range(n_days):
                    d = _day(-i)
                    for mt, food, kcal, protein, recipe in meal_days[i % len(meal_days)]:
                        if i == 0 and mt == "Dinner":
                            continue  # today's dinner is still ahead
                        await call(who, "POST", "/me/health/entries", f"{who} {d} {mt.lower()}: {food}",
                                   json={"kind": "meal", "date": d, "data": {"mealType": mt, "food": food, "kcal": kcal, "protein": protein, "recipe": recipe}})
                    for ml in ([750, 500, 500] if i % 3 else [500, 500, 250]) + ([500] if i % 2 else []):
                        await call(who, "POST", "/me/health/entries", f"{who} {d} water {ml} ml",
                                   json={"kind": "water", "date": d, "data": {"ml": ml}})
                    bed, wake, quality, factors = nights[i % len(nights)]
                    await call(who, "POST", "/me/health/entries", f"{who} {d} sleep {bed}–{wake}",
                               json={"kind": "sleep", "date": d, "data": {"bed": bed, "wake": wake, "quality": quality, "factors": factors}})
                for j, (mt, food, recipe) in enumerate([("Breakfast", "Ragi porridge", "ragi"), ("Lunch", "Palak dal with rice", "palak"),
                                                        ("Dinner", "Vegetable khichdi", "khichdi"), ("Breakfast", "Moong dal chilla", "chilla")]):
                    await call(who, "POST", "/me/health/entries", f"{who} plans {food}",
                               json={"kind": "plan", "date": _day(j // 2 + 1), "data": {"mealType": mt, "food": food, "recipe": recipe}})
            await call("R", "PUT", "/me/health/settings", "RR Apps sets nutrition and sleep goals",
                       json={"diet": "Vegetarian", "kcalGoal": 1800, "proteinGoal": 55, "waterGoal": 8, "sleepGoal": 8, "bedtime": "22:30",
                             "healthGoal": "More protein"})
            await call("P", "PUT", "/me/health/settings", "Priya sets her bedtime routine",
                       json={"bedtime": "22:00", "sleepGoal": 7.5, "sleepRoutine": ["Dim the lights", "Put my phone away", "Herbal tea", "Breathing for 2 minutes"]})
            rems = await get("P", "/me/health/entries", params={"kind": "reminder"}) or []
            if not any(r["data"].get("title") == "Time for bed" for r in rems):
                await call("P", "POST", "/me/health/entries", "Priya's bedtime reminder",
                           json={"kind": "reminder", "date": _day(0), "data": {"title": "Time for bed", "category": "Other", "time": "22:00",
                                                                               "repeat": "Every day", "note": "Start your wind-down routine"}})

        on = want("health_mind_games")
        if on:
            print("Health: mood check-ins, journal, calm activities and game sessions (last 10 days)")
            # Mood lives on her day in cycle_days (app/engines/mood.py); the
            # check-in API only writes today, so past days are set directly.
            moods = [("good", ["calm"]), ("tired", ["tired"]), ("anxious", ["anxious", "emotional"]), ("good", ["energetic", "confident"]),
                     ("low", ["low"]), ("good", ["calm"]), ("tired", []), ("good", ["confident"]), ("angry", ["irritable"]), ("good", ["calm", "energetic"])]
            journal = [("Gratitude", "Three things I'm grateful for today: my daughter's laugh, a quiet cup of tea, and a new order for two blouses."),
                       ("Reflection", "What went well today? I finished the course module I kept putting off. Small steps still count."),
                       ("Affirmation", "I am doing my best, and that is enough."),
                       ("Reflection", "What is one thing I want to let go of? Worrying about what the neighbours say."),
                       ("Gratitude", "Someone who made my day better: Kavita, who called just to ask how I was.")]
            acts = [("Meditation", 5), ("Breathing exercise", 3), ("Walk outdoors", 10), ("Journaling", 3), ("Yoga", 15)]
            games = [("breathe", 180, 0, "Calm breathing", "good"), ("pairs", 150, 14, "6 pairs in 14 turns", "good"),
                     ("numbers", 120, 3, "3 boards · 1–9", "tired"), ("garden", 120, 7, "7 flowers planted", "good"),
                     ("bubbles", 95, 31, "31 popped", ""), ("puzzle", 210, 46, "Solved 3×3 in 46 moves", "good")]
            for who, n_days in (("R", 10), ("P", 8), ("A", 6)):
                have = await get(who, "/me/health/entries", params={"kind": "journal,game", "from": _day(-11)}) or []
                if have:
                    print(f"  · {who} already has journal or game entries — skipped")
                    continue
                for i in range(n_days):
                    d = _day(-i)
                    mood, feelings = moods[i % len(moods)]
                    if not await db["cycle_days"].find_one({"user_id": uid[who], "date": d, "mood": {"$nin": [None, ""]}}):
                        await db["cycle_days"].update_one(
                            {"user_id": uid[who], "date": d},
                            {"$set": {"mood": mood, "feelings": feelings, "updated_at": datetime.now(timezone.utc)},
                             "$setOnInsert": {"created_at": datetime.now(timezone.utc), "period": False, "symptoms": []}},
                            upsert=True)
                        ok += 1
                        print(f"  ✓ {who} {d} feels {mood}")
                    if i % 2 == 0:
                        jt, text = journal[(i // 2) % len(journal)]
                        await call(who, "POST", "/me/health/entries", f"{who} {d} journal ({jt})",
                                   json={"kind": "journal", "date": d, "data": {"type": jt, "text": text}})
                    if i % 3 != 2:
                        at, mins = acts[i % len(acts)]
                        await call(who, "POST", "/me/health/entries", f"{who} {d} {at.lower()} {mins} min",
                                   json={"kind": "activity", "date": d, "data": {"type": at, "minutes": mins}})
                    if i % 2 == 1 or i == 0:
                        g, sec, score, label, gm = games[i % len(games)]
                        await call(who, "POST", "/me/health/entries", f"{who} {d} played {g}",
                                   json={"kind": "game", "date": d, "data": {"game": g, "seconds": sec, "score": score, "scoreLabel": label, "mood": gm}})
            await call("R", "PUT", "/me/health/settings", "RR Apps keeps two favourite games",
                       json={"favoriteGames": ["breathe", "garden"]})

        on = want("health_fertility_pregnancy")
        if on:
            print("Health: fertility and pregnancy")
            # RR Apps: three past periods, so the cycle has real averages — and
            # she is not pregnant (Fertility and Pregnancy must not both claim her).
            await call("R", "PUT", "/me/health/settings", "RR Apps is not tracking a pregnancy", json={"pregnancy": None})
            cyc = await get("R", "/me/cycle", params={"tz": "Asia/Kolkata"})
            if not cyc or not cyc.get("setup"):
                await call("R", "PUT", "/me/cycle/setup", "RR Apps sets up cycle tracking",
                           json={"adult": True, "last_start": _day(-29), "typical_cycle": 28, "typical_period": 5, "tz": "Asia/Kolkata"})
            for start, length in ((-86, 5), (-57, 5), (-29, 4)):
                for k in range(length):
                    body = {"period": True, "flow": ["medium", "heavy", "medium", "light", "light"][k], "tz": "Asia/Kolkata"}
                    if k == 0:
                        body["symptoms"] = ["cramps", "back-pain"]
                    elif k == 1:
                        body["symptoms"] = ["fatigue", "bloating"]
                    await call("R", "PUT", f"/me/cycle/days/{_day(start + k)}", f"RR Apps period day {k + 1} ({_day(start)})", json=body)
            await call("R", "PUT", f"/me/cycle/days/{_day(-3)}", "RR Apps logs a headache",
                       json={"symptoms": ["headache", "mood-swings"], "tz": "Asia/Kolkata"})

            # Aisha: about 22 weeks pregnant, with a few symptoms, kick counts
            # and her antenatal visits.
            lmp = _day(-(22 * 7 + 2))
            await call("A", "PUT", "/me/health/settings", "Aisha starts pregnancy tracking", json={
                "pregnancy": {"basis": "lmp", "date": lmp, "doctor": "Dr. Farida Begum", "hospital": "Govt Maternity Hospital, Koti"},
                "checks": {"anc": ["anc1"], "preg-care": ["t1-book", "t1-supp", "t1-card", "t2-scan"], "bag": ["bag-0", "bag-1"],
                           "preg-questions": ["q-tests"]}})
            have = await get("A", "/me/health/entries", params={"kind": "pregsym,kick,reminder"}) or []
            kinds = {r["kind"] for r in have}
            if "pregsym" not in kinds:
                for d, syms, sev, note in ((-6, ["Back pain", "Tiredness"], "Mild", "After standing at the stall"),
                                           (-3, ["Heartburn"], "Moderate", "After dinner"),
                                           (-1, ["Trouble sleeping", "Swelling"], "Mild", "")):
                    await call("A", "POST", "/me/health/entries", f"Aisha logs {', '.join(syms).lower()}",
                               json={"kind": "pregsym", "date": _day(d), "data": {"symptoms": syms, "severity": sev, "note": note}})
            if "kick" not in kinds:
                for d, count, secs in ((-2, 10, 1680), (-1, 12, 1420)):
                    await call("A", "POST", "/me/health/entries", f"Aisha counts {count} kicks",
                               json={"kind": "kick", "date": _day(d), "data": {"count": count, "seconds": secs}})
            if not any(r["kind"] == "reminder" and r["data"].get("category") == "Pregnancy visit" for r in have):
                await call("A", "POST", "/me/health/entries", "Aisha's last check-up (done)",
                           json={"kind": "reminder", "date": _day(-20), "data": {
                               "title": "Ultrasound scan", "category": "Pregnancy visit", "time": "10:00", "repeat": "Once",
                               "where": "Govt Maternity Hospital, Koti", "done": [_day(-20)]}})
                await call("A", "POST", "/me/health/entries", "Aisha books her next check-up",
                           json={"kind": "reminder", "date": _day(6), "data": {
                               "title": "Antenatal check-up", "category": "Pregnancy visit", "time": "10:00", "repeat": "Once",
                               "where": "Govt Maternity Hospital, Koti"}})

        on = want("health_home_fitness")
        if on:
            print("Health: workouts, a fitness plan and challenges (last 12 days)")
            # (activity, minutes, steps, intensity, routine) per day, newest first.
            weeks = [
                [("Walking", 30, 4200, "Moderate", "walk")],
                [("Yoga", 15, 0, "Easy", "yoga")],
                [("Walking", 25, 3600, "Moderate", ""), ("Stretching", 8, 0, "Easy", "desk")],
                [],
                [("Strength training", 20, 0, "Moderate", "strength")],
                [("Walking", 35, 5100, "Moderate", "walk")],
                [("Dance", 20, 0, "Hard", "dance")],
                [("Yoga", 15, 0, "Easy", "yoga")],
                [],
                [("Walking", 30, 4500, "Moderate", "")],
                [("Pilates", 12, 0, "Moderate", "pilates")],
                [("Walking", 20, 2900, "Easy", "")],
            ]
            for who, n_days in (("R", 12), ("P", 10), ("A", 6)):
                have = await get(who, "/me/health/entries", params={"kind": "workout", "from": _day(-13)}) or []
                if have:
                    print(f"  · {who} already has workouts — skipped")
                    continue
                for i in range(n_days):
                    for act, mins, steps, intensity, routine in weeks[i % len(weeks)]:
                        if who == "A" and act in ("Strength training", "Dance"):
                            act, routine, intensity = "Walking", "", "Easy"  # gentle while pregnant
                        await call(who, "POST", "/me/health/entries", f"{who} {_day(-i)} {act.lower()} {mins} min",
                                   json={"kind": "workout", "date": _day(-i), "data": {
                                       "activity": act, "minutes": mins, "steps": steps, "intensity": intensity, "routine": routine}})
            await call("R", "PUT", "/me/health/settings", "RR Apps picks a plan and joins two challenges",
                       json={"fitnessPlan": "gentle", "activeGoal": 30, "stepsGoal": 6000,
                             "challenges": [f"walk5:{_day(-3)}", f"stretch:{_day(-5)}"]})
            await call("P", "PUT", "/me/health/settings", "Priya joins the 7-day yoga streak",
                       json={"fitnessPlan": "flex", "challenges": [f"yoga:{_day(-2)}"]})

        on = want("health_doctors_mentors")
        if on:
            print("Health: doctors (demo directory) and mentors")
            # Doctors are added by staff in the dashboard; for the local demo a
            # few are written straight in, marked demo: true. Never in production
            # (main() refuses to run there).
            hours = lambda days, start, end, step=20: [{"day": d, "start": start, "end": end, "slot_minutes": step} for d in days]
            demo_doctors = [
                {"name": "Dr. Shalini Rao (demo)", "speciality": "Gynaecologist", "qualifications": "MBBS, MS (OBG)",
                 "registration_no": "DEMO-TS-1021", "languages": ["Telugu", "Hindi", "English"], "experience_years": 14,
                 "fee_minor": 40000, "modes": ["Video", "Clinic"], "clinic": "Rainbow Women's Clinic", "city": "Hyderabad",
                 "bio": "Periods, PCOS, pregnancy care and menopause. Explains things slowly, in your language.",
                 "availability": hours(["Mon", "Tue", "Wed", "Thu", "Fri"], "10:00", "13:00") + hours(["Sat"], "16:00", "19:00")},
                {"name": "Dr. Imran Qureshi (demo)", "speciality": "General physician", "qualifications": "MBBS, MD",
                 "registration_no": "DEMO-MH-2290", "languages": ["Hindi", "Urdu", "English"], "experience_years": 11,
                 "fee_minor": 25000, "modes": ["Video", "Phone"], "clinic": "City Care Polyclinic", "city": "Pune",
                 "bio": "Fever, tiredness, sugar and BP check-ups, and what your test reports mean.",
                 "availability": hours(["Mon", "Wed", "Fri", "Sun"], "18:00", "21:00", 15)},
                {"name": "Dr. Kavya Menon (demo)", "speciality": "Paediatrician", "qualifications": "MBBS, DCH",
                 "registration_no": "DEMO-KL-3307", "languages": ["Malayalam", "English", "Hindi"], "experience_years": 9,
                 "fee_minor": 30000, "modes": ["Video", "Clinic"], "clinic": "Little Steps Children's Clinic", "city": "Kochi",
                 "bio": "Babies and children: vaccines, growth, feeding and the fevers that worry you at night.",
                 "availability": hours(["Tue", "Thu", "Sat"], "09:30", "12:30")},
                {"name": "Ms. Ritu Agarwal (demo)", "speciality": "Nutritionist", "qualifications": "MSc Food & Nutrition",
                 "registration_no": "DEMO-RD-4410", "languages": ["Hindi", "English"], "experience_years": 7,
                 "fee_minor": 0, "modes": ["Video", "Phone"], "clinic": "", "city": "Delhi",
                 "bio": "Iron-rich home food, eating well in pregnancy, PCOS diet — on a household budget.",
                 "availability": hours(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], "11:00", "14:00", 30)},
                {"name": "Ms. Deepa Iyer (demo)", "speciality": "Counsellor", "qualifications": "MA Psychology, RCI registered",
                 "registration_no": "DEMO-RCI-5521", "languages": ["Tamil", "English", "Hindi"], "experience_years": 12,
                 "fee_minor": 0, "modes": ["Video", "Phone"], "clinic": "", "city": "Chennai",
                 "bio": "Stress, sadness, family pressure and feeling alone. A safe, private hour to talk.",
                 "availability": hours(["Mon", "Wed", "Fri"], "15:00", "18:00", 45)},
            ]
            now = datetime.now(timezone.utc)
            ids = {}
            for d in demo_doctors:
                res = await db["doctors"].find_one_and_update(
                    {"name": d["name"], "demo": True},
                    {"$set": {**d, "active": True, "demo": True, "photo": "", "updated_at": now},
                     "$setOnInsert": {"verified_at": now, "created_at": now}},
                    upsert=True, return_document=True)
                ids[d["speciality"]] = str(res["_id"])
                ok += 1
                print(f"  ✓ demo doctor {d['name']}")

            mine = await get("R", "/doctors/consultations/mine") or []
            if not any(c["status"] in ("requested", "confirmed") for c in mine):
                gyn = ids["Gynaecologist"]
                for k in range(1, 8):
                    day = await get("R", f"/doctors/{gyn}/slots", params={"date": _day(k)})
                    if day and day.get("slots"):
                        await call("R", "POST", f"/doctors/{gyn}/book", "RR Apps books a gynaecologist",
                                   json={"start": day["slots"][1], "mode": "Video", "reason": "Irregular or painful periods",
                                         "symptoms": ["Cramps", "Fatigue"]})
                        break
            if not any(c["status"] == "completed" for c in mine):
                gp = ids["General physician"]
                start = (now - timedelta(days=12)).replace(hour=13, minute=0, second=0, microsecond=0)
                await db["doctor_consultations"].insert_one({
                    "user_id": uid["R"], "member_name": users["R"].get("full_name", ""), "doctor_id": gp,
                    "doctor_name": "Dr. Imran Qureshi (demo)", "speciality": "General physician", "doctor_photo": "",
                    "fee_minor": 25000, "clinic": "City Care Polyclinic", "city": "Pune", "start": start, "mode": "Video",
                    "reason": "Tiredness or weakness", "symptoms": ["Fatigue", "Headache"], "status": "completed",
                    "join_info": "Video link sent on WhatsApp by the clinic",
                    "prescription": {"text": "1. Iron + folic acid tablet — 1 a day after lunch — 60 days\n"
                                             "2. Vitamin D3 60,000 IU — 1 a week with milk — 8 weeks\n"
                                             "Eat: green leafy vegetables, jaggery with roasted chana, a lemon with meals.\n"
                                             "Repeat haemoglobin test after 2 months.",
                                     "file": "", "at": start + timedelta(minutes=30), "by": "demo"},
                    "demo": True, "created_at": start - timedelta(days=2), "updated_at": start + timedelta(minutes=30)})
                ok += 1
                print("  ✓ RR Apps has a completed consultation with a prescription")

            # Mentor Connect groups our real mentors by topic; make sure Fitness
            # has at least one (the wellbeing mentor also teaches gentle yoga).
            if not await db["mentors"].find_one({"status": "active", "expertise": {"$in": ["Fitness", "Yoga"]}}):
                await db["mentors"].update_one({"status": "active", "expertise": {"$in": ["Wellbeing", "Mental Wellness"]}},
                                               {"$addToSet": {"expertise": {"$each": ["Yoga", "Fitness"]}}})
                print("  ✓ a wellbeing mentor now lists yoga and fitness")

        on = want("health_records_reminders")
        if on:
            print("Health: records (readings, allergies, medicines, history, a report) and reminders")
            for who in ("R", "P"):
                have = await get(who, "/me/health/entries", params={"kind": "measure"}) or []
                if have:
                    print(f"  · {who} already has readings — skipped records")
                else:
                    readings = [("Weight", ["61.2", "60.8", "60.5", "60.1"]), ("Blood pressure", ["128/84", "124/82", "122/80", "118/78"]),
                                ("Blood sugar", ["112", "104", "98", "96"]), ("Haemoglobin", ["10.8", "11.2", "11.9"])]
                    for typ, values in readings:
                        for i, v in enumerate(values):
                            await call(who, "POST", "/me/health/entries", f"{who} {typ} {v}",
                                       json={"kind": "measure", "date": _day(-(len(values) - 1 - i) * 14), "data": {"type": typ, "value": v}})
                    for name, sev, reaction in (("Dust", "Mild", "Sneezing"), ("Penicillin", "Severe", "Rash")):
                        await call(who, "POST", "/me/health/entries", f"{who} allergy {name}",
                                   json={"kind": "allergy", "data": {"name": name, "severity": sev, "reaction": reaction}})
                    for name, dose, sched, reason, taken in (("Iron", "1 tablet", "After lunch", "Low haemoglobin", [_day(-2), _day(-1)]),
                                                             ("Vitamin D", "1 tablet", "After breakfast", "", [_day(-1)])):
                        await call(who, "POST", "/me/health/entries", f"{who} medicine {name}",
                                   json={"kind": "medication", "data": {"name": name, "dose": dose, "schedule": sched, "reason": reason,
                                                                        "status": "Taking now", "taken": taken}})
                    await call(who, "POST", "/me/health/entries", f"{who} stopped medicine",
                               json={"kind": "medication", "data": {"name": "Paracetamol", "dose": "1 tablet", "schedule": "After dinner",
                                                                    "status": "Stopped"}})
                    for cat, cond, since in (("Previous condition", "Anaemia", "2024"), ("Surgery", "C-section", "2019"),
                                             ("Family history", "Mother: diabetes", "")):
                        await call(who, "POST", "/me/health/entries", f"{who} history {cond}",
                                   json={"kind": "history", "data": {"cat": cat, "condition": cond, "since": since}})
                    await call(who, "POST", "/me/health/entries", f"{who} report (no file)",
                               json={"kind": "document", "date": _day(-12), "data": {"title": "Complete blood count", "type": "Lab report",
                                                                                     "provider": "City Diagnostics", "shareable": True}})

                rems = await get(who, "/me/health/entries", params={"kind": "reminder"}) or []
                titles = {r["data"].get("title") for r in rems}
                plan = [
                    ("Thyroid check-up", "Doctor appointment", _day(3), "10:30", "Once", [], "City Hospital, OPD 2"),
                    ("Take iron tablet", "Medicine", _day(-14), "14:00", "Every day", [_day(-2), _day(-1)], ""),
                    ("Blood test before breakfast", "Doctor appointment", _day(-1), "08:00", "Once", [], "City Diagnostics"),
                    ("Evening walk", "Workout", _day(-7), "18:00", "Every week", [], ""),
                    ("Dental cleaning", "Doctor appointment", _day(-5), "11:00", "Once", [_day(-5)], ""),
                    ("Refill medicines", "Medicine", _day(0), "23:30", "Once", [], ""),
                ]
                for title, cat, day, time_, rep, done, where in plan:
                    if title in titles:
                        continue
                    await call(who, "POST", "/me/health/entries", f"{who} reminder {title}",
                               json={"kind": "reminder", "date": day, "data": {"title": title, "category": cat, "time": time_,
                                                                               "repeat": rep, "done": done, "where": where}})
            await call("R", "PUT", "/me/health/settings", "RR Apps fills her health card",
                       json={"bloodGroup": "B+", "heightCm": 158, "emergencyContact": "Sister — 98480 12345", "reminderLead": 30})

    await db["demo_seed"].update_one({"_id": MARKER}, {"$set": {"at": datetime.now(timezone.utc), "ok": ok,
                                                                "failed": len(bad)}}, upsert=True)
    print(f"\n{ok} steps done, {len(bad)} failed.")
    for b in bad:
        print("  -", b)


if __name__ == "__main__":
    only = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--only=")), "")
    asyncio.run(main(force="--force" in sys.argv, only=set(only.split(",")) if only else None))
