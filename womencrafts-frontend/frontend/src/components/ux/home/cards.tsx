"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as Icons from "lucide-react";

import { Btn, Card, I, IconTile, Pill, Progress, Rating, SectionHead, v } from "../kit";
import { useCountUp, usePointer } from "../kit/motion";
// Six of the constants this file used to import are gone: ACTIVITIES,
// CIRCLES, JOURNEY, MEMBER_FACES, OPPORTUNITIES and RECOMMENDED. Each was
// rendered on the home screen as if it were hers. What remains is either
// static navigation (QUICK_ACTIONS) or still to be wired.
import {
  EARNINGS, ME, QUICK_ACTIONS, SKILLS, SUGGESTED_MENTOR, SUGGESTIONS,
} from "./data";
import { useJobs, useLearning } from "@/components/ux/growth";
import { useCircles } from "@/components/ux/live";
import { useMe } from "@/components/ux/me";
import { useDiary } from "@/components/ux/diary";

/* ── hero ──────────────────────────────────────────────────────────────── */

export function Hero({ name }: { name?: string }) {
  const point = usePointer<HTMLDivElement>();

  /**
   * The time of day is read after mount, never during render.
   *
   * The server renders this too, and its clock is not her clock — a component
   * that calls `new Date()` while rendering produces "Good morning" on the
   * server and "Good evening" in the browser, and React throws a hydration
   * mismatch. Starting from null and filling it in on the client means both
   * sides agree on the first paint.
   */
  const [part, setPart] = useState<string | null>(null);
  useEffect(() => {
    const h = new Date().getHours();
    setPart(h < 12 ? "morning" : h < 17 ? "afternoon" : "evening");
  }, []);

  return (
    <div
      ref={point}
      className="ux-sq ux-aurora ux-grain ux-spot relative rounded-[22px]"
      style={{
        height: 196,
        background: "linear-gradient(104deg, oklch(0.32 0.13 294) 0%, oklch(0.44 0.19 294) 58%, oklch(0.52 0.19 320) 100%)",
      }}
    >
      {/*
        The emblem, not a photograph.

        The banner used a generated illustration of three women, and generated
        faces at this size are the one thing an interface cannot get away with —
        they are either right or they are uncanny, and there is no fixing them
        from here. The brand mark is the same idea drawn deliberately: two women
        shaking hands inside a W and an S. It is stylised, so it cannot fall into
        the valley, and it puts the logo somewhere she actually looks.
      */}
      <div className="pointer-events-none absolute inset-y-0 end-0 w-[46%] overflow-hidden">
        <span
          aria-hidden
          className="absolute end-[6%] top-1/2 h-[220px] w-[220px] -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(255,255,255,0.30), transparent 72%)" }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ux/brand/womsakhi-emblem.webp"
          alt=""
          className="ux-float absolute end-[4%] top-1/2 h-[164px] w-auto -translate-y-1/2 object-contain"
          style={{ filter: "drop-shadow(0 12px 28px rgba(0,0,0,0.34))" }}
          draggable={false}
        />
      </div>

      <div className="relative flex h-full max-w-[58%] flex-col justify-center ps-9">
        {/* min-height reserves the line so the headline does not jump down a
            few pixels the moment the greeting arrives. */}
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em]"
           style={{ color: "rgba(255,255,255,0.62)", minHeight: 15 }}>
          {part ? `Good ${part}` : "Welcome back"}
        </p>
        <h1 className="ux-gradient-text mt-2 text-[30px] font-bold leading-[1.12]">
          Namaste, {name ?? ME.first}!
        </h1>
        <p className="mt-2 text-[13.5px]" style={{ color: "rgba(255,255,255,0.86)" }}>
          Every step you take today builds your brighter tomorrow.
        </p>
        <div className="mt-4 flex items-center gap-2.5">
          <Btn href="/app/progress" variant="soft" size="sm" iconEnd="ArrowRight">My journey</Btn>
          <Btn href="/app/opportunities" variant="on-brand" size="sm">Find work today</Btn>
        </div>
      </div>
    </div>
  );
}

