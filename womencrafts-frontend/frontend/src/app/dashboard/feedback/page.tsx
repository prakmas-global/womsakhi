"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MessageSquareHeart, Smile, Meh, Frown, Star, Users, Search, ChevronDown, SlidersHorizontal, Download,
  MoreVertical, Calendar, ThumbsUp, ThumbsDown, Lightbulb, AlertTriangle, MailPlus, ArrowUp, ArrowDown,
  Eye, CheckCircle2, Loader2, Reply, Trash2, Send, StickyNote, Mail, Lock, RotateCcw,
} from "lucide-react";

import {
  Avatar, Badge, Card, Input, Menu, MenuItem, Modal, Pagination, Select, StatCard, Textarea, NoResults,
  SkeletonRows, useConfirm, useToast,
} from "@/design-system";
import DonutChart from "@/components/charts/DonutChart";
import {
  apiListFeedback, apiFeedbackStats, apiFeedbackOverview, apiFeedbackThemes, apiProgramRatings,
  apiSetFeedbackStatus, apiDeleteFeedback, apiRequestFeedback, apiReplyToFeedback, apiExportFeedback,
  type ApiFeedback, type ApiFeedbackTheme, type ApiProgramRating, type FeedbackStats, type FeedbackOverview,
  type FeedbackListParams,
} from "@/lib/feedback-api";
import { apiClient } from "@/lib/api";
import { memberError } from "@/lib/member-api";
import { ResizableColumns } from "@/layout-engine";

/**
 * Feedback — what members said, and what staff did about it.
 *
 * ── What is real on this screen ──────────────────────────────────────────────
 * Every number is computed on the server from the feedback rows and their
 * dates: this month against last month, the last 30 days against the 30
 * before, a programme's rating from the ratings people gave it. A card with
 * nothing to compare against shows no arrow. The "what are people saying"
 * cards are counted buckets (positive, suggestions, complaints, negative),
 * not themes mined from prose — nothing here does that yet, and a card that
 * pretended to would be worse than none.
 *
 * ── What an admin can do ────────────────────────────────────────────────────
 * Search, filter and page through feedback on the server; open an entry;
 * reply to her (emailed when mail can deliver, stored and labelled honestly
 * when it cannot) or leave an internal note she never sees; move it between
 * Open, In Review and Resolved; delete it; export the filtered set as CSV;
 * and ask a member for feedback, which is written down and emailed when
 * possible. Every write is checked against her permissions and recorded.
 */

type BadgeTone = "brand" | "violet" | "emerald" | "amber" | "sky" | "rose";

const FACE_ICON: Record<string, React.ElementType> = { Smile, Meh, Frown };
const THEME_ICON: Record<string, React.ElementType> = { ThumbsUp, ThumbsDown, Lightbulb, AlertTriangle };

const FACE_TONE: Record<string, string> = {
  emerald: "bg-status-ok-bg text-status-ok-ink",
  amber: "bg-status-warn-bg text-status-warn-ink",
  rose: "bg-status-danger-bg text-status-danger-ink",
};
const THEME_TONE: Record<string, string> = {
  emerald: "bg-status-ok-bg text-status-ok-ink",
  violet: "bg-violet-tint text-violet-ink",
  amber: "bg-status-warn-bg text-status-warn-ink",
  rose: "bg-status-danger-bg text-status-danger-ink",
  sky: "bg-status-info-bg text-status-info-ink",
};

const TABS = ["All Feedback", "Unresolved", "Positive", "Negative", "Suggestions"] as const;
const TYPES = ["Program Feedback", "Suggestion", "Complaint"];
const RATINGS = ["5 Stars", "4 Stars", "3 Stars", "2 Stars", "1 Star"];
const ALL_TIME = "All time";
const DATE_RANGES = [ALL_TIME, "Today", "Last 7 Days", "Last 30 Days", "This Month", "This Year"];
const SORTS = ["Newest First", "Oldest First", "Highest Rating", "Lowest Rating"] as const;
type Sort = (typeof SORTS)[number];
const PAGE_SIZE = 10;

