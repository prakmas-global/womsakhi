/**
 * What the cycle tracker says to her — care, food, quotes and the guides.
 *
 * ── Written to be true, then to be kind ─────────────────────────────────────
 * Every suggestion here is something a GP would say without hedging, and the
 * claims are the size the evidence is: heat on the belly eases cramps (good
 * evidence), ginger may (some), magnesium and B6 may soften PMS moods (some),
 * iron replaces what bleeding takes (sound). Nothing here promises to fix a
 * symptom, and nothing replaces a doctor — the guides say where the line is.
 *
 * Sources: NHS "Periods" and "Heavy periods" pages; WHO fact sheet on
 * anaemia; ACOG FAQs "Heavy menstrual bleeding" and "Dysmenorrhea"; NICE
 * NG88. **The guides must be read by a registered doctor before launch** —
 * they are drafted from those sources, not reviewed against them.
 *
 * ── Photos ──────────────────────────────────────────────────────────────────
 * `public/ux/cycle/food-*.webp` are public-domain or CC0 photographs from
 * Wikimedia Commons; `public/ux/cycle/credits.json` records each source. The
 * people are the app's own illustrations.
 */

import type { Feeling, Mood, Phase, Symptom } from "@/lib/cycle-api";

/* ── How she feels ───────────────────────────────────────────────────────── */

export const MOODS: { key: Mood; label: string; tone: string }[] = [
  { key: "happy", label: "Happy", tone: "--cy-mood-happy" },
  { key: "calm", label: "Calm", tone: "--cy-mood-calm" },
  { key: "tired", label: "Tired", tone: "--cy-mood-tired" },
  { key: "irritable", label: "Irritable", tone: "--cy-mood-irritable" },
  { key: "sad", label: "Sad", tone: "--cy-mood-sad" },
];

export const FEELINGS: { key: Feeling; label: string }[] = [
  { key: "energetic", label: "Energetic" },
  { key: "calm", label: "Calm" },
  { key: "anxious", label: "Anxious" },
  { key: "irritable", label: "Irritable" },
  { key: "emotional", label: "Emotional" },
  { key: "low", label: "Low" },
  { key: "confident", label: "Confident" },
  { key: "tired", label: "Tired" },
];

export const SYMPTOMS: { key: Symptom; label: string; icon: string }[] = [
  { key: "cramps", label: "Cramps", icon: "Zap" },
  { key: "headache", label: "Headache", icon: "Brain" },
  { key: "bloating", label: "Bloating", icon: "CircleDot" },
  { key: "back-pain", label: "Back pain", icon: "PersonStanding" },
  { key: "acne", label: "Acne", icon: "ScanFace" },
  { key: "mood-swings", label: "Mood swings", icon: "Smile" },
  { key: "fatigue", label: "Fatigue", icon: "BatteryLow" },
  { key: "breast-tenderness", label: "Breast tenderness", icon: "HeartHandshake" },
  { key: "food-cravings", label: "Food cravings", icon: "Cookie" },
  { key: "trouble-sleeping", label: "Trouble sleeping", icon: "Moon" },
  { key: "nausea", label: "Nausea", icon: "Frown" },
  { key: "none", label: "None", icon: "Heart" },
];

export const symptomLabel = (k: string) => SYMPTOMS.find((s) => s.key === k)?.label ?? k;

/* ── The phases, said simply ─────────────────────────────────────────────── */

export const PHASE_COPY: Record<Phase, { name: string; chip: string; title: string; body: string }> = {
  menstrual: {
    name: "Period",
    chip: "Menstrual Phase",
    title: "Menstrual Phase",
    body: "Your body is shedding last month's lining. Energy can dip — rest is part of the work, not a break from it.",
  },
  follicular: {
    name: "Follicular",
    chip: "Follicular Phase",
    title: "Follicular Phase",
    body: "Estrogen is rising and many women feel lighter and more energetic. A good time to start something new.",
  },
  ovulation: {
    name: "Ovulation",
    chip: "Ovulation",
    title: "Ovulation",
    body: "An egg is released around now. Some women feel a twinge on one side, or more confident and social.",
  },
  luteal: {
    name: "Luteal",
    chip: "Luteal Phase",
    title: "Luteal Phase",
    body: "Your body is preparing for the next cycle. You may feel mood changes. Be kind to yourself.",
  },
};

