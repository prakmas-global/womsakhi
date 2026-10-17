"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

export function AuthThemeToggle() {
  const { isDark, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="wsa-theme-pill is-loading" aria-hidden="true">
        <span className="wsa-theme-btn">
          <Sun className="wsa-theme-ic" />
          <span className="wsa-theme-label">Light</span>
        </span>
        <span className="wsa-theme-btn">
          <Moon className="wsa-theme-ic" />
          <span className="wsa-theme-label">Dark</span>
        </span>
      </div>
    );
  }

  return (
    <div
      className="wsa-theme-pill"
      role="radiogroup"
      aria-label="Color theme"
    >
      <button
        type="button"
        role="radio"
        aria-checked={!isDark}
        aria-label="Light mode"
        onClick={() => setTheme("light")}
        className={`wsa-theme-btn ${!isDark ? "is-active" : ""}`}
        title="Switch to Light mode"
      >
        <Sun className="wsa-theme-ic" aria-hidden="true" />
        <span className="wsa-theme-label">Light</span>
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={isDark}
        aria-label="Dark mode"
        onClick={() => setTheme("dark")}
        className={`wsa-theme-btn ${isDark ? "is-active" : ""}`}
        title="Switch to Dark mode"
      >
        <Moon className="wsa-theme-ic" aria-hidden="true" />
        <span className="wsa-theme-label">Dark</span>
      </button>
    </div>
  );
}

export default AuthThemeToggle;
