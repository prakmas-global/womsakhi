"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import { apiNotificationPrefs, apiSaveNotificationPrefs, type NotificationPrefs } from "@/lib/member-api";
import { useResource } from "@/lib/use-resource";
import { useNotifications } from "@/components/ux/live";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useT } from "@/i18n";

/**
 * Quiet hours.
 *
 * ── Why this screen exists ─────────────────────────────────────────────────
 * The Notifications rail has offered "Set your quiet hours" for a while, and
 * the link landed on the notification preferences page — nine on/off switches
 * and nowhere to put a time. The hours it printed, "9:30 PM — 7:00 AM", were
 * written into the page. This screen, and the six fields behind it, are what
 * that link was always promising.
 *
 * ── Why a dial ─────────────────────────────────────────────────────────────
 * A sleep window is a shape, not two numbers: it wraps midnight, and what
 * matters is how much of the night it covers. Four number fields make her do
 * that arithmetic herself. A ring shows it.
 *
 * ── Why her own reminders are on the ring ──────────────────────────────────
 * The question she is really asking is "what will I miss?" — so the things she
 * already has scheduled are marked on the dial, and the ones the window would
 * catch brighten. She judges the window against her night, not in the abstract.
 */

const C = 170, R = 120, SNAP = 5;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const pointAt = (m: number): [number, number] => {
  const a = (m / 1440) * 2 * Math.PI;
  return [C + R * Math.sin(a), C - R * Math.cos(a)];
};
const fmt = (m: number) => {
  const h = Math.floor(m / 60) % 24, mm = m % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

export default function QuietHoursPage() {
  const tr = useT();
  const { data: server, refetch } = useResource(
    useCallback(() => apiNotificationPrefs(), []),
    null as NotificationPrefs | null,
  );
  const { data: notifications } = useNotifications();

  const [draft, setDraft] = useState<NotificationPrefs | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (server && !draft) setDraft(server); }, [server, draft]);

  const p = draft;
  const set = (patch: Partial<NotificationPrefs>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setSaved(false);
  };

  const save = async () => {
    if (!p) return;
    setSaving(true); setError(null);
    try { await apiSaveNotificationPrefs(p); setSaved(true); refetch(); }
    catch { setError("Could not save. Check your connection and try again."); }
    finally { setSaving(false); }
  };

  if (!p) {
    return (
      <HomeShell active="/app/settings">
        <p className="mx-auto max-w-[1140px] text-xsm" style={{ color: "var(--ux-muted)" }}>{tr("settingsQuiethours.loadingYourSettings")}</p>
      </HomeShell>
    );
  }

  const span = (p.quiet_end - p.quiet_start + 1440) % 1440;
  const inside = (m: number) => ((m - p.quiet_start + 1440) % 1440) < span;

  /** Her real reminders, placed on the ring by the hour they arrive. */
  const marks = notifications.slice(0, 14).map((n) => {
    const d = n.createdAt ? new Date(n.createdAt) : null;
    const m = d && !Number.isNaN(d.getTime()) ? d.getHours() * 60 + d.getMinutes() : null;
    return m === null ? null : { m, title: n.title, kind: n.kind };
  }).filter(Boolean) as { m: number; title: string; kind: string }[];

  const caught = marks.filter((x) => inside(x.m)).length;
  const dayCount = p.quiet_days.filter(Boolean).length;

  return (
    <HomeShell active="/app/settings">
      <div className="mx-auto flex w-full max-w-[1140px] flex-col gap-5">
        <header>
          {/* Settings › Quiet hours, as the design has it — SettingsPage was
              printing a second "Quiet hours" heading above the real one and
              capping the page at 720px, which collapsed the two columns. */}
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold"
             style={{ color: "var(--ux-faint)" }}>
            <Link href="/app/settings" className="hover:underline" style={{ color: "var(--ux-faint)" }}>Settings</Link>
            <Icons.ChevronRight className="h-[13px] w-[13px]" />
            <span style={{ color: "var(--ux-ink-2)" }}>{tr("settingsQuiethours.quietHours")}</span>
          </p>
          <h1 className="text-[clamp(1.375rem,3vw,1.875rem)] font-extrabold leading-[1.12] tracking-[-0.03em]"
              style={{ color: "var(--ux-ink)", textWrap: "balance" }}>{tr("settingsQuiethours.yourPhoneSleepsWhenYouDo")}</h1>
          <p className="mt-2.5 max-w-[58ch] text-sm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
            Pick the hours you do not want to be disturbed. Everything that arrives while you sleep
            waits for you in Notifications — nothing is lost, it just waits until morning.
          </p>
        </header>

        {/* one decision, so it gets its own weight */}
        <div className="ux-sq flex items-center gap-4 rounded-[16px] p-4"
             style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)",
                      boxShadow: "var(--ux-shadow-card)" }}>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold" style={{ color: "var(--ux-ink)" }}>
              Quiet hours are {p.quiet_hours ? "on" : "off"}
            </h2>
            <p className="mt-0.5 text-xsm" style={{ color: "var(--ux-muted)" }}>
              {p.quiet_hours
                ? `${dayCount === 7 ? "Every day" : dayCount === 0 ? "No nights picked" : DAYS.filter((_, i) => p.quiet_days[i]).join(", ")}, ${fmt(p.quiet_start)} to ${fmt(p.quiet_end)}`
                : "Off — nothing is held back"}
            </p>
          </div>
          <Switch on={p.quiet_hours} label={tr("settingsQuiethours.quietHours2")}
                  onChange={(v) => set({ quiet_hours: v })} />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_342px]">
          <Dial p={p} set={set} marks={marks} inside={inside} span={span} caught={caught} />

          <div className="flex flex-col gap-5">
            <Nights days={p.quiet_days} onChange={(quiet_days) => set({ quiet_days })} />
            <Breakthrough p={p} set={set} />
            <Waited marks={marks} inside={inside} on={p.quiet_hours}
                    from={fmt(p.quiet_start)} to={fmt(p.quiet_end)} allowMoney={p.quiet_allow_money} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={save} disabled={saving}
                  className="ux-press flex min-h-[46px] items-center gap-2 rounded-[12px] px-6 text-sm font-bold disabled:opacity-60"
                  style={{ background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))",
                           color: "var(--ux-on-brand)" }}>
            {saving ? "Saving…" : "Save quiet hours"}
          </button>
          <button type="button" onClick={() => set({ quiet_start: 1290, quiet_end: 420 })}
                  className="ux-press flex min-h-[46px] items-center rounded-[12px] px-5 text-sm font-bold"
                  style={{ border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink-2)" }}>{tr("settingsQuiethours.resetToPmAm")}</button>
          {saved && (
            <span className="flex items-center gap-1.5 text-xsm font-bold" style={{ color: "var(--ux-green-ink)" }}>
              <Icons.Check className="h-4 w-4" /> Saved.
            </span>
          )}
          {error && <span className="text-xsm font-semibold" style={{ color: "var(--ux-danger-ink)" }}>{error}</span>}
        </div>
      </div>
    </HomeShell>
  );
}

