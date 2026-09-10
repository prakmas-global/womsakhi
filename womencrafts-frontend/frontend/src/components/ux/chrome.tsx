"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * The chrome lives in the layout; a page only says what it needs from it.
 *
 * ── The bug this exists to kill ─────────────────────────────────────────────
 * Every one of 108 screens rendered `<HomeShell>`, which rendered the topbar,
 * the rail and the mobile bar. In the App Router a `layout` persists across a
 * navigation and a `page` is destroyed and rebuilt — so clicking any rail item
 * tore down the entire chrome and built it again. That is why the whole screen
 * appeared to reload when only the middle should have changed, and why the
 * sidebar jumped: a fresh rail starts at scroll position zero, so it lost her
 * place every single time.
 *
 * ── Why a slot and not 108 edits ────────────────────────────────────────────
 * The obvious fix is to move the chrome up and have every page stop rendering
 * it. That is 108 files, each with its own `rail`, `wide` and `bare`, and no
 * way for a layout to read a prop off a page. So `HomeShell` keeps its exact
 * signature and changes what it DOES: it registers what this page wants and
 * renders only the body. The layout owns one Shell and reads the register.
 *
 * ── Written in a layout effect, on purpose ──────────────────────────────────
 * Before paint, so the frame she sees already has the right rail in it. In an
 * ordinary effect the page would flash once with the previous screen's rail.
 */

export interface PageChrome {
  rail?: React.ReactNode;
  wide?: boolean;
  bare?: boolean;
  name?: string;
}

const EMPTY: PageChrome = {};

const ChromeContext = createContext<{
  chrome: PageChrome;
  set: (path: string, c: PageChrome) => void;
}>({ chrome: EMPTY, set: () => {} });

export function ChromeProvider({ children }: { children: React.ReactNode }) {
  /**
   * What was registered, and by WHICH screen.
   *
   * Twenty-one member screens never call `HomeShell` — the six section hubs,
   * the nine settings pages, the redirect stubs. Without the path stamp they
   * would inherit whatever the previous screen had registered: open Earn, then
   * Settings, and Settings would wear Earn's rail. Storing the path and
   * comparing it on read means a screen that asks for nothing gets nothing,
   * with no effect to run and no order to get wrong.
   */
  const [entry, setEntry] = useState<{ path: string; chrome: PageChrome }>({ path: "", chrome: EMPTY });
  const pathname = usePathname() ?? "";

  const set = useCallback(
    (path: string, chrome: PageChrome) => setEntry({ path, chrome }), []);

  const chrome = entry.path === pathname ? entry.chrome : EMPTY;
  const value = useMemo(() => ({ chrome, set }), [chrome, set]);
  return <ChromeContext.Provider value={value}>{children}</ChromeContext.Provider>;
}

/** Read by the one Shell in the layout. */
export function useChrome(): PageChrome {
  return useContext(ChromeContext).chrome;
}

/**
 * Called by `HomeShell` on every screen.
 *
 * The dependency list is the VALUES, not the object, because a page builds a
 * fresh `{ rail, wide }` on every render — depending on the object would set
 * state on every render and loop.
 */
export function usePageChrome(c: PageChrome) {
  const { set } = useContext(ChromeContext);
  const pathname = usePathname() ?? "";
  const { rail, wide, bare, name } = c;
  useLayoutEffect(() => {
    set(pathname, { rail, wide, bare, name });
  }, [set, pathname, rail, wide, bare, name]);
}
