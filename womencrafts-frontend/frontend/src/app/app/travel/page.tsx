"use client";

import { useState } from "react";
import * as Icons from "@/components/ux/icons";

import { ActionBtn, Btn, Card, EmptyState, IconTile, Pill, SectionHead, SourceNote, Tabs, mapsHref } from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useGuidance, useHelplines, useRoutes } from "@/components/ux/entitlements";
import { WELLBEING_ART as RAW_WELLBEING_ART } from "@/components/ux/wellbeing/data";
import { useT } from "@/i18n";
import { ListGroup } from "@/components/ux/mobile/ListRow";
import { SegmentedControl } from "@/components/ux/mobile/SegmentedControl";
import { PhoneRow, phoneFull } from "@/components/ux/PhoneParts";
import { useTranslated } from "@/i18n/data";

/**
 * Transport & Safe Travel.
 *
 * A mela that pays well and a bus that is not safe after dark are the same
 * decision, and the app has so far only shown her half of it. Every route says
 * what it costs, how long it takes, and — the part nobody publishes — whether
 * it is safe to come back on after dark.
 */
export default function TravelPage() {
  const WELLBEING_ART = useTranslated(RAW_WELLBEING_ART);
  const tr = useT();
  const { data: ROUTES, source } = useRoutes();
  // Numbers and rules from the server, so both can be corrected — or a
  // state-specific line added — without shipping code.
  const { data: TRAVEL_HELP } = useHelplines("travel");
  const { data: TRAVEL_RULES } = useGuidance("travel");
  const [tab, setTab] = useState("Your routes");

  // Only routes somebody has actually checked and found unsafe. `!safe` would
  // sweep in every unchecked route and report a warning nobody made.
  const risky = ROUTES.filter((r) => r.safeAfterDark === false);
  const unchecked = ROUTES.filter((r) => r.safeAfterDark === null);

  return (
    <HomeShell
      rail={
        <div className="space-y-[16px]">
          {/*
            Added, not replacing anything: the rest of this screen is about
            which route to take, and this is the one thing she can do once she
            has set off.
          */}
          <Card>
            <SectionHead title={tr("ch.travel-journey.label")} icon="MapPin"
                         sub={tr("journey.subtitle")} />
            <Btn href="/app/travel/journey" icon="Play" full>
              {tr("journey.start")}
            </Btn>
          </Card>
          <Card>
            <SectionHead title={tr("travel.beforeYouSetOut")} icon="ShieldCheck" />
            <ul className="ux-stagger space-y-2.5">
              {TRAVEL_RULES.map((t, i) => (
                <li key={t.id} className="flex items-start gap-2.5 text-xsm leading-snug"
                    style={{ ["--i" as string]: i, color: "var(--ux-ink-2)" }}>
                  <Icons.Check className="mt-[2px] h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-green-ink)" }} strokeWidth={2.6} />
                  <span>
                    {t.label}
                    {t.note && <span style={{ color: "var(--ux-muted)" }}> {t.note}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <SectionHead title={tr("travel.ifSomethingHappens")} />
            <ul className="space-y-3">
              {TRAVEL_HELP.map((h) => (
                <li key={h.id}>
                  <a href={`tel:${h.num}`} className="ux-hov block text-xl font-bold leading-none tabular-nums"
                     style={{ color: "var(--ux-ink)" }}>{h.num}</a>
                  <p className="mt-1 text-xsm font-medium" style={{ color: "var(--ux-ink-2)" }}>{h.label}</p>
                  <p className="mt-0.5 text-xs" style={{ color: "var(--ux-muted)" }}>{h.note}</p>
                </li>
              ))}
            </ul>
            <div className="mt-3.5">
              <Btn href="/app/safety" variant="soft" size="sm" full iconEnd="ArrowRight">{tr("travel.safetyCentre")}</Btn>
            </div>
          </Card>

          <div className="ux-clay relative overflow-hidden p-[20px]"
               style={{ background: "linear-gradient(140deg, var(--ux-tint-blue), var(--ux-tint-lilac))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" src={WELLBEING_ART.travel} alt=""
                 className="ux-float pointer-events-none absolute -bottom-3 -end-4 h-[100px] w-[100px] object-contain" />
            <h2 className="relative w-[60%] text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("travel.shareYourJourney")}</h2>
            <p className="relative mt-2 w-[60%] text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>{tr("travel.yourTrustedContactsSeeWhereYou")}</p>
          </div>
        </div>
      }
    >
      {/* On a phone: a column — the large title, its line, then a full-width
          segmented control where the desktop has tabs. */}
      <div className="mb-6 flex flex-col gap-4 lg:mb-[20px] lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="ux-screen-title text-2xl font-bold" style={{ color: "var(--ux-ink)" }}>{tr("travel.travelAndSafety")}</h1>
          <p className="mt-1.5 text-xsm" style={{ color: "var(--ux-muted)" }}>
            {risky.length
              ? `${risky.length} of your routes is not safe to return on after dark.`
              : unchecked.length === ROUTES.length
                // Silence would read as "all clear", which is the one thing it
                // must not read as.
                ? tr("travel.nobodyHasCheckedTheseAfterDark")
              : tr("travel.allYourUsualRoutesAreFine")}
          </p>

      <SourceNote source={source} what="routes" />
        </div>
        <div className="hidden lg:flex">
          <Tabs items={["Your routes", "Getting there safely"]} active={tab} onChange={setTab} />
        </div>
        <SegmentedControl className="lg:hidden" label={tr("travel.travelAndSafety")} value={tab} onChange={setTab}
          options={["Your routes", "Getting there safely"].map((t) => ({ value: t, label: t }))} />
      </div>

      {tab === "Your routes" && (
        ROUTES.length ? (
          <>
          {/*
            On a phone the "Nobody has checked after dark" pill sat beside the
            route's name and squeezed it to 31px — "Travelling after dark"
            broke inside its own words. As rows of one grouped list the pill
            wraps under the name and both are whole.
          */}
          <ListGroup className="lg:hidden">
            {ROUTES.map((r) => (
              <PhoneRow key={r.id} icon={r.cost === "Free" ? "Footprints" : "Bus"}
                        tint={r.safeAfterDark ? "--ux-tint-green" : "--ux-tint-orange"}
                        ink={r.safeAfterDark ? "--ux-green" : "--ux-orange"}
                        title={
                          <span className="flex flex-wrap items-center gap-2">
                            {r.name}
                            <Pill tone={r.safeAfterDark === null ? "neutral" : r.safeAfterDark ? "green" : "orange"} size="sm">
                              {r.safeAfterDark === null ? "Nobody has checked after dark"
                               : r.safeAfterDark ? tr("travel.fineAfterDark") : tr("travel.notAfterDark")}
                            </Pill>
                          </span>
                        }
                        meta={[r.mins !== null ? `${r.mins} min` : null, r.cost].filter(Boolean).join(" · ")}
                        body={r.how}>
                <span className="mt-1.5 flex items-start gap-1.5 text-[13px] leading-snug"
                      style={{ color: r.safeAfterDark === false ? "var(--ux-orange-ink)" : "var(--ux-muted)" }}>
                  <Icons.Info className="mt-[2px] h-[13px] w-[13px] shrink-0" />
                  {r.note}
                </span>
                <span className="mt-3 flex flex-col gap-2">
                  <ActionBtn variant="primary" size="sm" icon="Share2" doneIcon="Check" full className={phoneFull}
                             done={tr("travel.sentToWhoeverYouChose")}
                             act={() => tellSomeone(r.name, r.how)}>{tr("travel.tellSomeoneYourRoute")}</ActionBtn>
                  <Btn href={mapsHref(r.name.split("→").pop()?.trim() ?? r.name)} variant="outline" size="sm" icon="Navigation"
                       full className={phoneFull}>Directions</Btn>
                </span>
              </PhoneRow>
            ))}
          </ListGroup>
          <div className="ux-deck ux-stagger hidden space-y-[12px] lg:block">
            {ROUTES.map((r, i) => (
              <Card key={r.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
                <div className="flex items-start gap-3.5">
                  <IconTile icon={r.cost === "Free" ? "Footprints" : "Bus"}
                            tint={r.safeAfterDark ? "--ux-tint-green" : "--ux-tint-orange"}
                            ink={r.safeAfterDark ? "--ux-green" : "--ux-orange"} size={46} radius={12} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <h2 className="min-w-0 flex-1 text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>
                        {r.name}
                      </h2>
                      {/* The part nobody publishes, said plainly — including
                          when nobody has said it. An unchecked route must not
                          borrow the confidence of a checked one. */}
                      <Pill tone={r.safeAfterDark === null ? "neutral"
                                  : r.safeAfterDark ? "green" : "orange"} size="sm">
                        {r.safeAfterDark === null ? "Nobody has checked after dark"
                         : r.safeAfterDark ? tr("travel.fineAfterDark")
              : tr("travel.notAfterDark")}
                      </Pill>
                    </div>
                    <p className="mt-1.5 text-xsm" style={{ color: "var(--ux-ink-2)" }}>{r.how}</p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-xs" style={{ color: "var(--ux-muted)" }}>
                      {r.mins !== null && (
                        <span className="inline-flex items-center gap-1"><Icons.Clock className="h-3.5 w-3.5" /> {r.mins} min</span>
                      )}
                      <span className="inline-flex items-center gap-1"><Icons.IndianRupee className="h-3.5 w-3.5" /> {r.cost}</span>
                    </p>
                    <p className="mt-2 flex items-start gap-1.5 text-xs"
                       style={{ color: r.safeAfterDark === false ? "var(--ux-orange-ink)" : "var(--ux-muted)" }}>
                      <Icons.Info className="mt-[1px] h-[13px] w-[13px] shrink-0" />
                      {r.note}
                    </p>
                  </div>
                </div>
                <div className="mt-3.5 flex items-center justify-end gap-2 border-t pt-3.5"
                     style={{ borderColor: "var(--ux-line)" }}>
                  <Btn href={mapsHref(r.name.split("→").pop()?.trim() ?? r.name)} variant="outline" size="sm" icon="Navigation">Directions</Btn>
                  {/*
                    * This said "Sunita and Meera can see where you are until you
                    * tell them you have arrived" — two invented names, and a
                    * claim nothing performed. It was the panic-button lie,
                    * intact, one screen along from where that was fixed.
                    *
                    * There is no journey-sharing in this system: no endpoint,
                    * no live location, nothing that would reach anybody. So the
                    * button now does the one thing that genuinely works —
                    * hands the route to whatever she already uses to tell
                    * people things — and the text below names nobody.
                    */}
                  <ActionBtn variant="primary" size="sm" icon="Share2" doneIcon="Check"
                             done={tr("travel.sentToWhoeverYouChose")}
                             act={() => tellSomeone(r.name, r.how)}>{tr("travel.tellSomeoneYourRoute")}</ActionBtn>
                </div>
              </Card>
            ))}
          </div>
          </>
        ) : (
          <Card>
            <EmptyState icon="Bus" title={tr("travel.noRoutesSaved")}
                        body={tr("travel.saveTheJourneysYouMakeOften")} />
          </Card>
        )
      )}

      {tab === "Getting there safely" && (
        <Card>
          {/* Counted from what the server sent, not asserted. "Four things"
              was hardcoded beside a list that is now editable, so the heading
              would have started lying the moment somebody added a fifth. */}
          <SectionHead title={`${TRAVEL_RULES.length} things, every journey`} sub={tr("travel.noneOfThemCostAnything")} />
          <ol className="ux-stagger space-y-3.5">
            {TRAVEL_RULES.map((t, i) => (
              <li key={t.id} className="flex items-start gap-3">
                <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full text-xs font-bold"
                      style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-sm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{t.label}</p>
                  {t.note && (
                    <p className="mt-0.5 text-xsm leading-snug" style={{ color: "var(--ux-muted)" }}>{t.note}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex items-center gap-3 rounded-[12px] p-3.5" style={{ background: "var(--ux-surface-2)" }}>
            <Icons.Siren className="h-[18px] w-[18px] shrink-0" style={{ color: "var(--ux-orange-ink)" }} />
            <p className="min-w-0 flex-1 text-xsm" style={{ color: "var(--ux-ink-2)" }}>
              The safety alert works anywhere, including mid-journey. Press and hold and your contacts get
              where you are.
            </p>
            <Btn href="/app/safety" variant="soft" size="sm">Safety</Btn>
          </div>
        </Card>
      )}
    </HomeShell>
  );
}

/**
 * Hand the route to whatever she already uses to tell people things.
 *
 * The share sheet on a phone, the clipboard on a laptop. Both are real; a
 * button that claims to notify two named women, when nothing in this system
 * can, is not.
 */
async function tellSomeone(route: string, how: string): Promise<string | void> {
  const text = `I am travelling: ${route}. ${how}`.trim();
  const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
  if (nav.share) {
    try {
      await nav.share({ text });
      return "Sent";
    } catch {
      // She closed the sheet. Not a failure, and not a success either.
      return "Not sent";
    }
  }
  await navigator.clipboard.writeText(text);
  return "Copied — paste it to whoever you want";
}
