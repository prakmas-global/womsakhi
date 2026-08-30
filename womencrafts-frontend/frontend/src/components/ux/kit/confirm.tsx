"use client";

import { useEffect, useRef, useState } from "react";

import { Btn } from "./index";

/**
 * Press, confirm in place, act.
 *
 * `/bookings` and `/bookings/[id]` each hand-rolled this, with different
 * wording and different behaviour — one closed on a second press, one did not.
 * A woman who cancels a booking from the list and from its own page should be
 * asked the same question.
 *
 * **In place, not a dialog.** A dialog covers the thing it is asking about, so
 * she has to remember which booking she tapped while deciding whether to
 * cancel it. The confirmation appears where the button was, beside the row it
 * belongs to.
 *
 * **Both buttons the same size.** Backing out is not the lesser option, and
 * making "no" smaller and greyer is how an interface gets a decision it did
 * not earn.
 *
 * **It says what it costs someone else.** `cost` is not optional decoration:
 * cancelling a mentor session at short notice wastes an hour a woman set aside,
 * and she should know that before she confirms, not after.
 */
export function ConfirmButton({
  children,
  question,
  cost,
  confirmLabel,
  keepLabel = "Keep it",
  onConfirm,
  busy = false,
  variant = "ghost",
  size = "sm",
  icon,
  full,
}: {
  children: React.ReactNode;
  /** "Cancel it?" — short, and a question. */
  question: string;
  /** What it costs somebody else, if it does. */
  cost?: string;
  confirmLabel: string;
  keepLabel?: string;
  onConfirm: () => void | Promise<unknown>;
  busy?: boolean;
  variant?: "primary" | "soft" | "outline" | "ghost" | "on-brand";
  size?: "sm" | "md" | "lg";
  icon?: string;
  full?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Escape backs out, and so does clicking away. A confirmation she cannot
  // dismiss is a confirmation she will answer wrongly to be rid of.
  useEffect(() => {
    if (!asking) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setAsking(false); };
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setAsking(false);
    };
    window.addEventListener("keydown", key);
    // Deferred a tick, or the click that opened it closes it again.
    const t = window.setTimeout(() => window.addEventListener("mousedown", away), 0);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("mousedown", away);
      window.clearTimeout(t);
    };
  }, [asking]);

  if (!asking) {
    return (
      <Btn variant={variant} size={size} icon={icon} full={full} onClick={() => setAsking(true)}>
        {children}
      </Btn>
    );
  }

  return (
    <div ref={box} className="ux-slide-up ux-sq rounded-[13px] border p-3"
         style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)" }}
         role="group" aria-label={question}>
      <p className="text-[13px] font-semibold" style={{ color: "var(--ux-ink)" }}>{question}</p>
      {cost && (
        <p className="mt-1 text-[12px] leading-snug" style={{ color: "var(--ux-muted)" }}>{cost}</p>
      )}
      {/* Same size, same weight. Backing out is not the lesser option. */}
      <div className="mt-2.5 flex gap-2">
        <Btn variant="outline" size="sm" onClick={() => setAsking(false)}>{keepLabel}</Btn>
        <Btn variant="primary" size="sm"
             className={busy ? "pointer-events-none opacity-60" : ""}
             onClick={async () => { await onConfirm(); setAsking(false); }}>
          {busy ? "Just a moment…" : confirmLabel}
        </Btn>
      </div>
    </div>
  );
}
