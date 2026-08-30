"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { clearStoredLayout, currentBreakpoint, readStoredLayout, storeLayout } from "./storage";
import {
  ALL_ENABLED,
  clamp,
  EMPTY_LAYOUT,
  LIMITS,
  UNHIDEABLE,
  type Breakpoint,
  type Layout,
  type LayoutFeatures,
  type NavConfig,
  type WidgetPlacement,
} from "./types";

/**
 * The layout engine's React surface.
 *
 * Like the theme engine, it knows nothing about the app around it: persistence
 * arrives as callbacks, so dropping this folder into another project needs no
 * edits.
 *
 * ── Why state updates immediately but saves are debounced ────────────────────
 * Dragging a sidebar fires a resize event per frame. Persisting each one would
 * be ~60 requests a second. But *rendering* each one is the whole point — a
 * drag that lags behind the pointer feels broken.
 *
 * So local state updates synchronously and the save is debounced. The user sees
 * every frame; the server sees the result.
 */

/** Below this width a nav label cannot fit, so the rail switches to icons. */
export const ICON_ONLY_BELOW = 150;

export const DEFAULT_NAV: NavConfig = {
  order: [],
  hidden: [],
  pinned: [],
  // Icons by default. The rail gives its width back to the content and reveals
  // itself on hover, which is the arrangement most people want most of the
  // time — you navigate occasionally and read constantly.
  collapsed: true,
  tabs: [],
};

/**
 * How long the pointer must rest on the rail before it opens.
 *
 * Short. Long enough that sweeping diagonally across the rail on the way
 * somewhere else doesn't trigger it, short enough that it never feels like
 * lag — at 120ms the pause before movement read as the panel "sticking" and
 * then snapping, because nothing happens and then everything does.
 */
const HOVER_OPEN_MS = 70;
/**
 * And how long it must leave before it closes. Deliberately much longer:
 * clipping the corner of the rail on the way to a control should not slam it
 * shut, and reaching for something inside it briefly leaves the element.
 */
const HOVER_CLOSE_MS = 320;

interface LayoutEngineValue {
  layout: Layout;
  /** Which breakpoint we are actually rendering at, right now. */
  breakpoint: Breakpoint;
  /** Whether the user has entered customise mode. */
  customising: boolean;
  setCustomising: (on: boolean) => void;
  /** What this account's plan includes. All true today. */
  features: LayoutFeatures;

  navFor: (app: string) => NavConfig;
  setNav: (app: string, next: Partial<NavConfig>) => void;

  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  toggleCollapsed: (app: string) => void;
  /**
   * True when the rail is too narrow for labels.
   *
   * Derived from the width rather than stored, so dragging the rail narrow and
   * pressing "collapse" arrive at the same state. Two independent flags would
   * eventually disagree, and the app would show labels in a 70px rail.
   */
  iconOnly: boolean;
  /**
   * Width the PAGE reserves for the rail — not necessarily the rail's width.
   *
   * When a collapsed rail opens on hover it overlays the content rather than
   * pushing it. Pushing would reflow the entire page on every accidental
   * hover, which is both distracting and expensive; the reserved width stays
   * at 64px and the rail floats above.
   */
  railWidth: number;
  /** Whether the rail is showing labels right now, pinned or hovered. */
  railOpen: boolean;
  /** True only when it is open *because* of hover — i.e. it is overlaying. */
  railOverlaying: boolean;
  /** Call on pointer enter/leave and focus/blur of the rail. */
  setRailHovered: (hovered: boolean) => void;

  paneSize: (key: string, fallback: number) => number;
  setPaneSize: (key: string, fraction: number) => void;

  chartHeight: (key: string, fallback: number) => number;
  setChartHeight: (key: string, height: number) => void;

  columnWidths: (key: string) => Record<string, number>;
  setColumnWidth: (key: string, column: string, width: number) => void;

  widgetsFor: (screen: string, defaults: WidgetPlacement[]) => WidgetPlacement[];
  setWidgets: (screen: string, widgets: WidgetPlacement[]) => void;

  resetScreen: (screen: string) => void;
  resetNav: (app: string) => void;
  resetAll: () => void;
  /** True when anything at all has been customised — drives "Reset" visibility. */
  isCustomised: boolean;
  /** Nav ids that may never be hidden. */
  unhideable: Set<string>;
}

const LayoutEngineContext = createContext<LayoutEngineValue | null>(null);

