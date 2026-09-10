"use client";

import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import { AvatarStack, Btn, IconTile, Pill, Progress } from "../kit";
import { memberCount, rupees, type Circle } from "./data";

const KIND_TONE: Record<string, "green" | "pink" | "orange"> = {
  Savings: "green", Community: "pink", Trade: "orange",
};

/**
 * A circle, as a card.
 *
 * Savings circles show money and a turn; community circles show people and
 * activity. Same card, different second line — because the question she is
 * asking of each is different, and one generic "142 members" line would answer
 * neither.
 */
export function CircleCard({ c, i }: { c: Circle; i: number }) {
  const savings = c.kind === "Savings";
  return (
    <div
      className="ux-i ux-sq ux-onscroll flex flex-col overflow-hidden rounded-[16px] border"
      style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface)", ["--i" as string]: i }}
    >
      <div className="relative h-[104px] overflow-hidden" style={{ background: `var(${c.tint})` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img loading="lazy" decoding="async" src={c.art} alt="" className="ux-art h-full w-full object-cover" />
        <span className="absolute end-2.5 top-2.5">
          <Pill tone={KIND_TONE[c.kind]} size="sm">{c.kind}</Pill>
        </span>
      </div>

      <div className="flex flex-1 flex-col p-[16px]">
        <div className="flex items-start gap-2.5">
          <IconTile icon={c.icon} tint={c.tint} ink={c.ink} size={34} radius={10} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>
              <Link href={`/app/circles/${c.id}`} className="-my-1 inline-block py-1 hover:underline">{c.name}</Link>
            </h3>
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs" style={{ color: "var(--ux-muted)" }}>
              <Icons.MapPin className="h-3.5 w-3.5 shrink-0" /> {c.place}
            </p>
          </div>
        </div>

        <p className="mt-2.5 text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{c.blurb}</p>

        {savings ? (
          <div className="mt-3 rounded-[12px] p-3" style={{ background: "var(--ux-surface-2)" }}>
            <div className="flex items-baseline justify-between">
              <span className="text-xs" style={{ color: "var(--ux-muted)" }}>Each month</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: "var(--ux-ink)" }}>
                {rupees(c.monthly_minor ?? 0)}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xs" style={{ color: "var(--ux-muted)" }}>The pot</span>
              <span className="text-xsm font-semibold tabular-nums" style={{ color: "var(--ux-green-ink)" }}>
                {rupees(c.pot_minor ?? 0)}
              </span>
            </div>
            {typeof c.currentMonth === "number" && c.totalMonths ? (
              <div className="mt-3">
                <div className="mb-1.5 flex items-center justify-between text-[12px] lg:text-2xs">
                  <span style={{ color: "var(--ux-muted)" }}>
                    {c.currentMonth === 0 ? "Not started" : `Month ${c.currentMonth} of ${c.totalMonths}`}
                  </span>
                  {c.myTurn && (
                    <span className="font-semibold" style={{ color: "var(--ux-brand)" }}>
                      Your turn: month {c.myTurn}
                    </span>
                  )}
                </div>
                <Progress pct={(c.currentMonth / c.totalMonths) * 100} track="--ux-track" h={5} />
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 flex items-center gap-2 text-xs" style={{ color: "var(--ux-muted)" }}>
            <Icons.Users className="h-4 w-4 shrink-0" />
            {memberCount(c.members)} members
            <span aria-hidden>•</span>
            {c.activity}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 pt-3.5">
          <span className="text-xs" style={{ color: "var(--ux-faint)" }}>
            {savings ? `${c.members} women` : c.activity}
          </span>
          {c.joined
            ? <Btn href={`/app/circles/${c.id}`} variant="soft" size="sm" iconEnd="ArrowRight">Open</Btn>
            : <Btn href={`/app/circles/${c.id}`} variant="primary" size="sm">Join</Btn>}
        </div>
      </div>
    </div>
  );
}

/**
 * The turn order in a savings circle.
 *
 * The single most important thing a member wants from this screen is "when do I
 * get the pot?", so her own row is marked and the months are shown in order
 * rather than as a list of names.
 */
/** A member as this component needs her — not the mock's exact row type, so
 *  the server's list can be passed straight in. */
export interface TurnRow { name: string; turn: number; paid?: boolean; you?: boolean; avatar?: string }

export function TurnOrder({
  members, currentMonth,
}: { members: readonly TurnRow[]; currentMonth: number }) {
  return (
    <ol className="ux-stagger space-y-2">
      {[...members].sort((a, b) => a.turn - b.turn).map((m) => {
        const done = m.turn < currentMonth;
        const now = m.turn === currentMonth;
        return (
          <li
            key={`${m.turn}-${m.name}`}
            className="ux-hov flex items-center gap-3 rounded-[12px] px-2.5 py-2"
            style={{ background: m.you ? "var(--ux-brand-tint)" : now ? "var(--ux-surface-2)" : "transparent" }}
          >
            <span className="grid h-[24px] w-[24px] shrink-0 place-items-center rounded-full text-[12px] lg:text-2xs font-bold"
                  style={{
                    background: done ? "var(--ux-green-ink)" : now ? "var(--ux-brand-600)" : "var(--ux-track)",
                    color: done || now ? "var(--ux-on-brand)" : "var(--ux-muted)",
                  }}>
              {done ? <Icons.Check className="h-3 w-3" strokeWidth={3} /> : m.turn}
            </span>
            {/* Not every member has a photo, and a broken image is worse than
                none — the initial is always there. */}
            {m.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img loading="lazy" decoding="async" src={m.avatar} alt="" className="h-[28px] w-[28px] shrink-0 rounded-full object-cover" />
            ) : (
              <span className="grid h-[28px] w-[28px] shrink-0 place-items-center rounded-full text-[12px] lg:text-2xs font-semibold"
                    style={{ background: "var(--ux-tint-violet)", color: "var(--ux-violet)" }}>
                {m.name.trim().charAt(0).toUpperCase()}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate text-xsm"
                  style={{ color: "var(--ux-ink)", fontWeight: m.you ? 600 : 400 }}>
              {m.name}{m.you && <span style={{ color: "var(--ux-brand)" }}> — you</span>}
            </span>
            {!m.paid && !done && (
              <span className="shrink-0 rounded-full px-2 py-[2px] text-[12px] lg:text-2xs font-semibold"
                    style={{ background: "var(--ux-tint-orange)", color: "var(--ux-orange-ink)" }}>
                not paid
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export { AvatarStack };
