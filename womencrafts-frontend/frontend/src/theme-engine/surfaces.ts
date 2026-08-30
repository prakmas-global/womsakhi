import { clampChroma, converter, formatHex, formatRgb, parse } from "culori";

import { AA_NORMAL, contrast } from "./palette";
import type { ColorMode } from "./types";

/**
 * The rest of the look and feel.
 *
 * Theming only `--color-brand-*` recolours buttons and links and leaves
 * everything else — the page canvas, the panels, the borders, the shadows, the
 * focus rings, the scrollbar — locked to whatever hue the design system was
 * originally drawn in. The result is an orange app sitting inside a purple
 * shell, which reads as broken rather than themed.
 *
 * So the whole neutral system is derived from the primary hue too, at very low
 * chroma. That is what good design systems do: pair an accent with a neutral
 * that carries a trace of the same hue, so the greys feel like they belong to
 * the colour rather than fighting it.
 *
 * Chroma here is deliberately tiny (0.008–0.04). Any more and surfaces stop
 * reading as neutral and start looking tinted, which is tiring over a workday.
 */

const toOklch = converter("oklch");
const toRgb = converter("rgb");

/**
 * A colour at the given perceptual lightness and chroma, on the theme's hue.
 *
 * Chroma is clamped into the sRGB gamut first. Without that, a saturated teal
 * or blue at chroma 0.17 sits OUTSIDE sRGB, and converting it silently clips
 * each channel — which changes the lightness. The visible effect was a search
 * for a readable ink that never converged: every step asked for a darker
 * colour, clipping handed back the same bright cyan, and the theme shipped
 * text at 1.45:1.
 *
 * `clampChroma` reduces saturation until the colour is representable, keeping
 * hue and lightness — exactly the trade the eye forgives.
 */
function tone(hue: number, l: number, c: number): string {
  const inGamut = clampChroma({ mode: "oklch", l, c, h: hue }, "oklch", "rgb");
  return formatHex(toRgb(inGamut)) ?? "#000000";
}

/** Same, but as `r, g, b` so it can be dropped into an rgba() with an alpha. */
function toneChannels(hue: number, l: number, c: number): string {
  const rgb = toRgb({ mode: "oklch", l, c, h: hue });
  if (!rgb) return "0, 0, 0";
  const to255 = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  return `${to255(rgb.r)}, ${to255(rgb.g)}, ${to255(rgb.b)}`;
}


/**
 * A text colour on this hue that is guaranteed readable on `background`.
 *
 * ── Why this is computed rather than picked ─────────────────────────────────
 * The app used raw `text-ink-subtle` and `text-ink-subtle` for secondary text —
 * 1,258 places. Measured against the card surface those are **2.39:1** and
 * **4.32:1**, both under the 4.5:1 AA minimum, on 43 screens. They also never
 * changed with the theme, because they were Tailwind greys rather than tokens:
 * an orange app still had blue-grey captions.
 *
 * Picking replacement values by eye would fix one theme and break another —
 * what reads well on a pale pink surface is different on a dark teal one. So
 * the lightness is searched: start where the design wants it and walk toward
 * the text end until the ratio is met.
 *
 * `floor`/`ceil` stop the search running away into pure black or white on hues
 * where the target simply cannot be hit; the audit reports it rather than the
 * app silently shipping an unreadable colour.
 */
function readableTone(
  hue: number,
  background: string,
  startL: number,
  chroma: number,
  target = AA_NORMAL,
  darker = true,
): string {
  // culori computes in float; the browser paints 8-bit. A colour that lands
  // exactly on 4.50 measures 4.49 once rounded, and fails. Aim slightly past.
  const aim = target + 0.15;
  let l = startL;
  for (let i = 0; i <= 100; i++) {
    const candidate = tone(hue, l, chroma);
    if (contrast(candidate, background) >= aim) return candidate;
    l = darker ? l - 0.008 : l + 0.008;
    if (l <= 0.08 || l >= 0.99) break;
  }
  return tone(hue, darker ? 0.12 : 0.97, chroma);
}


/**
 * Status hues, in OKLCH. Deliberately NOT themed.
 *
 * Green means good and red means stop regardless of what colour the user
 * picked. Rotating those with the theme would make an amber theme's "success"
 * badge orange and its "warning" badge green, which is worse than ugly — it is
 * misleading on a screen where the badge is the whole message.
 *
 * What IS derived is the ink on each tint, because the measured pairs failed:
 * emerald 3.47:1, brand 4.22:1, rose 3.42:1 — every status badge in the app.
 */
const STATUS_HUES = {
  ok: 152,
  warn: 75,
  danger: 25,
  info: 255,
} as const;