/* ── the dial ───────────────────────────────────────────────────────────── */

function Dial({
  p, set, marks, inside, span, caught,
}: {
  p: NotificationPrefs;
  set: (patch: Partial<NotificationPrefs>) => void;
  marks: { m: number; title: string; kind: string }[];
  inside: (m: number) => boolean;
  span: number; caught: number;
}) {
  const tr = useT();
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<"start" | "end" | null>(null);

  const minutesAt = (clientX: number, clientY: number) => {
    const r = svg.current!.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * 340 - C;
    const y = ((clientY - r.top) / r.height) * 340 - C;
    const m = Math.round((Math.atan2(x, -y) / (2 * Math.PI)) * 1440 / SNAP) * SNAP;
    return (m + 1440) % 1440;
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!drag.current) return;
      const m = minutesAt(e.clientX, e.clientY);
      set(drag.current === "start" ? { quiet_start: m } : { quiet_end: m });
    };
    const up = () => { drag.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  });

  const nudge = (which: "start" | "end", by: number) => {
    const cur = which === "start" ? p.quiet_start : p.quiet_end;
    const m = ((cur + by) % 1440 + 1440) % 1440;
    set(which === "start" ? { quiet_start: m } : { quiet_end: m });
  };

  const [sx, sy] = pointAt(p.quiet_start);
  const [ex, ey] = pointAt(p.quiet_end);
  const large = span > 720 ? 1 : 0;
  const hrs = Math.floor(span / 60), mins = span % 60;

  return (
    <section className="ux-sq rounded-[20px] p-5"
             style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)",
                      boxShadow: "var(--ux-shadow-card)" }}>
      <h3 className="text-sm font-bold" style={{ color: "var(--ux-ink)" }}>{tr("settingsQuiethours.whenYouSleep")}</h3>
      <p className="mt-1 text-xsm leading-relaxed" style={{ color: "var(--ux-muted)" }}>
        Drag either handle, or use the arrow keys. The marks on the ring are reminders you already
        have — you can see which ones the quiet window would catch.
      </p>

      <div className="relative mt-3 grid place-items-center">
        <svg ref={svg} viewBox="0 0 340 340" role="group" aria-label={tr("settingsQuiethours.quietHoursDial")}
             className="h-auto w-[min(400px,78vw)] touch-none" style={{ overflow: "visible" }}>
          <defs>
            <linearGradient id="qh-arc" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="var(--ux-brand-900)" />
              <stop offset="1" stopColor="var(--ux-brand)" />
            </linearGradient>
          </defs>

          <circle cx={C} cy={C} r={R} fill="none" stroke="var(--ux-track)" strokeWidth={26} />
          <path d={`M ${sx} ${sy} A ${R} ${R} 0 ${large} 1 ${ex} ${ey}`} fill="none"
                stroke="url(#qh-arc)" strokeWidth={26} strokeLinecap="round"
                opacity={p.quiet_hours ? 1 : 0.25} />

          {/* hours: labels outside the band, so nothing lands on the readout */}
          {Array.from({ length: 24 }, (_, h) => {
            const a = (h / 24) * 2 * Math.PI;
            const major = h % 6 === 0;
            const r1 = R - 15, r2 = major ? R - 25 : R - 21;
            const t: Record<number, string> = { 0: "12 AM", 6: "6 AM", 12: "12 PM", 18: "6 PM" };
            const rl = R + 26;
            return (
              <g key={h}>
                <line x1={C + r1 * Math.sin(a)} y1={C - r1 * Math.cos(a)}
                      x2={C + r2 * Math.sin(a)} y2={C - r2 * Math.cos(a)}
                      stroke="var(--ux-faint)" strokeWidth={major ? 2 : 1} opacity={major ? 0.75 : 0.3} />
                {major && (
                  <text x={C + rl * Math.sin(a)} y={C - rl * Math.cos(a)} fill="var(--ux-faint)"
                        /* 12, not 10.5: the app's floor for anything a phone
                           has to read, and these four are the only labels
                           telling her which half of the clock she is on. */
                        fontSize={12} fontWeight={700} textAnchor="middle" dominantBaseline="middle">
                    {t[h]}
                  </text>
                )}
              </g>
            );
          })}

          {marks.map((mk, i) => {
            const [x, y] = pointAt(mk.m);
            const hit = inside(mk.m) && p.quiet_hours;
            return (
              <circle key={i} cx={x} cy={y} r={hit ? 5.5 : 4} fill="var(--ux-rib-3)"
                      stroke="var(--ux-surface)" strokeWidth={2} opacity={hit ? 1 : 0.4}>
                <title>{mk.title}{hit ? " — would wait until morning" : ""}</title>
              </circle>
            );
          })}

          <Handle x={sx} y={sy} tone="var(--ux-brand)" label={tr("settingsQuiethours.sleepTime")} value={p.quiet_start}
                  onDown={() => (drag.current = "start")} onKey={(by) => nudge("start", by)}>
            <path d="M4 -5a6.5 6.5 0 1 1-8.2 8.2A7 7 0 0 0 4 -5Z" fill="var(--ux-brand)" />
          </Handle>
          <Handle x={ex} y={ey} tone="var(--ux-amber-ink)" label={tr("settingsQuiethours.wakeTime")} value={p.quiet_end}
                  onDown={() => (drag.current = "end")} onKey={(by) => nudge("end", by)}>
            <g stroke="var(--ux-amber-ink)" strokeWidth={1.9} strokeLinecap="round" fill="none">
              <circle r={3.6} />
              <path d="M0 -8v2M0 6v2M-8 0h2M6 0h2M-5.7 -5.7l1.4 1.4M4.3 4.3l1.4 1.4M-5.7 5.7l1.4-1.4M4.3 -4.3l1.4-1.4" />
            </g>
          </Handle>
        </svg>

        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <span className="text-[12px] lg:text-2xs font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--ux-faint)" }}>Sleep</span>
          <p className="my-0.5 text-2xlm font-extrabold leading-[1.12] tracking-[-0.03em] tabular-nums"
             style={{ color: "var(--ux-ink)" }}>{fmt(p.quiet_start)}</p>
          <span className="text-[12px] lg:text-2xs font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--ux-faint)" }}>Wake</span>
          <p className="my-0.5 text-2xlm font-extrabold leading-[1.12] tracking-[-0.03em] tabular-nums"
             style={{ color: "var(--ux-ink)" }}>{fmt(p.quiet_end)}</p>
          <p className="mt-2 text-xsm font-semibold" style={{ color: "var(--ux-ink-2)" }}>
            that is <b className="tabular-nums" style={{ color: "var(--ux-ink)" }}>
              {mins ? `${hrs} hr ${mins} min` : `${hrs} hr`}</b> of quiet
          </p>
        </div>
      </div>

      <p className="mt-4 rounded-[12px] p-4 text-sm leading-relaxed"
         style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line)", color: "var(--ux-ink-2)" }}>
        {p.quiet_hours ? (
          <>
            Between <b style={{ color: "var(--ux-ink)" }}>{fmt(p.quiet_start)}</b> and{" "}
            <b style={{ color: "var(--ux-ink)" }}>{fmt(p.quiet_end)}</b> your phone stays silent.{" "}
            {caught === 0
              ? "Nothing you already have falls inside it."
              : <><b style={{ color: "var(--ux-ink)" }}>{caught}</b> {caught === 1 ? "reminder" : "reminders"} you
                  already have would wait until morning.</>}{" "}
            Your safety alert always comes through.
          </>
        ) : "Quiet hours are off. Everything reaches you the moment it arrives, at any hour."}
      </p>
    </section>
  );
}

