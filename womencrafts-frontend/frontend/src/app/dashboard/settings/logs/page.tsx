"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ScrollText,
  CircleAlert,
  TriangleAlert,
  Info,
  Download,
  Calendar,
  Search,
  ChevronDown,
  Check,
} from "lucide-react";
import { Badge, Card, Menu, MenuItem, Modal, StatCard } from "@/design-system";
import { ResizableColumns } from "@/layout-engine";
import DonutChart from "@/components/charts/DonutChart";
import {
  apiListSystemLogs,
  apiSystemLogStats,
  apiSystemLogSources,
  apiGetSystemLog,
  type ApiSystemLog,
  type SystemLogStats,
} from "@/lib/system-logs-api";

const LEVEL_TONE = {
  Error: "rose",
  Warning: "amber",
  Info: "sky",
  Success: "emerald",
} as const;

type Level = keyof typeof LEVEL_TONE;

type LogEntry = {
  _id: string; // mongo id — used for the detail modal fetch
  time: string;
  level: Level;
  source: string;
  message: string;
  user: string;
  ip: string;
};

function toLogEntry(l: ApiSystemLog): LogEntry {
  return {
    _id: l.id,
    time: l.time,
    level: (l.level as Level) || "Info",
    source: l.source,
    message: l.message,
    user: l.user,
    ip: l.ip,
  };
}

// Icon name from the backend stat cards → lucide component.
const STAT_ICONS: Record<string, React.ElementType> = {
  ScrollText,
  CircleAlert,
  TriangleAlert,
  Info,
};

type StatTone = "violet" | "brand" | "emerald" | "amber" | "sky" | "rose";

const LEVEL_OPTIONS: (Level | "All Levels")[] = ["All Levels", "Info", "Success", "Warning", "Error"];
const RANGE_OPTIONS = ["Last 7 Days", "Last 24 Hours", "Last 30 Days", "All Time"] as const;

