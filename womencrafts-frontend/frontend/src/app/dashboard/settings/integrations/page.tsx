"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, Bell, Check, ChevronDown, CircleCheck, CircleDashed, CircleOff, FlaskConical, HardDrive,
  Mail, MessageCircle, MessageSquare, Mic, Puzzle, RefreshCw, Search, Server, Sparkles, Timer, Wallet,
} from "lucide-react";

import { Badge, Card, EmptyState, Menu, MenuItem, Spinner, StatCard, useToast, type Tone } from "@/design-system";
import { ResizableColumns } from "@/layout-engine";
import { useAuth } from "@/context/AuthContext";
import { apiListAdapters, apiSendTestEmail, type AdapterList } from "@/lib/integrations-api";
import { memberError } from "@/lib/member-api";

/**
 * Integrations.
 *
 * What this screen used to show: eight seeded cards — "Stripe · Connected ·
 * Last synced 10 mins ago", a Slack toggle, a webhook secret — where
 * connecting wrote a caption to a document nothing read. That is gone.
 *
 * An integration here is a real adapter in the backend, and its status is
 * whether the process holds what that adapter needs, read from its
 * configuration when you open the page. Secrets never come back; only
 * whether one is set. Services that have no adapter are listed as
 * "not available" so nobody goes looking for a switch that does not exist.
 */

const ICONS: Record<string, React.ElementType> = {
  email: Mail, storage: HardDrive, payments: Wallet, sms: MessageSquare, whatsapp: MessageCircle,
  ai: Sparkles, push: Bell, speech: Mic, tracing: Activity, redis: Server, engines: Timer,
};

const STATUS: Record<string, { label: string; tone: Tone; dot: string; icon: React.ElementType }> = {
  configured: { label: "Configured", tone: "emerald", dot: "bg-status-ok-solid", icon: CircleCheck },
  sandbox: { label: "Sandbox", tone: "amber", dot: "bg-status-warn-solid", icon: FlaskConical },
  not_configured: { label: "Not configured", tone: "slate", dot: "bg-line-strong", icon: CircleDashed },
  not_available: { label: "Not available", tone: "rose", dot: "bg-status-danger-solid", icon: CircleOff },
};
const status = (s: string) => STATUS[s] ?? STATUS.not_configured;

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "configured", label: "Configured" },
  { value: "sandbox", label: "Sandbox" },
  { value: "not_configured", label: "Not configured" },
  { value: "not_available", label: "Not available" },
];

