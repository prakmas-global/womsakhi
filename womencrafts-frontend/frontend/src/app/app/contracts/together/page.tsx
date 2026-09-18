"use client";

import { useMemo, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { SectionLabel, Tag } from "@/components/ux/work/native";
import { Back, Card, I, plural, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import { VEHICLES, type Vehicle } from "@/components/ux/reach/data";
import { useT } from "@/i18n";

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
 *
 * ── What was a tick-list and is now a list ──────────────────────────────────
 * The registering steps used to be five tappable rows with `done` flags baked
 * into the fixture, and the first was ticked: **"Ten women who agree ✓ — you
 * have fourteen on the Rangoli bid."** There is no Rangoli bid, there are no
 * fourteen women, and nothing in this product records who has agreed to
 * anything. The header said "1 of 5 done", and tapping a row toggled a tick
 * that survived until she reloaded.
 *
 * A tick is a statement about her. Nothing here knows anything about her, so
 * nothing here ticks — the same conclusion the readiness list on
 * `/app/contracts` reached, for the same reason.
 */
export default function TogetherPage() {
  const tr = useT();
  const [pick, setPick] = useState<string>("v2");

  const chosen = useMemo(() => VEHICLES.find((x) => x.id === pick) ?? VEHICLES[0], [pick]);

  return (
    <HomeShell active="/app/contracts">
      <div className="flex flex-col gap-6 lg:gap-5">
        <Back to="/app/contracts" label={tr("contractsTogether.backToBigOrders")} />

        <header>
          <p className="text-[12px] font-extrabold uppercase tracking-[0.2em] lg:text-2xs" style={{ color: v("--ux-brand") }}>{tr("contractsTogether.biddingTogether")}</p>
          <h1 className="ux-screen-title mt-1 lg:mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>{tr("contractsTogether.whoActuallySignsIt")}</h1>
          <p className="mt-2 max-w-[58ch] text-[15px] leading-snug lg:mt-1.5 lg:text-sm lg:leading-relaxed" style={{ color: v("--ux-muted") }}>
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
              <p className="text-base font-bold" style={{ color: v("--ux-ink") }}>
                You have chosen: {chosen.name.toLowerCase()}
              </p>
              <p className="mt-1 text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                {chosen.id === "v1" && "Each of you sends your own bill. Nothing to set up — but expect most companies to say no, because one order across fourteen invoices is work their accounts department will not do."}
                {chosen.id === "v2" && "One woman's name is on the contract. She receives the whole payment and pays the rest of you. She also carries the tax, the risk and the buyer's complaint — so it should be someone who agreed to that with her eyes open, and the others should not treat it as a favour that costs her nothing."}
                {chosen.id === "v3" && "The group itself becomes the counterparty. It costs about ₹15,000 and takes around eight weeks, and it never goes away — there are filings every year. In return no single woman is personally liable, and government supply contracts reserved for such groups become possible."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Tag tone={chosen.canSign ? "green" : "neutral"} size="sm">
                  {chosen.canSign ? tr("contractsTogether.canSignAContract")
              : tr("contractsTogether.cannotSignAsAGroup")}
                </Tag>
                <Tag tone={chosen.canHoldMoney ? "green" : "neutral"} size="sm">
                  {chosen.canHoldMoney ? tr("contractsTogether.canReceiveOnePayment")
              : tr("contractsTogether.noSinglePayment")}
                </Tag>
                <Tag tone="neutral" size="sm">
                  {chosen.costMinor === 0 ? "No cost" : `About ${formatRupees(chosen.costMinor)}`}
                </Tag>
                <Tag tone="neutral" size="sm">
                  {chosen.weeks === 0 ? "Ready now" : `About ${chosen.weeks} ${plural("week", chosen.weeks)}`}
                </Tag>
              </div>
            </div>
          </div>
        </Card>

        {/*
          The steps, only when they apply — and only as a list.

          Not tappable, not ticked, not counted. Registering together is five
          real pieces of work in a fixed order, and the order is the useful
          part; whether she has done any of them is something WomSakhi has
          never asked her and does not know.
        */}
        {pick === "v3" && (
          <div>
            <SectionLabel title={tr("contractsTogether.whatRegisteringActuallyInvolves")}
                          sub="In this order, and not in a different one" icon="ListChecks" />
            <Card pad={0} style={{ overflow: "hidden" }}>
              {STEPS.map((s, i) => (
                <div key={s.what} className="flex items-start gap-3 px-4 py-4 lg:gap-3.5 lg:px-5"
                     style={{ borderTop: i === 0 ? "none" : `1px solid ${v("--ux-line")}` }}>
                  <span className="mt-[1px] grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full text-2xs font-extrabold tabular-nums"
                        style={{ background: v("--ux-surface-2"), color: v("--ux-ink-2") }}>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{s.what}</p>
                    <p className="mt-0.5 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>{s.detail}</p>
                  </div>
                </div>
              ))}
            </Card>
            <p className="mt-2 px-4 text-xs leading-relaxed lg:px-1" style={{ color: v("--ux-muted") }}>
              Nothing above is ticked because nothing above has been asked of you. WomSakhi keeps no
              record of who is in your group or how far you have got.
            </p>
          </div>
        )}

        <Card pad={16} style={{ background: v("--ux-tint-amber"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="AlertTriangle" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-amber-ink") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              <b style={{ color: v("--ux-ink") }}>{tr("contractsTogether.agreeHowTheMoneySplitsBefore")}</b>{" "}
              Not after it is delivered, and not on the strength of a conversation. This is the thing
              that ends friendships between women who were right to trust each other, and it costs
              nothing to prevent.
            </p>
          </div>
        </Card>

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Scale" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
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

/**
 * What registering together actually involves.
 *
 * General guidance about a legal process, in the order it happens — the same
 * class of thing as "Udyam is free, and online" on `/app/contracts`. There is
 * deliberately no `done` field: the fixture this replaced carried one, and the
 * screen ticked "Ten women who agree" against a bid that does not exist.
 */
const STEPS: { what: string; detail: string }[] = [
  { what: "Ten women who agree", detail: "A producer company needs at least ten. Agreeing means agreeing to the obligations, not just to the idea" },
  { what: "Decide who signs", detail: "Two or three names, not one. One name is how it ends up being one woman's company" },
  { what: "Agree how the money splits", detail: "Before the order, in writing. This is the step people skip and the one that ends friendships" },
  { what: "Register", detail: "A lawyer or a company secretary does this. Around \u20b915,000, about eight weeks" },
  { what: "One bank account in the group's name", detail: "Two signatures to take money out, so no single person can empty it" },
];

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
        <p className="text-base font-extrabold leading-tight" style={{ color: v("--ux-ink") }}>{x.name}</p>
        <span className="grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full"
              style={{ background: v(on ? "--ux-fill" : "--ux-surface-2"),
                       color: v(on ? "--ux-on-brand" : "--ux-line-strong") }}>
          <I name="Check" className="h-[11px] w-[11px]" sw={3} />
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>{x.what}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="rounded-full px-2 py-[2px] text-2xs font-bold"
              style={{ background: v("--ux-surface-2"), color: v("--ux-ink-2") }}>
          {x.costMinor === 0 ? "Free" : `about ${formatRupees(x.costMinor)}`}
        </span>
        <span className="rounded-full px-2 py-[2px] text-2xs font-bold"
              style={{ background: v("--ux-surface-2"), color: v("--ux-ink-2") }}>
          {x.weeks === 0 ? "Today" : `about ${x.weeks} wk`}
        </span>
      </div>

      <ul className="mt-3 flex flex-col gap-1.5">
        {x.good.map((g) => (
          <li key={g} className="flex items-start gap-1.5 text-xs leading-snug" style={{ color: v("--ux-ink-2") }}>
            <I name="Check" className="mt-[2px] h-[12px] w-[12px] shrink-0" style={{ color: v("--ux-green-ink") }} sw={2.8} />
            {g}
          </li>
        ))}
        {x.bad.map((b) => (
          <li key={b} className="flex items-start gap-1.5 text-xs leading-snug" style={{ color: v("--ux-muted") }}>
            <I name="Minus" className="mt-[2px] h-[12px] w-[12px] shrink-0" style={{ color: v("--ux-danger-solid") }} sw={2.8} />
            {b}
          </li>
        ))}
      </ul>
    </button>
  );
}
