"use client";

import type { ReactNode } from "react";
import * as Icons from "@/components/ux/icons";

import { SectionHead } from "@/components/ux/settings/Frame";

/**
 * One settings section — drawn the way a phone draws it, and exactly as the
 * desktop always has.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * Every settings sub-page was a column of `Card`s, each opening on a 17px
 * semibold heading INSIDE the card, with its explanation in a tinted box at
 * the bottom of the card. On a laptop that is a tidy form. On a phone it is
 * the one thing a settings screen must never look like: a stack of web
 * panels. Native settings is grouped inset lists, always —
 *
 *   · a small, quiet, upper-case label ABOVE the group (12/600, muted);
 *   · the rows inside one hairline-bordered card;
 *   · the explanation as a footnote UNDER the group, in plain grey text.
 *
 * That is all this component does on a phone. From `lg` up it renders the
 * `Card` + `SectionHead` + tinted note the page used before, class for class,
 * so the desktop is unchanged.
 *
 * ── Two ways to fill it ────────────────────────────────────────────────────
 * `children` is shown at every size — the switches, which are already rows.
 * `phone`, when given, REPLACES `children` below `lg`: a three-up grid of
 * theme tiles or a two-column grid of languages is a desktop shape, and on a
 * phone the same choices are rows with a checkmark.
 *
 * `inset` says what the phone card holds: `rows` (switches, which carry their
 * own 12px of vertical padding, so the card adds only 4), `form` (fields and
 * paragraphs — 16 all round, the card spec) or `flush` (`ListRow`s, which own
 * their 16px inset and their pressed highlight, so the card adds nothing and
 * clips the highlight to its corners).
 *
 * The card is written out rather than taken from the kit `Card` because the
 * kit applies its padding as an inline style, and an inline style cannot be
 * given a different value on a phone. `lg:p-[18px]` is the kit's default of
 * 18, which is what every caller here was using.
 */
export function Group({
  title, sub, icon, chip, note, noteIcon = "Info", noteGap = "mt-3.5", phone, inset = "rows",
  cardStyle, children,
}: {
  /** Absent for a card that never had a heading. */
  title?: string;
  /** SectionHead's second line on a desktop; the footnote under the group on a phone. */
  sub?: string;
  icon?: string;
  chip?: string;
  /** The explanation — a tinted box inside the card on a desktop, a footnote on a phone. */
  note?: ReactNode;
  noteIcon?: string;
  /** The desktop box's top margin, as each page had it. */
  noteGap?: string;
  /** Phone-only content that replaces `children` below `lg`. */
  phone?: ReactNode;
  inset?: "rows" | "form" | "flush";
  cardStyle?: React.CSSProperties;
  children?: ReactNode;
}) {
  const NoteIco = (Icons as unknown as Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>>)[noteIcon] ?? Icons.Info;
  const footnotes = [sub, note].filter(Boolean);

  return (
    /* `pt-1` on a phone: the page stacks sections 20px apart, and the spec's
       gap between groups is 24. From `lg` the page's own spacing stands. */
    <section className="pt-1 lg:pt-0">
      {title && (
        <h2 className="flex items-baseline gap-2 px-4 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.07em] lg:hidden"
            style={{ color: "var(--ux-muted)" }}>
          <span className="min-w-0 flex-1">{title}</span>
          {/* The chip ("Public", "Private") rides at the end of the label —
              it says who sees the group, which is part of what it is. */}
          {chip && <span className="shrink-0">{chip}</span>}
        </h2>
      )}

      <div className={`ux-card lg:p-[18px] ${INSET[inset]}`} style={cardStyle}>
        {title && (
          <div className="hidden lg:block">
            <SectionHead title={title} sub={sub} icon={icon} chip={chip} />
          </div>
        )}

        {phone ? (
          <>
            <div className="lg:hidden">{phone}</div>
            <div className="hidden lg:block">{children}</div>
          </>
        ) : children}

        {note && (
          <p className={`${noteGap} hidden items-start gap-2.5 rounded-[12px] p-3 text-xs leading-relaxed lg:flex`}
             style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>
            <NoteIco className="mt-[1px] h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-brand)" }} />
            {note}
          </p>
        )}
      </div>

      {footnotes.map((f, i) => (
        <p key={i} className="px-4 pt-2 text-[13px] leading-snug lg:hidden" style={{ color: "var(--ux-muted)" }}>
          {f}
        </p>
      ))}
    </section>
  );
}

const INSET = {
  rows: "px-4 py-1",
  form: "p-4",
  flush: "p-0 max-lg:overflow-hidden",
} as const;

/**
 * The bar under a settings form: what state it is in, and the button that
 * saves it. Side by side on a desktop, as before; on a phone the button is
 * full width and last, where a thumb is.
 */
export function SaveBar({ status, tone, children }: {
  status: ReactNode;
  /** The status line's colour token. */
  tone: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
      <p className="px-4 text-[13px] max-lg:leading-snug lg:px-0 lg:text-xs" style={{ color: `var(${tone})` }}>{status}</p>
      {children}
    </div>
  );
}