export default function IntegrationsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [data, setData] = useState<AdapterList | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [testing, setTesting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await apiListAdapters());
    } catch (e) {
      toast.error("Could not read the integration status", { description: memberError(e) });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // The first read, inline so every setState provably follows an await;
  // `refresh` above is for the Check again button.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const list = await apiListAdapters();
        if (alive) setData(list);
      } catch (e) {
        if (alive) toast.error("Could not read the integration status", { description: memberError(e) });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [toast]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.items ?? []).filter((a) => {
      if (filter && a.status !== filter) return false;
      if (!q) return true;
      return `${a.name} ${a.category} ${a.summary}`.toLowerCase().includes(q);
    });
  }, [data, query, filter]);

  const sendTest = async () => {
    setTesting(true);
    try {
      const res = await apiSendTestEmail();
      if (res.sent) toast.success(`Test email sent to ${res.to}`, { description: "Check the inbox; the send is recorded in the activity log." });
      else toast.error("Nothing was sent", { description: res.message });
    } catch (e) {
      toast.error("Could not send a test", { description: memberError(e) });
    } finally {
      setTesting(false);
    }
  };

  const checkedAt = data ? new Date(data.checked_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-tint text-violet-ink">
            <Puzzle className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Integrations</h1>
            <p className="mt-1 text-sm text-ink-subtle">
              What this server can actually reach, read from its configuration when you open the page.
            </p>
          </div>
        </div>
        <button className="btn btn-outline" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Check again
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Configured" value={String(data?.configured ?? 0)} icon={CircleCheck} tone="emerald" deltaNote="Ready to use" />
        <StatCard label="Sandbox" value={String(data?.sandbox ?? 0)} icon={FlaskConical} tone="amber" deltaNote="Works, but reaches nobody real" />
        <StatCard label="Not configured" value={String(data?.not_configured ?? 0)} icon={CircleDashed} tone="slate" deltaNote="Adapter exists, keys missing" />
        <StatCard label="Not available" value={String(data?.not_available ?? 0)} icon={CircleOff} tone="rose" deltaNote="No adapter in this product" />
      </div>

      <ResizableColumns id="settings-integrations" defaultSize={0.72} className="mt-6 gap-6">
        <Card>
          <div className="mb-4 flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…"
                     className="wc-inset w-full rounded-xl py-2.5 pl-9 pr-3 text-sm text-ink placeholder-ink-subtle outline-none focus:ring-2 focus:ring-brand-500/40" />
            </div>
            <Menu align="right" width="min-w-[12rem]"
                  trigger={<button className="btn btn-sm btn-outline">{FILTERS.find((f) => f.value === filter)?.label ?? "All"} <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" /></button>}>
              {FILTERS.map((f) => (
                <MenuItem key={f.value} icon={filter === f.value ? Check : undefined} onClick={() => setFilter(f.value)}>{f.label}</MenuItem>
              ))}
            </Menu>
            {checkedAt && <span className="text-xs text-ink-subtle">Checked at {checkedAt}</span>}
          </div>

          {loading && !data ? (
            <div className="flex items-center justify-center py-16"><Spinner /></div>
          ) : shown.length === 0 ? (
            <EmptyState icon={Puzzle} title="Nothing matches" description="Try a different search, or clear the filter." />
          ) : (
            <ul className="divide-y divide-line">
              {shown.map((a) => {
                const Icon = ICONS[a.key] ?? Puzzle;
                const st = status(a.status);
                return (
                  <li key={a.key} className="flex flex-wrap items-start gap-4 py-4">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${a.status === "not_available" ? "bg-surface-inset text-ink-subtle" : "bg-brand-tint text-brand-ink"}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-[220px] flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-ink">{a.name}</p>
                        <Badge tone="slate">{a.category}</Badge>
                      </div>
                      <p className="mt-0.5 text-sm text-ink-subtle">{a.summary}</p>
                      {a.details.length > 0 && (
                        <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                          {a.details.map((d) => (
                            <div key={d.label} className="flex justify-between gap-3 border-b border-dashed border-line py-1">
                              <dt className="text-ink-subtle">{d.label}</dt>
                              <dd className="truncate text-right font-medium text-ink-muted" title={d.value}>{d.value}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <span className={`h-2 w-2 rounded-full ${st.dot}`} />
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </p>
                      {a.can_test && a.key === "email" && (
                        <button className="btn btn-sm btn-secondary" disabled={testing} onClick={() => void sendTest()}>
                          <Mail className="h-3.5 w-3.5" /> {testing ? "Sending…" : `Send me a test${user?.email ? "" : ""}`}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-2 font-display text-base font-semibold text-ink">How a status is decided</h2>
            <ul className="space-y-2 text-sm text-ink-muted">
              <li className="flex gap-2"><Badge tone="emerald">Configured</Badge><span>The keys the adapter needs are present. Nothing is verified against the provider until it is used.</span></li>
              <li className="flex gap-2"><Badge tone="amber">Sandbox</Badge><span>Working, but by the provider&apos;s rules it reaches nobody real — a Mailgun sandbox domain, or payments in test mode.</span></li>
              <li className="flex gap-2"><Badge tone="slate">Not configured</Badge><span>The adapter exists in the product; its keys are not set on this server.</span></li>
              <li className="flex gap-2"><Badge tone="rose">Not available</Badge><span>No adapter exists. Nothing on this screen can connect it.</span></li>
            </ul>
          </Card>
          <Card>
            <h2 className="mb-2 font-display text-base font-semibold text-ink">Changing any of this</h2>
            <p className="text-sm text-ink-muted">
              Keys live in the server&apos;s environment, not in this dashboard, so they are never readable here and cannot be edited here.
              Set them where the service runs and press <b>Check again</b>.
            </p>
          </Card>
        </div>
      </ResizableColumns>
    </div>
  );
}
