/**
 * Health, as the reason she cannot work — Batch 6.
 *
 * ── What this module deliberately is NOT ────────────────────────────────────
 * It is not a cycle tracker, and that is the single clearest "do not build" in
 * the whole research. Five reasons: the category is saturated and free (Flo
 * 100M+ installs, Clue 50M+, Maya 10M+); the retention story is weaker than
 * assumed, with engagement monthly and the top 14% of users generating as much
 * as the bottom 86% combined; Flo has roughly **1.5M monthly users in all of
 * India**, so the prize is small and already taken; India's DPDP Act **flatly
 * prohibits behavioural monitoring of under-18s**, uncurable by parental
 * consent, at a ₹200 crore penalty tier — and menarche is around twelve; and
 * period data is the most enforcement-exposed category in consumer software.
 *
 * ── What it is instead ──────────────────────────────────────────────────────
 * The health problems that measurably cost her income, addressed as income
 * problems. In order of evidence:
 *
 *   **Tiredness.** The cleanest number found anywhere: among Darjeeling tea
 *   pluckers, anaemia predicted **9.1% less tea picked and 4.0% lower wages per
 *   shift**, controlling for physical effort. For piece-rate work, feeling weak
 *   *is* lost income with no absence involved. Prevalence in Indian women is
 *   somewhere between 41% (venous blood) and 57% (NFHS capillary) — contested,
 *   mostly mild, and iron deficiency explains under a third of it, so this
 *   screen points at a free test rather than asserting a diagnosis.
 *
 *   **Cover.** ~90% of employed Indian women are informal; among the salaried
 *   minority, 45.9% are not eligible for paid leave. A sick day is an unpaid day
 *   with nobody minding the stall. The fix needs no health data at all — she
 *   says "I cannot work Thursday", never why.
 *
 *   **The change.** Indian women reach menopause at about 46.6 years, roughly
 *   six years earlier than American women, landing squarely on peak earning
 *   years — with 80% never treated and 0.8% on hormones. A study of employed
 *   women in Mysuru found 73.2% with moderate-to-severe symptoms and 40.4% with
 *   poor work ability, concentrated in unskilled work. There is no Indian
 *   product and almost no Indian measurement.
 *
 * Storage note: nothing here records a cycle, a symptom diary, a mood or sexual
 * activity. The heaviest thing stored is "I took the tablet" — a boolean.
 */

/* ── free checks ─────────────────────────────────────────────────────────── */

export type Check = {
  id: string;
  what: string;
  why: string;
  costs: string;
  takes: string;
  where: string;
  /** Whether a woman staffs it — the most common reason she does not go. */
  womanThere: boolean;
  lastOn?: string;
  dueIn?: number;
  icon: string;
};

export const CHECKS: Check[] = [
  { id: "ch1", what: "Blood test for strength", why: "Tells you if tiredness has a cause you can fix", costs: "Free", takes: "10 minutes", where: "Anganwadi, Tuesdays", womanThere: true, lastOn: "8 months ago", dueIn: 0, icon: "Droplet" },
  { id: "ch2", what: "Blood pressure", why: "No symptoms until it matters. Free at any centre", costs: "Free", takes: "5 minutes", where: "Any health centre", womanThere: true, lastOn: "3 months ago", dueIn: 90, icon: "HeartPulse" },
  { id: "ch3", what: "Cervical screening", why: "Only about 1 woman in 100 in India has ever had one", costs: "Free", takes: "20 minutes", where: "CHC, Thursdays", womanThere: true, dueIn: 14, icon: "Stethoscope" },
  { id: "ch4", what: "Breast check", why: "Learn to do it yourself, in two minutes a month", costs: "Free", takes: "15 minutes", where: "CHC, Thursdays", womanThere: true, dueIn: 14, icon: "Ribbon" },
  { id: "ch5", what: "Eyes", why: "Close work in poor light. Most tailors need glasses years before they get them", costs: "Free at camps", takes: "20 minutes", where: "Camp on the 22nd", womanThere: false, dueIn: 22, icon: "Eye" },
];

