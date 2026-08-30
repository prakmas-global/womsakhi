/* ------------------------------------------------------------------
   Recent searches — a tiny localStorage-backed history of the items a
   user has opened from the command palette. We store a lightweight
   snapshot (never the lucide icon component, which can't be
   serialized) and re-hydrate the icon by id from the search index.
------------------------------------------------------------------- */

export type RecentEntry = {
  id: string;
  title: string;
  subtitle?: string;
  group: string;
  href: string;
};

const KEY = "wc:recent-search:v1";
const MAX = 6;

/** Read the recent list (newest first). Safe on the server / on bad data. */
export function getRecent(): RecentEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is RecentEntry =>
          !!e && typeof e.id === "string" && typeof e.title === "string" && typeof e.href === "string",
      )
      .slice(0, MAX);
  } catch {
    return [];
  }
}

/** Prepend an item to the recent list (deduped by id, capped at MAX). */
export function pushRecent(entry: RecentEntry): RecentEntry[] {
  if (typeof window === "undefined") return [];
  const next = [entry, ...getRecent().filter((e) => e.id !== entry.id)].slice(0, MAX);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full / disabled — ignore */
  }
  return next;
}

/** Clear the recent list. */
export function clearRecent(): RecentEntry[] {
  if (typeof window === "undefined") return [];
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return [];
}
