"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, I, Progress, SectionHead, Stat, v } from "@/components/ux/kit";
import { PAPERS, type Paper } from "@/components/ux/haq/data";
import { PaperRow } from "@/components/ux/haq/parts";

/**
 * Her papers — the actual binding constraint.
 *
 * Both randomised trials that raised benefit take-up named obtaining supporting
 * documents as the thing standing in the way. And the gap is sharply gendered:
 * in one rural sample PAN was held by 24.5% of household heads but **8.2% of
 * spouses**; residential certificates 28% against 9.8%. She is not short of
 * motivation. She is short of paper that costs a day's earnings to obtain.
 *
 * So this screen is sorted by **how many benefits each missing paper unlocks**,
 * not alphabetically and not by urgency — because the highest-value hour she
 * can spend is the one that fixes the document three benefits are waiting on.
 */
export default function PapersPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Paper[]>(PAPERS);
  const [note, setNote] = useState<string | null>(null);

  const held = useMemo(() => rows.filter((p) => p.state === "held").length, [rows]);
  const pct = Math.round((held / rows.length) * 100);
  const blocking = useMemo(
    () => [...rows].filter((p) => p.state !== "held").sort((a, b) => b.unlocks - a.unlocks),
    [rows],
  );
  const done = useMemo(() => rows.filter((p) => p.state === "held"), [rows]);

  const fix = useCallback((id: string) => {
    const p = rows.find((x) => x.id === id);
    setRows((r) => r.map((x) => (x.id === id ? { ...x, state: "held", note: "Just added" } : x)));
    setNote(`${p?.name} added. ${p?.unlocks} ${p?.unlocks === 1 ? "benefit is" : "benefits are"} no longer blocked.`);
  }, [rows]);

  return (
    <HomeShell active="/app/haq">
      <div className="flex flex-col gap-5">

        <button type="button" onClick={() => router.push("/app/haq")}
                className="ux-press inline-flex w-fit items-center gap-1.5 text-[0.8125rem] font-semibold"
                style={{ color: v("--ux-muted") }}>
          <I name="ArrowLeft" className="h-[15px] w-[15px]" /> Back to Haq
        </button>

        <header>
          <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>
            Your papers
          </p>
          <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>
            Sorted once, used everywhere
          </h1>
          <p className="mt-1.5 max-w-[54ch] text-[0.875rem] leading-relaxed" style={{ color: v("--ux-muted") }}>
            The same eight papers unlock nearly everything. Fix one and it counts for every
            benefit that was waiting on it.
          </p>
        </header>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Stat value={`${held} of ${rows.length}`} label="Papers in order"
                  icon="FolderCheck" tint="--ux-tint-green" ink="--ux-green-ink" />
            <p className="text-[0.8125rem] font-bold tabular-nums" style={{ color: v("--ux-brand") }}>{pct}%</p>
          </div>
          <div className="mt-3"><Progress pct={pct} /></div>
        </Card>

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-[0.8125rem] font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        {blocking.length > 0 && (
          <div>
            <SectionHead
              title="These are holding things up"
              sub="The one at the top unlocks the most"
              icon="FileWarning"
              chip={String(blocking.length)}
            />
            <div className="flex flex-col gap-2.5">
              {blocking.map((p) => <PaperRow key={p.id} p={p} onFix={fix} />)}
            </div>
          </div>
        )}

        <div>
          <SectionHead title="Safe with you" sub="Nobody else can see these" icon="Lock" chip={String(done.length)} />
          <div className="flex flex-col gap-2.5">
            {done.map((p) => <PaperRow key={p.id} p={p} onFix={fix} />)}
          </div>
        </div>

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="ShieldCheck" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              Your papers stay on your account and are never shown to anyone in your circle —
              only whether a benefit is ready to apply for. Nothing here is sent to a lender.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}
