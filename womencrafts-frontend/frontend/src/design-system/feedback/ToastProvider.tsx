"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

import type { Tone } from "../primitives/Badge";

/**
 * Transient confirmations, in one place.
 *
 * ── What this replaces ──────────────────────────────────────────────────────
 * 66 files each kept their own `saved` boolean and their own
 * `setTimeout(() => setSaved(false), 2500)`. Every one of them picked its own
 * duration, its own wording, its own position on the page, and its own
 * decision about whether a failure was worth mentioning at all. Some cleared
 * the flag on unmount; most did not.
 *
 * ── What a toast is FOR, and what it is not ─────────────────────────────────
 * A toast reports something that already happened and is over: saved, sent,
 * deleted. It is the right shape for exactly that.
 *
 * It is the WRONG shape for:
 *
 *   · Form validation. "Email is required" must stay next to the email field.
 *     A message that names a field, then disappears before you reach it, is
 *     worse than no message — the user now knows something is wrong and has
 *     lost the only clue about where.
 *
 *   · A failed load. That is a STATE, not an event: the data is still missing
 *     after the toast fades. See ConnectionBanner and ErrorState.
 *
 * So this deliberately does not become the app's only feedback channel. It
 * handles the "done" case, and leaves the other two where they belong.
 */

export type ToastTone = "ok" | "danger" | "warn" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  description?: string;
  /** A single action — usually Undo or Retry. */
  action?: ToastAction;
  /** Milliseconds on screen. 0 keeps it until dismissed. */
  duration?: number;
}

interface Toast extends ToastOptions {
  id: number;
  tone: ToastTone;
  title: string;
}

