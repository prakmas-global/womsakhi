"use client";

import { useMemo, useState } from "react";
import * as Icons from "lucide-react";

import {
  Btn, Card, EmptyState, Progress, Rows, SectionHead,
  SourceNote, Tabs, plural
} from "@/components/ux/kit";
import { useCountUp } from "@/components/ux/kit/motion";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { EarningsBars, PayoutMethod, SourceSplit, TxnRow } from "@/components/ux/money/parts";
import { MONEY_ART, TXN_FILTERS, rupees } from "@/components/ux/money/data";
import { formatMoneyOrNothing } from "@/components/ux/kit/money";
import { useWalletInsights } from "@/components/ux/business";
import { useMoneyOverview } from "@/components/ux/money/live";

/**
 * Earn — what she has, what is coming, and how to get it out.
 *
 * The order is deliberate. Balance first, because that is the question she came
 * with. Then what is still on its way, because "why is it not ₹28,550?" is the
 * next question and answering it before she asks is the whole job. Then how to
 * withdraw. History last: it matters, but not before the answer does.
 */
export default function WalletPage() {
  const [filter, setFilter] = useState<string>("All");
  // The ledger, from the server where there is one and from the mock where
  // there is not. `source` is what the footer reads to say which.
  // One request for the whole screen: balance, ledger, payout accounts and
  // goals together. It was four, which on a cluster in another data centre is
  // four round trips for one screen — 294ms against 73ms.
  const { data: money, source } = useMoneyOverview();
  const PAYOUT_METHODS = money.accounts;
  // The twelve-month trend and the source split are one aggregation on the
  // server, not thirteen queries — see `/wallet/insights`. Kept separate
  // because the chart is below the fold and need not hold up the balance.
  const { data: insights } = useWalletInsights();
  const MONTHLY_MINOR = insights.monthly_minor;
  const MONTH_LABELS = insights.month_labels;
  const EARNING_SOURCES = insights.sources.map((x) => ({ name: x.name, minor: x.minor, tone: x.tone }));
  const WITHDRAWN_MINOR = insights.withdrawn_minor;
  // Her earning goal, from the goals she actually set — `insights.goal` is the
  // older shape and stays null until a goal exists there too.
  const moneyGoal = money.goals.find((g) => g.kind === "money" && g.status === "open");
  const GOAL = moneyGoal
    ? { label: moneyGoal.label, target_minor: moneyGoal.target, current_minor: moneyGoal.current }
    : insights.goal;
  const balance = useCountUp(Math.round(money.balanceMinor / 100), 900);

  const shown = useMemo(() => money.txns.filter((t) => {
    if (filter === "Money in") return t.kind === "credit";
    if (filter === "Money out") return t.kind === "debit";
    if (filter === "Pending") return t.status === "pending";
    return true;
  }), [filter, money.txns]);

  // Grouped by day so the list reads as a diary, not a ledger dump.
  const groups = useMemo(() => {
    const m = new Map<string, typeof shown>();
    for (const t of shown) m.set(t.day, [...(m.get(t.day) ?? []), t]);
    return [...m.entries()];
  }, [shown]);

  /**
   * The same groups, flattened into one list of headings and rows.
   *
   * A section per day cannot be virtualised as a unit — the browser still has
   * to lay out every section. One list can.
   */
  const flat = useMemo(
    () => groups.flatMap(([day, rows]) => [
      { kind: "day" as const, day },
      ...rows.map((txn) => ({ kind: "txn" as const, txn })),
    ]),
    [groups],
  );

  const goalPct = GOAL && GOAL.target_minor
    ? Math.min(100, Math.round((GOAL.current_minor / GOAL.target_minor) * 100))
    : 0;

  return (
    <HomeShell
      active="/app/wallet"
      rail={
        <div className="space-y-[15px]">
          <Card className="ux-onscroll-soft">
            <SectionHead title="Where it comes from" sub="Last 30 days" />
            <SourceSplit sources={EARNING_SOURCES} />
          </Card>

          {/* A goal she has not set is not a goal. Inviting her to set one is
              honest; showing progress towards a number she never chose is not. */}
          {GOAL ? (
            <Card className="ux-onscroll-soft">
              <SectionHead title="Your goal" action="Edit"
                           onAction={() => { window.location.href = "/app/progress/goals"; }} />
              <p className="text-[13px] font-semibold" style={{ color: "var(--ux-ink)" }}>{GOAL.label}</p>
              <div className="mt-2.5 flex items-center gap-2.5">
                <Progress pct={goalPct} track="--ux-track" />
                <span className="shrink-0 text-[11.5px] font-medium tabular-nums"
                      style={{ color: "var(--ux-muted)" }}>
                  {goalPct}%
                </span>
              </div>
              <p className="mt-2.5 text-[11.5px] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
                {rupees(Math.max(0, GOAL.target_minor - GOAL.current_minor))} to go this month.
              </p>
            </Card>
          ) : (
            <Card className="ux-onscroll-soft">
              <SectionHead title="Set a goal" />
              <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
                A number and a date. Women who write one down earn more than women who mean to —
                not because the number is magic, but because it turns &ldquo;more&rdquo; into something you can
                tell whether you have reached.
              </p>
              <div className="mt-3">
                <Btn href="/app/progress/goals" variant="primary" size="sm" full iconEnd="ArrowRight">
                  Set one now
                </Btn>
              </div>
            </Card>
          )}

          <Card className="ux-onscroll-soft">
            <SectionHead title="Where it goes" action="Manage"
                         onAction={() => { window.location.href = "/app/settings/payments"; }} />
            <div className="space-y-2.5">
              {PAYOUT_METHODS.map((m) => <PayoutMethod key={m.id} m={m} />)}
            </div>
            <div className="mt-3">
              <Btn href="/app/settings/payments" variant="outline" size="sm" full icon="Plus">Add a way to get paid</Btn>
            </div>
          </Card>

          <div className="ux-clay ux-onscroll-soft relative overflow-hidden p-[18px]"
               style={{ background: "linear-gradient(140deg, var(--ux-tint-green), var(--ux-tint-lilac))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={MONEY_ART.grow} alt=""
                 className="ux-float pointer-events-none absolute -bottom-3 -end-4 h-[100px] w-[100px] object-contain" />
            <h3 className="relative w-[60%] text-[14px] font-semibold" style={{ color: "var(--ux-ink)" }}>
              Put a little aside
            </h3>
            <p className="relative mt-2 w-[60%] text-[12px] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
              A savings circle turns ₹500 a month into a lump sum when you need one.
            </p>
            <div className="relative mt-3 w-[60%]">
              <Btn href="/app/circles" variant="soft" size="sm" iconEnd="ArrowRight">See circles</Btn>
            </div>
          </div>
        </div>
      }
    >
      <h1 className="text-[24px] font-bold" style={{ color: "var(--ux-ink)" }}>Earn</h1>
      <p className="mb-[18px] mt-1.5 text-[13px]" style={{ color: "var(--ux-muted)" }}>
        Everything you have made, and how to move it to your bank.
      </p>

      {/* On a money screen an unlabelled fallback is not graceful degradation,
          it is a lie about her balance. */}
      <SourceNote source={source} what="figures" />

      {/* ── the answer ──────────────────────────────────────────────────── */}
      <div className="ux-sq ux-onscroll relative overflow-hidden rounded-[20px] p-[22px]"
           style={{ background: "linear-gradient(100deg, var(--ux-brand-900) 0%, var(--ux-brand-700) 55%, var(--ux-brand-600) 100%)" }}>
        <span aria-hidden className="pointer-events-none absolute -end-10 -top-16 h-[220px] w-[220px] rounded-full"
              style={{ background: "radial-gradient(circle, rgba(255,255,255,0.16), transparent 68%)" }} />
        <div className="relative flex items-start justify-between gap-6">
          <div>
            <p className="text-[12.5px]" style={{ color: "rgba(255,255,255,0.82)" }}>Available to withdraw</p>
            <p className="mt-1.5 text-[38px] font-bold leading-none tabular-nums text-white">
              ₹{balance.toLocaleString("en-IN")}
            </p>
            {/* The gap between "what I made" and "what I can take out" is the
                single most common source of confusion in a wallet. Say it here,
                unprompted, rather than waiting to be asked — but only when
                there IS a gap. "₹0 more is on its way" invents a worry. */}
            <p className="mt-3 flex items-center gap-1.5 text-[12.5px]" style={{ color: "rgba(255,255,255,0.9)" }}>
              <Icons.Clock className="h-4 w-4" />
              {money.pendingMinor > 0
                ? `${rupees(money.pendingMinor)} more is on its way — usually here within 3 days.`
                : "Everything you have earned is here. Nothing is held back."}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2.5">
            <Btn href="/app/wallet/withdraw" variant="soft" icon="ArrowDownToLine">Withdraw</Btn>
            <Btn href="/app/wallet/statement" variant="on-brand" size="sm" icon="Receipt">Statement</Btn>
          </div>
        </div>

        <div className="relative mt-5 flex gap-6 border-t pt-4" style={{ borderColor: "rgba(255,255,255,0.18)" }}>
          {[
            // A month with nothing in it says so in words. A bare ₹0 here is
            // indistinguishable from a formatter that divided the paise twice.
            ["This month", formatMoneyOrNothing(MONTHLY_MINOR[MONTHLY_MINOR.length - 1])],
            ["Withdrawn this year", formatMoneyOrNothing(WITHDRAWN_MINOR, "None yet")],
            ["Payouts", `${money.txns.filter((t) => t.kind === "debit").length} so far`],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.72)" }}>{k}</p>
              <p className="mt-1 text-[15px] font-semibold tabular-nums text-white">{v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── the trend ───────────────────────────────────────────────────── */}
      <Card className="ux-onscroll mt-[15px]">
        <SectionHead
          title="Your last twelve months"
          sub={`Up ${Math.round((MONTHLY_MINOR[11] / MONTHLY_MINOR[0] - 1) * 100)}% since ${MONTH_LABELS[0]}`}
          action="Statement"
          onAction={() => { window.location.href = "/app/wallet/statement"; }}
        />
        <EarningsBars values={MONTHLY_MINOR} labels={MONTH_LABELS} />
      </Card>

      {/* ── the history ─────────────────────────────────────────────────── */}
      <div className="mb-3 mt-[24px] flex items-end justify-between gap-4">
        <div>
          <h2 className="text-[16px] font-semibold" style={{ color: "var(--ux-ink)" }}>Every rupee</h2>
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--ux-muted)" }}>
            {shown.length} {plural("entry", shown.length)}
          </p>
        </div>
        <Tabs items={[...TXN_FILTERS]} active={filter} onChange={setFilter} />
      </div>

      {groups.length ? (
        /*
         * Flattened, so the whole ledger is one virtualisable list rather than
         * a section per day. A woman running a stall through a festival season
         * has hundreds of entries, and the cost is not the scrolling — it is
         * the first paint on a screen she opens to check one figure.
         *
         * `<Rows>` does nothing at all below its threshold, which is most
         * accounts, and takes over only when there is enough to be worth it.
         */
        <Rows
          items={flat}
          keyOf={(row) => (row.kind === "day" ? `day:${row.day}` : row.txn.id)}
          className="space-y-2.5"
          render={(row, i) =>
            row.kind === "day" ? (
              <h3 className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-[0.08em] first:mt-0"
                  style={{ color: "var(--ux-faint)" }}>
                {row.day}
              </h3>
            ) : (
              <TxnRow item={row.txn} i={i} />
            )
          }
        />
      ) : (
        <Card>
          <EmptyState
            icon="Receipt"
            title={`No ${filter.toLowerCase()} yet`}
            body="Every payment in or out of your wallet shows up here."
            action={<Btn onClick={() => setFilter("All")} variant="soft">Show everything</Btn>}
          />
        </Card>
      )}
    </HomeShell>
  );
}
