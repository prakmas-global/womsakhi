"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import { useGreeting } from "@/lib/use-greeting";
import { useAuth } from "@/context/AuthContext";
import { NextStepCard } from "@/components/ux/journey/NextStepCard";
import { useHome } from "@/components/ux/live";
import { formatRupees, Skeleton } from "@/components/ux/kit";
import { apiDismissNextStep, type ApiHome } from "@/lib/me-api";

/**
 * Home, built to the approved dashboard design — and, since this pass, drawn
 * entirely from `GET /me/home`.
 *
 * ── What changed, and why it mattered ───────────────────────────────────────
 * This screen used to read twenty-five module constants: a balance of ₹24,350,
 * a client called BrandStory, a savings round nobody had paid, a journey stage
 * derived from three fixtures. Everything a woman could see about her own
 * money and her own progress was invented, and it was invented *confidently* —
 * which is worse than a gap, because a gap asks a question and a wrong figure
 * answers one.
 *
 * One request now supplies all of it. Thirteen blocks, gathered server-side,
 * measured at 69ms; the alternative was eleven hooks and eleven chances for one
 * slow query to leave a hole in the page.
 *
 * ── Three things this screen will not do ────────────────────────────────────
 * **It does not invent a number.** Three fields come back `null` on purpose and
 * render as absent rather than as zero: her streak (nothing records which days
 * she opened the app), `better_than_pct` (the mock's "ahead of 68% of women in
 * your circle" — this platform does not rank women against each other) and
 * `left_mins` (lesson durations are mostly unset, and summing blanks produces a
 * confident wrong answer). The 68% ring is gone rather than refilled.
 *
 * **It tells missing apart from empty.** `unavailable` names the blocks whose
 * own query timed out. A woman with no circles and a woman whose circles did
 * not load need different sentences — "join one" is wrong for the second, and
 * reads as though her circles had vanished.
 *
 * **It keeps the hero while the data is in flight.** The banner and her
 * greeting need no request, so they paint immediately and the data-shaped part
 * of the page carries the skeleton. A blank first frame on a 3G connection is
 * the difference between an app that is slow and an app that is broken.
 *
 * ── What could not be copied from the design, and why ───────────────────────
 * **Trust Score 850** has no endpoint, no model and no agreed formula. Its slot
 * carries earnings this month, which is counted server-side.
 *
 * **Together Challenges** is not a module that exists. Her savings pot took the
 * slot: same shape — a goal, a bar, the women in it — and every number real.
 *
 * The deltas are the other quiet change. The design puts a green "+12%" on
 * every card; only earnings has a previous month stored to compare against, so
 * only earnings can show one.
 */

/* ── the loosely-typed blocks, narrowed where they are drawn ────────────────
   `ApiHome` types six blocks as `Record<string, unknown>[]`, because the server
   returns richer rows than any one screen draws. Narrowing here — rather than
   reaching into them with index access at each call site — is what lets a
   renamed field fail the build instead of rendering `undefined`. */

export interface HomeCircle {
  id: string; name: string; topic: string; desc: string;
  member_count: number; post_count: number; joined: boolean;
  /** Stated by the server, never guessed from the circle's name. */
  is_savings: boolean;
  /** Each woman's share per round, in MINOR units. */
  monthly_minor: number;
  /** Which round it is in. 0 when the circle does not collect money. */
  round: number;
}

export interface HomeStory {
  id: string; author_name: string; author_avatar?: string;
  title: string; body: string; cover?: string;
  likes: number; when: string; program?: string;
}

export interface HomeProgress {
  member_since: string; sessions_attended: number; sessions_upcoming: number;
  programs_active: number; programs_completed: number;
}

export interface HomeNote {
  id: string; type: string; icon: string; title: string;
  body: string; href: string; when: string; unread: boolean;
}

export const rowsOf = <T,>(v: Record<string, unknown>[] | undefined): T[] =>
  (v ?? []) as unknown as T[];

export const blockOf = <T,>(v: Record<string, unknown> | null | undefined): T | null =>
  (v ?? null) as T | null;

/**
 * Did this block fail server-side?
 *
 * The names are the server's own block names — "summary", "circles", "stories",
 * "journey", "progress", "events". A block listed here is MISSING, not empty,
 * and the two must not share a sentence.
 */
export const lost = (h: ApiHome, block: string) => (h.unavailable ?? []).includes(block);

function Ico({ name, className, sw = 1.9 }: { name: string; className?: string; sw?: number }) {
  const C = (Icons as unknown as Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>>)[name]
    ?? Icons.Circle;
  return <C className={className} strokeWidth={sw} />;
}

/**
 * "09:00" → "9:00 AM". The server stores 24-hour; nobody reads it that way.
 *
 * **The guard is the point.** `/me/home` merges two sources into one list:
 * bookings carry "09:00", events carry a time a person typed — "5:00 PM".
 * Splitting the second on ":" gives "00 PM" as the minutes, `Number` makes that
 * `NaN`, and `NaN ?? 0` is still `NaN` — so the rail printed "5:NaN AM" on a
 * real event the moment the two lists were merged. Anything that is not
 * 24-hour HH:MM is already readable and is returned untouched.
 */
export function clock(time: string): string {
  const t = (time ?? "").trim();
  if (!t) return "";
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return t;
  const h = Number(m[1]);
  if (!Number.isFinite(h)) return t;
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
}

