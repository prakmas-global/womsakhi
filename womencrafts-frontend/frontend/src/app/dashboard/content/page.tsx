"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileStack,
  CircleCheck,
  PencilLine,
  CalendarClock,
  Trash2,
  ChevronDown,
  Search,
  SlidersHorizontal,
  Plus,
  Eye,
  Pencil,
  MoreVertical,
  FileText,
  Newspaper,
  Image as ImageIcon,
  MessageSquareQuote,
  HelpCircle,
  Megaphone,
  Download,
  Upload,
  Star,
  Filter,
  Inbox,
} from "lucide-react";
import { Avatar, Badge, Card, ImageUpload, Input, Menu, MenuItem, Modal, ProgressBar, Select, StatCard, Textarea, Thumb, useConfirm, useToast } from "@/design-system";
import DonutChart from "@/components/charts/DonutChart";
import Link from "next/link";
import { TONE_BG } from "@/lib/tones";
import {
  apiListContent,
  apiContentStats,
  apiContentActivity,
  apiContentAuthors,
  apiCreateContent,
  apiUpdateContent,
  apiSetContentStatus,
  apiDeleteContent,
  apiBulkContent,
  type ApiContent,
  type ContentStats,
  type ContentActivity,
} from "@/lib/content-api";
import { memberError } from "@/lib/member-api";
import { ResizableColumns } from "@/layout-engine";

const TABS = ["All Content", "Pages", "Blog Posts", "Media", "Testimonials", "FAQs", "Banners"];

type Tone = "violet" | "emerald" | "amber" | "brand" | "sky" | "rose";
type ContentType = "Page" | "Blog Post" | "Media" | "Banner" | "FAQ" | "Program" | "Testimonial";
type ContentStatus = "Published" | "Draft" | "Scheduled";

type ContentRow = {
  id: string;
  icon: React.ElementType;
  title: string;
  slug: string;
  type: ContentType;
  tone: Tone;
  status: ContentStatus;
  sTone: string;
  author: string;
  updated: string;
  description: string;
  cover: string;
};

// Backend sends the lucide icon as a NAME string (for both content types and
// the activity feed); map it back to the imported component.
const ICON_MAP: Record<string, React.ElementType> = {
  FileText,
  Newspaper,
  ImageIcon,
  Megaphone,
  HelpCircle,
  FileStack,
  MessageSquareQuote,
  CircleCheck,
  Pencil,
  CalendarClock,
  Trash2,
};

// Map an API content item onto the exact shape the table/detail/edit UI reads.
function toRow(c: ApiContent): ContentRow {
  return {
    id: c.id, // mongo _id — used for update/delete/status calls
    icon: ICON_MAP[c.icon] ?? FileText,
    title: c.title,
    slug: c.slug,
    type: c.type as ContentType,
    tone: c.tone as Tone,
    status: c.status as ContentStatus,
    sTone: c.s_tone,
    author: c.author,
    updated: c.updated,
    description: c.description,
    cover: c.cover || "",
  };
}

// Fallback author list (matches the seeded authors); overwritten by live data.
const AUTHORS = ["Neha Verma", "Priya Sharma", "Ritika Singh", "Anjali Mehta"];

const TYPE_OPTIONS: ContentType[] = ["Page", "Blog Post", "Media", "Banner", "FAQ", "Program"];
const STATUS_OPTIONS: ContentStatus[] = ["Published", "Draft", "Scheduled"];

const TAB_TYPE: Record<string, ContentType | null> = {
  "All Content": null,
  Pages: "Page",
  "Blog Posts": "Blog Post",
  Media: "Media",
  Testimonials: "Testimonial",
  FAQs: "FAQ",
  Banners: "Banner",
};

const PAGE_SIZE = 8;

