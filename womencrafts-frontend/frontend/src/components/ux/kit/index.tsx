"use client";

import * as React from "react";
import Link from "next/link";
import * as Icons from "lucide-react";

import { useGrow, usePointer, useRipple } from "./motion";

export { OnboardSkeleton, RailSkeleton, ScreenError, ScreenHandoff, ScreenSkeleton, Skeleton, whatFailedFor } from "./state";

/**
 * The pieces every Learning screen is built from.
 *
 * Extracted from the boards rather than invented: a section header with a
 * "See All" on the right, a rounded tinted badge holding a line icon, a 6px
 * progress bar, a star rating with a count in brackets, a pill, an avatar
 * stack. They recur on every screen, so they are defined once here — a radius
 * or a shadow changes in one place and lands everywhere.
 *
 * Everything reads its colour from the --ux-* variables, which is what lets a
 * whole screen re-theme without a component being touched.
 */

export const v = (t: string) => `var(${t})`;

/**
 * Pluralise a label for a count.
 *
 * `${kind}s` put "Opportunitys" on the search screen. English is irregular
 * enough that the -y and -s/-x/-ch endings have to be handled explicitly.
 */
export function plural(word: string, n?: number) {
  if (n === 1) return word;
  if (/[^aeiou]y$/i.test(word)) return word.slice(0, -1) + "ies";
  if (/(s|x|z|ch|sh)$/i.test(word)) return word + "es";
  return word + "s";
}

export function I({ name, className, sw = 1.9, style }: {
  name: string; className?: string; sw?: number; style?: React.CSSProperties;
}) {
  const C = (Icons as unknown as Record<string, React.ComponentType<{ className?: string; strokeWidth?: number; style?: React.CSSProperties }>>)[name] ?? Icons.Circle;
  return <C className={className} strokeWidth={sw} style={style} />;
}

export function Card({ children, className = "", pad = 18, style }: {
  children: React.ReactNode; className?: string; pad?: number; style?: React.CSSProperties;
}) {
  return <section className={`ux-card ${className}`} style={{ padding: pad, ...style }}>{children}</section>;
}

export function SectionHead({ title, sub, action, onAction, icon, chip }: {
  title: string; sub?: string; action?: string; onAction?: () => void; icon?: string; chip?: string;
}) {
  return (
    <div className="mb-3.5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold" style={{ color: "var(--ux-ink)" }}>
          {icon && <I name={icon} className="h-[17px] w-[17px]" style={{ color: "var(--ux-brand)" }} />}
          {title}
          {chip && (
            <span className="rounded-full px-2.5 py-[3px] text-[10.5px] font-semibold"
                  style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>{chip}</span>
          )}
        </h2>
        {sub && <p className="mt-1 text-[12px]" style={{ color: "var(--ux-muted)" }}>{sub}</p>}
      </div>
      {action && (
        <button onClick={onAction}
                /* -my-1 py-1 keeps the 24px hit area without moving the text */
                className="ux-press ux-hov -my-1 flex shrink-0 items-center gap-1 py-1 text-[12.5px] font-medium"
                style={{ color: "var(--ux-brand)" }}>
          {action} <Icons.ChevronRight className="ux-arrow h-3.5 w-3.5" strokeWidth={2.2} />
        </button>
      )}
    </div>
  );
}

/** A line icon inside a soft tinted square — the board's most repeated shape. */
export function IconTile({ icon, tint, ink, size = 40, radius = 11 }: {
  icon: string; tint: string; ink: string; size?: number; radius?: number;
}) {
  return (
    <span className="ux-sq grid shrink-0 place-items-center"
          style={{ width: size, height: size, borderRadius: radius, background: v(tint), color: v(ink) }}>
      <I name={icon} className="ux-ico" style={{ width: size * 0.45, height: size * 0.45 }} />
    </span>
  );
}

export function Progress({ pct, tone = "--ux-brand-600", track = "--ux-brand-tint-2", h = 6 }: {
  pct: number; tone?: string; track?: string; h?: number;
}) {
  // Fills to its value rather than being drawn at it — the movement is what
  // makes progress feel like progress. Held at the value under reduced motion.
  const w = useGrow(Math.max(0, Math.min(100, pct)));
  return (
    <div className="w-full overflow-hidden rounded-full" style={{ height: h, background: v(track) }}
         role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full"
           style={{ width: `${w}%`, background: v(tone),
                    transition: "width var(--ux-t-slow) var(--ux-ease-out)" }} />
    </div>
  );
}

