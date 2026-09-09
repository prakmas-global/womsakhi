"use client";

/**
 * Where she has just been — so "back" can name it and go there.
 *
 * ── Why `document.referrer` could not do this ────────────────────────────────
 * The first version of `Back` read `document.referrer` and used history when it
 * matched our origin. That is correct for a full page load and useless for
 * everything else: a Next `<Link>` is a pushState, not a new document, so the
 * referrer never changes. Driving the app in a browser, going Calendar → a
 * booking, `document.referrer` is the empty string and `history.length` is 3.
 * So the check said "no in-app history" on every single client-side navigation,
 * which is nearly all of them, and every back control fell through to its
 * declared parent. The calendar sent her to All bookings.
 *
 * ── What this keeps instead ─────────────────────────────────────────────────
 * A short trail of the paths she has actually visited, written on each route
 * change. `sessionStorage`, so it is per-tab (two tabs do not share a "back"),
 * survives a refresh, and never leaves the device.
 *
 * Only the last handful is kept. This is for naming the previous screen, not
 * for rebuilding her session — and a trail that grows without limit is a leak.
 */

const KEY = "ws:nav-trail";
const MAX = 8;

/** Reads the trail. Never throws: private mode and blocked storage both fail. */
export function trail(): string[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Records a visit.
 *
 * Consecutive duplicates are dropped — React may render the same path twice,
 * and a trail of ["/app/money", "/app/money"] would make back a no-op.
 */
export function record(path: string): void {
  try {
    const t = trail();
    if (t[t.length - 1] === path) return;
    t.push(path);
    sessionStorage.setItem(KEY, JSON.stringify(t.slice(-MAX)));
  } catch {
    /* storage unavailable — Back falls back to its declared parent */
  }
}

/**
 * The page before this one, if she reached this one from inside the app.
 *
 * Skips any entry equal to the current path, so a re-render or a query-string
 * change does not make "back" point at the screen she is already looking at.
 */
export function previous(current: string): string | null {
  const t = trail();
  for (let i = t.length - 1; i >= 0; i--) {
    if (t[i] !== current) return t[i];
  }
  return null;
}
