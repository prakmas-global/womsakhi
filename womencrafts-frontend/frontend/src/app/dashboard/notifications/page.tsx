"use client";

import { useCallback, useEffect, useMemo, useState, type ElementType } from "react";
import Link from "next/link";
import {
  Bell,
  BellDot,
  Clock,
  AtSign,
  AlertTriangle,
  Search,
  ChevronDown,
  SlidersHorizontal,
  CheckCheck,
  Settings as SettingsIcon,
  Trash2,
  Mail,
  Smartphone,
  MessageSquare,
  MonitorSmartphone,
  Check,
  X,
  Inbox,
} from "lucide-react";
import { Card, Menu, MenuItem, StatCard, NoResults, useToast } from "@/design-system";
import DonutChart from "@/components/charts/DonutChart";
import { NOTIF_META, TONE_CHIP, type NotifType } from "@/lib/notifications";
import {
  apiGroupedNotifications,
  apiNotificationStats,
  apiListChannels,
  apiMarkNotificationRead,
  apiMarkAllNotificationsRead,
  apiDismissNotification,
  apiClearAllNotifications,
  apiSetChannel,
  type ApiChannel,
  type NotificationSection,
  type NotificationStats,
} from "@/lib/notifications-api";
import { memberError } from "@/lib/member-api";
import { ResizableColumns } from "@/layout-engine";

const TABS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "appointment", label: "Appointments" },
  { key: "message", label: "Messages" },
  { key: "system", label: "System" },
];

type StatTone = "violet" | "brand" | "emerald" | "amber" | "sky" | "rose";

// Map the string icon/tone names the API returns onto the local lucide icons.
const STAT_ICON: Record<string, ElementType> = {
  Bell,
  BellDot,
  Clock,
  AtSign,
  AlertTriangle,
};
const CHANNEL_ICON: Record<string, ElementType> = {
  Mail,
  MonitorSmartphone,
  Smartphone,
  MessageSquare,
};

// Fall back to the "system" meta for any unrecognised notification type.
const metaFor = (type: string) => NOTIF_META[type as NotifType] ?? NOTIF_META.system;

