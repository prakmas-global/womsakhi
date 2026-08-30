"use client";

import { useEffect } from "react";

import { useLayoutEngine } from "./LayoutEngineProvider";

/**
 * Publishes the sidebar width as a CSS custom property.
 *
 * A fixed-position shell can't be wrapped in a flex container, so the rail, the
 * top bar and the content area each need to know the width independently. Three
 * components reading one variable stays in step by construction; three
 * components each holding their own copy of the number does not — and the way
 * that fails is a top bar overlapping a sidebar mid-drag.
 *
 * It also means a drag costs one property write per frame instead of
 * re-rendering three subtrees.
 *
 * The server writes the same variable for the first paint, so the value is
 * correct before this ever runs. See `LayoutStyle.tsx`.
 */
export function useSidebarVariable(name = "--wc-sidebar-width", width?: number): void {
  const { railWidth } = useLayoutEngine();
  // The PAGE reserves the rail width, which does not change on hover. A rail
  // that opens on hover overlays the content; if this followed the rail's own
  // width instead, every hover would reflow the whole page.
  const value = width ?? railWidth;

  useEffect(() => {
    document.documentElement.style.setProperty(name, `${value}px`);
  }, [name, value]);
}
