"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, EmptyState, I, IconTile, Pill, Progress, SectionHead, Stat, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import { PREORDERS, fundedUpfront, type PreOrder } from "@/components/ux/shopplus/data";

/**
 * Money before you buy cloth.
 *
 * ── The most direct answer to the constraint ────────────────────────────────
 * The typical male-owned firm in Africa holds over six times the capital of a
 * female-owned one, and that gap — not skill, not knowledge, not ambition — is
 * what the profit difference tracks. Lending her the difference means debt.
 * Letting the *buyer* fund the materials means neither.
 *
 * So a pre-order here is not a booking. It is a specific, small, understandable
 * ask: **the cost of the cloth, up front, so the order can begin.** The rest is
 * paid on delivery, the way it always was.
 *
 * The framing matters. "Deposit" sounds like a favour she is asking for.
 * "Cloth money" is a thing anyone who has ever had clothes made understands.
 */

const STATE: Record<PreOrder["state"], { label: string; tint: string; ink: string; icon: string }> = {
  asking: { label: "Waiting for cloth money", tint: "--ux-tint-amber", ink: "--ux-amber-ink", icon: "Clock" },
  funded: { label: "Cloth money in", tint: "--ux-tint-green", ink: "--ux-green-ink", icon: "HandCoins" },
  making: { label: "Being made", tint: "--ux-tint-blue", ink: "--ux-blue-ink", icon: "Scissors" },
  done: { label: "Delivered and paid", tint: "--ux-surface-2", ink: "--ux-muted", icon: "Check" },
};