export function Rating({ value, count }: { value: string | number; count?: string }) {
  return (
    <span className="flex items-center gap-1 text-[11.5px]" style={{ color: "var(--ux-muted)" }}>
      <Icons.Star className="h-[13px] w-[13px]" fill="var(--ux-amber)" style={{ color: "var(--ux-amber)" }} />
      <span className="font-medium" style={{ color: "var(--ux-ink-2)" }}>{value}</span>
      {count && <span>({count})</span>}
    </span>
  );
}

export function Pill({ children, tone = "brand", size = "md" }: {
  children: React.ReactNode; tone?: "brand" | "green" | "orange" | "pink" | "blue" | "neutral"; size?: "sm" | "md";
}) {
  // The `-ink` variants, not the plain accents: this is text on a pale tint,
  // and the plain accents only clear the 3:1 that graphics need.
  const map = {
    brand:   ["--ux-brand-tint", "--ux-brand"],
    green:   ["--ux-tint-green", "--ux-green-ink"],
    orange:  ["--ux-tint-orange", "--ux-orange-ink"],
    pink:    ["--ux-tint-pink", "--ux-pink-ink"],
    blue:    ["--ux-tint-blue", "--ux-blue-ink"],
    neutral: ["--ux-surface-2", "--ux-muted"],
  }[tone];
  return (
    <span className={`inline-flex items-center rounded-full font-semibold ${size === "sm" ? "px-2 py-[2px] text-[10px]" : "px-2.5 py-[3px] text-[11px]"}`}
          style={{ background: v(map[0]), color: v(map[1]) }}>{children}</span>
  );
}

export function Chip({ children, selected, onClick, icon }: {
  children: React.ReactNode; selected?: boolean; onClick?: () => void; icon?: string;
}) {
  return (
    <button onClick={onClick} aria-pressed={selected}
      className="ux-press ux-sq inline-flex items-center gap-2 rounded-[11px] border px-3.5 py-2.5 text-[12.5px] font-medium transition-colors"
      style={{
        borderColor: selected ? "var(--ux-brand)" : "var(--ux-line-strong)",
        background: selected ? "var(--ux-brand-tint)" : "var(--ux-surface)",
        color: selected ? "var(--ux-brand)" : "var(--ux-ink)",
      }}>
      {icon && <I name={icon} className="h-[15px] w-[15px]" />}
      {children}
      {selected && <Icons.Check className="ux-pop h-[13px] w-[13px]" strokeWidth={3} />}
    </button>
  );
}

/**
 * A button, or a link that looks like one.
 *
 * `href` renders a `<Link>` rather than wrapping the button in one: an anchor
 * around a button is an inline box that collapses to the text height, so the
 * thing the pointer actually hits ends up ~20px tall no matter how much padding
 * the button inside it has.
 */
