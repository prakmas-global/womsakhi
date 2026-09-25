"use client";

import { useRouter } from "next/navigation";
import { useT } from "@/i18n";
import { useEffect, useState } from "react";

import * as Icons from "@/components/ux/icons";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Column, CycleHeader, CyButton, DeskTitle, ErrorLine, Icon } from "@/components/ux/cycle/parts";
import { SYMPTOMS as RAW_SYMPTOMS } from "@/components/ux/cycle/data";
import { useCycle } from "@/components/ux/cycle/use-cycle";
import { apiCycleLog, type Symptom } from "@/lib/cycle-api";
import { useTranslated } from "@/i18n/data";

/**
 * What she is feeling in her body today. Twelve tiles, any number of them;
 * "None" clears the rest, and choosing anything else clears "None".
 */
export default function Symptoms() {
  const SYMPTOMS = useTranslated(RAW_SYMPTOMS);
  const tr = useT();
  const router = useRouter();
  const { state, data, act, busy, error } = useCycle();
  const [picked, setPicked] = useState<Symptom[] | null>(null);

  useEffect(() => {
    if (data && !data.setup) router.replace("/app/health/cycle/start");
  }, [data, router]);
  // What she has tapped, or — until she taps — what she saved earlier today.
  const chosen = picked ?? state?.log?.symptoms ?? [];
  const flip = (k: Symptom) =>
    setPicked(() => {
      const cur = chosen;
      if (k === "none") return cur.includes("none") ? [] : ["none"];
      const rest = cur.filter((x) => x !== "none");
      return rest.includes(k) ? rest.filter((x) => x !== k) : [...rest, k];
    });

  const save = async () => {
    if (!state) return;
    const next = await act(() => apiCycleLog(state.today, { symptoms: chosen }));
    if (next) router.push(next.status.long_level ? "/app/health/cycle/check" : "/app/health/cycle/today");
  };

  return (
    <HomeShell immersive bare>
      <Column>
        <CycleHeader title="Symptoms" action={{ label: "Save", onClick: save, disabled: busy || !state }} />
        <DeskTitle title="Symptoms" />
        <p className="mb-4 text-[15px]" style={{ color: "var(--ux-muted)" }}>Select symptoms you&apos;re experiencing today.</p>

        <div className="grid grid-cols-3 gap-2.5">
          {SYMPTOMS.map((s) => {
            const on = chosen.includes(s.key);
            return (
              <button key={s.key} type="button" onClick={() => flip(s.key)} aria-pressed={on}
                      className="ux-press ux-tap-exempt flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-[16px] px-1.5 py-3 text-center transition-colors"
                      style={on
                        ? { background: "var(--cy-predicted)", boxShadow: "inset 0 0 0 1.5px var(--cy-period)" }
                        : { background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
                <Icon name={s.icon} className="h-[26px] w-[26px]" style={{ color: on ? "var(--cy-period)" : "var(--cy-predicted-ink)" }} />
                <span className="text-[13px] leading-tight" style={{ color: on ? "var(--ux-ink)" : "var(--ux-ink-2)", fontWeight: on ? 600 : 400 }}>
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-[16px] px-4 py-3.5"
             style={{ background: "var(--cy-predicted)", border: "1px solid var(--ux-line)" }}>
          <Icons.Sparkles className="h-5 w-5 shrink-0" style={{ color: "var(--cy-period-ink)" }} aria-hidden />
          <p className="text-[13px] leading-snug" style={{ color: "var(--ux-ink-2)" }}>
            {tr("healthCycleSymptoms.trackingHelpsUsGiveYouBetter")}
          </p>
        </div>

        <div className="mt-6">
          <CyButton onClick={save} busy={busy} disabled={!state} iconEnd={null}>Save</CyButton>
        </div>
        <ErrorLine text={error} />
      </Column>
    </HomeShell>
  );
}
