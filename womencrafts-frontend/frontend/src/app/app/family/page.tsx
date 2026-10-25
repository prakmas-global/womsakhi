"use client";

import { useState } from "react";
import * as Icons from "@/components/ux/icons";

import {
  Btn, Card, EmptyState,
  SectionHead, SourceNote, Tabs, mapsHref
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useCreches, useGuidance } from "@/components/ux/entitlements";
import { WELLBEING_ART as RAW_WELLBEING_ART } from "@/components/ux/wellbeing/data";
import { useT } from "@/i18n";
import { SegmentedControl } from "@/components/ux/mobile/SegmentedControl";
import { useTranslated } from "@/i18n/data";
import { MediaCard, MediaGrid, Fact } from "@/components/ux/media/MediaCard";
import { artFor } from "@/components/ux/media/art";

/**
 * Family & Childcare.
 *
 * Childcare is the single most common reason a member stops earning, and the
 * most common reason she never starts. So the first thing on this screen is
 * what is FREE and how far away it is — an Anganwadi 800 metres away that most
 * women do not know they are entitled to beats any advice about time management.
 */

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
            <h2 className="relative w-[60%] text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("family.workingWithABaby")}</h2>
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
          /* One picture-led card per place, phone and laptop alike: free or
             not, who runs it, how far, the hours and the ages, and directions. */
          <MediaGrid cols={2}>
            {CRECHES.map((c) => (
              <MediaCard key={c.id}
                image={artFor([c.name, c.kind, "child creche"], "generic", c.art && !c.art.startsWith("/ux/") ? c.art : null, c.id)} alt={c.name}
                topLeft={{ text: c.kind, tone: c.kind === "Government" ? "brand" : "light" }}
                topRight={c.fee === "Free" ? { text: "Free", tone: "green" } : { text: c.fee, tone: "dark" }}
                overlay={c.meals ? <><Icons.UtensilsCrossed className="h-[13px] w-[13px]" /> {tr("family.aHotMealIsIncluded")}</> : undefined}
                title={c.name}
                meta={<>
                  {c.distance && <Fact icon="MapPin">{c.distance}</Fact>}
                  {c.hours && <Fact icon="Clock">{c.hours}</Fact>}
                  <Fact icon="Baby">{c.ages}</Fact>
                </>}
                footer={<Btn href={mapsHref(c.name)} variant="primary" size="sm" icon="Navigation" full>Directions</Btn>}>
                <p className="text-xs leading-snug" style={{ color: "var(--ux-faint)" }}>{tr("family.takeYourChildRsquoSAadhaar")}</p>
              </MediaCard>
            ))}
          </MediaGrid>
        ) : (
          <Card>
            <EmptyState icon="Baby" title={tr("family.nothingFoundNearYou")}
                        body={tr("family.everyWardHasAnAnganwadiCentre")} />
          </Card>
        )
      )}

      {tab === "Worth knowing" && (
        <MediaGrid cols={2}>
          {FAMILY_HELP.map((f) => (
            <MediaCard key={f.id} image={artFor([f.label, f.note], "health", null, f.id)} alt="" ratio="3/2"
                       title={f.label}>
              <p className="text-xsm leading-relaxed" style={{ color: "var(--ux-muted)" }}>{f.note}</p>
            </MediaCard>
          ))}
        </MediaGrid>
      )}
    </HomeShell>
  );
}
