"use client";

import { useState } from "react";

import { apiStepDone } from "@/lib/entitlements-api";
import { useAction } from "@/lib/use-action";
import * as Icons from "@/components/ux/icons";

import { Btn, Card, Pill, Progress, SectionHead, SourceNote } from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { MORE_ART } from "@/components/ux/more/data";
import { useDigitalStepList } from "@/components/ux/entitlements";

/**
 * Digital Literacy.
 *
 * In order, and not skippable at random, because these build on each other:
 * there is no point teaching UPI safety to someone who cannot yet find her
 * storage settings. The last three are all about being cheated, which is what
 * members actually ask about.
 */
export default function DigitalPage() {
  const { data: DIGITAL_STEPS, source, refetch } = useDigitalStepList();
  /**
   * Which steps she has finished — from the server.
   *
   * The initialiser ran on the first render, while the steps were still on
   * their way, so it always started empty and never corrected itself. Ticking
   * one off then only changed a local array: she closed the app and the course
   * was untouched.
   */
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const isDoneStep = (st: { id: string; done: boolean }) => pending[st.id] ?? st.done;
  const done = DIGITAL_STEPS.filter(isDoneStep).map((st) => st.id);

  const mark = useAction(
    async (id: string, want: string) => { await apiStepDone(id, want === "done"); },
    {
      onDone: refetch,
      optimistic: (id, want) => setPending((p) => ({ ...p, [id]: want === "done" })),
      rollback: (id) => setPending((p) => { const n = { ...p }; delete n[id]; return n; }),
      fallbackError: "That did not save. The step is as it was — try again in a moment.",
    },
  );

  const finished = DIGITAL_STEPS.filter((s) => done.includes(s.id)).length;
  const pct = Math.round((finished / DIGITAL_STEPS.length) * 100);
  const next = DIGITAL_STEPS.find((s) => !done.includes(s.id));
  const leftMins = DIGITAL_STEPS.filter((s) => !done.includes(s.id)).reduce((a, s) => a + s.mins, 0);

  return (
    <HomeShell
      rail={
        <div className="space-y-[16px]">
          <Card>
            <SectionHead title="Where you are" sub={`${finished} of ${DIGITAL_STEPS.length} done`} />
            <div className="flex items-center gap-3">
              <Progress pct={pct} track="--ux-track" />
              <span className="shrink-0 text-[0.875rem] font-bold tabular-nums" style={{ color: "var(--ux-ink)" }}>{pct}%</span>
            </div>
            <p className="mt-2.5 text-[0.75rem] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
              About {leftMins} minutes left across everything. Fifteen minutes a day finishes it in a week.
            </p>
            {next && (
              <div className="mt-4">
                <Btn variant="primary" full iconEnd="ArrowRight"
                     onClick={() => void mark.run(next.id, "done")}>Continue: {next.label}</Btn>
              </div>
            )}
          </Card>

          <Card>
            <SectionHead title="Why the order matters" icon="Info" />
            <p className="text-[0.8125rem] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              These build on each other. There is no use learning to spot a scam message before you are
              comfortable finding a setting on your phone.
            </p>
          </Card>

          <div className="ux-clay relative overflow-hidden p-[20px]"
               style={{ background: "linear-gradient(140deg, var(--ux-tint-blue), var(--ux-tint-lilac))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" src={MORE_ART.digital} alt=""
                 className="ux-float pointer-events-none absolute -bottom-3 -end-4 h-[100px] w-[100px] object-contain" />
            <h3 className="relative w-[60%] text-[0.875rem] font-semibold" style={{ color: "var(--ux-ink)" }}>
              Nobody is born knowing this
            </h3>
            <p className="relative mt-2 w-[60%] text-[0.75rem] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
              Every step assumes you have never done it before, and nothing here is embarrassing to ask.
            </p>
          </div>
        </div>
      }
    >
      <h1 className="text-[1.5rem] font-bold" style={{ color: "var(--ux-ink)" }}>Phone basics</h1>
      <p className="mb-[20px] mt-1.5 text-[0.8125rem]" style={{ color: "var(--ux-muted)" }}>
        Six steps, in order. Each one assumes you have never done it before.
      </p>

      <SourceNote source={source} what="steps" />

      <Card>
        <ol className="relative ps-[28px]">
          <span aria-hidden className="absolute bottom-4 start-[11px] top-4 w-[2px] rounded-full"
                style={{ background: "var(--ux-line)" }} />
          {DIGITAL_STEPS.map((s, i) => {
            const isDone = done.includes(s.id);
            const isNext = next?.id === s.id;
            return (
              <li key={s.id} className="ux-rise relative pb-5 last:pb-0" style={{ ["--i" as string]: i }}>
                <span className="absolute -start-[28px] top-[2px] grid h-[23px] w-[23px] place-items-center rounded-full"
                      style={{ background: isDone ? "var(--ux-green-ink)" : isNext ? "var(--ux-brand-600)" : "var(--ux-surface)",
                               border: isDone || isNext ? "none" : "2px dashed var(--ux-line-strong)" }}>
                  {isDone
                    ? <Icons.Check className="h-[12px] w-[12px] text-white" strokeWidth={3.2} />
                    : <span className="text-[0.6875rem] font-bold" style={{ color: isNext ? "#fff" : "var(--ux-faint)" }}>{i + 1}</span>}
                </span>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="text-[0.875rem] font-semibold"
                            style={{ color: isDone || isNext ? "var(--ux-ink)" : "var(--ux-ink-2)" }}>
                        {s.label}
                      </span>
                      {isNext && <Pill tone="brand" size="sm">Next</Pill>}
                    </p>
                    <p className="mt-1 text-[0.8125rem] leading-relaxed" style={{ color: "var(--ux-muted)" }}>{s.note}</p>
                    <p className="mt-1.5 text-[0.6875rem]" style={{ color: "var(--ux-faint)" }}>{s.mins} min</p>
                  </div>
                  <Btn variant={isDone ? "outline" : isNext ? "primary" : "outline"} size="sm"
                       icon={isDone ? "RotateCcw" : undefined}
                       iconEnd={isDone ? undefined : "ArrowRight"}
                       onClick={() => void mark.run(s.id, isDone ? "undone" : "done")}>
                    {isDone ? "Again" : isNext ? "Start" : "Open"}
                  </Btn>
                </div>
              </li>
            );
          })}
        </ol>
      </Card>
    </HomeShell>
  );
}
