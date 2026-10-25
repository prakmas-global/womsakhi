"use client";

import { useCallback, useState } from "react";

import * as Icons from "@/components/ux/icons";
import { Btn, Card, EmptyState, SectionHead } from "@/components/ux/kit";
import { Tag } from "@/components/ux/learning/native";
import {
  apiAnswerQuestion, apiAskQuestion, apiCourseQA, apiDeleteAnswer, apiDeleteQuestion, apiVerifyAnswer,
  type CourseQA as QA, type QAQuestion,
} from "@/lib/course-qa-api";
import { useAction } from "@/lib/use-action";
import { useResource } from "@/lib/use-resource";

/**
 * A course's questions and answers.
 *
 * Anyone taking the course, and its teacher, can ask and answer. The teacher
 * can mark any answer correct — a green check everyone sees — and her own
 * answers carry a "Teacher" badge. On a lesson page it shows that lesson's
 * questions, and a new question is about that lesson.
 */

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

function Avatar({ name, teacher }: { name: string; teacher?: boolean }) {
  return (
    <span className="grid h-[32px] w-[32px] shrink-0 place-items-center rounded-full text-2xs font-bold"
          style={teacher ? { background: "var(--ux-brand)", color: "var(--ux-on-brand)" } : { background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>
      {initials(name) || "?"}
    </span>
  );
}

function Box({ value, onChange, placeholder, rows = 3, label }: {
  value: string; onChange: (s: string) => void; placeholder: string; rows?: number; label: string;
}) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} aria-label={label}
              className="ux-sq w-full resize-y rounded-[12px] border p-3 text-xsm leading-relaxed outline-none"
              style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" }} />
  );
}