export default function NotificationsPage() {
  const toast = useToast();
  const [sections, setSections] = useState<NotificationSection[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [channels, setChannels] = useState<ApiChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [rangeFilter, setRangeFilter] = useState("All Time");
  const [unreadOnly, setUnreadOnly] = useState(false);

  // Debounce the search box so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Live feed + stats + channels; re-runs whenever the tab or search changes.
  const refresh = useCallback(async () => {
    try {
      const [grouped, s, ch] = await Promise.all([
        apiGroupedNotifications({ tab, q: debouncedSearch || undefined }),
        apiNotificationStats(),
        apiListChannels(),
      ]);
      setSections(grouped.sections);
      setTotal(grouped.total);
      setStats(s);
      setChannels(ch.items);
    } catch {
      /* leave the current view in place; a toast could surface the error */
    } finally {
      setLoading(false);
    }
  }, [tab, debouncedSearch]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Total unread (all notifications) — drives the header/tab badges & disabled states.
  const unread = useMemo(() => {
    const card = stats?.stat_cards.find((c) => c.key === "unread");
    return card ? Number(card.value) || 0 : 0;
  }, [stats]);

  const statCards = stats?.stat_cards ?? [];
  const categories = stats?.categories ?? [];

  const TYPE_OPTIONS = useMemo(
    () => ["All Types", ...categories.map((c) => c.name ?? String(c))],
    [categories],
  );
  const RANGE_OPTIONS = ["All Time", "Today", "This Week", "This Month"];

  // The feed comes back grouped by day; the filters narrow it here rather than
  // asking the server for a shape it doesn't offer.
  const visibleSections = useMemo(() => {
    const inRange = (group: string) => {
      if (rangeFilter === "All Time") return true;
      const l = (group || "").toLowerCase();
      if (rangeFilter === "Today") return l.includes("today");
      if (rangeFilter === "This Week") return l.includes("today") || l.includes("yesterday") || l.includes("day");
      return true;
    };
    return sections
      .filter((sec) => inRange(sec.group))
      .map((sec) => ({
        ...sec,
        rows: sec.rows.filter((n) => {
          if (typeFilter !== "All Types" && n.type !== typeFilter) return false;
          if (unreadOnly && !n.unread) return false;
          return true;
        }),
      }))
      .filter((sec) => sec.rows.length > 0);
  }, [sections, typeFilter, rangeFilter, unreadOnly]);

  const markAll = async () => {
    try {
      await apiMarkAllNotificationsRead();
      await refresh();
    } catch (err) {
      toast.error("Could not mark them all as read", { description: memberError(err) });
    }
  };
  const markRead = async (id: string) => {
    try {
      await apiMarkNotificationRead(id);
      await refresh();
    } catch (err) {
      toast.error("Could not mark it as read", { description: memberError(err) });
    }
  };
  const remove = async (id: string) => {
    try {
      await apiDismissNotification(id);
      await refresh();
    } catch (err) {
      toast.error("Could not remove the notification", { description: memberError(err) });
    }
  };
  const clearAll = async () => {
    try {
      await apiClearAllNotifications();
      await refresh();
    } catch (err) {
      toast.error("Could not clear your notifications", { description: memberError(err) });
    }
  };
  const toggleChannel = async (label: string, on: boolean) => {
    try {
      await apiSetChannel(label, on);
      await refresh();
    } catch (err) {
      toast.error("Could not update that channel", { description: memberError(err) });
    }
  };

  return (
    <div>
      {/* header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="relative mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <Bell className="h-6 w-6" />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-3xs font-bold text-white">
                {unread}
              </span>
            )}
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
              Notifications
            </h1>
            <p className="mt-1 text-sm text-ink-subtle">
              Stay updated with everything happening across WomSakhi.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={markAll}
            className="btn btn-sm btn-outline"
            disabled={unread === 0}
          >
            <CheckCheck className="h-4 w-4" /> Mark all as read
          </button>
          <Link href="/dashboard/settings/notifications" className="btn btn-primary">
            <SettingsIcon className="h-4 w-4" /> Notification Settings
          </Link>
        </div>
      </div>

      {/* summary stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {statCards.map((c) => (
          <StatCard
            key={c.key}
            label={c.label}
            value={c.value}
            icon={STAT_ICON[c.icon] ?? Bell}
            tone={c.tone as StatTone}
            delta={c.delta ?? undefined}
            deltaNote={c.delta_note ?? undefined}
          />
        ))}
      </div>

      {/* filters */}
      <Card className="mt-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[160px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notifications..."
              className="w-full rounded-lg border border-line-strong py-2 pl-9 pr-3 text-sm outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
            />
          </div>
          <Menu
            align="left"
            trigger={
              <button className="btn btn-sm btn-outline">
                {typeFilter} <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" />
              </button>
            }
          >
            {TYPE_OPTIONS.map((t) => (
              <MenuItem key={t} onClick={() => setTypeFilter(t)}>
                {t}
              </MenuItem>
            ))}
          </Menu>
          <Menu
            align="left"
            trigger={
              <button className="btn btn-sm btn-outline">
                {rangeFilter} <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" />
              </button>
            }
          >
            {RANGE_OPTIONS.map((r) => (
              <MenuItem key={r} onClick={() => setRangeFilter(r)}>
                {r}
              </MenuItem>
            ))}
          </Menu>
          <Menu
            align="left"
            trigger={
              <button className="btn btn-sm btn-outline">
                <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
              </button>
            }
          >
            <MenuItem onClick={() => setUnreadOnly(true)}>Only unread</MenuItem>
            <MenuItem onClick={() => setUnreadOnly(false)}>Show all</MenuItem>
            <MenuItem
              onClick={() => {
                setSearch("");
                setTypeFilter("All Types");
                setRangeFilter("All Time");
                setUnreadOnly(false);
              }}
            >
              Clear all filters
            </MenuItem>
          </Menu>
        </div>
      </Card>

      {/* main grid */}
      <ResizableColumns id="notifications" defaultSize={0.75} className="mt-6 gap-6">
        {/* LEFT — feed */}
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <div className="flex flex-wrap items-center gap-5 text-sm">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`-mb-px flex items-center gap-1.5 border-b-2 pb-3 font-medium ${
                    tab === t.key
                      ? "border-brand-600 text-brand-ink"
                      : "border-transparent text-ink-subtle hover:text-ink-muted"
                  }`}
                >
                  {t.label}
                  {t.key === "unread" && unread > 0 && (
                    <span className="rounded-full bg-brand-100 px-1.5 text-2xs font-bold text-brand-ink">
                      {unread}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={markAll}
              disabled={unread === 0}
              className="text-sm font-semibold text-violet-ink hover:text-violet-ink disabled:cursor-not-allowed disabled:text-ink-faint"
            >
              Mark all read
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-ink-subtle">Loading notifications…</p>
            </div>
          ) : sections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-inset text-ink-subtle">
                <Inbox className="h-7 w-7" />
              </span>
              <p className="mt-4 text-sm font-semibold text-ink-muted">You&apos;re all caught up</p>
              <NoResults icon={Bell} thing="notifications" filtered compact />
            </div>
          ) : (
            <div className="space-y-5">
              {visibleSections.map((section) => (
                <div key={section.group}>
                  <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                    {section.group}
                  </p>
                  <div className="space-y-1.5">
                    {section.rows.map((n) => {
                      const meta = metaFor(n.type);
                      const Icon = meta.icon;
                      return (
                        <div
                          key={n.id}
                          className={`group relative flex gap-3 rounded-xl p-3 transition ${
                            n.unread
                              ? "bg-brand-500/8 dark:bg-brand-500/12"
                              : "hover:bg-surface-hover dark:hover:bg-white/5"
                          }`}
                        >
                          <span
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONE_CHIP[meta.tone]}`}
                          >
                            <Icon className="h-5 w-5" strokeWidth={2} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-ink">
                                {n.title}
                              </p>
                              <span className="shrink-0 whitespace-nowrap text-2xs text-ink-subtle">
                                {n.time}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xsm leading-relaxed text-ink-subtle">
                              {n.desc}
                            </p>
                          </div>
                          {/* actions */}
                          <div className="flex shrink-0 items-center gap-1">
                            {n.unread && (
                              <span className="mr-1 mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                            )}
                            {n.unread && (
                              <button
                                onClick={() => markRead(n.id)}
                                title="Mark as read"
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-subtle opacity-0 transition hover:bg-surface-hover hover:text-status-ok-ink group-hover:opacity-100 dark:hover:bg-white/10"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => remove(n.id)}
                              title="Dismiss"
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-subtle opacity-0 transition hover:bg-surface-hover hover:text-status-danger-ink group-hover:opacity-100 dark:hover:bg-white/10"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* RIGHT rail */}
        <div className="space-y-6">
          {/* by category */}
          <Card>
            <h2 className="mb-4 font-display text-base font-semibold text-ink">
              By Category
            </h2>
            <div className="flex flex-col items-center gap-4">
              <DonutChart
                data={categories}
                centerValue={stats?.category_total ?? String(categories.reduce((s, c) => s + c.value, 0))}
                centerLabel={stats?.center_label ?? "Total"}
                size={160}
                thickness={20}
              />
              <ul className="w-full space-y-2.5">
                {categories.map((c) => (
                  <li key={c.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-ink-muted">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                      {c.name}
                    </span>
                    <span className="font-semibold text-ink-muted">{c.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          {/* preferences */}
          <Card>
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold text-ink">
                Delivery Channels
              </h2>
              <Link
                href="/dashboard/settings/notifications"
                className="text-xs font-semibold text-violet-ink hover:text-violet-ink"
              >
                Manage
              </Link>
            </div>
            <ul className="space-y-2.5">
              {channels.map((c) => {
                const ChannelIcon = CHANNEL_ICON[c.icon] ?? MessageSquare;
                return (
                  <li key={c.label} className="flex items-center justify-between">
                    <span className="flex items-center gap-2.5 text-sm font-medium text-ink-muted">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-inset text-ink-subtle">
                        <ChannelIcon className="h-4 w-4" />
                      </span>
                      {c.label}
                    </span>
                    <button aria-label={c.label} role="switch" aria-checked={c.on}
                      type="button"
                      onClick={() => toggleChannel(c.label, !c.on)}
                      className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${
                        c.on ? "bg-brand-600" : "bg-line"
                      }`}
                    >
                      <span
                        className={`h-4 w-4 rounded-full bg-surface shadow transition-transform ${
                          c.on ? "translate-x-4" : ""
                        }`}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          {/* quick actions */}
          <Card>
            <h2 className="mb-4 font-display text-base font-semibold text-ink">
              Quick Actions
            </h2>
            <div className="space-y-3">
              <button
                onClick={markAll}
                disabled={unread === 0}
                className="btn btn-secondary btn-block disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCheck className="h-4 w-4" /> Mark all as read
              </button>
              <Link href="/dashboard/settings/notifications" className="btn btn-outline btn-block">
                <SettingsIcon className="h-4 w-4" /> Notification Settings
              </Link>
              <button
                onClick={clearAll}
                disabled={total === 0}
                className="btn btn-danger btn-block disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" /> Clear all
              </button>
            </div>
          </Card>
        </div>
      </ResizableColumns>
    </div>
  );
}
