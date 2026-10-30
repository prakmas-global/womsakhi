"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import * as Icons from "@/components/ux/icons";
import { Btn, Card, EmptyState, I, v } from "@/components/ux/kit";
import { Label } from "@/components/ux/kit/form";
import { Sheet } from "@/components/ux/kit/sheet";
import { toast } from "@/components/ux/mobile/Toast";
import { useConfirm } from "@/design-system/feedback/ConfirmProvider";
import { apiErrorMessage } from "@/lib/api";
import {
  CATEGORY_LOOK, IN_CATEGORIES, OUT_CATEGORIES, apiKhataAddEntry, apiKhataDeleteEntry, apiKhataEditEntry, apiKhataMonth,
  type KhataEntry, type KhataMonth,
} from "@/lib/khata-api";
import { useResource } from "@/lib/use-resource";
import { Amount, useKhata } from "./KhataGate";
import { CalculatorSheet } from "./Calculator";
import { addDays, dayName, isoDay, monthName, shiftMonth, thisMonth, toMinor } from "./days";

/**
 * Money in and out — what came, what went, a word about each.
 *
 * Adding a line is an amount (or a tap on ₹100 / ₹500 …), a picture for what
 * it was for, and Save. The note and the day are optional and default to
 * nothing and today. Lines a chit wrote are shown with "From chit" and open
 * the chit instead: they are changed there, so the two never disagree.
 */

// Chit lines come from the chit, never from this picker.
// Chits and rentals write their own lines; she does not pick these.
const PICK_IN = IN_CATEGORIES.filter((c) => !c.startsWith("chit_") && !c.startsWith("rent_"));
const PICK_OUT = OUT_CATEGORIES.filter((c) => !c.startsWith("chit_") && !c.startsWith("rent_"));
const QUICK = [100, 500, 1000, 5000];
const PHRASES: Record<"in" | "out", string[]> = {
  in: ["Tailoring order", "Salary", "From husband", "Sold vegetables", "Tuition fees"],
  out: ["Groceries", "School fees", "Medicine", "Bus fare", "Gas cylinder", "Mobile recharge"],
};

const EMPTY: KhataMonth = { month: "", items: [], in_minor: 0, out_minor: 0, left_minor: 0, by_category: {} };

