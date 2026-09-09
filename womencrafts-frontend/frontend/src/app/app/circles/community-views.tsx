"use client";

import { memo, useMemo } from "react";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import type { Circle } from "@/lib/community-api";
import type { ApiCircleSavings, CirclePost } from "@/lib/growth-api";
import { formatMoney } from "@/components/ux/kit/money";

/**
 * Community, four ways.
 *
 * The same circles and the same money, seen four ways, because "community"
 * means four different things depending on what she came for: the pot she is
 * paying into, the room she wants to talk in, the woman two streets away who
 * has a spare stall, or simply the work other women made this week.
 */

export interface CommunityData {
  circles: Circle[];
  savings: ApiCircleSavings | null;
  savingsCircle: Circle | null;
  posts: CirclePost[];
}

export interface CommunityActs {
  pay: () => void;
  like: (postId: string) => void;
  paying: boolean;
}

/**
 * One formatter, hoisted, in `kit/money`.
 *
 * This file carried its own copy, and the copy built a fresh
 * `Intl.NumberFormat` on every single call — constructing a locale formatter
 * per figure, on screens that print dozens of them. `kit/money` builds it once
 * at module scope. Byte-identical output; re-exported under the old name so
 * nothing has to change its imports.
 */
export const rupees = formatMoney;

const TONES = ["--ux-pink", "--ux-green", "--ux-violet", "--ux-amber", "--ux-blue"] as const;
const TINTS: Record<string, string> = {
  "--ux-pink": "--ux-tint-pink", "--ux-green": "--ux-tint-green",
  "--ux-violet": "--ux-tint-violet", "--ux-amber": "--ux-tint-amber",
  "--ux-blue": "--ux-tint-blue",
};
const INKS: Record<string, string> = {
  "--ux-pink": "--ux-pink-ink", "--ux-green": "--ux-green-ink",
  "--ux-violet": "--ux-violet-ink", "--ux-amber": "--ux-amber-ink",
  "--ux-blue": "--ux-blue-ink",
};
/** Stable per circle, so a circle keeps its colour between visits. */
export const toneOf = (id: string) =>
  TONES[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % TONES.length];

export const initials = (name: string) =>
  name.split(/\s+/).slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase();

