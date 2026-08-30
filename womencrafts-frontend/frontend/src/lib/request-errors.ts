/**
 * A single place that knows when requests are failing.
 *
 * ── Why this is central rather than per-screen ──────────────────────────────
 * An audit found **97 catch blocks that swallow the error**, and 60 screens
 * that track an error variable but never render it. Only one screen in the
 * whole app shows an error state.
 *
 * The consequence is worse than a missing message. A list screen whose fetch
 * failed falls through to its empty state, so the user is told **"No members
 * yet"** when the truth is "we could not reach the server". The screen lies,
 * confidently, and nobody files a bug because nothing looks broken.
 *
 * Fixing that screen-by-screen means editing 87 files and remembering to do it
 * in every file written afterwards. Reporting it once, here, covers all of them
 * — including the ones nobody has written yet.
 *
 * Per-screen `ErrorState` still matters where a retry can be scoped to one
 * list; this is the floor, not the ceiling.
 */

export interface RequestFailure {
  /** Path that failed, without the base URL — e.g. `/members`. */
  path: string;
  status: number;
  /** When it happened, for de-duplicating a burst of failures. */
  at: number;
}

type Listener = (failures: RequestFailure[]) => void;

const listeners = new Set<Listener>();
let failures: RequestFailure[] = [];

/** How long a failure stays "current". Long enough to notice, short enough not to nag. */
const WINDOW_MS = 8000;

function prune() {
  const cutoff = Date.now() - WINDOW_MS;
  failures = failures.filter((f) => f.at > cutoff);
}

function emit() {
  prune();
  for (const listener of listeners) listener([...failures]);
}

export function recordFailure(path: string, status: number): void {
  // 401 is not a failure to report — it means signed out, and the app already
  // redirects. Surfacing it would put an error banner on every expired session.
  if (status === 401) return;
  // 404 on a detail route is usually "this thing was deleted", which the screen
  // itself should explain in context. A banner would be noise.
  if (status === 404) return;

  failures = [...failures.filter((f) => f.path !== path), { path, status, at: Date.now() }];
  emit();
  // Re-emit once the window closes so the banner clears itself.
  setTimeout(emit, WINDOW_MS + 100);
}

export function clearFailures(): void {
  failures = [];
  emit();
}

export function subscribeToFailures(listener: Listener): () => void {
  listeners.add(listener);
  listener([...failures]);
  return () => listeners.delete(listener);
}

/** Current failures, for a component that renders on demand rather than subscribing. */
export function currentFailures(): RequestFailure[] {
  prune();
  return [...failures];
}
