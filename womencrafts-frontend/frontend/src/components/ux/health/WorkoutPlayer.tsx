"use client";

import { useEffect, useRef, useState } from "react";

import { Btn } from "@/components/ux/kit";
import type { KindData } from "@/lib/health-api";
import { today } from "@/lib/health-api";
import { routineMinutes, type Routine } from "./fitness-data";
import { HUE, I } from "./kit";

/**
 * The guided-workout player: one step at a time, a countdown, pause, skip and
 * finish. Finishing logs a `workout` with the routine and the minutes she
 * actually did (rounded up to at least one), so a session cut short is
 * recorded as what it was, not as the full routine.
 */
export function WorkoutPlayer({ routine, onClose, onFinish }: {
  routine: Routine;
  onClose: () => void;
  onFinish: (data: KindData["workout"], date: string) => Promise<unknown>;
}) {
  const h = HUE.orange;
  const total = routine.steps.length;
  // One state, updated by pure functions, so a tick can never advance twice.
  const [st, setSt] = useState({ i: 0, left: routine.steps[0][1], elapsed: 0, finished: false });
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const { i, left, elapsed, finished } = st;

  useEffect(() => { ref.current?.scrollIntoView({ block: "start", behavior: "smooth" }); }, []);

  useEffect(() => {
    if (paused || finished) return;
    const t = window.setInterval(() => setSt((x) => {
      if (x.finished) return x;
      const elapsed = x.elapsed + 1;
      if (x.left > 1) return { ...x, left: x.left - 1, elapsed };
      if (x.i + 1 >= total) return { ...x, left: 0, elapsed, finished: true };
      return { i: x.i + 1, left: routine.steps[x.i + 1][1], elapsed, finished: false };
    }), 1000);
    return () => window.clearInterval(t);
  }, [paused, finished, routine.steps, total]);

  const go = (k: number) => setSt((x) => (k >= total ? { ...x, finished: true } : { ...x, i: k, left: routine.steps[k][1] }));
  const next = () => go(i + 1);
  const prev = () => { if (i > 0) go(i - 1); };
  const finishNow = () => setSt((x) => ({ ...x, finished: true }));

  const save = async () => {
    setBusy(true);
    await onFinish({ activity: routine.activity, minutes: Math.max(1, Math.round(elapsed / 60)), routine: routine.id }, today());
    setBusy(false);
    onClose();
  };

  const mm = String(Math.floor(left / 60)), ss = String(left % 60).padStart(2, "0");

  return (
    <section ref={ref} aria-label={`${routine.name} player`} data-workout-player
             className="ux-card flex flex-col gap-4 p-4 sm:p-5" style={{ border: `1.5px solid ${h.ink}`, scrollMarginTop: "calc(var(--ux-topbar-h,72px) + 12px)" }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-2xs font-extrabold uppercase tracking-[0.1em]" style={{ color: h.ink }}>Now playing</p>
          <h2 className="text-lg font-extrabold" style={{ color: "var(--ux-ink)" }}>{routine.name}</h2>
        </div>
        <Btn variant="ghost" size="sm" icon="X" onClick={onClose}>Close</Btn>
      </div>

      {finished ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full" style={{ background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }}>
            <I name="Trophy" className="h-7 w-7" />
          </span>
          <p className="text-xl font-extrabold" style={{ color: "var(--ux-ink)" }}>Well done!</p>
          <p className="text-sm" style={{ color: "var(--ux-muted)" }}>
            You moved for {Math.max(1, Math.round(elapsed / 60))} minutes. Save it to your log?
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Btn icon="Check" loading={busy} onClick={save}>Save workout</Btn>
            <Btn variant="outline" onClick={onClose}>Don&rsquo;t save</Btn>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center gap-1.5 py-2 text-center" aria-live="polite">
            <span className="text-xs font-bold" style={{ color: "var(--ux-muted)" }}>Step {i + 1} of {total}</span>
            <span className="text-[52px] font-extrabold leading-none tabular-nums" style={{ color: h.ink }}>{mm}:{ss}</span>
            <span className="max-w-[32ch] text-xl font-bold" style={{ color: "var(--ux-ink)" }}>{routine.steps[i][0]}</span>
            {i + 1 < total && <span className="text-xs" style={{ color: "var(--ux-muted)" }}>Next: {routine.steps[i + 1][0]}</span>}
          </div>
          <div className="h-[7px] overflow-hidden rounded-full" style={{ background: h.tint }}>
            <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(i / total) * 100}%`, background: h.ink }} />
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Btn variant="outline" size="sm" icon="SkipBack" onClick={prev} disabled={i === 0}>Back</Btn>
            <Btn size="sm" icon={paused ? "Play" : "Pause"} onClick={() => setPaused(!paused)}>{paused ? "Resume" : "Pause"}</Btn>
            <Btn variant="outline" size="sm" icon="SkipForward" onClick={next}>Skip</Btn>
            <Btn variant="soft" size="sm" icon="Flag" onClick={finishNow}>Finish now</Btn>
          </div>
          <ol className="flex max-h-[220px] flex-col gap-0.5 overflow-y-auto text-[13.5px]">
            {routine.steps.map(([s, sec], k) => (
              <li key={k} className="flex justify-between gap-3 rounded-[9px] px-2.5 py-1.5"
                  style={{ background: k === i ? h.tint : "transparent", color: k < i ? "var(--ux-muted)" : "var(--ux-ink)",
                           fontWeight: k === i ? 700 : 500, textDecoration: k < i ? "line-through" : "none" }}>
                <span>{s}</span><span className="tabular-nums">{sec >= 60 ? `${Math.round(sec / 60)} min` : `${sec}s`}</span>
              </li>
            ))}
          </ol>
          <p className="text-center text-xs" style={{ color: "var(--ux-muted)" }}>
            About {routineMinutes(routine)} minutes. Stop if anything hurts.
          </p>
        </>
      )}
    </section>
  );
}
