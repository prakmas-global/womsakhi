"use client";

import { useState } from "react";
import * as Icons from "@/components/ux/icons";

import {
  Btn, Card, EmptyState, IconTile, Pill,
  SectionHead, SourceNote, Tabs, mapsHref
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useCreches, useGuidance } from "@/components/ux/entitlements";
import { WELLBEING_ART as RAW_WELLBEING_ART } from "@/components/ux/wellbeing/data";
import { useT } from "@/i18n";
import { ListGroup } from "@/components/ux/mobile/ListRow";
import { SegmentedControl } from "@/components/ux/mobile/SegmentedControl";
import { PhoneRow } from "@/components/ux/PhoneParts";
import { useTranslated } from "@/i18n/data";

/**
 * Family & Childcare.
 *
 * Childcare is the single most common reason a member stops earning, and the
 * most common reason she never starts. So the first thing on this screen is
 * what is FREE and how far away it is — an Anganwadi 800 metres away that most
 * women do not know they are entitled to beats any advice about time management.
 */
const FAMILY_TINTS = [
  ["--ux-tint-pink", "--ux-pink"],
  ["--ux-tint-violet", "--ux-violet"],
  ["--ux-tint-blue", "--ux-blue"],
  ["--ux-tint-green", "--ux-green"],
] as const;

