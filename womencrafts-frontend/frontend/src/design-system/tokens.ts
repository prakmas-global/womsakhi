/**
 * Token catalogue.
 *
 * Deliberately holds NAMES, not values. The values live in exactly one place —
 * `tokens.css` — and this file describes what each token is for. The style
 * guide at /design-system resolves the real value from the DOM at runtime, so
 * the documentation can never drift out of sync with the CSS the way a
 * duplicated list of hex codes would.
 */

export type TokenSpec = {
  /** CSS custom property name, e.g. "--surface". */
  name: string;
  /** What this token is for and when to reach for it. */
  usage: string;
};

export type TokenGroup = {
  id: string;
  title: string;
  description: string;
  /** How the style guide should render the value. */
  render: "color" | "shadow" | "radius" | "font";
  tokens: TokenSpec[];
};

/** Read a token's live computed value in the browser (returns "" during SSR). */
export function readToken(name: string, el?: Element | null): string {
  if (typeof window === "undefined") return "";
  const target = el ?? document.documentElement;
  return getComputedStyle(target).getPropertyValue(name).trim();
}

const scale = (prefix: string, steps: (string | number)[], usage: string): TokenSpec[] =>
  steps.map((s) => ({ name: `--color-${prefix}-${s}`, usage }));

export const TOKEN_GROUPS: TokenGroup[] = [
  {
    id: "brand",
    title: "Brand — magenta",
    description:
      "The primary identity colour. 600 backs every primary button and active nav item; 50/100 are the tinted chip backgrounds.",
    render: "color",
    tokens: scale("brand", [50, 100, 200, 300, 400, 500, 600, 700, 800, 900], "Brand scale"),
  },
  {
    id: "violet",
    title: "Violet — royal purple",
    description:
      "The secondary accent. Used for secondary buttons, alternate chart series and icon circles that shouldn't compete with brand magenta.",
    render: "color",
    tokens: scale("violet", [50, 100, 200, 300, 400, 500, 600, 700, 800, 900], "Violet scale"),
  },
  {
    id: "ink",
    title: "Ink — deep indigo",
    description:
      "Text and headings. `--color-ink` is the display-heading colour; the lighter steps are for de-emphasised copy.",
    render: "color",
    tokens: scale("ink", [50, 100, 200, 300, 400, 500, 600, 700, 800, 900], "Ink scale"),
  },
  {
    id: "surface",
    title: "Surfaces",
    description:
      "The structural colours. Every panel, sidebar, modal and input resolves to one of these — change --surface and the whole app follows.",
    render: "color",
    tokens: [
      { name: "--background", usage: "Page canvas behind all panels." },
      { name: "--surface", usage: "Cards, sidebar, topbar, modals, outline buttons." },
      { name: "--surface-hover", usage: "Hover and active step on a surface; table row hover." },
      { name: "--surface-inset", usage: "Pressed wells — inputs, toggles, search boxes." },
      { name: "--foreground", usage: "Default body text colour." },
      { name: "--wc-border-subtle", usage: "Hairline borders and dividers." },
    ],
  },
  {
    id: "elevation",
    title: "Elevation",
    description:
      "Neumorphic depth: a mauve-tinted shade plus a white highlight. Raised for cards, soft for nested tiles, inset for anything that should look pressed.",
    render: "shadow",
    tokens: [
      { name: "--wc-shadow-raised", usage: "Standard card (.wc-card)." },
      { name: "--wc-shadow-soft", usage: "Nested tile or chip (.wc-soft)." },
      { name: "--wc-shadow-inset", usage: "Inputs and wells (.wc-inset)." },
      { name: "--wc-shadow-overlay", usage: "Dropdown menus and popovers (.wc-overlay)." },
      { name: "--wc-shadow-modal", usage: "Floating dialog (.wc-modal)." },
    ],
  },
  {
    id: "radius",
    title: "Radius",
    description:
      "The rounding scale. Namespaced with --wc- so it never collides with Tailwind's own --radius-* theme, which drives the rounded-* utilities.",
    render: "radius",
    tokens: [
      { name: "--wc-radius-sm", usage: "Small buttons and chips." },
      { name: "--wc-radius-md", usage: "Default buttons and inputs." },
      { name: "--wc-radius-lg", usage: "Nested tiles (.wc-soft)." },
      { name: "--wc-radius-xl", usage: "Cards (.wc-card)." },
      { name: "--wc-radius-2xl", usage: "Modals and overlay panels." },
    ],
  },
  {
    id: "typography",
    title: "Typography",
    description:
      "Two families: Poppins for display headings, Inter for everything else. Applied via font-display and font-sans.",
    render: "font",
    tokens: [
      { name: "--font-display", usage: "Page titles, card headings, stat values." },
      { name: "--font-sans", usage: "Body copy, labels, table content." },
    ],
  },
  {
    id: "charts",
    title: "Charts",
    description:
      "Read by the Recharts wrappers so every chart matches the current theme without per-chart colour props.",
    render: "color",
    tokens: [
      { name: "--chart-grid", usage: "Grid lines." },
      { name: "--chart-tick", usage: "Axis labels." },
      { name: "--chart-tt-bg", usage: "Tooltip background." },
      { name: "--chart-tt-border", usage: "Tooltip border." },
      { name: "--chart-tt-text", usage: "Tooltip text." },
    ],
  },
];
