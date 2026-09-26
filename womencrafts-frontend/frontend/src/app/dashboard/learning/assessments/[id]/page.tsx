"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowDown, ArrowLeft, ArrowUp, Ban, Check, ClipboardCheck, Download, FileQuestion,
  MoreHorizontal, Pencil, Plus, Target, Trash2, Trophy, Users,
} from "lucide-react";
import {
  Avatar, Badge, Card, ErrorState, Input, Menu, MenuItem, Modal, Pagination, Select,
  Spinner, StatCard, Tabs, Textarea, useConfirm, useToast,
} from "@/design-system";
import { useAuth } from "@/context/AuthContext";
import { memberError } from "@/lib/member-api";
import {
  STATUS_LABEL, STATUS_TONE,
  apiAddQuestion, apiAssessment, apiAttempts, apiAttemptsCsv, apiEditQuestion,
  apiInvalidateAttempt, apiLearningPermissions, apiRemoveQuestion, apiReorderQuestions,
  apiUpdateAssessment, fmtDateTime, saveCsv,
  type AssessmentRow, type AssessmentStatus, type AttemptRow, type LearningAction,
  type Page, type QuestionInput,
} from "@/lib/learning-admin-api";

/**
 * One test: its questions, and who has taken it.
 *
 * The question shape here is exactly what the member endpoint grades against
 * (`ask`, `options[]`, `answer` index). The correct answer is shown to staff
 * and stripped for the phone. Striking an attempt out keeps the row — the
 * reason and who did it are on it — but it stops counting toward her best.
 */

const PAGE_SIZE = 15;

const BLANK_Q: QuestionInput = { ask: "", options: ["", ""], answer: 0 };

