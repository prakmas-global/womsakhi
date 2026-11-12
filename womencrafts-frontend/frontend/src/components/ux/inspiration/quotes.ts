/** Original WomSakhi encouragement, rather than unverified famous quotations. */
type Line = { en: string; hi: string };
type Collection = { label: Line; lines: readonly Line[] };

export const QUOTE_COLLECTIONS = {
  home: {
    label: { en: "Your next step", hi: "आपका अगला कदम" },
    lines: [
      { en: "The work you do at home already has value. Your own dreams deserve a place in the day too.", hi: "घर में आपके काम की अपनी अहमियत है। दिन में आपके अपने सपनों के लिए भी जगह होनी चाहिए।" },
      { en: "You do not need a perfect day to begin. One small step, in your own time, is enough for today.", hi: "शुरू करने के लिए एकदम सही दिन ज़रूरी नहीं। अपने समय में एक छोटा कदम आज के लिए काफी है।" },
      { en: "Your journey belongs to you. Learning, earning, resting and asking for help can all be steps forward.", hi: "यह सफर आपका है। सीखना, कमाना, आराम करना और मदद माँगना—सब आगे बढ़ने के कदम हो सकते हैं।" },
    ],
  },
  learn: {
    label: { en: "Learning & confidence", hi: "सीखना और आत्मविश्वास" },
    lines: [
      { en: "A lesson between everyday responsibilities is still a lesson. Your pace does not make your progress smaller.", hi: "रोज़ की ज़िम्मेदारियों के बीच सीखा गया सबक भी सीख ही है। अपनी रफ्तार से बढ़ना छोटी बात नहीं।" },
      { en: "There is no age limit on learning something that makes you feel more capable.", hi: "खुद को और सक्षम बनाने वाली कोई नई चीज़ सीखने की उम्र तय नहीं होती।" },
      { en: "What you learn for yourself can open choices for your whole family, without making your own dreams any less important.", hi: "अपने लिए सीखी हुई बात परिवार के लिए भी नए रास्ते खोल सकती है। आपके अपने सपने भी उतने ही ज़रूरी हैं।" },
    ],
  },
  work: {
    label: { en: "Skills & fair work", hi: "हुनर और सम्मानजनक काम" },
    lines: [
      { en: "A skill practised at home is still a real skill. Describe it with the same confidence you put into doing it.", hi: "घर में निखारा गया हुनर भी असली हुनर है। जितने विश्वास से आप काम करती हैं, उतने ही विश्वास से उसे बताइए।" },
      { en: "Work should respect your time, your boundaries and your effort. You are allowed to ask clear questions before saying yes.", hi: "काम में आपके समय, सीमाओं और मेहनत का सम्मान होना चाहिए। हाँ कहने से पहले साफ सवाल पूछना आपका हक है।" },
      { en: "You can begin with one skill and one opportunity that fits your day. You do not have to do everything at once.", hi: "अपने दिन के मुताबिक एक हुनर और एक अवसर से शुरुआत कीजिए। सब कुछ एक साथ करना ज़रूरी नहीं।" },
    ],
  },
  earn: {
    label: { en: "Building something of your own", hi: "अपना कुछ बनाना" },
    lines: [
      { en: "The care in what you make is part of its value. Give your time and materials a place in your price.", hi: "आप जो बनाती हैं, उसमें आपकी लगन की भी कीमत है। दाम तय करते समय अपने समय और सामान को भी गिनिए।" },
      { en: "A home can be the beginning of a business. One clear offer is a practical place to start.", hi: "घर से भी कारोबार की शुरुआत हो सकती है। आप क्या दे सकती हैं, यह साफ बताना पहला काम है।" },
      { en: "Your first listing is a beginning, not a promise you must fulfil all at once. Grow at a pace you can manage.", hi: "आपकी पहली पेशकश एक शुरुआत है। अपनी क्षमता और सुविधा के मुताबिक धीरे-धीरे आगे बढ़िए।" },
    ],
  },
  money: {
    label: { en: "Money & independence", hi: "पैसा और आत्मनिर्भरता" },
    lines: [
      { en: "Every amount you record makes your own work easier to understand. Clarity is a kind of confidence.", hi: "हर लेन-देन लिखने से अपने काम को समझना आसान होता है। साफ हिसाब भी आत्मविश्वास देता है।" },
      { en: "Your effort deserves to be counted, including the small orders and the costs others do not see.", hi: "आपकी मेहनत का हिसाब होना चाहिए—छोटे ऑर्डर और अनदेखे खर्चों का भी।" },
      { en: "You are allowed to understand a payment fully before agreeing to it. Taking time is a strength.", hi: "किसी भुगतान के लिए हाँ कहने से पहले उसे पूरी तरह समझना आपका हक है। सोचने के लिए समय लेना समझदारी है।" },
    ],
  },
  community: {
    label: { en: "Women supporting women", hi: "महिलाओं का साथ" },
    lines: [
      { en: "You do not have to carry every question alone. Sharing what you know can help another woman take her next step.", hi: "हर सवाल का बोझ अकेले उठाना ज़रूरी नहीं। अपनी सीख साझा करके आप दूसरी महिला की मदद कर सकती हैं।" },
      { en: "A strong circle makes room for every woman's voice, including the one who is still finding her words.", hi: "मजबूत साथ में हर महिला की आवाज़ के लिए जगह होती है—उनके लिए भी जो अभी बोलने का हौसला जुटा रही हैं।" },
      { en: "Support can begin with listening. Another woman's progress does not take anything away from yours.", hi: "साथ देने की शुरुआत सुनने से भी होती है। किसी दूसरी महिला का आगे बढ़ना आपके सफर को छोटा नहीं करता।" },
    ],
  },
  health: {
    label: { en: "Care for yourself", hi: "अपना खयाल" },
    lines: [
      { en: "Your wellbeing matters because you matter, not only because others depend on you.", hi: "आपकी सेहत ज़रूरी है क्योंकि आप ज़रूरी हैं—सिर्फ इसलिए नहीं कि दूसरे आप पर निर्भर हैं।" },
      { en: "Rest is not something you must earn after caring for everyone else. Your needs belong in the day too.", hi: "सबका खयाल रखने के बाद ही आराम मिले, यह ज़रूरी नहीं। आपकी ज़रूरतों के लिए भी दिन में जगह होनी चाहिए।" },
      { en: "Listening to your body and asking for support are acts of self-respect.", hi: "अपने शरीर की बात सुनना और सहारा माँगना खुद का सम्मान करना है।" },
    ],
  },
  safety: {
    label: { en: "Safety & support", hi: "सुरक्षा और सहारा" },
    lines: [
      { en: "You deserve to be safe, to be heard and to choose your next step. Asking for support does not make you weak.", hi: "सुरक्षित रहना, सुनी जाना और अपना अगला कदम चुनना आपका हक है। सहारा माँगना कमज़ोरी नहीं है।" },
      { en: "Your boundaries deserve respect. You do not owe anyone your private information to prove your trust.", hi: "आपकी सीमाओं का सम्मान होना चाहिए। भरोसा साबित करने के लिए निजी जानकारी देना ज़रूरी नहीं।" },
      { en: "You do not need to have all the answers before reaching out to someone you trust.", hi: "किसी भरोसेमंद व्यक्ति से मदद माँगने से पहले हर जवाब जानना ज़रूरी नहीं।" },
    ],
  },
  rights: {
    label: { en: "Voice & choices", hi: "आवाज़ और अपने फैसले" },
    lines: [
      { en: "Understanding your options is a step towards choosing for yourself. Your questions deserve clear answers.", hi: "अपने विकल्प समझना अपने फैसले लेने की ओर एक कदम है। आपके सवालों के साफ जवाब मिलने चाहिए।" },
      { en: "Being heard should not depend on how loudly you speak. Your needs are worth explaining and understanding.", hi: "आपकी बात सुनी जाए, इसके लिए ऊँची आवाज़ ज़रूरी नहीं। आपकी ज़रूरतें समझे जाने लायक हैं।" },
      { en: "Keeping your own records can make your next conversation easier. You deserve to understand what is in your name.", hi: "अपने दस्तावेज़ सँभालकर रखने से अगली बातचीत आसान हो सकती है। अपने नाम की बातों को समझना आपका हक है।" },
    ],
  },
  family: {
    label: { en: "Home, care & your own goals", hi: "घर, देखभाल और आपके लक्ष्य" },
    lines: [
      { en: "Caring for a home is real work. Sharing responsibilities can make room for everyone's hopes, including yours.", hi: "घर सँभालना असली काम है। ज़िम्मेदारियाँ बाँटने से सबकी उम्मीदों के लिए जगह बनती है—आपकी भी।" },
      { en: "You can love your family and still make time for yourself. Both can belong in the same life.", hi: "परिवार से प्यार करते हुए अपने लिए भी समय निकालना सही है। दोनों एक ही जीवन का हिस्सा हो सकते हैं।" },
      { en: "An interrupted day is not a failed day. You can return to your own goals one small step at a time.", hi: "बीच-बीच में रुकना दिन की हार नहीं है। छोटे-छोटे कदमों से अपने लक्ष्य पर लौट सकती हैं।" },
    ],
  },
  account: {
    label: { en: "Your space, your choices", hi: "आपकी जगह, आपकी पसंद" },
    lines: [
      { en: "Your story belongs to you. Choose what you share, who can see it and when you are ready.", hi: "आपकी कहानी आपकी है। क्या साझा करना है, किससे और कब—यह आप चुन सकती हैं।" },
      { en: "You do not need to be someone else to begin. Let your profile show the skills and hopes that are already yours.", hi: "शुरुआत के लिए किसी और जैसा बनना ज़रूरी नहीं। अपनी पहचान में अपने हुनर और उम्मीदों को जगह दीजिए।" },
      { en: "Protecting your time and privacy is part of building an independent life.", hi: "अपने समय और निजता की रक्षा करना भी आत्मनिर्भर जीवन की ओर एक कदम है।" },
    ],
  },
  staff: {
    label: { en: "Every woman deserves a fair chance", hi: "हर महिला को बराबर अवसर" },
    lines: [
      { en: "Behind every record is a woman with her own responsibilities and hopes. Clear, respectful service helps her move forward.", hi: "हर रिकॉर्ड के पीछे अपनी ज़िम्मेदारियों और उम्मीदों वाली एक महिला है। साफ और सम्मानजनक सेवा उसे आगे बढ़ने में मदद करती है।" },
      { en: "A fair opportunity begins with listening, following through and making the next step easier to understand.", hi: "बराबर अवसर की शुरुआत सुनने, ज़िम्मेदारी निभाने और अगला कदम आसान बनाने से होती है।" },
      { en: "Good support gives women information and choices, while leaving the decision in their hands.", hi: "अच्छा सहयोग महिलाओं को जानकारी और विकल्प देता है, और फैसला उन्हीं के हाथ में रहने देता है।" },
    ],
  },
} satisfies Record<string, Collection>;

