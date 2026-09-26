"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import * as Icons from "@/components/ux/icons";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { CycleDesktopNav } from "@/components/ux/cycle/AdvancedDailyLog";
import { Toggle } from "@/components/ux/cycle/parts";
import { useCycle } from "@/components/ux/cycle/use-cycle";
import { apiCycleSettings, type CycleCondition, type TrackingGoal } from "@/lib/cycle-api";

const goals: { value: TrackingGoal; title: string; sub: string; icon: keyof typeof Icons }[] = [
  { value: "understand-cycle", title: "Understand my cycle", sub: "Periods, phases and personal patterns", icon: "CalendarDays" },
  { value: "trying-to-conceive", title: "Trying to conceive", sub: "Fertility signs, temperature and tests", icon: "Sparkles" },
  { value: "symptom-care", title: "Manage symptoms", sub: "Pain, flow, mood and recurring patterns", icon: "HeartPulse" },
  { value: "perimenopause", title: "Perimenopause", sub: "Changing cycles, sleep and symptoms", icon: "Sunrise" },
];
const conditions: { value: CycleCondition; label: string }[] = [
  { value: "pcos", label: "PCOS / PCOD" }, { value: "endometriosis", label: "Endometriosis" },
  { value: "fibroids", label: "Fibroids" }, { value: "thyroid", label: "Thyroid condition" },
  { value: "pmdd", label: "PMDD" }, { value: "anaemia", label: "Anaemia" },
  { value: "none", label: "None diagnosed" },
];

function Panel({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return <section className="rounded-[22px] p-5" style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}><h2 className="text-[18px] font-semibold" style={{ color: "var(--ux-ink)" }}>{title}</h2><p className="mt-1 text-[13px]" style={{ color: "var(--ux-muted)" }}>{sub}</p><div className="mt-5">{children}</div></section>;
}

