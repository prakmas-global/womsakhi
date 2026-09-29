"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Clock, KeyRound, LogOut, MapPin, MonitorSmartphone, RefreshCw, ShieldCheck,
} from "lucide-react";
import { Alert, Card, EmptyState, Spinner, StatCard } from "@/design-system";
import { apiMyDevices } from "@/lib/auth-api";
import { apiMyAccount, formatWhen, type MyAccount } from "@/lib/staff-api";
import { memberError } from "@/lib/member-api";
import MyDevicesCard, { useSignOutEverywhere } from "@/components/admin/MyDevicesCard";

/**
 * Sessions — where this account is signed in.
 *
 * Every sign-in is its own server-side session (12 hours for staff), listed
 * from `/auth/sessions`: one row per device, the one in use marked, any other
 * signed out on the spot. Beside it, the addresses the audit trail has seen
 * this account act from, and the switch that ends every session at once.
 */

export default function SessionsPage() {
  const everywhere = useSignOutEverywhere();

  const [account, setAccount] = useState<MyAccount | null>(null);
  const [deviceCount, setDeviceCount] = useState<number | null>(null);
  /** Remounts the device card so Refresh reloads it too. */
  const [round, setRound] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    const [acc, list] = await Promise.all([apiMyAccount(), apiMyDevices().catch(() => null)]);
    return { acc, list };
  }, []);

  const load = useCallback(async () => {
    try {
      const { acc, list } = await fetchAll();
      setAccount(acc);
      setDeviceCount(list ? list.length : null);
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
        setDeviceCount(list ? list.length : null);
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
    setRound((r) => r + 1);
    await load();
    setRefreshing(false);
  }, [load]);

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
              Every device signed in to this account, and the one control that ends all of it.
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
                      deltaNote="Staff sessions last 12 hours" />
            <StatCard label="Last signed in" icon={KeyRound} tone="amber" valueClassName="text-lg"
                      value={formatWhen(account.last_login_at) || "Not recorded"}
                      deltaNote="Your most recent successful sign-in" />
            <StatCard label="Signed-in devices" icon={MonitorSmartphone} tone="emerald"
                      value={deviceCount === null ? "—" : String(deviceCount)}
                      deltaNote="Including this one" />
            <StatCard label="Authenticator" icon={ShieldCheck} tone={account.two_factor.enabled ? "brand" : "amber"}
                      value={account.two_factor.enabled ? "Enabled" : "Not set up"} valueClassName="text-lg"
                      deltaNote="Required for every staff sign-in" />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-6">
              <MyDevicesCard key={round} onCount={setDeviceCount} />

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
                    <dt className="text-ink-subtle">Signed out everywhere</dt>
                    <dd className="text-right font-medium text-ink">{account.sessions_ended_at ? formatWhen(account.sessions_ended_at) : "Never"}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs leading-relaxed text-ink-subtle">
                  A staff session lasts 12 hours. After that you sign in again with an email code and your authenticator.
                </p>
              </Card>

              <Card className="border-status-danger-border">
                <h2 className="font-display text-base font-semibold text-status-danger-ink">Sign out everywhere</h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Ends every session on every device, including this one. Use it if this account was opened on a
                  device you do not control.
                </p>
                <button className="btn btn-danger btn-block mt-4" onClick={() => void everywhere.run()} disabled={everywhere.ending}>
                  <LogOut className="h-4 w-4" /> {everywhere.ending ? "Ending sessions…" : "Sign out everywhere"}
                </button>
                <p className="mt-3 text-xs text-ink-subtle">
                  To end just one device, use Sign out on its row.
                </p>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
