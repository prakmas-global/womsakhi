"use client";

import { Check, Moon, Palette, Sun, SunMoon } from "lucide-react";

import AdminPage from "@/components/admin/AdminPage";
import { Card, useToast } from "@/design-system";
import { useTheme } from "@/context/ThemeContext";
import { ResizableColumns } from "@/layout-engine";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { apiUpdateMyLocale } from "@/lib/org-api";

/**
 * Appearance, staff side.
 *
 * Per staff member, not platform-wide: this is their workspace for eight hours
 * a day, and one person's preference shouldn't be imposed on the whole team.
 */
export default function AdminAppearancePage() {
  const toast = useToast();
  const { theme: mode, setTheme: setMode } = useTheme();

  const flash = () => {
    toast.success("Saved");
  };

  return (
    <AdminPage
      title="Appearance"
      subtitle="The dashboard wears the WomSakhi design system, the same one members see. Light or dark is remembered on this device only."
    >

      <ResizableColumns id="settings-appearance" defaultSize={0.74} className="gap-4">
        <Card>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
              <Palette className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-base font-bold text-ink">Colours</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                The dashboard uses the WomSakhi design system: the warm cream canvas, white cards,
                the Berry brand and the same type as the member app, so the product a woman signs
                into and the one you run it from are one product. There is no palette to pick
                here; the one thing that is yours is light or dark.
              </p>
            </div>
          </div>
        </Card>

        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-tint text-violet-ink">
                <SunMoon className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-display text-base font-bold text-ink">Light or dark</h2>
                <p className="text-xs text-ink-subtle">Remembered on this device; colours adjust to match</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["light", Sun, "Light"],
                  ["dark", Moon, "Dark"],
                  ["system", SunMoon, "System"],
                ] as const
              ).map(([value, Icon, label]) => {
                const active = mode === value;
                return (
                  <button
                    key={value}
                    onClick={() => setMode(value)}
                    aria-pressed={active}
                    className={`flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-xs font-semibold transition ${
                      active
                        ? "border-brand-500 bg-brand-tint text-brand-ink"
                        : "border-line-strong text-ink-muted hover:border-line-strong dark:border-white/10"
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5" />
                    {label}
                    {active && <Check className="h-3 w-3" />}
                  </button>
                );
              })}
            </div>
          </Card>

          {/*
            The review surface for translations.

            A catalogue that has been written but not checked is offered here
            and nowhere else: staff can switch into it, read the app, and flip
            `reviewed` in i18n/locales.ts once it is right. Members never see an
            unchecked language — see LanguageSwitcher.
          */}
          <Card>
            <h3 className="text-sm font-semibold text-ink">Language</h3>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              Languages marked <em>not yet checked</em> have a full translation that no
              native speaker has read. Switch to one to review it — members are not
              offered it until it is marked as checked.
            </p>
            <LanguageSwitcher
              className="mt-3 sm:grid-cols-1"
              showUnreviewed
              onSave={async (code) => {
                await apiUpdateMyLocale(code);
              }}
            />
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-ink">How this works</h3>
            <ul className="mt-2 space-y-2 text-xs leading-relaxed text-ink-muted">
              <li>
                Your choice applies to your account only — the rest of the team keep theirs.
              </li>
              <li>
                Every shade is generated from your two colours and checked for readability before
                it&apos;s applied.
              </li>
              <li>
                You can set a member&apos;s colours for her from her profile in Users, if she asks
                for help on a call.
              </li>
              <li>The WomSakhi logo keeps its own colours so it stays recognisable.</li>
            </ul>
          </Card>
        </div>
      </ResizableColumns>
    </AdminPage>
  );
}
