/* ── 3. Read it to me ─────────────────────────────────────────────────────── */

/**
 * Adult female literacy in the rural sample behind this research was **36%**,
 * against 71% for men. Voice listing fixed one screen. The other 109 routes are
 * still text, which makes the app usable by her literate daughter rather than
 * by her.
 *
 * Two settings, because they are different problems: **reading** (the app talks)
 * and **writing** (she talks). A woman may want one and not the other.
 */
export type VoicePref = {
  id: string;
  label: string;
  detail: string;
  on: boolean;
  icon: string;
};

export const VOICE_PREFS: VoicePref[] = [
  { id: "vp1", label: "Read the screen to me", detail: "A speaker button on every page. Nothing reads out on its own", on: true, icon: "Volume2" },
  { id: "vp2", label: "Read numbers slowly", detail: "Rupees and dates said clearly, one at a time", on: true, icon: "Hash" },
  { id: "vp3", label: "Let me speak instead of typing", detail: "Anywhere you would type, you can talk", on: true, icon: "Mic" },
  { id: "vp4", label: "Bigger text", detail: "Everything one size larger", on: false, icon: "Type" },
  { id: "vp5", label: "Read out money amounts aloud", detail: "Off by default — someone may be listening", on: false, icon: "EarOff" },
];

export const VOICE_LANGUAGES = [
  { code: "hi", label: "हिन्दी", english: "Hindi", ready: true },
  { code: "mr", label: "मराठी", english: "Marathi", ready: true },
  { code: "bn", label: "বাংলা", english: "Bengali", ready: true },
  { code: "ta", label: "தமிழ்", english: "Tamil", ready: true },
  { code: "te", label: "తెలుగు", english: "Telugu", ready: true },
  { code: "kn", label: "ಕನ್ನಡ", english: "Kannada", ready: false },
  { code: "gu", label: "ગુજરાતી", english: "Gujarati", ready: false },
  { code: "en", label: "English", english: "English", ready: true },
];

/* ── 4. A body that can sign ──────────────────────────────────────────────── */

/**
 * Consortium bidding shipped without a counterparty.
 *
 * Fourteen women can share a 300-piece order, but no buyer can sign a contract
 * with fourteen individuals, and no buyer will make fourteen payments. The
 * readiness list covered *her own* Udyam registration and stopped there.
 *
 * WEConnect International has 22,000+ certified women-owned businesses against
 * just 180+ corporate buyers after operating since 2009 — certification was
 * never the constraint. The constraint is being a party a company's accounts
 * department can actually pay.
 *
 * Three real forms, with the trade-off stated rather than a recommendation
 * dressed as one.
 */
export type Vehicle = {
  id: string;
  name: string;
  what: string;
  minMembers: number;
  costMinor: number;
  weeks: number;
  canSign: boolean;
  canHoldMoney: boolean;
  good: string[];
  bad: string[];
};

export const VEHICLES: Vehicle[] = [
  {
    id: "v1", name: "Stay as you are", what: "Each woman invoices for her own share",
    minMembers: 1, costMinor: 0, weeks: 0, canSign: false, canHoldMoney: false,
    good: ["Nothing to set up", "No shared liability — nobody can be chased for another woman's mistake"],
    bad: ["Most companies will not place one order across fourteen invoices", "No single person can sign for the group"],
  },
  {
    id: "v2", name: "One of you leads", what: "One woman contracts, and pays the others",
    minMembers: 2, costMinor: 0, weeks: 1, canSign: true, canHoldMoney: true,
    good: ["Can be done this week", "Buyer deals with one name and makes one payment"],
    bad: ["Everything lands on one woman — the tax, the risk and the buyer's anger", "She is out of pocket until the buyer pays, which on a 90-day order is a long time"],
  },
  {
    id: "v3", name: "Register together", what: "A producer company or a registered society the group owns",
    minMembers: 10, costMinor: 1500000, weeks: 8, canSign: true, canHoldMoney: true,
    good: ["The group signs, not one woman", "Opens government supply contracts and reserved procurement", "Nobody is personally liable for the group's contract"],
    bad: ["Costs money and takes about two months", "Annual filings — a real, recurring obligation", "Needs at least ten of you, and agreement on who decides what"],
  },
];

/* ── 5. Fraud at the moment it happens ────────────────────────────────────── */

/**
 * `/app/digital` teaches scam-spotting as a lesson. A lesson is read once,
 * months before the money moves.
 *
 * She is now handling payments, so the teaching has to become a guardrail: a
 * check at the point of risk, in the words the scam actually uses. Every
 * pattern below is one that specifically targets home-based women workers —
 * the work-from-home kit fee, the overpayment reversal, the "verify your
 * account" UPI collect request.
 *
 * The UPI mechanic matters and is widely misunderstood: **you never enter a PIN
 * to receive money.** A request to approve a payment in order to be paid is
 * always the wrong way round. That single sentence prevents most of these.
 */
export type ScamPattern = {
  id: string;
  name: string;
  theyWillSay: string;
  whatIsHappening: string;
  whatToDo: string;
  icon: string;
};