function Tile({ tone, size = 44, radius = 14, children }: {
  tone: string; size?: number; radius?: number; children: React.ReactNode;
}) {
  return (
    <span className="grid shrink-0 place-items-center font-extrabold"
          style={{ width: size, height: size, borderRadius: radius,
                   color: `var(${INKS[tone]})`,
                   background: `linear-gradient(150deg, var(${TINTS[tone]}), color-mix(in srgb, var(${TINTS[tone]}) 52%, var(--ux-surface)))`,
                   boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28)" }}>
      {children}
    </span>
  );
}

const card = {
  background: "linear-gradient(168deg, var(--ux-surface-2), var(--ux-surface) 48%)",
  border: "1px solid var(--ux-line)",
  boxShadow: "var(--ux-shadow-card), inset 0 1px 0 var(--ux-sheen)",
} as const;

export const Sec = ({ children, href }: { children: React.ReactNode; href?: string }) => (
  <h3 className="mb-3.5 mt-7 flex items-center gap-2.5 text-2xs font-extrabold uppercase tracking-[0.16em] first:mt-0"
      style={{ color: "var(--ux-faint)" }}>
    {children}
    {href && (
      <Link href={href} className="ux-press ms-auto flex min-h-[34px] items-center rounded-[12px] px-3 text-xs font-bold normal-case tracking-normal"
            style={{ color: "var(--ux-brand)" }}>See all</Link>
    )}
  </h3>
);

/* ══ A · THE POT ══════════════════════════════════════════════════════════ */

export function Pot({ d, act }: { d: CommunityData; act: CommunityActs }) {
  // A fresh `slice()` every render is a fresh array, which `CircleGrid`'s memo
  // would never match. Same four circles, same reference.
  const top4 = useMemo(() => d.circles.slice(0, 4), [d.circles]);
  const wall = useMemo(() => d.posts.slice(0, 3), [d.posts]);
  const s = d.savings;
  if (!s) {
    return (
      <section className="rounded-[24px] p-10 text-center" style={card}>
        <Icons.Coins className="mx-auto h-9 w-9" style={{ color: "var(--ux-faint)" }} />
        <p className="mt-3 text-base font-bold" style={{ color: "var(--ux-ink)" }}>
          You are not in a savings circle yet
        </p>
        <p className="mt-1.5 text-xsm" style={{ color: "var(--ux-muted)" }}>
          A pot is a few women paying the same amount each month, and one of them taking the whole
          pot each time. Your turn comes once.
        </p>
      </section>
    );
  }

  const CX = 165, R = 122, SEAT = 122;
  const n = s.members.length || 1;
  const circ = 2 * Math.PI * R;
  const off = circ * (1 - s.members_paid / n);
  const turnIndex = Math.max(0, s.members.findIndex((m) => m.name === s.whose_turn));

  return (
    <>
      <section className="relative mb-5 flex flex-wrap items-center gap-8 overflow-hidden rounded-[24px] p-[32px]"
               style={{ background: "linear-gradient(112deg, var(--ux-brand-900), var(--ux-fill) 42%, var(--ux-rib-3))",
                        color: "var(--ux-on-brand)" }}>
        <span aria-hidden className="absolute inset-0"
              style={{ background: "radial-gradient(760px 340px at 76% 18%, rgba(236,72,153,.30), transparent 62%), radial-gradient(520px 300px at 12% 90%, rgba(124,58,237,.34), transparent 66%)" }} />

        <div className="ux-pot relative mx-auto h-[330px] w-[330px] shrink-0 max-[820px]:h-[280px] max-[820px]:w-[280px]">
          <svg viewBox="0 0 330 330" className="absolute inset-0 h-full w-full" style={{ overflow: "visible" }}
               role="img"
               aria-label={`Round ${s.round}. ${s.members_paid} of ${n} women have paid. It is ${s.whose_turn}'s turn to receive ${rupees(s.pot_minor)}.`}>
            <defs>
              <linearGradient id="ux-pot-arc" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="var(--ux-rib-3)" />
                <stop offset="0.55" stopColor="var(--ux-rib-4)" />
                <stop offset="1" stopColor="var(--ux-rib-5)" />
              </linearGradient>
            </defs>
            <circle cx={CX} cy={CX} r={R} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth={13} />
            <circle className="arc" cx={CX} cy={CX} r={R} fill="none" stroke="url(#ux-pot-arc)"
                    strokeWidth={13} strokeLinecap="round" transform={`rotate(-90 ${CX} ${CX})`}
                    style={{ ["--ux-arc-len" as string]: `${circ.toFixed(1)}`,
                             ["--ux-arc-off" as string]: `${off.toFixed(1)}` }} />
            {s.members.map((_, i) => {
              const a = (i / n) * 2 * Math.PI - Math.PI / 2;
              return <line key={i} x1={CX} y1={CX}
                           x2={CX + (R - 24) * Math.cos(a)} y2={CX + (R - 24) * Math.sin(a)}
                           stroke="rgba(255,255,255,.16)" strokeWidth={1.5} />;
            })}
            <g className="ux-hand" style={{ ["--ux-hand-deg" as string]: `${(turnIndex / n) * 360}deg` }}>
              <line x1={CX} y1={CX} x2={CX} y2={CX - R + 34} stroke="var(--ux-rib-5)" strokeWidth={2.5} strokeLinecap="round" />
              <circle cx={CX} cy={CX} r={5} fill="var(--ux-rib-5)" />
            </g>
            {s.members.map((m, i) => {
              const a = (i / n) * 2 * Math.PI - Math.PI / 2;
              const x = CX + SEAT * Math.cos(a), y = CX + SEAT * Math.sin(a);
              const isTurn = m.name === s.whose_turn;
              return (
                <g key={m.name} className="ux-seat" style={{ animationDelay: `${0.55 + i * 0.07}s` }}>
                  {isTurn && <circle className="ux-halo" cx={x} cy={y} r={26} fill="none"
                                     stroke="var(--ux-rib-5)" strokeWidth={2.5} opacity={0.9} />}
                  <circle cx={x} cy={y} r={21} strokeWidth={3}
                          fill={m.paid ? "var(--ux-green-ink)" : isTurn ? "rgba(253,230,138,.22)" : "rgba(255,255,255,.12)"}
                          stroke={m.paid ? "var(--ux-green-ink)" : isTurn ? "var(--ux-rib-5)" : "rgba(255,255,255,.34)"} />
                  <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
                        style={{ fontSize: 11, fontWeight: 700, fill: "var(--ux-on-brand)" }}>{initials(m.name)}</text>
                  {m.paid && (
                    <>
                      <circle cx={x + 15} cy={y - 15} r={7} fill="var(--ux-green-ink)" />
                      <path d={`M${x + 11.5} ${y - 15}l2.4 2.4 4.2-4.6`} fill="none" stroke="var(--ux-on-green)"
                            strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </>
                  )}
                  {m.you && (
                    <text x={x} y={y + 33} textAnchor="middle"
                          style={{ fontSize: 9.5, fontWeight: 800, fill: "rgba(255,255,255,.75)" }}>YOU</text>
                  )}
                </g>
              );
            })}
          </svg>
          <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
            <span className="text-2xs font-extrabold uppercase tracking-[0.19em]"
                  style={{ color: "rgba(255,255,255,.72)" }}>Round {s.round} pot</span>
            <p className="my-1 text-4xlm font-extrabold tabular-nums tracking-[-0.04em]">{rupees(s.pot_minor)}</p>
            <span className="text-xsm" style={{ color: "rgba(255,255,255,.88)" }}>
              {s.whose_turn} receives it
            </span>
          </div>
        </div>

        <div className="relative min-w-[270px] flex-1">
          <span className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-2xs font-extrabold uppercase tracking-[0.06em]"
                style={{ background: "rgba(255,255,255,.16)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.3)" }}>
            <Icons.Coins className="h-[13px] w-[13px]" /> {d.savingsCircle?.name ?? "Your savings circle"}
          </span>
          <h2 className="mt-3.5 text-[clamp(1.5625rem,3.4vw,2.25rem)] font-extrabold leading-[1.14] tracking-[-0.035em]">
            {s.members_paid} of {n} have paid this round.
          </h2>
          <p className="mt-3 max-w-[44ch] text-sm leading-relaxed" style={{ color: "rgba(255,255,255,.88)" }}>
            {rupees(s.monthly_minor)} each, once a month, and the whole pot goes to one woman.
            {s.you_paid ? " Yours is in." : " Yours is not in yet."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <button type="button" onClick={act.pay} disabled={s.you_paid || act.paying}
                    className="ux-press inline-flex min-h-[48px] items-center gap-2 rounded-[12px] px-5 text-sm font-bold disabled:opacity-70"
                    style={{ background: s.you_paid ? "var(--ux-green-ink)" : "var(--ux-on-brand)",
                             color: s.you_paid ? "var(--ux-on-green)" : "var(--ux-brand-900)" }}>
              {s.you_paid ? <><Icons.Check className="h-4 w-4" /> Paid</>
                          : <><Icons.Coins className="h-4 w-4" /> {act.paying ? "Paying…" : `Pay your ${rupees(s.monthly_minor)}`}</>}
            </button>
            <Link href={`/app/circles/${s.circle_id}`}
                  className="ux-press inline-flex min-h-[48px] items-center gap-2 rounded-[12px] px-5 text-sm font-bold"
                  style={{ background: "rgba(255,255,255,.15)", color: "var(--ux-on-brand)",
                           boxShadow: "inset 0 0 0 1px rgba(255,255,255,.32)" }}>
              See everyone&rsquo;s turn <Icons.ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <Sec href="/app/circles">Your circles</Sec>
      <CircleGrid circles={top4} />

      {d.posts.length > 0 && (
        <>
          <Sec href="/app/circles">What women are saying</Sec>
          {wall.map((p, i) => <PostCard key={p.id} p={p} i={i} onLike={act.like} />)}
        </>
      )}
    </>
  );
}

const CircleGrid = memo(function CircleGrid({ circles }: { circles: Circle[] }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(232px, 1fr))" }}>
      {circles.map((c, i) => {
        const tone = toneOf(c.id);
        return (
          <Link key={c.id} href={`/app/circles/${c.id}`}
                className="ux-press ux-rise rounded-[16px] p-[16px] text-start transition-transform hover:-translate-y-[3px]"
                style={{ ...card, animationDelay: `${0.05 + i * 0.06}s` }}>
            <div className="flex items-center gap-3">
              <Tile tone={tone} size={40} radius={13}>
                <Icons.UsersRound className="h-[19px] w-[19px]" />
              </Tile>
              <div className="min-w-0">
                <b className="block text-sm font-bold leading-snug" style={{ color: "var(--ux-ink)" }}>
                  {c.name}
                </b>
                <p className="mt-0.5 text-xs" style={{ color: "var(--ux-faint)" }}>{c.topic}</p>
              </div>
            </div>
            <p className="mt-3 text-xs" style={{ color: "var(--ux-faint)" }}>
              {c.member_count} women · {c.post_count} posts
            </p>
          </Link>
        );
      })}
    </div>
  );
});

