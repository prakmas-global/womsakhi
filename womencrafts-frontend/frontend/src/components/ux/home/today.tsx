"use client";

import Link from "next/link";
import * as Icons from "lucide-react";

import { Btn, Card, IconTile, SectionHead } from "../kit";
import { useCountUp, usePointer } from "../kit/motion";
import { NEXT_STEP, TODAYS_WORK, money } from "./data";
import { useSummary } from "@/components/ux/live";

/**
 * Today.
 *
 * The band that replaces "here are your eight modules" with an answer. Three
 * panels, in the order she cares about them: what came in, what she can do
 * next, and what work is open right now. Everything below this band is
 * browsing; this band is the app doing the deciding for her.
 *
 * The panels are deliberately NOT the same size. A grid of equal cards says
 * everything matters equally, which is the same as saying nothing does.
 */
export function Today() {
  return (
    <section className="mt-[17px] grid gap-[15px]" style={{ gridTemplateColumns: "1.25fr 1fr 1fr" }}>
      <MoneyPanel />
      <NextStepPanel />
      <WorkPanel />
    </section>
  );
}

/* ── money ─────────────────────────────────────────────────────────────── */

/**
 * Earnings against her own goal.
 *
 * "₹24,350" on its own is a number she cannot judge. Against a goal she set it
 * becomes a position, and the ring makes the position readable without doing
 * the division.
 */
function MoneyPanel() {
  /**
   * Her money, counted from the ledger.
   *
   * This panel read a constant. It told every woman she had earned **₹24,350**
   * this month against a ₹30,000 goal, that **₹4,200 was pending from
   * BrandStory, due Friday**, and that she was **ahead of 68% of women in her
   * circle**. The woman it was showing had earned ₹3,000, is owed nothing by
   * anybody, and is not ranked against anyone — no such comparison exists.
   *
   * Two of those had to be deleted rather than wired: who owes her and when,
   * and how she compares to other women. Nothing in this system knows either.
   */
  const { data: summary } = useSummary();
  const m = summary?.money;
  const earned = Math.round((m?.earned_this_month_minor ?? 0) / 100);
  const goal = Math.round((m?.goal_minor ?? 0) / 100);
  const last = Math.round((m?.last_month_minor ?? 0) / 100);

  const total = useCountUp(earned, 1000);
  const pct = goal ? Math.min(100, Math.round((earned / goal) * 100)) : 0;
  const grew = earned > last;
  // Only computable against a month that had something in it. Dividing by a
  // zero last month produced Infinity, which rendered as "Infinity% more".
  const delta = last > 0 ? Math.round(((earned - last) / last) * 100) : null;

  const r = 34, c = 2 * Math.PI * r;

  return (
    <Card className="ux-onscroll flex flex-col">
      <SectionHead title="Money this month" action="Wallet" />

      <div className="flex items-center gap-4">
        <span className="relative grid shrink-0 place-items-center" style={{ width: 80, height: 80 }}>
          <svg width={80} height={80} className="-rotate-90" aria-hidden>
            <circle cx={40} cy={40} r={r} fill="none" stroke="var(--ux-track)" strokeWidth="7" />
            <circle
              cx={40} cy={40} r={r} fill="none" stroke="var(--ux-green)" strokeWidth="7"
              strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
              style={{ transition: "stroke-dashoffset 900ms var(--ux-ease-out)" }}
            />
          </svg>
          <span className="absolute text-center">
            <span className="block text-[15px] font-bold leading-none tabular-nums" style={{ color: "var(--ux-ink)" }}>
              {pct}%
            </span>
            <span className="mt-[2px] block text-[8.5px] uppercase tracking-[0.08em]" style={{ color: "var(--ux-faint)" }}>
              of goal
            </span>
          </span>
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[26px] font-bold leading-none tabular-nums" style={{ color: "var(--ux-ink)" }}>
            {money(total)}
          </p>
          <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--ux-muted)" }}>
            of your {money(goal)} goal
          </p>
          <p className="mt-2 flex items-center gap-1 text-[11.5px] font-medium"
             style={{ color: grew ? "var(--ux-green-ink)" : "var(--ux-orange-ink)" }}>
            <Icons.TrendingUp className="h-3.5 w-3.5" style={{ transform: grew ? "none" : "scaleY(-1)" }} />
            {grew ? "+" : ""}{delta}% on last month
          </p>
        </div>
      </div>

      {/* Money on its way, when there is some. The ledger knows the amount and
          nothing else — not who owes it, not when it lands — so this no longer
          names a client or a day. Stated when it exists, absent when it does
          not; "₹0 is on its way" invents a worry. */}
      {(m?.pending_minor ?? 0) > 0 && (
        <div className="ux-sq mt-auto flex items-center gap-2.5 rounded-[11px] p-2.5"
             style={{ background: "var(--ux-tint-green)" }}>
          <Icons.Clock className="h-[15px] w-[15px] shrink-0" style={{ color: "var(--ux-green-ink)" }} />
          <span className="min-w-0 flex-1 text-[11.5px]" style={{ color: "var(--ux-ink-2)" }}>
            <strong style={{ color: "var(--ux-ink)" }}>{money(Math.round((m?.pending_minor ?? 0) / 100))}</strong> on its way
          </span>
        </div>
      )}
    </Card>
  );
}

/* ── the one next step ─────────────────────────────────────────────────── */

