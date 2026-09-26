"use client";

import { useCallback, useMemo, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { ReadAloud } from "@/components/ux/reach/ReadAloud";
import { Btn, Card, I, Pill, v } from "@/components/ux/kit";
import { Section } from "@/components/ux/earn/phone";
import { HYGIENE as RAW_HYGIENE, LICENCE_STEPS as RAW_LICENCE_STEPS } from "@/components/ux/eight/data";
import { useResource } from "@/lib/use-resource";
import { apiKitchen, apiKitchenHygiene, apiKitchenStep, type Kitchen } from "@/lib/life-api";
import { useT } from "@/i18n";
import { useTranslated } from "@/i18n/data";

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
  const HYGIENE = useTranslated(RAW_HYGIENE);
  const LICENCE_STEPS = useTranslated(RAW_LICENCE_STEPS);
  const tr = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  /**
   * How far she has actually got.
   *
   * The steps and the hygiene points are what the registration requires —
   * the same for everybody, and they stay with the copy. Which of them she
   * has DONE was written in too: "Aadhaar and a photo — done", "Your kitchen
   * address — done", and five of six hygiene points ticked.
   *
   * A woman who believes her FSSAI registration is half finished does not
   * start it, and selling cooked food without one is what gets a stall shut
   * down and her stock taken.
   */
  const kitchen = useResource<Kitchen>(
    useCallback((sig) => apiKitchen(sig), []),
    { done: [], hygiene: [], licence_no: "" },
  );
  const doneIds = useMemo(() => new Set(kitchen.data.done), [kitchen.data.done]);
  const hygIds = useMemo(() => new Set(kitchen.data.hygiene), [kitchen.data.hygiene]);

  // The catalogue, with her own ticks laid over it.
  const steps = useMemo(() => LICENCE_STEPS.map((x) => ({ ...x, done: doneIds.has(x.id) })), [LICENCE_STEPS, doneIds]);
  const hyg = useMemo(() => HYGIENE.map((x) => ({ ...x, done: hygIds.has(x.id) })), [HYGIENE, hygIds]);

  const done = steps.filter((x) => x.done).length;
  const score = hyg.length ? Math.round((hyg.filter((x) => x.done).length / hyg.length) * 100) : 0;
  const atStep = Math.min(done, steps.length - 1);

  /* Both of these used to flip a boolean in React state, so every tick was
     gone on reload — on a checklist whose whole purpose is remembering where
     she got to between one office visit and the next. */
  const toggleStep = useCallback(async (id: string) => {
    const now = doneIds.has(id);
    setBusy(id); setErr(null);
    try { await apiKitchenStep(id, !now); kitchen.refetch(); }
    catch { setErr("That did not save."); }
    finally { setBusy(null); }
  }, [doneIds, kitchen]);

  const toggleHyg = useCallback(async (id: string) => {
    const now = hygIds.has(id);
    setBusy(id); setErr(null);
    try { await apiKitchenHygiene(id, !now); kitchen.refetch(); }
    catch { setErr("That did not save."); }
    finally { setBusy(null); }
  }, [hygIds, kitchen]);

  return (
    <HomeShell active="/app/kitchen">
      <div className="flex flex-col gap-6 lg:gap-5" id="kitchen-page">

        {/* ₹100 as the hero. The fee IS the headline. */}
        {/* On a phone the banner stands down to a large title and the fee
            under it — no frame, no fill, no 56px figure fighting the title. */}
        <Card pad={0} style={{ overflow: "hidden" }}
              className="max-lg:overflow-visible! max-lg:rounded-none! max-lg:border-0! max-lg:bg-transparent!">
          <div className="flex flex-wrap items-center gap-4 p-0 max-lg:bg-none! lg:gap-7 lg:px-9 lg:py-8"
               style={{ background: `linear-gradient(120deg, ${v("--ux-tint-amber")}, ${v("--ux-surface")})` }}>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[color:var(--ux-muted)] lg:text-2xs lg:font-extrabold lg:tracking-[0.2em] lg:text-[color:var(--ux-amber-ink)]">{tr("kitchen.sellingFoodFromHome")}</p>
              <h1 className="ux-screen-title mt-2 max-w-[18ch] text-[clamp(1.5rem,3.4vw,2.25rem)] font-extrabold leading-[1.08] tracking-[-0.035em]"
                  style={{ color: v("--ux-ink") }}>{tr("kitchen.theLicenceCostsOneHundredRupees")}</h1>
              <p className="mt-2.5 max-w-[52ch] text-sm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                A year. That is the entire fee. Your own kitchen is allowed — you write down the
                address yourself, and no landlord has to sign anything. Most women who could be
                selling food think this costs thousands.
              </p>
            </div>
            <div className="shrink-0 text-center max-lg:flex max-lg:items-baseline max-lg:gap-2 max-lg:text-start">
              <p className="text-[28px] font-extrabold lg:text-[clamp(3.5rem,9vw,5.75rem)] leading-[0.85] tracking-[-0.06em]"
                 style={{ color: v("--ux-amber-ink") }}>
                ₹100
              </p>
              <p className="mt-1.5 text-xs font-bold uppercase tracking-[0.12em] max-lg:mt-0" style={{ color: v("--ux-ink-2") }}>
                {tr("kitchen.forOneYear")}
              </p>
            </div>
          </div>
        </Card>

        <div><ReadAloud targetId="kitchen-page" /></div>

        {/* The road. Not a checklist — a route with her position on it. */}
        <div>
          <Section title={tr("kitchen.howFarYouHaveGot")}
                       sub={`${done} of ${steps.length} done · usually 7 to 30 days from start to number`}
                       icon="Route" />

          <Card pad={0} style={{ overflow: "hidden" }}>
            {/* the track */}
            <div className="px-4 pt-6 sm:px-7">
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

            <ol className="flex flex-col px-4 pb-4 pt-6 sm:px-7 lg:pb-5">
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

            <div className="flex flex-wrap items-center gap-2 border-t p-4 sm:px-7 lg:py-4"
                 style={{ borderColor: v("--ux-line") }}>
              <Btn icon="ExternalLink" href="https://foscos.fssai.gov.in/" className="ux-action-primary">
                Open the official FSSAI application
              </Btn>
              <Btn variant="ghost" icon="MessageCircle" href="/app/mentors" className="max-lg:w-full">{tr("kitchen.askAWomanWhoHasDone")}</Btn>
            </div>
          </Card>
        </div>

        {/* Hygiene, as a dial rather than a form */}
        <div>
          <Section title={tr("kitchen.keepingTheFoodSafe")}
                       sub={tr("kitchen.notARuleFromUsThis")} icon="ShieldCheck" />
          <Card pad={20}>
            <div className="flex flex-wrap items-center gap-6 max-lg:justify-center">
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
                            className="ux-press ux-sq flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left max-lg:px-4 max-lg:py-3"
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
