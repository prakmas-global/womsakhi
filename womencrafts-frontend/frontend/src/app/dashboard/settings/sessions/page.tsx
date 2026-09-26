"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Clock, KeyRound, LogOut, MapPin, Monitor, MonitorSmartphone, RefreshCw, ShieldCheck, Smartphone,
} from "lucide-react";
import { Alert, Badge, Card, EmptyState, Spinner, StatCard, useConfirm, useToast } from "@/design-system";
import { useAuth } from "@/context/AuthContext";
import { apiListSessions, apiRevokeSession, type ApiSession } from "@/lib/sessions-api";
import { apiMyAccount, apiSignOutEverywhere, formatWhen, type MyAccount } from "@/lib/staff-api";
import { memberError } from "@/lib/member-api";

/**
 * Sessions — what is actually known about where this account is signed in.
 *
 * ── What this screen used to show ───────────────────────────────────────────
 * Seven seeded rows ("iPhone 14 Pro, Pune, 1 hour ago") that belonged to
 * nobody, shown to whoever was signed in as her own devices, with a
 * "Sign Out" button that deleted the row and nothing else. Sign-in has never
 * recorded a device, so there was never anything real to list.
 *
 * ── What is real ────────────────────────────────────────────────────────────
 * The account's session generation (`token_version`): bumping it ends every
 * session on every device, because each token carries the generation it was
 * minted in and the server refuses anything behind. The time this session's
 * token was minted, when it lapses, the last sign-in, failed attempts, and
 * the addresses the audit trail has seen this account act from. That is what
 * is on the screen, and the absence of a per-device list is said out loud.
 */

const DEVICE_ICON: Record<string, React.ElementType> = { Monitor, Smartphone };

