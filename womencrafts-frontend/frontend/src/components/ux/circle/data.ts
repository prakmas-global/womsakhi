/**
 * Circle — the vocabulary of the discussion side.
 *
 * ── What the API already carries ────────────────────────────────────────────
 * A `Circle` has a name, a topic, a description, a cover, a privacy flag and a
 * member count; a `Post` has an author, a body, likes, replies and a time.
 * Every one of those is read live. Nothing in this file replaces them.
 *
 * ── What it does not ────────────────────────────────────────────────────────
 * There is no field for a post's own title, its hashtags, a saved/bookmarked
 * post, a circle's category tree, a cover-image preset, a circle icon, or
 * tags. The categories and presets below are the wizard's vocabulary — a fixed
 * list, the way "Clothing and stitching" is fixed in the Earn wizard — and the
 * title and hashtags are DERIVED from the body rather than invented, so a post
 * never shows words its author did not write.
 */

const A = (n: string) => `/ux/art/${n}.webp`;

/* ── What women talk about ────────────────────────────────────────────────── */

export interface Topic {
  id: string;
  label: string;
  icon: string;
  tint: string;
  ink: string;
}

/**
 * The seven, plus "All".
 *
 * Each carries its own tint so a category reads the same on a chip, on a
 * trending card and on a post — a woman scanning the feed should be able to
 * find "Money & Finance" by colour before she has read the word.
 */
export const TOPICS: Topic[] = [
  { id: "business", label: "Business & Ideas",  icon: "Lightbulb",     tint: "--ux-tint-green",  ink: "--ux-green-ink" },
  { id: "health",   label: "Health & Wellness", icon: "HeartPulse",    tint: "--ux-tint-green",  ink: "--ux-green-ink" },
  { id: "career",   label: "Career & Skills",   icon: "Briefcase",     tint: "--ux-tint-blue",   ink: "--ux-blue-ink" },
  { id: "money",    label: "Money & Finance",   icon: "Wallet",        tint: "--ux-tint-amber",  ink: "--ux-amber-ink" },
  { id: "family",   label: "Family & Life",     icon: "Heart",         tint: "--ux-tint-pink",   ink: "--ux-pink-ink" },
  { id: "stories",  label: "Success Stories",   icon: "Award",         tint: "--ux-tint-orange", ink: "--ux-orange-ink" },
  { id: "safety",   label: "Safety & Rights",   icon: "ShieldCheck",   tint: "--ux-tint-violet", ink: "--ux-violet-ink" },
];

export const ALL_TOPICS = "All Discussions";

/**
 * Which of the seven a circle belongs to — or none of them.
 *
 * The server's `topic` is free text typed by whoever started the circle, and
 * in practice it holds trades ("Craft", "Beauty"), abbreviations ("Careers")
 * and, for seventeen of the circles here, a CITY. An earlier version matched
 * loosely and fell through to the first category, which put "Jaipur" under
 * Business & Ideas and made every pill on the feed read the same.
 *
 * So: an explicit table of the words that really do mean one of the seven,
 * and for everything else the circle keeps its own word with a neutral tint.
 * A topic nobody planned for is not miscategorised — it is just itself.
 */
const SYNONYMS: Record<string, string> = {
  business: "business", ideas: "business", craft: "business", crafts: "business",
  handmade: "business", food: "business", cooking: "business", beauty: "business",
  tailoring: "business", selling: "business",

  health: "health", wellness: "health", fitness: "health", "mental health": "health",

  career: "career", careers: "career", skills: "career", digital: "career",
  "digital literacy": "career", learning: "career", study: "career", work: "career",

  money: "money", finance: "money", savings: "money", budgeting: "money",

  family: "family", life: "family", parenting: "family", support: "family",
  "work & family": "family", "work and family": "family", home: "family",

  stories: "stories", success: "stories", "success stories": "stories",

  safety: "safety", rights: "safety", legal: "safety", law: "safety",
};

