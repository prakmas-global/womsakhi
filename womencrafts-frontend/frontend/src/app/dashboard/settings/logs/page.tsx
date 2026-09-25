"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle, Check, ChevronDown, CircleAlert, Download, Info, ScrollText, Search, Terminal,
} from "lucide-react";

import DonutChart from "@/components/charts/DonutChart";
import {
  Badge, Card, EmptyState, Menu, MenuItem, Modal, Pagination, Spinner, StatCard, useToast,
} from "@/design-system";
import { ResizableColumns } from "@/layout-engine";
import { memberError } from "@/lib/member-api";
import {
  apiPlatformLogSummary, apiPlatformLogs, apiPlatformLogsExportCsv, saveBlob,
  type PlatformEvent, type PlatformEventPage, type PlatformLogFilters, type PlatformLogSummary,
} from "@/lib/settings-platform-api";

/**
 * Platform events.
 *
 * WomSakhi keeps no system log in the database. Process output goes to
 * stdout — the terminal in development, Cloud Run logging in production —
 * and the seeded "system_logs" fixture this screen used to read was a picture
 * of one. What is shown now is the platform-level slice of the audit trail:
 * backups, restores, schedule and organisation changes, and anything written
 * by a process rather than a person. Severity is inferred from the action,
 * and the screen says so.
 */

const SEVERITY_TONE = { info: "sky", warning: "amber", error: "rose" } as const;
const SEVERITY_LABEL = { info: "Info", warning: "Warning", error: "Error" } as const;
const SEVERITY_COLOR = {
  info: "var(--status-info-solid)",
  warning: "var(--status-warn-solid)",
  error: "var(--status-danger-solid)",
} as const;

type Severity = keyof typeof SEVERITY_TONE;
const sev = (s: string): Severity => (s in SEVERITY_TONE ? (s as Severity) : "info");

const PAGE_SIZE = 25;
const EMPTY_PAGE: PlatformEventPage = { items: [], total: 0, page: 1, page_size: PAGE_SIZE, pages: 0 };