function Handle({
  x, y, tone, label, value, onDown, onKey, children,
}: {
  x: number; y: number; tone: string; label: string; value: number;
  onDown: () => void; onKey: (by: number) => void; children: React.ReactNode;
}) {
  return (
    <g transform={`translate(${x} ${y})`} role="slider" tabIndex={0}
       aria-label={label} aria-valuemin={0} aria-valuemax={1435}
       aria-valuenow={value} aria-valuetext={fmt(value)}
       className="cursor-grab focus-visible:outline-none"
       onPointerDown={(e) => { e.preventDefault(); onDown(); }}
       onKeyDown={(e) => {
         const step = e.shiftKey ? 60 : SNAP;
         if (e.key === "ArrowRight" || e.key === "ArrowUp") { onKey(step); e.preventDefault(); }
         if (e.key === "ArrowLeft" || e.key === "ArrowDown") { onKey(-step); e.preventDefault(); }
       }}>
      {/* a bigger invisible target than the drawn one — this is dragged on a phone */}
      <circle r={24} fill="transparent" />
      <circle r={17} fill="var(--ux-surface)" stroke={tone} strokeWidth={4} />
      {children}
    </g>
  );
}

/* ── what actually waited ───────────────────────────────────────────────── */

/**
 * Not an illustration — these are her own notifications, filtered to the ones
 * whose arrival time falls inside the window she is looking at. Change the
 * dial and this list changes, which is the whole point: she can see the cost
 * of the window before she saves it.
 */
