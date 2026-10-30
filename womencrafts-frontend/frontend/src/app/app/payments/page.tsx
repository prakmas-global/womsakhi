"use client";

import { useCallback, useMemo, useState } from "react";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, I, v } from "@/components/ux/kit";
import { apiClient } from "@/lib/api";
import { useResource } from "@/lib/use-resource";

interface PaymentRecord {
  id: string; kind: string; direction: "sent" | "received"; title: string; recipient: string;
  amount_minor: number; status: string; reference: string; note: string; href: string;
  submitted_at: string; confirmed_at: string; updated_at: string; method: string; legacy: boolean; currency: string;
}
interface Activity { items: PaymentRecord[]; currency: string; mode: string }
const EMPTY: Activity = { items: [], currency: "INR", mode: "direct_upi" };
const STATES: Record<string, string> = { awaiting: "Awaiting payment", claimed: "Awaiting confirmation", paid: "Confirmed received", declined: "Not confirmed", cancelled: "Cancelled", created: "Earlier pending record", failed: "Earlier failed record", refunded: "Refund recorded" };
const day = (value: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" }).format(new Date(value));

export default function PaymentsPage() {
  const records = useResource(useCallback(async (signal: AbortSignal) => (await apiClient.get<Activity>("/payments/activity", { signal })).data, []), EMPTY);
  const [direction, setDirection] = useState("all");
  const [status, setStatus] = useState("all");
  const [hidden, setHidden] = useState(false);
  const rows = useMemo(() => records.data.items.filter(row => (direction === "all" || row.direction === direction) && (status === "all" || row.status === status)), [records.data.items, direction, status]);
  const money = (minor: number, currency: string) => new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100);
  return <HomeShell active="/app/payments">
    <header className="mb-5"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: v("--ux-brand") }}><I name="Receipt" className="h-4 w-4" /> Direct UPI payment records</p><h1 className="mt-2 text-2xl font-extrabold">My Payments</h1>
      <p className="mt-2 max-w-[65ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>Pay the provider directly using their UPI ID. Submit your transaction reference, then wait for the recipient to check their UPI account and confirm receipt.</p>
      <div className="mt-3 flex flex-wrap gap-2"><Btn href="/app/money" variant="outline" size="sm" icon="NotebookPen">My Money notebook</Btn><Btn href="/app/teach" variant="ghost" size="sm">My courses</Btn><Btn href="/app/mentoring" variant="ghost" size="sm">My mentoring</Btn></div>
    </header>
    <div className="space-y-4" data-my-payments>
      <Card><h2 className="text-sm font-bold">UPI payment → Submit reference → Recipient confirms</h2><p className="mt-2 text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>Submitting proof means “Awaiting confirmation”. It does not confirm receipt. WomSakhi does not hold or transfer this payment, and no wallet balance is created.</p></Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Payment direction">{[["all", "All"], ["sent", "Payments I make"], ["received", "Payments to me"]].map(([id, label]) => <button key={id} type="button" onClick={() => setDirection(id)} aria-pressed={direction === id} className="min-h-11 rounded-full border px-3 text-xs font-semibold" style={{ background: v(direction === id ? "--ux-brand-tint" : "--ux-surface"), color: v(direction === id ? "--ux-brand" : "--ux-ink"), borderColor: v("--ux-line") }}>{label}</button>)}</div>
        <button type="button" onClick={() => setHidden(!hidden)} aria-label={hidden ? "Show payment amounts" : "Hide payment amounts"} aria-pressed={hidden} className="grid h-11 w-11 place-items-center rounded-full border" style={{ borderColor: v("--ux-line") }}><I name={hidden ? "EyeOff" : "Eye"} className="h-5 w-5" /></button>
      </div>
      <label className="block text-sm font-semibold">Payment status<select aria-label="Payment status" value={status} onChange={event => setStatus(event.target.value)} className="wc-field mt-1 block min-h-11 w-full rounded-xl border px-3 text-sm" style={{ background: v("--ux-surface"), color: v("--ux-ink"), borderColor: v("--ux-line") }}><option value="all">All statuses</option>{["awaiting", "claimed", "paid", "declined", "cancelled"].map(key => <option key={key} value={key}>{STATES[key]}</option>)}</select></label>
      {records.source === "error" ? <Card><p role="alert">Your payment records could not load. Your saved submissions have not changed.</p><div className="mt-3"><Btn variant="outline" onClick={records.refetch}>Try again</Btn></div></Card>
        : records.source === "loading" ? <p role="status">Loading payment records…</p>
        : rows.length === 0 ? <Card><h2 className="font-bold">No matching payment records</h2><p className="mt-2 text-sm" style={{ color: v("--ux-muted") }}>Paid course and mentoring requests appear here. Use their detail pages to pay by UPI and submit a reference.</p></Card>
        : <ul className="space-y-3">{rows.map(row => <li key={row.id} data-payment-id={row.id}><Card><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0 flex-1"><h2 className="break-words text-sm font-bold">{row.title}</h2><p className="mt-1 text-xs" style={{ color: v("--ux-muted") }}>{row.direction === "sent" ? `To ${row.recipient}` : "Payment to you"} · {row.legacy ? "Earlier payment record" : "Direct UPI"}</p></div><span className="text-base font-bold tabular-nums" aria-label={hidden ? "Amount hidden" : undefined}>{hidden ? "••••" : money(row.amount_minor, row.currency || records.data.currency)}</span></div>
          <p className="mt-3 text-sm font-semibold" style={{ color: v(row.status === "paid" ? "--ux-green-ink" : "--ux-ink") }}>{row.legacy ? `Earlier record: ${row.status}` : STATES[row.status] || "Recorded status"}</p>
          {row.reference && <p className="mt-2 break-all text-xs" style={{ color: v("--ux-muted") }}>UPI reference: {row.reference}</p>}
          {row.submitted_at && <p className="mt-1 text-xs" style={{ color: v("--ux-muted") }}>Submitted {day(row.submitted_at)}</p>}
          {row.confirmed_at && <p className="mt-1 text-xs" style={{ color: v("--ux-muted") }}>{row.legacy ? "Recorded" : "Recipient confirmed"} {day(row.confirmed_at)}</p>}
          {row.note && <p className="mt-2 break-words text-sm">Recipient’s note: {row.note}</p>}
          <div className="mt-3"><Btn href={row.href} variant="outline" size="sm">{row.legacy ? "View details" : row.direction === "received" && ["claimed", "awaiting"].includes(row.status) ? "Review payment" : row.status === "awaiting" && row.direction === "sent" ? "Pay by UPI & submit reference" : "View payment details"}</Btn></div>
        </Card></li>)}</ul>}
      <p className="text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>Includes up to 500 course and 500 mentoring payment records, plus up to 200 earlier payment records. These records are separate from your personal notebook and are not a bank statement.</p>
    </div>
  </HomeShell>;
}
