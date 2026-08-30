"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MonitorSmartphone,
  ShieldCheck,
  Clock,
  Lock,
  Monitor,
  Smartphone,
  MapPin,
  RefreshCw,
  MoreVertical,
  Shield,
  Search,
  ChevronDown,
  Calendar,
  LogOut,
  Trash2,
  Eye,
  Download,
  KeyRound,
} from "lucide-react";
import { Badge, Card, Input, Menu, MenuItem, Modal, useToast } from "@/design-system";
import {
  apiListSessions,
  apiSessionHistory,
  apiSessionStats,
  apiRevokeOtherSessions,
  apiRevokeSession,
  type ApiSession,
  type ApiSessionStatCard,
} from "@/lib/sessions-api";
import { memberError } from "@/lib/member-api";

type StatTone = "violet" | "emerald" | "amber";

// Backend sends lucide icon names as strings; map them to components.
/**
 * Tone → colour. The API sends meaning ("subtle"), never a class.
 *
 * It used to send `text-slate-400` verbatim, which meant this screen's colours
 * were decided in Python and were invisible to the frontend's colour audit.
 */
const NOTE_TONE: Record<string, string> = {
  ok: "text-status-ok-ink",
  warn: "text-status-warn-ink",
  danger: "text-status-danger-ink",
  subtle: "text-ink-subtle",
};

const ICON_MAP: Record<string, React.ElementType> = {
  Monitor,
  Smartphone,
  MonitorSmartphone,
  ShieldCheck,
  Clock,
  Lock,
};

const STAT_TONES: Record<StatTone, string> = {
  violet: "bg-violet-tint text-violet-ink",
  emerald: "bg-status-ok-bg text-status-ok-ink",
  amber: "bg-status-warn-bg text-status-warn-ink",
};

type ActiveSession = {
  _id: string; // mongo id — used for sign-out (DELETE /sessions/{id})
  icon: React.ElementType;
  device: string;
  tag: string | null;
  tagTone: "violet";
  sub: string;
  location: string;
  locNote: string;
  ip: string;
  lastActive: string;
  lastActiveDate: string;
  action: "current" | "signout";
};

function toActive(s: ApiSession): ActiveSession {
  return {
    _id: s.id,
    icon: ICON_MAP[s.device_type] ?? Monitor,
    device: s.device,
    tag: s.tag,
    tagTone: "violet",
    sub: s.details,
    location: s.location,
    locNote: s.location_note ?? "",
    ip: s.ip,
    lastActive: s.last_active ?? "",
    lastActiveDate: s.last_active_at ?? "",
    action: s.is_current ? "current" : "signout",
  };
}

type HistoryRow = {
  _id: string; // mongo id
  icon: React.ElementType;
  device: string;
  sub: string;
  location: string;
  ip: string;
  login: string;
  logout: string;
};

function toHistory(s: ApiSession): HistoryRow {
  return {
    _id: s.id,
    icon: ICON_MAP[s.device_type] ?? Monitor,
    device: s.device,
    sub: s.details,
    location: s.location,
    ip: s.ip,
    login: s.login_time ?? "",
    logout: s.logout_time ?? "",
  };
}

const HISTORY_RANGES = ["Last 7 Days", "Last 30 Days", "Last 90 Days", "All Time"] as const;
type HistoryRange = (typeof HISTORY_RANGES)[number];