/* ── Today's care: the four things on the period screen ──────────────────── */

export type CareItem = { icon: string; tint: string; title: string; sub: string };

export const TODAY_CARE: Record<Phase, CareItem[]> = {
  menstrual: [
    { icon: "Droplet", tint: "--ux-tint-blue", title: "Drink warm water", sub: "Helps ease cramps" },
    { icon: "Leaf", tint: "--ux-tint-green", title: "Eat iron-rich foods", sub: "Like spinach, dates, lentils" },
    { icon: "BedDouble", tint: "--ux-tint-pink", title: "Get enough rest", sub: "Your body needs extra care" },
    { icon: "PersonStanding", tint: "--ux-tint-orange", title: "Try gentle movement", sub: "Like stretching or yoga" },
  ],
  follicular: [
    { icon: "Sprout", tint: "--ux-tint-green", title: "Eat fresh and colourful", sub: "Sprouts, fruit, greens" },
    { icon: "Footprints", tint: "--ux-tint-orange", title: "Move more", sub: "A brisk walk suits this week" },
    { icon: "Sparkles", tint: "--ux-tint-violet", title: "Plan something new", sub: "Energy is on your side" },
    { icon: "Droplet", tint: "--ux-tint-blue", title: "Keep drinking water", sub: "Eight glasses through the day" },
  ],
  ovulation: [
    { icon: "Droplet", tint: "--ux-tint-blue", title: "Stay hydrated", sub: "You may feel warmer than usual" },
    { icon: "Salad", tint: "--ux-tint-green", title: "Eat a full plate", sub: "Protein, greens and grains" },
    { icon: "Users", tint: "--ux-tint-violet", title: "Meet people", sub: "A good week to be social" },
    { icon: "Info", tint: "--ux-tint-pink", title: "Know your window", sub: "A guide, not contraception" },
  ],
  luteal: [
    { icon: "Cookie", tint: "--ux-tint-amber", title: "Plan for cravings", sub: "Nuts or a banana beat biscuits" },
    { icon: "CupSoda", tint: "--ux-tint-blue", title: "Cut back on salt", sub: "Eases bloating" },
    { icon: "Moon", tint: "--ux-tint-violet", title: "Protect your sleep", sub: "Same time every night" },
    { icon: "Heart", tint: "--ux-tint-pink", title: "Be gentle with yourself", sub: "Moods can run high this week" },
  ],
};

/* ── For you today: four tabs of suggestions ─────────────────────────────── */

export type Suggestion = { id: string; title: string; sub: string; img: string; art?: boolean };

const F = (name: string) => `/ux/cycle/food-${name}.webp`;
const A = (name: string) => `/ux/art/${name}.webp`;

const FOOD: Record<string, Suggestion> = {
  tea: { id: "tea", title: "Warm herbal tea", sub: "Soothes cramps", img: F("tea") },
  greens: { id: "greens", title: "Leafy greens", sub: "Rich in iron", img: F("greens") },
  nuts: { id: "nuts", title: "Nuts & seeds", sub: "Boosts mood", img: F("nuts") },
  chocolate: { id: "chocolate", title: "Dark chocolate", sub: "Improves mood", img: F("chocolate") },
  ginger: { id: "ginger", title: "Ginger tea", sub: "May ease cramps and nausea", img: F("ginger") },
  dal: { id: "dal", title: "Dal and rice", sub: "Protein and iron together", img: F("dal") },
  khichdi: { id: "khichdi", title: "Light khichdi", sub: "Easy on a bloated stomach", img: F("khichdi") },
  banana: { id: "banana", title: "Bananas", sub: "Steady energy, eases bloating", img: F("banana") },
  sprouts: { id: "sprouts", title: "Sprouts salad", sub: "Fresh energy and protein", img: F("sprouts") },
  bowl: { id: "bowl", title: "A colourful bowl", sub: "Chana, greens and lemon", img: F("bowl") },
};

const FOOD_BY_PHASE: Record<Phase, string[]> = {
  menstrual: ["tea", "greens", "nuts", "chocolate", "ginger", "dal"],
  follicular: ["sprouts", "bowl", "dal", "banana"],
  ovulation: ["bowl", "sprouts", "greens", "nuts"],
  luteal: ["banana", "nuts", "khichdi", "chocolate"],
};