type FormState = {
  title: string;
  type: ContentType;
  status: ContentStatus;
  author: string;
  slug: string;
  description: string;
  cover: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  type: "Page",
  status: "Draft",
  author: AUTHORS[0],
  slug: "",
  description: "",
  cover: "",
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
  const [rows, setRows] = useState<ContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ContentStats | null>(null);
  const [activity, setActivity] = useState<ContentActivity[]>([]);
  const [authors, setAuthors] = useState<string[]>(AUTHORS);
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ContentType | "All Types">("All Types");
  const [statusFilter, setStatusFilter] = useState<ContentStatus | "All Status">("All Status");
  const [authorFilter, setAuthorFilter] = useState<string>("All Authors");
  const [publishedOnly, setPublishedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [mediaOpen, setMediaOpen] = useState(false);

  // Load content + stats + activity + authors from the backend. Client-side
  // filtering/search/tabs/pagination below stay exactly as they were.
  const refresh = useCallback(async () => {
    try {
      const [list, s, act, auth] = await Promise.all([
        apiListContent({ page_size: 100 }),
        apiContentStats(),
        apiContentActivity(4),
        apiContentAuthors(),
      ]);
      setRows(list.items.map(toRow));
      setStats(s);
      setActivity(act);
      if (auth.length) setAuthors(auth);
    } catch {
      /* leave current data; a toast could surface the error */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const resetPage = () => setPage(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const tabType = TAB_TYPE[activeTab];
    return rows.filter((r) => {
      const matchesTab = tabType === null || r.type === tabType;
      const matchesSearch =
        q === "" ||
        r.title.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q);
      const matchesType = typeFilter === "All Types" || r.type === typeFilter;
      const matchesStatus = statusFilter === "All Status" || r.status === statusFilter;
      const matchesAuthor = authorFilter === "All Authors" || r.author === authorFilter;
      const matchesExtra = !publishedOnly || r.status === "Published";
      return matchesTab && matchesSearch && matchesType && matchesStatus && matchesAuthor && matchesExtra;
    });
  }, [rows, activeTab, search, typeFilter, statusFilter, authorFilter, publishedOnly]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(startIdx, startIdx + PAGE_SIZE);
  const showingFrom = filtered.length === 0 ? 0 : startIdx + 1;
  const showingTo = Math.min(startIdx + PAGE_SIZE, filtered.length);

  const visibleIds = pageRows.map((r) => r.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const detailRow = detailId ? rows.find((r) => r.id === detailId) ?? null : null;

  function toggleAllVisible() {
    setSelectedIds((prev) =>
      allVisibleSelected ? prev.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...prev, ...visibleIds]))
    );
  }
  function toggleRow(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  /**
   * Change a row's status, and offer to put it back.
   *
   * Publishing is the one action here that is genuinely reversible — the row
   * still exists either way — so Undo can be honest about what it does. It is
   * offered ONLY where that is true: a toast saying "Undo" next to something
   * that cannot be undone is a promise the interface does not keep, which is
   * worse than not offering it.
   *
   * The previous status is captured BEFORE the request. Reading it afterwards
   * would read the new one, and Undo would put it back where it already is.
   */
  async function setStatus(id: string, status: ContentStatus, offerUndo = true) {
    const previous = rows.find((r) => r.id === id)?.status;
    try {
      await apiSetContentStatus(id, status);
      await refresh();
      const undoable = offerUndo && previous && previous !== status;
      toast.success(status === "Published" ? "Published" : `Moved to ${status}`, {
        action: undoable
          ? { label: "Undo", onClick: () => void setStatus(id, previous, false) }
          : undefined,
      });
    } catch (err) {
      toast.error("Could not change the status", { description: memberError(err) });
    }
  }
  async function toggleStatus(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    await setStatus(id, row.status === "Published" ? "Draft" : "Published");
  }
  async function deleteRow(id: string) {
    if (!(await confirm({
      title: "Move this to Trash?",
      description: "It will be removed from the site. You can restore it from Trash.",
      confirmLabel: "Move to Trash",
      danger: true,
    }))) return;
    try {
      await apiDeleteContent(id);
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      if (detailId === id) setDetailId(null);
      await refresh();
      toast.success("Moved to Trash");
    } catch (err) {
      toast.error("Could not move it to Trash", { description: memberError(err) });
    }
  }

  async function bulkPublish() {
    if (selectedIds.length === 0) return;
    try {
      await apiBulkContent(selectedIds, "publish");
      setSelectedIds([]);
      await refresh();
    } catch (err) {
      toast.error("Could not publish those", { description: memberError(err) });
    }
  }
  async function bulkDraft() {
    if (selectedIds.length === 0) return;
    try {
      await apiBulkContent(selectedIds, "draft");
      setSelectedIds([]);
      await refresh();
    } catch (err) {
      toast.error("Could not move those to Draft", { description: memberError(err) });
    }
  }
  async function bulkTrash() {
    if (selectedIds.length === 0) return;
    try {
      await apiBulkContent(selectedIds, "trash");
      setSelectedIds([]);
      await refresh();
    } catch (err) {
      toast.error("Could not move those to Trash", { description: memberError(err) });
    }
  }

  function openAdd() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setAddOpen(true);
  }
  function openEdit(r: ContentRow) {
    setEditId(r.id);
    setForm({
      title: r.title,
      type: r.type,
      status: r.status,
      author: r.author,
      slug: r.slug,
      description: r.description,
      cover: r.cover,
    });
    setDetailId(null);
    setAddOpen(true);
  }
  async function submitForm() {
    if (!form.title.trim()) return;
    const body = {
      title: form.title.trim(),
      type: form.type,
      status: form.status,
      author: form.author,
      slug: form.slug.trim(),
      description: form.description,
      cover: form.cover,
    };
    try {
      if (editId) {
        await apiUpdateContent(editId, body);
      } else {
        await apiCreateContent(body);
        setPage(1);
      }
      await refresh();
      setAddOpen(false);
      setEditId(null);
      setForm(EMPTY_FORM);
    } catch (err) {
      toast.error("Could not save the content", { description: memberError(err) });
    }
  }

  function exportCsv() {
    const header = ["Title", "Slug", "Type", "Status", "Author", "Last Updated"];
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [
      header.join(","),
      ...filtered.map((r) => [r.title, r.slug, r.type, r.status, r.author, r.updated].map(escape).join(",")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "content-export.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const hasSelection = selectedIds.length > 0;

  return (
    <div>
      <div className="mb-6 flex items-start gap-3">
        <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
          <FileStack className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Content</h1>
          <p className="mt-1 text-sm text-ink-subtle">Create, manage and organize all your website content.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total Content" value={(stats?.total_content ?? 0).toLocaleString()} icon={FileStack} tone="violet" deltaNote="All published & draft" />
        <StatCard label="Published" value={(stats?.published ?? 0).toLocaleString()} icon={CircleCheck} tone="emerald" deltaNote={`${stats?.published_pct ?? 0}% of total`} />
        <StatCard label="Draft" value={(stats?.draft ?? 0).toLocaleString()} icon={PencilLine} tone="amber" deltaNote={`${stats?.draft_pct ?? 0}% of total`} />
        <StatCard label="Scheduled" value={(stats?.scheduled ?? 0).toLocaleString()} icon={CalendarClock} tone="sky" deltaNote={`${stats?.scheduled_pct ?? 0}% of total`} />
        <StatCard label="Trash" value={(stats?.trash ?? 0).toLocaleString()} icon={Trash2} tone="rose" deltaNote={`${stats?.trash_pct ?? 0}% of total`} />
      </div>

      <ResizableColumns id="content" defaultSize={0.74} className="mt-6 gap-6">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <div className="flex flex-wrap gap-5 text-sm">
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setActiveTab(t);
                    resetPage();
                  }}
                  className={`-mb-px border-b-2 pb-3 font-medium ${activeTab === t ? "border-brand-600 text-brand-ink" : "border-transparent text-ink-subtle hover:text-ink-muted"}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2.5">
              <Menu
                trigger={
                  <button
                    className="btn btn-sm btn-outline disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!hasSelection}
                    title={hasSelection ? undefined : "Select rows to enable bulk actions"}
                  >
                    Bulk Actions{hasSelection ? ` (${selectedIds.length})` : ""} <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" />
                  </button>
                }
              >
                <MenuItem icon={CircleCheck} onClick={bulkPublish}>Publish</MenuItem>
                <MenuItem icon={PencilLine} onClick={bulkDraft}>Move to Draft</MenuItem>
                <MenuItem icon={Trash2} danger onClick={bulkTrash}>Move to Trash</MenuItem>
              </Menu>
              <button className="btn btn-primary" onClick={openAdd}><Plus className="h-4 w-4" /> Add New Content</button>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[160px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  resetPage();
                }}
                placeholder="Search content..."
                className="w-full rounded-lg border border-line-strong py-2 pl-9 pr-3 text-sm outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
              />
            </div>
            <Menu align="left" trigger={<Dropdown label={typeFilter} />}>
              {(["All Types", ...TYPE_OPTIONS] as (ContentType | "All Types")[]).map((opt) => (
                <MenuItem key={opt} onClick={() => { setTypeFilter(opt); resetPage(); }}>{opt}</MenuItem>
              ))}
            </Menu>
            <Menu align="left" trigger={<Dropdown label={statusFilter} />}>
              {(["All Status", ...STATUS_OPTIONS] as (ContentStatus | "All Status")[]).map((opt) => (
                <MenuItem key={opt} onClick={() => { setStatusFilter(opt); resetPage(); }}>{opt}</MenuItem>
              ))}
            </Menu>
            <Menu align="left" trigger={<Dropdown label={authorFilter} />}>
              {["All Authors", ...authors].map((opt) => (
                <MenuItem key={opt} onClick={() => { setAuthorFilter(opt); resetPage(); }}>{opt}</MenuItem>
              ))}
            </Menu>
            <Menu align="left" trigger={<button className="btn btn-sm btn-outline"><SlidersHorizontal className="h-3.5 w-3.5" /> More Filters</button>}>
              <MenuItem icon={Filter} onClick={() => { setPublishedOnly((v) => !v); resetPage(); }}>
                {publishedOnly ? "Show all statuses" : "Published only"}
              </MenuItem>
              <MenuItem icon={Download} onClick={exportCsv}>Export CSV</MenuItem>
              <MenuItem
                icon={Trash2}
                onClick={() => {
                  setSearch("");
                  setTypeFilter("All Types");
                  setStatusFilter("All Status");
                  setAuthorFilter("All Authors");
                  setPublishedOnly(false);
                  resetPage();
                }}
              >
                Clear filters
              </MenuItem>
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
                  <tr
                    key={r.id}
                    onClick={() => setDetailId(r.id)}
                    className="cursor-pointer text-sm hover:bg-surface-hover/60"
                  >
                    <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${r.title}`} checked={selectedIds.includes(r.id)} onChange={() => toggleRow(r.id)} className="rounded border-line-strong accent-brand-600" /></td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2.5">
                        <Thumb seed={r.title} src={r.cover} alt={r.title} className="h-10 w-10 rounded-lg" />
                        <div className="max-w-[220px]"><p className="truncate font-semibold text-ink">{r.title}</p><p className="truncate text-xs text-ink-subtle">{r.slug}</p></div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-3"><Badge tone={r.tone}>{r.type}</Badge></td>
                    <td className="whitespace-nowrap px-2 py-3">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                        <span className={`h-2 w-2 rounded-full ${r.sTone === "emerald" ? "bg-status-ok-solid" : r.sTone === "sky" ? "bg-status-info-solid" : "bg-status-warn-solid"}`} /> {r.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-3"><span className="flex items-center gap-2"><Avatar name={r.author} size="xs" /><span className="text-ink-muted">{r.author}</span></span></td>
                    <td className="whitespace-nowrap px-2 py-3 text-xs text-ink-subtle">{r.updated}</td>
                    <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2 text-ink-subtle">
                        <button aria-label={`View ${r.title}`} className="hover:text-ink-muted" onClick={() => setDetailId(r.id)}><Eye className="h-4 w-4" /></button>
                        <button aria-label={`Edit ${r.title}`} className="hover:text-ink-muted" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></button>
                        <Menu
                          trigger={<span aria-label={`More actions for ${r.title}`} className="flex hover:text-ink-muted"><MoreVertical className="h-4 w-4" /></span>}
                        >
                          <MenuItem icon={Eye} onClick={() => setDetailId(r.id)}>View</MenuItem>
                          <MenuItem icon={Pencil} onClick={() => openEdit(r)}>Edit</MenuItem>
                          {r.status === "Published" ? (
                            <MenuItem icon={PencilLine} onClick={() => setStatus(r.id, "Draft")}>Move to Draft</MenuItem>
                          ) : (
                            <MenuItem icon={CircleCheck} onClick={() => setStatus(r.id, "Published")}>Publish</MenuItem>
                          )}
                          <MenuItem icon={Trash2} danger onClick={() => deleteRow(r.id)}>Move to Trash</MenuItem>
                        </Menu>
                      </div>
                    </td>
                  </tr>
                ))}
                {loading && rows.length === 0 && (
                  <tr className="text-sm">
                    <td colSpan={7} className="px-2 py-12 text-center text-ink-subtle">
                      Loading content…
                    </td>
                  </tr>
                )}
                {!loading && pageRows.length === 0 && (
                  <tr className="text-sm">
                    <td colSpan={7} className="px-2 py-12">
                      <div className="flex flex-col items-center justify-center gap-2 text-center">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-inset text-ink-subtle">
                          <Inbox className="h-5 w-5" />
                        </span>
                        <p className="text-sm font-medium text-ink-muted">No content found</p>
                        <p className="text-xs text-ink-subtle">
                          No {activeTab === "All Content" ? "content" : activeTab.toLowerCase()} match your current filters.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <p className="text-ink-subtle">Showing {showingFrom} to {showingTo} of {filtered.length} items</p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-line-strong text-ink-subtle hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
              >‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={
                    n === currentPage
                      ? "flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 font-semibold text-white"
                      : "flex h-8 w-8 items-center justify-center rounded-lg border border-line-strong text-ink-subtle hover:bg-surface-hover"
                  }
                >{n}</button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-line-strong text-ink-subtle hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
              >›</button>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-ink">Content Overview</h2>
              <button className="text-xs font-semibold text-brand-ink transition hover:underline" onClick={() => setActiveTab("All Content")}>View All</button>
            </div>
            <div className="flex items-center gap-3">
              <DonutChart data={stats?.overview ?? []} centerValue={stats?.overview_total ?? "0"} centerLabel="Total" size={130} thickness={18} />
              <ul className="flex-1 space-y-1.5">
                {(stats?.overview ?? []).map((o) => (
                  <li key={o.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-ink-muted"><span className="h-2 w-2 rounded-full" style={{ background: o.color }} /> {o.name}</span>
                    <span className="shrink-0 whitespace-nowrap font-medium text-ink-subtle">{o.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-ink">Recent Activity</h2>
              <button className="text-xs font-semibold text-brand-ink transition hover:underline" onClick={exportCsv}>View All</button>
            </div>
            <ul className="space-y-3">
              {activity.map((a) => {
                const ActivityIcon = ICON_MAP[a.icon] ?? CircleCheck;
                return (
                  <li key={a.id} className="flex items-start gap-3">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONE_BG[a.tone]}`}><ActivityIcon className="h-4 w-4" /></span>
                    <div><p className="text-sm font-medium text-ink-muted">{a.text}</p><p className="text-xs text-ink-subtle">{a.meta}</p></div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-ink">Content Categories</h2>
              <button className="text-xs font-semibold text-brand-ink transition hover:underline" onClick={() => setActiveTab("Blog Posts")}>View All</button>
            </div>
            <ul className="space-y-2.5">
              {(stats?.categories ?? []).map((c) => (
                <li key={c.name}>
                  <div className="mb-1 flex items-center justify-between text-xs"><span className="text-ink-muted">{c.name}</span><span className="text-ink-subtle">{c.label}</span></div>
                  <ProgressBar value={c.value * 2.5} color="var(--color-violet-500)" />
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <div className="mb-2 flex items-center justify-between text-sm"><h2 className="font-display font-semibold text-ink">Storage Usage</h2><span className="text-ink-subtle">{stats?.storage_percent ?? 0}%</span></div>
            <ProgressBar value={stats?.storage_percent ?? 0} color="var(--color-violet-500)" />
            <p className="mt-1 text-xs text-ink-subtle">{stats?.storage_used_gb ?? 0} GB of {stats?.storage_total_gb ?? 0} GB used</p>
            <button className="btn btn-secondary btn-block mt-3" onClick={() => setMediaOpen(true)}>Manage Media Library</button>
          </Card>
        </div>
      </ResizableColumns>

      {/* Add / Edit modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={editId ? "Edit Content" : "Add New Content"}
        description={editId ? "Update this content item." : "Create a new piece of website content."}
        icon={editId ? Pencil : FileStack}
        iconTone="brand"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setAddOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={submitForm}>
              {editId ? <><Pencil className="h-4 w-4" /> Save Changes</> : <><Plus className="h-4 w-4" /> Add Content</>}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Title"
            required
            className="col-span-2"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Enter content title"
          />
          <Select
            label="Type"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ContentType }))}
            options={["Page", "Blog Post", "Media", "Banner", "FAQ", "Program"]}
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ContentStatus }))}
            options={["Published", "Draft", "Scheduled"]}
          />
          <Select
            label="Author"
            value={form.author}
            onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
            options={authors}
          />
          <Input
            label="Slug"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            placeholder="/example-slug"
          />
          <Textarea
            label="Description"
            className="col-span-2"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Short description of this content…"
          />
          <ImageUpload
            className="col-span-2"
            variant="cover"
            kind="cover"
            label="Cover image"
            hint="Shown on the content list and detail view. JPG, PNG, WEBP or GIF up to 5 MB."
            value={form.cover || null}
            onChange={(url) => setForm((f) => ({ ...f, cover: url ?? "" }))}
          />
        </div>
      </Modal>

      {/* Detail modal */}
      <Modal
        open={detailRow !== null}
        onClose={() => setDetailId(null)}
        title={detailRow?.title ?? "Content"}
        description={detailRow?.slug}
        icon={detailRow?.icon ?? FileStack}
        iconTone="brand"
        footer={
          detailRow && (
            <>
              <button className="btn btn-outline" onClick={() => { toggleStatus(detailRow.id); }}>
                {detailRow.status === "Published" ? "Unpublish" : "Publish"}
              </button>
              <button className="btn btn-primary" onClick={() => deleteRow(detailRow.id)} style={{ background: "var(--status-danger-solid)" }}>
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            </>
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
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
              <div>
                <p className="text-ink-subtle">Type</p>
                <div className="mt-1"><Badge tone={detailRow.tone}>{detailRow.type}</Badge></div>
              </div>
              <div>
                <p className="text-ink-subtle">Status</p>
                <p className="mt-1 flex items-center gap-1.5 font-medium text-ink-muted">
                  <span className={`h-2 w-2 rounded-full ${detailRow.sTone === "emerald" ? "bg-status-ok-solid" : detailRow.sTone === "sky" ? "bg-status-info-solid" : "bg-status-warn-solid"}`} /> {detailRow.status}
                </p>
              </div>
              <div>
                <p className="text-ink-subtle">Author</p>
                <p className="mt-1 flex items-center gap-2 font-medium text-ink-muted"><Avatar name={detailRow.author} size="xs" /> {detailRow.author}</p>
              </div>
              <div>
                <p className="text-ink-subtle">Last Updated</p>
                <p className="mt-1 font-medium text-ink-muted">{detailRow.updated}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Media library modal */}
      <Modal
        open={mediaOpen}
        onClose={() => setMediaOpen(false)}
        title="Media Library"
        description="Manage uploaded media and storage usage."
        icon={ImageIcon}
        iconTone="violet"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setMediaOpen(false)}>Close</button>
            <Link href="/dashboard/content" className="btn btn-primary"><Upload className="h-4 w-4" /> Upload Media</Link>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between text-sm"><span className="font-semibold text-ink">Storage Usage</span><span className="text-ink-subtle">{stats?.storage_percent ?? 0}%</span></div>
            <ProgressBar value={stats?.storage_percent ?? 0} color="var(--color-violet-500)" />
            <p className="mt-1 text-xs text-ink-subtle">{stats?.storage_used_gb ?? 0} GB of {stats?.storage_total_gb ?? 0} GB used</p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-line p-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-status-warn-bg text-status-warn-ink"><Star className="h-4.5 w-4.5" /></span>
            <p className="text-sm text-ink-muted">Optimize images to free up storage and speed up page loads.</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
