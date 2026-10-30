"use client";

import { useSyncExternalStore } from "react";
import { useI18n } from "@/i18n";

const KEY = "womsakhi.encouragement.language";
const EVENT = "womsakhi:encouragement-language";
const read = () => {
  try { return localStorage.getItem(KEY) || ""; } catch { return ""; }
};
const subscribe = (notify: () => void) => {
  window.addEventListener("storage", notify);
  window.addEventListener(EVENT, notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(EVENT, notify);
  };
};

/** These fully translated sections can be used before the whole app is translated. */
export function useContentLanguage() {
  const { locale } = useI18n();
  const preference = useSyncExternalStore(subscribe, read, () => "");
  const language = (preference || locale) === "hi" ? "hi" : "en";
  const toggleLanguage = () => {
    try { localStorage.setItem(KEY, language === "hi" ? "en" : "hi"); } catch { return; }
    window.dispatchEvent(new Event(EVENT));
  };
  return { language, toggleLanguage };
}