export function MoneyTab() {
  const { locked } = useKhata();
  const [month, setMonth] = useState(thisMonth());
  // The header calculator hands its answer over as `?add=in|out&amount=…`:
  // open the quick-add sheet with it, once, then take it off the address.
  const params = useSearchParams();
  const path = usePathname();
  const asked = params.get("add");
  const [prefill, setPrefill] = useState("");
  const [adding, setAdding] = useState<"in" | "out" | KhataEntry | null>(null);
  const [taken, setTaken] = useState("");
  const handoff = asked === "in" || asked === "out" ? `${asked}:${params.get("amount") ?? ""}` : "";
  if (handoff && handoff !== taken) {
    setTaken(handoff);
    setAdding(asked as "in" | "out");
    setPrefill(params.get("amount") ?? "");
  }
  // Then take it off the address — through history, not the router: a router
  // navigation remounts this tab (the route has a loading boundary) and would
  // close the sheet it just opened. In an effect, never while rendering.
  useEffect(() => {
    if (handoff) window.history.replaceState(null, "", `${path}?tab=money`);
  }, [handoff, path]);
  const book = useResource(
    useCallback((s: AbortSignal) => apiKhataMonth(month, s).catch((e) => { locked(e); throw e; }), [month, locked]),
    EMPTY,
  );
  const b = book.data;

  // Grouped by day, newest first (the server already sorts).
  const days: [string, KhataEntry[]][] = [];
  for (const e of b.items) {
    const last = days[days.length - 1];
    if (last && last[0] === e.on) last[1].push(e); else days.push([e.on, [e]]);
  }
  // Spending only (chit payments included — they are money out too).
  const spent = OUT_CATEGORIES
    .map((c) => [c, b.by_category[c] ?? 0] as const).filter(([, n]) => n > 0).sort((x, y) => y[1] - x[1]);

  return (
    <div className="flex flex-col gap-4">
      {/* The month, and back through earlier ones. Never into a month that has not come. */}
      <div className="flex items-center justify-center gap-3">
        <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Earlier month"
                className="ux-press grid h-11 w-11 place-items-center rounded-full border" style={{ borderColor: v("--ux-line"), color: v("--ux-ink") }}>
          <Icons.ChevronLeft className="h-5 w-5" />
        </button>
        <span className="min-w-[120px] text-center text-base font-bold" style={{ color: v("--ux-ink") }}>{monthName(month)}</span>
        <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Later month" disabled={month >= thisMonth()}
                className="ux-press grid h-11 w-11 place-items-center rounded-full border disabled:opacity-30" style={{ borderColor: v("--ux-line"), color: v("--ux-ink") }}>
          <Icons.ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {book.source === "live" && <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <Tile icon="ArrowDownLeft" label="Received" minor={b.in_minor} ink={v("--ux-green-ink")} />
        <Tile icon="ArrowUpRight" label="Spent" minor={b.out_minor} ink={v("--ux-ink")} />
        <Tile icon="Wallet" label="Difference" minor={b.left_minor}
              ink={v("--ux-ink")} />
      </div>}

      <p className="text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>Difference is received minus spent in this month’s records. It is not your cash or bank balance.</p>

      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => setAdding("in")}
                className="ux-press flex min-h-[64px] items-center justify-center gap-2 rounded-[18px] text-base font-bold"
                style={{ background: v("--ux-tint-green"), color: v("--ux-green-ink"), border: `1.5px solid color-mix(in oklab, var(--ux-green-ink) 35%, transparent)` }}>
          <Icons.Plus className="h-5 w-5" /> Money in
        </button>
        <button type="button" onClick={() => setAdding("out")}
                className="ux-press flex min-h-[64px] items-center justify-center gap-2 rounded-[18px] text-base font-bold"
                style={{ background: v("--ux-brand-tint"), color: v("--ux-brand"), border: `1.5px solid color-mix(in oklab, var(--ux-brand) 35%, transparent)` }}>
          <Icons.Minus className="h-5 w-5" /> Money out
        </button>
      </div>

      {book.source === "loading" && !b.items.length ? (
        <span className="ux-skeleton h-[220px] rounded-[18px]" />
      ) : book.source === "error" ? (
        <Card><p role="alert">Your money entries could not load. Your saved records have not changed.</p><div className="mt-3"><Btn onClick={book.refetch} variant="outline">Try again</Btn></div></Card>
      ) : b.items.length === 0 ? (
        <Card>
          <EmptyState icon="Wallet" title={`Nothing written for ${monthName(month)}`}
                      body="Every time money comes or goes, tap Money in or Money out. At the end of the month you will see where it went." />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {days.map(([day, rows]) => (
            <Card key={day} pad={0} className="overflow-hidden">
              <p className="border-b px-4 py-2.5 text-xs font-bold uppercase tracking-[0.06em]" style={{ borderColor: v("--ux-line"), color: v("--ux-muted") }}>
                {dayName(day)}
              </p>
              <ul>
                {rows.map((e) => <Row key={e.id} e={e} onEdit={() => setAdding(e)} />)}
              </ul>
            </Card>
          ))}
        </div>
      )}

      {spent.length > 0 && (
        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold" style={{ color: v("--ux-ink") }}>
            <Icons.BarChart3 className="h-5 w-5" style={{ color: v("--ux-brand") }} /> Where it went
          </h2>
          <ul className="flex flex-col gap-2.5">
            {spent.map(([c, n]) => (
              <li key={c} className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]" style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
                  <I name={CATEGORY_LOOK[c]?.icon ?? "Circle"} className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="truncate font-semibold" style={{ color: v("--ux-ink") }}>{CATEGORY_LOOK[c]?.label ?? c}</span>
                    <Amount minor={n} className="shrink-0 font-bold" style={{ color: v("--ux-ink-2") }} />
                  </span>
                  <span className="mt-1 block h-2 overflow-hidden rounded-full" style={{ background: v("--ux-surface-2") }}>
                    <span className="block h-full rounded-full" style={{ width: `${Math.max(4, (n / Math.max(1, b.out_minor)) * 100)}%`,
                                                                         background: "linear-gradient(90deg, var(--ux-fill), var(--ux-rib-2))" }} />
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {adding && (
        <EntrySheet start={adding} prefill={prefill} onClose={() => { setAdding(null); setPrefill(""); }}
                    onSaved={(on) => { setAdding(null); setPrefill(""); if (on.slice(0, 7) !== month) setMonth(on.slice(0, 7)); else book.refetch(); }} />
      )}
    </div>
  );
}

function Tile({ icon, label, minor, ink }: { icon: string; label: string; minor: number; ink: string }) {
  return (
    <Card pad={14} className="min-w-0">
      <span className="flex items-center gap-1.5 text-2xs font-semibold sm:text-xs" style={{ color: v("--ux-muted") }}>
        <I name={icon} className="h-4 w-4 shrink-0" style={{ color: ink }} /> <span className="truncate">{label}</span>
      </span>
      <Amount minor={minor} className="mt-1.5 block truncate text-base font-extrabold sm:text-xl" style={{ color: ink }} />
    </Card>
  );
}

function Row({ e, onEdit }: { e: KhataEntry; onEdit: () => void }) {
  const look = CATEGORY_LOOK[e.category] ?? { label: "Other", icon: "Circle" };
  const body = (
    <>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px]"
            style={e.kind === "in" ? { background: v("--ux-tint-green"), color: v("--ux-green-ink") } : { background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
        <I name={look.icon} className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xsm font-semibold" style={{ color: v("--ux-ink") }}>{e.note || look.label}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-2xs" style={{ color: v("--ux-muted") }}>
          {/* The category is the title when there is no note — once is enough. */}
          {e.note ? look.label : null}
          {e.source !== "me" && (
            <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] font-bold" style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
              {e.source === "bill" ? <><Icons.CalendarDays className="h-3 w-3" /> From a bill</> : e.source === "rental" ? <><Icons.KeyRound className="h-3 w-3" /> From a rental</> : <><Icons.Coins className="h-3 w-3" /> From chit</>}
            </span>
          )}
        </span>
      </span>
      <Amount minor={e.amount_minor} sign={e.kind} className="shrink-0 text-sm font-bold"
              style={{ color: e.kind === "in" ? v("--ux-green-ink") : v("--ux-ink") }} />
    </>
  );
  const cls = "ux-press flex w-full items-center gap-3 border-b px-4 py-3 text-start last:border-0";
  return (
    <li>
      {e.source === "bill" && e.commitment_id
        ? <Link href={`/app/money?tab=plans&bill=${e.commitment_id}`} className={cls} style={{ borderColor: v("--ux-line") }}>{body}</Link>
        : e.source === "chit" && e.chit_id
        ? <Link href={`/app/khata/chits/${e.chit_id}`} className={cls} style={{ borderColor: v("--ux-line") }}>{body}</Link>
        : e.source === "rental" && e.booking_id
        ? <Link href={`/app/rent/bookings/${e.booking_id}`} className={cls} style={{ borderColor: v("--ux-line") }}>{body}</Link>
        : <button type="button" onClick={onEdit} className={cls} style={{ borderColor: v("--ux-line") }}>{body}</button>}
    </li>
  );
}

function EntrySheet({ start, prefill = "", onClose, onSaved }: {
  start: "in" | "out" | KhataEntry; prefill?: string; onClose: () => void; onSaved: (on: string) => void;
}) {
  const { locked } = useKhata();
  const confirm = useConfirm();
  const editing = typeof start === "object" ? start : null;
  const kind = editing ? editing.kind : (start as "in" | "out");
  const [amount, setAmount] = useState(editing ? String(editing.amount_minor / 100) : prefill);
  const [calc, setCalc] = useState(false);
  const [category, setCategory] = useState(editing?.category ?? "");
  const [note, setNote] = useState(editing?.note ?? "");
  const [on, setOn] = useState(editing?.on ?? isoDay());
  const [busy, setBusy] = useState(false);
  const minor = toMinor(amount);
  const cats = kind === "in" ? PICK_IN : PICK_OUT;

  const fail = (e: unknown) => { if (!locked(e)) toast(apiErrorMessage(e, "That did not save. Try again."), { tone: "error" }); };
  const save = async () => {
    setBusy(true);
    try {
      if (editing) await apiKhataEditEntry(editing.id, { amount_minor: minor, note: note.trim(), category, on });
      else await apiKhataAddEntry({ kind, amount_minor: minor, note: note.trim(), category, on });
      toast(kind === "in" ? "Money in written down" : "Money out written down", { tone: "success" });
      onSaved(on);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!editing) return;
    const sure = await confirm({ title: "Remove this line?", description: "It comes off this month's totals.", confirmLabel: "Remove", cancelLabel: "Keep it" });
    if (!sure) return;
    try { await apiKhataDeleteEntry(editing.id); toast("Removed", { tone: "success" }); onSaved(on); } catch (e) { fail(e); }
  };

  const tone = kind === "in" ? { tint: "--ux-tint-green", ink: "--ux-green-ink" } : { tint: "--ux-brand-tint", ink: "--ux-brand" };
  return (
    <Sheet open onClose={onClose} title={kind === "in" ? "Money in" : "Money out"} icon={kind === "in" ? "ArrowDownLeft" : "ArrowUpRight"} width={520}
           footer={
             <div className="flex items-center gap-2">
               {editing && <Btn variant="ghost" icon="Trash2" onClick={() => void remove()}>Remove</Btn>}
               <span className="flex-1" />
               <Btn variant="primary" icon="Check" loading={busy} disabled={!minor} onClick={() => void save()}>Save</Btn>
             </div>
           }>
      <div className="flex flex-col gap-4">
        <div>
          <Label need>How much?</Label>
          <span className="relative block">
            <span className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-2xl font-bold" style={{ color: v("--ux-muted") }}>₹</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} inputMode="decimal" autoFocus={!editing && !prefill}
                   aria-label="Amount in rupees" placeholder="0"
                   className="ux-sq min-h-[64px] w-full rounded-[16px] border ps-11 pe-16 text-3xl font-extrabold tabular-nums outline-none"
                   style={{ borderColor: v("--ux-line"), background: v(tone.tint), color: v(tone.ink) }} />
            {/* Work it out first: 12 × 450, 5000 − 10% … and the answer lands here. */}
            <button type="button" onClick={() => setCalc(true)} aria-label="Work it out on the calculator" title="Calculator"
                    className="ux-press absolute end-2 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-[12px]"
                    style={{ background: v("--ux-surface"), color: v(tone.ink), border: `1px solid ${v("--ux-line")}` }}>
              <Icons.Calculator className="h-6 w-6" />
            </button>
          </span>
          {calc && <CalculatorSheet start={amount} onClose={() => setCalc(false)}
                                    onUse={(r) => { setAmount(String(r)); setCalc(false); }} />}
          <div className="mt-2 flex flex-wrap gap-2">
            {QUICK.map((r) => (
              <button key={r} type="button" onClick={() => setAmount(String(r))}
                      className="ux-press min-h-[40px] rounded-full border px-3.5 text-xs font-bold"
                      style={{ borderColor: amount === String(r) ? v(tone.ink) : v("--ux-line"), background: amount === String(r) ? v(tone.tint) : v("--ux-surface"),
                               color: amount === String(r) ? v(tone.ink) : v("--ux-ink-2") }}>
                ₹{r.toLocaleString("en-IN")}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label hint="optional">{kind === "in" ? "Where did it come from?" : "What was it for?"}</Label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="What it was for">
            {cats.map((c) => {
              const look = CATEGORY_LOOK[c];
              const sel = category === c;
              return (
                <button key={c} type="button" role="radio" aria-checked={sel} onClick={() => setCategory(sel ? "" : c)}
                        className="ux-press flex min-h-[78px] flex-col items-center justify-center gap-1.5 rounded-[14px] border p-2 text-center text-2xs font-semibold leading-tight"
                        style={{ borderColor: sel ? v(tone.ink) : v("--ux-line"), background: sel ? v(tone.tint) : v("--ux-surface"),
                                 color: sel ? v(tone.ink) : v("--ux-ink-2") }}>
                  <I name={look.icon} className="h-6 w-6" />
                  {look.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <Label hint="optional">A word about it</Label>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} aria-label="A word about it"
                 placeholder={kind === "in" ? "Blouse order from Meena" : "Rice and dal for the week"}
                 className="ux-sq min-h-[46px] w-full rounded-[12px] border px-4 text-xsm outline-none"
                 style={{ borderColor: v("--ux-line"), background: v("--ux-surface"), color: v("--ux-ink") }} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PHRASES[kind].map((p) => (
              <button key={p} type="button" onClick={() => setNote(p)}
                      className="ux-press min-h-[36px] rounded-full px-3 text-2xs font-semibold" style={{ background: v("--ux-surface-2"), color: v("--ux-ink-2") }}>
                {p}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>When?</Label>
          <div className="flex flex-wrap items-center gap-2">
            {[["Today", isoDay()], ["Yesterday", addDays(-1)]].map(([label, day]) => (
              <button key={label} type="button" aria-pressed={on === day} onClick={() => setOn(day)}
                      className="ux-press min-h-[40px] rounded-full border px-3.5 text-xs font-semibold"
                      style={{ borderColor: on === day ? v("--ux-brand") : v("--ux-line"), background: on === day ? v("--ux-brand-tint") : v("--ux-surface"),
                               color: on === day ? v("--ux-brand") : v("--ux-ink-2") }}>
                {label}
              </button>
            ))}
            <input type="date" value={on} max={isoDay()} onChange={(e) => e.target.value && setOn(e.target.value)} aria-label="Pick a day"
                   className="ux-sq min-h-[40px] rounded-full border px-3 text-xs outline-none"
                   style={{ borderColor: v("--ux-line"), background: v("--ux-surface"), color: v("--ux-ink") }} />
          </div>
        </div>
      </div>
    </Sheet>
  );
}
