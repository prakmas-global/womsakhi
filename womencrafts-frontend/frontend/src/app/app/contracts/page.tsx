"use client";

import { useCallback, useMemo, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Tag } from "@/components/ux/work/native";
import { Btn, Card, I, IconTile, SectionHead, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import { CONTRACTS, READINESS, type Contract } from "@/components/ux/eight/data";
import { useT } from "@/i18n";

/**
 * Big orders, and the wait for the money.
 *
 * ── Why the timeline is drawn instead of written ────────────────────────────
 * Discovery is the cheapest problem in the supplier-diversity chain and the one
 * most already solved: WEConnect International has 22,000+ certified businesses
 * against just 180+ corporate buyers, after operating since 2009. What stands
 * between a certified woman-owned micro-business and getting paid is insurance,
 * documentation, capacity — and above all **payment terms.**
 *
 * The causal evidence is unusually clean: when the US federal government
 * accelerated payments to small suppliers, employment at those suppliers went
 * up. The binding constraint was the *timing of cash*, not access to the
 * contract. "Net 90" as two words means nothing to a woman buying cloth this
 * week. Drawn as a bar with her money sitting on the far right of it, and the
 * cloth cost sitting on the far left, it means everything — so this screen
 * draws it, and puts the number of weeks she is out of pocket in words.
 */
export default function ContractsPage() {
  const tr = useT();
  const [ready, setReady] = useState(READINESS);
  const [bid, setBid] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [terms, setTerms] = useState<string | null>(null);

  const gaps = useMemo(() => ready.filter((r) => !r.done), [ready]);
  const open = useMemo(() => CONTRACTS.filter((c) => c.state !== "won"), []);
  const won = useMemo(() => CONTRACTS.filter((c) => c.state === "won"), []);

  const toggle = useCallback((id: string) => {
    setReady((r) => r.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
  }, []);

  const join = useCallback((c: Contract) => {
    setBid((b) => [...b, c.id]);
    setNote(c.needsCircle
      ? `You are in. ${c.circleSize} women are bidding together — no single woman could take this alone.`
      : "Your bid is in.");
  }, []);

  return (
    <HomeShell active="/app/contracts">
      <div className="flex flex-col gap-5">

        <header>
          <p className="text-[13px] font-extrabold uppercase tracking-[0.2em] lg:text-2xs" style={{ color: v("--ux-brand") }}>{tr("contracts.bigOrders")}</p>
          <h1 className="ux-screen-title mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>{tr("contracts.ordersTooBigForOneWoman")}</h1>
          <p className="mt-1.5 max-w-[58ch] text-[15px] leading-snug lg:text-sm lg:leading-relaxed" style={{ color: v("--ux-muted") }}>
            Companies want hundreds of pieces. Fourteen of you can make that. The catch is never the
            making — it is that they pay months later, and you buy the cloth today. Every order below
            shows you exactly how long the wait is before you agree to anything.
          </p>
        </header>

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        <div>
          <SectionHead title={tr("contracts.openRightNow")} sub={tr("contracts.theWaitIsDrawnToScale")}
                       icon="Briefcase" chip={String(open.length)} />
          <div className="flex flex-col gap-4">
            {open.map((c) => (
              <ContractCard key={c.id} c={c} gaps={gaps.length} joined={bid.includes(c.id)}
                            terms={terms} setTerms={setTerms} onJoin={() => join(c)} />
            ))}
          </div>
        </div>

        {won.length > 0 && (
          <div>
            <SectionHead title={tr("contracts.yoursAlready")} icon="Trophy" />
            {won.map((c) => (
              <Card key={c.id} pad={16} style={{ borderColor: v("--ux-green-ink") }}>
                <div className="flex flex-wrap items-center gap-4">
                  <IconTile icon="Trophy" tint="--ux-tint-green" ink="--ux-green-ink" size={42} />
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold" style={{ color: v("--ux-ink") }}>{c.what}</p>
                    <p className="mt-0.5 text-xsm" style={{ color: v("--ux-muted") }}>
                      {c.buyer} · they pay in {c.paysInDays} days · yours alone
                    </p>
                  </div>
                  <p className="shrink-0 text-lg font-extrabold tabular-nums" style={{ color: v("--ux-ink") }}>
                    {formatRupees(c.valueMinor)}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Readiness — the things that actually lose bids */}
        <div>
          <SectionHead title={tr("contracts.whatBuyersAskFor")}
                       sub={gaps.length === 0 ? "You have everything" : `${gaps.length} still missing`}
                       icon="ClipboardCheck" />
          <Card pad={0} style={{ overflow: "hidden" }}>
            {ready.map((r, i) => (
              <button key={r.id} type="button" onClick={() => toggle(r.id)}
                      className="ux-press flex w-full items-center gap-3.5 px-5 py-4 text-left"
                      style={{ borderTop: i === 0 ? "none" : `1px solid ${v("--ux-line")}` }}>
                <I name={r.done ? "CheckCircle2" : "Circle"} className="h-[19px] w-[19px] shrink-0"
                   style={{ color: v(r.done ? "--ux-green-ink" : "--ux-line-strong") }} sw={2.2} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold" style={{ color: v(r.done ? "--ux-muted" : "--ux-ink") }}>
                    {r.what}
                  </p>
                  <p className="mt-0.5 text-xs" style={{ color: v("--ux-muted") }}>{r.why}</p>
                </div>
                {r.costMinor && (
                  <span className="shrink-0 text-xsm font-bold tabular-nums" style={{ color: v("--ux-ink-2") }}>
                    {formatRupees(r.costMinor)}/yr
                  </span>
                )}
              </button>
            ))}
          </Card>
        </div>

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Info" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              We do not lend you the cloth money and we do not buy your invoice — both of those turn
              a good month into a debt. What we do is show the wait honestly before you commit, split
              the order across enough women that no one of you is carrying it, and record who paid on
              time so the next order goes to a buyer who does.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}

/**
 * One order — and its cash timeline.
 *
 * Four marks: she buys material, she delivers, the wait, the money. The wait
 * segment is sized by paysInDays so a 90-day contract visibly dwarfs a 30-day
 * one. That comparison is the decision she is actually making.
 */
function ContractCard({ c, gaps, joined, terms, setTerms, onJoin }: {
  c: Contract; gaps: number; joined: boolean;
  terms: string | null; setTerms: (v: string | null) => void; onJoin: () => void;
}) {
  const tr = useT();
  const materials = Math.round(c.valueMinor * 0.3);
  const qty = Number(c.what.match(/^\d+/)?.[0] ?? 0);
  const weeks = Math.round(c.paysInDays / 7);
  const heavy = c.paysInDays >= 60;
  const waitPct = Math.min(70, 18 + c.paysInDays * 0.55);

  return (
    <Card pad={0} style={{ overflow: "hidden" }}>
      <div className="flex flex-wrap items-start gap-4 px-5 pt-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-extrabold leading-tight tracking-[-0.02em]" style={{ color: v("--ux-ink") }}>
              {c.what}
            </p>
            {c.state === "bidding" && <Tag tone="brand" size="sm">{tr("contracts.biddingNow")}</Tag>}
          </div>
          <p className="mt-1 text-xsm" style={{ color: v("--ux-muted") }}>
            {c.buyer}
            {c.needsCircle ? ` · needs ${c.circleSize} women together` : " · one woman can do this"}
          </p>
        </div>
        <p className="shrink-0 text-xl font-extrabold leading-none tabular-nums" style={{ color: v("--ux-ink") }}>
          {formatRupees(c.valueMinor)}
        </p>
      </div>

      {/* THE TIMELINE — the actual product of this screen */}
      <div className="px-5 pb-1 pt-6">
        <div className="relative h-[10px] w-full rounded-full" style={{ background: v("--ux-line") }}>
          <span className="absolute inset-y-0 left-0 rounded-l-full"
                style={{ width: "16%", background: v("--ux-brand") }} />
          <span className="absolute inset-y-0 rounded-r-full"
                style={{ left: `${100 - waitPct}%`, right: 0,
                         background: v(heavy ? "--ux-danger-solid" : "--ux-amber-ink"), opacity: 0.35 }} />
          {[
            { at: 0, label: "You buy cloth", sub: formatRupees(materials), tone: "--ux-brand" },
            { at: 100 - waitPct, label: "You deliver", sub: "Work done", tone: "--ux-ink-2" },
            { at: 100, label: "They pay", sub: formatRupees(c.valueMinor), tone: "--ux-green-ink" },
          ].map((m) => (
            <span key={m.label} className="absolute top-1/2 h-[16px] w-[16px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px]"
                  style={{ left: `${m.at}%`, background: v("--ux-surface"), borderColor: v(m.tone) }} />
          ))}
        </div>

        <div className="mt-3 flex items-start justify-between gap-2">
          <div className="text-left">
            <p className="text-xs font-bold" style={{ color: v("--ux-brand") }}>{tr("contracts.youBuyCloth")}</p>
            <p className="text-2xs tabular-nums" style={{ color: v("--ux-muted") }}>−{formatRupees(materials)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-bold" style={{ color: v("--ux-ink-2") }}>{tr("contracts.youDeliver")}</p>
            <p className="text-2xs" style={{ color: v("--ux-muted") }}>{tr("contracts.workDone")}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold" style={{ color: v("--ux-green-ink") }}>{tr("contracts.theyPay")}</p>
            <p className="text-2xs tabular-nums" style={{ color: v("--ux-muted") }}>{formatRupees(c.valueMinor)}</p>
          </div>
        </div>

        <p className="mt-3.5 flex items-start gap-2 rounded-[12px] px-3.5 py-3 text-xsm font-semibold leading-relaxed"
           style={{ background: v(heavy ? "--ux-danger-tint" : "--ux-tint-amber"),
                    color: v(heavy ? "--ux-ink" : "--ux-amber-ink") }}>
          <I name="Clock" className="mt-[1px] h-[15px] w-[15px] shrink-0" />
          <span>
            You will be out of pocket for about {weeks} weeks after you finish.
            {heavy ? " That is a long time to wait — do not take this if the cloth money is your only money." : ""}
          </span>
        </p>

        {c.missing.length > 0 && (
          <p className="mt-2 flex items-start gap-2 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>
            <I name="AlertTriangle" className="mt-[2px] h-[13px] w-[13px] shrink-0" />
            <span>They will ask for: {c.missing.join(", ").toLowerCase()}</span>
          </p>
        )}
      </div>

      {/* Who is in — faces, not a number */}
      {c.needsCircle && c.circleSize && (
        <div className="flex flex-wrap items-center gap-3 px-5 pt-4">
          <div className="flex -space-x-2">
            {Array.from({ length: Math.min(7, c.circleSize) }).map((_, i) => (
              <span key={i} className="grid h-[26px] w-[26px] place-items-center rounded-full border-2 text-2xs font-bold"
                    style={{ background: v("--ux-brand-tint-2"), color: v("--ux-brand"),
                             borderColor: v("--ux-surface") }}>
                {"PSKMRLA"[i]}
              </span>
            ))}
          </div>
          <p className="text-xs" style={{ color: v("--ux-muted") }}>
            {c.circleSize} women bidding together · {Math.ceil(qty / c.circleSize)} pieces each
          </p>
        </div>
      )}

      {/* The terms, in the words that decide whether she can afford to say yes. */}
      {terms === c.id && (
        <div className="mx-5 mt-4 rounded-[12px] p-4" style={{ background: v("--ux-surface-2") }}>
          <ul className="flex flex-col gap-2">
            {[
              `They pay ${c.paysInDays} days after you deliver, not on the day.`,
              `You buy the material yourself — about ${formatRupees(materials)} across everyone.`,
              c.needsCircle
                ? `All ${c.circleSize} of you are responsible for the whole order, not just your share.`
                : "You alone are responsible for the whole order.",
              "If they reject a piece, it comes back to whoever made it.",
              "Either side can walk away before work starts. After that, nobody can.",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2 text-xsm leading-relaxed"
                  style={{ color: v("--ux-ink-2") }}>
                <I name="Dot" className="mt-[2px] h-[0.875rem] w-[0.875rem] shrink-0" style={{ color: v("--ux-muted") }} />
                {t}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs" style={{ color: v("--ux-muted") }}>{tr("contracts.womsakhiIsNotAPartyTo")}</p>
        </div>
      )}

      {/* Stacked and full width on a phone, the wrapped row it was on desktop. */}
      <div className="mt-4 flex flex-col gap-2 border-t px-5 py-4 lg:flex-row lg:flex-wrap" style={{ borderColor: v("--ux-line") }}>
        <Btn className="ux-action-primary" disabled={joined} onClick={onJoin} icon={joined ? "Check" : undefined}>
          {joined ? "You are in" : c.needsCircle ? tr("contracts.joinTheGroupBid")
              : tr("contracts.bidForThis")}
        </Btn>
        <Btn className="ux-action-primary" variant="ghost" icon="FileText" onClick={() => setTerms(terms === c.id ? null : c.id)}>
          {terms === c.id ? tr("contracts.hideTheTerms")
              : tr("contracts.readTheFullTerms")}
        </Btn>
        {c.needsCircle && (
          <Btn className="ux-action-primary" variant="ghost" icon="FileSignature" href="/app/contracts/together">{tr("contracts.whoSignsIt")}</Btn>
        )}
        {gaps > 0 && <Tag tone="orange" size="sm">{gaps} things still missing</Tag>}
      </div>
    </Card>
  );
}
