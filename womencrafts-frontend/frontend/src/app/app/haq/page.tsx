"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, Chip, EmptyState, I, ScreenSkeleton, Stat, v } from "@/components/ux/kit";
import { EYEBROW, Section } from "@/components/ux/earn/phone";
import { formatRupees } from "@/components/ux/kit";
import { Select } from "@/components/ux/kit/form";
import { PAPERS as RAW_PAPERS, atRisk, atRiskMonthlyMinor, fromScheme, mayFitHer, receiving, stopped, type Haq } from "@/components/ux/haq/data";
import { AtRisk, HaqRow } from "@/components/ux/haq/parts";
import { MediaGrid } from "@/components/ux/media/MediaCard";
import { useResource } from "@/lib/use-resource";
import { apiHaq, apiLate, apiPapers, type LatePayments, type PaperStates } from "@/lib/life-api";
import { apiSaveHaqProfile, apiSchemes, type HaqStatesWithProfile, type SchemeList } from "@/lib/haq-api";
import { toast } from "@/components/ux/mobile/Toast";
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
 * that stops arriving if she does nothing, and the catalogue is below it.
 *
 * ── Where the catalogue comes from ──────────────────────────────────────────
 * The server (GET /haq/schemes?state=…), staff-managed: schemes for all of
 * India plus her state's. It used to be seven constants — Maharashtra's Ladki
 * Bahin shown to every woman in every state. Her state comes from her profile
 * and she can change it here; a few tap answers ("I am a widow", "I have a
 * daughter under ten") mark what may be for her. A scheme she has not marked
 * reads "Not checked yet" — never "you qualify".
 */

type Filter = "all" | "risk" | "getting" | "fits";

const FILTERS: { id: Filter; label: string; icon: string }[] = [
  { id: "all", label: "Everything", icon: "LayoutGrid" },
  { id: "risk", label: "Needs you now", icon: "AlertTriangle" },
  { id: "getting", label: "Arriving", icon: "CircleCheck" },
  { id: "fits", label: "May be for me", icon: "Sparkles" },
];

export default function HaqPage() {
  const PAPER_TYPES = useTranslated(RAW_PAPERS);
  const tr = useT();
  const [filter, setFilter] = useState<Filter>("all");

  const haqState = useResource<HaqStatesWithProfile>(
    useCallback((sig: AbortSignal) => apiHaq(sig) as Promise<HaqStatesWithProfile>, []),
    { states: {}, default: "unknown", tracked: 0 },
  );
  const paperState = useResource<PaperStates>(
    useCallback((sig: AbortSignal) => apiPapers(sig), []),
    { states: {}, default: "missing", held: 0 },
  );
  const lateState = useResource<LatePayments>(
    useCallback((sig: AbortSignal) => apiLate(sig), []),
    { late: [], owed_minor: 0, count: 0 },
  );

  // Her state and answers: the server's, until she changes them here.
  const profile = haqState.data.profile;
  const [state, setState] = useState<string | null>(null);
  const [tags, setTags] = useState<string[] | null>(null);
  const myState = state ?? profile?.state ?? "";
  const myTags = useMemo(() => tags ?? profile?.tags ?? [], [tags, profile]);
  const profileLoaded = haqState.source !== "loading";

  const catalogue = useResource<SchemeList | null>(
    useCallback((sig: AbortSignal) => apiSchemes(myState, sig), [myState]),
    null,
  );

  const saveProfile = useCallback(async (nextState: string, nextTags: string[]) => {
    try { await apiSaveHaqProfile(nextState, nextTags); }
    catch { toast("That did not save. Check your connection.", { tone: "error" }); }
  }, []);
  const pickState = (st: string) => { setState(st); void saveProfile(st, myTags); };
  const toggleTag = (t: string) => {
    const next = myTags.includes(t) ? myTags.filter((x) => x !== t) : [...myTags, t];
    setTags(next); void saveProfile(myState, next);
  };

  /** The catalogue with her own status laid over it. */
  const HAQ: Haq[] = useMemo(
    () => (catalogue.data?.schemes ?? []).map((sc) => fromScheme(sc, haqState.data.states[sc.key], myTags)),
    [catalogue.data, haqState.data.states, myTags],
  );

  const PAPERS = useMemo(() => PAPER_TYPES.map((x) => {
    const mine = paperState.data.states[x.id];
    return { ...x, state: mine?.state ?? "missing", expires: mine?.expires || undefined };
  }), [PAPER_TYPES, paperState.data.states]);

  const risk = useMemo(() => atRisk(HAQ), [HAQ]);
  const halted = useMemo(() => stopped(HAQ), [HAQ]);
  const getting = useMemo(() => receiving(HAQ), [HAQ]);
  const fits = useMemo(() => mayFitHer(HAQ).filter((h) => h.eligibility.length > 0), [HAQ]);

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
    if (filter === "fits") return fits;
    // Everything, in the order that matters: urgent, stopped, arriving, waiting,
    // what may be for her, then the rest.
    const seen = new Set<string>();
    return [...risk, ...halted, ...getting, ...HAQ.filter((h) => h.status === "waiting"),
            ...HAQ.filter((h) => h.status === "can-claim"), ...fits, ...HAQ]
      .filter((h) => (seen.has(h.id) ? false : (seen.add(h.id), true)));
  }, [filter, risk, halted, getting, fits, HAQ]);


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

        <AtRisk monthlyMinor={monthly} count={risk.length} soonestDays={soonest} tracked={haqState.data.tracked} />

        {/* Where she lives, and who she is — so the list is hers. */}
        <Card>
          <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
            <div>
              <p className="mb-1.5 text-xsm font-bold" style={{ color: v("--ux-ink") }}>Your state</p>
              <Select value={myState} onChange={pickState} label="Your state" placeholder="All of India only"
                      options={(catalogue.data?.states ?? []).map((x) => ({ value: x, label: x }))} />
              <p className="mt-1.5 text-2xs leading-relaxed" style={{ color: v("--ux-muted") }}>
                Schemes for all of India, plus {myState || "your state, once you pick it"}.
              </p>
            </div>
            <div>
              <p className="mb-1.5 text-xsm font-bold" style={{ color: v("--ux-ink") }}>Tap what is true for you</p>
              <div className="flex flex-wrap gap-2">
                {(catalogue.data?.eligibility ?? []).map((e) => (
                  <Chip key={e.key} selected={myTags.includes(e.key)} onClick={() => toggleTag(e.key)}>{e.label}</Chip>
                ))}
              </div>
              <p className="mt-1.5 text-2xs leading-relaxed" style={{ color: v("--ux-muted") }}>
                Kept private. It only marks which schemes may be for you — it never decides for you.
              </p>
            </div>
          </div>
        </Card>

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

          {!profileLoaded || (catalogue.source === "loading" && !catalogue.data) ? (
            <ScreenSkeleton shape="list" />
          ) : catalogue.source === "error" ? (
            <Card>
              <EmptyState icon="WifiOff" title="The list could not load" body="Check your connection and try again."
                          action={<Btn size="sm" onClick={catalogue.refetch}>Try again</Btn>} />
            </Card>
          ) : HAQ.length === 0 ? (
            <Card>
              <EmptyState icon="Landmark" title="No schemes listed yet"
                          body="Our team is adding the schemes for your state. Your papers and late payments still work below."
                          action={<Btn size="sm" variant="outline" href="/app/haq/papers">My papers</Btn>} />
            </Card>
          ) : shown.length === 0 ? (
            <Card>
              <EmptyState
                icon="SearchX"
                title={tr("haq.nothingHereRightNow")}
                body={tr("haq.tryAnotherFilterEverythingYouReceive")}
                action={<Btn size="sm" variant="outline" onClick={() => setFilter("all")}>{tr("haq.showEverything")}</Btn>}
              />
            </Card>
          ) : (
            <MediaGrid>
              {shown.map((h) => <HaqRow key={h.id} h={h} />)}
            </MediaGrid>
          )}
        </div>

        {/* The honest footer. This module is unusual in that its own evidence
            base says an app alone will not work — so it says so. */}
        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Info" className="mt-[2px] h-[16px] w-[16px] shrink-0"
               style={{ color: v("--ux-muted") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>{tr("haq.remindersOnTheirOwnDoNot")}<b>with</b> someone does.
              When a benefit needs an office visit, ask a woman from your circle to come along —{" "}
              <Link href="/app/circles" className="font-bold underline" style={{ color: v("--ux-brand") }}>open your circles</Link>.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}