function QuickTile({ a, i }: { a: (typeof QUICK_ACTIONS)[number]; i: number }) {
  const point = usePointer<HTMLAnchorElement>();
  return (
    <Link ref={point} href={a.href}
          className="ux-i ux-clay ux-hov ux-tilt ux-sheen ux-rise flex h-[94px] flex-col justify-between border border-transparent p-[13px]"
          style={{ background: v(a.tint), ["--i" as string]: i }}>
      <span className="relative flex items-center justify-between">
        <span className="ux-sq grid h-[32px] w-[32px] place-items-center rounded-[10px]"
              style={{ background: "var(--ux-surface)", color: v(a.ink) }}>
          {/* Alternating tilt: six tiles all leaning the same way reads as a
              rendering glitch rather than as a response. */}
          <I name={a.icon} className={`h-[16px] w-[16px] ${i % 2 ? "ux-ico-alt" : "ux-ico"}`} />
        </span>
        <Icons.ChevronRight className="ux-arrow h-[14px] w-[14px]"
                            style={{ color: "var(--ux-faint)" }} strokeWidth={2.2} />
      </span>
      <span className="relative block min-w-0">
        <span className="block truncate text-[12.5px] font-semibold leading-[16px]" style={{ color: "var(--ux-ink)" }}>
          {a.label}
        </span>
        <span className="block truncate text-[10.5px] leading-[14px]" style={{ color: "var(--ux-muted)" }} title={a.sub}>
          {a.sub}
        </span>
      </span>
    </Link>
  );
}

export function QuickActions() {
  return (
    <div className="ux-deck ux-tilt-scene mt-[17px] grid grid-cols-6 gap-[15px]">
      {QUICK_ACTIONS.map((a, i) => <QuickTile key={a.label} a={a} i={i} />)}
    </div>
  );
}

/* ── main column ───────────────────────────────────────────────────────── */

/**
 * The course she is actually part-way through.
 *
 * A constant named one course, its lesson count and "1 hr 20 min left" — the
 * same course, at the same point, for every woman. Hers is the one with a
 * progress figure the server keeps.
 */
export function ContinueJourney() {
  const { data: learning } = useLearning();
  const course = learning.continuing[0];
  if (!course) {
    return (
      <Card className="ux-onscroll">
        <SectionHead title="Continue Your Journey" action="View Journey" />
        <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
          You have not started a course yet. The one you join shows up here, with how far through you are.
        </p>
        <div className="mt-3.5">
          <Btn href="/app/programs" variant="soft" size="sm">Find a course</Btn>
        </div>
      </Card>
    );
  }
  const JOURNEY = {
    art: course.thumb,
    title: course.title,
    pct: course.pct ?? 0,
    // Lesson counts and minutes-remaining are not carried per course, and the
    // constant invented both. What is real is the percentage.
    next: course.category,
  };
  return (
    <Card className="ux-onscroll">
      <SectionHead title="Continue Your Journey" action="View Journey" />
      <div className="ux-hov ux-sq flex gap-4 rounded-[13px] p-3" style={{ background: "var(--ux-surface-2)" }}>
        <span className="h-[100px] w-[104px] shrink-0 overflow-hidden rounded-[10px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={JOURNEY.art} alt="" className="ux-art h-full w-full object-cover" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <h3 className="text-[14px] font-semibold" style={{ color: "var(--ux-ink)" }}>{JOURNEY.title}</h3>
          <p className="mt-1 text-[11.5px]" style={{ color: "var(--ux-muted)" }}>
            {JOURNEY.pct}% of the way through
          </p>
          <div className="mt-2.5 flex items-center gap-2.5">
            <Progress pct={JOURNEY.pct} />
            <span className="shrink-0 text-[11.5px] font-medium" style={{ color: "var(--ux-muted)" }}>{JOURNEY.pct}%</span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            {/* min-w-0 so the label truncates instead of wrapping and shoving
                the button out of line with the progress bar above it. */}
            <span className="min-w-0 truncate text-[11.5px]" style={{ color: "var(--ux-muted)" }}
                  title={JOURNEY.next}>
              {JOURNEY.next}
            </span>
            <Btn href={`/app/programs/${course.id}`} variant="soft" size="sm">Continue</Btn>
          </div>
        </div>
      </div>

      {/* The card used to end here and left ~90px of empty white beside a
          two-item Recommended card. Showing what is actually next fills it with
          something she can act on rather than padding. */}
      {/* The "Up next" list is gone. It named three lessons with minute
          counts from a constant — the same three under every course. The
          course's real curriculum lives on its own screen, one tap away
          through Continue, and is not carried by this hook. */}
    </Card>
  );
}

