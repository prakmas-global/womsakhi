"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import * as Icons from "@/components/ux/icons";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { toast } from "@/components/ux/mobile/Toast";
import { apiErrorMessage } from "@/lib/api";
import {
  DEFAULT_SETTINGS, apiAddEntry, apiDeleteEntry, apiEditEntry, apiEntries, apiHealthSettings, apiSaveHealthSettings,
  type Entry, type HealthKind, type HealthSettings, type KindData,
} from "@/lib/health-api";
import { dailyIndex } from "@/components/ux/fill/content";
import { hiddenFrom, setHiddenHealth } from "./nav-prefs";
import { bannerFocus } from "./art";
import { HEALTH_QUOTES, healthSection } from "./quotes";
import frame from "./frame.module.css";

/**
 * The Health module's shared parts.
 *
 * Every section (Fitness, Nutrition, Sleep, …) is one route with tabs in the
 * URL (`?tab=log`), drawn by `HealthFrame`: the app shell, a hero in the
 * section's own hue, and a tab bar. Colours are the design system's tokens
 * only (`--ux-*`, which map onto design-system/brand.css) — never hex.
 *
 * Section hues pair a tint with the ink that clears 4.5:1 on it, so a word in
 * a section's colour is always readable.
 */

export type Hue = "pink" | "magenta" | "violet" | "green" | "blue" | "orange" | "amber" | "lilac";

export const HUE: Record<Hue, { tint: string; ink: string }> = {
  pink: { tint: "var(--ux-tint-pink)", ink: "var(--ux-pink-ink)" },
  magenta: { tint: "var(--ux-tint-magenta)", ink: "var(--ux-magenta-ink)" },
  violet: { tint: "var(--ux-tint-violet)", ink: "var(--ux-violet-ink)" },
  lilac: { tint: "var(--ux-tint-lilac)", ink: "var(--ux-lilac-ink)" },
  green: { tint: "var(--ux-tint-green)", ink: "var(--ux-green-ink)" },
  blue: { tint: "var(--ux-tint-blue)", ink: "var(--ux-blue-ink)" },
  orange: { tint: "var(--ux-tint-orange)", ink: "var(--ux-orange-ink)" },
  amber: { tint: "var(--ux-tint-amber)", ink: "var(--ux-amber-ink)" },
};

/** The hub and ten sections, in the order the module lists them (Videos and Health Records are reached from inside other sections). */
export const SECTIONS: { id: string; label: string; href: string; icon: string; hue: Hue; note: string }[] = [
  { id: "home", label: "Health home", href: "/app/wellness", icon: "Heart", hue: "magenta", note: "Your day at a glance" },
  { id: "fitness", label: "Fitness", href: "/app/health/fitness", icon: "Dumbbell", hue: "orange", note: "Move and feel stronger" },
  { id: "nutrition", label: "Nutrition & Diet", href: "/app/health/nutrition", icon: "Apple", hue: "green", note: "Eat well, every day" },
  { id: "sleep", label: "Sleep", href: "/app/health/sleep", icon: "Moon", hue: "violet", note: "Rest better" },
  { id: "mental", label: "Mental Wellness", href: "/app/health/mind", icon: "Brain", hue: "blue", note: "A calmer mind" },
  { id: "games", label: "Games & Stress Relief", href: "/app/health/games", icon: "Gamepad2", hue: "amber", note: "A mindful break" },
  { id: "fertility", label: "Fertility", href: "/app/health/fertility", icon: "Flower2", hue: "pink", note: "Know your cycle" },
  { id: "pregnancy", label: "Pregnancy", href: "/app/health/pregnancy", icon: "Baby", hue: "lilac", note: "Week by week" },
  { id: "reminders", label: "Appointments & Reminders", href: "/app/health/reminders", icon: "CalendarClock", hue: "magenta", note: "Never miss one" },
  { id: "mentor", label: "Mentor Connect", href: "/app/health/mentors", icon: "Users", hue: "orange", note: "Women who've been there" },
  { id: "doctor", label: "Doctor Consultation", href: "/app/health/doctors", icon: "Stethoscope", hue: "green", note: "Talk to a doctor" },
];

