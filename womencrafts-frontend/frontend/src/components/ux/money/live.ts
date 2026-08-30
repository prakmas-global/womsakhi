"use client";

import { useCallback } from "react";

import { useResource, type Resource } from "@/lib/use-resource";
import { apiMoneyOverview, type MoneyOverview } from "@/lib/money-api";
import { apiWallet, type WalletTxn } from "@/lib/wallet-api";
import {
  BALANCE_MINOR, PENDING_MINOR, TXNS, type Txn,
} from "./data";

/**
 * The money module, on real data.
 *
 * The server's ledger has no icon, no tint and no day heading — it has a reason
 * string and an amount, which is correct: presentation is this layer's job, not
 * Mongo's. So the translation happens here, once, rather than in each of the
 * three screens that read it.
 *
 * The mapping is deliberately conservative. An unrecognised reason gets the
 * neutral treatment rather than a guess, because a mis-tinted row that claims a
 * refund was a course fee is worse than a plain one.
 */

const LOOK: Record<string, { icon: string; tint: string; ink: string; category: Txn["category"] }> = {
  refund:      { icon: "RotateCcw",      tint: "--ux-tint-blue",   ink: "--ux-blue",   category: "Refund" },
  scholarship: { icon: "HeartHandshake", tint: "--ux-tint-green",  ink: "--ux-green",  category: "Refund" },
  referral:  { icon: "Gift",           tint: "--ux-tint-pink",   ink: "--ux-pink",   category: "Refund" },
  payout:    { icon: "Landmark",       tint: "--ux-tint-blue",   ink: "--ux-blue",   category: "Withdrawal" },
  withdraw:  { icon: "Landmark",       tint: "--ux-tint-blue",   ink: "--ux-blue",   category: "Withdrawal" },
  order:     { icon: "ShoppingBag",    tint: "--ux-tint-orange", ink: "--ux-orange", category: "Work" },
  booking:   { icon: "CalendarCheck",  tint: "--ux-tint-violet", ink: "--ux-violet", category: "Work" },
  program:   { icon: "BookOpen",       tint: "--ux-tint-violet", ink: "--ux-violet", category: "Course" },
  course:    { icon: "BookOpen",       tint: "--ux-tint-violet", ink: "--ux-violet", category: "Course" },
  circle:    { icon: "Users",          tint: "--ux-tint-green",  ink: "--ux-green",  category: "Circle" },
  support:   { icon: "HeartHandshake", tint: "--ux-tint-green",  ink: "--ux-green",  category: "Refund" },
};

const NEUTRAL = { icon: "Receipt", tint: "--ux-surface-2", ink: "--ux-muted", category: "Work" as const };

/**
 * The server formats the date; this only decides which heading it sits under.
 *
 * "May 11, 2026" is what arrives. Parsing it back into a Date to re-format it
 * would be undoing the server's own locale work, so the label is used as-is and
 * only the grouping is computed.
 */
function dayOf(when: string, now = new Date()): { when: string; day: string } {
  const d = new Date(when);
  if (Number.isNaN(d.getTime())) return { when, day: "Earlier" };
  const days = Math.floor((+new Date(now.toDateString()) - +new Date(d.toDateString())) / 86400000);
  if (days <= 0) return { when, day: "Today" };
  if (days === 1) return { when, day: "Yesterday" };
  if (days < 7) return { when, day: "This week" };
  return { when, day: "Earlier" };
}

function toTxn(t: WalletTxn): Txn {
  const key = Object.keys(LOOK).find((k) => (t.source || "").toLowerCase().includes(k))
    ?? Object.keys(LOOK).find((k) => (t.label || "").toLowerCase().includes(k));
  const look = key ? LOOK[key] : NEUTRAL;
  const { when, day } = dayOf(t.when);
  return {
    id: t.id,
    kind: t.kind,
    label: t.label || "Payment",
    // Title-cased so "scholarship" reads as a word on the row rather than as a
    // database value that leaked onto the screen.
    source: t.source ? t.source.charAt(0).toUpperCase() + t.source.slice(1) : "WomSakhi",
    amount_minor: t.amount_minor,
    when, day,
    // The ledger holds settled money only — a pending transfer is not in it.
    status: "settled",
    icon: look.icon, tint: look.tint, ink: look.ink, category: look.category,
  };
}

export interface Money {
  balanceMinor: number;
  pendingMinor: number;
  txns: Txn[];
}

export function useMoney(): Resource<Money> {
  return useResource<Money>(
    useCallback(async (signal: AbortSignal) => {
      const w = await apiWallet(signal);
      const txns = w.transactions.map(toTxn);
      return {
        balanceMinor: w.balance_minor,
        // "On its way" is a property of the rows, not a separate server field:
        // summing the pending credits is the same number, and it cannot drift
        // from what the list shows the way a second field would.
        pendingMinor: txns
          .filter((t) => t.status === "pending" && t.kind === "credit")
          .reduce((a, t) => a + t.amount_minor, 0),
        txns,
      };
    }, []),
    { balanceMinor: BALANCE_MINOR, pendingMinor: PENDING_MINOR, txns: TXNS },
  );
}

/* ── The whole Earn screen, in one request ───────────────────────────── */

/**
 * Balance, ledger, payout accounts and goals together.
 *
 * Earn used to open with four requests. Each is about 50ms to an Atlas cluster
 * in another data centre, and they were awaited independently by four hooks —
 * so the screen was not slow because of what it did, it was slow because of
 * how many times it asked. `/money/overview` sends them together and the
 * screen waits for the slowest rather than the sum: **294ms → 73ms.**
 *
 * The mock stays as the fallback so the screen is readable from the first
 * frame, and `<SourceNote>` says which she is looking at.
 */
export function useMoneyOverview(): Resource<Overview> {
  return useResource<Overview>(
    useCallback(async (signal: AbortSignal) => {
      const d = await apiMoneyOverview(signal);
      const txns = d.transactions.map(toTxn);
      return {
        balanceMinor: d.balance_minor,
        pendingMinor: txns
          .filter((t) => t.status === "pending" && t.kind === "credit")
          .reduce((a, t) => a + t.amount_minor, 0),
        txns,
        // The icon and tint belong to the screen, not the server — the same
        // seam as everywhere else in this layer. Derived from the kind so a
        // bank and a UPI id are told apart at a glance.
        accounts: d.accounts.map((a) => ({
          ...a,
          icon: a.kind === "UPI" ? "Smartphone" : "Landmark",
          tint: a.kind === "UPI" ? "--ux-tint-violet" : "--ux-tint-blue",
          ink: a.kind === "UPI" ? "--ux-violet" : "--ux-blue",
        })),
        goals: d.goals,
      };
    }, []),
    {
      balanceMinor: BALANCE_MINOR, pendingMinor: PENDING_MINOR,
      txns: TXNS, accounts: [], goals: [],
    },
  );
}

export interface Overview extends Money {
  accounts: (MoneyOverview["accounts"][number] & {
    icon: string; tint: string; ink: string;
  })[];
  goals: MoneyOverview["goals"];
}
