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

import en, { type Catalog, type MessageKey } from "./messages/en";
import hi from "./messages/hi";
import ur from "./messages/ur";
import mr from "./messages/mr";
import ta from "./messages/ta";
import bn from "./messages/bn";
import te from "./messages/te";
import gu from "./messages/gu";
import kn from "./messages/kn";
import ml from "./messages/ml";
import pa from "./messages/pa";
import or from "./messages/or";
import ar from "./messages/ar";
import es from "./messages/es";
import fr from "./messages/fr";
import pt from "./messages/pt";
import id from "./messages/id";
import sw from "./messages/sw";
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

const CATALOGS: Record<string, Catalog> = {
  en, hi, ur, mr,
  ta, bn, te, gu, kn, ml, pa, or, ar, es, fr, pt, id, sw,
};


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
  const [locale, setLocaleState] = useState(initialLocale || DEFAULT_LOCALE);

  // Pick up the cookie on mount (the server render can't read it in a client
  // component tree without threading it through every page).
  useEffect(() => {
    const saved = readCookie(LOCALE_COOKIE);
    if (saved && CATALOGS[saved] && saved !== locale) setLocaleState(saved);
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
    setLocaleState(code);
    document.cookie = `${LOCALE_COOKIE}=${code}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  }, []);

  const value = useMemo<I18nValue>(() => {
    const catalog = CATALOGS[locale] ?? en;
    return {
      locale,
      spec,
      dir: spec.dir,
      setLocale,
      t: (key, vars) => {
        const template = catalog[key] ?? en[key] ?? String(key);
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