export function Btn({ children, variant = "primary", size = "md", icon, iconEnd, onClick, href, className = "", full, type = "button", ariaLabel, disabled }: {
  children: React.ReactNode;
  variant?: "primary" | "soft" | "outline" | "ghost" | "on-brand";
  size?: "sm" | "md" | "lg"; icon?: string; iconEnd?: string;
  onClick?: () => void; href?: string; className?: string; full?: boolean;
  type?: "button" | "submit"; ariaLabel?: string;
  /**
   * Not pressable — while a write is in flight, or until she has chosen what
   * the button needs. It dims and stops responding, but stays where it is:
   * a button that vanishes takes the explanation of what to do next with it.
   */
  disabled?: boolean;
}) {
  const pad = { sm: "px-3 py-1.5 text-[11.5px]", md: "px-4 py-2.5 text-[12.5px]", lg: "px-6 py-3 text-[14px]" }[size];
  const look = {
    primary: { background: "linear-gradient(96deg, var(--ux-fill), var(--ux-fill-2))", color: "#fff", border: "1px solid transparent" },
    soft:    { background: "var(--ux-brand-tint)", color: "var(--ux-brand)", border: "1px solid transparent" },
    outline: { background: "var(--ux-surface)", color: "var(--ux-ink)", border: "1px solid var(--ux-line-strong)" },
    ghost:   { background: "transparent", color: "var(--ux-brand)", border: "1px solid transparent" },
    // For use on the hero gradient, where the brand violet would disappear.
    "on-brand": { background: "rgba(255,255,255,0.14)", color: "#fff", border: "1px solid rgba(255,255,255,0.34)" },
  }[variant];
  // Clay on the two filled variants only: an outline button has no slab to
  // shade, and a ghost button would grow a shadow out of nothing.
  const clay = variant === "primary" || variant === "soft" ? "ux-clay" : "";
  // The animation classes come off when disabled — a button that ripples and
  // lifts under the finger but does nothing reads as a broken button, not a
  // waiting one.
  const cls = disabled
    ? `ux-sq inline-flex items-center justify-center gap-2 rounded-[11px] font-semibold ${pad} ${full ? "w-full" : ""} ${className}`
    : `ux-press ux-hov ux-sq ux-magnet ux-ripple ${clay} inline-flex items-center justify-center gap-2 rounded-[11px] font-semibold ${pad} ${full ? "w-full" : ""} ${className}`;
  const dim = disabled ? { opacity: 0.55, cursor: "not-allowed" } : null;
  const inner = (
    <>
      {icon && <I name={icon} className="ux-ico h-[15px] w-[15px]" sw={2.1} />}
      {children}
      {iconEnd && <I name={iconEnd} className="ux-arrow h-[15px] w-[15px]" sw={2.1} />}
    </>
  );
  // Two refs on one node: the pointer hook writes --px/--py for the magnet, the
  // ripple hook appends ink on press. Merged rather than nested so the button
  // stays a single element and keeps its own hit area.
  const point = usePointer<HTMLElement>();
  const ink = useRipple<HTMLElement>();
  const setRef = (n: HTMLElement | null) => {
    (point as React.MutableRefObject<HTMLElement | null>).current = n;
    (ink as React.MutableRefObject<HTMLElement | null>).current = n;
  };

  if (href) {
    // A disabled link is still a link: it would follow on click and on Enter.
    // Rendering a real button instead is the only way to actually stop it.
    if (disabled) {
      return (
        <button type="button" disabled aria-label={ariaLabel} className={cls} style={{ ...look, ...dim }}>
          {inner}
        </button>
      );
    }
    return (
      <Link ref={setRef} href={href} onClick={onClick} aria-label={ariaLabel} className={cls} style={look}>
        {inner}
      </Link>
    );
  }
  return (
    <button ref={setRef} type={type} onClick={disabled ? undefined : onClick} disabled={disabled}
            aria-label={ariaLabel} className={cls} style={{ ...look, ...dim }}>
      {inner}
    </button>
  );
}

export function AvatarStack({ srcs, extra, size = 26 }: { srcs: string[]; extra?: string; size?: number }) {
  return (
    <div className="ux-fan flex shrink-0 items-center">
      {srcs.map((s, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={s + i} src={s} alt="" className="rounded-full border-2 object-cover"
             style={{ width: size, height: size, borderColor: "var(--ux-surface)", marginLeft: i ? -8 : 0 }} />
      ))}
      {extra && <span className="ms-1.5 text-[10.5px]" style={{ color: "var(--ux-muted)" }}>{extra}</span>}
    </div>
  );
}

export function Stat({ value, label, icon, tint, ink }: {
  value: string; label: string; icon?: string; tint?: string; ink?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {icon && tint && ink && <IconTile icon={icon} tint={tint} ink={ink} size={38} />}
      <div className="min-w-0">
        <p className="text-[19px] font-bold leading-none" style={{ color: "var(--ux-ink)" }}>{value}</p>
        <p className="mt-1 truncate text-[11.5px]" style={{ color: "var(--ux-muted)" }}>{label}</p>
      </div>
    </div>
  );
}

