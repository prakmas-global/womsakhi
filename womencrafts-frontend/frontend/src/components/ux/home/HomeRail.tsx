"use client";

import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import { useHome } from "@/components/ux/live";
import { formatRupees, AvatarStack, Skeleton } from "@/components/ux/kit";
import {
  clock, lost, rowsOf, blockOf, Gone,
  type HomeCircle, type HomeProgress,
} from "./Dashboard";

/**
 * The Home rail — her profile, Upcoming Events, Your Balance, Your Progress and
 * My Circle Members, in the order the approved design puts them.
 *
 * It lives in `HomeShell`'s `rail` slot rather than inside the page body, so it
 * inherits the shell's own responsive behaviour: the rail is hidden below `xl`,
 * which is why every card it carries is also reachable somewhere on the page
 * itself. A phone must never lose a destination to a column it cannot see.
 *
 * ── It reads the same request the body does ─────────────────────────────────
 * `useHome()` here and `useHome()` in `Dashboard` are one round trip, not two:
 * `apiClient.get` registers the promise at the call, so the second caller in
 * the same tick joins the first rather than starting its own. That is what lets
 * the rail be a sibling of the page instead of a prop drilled through the
 * shell — and it is why both must go on calling the same endpoint rather than
 * one of them reaching for a narrower one.
 *
 * Everything here was invented until this pass: a balance of ₹24,350, a ring
 * that said 65%, three events nobody had booked, and six faces described as
 * "your circle members". All five cards now state what the server holds, or say
 * they could not load it.
 */

function Card({ children, className, style }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties;
}) {
  return (
    <section className={`ux-sq rounded-[16px] p-4 ${className ?? ""}`}
             style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)",
               boxShadow: "var(--ux-shadow-card)", ...style }}>
      {children}
    </section>
  );
}

function Head({ title, action, href }: { title: string; action: string; href: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="text-sm font-bold tracking-tight" style={{ color: "var(--ux-ink)" }}>{title}</h3>
      <Link href={href}
            className="ux-hov -my-2 flex min-h-[40px] shrink-0 items-center gap-1 py-2 text-xs font-semibold"
            style={{ color: "var(--ux-brand)" }}>
        {action}
        <Icons.ChevronRight className="h-[14px] w-[14px]" />
      </Link>
    </div>
  );
}

/** Ring gauge. `conic-gradient` rather than an SVG arc — no viewBox maths, and
 *  it reads the track colour straight from the token. */
function Ring({ pct, size = 74 }: { pct: number; size?: number }) {
  const inner = size - 16;
  return (
    <div className="grid shrink-0 place-items-center rounded-full"
         style={{ width: size, height: size,
                  background: `conic-gradient(var(--ux-rib-3) ${pct}%, var(--ux-track) 0)` }}>
      <div className="grid place-items-center rounded-full text-base font-bold"
           style={{ width: inner, height: inner, background: "var(--ux-surface)", color: "var(--ux-ink)" }}>
        {pct}%
      </div>
    </div>
  );
}

/**
 * The six faces beside "My Circle Members".
 *
 * **They are illustrations, not her circle.** No endpoint carries member
 * photographs, so this is a decorative stack and it is marked `alt=""` and
 * `aria-hidden` accordingly; the sentence under it carries the only claim, and
 * that claim is counted server-side. The same stack used to be hand-copied into
 * the savings panel on the page as well, where two arrays of the same six names
 * could drift apart. It exists once now, here, in the card whose subject is the
 * members.
 */
const FACES = ["blazer", "blue-saree", "elder-saree", "hijab", "pink-glasses", "purple-kurta"]
  .map((n) => `/ux/art/avatar-woman-${n}.webp`);

