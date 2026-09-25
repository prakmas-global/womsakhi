"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bot, Send, UserCheck, ShieldAlert, MessageSquare, HandCoins, MessageSquareHeart, FileText, BookOpen, CalendarX,
  CalendarCheck, Smile, GraduationCap, Users, ArrowRight, CheckCircle2, Circle, Plus, Trash2, Download, RotateCcw,
  Loader2, Info, Clock, UserPlus, Pencil,
} from "lucide-react";

import { Badge, Card, Input, Modal, Select, Textarea, useConfirm, useToast } from "@/design-system";
import RadialGauge from "@/components/charts/RadialGauge";
import { TONE_BG } from "@/lib/tones";
import {
  apiCommandOverview, apiStaffTasks, apiStaffTaskStats, apiCreateStaffTask, apiUpdateStaffTask, apiDeleteStaffTask,
  apiCommandActivity, apiAsk, apiCommandReport,
  type Overview, type StaffTask, type TaskStats, type ActivityRow, type TaskPriority,
} from "@/lib/ai-api";
import { memberError } from "@/lib/member-api";
import { ResizableColumns } from "@/layout-engine";

/**
 * Command Center — what needs doing, how the platform is doing, and a box
 * that answers questions from the data.
 *
 * ── What is real on this screen ──────────────────────────────────────────────
 * No AI model runs here, and the screen says so at the top. The waiting
 * queues are the same queries their screens run; each health indicator says
 * what it measures and shows the figures behind it; insights compare this
 * week with last only where there is data; the tasks are a real staff to-do
 * list, assigned and audited; the question box answers a fixed set of
 * questions from live counts and says when it cannot.
 *
 * The old "AI Command Center" had four seeded agents ("WhatsApp Agent:
 * 2,451 messages sent"), a health gauge over five seeded scores, insights
 * about Texas and Los Angeles, a timeline of things no AI did, a memory
 * panel counting documents indexed by nothing, and a chat that replied with
 * one canned paragraph whatever you typed.
 */

const ICON_MAP: Record<string, React.ElementType> = {
  UserCheck, ShieldAlert, MessageSquare, HandCoins, MessageSquareHeart, FileText, BookOpen, CalendarX, CalendarCheck, Smile,
  GraduationCap, Users,
};
const iconFor = (name: string): React.ElementType => ICON_MAP[name] ?? Bot;

const PRIORITY_TONE: Record<TaskPriority, "rose" | "amber" | "slate"> = { high: "rose", medium: "amber", low: "slate" };

