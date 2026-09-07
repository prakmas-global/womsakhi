"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn, Card, EmptyState, I, SectionHead, Stat, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import { LATE, type Late } from "@/components/ux/haq/data";
import { LateRow } from "@/components/ux/haq/parts";

/**
 * Money that was late — and the compensation nobody claims.
 *
 * Delay compensation is a legal right attached to most public payments and it
 * is essentially never paid. In one study of 31 million wage transactions
 * across ten states, 63% of payments breached the statutory deadline and the
 * compensation owed was "neither acknowledged nor paid".
 *
 * The product is unglamorous and unambiguous: notice the lateness, compute what
 * is owed, and hand her a filled-in grievance. She sends it. Nothing here needs
 * a government integration, which is exactly why it can ship.
 */
export default function RecoverPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Late[]>(LATE);
  const [note, setNote] = useState<string | null>(null);

  const open = useMemo(() => rows.filter((l) => !l.filed), [rows]);
  const filed = useMemo(() => rows.filter((l) => l.filed), [rows]);
  const owed = useMemo(() => open.reduce((n, l) => n + l.owedMinor, 0), [open]);
  const claimed = useMemo(() => filed.reduce((n, l) => n + l.owedMinor, 0), [filed]);

  const file = useCallback((id: string) => {
    const l = rows.find((x) => x.id === id);
    setRows((r) => r.map((x) => (x.id === id ? { ...x, filed: true } : x)));
    setNote(`Grievance ready for ${l?.what}. It is filled in — read it, then send it.`);
  }, [rows]);

  const fileAll = useCallback(() => {
    setRows((r) => r.map((x) => ({ ...x, filed: true })));
    setNote(`${open.length} grievances prepared. Each one names the date, the delay and the amount.`);
  }, [open.length]);

  return (
    <HomeShell active="/app/haq">
      <div className="flex flex-col gap-5">

        <Back to="/app/haq" label="Back to Haq" />

        <header>
          <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>
            Late money
          </p>
          <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>
            They owe you for the wait
          </h1>
          <p className="mt-1.5 max-w-[56ch] text-[0.875rem] leading-relaxed" style={{ color: v("--ux-muted") }}>
            When a public payment arrives late, compensation is due by law. Almost nobody asks
            for it, because almost nobody is told. Here is yours, already worked out.
          </p>
        </header>

        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Stat value={formatRupees(owed)} label="Owed and not yet claimed"
                  icon="AlarmClock" tint="--ux-tint-orange" ink="--ux-orange-ink" />
            <Stat value={formatRupees(claimed)} label="Already claimed"
                  icon="CheckCircle2" tint="--ux-tint-green" ink="--ux-green-ink" />
          </div>
          {open.length > 1 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3.5"
                 style={{ borderColor: v("--ux-line") }}>
              <p className="flex-1 text-[0.8125rem]" style={{ color: v("--ux-ink-2") }}>
                They can all go in one letter.
              </p>
              <Btn size="sm" icon="FileText" onClick={fileAll}>Prepare all {open.length}</Btn>
            </div>
          )}
        </Card>

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-[0.8125rem] font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        <div>
          <SectionHead title="Not claimed yet" icon="AlarmClock" chip={String(open.length)} />
          {open.length === 0 ? (
            <Card>
              <EmptyState
                icon="CheckCircle2"
                title="Nothing outstanding"
                body="Every late payment has a grievance prepared. We will watch for the next one."
              />
            </Card>
          ) : (
            <div className="flex flex-col gap-2.5">
              {open.map((l) => <LateRow key={l.id} l={l} onFile={file} />)}
            </div>
          )}
        </div>

        {filed.length > 0 && (
          <div>
            <SectionHead title="Already asked for" icon="Send" chip={String(filed.length)} />
            <div className="flex flex-col gap-2.5">
              {filed.map((l) => <LateRow key={l.id} l={l} onFile={file} />)}
            </div>
          </div>
        )}
      </div>
    </HomeShell>
  );
}
