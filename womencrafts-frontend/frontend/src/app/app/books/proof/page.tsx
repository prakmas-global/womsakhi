"use client";

import { useCallback, useState } from "react";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn, Card, escapeHtml, I, printDocument, v } from "@/components/ux/kit";
import { apiProof, type Proof } from "@/lib/books-api";
import { useResource } from "@/lib/use-resource";
import { useAuth } from "@/context/AuthContext";

const EMPTY: Proof = { months: [], total_minor: 0, months_counted: 0, months_with_earnings: 0, average_minor: 0 };
const money = (minor: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100);
const BASIS = "Based on payments marked received in Customer dues. Outstanding customer dues and upcoming work are excluded.";
const NOTE = "This is a summary of recorded business receipts, not a verified income certificate or a bank statement.";

/** Preview, share and print all use this same received-payments summary. */
export default function BusinessIncomeSummaryPage() {
  const book = useResource(useCallback((signal: AbortSignal) => apiProof(6, signal), []), EMPTY);
  const { user } = useAuth();
  const [notice, setNotice] = useState("");
  const [sharing, setSharing] = useState(false);
  const summary = book.data;
  const name = user?.full_name?.trim() || "Account holder";
  const period = summary.months.length ? `${summary.months[0].month} to ${summary.months[summary.months.length - 1].month}` : "";
  const receipts = summary.months.reduce((total, month) => total + month.orders, 0);
  const ready = book.source === "live" && receipts > 0;
  const text = ["Business income summary", name, period, BASIS, `Total received: ${money(summary.total_minor)}`, `Monthly average: ${money(summary.average_minor)}`, `Recorded receipts: ${receipts}`, "", "Monthly breakdown:", ...summary.months.map(month => `${month.month}: ${money(month.minor)} · ${month.orders} receipts · ${month.customers} customers`), "", NOTE].join("\n");
  const share = async () => {
    if (!ready || sharing) return;
    setSharing(true); setNotice("");
    try {
      if (navigator.share) { await navigator.share({ title: "Business income summary", text }); setNotice("Summary shared."); }
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); setNotice("Summary copied. Paste it wherever you want to share it."); }
      else setNotice("Sharing is unavailable in this browser. Use Print / save PDF instead.");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setNotice("The summary could not be shared. Try again or use Print / save PDF.");
    } finally { setSharing(false); }
  };
  const print = () => {
    if (!ready) return;
    const rows = summary.months.map(month => `<tr><td>${escapeHtml(month.month)}</td><td class="num">${escapeHtml(money(month.minor))}</td><td class="num">${month.orders}</td><td class="num">${month.customers}</td></tr>`).join("");
    setNotice(printDocument("Business income summary", `<h1>Business income summary</h1><p>${escapeHtml(name)}</p><p class="sub">${escapeHtml(period)}</p><p>${escapeHtml(BASIS)}</p><h2>Summary</h2><table><tbody><tr><td>Total received</td><td class="num">${escapeHtml(money(summary.total_minor))}</td></tr><tr><td>Monthly average</td><td class="num">${escapeHtml(money(summary.average_minor))}</td></tr><tr><td>Recorded receipts</td><td class="num">${receipts}</td></tr></tbody></table><h2>Monthly breakdown</h2><table><thead><tr><th>Month</th><th class="num">Received</th><th class="num">Receipts</th><th class="num">Customers</th></tr></thead><tbody>${rows}</tbody></table><p class="foot">${escapeHtml(NOTE)}</p>`));
  };
  return <HomeShell active="/app/books">
    <Back to="/app/books" label="Customer dues" className="mb-4" />
    <header className="mb-5"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: v("--ux-brand") }}><I name="Receipt" className="h-4 w-4" /> Business records</p><h1 className="mt-2 text-2xl font-extrabold">Business income summary</h1><p className="mt-2 max-w-[65ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>Review received customer payments month by month, including course and mentoring receipts recorded in your business books.</p></header>
    <div className="space-y-4" data-business-income-summary>
      {book.source === "loading" ? <p role="status">Loading your business income summary…</p>
        : book.source === "error" ? <Card><p role="alert">Your business income summary could not load. Your saved customer records have not changed.</p><div className="mt-3"><Btn variant="outline" onClick={book.refetch}>Try again</Btn></div></Card>
        : <>
          <Card><p className="font-semibold">{name}</p><p className="mt-1 text-sm" style={{ color: v("--ux-muted") }}>{period}</p><p className="mt-3 text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>{BASIS}</p></Card>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{[["Total received", money(summary.total_minor)], ["Monthly average", money(summary.average_minor)], ["Recorded receipts", String(receipts)]].map(([label, value]) => <Card key={label}><h2 className="text-xs font-semibold" style={{ color: v("--ux-muted") }}>{label}</h2><p className="mt-2 break-all text-2xl font-bold tabular-nums">{value}</p></Card>)}</div>
          {!ready && <Card><h2 className="font-bold">No received payments recorded for this period</h2><p className="mt-2 text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>Customer records appear here after you mark their payments as received. Unpaid dues and upcoming work stay in Customer dues.</p><div className="mt-3"><Btn href="/app/books" variant="outline">Open Customer dues</Btn></div></Card>}
          <Card><h2 className="mb-3 text-lg font-bold">Monthly breakdown</h2><div className="overflow-x-auto"><table className="w-full text-left text-xs sm:text-sm"><caption className="sr-only">Recorded customer receipts for {period}</caption><thead><tr className="border-b" style={{ borderColor: v("--ux-line") }}><th scope="col" className="py-3 pr-3 font-semibold">Month</th><th scope="col" className="py-3 pr-3 text-right font-semibold">Received</th><th scope="col" className="py-3 pr-3 text-right font-semibold">Receipts</th><th scope="col" className="py-3 text-right font-semibold">Customers</th></tr></thead><tbody>{summary.months.map(month => <tr key={month.month} className="border-b last:border-0" style={{ borderColor: v("--ux-line") }}><th scope="row" className="py-3 pr-3 font-medium">{month.month}</th><td className="whitespace-nowrap py-3 pr-3 text-right tabular-nums">{money(month.minor)}</td><td className="py-3 pr-3 text-right tabular-nums">{month.orders}</td><td className="py-3 text-right tabular-nums">{month.customers}</td></tr>)}</tbody></table></div></Card>
          <p className="text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>{NOTE}</p>
          <div className="flex flex-wrap gap-2"><Btn icon="Share2" onClick={() => void share()} loading={sharing} disabled={!ready || sharing}>Share summary</Btn><Btn variant="outline" icon="Printer" onClick={print} disabled={!ready}>Print / save PDF</Btn></div>
          {notice && <p role="status" className="text-sm" style={{ color: v("--ux-ink-2") }}>{notice}</p>}
        </>}
    </div>
  </HomeShell>;
}
