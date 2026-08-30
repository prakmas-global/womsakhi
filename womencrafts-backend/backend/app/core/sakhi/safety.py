"""
The gate that runs BEFORE the model, on every single message she sends.

This is the one place in Sakhi where the model is deliberately cut out of the
loop. From the vault: *"She is not a safety feature. An assistant must never sit
between a woman in distress and a real number. If Sakhi detects distress, the
correct behaviour is to surface the helpline, not to handle it."*

So when this gate fires, no request is made to any model at all. The reply is a
fixed string written by a person, plus real numbers from the same hardcoded list
the Safety screen uses. Nothing here is generated, which means nothing here can
be hallucinated, jailbroken, or reworded into something softer on a bad day.

**It is tuned to over-fire, and that is correct.** A false positive costs a woman
one extra tap past a helpline she did not need. A false negative costs something
this project is not willing to risk. When the two errors are that unequal, the
threshold does not belong in the middle.

Matching covers English, Hindi (both Devanagari and the way people actually type
it in Latin script), and Urdu — the three languages [[Internationalisation]]
says are genuinely delivered. A phrase in an untranslated language will not
match, which is a real limit and is written down in Known issues rather than
quietly assumed away.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from app.models.safety import HELPLINES

# Categories, most urgent first — the first one that matches wins.
IMMEDIATE = "immediate_danger"
SELF_HARM = "self_harm"
ABUSE = "abuse"
CHILD = "child"


@dataclass
class SafetyVerdict:
    category: str
    message: str
    helplines: list[dict]
    handoff: bool = True          # a real person is told, too


# Phrases, not single words. "hit" alone matches "hit my sales target"; the
# phrase "he hits me" does not have that problem. Every entry here was written
# to be a phrase for that reason.
_PATTERNS: list[tuple[str, tuple[str, ...]]] = [
    (IMMEDIATE, (
        "he is hitting me", "he is beating me", "beating me right now",
        "he will kill me", "going to kill me", "threatening to kill",
        "i am in danger", "i'm in danger", "help me now", "save me",
        "locked me in", "won't let me leave", "wont let me leave",
        "he has a knife", "attacking me",
        "मुझे मार रहा", "मार डालेगा", "मुझे बचाओ", "खतरे में हूं", "खतरे में हूँ",
        "mujhe maar raha", "maar dalega", "mujhe bachao", "khatre mein",
        "بچاؤ", "مار رہا ہے", "خطرے میں",
        # Marathi
        "मला मारतोय", "मला वाचवा", "जीव धोक्यात", "मला मारून टाकेल",
        # Tamil
        "என்னைக் கொன்றுவிடுவார்", "என்னைக் காப்பாற்றுங்கள்", "ஆபத்தில் இருக்கிறேன்",
        # Bengali
        "আমাকে মারছে", "আমাকে মেরে ফেলবে", "আমাকে বাঁচান", "বিপদে আছি",
        # Telugu
        "నన్ను కొడుతున్నాడు", "నన్ను చంపేస్తాడు", "నన్ను కాపాడండి", "ప్రమాదంలో ఉన్నాను",
        # Gujarati
        "મને મારે છે", "મને મારી નાખશે", "મને બચાવો", "જોખમમાં છું",
        # Kannada
        "ನನ್ನನ್ನು ಹೊಡೆಯುತ್ತಿದ್ದಾನೆ", "ನನ್ನನ್ನು ಕೊಲ್ಲುತ್ತಾನೆ", "ನನ್ನನ್ನು ಕಾಪಾಡಿ", "ಅಪಾಯದಲ್ಲಿದ್ದೇನೆ",
        # Malayalam
        "എന്നെ അടിക്കുന്നു", "എന്നെ കൊല്ലും", "എന്നെ രക്ഷിക്കൂ", "അപകടത്തിലാണ്",
        # Punjabi
        "ਮੈਨੂੰ ਮਾਰਦਾ ਹੈ", "ਮੈਨੂੰ ਮਾਰ ਦੇਵੇਗਾ", "ਮੈਨੂੰ ਬਚਾਓ", "ਖ਼ਤਰੇ ਵਿੱਚ ਹਾਂ",
        # Odia
        "ମୋତେ ମାରୁଛି", "ମୋତେ ମାରିଦେବ", "ମୋତେ ବଞ୍ଚାନ୍ତୁ", "ବିପଦରେ ଅଛି",
        # Arabic
        "سيقتلني", "أنقذوني", "في خطر", "ساعدوني الآن",
        # Spanish / French / Portuguese / Indonesian / Swahili
        "me está pegando", "me va a matar", "estoy en peligro", "ayúdenme",
        "il me frappe", "il va me tuer", "je suis en danger", "au secours",
        "está me batendo", "vai me matar", "estou em perigo", "me socorram",
        "dia memukul saya", "akan membunuh saya", "saya dalam bahaya", "tolong saya",
        "ananipiga", "ataniua", "niko hatarini", "nisaidieni",
    )),
    (SELF_HARM, (
        "kill myself", "killing myself", "end my life", "ending my life",
        "want to die", "wanna die", "don't want to live", "dont want to live",
        "no reason to live", "better off dead", "hurt myself", "harm myself",
        "suicide", "suicidal",
        "आत्महत्या", "मरना चाहती", "जीना नहीं चाहती", "खुद को खत्म",
        "aatmahatya", "marna chahti", "jeena nahi chahti", "khudkushi",
        "خودکشی", "مرنا چاہتی",
        "मरायचं आहे", "जगायचं नाही", "आत्महत्या करावी",
        "தற்கொலை", "சாக வேண்டும்", "வாழ விரும்பவில்லை",
        "আত্মহত্যা", "মরতে চাই", "বাঁচতে চাই না",
        "ఆత్మహత్య", "చనిపోవాలని", "బతకాలని లేదు",
        "આત્મહત્યા", "મરી જવું છે", "જીવવું નથી",
        "ಆತ್ಮಹತ್ಯೆ", "ಸಾಯಬೇಕು", "ಬದುಕಲು ಇಷ್ಟವಿಲ್ಲ",
        "ആത്മഹത്യ", "മരിക്കണം", "ജീവിക്കാൻ തോന്നുന്നില്ല",
        "ਖੁਦਕੁਸ਼ੀ", "ਮਰਨਾ ਚਾਹੁੰਦੀ", "ਜੀਣਾ ਨਹੀਂ ਚਾਹੁੰਦੀ",
        "ଆତ୍ମହତ୍ୟା", "ମରିବାକୁ ଚାହେଁ", "ବଞ୍ଚିବାକୁ ଚାହେଁ ନାହିଁ",
        "الانتحار", "أريد أن أموت", "لا أريد العيش",
        "quiero morir", "suicidarme", "no quiero vivir",
        "je veux mourir", "me suicider", "je ne veux plus vivre",
        "quero morrer", "me matar", "não quero viver",
        "ingin mati", "bunuh diri", "tidak ingin hidup",
        "nataka kufa", "kujiua", "sitaki kuishi",
    )),
    (ABUSE, (
        "he beats me", "he hits me", "my husband beats", "my husband hits",
        "beats me", "abusing me", "abuses me", "domestic violence",
        "forced me to", "raped", "molested", "he touches me",
        "sexually assaulted", "harassing me at home",
        "मारता है", "पीटता है", "घरेलू हिंसा", "छेड़छाड़", "बलात्कार",
        "marta hai", "peetta hai", "ghareloo hinsa", "chedchad",
        "مارتا ہے", "گھریلو تشدد", "زیادتی",
        "नवरा मारतो", "घरगुती हिंसा", "बलात्कार", "छेडछाड",
        "என்னை அடிக்கிறார்", "கணவர் அடிக்கிறார்", "குடும்ப வன்முறை", "பாலியல் வன்கொடுமை",
        "স্বামী মারে", "পারিবারিক নির্যাতন", "ধর্ষণ", "যৌন নির্যাতন",
        "భర్త కొడతాడు", "గృహ హింస", "అత్యాచారం", "లైంగిక వేధింపు",
        "પતિ મારે છે", "ઘરેલું હિંસા", "બળાત્કાર", "જાતીય સતામણી",
        "ಗಂಡ ಹೊಡೆಯುತ್ತಾನೆ", "ಕೌಟುಂಬಿಕ ಹಿಂಸೆ", "ಅತ್ಯಾಚಾರ", "ಲೈಂಗಿಕ ಕಿರುಕುಳ",
        "ഭർത്താവ് അടിക്കുന്നു", "ഗാർഹിക പീഡനം", "ബലാത്സംഗം", "ലൈംഗിക പീഡനം",
        "ਪਤੀ ਮਾਰਦਾ ਹੈ", "ਘਰੇਲੂ ਹਿੰਸਾ", "ਬਲਾਤਕਾਰ", "ਜਿਨਸੀ ਸ਼ੋਸ਼ਣ",
        "ସ୍ୱାମୀ ମାରନ୍ତି", "ଘରୋଇ ହିଂସା", "ବଳାତ୍କାର", "ଯୌନ ନିର୍ଯାତନା",
        "زوجي يضربني", "العنف الأسري", "اغتصاب", "تحرش جنسي",
        "mi esposo me pega", "violencia doméstica", "me violó", "abuso sexual",
        "mon mari me frappe", "violences conjugales", "il m'a violée", "abus sexuel",
        "meu marido me bate", "violência doméstica", "me estuprou", "abuso sexual",
        "suami memukul saya", "kekerasan dalam rumah tangga", "memperkosa saya",
        "mume wangu ananipiga", "ukatili wa nyumbani", "amenibaka",
    )),
    (CHILD, (
        "my daughter is being", "my child is being", "beating my child",
        "hurting my daughter", "hurting my son", "child is in danger",
        "मेरी बेटी को मार", "मेरे बच्चे को मार",
        "meri beti ko maar", "mere bacche ko maar",
        "माझ्या मुलीला मारतो", "माझ्या मुलाला मारतो",
        "என் மகளை அடிக்கிறார்", "என் குழந்தையை அடிக்கிறார்",
        "আমার মেয়েকে মারছে", "আমার সন্তানকে মারছে",
        "నా కూతురిని కొడుతున్నాడు", "నా బిడ్డను కొడుతున్నాడు",
        "મારી દીકરીને મારે છે", "મારા બાળકને મારે છે",
        "ನನ್ನ ಮಗಳನ್ನು ಹೊಡೆಯುತ್ತಾನೆ", "ನನ್ನ ಮಗುವನ್ನು ಹೊಡೆಯುತ್ತಾನೆ",
        "എന്റെ മകളെ അടിക്കുന്നു", "എന്റെ കുഞ്ഞിനെ അടിക്കുന്നു",
        "ਮੇਰੀ ਧੀ ਨੂੰ ਮਾਰਦਾ", "ਮੇਰੇ ਬੱਚੇ ਨੂੰ ਮਾਰਦਾ",
        "ମୋ ଝିଅକୁ ମାରୁଛି", "ମୋ ପିଲାକୁ ମାରୁଛି",
        "يضرب ابنتي", "يضرب طفلي",
        "le pega a mi hija", "le pega a mi hijo",
        "il frappe ma fille", "il frappe mon enfant",
        "bate na minha filha", "bate no meu filho",
        "memukul anak saya", "anananipiga mtoto wangu",
    )),
]

# Fixed replies. Short, plain, no advice beyond "call this number", because
# advice is the part an assistant has no business improvising.
_MESSAGES = {
    IMMEDIATE: (
        "If you are in danger right now, please call 112 — it works from any "
        "phone, anywhere in India, and reaches the police.\n\n"
        "I am an assistant, so I am not the right help for this. A person from "
        "our team has been told and will reach out. You have not done anything "
        "wrong by asking."
    ),
    SELF_HARM: (
        "I'm glad you told someone. Please call Tele-MANAS on 14416 — it is "
        "free, open at any hour, and answered in many languages by people "
        "trained for exactly this.\n\n"
        "I am an assistant and I am not what you need right now. Someone from "
        "our team has been told, and they will reach out to you."
    ),
    ABUSE: (
        "What you are describing is not your fault, and there are people whose "
        "whole job is to help with it. The Women's Helpline is 181 — free, at "
        "any hour. For the National Commission for Women, it is 7827170170, on "
        "call or WhatsApp.\n\n"
        "I have told someone on our team so a real person can follow up."
    ),
    CHILD: (
        "Please call Childline on 1098. It is free and answered at any hour by "
        "people trained to help a child in danger.\n\n"
        "I have let our team know so a person can follow up with you."
    ),
}

_URGENT_FIRST = {
    IMMEDIATE: ("112", "181"),
    SELF_HARM: ("14416", "181"),
    ABUSE: ("181", "7827170170", "112"),
    CHILD: ("1098", "112"),
}


def _helplines_for(category: str) -> list[dict]:
    wanted = _URGENT_FIRST.get(category, ("181", "112"))
    by_number = {h["number"]: h for h in HELPLINES}
    picked = [by_number[n] for n in wanted if n in by_number]
    return picked or HELPLINES[:2]


def screen(text: str) -> Optional[SafetyVerdict]:
    """Return a verdict if this message needs a person, or None to carry on.

    Called on her raw words before anything is sent to a model.
    """
    if not text:
        return None
    haystack = " ".join(text.lower().split())

    for category, phrases in _PATTERNS:
        if any(phrase in haystack for phrase in phrases):
            return SafetyVerdict(
                category=category,
                message=_MESSAGES[category],
                helplines=_helplines_for(category),
            )
    return None
