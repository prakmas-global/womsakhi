"use client";

import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import { useAuth } from "@/context/AuthContext";
import { useSummary } from "@/components/ux/live";
import { useCircles } from "@/components/ux/live";
import { formatMoney } from "@/components/ux/kit/money";

/**
 * Home.
 *
 * ── What this screen is for ─────────────────────────────────────────────────
 * One question: **what needs her today, and what is her money doing.**
 *
 * That is the whole brief, and it is why almost everything that used to be
 * here has gone. The old home was a dashboard — a hero, three panels, six
 * shortcut tiles, four list cards and a five-card sidebar — twenty-odd things
 * competing, none of them answering a question. A woman opening this on a
 * three-minute break does not want a dashboard. She wants to know whether
 * anything is waiting on her, and whether she is earning.
 *
 * So: her money, what is happening today, the two ways to earn, and her
 * circle. Everything else lives in the section it belongs to and is one tap
 * away from the bar at the bottom.
 *
 * ── Nothing here is invented ────────────────────────────────────────────────
 * Every figure comes from `/me/summary`, counted off the ledger. Where the
 * server does not know something, this screen does not say it — there is no
 * "₹4,200 pending from BrandStory" from a client that does not exist, and no
 * "ahead of 68% of women in your circle" from a ranking nothing computes.
 *
 * A section with nothing in it does not render. An empty heading with a gap
 * under it is worse than no heading.
 */

/**
 * "Today · 9:00 AM", "Tomorrow · 11:00 AM", "Wed 16 Sep · 9:00 AM".
 *
 * The screen showed `2026-09-16 · 09:00` — a database row, printed at a woman
 * who wants to know whether it is today. Relative first, because "in three
 * days" is what she is actually working out, and the date only when relative
 * stops being useful.
 */
function whenLabel(dateIso: string, time: string): string {
  const parts: string[] = [];
  if (dateIso) {
    const d = new Date(`${dateIso}T00:00:00`);
    if (!Number.isNaN(d.getTime())) {
      const midnight = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
      const days = Math.round((midnight(d) - midnight(new Date())) / 86_400_000);
      parts.push(
        days === 0 ? "Today"
        : days === 1 ? "Tomorrow"
        : days > 1 && days < 7 ? `In ${days} days`
        // en-GB, not en: day before month. "Sep 16" is US order, and this app
        // is for India, Africa, Latin America and Asia, where it reads wrong.
        : new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(d),
      );
    } else {
      parts.push(dateIso);
    }
  }
  if (time) {
    // "09:00" → "9:00 AM". A 24-hour clock is not how most people say a time.
    const [h, m] = time.split(":").map(Number);
    if (Number.isFinite(h)) {
      const suffix = h < 12 ? "AM" : "PM";
      const hour12 = h % 12 === 0 ? 12 : h % 12;
      parts.push(`${hour12}:${String(m ?? 0).padStart(2, "0")} ${suffix}`);
    } else {
      parts.push(time);
    }
  }
  return parts.join(" · ");
}

/** True when the first thing in the list is actually today. */
function isToday(dateIso: string): boolean {
  if (!dateIso) return false;
  const d = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  const n = new Date();
  return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Label above a number. Small, tracked, quiet — the number is the thing. */
function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.13em]" style={{ color: "var(--ux-faint)" }}>
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 mt-7 flex items-center gap-3">
      <h2 className="text-[0.75rem] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--ux-faint)" }}>
        {children}
      </h2>
      <span className="h-px flex-1" style={{ background: "var(--ux-line)" }} />
    </div>
  );
}

/**
 * Her money this month.
 *
 * The comparison line is guarded. It used to read "Infinity% more than last
 * month" whenever last month was zero — which is every woman's first month,
 * so the very first thing a new member was told about her earnings was a
 * division by zero. It now states the difference in rupees, and says nothing
 * at all when there is nothing to compare against.
 */
