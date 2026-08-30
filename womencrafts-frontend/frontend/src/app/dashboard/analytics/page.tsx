"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Users,
  CalendarCheck,
  GraduationCap,
  Activity,
  Target,
  Download,
  Globe,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { Badge, Card, Menu, MenuItem, Modal, ProgressBar, SelectButton, StatCard, type Tone } from "@/design-system";
import AreaTrend from "@/components/charts/AreaTrend";
import BarTrend from "@/components/charts/BarTrend";
import DonutChart from "@/components/charts/DonutChart";
import MultiLine from "@/components/charts/MultiLine";
import { ResizableColumns } from "@/layout-engine";
import {
  apiAnalyticsSummary,
  apiAnalyticsTraffic,
  apiAnalyticsDevices,
  apiAnalyticsSources,
  apiAnalyticsEngagement,
  apiAnalyticsTopPages,
  apiAnalyticsReferrers,
  type AnalyticsStatCard,
  type AnalyticsRealtime,
  type TrafficPoint,
  type DeviceSlice,
  type SourceBar,
  type EngagementPoint,
  type TopPageRow,
  type ReferrerRow,
} from "@/lib/analytics-api";

// Fixed presentation constants (chart colours / series keys are a frontend concern).
const ENGAGEMENT_SERIES = [
  { key: "Sessions", color: "var(--color-brand-600)" },
  { key: "Users", color: "var(--color-violet-500)" },
];

const RANGE_OPTIONS = ["Last 7 Days", "Last 30 Days", "Last 90 Days", "This Year"];
const PERIOD_OPTIONS = ["This Week", "This Month", "This Quarter", "This Year"];

type StatKey = string;

// The API names an icon; this turns the name into a component. Same pattern as
// every other wired screen — the backend must not know about lucide.
const ICON_MAP: Record<string, LucideIcon> = {
  Users,
  CalendarCheck,
  GraduationCap,
  Activity,
  Target,
};

// Tapping a stat card scrolls to the chart that explains it.
const STAT_SCROLL: Record<string, string> = {
  members: "traffic-overview",
  bookings: "engagement-trend",
  enrollments: "engagement-trend",
  active: "engagement-trend",
  attendance: "top-pages",
};

type AnalyticsData = {
  stats: AnalyticsStatCard[];
  realtime: AnalyticsRealtime;
  traffic: TrafficPoint[];
  devices: DeviceSlice[];
  sources: SourceBar[];
  engagement: EngagementPoint[];
  topPages: TopPageRow[];
  referrers: ReferrerRow[];
};

