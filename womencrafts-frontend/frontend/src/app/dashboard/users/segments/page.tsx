"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  User,
  Target,
  TrendingUp,
  Star,
  Calendar,
  ChevronDown,
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
} from "lucide-react";
import Link from "next/link";
import { Badge, Card, Input, Menu, MenuItem, Modal, Pagination, Select, StatCard, Textarea, useToast, useConfirm } from "@/design-system";
import DonutChart from "@/components/charts/DonutChart";
import MultiLine from "@/components/charts/MultiLine";
import BarTrend from "@/components/charts/BarTrend";
import {
  apiListSegments,
  apiCreateSegment,
  apiUpdateSegment,
  apiDeleteSegment,
  type ApiSegment,
} from "@/lib/api";
import { memberError } from "@/lib/member-api";
import { ResizableColumns } from "@/layout-engine";

// Fixed brand colour per segment name (charts are a frontend concern).
const SEG_COLORS: Record<string, string> = {
  Entrepreneurs: "var(--color-brand-600)",
  Instructors: "var(--color-violet-500)",
  Students: "var(--color-brand-300)",
  Artisans: "var(--status-warn-solid)",
  "Support Seekers": "var(--status-ok-solid)",
  "Job Seekers": "var(--status-info-solid)",
  Others: "var(--color-violet-300)",
};

const GROWTH = ["Apr 20", "Apr 27", "May 4", "May 11", "May 18", "May 25"].map((label, i) => ({
  label,
  Entrepreneurs: 2000 + i * 260,
  Instructors: 1500 + i * 130,
  Students: 1200 + i * 170,
  Artisans: 900 + i * 90,
}));

type SegmentStatus = "Active" | "Inactive";

type Segment = {
  _id: string;
  iconName: string;
  icon: React.ElementType;
  name: string;
  desc: string;
  users: string;
  pct: string;
  eng: number;
  growth: string;
  up: boolean;
  status: SegmentStatus;
};

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

function toSegment(s: ApiSegment): Segment {
  return {
    _id: s.id,
    iconName: s.icon,
    icon: ICON_MAP[s.icon] ?? Users,
    name: s.name,
    desc: s.desc,
    users: s.users,
    pct: s.pct,
    eng: s.eng,
    growth: s.growth,
    up: s.up,
    status: (s.status as SegmentStatus) || "Active",
  };
}

const parseCount = (s: string) => Number(String(s).replace(/[^0-9.]/g, "")) || 0;

const INSIGHTS = [
  { tone: "brand", icon: TrendingUp, text: "Entrepreneurs segment has the highest growth (18.6%) this month." },
  { tone: "violet", icon: Users, text: "Students segment engagement increased by 12% compared to last month." },
  { tone: "amber", icon: Briefcase, text: "Job Seekers segment needs more engagement." },
];

const TONE_BG: Record<string, string> = {
  brand: "bg-brand-tint text-brand-ink",
  violet: "bg-violet-tint text-violet-ink",
  amber: "bg-status-warn-bg text-status-warn-ink",
};

function engColor(v: number) {
  if (v >= 70) return "var(--status-ok-solid)";
  if (v >= 55) return "var(--status-warn-solid)";
  return "var(--status-danger-solid)";
}

type StatusFilter = "all" | "Active" | "Inactive";
type EngFilter = "all" | "high" | "medium" | "low";

type GrowthTrend = "Up" | "Down";

type SegmentForm = {
  name: string;
  desc: string;
  minEng: string;
  status: SegmentStatus;
  trend: GrowthTrend;
};

const EMPTY_FORM: SegmentForm = { name: "", desc: "", minEng: "0", status: "Active", trend: "Up" };

