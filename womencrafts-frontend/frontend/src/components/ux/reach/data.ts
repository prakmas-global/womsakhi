/**
 * Reaching outward — the six things the built modules assumed but never had.
 *
 * The first five modules of the September sprint all presume a buyer, a
 * payment, a reader and a counterparty. None of those existed: every public
 * route in the app was contact/privacy/terms/about, so a customer could not see
 * a shop without creating an account, and the ledger recorded money it never
 * observed. This file is the data behind closing that.
 */

/* ── 1. Her shop, on the open web ─────────────────────────────────────────── */

/**
 * A page a customer can open from a WhatsApp message.
 *
 * IFC found **61% of women selling on Jumia also sell through WhatsApp**, more
 * than men do. She is not waiting for a marketplace — she already has
 * customers, and they will not install an app to buy a ₹400 blouse. So the
 * shop has to exist as a plain link with no login, no app, and no account.
 *
 * The counter-evidence shapes it too: a nationwide randomised evaluation of
 * rural e-commerce found **no income gains for producers**, because a crowded
 * market of strangers gives a small seller nowhere to stand out. So this is not
 * a marketplace listing. It is *her* page, that only she gives out — the buyer
 * arrives already knowing her name.
 */
export type PublicItem = {
  id: string;
  title: string;
  detail: string;
  minor: number;
  unit?: string;
  kind: "thing" | "service" | "food";
  madeToOrder: boolean;
  stock: number | null;
  icon: string;
  tint: string;
  ink: string;
};

export type PublicSlot = { id: string; day: string; time: string; service: string; minutes: number; taken: boolean };

export type PublicShop = {
  handle: string;
  name: string;
  trade: string;
  place: string;
  since: string;
  /** Shown instead of stars. Most sellers have too few ratings to mean anything. */
  ordersDone: number;
  repeatBuyers: number;
  complaints: number;
  /** The FSSAI number an aggregator is legally required to display. Hers to show. */
  fssai?: string;
  about: string;
  items: PublicItem[];
  slots: PublicSlot[];
};

export const SHOP: PublicShop = {
  handle: "priya-tailoring",
  name: "Priya Sharma",
  trade: "Tailoring and mehendi",
  place: "Malviya Nagar, Jaipur",
  since: "January 2025",
  ordersDone: 87,
  repeatBuyers: 11,
  complaints: 0,
  fssai: undefined,
  about: "I stitch blouses, kurtis and school uniforms, and I do mehendi for weddings. Anything you order is made by me at home — nobody else touches it.",
  items: [
    { id: "i1", title: "Blouse stitching", detail: "Ready in three days. Bring your own cloth or I will get it", minor: 40000, unit: "per blouse", kind: "service", madeToOrder: true, stock: null, icon: "Scissors", tint: "--ux-tint-pink", ink: "--ux-pink-ink" },
    { id: "i2", title: "School uniform, stitched", detail: "Shirt and pinafore. Sizes 4 to 14", minor: 55000, unit: "per set", kind: "thing", madeToOrder: true, stock: null, icon: "Shirt", tint: "--ux-tint-blue", ink: "--ux-blue-ink" },
    { id: "i3", title: "Kurti, ready to wear", detail: "Cotton, three colours. Medium and large in stock", minor: 65000, unit: "each", kind: "thing", madeToOrder: false, stock: 4, icon: "Shirt", tint: "--ux-tint-violet", ink: "--ux-violet" },
    { id: "i4", title: "Mehendi, simple", detail: "Both hands, up to the wrist. About an hour", minor: 60000, unit: "per person", kind: "service", madeToOrder: false, stock: null, icon: "Flower2", tint: "--ux-tint-orange", ink: "--ux-orange-ink" },
    { id: "i5", title: "Bridal mehendi", detail: "Hands and feet, full design. Three hours", minor: 200000, unit: "per bride", kind: "service", madeToOrder: false, stock: null, icon: "Sparkles", tint: "--ux-tint-amber", ink: "--ux-amber-ink" },
  ],
  slots: [
    { id: "ps1", day: "Today", time: "11:00", service: "Blouse fitting", minutes: 30, taken: false },
    { id: "ps2", day: "Today", time: "16:00", service: "Mehendi, simple", minutes: 60, taken: false },
    { id: "ps3", day: "Tomorrow", time: "10:00", service: "Blouse fitting", minutes: 30, taken: false },
    { id: "ps4", day: "Tomorrow", time: "11:00", service: "Bridal mehendi", minutes: 180, taken: true },
    { id: "ps5", day: "Saturday", time: "10:00", service: "Bridal mehendi", minutes: 180, taken: false },
  ],
};

/* ── 2. Collecting the money ──────────────────────────────────────────────── */

/**
 * The app recorded what she was owed and never saw the money.
 *
 * `settings/payments` holds her *payout* account — where WomSakhi sends her
 * balance. There was nothing for the other direction: a customer handing her
 * ₹400. So proof of income, the trust record, the employer payment history and
 * the whole pricing corpus rested on her typing it in rather than on anything
 * the app observed.
 *
 * A request is a link and a QR. It is deliberately not a wallet: **we do not
 * hold her money.** Holding pooled customer funds makes WomSakhi a regulated
 * payment aggregator, and the settlement goes bank-to-bank to her own account.
 */
export type Request = {
  id: string;
  ref: string;
  what: string;
  minor: number;
  who: string;
  when: string;
  state: "unpaid" | "seen" | "paid";
  /** Where it went out. A link she pasted, or a QR she held up. */
  via: "link" | "qr" | "in person";
  paidOn?: string;
};

export const REQUESTS: Request[] = [
  { id: "q1", ref: "PR-4821", what: "Blouse stitching", minor: 40000, who: "Sunita Devi", when: "Today", state: "paid", via: "link", paidOn: "Today, 2:40pm" },
  { id: "q2", ref: "PR-4820", what: "2 school uniforms", minor: 110000, who: "Meera Joshi", when: "Yesterday", state: "seen", via: "link" },
  { id: "q3", ref: "PR-4818", what: "Bridal mehendi, advance", minor: 80000, who: "Kavita R.", when: "3 days ago", state: "unpaid", via: "qr" },
  { id: "q4", ref: "PR-4815", what: "Kurti, large", minor: 65000, who: "Walk-in customer", when: "Last week", state: "paid", via: "qr", paidOn: "Last week" },
];

/** The one being paid on the public page. */
export const PAY_REF = "PR-4820";

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

export type GroupStep = { id: string; what: string; detail: string; done: boolean };

export const GROUP_STEPS: GroupStep[] = [
  { id: "gs1", what: "Ten women who agree", detail: "You have fourteen on the Rangoli bid", done: true },
  { id: "gs2", what: "Decide who signs", detail: "Two or three names, not one", done: false },
  { id: "gs3", what: "Agree how the money splits", detail: "Before the order, in writing, or it will end a friendship", done: false },
  { id: "gs4", what: "Register", detail: "A lawyer does this. Around ₹15,000, about eight weeks", done: false },
  { id: "gs5", what: "One bank account in the group's name", detail: "Two signatures to take money out", done: false },
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

export const unpaidTotal = (rows: Request[]) =>
  rows.filter((r) => r.state !== "paid").reduce((n, r) => n + r.minor, 0);
export const paidTotal = (rows: Request[]) =>
  rows.filter((r) => r.state === "paid").reduce((n, r) => n + r.minor, 0);
export const riskCount = (rows: BuyerCheck[]) => rows.filter((c) => !c.ok).length;
export const shopFrom = (h: string) => (h === SHOP.handle ? SHOP : null);
