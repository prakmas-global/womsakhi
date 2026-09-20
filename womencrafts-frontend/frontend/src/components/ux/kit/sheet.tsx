"use client";

import { useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

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
/** "Are we in the browser yet" — `document` does not exist during SSR, and a
 *  portal needs a real node. A stable subscribe, so React never resubscribes. */
const NEVER_CHANGES = () => () => {};

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  side = "end",
  icon,
  width = 420,
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
  /** Names the task in the header, beside the title. Optional on purpose —
   *  a filter panel does not need one, a form the length of a page does. */
  icon?: string;
  /** How wide on a desktop. A long form needs more room than a filter list. */
  width?: number;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  /**
   * Rendered into `document.body`, not where it is written.
   *
   * `z-index` only ranks siblings inside the same stacking context. Left in
   * the page tree, this drawer sat inside whatever context its parent made —
   * and HomeShell's sticky rail, in a later context, painted its tip cards
   * straight over the open sheet while the dim behind it worked perfectly.
   * No z-index on the sheet can win that; only leaving the context can.
   *
   * It goes to the shell's `.ux` element and NOT to `document.body`: the
   * colour tokens are declared on `.ux`, not on `:root`, so a sheet portalled
   * to the body renders with every `var(--ux-surface)` unresolved — no panel,
   * no dim, just floating text over the page.
   */
  const onClient = useSyncExternalStore(NEVER_CHANGES, () => true, () => false);

  useDialogBehaviour(open, panelRef, onClose);

  if (!open || !onClient) return null;

  const edge = side === "start" ? "sm:left-0 sm:right-auto" : "sm:right-0 sm:left-auto";

  return createPortal(
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
                    sm:inset-y-0 sm:max-h-none sm:w-[var(--ux-sheet-w)] sm:rounded-none ${edge}`}
        style={{ background: "var(--ux-surface)", boxShadow: "var(--ux-shadow-pop)",
                 // Tailwind cannot see a runtime width, so it is set here.
                 ["--ux-sheet-w" as string]: `min(${width}px, 100vw)` }}
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
          {icon && (() => {
            const Ico = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[icon]
                        ?? Icons.Circle;
            return (
              <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[12px]"
                    style={{ background: "var(--ux-brand-tint-2)", color: "var(--ux-brand)" }}>
                <Ico className="h-[19px] w-[19px]" />
              </span>
            );
          })()}
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
    </div>,
    document.querySelector(".ux") ?? document.body,
  );
}
