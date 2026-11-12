"use client";

import { PlaceMark } from "@/components/ux/nav/Place";
import { FormEvent, useCallback, useState } from "react";

import Input, { Textarea } from "@/design-system/primitives/Input";
import Select from "@/design-system/primitives/Select";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn, Card, I, Pill, v } from "@/components/ux/kit";
import { toast } from "@/components/ux/mobile/Toast";
import { EYEBROW } from "@/components/ux/earn/phone";
import {
  apiArchiveShopOperation, apiCreateShopOperation, apiShopOperations,
  apiUpdateShopOperation, type ShopOperation, type ShopOperationKind,
  type ShopOperationStatus,
} from "@/lib/shop-api";
import { useResource } from "@/lib/use-resource";
import { More, Picks } from "@/components/ux/kit/form";

export interface OperationScreenConfig {
  kind: ShopOperationKind;
  eyebrow: string;
  title: string;
  lede: string;
  createLabel: string;
  titleLabel: string;
  titlePlaceholder: string;
  contactLabel: string;
  dateLabel: string;
  amountLabel: string;
  noteLabel: string;
  examples: string[];
  /** Fixed answers for the contact field (a channel, a language) instead of names. */
  contactOptions?: string[];
  /** Usual amounts, one tap each. */
  amountPresets?: number[];
  /** Phrases she can tap to build the note without typing. */
  notePicks?: string[];
  initialStatus: ShopOperationStatus;
  statuses: { value: ShopOperationStatus; label: string }[];
  empty: string;
}

const emptyRows: ShopOperation[] = [];

