"""
Skill tests for "Prove your skills" — ten questions each, one per main trade.

Each is practical knowledge a woman who does the work would know, not trivia.
Pass mark 70%. Idempotent: a test is matched by title and only added when
missing (development seeding — `seed_all` never runs in production).
"""

from app.db.mongodb import get_database
from app.models.skills import AssessmentModel


def Q(ask: str, options: list[str], answer: int) -> dict:
    return {"ask": ask, "options": options, "answer": answer}


TESTS = [
    {
        "skill": "Tailoring", "title": "Blouse and kurta tailoring", "minutes": 15,
        "blurb": "Measuring, cutting, stitching and fitting — what a working tailor knows.",
        "questions": [
            Q("How much seam allowance is usual on a blouse side seam?", ["None", "Half an inch to one inch", "Three inches", "A quarter of the bust"], 1),
            Q("You measure the bust over…", ["A thick sweater", "A well-fitting blouse or the body", "Loose clothes", "The waist"], 1),
            Q("Darts in a blouse are there to…", ["Decorate the front", "Shape the fabric to the body", "Save fabric", "Hide the seam"], 1),
            Q("Before cutting new cotton fabric, it is good to…", ["Iron it with starch", "Wash it once, so it shrinks before cutting", "Cut it wet", "Fold it in four"], 1),
            Q("A customer says the armhole is tight. You first check…", ["The armhole depth and the sleeve's round", "The hem length", "The neckline", "The hooks"], 0),
            Q("Pressing each seam with an iron as you go…", ["Wastes time", "Makes the finish look neat and professional", "Damages the stitches", "Is only for silk"], 1),
            Q("Which needle suits thick denim?", ["A fine needle", "A heavy, thick needle", "A hand-sewing needle", "Any needle works"], 1),
            Q("Piping on a neckline is used to…", ["Give a firm, neat edge", "Make it wider", "Replace the lining", "Add length"], 0),
            Q("To price a blouse you should count…", ["Only the cloth", "Cloth, thread, lining and your time", "What the neighbour charges", "Just your time"], 1),
            Q("A paper pattern before cutting expensive fabric helps…", ["Avoid costly mistakes", "Use more fabric", "Skip measuring", "Nothing"], 0),
        ],
    },
    {
        "skill": "Food business", "title": "Running a home food business", "minutes": 12,
        "blurb": "Hygiene, pricing, licence and customers — for tiffin, baking and snacks.",
        "questions": [
            Q("A home kitchen selling food needs…", ["No paperwork", "FSSAI basic registration", "A factory licence", "Only a GST number"], 1),
            Q("Cooked food left out in a hot kitchen is safe for about…", ["Two hours", "Two days", "A week", "Any time"], 0),
            Q("To find your cost per meal you add groceries, gas and containers, then…", ["Guess", "Divide by the number of meals", "Double it", "Ignore gas"], 1),
            Q("Taking a monthly tiffin payment in advance helps because…", ["Customers like it", "It protects you if someone stops without notice", "It is the law", "It avoids cooking"], 1),
            Q("Raw and cooked food should be…", ["Kept together", "Kept apart, with separate boards and knives", "Covered with the same cloth", "Stored warm"], 1),
            Q("For a birthday cake order, the best practice is to…", ["Bake the same day without notice", "Take two days' notice and an advance", "Never take orders", "Charge after delivery only"], 1),
            Q("Your hands should be washed…", ["Once a day", "Before cooking and after touching raw food", "Only after cooking", "Only when dirty"], 1),
            Q("A clear menu card with prices helps because…", ["It looks nice", "People stop asking 'how much?' and order faster", "It is required", "It hides costs"], 1),
            Q("Food sent in sealed containers with your name and date shows…", ["Care and builds trust", "Nothing", "That it is old", "Extra cost only"], 0),
            Q("Your first customers usually come from…", ["Big ads", "Neighbours, offices and WhatsApp groups near you", "TV", "Nowhere"], 1),
        ],
    },
    {
        "skill": "Beauty", "title": "Beauty and mehendi basics", "minutes": 10,
        "blurb": "Safe, hygienic beauty work and mehendi that customers come back for.",
        "questions": [
            Q("Before using a new product on a customer, you should…", ["Use it on the whole face", "Do a small patch test", "Mix it with water", "Skip it"], 1),
            Q("Combs and tools between customers should be…", ["Used as they are", "Cleaned and disinfected", "Blown with air", "Kept in a bag"], 1),
            Q("Natural mehendi paste is usually mixed with…", ["Lemon juice and a little sugar", "Petrol", "Bleach", "Hot oil only"], 0),
            Q("For a darker mehendi colour, the paste should stay on for…", ["Five minutes", "At least four hours", "One minute", "A week"], 1),
            Q("After removing dried mehendi, you should…", ["Wash immediately with soap", "Scrape it off and avoid water for some hours", "Apply bleach", "Rub with sand"], 1),
            Q("'Black mehendi' with chemical dye can…", ["Cause allergies and burns", "Be safer", "Last forever", "Heal skin"], 0),
            Q("Threading eyebrows on broken or infected skin is…", ["Fine", "Not safe — wait until it heals", "Better", "Required"], 1),
            Q("A price list for services helps you…", ["Confuse customers", "Charge fairly and the same for everyone", "Avoid work", "Change prices daily"], 1),
            Q("Wax should be tested on…", ["The face first", "The inside of your wrist for temperature", "Nobody", "The hair"], 1),
            Q("Photos of your work, with permission, help you…", ["Get more customers", "Lose customers", "Nothing", "Break rules"], 0),
        ],
    },
    {
        "skill": "Money", "title": "UPI, savings and money safety", "minutes": 10,
        "blurb": "Paying, receiving and saving safely — and spotting fraud.",
        "questions": [
            Q("Your UPI PIN is needed…", ["To receive money", "Only to send money", "To check your balance with anyone", "Never"], 1),
            Q("Someone sends a payment screenshot. You should…", ["Trust it", "Check your own bank or UPI app", "Ask them again", "Delete it"], 1),
            Q("A caller says she is from your bank and asks for the OTP. You…", ["Tell her", "Hang up — banks never ask for OTPs", "Give half", "Send it by SMS"], 1),
            Q("Scanning a QR code sent to you 'to receive money'…", ["Receives money", "Can send YOUR money out", "Is always safe", "Doubles the money"], 1),
            Q("If money is taken by fraud, the national helpline is…", ["100", "1930", "108", "112 only"], 1),
            Q("Writing every sale in a book helps you…", ["Know what you really earn and prove income", "Pay more tax", "Nothing", "Lose track"], 0),
            Q("A good habit for saving is…", ["Save what is left at month end", "Put aside a fixed amount first, when money comes in", "Never save", "Borrow to save"], 1),
            Q("A 'prize' message asking you to pay a fee first is…", ["A real prize", "A common fraud", "From the government", "Safe"], 1),
            Q("Your UPI ID (like name@okaxis) is…", ["Secret like a PIN", "Safe to share for receiving money", "Your bank password", "Your Aadhaar"], 1),
            Q("Keeping business and home money in separate places helps you…", ["See if the business makes a profit", "Spend more", "Nothing", "Hide money"], 0),
        ],
    },
    {
        "skill": "English", "title": "Spoken English for work", "minutes": 10,
        "blurb": "The everyday English for customers, banks and offices.",
        "questions": [
            Q("A polite way to ask for help is…", ["Help me!", "Could you please help me?", "You help.", "Help now."], 1),
            Q("A customer says 'Thank you'. You reply…", ["Okay.", "You're welcome.", "Yes.", "Thanks."], 1),
            Q("'I can deliver it by Friday' means…", ["After Friday", "On or before Friday", "Only Friday night", "Never"], 1),
            Q("To introduce yourself you say…", ["My name is Asha, I make blouses.", "Name Asha.", "Asha me.", "I Asha."], 0),
            Q("The right sentence is…", ["She go to market.", "She goes to the market.", "She going market.", "She gone market."], 1),
            Q("'How much does this cost?' asks about…", ["Time", "Price", "Size", "Colour"], 1),
            Q("At the bank, 'I would like to open a savings account' is…", ["Rude", "Polite and correct", "Wrong", "Too long"], 1),
            Q("'Could you repeat that, please?' is used when…", ["You did not understand", "You agree", "You are leaving", "You are angry"], 0),
            Q("The opposite of 'early' is…", ["Late", "Fast", "Slow", "Soon"], 0),
            Q("A good daily habit to improve spoken English is…", ["Practise saying a few sentences aloud", "Only read grammar", "Never speak", "Watch nothing"], 0),
        ],
    },
    {
        "skill": "Digital", "title": "Selling online with your phone", "minutes": 10,
        "blurb": "WhatsApp Business, product photos, catalogues and getting paid.",
        "questions": [
            Q("The best light for photographing what you make is…", ["Daylight near a window", "A dark room", "Flash at night", "Under a tube light only"], 0),
            Q("A plain background in product photos…", ["Makes the product stand out", "Looks bad", "Is not allowed", "Hides the product"], 0),
            Q("WhatsApp Business lets you add…", ["A catalogue, business hours and a short description", "Only stickers", "Nothing extra", "A bank account"], 0),
            Q("Sharing a catalogue link instead of many photos…", ["Saves everyone time and data", "Is slower", "Costs money", "Is rude"], 0),
            Q("A customer messages at night. A good reply time is…", ["Never", "The same or next day, even 'I'll check and reply'", "After a week", "Only if they call"], 1),
            Q("To show the size of an item in a photo you can…", ["Put a hand or a coin beside it", "Zoom very close", "Blur it", "Use a filter"], 0),
            Q("Before posting a customer's photo, you should…", ["Ask her permission", "Just post it", "Edit her face", "Sell it"], 0),
            Q("Your online prices should…", ["Match what you charge in person", "Change for every customer", "Be hidden", "Be guessed"], 0),
            Q("A clear reply about delivery time and cost…", ["Builds trust and repeat orders", "Is not needed", "Loses customers", "Is illegal"], 0),
            Q("Status updates with new work help because…", ["Your contacts see what you make without you asking", "They cost money", "Nobody sees them", "They delete chats"], 0),
        ],
    },
]


async def seed() -> None:
    coll = get_database()[AssessmentModel.collection_name]
    added = 0
    for t in TESTS:
        if not await coll.find_one({"title": t["title"]}, {"_id": 1}):
            await coll.insert_one(AssessmentModel.create_document(
                skill=t["skill"], title=t["title"], blurb=t["blurb"], minutes=t["minutes"],
                pass_mark=70, questions=t["questions"],
            ))
            added += 1
    if added:
        print(f"🌱 Seeded {added} skill tests")
