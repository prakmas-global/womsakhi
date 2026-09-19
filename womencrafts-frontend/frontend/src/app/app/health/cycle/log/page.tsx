"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import * as Icons from "@/components/ux/icons";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Column, CycleHeader, CyButton, DeskTitle, ErrorLine, MoodRow, WeekStrip } from "@/components/ux/cycle/parts";
import { dayNum, dow, useCycle } from "@/components/ux/cycle/use-cycle";
import { apiCycleLog, type Mood } from "@/lib/cycle-api";

/**
 * "Are you on your period today?" — the one question, asked every day.
 *
 * This is the whole tracker from her side: one tap. Yes on the first day
 * starts a period; yes the next day continues it; no ends it. Everything the
 * other screens show is worked out from these answers (`core/cycle.py`).
 *
 * The week strip lets her answer for yesterday too — the day she most often
 * forgot — and the question changes its words to match the day she picked.
 */
function LogScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const { state, data, act, busy, error } = useCycle();
  const today = data?.today ?? "";
  const [picked, setDay] = useState<string>(params.get("date") ?? "");
  const day = picked || today;
  // Her tap for the picked day; until she taps, what she already said for it.
  const [tap, setTap] = useState<{ day: string; on: boolean | null } | null>(null);
  const [moodPick, setMood] = useState<Mood | null>(null);

  // Not set up yet — this screen has nothing to write to.
  useEffect(() => {
    if (data && !data.setup) router.replace("/app/health/cycle/start");
  }, [data, router]);

  const saved = state ? [...state.week, ...state.calendar.days].find((c) => c.date === day)?.period ?? null : null;
  const on = tap?.day === day ? tap.on : saved;
  const setOn = (v: boolean) => setTap({ day, on: v });
  const isToday = day === today;
  const mood = moodPick ?? (isToday ? state?.log?.mood ?? null : null);
  const s = state?.status;
  const still = isToday && s?.on_period && s.period_day && s.period_day > 1;
  const question = !isToday
    ? `Were you on your period on ${dow(day)} ${dayNum(day)}?`
    : still ? "Still on your period today?" : "Are you on your period today?";
  const sub = still ? `Day ${s!.period_day}. One tap keeps your calendar right.` : "Just one tap. We'll take care of the rest.";

  const save = async () => {
    if (on === null || !day) return;
    const body = isToday && mood ? { period: on, mood } : { period: on };
    const next = await act(() => apiCycleLog(day, body));
    if (!next) return;
    if (!isToday) router.push("/app/health/cycle");
    else if (on && next.status.long_level) router.push("/app/health/cycle/check");
    else if (on) router.push("/app/health/cycle/period");
    else router.push("/app/health/cycle");
  };

  return (
    <HomeShell immersive bare>
      <Column>
        <CycleHeader title="Track Your Cycle" />
        <DeskTitle title="Track Your Cycle" sub="One tap a day keeps your calendar right." />

        {today && <WeekStrip today={today} selected={day} onPick={setDay} />}

        <div className="mt-7 text-center">
          <h2 className="text-[20px] font-semibold leading-snug" style={{ color: "var(--ux-ink)" }}>{question}</h2>
          <p className="mt-1.5 text-[15px]" style={{ color: "var(--ux-muted)" }}>{sub}</p>
        </div>

        <div role="radiogroup" aria-label={question} className="mt-6 flex items-center justify-center gap-6">
          {[
            { v: true, big: "Yes", small: "I'm on my period" },
            { v: false, big: "No", small: "Not today" },
          ].map((o) => {
            const sel = on === o.v;
            const size = o.v ? 128 : 112;
            return (
              <button key={o.big} type="button" role="radio" aria-checked={sel} onClick={() => setOn(o.v)}
                      className="ux-press ux-tap-exempt flex flex-col items-center justify-center gap-1 rounded-full transition-transform"
                      style={{
                        width: size, height: size,
                        transform: sel ? "scale(1.04)" : "none",
                        background: sel
                          ? (o.v ? "radial-gradient(circle at 30% 25%, var(--cy-period-soft), var(--cy-period) 55%, var(--ux-fill))"
                                 : "radial-gradient(circle at 30% 25%, var(--ux-surface), var(--cy-fertile))")
                          : "var(--ux-surface-2)",
                        color: sel && o.v ? "var(--ux-on-brand)" : "var(--ux-ink-2)",
                        boxShadow: sel ? (o.v ? "0 14px 30px -12px var(--cy-period), 0 0 0 6px var(--cy-predicted)"
                                              : "0 0 0 3px var(--cy-mood-calm)") : "inset 0 0 0 1px var(--ux-line-strong)",
                      }}>
                <Icons.Droplet className="h-7 w-7" aria-hidden
                               style={{ fill: sel && o.v ? "var(--ux-on-brand)" : "var(--ux-faint)", color: sel && o.v ? "var(--ux-on-brand)" : "var(--ux-faint)", opacity: sel && o.v ? 0.9 : 0.55 }} />
                <span className="text-[17px] font-semibold">{o.big}</span>
                <span className="text-[12px]" style={{ opacity: 0.85 }}>{o.small}</span>
              </button>
            );
          })}
        </div>

        {isToday && (
          <div className="mt-9">
            <h3 className="mb-3 text-[17px] font-semibold" style={{ color: "var(--ux-ink)" }}>How are you feeling today?</h3>
            <MoodRow value={mood} onPick={setMood} />
          </div>
        )}

        <div className="mt-8">
          <CyButton onClick={save} busy={busy} disabled={on === null}>Continue</CyButton>
        </div>
        <ErrorLine text={error} />
      </Column>
    </HomeShell>
  );
}

export default function Page() {
  // `useSearchParams` needs a boundary in this Next — see node_modules/next/dist/docs.
  return <Suspense><LogScreen /></Suspense>;
}