/**
 * Takes `onLike`, not the whole `act`.
 *
 * `act` carries `paying`, so it changes identity the moment she presses Pay —
 * and every post card on the pot screen re-rendered with it, twice per
 * payment, for a button none of them draw. One stable callback is all a card
 * needs, and it is what makes the memo worth having.
 */
const PostCard = memo(function PostCard(
  { p, i, onLike }: { p: CirclePost; i: number; onLike: (postId: string) => void },
) {
  const tone = toneOf(p.id);
  return (
    <article className="ux-rise mb-3 rounded-[20px] p-4" style={{ ...card, animationDelay: `${0.05 + i * 0.07}s` }}>
      <div className="mb-2.5 flex items-center gap-3">
        <Tile tone={tone} size={38} radius={12}>
          <span className="text-xsm">{initials(p.author_name)}</span>
        </Tile>
        <div className="min-w-0">
          <b className="block text-xsm font-bold" style={{ color: "var(--ux-ink)" }}>{p.author_name}</b>
        </div>
        <time className="ms-auto shrink-0 text-2xs" style={{ color: "var(--ux-faint)" }}>{p.when}</time>
      </div>
      <p className="m-0 text-sm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{p.body}</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => onLike(p.id)}
                className="ux-press inline-flex min-h-[38px] items-center gap-2 rounded-[12px] px-3.5 text-xs font-bold"
                style={p.liked_by_me
                  ? { background: "var(--ux-tint-pink)", color: "var(--ux-pink-ink)", border: "1px solid transparent" }
                  : { border: "1px solid var(--ux-line)", color: "var(--ux-ink-2)" }}>
          <Icons.Heart className="h-4 w-4" fill={p.liked_by_me ? "currentColor" : "none"} />
          {p.likes}
        </button>
      </div>
    </article>
  );
});

