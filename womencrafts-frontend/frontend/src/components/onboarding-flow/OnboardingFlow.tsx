"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, RotateCcw, X } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useStepHistory } from "@/components/auth-shell/useStepHistory";
import { authSans, authSerif } from "@/components/auth-shell/fonts";
import { useToast } from "@/design-system/feedback/ToastProvider";
import { authError } from "@/lib/auth-api";
import {
  apiOnboarding, apiPreparedItems, apiSaveAnswers, apiSetConsents, apiSkipOnboarding, markOnboardingSettled,
  type Answers, type Goal, type OnboardingState, type PreparedItem, type Purpose, type Skill,
} from "@/lib/onboarding-api";
import { ONBOARDING_FLOW_PREVIEWS, readPreview } from "@/lib/auth-preview";
import { Art } from "./art";
import { Busy, HelperChip, ListenButton, SECTIONS, SectionProgress, StepFooter, type SectionIndex } from "./primitives";
import {
  GoalsStep, LanguageStep, LearnStep, MeetStep, PhoneStep, SAY_ID, SkillsStep, TimeStep, WelcomeStep, type ConsentDraft,
} from "./steps";
import { CircleSheet, HandBack, ReviewScreen, SettingUpScreen, ThanksScreen } from "./screens";
import { useDialogFocus } from "./useDialogFocus";
import { SKILL_GOALS } from "./vocab";
import "./tokens.css";
import "./onboarding.css";

/**
 * The local preview switch (see lib/auth-preview), written out here rather
 * than imported: the build replaces NODE_ENV in this file, so every branch it
 * guards is stripped from production. An imported constant is not.
 */
const AUTH_PREVIEW = process.env.NODE_ENV !== "production";

/**
 * The Post-Auth Flow (approved spec, sections 3–6): Sakhi's few questions,
 * then — once she is approved — her drafts and suggestions, made from her
 * real answers, for her to keep, change or remove.
 *
 *   You          Q0 welcome + consent · Q1 how to talk to her
 *   Your goals   Q2 what brings her · Q3 skills · Q4 learn / meet (≤ 2 follow-ups)
 *   Your plan    Q5 her time · Q6 shared phone
 *   then         waiting → "Thank you" · approved → Setting up → Review
 *
 * Every answer is saved as she goes (PUT per step), so a refresh resumes on
 * the first question she has not answered. Phones get full-screen steps;
 * tablets a centred card; computers a modal over a blurred home.
 */

type Step = "welcome" | "language" | "goals" | "skills" | "learn" | "meet" | "time" | "phone" | "thanks" | "setup" | "review";

const SECTION_OF: Partial<Record<Step, SectionIndex>> = {
  welcome: 0, language: 0, goals: 1, skills: 1, learn: 1, meet: 1, time: 2, phone: 2,
};

/** Before these, a helper hands the phone back: consent, the shared-phone question, her prepared things. */
const PRIVATE: Step[] = ["welcome", "phone", "setup"];

const PREVIEW_STEP: Record<(typeof ONBOARDING_FLOW_PREVIEWS)[number], Step> = {
  welcome: "welcome", language: "language", goals: "goals", skills: "skills", learn: "learn", meet: "meet",
  time: "time", phone: "phone", "thanks-waiting": "thanks", "setting-up": "setup", review: "review",
  "circle-sheet": "review", "helper-handback": "phone",
};

const EMPTY: Answers = {
  goals: null, skills: null, learn_topics: null, meet: null, free_times: null,
  minutes_per_day: null, voice_prompts: null, helper_mode: null, shared_phone: null,
};

/** The questions her goals call for: at most two follow-ups, skills first, then learn, then meet. */
function questionPath(goals: Goal[] | null): Step[] {
  const g = goals ?? [];
  const follow: Step[] = [];
  if (g.some((x) => SKILL_GOALS.includes(x))) follow.push("skills");
  if (g.includes("learn")) follow.push("learn");
  if (g.includes("meet")) follow.push("meet");
  return ["welcome", "language", "goals", ...follow.slice(0, 2), "time", "phone"];
}

