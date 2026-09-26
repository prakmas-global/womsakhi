"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ClipboardCheck, Download, FileQuestion, MoreHorizontal, Plus, Search,
  SlidersHorizontal, Target, Trophy, Users,
} from "lucide-react";
import {
  Badge, Card, ErrorState, Input, Menu, MenuItem, Modal, Pagination, Select, Spinner,
  StatCard, Textarea, useConfirm, useToast,
} from "@/design-system";
import { useAuth } from "@/context/AuthContext";
import { memberError } from "@/lib/member-api";
import {
  STATUS_LABEL, STATUS_TONE,
  apiAssessments, apiAssessmentsCsv, apiCreateAssessment, apiDeleteAssessment,
  apiLearningPermissions, apiUpdateAssessment, fmtDate, saveCsv,
  type AssessmentInput, type AssessmentPage, type AssessmentRow, type AssessmentStatus,
  type LearningAction,
} from "@/lib/learning-admin-api";

/**
 * The skill tests a woman can take on her phone.
 *
 * Every number here is counted from the attempts collection at request time:
 * a test with nobody's score against it shows "—" for its pass rate, not 0%.
 * Deleting is refused once anyone has taken a test — her score needs a test
 * to point at — so the row offers "Archive" instead and the server says why.
 */

const PAGE_SIZE = 15;

type Filter = "" | AssessmentStatus;

const BLANK: AssessmentInput = { skill: "", title: "", blurb: "", minutes: 20, pass_mark: 60, status: "draft" };

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft — not on the phone yet" },
  { value: "published", label: "Published — members can take it" },
  { value: "archived", label: "Archived — kept for the scores it holds" },
];