/** Moods move certain foods to the front — never add a claim, only an order. */
const FOOD_FOR_MOOD: Partial<Record<Mood | Feeling, string[]>> = {
  sad: ["chocolate", "banana", "nuts"],
  low: ["chocolate", "banana", "nuts"],
  irritable: ["tea", "nuts", "banana"],
  anxious: ["tea", "nuts"],
  tired: ["dal", "greens", "banana"],
};

const WELLNESS: Suggestion[] = [
  { id: "heat", title: "A warm compress", sub: "Heat on the belly eases cramps", img: F("tea") },
  { id: "sleep", title: "Sleep 7 to 9 hours", sub: "Same time every night", img: A("scene-woman-meditating"), art: true },
  { id: "water", title: "Keep water close", sub: "Eight glasses through the day", img: F("ginger") },
  { id: "bath", title: "A warm bath", sub: "Loosens a tight back", img: A("scene-two-women-support"), art: true },
];

const MIND: Suggestion[] = [
  { id: "breathe", title: "Box breathing", sub: "In 4, hold 4, out 4, hold 4", img: A("scene-woman-meditating"), art: true },
  { id: "journal", title: "Write three lines", sub: "What you feel, and why", img: A("scene-woman-writing-notes"), art: true },
  { id: "talk", title: "Talk to someone", sub: "A friend, or a mentor here", img: A("scene-two-women-support"), art: true },
  { id: "no", title: "Say no to one thing", sub: "Protect your energy today", img: A("scene-women-celebrating"), art: true },
];

const ACTIVITY: Record<Phase, Suggestion[]> = {
  menstrual: [
    { id: "stretch", title: "Gentle stretching", sub: "Child's pose, cat-cow", img: A("scene-woman-meditating"), art: true },
    { id: "walk", title: "A slow 15-minute walk", sub: "Movement can ease cramps", img: A("scene-woman-walking-with-bag"), art: true },
  ],
  follicular: [
    { id: "brisk", title: "A brisk 30-minute walk", sub: "Your energy is rising", img: A("scene-woman-walking-with-bag"), art: true },
    { id: "yoga", title: "Morning yoga", sub: "Sun salutations, 10 minutes", img: A("scene-woman-meditating"), art: true },
  ],
  ovulation: [
    { id: "dance", title: "Dance, or play", sub: "Anything that gets you moving", img: A("scene-women-celebrating"), art: true },
    { id: "brisk", title: "A brisk walk", sub: "Thirty minutes, any pace", img: A("scene-woman-walking-with-bag"), art: true },
  ],
  luteal: [
    { id: "yoga", title: "Slow yoga", sub: "Stretches for a tight back", img: A("scene-woman-meditating"), art: true },
    { id: "walk", title: "An evening walk", sub: "Helps sleep and mood", img: A("scene-woman-walking-with-bag"), art: true },
  ],
};

export type ForYouTab = "food" | "wellness" | "mind" | "activity";

export function forYou(tab: ForYouTab, phase: Phase, mood?: Mood | null, feelings: Feeling[] = []): Suggestion[] {
  if (tab === "wellness") return WELLNESS;
  if (tab === "mind") return MIND;
  if (tab === "activity") return ACTIVITY[phase];
  const base = FOOD_BY_PHASE[phase];
  const first = [mood, ...feelings].flatMap((k) => (k ? FOOD_FOR_MOOD[k] ?? [] : []));
  const order = [...new Set([...first.filter((k) => base.includes(k) || FOOD[k]), ...base])];
  return order.slice(0, 4).map((k) => FOOD[k]);
}

/* ── The care plan: four cards on the desktop dashboard ──────────────────── */

export type PlanCard = {
  key: "nutrition" | "wellness" | "mind" | "self";
  label: string;
  icon: string;
  tint: string;
  img: string;
  art?: boolean;
  title: string;
  sub: string;
  cta: string;
  href: string;
};

