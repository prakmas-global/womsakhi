"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Building2, Check, CreditCard, Crown, Download, FileText, HardDrive, Pencil, Receipt, Users, Wallet, X,
} from "lucide-react";

import { Badge, Card, EmptyState, Input, Modal, Spinner, StatCard, useToast } from "@/design-system";
import { ResizableColumns } from "@/layout-engine";
import {
  apiBillingOverview, apiDownloadInvoice, apiListInvoices, apiUpdateBillingInfo,
  type BillingInfo, type BillingInvoice, type BillingOverview,
} from "@/lib/billing-api";
import { memberError } from "@/lib/member-api";
import { saveBlob } from "@/lib/settings-platform-api";

/**
 * Billing.
 *
 * What this screen used to show: a ₹2,999 "Professional Plan", a Mastercard
 * ending 4242, five invoices and a usage bar reading 62.4 GB of 100 GB. None
 * of it was true — WomSakhi takes no payment from the organisation running
 * it and holds no card.
 *
 * What it shows now is counted or measured: the entitlement tier this account
 * is on (the same flag the Organisation screen is gated by), seats from the
 * users collection, storage from the disk, invoices only where some code
 * issued one, and the billing details a person has typed. When there is
 * nothing, it says so.
 */

const TIER_TONE: Record<string, "slate" | "violet" | "brand"> = { free: "slate", pro: "violet", org: "brand" };
const EMPTY_INFO: BillingInfo = { company: "", email: "", gstin: "", address: "" };