/* ══ B · ROOMS ════════════════════════════════════════════════════════════ */

export function Rooms({ d, act }: { d: CommunityData; act: CommunityActs }) {
  // The rooms worth showing are the ones with something in them. Copy, sort
  // and slice on every render is three passes for an answer that only changes
  // when the circles do.
  const rooms = useMemo(
    () => [...d.circles].sort((a, b) => b.post_count - a.post_count).slice(0, 6),
    [d.circles]);
  const lastPost = (i: number) => d.posts[i % Math.max(d.posts.length, 1)];

  return (
    <>
      <div className="ux-rise mb-4.5 flex flex-wrap items-center gap-3.5 rounded-[20px] px-[20px] py-[16px]" style={card}>
        <span className="text-2xs font-extrabold uppercase tracking-[0.15em]" style={{ color: "var(--ux-faint)" }}>
          Here now
        </span>
        <div className="flex">
          {d.posts.slice(0, 5).map((p, i) => (
            <span key={p.id} className="relative -ms-2 grid h-[34px] w-[34px] place-items-center rounded-[12px] text-2xs font-extrabold first:ms-0"
                  style={{ color: `var(${INKS[toneOf(p.id)]})`,
                           background: `var(${TINTS[toneOf(p.id)]})`,
                           border: "2.5px solid var(--ux-surface)" }}>
              {initials(p.author_name)}
              <i className="absolute -bottom-px -end-px h-[9px] w-[9px] rounded-full"
                 style={{ background: "var(--ux-green-ink)", border: "2px solid var(--ux-surface)" }} />
            </span>
          ))}
        </div>
        <span className="text-xsm" style={{ color: "var(--ux-faint)" }}>
          {d.posts[0]?.author_name.split(" ")[0]} and others are reading right now
        </span>
      </div>

      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        {rooms.map((c, i) => {
          const tone = toneOf(c.id);
          const said = lastPost(i);
          const live = i < 2;
          return (
            <Link key={c.id} href={`/app/circles/${c.id}`}
                  className="ux-press ux-rise group rounded-[20px] p-[16px] text-start transition-transform hover:-translate-y-1"
                  style={{ ...card, animationDelay: `${0.05 + i * 0.07}s` }}>
              <div className="flex items-center gap-3">
                <Tile tone={tone} size={46} radius={15}>
                  <Icons.UsersRound className="h-[21px] w-[21px]" />
                </Tile>
                <div className="min-w-0">
                  <h4 className="m-0 text-base font-bold tracking-[-0.015em]" style={{ color: "var(--ux-ink)" }}>
                    {c.name}
                  </h4>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs" style={{ color: "var(--ux-faint)" }}>
                    {live && <i className="ux-live h-[7px] w-[7px] shrink-0 rounded-full"
                                style={{ background: "var(--ux-green-ink)" }} />}
                    {c.member_count} women{live ? " · some here now" : ""}
                  </p>
                </div>
              </div>
              {said && (
                <p className="mt-3 rounded-[12px] p-[11px_13px] text-xsm leading-relaxed"
                   style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line)",
                            color: "var(--ux-ink-2)" }}>
                  <b style={{ color: "var(--ux-ink)" }}>{said.author_name}:</b> {said.body.slice(0, 96)}
                  {said.body.length > 96 ? "…" : ""}
                  {i === 0 && (
                    <span className="ms-1 inline-flex items-center gap-1 align-middle">
                      {[1, 2, 3].map((k) => (
                        <i key={k} className={`ux-blip-${k} h-[4px] w-[4px] rounded-full`}
                           style={{ background: "var(--ux-brand)" }} />
                      ))}
                    </span>
                  )}
                </p>
              )}
              <div className="mt-3 flex items-center gap-2.5">
                {c.post_count > 0 && (
                  <span className="rounded-full px-2.5 py-1 text-2xs font-extrabold"
                        style={{ background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))",
                                 color: "var(--ux-on-brand)" }}>
                    {c.post_count} posts
                  </span>
                )}
                <span className="ms-auto inline-flex min-h-[38px] items-center gap-1.5 rounded-[12px] px-[16px] text-xs font-bold transition-all group-hover:gap-2.5"
                      style={{ border: "1px solid var(--ux-line-strong)", background: "var(--ux-surface)",
                               color: "var(--ux-ink-2)" }}>
                  Go in <Icons.ArrowRight className="h-[14px] w-[14px]" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}

