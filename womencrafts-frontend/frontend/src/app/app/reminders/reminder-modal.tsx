"use client";

import { useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { useT } from "@/i18n";
import { I, v } from "@/components/ux/kit";
import { useDialogBehaviour } from "@/lib/use-dialog";

/**
 * Making a reminder, over the list rather than above it.
 *
 * It used to open inline at the top of the page, which pushed her reminders a
 * screen down and left a "Cancel" floating under a form the height of the
 * viewport. A reminder is a short, focused task with one outcome, so it is a
 * dialog: centred on a wide screen, a bottom sheet on a phone where the thumb
 * already is.
 *
 * The behaviour a dialog owes a keyboard user — Tab wrapping inside it, Esc,
 * focus back to the button that opened it, the page behind locked — is the
 * shared `useDialogBehaviour`, not re-written here.
 *
 * Portalled to `.ux`, not `document.body`: the colour tokens live on `.ux`, so
 * a panel rendered on the body shows every `var(--ux-*)` unresolved.
 */
const NEVER_CHANGES = () => () => {};

export function ReminderModal({
  open, onClose, title, children, busy = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** While saving, Esc and the dim do nothing — a close mid-request would
   *  leave her not knowing whether the reminder exists. */
  busy?: boolean;
}) {
  const tr = useT();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onClient = useSyncExternalStore(NEVER_CHANGES, () => true, () => false);
  const close = () => { if (!busy) onClose(); };

  useDialogBehaviour(open, panelRef, close);

  if (!open || !onClient) return null;

  return createPortal(
    <div className="fixed inset-0 z-[var(--ux-z-modal)] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        tabIndex={-1}
        aria-label={tr("sakhi.close")}
        onClick={close}
        className="ux-scrim absolute inset-0 cursor-default"
        style={{ background: "color-mix(in srgb, var(--ux-ink) 42%, transparent)" }}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-testid="reminder-modal"
        className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[22px] outline-none
                   max-sm:[animation:ux-sheet-up_320ms_cubic-bezier(0.32,0.72,0,1)] motion-reduce:[animation:none]
                   sm:max-h-[min(88dvh,820px)] sm:max-w-[640px] sm:rounded-[20px]"
        style={{
          background: v("--ux-surface"),
          border: `1px solid ${v("--ux-line-strong")}`,
          boxShadow: v("--ux-shadow-pop"),
        }}
      >
        {/* Grab bar — phone only; it says "this slides away". */}
        <span aria-hidden className="mx-auto mt-2.5 h-[4px] w-[44px] shrink-0 rounded-full sm:hidden"
              style={{ background: v("--ux-line-strong") }} />

        <div className="flex shrink-0 items-center gap-3 border-b px-5 py-3.5"
             style={{ borderColor: v("--ux-line") }}>
          <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full"
                style={{ background: v("--ux-brand-tint-2"), color: v("--ux-brand") }}>
            <I name="Bell" className="h-[18px] w-[18px]" />
          </span>
          <h2 id={titleId} className="min-w-0 flex-1 text-base font-bold tracking-[-0.01em]"
              style={{ color: v("--ux-ink") }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={close}
            disabled={busy}
            aria-label={tr("sakhi.close")}
            className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full transition-colors
                       hover:bg-[var(--ux-surface-2)] focus-visible:outline-2 focus-visible:outline-offset-2
                       focus-visible:outline-[var(--ux-brand)] disabled:opacity-50"
            style={{ color: v("--ux-ink-2") }}
          >
            <I name="X" className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-4"
             style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}>
          {children}
        </div>
      </div>
    </div>,
    document.querySelector(".ux") ?? document.body,
  );
}
