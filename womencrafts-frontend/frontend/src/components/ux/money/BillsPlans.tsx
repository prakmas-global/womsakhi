"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Btn, Card, I, v } from "@/components/ux/kit";
import { Sheet } from "@/components/ux/kit/sheet";
import { Label, Text, Select } from "@/components/ux/kit/form";
import { Amount, useKhata } from "@/components/ux/khata/KhataGate";
import { isoDay, toMinor } from "@/components/ux/khata/days";
import { useResource } from "@/lib/use-resource";
import { apiErrorMessage } from "@/lib/api";
import { apiAddCommitment, apiCommitments, apiDeleteCommitment, apiEditCommitment, apiRecordBillPayment, apiUndoBillPayment, type Commitment, type Weight } from "@/lib/money-api";
import { useConfirm } from "@/design-system/feedback/ConfirmProvider";
import { toast } from "@/components/ux/mobile/Toast";

const EMPTY: Commitment[] = [];
const IDEAS = [{ title: "Electricity bill", icon: "Zap" }, { title: "School fees", icon: "GraduationCap" }, { title: "Rent", icon: "Home" }, { title: "Phone recharge", icon: "Smartphone" }];
const PRIORITIES = [{ value: "cannot-wait", label: "Important — pay first" }, { value: "should-pay", label: "Normal" }, { value: "can-move", label: "Flexible" }];
const indianDay = (value: string) => value ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)) : "";
const dueLabel = (value: string) => value ? new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "No date set";

