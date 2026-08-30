import { STEPS, darkVariant, generateScale, readableOn } from "./palette";
import { categoricalVariables } from "./categorical";
import { surfaceVariables } from "./surfaces";
import { DEFAULT_TOKEN_NAMES, type ColorMode, type ThemeChoice, type TokenNames } from "./types";

/**
 * Writing a theme onto the document.
 *
 * This is the whole trick, and it is small: Tailwind v4 compiles
 * `bg-brand-600` to `background-color: var(--color-brand-600)`, so setting that
 * one variable on :root recolours every usage in the app at once — no rebuild,
 * no re-render, no class swapping. 929 utility usages follow from 20 variables.
 */

/** Every CSS variable a theme sets, as a plain object. Used by the SSR script too. */
export function themeToVariables(
  theme: ThemeChoice,
  mode: ColorMode,
  names: TokenNames = DEFAULT_TOKEN_NAMES,
): Record<string, string> {
  const vars: Record<string, string> = {};

  for (const [seed, prefix] of [
    [theme.primary, names.primary],
    [theme.secondary, names.secondary],
  ] as const) {
    const light = generateScale(seed);
    const scale = mode === "dark" ? darkVariant(light) : light;
    for (const step of STEPS) {
      vars[`${prefix}-${step}`] = scale[step];
    }
    // The bare token (e.g. --color-brand) is the one non-numbered alias the
    // design system exposes; keep it pointing at the same step it always did.
    vars[prefix] = scale[600];
    // Foreground that stays readable on the primary action colour, whatever
    // hue was chosen. Without this a yellow theme gets white-on-yellow buttons.
    vars[`${prefix}-contrast`] = readableOn(scale[600]);
  }

  // The rest of the look and feel — canvas, panels, borders, shadows, focus
  // rings, scrollbars, chart furniture — all derived from the same hues. Without
  // this the app is themed accents inside an unthemed shell.
  Object.assign(vars, surfaceVariables(theme.primary, theme.secondary, mode));

  // Colours that only need to mean "different" — service types, chart slices.
  // Generated so they can never collide with each other or with the brand.
  Object.assign(vars, categoricalVariables(theme.primary, mode));

  return vars;
}

/** Apply a theme to a document (or any element, for a scoped preview). */
export function applyTheme(
  theme: ThemeChoice,
  mode: ColorMode,
  target?: HTMLElement,
  names: TokenNames = DEFAULT_TOKEN_NAMES,
): void {
  if (typeof document === "undefined") return;
  const el = target ?? document.documentElement;
  const vars = themeToVariables(theme, mode, names);
  for (const [key, value] of Object.entries(vars)) {
    el.style.setProperty(key, value);
  }
}

/** Remove every variable this engine sets, falling back to the stylesheet. */
export function clearTheme(target?: HTMLElement, names: TokenNames = DEFAULT_TOKEN_NAMES): void {
  if (typeof document === "undefined") return;
  const el = target ?? document.documentElement;
  for (const prefix of [names.primary, names.secondary]) {
    for (const step of STEPS) el.style.removeProperty(`${prefix}-${step}`);
    el.style.removeProperty(prefix);
    el.style.removeProperty(`${prefix}-contrast`);
  }
  for (const key of Object.keys(surfaceVariables("#000000", "#000000", "light"))) {
    el.style.removeProperty(key);
  }
  for (const key of Object.keys(surfaceVariables("#000000", "#000000", "dark"))) {
    el.style.removeProperty(key);
  }
  for (const key of Object.keys(categoricalVariables("#000000", "light"))) {
    el.style.removeProperty(key);
  }
}

export const THEME_STORAGE_KEY = "wc-theme";

/** Read the saved theme without throwing in a private-mode browser. */
export function readStoredTheme(): ThemeChoice | null {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.primary && parsed?.secondary ? (parsed as ThemeChoice) : null;
  } catch {
    return null;
  }
}

export function storeTheme(theme: ThemeChoice): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
    // A cookie as well as localStorage: the no-flash script runs before React
    // and the server needs it for the first paint.
    document.cookie = `${THEME_STORAGE_KEY}=${encodeURIComponent(
      JSON.stringify(theme),
    )};path=/;max-age=31536000;samesite=lax`;
  } catch {
    /* storage disabled — the theme still applies for this session */
  }
}
