"use client";

import { use, useState } from "react";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import {
  Btn, Card, EmptyState, IconTile, Pill, Progress, RailSkeleton, ScreenSkeleton, SectionHead,
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { formatMoney } from "@/components/ux/kit/money";
import { useCircle, useCircleSavings } from "@/components/ux/growth";
import { useMoney } from "@/components/ux/money/live";
import { messageFrom } from "@/lib/use-action";
import { settled, useAttemptKey } from "@/lib/idempotency";
import { apiContribute, type ApiContribution } from "@/lib/growth-api";

/**
 * Paying into a savings circle.
 *
 * The women waiting on this payment are named and shown before the button.
 * That is the whole design: a monthly transfer to an account number is easy to
 * postpone, and a payment eleven women you know are waiting on is not. The
 * social fact IS the mechanism a circle runs on, so the screen shows it.
 *
 * **This screen used to be a lie**, in three separate ways. The names above the
 * button were a hardcoded list of eleven fictional women. The amount was never
 * mapped from the server, so it read "Pay ₹0". And the button set a timer for
 * one second and then said "paid" without sending anything. Every figure here
 * now comes from `/community/circles/{id}/savings`, and the button moves real
 * money out of her real balance.
 */
export default function PayCircle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: detail, source } = useCircle(id);
  const { data: savings, refetch } = useCircleSavings(id);
  const { data: money } = useMoney();
  const c = detail.circle;

  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState<ApiContribution | null>(null);
  const attempt = useAttemptKey("circle-pay");

  // "Not here" is a claim, and it cannot be made while the answer is still on
  // its way — saying it during the fetch makes the screen flash "that is not
  // here" before showing itself.
  if (!c && source === "loading") {
    return (
      <HomeShell skeleton="form" rail={<RailSkeleton />}>
        <ScreenSkeleton shape="form" />
      </HomeShell>
    );
  }

  if (!c || !savings?.is_savings) {
    return (
      <HomeShell>
        <Card>
          <EmptyState
            icon="PiggyBank"
            title="Nothing to pay here"
            body="Only savings circles collect money. This one does not."
            action={<Btn href="/app/circles" variant="primary" iconEnd="ArrowRight">Your circles</Btn>}
          />
        </Card>
      </HomeShell>
    );
  }

  const share = savings.monthly_minor;
  const waiting = savings.members.filter((m) => !m.paid && !m.you);
  const enough = money.balanceMinor >= share;

  /** Pay this month's share. See `useAttemptKey` for why the key is per press. */
  async function pay() {
    setSending(true);
    setProblem("");
    try {
      const got = await apiContribute(id, attempt.current());
      attempt.settle();
      setDone(got);
      refetch();
    } catch (e) {
      // A refusal is an answer — she can act on it and press again. A timeout
      // is not: the money may already have moved, so that key is kept.
      if (settled(e)) attempt.settle();
      setProblem(messageFrom(e, "That did not go through. Nothing has left your balance — try again in a moment."));
    } finally {
      setSending(false);
    }
  }

  // Paid just now, or on an earlier visit this month. Coming back must not
  // offer to take a second share.
  if (done || savings.you_paid) {
    const paidCount = done?.members_paid ?? savings.members_paid;
    const total = done?.members_total ?? savings.members_total;
    const turn = done?.whose_turn ?? savings.whose_turn;
    return (
      <HomeShell>
        <Card className="ux-slide-up mx-auto max-w-[560px]">
          <div className="flex flex-col items-center py-4 text-center">
            <span className="grid h-[68px] w-[68px] place-items-center rounded-full" style={{ background: "var(--ux-tint-green)" }}>
              <Icons.CheckCheck className="h-[32px] w-[32px]" style={{ color: "var(--ux-green-ink)" }} strokeWidth={2} />
            </span>
            <h1 className="mt-4 text-xl font-bold" style={{ color: "var(--ux-ink)" }}>
              {formatMoney(share)} paid in
            </h1>
            <p className="mt-2 max-w-[40ch] text-sm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              {paidCount} of {total} have paid this month.
              {turn ? ` ${turn} takes the pot once everyone has.` : ""}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2.5">
              <Btn href={`/app/circles/${c.id}`} variant="primary" iconEnd="ArrowRight">Back to the circle</Btn>
              <Btn href="/app/wallet" variant="outline" icon="Receipt">See it in Money</Btn>
            </div>
          </div>
        </Card>
      </HomeShell>
    );
  }

  return (
    <HomeShell
      skeleton="detail"
      rail={
        <div className="space-y-[16px]">
          <Card>
            <SectionHead title="This month" />
            <div className="flex items-baseline justify-between">
              <span className="text-xsm" style={{ color: "var(--ux-muted)" }}>You pay</span>
              <span className="text-2xl font-bold tabular-nums" style={{ color: "var(--ux-ink)" }}>
                {formatMoney(share)}
              </span>
            </div>
            <div className="mt-3.5">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span style={{ color: "var(--ux-muted)" }}>Collected so far</span>
                <span className="font-semibold tabular-nums" style={{ color: "var(--ux-ink)" }}>
                  {savings.members_paid} of {savings.members_total}
                </span>
              </div>
              <Progress
                pct={savings.members_total ? (savings.members_paid / savings.members_total) * 100 : 0}
                track="--ux-track"
              />
            </div>

            {/* Where the money comes from, said before the button rather than
                discovered after it. This screen used to list her bank accounts
                — the ones money arrives into — as ways to pay out of. */}
            <div className="mt-4 flex items-center justify-between gap-3 rounded-[12px] p-3"
                 style={{ background: "var(--ux-surface-2)" }}>
              <span className="text-xs" style={{ color: "var(--ux-ink-2)" }}>From your WomSakhi balance</span>
              <span className="text-xsm font-semibold tabular-nums"
                    style={{ color: enough ? "var(--ux-ink)" : "var(--ux-orange-ink)" }}>
                {formatMoney(money.balanceMinor)}
              </span>
            </div>

            <div className="mt-4">
              {sending ? (
                <Btn variant="primary" full icon="Loader" disabled>Sending…</Btn>
              ) : (
                <Btn variant="primary" full iconEnd="ArrowRight" onClick={pay} disabled={!enough}>
                  Pay {formatMoney(share)}
                </Btn>
              )}
            </div>

            {!enough && !problem && (
              <p className="mt-2.5 text-xs leading-relaxed" style={{ color: "var(--ux-orange-ink)" }}>
                You have {formatMoney(money.balanceMinor)}, and this month&rsquo;s share is {formatMoney(share)}.
                Tell the circle before the date — they can wait.
              </p>
            )}
            {problem && (
              <p role="alert" className="ux-slide-up mt-2.5 text-xsm leading-relaxed"
                 style={{ color: "var(--ux-orange-ink)" }}>
                {problem}
              </p>
            )}

            <p className="mt-2.5 text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>
              Nothing is taken until you press this. WomSakhi takes no fee — every rupee goes into the pot.
            </p>
          </Card>

          <Card>
            <SectionHead title="If this month is hard" icon="Info" />
            <p className="text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              Tell the circle before the date rather than after. They can move your turn, or wait a week.
              A circle survives a hard month; it does not survive silence.
            </p>
            <div className="mt-3.5">
              <Btn href="/app/messages" variant="outline" size="sm" full icon="MessageCircle">Tell the circle</Btn>
            </div>
          </Card>
        </div>
      }
    >
      <Link href={`/app/circles/${c.id}`}
            className="ux-hov -my-1 mb-3.5 inline-flex items-center gap-1.5 py-1 text-xsm font-medium"
            style={{ color: "var(--ux-brand)" }}>
        <Icons.ArrowLeft className="ux-ico h-4 w-4" /> {c.name}
      </Link>

      <h1 className="text-2xl font-bold" style={{ color: "var(--ux-ink)" }}>Pay this month</h1>
      <p className="mb-[20px] mt-1.5 text-xsm" style={{ color: "var(--ux-muted)" }}>
        Month {savings.round} · {c.name}
      </p>

      {/* The women waiting, named and shown, above the button. A transfer to an
          account number is easy to postpone; the women you know are not. */}
      {savings.whose_turn && (
        <Card className="mb-[16px]">
          <div className="flex items-center gap-4">
            <IconTile icon="PiggyBank" tint="--ux-tint-green" ink="--ux-green" size={60} radius={30} />
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold" style={{ color: "var(--ux-ink)" }}>
                {savings.whose_turn} takes the pot this month
              </p>
              <p className="mt-1 text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
                {formatMoney(savings.pot_minor)} — once every one of you has paid in.
              </p>
            </div>
            <Pill tone="green">Month {savings.round}</Pill>
          </div>
        </Card>
      )}

      <Card className="mb-[16px]">
        <SectionHead title="Who has paid"
                     sub={`${savings.members_paid} of ${savings.members_total} so far this month`} />
        <ul className="ux-stagger grid grid-cols-2 gap-2.5">
          {savings.members.map((m, i) => (
            <li key={`${m.name}-${i}`} className="ux-hov flex items-center gap-2.5 rounded-[12px] px-2.5 py-2"
                style={{ background: m.you ? "var(--ux-brand-tint)" : "transparent", ["--i" as string]: i }}>
              <IconTile icon="User" tint="--ux-tint-violet" ink="--ux-violet" size={30} radius={15} />
              <span className="min-w-0 flex-1 truncate text-xsm"
                    style={{ color: "var(--ux-ink)", fontWeight: m.you ? 600 : 400 }}>
                {m.name}{m.you && <span style={{ color: "var(--ux-brand)" }}> — you</span>}
              </span>
              {m.paid
                ? <Icons.CheckCircle2 className="h-[16px] w-[16px] shrink-0" style={{ color: "var(--ux-green-ink)" }} />
                : <span className="shrink-0 text-2xs" style={{ color: "var(--ux-faint)" }}>waiting</span>}
            </li>
          ))}
        </ul>
        {waiting.length > 0 && (
          <p className="mt-3.5 rounded-[12px] p-3 text-xs leading-relaxed"
             style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>
            {waiting.slice(0, 3).map((w) => w.name.split(" ")[0]).join(", ")}
            {waiting.length > 3 ? ` and ${waiting.length - 3} more` : ""} {waiting.length === 1 ? "has" : "have"} not
            paid yet either. Nobody takes the pot until everyone has.
          </p>
        )}
      </Card>
    </HomeShell>
  );
}
