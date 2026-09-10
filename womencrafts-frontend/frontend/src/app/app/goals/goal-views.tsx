"use client";

import * as Icons from "@/components/ux/icons";
import { Btn, Card, I, IconTile, v } from "@/components/ux/kit";
import {
  goalPct, goalProgressLine, goalStatus,
  type Goal, type GoalStatus,
} from "@/components/ux/discovery/data";

/* ------------------------------------------------------------------ */
/*  The banner                                                         */
/* ------------------------------------------------------------------ */

export function GoalsHero({ chips, active, onPick }: {
  chips: { label: string; n: number }[]; active: string;
  onPick: (label: string) => void;
}) {
  return (
    <section className="relative mb-4 overflow-hidden rounded-[20px]"
             style={{ background: "linear-gradient(104deg, var(--ux-brand-tint) 0%, var(--ux-tint-lilac) 44%, var(--ux-tint-pink) 74%, var(--ux-tint-amber) 100%)",
                      border: "1px solid var(--ux-line)" }}>
      <div className="flex items-stretch">
        <div className="min-w-0 flex-1 px-6 pt-6 sm:px-7 sm:pt-7">
          <p className="text-2xs font-extrabold uppercase tracking-[0.16em]" style={{ color: v("--ux-muted") }}>
            My goals
          </p>
          <h1 className="mt-2.5 text-4xl font-extrabold leading-[1.06] tracking-[-0.035em] wide:text-4xlm"
              style={{ color: v("--ux-ink") }}>
            Big dreams. Real progress.
          </h1>
          <p className="mt-3 max-w-[440px] text-smd leading-relaxed" style={{ color: v("--ux-ink-2") }}>
            Set your goals, take small steps, and build the life you deserve.
          </p>
        </div>

        <div className="relative hidden w-[200px] shrink-0 items-end xl:flex wide:w-[400px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ux/art/scene-woman-planning-board.webp" alt="" aria-hidden loading="lazy" decoding="async"
               className="max-h-[240px] w-[200px] self-end object-contain object-bottom"
               style={{ maskImage: "linear-gradient(100deg, transparent, #000 30%)",
                        WebkitMaskImage: "linear-gradient(100deg, transparent, #000 30%)" }} />

          <div className="hidden w-[186px] flex-col items-end gap-4 self-center pe-6 wide:flex">
            <p className="text-end text-smd font-bold italic leading-tight"
               style={{ color: v("--ux-pink-ink"), fontFamily: "var(--font-display)" }}>
              A brighter you<br />is possible <Icons.Heart className="inline h-[13px] w-[13px]" />
            </p>
            <figure className="rounded-[14px] p-3.5 text-end"
                    style={{ background: v("--ux-surface"), boxShadow: "var(--ux-shadow-card)" }}>
              <blockquote className="text-xs font-bold italic leading-snug"
                          style={{ color: v("--ux-brand"), fontFamily: "var(--font-display)" }}>
                &ldquo;Goals give your dreams a deadline.&rdquo;
              </blockquote>
              <figcaption className="mt-1.5 text-2xs" style={{ color: v("--ux-muted") }}>— WomSakhi</figcaption>
            </figure>
          </div>
        </div>
      </div>

      {/* Full width, below both columns. Inside the text column the last two
          chips ran under the artwork and could not be pressed or read. */}
      <div className="ux-noscroll relative flex gap-2 overflow-x-auto px-6 pb-6 pt-5 sm:px-7">
        {chips.map((c) => {
          const on = active === c.label;
          return (
            <button key={c.label} type="button" onClick={() => onPick(c.label)} aria-pressed={on}
                    className="ux-press ux-sq shrink-0 rounded-full px-4 py-2.5 text-xs font-bold"
                    style={{ background: v(on ? "--ux-fill" : "--ux-surface"),
                             color: v(on ? "--ux-on-brand" : "--ux-ink-2"),
                             border: `1px solid ${v(on ? "--ux-fill" : "--ux-line")}` }}>
              {c.label} ({c.n})
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  The four numbers                                                   */
/* ------------------------------------------------------------------ */

export const STATUS_LOOK: Record<GoalStatus, { label: string; tint: string; ink: string; dot: string; icon: string }> = {
  "on-track":        { label: "On track",        tint: "--ux-tint-green",   ink: "--ux-green-ink",  dot: "--ux-green",  icon: "CircleCheck" },
  "needs-attention": { label: "Needs attention", tint: "--ux-tint-orange",  ink: "--ux-orange-ink", dot: "--ux-orange", icon: "Bell" },
  completed:         { label: "Completed",       tint: "--ux-tint-violet",  ink: "--ux-violet-ink", dot: "--ux-violet", icon: "BadgeCheck" },
  "not-started":     { label: "Not started",     tint: "--ux-surface-2",    ink: "--ux-muted",      dot: "--ux-line-strong", icon: "Circle" },
};

export function GoalStats({ total, by }: { total: number; by: Record<GoalStatus, number> }) {
  const cells = [
    { n: total, label: "Total goals", icon: "Target", tint: "--ux-brand-tint-2", ink: "--ux-brand" },
    { n: by["on-track"], ...STATUS_LOOK["on-track"] },
    { n: by["needs-attention"], ...STATUS_LOOK["needs-attention"] },
    { n: by.completed, ...STATUS_LOOK.completed },
  ];
  return (
    <div className="mb-4 grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
      {cells.map((c) => (
        <Card key={c.label} pad={16}>
          <div className="flex items-center gap-3">
            <IconTile icon={c.icon} tint={c.tint} ink={c.ink} size={38} radius={12} />
            <span>
              <b className="block text-xl font-extrabold leading-none" style={{ color: v("--ux-ink") }}>{c.n}</b>
              <span className="mt-1 block text-2xs font-semibold" style={{ color: v("--ux-muted") }}>{c.label}</span>
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}

/** The line that sits beside the numbers. */
export function StaircaseNote() {
  return (
    <Card className="mb-5" pad={16}>
      <div className="flex items-center gap-3.5">
        <IconTile icon="Sprout" tint="--ux-tint-green" ink="--ux-green-ink" size={40} radius={12} />
        <p className="min-w-0 text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
          <b style={{ color: v("--ux-ink") }}>
            &ldquo;You don&rsquo;t have to see the whole staircase, just take the next step.&rdquo;
          </b>{" "}
          <span style={{ color: v("--ux-muted") }}>— WomSakhi</span>
        </p>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  One goal                                                           */
/* ------------------------------------------------------------------ */

export function GoalCard({ g, money, menu, onMenu, onDone, onNote, onArchive, onEdit }: {
  g: Goal; money: (minor: number) => string;
  menu: boolean; onMenu: (open: boolean) => void;
  onDone: (g: Goal) => void; onNote: (g: Goal) => void;
  onArchive: (g: Goal) => void; onEdit: (g: Goal) => void;
}) {
  const pct = goalPct(g);
  const st = goalStatus(g);
  const look = STATUS_LOOK[st];
  const line = goalProgressLine(g, money);
  const done = st === "completed";

  return (
    <Card className="mb-3.5" pad={18}>
      <div className="flex flex-wrap items-start gap-4 sm:flex-nowrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={g.art} alt="" aria-hidden loading="lazy" decoding="async"
             className="h-[86px] w-[110px] shrink-0 rounded-[12px] object-cover"
             style={{ background: v(g.tint) }} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <b className="text-smd font-extrabold leading-snug" style={{ color: v("--ux-ink") }}>{g.title}</b>
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-3xs font-extrabold"
                    style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
                <Icons.Tag className="h-[10px] w-[10px]" />
                {g.kind}
              </span>
            </div>

            <span className="flex shrink-0 items-center gap-2.5">
              <span className="flex items-center gap-1.5 text-2xs font-semibold" style={{ color: v("--ux-muted") }}>
                <Icons.CalendarDays className="h-[13px] w-[13px]" />
                Target: {g.targetOn}
              </span>
              <span className="relative">
                <button type="button" aria-label={`More about ${g.title}`} aria-expanded={menu}
                        onClick={() => onMenu(!menu)}
                        className="ux-press ux-sq grid h-[30px] w-[30px] place-items-center rounded-[8px]"
                        style={{ color: v("--ux-faint") }}>
                  <Icons.MoreHorizontal className="h-[16px] w-[16px]" />
                </button>
                {menu && (
                  <span className="absolute end-0 top-[calc(100%+6px)] z-[var(--ux-z-dropdown)] block w-[210px] overflow-hidden rounded-[12px]"
                        style={{ background: v("--ux-surface"), border: "1px solid var(--ux-line)",
                                 boxShadow: "var(--ux-shadow-pop)" }}>
                    <Row icon="Pencil" onClick={() => { onEdit(g); onMenu(false); }}>Edit this goal</Row>
                    <Row icon="FileText" onClick={() => { onNote(g); onMenu(false); }}>Add a note</Row>
                    <Row icon="Archive" onClick={() => { onArchive(g); onMenu(false); }}>Move to archive</Row>
                  </span>
                )}
              </span>
            </span>
          </div>

          <p className="mt-1.5 text-xsm leading-relaxed" style={{ color: v("--ux-muted") }}>{g.why}</p>

          <p className="mt-3 text-xsm">
            <b className="font-extrabold" style={{ color: v("--ux-ink") }}>{line.have}</b>{" "}
            <span style={{ color: v("--ux-muted") }}>{line.of}</span>
            <span className="ms-2.5 inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-3xs font-extrabold"
                  style={{ background: v(look.tint), color: v(look.ink) }}>
              {look.label}
            </span>
          </p>

          <div className="mt-2 flex items-center gap-3">
            <span className="h-[8px] min-w-0 flex-1 overflow-hidden rounded-full"
                  style={{ background: v("--ux-brand-tint-2") }}>
              <span className="block h-full rounded-full"
                    style={{ width: `${pct}%`,
                             background: "linear-gradient(96deg, var(--ux-fill), var(--ux-fill-2))" }} />
            </span>
            <b className="shrink-0 text-xsm font-extrabold tabular-nums" style={{ color: v("--ux-brand") }}>
              {pct}%
            </b>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-1">
            <Btn size="sm" href={g.nextHref} iconEnd="ArrowRight">View details</Btn>
            <Act icon="Pencil" onClick={() => onEdit(g)}>Edit</Act>
            <Act icon={done ? "BadgeCheck" : "CircleCheck"} on={done} onClick={() => onDone(g)}>
              {done ? "Done" : "Mark as done"}
            </Act>
            <Act icon="FileText" onClick={() => onNote(g)}>Add note</Act>
            <Act icon="Archive" onClick={() => onArchive(g)}>Move to archive</Act>
          </div>
        </div>
      </div>
    </Card>
  );
}

function Row({ icon, children, onClick }: { icon: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
            className="ux-hov ux-sq flex w-full items-center gap-2.5 px-4 py-3 text-start text-xsm font-semibold"
            style={{ color: v("--ux-ink-2") }}>
      <I name={icon} className="h-[15px] w-[15px]" />
      {children}
    </button>
  );
}

function Act({ icon, children, onClick, on }: {
  icon: string; children: React.ReactNode; onClick: () => void; on?: boolean;
}) {
  return (
    <button type="button" onClick={onClick}
            className="ux-press ux-sq flex min-h-[36px] items-center gap-1.5 rounded-[10px] px-2.5 text-xs font-semibold"
            style={{ color: v(on ? "--ux-green-ink" : "--ux-muted") }}>
      <I name={icon} className="h-[15px] w-[15px]" sw={on ? 2.5 : 1.9} />
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Rail: how it is going, in one ring                                 */
/* ------------------------------------------------------------------ */

export function GoalInsights({ pct, onTrack, total, by }: {
  pct: number; onTrack: number; total: number; by: Record<GoalStatus, number>;
}) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-extrabold" style={{ color: v("--ux-ink") }}>
          <I name="BarChart3" className="h-[16px] w-[16px]" style={{ color: v("--ux-brand") }} />
          Goal insights
        </h2>
      </div>

      <div className="flex items-center gap-4">
        <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden className="shrink-0">
          <circle cx="42" cy="42" r={r} fill="none" strokeWidth="8" stroke={v("--ux-surface-2")} />
          <circle cx="42" cy="42" r={r} fill="none" strokeWidth="8" strokeLinecap="round"
                  stroke={v("--ux-green")} transform="rotate(-90 42 42)"
                  strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
          <text x="42" y="47" textAnchor="middle" fontSize="18" fontWeight="800" fill={v("--ux-ink")}>
            {pct}%
          </text>
        </svg>
        <div className="min-w-0">
          <p className="text-xsm font-bold leading-snug" style={{ color: v("--ux-ink") }}>
            {pct >= 60 ? "You're making great progress!" : pct > 0 ? "It has started moving." : "Nothing has moved yet."}
          </p>
          <p className="mt-1 text-xs" style={{ color: v("--ux-muted") }}>
            {onTrack} of {total} {total === 1 ? "goal is" : "goals are"} on track.
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-2.5">
        {(Object.keys(STATUS_LOOK) as GoalStatus[]).map((k) => (
          <li key={k} className="flex items-center gap-2.5">
            <span aria-hidden className="h-[10px] w-[10px] shrink-0 rounded-full"
                  style={{ background: v(STATUS_LOOK[k].dot) }} />
            <span className="min-w-0 flex-1 truncate text-xs font-semibold" style={{ color: v("--ux-ink-2") }}>
              {STATUS_LOOK[k].label}
            </span>
            <b className="shrink-0 text-xsm font-extrabold tabular-nums" style={{ color: v("--ux-ink") }}>
              {by[k]}
            </b>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Rail: the six things she does here                                 */
/* ------------------------------------------------------------------ */

export interface QuickAction { id: string; label: string; icon: string; onClick: () => void }

export function QuickActions({ rows }: { rows: QuickAction[] }) {
  return (
    <Card>
      <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold" style={{ color: v("--ux-ink") }}>
        <I name="Zap" className="h-[16px] w-[16px]" style={{ color: v("--ux-brand") }} />
        Quick actions
      </h2>
      <div className="grid grid-cols-2 gap-2">
        {rows.map((a) => (
          <button key={a.id} type="button" onClick={a.onClick}
                  className="ux-press ux-hov ux-sq flex items-center gap-2 rounded-[11px] px-2.5 py-3 text-start"
                  style={{ border: "1px solid var(--ux-line)" }}>
            <I name={a.icon} className="h-[15px] w-[15px] shrink-0" style={{ color: v("--ux-brand") }} />
            <span className="min-w-0 text-2xs font-bold leading-tight" style={{ color: v("--ux-ink-2") }}>
              {a.label}
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Rail: the line at the bottom                                       */
/* ------------------------------------------------------------------ */

export function DisciplineCard() {
  return (
    <section className="relative overflow-hidden rounded-[16px] p-[22px]"
             style={{ background: "linear-gradient(150deg, var(--ux-brand-700), var(--ux-brand-900))" }}>
      <p className="relative w-[86%] text-lg font-bold italic leading-snug"
         style={{ color: v("--ux-on-brand"), fontFamily: "var(--font-display)" }}>
        Discipline today creates the future you&rsquo;ll love tomorrow.
      </p>
      <Icons.Heart aria-hidden className="relative mt-3 h-[15px] w-[15px]" style={{ color: v("--ux-pink") }} />
      <Icons.Leaf aria-hidden className="pointer-events-none absolute -bottom-5 -end-4 h-[120px] w-[120px]"
                  style={{ color: v("--ux-on-brand"), opacity: 0.16 }} />
    </section>
  );
}
