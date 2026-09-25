"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  BookMarked,
  CalendarCheck,
  CalendarClock,
  ChevronRight,
  Database,
  DatabaseBackup,
  Download,
  FileCheck,
  HardDrive,
  LayoutDashboard,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  Spinner,
  StatCard,
  useToast,
  type Tone,
} from "@/design-system";
import DonutChart from "@/components/charts/DonutChart";
import AreaTrend from "@/components/charts/AreaTrend";
import { WidgetGrid } from "@/layout-engine";
import { useAuth } from "@/context/AuthContext";
import { memberError } from "@/lib/member-api";
import { apiMyPermissions } from "@/lib/permissions-api";
import {
  apiDashboardExportCsv,
  apiDashboardOverview,
  type DashboardOverview,
} from "@/lib/dashboard-api";

/**
 * The admin home.
 *
 * Every number on it is a query the server ran when the page asked, and every
 * list is the newest rows of a real collection. The screen used to paint a
 * seeded singleton (24.6 GB of 100, 18 sessions, a backup in May 2024), four
 * "+12.5%" deltas that never moved, a "Last 7 Days" menu that changed nothing,
 * and a greeting to "Admin". None of that is here now: what cannot be
 * measured is not shown, and what is waiting for a person is counted with
 * the same query the screen that handles it runs.
 */

// Lucide icon components keyed by the icon name the backend sends per card.
const STAT_ICONS: Record<string, React.ElementType> = {
  Users,
  CalendarCheck,
  ShoppingBag,
  BookMarked,
};

const ATTENTION_ICONS: Record<string, React.ElementType> = {
  ShieldCheck,
  FileCheck,
  ShieldAlert,
  CalendarClock,
};

const ATTENTION_TILE: Record<string, string> = {
  amber: "bg-status-warn-bg text-status-warn-ink",
  rose: "bg-status-danger-bg text-status-danger-ink",
  sky: "bg-status-info-bg text-status-info-ink",
  emerald: "bg-status-ok-bg text-status-ok-ink",
};

// A member's directory status, as the directory itself colours it.
const MEMBER_STATUS_TONE: Record<string, Tone> = {
  Active: "emerald",
  Pending: "amber",
  Inactive: "slate",
  Rejected: "rose",
};

const APPT_STATUS_TONE: Record<string, Tone> = {
  Completed: "emerald",
  Scheduled: "sky",
  Cancelled: "rose",
};

/** Where a quick action goes. Every target is a screen under app/dashboard. */
const QUICK_ACTIONS: {
  label: string;
  href: string;
  icon: React.ElementType;
  superOnly?: boolean;
}[] = [
  { label: "Review applications", href: "/dashboard/users/verification", icon: ShieldCheck },
  { label: "Safety reports", href: "/dashboard/safety/reports", icon: ShieldAlert },
  { label: "Appointments", href: "/dashboard/appointments", icon: CalendarCheck },
  { label: "Members", href: "/dashboard/users", icon: Users },
  { label: "Activity log", href: "/dashboard/settings/activity", icon: Activity },
  { label: "Back up now", href: "/dashboard/settings/backup", icon: DatabaseBackup },
  { label: "Invite staff", href: "/dashboard/staff", icon: UserPlus, superOnly: true },
];

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