export default function AssessmentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const isSuper = user?.role === "Super Admin";

  const [data, setData] = useState<AssessmentPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [perms, setPerms] = useState<Set<LearningAction>>(new Set());
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState<Filter>("");
  const [page, setPage] = useState(1);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AssessmentRow | null>(null);
  const [form, setForm] = useState<AssessmentInput>(BLANK);
  const [busy, setBusy] = useState(false);

  const can = useCallback((a: LearningAction) => perms.has(a), [perms]);

  useEffect(() => {
    let alive = true;
    apiLearningPermissions(isSuper).then((p) => { if (alive) setPerms(p); }).catch(() => {});
    return () => { alive = false; };
  }, [isSuper]);

  // Type, pause, search: one request per pause rather than one per keystroke.
  useEffect(() => {
    const t = setTimeout(() => { setTerm(query.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await apiAssessments({ q: term, status: filter, page, page_size: PAGE_SIZE }));
    } catch (e) {
      setError(memberError(e));
    } finally {
      setLoading(false);
    }
  }, [term, filter, page]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const openCreate = useCallback(() => { setForm(BLANK); setCreating(true); }, []);

  const openEdit = useCallback((row: AssessmentRow) => {
    setForm({
      skill: row.skill, title: row.title, blurb: row.blurb, minutes: row.minutes,
      pass_mark: row.pass_mark, status: (row.status as AssessmentStatus) || "draft",
    });
    setEditing(row);
  }, []);

  const create = useCallback(async () => {
    if (!form.title.trim()) { toast.error("Give the test a title"); return; }
    setBusy(true);
    try {
      const made = await apiCreateAssessment({ ...form, title: form.title.trim(), skill: form.skill.trim() });
      setCreating(false);
      toast.success("Test created", { description: "Add its questions, then publish it." });
      router.push(`/dashboard/learning/assessments/${made.id}`);
    } catch (e) {
      toast.error("Could not create the test", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [form, router, toast]);

  const save = useCallback(async () => {
    if (!editing) return;
    if (!form.title.trim()) { toast.error("Give the test a title"); return; }
    setBusy(true);
    try {
      await apiUpdateAssessment(editing.id, { ...form, title: form.title.trim(), skill: form.skill.trim() });
      setEditing(null);
      toast.success("Saved");
      await load();
    } catch (e) {
      toast.error("Could not save", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [editing, form, load, toast]);

  const setStatus = useCallback(async (row: AssessmentRow, status: AssessmentStatus) => {
    if (status === "archived") {
      const ok = await confirm({
        title: `Archive "${row.title}"?`,
        description: "It leaves the phone but keeps every score already recorded against it. You can publish it again later.",
        confirmLabel: "Archive",
      });
      if (!ok) return;
    }
    try {
      await apiUpdateAssessment(row.id, {
        skill: row.skill, title: row.title, blurb: row.blurb, minutes: row.minutes,
        pass_mark: row.pass_mark, status,
      });
      toast.success(
        status === "published" ? "Published — it is on the phone now"
          : status === "archived" ? "Archived" : "Taken off the phone",
      );
      await load();
    } catch (e) {
      toast.error("Could not change that", { description: memberError(e) });
    }
  }, [confirm, load, toast]);

  const remove = useCallback(async (row: AssessmentRow) => {
    const ok = await confirm({
      title: `Delete "${row.title}"?`,
      description: row.attempt_count > 0
        ? `${row.attempt_count} attempt${row.attempt_count === 1 ? "" : "s"} point at this test, so the server will refuse — archive it instead.`
        : "Nobody has taken it. It is gone for good.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiDeleteAssessment(row.id);
      toast.success("Deleted");
      await load();
    } catch (e) {
      toast.error("Not deleted", { description: memberError(e) });
    }
  }, [confirm, load, toast]);

  const exportCsv = useCallback(async () => {
    try {
      saveCsv(await apiAssessmentsCsv(), "womsakhi-assessments.csv");
      toast.success("CSV downloaded");
    } catch (e) {
      toast.error("Could not export", { description: memberError(e) });
    }
  }, [toast]);

  const summary = data?.summary;
  const rows = data?.items ?? [];
  const filtered = term !== "" || filter !== "";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <ClipboardCheck className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Skill tests</h1>
            <p className="mt-1 text-sm text-ink-subtle">
              Twenty minutes on a phone, marked on the server. What is published, and how it is being passed.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {can("export") && (
            <button className="btn btn-outline" onClick={() => void exportCsv()}>
              <Download className="h-4 w-4" /> Export CSV
            </button>
          )}
          {can("create") && (
            <button className="btn btn-primary" onClick={openCreate}>
              <Plus className="h-4 w-4" /> New test
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Tests" value={summary ? String(summary.total) : "—"} icon={ClipboardCheck} tone="brand"
                  deltaNote={summary ? `${summary.draft} draft · ${summary.archived} archived` : "Loading"} />
        <StatCard label="On the phone" value={summary ? String(summary.published) : "—"} icon={Target} tone="emerald"
                  deltaNote="Published now" />
        <StatCard label="Attempts" value={summary ? String(summary.attempts) : "—"} icon={Users} tone="violet"
                  deltaNote="Across every test, struck-out ones excluded" />
        <StatCard label="Pass rate" value={summary && summary.pass_rate !== null ? `${summary.pass_rate}%` : "—"}
                  icon={Trophy} tone="amber"
                  deltaNote={summary && summary.pass_rate === null ? "Nobody has tried yet" : "Of attempts that count"} />
      </div>

      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-ink">Every test</h2>
            <p className="text-xs text-ink-subtle">Open one to write its questions and see who has taken it.</p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              placeholder="Search by title or skill…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
            />
          </div>
          <Menu
            trigger={
              <span className="btn btn-sm btn-outline">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {filter === "" ? "All statuses" : STATUS_LABEL[filter]}
              </span>
            }
          >
            <MenuItem onClick={() => { setFilter(""); setPage(1); }}>All statuses</MenuItem>
            <MenuItem onClick={() => { setFilter("published"); setPage(1); }}>Published</MenuItem>
            <MenuItem onClick={() => { setFilter("draft"); setPage(1); }}>Draft</MenuItem>
            <MenuItem onClick={() => { setFilter("archived"); setPage(1); }}>Archived</MenuItem>
          </Menu>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : error ? (
          <ErrorState title="Could not load the tests" description={error} onRetry={() => { setLoading(true); void load(); }} />
        ) : rows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-brand-ink">
              <FileQuestion className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink">{filtered ? "Nothing matches that" : "No tests yet"}</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-ink-subtle">
              {filtered ? "Try a different search, or clear the filter."
                : "Write the first one. It stays a draft until you publish it."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                  <th className="px-3 py-2.5">Test</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Questions</th>
                  <th className="px-3 py-2.5">Pass mark</th>
                  <th className="px-3 py-2.5">Attempts</th>
                  <th className="px-3 py-2.5">Pass rate</th>
                  <th className="px-3 py-2.5">Updated</th>
                  <th className="px-3 py-2.5 text-right">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                    <td className="px-3 py-3">
                      <Link href={`/dashboard/learning/assessments/${row.id}`} className="block min-w-0 max-w-xs">
                        <p className="truncate text-sm font-semibold text-ink hover:underline">{row.title}</p>
                        <p className="truncate text-xs text-ink-subtle">
                          {row.skill}{row.minutes ? ` · ${row.minutes} min` : ""}
                        </p>
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={STATUS_TONE[row.status] ?? "slate"}>{STATUS_LABEL[row.status] ?? row.status}</Badge>
                    </td>
                    <td className="px-3 py-3 text-sm text-ink-muted">{row.question_count}</td>
                    <td className="px-3 py-3 text-sm text-ink-muted">{row.pass_mark}%</td>
                    <td className="px-3 py-3 text-sm text-ink-muted">{row.attempt_count}</td>
                    <td className="px-3 py-3 text-sm text-ink-muted">
                      {row.pass_rate === null ? <span className="text-ink-subtle">—</span> : `${row.pass_rate}%`}
                      {row.attempt_count > 0 && (
                        <span className="ml-1 text-2xs text-ink-subtle">({row.pass_count} passed)</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-ink-subtle">{fmtDate(row.updated_at)}</td>
                    <td className="px-3 py-3 text-right">
                      <Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}>
                        <MenuItem href={`/dashboard/learning/assessments/${row.id}`}>Open questions &amp; attempts</MenuItem>
                        {can("edit") && <MenuItem onClick={() => openEdit(row)}>Edit details</MenuItem>}
                        {can("edit") && row.status !== "published" && (
                          <MenuItem onClick={() => void setStatus(row, "published")}>Publish</MenuItem>
                        )}
                        {can("edit") && row.status === "published" && (
                          <MenuItem onClick={() => void setStatus(row, "draft")}>Take off the phone</MenuItem>
                        )}
                        {can("edit") && row.status !== "archived" && (
                          <MenuItem onClick={() => void setStatus(row, "archived")}>Archive</MenuItem>
                        )}
                        {can("delete") && (
                          <MenuItem danger onClick={() => void remove(row)}>Delete</MenuItem>
                        )}
                      </Menu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.pages > 1 && (
          <Pagination
            page={data.page}
            pageCount={data.pages}
            onPageChange={setPage}
            showing={`Showing ${(data.page - 1) * data.page_size + 1} to ${Math.min(data.page * data.page_size, data.total)} of ${data.total} tests`}
          />
        )}
      </Card>

      {/* ── create / edit ───────────────────────────────────────────────── */}
      <Modal
        open={creating || !!editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        title={editing ? "Edit the test" : "New test"}
        description={editing ? undefined : "It starts as a draft. Add questions on the next screen, then publish."}
      >
        <div className="space-y-4">
          <Input label="Title" required value={form.title}
                 onChange={(e) => setForm({ ...form, title: e.target.value })}
                 placeholder="Stitching to measure" />
          <Input label="Skill" value={form.skill}
                 onChange={(e) => setForm({ ...form, skill: e.target.value })}
                 placeholder="Tailoring" hint="Shown as the small line under the title on the phone." />
          <Textarea label="What she is told before starting" value={form.blurb} rows={2}
                    onChange={(e) => setForm({ ...form, blurb: e.target.value })}
                    placeholder="Twenty minutes on your phone. Nobody watches, and you may take it again." />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Minutes" type="number" min={1} max={240} value={String(form.minutes)}
                   onChange={(e) => setForm({ ...form, minutes: Math.max(1, Number(e.target.value) || 1) })} />
            <Input label="Pass mark (%)" type="number" min={1} max={100} value={String(form.pass_mark)}
                   onChange={(e) => setForm({ ...form, pass_mark: Math.min(100, Math.max(1, Number(e.target.value) || 1)) })} />
          </div>
          {editing && (
            <Select label="Status" value={form.status} options={STATUS_OPTIONS}
                    onChange={(e) => setForm({ ...form, status: e.target.value as AssessmentStatus })} />
          )}
          {editing && editing.attempt_count > 0 && (
            <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-ink-muted">
              {editing.attempt_count} attempt{editing.attempt_count === 1 ? "" : "s"} already recorded. Changing the
              pass mark does not re-mark them.
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn btn-outline" onClick={() => { setCreating(false); setEditing(null); }}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => void (editing ? save() : create())}>
              {busy ? "Saving…" : editing ? "Save" : "Create and add questions"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