/** The tint for a topic the app has no category for. Grey, not wrong-coloured. */
const OTHER = (label: string): Topic => ({
  id: `other:${label.toLowerCase()}`,
  label,
  icon: "MessagesSquare",
  tint: "--ux-surface-2",
  ink: "--ux-ink-2",
});

export function topicOf(raw: string | undefined): Topic {
  const s = (raw || "").trim();
  if (!s) return OTHER("General");

  const key = s.toLowerCase();
  const direct = SYNONYMS[key]
    // "Digital Literacy" and "Work & family" are whole phrases; a circle
    // called "Craft and pricing" is matched on its first meaningful word.
    ?? key.split(/[^a-z]+/).map((w) => SYNONYMS[w]).find(Boolean);

  const hit = direct ? TOPICS.find((t) => t.id === direct) : undefined;
  // Its own words, capitalised the way she typed them.
  return hit ?? OTHER(s[0].toUpperCase() + s.slice(1));
}

/* ── A post, as this screen needs it ──────────────────────────────────────── */

/**
 * Split a post body into the heading a reader scans and the words underneath.
 *
 * The API stores one block of text. Rather than invent a title, this takes the
 * author's own first line — or her first sentence when she wrote a paragraph —
 * which is what she would have typed into a title box anyway. Hashtags are
 * lifted out of the body and shown as chips, so they stop interrupting the
 * sentence they were written into.
 */
export function readPost(body: string): { title: string; rest: string; tags: string[] } {
  const tags = [...new Set((body.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((t) => t.slice(1)))].slice(0, 6);
  const clean = body.replace(/#[\p{L}\p{N}_]+/gu, "").replace(/[ \t]{2,}/g, " ").trim();

  const [first, ...more] = clean.split(/\n+/);
  if (more.length && first.length <= 120) {
    return { title: first.trim(), rest: more.join("\n").trim(), tags };
  }
  // One paragraph: the first sentence becomes the heading, if it is short
  // enough to read as one. Otherwise there is no heading and the body stands
  // on its own — better than a title chopped mid-clause.
  const stop = clean.search(/[.?!](\s|$)/);
  if (stop > 0 && stop < 110) {
    return { title: clean.slice(0, stop + 1).trim(), rest: clean.slice(stop + 1).trim(), tags };
  }
  return { title: "", rest: clean, tags };
}

/* ── The wizard's vocabulary ──────────────────────────────────────────────── */

export const PRIVACY = [
  { id: "public",  label: "Anyone can join",   note: "It shows in search and any woman can walk in.", icon: "Globe" },
  { id: "request", label: "Ask to join",       note: "She asks, you say yes. The circle is still findable.", icon: "UserRoundCheck" },
  { id: "private", label: "Invite only",       note: "It does not show in search. Only people you invite can see it.", icon: "Lock" },
];

/** Six covers she can pick without owning a camera. */
export const COVER_PRESETS = [
  A("scene-women-group-circle"),
  A("course-handmade-market-stall"),
  A("scene-women-celebrating"),
  A("scene-woman-planning-board"),
  A("course-two-women-handshake"),
  A("scene-woman-planting-sapling"),
];

export const CIRCLE_TIPS = [
  "Choose a clear and specific name",
  "Write a welcoming and engaging description",
  "Use an attractive cover image",
  "Set the right privacy level",
  "Add relevant tags",
  "Invite like-minded members",
];

export const SUGGESTED_TAGS = [
  "business", "handmade", "women", "india", "tailoring", "cooking",
  "savings", "health", "study", "mehendi", "parenting", "first-job",
];

export const CIRCLE_ART = {
  hero: A("scene-women-group-circle"),
  create: A("scene-women-celebrating"),
  empty: A("empty-magnifying-glass-blank-page"),
};

/** Rounded the way a person says it: 12.4K, 8.1K, 940. */
export const members = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K` : String(n);
