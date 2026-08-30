"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Palette, TriangleAlert } from "lucide-react";

import { generateScale, isValidColor, makeAccessible } from "./palette";
import { PRESETS } from "./presets";
import { useThemeEngine } from "./ThemeEngineProvider";
import type { ThemeChoice } from "./types";

/**
 * The colour picker.
 *
 * Design decisions worth stating:
 *
 *  · Presets lead. Most people want "make it green", not a hue wheel, and every
 *    preset is contrast-audited so those users cannot pick something unreadable.
 *  · Hovering a preset previews it live across the whole app, and leaving
 *    restores. Choosing a colour from a swatch alone is guesswork.
 *  · The custom picker shows the generated scale, not just the seed, because
 *    the seed is not what most of the interface will actually look like.
 *  · A failing custom colour is corrected, not rejected. Telling someone "no"
 *    about their favourite colour is a bad experience; quietly moving it to the
 *    nearest usable shade of the same hue is a good one — and we say we did it.
 */
export default function ThemePicker({
  onChange,
  compact = false,
}: {
  /** Called after a theme is committed — the host app persists it. */
  onChange?: (theme: ThemeChoice) => void;
  /** Tighter layout for a settings row, rather than a full onboarding screen. */
  compact?: boolean;
}) {
  const { theme, committed, setTheme, preview, audit } = useThemeEngine();
  const [tab, setTab] = useState<"presets" | "custom">("presets");
  const [primary, setPrimary] = useState(committed.primary);
  const [secondary, setSecondary] = useState(committed.secondary);

  useEffect(() => {
    setPrimary(committed.primary);
    setSecondary(committed.secondary);
  }, [committed.primary, committed.secondary]);

  const custom: ThemeChoice = useMemo(
    () => ({ id: "custom", primary, secondary }),
    [primary, secondary],
  );

  const dirty = primary !== committed.primary || secondary !== committed.secondary;

  // While she's on the custom tab and has changed something, the whole app
  // shows her colours live. Leaving the tab or saving clears it.
  useEffect(() => {
    if (tab !== "custom") return;
    if (!dirty) {
      preview(null);
      return;
    }
    if (isValidColor(primary) && isValidColor(secondary)) preview(custom);
  }, [tab, dirty, primary, secondary, custom, preview]);

  const report = useMemo(
    () => (isValidColor(primary) && isValidColor(secondary) ? audit(custom) : null),
    [custom, audit, primary, secondary],
  );

  const problems = [...(report?.primary.problems ?? []), ...(report?.secondary.problems ?? [])];
  const willAdjust =
    problems.length > 0 &&
    !!makeAccessible(primary) &&
    !!makeAccessible(secondary);

  function commit(next: ThemeChoice) {
    setTheme(next);
    onChange?.(next);
  }

  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-xl bg-surface-inset p-1 dark:bg-white/5">
        {(["presets", "custom"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              preview(null);
            }}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold capitalize transition ${
              tab === t
                ? "bg-[var(--surface)] text-ink shadow-sm"
                : "text-ink-subtle hover:text-ink-muted"
            }`}
          >
            {t === "presets" ? "Ready-made" : "Pick my own"}
          </button>
        ))}
      </div>

      {tab === "presets" ? (
        <ul
          className={`grid gap-3 ${compact ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"}`}
        >
          {PRESETS.map((p) => {
            const active = theme.primary === p.primary && theme.secondary === p.secondary;
            const scale = generateScale(p.primary);
            const second = generateScale(p.secondary);
            return (
              <li key={p.id}>
                <button
                  onMouseEnter={() => preview(p)}
                  onMouseLeave={() => preview(null)}
                  onFocus={() => preview(p)}
                  onBlur={() => preview(null)}
                  onClick={() => commit({ id: p.id, primary: p.primary, secondary: p.secondary })}
                  aria-pressed={active}
                  className={`w-full rounded-2xl border p-3 text-start transition hover:-translate-y-0.5 ${
                    active
                      ? "border-transparent ring-2 ring-brand-500"
                      : "border-line-strong hover:border-line-strong dark:border-white/10"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {[scale[600], scale[400], second[600], second[400]].map((c, i) => (
                      <span
                        key={i}
                        className="h-7 flex-1 rounded-lg"
                        style={{ background: c }}
                        aria-hidden
                      />
                    ))}
                  </span>
                  <span className="mt-2.5 flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-ink">{p.name}</span>
                    {active && <Check className="h-3.5 w-3.5 text-brand-ink" />}
                  </span>
                  {!compact && (
                    <span className="mt-0.5 block text-xs text-ink-subtle">{p.description}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="space-y-4">
          {([
            ["Main colour", primary, setPrimary, "Buttons, links, the things you tap"],
            ["Accent colour", secondary, setSecondary, "Highlights and icon backgrounds"],
          ] as const).map(([label, value, set, hint]) => (
            <div key={label}>
              <label className="mb-1.5 block text-sm font-medium text-ink-muted">
                {label}
                <span className="ms-1.5 font-normal text-ink-subtle">— {hint}</span>
              </label>
              <div className="flex items-center gap-2.5">
                <input
                  type="color"
                  value={isValidColor(value) ? value : "#000000"}
                  onChange={(e) => set(e.target.value)}
                  aria-label={label}
                  className="h-11 w-14 shrink-0 cursor-pointer rounded-xl border border-line-strong bg-transparent p-1 dark:border-white/10"
                />
                <input aria-label={`${label} hex value`}
                  type="text"
                  value={value}
                  onChange={(e) => set(e.target.value.trim())}
                  spellCheck={false}
                  className="w-32 rounded-xl border border-line-strong px-3 py-2.5 font-mono text-sm text-ink outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-50 dark:border-white/10 dark:bg-white/5"
                />
                {isValidColor(value) && (
                  <span className="flex min-w-0 flex-1 gap-1" aria-hidden>
                    {[100, 300, 500, 700, 900].map((s) => (
                      <span
                        key={s}
                        className="h-9 flex-1 rounded-lg"
                        style={{ background: generateScale(value)[s as 100] }}
                      />
                    ))}
                  </span>
                )}
              </div>
            </div>
          ))}

          {problems.length > 0 && (
            <p className="flex items-start gap-2 rounded-xl bg-status-warn-bg px-3.5 py-3 text-xs leading-relaxed text-status-warn-ink">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {willAdjust
                ? "That colour is hard to read at this shade — we'll nudge it slightly darker so text stays legible. Your hue is kept."
                : problems[0]}
            </p>
          )}

          <button
            onClick={() => commit(custom)}
            disabled={!isValidColor(primary) || !isValidColor(secondary) || !dirty}
            className="btn btn-primary btn-block"
          >
            <Palette className="h-4 w-4" />
            {dirty ? "Use these colours" : "These are your colours"}
          </button>
        </div>
      )}
    </div>
  );
}