/** A course row. Typed on its own shape rather than on the mock's. */
interface CourseRowData {
  id: string; title: string; art: string; meta: string; rating: string; count: string;
}

function CourseRow({ r, i }: { r: CourseRowData; i: number }) {
  const point = usePointer<HTMLAnchorElement>();
  return (
    <Link ref={point} href={`/app/programs/${r.id}`}
          className="ux-i ux-sq ux-edge flex items-center gap-3 rounded-[13px] border p-2.5"
          style={{ borderColor: "var(--ux-line)", ["--i" as string]: i }}>
      <span className="h-[62px] w-[88px] shrink-0 overflow-hidden rounded-[8px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={r.art} alt="" className="ux-art h-full w-full object-cover" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[13px] font-semibold" style={{ color: "var(--ux-ink)" }}>{r.title}</h3>
        <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--ux-muted)" }}>{r.meta}</p>
        <p className="mt-1"><Rating value={r.rating} count={r.count} /></p>
      </div>
      <Icons.Bookmark className="ux-ico h-[17px] w-[17px] shrink-0" style={{ color: "var(--ux-faint)" }} strokeWidth={1.8} />
    </Link>
  );
}

/**
 * Courses from the catalogue she has not joined.
 *
 * Not "recommended" in any computed sense — nothing here scores a course
 * against her. The constant this replaces implied a recommendation engine that
 * does not exist, so the heading says what is true instead.
 */
export function Recommended() {
  const { data: learning } = useLearning();
  const RECOMMENDED = learning.picks.slice(0, 3).map((c) => ({
    id: c.id,
    title: c.title,
    art: c.thumb,
    meta: [c.category, c.hours].filter(Boolean).join(" · "),
    // The catalogue carries a rating only where somebody has left one. An
    // em-dash is honest; a made-up 4.8 beside a course nobody has taken is not.
    rating: c.rating ?? "—",
    count: c.count ?? "",
  }));
  return (
    <Card className="ux-onscroll">
      <SectionHead title="Courses you could join" action="See All" />
      {RECOMMENDED.length === 0 && (
        <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
          You are in every course on offer. More are added each month.
        </p>
      )}
      <div className="ux-deck ux-stagger space-y-2.5">
        {RECOMMENDED.map((r, i) => <CourseRow key={r.id} r={r} i={i} />)}
      </div>
    </Card>
  );
}

/**
 * Work she could actually apply for.
 *
 * This listed four openings from a constant, including a "Content Creator
 * (Freelance)" at a company called **BrandStory** that does not exist. The
 * home screen is where most women start, so an invented job here is the first
 * thing the app says to her.
 */
export function Opportunities() {
  const { data: jobs } = useJobs();
  const shown = jobs.slice(0, 3);
  return (
    <Card className="ux-onscroll">
      <SectionHead title="Opportunities for You" action="See All" />
      {shown.length === 0 && (
        <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
          Nothing open right now. New work is posted most weeks.
        </p>
      )}
      <div className="ux-deck ux-stagger space-y-2.5">
        {shown.map((o) => (
          <Link key={o.id} href={`/app/opportunities/${o.id}`}
                className="ux-i ux-sq flex items-start gap-3 rounded-[13px] border p-3"
                style={{ borderColor: "var(--ux-line)" }}>
            <IconTile icon={o.icon} tint={o.logoTint} ink={o.logoInk} size={36} radius={9} />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[13px] font-semibold" style={{ color: "var(--ux-ink)" }}>{o.title}</h3>
              <p className="mt-0.5 truncate text-[11.5px]" style={{ color: "var(--ux-muted)" }}>
                {o.org} <span aria-hidden>•</span> {o.place}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {o.skills.slice(0, 3).map((t) => (
                  <span key={t} className="rounded-[6px] border px-2 py-[3px] text-[10.5px]"
                        style={{ borderColor: "var(--ux-line-strong)", color: "var(--ux-muted)" }}>{t}</span>
                ))}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-3">
              <Icons.Bookmark className="h-[16px] w-[16px]" style={{ color: "var(--ux-faint)" }} strokeWidth={1.8} />
              <span className="text-[10.5px]" style={{ color: "var(--ux-faint)" }}>{o.posted}</span>
            </div>
          </Link>
        ))}
      </div>
      <Link href="/app/opportunities" className="ux-press ux-hov mt-3 flex w-full items-center justify-center gap-1.5 py-1.5 text-[12.5px] font-medium"
            style={{ color: "var(--ux-brand)" }}>
        View All Opportunities <Icons.ArrowRight className="ux-arrow h-3.5 w-3.5" strokeWidth={2} />
      </Link>
    </Card>
  );
}