function when(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
function prettyDate(d: string): string {
  if (!d) return "";
  const dt = new Date(`${d}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

type Exchange = { id: number; question: string; answer?: string; href?: string; understood?: boolean };
type TaskForm = { title: string; notes: string; priority: TaskPriority; due: string; assignMe: boolean };
const EMPTY_TASK: TaskForm = { title: "", notes: "", priority: "medium", due: "", assignMe: true };

export default function CommandCenterPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [tasks, setTasks] = useState<StaffTask[] | null>(null);
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null);
  const [activity, setActivity] = useState<ActivityRow[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [show, setShow] = useState<"open" | "done" | "all">("open");
  const [mine, setMine] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [exporting, setExporting] = useState(false);

  const [taskOpen, setTaskOpen] = useState(false);
  const [editing, setEditing] = useState<StaffTask | null>(null);
  const [form, setForm] = useState<TaskForm>(EMPTY_TASK);
  const [saving, setSaving] = useState(false);

  const [draft, setDraft] = useState("");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [asking, setAsking] = useState(false);
  const idRef = useRef(0);
  const askRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const [ov, act] = await Promise.allSettled([apiCommandOverview(), apiCommandActivity(10)]);
      if (!live) return;
      if (ov.status === "fulfilled") { setOverview(ov.value); setLoadError(""); } else setLoadError(memberError(ov.reason));
      if (act.status === "fulfilled") setActivity(act.value);
    })();
    return () => { live = false; };
  }, [reloadKey]);

  useEffect(() => {
    let live = true;
    (async () => {
      const [t, s] = await Promise.allSettled([apiStaffTasks(show, mine), apiStaffTaskStats()]);
      if (!live) return;
      if (t.status === "fulfilled") setTasks(t.value);
      if (s.status === "fulfilled") setTaskStats(s.value);
    })();
    return () => { live = false; };
  }, [show, mine, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // ---- tasks ----
  const openAdd = () => { setEditing(null); setForm(EMPTY_TASK); setTaskOpen(true); };
  const openEdit = (t: StaffTask) => { setEditing(t); setForm({ title: t.title, notes: t.notes, priority: t.priority, due: t.due, assignMe: !!t.assignee_id }); setTaskOpen(true); };
  const submitTask = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await apiUpdateStaffTask(editing.id, { title: form.title.trim(), notes: form.notes, priority: form.priority, due: form.due, assignee_id: form.assignMe ? (editing.assignee_id || "me") : "" });
        toast.success("Task updated");
      } else {
        await apiCreateStaffTask({ title: form.title.trim(), notes: form.notes, priority: form.priority, due: form.due, assignee_id: form.assignMe ? "me" : "" });
        toast.success("Task added", { description: form.assignMe ? "Assigned to you." : "Unassigned." });
      }
      setTaskOpen(false);
      reload();
    } catch (err) {
      toast.error("Could not save the task", { description: memberError(err) });
    } finally {
      setSaving(false);
    }
  };
  const toggleDone = async (t: StaffTask) => {
    try {
      const updated = await apiUpdateStaffTask(t.id, { done: !t.done });
      setTasks((ts) => (ts ?? []).map((x) => (x.id === t.id ? updated : x)));
      toast.success(updated.done ? "Done" : "Reopened");
      apiStaffTaskStats().then(setTaskStats).catch(() => undefined);
    } catch (err) {
      toast.error("Could not update the task", { description: memberError(err) });
    }
  };
  const takeTask = async (t: StaffTask) => {
    try {
      const updated = await apiUpdateStaffTask(t.id, { assignee_id: "me" });
      setTasks((ts) => (ts ?? []).map((x) => (x.id === t.id ? updated : x)));
      toast.success("It is yours now");
    } catch (err) {
      toast.error("Could not assign it", { description: memberError(err) });
    }
  };
  const removeTask = async (t: StaffTask) => {
    const ok = await confirm({ title: `Delete “${t.title}”?`, description: "Only this task goes.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try {
      await apiDeleteStaffTask(t.id);
      toast.success("Task deleted");
      reload();
    } catch (err) {
      toast.error("Could not delete it", { description: memberError(err) });
    }
  };

  // ---- ask ----
  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || asking) return;
    const id = (idRef.current += 1);
    setExchanges((x) => [...x, { id, question: q }]);
    setDraft("");
    setAsking(true);
    try {
      const res = await apiAsk(q);
      setExchanges((x) => x.map((e) => (e.id === id ? { ...e, answer: res.answer, href: res.href, understood: res.understood } : e)));
    } catch (err) {
      setExchanges((x) => x.map((e) => (e.id === id ? { ...e, answer: `Could not answer: ${memberError(err)}`, understood: false } : e)));
    } finally {
      setAsking(false);
    }
  };
  const canAnswer = ["What needs attention?", "How many new members this week?", "Who is waiting for a reply?", "How many bookings this week?", "How is feedback looking?", "When was the last backup?", "How many programmes are running?", "How many members do we have?"];

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await apiCommandReport();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "command-center.csv";
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      toast.success("Overview exported", { description: "Recorded in the activity log." });
    } catch (err) {
      toast.error("Could not export", { description: memberError(err) });
    } finally {
      setExporting(false);
    }
  };

  const health = overview?.health ?? null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink"><Bot className="h-6 w-6" /></span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Command Center</h1>
            <p className="mt-1 text-sm text-ink-subtle">What is waiting, how the platform is doing, and your team&apos;s tasks.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-sm btn-outline" onClick={reload}><RotateCcw className="h-3.5 w-3.5" /> Refresh</button>
          <button className="btn btn-sm btn-outline" disabled={exporting || !overview} onClick={() => void exportCsv()}><Download className="h-3.5 w-3.5" /> {exporting ? "Exporting…" : "Export CSV"}</button>
          <button className="btn btn-sm btn-primary" onClick={openAdd}><Plus className="h-4 w-4" /> Add task</button>
        </div>
      </div>

      <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-line bg-surface-2 px-4 py-3 text-xs leading-relaxed text-ink-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" />
        <span>{overview?.note ?? "No AI model runs behind this screen. Every figure is counted from the platform's own records when you open it."}</span>
      </div>

      {loadError && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-status-danger-edge bg-status-danger-bg px-4 py-3 text-sm text-status-danger-ink">
          <span>Could not load the overview: {loadError}</span>
          <button className="btn btn-sm btn-outline" onClick={reload}>Try again</button>
        </div>
      )}

      {/* waiting */}
      <Card className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-ink">Waiting on the team</h2>
            <p className="text-xs text-ink-subtle">The same queues their screens show, counted now.</p>
          </div>
          {overview && <span className="text-xs text-ink-subtle">as of {when(overview.generated_at)}</span>}
        </div>
        {overview === null ? (
          <p className="flex items-center gap-2 py-4 text-xs text-ink-subtle"><Loader2 className="h-4 w-4 animate-spin" /> Counting…</p>
        ) : overview.priorities.length === 0 ? (
          <p className="rounded-lg bg-status-ok-bg px-3 py-2.5 text-sm text-status-ok-ink">Every queue is empty. Nothing is waiting.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {overview.priorities.map((p) => {
              const Icon = iconFor(p.icon);
              return (
                <Link key={p.key} href={p.href} className="flex items-center gap-3 rounded-xl border border-line p-3 transition hover:bg-surface-hover">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${TONE_BG[p.tone] ?? TONE_BG.brand}`}><Icon className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-xl font-bold text-ink">{p.count.toLocaleString("en-IN")}</span>
                    <span className="block truncate text-xs text-ink-subtle">{p.text.replace(/^[\d,]+\s/, "")}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-ink-subtle" />
                </Link>
              );
            })}
          </div>
        )}
      </Card>

      <ResizableColumns id="command-center" defaultSize={0.62} className="gap-6">
        <div className="space-y-6">
          {/* health */}
          <Card>
            <div className="mb-3">
              <h2 className="font-display text-base font-semibold text-ink">Platform health</h2>
              <p className="text-xs text-ink-subtle">Each indicator says what it measures. The gauge is their average.</p>
            </div>
            {health === null ? (
              <p className="text-xs text-ink-subtle">Loading…</p>
            ) : (
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="flex shrink-0 flex-col items-center gap-1">
                  <RadialGauge value={health.overall ?? 0} color={health.color} size={140} />
                  <p className="text-sm font-semibold text-ink">{health.rating}</p>
                  <p className="text-2xs text-ink-subtle">{health.measured} of {health.indicators.length} measured</p>
                </div>
                <ul className="min-w-0 flex-1 space-y-2.5">
                  {health.indicators.map((i) => {
                    const Icon = iconFor(i.icon);
                    return (
                      <li key={i.key} className="flex items-start gap-3">
                        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONE_BG[i.tone] ?? TONE_BG.brand}`}><Icon className="h-4 w-4" /></span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-ink">{i.label}</p>
                            <p className="font-display text-base font-bold tabular-nums text-ink">{i.value === null ? "—" : `${i.value}%`}</p>
                          </div>
                          <p className="text-xs text-ink-subtle">{i.measures}. <span className="text-ink-muted">{i.detail}</span></p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </Card>

          {/* insights */}
          <Card>
            <div className="mb-3">
              <h2 className="font-display text-base font-semibold text-ink">This week against last</h2>
              <p className="text-xs text-ink-subtle">Only where there is something to compare.</p>
            </div>
            {overview === null ? (
              <p className="text-xs text-ink-subtle">Loading…</p>
            ) : overview.insights.length === 0 ? (
              <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-xs text-ink-subtle">Nothing happened in the last two weeks to compare.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {overview.insights.map((i) => {
                  const Icon = iconFor(i.icon);
                  return (
                    <Link key={i.key} href={i.href} className="flex items-start gap-3 rounded-xl border border-line p-3 transition hover:bg-surface-hover">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONE_BG[i.tone] ?? TONE_BG.brand}`}><Icon className="h-4.5 w-4.5" /></span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-ink">{i.title}</span>
                        <span className="block text-xs text-ink-subtle">{i.description}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>

          {/* tasks */}
          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-semibold text-ink">Team tasks</h2>
                <p className="text-xs text-ink-subtle">
                  {taskStats ? `${taskStats.open} open · ${taskStats.overdue} overdue · ${taskStats.mine} yours · ${taskStats.done} done` : "Loading…"}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex rounded-lg border border-line-strong p-0.5 text-xs">
                  {(["open", "done", "all"] as const).map((s) => (
                    <button key={s} onClick={() => setShow(s)} className={show === s ? "rounded-md bg-brand-600 px-2.5 py-1 font-semibold text-white" : "px-2.5 py-1 text-ink-subtle hover:text-ink-muted"}>{s[0].toUpperCase() + s.slice(1)}</button>
                  ))}
                </div>
                <button onClick={() => setMine((m) => !m)} className={`btn btn-sm ${mine ? "btn-primary" : "btn-outline"}`}>Mine</button>
                <button className="btn btn-sm btn-outline" onClick={openAdd}><Plus className="h-3.5 w-3.5" /> Add</button>
              </div>
            </div>
            {tasks === null ? (
              <p className="text-xs text-ink-subtle">Loading…</p>
            ) : tasks.length === 0 ? (
              <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-xs text-ink-subtle">{show === "done" ? "Nothing finished yet." : mine ? "Nothing assigned to you." : "No tasks. Add one for the team."}</p>
            ) : (
              <ul className="divide-y divide-line">
                {tasks.map((t) => (
                  <li key={t.id} className="flex items-start gap-3 py-2.5">
                    <button aria-label={t.done ? "Reopen" : "Mark done"} onClick={() => void toggleDone(t)} className={`mt-0.5 shrink-0 ${t.done ? "text-status-ok-ink" : "text-ink-subtle hover:text-ink"}`}>
                      {t.done ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${t.done ? "text-ink-subtle line-through" : "text-ink"}`}>{t.title}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-subtle">
                        <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge>
                        {t.due && <span className={`flex items-center gap-1 ${t.overdue ? "font-semibold text-status-danger-ink" : ""}`}><Clock className="h-3 w-3" /> {t.overdue ? "Overdue · " : ""}{prettyDate(t.due)}</span>}
                        <span>{t.assignee_name ? t.assignee_name : <button className="text-brand-ink hover:underline" onClick={() => void takeTask(t)}><UserPlus className="mr-0.5 inline h-3 w-3" />Take it</button>}</span>
                        {t.href && <Link href={t.href} className="text-brand-ink hover:underline">Open</Link>}
                      </p>
                      {t.notes && <p className="mt-1 text-xs text-ink-muted">{t.notes}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button aria-label="Edit task" className="text-ink-subtle hover:text-ink" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></button>
                      <button aria-label="Delete task" className="text-ink-subtle hover:text-status-danger-ink" onClick={() => void removeTask(t)}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {/* ask */}
          <Card>
            <div className="mb-3">
              <h2 className="font-display text-base font-semibold text-ink">Ask the data</h2>
              <p className="text-xs text-ink-subtle">A fixed set of questions, answered from live counts. Not a chatbot.</p>
            </div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {canAnswer.map((q) => (
                <button key={q} onClick={() => void ask(q)} disabled={asking} className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-muted transition hover:border-line-strong hover:text-ink">{q}</button>
              ))}
            </div>
            {exchanges.length > 0 && (
              <ul className="mb-3 max-h-[40vh] space-y-2 overflow-y-auto">
                {exchanges.map((e) => (
                  <li key={e.id} className="space-y-1.5">
                    <p className="ml-6 rounded-xl rounded-tr-sm bg-brand-tint px-3 py-2 text-sm text-brand-ink">{e.question}</p>
                    <div className={`mr-6 rounded-xl rounded-tl-sm px-3 py-2 text-sm ${e.understood === false ? "bg-status-warn-bg text-status-warn-ink" : "bg-surface-2 text-ink"}`}>
                      {e.answer === undefined ? <span className="flex items-center gap-2 text-ink-subtle"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Counting…</span> : e.answer}
                      {e.href && e.answer !== undefined && <Link href={e.href} className="ml-2 text-xs font-semibold text-brand-ink hover:underline">Open →</Link>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={askRef}
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(draft); } }}
                placeholder="Type one of the questions above, or close to it"
                className="min-h-[44px] flex-1 resize-none rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
              />
              <button className="btn btn-primary" disabled={asking || !draft.trim()} onClick={() => void ask(draft)} aria-label="Ask"><Send className="h-4 w-4" /></button>
            </div>
          </Card>

          {/* activity */}
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-ink">Latest actions</h2>
              <Link href="/dashboard/settings/activity" className="text-xs font-semibold text-brand-ink hover:underline">Full log</Link>
            </div>
            {activity === null ? (
              <p className="text-xs text-ink-subtle">Loading…</p>
            ) : activity.length === 0 ? (
              <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-xs text-ink-subtle">Nothing recorded yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {activity.map((a) => (
                  <li key={a.id} className="text-xs">
                    <p className="text-sm text-ink-muted">{a.detail || a.action}</p>
                    <p className="text-ink-subtle">{a.who} · {when(a.at)}{a.category ? ` · ${a.category}` : ""}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </ResizableColumns>

      {/* task modal */}
      <Modal
        open={taskOpen}
        onClose={() => setTaskOpen(false)}
        title={editing ? "Edit task" : "Add a task"}
        description="A to-do for the team. Members never see it."
        icon={CheckCircle2}
        iconTone="brand"
        size="md"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setTaskOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={saving || !form.title.trim()} onClick={() => void submitTask()}>{saving ? "Saving…" : editing ? "Save" : "Add task"}</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Input label="Title" required className="col-span-2" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Call the venue about Saturday" />
          <Select label="Priority" options={["high", "medium", "low"]} value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))} />
          <Input label="Due" type="date" value={form.due} onChange={(e) => setForm((f) => ({ ...f, due: e.target.value }))} />
          <Textarea label="Notes" className="col-span-2" rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
          <label className="col-span-2 flex items-center gap-2 text-sm text-ink-muted">
            <input type="checkbox" className="rounded border-line-strong accent-brand-600" checked={form.assignMe} onChange={(e) => setForm((f) => ({ ...f, assignMe: e.target.checked }))} />
            {editing ? "Keep it assigned (untick to leave it for anyone)" : "Assign it to me"}
          </label>
        </div>
      </Modal>
    </div>
  );
}