/** A block the server could not fetch. Quiet, and never an empty state. */
export function Gone({ what }: { what: string }) {
  return (
    <p className="flex items-center gap-2 py-5 text-xsm" style={{ color: "var(--ux-muted)" }}>
      <Icons.CloudOff className="h-[15px] w-[15px] shrink-0" />
      We could not load {what} just now. Everything else here is up to date.
    </p>
  );
}

function PanelHead({ title, action, href }: { title: string; action: string; href: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-bold tracking-tight" style={{ color: "var(--ux-ink)" }}>{title}</h2>
      <Link href={href}
            className="ux-hov -mx-2.5 -my-2 flex min-h-[40px] shrink-0 items-center gap-1 rounded-[10px] px-2.5 py-2 text-xs font-semibold"
            style={{ color: "var(--ux-brand)" }}>
        {action}
        <Icons.ChevronRight className="h-[14px] w-[14px]" />
      </Link>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section className="ux-sq flex flex-col rounded-[16px] p-5"
             style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)",
               boxShadow: "var(--ux-shadow-card)" }}>
      {children}
    </section>
  );
}

/* ── the hero ──────────────────────────────────────────────────────────── */

/**
 * The front door.
 *
 * `bannermain.png` is not a background — it is a finished piece with the
 * wordmark, the quote, six women, the globe and the Charminar all composed
 * into it. Laying a greeting and two buttons over that would cover the part
 * of it that does the work, so the hero is one card in two halves: the banner
 * whole and uncropped on top, and her own greeting and the two things she can
 * do from here underneath, on the brand gradient the banner ends in.
 *
 * The headline it replaces said "Let's make today a step towards your better
 * tomorrow"; the banner says "Independent Women Build Brighter Tomorrows" in
 * type nobody could set here. Saying both would be saying it twice.
 *
 * It takes no data, which is why it is outside the loading branch: her name
 * comes from the session she is already signed in with.
 */
