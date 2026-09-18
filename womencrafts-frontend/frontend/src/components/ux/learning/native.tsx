"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import * as Icons from "@/components/ux/icons";
import { SegmentedControl } from "@/components/ux/mobile/SegmentedControl";
import { SectionHead, Tabs } from "@/components/ux/kit";

/**
 * The three shapes that make a Learn/Work screen read as an app on a phone.
 *
 * Every screen in both modules opened the same way: a `flex items-end
 * justify-between` header with the title and a subtitle on the left and a
 * `Tabs` control on the right. That is a desktop shape — it needs ~700px to
 * hold both halves — and at 390 it collapsed into two squeezed columns:
 * "24 womans ready / to help" stacked into a three-line stub beside a tab
 * strip whose labels had themselves broken in two ("Find a / mentor",
 * "Keep / going"). Measured on `/app/mentors` at 390x844.
 *
 * Rather than fix that eleven times, the shape is named once here. Each helper
 * is a phone shape that `lg:` puts back to exactly what desktop had, so the
 * 1440 rendering is byte-for-byte the old one and only the phone changes.
 *
 * These live under `learning/` and are re-exported from `work/native.tsx`
 * because those are the two folders this work owns; nothing about them is
 * specific to learning.
 */

/** Ids have to be one token — `aria-controls="Find a mentor"` is not a name. */
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * The screen title, and whatever control belongs beside it.
 *
 * On a phone: one big title (`.ux-screen-title` — 30px/800, from `mobile.css`),
 * the sentence under it at 15px rather than the web-habit 13.5px, and the
 * control on its own full-width line below where a segmented control can
 * actually be read. From `lg` up: the row it always was.
 */