/** `datetime-local` value for a day from now, at a sensible hour. */
function dayFrom(days: number, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`;
}
const DATE_PICKS: { label: string; at: () => string }[] = [
  { label: "Today", at: () => dayFrom(0, Math.min(20, new Date().getHours() + 2)) },
  { label: "Tomorrow", at: () => dayFrom(1) },
  { label: "This Saturday", at: () => dayFrom(((6 - new Date().getDay() + 7) % 7) || 7) },
  { label: "In a week", at: () => dayFrom(7) },
  { label: "In a month", at: () => dayFrom(30) },
];

export function OperationScreen({ config }: { config: OperationScreenConfig }) {
  const load = useCallback((signal: AbortSignal) => apiShopOperations(config.kind, signal), [config.kind]);
  const rows = useResource(load, emptyRows);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [contact, setContact] = useState("");
  const [amount, setAmount] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [note, setNote] = useState("");
  const [datePick, setDatePick] = useState("");

  // Names she has already written down, newest first — picked, not retyped.
  const known = config.contactOptions
    ?? Array.from(new Set(rows.data.map((r) => r.contact.trim()).filter(Boolean))).slice(0, 8);
  const toggleNote = (phrase: string) => setNote((n) => {
    const parts = n.split(". ").map((x) => x.trim()).filter(Boolean);
    return (parts.includes(phrase) ? parts.filter((x) => x !== phrase) : [...parts, phrase]).join(". ");
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 2) return;
    setSaving(true);
    try {
      await apiCreateShopOperation({
        kind: config.kind, title: title.trim(), contact: contact.trim(),
        amount_minor: Math.round((Number(amount) || 0) * 100), status: config.initialStatus,
        due_on: dueOn, note: note.trim(), details: {},
      });
      setTitle(""); setContact(""); setAmount(""); setDueOn(""); setNote(""); setDatePick(""); setOpen(false);
      rows.refetch();
      toast("Saved to your shop", { tone: "success" });
    } catch {
      toast("Could not save this. Check your connection and try again.", { tone: "error" });
    } finally { setSaving(false); }
  };

  const changeStatus = async (row: ShopOperation, status: ShopOperationStatus) => {
    try {
      await apiUpdateShopOperation(row.id, { status });
      rows.refetch();
      toast("Status updated", { tone: "success" });
    } catch { toast("Could not update the status.", { tone: "error" }); }
  };

  const archive = async (row: ShopOperation) => {
    try {
      await apiArchiveShopOperation(row.id);
      rows.refetch();
      toast("Moved to archive", { tone: "success" });
    } catch { toast("Could not archive this record.", { tone: "error" }); }
  };

  return (
    <HomeShell active="/app/shop">
      <div className="flex flex-col gap-5">
        <Back to="/app/shop" label="Back to selling tools" />
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className={EYEBROW}>{config.eyebrow}</p>
            <div className="mt-2 flex min-w-0 items-center gap-3">
              <PlaceMark size={44} />
              <h1 className="ux-screen-title text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em] min-w-0" style={{ color: v("--ux-ink") }}>{config.title}</h1>
            </div>
            <p className="mt-2 max-w-[62ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>{config.lede}</p>
          </div>
          <Btn icon={open ? "X" : "Plus"} onClick={() => setOpen((x) => !x)}>{open ? "Close" : config.createLabel}</Btn>
        </header>

        {open && (
          <Card pad={20}>
            <form onSubmit={submit} className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <Input label={config.titleLabel} required value={title} maxLength={120} placeholder={config.titlePlaceholder} onChange={(e) => setTitle(e.target.value)} />
                <Picks options={config.examples} value={title} onPick={setTitle} label="Quick choices" />
              </div>
              <div>
                <Input label={config.contactLabel} value={contact} maxLength={120}
                       placeholder={known.length ? "Tap one below, or type" : undefined}
                       onChange={(e) => setContact(e.target.value)} />
                <Picks options={known} value={contact} onPick={(c) => setContact(contact === c ? "" : c)} label={config.contactLabel} />
              </div>
              <div>
                <Input label={config.dateLabel} type="datetime-local" value={dueOn}
                       onChange={(e) => { setDueOn(e.target.value); setDatePick(""); }} />
                <Picks options={DATE_PICKS.map((d) => d.label)} value={datePick}
                       onPick={(l) => { setDatePick(l); setDueOn(DATE_PICKS.find((d) => d.label === l)!.at()); }}
                       label={config.dateLabel} />
              </div>
              <div>
                <Input label={config.amountLabel} type="number" min="0" step="1" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
                {config.amountPresets && (
                  <Picks options={config.amountPresets.map((n) => `₹${n.toLocaleString("en-IN")}`)}
                         value={amount ? `₹${Number(amount).toLocaleString("en-IN")}` : ""}
                         onPick={(x) => setAmount(x.replace(/[^\d]/g, ""))} label={config.amountLabel} />
                )}
              </div>
              <div className="md:col-span-2">
                <More label={`${config.noteLabel} (optional)`} open={!!note}>
                  {config.notePicks && <Picks options={config.notePicks} value={note.split(". ")} onPick={toggleNote} multi label={config.noteLabel} />}
                  <div className="mt-3"><Textarea label="Or in your own words" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} /></div>
                </More>
              </div>
              <div className="md:col-span-2 flex justify-end"><Btn type="submit" loading={saving} disabled={title.trim().length < 2} className="max-md:w-full">{config.createLabel}</Btn></div>
            </form>
          </Card>
        )}

        {rows.source === "error" && (
          <Card pad={16}><div role="alert" className="flex items-center gap-3"><I name="WifiOff" className="h-5 w-5" /><p className="flex-1 text-sm">Your records could not be loaded.</p><Btn size="sm" variant="outline" onClick={rows.refetch}>Try again</Btn></div></Card>
        )}
        {rows.source === "loading" && <Card pad={20}><p className="text-sm" style={{ color: v("--ux-muted") }}>Loading your records…</p></Card>}
        {rows.source === "live" && rows.data.length === 0 && (
          <Card pad={24}><div className="grid place-items-center gap-3 py-5 text-center"><I name="ClipboardList" className="h-8 w-8" style={{ color: v("--ux-brand") }} /><p className="max-w-md text-sm" style={{ color: v("--ux-muted") }}>{config.empty}</p><Btn size="sm" variant="outline" icon="Plus" onClick={() => setOpen(true)}>{config.createLabel}</Btn></div></Card>
        )}
        {rows.source === "live" && rows.data.map((row) => (
          <Card key={row.id} pad={18}>
            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><h2 className="font-extrabold" style={{ color: v("--ux-ink") }}>{row.title}</h2><Pill tone="neutral" size="sm">{config.statuses.find((s) => s.value === row.status)?.label ?? row.status}</Pill></div>
                <p className="mt-1 text-xs" style={{ color: v("--ux-muted") }}>{[row.contact, row.due_on && new Date(row.due_on).toLocaleString(), row.amount_minor > 0 && row.amount_label].filter(Boolean).join(" · ")}</p>
                {row.note && <p className="mt-2 text-sm leading-relaxed" style={{ color: v("--ux-ink-2") }}>{row.note}</p>}
              </div>
              <div className="flex min-w-[180px] items-end gap-2">
                <Select className="flex-1" value={row.status} options={config.statuses} onChange={(e) => changeStatus(row, e.target.value as ShopOperationStatus)} />
                <Btn variant="ghost" size="sm" icon="Archive" ariaLabel={`Archive ${row.title}`} onClick={() => archive(row)}>Archive</Btn>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </HomeShell>
  );
}
