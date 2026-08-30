"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { applyTheme, readStoredTheme, storeTheme } from "./apply";
import { auditScale, generateScale, makeAccessible, type PaletteReport } from "./palette";
import { DEFAULT_THEME } from "./presets";
import { DEFAULT_TOKEN_NAMES, type ColorMode, type ThemeChoice, type TokenNames } from "./types";

/**
 * The theme engine's React surface.
 *
 * Deliberately unaware of the app around it: it takes an optional
 * `onPersist` callback rather than importing an API client, so dropping this
 * folder into another project needs no edits.
 */

interface ThemeEngineValue {
  /** What the app is currently painted in — the preview if one is active. */
  theme: ThemeChoice;
  /**
   * The saved theme, ignoring any preview.
   *
   * A picker must sync its own inputs from THIS, never from `theme`. Syncing
   * from `theme` means that the moment a preview is cleared, the picker's
   * fields get reset to the old saved colour — which looks exactly like the
   * app throwing away the colour you just chose.
   */
  committed: ThemeChoice;
  /** Change the theme. Persists locally, and calls `onPersist` if one was given. */
  setTheme: (theme: ThemeChoice) => void;
  /** Preview without committing — used while dragging a colour picker. */
  preview: (theme: ThemeChoice | null) => void;
  /** Whether a given pair of seeds is safe to use. */
  audit: (theme: ThemeChoice) => { primary: PaletteReport; secondary: PaletteReport };
  isPreviewing: boolean;
}

const ThemeEngineContext = createContext<ThemeEngineValue | null>(null);

export function useThemeEngine(): ThemeEngineValue {
  const ctx = useContext(ThemeEngineContext);
  if (!ctx) throw new Error("useThemeEngine must be used inside <ThemeEngineProvider>");
  return ctx;
}

/** Watches for the host app's dark-mode class so the palette can follow it. */
function useColorMode(): ColorMode {
  const [mode, setMode] = useState<ColorMode>("light");

  useEffect(() => {
    const read = () =>
      setMode(document.documentElement.classList.contains("dark") ? "dark" : "light");
    read();
    // The dark class is toggled by the host app, not by us — observe rather
    // than own it, so the two systems stay independent.
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return mode;
}

export function ThemeEngineProvider({
  children,
  initial,
  onPersist,
  tokenNames = DEFAULT_TOKEN_NAMES,
}: {
  children: React.ReactNode;
  /** Theme from the server, so the first paint is already right. */
  initial?: ThemeChoice | null;
  /** Called when the user commits a change — e.g. to save it on their account. */
  onPersist?: (theme: ThemeChoice) => void;
  tokenNames?: TokenNames;
}) {
  const mode = useColorMode();
  const [theme, setThemeState] = useState<ThemeChoice>(initial ?? DEFAULT_THEME);
  const [previewTheme, setPreviewTheme] = useState<ThemeChoice | null>(null);

  // Adopt whatever the account says once it loads, unless the user is mid-preview.
  useEffect(() => {
    if (initial && !previewTheme) setThemeState(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.primary, initial?.secondary, initial?.id]);

  // Fall back to local storage when there's no account theme yet (signed out,
  // or mid-onboarding before the first save).
  useEffect(() => {
    if (initial) return;
    const stored = readStoredTheme();
    if (stored) setThemeState(stored);
  }, [initial]);

  // The single effect that paints. Re-runs on theme change AND on mode change,
  // which is what makes dark mode derive rather than need its own choice.
  useEffect(() => {
    applyTheme(previewTheme ?? theme, mode, undefined, tokenNames);
  }, [theme, previewTheme, mode, tokenNames]);

  const setTheme = useCallback(
    (next: ThemeChoice) => {
      // Never store a palette that fails contrast — nudge it to the nearest
      // usable version of the same hue instead of refusing the user's choice.
      const safePrimary = makeAccessible(next.primary)?.seed ?? next.primary;
      const safeSecondary = makeAccessible(next.secondary)?.seed ?? next.secondary;
      const safe: ThemeChoice = { ...next, primary: safePrimary, secondary: safeSecondary };

      setPreviewTheme(null);
      setThemeState(safe);
      storeTheme(safe);
      onPersist?.(safe);
    },
    [onPersist],
  );

  const audit = useCallback(
    (candidate: ThemeChoice) => ({
      primary: auditScale(generateScale(candidate.primary)),
      secondary: auditScale(generateScale(candidate.secondary)),
    }),
    [],
  );

  const value = useMemo<ThemeEngineValue>(
    () => ({
      theme: previewTheme ?? theme,
      committed: theme,
      setTheme,
      preview: setPreviewTheme,
      audit,
      isPreviewing: previewTheme !== null,
    }),
    [theme, previewTheme, setTheme, audit],
  );

  return <ThemeEngineContext.Provider value={value}>{children}</ThemeEngineContext.Provider>;
}
