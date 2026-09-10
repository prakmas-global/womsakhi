/**
 * The circle as a growth engine — Batch 4.
 *
 * ── Assisted mode: one install becomes six users ────────────────────────────
 * 810 million women in low- and middle-income countries still do not use mobile
 * internet; the smartphone ownership gap has been flat for years; and the mobile
 * money gender gap is **widening** — 30% in 2021 to 36% in 2024. No onboarding
 * flow closes that. What does is the finding the ICTD literature keeps
 * repeating: adoption in these communities happens through a trusted human
 * intermediary.
 *
 * So the intermediary is a first-class role in the product, with her own login,
 * an explicit consent record from each woman she helps, an audit trail, and a
 * way to be paid. Not a workaround — the growth mechanism.
 *
 * ── Learn from her, in pairs ────────────────────────────────────────────────
 * Classroom business training has an unimpressive record: a meta-analysis of 28
 * randomised trials found sales up 5.6%, no job creation, and practices
 * reverting within months. But one design worked — women trained **alongside a
 * friend** showed real gains in business activity and income, with the strongest
 * effects among women whose movement is restricted. The growth mechanic and the
 * efficacy mechanic are the same mechanic, which is rare and worth exploiting.
 *
 * ── Seeding for circulation ─────────────────────────────────────────────────
 * Network analysis of 40,000 users of Kenya's Sarafu currency found circulation
 * **requires closed cycles**, is highly localised, and depends on early adopters
 * and community institutions as hubs. So circles are seeded for complementary
 * trades — a tailor, a food seller, a hair-braider, a tuition teacher — so a
 * cycle physically closes, rather than by geography alone.
 *
 * Mock data.
 */

/* ── assisted mode ───────────────────────────────────────────────────────── */

export type Helped = {
  id: string;
  name: string;
  since: string;
  /** What she actually cannot do herself, in her own words. */
  because: string;
  /** She agreed, explicitly, and it is recorded. */
  consentOn: string;
  doneCount: number;
  earnedMinor: number;
  lastDid: string;
  /** Her own phone, or shares one. */
  ownsPhone: boolean;
};

export const HELPED: Helped[] = [
  { id: "h1", name: "Lakshmi Bai", since: "March", because: "Cannot read the screen", consentOn: "12 March", doneCount: 34, earnedMinor: 68000, lastDid: "Finished her e-KYC", ownsPhone: false },
  { id: "h2", name: "Sarita", since: "May", because: "Her son has the phone most days", consentOn: "4 May", doneCount: 21, earnedMinor: 42000, lastDid: "Listed 6 pickle jars", ownsPhone: false },
  { id: "h3", name: "Radha Devi", since: "June", because: "New to a smartphone", consentOn: "19 June", doneCount: 12, earnedMinor: 24000, lastDid: "Took her first order", ownsPhone: true },
  { id: "h4", name: "Gita", since: "August", because: "Cannot read the screen", consentOn: "2 August", doneCount: 5, earnedMinor: 10000, lastDid: "Opened her pot", ownsPhone: false },
];

export type AssistTask = {
  id: string;
  who: string;
  what: string;
  paysMinor: number;
  urgent: boolean;
};

export const ASSIST_QUEUE: AssistTask[] = [
  { id: "a1", who: "Lakshmi Bai", what: "Her ration re-verification closes in 6 days", paysMinor: 2000, urgent: true },
  { id: "a2", who: "Sarita", what: "Two orders waiting to be marked delivered", paysMinor: 2000, urgent: false },
  { id: "a3", who: "Gita", what: "Wants to add three more items to her shop", paysMinor: 2000, urgent: false },
];

/* ── learn, in pairs ─────────────────────────────────────────────────────── */

export type Lesson = {
  id: string;
  what: string;
  from: string;
  /** Teaching pays — in circle standing, or in care-circle hours. */
  paysIn: string;
  learners: number;
  /** Learning alone is offered and marked honestly as the weaker option. */
  pairedOnly: boolean;
  icon: string;
  tint: string;
  ink: string;
};

