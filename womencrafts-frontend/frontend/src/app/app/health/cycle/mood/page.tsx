"use client";

import { useRouter } from "next/navigation";
import { useT } from "@/i18n";
import { useEffect, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Column, CycleHeader, CyButton, DeskTitle, ErrorLine, MoodFace } from "@/components/ux/cycle/parts";
import { FEELINGS as RAW_FEELINGS, MOODS as RAW_MOODS } from "@/components/ux/cycle/data";
import { useCycle } from "@/components/ux/cycle/use-cycle";
import { apiCycleLog, type Feeling, type Mood } from "@/lib/cycle-api";
import { useTranslated } from "@/i18n/data";

/**
 * How she feels right now — a face, any words that fit, and a note if she
 * wants one. What she picks reorders the food and quotes on "For you today";
 * it never changes a claim, only which suggestion comes first.
 */
export default function MoodTracker() {
  const FEELINGS = useTranslated(RAW_FEELINGS);
  const MOODS = useTranslated(RAW_MOODS);
  const tr = useT();
  const router = useRouter();
  const { state, data, act, busy, error } = useCycle();
  // Her edits, or — until she makes one — what she saved earlier today.
  const [moodPick, setMood] = useState<Mood | null>(null);
  const [feelPick, setFeelPick] = useState<Feeling[] | null>(null);
  const [notePick, setNote] = useState<string | null>(null);
  const mood: Mood = moodPick ?? state?.log?.mood ?? "happy";
  const feelings = feelPick ?? state?.log?.feelings ?? [];
  const note = notePick ?? state?.log?.note ?? "";
  const setFeelings = (f: (cur: Feeling[]) => Feeling[]) => setFeelPick(f(feelings));

  useEffect(() => {
    if (data && !data.setup) router.replace("/app/health/cycle/start");
  }, [data, router]);
  const i = MOODS.findIndex((m) => m.key === mood);
  const label = MOODS[i]?.label ?? "";

  const save = async () => {
    if (!state) return;
    const next = await act(() => apiCycleLog(state.today, { mood, feelings, note }));
    if (next) router.push("/app/health/cycle/today");
  };

  return (
    <HomeShell immersive bare>
      <Column>
        <CycleHeader title={tr("healthCycleMood.moodTracker")} action={{ label: "Save", onClick: save, disabled: busy || !state }} />
        <DeskTitle title={tr("healthCycleMood.moodTracker")} />

        <h2 className="mt-2 text-center text-[17px] font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("healthCycleMood.howAreYouFeelingRightNow")}</h2>

        {/* The reference's dial: the chosen face large in the middle, the
            others small and quiet either side. Each is still its own button. */}
        <div role="radiogroup" aria-label={tr("healthCycleMood.howAreYouFeelingRightNow2")} className="mt-5 flex items-center justify-center gap-2.5">
          {MOODS.map((m) => {
            const on = m.key === mood;
            return (
              <button key={m.key} type="button" role="radio" aria-checked={on} aria-label={m.label}
                      onClick={() => setMood(m.key)}
                      className="ux-press ux-tap-exempt grid place-items-center rounded-full transition-all"
                      style={{ width: on ? 104 : 44, height: on ? 104 : 44,
                               boxShadow: on ? "0 0 0 8px var(--cy-predicted)" : "none" }}>
                <MoodFace mood={m.key} size={on ? 96 : 40} muted={!on} />
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-center text-[20px] font-semibold" style={{ color: "var(--ux-ink)" }} aria-live="polite">{label}</p>

        <h3 className="mb-3 mt-7 text-[17px] font-semibold" style={{ color: "var(--ux-ink)" }}>What&apos;s on your mind?</h3>
        <div className="grid grid-cols-4 gap-2">
          {FEELINGS.map((f) => {
            const on = feelings.includes(f.key);
            return (
              <button key={f.key} type="button" aria-pressed={on}
                      onClick={() => setFeelings((cur) => on ? cur.filter((x) => x !== f.key) : [...cur, f.key])}
                      className="ux-press ux-tap-exempt h-[40px] truncate rounded-full px-2 text-[13px]"
                      style={on
                        ? { background: "linear-gradient(90deg, var(--cy-period), var(--ux-fill))", color: "var(--ux-on-brand)", fontWeight: 600 }
                        : { background: "var(--ux-surface)", color: "var(--ux-ink-2)", border: "1px solid var(--ux-line-strong)" }}>
                {f.label}
              </button>
            );
          })}
        </div>

        <label className="mt-6 block rounded-[16px] p-3.5" style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
          <span className="block text-[13px]" style={{ color: "var(--ux-ink-2)" }}>Add a personal note (optional)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={3}
                    placeholder={tr("healthCycleMood.writeWhatSOnYourMind")}
                    className="mt-2 w-full resize-none bg-transparent text-[15px] outline-none"
                    style={{ color: "var(--ux-ink)" }} />
        </label>

        <div className="mt-6">
          <CyButton onClick={save} busy={busy} disabled={!state} iconEnd={null}>Save</CyButton>
        </div>
        <ErrorLine text={error} />
      </Column>
    </HomeShell>
  );
}
