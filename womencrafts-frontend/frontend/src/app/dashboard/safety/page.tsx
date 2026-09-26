"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Check, Flag, LifeBuoy, Loader2, Mail, MapPin, MoreHorizontal, Phone, PhoneCall, Plus,
  ShieldAlert, ShieldCheck, Siren,
} from "lucide-react";

import {
  Badge, Card, EmptyState, Input, Menu, MenuItem, Modal, Select, Spinner, StatCard, Switch,
  Tabs, Textarea, useConfirm, useToast,
} from "@/design-system";
import {
  apiAddHelpline, apiDecideSafetyAlert, apiEditHelpline, apiHelplineList,
  apiImportDefaultHelplines, apiRemoveHelpline, apiSafetyAlerts, apiSafetyCounts,
  type AdminAlert, type HelplineInput, type HelplineList, type HelplineRow, type SafetyCounts,
} from "@/lib/safety-admin-api";
import { memberError } from "@/lib/member-api";

/**
 * Safety — the module home.
 *
 * Two things live here. The alert queue, which is the most time-critical
 * screen in the whole admin app (her phone number is on the card, not behind
 * a click, and the list refreshes itself every minute). And the helpline
 * list — the numbers the member app and the public endpoint show — which
 * staff curate here. The built-in list in code stays as the fallback, so
 * nothing done on this screen can ever leave a caller with no number.
 *
 * Reports and the support fund have their own screens; the tiles link there.
 */

const EMPTY_HELPLINE: HelplineInput = { name: "", number: "", desc: "", urgent: false, order: 0 };

