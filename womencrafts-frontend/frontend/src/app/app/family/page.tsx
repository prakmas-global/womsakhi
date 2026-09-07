"use client";

import { useState } from "react";
import * as Icons from "@/components/ux/icons";

import {
  Btn, Card, EmptyState, IconTile, Pill,
  SectionHead, SourceNote, Tabs, mapsHref
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useCreches, useGuidance } from "@/components/ux/entitlements";
import { WELLBEING_ART } from "@/components/ux/wellbeing/data";

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
            <SectionHead title="What you are entitled to" icon="Baby" />
            <p className="text-[0.8125rem] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              Every ward in India has an Anganwadi centre. Childcare, a hot meal and immunisation for
              under-sixes, free, whatever you earn. Most women do not know theirs exists.
            </p>
            <div className="mt-3.5">
              <Btn href={mapsHref("Anganwadi centre near me")} variant="soft" size="sm" full icon="MapPin">Find yours</Btn>
            </div>
          </Card>

          <Card>
            <SectionHead title="Sharing it between you" />
            <p className="text-[0.8125rem] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              Three members, three days each. Cheaper than any creche, safer than none, and the children
              already know each other.
            </p>
            <div className="mt-3.5">
              <Btn href="/app/circles/new" variant="outline" size="sm" full iconEnd="ArrowRight">
                Start a care circle
              </Btn>
            </div>
          </Card>

          <div className="ux-clay relative overflow-hidden p-[20px]"
               style={{ background: "linear-gradient(140deg, var(--ux-tint-violet), var(--ux-tint-pink))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={WELLBEING_ART.family} alt=""
                 className="ux-float pointer-events-none absolute -bottom-3 -end-4 h-[100px] w-[100px] object-contain" />
            <h3 className="relative w-[60%] text-[0.875rem] font-semibold" style={{ color: "var(--ux-ink)" }}>
              Working with a baby
            </h3>
            <p className="relative mt-2 w-[60%] text-[0.75rem] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
              What members actually do — from women who have done it, not from a manual.
            </p>
          </div>
        </div>
      }
    >
      <div className="mb-[20px] flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.5rem] font-bold" style={{ color: "var(--ux-ink)" }}>Family &amp; childcare</h1>
          {/* Counted both ways round. "and {CRECHES.length - 1} paid" assumed
              exactly one free option, and "near you" is a distance nobody has
              measured — the API carries no location for these. */}
          <p className="mt-1.5 text-[0.8125rem]" style={{ color: "var(--ux-muted)" }}>
            {free} free, {CRECHES.length - free} paid. Free ones are open to you whatever you earn.
          </p>

      <SourceNote source={source} what="places" />
        </div>
        <Tabs items={["Childcare near you", "Worth knowing"]} active={tab} onChange={setTab} />
      </div>

      {tab === "Childcare near you" && (
        CRECHES.length ? (
          <div className="ux-deck ux-stagger space-y-[12px]">
            {CRECHES.map((c, i) => (
              <Card key={c.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }} pad={0}>
                <div className="flex">
                  <span className="h-[150px] w-[170px] shrink-0 overflow-hidden" style={{ background: "var(--ux-tint-pink)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.art} alt="" className="ux-art h-full w-full object-cover" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col p-[16px]">
                    <div className="flex items-start gap-2">
                      <h3 className="min-w-0 flex-1 text-[1rem] font-semibold" style={{ color: "var(--ux-ink)" }}>
                        {c.name}
                      </h3>
                      {/* Free first, then how far. Those are the two questions. */}
                      {c.fee === "Free" && <Pill tone="green" size="sm">Free</Pill>}
                      <Pill tone={c.kind === "Government" ? "blue" : c.kind === "Private" ? "neutral" : "brand"} size="sm">
                        {c.kind}
                      </Pill>
                    </div>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem]"
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
                    <p className="mt-2.5 text-[1rem] font-bold" style={{ color: c.fee === "Free" ? "var(--ux-green-ink)" : "var(--ux-ink)" }}>
                      {c.fee}
                    </p>
                    {c.meals && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-[0.75rem]" style={{ color: "var(--ux-ink-2)" }}>
                        <Icons.UtensilsCrossed className="h-[14px] w-[14px]" style={{ color: "var(--ux-brand)" }} />
                        A hot meal is included
                      </p>
                    )}
                    {/* "Go and see it" answered "In your diary — take your
                        child's Aadhaar" and put nothing in any diary: there is
                        no endpoint for visiting a creche. The useful half of
                        that sentence — what to carry — is true and now simply
                        said, next to the directions that actually work. */}
                    <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                      <p className="min-w-0 text-[0.75rem] leading-snug" style={{ color: "var(--ux-faint)" }}>
                        Take your child&rsquo;s Aadhaar and immunisation card.
                      </p>
                      <Btn href={mapsHref(c.name)} variant="primary" size="sm" icon="Navigation">Directions</Btn>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState icon="Baby" title="Nothing found near you"
                        body="Every ward has an Anganwadi centre — tell us your ward and we will find it." />
          </Card>
        )
      )}

      {tab === "Worth knowing" && (
        <div className="ux-deck grid grid-cols-2 gap-[16px]">
          {FAMILY_HELP.map((f, i) => (
            <Card key={f.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
              <div className="flex items-start gap-3.5">
                {/* The tint rotates by position rather than being stored with
                    the entry: colour is presentation, and an editor adding a
                    fifth card should not have to pick a CSS variable. */}
                <IconTile icon="Sparkles" tint={FAMILY_TINTS[i % FAMILY_TINTS.length][0]}
                          ink={FAMILY_TINTS[i % FAMILY_TINTS.length][1]} size={44} radius={12} />
                <div className="min-w-0 flex-1">
                  <h3 className="text-[0.875rem] font-semibold leading-snug" style={{ color: "var(--ux-ink)" }}>{f.label}</h3>
                  <p className="mt-1.5 text-[0.8125rem] leading-relaxed" style={{ color: "var(--ux-muted)" }}>{f.note}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </HomeShell>
  );
}
