"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FileText,
  FileClock,
  Download,
  Timer,
  Users,
  Sparkles,
  ChevronDown,
  Search,
  Plus,
  Eye,
  MoreVertical,
  SlidersHorizontal,
  FilePlus2,
  CalendarClock,
  LayoutTemplate,
  DatabaseZap,
  CircleCheck,
  ArrowRight,
  CalendarDays,
  BriefcaseBusiness,
  DollarSign,
  Megaphone,
  Play,
  Pencil,
  Trash2,
  ListFilter,
} from "lucide-react";
import { Avatar, Badge, Card, Input, Menu, MenuItem, Modal, Select, StatCard, Switch, Textarea, type Tone, NoResults, SkeletonRows, useToast, useConfirm } from "@/design-system";
import AreaTrend from "@/components/charts/AreaTrend";
import BarTrend from "@/components/charts/BarTrend";
import DonutChart from "@/components/charts/DonutChart";
import { TONE_BG } from "@/lib/tones";
import {
  apiListReports,
  apiReportStats,
  apiRecentReports,
  apiScheduledReports,
  apiReportTemplates,
  apiCreateReport,
  apiUpdateReport,
  apiDeleteReport,
  apiRunReport,
  apiExportReports,
  type ApiReport,
  type ReportsOverview,
  type ReportTemplate,
} from "@/lib/reports-api";
import { memberError } from "@/lib/member-api";
import { ResizableColumns } from "@/layout-engine";

// Backend stores the row/template icon by NAME; map it back to a lucide icon.
const ICON_MAP: Record<string, React.ElementType> = {
  Users,
  CalendarDays,
  BriefcaseBusiness,
  DollarSign,
  Megaphone,
  Sparkles,
  FileText,
};
const iconFor = (name: string): React.ElementType => ICON_MAP[name] ?? Sparkles;

type Report = {
  _id: string; // mongo id — used for update / delete / run
  icon: React.ElementType;
  name: string;
  desc: string;
  cat: string;
  tone: Tone;
  type: string;
  sched: string;
  last: string;
  by: string;
};

function toReport(r: ApiReport): Report {
  return {
    _id: r.id,
    icon: iconFor(r.icon),
    name: r.name,
    desc: r.description,
    cat: r.category,
    tone: (r.tone as Tone) || "slate",
    type: r.type,
    sched: r.schedule,
    last: r.last_generated,
    by: r.created_by,
  };
}

type RecentItem = { icon: React.ElementType; name: string; when: string };
type ScheduledItem = { name: string; when: string; status: string };

const QUICK = [
  { icon: FilePlus2, tone: "brand", title: "Create New Report", desc: "Build a custom report from scratch" },
  { icon: CalendarClock, tone: "violet", title: "Schedule Report", desc: "Automate and schedule report delivery" },
  { icon: LayoutTemplate, tone: "emerald", title: "Manage Templates", desc: "View and manage report templates" },
  { icon: DatabaseZap, tone: "amber", title: "Export Data", desc: "Export raw data for advanced analysis" },
];

const CATEGORIES = ["User Activity", "Appointments", "Program & Services", "Financial", "Marketing", "Others"];
const TYPES = ["Summary", "Detailed", "Custom"];
const SCHEDULES = ["Daily", "Weekly", "Monthly", "On Demand"];

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

type FormState = { name: string; cat: string; type: string; sched: string; desc: string };
const EMPTY_FORM: FormState = { name: "", cat: "", type: "", sched: "", desc: "" };

