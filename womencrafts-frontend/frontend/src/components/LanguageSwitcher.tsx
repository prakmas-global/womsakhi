"use client";

import { useState } from "react";
import { Check, Globe, Loader2 } from "lucide-react";

import { useI18n } from "@/i18n";
import { LOCALES } from "@/i18n/locales";

/**
 * Language picker.
 *
 * Each language is listed in ITS OWN script — a woman looking for Hindi scans
 * for "हिन्दी", not for the word "Hindi". Languages without a catalogue yet are
 * shown but disabled, rather than hidden or silently falling back to English.
 *
 * Availability is decided by `translated` — a complete, machine-verified
 * catalogue. `reviewed` is shown but does not gate: hiding a finished language
 * until a native speaker is found means most women get English indefinitely,
 * which is the worse of the two failures.
 *
 * What it must never do is imply an accuracy nobody has checked, so an
 * unreviewed language says so on its own row. See ADR-016.
 *
 * `onSave` persists the choice to her account so it follows her across devices.
 */
export default function LanguageSwitcher({
  onSave,
  className = "",
  showUnreviewed = false,
}: {
  onSave?: (code: string) => Promise<void> | void;
  className?: string;
  /** Staff surfaces pass true so a reviewer can actually read the translation. */
  showUnreviewed?: boolean;
}) {
  const { locale, setLocale } = useI18n();
  const [saving, setSaving] = useState("");

  async function choose(code: string) {
    setLocale(code);
    if (!onSave) return;
    setSaving(code);
    try {
      await onSave(code);
    } finally {
      setSaving("");
    }
  }

  return (
    <div className={`grid gap-2 sm:grid-cols-2 ${className}`}>
      {LOCALES.map((l) => {
        const active = l.code === locale;
        // A complete catalogue is enough to offer it. `showUnreviewed` now only
        // controls whether the review note is spelled out at length, which is
        // useful on the staff surface where someone is actually checking.
        const usable = l.translated;
        return (
          <button
            key={l.code}
            onClick={() => usable && choose(l.code)}
            disabled={!usable}
            aria-pressed={active}
            className={`flex items-center gap-3 rounded-xl border-2 px-3.5 py-3 text-start transition ${
              active
                ? "border-brand-500 bg-brand-tint"
                : usable
                  ? "border-line-strong bg-surface hover:border-brand-200"
                  : "cursor-not-allowed border-line bg-surface-inset/60 opacity-60"
            }`}
          >
            <Globe
              className={`h-4 w-4 shrink-0 ${active ? "text-brand-ink" : "text-ink-subtle"}`}
            />
            <span className="min-w-0 flex-1">
              <span
                className={`block truncate font-semibold ${active ? "text-brand-ink" : "text-ink"}`}
                // The name must render in its own script's font, whatever the
                // app's current language is.
                lang={l.code}
                dir={l.dir}
              >
                {l.nativeName}
              </span>
              <span className="block text-xs text-ink-subtle">
                {l.name}
                {!l.translated && " · coming soon"}
                {l.translated && !l.reviewed &&
                  (showUnreviewed
                    ? " · not yet read by a native speaker"
                    : " · new translation")}
              </span>
            </span>
            {saving === l.code ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand-ink" />
            ) : (
              active && <Check className="h-4 w-4 shrink-0 text-brand-ink" />
            )}
          </button>
        );
      })}
    </div>
  );
}
