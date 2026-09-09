"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Puzzle,
  CircleCheck,
  PieChart,
  RefreshCw,
  Search,
  ChevronDown,
  MoreVertical,
  Calendar,
  CreditCard,
  Mail,
  MessageSquare,
  Video,
  MessageCircle,
  Hash,
  Wallet,
  Webhook,
  ChevronRight,
  Settings2,
  Plug,
  Unplug,
  Eye,
  Trash2,
  ListFilter,
  Copy,
  Check,
} from "lucide-react";
import { Badge, Card, Input, Menu, MenuItem, Modal, Select, StatCard, Switch, Textarea, type Tone, NoResults, useToast } from "@/design-system";
import DonutChart from "@/components/charts/DonutChart";
import {
  apiListIntegrations,
  apiIntegrationStats,
  apiIntegrationOverview,
  apiIntegrationCategories,
  apiRecentIntegrations,
  apiGetWebhook,
  apiUpdateWebhook,
  apiCreateIntegrationRequest,
  apiUpdateIntegration,
  apiConnectIntegration,
  apiDisconnectIntegration,
  apiSyncIntegration,
  type ApiIntegration,
  type ApiIntegrationStats,
  type ApiOverviewSlice,
} from "@/lib/integrations-api";
import { memberError } from "@/lib/member-api";
import { ResizableColumns } from "@/layout-engine";
import { COPY } from "@/components/ux/copy";

const TABS = ["All Integrations", "Active", "Inactive", "Available"];

type Status = "Connected" | "Inactive" | "Not Connected";

type Integration = {
  _id: string;
  name: string;
  iconName: string;
  icon: React.ElementType;
  tone: Tone;
  category: string;
  cat_tone: Tone;
  desc: string;
  status: Status;
  synced: string;
  notifications: boolean;
  auto_sync: boolean;
};

// Integration icons are stored by lucide NAME on the backend; map them back to
// components here (same approach as the Users screens).
const ICON_MAP: Record<string, React.ElementType> = {
  Calendar,
  CreditCard,
  Mail,
  MessageSquare,
  Video,
  MessageCircle,
  Hash,
  Wallet,
  Puzzle,
};

function toIntegration(i: ApiIntegration): Integration {
  return {
    _id: i.id,
    name: i.name,
    iconName: i.icon,
    icon: ICON_MAP[i.icon] ?? Puzzle,
    tone: (i.tone as Tone) ?? "slate",
    category: i.category,
    cat_tone: (i.cat_tone as Tone) ?? "slate",
    desc: i.desc,
    status: (i.status as Status) ?? "Not Connected",
    synced: i.synced,
    notifications: i.notifications,
    auto_sync: i.auto_sync,
  };
}

type RecentItem = { name: string; icon: React.ElementType; tone: Tone; when: string };

const STATUS_DOT: Record<Status, string> = {
  Connected: "bg-status-ok-solid",
  Inactive: "bg-status-warn-solid",
  "Not Connected": "bg-line-strong",
};

const STATUS_TEXT: Record<Status, string> = {
  Connected: "text-status-ok-ink",
  Inactive: "text-status-warn-ink",
  "Not Connected": "text-ink-subtle",
};

const TONE_BG: Record<Tone, string> = {
  brand: "bg-brand-tint text-brand-ink",
  violet: "bg-violet-tint text-violet-ink",
  emerald: "bg-status-ok-bg text-status-ok-ink",
  amber: "bg-status-warn-bg text-status-warn-ink",
  sky: "bg-status-info-bg text-status-info-ink",
  rose: "bg-status-danger-bg text-status-danger-ink",
  fuchsia: "bg-violet-tint text-violet-ink",
  slate: "bg-surface-inset text-ink-subtle",
  blue: "bg-status-info-bg text-status-info-ink",
};

