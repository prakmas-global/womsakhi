"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileText, FileClock, Download, Users, ChevronDown, Search, Eye, ListFilter, CalendarDays, BriefcaseBusiness,
  DollarSign, Megaphone, GraduationCap, MessageSquareHeart, ShieldAlert, Calendar, Loader2, Lock, RotateCcw,
  Rows3, Layers,
} from "lucide-react";

import { Badge, Card, Menu, MenuItem, Modal, StatCard, type Tone, NoResults, SkeletonRows, useToast } from "@/design-system";
import DonutChart from "@/components/charts/DonutChart";
import { TONE_BG } from "@/lib/tones";
import {
  apiListReports, apiReportStats, apiReportRuns, apiPreviewReport, apiGenerateReport,
  type ReportDefinition, type ReportsStats, type ReportRun, type ReportPreview,
} from "@/lib/reports-api";
import { memberError } from "@/lib/member-api";
import { ResizableColumns } from "@/layout-engine";

/**
 * Reports — real data, generated on demand, every download written down.
 *
 * ── What is real on this screen ──────────────────────────────────────────────
 * Each report is a definition on the server that reads the live collections
 * when it is generated. The stat cards count generations that actually
 * happened (this month against last), the "recent" list is the run log, and
 * the category split is which kinds of report people generate. Nothing here
 * is scheduled or emailed, and nothing claims to be.
 *
 * The old screen had "Run now" stamp a time and produce nothing, stat cards
 * read from one seeded snapshot ("2.45M data points analysed"), and a
 * "Schedule" dialog that saved a row no scheduler ever read.
 */

const ICON_MAP: Record<string, React.ElementType> = {
  Users, CalendarDays, BriefcaseBusiness, DollarSign, Megaphone, GraduationCap, MessageSquareHeart, ShieldAlert, FileClock, FileText,
};
const iconFor = (name: string): React.ElementType => ICON_MAP[name] ?? FileText;

const CATEGORIES = ["User Activity", "Appointments", "Program & Services", "Financial", "Marketing", "Others"];
const ALL_TIME = "All time";
const DATE_RANGES = [ALL_TIME, "Today", "Last 7 Days", "Last 30 Days", "This Month", "This Year"];