function Hero({ first }: { first: string }) {
  const greeting = useGreeting();

  return (
    <section className="ux-sq relative isolate overflow-hidden rounded-[20px]"
             style={{ border: "1px solid var(--ux-line)" }}>
      {/*
        `object-cover` at 2.8:1 against the art's own 2.5:1, which trims about
        a tenth of its height — the empty ceiling above the women and the haze
        below the skyline — and nothing that carries meaning. It was 3.05,
        which took a fifth, and the fifth included the top of "A Brighter
        Tomorrow" in the left-hand corner. The margins here are small: that
        lettering starts at 7.5% of the height, the tallest head at 8%, the
        wordmark at 13%.

        `fetchPriority="high"` and no lazy loading: this is the first thing on
        the first screen she sees, and a banner that arrives late is a page
        that jumps.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ux/art/home-banner.webp"
           alt="Six women working together at a laptop, under the WomSakhi wordmark and the words “Independent Women Build Brighter Tomorrows”."
           decoding="async" fetchPriority="high" width={1900} height={760}
           className="block w-full object-cover object-center"
           style={{ aspectRatio: "2.8 / 1" }} />

      {/* Her half. The gradient picks up the violet the banner's wordmark ends
          on, so the two halves read as one card rather than a picture with a
          bar stuck under it. */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 p-5 sm:px-7"
           style={{ background: "linear-gradient(102deg, var(--ux-brand-900) 0%, var(--ux-fill) 62%, var(--ux-rib-2) 118%)" }}>
        <div className="min-w-0">
          <p className="text-xsm font-semibold" style={{ color: "var(--ux-on-brand-2)" }}>
            {greeting}, {first || "friend"}
          </p>
          <p className="mt-1 text-lg font-extrabold leading-tight tracking-[-0.02em]"
             style={{ color: "var(--ux-on-brand)" }}>
            Connect. Learn. Earn. Grow.{" "}
            <span style={{ color: "var(--ux-rib-5)" }}>Together.</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/app/opportunities"
                /* `ux-clay`: this is the app's primary call to action and it
                   should feel like a physical key. Clay is the raised
                   treatment — a lit top lip, volume underneath, and a press
                   that goes down in 60ms and springs back in 220. */
                className="ux-press ux-clay ux-btn-g flex min-h-[44px] items-center gap-2 rounded-full px-5 text-xsm font-bold"
                style={{ background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))", color: "var(--ux-on-brand)" }}>
            Explore Opportunities
            <Icons.ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/app/stories"
                className="ux-press ux-clay flex min-h-[44px] items-center gap-2.5 rounded-full px-4 text-xsm font-bold"
                style={{ background: "var(--ux-on-brand-track)", border: "1px solid var(--ux-on-brand-2)",
                         color: "var(--ux-on-brand)" }}>
            <span className="grid h-[26px] w-[26px] place-items-center rounded-full"
                  style={{ background: "var(--ux-on-brand-btn)", color: "var(--ux-on-brand-btn-ink)" }}>
              <Icons.Play className="h-[11px] w-[11px]" fill="currentColor" />
            </span>
            Watch Inspiration
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── the one next step ─────────────────────────────────────────────────── */

/**
 * Her next step, as the server computed it.
 *
 * It used to come from `readJourneyState()`, which assembles a stage out of
 * four fixtures — a course that is 8 of 12 done, three skills, three circles
 * and a mock ledger. None of those are hers. The server derives the same
 * answer from the enrolment she actually holds: the first unfinished lesson of
 * the course on the card below, or her certificate when there are none left.
 *
 * `stage` is required by the shared `NextStep` type and is inert here: it is
 * read only to draw the "you are past this" chip, which needs the `at` prop
 * this screen does not pass — the server sends a step, not a position on the
 * seven-stage journey, and inventing one would be a claim about her life. Every
 * step this endpoint can return is a learning step, so "learn" is also true.
 */
function NextUp({ h, onDismiss }: { h: ApiHome; onDismiss: () => void }) {
  const s = h.next_step;
  if (!s) return null;
  // "45 min" → 45, "" → absent. The server sends a label, not a number, and
  // most lessons have no duration set at all — so this is usually absent, and
  // absent is the correct rendering.
  const mins = Number.parseInt(s.duration ?? "", 10);
  return (
    <NextStepCard
      step={{
        stage: "learn",
        title: s.title,
        because: s.because,
        cta: s.cta,
        href: s.href,
        icon: s.icon,
        mins: Number.isFinite(mins) && mins > 0 ? mins : undefined,
      }}
      onDismiss={onDismiss}
    />
  );
}

/* ── the course she is in ──────────────────────────────────────────────── */

/**
 * What she is learning, drawn from her enrolment.
 *
 * This replaces the seven-stage journey track, which drew its position from
 * the same fixtures as the old next step — so the two agreed with each other
 * and with nothing else.
 *
 * **"96 min left" is gone and is not coming back.** `left_mins` is null because
 * lesson durations are optional in the catalogue and almost always unset;
 * summing blanks produced a number that looked measured and was not. Where the
 * server does carry a duration for a specific lesson it is printed beside that
 * lesson, and nowhere else.
 */
function Journey({ h }: { h: ApiHome }) {
  const j = h.journey;

  if (lost(h, "journey")) {
    return (
      <section className="ux-sq rounded-[16px] p-5"
               style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
        <PanelHead title="What you are learning" action="All programmes" href="/app/programs" />
        <Gone what="your course" />
      </section>
    );
  }

  if (!j) {
    return (
      <section className="ux-sq rounded-[16px] p-5"
               style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
        <PanelHead title="What you are learning" action="All programmes" href="/app/programs" />
        <p className="text-xsm leading-relaxed" style={{ color: "var(--ux-muted)" }}>
          You have not joined a programme yet. They are free, they run in Hindi and
          English, and most women finish one in six weeks.
        </p>
        <Link href="/app/programs"
              className="ux-press ux-btn-g mt-3.5 inline-flex min-h-[42px] items-center gap-2 rounded-[12px] px-4 text-xsm font-bold"
              style={{ background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))", color: "var(--ux-on-brand)" }}>
          Find a programme
          <Icons.ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    );
  }

  return (
    <section className="ux-sq rounded-[16px] p-5"
             style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
      <PanelHead title="What you are learning" action="All programmes" href="/app/programs" />

      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold" style={{ color: "var(--ux-ink)" }}>{j.title}</p>
          {j.category && (
            <p className="mt-1 text-2xs" style={{ color: "var(--ux-muted)" }}>{j.category}</p>
          )}
        </div>
        <p className="text-xs font-bold tabular-nums" style={{ color: "var(--ux-green-ink)" }}>
          {j.done} of {j.total} done · {j.pct}%
        </p>
      </div>

      <div className="mt-2.5 h-[9px] w-full overflow-hidden rounded-full" style={{ background: "var(--ux-track)" }}>
        <div className="h-full rounded-full"
             style={{ width: `${Math.min(100, Math.max(0, j.pct))}%`,
                      background: "linear-gradient(90deg, var(--ux-rib-2), var(--ux-rib-3))",
                      transition: "width var(--ux-t-slow) var(--ux-ease-out)" }} />
      </div>

      {j.up_next.length > 0 && (
        <ul className="mt-3.5 flex flex-wrap gap-2">
          {j.up_next.map((l) => (
            <li key={l.n}
                className="flex items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-2xs font-semibold"
                style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line)",
                         color: "var(--ux-ink-2)" }}>
              {/* The number, unless the title already carries it — a
                  curriculum whose lessons are called "Week 5" rendered
                  "5 Week 5". */}
              {!new RegExp(`(^|\\D)${l.n}(\\D|$)`).test(l.title) && (
                <span style={{ color: "var(--ux-muted)" }}>{l.n}</span>
              )}
              {l.title}
              {/* Only when the catalogue actually carries one. */}
              {l.duration && <span style={{ color: "var(--ux-muted)" }}>· {l.duration}</span>}
            </li>
          ))}
        </ul>
      )}

      <Link href={j.href}
            className="ux-hov mt-3.5 inline-flex min-h-[40px] items-center gap-1.5 text-xs font-semibold"
            style={{ color: "var(--ux-brand)" }}>
        Open the course
        <Icons.ChevronRight className="h-[14px] w-[14px]" />
      </Link>
    </section>
  );
}

/* ── the figure row ────────────────────────────────────────────────────── */

/**
 * Four figures, each of which appears exactly once on this screen.
 *
 * It was five, and two of them were repeats. **"Total Balance" is gone**: it
 * rendered `money.balance_minor`, which is the same expression the rail's
 * "Your Balance" card renders 300px to the right — and the rail's is the one
 * that also offers the action, so the rail's is the one that stayed.
 * **"Savings Pot" is gone** for the same reason: it printed the identical total
 * to the pot panel two rows below it.
 *
 * Nothing was put in their place. A figure invented to keep a five-column
 * rhythm is how this screen ended up with a trust score.
 */
