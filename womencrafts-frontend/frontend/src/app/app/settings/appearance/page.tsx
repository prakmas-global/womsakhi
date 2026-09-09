"use client";

import * as Icons from "@/components/ux/icons";

import { useDevicePref } from "@/lib/use-device-pref";

import { useTheme } from "@/context/ThemeContext";
import { Card, SectionHead, SettingsPage, Toggle } from "@/components/ux/settings/Frame";
import { useT } from "@/i18n";

/**
 * Appearance.
 *
 * Each theme is shown as a small picture of itself rather than a colour swatch
 * — a two-line preview of the real thing tells her more than the word "Dark"
 * ever will, and it changes the moment she picks one.
 */
export default function AppearanceSettings() {
  const tr = useT();
  const { theme, setTheme } = useTheme();
  const [bigText, setBigText] = useDevicePref("appearance.bigText", false);
  const [lessMotion, setLessMotion] = useDevicePref("appearance.lessMotion", false);

  const OPTIONS = [
    { id: "light" as const, label: "Light", note: "Best in daylight and outdoors", scopes: ["ux"] },
    { id: "dark" as const, label: "Dark", note: "Easier at night, and on the eyes", scopes: ["ux dark"] },
    { id: "system" as const, label: "Follow my phone", note: "Changes with your phone's setting",
      scopes: ["ux", "ux dark"] },
  ];

  return (
    <SettingsPage title="Appearance" sub={tr("settingsAppearance.changesStraightAwayNothingToSave")}>
      <Card>
        <SectionHead title="Theme" />
        <div className="ux-deck grid grid-cols-3 gap-[12px]">
          {OPTIONS.map((o, i) => {
            const on = theme === o.id;
            return (
              <button
                key={o.id}
                onClick={() => setTheme(o.id)}
                aria-pressed={on}
                className="ux-i ux-sq overflow-hidden rounded-[12px] border text-start"
                style={{
                  borderColor: on ? "var(--ux-brand)" : "var(--ux-line)",
                  borderWidth: on ? 2 : 1,
                  ["--i" as string]: i,
                }}
              >
                {/*
                  * A picture of the theme, not a swatch — she is choosing how
                  * the app will look, so show her the app.
                  *
                  * The preview carries the theme's own scope class and paints
                  * itself from `var(--ux-*)`, so the dark tile renders in dark
                  * while she is sitting in light. Written as literal hex before,
                  * which meant nine values copied out of tokens.css that would
                  * drift silently the first time a token changed. "Follow my
                  * phone" is two half-width scopes side by side, which is
                  * literally what it does.
                  */}
                <span className="flex" aria-hidden>
                  {o.scopes.map((scope) => (
                    <span key={scope} className={`${scope} block flex-1 p-3`} style={{ background: "var(--ux-surface)" }}>
                      <span className="mb-2 block h-[7px] w-[34px] rounded-full"
                            style={{ background: "var(--ux-ink)", opacity: 0.7 }} />
                      <span className="block rounded-[8px] p-2"
                            style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line)" }}>
                        <span className="block h-[5px] w-[70%] rounded-full"
                              style={{ background: "var(--ux-ink)", opacity: 0.55 }} />
                        <span className="mt-1.5 block h-[5px] w-[45%] rounded-full"
                              style={{ background: "var(--ux-ink)", opacity: 0.28 }} />
                      </span>
                    </span>
                  ))}
                </span>
                <span className="flex items-center gap-2 px-3.5 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xsm font-semibold" style={{ color: "var(--ux-ink)" }}>
                      {o.label}
                    </span>
                    <span className="mt-0.5 block truncate text-2xs" style={{ color: "var(--ux-muted)" }}>
                      {o.note}
                    </span>
                  </span>
                  {on && <Icons.CheckCircle2 className="ux-pop h-[18px] w-[18px] shrink-0" style={{ color: "var(--ux-brand)" }} />}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <SectionHead title={tr("settingsAppearance.makingItEasierToUse")} />
        <div className="divide-y" style={{ borderColor: "var(--ux-line)" }}>
          <Toggle
            on={bigText} onChange={setBigText}
            label={tr("settingsAppearance.biggerText")}
            whenOn="Everything is a size larger. Some cards will be taller."
            whenOff="Text is at the normal size."
          />
          <Toggle
            on={lessMotion} onChange={setLessMotion}
            label={tr("settingsAppearance.lessMovement")}
            whenOn="Cards and pages appear instead of sliding. Nothing else changes."
            whenOff="Cards lift and pages slide as you move around."
          />
        </div>
        <p className="mt-3.5 flex items-start gap-2.5 rounded-[12px] p-3 text-xs leading-relaxed"
           style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>
          <Icons.Info className="mt-[1px] h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-brand)" }} />{tr("settingsAppearance.ifYourPhoneIsAlreadySet")}</p>
      </Card>
    </SettingsPage>
  );
}