export function I({ name, className = "h-5 w-5", style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const C = (Icons as unknown as Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>>)[name] ?? Icons.Sparkles;
  return <C className={className} style={style} />;
}

/* ── the frame ────────────────────────────────────────────────────────── */

export type TabDef = { id: string; label: string };

/** The active tab, from `?tab=`, and a setter that keeps the URL in step. */
export function useTab(tabs: TabDef[]): [string, (id: string) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const want = params.get("tab") || "";
  const active = tabs.some((t) => t.id === want) ? want : tabs[0]?.id ?? "";
  const set = useCallback((id: string) => {
    const q = new URLSearchParams(params.toString());
    if (id === tabs[0]?.id) q.delete("tab"); else q.set("tab", id);
    router.replace(`${path}${q.toString() ? `?${q}` : ""}`, { scroll: false });
  }, [params, path, router, tabs]);
  return [active, set];
}

export interface FrameProps {
  /** Nav path this page highlights. */
  active: string;
  hue: Hue;
  icon: string;
  eyebrow?: string;
  title: string;
  sub: string;
  /** Hero buttons: one primary at most. */
  actions?: React.ReactNode;
  /** A big illustration on the right of the hero (an /ux/art image). */
  art?: string;
  tabs?: TabDef[];
  /** Renders the body for the active tab. */
  children: (tab: string) => React.ReactNode;
  /** A dark, starry hero — Sleep's. */
  night?: boolean;
  /** Tabs that draw their own top (Health home's stage): no hero and no tab bar there. */
  bare?: (tab: string) => boolean;
}

/** Wrap in Suspense: `useSearchParams` needs a boundary in the app router. */
export function HealthFrame(props: FrameProps) {
  return <Suspense><FrameInner {...props} /></Suspense>;
}

/** This section's quote of the day; "Another" steps to the next of its quotes. */
export function SectionQuote({ path }: { path: string }) {
  const list = HEALTH_QUOTES[healthSection(path)] ?? HEALTH_QUOTES.home;
  const [i, setI] = useState(() => dailyIndex(list.length, path));
  return (
    <figure className={frame.quote} data-health-quote>
      <span className={frame.mark} aria-hidden>“</span>
      <p>{list[i % list.length]}</p>
      <cite>— <b>WomSakhi</b></cite>
      {list.length > 1 && (
        <button type="button" className={frame.another} onClick={() => setI((n) => n + 1)} aria-label="Show another quote" title="Another quote">
          <Icons.RefreshCw />
        </button>
      )}
    </figure>
  );
}

function FrameInner({ active, hue, icon, eyebrow, title, sub, actions, art, tabs = [], children, bare }: FrameProps) {
  const [tab, setTab] = useTab(tabs);
  const h = HUE[hue];
  if (bare?.(tab)) {
    return (
      <HomeShell active={active} columns>
        <div key={tab} data-dashboard="health" className="ux-swap flex flex-col gap-[var(--dashboard-gap,12px)]">{children(tab)}</div>
      </HomeShell>
    );
  }
  return (
    <HomeShell active={active} columns>
      <div data-dashboard="health" className="flex flex-col">
      {/* The banner and the section's quote side by side, as Work lays out its
          dashboard — on the same 320px column as the side panels below. */}
      <div className={frame.top}>
        <section data-health-hero className={frame.hero}>
          {art && (() => {
            const f = bannerFocus(art);
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={art} alt="" style={{ objectPosition: `70% ${f.y ?? "30%"}`, transform: f.flip ? "scaleX(-1)" : undefined }} />
            );
          })()}
          <div className={frame.heroContent}>
            <p className={frame.eyebrow}><I name={icon} /> {eyebrow || "Health & Wellness"}</p>
            <h1 className="ux-screen-title">{title}</h1>
            <p className={frame.sub}>{sub}</p>
            {actions && <div className={frame.actions} data-health-actions>{actions}</div>}
          </div>
        </section>
        <SectionQuote path={active} />
      </div>

      {tabs.length > 1 && (
        // Pills on a soft track, as the approved design draws them: the open tab is
        // a raised white pill in the section's colour. It scrolls sideways on a phone.
        <div role="tablist" aria-label={`${title} sections`} data-health-tabs
             className="ux-scroll-x mb-3 flex w-fit max-w-full gap-1 rounded-full p-1.5"
             style={{ background: `color-mix(in srgb, ${h.tint} 70%, var(--ux-surface-2))` }}>
          {tabs.map((t) => {
            const on = t.id === tab;
            return (
              <button key={t.id} role="tab" type="button" aria-selected={on} onClick={() => setTab(t.id)}
                      className="ux-press min-h-[40px] shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-bold transition-colors"
                      style={on ? { background: "var(--ux-surface)", color: h.ink, boxShadow: "0 2px 8px -2px rgba(27, 18, 56, 0.18)" }
                                : { background: "transparent", color: "var(--ux-ink-2)" }}>
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      <div key={tab} className="ux-swap flex flex-col gap-[var(--dashboard-gap,12px)]">{children(tab)}</div>
      </div>
    </HomeShell>
  );
}

/* ── building blocks ─────────────────────────────────────────────────── */

export function Panel({ title, sub, action, hue, tint, children, className = "", id }: {
  title?: string; sub?: string; action?: React.ReactNode; hue?: Hue; tint?: boolean; children: React.ReactNode;
  className?: string; id?: string;
}) {
  const h = hue ? HUE[hue] : null;
  return (
    <section id={id} data-health-panel className={`flex min-w-0 flex-col gap-3 rounded-[var(--ux-r-sm,8px)] border p-3 sm:px-4 sm:py-3.5 ${className}`}
             style={{ borderColor: tint && h ? `color-mix(in srgb, ${h.ink} 18%, var(--ux-line))` : "var(--ux-line)",
                      background: tint && h ? h.tint : "var(--ux-surface)" }}>
      {(title || action) && (
        <div className="flex min-h-[23px] flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            {title && <h2 className="text-base font-bold leading-tight" style={{ color: "var(--ux-ink)" }}>{title}</h2>}
            {sub && <p className="mt-0.5 text-[length:var(--dash-fs-sm,12px)]" style={{ color: "var(--ux-muted)" }}>{sub}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * Main column and a side column on wide screens; one column below 1280px. The
 * side column is Work's 320px and the gap is the dashboard gap, so it lines up
 * with the section's quote above it.
 */
export function Cols({ main, side }: { main: React.ReactNode; side: React.ReactNode }) {
  return (
    <div className="grid items-start gap-[var(--dashboard-gap,12px)] xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-[var(--dashboard-gap,12px)]">{main}</div>
      <aside className="flex min-w-0 flex-col gap-[var(--dashboard-gap,12px)]">{side}</aside>
    </div>
  );
}

export function MetricGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>{children}</div>;
}

export function Metric({ hue, icon, label, value, unit, sub, pct, href }: {
  hue: Hue; icon: string; label: string; value: React.ReactNode; unit?: string; sub?: string; pct?: number; href?: string;
}) {
  const h = HUE[hue];
  const body = (
    <>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--ux-r-sm,8px)]" style={{ background: h.tint, color: h.ink }}>
        <I name={icon} className="h-6 w-6" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <strong className="truncate text-[20px] font-bold leading-[1.15] tabular-nums" style={{ color: "var(--ux-ink)" }}>
          {value}{unit && <small className="ms-1 text-[length:var(--dash-fs-sm,12px)] font-semibold" style={{ color: "var(--ux-muted)" }}>{unit}</small>}
        </strong>
        <small className="mt-1 truncate text-[length:var(--dash-fs-sm,12px)]" style={{ color: "var(--ux-muted)" }}>{label}</small>
        {sub && <small className="truncate text-[length:var(--dash-fs-sm,12px)]" style={{ color: "var(--ux-muted)" }}>{sub}</small>}
        {pct != null && (
          <span className="mt-1.5 block h-[5px] overflow-hidden rounded-full" style={{ background: h.tint }}>
            <span className="block h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: h.ink }} />
          </span>
        )}
      </span>
      {href && <I name="ChevronRight" className="h-3.5 w-3.5 shrink-0 self-center" style={{ color: "var(--ux-brand)" }} />}
    </>
  );
  // Work's stat tile: an icon box, the number and its label beside it.
  const cls = "flex min-h-[70px] min-w-0 items-center gap-2.5 rounded-[var(--ux-r-sm,8px)] border p-2.5";
  const style = { borderColor: "var(--ux-line)", background: "var(--ux-surface)" };
  return href
    ? <Link href={href} className={cls} style={style} aria-label={`Open ${label}`}>{body}</Link>
    : <div className={cls} style={style}>{body}</div>;
}

/** A small, honest bar chart: one bar per label, an optional dashed goal line. */
export function BarChart({ data, goal, hue, unit = "", height = 160 }: {
  data: { label: string; value: number; sub?: string }[]; goal?: number; hue: Hue; unit?: string; height?: number;
}) {
  // Drawn at the width it is given, 1:1 — a fixed viewBox stretched to a wide
  // card scaled the numbers to twice their size. Too many bars to fit scroll.
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const h = HUE[hue];
  const max = Math.max(goal || 0, ...data.map((d) => d.value), 1);
  const W = Math.max(width || 300, data.length * 34), top = 18, bottom = 24, ch = height - top - bottom;
  const bw = Math.min(28, (W / data.length) * 0.55);
  const gy = goal ? top + ch - (goal / max) * ch : 0;
  return (
    <div ref={box} className="min-w-0">
      {goal ? (
        <p className="mb-1 flex items-center justify-end gap-1.5 text-[11px] font-bold" style={{ color: "var(--ux-muted)" }}>
          <span aria-hidden className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: "var(--ux-muted)" }} /> Goal {goal}{unit}
        </p>
      ) : null}
      <div className="ux-scroll-x">
        {width > 0 && (
          <svg width={W} height={height} viewBox={`0 0 ${W} ${height}`} className="block" role="img"
               aria-label={data.map((d) => `${d.label}: ${d.value}${unit}`).join(", ") + (goal ? `. Goal ${goal}${unit}` : "")}>
            <line x1="0" x2={W} y1={top + ch} y2={top + ch} stroke="var(--ux-line-strong)" />
            {goal ? <line x1="0" x2={W} y1={gy} y2={gy} stroke="var(--ux-ink)" strokeOpacity=".35" strokeDasharray="4 4" /> : null}
            {data.map((d, i) => {
              const x = (i + 0.5) * (W / data.length);
              const bh = (d.value / max) * ch;
              return (
                <g key={d.label + i}>
                  <rect x={x - bw / 2} y={top + ch - bh} width={bw} height={Math.max(bh, d.value ? 2 : 0)} rx="5" fill={h.ink} />
                  {d.value > 0 && <text x={x} y={top + ch - bh - 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--ux-ink)">{d.value}</text>}
                  <text x={x} y={height - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--ux-muted)">{d.label}</text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}

/** Choice chips — the minimal-typing control. Multi when `value` is an array. */
export function Chips<T extends string>({ options, value, onChange, label, hue = "pink" }: {
  options: readonly T[] | readonly { value: T; label: string }[]; value: T | T[]; onChange: (v: T) => void; label: string; hue?: Hue;
}) {
  const h = HUE[hue];
  const opts = (options as readonly (T | { value: T; label: string })[]).map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const on = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v);
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {opts.map((o) => (
        <button key={o.value} type="button" aria-pressed={on(o.value)} onClick={() => onChange(o.value)}
                className="ux-press min-h-[36px] rounded-[var(--ux-r-sm,8px)] border px-3 text-[13px] font-semibold"
                style={on(o.value)
                  ? { borderColor: h.ink, background: h.ink, color: "var(--ux-on-brand, #fff)" }
                  : { borderColor: "var(--ux-line)", background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon, title, body, action }: { icon: string; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-[var(--ux-r-sm,8px)] border border-dashed p-5 text-center"
         style={{ borderColor: "var(--ux-line-strong)" }}>
      <I name={icon} className="h-7 w-7" style={{ color: "var(--ux-muted)" }} />
      <b className="text-[14px]" style={{ color: "var(--ux-ink)" }}>{title}</b>
      <p className="max-w-[52ch] text-[13px]" style={{ color: "var(--ux-muted)" }}>{body}</p>
      {action}
    </div>
  );
}

/** "Not medical advice" — said once per section that could be read as advice. */
export function Disclaimer({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2.5 rounded-[var(--ux-r-sm,8px)] p-3 text-[13px]"
       style={{ background: "var(--ux-tint-amber)", color: "var(--ux-ink)" }}>
      <I name="Info" className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--ux-amber-ink)" }} />
      <span>{children}</span>
    </p>
  );
}

/* ── data hooks ──────────────────────────────────────────────────────── */

/**
 * Her entries of some kinds, with add / edit / remove that update the list at
 * once and roll back if the server refuses. A delete offers Undo for seven
 * seconds, which saves the entry again.
 */
export function useEntries<K extends HealthKind>(kinds: K | K[], range: { from?: string; to?: string } = {}) {
  const key = `${Array.isArray(kinds) ? kinds.join(",") : kinds}|${range.from || ""}|${range.to || ""}`;
  const [rows, setRows] = useState<Entry<K>[] | null>(null);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);
  // The list as last rendered, so a delete knows what Undo should put back.
  const latest = useRef<Entry<K>[] | null>(null);
  useEffect(() => { latest.current = rows; }, [rows]);

  useEffect(() => {
    const ctl = new AbortController();
    const [k, from, to] = key.split("|");
    apiEntries(k.split(",") as K[], { from, to }, ctl.signal)
      .then((r) => { setRows(r); setError(""); })
      .catch((e) => { if (!ctl.signal.aborted) { setError(apiErrorMessage(e)); setRows((r) => r ?? []); } });
    return () => ctl.abort();
  }, [key, nonce]);

  const add = useCallback(async <KK extends K>(kind: KK, data: KindData[KK], date = "", msg?: string) => {
    try {
      const made = await apiAddEntry(kind, data, date);
      setRows((r) => [made as unknown as Entry<K>, ...(r ?? [])]);
      if (msg) toast(msg, { tone: "success" });
      return made;
    } catch (e) {
      toast(apiErrorMessage(e), { tone: "error" });
      return null;
    }
  }, []);

  const edit = useCallback(async (id: string, patch: { data?: Partial<KindData[K]>; date?: string }, msg?: string) => {
    let before: Entry<K>[] | null = null;
    setRows((r) => { before = r; return (r ?? []).map((x) => (x.id === id ? { ...x, ...(patch.date != null ? { date: patch.date } : {}), data: { ...x.data, ...(patch.data || {}) } } : x)); });
    try {
      const saved = await apiEditEntry<K>(id, patch);
      setRows((r) => (r ?? []).map((x) => (x.id === id ? saved : x)));
      if (msg) toast(msg, { tone: "success" });
      return saved;
    } catch (e) {
      setRows(before);
      toast(apiErrorMessage(e), { tone: "error" });
      return null;
    }
  }, []);

  const remove = useCallback(async (id: string, msg = "Deleted") => {
    let before: Entry<K>[] | null = null;
    const gone = latest.current?.find((x) => x.id === id);
    setRows((r) => { before = r; return (r ?? []).filter((x) => x.id !== id); });
    try {
      await apiDeleteEntry(id);
      const undo = gone && (() => {
        apiAddEntry(gone.kind, gone.data, gone.date)
          .then((made) => { setRows((r) => [made as unknown as Entry<K>, ...(r ?? [])]); toast("Put back", { tone: "success" }); })
          .catch((e) => toast(apiErrorMessage(e), { tone: "error" }));
      });
      toast(msg, undo ? { tone: "success", duration: 7000, action: { label: "Undo", onPress: undo } } : { tone: "success" });
    } catch (e) {
      setRows(before);
      toast(apiErrorMessage(e), { tone: "error" });
    }
  }, []);

  return { rows: rows ?? [], loading: rows === null, error, add, edit, remove, reload: () => setNonce((n) => n + 1) };
}

/** Her health settings, with a merge-save. Defaults until the server answers. */
export function useHealthSettings() {
  const [s, setS] = useState<HealthSettings | null>(null);
  useEffect(() => {
    const ctl = new AbortController();
    apiHealthSettings(ctl.signal)
      // Defaults under what the server sends, so a field an older server lacks still has its value.
      .then((got) => { const full = { ...DEFAULT_SETTINGS, ...got }; setS(full); setHiddenHealth(hiddenFrom(full)); })
      .catch(() => { if (!ctl.signal.aborted) setS(DEFAULT_SETTINGS); });
    return () => ctl.abort();
  }, []);
  const save = useCallback(async (patch: Partial<HealthSettings>, msg?: string) => {
    try {
      const next = { ...DEFAULT_SETTINGS, ...(await apiSaveHealthSettings(patch)) };
      setS(next);
      setHiddenHealth(hiddenFrom(next));
      if (msg) toast(msg, { tone: "success" });
      return next;
    } catch (e) {
      toast(apiErrorMessage(e), { tone: "error" });
      return null;
    }
  }, []);
  return { settings: s ?? DEFAULT_SETTINGS, ready: s !== null, save };
}

/** Sum a numeric field of entries for one day. */
export function sumOn<K extends HealthKind>(rows: Entry<K>[], day: string, field: string) {
  return rows.filter((r) => r.date === day).reduce((a, r) => a + (Number((r.data as Record<string, unknown>)[field]) || 0), 0);
}

/** The last `n` days, oldest first, as YYYY-MM-DD with a short weekday label. */
export function lastDays(n: number, end = new Date()) {
  const out: { day: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end); d.setDate(d.getDate() - i);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out.push({ day, label: d.toLocaleDateString("en-IN", { weekday: "short" }).slice(0, 2) });
  }
  return out;
}
