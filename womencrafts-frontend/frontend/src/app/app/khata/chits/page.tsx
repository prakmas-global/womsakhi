"use client";

import { useCallback, useState } from "react";

import * as Icons from "@/components/ux/icons";
import { Btn, Card, v } from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { ScreenHead, Segments } from "@/components/ux/learning/native";
import { KhataGate } from "@/components/ux/khata/KhataGate";
import { ChitCard, SafetyCard } from "@/components/ux/khata/chits/parts";
import { useKhataLoad } from "@/components/ux/khata/chits/useKhataLoad";
import { apiChits } from "@/lib/khata-api";

/**
 * My chits — the chits she runs and the ones she pays into (backend:
 * routes/khata.py; the maths: app/core/khata.py).
 *
 * One card per chit, read at a glance: how big, how many women, what month it
 * is, and the one number that matters to her — what she still owes, or that
 * she has already taken the pot. A chit someone else keeps and linked her to
 * sits here too, marked whose it is.
 */
export default function ChitsPage() {
  return (
    <HomeShell rail={<div className="space-y-4"><SafetyCard /></div>}>
      <KhataGate><ChitList /></KhataGate>
    </HomeShell>
  );
}

function ChitList() {
  const { data, error, reload, loading } = useKhataLoad(useCallback((s: AbortSignal) => apiChits(s), []));
  const [tab, setTab] = useState("Running");
  const all = data ?? [];
  const shown = all.filter((c) => (tab === "Running" ? c.status !== "closed" : c.status === "closed"));

  return (
    <>
      <ScreenHead title="My chits" sub="Every month of every chit — who paid, and who took the pot.">
        <Btn href="/app/khata/chits/new" variant="primary" icon="Plus">Start a chit record</Btn>
      </ScreenHead>

      {all.some((c) => c.status === "closed") && (
        <div className="mb-4"><Segments items={["Running", "Closed"]} active={tab} onChange={setTab} label="Which chits" /></div>
      )}

      {error ? (
        <Card>
          <p className="text-sm" style={{ color: v("--ux-muted") }}>{error}</p>
          <div className="mt-3"><Btn size="sm" variant="outline" icon="RotateCw" onClick={reload}>Try again</Btn></div>
        </Card>
      ) : loading ? (
        <div className="grid gap-3 md:grid-cols-2">{[0, 1].map((i) => <span key={i} className="ux-skeleton h-[210px] rounded-[18px]" />)}</div>
      ) : shown.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {shown.map((c, i) => <div key={c.id} className="ux-rise" style={{ ["--i" as string]: i }}><ChitCard c={c} /></div>)}
        </div>
      ) : (
        <Card>
          <div className="flex flex-col items-center gap-2 py-5 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ux/art/course-counting-coins-calculator.webp" alt="" className="h-28 w-40 rounded-[16px] object-cover" />
            <p className="mt-1 text-base font-bold" style={{ color: v("--ux-ink") }}>
              {tab === "Closed" ? "No closed chits" : "No chits yet"}
            </p>
            <p className="max-w-[360px] text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>
              A chit is women saving together: everyone pays every month, and each month one of them takes the pot.
              Keep its record here — who paid, and who took it.
            </p>
            {tab !== "Closed" && <Btn href="/app/khata/chits/new" variant="primary" icon="Plus">Start a chit record</Btn>}
          </div>
        </Card>
      )}

      <p className="mt-4 flex items-center gap-1.5 text-2xs" style={{ color: v("--ux-faint") }}>
        <Icons.Lock className="h-3 w-3" /> Only you, and the members you link, can see a chit.
      </p>
    </>
  );
}