export function useLayoutEngine(): LayoutEngineValue {
  const ctx = useContext(LayoutEngineContext);
  if (!ctx) throw new Error("useLayoutEngine must be used inside <LayoutEngineProvider>");
  return ctx;
}

/** Tracks the viewport bucket. Resize-driven, so it survives device rotation. */
function useBreakpoint(initial: Breakpoint): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(initial);

  useEffect(() => {
    const read = () => setBp(currentBreakpoint(window.innerWidth));
    read();
    window.addEventListener("resize", read, { passive: true });
    return () => window.removeEventListener("resize", read);
  }, []);

  return bp;
}

export interface PersistHandlers {
  nav?: (app: string, config: NavConfig) => void;
  sidebar?: (breakpoint: Breakpoint, width: number) => void;
  pane?: (key: string, breakpoint: Breakpoint, fraction: number) => void;
  chart?: (key: string, height: number) => void;
  columns?: (key: string, widths: Record<string, number>) => void;
  widgets?: (screen: string, widgets: WidgetPlacement[]) => void;
  resetScreen?: (screen: string) => void;
  resetNav?: (app: string) => void;
  resetAll?: () => void;
}

export function LayoutEngineProvider({
  children,
  initial,
  features = ALL_ENABLED,
  persist,
  initialBreakpoint = "desktop",
  saveDelay = 400,
  unhideable = UNHIDEABLE,
}: {
  children: React.ReactNode;
  /** Layout from the server, so the first paint is already correct. */
  initial?: Layout | null;
  features?: LayoutFeatures;
  persist?: PersistHandlers;
  initialBreakpoint?: Breakpoint;
  /** How long after the last change to save. */
  saveDelay?: number;
  /**
   * Nav ids that may never be hidden.
   *
   * The engine ships a generic set; the host app adds its own — WomSakhi makes
   * Safety unhideable, because a woman must always be one tap from help however
   * she has arranged the rest of her app.
   */
  unhideable?: Set<string>;
}) {
  const breakpoint = useBreakpoint(initialBreakpoint);
  const [layout, setLayout] = useState<Layout>(initial ?? EMPTY_LAYOUT);
  const [customising, setCustomising] = useState(false);

  // Adopt the account's layout once it arrives.
  useEffect(() => {
    if (initial) setLayout({ ...EMPTY_LAYOUT, ...initial });
  }, [initial]);

  // Fall back to the local mirror when there's no account layout yet.
  useEffect(() => {
    if (initial) return;
    const stored = readStoredLayout();
    if (stored) setLayout(stored);
  }, [initial]);

  // Keep the local mirror and the first-paint cookie in step.
  useEffect(() => {
    storeLayout(layout);
  }, [layout]);

  // ── debounced persistence ────────────────────────────────────────────────
  // Keyed by what changed, so a sidebar drag and a pane drag in the same window
  // both save rather than the second cancelling the first.
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const save = useCallback(
    (key: string, fn: () => void) => {
      clearTimeout(timers.current[key]);
      timers.current[key] = setTimeout(fn, saveDelay);
    },
    [saveDelay],
  );

  useEffect(() => {
    const pending = timers.current;
    // Flush nothing on unmount — just stop the timers. A save firing after the
    // provider is gone would be writing state nobody is looking at any more.
    return () => Object.values(pending).forEach(clearTimeout);
  }, []);

  // ── navigation ───────────────────────────────────────────────────────────
  const navFor = useCallback(
    (app: string): NavConfig => ({ ...DEFAULT_NAV, ...(layout.nav[app] ?? {}) }),
    [layout.nav],
  );

  const setNav = useCallback(
    (app: string, next: Partial<NavConfig>) => {
      if (!features["layout.nav"]) return;
      const merged: NavConfig = { ...DEFAULT_NAV, ...(layout.nav[app] ?? {}), ...next };
      // Enforce the invariant here rather than trusting every caller: an item
      // that must stay reachable cannot end up hidden, whatever the UI asked.
      merged.hidden = merged.hidden.filter((id) => !unhideable.has(id));
      merged.tabs = merged.tabs.slice(0, LIMITS.tabs);

      setLayout((prev) => ({ ...prev, nav: { ...prev.nav, [app]: merged } }));
      save(`nav:${app}`, () => persist?.nav?.(app, merged));
    },
    [features, layout.nav, persist, save, unhideable],
  );

  const toggleCollapsed = useCallback(
    (app: string) => setNav(app, { collapsed: !navFor(app).collapsed }),
    [navFor, setNav],
  );

  // ── sidebar ──────────────────────────────────────────────────────────────
  // ── the rail ─────────────────────────────────────────────────────────────
  const [railHovered, setRailHoveredState] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const setRailHovered = useCallback((hovered: boolean) => {
    clearTimeout(hoverTimer.current);
    // Asymmetric delays on purpose. Opening waits, so sweeping the pointer
    // diagonally across the rail on the way somewhere else doesn't fire it.
    // Closing waits longer, so travelling from an icon to its flyout — which
    // briefly leaves the rail — doesn't snap it shut mid-reach.
    hoverTimer.current = setTimeout(
      () => setRailHoveredState(hovered),
      hovered ? HOVER_OPEN_MS : HOVER_CLOSE_MS,
    );
  }, []);

  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  const pinnedOpen = !navFor("staff").collapsed || !navFor("member").collapsed;
  const storedWidth = layout.sidebar[breakpoint] ?? LIMITS.sidebar.default;

  // What the page reserves. Unchanged by hover — that is what makes the open
  // rail an overlay rather than a shove.
  const railWidth = pinnedOpen ? storedWidth : LIMITS.sidebar.min;
  const railOverlaying = !pinnedOpen && railHovered;
  const railOpen = pinnedOpen || railHovered;

  // The rail's OWN width: the stored width whenever it is showing labels,
  // whether that is because it is pinned or because it is being hovered.
  const sidebarWidth = railOpen ? storedWidth : LIMITS.sidebar.min;

  // Labels stop fitting somewhere around 150px. Below that the rail shows icons
  // and reveals names on hover — see NavFlyout.
  const iconOnly = !railOpen || storedWidth < ICON_ONLY_BELOW;

  const setSidebarWidth = useCallback(
    (width: number) => {
      if (!features["layout.resize"]) return;
      const w = Math.round(clamp(width, LIMITS.sidebar.min, LIMITS.sidebar.max));
      setLayout((prev) => ({ ...prev, sidebar: { ...prev.sidebar, [breakpoint]: w } }));
      save("sidebar", () => persist?.sidebar?.(breakpoint, w));
    },
    [breakpoint, features, persist, save],
  );

  // ── panes ────────────────────────────────────────────────────────────────
  const paneSize = useCallback(
    (key: string, fallback: number) =>
      layout.panes[key]?.[breakpoint] ?? clamp(fallback, LIMITS.pane.min, LIMITS.pane.max),
    [breakpoint, layout.panes],
  );

  const setPaneSize = useCallback(
    (key: string, fraction: number) => {
      if (!features["layout.resize"]) return;
      const f = Number(clamp(fraction, LIMITS.pane.min, LIMITS.pane.max).toFixed(4));
      setLayout((prev) => ({
        ...prev,
        panes: { ...prev.panes, [key]: { ...(prev.panes[key] ?? {}), [breakpoint]: f } },
      }));
      save(`pane:${key}`, () => persist?.pane?.(key, breakpoint, f));
    },
    [breakpoint, features, persist, save],
  );

  // ── charts ───────────────────────────────────────────────────────────────
  const chartHeight = useCallback(
    (key: string, fallback: number) =>
      layout.charts[key] ?? clamp(fallback, LIMITS.chart.min, LIMITS.chart.max),
    [layout.charts],
  );

  const setChartHeight = useCallback(
    (key: string, height: number) => {
      if (!features["layout.resize"]) return;
      const h = Math.round(clamp(height, LIMITS.chart.min, LIMITS.chart.max));
      setLayout((prev) => ({ ...prev, charts: { ...prev.charts, [key]: h } }));
      save(`chart:${key}`, () => persist?.chart?.(key, h));
    },
    [features, persist, save],
  );

  // ── table columns ────────────────────────────────────────────────────────
  const columnWidths = useCallback(
    (key: string) => layout.columns[key] ?? {},
    [layout.columns],
  );

  const setColumnWidth = useCallback(
    (key: string, column: string, width: number) => {
      if (!features["layout.resize"]) return;
      const w = Math.round(clamp(width, LIMITS.column.min, LIMITS.column.max));
      setLayout((prev) => {
        const next = { ...(prev.columns[key] ?? {}), [column]: w };
        save(`columns:${key}`, () => persist?.columns?.(key, next));
        return { ...prev, columns: { ...prev.columns, [key]: next } };
      });
    },
    [features, persist, save],
  );

  // ── widgets ──────────────────────────────────────────────────────────────
  const widgetsFor = useCallback(
    (screen: string, defaults: WidgetPlacement[]): WidgetPlacement[] => {
      const saved = layout.widgets[screen];
      if (!saved?.length) return defaults;

      // Merge rather than replace. A widget added in a later release isn't in
      // the saved order, and dropping it would mean shipping a feature that
      // every existing user is invisibly opted out of.
      const known = new Set(saved.map((w) => w.id));
      const valid = new Set(defaults.map((w) => w.id));
      return [
        ...saved.filter((w) => valid.has(w.id)),
        ...defaults.filter((w) => !known.has(w.id)),
      ];
    },
    [layout.widgets],
  );

  const setWidgets = useCallback(
    (screen: string, widgets: WidgetPlacement[]) => {
      if (!features["layout.widgets"]) return;
      const cleaned = widgets.slice(0, 40).map((w) => ({
        ...w,
        span: Math.round(clamp(w.span, LIMITS.span.min, LIMITS.span.max)),
        ...(typeof w.height === "number"
          ? {
              height: Math.round(
                clamp(w.height, LIMITS.widgetHeight.min, LIMITS.widgetHeight.max),
              ),
            }
          : {}),
      }));
      setLayout((prev) => ({ ...prev, widgets: { ...prev.widgets, [screen]: cleaned } }));
      save(`widgets:${screen}`, () => persist?.widgets?.(screen, cleaned));
    },
    [features, persist, save],
  );

  // ── reset ────────────────────────────────────────────────────────────────
  // Never gated on an entitlement. However she got into a mess, the way out is
  // always available — that is the whole "cannot trap yourself" invariant.
  const resetScreen = useCallback(
    (screen: string) => {
      const prefix = `${screen}:`;
      const drop = <T,>(obj: Record<string, T>) =>
        Object.fromEntries(Object.entries(obj).filter(([k]) => !k.startsWith(prefix)));
      setLayout((prev) => {
        const widgets = { ...prev.widgets };
        delete widgets[screen];
        return {
          ...prev,
          panes: drop(prev.panes),
          charts: drop(prev.charts),
          columns: drop(prev.columns),
          widgets,
        };
      });
      persist?.resetScreen?.(screen);
    },
    [persist],
  );

  const resetNav = useCallback(
    (app: string) => {
      setLayout((prev) => {
        const nav = { ...prev.nav };
        delete nav[app];
        return { ...prev, nav };
      });
      persist?.resetNav?.(app);
    },
    [persist],
  );

  const resetAll = useCallback(() => {
    Object.values(timers.current).forEach(clearTimeout);
    setLayout(EMPTY_LAYOUT);
    clearStoredLayout();
    setCustomising(false);
    persist?.resetAll?.();
  }, [persist]);

  const isCustomised = useMemo(
    () =>
      Object.keys(layout.nav).length > 0 ||
      Object.keys(layout.sidebar).length > 0 ||
      Object.keys(layout.panes).length > 0 ||
      Object.keys(layout.charts).length > 0 ||
      Object.keys(layout.columns).length > 0 ||
      Object.keys(layout.widgets).length > 0,
    [layout],
  );

  const value = useMemo<LayoutEngineValue>(
    () => ({
      layout,
      breakpoint,
      customising,
      setCustomising,
      features,
      navFor,
      setNav,
      sidebarWidth,
      setSidebarWidth,
      toggleCollapsed,
      iconOnly,
      railWidth,
      railOpen,
      railOverlaying,
      setRailHovered,
      paneSize,
      setPaneSize,
      chartHeight,
      setChartHeight,
      columnWidths,
      setColumnWidth,
      widgetsFor,
      setWidgets,
      resetScreen,
      resetNav,
      resetAll,
      isCustomised,
      unhideable,
    }),
    [
      layout, breakpoint, customising, features, navFor, setNav, sidebarWidth, iconOnly,
      railWidth, railOpen, railOverlaying, setRailHovered,
      setSidebarWidth, toggleCollapsed, paneSize, setPaneSize, chartHeight,
      setChartHeight, columnWidths, setColumnWidth, widgetsFor, setWidgets,
      resetScreen, resetNav, resetAll, isCustomised, unhideable,
    ],
  );

  return <LayoutEngineContext.Provider value={value}>{children}</LayoutEngineContext.Provider>;
}
