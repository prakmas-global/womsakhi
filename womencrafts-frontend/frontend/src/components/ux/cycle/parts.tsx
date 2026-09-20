"use client";

/**
 * The cycle tracker's pieces, drawn to the owner's reference screens.
 *
 * Every colour is a token (ADR-013): the four calendar marks and five mood
 * faces are `--cy-*` in `ux/tokens.css`, defined for both themes, so nothing
 * here knows which theme it is in.
 *
 * The mood faces are drawn, not typed. An emoji is a different picture on
 * every phone — Samsung's "calm" is not Apple's — and the reference shows one
 * specific set of faces, so they are SVG and look the same everywhere.
 */

import Link from "next/link";
import { useId, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import * as Icons from "@/components/ux/icons";
import { parentFor } from "@/components/ux/nav-tree";
import type { CycleCell, CycleInsight, Mark, Mood, Phase } from "@/lib/cycle-api";
import { MOODS, type CareItem } from "./data";
import { addDays, dayNum, dow, monthShort, monthTitle } from "./use-cycle";

const Icon = ({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) => {
  const C = (Icons as unknown as Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties; strokeWidth?: number; "aria-hidden"?: boolean }>>)[name] ?? Icons.Heart;
  return <C className={className} style={style} strokeWidth={1.9} aria-hidden />;
};

/* ── The screen frame ────────────────────────────────────────────────────── */

/**
 * "‹  Track Your Cycle   Save" — the header the reference draws on every
 * inner screen. Phone only: on a laptop the shell's own bar and rail are
 * there, and the screen shows a normal title instead (see `DeskTitle`).
 *
 * Back goes UP the tree, like the shell's own back control, so it works for
 * a woman who arrived from a notification with no history in the tab.
 */
export function CycleHeader({
  title,
  action,
  back,
}: {
  title: string;
  action?: { label: string; onClick?: () => void; href?: string; disabled?: boolean };
  back?: string;
}) {
  const path = usePathname() ?? "";
  const up = back ?? parentFor(path)?.href ?? "/app/health/cycle";
  return (
    <div className="sticky top-0 z-20 -mx-[20px] mb-2 grid grid-cols-[64px_1fr_64px] items-center px-[12px] pt-[env(safe-area-inset-top,0px)] lg:hidden"
         style={{ background: "var(--ux-canvas)", minHeight: 56 }}>
      <Link href={up} data-ux-back aria-label="Back"
            className="ux-press grid h-11 w-11 place-items-center rounded-full"
            style={{ color: "var(--ux-ink)" }}>
        <Icons.ChevronLeft className="h-6 w-6" strokeWidth={2.2} aria-hidden />
      </Link>
      {/* A nav-bar title, not a headline: the sans face, like the reference.
          `.ux h1` would otherwise hand it the display serif. */}
      <h1 className="truncate text-center text-[17px] font-semibold"
          style={{ color: "var(--ux-ink)", fontFamily: "var(--font-sans)", letterSpacing: "-0.01em" }}>{title}</h1>
      <div className="flex justify-end">
        {action && (action.href ? (
          <Link href={action.href} className="ux-press grid h-11 place-items-center px-2 text-[15px] font-semibold"
                style={{ color: "var(--cy-period-ink)" }}>{action.label}</Link>
        ) : (
          <button type="button" onClick={action.onClick} disabled={action.disabled}
                  className="ux-press h-11 px-2 text-[15px] font-semibold disabled:opacity-40"
                  style={{ color: "var(--cy-period-ink)" }}>{action.label}</button>
        ))}
      </div>
    </div>
  );
}

/** The laptop's title for an inner screen — the phone has `CycleHeader`. */
export function DeskTitle({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-5 hidden items-end justify-between gap-4 lg:flex">
      <div>
        <h1 className="ux-display text-[28px] font-bold leading-tight" style={{ color: "var(--ux-ink)" }}>{title}</h1>
        {sub && <p className="mt-1 text-[15px]" style={{ color: "var(--ux-muted)" }}>{sub}</p>}
      </div>
      {right}
    </div>
  );
}

/** Inner screens sit in a phone-width column on a laptop, centred. */
export function Column({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <div className={`mx-auto w-full ${wide ? "max-w-[880px]" : "max-w-[560px]"}`}>{children}</div>;
}

/* ── Buttons ─────────────────────────────────────────────────────────────── */

export function CyButton({
  children, onClick, href, disabled, busy, iconEnd = "ArrowRight", tone = "fill", className = "",
}: {
  children: ReactNode; onClick?: () => void; href?: string; disabled?: boolean; busy?: boolean;
  iconEnd?: string | null; tone?: "fill" | "ghost"; className?: string;
}) {
  const cls = `ux-press flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] text-[17px] font-semibold transition-opacity disabled:opacity-50 ${className}`;
  const style: React.CSSProperties = tone === "fill"
    ? { background: "linear-gradient(90deg, var(--cy-period), var(--ux-fill))", color: "var(--ux-on-brand)",
        boxShadow: "0 8px 20px -10px var(--cy-period)" }
    : { background: "transparent", color: "var(--ux-muted)" };
  const inner = (
    <>
      <span>{busy ? "Saving…" : children}</span>
      {iconEnd && !busy && <Icon name={iconEnd} className="h-[18px] w-[18px]" />}
    </>
  );
  return href ? (
    <Link href={href} className={cls} style={style}>{inner}</Link>
  ) : (
    <button type="button" onClick={onClick} disabled={disabled || busy} className={cls} style={style}>{inner}</button>
  );
}

/* ── The ring ────────────────────────────────────────────────────────────── */

export function CycleRing({ value, max, size = 96, stroke = 10, children }: {
  value: number; max: number; size?: number; stroke?: number; children?: ReactNode;
}) {
  const id = useId().replace(/:/g, "");
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--cy-period)" />
            <stop offset="100%" stopColor="var(--cy-ovulation)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--cy-period-soft)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#g${id})`} strokeWidth={stroke}
                strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`}
                style={{ transition: "stroke-dasharray 700ms var(--ux-ease-out)" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

/** The little leaf-in-a-circle at the ring's centre in the reference. */
export function RingSeed({ size = 44 }: { size?: number }) {
  return (
    <span className="grid place-items-center rounded-full" style={{ width: size, height: size, background: "var(--ux-tint-green)" }}>
      <Icons.Leaf className="h-1/2 w-1/2" style={{ color: "var(--ux-green)" }} aria-hidden />
    </span>
  );
}

/* ── Mood faces ──────────────────────────────────────────────────────────── */

export function MoodFace({ mood, size = 40, muted = false }: { mood: Mood; size?: number; muted?: boolean }) {
  const tone = MOODS.find((m) => m.key === mood)?.tone ?? "--cy-mood-happy";
  const fill = muted ? "var(--ux-surface)" : `var(${tone})`;
  const ink = muted ? "var(--ux-faint)" : "var(--cy-face-ink)";
  const sw = 2.2;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <circle cx="20" cy="20" r="18" fill={fill} stroke={muted ? "var(--ux-line-strong)" : "none"} strokeWidth={muted ? 1.5 : 0} />
      <g fill="none" stroke={ink} strokeWidth={sw} strokeLinecap="round">
        {mood === "happy" && (<>
          <circle cx="14" cy="16" r="1.6" fill={ink} stroke="none" /><circle cx="26" cy="16" r="1.6" fill={ink} stroke="none" />
          <path d="M12.5 23 Q20 31 27.5 23" />
        </>)}
        {mood === "calm" && (<>
          <path d="M11 17 Q14 19.5 17 17" /><path d="M23 17 Q26 19.5 29 17" />
          <path d="M15 25 Q20 28.5 25 25" />
        </>)}
        {mood === "tired" && (<>
          <path d="M11 17.5 H17" /><path d="M23 17.5 H29" />
          <path d="M15 26.5 Q20 24 25 26.5" />
          <path d="M31 9 q2 3 0 4.4 q-2 -1.4 0 -4.4z" fill={muted ? "none" : "var(--ux-surface)"} strokeWidth={1.4} />
        </>)}
        {mood === "irritable" && (<>
          <path d="M11 13 L17 15.5" /><path d="M29 13 L23 15.5" />
          <circle cx="14.5" cy="18.5" r="1.5" fill={ink} stroke="none" /><circle cx="25.5" cy="18.5" r="1.5" fill={ink} stroke="none" />
          <path d="M14 28 Q20 23 26 28" />
        </>)}
        {mood === "sad" && (<>
          <circle cx="14" cy="17" r="1.6" fill={ink} stroke="none" /><circle cx="26" cy="17" r="1.6" fill={ink} stroke="none" />
          <path d="M14 28 Q20 23.5 26 28" />
          <path d="M13 21 q-1.6 2.6 0 3.6 q1.6 -1 0 -3.6z" fill={muted ? "none" : "var(--ux-surface)"} strokeWidth={1.2} />
        </>)}
      </g>
    </svg>
  );
}

/** A row of five faces — pick one. The chosen one gets a ring and bold label. */
export function MoodRow({ value, onPick, size = 44 }: { value: Mood | null; onPick: (m: Mood) => void; size?: number }) {
  return (
    <div role="radiogroup" aria-label="How are you feeling" className="flex items-start justify-between gap-1">
      {MOODS.map((m) => {
        const on = value === m.key;
        return (
          <button key={m.key} type="button" role="radio" aria-checked={on} onClick={() => onPick(m.key)}
                  className="ux-press ux-tap-exempt flex min-w-[56px] flex-col items-center gap-1.5 rounded-[14px] py-1.5">
            <span className="grid place-items-center rounded-full transition-transform"
                  style={{ padding: 3, transform: on ? "scale(1.08)" : "none",
                           boxShadow: on ? "0 0 0 2px var(--cy-mood-calm)" : "none",
                           background: on ? "var(--cy-fertile)" : "transparent" }}>
              <MoodFace mood={m.key} size={size} />
            </span>
            <span className="text-[13px]" style={{ color: on ? "var(--ux-ink)" : "var(--ux-muted)", fontWeight: on ? 600 : 400 }}>
              {m.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Week strip ──────────────────────────────────────────────────────────── */

export function WeekStrip({ today, selected, onPick }: { today: string; selected: string; onPick: (d: string) => void }) {
  // Yesterday, today and the three after it — the reference's five, with
  // today second so the one she most often back-fills is in reach.
  const days = [-1, 0, 1, 2, 3].map((k) => addDays(today, k));
  return (
    <div>
      <p className="mb-2 text-end text-[12px]" style={{ color: "var(--ux-muted)" }}>{monthShort(selected)}</p>
      <div className="grid grid-cols-5 gap-2">
        {days.map((d) => {
          const on = d === selected;
          const future = d > today;
          return (
            <button key={d} type="button" disabled={future} onClick={() => onPick(d)}
                    aria-pressed={on} aria-label={`${dow(d)} ${dayNum(d)}`}
                    className="ux-press ux-tap-exempt flex h-[64px] flex-col items-center justify-center gap-1 rounded-[14px] disabled:opacity-45"
                    style={on
                      ? { background: "linear-gradient(160deg, var(--cy-period), var(--ux-fill))", color: "var(--ux-on-brand)",
                          boxShadow: "0 8px 18px -10px var(--cy-period)" }
                      : { background: "var(--ux-surface)", border: "1px solid var(--ux-line)", color: "var(--ux-ink)" }}>
              <span className="text-[12px]" style={{ opacity: on ? 0.9 : 1, color: on ? undefined : "var(--ux-muted)" }}>{dow(d)}</span>
              <span className="text-[17px] font-semibold">{dayNum(d)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── The month ───────────────────────────────────────────────────────────── */

const MARK_ORDER: Mark[] = ["period", "ovulation", "predicted", "fertile"];

function cellStyle(marks: Mark[]): React.CSSProperties {
  const m = MARK_ORDER.find((k) => marks.includes(k));
  switch (m) {
    case "period": return { background: "var(--cy-period)", color: "var(--ux-on-brand)", fontWeight: 600 };
    case "ovulation": return { background: "var(--cy-ovulation)", color: "var(--ux-on-brand)", fontWeight: 600 };
    case "predicted": return { background: "var(--cy-predicted)", color: "var(--cy-predicted-ink)", fontWeight: 600 };
    case "fertile": return { background: "var(--cy-fertile)", color: "var(--cy-fertile-ink)" };
    default: return { color: "var(--ux-ink)" };
  }
}

export function MonthCalendar({
  month, cells, today, onPrev, onNext, onPick, compact = false,
}: {
  month: string; cells: CycleCell[]; today: string;
  onPrev: () => void; onNext: () => void; onPick?: (d: string) => void; compact?: boolean;
}) {
  const [y, m] = month.split("-").map(Number);
  const lead = new Date(y, m - 1, 1).getDay();
  const size = compact ? 34 : 38;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={onPrev} aria-label="Previous month"
                className="ux-press grid h-10 w-10 place-items-center rounded-full" style={{ color: "var(--ux-ink-2)" }}>
          <Icons.ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <p className="text-[17px] font-semibold" style={{ color: "var(--ux-ink)" }}>{monthTitle(month)}</p>
        <button type="button" onClick={onNext} aria-label="Next month"
                className="ux-press grid h-10 w-10 place-items-center rounded-full" style={{ color: "var(--ux-ink-2)" }}>
          <Icons.ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-1.5 text-center">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <span key={d} className="pb-1 text-[12px]" style={{ color: "var(--ux-muted)" }}>{d}</span>
        ))}
        {Array.from({ length: lead }).map((_, i) => <span key={`l${i}`} />)}
        {cells.map((c) => {
          const isToday = c.date === today;
          const future = c.date > today;
          const style = cellStyle(c.marks);
          const label = `${dayNum(c.date)}${c.marks.length ? `, ${c.marks.join(", ")}` : ""}${isToday ? ", today" : ""}`;
          const dot = (
            <span className="relative grid place-items-center rounded-full text-[15px] tabular-nums"
                  style={{ width: size, height: size, ...style,
                           boxShadow: isToday ? "0 0 0 2px var(--ux-surface), 0 0 0 4px var(--cy-period)" : undefined }}>
              {dayNum(c.date)}
              {c.logged && !c.marks.includes("period") && (
                <span className="absolute bottom-[3px] h-[4px] w-[4px] rounded-full" style={{ background: "var(--cy-period)" }} />
              )}
            </span>
          );
          return (
            <span key={c.date} className="grid place-items-center">
              {onPick && !future ? (
                <button type="button" onClick={() => onPick(c.date)} aria-label={label}
                        className="ux-press ux-tap-exempt grid place-items-center rounded-full">{dot}</button>
              ) : <span aria-label={label}>{dot}</span>}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function Legend({ className = "" }: { className?: string }) {
  const items: { label: string; bg: string; ring?: boolean }[] = [
    { label: "Period", bg: "var(--cy-period)" },
    { label: "Predicted", bg: "var(--cy-predicted)", ring: true },
    { label: "Fertile window", bg: "var(--cy-fertile)", ring: true },
    { label: "Ovulation", bg: "var(--cy-ovulation)" },
  ];
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 ${className}`}>
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--ux-muted)" }}>
          <span className="h-[10px] w-[10px] rounded-full" style={{ background: i.bg, boxShadow: i.ring ? "inset 0 0 0 1px var(--cy-predicted-ink)" : undefined }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/* ── Phases ──────────────────────────────────────────────────────────────── */

const PHASE_TONE: Record<Phase, string> = {
  menstrual: "var(--cy-period)",
  follicular: "var(--cy-mood-calm)",
  ovulation: "var(--cy-ovulation)",
  luteal: "var(--cy-mood-tired)",
};

export function PhaseBar({ phases, day, length }: {
  phases: { key: Phase; label: string; from: number; to: number }[]; day: number | null; length: number;
}) {
  const at = day ? Math.min(1, Math.max(0, (day - 0.5) / length)) : null;
  return (
    <div>
      <div className="relative h-[10px]">
        <div className="flex h-full gap-[3px]">
          {phases.map((p) => (
            <span key={p.key} className="h-full rounded-full"
                  style={{ flex: Math.max(1, p.to - p.from + 1), background: PHASE_TONE[p.key] }} />
          ))}
        </div>
        {at !== null && (
          <span className="absolute top-1/2 h-[22px] w-[22px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ left: `${at * 100}%`, background: "var(--cy-mood-happy)",
                         border: "3px solid var(--ux-surface)", boxShadow: "var(--ux-shadow-sm)" }}
                aria-label={`Day ${day}`} />
        )}
      </div>
      <div className="mt-2.5 flex">
        {phases.map((p) => (
          <span key={p.key} className="text-[12px]"
                style={{ flex: Math.max(1, p.to - p.from + 1), color: "var(--ux-ink-2)", textAlign: p.key === "menstrual" ? "start" : "center" }}>
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Rows ────────────────────────────────────────────────────────────────── */

const TONE_TINT: Record<CycleInsight["tone"], [string, string]> = {
  pink: ["var(--cy-predicted)", "var(--cy-period)"],
  violet: ["var(--cy-fertile)", "var(--cy-ovulation)"],
  green: ["var(--ux-tint-green)", "var(--ux-green)"],
  orange: ["var(--ux-tint-orange)", "var(--ux-orange)"],
  amber: ["var(--ux-tint-amber)", "var(--cy-mood-tired)"],
};

export function InsightRow({ i }: { i: CycleInsight }) {
  const [bg, fg] = TONE_TINT[i.tone] ?? TONE_TINT.pink;
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-[12px]" style={{ background: bg }}>
        <Icon name={i.icon} className="h-[20px] w-[20px]" style={{ color: fg }} />
      </span>
      <p className="min-w-0 pt-0.5 text-[15px] leading-snug" style={{ color: "var(--ux-ink-2)" }}>
        {i.text}{i.strong && <> <b className="font-semibold" style={{ color: "var(--ux-ink)" }}>{i.strong}</b></>}
      </p>
    </div>
  );
}

export function CareRow({ item }: { item: CareItem }) {
  return (
    <div className="flex items-center gap-3.5 rounded-[16px] p-3" style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
      <span className="grid h-[48px] w-[48px] shrink-0 place-items-center rounded-[14px]" style={{ background: `var(${item.tint})` }}>
        <Icon name={item.icon} className="h-[22px] w-[22px]" style={{ color: "var(--ux-ink-2)" }} />
      </span>
      <span className="min-w-0">
        <b className="block text-[15px] font-semibold" style={{ color: "var(--ux-ink)" }}>{item.title}</b>
        <span className="block text-[13px]" style={{ color: "var(--ux-muted)" }}>{item.sub}</span>
      </span>
    </div>
  );
}

/* ── Toggle ──────────────────────────────────────────────────────────────── */

export function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled}
            onClick={() => onChange(!on)}
            className="ux-tap-exempt relative h-[28px] w-[48px] shrink-0 rounded-full transition-colors disabled:opacity-50"
            style={{ background: on ? "linear-gradient(90deg, var(--cy-period), var(--cy-ovulation))"
                                      : "color-mix(in srgb, var(--ux-faint) 38%, var(--ux-surface))" }}>
      <span className="absolute top-[3px] h-[22px] w-[22px] rounded-full transition-[inset-inline-start]"
            style={{ insetInlineStart: on ? 23 : 3, background: "var(--ux-surface)", boxShadow: "var(--ux-shadow-sm)" }} />
    </button>
  );
}

