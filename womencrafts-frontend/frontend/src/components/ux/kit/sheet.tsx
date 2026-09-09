"use client";

import { useId, useRef } from "react";

import * as Icons from "@/components/ux/icons";
import { useDialogBehaviour } from "@/lib/use-dialog";

/**
 * One overlay that is a drawer on a desktop and a bottom sheet on a phone.
 *
 * ── Why one component and not two ───────────────────────────────────────────
 * They are the same thing: a panel that slides in from an edge, holds a
 * secondary task, and leaves the page behind it visible so she does not lose
 * her place. Which edge is a question about the pointer, not about the content
 * — so it is answered in CSS, and every caller writes one thing.
 *
 * Building them separately is how a filter panel ends up with an Apply button
 * on desktop and no Apply button on mobile.
 *
 * ── Why a sheet rather than a modal for filters ─────────────────────────────
 * A modal takes the screen and demands an answer. Filtering is not a question —
 * she is adjusting what she is already looking at, and being able to see the
 * list change behind the panel is most of the value. Modals are for focused
 * decisions and confirmations (§88); this is for everything else.
 *
 * ── The grab handle is not decoration ───────────────────────────────────────
 * On a phone the bar at the top is the only affordance that says "this can be
 * dismissed by dragging". It is also a large, forgiving close target for a
 * woman using one hand, which is why it is a real button with a label rather
 * than a `<div>` that looks like one.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  side = "end",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Sticky action row — Apply and Clear live here, not in the body. */
  footer?: React.ReactNode;
  /** Which edge on a wide screen. Always the bottom on a phone. */
  side?: "start" | "end";
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useDialogBehaviour(open, panelRef, onClose);

  if (!open) return null;

  const edge = side === "start" ? "sm:left-0 sm:right-auto" : "sm:right-0 sm:left-auto";

  return (
    <div className="fixed inset-0 z-[var(--ux-z-modal)]">
      {/* The dim. Lighter than a modal's on purpose — she is meant to keep
          seeing what she is filtering. */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 z-[var(--ux-z-overlay)]"
        style={{ background: "color-mix(in srgb, var(--ux-ink) 32%, transparent)" }}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`ux-sheet absolute inset-x-0 bottom-0 z-[var(--ux-z-modal)] flex max-h-[88vh] flex-col rounded-t-[20px]
                    sm:inset-y-0 sm:bottom-auto sm:max-h-none sm:w-[min(420px,100vw)] sm:rounded-none ${edge}`}
        style={{ background: "var(--ux-surface)", boxShadow: "var(--ux-shadow-pop)" }}
      >
        {/* Grab handle — phone only. A real button, because it is also the
            largest and most forgiving way to close this one-handed. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="mx-auto mt-2.5 flex h-[24px] w-full max-w-[120px] shrink-0 items-center justify-center sm:hidden"
        >
          <span className="h-[4px] w-[44px] rounded-full" style={{ background: "var(--ux-line-strong)" }} />
        </button>

        <div className="flex shrink-0 items-start gap-3 border-b px-5 py-4"
             style={{ borderColor: "var(--ux-line)" }}>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-bold tracking-[-0.01em]" style={{ color: "var(--ux-ink)" }}>
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-xsm" style={{ color: "var(--ux-muted)" }}>{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ux-press ux-sq -mr-1 hidden h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[8px] sm:flex"
            style={{ color: "var(--ux-muted)" }}
          >
            <Icons.X className="h-[1rem] w-[1rem]" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <div className="shrink-0 border-t px-5 py-3.5"
               style={{ borderColor: "var(--ux-line)",
                        paddingBottom: "calc(0.875rem + env(safe-area-inset-bottom, 0px))" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
