/**
 * The languages WomSakhi speaks.
 *
 * Adding a language is one entry here plus one file in `messages/` — nothing
 * else in the app changes. Locale is stored on her ACCOUNT (not in the URL), so
 * her language follows her to any device she signs in from.
 *
 * Two flags, and they answer different questions. `translated` decides whether
 * a woman can pick the language. `reviewed` records whether a human who speaks
 * it has actually read the file. They are deliberately not the same switch:
 *
 *   translated: false   no catalogue — greyed as "coming soon", falls back to English
 *   translated: true    complete catalogue, and she can use it
 *   reviewed: false     nobody who speaks it has read it yet
 *   reviewed: true      a native speaker has been through it
 *
 * Every shipped catalogue was verified by machine before it was allowed in:
 * all 327 keys present, every {placeholder} intact, and the text confirmed to
 * be in its own script rather than English passed through. That is enough to
 * know a language is not an illusion — it is complete, it renders, and nothing
 * silently falls back.
 *
 * It is NOT enough to know every sentence reads naturally, which is why
 * `reviewed` exists as a separate, honest record rather than being folded into
 * `translated`. Do not set `reviewed: true` because a translation looks fine;
 * set it when a person who speaks the language has read the file. The helpline
 * and money strings are the ones worth their time first.
 */

export type Direction = "ltr" | "rtl";

export interface LocaleSpec {
  code: string;
  /** English name, for admin surfaces. */
  name: string;
  /** Her own language's name, which is what she'll actually recognise. */
  nativeName: string;
  dir: Direction;
  /** Which font stack this script needs — see fonts in globals.css. */
  script: "latin" | "devanagari" | "tamil" | "bengali" | "arabic" | "telugu" | "gujarati" | "kannada" | "malayalam" | "gurmukhi" | "odia" | "cjk";
  /** Is there a complete catalogue? This is what decides she can pick it. */
  translated: boolean;
  /** Has a native speaker read it? A record, not a gate — see the note above. */
  reviewed: boolean;
}

export const LOCALES: LocaleSpec[] = [
  { code: "en", name: "English", nativeName: "English", dir: "ltr", script: "latin", translated: true, reviewed: true },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", dir: "ltr", script: "devanagari", translated: false, reviewed: true },
  
  
  { code: "ur", name: "Urdu", nativeName: "اردو", dir: "rtl", script: "arabic", translated: false, reviewed: true },

  // Wired, catalogues pending. Each needs one file in messages/ — and a native
  // speaker to read it before it goes in front of real users.
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", dir: "ltr", script: "tamil", translated: false, reviewed: false },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", dir: "ltr", script: "bengali", translated: false, reviewed: false },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", dir: "ltr", script: "telugu", translated: false, reviewed: false },
  { code: "mr", name: "Marathi", nativeName: "मराठी", dir: "ltr", script: "devanagari", translated: false, reviewed: false },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી", dir: "ltr", script: "gujarati", translated: false, reviewed: false },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ", dir: "ltr", script: "kannada", translated: false, reviewed: false },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം", dir: "ltr", script: "malayalam", translated: false, reviewed: false },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", dir: "ltr", script: "gurmukhi", translated: false, reviewed: false },
  { code: "or", name: "Odia", nativeName: "ଓଡ଼ିଆ", dir: "ltr", script: "odia", translated: false, reviewed: false },
  { code: "ar", name: "Arabic", nativeName: "العربية", dir: "rtl", script: "arabic", translated: false, reviewed: false },
  { code: "es", name: "Spanish", nativeName: "Español", dir: "ltr", script: "latin", translated: false, reviewed: false },
  { code: "fr", name: "French", nativeName: "Français", dir: "ltr", script: "latin", translated: false, reviewed: false },
  { code: "pt", name: "Portuguese", nativeName: "Português", dir: "ltr", script: "latin", translated: false, reviewed: false },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", dir: "ltr", script: "latin", translated: false, reviewed: false },
  { code: "sw", name: "Swahili", nativeName: "Kiswahili", dir: "ltr", script: "latin", translated: false, reviewed: false },
];

export const DEFAULT_LOCALE = "en";

export const LOCALES_BY_CODE: Record<string, LocaleSpec> = Object.fromEntries(
  LOCALES.map((l) => [l.code, l])
);

export function localeSpec(code: string | undefined | null): LocaleSpec {
  return LOCALES_BY_CODE[code ?? ""] ?? LOCALES_BY_CODE[DEFAULT_LOCALE];
}

export function isRtl(code: string | undefined | null): boolean {
  return localeSpec(code).dir === "rtl";
}

/** Best supported match for what the browser asks for. */
export function detectLocale(accept: readonly string[] = []): string {
  for (const raw of accept) {
    const base = raw.toLowerCase().split("-")[0];
    const spec = LOCALES_BY_CODE[base];
    if (spec?.translated) return spec.code;
  }
  return DEFAULT_LOCALE;
}

/**
 * Where her language choice is stored.
 *
 * Defined here rather than in `index.tsx` because that file is a client
 * component: a constant re-exported through it reaches a server component as a
 * client reference, not as this string, and `cookies().get()` then silently
 * finds nothing.
 */
export const LOCALE_COOKIE = "womsakhi_locale";
