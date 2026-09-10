"use client";

import { useCallback, useMemo, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { ReadAloud } from "@/components/ux/reach/ReadAloud";
import { Btn, Card, I, Pill, SectionHead, v } from "@/components/ux/kit";
import { HYGIENE, LICENCE_STEPS, hygieneScore, licenceDone } from "@/components/ux/eight/data";
import { useT } from "@/i18n";

/**
 * From your kitchen to a customer, legally.
 *
 * ── The hero is a number, because the number is the whole insight ───────────
 * FSSAI Basic Registration costs **₹100 a year**. It takes a home address by
 * self-declaration — no landlord NOC — plus Aadhaar and a photo, and clears in
 * about 7–30 days on FoSCoS. Every aggregator is legally required to display a
 * valid 14-digit FSSAI number, so an unlicensed home cook is simply unlistable.
 *
 * The blocker was never the licence. It was believing there was one. So the
 * screen opens with ₹100 set enormous, and the steps are drawn as a road with
 * a marker showing exactly how far along she is — not a checklist, which reads
 * as homework.
 *
 * ── What is deliberately absent: delivery ───────────────────────────────────
 * Curryful died on it, and its founder's account is that supply was never the
 * problem — customers could not tell home food from another cloud kitchen.
 * HomeFoodi survives by being direct chef-to-customer with zero platform fee
 * and tiffin subscriptions. So this ends at "sell to people who already know
 * you", and there is no fleet.
 */
export default function KitchenPage() {
  const tr = useT();
  const [steps, setSteps] = useState(LICENCE_STEPS);
  const [hyg, setHyg] = useState(HYGIENE);
  const [applied, setApplied] = useState(false);

  const done = useMemo(() => licenceDone(steps), [steps]);
  const score = useMemo(() => hygieneScore(hyg), [hyg]);
  const atStep = Math.min(done, steps.length - 1);

  const toggleStep = useCallback((id: string) => {
    setSteps((r) => r.map((s) => (s.id === id ? { ...s, done: !s.done } : s)));
  }, []);
  const toggleHyg = useCallback((id: string) => {
    setHyg((r) => r.map((h) => (h.id === id ? { ...h, done: !h.done } : h)));
  }, []);

  return (
    <HomeShell active="/app/kitchen">
      <div className="flex flex-col gap-5" id="kitchen-page">

        {/* ₹100 as the hero. The fee IS the headline. */}
        <Card pad={0} style={{ overflow: "hidden" }}>
          <div className="flex flex-wrap items-center gap-7 px-6 py-8 sm:px-9"
               style={{ background: `linear-gradient(120deg, ${v("--ux-tint-amber")}, ${v("--ux-surface")})` }}>
            <div className="min-w-0 flex-1">
              <p className="text-2xs font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-amber-ink") }}>{tr("kitchen.sellingFoodFromHome")}</p>
              <h1 className="mt-2 max-w-[18ch] text-[clamp(1.5rem,3.4vw,2.25rem)] font-extrabold leading-[1.08] tracking-[-0.035em]"
                  style={{ color: v("--ux-ink") }}>{tr("kitchen.theLicenceCostsOneHundredRupees")}</h1>
              <p className="mt-2.5 max-w-[52ch] text-sm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                A year. That is the entire fee. Your own kitchen is allowed — you write down the
                address yourself, and no landlord has to sign anything. Most women who could be
                selling food think this costs thousands.
              </p>
            </div>
            <div className="shrink-0 text-center">
              <p className="text-[clamp(3.5rem,9vw,5.75rem)] font-extrabold leading-[0.85] tracking-[-0.06em]"
                 style={{ color: v("--ux-amber-ink") }}>
                ₹100
              </p>
              <p className="mt-1.5 text-xs font-bold uppercase tracking-[0.12em]" style={{ color: v("--ux-ink-2") }}>
                for one year
              </p>
            </div>
          </div>
        </Card>

        <div><ReadAloud targetId="kitchen-page" /></div>

        {/* The road. Not a checklist — a route with her position on it. */}
        <div>
          <SectionHead title={tr("kitchen.howFarYouHaveGot")}
                       sub={`${done} of ${steps.length} done · usually 7 to 30 days from start to number`}
                       icon="Route" />

          <Card pad={0} style={{ overflow: "hidden" }}>
            {/* the track */}
            <div className="px-5 pt-6 sm:px-7">
              <div className="relative h-[6px] rounded-full" style={{ background: v("--ux-line") }}>
                <div className="absolute inset-y-0 left-0 rounded-full"
                     style={{ width: `${(done / steps.length) * 100}%`, background: v("--ux-fill"),
                              transition: "width var(--ux-t) var(--ux-ease)" }} />
                <span className="absolute top-1/2 grid h-[26px] w-[26px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
                      style={{ left: `${(done / steps.length) * 100}%`, background: v("--ux-fill"),
                               color: v("--ux-on-brand"), boxShadow: v("--ux-shadow-glow"),
                               transition: "left var(--ux-t) var(--ux-ease)" }}>
                  <I name="MapPin" className="h-[14px] w-[14px]" sw={2.4} />
                </span>
              </div>
            </div>

            <ol className="flex flex-col px-5 pb-5 pt-6 sm:px-7">
              {steps.map((s, i) => {
                const isNext = !s.done && i === atStep;
                return (
                  <li key={s.id} className="relative flex gap-4 pb-6 last:pb-0">
                    {/* connector */}
                    {i < steps.length - 1 && (
                      <span className="absolute left-[17px] top-[36px] bottom-0 w-[2px]"
                            style={{ background: v(s.done ? "--ux-fill" : "--ux-line") }} />
                    )}
                    <button type="button" onClick={() => toggleStep(s.id)}
                            aria-label={s.done ? `Undo: ${s.what}` : `Mark done: ${s.what}`}
                            className="ux-press relative z-[1] grid h-[36px] w-[36px] shrink-0 place-items-center rounded-full border-2"
                            style={{
                              background: v(s.done ? "--ux-fill" : "--ux-surface"),
                              borderColor: v(s.done ? "--ux-fill" : isNext ? "--ux-brand" : "--ux-line-strong"),
                              color: v(s.done ? "--ux-on-brand" : "--ux-muted"),
                            }}>
                      {s.done
                        ? <I name="Check" className="h-[17px] w-[17px]" sw={3} />
                        : <span className="text-xsm font-extrabold tabular-nums">{i + 1}</span>}
                    </button>

                    <div className="min-w-0 flex-1 pt-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-bold" style={{ color: v(s.done ? "--ux-muted" : "--ux-ink") }}>
                          {s.what}
                        </p>
                        {isNext && <Pill tone="brand" size="sm">{tr("kitchen.youAreHere")}</Pill>}
                        {s.needs && <Pill tone="neutral" size="sm">Needs {s.needs}</Pill>}
                      </div>
                      <p className="mt-1 max-w-[54ch] text-xsm leading-relaxed" style={{ color: v("--ux-muted") }}>
                        {s.detail}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="flex flex-wrap items-center gap-2 border-t px-5 py-4 sm:px-7"
                 style={{ borderColor: v("--ux-line") }}>
              <Btn icon="ExternalLink" disabled={applied} onClick={() => setApplied(true)}>
                {applied ? tr("kitchen.startedWeSavedYourAnswers")
              : tr("kitchen.startTheApplication")}
              </Btn>
              <Btn variant="ghost" icon="MessageCircle" href="/app/mentors">{tr("kitchen.askAWomanWhoHasDone")}</Btn>
            </div>
          </Card>
        </div>

        {applied && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{tr("kitchen.startedTheNumberUsuallyComesIn")}</p>
          </Card>
        )}

        {/* Hygiene, as a dial rather than a form */}
        <div>
          <SectionHead title={tr("kitchen.keepingTheFoodSafe")}
                       sub={tr("kitchen.notARuleFromUsThis")} icon="ShieldCheck" />
          <Card pad={20}>
            <div className="flex flex-wrap items-center gap-6">
              <div className="relative grid h-[104px] w-[104px] shrink-0 place-items-center rounded-full"
                   style={{ background: `conic-gradient(${v("--ux-green-ink")} ${score * 3.6}deg, ${v("--ux-line")} 0deg)` }}>
                <div className="grid h-[80px] w-[80px] place-items-center rounded-full"
                     style={{ background: v("--ux-surface") }}>
                  <div className="text-center">
                    <p className="text-2xl font-extrabold leading-none tabular-nums" style={{ color: v("--ux-ink") }}>
                      {score}%
                    </p>
                    <p className="text-2xs font-bold uppercase tracking-[0.1em]" style={{ color: v("--ux-muted") }}>
                      ready
                    </p>
                  </div>
                </div>
              </div>

              <ul className="grid min-w-[240px] flex-1 gap-1.5 sm:grid-cols-2">
                {hyg.map((h) => (
                  <li key={h.id}>
                    <button type="button" onClick={() => toggleHyg(h.id)}
                            className="ux-press ux-sq flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left"
                            style={{ background: v(h.done ? "--ux-tint-green" : "--ux-surface-2") }}>
                      <I name={h.done ? "CheckCircle2" : "Circle"} className="h-[15px] w-[15px] shrink-0"
                         style={{ color: v(h.done ? "--ux-green-ink" : "--ux-muted") }} sw={2.2} />
                      <span className="text-xsm font-semibold" style={{ color: v("--ux-ink-2") }}>{h.what}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Info" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              We do not deliver your food and we never will — a van between you and your customer is
              how home kitchens stop being home kitchens, and it is where every company that tried
              this lost its money. Sell to the people who already know your cooking, and to their
              neighbours. Once your number comes through you can also list on the big apps yourself,
              because they are required to show it.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}