function Waited({
  marks, inside, on, from, to, allowMoney,
}: {
  marks: { m: number; title: string; kind: string }[];
  inside: (m: number) => boolean; on: boolean;
  from: string; to: string; allowMoney: boolean;
}) {
  const tr = useT();
  const held = marks.filter((x) => inside(x.m));
  const tone: Record<string, string> = {
    safety: "--ux-pink", booking: "--ux-amber", event: "--ux-amber",
    money: "--ux-green", message: "--ux-blue", mentorship: "--ux-violet",
  };
  const clock = (m: number) => {
    const h = Math.floor(m / 60) % 24, mm = m % 60;
    return `${h % 12 === 0 ? 12 : h % 12}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  };

  return (
    <section className="ux-sq rounded-[20px] p-5"
             style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)",
                      boxShadow: "var(--ux-shadow-card)" }}>
      <h3 className="text-sm font-bold" style={{ color: "var(--ux-ink)" }}>{tr("settingsQuiethours.whatThisWindowWouldHold")}</h3>
      <p className="mt-1 text-xsm leading-relaxed" style={{ color: "var(--ux-muted)" }}>
        {on ? <>Your recent notifications that arrived between {from} and {to}.</>
            : <>{tr("settingsQuiethours.quietHoursAreOffSoNothing")}</>}
      </p>

      {!on ? null : held.length === 0 ? (
        <p className="mt-3 text-xsm" style={{ color: "var(--ux-muted)" }}>{tr("settingsQuiethours.nothingRecentFallsInsideThisWindow")}</p>
      ) : (
        <div className="mt-3">
          {held.slice(0, 5).map((x, i) => (
            <div key={i} className="flex items-center gap-2.5 py-2 text-xsm"
                 style={{ borderTop: i === 0 ? "none" : "1px solid var(--ux-line)" }}>
              <span className="h-[8px] w-[8px] shrink-0 rounded-full"
                    style={{ background: `var(${tone[x.kind] ?? "--ux-violet"})` }} />
              <span className="min-w-0 flex-1 truncate" style={{ color: "var(--ux-ink-2)" }}>{x.title}</span>
              <span className="shrink-0 tabular-nums text-xs" style={{ color: "var(--ux-faint)" }}>
                {clock(x.m)}
              </span>
            </div>
          ))}
          {held.length > 5 && (
            <p className="mt-2 text-xs" style={{ color: "var(--ux-faint)" }}>
              and {held.length - 5} more
            </p>
          )}
          <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>
            {allowMoney
              ? tr("settingsQuiethours.moneyArrivingWouldStillComeThrough")
              : tr("settingsQuiethours.moneyArrivingWouldBeHeldToo")}
          </p>
        </div>
      )}
    </section>
  );
}

/* ── nights ─────────────────────────────────────────────────────────────── */

function Nights({ days, onChange }: { days: boolean[]; onChange: (d: boolean[]) => void }) {
  const tr = useT();
  const preset = (which: "all" | "week" | "end") =>
    onChange(DAYS.map((_, i) => (which === "all" ? true : which === "week" ? i < 5 : i >= 5)));

  return (
    <section className="ux-sq rounded-[20px] p-5"
             style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)",
                      boxShadow: "var(--ux-shadow-card)" }}>
      <h3 className="text-sm font-bold" style={{ color: "var(--ux-ink)" }}>{tr("settingsQuiethours.whichNights")}</h3>
      <p className="mt-1 text-xsm leading-relaxed" style={{ color: "var(--ux-muted)" }}>{tr("settingsQuiethours.sundayIsOftenTheOneNight")}</p>
      <div className="mt-3 flex gap-1.5">
        {([["all", "Every day"], ["week", "Weeknights"], ["end", "Weekends"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => preset(k)}
                  className="ux-press min-h-[36px] rounded-full px-3 text-xs font-bold"
                  style={{ border: "1px solid var(--ux-line)", color: "var(--ux-muted)" }}>{l}</button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {DAYS.map((d, i) => (
          <button key={d} type="button" role="switch" aria-checked={days[i]}
                  onClick={() => onChange(days.map((v, j) => (j === i ? !v : v)))}
                  className="ux-press min-h-[42px] min-w-[46px] rounded-[12px] px-3 text-xsm font-bold"
                  style={days[i]
                    ? { background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))",
                        border: "1px solid transparent", color: "var(--ux-on-brand)" }
                    : { border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink-2)" }}>
            {d}
          </button>
        ))}
      </div>
    </section>
  );
}

/* ── what still reaches her ─────────────────────────────────────────────── */

function Breakthrough({
  p, set,
}: { p: NotificationPrefs; set: (patch: Partial<NotificationPrefs>) => void }) {
  const tr = useT();
  return (
    <section className="ux-sq rounded-[20px] p-5"
             style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)",
                      boxShadow: "var(--ux-shadow-card)" }}>
      <h3 className="text-sm font-bold" style={{ color: "var(--ux-ink)" }}>{tr("settingsQuiethours.whatStillReachesYou")}</h3>
      <p className="mt-1 text-xsm leading-relaxed" style={{ color: "var(--ux-muted)" }}>{tr("settingsQuiethours.quietDoesNotMeanUnreachableThese")}</p>

      {/* Not a toggle. A safety alert she could switch off at night is not a
          safety alert, so it is stated rather than offered. */}
      <Row icon="ShieldCheck" tint="--ux-tint-green" ink="--ux-green-ink"
           title={tr("settingsQuiethours.yourSafetyAlert")}
           body="If you press the safety button, or someone responds to one, it rings through — silent or not.">
        <span className="flex items-center gap-1.5 text-[12px] lg:text-2xs font-extrabold uppercase tracking-[0.06em]"
              style={{ color: "var(--ux-green-ink)" }}>
          <Icons.Lock className="h-[11px] w-[11px]" />{tr("settingsQuiethours.alwaysOn")}</span>
      </Row>

      <Row icon="Wallet" tint="--ux-tint-green" ink="--ux-green-ink"
           title={tr("settingsQuiethours.moneyArriving")}
           body="A payment landing in your wallet. Your own income is not an interruption.">
        <Switch on={p.quiet_allow_money} label={tr("settingsQuiethours.moneyArriving2")}
                onChange={(v) => set({ quiet_allow_money: v })} small />
      </Row>

      <Row icon="UsersRound" tint="--ux-tint-violet" ink="--ux-violet-ink"
           title={tr("settingsQuiethours.yourCircleLeader")}
           body="Only the woman who runs your savings circle, and only about a payment due.">
        <Switch on={p.quiet_allow_circle_lead} label={tr("settingsQuiethours.circleLeader")}
                onChange={(v) => set({ quiet_allow_circle_lead: v })} small />
      </Row>
    </section>
  );
}

function Row({
  icon, tint, ink, title, body, children,
}: {
  icon: string; tint: string; ink: string; title: string; body: string; children: React.ReactNode;
}) {
  const I = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[icon] ?? Icons.Bell;
  return (
    <div className="flex items-start gap-3 py-3.5"
         style={{ borderTop: "1px solid var(--ux-line)" }}>
      <span className="mt-0.5 grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[12px]"
            style={{ background: `var(${tint})`, color: `var(${ink})` }}>
        <I className="h-[17px] w-[17px]" />
      </span>
      <div className="min-w-0 flex-1">
        <h4 className="text-xsm font-bold" style={{ color: "var(--ux-ink)" }}>{title}</h4>
        <p className="mt-0.5 text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>{body}</p>
      </div>
      <div className="mt-1 shrink-0">{children}</div>
    </div>
  );
}

function Switch({
  on, label, onChange, small,
}: { on: boolean; label: string; onChange: (v: boolean) => void; small?: boolean }) {
  const w = small ? 44 : 52, h = small ? 26 : 30, k = small ? 20 : 24;
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label}
            onClick={() => onChange(!on)}
            className="ux-press flex shrink-0 items-center rounded-full p-[3px] transition-colors"
            style={{ width: w, height: h,
                     background: on ? "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))" : "var(--ux-track)" }}>
      <i className="block rounded-full transition-transform"
         style={{ width: k, height: k, background: "var(--ux-surface)",
                  transform: on ? `translateX(${w - k - 6}px)` : "none" }} />
    </button>
  );
}
