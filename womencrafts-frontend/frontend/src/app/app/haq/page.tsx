"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, Chip, EmptyState, I, Stat, v } from "@/components/ux/kit";
import { EYEBROW, GROUP, GROUP_ROW, Section } from "@/components/ux/earn/phone";
import { formatRupees } from "@/components/ux/kit";
import { HAQ as RAW_HAQ, PAPERS as RAW_PAPERS, atRisk, atRiskMonthlyMinor, claimable, receiving, stopped, type Haq } from "@/components/ux/haq/data";
import { AtRisk, HaqRow } from "@/components/ux/haq/parts";
import { useResource } from "@/lib/use-resource";
import { apiHaq, apiLate, apiPapers, type HaqStates, type LatePayments, type PaperStates } from "@/lib/life-api";
import { useT } from "@/i18n";
import { useTranslated } from "@/i18n/data";

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
  const CATALOGUE = useTranslated(RAW_HAQ);
  const PAPER_TYPES = useTranslated(RAW_PAPERS);
  const tr = useT();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");

  /**
   * Which schemes exist, what they pay and which papers they need is reference
   * material about real government programmes — the same for everybody, and it
   * stays with the copy above.
   *
   * Where each of HER claims stands is not. This screen used to ship with its
   * statuses written in: "Ladki Bahin · at risk · finish e-KYC · 9 days", one
   * scheme stopped, one arriving, one waiting. Five of seven papers held.
   * ₹152 owed in late payments.
   *
   * Both directions of that hurt her. Told she is *receiving* something she
   * has never had, she does not go and claim it. Told a benefit she does not
   * have is *at risk in nine days*, she queues at an office for nothing — and
   * a wasted day at a government office is a day's earnings gone.
   *
   * So an entitlement she has never touched now reads "you may be able to
   * claim this", which is the one thing that is true of everybody.
   */
  const haqState = useResource<HaqStates>(
    useCallback((sig: AbortSignal) => apiHaq(sig), []),
    { states: {}, default: "can-claim", tracked: 0 },
  );
  const paperState = useResource<PaperStates>(
    useCallback((sig: AbortSignal) => apiPapers(sig), []),
    { states: {}, default: "missing", held: 0 },
  );
  const lateState = useResource<LatePayments>(
    useCallback((sig: AbortSignal) => apiLate(sig), []),
    { late: [], owed_minor: 0, count: 0 },
  );

  /** The catalogue with her own status laid over it. */
  const HAQ: Haq[] = useMemo(() => CATALOGUE.map((h) => {
    const mine = haqState.data.states[h.id];
    if (!mine) return { ...h, status: "can-claim" as const, action: undefined, dueDays: undefined, stoppedBecause: undefined };
    return {
      ...h,
      status: mine.status,
      action: mine.action || undefined,
      // Counted on the server. Doing it here meant calling Date.now() during
      // render — impure, and the number could differ between two renders of
      // the same frame.
      dueDays: mine.due_days ?? undefined,
      stoppedBecause: mine.stopped_because || undefined,
    };
  }), [CATALOGUE, haqState.data.states]);

  const PAPERS = useMemo(() => PAPER_TYPES.map((x) => {
    const mine = paperState.data.states[x.id];
    return { ...x, state: mine?.state ?? "missing", expires: mine?.expires || undefined };
  }), [PAPER_TYPES, paperState.data.states]);

  const risk = useMemo(() => atRisk(HAQ), [HAQ]);
  const halted = useMemo(() => stopped(HAQ), [HAQ]);
  const getting = useMemo(() => receiving(HAQ), [HAQ]);
  const canClaim = useMemo(() => claimable(HAQ), [HAQ]);

  const monthly = useMemo(() => atRiskMonthlyMinor(HAQ), [HAQ]);
  // `Math.min` of an empty list is Infinity, which would render as a deadline.
  const soonest = useMemo(
    () => risk.length ? Math.min(...risk.map((h) => h.dueDays ?? 99), 99) : 99,
    [risk],
  );

  const arriving = useMemo(
    () => getting.reduce((n, h) => (h.cadence === "every month" ? n + h.amountMinor : n), 0),
    [getting],
  );
  const owed = lateState.data.owed_minor;
  const missing = useMemo(() => PAPERS.filter((p) => p.state !== "held").length, [PAPERS]);

  const shown: Haq[] = useMemo(() => {
    if (filter === "risk") return [...risk, ...halted];
    if (filter === "getting") return getting;
    if (filter === "claim") return canClaim;
    // Everything, in the order that matters: urgent, stopped, arriving, possible.
    return [...risk, ...halted, ...getting.filter((h) => h.status === "receiving"),
            ...HAQ.filter((h) => h.status === "waiting"), ...canClaim];
  }, [filter, risk, halted, getting, canClaim, HAQ]);

  const open = useCallback((id: string) => router.push(`/app/haq/${id}`), [router]);

  return (
    <HomeShell active="/app/haq">
      <div className="flex flex-col gap-6 lg:gap-5">

        <header className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1">
            <p className={EYEBROW}>
              Haq
            </p>
            <h1 className="ux-screen-title mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
                style={{ color: v("--ux-ink") }}>{tr("haq.whatYouAreOwed")}</h1>
            <p className="mt-1.5 max-w-[54ch] text-sm leading-relaxed"
               style={{ color: v("--ux-muted") }}>
              Money the government has already said is yours — and the paperwork that decides
              whether it keeps arriving.
            </p>
          </div>
          <Btn variant="outline" icon="FileText" href="/app/haq/papers" className="max-lg:w-full">{tr("haq.yourPapers")}</Btn>
        </header>

        <AtRisk monthlyMinor={monthly} count={risk.length} soonestDays={soonest} />

        {/* The three numbers that matter, and nothing else. */}
        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat value={formatRupees(arriving)} label={tr("haq.arrivingEachMonth")}
                  icon="Wallet" tint="--ux-tint-green" ink="--ux-green-ink" />
            <Stat value={formatRupees(owed)} label={tr("haq.owedToYouLate")}
                  icon="AlarmClock" tint="--ux-tint-orange" ink="--ux-orange-ink" />
            <Stat value={String(missing)} label={tr("haq.papersToSortOut")}
                  icon="FileWarning" tint="--ux-tint-amber" ink="--ux-amber-ink" />
          </div>
          {owed > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3.5"
                 style={{ borderColor: v("--ux-line") }}>
              <p className="flex-1 text-xsm" style={{ color: v("--ux-ink-2") }}>{tr("haq.latePaymentsCarryCompensationByLaw")}</p>
              <Btn size="sm" variant="soft" href="/app/haq/recover">{tr("haq.claimWhatIsLate")}</Btn>
            </div>
          )}
        </Card>

        <div id="deadlines" className="scroll-mt-24">
          <Section
            title={tr("haq.everythingInYourName")}
            sub={tr("haq.orderedByWhatNeedsYouSoonest")}
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
                title={tr("haq.nothingHereRightNow")}
                body={tr("haq.tryAnotherFilterEverythingYouReceive")}
                action={<Btn size="sm" variant="outline" onClick={() => setFilter("all")}>{tr("haq.showEverything")}</Btn>}
              />
            </Card>
          ) : (
            <div className={`flex flex-col gap-2.5 ${GROUP}`}>
              {shown.map((h) => <HaqRow key={h.id} h={h} onOpen={open} className={GROUP_ROW} />)}
            </div>
          )}
        </div>

        {/* The honest footer. This module is unusual in that its own evidence
            base says an app alone will not work — so it says so. */}
        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Info" className="mt-[2px] h-[16px] w-[16px] shrink-0"
               style={{ color: v("--ux-muted") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>{tr("haq.remindersOnTheirOwnDoNot")}<b>with</b> someone does.
              When a benefit needs an office visit, we will offer to find a woman in your circle
              who has already been to that counter.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}
