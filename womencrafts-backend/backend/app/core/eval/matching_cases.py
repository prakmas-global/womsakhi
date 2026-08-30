"""
What a good match looks like, written down before anything was changed.

A number only means something against a fixed set of questions. These are real
sentences in the shape women actually type them — often with the goal and the
skill in one breath ("earn money from home by stitching"), often on a Latin
keyboard even when the woman reads Telugu, and often without naming anything in
the catalogue exactly.

Each case names what SHOULD come back near the top. Not the only reasonable
answer — `accept` lists everything a sensible person would call correct — but
the ones that are obviously right. The English version of the very first case
is what exposed the original bug: asked about stitching, the keyword matcher
returned Beauty & Makeup, because "earn money" fired the `earn` category and
buried the actual subject.

Same question in six languages, on purpose. A woman reading Telugu deserves the
same answer as a woman reading English, and the only way to know she gets it is
to ask both.
"""

CASES: list[dict] = [
    # --- earning from stitching: the case that exposed the bug ---------------
    {"q": "I want to earn money from home by stitching",
     "lang": "en", "accept": ["Tailoring", "Stitching", "Blouse", "Saree Draping", "Pattern Making", "Embroidery"]},
    {"q": "నేను ఇంటి నుండి కుట్టు పని చేసి డబ్బు సంపాదించాలి",
     "lang": "te", "accept": ["Tailoring", "Stitching", "Blouse", "Saree Draping", "Pattern Making", "Embroidery"]},
    {"q": "ghar se silai karke paisa kamana hai",
     "lang": "hi-latin", "accept": ["Tailoring", "Stitching", "Blouse", "Saree Draping", "Pattern Making", "Embroidery"]},
    {"q": "நான் வீட்டிலிருந்து தையல் வேலை செய்து பணம் சம்பாதிக்க வேண்டும்",
     "lang": "ta", "accept": ["Tailoring", "Stitching", "Blouse", "Saree Draping", "Pattern Making", "Embroidery"]},

    # --- selling online -------------------------------------------------------
    {"q": "How do I sell my things on the internet?",
     "lang": "en", "accept": ["Selling Online", "Instagram", "Social Media", "Canva", "Product Photography", "Online Payments"]},
    {"q": "నా వస్తువులను ఆన్‌లైన్‌లో ఎలా అమ్మాలి?",
     "lang": "te", "accept": ["Selling Online", "Instagram", "Social Media", "Canva", "Product Photography", "Online Payments"]},
    {"q": "ನನ್ನ ವಸ್ತುಗಳನ್ನು ಆನ್‌ಲೈನ್‌ನಲ್ಲಿ ಹೇಗೆ ಮಾರಬೇಕು?",
     "lang": "kn", "accept": ["Selling Online", "Instagram", "Social Media", "Canva", "Product Photography", "Online Payments"]},

    # --- money and accounts ---------------------------------------------------
    {"q": "I don't know how to keep accounts for my shop",
     "lang": "en", "accept": ["Bookkeeping", "Financial Literacy", "Taxes"]},
    {"q": "मुझे अपनी दुकान का हिसाब रखना नहीं आता",
     "lang": "hi", "accept": ["Bookkeeping", "Financial Literacy", "Taxes"]},
    {"q": "എന്റെ കടയുടെ കണക്ക് എങ്ങനെ സൂക്ഷിക്കണമെന്ന് അറിയില്ല",
     "lang": "ml", "accept": ["Bookkeeping", "Financial Literacy", "Taxes"]},

    # --- food business --------------------------------------------------------
    {"q": "I cook well and want to sell food from my kitchen",
     "lang": "en", "accept": ["Tiffin", "Home Cooking", "Food Safety", "Pickles", "Food Preservation"]},
    {"q": "నాకు వంట బాగా వచ్చు, ఇంటి నుండి ఆహారం అమ్మాలనుకుంటున్నాను",
     "lang": "te", "accept": ["Tiffin", "Home Cooking", "Food Safety", "Pickles", "Food Preservation"]},
    {"q": "আমি ভালো রান্না করি, বাড়ি থেকে খাবার বিক্রি করতে চাই",
     "lang": "bn", "accept": ["Tiffin", "Home Cooking", "Food Safety", "Pickles", "Food Preservation"]},

    # --- beauty work ----------------------------------------------------------
    {"q": "I want to start doing bridal makeup",
     "lang": "en", "accept": ["Bridal Makeup", "Beauty", "Hair Styling", "Threading", "Mehndi"]},
    {"q": "నేను పెళ్లి మేకప్ చేయడం మొదలుపెట్టాలనుకుంటున్నాను",
     "lang": "te", "accept": ["Bridal Makeup", "Beauty", "Hair Styling", "Threading", "Mehndi"]},

    # --- a loan ---------------------------------------------------------------
    {"q": "I need money to buy a second machine for my shop",
     "lang": "en", "accept": ["Loan", "Financial Literacy", "Government Schemes", "Registering Your Business"]},
    {"q": "ਮੈਨੂੰ ਦੁਕਾਨ ਲਈ ਦੂਜੀ ਮਸ਼ੀਨ ਖਰੀਦਣ ਵਾਸਤੇ ਪੈਸੇ ਚਾਹੀਦੇ ਹਨ",
     "lang": "pa", "accept": ["Loan", "Financial Literacy", "Government Schemes", "Registering Your Business"]},

    # --- computer skills ------------------------------------------------------
    {"q": "I have never used a computer and want an office job",
     "lang": "en", "accept": ["Basic Computer", "Computer Basics", "Data Entry", "Resume", "Digital Skills"]},
    {"q": "నేను ఎప్పుడూ కంప్యూటర్ వాడలేదు, ఆఫీసు ఉద్యోగం కావాలి",
     "lang": "te", "accept": ["Basic Computer", "Computer Basics", "Data Entry", "Resume", "Digital Skills"]},

    # --- registering a business ----------------------------------------------
    {"q": "How do I make my business official?",
     "lang": "en", "accept": ["Registering Your Business", "Government Schemes", "Bookkeeping", "Taxes"]},
    {"q": "میں اپنے کاروبار کو سرکاری طور پر کیسے رجسٹر کروں؟",
     "lang": "ur", "accept": ["Registering Your Business", "Government Schemes", "Bookkeeping", "Taxes"]},
]


def hit(names: list[str], accept: list[str]) -> bool:
    """Did anything acceptable come back in the top results?"""
    blob = " | ".join(names).lower()
    return any(a.lower() in blob for a in accept)