/* ══ C · NEAR YOU ═════════════════════════════════════════════════════════ */

export function Near({
  d, km, setKm,
}: { d: CommunityData; km: number; setKm: (n: number) => void }) {
  /**
   * Distance is not on the server yet.
   *
   * There is no location on a circle or a member, so a real "2.1 km" cannot be
   * computed — and inventing one would be a lie she might act on. Each woman is
   * placed by a stable hash of her name instead, and the screen says so, so the
   * shape of the feature is real while the numbers are honestly labelled.
   */
  // The hash is per character of every id, and `km` is a range input she
  // drags — so without this the whole set was re-hashed on every one of the
  // dozens of renders a single drag produces. Only the filter depends on `km`.
  const people = useMemo(() => d.posts.slice(0, 6).map((p, i) => {
    const seed = [...p.id].reduce((n, c) => n + c.charCodeAt(0), 0);
    return { id: p.id, name: p.author_name, what: p.body.slice(0, 52),
             km: Number((0.6 + ((seed % 55) / 10)).toFixed(1)), i };
  }), [d.posts]);
  const within = useMemo(() => people.filter((p) => p.km <= km), [people, km]);

  return (
    <>
      <h2 className="text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
          style={{ color: "var(--ux-ink)" }}>
        {within.length} {within.length === 1 ? "woman" : "women"} within {km} km
      </h2>
      <p className="mb-4 mt-1.5 text-sm" style={{ color: "var(--ux-ink-2)" }}>
        All of them make something. Drag the range to see who is close enough to share a stall or
        split a courier.
      </p>

      <div className="relative mb-4 h-[360px] overflow-hidden rounded-[24px]"
           style={{ background: "radial-gradient(circle at 50% 50%, var(--ux-surface-2), var(--ux-surface))",
                    border: "1px solid var(--ux-line)" }}>
        <svg viewBox="0 0 600 360" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id="ux-sweep" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="var(--ux-brand)" stopOpacity="0.26" />
              <stop offset="1" stopColor="var(--ux-brand)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[55, 97, 139].map((r) => (
            <circle key={r} cx={300} cy={180} r={r} fill="none"
                    stroke="var(--ux-line-strong)" strokeDasharray="3 7" />
          ))}
          <g className="ux-sweep">
            <path d="M300 180 L300 41 A139 139 0 0 1 398 82 Z" fill="url(#ux-sweep)" />
          </g>
          <circle cx={300} cy={180} r={10} fill="var(--ux-brand)" />
          <circle cx={300} cy={180} r={10} fill="none" stroke="var(--ux-brand)" opacity={0.4}>
            <animate attributeName="r" values="10;44" dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values=".45;0" dur="3s" repeatCount="indefinite" />
          </circle>
          {people.map((p) => {
            const a = (p.i / people.length) * 2 * Math.PI + 0.55;
            const r = 34 + p.km * 21;
            const x = 300 + r * Math.cos(a), y = 180 + r * Math.sin(a) * 0.74;
            const near = p.km <= km;
            return (
              <g key={p.id} className="ux-seat" style={{ animationDelay: `${0.3 + p.i * 0.08}s`,
                                                          opacity: near ? undefined : 0.18 }}>
                <circle cx={x} cy={y} r={18} fill={`var(${toneOf(p.id)})`}
                        stroke="var(--ux-surface)" strokeWidth={2.5} />
                <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
                      style={{ fontSize: 10.5, fontWeight: 700, fill: "var(--ux-on-brand)" }}>{initials(p.name)}</text>
              </g>
            );
          })}
        </svg>
        <div className="pointer-events-none absolute start-[18px] top-4">
          <b className="block text-base font-extrabold" style={{ color: "var(--ux-ink)" }}>Your city</b>
          <span className="text-xs" style={{ color: "var(--ux-faint)" }}>you are in the middle</span>
        </div>
        <div className="absolute inset-x-[18px] bottom-4 flex items-center gap-3 rounded-[12px] px-3.5 py-[12px]"
             style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line-strong)",
                      boxShadow: "0 8px 22px -14px rgba(23,16,52,.5)" }}>
          <span className="shrink-0 text-xs font-bold" style={{ color: "var(--ux-ink)" }}>How far</span>
          <input type="range" min={1} max={6} step={0.5} value={km} aria-label="Distance in kilometres"
                 onChange={(e) => setKm(Number(e.target.value))}
                 className="h-[34px] flex-1 cursor-pointer" style={{ accentColor: "var(--ux-brand)" }} />
          <b className="min-w-[56px] shrink-0 text-end text-xsm font-extrabold" style={{ color: "var(--ux-brand)" }}>
            {km} km
          </b>
        </div>
      </div>

      <p className="mb-5 text-xs" style={{ color: "var(--ux-faint)" }}>
        Distances are a stand-in — WomSakhi does not hold anyone&rsquo;s location yet, so nobody is
        placed by where she really is.
      </p>

      <Sec>Who is near</Sec>
      {within.length === 0 ? (
        <p className="rounded-[16px] p-6 text-center text-xsm"
           style={{ ...card, color: "var(--ux-muted)" }}>
          Nobody within {km} km. Drag the range wider.
        </p>
      ) : within.map((p) => (
        <article key={p.id} className="ux-slide mb-2.5 flex items-center gap-3.5 rounded-[16px] p-3.5 transition-transform hover:translate-x-1"
                 style={{ ...card, animationDelay: `${0.1 + p.i * 0.06}s` }}>
          <Tile tone={toneOf(p.id)} size={40} radius={13}>
            <span className="text-xsm">{initials(p.name)}</span>
          </Tile>
          <div className="min-w-0 flex-1">
            <b className="block text-sm font-bold" style={{ color: "var(--ux-ink)" }}>{p.name}</b>
            <p className="mt-0.5 truncate text-xs" style={{ color: "var(--ux-faint)" }}>{p.what}…</p>
          </div>
          <div className="shrink-0 text-end">
            <b className="block text-base font-extrabold tabular-nums" style={{ color: "var(--ux-ink)" }}>{p.km}</b>
            <span className="text-2xs" style={{ color: "var(--ux-faint)" }}>km</span>
          </div>
          <Link href="/app/messages"
                className="ux-press inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-[12px] px-3.5 text-xs font-bold"
                style={{ border: "1px solid var(--ux-line-strong)", background: "var(--ux-surface)",
                         color: "var(--ux-ink-2)" }}>
            <Icons.MessageCircle className="h-[14px] w-[14px]" /> Message
          </Link>
        </article>
      ))}
    </>
  );
}