function Stats({ h }: { h: ApiHome }) {
  const money = h.earnings?.money;
  const earned = money?.earned_this_month_minor ?? 0;

  /**
   * The month-on-month change, as the server computed it — shown only once
   * there is something to compare.
   *
   * `delta_pct` is −100 for a woman who earned ₹3,000 last month and nothing
   * yet this month, which is arithmetically true and reads, on the 2nd, as the
   * news that her business has collapsed. A month that has not started is not a
   * collapse, so the comparison waits until there is money on both sides of it.
   */
  const delta = h.earnings?.delta_pct ?? null;
  const showDelta = delta !== null && earned > 0;

  const circles = rowsOf<HomeCircle>(h.circles).filter((c) => c.joined);

  type Tile = {
    icon: string; tint: string; ink: string; label: string;
    value: string; note: string; href: string;
    delta?: number | null;
    /** The server could not fetch this one. Unknown — never zero. */
    gone?: boolean;
  };

  const tiles: Tile[] = [
    {
      icon: "TrendingUp", tint: "--ux-tint-green", ink: "--ux-green-ink", label: "Earned",
      // "₹0" reads two ways and only one of them is true — she earned nothing
      // this month, or a formatter divided the paise twice. This screen has
      // shipped the second bug before, so a legitimate zero is said in words.
      value: earned > 0 ? formatRupees(earned) : "Nothing yet",
      note: earned > 0 ? "This month" : "Ask to be paid",
      delta: showDelta ? delta : null,
      href: earned > 0 ? "/app/wallet" : "/app/collect",
      gone: !money,
    },
    {
      icon: "BadgeIndianRupee", tint: "--ux-tint-amber", ink: "--ux-amber-ink", label: "On its way",
      // Zero here is a real answer, not a missing one — so it is said in words
      // rather than as "₹0", which reads like a formatter that ran twice.
      value: (money?.pending_minor ?? 0) > 0 ? formatRupees(money?.pending_minor ?? 0) : "Nothing due",
      note: "Money owed to you",
      href: "/app/wallet",
      gone: !money,
    },
    {
      icon: "UsersRound", tint: "--ux-tint-pink", ink: "--ux-pink-ink", label: "My Circles",
      value: String(circles.length),
      note: circles.length === 1 ? "Circle you are in" : "Circles you are in",
      href: "/app/circles",
      gone: lost(h, "circles"),
    },
    {
      icon: "CalendarDays", tint: "--ux-tint-violet", ink: "--ux-violet-ink", label: "Coming up",
      value: String(h.upcoming.length),
      note: h.upcoming.length === 1 ? "Session booked" : "Sessions and events",
      href: "/app/schedule",
      // Two blocks feed this list. Only when BOTH failed is the count unknown;
      // one of the two missing makes it short, which the calendar itself shows.
      gone: lost(h, "summary") && lost(h, "events"),
    },
  ];

  return (
    // Scrolls sideways on a phone rather than crushing the cards to 70px each.
    <div className="-mx-[20px] flex gap-3 overflow-x-auto px-[20px] pb-1 lg:mx-0 lg:grid lg:grid-cols-4 lg:px-0"
         style={{ scrollbarWidth: "none" }}>
      {tiles.map((c) => (
        <Link key={c.label} href={c.href}
              className="ux-card ux-sq w-[172px] shrink-0 rounded-[16px] p-4 lg:w-auto"
              style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
          <span className="flex items-center gap-2.5">
            <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[12px]"
                  style={{ background: `var(${c.tint})`, color: `var(${c.ink})` }}>
              <Ico name={c.icon} className="h-[17px] w-[17px]" />
            </span>
            {/* Wraps rather than truncates. A label clipped to "Total Bala…"
                is worse than one that takes a second line. */}
            <span className="text-xs font-semibold leading-tight" style={{ color: "var(--ux-ink-2)" }}>
              {c.label}
            </span>
          </span>
          {c.gone ? (
            <span className="mt-3 block text-xsm font-semibold leading-tight" style={{ color: "var(--ux-muted)" }}>
              Could not load
            </span>
          ) : (
            <span className="mt-3 block text-xl font-bold leading-none tracking-[-0.03em] tabular-nums"
                  style={{ color: "var(--ux-ink)" }}>
              {c.value}
            </span>
          )}
          <span className="mt-2 flex items-center justify-between gap-2">
            <span className="text-2xs" style={{ color: "var(--ux-muted)" }}>
              {c.gone ? "Try again in a moment" : c.note}
            </span>
            {!c.gone && c.delta !== null && c.delta !== undefined && (
              <span className="flex items-center gap-1 text-2xs font-bold" style={{ color: "var(--ux-green-ink)" }}>
                <Ico name={c.delta >= 0 ? "TrendingUp" : "TrendingDown"} className="h-[11px] w-[11px]" />
                {c.delta >= 0 ? "+" : ""}{c.delta}%
              </span>
            )}
          </span>
        </Link>
      ))}
    </div>
  );
}

/* ── quick access ──────────────────────────────────────────────────────── */

/**
 * Navigation, not data — which is why it is a constant and stays one.
 *
 * These six are destinations the app has whether or not she has used them; a
 * request to find out that /app/wallet exists would be a request for nothing.
 */