/* ── Soft card and art ───────────────────────────────────────────────────── */

export function Panel({ children, className = "", style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <section className={`rounded-[18px] p-4 ${className}`}
             style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)", boxShadow: "var(--ux-shadow-sm)", ...style }}>
      {children}
    </section>
  );
}

export const heroBg = "linear-gradient(135deg, var(--cy-hero-a), var(--cy-hero-b))";

/** The heart the reference sets after a kind sentence. */
export const SoftHeart = ({ className = "h-4 w-4" }: { className?: string }) => (
  <Icons.Heart className={`inline-block ${className}`} style={{ color: "var(--cy-ovulation-ink)", fill: "var(--cy-ovulation)" }} aria-hidden />
);

export function QuoteCard({ text, img = "/ux/art/avatar-woman-purple-kurta.webp", className = "" }: { text: string; img?: string; className?: string }) {
  return (
    <div className={`relative flex min-h-[124px] items-center overflow-hidden rounded-[18px] px-5 py-4 ${className}`}
         style={{ background: heroBg, border: "1px solid var(--ux-line)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ux/art/leaves-pink.webp" alt="" aria-hidden className="pointer-events-none absolute -bottom-6 -start-8 h-[110px] w-auto opacity-25 mix-blend-multiply" />
      <p className="relative z-[1] w-[60%] font-[family-name:var(--font-display)] text-[20px] italic leading-snug" style={{ color: "var(--ux-ink)" }}>
        &ldquo;{text}&rdquo; <SoftHeart />
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img} alt="" aria-hidden className="pointer-events-none absolute bottom-0 end-2 h-[118px] w-auto object-contain" />
    </div>
  );
}

/** A section heading inside a cycle screen: "Today's Care", "Your phases". */
export function Heading({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[17px] font-semibold" style={{ color: "var(--ux-ink)" }}>{children}</h2>
      {right}
    </div>
  );
}

export function ErrorLine({ text, onRetry }: { text: string | null; onRetry?: () => void }) {
  if (!text) return null;
  return (
    <p role="alert" className="mt-3 flex items-start gap-2 rounded-[12px] px-3 py-2.5 text-[15px]"
       style={{ background: "var(--ux-danger-tint)", color: "var(--ux-ink)" }}>
      <Icons.AlertCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--ux-orange)" }} aria-hidden />
      <span className="min-w-0 flex-1">{text}</span>
      {onRetry && <button type="button" onClick={onRetry} className="shrink-0 font-semibold" style={{ color: "var(--cy-period-ink)" }}>Try again</button>}
    </p>
  );
}

export { Icon };
