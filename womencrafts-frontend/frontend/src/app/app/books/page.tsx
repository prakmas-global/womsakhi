"use client";

import { useCallback, useMemo, useState } from "react";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, I, v } from "@/components/ux/kit";
import { Label, Select, Text } from "@/components/ux/kit/form";
import { Sheet } from "@/components/ux/kit/sheet";
import { isoDay, toMinor } from "@/components/ux/khata/days";
import { apiAddEntry, apiBooks, apiDeleteEntry, apiEditEntry, type BookEntry, type Books, type EntryState, type EntryVia } from "@/lib/books-api";
import { useResource } from "@/lib/use-resource";
import { apiErrorMessage } from "@/lib/api";
import { useConfirm } from "@/design-system/feedback/ConfirmProvider";
import { toast } from "@/components/ux/mobile/Toast";

const EMPTY: Books = { entries: [], paid_minor: 0, owed_minor: 0, promised_minor: 0, late_count: 0 };
const STATES = [{ value: "owed", label: "Outstanding — work delivered, payment due" }, { value: "promised", label: "Upcoming work — not delivered yet" }, { value: "paid", label: "Received — customer already paid" }];
const CHANNELS = [{ value: "person", label: "In person" }, { value: "whatsapp", label: "WhatsApp" }, { value: "shop", label: "Shop" }, { value: "circle", label: "Circle" }];
const TABS = [{ id: "owed", label: "Outstanding" }, { id: "promised", label: "Upcoming work" }, { id: "paid", label: "Received" }] as const;
const LABELS = { owed: "Payment outstanding", promised: "Upcoming work", paid: "Received from customer" };
const amount = (minor: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: minor % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(minor / 100);
const displayDay = (value: string) => value ? new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" }).format(new Date(value)) : "No date set";
const inputDay = (value: string) => value ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)) : "";
const automatic = (row: BookEntry) => row.via === "course" || row.via === "mentoring";