/** A compact empty state that fits inside a fixed-height card. */
function Empty({
  icon: Icon,
  title,
  hint,
}: {
  icon: React.ElementType;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex h-full min-h-[6rem] flex-col items-center justify-center px-4 py-6 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-inset text-ink-subtle">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-2 text-sm font-semibold text-ink">{title}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  // Whether this account may download the snapshot. Super Admin holds every
  // permission; anyone else is asked, so the button is not offered to someone
  // the server would refuse.
  const [canExport, setCanExport] = useState(user?.role === "Super Admin");

  const isSuper = user?.role === "Super Admin";
  const firstName = user?.full_name?.trim().split(/\s+/)[0] ?? "";

  // One call hydrates the whole screen. The first load below and the Refresh
  // button share it; only the button shows its own spinner.
  const load = useCallback(async () => {
    try {
      const data = await apiDashboardOverview();
      setOverview(data);
      setError("");
      return true;
    } catch (e) {
      const msg = memberError(e);
      setError(msg);
      toast.error("Could not load the dashboard", { description: msg });
      return false;
    }
  }, [toast]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      await load();
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    if (isSuper) return;
    let alive = true;
    apiMyPermissions()
      .then((p) => {
        if (alive) setCanExport(p.permissions.includes("dashboard.export"));
      })
      .catch(() => {
        /* leave the button hidden; the server would refuse anyway */
      });
    return () => {
      alive = false;
    };
  }, [isSuper]);

  const exportCsv = useCallback(async () => {
    setExporting(true);
    try {
      const blob = await apiDashboardExportCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `womsakhi-dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Snapshot downloaded", {
        description: "Every figure and list on this screen, as of now.",
      });
    } catch (e) {
      toast.error("Could not export", { description: memberError(e) });
    } finally {
      setExporting(false);
    }
  }, [toast]);

  const updatedAt = overview
    ? new Date(overview.generated_at).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <LayoutDashboard className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
              Welcome back{firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="mt-1 text-sm text-ink-subtle">
              What is happening on the platform right now
              {updatedAt ? ` · updated ${updatedAt}` : ""}.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-outline"
            onClick={() => void refresh()}
            disabled={refreshing || loading}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          {canExport && (
            <button
              className="btn btn-primary"
              onClick={() => void exportCsv()}
              disabled={exporting || !overview}
            >
              <Download className="h-4 w-4" />
              {exporting ? "Preparing…" : "Download CSV"}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner />
        </div>
      ) : !overview ? (
        <Card>
          <EmptyState
            icon={LayoutDashboard}
            title="Could not load the dashboard"
            description={error || "The server did not answer."}
            action={
              <button className="btn btn-primary" onClick={() => void refresh()}>
                <RefreshCw className="h-4 w-4" /> Try again
              </button>
            }
          />
        </Card>
      ) : (
        <>
          {/* stat cards — a delta appears only when something arrived */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {overview.stats.map((s) => (
              <StatCard
                key={s.key}
                label={s.label}
                value={s.value}
                icon={STAT_ICONS[s.icon] ?? Users}
                tone={s.tone}
                delta={s.delta || undefined}
                deltaDir={s.delta_dir}
                deltaNote={s.delta_note}
                href={s.href}
              />
            ))}
          </div>

          {/* what is waiting for a person */}
          <div>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-semibold text-ink">
                  Needs attention
                </h2>
                <p className="text-xs text-ink-subtle">
                  Each count is the same query the screen it opens runs.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {overview.attention.map((a) => {
                const Icon = ATTENTION_ICONS[a.icon] ?? ShieldCheck;
                return (
                  <Link
                    key={a.key}
                    href={a.href}
                    className="wc-card flex items-center gap-4 p-4 transition-transform duration-200 hover:-translate-y-0.5"
                  >
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${ATTENTION_TILE[a.tone] ?? ATTENTION_TILE.sky}`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xsm font-medium text-ink-subtle">
                        {a.label}
                      </p>
                      <p className="font-display text-2xl font-bold text-ink">
                        {a.value.toLocaleString("en-IN")}
                      </p>
                      <p className="truncate text-2xs text-ink-subtle">
                        {a.value === 0 ? "Nothing waiting" : a.note}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-subtle" />
                  </Link>
                );
              })}
            </div>
          </div>

          {/* quick actions — every one opens a screen that exists */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              Go to
            </span>
            {QUICK_ACTIONS.filter((q) => !q.superOnly || isSuper).map((q) => {
              const Icon = q.icon;
              return (
                <Link key={q.label} href={q.href} className="btn btn-sm btn-outline">
                  <Icon className="h-3.5 w-3.5" />
                  {q.label}
                </Link>
              );
            })}
          </div>

          {/* The dashboard is hers to arrange: reorder these cards, make them
              wider or narrower, hide the ones she never reads. Spans below are
              the original three-column layout, so nothing moves until she
              moves it. A card added later is appended to a saved layout. */}
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
                      <div>
                        <Link
                          href="/dashboard/appointments"
                          className="font-display text-base font-semibold text-ink transition hover:text-brand-ink"
                        >
                          Appointments Overview
                        </Link>
                        <p className="text-xs text-ink-subtle">
                          Every appointment, by the date on its card
                        </p>
                      </div>
                      <ViewAll href="/dashboard/appointments" />
                    </div>
                    {/* `fill` + `flex-1 min-h-0`: the chart takes whatever
                        height is left after the header and the tiles. Drag the
                        card shorter and the chart shrinks — it does not overflow
                        onto the cards below. */}
                    <div className="min-h-[6rem] flex-1">
                      {overview.appointment_trend.series.length === 0 ? (
                        <Empty
                          icon={CalendarCheck}
                          title="No appointments yet"
                          hint="The first booking will draw the first point."
                        />
                      ) : (
                        <AreaTrend
                          data={overview.appointment_trend.series}
                          color="var(--color-violet-500)"
                          height={230}
                          fill
                          chartLabel="Appointments by date"
                        />
                      )}
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
                          <p className="text-2xs text-ink-subtle">{s.label}</p>
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
                        Members by Role
                      </Link>
                      <ViewAll href="/dashboard/users/roles" />
                    </div>
                    {/* The chart owns its whole representation — ring plus
                        legend, then ring alone, then a proportion strip, then a
                        headline number. It measures its own box, so it is the
                        only thing that can know when the legend stops fitting. */}
                    <div className="min-h-0 flex-1">
                      {overview.users_by_role.segments.length === 0 ? (
                        <Empty
                          icon={Users}
                          title="No members yet"
                          hint="Roles appear as women join."
                        />
                      ) : (
                        <DonutChart
                          data={overview.users_by_role.segments}
                          centerValue={overview.users_by_role.center_value}
                          centerLabel={overview.users_by_role.center_label}
                          legend
                        />
                      )}
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
                        Newest Members
                      </h2>
                      <ViewAll href="/dashboard/users" />
                    </div>
                    {overview.recent_users.length === 0 ? (
                      <Empty
                        icon={Users}
                        title="No members yet"
                        hint="The newest sign-ups will be listed here."
                      />
                    ) : (
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
                                {u.status && (
                                  <span className="mt-0.5 inline-block">
                                    <Badge tone={MEMBER_STATUS_TONE[u.status] ?? "slate"}>
                                      {u.status}
                                    </Badge>
                                  </span>
                                )}
                              </div>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
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
                    {overview.recent_appointments.length === 0 ? (
                      <Empty
                        icon={CalendarCheck}
                        title="No appointments yet"
                        hint="New bookings will be listed here."
                      />
                    ) : (
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
                                <p className="text-2xs text-ink-subtle">{a.time}</p>
                              </div>
                              <span className="ml-1 shrink-0">
                                <Badge tone={APPT_STATUS_TONE[a.status] ?? "slate"}>
                                  {a.status}
                                </Badge>
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
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
                      <Row
                        href="/dashboard/settings"
                        icon={Database}
                        tone={
                          overview.system_overview.database_ok
                            ? "bg-status-ok-bg text-status-ok-ink"
                            : "bg-status-danger-bg text-status-danger-ink"
                        }
                        title="Database"
                        sub={overview.system_overview.status_label}
                        subClass={
                          overview.system_overview.database_ok
                            ? "text-status-ok-ink"
                            : "text-status-danger-ink"
                        }
                      />
                      <Row
                        href="/dashboard/settings/backup"
                        icon={HardDrive}
                        tone="bg-violet-tint text-violet-ink"
                        title="Data stored"
                        sub={overview.system_overview.storage_label}
                      />
                      <Row
                        href="/dashboard/staff"
                        icon={UserCog}
                        tone="bg-brand-100 text-brand-ink"
                        title="Staff signed in"
                        sub="In the last 24 hours"
                        trailing={String(overview.system_overview.staff_signed_in_24h)}
                      />
                      <Row
                        href="/dashboard/settings/backup"
                        icon={DatabaseBackup}
                        tone={
                          overview.system_overview.last_backup_label
                            ? "bg-status-info-bg text-status-info-ink"
                            : "bg-status-warn-bg text-status-warn-ink"
                        }
                        title="Last backup"
                        sub={
                          overview.system_overview.last_backup_label
                            ? `${overview.system_overview.last_backup_label}${
                                overview.system_overview.last_backup_type
                                  ? ` · ${overview.system_overview.last_backup_type}`
                                  : ""
                              }`
                            : "No backups yet — take one"
                        }
                      />
                    </div>
                  </Card>
                ),
              },
              {
                id: "recent-activity",
                title: "Recent Activity",
                span: 3,
                hidden: false,
                render: () => (
                  <Card className="flex h-full flex-col">
                    <div className="mb-4 flex shrink-0 items-center justify-between">
                      <div>
                        <h2 className="font-display text-base font-semibold text-ink">
                          Recent Activity
                        </h2>
                        <p className="text-xs text-ink-subtle">
                          The newest staff actions, as the audit trail recorded them
                        </p>
                      </div>
                      <ViewAll href="/dashboard/settings/activity" />
                    </div>
                    {overview.recent_activity.length === 0 ? (
                      <Empty
                        icon={Activity}
                        title="No staff actions recorded yet"
                        hint="Every approval, edit and export lands here as it happens."
                      />
                    ) : (
                      <ul className="wc-scroll-fade min-h-0 flex-1 divide-y divide-line overflow-y-auto">
                        {overview.recent_activity.map((e) => (
                          <li key={e.id}>
                            <Link
                              href="/dashboard/settings/activity"
                              className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-surface-hover dark:hover:bg-white/5"
                            >
                              <Avatar name={e.user_name || "?"} size="sm" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm text-ink">
                                  <span className="font-semibold">{e.user_name || "Someone"}</span>
                                  {e.detail && (
                                    <span className="text-ink-muted"> · {e.detail}</span>
                                  )}
                                </p>
                                <p className="truncate text-xs text-ink-subtle">{e.when}</p>
                              </div>
                              <span className="hidden shrink-0 sm:inline-block">
                                <Badge tone="slate">{e.action}</Badge>
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
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
        <span className="font-display text-lg font-bold text-ink">{trailing}</span>
      )}
    </>
  );
  const cls = "-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition";
  if (href) {
    return (
      <Link href={href} className={`${cls} hover:bg-surface-hover dark:hover:bg-white/5`}>
        {inner}
      </Link>
    );
  }
  return <div className={cls}>{inner}</div>;
}