export const LESSONS: Lesson[] = [
  { id: "l1", what: "Cutting a blouse without a paper pattern", from: "Sunita Devi", paysIn: "2 care hours", learners: 4, pairedOnly: true, icon: "Scissors", tint: "--ux-tint-pink", ink: "--ux-pink-ink" },
  { id: "l2", what: "Photographing what you sell, on a cheap phone", from: "Kavita Rao", paysIn: "2 care hours", learners: 6, pairedOnly: true, icon: "Camera", tint: "--ux-tint-blue", ink: "--ux-blue-ink" },
  { id: "l3", what: "Talking to a shop about a bulk order", from: "Meera Joshi", paysIn: "3 care hours", learners: 3, pairedOnly: true, icon: "Handshake", tint: "--ux-tint-green", ink: "--ux-green-ink" },
  { id: "l4", what: "Bridal mehendi — the four base designs", from: "Ananya Sharma", paysIn: "4 care hours", learners: 5, pairedOnly: true, icon: "Sparkles", tint: "--ux-tint-orange", ink: "--ux-orange-ink" },
];

/* ── who should be in your circle ────────────────────────────────────────── */

export type Seed = {
  id: string;
  name: string;
  trade: string;
  /** Why she completes a cycle — the actual reason to invite her. */
  closes: string;
  km: number;
  icon: string;
};

export const SEEDS: Seed[] = [
  { id: "sd1", name: "Rekha", trade: "Sells vegetables", closes: "You buy from her every week. She has no one who stitches.", km: 0.4, icon: "Carrot" },
  { id: "sd2", name: "Nasreen", trade: "Runs tuition for class 5–8", closes: "Her students need uniforms. Your daughter needs tuition.", km: 0.9, icon: "BookOpen" },
  { id: "sd3", name: "Anita", trade: "Hair and threading", closes: "Brides come to her first, then need a blouse.", km: 1.2, icon: "Scissors" },
  { id: "sd4", name: "Farida", trade: "Makes pickles and papad", closes: "Sells at the same market you deliver to.", km: 1.6, icon: "UtensilsCrossed" },
];

/* ── circle survives the move ────────────────────────────────────────────── */

export type Carry = {
  id: string;
  label: string;
  detail: string;
  icon: string;
  /** Whether it travels automatically or needs her to ask. */
  automatic: boolean;
};

export const CARRIES: Carry[] = [
  { id: "c1", label: "What you have earned", detail: "Six months of takings, as a statement anyone can check", icon: "FileText", automatic: true },
  { id: "c2", label: "Your pot record", detail: "Every round you paid into, and that you never missed one", icon: "Coins", automatic: true },
  { id: "c3", label: "Your buyers", detail: "Their numbers stay in your phone — they were always yours", icon: "Users", automatic: true },
  { id: "c4", label: "Your papers", detail: "Aadhaar, bank, ration — and what needs redoing in a new state", icon: "FolderCheck", automatic: true },
  { id: "c5", label: "An introduction", detail: "To a circle where you are going, from the one you are leaving", icon: "Handshake", automatic: false },
];

export const MOVE_REASONS = [
  { id: "m1", label: "Marriage", note: "Most common, and the hardest — a new house and no one you know", icon: "Heart" },
  { id: "m2", label: "Work", note: "Yours, or your husband's", icon: "Briefcase" },
  { id: "m3", label: "Back to my parents", note: "For a birth, or because something ended", icon: "Home" },
  { id: "m4", label: "Somewhere safer", note: "We will not ask why, and nothing will say where", icon: "Shield" },
];

/* ── derived ─────────────────────────────────────────────────────────────── */

export const assistEarned = (rows: Helped[]) => rows.reduce((n, h) => n + h.earnedMinor, 0);
export const assistReach = (rows: Helped[]) => rows.length;
export const noPhone = (rows: Helped[]) => rows.filter((h) => !h.ownsPhone).length;
