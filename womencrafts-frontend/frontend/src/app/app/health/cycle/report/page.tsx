"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import * as Icons from "@/components/ux/icons";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { CycleDesktopNav } from "@/components/ux/cycle/AdvancedDailyLog";
import { symptomLabel } from "@/components/ux/cycle/data";
import { shortDate, useCycle } from "@/components/ux/cycle/use-cycle";

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="rounded-[16px] p-4" style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line)" }}><span className="text-[12px]" style={{ color: "var(--ux-muted)" }}>{label}</span><b className="mt-1 block text-[22px]" style={{ color: "var(--ux-ink)" }}>{value}</b><span className="text-[11px]" style={{ color: "var(--ux-muted)" }}>{note}</span></div>;
}

export default function CycleReportPage() {
  const router = useRouter();
  const { state, data, error, reload } = useCycle();
  useEffect(() => { if (data && !data.setup) router.replace("/app/health/cycle/start"); }, [data, router]);
  const s = state?.status;
  const metrics = state?.health_metrics;
  const topSymptoms = Object.entries(state?.symptom_counts ?? {}).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).slice(0, 8);
  const confidence = s?.prediction_confidence === "high" ? "High" : s?.prediction_confidence === "medium" ? "Medium" : s?.prediction_confidence === "low" ? "Low" : "Still learning";

  return (
    <HomeShell immersive bare>
      <div className="mx-auto max-w-[1240px] px-5 py-7 lg:px-8 print:max-w-none print:p-0">
        <div className="print:hidden">
          <header className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-[12px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--cy-period-ink)" }}>Private health summary</p><h1 className="ux-screen-title mt-1 text-[34px] font-bold" style={{ color: "var(--ux-ink)" }}>Your cycle report</h1><p className="mt-1 text-[14px]" style={{ color: "var(--ux-muted)" }}>A clear summary for you or a clinician you choose.</p></div><button type="button" onClick={() => window.print()} className="ux-press flex min-h-12 items-center gap-2 rounded-[13px] px-5 font-semibold" style={{ background: "linear-gradient(90deg, var(--cy-period), var(--ux-fill))", color: "var(--ux-on-brand)" }}><Icons.Printer className="h-4 w-4" /> Print or save PDF</button></header>
          <CycleDesktopNav active="Report" />
        </div>

        {!state ? <div className="h-[540px] animate-pulse rounded-[24px]" style={{ background: "var(--ux-surface-2)" }} /> : <article className="rounded-[24px] p-6 print:rounded-none print:p-0" style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
          <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-5" style={{ borderColor: "var(--ux-line)" }}>
            <div><p className="text-[12px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--cy-period-ink)" }}>WomSakhi Cycle</p><h2 className="mt-1 text-[28px] font-bold" style={{ color: "var(--ux-ink)" }}>Cycle and symptom summary</h2><p className="mt-1 text-[13px]" style={{ color: "var(--ux-muted)" }}>Generated {new Date().toLocaleDateString()} from information you logged.</p></div><div className="rounded-[14px] px-4 py-3 text-end" style={{ background: "var(--cy-predicted)" }}><b className="block text-[15px]" style={{ color: "var(--cy-period-ink)" }}>{confidence} prediction confidence</b><span className="text-[11px]" style={{ color: "var(--ux-muted)" }}>{s?.measured_cycles ?? 0} measured cycles</span></div>
          </header>

          <section className="mt-5"><h2 className="mb-3 text-[18px] font-semibold">Cycle overview</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Average cycle" value={`${s?.avg_cycle ?? "—"} days`} note="Recent completed cycles" /><Metric label="Average period" value={`${s?.avg_period ?? "—"} days`} note="Recent completed periods" /><Metric label="Cycle variation" value={s?.cycle_variation == null ? "Learning" : `± ${s.cycle_variation} days`} note="Variation across recent cycles" /><Metric label="Days logged" value={String(metrics?.days_logged ?? 0)} note="During the last 90 days" /></div></section>

          <section className="mt-6 grid gap-5 lg:grid-cols-2">
            <div><h2 className="mb-3 text-[18px] font-semibold">Recent cycle history</h2><div className="overflow-hidden rounded-[14px]" style={{ border: "1px solid var(--ux-line)" }}><table className="w-full text-start text-[13px]"><thead style={{ background: "var(--ux-surface-2)" }}><tr><th className="p-3">Started</th><th className="p-3">Cycle</th><th className="p-3">Period</th></tr></thead><tbody>{state.history.slice(-8).reverse().map((h) => <tr key={h.start} style={{ borderTop: "1px solid var(--ux-line)" }}><td className="p-3 font-medium">{shortDate(h.start)}</td><td className="p-3">{h.cycle_days ? `${h.cycle_days} days` : "In progress"}</td><td className="p-3">{h.period_days} days</td></tr>)}</tbody></table>{!state.history.length && <p className="p-5 text-[13px]" style={{ color: "var(--ux-muted)" }}>No completed cycle history yet.</p>}</div></div>
            <div><h2 className="mb-3 text-[18px] font-semibold">Wellbeing averages</h2><div className="grid grid-cols-3 gap-3"><Metric label="Pain" value={metrics?.average_pain == null ? "—" : `${metrics.average_pain}/10`} note="Logged days" /><Metric label="Sleep" value={metrics?.average_sleep == null ? "—" : `${metrics.average_sleep} h`} note="Logged days" /><Metric label="Energy" value={metrics?.average_energy == null ? "—" : `${metrics.average_energy}/5`} note="Logged days" /></div><h3 className="mb-2 mt-5 text-[15px] font-semibold">Most logged symptoms</h3>{topSymptoms.length ? <div className="space-y-2">{topSymptoms.map(([key, count]) => <div key={key} className="flex items-center gap-3"><span className="min-w-[130px] text-[12px]" style={{ color: "var(--ux-ink-2)" }}>{symptomLabel(key)}</span><span className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "var(--ux-surface-2)" }}><span className="block h-full rounded-full" style={{ width: `${Math.min(100, Number(count ?? 0) * 12)}%`, background: "var(--cy-period)" }} /></span><b className="w-10 text-end text-[12px]">{count}d</b></div>)}</div> : <p className="text-[13px]" style={{ color: "var(--ux-muted)" }}>No symptom pattern yet.</p>}</div>
          </section>

          {state.profile.care_sharing.phase || state.profile.care_sharing.mood || state.profile.care_sharing.support_tips ? <section className="mt-6 rounded-[18px] p-5" style={{ background: "linear-gradient(135deg, var(--cy-predicted), var(--cy-fertile))" }}><h2 className="text-[18px] font-semibold">Care summary</h2><p className="mt-1 text-[12px]" style={{ color: "var(--ux-muted)" }}>Included because you selected it in Cycle settings.</p><div className="mt-4 grid gap-3 sm:grid-cols-3">{state.profile.care_sharing.phase && <div><b className="text-[13px]">Current phase</b><p className="mt-1 text-[13px]">{s?.phase_label || "Not enough information yet"}</p></div>}{state.profile.care_sharing.mood && <div><b className="text-[13px]">Recent mood</b><p className="mt-1 text-[13px]">{state.log?.mood || "Not logged today"}</p></div>}{state.profile.care_sharing.support_tips && <div><b className="text-[13px]">How to support me</b><p className="mt-1 text-[13px]">Ask what I need, respect rest, and avoid assuming every feeling is caused by my cycle.</p></div>}</div></section> : null}

          <section className="mt-6 rounded-[16px] p-4" style={{ background: "var(--ux-tint-amber)", border: "1px solid var(--ux-line)" }}><h2 className="flex items-center gap-2 text-[14px] font-semibold"><Icons.Stethoscope className="h-4 w-4" /> For a health appointment</h2><p className="mt-1 text-[12px] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>This report is a record of self-entered information and estimates. It is not a diagnosis. Tell a clinician about severe pain, very heavy bleeding, bleeding longer than seven days, pregnancy concerns, or symptoms that disrupt daily life.</p><Link href="/app/health/mentors" className="mt-2 inline-flex min-h-10 items-center font-semibold print:hidden" style={{ color: "var(--cy-period-ink)" }}>Find a women’s health mentor <Icons.ArrowRight className="ms-1 h-4 w-4" /></Link></section>
        </article>}
        {error && <p role="alert" className="mt-4 text-[13px]" style={{ color: "var(--ux-danger-solid)" }}>{error} <button onClick={reload} className="underline">Try again</button></p>}
      </div>
    </HomeShell>
  );
}
