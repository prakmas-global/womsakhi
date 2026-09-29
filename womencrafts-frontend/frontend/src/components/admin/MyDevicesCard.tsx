"use client";

import { useCallback, useEffect, useState } from "react";
import { LogOut, Monitor, MonitorSmartphone, RefreshCw, Smartphone } from "lucide-react";
import { Alert, Badge, Card, EmptyState, Spinner, useConfirm, useToast } from "@/design-system";
import {
  apiMyDevices, apiRemoveDevice, apiSignOutEverywhere, authError, type SignedInDevice,
} from "@/lib/auth-api";
import { formatWhen } from "@/lib/staff-api";

/**
 * The caller's own signed-in devices, from `/auth/sessions` — one row per
 * session the server actually holds, the one in use marked, every other one
 * with a "Sign out" that ends it on the spot.
 *
 * Shared by Settings › Security and Settings › Sessions so the two screens
 * cannot disagree about where this account is signed in.
 */

export function lastActive(iso: string, now: number): string {
  const t = new Date(iso).getTime();
  if (!iso || Number.isNaN(t)) return "Not known";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 120) return "Active now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} ${d === 1 ? "day" : "days"} ago`;
  return formatWhen(iso, false);
}

function sortDevices(list: SignedInDevice[]) {
  return [...list].sort((a, b) => Number(b.current) - Number(a.current)
    || new Date(b.last_used_at).getTime() - new Date(a.last_used_at).getTime());
}

/** Ends every session, this one included, and leaves with a full page load:
 *  the cookie is dead the moment the server answers. */
export function useSignOutEverywhere() {
  const confirm = useConfirm();
  const toast = useToast();
  const [ending, setEnding] = useState(false);
  const run = useCallback(async () => {
    const ok = await confirm({
      title: "Sign out of every device, including this one?",
      description: "Every session on this account ends now. You will be taken to the sign-in screen and sign back in with an email code and your authenticator.",
      confirmLabel: "Sign out everywhere",
      danger: true,
    });
    if (!ok) return;
    setEnding(true);
    try {
      await apiSignOutEverywhere();
      window.location.assign("/signin");
    } catch (e) {
      toast.error("Could not end the sessions", { description: authError(e).message });
      setEnding(false);
    }
  }, [confirm, toast]);
  return { run, ending };
}

export default function MyDevicesCard({ compact = false, refreshable = false, onCount }: {
  /** Leaves out when each device signed in. */
  compact?: boolean;
  /** Its own Refresh button — off where the page already has one. */
  refreshable?: boolean;
  /** Told how many devices there are after every load, so a page can count them. */
  onCount?: (n: number) => void;
}) {
  const confirm = useConfirm();
  const toast = useToast();
  const [devices, setDevices] = useState<SignedInDevice[] | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);
  const [busyId, setBusyId] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await apiMyDevices();
      setDevices(sortDevices(list));
      setNow(Date.now());
      setError("");
      onCount?.(list.length);
    } catch (e) {
      setError(authError(e, "Could not load your devices.").message);
    }
  }, [onCount]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const list = await apiMyDevices();
        if (!alive) return;
        setDevices(sortDevices(list));
        setNow(Date.now());
      } catch (e) {
        if (alive) setError(authError(e, "Could not load your devices.").message);
      }
    })();
    return () => { alive = false; };
  }, []);

  const remove = useCallback(async (d: SignedInDevice) => {
    const ok = await confirm({
      title: `Sign out ${d.label || "that device"}?`,
      description: "Its session ends now. Whoever is holding it has to sign in again with an email code and the authenticator.",
      confirmLabel: "Sign it out",
      danger: true,
    });
    if (!ok) return;
    setBusyId(d.id);
    try {
      const res = await apiRemoveDevice(d.id);
      toast.success("Device signed out", { description: res.message });
      await load();
    } catch (e) {
      toast.error("Could not sign that device out", { description: authError(e).message });
    } finally {
      setBusyId("");
    }
  }, [confirm, load, toast]);

  const others = devices?.filter((d) => !d.current).length ?? 0;

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-tint text-violet-ink">
            <MonitorSmartphone className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-ink">
              Signed-in devices {devices && <span className="font-normal text-ink-subtle">({devices.length})</span>}
            </h2>
            <p className="mt-0.5 text-sm text-ink-subtle">
              {devices
                ? others === 0 ? "Only this device is signed in." : `This device and ${others} other${others === 1 ? "" : "s"}. Staff sessions last 12 hours.`
                : "Every device with a live session on this account."}
            </p>
          </div>
        </div>
        {refreshable && (
          <button className="btn btn-sm btn-secondary" disabled={refreshing}
                  onClick={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
        )}
      </div>

      {error ? (
        <Alert variant="danger">{error}</Alert>
      ) : devices === null ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : devices.length === 0 ? (
        <EmptyState icon={MonitorSmartphone} title="No devices" description="No live session was found for this account." />
      ) : (
        <ul className="divide-y divide-line">
          {devices.map((d) => {
            const Icon = d.kind === "app" || /iphone|android|mobile/i.test(d.label) ? Smartphone : Monitor;
            return (
              <li key={d.id} className="flex items-center gap-3 py-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${d.current ? "bg-brand-tint text-brand-ink" : "bg-surface-inset text-ink-subtle"}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                    <span className="truncate">{d.label || (d.kind === "app" ? "WomSakhi app" : "A web browser")}</span>
                    {d.current && <Badge tone="violet">This device</Badge>}
                  </p>
                  <p className="text-xs text-ink-subtle">
                    {d.current ? "In use now" : `Last active ${lastActive(d.last_used_at, now).replace(/^Active now$/, "just now")}`}
                    {d.ip ? ` · ${d.ip}` : ""}
                    {!compact && ` · signed in ${formatWhen(d.created_at)}`}
                  </p>
                </div>
                {!d.current && (
                  <button className="btn btn-sm btn-outline shrink-0" disabled={busyId === d.id} onClick={() => void remove(d)}>
                    <LogOut className="h-3.5 w-3.5" /> {busyId === d.id ? "Signing out…" : "Sign out"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