/** One card's worth of waiting. The rail is four cards; this is the shape. */
function RailSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-live="polite">
      <span className="sr-only">Loading your summary…</span>
      {[162, 186, 147].map((h, i) => (
        <div key={i} className="ux-sq rounded-[16px] p-4"
             style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)", minHeight: h }}>
          <div className="flex items-center justify-between gap-3">
            <Skeleton w="52%" h={14} />
            <Skeleton w={62} h={11} />
          </div>
          <div className="mt-4 flex flex-col gap-3">
            <Skeleton w="86%" h={12} />
            <Skeleton w="64%" h={12} />
            <Skeleton w="72%" h={12} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function HomeRail() {
  const { data: home, source } = useHome();

  if (!home) {
    // Nothing to say rather than something wrong: the body carries the retry,
    // and two "could not load" cards on one screen is one apology too many.
    return source === "loading" ? <RailSkeleton /> : null;
  }

  const money = home.earnings?.money;
  const events = home.upcoming.slice(0, 3);
  const circles = rowsOf<HomeCircle>(home.circles).filter((c) => c.joined);
  const progress = blockOf<HomeProgress>(home.progress);

  // Her profile, as the server measures it — five fields, three of them filled.
  // The rail used to read `useMe().profilePct`, which is `completion_rate` off
  // `/me/progress`; that is the furthest-along *programme*, not her profile, and
  // it read 100% for a woman who had not written a word about herself.
  const profilePct = home.me.profile.pct;
  const nextField = home.me.profile.steps.find((s) => !s.done);

  // Courses finished, out of the ones she has joined. `completion_rate` was the
  // obvious field and the wrong one — it is the best single programme's
  // progress, so it says 100% while nine of fifteen are done.
  const done = progress?.programs_completed ?? 0;
  const joined = done + (progress?.programs_active ?? 0);
  const pct = joined > 0 ? Math.round((done * 100) / joined) : 0;

  const women = circles.reduce((a, c) => a + (c.member_count ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Her profile sat in the side menu until navigation moved to the top.
          It is the one card there that was doing work rather than decorating,
          so it lands here rather than being dropped. */}
      {!lost(home, "profile") && profilePct < 100 && (
        <Card>
          <div className="flex items-center gap-3.5">
            <div className="grid h-[58px] w-[58px] shrink-0 place-items-center rounded-full"
                 style={{ background: `conic-gradient(var(--ux-rib-3) ${profilePct}%, var(--ux-track) 0)` }}>
              <div className="grid h-[45px] w-[45px] place-items-center rounded-full text-xsm font-bold"
                   style={{ background: "var(--ux-surface)", color: "var(--ux-ink)" }}>
                {profilePct}%
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-xsm font-bold leading-tight" style={{ color: "var(--ux-ink)" }}>
                Complete your profile
              </p>
              {/* The actual field that is missing, named. "Almost there" was
                  encouragement with nothing behind it; this is the one thing
                  she has to do, and the server is the one that knows it. */}
              <p className="mt-1 text-2xs leading-snug" style={{ color: "var(--ux-muted)" }}>
                {nextField ? nextField.label : "One step left."}
              </p>
            </div>
          </div>
          <Link href={nextField?.href || "/app/profile"}
                className="ux-press ux-btn-g mt-3 flex min-h-[40px] items-center justify-center gap-2 rounded-[12px] text-xsm font-bold"
                style={{ background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))", color: "var(--ux-on-brand)" }}>
            Continue now
            <Icons.ArrowRight className="h-4 w-4" />
          </Link>
        </Card>
      )}

      <Card>
        <Head title="Upcoming Events" action="View Calendar" href="/app/schedule" />
        {lost(home, "summary") && lost(home, "events") ? (
          <Gone what="your calendar" />
        ) : events.length === 0 ? (
          <p className="py-3 text-xsm" style={{ color: "var(--ux-muted)" }}>
            Nothing booked yet. Sessions and classes you join appear here.
          </p>
        ) : (
          <ul className="space-y-1">
            {events.map((b) => (
              <li key={b.id}>
                <Link href={b.href || "/app/schedule"}
                      className="ux-row flex items-start gap-3 rounded-[12px] p-2">
                  {/* The day and the month come printed from the server, which
                      is what stopped this card re-deriving them from an ISO
                      string and disagreeing with the calendar screen. */}
                  <span className="grid w-[44px] shrink-0 place-items-center rounded-[12px] py-1.5 leading-none"
                        style={{ background: "var(--ux-tint-pink)", color: "var(--ux-pink-ink)" }}>
                    <span className="text-2xs font-bold tracking-[0.08em]">{b.month || "—"}</span>
                    <span className="mt-0.5 text-base font-bold">{b.day || "·"}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xsm font-bold leading-tight" style={{ color: "var(--ux-ink)" }}>
                      {b.title || "Session"}
                    </span>
                    <span className="mt-0.5 block text-2xs" style={{ color: "var(--ux-muted)" }}>
                      {b.with_whom || (b.mode ? b.mode[0].toUpperCase() + b.mode.slice(1) : "With your circle")}
                    </span>
                  </span>
                  <time className="shrink-0 pt-0.5 text-2xs" style={{ color: "var(--ux-muted)" }}>
                    {clock(b.time)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/*
        Your Balance — the design's one filled card in the rail, and the ONLY
        place on Home that states her balance.

        The figure row on the page carried a "Total Balance" tile rendering the
        identical expression from the identical field, 300px to the left. This
        one kept it because this one also offers the thing she would do with it.
      */}
      <section className="relative overflow-hidden rounded-[16px] p-4"
               style={{ background: "linear-gradient(140deg, var(--ux-brand-900), var(--ux-fill) 62%, var(--ux-rib-3) 132%)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img loading="lazy" decoding="async" src="/ux/art/icon-wallet.webp" alt="" aria-hidden
             className="pointer-events-none absolute -bottom-2 -right-2 w-[112px]"
             style={{ maskImage: "radial-gradient(70% 70% at 45% 45%, #000 55%, transparent 88%)",
                      WebkitMaskImage: "radial-gradient(70% 70% at 45% 45%, #000 55%, transparent 88%)" }} />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold" style={{ color: "var(--ux-on-brand)" }}>Your Balance</h3>
            <Link href="/app/wallet"
                  /* `-my-1 py-1`: 24px of touchable height without the
                     label moving a pixel — WCAG 2.2 asks for 24, the text
                     alone measured 16. Same pattern as `SectionHead`. */
                  className="ux-hov -my-1 flex items-center gap-1 py-1 text-xs font-semibold"
                  style={{ color: "var(--ux-on-brand-2)" }}>
              View Wallet <Icons.ChevronRight className="h-[13px] w-[13px]" />
            </Link>
          </div>
          {money ? (
            <>
              <p className="mt-2 text-2xlm font-bold leading-none tracking-[-0.03em] tabular-nums"
                 style={{ color: "var(--ux-on-brand)" }}>
                {formatRupees(money.balance_minor)}
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--ux-on-brand-2)" }}>Available Balance</p>
            </>
          ) : (
            // Her wallet did not answer. A zero here would be a statement about
            // her money, and this is a statement about the request.
            <p className="mt-2 text-xsm font-semibold leading-snug" style={{ color: "var(--ux-on-brand-2)" }}>
              We could not reach your wallet just now. Nothing has changed in it.
            </p>
          )}
          <Link href="/app/wallet/withdraw"
                className="ux-press ux-btn-g mt-3.5 inline-flex min-h-[40px] items-center gap-2 rounded-[12px] px-4 text-xsm font-bold"
                style={{ background: "var(--ux-on-brand-btn)", color: "var(--ux-on-brand-btn-ink)" }}>
            Take money out
            <Icons.ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold tracking-tight" style={{ color: "var(--ux-ink)" }}>Your Progress</h3>
        </div>
        {/* The chip here said "This Month". None of these figures are scoped to
            a month — they are every programme she has ever joined — so the chip
            was a caption that made a true number mean something untrue. */}
        {lost(home, "progress") || !progress ? (
          <Gone what="your progress" />
        ) : (
          <div className="flex items-center gap-3.5">
            <Ring pct={pct} />
            <div className="min-w-0">
              {/* "0 of 0 courses done" is arithmetic, not a sentence. A woman
                  who has joined nothing is told that, in words. */}
              <p className="text-sm font-bold" style={{ color: "var(--ux-ink)" }}>
                {joined === 0 ? "No courses yet" : `${done} of ${joined} courses done`}
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--ux-muted)" }}>
                {joined === 0 ? "Join one and it shows up here."
                  : done === 0 ? "Keep going — you are moving."
                  : `Since ${progress.member_since}`}
              </p>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <Head title="My Circle Members" action="View All" href="/app/circles" />
        {lost(home, "circles") ? (
          <Gone what="your circles" />
        ) : circles.length === 0 ? (
          <p className="py-3 text-xsm" style={{ color: "var(--ux-muted)" }}>
            You have not joined a circle yet. They are the fastest way to find work.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-center" aria-hidden>
              <AvatarStack srcs={FACES} size={34} />
            </div>
            <p className="mt-3 text-center text-xs" style={{ color: "var(--ux-muted)" }}>
              {women.toLocaleString("en-IN")} women across {circles.length}{" "}
              {circles.length === 1 ? "circle" : "circles"}
            </p>
          </>
        )}
        <Link href="/app/circles"
              className="ux-press mt-3 flex min-h-[42px] w-full items-center justify-center gap-2 rounded-[12px] text-xsm font-bold"
              style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line)", color: "var(--ux-ink)" }}>
          <Icons.UserRoundPlus className="h-4 w-4" />
          Invite Members
        </Link>
      </Card>
    </div>
  );
}