export function carePlan(phase: Phase): PlanCard[] {
  const heavy = phase === "menstrual";
  return [
    {
      key: "nutrition", label: "Nutrition", icon: "Salad", tint: "--ux-tint-green", img: F(heavy ? "bowl" : "sprouts"),
      title: heavy ? "Eat iron-rich foods" : phase === "luteal" ? "Plan for cravings" : "Eat fresh and colourful",
      sub: heavy ? "like spinach, dates, lentils to boost your energy." : phase === "luteal"
        ? "nuts or a banana keep you steady." : "sprouts, fruit and greens.",
      cta: "View food suggestions", href: "/app/health/nutrition",
    },
    {
      key: "wellness", label: "Wellness", icon: "PersonStanding", tint: "--ux-tint-violet",
      img: A("scene-woman-meditating"), art: true,
      title: heavy ? "Try gentle movement" : "Keep moving",
      sub: heavy ? "like stretching or yoga to reduce cramps." : "a walk or yoga, whatever you enjoy.",
      cta: "View workouts", href: "/app/health/workouts",
    },
    {
      key: "mind", label: "Mental Wellness", icon: "Flower2", tint: "--ux-tint-pink",
      img: A("scene-woman-writing-notes"), art: true,
      title: "It's okay to feel emotional.",
      sub: "Try journaling or short breathing exercises.",
      cta: "View tips", href: "/app/health/mind",
    },
    {
      key: "self", label: "Self Care", icon: "Heart", tint: "--ux-tint-amber", img: F("tea"),
      title: "Get enough rest and",
      sub: "stay hydrated. You're doing great!",
      cta: "More self-care tips", href: "/app/health/cycle/today?tab=wellness",
    },
  ];
}

/* ── Quotes, chosen by how she feels ─────────────────────────────────────── */

const QUOTES: Record<Mood | "default", string[]> = {
  happy: ["Your energy is a gift — share it today.", "Joy looks good on you."],
  calm: ["Peace is a kind of strength.", "Slow is still moving forward."],
  tired: ["Rest is productive too.", "You don't have to earn a nap."],
  irritable: ["Your feelings are valid. Take a breath.", "You don't owe anyone a smile today."],
  sad: ["You are stronger than you think.", "This feeling is a visitor, not a home."],
  default: ["You are stronger than you think.", "It's not just a cycle, it's a sign of a strong, healthy you."],
};

/** Stable for the day, so the card does not change every time she opens it. */
export function quoteFor(mood: Mood | null | undefined, today: string): string {
  const list = QUOTES[mood ?? "default"] ?? QUOTES.default;
  const n = today.split("-").reduce((a, b) => a + Number(b), 0);
  return list[n % list.length];
}

/* ── Guides ──────────────────────────────────────────────────────────────── */

export type Guide = {
  slug: string;
  title: string;
  sub: string;
  img: string;
  art?: boolean;
  minutes: number;
  sections: { h: string; p?: string; list?: string[] }[];
  urgent?: string;
  sources: string[];
};

