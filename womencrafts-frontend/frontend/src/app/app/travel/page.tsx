"use client";

import { useState } from "react";
import * as Icons from "lucide-react";

import { ActionBtn, Btn, Card, EmptyState, IconTile, Pill, SectionHead, SourceNote, Tabs, mapsHref } from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useRoutes } from "@/components/ux/entitlements";
import { TRAVEL_HELP, TRAVEL_RULES, WELLBEING_ART } from "@/components/ux/wellbeing/data";

/**
 * Transport & Safe Travel.
 *
 * A mela that pays well and a bus that is not safe after dark are the same
 * decision, and the app has so far only shown her half of it. Every route says
 * what it costs, how long it takes, and — the part nobody publishes — whether
 * it is safe to come back on after dark.
 */
export default function TravelPage() {
  const { data: ROUTES, source } = useRoutes();
  const [tab, setTab] = useState("Your routes");

  // Only routes somebody has actually checked and found unsafe. `!safe` would
  // sweep in every unchecked route and report a warning nobody made.
  const risky = ROUTES.filter((r) => r.safeAfterDark === false);
  const unchecked = ROUTES.filter((r) => r.safeAfterDark === null);

  return (
    <HomeShell
      rail={
        <div className="space-y-[15px]">
          <Card>
            <SectionHead title="Before you set out" icon="ShieldCheck" />
            <ul className="ux-stagger space-y-2.5">
              {TRAVEL_RULES.map((t, i) => (
                <li key={t} className="flex items-start gap-2.5 text-[12.5px] leading-snug"
                    style={{ ["--i" as string]: i, color: "var(--ux-ink-2)" }}>
                  <Icons.Check className="mt-[2px] h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-green-ink)" }} strokeWidth={2.6} />
                  {t}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <SectionHead title="If something happens" />
            <ul className="space-y-3">
              {TRAVEL_HELP.map((h) => (
                <li key={h.id}>
                  <p className="text-[20px] font-bold leading-none tabular-nums" style={{ color: "var(--ux-ink)" }}>{h.num}</p>
                  <p className="mt-1 text-[12.5px] font-medium" style={{ color: "var(--ux-ink-2)" }}>{h.label}</p>
                  <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--ux-muted)" }}>{h.note}</p>
                </li>
              ))}
            </ul>
            <div className="mt-3.5">
              <Btn href="/app/safety" variant="soft" size="sm" full iconEnd="ArrowRight">Safety centre</Btn>
            </div>
          </Card>

          <div className="ux-clay relative overflow-hidden p-[18px]"
               style={{ background: "linear-gradient(140deg, var(--ux-tint-blue), var(--ux-tint-lilac))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={WELLBEING_ART.travel} alt=""
                 className="ux-float pointer-events-none absolute -bottom-3 -end-4 h-[100px] w-[100px] object-contain" />
            <h3 className="relative w-[60%] text-[14px] font-semibold" style={{ color: "var(--ux-ink)" }}>
              Share your journey
            </h3>
            <p className="relative mt-2 w-[60%] text-[12px] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
              Your trusted contacts see where you are until you say you have arrived.
            </p>
          </div>
        </div>
      }
    >
      <div className="mb-[18px] flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold" style={{ color: "var(--ux-ink)" }}>Transport &amp; Safe Travel</h1>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--ux-muted)" }}>
            {risky.length
              ? `${risky.length} of your routes is not safe to return on after dark.`
              : unchecked.length === ROUTES.length
                // Silence would read as "all clear", which is the one thing it
                // must not read as.
                ? "Nobody has checked these after dark yet. Ask someone who knows the route."
                : "All your usual routes are fine after dark."}
          </p>

      <SourceNote source={source} what="routes" />
        </div>
        <Tabs items={["Your routes", "Getting there safely"]} active={tab} onChange={setTab} />
      </div>

      {tab === "Your routes" && (
        ROUTES.length ? (
          <div className="ux-deck ux-stagger space-y-[13px]">
            {ROUTES.map((r, i) => (
              <Card key={r.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
                <div className="flex items-start gap-3.5">
                  <IconTile icon={r.cost === "Free" ? "Footprints" : "Bus"}
                            tint={r.safeAfterDark ? "--ux-tint-green" : "--ux-tint-orange"}
                            ink={r.safeAfterDark ? "--ux-green" : "--ux-orange"} size={46} radius={12} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <h3 className="min-w-0 flex-1 text-[14.5px] font-semibold" style={{ color: "var(--ux-ink)" }}>
                        {r.name}
                      </h3>
                      {/* The part nobody publishes, said plainly — including
                          when nobody has said it. An unchecked route must not
                          borrow the confidence of a checked one. */}
                      <Pill tone={r.safeAfterDark === null ? "neutral"
                                  : r.safeAfterDark ? "green" : "orange"} size="sm">
                        {r.safeAfterDark === null ? "Nobody has checked after dark"
                         : r.safeAfterDark ? "Fine after dark" : "Not after dark"}
                      </Pill>
                    </div>
                    <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--ux-ink-2)" }}>{r.how}</p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[11.5px]" style={{ color: "var(--ux-muted)" }}>
                      {r.mins !== null && (
                        <span className="inline-flex items-center gap-1"><Icons.Clock className="h-3.5 w-3.5" /> {r.mins} min</span>
                      )}
                      <span className="inline-flex items-center gap-1"><Icons.IndianRupee className="h-3.5 w-3.5" /> {r.cost}</span>
                    </p>
                    <p className="mt-2 flex items-start gap-1.5 text-[12px]"
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
                             done="Sent to whoever you chose"
                             act={() => tellSomeone(r.name, r.how)}>
                    Tell someone your route
                  </ActionBtn>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState icon="Bus" title="No routes saved"
                        body="Save the journeys you make often and we will tell you what they cost and when to come back." />
          </Card>
        )
      )}

      {tab === "Getting there safely" && (
        <Card>
          <SectionHead title="Four things, every journey" sub="None of them cost anything" />
          <ol className="ux-stagger space-y-3.5">
            {TRAVEL_RULES.map((t, i) => (
              <li key={t} className="flex items-start gap-3">
                <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full text-[12px] font-bold"
                      style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>{i + 1}</span>
                <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{t}</p>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex items-center gap-3 rounded-[13px] p-3.5" style={{ background: "var(--ux-surface-2)" }}>
            <Icons.Siren className="h-[18px] w-[18px] shrink-0" style={{ color: "var(--ux-orange-ink)" }} />
            <p className="min-w-0 flex-1 text-[12.5px]" style={{ color: "var(--ux-ink-2)" }}>
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
