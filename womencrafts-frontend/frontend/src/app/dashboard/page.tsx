"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  CalendarCheck,
  ShoppingBag,
  BookMarked,
  ChevronDown,
  ChevronRight,
  HardDrive,
  MonitorSmartphone,
  CircleCheck,
  DatabaseBackup,
} from "lucide-react";
import { Avatar, Card, Menu, MenuItem, StatCard } from "@/design-system";
import DonutChart from "@/components/charts/DonutChart";
import { WidgetGrid } from "@/layout-engine";
import AreaTrend from "@/components/charts/AreaTrend";
import {
  apiDashboardOverview,
  type DashboardOverview,
} from "@/lib/dashboard-api";

// Lucide icon components keyed by the icon name the backend sends per KPI card.
const STAT_ICONS: Record<string, React.ElementType> = {
  Users,
  CalendarCheck,
  ShoppingBag,
  BookMarked,
};

const STATUS_TONE: Record<string, string> = {
  Completed: "bg-status-ok-bg text-status-ok-ink",
  Scheduled: "bg-status-info-bg text-status-info-ink",
  Cancelled: "bg-status-danger-bg text-status-danger-ink",
};

function ViewAll({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-0.5 text-xs font-semibold text-brand-ink hover:underline"
    >
      View All <ChevronRight className="h-3.5 w-3.5" />
    </Link>
  );
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  // Seeded from whatever range the server sent, then owned by the control.
  const [trendRange, setTrendRange] = useState("Last 7 Days");

  // One call hydrates the whole screen (KPI cards, appointment trend + tiles,
  // users-by-role donut, recent users, recent appointments, system overview).
  const refresh = useCallback(async () => {
    try {
      const data = await apiDashboardOverview();
      setOverview(data);
    } catch {
      /* leave overview null; a toast could surface the error */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="space-y-6">
      {/* header */}
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-ink-subtle">
          Welcome back, Admin! Here&apos;s what&apos;s happening today.
        </p>
      </div>

      {!overview ? (
        <div className="flex items-center justify-center py-24 text-sm text-ink-subtle">
          {loading ? "Loading dashboard…" : "Unable to load dashboard."}
        </div>
      ) : (
        <>
          {/* stat cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {overview.stats.map((s) => (
              <StatCard
                key={s.key}
                label={s.label}
                value={s.value}
                icon={STAT_ICONS[s.icon] ?? Users}
                tone={s.tone}
                delta={s.delta}
                deltaDir={s.delta_dir}
                href={s.href}
              />
            ))}
          </div>

          {/* The dashboard is hers to arrange: reorder these cards, make them
              wider or narrower, hide the ones she never reads. Spans below are
              the original three-column layout, so nothing moves until she
              moves it. */}
          <WidgetGrid
            screen="dashboard"
            columns={3}
            widgets={[
              {
                id: "appointments",
                title: "Appointments Overview",
                span: 2,
                hidden: false,
                render: () => (
                  <Card className="flex h-full flex-col lg:col-span-2">
                    <div className="mb-2 flex shrink-0 items-center justify-between">
                      <Link
                        href="/dashboard/appointments"
                        className="font-display text-base font-semibold text-ink transition hover:text-brand-ink"
                      >
                        Appointments Overview
                      </Link>
                      <div className="flex items-center gap-2">
                        <Menu
                          align="right"
                          trigger={
                            <button className="btn btn-sm btn-outline">
                              {trendRange}
                              <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" />
                            </button>
                          }
                        >
                          {[
                            "Last 7 Days",
                            "Last 30 Days",
                            "This Quarter",
                            "This Year",
                          ].map((r) => (
                            <MenuItem key={r} onClick={() => setTrendRange(r)}>
                              {r}
                            </MenuItem>
                          ))}
                        </Menu>
                        <ViewAll href="/dashboard/appointments" />
                      </div>
                    </div>
                    {/* `fill` + `flex-1 min-h-0`: the chart takes whatever
                        height is left after the header and the tiles. Drag the
                        card shorter and the chart shrinks — it does not overflow
                        onto the cards below, which is what it used to do. */}
                    <div className="min-h-[6rem] flex-1">
                      <AreaTrend
                        data={overview.appointment_trend.series}
                        color="var(--color-violet-500)"
                        height={230}
                        fill
                        chartLabel="Appointment trend"
                      />
                    </div>
                    <div className="mt-4 grid shrink-0 grid-cols-4 gap-3">
                      {overview.appointment_trend.tiles.map((s) => (
                        <Link
                          key={s.label}
                          href={s.href}
                          className={`rounded-xl px-3 py-2.5 text-center transition-transform duration-200 hover:-translate-y-0.5 ${s.tone.split(" ")[1]}`}
                        >
                          <p
                            className={`font-display text-lg font-bold ${s.tone.split(" ")[0]}`}
                          >
                            {s.value}
                          </p>
                          <p className="text-2xs text-ink-subtle">
                            {s.label}
                          </p>
                        </Link>
                      ))}
                    </div>
                  </Card>
                ),
              },
              {
                id: "users-by-role",
                title: "Users by Role",
                span: 1,
                hidden: false,
                render: () => (
                  <Card className="flex h-full flex-col">
                    <div className="mb-2 flex shrink-0 items-center justify-between">
                      <Link
                        href="/dashboard/users/roles"
                        className="font-display text-base font-semibold text-ink transition hover:text-brand-ink"
                      >
                        Users by Role
                      </Link>
                      <ViewAll href="/dashboard/users/roles" />
                    </div>
                    {/* The chart owns its whole representation — ring plus
                        legend, then ring alone, then a proportion strip, then a
                        headline number. It measures its own box, so it is the
                        only thing that can know when the legend stops fitting.
                        A legend rendered out here could not, and overflowed. */}
                    <div className="min-h-0 flex-1">
                      <DonutChart
                        data={overview.users_by_role.segments}
                        centerValue={overview.users_by_role.center_value}
                        centerLabel={overview.users_by_role.center_label}
                        legend
                      />
                    </div>
                  </Card>
                ),
              },
              {
                id: "recent-users",
                title: "Recent Users",
                span: 1,
                hidden: false,
                render: () => (
                  <Card className="flex h-full flex-col">
                    <div className="mb-4 flex shrink-0 items-center justify-between">
                      <h2 className="font-display text-base font-semibold text-ink">
                        Recent Users
                      </h2>
                      <ViewAll href="/dashboard/users" />
                    </div>
                    <ul className="wc-scroll-fade min-h-0 flex-1 space-y-1 overflow-y-auto">
                      {overview.recent_users.map((u, i) => (
                        <li key={`${u.email}-${i}`}>
                          <Link
                            href="/dashboard/users"
                            className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-surface-hover dark:hover:bg-white/5"
                          >
                            <Avatar name={u.name} size="sm" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-ink">
                                {u.name}
                              </p>
                              <p className="truncate text-xs text-ink-subtle">
                                {u.email}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-ink-subtle">{u.date}</p>
                              <span className="mt-0.5 inline-block rounded-full bg-status-ok-bg px-2 py-0.5 text-2xs font-semibold text-status-ok-ink">
                                {u.status}
                              </span>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ),
              },
              {
                id: "recent-appointments",
                title: "Recent Appointments",
                span: 1,
                hidden: false,
                render: () => (
                  <Card className="flex h-full flex-col">
                    <div className="mb-4 flex shrink-0 items-center justify-between">
                      <h2 className="font-display text-base font-semibold text-ink">
                        Recent Appointments
                      </h2>
                      <ViewAll href="/dashboard/appointments" />
                    </div>
                    <ul className="wc-scroll-fade min-h-0 flex-1 space-y-1 overflow-y-auto">
                      {overview.recent_appointments.map((a, i) => (
                        <li key={`${a.title}-${i}`}>
                          <Link
                            href="/dashboard/appointments"
                            className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-surface-hover dark:hover:bg-white/5"
                          >
                            <Avatar name={a.who} size="sm" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-ink">
                                {a.title}
                              </p>
                              <p className="truncate text-xs text-ink-subtle">
                                with {a.who}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-ink-subtle">{a.date}</p>
                              <p className="text-2xs text-ink-subtle">
                                {a.time}
                              </p>
                            </div>
                            <span
                              className={`ml-1 shrink-0 rounded-full px-2 py-0.5 text-2xs font-semibold ${STATUS_TONE[a.status]}`}
                            >
                              {a.status}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ),
              },
              {
                id: "system",
                title: "System Overview",
                span: 1,
                hidden: false,
                render: () => (
                  <Card className="flex h-full flex-col">
                    <h2 className="mb-4 shrink-0 font-display text-base font-semibold text-ink">
                      System Overview
                    </h2>
                    <div className="wc-scroll-fade min-h-0 flex-1 space-y-2 overflow-y-auto">
                      <Link
                        href="/dashboard/settings"
                        className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-1.5 transition hover:bg-surface-hover dark:hover:bg-white/5"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-tint text-violet-ink">
                          <HardDrive className="h-5 w-5" />
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-ink-muted">
                              Storage Usage
                            </span>
                            <span className="text-ink-subtle">
                              {overview.system_overview.storage_percent_label}
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-inset">
                            <div
                              className="h-full rounded-full bg-violet-500"
                              style={{
                                width: `${overview.system_overview.storage_percent}%`,
                              }}
                            />
                          </div>
                          <p className="mt-1 text-xs text-ink-subtle">
                            {overview.system_overview.storage_label}
                          </p>
                        </div>
                      </Link>

                      <Row
                        href="/dashboard/settings/sessions"
                        icon={MonitorSmartphone}
                        tone="bg-brand-100 text-brand-ink"
                        title="Active Sessions"
                        sub="View all sessions"
                        trailing={String(
                          overview.system_overview.active_sessions,
                        )}
                      />
                      <Row
                        href="/dashboard/settings"
                        icon={CircleCheck}
                        tone="bg-status-ok-bg text-status-ok-ink"
                        title="System Status"
                        sub={overview.system_overview.status_label}
                        subClass="text-status-ok-ink"
                      />
                      <Row
                        href="/dashboard/settings/backup"
                        icon={DatabaseBackup}
                        tone="bg-status-info-bg text-status-info-ink"
                        title="Last Backup"
                        sub={`${overview.system_overview.last_backup_label} · ${overview.system_overview.last_backup_type}`}
                      />
                    </div>
                  </Card>
                ),
              },
            ]}
          />
        </>
      )}
    </div>
  );
}

function Row({
  icon: Icon,
  tone,
  title,
  sub,
  subClass = "text-ink-subtle",
  trailing,
  href,
}: {
  icon: React.ElementType;
  tone: string;
  title: string;
  sub: string;
  subClass?: string;
  trailing?: string;
  href?: string;
}) {
  const inner = (
    <>
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-muted">{title}</p>
        <p className={`truncate text-xs ${subClass}`}>{sub}</p>
      </div>
      {trailing && (
        <span className="font-display text-lg font-bold text-ink">
          {trailing}
        </span>
      )}
    </>
  );
  const cls = "-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition";
  if (href) {
    return (
      <Link
        href={href}
        className={`${cls} hover:bg-surface-hover dark:hover:bg-white/5`}
      >
        {inner}
      </Link>
    );
  }
  return <div className={cls}>{inner}</div>;
}