/** Where she picks up: the first question she has neither answered nor skipped. */
function resumeStep(s: OnboardingState, waiting: boolean, asked: string | null): Step {
  const ran = Boolean(s.setup.last_run_at);
  if (!waiting && asked === "setup" && s.consents.setup.granted) return ran ? "review" : "setup";
  if (s.completed) return waiting ? "thanks" : ran ? "review" : s.consents.setup.granted ? "setup" : "welcome";
  if (s.consents.setup.granted !== true) return "welcome";
  const has = (...k: (keyof Answers)[]) => k.some((x) => s.answered.includes(x));
  for (const step of questionPath(s.answers.goals)) {
    if (step === "language" && !has("voice_prompts", "helper_mode")) return step;
    if (step === "goals" && !has("goals")) return step;
    if (step === "skills" && !has("skills")) return step;
    if (step === "learn" && !has("learn_topics")) return step;
    if (step === "meet" && !has("meet")) return step;
    if (step === "time" && !has("free_times", "minutes_per_day")) return step;
    if (step === "phone" && !has("shared_phone")) return step;
  }
  return waiting ? "thanks" : "setup";
}

function useDesktop(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(min-width: 1024px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => false,
  );
}

type Fixtures = typeof import("./preview-fixtures");

/** The questions Home ("Why this? · Change") and Settings → My answers open one at a time. */
const EDITABLE: Step[] = ["goals", "skills", "learn", "meet", "time", "language", "phone"];

/**
 * Where "Save" returns her: `?back=` (a same-site path), else the page she came
 * from on this site, else Settings → My answers.
 */
function returnPath(): string {
  try {
    const back = new URL(window.location.href).searchParams.get("back");
    if (back && back.startsWith("/") && !back.startsWith("//")) return back;
    if (document.referrer) {
      const r = new URL(document.referrer);
      if (r.origin === window.location.origin && !r.pathname.startsWith("/app/onboarding")) return r.pathname + r.search;
    }
  } catch { /* a malformed referrer: use the default */ }
  return "/app/settings/answers";
}