function Question({ q, programId, isTeacher, onChanged }: {
  q: QAQuestion; programId: string; isTeacher: boolean; onChanged: () => void;
}) {
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState("");
  const act = useAction(async (what: string, answerId?: string) => {
    if (what === "answer") await apiAnswerQuestion(programId, q.id, reply.trim());
    if (what === "verify" && answerId) await apiVerifyAnswer(programId, q.id, answerId);
    if (what === "del-answer" && answerId) await apiDeleteAnswer(programId, q.id, answerId);
    if (what === "del-question") await apiDeleteQuestion(programId, q.id);
  }, {
    onDone: () => { setReply(""); setReplying(false); onChanged(); },
    fallbackError: "That did not go through. Try again in a moment.",
  });

  return (
    <li className="border-t py-4 first:border-t-0 first:pt-0" style={{ borderColor: "var(--ux-line)" }}>
      <div className="flex items-start gap-3">
        <Avatar name={q.author} teacher={q.by_teacher} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-xsm font-semibold" style={{ color: "var(--ux-ink)" }}>{q.author}</span>
            {q.by_teacher && <Tag tone="brand" size="sm">Teacher</Tag>}
            {q.lesson && <Tag tone="neutral" size="sm">Lesson {q.lesson}{q.lesson_title ? ` · ${q.lesson_title}` : ""}</Tag>}
            {q.resolved
              ? <Tag tone="green" size="sm">Answered</Tag>
              : q.answers.length === 0 && <Tag tone="orange" size="sm">Waiting for an answer</Tag>}
            <span className="text-2xs" style={{ color: "var(--ux-faint)" }}>{q.when}</span>
          </div>
          <p className="mt-1 whitespace-pre-line text-smd leading-relaxed lg:text-sm" style={{ color: "var(--ux-ink)" }}>{q.body}</p>

          {q.answers.length > 0 && (
            <ul className="mt-3 space-y-2.5">
              {q.answers.map((a) => (
                <li key={a.id} className="rounded-[12px] border p-3"
                    style={a.verified
                      ? { borderColor: "var(--ux-green-ink)", background: "var(--ux-tint-green)" }
                      : { borderColor: "var(--ux-line)", background: "var(--ux-surface-2)" }}>
                  <div className="flex items-start gap-2.5">
                    <Avatar name={a.author} teacher={a.by_teacher} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-xs font-semibold" style={{ color: "var(--ux-ink)" }}>{a.author}</span>
                        {a.by_teacher && <Tag tone="brand" size="sm">Teacher</Tag>}
                        {a.verified && (
                          <span className="inline-flex items-center gap-1 text-2xs font-bold" style={{ color: "var(--ux-green-ink)" }}>
                            <Icons.CheckCircle2 className="h-4 w-4" /> Verified by the teacher
                          </span>
                        )}
                        <span className="text-2xs" style={{ color: "var(--ux-faint)" }}>{a.when}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-line text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{a.body}</p>
                      {(isTeacher || a.mine) && (
                        <div className="mt-2 flex flex-wrap gap-3">
                          {isTeacher && !a.by_teacher && (
                            <button type="button" onClick={() => void act.run("verify", a.id)}
                                    className="inline-flex items-center gap-1 text-xs font-semibold"
                                    style={{ color: a.verified ? "var(--ux-muted)" : "var(--ux-green-ink)" }}>
                              <Icons.CheckCircle2 className="h-3.5 w-3.5" /> {a.verified ? "Remove the check" : "Mark as correct"}
                            </button>
                          )}
                          <button type="button" onClick={() => void act.run("del-answer", a.id)}
                                  className="text-xs" style={{ color: "var(--ux-faint)" }}>Remove</button>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {replying ? (
            <div className="mt-3 space-y-2">
              <Box value={reply} onChange={setReply} placeholder="Share what you know — be kind and specific." label="Your answer" />
              <div className="flex gap-2">
                <Btn variant="primary" size="sm" icon="Send" loading={act.busy} disabled={reply.trim().length < 2}
                     onClick={() => void act.run("answer")}>Post answer</Btn>
                <Btn variant="ghost" size="sm" onClick={() => setReplying(false)}>Cancel</Btn>
              </div>
            </div>
          ) : (
            <div className="mt-2.5 flex flex-wrap gap-3">
              <button type="button" onClick={() => setReplying(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--ux-brand)" }}>
                <Icons.MessageSquare className="h-3.5 w-3.5" /> Answer
              </button>
              {(isTeacher || q.mine) && (
                <button type="button" onClick={() => void act.run("del-question")} className="text-xs" style={{ color: "var(--ux-faint)" }}>
                  Remove question
                </button>
              )}
            </div>
          )}
          {act.error && <p role="alert" className="mt-2 text-xs" style={{ color: "var(--ux-danger-ink)" }}>{act.error}</p>}
        </div>
      </div>
    </li>
  );
}

export function CourseQA({ programId, lesson, lessonCount = 0 }: {
  programId: string;
  /** On a lesson page: only that lesson's questions, and new ones are about it. */
  lesson?: number;
  lessonCount?: number;
}) {
  const { data, source, refetch } = useResource(
    useCallback((s: AbortSignal) => apiCourseQA(programId, s, lesson).catch(() => null), [programId, lesson]),
    null as QA | null,
  );
  const [body, setBody] = useState("");
  const [about, setAbout] = useState<number | "">(lesson ?? "");
  const [filter, setFilter] = useState<"all" | "open">("all");
  const ask = useAction(async () => { await apiAskQuestion(programId, body.trim(), about || null); }, {
    onDone: () => { setBody(""); refetch(); },
    fallbackError: "Your question did not post. Try again in a moment.",
  });

  if (!data) return source === "loading" ? null : null;
  const shown = filter === "open" ? data.questions.filter((q) => !q.resolved) : data.questions;

  return (
    <Card className="mt-[16px]" id="questions">
      <SectionHead
        title={lesson ? "Questions on this lesson" : "Questions and answers"}
        sub={data.is_teacher
          ? `${data.unanswered} waiting for an answer · mark the right answers with a green check`
          : `Ask anything — ${data.teacher_name} and other learners answer`}
        icon="MessageSquare"
      />

      <div className="mb-4 rounded-[14px] border p-3" style={{ borderColor: "var(--ux-line)" }}>
        <Box value={body} onChange={setBody} rows={2} label="Your question"
             placeholder={lesson ? "Stuck on something in this lesson? Ask here." : "What would you like to ask?"} />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          {!lesson && lessonCount > 0 ? (
            <select value={String(about)} onChange={(e) => setAbout(e.target.value ? Number(e.target.value) : "")}
                    aria-label="Which lesson" className="ux-sq min-h-[36px] rounded-[10px] border px-2 text-xs outline-none"
                    style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface)", color: "var(--ux-ink-2)" }}>
              <option value="">About the whole course</option>
              {Array.from({ length: lessonCount }, (_, i) => <option key={i} value={i + 1}>About lesson {i + 1}</option>)}
            </select>
          ) : <span />}
          <Btn variant="primary" size="sm" icon="Send" loading={ask.busy} disabled={body.trim().length < 5}
               onClick={() => void ask.run()}>Ask</Btn>
        </div>
        {ask.error && <p role="alert" className="mt-2 text-xs" style={{ color: "var(--ux-danger-ink)" }}>{ask.error}</p>}
      </div>

      {data.questions.length > 0 && (
        <div className="mb-3 flex gap-2">
          {(["all", "open"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f}
                    className="rounded-full border px-3 py-1 text-xs"
                    style={filter === f ? { borderColor: "var(--ux-brand)", color: "var(--ux-brand)", background: "var(--ux-brand-tint)" }
                      : { borderColor: "var(--ux-line-strong)", color: "var(--ux-muted)" }}>
              {f === "all" ? `All (${data.questions.length})` : `Not yet answered (${data.questions.filter((q) => !q.resolved).length})`}
            </button>
          ))}
        </div>
      )}

      {shown.length ? (
        <ul>{shown.map((q) => <Question key={q.id} q={q} programId={programId} isTeacher={data.is_teacher} onChanged={refetch} />)}</ul>
      ) : (
        <EmptyState icon="MessageSquare" title={data.questions.length ? "Everything here is answered" : "No questions yet"}
                    body={data.questions.length ? "Nice — every question has a verified or teacher's answer." : "Be the first to ask. Someone who took this course will help."} />
      )}
    </Card>
  );
}
