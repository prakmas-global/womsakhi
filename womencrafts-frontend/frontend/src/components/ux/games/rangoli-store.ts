/**
 * Where her rangoli colouring lives: in this browser's storage, nowhere else.
 *
 *   · each design's colouring, under its own key — the first design keeps the
 *     key the game used before there were designs, so nothing is lost;
 *   · "recent": which designs she has coloured, newest first (Continue colouring);
 *   · "saved": designs she chose to keep with "Save design" (My rangolis);
 *   · "made": designs she made with "Make a new design", newest first.
 *
 * Every read and write is wrapped: private windows and full storage just mean
 * a fresh start, never an error.
 */

export type Fills = Record<string, string>;
export type SavedRangoli = { sid: string; id: string; at: number; fills: Fills };

const PREFIX = "womsakhi.rangoli.v1";
const RECENT = "womsakhi.rangoli.recent";
const SAVED = "womsakhi.rangoli.saved";
const MADE = "womsakhi.rangoli.made";

export const fillsKey = (id: string) => (id === "classic" ? PREFIX : `${PREFIX}.${id}`);

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* full or blocked: fine */ }
}

export const loadFills = (id: string): Fills => read<Fills>(fillsKey(id), {});

/** Keep a design's colouring, and move it to the top of "recent" (or off it, when blank). */
export function storeFills(id: string, fills: Fills) {
  const blank = !Object.keys(fills).length;
  if (blank) {
    try { localStorage.removeItem(fillsKey(id)); } catch { /* fine */ }
  } else {
    write(fillsKey(id), fills);
  }
  const rest = recent().filter((r) => r.id !== id);
  write(RECENT, blank ? rest : [{ id, at: Date.now() }, ...rest].slice(0, 40));
}

/**
 * Designs she has coloured, newest first. Colouring saved before this list
 * existed (the first versions of the game) is found by its key and added.
 */
export function recent(): { id: string; at: number }[] {
  const list = read<{ id: string; at: number }[]>(RECENT, []);
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) ?? "";
      if (k !== PREFIX && !k.startsWith(`${PREFIX}.`)) continue;
      const id = k === PREFIX ? "classic" : k.slice(PREFIX.length + 1);
      if (!list.some((r) => r.id === id) && Object.keys(read<Fills>(k, {})).length) list.push({ id, at: 0 });
    }
  } catch { /* fine */ }
  return list;
}

export const listSaved = () => read<SavedRangoli[]>(SAVED, []);

export function addSaved(id: string, fills: Fills): SavedRangoli {
  const item = { sid: Date.now().toString(36), id, at: Date.now(), fills };
  write(SAVED, [item, ...listSaved()].slice(0, 40));
  return item;
}

export function removeSaved(sid: string) {
  write(SAVED, listSaved().filter((s) => s.sid !== sid));
}

export const listMade = () => read<string[]>(MADE, []);

export function addMade(id: string) {
  write(MADE, [id, ...listMade().filter((x) => x !== id)].slice(0, 60));
}