/**
 * Circles she could join — the real ones, from the server.
 *
 * A constant listed four invented circles with invented member counts. Joining
 * one is a commitment to other women, and two of the four were savings
 * circles, which is a commitment to pay in every month.
 */
export function Circles() {
  const { data: circles } = useCircles();
  const CIRCLES = circles.discover.slice(0, 3);
  return (
    <Card className="ux-onscroll">
      <SectionHead title="Sakhi Circles You Might Like" action="See All" />
      {/* The deck wraps the list AND the "start your own" row beneath it: it is
          one of the choices on offer, so it has to step back with the rest. */}
      <div className="ux-deck">
      <div className="ux-stagger space-y-2.5">
        {CIRCLES.map((c) => (
          <div key={c.id} className="ux-i ux-sq flex items-center gap-3 rounded-[13px] border p-3"
               style={{ borderColor: "var(--ux-line)" }}>
            <span className="grid h-[44px] w-[44px] shrink-0 place-items-center overflow-hidden rounded-full"
                  style={{ background: v(c.tint) }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.art} alt="" className="ux-art h-full w-full object-cover" />
            </span>
            {/* The faces sit under the name rather than beside it: on one row
                they left 137px for a 175px name, so every circle was cut off
                mid-word. Below, they also read as what they are — the members. */}
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[13px] font-semibold" style={{ color: "var(--ux-ink)" }} title={c.name}>
                {c.name}
              </h3>
              {/* The face stack is gone: it drew three photographs from a
                  constant, so every circle in the app appeared to contain the
                  same three women. The count is real and says enough. */}
              <span className="mt-1.5 block truncate text-[11px]" style={{ color: "var(--ux-muted)" }}>
                {c.members} {c.members === 1 ? "member" : "members"}
                {c.kind === "Savings" && <span aria-hidden> • </span>}
                {c.kind === "Savings" && "saves together"}
              </span>
            </div>
            <Btn variant="soft" size="sm" href={`/app/circles/${c.id}`}>Open</Btn>
          </div>
        ))}
      </div>
      <Link href="/app/circles/new"
            className="ux-i ux-hov ux-sq mt-2.5 flex items-center gap-3 rounded-[13px] border border-dashed p-3"
            style={{ borderColor: "var(--ux-line-strong)" }}>
        <span className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full"
              style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>
          <Icons.Plus className="ux-ico-turn h-[19px] w-[19px]" strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold" style={{ color: "var(--ux-ink)" }}>Start your own circle</span>
          <span className="block text-[11px]" style={{ color: "var(--ux-muted)" }}>
            Bring together women near you or in your trade
          </span>
        </span>
        <Icons.ArrowRight className="ux-arrow h-[16px] w-[16px] shrink-0" style={{ color: "var(--ux-faint)" }} />
      </Link>
      </div>
    </Card>
  );
}

