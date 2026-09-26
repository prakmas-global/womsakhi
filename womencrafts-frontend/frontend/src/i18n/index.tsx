"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import en, { type MessageKey } from "./messages/en";
import { DEFAULT_LOCALE, localeSpec, type LocaleSpec, LOCALE_COOKIE } from "./locales";

/**
 * Translation, without touching the URL.
 *
 * Locale lives on her ACCOUNT, so her language follows her to any device. A
 * cookie mirrors it purely so the very first paint is already correct.
 *
 * Anything without a catalogue falls back to English rather than showing a raw
 * key — a missing translation should look plain, never broken.
 */

/**
 * How much of English each catalogue actually answers, 0–1.
 *
 * Counted here rather than written down in `locales.ts`, because a flag that
 * is maintained by hand drifts and this one had: eighteen languages were
 * marked `translated: true`, which is what puts a language in the picker, and
 * nine of them were between 0% and 9% complete. A woman who chose ਪੰਜਾਬੀ got
 * an app that was entirely English, labelled only "new translation".
 *
 * Computed once at module load — two `Object.keys` over objects already in
 * memory, so it costs nothing and can never disagree with the files again.
 */
export function coverageOf(code: string): number {
  return code === "en" ? 1 : 0;
}

/**
 * The bar a language must clear to be offered.
 *
 * Not 100%: a catalogue one string short of English is still a usable
 * translation, and holding it back over that would be its own kind of
 * dishonesty. 90% is high enough that the screens she meets are her language
 * and the gaps are corners.
 */
export const USABLE_COVERAGE = 0.9;

/** Is this language complete enough to be offered to her? */
export function isUsable(code: string): boolean {
  return coverageOf(code) >= USABLE_COVERAGE;
}


type Vars = Record<string, string | number>;

interface I18nValue {
  locale: string;
  spec: LocaleSpec;
  dir: "ltr" | "rtl";
  t: (key: MessageKey, vars?: Vars) => string;
  setLocale: (code: string) => void;
  /** Locale-aware formatters, so numbers and dates match the language. */
  formatDate: (iso: string, opts?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (n: number, opts?: Intl.NumberFormatOptions) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.split("=")[1]) : null;
}

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale?: string;
}) {
  const startingLocale = isUsable(initialLocale ?? "") ? initialLocale! : DEFAULT_LOCALE;
  const [locale, setLocaleState] = useState(startingLocale);

  // Pick up the cookie on mount (the server render can't read it in a client
  // component tree without threading it through every page).
  useEffect(() => {
    const saved = readCookie(LOCALE_COOKIE);
    if (saved && isUsable(saved) && saved !== locale) setLocaleState(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spec = localeSpec(locale);

  // The document itself has to know the language and direction: it drives text
  // selection, hyphenation, screen readers, and every `start`/`end` style rule.
  useEffect(() => {
    document.documentElement.lang = spec.code;
    document.documentElement.dir = spec.dir;
  }, [spec.code, spec.dir]);

  const setLocale = useCallback((code: string) => {
    if (!isUsable(code)) return;
    setLocaleState(code);
    document.cookie = `${LOCALE_COOKIE}=${code}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  }, []);

  const value = useMemo<I18nValue>(() => {
    return {
      locale,
      spec,
      dir: spec.dir,
      setLocale,
      t: (key, vars) => {
        const template = String(en[key] ?? key);
        if (!vars) return template;
        return Object.entries(vars).reduce(
          (out, [k, v]) => out.replaceAll(`{${k}}`, String(v)),
          template
        );
      },
      formatDate: (iso, opts) => {
        if (!iso) return "";
        const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
        if (Number.isNaN(d.getTime())) return iso;
        return new Intl.DateTimeFormat(locale, opts ?? { day: "numeric", month: "short" }).format(d);
      },
      formatNumber: (n, opts) => new Intl.NumberFormat(locale, opts).format(n),
    };
  }, [locale, spec, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * What THIS browser has already been told, if anything.
 *
 * The difference between "she has chosen a language on this device" and "she
 * has never been asked" is the whole of the sign-in hand-off: a choice made
 * here is hers and is not overruled by her account, while an absence is the
 * new-device case where the account is the only thing that knows.
 */
export function storedLocale(): string | null {
  const saved = readCookie(LOCALE_COOKIE);
  return saved && isUsable(saved) ? saved : null;
}

/**
 * The language she picked BEFORE she signed in.
 *
 * Her account is the source of truth for language, and `MemberShell` applies
 * it on every visit — which is right on a borrowed phone and wrong in the one
 * second after she has just chosen a language on the sign-in screen. There her
 * choice is the newest thing anybody knows, and the account is stale.
 *
 * So the sign-in screen leaves a note here and `MemberShell` reads it once,
 * exactly like a hand-off. `sessionStorage` because it is the right lifetime:
 * this tab, this sign-in, gone afterwards — a durable flag would keep
 * overruling her account long after the moment it was meant for.
 */
const PRE_SIGNIN_KEY = "womsakhi_locale_choice";

export function rememberPreSignInChoice(code: string): void {
  // Private browsing and blocked site data both throw here. The choice still
  // applies in this browser through the cookie; only the hand-off is lost.
  try { sessionStorage.setItem(PRE_SIGNIN_KEY, code); } catch { /* not important enough to break sign-in */ }
}

/** Reads the note and tears it up — it must only ever be acted on once. */
export function takePreSignInChoice(): string | null {
  try {
    const code = sessionStorage.getItem(PRE_SIGNIN_KEY);
    if (code) sessionStorage.removeItem(PRE_SIGNIN_KEY);
    return code && isUsable(code) ? code : null;
  } catch { return null; }
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

/** Shorthand for the common case. */
export function useT() {
  return useI18n().t;
}

export { LOCALES, localeSpec, isRtl, DEFAULT_LOCALE, LOCALE_COOKIE } from "./locales";
export type { MessageKey };
