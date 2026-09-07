"use client";

import { use, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, EmptyState, I, IconTile, Pill, SectionHead, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import {
  HAQ, PAPERS, STATUS_LABEL, STATUS_TONE, type Paper,
} from "@/components/ux/haq/data";
import { ClaimSteps, CompanionCard, Countdown, useCompanionsFor } from "@/components/ux/haq/parts";

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
  const { id } = use(params);
  const router = useRouter();

  const h = useMemo(() => HAQ.find((x) => x.id === id), [id]);
  const office = useMemo(() => OFFICE_FOR(h?.needs ?? []), [h]);
  const companions = useCompanionsFor(office);

  const needed: Paper[] = useMemo(
    () => (h?.needs ?? []).map((n) => PAPERS.find((p) => p.id === n)).filter(Boolean) as Paper[],
    [h],
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
            title="That is not one of yours"
            body="This benefit is not in your list. It may have been renamed, or the link may be old."
            action={<Btn size="sm" href="/app/haq">Back to Haq</Btn>}
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
                className="ux-press inline-flex w-fit items-center gap-1.5 text-[0.8125rem] font-semibold"
                style={{ color: v("--ux-muted") }}>
          <I name="ArrowLeft" className="h-[15px] w-[15px]" /> All of your Haq
        </Link>

        {/* Header */}
        <Card pad={0} style={{ overflow: "hidden" }}>
          <div className="flex items-start gap-4 p-5" style={{ background: v(h.tint) }}>
            <IconTile icon={h.icon} tint="--ux-surface" ink={h.ink} size={52} radius={14} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[clamp(1.25rem,2.6vw,1.625rem)] font-extrabold leading-tight tracking-[-0.03em]"
                    style={{ color: v("--ux-ink") }}>{h.name}</h1>
                <span className="rounded-full px-2.5 py-[3px] text-[0.6875rem] font-bold uppercase tracking-[0.07em]"
                      style={{ background: v("--ux-surface"), color: v(tone.ink) }}>
                  {STATUS_LABEL[h.status]}
                </span>
              </div>
              <p className="mt-1 text-[0.8125rem] font-semibold" style={{ color: v("--ux-ink-2") }}>{h.body}</p>
              <p className="mt-2 text-[0.875rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>{h.gives}</p>
            </div>
            {h.amountMinor > 0 && (
              <div className="shrink-0 text-right">
                <p className="text-[1.5rem] font-extrabold leading-none tabular-nums"
                   style={{ color: v("--ux-ink") }}>{formatRupees(h.amountMinor)}</p>
                <p className="mt-1 text-[0.6875rem]" style={{ color: v("--ux-ink-2") }}>{h.cadence}</p>
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
                <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.14em]"
                   style={{ color: v(tone.ink) }}>
                  {h.status === "stopped" ? "Why it stopped" : "What has to happen"}
                </p>
                <p className="mt-1.5 text-[1rem] font-bold" style={{ color: v("--ux-ink") }}>
                  {h.action ?? "Get it started again"}
                </p>
                {h.stoppedBecause && (
                  <p className="mt-1.5 max-w-[54ch] text-[0.8125rem] leading-relaxed"
                     style={{ color: v("--ux-ink-2") }}>{h.stoppedBecause}</p>
                )}
              </div>
              {typeof h.dueDays === "number" && <Countdown days={h.dueDays} />}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {h.online
                ? <Btn icon="Smartphone" onClick={() => setNote("Opening the government page. Your papers are ready to attach.")}>
                    Do it on the phone
                  </Btn>
                : <Btn icon="MapPin" onClick={() => setNote(`This one has to be done at the ${office.toLowerCase()}.`)}>
                    Where to go
                  </Btn>}
              <Btn variant="outline" icon="Bell"
                   onClick={() => setNote("We will remind you three days before, and again the day before.")}>
                Remind me
              </Btn>
            </div>
          </Card>
        )}

        {!h.openNow && h.openNote && (
          <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
            <div className="flex items-start gap-3">
              <I name="Info" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
              <div>
                <p className="text-[0.8125rem] font-bold" style={{ color: v("--ux-ink") }}>
                  Not being decided right now
                </p>
                <p className="mt-1 text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                  {h.openNote}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Papers */}
        <div>
          <SectionHead
            title="What it needs"
            sub={blocking.length ? `${blocking.length} still to sort out` : "Everything is in place"}
            icon="FileText"
            action="All your papers"
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
                  <p className="text-[0.8125rem] font-semibold" style={{ color: v("--ux-ink") }}>{p.name}</p>
                  <p className="text-[0.75rem]" style={{ color: v("--ux-muted") }}>
                    {p.state === "held" ? p.note : `Get it from: ${p.from}`}
                  </p>
                </div>
                {p.state !== "held" && (
                  <Btn size="sm" variant="outline" href="/app/haq/papers">Sort it</Btn>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Accompany — the arm that works */}
        {!h.online && (
          <div>
            <SectionHead
              title="Do not go alone"
              sub={`Women in your circle who have been to the ${office.toLowerCase()}`}
              icon="Users"
            />
            <Card pad={16} style={{ background: v("--ux-brand-tint"), borderColor: "transparent" }}>
              <p className="text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                Filling the form together helps. <b>Going with someone helps almost twice as much</b> —
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
              {asked && <Pill tone="green">She has been asked</Pill>}
            </div>
          </div>
        )}

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-[0.8125rem] font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}
      </div>
    </HomeShell>
  );
}