interface ToastApi {
  success: (title: string, options?: ToastOptions) => number;
  error: (title: string, options?: ToastOptions) => number;
  warn: (title: string, options?: ToastOptions) => number;
  info: (title: string, options?: ToastOptions) => number;
  show: (tone: ToastTone, title: string, options?: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/**
 * Long enough to read, short enough not to nag — and, for anything with a
 * button on it, no deadline at all. See the two constants below.
 */
/* Six, not the conventional four. This product's readers are frequently
   reading in a second language on a small screen, and a confirmation that
   vanishes before it is read is not a confirmation. Hover and focus still
   hold it open indefinitely.

   Six is also what Adobe's accessibility spec for Toast arrives at from the
   other direction — "5 seconds plus 1 extra second for every 120 words" — and
   React Aria enforces a 5s floor on the same reasoning. Material's 4s is the
   floor for a language you read fluently. */
const DEFAULT_MS = 6000;

/**
 * A toast with something to press does not expire at all.
 *
 * This was 9000ms, on the reasoning that "Deleted · Undo" needs longer than a
 * bare confirmation. It does — but "longer" is not the same as "long enough",
 * and there is no number that is. React Aria states the rule plainly:
 * "actionable toasts will not auto dismiss." A keyboard user has to tab to the
 * button; a screen-reader user has to hear the announcement, find the region
 * and navigate into it; a woman reading her second language word by word has
 * to finish the sentence first. Every one of those takes longer than nine
 * seconds on a bad day, and an Undo that expires while she is reaching for it
 * is worse than no Undo, because she believes she still has one.
 *
 * It is dismissible, three of them at most are ever on screen, and a caller
 * that genuinely wants a deadline can still pass `duration`.
 */
const WITH_ACTION_MS = 0;

const TONE_ICON: Record<ToastTone, React.ElementType> = {
  ok: CheckCircle2,
  danger: XCircle,
  warn: AlertTriangle,
  info: Info,
};

const TONE_CLASS: Record<ToastTone, string> = {
  ok: "border-status-ok-border bg-status-ok-bg text-status-ok-ink",
  danger: "border-status-danger-border bg-status-danger-bg text-status-danger-ink",
  warn: "border-status-warn-border bg-status-warn-bg text-status-warn-ink",
  info: "border-status-info-border bg-status-info-bg text-status-info-ink",
};

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) {
    throw new Error("useToast must be used inside <ToastProvider>. It is mounted in app/layout.tsx.");
  }
  return api;
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  // Timers live in a ref, not in state: restarting one must not re-render the
  // whole stack, or hovering a toast would animate its neighbours.
  const timers = useRef(new Map<number, { handle: number; endsAt: number; left: number }>());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) window.clearTimeout(t.handle);
    timers.current.delete(id);
    setToasts((list) => list.filter((x) => x.id !== id));
  }, []);

  const arm = useCallback(
    (id: number, ms: number) => {
      if (ms <= 0) return; // sticky
      const handle = window.setTimeout(() => dismiss(id), ms);
      timers.current.set(id, { handle, endsAt: Date.now() + ms, left: ms });
    },
    [dismiss]
  );

  const show = useCallback(
    (tone: ToastTone, title: string, options: ToastOptions = {}) => {
      const id = nextId.current++;
      const duration = options.duration ?? (options.action ? WITH_ACTION_MS : DEFAULT_MS);
      setToasts((list) => {
        // Three is the most anyone reads. Beyond that the oldest is gone before
        // it has been looked at, so keeping it only pushes the new one down.
        const next = [...list, { id, tone, title, ...options }];
        return next.slice(-3);
      });
      arm(id, duration);
      return id;
    },
    [arm]
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (title, o) => show("ok", title, o),
      error: (title, o) => show("danger", title, o),
      warn: (title, o) => show("warn", title, o),
      info: (title, o) => show("info", title, o),
      dismiss,
    }),
    [show, dismiss]
  );

  // Clear every pending timer if the provider goes away, so a toast cannot fire
  // into an unmounted tree.
  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const { handle } of map.values()) window.clearTimeout(handle);
      map.clear();
    };
  }, []);

  /**
   * Hovering or focusing a toast holds it on screen.
   *
   * Without this, moving the mouse towards an "Undo" button is a race against
   * the timer — and reaching it by keyboard is a race you lose, because tabbing
   * to it takes longer than the toast lives.
   */
  const pause = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (!t) return;
    window.clearTimeout(t.handle);
    timers.current.set(id, { ...t, left: Math.max(600, t.endsAt - Date.now()) });
  }, []);

  const resume = useCallback(
    (id: number) => {
      const t = timers.current.get(id);
      if (!t) return;
      arm(id, t.left);
    },
    [arm],
  );

  /**
   * A toast raised while the tab is in the background is not a toast anybody
   * saw. Radix pauses on window blur for this reason and so does Android's
   * Snackbar, whose timeout restarts when the window regains focus. On a phone
   * this is the case where she taps Save, the screen goes to a phone call, and
   * she comes back to an app that has quietly forgotten to tell her anything.
   */
  useEffect(() => {
    const hold = () => timers.current.forEach((_, id) => pause(id));
    const go = () => timers.current.forEach((_, id) => resume(id));
    window.addEventListener("blur", hold);
    window.addEventListener("focus", go);
    return () => {
      window.removeEventListener("blur", hold);
      window.removeEventListener("focus", go);
    };
  }, [pause, resume]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/*
        The list is mounted permanently, even when empty. A live region that is
        added to the page at the same moment as its content is often missed
        entirely — the screen reader has nothing to notice a change against. It
        has to be there first, and stay.
      */}
      <ol
        aria-live="polite"
        aria-relevant="additions text"
        aria-atomic="false"
        aria-label="Notifications"
        className="pointer-events-none fixed right-4 top-4 z-[var(--ux-z-toast)] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((t) => {
          const Icon = TONE_ICON[t.tone];
          return (
            <li
              key={t.id}
              // A failure interrupts; a confirmation waits its turn. Announcing
              // "Saved" over whatever the user was reading is rude, but staying
              // quiet about a failure is worse.
              role={t.tone === "danger" ? "alert" : "status"}
              onMouseEnter={() => pause(t.id)}
              onMouseLeave={() => resume(t.id)}
              onFocusCapture={() => pause(t.id)}
              onBlurCapture={() => resume(t.id)}
              className={`wc-toast-in pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur ${TONE_CLASS[t.tone]}`}
            >
              <Icon className="mt-0.5 h-4.5 w-4.5 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t.title}</p>
                {t.description && <p className="mt-0.5 text-xs opacity-90">{t.description}</p>}
                {t.action && (
                  <button
                    onClick={() => {
                      t.action?.onClick();
                      dismiss(t.id);
                    }}
                    className="mt-1.5 text-xs font-bold underline underline-offset-2 hover:opacity-80"
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                aria-label={`Dismiss: ${t.title}`}
                className="-mr-1 rounded-lg p-1 opacity-70 transition hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          );
        })}
      </ol>
    </ToastContext.Provider>
  );
}

/** Kept for callers that map a Badge tone onto a toast. */
export function toneToToast(tone: Tone): ToastTone {
  if (tone === "emerald") return "ok";
  if (tone === "rose") return "danger";
  if (tone === "amber") return "warn";
  return "info";
}
