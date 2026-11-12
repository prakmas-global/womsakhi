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
 *
 * And when she has come back to a screen already on the trail — Games → Rangoli
 * designs → a design → back to Rangoli designs — the trip out from it is over:
 * back now means where she was before it (Games), not the design she just left.
 * Otherwise back would bounce her between the list and the design for ever.
 */
export function previous(current: string): string | null {
  // The trail as a stack: coming back to a screen on it closes everything after it.
  const stack: string[] = [];
  for (const p of trail()) {
    const at = stack.indexOf(p);
    if (at >= 0) stack.length = at + 1; else stack.push(p);
  }
  // This screen may not be recorded yet (the shell records after the page renders).
  const here = stack.indexOf(current);
  if (here >= 0) stack.length = here;
  return stack[stack.length - 1] ?? null;
}