export const GUIDES: Guide[] = [
  {
    slug: "cramps",
    title: "Managing Cramps Naturally",
    sub: "Tips from our experts",
    img: A("scene-woman-meditating"), art: true,
    minutes: 3,
    sections: [
      { h: "Why periods hurt", p: "Your womb tightens to shed its lining. Chemicals called prostaglandins make those squeezes stronger — which is why the first one or two days are usually the worst." },
      { h: "What helps", list: [
        "Heat on your lower belly or back — a hot water bottle or a warm towel. This has good evidence behind it.",
        "Gentle movement: a slow walk, child's pose, or lying with your knees pulled up.",
        "Warm drinks. Ginger tea may help some women.",
        "Painkillers like ibuprofen or paracetamol. Ask a pharmacist which suits you, especially if you have asthma or stomach problems.",
      ] },
      { h: "See a doctor if", list: [
        "The pain stops you from working or going out.",
        "You have pain between periods, or during or after sex.",
        "The pain has become much worse than it used to be.",
      ] },
    ],
    sources: ["NHS — Period pain", "ACOG — Dysmenorrhea: Painful Periods"],
  },
  {
    slug: "nutrition",
    title: "Nutrition During Your Period",
    sub: "Foods that support your body",
    img: F("bowl"),
    minutes: 3,
    sections: [
      { h: "Replace the iron you lose", p: "Bleeding takes iron with it, and many women in India are already low. Iron-rich foods help you feel less tired." },
      { h: "Good sources", list: [
        "Palak, methi and other leafy greens",
        "Dal, rajma, chana and sprouts",
        "Eggs, fish and meat, if you eat them",
        "Dates and dried fruit",
      ] },
      { h: "Help it work", p: "Vitamin C helps your body take in iron. Squeeze lemon on your dal, or eat an amla or orange with the meal. Tea and coffee get in the way — have them an hour apart from food." },
      { h: "For bloating", p: "Less salt, more water. Bananas and curd are gentle on the stomach." },
    ],
    sources: ["WHO — Anaemia fact sheet", "NHS — Iron deficiency anaemia"],
  },
  {
    slug: "hormones",
    title: "Understanding Your Hormones",
    sub: "A simple guide for every woman",
    img: A("scene-woman-writing-notes"), art: true,
    minutes: 4,
    sections: [
      { h: "One cycle, four phases", list: [
        "Period (about days 1–5): hormones are at their lowest. Energy often dips.",
        "Follicular (after your period): estrogen rises. Many women feel lighter and more energetic.",
        "Ovulation (around day 14 of a 28-day cycle): an egg is released. You may feel more confident.",
        "Luteal (the last two weeks): progesterone rises, then both hormones fall. This is when PMS moods and cravings can come.",
      ] },
      { h: "Your cycle is yours", p: "Anything from 21 to 35 days is typical for adults, and it can change after a baby, with stress, or as you get closer to menopause. Tracking helps you learn your own pattern." },
      { h: "Talk to a doctor if", list: [
        "Your cycles are often shorter than 21 days or longer than 35.",
        "Your periods stop for three months or more, and you are not pregnant.",
        "Your cycle suddenly becomes very irregular.",
      ] },
    ],
    sources: ["ACOG — Abnormal Uterine Bleeding", "NHS — Periods"],
  },
  {
    slug: "long-periods",
    title: "When your period lasts longer",
    sub: "Learn about possible reasons",
    img: A("scene-two-women-support"), art: true,
    minutes: 3,
    sections: [
      { h: "What is usual", p: "Most periods last between 2 and 7 days. A period that goes on longer than 7 days is worth checking with a doctor — it is usually treatable, and it is not something to just put up with." },
      { h: "Common reasons", list: [
        "Hormone changes — after a baby, near menopause, or with stress",
        "PCOS or thyroid problems",
        "Fibroids or polyps in the womb",
        "Some contraceptives, like the copper IUD",
      ] },
      { h: "Signs it is heavy", list: [
        "You need to change a pad every hour or two",
        "Clots bigger than a two-rupee coin",
        "You feel very tired, dizzy or breathless",
      ] },
      { h: "Where to go", p: "A government health centre can check you and test your iron for free. Bring the dates from your tracker — they help the doctor more than you might think." },
    ],
    urgent: "Go to a hospital now if you are soaking a pad every hour for several hours, or you feel faint.",
    sources: ["NHS — Heavy periods", "ACOG — Heavy Menstrual Bleeding", "NICE NG88"],
  },
  {
    slug: "pcos",
    title: "PCOS and PCOD, simply explained",
    sub: "What they are, and what to do",
    img: A("scene-woman-writing-notes"), art: true,
    minutes: 4,
    sections: [
      { h: "What it is", p: "PCOS (polycystic ovary syndrome) is a common hormone condition. In India it is often called PCOD, and the two names are usually used for the same thing." },
      { h: "Common signs", list: [
        "Irregular or missed periods",
        "Acne, or extra hair on the face or body",
        "Weight gain that is hard to shift",
        "Difficulty getting pregnant",
      ] },
      { h: "How it is found", p: "A doctor looks at your periods and symptoms, and may order a blood test and an ultrasound. You need two of three signs — you do not need cysts on a scan to have it." },
      { h: "What helps", p: "There is no cure, but it can be managed well: regular movement, balanced meals, and medicines a doctor can prescribe for periods, skin and fertility. It is not your fault." },
    ],
    sources: ["NHS — Polycystic ovary syndrome", "WHO — Polycystic ovary syndrome fact sheet"],
  },
];

export const guide = (slug: string) => GUIDES.find((g) => g.slug === slug);

/* ── Who to ask ──────────────────────────────────────────────────────────── */

export const MENTOR_TABS = [
  { key: "all", label: "All", tags: [] as string[] },
  { key: "womens", label: "Women's Health", tags: ["Women's Health", "Gynecology", "PCOS", "Period care"] },
  { key: "nutrition", label: "Nutrition", tags: ["Nutrition"] },
  { key: "mind", label: "Mental Wellness", tags: ["Mental Wellness"] },
] as const;

export const HEALTH_TAGS = ["Women's Health", "Gynecology", "PCOS", "Period care", "Nutrition", "Mental Wellness"];