export default function PlatformEventsPage() {
  const toast = useToast();
  const [filters, setFilters] = useState<PlatformLogFilters>({ q: "", source: "", severity: "" });
  const [draftQ, setDraftQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PlatformEventPage>(EMPTY_PAGE);
  const [summary, setSummary] = useState<PlatformLogSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<PlatformEvent | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.q === draftQ ? f : { ...f, q: draftQ }));
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [draftQ]);

  // Inline so every setState provably follows an await; a reply arriving
  // after the filters have moved on is dropped.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [pg, sm] = await Promise.all([
          apiPlatformLogs({ ...filters, page, page_size: PAGE_SIZE }),
          apiPlatformLogSummary(),
        ]);
        if (!alive) return;
        setData(pg);
        setSummary(sm);
      } catch (e) {
        if (alive) toast.error("Could not load platform events", { description: memberError(e) });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [filters, page, toast]);

  const setFilter = (patch: Partial<PlatformLogFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      saveBlob(await apiPlatformLogsExportCsv(filters), "platform-events.csv");
      toast.success("Export ready", { description: `${data.total} event${data.total === 1 ? "" : "s"} in the file.` });
    } catch (e) {
      toast.error("Could not export", { description: memberError(e) });
    } finally {
      setExporting(false);
    }
  };

  const bySev = summary?.by_severity ?? {};
  const donut = (["info", "warning", "error"] as Severity[])
    .map((s) => ({ name: SEVERITY_LABEL[s], value: bySev[s] ?? 0, color: SEVERITY_COLOR[s] }))
    .filter((d) => d.value > 0);
  const filtered = !!(filters.q || filters.source || filters.severity);
  const showingFrom = data.total === 0 ? 0 : (data.page - 1) * data.page_size + 1;
  const showingTo = Math.min(data.total, data.page * data.page_size);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <ScrollText className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Platform events</h1>
            <p className="mt-1 text-sm text-ink-subtle">
              Backups, restores, schedule and organisation changes — the platform-level slice of the audit trail.
            </p>
          </div>
        </div>
        <button className="btn btn-outline" onClick={() => void exportCsv()} disabled={exporting || data.total === 0}>
          <Download className="h-4 w-4" /> {exporting ? "Preparing…" : "Export CSV"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Events" value={String(summary?.total ?? 0)} icon={ScrollText} tone="brand" deltaNote="All time" />
        <StatCard label="Warnings" value={String(bySev.warning ?? 0)} icon={AlertTriangle} tone="amber" deltaNote="Restores, deletions" />
        <StatCard label="Errors" value={String(bySev.error ?? 0)} icon={CircleAlert} tone="rose" deltaNote="Failed runs" />
        <StatCard label="Sources" value={String(summary?.sources.length ?? 0)} icon={Terminal} tone="sky" deltaNote="Distinct action families" />
      </div>

      {summary && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-status-info-border bg-status-info-bg p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-status-info-ink" />
          <div className="text-sm text-status-info-ink">
            <p className="font-semibold">Where the process log lives</p>
            <p className="mt-0.5">
              {summary.note} Process output for this <b>{summary.environment}</b> instance goes to{" "}
              <b>{summary.process_log_destination}</b>, not to this screen.
            </p>
          </div>
        </div>
      )}

      <Card className="mt-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              value={draftQ}
              onChange={(e) => setDraftQ(e.target.value)}
              placeholder="Search events…"
              className="wc-inset w-full rounded-xl py-2.5 pl-9 pr-3 text-sm text-ink placeholder-ink-subtle outline-none focus:ring-2 focus:ring-brand-500/40"
            />
          </div>
          <Menu align="left" width="min-w-[11rem]"
                trigger={<button className="btn btn-sm btn-outline">{filters.severity ? SEVERITY_LABEL[sev(filters.severity)] : "All severities"} <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" /></button>}>
            <MenuItem icon={!filters.severity ? Check : undefined} onClick={() => setFilter({ severity: "" })}>All severities</MenuItem>
            {(["info", "warning", "error"] as Severity[]).map((s) => (
              <MenuItem key={s} icon={filters.severity === s ? Check : undefined} onClick={() => setFilter({ severity: s })}>
                {SEVERITY_LABEL[s]}
              </MenuItem>
            ))}
          </Menu>
          <Menu align="left" width="min-w-[13rem]"
                trigger={<button className="btn btn-sm btn-outline">{filters.source || "All sources"} <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" /></button>}>
            <MenuItem icon={!filters.source ? Check : undefined} onClick={() => setFilter({ source: "" })}>All sources</MenuItem>
            {(summary?.sources ?? []).map((s) => (
              <MenuItem key={s} icon={filters.source === s ? Check : undefined} onClick={() => setFilter({ source: s })}>{s}</MenuItem>
            ))}
          </Menu>
        </div>
      </Card>

      <ResizableColumns id="settings-logs" defaultSize={0.74} className="mt-6 gap-6">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-ink">Events</h2>
            <p className="text-xs text-ink-subtle">{data.total === 0 ? "Nothing to show" : `Showing ${showingFrom}–${showingTo} of ${data.total}`}</p>
          </div>
          {loading && data.items.length === 0 ? (
            <div className="flex items-center justify-center py-16"><Spinner /></div>
          ) : data.items.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title={filtered ? "Nothing matches those filters" : "Nothing to show"}
              description={filtered
                ? "Clear a filter or search for something else."
                : "No platform-level events have been recorded yet. A backup, restore, schedule or organisation change will appear here."}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                    <th className="px-2 py-2.5">When</th>
                    <th className="px-2 py-2.5">Severity</th>
                    <th className="px-2 py-2.5">Source</th>
                    <th className="px-2 py-2.5">Message</th>
                    <th className="px-2 py-2.5">Who</th>
                    <th className="px-2 py-2.5">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((e) => (
                    <tr key={e.id} onClick={() => setSelected(e)} className="cursor-pointer border-b border-line text-sm last:border-0 hover:bg-surface-2">
                      <td className="whitespace-nowrap px-2 py-3 font-mono text-xs text-ink-subtle">{e.when}</td>
                      <td className="px-2 py-3"><Badge tone={SEVERITY_TONE[sev(e.severity)]}>{SEVERITY_LABEL[sev(e.severity)]}</Badge></td>
                      <td className="px-2 py-3"><span className="rounded-md bg-surface-inset px-2 py-0.5 font-mono text-xs text-ink-muted">{e.source}</span></td>
                      <td className="px-2 py-3 text-ink-muted">{e.message}</td>
                      <td className="whitespace-nowrap px-2 py-3 text-ink-muted">{e.user_name}</td>
                      <td className="whitespace-nowrap px-2 py-3 font-mono text-xs text-ink-subtle">{e.ip || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.pages > 1 && (
            <Pagination className="mt-4" page={data.page} pageCount={data.pages} onPageChange={setPage}
                        showing={`Showing ${showingFrom} to ${showingTo} of ${data.total}`} />
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 font-display text-base font-semibold text-ink">By severity</h2>
            {donut.length > 0 ? (
              <div className="flex flex-col items-center">
                <DonutChart data={donut} centerValue={String(summary?.total ?? 0)} centerLabel="Events" size={160} thickness={20} />
                <ul className="mt-4 w-full space-y-2">
                  {donut.map((d) => (
                    <li key={d.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-ink-muted">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} /> {d.name}
                      </span>
                      <span className="font-semibold text-ink-subtle">{d.value}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-2xs text-ink-subtle">Severity is inferred from the action, not recorded.</p>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-ink-subtle">Nothing recorded yet.</p>
            )}
          </Card>

          <Card>
            <h2 className="mb-2 font-display text-base font-semibold text-ink">How severity is inferred</h2>
            <ul className="space-y-1.5 text-sm text-ink-muted">
              <li><Badge tone="rose">Error</Badge> <span className="ml-1">a run that says it failed</span></li>
              <li><Badge tone="amber">Warning</Badge> <span className="ml-1">a restore, a deletion or a suspension</span></li>
              <li><Badge tone="sky">Info</Badge> <span className="ml-1">everything else</span></li>
            </ul>
          </Card>
        </div>
      </ResizableColumns>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Event" description={selected?.when}
             icon={ScrollText} iconTone={selected ? SEVERITY_TONE[sev(selected.severity)] : "brand"}
             footer={<button className="btn btn-primary" onClick={() => setSelected(null)}>Close</button>}>
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={SEVERITY_TONE[sev(selected.severity)]}>{SEVERITY_LABEL[sev(selected.severity)]}</Badge>
              <span className="rounded-md bg-surface-inset px-2 py-0.5 font-mono text-xs text-ink-muted">{selected.source}</span>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-semibold text-ink-muted">Message</p>
              <p className="wc-inset rounded-xl px-4 py-3 text-sm text-ink-muted">{selected.message}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[["Action", selected.action], ["Who", selected.user_name], ["When", selected.when], ["IP", selected.ip || "—"]].map(([k, v]) => (
                <div key={k}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">{k}</p>
                  <p className="break-all font-mono text-sm text-ink-muted">{v}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