export default function FamilyPage() {
  const WELLBEING_ART = useTranslated(RAW_WELLBEING_ART);
  const tr = useT();
  const { data: CRECHES, source } = useCreches();
  // Editorial, from the server, so it can be corrected and translated.
  const { data: FAMILY_HELP } = useGuidance("family");
  const [tab, setTab] = useState("Childcare near you");
  const free = CRECHES.filter((c) => c.fee === "Free").length;

  return (
    <HomeShell
      rail={
        <div className="space-y-[16px]">
          <Card>
            <SectionHead title={tr("family.whatYouAreEntitledTo")} icon="Baby" />
            <p className="text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              Every ward in India has an Anganwadi centre. Childcare, a hot meal and immunisation for
              under-sixes, free, whatever you earn. Most women do not know theirs exists.
            </p>
            <div className="mt-3.5">
              <Btn href={mapsHref("Anganwadi centre near me")} variant="soft" size="sm" full icon="MapPin">{tr("family.findYours")}</Btn>
            </div>
          </Card>

          <Card>
            <SectionHead title={tr("family.sharingItBetweenYou")} />
            <p className="text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              Three members, three days each. Cheaper than any creche, safer than none, and the children
              already know each other.
            </p>
            <div className="mt-3.5">
              <Btn href="/app/circles/new" variant="outline" size="sm" full iconEnd="ArrowRight">{tr("family.startACareCircle")}</Btn>
            </div>
          </Card>

          <div className="ux-clay relative overflow-hidden p-[20px]"
               style={{ background: "linear-gradient(140deg, var(--ux-tint-violet), var(--ux-tint-pink))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" src={WELLBEING_ART.family} alt=""
                 className="ux-float pointer-events-none absolute -bottom-3 -end-4 h-[100px] w-[100px] object-contain" />
            <h3 className="relative w-[60%] text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("family.workingWithABaby")}</h3>
            <p className="relative mt-2 w-[60%] text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>{tr("family.whatMembersActuallyDoFromWomen")}</p>
          </div>
        </div>
      }
    >
      {/* On a phone: a column — the large title, its line, then a full-width
          segmented control where the desktop has tabs. */}
      <div className="mb-6 flex flex-col gap-4 lg:mb-[20px] lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="ux-screen-title text-2xl font-bold" style={{ color: "var(--ux-ink)" }}>{tr("family.familyAmpChildcare")}</h1>
          {/* Counted both ways round. "and {CRECHES.length - 1} paid" assumed
              exactly one free option, and "near you" is a distance nobody has
              measured — the API carries no location for these. */}
          <p className="mt-1.5 text-xsm" style={{ color: "var(--ux-muted)" }}>
            {free} free, {CRECHES.length - free} paid. Free ones are open to you whatever you earn.
          </p>

      <SourceNote source={source} what="places" />
        </div>
        <div className="hidden lg:flex">
          <Tabs items={["Childcare near you", "Worth knowing"]} active={tab} onChange={setTab} />
        </div>
        <SegmentedControl className="lg:hidden" label={tr("family.familyAmpChildcare")} value={tab} onChange={setTab}
          options={["Childcare near you", "Worth knowing"].map((t) => ({ value: t, label: t }))} />
      </div>

      {tab === "Childcare near you" && (
        CRECHES.length ? (
          <>
          {/*
            On a phone a 170px photograph beside the words left them 150px of
            a 350px card — "Your ward Anganwadi" broke inside its own words and
            "Directions" overflowed its button. As rows of one grouped list the
            photograph is a thumbnail and the words get the width.
          */}
          <ListGroup className="lg:hidden">
            {CRECHES.map((c) => (
              <PhoneRow key={c.id} sepInset={84}
                        lead={
                          <span className="mt-0.5 h-[56px] w-[56px] shrink-0 overflow-hidden rounded-[12px]"
                                style={{ background: "var(--ux-tint-pink)" }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img loading="lazy" decoding="async" src={c.art} alt="" className="ux-art h-full w-full object-cover" />
                          </span>
                        }
                        title={
                          <span className="flex flex-wrap items-center gap-2">
                            {c.name}
                            {c.fee === "Free" && <Pill tone="green" size="sm">Free</Pill>}
                            <Pill tone={c.kind === "Government" ? "blue" : c.kind === "Private" ? "neutral" : "brand"} size="sm">
                              {c.kind}
                            </Pill>
                          </span>
                        }
                        meta={[c.distance, c.hours, c.ages].filter(Boolean).join(" · ")}>
                <span className="mt-1.5 block text-[17px] font-bold"
                      style={{ color: c.fee === "Free" ? "var(--ux-green-ink)" : "var(--ux-ink)" }}>
                  {c.fee}
                </span>
                {c.meals && (
                  <span className="mt-1 flex items-center gap-1.5 text-[13px]" style={{ color: "var(--ux-ink-2)" }}>
                    <Icons.UtensilsCrossed className="h-[14px] w-[14px]" style={{ color: "var(--ux-brand)" }} />{tr("family.aHotMealIsIncluded")}</span>
                )}
                <span className="mt-1 block text-[13px] leading-snug" style={{ color: "var(--ux-muted)" }}>{tr("family.takeYourChildRsquoSAadhaar")}</span>
                <span className="mt-3 flex">
                  <Btn href={mapsHref(c.name)} variant="primary" size="sm" icon="Navigation" full className="max-lg:px-4">Directions</Btn>
                </span>
              </PhoneRow>
            ))}
          </ListGroup>
          <div className="ux-deck ux-stagger hidden space-y-[12px] lg:block">
            {CRECHES.map((c, i) => (
              <Card key={c.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }} pad={0}>
                <div className="flex">
                  <span className="h-[150px] w-[170px] shrink-0 overflow-hidden" style={{ background: "var(--ux-tint-pink)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img loading="lazy" decoding="async" src={c.art} alt="" className="ux-art h-full w-full object-cover" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col p-[16px]">
                    <div className="flex items-start gap-2">
                      <h3 className="min-w-0 flex-1 text-base font-semibold" style={{ color: "var(--ux-ink)" }}>
                        {c.name}
                      </h3>
                      {/* Free first, then how far. Those are the two questions. */}
                      {c.fee === "Free" && <Pill tone="green" size="sm">Free</Pill>}
                      <Pill tone={c.kind === "Government" ? "blue" : c.kind === "Private" ? "neutral" : "brand"} size="sm">
                        {c.kind}
                      </Pill>
                    </div>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
                       style={{ color: "var(--ux-muted)" }}>
                      {/* Omitted rather than shown empty — the mapping leaves
                          distance blank because nothing has measured it, and a
                          lone pin icon reads as a place with no name. */}
                      {c.distance && (
                        <span className="inline-flex items-center gap-1"><Icons.MapPin className="h-3.5 w-3.5" /> {c.distance}</span>
                      )}
                      {c.hours && (
                        <span className="inline-flex items-center gap-1"><Icons.Clock className="h-3.5 w-3.5" /> {c.hours}</span>
                      )}
                      <span className="inline-flex items-center gap-1"><Icons.Baby className="h-3.5 w-3.5" /> {c.ages}</span>
                    </p>
                    <p className="mt-2.5 text-base font-bold" style={{ color: c.fee === "Free" ? "var(--ux-green-ink)" : "var(--ux-ink)" }}>
                      {c.fee}
                    </p>
                    {c.meals && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs" style={{ color: "var(--ux-ink-2)" }}>
                        <Icons.UtensilsCrossed className="h-[14px] w-[14px]" style={{ color: "var(--ux-brand)" }} />{tr("family.aHotMealIsIncluded")}</p>
                    )}
                    {/* "Go and see it" answered "In your diary — take your
                        child's Aadhaar" and put nothing in any diary: there is
                        no endpoint for visiting a creche. The useful half of
                        that sentence — what to carry — is true and now simply
                        said, next to the directions that actually work. */}
                    <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                      <p className="min-w-0 text-xs leading-snug" style={{ color: "var(--ux-faint)" }}>{tr("family.takeYourChildRsquoSAadhaar")}</p>
                      <Btn href={mapsHref(c.name)} variant="primary" size="sm" icon="Navigation">Directions</Btn>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          </>
        ) : (
          <Card>
            <EmptyState icon="Baby" title={tr("family.nothingFoundNearYou")}
                        body={tr("family.everyWardHasAnAnganwadiCentre")} />
          </Card>
        )
      )}

      {tab === "Worth knowing" && (
        <ListGroup className="lg:hidden">
          {FAMILY_HELP.map((f, i) => (
            <PhoneRow key={f.id} icon="Sparkles"
                      tint={FAMILY_TINTS[i % FAMILY_TINTS.length][0]} ink={FAMILY_TINTS[i % FAMILY_TINTS.length][1]}
                      title={f.label} body={f.note} />
          ))}
        </ListGroup>
      )}
      {tab === "Worth knowing" && (
        <div className="ux-deck hidden grid-cols-2 gap-[16px] lg:grid">
          {FAMILY_HELP.map((f, i) => (
            <Card key={f.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
              <div className="flex items-start gap-3.5">
                {/* The tint rotates by position rather than being stored with
                    the entry: colour is presentation, and an editor adding a
                    fifth card should not have to pick a CSS variable. */}
                <IconTile icon="Sparkles" tint={FAMILY_TINTS[i % FAMILY_TINTS.length][0]}
                          ink={FAMILY_TINTS[i % FAMILY_TINTS.length][1]} size={44} radius={12} />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold leading-snug" style={{ color: "var(--ux-ink)" }}>{f.label}</h3>
                  <p className="mt-1.5 text-xsm leading-relaxed" style={{ color: "var(--ux-muted)" }}>{f.note}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </HomeShell>
  );
}
