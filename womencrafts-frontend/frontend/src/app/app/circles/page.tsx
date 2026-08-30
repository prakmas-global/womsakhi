"use client";

import { useMemo, useState } from "react";

import { Btn, Card, Chip, EmptyState, IconTile, SectionHead, SourceNote, Tabs, plural } from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { CircleCard } from "@/components/ux/circles/parts";
import {
  CIRCLE_ART, CIRCLE_KINDS, rupees, type CircleKind,
} from "@/components/ux/circles/data";
import { useCircles } from "@/components/ux/live";

/**
 * Circle — the groups she is in, and the ones she could join.
 *
 * Hers come first and are never mixed with suggestions: a savings circle is a
 * financial commitment, and a screen that puts "the circle you pay into" beside
 * "a circle you might like" invites exactly the wrong tap.
 */
export default function CirclesPage() {
  const { data: circles, source } = useCircles();
  const MY_CIRCLES = circles.mine;
  const DISCOVER_CIRCLES = circles.discover;
  const [tab, setTab] = useState("My circles");
  const [kinds, setKinds] = useState<CircleKind[]>([]);

  const pool = tab === "My circles" ? MY_CIRCLES : DISCOVER_CIRCLES;
  const shown = useMemo(
    () => (kinds.length ? pool.filter((c) => kinds.includes(c.kind)) : pool),
    [pool, kinds],
  );

  const saving = MY_CIRCLES.filter((c) => c.kind === "Savings");
  const monthly = saving.reduce((a, c) => a + (c.monthly_minor ?? 0), 0);
  const potTotal = saving.reduce((a, c) => a + (c.pot_minor ?? 0), 0);

  return (
    <HomeShell
      active="/app/circles"
      rail={
        <div className="space-y-[15px]">
          <Card className="ux-onscroll-soft">
            <SectionHead title="What you have committed" sub="Across your savings circles" />
            <div className="space-y-3.5">
              {[
                ["Every month", rupees(monthly), "CalendarClock", "--ux-tint-violet", "--ux-violet"],
                ["The pot you will receive", rupees(potTotal), "PiggyBank", "--ux-tint-green", "--ux-green"],
                ["Circles you are in", `${MY_CIRCLES.length}`, "UsersRound", "--ux-tint-pink", "--ux-pink"],
              ].map(([label, val, icon, tint, ink]) => (
                <div key={label} className="ux-hov flex items-center gap-3">
                  <IconTile icon={icon} tint={tint} ink={ink} size={38} />
                  <div className="min-w-0">
                    <p className="text-[17px] font-bold leading-none tabular-nums" style={{ color: "var(--ux-ink)" }}>{val}</p>
                    <p className="mt-1 truncate text-[11.5px]" style={{ color: "var(--ux-muted)" }}>{label}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 rounded-[11px] p-3 text-[11.5px] leading-relaxed"
               style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>
              A savings circle is a promise to the other women in it. Missing a month affects whoever&rsquo;s
              turn it is, not the app.
            </p>
          </Card>

          <div className="ux-clay ux-onscroll-soft relative overflow-hidden p-[18px]"
               style={{ background: "linear-gradient(140deg, var(--ux-tint-pink), var(--ux-tint-lilac))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={CIRCLE_ART.invite} alt=""
                 className="ux-float pointer-events-none absolute -bottom-3 -end-4 h-[100px] w-[100px] object-contain" />
            <h3 className="relative w-[60%] text-[14px] font-semibold" style={{ color: "var(--ux-ink)" }}>
              Start your own
            </h3>
            <p className="relative mt-2 w-[60%] text-[12px] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
              Five women you already trust is enough to begin a savings circle.
            </p>
            <div className="relative mt-3 w-[60%]">
              <Btn href="/app/circles/new" variant="soft" size="sm" icon="Plus">Create a circle</Btn>
            </div>
          </div>

          <Card className="ux-onscroll-soft">
            <SectionHead title="How a savings circle works" icon="Info" />
            <ol className="space-y-3">
              {[
                "Everyone pays the same amount, on the same day, every month.",
                "One member takes the whole pot that month.",
                "The order is agreed at the start, and everyone gets a turn.",
                "It ends when every member has had the pot once.",
              ].map((t, i) => (
                <li key={t} className="flex items-start gap-2.5">
                  <span className="grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full text-[10px] font-bold"
                        style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>{i + 1}</span>
                  <span className="text-[12.5px] leading-snug" style={{ color: "var(--ux-ink-2)" }}>{t}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      }
    >
      <div className="mb-[18px] flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold" style={{ color: "var(--ux-ink)" }}>Circle</h1>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--ux-muted)" }}>
            {tab === "My circles"
              ? `${MY_CIRCLES.length} ${plural("circle", MY_CIRCLES.length)} you belong to.`
              : `${DISCOVER_CIRCLES.length} ${plural("circle", DISCOVER_CIRCLES.length)} near you and online.`}
          </p>

      <SourceNote source={source} what="circles" />
        </div>
        <Tabs items={["My circles", "Discover"]} active={tab} onChange={setTab} />
      </div>

      <div className="mb-[15px] flex flex-wrap gap-2">
        {CIRCLE_KINDS.map((k) => (
          <Chip
            key={k}
            selected={kinds.includes(k)}
            onClick={() => setKinds(kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k])}
          >
            {k}
          </Chip>
        ))}
      </div>

      {shown.length ? (
        <div className="ux-deck grid grid-cols-2 gap-[15px]">
          {shown.map((c, i) => <CircleCard key={c.id} c={c} i={i} />)}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon="UsersRound"
            title="Nothing of that kind here"
            body={
              tab === "My circles"
                ? "You have not joined a circle of that kind yet."
                : "Try another kind, or start one of your own."
            }
            action={<Btn onClick={() => setKinds([])} variant="soft">Show all kinds</Btn>}
          />
        </Card>
      )}
    </HomeShell>
  );
}
