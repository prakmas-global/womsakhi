/**
 * WomSakhi theme engine — a portable runtime colour system.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * Using this in another project
 * ────────────────────────────────────────────────────────────────────────────
 * 1. Copy this folder. It imports nothing from the app around it, only `culori`
 *    and `lucide-react`.
 * 2. Your CSS must define its palette as CSS custom properties that utilities
 *    reference — Tailwind v4's `@theme` does this for free:
 *        .bg-brand-600 { background-color: var(--color-brand-600) }
 * 3. Render <ThemeStyle /> in the server layout's <head> (kills the flash) and
 *    wrap the tree in <ThemeEngineProvider>.
 * 4. Drop <ThemePicker /> wherever the user should choose.
 * 5. Different token names? Pass `tokenNames={{ primary: "--color-primary",
 *    secondary: "--color-accent" }}` to both.
 *
 * The engine derives everything from two seed colours: twenty shades, the dark
 * variants, and the readable foreground for each. Derived values can't drift.
 */

export { default as ThemePicker } from "./ThemePicker";

// ThemeStyle is deliberately NOT re-exported here. It uses next/headers, which
// is server-only, and this barrel is imported by client components — a single
// re-export drags the server module into every client bundle and breaks the app
// at runtime. Server code imports it directly:
//     import ThemeStyle from "@/theme-engine/ThemeStyle";
export { ThemeEngineProvider, useThemeEngine } from "./ThemeEngineProvider";

export {
  applyTheme,
  clearTheme,
  readStoredTheme,
  storeTheme,
  themeToVariables,
  THEME_STORAGE_KEY,
} from "./apply";

export {
  AA_LARGE,
  AA_NORMAL,
  AA_UI,
  auditScale,
  contrast,
  darkVariant,
  generateScale,
  isValidColor,
  makeAccessible,
  readableOn,
  STEPS,
} from "./palette";
export type { PaletteReport, Scale, Step } from "./palette";

export { CATEGORY_SLOTS, categorySlot, categoricalVariables } from "./categorical";
export { DEFAULT_THEME, PRESETS, presetById } from "./presets";
export { DEFAULT_TOKEN_NAMES } from "./types";
export type { ColorMode, ThemeChoice, TokenNames } from "./types";