function Money() {
  const { data: summary } = useSummary();
  const m = summary?.money;
  const earned = m?.earned_this_month_minor ?? 0;
  const last = m?.last_month_minor ?? 0;
  const goal = m?.goal_minor ?? 0;
  const balance = m?.balance_minor ?? 0;
  const pending = m?.pending_minor ?? 0;
  const pct = goal > 0 ? Math.min(100, Math.round((earned / goal) * 100)) : 0;
  const diff = earned - last;

  const secondary = [
    balance > 0 ? { label: "In your wallet", value: balance } : null,
    pending > 0 ? { label: "On its way", value: pending } : null,
  ].filter(Boolean) as { label: string; value: number }[];

  return (
    <section
      className="ux-sq relative overflow-hidden rounded-[20px] p-5 sm:p-6"
      style={{
        background: "linear-gradient(146deg, oklch(0.34 0.13 294), oklch(0.46 0.18 300) 62%, oklch(0.52 0.18 322))",
      }}
    >
      {/*
        Stacked on a phone, two columns from `sm`.

        As one column it was a 720px-wide letterbox with every word crammed
        into the left 200px and half a card of empty gradient to the right —
        the layout of a phone screen stretched, which is not a desktop layout.
      */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
        <div className="min-w-0 flex-1">
          <Label><span style={{ color: "rgba(255,255,255,0.66)" }}>Earned this month</span></Label>
          <p className="mt-1.5 text-[2.25rem] font-bold leading-none tracking-tight text-white sm:text-[2.75rem]">
            {formatMoney(earned)}
          </p>

          {last > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-[0.8125rem]" style={{ color: "rgba(255,255,255,0.86)" }}>
              {diff >= 0
                ? <Icons.TrendingUp className="h-[15px] w-[15px]" strokeWidth={2.2} />
                : <Icons.TrendingDown className="h-[15px] w-[15px]" strokeWidth={2.2} />}
              {diff === 0
                ? "The same as last month"
                : `${formatMoney(Math.abs(diff))} ${diff > 0 ? "more" : "less"} than last month`}
            </p>
          )}

          {goal > 0 ? (
            <div className="mt-4 max-w-[340px]">
              <span className="block h-[6px] w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.22)" }}>
                <span className="block h-full rounded-full bg-white transition-[width] duration-700" style={{ width: `${pct}%` }} />
              </span>
              {/* Her label OR the amount, never both. She wrote "Earn 30,000 a
                  month", so appending "· ₹30,000" printed the figure twice. */}
              <p className="mt-2 text-[0.75rem]" style={{ color: "rgba(255,255,255,0.78)" }}>
                {pct}% of {m?.goal_label ? `\u201C${m.goal_label}\u201D` : `your ${formatMoney(goal)} goal`}
              </p>
            </div>
          ) : (
            // An invitation, not a blank. A goal is the one thing on this card
            // she can change, and most women have never been asked to set one.
            <Link
              href="/app/wallet"
              className="mt-4 inline-flex min-h-[38px] items-center gap-1.5 rounded-full px-3.5 text-[0.8125rem] font-semibold"
              style={{ background: "rgba(255,255,255,0.18)", color: "#fff" }}
            >
              Set a goal
              <Icons.ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {/*
          The other figures the ledger knows.

          Earned-this-month alone is the wrong amount of information on the one
          screen about her money: it answers "how am I doing" and not "what
          have I got" or "what is still coming". Both are counted server-side
          and were simply not shown.

          Each appears only when it is non-zero — "₹0 is on its way" invents a
          worry, and two zeros read like a broken card rather than a new member.
        */}
        {secondary.length > 0 && (
          <div
            className="flex gap-8 border-t pt-4 sm:shrink-0 sm:flex-col sm:gap-4 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0"
            style={{ borderColor: "rgba(255,255,255,0.20)" }}
          >
            {secondary.map((x) => (
              <div key={x.label}>
                <Label><span style={{ color: "rgba(255,255,255,0.60)" }}>{x.label}</span></Label>
                <p className="mt-1 whitespace-nowrap text-[1.125rem] font-bold leading-none text-white">
                  {formatMoney(x.value)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** What is actually happening today. Renders nothing when nothing is. */
function Today() {
  const { data: summary } = useSummary();
  const rows = (summary?.upcoming_bookings ?? []).slice(0, 3);
  if (!rows.length) return null;
  // "Today and next" over a list where nothing is today is a small lie that
  // makes her check the dates to see if she has missed something.
  const heading = rows.some((b) => isToday(b.date)) ? "Today" : "Coming up";

  return (
    <>
      <SectionTitle>{heading}</SectionTitle>
      <ul className="space-y-2">
        {rows.map((b) => (
          <li key={b.id}>
            <Link
              href={`/app/bookings/${b.id}`}
              className="ux-i ux-sq flex items-center gap-3.5 rounded-[12px] p-3.5"
              style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}
            >
              <span
                className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[12px]"
                style={{ background: "var(--ux-tint-violet)", color: "var(--ux-violet)" }}
              >
                <Icons.CalendarCheck className="h-[19px] w-[19px]" strokeWidth={1.9} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.875rem] font-semibold" style={{ color: "var(--ux-ink)" }}>
                  {b.service_name || "Session"}
                </span>
                <span className="mt-0.5 block truncate text-[0.75rem]" style={{ color: "var(--ux-muted)" }}>
                  {[whenLabel(b.date, b.time), b.with_whom].filter(Boolean).join(" · ")}
                </span>
              </span>
              <Icons.ChevronRight className="h-[18px] w-[18px] shrink-0" style={{ color: "var(--ux-faint)" }} />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * The two ways to earn here, given equal weight.
 *
 * They are the reason she came. The old home offered six shortcut tiles of
 * which these were two, sized the same as "Ask Sakhi" — so the product's
 * entire purpose was a third of a row of icons.
 */
function TwoDoors() {
  const doors = [
    { href: "/app/opportunities", label: "Find work", note: "Jobs, orders and freelance", icon: "Search",
      tint: "--ux-tint-blue", ink: "--ux-blue" },
    { href: "/app/documents", label: "Sell something", note: "Your own shop and orders", icon: "Store",
      tint: "--ux-tint-green", ink: "--ux-green" },
  ] as const;

  return (
    <>
      <SectionTitle>Ways to earn</SectionTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {doors.map((d) => {
          const I = (Icons as unknown as Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>>)[d.icon];
          return (
            <Link
              key={d.href}
              href={d.href}
              className="ux-i ux-sq flex items-center gap-3.5 rounded-[16px] p-4"
              style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}
            >
              <span className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[12px]"
                    style={{ background: `var(${d.tint})`, color: `var(${d.ink})` }}>
                <I className="h-[21px] w-[21px]" strokeWidth={1.9} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[1rem] font-semibold" style={{ color: "var(--ux-ink)" }}>{d.label}</span>
                <span className="mt-0.5 block text-[0.75rem]" style={{ color: "var(--ux-muted)" }}>{d.note}</span>
              </span>
              <Icons.ArrowRight className="h-[18px] w-[18px] shrink-0" style={{ color: "var(--ux-faint)" }} />
            </Link>
          );
        })}
      </div>
    </>
  );
}

/**
 * Her circle — the savings pots she is actually in.
 *
 * On the home screen because it is the spine of this product: the same women
 * she saves with are the women she sells to and the women who mind her
 * children. Only circles she has JOINED, and only ones that collect money —
 * a chat group is not something to report on a money screen.
 */
function YourCircle() {
  const { data: circles } = useCircles();
  // `mine` is already the joined ones. A pot is one that actually collects
  // money — the server says so; this used to be a regex on the name, which
  // gave a Pay button to "Savings tips" and withheld one from a bachat gat
  // called "Ladies Group".
  const pots = circles.mine.filter((c) => c.kind === "Savings").slice(0, 2);
  if (!pots.length) return null;

  return (
    <>
      <SectionTitle>Your circle</SectionTitle>
      <div className="space-y-2">
        {pots.map((c) => (
          <Link
            key={c.id}
            href={`/app/circles/${c.id}`}
            className="ux-i ux-sq flex items-center gap-3.5 rounded-[12px] p-4"
            style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}
          >
            <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[12px]"
                  style={{ background: "var(--ux-tint-pink)", color: "var(--ux-pink)" }}>
              <Icons.PiggyBank className="h-[19px] w-[19px]" strokeWidth={1.9} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.875rem] font-semibold" style={{ color: "var(--ux-ink)" }}>
                {c.name}
              </span>
              <span className="mt-0.5 block truncate text-[0.75rem]" style={{ color: "var(--ux-muted)" }}>
                {[
                  // Optional on the type, so guarded — a circle with no share
                  // set says nothing rather than "₹0 a month".
                  c.monthly_minor ? `${formatMoney(c.monthly_minor)} a month` : null,
                  c.currentMonth ? `round ${c.currentMonth}` : null,
                  // Not `plural()` — it appends "s" and gives "womans". The one word this
                  // app says most often is the one that helper gets wrong.
                  `${c.members} ${c.members === 1 ? "woman" : "women"}`,
                ].filter(Boolean).join(" · ")}
              </span>
            </span>
            <Icons.ChevronRight className="h-[18px] w-[18px] shrink-0" style={{ color: "var(--ux-faint)" }} />
          </Link>
        ))}
      </div>
    </>
  );
}

export function HomeToday() {
  const { user } = useAuth();
  const first = (user?.full_name || "").trim().split(" ")[0];

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <header className="mb-5">
        <p className="text-[0.8125rem]" style={{ color: "var(--ux-muted)" }}>{greeting()}</p>
        <h1 className="mt-0.5 text-[1.75rem] font-bold leading-tight tracking-tight" style={{ color: "var(--ux-ink)" }}>
          {first || "Welcome"}
        </h1>
      </header>

      <Money />
      <Today />
      <TwoDoors />
      <YourCircle />

      <Link
        href="/app/sakhi"
        className="ux-i ux-sq mt-7 flex items-center gap-3.5 rounded-[16px] p-4"
        style={{ background: "var(--ux-brand-tint)", border: "1px solid var(--ux-line)" }}
      >
        <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full"
              style={{ background: "var(--ux-surface)", color: "var(--ux-brand)" }}>
          <Icons.Sparkles className="h-[19px] w-[19px]" strokeWidth={1.9} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.875rem] font-semibold" style={{ color: "var(--ux-ink)" }}>Ask Sakhi</span>
          <span className="mt-0.5 block text-[0.75rem]" style={{ color: "var(--ux-muted)" }}>
            Anything about your work or your money — in your own words
          </span>
        </span>
        <Icons.ArrowRight className="h-[18px] w-[18px] shrink-0" style={{ color: "var(--ux-brand)" }} />
      </Link>
    </div>
  );
}