export function ScreenHead({
  title, sub, note, children, className = "",
}: {
  title: ReactNode;
  sub?: ReactNode;
  /** `SourceNote` and friends — anything that belongs under the sentence. */
  note?: ReactNode;
  /** The control on the right at desktop, under the title on a phone. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-6 lg:mb-[20px] lg:flex lg:items-end lg:justify-between lg:gap-4 ${className}`}>
      <div className="min-w-0">
        <h1 className="ux-screen-title text-2xl font-bold" style={{ color: "var(--ux-ink)" }}>{title}</h1>
        {sub && (
          <p className="mt-2 text-[15px] leading-snug lg:mt-1.5 lg:text-xsm" style={{ color: "var(--ux-muted)" }}>
            {sub}
          </p>
        )}
        {note}
      </div>
      {children && <div className="mt-4 lg:mt-0 lg:shrink-0">{children}</div>}
    </div>
  );
}

/**
 * A filter that is a segmented control on a phone and the old `Tabs` on desktop.
 *
 * Both are rendered and one is `display: none`, which takes it out of the
 * accessibility tree as well as off the screen — so a screen reader is never
 * offered two tablists for the same choice.
 *
 * The signature is `Tabs`'s, so every call site is a one-word edit.
 */
export function Segments({
  items, active, onChange, label,
}: {
  items: string[];
  active: string;
  onChange: (t: string) => void;
  /** What the control is choosing between — "View", "Filter", "Period". */
  label: string;
}) {
  const options = items.map((t) => ({ value: slug(t), label: t }));
  const back = new Map(options.map((o) => [o.value, o.label]));

  /*
    Four segments do not fit at 390 with the control's own 12px of side
    padding: 350px of content minus the track's 6px, split four ways, leaves
    86px a segment and "Interviews" needs about 102px — so it rendered as
    "Intervi…". Halving the padding gives back 12px a segment, which is enough
    for every four-way filter in these two modules, and it changes nothing at
    three segments or fewer. The descendant selector outweighs the component's
    own `px-3`, so no `!important` is needed.
  */
  const tight = options.length > 3 ? "[&_[role=tab]]:px-1.5 [&_[role=tab]]:gap-1" : "";

  return (
    <>
      <div className="lg:hidden">
        <SegmentedControl
          options={options}
          value={slug(active)}
          onChange={(v) => onChange(back.get(v) ?? active)}
          label={label}
          className={tight}
        />
      </div>
      <div className="hidden lg:block">
        <Tabs items={items} active={active} onChange={onChange} />
      </div>
    </>
  );
}

/**
 * A set of chips on one line that the thumb pushes along.
 *
 * `.ux-chiprow` (mobile.css, `max-width: 1023px`) does the work — nowrap,
 * `overflow-x: auto`, no scrollbar, and a negative inline margin so the row
 * bleeds to the screen edge, which is the signal that tells a thumb it can be
 * swiped at all. Above 1023 the rule does not exist and `flex flex-wrap` is
 * what is left, so desktop wraps exactly as before.
 *
 * `pad` is how far it bleeds: 20 to reach the screen edge (the content column
 * is `px-[20px]`), 18 to reach the edge of a `Card`.
 */
export function ChipRow({
  children, label, pad = 20, className = "",
}: {
  children: ReactNode;
  /** The quiet uppercase caption above it. */
  label?: ReactNode;
  pad?: number;
  className?: string;
}) {
  return (
    <>
      {label && (
        <p className="ux-group-label mb-2 text-2xs font-semibold uppercase tracking-[0.07em]"
           style={{ color: "var(--ux-faint)" }}>
          {label}
        </p>
      )}
      <div className={`ux-chiprow flex flex-wrap gap-2 ${className}`}
           style={{ ["--ux-pad" as string]: `${pad}px` }}>
        {children}
      </div>
    </>
  );
}

/**
 * The row a card's actions sit in.
 *
 * On a phone they stack and fill the width — a thumb reaches the bottom of the
 * screen and the middle of it, not a 96px pill floated to the right-hand edge.
 * From `lg` up it is the `flex items-center justify-between` row it was.
 */
export function ActionRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col items-stretch gap-2 lg:flex-row lg:items-center lg:gap-3 ${className}`}>
      {children}
    </div>
  );
}

/**
 * `Pill`, at a size a phone can read.
 *
 * The kit's `Pill` is `text-2xs` — 11px — at every width. On a 1440 monitor
 * that is a quiet badge beside 13px body text; on a 390px phone held at arm's
 * length in daylight it is the smallest thing on the screen, and it is
 * carrying the one word that says what state something is in: "Offering",
 * "You asked", "Applied", the skill a certificate is for. The audit found
 * eight of them under the 12px floor on `/app/certificates` alone.
 *
 * Same shape, same tones, same tokens — 13px on a phone, and `lg:text-2xs`
 * hands the badge straight back to the desktop design. `Pill` itself is in
 * `kit/`, which this pass does not own; if the kit ever takes a phone tier of
 * its own this can go.
 */
const TAG_TONES = {
  brand:   ["--ux-brand-tint", "--ux-brand"],
  green:   ["--ux-tint-green", "--ux-green-ink"],
  orange:  ["--ux-tint-orange", "--ux-orange-ink"],
  pink:    ["--ux-tint-pink", "--ux-pink-ink"],
  blue:    ["--ux-tint-blue", "--ux-blue-ink"],
  neutral: ["--ux-surface-2", "--ux-muted"],
} as const;

export function Tag({ children, tone = "brand", size = "md" }: {
  children: ReactNode;
  tone?: keyof typeof TAG_TONES;
  size?: "sm" | "md";
}) {
  const [bg, ink] = TAG_TONES[tone];
  return (
    <span
      className={`inline-flex items-center rounded-full text-[13px] font-semibold lg:text-2xs ${
        size === "sm" ? "px-2 py-[2px]" : "px-2.5 py-[3px]"}`}
      style={{ background: `var(${bg})`, color: `var(${ink})` }}>
      {children}
    </span>
  );
}

/**
 * The quiet label above a grouped list, with its one action at the far end.
 *
 * `ListGroup`'s own caption has no room for "See all", and a `SectionHead`
 * above a phone list is a 17px bold heading — the dashboard habit the native
 * shape drops. The label is 12px/600/upper-case muted; the action is a 44px
 * tall text button so the thumb can hit it without the label growing.
 */
export function GroupHead({ title, sub, count, action, onAction, href }: {
  title: ReactNode;
  /** One quiet 13px line under the label, where a section explains itself. */
  sub?: ReactNode;
  /** A number beside the label — "WHAT IS COMING · 5". */
  count?: ReactNode;
  action?: string;
  onAction?: () => void;
  href?: string;
}) {
  const cls = "inline-flex min-h-[44px] shrink-0 items-center text-[15px] font-semibold";
  return (
    <div className="mb-2 px-4">
      <div className={`flex items-center justify-between gap-3 ${action ? "min-h-[44px]" : ""}`}>
        <h2 className="min-w-0 truncate text-[12px] font-semibold uppercase tracking-[0.07em]"
            style={{ color: "var(--ux-muted)" }}>
          {title}{count != null && count !== "" && <span className="tabular-nums"> · {count}</span>}
        </h2>
        {action && (href
          ? <Link href={href} className={cls} style={{ color: "var(--ux-brand)" }}>{action}</Link>
          : <button type="button" onClick={onAction} className={cls} style={{ color: "var(--ux-brand)" }}>{action}</button>)}
      </div>
      {sub && <p className="mt-0.5 text-[13px] leading-snug" style={{ color: "var(--ux-muted)" }}>{sub}</p>}
    </div>
  );
}

/**
 * A section's heading: the quiet group label on a phone, the kit's
 * `SectionHead` — unchanged — from `lg` up. Same props as `SectionHead`, so
 * a call site swaps one name for the other.
 */
export function SectionLabel(props: {
  title: string; sub?: string; action?: string; onAction?: () => void; icon?: string; chip?: string;
}) {
  return (
    <>
      <div className="lg:hidden">
        <GroupHead title={props.title} sub={props.sub} count={props.chip} action={props.action} onAction={props.onAction} />
      </div>
      <div className="hidden lg:block"><SectionHead {...props} /></div>
    </>
  );
}

/**
 * A grouped-list row with room for a picture.
 *
 * `ListRow` draws a 32px icon tile; a course, a job or a woman is better told
 * apart by her photograph or its artwork, and at 32px that is a smudge. Same
 * row otherwise — 16px insets, 15/600 title, 13px lines in `--ux-muted`, a
 * chevron, the grey press highlight — and the hairline starts where the text
 * does (16 + 44 + 12 = 72), not at the card's edge.
 *
 * Put a run of these inside `ListGroup` (or any card with the
 * `[&>*:last-child_[data-ux-sep]]:hidden` rule) so the last hairline goes.
 */
export function MediaRow({ href, onClick, media, title, badges, lines, trailing, chevron }: {
  href?: string;
  onClick?: () => void;
  /** 44x44 — a picture, an avatar or an `IconTile`. */
  media?: ReactNode;
  title: ReactNode;
  /** Small pills beside the title. */
  badges?: ReactNode;
  /** Each one a 13px line under the title. */
  lines?: ReactNode[];
  trailing?: ReactNode;
  chevron?: boolean;
}) {
  const showChevron = chevron ?? Boolean(href || onClick);
  const inner = (
    <>
      {media && <span className="grid h-[44px] w-[44px] shrink-0 place-items-center overflow-hidden rounded-[12px]">{media}</span>}
      <span className="min-w-0 flex-1 text-start">
        <span className="flex min-w-0 items-center gap-2">
          <span className="block min-w-0 truncate text-[15px] font-semibold leading-tight" style={{ color: "var(--ux-ink)" }}>
            {title}
          </span>
          {badges}
        </span>
        {lines?.filter(Boolean).map((l, i) => (
          <span key={i} className="mt-0.5 block truncate text-[13px] leading-snug" style={{ color: "var(--ux-muted)" }}>
            {l}
          </span>
        ))}
      </span>
      {trailing}
      {showChevron && (
        <Icons.ChevronRight className="h-[17px] w-[17px] shrink-0 rtl:rotate-180" style={{ color: "var(--ux-faint)" }} aria-hidden="true" />
      )}
      <span data-ux-sep aria-hidden="true" className="pointer-events-none absolute bottom-0 end-0 h-px"
            style={{ insetInlineStart: media ? "72px" : "16px", background: "var(--ux-line)" }} />
    </>
  );
  const cls = "relative flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-start active:bg-[var(--ux-surface-2)]";
  const style = { background: "transparent", transform: "none" } as const;
  if (href) return <Link href={href} className={cls} style={style}>{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cls} style={style}>{inner}</button>;
  return <div className={cls} style={style}>{inner}</div>;
}

/** The card a run of `MediaRow`s sits in — `ListGroup`'s card without its caption. */
export function RowGroup({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-[var(--ux-r-lg)] border [&>*:last-child_[data-ux-sep]]:hidden ${className}`}
         style={{ background: "var(--ux-surface)", borderColor: "var(--ux-line)" }}>
      {children}
    </div>
  );
}