export function BillsPlans() {
  const { locked, hide } = useKhata();
  const params = useSearchParams();
  const bill = params.get("bill");
  const [view, setView] = useState<"upcoming" | "done">(bill ? "done" : "upcoming");
  const [editing, setEditing] = useState<Commitment | "new" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [paying, setPaying] = useState<Commitment | null>(null);
  const confirm = useConfirm();
  const book = useResource(useCallback((signal: AbortSignal) => apiCommitments(signal).catch((e) => { locked(e); throw e; }), [locked]), EMPTY);
  const rows = book.data.filter((row) => view === "done" ? row.paid : !row.paid)
    .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
  const run = async (id: string, action: () => Promise<unknown>, message: string) => {
    if (busy) return;
    setBusy(id);
    try { await action(); book.refetch(); toast(message, { tone: "success" }); }
    catch (e) { if (!locked(e)) toast(apiErrorMessage(e), { tone: "error" }); }
    finally { setBusy(null); }
  };
  const undo = async (row: Commitment) => {
    if (!await confirm({ title: "Undo this payment record?", description: "The linked expense will be removed and this bill will return to Upcoming. This does not reverse a real payment.", confirmLabel: "Undo record", danger: true })) return;
    await run(row.id, () => apiUndoBillPayment(row.id), "Payment record undone; the bill is upcoming again");
  };
  const remove = async (row: Commitment) => {
    if (!await confirm({ title: "Remove this plan?", description: `Remove ${row.what} from your list. Your other money entries stay as they are.`, confirmLabel: "Remove plan", danger: true })) return;
    await run(row.id, () => apiDeleteCommitment(row.id), "Plan removed");
  };

  return <div className="space-y-4" data-bills-plans>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-lg font-bold" style={{ color: v("--ux-ink") }}>Bills & plans</h2><p className="mt-1 max-w-[65ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>Keep future expenses here. They become expenses in your notebook only when you record them as paid.</p></div>
      <Btn icon="Plus" onClick={() => setEditing("new")}>Add a bill or plan</Btn>
    </div>
    <div role="group" aria-label="Which bills" className="flex gap-2">
      {([['upcoming', 'Upcoming'], ['done', 'Completed']] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)} className="min-h-11 rounded-full border px-4 text-sm font-semibold"
        style={{ background: v(view === id ? "--ux-brand-tint" : "--ux-surface"), color: v(view === id ? "--ux-brand" : "--ux-ink-2"), borderColor: v("--ux-line") }}>{label}</button>)}
    </div>
    {book.source === "error" ? <Card><p role="alert">Your bills could not load. Your saved plans have not changed.</p><div className="mt-3"><Btn onClick={book.refetch} variant="outline">Try again</Btn></div></Card>
      : book.source === "loading" ? <p role="status" className="py-6 text-sm" style={{ color: v("--ux-muted") }}>Loading your plans…</p>
      : rows.length === 0 ? <Card><div className="py-5 text-center"><I name="CalendarDays" className="mx-auto mb-3 h-8 w-8" /><h3 className="font-bold">{view === "done" ? "No completed plans yet" : "Nothing planned yet"}</h3><p className="mt-2 text-sm" style={{ color: v("--ux-muted") }}>{view === "done" ? "Bills you record as paid appear here. Their expenses are in Money in & out." : "Add the next bill you want to remember, such as rent, school fees or electricity."}</p></div></Card>
      : <ul className="space-y-3">{rows.map((row) => <li key={row.id} data-bill-id={row.id}>
        <Card className={row.id === bill ? "ring-2 ring-brand-500/30" : ""}>
          <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}><I name={row.icon || "CalendarDays"} className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1"><h3 className="break-words text-sm font-bold" style={{ color: v("--ux-ink") }}>{row.what}</h3><p className="mt-1 text-xs" style={{ color: v("--ux-muted") }}>{row.paid_on ? `Recorded on ${dueLabel(`${row.paid_on}T12:00:00+05:30`)}` : `Due: ${dueLabel(row.due)}`}</p>
              {row.legacy_paid && <p className="mt-1 text-xs" style={{ color: v("--ux-muted") }}>Previously marked done. No expense has been added automatically.</p>}
              {!row.paid && row.weight === "cannot-wait" && <p className="mt-1 text-xs font-semibold" style={{ color: v("--ux-brand") }}>Important — pay first</p>}
            </div><Amount minor={row.recorded_minor ?? row.minor} className="shrink-0 text-base font-bold" style={{ color: v("--ux-ink") }} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {!row.paid && <><Btn icon="Check" size="sm" disabled={Boolean(busy)} loading={busy === row.id} onClick={() => setPaying(row)}>Record as paid</Btn><Btn variant="outline" size="sm" disabled={Boolean(busy)} onClick={() => setEditing(row)}>Edit</Btn><Btn variant="ghost" size="sm" disabled={Boolean(busy)} onClick={() => void remove(row)}>Remove</Btn></>}
            {row.payment_entry_id && <Btn variant="outline" size="sm" disabled={Boolean(busy)} loading={busy === row.id} onClick={() => void undo(row)}>Undo payment record</Btn>}
            {row.legacy_paid && <><Btn variant="outline" size="sm" disabled={Boolean(busy)} onClick={() => void run(row.id, () => apiEditCommitment(row.id, { paid: false }), "Plan reopened")}>Reopen plan</Btn><Btn variant="ghost" size="sm" disabled={Boolean(busy)} onClick={() => void remove(row)}>Remove</Btn></>}
          </div>
        </Card>
      </li>)}</ul>}
    {view === "upcoming" && rows.length > 0 && !hide && <p className="text-xs" style={{ color: v("--ux-muted") }}>These are planned amounts, not money already spent.</p>}
    {paying && <PaymentSheet plan={paying} onClose={() => setPaying(null)} onSaved={() => { setPaying(null); book.refetch(); }} />}
    {editing && <PlanSheet plan={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); book.refetch(); }} />}
  </div>;
}