export function EmptyState({ title, body, icon = "Inbox", action }: {
  title: string; body: string; icon?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="grid h-[64px] w-[64px] place-items-center rounded-full"
            style={{ background: "var(--ux-brand-tint)" }}>
        <I name={icon} className="h-7 w-7" style={{ color: "var(--ux-brand)" }} />
      </span>
      <h3 className="mt-4 text-[14px] font-semibold" style={{ color: "var(--ux-ink)" }}>{title}</h3>
      <p className="mt-1.5 max-w-[320px] text-[12.5px] leading-relaxed" style={{ color: "var(--ux-muted)" }}>{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/**
 * A tab strip whose selected pill slides.
 *
 * The pill is one absolutely-positioned element measured from the active
 * button, rather than a background on each button: styling each one means the
 * highlight blinks from tab to tab, and the movement is the part that tells you
 * the two tabs are the same control.
 */
export function Tabs({ items, active, onChange }: {
  items: string[]; active: string; onChange: (t: string) => void;
}) {
  const wrap = React.useRef<HTMLDivElement>(null);
  const [pill, setPill] = React.useState<{ x: number; w: number } | null>(null);

  React.useLayoutEffect(() => {
    const el = wrap.current?.querySelector<HTMLElement>('[data-on="1"]');
    if (!el) return;
    setPill({ x: el.offsetLeft, w: el.offsetWidth });
  }, [active, items]);

  // Font loading and container resizes both move the buttons after first paint.
  React.useEffect(() => {
    const el = wrap.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const on = el.querySelector<HTMLElement>('[data-on="1"]');
      if (on) setPill({ x: on.offsetLeft, w: on.offsetWidth });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrap} role="tablist" className="ux-sq relative inline-flex gap-1.5 rounded-[12px] p-1"
         style={{ background: "var(--ux-surface-2)" }}>
      {pill && (
        <span aria-hidden className="ux-sq absolute rounded-[9px]"
              style={{
                left: pill.x, width: pill.w, top: 4, bottom: 4,
                background: "var(--ux-surface)", boxShadow: "var(--ux-shadow-card)",
                transition: "left var(--ux-t) var(--ux-ease-spring), width var(--ux-t) var(--ux-ease-spring)",
              }} />
      )}
      {items.map((t) => {
        const on = t === active;
        return (
          <button key={t} role="tab" aria-selected={on} data-on={on ? "1" : undefined}
            onClick={() => onChange(t)}
            className="relative z-[1] rounded-[8px] px-3.5 py-2 text-[12.5px] font-medium transition-colors"
            style={{ color: on ? "var(--ux-brand)" : "var(--ux-muted)" }}>
            {t}
          </button>
        );
      })}
    </div>
  );
}

/** Horizontal rail with the round arrow buttons the boards use. */
export function Rail({ children, id }: { children: React.ReactNode; id: string }) {
  const scroll = (dir: number) => {
    const el = document.getElementById(id);
    if (el) el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: "smooth" });
  };
  return (
    <div className="relative">
      <div id={id} className="ux-scroll-x flex gap-[15px] pb-1">{children}</div>
      {[-1, 1].map((d) => (
        <button key={d} onClick={() => scroll(d)} aria-label={d < 0 ? "Previous" : "Next"}
          className="absolute top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border"
          style={{ [d < 0 ? "left" : "right"]: -12, background: "var(--ux-surface)",
                   borderColor: "var(--ux-line)", boxShadow: "var(--ux-shadow-lift)" }}>
          <I name={d < 0 ? "ChevronLeft" : "ChevronRight"} className="h-4 w-4" style={{ color: "var(--ux-ink-2)" }} sw={2.2} />
        </button>
      ))}
    </div>
  );
}

/**
 * A button whose only job is to say it worked.
 *
 * Sixty buttons in this app did something local — remind me, save a note,
 * copy a link — and did it silently, which is indistinguishable from doing
 * nothing. She presses again, then decides the app is broken.
 *
 * So the button answers on itself: the label becomes the confirmation for a
 * couple of seconds and then returns. It reports on the thing she touched, not
 * in a corner of the screen she is not looking at, and it needs no provider,
 * no portal and no state in the page.
 *
 * `act` runs first and may return a different confirmation — that is how
 * "Copy link" can say "Copied" when the clipboard allowed it and "Copy it by
 * hand" when it did not.
 */
export function ActionBtn({
  children, done, doneIcon = "Check", act, hold = 2200, ...rest
}: {
  children: React.ReactNode;
  /** What the button says once it has worked. */
  done: string;
  doneIcon?: string;
  /** The side effect. Return a string to override the confirmation. */
  act?: () => string | void | Promise<string | void>;
  hold?: number;
  variant?: "primary" | "soft" | "outline" | "ghost" | "on-brand";
  size?: "sm" | "md" | "lg"; icon?: string; iconEnd?: string;
  className?: string; full?: boolean; ariaLabel?: string;
}) {
  const [said, setSaid] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);
  const timer = React.useRef<number | undefined>(undefined);
  // Clear on unmount: a woman who navigates away mid-confirmation should not
  // leave a timer writing to a component that is gone.
  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  /**
   * Run the action, and say what actually happened.
   *
   * **This used to swallow the failure.** The line was
   * `try { label = await act?.(); } catch { label = undefined; }`, and the
   * next line showed the success label regardless — so every one of the
   * nineteen buttons wired to a real request announced "Sent", "Saved" or
   * "Copied" when the request had thrown. A woman reading "Sent to your email"
   * after a 500 waits for a statement that is not coming.
   *
   * A button with no `act` at all is a different problem and is not solved
   * here: those say "done" about nothing, and each one needs wiring or
   * removing at its call site.
   */
  const fire = async () => {
    let label: string | void;
    try {
      label = await act?.();
      setFailed(false);
    } catch {
      setFailed(true);
      setSaid("That did not go through. Try again in a moment.");
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => { setSaid(null); setFailed(false); }, hold * 2);
      return;
    }
    setSaid(label || done);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setSaid(null), hold);
  };

  return (
    <Btn
      {...rest}
      icon={said ? (failed ? "TriangleAlert" : doneIcon) : rest.icon}
      iconEnd={said ? undefined : rest.iconEnd}
      onClick={fire}
      ariaLabel={rest.ariaLabel}
    >
      {/* aria-live so a screen reader hears the confirmation too — the visual
          swap alone tells a sighted user and nobody else. */}
      <span aria-live="polite">{said ?? children}</span>
    </Btn>
  );
}

