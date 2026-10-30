import { quoteForPath } from "@/components/ux/inspiration/quotes";
import { dailyIndex } from "@/components/ux/fill/content";
import { trailFor, type NavNode } from "@/components/ux/nav-tree";
import { placeOf } from "./places";

/**
 * The banner at the top of a section's screens — one slot, one decision.
 *
 * ── What fills it today ─────────────────────────────────────────────────────
 * IMAGE: the place's photo (or its parent's), beside a short line about that
 * part of the app, on the brand.
 * QUOTE: where no photo plainly shows the place, a line in large type on the
 * brand with its pictogram behind — a module line, or one of the
 * real quotes the app already carries (components/ux/fill/content.ts), turning
 * daily so a screen she opens every day does not say the same thing forever.
 *
 * ── What can fill it later ──────────────────────────────────────────────────
 * The same slot is where a sponsor relevant to the section goes — a sewing
 * machine maker on Tailoring, a bank on My money. `bannerFor` is the only
 * place that decides what shows, so serving ads means making it ask the
 * server for a `Banner` of kind "ad" first and falling back to these. The
 * component already draws that kind, with the "Sponsored" label it must
 * carry. Two rules for when it does: never on Help or Get help (nothing may
 * sell to a woman looking for a helpline), and never anything that asks for
 * money up front — the safety screen tells her that is a scam.
 *
 * ── Where it shows ──────────────────────────────────────────────────────────
 * On a place's own screen (the path IS the node's href), not on detail pages
 * under it — a course, a person, an order have their own picture. Not on the
 * screens that already open on a big picture of their own (`HAS_HERO`), and
 * not on Help's emergency screen, where a banner is only something to scroll
 * past. A page that draws a hero of its own marks it `data-page-hero` (the
 * Health frame's `data-health-hero` counts too) and the banner steps aside —
 * by CSS, in tokens.css, since only the page knows it has one.
 */

export type Banner =
  | { kind: "image"; image: string; line: string; by?: string; icon: string }
  | { kind: "quote"; line: string; by?: string; who?: string; icon: string }
  | { kind: "ad"; image: string; line: string; sponsor: string; href: string; cta: string; icon: string };

/** Screens with no banner: they open on a large picture of their own already, or on the task itself. */
const HAS_HERO = new Set([
  "/app", "/app/learn", "/app/work", "/app/earn",
  "/app/saved", "/app/schedule", "/app/discover", "/app/goals", "/app/journey", "/app/notifications", "/app/help",
  "/app/work/profile", "/app/safety", "/app/sakhi", "/app/explore", "/app/search",
  // Find work opens on the search she came for; a banner only pushes it down.
  "/app/opportunities",
  "/app/you",
]);

/** A line for each part of the app: what it is FOR, said to her. */
const LINES: Record<string, string[]> = {
  home: [
    "Small steps every day become big changes.",
    "Your day, your way — one step at a time.",
    "Everything you need, in one place.",
  ],
  learn: [
    "What you learn can never be taken from you.",
    "Ten minutes a day. A new skill in a month.",
    "Every expert was once a beginner.",
  ],
  work: [
    "Your skills deserve to be paid for.",
    "Show what you can do. Let the right work find you.",
    "Good work, fair pay, safe places.",
  ],
  earn: [
    "Your own money is your own voice.",
    "Sell what you make. Keep what you earn.",
    "Every rupee you save is a step to freedom.",
  ],
  circle: [
    "Together we are stronger.",
    "When one woman rises, she lifts others with her.",
    "Ask, share, help — you are never alone here.",
  ],
  wellness: [
    "Taking care of yourself is not selfish.",
    "A healthy woman builds a healthy home.",
    "Rest is also progress.",
  ],
  help: [
    "You are never alone. Help is one tap away.",
    "Know your rights. Use your voice.",
    "Your safety comes first. Always.",
  ],
  account: [
    "This is your space. You decide who sees what.",
    "Your phone number stays yours.",
  ],
};

export function bannerFor(path: string): Banner | null {
  const clean = (path.split("?")[0].replace(/\/+$/, "")) || "/app";
  if (HAS_HERO.has(clean)) return null;
  const trail = trailFor(clean);
  const node: NavNode | undefined = trail[trail.length - 1];
  if (!node || node.href !== clean) return null; // a detail page under a list
  const p = placeOf(node);
  const lines = LINES[p.section] ?? LINES.home;
  const pick = dailyIndex(lines.length + 1, node.id);

  // Its own photo, else its parent's — a photo of the same work. Not the
  // module's: that one photo would then head every screen in the module,
  // and a banner that never changes stops being seen.
  const parent = trail.length > 2 ? trail[trail.length - 2] : null;
  const photo = p.photo || (parent ? placeOf(parent).photo : "");
  if (photo) {
    return { kind: "image", image: photo, line: lines[pick % lines.length], icon: p.icon };
  }
  // No photo: a line in large type. Every few days it is a real quote instead.
  // Only the short ones: a banner is read at a glance, and on a phone a long
  // quote becomes a paragraph standing between her and the screen.
  if (pick === lines.length) {
    const quote = quoteForPath(clean);
    return { kind: "quote", line: quote.text, by: quote.by, icon: p.icon };
  }
  return { kind: "quote", line: lines[pick], icon: p.icon };
}