function PlanSheet({ plan, onClose, onSaved }: { plan: Commitment | null; onClose: () => void; onSaved: () => void }) {
  const { locked } = useKhata();
  const [what, setWhat] = useState(plan?.what || "");
  const [amount, setAmount] = useState(plan ? String(plan.minor / 100) : "");
  const [due, setDue] = useState(plan?.due ? indianDay(plan.due) : "");
  const [weight, setWeight] = useState<Weight>(plan?.weight || "should-pay");
  const [icon, setIcon] = useState(plan?.icon || "CalendarDays");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (busy) return;
    if (!what.trim() || toMinor(amount) <= 0 || !Number.isSafeInteger(toMinor(amount))) { setError("Add a name and an amount greater than zero."); return; }
    setBusy(true); setError("");
    try {
      const body = { what: what.trim(), minor: toMinor(amount), due: due ? new Date(`${due}T00:00:00+05:30`).toISOString() : null, weight };
      if (plan) await apiEditCommitment(plan.id, body);
      else await apiAddCommitment({ ...body, icon });
      toast(plan ? "Plan updated" : "Plan added — nothing has been recorded as spent", { tone: "success" }); onSaved();
    } catch (e) { if (!locked(e)) setError(apiErrorMessage(e)); }
    finally { setBusy(false); }
  };
  return <Sheet open title={plan ? "Edit your plan" : "Add a bill or plan"} icon="CalendarDays" onClose={onClose} description="A reminder of an expense you expect. Saving a plan does not record a payment.">
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <div><Label need>What is it for?</Label><Text label="Bill or plan name" name="bill_name" required max={120} value={what} onChange={setWhat} placeholder="For example, electricity bill" disabled={busy} />
        {!plan && <div className="mt-2 flex flex-wrap gap-2">{IDEAS.map((idea) => <button key={idea.title} type="button" disabled={busy} onClick={() => { setWhat(idea.title); setIcon(idea.icon); }} className="min-h-11 rounded-full border px-3 text-xs" style={{ borderColor: v("--ux-line") }}>{idea.title}</button>)}</div>}
      </div>
      <div><Label need>Planned amount</Label><Text label="Planned amount in rupees" name="bill_amount" value={amount} onChange={setAmount} prefix="₹" placeholder="0.00" inputMode="decimal" required disabled={busy} /></div>
      <div><Label hint="Optional">Due date</Label><Text label="Bill due date" name="bill_due" type="date" value={due} onChange={setDue} disabled={busy} /></div>
      <div><Label>Priority</Label><Select label="Bill priority" value={weight} options={PRIORITIES} onChange={(value) => setWeight(value as Weight)} /></div>
      {error && <p role="alert" className="text-sm" style={{ color: v("--ux-danger-ink") }}>{error}</p>}
      <div className="flex gap-2"><Btn type="submit" loading={busy} disabled={busy}>Save plan</Btn><Btn variant="ghost" disabled={busy} onClick={onClose}>Cancel</Btn></div>
    </form>
  </Sheet>;
}


function PaymentSheet({ plan, onClose, onSaved }: { plan: Commitment; onClose: () => void; onSaved: () => void }) {
  const { locked } = useKhata();
  const [on, setOn] = useState(isoDay());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    if (busy || !on) return;
    setBusy(true); setError("");
    try { await apiRecordBillPayment(plan.id, on); toast("Payment recorded once in Money in & out", { tone: "success" }); onSaved(); }
    catch (e) { if (!locked(e)) setError(apiErrorMessage(e)); }
    finally { setBusy(false); }
  };
  return <Sheet open onClose={onClose} title="Record a payment" icon="Check" description="Only record money you have already paid. This adds one expense to your notebook; no money is sent.">
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <div className="rounded-xl border p-4" style={{ borderColor: v("--ux-line") }}><p className="text-sm font-semibold">{plan.what}</p><Amount minor={plan.minor} className="mt-1 block text-xl font-bold" /></div>
      <div><Label need>When did you pay?</Label><Text label="Payment date" name="payment_date" type="date" value={on} onChange={setOn} maxDate={isoDay()} required disabled={busy} /></div>
      {error && <p role="alert" className="text-sm" style={{ color: v("--ux-danger-ink") }}>{error}</p>}
      <div className="flex gap-2"><Btn type="submit" disabled={busy || !on} loading={busy}>Save payment record</Btn><Btn variant="ghost" disabled={busy} onClick={onClose}>Cancel</Btn></div>
    </form>
  </Sheet>;
}
