"use client";

import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import { useSummary, useCircles } from "@/components/ux/live";
import { useMe } from "@/components/ux/me";
import { formatMoney } from "@/components/ux/kit/money";
import { clock } from "./Dashboard";

/**
 * The Home rail — Upcoming Events, Your Balance, Your Progress, My Circle
 * Members, in the order the approved design puts them.
 *
 * It lives in `HomeShell`'s `rail` slot rather than inside the page body, so
 * it inherits the shell's own responsive behaviour: the rail is `hidden
 * lg:flex`, which is why every card it carries is also reachable somewhere on
 * the page itself. A phone must never lose a destination to a column it
 * cannot see.
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

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

export function HomeRail() {
  const { data: summary } = useSummary();
  const { data: circles } = useCircles();
  const me = useMe();

  const money = summary?.money;
  const events = (summary?.upcoming_bookings ?? []).slice(0, 3);
  const pot = circles.mine.filter((c) => c.kind === "Savings")[0];
  const done = summary?.completed_programs ?? 0;
  const total = summary?.total_programs ?? 0;
  const pct = total > 0 ? Math.round((done * 100) / total) : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Her profile sat in the side menu until navigation moved to the top.
          It is the one card there that was doing work rather than decorating,
          so it lands here rather than being dropped. */}
      {me.profilePct < 100 && (
        <Card>
          <div className="flex items-center gap-3.5">
            <div className="grid h-[58px] w-[58px] shrink-0 place-items-center rounded-full"
                 style={{ background: `conic-gradient(var(--ux-rib-3) ${me.profilePct}%, var(--ux-track) 0)` }}>
              <div className="grid h-[45px] w-[45px] place-items-center rounded-full text-xsm font-bold"
                   style={{ background: "var(--ux-surface)", color: "var(--ux-ink)" }}>
                {me.profilePct}%
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-xsm font-bold leading-tight" style={{ color: "var(--ux-ink)" }}>
                Complete your profile
              </p>
              <p className="mt-1 text-2xs leading-snug" style={{ color: "var(--ux-muted)" }}>
                Almost there — unlock the support fund.
              </p>
            </div>
          </div>
          <Link href="/app/profile"
                className="ux-press ux-btn-g mt-3 flex min-h-[40px] items-center justify-center gap-2 rounded-[12px] text-xsm font-bold"
                style={{ background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))", color: "var(--ux-on-brand)" }}>
            Continue now
            <Icons.ArrowRight className="h-4 w-4" />
          </Link>
        </Card>
      )}

      <Card>
        <Head title="Upcoming Events" action="View Calendar" href="/app/schedule" />
        {events.length === 0 ? (
          <p className="py-3 text-xsm" style={{ color: "var(--ux-muted)" }}>
            Nothing booked yet. Sessions and classes you join appear here.
          </p>
        ) : (
          <ul className="space-y-1">
            {events.map((b) => {
              const d = new Date(`${b.date}T00:00:00`);
              const ok = !Number.isNaN(d.getTime());
              return (
                <li key={b.id}>
                  <Link href={`/app/bookings/${b.id}`}
                        className="ux-row flex items-start gap-3 rounded-[12px] p-2">
                    <span className="grid w-[44px] shrink-0 place-items-center rounded-[12px] py-1.5 leading-none"
                          style={{ background: "var(--ux-tint-pink)", color: "var(--ux-pink-ink)" }}>
                      <span className="text-2xs font-bold tracking-[0.08em]">
                        {ok ? MONTHS[d.getMonth()] : "—"}
                      </span>
                      <span className="mt-0.5 text-base font-bold">{ok ? d.getDate() : "·"}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xsm font-bold leading-tight" style={{ color: "var(--ux-ink)" }}>
                        {b.service_name || "Session"}
                      </span>
                      <span className="mt-0.5 block text-2xs" style={{ color: "var(--ux-muted)" }}>
                        {b.with_whom || (b.mode ? b.mode[0].toUpperCase() + b.mode.slice(1) : "With your circle")}
                      </span>
                    </span>
                    <time className="shrink-0 pt-0.5 text-2xs" style={{ color: "var(--ux-muted)" }}>
                      {b.time ? clock(b.time) : ""}
                    </time>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Your Balance — the design's one filled card in the rail. */}
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
                  className="ux-hov flex items-center gap-1 text-xs font-semibold"
                  style={{ color: "var(--ux-on-brand-2)" }}>
              View Wallet <Icons.ChevronRight className="h-[13px] w-[13px]" />
            </Link>
          </div>
          <p className="mt-2 text-2xlm font-bold leading-none tracking-[-0.03em] tabular-nums"
             style={{ color: "var(--ux-on-brand)" }}>
            {formatMoney(money?.balance_minor ?? 0)}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--ux-on-brand-2)" }}>Available Balance</p>
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
          <span className="rounded-[8px] px-2.5 py-1 text-2xs font-semibold"
                style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line)", color: "var(--ux-muted)" }}>
            This Month
          </span>
        </div>
        <div className="flex items-center gap-3.5">
          <Ring pct={pct} />
          <div className="min-w-0">
            <p className="text-sm font-bold" style={{ color: "var(--ux-ink)" }}>
              {done} of {total} courses done
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--ux-muted)" }}>
              {done === 0 ? "Start one and it shows up here." : "Keep going — you are moving."}
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <Head title="My Circle Members" action="View All" href="/app/circles" />
        <div className="flex items-center justify-center">
          {["blazer","blue-saree","elder-saree","hijab","pink-glasses","purple-kurta"].map((n, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img loading="lazy" decoding="async" key={n} src={`/ux/art/avatar-woman-${n}.webp`} alt=""
                 className="h-[34px] w-[34px] rounded-full object-cover"
                 style={{ border: "2px solid var(--ux-surface)", marginLeft: i ? -9 : 0 }} />
          ))}
          {pot && pot.members > 6 && (
            <span className="grid h-[34px] w-[34px] place-items-center rounded-full text-2xs font-bold"
                  style={{ background: "var(--ux-surface-2)", border: "2px solid var(--ux-surface)",
                           color: "var(--ux-muted)", marginLeft: -9 }}>
              +{pot.members - 6}
            </span>
          )}
        </div>
        <p className="mt-3 text-center text-xs" style={{ color: "var(--ux-muted)" }}>
          {pot ? `${pot.members} women in ${pot.name}` : "Join a circle to see the women in it"}
        </p>
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