export default function AssessmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const isSuper = user?.role === "Super Admin";

  const [test, setTest] = useState<AssessmentRow | null>(null);
  const [attempts, setAttempts] = useState<Page<AttemptRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [perms, setPerms] = useState<Set<LearningAction>>(new Set());
  const [tab, setTab] = useState("questions");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);

  /** null = closed; -1 = adding; n ≥ 0 = editing question n. */
  const [qIndex, setQIndex] = useState<number | null>(null);
  const [qForm, setQForm] = useState<QuestionInput>(BLANK_Q);
  const [striking, setStriking] = useState<AttemptRow | null>(null);
  const [reason, setReason] = useState("");

  const can = useCallback((a: LearningAction) => perms.has(a), [perms]);

  useEffect(() => {
    let alive = true;
    apiLearningPermissions(isSuper).then((p) => { if (alive) setPerms(p); }).catch(() => {});
    return () => { alive = false; };
  }, [isSuper]);

  const loadTest = useCallback(async () => {
    setError("");
    try {
      setTest(await apiAssessment(id));
    } catch (e) {
      setError(memberError(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadAttempts = useCallback(async () => {
    try {
      setAttempts(await apiAttempts(id, { page, page_size: PAGE_SIZE }));
    } catch (e) {
      toast.error("Could not load the attempts", { description: memberError(e) });
    }
  }, [id, page, toast]);

  useEffect(() => {
    const timer = setTimeout(() => void loadTest(), 0);
    return () => clearTimeout(timer);
  }, [loadTest]);
  useEffect(() => {
    const timer = setTimeout(() => void loadAttempts(), 0);
    return () => clearTimeout(timer);
  }, [loadAttempts]);

  /* ── status ─────────────────────────────────────────────────────────── */

  const setStatus = useCallback(async (status: AssessmentStatus) => {
    if (!test) return;
    try {
      setTest(await apiUpdateAssessment(test.id, {
        skill: test.skill, title: test.title, blurb: test.blurb, minutes: test.minutes,
        pass_mark: test.pass_mark, status,
      }));
      toast.success(status === "published" ? "Published — it is on the phone now" : "Taken off the phone");
    } catch (e) {
      toast.error("Could not change that", { description: memberError(e) });
    }
  }, [test, toast]);

  /* ── questions ──────────────────────────────────────────────────────── */

  const openAdd = useCallback(() => { setQForm(BLANK_Q); setQIndex(-1); }, []);

  const openEdit = useCallback((i: number) => {
    if (!test) return;
    const q = test.questions[i];
    if (!q) return;
    setQForm({ ask: q.ask, options: [...q.options], answer: q.answer });
    setQIndex(i);
  }, [test]);

  const saveQuestion = useCallback(async () => {
    if (!test || qIndex === null) return;
    const options = qForm.options.map((o) => o.trim());
    if (!qForm.ask.trim()) { toast.error("Write the question"); return; }
    if (options.length < 2 || options.some((o) => !o)) { toast.error("Give at least two options, none blank"); return; }
    if (qForm.answer < 0 || qForm.answer >= options.length) { toast.error("Pick which option is correct"); return; }
    setBusy(true);
    try {
      const body = { ask: qForm.ask.trim(), options, answer: qForm.answer };
      setTest(qIndex === -1 ? await apiAddQuestion(test.id, body) : await apiEditQuestion(test.id, qIndex, body));
      setQIndex(null);
      toast.success(qIndex === -1 ? "Question added" : "Question saved");
    } catch (e) {
      toast.error("Could not save the question", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [qForm, qIndex, test, toast]);

  const removeQuestion = useCallback(async (i: number) => {
    if (!test) return;
    const ok = await confirm({
      title: `Remove question ${i + 1}?`,
      description: test.attempt_count > 0
        ? `${test.attempt_count} attempt${test.attempt_count === 1 ? "" : "s"} were marked against the current questions. Their scores stay as they are.`
        : "It is gone for good.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    try {
      setTest(await apiRemoveQuestion(test.id, i));
      toast.success("Question removed");
    } catch (e) {
      toast.error("Could not remove it", { description: memberError(e) });
    }
  }, [confirm, test, toast]);

  const move = useCallback(async (i: number, dir: -1 | 1) => {
    if (!test) return;
    const order = test.questions.map((_, k) => k);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    try {
      setTest(await apiReorderQuestions(test.id, order));
    } catch (e) {
      toast.error("Could not reorder", { description: memberError(e) });
    }
  }, [test, toast]);

  /* ── attempts ───────────────────────────────────────────────────────── */

  const strike = useCallback(async () => {
    if (!test || !striking) return;
    if (!reason.trim()) { toast.error("Say why this attempt should not count"); return; }
    setBusy(true);
    try {
      await apiInvalidateAttempt(test.id, striking.id, reason.trim());
      setStriking(null);
      setReason("");
      toast.success("Struck out", { description: "It no longer counts toward her best score." });
      await Promise.all([loadAttempts(), loadTest()]);
    } catch (e) {
      toast.error("Could not strike it out", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [loadAttempts, loadTest, reason, striking, test, toast]);

  const exportCsv = useCallback(async () => {
    if (!test) return;
    try {
      saveCsv(await apiAttemptsCsv(test.id), `womsakhi-${test.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-attempts.csv`);
      toast.success("CSV downloaded");
    } catch (e) {
      toast.error("Could not export", { description: memberError(e) });
    }
  }, [test, toast]);

  /* ── render ─────────────────────────────────────────────────────────── */

  if (loading) return <div className="flex items-center justify-center py-24"><Spinner /></div>;
  if (error || !test) {
    return (
      <div>
        <Link href="/dashboard/learning/assessments" className="btn btn-sm btn-ghost mb-4">
          <ArrowLeft className="h-4 w-4" /> All tests
        </Link>
        <Card><ErrorState title="Could not open this test" description={error || "It may have been deleted."}
                          onRetry={() => { setLoading(true); void loadTest(); }} /></Card>
      </div>
    );
  }

  const questions = test.questions;
  const rows = attempts?.items ?? [];

  return (
    <div>
      <Link href="/dashboard/learning/assessments" className="btn btn-sm btn-ghost mb-4">
        <ArrowLeft className="h-4 w-4" /> All tests
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <ClipboardCheck className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight text-ink">{test.title}</h1>
              <Badge tone={STATUS_TONE[test.status] ?? "slate"}>{STATUS_LABEL[test.status] ?? test.status}</Badge>
            </div>
            <p className="mt-1 text-sm text-ink-subtle">
              {test.skill}{test.minutes ? ` · ${test.minutes} minutes` : ""}{test.blurb ? ` · ${test.blurb}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {can("export") && (
            <button className="btn btn-outline" onClick={() => void exportCsv()}>
              <Download className="h-4 w-4" /> Attempts CSV
            </button>
          )}
          {can("edit") && test.status !== "published" && (
            <button className="btn btn-primary" onClick={() => void setStatus("published")}
                    disabled={questions.length === 0}
                    title={questions.length === 0 ? "Add a question first" : undefined}>
              Publish
            </button>
          )}
          {can("edit") && test.status === "published" && (
            <button className="btn btn-outline" onClick={() => void setStatus("draft")}>Take off the phone</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Questions" value={String(questions.length)} icon={FileQuestion} tone="brand"
                  deltaNote="What she answers" />
        <StatCard label="Pass mark" value={`${test.pass_mark}%`} icon={Target} tone="violet"
                  deltaNote="Score needed to pass" />
        <StatCard label="Attempts" value={String(test.attempt_count)} icon={Users} tone="emerald"
                  deltaNote="Struck-out ones excluded" />
        <StatCard label="Pass rate" value={test.pass_rate === null ? "—" : `${test.pass_rate}%`} icon={Trophy} tone="amber"
                  deltaNote={test.pass_rate === null ? "Nobody has tried yet" : `${test.pass_count} passed`} />
      </div>

      <Card className="mt-6">
        <Tabs
          className="mb-4"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "questions", label: "Questions", count: questions.length },
            { value: "attempts", label: "Attempts", count: attempts?.total },
          ]}
        />

        {tab === "questions" && (
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-ink-subtle">
                The phone shows them in this order. The tick marks the correct option; the phone never sees it.
              </p>
              {can("edit") && (
                <button className="btn btn-sm btn-primary" onClick={openAdd}>
                  <Plus className="h-3.5 w-3.5" /> Add a question
                </button>
              )}
            </div>

            {questions.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-brand-ink">
                  <FileQuestion className="h-6 w-6" />
                </span>
                <p className="mt-3 text-sm font-semibold text-ink">No questions yet</p>
                <p className="mx-auto mt-1 max-w-sm text-xs text-ink-subtle">
                  A test with no questions cannot be published. Add the first one.
                </p>
              </div>
            ) : (
              <ol className="space-y-3">
                {questions.map((q, i) => (
                  <li key={`${i}-${q.ask}`} className="rounded-xl border border-line bg-surface p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">Question {i + 1}</p>
                        <p className="mt-1 text-sm font-semibold text-ink">{q.ask}</p>
                        <ul className="mt-2 space-y-1">
                          {q.options.map((o, k) => (
                            <li key={k} className={`flex items-center gap-2 text-sm ${k === q.answer ? "font-semibold text-status-success-ink" : "text-ink-muted"}`}>
                              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-2xs ${k === q.answer ? "bg-status-success-bg" : "bg-surface-2 text-ink-subtle"}`}>
                                {k === q.answer ? <Check className="h-3 w-3" /> : String.fromCharCode(65 + k)}
                              </span>
                              {o}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {can("edit") && (
                        <div className="flex shrink-0 items-center gap-1">
                          <button className="btn btn-sm btn-ghost" title="Move up" disabled={i === 0}
                                  onClick={() => void move(i, -1)}><ArrowUp className="h-4 w-4" /></button>
                          <button className="btn btn-sm btn-ghost" title="Move down" disabled={i === questions.length - 1}
                                  onClick={() => void move(i, 1)}><ArrowDown className="h-4 w-4" /></button>
                          <button className="btn btn-sm btn-ghost" title="Edit" onClick={() => openEdit(i)}>
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button className="btn btn-sm btn-ghost" title="Remove" onClick={() => void removeQuestion(i)}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {tab === "attempts" && (
          <div>
            {!attempts ? (
              <div className="flex items-center justify-center py-16"><Spinner /></div>
            ) : rows.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-brand-ink">
                  <Users className="h-6 w-6" />
                </span>
                <p className="mt-3 text-sm font-semibold text-ink">Nobody has taken this test yet</p>
                <p className="mx-auto mt-1 max-w-sm text-xs text-ink-subtle">
                  {test.status === "published" ? "Attempts appear here the moment a member submits one."
                    : "Publish it and members can take it from the Learn screen."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                      <th className="px-3 py-2.5">Member</th>
                      <th className="px-3 py-2.5">Score</th>
                      <th className="px-3 py-2.5">Result</th>
                      <th className="px-3 py-2.5">Taken</th>
                      <th className="px-3 py-2.5 text-right">&nbsp;</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((a) => (
                      <tr key={a.id} className={`border-b border-line last:border-0 hover:bg-surface-2 ${a.invalidated ? "opacity-60" : ""}`}>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={a.name} src={a.avatar || null} size="sm" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-ink">{a.name}</p>
                              {a.member_id && <p className="truncate font-mono text-2xs text-ink-subtle">{a.member_id}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm font-semibold text-ink">{a.score}%</td>
                        <td className="px-3 py-3">
                          {a.invalidated ? (
                            <span title={`${a.invalidated_reason} — ${a.invalidated_by}, ${fmtDateTime(a.invalidated_at)}`}>
                              <Badge tone="slate">Struck out</Badge>
                            </span>
                          ) : (
                            <Badge tone={a.passed ? "emerald" : "rose"}>{a.passed ? "Passed" : "Not passed"}</Badge>
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm text-ink-subtle">{fmtDateTime(a.at)}</td>
                        <td className="px-3 py-3 text-right">
                          {can("edit") && !a.invalidated && (
                            <Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}>
                              <MenuItem icon={Ban} danger onClick={() => { setReason(""); setStriking(a); }}>
                                Strike this attempt out
                              </MenuItem>
                            </Menu>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {attempts && attempts.pages > 1 && (
              <Pagination
                page={attempts.page}
                pageCount={attempts.pages}
                onPageChange={setPage}
                showing={`Showing ${(attempts.page - 1) * attempts.page_size + 1} to ${Math.min(attempts.page * attempts.page_size, attempts.total)} of ${attempts.total} attempts`}
              />
            )}
          </div>
        )}
      </Card>

      {/* ── question editor ─────────────────────────────────────────────── */}
      <Modal open={qIndex !== null} onClose={() => setQIndex(null)}
             title={qIndex === -1 ? "Add a question" : `Edit question ${(qIndex ?? 0) + 1}`}>
        <div className="space-y-4">
          <Textarea label="The question" required rows={2} value={qForm.ask}
                    onChange={(e) => setQForm({ ...qForm, ask: e.target.value })}
                    placeholder="A customer's bust measures 36 inches. How much ease do you add for a fitted blouse?" />
          <div>
            <p className="mb-1.5 text-xs font-semibold text-ink">Options</p>
            <div className="space-y-2">
              {qForm.options.map((o, k) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-ink-subtle">
                    {String.fromCharCode(65 + k)}
                  </span>
                  <Input className="flex-1" value={o} placeholder={`Option ${k + 1}`}
                         onChange={(e) => {
                           const options = [...qForm.options];
                           options[k] = e.target.value;
                           setQForm({ ...qForm, options });
                         }} />
                  <button className="btn btn-sm btn-ghost" title="Remove option" disabled={qForm.options.length <= 2}
                          onClick={() => {
                            const options = qForm.options.filter((_, i) => i !== k);
                            const answer = qForm.answer >= options.length ? 0 : qForm.answer > k ? qForm.answer - 1 : qForm.answer === k ? 0 : qForm.answer;
                            setQForm({ ...qForm, options, answer });
                          }}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            {qForm.options.length < 8 && (
              <button className="btn btn-sm btn-outline mt-2"
                      onClick={() => setQForm({ ...qForm, options: [...qForm.options, ""] })}>
                <Plus className="h-3.5 w-3.5" /> Another option
              </button>
            )}
          </div>
          <Select
            label="Correct answer"
            value={String(qForm.answer)}
            options={qForm.options.map((o, k) => ({ value: String(k), label: `${String.fromCharCode(65 + k)} — ${o.trim() || `Option ${k + 1}`}` }))}
            onChange={(e) => setQForm({ ...qForm, answer: Number(e.target.value) })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn btn-outline" onClick={() => setQIndex(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => void saveQuestion()}>
              {busy ? "Saving…" : qIndex === -1 ? "Add" : "Save"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── strike an attempt out ───────────────────────────────────────── */}
      <Modal open={!!striking} onClose={() => setStriking(null)} title="Strike this attempt out" size="sm">
        {striking && (
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">
              <b className="text-ink">{striking.name}</b> scored {striking.score}% on {fmtDateTime(striking.at)}. The row
              stays, with your reason on it, but it stops counting toward her best score and this test&apos;s pass rate.
            </p>
            <Textarea label="Why" required rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
                      placeholder="Submitted twice by a network retry" />
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn btn-outline" onClick={() => setStriking(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={busy} onClick={() => void strike()}>
                {busy ? "Saving…" : "Strike it out"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
