"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

/** Sun/Moon segmented pill used on the auth screens (and anywhere handy). */
export default function ThemeToggle() {
  const { isDark, setTheme } = useTheme();
  return (
    <div className="flex items-center gap-1 rounded-full border border-line-strong bg-surface p-1 shadow-sm">
      <button
        type="button"
        aria-label="Light mode"
        aria-pressed={!isDark}
        onClick={() => setTheme("light")}
        className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
          !isDark ? "bg-violet-tint text-violet-ink" : "text-ink-subtle hover:text-ink-muted"
        }`}
      >
        <Sun className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Dark mode"
        aria-pressed={isDark}
        onClick={() => setTheme("dark")}
        className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
          isDark ? "bg-violet-500/20 text-violet-300" : "text-ink-subtle hover:text-ink-muted"
        }`}
      >
        <Moon className="h-4 w-4" />
      </button>
    </div>
  );
}
