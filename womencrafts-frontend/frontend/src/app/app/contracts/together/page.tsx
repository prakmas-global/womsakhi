"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, I, Pill, SectionHead, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import { GROUP_STEPS, VEHICLES, type Vehicle } from "@/components/ux/reach/data";

/**
 * Something that can sign — the counterparty consortium bidding assumed.
 *
 * ── The hole this fills is in a module already shipped ──────────────────────
 * Fourteen women can share a 300-piece order. But no company signs a contract
 * with fourteen individuals, and no accounts department makes fourteen
 * payments. The readiness list covered *her own* Udyam registration and stopped
 * there, so the group had no body a buyer could contract with at all.
 *
 * WEConnect International has 22,000+ certified women-owned businesses against
 * just 180+ corporate buyers, after operating since 2009 — certification was
 * never the constraint. Being payable is.
 *
 * ── Why it is drawn as a comparison, not a wizard ───────────────────────────
 * There is no right answer here, and a wizard implies there is. Registering
 * costs real money and creates permanent filing obligations; letting one woman
 * lead puts the whole tax bill, the whole risk and the buyer's anger on her.
 * Both are defensible. So the three options sit side by side with what each one
 * costs and what each one does TO you, and she chooses.
 *
 * The one thing stated as advice rather than option: agree the money split
 * before the order, in writing. That is not a legal point.
 */
