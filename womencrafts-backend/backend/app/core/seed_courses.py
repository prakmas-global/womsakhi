"""
Demo courses for Learn — written for the women WomSakhi is for.

Five free courses from the WomSakhi team and four taught by demo members (three
of them paid, so the pay-the-teacher flow can be tried end to end). Each has
real lessons with real text, so a course can actually be followed in a demo.

Idempotent: a course is matched by its name and only inserted when missing, so
this can run on every start (development only — `seed_all` never runs in
production) without duplicating anything or touching courses people edited.
"""

from datetime import datetime, timezone

from app.db.mongodb import get_database
from app.models.program import ProgramModel


def L(title: str, detail: str, minutes: int, body: str) -> dict:
    return {"title": title, "detail": detail, "duration": f"{minutes} min", "body": body.strip(), "video_url": ""}


TEAM_COURSES = [
    {
        "name": "Start Your Home Tiffin Service",
        "category": "Cooking & Food",
        "desc": "Turn the meals you already cook into a steady income. Plan a menu, price it properly, find your first ten customers and get your food licence — all from your own kitchen.",
        "lessons": [
            L("Is a tiffin service right for you?", "Time, space and the families around you", 8, """
A tiffin service works when three things are true: you can cook the same meals reliably every day, you have a few hours in the morning, and there are offices, hostels or busy families near you.

Write down how many hours you can give each day and which days you cannot cook. Be honest — a customer who is let down once rarely comes back.
"""),
            L("Plan a menu people order every week", "Simple, filling, and the same quality daily", 10, """
Start small: one veg thali and one lighter option. Rotate the sabzi through the week but keep roti, dal and rice the same, so you buy in bulk and cook faster.

Ask three neighbours what they would pay for and what they are tired of eating. Their answers are your first menu.
"""),
            L("Price it so you actually earn", "Count every rupee, including your gas and time", 12, """
Add up one week's groceries, gas, containers and delivery for one person. Divide by the number of meals. That is your cost — your price must be clearly above it.

Most home tiffins charge a monthly amount paid in advance. It protects you from people stopping without notice.
"""),
            L("Find your first ten customers", "Offices, hostels, WhatsApp groups", 10, """
Make a simple menu card with your photo and number. Share it in your society and school WhatsApp groups and leave it with the hostel warden.

Offer a two-day trial at cost. Ask every happy customer to send one friend — word of mouth is how every successful tiffin grows.
"""),
            L("Your food licence (FSSAI basic registration)", "Rs 100 a year, done online", 8, """
If you sell food, you need a basic FSSAI registration. It costs about Rs 100 a year for a home kitchen and is applied for online at foscos.fssai.gov.in.

Keep your Aadhaar, a photo and your address proof ready. WomSakhi's "Selling food from home" page walks you through each step.
"""),
        ],
    },
    {
        "name": "Smartphone Banking and UPI Safety",
        "category": "Money & Savings",
        "desc": "Pay, receive and check your bank balance on your phone without fear. Learn how UPI works, how to spot fraud calls and fake payment screenshots, and what to do if money goes missing.",
        "lessons": [
            L("How UPI works, in plain words", "Your UPI ID, your PIN, and why the PIN is only for paying", 8, """
A UPI ID (like name@okaxis) is an address for your bank account. Anyone can send money to it — sharing it is safe.

Your UPI PIN is different. You enter it ONLY to send money out. You never need it to receive money. Anyone who asks for your PIN to "send you money" is cheating you.
"""),
            L("Receiving money safely", "Check your bank app, not their screenshot", 7, """
When someone says they paid you, open your own bank or UPI app and check the history. A screenshot can be edited in seconds.

Never scan a QR code someone sends you "to receive money". Scanning is for paying.
"""),
            L("The common frauds, and how to say no", "KYC calls, prize messages, wrong-transfer requests", 10, """
Your bank will never call you for an OTP, PIN or to "update KYC" over the phone. Hang up and call the number on the back of your card.

"I sent money to you by mistake, please return it" is a common trick. Check your own app first — usually nothing arrived.
"""),
            L("If money goes missing", "1930, your bank, and the cyber-crime portal", 6, """
Act fast. Call 1930, the national cyber-fraud helpline, and your bank's customer care. Then file a complaint at cybercrime.gov.in.

The sooner you report, the better the chance the money is frozen before it is taken out.
"""),
        ],
    },
    {
        "name": "Know Your Rights at Work and Home",
        "category": "Personal Development",
        "desc": "The laws that protect you — equal pay, maternity benefit, safety at work and at home — explained simply, with where to go for free legal help.",
        "lessons": [
            L("Equal pay and fair wages", "The same work deserves the same pay", 8, """
The law says a woman must be paid the same as a man for the same work. Every state also sets a minimum wage for different kinds of work.

Keep a note of your working days and what you were paid. It is your proof if you are ever cheated.
"""),
            L("Maternity benefit", "26 weeks of paid leave in many jobs", 7, """
If you work in a factory, shop or office with ten or more people, you are usually entitled to 26 weeks of paid maternity leave for your first two children.

Your job cannot be taken away because you are pregnant or on maternity leave.
"""),
            L("Safety at work (POSH)", "Every workplace with 10+ people needs a complaints committee", 8, """
Sexual harassment at work is against the law. Workplaces with ten or more employees must have an Internal Committee to hear complaints.

If yours does not, or you work in a home or small business, you can go to the Local Committee in your district.
"""),
            L("Free legal help near you", "DLSA lawyers cost nothing", 6, """
Every district has a Legal Services Authority (DLSA) that gives free lawyers to women. Call 15100, the national legal aid helpline, to find yours.

You can also reach the women's helpline at 181 at any hour.
"""),
        ],
    },
    {
        "name": "Spoken English for Everyday Confidence",
        "category": "Languages",
        "desc": "Speak English at the bank, the school meeting and the office without fear. Short daily practice with the sentences you will actually use.",
        "lessons": [
            L("Introducing yourself", "Your name, your work, your town", 8, """
Practise aloud: "Hello, my name is ____. I live in ____. I run a small ____ business from home."

Say it five times today, slowly. Confidence comes from repetition, not from grammar books.
"""),
            L("At the bank and the post office", "Asking for help politely", 8, """
Useful sentences: "I would like to open a savings account." "Could you please help me fill this form?" "What documents do I need?"

"Could you please…" makes almost any request polite.
"""),
            L("At your child's school", "Talking to the teacher", 8, """
"How is my child doing in class?" "Is there anything I can help with at home?" "Thank you for your time."

Write two questions before every meeting so you are not searching for words.
"""),
            L("Talking to customers", "Prices, delivery and thanking them", 9, """
"This costs ____ rupees." "I can deliver it by Friday." "Thank you for your order — please tell your friends!"

Record yourself on your phone and listen back. You will hear your own progress week by week.
"""),
            L("Your 10-minute daily habit", "Read, listen, speak", 6, """
Each day: read one short news item aloud, listen to one English song or video, and say three sentences about your day.

Ten minutes daily beats two hours once a week.
"""),
        ],
    },
    {
        "name": "Menstrual Health and Self-Care",
        "category": "Health & Wellness",
        "desc": "Understand your cycle, manage pain, choose the right products and know when to see a doctor — from doctors' guidance, without shame.",
        "lessons": [
            L("Understanding your cycle", "What is normal, and what is not", 8, """
A cycle usually lasts 21 to 35 days, and bleeding 2 to 7 days. Some months vary — that is normal.

Tracking your dates for three months shows your own pattern. WomSakhi's Cycle Tracker does it with one tap a day.
"""),
            L("Easing period pain", "Heat, movement, food and rest", 7, """
A hot water bag on the lower belly, gentle walking and staying hydrated help many women. Eat iron-rich foods like green leafy vegetables, jaggery and dates.

Pain that stops you from daily work is not something to just bear — see a doctor.
"""),
            L("Pads, cups and cloth", "Choosing what suits you", 7, """
Pads are easy to find; change them every 4 to 6 hours. Menstrual cups last years and save money once you are comfortable. Clean cloth must be washed with soap and dried fully in the sun.

What matters most is changing often and keeping clean.
"""),
            L("When to see a doctor", "Signs that need attention", 6, """
See a doctor if periods stop for more than three months (and you are not pregnant), bleeding is very heavy, you bleed between periods, or the pain is severe.

Government health centres offer check-ups free of cost.
"""),
        ],
    },
]