export type QuoteTopic = keyof typeof QUOTE_COLLECTIONS;

const TOPICS: [QuoteTopic, string[]][] = [
  ["safety", ["safety", "helpdesk", "incase", "safe-money", "help"]],
  ["rights", ["haq", "rights", "support-fund", "vault", "verification"]],
  ["family", ["family", "school", "bringing", "together", "care"]],
  ["health", ["health", "wellness", "cycle", "mood", "doctors", "wellbeing", "health-videos"]],
  ["money", ["money", "wallet", "books", "khata", "payments", "checkout", "billing", "collect"]],
  ["learn", ["learn", "programs", "library", "mentors", "mentoring", "assess", "certificates", "teach", "learning"]],
  ["work", ["work", "opportunities", "applications", "contracts", "employers", "growth"]],
  ["earn", ["earn", "documents", "shop", "market", "services", "rent", "rentals", "kitchen", "group-buy"]],
  ["community", ["community", "circle", "circles", "events", "messages", "stories", "friends", "refer"]],
  ["account", ["settings", "profile", "you", "account", "onboarding", "phone"]],
];

export function quoteTopicFor(path: string): QuoteTopic {
  const segments = path.split(/[?#]/)[0].split("/").filter(Boolean);
  return TOPICS.find(([, keys]) => segments.some((part) => keys.includes(part)))?.[0]
    ?? (segments[0] === "dashboard" ? "staff" : "home");
}

export function quoteForPath(path: string, offset = 0, locale = "en") {
  const topic = quoteTopicFor(path);
  const collection = QUOTE_COLLECTIONS[topic];
  const language = locale === "hi" ? "hi" : "en";
  const hash = Array.from(path).reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0);
  const line = collection.lines[(hash + offset) % collection.lines.length];
  return { topic, language, label: collection.label[language], text: line[language], by: "WomSakhi" };
}
