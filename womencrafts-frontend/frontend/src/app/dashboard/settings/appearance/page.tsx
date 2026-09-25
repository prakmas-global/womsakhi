"use client";

import { Check, Moon, Palette, RotateCcw, Sun, SunMoon } from "lucide-react";

import AdminPage from "@/components/admin/AdminPage";
import { Card, useToast } from "@/design-system";
import { useTheme } from "@/context/ThemeContext";
import { DEFAULT_THEME, ThemePicker, useThemeEngine } from "@/theme-engine";
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
  const { theme, setTheme } = useThemeEngine();
  const { theme: mode, setTheme: setMode } = useTheme();

  const flash = () => {
    toast.success("Saved");
  };

  const isDefault =
    theme.primary === DEFAULT_THEME.primary && theme.secondary === DEFAULT_THEME.secondary;

  return (
    <AdminPage
      title="Appearance"
      subtitle="Your colours and brightness. Saved to your account, so the dashboard looks the same wherever you sign in."
    >

      <ResizableColumns id="settings-appearance" defaultSize={0.74} className="gap-4">
        <Card>
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
              <Palette className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-base font-bold text-ink">Colours</h2>
              <p className="text-xs text-ink-subtle">
                Hover to preview across the whole dashboard.
              </p>
            </div>
            {!isDefault && (
              <button
                onClick={() => {
                  setTheme(DEFAULT_THEME);
                  flash();
                }}
                className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-ink-subtle transition hover:text-ink-muted"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            )}
          </div>
          <ThemePicker onChange={flash} />
        </Card>

        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-tint text-violet-ink">
                <SunMoon className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-display text-base font-bold text-ink">Light or dark</h2>
                <p className="text-xs text-ink-subtle">Colours adjust to match</p>
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