MEMBER_COURSES = [
    {
        "teacher_email": "priya.sharma@example.com",
        "name": "Blouse Stitching from Scratch",
        "category": "Handicrafts",
        "price_rupees": 499,
        "upi_id": "priya.sharma@okaxis",
        "desc": "I have stitched blouses for 12 years. In six lessons I will teach you to take measurements, cut the fabric and stitch a simple blouse you can sell for Rs 300 to Rs 600.",
        "lessons": [
            L("Tools you need", "A machine, scissors, tape and chalk", 8, "Any basic machine works to begin. Keep sharp fabric scissors only for cloth, a measuring tape, tailor's chalk and pins. Total cost under Rs 500 if you already have a machine."),
            L("Taking measurements", "Bust, waist, shoulder, sleeve and length", 12, "Measure over a well-fitting blouse, not over a loose one. Write every measurement down the same way each time. Most fitting mistakes come from a rushed measurement."),
            L("Cutting the fabric", "Marking the pattern on cloth", 15, "Fold the fabric right side in. Mark front and back pieces with chalk using your measurements plus seam allowance of half an inch. Cut slowly — fabric cannot be uncut."),
            L("Stitching the body", "Darts, shoulders and side seams", 15, "Stitch the darts first, then join the shoulders, then the side seams. Press each seam with an iron as you go; it makes the finish look professional."),
            L("Sleeves and neckline", "The parts customers notice", 15, "Attach sleeves with the centre of the sleeve matching the shoulder seam. Finish the neckline with a facing or piping for a neat edge."),
            L("Pricing and getting orders", "From your first customer to regular ones", 10, "Charge for your time, not just the cloth. Start with relatives and neighbours, take photos of every finished blouse and share them on WhatsApp status."),
        ],
    },
    {
        "teacher_email": "neha.patel@example.com",
        "name": "Mehendi Designs for Beginners",
        "category": "Beauty & Care",
        "price_rupees": 0,
        "upi_id": "",
        "desc": "Learn to make your own mehendi cone and draw simple, beautiful designs for festivals and weddings. Free — practise on paper first, then on hands.",
        "lessons": [
            L("Making a cone", "Mixing a smooth, dark paste", 10, "Mix fresh henna powder with lemon juice, a little sugar and a few drops of eucalyptus oil. Rest it 6 to 8 hours, then fill a plastic cone and seal it with tape."),
            L("Basic shapes", "Dots, lines, petals and leaves", 10, "Practise on paper: dots, straight lines, curved lines, petals and leaves. Every complex design is built from these five shapes."),
            L("Your first full design", "A simple floral palm pattern", 12, "Start with a flower in the centre of the palm, add leaves around it and fill the fingertips. Keep steady pressure on the cone for even lines."),
            L("Getting a dark colour", "Aftercare that makes it last", 6, "Leave the paste on for at least 4 hours. Dab lemon-sugar mix on it while it dries. Scrape it off — do not wash — and avoid water for 12 hours."),
        ],
    },
    {
        "teacher_email": "priya.sharma@example.com",
        "name": "Sell Your Products on WhatsApp",
        "category": "Entrepreneurship",
        "price_rupees": 199,
        "upi_id": "priya.sharma@okaxis",
        "desc": "WhatsApp is where your customers already are. Set up a business profile, make a catalogue, take good photos with your phone and get paid by UPI.",
        "lessons": [
            L("WhatsApp Business in 10 minutes", "A profile customers trust", 8, "Install WhatsApp Business, add your shop name, a clear photo, your timings and a short line about what you sell. It looks professional and costs nothing."),
            L("Photos that sell", "Daylight, a plain background, three angles", 10, "Shoot near a window in daylight on a plain cloth. Take the front, the back and a close-up. Customers buy what they can see clearly."),
            L("Your catalogue and prices", "So people stop asking 'how much?'", 8, "Add each product to the catalogue with its price and size. Share the catalogue link in groups instead of sending photos one by one."),
            L("Getting paid and delivering", "UPI, cash on delivery and your income book", 8, "Share your UPI ID or QR for payment and confirm it in your own bank app. Write every sale in WomSakhi's income book — it becomes your proof of income."),
        ],
    },
    {
        "teacher_email": "kavita.rao@example.com",
        "name": "Home Baking: Cakes That Sell",
        "category": "Cooking & Food",
        "price_rupees": 299,
        "upi_id": "kavita.rao@oksbi",
        "desc": "Bake soft, eggless cakes in a pressure cooker or oven, decorate them simply, and take birthday orders from home.",
        "lessons": [
            L("Eggless sponge, the base of everything", "Curd, oil, flour and patience", 15, "Whisk curd and sugar until smooth, add oil, then fold in flour, baking powder and soda. Bake in a pre-heated cooker (without whistle) on a stand for 40 minutes."),
            L("Baking without an oven", "Cooker and kadhai methods", 10, "Put salt or sand at the bottom of the cooker, a stand on it, and pre-heat for 10 minutes. Remove the gasket and whistle. Check with a toothpick at 35 minutes."),
            L("Simple decoration", "Whipped cream, a spatula and one nozzle", 12, "Chill the cake fully before frosting. A thin first coat holds the crumbs; the second coat is the clean finish. One star nozzle is enough for borders."),
            L("Pricing a cake", "Per kg, plus your time", 8, "Add ingredients, gas and the box, then your time. Home bakers usually charge per kg; check what bakeries near you charge and stay fair."),
            L("Taking orders", "Two days' notice and an advance", 8, "Ask for orders two days ahead and take half the amount in advance by UPI. Confirm the name, message and delivery time in writing on WhatsApp."),
        ],
    },
]


