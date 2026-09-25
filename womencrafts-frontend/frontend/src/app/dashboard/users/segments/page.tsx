"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  User,
  Target,
  TrendingUp,
  Star,
  Plus,
  SlidersHorizontal,
  MoreHorizontal,
  Lightbulb,
  GraduationCap,
  BookOpen,
  Palette,
  HeartHandshake,
  Briefcase,
  MessageCircle,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  ChevronRight,
  Eye,
  Pencil,
  Trash2,
  Check,
  Search,
  UserX,
} from "lucide-react";
import Link from "next/link";
import {
  Badge, Card, EmptyState, Input, Menu, MenuItem, Modal, Select, Spinner, StatCard, Textarea,
  useToast, useConfirm,
} from "@/design-system";
import DonutChart from "@/components/charts/DonutChart";
import MultiLine from "@/components/charts/MultiLine";
import BarTrend from "@/components/charts/BarTrend";
import {
  apiCreateSegmentLive,
  apiDeleteSegmentLive,
  apiListSegmentsLive,
  apiSegmentGrowth,
  apiUpdateSegmentLive,
  describeRule,
  type LiveSegment,
  type SegmentGrowth,
  type SegmentList,
  type SegmentRule,
} from "@/lib/members-admin-api";
import { memberError } from "@/lib/member-api";
import { ResizableColumns } from "@/layout-engine";

/**
 * Segments — saved groupings of the members directory.
 *
 * Every figure on this screen is counted from `members` on the request. The
 * rows used to carry a typed-in "3,245 users" and "18.6% growth" that nothing
 * ever updated; a segment is now a RULE (segment / role / status), and the
 * server counts who matches it.
 */

// Fixed brand colours, assigned by position so a new segment gets one too.
const PALETTE = [
  "var(--color-brand-600)",
  "var(--color-violet-500)",
  "var(--color-brand-300)",
  "var(--status-warn-solid)",
  "var(--status-ok-solid)",
  "var(--status-info-solid)",
  "var(--color-violet-300)",
  "var(--status-danger-solid)",
];

// Segment icons are stored by name on the backend; map them back to components.
const ICON_MAP: Record<string, React.ElementType> = {
  Lightbulb,
  GraduationCap,
  BookOpen,
  Palette,
  HeartHandshake,
  Briefcase,
  MessageCircle,
  Users,
};
const ICON_OPTIONS = Object.keys(ICON_MAP);

// Static reference lists: the values the directory itself allows.
const SEGMENT_VALUES = ["Entrepreneur", "Student", "Artisan", "Job Seeker", "Support Seeker"];
const ROLE_VALUES = ["Member", "Instructor", "Supervisor", "Admin"];
const STATUS_VALUES = ["Active", "Inactive", "Pending", "Rejected"];

/** Select sentinels for the two meanings a rule field can have besides a value. */
const ANY = "__any__";
const NONE = "__none__";

const toSelect = (v: string | undefined) => (v === undefined ? ANY : v === "" ? NONE : v);
const fromSelect = (v: string): string | undefined => (v === ANY ? undefined : v === NONE ? "" : v);

function ruleOptions(values: string[], noneLabel: string) {
  return [
    { value: ANY, label: "Any" },
    ...values.map((v) => ({ value: v, label: v })),
    { value: NONE, label: noneLabel },
  ];
}

/** The users screen reads these to pre-apply the same filter. */
function membersHref(rule: SegmentRule): string {
  const p = new URLSearchParams();
  if (rule.segment !== undefined) p.set("segment", rule.segment === "" ? NONE : rule.segment);
  if (rule.role !== undefined && rule.role !== "") p.set("role", rule.role);
  if (rule.status !== undefined && rule.status !== "") p.set("status", rule.status);
  const qs = p.toString();
  return qs ? `/dashboard/users?${qs}` : "/dashboard/users";
}

type StatusFilter = "all" | "Active" | "Inactive";