export function OnboardingFlow() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const desktop = useDesktop();
  const waiting = user?.verification_status !== "active";
  const firstName = (user?.full_name || "").trim().split(/\s+/)[0] ?? "";

  const [preview, setPreview] = useState(false);
  const [fixtures, setFixtures] = useState<Fixtures | null>(null);
  const [server, setServer] = useState<OnboardingState | null>(null);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [consent, setConsent] = useState<ConsentDraft>({ jobs: false, employers: false });
  const [step, setStep] = useState<Step | null>(null);
  const [items, setItems] = useState<PreparedItem[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [stepError, setStepError] = useState("");
  const [handback, setHandback] = useState<Step | null>(null);
  const [handedBack, setHandedBack] = useState(false);
  const [sheet, setSheet] = useState<PreparedItem | null>(null);
  const [joined, setJoined] = useState<Set<string>>(() => new Set());
  const [gestured, setGestured] = useState(false);
  const [played, setPlayed] = useState<Set<Step>>(() => new Set());
  /** One question opened to change an answer she already gave: Save returns her to `back`. */
  const [edit, setEdit] = useState<{ back: string } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const isPreview = AUTH_PREVIEW && preview;

  // ── load ──
  useEffect(() => {
    let alive = true;
    void (async () => {
      if (AUTH_PREVIEW) {
        const p = readPreview(ONBOARDING_FLOW_PREVIEWS);
        if (p) {
          const fx = await import("./preview-fixtures");
          if (!alive) return;
          const st = fx.previewOnboarding(p);
          setPreview(true);
          setFixtures(fx);
          setServer(st);
          setAnswers(st.answers);
          setLabels(Object.fromEntries(fx.PREVIEW_SKILLS.map((s) => [s.key, s.label])));
          setItems(fx.PREVIEW_ITEMS);
          setStep(PREVIEW_STEP[p]);
          if (p === "helper-handback") setHandback("phone");
          if (p === "circle-sheet") setSheet(fx.PREVIEW_ITEMS.find((i) => i.type === "circle") ?? null);
          return;
        }
      }
      try {
        const st = await apiOnboarding();
        if (!alive) return;
        const asked = new URL(window.location.href).searchParams.get("step");
        const one = asked && (EDITABLE as string[]).includes(asked) ? (asked as Step) : null;
        const editing = Boolean(one && (st.completed || st.skipped_at));
        // A finished member changes one answer; a member part-way through picks up at that question.
        const start = one && (editing || st.consents.setup.granted) ? one : resumeStep(st, waiting, asked);
        if (editing) setEdit({ back: returnPath() });
        let prepared: PreparedItem[] = [];
        if (start === "review") prepared = await apiPreparedItems().catch(() => []);
        if (!alive) return;
        setServer(st);
        setAnswers(st.answers);
        setConsent({ jobs: st.consents.job_updates.granted === true, employers: st.consents.employer_visibility.granted === true });
        setItems(prepared);
        if (!editing && st.answers.helper_mode && PRIVATE.includes(start)) setHandback(start);
        setLoadError("");
        setStep(start);
      } catch (e) {
        if (alive) setLoadError(authError(e, "We couldn't load your questions. Check your internet and try again.").message);
      }
    })();
    return () => { alive = false; };
  }, [waiting, attempt]);

  // ── history: the phone's Back walks the questions ──
  const go = useCallback((to: Step) => { setStepError(""); setStep(to); }, []);
  const historyBack = useStepHistory<Step>(step, go, {
    replace: (to) => to === "review",
    lock: (at) => at === "setup" || at === "review",
  });

  const path = questionPath(answers.goals);
  const after = waiting ? "thanks" : "setup";
  const nextOf = (s: Step): Step => { const i = path.indexOf(s); return i >= 0 && i < path.length - 1 ? path[i + 1] : after; };
  const prevOf = (s: Step): Step | null => {
    if (s === "thanks") return "phone";
    const i = path.indexOf(s);
    return i > 0 ? path[i - 1] : null;
  };

  const advance = (to: Step, helper = answers.helper_mode) => {
    if (helper && !handedBack && PRIVATE.includes(to)) { setHandback(to); return; }
    go(to);
  };

  // ── voice: auto-play once per step, only after her first tap ──
  useEffect(() => {
    const on = () => setGestured(true);
    window.addEventListener("pointerdown", on, { once: true });
    window.addEventListener("keydown", on, { once: true });
    return () => { window.removeEventListener("pointerdown", on); window.removeEventListener("keydown", on); };
  }, []);

  // ── the phone keyboard: the frame follows the visible height ──
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const set = () => rootRef.current?.style.setProperty("--wso-vh", `${Math.round(vv.height)}px`);
    set();
    vv.addEventListener("resize", set);
    return () => vv.removeEventListener("resize", set);
  }, []);

  // ── a new step: a screen reader lands on its question ──
  useEffect(() => {
    if (!step) return;
    const t = window.setTimeout(() => document.getElementById("wso-q")?.focus({ preventScroll: true }), 60);
    return () => window.clearTimeout(t);
  }, [step]);

  // ── leaving ──
  const leave = useCallback((to: string) => {
    if (isPreview) { toast.info("Preview: she would leave the questions here."); return; }
    router.push(to);
  }, [isPreview, router, toast]);

  const notNow = useCallback(async () => {
    if (!isPreview) {
      try { await apiSkipOnboarding(); } catch { /* she still leaves; the questions come back from Settings */ }
      if (!waiting && user) markOnboardingSettled(user.id);
    }
    leave(waiting ? "/app/verify" : "/app");
  }, [isPreview, waiting, user, leave]);

  const finish = useCallback(() => {
    if (!isPreview && user) markOnboardingSettled(user.id);
    leave("/app");
  }, [isPreview, user, leave]);

  const onEscape = useCallback(() => {
    if (!step || step === "setup") return;
    if (edit) leave(edit.back);
    else if (step === "review") finish();
    else if (step === "thanks") leave("/app/verify");
    else void notNow();
  }, [step, edit, finish, leave, notNow]);
  useDialogFocus(frameRef, desktop && Boolean(step) && !sheet && !handback, onEscape);

  // ── saving ──
  async function save(partial: Partial<Answers> & { completed?: boolean }, next: Step) {
    setStepError("");
    setSaving(true);
    try {
      if (!isPreview) setServer(await apiSaveAnswers(partial));
      if (edit) { toast.success("Saved"); leave(edit.back); return; }
      advance(next);
    } catch (e) {
      setStepError(authError(e, "We couldn't save that. Check your internet and try again.").message);
    } finally {
      setSaving(false);
    }
  }

  async function start() {
    setStepError("");
    setSaving(true);
    try {
      if (!isPreview) {
        const had = server?.consents;
        const body: Partial<Record<Purpose, boolean>> = { setup: true };
        if (consent.jobs || had?.job_updates.granted) body.job_updates = consent.jobs;
        if (consent.employers || had?.employer_visibility.granted) body.employer_visibility = consent.employers;
        setServer(await apiSetConsents(body, { language: "en" }));
      }
      advance(nextOf("welcome"));
    } catch (e) {
      setStepError(authError(e, "We couldn't save that. Check your internet and try again.").message);
    } finally {
      setSaving(false);
    }
  }

  const patch = (p: Partial<Answers>) => setAnswers((a) => ({ ...a, ...p }));
  const learnLabels = useCallback((found: Skill[]) => {
    setLabels((prev) => {
      const fresh = found.filter((s) => prev[s.key] !== s.label);
      return fresh.length ? { ...prev, ...Object.fromEntries(fresh.map((s) => [s.key, s.label])) } : prev;
    });
  }, []);

  // ── the frame ──
  const section = step ? SECTION_OF[step] : undefined;
  const prev = step ? prevOf(step) : null;
  const isQuestion = section !== undefined;
  const autoPlay = answers.voice_prompts === true && gestured && !!step && !played.has(step) && !handback && !sheet;
  const listen = step ? (
    <ListenButton key={step} targetId={SAY_ID} autoPlay={autoPlay}
                  onPlayed={() => setPlayed((p) => new Set(p).add(step))} />
  ) : null;

  let content: ReactNode = null;
  let footer: ReactNode = null;
  const errNote = stepError ? <p className="wso-err" role="alert">{stepError}</p> : undefined;
  const skip = (partial: Partial<Answers> & { completed?: boolean }, next: Step) =>
    edit ? { label: "Cancel", onClick: () => leave(edit.back), disabled: saving }
      : { label: "Skip", onClick: () => void save(partial, next), disabled: saving };
  const cont = edit ? "Save" : "Continue";

  switch (step) {
    case "welcome":
      content = <WelcomeStep listen={listen} consent={consent} setConsent={setConsent} />;
      footer = <StepFooter note={errNote} primary={{ label: "Start", onClick: () => void start(), busy: saving }}
                           secondary={{ label: "Not now", onClick: () => void notNow(), disabled: saving }} />;
      break;
    case "language":
      content = <LanguageStep listen={listen} answers={answers} patch={patch} />;
      footer = <StepFooter note={errNote}
        primary={{ label: cont, busy: saving, onClick: () => void save({ voice_prompts: answers.voice_prompts ?? false, helper_mode: answers.helper_mode ?? false }, nextOf("language")) }}
        secondary={skip({ voice_prompts: null, helper_mode: null }, nextOf("language"))} />;
      break;
    case "goals":
      content = <GoalsStep listen={listen} answers={answers} patch={patch} />;
      footer = <StepFooter note={errNote}
        primary={{ label: cont, busy: saving, disabled: !(answers.goals ?? []).length, onClick: () => void save({ goals: answers.goals }, nextOf("goals")) }}
        secondary={skip({ goals: null }, questionPath(null)[3])} />;
      break;
    case "skills":
      content = <SkillsStep listen={listen} answers={answers} patch={patch} labels={labels} learnLabels={learnLabels}
                            preview={isPreview && fixtures ? fixtures.PREVIEW_SKILLS : null} />;
      footer = <StepFooter note={errNote}
        primary={{ label: cont, busy: saving, disabled: !(answers.skills ?? []).length, onClick: () => void save({ skills: answers.skills }, nextOf("skills")) }}
        secondary={skip({ skills: null }, nextOf("skills"))} />;
      break;
    case "learn":
      content = <LearnStep listen={listen} answers={answers} patch={patch} />;
      footer = <StepFooter note={errNote}
        primary={{ label: cont, busy: saving, disabled: !(answers.learn_topics ?? []).length, onClick: () => void save({ learn_topics: answers.learn_topics }, nextOf("learn")) }}
        secondary={skip({ learn_topics: null }, nextOf("learn"))} />;
      break;
    case "meet":
      content = <MeetStep listen={listen} answers={answers} patch={patch} />;
      footer = <StepFooter note={errNote}
        primary={{ label: cont, busy: saving, disabled: !(answers.meet ?? []).length, onClick: () => void save({ meet: answers.meet }, nextOf("meet")) }}
        secondary={skip({ meet: null }, nextOf("meet"))} />;
      break;
    case "time": {
      const times = answers.free_times ?? [];
      content = <TimeStep listen={listen} answers={answers} patch={patch} />;
      footer = <StepFooter note={errNote}
        primary={{ label: cont, busy: saving, disabled: !times.length && !answers.minutes_per_day,
                   onClick: () => void save({ free_times: times.length ? times : null, minutes_per_day: answers.minutes_per_day }, nextOf("time")) }}
        secondary={skip({ free_times: null, minutes_per_day: null }, nextOf("time"))} />;
      break;
    }
    case "phone":
      content = <PhoneStep listen={listen} answers={answers} patch={patch} />;
      footer = <StepFooter note={errNote}
        primary={{ label: cont, busy: saving, disabled: answers.shared_phone === null,
                   onClick: () => void save(edit ? { shared_phone: answers.shared_phone } : { shared_phone: answers.shared_phone, completed: true }, after) }}
        secondary={skip({ shared_phone: null, completed: true }, after)} />;
      break;
    case "thanks":
      content = <ThanksScreen firstName={firstName} answers={answers} labels={labels} />;
      footer = <StepFooter primary={isPreview ? { label: "Back to my application", onClick: () => leave("/app/verify") } : { label: "Back to my application", href: "/app/verify" }}
                           secondary={{ label: "Change my answers", onClick: () => go("goals") }} />;
      break;
    case "setup":
      content = (
        <SettingUpScreen answers={answers} labels={labels} preview={isPreview}
          onNeedConsent={() => go("welcome")}
          onDone={(made) => {
            setItems(made);
            setServer((s) => (s ? { ...s, setup: { ...s.setup, last_run_at: new Date().toISOString() } } : s));
            go("review");
          }} />
      );
      break;
    case "review":
      content = <ReviewScreen items={items} setItems={setItems} joined={joined} preview={isPreview}
                              onOpenCircle={(item) => setSheet(item)} />;
      footer = <StepFooter primary={{ label: "Go to my home", onClick: finish }} />;
      break;
  }

  const frameA11y = desktop ? { role: "dialog" as const, "aria-modal": true, "aria-labelledby": "wso-q" } : {};

  return (
    <div ref={rootRef} className={`wso wso-app ${authSerif.variable} ${authSans.variable}`} data-step={step ?? "loading"}>
      <HomeBackdrop />
      <div className="wso-stage">
        <div ref={frameRef} className={`wso-frame${isQuestion ? " is-question" : ""}`} {...frameA11y}
             inert={Boolean(sheet || handback) || undefined}>
          {!step ? (
            <div className="wso-body wso-loading">
              {loadError ? (
                <div className="wso-stack wso-center-screen">
                  <h1 id="wso-q" className="wso-q wso-center" tabIndex={-1}>Could not load</h1>
                  <p className="wso-err" role="alert">{loadError}</p>
                  <button type="button" className="wso-btn wso-go" onClick={() => { setLoadError(""); setAttempt((n) => n + 1); }}>
                    <RotateCcw aria-hidden /> Try again
                  </button>
                </div>
              ) : (
                <div className="wso-center-screen" role="status"><Busy /><p className="wso-sub">Opening your questions…</p></div>
              )}
            </div>
          ) : (
            <>
              {(isQuestion || step === "thanks") && (
                <header className="wso-top">
                  {prev && !edit ? (
                    <button type="button" className="wso-icon-btn" onClick={() => historyBack(prev)} aria-label="Back">
                      <ChevronLeft aria-hidden />
                    </button>
                  ) : <span className="wso-icon-spacer" aria-hidden />}
                  <div className="wso-top-mid">{answers.helper_mode && <HelperChip />}</div>
                  {isQuestion ? (
                    <button type="button" className="wso-icon-btn" onClick={() => (edit ? leave(edit.back) : void notNow())}
                            aria-label={edit ? "Close without saving" : "Not now, finish later"}>
                      <X aria-hidden />
                    </button>
                  ) : <span className="wso-icon-spacer" aria-hidden />}
                </header>
              )}
              {section !== undefined && !edit && <SectionProgress section={section} />}
              <main className={`wso-body is-${step}`} key={step}>
                <div className="wso-body-in">{content}</div>
              </main>
              {footer}
            </>
          )}
        </div>
      </div>

      {sheet && (
        <CircleSheet item={sheet} preview={isPreview} previewInfo={AUTH_PREVIEW ? fixtures?.PREVIEW_CIRCLE : undefined}
                     onClose={() => setSheet(null)} onJoined={(id) => setJoined((j) => new Set(j).add(id))} />
      )}
      {handback && (
        <HandBack onContinue={() => {
          const to = handback;
          setHandedBack(true);
          setHandback(null);
          if (to !== step) go(to);
        }} />
      )}
      <p className="sr-only" aria-live="polite">
        {section !== undefined ? `${SECTIONS[section]}. Section ${section + 1} of 3.` : ""}
      </p>
    </div>
  );
}

/** Computers: her home, blurred, behind the questions — the spec's web mockups. Decorative. */
function HomeBackdrop() {
  return (
    <div className="wso-backdrop" aria-hidden="true">
      <div className="wso-bd-side"><b /><i /><i /><i /><i /><i /><i /></div>
      <div className="wso-bd-main">
        <div className="wso-bd-hero"><Art name="home" sizes="60vw" decorative lazy /></div>
        <div className="wso-bd-grid"><i /><i /><i /><i /><i /><i /></div>
      </div>
      <div className="wso-bd-rail"><i /><i /><i /><i /></div>
    </div>
  );
}