export default function AnalyticsPage() {
  const [range, setRange] = useState("Last 30 Days");
  const [period, setPeriod] = useState("This Month");
  const [activeStat, setActiveStat] = useState<StatKey | null>(null);
  const [activeReferrer, setActiveReferrer] = useState<string | null>(null);
  const [detailPage, setDetailPage] = useState<TopPageRow | null>(null);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Pull every chart/table/KPI dataset from the live backend in parallel. The
  // range/period selectors are passed through so the toggles re-fetch on change.
  const refresh = useCallback(async () => {
    try {
      const [summary, traffic, devices, sources, engagement, topPages, referrers] =
        await Promise.all([
          apiAnalyticsSummary(range),
          apiAnalyticsTraffic(period),
          apiAnalyticsDevices(),
          apiAnalyticsSources(range),
          apiAnalyticsEngagement(period),
          apiAnalyticsTopPages(range),
          apiAnalyticsReferrers(),
        ]);
      setData({
        stats: summary.stats,
        realtime: summary.realtime,
        traffic,
        devices,
        sources,
        engagement,
        topPages,
        referrers,
      });
    } catch {
      /* leave current data; a toast could surface the error */
    } finally {
      setLoading(false);
    }
  }, [range, period]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Stat cards keyed by their stable key so each fixed card slot can read its
  // live value/delta while keeping its hardcoded icon/tone/label.
  const statByKey = useMemo(() => {
    const m: Record<string, AnalyticsStatCard> = {};
    for (const s of data?.stats ?? []) m[s.key] = s;
    return m;
  }, [data]);
  const stat = (key: StatKey) => statByKey[key];

  // MultiLine wants capitalised series keys matching ENGAGEMENT_SERIES / legend.
  const engagementData = useMemo(
    () =>
      (data?.engagement ?? []).map((e) => ({
        label: e.label,
        Sessions: e.sessions,
        Users: e.users,
      })),
    [data],
  );

  const membersValue = stat("members")?.value ?? "";

  const selectStat = (key: StatKey) => {
    setActiveStat(key);
    const target = STAT_SCROLL[key];
    const el = target ? document.getElementById(target) : null;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleExport = () => {
    if (!data) return;
    const header = ["Service", "Bookings", "Members", "Cancelled %", "Length"];
    const rows = data.topPages.map((p) => [
      p.page,
      p.views,
      p.unique,
      `${p.bounce}%`,
      p.time,
    ]);
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [header, ...rows]
      .map((cols) => cols.map(escape).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "analytics-export.csv";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const statRing = (key: StatKey) =>
    activeStat === key ? "rounded-2xl ring-2 ring-brand-400 ring-offset-2" : "rounded-2xl";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <BarChart3 className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Analytics</h1>
            <p className="mt-1 text-sm text-ink-subtle">Track performance and insights across your platform.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Menu trigger={<SelectButton label={range} />} width="min-w-[12rem]">
            {RANGE_OPTIONS.map((opt) => (
              <MenuItem key={opt} onClick={() => setRange(opt)}>
                {opt}
              </MenuItem>
            ))}
          </Menu>
          <button className="btn btn-sm btn-outline" onClick={handleExport}>
            <Download className="h-4 w-4" /> Export
          </button>
        </div>
      </div>

      {!data ? (
        <div className="flex items-center justify-center py-24 text-sm text-ink-subtle">
          {loading ? "Loading analytics…" : "Unable to load analytics."}
        </div>
      ) : (
        <>
          {/* stats */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {/* Rendered from the API's own cards. Label, icon and tone all come
                down with the value, so changing what analytics measures is a
                backend edit — the screen does not need to know the metric set. */}
            {(data.stats ?? []).map((card) => {
              const Icon = ICON_MAP[card.icon] ?? Activity;
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => selectStat(card.key)}
                  className={`block w-full text-left transition-transform duration-200 hover:-translate-y-1 ${statRing(card.key)}`}
                >
                  <StatCard
                    label={card.label}
                    value={card.value}
                    icon={Icon}
                    tone={card.tone as Tone}
                    delta={card.delta}
                    deltaDir={card.delta_dir}
                  />
                </button>
              );
            })}
          </div>

          {/* traffic overview + devices */}
          <ResizableColumns id="analytics-charts" defaultSize={0.72} className="mt-6 gap-6">
            <Card>
              <div id="traffic-overview" className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-ink">New Members</h2>
                  <p className="text-xs text-ink-subtle">Women joining over time</p>
                </div>
                <Menu trigger={<SelectButton label={period} />} width="min-w-[12rem]">
                  {PERIOD_OPTIONS.map((opt) => (
                    <MenuItem key={opt} onClick={() => setPeriod(opt)}>
                      {opt}
                    </MenuItem>
                  ))}
                </Menu>
              </div>
              <AreaTrend data={data.traffic} color="var(--color-violet-500)" height={260} id="traffic" chartLabel="Traffic" />
            </Card>

            <Card>
              <h2 className="mb-4 font-display text-base font-semibold text-ink">Members by Segment</h2>
              <div className="flex justify-center">
                <DonutChart data={data.devices} centerValue={membersValue} centerLabel="New" size={180} thickness={22} />
              </div>
              <ul className="mt-5 space-y-2.5">
                {data.devices.map((d) => (
                  <li key={d.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-ink-muted">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} /> {d.name}
                    </span>
                    <span className="font-semibold text-ink-muted">{d.value}%</span>
                  </li>
                ))}
              </ul>
            </Card>
          </ResizableColumns>

          {/* sources + engagement */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <h2 id="traffic-sources" className="mb-1 font-display text-base font-semibold text-ink">Bookings by Service Type</h2>
              <p className="mb-2 text-xs text-ink-subtle">Sessions booked in the selected period</p>
              <BarTrend data={data.sources} height={260} showLabels radius={6} id="sources" chartLabel="Sources" />
            </Card>
            <Card>
              <div id="engagement-trend" className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-ink">Engagement Trend</h2>
                  <p className="text-xs text-ink-subtle">Sessions booked vs. members booking them</p>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5 text-ink-subtle">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-brand-600)" }} /> Sessions
                  </span>
                  <span className="flex items-center gap-1.5 text-ink-subtle">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-violet-500)" }} /> Users
                  </span>
                </div>
              </div>
              <MultiLine data={engagementData} series={ENGAGEMENT_SERIES} height={252} id="engagement" chartLabel="Engagement" />
            </Card>
          </div>

          {/* top pages + referrers/realtime */}
          <ResizableColumns id="analytics-tables" defaultSize={0.75} className="mt-6 gap-6">
            <Card>
              <h2 id="top-pages" className="mb-4 font-display text-base font-semibold text-ink">Most-booked Services</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                      <th scope="col" className="px-2 py-3">Service</th>
                      <th scope="col" className="px-2 py-3">Bookings</th>
                      <th scope="col" className="px-2 py-3">Members</th>
                      <th scope="col" className="px-2 py-3">Cancelled</th>
                      <th scope="col" className="px-2 py-3">Length</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.topPages.map((p) => (
                      <tr
                        key={p.page}
                        onClick={() => setDetailPage(p)}
                        className="cursor-pointer text-sm hover:bg-surface-hover/60"
                      >
                        <td className="px-2 py-3 font-semibold text-ink">{p.page}</td>
                        <td className="px-2 py-3 text-ink-muted">{p.views}</td>
                        <td className="px-2 py-3 text-ink-subtle">{p.unique}</td>
                        <td className="px-2 py-3">
                          <Badge tone={p.tone}>{p.bounce}%</Badge>
                        </td>
                        <td className="px-2 py-3 text-ink-subtle">{p.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="space-y-6">
              <Card>
                <h2 className="mb-4 font-display text-base font-semibold text-ink">How Members Found Us</h2>
                <ul className="space-y-4">
                  {data.referrers.map((r) => (
                    <li key={r.name}>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveReferrer((cur) => (cur === r.name ? null : r.name))
                        }
                        className={`block w-full rounded-lg text-left transition hover:bg-surface-hover/60 ${
                          activeReferrer === r.name ? "ring-2 ring-brand-300" : ""
                        }`}
                      >
                        <div className="mb-1.5 flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 font-medium text-ink-muted">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-inset text-ink-subtle">
                              <Globe className="h-3.5 w-3.5" />
                            </span>
                            {r.name}
                          </span>
                          <span className="text-xs font-semibold text-ink-subtle">{r.visits}</span>
                        </div>
                        <ProgressBar value={r.pct} color={r.color} />
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card className="bg-linear-to-br from-brand-50 to-violet-50">
                <div className="flex items-center justify-between">
                  {/* Not "live". Nothing in WomSakhi tracks an open session, so
                      this counts members who booked or joined something in the
                      last seven days — a number that can actually be measured.
                      The pulsing "Live" dot was removed for the same reason. */}
                  <h2 className="font-display text-base font-semibold text-ink">Active Members</h2>
                  <span className="text-xs font-medium text-ink-subtle">last 7 days</span>
                </div>
                <p className="mt-4 font-display text-4xl font-bold text-ink">{data.realtime.active}</p>
                <p className="mt-1 text-sm text-ink-subtle">booked or joined something</p>
                <p
                  className={`mt-3 flex items-center gap-1 text-xs font-medium ${
                    data.realtime.change_dir === "up" ? "text-status-ok-ink" : "text-status-danger-ink"
                  }`}
                >
                  <ArrowUpRight
                    className={`h-3.5 w-3.5 ${data.realtime.change_dir === "up" ? "" : "rotate-90"}`}
                  />{" "}
                  {data.realtime.change} {data.realtime.change_dir === "up" ? "more" : "fewer"} than the week before
                </p>
              </Card>
            </div>
          </ResizableColumns>
        </>
      )}

      {/* top page detail modal */}
      <Modal
        open={detailPage !== null}
        onClose={() => setDetailPage(null)}
        title={detailPage?.page ?? ""}
        description="Page performance details"
        icon={Globe}
        iconTone="violet"
        footer={
          <button className="btn btn-outline" onClick={() => setDetailPage(null)}>
            Close
          </button>
        }
      >
        {detailPage && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-ink-subtle">Views</p>
              <p className="mt-1 font-display text-lg font-bold text-ink">{detailPage.views}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-subtle">Unique</p>
              <p className="mt-1 font-display text-lg font-bold text-ink">{detailPage.unique}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-subtle">Bounce</p>
              <p className="mt-1">
                <Badge tone={detailPage.tone}>{detailPage.bounce}%</Badge>
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-subtle">Avg. Time</p>
              <p className="mt-1 font-display text-lg font-bold text-ink">{detailPage.time}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
