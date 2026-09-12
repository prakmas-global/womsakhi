"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import * as Icons from "@/components/ux/icons";

import { overlayRoot } from "./Sheet";

/**
 * The short-lived confirmation.
 *
 * ── Why this is a module store and not a React context ──────────────────────
 * A provider has to be mounted above everything that raises a toast, which
 * means editing the root layout. This library has to be droppable into a
 * screen without rewiring the app — and the root layout already carries the
 * design-system `ToastProvider` for the desktop app, so adding a second
 * provider around the same tree is a merge conflict waiting to happen.
 *
 * A module-level store with `useSyncExternalStore` gives the same API with no
 * provider at all: `toast("Saved")` from anywhere, `<ToastHost />` once. The
 * store is the external system React subscribes to, which is precisely what
 * that hook exists for.
 *
 * ── Where it sits ──────────────────────────────────────────────────────────
 * Above the tab bar, never behind it. `--tabbar-h` already includes the home
 * indicator, so `calc(var(--tabbar-h) + 12px)` clears both without this file
 * needing to know how tall either one is. On a desktop there is no tab bar, so
 * from `lg:` up it sits on the safe area alone.
 *
 * ── What a screen reader hears ──────────────────────────────────────────────
 * Each toast is its own `role="status"` (or `role="alert"` when something
 * failed), inserted into a live region. Errors interrupt; confirmations wait
 * their turn. A toast that only exists visually is a message half the audience
 * never receives, and toasts are how this app says "your money moved".
 */

export type ToastTone = "info" | "success" | "error";

export type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
  /** One optional button — "Undo", "View", "Retry". */
  action?: { label: string; onPress: () => void };
  /** ms on screen. `0` means it stays until dismissed. */
  duration: number;
  leaving: boolean;
};

/** How long the leave transition below takes. */
const LEAVE_MS = 200;

let items: ToastItem[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const timers = new Map<number, number>();

const emit = () => {
  for (const l of listeners) l();
};

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

/** The snapshot identity only changes when the list does — required by
 *  `useSyncExternalStore`, which re-renders forever if it returns a new array. */
const getSnapshot = () => items;
const EMPTY: ToastItem[] = [];
const getServerSnapshot = () => EMPTY;

function remove(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

/** Take it off screen, then out of the DOM once it has finished leaving. */
export function dismissToast(id: number) {
  const t = items.find((x) => x.id === id);
  if (!t || t.leaving) return;
  const timer = timers.get(id);
  if (timer) window.clearTimeout(timer);
  timers.delete(id);
  items = items.map((x) => (x.id === id ? { ...x, leaving: true } : x));
  emit();
  window.setTimeout(() => remove(id), LEAVE_MS);
}

/**
 * Raise a toast from anywhere — an event handler, a mutation callback, a
 * catch block. Returns its id, so a long-running one can be dismissed by hand.
 */
export function toast(
  message: string,
  opts: { tone?: ToastTone; action?: ToastItem["action"]; duration?: number } = {},
): number {
  const id = ++seq;
  const duration = opts.duration ?? (opts.tone === "error" ? 6000 : 3600);
  items = [...items, { id, message, tone: opts.tone ?? "info", action: opts.action, duration, leaving: false }];
  emit();
  if (duration > 0) {
    timers.set(id, window.setTimeout(() => dismissToast(id), duration));
  }
  return id;
}

/** Test and teardown helper — clears everything without animating. */
export function clearToasts() {
  for (const t of timers.values()) window.clearTimeout(t);
  timers.clear();
  items = [];
  emit();
}

const TONE: Record<ToastTone, { icon: keyof typeof Icons; color: string; tint: string }> = {
  info: { icon: "Info", color: "var(--ux-brand)", tint: "var(--ux-brand-tint-2)" },
  success: { icon: "Check", color: "var(--ux-green-ink)", tint: "var(--ux-tint-green)" },
  error: { icon: "AlertTriangle", color: "var(--ux-danger-ink)", tint: "var(--ux-danger-tint)" },
};

const NEVER_CHANGES = () => () => {};

export function ToastHost({
  max = 3,
  label = "Notifications",
  dismissLabel = "Dismiss",
}: {
  /** Older toasts are dropped rather than stacked forever. */
  max?: number;
  label?: string;
  dismissLabel?: string;
}) {
  const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const onClient = useSyncExternalStore(NEVER_CHANGES, () => true, () => false);
  if (!onClient) return null;

  return createPortal(
    <div
      role="region"
      aria-label={label}
      data-ux-toast-host
      // Not `pointer-events-none` on the cards themselves — the region is
      // transparent to taps so the screen underneath stays usable, and each
      // card switches them back on for its own buttons.
      className="pointer-events-none fixed inset-x-0 z-[var(--ux-z-toast)] flex flex-col items-center gap-2
                 bottom-[calc(var(--tabbar-h,58px)+12px)]
                 lg:bottom-[calc(env(safe-area-inset-bottom,0px)+24px)]"
      style={{
        paddingInlineStart: "max(12px, var(--sa-left, 0px))",
        paddingInlineEnd: "max(12px, var(--sa-right, 0px))",
      }}
    >
      {list.slice(-max).map((t) => {
        const tone = TONE[t.tone];
        const Ico = Icons[tone.icon] as React.ComponentType<{ className?: string }>;
        return (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={`ux-sheet pointer-events-auto flex w-full max-w-[440px] items-center gap-2.5 rounded-[var(--ux-r-lg)] py-1.5 ps-3 pe-1.5
                        transition-[opacity,transform] duration-200 motion-reduce:transition-none
                        ${t.leaving ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"}`}
            style={{ transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)" }}
          >
            <span
              aria-hidden="true"
              className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full"
              style={{ background: tone.tint, color: tone.color }}
            >
              <Ico className="h-[15px] w-[15px]" />
            </span>

            <p className="min-w-0 flex-1 py-1.5 text-[14px] font-medium leading-snug" style={{ color: "var(--ux-ink)" }}>
              {t.message}
            </p>

            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onPress();
                  dismissToast(t.id);
                }}
                className="ux-press shrink-0 rounded-[var(--ux-r-sm)] px-3 py-2 text-[13px] font-bold"
                style={{ color: "var(--ux-brand)" }}
              >
                {t.action.label}
              </button>
            )}

            <button
              type="button"
              aria-label={dismissLabel}
              onClick={() => dismissToast(t.id)}
              className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-full"
              style={{ color: "var(--ux-faint)", transform: "none" }}
            >
              <Icons.X className="h-[15px] w-[15px]" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>,
    overlayRoot(),
  );
}