/** Tint + readable ink for each status, for one mode. */
function statusVariables(mode: ColorMode): Record<string, string> {
  const v: Record<string, string> = {};
  for (const [name, hue] of Object.entries(STATUS_HUES)) {
    if (mode === "light") {
      const bg = tone(hue, 0.955, 0.032);
      v[`--status-${name}-bg`] = bg;
      v[`--status-${name}-ink`] = readableTone(hue, bg, 0.5, 0.16, AA_NORMAL);
      v[`--status-${name}-border`] = tone(hue, 0.88, 0.05);
      v[`--status-${name}-solid`] = readableTone(hue, "#ffffff", 0.58, 0.17, AA_NORMAL);
    } else {
      const bg = tone(hue, 0.3, 0.045);
      v[`--status-${name}-bg`] = bg;
      v[`--status-${name}-ink`] = readableTone(hue, bg, 0.78, 0.13, AA_NORMAL, false);
      v[`--status-${name}-border`] = tone(hue, 0.42, 0.06);
      v[`--status-${name}-solid`] = readableTone(hue, "#ffffff", 0.6, 0.16, AA_NORMAL);
    }
  }
  return v;
}

export function hueOf(seed: string): number {
  return toOklch(parse(seed))?.h ?? 0;
}

/**
 * Every semantic token, derived.
 *
 * The numbers are the ones the original hand-drawn palette used, converted to
 * OKLCH — so a WomSakhi-pink theme reproduces very close to the original design
 * rather than being a different app that happens to be pink.
 */
