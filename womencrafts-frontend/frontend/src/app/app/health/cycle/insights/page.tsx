"use client";

import { useRouter } from "next/navigation";
import { useT } from "@/i18n";
import { useEffect, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Column, CycleHeader, DeskTitle, ErrorLine } from "@/components/ux/cycle/parts";
import { Glance, Patterns, Phases, WellnessList } from "@/components/ux/cycle/Insights";
import { useCycle } from "@/components/ux/cycle/use-cycle";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "patterns", label: "Patterns" },
  { key: "wellness", label: "Wellness" },
] as const;

/** Cycle Insights — the glance, the phases, and what her own data shows. */
export default function CycleInsights() {
  const tr = useT();
  const router = useRouter();
  const { state, data, error, reload } = useCycle();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("overview");

  useEffect(() => {
    if (data && !data.setup) router.replace("/app/health/cycle/start");
  }, [data, router]);

  return (
    <HomeShell immersive bare>
      <Column>
        <CycleHeader title={tr("healthCycle.cycleInsights")} />
        <DeskTitle title={tr("healthCycle.cycleInsights")} sub={tr("healthCycleInsights.workedOutFromWhatYouHave")} />

        <div role="tablist" aria-label="Insights" className="grid grid-cols-3 gap-1 rounded-full p-1"
             style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
          {TABS.map((t) => {
            const on = t.key === tab;
            return (
              <button key={t.key} type="button" role="tab" aria-selected={on} onClick={() => setTab(t.key)}
                      className="ux-tap-exempt h-[40px] rounded-full text-[13px]"
                      style={on ? { background: "linear-gradient(90deg, var(--cy-period), var(--ux-fill))", color: "var(--ux-on-brand)", fontWeight: 600 }
                                : { color: "var(--ux-ink-2)" }}>
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          {!state ? (
            error ? <ErrorLine text={error} onRetry={reload} />
              : <div className="h-[320px] animate-pulse rounded-[20px]" style={{ background: "var(--ux-surface-2)" }} />
          ) : tab === "overview" ? (
            <div className="space-y-3"><Glance s={state} /><Phases s={state} /></div>
          ) : tab === "patterns" ? (
            <Patterns s={state} />
          ) : (
            <WellnessList s={state} />
          )}
        </div>
      </Column>
    </HomeShell>
  );
}
