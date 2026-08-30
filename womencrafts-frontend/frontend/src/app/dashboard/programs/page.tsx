"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  GraduationCap,
  CircleCheck,
  Hourglass,
  UsersRound,
  Star,
  Plus,
  Search,
  SlidersHorizontal,
  RotateCcw,
  ChevronDown,
  Calendar,
  Globe,
  MapPin,
  Boxes,
  List,
  LayoutGrid,
  MoreVertical,
  PlayCircle,
  Eye,
  Pencil,
  Archive,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import {
  Badge,
  Card,
  Input,
  Menu,
  MenuItem,
  Modal,
  Pagination,
  ProgressBar,
  Select,
  StatCard,
  Textarea,
  Thumb, useConfirm, useToast } from "@/design-system";
import AreaTrend from "@/components/charts/AreaTrend";
import {
  apiListPrograms,
  apiProgramStats,
  apiProgramOverview,
  apiProgramCategories,
  apiCreateProgram,
  apiUpdateProgram,
  apiDeleteProgram,
  apiCompleteProgram,
  apiArchiveProgram,
  type ApiProgram,
  type ProgramStats,
  type ProgramOverview,
  type ProgramCategory,
} from "@/lib/programs-api";
import { memberError } from "@/lib/member-api";
import { ResizableColumns } from "@/layout-engine";

// Fallback overview series shown until the live /programs/overview data loads.
const OVERVIEW = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"].map((label, i) => ({
  label,
  value: [40, 55, 48, 70, 66, 82, 78, 90][i],
}));

type CatTone = "violet" | "brand" | "amber" | "sky" | "emerald";
type ModeName = "Online" | "Offline" | "Hybrid";

type Program = {
  _id: string; // mongo id — used for update / delete / status calls
  name: string;
  desc: string;
  category: string;
  cat_tone: CatTone;
  mode: string;
  modeIcon: React.ElementType;
  duration: string;
  dates: string;
  days: string;
  enrolled: number;
  cap: number;
  pct: number;
  status: string;
  note: string;
  bar: string;
};

// Map a backend program (ApiProgram) to the exact UI shape the screen renders.
// Icons are stored as a mode NAME on the backend; map them back to a lucide
// component via MODE_ICON_BY_NAME. cat_tone/bar come precomputed from the API.
function toProgram(p: ApiProgram): Program {
  return {
    _id: p.id,
    name: p.name,
    desc: p.desc,
    category: p.category,
    cat_tone: (p.cat_tone as CatTone) || "violet",
    mode: p.mode,
    modeIcon: MODE_ICON_BY_NAME[p.mode] ?? Globe,
    duration: p.duration,
    dates: p.dates,
    days: p.days,
    enrolled: p.enrolled,
    cap: p.cap,
    pct: p.pct,
    status: p.status,
    note: p.note,
    bar: p.bar,
  };
}

const CATEGORIES = [
  { name: "Digital Literacy", value: 90, color: "var(--color-violet-500)" },
  { name: "Entrepreneurship", value: 72, color: "var(--color-brand-600)" },
  { name: "Handicrafts", value: 60, color: "var(--status-warn-solid)" },
  { name: "Personal Development", value: 45, color: "var(--status-info-solid)" },
  { name: "Sustainability", value: 38, color: "var(--status-ok-solid)" },
];

const STATUS_TONE: Record<string, "emerald" | "amber" | "sky" | "slate"> = {
  Active: "emerald",
  Upcoming: "amber",
  Completed: "sky",
  Draft: "slate",
  Archived: "slate",
};

const TABS = ["All Programs", "Active", "Upcoming", "Completed", "Draft", "Archived"];

const CATEGORY_OPTIONS = [
  "Digital Literacy",
  "Entrepreneurship",
  "Handicrafts",
  "Personal Development",
  "Sustainability",
];
const MODE_OPTIONS: ModeName[] = ["Online", "Offline", "Hybrid"];
const STATUS_OPTIONS = ["Active", "Upcoming", "Completed", "Draft"];

const MODE_ICON_BY_NAME: Record<string, React.ElementType> = {
  Online: Globe,
  Offline: MapPin,
  Hybrid: Boxes,
};

type SortKey = "Newest First" | "Oldest First" | "Most Enrolled";