type SegmentForm = {
  name: string;
  desc: string;
  status: "Active" | "Inactive";
  icon: string;
  segment: string;
  role: string;
  memberStatus: string;
};

const EMPTY_FORM: SegmentForm = {
  name: "", desc: "", status: "Active", icon: "Users", segment: ANY, role: ANY, memberStatus: ANY,
};

const EMPTY_LIST: SegmentList = { items: [], total: 0, members_total: 0, unsegmented: 0 };

export default function UserSegmentsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState<SegmentList>(EMPTY_LIST);
  const [growth, setGrowth] = useState<SegmentGrowth | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<SegmentForm>(EMPTY_FORM);
  const [editTarget, setEditTarget] = useState<LiveSegment | null>(null);
  const [editForm, setEditForm] = useState<SegmentForm>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [list, g] = await Promise.all([
        apiListSegmentsLive(),
        apiSegmentGrowth(8).catch(() => null),
      ]);
      setData(list);
      setGrowth(g);
    } catch (e) {
      toast.error("Could not load segments", { description: memberError(e) });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Started from an async IIFE so the effect body itself sets no state.
  useEffect(() => {
    void (async () => { await refresh(); })();
  }, [refresh]);

  const segments = data.items;
  const colorOf = useMemo(() => {
    const m: Record<string, string> = {};
    segments.forEach((s, i) => { m[s.id] = PALETTE[i % PALETTE.length]; });
    return m;
  }, [segments]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return segments.filter((s) => {
      const matchesQuery = !q || s.name.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || s.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [segments, query, statusFilter]);

  // Figures for the stat cards + charts — all from the live list.
  const activeSegments = segments.filter((s) => s.status === "Active").length;
  const bySize = useMemo(() => [...segments].sort((a, b) => b.member_count - a.member_count), [segments]);
  const largest = bySize[0] ?? null;
  const createdThisMonth = useMemo(() => {
    const now = new Date();
    return segments.filter((s) => {
      const d = new Date(s.created_at);
      return !Number.isNaN(d.getTime()) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, [segments]);
  const donut = segments
    .filter((s) => s.member_count > 0)
    .map((s) => ({ name: s.name, value: s.member_count, color: colorOf[s.id] }));
  const activeShare = segments.map((s) => ({
    label: s.name,
    value: s.active_pct,
    color: s.active_pct >= 70 ? "var(--status-ok-solid)" : s.active_pct >= 40 ? "var(--status-warn-solid)" : "var(--status-danger-solid)",
  }));
  const growthRows = useMemo(() => {
    if (!growth) return [];
    return growth.labels.map((label, i) => {
      const row: Record<string, string | number> = { label };
      growth.series.forEach((s) => { row[s.name] = s.points[i] ?? 0; });
      return row;
    });
  }, [growth]);
  const growthSeries = useMemo(
    () => (growth?.series ?? []).map((s) => ({ key: s.name, color: colorOf[s.id] ?? PALETTE[0] })),
    [growth, colorOf],
  );
  const growthHasData = growthRows.some((r) => growthSeries.some((s) => Number(r[s.key]) > 0));

  // Insights that are true of this data, or nothing at all.
  const insights = useMemo(() => {
    const out: { icon: React.ElementType; tone: string; text: string }[] = [];
    if (largest && largest.member_count > 0) {
      out.push({ icon: Star, tone: "bg-brand-tint text-brand-ink", text: `${largest.name} is the largest segment with ${largest.member_count.toLocaleString()} members (${largest.pct_of_total}% of the directory).` });
    }
    const fastest = [...segments].sort((a, b) => b.new_30d - a.new_30d)[0];
    if (fastest && fastest.new_30d > 0) {
      out.push({ icon: TrendingUp, tone: "bg-violet-tint text-violet-ink", text: `${fastest.name} grew the most in the last 30 days: ${fastest.new_30d} new member${fastest.new_30d === 1 ? "" : "s"}.` });
    }
    const empty = segments.filter((s) => s.status === "Active" && s.member_count === 0);
    if (empty.length) {
      out.push({ icon: Briefcase, tone: "bg-status-warn-bg text-status-warn-ink", text: `${empty.map((s) => s.name).join(", ")} ${empty.length === 1 ? "has" : "have"} no members yet.` });
    }
    if (data.unsegmented > 0) {
      out.push({ icon: UserX, tone: "bg-status-warn-bg text-status-warn-ink", text: `${data.unsegmented.toLocaleString()} member${data.unsegmented === 1 ? " is" : "s are"} in no active segment.` });
    }
    return out;
  }, [segments, largest, data.unsegmented]);

  function formToRule(f: SegmentForm): SegmentRule {
    const rule: SegmentRule = {};
    const seg = fromSelect(f.segment); if (seg !== undefined) rule.segment = seg;
    const role = fromSelect(f.role); if (role !== undefined) rule.role = role;
    const st = fromSelect(f.memberStatus); if (st !== undefined) rule.status = st;
    return rule;
  }

  function openCreate() {
    setCreateForm(EMPTY_FORM);
    setCreateOpen(true);
  }

  async function submitCreate() {
    const name = createForm.name.trim();
    if (!name) { toast.error("Give the segment a name"); return; }
    setBusy(true);
    try {
      const created = await apiCreateSegmentLive({
        name, desc: createForm.desc.trim(), status: createForm.status, icon: createForm.icon,
        rule: formToRule(createForm),
      });
      toast.success(`${created.name} created`, {
        description: `${created.member_count.toLocaleString()} member${created.member_count === 1 ? "" : "s"} match right now.`,
      });
      setCreateOpen(false);
      await refresh();
    } catch (err) {
      toast.error("Could not create the segment", { description: memberError(err) });
    } finally {
      setBusy(false);
    }
  }

  function openEdit(seg: LiveSegment) {
    setEditTarget(seg);
    setEditForm({
      name: seg.name,
      desc: seg.desc,
      status: seg.status === "Inactive" ? "Inactive" : "Active",
      icon: ICON_MAP[seg.icon] ? seg.icon : "Users",
      segment: toSelect(seg.rule.segment),
      role: toSelect(seg.rule.role),
      memberStatus: toSelect(seg.rule.status),
    });
  }

  async function submitEdit() {
    if (!editTarget) return;
    const name = editForm.name.trim();
    if (!name) { toast.error("Give the segment a name"); return; }
    setBusy(true);
    try {
      const saved = await apiUpdateSegmentLive(editTarget.id, {
        name, desc: editForm.desc.trim(), status: editForm.status, icon: editForm.icon,
        rule: formToRule(editForm),
      });
      toast.success(`${saved.name} saved`, {
        description: `${saved.member_count.toLocaleString()} member${saved.member_count === 1 ? "" : "s"} match now.`,
      });
      setEditTarget(null);
      await refresh();
    } catch (err) {
      toast.error("Could not save the segment", { description: memberError(err) });
    } finally {
      setBusy(false);
    }
  }

  async function deleteSegment(seg: LiveSegment) {
    if (!(await confirm({
      title: `Delete the ${seg.name} segment?`,
      description: "Members stay exactly as they are; only this saved grouping is removed.",
      confirmLabel: "Delete segment",
      danger: true,
    }))) return;
    try {
      await apiDeleteSegmentLive(seg.id);
      toast.success(`${seg.name} deleted`);
      await refresh();
    } catch (err) {
      toast.error("Could not delete the segment", { description: memberError(err) });
    }
  }

  const formFields = (form: SegmentForm, setForm: (f: SegmentForm) => void) => (
    <div className="grid grid-cols-2 gap-4">
      <Input
        className="col-span-2"
        label="Segment name"
        icon={Target}
        required
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        placeholder="e.g. Artisans awaiting review"
      />
      <Textarea
        className="col-span-2"
        label="Description"
        value={form.desc}
        onChange={(e) => setForm({ ...form, desc: e.target.value })}
        placeholder="Who this grouping is for"
        rows={2}
      />
      <div className="col-span-2 rounded-xl border border-line bg-surface-2 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Who belongs</p>
        <p className="mt-0.5 text-xs text-ink-subtle">
          A member is in this segment when every rule below is true. Leave a rule on “Any” to ignore it.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select
            label="Directory segment"
            value={form.segment}
            onChange={(e) => setForm({ ...form, segment: e.target.value })}
            options={ruleOptions(SEGMENT_VALUES, "No segment set")}
          />
          <Select
            label="Role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            options={ruleOptions(ROLE_VALUES, "No role set")}
          />
          <Select
            label="Member status"
            value={form.memberStatus}
            onChange={(e) => setForm({ ...form, memberStatus: e.target.value })}
            options={ruleOptions(STATUS_VALUES, "No status set")}
          />
        </div>
        <p className="mt-2 text-xs text-ink-muted">Matches: <b>{describeRule(formToRule(form))}</b></p>
      </div>
      <Select
        label="Segment status"
        value={form.status}
        onChange={(e) => setForm({ ...form, status: e.target.value as "Active" | "Inactive" })}
        options={["Active", "Inactive"]}
      />
      <Select
        label="Icon"
        value={form.icon}
        onChange={(e) => setForm({ ...form, icon: e.target.value })}
        options={ICON_OPTIONS}
      />
    </div>
  );

  const anyFilter = query.trim() !== "" || statusFilter !== "all";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <Users className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Segments</h1>
            <p className="mt-1 text-sm text-ink-subtle">
              Saved groupings of the members directory. Every count here is taken live.
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus className="h-4 w-4" /> New segment
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Segments" value={String(data.total)} icon={Users} tone="brand"
                  deltaNote={createdThisMonth ? `${createdThisMonth} created this month` : "None created this month"} />
        <StatCard label="Members in directory" value={data.members_total.toLocaleString()} icon={User} tone="violet"
                  deltaNote="Everyone a segment can match" />
        <StatCard label="In no segment" value={data.unsegmented.toLocaleString()} icon={UserX}
                  tone={data.unsegmented > 0 ? "amber" : "emerald"}
                  deltaNote={data.unsegmented > 0 ? "No active segment claims them" : "Every member is covered"} />
        <StatCard label="Active segments" value={String(activeSegments)} icon={TrendingUp} tone="sky"
                  deltaNote={`${data.total ? Math.round((activeSegments / data.total) * 100) : 0}% of segments`} />
        <StatCard label="Largest segment" value={largest && largest.member_count > 0 ? largest.name : "—"} icon={Star} tone="brand"
                  deltaNote={largest && largest.member_count > 0 ? `${largest.member_count.toLocaleString()} members` : "No members matched yet"}
                  valueClassName="text-lg" />
      </div>

      {/* charts */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-4">
        <Card>
          <h2 className="mb-3 font-display text-base font-semibold text-ink">Members by segment</h2>
          {donut.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-subtle">
              {loading ? "Counting…" : "No segment has members yet."}
            </p>
          ) : (
            <div className="flex flex-col items-center">
              <DonutChart data={donut} centerValue={data.members_total.toLocaleString()} centerLabel="Members" size={150} />
            </div>
          )}
        </Card>
        <Card>
          <h2 className="mb-1 font-display text-base font-semibold text-ink">Segment growth</h2>
          <p className="mb-2 text-xs text-ink-subtle">Size at the end of each of the last 8 weeks.</p>
          {growthHasData ? (
            <MultiLine data={growthRows} height={180} id="segment-growth" chartLabel="Segment growth" series={growthSeries} />
          ) : (
            <p className="py-10 text-center text-sm text-ink-subtle">
              {loading ? "Loading…" : "Nothing to plot yet."}
            </p>
          )}
        </Card>
        <Card>
          <h2 className="mb-1 font-display text-base font-semibold text-ink">Active share</h2>
          <p className="mb-2 text-xs text-ink-subtle">Of each segment’s members, how many are Active.</p>
          {activeShare.length ? (
            <BarTrend data={activeShare} height={180} showLabels id="active-share" chartLabel="Active share by segment" />
          ) : (
            <p className="py-10 text-center text-sm text-ink-subtle">No segments yet.</p>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 font-display text-base font-semibold text-ink">What the numbers say</h2>
          {insights.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-subtle">
              {loading ? "Looking…" : "Nothing stands out yet."}
            </p>
          ) : (
            <div className="space-y-3">
              {insights.map((it, i) => (
                <div key={i} className="flex items-start gap-2.5 rounded-xl bg-surface-inset/70 p-3">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${it.tone}`}>
                    <it.icon className="h-4 w-4" />
                  </span>
                  <p className="text-xs text-ink-muted">{it.text}</p>
                </div>
              ))}
              <Link href="/dashboard/analytics" className="flex items-center gap-1.5 text-sm font-semibold text-brand-ink">
                Open analytics <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </Card>
      </div>

      {/* table + side */}
      <ResizableColumns id="users-segments" defaultSize={0.75} className="mt-6 gap-6">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-base font-semibold text-ink">All segments</h2>
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <div className="relative w-48 max-w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search segments…"
                  className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
                />
              </div>
              <Menu
                trigger={
                  <span className="btn btn-sm btn-outline">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    {statusFilter === "all" ? "All statuses" : statusFilter}
                  </span>
                }
                width="w-48"
              >
                <MenuItem onClick={() => setStatusFilter("all")}>All statuses</MenuItem>
                <MenuItem onClick={() => setStatusFilter("Active")}>Active</MenuItem>
                <MenuItem onClick={() => setStatusFilter("Inactive")}>Inactive</MenuItem>
              </Menu>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16"><Spinner /></div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Target}
              title={anyFilter ? "No segment matches that" : "No segments yet"}
              description={anyFilter
                ? "Try a different search, or clear the filter."
                : "Create one to group members by their directory segment, role or status."}
              action={anyFilter
                ? <button className="btn btn-sm btn-outline" onClick={() => { setQuery(""); setStatusFilter("all"); }}>Clear filters</button>
                : <button className="btn btn-sm btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> New segment</button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                    <th scope="col" className="px-2 py-3">Segment</th>
                    <th scope="col" className="px-2 py-3">Who belongs</th>
                    <th scope="col" className="px-2 py-3">Members</th>
                    <th scope="col" className="px-2 py-3">% of total</th>
                    <th scope="col" className="px-2 py-3">Active share</th>
                    <th scope="col" className="whitespace-nowrap px-2 py-3">New (30d)</th>
                    <th scope="col" className="px-2 py-3">Status</th>
                    <th scope="col" className="px-2 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.map((s) => {
                    const Icon = ICON_MAP[s.icon] ?? Users;
                    const up = s.new_30d >= s.prev_30d;
                    return (
                      <tr key={s.id} className="text-sm hover:bg-surface-hover/60">
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-tint text-brand-ink">
                              <Icon className="h-4.5 w-4.5" />
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-ink">{s.name}</p>
                              {s.desc && <p className="max-w-[220px] truncate text-xs text-ink-subtle">{s.desc}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="max-w-[200px] px-2 py-3 text-xs text-ink-subtle">{describeRule(s.rule)}</td>
                        <td className="px-2 py-3 font-medium text-ink-muted">{s.member_count.toLocaleString()}</td>
                        <td className="px-2 py-3 text-ink-subtle">{s.pct_of_total}%</td>
                        <td className="px-2 py-3">
                          <span
                            className="flex h-8 w-11 items-center justify-center rounded-full border-2 text-2xs font-bold"
                            style={{
                              borderColor: s.member_count === 0 ? "var(--color-line-strong)" : s.active_pct >= 70 ? "var(--status-ok-solid)" : s.active_pct >= 40 ? "var(--status-warn-solid)" : "var(--status-danger-solid)",
                              color: s.member_count === 0 ? "var(--color-ink-subtle)" : undefined,
                            }}
                            title={`${s.active_count} of ${s.member_count} are Active`}
                          >
                            {s.member_count === 0 ? "—" : `${Math.round(s.active_pct)}%`}
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          <span
                            className={`flex items-center gap-1 text-xs font-semibold ${up ? "text-status-ok-ink" : "text-status-danger-ink"}`}
                            title={`${s.new_30d} in the last 30 days, ${s.prev_30d} in the 30 before`}
                          >
                            {up ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                            {s.new_30d}
                          </span>
                        </td>
                        <td className="px-2 py-3"><Badge tone={s.status === "Active" ? "emerald" : "slate"}>{s.status}</Badge></td>
                        <td className="px-2 py-3">
                          <Menu
                            trigger={
                              <span className="flex text-ink-subtle hover:text-ink-muted"><MoreHorizontal className="h-4 w-4" /></span>
                            }
                          >
                            <MenuItem icon={Eye} href={membersHref(s.rule)}>View members</MenuItem>
                            <MenuItem icon={Pencil} onClick={() => openEdit(s)}>Edit</MenuItem>
                            <MenuItem icon={Trash2} danger onClick={() => void deleteSegment(s)}>Delete</MenuItem>
                          </Menu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-4 text-sm text-ink-subtle">Showing {filtered.length} of {segments.length} segments</p>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="bg-linear-to-br from-violet-50 to-brand-50">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface text-violet-ink shadow-sm">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">Create a segment</p>
                <p className="text-xs text-ink-subtle">Group members by directory segment, role or status.</p>
              </div>
            </div>
            <button className="btn btn-primary btn-block mt-3" onClick={openCreate}>
              <Plus className="h-4 w-4" /> New segment
            </button>
          </Card>

          <Card>
            <h2 className="mb-3 font-display text-base font-semibold text-ink">Largest segments</h2>
            {bySize.filter((s) => s.member_count > 0).length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-subtle">
                {loading ? "Counting…" : "No segment has members yet."}
              </p>
            ) : (
              <ul className="space-y-2">
                {bySize.filter((s) => s.member_count > 0).slice(0, 4).map((p) => {
                  const Icon = ICON_MAP[p.icon] ?? Users;
                  return (
                    <li key={p.id}>
                      <Link href={membersHref(p.rule)} className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface-hover">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-tint text-brand-ink">
                          <Icon className="h-4.5 w-4.5" />
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-ink">{p.name}</p>
                          <p className="text-xs text-ink-subtle">{p.member_count.toLocaleString()} member{p.member_count === 1 ? "" : "s"}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-ink-faint" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </ResizableColumns>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New segment"
        description="A saved grouping, counted live from the directory."
        icon={Target}
        iconTone="brand"
        size="lg"
        footer={
          <>
            <button className="btn btn-sm btn-outline" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => void submitCreate()}>
              <Plus className="h-4 w-4" /> {busy ? "Creating…" : "Create segment"}
            </button>
          </>
        }
      >
        {formFields(createForm, setCreateForm)}
      </Modal>

      <Modal
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title="Edit segment"
        description="Changing the rule changes who is counted, immediately."
        icon={Target}
        iconTone="brand"
        size="lg"
        footer={
          <>
            <button className="btn btn-sm btn-outline" onClick={() => setEditTarget(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => void submitEdit()}>
              <Check className="h-4 w-4" /> {busy ? "Saving…" : "Save changes"}
            </button>
          </>
        }
      >
        {formFields(editForm, setEditForm)}
      </Modal>
    </div>
  );
}