export default function SystemLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<SystemLogStats | null>(null);
  const [sources, setSources] = useState<string[]>(["All Sources"]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<(typeof LEVEL_OPTIONS)[number]>("All Levels");
  const [sourceFilter, setSourceFilter] = useState<string>("All Sources");
  const [range, setRange] = useState<(typeof RANGE_OPTIONS)[number]>("Last 7 Days");
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  useEffect(() => {
    /*
      Loaded here rather than through a `refresh` useCallback, which is what
      this was. Nothing called it but this effect — there is no Refresh button
      on the page — so it was an indirection that bought nothing and cost two
      things: a reply arriving after the page is closed set state on a
      component that no longer exists, and the lint rule could not see through
      an async useCallback to prove every setState happens after an await.
    */
    let alive = true;
    (async () => {
      try {
        const [list, s, src] = await Promise.all([
          apiListSystemLogs({ page_size: 100 }),
          apiSystemLogStats(),
          apiSystemLogSources(),
        ]);
        if (!alive) return;
        setLogs(list.items.map(toLogEntry));
        setStats(s);
        setSources(src);
      } catch {
        /* leave current state; a toast could surface the error */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((l) => {
      if (levelFilter !== "All Levels" && l.level !== levelFilter) return false;
      if (sourceFilter !== "All Sources" && l.source !== sourceFilter) return false;
      if (!q) return true;
      return (
        l.message.toLowerCase().includes(q) ||
        l.source.toLowerCase().includes(q) ||
        l.user.toLowerCase().includes(q) ||
        l.ip.toLowerCase().includes(q) ||
        l.level.toLowerCase().includes(q) ||
        l.time.toLowerCase().includes(q)
      );
    });
  }, [logs, query, levelFilter, sourceFilter]);

  // Live figures for the stat cards, level donut and recent-errors list.
  const statCards = stats?.stat_cards ?? [];
  const levelDonut = stats?.level_distribution ?? [];
  const levelTotal = stats?.level_total ?? "0";
  const recentErrors = stats?.recent_errors ?? [];

  // Open the detail modal — show the list row immediately, then hydrate from the
  // single-log endpoint (GET /system-logs/{id}).
  async function openLog(entry: LogEntry) {
    setSelectedLog(entry);
    try {
      const full = await apiGetSystemLog(entry._id);
      setSelectedLog(toLogEntry(full));
    } catch {
      /* keep the list version if the detail fetch fails */
    }
  }

  function exportCsv() {
    const header = "Timestamp,Level,Source,Message,User,IP";
    const rows = filtered.map(
      (l) => `"${l.time}","${l.level}","${l.source}","${l.message.replace(/"/g, '""')}","${l.user}","${l.ip}"`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "system-logs.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-6 flex items-start gap-3">
        <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
          <ScrollText className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">System Logs</h1>
          <p className="mt-1 text-sm text-ink-subtle">View system activity and audit logs.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((c) => {
          const Icon = STAT_ICONS[c.icon] ?? ScrollText;
          return (
            <StatCard
              key={c.label}
              label={c.label}
              value={c.value}
              icon={Icon}
              tone={c.tone as StatTone}
              deltaNote={c.delta_note}
            />
          );
        })}
      </div>

      <Card className="mt-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search logs..."
              className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
            />
          </div>

          <Menu
            align="left"
            width="min-w-[11rem]"
            trigger={
              <button className="flex items-center justify-between gap-2 rounded-lg border border-line-strong bg-surface px-3 py-2 text-xs font-medium text-ink-muted hover:bg-surface-hover">
                {levelFilter}
                <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" />
              </button>
            }
          >
            {LEVEL_OPTIONS.map((opt) => (
              <MenuItem
                key={opt}
                icon={levelFilter === opt ? Check : undefined}
                onClick={() => {
                  setLevelFilter(opt);
                  setPage(1);
                }}
              >
                {opt}
              </MenuItem>
            ))}
          </Menu>

          <Menu
            align="left"
            width="min-w-[12rem]"
            trigger={
              <button className="flex items-center justify-between gap-2 rounded-lg border border-line-strong bg-surface px-3 py-2 text-xs font-medium text-ink-muted hover:bg-surface-hover">
                {sourceFilter}
                <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" />
              </button>
            }
          >
            {sources.map((opt) => (
              <MenuItem
                key={opt}
                icon={sourceFilter === opt ? Check : undefined}
                onClick={() => {
                  setSourceFilter(opt);
                  setPage(1);
                }}
              >
                {opt}
              </MenuItem>
            ))}
          </Menu>

          <Menu
            align="left"
            width="min-w-[11rem]"
            trigger={
              <button className="btn btn-sm btn-outline">
                <Calendar className="h-3.5 w-3.5 text-ink-subtle" /> {range}
              </button>
            }
          >
            {RANGE_OPTIONS.map((opt) => (
              <MenuItem
                key={opt}
                icon={range === opt ? Check : undefined}
                onClick={() => setRange(opt)}
              >
                {opt}
              </MenuItem>
            ))}
          </Menu>

          <button className="btn btn-secondary" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>
      </Card>

      <ResizableColumns id="settings-logs" defaultSize={0.74} className="mt-6 gap-6">
        <Card>
          <h2 className="mb-4 font-display text-base font-semibold text-ink">System Logs</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                  <th scope="col" className="px-2 py-3">Timestamp</th>
                  <th scope="col" className="px-2 py-3">Level</th>
                  <th scope="col" className="px-2 py-3">Source</th>
                  <th scope="col" className="px-2 py-3">Message</th>
                  <th scope="col" className="px-2 py-3">User</th>
                  <th scope="col" className="px-2 py-3">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {loading && logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-2 py-10 text-center text-sm text-ink-subtle">
                      Loading logs…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-2 py-10 text-center text-sm text-ink-subtle">
                      No logs match your filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((l) => (
                    <tr
                      key={l._id}
                      onClick={() => openLog(l)}
                      className="cursor-pointer text-sm hover:bg-surface-hover/60"
                    >
                      <td className="whitespace-nowrap px-2 py-3 font-mono text-xs text-ink-subtle">{l.time}</td>
                      <td className="px-2 py-3"><Badge tone={LEVEL_TONE[l.level]}>{l.level}</Badge></td>
                      <td className="px-2 py-3">
                        <span className="rounded-md bg-surface-inset px-2 py-0.5 font-mono text-xs text-ink-muted">{l.source}</span>
                      </td>
                      <td className="px-2 py-3 text-ink-muted">{l.message}</td>
                      <td className="whitespace-nowrap px-2 py-3 text-ink-muted">{l.user}</td>
                      <td className="whitespace-nowrap px-2 py-3 font-mono text-xs text-ink-subtle">{l.ip}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-ink-subtle">
              Showing {filtered.length === 0 ? 0 : 1} to {filtered.length} of {filtered.length} logs
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-line-strong text-ink-subtle hover:bg-surface-hover"
              >
                ‹
              </button>
              {["1", "2", "3", "…", "10"].map((p, i) =>
                p === "…" ? (
                  <span key={i} className="px-1 text-ink-subtle">
                    …
                  </span>
                ) : (
                  <button
                    key={i}
                    onClick={() => setPage(Number(p))}
                    className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-semibold ${
                      Number(p) === page
                        ? "bg-brand-600 text-white"
                        : "border border-line-strong text-ink-subtle hover:bg-surface-hover"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                onClick={() => setPage((p) => Math.min(10, p + 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-line-strong text-ink-subtle hover:bg-surface-hover"
              >
                ›
              </button>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 font-display text-base font-semibold text-ink">Log Levels</h2>
            <div className="flex flex-col items-center">
              <DonutChart data={levelDonut} centerValue={levelTotal} centerLabel="Total" size={170} thickness={20} />
              <ul className="mt-4 w-full space-y-2">
                {levelDonut.map((d) => (
                  <li key={d.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-ink-muted">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} /> {d.name}
                    </span>
                    <span className="font-semibold text-ink-subtle">{d.value}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 font-display text-base font-semibold text-ink">Recent Errors</h2>
            <ul className="space-y-3">
              {recentErrors.map((e) => (
                <li key={e.message} className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-status-danger-solid" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-muted">{e.message}</p>
                    <p className="text-xs text-ink-subtle">{e.when}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </ResizableColumns>

      {/* Log detail modal */}
      <Modal
        open={selectedLog !== null}
        onClose={() => setSelectedLog(null)}
        title="Log Detail"
        description={selectedLog ? selectedLog.time : undefined}
        icon={ScrollText}
        iconTone={selectedLog ? LEVEL_TONE[selectedLog.level] : "brand"}
        footer={
          <button className="btn btn-primary" onClick={() => setSelectedLog(null)}>
            Close
          </button>
        }
      >
        {selectedLog && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={LEVEL_TONE[selectedLog.level]}>{selectedLog.level}</Badge>
              <span className="rounded-md bg-surface-inset px-2 py-0.5 font-mono text-xs text-ink-muted">
                {selectedLog.source}
              </span>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-semibold text-ink-muted">Message</p>
              <p className="wc-inset rounded-xl px-4 py-3 text-sm text-ink-muted">{selectedLog.message}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Timestamp</p>
                <p className="font-mono text-sm text-ink-muted">{selectedLog.time}</p>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Source</p>
                <p className="text-sm text-ink-muted">{selectedLog.source}</p>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">User</p>
                <p className="text-sm text-ink-muted">{selectedLog.user}</p>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">IP Address</p>
                <p className="font-mono text-sm text-ink-muted">{selectedLog.ip}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
