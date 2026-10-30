"use client";

import Link from "next/link";

import * as Icons from "@/components/ux/icons";

/**
 * The listing card — one shape for every list in the app.
 *
 * A big picture first (16:10 by default), with the two things that decide a
 * tap sitting ON it: what kind of thing it is (top-left) and what it costs or
 * pays (top-right). Under it: the title, who it is from, a line of facts, and
 * one footer for the actions. The same family as the course card, so jobs,
 * mentors, events, circles, schemes and products all read the same way.
 *
 * Use `<MediaGrid>` around them: one column on a phone, two from `sm`, three
 * from `xl` (pass `cols={4}` for small items like products).
 */

export type Badge = { text: string; tone?: "light" | "dark" | "brand" | "green" | "orange" };

const BADGE: Record<NonNullable<Badge["tone"]>, React.CSSProperties> = {
  light: { background: "rgba(255,255,255,.92)", color: "#2a1a24" },
  dark: { background: "rgba(24,10,34,.78)", color: "#fff" },
  brand: { background: "var(--ux-fill, #b0105f)", color: "#fff" },
  green: { background: "#0f7a43", color: "#fff" },
  orange: { background: "#b4540f", color: "#fff" },
};

function Chip({ b }: { b: Badge }) {
  return (
    <span className="max-w-[70%] truncate rounded-full px-2.5 py-1 text-2xs font-bold shadow-sm backdrop-blur"
          style={BADGE[b.tone ?? "light"]}>{b.text}</span>
  );
}

export function MediaCard({
  href, image, alt = "", ratio = "16/10", topLeft, topRight, overlay, title, subtitle, avatar,
  meta, children, footer, onClick, highlight, headingLevel = 2,
}: {
  /** Whole card is a link when set (footer buttons should then be links/buttons that stopPropagation). */
  href?: string;
  image: string;
  alt?: string;
  ratio?: "16/10" | "4/3" | "1/1" | "3/2";
  topLeft?: Badge | null;
  topRight?: Badge | null;
  /** Small text along the bottom of the picture — "12 lessons", "3 seats left". */
  overlay?: React.ReactNode;
  title: React.ReactNode;
  /** Use 3 when the card belongs to an explicitly titled h2 section. */
  headingLevel?: 2 | 3;
  /** Who it is from — "Posted by Priya", "Sri Lakshmi Traders". */
  subtitle?: React.ReactNode;
  /** A round picture or initials beside the subtitle. */
  avatar?: { src?: string; name: string } | null;
  /** One line of facts: place, time, level… */
  meta?: React.ReactNode;
  /** Anything else under the facts: skill chips, a match line. */
  children?: React.ReactNode;
  footer?: React.ReactNode;
  onClick?: () => void;
  /** A soft brand ring — "this is yours" or "best match". */
  highlight?: boolean;
}) {
  const initials = avatar ? avatar.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() : "";
  const picture = (
    <div className="relative w-full overflow-hidden" style={{ aspectRatio: ratio, background: "var(--ux-surface-2)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt={alt} loading="lazy" decoding="async"
           className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
      <span aria-hidden className="absolute inset-0"
            style={{ background: "linear-gradient(180deg, rgba(16,6,24,.10) 0%, rgba(16,6,24,0) 35%, rgba(16,6,24,0) 55%, rgba(16,6,24,.55) 100%)" }} />
      {(topLeft || topRight) && (
        <div className="absolute inset-x-2.5 top-2.5 flex items-start justify-between gap-2">
          {topLeft ? <Chip b={topLeft} /> : <span />}
          {topRight && <Chip b={topRight} />}
        </div>
      )}
      {overlay && (
        <div className="absolute inset-x-3 bottom-2.5 flex items-center gap-1.5 text-2xs font-semibold text-white"
             style={{ textShadow: "0 1px 6px rgba(0,0,0,.4)" }}>{overlay}</div>
      )}
    </div>
  );
  const body = (
    <div className="flex flex-1 flex-col p-3.5 lg:p-4">
      {headingLevel === 3
        ? <h3 className="line-clamp-2 text-[15px] font-bold leading-snug" style={{ color: "var(--ux-ink)" }}>{title}</h3>
        : <h2 className="line-clamp-2 text-[15px] font-bold leading-snug" style={{ color: "var(--ux-ink)" }}>{title}</h2>}
      {(subtitle || avatar) && (
        <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs" style={{ color: "var(--ux-ink-2)" }}>
          {avatar && (
            avatar.src
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={avatar.src} alt="" className="h-[22px] w-[22px] shrink-0 rounded-full object-cover" />
              : <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full text-[9px] font-bold"
                      style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>{initials}</span>
          )}
          <span className="truncate">{subtitle}</span>
        </p>
      )}
      {meta && <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: "var(--ux-muted)" }}>{meta}</div>}
      {children && <div className="mt-2.5">{children}</div>}
      {footer && <div className="mt-auto pt-3.5">{footer}</div>}
    </div>
  );
  const cls = "ux-card group flex min-w-0 flex-col overflow-hidden";
  const style: React.CSSProperties = { padding: 0, ...(highlight ? { boxShadow: "0 0 0 2px var(--ux-brand)" } : {}) };
  if (href && !footer) {
    return <Link href={href} className={`${cls} ux-hov`} style={style} onClick={onClick}>{picture}{body}</Link>;
  }
  return (
    <article className={cls} style={style}>
      {href ? <Link href={href} className="block" aria-label={typeof title === "string" ? title : undefined}>{picture}</Link> : picture}
      {body}
    </article>
  );
}

/** One fact with its icon, for `meta`. */
export function Fact({ icon, children }: { icon: string; children: React.ReactNode }) {
  const I = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[icon];
  return <span className="inline-flex min-w-0 items-center gap-1">{I && <I className="h-[13px] w-[13px] shrink-0" />}<span className="truncate">{children}</span></span>;
}

/** The grid every listing uses. */
export function MediaGrid({ children, cols = 3, className = "" }: { children: React.ReactNode; cols?: 2 | 3 | 4; className?: string }) {
  const c = cols === 4 ? "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : cols === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3";
  return <div className={`grid gap-3 lg:gap-4 ${c} ${className}`}>{children}</div>;
}
