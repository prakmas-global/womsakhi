"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";

import * as Icons from "@/components/ux/icons";

/**
 * The grouped list — the single most-used surface in any phone app.
 *
 * ── The separator is the whole job ──────────────────────────────────────────
 * A web list draws a full-width rule between rows. iOS never has. The rule
 * starts where the TEXT starts — after the icon or the avatar — and that one
 * detail is what makes a column of rows read as a list rather than as a table.
 * Draw it edge to edge and the screen looks like a spreadsheet no matter how
 * good the typography is, and nobody can tell you why.
 *
 * So each row draws its own hairline, inset to line up with its own title, and
 * the group hides the last one — a rule after the final row would double up
 * with the group's own border.
 *
 * ── The pressed state is a highlight, not a shrink ──────────────────────────
 * `mobile.css` scales buttons to 0.97 on press, which is right for a pill and
 * wrong for a full-bleed row: a 360px-wide row visibly shrinking away from
 * both margins reads as a glitch. Rows opt out (`transform: none`) and take
 * the iOS treatment instead — the row fills with a light grey for as long as
 * the finger is down. Same feedback, correct idiom.
 */

export type RowTint = "violet" | "blue" | "green" | "pink" | "amber" | "orange";

/** Where the hairline starts: past the leading element, or at the text margin. */
const INSET_WITH_LEADING = 60;
const INSET_PLAIN = 16;

type ListRowProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  /** A name from `@/components/ux/icons`, drawn in a tinted tile. */
  icon?: string;
  tint?: RowTint;
  /** An avatar or any other leading node. Wins over `icon` if both are given. */
  avatar?: ReactNode;
  /** The grey right-hand value — "On", "3 members", "₹1,200". */
  value?: ReactNode;
  /** A control that lives in the row: a switch, a stepper, a checkmark. */
  trailing?: ReactNode;
  /** Defaults to true when the row navigates, false when it does not. */
  chevron?: boolean;
  href?: string;
  onClick?: () => unknown;
  disabled?: boolean;
  /** Delete / Leave / Sign out — the row that should look like it means it. */
  destructive?: boolean;
  /** For a row that is one of several choices. */
  selected?: boolean;
};

export function ListRow({
  title,
  subtitle,
  icon,
  tint = "violet",
  avatar,
  value,
  trailing,
  chevron,
  href,
  onClick,
  disabled = false,
  destructive = false,
  selected,
}: ListRowProps) {
  const interactive = Boolean(href || onClick);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const showChevron = chevron ?? Boolean(href);
  const leading = Boolean(avatar || icon);
  const Ico = icon
    ? (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[icon]
    : undefined;

  const ink = destructive ? "var(--ux-danger-ink)" : "var(--ux-ink)";

  const inner = (
    <>
      {avatar ??
        (Ico ? (
          <span
            aria-hidden="true"
            className="grid h-[32px] w-[32px] shrink-0 place-items-center rounded-[var(--ux-r-sm)]"
            style={{
              background: destructive ? "var(--ux-danger-tint)" : `var(--ux-tint-${tint})`,
              color: destructive ? "var(--ux-danger-ink)" : `var(--ux-${tint}-ink)`,
            }}
          >
            <Ico className="h-[17px] w-[17px]" />
          </span>
        ) : null)}

      <span className="min-w-0 flex-1 text-start">
        <span className="block truncate text-[15px] font-semibold leading-tight" style={{ color: ink }}>
          {title}
        </span>
        {subtitle && (
          <span className="mt-0.5 block truncate text-[13px] leading-snug" style={{ color: "var(--ux-muted)" }}>
            {subtitle}
          </span>
        )}
      </span>

      {value != null && (
        <span className="shrink-0 text-[15px] tabular-nums" style={{ color: "var(--ux-muted)" }}>
          {value}
        </span>
      )}
      {trailing}
      {selected && (
        <Icons.Check className="h-[18px] w-[18px] shrink-0" style={{ color: "var(--ux-brand)" }} aria-hidden="true" />
      )}
      {showChevron && (
        <Icons.ChevronRight
          className="h-[17px] w-[17px] shrink-0 rtl:rotate-180"
          style={{ color: "var(--ux-faint)" }}
          aria-hidden="true"
        />
      )}

      {/* The hairline. Absolutely positioned so it can start after the icon,
          and hidden on the group's last row by a rule in `ListGroup`. */}
      <span
        data-ux-sep
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 end-0 h-px"
        style={{
          insetInlineStart: `${leading ? INSET_WITH_LEADING : INSET_PLAIN}px`,
          background: "var(--ux-line)",
        }}
      />
    </>
  );

  const cls = [
    "relative flex w-full items-center gap-3 bg-transparent px-4 py-2.5 text-start",
    "min-h-[52px]",
    interactive && !disabled ? "active:bg-[var(--ux-surface-2)]" : "",
    disabled || busy ? "opacity-50" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // `transform: none` beats mobile.css's 0.97 press scale — see the note above.
  // `background` is NOT inline. It used to be, as `transparent`, and an inline
  // style beats every class — including `active:bg-*` — so no row anywhere in
  // the app ever showed it had been pressed. The default lives in the class
  // list now, where the pressed state can override it.
  const style = { transform: "none" } as const;

  if (href && !disabled) {
    return (
      <Link href={href} className={cls} style={style} aria-current={selected ? "true" : undefined}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    const guarded = () => {
      if (disabled || running.current) return;
      const result = onClick();
      if (
        result &&
        typeof result === "object" &&
        "finally" in result &&
        typeof (result as Promise<unknown>).finally === "function"
      ) {
        const pending = result as Promise<unknown>;
        running.current = true;
        setBusy(true);
        pending.finally(() => { running.current = false; setBusy(false); });
      }
    };
    return (
      <button
        type="button"
        onClick={guarded}
        disabled={disabled || busy}
        aria-busy={busy || undefined}
        aria-pressed={selected === undefined ? undefined : selected}
        className={cls}
        style={style}
      >
        {inner}
      </button>
    );
  }
  return (
    <div className={cls} style={style}>
      {inner}
    </div>
  );
}

/**
 * The card a run of rows sits in.
 *
 * The `[&>*:last-child_[data-ux-sep]]:hidden` arbitrary variant is what hides
 * the final hairline. A descendant combinator rather than a child one, so a
 * row wrapped in `SwipeAction` is still recognised as the last row — with `>`
 * the wrapper broke the chain and the group grew a stray rule along its
 * bottom edge.
 */
export function ListGroup({
  title,
  footnote,
  children,
  className = "",
}: {
  /** The small grey caption above the card. */
  title?: ReactNode;
  /** The explanatory line under it — where a settings screen explains itself. */
  footnote?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      {title && (
        <h3
          className="px-4 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.07em]"
          style={{ color: "var(--ux-muted)" }}
        >
          {title}
        </h3>
      )}
      <div
        className="overflow-hidden rounded-[var(--ux-r-lg)] border [&>*:last-child_[data-ux-sep]]:hidden"
        style={{ background: "var(--ux-surface)", borderColor: "var(--ux-line)" }}
      >
        {children}
      </div>
      {footnote && (
        <p className="px-4 pt-1.5 text-[12px] leading-snug" style={{ color: "var(--ux-muted)" }}>
          {footnote}
        </p>
      )}
    </section>
  );
}