function when(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

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

export default function ReportsPage() {
  const toast = useToast();
  const [reports, setReports] = useState<ReportDefinition[]>([]);
  const [stats, setStats] = useState<ReportsStats | null>(null);
  const [runs, setRuns] = useState<ReportRun[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All Categories");
  const [dateRange, setDateRange] = useState(ALL_TIME);

  const [detail, setDetail] = useState<ReportDefinition | null>(null);
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [generating, setGenerating] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [list, s, r] = await Promise.all([apiListReports(), apiReportStats(), apiReportRuns(8)]);
      setReports(list.items);
      setStats(s);
      setRuns(r);
      setLoadError("");
    } catch (err) {
      setLoadError(memberError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // The preview follows the open report and the chosen window.
  useEffect(() => {
    if (!detail) { setPreview(null); setPreviewError(""); return; }
    let live = true;
    setPreview(null);
    setPreviewError("");
    apiPreviewReport(detail.key, detail.dated && dateRange !== ALL_TIME ? dateRange : undefined)
      .then((p) => { if (live) setPreview(p); })
      .catch((err) => { if (live) setPreviewError(memberError(err)); });
    return () => { live = false; };
  }, [detail, dateRange]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      const matchQ = !q || `${r.name} ${r.description} ${r.category}`.toLowerCase().includes(q);
      const matchCat = catFilter === "All Categories" || r.category === catFilter;
      return matchQ && matchCat;
    });
  }, [reports, search, catFilter]);

  const generate = async (r: ReportDefinition) => {
    setGenerating(r.key);
    try {
      const range = r.dated && dateRange !== ALL_TIME ? dateRange : undefined;
      const blob = await apiGenerateReport(r.key, range);
      triggerDownload(blob, `${r.key}.csv`);
      toast.success(`${r.name} generated`, { description: range ? `${range}. Recorded in the activity log.` : "All rows. Recorded in the activity log." });
      await refresh();
    } catch (err) {
      toast.error(`Could not generate ${r.name}`, { description: memberError(err) });
    } finally {
      setGenerating(null);
    }
  };

  const cats = stats?.top_categories ?? [];
  const rangeNote = dateRange === ALL_TIME ? "every row" : dateRange.toLowerCase();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <FileText className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Reports</h1>
            <p className="mt-1 text-sm text-ink-subtle">Real data, generated when you ask for it. Every download is recorded.</p>
          </div>
        </div>
        <Menu align="right" trigger={<button className="btn btn-sm btn-outline"><Calendar className="h-3.5 w-3.5" /> {dateRange} <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" /></button>}>
          {DATE_RANGES.map((d) => <MenuItem key={d} icon={Calendar} onClick={() => setDateRange(d)}>{d}</MenuItem>)}
        </Menu>
      </div>

      {loadError && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-status-danger-edge bg-status-danger-bg px-4 py-3 text-sm text-status-danger-ink">
          <span>Could not load reports: {loadError}</span>
          <button className="btn btn-sm btn-outline" onClick={() => { setLoading(true); void refresh(); }}><RotateCcw className="h-3.5 w-3.5" /> Try again</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Reports Available" value={stats ? String(stats.available) : "…"} icon={FileText} tone="violet" />
        <StatCard
          label="Generated This Month" value={stats ? String(stats.generated_this_month) : "…"} icon={Download} tone="emerald"
          delta={stats?.generated_delta ?? undefined} deltaDir={stats?.generated_up === false ? "down" : "up"} deltaNote="vs last month"
        />
        <StatCard label="Rows Exported This Month" value={stats ? stats.rows_this_month.toLocaleString("en-IN") : "…"} icon={Rows3} tone="sky" />
        <StatCard label="Last Generated" value={stats ? (stats.last_generated_at ? when(stats.last_generated_at) : "Never") : "…"} icon={FileClock} tone="amber" deltaNote={stats?.last_generated_by ? `by ${stats.last_generated_by}` : undefined} />
        <StatCard label="Categories" value={String(CATEGORIES.length)} icon={Layers} tone="brand" />
      </div>

      <ResizableColumns id="reports" defaultSize={0.72} className="mt-6 gap-6">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-ink">All Reports</h2>
              <p className="text-xs text-ink-subtle">Dated reports use the window in the top-right ({rangeNote}).</p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-[180px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reports" aria-label="Search reports" className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50" />
              </div>
              <Menu align="right" trigger={<button className="btn btn-sm btn-outline">{catFilter} <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" /></button>}>
                <MenuItem icon={ListFilter} onClick={() => setCatFilter("All Categories")}>All Categories</MenuItem>
                {CATEGORIES.map((c) => <MenuItem key={c} onClick={() => setCatFilter(c)}>{c}</MenuItem>)}
              </Menu>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                  <th scope="col" className="px-2 py-3">Report</th>
                  <th scope="col" className="px-2 py-3">Category</th>
                  <th scope="col" className="whitespace-nowrap px-2 py-3">Columns</th>
                  <th scope="col" className="whitespace-nowrap px-2 py-3">Last generated</th>
                  <th scope="col" className="px-2 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((r) => {
                  const Icon = iconFor(r.icon);
                  const tone = (r.tone as Tone) || "slate";
                  return (
                    <tr key={r.key} onClick={() => setDetail(r)} className="cursor-pointer text-sm hover:bg-surface-hover/60">
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONE_BG[tone] ?? "bg-surface-inset text-ink-subtle"}`}><Icon className="h-4.5 w-4.5" /></span>
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 font-semibold text-ink">
                              {r.name}
                              {r.privacy_note && <Lock className="h-3.5 w-3.5 text-ink-subtle" aria-label="Counts only" />}
                            </p>
                            <p className="max-w-[360px] text-xs text-ink-subtle">{r.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3"><Badge tone={tone}>{r.category}</Badge></td>
                      <td className="whitespace-nowrap px-2 py-3 tabular-nums text-ink-subtle">{r.columns.length}</td>
                      <td className="whitespace-nowrap px-2 py-3 text-xs text-ink-subtle">
                        {r.last_run ? (
                          <span><span className="text-ink-muted">{when(r.last_run.at)}</span> · {r.last_run.by} · {r.last_run.rows.toLocaleString("en-IN")} rows</span>
                        ) : <span className="italic">Never</span>}
                      </td>
                      <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <button className="btn btn-sm btn-ghost" onClick={() => setDetail(r)}><Eye className="h-3.5 w-3.5" /> Preview</button>
                          <button className="btn btn-sm btn-outline" disabled={generating !== null} onClick={() => void generate(r)}>
                            {generating === r.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} CSV
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {loading && reports.length === 0 && <SkeletonRows rows={6} cols={5} />}
                {!loading && filtered.length === 0 && (
                  <tr className="text-sm">
                    <td colSpan={5} className="px-2 py-2">
                      <NoResults icon={FileText} thing="reports" filtered={reports.length > 0} compact />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-ink-subtle">Showing {filtered.length} of {reports.length} reports</p>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-ink">Recently Generated</h2>
            </div>
            {runs === null ? (
              <p className="text-xs text-ink-subtle">Loading…</p>
            ) : runs.length === 0 ? (
              <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-xs text-ink-subtle">Nothing has been generated yet. Pick a report and download its CSV.</p>
            ) : (
              <ul className="space-y-3">
                {runs.map((r) => (
                  <li key={r.id} className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-inset text-ink-subtle"><Download className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-muted">{r.report_name}</p>
                      <p className="text-xs text-ink-subtle">{when(r.at)} · {r.by} · {r.rows.toLocaleString("en-IN")} rows · {r.range_label}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 font-display text-base font-semibold text-ink">What Gets Generated</h2>
            {cats.length === 0 ? (
              <p className="text-xs text-ink-subtle">The split by category appears once something has been generated.</p>
            ) : (
              <div className="flex items-center gap-3">
                <DonutChart data={cats.map((c) => ({ name: c.name, value: c.value, color: c.color }))} centerValue={String(cats.reduce((s, c) => s + c.runs, 0))} centerLabel="runs" size={110} thickness={16} />
                <ul className="flex-1 space-y-1.5">
                  {cats.map((c) => (
                    <li key={c.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-ink-muted"><span className="h-2 w-2 rounded-full" style={{ background: c.color }} /> {c.name}</span>
                      <span className="font-medium tabular-nums text-ink-subtle">{c.runs}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {stats && stats.most_used.length > 0 && (
              <ul className="mt-4 space-y-1.5 border-t border-line pt-3">
                {stats.most_used.map((m) => (
                  <li key={m.key} className="flex items-center justify-between text-xs">
                    <span className="text-ink-muted">{m.name}</span>
                    <span className="tabular-nums text-ink-subtle">{m.runs}×</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="bg-linear-to-br from-violet-50 to-brand-50">
            <p className="text-sm font-semibold text-ink">Not scheduled, not emailed</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-subtle">
              Reports are generated here, by a person, and recorded against her name. Scheduled or emailed delivery does not exist yet, so nothing on this screen offers it.
            </p>
          </Card>
        </div>
      </ResizableColumns>

      {/* Preview */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.name ?? "Report"}
        description={detail?.description}
        icon={detail ? iconFor(detail.icon) : FileText}
        iconTone={detail && detail.tone !== "slate" ? (detail.tone as "brand" | "violet" | "emerald" | "amber" | "sky" | "rose") : "brand"}
        size="lg"
        footer={
          detail && (
            <>
              <button className="btn btn-outline" onClick={() => setDetail(null)}>Close</button>
              <button className="btn btn-primary" disabled={generating !== null} onClick={() => void generate(detail)}>
                {generating === detail.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download CSV
              </button>
            </>
          )
        }
      >
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-subtle">
              <Badge tone={(detail.tone as Tone) || "slate"}>{detail.category}</Badge>
              <span>{detail.columns.length} columns</span>
              <span>{detail.dated ? `Window: ${dateRange}` : "Not date-limited"}</span>
              {detail.last_run && <span>Last: {when(detail.last_run.at)} by {detail.last_run.by}</span>}
            </div>
            {detail.privacy_note && (
              <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {detail.privacy_note}
              </p>
            )}
            {previewError ? (
              <p className="rounded-lg bg-status-danger-bg px-3 py-2.5 text-xs text-status-danger-ink">Could not build the preview: {previewError}</p>
            ) : preview === null ? (
              <p className="flex items-center gap-2 py-6 text-xs text-ink-subtle"><Loader2 className="h-4 w-4 animate-spin" /> Reading the rows…</p>
            ) : preview.total === 0 ? (
              <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-xs text-ink-subtle">No rows {detail.dated && dateRange !== ALL_TIME ? `in ${dateRange.toLowerCase()}` : "yet"}. The CSV would contain only the header.</p>
            ) : (
              <div>
                <p className="mb-2 text-xs text-ink-subtle">
                  <b className="text-ink">{preview.total.toLocaleString("en-IN")}</b> row{preview.total === 1 ? "" : "s"}{preview.total > preview.rows.length ? `, first ${preview.rows.length} shown` : ""}
                </p>
                <div className="max-h-[40vh] overflow-auto rounded-lg border border-line">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-surface-2">
                      <tr>
                        {preview.columns.map((c) => <th key={c} scope="col" className="whitespace-nowrap px-2 py-2 font-semibold text-ink-subtle">{c}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {preview.rows.map((row, i) => (
                        <tr key={i}>
                          {row.map((cell, j) => <td key={j} className="max-w-[220px] truncate whitespace-nowrap px-2 py-1.5 text-ink-muted" title={cell === null ? "" : String(cell)}>{cell === null || cell === "" ? <span className="text-ink-faint">—</span> : String(cell)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