export default function PreOrdersPage() {
  const router = useRouter();
  const [rows, setRows] = useState<PreOrder[]>(PREORDERS);
  const [note, setNote] = useState<string | null>(null);

  const upfront = useMemo(() => fundedUpfront(rows), [rows]);
  const waiting = useMemo(() => rows.filter((o) => o.state === "asking"), [rows]);
  const live = useMemo(() => rows.filter((o) => o.state === "funded" || o.state === "making"), [rows]);
  const done = useMemo(() => rows.filter((o) => o.state === "done"), [rows]);
  const owed = useMemo(
    () => live.reduce((n, o) => n + (o.totalMinor - o.paidMinor), 0),
    [live],
  );

  const ask = useCallback((id: string) => {
    const o = rows.find((x) => x.id === id);
    setNote(`Asked ${o?.buyer} for ${formatRupees(o?.materialsMinor ?? 0)} cloth money. She sees why, and what it buys.`);
  }, [rows]);

  const advance = useCallback((id: string) => {
    setRows((r) => r.map((o) => {
      if (o.id !== id) return o;
      if (o.state === "asking") return { ...o, state: "funded", paidMinor: o.materialsMinor };
      if (o.state === "funded") return { ...o, state: "making" };
      if (o.state === "making") return { ...o, state: "done", paidMinor: o.totalMinor };
      return o;
    }));
    const o = rows.find((x) => x.id === id);
    setNote(
      o?.state === "asking" ? `${o?.buyer} paid the cloth money. You can buy materials today.`
      : o?.state === "funded" ? "Marked as being made."
      : "Delivered. The rest of the money is in your wallet.",
    );
  }, [rows]);

  const card = (o: PreOrder) => {
    const s = STATE[o.state];
    const pct = Math.round((o.paidMinor / o.totalMinor) * 100);
    return (
      <Card key={o.id} pad={16}>
        <div className="flex flex-wrap items-start gap-3.5">
          <IconTile icon={s.icon} tint={s.tint} ink={s.ink} size={42} radius={12} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[0.875rem] font-bold" style={{ color: v("--ux-ink") }}>{o.what}</p>
              <span className="rounded-full px-2 py-[2px] text-[0.6875rem] font-bold uppercase tracking-[0.06em]"
                    style={{ background: v(s.tint), color: v(s.ink) }}>{s.label}</span>
            </div>
            <p className="mt-0.5 text-[0.8125rem]" style={{ color: v("--ux-muted") }}>
              For {o.buyer} · due {o.dueBy}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[1.125rem] font-extrabold leading-none tabular-nums" style={{ color: v("--ux-ink") }}>
              {formatRupees(o.totalMinor)}
            </p>
            <p className="mt-0.5 text-[0.6875rem]" style={{ color: v("--ux-muted") }}>whole order</p>
          </div>
        </div>

        <div className="mt-3.5">
          <div className="mb-1.5 flex items-center justify-between text-[0.75rem]" style={{ color: v("--ux-muted") }}>
            <span>
              <b style={{ color: v("--ux-green-ink") }}>{formatRupees(o.paidMinor)}</b> paid
              {o.paidMinor < o.totalMinor && ` · ${formatRupees(o.totalMinor - o.paidMinor)} on delivery`}
            </span>
            <span className="tabular-nums">{pct}%</span>
          </div>
          <Progress pct={pct} tone="--ux-green-ink" track="--ux-tint-green" h={6} />
        </div>

        {o.state === "asking" && (
          <div className="mt-3.5 rounded-[12px] px-3 py-2.5" style={{ background: v("--ux-tint-amber") }}>
            <p className="text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              Ask for <b>{formatRupees(o.materialsMinor)}</b> now — just the cloth and thread.
              The rest when she collects.
            </p>
          </div>
        )}

        {o.state !== "done" && (
          <div className="mt-3.5 flex gap-2">
            {o.state === "asking" && (
              <Btn size="sm" variant="outline" full onClick={() => ask(o.id)}>Ask again</Btn>
            )}
            <Btn size="sm" full onClick={() => advance(o.id)}>
              {o.state === "asking" ? "She paid" : o.state === "funded" ? "Started making" : "Delivered"}
            </Btn>
          </div>
        )}
      </Card>
    );
  };

  return (
    <HomeShell active="/app/shop">
      <div className="flex flex-col gap-5">
        <Link href={"/app/shop"}
                className="ux-press inline-flex w-fit items-center gap-1.5 text-[0.8125rem] font-semibold"
                style={{ color: v("--ux-muted") }}>
          <I name="ArrowLeft" className="h-[15px] w-[15px]" /> Back to your shops
        </Link>

        <header>
          <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>
            Before you buy cloth
          </p>
          <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>
            Let the order pay for itself
          </h1>
          <p className="mt-1.5 max-w-[56ch] text-[0.875rem] leading-relaxed" style={{ color: v("--ux-muted") }}>
            Ask for the cost of the materials up front — nothing more. You never spend your own
            money to start someone else&rsquo;s order, and you never borrow to do it.
          </p>
        </header>

        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat value={formatRupees(upfront)} label="Paid to you up front"
                  icon="HandCoins" tint="--ux-tint-green" ink="--ux-green-ink" />
            <Stat value={formatRupees(owed)} label="Coming on delivery"
                  icon="Truck" tint="--ux-tint-blue" ink="--ux-blue-ink" />
            <Stat value={String(waiting.length)} label="Still waiting to start"
                  icon="Clock" tint="--ux-tint-amber" ink="--ux-amber-ink" />
          </div>
        </Card>

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-[0.8125rem] font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        {waiting.length > 0 && (
          <div>
            <SectionHead title="Waiting on cloth money" icon="Clock" chip={String(waiting.length)} />
            <div className="flex flex-col gap-3">{waiting.map(card)}</div>
          </div>
        )}

        <div>
          <SectionHead title="In hand" sub="Materials paid for — safe to start" icon="Scissors"
                       chip={String(live.length)} />
          {live.length === 0 ? (
            <Card><EmptyState icon="Scissors" title="Nothing on the machine"
                              body="When a buyer pays the cloth money, the order appears here." /></Card>
          ) : (
            <div className="flex flex-col gap-3">{live.map(card)}</div>
          )}
        </div>

        {done.length > 0 && (
          <div>
            <SectionHead title="Finished" icon="Check" chip={String(done.length)} />
            <div className="flex flex-col gap-3">{done.map(card)}</div>
          </div>
        )}
      </div>
    </HomeShell>
  );
}
