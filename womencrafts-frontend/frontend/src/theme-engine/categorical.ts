import { converter, formatHex, parse } from "culori";

import { contrast } from "./palette";
import type { ColorMode } from "./types";

/**
 * The categorical palette — colours that only need to mean "different".
 *
 * Service types, activity areas, donut slices. These aren't status colours
 * (green = good) and they aren't the brand; they exist purely so a reader can
 * tell one row from another.
 *
 * The old approach picked from a fixed list — brand, violet, amber, sky,
 * emerald. Under an amber theme the "brand" tone BECAME amber, so two
 * categories rendered nearly identically and the list stopped being scannable.
 *
 * So they're generated instead: N hues spread evenly around the wheel starting
 * from the theme's own primary. That guarantees two things a fixed list can't —
 * every category is maximally distinct from its neighbours, and the whole set
 * still belongs to the chosen theme.
 */

const toOklch = converter("oklch");
const toRgb = converter("rgb");

/** How many distinct categories we can colour before repeating. */
export const CATEGORY_SLOTS = 8;

/**
 * A stable slot for a name.
 *
 * Hashed rather than indexed by position, so adding a category doesn't
 * re-colour every existing one — "Beauty" keeps its colour forever.
 */
export function categorySlot(name: string): number {
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return (hash % CATEGORY_SLOTS) + 1;
}

function at(hue: number, l: number, c: number): string {
  return formatHex(toRgb({ mode: "oklch", l, c, h: ((hue % 360) + 360) % 360 })) ?? "#888888";
}

/**
 * `--cat-N` (solid, for chart slices), `--cat-N-soft` (badge background) and
 * `--cat-N-ink` (badge text, guaranteed readable on its own soft background).
 */
export function categoricalVariables(primarySeed: string, mode: ColorMode): Record<string, string> {
  const base = toOklch(parse(primarySeed));
  const startHue = base?.h ?? 0;
  const vars: Record<string, string> = {};

  // The golden-angle-ish step. A plain 360/8 = 45° leaves neighbours in the
  // same visual family; 137.5° scatters them so adjacent rows never look alike.
  const STEP = 137.5;

  for (let i = 0; i < CATEGORY_SLOTS; i++) {
    const hue = startHue + STEP * i;
    const n = i + 1;

    if (mode === "light") {
      const solid = at(hue, 0.55, 0.17);
      const soft = at(hue, 0.945, 0.045);
      vars[`--cat-${n}`] = solid;
      vars[`--cat-${n}-soft`] = soft;
      // Text on the soft chip: walk darker until it's comfortably readable.
      vars[`--cat-${n}-ink`] = inkFor(hue, soft, 0.45);
    } else {
      const solid = at(hue, 0.68, 0.15);
      const soft = at(hue, 0.29, 0.06);
      vars[`--cat-${n}`] = solid;
      vars[`--cat-${n}-soft`] = soft;
      vars[`--cat-${n}-ink`] = inkFor(hue, soft, 0.82, true);
    }
  }
  return vars;
}

/** Find a lightness on this hue that reads clearly against the chip background. */
function inkFor(hue: number, background: string, start: number, lighten = false): string {
  for (let step = 0; step <= 40; step++) {
    const l = lighten ? Math.min(0.98, start + step * 0.01) : Math.max(0.15, start - step * 0.01);
    const candidate = at(hue, l, 0.13);
    if (contrast(candidate, background) >= 4.5) return candidate;
  }
  return lighten ? "#ffffff" : "#111111";
}