export default function UserSegmentsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [engFilter, setEngFilter] = useState<EngFilter>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<SegmentForm>(EMPTY_FORM);

  const [editTarget, setEditTarget] = useState<Segment | null>(null);
  const [editForm, setEditForm] = useState<SegmentForm>(EMPTY_FORM);

  const refresh = useCallback(async () => {
    try {
      const list = await apiListSegments();
      setSegments(list.items.map(toSegment));
    } catch {
      /* keep current segments */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return segments.filter((s) => {
      const matchesQuery =
        !q || s.name.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || s.status === statusFilter;
      const matchesEng =
        engFilter === "all" ||
        (engFilter === "high" && s.eng >= 70) ||
        (engFilter === "medium" && s.eng >= 55 && s.eng < 70) ||
        (engFilter === "low" && s.eng < 55);
      return matchesQuery && matchesStatus && matchesEng;
    });
  }, [segments, query, statusFilter, engFilter]);

  // Live figures for the stat cards + charts.
  const totalUsers = useMemo(
    () => segments.reduce((sum, s) => sum + parseCount(s.users), 0),
    [segments],
  );
  const avgEng = segments.length
    ? Math.round((segments.reduce((sum, s) => sum + s.eng, 0) / segments.length) * 10) / 10
    : 0;
  const activeSegments = segments.filter((s) => s.status === "Active").length;
  const topSegment = useMemo(
    () => [...segments].sort((a, b) => parseCount(b.users) - parseCount(a.users))[0] ?? null,
    [segments],
  );
  const segDonut = segments.map((s) => ({
    name: s.name,
    value: parseCount(s.users),
    color: SEG_COLORS[s.name] ?? "var(--color-violet-300)",
  }));
  const engageData = segments.map((s) => ({ label: s.name, value: s.eng, color: engColor(s.eng) }));
  const popularData = useMemo(
    () => [...segments].sort((a, b) => parseCount(b.users) - parseCount(a.users)).slice(0, 4),
    [segments],
  );

  function openCreate() {
    setCreateForm(EMPTY_FORM);
    setCreateOpen(true);
  }

  async function submitCreate() {
    const name = createForm.name.trim();
    if (!name) return;
    const eng = Math.max(0, Math.min(100, Number(createForm.minEng) || 0));
    try {
      await apiCreateSegment({
        name,
        desc: createForm.desc.trim() || "New user segment.",
        users: "0",
        pct: "0.0%",
        eng,
        growth: "0.0%",
        up: createForm.trend === "Up",
        status: createForm.status,
        icon: "Users",
      });
      await refresh();
      setCreateOpen(false);
    } catch (err) {
      toast.error("Could not create the segment", { description: memberError(err) });
    }
  }

  function openEdit(seg: Segment) {
    setEditTarget(seg);
    setEditForm({
      name: seg.name,
      desc: seg.desc,
      minEng: String(seg.eng),
      status: seg.status,
      trend: seg.up ? "Up" : "Down",
    });
  }

  async function submitEdit() {
    if (!editTarget) return;
    const name = editForm.name.trim();
    if (!name) return;
    const eng = Math.max(0, Math.min(100, Number(editForm.minEng) || 0));
    try {
      await apiUpdateSegment(editTarget._id, {
        name,
        desc: editForm.desc.trim() || editTarget.desc,
        eng,
        status: editForm.status,
        up: editForm.trend === "Up",
      });
      await refresh();
      setEditTarget(null);
    } catch (err) {
      toast.error("Could not save the segment", { description: memberError(err) });
    }
  }

  async function deleteSegment(name: string) {
    if (!(await confirm({
      title: `Delete the ${name} segment?`,
      description: "Members stay; only the saved grouping is removed.",
      confirmLabel: "Delete segment",
      danger: true,
    }))) return;
    const seg = segments.find((s) => s.name === name);
    if (!seg) return;
    try {
      await apiDeleteSegment(seg._id);
      await refresh();
    } catch (err) {
      toast.error("Could not delete the segment", { description: memberError(err) });
    }
  }

  const formFields = (form: SegmentForm, setForm: (f: SegmentForm) => void) => (
    <div className="grid grid-cols-2 gap-4">
      <Input
        className="col-span-2"
        label="Segment Name"
        icon={Target}
        required
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        placeholder="e.g. Power Users"
      />
      <Textarea
        className="col-span-2"
        label="Description"
        required
        value={form.desc}
        onChange={(e) => setForm({ ...form, desc: e.target.value })}
        placeholder="Describe this segment"
        rows={2}
      />
      <Input
        label="Min Engagement"
        type="number"
        min={0}
        max={100}
        value={form.minEng}
        onChange={(e) => setForm({ ...form, minEng: e.target.value })}
        placeholder="0"
      />
      <Select
        label="Status"
        value={form.status}
        onChange={(e) => setForm({ ...form, status: e.target.value as SegmentStatus })}
        options={["Active", "Inactive"]}
      />
      <Select
        className="col-span-2"
        label="Growth trend"
        icon={TrendingUp}
        value={form.trend}
        onChange={(e) => setForm({ ...form, trend: e.target.value as GrowthTrend })}
        options={["Up", "Down"]}
      />
    </div>
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <Users className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">User Segments</h1>
            <p className="mt-1 text-sm text-ink-subtle">Understand your users better with smart segmentation.</p>
          </div>
        </div>
        <button className="btn btn-sm btn-outline">
          <Calendar className="h-4 w-4 text-ink-subtle" /> May 20, 2024 - May 26, 2024
          <ChevronDown className="h-4 w-4 text-ink-subtle" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total Segments" value={String(segments.length)} icon={Users} tone="brand" delta="1" deltaNote="new this month" />
        <StatCard label="Total Users" value={totalUsers.toLocaleString()} icon={User} tone="violet" delta="12.5%" />
        <StatCard label="Avg. Engagement Score" value={String(avgEng)} icon={Target} tone="amber" delta="8.7%" />
        <StatCard label="Active Segments" value={String(activeSegments)} icon={TrendingUp} tone="sky" deltaNote={`${segments.length ? Math.round((activeSegments / segments.length) * 100) : 0}% of total segments`} />
        <StatCard label="Top Segment" value={topSegment?.name ?? "—"} icon={Star} tone="brand" deltaNote={topSegment ? `${topSegment.users} users` : ""} valueClassName="text-lg" />
      </div>

      {/* charts */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-4">
        <Card>
          <h2 className="mb-3 font-display text-base font-semibold text-ink">Users by Segment</h2>
          <div className="flex flex-col items-center">
            <DonutChart data={segDonut} centerValue={totalUsers.toLocaleString()} centerLabel="Total Users" size={150} />
          </div>
        </Card>
        <Card>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-ink">Segment Growth</h2>
          </div>
          <MultiLine
            data={GROWTH}
            height={180}
            id="segment-growth"
            chartLabel="Segment growth"
            series={[
              { key: "Entrepreneurs", color: "var(--color-brand-600)" },
              { key: "Instructors", color: "var(--color-violet-500)" },
              { key: "Students", color: "var(--status-warn-solid)" },
              { key: "Artisans", color: "var(--status-ok-solid)" },
            ]}
          />
        </Card>
        <Card>
          <h2 className="mb-1 font-display text-base font-semibold text-ink">Engagement by Segment</h2>
          <BarTrend data={engageData} height={180} showLabels id="engagement" chartLabel="Engagement" />
        </Card>
        <Card>
          <h2 className="mb-3 font-display text-base font-semibold text-ink">Segment Insights</h2>
          <div className="space-y-3">
            {INSIGHTS.map((it, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-xl bg-surface-inset/70 p-3">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONE_BG[it.tone]}`}>
                  <it.icon className="h-4 w-4" />
                </span>
                <p className="text-xs text-ink-muted">{it.text}</p>
              </div>
            ))}
            <Link href="/dashboard/analytics" className="flex items-center gap-1.5 text-sm font-semibold text-brand-ink">
              View Detailed Insights <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Card>
      </div>

      {/* table + side */}
      <ResizableColumns id="users-segments" defaultSize={0.75} className="mt-6 gap-6">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-base font-semibold text-ink">All User Segments</h2>
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <div className="relative w-48 max-w-full">
                <span className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                </span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search segments..."
                  className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
                />
              </div>
              <Menu
                trigger={
                  <span className="btn btn-sm btn-outline">
                    <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
                  </span>
                }
                width="w-52"
              >
                <p className="px-3 py-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-subtle">Status</p>
                <MenuItem onClick={() => setStatusFilter("all")}>All Statuses</MenuItem>
                <MenuItem onClick={() => setStatusFilter("Active")}>Active</MenuItem>
                <MenuItem onClick={() => setStatusFilter("Inactive")}>Inactive</MenuItem>
                <p className="px-3 py-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-subtle">Engagement</p>
                <MenuItem onClick={() => setEngFilter("all")}>All Engagement</MenuItem>
                <MenuItem onClick={() => setEngFilter("high")}>High (&ge;70)</MenuItem>
                <MenuItem onClick={() => setEngFilter("medium")}>Medium (55&ndash;69)</MenuItem>
                <MenuItem onClick={() => setEngFilter("low")}>Low (&lt;55)</MenuItem>
              </Menu>
              <button className="btn btn-primary" onClick={openCreate}>
                <Plus className="h-4 w-4" /> New Segment
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                  <th scope="col" className="px-2 py-3">Segment Name</th>
                  <th scope="col" className="px-2 py-3">Description</th>
                  <th scope="col" className="px-2 py-3">Users</th>
                  <th scope="col" className="px-2 py-3">% of Total</th>
                  <th scope="col" className="px-2 py-3">Avg. Engagement</th>
                  <th scope="col" className="px-2 py-3">Growth (MoM)</th>
                  <th scope="col" className="px-2 py-3">Status</th>
                  <th scope="col" className="px-2 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((s) => (
                  <tr key={s.name} className="text-sm hover:bg-surface-hover/60">
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-tint text-brand-ink">
                          <s.icon className="h-4.5 w-4.5" />
                        </span>
                        <span className="font-semibold text-ink">{s.name}</span>
                      </div>
                    </td>
                    <td className="max-w-[180px] px-2 py-3 text-xs text-ink-subtle">{s.desc}</td>
                    <td className="px-2 py-3 font-medium text-ink-muted">{s.users}</td>
                    <td className="px-2 py-3 text-ink-subtle">{s.pct}</td>
                    <td className="px-2 py-3">
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-full border-2 text-2xs font-bold"
                        style={{ borderColor: engColor(s.eng), color: engColor(s.eng) }}
                      >
                        {s.eng}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <span className={`flex items-center gap-1 text-xs font-semibold ${s.up ? "text-status-ok-ink" : "text-status-danger-ink"}`}>
                        {s.up ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                        {s.growth}
                      </span>
                    </td>
                    <td className="px-2 py-3"><Badge tone={s.status === "Active" ? "emerald" : "slate"}>{s.status}</Badge></td>
                    <td className="px-2 py-3">
                      <Menu
                        trigger={
                          <span className="flex text-ink-subtle hover:text-ink-muted"><MoreHorizontal className="h-4 w-4" /></span>
                        }
                      >
                        <MenuItem icon={Eye} href={`/dashboard/users?segment=${encodeURIComponent(s.name)}`}>
                          View users
                        </MenuItem>
                        <MenuItem icon={Pencil} onClick={() => openEdit(s)}>
                          Edit
                        </MenuItem>
                        <MenuItem icon={Trash2} danger onClick={() => deleteSegment(s.name)}>
                          Delete
                        </MenuItem>
                      </Menu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={1} pageCount={1} onPageChange={() => {}} showing={`Showing ${filtered.length} of ${segments.length} segments`} />
        </Card>

        <div className="space-y-6">
          <Card className="bg-linear-to-br from-violet-50 to-brand-50">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface text-violet-ink shadow-sm">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">Create New Segment</p>
                <p className="text-xs text-ink-subtle">Build a new user segment based on custom criteria.</p>
              </div>
            </div>
            <button className="btn btn-primary btn-block mt-3" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Create Segment
            </button>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-ink">Popular Segments</h2>
              <button className="text-xs font-semibold text-brand-ink transition hover:underline" onClick={() => setQuery("")}>View All</button>
            </div>
            <ul className="space-y-2">
              {popularData.map((p) => (
                <li key={p.name}>
                  <Link href={`/dashboard/users?segment=${encodeURIComponent(p.name)}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface-hover">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-tint text-brand-ink">
                      <p.icon className="h-4.5 w-4.5" />
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-ink">{p.name}</p>
                      <p className="text-xs text-ink-subtle">{p.users} users</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-ink-faint" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </ResizableColumns>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create New Segment"
        description="Group users by shared traits and behavior."
        icon={Target}
        iconTone="brand"
        footer={
          <>
            <button className="btn btn-sm btn-outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={submitCreate}>
              <Plus className="h-4 w-4" /> Create Segment
            </button>
          </>
        }
      >
        {formFields(createForm, setCreateForm)}
      </Modal>

      <Modal
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title="Edit Segment"
        description="Group users by shared traits and behavior."
        icon={Target}
        iconTone="brand"
        footer={
          <>
            <button className="btn btn-sm btn-outline" onClick={() => setEditTarget(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={submitEdit}>
              <Check className="h-4 w-4" /> Save Changes
            </button>
          </>
        }
      >
        {formFields(editForm, setEditForm)}
      </Modal>
    </div>
  );
}
