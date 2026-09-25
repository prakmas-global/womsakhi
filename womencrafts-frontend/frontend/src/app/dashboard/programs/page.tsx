"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowUp,
  Boxes,
  Calendar,
  CheckCircle2,
  ChevronDown,
  CircleCheck,
  Download,
  Eye,
  EyeOff,
  Globe,
  GraduationCap,
  Hourglass,
  LayoutGrid,
  Layers,
  List,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Star,
  Trash2,
  UsersRound,
  X,
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
  Spinner,
  StatCard,
  Tabs,
  Textarea,
  Thumb,
  useConfirm,
  useToast,
  type Tone,
} from "@/design-system";
import AreaTrend from "@/components/charts/AreaTrend";
import {
  apiArchiveProgram,
  apiCompleteProgram,
  apiCreateProgram,
  apiDeleteProgram,
  apiExportProgramEnrollments,
  apiListProgramRows,
  apiProgramCategoriesFull,
  apiProgramEnrollments,
  apiProgramOverviewFull,
  apiProgramStatsFull,
  apiPublishProgram,
  apiResyncProgramSeats,
  apiSaveProgramModules,
  apiSetEnrollmentStatus,
  apiUnpublishProgram,
  apiUpdateProgram,
  type ApiEnrolment,
  type ApiEnrolmentList,
  type ApiProgramModule,
  type ApiProgramRow,
  type EnrolmentState,
  type ProgramCategoryFull,
  type ProgramOverviewFull,
  type ProgramStatsFull,
} from "@/lib/programs-api";
import { memberError } from "@/lib/member-api";
import { ResizableColumns } from "@/layout-engine";

/**
 * Programmes — what members can join, who is in each one, and how far they
 * have got.
 *
 * Every number here is counted on the server from the `enrollments`
 * collection. A programme document also carries a stored seat counter that
 * the member catalogue reads for "seats left"; it is shown as such, and when
 * it disagrees with the live count the screen says so and offers to fix it,
 * rather than quietly showing one number here and another to members.
 */

// Statuses that mean "running now". The seed wrote "Running"; the form writes
// "Active"; the member catalogue also knows "Ongoing" and "Published".
const LIVE = new Set(["Active", "Running", "Ongoing", "Published"]);
const isLive = (s: string) => LIVE.has(s);

const STATUS_TONE: Record<string, Tone> = {
  Active: "emerald",
  Running: "emerald",
  Ongoing: "emerald",
  Published: "emerald",
  Upcoming: "amber",
  Completed: "sky",
  Draft: "slate",
  Archived: "slate",
};

const ENROLMENT_TONE: Record<string, Tone> = {
  active: "emerald",
  completed: "sky",
  withdrawn: "slate",
};
const ENROLMENT_LABEL: Record<string, string> = {
  active: "In progress",
  completed: "Finished",
  withdrawn: "Left",
};

const TABS = ["All", "Active", "Upcoming", "Completed", "Draft", "Archived"];
const STATUS_OPTIONS = ["Active", "Upcoming", "Completed", "Draft", "Archived"];
const FORM_STATUS_OPTIONS = ["Draft", "Upcoming", "Active", "Completed"];
const CATEGORY_OPTIONS = [
  "Digital Literacy",
  "Entrepreneurship",
  "Handicrafts",
  "Personal Development",
  "Sustainability",
];
const MODE_OPTIONS = ["Online", "Offline", "Hybrid"];
const MODE_ICON: Record<string, React.ElementType> = {
  Online: Globe,
  Offline: MapPin,
  Hybrid: Boxes,
};

type SortKey = "Newest First" | "Oldest First" | "Most Enrolled" | "Completion Rate";
type DetailTab = "overview" | "learners" | "modules";
type LearnerFilter = "all" | EnrolmentState;

const PER_PAGE = 8;

const emptyForm = {
  name: "",
  desc: "",
  category: "",
  mode: "",
  duration: "",
  cap: "",
  schedule: "",
  days: "",
  status: "",
};
type FormState = typeof emptyForm;

function matchesStatus(status: string, filter: string): boolean {
  if (filter === "All" || filter === "All Status") return true;
  if (filter === "Active") return isLive(status);
  return status === filter;
}

function shortDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Seeded rows store a tone NAME ("rose", "sky") in `bar` rather than a colour;
// handed straight to CSS that paints nothing. Map the names to the theme tokens.
const BAR_TOKEN: Record<string, string> = {
  brand: "var(--color-brand-600)",
  violet: "var(--color-violet-500)",
  rose: "var(--status-danger-solid)",
  sky: "var(--status-info-solid)",
  blue: "var(--status-info-solid)",
  amber: "var(--status-warn-solid)",
  emerald: "var(--status-ok-solid)",
  fuchsia: "var(--color-violet-500)",
  slate: "var(--color-ink-subtle, #94a3b8)",
};
function barColor(bar: string): string {
  if (!bar) return "var(--color-violet-500)";
  if (bar.startsWith("#") || bar.startsWith("var(") || bar.startsWith("rgb")) return bar;
  return BAR_TOKEN[bar] ?? "var(--color-violet-500)";
}

function canDelete(p: ApiProgramRow): boolean {
  // The server refuses to delete a programme with any enrolment record, so
  // the option is only offered where it will work.
  return p.enrolled + p.withdrawn === 0;
}

