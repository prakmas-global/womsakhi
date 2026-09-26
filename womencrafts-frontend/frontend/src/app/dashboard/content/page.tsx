"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FileStack, CircleCheck, PencilLine, CalendarClock, Trash2, ChevronDown, Search, SlidersHorizontal, Plus, Eye,
  Pencil, MoreVertical, FileText, Newspaper, Image as ImageIcon, MessageSquareQuote, HelpCircle, Megaphone,
  Download, Filter, Inbox, RotateCcw, HardDrive, Loader2, Clock,
} from "lucide-react";

import {
  Avatar, Badge, Card, ImageUpload, Input, Menu, MenuItem, Modal, Pagination, ProgressBar, Select, StatCard, Textarea,
  Thumb, useConfirm, useToast,
} from "@/design-system";
import DonutChart from "@/components/charts/DonutChart";
import { TONE_BG } from "@/lib/tones";
import {
  apiListContent, apiContentStats, apiContentActivity, apiContentAuthors, apiCreateContent, apiUpdateContent,
  apiSetContentStatus, apiDeleteContent, apiRestoreContent, apiDeleteContentPermanently, apiBulkContent, apiListUploads,
  apiDeleteUpload,
  type ApiContent, type ContentStats, type ContentActivity, type UploadedFile,
} from "@/lib/content-api";
import { memberError } from "@/lib/member-api";
import { apiRegions } from "@/lib/regions-admin-api";
import { apiListSegmentsLive } from "@/lib/members-admin-api";
import { ResizableColumns } from "@/layout-engine";

/**
 * Content — the pages, posts, media and banners on the public site.
 *
 * ── What is real on this screen ──────────────────────────────────────────────
 * Every count is counted; the activity feed is the audit log filtered to
 * content actions; storage is the sum of the files actually uploaded; the
 * author is the staff account that created the item. Trash is a real place —
 * an item can be restored from it or deleted for good — and a scheduled item
 * carries the time it goes live, which the member-facing read honours.
 *
 * The old screen had a seeded activity feed ("Neha Verma published About
 * Us, May 2024"), a storage bar of 24.6 GB of 100 GB typed into a seed row, a
 * dropdown of four invented authors, a "Move to Trash" that deleted outright
 * while promising a restore, and a "Scheduled" status with no date.
 */

const TABS = ["All Content", "Pages", "Blog Posts", "Media", "Testimonials", "FAQs", "Banners", "Trash"] as const;
type Tab = (typeof TABS)[number];

type Tone = "violet" | "emerald" | "amber" | "brand" | "sky" | "rose";
type ContentType = "Page" | "Blog Post" | "Media" | "Banner" | "FAQ" | "Program" | "Testimonial";
type ContentStatus = "Published" | "Draft" | "Scheduled";

const ICON_MAP: Record<string, React.ElementType> = {
  FileText, Newspaper, ImageIcon, Megaphone, HelpCircle, FileStack, MessageSquareQuote, CircleCheck, Pencil, PencilLine,
  CalendarClock, Trash2, RotateCcw, Download,
};

const TYPE_OPTIONS: ContentType[] = ["Page", "Blog Post", "Media", "Banner", "FAQ", "Program", "Testimonial"];
const STATUS_OPTIONS: ContentStatus[] = ["Published", "Draft", "Scheduled"];
const PAGE_SIZE = 8;

type AudienceMode = "everyone" | "regions" | "segments";
type FormState = { title: string; type: ContentType; status: ContentStatus; slug: string; description: string; cover: string; publishAt: string; audienceMode: AudienceMode; audienceValues: string[] };
const EMPTY_FORM: FormState = { title: "", type: "Page", status: "Draft", slug: "", description: "", cover: "", publishAt: "", audienceMode: "everyone", audienceValues: [] };

