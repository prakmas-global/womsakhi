"use client";

import { useState } from "react";
import * as Icons from "@/components/ux/icons";

import {
  Btn, Card, IconTile, Progress, SectionHead,
  SourceNote
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { ScreenHead } from "@/components/ux/learning/native";
import { Tag } from "@/components/ux/learning/native";
import { MORE_ART as RAW_MORE_ART } from "@/components/ux/more/data";
import { useAssessmentList } from "@/components/ux/entitlements";
import { apiAssessment, apiSubmitAttempt, type Assessment } from "@/lib/entitlements-api";
import { messageFrom } from "@/lib/use-action";
import { useT } from "@/i18n";
import { useTranslated } from "@/i18n/data";

/**
 * Skill Assessment — proof of what she can already do.
 *
 * Most members learned their trade from a mother or an aunt, not a course, and
 * have nothing on paper for twenty years of work. A test she can take in twenty
 * minutes turns that into something an employer will accept.
 *
 * Only her BEST result counts, and it says so before she starts. A test that
 * can lower a score is a test nobody with something to lose will take.
 *
 * **"Take the test" used to spin "Starting…" for ever.** It set a local id and
 * there was nothing on the other side of it — no questions, no submission, no
 * result. A woman who pressed it watched a spinner until she gave up, and the
 * badge she came for did not exist. The questions are on `/assess/{id}` and the
 * answers go to `/assess/{id}/attempt`, which returns the score the server
 * marked.
 */
export default function AssessPage() {
  const MORE_ART = useTranslated(RAW_MORE_ART);
  const tr = useT();
  const { data: ASSESSMENTS, source, refetch } = useAssessmentList();

  /** The test she is in, once the questions have arrived. */
  const [paper, setPaper] = useState<Assessment | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [problem, setProblem] = useState("");
  /** Her chosen option per question, by index. -1 until she picks. */
  const [answers, setAnswers] = useState<number[]>([]);
  const [at, setAt] = useState(0);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ score: number; passed: boolean } | null>(null);

  const done = ASSESSMENTS.filter((a) => a.taken);
  const badges = ASSESSMENTS.filter((a) => a.badge).length;

  async function start(id: string) {
    setOpening(id);
    setProblem("");
    try {
      const got = await apiAssessment(id);
      // A test with no questions cannot be started, and saying so beats
      // opening an empty paper she cannot submit.
      if (!got.questions?.length) {
        setProblem("This test has no questions on it yet. Try another one, or come back later.");
        return;
      }
      setPaper(got);
      setAnswers(new Array(got.questions.length).fill(-1));
      setAt(0);
      setResult(null);
    } catch (e) {
      setProblem(messageFrom(e, "We could not open that test. Try again in a moment."));
    } finally {
      setOpening(null);
    }
  }

  function leave() {
    setPaper(null); setAnswers([]); setAt(0); setResult(null); setProblem("");
  }

  async function submit() {
    if (!paper || sending) return;
    setSending(true);
    setProblem("");
    try {
      const got = await apiSubmitAttempt(paper.id, answers);
      setResult({ score: got.score, passed: got.passed });
      // The list behind carries her best score and her badge, both of which
      // this attempt may have just changed.
      refetch();
    } catch (e) {
      setProblem(messageFrom(e, "Your answers did not reach us. Nothing has been marked — try again."));
    } finally {
      setSending(false);
    }
  }

  /* ── Taking one ─────────────────────────────────────────────────────── */

  if (paper) {
    const q = paper.questions[at];
    const answered = answers.filter((a) => a >= 0).length;
    const last = at === paper.questions.length - 1;

    return (
      <HomeShell>
        <button onClick={leave}
                className="ux-hov -my-1 mb-3.5 inline-flex items-center gap-1.5 py-1 text-xsm font-medium"
                style={{ color: "var(--ux-brand)" }}>
          <Icons.ArrowLeft className="ux-ico h-4 w-4" />{tr("assess.allTests")}</button>

        <h1 className="ux-screen-title text-2xl font-bold" style={{ color: "var(--ux-ink)" }}>{paper.title}</h1>
        <p className="mb-6 mt-2 text-xsm lg:mb-[20px] lg:mt-1.5" style={{ color: "var(--ux-muted)" }}>
          {paper.skill} · {paper.question_count} questions · pass mark {paper.pass_mark}%
        </p>

        {result ? (
          <Card className="ux-slide-up mx-auto max-w-[560px]">
            <div className="flex flex-col items-center py-4 text-center">
              <span className="grid h-[68px] w-[68px] place-items-center rounded-full"
                    style={{ background: result.passed ? "var(--ux-tint-green)" : "var(--ux-tint-amber)" }}>
                {result.passed
                  ? <Icons.BadgeCheck className="h-[32px] w-[32px]" style={{ color: "var(--ux-green-ink)" }} strokeWidth={2} />
                  : <Icons.RotateCcw className="h-[30px] w-[30px]" style={{ color: "var(--ux-amber-ink)" }} strokeWidth={2} />}
              </span>
              <h2 className="mt-4 text-2xl font-bold tabular-nums" style={{ color: "var(--ux-ink)" }}>
                {result.score}%
              </h2>
              <p className="mt-2 max-w-[40ch] text-sm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
                {result.passed
                  ? `Passed. It is on your profile as a ${paper.skill} badge, and employers hiring through WomSakhi can filter by it.`
                  : `The pass mark is ${paper.pass_mark}%. Nothing is lost — only your best result ever counts, so try again whenever you like.`}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                <Btn onClick={leave} variant="primary" iconEnd="ArrowRight">{tr("assess.backToTheTests")}</Btn>
                {!result.passed && (
                  <Btn variant="outline" icon="RotateCcw"
                       onClick={() => { setResult(null); setAnswers(new Array(paper.questions.length).fill(-1)); setAt(0); }}>{tr("assess.takeItAgain")}</Btn>
                )}
              </div>
            </div>
          </Card>
        ) : (
          <Card className="mx-auto max-w-[640px]">
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span style={{ color: "var(--ux-muted)" }}>Question {at + 1} of {paper.questions.length}</span>
                <span className="tabular-nums" style={{ color: "var(--ux-faint)" }}>{answered} answered</span>
              </div>
              <Progress pct={((at + 1) / paper.questions.length) * 100} track="--ux-track" />
            </div>

            <h2 className="text-base font-semibold leading-snug" style={{ color: "var(--ux-ink)" }}>
              {q.ask}
            </h2>

            <ul className="mt-3.5 space-y-2.5" role="radiogroup" aria-label={q.ask}>
              {q.options.map((opt, i) => {
                const on = answers[at] === i;
                return (
                  <li key={opt}>
                    <button
                      role="radio"
                      aria-checked={on}
                      onClick={() => setAnswers((p) => p.map((v, n) => (n === at ? i : v)))}
                      className="ux-press ux-sq flex w-full items-center gap-3 rounded-[12px] border p-4 text-start lg:p-3.5"
                      style={{
                        borderColor: on ? "var(--ux-brand)" : "var(--ux-line-strong)",
                        background: on ? "var(--ux-brand-tint)" : "var(--ux-surface)",
                      }}
                    >
                      <span className="ux-sq grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-2"
                            style={{ borderColor: on ? "var(--ux-brand)" : "var(--ux-line-strong)",
                                     background: on ? "var(--ux-brand)" : "transparent" }}>
                        {on && <Icons.Check className="h-3 w-3 text-white" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1 text-sm leading-snug"
                            style={{ color: on ? "var(--ux-brand)" : "var(--ux-ink)" }}>
                        {opt}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {problem && (
              <p role="alert" className="ux-slide-up mt-4 rounded-[12px] p-4 text-xsm leading-relaxed lg:mt-3.5 lg:p-3"
                 style={{ background: "var(--ux-tint-orange)", color: "var(--ux-orange-ink)" }}>
                {problem}
              </p>
            )}

            <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4"
                 style={{ borderColor: "var(--ux-line)" }}>
              <Btn variant="ghost" icon="ArrowLeft" disabled={at === 0} onClick={() => setAt((n) => n - 1)}>
                Back
              </Btn>
              {last ? (
                <Btn variant="primary" iconEnd={sending ? undefined : "Check"} icon={sending ? "Loader" : undefined}
                     disabled={answers.some((a) => a < 0) || sending}
                     onClick={() => void submit()}>
                  {sending ? "Marking…" : "Finish and see your score"}
                </Btn>
              ) : (
                <Btn variant="primary" iconEnd="ArrowRight" disabled={answers[at] < 0}
                     onClick={() => setAt((n) => n + 1)}>
                  Next
                </Btn>
              )}
            </div>
            <p className="mt-2.5 text-xs leading-relaxed" style={{ color: "var(--ux-faint)" }}>
              Nothing is marked until you press the last button. You can leave and start again — only your
              best result ever counts.
            </p>
          </Card>
        )}
      </HomeShell>
    );
  }

  /* ── Choosing one ───────────────────────────────────────────────────── */

  return (
    <HomeShell
      rail={
        <div className="space-y-[16px]">
          <Card>
            <SectionHead title={tr("assess.howThisWorks")} icon="Info" />
            <ol className="space-y-3">
              {[
                "Twenty minutes, on your phone, whenever suits.",
                "Only your best result ever counts — a second try cannot hurt you.",
                "Score above the pass mark and it appears on your profile as a badge.",
                "Employers hiring through WomSakhi filter by these.",
              ].map((t, i) => (
                <li key={t} className="flex items-start gap-2.5">
                  <span className="grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full text-2xs font-bold"
                        style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>{i + 1}</span>
                  <span className="text-xsm leading-snug" style={{ color: "var(--ux-ink-2)" }}>{t}</span>
                </li>
              ))}
            </ol>
          </Card>

          <div className="ux-clay relative overflow-hidden p-[20px]"
               style={{ background: "linear-gradient(140deg, var(--ux-tint-orange), var(--ux-tint-lilac))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" src={MORE_ART.assess} alt=""
                 className="ux-float pointer-events-none absolute -bottom-3 -end-4 h-[100px] w-[100px] object-contain" />
            <h2 className="relative w-[60%] text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("assess.twentyYearsIsWorthProving")}</h2>
            <p className="relative mt-2 w-[60%] text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>{tr("assess.mostMembersLearnedTheirTradeAt")}</p>
          </div>
        </div>
      }
    >
      <ScreenHead
        title={tr("assess.testYourSkills")}
        sub={`${done.length} of ${ASSESSMENTS.length} taken · ${badges} badge${badges === 1 ? "" : "s"} on your profile. Only your best result ever counts.`}
        note={<SourceNote source={source} what="tests" />}
      />

      {/* A test that would not open says so here, where she pressed. */}
      {problem && (
        <p role="alert" className="ux-slide-up mb-4 rounded-[12px] p-4 text-xsm leading-relaxed lg:mb-[16px] lg:p-3.5"
           style={{ background: "var(--ux-tint-orange)", color: "var(--ux-orange-ink)" }}>
          {problem}
        </p>
      )}

      <div className="ux-deck ux-stagger space-y-[12px]">
        {ASSESSMENTS.map((a, i) => (
          <Card key={a.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
            <div className="flex items-start gap-3.5">
              <IconTile icon={a.icon} tint={a.tint} ink={a.ink} size={48} radius={13} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <h2 className="min-w-0 flex-1 text-base font-semibold" style={{ color: "var(--ux-ink)" }}>
                    {a.skill}
                  </h2>
                  {a.badge && <Tag tone="green" size="sm">{tr("assess.onYourProfile")}</Tag>}
                  {a.level && !a.badge && <Tag tone="neutral" size="sm">{a.level}</Tag>}
                </div>

                {a.taken ? (
                  <>
                    <div className="mt-2.5 flex items-center gap-3">
                      <Progress pct={a.pct} track="--ux-track"
                                tone={a.pct >= 70 ? "--ux-green" : "--ux-amber"} />
                      <span className="shrink-0 text-xsm font-bold tabular-nums" style={{ color: "var(--ux-ink)" }}>
                        {a.pct}%
                      </span>
                    </div>
                    <p className="mt-1.5 text-[13px] lg:text-xs" style={{ color: "var(--ux-muted)" }}>
                      Taken {a.taken} · {a.level}
                    </p>
                  </>
                ) : (
                  <p className="mt-1.5 text-xsm" style={{ color: "var(--ux-ink-2)" }}>{a.note}</p>
                )}

                <p className="mt-2 flex flex-wrap items-center gap-x-3 text-[13px] lg:text-xs" style={{ color: "var(--ux-faint)" }}>
                  <span className="inline-flex items-center gap-1"><Icons.Clock className="h-3.5 w-3.5" /> {a.mins} min</span>
                  <span>{a.questions} questions</span>
                </p>
              </div>
            </div>

            {/* Stacked on a phone with the action full width at the foot of the
                card, where a thumb reaches; the row it always was from `lg`. */}
            <div className="mt-4 flex flex-col gap-3 border-t pt-4 lg:mt-3.5 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:pt-3.5"
                 style={{ borderColor: "var(--ux-line)" }}>
              {/* Said before she starts, not buried in terms. */}
              <span className="text-[13px] lg:text-xs" style={{ color: "var(--ux-faint)" }}>
                {a.taken ? tr("assess.aSecondTryCanOnlyImprove")
              : tr("assess.youCanStopAndComeBack")}
              </span>
              <Btn className="ux-action-primary" variant={a.taken ? "outline" : "primary"} size="sm"
                   icon={opening === a.id ? "Loader" : undefined}
                   iconEnd={opening === a.id ? undefined : "ArrowRight"}
                   disabled={!!opening}
                   onClick={() => void start(a.id)}>
                {opening === a.id ? "Opening…" : a.taken ? tr("assess.tryAgain")
              : tr("assess.takeTheTest")}
              </Btn>
            </div>
          </Card>
        ))}
      </div>
    </HomeShell>
  );
}