/* ══ D · THE WALL ═════════════════════════════════════════════════════════ */

/** Each piece gets a stable pair of brand colours, so it looks the same twice. */
const ART: [string, string][] = [
  ["var(--ux-rib-1)", "var(--ux-rib-3)"],
  ["var(--ux-blue-ink)", "var(--ux-violet-ink)"],
  ["var(--ux-green-ink)", "var(--ux-rib-5)"],
  ["var(--ux-amber-ink)", "var(--ux-pink-ink)"],
  ["var(--ux-brand-900)", "var(--ux-rib-4)"],
  ["var(--ux-pink-ink)", "var(--ux-rib-2)"],
];

export function Wall({ d, act }: { d: CommunityData; act: CommunityActs }) {
  if (d.posts.length === 0) {
    return (
      <p className="rounded-[20px] p-10 text-center text-xsm" style={{ ...card, color: "var(--ux-muted)" }}>
        Nothing has been posted in your circles yet.
      </p>
    );
  }
  return (
    <>
      <h2 className="text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
          style={{ color: "var(--ux-ink)" }}>
        Made this week
      </h2>
      <p className="mb-5 mt-1.5 text-sm" style={{ color: "var(--ux-ink-2)" }}>
        {d.posts.length} pieces, by women in your circles. Hover any of them to ask how.
      </p>
      <div style={{ columns: "3 250px", columnGap: 14 }}>
        {d.posts.slice(0, 12).map((p, i) => {
          const [c1, c2] = ART[i % ART.length];
          const h = 140 + ((p.body.length * 7) % 100);
          return (
            <article key={p.id} className="ux-rise group mb-3.5 overflow-hidden rounded-[20px] transition-transform hover:-translate-y-[5px]"
                     style={{ ...card, breakInside: "avoid", animationDelay: `${0.05 + i * 0.06}s` }}>
              <div className="relative overflow-hidden"
                   style={{ height: h, background: `linear-gradient(150deg, ${c1}, ${c2})` }}>
                <span aria-hidden className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ background: "linear-gradient(0deg, rgba(0,0,0,.5), transparent 55%)" }} />
                <span className="absolute inset-0 grid place-content-center text-4xlm font-extrabold transition-transform duration-500 group-hover:scale-110"
                      style={{ color: "rgba(255,255,255,.34)" }}>
                  {initials(p.author_name)}
                </span>
                <span className="absolute inset-x-3 bottom-3 translate-y-2 rounded-[12px] p-2.5 text-center text-xs font-bold opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100"
                      style={{ background: "rgba(255,255,255,.94)", color: "var(--ux-brand-900)" }}>
                  Ask {p.author_name.split(" ")[0]} how
                </span>
              </div>
              <div className="p-3.5">
                <p className="m-0 text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
                  {p.body.slice(0, 130)}{p.body.length > 130 ? "…" : ""}
                </p>
                <div className="mt-3 flex items-center gap-2.5 text-xs" style={{ color: "var(--ux-faint)" }}>
                  <span>{p.author_name}</span>
                  <button type="button" onClick={() => act.like(p.id)}
                          className="ux-press ms-auto inline-flex min-h-[34px] items-center gap-1.5 rounded-[8px] px-2.5 text-xs font-bold"
                          style={p.liked_by_me
                            ? { background: "var(--ux-tint-pink)", color: "var(--ux-pink-ink)", border: "1px solid transparent" }
                            : { border: "1px solid var(--ux-line)", color: "var(--ux-ink-2)" }}>
                    <Icons.Heart className="h-[14px] w-[14px]" fill={p.liked_by_me ? "currentColor" : "none"} />
                    {p.likes}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
