"use client";

import Image from "next/image";
import { useT } from "@/i18n";
import * as Icons from "@/components/ux/icons";
import { Card, I, IconTile, v } from "@/components/ux/kit";
import { ChipRow } from "@/components/ux/learning/native";
import {
  goalProgressLine, goalState,
  type Goal, type GoalState,
} from "@/components/ux/discovery/data";
import styles from "./goals.module.css";

/* ------------------------------------------------------------------ */
/*  The banner                                                         */
/* ------------------------------------------------------------------ */

export function GoalsHero({ chips, active, onPick }: {
  chips: { label: string; n: number }[]; active: string;
  onPick: (label: string) => void;
}) {
  const tr = useT();
  const chipButtons = (cls: string) => chips.map((c) => {
    const on = active === c.label;
    return (
      <button key={c.label} type="button" onClick={() => onPick(c.label)} aria-pressed={on}
              className={cls}
              style={{ background: v(on ? "--ux-fill" : "--ux-surface"),
                       color: v(on ? "--ux-on-brand" : "--ux-ink-2"),
                       border: `1px solid ${v(on ? "--ux-fill" : "--ux-line")}` }}>
        {c.label} ({c.n})
      </button>
    );
  });
  const areas = [
    ["Financial Freedom", "PiggyBank", "Money"], ["Career Growth", "Briefcase", "All goals"],
    ["Learning & Skills", "BookOpen", "Learning"], ["Health & Wellness", "HeartPulse", "Counted by you"],
    ["Personal Growth", "Sprout", "All goals"], ["Family & Relationships", "Users", "All goals"],
    ["Community & Giving", "HeartHandshake", "All goals"], ["Travel & Experiences", "Compass", "All goals"],
    ["Creativity & Hobbies", "Palette", "All goals"], ["Lifestyle & Wellbeing", "Flower2", "All goals"],
  ] as const;
  return <>
    <section className={styles.hero} aria-labelledby="goals-title">
      <Image src="/ux/goals/goals-hero-v2.webp" alt={tr("goalviews.womenFromDifferentBackgroundsPlanningGoals")} fill priority sizes="(max-width:760px) 100vw, 70vw" />
      <div className={styles.heroShade} />
      <div className={styles.heroCopy}>
        <p>{tr("goalviews.homeMyGoals")}</p>
        <h1 id="goals-title">My <em>Goals</em></h1>
        <span>{tr("goalviews.dreamPlanDoABrighterYou")}</span>
      </div>
    </section>
    <div className={styles.areas} aria-label={tr("goalviews.goalAreas")}>{areas.map(([label,icon,filter],index)=><button type="button" key={label} onClick={()=>onPick(filter)} aria-pressed={active===filter && (index===0 || filter!=="All goals")}><span><I name={icon}/></span><b>{label}</b></button>)}</div>
    <ChipRow className={styles.mobileCategories}>{chipButtons(styles.category)}</ChipRow>
  </>;
}

/* ------------------------------------------------------------------ */
/*  The four numbers                                                   */
/* ------------------------------------------------------------------ */

/*
  Three states, and "Needs attention" is gone.

  It was computed from `targetOn`, a calendar date the fixture invented and the
  server does not hold — so the app was telling a woman she was behind on a
  deadline she had never set. The only deadline this product stores is her own
  words in `by` ("before Diwali", "by September"), which is not a date and
  cannot be late. What is left is three facts: she reached it, it has moved, or
  it has not moved yet. None of them is a judgement about her.
*/
export const STATUS_LOOK: Record<GoalState, { label: string; tint: string; ink: string; dot: string; icon: string }> = {
  reached:       { label: "Reached",       tint: "--ux-tint-violet", ink: "--ux-violet-ink", dot: "--ux-violet",      icon: "BadgeCheck" },
  moving:        { label: "Moving",        tint: "--ux-tint-green",  ink: "--ux-green-ink",  dot: "--ux-green",       icon: "CircleCheck" },
  "not-started": { label: "Not started",   tint: "--ux-surface-2",   ink: "--ux-muted",      dot: "--ux-line-strong", icon: "Circle" },
};

export function GoalStats({ total, by, active, onPick }: { total: number; by: Record<GoalState, number>; active: "all" | GoalState; onPick:(value:"all"|GoalState)=>void }) {
  const tr = useT();
  const cells = [{id:"all" as const,n:total,label:tr("goalviews.myGoals")},{id:"reached" as const,n:by.reached,label:"Completed"},{id:"moving" as const,n:by.moving,label:tr("programs.inProgress")},{id:"not-started" as const,n:by["not-started"],label:tr("library.notStarted")}];
  return (
    <nav className={styles.statusTabs} aria-label={tr("goalviews.goalStatus")}>{cells.map(c=><button type="button" key={c.id} aria-pressed={active===c.id} onClick={()=>onPick(c.id)}>{c.label} <b>({c.n})</b></button>)}</nav>
  );
}