export default function IntegrationsPage() {
  const toast = useToast();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [stats, setStats] = useState<ApiIntegrationStats | null>(null);
  const [apiOverview, setApiOverview] = useState<ApiOverviewSlice[]>([]);
  const [apiOverviewTotal, setApiOverviewTotal] = useState<number | null>(null);
  const [apiCategories, setApiCategories] = useState<string[] | null>(null);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<string>(TABS[0]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All Categories");
  const [statusFilter, setStatusFilter] = useState<string>("All Status");

  // Manage modal (per integration)
  const [managing, setManaging] = useState<Integration | null>(null);

  // Disconnect / remove confirm
  const [disconnectTarget, setDisconnectTarget] = useState<Integration | null>(null);

  // Webhooks + custom integration modals
  const [webhookOpen, setWebhookOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("https://api.womsakhi.com/webhooks/incoming");
  const [webhookSecret, setWebhookSecret] = useState("whsec_9f2c1a7b4e8d5c3a");
  const [webhookError, setWebhookError] = useState("");

  const [requestOpen, setRequestOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({ service: "", category: "Payments", details: "" });
  const [requestSaved, setRequestSaved] = useState(false);
  const [requestError, setRequestError] = useState("");

  const refresh = useCallback(async () => {
    try {
      // Fetch the whole list (client-side filters/tabs/search stay in charge);
      // stat cards, donut, categories and the recent list come from the API too.
      const [list, statsRes, overviewRes, categoriesRes, recentRes] = await Promise.all([
        apiListIntegrations({ page_size: 100 }),
        apiIntegrationStats(),
        apiIntegrationOverview(),
        apiIntegrationCategories(),
        apiRecentIntegrations(3),
      ]);
      setIntegrations(list.items.map(toIntegration));
      setStats(statsRes);
      setApiOverview(overviewRes.overview);
      setApiOverviewTotal(overviewRes.total);
      setApiCategories(categoriesRes);
      setRecent(
        recentRes.map((r) => ({
          name: r.name,
          icon: ICON_MAP[r.icon] ?? Puzzle,
          tone: (r.tone as Tone) ?? "slate",
          when: r.when,
        }))
      );
    } catch {
      /* keep the current data on error */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Load the webhook config once for the Manage Webhooks modal.
    apiGetWebhook()
      .then((w) => {
        setWebhookUrl(w.url);
        setWebhookSecret(w.signing_secret);
      })
      .catch(() => {
        /* keep defaults */
      });
  }, [refresh]);

  const categories = useMemo(
    () =>
      apiCategories ??
      ["All Categories", ...Array.from(new Set(integrations.map((i) => i.category)))],
    [apiCategories, integrations]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return integrations.filter((it) => {
      const matchesQuery =
        !q ||
        it.name.toLowerCase().includes(q) ||
        it.desc.toLowerCase().includes(q) ||
        it.category.toLowerCase().includes(q);
      const matchesTab =
        activeTab === "All Integrations" ||
        (activeTab === "Active" && it.status === "Connected") ||
        (activeTab === "Inactive" && it.status === "Inactive") ||
        (activeTab === "Available" && it.status === "Not Connected");
      const matchesCategory = categoryFilter === "All Categories" || it.category === categoryFilter;
      const matchesStatus = statusFilter === "All Status" || it.status === statusFilter;
      return matchesQuery && matchesTab && matchesCategory && matchesStatus;
    });
  }, [integrations, query, activeTab, categoryFilter, statusFilter]);

  const connectedCount = integrations.filter((i) => i.status === "Connected").length;
  const inactiveCount = integrations.filter((i) => i.status === "Inactive").length;
  const notConnectedCount = integrations.filter((i) => i.status === "Not Connected").length;

  // Prefer the API overview; fall back to a client-side computation while loading.
  const overview =
    apiOverview.length > 0
      ? apiOverview
      : [
          { name: "Connected", value: connectedCount, color: "var(--status-ok-solid)", pct: integrations.length ? `${Math.round((connectedCount / integrations.length) * 100)}%` : "" },
          { name: "Inactive", value: inactiveCount, color: "var(--status-warn-solid)", pct: inactiveCount ? `${Math.round((inactiveCount / integrations.length) * 100)}%` : "" },
          { name: "Not Connected", value: notConnectedCount, color: "var(--color-line-strong)", pct: "" },
        ];
  const overviewTotal = apiOverviewTotal ?? integrations.length;

  async function connect(it: Integration) {
    try {
      await apiConnectIntegration(it._id);
      await refresh();
    } catch (err) {
      toast.error("Could not connect it", { description: memberError(err) });
    }
  }

  async function syncNow(it: Integration) {
    try {
      await apiSyncIntegration(it._id);
      await refresh();
    } catch (err) {
      toast.error("Could not sync", { description: memberError(err) });
    }
  }

  async function confirmDisconnect() {
    if (!disconnectTarget) return;
    const target = disconnectTarget;
    setDisconnectTarget(null);
    if (managing?._id === target._id) setManaging(null);
    try {
      await apiDisconnectIntegration(target._id);
      await refresh();
    } catch (err) {
      toast.error("Could not disconnect it", { description: memberError(err) });
    }
  }

  async function updateManaging(patch: Partial<Integration>) {
    if (!managing) return;
    const id = managing._id;
    // Optimistic update so the toggle flips instantly…
    setManaging({ ...managing, ...patch });
    setIntegrations((prev) => prev.map((it) => (it._id === id ? { ...it, ...patch } : it)));
    try {
      await apiUpdateIntegration(id, {
        notifications: patch.notifications,
        auto_sync: patch.auto_sync,
      });
      await refresh();
    } catch (err) {
      toast.error("Could not update the integration", { description: memberError(err) });
    }
  }

  async function submitRequest() {
    if (!requestForm.service.trim()) {
      setRequestError("Service name is required.");
      return;
    }
    setRequestError("");
    try {
      await apiCreateIntegrationRequest({
        service: requestForm.service.trim(),
        category: requestForm.category,
        details: requestForm.details.trim(),
      });
      setRequestSaved(true);
      setTimeout(() => {
        setRequestSaved(false);
        setRequestOpen(false);
        setRequestForm({ service: "", category: "Payments", details: "" });
      }, 1200);
    } catch {
      setRequestError(COPY.genericFailure);
    }
  }

  async function saveWebhook() {
    if (!webhookUrl.trim()) {
      setWebhookError("Webhook URL is required.");
      return;
    }
    setWebhookError("");
    try {
      const w = await apiUpdateWebhook(webhookUrl.trim());
      setWebhookUrl(w.url);
      setWebhookSecret(w.signing_secret);
      toast.success("Webhook saved");
    } catch {
      setWebhookError(COPY.genericFailure);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start gap-3">
        <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-tint text-violet-ink">
          <Puzzle className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Integrations</h1>
          <p className="mt-1 text-sm text-ink-subtle">Connect and manage third-party services to extend your platform.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Integrations" value={String(stats?.total_integrations ?? integrations.length)} icon={Puzzle} tone="violet" deltaNote="Connected services" />
        <StatCard label="Active Integrations" value={String(stats?.active_integrations ?? connectedCount)} icon={CircleCheck} tone="emerald" deltaNote="Currently connected" />
        <StatCard label="Available Integrations" value={stats?.available_integrations ?? "32"} icon={PieChart} tone="amber" deltaNote="Ready to connect" />
        <StatCard label="Sync Status" value={stats?.sync_status ?? "All Good"} icon={RefreshCw} tone="sky" deltaNote={`Last checked ${stats?.last_checked ?? "5 mins ago"}`} valueClassName="text-lg" />
      </div>

      {/* Main grid */}
      <ResizableColumns id="settings-integrations" defaultSize={0.74} className="mt-6 gap-6">
        {/* LEFT */}
        <Card>
          {/* Tabs */}
          <div className="mb-5 flex items-center gap-6 border-b border-line text-sm font-medium">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`-mb-px border-b-2 pb-3 ${
                  t === activeTab ? "border-brand-600 font-semibold text-brand-ink" : "border-transparent text-ink-subtle hover:text-ink-muted"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Controls */}
          <div className="mb-5 flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search integration..."
                className="w-full rounded-lg border border-line-strong py-2 pl-9 pr-3 text-sm outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
              />
            </div>
            <Menu
              align="right"
              trigger={
                <button className="btn btn-sm btn-outline">{categoryFilter} <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" /></button>
              }
            >
              {categories.map((c) => (
                <MenuItem key={c} icon={ListFilter} onClick={() => setCategoryFilter(c)}>
                  {c}
                </MenuItem>
              ))}
            </Menu>
            <Menu
              align="right"
              trigger={
                <button className="btn btn-sm btn-outline">{statusFilter} <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" /></button>
              }
            >
              <MenuItem icon={ListFilter} onClick={() => setStatusFilter("All Status")}>All Status</MenuItem>
              <MenuItem icon={CircleCheck} onClick={() => setStatusFilter("Connected")}>Connected</MenuItem>
              <MenuItem icon={RefreshCw} onClick={() => setStatusFilter("Inactive")}>Inactive</MenuItem>
              <MenuItem icon={Plug} onClick={() => setStatusFilter("Not Connected")}>Not Connected</MenuItem>
            </Menu>
          </div>

          {/* Rows */}
          <ul className="divide-y divide-line">
            {filtered.map((it) => {
              const connectAction = it.status !== "Connected";
              return (
                <li key={it._id} className="flex flex-wrap items-center gap-4 py-4">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${TONE_BG[it.tone]}`}>
                    <it.icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-[200px] flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-ink">{it.name}</p>
                      <Badge tone={it.cat_tone}>{it.category}</Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-ink-subtle">{it.desc}</p>
                  </div>
                  <div className="min-w-[140px]">
                    <p className={`flex items-center gap-1.5 text-sm font-medium ${STATUS_TEXT[it.status]}`}>
                      <span className={`h-2 w-2 rounded-full ${STATUS_DOT[it.status]}`} />
                      {it.status}
                    </p>
                    <p className="mt-0.5 pl-3.5 text-xs text-ink-subtle">{it.synced}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {connectAction ? (
                      <button className="btn btn-sm btn-secondary" onClick={() => connect(it)}>Connect</button>
                    ) : (
                      <button className="btn btn-sm btn-secondary" onClick={() => setManaging(it)}>Manage</button>
                    )}
                    <Menu
                      align="right"
                      trigger={
                        <button aria-label={`More actions for ${it.name}`} className="text-ink-subtle hover:text-ink-muted"><MoreVertical className="h-4 w-4" /></button>
                      }
                    >
                      {it.status === "Connected" ? (
                        <>
                          <MenuItem icon={Settings2} onClick={() => setManaging(it)}>Manage</MenuItem>
                          <MenuItem icon={RefreshCw} onClick={() => syncNow(it)}>
                            Sync Now
                          </MenuItem>
                          <MenuItem icon={Unplug} danger onClick={() => setDisconnectTarget(it)}>Disconnect</MenuItem>
                        </>
                      ) : (
                        <>
                          <MenuItem icon={Plug} onClick={() => connect(it)}>Connect</MenuItem>
                          <MenuItem icon={Eye} onClick={() => setManaging(it)}>View Details</MenuItem>
                          {it.status === "Inactive" && (
                            <MenuItem icon={Trash2} danger onClick={() => setDisconnectTarget(it)}>Remove</MenuItem>
                          )}
                        </>
                      )}
                    </Menu>
                  </div>
                </li>
              );
            })}
            {loading && integrations.length === 0 && (
              <li className="py-10 text-center text-sm text-ink-subtle">Loading integrations…</li>
            )}
            {!loading && filtered.length === 0 && (
              <li><NoResults icon={Puzzle} thing="integrations" filtered compact /></li>
            )}
          </ul>

          {/* Footer */}
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => setActiveTab("Available")}
              className="flex items-center gap-1.5 text-sm font-semibold text-brand-ink hover:text-brand-ink"
            >
              View More Integrations <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </Card>

        {/* RIGHT */}
        <div className="space-y-6">
          {/* Integration Overview */}
          <Card>
            <h2 className="mb-4 font-display text-base font-semibold text-ink">Integration Overview</h2>
            <div className="flex items-center gap-4">
              <DonutChart data={overview} centerValue={String(overviewTotal)} centerLabel="Total" size={130} thickness={18} />
              <ul className="flex-1 space-y-3 text-sm">
                {overview.map((o) => (
                  <li key={o.name} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-ink-muted">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: o.color }} />
                      {o.name}
                    </span>
                    <span className="whitespace-nowrap font-semibold text-ink-subtle">
                      {o.value} {o.pct ? `(${o.pct})` : "(–)"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          {/* Recently Connected */}
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-ink">Recently Connected</h2>
              <button onClick={() => setActiveTab("Active")} className="text-xs font-semibold text-brand-ink transition hover:underline">View All</button>
            </div>
            <ul className="space-y-4">
              {recent.map((r) => (
                <li key={r.name} className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONE_BG[r.tone]}`}>
                    <r.icon className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{r.name}</p>
                    <p className="text-xs text-ink-subtle">{r.when}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {/* Webhooks */}
          <Card>
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-tint text-violet-ink">
                <Webhook className="h-4.5 w-4.5" />
              </span>
              <div>
                <h2 className="font-display text-base font-semibold text-ink">Webhooks</h2>
                <p className="mt-1 text-sm text-ink-subtle">Use webhooks to send real-time data to your external applications.</p>
              </div>
            </div>
            <button className="btn btn-secondary btn-block mt-4 justify-between" onClick={() => setWebhookOpen(true)}>
              Manage Webhooks <ChevronRight className="h-4 w-4 text-ink-subtle" />
            </button>
          </Card>

          {/* Custom Integration */}
          <Card>
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand-ink">
                <Puzzle className="h-4.5 w-4.5" />
              </span>
              <div>
                <h2 className="font-display text-base font-semibold text-ink">Need a Custom Integration?</h2>
                <p className="mt-1 text-sm text-ink-subtle">Don&apos;t see the service you need? We can help you build a custom integration.</p>
              </div>
            </div>
            <button className="btn btn-secondary btn-block mt-4 justify-between" onClick={() => setRequestOpen(true)}>
              Request an Integration <ChevronRight className="h-4 w-4" />
            </button>
          </Card>
        </div>
      </ResizableColumns>

      {/* Manage integration modal */}
      <Modal
        open={!!managing}
        onClose={() => setManaging(null)}
        title={managing ? `Manage ${managing.name}` : "Manage Integration"}
        description={managing?.status === "Connected" ? "Configure sync and notification settings for this integration." : "Review this integration and connect it when you're ready."}
        icon={managing?.icon ?? Settings2}
        iconTone="violet"
        footer={
          managing?.status === "Connected" ? (
            <>
              <button className="btn btn-outline" onClick={() => setManaging(null)}>Close</button>
              <button className="btn btn-danger" onClick={() => managing && setDisconnectTarget(managing)}>
                <Unplug className="h-4 w-4" /> Disconnect
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-outline" onClick={() => setManaging(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => managing && connect(managing)}>
                <Plug className="h-4 w-4" /> Connect
              </button>
            </>
          )
        }
      >
        {managing && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${TONE_BG[managing.tone]}`}>
                <managing.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-ink">{managing.name}</p>
                  <Badge tone={managing.cat_tone}>{managing.category}</Badge>
                </div>
                <p className="mt-0.5 text-sm text-ink-subtle">{managing.desc}</p>
              </div>
            </div>
            <p className={`flex items-center gap-1.5 text-sm font-medium ${STATUS_TEXT[managing.status]}`}>
              <span className={`h-2 w-2 rounded-full ${STATUS_DOT[managing.status]}`} />
              {managing.status} · {managing.synced}
            </p>
            {managing.status === "Connected" && (
              <div className="space-y-2.5">
                <Switch
                  label="Enable notifications"
                  description="Receive alerts from this integration."
                  checked={managing.notifications}
                  onChange={(v) => updateManaging({ notifications: v })}
                />
                <Switch
                  label="Automatic sync"
                  description="Keep data in sync automatically in the background."
                  checked={managing.auto_sync}
                  onChange={(v) => updateManaging({ auto_sync: v })}
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Disconnect / remove confirm modal */}
      <Modal
        open={!!disconnectTarget}
        onClose={() => setDisconnectTarget(null)}
        title={disconnectTarget?.status === "Inactive" ? "Remove Integration" : "Disconnect Integration"}
        description={
          disconnectTarget
            ? `Are you sure you want to ${disconnectTarget.status === "Inactive" ? "remove" : "disconnect"} "${disconnectTarget.name}"?`
            : ""
        }
        icon={disconnectTarget?.status === "Inactive" ? Trash2 : Unplug}
        iconTone="rose"
        size="sm"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setDisconnectTarget(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={confirmDisconnect}>
              {disconnectTarget?.status === "Inactive" ? (
                <><Trash2 className="h-4 w-4" /> Remove</>
              ) : (
                <><Unplug className="h-4 w-4" /> Disconnect</>
              )}
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-subtle">
          {disconnectTarget?.status === "Inactive"
            ? "This integration will be removed from your available connections. You can reconnect it later."
            : "This integration will stop syncing until you reconnect it. Your existing data will be preserved."}
        </p>
      </Modal>

      {/* Manage Webhooks modal */}
      <Modal
        open={webhookOpen}
        onClose={() => setWebhookOpen(false)}
        title="Manage Webhooks"
        description="Send real-time events to your external applications."
        icon={Webhook}
        iconTone="violet"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setWebhookOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveWebhook}>Save Webhook</button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Endpoint URL"
            required
            placeholder="https://example.com/webhook"
            value={webhookUrl}
            onChange={(e) => {
              setWebhookUrl(e.target.value);
              if (webhookError) setWebhookError("");
            }}
          />
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink-muted">Signing secret</p>
              <p className="truncate text-xs text-ink-subtle">{webhookSecret}</p>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => navigator.clipboard?.writeText(webhookSecret)}
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
          </div>
          {webhookError && <p className="text-sm font-medium text-status-danger-ink">{webhookError}</p>}
        </div>
      </Modal>

      {/* Request custom integration modal */}
      <Modal
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        title="Request an Integration"
        description="Tell us which service you'd like us to build a custom integration for."
        icon={Puzzle}
        iconTone="brand"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setRequestOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={submitRequest}>Submit Request</button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Service Name"
            required
            placeholder="e.g. QuickBooks"
            value={requestForm.service}
            onChange={(e) => {
              setRequestForm((f) => ({ ...f, service: e.target.value }));
              if (requestError) setRequestError("");
            }}
          />
          <Select
            label="Category"
            options={["Payments", "Calendar", "Email Marketing", "SMS", "Messaging", "Video Conferencing", "Team Collaboration", "Other"]}
            value={requestForm.category}
            onChange={(e) => setRequestForm((f) => ({ ...f, category: e.target.value }))}
          />
          <Textarea
            label="Details"
            placeholder="Describe what you'd like this integration to do…"
            value={requestForm.details}
            onChange={(e) => setRequestForm((f) => ({ ...f, details: e.target.value }))}
          />
          {requestError && <p className="text-sm font-medium text-status-danger-ink">{requestError}</p>}
          {requestSaved && (
            <p className="flex items-center gap-1.5 text-sm font-medium text-status-ok-ink">
              <Check className="h-4 w-4" /> Request submitted
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
