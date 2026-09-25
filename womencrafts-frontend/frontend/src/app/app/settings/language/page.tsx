"use client";

import { useState } from "react";

import { apiUpdateMeProfile } from "@/lib/member-api";
import { useAuth } from "@/context/AuthContext";
import { useAction } from "@/lib/use-action";
import * as Icons from "@/components/ux/icons";

import { useI18n, useT } from "@/i18n";
import { LOCALES } from "@/i18n/locales";
import { Btn, Pill } from "@/components/ux/kit";
import { SettingsPage } from "@/components/ux/settings/Frame";
import { ListRow } from "@/components/ux/mobile/ListRow";
import { phonePrimary } from "@/components/ux/PhoneParts";
import { Group, SaveBar } from "../_parts/Group";

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
  const tr = useT();
  const { locale, setLocale } = useI18n();
  const { user, updateUser } = useAuth();
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
      if (user) updateUser({ ...user, locale: picked });
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
      sub={tr("settingsLanguage.changesEverythingOnScreenAndThe")}
      footer={
        <SaveBar tone={apply.error ? "--ux-orange-ink" : saved ? "--ux-green-ink" : "--ux-faint"}
                 status={apply.error ? apply.error
                   : saved ? "Saved. The app is now in your chosen language."
                   : picked !== locale ? tr("settingsLanguage.notSavedYet")
                   : tr("settingsLanguage.thisIsYourCurrentLanguage")}>
          <Btn variant="primary" icon={apply.busy ? "Loader" : "Check"} className={phonePrimary}
               disabled={apply.busy || (picked === locale && saved)}
               onClick={() => void apply.run()}>{tr("settingsLanguage.useThisLanguage")}</Btn>
        </SaveBar>
      }
    >
      {/*
        On a phone the two-column grid of bordered tiles is a grouped list —
        one row per language, her own script as the title, a checkmark on the
        one picked. It is the shape every phone's own language setting uses.
      */}
      <Group
        title={tr("settingsLanguage.chooseALanguage")}
        sub={`${LOCALES.length} available`}
        inset="flush"
        phone={LOCALES.map((l) => (
          <ListRow
            key={l.code}
            title={<span dir={l.dir}>{l.nativeName}</span>}
            subtitle={`${l.name}${l.dir === "rtl" ? " · right to left" : ""}`}
            selected={picked === l.code}
            onClick={() => { setPicked(l.code); setSaved(false); }}
            trailing={!l.reviewed ? <Pill tone="orange" size="sm">{tr("settingsLanguage.inProgress")}</Pill> : undefined}
          />
        ))}
      >
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
                  <span className="block truncate text-base font-semibold" style={{ color: "var(--ux-ink)" }}>
                    {l.nativeName}
                  </span>
                  <span className="mt-0.5 block truncate text-xs" style={{ color: "var(--ux-muted)" }}>
                    {l.name}{l.dir === "rtl" ? " · right to left" : ""}
                  </span>
                </span>
                {!l.reviewed && <Pill tone="orange" size="sm">{tr("settingsLanguage.inProgress")}</Pill>}
                {on && <Icons.Check className="ux-pop h-[18px] w-[18px] shrink-0" style={{ color: "var(--ux-brand)" }} strokeWidth={2.8} />}
              </button>
            );
          })}
        </div>
      </Group>

      <Group title={tr("settingsLanguage.whatThisChanges")} icon="Info" inset="form">
        <ul className="space-y-2.5">
          {[
            "Every word on every screen.",
            "The language Sakhi listens in, replies in, and speaks aloud.",
            "Emails and text messages we send you.",
          ].map((t) => (
            <li key={t} className="flex items-start gap-2.5 text-xsm leading-snug" style={{ color: "var(--ux-ink-2)" }}>
              <Icons.Check className="mt-[2px] h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-green-ink)" }} strokeWidth={2.6} />
              {t}
            </li>
          ))}
        </ul>
        <p className="mt-3.5 text-[13px] leading-snug lg:text-xs lg:leading-relaxed" style={{ color: "var(--ux-muted)" }}>{tr("settingsLanguage.courseVideosAndWhatOtherWomen")}</p>
      </Group>
    </SettingsPage>
  );
}
