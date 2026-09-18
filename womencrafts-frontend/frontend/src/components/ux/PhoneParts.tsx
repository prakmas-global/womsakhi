"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import * as Icons from "@/components/ux/icons";

/**
 * The phone-only pieces the Circle, You, Settings and care screens share.
 *
 * Every one of these renders ONLY below `lg` (`lg:hidden`). The desktop
 * versions of those screens are left exactly as they were, behind
 * `hidden lg:*` at each call site — the same two-branch pattern the Hub, the
 * More screen and the Earn board already use. A `display: none` subtree is
 * invisible to assistive tech too, so nothing is announced twice.
 */

/* ── The top of a screen ─────────────────────────────────────────────────── */

/**
 * One large title, then at most a quiet line or two.
 *
 * Several screens opened on a website's header: a brand-coloured eyebrow, a
 * sentence-long headline in a `clamp()` that lands on 24px at 390px, then a
 * paragraph. On a phone that reads as a landing page, and the thing a native
 * screen puts first — its NAME, large — was the smallest text in the block.
 * So the name is the title (usually the word the eyebrow carried) and the
 * headline and paragraph follow as quiet text. Nothing is dropped.
 */
export function PhoneTitle({
  title, sub, note, children, className = "",
}: {
  title: ReactNode;
  /** The line under the title — 15px, secondary ink. */
  sub?: ReactNode;
  /** A second, quieter line — 15px, tertiary ink. */
  note?: ReactNode;
  /** Anything that belongs to the header itself — a segmented control. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`lg:hidden ${className}`}>
      <h1 className="ux-screen-title" style={{ color: "var(--ux-ink)" }}>{title}</h1>
      {sub && (
        <p className="mt-1.5 text-[15px] leading-snug" style={{ color: "var(--ux-ink-2)" }}>{sub}</p>
      )}
      {note && (
        <p className="mt-1.5 text-[15px] leading-snug" style={{ color: "var(--ux-muted)" }}>{note}</p>
      )}
      {children}
    </header>
  );
}

/* ── A section label ─────────────────────────────────────────────────────── */

/**
 * The small, quiet, upper-case label a phone writes above a group — 12/600,
 * tracked, tertiary ink — in place of the kit's 17px `SectionHead`, which on a
 * phone repeated the weight of a title above every group. Its `sub` goes
 * under the label as a 13px footnote, and a count goes at the end of the line.
 */
export function GroupLabel({ children, sub, count, className = "" }: {
  children: ReactNode;
  sub?: ReactNode;
  count?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`px-4 pb-2 lg:hidden ${className}`}>
      <h2 className="flex items-baseline gap-2 text-[12px] font-semibold uppercase tracking-[0.07em]"
          style={{ color: "var(--ux-muted)" }}>
        <span className="min-w-0 flex-1">{children}</span>
        {count != null && <span className="shrink-0 tabular-nums">{count}</span>}
      </h2>
      {sub && (
        <p className="mt-0.5 text-[13px] leading-snug" style={{ color: "var(--ux-muted)" }}>{sub}</p>
      )}
    </div>
  );
}

/* ── A row in a grouped list ─────────────────────────────────────────────── */

/**
 * A row for `ListGroup` whose text WRAPS.
 *
 * `ListRow` truncates its title and subtitle to one line each, which is right
 * for a settings row and wrong for a row whose second line is the substance —
 * "Uniforms outgrown, swap for a school bag", a question and why it is asked.
 * Truncated, those lose the words that make the row worth reading. This draws
 * the same row — 16px inset, a tinted 32px tile, the hairline starting under
 * the text, the pressed highlight — and lets the words run.
 *
 * `trailing` is for a control that lives in the row (a small button, a
 * switch). A row with one is never itself a link: a link holding a button is
 * two targets on top of each other.
 */
export function PhoneRow({
  icon, tint = "--ux-brand-tint", ink = "--ux-brand", lead, title, meta, body, trailing, children,
  href, onClick, chevron, selected, pressed, dim = false, sepInset,
}: {
  icon?: string;
  /** Token names, e.g. `--ux-tint-green` / `--ux-green-ink`. */
  tint?: string;
  ink?: string;
  /** Any other leading node — an avatar, an initial. Wins over `icon`. */
  lead?: ReactNode;
  title: ReactNode;
  /** 13px tertiary line under the title — where, when, how many. */
  meta?: ReactNode;
  /** 15px secondary line — the sentence that is the point of the row. */
  body?: ReactNode;
  trailing?: ReactNode;
  /** Extra content under the text — a revealed answer, an input. */
  children?: ReactNode;
  href?: string;
  onClick?: () => void;
  /** Defaults to true for a row that navigates. */
  chevron?: boolean;
  /** A choice among several: draws the brand checkmark. */
  selected?: boolean;
  /** For a toggle-style choice (`aria-pressed`). */
  pressed?: boolean;
  dim?: boolean;
  /** Where the hairline starts, when the leading node is not the 32px tile. */
  sepInset?: number;
}) {
  const Ico = icon
    ? (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[icon]
    : undefined;
  const leading = lead ?? (Ico ? (
    <span aria-hidden="true"
          className="mt-0.5 grid h-[32px] w-[32px] shrink-0 place-items-center rounded-[var(--ux-r-sm)]"
          style={{ background: `var(${tint})`, color: `var(${ink})` }}>
      <Ico className="h-[17px] w-[17px]" />
    </span>
  ) : null);
  const showChevron = chevron ?? Boolean(href);

  const inner = (
    <>
      {leading}
      <span className="min-w-0 flex-1 text-start">
        <span className="block text-[15px] font-semibold leading-snug" style={{ color: "var(--ux-ink)" }}>{title}</span>
        {meta && (
          <span className="mt-0.5 block text-[13px] leading-snug" style={{ color: "var(--ux-muted)" }}>{meta}</span>
        )}
        {body && (
          <span className="mt-1 block text-[15px] leading-snug" style={{ color: "var(--ux-ink-2)" }}>{body}</span>
        )}
        {children}
      </span>
      {trailing}
      {selected && (
        <Icons.Check className="mt-1 h-[18px] w-[18px] shrink-0" style={{ color: "var(--ux-brand)" }} aria-hidden="true" />
      )}
      {showChevron && (
        <Icons.ChevronRight className="mt-1 h-[17px] w-[17px] shrink-0 rtl:rotate-180"
                            style={{ color: "var(--ux-faint)" }} aria-hidden="true" />
      )}
      <span data-ux-sep aria-hidden="true" className="pointer-events-none absolute bottom-0 end-0 h-px"
            style={{ insetInlineStart: sepInset ?? (leading ? 60 : 16), background: "var(--ux-line)" }} />
    </>
  );

  const cls = `relative flex w-full min-h-[52px] items-start gap-3 bg-transparent px-4 py-3 text-start ${
    href || onClick ? "active:bg-[var(--ux-surface-2)]" : ""} ${dim ? "opacity-60" : ""}`;
  // `transform: none` beats mobile.css's press-scale, as `ListRow` does: a
  // full-width row shrinking away from both margins reads as a glitch. The
  // background is a CLASS, not part of this style: an inline `background`
  // would beat `active:bg-*` and the pressed highlight would never show.
  const style = { transform: "none" } as const;

  if (href) return <Link href={href} className={cls} style={style}>{inner}</Link>;
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls} style={style}
              aria-pressed={pressed ?? (selected === undefined ? undefined : selected)}>
        {inner}
      </button>
    );
  }
  return <div className={cls} style={style}>{inner}</div>;
}

