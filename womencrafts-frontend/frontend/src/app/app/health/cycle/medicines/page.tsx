"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import * as Icons from "@/components/ux/icons";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { CycleDesktopNav } from "@/components/ux/cycle/AdvancedDailyLog";
import { useCycle } from "@/components/ux/cycle/use-cycle";
import { apiCycleAddMedicine, apiCycleUpdateMedicine } from "@/lib/cycle-api";

const presets = ["Iron", "Folic acid", "Vitamin D", "Thyroid medicine", "Pain relief", "Birth control pill"];

export default function CycleMedicinesPage() {
  const router = useRouter();
  const { state, data, act, busy, error } = useCycle();
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [time, setTime] = useState("09:00");
  const [instructions, setInstructions] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (data && !data.setup) router.replace("/app/health/cycle/start"); }, [data, router]);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const result = await act(() => apiCycleAddMedicine({ name: name.trim(), dose: dose.trim(), times: time ? [time] : [], instructions: instructions.trim() }));
    if (result) { setName(""); setDose(""); setInstructions(""); setSaved(true); }
  };

  return (
    <HomeShell immersive bare>
      <div className="mx-auto max-w-[1240px] px-5 py-7 lg:px-8">
        <header className="mb-5">
          <p className="text-[12px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--cy-period-ink)" }}>Cycle care</p>
          <h1 className="ux-screen-title mt-1 text-[34px] font-bold" style={{ color: "var(--ux-ink)" }}>Medicines and supplements</h1>
          <p className="mt-1 text-[14px]" style={{ color: "var(--ux-muted)" }}>Keep the list you chose, then mark each dose from your daily log.</p>
        </header>
        <CycleDesktopNav active="Medicines" />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
          <section className="rounded-[22px] p-5" style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
            <div className="mb-4 flex items-center justify-between">
              <div><h2 className="text-[18px] font-semibold" style={{ color: "var(--ux-ink)" }}>Your list</h2><p className="text-[13px]" style={{ color: "var(--ux-muted)" }}>Pausing keeps its history.</p></div>
              <span className="rounded-full px-3 py-1 text-[12px] font-semibold" style={{ background: "var(--cy-predicted)", color: "var(--cy-period-ink)" }}>{state?.profile.medicines.filter((x) => x.active).length ?? 0} active</span>
            </div>
            <div className="space-y-3">
              {state?.profile.medicines.map((medicine) => (
                <article key={medicine.id} className="flex items-center gap-4 rounded-[16px] p-4" style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line)", opacity: medicine.active ? 1 : 0.62 }}>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px]" style={{ background: "var(--cy-predicted)" }}><Icons.Pill className="h-5 w-5" style={{ color: "var(--cy-period-ink)" }} /></span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[15px] font-semibold" style={{ color: "var(--ux-ink)" }}>{medicine.name}</h3>
                    <p className="text-[12px]" style={{ color: "var(--ux-muted)" }}>{[medicine.dose, medicine.times.join(", ")].filter(Boolean).join(" · ") || "No dose or time added"}</p>
                    {medicine.instructions && <p className="mt-1 text-[12px]" style={{ color: "var(--ux-ink-2)" }}>{medicine.instructions}</p>}
                  </div>
                  <button type="button" disabled={busy} onClick={() => act(() => apiCycleUpdateMedicine(medicine.id, { active: !medicine.active }))}
                          className="ux-press min-h-11 rounded-[11px] px-3 text-[12px] font-semibold" style={{ border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink-2)" }}>
                    {medicine.active ? "Pause" : "Resume"}
                  </button>
                </article>
              ))}
              {!state?.profile.medicines.length && <div className="rounded-[16px] py-14 text-center" style={{ background: "var(--ux-surface-2)" }}><Icons.Pill className="mx-auto h-7 w-7" style={{ color: "var(--cy-period-ink)" }} /><p className="mt-2 text-[14px]" style={{ color: "var(--ux-muted)" }}>Nothing added yet.</p></div>}
            </div>
          </section>

          <form onSubmit={add} className="rounded-[22px] p-5 lg:sticky lg:top-6 lg:self-start" style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)", boxShadow: "var(--ux-shadow-soft)" }}>
            <h2 className="text-[18px] font-semibold" style={{ color: "var(--ux-ink)" }}>Add a medicine</h2>
            <p className="mt-1 text-[13px]" style={{ color: "var(--ux-muted)" }}>Choose a common option or enter what your clinician prescribed.</p>
            <div className="mt-4 flex flex-wrap gap-2">{presets.map((p) => <button key={p} type="button" onClick={() => setName(p)} className="ux-press min-h-10 rounded-full px-3 text-[12px]" style={name === p ? { background: "var(--cy-predicted)", color: "var(--cy-period-ink)", boxShadow: "inset 0 0 0 1px var(--cy-period)" } : { background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>{p}</button>)}</div>
            <label className="mt-4 block"><span className="mb-1 block text-[13px] font-medium">Name</span><input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Medicine or supplement" className="h-12 w-full rounded-[12px] px-3" style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line)", color: "var(--ux-ink)" }} /></label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label><span className="mb-1 block text-[13px] font-medium">Dose</span><input maxLength={80} value={dose} onChange={(e) => setDose(e.target.value)} placeholder="e.g. 10 mg" className="h-12 w-full rounded-[12px] px-3" style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line)", color: "var(--ux-ink)" }} /></label>
              <label><span className="mb-1 block text-[13px] font-medium">Time</span><input type="time" aria-label="Medicine time" value={time} onChange={(e) => setTime(e.target.value)} className="h-12 w-full rounded-[12px] px-3" style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line)", color: "var(--ux-ink)" }} /></label>
            </div>
            <label className="mt-3 block"><span className="mb-1 block text-[13px] font-medium">Instructions</span><textarea rows={3} maxLength={240} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="With food, after breakfast…" className="w-full resize-none rounded-[12px] p-3" style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line)", color: "var(--ux-ink)" }} /></label>
            {error && <p role="alert" className="mt-3 text-[13px]" style={{ color: "var(--ux-danger-solid)" }}>{error}</p>}
            {saved && <p role="status" className="mt-3 text-[13px]" style={{ color: "var(--ux-green-ink)" }}>Added to your private list.</p>}
            <button disabled={busy || !name.trim()} className="ux-press mt-4 h-[52px] w-full rounded-[13px] font-semibold disabled:opacity-50" style={{ background: "linear-gradient(90deg, var(--cy-period), var(--ux-fill))", color: "var(--ux-on-brand)" }}>{busy ? "Adding…" : "Add medicine"}</button>
            <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed" style={{ color: "var(--ux-muted)" }}><Icons.Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />This tracker records your plan; it does not prescribe or change a dose.</p>
          </form>
        </div>
      </div>
    </HomeShell>
  );
}
