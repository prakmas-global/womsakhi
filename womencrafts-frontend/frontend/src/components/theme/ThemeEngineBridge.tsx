"use client";

import { useCallback, useMemo } from "react";

import { useAuth } from "@/context/AuthContext";
import { ThemeEngineProvider } from "@/theme-engine";
import type { ThemeChoice } from "@/theme-engine";
import { apiSaveMyTheme } from "@/lib/theme-api";

/**
 * Connects the portable theme engine to this app's account system.
 *
 * The engine deliberately knows nothing about WomSakhi — this thin bridge is
 * the only file that knows both. Copying `theme-engine/` elsewhere means
 * rewriting this one component and nothing else.
 */
export default function ThemeEngineBridge({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  // The account is the source of truth once she's signed in, so her theme
  // follows her to any device. Before that, the engine falls back to the
  // cookie it set locally.
  const initial = useMemo<ThemeChoice | null>(() => {
    if (!user?.theme_primary || !user?.theme_secondary) return null;
    return {
      id: user.theme_id || "custom",
      primary: user.theme_primary,
      secondary: user.theme_secondary,
    };
  }, [user?.theme_id, user?.theme_primary, user?.theme_secondary]);

  const persist = useCallback(
    (theme: ThemeChoice) => {
      if (!user) return; // signed out: the cookie is enough
      // Fire and forget — a failed save must not undo what she just saw change.
      void apiSaveMyTheme(theme).catch(() => {});
    },
    [user],
  );

  return (
    <ThemeEngineProvider initial={initial} onPersist={persist}>
      {children}
    </ThemeEngineProvider>
  );
}
