"use client";

import { useGreeting } from "@/lib/use-greeting";
import { useMemo, useState } from "react";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import { useAuth } from "@/context/AuthContext";
import { NextStepCard, JourneyTrack } from "@/components/ux/journey/NextStepCard";
import { readJourneyState } from "@/services/me.repository";
import { nextStep, stageFor } from "@/services/journey";
import { useSummary, useCircles, useStories } from "@/components/ux/live";
import { useOrders } from "@/components/ux/business";
import { formatMoney } from "@/components/ux/kit/money";

/**
 * Home, built to the approved dashboard design.
 *
 * ── What is faithful, and what had to change ────────────────────────────────
 * The layout, the type scale, the gradient hero, the five-figure row, the
 * seven Quick Access tiles, the three panels and the closing strip are the
 * design as drawn. Two things could not be copied straight across, and both
 * for the same reason — the design shows numbers this product does not have:
 *
 *   **Trust Score 850** has no endpoint, no model and no agreed formula. Its
 *   slot now carries earnings this month, which is counted server-side *and*
 *   is the only figure here with a real month-on-month comparison behind it.
 *
 *   **Together Challenges** is not a module that exists. Her savings pot took
 *   the slot: same shape — a goal, a bar, the women in it — and every number
 *   in it is real.
 *
 * The deltas are the other quiet change. The design puts a green "+12%" on
 * every card; only earnings has a previous month stored to compare against, so
 * only earnings shows one. A row of invented percentages is the fastest way to
 * make a dashboard untrustworthy.
 */

const AVATARS = ["blazer","blue-saree","elder-saree","hijab","pink-glasses","purple-kurta"] as const;

function Ico({ name, className, sw = 1.9 }: { name: string; className?: string; sw?: number }) {
  const C = (Icons as unknown as Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>>)[name]
    ?? Icons.Circle;
  return <C className={className} strokeWidth={sw} />;
}

/** "Today · 9:00 AM" · "Tomorrow" · "Wed 16 Sept". */
function whenShort(dateIso: string, time?: string): string {
  const parts: string[] = [];
  if (dateIso) {
    const d = new Date(`${dateIso}T00:00:00`);
    if (!Number.isNaN(d.getTime())) {
      const mid = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
      const days = Math.round((mid(d) - mid(new Date())) / 86_400_000);
      parts.push(days === 0 ? "Today" : days === 1 ? "Tomorrow"
        // en-GB: day before month. Most of the world does not write "Sep 16".
        : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(d));
    }
  }
  if (time) parts.push(clock(time));
  return parts.join(" · ");
}

/** "09:00" -> "9:00 AM". The server stores 24-hour; nobody reads it that way. */
export function clock(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h)) return time;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m ?? 0).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

