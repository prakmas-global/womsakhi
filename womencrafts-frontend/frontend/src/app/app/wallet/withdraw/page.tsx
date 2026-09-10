"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import {Back, Btn, Card, IconTile, SectionHead, SourceNote } from "@/components/ux/kit";
import { Field, TextInput } from "@/components/ux/settings/Frame";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { usePayoutMethods } from "@/components/ux/business";
import { apiWithdraw, type WithdrawResult } from "@/lib/shop-api";
import { settled, useAttemptKey } from "@/lib/idempotency";
import { rupees, rupeesExact } from "@/components/ux/money/data";
import { useMoney } from "@/components/ux/money/live";
import { useT } from "@/i18n";

/**
 * Moving money to her bank.
 *
 * The most consequential button in the app, so three rules:
 *
 * 1. The AVAILABLE amount is what she can take, not what she has earned. Money
 *    still on its way is shown separately and never counted, because a
 *    withdrawal that bounces costs her a day and her confidence in the wallet.
 * 2. No fee, stated as a line reading "None" rather than omitted. An absent
 *    line reads as a charge waiting to appear.
 * 3. Confirming is one-way and says WHEN it will arrive, in days she can plan
 *    around — not "processing".
 */
export default function WithdrawPage() {
  const tr = useT();
  const { data: PAYOUT_METHODS } = usePayoutMethods();
  const { data: money, source } = useMoney();
  const [typed, setTyped] = useState("");
  const [method, setMethod] = useState<string>("");
  const [problem, setProblem] = useState("");
  const [result, setResult] = useState<WithdrawResult | null>(null);

  // Her primary account, unless she picks another. Not "the first in the list":
  // the list is sorted primary-first by the server, but relying on the order of
  // an array to decide where money goes is one refactor away from a payout to
  // the wrong bank.
  const chosenId = method || PAYOUT_METHODS.find((m) => m.primary)?.id || PAYOUT_METHODS[0]?.id || "";
  const [stage, setStage] = useState<"idle" | "sending" | "sent">("idle");
  const attempt = useAttemptKey("withdraw");
  const [touched, setTouched] = useState(false);

  // Derived, not synchronised: until she types, the field IS the balance, so
  // there is nothing to keep in step and no frame where it shows the wrong
  // number.
  const amount = touched ? typed : String(Math.round(money.balanceMinor / 100));

  const minor = useMemo(() => {
    const n = Number(amount.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }, [amount]);

  const tooMuch = minor > money.balanceMinor;
  const tooLittle = minor > 0 && minor < 10000;      // ₹100 floor
  const ok = minor > 0 && !tooMuch && !tooLittle;
  const chosen = PAYOUT_METHODS.find((m) => m.id === chosenId);

  /**
   * Move the money.
   *
   * The amount is checked again on the server against the summed ledger, so a
   * client that asked for more than she has is refused there rather than here —
   * this check only saves her the round trip. The request carries a per-press
   * idempotency key, so a double tap on a bad connection withdraws once — and
   * a second, genuine ₹200 withdrawal later the same day still goes through.
   */
  async function send() {
    if (!chosenId) { setProblem("Add a bank account or UPI id first."); return; }
    setStage("sending");
    setProblem("");
    try {
      const got = await apiWithdraw(minor, chosenId, attempt.current());
      attempt.settle();
      setResult(got);
      setStage("sent");
    } catch (e) {
      // A refusal is an answer: the next press is a new withdrawal, not a
      // retry of this one. A timeout is not — that key must be kept, because
      // the money may already have moved.
      if (settled(e)) attempt.settle();
      setProblem(
        (e as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message
          || "That did not go through. Your money has not moved — try again in a moment.",
      );
      setStage("idle");
    }
  }

  if (stage === "sent") {
    return (
      <HomeShell>
        <Card className="ux-slide-up mx-auto max-w-[560px]">
          <div className="flex flex-col items-center py-4 text-center">
            <span className="grid h-[68px] w-[68px] place-items-center rounded-full" style={{ background: "var(--ux-tint-green)" }}>
              <Icons.CheckCheck className="h-[32px] w-[32px]" style={{ color: "var(--ux-green-ink)" }} strokeWidth={2} />
            </span>
            <h1 className="mt-4 text-xl font-bold" style={{ color: "var(--ux-ink)" }}>
              {result ? result.amount_label : rupees(minor)} on its way
            </h1>
            {/* Days she can plan around, not "processing". */}
            <p className="mt-2 max-w-[40ch] text-sm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              {result?.to ? `To ${result.to}. ` : ""}
              {result?.arrives ?? "It reaches most banks by tomorrow, and always within three working days."}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2.5">
              <Btn href="/app/wallet" variant="primary" iconEnd="ArrowRight">{tr("walletWithdraw.backToEarn")}</Btn>
              <Btn href="/app/wallet/statement" variant="outline" icon="Receipt">{tr("walletWithdraw.seeTheStatement")}</Btn>
            </div>
          </div>
        </Card>
      </HomeShell>
    );
  }

  return (
    <HomeShell
      skeleton="form"
      rail={
        <div className="space-y-[16px]">
          <Card>
            <SectionHead title={tr("walletWithdraw.whatYouAreTakingOut")} />
            <div className="space-y-2.5 text-xsm">
              <div className="flex items-center justify-between gap-3">
                <span style={{ color: "var(--ux-muted)" }}>Amount</span>
                <span className="font-medium tabular-nums" style={{ color: "var(--ux-ink)" }}>
                  {minor ? rupeesExact(minor) : "—"}
                </span>
              </div>
              {/* Stated as None, never omitted. */}
              <div className="flex items-center justify-between gap-3">
                <span style={{ color: "var(--ux-muted)" }}>{tr("walletWithdraw.transferFee")}</span>
                <span className="font-medium" style={{ color: "var(--ux-green-ink)" }}>None</span>
              </div>
            </div>
            <div className="my-3.5 h-px" style={{ background: "var(--ux-line)" }} />
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("walletWithdraw.reachesYourBank")}</span>
              <span className="text-xl font-bold tabular-nums" style={{ color: "var(--ux-ink)" }}>
                {minor ? rupeesExact(minor) : "—"}
              </span>
            </div>
            <div className="mt-4">
              {stage === "sending" ? (
                <Btn variant="primary" full icon="Loader">Sending…</Btn>
              ) : (
                <Btn variant="primary" full iconEnd="ArrowRight"
                     className={ok && chosenId ? "" : "pointer-events-none opacity-50"}
                     onClick={() => void send()}>
                  Withdraw {minor ? rupees(minor) : ""}
                </Btn>
              )}
            </div>
            {problem && (
              <p className="ux-slide-up mt-2.5 text-xsm leading-relaxed"
                 style={{ color: "var(--ux-orange-ink)" }}>
                {problem}
              </p>
            )}
            <p className="mt-2.5 text-xs leading-relaxed" style={{ color: "var(--ux-faint)" }}>{tr("walletWithdraw.mostBanksHaveItByTomorrow")}</p>
          </Card>

          <Card>
            <SectionHead title={tr("walletWithdraw.ifItDoesNotArrive")} icon="Info" />
            <p className="text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              Tell us after three working days and we will trace it. The money is never lost — it is either
              with your bank or still with us, and both are traceable.
            </p>
          </Card>
        </div>
      }
    >
      <Back to="/app/wallet" label={tr("walletWithdraw.yourWallet")} className="mb-4" />

      <h1 className="text-2xl font-bold" style={{ color: "var(--ux-ink)" }}>Withdraw</h1>
      <p className="mb-[20px] mt-1.5 text-xsm" style={{ color: "var(--ux-muted)" }}>{tr("walletWithdraw.nothingMovesUntilYouPressThe")}</p>

      <SourceNote source={source} what="figures" />

      <Card className="mb-[16px]">
        <SectionHead title={tr("walletWithdraw.howMuch")} />
        <Field label={tr("walletWithdraw.amountInRupees")} hint={`You can take out up to ${rupees(money.balanceMinor)} right now.`}>
          <TextInput value={amount} onChange={(e) => { setTouched(true); setTyped(e.target.value); }} inputMode="numeric" />
        </Field>

        <div className="mt-3 flex flex-wrap gap-2">
          {[500000, 1000000, money.balanceMinor].map((v) => (
            <button
              key={v}
              onClick={() => { setTouched(true); setTyped(String(Math.round(v / 100))); }}
              className="ux-press ux-sq rounded-[12px] border px-3.5 py-2 text-xsm font-medium"
              style={{ borderColor: "var(--ux-line-strong)", color: "var(--ux-ink)" }}
            >
              {v === money.balanceMinor ? "All of it" : rupees(v)}
            </button>
          ))}
        </div>

        {tooMuch && (
          <p className="ux-slide-up mt-3 flex items-start gap-2 text-xsm" style={{ color: "var(--ux-orange-ink)" }}>
            <Icons.AlertCircle className="mt-[1px] h-[14px] w-[14px] shrink-0" />
            You have {rupees(money.balanceMinor)} available. The other {rupees(money.pendingMinor)} is still on its way.
          </p>
        )}
        {tooLittle && (
          <p className="ux-slide-up mt-3 flex items-start gap-2 text-xsm" style={{ color: "var(--ux-orange-ink)" }}>
            <Icons.AlertCircle className="mt-[1px] h-[14px] w-[14px] shrink-0" />{tr("walletWithdraw.theSmallestWithdrawalIs")}</p>
        )}

        {/* Available and pending are separate lines, always. A withdrawal that
            bounces costs her a day and her confidence in the wallet. */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 border-t pt-4" style={{ borderColor: "var(--ux-line)" }}>
          <div className="ux-sq rounded-[12px] p-3" style={{ background: "var(--ux-tint-green)" }}>
            <p className="text-2xs uppercase tracking-[0.06em]" style={{ color: "var(--ux-green-ink)" }}>{tr("walletWithdraw.availableNow")}</p>
            <p className="mt-1 text-lg font-bold tabular-nums" style={{ color: "var(--ux-ink)" }}>{rupees(money.balanceMinor)}</p>
          </div>
          <div className="ux-sq rounded-[12px] p-3" style={{ background: "var(--ux-surface-2)" }}>
            <p className="text-2xs uppercase tracking-[0.06em]" style={{ color: "var(--ux-faint)" }}>{tr("walletWithdraw.stillOnItsWay")}</p>
            <p className="mt-1 text-lg font-bold tabular-nums" style={{ color: "var(--ux-muted)" }}>{rupees(money.pendingMinor)}</p>
          </div>
        </div>
      </Card>

      <Card>
        <SectionHead title={tr("walletWithdraw.whereItGoes")} action="Manage" onAction={() => { window.location.href = "/app/settings/payments"; }} />
        {!PAYOUT_METHODS.length && (
          <div className="ux-sq rounded-[12px] border p-4" style={{ borderColor: "var(--ux-line)" }}>
            <p className="text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{tr("walletWithdraw.youHaveNotAddedABank")}</p>
            <div className="mt-3">
              <Btn href="/app/settings/payments" variant="primary" size="sm" iconEnd="ArrowRight">{tr("walletWithdraw.addAWayToGetPaid")}</Btn>
            </div>
          </div>
        )}
        <div className="ux-deck space-y-2.5">
          {PAYOUT_METHODS.map((m, i) => {
            const on = chosenId === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                aria-pressed={on}
                className="ux-i ux-sq flex w-full items-center gap-3.5 rounded-[12px] border p-3.5 text-start"
                style={{
                  borderColor: on ? "var(--ux-brand)" : "var(--ux-line)",
                  background: on ? "var(--ux-brand-tint)" : "var(--ux-surface)",
                  ["--i" as string]: i,
                }}
              >
                <IconTile icon={m.icon} tint={m.tint} ink={m.ink} size={42} radius={11} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{m.label}</span>
                    {m.verified && <Icons.BadgeCheck className="h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-blue)" }} />}
                  </span>
                  <span className="mt-0.5 block truncate text-xs" style={{ color: "var(--ux-muted)" }}>{m.detail}</span>
                </span>
                {on && <Icons.CheckCircle2 className="ux-pop h-[19px] w-[19px] shrink-0" style={{ color: "var(--ux-brand)" }} />}
              </button>
            );
          })}
        </div>
      </Card>
    </HomeShell>
  );
}
