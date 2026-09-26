"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, CalendarDays, Clock3, Download, History, Search, Shield, User, Users,
} from "lucide-react";

import AreaTrend from "@/components/charts/AreaTrend";
import DonutChart from "@/components/charts/DonutChart";
import {
  Badge, Card, EmptyState, Input, Modal, Pagination, Select, Spinner, StatCard, useToast,
} from "@/design-system";
import { useAuth } from "@/context/AuthContext";
import { memberError } from "@/lib/member-api";
import {
  apiActivityActors, apiActivityCategories, apiActivityExportCsv, apiActivityLog, apiActivitySummary,
  saveBlob,
  type ActivityActor, type ActivityFilters, type ActivityPage, type ActivityRow, type ActivitySummary,
} from "@/lib/settings-platform-api";

/**
 * The audit trail.
 *
 * Every row is a record written by `app/core/audit.py` when a staff member did
 * something consequential. The filters run in the database, the page is the
 * page the server returned, and every number on this screen is a count over
 * the rows the same filters select. Nothing here is estimated.
 *
 * There is no "clear" button anywhere on this screen, and there never will be.
 * An audit trail you can edit is not an audit trail.
 */

const CATEGORY_COLOR: Record<string, string> = {
  Users: "var(--color-violet-500)",
  Appointments: "var(--status-ok-solid)",
  Programs: "var(--status-info-solid)",
  Content: "var(--status-info-solid)",
  Community: "var(--color-brand-600)",
  Growth: "var(--status-ok-solid)",
  Safety: "var(--status-danger-solid)",
  Settings: "var(--color-ink-subtle)",
  Reports: "var(--status-warn-solid)",
};

const CATEGORY_TONE: Record<string, "violet" | "emerald" | "blue" | "sky" | "brand" | "rose" | "slate" | "amber"> = {
  Users: "violet",
  Appointments: "emerald",
  Programs: "blue",
  Content: "sky",
  Community: "brand",
  Growth: "emerald",
  Safety: "rose",
  Settings: "slate",
  Reports: "amber",
};

const PAGE_SIZE = 25;

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** The same 90-day default the server applies, so the inputs show what was used. */
function defaultRange() {
  const to = new Date();
  const from = new Date(to.getTime() - 89 * 86_400_000);
  return { from: isoDay(from), to: isoDay(to) };
}

const EMPTY_PAGE: ActivityPage = { items: [], total: 0, page: 1, page_size: PAGE_SIZE, pages: 0 };