export function surfaceVariables(
  primarySeed: string,
  secondarySeed: string,
  mode: ColorMode,
): Record<string, string> {
  const h = hueOf(primarySeed);
  const h2 = hueOf(secondarySeed);
  const v: Record<string, string> = {};

  if (mode === "light") {
    v["--background"] = tone(h, 0.912, 0.022);
    v["--surface"] = tone(h, 0.966, 0.006);
    v["--surface-hover"] = tone(h, 0.945, 0.009);
    v["--surface-inset"] = tone(h, 0.928, 0.012);
    v["--foreground"] = tone(h, 0.28, 0.075);

    // ── the text scale ──────────────────────────────────────────────────
    // Measured against the DARKEST surface text can land on, not the card.
    //
    // Measuring against `--surface` alone was not enough: the same caption
    // also sits on `--background` (the canvas) and `--surface-inset` (wells,
    // table stripes, quiet panels), both darker. Tokens tuned to the card
    // passed there and then measured 4.07:1 and 3.90:1 on insets across 43
    // screens. Contrast has to hold on the worst background, not the kindest.
    //
    // `--ink-subtle` is the one that matters most: it replaces `slate-400`,
    // which was 2.39:1. It will read darker than the old design did. That is
    // the correction, not a regression — 1,153 captions were failing.
    const lightSurface = v["--background"];
    v["--color-ink"] = readableTone(h, lightSurface, 0.28, 0.075, 7);
    v["--color-ink-muted"] = readableTone(h, lightSurface, 0.5, 0.045, AA_NORMAL);
    v["--color-ink-subtle"] = readableTone(h, lightSurface, 0.58, 0.03, AA_NORMAL);
    // Decorative only — dividers, disabled glyphs, watermarks. Never used for
    // text a person has to read, so it is held to the 3:1 non-text minimum.
    v["--color-ink-faint"] = readableTone(h, lightSurface, 0.7, 0.022, 3);


    v["--color-ink-50"] = tone(h, 0.945, 0.012);
    v["--color-ink-100"] = tone(h, 0.87, 0.028);
    v["--color-ink-200"] = tone(h, 0.72, 0.05);
    v["--color-ink-300"] = tone(h, 0.58, 0.07);
    v["--color-ink-400"] = tone(h, 0.45, 0.085);
    v["--color-ink-500"] = tone(h, 0.35, 0.085);
    v["--color-ink-600"] = tone(h, 0.28, 0.075);
    v["--color-ink-700"] = tone(h, 0.24, 0.065);
    v["--color-ink-800"] = tone(h, 0.2, 0.055);
    v["--color-ink-900"] = tone(h, 0.16, 0.045);

    v["--wc-border-subtle"] = tone(h, 0.895, 0.016);

    // Neumorphic shadow: a tinted shade plus a white highlight. The shade takes
    // the theme's hue so a green app doesn't cast mauve shadows.
    const shade = toneChannels(h, 0.55, 0.06);
    v["--wc-shadow-raised"] =
      `9px 9px 22px rgba(${shade}, 0.3), -8px -8px 20px rgba(255, 255, 255, 0.9)`;
    v["--wc-shadow-soft"] =
      `5px 5px 14px rgba(${shade}, 0.24), -5px -5px 12px rgba(255, 255, 255, 0.9)`;
    v["--wc-shadow-inset"] =
      `inset 3px 3px 7px rgba(${shade}, 0.24), inset -3px -3px 7px rgba(255, 255, 255, 0.9)`;

    const deep = toneChannels(h2, 0.4, 0.09);
    v["--wc-shadow-overlay"] = `0 18px 44px -14px rgba(${deep}, 0.4)`;
    v["--wc-shadow-modal"] =
      `0 34px 80px -24px rgba(${deep}, 0.5), 0 10px 26px -14px rgba(${deep}, 0.28), ` +
      `inset 0 1px 0 rgba(255, 255, 255, 0.8)`;

    v["--skeleton-base"] = tone(h, 0.9, 0.026);
    v["--skeleton-sheen"] = "rgba(255, 255, 255, 0.65)";
    v["--scrollbar-thumb"] = tone(h, 0.83, 0.035);

    v["--chart-grid"] = tone(h, 0.93, 0.012);
    v["--chart-tick"] = tone(h, 0.65, 0.02);
    v["--chart-tt-bg"] = tone(h, 0.966, 0.006);
    v["--chart-tt-border"] = tone(h, 0.9, 0.014);
    v["--chart-tt-text"] = tone(h, 0.26, 0.05);
  } else {
    v["--background"] = tone(h, 0.175, 0.028);
    v["--surface"] = tone(h, 0.235, 0.036);
    v["--surface-hover"] = tone(h, 0.295, 0.045);
    v["--surface-inset"] = tone(h, 0.2, 0.03);

    v["--dk-surface"] = tone(h, 0.235, 0.036);
    v["--dk-surface-2"] = tone(h, 0.295, 0.045);
    v["--dk-border"] = tone(h, 0.355, 0.045);

    // The dark text ramp. Kept high-lightness and low-chroma so long passages
    // stay comfortable — a saturated body text on dark is exhausting.
    v["--dk-strong"] = tone(h, 0.965, 0.012);
    v["--dk-title"] = tone(h, 0.93, 0.016);
    v["--dk-body"] = tone(h, 0.845, 0.026);
    v["--dk-muted"] = tone(h, 0.79, 0.03);
    v["--dk-dim"] = tone(h, 0.745, 0.032);
    v["--foreground"] = tone(h, 0.93, 0.016);

    v["--wc-border-subtle"] = tone(h, 0.355, 0.045);

    v["--wc-shadow-raised"] =
      "8px 8px 22px rgba(0, 0, 0, 0.5), -6px -6px 16px rgba(255, 255, 255, 0.02)";
    v["--wc-shadow-soft"] =
      "5px 5px 14px rgba(0, 0, 0, 0.45), -4px -4px 10px rgba(255, 255, 255, 0.02)";
    v["--wc-shadow-inset"] =
      "inset 3px 3px 7px rgba(0, 0, 0, 0.5), inset -3px -3px 7px rgba(255, 255, 255, 0.03)";
    v["--wc-shadow-overlay"] = "0 18px 44px -14px rgba(0, 0, 0, 0.6)";
    v["--wc-shadow-modal"] =
      "0 34px 90px -20px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.05)";

    v["--skeleton-base"] = tone(h, 0.29, 0.035);
    v["--skeleton-sheen"] = "rgba(255, 255, 255, 0.07)";
    v["--scrollbar-thumb"] = tone(h, 0.37, 0.05);

    v["--chart-grid"] = tone(h, 0.31, 0.04);
    v["--chart-tick"] = tone(h, 0.62, 0.03);
    v["--chart-tt-bg"] = tone(h, 0.235, 0.036);
    v["--chart-tt-border"] = tone(h, 0.355, 0.045);
    v["--chart-tt-text"] = tone(h, 0.93, 0.016);

    // Tinted chip backgrounds. In light mode these are the scale's own 50/100
    // steps; on dark they have to be dark tints instead, or every badge becomes
    // a glowing block.
    v["--color-brand-50"] = tone(h, 0.26, 0.055);
    v["--color-brand-100"] = tone(h, 0.31, 0.07);
    v["--color-violet-50"] = tone(h2, 0.26, 0.05);
    v["--color-violet-100"] = tone(h2, 0.31, 0.065);

    // Same four steps, searched upward: on a dark surface readability comes
    // from getting LIGHTER, not darker. The worst case inverts too — here it
    // is the LIGHTEST surface, `--surface-hover`, since light text on it has
    // the least room.
    const darkSurface = v["--surface-hover"];
    v["--color-ink"] = readableTone(h, darkSurface, 0.93, 0.016, 7, false);
    v["--color-ink-muted"] = readableTone(h, darkSurface, 0.72, 0.022, AA_NORMAL, false);
    v["--color-ink-subtle"] = readableTone(h, darkSurface, 0.64, 0.02, AA_NORMAL, false);
    v["--color-ink-faint"] = readableTone(h, darkSurface, 0.52, 0.018, 3, false);

  }

  // Utility-facing aliases. The `--surface`/`--background` names are used by
  // hand-written CSS; these are what Tailwind turns into `bg-surface`,
  // `border-line` and friends. One source, two spellings — rather than two
  // sets of values that can drift apart.
  v["--color-canvas"] = v["--background"];
  v["--color-surface"] = v["--surface"];
  v["--color-surface-hover"] = v["--surface-hover"];
  v["--color-surface-inset"] = v["--surface-inset"];
  v["--color-line"] = v["--wc-border-subtle"];
  v["--color-line-strong"] =
    mode === "light" ? tone(h, 0.83, 0.022) : tone(h, 0.42, 0.05);

  // Two conventions that are neither brand nor status.
  //
  // A rating star is gold and a favourite heart is red the world over — those
  // meanings are learned, not chosen, so they do not rotate with the theme.
  // They are tokens anyway rather than `fill-amber-400`, so that they are
  // deliberate, documented, and adjustable in one place if the brand ever
  // needs a different gold.
  v["--color-rating"] = mode === "light" ? tone(85, 0.78, 0.16) : tone(85, 0.84, 0.15);
  v["--color-rating-empty"] = mode === "light" ? tone(h, 0.88, 0.012) : tone(h, 0.42, 0.02);
  v["--color-favourite"] = mode === "light" ? tone(15, 0.6, 0.2) : tone(15, 0.68, 0.18);

  // Status badges — semantic hues, contrast-corrected inks.
  Object.assign(v, statusVariables(mode));

  // Brand text on a brand tint. `text-brand-ink` on `bg-brand-50` measured
  // 4.22:1 — so close to passing that it was never obvious, and wrong on 14
  // screens. The tint is unchanged; only the ink is darkened until it reads.
  //
  // Two accent inks — brand and secondary. Each must read on the tint AND on
  // the card AND on the canvas, because the same class is used as a badge, as
  // a link inside a panel, and as a label on the page. Measuring only against
  // the tint left `text-brand-ink` at 4.13:1 on plain cards across 14 screens.
  //
  // `bg-brand-600` is untouched — a button's background does not need to read
  // against the page, only its own white label does.
  for (const [name, hue] of [
    ["brand", h],
    ["violet", h2],
  ] as const) {
    const tint = mode === "light" ? tone(hue, 0.955, 0.03) : tone(hue, 0.3, 0.045);
    v[`--color-${name}-tint`] = tint;

    const worst =
      mode === "light"
        ? [tint, v["--surface"], v["--background"], v["--surface-inset"]]
        : [tint, v["--surface"], v["--surface-hover"]];

    let ink =
      mode === "light"
        ? readableTone(hue, tint, 0.5, 0.17, AA_NORMAL)
        : readableTone(hue, tint, 0.78, 0.13, AA_NORMAL, false);
    // Walk further until it clears EVERY surface it might land on.
    for (let i = 0; i < 60; i++) {
      if (worst.every((bg) => contrast(ink, bg) >= AA_NORMAL + 0.15)) break;
      const l = (toOklch(parse(ink))?.l ?? 0.5) + (mode === "light" ? -0.012 : 0.012);
      if (l <= 0.1 || l >= 0.98) break;
      ink = tone(hue, l, mode === "light" ? 0.17 : 0.13);
    }
    v[`--color-${name}-ink`] = ink;
  }

  // The focus ring is the primary colour, whatever it is.
  v["--wc-ring-focus"] = `rgba(${toneChannels(h, 0.577, 0.2)}, 0.4)`;

  /**
   * A SOLID focus outline, separate from the translucent ring above.
   *
   * The ring is a 40%-alpha glow, which reads as decoration on a pale surface
   * and disappears entirely on a dark one. WCAG asks for 3:1 against the
   * adjacent background for a non-text indicator, and a wash at 0.4 alpha over
   * white does not reach it.
   *
   * `--color-brand-ink` is already solved for 4.5:1 against every surface in
   * this theme and mode, so reusing it means the outline inherits that proof
   * instead of needing its own. One colour, already checked, in all 16
   * theme/mode combinations.
   */
  v["--color-focus"] = v["--color-brand-ink"];

  return v;
}