export default function AdminSafetyPage() {
  const toast = useToast();
  const confirm = useConfirm();

  const [counts, setCounts] = useState<SafetyCounts | null>(null);
  const [helplines, setHelplines] = useState<HelplineList | null>(null);
  const [section, setSection] = useState("alerts");

  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [alertTab, setAlertTab] = useState("open");
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [handling, setHandling] = useState<AdminAlert | null>(null);
  const [alertStatus, setAlertStatus] = useState("acknowledged");
  const [resolution, setResolution] = useState("");

  const [editing, setEditing] = useState<HelplineRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<HelplineInput>(EMPTY_HELPLINE);
  const [busy, setBusy] = useState(false);

  const loadCounts = useCallback(async () => {
    try {
      const [c, h] = await Promise.all([apiSafetyCounts(), apiHelplineList()]);
      setCounts(c);
      setHelplines(h);
    } catch (e) {
      toast.error("Could not load the safety overview", { description: memberError(e) });
    }
  }, [toast]);

  const loadAlerts = useCallback(async () => {
    try {
      setAlerts(await apiSafetyAlerts({ status: alertTab === "all" ? "" : alertTab }));
    } catch (e) {
      toast.error("Could not load alerts", { description: memberError(e) });
    } finally {
      setAlertsLoading(false);
    }
  }, [alertTab, toast]);

  useEffect(() => { void loadCounts(); }, [loadCounts]);
  useEffect(() => { void loadAlerts(); }, [loadAlerts]);

  // An open alert must not go stale on a screen someone left up.
  useEffect(() => {
    const timer = setInterval(() => { void loadAlerts(); void loadCounts(); }, 60_000);
    return () => clearInterval(timer);
  }, [loadAlerts, loadCounts]);

  /* ── alerts ───────────────────────────────────────────────────────────── */

  function openAlert(a: AdminAlert) {
    setHandling(a);
    setAlertStatus(a.status === "open" ? "acknowledged" : "resolved");
    setResolution(a.resolution || "");
  }

  const decideAlert = useCallback(async () => {
    if (!handling) return;
    setBusy(true);
    try {
      await apiDecideSafetyAlert(handling.id, { status: alertStatus, resolution: resolution.trim() });
      toast.success(
        alertStatus === "acknowledged" ? "She has been told someone is on it" : `Alert marked ${alertStatus}`,
      );
      setHandling(null);
      await Promise.all([loadAlerts(), loadCounts()]);
    } catch (e) {
      toast.error("Could not update the alert", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [handling, alertStatus, resolution, loadAlerts, loadCounts, toast]);

  /* ── helplines ────────────────────────────────────────────────────────── */

  function openAdd() {
    const next = helplines ? helplines.items.length : 0;
    setForm({ ...EMPTY_HELPLINE, order: next });
    setEditing(null);
    setAdding(true);
  }

  function openEdit(h: HelplineRow) {
    setForm({ name: h.name, number: h.number, desc: h.desc, urgent: h.urgent, order: h.order });
    setEditing(h);
    setAdding(true);
  }

  const saveHelpline = useCallback(async () => {
    if (!form.name.trim() || !form.number.trim()) {
      toast.error("A name and a number are both needed");
      return;
    }
    setBusy(true);
    try {
      const body = { ...form, name: form.name.trim(), number: form.number.trim(), desc: form.desc.trim() };
      const list = editing ? await apiEditHelpline(editing.id, body) : await apiAddHelpline(body);
      setHelplines(list);
      setAdding(false);
      toast.success(editing ? `${body.name} updated` : `${body.name} added`, {
        description: "Live for members and on the public list now.",
      });
    } catch (e) {
      toast.error("Could not save that number", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [form, editing, toast]);

  const removeHelpline = useCallback(async (h: HelplineRow) => {
    const isLast = (helplines?.items.length ?? 0) <= 1;
    const ok = await confirm({
      title: `Remove ${h.name}?`,
      description: isLast
        ? "It is the last curated number. Removing it puts the built-in list back for every caller."
        : "It disappears from the member app and the public list immediately.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    try {
      setHelplines(await apiRemoveHelpline(h.id));
      toast.success(`${h.name} removed`);
    } catch (e) {
      toast.error("Could not remove that number", { description: memberError(e) });
    }
  }, [confirm, helplines, toast]);

  const takeOver = useCallback(async () => {
    const ok = await confirm({
      title: "Manage the helpline list here?",
      description: `The ${helplines?.builtin_count ?? 0} built-in numbers are copied in as they are, so nothing changes for callers until you edit one. The built-in list stays as the fallback if this one is ever emptied.`,
      confirmLabel: "Copy them in",
    });
    if (!ok) return;
    try {
      setHelplines(await apiImportDefaultHelplines());
      toast.success("The list is now managed here");
    } catch (e) {
      toast.error("Could not copy the numbers in", { description: memberError(e) });
    }
  }, [confirm, helplines, toast]);

  const managed = helplines?.managed ?? false;
  const liveCount = helplines?.items.length ?? 0;

  return (
    <div className="wc-page-enter">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-status-danger-bg text-status-danger-ink">
            <ShieldAlert className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Safety</h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-subtle">
              Alerts raised by members, and the emergency numbers every caller sees. Refreshes itself every minute.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/safety/reports" className="btn btn-outline">
            <Flag className="h-4 w-4" /> Reports
          </Link>
          <Link href="/dashboard/support-fund" className="btn btn-outline">
            <LifeBuoy className="h-4 w-4" /> Support fund
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Open alerts" value={counts ? String(counts.open_alerts) : "—"} icon={Siren}
                  tone="rose" deltaNote="Raised and not yet resolved" />
        <StatCard label="Reports needing a human" value={counts ? String(counts.open_reports) : "—"} icon={Flag}
                  tone="amber" deltaNote="New or in review" href="/dashboard/safety/reports" />
        <StatCard label="Support requests waiting" value={counts ? String(counts.pending_support) : "—"} icon={LifeBuoy}
                  tone="violet" deltaNote="Undecided" href="/dashboard/support-fund" />
        <StatCard label="Helpline numbers live" value={helplines ? String(liveCount) : "—"} icon={PhoneCall}
                  tone="emerald" deltaNote={managed ? "Curated on this screen" : "The built-in list"} />
      </div>

      <Tabs
        className="mt-6 mb-4"
        value={section}
        onChange={setSection}
        tabs={[
          { value: "alerts", label: "Alerts", count: counts?.open_alerts },
          { value: "helplines", label: "Helplines", count: helplines ? liveCount : undefined },
        ]}
      />

      {section === "alerts" && (
        <>
          <Tabs
            className="mb-4"
            value={alertTab}
            onChange={setAlertTab}
            tabs={[
              { value: "open", label: "Open" },
              { value: "acknowledged", label: "In hand" },
              { value: "resolved", label: "Resolved" },
              { value: "all", label: "All" },
            ]}
          />

          {alertsLoading ? (
            <div className="flex items-center justify-center py-16"><Spinner /></div>
          ) : alerts.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title={alertTab === "open" ? "Nothing open" : "No alerts here"}
              description={alertTab === "open"
                ? "No member has raised an alert that is still open."
                : "Nothing matches this filter."}
            />
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {alerts.map((a) => (
                <Card
                  key={a.id}
                  className={a.status === "open" ? "border-status-danger-border bg-status-danger-bg/50" : ""}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          a.status === "open"
                            ? "bg-status-danger-bg text-status-danger-ink"
                            : "bg-surface-inset text-ink-subtle"
                        }`}
                      >
                        <ShieldAlert className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-display font-bold text-ink">{a.member_name}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-subtle">
                          {a.member_phone && (
                            <a href={`tel:${a.member_phone}`} className="flex items-center gap-1 font-semibold text-status-ok-ink">
                              <Phone className="h-3.5 w-3.5" />
                              {a.member_phone}
                            </a>
                          )}
                          {a.member_email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3.5 w-3.5" />
                              {a.member_email}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <Badge tone={a.status === "open" ? "rose" : a.status === "acknowledged" ? "amber" : "emerald"}>
                      {a.status}
                    </Badge>
                  </div>

                  {a.note && (
                    <p className="mt-3 whitespace-pre-line rounded-xl bg-surface px-3.5 py-3 text-sm text-ink-muted dark:bg-white/5">
                      {a.note}
                    </p>
                  )}
                  {a.location && (
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-muted">
                      <MapPin className="h-3.5 w-3.5 text-ink-subtle" />
                      {a.location}
                    </p>
                  )}

                  {a.contacts.length > 0 && (
                    <div className="mt-3">
                      <p className="text-2xs font-bold uppercase tracking-wide text-ink-subtle">
                        Her trusted contacts
                      </p>
                      <ul className="mt-1.5 space-y-1">
                        {a.contacts.map((c) => (
                          <li key={c.id} className="flex items-center gap-2 text-sm">
                            <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 font-semibold text-status-ok-ink">
                              <Phone className="h-3.5 w-3.5" />
                              {c.phone}
                            </a>
                            <span className="truncate text-ink-muted">
                              {c.name}{c.relation ? ` · ${c.relation}` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {a.resolution && (
                    <p className="mt-3 rounded-xl bg-status-info-bg px-3.5 py-2.5 text-sm text-status-info-ink">
                      {a.resolution}
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 dark:border-white/10">
                    <span className="text-xs text-ink-subtle">
                      {a.raised_at}{a.handled_by ? ` · ${a.handled_by}` : ""}
                    </span>
                    {a.status !== "resolved" && (
                      <button onClick={() => openAlert(a)} className="btn btn-primary btn-sm">
                        <Check className="h-3.5 w-3.5" />
                        {a.status === "open" ? "Take this" : "Resolve"}
                      </button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {section === "helplines" && (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-ink">Emergency numbers callers see</h2>
              <p className="text-xs text-ink-subtle">
                Shown in the member app and on the public helpline endpoint, which works without a sign-in.
              </p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={openAdd}>
              <Plus className="h-3.5 w-3.5" /> Add a number
            </button>
          </div>

          {helplines && !managed && (
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line bg-surface-2 p-4">
              <div className="text-sm">
                <p className="font-semibold text-ink">These are the built-in numbers</p>
                <p className="mt-0.5 text-ink-muted">
                  They ship in code and cannot be edited row by row until the list is copied in here.
                  Adding a number copies them in automatically first, so callers never lose one.
                </p>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => void takeOver()}>
                Copy them in to edit
              </button>
            </div>
          )}

          {!helplines ? (
            <div className="flex items-center justify-center py-16"><Spinner /></div>
          ) : helplines.items.length === 0 ? (
            <EmptyState icon={PhoneCall} title="No numbers" description="Add one, and it goes live immediately." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                    <th className="px-3 py-2.5">#</th>
                    <th className="px-3 py-2.5">Name</th>
                    <th className="px-3 py-2.5">Number</th>
                    <th className="px-3 py-2.5">Shown as</th>
                    <th className="px-3 py-2.5">Description</th>
                    <th className="px-3 py-2.5 text-right">&nbsp;</th>
                  </tr>
                </thead>
                <tbody>
                  {helplines.items.map((h, i) => (
                    <tr key={h.id || `builtin-${i}`} className="border-b border-line last:border-0 hover:bg-surface-2">
                      <td className="px-3 py-3 text-sm text-ink-subtle">{h.order}</td>
                      <td className="px-3 py-3 text-sm font-semibold text-ink">{h.name}</td>
                      <td className="px-3 py-3">
                        <a href={`tel:${h.number}`} className="font-mono text-sm font-semibold text-status-ok-ink">{h.number}</a>
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={h.urgent ? "rose" : "slate"}>{h.urgent ? "Urgent" : "Support"}</Badge>
                      </td>
                      <td className="max-w-md px-3 py-3 text-sm text-ink-muted">{h.desc}</td>
                      <td className="px-3 py-3 text-right">
                        {managed ? (
                          <Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}>
                            <MenuItem onClick={() => openEdit(h)}>Edit</MenuItem>
                            <MenuItem danger onClick={() => void removeHelpline(h)}>Remove</MenuItem>
                          </Menu>
                        ) : (
                          <span className="text-2xs text-ink-subtle">built-in</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── alert decision ─────────────────────────────────────────────── */}
      <Modal
        open={!!handling}
        onClose={() => setHandling(null)}
        title="Update this alert"
        description={handling?.member_name}
        icon={ShieldAlert}
        iconTone="rose"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setHandling(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => void decideAlert()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Select
            label="Status"
            value={alertStatus}
            onChange={(e) => setAlertStatus(e.target.value)}
            options={["acknowledged", "resolved", "open"]}
          />
          <Textarea
            label="What did you do?"
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="Called her at 4:10pm — she's safe at her sister's. Following up tomorrow."
          />
          <p className="text-xs text-ink-subtle">
            Marking this <strong>acknowledged</strong> messages her to say someone is on it. The note is
            kept on the record either way, and the change is written to the audit trail under your name.
          </p>
        </div>
      </Modal>

      {/* ── helpline add / edit ────────────────────────────────────────── */}
      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title={editing ? `Edit ${editing.name}` : "Add a helpline"}
        description="Live for every caller the moment it is saved."
        icon={PhoneCall}
        iconTone="emerald"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setAdding(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => void saveHelpline()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {editing ? "Save" : "Add"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                 placeholder="Women's Helpline (All India)" />
          <Input label="Number" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })}
                 placeholder="181" hint="Digits, with optional +, spaces or dashes — it must be dialable." />
          <Textarea label="One line on when to call it" value={form.desc}
                    onChange={(e) => setForm({ ...form, desc: e.target.value })}
                    placeholder="Free, 24×7. Any woman in distress." />
          <Switch label="Urgent" description="Shown first and in red — for immediate danger."
                  checked={form.urgent} onChange={(v) => setForm({ ...form, urgent: v })} />
          <Input label="Position in the list" type="number" min={0} value={String(form.order)}
                 onChange={(e) => setForm({ ...form, order: Math.max(0, Number(e.target.value) || 0) })} />
          {!managed && !editing && (
            <p className="text-xs text-ink-subtle">
              The {helplines?.builtin_count ?? 0} built-in numbers are copied in first, so this is added to them
              rather than replacing them.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
