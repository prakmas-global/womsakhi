"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDown, ArrowUp, CheckCircle2, ListOrdered, Pencil, Plus, Smartphone, Trash2, Users,
} from "lucide-react";
import {
  Card, ErrorState, Input, Modal, ProgressBar, Spinner, StatCard, Textarea, useConfirm, useToast,
} from "@/design-system";
import { useAuth } from "@/context/AuthContext";
import { memberError } from "@/lib/member-api";
import {
  apiCreateStep, apiDeleteStep, apiLearningPermissions, apiReorderSteps, apiSteps, apiUpdateStep,
  type LearningAction, type StepInput, type StepRow, type StepsOut,
} from "@/lib/learning-admin-api";

/**
 * Getting confident with a phone — the ordered steps, and how far members get.
 *
 * The funnel is counted from `digital_progress` at request time: each bar is
 * the share of members who started the course and have finished that step.
 * A step somebody has finished can be renamed but not removed — her progress
 * needs a step to point at — and the server refuses with the count.
 */

const BLANK: StepInput = { label: "", note: "", minutes: 10 };

export default function DigitalStepsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const isSuper = user?.role === "Super Admin";

  const [data, setData] = useState<StepsOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [perms, setPerms] = useState<Set<LearningAction>>(new Set());
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<StepRow | null>(null);
  const [form, setForm] = useState<StepInput>(BLANK);
  const [busy, setBusy] = useState(false);

  const can = useCallback((a: LearningAction) => perms.has(a), [perms]);

  useEffect(() => {
    let alive = true;
    apiLearningPermissions(isSuper).then((p) => { if (alive) setPerms(p); }).catch(() => {});
    return () => { alive = false; };
  }, [isSuper]);

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await apiSteps());
    } catch (e) {
      setError(memberError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const openCreate = useCallback(() => { setForm(BLANK); setCreating(true); }, []);
  const openEdit = useCallback((s: StepRow) => {
    setForm({ label: s.label, note: s.note, minutes: s.minutes });
    setEditing(s);
  }, []);

  const save = useCallback(async () => {
    if (!form.label.trim()) { toast.error("Give the step a name"); return; }
    setBusy(true);
    try {
      const body = { label: form.label.trim(), note: form.note.trim(), minutes: form.minutes };
      setData(editing ? await apiUpdateStep(editing.id, body) : await apiCreateStep(body));
      setCreating(false);
      setEditing(null);
      toast.success(editing ? "Step saved" : "Step added at the end");
    } catch (e) {
      toast.error("Could not save the step", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [editing, form, toast]);

  const remove = useCallback(async (s: StepRow) => {
    const ok = await confirm({
      title: `Remove "${s.label}"?`,
      description: s.done_count > 0
        ? `${s.done_count} member${s.done_count === 1 ? " has" : "s have"} finished it, so the server will refuse. Rename it instead.`
        : "Nobody has finished it. The steps after it move up one place.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    try {
      setData(await apiDeleteStep(s.id));
      toast.success("Step removed");
    } catch (e) {
      toast.error("Not removed", { description: memberError(e) });
    }
  }, [confirm, toast]);

  const move = useCallback(async (i: number, dir: -1 | 1) => {
    if (!data) return;
    const ids = data.items.map((s) => s.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    try {
      setData(await apiReorderSteps(ids));
    } catch (e) {
      toast.error("Could not reorder", { description: memberError(e) });
    }
  }, [data, toast]);

  const steps = data?.items ?? [];
  const started = data?.members_started ?? 0;
  const finishedAll = steps.length > 0 ? Math.min(...steps.map((s) => s.done_count)) : 0;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <Smartphone className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Phone-confidence steps</h1>
            <p className="mt-1 text-sm text-ink-subtle">
              The short course a member works through in order. Each one builds on the last, so the order matters.
            </p>
          </div>
        </div>
        {can("create") && (
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add a step
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Steps" value={data ? String(steps.length) : "—"} icon={ListOrdered} tone="brand"
                  deltaNote={steps.length > 0 ? `${steps.reduce((n, s) => n + s.minutes, 0)} minutes in all` : "In order"} />
        <StatCard label="Members started" value={data ? String(started) : "—"} icon={Users} tone="violet"
                  deltaNote="Finished at least one step" />
        <StatCard label="Step completions" value={data ? String(data.completions) : "—"} icon={CheckCircle2} tone="emerald"
                  deltaNote="Every step, every member" />
        <StatCard label="Finished every step" value={data ? String(finishedAll) : "—"} icon={Smartphone} tone="amber"
                  deltaNote={started > 0 ? `${Math.round((finishedAll * 100) / started)}% of those who started` : "Nobody has started yet"} />
      </div>

      <Card className="mt-6">
        <div className="mb-4">
          <h2 className="font-display text-base font-semibold text-ink">The steps, in order</h2>
          <p className="text-xs text-ink-subtle">
            Each bar is the share of members who started the course and have finished that step.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : error ? (
          <ErrorState title="Could not load the steps" description={error} onRetry={() => { setLoading(true); void load(); }} />
        ) : steps.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-brand-ink">
              <Smartphone className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink">No steps yet</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-ink-subtle">
              Add the first one. Members see them in the order you set here.
            </p>
          </div>
        ) : (
          <ol className="space-y-3">
            {steps.map((s, i) => {
              const pct = started > 0 ? Math.round((s.done_count * 100) / started) : 0;
              return (
                <li key={s.id} className="rounded-xl border border-line bg-surface p-4">
                  <div className="flex items-start gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-tint font-display text-sm font-bold text-brand-ink">
                      {s.n}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <p className="text-sm font-semibold text-ink">{s.label}</p>
                        <span className="text-xs text-ink-subtle">{s.minutes} min</span>
                      </div>
                      {s.note && <p className="mt-0.5 text-xs text-ink-muted">{s.note}</p>}
                      <div className="mt-3 flex items-center gap-3">
                        <ProgressBar value={pct} className="max-w-xs" label={`${s.done_count} of ${started} finished`} />
                        <span className="shrink-0 text-xs text-ink-subtle">
                          {started > 0 ? `${s.done_count} of ${started} · ${pct}%` : "No one yet"}
                        </span>
                      </div>
                    </div>
                    {(can("edit") || can("delete")) && (
                      <div className="flex shrink-0 items-center gap-1">
                        {can("edit") && (
                          <>
                            <button className="btn btn-sm btn-ghost" title="Move up" disabled={i === 0}
                                    onClick={() => void move(i, -1)}><ArrowUp className="h-4 w-4" /></button>
                            <button className="btn btn-sm btn-ghost" title="Move down" disabled={i === steps.length - 1}
                                    onClick={() => void move(i, 1)}><ArrowDown className="h-4 w-4" /></button>
                            <button className="btn btn-sm btn-ghost" title="Edit" onClick={() => openEdit(s)}>
                              <Pencil className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {can("delete") && (
                          <button className="btn btn-sm btn-ghost" title="Remove" onClick={() => void remove(s)}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }}
             title={editing ? `Edit step ${editing.n}` : "Add a step"}
             description={editing ? undefined : "It goes at the end. Move it with the arrows afterwards."}>
        <div className="space-y-4">
          <Input label="Name" required value={form.label}
                 onChange={(e) => setForm({ ...form, label: e.target.value })}
                 placeholder="Getting paid by UPI" />
          <Textarea label="One line about it" rows={2} value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    placeholder="Your own QR code, and checking the money actually arrived." />
          <Input label="Minutes" type="number" min={1} max={240} value={String(form.minutes)}
                 onChange={(e) => setForm({ ...form, minutes: Math.max(1, Number(e.target.value) || 1) })} />
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn btn-outline" onClick={() => { setCreating(false); setEditing(null); }}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => void save()}>
              {busy ? "Saving…" : editing ? "Save" : "Add"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
