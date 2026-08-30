"use client";

import { useCallback, useMemo } from "react";

import { useLayoutEngine } from "./LayoutEngineProvider";
import { LIMITS } from "./types";

export interface NavItem {
  id: string;
  [key: string]: unknown;
}

/**
 * Applies a person's saved navigation to the app's own nav definition.
 *
 * The app keeps owning what the items *are* — labels, icons, hrefs, and which
 * ones a role may see. This only decides order and visibility. Keeping that
 * split means a new nav item appears for everyone automatically, including
 * people who customised their nav long before it existed.
 *
 *     const { visible, hidden, pinned, reorder, toggle, canHide } =
 *       useCustomNav("member", NAV_ITEMS);
 */
export function useCustomNav<T extends NavItem>(app: string, items: T[]) {
  const { navFor, setNav, features, unhideable } = useLayoutEngine();
  const config = navFor(app);

  const ordered = useMemo(() => {
    const byId = new Map(items.map((i) => [i.id, i]));
    const seen = new Set<string>();
    const result: T[] = [];

    // Pinned first, then the saved order, then anything the app added since —
    // in its natural position at the end rather than dropped.
    for (const id of [...config.pinned, ...config.order]) {
      const item = byId.get(id);
      if (item && !seen.has(id)) {
        result.push(item);
        seen.add(id);
      }
    }
    for (const item of items) {
      if (!seen.has(item.id)) result.push(item);
    }
    return result;
  }, [items, config.order, config.pinned]);

  const hiddenSet = useMemo(() => new Set(config.hidden), [config.hidden]);

  const visible = useMemo(
    () => ordered.filter((i) => !hiddenSet.has(i.id)),
    [ordered, hiddenSet],
  );
  const hidden = useMemo(
    () => ordered.filter((i) => hiddenSet.has(i.id)),
    [ordered, hiddenSet],
  );

  /** Whether this item may be hidden at all. */
  const canHide = useCallback(
    (id: string) => !unhideable.has(id) && visible.length > 1,
    [unhideable, visible.length],
  );

  const reorder = useCallback(
    (next: T[]) => setNav(app, { order: next.map((i) => i.id) }),
    [app, setNav],
  );

  const toggle = useCallback(
    (id: string) => {
      if (hiddenSet.has(id)) {
        setNav(app, { hidden: config.hidden.filter((h) => h !== id) });
        return;
      }
      // Refuse rather than warn. Hiding the last item, or the route to
      // settings, would leave no way back — see "Cannot trap yourself".
      if (!canHide(id)) return;
      setNav(app, { hidden: [...config.hidden, id] });
    },
    [app, canHide, config.hidden, hiddenSet, setNav],
  );

  const pin = useCallback(
    (id: string) => {
      const pinned = config.pinned.includes(id)
        ? config.pinned.filter((p) => p !== id)
        : [...config.pinned, id];
      setNav(app, { pinned });
    },
    [app, config.pinned, setNav],
  );

  /**
   * The phone's bottom bar. Falls back to the first five visible items, which
   * is what someone who has never touched this would expect to see.
   */
  const tabs = useMemo(() => {
    if (!config.tabs.length) return visible.slice(0, LIMITS.tabs);
    const byId = new Map(visible.map((i) => [i.id, i]));
    const chosen = config.tabs.map((id) => byId.get(id)).filter(Boolean) as T[];
    return chosen.length ? chosen.slice(0, LIMITS.tabs) : visible.slice(0, LIMITS.tabs);
  }, [config.tabs, visible]);

  const setTabs = useCallback(
    (ids: string[]) => setNav(app, { tabs: ids.slice(0, LIMITS.tabs) }),
    [app, setNav],
  );

  return {
    visible,
    hidden,
    tabs,
    pinned: config.pinned,
    collapsed: config.collapsed,
    canHide,
    reorder,
    toggle,
    pin,
    setTabs,
    enabled: features["layout.nav"],
  };
}