const emptyForm = {
  name: "",
  desc: "",
  category: "",
  mode: "",
  duration: "",
  cap: "",
  startDate: "",
  days: "",
  status: "",
};
type FormState = typeof emptyForm;

export default function ProgramsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ProgramStats | null>(null);
  const [overview, setOverview] = useState<ProgramOverview | null>(null);
  const [categories, setCategories] = useState<ProgramCategory[]>([]);

  // filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All Status");
  const [categoryFilter, setCategoryFilter] = useState<string>("All Categories");
  const [modeFilter, setModeFilter] = useState<string>("All Modes");
  const [activeTab, setActiveTab] = useState<string>("All Programs");

  // view / sort / page
  const [view, setView] = useState<"list" | "grid">("list");
  const [sort, setSort] = useState<SortKey>("Newest First");
  const [page, setPage] = useState<string>("1");
  const PER_PAGE = 8;

  // rail
  const [overviewRange, setOverviewRange] = useState<string>("This Month");

  // modals
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [detail, setDetail] = useState<Program | null>(null);

  // Load programs + KPI stats + top categories from the backend. Filtering,
  // search, tabs, sort and pagination all stay client-side (as before).
  const refresh = useCallback(async () => {
    try {
      const [list, s, cats] = await Promise.all([
        apiListPrograms({ page_size: 100, sort: "Newest First" }),
        apiProgramStats(),
        apiProgramCategories(),
      ]);
      setPrograms(list.items.map(toProgram));
      setStats(s);
      setCategories(cats);
    } catch {
      /* keep current programs; a toast could surface the error */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // The Program Overview trend re-fetches whenever its range changes.
  useEffect(() => {
    let active = true;
    apiProgramOverview(overviewRange)
      .then((ov) => {
        if (active) setOverview(ov);
      })
      .catch(() => {
        /* keep current overview */
      });
    return () => {
      active = false;
    };
  }, [overviewRange]);

  const setField = (key: keyof FormState) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setCreateOpen(true);
  };

  const openEdit = (p: Program) => {
    setEditingId(p._id);
    setForm({
      name: p.name,
      desc: p.desc,
      category: p.category,
      mode: p.mode,
      duration: p.duration,
      cap: String(p.cap),
      startDate: "",
      days: p.days,
      status: p.status,
    });
    setCreateOpen(true);
  };

  const submitForm = async () => {
    if (!form.name.trim()) return;
    const category = form.category || "Digital Literacy";
    const mode = form.mode || "Online";
    const status = form.status || "Draft";
    const capNum = Number(form.cap) || 0;
    const payload = {
      name: form.name.trim(),
      desc: form.desc,
      category,
      mode,
      duration: form.duration,
      cap: capNum,
      startDate: form.startDate,
      days: form.days,
      status,
    };

    try {
      if (editingId) {
        await apiUpdateProgram(editingId, payload);
      } else {
        await apiCreateProgram(payload);
      }
      await refresh();
      setCreateOpen(false);
    } catch (err) {
      toast.error("Could not save the programme", { description: memberError(err) });
    }
  };

  const markCompleted = async (id: string) => {
    try {
      await apiCompleteProgram(id);
      await refresh();
    } catch (err) {
      toast.error("Could not mark it completed", { description: memberError(err) });
    }
    setDetail(null);
  };

  const archiveProgram = async (id: string) => {
    try {
      await apiArchiveProgram(id);
      await refresh();
    } catch (err) {
      toast.error("Could not archive the programme", { description: memberError(err) });
    }
    setDetail(null);
  };

  const deleteProgram = async (id: string) => {
    if (!(await confirm({
      title: "Delete this programme?",
      description: "Enrolments and sessions attached to it go too. This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    }))) return;
    try {
      await apiDeleteProgram(id);
      await refresh();
      toast.success("Programme deleted");
    } catch (err) {
      toast.error("Could not delete the programme", { description: memberError(err) });
    }
    setDetail(null);
  };

  const selectTab = (tab: string) => {
    setActiveTab(tab);
    // keep status filter in sync with meaningful tabs
    if (tab === "Active") setStatusFilter("Active");
    else if (tab === "Upcoming") setStatusFilter("Upcoming");
    else if (tab === "Completed") setStatusFilter("Completed");
    else if (tab === "Draft") setStatusFilter("Draft");
    else if (tab === "All Programs") setStatusFilter("All Status");
  };

  const resetAll = () => {
    setSearch("");
    setStatusFilter("All Status");
    setCategoryFilter("All Categories");
    setModeFilter("All Modes");
    setActiveTab("All Programs");
    setPage("1");
  };

  const matching = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = programs.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !p.desc.toLowerCase().includes(q))
        return false;
      if (statusFilter !== "All Status" && p.status !== statusFilter) return false;
      if (categoryFilter !== "All Categories" && p.category !== categoryFilter) return false;
      if (modeFilter !== "All Modes" && p.mode !== modeFilter) return false;
      // tab acts as an additional status gate (All Programs = no gate)
      if (activeTab !== "All Programs" && p.status !== activeTab) return false;
      return true;
    });
    list = [...list];
    if (sort === "Oldest First") list.reverse();
    else if (sort === "Most Enrolled") list.sort((a, b) => b.enrolled - a.enrolled);
    return list;
  }, [programs, search, statusFilter, categoryFilter, modeFilter, activeTab, sort]);

  const pageCount = Math.max(1, Math.ceil(matching.length / PER_PAGE));
  const current = Math.min(Math.max(Number(page) || 1, 1), pageCount);
  const visible = useMemo(
    () => matching.slice((current - 1) * PER_PAGE, current * PER_PAGE),
    [matching, current],
  );
  const showingLabel = matching.length
    ? `Showing ${(current - 1) * PER_PAGE + 1} to ${Math.min(current * PER_PAGE, matching.length)} of ${matching.length} programs`
    : "No programs match these filters";

  const menuLabel = (current: string, all: string) => (current === all ? all : current);

  const detailPct = detail && detail.cap ? Math.round((detail.enrolled / detail.cap) * 100) : detail?.pct ?? 0;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Programs</h1>
          <p className="mt-1 text-sm text-ink-subtle">
            Create, manage and monitor all programs that empower women through learning and development.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Create New Program
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <button type="button" className="w-full text-left" onClick={() => { setStatusFilter("All Status"); setActiveTab("All Programs"); }}>
          <StatCard label="Total Programs" value={(stats?.total_programs ?? 32).toLocaleString()} icon={GraduationCap} tone="violet" deltaNote="All active and draft programs" />
        </button>
        <button type="button" className="w-full text-left" onClick={() => { setStatusFilter("Active"); setActiveTab("Active"); }}>
          <StatCard label="Active Programs" value={(stats?.active_programs ?? 24).toLocaleString()} icon={CircleCheck} tone="emerald" deltaNote="Currently running programs" />
        </button>
        <button type="button" className="w-full text-left" onClick={() => { setStatusFilter("Upcoming"); setActiveTab("Upcoming"); }}>
          <StatCard label="Upcoming Programs" value={(stats?.upcoming_programs ?? 5).toLocaleString()} icon={Hourglass} tone="amber" deltaNote="Starting in next 30 days" />
        </button>
        <button type="button" className="w-full text-left" onClick={() => setDetail(null)}>
          <StatCard label="Total Enrollments" value={(stats?.total_enrollments ?? 1248).toLocaleString()} icon={UsersRound} tone="sky" deltaNote="Across all programs" />
        </button>
        <button type="button" className="w-full text-left" onClick={() => setDetail(null)}>
          <StatCard label="Completion Rate" value={`${stats?.completion_rate ?? 78}%`} icon={Star} tone="brand" deltaNote="Average program completion" />
        </button>
      </div>

      {/* filter bar */}
      <Card className="mt-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search programs..."
              className="w-full rounded-lg border border-line-strong py-2 pl-9 pr-3 text-sm outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
            />
          </div>

          <label className="text-xs">
            <span className="mb-1 block font-medium text-ink-subtle">Status</span>
            <Menu
              align="left"
              trigger={
                <button className="btn btn-sm btn-outline w-36 justify-between">
                  {menuLabel(statusFilter, "All Status")} <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" />
                </button>
              }
            >
              <MenuItem onClick={() => setStatusFilter("All Status")}>All Status</MenuItem>
              {STATUS_OPTIONS.map((s) => (
                <MenuItem key={s} onClick={() => setStatusFilter(s)}>{s}</MenuItem>
              ))}
            </Menu>
          </label>

          <label className="text-xs">
            <span className="mb-1 block font-medium text-ink-subtle">Categories</span>
            <Menu
              align="left"
              trigger={
                <button className="btn btn-sm btn-outline w-36 justify-between">
                  {menuLabel(categoryFilter, "All Categories")} <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" />
                </button>
              }
            >
              <MenuItem onClick={() => setCategoryFilter("All Categories")}>All Categories</MenuItem>
              {CATEGORY_OPTIONS.map((c) => (
                <MenuItem key={c} onClick={() => setCategoryFilter(c)}>{c}</MenuItem>
              ))}
            </Menu>
          </label>

          <label className="text-xs">
            <span className="mb-1 block font-medium text-ink-subtle">Modes</span>
            <Menu
              align="left"
              trigger={
                <button className="btn btn-sm btn-outline w-36 justify-between">
                  {menuLabel(modeFilter, "All Modes")} <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" />
                </button>
              }
            >
              <MenuItem onClick={() => setModeFilter("All Modes")}>All Modes</MenuItem>
              {MODE_OPTIONS.map((m) => (
                <MenuItem key={m} onClick={() => setModeFilter(m)}>{m}</MenuItem>
              ))}
            </Menu>
          </label>

          <Menu
            align="right"
            trigger={
              <button className="btn btn-sm btn-outline">
                <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
              </button>
            }
          >
            <MenuItem onClick={() => setStatusFilter("Active")}>Only Active</MenuItem>
            <MenuItem onClick={() => setSort("Most Enrolled")}>Most Enrolled first</MenuItem>
            <MenuItem onClick={() => setModeFilter("Online")}>Online only</MenuItem>
            <MenuItem danger onClick={resetAll}>Clear all filters</MenuItem>
          </Menu>

          <button className="btn btn-sm btn-outline" onClick={resetAll}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
        </div>
      </Card>

      {/* tabs + sort */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-5 text-sm">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => selectTab(t)}
              className={`-mb-px border-b-2 pb-2 font-medium ${
                activeTab === t ? "border-violet-600 text-violet-ink" : "border-transparent text-ink-subtle hover:text-ink-muted"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-subtle">Sort by</span>
          <Menu
            align="right"
            trigger={
              <button className="btn btn-sm btn-outline">
                {sort} <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" />
              </button>
            }
          >
            <MenuItem onClick={() => setSort("Newest First")}>Newest First</MenuItem>
            <MenuItem onClick={() => setSort("Oldest First")}>Oldest First</MenuItem>
            <MenuItem onClick={() => setSort("Most Enrolled")}>Most Enrolled</MenuItem>
          </Menu>
          <div className="flex items-center rounded-lg border border-line-strong p-0.5">
            <button
              aria-label="List view"
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
              className={`rounded-md p-1.5 ${view === "list" ? "bg-violet-tint text-violet-ink" : "text-ink-subtle"}`}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              aria-label="Grid view"
              aria-pressed={view === "grid"}
              onClick={() => setView("grid")}
              className={`rounded-md p-1.5 ${view === "grid" ? "bg-violet-tint text-violet-ink" : "text-ink-subtle"}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <ResizableColumns id="programs" defaultSize={0.74} className="mt-4 gap-6">
        {/* main */}
        {view === "list" ? (
          <Card padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-215 text-left">
                <thead>
                  <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                    <th scope="col" className="px-4 py-3">Program</th>
                    <th scope="col" className="px-2 py-3">Category</th>
                    <th scope="col" className="px-2 py-3">Delivery Mode</th>
                    <th scope="col" className="whitespace-nowrap px-2 py-3">Duration</th>
                    <th scope="col" className="whitespace-nowrap px-2 py-3">Schedule</th>
                    <th scope="col" className="px-2 py-3">Enrollments</th>
                    <th scope="col" className="px-2 py-3">Status</th>
                    <th scope="col" className="px-2 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {loading && programs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-16 text-center text-sm text-ink-subtle">
                        Loading programs…
                      </td>
                    </tr>
                  ) : visible.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-16 text-center">
                        <div className="mx-auto flex max-w-xs flex-col items-center">
                          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-tint text-violet-ink">
                            <GraduationCap className="h-6 w-6" />
                          </span>
                          <p className="mt-3 text-sm font-semibold text-ink-muted">No programs found</p>
                          <p className="mt-1 text-xs text-ink-subtle">
                            Try adjusting your filters or create a new program to get started.
                          </p>
                          <button className="btn btn-primary btn-sm mt-4" onClick={openCreate}>
                            <Plus className="h-4 w-4" /> Create New Program
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    visible.map((p) => (
                      <tr
                        key={p._id}
                        onClick={() => setDetail(p)}
                        className="cursor-pointer align-top text-sm hover:bg-surface-hover/60"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-3">
                            <Thumb seed={p.name} alt={p.name} className="h-11 w-11 rounded-lg" />
                            <div className="max-w-[190px]">
                              <p className="font-semibold text-ink">{p.name}</p>
                              <p className="text-xs text-ink-subtle">{p.desc}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-3"><Badge tone={p.cat_tone}>{p.category}</Badge></td>
                        <td className="px-2 py-3">
                          <span className="flex items-center gap-1.5 text-ink-muted">
                            <p.modeIcon className="h-4 w-4 text-violet-ink" /> {p.mode}
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          <span className="flex items-center gap-1.5 whitespace-nowrap text-ink-muted">
                            <Calendar className="h-4 w-4 text-ink-subtle" /> {p.duration}
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          <p className="whitespace-nowrap text-ink-muted">{p.dates}</p>
                          <p className="text-xs text-ink-subtle">{p.days}</p>
                        </td>
                        <td className="px-2 py-3">
                          <p className="text-ink-muted">
                            <span className="font-semibold">{p.enrolled}</span> / {p.cap}
                          </p>
                          <ProgressBar value={p.pct} color={p.bar} className="mt-1.5 w-24" />
                          <p className="mt-0.5 text-right text-2xs text-ink-subtle">{p.pct}%</p>
                        </td>
                        <td className="px-2 py-3">
                          <Badge tone={STATUS_TONE[p.status] ?? "slate"}>{p.status}</Badge>
                          <p className="mt-1 text-2xs text-ink-subtle">{p.note}</p>
                        </td>
                        <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                          <Menu
                            align="right"
                            trigger={
                              <button aria-label={`More actions for ${p.name}`} className="text-ink-subtle hover:text-ink-muted"><MoreVertical className="h-4 w-4" /></button>
                            }
                          >
                            <MenuItem icon={Eye} onClick={() => setDetail(p)}>View details</MenuItem>
                            <MenuItem icon={Pencil} onClick={() => openEdit(p)}>Edit</MenuItem>
                            <MenuItem icon={UsersRound} onClick={() => setDetail(p)}>Manage Enrollments</MenuItem>
                            <MenuItem icon={Archive} onClick={() => archiveProgram(p._id)}>Archive</MenuItem>
                            <MenuItem icon={Trash2} danger onClick={() => deleteProgram(p._id)}>Delete</MenuItem>
                          </Menu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              className="px-4 pb-3"
              page={Number(page) || 1}
              pageCount={pageCount}
              onPageChange={(n) => setPage(String(n))}
              showing={showingLabel}
            />
          </Card>
        ) : (
          <div>
            {loading && programs.length === 0 ? (
              <Card>
                <div className="py-12 text-center text-sm text-ink-subtle">Loading programs…</div>
              </Card>
            ) : visible.length === 0 ? (
              <Card>
                <div className="mx-auto flex max-w-xs flex-col items-center py-12 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-tint text-violet-ink">
                    <GraduationCap className="h-6 w-6" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-ink-muted">No programs found</p>
                  <p className="mt-1 text-xs text-ink-subtle">
                    Try adjusting your filters or create a new program to get started.
                  </p>
                  <button className="btn btn-primary btn-sm mt-4" onClick={openCreate}>
                    <Plus className="h-4 w-4" /> Create New Program
                  </button>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {visible.map((p) => (
                  <Card key={p._id} className="cursor-pointer transition-transform duration-200 hover:-translate-y-1">
                    <div onClick={() => setDetail(p)}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <Thumb seed={p.name} alt={p.name} className="h-11 w-11 rounded-lg" />
                          <div className="min-w-0">
                            <p className="font-semibold text-ink">{p.name}</p>
                            <div className="mt-1"><Badge tone={p.cat_tone}>{p.category}</Badge></div>
                          </div>
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                          <Menu
                            align="right"
                            trigger={
                              <button aria-label={`More actions for ${p.name}`} className="text-ink-subtle hover:text-ink-muted"><MoreVertical className="h-4 w-4" /></button>
                            }
                          >
                            <MenuItem icon={Eye} onClick={() => setDetail(p)}>View details</MenuItem>
                            <MenuItem icon={Pencil} onClick={() => openEdit(p)}>Edit</MenuItem>
                            <MenuItem icon={UsersRound} onClick={() => setDetail(p)}>Manage Enrollments</MenuItem>
                            <MenuItem icon={Archive} onClick={() => archiveProgram(p._id)}>Archive</MenuItem>
                            <MenuItem icon={Trash2} danger onClick={() => deleteProgram(p._id)}>Delete</MenuItem>
                          </Menu>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-ink-subtle">{p.desc}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
                        <span className="flex items-center gap-1.5">
                          <p.modeIcon className="h-4 w-4 text-violet-ink" /> {p.mode}
                        </span>
                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                          <Calendar className="h-4 w-4 text-ink-subtle" /> {p.duration}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-nowrap text-xs text-ink-muted">{p.dates}</p>
                      <p className="text-xs text-ink-subtle">{p.days}</p>
                      <div className="mt-3">
                        <p className="text-sm text-ink-muted">
                          <span className="font-semibold">{p.enrolled}</span> / {p.cap}
                        </p>
                        <ProgressBar value={p.pct} color={p.bar} className="mt-1.5 w-full" />
                        <p className="mt-0.5 text-right text-2xs text-ink-subtle">{p.pct}%</p>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <Badge tone={STATUS_TONE[p.status] ?? "slate"}>{p.status}</Badge>
                        <span className="text-2xs text-ink-subtle">{p.note}</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* side */}
        <div className="space-y-6">
          <Card>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-ink">Program Overview</h2>
              <Menu
                align="right"
                trigger={
                  <button className="btn btn-sm btn-outline">
                    {overviewRange} <ChevronDown className="h-3 w-3" />
                  </button>
                }
              >
                <MenuItem onClick={() => setOverviewRange("This Week")}>This Week</MenuItem>
                <MenuItem onClick={() => setOverviewRange("This Month")}>This Month</MenuItem>
                <MenuItem onClick={() => setOverviewRange("This Quarter")}>This Quarter</MenuItem>
                <MenuItem onClick={() => setOverviewRange("This Year")}>This Year</MenuItem>
              </Menu>
            </div>
            <AreaTrend data={overview?.series ?? OVERVIEW} color="var(--color-violet-500)" height={130} showAxis={false} />
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div><p className="font-display text-lg font-bold text-ink">{overview?.new_programs ?? 3}</p><p className="text-2xs text-ink-subtle">New Programs</p></div>
              <div><p className="font-display text-lg font-bold text-status-ok-ink">{overview?.enrollments ?? "+142"}</p><p className="text-2xs text-ink-subtle">Enrollments</p></div>
              <div><p className="font-display text-lg font-bold text-status-ok-ink">{overview?.completions ?? "+68"}</p><p className="text-2xs text-ink-subtle">Completions</p></div>
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-ink">Top Categories</h2>
              <button
                className="text-xs font-semibold text-brand-ink transition hover:underline"
                onClick={() => setCategoryFilter("All Categories")}
              >
                View All
              </button>
            </div>
            <ul className="space-y-3">
              {(categories.length ? categories : CATEGORIES).map((c) => (
                <li key={c.name}>
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setCategoryFilter(c.name)}
                  >
                    <div className="mb-1 flex items-center gap-2 text-xs">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                      <span className="flex-1 text-ink-muted">{c.name}</span>
                    </div>
                    <ProgressBar value={c.value} color={c.color} />
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="bg-linear-to-br from-violet-50 to-brand-50">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface text-brand-ink shadow-sm">
                <PlayCircle className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">Create Impactful Programs</p>
                <p className="text-xs text-ink-subtle">Design programs that inspire, educate and empower women.</p>
              </div>
            </div>
            <button className="btn btn-primary btn-block mt-3" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Create New Program
            </button>
          </Card>
        </div>
      </ResizableColumns>

      {/* Create / Edit modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={editingId ? "Edit Program" : "Create New Program"}
        description="Design a program that empowers women through learning and development."
        icon={GraduationCap}
        iconTone="violet"
        size="lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={submitForm}>
              {editingId ? "Save Changes" : "Create Program"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Program Name"
            required
            className="col-span-2"
            placeholder="e.g. Digital Skills for Women"
            value={form.name}
            onChange={(e) => setField("name")(e)}
          />
          <Textarea
            label="Description"
            className="col-span-2"
            placeholder="What will participants learn?"
            value={form.desc}
            onChange={(e) => setField("desc")(e)}
          />
          <Select
            label="Category"
            options={CATEGORY_OPTIONS}
            value={form.category}
            onChange={(e) => setField("category")(e)}
          />
          <Select
            label="Delivery Mode"
            options={MODE_OPTIONS}
            value={form.mode}
            onChange={(e) => setField("mode")(e)}
          />
          <Input
            label="Duration"
            placeholder="e.g. 8 Weeks"
            value={form.duration}
            onChange={(e) => setField("duration")(e)}
          />
          <Input
            label="Capacity"
            type="number"
            placeholder="e.g. 200"
            value={form.cap}
            onChange={(e) => setField("cap")(e)}
          />
          <Input
            label="Start Date"
            type="date"
            value={form.startDate}
            onChange={(e) => setField("startDate")(e)}
          />
          <Input
            label="Days"
            placeholder="e.g. Mon, Wed, Fri"
            value={form.days}
            onChange={(e) => setField("days")(e)}
          />
          <Select
            label="Status"
            className="col-span-2"
            options={["Active", "Upcoming", "Completed", "Draft"]}
            value={form.status}
            onChange={(e) => setField("status")(e)}
          />
        </div>
      </Modal>

      {/* Detail modal */}
      <Modal
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.name ?? ""}
        description={detail?.category}
        icon={GraduationCap}
        iconTone={detail?.cat_tone ?? "violet"}
        size="lg"
        footer={
          detail ? (
            <>
              <button className="btn btn-outline" onClick={() => deleteProgram(detail._id)}>
                <Trash2 className="h-4 w-4" /> Delete
              </button>
              <button className="btn btn-outline" onClick={() => archiveProgram(detail._id)}>
                <Archive className="h-4 w-4" /> Archive
              </button>
              <button className="btn btn-primary" onClick={() => markCompleted(detail._id)}>
                <CheckCircle2 className="h-4 w-4" /> Mark Completed
              </button>
            </>
          ) : null
        }
      >
        {detail && (
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 flex items-start gap-3">
              <Thumb seed={detail.name} alt={detail.name} className="h-16 w-16 rounded-xl" />
              <div className="min-w-0">
                <p className="text-sm text-ink-muted">{detail.desc}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge tone={detail.cat_tone}>{detail.category}</Badge>
                  <Badge tone={STATUS_TONE[detail.status] ?? "slate"}>{detail.status}</Badge>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-subtle">Delivery Mode</p>
              <span className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
                <detail.modeIcon className="h-4 w-4 text-violet-ink" /> {detail.mode}
              </span>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-subtle">Duration</p>
              <span className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
                <Calendar className="h-4 w-4 text-ink-subtle" /> {detail.duration}
              </span>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-subtle">Schedule</p>
              <p className="mt-1 text-sm text-ink-muted">{detail.dates}</p>
              <p className="text-xs text-ink-subtle">{detail.days}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-subtle">Status</p>
              <p className="mt-1 text-sm text-ink-muted">{detail.note}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs font-medium text-ink-subtle">Enrollment</p>
              <p className="mt-1 text-sm text-ink-muted">
                <span className="font-semibold">{detail.enrolled}</span> / {detail.cap}
              </p>
              <ProgressBar value={detailPct} color={detail.bar} className="mt-1.5 w-full" />
              <p className="mt-0.5 text-right text-2xs text-ink-subtle">{detailPct}%</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
