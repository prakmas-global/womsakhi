"use client";

import { useState } from "react";

import { apiUpdateMeProfile } from "@/lib/member-api";
import { useAction } from "@/lib/use-action";
import * as Icons from "@/components/ux/icons";

import { useI18n } from "@/i18n";
import { LOCALES } from "@/i18n/locales";
import { Btn, Pill } from "@/components/ux/kit";
import { Card, SectionHead, SettingsPage } from "@/components/ux/settings/Frame";

/**
 * Language.
 *
 * Each option is written in its OWN script, not transliterated — a woman
 * looking for Telugu is looking for తెలుగు, and "Telugu" in Latin letters is
 * exactly the barrier this screen exists to remove.
 *
 * It also sets the language Sakhi speaks, which is stated here rather than
 * hidden in her settings: they are one choice as far as anyone using this is
 * concerned.
 */
export default function LanguageSettings() {
  const { locale, setLocale } = useI18n();
  const [picked, setPicked] = useState(locale);
  const [saved, setSaved] = useState(false);

  /**
   * Apply it here, and keep it on her account.
   *
   * This only called `setLocale`, which changes the language in this browser.
   * Her account carries a `locale` — the user model's own comment says it
   * "follows them across devices" — and nothing was writing it, so signing in
   * on a borrowed phone, or on the computer at the centre, put her back into
   * English every time.
   */
  const apply = useAction(
    async () => {
      setLocale(picked);
      await apiUpdateMeProfile({ locale: picked });
    },
    {
      onDone: () => setSaved(true),
      // The screen has already changed language by the time this shows, which
      // is honest: what failed is the remembering, not the change.
      fallbackError: "Changed here, but we could not save it to your account. It may go back on another device.",
    },
  );

  return (
    <SettingsPage
      title="Language"
      sub="Changes everything on screen, and the language Sakhi speaks and writes in."
      footer={
        <div className="flex items-center justify-between gap-4">
          <p className="text-[0.75rem]"
             style={{ color: apply.error ? "var(--ux-orange-ink)" : saved ? "var(--ux-green-ink)" : "var(--ux-faint)" }}>
            {apply.error ? apply.error
              : saved ? "Saved. The app is now in your chosen language."
              : picked !== locale ? "Not saved yet." : "This is your current language."}
          </p>
          <Btn variant="primary" icon={apply.busy ? "Loader" : "Check"}
               disabled={apply.busy || (picked === locale && saved)}
               onClick={() => void apply.run()}>
            Use this language
          </Btn>
        </div>
      }
    >
      <Card>
        <SectionHead title="Choose a language" sub={`${LOCALES.length} available`} />
        <div className="ux-deck grid grid-cols-2 gap-2.5">
          {LOCALES.map((l, i) => {
            const on = picked === l.code;
            return (
              <button
                key={l.code}
                onClick={() => { setPicked(l.code); setSaved(false); }}
                aria-pressed={on}
                dir={l.dir}
                className="ux-i ux-sq flex items-center gap-3 rounded-[12px] border p-3.5 text-start"
                style={{
                  borderColor: on ? "var(--ux-brand)" : "var(--ux-line)",
                  background: on ? "var(--ux-brand-tint)" : "var(--ux-surface)",
                  ["--i" as string]: i,
                }}
              >
                <span className="min-w-0 flex-1">
                  {/* Her language in her own script — the whole point. */}
                  <span className="block truncate text-[1rem] font-semibold" style={{ color: "var(--ux-ink)" }}>
                    {l.nativeName}
                  </span>
                  <span className="mt-0.5 block truncate text-[0.75rem]" style={{ color: "var(--ux-muted)" }}>
                    {l.name}{l.dir === "rtl" ? " · right to left" : ""}
                  </span>
                </span>
                {!l.reviewed && <Pill tone="orange" size="sm">In progress</Pill>}
                {on && <Icons.Check className="ux-pop h-[18px] w-[18px] shrink-0" style={{ color: "var(--ux-brand)" }} strokeWidth={2.8} />}
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <SectionHead title="What this changes" icon="Info" />
        <ul className="space-y-2.5">
          {[
            "Every word on every screen.",
            "The language Sakhi listens in, replies in, and speaks aloud.",
            "Emails and text messages we send you.",
          ].map((t) => (
            <li key={t} className="flex items-start gap-2.5 text-[0.8125rem] leading-snug" style={{ color: "var(--ux-ink-2)" }}>
              <Icons.Check className="mt-[2px] h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-green-ink)" }} strokeWidth={2.6} />
              {t}
            </li>
          ))}
        </ul>
        <p className="mt-3.5 text-[0.75rem] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
          Course videos and what other women have written stay in the language they were made in.
        </p>
      </Card>
    </SettingsPage>
  );
}