export default function SessionsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const { signOut } = useAuth();

  const [account, setAccount] = useState<MyAccount | null>(null);
  const [recorded, setRecorded] = useState<ApiSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [ending, setEnding] = useState(false);

  const fetchAll = useCallback(async () => {
    const [acc, list] = await Promise.all([apiMyAccount(), apiListSessions()]);
    return { acc, list };
  }, []);

  const load = useCallback(async () => {
    try {
      const { acc, list } = await fetchAll();
      setAccount(acc);
      setRecorded(list.items);
      setError("");
    } catch (e) {
      setError(memberError(e));
    }
  }, [fetchAll]);

  // One wave on mount, the way the reference screen does it: state is set only
  // after the request answers, never synchronously in the effect body.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { acc, list } = await fetchAll();
        if (!alive) return;
        setAccount(acc);
        setRecorded(list.items);
        setError("");
      } catch (e) {
        if (alive) setError(memberError(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [fetchAll]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const endEverywhere = useCallback(async () => {
    const ok = await confirm({
      title: "End every session, including this one?",
      description:
        "Every device signed in to this account is signed out on its next request, and so is this one. You will be taken to the sign-in screen.",
      confirmLabel: "Sign out everywhere",
      danger: true,
    });
    if (!ok) return;
    setEnding(true);
    try {
      await apiSignOutEverywhere();
      toast.success("Every session was ended", { description: "Sign in again to carry on." });
      await signOut();
    } catch (e) {
      toast.error("Could not end the sessions", { description: memberError(e) });
      setEnding(false);
    }
  }, [confirm, signOut, toast]);

  const forgetDevice = useCallback(async (s: ApiSession) => {
    const ok = await confirm({
      title: `Remove the record for ${s.device}?`,
      description:
        "This removes the record only. A token that device already holds keeps working until it expires — use Sign out everywhere to end it.",
      confirmLabel: "Remove record",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiRevokeSession(s.id);
      toast.success("Record removed");
      await load();
    } catch (e) {
      toast.error("Could not remove that record", { description: memberError(e) });
    }
  }, [confirm, load, toast]);

  const ts = account?.this_session;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <MonitorSmartphone className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Sessions</h1>
            <p className="mt-1 text-sm text-ink-subtle">
              Where this account is signed in, as far as the server knows, and the one control that ends all of it.
            </p>
          </div>
        </div>
        <button className="btn btn-secondary" onClick={() => void refresh()} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {error && <Alert variant="danger" className="mb-4">{error}</Alert>}

      {loading ? (
        <div className="flex items-center justify-center py-16"><Spinner /></div>
      ) : account && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="This session started" icon={Clock} tone="violet" valueClassName="text-lg"
                      value={formatWhen(ts?.started_at ?? "") || "Unknown"}
                      deltaNote={ts?.expires_at ? `Lapses ${formatWhen(ts.expires_at)} if idle` : "Renews while you use the app"} />
            <StatCard label="Last signed in" icon={KeyRound} tone="amber" valueClassName="text-lg"
                      value={formatWhen(account.last_login_at) || "Not recorded"}
                      deltaNote="Your most recent successful sign-in" />
            <StatCard label="Sessions ended everywhere" icon={ShieldCheck} tone="emerald"
                      value={String(account.token_version)}
                      deltaNote={account.sessions_ended_at ? `Last on ${formatWhen(account.sessions_ended_at)}` : "Never, on this account"} />
            <StatCard label="Failed sign-in attempts" icon={LogOut} tone={account.failed_logins > 0 ? "rose" : "slate"}
                      value={String(account.failed_logins)}
                      deltaNote="Since your last successful sign-in" />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-6">
              {/* recorded devices */}
              <Card>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-base font-semibold text-ink">
                      Recorded devices <span className="text-ink-subtle">({recorded.length})</span>
                    </h2>
                    <p className="mt-1 text-xs text-ink-subtle">
                      Devices with a session record on this account.
                    </p>
                  </div>
                </div>
                {recorded.length === 0 ? (
                  <EmptyState
                    icon={MonitorSmartphone}
                    title="No devices are recorded"
                    description={account.devices_note}
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                          <th className="px-2 py-3">Device</th>
                          <th className="px-2 py-3">Location</th>
                          <th className="px-2 py-3">IP</th>
                          <th className="px-2 py-3 text-right">&nbsp;</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {recorded.map((s) => {
                          const Icon = DEVICE_ICON[s.device_type] ?? Monitor;
                          return (
                            <tr key={s.id} className="text-sm">
                              <td className="px-2 py-3">
                                <div className="flex items-center gap-3">
                                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-inset text-ink-subtle">
                                    <Icon className="h-4.5 w-4.5" />
                                  </span>
                                  <div>
                                    <p className="font-semibold text-ink">{s.device}</p>
                                    <p className="text-xs text-ink-subtle">{s.details}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-2 py-3 text-ink-muted">{s.location || "—"}</td>
                              <td className="px-2 py-3 text-ink-muted">{s.ip || "—"}</td>
                              <td className="px-2 py-3 text-right">
                                {s.is_current
                                  ? <Badge tone="violet">This device</Badge>
                                  : <button className="btn btn-sm btn-outline" onClick={() => void forgetDevice(s)}>Remove record</button>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              {/* where it has acted from */}
              <Card>
                <h2 className="font-display text-base font-semibold text-ink">Where this account has acted from</h2>
                <p className="mt-1 text-xs text-ink-subtle">
                  Every audited action records the address it came from. This is that trail, grouped by address, newest first.
                </p>
                {account.origins.length === 0 ? (
                  <EmptyState
                    icon={MapPin}
                    title="No addresses recorded yet"
                    description="Addresses are kept from the audit trail as you act. Actions made before addresses were recorded have none."
                  />
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                          <th className="px-2 py-3">Address</th>
                          <th className="px-2 py-3">First seen</th>
                          <th className="px-2 py-3">Last seen</th>
                          <th className="px-2 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {account.origins.map((o) => (
                          <tr key={o.ip} className="text-sm">
                            <td className="px-2 py-3 font-mono text-ink">{o.ip}</td>
                            <td className="px-2 py-3 text-ink-muted">{formatWhen(o.first_seen)}</td>
                            <td className="px-2 py-3 text-ink-muted">{formatWhen(o.last_seen)}</td>
                            <td className="px-2 py-3 text-right text-ink-muted">{o.actions}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <h2 className="font-display text-base font-semibold text-ink">This session</h2>
                <dl className="mt-3 space-y-2.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-subtle">Started</dt>
                    <dd className="text-right font-medium text-ink">{formatWhen(ts?.started_at ?? "") || "Unknown"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-subtle">Lapses if idle</dt>
                    <dd className="text-right font-medium text-ink">{formatWhen(ts?.expires_at ?? "") || "Unknown"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-subtle">Session generation</dt>
                    <dd className="text-right font-medium text-ink">{ts?.generation ?? 0} of {account.token_version}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs leading-relaxed text-ink-subtle">
                  A session renews itself while you use the app and lapses about thirty minutes after you stop.
                  Its generation is the account&apos;s at the moment it began; ending every session moves the account on
                  and leaves every older token behind.
                </p>
              </Card>

              <Card className="border-status-danger-border">
                <h2 className="font-display text-base font-semibold text-status-danger-ink">Sign out everywhere</h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Ends every session on every device, including this one. Use it if this account was opened on a
                  device you do not control.
                </p>
                <button className="btn btn-danger btn-block mt-4" onClick={() => void endEverywhere()} disabled={ending}>
                  <LogOut className="h-4 w-4" /> {ending ? "Ending sessions…" : "Sign out everywhere"}
                </button>
                <p className="mt-3 text-xs text-ink-subtle">
                  Changing your password does the same for every session except the one you change it from.
                </p>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