function NextStepPanel() {
  const point = usePointer<HTMLDivElement>();
  return (
    <div
      ref={point}
      className="ux-sq ux-spot ux-onscroll ux-grain relative flex flex-col justify-between rounded-[16px] p-[18px]"
      style={{
        background: "linear-gradient(150deg, oklch(0.36 0.14 294), oklch(0.48 0.17 310))",
      }}
    >
      <div className="relative">
        <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em]"
           style={{ color: "rgba(255,255,255,0.66)" }}>
          <Icons.Target className="h-[13px] w-[13px]" /> Your next step
        </p>
        <h2 className="mt-2.5 text-[17px] font-bold leading-snug text-white">{NEXT_STEP.title}</h2>
        {/* The reason, not just the instruction. She can disagree with a reason. */}
        <p className="mt-2 text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.82)" }}>
          {NEXT_STEP.because}
        </p>
      </div>

      <div className="relative mt-4 flex items-center gap-2.5">
        <Btn href={NEXT_STEP.href} variant="soft" size="sm" icon={NEXT_STEP.icon}>
          {NEXT_STEP.cta}
        </Btn>
        <span className="text-[11.5px]" style={{ color: "rgba(255,255,255,0.72)" }}>
          {NEXT_STEP.mins} min
        </span>
      </div>
    </div>
  );
}

/* ── today's work ──────────────────────────────────────────────────────── */

/** One opening, not a list. A list is browsing; one is a decision. */
function WorkPanel() {
  const w = TODAYS_WORK;
  const point = usePointer<HTMLDivElement>();
  return (
    <Card className="ux-onscroll ux-edge flex flex-col" >
      <div ref={point} className="flex h-full flex-col">
        <SectionHead title="Open today" action="All work" />

        <div className="flex items-start gap-3">
          <IconTile icon="Briefcase" tint="--ux-tint-pink" ink="--ux-pink" size={40} radius={11} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[13.5px] font-semibold" style={{ color: "var(--ux-ink)" }}>{w.title}</h3>
            <p className="mt-0.5 truncate text-[11.5px]" style={{ color: "var(--ux-muted)" }}>
              {w.org} <span aria-hidden>•</span> {w.place}
            </p>
          </div>
          <span className="ux-sq shrink-0 rounded-[8px] px-2 py-[3px] text-[11px] font-bold tabular-nums"
                style={{ background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }}>
            {w.match}%
          </span>
        </div>

        <p className="mt-3 text-[15px] font-bold" style={{ color: "var(--ux-ink)" }}>{w.pay}</p>
        <p className="mt-1 text-[11.5px]" style={{ color: "var(--ux-muted)" }}>a month</p>

        {/* Urgency she can act on, rather than a countdown for its own sake. */}
        <p className="mt-3 flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--ux-orange-ink)" }}>
          <Icons.CalendarClock className="h-3.5 w-3.5" /> Closes in {w.closesIn}
        </p>

        <div className="mt-auto pt-3.5">
          <Btn href={`/app/opportunities/${w.id}`} variant="primary" size="sm" full iconEnd="ArrowRight">
            Apply now
          </Btn>
        </div>
      </div>
    </Card>
  );
}

/* ── momentum + Sakhi, one strip ───────────────────────────────────────── */

/**
 * What she has actually done, and a way in to Sakhi.
 *
 * **Both halves of this strip used to be invented.** The left was a "5-day
 * streak, your best is 12" from a constant — seven dots that were the same
 * seven dots for everyone, and a personal best nothing had ever measured.
 * The right said "Sakhi noticed something" above the sentence "Three new
 * tailoring orders opened near Jaipur this week — your stitching skill matches
 * all three", presented as an observation an AI had made about her. Sakhi had
 * not noticed anything; the sentence was a string in a file.
 *
 * The streak is gone rather than wired, because nothing records daily
 * activity — inventing a number and calling it hers is what this whole pass
 * has been undoing. What replaced it is counted: courses finished, sessions
 * coming up. It is a weaker nudge and a true one.
 *
 * Sakhi is now an invitation rather than a claim. She is genuinely good at
 * answering a question in her own words; she does not owe anyone an unprompted
 * observation, and one she cannot make should not be put in her mouth.
 */
export function MomentumStrip() {
  const { data: summary } = useSummary();
  const finished = summary?.completed_programs ?? 0;
  const soon = summary?.upcoming_bookings?.length ?? 0;
  return (
    <section className="mt-[15px] grid gap-[15px]" style={{ gridTemplateColumns: "1fr 2fr" }}>
      <Card className="ux-onscroll-soft">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[19px] font-bold leading-none" style={{ color: "var(--ux-ink)" }}>
              {finished > 0 ? `${finished} ${finished === 1 ? "course" : "courses"} finished` : "Your first course"}
            </p>
            <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--ux-muted)" }}>
              {finished > 0
                ? soon > 0
                  ? `${soon} ${soon === 1 ? "session" : "sessions"} coming up.`
                  : "Book a session and it shows up here."
                : "Finish one and it is counted here, with a certificate."}
            </p>
          </div>
          <Icons.Award className="h-[26px] w-[26px] shrink-0" style={{ color: "var(--ux-orange)" }} strokeWidth={1.7} />
        </div>
      </Card>

      <Link
        href="/app/sakhi"
        className="ux-i ux-sq ux-orbit ux-onscroll-soft relative flex items-center gap-4 rounded-[16px] border p-[18px]"
        style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ux/art/mascot-robot-waving.webp" alt=""
             className="ux-float h-[64px] w-[64px] shrink-0 object-contain" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: "var(--ux-brand)" }}>
            <Icons.Sparkles className="h-[15px] w-[15px]" /> Ask Sakhi
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
            Anything about your work, your money or a scheme — in your own words, in your own language.
          </p>
        </div>
        <span className="ux-sq flex shrink-0 items-center gap-1.5 rounded-[10px] px-3 py-2 text-[12px] font-semibold"
              style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>
          Ask <Icons.ArrowRight className="ux-arrow h-[14px] w-[14px]" />
        </span>
      </Link>
    </section>
  );
}
