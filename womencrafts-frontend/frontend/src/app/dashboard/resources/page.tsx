"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive, ArchiveRestore, BookOpen, CheckCircle2, FileEdit, MoreHorizontal,
  Plus, Search, SlidersHorizontal, Undo2, Users,
} from "lucide-react";
import {
  Badge, Card, ErrorState, Input, Menu, MenuItem, Modal, Pagination, Select, Spinner,
  StatCard, Tabs, Textarea, useConfirm, useToast,
} from "@/design-system";
import {
  STATUS_LABEL, STATUS_TONE, TOPIC_LABEL, TOPIC_PAYLOAD_HINT, TOPICS,
  apiApproveEntry, apiArchiveEntry, apiCatalogue, apiCatalogueEntry, apiCreateEntry,
  apiResourcesSummary, apiUnarchiveEntry, apiUnpublishEntry, apiUpdateEntry,
  type ReferenceInput, type ReferencePage, type ReferenceRow, type ReferenceStatus,
  type ReferenceTopic, type ResourcesSummary,
} from "@/lib/resources-admin-api";
import { memberError } from "@/lib/member-api";

/**
 * The reference catalogue: what a member sees under Schemes, Cover, Health,
 * Rights, Family and Travel, plus the helplines and guidance those screens
 * pull in.
 *
 * ── Two people, not one ─────────────────────────────────────────────────────
 * An entry added here is a draft. Members see it only after someone holding
 * `resources.approve` publishes it, and that name goes on the row. This is the
 * one module where an invented or mistyped fact sends a woman to a bank
 * counter asking for a scheme that does not exist, so nothing goes live on one
 * person's say-so.
 *
 * ── Uptake is a number ──────────────────────────────────────────────────────
 * "Marked by 41 members" is counted over their private marks. Who they are is
 * not returned by the server, so it cannot be shown here even by accident.
 */

const PAGE_SIZE = 15;

type FreeFilter = "" | "free" | "paid" | "unknown";
type StatusFilter = "" | ReferenceStatus;
type FreeChoice = "unknown" | "free" | "paid";

interface FormState {
  topic: string;
  title: string;
  who: string;
  body: string;
  city: string;
  rank: string;
  free: FreeChoice;
  cost_label: string;
  payloadText: string;
}

const FREE_OPTIONS = [
  { value: "unknown", label: "Not stated" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Costs something" },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "", label: "All states" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Drafts" },
  { value: "archived", label: "Archived" },
];

const FREE_FILTERS: { value: FreeFilter; label: string }[] = [
  { value: "", label: "Any cost" },
  { value: "free", label: "Free only" },
  { value: "paid", label: "Costs something" },
  { value: "unknown", label: "Cost not stated" },
];

function statusOf(row: ReferenceRow): ReferenceStatus {
  return row.status === "published" || row.status === "draft" || row.status === "archived"
    ? row.status
    : "draft";
}

function topicLabel(topic: string): string {
  return TOPIC_LABEL[topic as ReferenceTopic] ?? topic;
}

function payloadHint(topic: string): string {
  return TOPIC_PAYLOAD_HINT[topic as ReferenceTopic] ?? "";
}

function emptyForm(topic: string): FormState {
  return {
    topic: topic || TOPICS[0],
    title: "", who: "", body: "", city: "*", rank: "100",
    free: "unknown", cost_label: "", payloadText: "{}",
  };
}

function formFrom(row: ReferenceRow): FormState {
  return {
    topic: row.topic,
    title: row.title,
    who: row.who,
    body: row.body,
    city: row.city || "*",
    rank: String(row.rank),
    free: row.free === true ? "free" : row.free === false ? "paid" : "unknown",
    cost_label: row.cost_label,
    payloadText: JSON.stringify(row.payload ?? {}, null, 2),
  };
}

