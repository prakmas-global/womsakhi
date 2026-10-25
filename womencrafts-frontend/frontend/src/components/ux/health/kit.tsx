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
import { hiddenFrom, setHiddenHealth } from "./nav-prefs";

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

function FrameInner({ active, hue, icon, eyebrow, title, sub, actions, art, tabs = [], children, night, bare }: FrameProps) {
  const [tab, setTab] = useTab(tabs);
  const h = HUE[hue];
  if (bare?.(tab)) {
    return (
      <HomeShell active={active} columns>
        <div key={tab} className="ux-swap flex flex-col gap-5">{children(tab)}</div>
      </HomeShell>
    );
  }
  return (
    <HomeShell active={active} columns>
      <section data-health-hero
               className="relative mb-4 grid items-center gap-4 overflow-hidden rounded-[var(--ux-r-lg,20px)] p-5 sm:p-7 md:grid-cols-[minmax(0,1fr)_auto]"
               style={night
                 ? { background: "linear-gradient(125deg, var(--ux-deep) 0%, var(--ux-deep-2) 55%, var(--ux-brand-900) 100%)", color: "var(--ux-deep-ink)" }
                 : { background: `linear-gradient(115deg, ${h.tint} 0%, var(--ux-surface) 62%)`, border: "1px solid var(--ux-line)" }}>
        <div className="min-w-0">
          <p className="mb-1.5 flex items-center gap-2 text-2xs font-extrabold uppercase tracking-[0.12em]"
             style={{ color: night ? "var(--ux-deep-ink-2)" : h.ink }}>
            <I name={icon} className="h-4 w-4" /> {eyebrow || "Health & Wellness"}
          </p>
          <h1 className="ux-screen-title text-[28px] font-extrabold leading-tight sm:text-[34px]"
              style={{ color: night ? "var(--ux-deep-ink)" : "var(--ux-ink)" }}>{title}</h1>
          <p className="mt-1.5 max-w-[60ch] text-[15px] leading-relaxed"
             style={{ color: night ? "var(--ux-deep-ink-3)" : "var(--ux-muted)" }}>{sub}</p>
          {actions && <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {art && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art} alt="" className="hidden h-[150px] w-[240px] rounded-[18px] object-cover md:block" />
        )}
      </section>

      {tabs.length > 1 && (
        <div role="tablist" aria-label={`${title} sections`} data-health-tabs
             className="mb-5 flex gap-1 overflow-x-auto border-b [scrollbar-width:none]" style={{ borderColor: "var(--ux-line)" }}>
          {tabs.map((t) => {
            const on = t.id === tab;
            return (
              <button key={t.id} role="tab" type="button" aria-selected={on} onClick={() => setTab(t.id)}
                      className="ux-press -mb-px min-h-[44px] shrink-0 whitespace-nowrap border-b-[2.5px] px-3.5 text-sm font-bold"
                      style={{ borderColor: on ? h.ink : "transparent", color: on ? "var(--ux-ink)" : "var(--ux-muted)" }}>
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      <div key={tab} className="ux-swap flex flex-col gap-5">{children(tab)}</div>
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
    <section id={id} className={`ux-card flex min-w-0 flex-col gap-4 p-4 sm:p-5 ${className}`}
             style={tint && h ? { background: h.tint } : undefined}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            {title && <h2 className="text-base font-extrabold" style={{ color: "var(--ux-ink)" }}>{title}</h2>}
            {sub && <p className="text-xs" style={{ color: "var(--ux-muted)" }}>{sub}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Main column and a side column on wide screens; one column below 1100px. */
export function Cols({ main, side }: { main: React.ReactNode; side: React.ReactNode }) {
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-5">{main}</div>
      <div className="flex min-w-0 flex-col gap-5">{side}</div>
    </div>
  );
}

export function MetricGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>{children}</div>;
}

export function Metric({ hue, icon, label, value, unit, sub, pct, href }: {
  hue: Hue; icon: string; label: string; value: React.ReactNode; unit?: string; sub?: string; pct?: number; href?: string;
}) {
  const h = HUE[hue];
  const body = (
    <>
      <span className="grid h-9 w-9 place-items-center rounded-[10px]" style={{ background: h.tint, color: h.ink }}>
        <I name={icon} className="h-[18px] w-[18px]" />
      </span>
      <span className="text-xs font-bold" style={{ color: "var(--ux-muted)" }}>{label}</span>
      <span className="text-[22px] font-extrabold tabular-nums leading-tight" style={{ color: "var(--ux-ink)" }}>
        {value}{unit && <small className="ms-1 text-xs font-bold" style={{ color: "var(--ux-muted)" }}>{unit}</small>}
      </span>
      {sub && <span className="text-xs" style={{ color: "var(--ux-muted)" }}>{sub}</span>}
      {pct != null && (
        <span className="mt-1 block h-[7px] overflow-hidden rounded-full" style={{ background: h.tint }}>
          <span className="block h-full rounded-full transition-[width] duration-500"
                style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: h.ink }} />
        </span>
      )}
    </>
  );
  const cls = "ux-card flex min-w-0 flex-col gap-1.5 p-3.5";
  return href
    ? <Link href={href} className={`${cls} ux-hov ux-press`} aria-label={`Open ${label}`}>{body}</Link>
    : <div className={cls}>{body}</div>;
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
      <div className="overflow-x-auto">
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
                className="ux-press min-h-[40px] rounded-full border-[1.5px] px-3.5 text-[13.5px] font-bold"
                style={on(o.value)
                  ? { borderColor: h.ink, background: h.tint, color: "var(--ux-ink)" }
                  : { borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink-2)" }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon, title, body, action }: { icon: string; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-[14px] border-[1.5px] border-dashed p-5"
         style={{ borderColor: "var(--ux-line-strong)" }}>
      <I name={icon} className="h-6 w-6" style={{ color: "var(--ux-muted)" }} />
      <b className="text-[15px]" style={{ color: "var(--ux-ink)" }}>{title}</b>
      <p className="max-w-[56ch] text-sm" style={{ color: "var(--ux-muted)" }}>{body}</p>
      {action}
    </div>
  );
}

/** "Not medical advice" — said once per section that could be read as advice. */
export function Disclaimer({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2.5 rounded-[12px] p-3 text-[13.5px]"
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
