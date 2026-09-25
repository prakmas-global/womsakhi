"use client";

import { use, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, EmptyState, I, IconTile, Pill, SectionHead, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import { HAQ as RAW_HAQ, PAPERS as RAW_PAPERS, STATUS_LABEL as RAW_STATUS_LABEL, STATUS_TONE as RAW_STATUS_TONE, type Paper } from "@/components/ux/haq/data";
import { ClaimSteps, CompanionCard, Countdown, useCompanionsFor } from "@/components/ux/haq/parts";
import { useResource } from "@/lib/use-resource";
import { apiHaq, apiPapers, type HaqStates, type PaperStates } from "@/lib/life-api";
import { useT } from "@/i18n";
import { useTranslated } from "@/i18n/data";

/**
 * One benefit, and the exact next thing to do about it.
 *
 * The screen is built around a single question — *what is between her and this
 * money* — and the answer is almost always one of two things: a paper she does
 * not have, or a counter she has to stand at. Both are handled here, and the
 * second one is handled by asking another woman to come along, because that is
 * the intervention arm that actually moved enrolment (+70%, against +41% for
 * help with the form alone, with the biggest gains for women with the least
 * freedom to travel).
 */

const OFFICE_FOR = (needs: string[]) =>
  needs.includes("ration") ? "Ration office"
  : needs.includes("life-cert") ? "Block office"
  : "CSC on the main road";

export default function HaqDetail({ params }: { params: Promise<{ id: string }> }) {
  const STATUS_LABEL = useTranslated(RAW_STATUS_LABEL);
  const STATUS_TONE = useTranslated(RAW_STATUS_TONE);
  const PAPER_TYPES = useTranslated(RAW_PAPERS);
  const CATALOGUE = useTranslated(RAW_HAQ);

  /* The scheme is reference; where her claim stands is hers. See /app/haq. */
  const haqState = useResource<HaqStates>(
    useCallback((sig: AbortSignal) => apiHaq(sig), []),
    { states: {}, default: "can-claim", tracked: 0 },
  );
  const paperState = useResource<PaperStates>(
    useCallback((sig: AbortSignal) => apiPapers(sig), []),
    { states: {}, default: "missing", held: 0 },
  );

  const HAQ = useMemo(() => CATALOGUE.map((x) => {
    const mine = haqState.data.states[x.id];
    if (!mine) return { ...x, status: "can-claim" as const, action: undefined, dueDays: undefined, stoppedBecause: undefined };
    return {
      ...x,
      status: mine.status,
      action: mine.action || undefined,
      dueDays: mine.due_days ?? undefined,
      stoppedBecause: mine.stopped_because || undefined,
    };
  }), [CATALOGUE, haqState.data.states]);

  const PAPERS = useMemo(() => PAPER_TYPES.map((x) => {
    const mine = paperState.data.states[x.id];
    return { ...x, state: mine?.state ?? "missing", expires: mine?.expires || undefined };
  }), [PAPER_TYPES, paperState.data.states]);
  const tr = useT();
  const { id } = use(params);
  const router = useRouter();

  const h = useMemo(() => HAQ.find((x) => x.id === id), [HAQ, id]);
  const office = useMemo(() => OFFICE_FOR(h?.needs ?? []), [h]);
  const companions = useCompanionsFor(office);

  const needed: Paper[] = useMemo(
    () => (h?.needs ?? []).map((n) => PAPERS.find((p) => p.id === n)).filter(Boolean) as Paper[],
    [h, PAPERS],
  );
  const blocking = useMemo(() => needed.filter((p) => p.state !== "held"), [needed]);

  const [companion, setCompanion] = useState<string | null>(null);
  const [asked, setAsked] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const ask = useCallback(() => {
    setAsked(true);
    const who = companions.find((c) => c.id === companion);
    setNote(`Asked ${who?.name ?? "her"} to come with you. She will see it in her circle.`);
  }, [companion, companions]);

  if (!h) {
    return (
      <HomeShell active="/app/haq">
        <Card>
          <EmptyState
            icon="SearchX"
            title={tr("haq.thatIsNotOneOfYours")}
            body={tr("haq.thisBenefitIsNotInYour")}
            action={<Btn size="sm" href="/app/haq">{tr("haq.backToHaq")}</Btn>}
          />
        </Card>
      </HomeShell>
    );
  }

  const tone = STATUS_TONE[h.status];
  // Where she is: papers → companion → office → waiting → arriving.
  const step =
    h.status === "receiving" ? 4
    : h.status === "waiting" ? 3
    : blocking.length > 0 ? 0
    : asked ? 2 : 1;

  return (
    <HomeShell active="/app/haq">
      <div className="flex flex-col gap-5">

        <Link href={"/app/haq"}
                className="ux-press inline-flex w-fit items-center gap-1.5 text-xsm font-semibold"
                style={{ color: v("--ux-muted") }}>
          <I name="ArrowLeft" className="h-[15px] w-[15px]" />{tr("haq.allOfYourHaq")}</Link>

        {/* Header */}
        <Card pad={0} style={{ overflow: "hidden" }}>
          <div className="flex items-start gap-4 p-5" style={{ background: v(h.tint) }}>
            <IconTile icon={h.icon} tint="--ux-surface" ink={h.ink} size={52} radius={14} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[clamp(1.25rem,2.6vw,1.625rem)] font-extrabold leading-tight tracking-[-0.03em]"
                    style={{ color: v("--ux-ink") }}>{h.name}</h1>
                <span className="rounded-full px-2.5 py-[3px] text-2xs font-bold uppercase tracking-[0.07em]"
                      style={{ background: v("--ux-surface"), color: v(tone.ink) }}>
                  {STATUS_LABEL[h.status]}
                </span>
              </div>
              <p className="mt-1 text-xsm font-semibold" style={{ color: v("--ux-ink-2") }}>{h.body}</p>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: v("--ux-ink-2") }}>{h.gives}</p>
            </div>
            {h.amountMinor > 0 && (
              <div className="shrink-0 text-right">
                <p className="text-2xl font-extrabold leading-none tabular-nums"
                   style={{ color: v("--ux-ink") }}>{formatRupees(h.amountMinor)}</p>
                <p className="mt-1 text-2xs" style={{ color: v("--ux-ink-2") }}>{h.cadence}</p>
              </div>
            )}
          </div>
          <div className="px-5 py-4">
            <ClaimSteps step={step} />
          </div>
        </Card>

        {/* The one thing to do */}
        {(h.action || h.stoppedBecause) && (
          <Card style={{ borderColor: v(h.status === "stopped" ? "--ux-danger-solid" : "--ux-amber") }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-2xs font-extrabold uppercase tracking-[0.14em]"
                   style={{ color: v(tone.ink) }}>
                  {h.status === "stopped" ? tr("haq.whyItStopped")
              : tr("haq.whatHasToHappen")}
                </p>
                <p className="mt-1.5 text-base font-bold" style={{ color: v("--ux-ink") }}>
                  {h.action ?? "Get it started again"}
                </p>
                {h.stoppedBecause && (
                  <p className="mt-1.5 max-w-[54ch] text-xsm leading-relaxed"
                     style={{ color: v("--ux-ink-2") }}>{h.stoppedBecause}</p>
                )}
              </div>
              {typeof h.dueDays === "number" && <Countdown days={h.dueDays} />}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {h.online
                ? <Btn icon="Smartphone" onClick={() => setNote("Opening the government page. Your papers are ready to attach.")}>{tr("haq.doItOnThePhone")}</Btn>
                : <Btn icon="MapPin" onClick={() => setNote(`This one has to be done at the ${office.toLowerCase()}.`)}>{tr("haq.whereToGo")}</Btn>}
              <Btn variant="outline" icon="Bell"
                   onClick={() => setNote("We will remind you three days before, and again the day before.")}>{tr("haq.remindMe")}</Btn>
            </div>
          </Card>
        )}

        {!h.openNow && h.openNote && (
          <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
            <div className="flex items-start gap-3">
              <I name="Info" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
              <div>
                <p className="text-xsm font-bold" style={{ color: v("--ux-ink") }}>{tr("haq.notBeingDecidedRightNow")}</p>
                <p className="mt-1 text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                  {h.openNote}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Papers */}
        <div>
          <SectionHead
            title={tr("haq.whatItNeeds")}
            sub={blocking.length ? `${blocking.length} still to sort out` : "Everything is in place"}
            icon="FileText"
            action={tr("haq.allYourPapers")}
            onAction={() => router.push("/app/haq/papers")}
          />
          <div className="flex flex-col gap-2.5">
            {needed.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-[12px] border p-3"
                   style={{ borderColor: v("--ux-line"), background: v("--ux-surface") }}>
                <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full"
                      style={{
                        background: v(p.state === "held" ? "--ux-tint-green" : "--ux-danger-tint"),
                        color: v(p.state === "held" ? "--ux-green-ink" : "--ux-danger-solid"),
                      }}>
                  <I name={p.state === "held" ? "Check" : "X"} className="h-[15px] w-[15px]" sw={3} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xsm font-semibold" style={{ color: v("--ux-ink") }}>{p.name}</p>
                  <p className="text-xs" style={{ color: v("--ux-muted") }}>
                    {p.state === "held" ? p.note : `Get it from: ${p.from}`}
                  </p>
                </div>
                {p.state !== "held" && (
                  <Btn size="sm" variant="outline" href="/app/haq/papers">{tr("haq.sortIt")}</Btn>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Accompany — the arm that works */}
        {!h.online && (
          <div>
            <SectionHead
              title={tr("haq.doNotGoAlone")}
              sub={`Women in your circle who have been to the ${office.toLowerCase()}`}
              icon="Users"
            />
            <Card pad={16} style={{ background: v("--ux-brand-tint"), borderColor: "transparent" }}>
              <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>{tr("haq.fillingTheFormTogetherHelps")}<b>{tr("haq.goingWithSomeoneHelpsAlmostTwice")}</b> —
                and it helps most for women who find it hardest to travel alone.
              </p>
            </Card>
            <div className="mt-3 flex flex-col gap-2.5">
              {companions.map((c) => (
                <CompanionCard key={c.id} c={c} chosen={companion === c.id} onChoose={setCompanion} />
              ))}
            </div>
            <div className="mt-3.5 flex flex-wrap gap-2">
              <Btn icon="Send" disabled={!companion || asked} onClick={ask}>
                {asked ? "Asked" : "Ask her to come with me"}
              </Btn>
              {asked && <Pill tone="green">{tr("haq.sheHasBeenAsked")}</Pill>}
            </div>
          </div>
        )}

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}
      </div>
    </HomeShell>
  );
}