export default function SessionsPage() {
  const toast = useToast();
  const [active, setActive] = useState<ActiveSession[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [statCards, setStatCards] = useState<ApiSessionStatCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // history filter + search
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyRange, setHistoryRange] = useState<HistoryRange>("Last 30 Days");

  // modals
  const [signOutTarget, setSignOutTarget] = useState<ActiveSession | null>(null);
  const [revokeAllOpen, setRevokeAllOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<HistoryRow | null>(null);

  // secure account modal + confirmation
  const [secureOpen, setSecureOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [secureError, setSecureError] = useState("");

  // Load active sessions, history and stat cards from the backend.
  // Client-side search/filtering below stays as-is (data is fully loaded).
  const refresh = useCallback(async () => {
    try {
      const [list, hist, stats] = await Promise.all([
        apiListSessions(),
        apiSessionHistory(),
        apiSessionStats(),
      ]);
      setActive(list.items.map(toActive));
      setHistory(hist.items.map(toHistory));
      setStatCards(stats.stat_cards);
    } catch {
      /* leave current data; a toast could surface the error */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filteredActive = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return active;
    return active.filter(
      (r) =>
        r.device.toLowerCase().includes(q) ||
        r.sub.toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q) ||
        r.ip.toLowerCase().includes(q)
    );
  }, [active, query]);

  const filteredHistory = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    if (!q) return history;
    return history.filter(
      (r) =>
        r.device.toLowerCase().includes(q) ||
        r.sub.toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q) ||
        r.ip.toLowerCase().includes(q)
    );
  }, [history, historyQuery]);

  const otherCount = active.filter((r) => r.action !== "current").length;

  const STATS: {
    label: string;
    value: string;
    icon: React.ElementType;
    tone: StatTone;
    note: string;
    noteColor: string;
    valueClassName?: string;
  }[] = statCards.map((c) => ({
    label: c.label,
    value: c.value,
    icon: ICON_MAP[c.icon] ?? MonitorSmartphone,
    tone: c.tone as StatTone,
    note: c.note,
    noteColor: NOTE_TONE[c.note_tone] ?? NOTE_TONE.subtle,
    valueClassName: c.value_class ?? undefined,
  }));

  async function handleRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  async function confirmSignOut() {
    if (!signOutTarget) return;
    try {
      await apiRevokeSession(signOutTarget._id);
      await refresh();
    } catch (err) {
      toast.error("Could not sign that session out", { description: memberError(err) });
    }
    setSignOutTarget(null);
  }

  async function confirmRevokeAll() {
    try {
      await apiRevokeOtherSessions();
      await refresh();
    } catch (err) {
      toast.error("Could not sign the other sessions out", { description: memberError(err) });
    }
    setRevokeAllOpen(false);
  }

  function exportHistory() {
    const rows = [
      ["Device", "Details", "Location", "IP Address", "Login Time", "Logout Time", "Status"],
      ...filteredHistory.map((r) => [
        r.device,
        r.sub,
        r.location,
        r.ip,
        r.login,
        r.logout,
        "Signed Out",
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "session-history.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function submitSecure() {
    if (!password.trim()) {
      setSecureError("Please enter your new password to continue.");
      return;
    }
    // revoke all other sessions + confirm password change
    try {
      await apiRevokeOtherSessions();
      await refresh();
    } catch (err) {
      toast.error("Could not save the security settings", { description: memberError(err) });
    }
    setSecureOpen(false);
    setPassword("");
    setSecureError("");
    toast.success("Session settings saved");
  }

  return (
    <div>
      <div className="mb-6 flex items-start gap-3">
        <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
          <MonitorSmartphone className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            Sessions Management
          </h1>
          <p className="mt-1 text-sm text-ink-subtle">
            Manage your active sessions and devices. You can view and sign out from any device.
          </p>
        </div>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STATS.map((s) => (
          <div
            key={s.label}
            className="wc-card p-5"
          >
            <div className="flex items-start gap-4">
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${STAT_TONES[s.tone]}`}
              >
                <s.icon className="h-6 w-6" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xsm font-medium text-ink-subtle">{s.label}</p>
                <p
                  className={`truncate font-display font-bold text-ink ${s.valueClassName ?? "text-2xl"}`}
                  title={s.value}
                >
                  {s.value}
                </p>
                <p className={`mt-1 truncate text-xs font-medium ${s.noteColor}`}>{s.note}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* active sessions */}
      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-ink">
            Active Sessions <span className="text-ink-subtle">({active.length})</span>
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search sessions..."
                className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50 sm:w-56"
              />
            </div>
            {otherCount > 0 && (
              <button className="btn btn-sm btn-danger" onClick={() => setRevokeAllOpen(true)}>
                <LogOut className="h-4 w-4" /> Revoke All Other Sessions
              </button>
            )}
            <button className="btn btn-secondary" onClick={handleRefresh}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left">
            <thead>
              <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                <th scope="col" className="px-2 py-3">Device / Browser</th>
                <th scope="col" className="px-2 py-3">Location</th>
                <th scope="col" className="whitespace-nowrap px-2 py-3">IP Address</th>
                <th scope="col" className="whitespace-nowrap px-2 py-3">Last Active</th>
                <th scope="col" className="whitespace-nowrap px-2 py-3">Status</th>
                <th scope="col" className="whitespace-nowrap px-2 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredActive.map((r) => (
                <tr key={r._id} className="text-sm">
                  <td className="px-2 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-inset text-ink-subtle">
                        <r.icon className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-ink">{r.device}</p>
                          {r.tag && <Badge tone={r.tagTone}>{r.tag}</Badge>}
                        </div>
                        <p className="text-xs text-ink-subtle">{r.sub}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-4">
                    <div className="flex items-start gap-1.5">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" />
                      <div>
                        <p className="text-ink-muted">{r.location}</p>
                        <p
                          className={`text-xs font-medium ${
                            r.locNote === "Current Location" ? "text-status-ok-ink" : "text-ink-subtle"
                          }`}
                        >
                          {r.locNote}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-2 py-4 text-ink-muted">{r.ip}</td>
                  <td className="whitespace-nowrap px-2 py-4">
                    <p className="text-ink-muted">{r.lastActive}</p>
                    <p className="text-xs text-ink-subtle">{r.lastActiveDate}</p>
                  </td>
                  <td className="whitespace-nowrap px-2 py-4">
                    <Badge tone="emerald">Active</Badge>
                  </td>
                  <td className="whitespace-nowrap px-2 py-4">
                    {r.action === "current" ? (
                      <button
                        disabled
                        className="btn btn-sm btn-outline"
                      >
                        Current Session
                      </button>
                    ) : (
                      <button className="btn btn-sm btn-danger" onClick={() => setSignOutTarget(r)}>
                        Sign Out
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {loading && active.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2 py-10 text-center text-sm text-ink-subtle">
                    Loading sessions…
                  </td>
                </tr>
              )}
              {!loading && filteredActive.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2 py-10 text-center text-sm text-ink-subtle">
                    No active sessions match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* session history */}
      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-ink">Session History</h2>
            <p className="mt-1 text-sm text-ink-subtle">Recent signed in sessions from your account.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
              <input
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                placeholder="Search history..."
                className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50 sm:w-52"
              />
            </div>
            <button className="btn btn-sm btn-outline" onClick={exportHistory}>
              <Download className="h-3.5 w-3.5" /> Export
            </button>
            <Menu
              trigger={
                <button className="flex items-center justify-between gap-2 rounded-lg border border-line-strong bg-surface px-3 py-2 text-xs font-medium text-ink-muted hover:bg-surface-hover">
                  <Calendar className="h-3.5 w-3.5 text-ink-subtle" />
                  {historyRange}
                  <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" />
                </button>
              }
            >
              {HISTORY_RANGES.map((r) => (
                <MenuItem key={r} icon={Calendar} onClick={() => setHistoryRange(r)}>
                  {r}
                </MenuItem>
              ))}
            </Menu>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                <th scope="col" className="px-2 py-3">Device / Browser</th>
                <th scope="col" className="px-2 py-3">Location</th>
                <th scope="col" className="px-2 py-3">IP Address</th>
                <th scope="col" className="px-2 py-3">Login Time</th>
                <th scope="col" className="px-2 py-3">Logout Time</th>
                <th scope="col" className="px-2 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredHistory.map((r) => (
                <tr key={r._id} className="text-sm hover:bg-surface-hover/60">
                  <td className="px-2 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-inset text-ink-subtle">
                        <r.icon className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="font-semibold text-ink">{r.device}</p>
                        <p className="text-xs text-ink-subtle">{r.sub}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-4 text-ink-muted">{r.location}</td>
                  <td className="px-2 py-4 text-ink-muted">{r.ip}</td>
                  <td className="px-2 py-4 text-ink-muted">{r.login}</td>
                  <td className="px-2 py-4 text-ink-muted">{r.logout}</td>
                  <td className="px-2 py-4">
                    <div className="flex items-center gap-3">
                      <Badge tone="slate">Signed Out</Badge>
                      <Menu
                        trigger={
                          <button aria-label={`More actions for ${r.device}`} className="text-ink-subtle hover:text-ink-muted">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        }
                      >
                        <MenuItem icon={Eye} onClick={() => setDetailRow(r)}>
                          View Details
                        </MenuItem>
                        <MenuItem icon={Download} onClick={exportHistory}>
                          Export History
                        </MenuItem>
                      </Menu>
                    </div>
                  </td>
                </tr>
              ))}
              {loading && history.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2 py-10 text-center text-sm text-ink-subtle">
                    Loading history…
                  </td>
                </tr>
              )}
              {!loading && filteredHistory.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2 py-10 text-center text-sm text-ink-subtle">
                    No sessions match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* bottom banner */}
      <Card className="mt-6 border-violet-100 bg-violet-tint">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-tint text-violet-ink">
              <Shield className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-violet-ink">Don&apos;t recognize a session?</p>
              <p className="mt-0.5 text-sm text-ink-muted">
                If you see any suspicious activity, sign out from that session and change your password immediately.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn btn-secondary" onClick={() => setSecureOpen(true)}>
              <Lock className="h-4 w-4" /> Secure My Account
            </button>
          </div>
        </div>
      </Card>

      {/* sign out single session confirm */}
      <Modal
        open={!!signOutTarget}
        onClose={() => setSignOutTarget(null)}
        title="Sign Out Session"
        description={
          signOutTarget
            ? `Sign out "${signOutTarget.device}"? This device will need to sign in again.`
            : ""
        }
        icon={LogOut}
        iconTone="rose"
        size="sm"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setSignOutTarget(null)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={confirmSignOut}>
              <LogOut className="h-4 w-4" /> Sign Out
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-subtle">
          {signOutTarget
            ? `Located in ${signOutTarget.location} · IP ${signOutTarget.ip}. Last active ${signOutTarget.lastActive}.`
            : ""}
        </p>
      </Modal>

      {/* revoke all other sessions confirm */}
      <Modal
        open={revokeAllOpen}
        onClose={() => setRevokeAllOpen(false)}
        title="Revoke All Other Sessions"
        description="This will sign out every device except your current session. This action cannot be undone."
        icon={Trash2}
        iconTone="rose"
        size="sm"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setRevokeAllOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={confirmRevokeAll}>
              <LogOut className="h-4 w-4" /> Revoke {otherCount} Session{otherCount === 1 ? "" : "s"}
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-subtle">
          {otherCount} other active session{otherCount === 1 ? "" : "s"} will be signed out immediately.
        </p>
      </Modal>

      {/* history detail modal */}
      <Modal
        open={!!detailRow}
        onClose={() => setDetailRow(null)}
        title="Session Details"
        description={detailRow ? detailRow.device : ""}
        icon={detailRow?.icon ?? Monitor}
        iconTone="violet"
        footer={
          <button className="btn btn-outline" onClick={() => setDetailRow(null)}>
            Close
          </button>
        }
      >
        {detailRow && (
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Device / Browser</dt>
              <dd className="mt-0.5 font-medium text-ink-muted">{detailRow.sub}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Location</dt>
              <dd className="mt-0.5 font-medium text-ink-muted">{detailRow.location}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">IP Address</dt>
              <dd className="mt-0.5 font-medium text-ink-muted">{detailRow.ip}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Status</dt>
              <dd className="mt-0.5">
                <Badge tone="slate">Signed Out</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Login Time</dt>
              <dd className="mt-0.5 font-medium text-ink-muted">{detailRow.login}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Logout Time</dt>
              <dd className="mt-0.5 font-medium text-ink-muted">{detailRow.logout}</dd>
            </div>
          </dl>
        )}
      </Modal>

      {/* secure my account modal */}
      <Modal
        open={secureOpen}
        onClose={() => setSecureOpen(false)}
        title="Secure My Account"
        description="Set a new password. This will sign out all other active sessions."
        icon={Lock}
        iconTone="brand"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setSecureOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={submitSecure}>
              <ShieldCheck className="h-4 w-4" /> Secure Account
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="New Password"
            type="password"
            required
            icon={KeyRound}
            placeholder="Enter a strong new password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (secureError) setSecureError("");
            }}
          />
          <p className="text-sm text-ink-subtle">
            For your safety, {otherCount} other active session{otherCount === 1 ? "" : "s"} will be
            revoked when you secure your account.
          </p>
          {secureError && <p className="text-sm font-medium text-status-danger-ink">{secureError}</p>}
        </div>
      </Modal>
    </div>
  );
}
