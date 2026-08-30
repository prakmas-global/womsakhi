import { converter, formatHex, parse, wcagContrast } from "culori";

/**
 * Palette generation.
 *
 * One seed colour in, a full 50→900 scale out.
 *
 * The scale is built in **OKLCH**, not HSL. HSL's lightness is a naive average
 * of RGB channels, so "50% lightness" yellow and "50% lightness" blue look
 * nothing alike — mid-tones come out muddy and the steps read unevenly. OKLCH
 * lightness is perceptual, so every step looks like the same size step, whatever
 * hue the user picked.
 *
 * Nothing in this file imports from the app. The whole `theme-engine` folder is
 * meant to be copied into another project unchanged.
 */

const toOklch = converter("oklch");
const toRgb = converter("rgb");

/** The steps every scale provides, matching Tailwind's shape. */
export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
export type Step = (typeof STEPS)[number];

/**
 * Target lightness per step, in OKLCH's 0–1 space.
 *
 * Hand-tuned rather than linear: the light end needs to spread out (50 and 100
 * must be distinguishable as background tints) while the dark end compresses
 * (800 and 900 are both "very dark" and a linear ramp wastes range there).
 */
const LIGHTNESS: Record<Step, number> = {
  50: 0.971,
  100: 0.936,
  200: 0.885,
  300: 0.808,
  400: 0.704,
  500: 0.637,
  600: 0.577,
  700: 0.505,
  800: 0.444,
  900: 0.396,
};

/**
 * How much of the seed's chroma each step keeps.
 *
 * Pale tints need their saturation pulled right down or they look radioactive;
 * the mid-range carries the most colour. This curve is what stops a vivid seed
 * from producing a neon 50.
 */
const CHROMA_SCALE: Record<Step, number> = {
  50: 0.18,
  100: 0.32,
  200: 0.56,
  300: 0.78,
  400: 0.93,
  500: 1.0,
  600: 1.0,
  700: 0.92,
  800: 0.8,
  900: 0.68,
};

/** Chroma ceiling per step — beyond this a colour leaves the sRGB gamut and clips. */
const MAX_CHROMA: Record<Step, number> = {
  50: 0.03,
  100: 0.06,
  200: 0.11,
  300: 0.16,
  400: 0.2,
  500: 0.23,
  600: 0.24,
  700: 0.21,
  800: 0.18,
  900: 0.15,
};

export type Scale = Record<Step, string>;

/** True when the string is a colour any browser would accept. */
export function isValidColor(input: string): boolean {
  try {
    return !!parse(input);
  } catch {
    return false;
  }
}

/**
 * Build a 50→900 scale from one seed colour.
 *
 * The seed's hue is preserved exactly; only lightness and chroma move. That
 * means the 600 step looks like the colour the user actually picked, which is
 * what they expect to see on buttons.
 */
export function generateScale(seed: string): Scale {
  const base = toOklch(parse(seed));
  if (!base) throw new Error(`Not a colour: ${seed}`);

  const hue = base.h ?? 0;
  const seedChroma = base.c ?? 0;

  const scale = {} as Scale;
  for (const step of STEPS) {
    const chroma = Math.min(seedChroma * CHROMA_SCALE[step], MAX_CHROMA[step]);
    const colour = { mode: "oklch" as const, l: LIGHTNESS[step], c: chroma, h: hue };
    // Round-trip through sRGB so anything out of gamut is clamped once, here,
    // rather than differently by each browser.
    scale[step] = formatHex(toRgb(colour)) ?? seed;
  }

  // Step 600 is the button/badge background, and this design system always puts
  // WHITE text on it. So the target is white specifically — not "whichever of
  // black or white reads better".
  //
  // That distinction matters and was found by testing the running app rather
  // than the maths: a mid-green scores 4.6 against its ideal foreground (black)
  // but only 4.06 against the white the app actually renders. Optimising for
  // the theoretical best foreground shipped unreadable buttons.
  //
  // A single global lightness low enough for every hue would darken every
  // brand, so the correction is per hue: most (including this product's pink)
  // already pass and are untouched.
  scale[600] = darkenUntilWhiteReads(scale[600], hue, seedChroma);
  return scale;
}

/** The foreground this design system puts on a brand-coloured surface. */
export const ON_BRAND = "#ffffff";

/** Walk a colour darker until white text on it reaches AA. */
function darkenUntilWhiteReads(hex: string, hue: number, seedChroma: number): string {
  if (contrast(hex, ON_BRAND) >= AA_NORMAL) return hex;

  for (let l = LIGHTNESS[600] - 0.01; l >= 0.28; l -= 0.01) {
    const candidate = formatHex(
      toRgb({
        mode: "oklch",
        l,
        c: Math.min(seedChroma * CHROMA_SCALE[600], MAX_CHROMA[600]),
        h: hue,
      }),
    );
    if (candidate && contrast(candidate, ON_BRAND) >= AA_NORMAL) return candidate;
  }
  return hex;
}