export default function CycleSettingsPage() {
  const router = useRouter();
  const { state, data, act, busy, error } = useCycle();
  useEffect(() => { if (data && !data.setup) router.replace("/app/health/cycle/start"); }, [data, router]);
  const p = state?.profile;
  const save = (body: Parameters<typeof apiCycleSettings>[0]) => act(() => apiCycleSettings(body));
  const toggleCondition = (value: CycleCondition) => {
    if (!p) return;
    const current = p.conditions.filter((x) => x !== "none");
    const next = value === "none" ? ["none" as CycleCondition]
      : current.includes(value) ? current.filter((x) => x !== value) : [...current, value];
    save({ conditions: next });
  };

  return (
    <HomeShell immersive bare>
      <div className="mx-auto max-w-[1240px] px-5 py-7 lg:px-8">
        <header className="mb-5"><p className="text-[12px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--cy-period-ink)" }}>Personalise Cycle</p><h1 className="ux-screen-title mt-1 text-[34px] font-bold" style={{ color: "var(--ux-ink)" }}>Your goals and privacy</h1><p className="mt-1 text-[14px]" style={{ color: "var(--ux-muted)" }}>You decide what Cycle predicts, stores, and includes in a care summary.</p></header>
        <CycleDesktopNav active="Settings" />

        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="What are you tracking for?" sub="This changes what appears first; it does not diagnose anything.">
            <div className="grid gap-2 sm:grid-cols-2">{goals.map((goal) => {
              const I = Icons[goal.icon] as React.ComponentType<{ className?: string }>;
              const on = p?.tracking_goal === goal.value;
              return <button key={goal.value} type="button" disabled={!p || busy} onClick={() => save({ tracking_goal: goal.value })} aria-pressed={on}
                className="ux-press flex min-h-[92px] items-start gap-3 rounded-[15px] p-3 text-start" style={on ? { background: "var(--cy-predicted)", boxShadow: "inset 0 0 0 1.5px var(--cy-period)" } : { background: "var(--ux-surface-2)", border: "1px solid var(--ux-line)" }}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px]" style={{ background: "var(--ux-surface)" }}><I className="h-4 w-4" /></span><span><b className="block text-[13px]" style={{ color: "var(--ux-ink)" }}>{goal.title}</b><span className="mt-1 block text-[12px] leading-snug" style={{ color: "var(--ux-muted)" }}>{goal.sub}</span></span>
              </button>;
            })}</div>
          </Panel>

          <Panel title="Conditions you want considered" sub="Optional. Choose only diagnoses a qualified clinician has given you.">
            <div className="flex flex-wrap gap-2">{conditions.map((item) => {
              const on = p?.conditions.includes(item.value);
              return <button key={item.value} type="button" disabled={!p || busy} onClick={() => toggleCondition(item.value)} aria-pressed={on}
                className="ux-press min-h-11 rounded-full px-4 text-[13px] font-medium" style={on ? { background: "var(--cy-predicted)", color: "var(--cy-period-ink)", boxShadow: "inset 0 0 0 1.5px var(--cy-period)" } : { background: "var(--ux-surface-2)", color: "var(--ux-ink-2)", border: "1px solid var(--ux-line)" }}>{item.label}</button>;
            })}</div>
          </Panel>

          <Panel title="Prediction controls" sub="Calendar estimates improve after several complete cycles.">
            <div className="space-y-3">
              {[
                ["Period predictions", "Estimated next period dates", p?.predictions.period, "period_predictions"],
                ["Fertility window", "Estimated ovulation and fertile days", p?.predictions.fertility, "fertility_predictions"],
                ["Cycle phases", "Menstrual, follicular, ovulation and luteal", p?.predictions.phase, "phase_predictions"],
              ].map(([title, sub, on, key]) => <div key={String(key)} className="flex items-center gap-3 rounded-[14px] p-3" style={{ background: "var(--ux-surface-2)" }}><span className="min-w-0 flex-1"><b className="block text-[14px]" style={{ color: "var(--ux-ink)" }}>{String(title)}</b><span className="text-[12px]" style={{ color: "var(--ux-muted)" }}>{String(sub)}</span></span><Toggle label={String(title)} on={Boolean(on)} disabled={!p || busy} onChange={(value) => save({ [String(key)]: value })} /></div>)}
            </div>
            <p className="mt-4 flex items-start gap-2 rounded-[12px] p-3 text-[12px] leading-relaxed" style={{ background: "var(--ux-tint-amber)", color: "var(--ux-ink-2)" }}><Icons.Info className="mt-0.5 h-4 w-4 shrink-0" />Fertile-window estimates cannot confirm ovulation and must not be used as contraception.</p>
          </Panel>

          <Panel title="Care summary choices" sub="Choose what appears when you print or share your report with someone you trust.">
            <div className="space-y-3">
              {[
                ["Current phase", "share_phase", p?.care_sharing.phase],
                ["Mood pattern", "share_mood", p?.care_sharing.mood],
                ["Ways to support me", "share_support_tips", p?.care_sharing.support_tips],
              ].map(([title, key, on]) => <div key={String(key)} className="flex min-h-12 items-center gap-3 rounded-[14px] px-3" style={{ background: "var(--ux-surface-2)" }}><span className="min-w-0 flex-1 text-[14px] font-medium" style={{ color: "var(--ux-ink-2)" }}>{String(title)}</span><Toggle label={String(title)} on={Boolean(on)} disabled={!p || busy} onChange={(value) => save({ [String(key)]: value })} /></div>)}
            </div>
            <p className="mt-4 flex items-start gap-2 text-[12px] leading-relaxed" style={{ color: "var(--ux-muted)" }}><Icons.Lock className="mt-0.5 h-4 w-4 shrink-0" />Nothing is sent automatically. You choose whether to print or share the generated summary.</p>
          </Panel>
        </div>
        {error && <p role="alert" className="mt-4 rounded-[12px] p-3 text-[13px]" style={{ background: "var(--ux-danger-tint)", color: "var(--ux-danger-solid)" }}>{error}</p>}
      </div>
    </HomeShell>
  );
}
