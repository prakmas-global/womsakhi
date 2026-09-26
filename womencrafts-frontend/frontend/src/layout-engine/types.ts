/**
 * The shape of a saved layout. Mirrors `app/models/layout.py` exactly — if you
 * change one, change the other.
 */

export type Breakpoint = "mobile" | "tablet" | "desktop";

export const BREAKPOINTS: Breakpoint[] = ["mobile", "tablet", "desktop"];

/**
 * Where the breakpoints actually fall.
 *
 * Deliberately matched to Tailwind's `md` (768) and `xl` (1280) rather than
 * invented: a layout that switches at a different width than the CSS around it
 * produces a band of viewport widths where the stored layout and the rendered
 * one disagree, which is a genuinely horrible class of bug to chase.
 */
export const BREAKPOINT_MIN: Record<Breakpoint, number> = {
  mobile: 0,
  tablet: 768,
  desktop: 1280,
};

export interface NavConfig {
  /** Item ids in display order. Items not listed keep their natural order, last. */
  order: string[];
  /** Hidden item ids. Some items refuse to hide — see `UNHIDEABLE`. */
  hidden: string[];
  /** Pinned to the top, above the rest. */
  pinned: string[];
  /** Sidebar collapsed to the icon rail. */
  collapsed: boolean;
  /** Which items occupy the phone's bottom bar. Max 5. */
  tabs: string[];
}

export interface WidgetPlacement {
  id: string;
  /** Columns spanned in the 4-wide grid. */
  span: number;
  hidden: boolean;
  /**
   * Height in px, once the user has dragged one.
   *
   * Undefined means "never dragged vertically" — the screen's own default
   * applies. Storing a default instead would freeze today's design into every
   * account, so a later redesign would silently not reach anyone.
   */
  height?: number;
}

export interface Layout {
  /** "member" | "staff" -> that app's navigation */
  nav: Record<string, NavConfig>;
  /** breakpoint -> sidebar width in px */
  sidebar: Partial<Record<Breakpoint, number>>;
  /** "screen:pane" -> breakpoint -> fraction of the row */
  panes: Record<string, Partial<Record<Breakpoint, number>>>;
  /** "screen:chart" -> height in px */
  charts: Record<string, number>;
  /** "screen:table" -> column -> width in px */
  columns: Record<string, Record<string, number>>;
  /** "screen" -> widgets in display order */
  widgets: Record<string, WidgetPlacement[]>;
}

export const EMPTY_LAYOUT: Layout = {
  nav: {},
  sidebar: {},
  panes: {},
  charts: {},
  columns: {},
  widgets: {},
};

/** Limits. Must match the server, which clamps to these on every read. */
export const LIMITS = {
  sidebar: { min: 64, max: 420, default: 253 },
  pane: { min: 0.2, max: 0.8 },
  chart: { min: 140, max: 640 },
  column: { min: 60, max: 640 },
  span: { min: 1, max: 4 },
  widgetHeight: { min: 120, max: 1200 },
  tabs: 5,
} as const;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Which nav items can never be hidden.
 *
 * The invariant is that no sequence of customisations can leave someone unable
 * to undo them. Hiding the route to settings — which is where "reset my
 * layout" lives — would do exactly that, so it is not offered rather than
 * warned about. See "Cannot trap yourself" in the knowledge base.
 */
export const UNHIDEABLE = new Set(["settings", "account", "appearance", "help"]);

export interface LayoutFeatures {
  "layout.nav": boolean;
  "layout.resize": boolean;
  "layout.widgets": boolean;
  [key: string]: boolean;
}

export const ALL_ENABLED: LayoutFeatures = {
  "layout.nav": true,
  "layout.resize": true,
  "layout.widgets": true,
};