export default function TogetherPage() {
  const router = useRouter();
  const [pick, setPick] = useState<string>("v2");
  const [steps, setSteps] = useState(GROUP_STEPS);

  const chosen = useMemo(() => VEHICLES.find((x) => x.id === pick) ?? VEHICLES[0], [pick]);
  const doneCount = useMemo(() => steps.filter((s) => s.done).length, [steps]);

  const toggle = useCallback((id: string) => {
    setSteps((r) => r.map((s) => (s.id === id ? { ...s, done: !s.done } : s)));
  }, []);

  return (
    <HomeShell active="/app/contracts">
      <div className="flex flex-col gap-5">
        <Link href={"/app/contracts"}
                className="ux-press inline-flex w-fit items-center gap-1.5 text-[0.8125rem] font-semibold"
                style={{ color: v("--ux-muted") }}>
          <I name="ArrowLeft" className="h-[15px] w-[15px]" /> Back to big orders
        </Link>

        <header>
          <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>
            Bidding together
          </p>
          <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>
            Who actually signs it?
          </h1>
          <p className="mt-1.5 max-w-[58ch] text-[0.875rem] leading-relaxed" style={{ color: v("--ux-muted") }}>
            Fourteen of you can make three hundred covers. But a company will not sign a contract
            with fourteen people, and will not send fourteen payments. Somebody, or something, has
            to be the name on the paper. There are three ways to do it and none of them is free.
          </p>
        </header>

        {/* The three, compared. */}
        <div className="grid gap-3 lg:grid-cols-3">
          {VEHICLES.map((x) => <Option key={x.id} x={x} on={pick === x.id} onPick={() => setPick(x.id)} />)}
        </div>

        {/* What the chosen one means, spelled out */}
        <Card pad={20} style={{ borderColor: v("--ux-brand") }}>
          <div className="flex flex-wrap items-start gap-4">
            <span className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-[12px]"
                  style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
              <I name="FileSignature" className="h-[20px] w-[20px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[1rem] font-bold" style={{ color: v("--ux-ink") }}>
                You have chosen: {chosen.name.toLowerCase()}
              </p>
              <p className="mt-1 text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                {chosen.id === "v1" && "Each of you sends your own bill. Nothing to set up — but expect most companies to say no, because one order across fourteen invoices is work their accounts department will not do."}
                {chosen.id === "v2" && "One woman's name is on the contract. She receives the whole payment and pays the rest of you. She also carries the tax, the risk and the buyer's complaint — so it should be someone who agreed to that with her eyes open, and the others should not treat it as a favour that costs her nothing."}
                {chosen.id === "v3" && "The group itself becomes the counterparty. It costs about ₹15,000 and takes around eight weeks, and it never goes away — there are filings every year. In return no single woman is personally liable, and government supply contracts reserved for such groups become possible."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Pill tone={chosen.canSign ? "green" : "neutral"} size="sm">
                  {chosen.canSign ? "Can sign a contract" : "Cannot sign as a group"}
                </Pill>
                <Pill tone={chosen.canHoldMoney ? "green" : "neutral"} size="sm">
                  {chosen.canHoldMoney ? "Can receive one payment" : "No single payment"}
                </Pill>
                <Pill tone="neutral" size="sm">
                  {chosen.costMinor === 0 ? "No cost" : formatRupees(chosen.costMinor)}
                </Pill>
                <Pill tone="neutral" size="sm">
                  {chosen.weeks === 0 ? "Ready now" : `About ${chosen.weeks} weeks`}
                </Pill>
              </div>
            </div>
          </div>
        </Card>

        {/* The steps, only when they apply */}
        {pick === "v3" && (
          <div>
            <SectionHead title="What registering actually involves"
                         sub={`${doneCount} of ${steps.length} done`} icon="ListChecks" />
            <Card pad={0} style={{ overflow: "hidden" }}>
              {steps.map((s, i) => (
                <button key={s.id} type="button" onClick={() => toggle(s.id)}
                        className="ux-press flex w-full items-center gap-3.5 px-5 py-4 text-left"
                        style={{ borderTop: i === 0 ? "none" : `1px solid ${v("--ux-line")}` }}>
                  <I name={s.done ? "CheckCircle2" : "Circle"} className="h-[19px] w-[19px] shrink-0"
                     style={{ color: v(s.done ? "--ux-green-ink" : "--ux-line-strong") }} sw={2.2} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.875rem] font-bold" style={{ color: v(s.done ? "--ux-muted" : "--ux-ink") }}>
                      {s.what}
                    </p>
                    <p className="mt-0.5 text-[0.75rem]" style={{ color: v("--ux-muted") }}>{s.detail}</p>
                  </div>
                </button>
              ))}
            </Card>
          </div>
        )}

        <Card pad={16} style={{ background: v("--ux-tint-amber"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="AlertTriangle" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-amber-ink") }} />
            <p className="text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              <b style={{ color: v("--ux-ink") }}>Agree how the money splits before the order, in writing.</b>{" "}
              Not after it is delivered, and not on the strength of a conversation. This is the thing
              that ends friendships between women who were right to trust each other, and it costs
              nothing to prevent.
            </p>
          </div>
        </Card>

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Scale" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              This is not legal advice and WomSakhi is not a party to anything you sign. Registering
              a company is done by a lawyer or a company secretary — we can point you to one your
              circle has used, and that is all.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}

function Option({ x, on, onPick }: { x: Vehicle; on: boolean; onPick: () => void }) {
  return (
    <button type="button" onClick={onPick} aria-pressed={on}
            className="ux-press ux-sq flex flex-col rounded-[var(--ux-r-card)] border p-4 text-left"
            style={{
              borderColor: v(on ? "--ux-brand" : "--ux-line"),
              background: v(on ? "--ux-brand-tint" : "--ux-surface"),
              borderWidth: on ? 2 : 1,
            }}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[1rem] font-extrabold leading-tight" style={{ color: v("--ux-ink") }}>{x.name}</p>
        <span className="grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full"
              style={{ background: v(on ? "--ux-fill" : "--ux-surface-2"),
                       color: v(on ? "--ux-on-brand" : "--ux-line-strong") }}>
          <I name="Check" className="h-[11px] w-[11px]" sw={3} />
        </span>
      </div>
      <p className="mt-1 text-[0.75rem] leading-relaxed" style={{ color: v("--ux-muted") }}>{x.what}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="rounded-full px-2 py-[2px] text-[0.6875rem] font-bold"
              style={{ background: v("--ux-surface-2"), color: v("--ux-ink-2") }}>
          {x.costMinor === 0 ? "Free" : formatRupees(x.costMinor)}
        </span>
        <span className="rounded-full px-2 py-[2px] text-[0.6875rem] font-bold"
              style={{ background: v("--ux-surface-2"), color: v("--ux-ink-2") }}>
          {x.weeks === 0 ? "Today" : `${x.weeks} wk`}
        </span>
      </div>

      <ul className="mt-3 flex flex-col gap-1.5">
        {x.good.map((g) => (
          <li key={g} className="flex items-start gap-1.5 text-[0.75rem] leading-snug" style={{ color: v("--ux-ink-2") }}>
            <I name="Check" className="mt-[2px] h-[12px] w-[12px] shrink-0" style={{ color: v("--ux-green-ink") }} sw={2.8} />
            {g}
          </li>
        ))}
        {x.bad.map((b) => (
          <li key={b} className="flex items-start gap-1.5 text-[0.75rem] leading-snug" style={{ color: v("--ux-muted") }}>
            <I name="Minus" className="mt-[2px] h-[12px] w-[12px] shrink-0" style={{ color: v("--ux-danger-solid") }} sw={2.8} />
            {b}
          </li>
        ))}
      </ul>
    </button>
  );
}
