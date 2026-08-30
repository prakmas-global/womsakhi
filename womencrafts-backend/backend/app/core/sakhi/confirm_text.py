"""
The sentence she approves, in her own language.

The confirmation is the one sentence in the whole conversation that is NOT
written by the model. It is built from the database, so that what she agrees to
is what the code is about to do — see `tools.describe`. That property is worth
keeping, and it is why this is a table of templates rather than a request to
translate on the fly: the values still come from her records, and only the words
around them change.

Everything else about Sakhi follows the language she set. A woman reading Telugu
should not be handed an English sentence at the one moment she is being asked to
say yes to something that changes her records.

Machine-translated, like the catalogues on the frontend beyond English, Hindi
and Urdu. `LOCALES.reviewed` in the app is what records that honestly; these
strings carry the same caveat and the money and booking wording is what a native
speaker should read first.
"""

from __future__ import annotations

# book / cancel / join / leave, then the two words for how a session is held.
_T: dict[str, dict[str, str]] = {
    "en": {
        "_session": "this session", "_booking": "this booking", "_program": "this programme",
        "book_session": "Book {service} on {date} at {time}, {mode}?",
        "cancel_booking": "Cancel {service}?",
        "join_program": "Join {name}?",
        "leave_program": "Leave {name}?",
        "online": "online", "in_person": "in person",
    },
    "hi": {
        "_session": "यह सत्र", "_booking": "यह बुकिंग", "_program": "यह कार्यक्रम",
        "book_session": "{service} को {date} को {time} बजे, {mode} बुक कर दूँ?",
        "cancel_booking": "{service} रद्द कर दूँ?",
        "join_program": "{name} में शामिल कर दूँ?",
        "leave_program": "{name} छोड़ दूँ?",
        "online": "ऑनलाइन", "in_person": "आमने-सामने",
    },
    "ur": {
        "_session": "یہ سیشن", "_booking": "یہ بکنگ", "_program": "یہ پروگرام",
        "book_session": "{service} کو {date} کو {time} بجے، {mode} بک کر دوں؟",
        "cancel_booking": "{service} منسوخ کر دوں؟",
        "join_program": "{name} میں شامل کر دوں؟",
        "leave_program": "{name} چھوڑ دوں؟",
        "online": "آن لائن", "in_person": "روبرو",
    },
    "te": {
        "_session": "ఈ సెషన్", "_booking": "ఈ బుకింగ్", "_program": "ఈ ప్రోగ్రామ్",
        "book_session": "{service} ను {date} న {time} కి, {mode} బుక్ చేయనా?",
        "cancel_booking": "{service} రద్దు చేయనా?",
        "join_program": "{name} లో చేరనా?",
        "leave_program": "{name} నుండి వైదొలగనా?",
        "online": "ఆన్‌లైన్", "in_person": "ప్రత్యక్షంగా",
    },
    "ta": {
        "_session": "இந்த அமர்வு", "_booking": "இந்தப் பதிவு", "_program": "இந்தத் திட்டம்",
        "book_session": "{service} ஐ {date} அன்று {time} மணிக்கு, {mode} பதிவு செய்யவா?",
        "cancel_booking": "{service} ரத்து செய்யவா?",
        "join_program": "{name} இல் சேரவா?",
        "leave_program": "{name} இலிருந்து விலகவா?",
        "online": "ஆன்லைன்", "in_person": "நேரில்",
    },
    "bn": {
        "_session": "এই সেশন", "_booking": "এই বুকিং", "_program": "এই প্রোগ্রাম",
        "book_session": "{service} {date} তারিখে {time} টায়, {mode} বুক করব?",
        "cancel_booking": "{service} বাতিল করব?",
        "join_program": "{name} এ যোগ দেব?",
        "leave_program": "{name} ছেড়ে দেব?",
        "online": "অনলাইন", "in_person": "সরাসরি",
    },
    "mr": {
        "_session": "हे सत्र", "_booking": "ही बुकिंग", "_program": "हा कार्यक्रम",
        "book_session": "{service} {date} रोजी {time} वाजता, {mode} बुक करू का?",
        "cancel_booking": "{service} रद्द करू का?",
        "join_program": "{name} मध्ये सामील होऊ का?",
        "leave_program": "{name} सोडू का?",
        "online": "ऑनलाइन", "in_person": "प्रत्यक्ष",
    },
    "gu": {
        "_session": "આ સત્ર", "_booking": "આ બુકિંગ", "_program": "આ કાર્યક્રમ",
        "book_session": "{service} {date} ના રોજ {time} વાગ્યે, {mode} બુક કરું?",
        "cancel_booking": "{service} રદ કરું?",
        "join_program": "{name} માં જોડાઉં?",
        "leave_program": "{name} છોડું?",
        "online": "ઓનલાઈન", "in_person": "રૂબરૂ",
    },
    "kn": {
        "_session": "ಈ ಅವಧಿ", "_booking": "ಈ ಬುಕಿಂಗ್", "_program": "ಈ ಕಾರ್ಯಕ್ರಮ",
        "book_session": "{service} ಅನ್ನು {date} ರಂದು {time} ಕ್ಕೆ, {mode} ಬುಕ್ ಮಾಡಲೇ?",
        "cancel_booking": "{service} ರದ್ದು ಮಾಡಲೇ?",
        "join_program": "{name} ಗೆ ಸೇರಲೇ?",
        "leave_program": "{name} ಬಿಡಲೇ?",
        "online": "ಆನ್‌ಲೈನ್", "in_person": "ಖುದ್ದಾಗಿ",
    },
    "ml": {
        "_session": "ഈ സെഷൻ", "_booking": "ഈ ബുക്കിംഗ്", "_program": "ഈ പ്രോഗ്രാം",
        "book_session": "{service} {date}-ന് {time}-ന്, {mode} ബുക്ക് ചെയ്യട്ടെ?",
        "cancel_booking": "{service} റദ്ദാക്കട്ടെ?",
        "join_program": "{name}-ൽ ചേരട്ടെ?",
        "leave_program": "{name} വിടട്ടെ?",
        "online": "ഓൺലൈൻ", "in_person": "നേരിട്ട്",
    },
    "pa": {
        "_session": "ਇਹ ਸੈਸ਼ਨ", "_booking": "ਇਹ ਬੁਕਿੰਗ", "_program": "ਇਹ ਪ੍ਰੋਗਰਾਮ",
        "book_session": "{service} ਨੂੰ {date} ਨੂੰ {time} ਵਜੇ, {mode} ਬੁੱਕ ਕਰ ਦਿਆਂ?",
        "cancel_booking": "{service} ਰੱਦ ਕਰ ਦਿਆਂ?",
        "join_program": "{name} ਵਿੱਚ ਸ਼ਾਮਲ ਹੋ ਜਾਵਾਂ?",
        "leave_program": "{name} ਛੱਡ ਦਿਆਂ?",
        "online": "ਆਨਲਾਈਨ", "in_person": "ਰੂਬਰੂ",
    },
    "or": {
        "_session": "ଏହି ସେସନ", "_booking": "ଏହି ବୁକିଂ", "_program": "ଏହି କାର୍ଯ୍ୟକ୍ରମ",
        "book_session": "{service} କୁ {date} ରେ {time} ରେ, {mode} ବୁକ୍ କରିବି?",
        "cancel_booking": "{service} ବାତିଲ୍ କରିବି?",
        "join_program": "{name} ରେ ଯୋଗ ଦେବି?",
        "leave_program": "{name} ଛାଡ଼ିବି?",
        "online": "ଅନଲାଇନ୍", "in_person": "ପ୍ରତ୍ୟକ୍ଷ",
    },
    "ar": {
        "_session": "هذه الجلسة", "_booking": "هذا الحجز", "_program": "هذا البرنامج",
        "book_session": "أحجز {service} يوم {date} الساعة {time}، {mode}؟",
        "cancel_booking": "ألغي {service}؟",
        "join_program": "أنضمّ إلى {name}؟",
        "leave_program": "أترك {name}؟",
        "online": "عبر الإنترنت", "in_person": "حضوريًا",
    },
    "es": {
        "_session": "esta sesión", "_booking": "esta reserva", "_program": "este programa",
        "book_session": "¿Reservo {service} el {date} a las {time}, {mode}?",
        "cancel_booking": "¿Cancelo {service}?",
        "join_program": "¿Te inscribo en {name}?",
        "leave_program": "¿Te doy de baja de {name}?",
        "online": "en línea", "in_person": "presencial",
    },
    "fr": {
        "_session": "cette séance", "_booking": "cette réservation", "_program": "ce programme",
        "book_session": "Je réserve {service} le {date} à {time}, {mode} ?",
        "cancel_booking": "J'annule {service} ?",
        "join_program": "Je vous inscris à {name} ?",
        "leave_program": "Je vous désinscris de {name} ?",
        "online": "en ligne", "in_person": "en personne",
    },
    "pt": {
        "_session": "esta sessão", "_booking": "esta marcação", "_program": "este programa",
        "book_session": "Marco {service} no dia {date} às {time}, {mode}?",
        "cancel_booking": "Cancelo {service}?",
        "join_program": "Inscrevo-a em {name}?",
        "leave_program": "Retiro-a de {name}?",
        "online": "online", "in_person": "presencial",
    },
    "id": {
        "_session": "sesi ini", "_booking": "pemesanan ini", "_program": "program ini",
        "book_session": "Pesan {service} pada {date} pukul {time}, {mode}?",
        "cancel_booking": "Batalkan {service}?",
        "join_program": "Ikut {name}?",
        "leave_program": "Keluar dari {name}?",
        "online": "online", "in_person": "tatap muka",
    },
    "sw": {
        "_session": "kipindi hiki", "_booking": "uhifadhi huu", "_program": "programu hii",
        "book_session": "Nikuwekee {service} tarehe {date} saa {time}, {mode}?",
        "cancel_booking": "Nighairi {service}?",
        "join_program": "Nikujiunge na {name}?",
        "leave_program": "Nikuondoe kwenye {name}?",
        "online": "mtandaoni", "in_person": "ana kwa ana",
    },
}


def template(tool: str, locale: str | None) -> str:
    """The confirmation wording for one tool, in her language."""
    lang = (locale or "en").split("-")[0]
    return _T.get(lang, _T["en"]).get(tool) or _T["en"][tool]


def unnamed(kind: str, locale: str | None) -> str:
    """What to call a record whose name could not be looked up.

    This should be rare, and it is deliberately still a real word rather than a
    blank: she is being asked to approve a change, and "Leave ?" is worse than
    "Leave this programme?". It stays in her language for the same reason the
    rest of the sentence does.
    """
    lang = (locale or "en").split("-")[0]
    key = f"_{kind}"
    return _T.get(lang, _T["en"]).get(key) or _T["en"][key]


def mode_word(mode: str, locale: str | None) -> str:
    """"online" or "in person", in her language."""
    lang = (locale or "en").split("-")[0]
    key = "in_person" if (mode or "").strip().lower().startswith("in") else "online"
    return _T.get(lang, _T["en"]).get(key) or _T["en"][key]
