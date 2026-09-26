"use client";

import { useCallback, useEffect, useMemo, useState, type ElementType } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Bell,
  BookOpen,
  Briefcase,
  CalendarClock,
  ChevronDown,
  Clock,
  EyeOff,
  FileCheck,
  HandCoins,
  Inbox,
  Info,
  MessageSquare,
  MessageSquareHeart,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Siren,
  SlidersHorizontal,
  UserCheck,
  UserPlus,
  UserRoundCheck,
} from "lucide-react";
import { Badge, Card, Menu, MenuItem, NoResults, Spinner, StatCard, useToast } from "@/design-system";
import DonutChart from "@/components/charts/DonutChart";
import { TONE_CHIP } from "@/lib/notifications";
import { apiAttentionFeed, type AttentionFeed } from "@/lib/notifications-api";
import { memberError } from "@/lib/member-api";
import { ResizableColumns } from "@/layout-engine";

/**
 * What needs a person's attention.
 *
 * ── What this page used to be ───────────────────────────────────────────────
 * A "personal inbox" reading a `notifications` collection that nothing on the
 * platform ever wrote to: twelve seeded rows ("Priya Sharma booked a session",
 * "AI predicts 15 cancellations", "Backup finished, 4.25 GB"), a time label
 * stored as the string "10 min ago", a day bucket stored as the string
 * "Today", a stat card with a hardcoded "8%" delta, and four delivery-channel
 * toggles that switched nothing on or off. Mark-as-read and Clear-all acted on
 * the fixtures.
 *
 * ── What it is now ──────────────────────────────────────────────────────────
 * Every row is real work, found by the same query the module's own screen
 * runs, in the areas this account can open. There is nothing to mark read: an
 * item leaves when the work is done, and each one links to where that
 * happens. Nothing here is emailed, pushed or texted — this page IS the
 * delivery, and it says so rather than pretending otherwise.
 */

// The backend names the icon; the page owns the picture.
const AREA_ICON: Record<string, ElementType> = {
  ShieldAlert, Siren, HandCoins, ShieldCheck, FileCheck, UserPlus,
  MessageSquare, Briefcase, UserRoundCheck, BookOpen, MessageSquareHeart, CalendarClock,
};

// Donut slice colour per tone — the same family the chips use.
const TONE_HEX: Record<string, string> = {
  rose: "#f43f5e", amber: "#f59e0b", sky: "#0ea5e9", violet: "#8b5cf6",
  emerald: "#10b981", brand: "#e6117e", blue: "#3b82f6", slate: "#94a3b8",
};

/** "3 min ago" / "2 h ago" / "5 d ago", or a date once it is old. */
function ago(iso: string | null, now: number): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} d ago`;
  return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** The bare duration for a stat card: "3 d", "5 h", "12 min". */
function age(iso: string | null, now: number): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const m = Math.max(0, Math.round((now - t) / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} d`;
}

