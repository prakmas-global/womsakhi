"use client";

import { Check, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { useLayoutEngine } from "./LayoutEngineProvider";

/**
 * The switch between using the app and rearranging it, plus the way back out.
 *
 * ── Why a mode at all ───────────────────────────────────────────────────────
 * Without one, every nav item needs a permanent drag handle and every panel a
 * permanent grip, and the app starts looking like a settings screen. Worse, a
 * row that is both a link and a drag target is ambiguous on every single click.
 *
 * A mode makes the two states honest: normally these are links, and in
 * customise mode they are things you arrange.
 *
 * ── Why reset lives here ────────────────────────────────────────────────────
 * The way out of a broken layout must not be inside the thing you broke. This
 * bar is fixed to the viewport, is not itself customisable, and cannot be
 * hidden — so "put everything back" is always reachable, from any state.
 */
export default function CustomiseBar() {
  const { customising, setCustomising, resetAll, isCustomised } = useLayoutEngine();
  const [confirming, setConfirming] = useState(false);

  if (!customising) return null;

  return (
    <div
      role="region"
      aria-label="Customise layout"
      className="fixed inset-x-0 bottom-0 z-50 flex flex-wrap items-center justify-center gap-3 border-t border-[color:var(--wc-border-subtle)] bg-[color:var(--surface)] px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.25)]"
    >
      <p className="flex items-center gap-2 text-sm text-ink">
        <SlidersHorizontal className="h-4 w-4 text-brand-ink" aria-hidden />
        <span>
          <span className="font-semibold">Arranging your app.</span>{" "}
          <span className="text-ink-subtle">
            Drag to reorder, drag edges to resize. Everything saves as you go.
          </span>
        </span>
      </p>

      <div className="flex items-center gap-2">
        {isCustomised &&
          (confirming ? (
            <span className="flex items-center gap-2 rounded-xl bg-status-danger-bg px-3 py-1.5 dark:bg-rose-500/10">
              <span className="text-xs text-status-danger-ink dark:text-status-danger-ink">Put everything back?</span>
              <button
                onClick={() => {
                  resetAll();
                  setConfirming(false);
                }}
                className="rounded-lg bg-status-danger-solid px-2.5 py-1 text-xs font-semibold text-white transition hover:opacity-90"
              >
                Reset
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="text-xs font-semibold text-ink-subtle transition hover:text-ink-muted"
              >
                Keep
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-ink-muted transition hover:bg-[color:var(--surface-hover)]"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset everything
            </button>
          ))}

        <button
          onClick={() => setCustomising(false)}
          className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          <Check className="h-4 w-4" aria-hidden /> Done
        </button>
      </div>
    </div>
  );
}

/** Enters customise mode. Put it in the account menu, which is never hideable. */
export function CustomiseButton({ className = "" }: { className?: string }) {
  const { customising, setCustomising } = useLayoutEngine();

  return (
    <button
      onClick={() => setCustomising(!customising)}
      aria-pressed={customising}
      className={className}
    >
      <SlidersHorizontal className="h-4 w-4" aria-hidden />
      {customising ? "Done arranging" : "Arrange my app"}
    </button>
  );
}
