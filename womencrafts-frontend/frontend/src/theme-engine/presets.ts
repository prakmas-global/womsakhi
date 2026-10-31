import type { ThemeChoice } from "./types";
import type { Scale } from "./palette";

// Exact default UI colours: generated seed scales otherwise lighten the wine.
export const DEFAULT_PRIMARY_SCALE: Scale = {50:"#f9f0f3",100:"#f3dad7",200:"#e8b7c6",300:"#d49caf",400:"#bb7892",500:"#a55168",600:"#742a4f",700:"#62223f",800:"#521e38",900:"#351424"};
export const DEFAULT_SECONDARY_SCALE: Scale = {50:"#f7f1fb",100:"#eee2f4",200:"#dbc5e6",300:"#c3a0d4",400:"#a375b8",500:"#89559e",600:"#6f35a5",700:"#5d2d8b",800:"#4b246f",900:"#34194d"};

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
    name: "WomSakhi · Grape wine",
    description: "Grape wine, soft rose and warm cream",
    primary: "#742a4f",
    secondary: "#6f35a5",
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
  primary: "#742a4f",
  secondary: "#6f35a5",
};

export function presetById(id: string) {
  return PRESETS.find((p) => p.id === id);
}