export default function CustomerDuesPage() {
  const book = useResource(useCallback((signal: AbortSignal) => apiBooks(signal), []), EMPTY);
  const [tab, setTab] = useState<EntryState>("owed");
  const [editing, setEditing] = useState<BookEntry | "new" | null>(null);
  const [receiving, setReceiving] = useState<BookEntry | null>(null);
  const [busy, setBusy] = useState("");
  const [hidden, setHidden] = useState(false);
  const confirm = useConfirm();
  const rows = useMemo(() => book.data.entries.filter(row => row.state === tab), [book.data.entries, tab]);
  const remove = async (row: BookEntry) => {
    if (busy || !await confirm({ title: "Remove this customer record?", description: "This removes the record from Customer dues and its business summaries. It does not change your personal notebook or reverse a payment.", confirmLabel: "Remove record", danger: true })) return;
    setBusy(row.id);
    try { await apiDeleteEntry(row.id); book.refetch(); toast("Customer record removed", { tone: "success" }); }
    catch (error) { toast(apiErrorMessage(error), { tone: "error" }); }
    finally { setBusy(""); }
  };
  return <HomeShell active="/app/books">
    <header className="mb-5"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: v("--ux-brand") }}><I name="Users" className="h-4 w-4" /> My Money · Business records</p>
      <h1 className="mt-2 text-2xl font-extrabold">Customer dues</h1><p className="mt-2 max-w-[65ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>Track what customers still need to pay you. Keep upcoming work separate, and record money as received only after it reaches you.</p>
      <div className="mt-3 flex flex-wrap gap-2"><Btn href="/app/money" variant="outline" size="sm" icon="NotebookPen">My Money notebook</Btn><Btn href="/app/books/proof" variant="ghost" size="sm">Business income summary</Btn><Btn href="/app/books/season" variant="ghost" size="sm">My busy months</Btn></div>
    </header>
    <div className="space-y-4" data-customer-dues>
      <Card><p className="text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>Customer dues are business records. They are not a bank balance and are not automatically added to the personal notebook’s monthly totals. Record each receipt once within the book you use.</p></Card>
      <div className="flex flex-wrap items-center justify-between gap-3"><Btn icon="Plus" onClick={() => setEditing("new")}>Add customer record</Btn><button type="button" aria-label={hidden ? "Show customer amounts" : "Hide customer amounts"} aria-pressed={hidden} onClick={() => setHidden(!hidden)} className="grid h-11 w-11 place-items-center rounded-full border" style={{ borderColor: v("--ux-line") }}><I name={hidden ? "EyeOff" : "Eye"} className="h-5 w-5" /></button></div>
      {book.source === "live" && <div className="grid grid-cols-2 gap-3"><Card><h2 className="text-xs font-semibold">Customers still owe</h2><p className="mt-2 break-all text-2xl font-bold tabular-nums">{hidden ? "••••" : amount(book.data.owed_minor)}</p></Card><Card><h2 className="text-xs font-semibold">Overdue records</h2><p className="mt-2 text-2xl font-bold">{book.data.late_count}</p><p className="mt-1 text-xs" style={{ color: v("--ux-muted") }}>Only unpaid records past their due date</p></Card></div>}
      <div role="group" aria-label="Customer record status" className="grid grid-cols-3 gap-2">{TABS.map(item => <button key={item.id} type="button" aria-pressed={tab === item.id} onClick={() => setTab(item.id)} className="min-h-12 rounded-xl border px-2 py-2 text-xs font-bold" style={{ background: v(tab === item.id ? "--ux-brand-tint" : "--ux-surface"), color: v(tab === item.id ? "--ux-brand" : "--ux-ink"), borderColor: v("--ux-line") }}>{item.label}</button>)}</div>
      <p className="text-xs" style={{ color: v("--ux-muted") }}>{tab === "owed" ? "Work already delivered, with payment still due." : tab === "promised" ? "Work you agreed to do. This is not money received or an overdue customer payment." : "Recorded customer receipts, including course and mentoring income. This is not your personal notebook total."}</p>
      {book.source === "error" ? <Card><p role="alert">Your customer records could not load. Your saved records have not changed.</p><div className="mt-3"><Btn variant="outline" onClick={book.refetch}>Try again</Btn></div></Card>
        : book.source === "loading" ? <p role="status">Loading customer records…</p>
        : !rows.length ? <Card><h2 className="font-bold">{tab === "owed" ? "No outstanding customer dues" : tab === "promised" ? "No upcoming work recorded" : "No customer receipts recorded"}</h2><p className="mt-2 text-sm" style={{ color: v("--ux-muted") }}>Add a customer record to track their order and payment stage.</p></Card>
        : <ul className="space-y-3">{rows.map(row => <li key={row.id} data-customer-id={row.id}><Card><div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><h2 className="break-words text-sm font-bold">{row.who}</h2><p className="mt-1 break-words text-sm" style={{ color: v("--ux-muted") }}>{row.what || "Customer payment"}</p></div><span className="shrink-0 text-base font-bold tabular-nums">{hidden ? "••••" : amount(row.minor)}</span></div>
          <p className="mt-3 text-xs font-semibold">{LABELS[row.state]}</p><p className="mt-1 text-xs" style={{ color: v("--ux-muted") }}>{row.state === "paid" ? `Recorded date: ${displayDay(row.on)}` : `Due: ${displayDay(row.due)}`}{row.late_days > 0 && ` · ${row.late_days} days overdue`}</p>
          {automatic(row) ? <div className="mt-3"><p className="mb-2 text-xs" style={{ color: v("--ux-muted") }}>From a confirmed {row.via === "course" ? "course" : "mentoring"} payment. Review its original record in My Payments.</p><Btn href="/app/payments" variant="outline" size="sm">My Payments</Btn></div> : <div className="mt-3 flex flex-wrap gap-2">{row.state !== "paid" && <Btn size="sm" onClick={() => setReceiving(row)} disabled={Boolean(busy)}>Record money received</Btn>}<Btn variant="outline" size="sm" onClick={() => setEditing(row)} disabled={Boolean(busy)}>Edit</Btn><Btn variant="ghost" size="sm" onClick={() => void remove(row)} disabled={Boolean(busy)}>Remove</Btn></div>}
        </Card></li>)}</ul>}
      {editing && <CustomerSheet row={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={state => { setEditing(null); setTab(state); book.refetch(); }} />}
      {receiving && <ReceiveSheet row={receiving} hidden={hidden} onClose={() => setReceiving(null)} onSaved={() => { setReceiving(null); setTab("paid"); book.refetch(); }} />}
    </div>
  </HomeShell>;
}