export default function NotificationsPage() {
  const toast = useToast();
  const [feed, setFeed] = useState<AttentionFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);

  /** The Refresh button. The first load is the effect below. */
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setFeed(await apiAttentionFeed(5));
      setNow(Date.now());
    } catch (e) {
      toast.error("Could not load what needs attention", { description: memberError(e) });
    } finally {
      setRefreshing(false);
    }
  }, [toast]);

  // One effect, one wave; the `alive` flag stops a late response from
  // writing into an unmounted page.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const f = await apiAttentionFeed(5);
        if (!alive) return;
        setFeed(f);
        setNow(Date.now());
      } catch (e) {
        if (alive) toast.error("Could not load what needs attention", { description: memberError(e) });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [toast]);

  // The "ago" labels drift; keep them honest without refetching.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const areas = useMemo(() => feed?.areas ?? [], [feed]);

  // Areas narrowed by the toolbar. An area stays in the list when its label
  // matches the search even if none of its sample rows do — the count is the
  // fact; the rows are only the first few.
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return areas
      .filter((a) => !moduleFilter || a.module === moduleFilter)
      .map((a) => {
        const items = a.items.filter((it) => {
          if (onlyMine && !it.mine) return false;
          if (!q) return true;
          return `${it.title} ${it.desc}`.toLowerCase().includes(q);
        });
        const labelHit = !q || a.label.toLowerCase().includes(q);
        const count = onlyMine ? a.mine : a.count;
        return { area: a, items, count, keep: count > 0 && (labelHit || items.length > 0) };
      })
      .filter((x) => x.keep);
  }, [areas, search, moduleFilter, onlyMine]);

  const clear = useMemo(
    () => areas.filter((a) => (onlyMine ? a.mine : a.count) === 0 && (!moduleFilter || a.module === moduleFilter)),
    [areas, onlyMine, moduleFilter],
  );

  const byModule = useCallback(
    (mod: string) => areas.filter((a) => a.module === mod).reduce((s, a) => s + a.count, 0),
    [areas],
  );
  const canSee = useCallback((mod: string) => !!feed?.modules.some((m) => m.module === mod), [feed]);

  const oldest = useMemo(() => {
    let best: { at: number; label: string } | null = null;
    for (const a of areas) {
      if (!a.oldest_at) continue;
      const t = Date.parse(a.oldest_at);
      if (Number.isNaN(t)) continue;
      if (!best || t < best.at) best = { at: t, label: a.label };
    }
    return best;
  }, [areas]);

  const donut = useMemo(
    () => areas.filter((a) => a.count > 0).map((a) => ({ name: a.label, value: a.count, color: TONE_HEX[a.tone] ?? TONE_HEX.slate })),
    [areas],
  );

  const total = feed?.total ?? 0;
  const filtering = !!search.trim() || !!moduleFilter || onlyMine;

  return (
    <div>
      {/* header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="relative mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <Bell className="h-6 w-6" />
            {total > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-3xs font-bold text-white">
                {total > 99 ? "99+" : total}
              </span>
            )}
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Notifications</h1>
            <p className="mt-1 text-sm text-ink-subtle">
              What needs a person&apos;s attention right now, across the areas you can open.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {feed && (
            <span className="text-xs text-ink-subtle">
              Checked {new Date(feed.as_of).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
            </span>
          )}
          <button onClick={() => void refresh()} className="btn btn-sm btn-outline" disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* summary — every figure is a count from the feed; none is invented */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label="Needs attention"
          value={loading ? "…" : String(total)}
          icon={Bell}
          tone={total > 0 ? "brand" : "slate"}
          deltaNote={feed ? `Across ${feed.modules.length} area${feed.modules.length === 1 ? "" : "s"} you can open` : "Loading"}
        />
        <StatCard
          label="Assigned to you"
          value={loading ? "…" : String(feed?.mine ?? 0)}
          icon={UserCheck}
          tone="violet"
          deltaNote="Reports and threads with your name on"
        />
        <StatCard
          label="Safety"
          value={loading ? "…" : canSee("safety") ? String(byModule("safety")) : "—"}
          icon={ShieldAlert}
          tone={canSee("safety") && byModule("safety") > 0 ? "rose" : "slate"}
          deltaNote={canSee("safety") ? "Alerts, reports, fund requests" : "Not in your access"}
        />
        <StatCard
          label="People waiting"
          value={loading ? "…" : canSee("users") ? String(byModule("users")) : "—"}
          icon={UserPlus}
          tone={canSee("users") && byModule("users") > 0 ? "amber" : "slate"}
          deltaNote={canSee("users") ? "Verification and approval" : "Not in your access"}
        />
        <StatCard
          label="Waiting longest"
          value={loading ? "…" : oldest ? age(new Date(oldest.at).toISOString(), now) : "—"}
          icon={Clock}
          tone={oldest ? "sky" : "slate"}
          deltaNote={oldest ? oldest.label : "Nothing is waiting"}
        />
      </div>

      {/* filters */}
      <Card className="mt-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-40 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search what is waiting…"
              className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
            />
          </div>
          <Menu
            align="left"
            trigger={
              <button className="btn btn-sm btn-outline">
                {moduleFilter ? feed?.modules.find((m) => m.module === moduleFilter)?.label ?? moduleFilter : "All areas"}
                <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" />
              </button>
            }
          >
            <MenuItem onClick={() => setModuleFilter("")}>All areas</MenuItem>
            {(feed?.modules ?? []).map((m) => (
              <MenuItem key={m.module} onClick={() => setModuleFilter(m.module)}>
                {m.label}
              </MenuItem>
            ))}
          </Menu>
          <button
            type="button"
            onClick={() => setOnlyMine((v) => !v)}
            aria-pressed={onlyMine}
            className={`btn btn-sm ${onlyMine ? "btn-primary" : "btn-outline"}`}
          >
            <UserCheck className="h-3.5 w-3.5" /> Only mine
          </button>
          {filtering && (
            <button
              type="button"
              onClick={() => { setSearch(""); setModuleFilter(""); setOnlyMine(false); }}
              className="btn btn-sm btn-ghost"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" /> Clear filters
            </button>
          )}
        </div>
      </Card>

      {/* main grid */}
      <ResizableColumns id="notifications" defaultSize={0.72} className="mt-6 gap-6">
        {/* LEFT — the feed */}
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <div>
              <h2 className="font-display text-base font-semibold text-ink">Work waiting</h2>
              <p className="text-xs text-ink-subtle">
                Each group is the same query its screen runs. An item leaves when the work is done.
              </p>
            </div>
            {!loading && (
              <Badge tone={total > 0 ? "brand" : "slate"}>
                {total} item{total === 1 ? "" : "s"}
              </Badge>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16"><Spinner /></div>
          ) : !feed || feed.modules.length === 0 ? (
            <NoResults
              icon={EyeOff}
              thing="areas"
              description="None of the areas this feed watches are in your access, so there is nothing it can show you. Ask a Super Admin if that is wrong."
            />
          ) : total === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-status-ok-bg text-status-ok-ink">
                <Inbox className="h-7 w-7" />
              </span>
              <p className="mt-4 text-sm font-semibold text-ink">Nothing is waiting on anyone</p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-ink-subtle">
                Every area you can open is clear right now. This feed checks the same queues as each
                screen, so when something new comes in it appears here.
              </p>
            </div>
          ) : shown.length === 0 ? (
            <NoResults
              icon={Bell}
              thing="items"
              filtered
              onClear={() => { setSearch(""); setModuleFilter(""); setOnlyMine(false); }}
            />
          ) : (
            <div className="space-y-6">
              {shown.map(({ area, items, count }) => {
                const Icon = AREA_ICON[area.icon] ?? Bell;
                const more = count - items.length;
                return (
                  <section key={area.key}>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${TONE_CHIP[area.tone] ?? TONE_CHIP.slate}`}>
                          <Icon className="h-4 w-4" strokeWidth={2} />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-ink">
                            {area.label}
                            <span className="ml-2 rounded-full bg-surface-inset px-1.5 text-2xs font-bold text-ink-muted">{count}</span>
                          </p>
                          <p className="text-2xs text-ink-subtle">{area.note}</p>
                        </div>
                      </div>
                      <Link href={area.href} className="text-xs font-semibold text-violet-ink hover:underline">
                        Open <ArrowUpRight className="inline h-3.5 w-3.5" />
                      </Link>
                    </div>

                    {items.length === 0 ? (
                      <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-xs text-ink-subtle">
                        {count} waiting — none of the first few match your search.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {items.map((it) => (
                          <li key={`${area.key}:${it.id}`}>
                            <Link
                              href={it.href}
                              className="group flex gap-3 rounded-xl p-3 transition hover:bg-surface-hover dark:hover:bg-white/5"
                            >
                              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${it.mine ? "bg-violet-500" : "bg-brand-600"}`} />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="truncate text-sm font-semibold text-ink">{it.title}</p>
                                  <span className="shrink-0 whitespace-nowrap text-2xs text-ink-subtle">{ago(it.at, now)}</span>
                                </div>
                                {it.desc && (
                                  <p className="mt-0.5 line-clamp-2 text-xsm leading-relaxed text-ink-subtle">{it.desc}</p>
                                )}
                                {it.mine && (
                                  <span className="mt-1 inline-block"><Badge tone="violet">Yours</Badge></span>
                                )}
                              </div>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                    {more > 0 && (
                      <Link href={area.href} className="mt-1.5 block px-3 text-xs font-medium text-ink-subtle hover:text-violet-ink">
                        and {more} more on the {area.label.toLowerCase()} screen →
                      </Link>
                    )}
                  </section>
                );
              })}
            </div>
          )}

          {/* areas with nothing waiting — said, not hidden */}
          {!loading && feed && total > 0 && clear.length > 0 && (
            <div className="mt-6 border-t border-line pt-4">
              <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                {onlyMine ? "Nothing of yours in" : "All clear"}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {clear.map((a) => (
                  <Link key={a.key} href={a.href} title={a.note}
                        className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-subtle hover:border-line-strong hover:text-ink-muted">
                    {a.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* RIGHT rail */}
        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 font-display text-base font-semibold text-ink">By area</h2>
            {loading ? (
              <div className="flex items-center justify-center py-8"><Spinner /></div>
            ) : donut.length === 0 ? (
              <p className="text-sm text-ink-subtle">Nothing to chart — no area has anything waiting.</p>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <DonutChart data={donut} centerValue={String(total)} centerLabel="Waiting" size={160} thickness={20} />
                <ul className="w-full space-y-2.5">
                  {donut.map((d) => (
                    <li key={d.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-ink-muted">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
                        <span className="truncate">{d.name}</span>
                      </span>
                      <span className="font-semibold text-ink-muted">{d.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card>
            <div className="mb-3 flex items-center gap-2">
              <Info className="h-4 w-4 text-ink-subtle" />
              <h2 className="font-display text-base font-semibold text-ink">How this feed works</h2>
            </div>
            <ul className="space-y-2.5 text-xsm leading-relaxed text-ink-muted">
              <li>
                <b className="text-ink">It is computed, not stored.</b> Every group is the query its own
                screen runs, so this page and that screen can never disagree.
              </li>
              <li>
                <b className="text-ink">There is nothing to mark read.</b> An item leaves when the work
                is done — assigned, replied, approved, confirmed.
              </li>
              <li>
                <b className="text-ink">This page is the delivery.</b> Nothing here is emailed, pushed
                or texted to you; no adapter does that yet.
              </li>
            </ul>
          </Card>

          {feed && feed.hidden.length > 0 && (
            <Card>
              <div className="mb-2 flex items-center gap-2">
                <EyeOff className="h-4 w-4 text-ink-subtle" />
                <h2 className="font-display text-base font-semibold text-ink">Not counted</h2>
              </div>
              <p className="text-xsm leading-relaxed text-ink-muted">
                Work in areas your role cannot open is left out of every figure above, so a short
                feed here does not mean the platform is quiet.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {feed.hidden.map((m) => (
                  <Badge key={m.module} tone="slate">{m.label}</Badge>
                ))}
              </div>
            </Card>
          )}
        </div>
      </ResizableColumns>
    </div>
  );
}