export function AskSakhiBar() {
  return (
    <section className="ux-clay ux-orbit ux-onscroll relative overflow-hidden p-[18px]"
             style={{ background: "linear-gradient(100deg, var(--ux-tint-lilac), var(--ux-tint-pink))", borderRadius: 18 }}>
      <div className="flex items-start gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ux/art/mascot-robot-waving.webp" alt="" className="ux-float h-[76px] w-[76px] shrink-0 object-contain" />
        <div className="w-[178px] shrink-0 pt-1">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold" style={{ color: "var(--ux-ink)" }}>
            Ask Sakhi <Pill size="sm">New</Pill>
          </h2>
          <p className="mt-1 text-[11.5px] leading-snug" style={{ color: "var(--ux-muted)" }}>
            Your AI companion for guidance, answers &amp; support.
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <input placeholder="Ask anything..."
                   className="ux-sq h-[44px] min-w-0 flex-1 rounded-[11px] border px-4 text-[13px] outline-none"
                   style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" }} />
            <button aria-label="Send" className="ux-press ux-hov ux-clay grid h-[44px] w-[44px] shrink-0 place-items-center rounded-[12px]"
                    style={{ background: "var(--ux-brand-600)" }}>
              <Icons.Send className="ux-ico h-[18px] w-[18px] text-white" strokeWidth={1.9} />
            </button>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="ux-press ux-clay rounded-full px-3.5 py-[7px] text-[11.5px]"
                      style={{ background: "var(--ux-surface)", color: "var(--ux-ink-2)" }}>{s}</button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── right rail ────────────────────────────────────────────────────────── */

/**
 * Her, in the rail.
 *
 * This read `ME` from the constants file while `HomeShell` two components away
 * read `useMe()` — so the same page could greet her by her real name at the
 * top and show somebody else's name and photograph down the side. `useMe`
 * exists precisely to stop that and this component was never moved onto it.
 */
export function ProfileCard() {
  const ME = useMe();
  return (
    <Card>
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ME.avatar} alt="" className="h-[52px] w-[52px] rounded-full object-cover"
             style={{ background: "var(--ux-brand-tint)" }} />
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-[15px] font-semibold" style={{ color: "var(--ux-ink)" }}>
            {ME.name}
            {ME.verified && <Icons.BadgeCheck className="h-4 w-4" style={{ color: "var(--ux-blue)" }} />}
          </h2>
          <p className="text-[11.5px]" style={{ color: "var(--ux-muted)" }}>{ME.tagline}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-[12px]">
        <span style={{ color: "var(--ux-ink-2)" }}>Profile Strength</span>
        <span className="font-semibold" style={{ color: "var(--ux-ink)" }}>{ME.profilePct}%</span>
      </div>
      <div className="mt-2"><Progress pct={ME.profilePct} track="--ux-track" /></div>
      <p className="mt-2.5 text-[11.5px] leading-snug" style={{ color: "var(--ux-muted)" }}>
        Complete your profile to unlock more opportunities.
      </p>
      <div className="mt-3">
        <Btn href="/app/profile" variant="soft" full iconEnd="ArrowRight">Complete Profile</Btn>
      </div>
    </Card>
  );
}

export function Earnings() {
  const total = useCountUp(EARNINGS.total, 900);
  const pts = EARNINGS.series;
  const w = 280, h = 62, max = Math.max(...pts);
  const xy = pts.map((p, i) => [(i / (pts.length - 1)) * w, h - (p / max) * h] as const);
  const line = xy.map(([x, y]) => `${x},${y}`).join(" ");
  // Closed back along the baseline so the fill has something to fill.
  const area = `${line} ${w},${h} 0,${h}`;

  const ref = useRef<SVGPolylineElement>(null);
  const [len, setLen] = useState(0);
  // The dash has to be the path's real length. A guessed value either clips the
  // tail or leaves the line sitting invisible after the animation has finished.
  useEffect(() => { if (ref.current) setLen(ref.current.getTotalLength()); }, [line]);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--ux-ink)" }}>Earnings Snapshot</h2>
        <button className="ux-press ux-hov -my-1 flex items-center gap-1 py-1 text-[11.5px]" style={{ color: "var(--ux-muted)" }}>
          {EARNINGS.period} <Icons.ChevronDown className="ux-ico h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mt-3 text-[27px] font-bold leading-none tabular-nums" style={{ color: "var(--ux-ink)" }}>
        ₹{total.toLocaleString("en-IN")}
      </p>
      <p className="mt-1.5 flex items-center gap-1 text-[11.5px]" style={{ color: "var(--ux-green-ink)" }}>
        {EARNINGS.delta} <span style={{ color: "var(--ux-muted)" }}>vs last month</span>
        <Icons.TrendingUp className="h-3.5 w-3.5" />
      </p>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 w-full overflow-visible" style={{ height: 62 }} aria-hidden>
        <defs>
          <linearGradient id="ux-spark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ux-brand-600)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--ux-brand-600)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#ux-spark)" className="ux-fade" style={{ animationDelay: "500ms" }} />
        <polyline
          ref={ref}
          points={line}
          fill="none"
          stroke="var(--ux-brand-600)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={len ? "ux-draw" : undefined}
          style={len ? { strokeDasharray: len, strokeDashoffset: len } : { opacity: 0 }}
        />
        {xy.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.5" fill="var(--ux-brand-600)"
                  className="ux-pop" style={{ ["--i" as string]: i, transformBox: "fill-box", transformOrigin: "center" }} />
        ))}
      </svg>
    </Card>
  );
}