const TILES = [
  { icon: "UsersRound", label: "My Circles", sub: "Your people, your strength", tint: "--ux-tint-pink", ink: "--ux-pink-ink", href: "/app/circles" },
  { icon: "PiggyBank", label: "Savings Pot", sub: "Save small, dream big", tint: "--ux-tint-violet", ink: "--ux-violet-ink", href: "/app/circles" },
  { icon: "HeartHandshake", label: "Care Circle", sub: "Support when you need it", tint: "--ux-tint-blue", ink: "--ux-blue-ink", href: "/app/family" },
  { icon: "Store", label: "My Shop", sub: "Sell your products", tint: "--ux-tint-amber", ink: "--ux-amber-ink", href: "/app/documents" },
  { icon: "ShoppingBasket", label: "Market", sub: "Buy & sell in your community", tint: "--ux-tint-green", ink: "--ux-green-ink", href: "/app/market" },
  { icon: "Wallet", label: "Wallet", sub: "Your money, your control", tint: "--ux-tint-lilac", ink: "--ux-violet-ink", href: "/app/wallet" },
] as const;

function QuickAccess() {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold tracking-tight" style={{ color: "var(--ux-ink)" }}>Quick Access</h2>
        <div className="flex items-center gap-2">
          <Link href="/app/explore"
                className="ux-hov -my-2 flex min-h-[40px] items-center gap-1.5 py-2 text-xs font-semibold"
                style={{ color: "var(--ux-brand)" }}>
            View all 30+ modules
            <Icons.ChevronRight className="h-[14px] w-[14px]" />
          </Link>
          <Link href="/app/settings/appearance"
                className="ux-hov -my-2 flex min-h-[40px] items-center gap-1.5 rounded-[12px] px-3 py-2 text-xs font-semibold"
                style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line)", color: "var(--ux-muted)" }}>
            <Icons.LayoutGrid className="h-[14px] w-[14px]" />
            Customize
            <Icons.ChevronDown className="h-[13px] w-[13px]" />
          </Link>
        </div>
      </div>
      <div className="@container">
      <div className="grid grid-cols-2 gap-3 @lg:grid-cols-3 @3xl:grid-cols-6">
        {TILES.map((t) => (
          <Link key={t.label} href={t.href}
                className="ux-card ux-tile ux-sq flex min-h-[132px] flex-col rounded-[16px] p-4"
                style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)",
                         ["--ux-glow" as string]: `color-mix(in oklab, var(${t.ink}) 26%, transparent)` }}>
            <span className="ux-tile-ic grid h-[44px] w-[44px] place-items-center rounded-[12px]"
                  style={{ background: `var(${t.tint})`, color: `var(${t.ink})` }}>
              <Ico name={t.icon} className="h-[21px] w-[21px]" />
            </span>
            <span className="mt-auto block pt-3 text-sm font-bold" style={{ color: "var(--ux-ink)" }}>{t.label}</span>
            <span className="mt-0.5 block text-2xs leading-snug" style={{ color: "var(--ux-muted)" }}>{t.sub}</span>
          </Link>
        ))}
      </div>
      </div>
    </section>
  );
}

/* ── panel 1 · today's activities ──────────────────────────────────────── */

/**
 * Composed from four of the blocks in the same request, not from one feed.
 *
 * The notifications block alone was the obvious source and the wrong one: this
 * account's rows carry the same generic title six times over, so the panel
 * rendered "We've got your alert" four times — technically live, and useless to
 * read. One row each from her calendar, her savings round, the community and
 * her notifications gives the four distinct lines the design is shaped around,
 * and each is drawn from the block that owns it.
 */
