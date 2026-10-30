"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";

import * as Icons from "@/components/ux/icons";
import { Btn } from "@/components/ux/kit";
import { toast } from "@/components/ux/mobile/Toast";
import { apiErrorMessage } from "@/lib/api";
import { Area } from "@/components/ux/kit/form";
import { apiClearMood, apiMoodCheckIn, apiMoodHistory, type Mood, type MoodDay } from "@/lib/engines-api";
import { I, Panel } from "../kit";
import { Dial, PicChoice, Review, StepSheet, type FlowStep } from "../StepFlow";

/**
 * Mental Wellness — the shared parts.
 *
 * ── Mood, in two vocabularies ───────────────────────────────────────────
 * A day's mood lives in `cycle_days` (see app/engines/mood.py). The check-in
 * here writes this module's six words; the cycle tracker writes its own five.
 * Both are read back, so every word below has a face and a "tone" — how
 * the day felt, roughly: easy, so-so or hard. The tone is only ever used to
 * count days ("4 easy days of 7"); it is never shown as a score.
 *
 * Faces are drawn, not emoji: emoji differ per phone and cannot take the
 * design system's colours (README → Voice and content).
 */

export type Tone = "easy" | "soso" | "hard";

export const LOOK: Record<string, { label: string; tone: Tone; tint: string; ink: string; mouth: number; brows?: "worry" | "cross"; sleepy?: boolean }> = {
  good: { label: "Good", tone: "easy", tint: "var(--ux-tint-green)", ink: "var(--ux-green-ink)", mouth: 1 },
  happy: { label: "Happy", tone: "easy", tint: "var(--ux-tint-green)", ink: "var(--ux-green-ink)", mouth: 1 },
  calm: { label: "Calm", tone: "easy", tint: "var(--ux-tint-blue)", ink: "var(--ux-blue-ink)", mouth: 0.5 },
  tired: { label: "Tired", tone: "soso", tint: "var(--ux-tint-amber)", ink: "var(--ux-amber-ink)", mouth: 0, sleepy: true },
  low: { label: "Low", tone: "hard", tint: "var(--ux-tint-blue)", ink: "var(--ux-blue-ink)", mouth: -1 },
  sad: { label: "Sad", tone: "hard", tint: "var(--ux-tint-blue)", ink: "var(--ux-blue-ink)", mouth: -1 },
  anxious: { label: "Anxious", tone: "hard", tint: "var(--ux-tint-violet)", ink: "var(--ux-violet-ink)", mouth: -0.4, brows: "worry" },
  angry: { label: "Upset", tone: "hard", tint: "var(--ux-tint-orange)", ink: "var(--ux-orange-ink)", mouth: -0.8, brows: "cross" },
  irritable: { label: "Irritable", tone: "hard", tint: "var(--ux-tint-orange)", ink: "var(--ux-orange-ink)", mouth: -0.5, brows: "cross" },
  unwell: { label: "Unwell", tone: "hard", tint: "var(--ux-tint-pink)", ink: "var(--ux-pink-ink)", mouth: -0.3, sleepy: true },
};

/** What she can pick here — the mood engine's six. */
export const CHECK_IN: Mood[] = ["good", "tired", "low", "anxious", "angry", "unwell"];

/** The cycle tracker's feelings (app/models/cycle.py FEELINGS), so both screens agree. */
export const FEELINGS = [
  { value: "calm", label: "Calm" }, { value: "energetic", label: "Energetic" }, { value: "confident", label: "Confident" },
  { value: "tired", label: "Tired" }, { value: "anxious", label: "Anxious" }, { value: "irritable", label: "Irritable" },
  { value: "emotional", label: "Emotional" }, { value: "low", label: "Low" },
] as const;
export const feelingLabel = (f: string) => FEELINGS.find((x) => x.value === f)?.label ?? f;

export const lookOf = (mood: string) => LOOK[mood] ?? { label: mood || "Feelings only", tone: "soso" as Tone, tint: "var(--ux-surface-2)", ink: "var(--ux-muted)", mouth: 0 };

