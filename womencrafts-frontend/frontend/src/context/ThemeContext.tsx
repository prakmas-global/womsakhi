"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";

export type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme; // the user's preference
  isDark: boolean; // the resolved appearance
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveDark(theme: Theme) {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(theme: Theme) {
  const dark = resolveDark(theme);
  document.documentElement.classList.toggle("dark", dark);
  return dark;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [isDark, setIsDark] = useState(false);

  // hydrate from storage + keep in sync with the OS when on "system"
  useEffect(() => {
    const saved = (localStorage.getItem("theme") as Theme) || "light";
    const hydrate = window.setTimeout(() => {
      setThemeState(saved);
      setIsDark(applyTheme(saved));
    });

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const current = (localStorage.getItem("theme") as Theme) || "light";
      if (current === "system") setIsDark(applyTheme("system"));
    };
    mq.addEventListener("change", onChange);
    // A streamed client navigation can replace the server-owned <html> class
    // with a prefetched snapshot. Keep the saved preference authoritative so
    // choosing dark on the auth screen also survives the jump into the app.
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      const current = (localStorage.getItem("theme") as Theme) || "light";
      const expected = resolveDark(current);
      if (root.classList.contains("dark") !== expected) {
        root.classList.toggle("dark", expected);
        setThemeState(current);
        setIsDark(expected);
      }
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => {
      window.clearTimeout(hydrate);
      mq.removeEventListener("change", onChange);
      observer.disconnect();
    };
  }, []);

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem("theme", t);
    // Also a cookie, so the server can put the `dark` class on <html> itself
    // and we don't need a blocking inline script to avoid the flash.
    document.cookie = `theme=${t};path=/;max-age=31536000;samesite=lax`;
    setThemeState(t);
    setIsDark(applyTheme(t));
  }, []);

  const toggle = useCallback(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark");
  }, [setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}

/** Standalone hook (e.g. charts) that tracks the resolved dark state
 *  by observing the `dark` class on <html> — works without the provider. */
export function useIsDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setDark(root.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}
