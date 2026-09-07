/**
 * The parts of a profile that were a "coming soon" card.
 *
 * ── What a profile is FOR here ──────────────────────────────────────────────
 * Not a CV. Most women using this have never had one and do not need one — what
 * they need is something to put in front of a buyer, a landlord or a woman
 * deciding whether to hand over a 200-piece order. So the sections are ordered
 * by what a stranger actually asks: what can you do, what have you finished,
 * who says so.
 *
 * ── Why "contribution" is a section and not a follower count ────────────────
 * The research is explicit that follower counts measure the wrong thing for
 * this product: "mentored 12 women" and "helped 4 women find work" are the
 * numbers that mean something in a trust network, and they are the ones a woman
 * is proud of. A follower count would also invite the comparison dynamic this
 * product is built to avoid.
 */

export interface Skill {
  id: string;
  name: string;
  years: number;
  /** Evidence, not self-assessment — what she actually did with it. */
  proof: string;
  icon: string;
  tint: string;
  ink: string;
}

export const SKILLS: Skill[] = [
  { id: "sk1", name: "Blouse stitching", years: 11, proof: "87 finished, 11 buyers came back",
    icon: "Scissors", tint: "--ux-tint-pink", ink: "--ux-pink-ink" },
  { id: "sk2", name: "School uniforms", years: 6, proof: "120-shirt order for Sunrise Hostel",
    icon: "Shirt", tint: "--ux-tint-blue", ink: "--ux-blue-ink" },
  { id: "sk3", name: "Mehendi", years: 8, proof: "14 weddings this season",
    icon: "Flower2", tint: "--ux-tint-orange", ink: "--ux-orange-ink" },
  { id: "sk4", name: "Reading a fabric bill", years: 3, proof: "Learned on WomSakhi, used every week",
    icon: "Receipt", tint: "--ux-tint-green", ink: "--ux-green-ink" },
];

export interface Work {
  id: string;
  what: string;
  where: string;
  when: string;
  /** Left open where it still is. Nobody should have to invent an end date. */
  until: string | null;
  detail: string;
}

export const WORK: Work[] = [
  { id: "w1", what: "Tailoring, on my own", where: "Malviya Nagar, Jaipur", when: "Jan 2025", until: null,
    detail: "Blouses, kurtis and school uniforms. My own machine since August." },
  { id: "w2", what: "Stitching for a boutique", where: "Anand Cloth House", when: "2021", until: "2024",
    detail: "Piece work, about 40 pieces a month." },
  { id: "w3", what: "Not working", where: "", when: "2019", until: "2021",
    detail: "My mother was unwell and I looked after her." },
];

export interface Learning {
  id: string;
  what: string;
  where: string;
  when: string;
  /** Some of these are certificates, some are simply true. Both count. */
  certificate: boolean;
}

export const LEARNING: Learning[] = [
  { id: "l1", what: "Pricing your work", where: "WomSakhi", when: "Sept 2026", certificate: true },
  { id: "l2", what: "Digital Marketing Mastery", where: "WomSakhi", when: "In progress", certificate: false },
  { id: "l3", what: "Cutting and tailoring", where: "Govt. ITI, Jaipur", when: "2014", certificate: true },
  { id: "l4", what: "Class 10", where: "Rajasthan Board", when: "2011", certificate: true },
];

export interface Piece {
  id: string;
  title: string;
  detail: string;
  /** What it sold for, in paise. Null where it was not for sale. */
  minor: number | null;
  icon: string;
  tint: string;
  ink: string;
}

export const PORTFOLIO: Piece[] = [
  { id: "p1", title: "Bridal blouse, full work", detail: "Three fittings, finished in nine days", minor: 180000,
    icon: "Sparkles", tint: "--ux-tint-amber", ink: "--ux-amber-ink" },
  { id: "p2", title: "60 cushion covers", detail: "Bulk order for Rangoli Exports", minor: 252000,
    icon: "Package", tint: "--ux-tint-green", ink: "--ux-green-ink" },
  { id: "p3", title: "School uniform set", detail: "Shirt and pinafore, sizes 4 to 14", minor: 55000,
    icon: "Shirt", tint: "--ux-tint-blue", ink: "--ux-blue-ink" },
];

/**
 * What she has done for other women.
 *
 * Counted, never ranked, and never turned into a leaderboard — the moment this
 * becomes a score, helping becomes a way of climbing rather than a thing you do.
 */
export const CONTRIBUTION = [
  { id: "c1", label: "Women you taught", value: 4, detail: "Stitching, at the community hall", icon: "GraduationCap",
    tint: "--ux-tint-violet", ink: "--ux-violet" },
  { id: "c2", label: "Women you vouched for", value: 8, detail: "In your circle, by name", icon: "UserRoundCheck",
    tint: "--ux-tint-pink", ink: "--ux-pink-ink" },
  { id: "c3", label: "Orders you passed on", value: 3, detail: "Too big for you, right for someone else", icon: "Handshake",
    tint: "--ux-tint-green", ink: "--ux-green-ink" },
  { id: "c4", label: "Families you spoke to", value: 2, detail: "So another woman could start", icon: "MessageCircle",
    tint: "--ux-tint-blue", ink: "--ux-blue-ink" },
];