function CustomerSheet({ row, onClose, onSaved }: { row: BookEntry | null; onClose: () => void; onSaved: (state: EntryState) => void }) {
  const [who, setWho] = useState(row?.who || ""); const [what, setWhat] = useState(row?.what || "");
  const [rupees, setRupees] = useState(row ? String(row.minor / 100) : ""); const [state, setState] = useState<EntryState>(row?.state || "owed");
  const [via, setVia] = useState<EntryVia>(row?.via || "person"); const [due, setDue] = useState(inputDay(row?.due || ""));
  const [on, setOn] = useState(row?.on ? inputDay(row.on) : isoDay()); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  return <Sheet open onClose={onClose} title={row ? "Edit customer record" : "Add customer record"} description="Track a business payment. This does not send money or add an entry to your personal notebook."><form className="space-y-4" onSubmit={async event => {
    event.preventDefault(); const minor = toMinor(rupees); if (busy) return;
    if (!who.trim() || minor <= 0 || !Number.isSafeInteger(minor)) { setError("Add a customer name and an amount greater than zero."); return; }
    setBusy(true); setError("");
    try { const body = { who: who.trim(), what: what.trim(), minor, state, via, due: due && state !== "paid" ? new Date(`${due}T12:00:00+05:30`).toISOString() : null, on: new Date(`${on}T12:00:00+05:30`).toISOString() }; if (row) await apiEditEntry(row.id, body); else await apiAddEntry(body); onSaved(state); toast("Customer record saved", { tone: "success" }); }
    catch (e) { setError(apiErrorMessage(e)); } finally { setBusy(false); }
  }}>
    <div><Label need>Customer name</Label><Text label="Customer name" name="customer_name" value={who} onChange={setWho} required max={80} disabled={busy} /></div>
    <div><Label>Order or work</Label><Text label="Order or work" name="customer_work" value={what} onChange={setWhat} max={140} disabled={busy} /></div>
    <div><Label need>Amount</Label><Text label="Customer amount" name="customer_amount" value={rupees} onChange={setRupees} prefix="₹" inputMode="decimal" required disabled={busy} /></div>
    <div><Label>Payment stage</Label><Select label="Customer payment stage" value={state} onChange={value => { if (value === "paid" && state !== "paid") setOn(isoDay()); setState(value as EntryState); }} options={STATES} /></div>
    <div><Label>{state === "paid" ? "When did you receive it?" : "Order date"}</Label><Text label="Customer record date" name="customer_date" type="date" value={on} onChange={setOn} required maxDate={isoDay()} disabled={busy} /></div>
    {state !== "paid" && <div><Label hint="Optional">Payment due date</Label><Text label="Customer due date" name="customer_due" type="date" value={due} onChange={setDue} disabled={busy} /></div>}
    <div><Label>Where was the order agreed?</Label><Select label="Customer order source" value={via} onChange={value => setVia(value as EntryVia)} options={CHANNELS} /></div>
    {error && <p role="alert" className="text-sm">{error}</p>}<div className="flex gap-2"><Btn type="submit" loading={busy} disabled={busy}>Save customer record</Btn><Btn variant="ghost" onClick={onClose} disabled={busy}>Cancel</Btn></div>
  </form></Sheet>;
}

function ReceiveSheet({ row, hidden, onClose, onSaved }: { row: BookEntry; hidden: boolean; onClose: () => void; onSaved: () => void }) {
  const [on, setOn] = useState(isoDay()); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  return <Sheet open onClose={onClose} title="Record money received" description="Only record money that has already reached you. This updates this customer record once; it does not verify a UPI transfer or add a personal notebook entry."><form className="space-y-4" onSubmit={async event => {
    event.preventDefault(); if (busy) return; setBusy(true); setError("");
    try { await apiEditEntry(row.id, { state: "paid", on: new Date(`${on}T12:00:00+05:30`).toISOString() }); onSaved(); toast("Customer receipt recorded", { tone: "success" }); }
    catch (e) { setError(apiErrorMessage(e)); } finally { setBusy(false); }
  }}><Card><p className="font-semibold">{row.who}</p><p className="mt-1 text-xl font-bold">{hidden ? "••••" : amount(row.minor)}</p></Card><div><Label need>When did you receive it?</Label><Text label="Customer receipt date" name="customer_receipt_date" type="date" value={on} onChange={setOn} required maxDate={isoDay()} disabled={busy} /></div>{error && <p role="alert" className="text-sm">{error}</p>}<div className="flex gap-2"><Btn type="submit" loading={busy} disabled={busy || !on}>Save receipt record</Btn><Btn variant="ghost" onClick={onClose} disabled={busy}>Cancel</Btn></div></form></Sheet>;
}
