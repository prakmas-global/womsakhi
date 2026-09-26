"use client";

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
  initialStatus: ShopOperationStatus;
  statuses: { value: ShopOperationStatus; label: string }[];
  empty: string;
}

const emptyRows: ShopOperation[] = [];

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
      setTitle(""); setContact(""); setAmount(""); setDueOn(""); setNote(""); setOpen(false);
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
        <Back to="/app/shop" label="Back to ways to sell" />
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className={EYEBROW}>{config.eyebrow}</p>
            <h1 className="ux-screen-title mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]" style={{ color: v("--ux-ink") }}>{config.title}</h1>
            <p className="mt-2 max-w-[62ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>{config.lede}</p>
          </div>
          <Btn icon={open ? "X" : "Plus"} onClick={() => setOpen((x) => !x)}>{open ? "Close" : config.createLabel}</Btn>
        </header>

        {open && (
          <Card pad={20}>
            <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Input label={config.titleLabel} required value={title} maxLength={120} placeholder={config.titlePlaceholder} onChange={(e) => setTitle(e.target.value)} />
                <div className="mt-2 flex flex-wrap gap-2" aria-label="Quick choices">
                  {config.examples.map((x) => <button key={x} type="button" onClick={() => setTitle(x)} className="rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: v("--ux-line"), color: v("--ux-ink-2") }}>{x}</button>)}
                </div>
              </div>
              <Input label={config.contactLabel} value={contact} maxLength={120} onChange={(e) => setContact(e.target.value)} />
              <Input label={config.dateLabel} type="datetime-local" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
              <Input label={config.amountLabel} type="number" min="0" step="1" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <Textarea label={config.noteLabel} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
              <div className="md:col-span-2 flex justify-end"><Btn type="submit" loading={saving} disabled={title.trim().length < 2}>{config.createLabel}</Btn></div>
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