/** ISO → the value a datetime-local input wants (local time, no seconds). */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
function when(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

const STATUS_DOT: Record<string, string> = {
  Published: "bg-status-ok-solid", Scheduled: "bg-status-info-solid", Draft: "bg-status-warn-solid", Trash: "bg-status-danger-solid",
};

function Dropdown({ label }: { label: string }) {
  return (
    <button className="btn btn-sm btn-outline">
      {label} <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" />
    </button>
  );
}

export default function ContentPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<ApiContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [stats, setStats] = useState<ContentStats | null>(null);
  const [activity, setActivity] = useState<ContentActivity[] | null>(null);
  const [authors, setAuthors] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("All Content");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ContentType | "All Types">("All Types");
  const [statusFilter, setStatusFilter] = useState<ContentStatus | "All Status">("All Status");
  const [authorFilter, setAuthorFilter] = useState<string>("All Authors");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [scheduleFor, setScheduleFor] = useState<ApiContent | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [mediaOpen, setMediaOpen] = useState(false);
  const [uploads, setUploads] = useState<{ items: UploadedFile[]; total: number } | null>(null);
  const [mediaSearch, setMediaSearch] = useState("");
  const [mediaKind, setMediaKind] = useState("");
  const [audienceChoices, setAudienceChoices] = useState<{ regions: string[]; segments: string[] }>({ regions: [], segments: [] });

  const inTrash = activeTab === "Trash";

  // The table rows for the current tab come from the server (Trash is its own
  // place there); search and the dropdowns narrow them here.
  const refresh = useCallback(async () => {
    try {
      const [list, s, act, auth] = await Promise.all([
        apiListContent({ page_size: 200, tab: inTrash ? "Trash" : undefined }),
        apiContentStats(),
        apiContentActivity(6),
        apiContentAuthors(),
      ]);
      setRows(list.items);
      setStats(s);
      setActivity(act);
      setAuthors(auth);
      setLoadError("");
    } catch (err) {
      setLoadError(memberError(err));
    } finally {
      setLoading(false);
    }
  }, [inTrash]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!addOpen) return;
    void Promise.all([apiRegions(), apiListSegmentsLive({ status: "Active" })])
      .then(([regions, segments]) => setAudienceChoices({
        regions: regions.filter((r) => r.status === "Active").map((r) => r.name),
        segments: segments.items.filter((s) => s.status === "Active").map((s) => s.name),
      }))
      .catch(() => setAudienceChoices({ regions: [], segments: [] }));
  }, [addOpen]);
  useEffect(() => { setSelectedIds([]); setPage(1); }, [activeTab]);

  useEffect(() => {
    if (!mediaOpen) return;
    let live = true;
    setUploads(null);
    const timer = setTimeout(() => {
      apiListUploads({ page_size: 50, q: mediaSearch.trim() || undefined, kind: mediaKind || undefined })
        .then((u) => { if (live) setUploads(u); })
        .catch(() => { if (live) setUploads({ items: [], total: 0 }); });
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [mediaOpen, mediaSearch, mediaKind]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const tabType = ({ Pages: "Page", "Blog Posts": "Blog Post", Media: "Media", Testimonials: "Testimonial", FAQs: "FAQ", Banners: "Banner" } as Record<string, string>)[activeTab] ?? null;
    return rows.filter((r) => {
      const matchesTab = tabType === null || r.type === tabType;
      const matchesSearch = q === "" || r.title.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q);
      const matchesType = typeFilter === "All Types" || r.type === typeFilter;
      const matchesStatus = inTrash || statusFilter === "All Status" || r.status === statusFilter;
      const matchesAuthor = authorFilter === "All Authors" || r.author === authorFilter;
      return matchesTab && matchesSearch && matchesType && matchesStatus && matchesAuthor;
    });
  }, [rows, activeTab, search, typeFilter, statusFilter, authorFilter, inTrash]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(startIdx, startIdx + PAGE_SIZE);
  const visibleIds = pageRows.map((r) => r.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const detailRow = detailId ? rows.find((r) => r.id === detailId) ?? null : null;
  const hasSelection = selectedIds.length > 0;
  const filtersActive = search || typeFilter !== "All Types" || statusFilter !== "All Status" || authorFilter !== "All Authors";

  function toggleAllVisible() {
    setSelectedIds((prev) => allVisibleSelected ? prev.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...prev, ...visibleIds])));
  }
  function toggleRow(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  // ---- status ----
  async function setStatus(row: ApiContent, status: ContentStatus, publishAt?: string | null) {
    try {
      await apiSetContentStatus(row.id, status, publishAt);
      await refresh();
      toast.success(status === "Published" ? `“${row.title}” is live` : status === "Scheduled" ? `“${row.title}” scheduled` : `“${row.title}” moved to draft`);
    } catch (err) {
      toast.error("Could not change the status", { description: memberError(err) });
    }
  }
  function openSchedule(row: ApiContent) {
    setScheduleFor(row);
    setScheduleAt(toLocalInput(row.publish_at));
  }
  async function submitSchedule() {
    if (!scheduleFor) return;
    const iso = fromLocalInput(scheduleAt);
    if (!iso) { toast.error("Pick a date and time"); return; }
    await setStatus(scheduleFor, "Scheduled", iso);
    setScheduleFor(null);
  }

  // ---- trash ----
  async function trashRow(row: ApiContent) {
    const ok = await confirm({
      title: `Move “${row.title}” to Trash?`,
      description: row.status === "Published" ? "It comes off the site now. You can restore it from the Trash tab." : "You can restore it from the Trash tab.",
      confirmLabel: "Move to Trash",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiDeleteContent(row.id);
      setSelectedIds((prev) => prev.filter((x) => x !== row.id));
      if (detailId === row.id) setDetailId(null);
      await refresh();
      toast.success("Moved to Trash", { description: "Find it under the Trash tab." });
    } catch (err) {
      toast.error("Could not move it to Trash", { description: memberError(err) });
    }
  }
  async function restoreRow(row: ApiContent) {
    try {
      await apiRestoreContent(row.id);
      if (detailId === row.id) setDetailId(null);
      await refresh();
      toast.success(`“${row.title}” restored as a draft`);
    } catch (err) {
      toast.error("Could not restore it", { description: memberError(err) });
    }
  }
  async function destroyRow(row: ApiContent) {
    const ok = await confirm({
      title: `Delete “${row.title}” for good?`,
      description: "This cannot be undone.",
      confirmLabel: "Delete permanently",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiDeleteContentPermanently(row.id);
      if (detailId === row.id) setDetailId(null);
      await refresh();
      toast.success("Deleted permanently");
    } catch (err) {
      toast.error("Could not delete it", { description: memberError(err) });
    }
  }

  // ---- bulk ----
  async function bulk(action: "publish" | "draft" | "trash" | "restore" | "delete") {
    if (selectedIds.length === 0) return;
    if (action === "delete" || action === "trash") {
      const ok = await confirm({
        title: action === "delete" ? `Delete ${selectedIds.length} for good?` : `Move ${selectedIds.length} to Trash?`,
        description: action === "delete" ? "This cannot be undone." : "They can be restored from the Trash tab.",
        confirmLabel: action === "delete" ? "Delete permanently" : "Move to Trash",
        danger: true,
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const res = await apiBulkContent(selectedIds, action);
      setSelectedIds([]);
      await refresh();
      toast.success(`${res.message}: ${res.affected} item${res.affected === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error("Could not do that", { description: memberError(err) });
    } finally {
      setBusy(false);
    }
  }

  // ---- add / edit ----
  function openAdd() { setEditId(null); setForm(EMPTY_FORM); setAddOpen(true); }
  function openEdit(r: ApiContent) {
    setEditId(r.id);
    setForm({ title: r.title, type: r.type as ContentType, status: (r.status === "Trash" ? "Draft" : r.status) as ContentStatus, slug: r.slug, description: r.description, cover: r.cover, publishAt: toLocalInput(r.publish_at), audienceMode: r.audience_mode ?? "everyone", audienceValues: r.audience_values ?? [] });
    setDetailId(null);
    setAddOpen(true);
  }
  async function submitForm() {
    if (!form.title.trim()) return;
    if (form.status === "Scheduled" && !fromLocalInput(form.publishAt)) { toast.error("Pick when it should go live"); return; }
    if (form.audienceMode !== "everyone" && !form.audienceValues.length) { toast.error(`Choose at least one ${form.audienceMode === "regions" ? "region" : "segment"}`); return; }
    setSaving(true);
    const body = {
      title: form.title.trim(), type: form.type, status: form.status, slug: form.slug.trim(),
      description: form.description, cover: form.cover,
      publish_at: form.status === "Scheduled" ? fromLocalInput(form.publishAt) : null,
      audience_mode: form.audienceMode, audience_values: form.audienceValues,
    };
    try {
      if (editId) { await apiUpdateContent(editId, body); toast.success(`“${body.title}” saved`); }
      else { await apiCreateContent(body); toast.success(`“${body.title}” created`, { description: `As ${form.status.toLowerCase()}.` }); setPage(1); }
      await refresh();
      setAddOpen(false);
      setEditId(null);
      setForm(EMPTY_FORM);
    } catch (err) {
      toast.error("Could not save the content", { description: memberError(err) });
    } finally {
      setSaving(false);
    }
  }

  function useMediaAsCover(file: UploadedFile) {
    setEditId(null);
    setForm({ ...EMPTY_FORM, cover: file.url, type: "Media" });
    setMediaOpen(false);
    setAddOpen(true);
  }

  async function removeMedia(file: UploadedFile) {
    const ok = await confirm({
      title: `Remove “${file.original_name}”?`,
      description: "The server first checks whether any content, profile, circle, event or shop item still uses it.",
      confirmLabel: "Remove file",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiDeleteUpload(file.id);
      setUploads((current) => current ? {
        items: current.items.filter((item) => item.id !== file.id),
        total: Math.max(0, current.total - 1),
      } : current);
      await refresh();
      toast.success("File removed from the library");
    } catch (err) {
      toast.error("Could not remove that file", { description: memberError(err) });
    }
  }

  function exportCsv() {
    const header = ["Title", "Slug", "Type", "Status", "Author", "Goes live", "Last Updated"];
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [header.join(","), ...filtered.map((r) => [r.title, r.slug, r.type, r.status, r.author, r.publish_at ?? "", r.updated_at].map(escape).join(","))];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "content-export.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} item${filtered.length === 1 ? "" : "s"}`);
  }

  const statusDot = (s: string) => STATUS_DOT[s] ?? "bg-status-warn-solid";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <FileStack className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Content</h1>
            <p className="mt-1 text-sm text-ink-subtle">Pages, posts, media and banners on the public site. Members see only what is published.</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus className="h-4 w-4" /> Add New Content</button>
      </div>

      {loadError && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-status-danger-edge bg-status-danger-bg px-4 py-3 text-sm text-status-danger-ink">
          <span>Could not load content: {loadError}</span>
          <button className="btn btn-sm btn-outline" onClick={() => { setLoading(true); void refresh(); }}><RotateCcw className="h-3.5 w-3.5" /> Try again</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total Content" value={stats ? stats.total_content.toLocaleString() : "…"} icon={FileStack} tone="violet" />
        <StatCard label="Published" value={stats ? stats.published.toLocaleString() : "…"} icon={CircleCheck} tone="emerald" />
        <StatCard label="Draft" value={stats ? stats.draft.toLocaleString() : "…"} icon={PencilLine} tone="amber" />
        <StatCard label="Scheduled" value={stats ? stats.scheduled.toLocaleString() : "…"} icon={CalendarClock} tone="sky" />
        <StatCard label="In Trash" value={stats ? stats.trash.toLocaleString() : "…"} icon={Trash2} tone="rose" />
      </div>

      <ResizableColumns id="content" defaultSize={0.74} className="mt-6 gap-6">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <div className="flex flex-wrap gap-5 text-sm">
              {TABS.map((t) => (
                <button key={t} onClick={() => setActiveTab(t)} className={`-mb-px flex items-center gap-1.5 border-b-2 pb-3 font-medium ${activeTab === t ? "border-brand-600 text-brand-ink" : "border-transparent text-ink-subtle hover:text-ink-muted"}`}>
                  {t}
                  {t === "Trash" && (stats?.trash ?? 0) > 0 && <span className="rounded-full bg-status-danger-bg px-1.5 text-2xs font-bold text-status-danger-ink">{stats?.trash}</span>}
                </button>
              ))}
            </div>
            <Menu
              trigger={
                <button className="btn btn-sm btn-outline disabled:cursor-not-allowed disabled:opacity-50" disabled={!hasSelection || busy} title={hasSelection ? undefined : "Select rows to enable bulk actions"}>
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Bulk Actions{hasSelection ? ` (${selectedIds.length})` : ""} <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" />
                </button>
              }
            >
              {inTrash ? (
                <>
                  <MenuItem icon={RotateCcw} onClick={() => void bulk("restore")}>Restore as drafts</MenuItem>
                  <MenuItem icon={Trash2} danger onClick={() => void bulk("delete")}>Delete permanently</MenuItem>
                </>
              ) : (
                <>
                  <MenuItem icon={CircleCheck} onClick={() => void bulk("publish")}>Publish</MenuItem>
                  <MenuItem icon={PencilLine} onClick={() => void bulk("draft")}>Move to Draft</MenuItem>
                  <MenuItem icon={Trash2} danger onClick={() => void bulk("trash")}>Move to Trash</MenuItem>
                </>
              )}
            </Menu>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[160px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by title or slug" aria-label="Search content" className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50" />
            </div>
            <Menu align="left" trigger={<Dropdown label={typeFilter} />}>
              {(["All Types", ...TYPE_OPTIONS] as (ContentType | "All Types")[]).map((opt) => (
                <MenuItem key={opt} onClick={() => { setTypeFilter(opt); setPage(1); }}>{opt}</MenuItem>
              ))}
            </Menu>
            {!inTrash && (
              <Menu align="left" trigger={<Dropdown label={statusFilter} />}>
                {(["All Status", ...STATUS_OPTIONS] as (ContentStatus | "All Status")[]).map((opt) => (
                  <MenuItem key={opt} onClick={() => { setStatusFilter(opt); setPage(1); }}>{opt}</MenuItem>
                ))}
              </Menu>
            )}
            <Menu align="left" trigger={<Dropdown label={authorFilter} />}>
              <MenuItem onClick={() => { setAuthorFilter("All Authors"); setPage(1); }}>All Authors</MenuItem>
              {authors.map((opt) => <MenuItem key={opt} onClick={() => { setAuthorFilter(opt); setPage(1); }}>{opt}</MenuItem>)}
              {authors.length === 0 && <MenuItem onClick={() => undefined}>Nobody has written anything yet</MenuItem>}
            </Menu>
            <Menu align="left" trigger={<button className="btn btn-sm btn-outline"><SlidersHorizontal className="h-3.5 w-3.5" /> More</button>}>
              <MenuItem icon={Download} onClick={exportCsv}>Export what is shown as CSV</MenuItem>
              <MenuItem icon={Filter} onClick={() => { setSearch(""); setTypeFilter("All Types"); setStatusFilter("All Status"); setAuthorFilter("All Authors"); setPage(1); }}>Clear filters</MenuItem>
            </Menu>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                  <th scope="col" className="px-2 py-3"><input type="checkbox" aria-label="Select all content on this page" checked={allVisibleSelected} onChange={toggleAllVisible} className="rounded border-line-strong accent-brand-600" /></th>
                  <th scope="col" className="px-2 py-3">Title</th>
                  <th scope="col" className="whitespace-nowrap px-2 py-3">Type</th>
                  <th scope="col" className="whitespace-nowrap px-2 py-3">Status</th>
                  <th scope="col" className="whitespace-nowrap px-2 py-3">Author</th>
                  <th scope="col" className="whitespace-nowrap px-2 py-3">Last Updated</th>
                  <th scope="col" className="px-2 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pageRows.map((r) => (
                  <tr key={r.id} onClick={() => setDetailId(r.id)} className="cursor-pointer text-sm hover:bg-surface-hover/60">
                    <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${r.title}`} checked={selectedIds.includes(r.id)} onChange={() => toggleRow(r.id)} className="rounded border-line-strong accent-brand-600" /></td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2.5">
                        <Thumb seed={r.title} src={r.cover} alt={r.title} className="h-10 w-10 rounded-lg" />
                        <div className="max-w-[240px]"><p className="truncate font-semibold text-ink">{r.title}</p><p className="truncate text-xs text-ink-subtle">{r.slug}</p></div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-3"><Badge tone={r.tone as Tone}>{r.type}</Badge></td>
                    <td className="whitespace-nowrap px-2 py-3">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                        <span className={`h-2 w-2 rounded-full ${statusDot(r.status)}`} /> {r.status}
                        {r.status === "Scheduled" && r.publish_at && <span className="text-ink-subtle">· {when(r.publish_at)}</span>}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-3"><span className="flex items-center gap-2"><Avatar name={r.author || "?"} size="xs" /><span className="text-ink-muted">{r.author || <span className="italic text-ink-subtle">Unknown</span>}</span></span></td>
                    <td className="whitespace-nowrap px-2 py-3 text-xs text-ink-subtle">{r.updated}</td>
                    <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2 text-ink-subtle">
                        <button aria-label={`View ${r.title}`} className="hover:text-ink-muted" onClick={() => setDetailId(r.id)}><Eye className="h-4 w-4" /></button>
                        {!inTrash && <button aria-label={`Edit ${r.title}`} className="hover:text-ink-muted" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></button>}
                        <Menu trigger={<span aria-label={`More actions for ${r.title}`} className="flex hover:text-ink-muted"><MoreVertical className="h-4 w-4" /></span>}>
                          <MenuItem icon={Eye} onClick={() => setDetailId(r.id)}>View</MenuItem>
                          {inTrash ? (
                            <>
                              <MenuItem icon={RotateCcw} onClick={() => void restoreRow(r)}>Restore as draft</MenuItem>
                              <MenuItem icon={Trash2} danger onClick={() => void destroyRow(r)}>Delete permanently</MenuItem>
                            </>
                          ) : (
                            <>
                              <MenuItem icon={Pencil} onClick={() => openEdit(r)}>Edit</MenuItem>
                              {r.status !== "Published" && <MenuItem icon={CircleCheck} onClick={() => void setStatus(r, "Published")}>Publish now</MenuItem>}
                              {r.status === "Published" && <MenuItem icon={PencilLine} onClick={() => void setStatus(r, "Draft")}>Unpublish (to draft)</MenuItem>}
                              <MenuItem icon={CalendarClock} onClick={() => openSchedule(r)}>{r.status === "Scheduled" ? "Change schedule" : "Schedule…"}</MenuItem>
                              <MenuItem icon={Trash2} danger onClick={() => void trashRow(r)}>Move to Trash</MenuItem>
                            </>
                          )}
                        </Menu>
                      </div>
                    </td>
                  </tr>
                ))}
                {loading && rows.length === 0 && (
                  <tr className="text-sm"><td colSpan={7} className="px-2 py-12 text-center text-ink-subtle">Loading content…</td></tr>
                )}
                {!loading && pageRows.length === 0 && (
                  <tr className="text-sm">
                    <td colSpan={7} className="px-2 py-12">
                      <div className="flex flex-col items-center justify-center gap-2 text-center">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-inset text-ink-subtle">{inTrash ? <Trash2 className="h-5 w-5" /> : <Inbox className="h-5 w-5" />}</span>
                        <p className="text-sm font-medium text-ink-muted">{inTrash ? "Trash is empty" : filtersActive ? "Nothing matches those filters" : rows.length === 0 ? "No content yet" : `No ${activeTab.toLowerCase()} yet`}</p>
                        <p className="text-xs text-ink-subtle">{inTrash ? "Items you move to Trash wait here until restored or deleted." : filtersActive ? "Clear a filter or two." : "Add a page, post, banner or FAQ to get started."}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-ink-subtle">{filtered.length === 0 ? "Nothing to show" : `Showing ${startIdx + 1}–${Math.min(startIdx + PAGE_SIZE, filtered.length)} of ${filtered.length}`}</p>
            {totalPages > 1 && <Pagination page={currentPage} pageCount={totalPages} onPageChange={setPage} />}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-ink">Content Overview</h2>
              <button className="text-xs font-semibold text-brand-ink transition hover:underline" onClick={() => setActiveTab("All Content")}>View All</button>
            </div>
            {stats && stats.total_content === 0 ? (
              <p className="py-4 text-center text-xs text-ink-subtle">Nothing published or drafted yet.</p>
            ) : (
              <div className="flex items-center gap-3">
                <DonutChart data={stats?.overview ?? []} centerValue={stats?.overview_total ?? "…"} centerLabel="Total" size={130} thickness={18} />
                <ul className="flex-1 space-y-1.5">
                  {(stats?.overview ?? []).map((o) => (
                    <li key={o.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-ink-muted"><span className="h-2 w-2 rounded-full" style={{ background: o.color }} /> {o.name}</span>
                      <span className="shrink-0 whitespace-nowrap font-medium text-ink-subtle">{o.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-ink">Recent Activity</h2>
              <Link href="/dashboard/settings/activity" className="text-xs font-semibold text-brand-ink transition hover:underline">Full log</Link>
            </div>
            {activity === null ? (
              <p className="text-xs text-ink-subtle">Loading…</p>
            ) : activity.length === 0 ? (
              <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-xs text-ink-subtle">No content changes recorded yet. Edits made from here appear as they happen.</p>
            ) : (
              <ul className="space-y-3">
                {activity.map((a) => {
                  const ActivityIcon = ICON_MAP[a.icon] ?? CircleCheck;
                  return (
                    <li key={a.id} className="flex items-start gap-3">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONE_BG[a.tone] ?? TONE_BG.violet}`}><ActivityIcon className="h-4 w-4" /></span>
                      <div className="min-w-0"><p className="text-sm font-medium text-ink-muted">{a.text}</p><p className="text-xs text-ink-subtle">{a.meta}</p></div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 font-display text-base font-semibold text-ink">By Type</h2>
            {stats && stats.categories.length === 0 ? (
              <p className="text-xs text-ink-subtle">Nothing to break down yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {(stats?.categories ?? []).map((c) => (
                  <li key={c.name}>
                    <div className="mb-1 flex items-center justify-between text-xs"><span className="text-ink-muted">{c.name}</span><span className="text-ink-subtle">{c.label}</span></div>
                    <ProgressBar value={c.value} color="var(--color-violet-500)" />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="mb-2 flex items-center justify-between text-sm">
              <h2 className="font-display font-semibold text-ink">Storage</h2>
              <HardDrive className="h-4 w-4 text-ink-subtle" />
            </div>
            <p className="font-display text-xl font-bold text-ink">{stats ? stats.storage_label : "…"}</p>
            <p className="mt-1 text-xs text-ink-subtle">The files uploaded through this dashboard. There is no quota to fill.</p>
            <button className="btn btn-secondary btn-block mt-3" onClick={() => setMediaOpen(true)}>Open Media Library</button>
          </Card>
        </div>
      </ResizableColumns>

      {/* Add / Edit */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={editId ? "Edit Content" : "Add New Content"}
        description={editId ? "Update this content item." : "Create a new piece of website content. You are recorded as its author."}
        icon={editId ? Pencil : FileStack}
        iconTone="brand"
        size="lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setAddOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={saving || !form.title.trim()} onClick={() => void submitForm()}>
              {saving ? "Saving…" : editId ? <><Pencil className="h-4 w-4" /> Save Changes</> : <><Plus className="h-4 w-4" /> Add Content</>}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Input label="Title" required className="col-span-2" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Enter content title" />
          <Select label="Type" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ContentType }))} options={TYPE_OPTIONS} />
          <Select label="Status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ContentStatus }))} options={STATUS_OPTIONS} />
          {form.status === "Scheduled" && (
            <div className="col-span-2">
              <label htmlFor="content-publish-at" className="mb-1.5 block text-xsm font-medium text-ink-muted">Goes live at</label>
              <input id="content-publish-at" type="datetime-local" value={form.publishAt} onChange={(e) => setForm((f) => ({ ...f, publishAt: e.target.value }))} className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50" />
              <p className="mt-1 text-xs text-ink-subtle">Members see it from that moment; it is hidden until then.</p>
            </div>
          )}
          <Input label="Slug" className="col-span-2" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="Leave blank to make one from the title" />
          <Textarea label="Description" className="col-span-2" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Short description of this content…" />
          <fieldset className="col-span-2 rounded-xl border border-line p-3">
            <legend className="px-1 text-xsm font-medium text-ink-muted">Who should see this?</legend>
            <div className="flex flex-wrap gap-2">
              {([['everyone', 'Every member'], ['regions', 'Selected regions'], ['segments', 'Selected segments']] as const).map(([value, label]) => (
                <button key={value} type="button" aria-pressed={form.audienceMode === value}
                  className={`btn btn-sm ${form.audienceMode === value ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setForm((f) => ({ ...f, audienceMode: value, audienceValues: [] }))}>{label}</button>
              ))}
            </div>
            {form.audienceMode !== "everyone" && (
              <div className="mt-3 flex max-h-36 flex-wrap gap-2 overflow-y-auto" aria-label={`Choose ${form.audienceMode}`}>
                {audienceChoices[form.audienceMode].map((value) => {
                  const on = form.audienceValues.includes(value);
                  return <button key={value} type="button" aria-pressed={on}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${on ? 'border-violet-500 bg-violet-50 text-violet-800' : 'border-line-strong text-ink-muted'}`}
                    onClick={() => setForm((f) => ({ ...f, audienceValues: on ? f.audienceValues.filter((x) => x !== value) : [...f.audienceValues, value] }))}>
                    {on ? '✓ ' : ''}{value}
                  </button>;
                })}
                {!audienceChoices[form.audienceMode].length && <p className="text-xs text-ink-subtle">No active {form.audienceMode} are available.</p>}
              </div>
            )}
            <p className="mt-2 text-xs text-ink-subtle">Targeting is enforced by the member content feed and stored with every item.</p>
          </fieldset>
          <ImageUpload className="col-span-2" variant="cover" kind="cover" label="Cover image" hint="Shown on the content list and detail view. JPG, PNG, WEBP or GIF up to 5 MB." value={form.cover || null} onChange={(url) => setForm((f) => ({ ...f, cover: url ?? "" }))} />
        </div>
      </Modal>

      {/* Schedule */}
      <Modal
        open={!!scheduleFor}
        onClose={() => setScheduleFor(null)}
        title={scheduleFor ? `Schedule “${scheduleFor.title}”` : "Schedule"}
        description="It stays hidden from members until this time, then goes live."
        icon={CalendarClock}
        iconTone="sky"
        size="sm"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setScheduleFor(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={!scheduleAt} onClick={() => void submitSchedule()}><Clock className="h-4 w-4" /> Schedule</button>
          </>
        }
      >
        <label htmlFor="schedule-at" className="mb-1.5 block text-xsm font-medium text-ink-muted">Goes live at</label>
        <input id="schedule-at" type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50" />
      </Modal>

      {/* Detail */}
      <Modal
        open={detailRow !== null}
        onClose={() => setDetailId(null)}
        title={detailRow?.title ?? "Content"}
        description={detailRow?.slug}
        icon={detailRow ? (ICON_MAP[detailRow.icon] ?? FileStack) : FileStack}
        iconTone="brand"
        footer={
          detailRow && (
            detailRow.status === "Trash" ? (
              <>
                <button className="btn btn-outline text-status-danger-ink" onClick={() => void destroyRow(detailRow)}><Trash2 className="h-4 w-4" /> Delete permanently</button>
                <button className="btn btn-primary" onClick={() => void restoreRow(detailRow)}><RotateCcw className="h-4 w-4" /> Restore as draft</button>
              </>
            ) : (
              <>
                <button className="btn btn-outline text-status-danger-ink" onClick={() => void trashRow(detailRow)}><Trash2 className="h-4 w-4" /> Move to Trash</button>
                <button className="btn btn-outline" onClick={() => openEdit(detailRow)}><Pencil className="h-4 w-4" /> Edit</button>
                <button className="btn btn-primary" onClick={() => void setStatus(detailRow, detailRow.status === "Published" ? "Draft" : "Published")}>
                  {detailRow.status === "Published" ? "Unpublish" : "Publish now"}
                </button>
              </>
            )
          )
        }
      >
        {detailRow && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Thumb seed={detailRow.title} src={detailRow.cover} alt={detailRow.title} className="h-16 w-16 rounded-xl" />
              <div className="min-w-0">
                <p className="font-display text-base font-bold text-ink">{detailRow.title}</p>
                <p className="truncate text-xs text-ink-subtle">{detailRow.slug}</p>
              </div>
            </div>
            {detailRow.description ? <p className="text-sm leading-relaxed text-ink-muted">{detailRow.description}</p> : <p className="text-xs italic text-ink-subtle">No description.</p>}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
              <div><p className="text-ink-subtle">Type</p><div className="mt-1"><Badge tone={detailRow.tone as Tone}>{detailRow.type}</Badge></div></div>
              <div>
                <p className="text-ink-subtle">Status</p>
                <p className="mt-1 flex items-center gap-1.5 font-medium text-ink-muted"><span className={`h-2 w-2 rounded-full ${statusDot(detailRow.status)}`} /> {detailRow.status}{detailRow.status === "Scheduled" && detailRow.publish_at ? ` · goes live ${when(detailRow.publish_at)}` : ""}</p>
              </div>
              <div><p className="text-ink-subtle">Author</p><p className="mt-1 flex items-center gap-2 font-medium text-ink-muted"><Avatar name={detailRow.author || "?"} size="xs" /> {detailRow.author || "Unknown"}</p></div>
              <div><p className="text-ink-subtle">Last Updated</p><p className="mt-1 font-medium text-ink-muted">{detailRow.updated}</p></div>
              <div className="col-span-2"><p className="text-ink-subtle">Audience</p><p className="mt-1 font-medium text-ink-muted">{detailRow.audience_mode === "everyone" ? "Every member" : `${detailRow.audience_mode === "regions" ? "Regions" : "Segments"}: ${detailRow.audience_values.join(", ")}`}</p></div>
            </div>
          </div>
        )}
      </Modal>

      {/* Media library */}
      <Modal
        open={mediaOpen}
        onClose={() => setMediaOpen(false)}
        title="Media Library"
        description="Every file uploaded through this dashboard."
        icon={ImageIcon}
        iconTone="violet"
        size="lg"
        footer={<button className="btn btn-outline" onClick={() => setMediaOpen(false)}>Close</button>}
      >
        <p className="mb-3 text-xs text-ink-subtle">{stats?.storage_label ?? ""}. Search, preview, reuse or safely remove uploaded assets.</p>
        <div className="mb-3 flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              value={mediaSearch}
              onChange={(e) => setMediaSearch(e.target.value)}
              placeholder="Search file names…"
              aria-label="Search media files"
              className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
            />
          </div>
          <Select
            aria-label="Filter media by kind"
            value={mediaKind}
            onChange={(e) => setMediaKind(e.target.value)}
            options={[
              { value: "", label: "All asset types" },
              { value: "cover", label: "Covers" },
              { value: "avatar", label: "Avatars" },
              { value: "attachment", label: "Attachments" },
            ]}
          />
        </div>
        {uploads === null ? (
          <p className="flex items-center gap-2 py-6 text-xs text-ink-subtle"><Loader2 className="h-4 w-4 animate-spin" /> Loading files…</p>
        ) : uploads.items.length === 0 ? (
          <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-xs text-ink-subtle">No files uploaded yet.</p>
        ) : (
          <ul className="max-h-[50vh] divide-y divide-line overflow-y-auto rounded-lg border border-line">
            {uploads.items.map((u) => (
              <li key={u.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                {u.content_type.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-inset text-ink-subtle"><FileText className="h-4 w-4" /></span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{u.original_name}</p>
                  <p className="text-xs text-ink-subtle">{u.size_label} · {u.kind} · {u.uploaded_by_name || "unknown"} · {u.uploaded}</p>
                </div>
                {u.content_type.startsWith("image/") && (
                  <button className="btn btn-sm btn-outline" onClick={() => useMediaAsCover(u)}>Use</button>
                )}
                <a href={u.url} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost">Preview</a>
                <button className="btn btn-sm btn-ghost text-status-danger-ink" aria-label={`Remove ${u.original_name}`} onClick={() => void removeMedia(u)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {uploads && uploads.total > uploads.items.length && <p className="mt-2 text-xs text-ink-subtle">Showing the newest {uploads.items.length} of {uploads.total}.</p>}
      </Modal>
    </div>
  );
}