function Stars({ n }: { n: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${n} of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i < n ? "fill-rating text-rating" : "fill-line-strong text-ink-faint"}`} />
      ))}
    </span>
  );
}

function when(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

type RecentRequest = { id: string; recipient: string; recipient_name: string; program: string; requested_by: string; emailed: boolean; at: string };

export default function FeedbackPage() {
  const toast = useToast();
  const confirm = useConfirm();

  // ---- the list, paged on the server ----
  const [rows, setRows] = useState<ApiFeedback[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // ---- the cards ----
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [overview, setOverview] = useState<FeedbackOverview | null>(null);
  const [themes, setThemes] = useState<ApiFeedbackTheme[] | null>(null);
  const [programs, setPrograms] = useState<ApiProgramRating[] | null>(null);

  // ---- filters ----
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [programFilter, setProgramFilter] = useState("All Programs");
  const [ratingFilter, setRatingFilter] = useState("All Ratings");
  const [dateRange, setDateRange] = useState(ALL_TIME);
  const [activeTab, setActiveTab] = useState(0);
  const [sort, setSort] = useState<Sort>("Newest First");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  // ---- modals ----
  const [requestOpen, setRequestOpen] = useState(false);
  const [reqRecipient, setReqRecipient] = useState("");
  const [reqProgram, setReqProgram] = useState("");
  const [reqMessage, setReqMessage] = useState("");
  const [reqResult, setReqResult] = useState<{ emailed: boolean; message: string } | null>(null);
  const [recent, setRecent] = useState<RecentRequest[] | null>(null);
  const [sending, setSending] = useState(false);

  const [detail, setDetail] = useState<ApiFeedback | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyInternal, setReplyInternal] = useState(false);
  const [replying, setReplying] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Typing pauses for a moment before the server is asked.
  useEffect(() => {
    const t = setTimeout(() => { setQ(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const params = useMemo<FeedbackListParams>(() => ({
    q: q || undefined,
    type: typeFilter === "All Types" ? undefined : typeFilter,
    program: programFilter === "All Programs" ? undefined : programFilter,
    rating: ratingFilter === "All Ratings" ? undefined : ratingFilter,
    date_range: dateRange === ALL_TIME ? undefined : dateRange,
    tab: activeTab === 0 ? undefined : TABS[activeTab],
    sort,
    page,
    page_size: PAGE_SIZE,
  }), [q, typeFilter, programFilter, ratingFilter, dateRange, activeTab, sort, page]);

  // The table.
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const list = await apiListFeedback(params);
        if (!live) return;
        setRows(list.items);
        setTotal(list.total);
        setPages(Math.max(1, list.pages));
        setLoadError("");
      } catch (err) {
        if (live) setLoadError(memberError(err));
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, [params, reloadKey]);

  // The cards. The donut and the buckets follow the date range; the stat
  // cards compare fixed periods and do not.
  useEffect(() => {
    let live = true;
    const range = dateRange === ALL_TIME ? undefined : dateRange;
    (async () => {
      const [s, ov, th, pr] = await Promise.allSettled([
        apiFeedbackStats(),
        apiFeedbackOverview(range),
        apiFeedbackThemes(range ?? "Last 30 Days"),
        apiProgramRatings(),
      ]);
      if (!live) return;
      if (s.status === "fulfilled") setStats(s.value);
      if (ov.status === "fulfilled") setOverview(ov.value);
      if (th.status === "fulfilled") setThemes(th.value);
      if (pr.status === "fulfilled") setPrograms(pr.value);
    })();
    return () => { live = false; };
  }, [dateRange, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // Keep the open entry in step with the table after a change.
  const patchRow = useCallback((updated: ApiFeedback) => {
    setRows((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
    setDetail((d) => (d && d.id === updated.id ? updated : d));
  }, []);

  // ---- actions ----
  const setStatus = async (row: ApiFeedback, status: string) => {
    if (row.status === status) return;
    try {
      const updated = await apiSetFeedbackStatus(row.id, status);
      patchRow(updated);
      toast.success(`Marked as ${status}`, { description: `Feedback from ${row.user}.` });
      reload();
    } catch (err) {
      toast.error("Could not update the status", { description: memberError(err) });
    }
  };

  const deleteRow = async (row: ApiFeedback) => {
    const ok = await confirm({
      title: `Delete feedback from ${row.user}?`,
      description: "It disappears from every count and cannot be recovered.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiDeleteFeedback(row.id);
      setDetail((d) => (d && d.id === row.id ? null : d));
      toast.success("Feedback deleted");
      reload();
    } catch (err) {
      toast.error("Could not delete it", { description: memberError(err) });
    }
  };

  const sendReply = async () => {
    if (!detail || !replyText.trim()) return;
    setReplying(true);
    try {
      const updated = await apiReplyToFeedback(detail.id, { text: replyText.trim(), internal: replyInternal });
      patchRow(updated);
      const last = updated.replies[updated.replies.length - 1];
      if (replyInternal) toast.success("Note saved", { description: "Only staff can see it." });
      else if (last?.emailed) toast.success(`Reply emailed to ${updated.user}`);
      else toast.success("Reply saved", { description: "Email is not set up on this server, so it was stored but not sent." });
      setReplyText("");
      setReplyInternal(false);
      reload();
    } catch (err) {
      toast.error("Could not save the reply", { description: memberError(err) });
    } finally {
      setReplying(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { page: _p, page_size: _s, ...rest } = params;
      void _p; void _s;
      const blob = await apiExportFeedback(rest);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "feedback.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${total} ${total === 1 ? "entry" : "entries"}`, { description: "Filtered exactly as the table is." });
    } catch (err) {
      toast.error("Could not export", { description: memberError(err) });
    } finally {
      setExporting(false);
    }
  };

  const openRequest = () => {
    setReqResult(null);
    setRequestOpen(true);
    setRecent(null);
    apiClient.get<RecentRequest[]>("/feedback/requests", { params: { limit: 8 } })
      .then((r) => setRecent(r.data))
      .catch(() => setRecent([]));
  };

  const submitRequest = async () => {
    if (!reqRecipient.trim()) return;
    setSending(true);
    try {
      const res = await apiRequestFeedback({ recipient: reqRecipient.trim(), program: reqProgram, message: reqMessage });
      setReqResult({ emailed: res.emailed, message: res.message });
      setReqRecipient("");
      setReqProgram("");
      setReqMessage("");
      setRecent((r) => r === null ? r : [{ id: res.id, recipient: reqRecipient.trim(), recipient_name: "", program: reqProgram, requested_by: "You", emailed: res.emailed, at: new Date().toISOString() }, ...r]);
    } catch (err) {
      toast.error("Could not send the request", { description: memberError(err) });
    } finally {
      setSending(false);
    }
  };

  const clearFilters = () => {
    setSearch(""); setTypeFilter("All Types"); setProgramFilter("All Programs");
    setRatingFilter("All Ratings"); setDateRange(ALL_TIME); setActiveTab(0); setPage(1);
  };
  const filtersActive = q || typeFilter !== "All Types" || programFilter !== "All Programs" || ratingFilter !== "All Ratings" || dateRange !== ALL_TIME || activeTab !== 0;

  const programOptions = stats?.programs ?? [];
  const overviewData = overview?.items.map((o) => ({ name: o.name, value: o.value, color: o.color })) ?? [];
  const overviewTotal = overview ? Number(overview.total.replace(/,/g, "")) : 0;
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);
  const menuBtn = "btn btn-sm btn-outline";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink"><MessageSquareHeart className="h-6 w-6" /></span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Feedback</h1>
            <p className="mt-1 text-sm text-ink-subtle">What members said about programmes and services, and what was done about it.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void exportCsv()} disabled={exporting || total === 0} className="btn btn-outline">
            <Download className="h-4 w-4" /> {exporting ? "Exporting…" : "Export CSV"}
          </button>
          <button onClick={openRequest} className="btn btn-primary"><MailPlus className="h-4 w-4" /> Request Feedback</button>
        </div>
      </div>

      {loadError && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-status-danger-edge bg-status-danger-bg px-4 py-3 text-sm text-status-danger-ink">
          <span>Could not load feedback: {loadError}</span>
          <button className="btn btn-sm btn-outline" onClick={reload}><RotateCcw className="h-3.5 w-3.5" /> Try again</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total Feedback" value={stats?.total_feedback ?? "…"} icon={MessageSquareHeart} tone="violet" />
        <StatCard label="Average Rating" value={stats?.average_rating ?? "…"} icon={Smile} tone="emerald" />
        <StatCard
          label="Positive Feedback" value={stats?.positive_percentage ?? "…"} icon={Star} tone="amber"
          delta={stats?.positive_delta ?? undefined} deltaDir={stats?.positive_up === false ? "down" : "up"} deltaNote="vs previous 30 days"
        />
        <StatCard
          label="Responses This Month" value={stats?.responses_this_month ?? "…"} icon={Calendar} tone="sky"
          delta={stats?.responses_delta ?? undefined} deltaDir={stats?.responses_up === false ? "down" : "up"} deltaNote="vs last month"
        />
        <StatCard label="People Who Wrote" value={stats?.feedback_users ?? "…"} icon={Users} tone="brand" />
      </div>

      {/* filters */}
      <Card className="mt-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[160px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search feedback, name or programme" aria-label="Search feedback" className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50" />
          </div>
          <Menu align="left" trigger={<button className={menuBtn}>{typeFilter} <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" /></button>}>
            <MenuItem onClick={() => { setTypeFilter("All Types"); setPage(1); }}>All Types</MenuItem>
            {TYPES.map((t) => <MenuItem key={t} onClick={() => { setTypeFilter(t); setPage(1); }}>{t}</MenuItem>)}
          </Menu>
          <Menu align="left" trigger={<button className={menuBtn}>{programFilter} <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" /></button>}>
            <MenuItem onClick={() => { setProgramFilter("All Programs"); setPage(1); }}>All Programs</MenuItem>
            {programOptions.map((p) => <MenuItem key={p} onClick={() => { setProgramFilter(p); setPage(1); }}>{p}</MenuItem>)}
            {programOptions.length === 0 && <MenuItem onClick={() => undefined}>No programmes named yet</MenuItem>}
          </Menu>
          <Menu align="left" trigger={<button className={menuBtn}>{ratingFilter} <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" /></button>}>
            <MenuItem onClick={() => { setRatingFilter("All Ratings"); setPage(1); }}>All Ratings</MenuItem>
            {RATINGS.map((r) => <MenuItem key={r} onClick={() => { setRatingFilter(r); setPage(1); }}>{r}</MenuItem>)}
          </Menu>
          <Menu align="left" trigger={<button className={menuBtn}><Calendar className="h-3.5 w-3.5" /> {dateRange}</button>}>
            {DATE_RANGES.map((d) => <MenuItem key={d} icon={Calendar} onClick={() => { setDateRange(d); setPage(1); }}>{d}</MenuItem>)}
          </Menu>
          {filtersActive && (
            <button onClick={clearFilters} className="btn btn-sm btn-ghost"><SlidersHorizontal className="h-3.5 w-3.5" /> Clear filters</button>
          )}
        </div>
      </Card>

      <ResizableColumns id="feedback" defaultSize={0.75} className="mt-6 gap-6">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <div className="flex flex-wrap items-center gap-5 text-sm">
              {TABS.map((t, i) => (
                <button key={t} onClick={() => { setActiveTab(i); setPage(1); }} className={`-mb-px flex items-center gap-1.5 border-b-2 pb-3 font-medium ${i === activeTab ? "border-brand-600 text-brand-ink" : "border-transparent text-ink-subtle hover:text-ink-muted"}`}>
                  {t}
                  {t === "Unresolved" && (stats?.unresolved ?? 0) > 0 && (
                    <span className="rounded-full bg-status-warn-bg px-1.5 text-2xs font-bold text-status-warn-ink">{stats?.unresolved}</span>
                  )}
                </button>
              ))}
            </div>
            <Menu trigger={<button className={menuBtn}>Sort by {sort} <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" /></button>}>
              {SORTS.map((s) => <MenuItem key={s} onClick={() => { setSort(s); setPage(1); }}>{s}</MenuItem>)}
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
                {rows.map((r) => {
                  const Face = FACE_ICON[r.face] ?? Meh;
                  const replies = r.replies.filter((x) => !x.internal).length;
                  const notes = r.replies.length - replies;
                  return (
                    <tr key={r.id} onClick={() => setDetail(r)} className="cursor-pointer align-top text-sm hover:bg-surface-hover/60">
                      <td className="px-2 py-3">
                        <div className="flex items-start gap-2.5">
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${FACE_TONE[r.face_tone] ?? FACE_TONE.amber}`}><Face className="h-4.5 w-4.5" /></span>
                          <div className="min-w-0">
                            <p className="max-w-[260px] text-xs text-ink-muted">{r.text}</p>
                            {(replies > 0 || notes > 0) && (
                              <p className="mt-1 flex items-center gap-2 text-2xs text-ink-subtle">
                                {replies > 0 && <span className="flex items-center gap-0.5"><Reply className="h-3 w-3" /> {replies} {replies === 1 ? "reply" : "replies"}</span>}
                                {notes > 0 && <span className="flex items-center gap-0.5"><StickyNote className="h-3 w-3" /> {notes} {notes === 1 ? "note" : "notes"}</span>}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3"><span className="flex items-center gap-2"><Avatar name={r.user} size="xs" /><span><span className="block text-ink-muted">{r.user}</span><span className="block text-2xs text-ink-subtle">{r.email}</span></span></span></td>
                      <td className="px-2 py-3"><Badge tone={r.t_type as BadgeTone}>{r.type}</Badge></td>
                      <td className="max-w-[140px] px-2 py-3 text-xs text-ink-subtle">{r.program || <span className="italic">Not named</span>}</td>
                      <td className="whitespace-nowrap px-2 py-3"><Stars n={r.rating} /></td>
                      <td className="whitespace-nowrap px-2 py-3 text-xs text-ink-subtle">{r.date}</td>
                      <td className="whitespace-nowrap px-2 py-3"><Badge tone={r.s_tone as BadgeTone}>{r.status}</Badge></td>
                      <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                        <Menu trigger={<button aria-label={`More actions for feedback from ${r.user}`} className="text-ink-subtle hover:text-ink-muted"><MoreVertical className="h-4 w-4" /></button>}>
                          <MenuItem icon={Eye} onClick={() => setDetail(r)}>View details</MenuItem>
                          <MenuItem icon={Reply} onClick={() => { setReplyInternal(false); setDetail(r); }}>Reply</MenuItem>
                          <MenuItem icon={StickyNote} onClick={() => { setReplyInternal(true); setDetail(r); }}>Add internal note</MenuItem>
                          {r.status !== "In Review" && <MenuItem icon={Loader2} onClick={() => void setStatus(r, "In Review")}>Mark In Review</MenuItem>}
                          {r.status !== "Resolved" && <MenuItem icon={CheckCircle2} onClick={() => void setStatus(r, "Resolved")}>Mark Resolved</MenuItem>}
                          {r.status !== "Open" && <MenuItem icon={RotateCcw} onClick={() => void setStatus(r, "Open")}>Reopen</MenuItem>}
                          <MenuItem icon={Trash2} danger onClick={() => void deleteRow(r)}>Delete</MenuItem>
                        </Menu>
                      </td>
                    </tr>
                  );
                })}
                {loading && rows.length === 0 && <SkeletonRows rows={6} cols={8} />}
                {!loading && rows.length === 0 && (
                  <tr className="text-sm">
                    <td colSpan={8} className="px-2 py-2">
                      <NoResults icon={MessageSquareHeart} thing="feedback" filtered={!!filtersActive} compact />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-ink-subtle">
              {total === 0 ? "No feedback to show" : `Showing ${from}–${to} of ${total.toLocaleString("en-IN")}`}
            </p>
            {pages > 1 && <Pagination page={page} pageCount={pages} onPageChange={setPage} />}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-ink">Feedback Overview</h2>
              <Menu trigger={<button className={menuBtn}>{dateRange} <ChevronDown className="h-3 w-3" /></button>}>
                {DATE_RANGES.map((d) => <MenuItem key={d} icon={Calendar} onClick={() => { setDateRange(d); setPage(1); }}>{d}</MenuItem>)}
              </Menu>
            </div>
            {overview === null ? (
              <p className="py-6 text-center text-xs text-ink-subtle">Loading…</p>
            ) : overviewTotal === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-ink-subtle"><MessageSquareHeart className="h-5 w-5" /></span>
                <p className="text-sm font-medium text-ink">Nothing in this period</p>
                <p className="text-xs text-ink-subtle">Widen the date range to see the split.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <DonutChart data={overviewData.filter((o) => o.value > 0)} centerValue={overview.total} centerLabel={overview.center_label} size={150} thickness={18} />
                <ul className="w-full space-y-2.5">
                  {overview.items.map((o) => (
                    <li key={o.name} className="flex items-center justify-between text-xs">
                      <span className="flex min-w-0 items-center gap-1.5 text-ink-muted"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: o.color }} /> <span className="truncate">{o.name}</span></span>
                      <span className="shrink-0 whitespace-nowrap font-medium tabular-nums text-ink-subtle">{o.legend}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card>
            <div className="mb-3">
              <h2 className="font-display text-base font-semibold text-ink">Programmes by Rating</h2>
              <p className="text-xs text-ink-subtle">Averaged from the ratings people actually gave.</p>
            </div>
            {programs === null ? (
              <p className="py-3 text-center text-xs text-ink-subtle">Loading…</p>
            ) : programs.length === 0 ? (
              <p className="py-3 text-center text-xs text-ink-subtle">No programme has been rated yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {programs.map((p) => (
                  <li key={p.name}>
                    <button type="button" onClick={() => { setProgramFilter(p.name); setPage(1); }} className="flex w-full items-center gap-2 rounded-lg p-1 text-left text-sm hover:bg-surface-hover">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand-ink"><Star className="h-3.5 w-3.5" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-ink-muted">{p.name}</span>
                        <span className="block text-2xs text-ink-subtle">from {p.count} {p.count === 1 ? "rating" : "ratings"}</span>
                      </span>
                      <span className="flex items-center gap-1 font-semibold tabular-nums text-status-warn-ink"><Star className="h-3.5 w-3.5 fill-rating text-rating" /> {p.rating}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="bg-linear-to-br from-violet-50 to-brand-50">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface text-violet-ink shadow-sm"><MailPlus className="h-5 w-5" /></span>
              <div><p className="text-sm font-semibold text-ink">Ask for feedback</p><p className="text-xs text-ink-subtle">Write to a member after a programme or a service.</p></div>
            </div>
            <button onClick={openRequest} className="btn btn-primary btn-block mt-3"><MailPlus className="h-4 w-4" /> Request Feedback</button>
          </Card>
        </div>
      </ResizableColumns>

      {/* what are people saying */}
      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold text-ink">What are people saying?</h2>
            <p className="text-xs text-ink-subtle">
              Counted for {dateRange === ALL_TIME ? "the last 30 days" : dateRange.toLowerCase()}, against the same span before it.
            </p>
          </div>
        </div>
        {themes === null ? (
          <p className="py-4 text-center text-xs text-ink-subtle">Loading…</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {themes.map((t) => {
              const Icon = THEME_ICON[t.icon] ?? ThumbsUp;
              const tab = t.key === "positive" ? 2 : t.key === "negative" ? 3 : t.key === "suggestions" ? 4 : 0;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => { if (t.key === "complaints") { setTypeFilter("Complaint"); setActiveTab(0); } else { setActiveTab(tab); } setPage(1); }}
                  className="rounded-xl border border-line p-4 text-left transition hover:border-line-strong"
                >
                  <div className="flex items-center justify-between">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${THEME_TONE[t.tone] ?? THEME_TONE.sky}`}><Icon className="h-4.5 w-4.5" /></span>
                    {t.delta ? (
                      <span className={`flex items-center gap-0.5 text-xs font-semibold ${t.up ? "text-status-ok-ink" : "text-status-danger-ink"}`}>
                        {t.up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}{t.delta}
                      </span>
                    ) : (
                      <span className="text-2xs text-ink-subtle">nothing to compare</span>
                    )}
                  </div>
                  <p className="mt-3 text-sm font-semibold text-ink">{t.label}</p>
                  <p className="text-xs text-ink-subtle">{t.mentions}</p>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* Request Feedback */}
      <Modal
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        title="Request Feedback"
        description="Written down here, and emailed when this server can send mail."
        icon={MailPlus}
        iconTone="brand"
        size="lg"
        footer={
          <>
            <button onClick={() => setRequestOpen(false)} className="btn btn-outline">Close</button>
            <button onClick={() => void submitRequest()} disabled={sending || !reqRecipient.trim()} className="btn btn-primary">
              <Send className="h-4 w-4" /> {sending ? "Sending…" : "Send Request"}
            </button>
          </>
        }
      >
        {reqResult && (
          <div className={`mb-4 flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${reqResult.emailed ? "bg-status-ok-bg text-status-ok-ink" : "bg-status-warn-bg text-status-warn-ink"}`}>
            {reqResult.emailed ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <Mail className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{reqResult.message}</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Input label="Her email" type="email" placeholder="name@example.com" value={reqRecipient} onChange={(e) => setReqRecipient(e.target.value)} />
          {programOptions.length > 0 ? (
            <Select label="Programme" options={["", ...programOptions]} value={reqProgram} onChange={(e) => setReqProgram(e.target.value)} placeholder="Optional" />
          ) : (
            <Input label="Programme" placeholder="Optional" value={reqProgram} onChange={(e) => setReqProgram(e.target.value)} />
          )}
          <Textarea className="col-span-2" label="Message" rows={3} placeholder="A line in your own words. Optional." value={reqMessage} onChange={(e) => setReqMessage(e.target.value)} />
        </div>
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Recently asked</p>
          {recent === null ? (
            <p className="text-xs text-ink-subtle">Loading…</p>
          ) : recent.length === 0 ? (
            <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-xs text-ink-subtle">Nobody has been asked yet.</p>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {recent.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                  <span className="min-w-0 flex-1 truncate text-ink">{r.recipient_name || r.recipient}{r.program ? <span className="text-ink-subtle"> · {r.program}</span> : null}</span>
                  <span className="shrink-0 text-ink-subtle">{when(r.at)}</span>
                  <Badge tone={r.emailed ? "emerald" : "amber"}>{r.emailed ? "Emailed" : "Saved only"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>

      {/* Feedback detail */}
      <Modal
        open={detail !== null}
        onClose={() => { setDetail(null); setReplyText(""); setReplyInternal(false); }}
        title={detail ? `Feedback from ${detail.user}` : "Feedback"}
        description={detail ? `${detail.type}${detail.program ? ` · ${detail.program}` : ""} · ${detail.date}` : undefined}
        icon={MessageSquareHeart}
        iconTone="violet"
        size="lg"
        footer={
          detail && (
            <>
              <button onClick={() => void deleteRow(detail)} className="btn btn-outline text-status-danger-ink"><Trash2 className="h-4 w-4" /> Delete</button>
              {detail.status !== "In Review" && <button onClick={() => void setStatus(detail, "In Review")} className="btn btn-outline"><Loader2 className="h-4 w-4" /> In Review</button>}
              {detail.status !== "Open" && <button onClick={() => void setStatus(detail, "Open")} className="btn btn-outline"><RotateCcw className="h-4 w-4" /> Reopen</button>}
              {detail.status !== "Resolved" && <button onClick={() => void setStatus(detail, "Resolved")} className="btn btn-primary"><CheckCircle2 className="h-4 w-4" /> Mark Resolved</button>}
            </>
          )
        }
      >
        {detail && (() => {
          const Face = FACE_ICON[detail.face] ?? Meh;
          return (
            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${FACE_TONE[detail.face_tone] ?? FACE_TONE.amber}`}><Face className="h-6 w-6" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed text-ink">{detail.text}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-subtle">
                    <span className="flex items-center gap-1.5"><Avatar name={detail.user} size="xs" /> {detail.user} · {detail.email}</span>
                    <Stars n={detail.rating} />
                    <Badge tone={detail.s_tone as BadgeTone}>{detail.status}</Badge>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Replies and notes</p>
                {detail.replies.length === 0 ? (
                  <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-xs text-ink-subtle">Nobody has replied yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {detail.replies.map((r) => (
                      <li key={r.id} className={`rounded-xl border px-3 py-2.5 text-sm ${r.internal ? "border-amber-200 bg-amber-50/60" : "border-line bg-surface"}`}>
                        <div className="mb-1 flex flex-wrap items-center gap-2 text-2xs text-ink-subtle">
                          <span className="font-semibold text-ink">{r.by}</span>
                          <span>{when(r.at)}</span>
                          {r.internal ? (
                            <span className="flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-900"><Lock className="h-3 w-3" /> Internal note</span>
                          ) : r.emailed ? (
                            <span className="flex items-center gap-1 rounded-full bg-status-ok-bg px-1.5 py-0.5 font-semibold text-status-ok-ink"><Mail className="h-3 w-3" /> Emailed</span>
                          ) : (
                            <span className="rounded-full bg-surface-2 px-1.5 py-0.5 font-semibold text-ink-subtle">Stored, not emailed</span>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap text-ink-muted">{r.text}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-xl border border-line p-3">
                <div className="mb-2 flex items-center gap-1 rounded-lg bg-surface-2 p-0.5 text-xs">
                  <button type="button" onClick={() => setReplyInternal(false)} className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 font-semibold ${!replyInternal ? "bg-surface text-ink shadow-sm" : "text-ink-subtle"}`}><Reply className="h-3.5 w-3.5" /> Reply to her</button>
                  <button type="button" onClick={() => setReplyInternal(true)} className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 font-semibold ${replyInternal ? "bg-surface text-ink shadow-sm" : "text-ink-subtle"}`}><StickyNote className="h-3.5 w-3.5" /> Internal note</button>
                </div>
                <Textarea
                  rows={3}
                  placeholder={replyInternal ? "Something for the team. She never sees this." : "Written to her. Emailed when this server can send mail; stored either way."}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                />
                <div className="mt-2 flex justify-end">
                  <button onClick={() => void sendReply()} disabled={replying || !replyText.trim()} className="btn btn-sm btn-primary">
                    {replyInternal ? <StickyNote className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                    {replying ? "Saving…" : replyInternal ? "Save note" : "Send reply"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
