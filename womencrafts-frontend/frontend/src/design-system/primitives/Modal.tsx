"use client";

import { useId, useRef } from "react";
import { X } from "lucide-react";

import type { Tone } from "./Badge";
import { useDialogBehaviour } from "@/lib/use-dialog";

/** Gradient header chip per tone. Covers the full design-system Tone set so a
 *  caller can pass any tone its data carries without narrowing it first. */
/**
 * Tone → gradient for the modal's icon chip.
 *
 * The `emerald`/`amber`/`sky`/`rose`/`blue` names are historical: they describe
 * a colour rather than a meaning, and several now resolve to the same status
 * token because that is what they always meant. `fuchsia` maps to the
 * secondary accent, which is the closest thing the theme has to it.
 *
 * A single-stop "gradient" is deliberate — a status token has one derived
 * value, and inventing a second stop would put an underived colour back in.
 */
const ICON_TONE: Record<Tone, string> = {
  brand: "bg-linear-to-br from-brand-500 to-brand-600",
  violet: "bg-linear-to-br from-violet-500 to-violet-600",
  emerald: "bg-status-ok-solid",
  amber: "bg-status-warn-solid",
  sky: "bg-status-info-solid",
  rose: "bg-status-danger-solid",
  fuchsia: "bg-linear-to-br from-violet-500 to-violet-600",
  blue: "bg-status-info-solid",
  slate: "bg-linear-to-br from-ink-faint to-ink-subtle",
};

/**
 * Premium, theme-aware modal: neumorphic floating card, gradient icon header,
 * soft-tinted backdrop, Esc-to-close and body scroll lock.
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  icon: Icon,
  iconTone = "brand",
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: React.ElementType;
  iconTone?: Tone;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Focus trap, scroll lock and focus return — shared with Sheet, because the
  // copied version is the one that drifts.
  useDialogBehaviour(open, panelRef, onClose);

  if (!open) return null;

  const sizeCls = size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-2xl" : "max-w-lg";

  return (
    <div className="fixed inset-0 z-[var(--ux-z-modal)] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-md dark:bg-black/70"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        // Names the dialog by its own heading, so opening it announces what it
        // is rather than a bare "dialog".
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`wc-page-enter wc-modal relative z-10 w-full ${sizeCls} max-h-[92vh] overflow-hidden rounded-3xl`}
      >
        {/* header */}
        <div className="relative flex items-start gap-3.5 border-b border-line px-6 py-5">
          <span
            className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand-500/10 blur-2xl"
            aria-hidden
          />
          {Icon && (
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg shadow-brand-500/25 ${ICON_TONE[iconTone]}`}
            >
              <Icon className="h-5 w-5" strokeWidth={2.2} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-lg font-bold tracking-tight text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-ink-subtle">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-subtle transition hover:bg-surface-hover hover:text-ink-muted dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* body */}
        <div className="max-h-[calc(92vh-9rem)] overflow-y-auto px-6 py-5">{children}</div>

        {/* footer */}
        {footer && (
          <div className="flex justify-end gap-3 border-t border-line bg-surface-inset/60 px-6 py-4 dark:bg-white/3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
