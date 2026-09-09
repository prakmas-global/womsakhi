import { MODES } from "./nav";
import type { ApiSearchHit } from "@/lib/me-api";

/**
 * Every screen in the app, findable by typing, without asking the server.
 *
 * ── The gap this closes ─────────────────────────────────────────────────────
 * The member palette searched only the API, which indexes *content* — courses,
 * circles, schemes, people. Screens were never in it. So a woman who knew there
 * was a page about what she is owed could not reach it by typing "owed", and
 * the forty routes added in the last sprint were invisible to search entirely
 * because they have no server behind them.
 *
 * ── Why it reads the navigation instead of a list ───────────────────────────
 * `nav.ts` already holds every route with the label, icon and one-line note a
 * result needs. A second hand-kept list of pages is wrong the day after anyone
 * ships a screen — which is exactly what happened here. Reading the navigation
 * means a rename reaches search with nothing to remember, the same reasoning
 * behind the Quick Access grid.
 *
 * `findable` is included as well as `items`: a mode's child screens — showing
 * someone your phone, what to charge, who signs the contract — are exactly what
 * someone types, and they were reachable only by already knowing where to look.
 *
 * ── Why matching is deliberately generous ───────────────────────────────────
 * She will not type the label. She will type "owed", "machine money", "who
 * signs" — so the note is searched as well as the title, and the section name
 * too, and every word must match somewhere rather than the whole phrase
 * matching one field.
 */
export interface PageHit extends ApiSearchHit {
  icon: string;
  /** Message key for the title; `${k}.note` for the hint. See nav.ts. */
  k?: string;
  /** The mode's own message key, for the section shown beside a hit. */
  modeK?: string;
}

const PAGES: PageHit[] = (() => {
  const seen = new Set<string>();
  const out: PageHit[] = [];
  for (const mode of MODES) {
    for (const item of [...mode.items, ...(mode.findable ?? [])]) {
      if (seen.has(item.href)) continue;
      seen.add(item.href);
      out.push({
        id: `page:${item.href}`,
        kind: "page",
        title: item.label,
        // The section disambiguates: "Your record" reads differently in Work
        // than it would anywhere else.
        sub: item.note ? `${mode.label} · ${item.note}` : mode.label,
        href: item.href,
        // "app" rather than "mine": these are places to go, not her records.
        group: "app",
        amount: "",
        tag: mode.label,
        icon: item.icon,
        k: item.k,
        modeK: mode.k,
      });
    }
  }
  return out;
})();

/** How many screens are searchable. Exported so a check can assert it. */
export const PAGE_COUNT = PAGES.length;

/**
 * What a path is called, for a back control that wants to name its destination.
 *
 * Falls back along the path — `/app/bookings/abc123` is not a nav item, but
 * `/app/bookings` is, and "Back to Times you have booked" is what she needs to
 * read. Returns the message key too, so the caller can translate it.
 */
export function pageFor(href: string): { title: string; k?: string } | null {
  let path = href.split("?")[0].replace(/\/+$/, "") || "/app";
  for (;;) {
    const hit = PAGES.find((p) => p.href === path);
    if (hit) return { title: hit.title, k: hit.k };
    const cut = path.lastIndexOf("/");
    if (cut <= 4) return null;                 // do not climb above /app
    path = path.slice(0, cut);
  }
}

/**
 * @param translate Optional lookup for a message key. When the reader is not
 *   on English, her language is searched *as well as* the English — she may
 *   know a screen by either name, and dropping the English would break a habit
 *   she already has.
 */
export function searchPages(
  q: string,
  limit = 6,
  translate?: (key: string) => string,
): PageHit[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const scored: Array<{ hit: PageHit; score: number }> = [];
  for (const hit of PAGES) {
    // `k` is a base; the title lives at `${k}.label`.
    const local = hit.k && translate ? translate(`${hit.k}.label`).toLowerCase() : "";
    const title = `${hit.title.toLowerCase()}${local && local !== hit.title.toLowerCase() ? ` ${local}` : ""}`;
    const hay = `${title} ${hit.sub.toLowerCase()} ${hit.href.toLowerCase()}`;
    // Every word has to appear somewhere, so "who signs" does not match a page
    // that merely contains "who".
    if (!words.every((w) => hay.includes(w))) continue;

    // A title match beats a note match, and a title that starts with what she
    // typed beats one that merely contains it.
    let score = 0;
    for (const w of words) {
      if (title.startsWith(w)) score += 6;
      else if (title.includes(w)) score += 4;
      else score += 1;
    }
    scored.push({ hit, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.hit);
}