/* ── strength (iron) ─────────────────────────────────────────────────────── */

export type Week = { week: string; took: number; of: number };

export const IRON_WEEKS: Week[] = [
  { week: "6 weeks ago", took: 1, of: 1 },
  { week: "5 weeks ago", took: 1, of: 1 },
  { week: "4 weeks ago", took: 0, of: 1 },
  { week: "3 weeks ago", took: 1, of: 1 },
  { week: "2 weeks ago", took: 1, of: 1 },
  { week: "Last week", took: 1, of: 1 },
];

export const TIRED_SIGNS = [
  "Out of breath climbing the stairs",
  "Dizzy when you stand up quickly",
  "Cannot finish what you used to finish in a day",
  "Cold hands and feet",
  "Heavier bleeding than most women you know",
];

/* ── cover when she cannot work ──────────────────────────────────────────── */

export type CoverDay = {
  id: string;
  when: string;
  /** She never has to say why. */
  who?: string;
  what: string;
  state: "asked" | "covered" | "past";
};

export const COVER: CoverDay[] = [
  { id: "cv1", when: "Thursday", who: "Sunita Devi", what: "Tiffin round, 14 boxes", state: "covered" },
  { id: "cv2", when: "Friday", what: "Shop open 10–2", state: "asked" },
  { id: "cv3", when: "Last Tuesday", who: "Kavita Rao", what: "Two blouse fittings", state: "past" },
];

export type Coverer = {
  id: string;
  name: string;
  can: string;
  coveredCount: number;
  owedHours: number;
};

export const COVERERS: Coverer[] = [
  { id: "cr1", name: "Sunita Devi", can: "Tiffin, and can run the machine", coveredCount: 4, owedHours: 2 },
  { id: "cr2", name: "Kavita Rao", can: "Fittings and taking orders", coveredCount: 2, owedHours: 0 },
  { id: "cr3", name: "Radha Devi", can: "Can mind the shop, not stitch", coveredCount: 1, owedHours: 3 },
];

/* ── the change ──────────────────────────────────────────────────────────── */

export type ChangeTopic = {
  id: string;
  q: string;
  a: string;
  icon: string;
};

export const CHANGE_TOPICS: ChangeTopic[] = [
  { id: "cg1", q: "Is 46 too early?", a: "No. In India the usual age is about 46 or 47 — around six years earlier than in Western countries, which is why most advice you read online will not match what is happening to you.", icon: "CalendarDays" },
  { id: "cg2", q: "Why can I not sleep?", a: "Night sweats and broken sleep are the most common complaint, and the one that most affects work the next day. It passes, but it can take years, and there are things that help.", icon: "Moon" },
  { id: "cg3", q: "Why do I ache everywhere?", a: "Joint and muscle pain is very common and rarely explained to women. For anyone doing physical work it is often the symptom that costs the most days.", icon: "Activity" },
  { id: "cg4", q: "Is there anything that helps?", a: "Yes — and almost nobody in India gets it. Fewer than 1 woman in 100 takes anything for this. A doctor can talk you through what is available, and much of it is cheap.", icon: "Pill" },
  { id: "cg5", q: "Am I imagining it?", a: "No. In a study of employed Indian women aged 45 to 65, nearly three in four had moderate or severe symptoms, and four in ten said their ability to work had dropped.", icon: "Users" },
];

/* ── derived ─────────────────────────────────────────────────────────────── */

export const dueNow = (rows: Check[]) => rows.filter((c) => (c.dueIn ?? 99) <= 14).length;
export const freeCount = (rows: Check[]) => rows.filter((c) => c.costs.toLowerCase().startsWith("free")).length;
export const ironStreak = (rows: Week[]) => {
  let n = 0;
  for (let i = rows.length - 1; i >= 0; i--) { if (rows[i].took >= rows[i].of) n++; else break; }
  return n;
};