export default function ProgramsPage() {
  const toast = useToast();
  const confirm = useConfirm();

  const [rows, setRows] = useState<ApiProgramRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stats, setStats] = useState<ProgramStatsFull | null>(null);
  const [categories, setCategories] = useState<ProgramCategoryFull[] | null>(null);
  const [overview, setOverview] = useState<ProgramOverviewFull | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewRange, setOverviewRange] = useState("This Month");

  // filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [modeFilter, setModeFilter] = useState("All Modes");
  const [activeTab, setActiveTab] = useState("All");
  const [view, setView] = useState<"list" | "grid">("list");
  const [sort, setSort] = useState<SortKey>("Newest First");
  const [page, setPage] = useState(1);

  // editor
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  // detail
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [learners, setLearners] = useState<ApiEnrolmentList | null>(null);
  const [learnersLoading, setLearnersLoading] = useState(false);
  const [learnerFilter, setLearnerFilter] = useState<LearnerFilter>("all");
  const [exporting, setExporting] = useState(false);
  const [moduleDraft, setModuleDraft] = useState<ApiProgramModule[]>([]);
  const [modulesDirty, setModulesDirty] = useState(false);
  const [savingModules, setSavingModules] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const detail = useMemo(
    () => (detailId ? rows.find((r) => r.id === detailId) ?? null : null),
    [rows, detailId],
  );

  // ── loading ────────────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    const [list, s, cats] = await Promise.all([
      apiListProgramRows({ page_size: 500, sort: "Newest First" }).catch((e: unknown) => {
        setLoadError(memberError(e));
        return null;
      }),
      apiProgramStatsFull().catch(() => null),
      apiProgramCategoriesFull().catch(() => null),
    ]);
    if (list) {
      setRows(list.items);
      setLoadError(null);
    }
    if (s) setStats(s);
    if (cats) setCategories(cats);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let alive = true;
    setOverviewLoading(true);
    apiProgramOverviewFull(overviewRange)
      .then((ov) => {
        if (alive) setOverview(ov);
      })
      .catch((e: unknown) => {
        if (alive) toast.error("Could not load the enrolment trend", { description: memberError(e) });
      })
      .finally(() => {
        if (alive) setOverviewLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [overviewRange, toast]);

  const loadLearners = useCallback(
    async (id: string) => {
      setLearnersLoading(true);
      try {
        setLearners(await apiProgramEnrollments(id));
      } catch (e) {
        toast.error("Could not load who is enrolled", { description: memberError(e) });
      } finally {
        setLearnersLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (!detailId || detailTab !== "learners") return;
    void loadLearners(detailId);
  }, [detailId, detailTab, loadLearners]);

  // The module draft follows the server copy whenever the programme opened or
  // changed on the server; while it is being edited it is left alone.
  const detailUpdatedAt = detail?.updated_at ?? "";
  useEffect(() => {
    if (!detailId) return;
    const current = rows.find((r) => r.id === detailId);
    setModuleDraft((current?.curriculum ?? []).map((m) => ({ ...m })));
    setModulesDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailId, detailUpdatedAt]);

  // ── open things ────────────────────────────────────────────────────────────

  const openDetail = (p: ApiProgramRow, tab: DetailTab = "overview") => {
    setDetailId(p.id);
    setDetailTab(tab);
    setLearnerFilter("all");
    // Never show the previous programme's learners while this one's load.
    setLearners(null);
  };

  const closeDetail = () => {
    setDetailId(null);
    setLearners(null);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setEditorOpen(true);
  };

  const openEdit = (p: ApiProgramRow) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      desc: p.desc,
      category: p.category,
      mode: p.mode,
      duration: p.duration === "—" ? "" : p.duration,
      cap: p.cap ? String(p.cap) : "",
      schedule: p.dates === "To be scheduled" ? "" : p.dates,
      days: p.days === "—" ? "" : p.days,
      status: p.status,
    });
    setEditorOpen(true);
  };

  const setField = (key: keyof FormState) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  // ── writes ─────────────────────────────────────────────────────────────────

  const submitForm = async () => {
    if (!form.name.trim()) {
      toast.error("The programme needs a name");
      return;
    }
    const payload = {
      name: form.name.trim(),
      desc: form.desc,
      category: form.category || "Digital Literacy",
      mode: form.mode || "Online",
      duration: form.duration,
      cap: Math.max(0, Number(form.cap) || 0),
      startDate: form.schedule,
      days: form.days,
      status: form.status || "Draft",
    };
    setSaving(true);
    try {
      if (editingId) {
        await apiUpdateProgram(editingId, payload);
        toast.success("Programme saved");
      } else {
        const created = await apiCreateProgram(payload);
        toast.success("Programme created", {
          description:
            payload.status === "Draft"
              ? `${created.name} is a draft — members cannot see it until you publish it.`
              : `${created.name} is ${payload.status.toLowerCase()}.`,
        });
      }
      setEditorOpen(false);
      await refresh();
    } catch (e) {
      toast.error("Could not save the programme", { description: memberError(e) });
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (
    key: string,
    fn: () => Promise<unknown>,
    okTitle: string,
    failTitle: string,
    okDescription?: string,
  ) => {
    setBusyAction(key);
    try {
      await fn();
      toast.success(okTitle, okDescription ? { description: okDescription } : undefined);
      await refresh();
    } catch (e) {
      toast.error(failTitle, { description: memberError(e) });
    } finally {
      setBusyAction(null);
    }
  };

  const publish = (p: ApiProgramRow) =>
    runAction(
      `publish:${p.id}`,
      () => apiPublishProgram(p.id),
      `${p.name} is open to members`,
      "Could not publish the programme",
      p.status === "Upcoming" ? "It stays Upcoming until it starts; members can see and join it." : undefined,
    );

  const unpublish = async (p: ApiProgramRow) => {
    const ok = await confirm({
      title: `Hide ${p.name} from members?`,
      description: `It disappears from the member catalogue. ${
        p.enrolled ? `The ${p.enrolled} member${p.enrolled === 1 ? "" : "s"} already enrolled keep their place and progress.` : "Nobody is enrolled, so nothing else changes."
      }`,
      confirmLabel: "Hide it",
    });
    if (!ok) return;
    await runAction(
      `unpublish:${p.id}`,
      () => apiUnpublishProgram(p.id),
      `${p.name} is hidden from members`,
      "Could not unpublish the programme",
    );
  };

  const markCompleted = async (p: ApiProgramRow) => {
    const ok = await confirm({
      title: `Mark ${p.name} completed?`,
      description:
        "The programme leaves the member catalogue. Each learner's own progress is untouched — mark individual learners finished from the Learners tab.",
      confirmLabel: "Mark completed",
    });
    if (!ok) return;
    await runAction(
      `complete:${p.id}`,
      () => apiCompleteProgram(p.id),
      `${p.name} is marked completed`,
      "Could not mark it completed",
    );
  };

  const archive = async (p: ApiProgramRow) => {
    const ok = await confirm({
      title: `Archive ${p.name}?`,
      description:
        "It is hidden from members and from the Active list. Enrolments, progress and certificates stay exactly as they are. You can change its status again later.",
      confirmLabel: "Archive",
    });
    if (!ok) return;
    await runAction(
      `archive:${p.id}`,
      () => apiArchiveProgram(p.id),
      `${p.name} is archived`,
      "Could not archive the programme",
    );
  };

  const remove = async (p: ApiProgramRow) => {
    const ok = await confirm({
      title: `Delete ${p.name}?`,
      description:
        "Nobody has ever enrolled, so there is no history to keep. This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    setBusyAction(`delete:${p.id}`);
    try {
      await apiDeleteProgram(p.id);
      toast.success("Programme deleted");
      if (detailId === p.id) closeDetail();
      await refresh();
    } catch (e) {
      toast.error("Could not delete the programme", { description: memberError(e) });
    } finally {
      setBusyAction(null);
    }
  };

  const resyncSeats = async (p: ApiProgramRow) => {
    const ok = await confirm({
      title: "Set the seat counter to the live count?",
      description: `Members see "seats left" from the counter (${p.seat_counter}). ${p.enrolled} ${
        p.enrolled === 1 ? "member is" : "members are"
      } actually enrolled. This writes ${p.enrolled} onto the programme so both sides agree.`,
      confirmLabel: `Set it to ${p.enrolled}`,
    });
    if (!ok) return;
    await runAction(
      `resync:${p.id}`,
      () => apiResyncProgramSeats(p.id),
      "Seat counter corrected",
      "Could not correct the seat counter",
      `${p.name} now reports ${p.enrolled} of ${p.cap || "unlimited"} seats taken to members.`,
    );
  };

  const setLearnerStatus = async (e: ApiEnrolment, status: EnrolmentState) => {
    if (!detail) return;
    if (status === "withdrawn") {
      const ok = await confirm({
        title: `Remove ${e.name} from ${detail.name}?`,
        description:
          "Her enrolment is marked as left and her seat is freed. Her progress so far is kept, and she is told in her notifications. She can be reinstated later.",
        confirmLabel: "Remove her",
        danger: true,
      });
      if (!ok) return;
    }
    setBusyAction(`learner:${e.id}`);
    try {
      await apiSetEnrollmentStatus(detail.id, e.id, status);
      toast.success(
        status === "completed"
          ? `${e.name} is marked finished`
          : status === "withdrawn"
            ? `${e.name} was removed`
            : `${e.name} is back on the programme`,
      );
      await Promise.all([loadLearners(detail.id), refresh()]);
    } catch (err) {
      toast.error("Could not change that enrolment", { description: memberError(err) });
    } finally {
      setBusyAction(null);
    }
  };

  const exportLearners = async () => {
    if (!detail) return;
    setExporting(true);
    try {
      const state = learnerFilter === "all" ? undefined : learnerFilter;
      const blob = await apiExportProgramEnrollments(detail.id, state);
      const slug = detail.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "programme";
      downloadBlob(blob, `womsakhi-${slug}-learners.csv`);
      toast.success("Enrolment list downloaded", { description: "The download is recorded in the audit trail." });
    } catch (e) {
      toast.error("Could not export the list", { description: memberError(e) });
    } finally {
      setExporting(false);
    }
  };

  // modules editor
  const updateModule = (i: number, key: keyof ApiProgramModule, value: string) => {
    setModuleDraft((d) => d.map((m, idx) => (idx === i ? { ...m, [key]: value } : m)));
    setModulesDirty(true);
  };
  const addModule = () => {
    setModuleDraft((d) => [...d, { title: "", detail: "", duration: "" }]);
    setModulesDirty(true);
  };
  const removeModule = (i: number) => {
    setModuleDraft((d) => d.filter((_, idx) => idx !== i));
    setModulesDirty(true);
  };
  const moveModule = (i: number, dir: -1 | 1) => {
    setModuleDraft((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.length) return d;
      const next = [...d];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setModulesDirty(true);
  };
  const saveModules = async () => {
    if (!detail) return;
    const cleaned = moduleDraft.map((m) => ({
      title: m.title.trim(),
      detail: m.detail.trim(),
      duration: m.duration.trim(),
    }));
    if (cleaned.some((m) => !m.title)) {
      toast.error("Every module needs a title", { description: "Give each one a title, or remove the empty rows." });
      return;
    }
    setSavingModules(true);
    try {
      await apiSaveProgramModules(detail.id, cleaned);
      toast.success(
        cleaned.length ? `${cleaned.length} module${cleaned.length === 1 ? "" : "s"} saved` : "Modules cleared",
        {
          description: cleaned.length
            ? "Members see these as the programme's outline."
            : "Members will see a plain Week 1 … Week n outline derived from the duration.",
        },
      );
      setModulesDirty(false);
      await refresh();
    } catch (e) {
      toast.error("Could not save the modules", { description: memberError(e) });
    } finally {
      setSavingModules(false);
    }
  };

  // ── derived lists ──────────────────────────────────────────────────────────

  const selectTab = (tab: string) => {
    setActiveTab(tab);
    setStatusFilter(tab === "All" ? "All Status" : tab);
    setPage(1);
  };

  const resetAll = () => {
    setSearch("");
    setStatusFilter("All Status");
    setCategoryFilter("All Categories");
    setModeFilter("All Modes");
    setActiveTab("All");
    setPage(1);
  };

  const matching = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !p.desc.toLowerCase().includes(q)) return false;
      if (!matchesStatus(p.status, statusFilter)) return false;
      if (categoryFilter !== "All Categories" && p.category !== categoryFilter) return false;
      if (modeFilter !== "All Modes" && p.mode !== modeFilter) return false;
      if (!matchesStatus(p.status, activeTab)) return false;
      return true;
    });
    const sorted = [...list];
    if (sort === "Oldest First") sorted.reverse();
    else if (sort === "Most Enrolled") sorted.sort((a, b) => b.enrolled - a.enrolled || a.name.localeCompare(b.name));
    else if (sort === "Completion Rate")
      sorted.sort((a, b) => b.completion_rate - a.completion_rate || b.completed - a.completed || a.name.localeCompare(b.name));
    return sorted;
  }, [rows, search, statusFilter, categoryFilter, modeFilter, activeTab, sort]);

  const pageCount = Math.max(1, Math.ceil(matching.length / PER_PAGE));
  const current = Math.min(Math.max(page, 1), pageCount);
  const visible = useMemo(
    () => matching.slice((current - 1) * PER_PAGE, current * PER_PAGE),
    [matching, current],
  );
  const showingLabel = matching.length
    ? `Showing ${(current - 1) * PER_PAGE + 1} to ${Math.min(current * PER_PAGE, matching.length)} of ${matching.length} programme${matching.length === 1 ? "" : "s"}`
    : rows.length
      ? "No programmes match these filters"
      : "No programmes yet";

  const tabCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of TABS) c[t] = rows.filter((p) => matchesStatus(p.status, t)).length;
    return c;
  }, [rows]);

  const visibility = useMemo(() => {
    const visibleNow = rows.filter((p) => p.visible_to_members).length;
    const liveButHidden = rows.filter((p) => isLive(p.status) && !p.visible_to_members);
    return {
      visibleNow,
      liveButHidden,
      drafts: rows.filter((p) => p.status === "Draft").length,
      archived: rows.filter((p) => p.status === "Archived").length,
      completed: rows.filter((p) => p.status === "Completed").length,
    };
  }, [rows]);

  // The fixed list is what the form offers by default; whatever the catalogue
  // already contains is offered too, so an existing programme can be filtered
  // and edited without its category being silently forced to something else.
  const categoryOptions = useMemo(
    () => Array.from(new Set([...CATEGORY_OPTIONS, ...rows.map((r) => r.category).filter(Boolean)])).sort(),
    [rows],
  );

  const filteredLearners = useMemo(() => {
    if (!learners) return [];
    if (learnerFilter === "all") return learners.items;
    return learners.items.filter((e) => e.status === learnerFilter);
  }, [learners, learnerFilter]);

  const overviewTotal = overview ? overview.series.reduce((s, p) => s + p.value, 0) : 0;
  const bucketWord = overview?.bucket === "day" ? "day" : overview?.bucket === "month" ? "month" : "week";
  const menuLabel = (value: string, all: string) => (value === all ? all : value);

  // ── row actions menu (shared by list and grid) ─────────────────────────────

  const rowMenu = (p: ApiProgramRow) => (
    <Menu
      align="right"
      trigger={
        <button aria-label={`More actions for ${p.name}`} className="text-ink-subtle hover:text-ink-muted">
          <MoreVertical className="h-4 w-4" />
        </button>
      }
    >
      <MenuItem icon={Eye} onClick={() => openDetail(p)}>View details</MenuItem>
      <MenuItem icon={Pencil} onClick={() => openEdit(p)}>Edit</MenuItem>
      <MenuItem icon={UsersRound} onClick={() => openDetail(p, "learners")}>
        Learners ({p.enrolled})
      </MenuItem>
      <MenuItem icon={Layers} onClick={() => openDetail(p, "modules")}>
        Modules ({p.module_count})
      </MenuItem>
      {p.visible_to_members ? (
        <MenuItem icon={EyeOff} onClick={() => void unpublish(p)}>Hide from members</MenuItem>
      ) : p.status !== "Archived" ? (
        <MenuItem icon={Globe} onClick={() => void publish(p)}>Publish to members</MenuItem>
      ) : null}
      {p.status !== "Completed" && (
        <MenuItem icon={CheckCircle2} onClick={() => void markCompleted(p)}>Mark completed</MenuItem>
      )}
      {p.status !== "Archived" && (
        <MenuItem icon={Archive} onClick={() => void archive(p)}>Archive</MenuItem>
      )}
      {canDelete(p) && (
        <MenuItem icon={Trash2} danger onClick={() => void remove(p)}>Delete</MenuItem>
      )}
    </Menu>
  );

  const enrolmentCell = (p: ApiProgramRow, wide = false) => (
    <div>
      <p className="text-sm text-ink-muted">
        <span className="font-semibold text-ink">{p.enrolled}</span>
        {p.cap ? ` / ${p.cap}` : " enrolled"}
      </p>
      <ProgressBar value={p.pct} color={barColor(p.bar)} className={`mt-1.5 ${wide ? "w-full" : "w-24"}`} />
      <p className="mt-0.5 text-2xs text-ink-subtle">
        {p.cap ? `${p.pct}% of seats` : "No seat limit"}
        {p.seat_counter !== p.enrolled && (
          <span className="ml-1 text-status-warn-ink" title="The stored seat counter members see disagrees with the live count">
            · counter says {p.seat_counter}
          </span>
        )}
      </p>
    </div>
  );

  const emptyTable = (
    <div className="mx-auto flex max-w-xs flex-col items-center py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-tint text-violet-ink">
        <GraduationCap className="h-6 w-6" />
      </span>
      <p className="mt-3 text-sm font-semibold text-ink-muted">
        {rows.length ? "No programmes match these filters" : "No programmes yet"}
      </p>
      <p className="mt-1 text-xs text-ink-subtle">
        {rows.length
          ? "Try a different search, or clear the filters."
          : "Create the first one. It starts as a draft, hidden from members until you publish it."}
      </p>
      {rows.length ? (
        <button className="btn btn-outline btn-sm mt-4" onClick={resetAll}>
          <RotateCcw className="h-4 w-4" /> Clear filters
        </button>
      ) : (
        <button className="btn btn-primary btn-sm mt-4" onClick={openCreate}>
          <Plus className="h-4 w-4" /> New programme
        </button>
      )}
    </div>
  );

  const errorBlock = (
    <div className="mx-auto flex max-w-sm flex-col items-center py-14 text-center">
      <AlertTriangle className="h-6 w-6 text-status-warn-ink" />
      <p className="mt-3 text-sm font-semibold text-ink">Could not load programmes</p>
      <p className="mt-1 text-xs text-ink-subtle">{loadError}</p>
      <button className="btn btn-outline btn-sm mt-4" onClick={() => void refresh()}>
        <RefreshCw className="h-4 w-4" /> Try again
      </button>
    </div>
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-tint text-violet-ink">
            <GraduationCap className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Programmes</h1>
            <p className="mt-1 text-sm text-ink-subtle">
              Courses members join — who is enrolled, how far they have got, and what is open to them right now.
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus className="h-4 w-4" /> New programme
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <button type="button" className="w-full text-left" onClick={() => selectTab("All")}>
          <StatCard
            label="Programmes"
            value={stats ? String(stats.total_programs) : "—"}
            icon={GraduationCap}
            tone="violet"
            deltaNote={stats ? `${stats.visible_programs} visible to members` : "Loading…"}
          />
        </button>
        <button type="button" className="w-full text-left" onClick={() => selectTab("Active")}>
          <StatCard
            label="Running now"
            value={stats ? String(stats.active_programs) : "—"}
            icon={CircleCheck}
            tone="emerald"
            deltaNote={stats ? `${stats.completed_programs} completed · ${stats.draft_programs} draft` : "Loading…"}
          />
        </button>
        <button type="button" className="w-full text-left" onClick={() => selectTab("Upcoming")}>
          <StatCard
            label="Upcoming"
            value={stats ? String(stats.upcoming_programs) : "—"}
            icon={Hourglass}
            tone="amber"
            deltaNote="Scheduled, not started"
          />
        </button>
        <StatCard
          label="Enrolments"
          value={stats ? stats.total_enrollments.toLocaleString() : "—"}
          icon={UsersRound}
          tone="sky"
          deltaNote={
            stats
              ? `${stats.learners} learner${stats.learners === 1 ? "" : "s"} · ${stats.withdrawn_enrollments} left`
              : "Loading…"
          }
        />
        <StatCard
          label="Completion rate"
          value={stats ? `${stats.completion_rate}%` : "—"}
          icon={Star}
          tone="brand"
          deltaNote={
            stats
              ? stats.total_enrollments
                ? `${stats.completed_enrollments} of ${stats.total_enrollments} finished · avg progress ${stats.avg_progress}%`
                : "No enrolments to measure"
              : "Loading…"
          }
        />
      </div>

      {/* filter bar */}
      <Card className="mt-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search programmes…"
              className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
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
              <MenuItem onClick={() => { setStatusFilter("All Status"); setPage(1); }}>All Status</MenuItem>
              {STATUS_OPTIONS.map((s) => (
                <MenuItem key={s} onClick={() => { setStatusFilter(s); setPage(1); }}>{s}</MenuItem>
              ))}
            </Menu>
          </label>

          <label className="text-xs">
            <span className="mb-1 block font-medium text-ink-subtle">Category</span>
            <Menu
              align="left"
              trigger={
                <button className="btn btn-sm btn-outline w-44 justify-between">
                  {menuLabel(categoryFilter, "All Categories")} <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" />
                </button>
              }
            >
              <MenuItem onClick={() => { setCategoryFilter("All Categories"); setPage(1); }}>All Categories</MenuItem>
              {categoryOptions.map((c) => (
                <MenuItem key={c} onClick={() => { setCategoryFilter(c); setPage(1); }}>{c}</MenuItem>
              ))}
            </Menu>
          </label>

          <label className="text-xs">
            <span className="mb-1 block font-medium text-ink-subtle">Mode</span>
            <Menu
              align="left"
              trigger={
                <button className="btn btn-sm btn-outline w-32 justify-between">
                  {menuLabel(modeFilter, "All Modes")} <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" />
                </button>
              }
            >
              <MenuItem onClick={() => { setModeFilter("All Modes"); setPage(1); }}>All Modes</MenuItem>
              {MODE_OPTIONS.map((m) => (
                <MenuItem key={m} onClick={() => { setModeFilter(m); setPage(1); }}>{m}</MenuItem>
              ))}
            </Menu>
          </label>

          <Menu
            align="right"
            trigger={
              <button className="btn btn-sm btn-outline">
                <SlidersHorizontal className="h-3.5 w-3.5" /> Quick filters
              </button>
            }
          >
            <MenuItem onClick={() => selectTab("Active")}>Running now</MenuItem>
            <MenuItem onClick={() => setSort("Most Enrolled")}>Most enrolled first</MenuItem>
            <MenuItem onClick={() => setSort("Completion Rate")}>Best completion first</MenuItem>
            <MenuItem onClick={() => { setModeFilter("Online"); setPage(1); }}>Online only</MenuItem>
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
              {t === "All" ? "All programmes" : t}
              <span className="ml-1.5 text-2xs text-ink-subtle">{tabCounts[t] ?? 0}</span>
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
            <MenuItem onClick={() => setSort("Completion Rate")}>Completion Rate</MenuItem>
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
            {loading ? (
              <div className="flex items-center justify-center py-16"><Spinner /></div>
            ) : loadError && rows.length === 0 ? (
              errorBlock
            ) : visible.length === 0 ? (
              emptyTable
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-215 text-left">
                  <thead>
                    <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                      <th scope="col" className="px-4 py-3">Programme</th>
                      <th scope="col" className="px-2 py-3">Category</th>
                      <th scope="col" className="px-2 py-3">Mode</th>
                      <th scope="col" className="whitespace-nowrap px-2 py-3">Schedule</th>
                      <th scope="col" className="px-2 py-3">Enrolled</th>
                      <th scope="col" className="px-2 py-3">Completion</th>
                      <th scope="col" className="px-2 py-3">Status</th>
                      <th scope="col" className="px-2 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {visible.map((p) => {
                      const ModeIcon = MODE_ICON[p.mode] ?? Globe;
                      return (
                        <tr
                          key={p.id}
                          onClick={() => openDetail(p)}
                          className="cursor-pointer align-top text-sm hover:bg-surface-hover/60"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-start gap-3">
                              <Thumb seed={p.name} alt={p.name} className="h-11 w-11 rounded-lg" />
                              <div className="max-w-[210px]">
                                <p className="font-semibold text-ink">{p.name}</p>
                                <p className="line-clamp-2 text-xs text-ink-subtle">{p.desc}</p>
                                <p className="mt-1 text-2xs text-ink-subtle">
                                  {p.module_count ? `${p.module_count} module${p.module_count === 1 ? "" : "s"}` : "No modules yet"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-3"><Badge tone={(p.cat_tone as Tone) || "violet"}>{p.category}</Badge></td>
                          <td className="px-2 py-3">
                            <span className="flex items-center gap-1.5 text-ink-muted">
                              <ModeIcon className="h-4 w-4 text-violet-ink" /> {p.mode}
                            </span>
                            <span className="mt-1 flex items-center gap-1.5 whitespace-nowrap text-xs text-ink-subtle">
                              <Calendar className="h-3.5 w-3.5" /> {p.duration}
                            </span>
                          </td>
                          <td className="px-2 py-3">
                            <p className="whitespace-nowrap text-ink-muted">{p.dates}</p>
                            <p className="text-xs text-ink-subtle">{p.days}</p>
                          </td>
                          <td className="px-2 py-3">{enrolmentCell(p)}</td>
                          <td className="px-2 py-3">
                            <p className="text-ink-muted">
                              <span className="font-semibold text-ink">{p.completion_rate}%</span>
                            </p>
                            <p className="text-xs text-ink-subtle">
                              {p.enrolled ? `${p.completed} of ${p.enrolled} finished` : "Nobody enrolled"}
                            </p>
                            {p.enrolled > 0 && (
                              <p className="text-2xs text-ink-subtle">avg progress {p.avg_progress}%</p>
                            )}
                          </td>
                          <td className="px-2 py-3">
                            <Badge tone={STATUS_TONE[p.status] ?? "slate"}>{p.status}</Badge>
                            <p className={`mt-1 text-2xs ${p.visible_to_members ? "text-status-ok-ink" : "text-ink-subtle"}`}>
                              {p.visible_to_members ? "Visible to members" : "Hidden from members"}
                            </p>
                          </td>
                          <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>{rowMenu(p)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {!loading && rows.length > 0 && (
              <Pagination
                className="px-4 pb-3"
                page={current}
                pageCount={pageCount}
                onPageChange={setPage}
                showing={showingLabel}
              />
            )}
          </Card>
        ) : (
          <div>
            {loading ? (
              <Card><div className="flex items-center justify-center py-16"><Spinner /></div></Card>
            ) : loadError && rows.length === 0 ? (
              <Card>{errorBlock}</Card>
            ) : visible.length === 0 ? (
              <Card>{emptyTable}</Card>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {visible.map((p) => {
                    const ModeIcon = MODE_ICON[p.mode] ?? Globe;
                    return (
                      <Card key={p.id} className="cursor-pointer transition-transform duration-200 hover:-translate-y-1">
                        <div onClick={() => openDetail(p)}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <Thumb seed={p.name} alt={p.name} className="h-11 w-11 rounded-lg" />
                              <div className="min-w-0">
                                <p className="font-semibold text-ink">{p.name}</p>
                                <div className="mt-1"><Badge tone={(p.cat_tone as Tone) || "violet"}>{p.category}</Badge></div>
                              </div>
                            </div>
                            <div onClick={(e) => e.stopPropagation()}>{rowMenu(p)}</div>
                          </div>
                          <p className="mt-3 line-clamp-2 text-xs text-ink-subtle">{p.desc}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
                            <span className="flex items-center gap-1.5"><ModeIcon className="h-4 w-4 text-violet-ink" /> {p.mode}</span>
                            <span className="flex items-center gap-1.5 whitespace-nowrap"><Calendar className="h-4 w-4 text-ink-subtle" /> {p.duration}</span>
                            <span className="flex items-center gap-1.5"><Layers className="h-4 w-4 text-ink-subtle" /> {p.module_count} modules</span>
                          </div>
                          <p className="mt-2 whitespace-nowrap text-xs text-ink-muted">{p.dates}</p>
                          <p className="text-xs text-ink-subtle">{p.days}</p>
                          <div className="mt-3">{enrolmentCell(p, true)}</div>
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Badge tone={STATUS_TONE[p.status] ?? "slate"}>{p.status}</Badge>
                              <span className={`text-2xs ${p.visible_to_members ? "text-status-ok-ink" : "text-ink-subtle"}`}>
                                {p.visible_to_members ? "Visible" : "Hidden"}
                              </span>
                            </div>
                            <span className="text-xs text-ink-muted">
                              <span className="font-semibold text-ink">{p.completion_rate}%</span> finished
                            </span>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
                <Pagination
                  className="mt-4"
                  page={current}
                  pageCount={pageCount}
                  onPageChange={setPage}
                  showing={showingLabel}
                />
              </>
            )}
          </div>
        )}

        {/* side */}
        <div className="space-y-6">
          <Card>
            <div className="mb-1 flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-semibold text-ink">Enrolments over time</h2>
                <p className="text-2xs text-ink-subtle">Members joining, per {bucketWord}</p>
              </div>
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
            {overviewLoading && !overview ? (
              <div className="flex h-[130px] items-center justify-center"><Spinner /></div>
            ) : overview ? (
              <>
                <AreaTrend data={overview.series} color="var(--color-violet-500)" height={130} showAxis={false} />
                {overviewTotal === 0 && (
                  <p className="-mt-2 text-center text-2xs text-ink-subtle">Nobody joined a programme in this range</p>
                )}
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="font-display text-lg font-bold text-ink">{overview.new_programs}</p>
                    <p className="text-2xs text-ink-subtle">New programmes</p>
                  </div>
                  <div>
                    <p className="font-display text-lg font-bold text-status-ok-ink">{overview.enrollments}</p>
                    <p className="text-2xs text-ink-subtle">Enrolments</p>
                  </div>
                  <div>
                    <p className="font-display text-lg font-bold text-status-ok-ink">{overview.completions}</p>
                    <p className="text-2xs text-ink-subtle">Completions</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-xs text-ink-subtle">The trend could not be loaded.</p>
            )}
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-semibold text-ink">Categories</h2>
                <p className="text-2xs text-ink-subtle">Share of live enrolments</p>
              </div>
              {categoryFilter !== "All Categories" && (
                <button
                  className="text-xs font-semibold text-brand-ink transition hover:underline"
                  onClick={() => { setCategoryFilter("All Categories"); setPage(1); }}
                >
                  Show all
                </button>
              )}
            </div>
            {categories === null ? (
              <div className="flex items-center justify-center py-6"><Spinner /></div>
            ) : categories.length === 0 ? (
              <p className="py-4 text-center text-xs text-ink-subtle">No programmes yet, so nothing to rank.</p>
            ) : (
              <ul className="space-y-3">
                {categories.map((c) => (
                  <li key={c.name}>
                    <button
                      type="button"
                      className={`w-full rounded-md text-left ${categoryFilter === c.name ? "bg-surface-2 px-1" : ""}`}
                      onClick={() => { setCategoryFilter(c.name); setPage(1); }}
                    >
                      <div className="mb-1 flex items-center gap-2 text-xs">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                        <span className="flex-1 text-ink-muted">{c.name}</span>
                        <span className="text-ink-subtle">
                          {c.count} · {c.programs} programme{c.programs === 1 ? "" : "s"}
                        </span>
                      </div>
                      <ProgressBar value={c.value} color={c.color} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="font-display text-base font-semibold text-ink">What members can see</h2>
            {loading ? (
              <div className="flex items-center justify-center py-6"><Spinner /></div>
            ) : (
              <>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <dt className="text-ink-subtle">In the catalogue now</dt>
                  <dd className="text-right font-semibold text-ink">{visibility.visibleNow}</dd>
                  <dt className="text-ink-subtle">Drafts</dt>
                  <dd className="text-right font-semibold text-ink">{visibility.drafts}</dd>
                  <dt className="text-ink-subtle">Completed</dt>
                  <dd className="text-right font-semibold text-ink">{visibility.completed}</dd>
                  <dt className="text-ink-subtle">Archived</dt>
                  <dd className="text-right font-semibold text-ink">{visibility.archived}</dd>
                </dl>
                {visibility.liveButHidden.length > 0 && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <p className="text-amber-900">
                      {visibility.liveButHidden.length} running programme{visibility.liveButHidden.length === 1 ? " is" : "s are"} not
                      in the member catalogue because the catalogue does not list the status
                      {" "}“{visibility.liveButHidden[0].status}”. Publishing sets it to Active, which it does list.
                    </p>
                  </div>
                )}
                <button className="btn btn-primary btn-block mt-4" onClick={openCreate}>
                  <Plus className="h-4 w-4" /> New programme
                </button>
              </>
            )}
          </Card>
        </div>
      </ResizableColumns>

      {/* Create / Edit modal */}
      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingId ? "Edit programme" : "New programme"}
        description={editingId ? "Changes show to members immediately if the programme is published." : "It starts hidden unless you set its status to Active or Upcoming."}
        icon={GraduationCap}
        iconTone="violet"
        size="lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setEditorOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={saving} onClick={() => void submitForm()}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Create programme"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Programme name"
            required
            className="col-span-2"
            placeholder="e.g. Digital Skills for Women"
            value={form.name}
            onChange={setField("name")}
          />
          <Textarea
            label="Description"
            className="col-span-2"
            placeholder="What will participants learn?"
            value={form.desc}
            onChange={setField("desc")}
          />
          <Select label="Category" options={categoryOptions} value={form.category} onChange={setField("category")} />
          <Select label="Delivery mode" options={MODE_OPTIONS} value={form.mode} onChange={setField("mode")} />
          <Input label="Duration" placeholder="e.g. 8 Weeks" value={form.duration} onChange={setField("duration")}
                 hint="Without modules, members see one outline entry per week of this." />
          <Input label="Seats" type="number" min={0} placeholder="0 = no limit" value={form.cap} onChange={setField("cap")} />
          <Input label="Schedule" placeholder="e.g. 2026-10-01 or Oct 01 - Nov 26, 2026" value={form.schedule} onChange={setField("schedule")}
                 hint="A date on its own is shown as Oct 01, 2026." />
          <Input label="Days" placeholder="e.g. Mon, Wed, Fri" value={form.days} onChange={setField("days")} />
          <Select
            label="Status"
            className="col-span-2"
            options={FORM_STATUS_OPTIONS}
            value={form.status}
            onChange={setField("status")}
          />
          <p className="col-span-2 -mt-2 text-xs text-ink-subtle">
            Members can see and join programmes that are Active or Upcoming. Draft and Completed are hidden.
          </p>
        </div>
      </Modal>

      {/* Detail modal */}
      <Modal
        open={detail !== null}
        onClose={closeDetail}
        title={detail?.name ?? ""}
        description={detail ? `${detail.category} · ${detail.mode} · ${detail.duration}` : undefined}
        icon={GraduationCap}
        iconTone={(detail?.cat_tone as Tone) || "violet"}
        size="lg"
        footer={
          detail ? (
            detailTab === "overview" ? (
              <>
                {canDelete(detail) && (
                  <button className="btn btn-outline" disabled={busyAction === `delete:${detail.id}`} onClick={() => void remove(detail)}>
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                )}
                {detail.status !== "Archived" && (
                  <button className="btn btn-outline" disabled={busyAction === `archive:${detail.id}`} onClick={() => void archive(detail)}>
                    <Archive className="h-4 w-4" /> Archive
                  </button>
                )}
                {detail.status !== "Completed" && (
                  <button className="btn btn-outline" disabled={busyAction === `complete:${detail.id}`} onClick={() => void markCompleted(detail)}>
                    <CheckCircle2 className="h-4 w-4" /> Mark completed
                  </button>
                )}
                <button className="btn btn-outline" onClick={() => openEdit(detail)}>
                  <Pencil className="h-4 w-4" /> Edit
                </button>
                {detail.visible_to_members ? (
                  <button className="btn btn-primary" disabled={busyAction === `unpublish:${detail.id}`} onClick={() => void unpublish(detail)}>
                    <EyeOff className="h-4 w-4" /> Hide from members
                  </button>
                ) : detail.status !== "Archived" ? (
                  <button className="btn btn-primary" disabled={busyAction === `publish:${detail.id}`} onClick={() => void publish(detail)}>
                    <Globe className="h-4 w-4" /> Publish to members
                  </button>
                ) : null}
              </>
            ) : detailTab === "learners" ? (
              <>
                <button className="btn btn-outline" onClick={closeDetail}>Close</button>
                <button
                  className="btn btn-primary"
                  disabled={exporting || !learners || filteredLearners.length === 0}
                  onClick={() => void exportLearners()}
                >
                  <Download className="h-4 w-4" /> {exporting ? "Preparing…" : `Export ${learnerFilter === "all" ? "list" : ENROLMENT_LABEL[learnerFilter].toLowerCase()} (CSV)`}
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-outline" onClick={addModule}>
                  <Plus className="h-4 w-4" /> Add module
                </button>
                <button className="btn btn-primary" disabled={!modulesDirty || savingModules} onClick={() => void saveModules()}>
                  {savingModules ? "Saving…" : "Save modules"}
                </button>
              </>
            )
          ) : null
        }
      >
        {detail && (
          <div>
            <Tabs
              className="mb-4"
              value={detailTab}
              onChange={(v) => {
                setDetailTab(v as DetailTab);
                if (v === "learners") setLearnerFilter("all");
              }}
              tabs={[
                { value: "overview", label: "Overview" },
                { value: "learners", label: "Learners", count: detail.enrolled },
                { value: "modules", label: "Modules", count: detail.module_count },
              ]}
            />

            {detailTab === "overview" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 flex items-start gap-3">
                  <Thumb seed={detail.name} alt={detail.name} className="h-16 w-16 rounded-xl" />
                  <div className="min-w-0">
                    <p className="text-sm text-ink-muted">{detail.desc || "No description yet."}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge tone={(detail.cat_tone as Tone) || "violet"}>{detail.category}</Badge>
                      <Badge tone={STATUS_TONE[detail.status] ?? "slate"}>{detail.status}</Badge>
                      <Badge tone={detail.visible_to_members ? "emerald" : "slate"}>
                        {detail.visible_to_members ? "Visible to members" : "Hidden from members"}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-ink-subtle">Schedule</p>
                  <p className="mt-1 text-sm text-ink-muted">{detail.dates}</p>
                  <p className="text-xs text-ink-subtle">{detail.days}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-ink-subtle">Created</p>
                  <p className="mt-1 text-sm text-ink-muted">{shortDate(detail.created_at) || "—"}</p>
                  <p className="text-xs text-ink-subtle">Last changed {shortDate(detail.updated_at) || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-ink-subtle">Enrolled</p>
                  <p className="mt-1 text-sm text-ink-muted">
                    <span className="font-semibold text-ink">{detail.enrolled}</span>
                    {detail.cap ? ` of ${detail.cap} seats` : " · no seat limit"}
                  </p>
                  <ProgressBar value={detail.pct} color={barColor(detail.bar)} className="mt-1.5 w-full" />
                  <p className="mt-1 text-xs text-ink-subtle">
                    {detail.active_enrolled} in progress · {detail.completed} finished · {detail.withdrawn} left
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-ink-subtle">Completion</p>
                  <p className="mt-1 text-sm text-ink-muted">
                    <span className="font-semibold text-ink">{detail.completion_rate}%</span>
                    {detail.enrolled ? ` · ${detail.completed} of ${detail.enrolled} finished` : " · nobody enrolled yet"}
                  </p>
                  <ProgressBar value={detail.avg_progress} color="var(--color-violet-500)" className="mt-1.5 w-full" />
                  <p className="mt-1 text-xs text-ink-subtle">Average progress {detail.avg_progress}%</p>
                </div>
                {detail.seat_counter !== detail.enrolled && (
                  <div className="col-span-2 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <div className="flex-1 text-xs text-amber-900">
                      <p className="font-semibold">The seat counter members see says {detail.seat_counter}</p>
                      <p className="mt-0.5">
                        {detail.enrolled} {detail.enrolled === 1 ? "member is" : "members are"} actually enrolled. The member app
                        works out “seats left” and “full” from the counter, so right now it is
                        {detail.cap && detail.seat_counter >= detail.cap ? " telling members this programme is full." : " showing them the wrong number."}
                      </p>
                    </div>
                    <button
                      className="btn btn-sm btn-outline shrink-0"
                      disabled={busyAction === `resync:${detail.id}`}
                      onClick={() => void resyncSeats(detail)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Set to {detail.enrolled}
                    </button>
                  </div>
                )}
              </div>
            )}

            {detailTab === "learners" && (
              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {(["all", "active", "completed", "withdrawn"] as LearnerFilter[]).map((f) => {
                      const n =
                        f === "all"
                          ? (learners?.items.length ?? 0)
                          : f === "active"
                            ? (learners?.active ?? 0)
                            : f === "completed"
                              ? (learners?.completed ?? 0)
                              : (learners?.withdrawn ?? 0);
                      return (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setLearnerFilter(f)}
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            learnerFilter === f ? "bg-violet-tint text-violet-ink" : "bg-surface-2 text-ink-subtle hover:text-ink"
                          }`}
                        >
                          {f === "all" ? "Everyone" : ENROLMENT_LABEL[f]} {learners ? `(${n})` : ""}
                        </button>
                      );
                    })}
                  </div>
                  {learners && learners.items.length > 0 && (
                    <p className="text-xs text-ink-subtle">
                      {learners.completion_rate}% finished · average progress {learners.avg_progress}%
                    </p>
                  )}
                </div>

                {learnersLoading && !learners ? (
                  <div className="flex items-center justify-center py-12"><Spinner /></div>
                ) : !learners ? (
                  <div className="py-10 text-center">
                    <p className="text-sm font-semibold text-ink">Could not load who is enrolled</p>
                    <button className="btn btn-outline btn-sm mt-3" onClick={() => void loadLearners(detail.id)}>
                      <RefreshCw className="h-4 w-4" /> Try again
                    </button>
                  </div>
                ) : filteredLearners.length === 0 ? (
                  <div className="py-10 text-center">
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-violet-tint text-violet-ink">
                      <UsersRound className="h-6 w-6" />
                    </span>
                    <p className="mt-3 text-sm font-semibold text-ink">
                      {learners.items.length === 0 ? "Nobody has enrolled yet" : `Nobody is ${ENROLMENT_LABEL[learnerFilter]?.toLowerCase() ?? "here"}`}
                    </p>
                    <p className="mx-auto mt-1 max-w-sm text-xs text-ink-subtle">
                      {learners.items.length === 0
                        ? detail.visible_to_members
                          ? "It is in the member catalogue; members join from there."
                          : "It is hidden from members right now — publish it so they can join."
                        : "Pick another filter to see the rest."}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                          <th className="px-2 py-2">Learner</th>
                          <th className="px-2 py-2">Progress</th>
                          <th className="px-2 py-2">Status</th>
                          <th className="whitespace-nowrap px-2 py-2">Enrolled on</th>
                          <th className="px-2 py-2 text-right"><span className="sr-only">Actions</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLearners.map((e) => (
                          <tr key={e.id} className="border-b border-line text-sm last:border-0">
                            <td className="px-2 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-tint text-xs font-bold text-brand-ink">
                                  {(e.name || "?").charAt(0).toUpperCase()}
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-ink">{e.name}</p>
                                  <p className="truncate text-xs text-ink-subtle">
                                    {e.email || e.member_id || "No contact on file"}
                                    {e.email && e.member_id ? ` · ${e.member_id}` : ""}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-2 py-2.5">
                              <ProgressBar value={e.progress} color={barColor(detail.bar)} className="w-24" />
                              <p className="mt-0.5 text-2xs text-ink-subtle">
                                {e.progress}% · {e.sessions_attended} session{e.sessions_attended === 1 ? "" : "s"}
                              </p>
                            </td>
                            <td className="px-2 py-2.5">
                              <Badge tone={ENROLMENT_TONE[e.status] ?? "slate"}>{ENROLMENT_LABEL[e.status] ?? e.status}</Badge>
                              {e.status === "completed" && e.completed_at && (
                                <p className="mt-0.5 text-2xs text-ink-subtle">{shortDate(e.completed_at)}</p>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-2 py-2.5 text-ink-muted">{e.joined || "—"}</td>
                            <td className="px-2 py-2.5 text-right">
                              <Menu
                                align="right"
                                trigger={
                                  <button aria-label={`Actions for ${e.name}`} className="text-ink-subtle hover:text-ink-muted" disabled={busyAction === `learner:${e.id}`}>
                                    <MoreVertical className="h-4 w-4" />
                                  </button>
                                }
                              >
                                {e.status !== "completed" && (
                                  <MenuItem icon={CheckCircle2} onClick={() => void setLearnerStatus(e, "completed")}>Mark finished</MenuItem>
                                )}
                                {e.status === "withdrawn" ? (
                                  <MenuItem icon={RotateCcw} onClick={() => void setLearnerStatus(e, "active")}>Reinstate</MenuItem>
                                ) : (
                                  <MenuItem icon={X} danger onClick={() => void setLearnerStatus(e, "withdrawn")}>Remove from programme</MenuItem>
                                )}
                              </Menu>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {detailTab === "modules" && (
              <div>
                <p className="mb-3 rounded-lg bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-ink-muted">
                  Modules are the outline a member sees inside the programme, in this order. With none saved, the member
                  app shows a plain Week 1 … Week n outline worked out from the duration ({detail.duration}).
                </p>
                {moduleDraft.length === 0 ? (
                  <div className="py-8 text-center">
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-violet-tint text-violet-ink">
                      <Layers className="h-6 w-6" />
                    </span>
                    <p className="mt-3 text-sm font-semibold text-ink">No modules yet</p>
                    <p className="mx-auto mt-1 max-w-sm text-xs text-ink-subtle">Add the first one to replace the week-by-week placeholder.</p>
                    <button className="btn btn-primary btn-sm mt-4" onClick={addModule}>
                      <Plus className="h-4 w-4" /> Add module
                    </button>
                  </div>
                ) : (
                  <ol className="space-y-3">
                    {moduleDraft.map((m, i) => (
                      <li key={i} className="rounded-xl border border-line p-3">
                        <div className="flex items-start gap-3">
                          <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-tint text-xs font-bold text-violet-ink">
                            {i + 1}
                          </span>
                          <div className="grid flex-1 grid-cols-3 gap-3">
                            <Input
                              className="col-span-2"
                              label="Title"
                              required
                              placeholder="e.g. Setting up your online shop"
                              value={m.title}
                              onChange={(e) => updateModule(i, "title", e.target.value)}
                            />
                            <Input
                              label="Duration"
                              placeholder="e.g. 90 min"
                              value={m.duration}
                              onChange={(e) => updateModule(i, "duration", e.target.value)}
                            />
                            <Textarea
                              className="col-span-3"
                              label="What it covers"
                              rows={2}
                              placeholder="One or two lines a member reads before the session."
                              value={m.detail}
                              onChange={(e) => updateModule(i, "detail", e.target.value)}
                            />
                          </div>
                          <div className="flex shrink-0 flex-col gap-1">
                            <button aria-label="Move up" className="btn btn-sm btn-ghost" disabled={i === 0} onClick={() => moveModule(i, -1)}>
                              <ArrowUp className="h-4 w-4" />
                            </button>
                            <button aria-label="Move down" className="btn btn-sm btn-ghost" disabled={i === moduleDraft.length - 1} onClick={() => moveModule(i, 1)}>
                              <ArrowDown className="h-4 w-4" />
                            </button>
                            <button aria-label="Remove module" className="btn btn-sm btn-ghost text-status-danger-ink" onClick={() => removeModule(i)}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
                {modulesDirty && (
                  <p className="mt-3 text-xs text-status-warn-ink">Unsaved changes — members still see the previous outline.</p>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
