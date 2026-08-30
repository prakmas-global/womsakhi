"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { ALL_ENABLED, LayoutEngineProvider, UNHIDEABLE } from "@/layout-engine";
import type { Layout, LayoutFeatures, PersistHandlers } from "@/layout-engine";
import {
  apiMyFeatures,
  apiMyLayout,
  apiResetLayout,
  apiResetNav,
  apiResetScreen,
  apiSaveChart,
  apiSaveColumns,
  apiSaveNav,
  apiSavePane,
  apiSaveSidebar,
  apiSaveWidgets,
} from "@/lib/layout-api";

/**
 * Connects the portable layout engine to this app's account system.
 *
 * The engine knows nothing about WomSakhi — this is the only file that knows
 * both. Copying `layout-engine/` elsewhere means rewriting this component and
 * nothing else.
 *
 * Saves are fire-and-forget. A failed request must not roll back something the
 * user has already watched happen on screen: the local mirror keeps it, and the
 * next successful save reconciles. Reverting a pane the user just dragged, to
 * report a network error they can't act on, would be worse than the error.
 */
/**
 * Nav items this app refuses to let anyone hide.
 *
 * Safety is the one that matters. A member must be one tap from a helpline
 * however she has arranged the rest of her app, so it is not offered as a
 * hideable item rather than warned about. Home stays because an app with no
 * route back to its own start screen is a maze.
 */
const NEVER_HIDE = new Set<string>([
  ...UNHIDEABLE,
  "/app",
  "/app/safety",
  "/dashboard",
]);

export default function LayoutEngineBridge({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [initial, setInitial] = useState<Layout | null>(null);
  const [features, setFeatures] = useState<LayoutFeatures>(ALL_ENABLED);

  useEffect(() => {
    if (!user) {
      setInitial(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [layout, plan] = await Promise.all([apiMyLayout(), apiMyFeatures()]);
        if (cancelled) return;
        setInitial(layout);
        setFeatures(plan);
      } catch {
        // Signed in but the layout didn't load — fall through to the local
        // mirror rather than resetting someone's arrangement over a blip.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const persist = useMemo<PersistHandlers>(() => {
    const swallow = (p: Promise<unknown>) => void p.catch(() => {});
    return {
      nav: (app, config) => swallow(apiSaveNav(app, config)),
      sidebar: (bp, width) => swallow(apiSaveSidebar(bp, width)),
      pane: (key, bp, fraction) => swallow(apiSavePane(key, bp, fraction)),
      chart: (key, height) => swallow(apiSaveChart(key, height)),
      columns: (key, widths) => swallow(apiSaveColumns(key, widths)),
      widgets: (screen, widgets) => swallow(apiSaveWidgets(screen, widgets)),
      resetScreen: (screen) => swallow(apiResetScreen(screen)),
      resetNav: (app) => swallow(apiResetNav(app)),
      resetAll: () => swallow(apiResetLayout()),
    };
  }, []);

  // Signed out, nothing is persisted server-side — but the engine still runs so
  // the sign-in screen and onboarding keep whatever was set locally.
  const handlers = useCallback(() => (user ? persist : {}), [user, persist])();

  return (
    <LayoutEngineProvider
      initial={initial}
      features={features}
      persist={handlers}
      unhideable={NEVER_HIDE}
    >
      {children}
    </LayoutEngineProvider>
  );
}