export const SCAMS: ScamPattern[] = [
  {
    id: "sc1", name: "Pay for the work kit",
    theyWillSay: "“Work from home, ₹25,000 a month. Registration and material kit, ₹500.”",
    whatIsHappening: "There is no work. The ₹500 is the whole business, taken from thousands of women.",
    whatToDo: "Nobody who is hiring you asks you for money. Not for a kit, not for registration, not for a form.",
    icon: "PackageX",
  },
  {
    id: "sc2", name: "Approve to receive",
    theyWillSay: "“I am sending your payment — just approve the request and enter your PIN.”",
    whatIsHappening: "That request takes money out. A PIN is only ever for sending, never for receiving.",
    whatToDo: "Money arriving needs nothing from you. If a screen asks for your PIN, you are paying, not being paid.",
    icon: "ShieldAlert",
  },
  {
    id: "sc3", name: "I paid you too much",
    theyWillSay: "“Sorry, I sent ₹5,000 instead of ₹500. Please return the difference.”",
    whatIsHappening: "The first payment is fake or will be reversed. The money you send back is real.",
    whatToDo: "Check your own bank balance yourself before returning anything. A screenshot is not money.",
    icon: "Undo2",
  },
  {
    id: "sc4", name: "Send the goods first",
    theyWillSay: "“Courier it today, I will pay on delivery. I am ordering fifty pieces.”",
    whatIsHappening: "A large first order from someone you have never met, needing goods before money.",
    whatToDo: "Ask for the material cost up front. A real buyer expects that. Someone who refuses is telling you something.",
    icon: "Truck",
  },
  {
    id: "sc5", name: "Your account will be blocked",
    theyWillSay: "“Your KYC has expired. Click here or your money will be frozen today.”",
    whatIsHappening: "Urgency is the trick. A real bank never gives you a same-day deadline over a message.",
    whatToDo: "Do not use their link. Go to your bank yourself, or ask in your circle before you touch it.",
    icon: "Link2Off",
  },
];

/** Checks run against a buyer before she ships. Not a score — reasons. */
export type BuyerCheck = { id: string; what: string; ok: boolean; note: string };

export const BUYER_CHECKS: BuyerCheck[] = [
  { id: "bc1", what: "Has bought from a woman here before", ok: false, note: "First time. Not a problem by itself" },
  { id: "bc2", what: "Asked you to pay them anything", ok: true, note: "No. Good" },
  { id: "bc3", what: "Wants the goods before paying", ok: false, note: "Yes — ask for the cloth money first" },
  { id: "bc4", what: "Reported by another woman", ok: true, note: "Never" },
  { id: "bc5", what: "In a hurry", ok: false, note: "Wants it couriered today. Slow it down" },
];

/* ── 6. Bringing them along ───────────────────────────────────────────────── */

/**
 * The narrow version, and it is deliberately narrow.
 *
 * Bain and Google found the top constraint for roughly half of rural women
 * solopreneurs in India is the **absence of social permission to work** — not
 * tools — and their satisfaction with existing services scores *negative.* The
 * research artifact's own conclusion was that a better app does not move that:
 * the intermediary, the circle and the household-facing view do. Two of those
 * three are built.
 *
 * What this is NOT: an app that manages her family, scripts her marriage, or
 * tells her how to handle a man. That would be patronising at best, and on a
 * shared handset it could be dangerous.
 *
 * What it IS: three concrete things she can put in front of a household —
 * a plain statement of what the work brought in, an answer to the specific
 * objection being raised, and a woman further along who will speak to them.
 * She chooses all of it. Nothing is ever sent to anyone on her behalf.
 */
export type Objection = {
  id: string;
  said: string;
  answer: string;
  proof?: string;
  icon: string;
};

export const OBJECTIONS: Objection[] = [
  {
    id: "ob1", said: "“Who will look after the house?”",
    answer: "The work happens in the hours you choose. Show them the week — the times you kept closed are on it, in your own hand.",
    proof: "Your week", icon: "CalendarDays",
  },
  {
    id: "ob2", said: "“This is not real money.”",
    answer: "It is, and it is written down. Nine months, every month with earnings, and a statement anyone can check.",
    proof: "Your earnings statement", icon: "Receipt",
  },
  {
    id: "ob3", said: "“Who are these people you talk to?”",
    answer: "Women from here, by name — and they can meet. A circle is not strangers on a phone.",
    proof: "Your circle, by name", icon: "Users",
  },
  {
    id: "ob4", said: "“What if you are cheated?”",
    answer: "The money goes to your own bank account, not to an app. And every buyer's record is there before you take the work.",
    proof: "Where the money goes", icon: "Landmark",
  },
  {
    id: "ob5", said: "“It is not respectable.”",
    answer: "Then let someone they respect say otherwise. A woman further along, from here, who has done this for years.",
    proof: "Ask her to speak to them", icon: "MessageCircle",
  },
];

export type Speaker = { id: string; name: string; trade: string; years: number; note: string; done: number };

export const SPEAKERS: Speaker[] = [
  { id: "sp1", name: "Sunita Devi", trade: "Tailoring", years: 11, note: "Has spoken to nine families. Usually goes with her husband", done: 9 },
  { id: "sp2", name: "Lakshmi Bai", trade: "Pickles and papad", years: 7, note: "Older, and known at the temple. Families listen to her", done: 14 },
  { id: "sp3", name: "Radha Menon", trade: "Tuition", years: 5, note: "Speaks to fathers about daughters finishing school", done: 4 },
];

/* ── derived ─────────────────────────────────────────────────────────────── */

export const riskCount = (rows: BuyerCheck[]) => rows.filter((c) => !c.ok).length;