/** The line that sits beside the numbers. */
export function StaircaseNote() {
  return (
    <Card className="mb-6 lg:mb-5" pad={16}>
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

export function GoalCard({ g, money, menu, onMenu, onDone, onEdit, onArchive, busy }: {
  g: Goal; money: (minor: number) => string;
  menu: boolean; onMenu: (open: boolean) => void;
  /*
    Only the two actions the server can carry out.

    "Edit", "Add note" and "View details" went with the fixture. There is no
    endpoint for a note, no endpoint for renaming a goal, and no detail screen
    — they were four buttons on every card, and a woman who pressed any of them
    was told the feature was "on the way". A control that cannot act is worse
    than no control: she presses it once, learns the screen is decoration, and
    stops pressing the ones that work.

    `onDone` is absent for a goal the server scores itself. A money goal counts
    her wallet credits and a learning goal counts sessions attended; letting her
    tick either by hand would make the figure say whatever she pressed.
  */
  onDone?: (g: Goal) => void;
  onEdit: (g: Goal) => void;
  onArchive: (g: Goal) => void;
  busy?: boolean;
}) {
  const tr = useT();
  // `pct` comes off the wire. The server scores a goal — a money goal counts
  // her wallet credits, a learning goal the sessions she attended — and a
  // percentage recomputed here that disagrees with the screen that produced it
  // is how a woman stops believing both.
  const pct = g.pct;
  const st = goalState(g);
  const look = STATUS_LOOK[st];
  const line = goalProgressLine(g, money);
  const done = st === "reached";

  return (
    <Card className={`${styles.goalCard} mb-3 lg:mb-3.5`} pad={18}>
      <div className="flex flex-wrap items-start gap-4 sm:flex-nowrap">
        {/*
          There was a photograph here — `g.art`, a stock picture of a sewing
          machine or a school gate, picked by us for a goal she wrote. It is
          her icon instead, which is the one she chose.
        */}
        <IconTile icon={g.icon || "Target"} tint="--ux-brand-tint-2" ink="--ux-brand" size={56} radius={14} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <b className="text-smd font-extrabold leading-snug" style={{ color: v("--ux-ink") }}>{g.label}</b>
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-3xs font-extrabold"
                    style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
                <Icons.Tag className="h-[10px] w-[10px]" />
                {g.kind}
              </span>
            </div>

            <span className="flex shrink-0 items-center gap-2.5">
              <span className="flex items-center gap-1.5 text-2xs font-semibold" style={{ color: v("--ux-muted") }}>
                <Icons.CalendarDays className="h-[13px] w-[13px]" />
                {/* Her own words, never a date we invented for her. */}
                {g.by || "No date set"}
              </span>
              <span className="relative">
                <button type="button" aria-label={`More about ${g.label}`} aria-expanded={menu}
                        onClick={() => onMenu(!menu)}
                        className={`${styles.iconAction} ux-press ux-sq grid h-[30px] w-[30px] place-items-center rounded-[8px]`}
                        style={{ color: v("--ux-faint") }}>
                  <Icons.MoreHorizontal className="h-[16px] w-[16px]" />
                </button>
                {menu && (
                  <span className="absolute end-0 top-[calc(100%+6px)] z-[var(--ux-z-dropdown)] block w-[210px] overflow-hidden rounded-[12px]"
                        style={{ background: v("--ux-surface"), border: "1px solid var(--ux-line)",
                                 boxShadow: "var(--ux-shadow-pop)" }}>
                    <Row icon="Pencil" onClick={() => { onEdit(g); onMenu(false); }}>Edit goal</Row>
                    <Row icon="Trash2" onClick={() => { onArchive(g); onMenu(false); }}>{tr("goalviews.removeThisGoal")}</Row>
                  </span>
                )}
              </span>
            </span>
          </div>

          {/*
            `g.why` — the sentence about why the goal matters to her — has no
            field on the server. The five it used to print were written in the
            first person ("So I stop paying rent on someone else's") and shown
            to every woman as though she had typed it.
          */}
          <p className="mt-3 text-xsm">
            <b className="font-extrabold" style={{ color: v("--ux-ink") }}>{line.have}</b>{" "}
            <span style={{ color: v("--ux-muted") }}>{line.of}</span>
            <span className="ms-2.5 inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-3xs font-extrabold"
                  style={{ background: v(look.tint), color: v(look.ink) }}>
              {look.label}
            </span>
          </p>
          {g.note && <p className="mt-2 text-xs leading-relaxed" style={{ color: v("--ux-ink-2") }}>{g.note}</p>}

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
            {onDone && (
              <Act icon={done ? "BadgeCheck" : "CircleCheck"} on={done}
                   onClick={() => !busy && onDone(g)}>
                {done ? "Reached" : "Mark as reached"}
              </Act>
            )}
            <Act icon="Trash2" onClick={() => !busy && onArchive(g)}>Remove</Act>
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
            className={`${styles.goalAction} ux-press ux-sq flex min-h-[44px] items-center gap-1.5 rounded-[10px] px-2.5 text-[13px] font-semibold lg:min-h-[36px] lg:text-xs`}
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
  pct: number; onTrack: number; total: number; by: Record<GoalState, number>;
}) {
  const tr = useT();
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-extrabold" style={{ color: v("--ux-ink") }}>
          <I name="BarChart3" className="h-[16px] w-[16px]" style={{ color: v("--ux-brand") }} />
          {tr("goalviews.goalInsights")}
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
            {onTrack} of {total} {total === 1 ? "goal has" : "goals have"} moved.
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-2.5">
        {(Object.keys(STATUS_LOOK) as GoalState[]).map((k) => (
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
  const tr = useT();
  return (
    <Card>
      <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold" style={{ color: v("--ux-ink") }}>
        <I name="Zap" className="h-[16px] w-[16px]" style={{ color: v("--ux-brand") }} />
        {tr("goalviews.quickActions")}
      </h2>
      <div className="grid grid-cols-2 gap-2">
        {rows.map((a) => (
          <button key={a.id} type="button" onClick={a.onClick}
                  className={`${styles.quickAction} ux-press ux-sq flex items-center gap-2 rounded-[12px] px-2.5 py-3 text-start`}
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
