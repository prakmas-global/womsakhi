"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MessageSquareHeart,
  Smile,
  Meh,
  Frown,
  Star,
  Users,
  Search,
  ChevronDown,
  SlidersHorizontal,
  Download,
  MoreVertical,
  Calendar,
  ThumbsUp,
  BookOpen,
  Clock,
  FileText,
  MailPlus,
  ArrowUp,
  ArrowDown,
  Eye,
  CheckCircle2,
  Loader2,
  Reply,
  Trash2,
  Send,
} from "lucide-react";
import { Avatar, Badge, Card, Input, Menu, MenuItem, Modal, Select, StatCard, Textarea, NoResults, SkeletonRows, useConfirm, useToast } from "@/design-system";
import DonutChart from "@/components/charts/DonutChart";
import {
  apiListFeedback,
  apiFeedbackStats,
  apiFeedbackOverview,
  apiFeedbackThemes,
  apiProgramRatings,
  apiSetFeedbackStatus,
  apiDeleteFeedback,
  apiRequestFeedback,
  type ApiFeedback,
  type ApiFeedbackTheme,
  type ApiProgramRating,
  type FeedbackStats,
  type FeedbackOverview,
} from "@/lib/feedback-api";
import { memberError } from "@/lib/member-api";
import { ResizableColumns } from "@/layout-engine";

type BadgeTone = "brand" | "violet" | "emerald" | "amber" | "sky" | "rose";

type FeedbackRow = {
  _id: string; // mongo id — used for status/delete calls
  seq: number; // stable order (newest/oldest sort)
  face: React.ElementType;
  face_tone: string;
  text: string;
  user: string;
  email: string;
  type: string;
  t_type: BadgeTone;
  program: string;
  rating: number;
  date: string;
  status: string;
  s_tone: BadgeTone;
};

const TABS = [
  { label: "All Feedback", badge: null },
  { label: "Unresolved", badge: "18" },
  { label: "Positive", badge: null },
  { label: "Negative", badge: null },
  { label: "Suggestions", badge: null },
];

// Map the API's icon names onto the actual lucide components the UI renders.
const FACE_ICON: Record<string, React.ElementType> = { Smile, Meh, Frown };
const THEME_ICON: Record<string, React.ElementType> = { ThumbsUp, BookOpen, Clock, FileText };

// API feedback row -> the exact shape the table/detail modal render.
function toRow(f: ApiFeedback): FeedbackRow {
  return {
    _id: f.id,
    seq: f.seq,
    face: FACE_ICON[f.face] ?? Meh,
    face_tone: f.face_tone,
    text: f.text,
    user: f.user,
    email: f.email,
    type: f.type,
    t_type: f.t_type as BadgeTone,
    program: f.program,
    rating: f.rating,
    date: f.date,
    status: f.status,
    s_tone: f.s_tone as BadgeTone,
  };
}

const FACE_TONE: Record<string, string> = {
  emerald: "bg-status-ok-bg text-status-ok-ink",
  amber: "bg-status-warn-bg text-status-warn-ink",
  rose: "bg-status-danger-bg text-status-danger-ink",
};
const THEME_TONE: Record<string, string> = {
  emerald: "bg-status-ok-bg text-status-ok-ink",
  violet: "bg-violet-tint text-violet-ink",
  amber: "bg-status-warn-bg text-status-warn-ink",
  sky: "bg-status-info-bg text-status-info-ink",
};

const PROGRAMS = [
  "Digital Skills for Women",
  "Entrepreneurship Bootcamp",
  "Handicrafts Mastery Program",
  "Leadership for Change",
  "Sustainable Fashion Workshop",
];
const TYPES = ["Program Feedback", "Suggestion", "Complaint"];
const RATINGS = ["5 Stars", "4 Stars", "3 Stars", "2 Stars", "1 Star"];
const DATE_RANGES = ["Today", "Last 7 Days", "May 20 - Jun 20, 2024", "This Month", "This Year"];
const SORTS = ["Newest First", "Oldest First", "Highest Rating", "Lowest Rating"] as const;
type Sort = (typeof SORTS)[number];