export default function ReportsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<ReportsOverview | null>(null);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledItem[]>([]);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All Categories");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const [detail, setDetail] = useState<Report | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<FormState>({ ...EMPTY_FORM, sched: "Daily" });

  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [widgets, setWidgets] = useState({ generated: true, dataPoints: true, categories: true });

  const tableRef = useRef<HTMLDivElement>(null);

  // Pull the table rows, overview snapshot and side panels from the backend.
  const refresh = useCallback(async () => {
    try {
      const [list, s, rec, sch, tpl] = await Promise.all([
        apiListReports({ page_size: 100 }),
        apiReportStats(),
        apiRecentReports(4),
        apiScheduledReports(),
        apiReportTemplates(),
      ]);
      setReports(list.items.map(toReport));
      setTotal(list.total);
      setStats(s);
      setRecent(rec.map((r) => ({ icon: iconFor(r.icon), name: r.name, when: r.last_generated })));
      setScheduled(sch.map((r) => ({ name: r.name, when: r.schedule_detail, status: r.status })));
      setTemplates(tpl);
    } catch {
      /* leave current data in place; a toast could surface the error */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      const matchQ =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.desc.toLowerCase().includes(q) ||
        r.cat.toLowerCase().includes(q);
      const matchCat = catFilter === "All Categories" || r.cat === catFilter;
      const matchType = typeFilter === "All Types" || r.type === typeFilter;
      return matchQ && matchCat && matchType;
    });
  }, [reports, search, catFilter, typeFilter]);

  // Overview widgets, fed from the live snapshot.
  const genTrend = stats?.generated_trend ?? [];
  const dataTrend = useMemo(
    () => (stats?.data_points_trend ?? []).map((value, i) => ({ label: String(i), value })),
    [stats],
  );
  const cats = stats?.top_categories ?? [];

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setCreateOpen(true);
  };

  const openEdit = (r: Report) => {
    setEditingId(r._id);
    setForm({ name: r.name, cat: r.cat, type: r.type, sched: r.sched, desc: r.desc });
    setCreateOpen(true);
  };

  const submitReport = async () => {
    if (!form.name.trim()) return;
    const body = {
      name: form.name.trim(),
      description: form.desc,
      category: form.cat || undefined,
      type: form.type || undefined,
      schedule: form.sched || undefined,
    };
    try {
      if (editingId) await apiUpdateReport(editingId, body);
      else await apiCreateReport(body);
      await refresh();
      setCreateOpen(false);
    } catch (err) {
      toast.error("Could not save the report", { description: memberError(err) });
    }
  };

  const deleteReport = async (id: string) => {
    if (!(await confirm({
      title: "Delete this report?",
      description: "The saved definition goes; data already exported is unaffected.",
      confirmLabel: "Delete",
      danger: true,
    }))) return;
    try {
      await apiDeleteReport(id);
      setDetail((d) => (d && d._id === id ? null : d));
      await refresh();
    } catch (err) {
      toast.error("Could not delete the report", { description: memberError(err) });
    }
  };

  const runReport = async (id: string) => {
    try {
      await apiRunReport(id);
      await refresh();
    } catch (err) {
      toast.error("Could not run the report", { description: memberError(err) });
    }
  };

  const exportAll = async () => {
    try {
      const blob = await apiExportReports({
        q: search.trim() || undefined,
        category: catFilter === "All Categories" ? undefined : catFilter,
        type: typeFilter === "All Types" ? undefined : typeFilter,
      });
      triggerDownload(blob, "reports-export.csv");
    } catch (err) {
      toast.error("Could not export the reports", { description: memberError(err) });
    }
  };

  const downloadOne = async (r: Report) => {
    try {
      const blob = await apiExportReports({ q: r.name });
      triggerDownload(blob, "report.csv");
    } catch {
      /* ignore */
    }
  };

  const submitSchedule = async () => {
    if (!scheduleForm.name.trim()) {
      setScheduleOpen(false);
      return;
    }
    try {
      await apiCreateReport({
        name: scheduleForm.name.trim(),
        category: scheduleForm.cat || undefined,
        schedule: scheduleForm.sched || undefined,
      });
      await refresh();
    } catch (err) {
      toast.error("Could not save the schedule", { description: memberError(err) });
    }
    setScheduleOpen(false);
  };

  const scrollToTable = () => {
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openRecent = (name: string) => {
    const r = reports.find((x) => x.name === name);
    if (r) setDetail(r);
  };

  const runQuickAction = (title: string) => {
    if (title === "Create New Report") openCreate();
    else if (title === "Schedule Report") setScheduleOpen(true);
    else if (title === "Manage Templates") setTemplatesOpen(true);
    else if (title === "Export Data") exportAll();
  };

  return (
    <div>
      <div className="mb-6 flex items-start gap-3">
        <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
          <FileText className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Reports</h1>
          <p className="mt-1 text-sm text-ink-subtle">Generate insights and analyze key data across your platform.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total Reports" value={(stats?.total_reports ?? 0).toLocaleString()} icon={FileText} tone="violet" deltaNote="All time created" />
        <StatCard label="Scheduled Reports" value={(stats?.scheduled_reports ?? 0).toLocaleString()} icon={FileClock} tone="emerald" deltaNote="Automated reports" />
        <StatCard label="Reports Generated" value={(stats?.reports_generated ?? 0).toLocaleString()} icon={Download} tone="sky" deltaNote="This month" />
        <StatCard label="Avg. Generation Time" value={stats?.avg_generation_time ?? "—"} icon={Timer} tone="amber" deltaNote="This month" />
        <StatCard label="Data Points Analyzed" value={stats?.data_points_analyzed ?? "—"} icon={Users} tone="brand" deltaNote="This month" />
      </div>

      {/* overview */}
      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-ink">Reports Overview</h2>
          <div className="flex items-center gap-2">
            <button className="btn btn-secondary" onClick={() => setCustomizeOpen(true)}><LayoutTemplate className="h-3.5 w-3.5" /> Customize Dashboard</button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {widgets.generated && (
            <div className="rounded-xl border border-line p-4">
              <p className="text-sm text-ink-subtle">Reports Generated</p>
              <p className="font-display text-xl font-bold text-ink">{(stats?.reports_generated ?? 0).toLocaleString()} <span className="text-xs font-semibold text-status-ok-ink">↑ {stats?.reports_generated_delta ?? 0}%</span></p>
              <AreaTrend data={genTrend} color="var(--color-violet-500)" height={140} showAxis={false} />
            </div>
          )}
          {widgets.dataPoints && (
            <div className="rounded-xl border border-line p-4">
              <p className="text-sm text-ink-subtle">Data Points Analyzed</p>
              <p className="font-display text-xl font-bold text-ink">{stats?.data_points_analyzed ?? "—"} <span className="text-xs font-semibold text-status-ok-ink">↑ {stats?.data_points_delta ?? 0}%</span></p>
              <BarTrend data={dataTrend} color="var(--status-info-solid)" height={140} radius={3} />
            </div>
          )}
          {widgets.categories && (
            <div className="rounded-xl border border-line p-4">
              <p className="mb-2 text-sm text-ink-subtle">Top Report Categories</p>
              <div className="flex items-center gap-3">
                <DonutChart data={cats} centerValue="" size={110} thickness={16} />
                <ul className="flex-1 space-y-1.5">
                  {cats.map((c) => (
                    <li key={c.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-ink-muted"><span className="h-2 w-2 rounded-full" style={{ background: c.color }} /> {c.name}</span>
                      <span className="font-medium text-ink-subtle">{c.value}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* table + side */}
      <ResizableColumns id="reports" defaultSize={0.75} className="mt-6 gap-6">
        <Card>
          <h2 ref={tableRef} className="mb-4 font-display text-base font-semibold text-ink">All Reports</h2>
          <div className="mb-4 flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search reports..." className="w-full rounded-lg border border-line-strong py-2 pl-9 pr-3 text-sm outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50" />
            </div>
            <Menu
              align="left"
              trigger={<button className="btn btn-sm btn-outline">{catFilter} <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" /></button>}
            >
              <MenuItem icon={ListFilter} onClick={() => { setCatFilter("All Categories"); setPage(1); }}>All Categories</MenuItem>
              {CATEGORIES.map((c) => (
                <MenuItem key={c} onClick={() => { setCatFilter(c); setPage(1); }}>{c}</MenuItem>
              ))}
            </Menu>
            <Menu
              align="left"
              trigger={<button className="btn btn-sm btn-outline">{typeFilter} <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" /></button>}
            >
              <MenuItem icon={ListFilter} onClick={() => { setTypeFilter("All Types"); setPage(1); }}>All Types</MenuItem>
              {TYPES.map((t) => (
                <MenuItem key={t} onClick={() => { setTypeFilter(t); setPage(1); }}>{t}</MenuItem>
              ))}
            </Menu>
            <button className="btn btn-sm btn-outline" onClick={exportAll}><Download className="h-3.5 w-3.5" /> Export</button>
            <button className="btn btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> Create Report</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-205 text-left">
              <thead>
                <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                  <th scope="col" className="px-2 py-3">Report Name</th>
                  <th scope="col" className="px-2 py-3">Category</th>
                  <th scope="col" className="px-2 py-3 whitespace-nowrap">Type</th>
                  <th scope="col" className="px-2 py-3 whitespace-nowrap">Schedule</th>
                  <th scope="col" className="px-2 py-3 whitespace-nowrap">Last Generated</th>
                  <th scope="col" className="px-2 py-3">Created By</th>
                  <th scope="col" className="px-2 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((r) => (
                  <tr key={r._id} onClick={() => setDetail(r)} className="cursor-pointer text-sm hover:bg-surface-hover/60">
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${TONE_BG[r.tone] ?? "bg-surface-inset text-ink-subtle"}`}><r.icon className="h-4.5 w-4.5" /></span>
                        <div><p className="font-semibold text-ink">{r.name}</p><p className="text-xs text-ink-subtle">{r.desc}</p></div>
                      </div>
                    </td>
                    <td className="px-2 py-3"><Badge tone={r.tone}>{r.cat}</Badge></td>
                    <td className="px-2 py-3 whitespace-nowrap text-ink-subtle">{r.type}</td>
                    <td className="px-2 py-3 whitespace-nowrap text-ink-subtle">{r.sched}</td>
                    <td className="px-2 py-3 whitespace-nowrap text-xs text-ink-subtle">{r.last}</td>
                    <td className="px-2 py-3">
                      <span className="flex items-center gap-2"><Avatar name={r.by} size="xs" /><span className="text-ink-muted">{r.by}</span></span>
                    </td>
                    <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2 text-ink-subtle">
                        <button aria-label={`View ${r.name}`} className="hover:text-ink-muted" onClick={() => setDetail(r)}><Eye className="h-4 w-4" /></button>
                        <button aria-label={`Download ${r.name}`} className="hover:text-ink-muted" onClick={() => downloadOne(r)}><Download className="h-4 w-4" /></button>
                        <Menu
                          trigger={<button aria-label={`More actions for ${r.name}`} className="hover:text-ink-muted"><MoreVertical className="h-4 w-4" /></button>}
                        >
                          <MenuItem icon={Eye} onClick={() => setDetail(r)}>View details</MenuItem>
                          <MenuItem icon={Play} onClick={() => runReport(r._id)}>Run now</MenuItem>
                          <MenuItem icon={Pencil} onClick={() => openEdit(r)}>Edit</MenuItem>
                          <MenuItem icon={Trash2} danger onClick={() => deleteReport(r._id)}>Delete</MenuItem>
                        </Menu>
                      </div>
                    </td>
                  </tr>
                ))}
                {loading && reports.length === 0 && (
                  <SkeletonRows rows={6} cols={7} />
                )}
                {!loading && filtered.length === 0 && (
                  <tr className="text-sm">
                    <td colSpan={7} className="px-2 py-2">
                      <NoResults icon={FileText} thing="reports" filtered compact />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <p className="text-ink-subtle">Showing 1 to {filtered.length} of {total} reports</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-line-strong text-ink-subtle">‹</button>
              {["1", "2", "3"].map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(Number(n))}
                  className={
                    page === Number(n)
                      ? "flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 font-semibold text-white"
                      : "flex h-8 w-8 items-center justify-center rounded-lg border border-line-strong text-ink-subtle"
                  }
                >
                  {n}
                </button>
              ))}
              <span className="px-1 text-ink-subtle">…</span>
              <button onClick={() => setPage(7)} className={page === 7 ? "flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 font-semibold text-white" : "flex h-8 w-8 items-center justify-center rounded-lg border border-line-strong text-ink-subtle"}>7</button>
              <button onClick={() => setPage((p) => Math.min(7, p + 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-line-strong text-ink-subtle">›</button>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-display text-base font-semibold text-ink">Quick Actions</h2>
            <div className="space-y-2">
              {QUICK.map((q) => (
                <button key={q.title} onClick={() => runQuickAction(q.title)} className="flex w-full items-center gap-3 rounded-xl border border-line p-3 text-left hover:bg-surface-hover">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${TONE_BG[q.tone]}`}><q.icon className="h-4.5 w-4.5" /></span>
                  <span><span className="block text-sm font-semibold text-ink">{q.title}</span><span className="block text-xs text-ink-subtle">{q.desc}</span></span>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-ink">Recent Reports</h2>
              <button className="text-xs font-semibold text-brand-ink transition hover:underline" onClick={scrollToTable}>View All</button>
            </div>
            <ul className="space-y-3">
              {recent.map((r) => (
                <li key={r.name}>
                  <button onClick={() => openRecent(r.name)} className="flex w-full items-center gap-3 text-left">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-inset text-ink-subtle"><r.icon className="h-4 w-4" /></span>
                    <div className="flex-1"><p className="text-sm font-medium text-ink-muted">{r.name}</p><p className="text-xs text-ink-subtle">{r.when}</p></div>
                    <CircleCheck className="h-4 w-4 text-status-ok-ink" />
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-ink">Scheduled Reports</h2>
              <button className="text-xs font-semibold text-brand-ink transition hover:underline" onClick={scrollToTable}>View All</button>
            </div>
            <ul className="space-y-3">
              {scheduled.map((s) => (
                <li key={s.name} className="flex items-center justify-between">
                  <div><p className="text-sm font-medium text-ink-muted">{s.name}</p><p className="text-xs text-ink-subtle">{s.when}</p></div>
                  <Badge tone="emerald">{s.status}</Badge>
                </li>
              ))}
            </ul>
            <button className="btn btn-secondary btn-block mt-3" onClick={scrollToTable}>
              <Plus className="h-4 w-4" /> View All Scheduled Reports <ArrowRight className="h-4 w-4" />
            </button>
          </Card>
        </div>
      </ResizableColumns>

      {/* Create / Edit report modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={editingId ? "Edit Report" : "Create Report"}
        description={editingId ? "Update the details of this report." : "Build a new report to add to your library."}
        icon={FilePlus2}
        iconTone="brand"
        size="lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={submitReport}>{editingId ? "Save Changes" : "Create Report"}</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Input label="Report Name" required className="col-span-2" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. User Activity Report" />
          <Select label="Category" options={CATEGORIES} value={form.cat} onChange={(e) => setForm((f) => ({ ...f, cat: e.target.value }))} />
          <Select label="Type" options={TYPES} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} />
          <Select label="Schedule" className="col-span-2" options={SCHEDULES} value={form.sched} onChange={(e) => setForm((f) => ({ ...f, sched: e.target.value }))} />
          <Textarea label="Description" className="col-span-2" value={form.desc} onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))} placeholder="What does this report cover?" />
        </div>
      </Modal>

      {/* Report detail modal */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.name ?? "Report"}
        description={detail?.desc}
        icon={detail?.icon ?? FileText}
        iconTone={detail && detail.tone !== "slate" && detail.tone !== "blue" ? detail.tone : "brand"}
        footer={
          detail && (
            <>
              <button className="btn btn-outline text-status-danger-ink hover:bg-status-danger-bg" onClick={() => detail && deleteReport(detail._id)}>
                <Trash2 className="h-4 w-4" /> Delete
              </button>
              <button className="btn btn-primary" onClick={() => detail && downloadOne(detail)}><Download className="h-4 w-4" /> Download</button>
            </>
          )
        }
      >
        {detail && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="col-span-2 flex items-center gap-2">
              <span className="text-ink-subtle">Category</span>
              <Badge tone={detail.tone}>{detail.cat}</Badge>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Type</p>
              <p className="mt-1 font-medium text-ink-muted">{detail.type}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Schedule</p>
              <p className="mt-1 font-medium text-ink-muted">{detail.sched}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Last Generated</p>
              <p className="mt-1 font-medium text-ink-muted">{detail.last}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Created By</p>
              <span className="mt-1 flex items-center gap-2"><Avatar name={detail.by} size="xs" /><span className="font-medium text-ink-muted">{detail.by}</span></span>
            </div>
          </div>
        )}
      </Modal>

      {/* Schedule report modal */}
      <Modal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        title="Schedule Report"
        description="Automate delivery on a recurring schedule."
        icon={CalendarClock}
        iconTone="violet"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setScheduleOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={submitSchedule}>Schedule</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Input label="Report Name" className="col-span-2" value={scheduleForm.name} onChange={(e) => setScheduleForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Weekly Revenue Report" />
          <Select label="Category" options={CATEGORIES} value={scheduleForm.cat} onChange={(e) => setScheduleForm((f) => ({ ...f, cat: e.target.value }))} />
          <Select label="Frequency" options={SCHEDULES} value={scheduleForm.sched} onChange={(e) => setScheduleForm((f) => ({ ...f, sched: e.target.value }))} />
        </div>
      </Modal>

      {/* Manage templates modal */}
      <Modal
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        title="Manage Templates"
        description="View and manage your saved report templates."
        icon={LayoutTemplate}
        iconTone="emerald"
        footer={<button className="btn btn-primary" onClick={() => setTemplatesOpen(false)}>Done</button>}
      >
        <ul className="space-y-2">
          {templates.map((t) => {
            const Icon = iconFor(t.icon);
            const tone = (t.tone as Tone) || "slate";
            return (
              <li key={t.category} className="flex items-center gap-3 rounded-xl border border-line p-3">
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${TONE_BG[tone] ?? "bg-surface-inset text-ink-subtle"}`}><Icon className="h-4.5 w-4.5" /></span>
                <div className="flex-1"><p className="text-sm font-semibold text-ink">{t.name}</p><p className="text-xs text-ink-subtle">{t.description}</p></div>
                <Badge tone="emerald">{t.status}</Badge>
              </li>
            );
          })}
        </ul>
      </Modal>

      {/* Customize dashboard modal */}
      <Modal
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        title="Customize Dashboard"
        description="Choose which overview widgets to display."
        icon={SlidersHorizontal}
        iconTone="brand"
        footer={<button className="btn btn-primary" onClick={() => setCustomizeOpen(false)}>Done</button>}
      >
        <div className="space-y-2">
          <Switch label="Reports Generated" description="Area trend of generated reports" checked={widgets.generated} onChange={(v) => setWidgets((w) => ({ ...w, generated: v }))} />
          <Switch label="Data Points Analyzed" description="Bar chart of data points" checked={widgets.dataPoints} onChange={(v) => setWidgets((w) => ({ ...w, dataPoints: v }))} />
          <Switch label="Top Report Categories" description="Donut breakdown by category" checked={widgets.categories} onChange={(v) => setWidgets((w) => ({ ...w, categories: v }))} />
        </div>
      </Modal>
    </div>
  );
}