/** A drawn face in the mood's own colour. */
export function MoodFace({ mood, size = 36 }: { mood: string; size?: number }) {
  const l = lookOf(mood);
  const y = 21, dy = l.mouth * 3.2;
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <circle cx="16" cy="16" r="13.5" fill={l.tint} stroke={l.ink} strokeWidth="2" />
      {l.sleepy ? (
        <>
          <path d="M9.5 13.5 q2 1.6 4 0" fill="none" stroke={l.ink} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M18.5 13.5 q2 1.6 4 0" fill="none" stroke={l.ink} strokeWidth="1.8" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="11.5" cy="13" r="1.7" fill={l.ink} />
          <circle cx="20.5" cy="13" r="1.7" fill={l.ink} />
        </>
      )}
      {l.brows === "worry" && <><path d="M9 9.8 l4 -1.4" stroke={l.ink} strokeWidth="1.6" strokeLinecap="round" /><path d="M23 9.8 l-4 -1.4" stroke={l.ink} strokeWidth="1.6" strokeLinecap="round" /></>}
      {l.brows === "cross" && <><path d="M9 8.6 l4 1.6" stroke={l.ink} strokeWidth="1.6" strokeLinecap="round" /><path d="M23 8.6 l-4 1.6" stroke={l.ink} strokeWidth="1.6" strokeLinecap="round" /></>}
      <path d={`M10.5 ${y} Q16 ${y + dy} 21.5 ${y}`} fill="none" stroke={l.ink} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** The row of faces she taps. */
export function FaceRow({ value, onPick, busy, size = 40, narrow = false }: {
  value?: string; onPick: (m: Mood) => void; busy?: boolean; size?: number;
  /** In a side column: three across, never six. */
  narrow?: boolean;
}) {
  return (
    <div role="group" aria-label="How do you feel?" className={`grid grid-cols-3 gap-2 ${narrow ? "" : "sm:grid-cols-6"}`}>
      {CHECK_IN.map((m) => {
        const on = value === m;
        return (
          <button key={m} type="button" aria-pressed={on} disabled={busy} onClick={() => onPick(m)} data-mood={m}
                  className="ux-press flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-[16px] border-[1.5px] text-[13px] font-bold disabled:opacity-60"
                  style={on
                    ? { borderColor: LOOK[m].ink, background: LOOK[m].tint, color: "var(--ux-ink)" }
                    : { borderColor: "var(--ux-line)", background: "var(--ux-surface)", color: "var(--ux-ink-2)" }}>
            <MoodFace mood={m} size={size} />
            {LOOK[m].label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * True once the page runs in her browser. Dates written in her locale
 * ("Sunday 25 October") differ from the server's ("Sunday, October 25"), so
 * they are only drawn after hydration — otherwise React throws the tree away.
 */
const NOOP = () => () => {};
export function useMounted() {
  return useSyncExternalStore(NOOP, () => true, () => false);
}

/* ── her check-ins ────────────────────────────────────────────────────── */

export function useMoodHistory(days = 90) {
  const [rows, setRows] = useState<MoodDay[] | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    const ctl = new AbortController();
    apiMoodHistory(days, ctl.signal).then(setRows).catch(() => { if (!ctl.signal.aborted) setRows((r) => r ?? []); });
    return () => ctl.abort();
  }, [days, nonce]);

  const checkIn = useCallback(async (mood: Mood, opts: { feelings?: string[]; note?: string; msg?: string } = {}) => {
    try {
      const { msg, ...rest } = opts;
      const r = await apiMoodCheckIn(mood, rest);
      setNonce((n) => n + 1);
      toast(msg ?? `Saved — feeling ${LOOK[mood].label.toLowerCase()} today`, { tone: "success" });
      return r;
    } catch (e) {
      toast(apiErrorMessage(e), { tone: "error" });
      return null;
    }
  }, []);

  const clear = useCallback(async (date: string) => {
    let before: MoodDay[] | null = null;
    setRows((r) => { before = r; return (r ?? []).filter((d) => d.date !== date); });
    try {
      await apiClearMood(date);
      toast("Check-in removed", { tone: "success" });
    } catch (e) {
      setRows(before);
      toast(apiErrorMessage(e), { tone: "error" });
    }
  }, []);

  return { rows: rows ?? [], loading: rows === null, checkIn, clear };
}

/** Days in a row, ending today or yesterday, that have a check-in. */
export function streakOf(dates: string[], today: string) {
  const set = new Set(dates);
  const d = new Date(`${today}T00:00:00`);
  if (!set.has(today)) d.setDate(d.getDate() - 1);
  let n = 0;
  for (;;) {
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!set.has(k)) return n;
    n++; d.setDate(d.getDate() - 1);
  }
}

/* ── words to keep ────────────────────────────────────────────────────── */

export const AFFIRMATIONS = [
  "I am allowed to rest.", "I am doing my best, and that is enough.", "My needs matter.",
  "I can take this one step at a time.", "I treat my body with care.", "I am growing every day.",
  "I can ask for help when I need it.", "I deserve kindness, including from myself.",
  "I let go of what I can't control.", "I am proud of how far I've come.",
  "My calm is stronger than my worries.", "Today I choose what is good for me.",
];

export const PROMPTS: Record<"Reflection" | "Gratitude" | "Affirmation", string[]> = {
  Reflection: ["What went well today?", "What is one thing I want to let go of?", "What did I learn about myself this week?"],
  Gratitude: ["Three things I'm grateful for today:", "Someone who made my day better:", "A small moment I enjoyed:"],
  Affirmation: ["Today I remind myself that…", "I am proud of myself for…"],
};

export function AffirmationCard({ onSave }: { onSave?: (text: string) => void }) {
  const [i, setI] = useState(() => new Date().getDate() % AFFIRMATIONS.length);
  const a = AFFIRMATIONS[i % AFFIRMATIONS.length];
  return (
    <Panel title="Positive affirmation" hue="blue" tint>
      <p className="px-1 text-center text-[21px] font-bold leading-snug" style={{ color: "var(--ux-blue-ink)" }} data-affirmation>
        &ldquo;{a}&rdquo;
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Btn size="sm" variant="outline" icon="RefreshCw" onClick={() => setI((n) => n + 1)}>Another</Btn>
        {onSave && <Btn size="sm" icon="BookOpen" onClick={() => onSave(a)}>Save to journal</Btn>}
      </div>
    </Panel>
  );
}

/* ── when it is more than a bad day ───────────────────────────────────── */

export function CrisisCard() {
  return (
    <Panel title="Need more support?" hue="pink">
      <p className="text-sm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
        If you have felt low for more than two weeks, or have thoughts of harming yourself, please talk to someone
        today. These lines are free and confidential.
      </p>
      <div className="flex flex-col gap-2" data-crisis>
        {[
          { href: "tel:14416", name: "Tele-MANAS", num: "14416", note: "Government of India · any time, any day" },
          { href: "tel:18008914416", name: "Tele-MANAS", num: "1-800-891-4416", note: "Toll-free, 24 hours" },
          { href: "tel:+919152987821", name: "iCall (TISS)", num: "91529 87821", note: "Counsellors · Mon–Sat, 10 am–8 pm" },
        ].map((l) => (
          <a key={l.href} href={l.href}
             className="ux-press flex min-h-[52px] items-center gap-3 rounded-[12px] px-3"
             style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink)" }}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: "var(--ux-tint-pink)", color: "var(--ux-pink-ink)" }}>
              <Icons.Phone className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-sm">{l.name} · <span className="tabular-nums">{l.num}</span></b>
              <span className="block text-xs" style={{ color: "var(--ux-muted)" }}>{l.note}</span>
            </span>
          </a>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Btn size="sm" variant="outline" icon="Stethoscope" href="/app/health/doctors?speciality=Counsellor">See a counsellor</Btn>
        <Btn size="sm" variant="ghost" icon="Users" href="/app/health/mentors?topic=Mental%20wellness">Talk to a mentor</Btn>
      </div>
      <p className="text-xs" style={{ color: "var(--ux-muted)" }}>In an emergency, call 112.</p>
    </Panel>
  );
}

export function PrivateNote() {
  return (
    <p className="flex items-center gap-2 text-xs" style={{ color: "var(--ux-muted)" }}>
      <Icons.Lock className="h-3.5 w-3.5" /> Everything here is private. Only you can see it.
    </p>
  );
}

/* ── guided sessions ──────────────────────────────────────────────────── */

export type Routine = { id: string; name: string; minutes: number; activity: string; icon: string; desc: string; image: string; steps: [string, number][] };

/** From the approved design's mindfulness sessions. */
export const ROUTINES: Routine[] = [
  { id: "bodyscan", name: "Body scan", minutes: 5, activity: "Meditation", icon: "ScanFace", image: "/ux/art/scene-woman-meditating.webp",
    desc: "Relax from head to toe.",
    steps: [["Sit or lie down comfortably. Close your eyes if you like.", 30], ["Notice your breath without changing it.", 30],
      ["Relax your forehead, eyes and jaw.", 40], ["Let your shoulders drop. Soften your arms and hands.", 40],
      ["Notice your chest and belly rise and fall.", 40], ["Relax your hips, legs and feet.", 40],
      ["Feel your whole body resting.", 40], ["Take three slow breaths. Open your eyes when ready.", 40]] },
  { id: "ground", name: "5-4-3-2-1 grounding", minutes: 3, activity: "Meditation", icon: "Eye", image: "/ux/art/learn-dashboard-mindfulness.webp",
    desc: "Use your senses to settle a busy mind.",
    steps: [["Look around. Name five things you can see.", 40], ["Notice four things you can feel or touch.", 35],
      ["Listen for three sounds.", 35], ["Notice two things you can smell.", 30], ["Notice one thing you can taste.", 20],
      ["Take a slow breath and return to your day.", 20]] },
  { id: "grat", name: "Gratitude pause", minutes: 3, activity: "Journaling", icon: "Heart", image: "/ux/art/scene-two-women-support.webp",
    desc: "A short pause to notice what's good.",
    steps: [["Sit comfortably and breathe slowly.", 30], ["Think of one person you're thankful for.", 45],
      ["Think of a small thing that made you smile recently.", 45], ["Think of something your body did for you today.", 40],
      ["Breathe in, and say thank you silently.", 20]] },
  { id: "mwalk", name: "Mindful walk", minutes: 10, activity: "Walk outdoors", icon: "Footprints", image: "/ux/art/scene-woman-walking-with-bag.webp",
    desc: "Walk slowly and notice the world around you.",
    steps: [["Walk at an easy pace. Notice your feet touching the ground.", 120], ["Notice the sounds around you.", 120],
      ["Look for colours and shapes you haven't noticed before.", 120], ["Match your breathing to your steps.", 120],
      ["Slow down, then stand still for a moment.", 120]] },
];

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

/**
 * One guided session, step by step. The clock counts each step down; she can
 * pause, skip a step or stop. Finishing (or stopping after a minute or more)
 * hands back the minutes she spent, to be logged as a calming activity.
 */
export function RoutinePlayer({ routine, onDone, onClose }: {
  routine: Routine;
  onDone: (minutes: number) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [left, setLeft] = useState(routine.steps[0][1]);
  const [paused, setPaused] = useState(false);
  const [spent, setSpent] = useState(0);
  const finished = step >= routine.steps.length;

  useEffect(() => {
    if (paused || finished) return;
    const t = window.setInterval(() => {
      setSpent((x) => x + 1);
      setLeft((l) => l - 1);
    }, 1000);
    return () => window.clearInterval(t);
  }, [paused, finished]);

  useEffect(() => {
    if (finished || left > 0) return;
    const next = step + 1;
    // Moving to the next step is the timer's job, so it happens off the effect's
    // own render: a microtask, not a synchronous setState chain.
    queueMicrotask(() => {
      setStep(next);
      if (next < routine.steps.length) setLeft(routine.steps[next][1]);
    });
  }, [left, step, finished, routine.steps]);

  const skip = () => {
    const next = step + 1;
    setStep(next);
    if (next < routine.steps.length) setLeft(routine.steps[next][1]);
  };
  const minutes = Math.max(1, Math.round(spent / 60));

  return (
    <section className="ux-card flex flex-col gap-4 p-5" style={{ border: "1.5px solid var(--ux-blue-ink)" }} data-player>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xs font-extrabold uppercase tracking-[0.12em]" style={{ color: "var(--ux-blue-ink)" }}>Guided session</p>
          <h2 className="text-lg font-extrabold" style={{ color: "var(--ux-ink)" }}>{routine.name}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close the session"
                className="ux-press grid h-10 w-10 place-items-center rounded-full" style={{ border: "1px solid var(--ux-line)", color: "var(--ux-muted)" }}>
          <Icons.X className="h-4 w-4" />
        </button>
      </div>

      {finished ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full" style={{ background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }}>
            <Icons.Check className="h-7 w-7" />
          </span>
          <p className="text-lg font-bold" style={{ color: "var(--ux-ink)" }}>Well done. Take this calm with you.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Btn icon="Check" onClick={() => onDone(Math.max(routine.minutes, minutes))}>Save {Math.max(routine.minutes, minutes)} min</Btn>
            <Btn variant="ghost" onClick={onClose}>Close</Btn>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center gap-2 py-3 text-center" aria-live="polite">
            <span className="text-[52px] font-extrabold tabular-nums leading-none" style={{ color: "var(--ux-blue-ink)" }}>{mmss(left)}</span>
            <p className="max-w-[34ch] text-[19px] font-semibold leading-snug" style={{ color: "var(--ux-ink)" }}>{routine.steps[step][0]}</p>
            <p className="text-xs" style={{ color: "var(--ux-muted)" }}>Step {step + 1} of {routine.steps.length}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Btn icon={paused ? "Play" : "Pause"} onClick={() => setPaused((p) => !p)}>{paused ? "Resume" : "Pause"}</Btn>
            <Btn variant="outline" icon="SkipForward" onClick={skip}>Next step</Btn>
            <Btn variant="ghost" onClick={() => (spent >= 60 ? onDone(minutes) : onClose())}>
              {spent >= 60 ? `Stop and save ${minutes} min` : "Stop"}
            </Btn>
          </div>
          <ol className="flex flex-col gap-1 text-[13.5px]">
            {routine.steps.map(([t, s], i) => (
              <li key={i} className="flex justify-between gap-3 rounded-[9px] px-2.5 py-1.5"
                  style={i === step ? { background: "var(--ux-tint-blue)", fontWeight: 700, color: "var(--ux-ink)" }
                    : { color: i < step ? "var(--ux-muted)" : "var(--ux-ink-2)", textDecoration: i < step ? "line-through" : undefined }}>
                <span className="min-w-0">{t}</span><span className="shrink-0 tabular-nums">{mmss(s)}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

export function RoutineCard({ r, onStart }: { r: Routine; onStart: () => void }) {
  return (
    <article className="ux-card ux-hov group relative flex flex-col overflow-hidden" style={{ padding: 0 }}>
      <div className="relative aspect-[16/9] w-full overflow-hidden" style={{ background: "var(--ux-surface-2)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={r.image} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        <span className="absolute start-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: "var(--ux-surface)", color: "var(--ux-ink)" }}>
          {r.minutes} min
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <b className="flex items-center gap-2 text-[15px]" style={{ color: "var(--ux-ink)" }}>
          <I name={r.icon} className="h-4 w-4" style={{ color: "var(--ux-blue-ink)" }} /> {r.name}
        </b>
        <p className="text-[13.5px]" style={{ color: "var(--ux-muted)" }}>{r.desc}</p>
        <div className="mt-auto pt-2">
          <Btn size="sm" icon="Play" onClick={onStart}>Start</Btn>
        </div>
      </div>
    </article>
  );
}

/* ── step flows ───────────────────────────────────────────────────────── */
/*
 * The three forms of this section, each a short sheet that asks one thing at
 * a time (StepFlow.tsx). A flow is mounted only while it is open, so it starts
 * fresh every time, and it closes itself only when the save worked.
 */

const PICK_DELAY = 180;

/** Pictures for the cycle tracker's feelings: the nearest face or sign. */
const FEELING_ART: Record<string, string> = {
  calm: "Feel less stressed", energetic: "Strength", confident: "Star", tired: "Tiredness",
  anxious: "Low", irritable: "Fire", emotional: "Mood swings", low: "Very low",
};

function MoodBadge({ mood }: { mood: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <MoodFace mood={mood} size={22} /> {lookOf(mood).label}
    </span>
  );
}

/** Mood → feelings → a note → check. Hands back what to save; the screen saves it. */
export function CheckInFlow({ onClose, onSave, initial, startAt = 0 }: {
  onClose: () => void;
  onSave: (mood: Mood, feelings: string[], note: string) => Promise<boolean>;
  /** Today's check-in, if she has one, so the flow edits it rather than starting blank. */
  initial?: { mood?: string; feelings?: string[]; note?: string };
  startAt?: number;
}) {
  const first = CHECK_IN.includes(initial?.mood as Mood) ? (initial?.mood as Mood) : null;
  const [step, setStep] = useState(first ? startAt : 0);
  const [mood, setMood] = useState<Mood | null>(first);
  const [feelings, setFeelings] = useState<string[]>(initial?.feelings ?? []);
  const [note, setNote] = useState(initial?.note ?? "");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!mood) return;
    setBusy(true);
    const ok = await onSave(mood, feelings, note);
    setBusy(false);
    if (ok) onClose();
  };
  const flow: FlowStep[] = [
    { id: "mood", title: "How are you feeling today?", hint: "Tap the face that fits best.", valid: !!mood,
      body: <FaceRow narrow value={mood ?? undefined} busy={busy}
                     onPick={(m) => { setMood(m); window.setTimeout(() => setStep(1), PICK_DELAY); }} /> },
    { id: "feelings", title: "What else are you feeling?", hint: "Tap all that apply. Skip if nothing else fits.",
      valid: feelings.length > 0, optional: true,
      body: <PicChoice label="Feelings" hue="blue" multi columns={4} value={feelings}
                       onChange={(f) => setFeelings((x) => (x.includes(f) ? x.filter((y) => y !== f) : [...x, f]))}
                       options={FEELINGS.map((f) => ({ value: f.value, label: f.label, art: FEELING_ART[f.value] }))} /> },
    { id: "note", title: "Anything on your mind?", hint: "Optional. A line or two, just for you.",
      valid: !!note.trim(), optional: true,
      body: <Area label="A note for yourself" value={note} onChange={setNote} max={300} rows={4} placeholder="What's on your mind? (optional)" /> },
    { id: "check", title: "Check, then save", valid: !!mood,
      body: <>
        <Review rows={[
          ["Mood", mood ? <MoodBadge mood={mood} /> : ""],
          ["Feelings", feelings.length ? feelings.map(feelingLabel).join(", ") : "None added"],
          ["Note", note.trim()],
          ["Day", "Today"],
        ]} />
        <PrivateNote />
      </> },
  ];
  return <StepSheet open onClose={onClose} icon="Smile" title="Check in" hue="blue" steps={flow} step={step} setStep={setStep}
                    onSubmit={save} busy={busy} submitLabel="Save check-in" />;
}

export type JournalType = "Reflection" | "Gratitude" | "Affirmation";
export type JournalDraft = { type: JournalType; text: string; id?: string };

const JOURNAL_TYPES: { value: JournalType; label: string; sub: string }[] = [
  { value: "Reflection", label: "Reflection", sub: "Look back on your day" },
  { value: "Gratitude", label: "Gratitude", sub: "Notice what is good" },
  { value: "Affirmation", label: "Affirmation", sub: "Kind words to yourself" },
];

/** Type → write freely, with prompts to tap → check. Edits an entry when the draft has an id. */
export function JournalFlow({ onClose, onSave, initial, startAt = 0 }: {
  onClose: () => void;
  onSave: (d: JournalDraft) => Promise<boolean>;
  initial: JournalDraft;
  startAt?: number;
}) {
  const [step, setStep] = useState(startAt);
  const [type, setType] = useState<JournalType>(initial.type);
  const [text, setText] = useState(initial.text);
  const [busy, setBusy] = useState(false);
  const editing = !!initial.id;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const save = async () => {
    if (!text.trim()) return;
    setBusy(true);
    const ok = await onSave({ type, text, id: initial.id });
    setBusy(false);
    if (ok) onClose();
  };
  const flow: FlowStep[] = [
    { id: "type", title: "What would you like to write?", hint: "Pick one. You can change it later.",
      body: <PicChoice label="Type of entry" hue="blue" options={JOURNAL_TYPES} value={type}
                       onChange={(v) => setType(v as JournalType)} onPicked={() => setStep(1)} /> },
    { id: "write", title: editing ? "Change your entry" : "Write freely", hint: "Tap a prompt to begin, or just start writing. Nobody else will read this.",
      valid: !!text.trim(),
      body: <>
        <div className="flex flex-col gap-1.5" role="group" aria-label="Prompts">
          {PROMPTS[type].map((p) => (
            <button key={p} type="button" onClick={() => setText((x) => (x ? `${x}\n${p} ` : `${p} `))}
                    className="ux-press flex min-h-[44px] items-center gap-2 rounded-[12px] px-3 text-start text-[13.5px] font-semibold"
                    style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>
              <Icons.Plus className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--ux-blue-ink)" }} /> {p}
            </button>
          ))}
        </div>
        <div>
          <Area label="Write freely" value={text} onChange={setText} max={2000} rows={7} placeholder="Write freely. Nobody else will read this." />
        </div>
      </> },
    { id: "check", title: "Check, then save", valid: !!text.trim(),
      body: <>
        <Review rows={[["Type", type], ["Length", `${words} ${words === 1 ? "word" : "words"}`], ["Day", editing ? "Keeps its date" : "Today"]]} />
        <p className="line-clamp-6 whitespace-pre-wrap rounded-[16px] border p-4 text-[14.5px] leading-relaxed"
           style={{ borderColor: "var(--ux-line)", color: "var(--ux-ink)" }}>{text.trim()}</p>
        <PrivateNote />
      </> },
  ];
  return <StepSheet open onClose={onClose} icon="BookOpen" title={editing ? "Edit journal entry" : "New journal entry"} hue="blue"
                    steps={flow} step={step} setStep={setStep} onSubmit={save} busy={busy}
                    submitLabel={editing ? "Save changes" : "Save entry"} />;
}

/** Calming activities she can log by hand. */
export const CALM_ACTIVITIES = ["Meditation", "Breathing exercise", "Yoga", "Journaling", "Walk outdoors", "Calming music"] as const;

/** Activity → minutes → check. */
export function ActivityFlow({ onClose, onSave }: {
  onClose: () => void;
  onSave: (type: string, minutes: number) => Promise<boolean>;
}) {
  const [step, setStep] = useState(0);
  const [type, setType] = useState("");
  const [minutes, setMinutes] = useState(10);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const ok = await onSave(type, minutes);
    setBusy(false);
    if (ok) onClose();
  };
  const flow: FlowStep[] = [
    { id: "what", title: "What did you do?", valid: !!type,
      body: <PicChoice label="Activity" hue="blue" options={CALM_ACTIVITIES} value={type} onChange={setType} onPicked={() => setStep(1)} /> },
    { id: "long", title: "For how long?", hint: "Up to 3 hours.", valid: minutes >= 1 && minutes <= 180,
      body: <Dial label="minutes" unit="min" hue="blue" value={minutes} onChange={setMinutes} min={1} max={180} presets={[5, 10, 15, 20, 30, 45]} /> },
    { id: "check", title: "Check, then save", valid: !!type && minutes >= 1,
      body: <Review rows={[["Activity", type], ["Time", `${minutes} min`], ["Day", "Today"]]} /> },
  ];
  return <StepSheet open onClose={onClose} icon="Leaf" title="Log a calming activity" hue="blue" steps={flow} step={step} setStep={setStep}
                    onSubmit={save} busy={busy} submitLabel="Save activity" />;
}

export function QuickCalm({ items }:{ items: { icon: string; label: string; href?: string; onClick?: () => void }[] }) {
  return (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(104px, 1fr))" }}>
      {items.map((t) => {
        const body = (
          <>
            <span className="grid h-11 w-11 place-items-center rounded-[13px]" style={{ background: "var(--ux-tint-blue)", color: "var(--ux-blue-ink)" }}>
              <I name={t.icon} className="h-5 w-5" />
            </span>
            {t.label}
          </>
        );
        const cls = "ux-press ux-hov flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-[16px] border-[1.5px] p-3 text-center text-[13px] font-bold";
        const style = { borderColor: "var(--ux-line)", background: "var(--ux-surface)", color: "var(--ux-ink)" };
        return t.href
          ? <Link key={t.label} href={t.href} className={cls} style={style}>{body}</Link>
          : <button key={t.label} type="button" onClick={t.onClick} className={cls} style={style}>{body}</button>;
      })}
    </div>
  );
}