/* ── A switch that meets the 44px floor ──────────────────────────────────── */

/**
 * The 46x26 track the screens already draw, with the TARGET grown to 44px on
 * a phone by a transparent 9px border above and below — the way
 * `settings/Frame`'s `Toggle` does it — so the switch looks the same and a
 * thumb can hit it. The negative margin keeps the row's height as it was.
 * From `lg` the border and margin go, and it is the 26px switch it always was.
 *
 * The knob stays white in both themes, as it was: it is a physical object on
 * a coloured track, not text, and a surface-coloured knob disappears into a
 * dark track.
 */
export function PhoneSwitch({ on, onChange, label, onInk = "--ux-fill", offInk = "--ux-track" }: {
  on: boolean;
  onChange: () => void;
  label: string;
  onInk?: string;
  offInk?: string;
}) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onChange}
            className="ux-press ux-tap-exempt relative -my-[9px] box-content h-[26px] w-[46px] shrink-0 rounded-full border-y-[9px] border-solid border-transparent bg-clip-padding transition-colors lg:my-0 lg:border-y-0"
            style={{ backgroundColor: `var(${on ? onInk : offInk})` }}>
      <span className="absolute top-[3px] h-[20px] w-[20px] rounded-full bg-white"
            style={{ insetInlineStart: on ? 23 : 3,
                     transition: "inset-inline-start var(--ux-t) var(--ux-ease-spring)",
                     boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }} />
    </button>
  );
}

/* ── The primary action ──────────────────────────────────────────────────── */

/**
 * Classes that make a kit `Btn` the phone's primary action: full width, 50px
 * tall, radius 14, 17px bold — and nothing at all from `lg` up.
 *
 * Why not `.ux-action-primary`: that shared rule sets `font-size: 16px`, which
 * is not a step on the phone type scale (12/13/15/17/20/24/28/34). It is
 * unlayered CSS, so no utility beside it can correct the size. These are the
 * same numbers on the scale, as `max-lg:` utilities, which also leave the
 * desktop button exactly as it was.
 */
export const phonePrimary =
  "max-lg:w-full max-lg:min-h-[50px] max-lg:rounded-[14px] max-lg:px-4 max-lg:text-[17px] max-lg:font-bold";

/** The same, for a secondary action that shares the primary's row. */
export const phoneSecondary =
  "max-lg:w-full max-lg:min-h-[50px] max-lg:rounded-[14px] max-lg:px-4 max-lg:text-[17px]";

/** A small kit `Btn` stretched across a row on a phone: the card inset, 16. */
export const phoneFull = "max-lg:px-4";