/** Open a place in the phone's maps app. Nothing else in the app leaves it. */
export function mapsHref(place: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
}

/** Copy text and say whether it worked — clipboard is denied often enough to matter. */
export async function copy(text: string, ok = "Copied", no = "Could not copy") {
  try {
    await navigator.clipboard.writeText(text);
    return ok;
  } catch {
    return no;
  }
}
export { NoteBtn } from "./note";
export { downloadCsv, escapeHtml, letterhead, printDocument } from "./download";

/**
 * Says when a screen is showing example figures rather than her own.
 *
 * `useResource` falls back to the mock when an endpoint is missing or the
 * request fails, which keeps every screen readable — but on a screen about
 * money, an unlabelled fallback is not a graceful degradation, it is a lie
 * about her balance. So the fallback announces itself.
 *
 * Renders nothing at all when the data is real, which is the point: this
 * disappears on its own as each module gets wired, with no screen to revisit.
 */
export function SourceNote({ source, what = "figures" }: { source: "live" | "mock" | "loading"; what?: string }) {
  if (source !== "mock") return null;
  return (
    <p
      role="status"
      className="ux-sq mb-3.5 flex items-start gap-2.5 rounded-[12px] px-3.5 py-2.5 text-[12px] leading-relaxed"
      style={{ background: "var(--ux-tint-amber)", color: "var(--ux-amber-ink)" }}
    >
      <I name="Info" className="mt-[1px] h-[14px] w-[14px] shrink-0" sw={2} />
      <span>
        These are example {what}, not yours. We could not reach WomSakhi just now — pull down or try again
        in a moment.
      </span>
    </p>
  );
}
export { certificateHtml, printCertificate, type CertificateFields } from "./download";
export { Money, formatMoney as formatRupees, formatMoneyOrFree, formatWholeRupees } from "./money";
export { ConfirmButton } from "./confirm";
export { Rows, rowMemo } from "./rows";
