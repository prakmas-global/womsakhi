/**
 * Work & Opportunities — mock data.
 *
 * Shaped to match what `/opportunities`, `/opportunities/{id}` and
 * `/applications` already return from `lib/growth-api`, so connecting this up
 * later is a change of source rather than a rewrite of every component. The
 * money is stored as numbers, not strings, because the filters have to compare
 * it and a "₹6 – 9 LPA" label cannot be sorted.
 */

const A = (n: string) => `/ux/art/${n}.webp`;

export type WorkKind = "Job" | "Freelance" | "Order" | "Internship";
export type WorkMode = "Remote" | "Hybrid" | "On-site";

export type Job = {
  id: string;
  title: string;
  org: string;
  logoTint: string;
  logoInk: string;
  icon: string;
  place: string;
  mode: WorkMode;
  kind: WorkKind;
  payLow: number;      // rupees per month, so everything is comparable
  payHigh: number;
  /**
   * The pay exactly as the listing words it — "₹55 per tiffin", "₹9,000 a
   * month". Preferred over the parsed range whenever it exists, because the
   * parse cannot tell a monthly salary from a per-piece rate and the label
   * would then attach "/ month" to a number that is nothing of the kind.
   */
  payText?: string;
  posted: string;
  postedDays: number;
  skills: string[];
  verified: boolean;
  womenLed: boolean;
  applicants: number;
  match: number;       // 0..100, how well it fits her profile
  about: string;
  responsibilities: string[];
  needs: string[];
  saved?: boolean;
  /** Whether she has already applied. From the server, not local state. */
  applied?: boolean;
};

export const JOBS: Job[] = [
  {
    id: "w1", title: "Digital Marketing Specialist", org: "TechNova Solutions",
    logoTint: "--ux-tint-pink", logoInk: "--ux-pink", icon: "Briefcase",
    place: "Remote", mode: "Remote", kind: "Job", payLow: 25000, payHigh: 35000,
    posted: "2 hours ago", postedDays: 0, verified: true, womenLed: true, applicants: 34, match: 92,
    skills: ["Social media", "Content", "Analytics"],
    about: "Run the social presence for a small products company. You will plan posts, write captions in Hindi and English, and report what worked each week.",
    responsibilities: ["Plan and schedule two posts a week", "Write captions in Hindi and English", "Report reach and sales once a month"],
    needs: ["Comfortable with a phone camera", "Basic English writing", "Six months of any social media work"],
  },
  {
    id: "w2", title: "Content Creator (Freelance)", org: "BrandStory",
    logoTint: "--ux-tint-green", logoInk: "--ux-green", icon: "PenLine",
    place: "Work from anywhere", mode: "Remote", kind: "Freelance", payLow: 25000, payHigh: 40000,
    posted: "5 hours ago", postedDays: 0, verified: true, womenLed: false, applicants: 61, match: 84,
    skills: ["Writing", "Reels", "Canva"],
    about: "Short video and caption work, paid per piece. Steady if the first month goes well.",
    responsibilities: ["Four reels a month", "Two long captions a week"],
    needs: ["A phone that shoots 1080p", "Any editing app"],
  },
  {
    id: "w3", title: "Tailoring orders — festive season", org: "Rangoli Boutique",
    logoTint: "--ux-tint-orange", logoInk: "--ux-orange", icon: "Scissors",
    place: "Jaipur (pickup nearby)", mode: "On-site", kind: "Order", payLow: 18000, payHigh: 30000,
    posted: "1 day ago", postedDays: 1, verified: true, womenLed: true, applicants: 12, match: 71,
    skills: ["Stitching", "Finishing"],
    about: "Bulk blouse and kurta stitching through the festive months. Material is supplied; payment is per piece, weekly.",
    responsibilities: ["30 to 50 pieces a month", "Collect and drop material weekly"],
    needs: ["Your own machine", "Two years of stitching"],
  },
  {
    id: "w4", title: "Social Media Manager", org: "HerConnect",
    logoTint: "--ux-tint-blue", logoInk: "--ux-blue", icon: "Monitor",
    place: "Bangalore", mode: "Hybrid", kind: "Job", payLow: 33000, payHigh: 50000,
    posted: "1 day ago", postedDays: 1, verified: true, womenLed: true, applicants: 88, match: 66,
    skills: ["Strategy", "Community", "Ads"],
    about: "Own the community for a women-led fintech. Two days a week in the office.",
    responsibilities: ["Grow the community", "Run a small ads budget"],
    needs: ["Two years in social", "Comfortable on video calls"],
  },
  {
    id: "w5", title: "Home baker — weekend orders", org: "Sweet Street Collective",
    logoTint: "--ux-tint-violet", logoInk: "--ux-violet", icon: "CakeSlice",
    place: "Jaipur", mode: "On-site", kind: "Order", payLow: 8000, payHigh: 15000,
    posted: "2 days ago", postedDays: 2, verified: false, womenLed: true, applicants: 9, match: 58,
    skills: ["Baking", "Packing"],
    about: "Weekend cake and cookie orders passed on from a shared storefront.",
    responsibilities: ["Bake to order on Saturdays", "Pack and hand over by Sunday noon"],
    needs: ["A working oven", "Food handling basics"],
  },
  {
    id: "w6", title: "Customer Support (Voice, Hindi)", org: "CareBridge",
    logoTint: "--ux-tint-blue", logoInk: "--ux-blue", icon: "Headphones",
    place: "Remote", mode: "Remote", kind: "Job", payLow: 20000, payHigh: 26000,
    posted: "3 days ago", postedDays: 3, verified: true, womenLed: false, applicants: 140, match: 74,
    skills: ["Hindi", "Patience", "Computer basics"],
    about: "Answer calls from customers of a home-services app. Training is paid.",
    responsibilities: ["Six-hour shifts, five days", "Log every call"],
    needs: ["Clear Hindi", "A quiet room and stable internet"],
  },
  {
    id: "w7", title: "Data Entry Assistant", org: "Lekha Services",
    logoTint: "--ux-tint-green", logoInk: "--ux-green", icon: "Table",
    place: "Remote", mode: "Remote", kind: "Internship", payLow: 9000, payHigh: 12000,
    posted: "4 days ago", postedDays: 4, verified: true, womenLed: false, applicants: 210, match: 49,
    skills: ["Typing", "Excel"],
    about: "Three months, part-time, with a certificate at the end.",
    responsibilities: ["Four hours a day", "Basic spreadsheet clean-up"],
    needs: ["30 words a minute", "A laptop"],
  },
  {
    id: "w8", title: "Beauty services at home", org: "Glow On Call",
    logoTint: "--ux-tint-pink", logoInk: "--ux-pink", icon: "Sparkles",
    place: "Jaipur", mode: "On-site", kind: "Freelance", payLow: 15000, payHigh: 28000,
    posted: "5 days ago", postedDays: 5, verified: true, womenLed: true, applicants: 23, match: 62,
    skills: ["Threading", "Facial", "Mehendi"],
    about: "Take bookings in your area and keep 80% of every job.",
    responsibilities: ["Accept jobs within 5km", "Carry your own kit"],
    needs: ["Any beauty certificate", "A two-wheeler helps"],
  },
];

