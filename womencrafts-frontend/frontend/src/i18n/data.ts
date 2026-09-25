"use client";

import { useMemo } from "react";

import en from "./messages/en";
import { useI18n } from "./index";

/**
 * Translating the data modules.
 *
 * Roughly a fifth of everything on screen never comes from a component — it
 * comes from `components/ux/*​/data.ts`, module-level arrays of sections,
 * cards, steps and tips. `t()` cannot be called there: it is a hook, and those
 * files are evaluated once, at import, long before React exists. So every
 * string in them stayed English however carefully the screens were wired, and
 * a woman who picked Telugu still met English the moment she opened a hub.
 *
 * Wrapping each field at each render site would be hundreds of edits and a new
 * one every time somebody adds a row. So the translation happens once, at the
 * boundary where the data enters the component:
 *
 *     const SECTIONS = useTranslated(RAW_SECTIONS);
 *
 * ── How a string is matched ─────────────────────────────────────────────────
 * By its English text, against the English catalogue. Every one of these
 * strings was extracted into `en.ts` with a key, so the English IS the lookup —
 * which means a row somebody adds tomorrow keeps working (in English) without
 * anything else being touched, and starts speaking Telugu the moment its text
 * is added to the catalogue.
 *
 * Anything with no entry is returned exactly as it was. This never shows a raw
 * key and never shows a blank: the worst case is the English it replaced.
 *
 * ── Why the whole structure, not just known fields ──────────────────────────
 * These objects are not uniform — `label`, `detail`, `note`, `title`, `body`,
 * `points[]`, nested `items[]`. Walking everything and translating only exact
 * catalogue matches is both simpler and safer than a field allowlist that
 * silently misses the one field a new module invents.
 */

/** English text → key, built once from the catalogue. */
const BY_TEXT: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [key, text] of Object.entries(en as Record<string, string>)) {
    // First key wins: a duplicated English string resolves to the same words
    // either way, and this keeps the mapping stable between builds.
    if (typeof text === "string" && !(text in out)) out[text] = key;
  }
  return out;
})();

type Translate = (key: string) => string;

/**
 * Fields whose value is an identifier, never prose.
 *
 * This list is the difference between a translated app and a broken one. An
 * icon named `Home`, a wallet icon named `Wallet`, a repeat icon named
 * `Repeat` — every one of those words is also a real label in the catalogue,
 * so matching by English text turns `icon: "Home"` into `icon: "హోమ్"` and the
 * icon silently stops rendering. The same trap swallows an `id` the API
 * expects back, an `href`, a colour token and an image filename.
 *
 * Keyed on the field rather than the word, because the word is legitimately
 * translatable everywhere else — and because this keeps holding when somebody
 * adds `icon: "Search"` next month without reading any of this.
 */
const ID_FIELDS = new Set([
  "id", "key", "slug", "code", "sku", "ref", "kind", "type",
  "icon", "img", "art", "thumb", "image", "logo", "shape",
  "href", "link", "url", "route", "handle", "whatsapp",
  "tint", "ink", "bg", "cls", "tone", "color", "logoTint", "logoInk",
  "jobId", "mentorId", "swapId", "childId", "listingId", "circleId", "userId",
]);

function walk(value: unknown, t: Translate, seen: WeakSet<object>): unknown {
  if (typeof value === "string") {
    const key = BY_TEXT[value];
    if (!key) return value;
    const got = t(key);
    // `t()` hands back the key when a language has no entry for it. Showing a
    // key would be worse than showing English, so the original wins.
    return got === key ? value : got;
  }
  if (Array.isArray(value)) return value.map((v) => walk(v, t, seen));
  if (value && typeof value === "object") {
    // React elements, dates and class instances are passed through untouched:
    // rebuilding them would strip their prototype and break rendering.
    if (!isPlainObject(value)) return value;
    if (seen.has(value)) return value;
    seen.add(value);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      // An identifier keeps its own string. Anything nested under it is still
      // walked, because a key called `type` can hold an object of real prose.
      out[k] = (ID_FIELDS.has(k) && typeof v === "string") ? v : walk(v, t, seen);
    }
    return out;
  }
  return value;
}

function isPlainObject(v: object): boolean {
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/**
 * The same data, in her language.
 *
 * Memoised on the locale, so a screen that re-renders for any other reason
 * does not rebuild the tree — and the identity stays stable, which matters
 * because several of these lists are passed to memoised children.
 */
export function useTranslated<T>(value: T): T {
  const { locale, t } = useI18n();
  return useMemo(
    () => walk(value, t as unknown as Translate, new WeakSet()) as T,
    // `value` is a module constant: the same reference for the life of the
    // page, so the locale is what actually decides this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value, locale],
  );
}