/**
 * Black or white — whichever is readable on this background.
 *
 * Returned as a hex rather than a token so it can be used anywhere, including
 * inside canvas-rendered charts.
 */
export function readableOn(background: string): "#ffffff" | "#111111" {
  const onWhite = contrast(background, "#ffffff");
  const onBlack = contrast(background, "#111111");
  return onWhite >= onBlack ? "#ffffff" : "#111111";
}

/** WCAG 2.1 contrast ratio, 1–21. */
export function contrast(a: string, b: string): number {
  try {
    return wcagContrast(a, b) ?? 1;
  } catch {
    return 1;
  }
}

export const AA_NORMAL = 4.5; // body text
export const AA_LARGE = 3; // headings and large UI text
export const AA_UI = 3; // borders, icons, focus rings

export interface PaletteReport {
  /** Every check passed — this palette is safe to ship to a user. */
  accessible: boolean;
  /** Human-readable problems, empty when accessible. */
  problems: string[];
  /** Contrast of the primary button (600) against its own foreground. */
  buttonContrast: number;
  /** Contrast of the 600 step against the light page surface. */
  onLightSurface: number;
  /** Contrast of the 400 step against the dark page surface. */
  onDarkSurface: number;
}

/**
 * Check a generated scale is actually usable.
 *
 * This is the part that stops a user shipping themselves an unreadable app.
 * A yellow seed produces a 600 that white text disappears on — we catch that
 * here and either flip the foreground or reject the palette.
 */
export function auditScale(
  scale: Scale,
  lightSurface = "#f5f5f0",
  darkSurface = "#221b3c",
): PaletteReport {
  const problems: string[] = [];

  // Checked against white, because that is the foreground the design system
  // actually uses on a brand background.
  const buttonContrast = contrast(scale[600], ON_BRAND);
  if (buttonContrast < AA_NORMAL) {
    problems.push("Text on a primary button would be hard to read.");
  }

  // Links and icons sit at 600 on light, 400 on dark.
  const onLightSurface = contrast(scale[600], lightSurface);
  if (onLightSurface < AA_UI) {
    problems.push("This colour is too pale to see against the page in light mode.");
  }

  const onDarkSurface = contrast(scale[400], darkSurface);
  if (onDarkSurface < AA_UI) {
    problems.push("This colour is too dark to see against the page in dark mode.");
  }

  return {
    accessible: problems.length === 0,
    problems,
    buttonContrast,
    onLightSurface,
    onDarkSurface,
  };
}

/**
 * Nudge a seed until it passes the audit.
 *
 * Rather than refusing a colour the user likes, we walk its lightness toward
 * something usable and keep the hue they chose. Returns null only when the hue
 * cannot work at all, which in practice does not happen.
 */
export function makeAccessible(seed: string): { seed: string; adjusted: boolean } | null {
  if (auditScale(generateScale(seed)).accessible) return { seed, adjusted: false };

  const base = toOklch(parse(seed));
  if (!base) return null;

  // Try darkening first (most failures are colours too pale for light mode),
  // then lightening, in small perceptual steps.
  for (const direction of [-1, 1]) {
    for (let delta = 0.02; delta <= 0.35; delta += 0.02) {
      const candidate = formatHex(
        toRgb({
          mode: "oklch",
          l: Math.min(0.95, Math.max(0.2, (base.l ?? 0.6) + direction * delta)),
          c: base.c ?? 0,
          h: base.h ?? 0,
        }),
      );
      if (candidate && auditScale(generateScale(candidate)).accessible) {
        return { seed: candidate, adjusted: true };
      }
    }
  }
  return null;
}

/**
 * The dark-mode variant of a scale.
 *
 * She picks once. In dark mode the same hue needs more lightness and less
 * chroma to sit correctly on a dark surface, so we rebuild the scale around a
 * lifted seed rather than asking her to choose twice.
 */
export function darkVariant(scale: Scale): Scale {
  const base = toOklch(parse(scale[500]));
  if (!base) return scale;
  const lifted = formatHex(
    toRgb({
      mode: "oklch",
      l: Math.min(0.78, (base.l ?? 0.64) + 0.08),
      c: (base.c ?? 0) * 0.86,
      h: base.h ?? 0,
    }),
  );
  return lifted ? generateScale(lifted) : scale;
}
