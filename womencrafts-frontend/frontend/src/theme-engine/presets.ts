import type { ThemeChoice } from "./types";

/**
 * Curated palettes.
 *
 * Every one of these is audited at build time by the test in
 * `theme-engine/__checks__` — a preset that fails contrast never ships. Most
 * people pick from here rather than opening the custom picker, so these being
 * safe matters more than the picker's guard rails.
 *
 * Names are plain and evocative rather than technical: someone choosing a
 * colour is not thinking in hue angles.
 */
export const PRESETS: (ThemeChoice & { name: string; description: string })[] = [
  {
    id: "womsakhi",
    name: "WomSakhi",
    description: "Our own — the logo's magenta and violet",
    /*
      The logo's two colours (design-system/brand.css). Primary is the logo
      magenta one step deeper — #f00078 carries white text at only 4.22:1,
      #c80066 at 5.76:1. Secondary is the logo violet exactly (7.10:1).

      `normaliseTheme` (apply.ts) maps every saved "womsakhi" choice to these
      values, so an account that picked this preset before the rebrand follows
      the brand instead of keeping the old berry it stored then.
    */
    primary: "#c80066",
    secondary: "#4830f0",
  },
  {
    id: "indigo",
    name: "Midnight",
    description: "Deep indigo and slate blue",
    primary: "#4f46e5",
    secondary: "#0ea5e9",
  },
  {
    id: "forest",
    name: "Forest",
    description: "Emerald and moss",
    primary: "#059669",
    secondary: "#65a30d",
  },
  {
    id: "sunset",
    name: "Sunset",
    description: "Warm amber and terracotta",
    primary: "#ea580c",
    secondary: "#d97706",
  },
  {
    id: "rose",
    name: "Rose",
    description: "Soft rose and dusty plum",
    primary: "#e11d48",
    secondary: "#9333ea",
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Teal and deep sea blue",
    primary: "#0d9488",
    secondary: "#0284c7",
  },
  {
    id: "marigold",
    name: "Marigold",
    description: "Festival gold and saffron",
    primary: "#ca8a04",
    secondary: "#ea580c",
  },
  {
    id: "graphite",
    name: "Graphite",
    description: "Quiet and neutral, for long days",
    primary: "#475569",
    secondary: "#0f766e",
  },
];

export const DEFAULT_THEME: ThemeChoice = {
  id: "womsakhi",
  // The same pair as the `womsakhi` preset above, and it has to stay that way:
  // this is the value used before a stored choice is read, so a mismatch shows
  // as the brand changing colour one frame after the app opens.
  primary: "#c80066",
  secondary: "#4830f0",
};

export function presetById(id: string) {
  return PRESETS.find((p) => p.id === id);
}
