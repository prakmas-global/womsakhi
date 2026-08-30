import { BREAKPOINT_MIN, EMPTY_LAYOUT, type Breakpoint, type Layout } from "./types";

/**
 * Local persistence and breakpoint detection.
 *
 * The layout is saved on the account, but it is also mirrored into a cookie so
 * the *server* can read it and render the first paint correctly. Without that
 * the page arrives with default widths and visibly rearranges itself a moment
 * later — which reads as a bug even though the end state is right.
 *
 * Same problem and same solution as the theme engine.
 */

export const LAYOUT_STORAGE_KEY = "womsakhi.layout";
export const LAYOUT_COOKIE = "wc_layout";

/** A year. Layout is a preference, not a session. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function currentBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINT_MIN.desktop) return "desktop";
  if (width >= BREAKPOINT_MIN.tablet) return "tablet";
  return "mobile";
}

export function readStoredLayout(): Layout | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Merge onto EMPTY_LAYOUT so a row written by an older build — missing a
    // key added since — still produces a complete object rather than throwing
    // on `layout.widgets.something` at render time.
    return { ...EMPTY_LAYOUT, ...parsed };
  } catch {
    return null;
  }
}

export function storeLayout(layout: Layout): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Private browsing, or the quota is full. Losing the local mirror is
    // survivable — the account copy is the real one.
  }

  try {
    // Only the parts the server needs for first paint. The full layout would
    // blow past the 4KB cookie limit on an account with many customised
    // screens, and a truncated cookie is worse than none.
    const forFirstPaint = { sidebar: layout.sidebar, nav: layout.nav };
    const value = encodeURIComponent(JSON.stringify(forFirstPaint));
    document.cookie = `${LAYOUT_COOKIE}=${value};path=/;max-age=${COOKIE_MAX_AGE};samesite=lax`;
  } catch {
    /*
     * Deliberately silent. This cookie is a first-paint optimisation: if it
     * cannot be written, the layout still loads from the server a moment
     * later and the screen is correct either way. There is nothing the user
     * could act on, so telling her would be noise about a problem she does
     * not have.
     */
  }
}

export function clearStoredLayout(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LAYOUT_STORAGE_KEY);
    document.cookie = `${LAYOUT_COOKIE}=;path=/;max-age=0;samesite=lax`;
  } catch {
    /* non-fatal */
  }
}