/**
 * What she has actually agreed to be at.
 *
 * A constant listed three activities — a mentor session, a class and a mela —
 * on every woman's home screen. Her diary is the same information and reads it
 * from her bookings; this rail was the one place still making it up.
 */
export function Upcoming() {
  const { data: diary } = useDiary();
  const ACTIVITIES = diary.entries.filter((e) => !e.past).slice(0, 3);
  return (
    <Card className="ux-onscroll-soft">
      <SectionHead title="Upcoming Activities" action="View Calendar" />
      {ACTIVITIES.length === 0 && (
        <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
          Nothing booked yet. Anything you book shows up here.
        </p>
      )}
      <div className="ux-stagger space-y-3">
        {ACTIVITIES.map((a) => (
          <div key={a.id} className="ux-hov flex gap-3">
            <div className="grid h-[46px] w-[42px] shrink-0 place-items-center rounded-[10px]"
                 style={{ background: "var(--ux-brand-tint)" }}>
              <span className="text-[16px] font-bold leading-none" style={{ color: "var(--ux-brand)" }}>{a.d}</span>
              <span className="text-[9px] font-semibold" style={{ color: "var(--ux-brand)" }}>{a.m}</span>
            </div>
            {/* The title had the time and a button beside it in a 320px rail and
                lost half its words. It now owns its line and wraps if it must. */}
            <div className="min-w-0 flex-1">
              <h3 className="text-[12.5px] font-semibold leading-[16px]" style={{ color: "var(--ux-ink)" }}>
                {a.title}
              </h3>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[11px]" style={{ color: "var(--ux-muted)" }}>{a.time}</span>
                <Btn variant="soft" size="sm" href={a.href}>{a.cta}</Btn>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function Inspiration() {
  return (
    <section className="ux-clay relative overflow-hidden p-[18px]"
             style={{ background: "linear-gradient(140deg, var(--ux-tint-lilac), var(--ux-tint-pink))" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ux/art/scene-woman-planting-sapling.webp" alt=""
           className="ux-float pointer-events-none absolute -bottom-3 -end-3 h-[104px] w-[104px] object-contain opacity-90" />
      <h2 className="relative flex items-center gap-2 text-[14.5px] font-semibold" style={{ color: "var(--ux-brand)" }}>
        <Icons.Sparkles className="h-4 w-4" /> Daily Inspiration
      </h2>
      <p className="relative mt-2.5 w-[62%] text-[12.5px] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
        You are stronger than you think, and capable of more than you imagine.
      </p>
    </section>
  );
}

/** A mentor who teaches what she is currently learning. */
export function MentorPick() {
  const m = SUGGESTED_MENTOR;
  return (
    <Card className="ux-onscroll-soft">
      <SectionHead title="A mentor for you" action="See All" />
      <div className="ux-hov flex items-center gap-3">
        <span className="h-[54px] w-[54px] shrink-0 overflow-hidden rounded-full"
              style={{ background: "var(--ux-tint-orange)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m.art} alt="" className="ux-art h-full w-full object-cover" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[13.5px] font-semibold" style={{ color: "var(--ux-ink)" }}>{m.name}</h3>
          <p className="mt-0.5 truncate text-[11.5px]" style={{ color: "var(--ux-muted)" }}>{m.role}</p>
          <p className="mt-1"><Rating value={m.rating} count={m.sessions} /></p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Pill tone="green" size="sm">{m.free}</Pill>
        <Pill tone="neutral" size="sm">{m.langs}</Pill>
      </div>
      <div className="mt-3">
        <Btn href="/app/mentors" variant="soft" full iconEnd="ArrowRight">Book a session</Btn>
      </div>
    </Card>
  );
}

/** What she is building, so the rail says something about her and not only the catalogue. */
export function Skills() {
  return (
    <Card className="ux-onscroll-soft">
      <SectionHead title="Skills you are building" action="View" />
      <ul className="space-y-3">
        {SKILLS.map((sk) => (
          <li key={sk.name}>
            <div className="flex items-center justify-between text-[12px]">
              <span className="min-w-0 truncate" style={{ color: "var(--ux-ink-2)" }}>{sk.name}</span>
              <span className="shrink-0 font-medium tabular-nums" style={{ color: "var(--ux-muted)" }}>{sk.pct}%</span>
            </div>
            <div className="mt-1.5"><Progress pct={sk.pct} tone={sk.tone} track="--ux-track" /></div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