function Stars({ n }: { n: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i < n ? "fill-rating text-rating" : "fill-line-strong text-ink-faint"}`} />
      ))}
    </span>
  );
}

export default function FeedbackPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [overview, setOverview] = useState<FeedbackOverview | null>(null);
  const [themes, setThemes] = useState<ApiFeedbackTheme[]>([]);
  const [programs, setPrograms] = useState<ApiProgramRating[]>([]);

  // filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [programFilter, setProgramFilter] = useState("All Programs");
  const [ratingFilter, setRatingFilter] = useState("All Ratings");
  const [dateRange, setDateRange] = useState("May 20 - Jun 20, 2024");
  const [activeTab, setActiveTab] = useState(0);
  const [sort, setSort] = useState<Sort>("Newest First");
  const [page, setPage] = useState(1);

  // request feedback modal
  const [requestOpen, setRequestOpen] = useState(false);
  const [reqRecipient, setReqRecipient] = useState("");
  const [reqProgram, setReqProgram] = useState("");
  const [reqMessage, setReqMessage] = useState("");
  const [reqSent, setReqSent] = useState(false);

  // detail modal
  const [detail, setDetail] = useState<FeedbackRow | null>(null);

  // insights highlight
  const [activeTheme, setActiveTheme] = useState<string | null>(null);

  // Load the feedback list + all the aggregate cards from the backend.
  const refresh = useCallback(async () => {
    try {
      const [list, s, ov, th, pr] = await Promise.all([
        apiListFeedback({ page_size: 100, sort: "Newest First" }),
        apiFeedbackStats(),
        apiFeedbackOverview(),
        apiFeedbackThemes(),
        apiProgramRatings(),
      ]);
      setRows(list.items.map(toRow));
      setStats(s);
      setOverview(ov);
      setThemes(th);
      setPrograms(pr);
    } catch {
      /* leave current data; a toast could surface the error */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openRequest = () => {
    setReqSent(false);
    setRequestOpen(true);
  };

  const submitRequest = async () => {
    try {
      await apiRequestFeedback({ recipient: reqRecipient, program: reqProgram, message: reqMessage });
      setReqSent(true);
      setReqRecipient("");
      setReqProgram("");
      setReqMessage("");
    } catch (err) {
      toast.error("Could not send the request", { description: memberError(err) });
    }
  };

  const setStatus = async (id: string, status: string) => {
    try {
      const updated = await apiSetFeedbackStatus(id, status);
      setDetail((d) => (d && d._id === id ? toRow(updated) : d));
      await refresh();
    } catch (err) {
      toast.error("Could not update the status", { description: memberError(err) });
    }
  };

  const deleteRow = async (id: string) => {
    if (!(await confirm({
      title: "Delete this feedback?",
      description: "This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    }))) return;
    try {
      await apiDeleteFeedback(id);
      setDetail((d) => (d && d._id === id ? null : d));
      await refresh();
      toast.success("Feedback deleted");
    } catch (err) {
      toast.error("Could not delete it", { description: memberError(err) });
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows.filter((r) => {
      if (q && !(r.text.toLowerCase().includes(q) || r.user.toLowerCase().includes(q) || r.program.toLowerCase().includes(q))) return false;
      if (typeFilter !== "All Types" && r.type !== typeFilter) return false;
      if (programFilter !== "All Programs" && r.program !== programFilter) return false;
      if (ratingFilter !== "All Ratings" && r.rating !== Number(ratingFilter[0])) return false;
      // tabs
      if (activeTab === 1 && !(r.status === "Open" || r.status === "In Review")) return false;
      if (activeTab === 2 && r.rating < 4) return false;
      if (activeTab === 3 && r.rating > 2) return false;
      if (activeTab === 4 && r.type !== "Suggestion") return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "Newest First") return b.seq - a.seq;
      if (sort === "Oldest First") return a.seq - b.seq;
      if (sort === "Highest Rating") return b.rating - a.rating;
      return a.rating - b.rating;
    });
    return list;
  }, [rows, search, typeFilter, programFilter, ratingFilter, activeTab, sort]);

  const exportCsv = () => {
    const header = ["User", "Email", "Type", "Program", "Rating", "Date", "Status", "Feedback"];
    const lines = [header.join(",")];
    for (const r of filtered) {
      const cells = [r.user, r.email, r.type, r.program, String(r.rating), r.date, r.status, r.text].map(
        (c) => `"${String(c).replace(/"/g, '""')}"`,
      );
      lines.push(cells.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "feedback.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Live aggregates mapped to the exact shapes the cards render.
  const overviewData = overview?.items.map((o) => ({ name: o.name, value: o.value, color: o.color })) ?? [];
  const overviewLegend = overview?.items.map((o) => ({ name: o.name, value: o.legend, color: o.color })) ?? [];
  const topPrograms = programs.map((p) => ({ name: p.name, rating: p.rating }));
  const themeCards = themes.map((t) => ({
    icon: THEME_ICON[t.icon] ?? ThumbsUp,
    tone: t.tone,
    label: t.label,
    mentions: t.mentions,
    delta: t.delta,
    up: t.up,
  }));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink"><MessageSquareHeart className="h-6 w-6" /></span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Feedback</h1>
            <p className="mt-1 text-sm text-ink-subtle">Collect, manage and analyze feedback to improve our services and programs.</p>
          </div>
        </div>
        <button onClick={openRequest} className="btn btn-primary"><MailPlus className="h-4 w-4" /> Request Feedback</button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total Feedback" value={stats?.total_feedback ?? "0"} icon={MessageSquareHeart} tone="violet" deltaNote="All time" />
        <StatCard label="Average Rating" value={stats?.average_rating ?? "0"} icon={Smile} tone="emerald" deltaNote="All time" />
        <StatCard label="Positive Feedback" value={stats?.positive_percentage ?? "0"} icon={Star} tone="amber" delta={stats?.positive_delta ?? "0"} deltaNote="vs last 30 days" />
        <StatCard label="Responses This Month" value={stats?.responses_this_month ?? "0"} icon={MessageSquareHeart} tone="sky" delta={stats?.responses_delta ?? "0"} />
        <StatCard label="Feedback Users" value={stats?.feedback_users ?? "0"} icon={Users} tone="brand" deltaNote="Unique users" />
      </div>

      {/* filters */}
      <Card className="mt-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[160px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search feedback..." className="w-full rounded-lg border border-line-strong py-2 pl-9 pr-3 text-sm outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50" />
          </div>
          <Menu align="left" trigger={<button className="btn btn-sm btn-outline">{typeFilter} <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" /></button>}>
            <MenuItem onClick={() => { setTypeFilter("All Types"); setPage(1); }}>All Types</MenuItem>
            {TYPES.map((t) => <MenuItem key={t} onClick={() => { setTypeFilter(t); setPage(1); }}>{t}</MenuItem>)}
          </Menu>
          <Menu align="left" trigger={<button className="btn btn-sm btn-outline">{programFilter} <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" /></button>}>
            <MenuItem onClick={() => { setProgramFilter("All Programs"); setPage(1); }}>All Programs</MenuItem>
            {PROGRAMS.map((p) => <MenuItem key={p} onClick={() => { setProgramFilter(p); setPage(1); }}>{p}</MenuItem>)}
          </Menu>
          <Menu align="left" trigger={<button className="btn btn-sm btn-outline">{ratingFilter} <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" /></button>}>
            <MenuItem onClick={() => { setRatingFilter("All Ratings"); setPage(1); }}>All Ratings</MenuItem>
            {RATINGS.map((r) => <MenuItem key={r} onClick={() => { setRatingFilter(r); setPage(1); }}>{r}</MenuItem>)}
          </Menu>
          <Menu align="left" trigger={<button className="btn btn-sm btn-outline"><Calendar className="h-3.5 w-3.5" /> {dateRange}</button>}>
            {DATE_RANGES.map((d) => <MenuItem key={d} icon={Calendar} onClick={() => setDateRange(d)}>{d}</MenuItem>)}
          </Menu>
          <Menu align="left" trigger={<button className="btn btn-sm btn-outline"><SlidersHorizontal className="h-3.5 w-3.5" /> Filters</button>}>
            <MenuItem icon={Star} onClick={() => { setRatingFilter("5 Stars"); setPage(1); }}>Only 5-star feedback</MenuItem>
            <MenuItem icon={MessageSquareHeart} onClick={() => { setTypeFilter("Suggestion"); setPage(1); }}>Only suggestions</MenuItem>
            <MenuItem icon={SlidersHorizontal} onClick={() => { setTypeFilter("All Types"); setProgramFilter("All Programs"); setRatingFilter("All Ratings"); setSearch(""); setPage(1); }}>Clear all filters</MenuItem>
          </Menu>
          <button onClick={exportCsv} className="btn btn-sm btn-outline ml-auto"><Download className="h-3.5 w-3.5" /> Export</button>
        </div>
      </Card>

      <ResizableColumns id="feedback" defaultSize={0.75} className="mt-6 gap-6">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <div className="flex flex-wrap items-center gap-5 text-sm">
              {TABS.map((t, i) => (
                <button key={t.label} onClick={() => { setActiveTab(i); setPage(1); }} className={`-mb-px flex items-center gap-1.5 border-b-2 pb-3 font-medium ${i === activeTab ? "border-brand-600 text-brand-ink" : "border-transparent text-ink-subtle hover:text-ink-muted"}`}>
                  {t.label}
                  {t.badge && <span className="rounded-full bg-status-warn-bg px-1.5 text-2xs font-bold text-status-warn-ink">{t.badge}</span>}
                </button>
              ))}
            </div>
            <Menu trigger={<button className="btn btn-sm btn-outline">Sort by {sort} <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" /></button>}>
              {SORTS.map((s) => <MenuItem key={s} onClick={() => setSort(s)}>{s}</MenuItem>)}
            </Menu>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-225 text-left">
              <thead>
                <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                  <th scope="col" className="px-2 py-3">Feedback</th>
                  <th scope="col" className="px-2 py-3">User</th>
                  <th scope="col" className="px-2 py-3">Type</th>
                  <th scope="col" className="px-2 py-3">Program / Service</th>
                  <th scope="col" className="whitespace-nowrap px-2 py-3">Rating</th>
                  <th scope="col" className="whitespace-nowrap px-2 py-3">Date</th>
                  <th scope="col" className="whitespace-nowrap px-2 py-3">Status</th>
                  <th scope="col" className="px-2 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((r) => (
                  <tr key={r._id} onClick={() => setDetail(r)} className="align-top text-sm hover:bg-surface-hover/60 cursor-pointer">
                    <td className="px-2 py-3">
                      <div className="flex items-start gap-2.5">
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${FACE_TONE[r.face_tone]}`}><r.face className="h-4.5 w-4.5" /></span>
                        <p className="max-w-[240px] text-xs text-ink-muted">{r.text}</p>
                      </div>
                    </td>
                    <td className="px-2 py-3"><span className="flex items-center gap-2"><Avatar name={r.user} size="xs" /><span><span className="block text-ink-muted">{r.user}</span><span className="block text-2xs text-ink-subtle">{r.email}</span></span></span></td>
                    <td className="px-2 py-3"><Badge tone={r.t_type}>{r.type}</Badge></td>
                    <td className="max-w-[140px] px-2 py-3 text-xs text-ink-subtle">{r.program}</td>
                    <td className="whitespace-nowrap px-2 py-3"><Stars n={r.rating} /></td>
                    <td className="whitespace-nowrap px-2 py-3 text-xs text-ink-subtle">{r.date}</td>
                    <td className="whitespace-nowrap px-2 py-3"><Badge tone={r.s_tone}>{r.status}</Badge></td>
                    <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                      <Menu trigger={<button aria-label={`More actions for feedback from ${r.user}`} className="text-ink-subtle hover:text-ink-muted"><MoreVertical className="h-4 w-4" /></button>}>
                        <MenuItem icon={Eye} onClick={() => setDetail(r)}>View details</MenuItem>
                        <MenuItem icon={CheckCircle2} onClick={() => setStatus(r._id, "Resolved")}>Mark Resolved</MenuItem>
                        <MenuItem icon={Loader2} onClick={() => setStatus(r._id, "In Review")}>Mark In Review</MenuItem>
                        <MenuItem icon={Reply} onClick={() => setDetail(r)}>Reply</MenuItem>
                        <MenuItem icon={Trash2} danger onClick={() => deleteRow(r._id)}>Delete</MenuItem>
                      </Menu>
                    </td>
                  </tr>
                ))}
                {loading && rows.length === 0 && (
                  <SkeletonRows rows={6} cols={8} />
                )}
                {!loading && filtered.length === 0 && (
                  <tr className="text-sm">
                    <td colSpan={8} className="px-2 py-2">
                      <NoResults icon={MessageSquareHeart} thing="feedback" filtered compact />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <p className="text-ink-subtle">Showing 1 to {filtered.length} of {stats?.total_feedback ?? "1,248"} feedback</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-line-strong text-ink-subtle">‹</button>
              {["1", "2", "3"].map((n) => (
                <button key={n} onClick={() => setPage(Number(n))} className={`flex h-8 w-8 items-center justify-center rounded-lg ${page === Number(n) ? "bg-brand-600 font-semibold text-white" : "border border-line-strong text-ink-subtle"}`}>{n}</button>
              ))}
              <span className="px-1 text-ink-subtle">…</span>
              <button onClick={() => setPage(25)} className={`flex h-8 w-8 items-center justify-center rounded-lg ${page === 25 ? "bg-brand-600 font-semibold text-white" : "border border-line-strong text-ink-subtle"}`}>25</button>
              <button onClick={() => setPage((p) => Math.min(25, p + 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-line-strong text-ink-subtle">›</button>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-ink">Feedback Overview</h2>
              <Menu trigger={<button className="btn btn-sm btn-outline">{dateRange === "May 20 - Jun 20, 2024" ? "Last 30 Days" : dateRange} <ChevronDown className="h-3 w-3" /></button>}>
                {DATE_RANGES.map((d) => <MenuItem key={d} icon={Calendar} onClick={() => setDateRange(d)}>{d}</MenuItem>)}
              </Menu>
            </div>
            <div className="flex flex-col items-center gap-4">
              <DonutChart data={overviewData} centerValue={overview?.total ?? "0"} centerLabel={overview?.center_label ?? "Total"} size={150} thickness={18} />
              <ul className="w-full space-y-2.5">
                {overviewLegend.map((o) => (
                  <li key={o.name} className="flex items-center justify-between text-xs">
                    <span className="flex min-w-0 items-center gap-1.5 text-ink-muted"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: o.color }} /> <span className="truncate">{o.name}</span></span>
                    <span className="shrink-0 whitespace-nowrap font-medium text-ink-subtle">{o.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-ink">Top Programs by Feedback</h2>
              <Menu trigger={<button className="text-xs font-semibold text-brand-ink transition hover:underline">View All</button>}>
                {topPrograms.map((p) => <MenuItem key={p.name} icon={Star} onClick={() => { setProgramFilter(p.name); setPage(1); }}>{p.name}</MenuItem>)}
              </Menu>
            </div>
            <ul className="space-y-2.5">
              {topPrograms.map((p) => (
                <li key={p.name} className="flex items-center gap-2 text-sm">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-tint text-brand-ink"><Star className="h-3.5 w-3.5" /></span>
                  <span className="flex-1 text-ink-muted">{p.name}</span>
                  <span className="flex items-center gap-1 font-semibold text-status-warn-ink"><Star className="h-3.5 w-3.5 fill-rating text-rating" /> {p.rating}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="bg-linear-to-br from-violet-50 to-brand-50">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface text-violet-ink shadow-sm"><MailPlus className="h-5 w-5" /></span>
              <div><p className="text-sm font-semibold text-ink">Collect more feedback</p><p className="text-xs text-ink-subtle">Send feedback requests to participants and improve your programs.</p></div>
            </div>
            <button onClick={openRequest} className="btn btn-primary btn-block mt-3"><MailPlus className="h-4 w-4" /> Request Feedback</button>
          </Card>
        </div>
      </ResizableColumns>

      {/* what are people saying */}
      <Card className="mt-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-ink">What are people saying?</h2>
            <p className="text-xs text-ink-subtle">Common themes from recent feedback</p>
          </div>
          <Menu trigger={<button className="flex items-center gap-1.5 text-sm font-semibold text-violet-ink transition hover:underline">View All Insights →</button>}>
            {themeCards.map((t) => <MenuItem key={t.label} icon={t.icon} onClick={() => setActiveTheme(t.label)}>{t.label}</MenuItem>)}
          </Menu>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {themeCards.map((t) => (
            <button key={t.label} type="button" onClick={() => setActiveTheme((v) => (v === t.label ? null : t.label))} className={`rounded-xl border p-4 text-left transition ${activeTheme === t.label ? "border-brand-300 ring-2 ring-brand-100" : "border-line hover:border-line-strong"}`}>
              <div className="flex items-center justify-between">
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${THEME_TONE[t.tone]}`}><t.icon className="h-4.5 w-4.5" /></span>
                <span className={`flex items-center gap-0.5 text-xs font-semibold ${t.up ? "text-status-ok-ink" : "text-status-danger-ink"}`}>{t.up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}{t.delta}</span>
              </div>
              <p className="mt-3 text-sm font-semibold text-ink">{t.label}</p>
              <p className="text-xs text-ink-subtle">{t.mentions}</p>
            </button>
          ))}
        </div>
      </Card>

      {/* Request Feedback modal */}
      <Modal
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        title="Request Feedback"
        description="Send a feedback request to a participant."
        icon={MailPlus}
        iconTone="brand"
        footer={
          <>
            <button onClick={() => setRequestOpen(false)} className="btn btn-outline">Cancel</button>
            <button onClick={submitRequest} className="btn btn-primary"><Send className="h-4 w-4" /> Send Request</button>
          </>
        }
      >
        {reqSent && (
          <div className="col-span-2 mb-4 flex items-center gap-2 rounded-xl bg-status-ok-bg px-4 py-3 text-sm font-medium text-status-ok-ink">
            <CheckCircle2 className="h-4 w-4" /> Feedback request sent successfully.
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Input label="Recipient" placeholder="Name or email" value={reqRecipient} onChange={(e) => setReqRecipient(e.target.value)} />
          <Select label="Program" options={PROGRAMS} value={reqProgram} onChange={(e) => setReqProgram(e.target.value)} placeholder="Select a program" />
          <Textarea className="col-span-2" label="Message" rows={4} placeholder="Write a short message inviting feedback…" value={reqMessage} onChange={(e) => setReqMessage(e.target.value)} />
        </div>
      </Modal>

      {/* Feedback detail modal */}
      <Modal
        open={detail !== null}
        onClose={() => setDetail(null)}
        title="Feedback Details"
        icon={MessageSquareHeart}
        iconTone="violet"
        size="lg"
        footer={
          detail && (
            <>
              <button onClick={() => setStatus(detail._id, "In Review")} className="btn btn-outline"><Loader2 className="h-4 w-4" /> Mark In Review</button>
              <button onClick={() => deleteRow(detail._id)} className="btn btn-outline text-status-danger-ink"><Trash2 className="h-4 w-4" /> Delete</button>
              <button onClick={() => setStatus(detail._id, "Resolved")} className="btn btn-primary"><CheckCircle2 className="h-4 w-4" /> Mark Resolved</button>
            </>
          )
        }
      >
        {detail && (
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 flex items-start gap-3">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${FACE_TONE[detail.face_tone]}`}><detail.face className="h-6 w-6" /></span>
              <p className="text-sm text-ink-muted">{detail.text}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">User</p>
              <p className="flex items-center gap-2 text-sm text-ink-muted"><Avatar name={detail.user} size="xs" /> {detail.user}</p>
              <p className="mt-0.5 text-xs text-ink-subtle">{detail.email}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Type</p>
              <Badge tone={detail.t_type}>{detail.type}</Badge>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Program / Service</p>
              <p className="text-sm text-ink-muted">{detail.program}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Rating</p>
              <Stars n={detail.rating} />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Date</p>
              <p className="text-sm text-ink-muted">{detail.date}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Status</p>
              <Badge tone={detail.s_tone}>{detail.status}</Badge>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