function PanelHead({ title, action, href }: { title: string; action: string; href: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-bold tracking-tight" style={{ color: "var(--ux-ink)" }}>{title}</h2>
      <Link href={href}
            className="ux-hov -my-2 flex min-h-[40px] shrink-0 items-center gap-1 py-2 text-xs font-semibold"
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

/* ── the five figures ──────────────────────────────────────────────────── */

function Stats() {
  const { data: summary } = useSummary();
  const { data: circles } = useCircles();
  const { data: orders } = useOrders();

  const money = summary?.money;
  const pots = circles.mine.filter((c) => c.kind === "Savings");
  const saved = pots.reduce((a, c) => a + (c.monthly_minor ?? 0) * (c.currentMonth ?? 0), 0);
  const last = money?.last_month_minor ?? 0;
  const earned = money?.earned_this_month_minor ?? 0;
  // Absent in her first month: a percentage of nothing is undefined, not zero.
  // A month that has not started is not a 100% collapse. Showing "₹0 ↓ −100%"
  // in red on the front page greets a woman on the 2nd with the news that her
  // business has failed — which is what the arithmetic says and not what is
  // true. No earnings yet means no comparison, so no delta.
  const delta = last > 0 && earned > 0 ? Math.round(((earned - last) / last) * 100) : null;

  const cards = [
    { icon: "Wallet", tint: "--ux-tint-violet", ink: "--ux-violet-ink", label: "Total Balance",
      value: formatMoney(money?.balance_minor ?? 0), note: "In Wallet", delta: null, href: "/app/wallet" },
    { icon: "TrendingUp", tint: "--ux-tint-green", ink: "--ux-green-ink", label: "Earned",
      value: formatMoney(earned), note: earned > 0 ? "This Month" : "Ask to be paid",
      delta, href: earned > 0 ? "/app/wallet" : "/app/collect" },
    { icon: "UsersRound", tint: "--ux-tint-pink", ink: "--ux-pink-ink", label: "My Circles",
      value: String(circles.mine.length), note: "Active Circles", delta: null, href: "/app/circles" },
    { icon: "PiggyBank", tint: "--ux-tint-lilac", ink: "--ux-violet-ink", label: "Savings Pot",
      value: formatMoney(saved), note: "Total Saved", delta: null, href: "/app/circles" },
    { icon: "Store", tint: "--ux-tint-amber", ink: "--ux-amber-ink", label: "My Shop",
      value: String(orders.length), note: "Total Orders", delta: null, href: "/app/documents" },
  ];

  return (
    // Scrolls sideways on a phone rather than crushing five cards to 70px each.
    <div className="-mx-[20px] flex gap-3 overflow-x-auto px-[20px] pb-1 lg:mx-0 lg:grid lg:grid-cols-5 lg:px-0"
         style={{ scrollbarWidth: "none" }}>
      {cards.map((c) => (
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
          <span className="mt-3 block text-xl font-bold leading-none tracking-[-0.03em] tabular-nums"
                style={{ color: "var(--ux-ink)" }}>
            {c.value}
          </span>
          <span className="mt-2 flex items-center justify-between gap-2">
            <span className="text-2xs" style={{ color: "var(--ux-muted)" }}>{c.note}</span>
            {c.delta !== null && (
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
 * Composed from four different real signals, not from one feed.
 *
 * The notifications endpoint was the obvious source and the wrong one: the
 * account's rows all carry the same generic title, so the panel rendered
 * "We've got your alert" four times — technically live data, and useless to
 * read. Taking one row each from orders, the savings pot, the calendar and
 * the circle gives the four distinct lines the design is shaped around, and
 * every one of them is still counted server-side.
 */
function Activities() {
  const { data: orders } = useOrders();
  const { data: circles } = useCircles();
  const { data: summary } = useSummary();
  const { data: stories } = useStories();

  const pot = circles.mine.filter((c) => c.kind === "Savings")[0];
  const booking = (summary?.upcoming_bookings ?? [])[0];
  const order = orders[0];
  const story = stories?.[0];

  type Row = { id: string; icon: string; tint: string; ink: string; title: string; body: string; when: string };
  const rows: Row[] = [];

  if (order) rows.push({
    id: `o-${order.id}`, icon: "Package", tint: "--ux-tint-amber", ink: "--ux-amber-ink",
    title: order.purpose || "New order in My Shop",
    body: `${formatMoney(order.amount_minor)} · ${order.method}`, when: order.when,
  });
  if (pot?.currentMonth) rows.push({
    id: `p-${pot.id}`, icon: "PiggyBank", tint: "--ux-tint-green", ink: "--ux-green-ink",
    title: "Savings round paid",
    body: `${formatMoney(pot.monthly_minor ?? 0)} into ${pot.name}`, when: `Round ${pot.currentMonth}`,
  });
  if (booking) rows.push({
    id: `b-${booking.id}`, icon: "CalendarCheck", tint: "--ux-tint-violet", ink: "--ux-violet-ink",
    title: booking.service_name || "Session booked",
    body: booking.with_whom || "With your circle", when: whenShort(booking.date, booking.time),
  });
  if (story) rows.push({
    id: `s-${story.id}`, icon: "MessageCircle", tint: "--ux-tint-blue", ink: "--ux-blue-ink",
    title: `${story.name} shared a story`,
    body: (story.quote || story.body || "").slice(0, 46), when: story.since || "",
  });

  return (
    <Panel>
      <PanelHead title="Today's Activities" action="View All" href="/app/notifications" />
      {rows.length === 0 ? (
        <p className="py-5 text-xsm" style={{ color: "var(--ux-muted)" }}>
          Nothing yet today. Orders, circle news and messages land here.
        </p>
      ) : (
        <ul className="-mx-1.5 space-y-0.5">
          {rows.slice(0, 4).map((r) => (
            <li key={r.id}>
              <Link href="/app/notifications" className="ux-row flex items-start gap-3 rounded-[12px] p-2.5">
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

function Pot() {
  const { data: circles } = useCircles();
  const pot = circles.mine.filter((c) => c.kind === "Savings")[0];

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

  const put = (pot.monthly_minor ?? 0) * (pot.currentMonth ?? 0);
  const full = (pot.monthly_minor ?? 0) * pot.members;
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
            {formatMoney(pot.monthly_minor ?? 0)} a month · {pot.members} women
            <span className="rounded-full px-2 py-[2px] text-2xs font-bold uppercase tracking-wider"
                  style={{ background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }}>
              Round {pot.currentMonth || 0}
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
          {formatMoney(put)}{" "}
          <span className="text-xsm font-semibold" style={{ color: "var(--ux-muted)" }}>/ {formatMoney(full)}</span>
        </p>
        <div className="mt-2.5 h-[9px] w-full overflow-hidden rounded-full" style={{ background: "var(--ux-track)" }}>
          <div className="h-full rounded-full"
               style={{ width: `${pct}%`,
                        background: "linear-gradient(90deg, var(--ux-rib-2), var(--ux-rib-3))",
                        transition: "width var(--ux-t-slow) var(--ux-ease-out)" }} />
        </div>
      </div>

      <div className="mt-4 flex items-center">
        {AVATARS.map((n, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img loading="lazy" decoding="async" key={n} src={`/ux/art/avatar-woman-${n}.webp`} alt=""
               className="h-[26px] w-[26px] rounded-full object-cover"
               style={{ border: "2px solid var(--ux-surface)", marginLeft: i ? -8 : 0 }} />
        ))}
        {pot.members > 6 && (
          <span className="grid h-[26px] w-[26px] place-items-center rounded-full text-2xs font-bold"
                style={{ background: "var(--ux-surface-2)", border: "2px solid var(--ux-surface)",
                         color: "var(--ux-muted)", marginLeft: -8 }}>
            +{pot.members - 6}
          </span>
        )}
        <span className="ms-2.5 text-2xs font-semibold" style={{ color: "var(--ux-muted)" }}>
          {pot.members} women in this pot
        </span>
      </div>

      {/* The full pot is what it is worth when everyone has paid. Whose turn it
          is, and who has paid this round, are the two things a real chit needs
          and this app does not store yet — so they are not claimed. */}
      <Link href={`/app/circles/${pot.id}`}
            className="ux-press ux-btn-g mt-4 flex min-h-[42px] items-center justify-center gap-2 rounded-[12px] text-xsm font-bold"
            style={{ background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))", color: "var(--ux-on-brand)" }}>
        Open this circle
        <Icons.ArrowRight className="h-4 w-4" />
      </Link>
    </Panel>
  );
}

/* ── panel 3 · community feed ──────────────────────────────────────────── */

function Feed() {
  const { data: stories } = useStories();
  const [lead, ...rest] = stories ?? [];

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
              {/* Guarded: `<img loading="lazy" decoding="async" src="">` makes the browser re-request the whole
                  page and then fail to decode it as an image. */}
              {lead.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img loading="lazy" decoding="async" src={lead.avatar} alt="" className="h-[36px] w-[36px] shrink-0 rounded-full object-cover" />
              ) : (
                <span className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-full text-xsm font-bold"
                      style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }} aria-hidden>
                  {(lead.name || "?").trim().charAt(0).toUpperCase()}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xsm font-bold" style={{ color: "var(--ux-ink)" }}>{lead.name}</span>
                <span className="block truncate text-2xs" style={{ color: "var(--ux-muted)" }}>
                  {lead.since || lead.program || "In your circles"}
                </span>
              </span>
            </div>
            <p className="mt-3 text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              {(lead.quote || lead.body || "").slice(0, 170)}
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
                    {s.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img loading="lazy" decoding="async" src={s.avatar} alt="" className="h-[26px] w-[26px] shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full text-2xs font-bold"
                            style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }} aria-hidden>
                        {(s.name || "?").trim().charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold" style={{ color: "var(--ux-ink)" }}>
                        {s.name}
                      </span>
                      <span className="block truncate text-2xs" style={{ color: "var(--ux-muted)" }}>
                        {(s.quote || s.body || "").slice(0, 44)}
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

/* ── the screen ────────────────────────────────────────────────────────── */

export function Dashboard() {
  const { user } = useAuth();
  const first = (user?.full_name || "").trim().split(" ")[0];

  // One question, answered once, from the same engine My Journey uses. Home
  // used to open with a hero and then five stat tiles and then seven shortcut
  // tiles — eighteen equally-weighted things, which asks a woman with twenty
  // minutes to audit her own life and choose. This answers instead of asking.
  const state = useMemo(() => readJourneyState(), []);
  const step = useMemo(() => nextStep(state), [state]);
  const stage = useMemo(() => stageFor(state), [state]);
  const [stepAside, setStepAside] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <Hero first={first} />

      {/* Above the numbers, deliberately: the numbers describe where she has
          been and this says where to go. */}
      {!stepAside && (
        <>
          <NextStepCard step={step} at={stage} onDismiss={() => setStepAside(true)} />
          <section className="ux-sq rounded-[16px] p-5"
                   style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
            <PanelHead title="Your journey" action="See all seven steps" href="/app/journey" />
            <JourneyTrack current={stage} />
          </section>
        </>
      )}

      <Stats />
      <QuickAccess />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Activities />
        <Pot />
        <Feed />
      </div>
      <Strip />
    </div>
  );
}
