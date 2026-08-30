/**
 * Mentors — women who have done it and will sit with you.
 *
 * Shaped to `Mentor` in `lib/growth-api`: id, name, headline, expertise,
 * languages, experience_years, rating, sessions_done, requested.
 *
 * `languages` matters more here than anywhere else in the app. A mentor who
 * cannot talk to her in a language she is comfortable in is not a mentor, so it
 * is a first-class filter rather than a detail buried in a profile.
 */

const A = (n: string) => `/ux/art/${n}.webp`;

export type Mentor = {
  id: string;
  name: string;
  headline: string;
  bio: string;
  photo: string;
  expertise: string[];
  languages: string[];
  experience_years: number;
  location: string;
  availability: string;
  rating: number;
  rating_count: number;
  sessions_done: number;
  requested: boolean;
  free_first: boolean;
  fee_minor: number;
  tint: string;
  ink: string;
};

export const MENTORS: Mentor[] = [
  {
    id: "m1", name: "Neha Verma", headline: "Digital marketing for small businesses",
    bio: "I ran a saree label out of my living room for six years before it had a shop. I can show you what actually brings customers, and what only looks like it does.",
    photo: A("avatar-woman-blazer"), expertise: ["Digital marketing", "Social media", "Branding"],
    languages: ["Hindi", "English"], experience_years: 8, location: "Jaipur",
    availability: "Evenings, Mon–Thu", rating: 4.9, rating_count: 230, sessions_done: 230,
    requested: false, free_first: true, fee_minor: 50000, tint: "--ux-tint-orange", ink: "--ux-orange",
  },
  {
    id: "m2", name: "Kavita Shah", headline: "Money, savings and small business books",
    bio: "Twelve years in a co-operative bank. I help women read their own numbers without feeling stupid about it.",
    photo: A("avatar-woman-pink-glasses"), expertise: ["Bookkeeping", "Savings", "Loans"],
    languages: ["Gujarati", "Hindi", "English"], experience_years: 12, location: "Ahmedabad",
    availability: "Weekend mornings", rating: 4.8, rating_count: 184, sessions_done: 184,
    requested: true, free_first: true, fee_minor: 40000, tint: "--ux-tint-green", ink: "--ux-green",
  },
  {
    id: "m3", name: "Razia Sultana", headline: "Starting a business from nothing",
    bio: "I started with ₹2,000 and a borrowed machine. Ask me the practical questions nobody answers.",
    photo: A("avatar-woman-hijab"), expertise: ["Getting started", "Pricing", "Suppliers"],
    languages: ["Urdu", "Hindi"], experience_years: 6, location: "Lucknow",
    availability: "Most afternoons", rating: 4.9, rating_count: 96, sessions_done: 96,
    requested: false, free_first: true, fee_minor: 0, tint: "--ux-tint-violet", ink: "--ux-violet",
  },
  {
    id: "m4", name: "Anita Rao", headline: "Speaking up, at work and at home",
    bio: "I train teams for a living. Most of what holds women back in a room is fixable in three sessions.",
    photo: A("avatar-woman-teal-shirt"), expertise: ["Communication", "Interviews", "Confidence"],
    languages: ["Telugu", "English", "Hindi"], experience_years: 10, location: "Hyderabad",
    availability: "Tue and Fri", rating: 4.7, rating_count: 142, sessions_done: 142,
    requested: false, free_first: false, fee_minor: 60000, tint: "--ux-tint-blue", ink: "--ux-blue",
  },
  {
    id: "m5", name: "Lakshmi Iyer", headline: "Selling handmade work online",
    bio: "Photos, listings, packing, courier headaches — I have made every mistake already.",
    photo: A("avatar-woman-blue-saree"), expertise: ["Online selling", "Photography", "Packaging"],
    languages: ["Tamil", "English"], experience_years: 7, location: "Chennai",
    availability: "Weekday evenings", rating: 4.8, rating_count: 118, sessions_done: 118,
    requested: false, free_first: true, fee_minor: 45000, tint: "--ux-tint-pink", ink: "--ux-pink",
  },
  {
    id: "m6", name: "Sushila Devi", headline: "Tailoring as a trade, not a hobby",
    bio: "Thirty years at a machine. I teach the finishing that lets you charge properly.",
    photo: A("avatar-woman-elder-saree"), expertise: ["Tailoring", "Finishing", "Pricing"],
    languages: ["Hindi", "Bhojpuri"], experience_years: 30, location: "Patna",
    availability: "Mornings", rating: 5.0, rating_count: 64, sessions_done: 64,
    requested: false, free_first: true, fee_minor: 30000, tint: "--ux-tint-orange", ink: "--ux-amber",
  },
];

export const MY_SESSIONS = [
  { id: "b1", mentorId: "m1", mentor: "Neha Verma", photo: A("avatar-woman-blazer"),
    topic: "Getting my first ten customers", when: "Mon 26 May, 11:00 AM", state: "Upcoming" as const,
    mode: "Video call" },
  { id: "b2", mentorId: "m2", mentor: "Kavita Shah", photo: A("avatar-woman-pink-glasses"),
    topic: "Reading my own books", when: "Sat 31 May, 9:30 AM", state: "Requested" as const,
    mode: "Voice call" },
  { id: "b3", mentorId: "m3", mentor: "Razia Sultana", photo: A("avatar-woman-hijab"),
    topic: "What to charge for custom work", when: "12 May, 4:00 PM", state: "Done" as const,
    mode: "Video call" },
];

export const EXPERTISE = [
  "Digital marketing", "Bookkeeping", "Getting started", "Communication",
  "Online selling", "Tailoring", "Savings", "Pricing",
];

export const LANGUAGES = ["Hindi", "English", "Gujarati", "Urdu", "Telugu", "Tamil", "Bhojpuri"];

export const MENTOR_ART = {
  empty: A("empty-magnifying-glass-blank-page"),
  hero: A("scene-elder-woman-mentoring"),
  call: A("course-video-call-mentor"),
  support: A("scene-two-women-support"),
};

/**
 * Money, or the word "Free".
 *
 * The difference from the plain formatter is deliberate and worth keeping: an
 * event with no fee says **Free**, because "₹0" reads like a price somebody
 * forgot to fill in.
 */
export { formatMoneyOrFree as rupees } from "../kit/money";
