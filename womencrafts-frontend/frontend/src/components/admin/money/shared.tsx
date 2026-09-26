"use client";

import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { Alert, Avatar, Badge, Input, type Tone } from "@/design-system";
import { formatMoney } from "@/components/ux/kit/money";
import type { Person } from "@/lib/money-admin-api";

/**
 * The bits the five money screens share, so they read as one module.
 *
 * `money()` is the ONLY formatter these screens use. Every amount on this side
 * is paise (`*_minor`), and `formatMoney` divides by 100 — `formatWholeRupees`
 * would render every figure a hundred times too large.
 */

/** Paise → "₹1,234.00". Exact by default: this side reconciles with a bank. */
export const money = (minor: number | null | undefined, exact = true) =>
  formatMoney(Number(minor) || 0, exact);

/** "1,234.50" → 123450; null when it is not an amount a bank would accept. */
export function rupeesToMinor(raw: string): number | null {
  const cleaned = raw.replace(/[₹,\s]/g, "");
  if (!cleaned || !/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const n = Math.round(parseFloat(cleaned) * 100);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export const ORDER_TONE: Record<string, Tone> = {
  created: "amber", paid: "emerald", failed: "rose", refunded: "sky", cancelled: "slate",
};
export const ORDER_LABEL: Record<string, string> = {
  created: "Awaiting payment", paid: "Paid", failed: "Failed", refunded: "Refunded", cancelled: "Cancelled",
};

export const PAYOUT_TONE: Record<string, Tone> = { pending: "amber", paid: "emerald", failed: "rose" };
export const PAYOUT_LABEL: Record<string, string> = { pending: "Pending", paid: "Paid out", failed: "Failed" };

export const SOURCE_LABEL: Record<string, string> = {
  refund: "Refund", referral: "Referral", scholarship: "Scholarship", goodwill: "Goodwill",
  spend: "Spent", payout: "Withdrawal", payout_reversal: "Withdrawal returned", adjustment: "Adjustment",
};
export const sourceLabel = (s: string) => SOURCE_LABEL[s] ?? (s ? s.replace(/_/g, " ") : "Other");

export const searchClass =
  "w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50";

export const thClass = "px-3 py-2.5";
export const trHead = "border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle";
export const trRow = "border-b border-line last:border-0 hover:bg-surface-2";

/** Header with the icon tile, matching the staff screen. */
export function PageHeader({
  icon: Icon, title, subtitle, action,
}: { icon: React.ElementType; title: string; subtitle: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
          <Icon className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-subtle">{subtitle}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

/** The plain statement every money screen carries: nothing here moves money. */
export function HonestyNote({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <Alert variant="info" title={title} className="mt-4">
      {children}
    </Alert>
  );
}

export function PersonCell({ person, sub }: { person: Person | null | undefined; sub?: ReactNode }) {
  const name = person?.name || "Account removed";
  return (
    <div className="flex items-center gap-3">
      <Avatar name={name} src={person?.avatar || null} size="sm" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink">{name}</p>
        {sub && <p className="truncate text-xs text-ink-subtle">{sub}</p>}
      </div>
    </div>
  );
}

export function StatusBadge({ value, tones, labels }: {
  value: string; tones: Record<string, Tone>; labels: Record<string, string>;
}) {
  return <Badge tone={tones[value] ?? "slate"}>{labels[value] ?? value}</Badge>;
}

export function TableEmpty({
  icon: Icon = Inbox, title, description,
}: { icon?: React.ElementType; title: string; description: string }) {
  return (
    <div className="px-6 py-14 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-brand-ink">
        <Icon className="h-6 w-6" />
      </span>
      <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-ink-subtle">{description}</p>
    </div>
  );
}

export function DateRange({
  from, to, onChange,
}: { from: string; to: string; onChange: (next: { from: string; to: string }) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Input type="date" aria-label="From" value={from} className="w-40"
             onChange={(e) => onChange({ from: e.target.value, to })} />
      <span className="text-xs text-ink-subtle">to</span>
      <Input type="date" aria-label="To" value={to} className="w-40"
             onChange={(e) => onChange({ from, to: e.target.value })} />
    </div>
  );
}

export function showingLabel(total: number, page: number, pageSize: number, noun: string) {
  if (total === 0) return `No ${noun}`;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return `Showing ${first} to ${last} of ${total} ${noun}`;
}