export const APPLICATIONS = [
  { id: "a1", jobId: "w1", title: "Digital Marketing Specialist", org: "TechNova Solutions",
    stage: "Interview", when: "Interview on 26 May, 11:00 AM", at: "2 days ago", tone: "--ux-tint-violet", ink: "--ux-violet", step: 3 },
  { id: "a2", jobId: "w4", title: "Social Media Manager", org: "HerConnect",
    stage: "Shortlisted", when: "They opened your profile twice", at: "4 days ago", tone: "--ux-tint-blue", ink: "--ux-blue", step: 2 },
  { id: "a3", jobId: "w6", title: "Customer Support (Voice, Hindi)", org: "CareBridge",
    stage: "Applied", when: "Waiting to be reviewed", at: "1 week ago", tone: "--ux-tint-green", ink: "--ux-green", step: 1 },
  { id: "a4", jobId: "w7", title: "Data Entry Assistant", org: "Lekha Services",
    stage: "Not selected", when: "They went with someone else", at: "2 weeks ago", tone: "--ux-surface-2", ink: "--ux-muted", step: 0 },
];

export const STAGES = ["Applied", "Shortlisted", "Interview", "Offer"] as const;

export const WORK_ART = {
  empty: A("empty-magnifying-glass-blank-page"),
  hero: A("scene-woman-with-trolley-bag"),
  applied: A("scene-woman-vendor-handing-parcel"),
  interview: A("scene-women-business-handshake"),
};

export const MODES: WorkMode[] = ["Remote", "Hybrid", "On-site"];
export const KINDS: WorkKind[] = ["Job", "Freelance", "Order", "Internship"];

/** ₹25,000 rather than ₹25000 — the separator is what makes it readable. */
/**
 * WHOLE rupees, not paise — pay is stored as `25000` meaning ₹25,000.
 * See `kit/money.formatWholeRupees` for why this is a separate name.
 */
export { formatWholeRupees as money } from "../kit/money";

import { formatWholeRupees } from "../kit/money";
export const payLabel = (j: Job) => {
  // The listing's own words win. A real one read "₹55 per tiffin, 20 a day",
  // which the parser turned into the range 55–20 and the label then printed as
  // "₹55 – ₹20 / month" — backwards, and monthly when it is per piece.
  if (j.payText?.trim()) return j.payText.trim();
  const low = Math.min(j.payLow, j.payHigh), high = Math.max(j.payLow, j.payHigh);
  if (!high) return "Pay not stated";
  if (low === high) return `${formatWholeRupees(high)} / month`;
  return `${formatWholeRupees(low)} – ${formatWholeRupees(high)} / month`;
};
