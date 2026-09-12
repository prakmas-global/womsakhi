"use client";

import { apiSave, apiSaved, apiUnsave } from "./entitlements-api";

/**
 * Which circle posts she has bookmarked — on the server, shared by two screens.
 *
 * ── What this replaces ──────────────────────────────────────────────────────
 * Both `/app/circles` and `/app/circles/[id]` kept the same answer in
 * `localStorage` under `womsakhi.circle.saved`, each with its own copy of the
 * read-and-write code and its own module-level `bump`. It survived a reload on
 * that handset and nothing else: a woman who signs in on her sister's phone, or
 * gets a new one, has an empty Saved tab and no way to know why. The screen
 * said so in a note, which is honest about a limit rather than a reason to keep
 * it — `POST /saved` has existed since the bookmark did.
 *
 * ── Why a module store and not a hook per screen ────────────────────────────
 * The bookmark is pressed on a card inside a list, and the count in the rail
 * and the Saved tab both have to move with it. Two `useState`s in two routes
 * cannot agree; one store that both screens subscribe to can, and it means the
 * list is fetched once per session rather than once per screen.
 *
 * The snapshot is a **string**, not a Set, because `useSyncExternalStore`
 * compares snapshots by identity: a fresh Set every render is a new object and
 * would re-render forever.
 */

let ids: ReadonlySet<string> = new Set();
let snapshot = "";
const subscribers = new Set<() => void>();

function publish(next: ReadonlySet<string>) {
  ids = next;
  snapshot = [...next].sort().join(",");
  for (const fn of subscribers) fn();
}

export function subscribeSavedPosts(cb: () => void) {
  subscribers.add(cb);
  return () => { subscribers.delete(cb); };
}

export const savedPostsSnapshot = () => snapshot;
/** The server has no session here and nothing is saved during render. */
export const savedPostsServerSnapshot = () => "";

let inFlight: Promise<void> | null = null;

/**
 * Fetch her bookmarks once per session.
 *
 * Both screens call this on mount and they must not make two requests — the
 * second joins the first's promise. A failure clears the latch so the next
 * screen tries again rather than leaving her permanently empty.
 */
export function loadSavedPosts(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = apiSaved(undefined, "post")
    .then((rows) => { publish(new Set(rows.map((r) => r.ref_id))); })
    .catch((e: unknown) => { inFlight = null; throw e; });
  return inFlight;
}

export const isPostSaved = (id: string) => ids.has(id);

/**
 * Save or unsave one post. Optimistic, and it puts itself back.
 *
 * Resolves to what the bookmark now is, so the screen can say the right
 * sentence. Throws when the write failed — by which point the flip has already
 * been undone, so a screen that shows an error is describing what she can see.
 */
export async function toggleSavedPost(id: string): Promise<boolean> {
  const want = !ids.has(id);
  const before = ids;
  const next = new Set(ids);
  if (want) next.add(id); else next.delete(id);
  publish(next);
  try {
    if (want) await apiSave("post", id);
    else await apiUnsave("post", id);
    return want;
  } catch (e) {
    publish(before);
    throw e;
  }
}
