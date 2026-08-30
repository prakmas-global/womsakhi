"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, Theme } from "@/context/ThemeContext";

const OPTS: { v: Theme; Icon: React.ElementType; label: string; desc: string }[] = [
  { v: "light", Icon: Sun, label: "Light", desc: "Bright and clear" },
  { v: "dark", Icon: Moon, label: "Dark", desc: "Easy on the eyes" },
  { v: "system", Icon: Monitor, label: "System", desc: "Match your device" },
];

/** Light / Dark / System selector for the Settings › Appearance section. */
export default function ThemeSelect() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {OPTS.map(({ v, Icon, label, desc }) => {
        const active = theme === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => setTheme(v)}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
              active
                ? "border-violet-400 bg-violet-tint ring-2 ring-violet-200"
                : "border-line-strong bg-surface hover:bg-surface-hover"
            }`}
          >
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                active ? "bg-violet-600 text-white" : "bg-surface-inset text-ink-subtle"
              }`}
            >
              <Icon className="h-4.5 w-4.5" />
            </span>
            <span>
              <span className={`block text-sm font-semibold ${active ? "text-violet-ink" : "text-ink-muted"}`}>
                {label}
              </span>
              <span className="block text-xs text-ink-subtle">{desc}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