function Activities({ h }: { h: ApiHome }) {
  const circles = rowsOf<HomeCircle>(h.circles);
  const stories = rowsOf<HomeStory>(h.stories);
  const notes = rowsOf<HomeNote>(h.notifications);

  const pot = circles.find((c) => c.joined && c.is_savings && c.round > 0);
  const next = h.upcoming[0];
  const story = stories[0];
  // The newest notification that is not the generic safety receipt every row
  // above it already is. When they are all the same, one of them is still worth
  // a line; four of them is not.
  const note = notes[0];

  type Row = { id: string; icon: string; tint: string; ink: string;
               title: string; body: string; when: string; href: string };
  const rows: Row[] = [];

  if (next) rows.push({
    id: `u-${next.id}`, icon: "CalendarCheck", tint: "--ux-tint-violet", ink: "--ux-violet-ink",
    title: next.title || "Session booked",
    body: next.with_whom || (next.mode ? next.mode[0].toUpperCase() + next.mode.slice(1) : "")
          || "With your circle",
    when: [`${next.day} ${next.month}`, clock(next.time)].filter(Boolean).join(" · "),
    href: next.href || "/app/schedule",
  });
  if (pot) rows.push({
    id: `p-${pot.id}`, icon: "PiggyBank", tint: "--ux-tint-green", ink: "--ux-green-ink",
    title: "Savings round paid",
    body: `${formatRupees(pot.monthly_minor)} into ${pot.name}`,
    when: `Round ${pot.round}`, href: "/app/circles",
  });
  if (story) rows.push({
    id: `s-${story.id}`, icon: "MessageCircle", tint: "--ux-tint-blue", ink: "--ux-blue-ink",
    title: `${story.author_name} shared a story`,
    body: (story.title || story.body || "").slice(0, 46),
    when: story.when || "", href: `/app/stories/${story.id}`,
  });
  if (note) rows.push({
    id: `n-${note.id}`, icon: note.icon || "Bell", tint: "--ux-tint-orange", ink: "--ux-orange-ink",
    title: note.title, body: (note.body || "").slice(0, 46),
    when: note.when || "", href: note.href || "/app/notifications",
  });

  // Everything this panel draws from failed, rather than everything being
  // empty. Those are different sentences and she can tell them apart.
  const allGone = ["summary", "events", "circles", "stories", "notifications"]
    .every((b) => lost(h, b));

  return (
    <Panel>
      <PanelHead title="Today's Activities" action="View All" href="/app/notifications" />
      {allGone ? <Gone what="your activity" /> : rows.length === 0 ? (
        <p className="py-5 text-xsm" style={{ color: "var(--ux-muted)" }}>
          Nothing yet today. Bookings, circle news and messages land here.
        </p>
      ) : (
        <ul className="-mx-1.5 space-y-0.5">
          {rows.slice(0, 4).map((r) => (
            <li key={r.id}>
              <Link href={r.href} className="ux-row flex items-start gap-3 rounded-[12px] p-2.5">
                <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[12px]"
                      style={{ background: `var(${r.tint})`, color: `var(${r.ink})` }}>
                  <Ico name={r.icon} className="h-[16px] w-[16px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xsm font-semibold leading-snug" style={{ color: "var(--ux-ink)" }}>
                    {r.title}
                  </span>
                  {/* Body and time on one meta line under the title. Ranged
                      across the row they left the title ~140px and it broke
                      over two lines on every entry. */}
                  <span className="mt-1 block truncate text-2xs" style={{ color: "var(--ux-muted)" }}>
                    {[r.body, r.when].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ── panel 2 · her savings pot, in the challenge card's shape ──────────── */

/**
 * The one place on this screen that states her savings total.
 *
 * The figure row used to print the same number 200px above this, computed from
 * the same two fields. The panel kept it because the panel is the one that says
 * what it means — the share, the round, the women, and what the pot is worth
 * when everyone has paid.
 *
 * The row of six avatars that used to sit here has gone to the rail, which has
 * a card whose subject IS the members. Both stacks drew the same six
 * illustrations from two hand-copied arrays, and a copied array drifts.
 */
function Pot({ h }: { h: ApiHome }) {
  const pot = rowsOf<HomeCircle>(h.circles).find((c) => c.joined && c.is_savings);

  if (lost(h, "circles")) {
    return (
      <Panel>
        <PanelHead title="Your Savings Pot" action="All Circles" href="/app/circles" />
        <Gone what="your circles" />
      </Panel>
    );
  }

  if (!pot) {
    return (
      <Panel>
        <PanelHead title="Your Savings Pot" action="All Circles" href="/app/circles" />
        <p className="text-xsm leading-relaxed" style={{ color: "var(--ux-muted)" }}>
          A pot is a group of women who each put in the same amount every month, and
          take turns receiving it. Join one, or start one with women you trust.
        </p>
        <Link href="/app/circles"
              className="ux-press mt-auto flex min-h-[42px] items-center justify-center gap-2 rounded-[12px] pt-0 text-xsm font-bold"
              style={{ background: "linear-gradient(96deg, var(--ux-fill), var(--ux-fill-2))", color: "var(--ux-on-brand)" }}>
          Find a circle
          <Icons.ArrowRight className="h-4 w-4" />
        </Link>
      </Panel>
    );
  }

  const put = pot.monthly_minor * pot.round;
  const full = pot.monthly_minor * pot.member_count;
  const pct = full > 0 ? Math.min(100, Math.round((put * 100) / full)) : 0;

  return (
    <Panel>
      <PanelHead title="Your Savings Pot" action="All Circles" href="/app/circles" />
      <div className="flex items-start gap-3">
        <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[12px]"
              style={{ background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }}>
          <Icons.PiggyBank className="h-[17px] w-[17px]" strokeWidth={1.9} />
        </span>
        {/* The pill used to sit beside the name and cut it to "Tailoring &
            Sti…". It reads as one more fact about the pot, so it goes on the
            meta line with the others and the name keeps the row. */}
        <span className="min-w-0 flex-1">
          <span className="block text-xsm font-bold leading-snug" style={{ color: "var(--ux-ink)" }}>
            {pot.name}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-2xs"
                style={{ color: "var(--ux-muted)" }}>
            {formatRupees(pot.monthly_minor)} a month · {pot.member_count} women
            <span className="rounded-full px-2 py-[2px] text-2xs font-bold uppercase tracking-wider"
                  style={{ background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }}>
              Round {pot.round}
            </span>
          </span>
        </span>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs" style={{ color: "var(--ux-muted)" }}>You have put in</span>
          <span className="text-xs font-bold" style={{ color: "var(--ux-green-ink)" }}>{pct}%</span>
        </div>
        <p className="mt-1.5 text-lg font-bold tabular-nums" style={{ color: "var(--ux-ink)" }}>
          {formatRupees(put)}{" "}
          <span className="text-xsm font-semibold" style={{ color: "var(--ux-muted)" }}>/ {formatRupees(full)}</span>
        </p>
        <div className="mt-2.5 h-[9px] w-full overflow-hidden rounded-full" style={{ background: "var(--ux-track)" }}>
          <div className="h-full rounded-full"
               style={{ width: `${pct}%`,
                        background: "linear-gradient(90deg, var(--ux-rib-2), var(--ux-rib-3))",
                        transition: "width var(--ux-t-slow) var(--ux-ease-out)" }} />
        </div>
        <p className="mt-2.5 text-2xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>
          The full pot is what it is worth when every woman in it has paid this round.
        </p>
      </div>

      {/* Whose turn it is, and who has paid this round, are the two things a
          real chit needs and this database does not store yet — so they are not
          claimed. */}
      <Link href={`/app/circles/${pot.id}`}
            className="ux-press ux-btn-g mt-auto flex min-h-[42px] items-center justify-center gap-2 rounded-[12px] text-xsm font-bold"
            style={{ background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))", color: "var(--ux-on-brand)" }}>
        Open this circle
        <Icons.ArrowRight className="h-4 w-4" />
      </Link>
    </Panel>
  );
}

/* ── panel 3 · community feed ──────────────────────────────────────────── */

function Feed({ h }: { h: ApiHome }) {
  const stories = rowsOf<HomeStory>(h.stories);
  const [lead, ...rest] = stories;

  if (lost(h, "stories")) {
    return (
      <Panel>
        <PanelHead title="Community Feed" action="View All" href="/app/stories" />
        <Gone what="the community feed" />
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelHead title="Community Feed" action="View All" href="/app/stories" />
      {!lead ? (
        <p className="py-5 text-xsm" style={{ color: "var(--ux-muted)" }}>
          Stories from women in your circles will appear here.
        </p>
      ) : (
        <>
          <Link href={`/app/stories/${lead.id}`} className="ux-hov block">
            <div className="flex items-center gap-3">
              {/* Guarded: `<img src="">` makes the browser re-request the whole
                  page and then fail to decode it as an image. */}
              {lead.author_avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img loading="lazy" decoding="async" src={lead.author_avatar} alt="" className="h-[36px] w-[36px] shrink-0 rounded-full object-cover" />
              ) : (
                <span className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-full text-xsm font-bold"
                      style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }} aria-hidden>
                  {(lead.author_name || "?").trim().charAt(0).toUpperCase()}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xsm font-bold" style={{ color: "var(--ux-ink)" }}>{lead.author_name}</span>
                <span className="block truncate text-2xs" style={{ color: "var(--ux-muted)" }}>
                  {lead.when || lead.program || "In your circles"}
                </span>
              </span>
            </div>
            <p className="mt-3 text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              {(lead.title || lead.body || "").slice(0, 170)}
            </p>
            {lead.cover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img loading="lazy" decoding="async" src={lead.cover} alt="" className="mt-3 h-[120px] w-full rounded-[12px] object-cover" />
            )}
            <div className="mt-3 flex gap-4 text-xs font-semibold" style={{ color: "var(--ux-muted)" }}>
              <span className="flex items-center gap-1.5"><Icons.Heart className="h-[14px] w-[14px]" />{lead.likes ?? 0}</span>
              <span className="flex items-center gap-1.5"><Icons.MessageCircle className="h-[14px] w-[14px]" />Comment</span>
              <span className="flex items-center gap-1.5"><Icons.Share2 className="h-[14px] w-[14px]" />Share</span>
            </div>
          </Link>

          {/* The lead story alone left this column half empty beside two packed
              ones. The next few go underneath as one-liners — real content
              rather than a spacer. */}
          {rest.length > 0 && (
            <ul className="mt-4 space-y-0.5 border-t pt-3" style={{ borderColor: "var(--ux-line)" }}>
              {rest.slice(0, 3).map((s) => (
                <li key={s.id}>
                  <Link href={`/app/stories/${s.id}`} className="ux-row -mx-1.5 flex items-center gap-2.5 rounded-[12px] px-1.5 py-2">
                    {s.author_avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img loading="lazy" decoding="async" src={s.author_avatar} alt="" className="h-[26px] w-[26px] shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full text-2xs font-bold"
                            style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }} aria-hidden>
                        {(s.author_name || "?").trim().charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold" style={{ color: "var(--ux-ink)" }}>
                        {s.author_name}
                      </span>
                      <span className="block truncate text-2xs" style={{ color: "var(--ux-muted)" }}>
                        {(s.title || s.body || "").slice(0, 44)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Panel>
  );
}

/* ── the closing strip ─────────────────────────────────────────────────── */

function Strip() {
  return (
    <section className="relative overflow-hidden rounded-[20px] p-6 sm:p-7"
             style={{ background: "linear-gradient(100deg, var(--ux-brand-900), var(--ux-fill) 48%, var(--ux-rib-3) 128%)" }}>
      <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img loading="lazy" decoding="async" src="/ux/art/scene-women-group-circle.webp" alt="" aria-hidden
             className="hidden w-[180px] shrink-0 sm:block"
             style={{ maskImage: "radial-gradient(72% 76% at 50% 50%, #000 58%, transparent 92%)",
                      WebkitMaskImage: "radial-gradient(72% 76% at 50% 50%, #000 58%, transparent 92%)" }} />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-extrabold tracking-[-0.02em]" style={{ color: "var(--ux-on-brand)" }}>
            Explore. Connect. Grow.
          </h2>
          <p className="mt-1.5 max-w-[46ch] text-xsm" style={{ color: "var(--ux-on-brand-2)" }}>
            Access every module built to support you at each step of your journey.
          </p>
        </div>
        <Link href="/app/explore"
              className="ux-press ux-btn-g flex min-h-[46px] shrink-0 items-center gap-2 rounded-[12px] px-5 text-xsm font-bold"
              style={{ background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))", color: "var(--ux-on-brand)" }}>
          Explore All Modules
          <Icons.ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

/* ── waiting, and failing ──────────────────────────────────────────────── */

/**
 * The first load only.
 *
 * `useResource` holds the last good value across a refetch, so this is never
 * seen again once the screen has data — coming back to the tab redraws the
 * figures she was already looking at rather than flashing them all to grey.
 *
 * It stands in for the body beneath the hero rather than the whole page: the
 * hero needs no request, so painting it immediately is the difference between a
 * slow app and a blank one. The route-level `AppSkeleton` draws the same shapes
 * for the moment before this component's own code has arrived.
 */
function BodySkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-live="polite">
      <span className="sr-only">Loading your home screen…</span>
      <div className="ux-sq rounded-[20px] p-6" style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
        <Skeleton w={112} h={11} />
        <Skeleton w="46%" h={30} r={10} className="mt-4" />
        <Skeleton w="72%" h={13} className="mt-5" />
        <Skeleton w={196} h={46} r={12} className="mt-6" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="ux-sq rounded-[16px] p-4"
               style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
            <div className="flex items-center gap-2.5">
              <Skeleton w={34} h={34} r={12} />
              <Skeleton w="58%" h={11} />
            </div>
            <Skeleton w="52%" h={20} r={8} className="mt-3" />
            <Skeleton w="70%" h={10} className="mt-3" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="ux-sq rounded-[16px] p-5"
               style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)", minHeight: 280 }}>
            <Skeleton w="46%" h={14} />
            <div className="mt-5 flex flex-col gap-3.5">
              {[0, 1, 2, 3].map((j) => (
                <div key={j} className="flex items-start gap-3">
                  <Skeleton w={34} h={34} r={12} />
                  <div className="min-w-0 flex-1">
                    <Skeleton w="82%" h={12} />
                    <Skeleton w="54%" h={10} className="mt-2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The request came back with nothing.
 *
 * `useHome` catches its own error and resolves `null`, so a failure arrives
 * looking like a successful empty answer — which is why this is keyed on the
 * data being absent after loading has finished, and not on `error`. She gets a
 * reason and a button, never a spinner that will not resolve.
 */
function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="ux-sq rounded-[16px] p-6 text-center"
             style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
      <span className="mx-auto grid h-[48px] w-[48px] place-items-center rounded-full"
            style={{ background: "var(--ux-surface-2)", color: "var(--ux-muted)" }}>
        <Icons.CloudOff className="h-5 w-5" />
      </span>
      <h2 className="mt-3.5 text-sm font-bold" style={{ color: "var(--ux-ink)" }}>
        We could not load your home screen
      </h2>
      <p className="mx-auto mt-1.5 max-w-[42ch] text-xsm leading-relaxed" style={{ color: "var(--ux-muted)" }}>
        Your money, your circles and your bookings are all safe — this is the app
        failing to fetch them, not anything changing.
      </p>
      <button type="button" onClick={onRetry}
              className="ux-press ux-btn-g mt-4 inline-flex min-h-[42px] items-center gap-2 rounded-[12px] px-5 text-xsm font-bold"
              style={{ background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))", color: "var(--ux-on-brand)" }}>
        <Icons.RefreshCw className="h-4 w-4" />
        Try again
      </button>
    </section>
  );
}

/* ── the screen ────────────────────────────────────────────────────────── */

export function Dashboard() {
  const { user } = useAuth();
  // One request for the whole screen. Thirteen blocks, gathered server-side.
  const { data: home, source, refetch } = useHome();

  /**
   * "Put this aside for now", made to mean it.
   *
   * This was `useState(false)`. The card went away and came straight back on
   * the next load, because nothing was ever written down — a control whose
   * label promises "for now" and delivers "for ten seconds".
   *
   * The href of the dismissed step is held here only until the next `/me/home`
   * comes back with it already gone; the server is what remembers. Optimistic,
   * and it puts the card back if the write failed, because a card that went
   * away and did not stay away is at least honest about it.
   */
  const [aside, setAside] = useState<string | null>(null);
  const putAside = useCallback((href: string) => {
    setAside(href);
    apiDismissNextStep(href).catch(() => setAside((a) => (a === href ? null : a)));
  }, []);

  // Her name off the session when the request has not landed yet, so the
  // greeting is right in the first frame rather than a beat later.
  const first = home?.me.first || (user?.full_name || "").trim().split(" ")[0] || "";

  return (
    <div className="flex flex-col gap-4" data-dashboard="home">
      <h1 className="sr-only">Your WomSakhi home</h1>
      <Hero first={first} />

      {!home ? (
        source === "loading" ? <BodySkeleton /> : <LoadFailed onRetry={refetch} />
      ) : (
        <>
          {/* Above the numbers, deliberately: the numbers describe where she has
              been and this says where to go. */}
          {home.next_step && aside !== home.next_step.href && (
            <NextUp h={home} onDismiss={() => putAside(home.next_step!.href)} />
          )}
          <Journey h={home} />
          <Stats h={home} />
          <QuickAccess />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Activities h={home} />
            <Pot h={home} />
            <Feed h={home} />
          </div>
          <Strip />
        </>
      )}
    </div>
  );
}