function toInput(form: FormState): { ok: true; body: ReferenceInput } | { ok: false; error: string } {
  if (!form.title.trim()) return { ok: false, error: "A title is needed" };
  const rank = Number.parseInt(form.rank, 10);
  if (Number.isNaN(rank) || rank < 0) return { ok: false, error: "Rank must be a whole number, 0 or more" };
  let payload: unknown = {};
  const text = form.payloadText.trim();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      return { ok: false, error: "The details block is not valid JSON" };
    }
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
      return { ok: false, error: "The details block must be an object like { \"number\": \"181\" }" };
    }
  }
  return {
    ok: true,
    body: {
      topic: form.topic,
      title: form.title.trim(),
      who: form.who.trim(),
      body: form.body.trim(),
      city: form.city.trim() || "*",
      rank,
      free: form.free === "free" ? true : form.free === "paid" ? false : null,
      cost_label: form.cost_label.trim(),
      payload: payload as Record<string, unknown>,
    },
  };
}

function when(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const STATE_LABEL: Record<string, string> = {
  saved: "Saved for later",
  applied: "Applied",
  active: "Holding it",
  done: "Done",
  declined: "Declined",
};

export default function ResourcesCataloguePage() {
  const toast = useToast();
  const confirm = useConfirm();

  const [summary, setSummary] = useState<ResourcesSummary | null>(null);
  const [topic, setTopic] = useState("");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [cityInput, setCityInput] = useState("");
  const [city, setCity] = useState("");
  const [free, setFree] = useState<FreeFilter>("");
  const [statusF, setStatusF] = useState<StatusFilter>("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<ReferencePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<{ id: string | null; status: ReferenceStatus | null; form: FormState } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<{ row: ReferenceRow | null; loading: boolean } | null>(null);

  // Typing should not fire a request per keystroke; a short pause does.
  useEffect(() => {
    const t = setTimeout(() => { setQ(qInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [qInput]);
  useEffect(() => {
    const t = setTimeout(() => { setCity(cityInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [cityInput]);

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await apiResourcesSummary());
    } catch (e) {
      toast.error("Could not load the counts", { description: memberError(e) });
    }
  }, [toast]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await apiCatalogue({ topic, q, city, free, status: statusF, page, page_size: PAGE_SIZE }));
    } catch (e) {
      setError(memberError(e));
    } finally {
      setLoading(false);
    }
  }, [topic, q, city, free, statusF, page]);

  // The effect body itself sets no state: the work happens inside an async
  // function it starts, which is what `react-hooks/set-state-in-effect` asks.
  useEffect(() => { void (async () => { await load(); })(); }, [load]);
  useEffect(() => { void (async () => { await loadSummary(); })(); }, [loadSummary]);

  const refreshAll = useCallback(async () => {
    await Promise.all([load(), loadSummary()]);
  }, [load, loadSummary]);

  const tabs = useMemo(() => {
    const byTopic = new Map((summary?.topics ?? []).map((t) => [t.topic, t]));
    const all = summary ? { value: "", label: "All topics", count: summary.catalogue.total } : { value: "", label: "All topics" };
    return [
      all,
      ...TOPICS.map((t) => {
        const c = byTopic.get(t);
        return c ? { value: t, label: TOPIC_LABEL[t], count: c.total } : { value: t, label: TOPIC_LABEL[t] };
      }),
    ];
  }, [summary]);

  const filtered = Boolean(q || city || free || statusF);

  const openCreate = useCallback(() => {
    setFormError(null);
    setEditing({ id: null, status: null, form: emptyForm(topic) });
  }, [topic]);

  const openEdit = useCallback((row: ReferenceRow) => {
    setFormError(null);
    setEditing({ id: row.id, status: statusOf(row), form: formFrom(row) });
  }, []);

  const save = useCallback(async () => {
    if (!editing) return;
    const parsed = toInput(editing.form);
    if (!parsed.ok) { setFormError(parsed.error); return; }
    setBusy(true);
    setFormError(null);
    try {
      if (editing.id) {
        await apiUpdateEntry(editing.id, parsed.body);
        toast.success("Entry saved", {
          description: editing.status === "published"
            ? "It is published, so members see the change now."
            : "It stays a draft until someone publishes it.",
        });
      } else {
        await apiCreateEntry(parsed.body);
        toast.success("Added as a draft", { description: "Members will see it once it is published." });
      }
      setEditing(null);
      await refreshAll();
    } catch (e) {
      setFormError(memberError(e));
    } finally {
      setBusy(false);
    }
  }, [editing, refreshAll, toast]);

  const approve = useCallback(async (row: ReferenceRow) => {
    const ok = await confirm({
      title: `Publish "${row.title}"?`,
      description: `Members ${row.city === "*" ? "everywhere" : `in ${row.city}`} will see it under ${topicLabel(row.topic)} straight away. Your name goes on the row as the person who checked it.`,
      confirmLabel: "Publish",
    });
    if (!ok) return;
    try {
      await apiApproveEntry(row.id);
      toast.success("Published", { description: `"${row.title}" is live.` });
      await refreshAll();
    } catch (e) {
      toast.error("Could not publish that entry", { description: memberError(e) });
    }
  }, [confirm, refreshAll, toast]);

  const unpublish = useCallback(async (row: ReferenceRow) => {
    const ok = await confirm({
      title: `Take "${row.title}" back to draft?`,
      description: "Members stop seeing it immediately. Anything they have already marked about it is kept.",
      confirmLabel: "Take back to draft",
    });
    if (!ok) return;
    try {
      await apiUnpublishEntry(row.id);
      toast.success("Back in drafts", { description: "It will need publishing again before members see it." });
      await refreshAll();
    } catch (e) {
      toast.error("Could not take that entry back", { description: memberError(e) });
    }
  }, [confirm, refreshAll, toast]);

  const archive = useCallback(async (row: ReferenceRow) => {
    const ok = await confirm({
      title: `Archive "${row.title}"?`,
      description: row.uptake > 0
        ? `${row.uptake} member${row.uptake === 1 ? " has" : "s have"} marked this entry, so it is kept rather than deleted. It leaves every member screen now and can be restored later.`
        : "It leaves every member screen now. Nothing is deleted, and it can be restored later.",
      confirmLabel: "Archive",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiArchiveEntry(row.id);
      toast.success("Archived", { description: `"${row.title}" is no longer shown.` });
      await refreshAll();
    } catch (e) {
      toast.error("Could not archive that entry", { description: memberError(e) });
    }
  }, [confirm, refreshAll, toast]);

  const unarchive = useCallback(async (row: ReferenceRow) => {
    try {
      await apiUnarchiveEntry(row.id);
      toast.success("Restored to drafts", { description: "Publish it again when it has been checked." });
      await refreshAll();
    } catch (e) {
      toast.error("Could not restore that entry", { description: memberError(e) });
    }
  }, [refreshAll, toast]);

  const showUptake = useCallback(async (row: ReferenceRow) => {
    setDetail({ row: null, loading: true });
    try {
      setDetail({ row: await apiCatalogueEntry(row.id), loading: false });
    } catch (e) {
      setDetail(null);
      toast.error("Could not load the uptake", { description: memberError(e) });
    }
  }, [toast]);

  const meta = data?.meta;
  const rows = data?.items ?? [];
  const from = meta && meta.total > 0 ? (meta.page - 1) * meta.page_size + 1 : 0;
  const to = meta ? Math.min(meta.page * meta.page_size, meta.total) : 0;

  return (
    <div className="wc-page-enter">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <BookOpen className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Resources catalogue</h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-subtle">
              Schemes, cover, health, rights, childcare, travel, helplines and guidance — what members are
              shown, and what has been checked before they see it.
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add an entry
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Published" value={summary ? String(summary.catalogue.published) : "—"}
                  icon={CheckCircle2} tone="emerald" deltaNote="Members can see these" />
        <StatCard label="Drafts" value={summary ? String(summary.catalogue.draft) : "—"}
                  icon={FileEdit} tone={summary && summary.catalogue.draft > 0 ? "amber" : "slate"}
                  deltaNote={summary && summary.catalogue.draft > 0 ? "Waiting to be published" : "Nothing waiting"} />
        <StatCard label="Archived" value={summary ? String(summary.catalogue.archived) : "—"}
                  icon={Archive} tone="slate" deltaNote="Kept, not shown" />
        <StatCard label="Marked by members" value={summary ? String(summary.catalogue.marks) : "—"}
                  icon={Users} tone="brand" deltaNote="Saved, applied, held or done — a count" />
      </div>

      <Card className="mt-6">
        <Tabs tabs={tabs} value={topic} onChange={(v) => { setTopic(v); setPage(1); }} className="mb-4" />

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[14rem] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              placeholder="Search title, body or who it is for…"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
            />
          </div>
          <input
            placeholder="City (or * for everywhere)"
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            className="w-44 rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
          />
          <Menu
            trigger={
              <span className="btn btn-sm btn-outline">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {STATUS_OPTIONS.find((o) => o.value === statusF)?.label}
              </span>
            }
          >
            {STATUS_OPTIONS.map((o) => (
              <MenuItem key={o.value || "all"} onClick={() => { setStatusF(o.value); setPage(1); }}>{o.label}</MenuItem>
            ))}
          </Menu>
          <Menu
            trigger={
              <span className="btn btn-sm btn-outline">
                {FREE_FILTERS.find((o) => o.value === free)?.label}
              </span>
            }
          >
            {FREE_FILTERS.map((o) => (
              <MenuItem key={o.value || "any"} onClick={() => { setFree(o.value); setPage(1); }}>{o.label}</MenuItem>
            ))}
          </Menu>
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : error ? (
          <ErrorState title="Could not load the catalogue" description={error} onRetry={() => void load()} />
        ) : rows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-brand-ink">
              <BookOpen className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink">
              {filtered ? "Nothing matches that" : topic ? `Nothing under ${topicLabel(topic)} yet` : "The catalogue is empty"}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-ink-subtle">
              {filtered
                ? "Try a different search, or clear a filter."
                : "Add an entry. It stays a draft until someone with approval publishes it."}
            </p>
          </div>
        ) : (
          <div className={`overflow-x-auto ${loading ? "opacity-60" : ""}`}>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                  <th className="px-3 py-2.5">Entry</th>
                  {!topic && <th className="px-3 py-2.5">Topic</th>}
                  <th className="px-3 py-2.5">Where</th>
                  <th className="px-3 py-2.5">Cost</th>
                  <th className="px-3 py-2.5">Rank</th>
                  <th className="px-3 py-2.5">State</th>
                  <th className="px-3 py-2.5 text-right">Marked by</th>
                  <th className="px-3 py-2.5 text-right">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const st = statusOf(row);
                  return (
                    <tr key={row.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                      <td className="max-w-md px-3 py-3">
                        <p className="truncate text-sm font-semibold text-ink">{row.title}</p>
                        <p className="truncate text-xs text-ink-subtle">{row.who || row.body || "No description yet"}</p>
                      </td>
                      {!topic && (
                        <td className="px-3 py-3"><Badge tone="slate">{topicLabel(row.topic)}</Badge></td>
                      )}
                      <td className="px-3 py-3 text-sm text-ink-muted">{row.city === "*" ? "Everywhere" : row.city}</td>
                      <td className="px-3 py-3">
                        {row.free === true ? (
                          <Badge tone="emerald">Free</Badge>
                        ) : row.free === false ? (
                          <span className="text-sm text-ink-muted">{row.cost_label || "Costs something"}</span>
                        ) : (
                          <span className="text-xs text-ink-subtle">Not stated</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm text-ink-subtle">{row.rank}</td>
                      <td className="px-3 py-3">
                        <span title={st === "published" && row.reviewed_by ? `Published by ${row.reviewed_by}${row.reviewed_at ? ` on ${when(row.reviewed_at)}` : ""}` : undefined}>
                          <Badge tone={STATUS_TONE[st]}>{STATUS_LABEL[st]}</Badge>
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right text-sm text-ink-muted">
                        {row.uptake > 0 ? (
                          <button className="underline-offset-2 hover:underline" onClick={() => void showUptake(row)}>
                            {row.uptake}
                          </button>
                        ) : (
                          <span className="text-ink-subtle">0</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}>
                          <MenuItem icon={FileEdit} onClick={() => openEdit(row)}>Edit</MenuItem>
                          {st === "draft" && (
                            <MenuItem icon={CheckCircle2} onClick={() => void approve(row)}>Publish</MenuItem>
                          )}
                          {st === "published" && (
                            <MenuItem icon={Undo2} onClick={() => void unpublish(row)}>Take back to draft</MenuItem>
                          )}
                          <MenuItem icon={Users} onClick={() => void showUptake(row)}>Uptake by state</MenuItem>
                          {st === "archived" ? (
                            <MenuItem icon={ArchiveRestore} onClick={() => void unarchive(row)}>Restore to drafts</MenuItem>
                          ) : (
                            <MenuItem icon={Archive} danger onClick={() => void archive(row)}>Archive</MenuItem>
                          )}
                        </Menu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.pages > 1 && (
          <Pagination
            className="mt-4"
            page={meta.page}
            pageCount={meta.pages}
            onPageChange={setPage}
            showing={`Showing ${from}–${to} of ${meta.total}`}
          />
        )}
      </Card>

      {/* ── create / edit ─────────────────────────────────────────────── */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Edit the entry" : "Add an entry"}
        description={editing?.id
          ? (editing.status === "published" ? "This entry is published — a saved change reaches members immediately." : "Saved changes stay in the draft until it is published.")
          : "It is added as a draft. Someone with approval publishes it before members see it."}
        size="lg"
      >
        {editing && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Topic"
                value={editing.form.topic}
                options={TOPICS.map((t) => ({ value: t, label: TOPIC_LABEL[t] }))}
                onChange={(e) => setEditing({ ...editing, form: { ...editing.form, topic: e.target.value } })}
              />
              <Input
                label="City"
                hint="* means everywhere in India"
                value={editing.form.city}
                onChange={(e) => setEditing({ ...editing, form: { ...editing.form, city: e.target.value } })}
                placeholder="*"
              />
            </div>
            <Input
              label="Title"
              required
              value={editing.form.title}
              onChange={(e) => setEditing({ ...editing, form: { ...editing.form, title: e.target.value } })}
              placeholder="Pradhan Mantri Mudra Yojana"
            />
            <Input
              label="Who it is for"
              value={editing.form.who}
              onChange={(e) => setEditing({ ...editing, form: { ...editing.form, who: e.target.value } })}
              placeholder="Any woman running or starting a small business"
            />
            <Textarea
              label="What it is, in plain words"
              rows={3}
              value={editing.form.body}
              onChange={(e) => setEditing({ ...editing, form: { ...editing.form, body: e.target.value } })}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <Select
                label="Cost"
                value={editing.form.free}
                options={FREE_OPTIONS}
                onChange={(e) => setEditing({ ...editing, form: { ...editing.form, free: e.target.value as FreeChoice } })}
              />
              <Input
                label="Cost, in words"
                value={editing.form.cost_label}
                onChange={(e) => setEditing({ ...editing, form: { ...editing.form, cost_label: e.target.value } })}
                placeholder="No fee to apply"
              />
              <Input
                label="Rank"
                type="number"
                min={0}
                hint="Lower shows first"
                value={editing.form.rank}
                onChange={(e) => setEditing({ ...editing, form: { ...editing.form, rank: e.target.value } })}
              />
            </div>
            <Textarea
              label="Details the member screen reads (JSON)"
              rows={6}
              hint={payloadHint(editing.form.topic) ? `Keys this topic uses: ${payloadHint(editing.form.topic)}` : undefined}
              value={editing.form.payloadText}
              onChange={(e) => setEditing({ ...editing, form: { ...editing.form, payloadText: e.target.value } })}
              className="font-mono text-xs"
            />
            {formError && (
              <p className="rounded-lg bg-status-danger-bg px-3 py-2 text-xs text-status-danger-ink">{formError}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn btn-outline" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={busy} onClick={() => void save()}>
                {busy ? "Saving…" : editing.id ? "Save changes" : "Add as a draft"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── uptake ────────────────────────────────────────────────────── */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.row ? detail.row.title : "Uptake"}
        description="How many members have marked this entry, by what they said they did. Who they are is not recorded here."
        size="sm"
      >
        {detail?.loading ? (
          <div className="flex items-center justify-center py-8"><Spinner /></div>
        ) : detail?.row ? (
          detail.row.uptake === 0 ? (
            <p className="py-4 text-center text-sm text-ink-subtle">Nobody has marked this entry yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {Object.entries(detail.row.uptake_by_state).map(([state, n]) => (
                <li key={state} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-ink-muted">{STATE_LABEL[state] ?? state}</span>
                  <span className="font-semibold text-ink">{n}</span>
                </li>
              ))}
              <li className="flex items-center justify-between py-2.5 text-sm">
                <span className="font-semibold text-ink">All together</span>
                <span className="font-semibold text-ink">{detail.row.uptake}</span>
              </li>
            </ul>
          )
        ) : null}
      </Modal>
    </div>
  );
}
