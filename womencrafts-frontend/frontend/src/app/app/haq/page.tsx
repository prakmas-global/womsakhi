"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, Chip, EmptyState, I, SectionHead, Stat, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import {
  HAQ, LATE, PAPERS,
  atRisk, atRiskMonthlyMinor, claimable, receiving, stopped,
  type Haq,
} from "@/components/ux/haq/data";
import { AtRisk, HaqRow } from "@/components/ux/haq/parts";

/**
 * Haq — everything she is owed, led by what she is about to lose.
 *
 * ── Why this screen is shaped like a warning, not a catalogue ───────────────
 * Every competitor opens with "you may be eligible for 12 schemes". The
 * randomised evidence says that framing converts almost nobody: an agent with
 * a working eligibility app in the household's doorway produced completed
 * applications from 3.6% of households, and making it free changed nothing.
 *
 * What is not solved anywhere is that women who are ALREADY receiving money
 * lose it for paperwork. So the first thing on this screen is the rupee figure
 * that stops arriving if she does nothing, and the catalogue is four scrolls
 * down where it belongs.
 */

type Filter = "all" | "risk" | "getting" | "claim";

const FILTERS: { id: Filter; label: string; icon: string }[] = [
  { id: "all", label: "Everything", icon: "LayoutGrid" },
  { id: "risk", label: "Needs you now", icon: "AlertTriangle" },
  { id: "getting", label: "Arriving", icon: "CircleCheck" },
  { id: "claim", label: "You qualify", icon: "Sparkles" },
];

export default function HaqPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");

  const risk = useMemo(() => atRisk(HAQ), []);
  const halted = useMemo(() => stopped(HAQ), []);
  const getting = useMemo(() => receiving(HAQ), []);
  const canClaim = useMemo(() => claimable(HAQ), []);

  const monthly = useMemo(() => atRiskMonthlyMinor(HAQ), []);
  const soonest = useMemo(
    () => Math.min(...risk.map((h) => h.dueDays ?? 99), 99),
    [risk],
  );

  const arriving = useMemo(
    () => getting.reduce((n, h) => (h.cadence === "every month" ? n + h.amountMinor : n), 0),
    [getting],
  );
  const owed = useMemo(() => LATE.filter((l) => !l.filed).reduce((n, l) => n + l.owedMinor, 0), []);
  const missing = useMemo(() => PAPERS.filter((p) => p.state !== "held").length, []);

  const shown: Haq[] = useMemo(() => {
    if (filter === "risk") return [...risk, ...halted];
    if (filter === "getting") return getting;
    if (filter === "claim") return canClaim;
    // Everything, in the order that matters: urgent, stopped, arriving, possible.
    return [...risk, ...halted, ...getting.filter((h) => h.status === "receiving"),
            ...HAQ.filter((h) => h.status === "waiting"), ...canClaim];
  }, [filter, risk, halted, getting, canClaim]);

  const open = useCallback((id: string) => router.push(`/app/haq/${id}`), [router]);

  return (
    <HomeShell active="/app/haq">
      <div className="flex flex-col gap-5">

        <header className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-2xs font-extrabold uppercase tracking-[0.2em]"
               style={{ color: v("--ux-brand") }}>
              Haq
            </p>
            <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
                style={{ color: v("--ux-ink") }}>
              What you are owed
            </h1>
            <p className="mt-1.5 max-w-[54ch] text-sm leading-relaxed"
               style={{ color: v("--ux-muted") }}>
              Money the government has already said is yours — and the paperwork that decides
              whether it keeps arriving.
            </p>
          </div>
          <Btn variant="outline" icon="FileText" href="/app/haq/papers">Your papers</Btn>
        </header>

        <AtRisk monthlyMinor={monthly} count={risk.length} soonestDays={soonest} />

        {/* The three numbers that matter, and nothing else. */}
        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat value={formatRupees(arriving)} label="Arriving each month"
                  icon="Wallet" tint="--ux-tint-green" ink="--ux-green-ink" />
            <Stat value={formatRupees(owed)} label="Owed to you, late"
                  icon="AlarmClock" tint="--ux-tint-orange" ink="--ux-orange-ink" />
            <Stat value={String(missing)} label="Papers to sort out"
                  icon="FileWarning" tint="--ux-tint-amber" ink="--ux-amber-ink" />
          </div>
          {owed > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3.5"
                 style={{ borderColor: v("--ux-line") }}>
              <p className="flex-1 text-xsm" style={{ color: v("--ux-ink-2") }}>
                Late payments carry compensation by law. Almost nobody claims it.
              </p>
              <Btn size="sm" variant="soft" href="/app/haq/recover">Claim what is late</Btn>
            </div>
          )}
        </Card>

        <div id="deadlines" className="scroll-mt-24">
          <SectionHead
            title="Everything in your name"
            sub="Ordered by what needs you soonest"
            icon="ListChecks"
            chip={`${HAQ.length}`}
          />

          <div className="mb-3.5 flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <Chip key={f.id} icon={f.icon} selected={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}
                {f.id === "risk" && risk.length + halted.length > 0 && (
                  <span className="ml-1 rounded-full px-1.5 text-2xs font-bold"
                        style={{ background: v("--ux-danger-tint"), color: v("--ux-danger-solid") }}>
                    {risk.length + halted.length}
                  </span>
                )}
              </Chip>
            ))}
          </div>

          {shown.length === 0 ? (
            <Card>
              <EmptyState
                icon="SearchX"
                title="Nothing here right now"
                body="Try another filter. Everything you receive, and everything you qualify for, is in this list."
                action={<Btn size="sm" variant="outline" onClick={() => setFilter("all")}>Show everything</Btn>}
              />
            </Card>
          ) : (
            <div className="flex flex-col gap-2.5">
              {shown.map((h) => <HaqRow key={h.id} h={h} onOpen={open} />)}
            </div>
          )}
        </div>

        {/* The honest footer. This module is unusual in that its own evidence
            base says an app alone will not work — so it says so. */}
        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Info" className="mt-[2px] h-[16px] w-[16px] shrink-0"
               style={{ color: v("--ux-muted") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              Reminders on their own do not get money moving — going <b>with</b> someone does.
              When a benefit needs an office visit, we will offer to find a woman in your circle
              who has already been to that counter.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}