export default function ActivityLogPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [filters, setFilters] = useState<ActivityFilters>(() => ({ user_id: "", category: "", q: "", ...defaultRange() }));
  const [draftQ, setDraftQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ActivityPage>(EMPTY_PAGE);
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [actors, setActors] = useState<ActivityActor[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<ActivityRow | null>(null);

  // The search box is debounced into the filters; everything else applies at once.
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.q === draftQ ? f : { ...f, q: draftQ }));
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [draftQ]);

  // The two vocabularies change rarely; one wave on mount.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const [a, c] = await Promise.all([
        apiActivityActors().catch(() => [] as ActivityActor[]),
        apiActivityCategories().catch(() => [] as string[]),
      ]);
      if (!alive) return;
      setActors(a);
      setCategories(c);
    })();
    return () => { alive = false; };
  }, []);

  // The page and its counts, fetched together whenever a filter or the page
  // changes. Written inline so every setState provably follows an await; a
  // reply arriving after the filters have moved on is dropped.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [pg, sm] = await Promise.all([
          apiActivityLog({ ...filters, page, page_size: PAGE_SIZE }),
          apiActivitySummary(filters),
        ]);
        if (!alive) return;
        setData(pg);
        setSummary(sm);
      } catch (e) {
        if (alive) toast.error("Could not load the activity log", { description: memberError(e) });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [filters, page, toast]);

  const setFilter = (patch: Partial<ActivityFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await apiActivityExportCsv(filters);
      saveBlob(blob, `activity-${filters.from}-to-${filters.to}.csv`);
      toast.success("Export ready", { description: `${data.total} row${data.total === 1 ? "" : "s"} in the file. The export itself is recorded.` });
    } catch (e) {
      toast.error("Could not export", { description: memberError(e) });
    } finally {
      setExporting(false);
    }
  };

  const donut = useMemo(
    () => (summary?.by_category ?? []).map((b) => ({
      name: b.name, value: b.value, color: CATEGORY_COLOR[b.name] ?? "var(--color-ink-faint)",
    })),
    [summary],
  );

  const myId = user?.id ?? "";
  const staffOptions = useMemo(
    () => [
      { value: "", label: "Everyone" },
      ...(myId ? [{ value: myId, label: "Me" }] : []),
      ...actors
        .filter((a) => a.user_id && a.user_id !== myId)
        .map((a) => ({ value: a.user_id, label: `${a.user_name} (${a.actions})` })),
    ],
    [actors, myId],
  );

  const filtered = !!(filters.user_id || filters.category || filters.q);
  const showingFrom = data.total === 0 ? 0 : (data.page - 1) * data.page_size + 1;
  const showingTo = Math.min(data.total, data.page * data.page_size);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <History className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Activity log</h1>
            <p className="mt-1 text-sm text-ink-subtle">
              Every consequential staff action, as it happened. Nothing here can be edited or removed.
            </p>
          </div>
        </div>
        <button className="btn btn-outline" onClick={() => void exportCsv()} disabled={exporting || data.total === 0}>
          <Download className="h-4 w-4" /> {exporting ? "Preparing…" : "Export CSV"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Actions in range" value={String(summary?.total ?? 0)} icon={Activity} tone="brand"
                  deltaNote={summary ? `${summary.range_from} to ${summary.range_to}` : "…"} />
        <StatCard label="Today" value={String(summary?.today ?? 0)} icon={Clock3} tone="violet"
                  deltaNote="Since midnight UTC" />
        <StatCard label="Last 7 days" value={String(summary?.last_7_days ?? 0)} icon={CalendarDays} tone="sky"
                  deltaNote="Within the current filters" />
        <StatCard label="People acting" value={String(summary?.actors ?? 0)} icon={Users} tone="emerald"
                  deltaNote="Distinct accounts in range" />
      </div>

      <Card className="mt-6">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Select label="Who" value={filters.user_id ?? ""} options={staffOptions}
                  onChange={(e) => setFilter({ user_id: e.target.value })} />
          <Select label="Area" value={filters.category ?? ""}
                  options={[{ value: "", label: "All areas" }, ...categories.map((c) => ({ value: c, label: c }))]}
                  onChange={(e) => setFilter({ category: e.target.value })} />
          <Input label="From" type="date" value={filters.from ?? ""} max={filters.to || undefined}
                 onChange={(e) => setFilter({ from: e.target.value })} />
          <Input label="To" type="date" value={filters.to ?? ""} min={filters.from || undefined}
                 onChange={(e) => setFilter({ to: e.target.value })} />
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink-muted">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
              <input
                value={draftQ}
                onChange={(e) => setDraftQ(e.target.value)}
                placeholder="Action, detail, target, IP…"
                className="wc-inset w-full rounded-xl py-2.5 pl-9 pr-3 text-sm text-ink placeholder-ink-subtle outline-none focus:ring-2 focus:ring-brand-500/40"
              />
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-ink">Actions over time</h2>
            <span className="text-xs text-ink-subtle">{summary ? `${summary.range_from} → ${summary.range_to}` : ""}</span>
          </div>
          {summary && summary.timeline.some((t) => t.value > 0) ? (
            <AreaTrend data={summary.timeline} color="var(--color-violet-500)" height={220} id="activity-timeline" chartLabel="Actions per day" />
          ) : (
            <EmptyState icon={Activity} title="Nothing recorded in this range"
                        description="Actions appear here as soon as anyone changes something." />
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-display text-base font-semibold text-ink">By area</h2>
          {donut.length > 0 ? (
            <>
              <div className="flex justify-center">
                <DonutChart data={donut} centerValue={String(summary?.total ?? 0)} centerLabel="Actions" size={160} thickness={20} />
              </div>
              <ul className="mt-4 space-y-1.5">
                {(summary?.by_category ?? []).map((b) => (
                  <li key={b.name} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CATEGORY_COLOR[b.name] ?? "var(--color-ink-faint)" }} />
                    <span className="min-w-0 flex-1 truncate text-ink-muted">{b.name}</span>
                    <span className="shrink-0 font-semibold text-ink">{b.value}</span>
                    <span className="w-12 shrink-0 text-end text-xs text-ink-subtle">{b.pct}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="py-10 text-center text-sm text-ink-subtle">Nothing to show yet.</p>
          )}
        </Card>
      </div>

      {summary && summary.top_actions.length > 0 && (
        <Card className="mt-4">
          <h2 className="mb-3 font-display text-base font-semibold text-ink">Most frequent in this range</h2>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {summary.top_actions.map((a) => (
              <li key={`${a.action}-${a.category}`} className="wc-inset flex items-center gap-3 rounded-xl px-3.5 py-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
                      style={{ background: CATEGORY_COLOR[a.category] ?? "var(--color-ink-faint)" }}>
                  <Activity className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{a.action}</span>
                  <span className="block text-xs text-ink-subtle">{a.category}</span>
                </span>
                <span className="shrink-0 font-display text-lg font-bold text-ink">{a.n}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mt-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-ink">Recorded actions</h2>
            <p className="text-xs text-ink-subtle">
              {data.total === 0 ? "No rows match" : `Showing ${showingFrom}–${showingTo} of ${data.total}`}
            </p>
          </div>
        </div>

        {loading && data.items.length === 0 ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={History}
            title={filtered ? "Nothing matches those filters" : "Nothing recorded in this range"}
            description={filtered ? "Widen the search, or pick a longer range." : "Try a longer range."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                  <th className="px-3 py-2.5">When</th>
                  <th className="px-3 py-2.5">Who</th>
                  <th className="px-3 py-2.5">What</th>
                  <th className="px-3 py-2.5">Area</th>
                  <th className="px-3 py-2.5">From</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.id} onClick={() => setSelected(r)}
                      className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2">
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-ink-subtle">{r.when}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-sm font-medium text-ink">{r.user_name || "System"}</td>
                    <td className="px-3 py-3">
                      <p className="text-sm text-ink">{r.detail || r.target || r.action}</p>
                      <p className="mt-0.5 font-mono text-2xs text-ink-subtle">{r.action}{r.target && r.detail ? ` · ${r.target}` : ""}</p>
                    </td>
                    <td className="px-3 py-3"><Badge tone={CATEGORY_TONE[r.category] ?? "slate"}>{r.category}</Badge></td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-ink-subtle">{r.ip || "—"}</td>
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

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.detail || selected?.action || ""}
             description={selected?.when} icon={History}
             footer={<button className="btn btn-outline" onClick={() => setSelected(null)}>Close</button>}>
        {selected && (
          <dl className="space-y-3">
            {[
              { icon: User, label: "Who", value: selected.user_name || "System" },
              { icon: Activity, label: "Action", value: selected.action },
              { icon: Shield, label: "Area", value: selected.category },
              { icon: Clock3, label: "When", value: selected.when },
              { icon: Shield, label: "From", value: selected.ip || "—" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-inset text-ink-subtle dark:bg-white/10">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <dt className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">{label}</dt>
                  <dd className="break-all text-sm font-medium text-ink">{value}</dd>
                </div>
              </div>
            ))}
            {selected.target && (
              <div className="rounded-xl bg-surface-inset px-3.5 py-3 dark:bg-white/5">
                <dt className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">Target</dt>
                <dd className="mt-0.5 break-all text-sm text-ink-muted">{selected.target}</dd>
              </div>
            )}
            {selected.detail && (
              <div className="rounded-xl bg-surface-inset px-3.5 py-3 dark:bg-white/5">
                <dt className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">Detail</dt>
                <dd className="mt-0.5 text-sm text-ink-muted">{selected.detail}</dd>
              </div>
            )}
          </dl>
        )}
      </Modal>
    </div>
  );
}
