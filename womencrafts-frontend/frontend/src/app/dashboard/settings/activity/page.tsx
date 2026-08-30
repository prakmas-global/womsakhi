"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  Clock3,
  Download,
  History,
  Shield,
  User,
} from "lucide-react";

import AdminPage, { AdminLoading } from "@/components/admin/AdminPage";
import AreaTrend from "@/components/charts/AreaTrend";
import DonutChart from "@/components/charts/DonutChart";
import { Badge, Card, EmptyState, Menu, MenuItem, Modal, Tabs } from "@/design-system";
import {
  apiStaffActivity,
  apiStaffActivityOverview,
  type ActivityItem,
  type ActivityOverview,
} from "@/lib/staff-api";
import { memberError } from "@/lib/member-api";

/**
 * The activity log.
 *
 * Every row here is a real record written by `log_activity` when a staff member
 * did something consequential — the two charts are aggregated from the same
 * collection in the database, not sampled or estimated.
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

const RANGES = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 14 days", days: 14 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

export default function MyActivityPage() {
  const [scope, setScope] = useState("mine");
  const [range, setRange] = useState(RANGES[1]);
  const [category, setCategory] = useState("");
  const [rows, setRows] = useState<ActivityItem[]>([]);
  const [overview, setOverview] = useState<ActivityOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ActivityItem | null>(null);

  const mine = scope === "mine";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [items, chart] = await Promise.all([
        apiStaffActivity({ mine, category, days: range.days, limit: 200 }),
        apiStaffActivityOverview({ mine, days: Math.min(range.days, 30) }),
      ]);
      setRows(items);
      setOverview(chart);
      setError("");
    } catch (err) {
      setError(memberError(err));
    } finally {
      setLoading(false);
    }
  }, [mine, category, range.days]);

  useEffect(() => {
    void load();
  }, [load]);

  const donut = useMemo(
    () =>
      (overview?.breakdown ?? []).map((b) => ({
        name: b.name,
        value: b.value,
        color: CATEGORY_COLOR[b.name] ?? "var(--color-ink-faint)",
      })),
    [overview],
  );

  // "What do I do most" — counted from the actions actually recorded.
  const topActions = useMemo(() => {
    const counts = new Map<string, { action: string; category: string; n: number }>();
    rows.forEach((r) => {
      const cur = counts.get(r.action) ?? { action: r.action, category: r.category, n: 0 };
      cur.n += 1;
      counts.set(r.action, cur);
    });
    return [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 6);
  }, [rows]);

  const categories = useMemo(
    () => [...new Set(rows.map((r) => r.category))].sort(),
    [rows],
  );

  function exportCsv() {
    const head = ["When", "Who", "Action", "Category", "Target", "Detail", "IP"];
    const body = rows.map((r) => [r.when, r.user_name, r.action, r.category, r.target, r.detail, r.ip]);
    const csv = [head, ...body]
      .map((line) => line.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-${range.days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminPage
      title="Activity log"
      subtitle="Every consequential action, recorded as it happened. Nothing here can be edited or removed."
      error={error}
      stats={[
        { label: "Actions recorded", value: overview?.total ?? 0 },
        { label: "Today", value: overview?.today ?? 0, tone: "text-brand-ink" },
        { label: "Last 7 days", value: overview?.this_week ?? 0, tone: "text-violet-ink" },
        { label: "Showing", value: rows.length, tone: "text-ink-subtle" },
      ]}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Menu
            align="right"
            trigger={
              <button className="btn btn-sm btn-outline">
                <CalendarDays className="h-3.5 w-3.5" /> {range.label}
              </button>
            }
          >
            {RANGES.map((r) => (
              <MenuItem key={r.days} onClick={() => setRange(r)}>
                {r.label}
              </MenuItem>
            ))}
          </Menu>
          <button onClick={exportCsv} disabled={rows.length === 0} className="btn btn-sm btn-outline">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>
      }
    >
      <Tabs
        className="mb-5"
        value={scope}
        onChange={setScope}
        tabs={[
          { value: "mine", label: "My activity" },
          { value: "all", label: "Everyone" },
        ]}
      />

      {loading ? (
        <AdminLoading rows={5} />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-base font-bold text-ink">Actions over time</h2>
                <span className="text-xs text-ink-subtle">{range.label}</span>
              </div>
              {overview && overview.timeline.some((t) => t.value > 0) ? (
                <AreaTrend data={overview.timeline} color="var(--color-violet-500)" height={240} id="timeline" chartLabel="Activity timeline" />
              ) : (
                <EmptyState
                  icon={Activity}
                  title="Nothing recorded yet"
                  description="Actions appear here as soon as anyone changes something."
                />
              )}
            </Card>

            <Card>
              <h2 className="mb-3 font-display text-base font-bold text-ink">By area</h2>
              {donut.length > 0 ? (
                <>
                  <div className="flex justify-center">
                    <DonutChart
                      data={donut}
                      centerValue={String(overview?.total ?? 0)}
                      centerLabel="Actions"
                      size={168}
                      thickness={20}
                    />
                  </div>
                  <ul className="mt-4 space-y-1.5">
                    {(overview?.breakdown ?? []).map((b) => (
                      <li key={b.name} className="flex items-center gap-2 text-sm">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: CATEGORY_COLOR[b.name] ?? "var(--color-ink-faint)" }}
                        />
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

          {topActions.length > 0 && (
            <Card className="mt-4">
              <h2 className="mb-3 font-display text-base font-bold text-ink">Most frequent</h2>
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {topActions.map((a) => (
                  <li
                    key={a.action}
                    className="wc-inset flex items-center gap-3 rounded-xl px-3.5 py-2.5"
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
                      style={{ background: CATEGORY_COLOR[a.category] ?? "var(--color-ink-faint)" }}
                    >
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

          <Card className="mt-4 p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 dark:border-white/10">
              <h2 className="font-display text-base font-bold text-ink">Recent activity</h2>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setCategory("")}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    !category ? "bg-brand-600 text-white" : "wc-inset text-ink-muted"
                  }`}
                >
                  All
                </button>
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(category === c ? "" : c)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      category === c ? "bg-brand-600 text-white" : "wc-inset text-ink-muted"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {rows.length === 0 ? (
              <EmptyState
                icon={History}
                title="No activity in this period"
                description="Try a longer range, or switch to everyone's activity."
              />
            ) : (
              <ul className="divide-y divide-line dark:divide-white/5">
                {rows.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => setSelected(r)}
                      className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-surface-hover dark:hover:bg-white/5"
                    >
                      <span
                        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
                        style={{ background: CATEGORY_COLOR[r.category] ?? "var(--color-ink-faint)" }}
                      >
                        <Activity className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-ink">{r.action}</span>
                        <span className="block truncate text-xs text-ink-subtle">
                          {r.target || r.detail || r.category}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <Badge tone={CATEGORY_TONE[r.category] ?? "slate"}>{r.category}</Badge>
                        <span className="text-xs text-ink-subtle">{r.when}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.action ?? ""}
        description={selected?.when}
        icon={History}
        footer={
          <button className="btn btn-outline" onClick={() => setSelected(null)}>
            Close
          </button>
        }
      >
        <dl className="space-y-3">
          {[
            { icon: User, label: "Who", value: selected?.user_name },
            { icon: Activity, label: "Area", value: selected?.category },
            { icon: Clock3, label: "When", value: selected?.when },
            { icon: Shield, label: "From", value: selected?.ip || "—" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-inset text-ink-subtle dark:bg-white/10">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <dt className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                  {label}
                </dt>
                <dd className="text-sm font-medium text-ink">{value || "—"}</dd>
              </div>
            </div>
          ))}
          {selected?.target && (
            <div className="rounded-xl bg-surface-inset px-3.5 py-3 dark:bg-white/5">
              <dt className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                What
              </dt>
              <dd className="mt-0.5 text-sm text-ink-muted">{selected.target}</dd>
            </div>
          )}
          {selected?.detail && (
            <div className="rounded-xl bg-surface-inset px-3.5 py-3 dark:bg-white/5">
              <dt className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                Detail
              </dt>
              <dd className="mt-0.5 text-sm text-ink-muted">{selected.detail}</dd>
            </div>
          )}
        </dl>
      </Modal>
    </AdminPage>
  );
}