def _doc(spec: dict, *, owner: dict | None) -> dict:
    lessons = spec["lessons"]
    doc = ProgramModel.create_document(
        name=spec["name"], desc=spec["desc"], category=spec["category"], mode="Online",
        duration=f"{len(lessons)} lessons", dates="Start any time", days="At your own pace",
        cap=0, status="Active", note="Live",
    )
    doc["curriculum"] = lessons
    if owner:
        doc.update(
            owner_kind=ProgramModel.OWNER_MEMBER,
            owner_id=str(owner["_id"]),
            teacher_name=owner.get("full_name") or "A WomSakhi member",
            price_minor=int(spec.get("price_rupees") or 0) * 100,
            upi_id=spec.get("upi_id", ""),
        )
    else:
        doc.update(owner_kind=ProgramModel.OWNER_STAFF, teacher_name="WomSakhi team", price_minor=0)
    doc["updated_at"] = datetime.now(timezone.utc)
    return doc


async def seed() -> None:
    db = get_database()
    programs = db[ProgramModel.collection_name]
    added = 0
    for spec in TEAM_COURSES:
        if not await programs.find_one({"name": spec["name"]}, {"_id": 1}):
            await programs.insert_one(_doc(spec, owner=None))
            added += 1
    for spec in MEMBER_COURSES:
        owner = await db["users"].find_one({"email": spec["teacher_email"], "role": "Member"}, {"full_name": 1})
        if owner and not await programs.find_one({"name": spec["name"]}, {"_id": 1}):
            await programs.insert_one(_doc(spec, owner=owner))
            added += 1
    if added:
        print(f"🌱 Seeded {added} Learn courses")
