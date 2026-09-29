"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { Toaster, toast as sonner } from "sonner";

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

/*
  Rendering is Sonner's (swipe to dismiss on touch, pause on hover and while
  the tab is hidden, a live region mounted before anything is announced,
  stacking). The rules above stay ours: 6 s by default, no deadline on an
  action, three on screen at most, a failure announced as an alert.
*/
const SONNER_TYPE: Record<ToastTone, "success" | "error" | "warning" | "info"> = {
  ok: "success",
  danger: "error",
  warn: "warning",
  info: "info",
};

/** Top-center on phones — the keyboard never covers it; top-right from 640 px. */
function usePosition(): "top-center" | "top-right" {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return wide ? "top-right" : "top-center";
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const nextId = useRef(1);
  const position = usePosition();
  const [alertText, setAlertText] = useState("");

  const dismiss = useCallback((id: number) => {
    sonner.dismiss(id);
  }, []);

  const show = useCallback((tone: ToastTone, title: string, options: ToastOptions = {}) => {
    const id = nextId.current++;
    const duration = options.duration ?? (options.action ? WITH_ACTION_MS : DEFAULT_MS);
    sonner[SONNER_TYPE[tone]](title, {
      id,
      description: options.description,
      duration: duration <= 0 ? Infinity : duration,
      action: options.action
        ? { label: options.action.label, onClick: () => options.action?.onClick() }
        : undefined,
    });
    // A failure interrupts; a confirmation waits its turn. Sonner's region is
    // polite, so failures are also read out through the alert region below.
    if (tone === "danger") setAlertText(options.description ? `${title}. ${options.description}` : title);
    return id;
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (title, o) => show("ok", title, o),
      error: (title, o) => show("danger", title, o),
      warn: (title, o) => show("warn", title, o),
      info: (title, o) => show("info", title, o),
      dismiss,
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Mounted permanently: a live region added together with its text is
          often missed by screen readers. */}
      <div role="alert" aria-atomic="true" className="sr-only">{alertText}</div>
      <Toaster
        position={position}
        visibleToasts={3}
        closeButton
        gap={8}
        offset={16}
        mobileOffset={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)", left: 12, right: 12 }}
        containerAriaLabel="Notifications"
        style={{ zIndex: "var(--ux-z-toast)" } as React.CSSProperties}
        icons={{
          success: <CheckCircle2 className="h-4.5 w-4.5" aria-hidden />,
          error: <XCircle className="h-4.5 w-4.5" aria-hidden />,
          warning: <AlertTriangle className="h-4.5 w-4.5" aria-hidden />,
          info: <Info className="h-4.5 w-4.5" aria-hidden />,
        }}
        toastOptions={{
          unstyled: true,
          classNames: {
            toast: "wc-toast pointer-events-auto flex w-full items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur",
            title: "text-sm font-semibold",
            description: "mt-0.5 text-xs opacity-90",
            icon: "mt-0.5 shrink-0",
            content: "min-w-0 flex-1",
            actionButton: "mt-1.5 shrink-0 self-center rounded-lg px-2 py-1 text-xs font-bold underline underline-offset-2 hover:opacity-80",
            closeButton: "wc-toast-close",
            success: TONE_CLASS.ok,
            error: TONE_CLASS.danger,
            warning: TONE_CLASS.warn,
            info: TONE_CLASS.info,
          },
        }}
      />
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