export default function BillingPage() {
  const toast = useToast();
  const [data, setData] = useState<BillingOverview | null>(null);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<BillingInfo>(EMPTY_INFO);
  const [busy, setBusy] = useState(false);

  // After a save, from a click.
  const refresh = useCallback(async () => {
    try {
      const [ov, inv] = await Promise.all([apiBillingOverview(), apiListInvoices({ page_size: 100 })]);
      setData(ov);
      setInvoices(inv.items);
    } catch (e) {
      toast.error("Could not load billing", { description: memberError(e) });
    }
  }, [toast]);

  // The first load, inline so every setState provably follows an await.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [ov, inv] = await Promise.all([apiBillingOverview(), apiListInvoices({ page_size: 100 })]);
        if (!alive) return;
        setData(ov);
        setInvoices(inv.items);
      } catch (e) {
        if (alive) toast.error("Could not load billing", { description: memberError(e) });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [toast]);

  const openEdit = () => {
    setDraft(data?.billing_info_saved ? data.billing_info : EMPTY_INFO);
    setEditing(true);
  };

  const save = async () => {
    if (!draft.company.trim() || !draft.email.trim()) {
      toast.error("Company name and billing email are needed");
      return;
    }
    setBusy(true);
    try {
      await apiUpdateBillingInfo({ ...draft, company: draft.company.trim(), email: draft.email.trim() });
      toast.success("Billing details saved", { description: "Recorded in the activity log." });
      setEditing(false);
      await refresh();
    } catch (e) {
      toast.error("Could not save the billing details", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  };

  const download = async (inv: BillingInvoice) => {
    try {
      saveBlob(await apiDownloadInvoice(inv.invoice_number), `${inv.invoice_number}.csv`);
    } catch (e) {
      toast.error("Could not download the invoice", { description: memberError(e) });
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-start gap-3">
        <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
          <CreditCard className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Billing</h1>
          <p className="mt-1 text-sm text-ink-subtle">
            What this installation is on — counted and measured, never assumed.
          </p>
        </div>
      </div>

      {loading || !data ? (
        <div className="flex items-center justify-center py-20">{loading ? <Spinner /> : <p className="text-sm text-ink-subtle">Unable to load billing.</p>}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Plan" value={data.plan.label} icon={Crown} tone={TIER_TONE[data.plan.tier] === "slate" ? "violet" : "brand"}
                      deltaNote={`${data.plan.features.filter((f) => f.included).length} of ${data.plan.features.length} features on`} />
            <StatCard label="Staff seats" value={String(data.seats.staff)} icon={Users} tone="violet"
                      deltaNote={`${data.seats.active_staff} active · ${data.seats.super_admins} Super Admin${data.seats.super_admins === 1 ? "" : "s"}`} />
            <StatCard label="Members" value={String(data.seats.members)} icon={Users} tone="emerald" deltaNote="Accounts with the Member role" />
            <StatCard label="Storage used" value={data.storage.label} icon={HardDrive} tone="sky"
                      deltaNote={`${data.storage.files} file${data.storage.files === 1 ? "" : "s"} on this server`} />
          </div>

          <ResizableColumns id="settings-billing" defaultSize={0.62} className="mt-6 gap-6">
            <div className="space-y-6">
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-base font-semibold text-ink">Your plan</h2>
                    <p className="mt-1 text-sm text-ink-subtle">{data.plan.note}</p>
                  </div>
                  <Badge tone={TIER_TONE[data.plan.tier] ?? "slate"}>{data.plan.label}</Badge>
                </div>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {data.plan.features.map((f) => (
                    <li key={f.key} className="flex items-center gap-2.5 text-sm">
                      {f.included
                        ? <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-status-ok-bg text-status-ok-ink"><Check className="h-3 w-3" strokeWidth={3} /></span>
                        : <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-inset text-ink-subtle"><X className="h-3 w-3" strokeWidth={3} /></span>}
                      <span className={f.included ? "text-ink" : "text-ink-subtle"}>{f.label}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-ink-subtle">
                  The tier is read from this account&apos;s entitlement — the same flag the Organisation screen is gated by. Changing it is a decision made outside this dashboard, not a button.
                </p>
              </Card>

              <Card>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-display text-base font-semibold text-ink">Invoices</h2>
                  <span className="text-xs text-ink-subtle">{data.invoices_total} issued</span>
                </div>
                {invoices.length === 0 ? (
                  <EmptyState icon={Receipt} title="No invoices"
                              description="WomSakhi has not issued an invoice to this organisation and nothing has been charged. Anything issued in future will be listed here." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                          <th className="px-2 py-2.5">Date</th>
                          <th className="px-2 py-2.5">Description</th>
                          <th className="px-2 py-2.5">Period</th>
                          <th className="px-2 py-2.5">Amount</th>
                          <th className="px-2 py-2.5">Status</th>
                          <th className="px-2 py-2.5">Invoice</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map((h) => (
                          <tr key={h.invoice_number} className="border-b border-line text-sm last:border-0 hover:bg-surface-2">
                            <td className="whitespace-nowrap px-2 py-3 text-ink-muted">{h.date}</td>
                            <td className="px-2 py-3 text-ink-muted">{h.description}</td>
                            <td className="whitespace-nowrap px-2 py-3 text-ink-subtle">{h.period}</td>
                            <td className="whitespace-nowrap px-2 py-3 font-semibold text-ink">{h.amount}</td>
                            <td className="px-2 py-3"><Badge tone={h.status === "Paid" ? "emerald" : h.status === "Failed" ? "rose" : "amber"}>{h.status}</Badge></td>
                            <td className="whitespace-nowrap px-2 py-3">
                              <button onClick={() => void download(h)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ink">
                                <FileText className="h-4 w-4" /> {h.invoice_number} <Download className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-tint text-violet-ink"><Wallet className="h-5 w-5" /></span>
                  <div>
                    <h2 className="font-display text-base font-semibold text-ink">Payments</h2>
                    <p className="mt-1 text-sm text-ink-subtle">{data.payments.note}</p>
                  </div>
                </div>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between"><dt className="text-ink-subtle">Provider</dt><dd className="font-semibold text-ink">{data.payments.provider}</dd></div>
                  <div className="flex items-center justify-between"><dt className="text-ink-subtle">Member payments</dt><dd className="font-semibold text-ink">{data.payments.enabled ? "Enabled" : "Off"}</dd></div>
                  <div className="flex items-center justify-between"><dt className="text-ink-subtle">Money held by WomSakhi</dt><dd className="font-semibold text-ink">None</dd></div>
                  <div className="flex items-center justify-between"><dt className="text-ink-subtle">Card on file</dt><dd className="font-semibold text-ink">None</dd></div>
                </dl>
              </Card>

              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand-ink"><Building2 className="h-5 w-5" /></span>
                    <div>
                      <h2 className="font-display text-base font-semibold text-ink">Billing details</h2>
                      <p className="mt-1 text-xs text-ink-subtle">
                        {data.billing_info_saved
                          ? `Saved ${new Date(data.billing_info_updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
                          : "For any invoice issued in future"}
                      </p>
                    </div>
                  </div>
                  <button className="btn btn-sm btn-outline" onClick={openEdit}><Pencil className="h-3.5 w-3.5" /> {data.billing_info_saved ? "Edit" : "Add"}</button>
                </div>
                {data.billing_info_saved ? (
                  <dl className="mt-4 space-y-2 text-sm">
                    <div><dt className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">Organisation</dt><dd className="text-ink">{data.billing_info.company}</dd></div>
                    <div><dt className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">Billing email</dt><dd className="text-ink">{data.billing_info.email}</dd></div>
                    {data.billing_info.gstin && <div><dt className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">GSTIN</dt><dd className="font-mono text-ink">{data.billing_info.gstin}</dd></div>}
                    {data.billing_info.address && <div><dt className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">Address</dt><dd className="text-ink">{data.billing_info.address}</dd></div>}
                  </dl>
                ) : (
                  <p className="mt-4 text-sm text-ink-subtle">Not set yet. Nothing here is required until an invoice exists.</p>
                )}
              </Card>

              <Card>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-status-info-bg text-status-info-ink"><HardDrive className="h-5 w-5" /></span>
                  <div>
                    <h2 className="font-display text-base font-semibold text-ink">Storage</h2>
                    <p className="mt-1 text-sm text-ink-subtle">{data.storage.location}</p>
                    <p className="mt-2 text-sm font-semibold text-ink">{data.storage.label} in {data.storage.files} file{data.storage.files === 1 ? "" : "s"}</p>
                    <p className="text-xs text-ink-subtle">Measured when you opened this page. There is no quota.</p>
                  </div>
                </div>
              </Card>
            </div>
          </ResizableColumns>
        </>
      )}

      <Modal open={editing} onClose={() => setEditing(false)} title="Billing details" description="Shown on any invoice issued in future."
             icon={Receipt} iconTone="sky"
             footer={<>
               <button className="btn btn-outline" onClick={() => setEditing(false)}>Cancel</button>
               <button className="btn btn-primary" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</button>
             </>}>
        <div className="space-y-4">
          <Input label="Organisation name" required value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} />
          <Input label="Billing email" required type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
          <Input label="GSTIN" hint="Optional. 15 characters, as printed on your registration." value={draft.gstin} onChange={(e) => setDraft({ ...draft, gstin: e.target.value })} />
          <Input label="Billing address" value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
