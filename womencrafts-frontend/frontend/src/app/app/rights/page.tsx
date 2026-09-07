"use client";

import { useState } from "react";

import { Btn, Card, IconTile, SectionHead, SourceNote, Tabs } from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useGuidance, useHelplines, useRights } from "@/components/ux/entitlements";
import { WELLBEING_ART } from "@/components/ux/wellbeing/data";

/**
 * Legal Aid & Rights.
 *
 * Every right here is stated as a plain sentence first and the Act second. A
 * woman being told her earnings are not hers does not need a section number —
 * she needs one line she can repeat, and a free phone number.
 *
 * The single most useful fact on this screen is that legal aid is free for
 * every woman in India regardless of income. It is stated three times.
 */
export default function RightsPage() {
  const { data: RIGHTS, source } = useRights();
  // Numbers and steps from the server, not from a constant. The list here used
  // to name "District Legal Services, Jaipur" and its phone number — shown to
  // every member in the country, most of whom are not in Jaipur.
  const { data: HELPLINES } = useHelplines("legal");
  const { data: STEPS } = useGuidance("legal");
  // The headline number is whichever legal-aid line the server ranks first, so
  // it can be corrected without a deploy like every other one.
  const lead = HELPLINES.find((h) => h.num === "15100") ?? HELPLINES[0];
  const [tab, setTab] = useState("What you are owed");
  const [open, setOpen] = useState<string | null>(null);

  return (
    <HomeShell
      rail={
        <div className="space-y-[16px]">
          <Card>
            <SectionHead title="A lawyer costs you nothing" icon="Gavel" />
            <p className="text-[0.8125rem] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              Every woman in India is entitled to a free lawyer, whatever she earns. Not reduced — free.
              Most women never use it because nobody tells them.
            </p>
            {lead && (
              <>
                <a
                  href={`tel:${lead.num}`}
                  className="ux-hov mt-3.5 block text-[1.5rem] font-bold leading-none tabular-nums"
                  style={{ color: "var(--ux-ink)" }}
                >
                  {lead.num}
                </a>
                <p className="mt-1 text-[0.75rem]" style={{ color: "var(--ux-muted)" }}>
                  {lead.label}
                </p>
              </>
            )}
          </Card>

          <Card>
            <SectionHead title="Other numbers" />
            <ul className="space-y-3">
              {HELPLINES.filter((h) => h.id !== lead?.id).map((h) => (
                <li key={h.id}>
                  {/* Tappable. On a phone, a number she has to copy out by hand
                      is a number she does not ring. */}
                  <a href={`tel:${h.num}`} className="ux-hov block text-[1.125rem] font-bold leading-none tabular-nums"
                     style={{ color: "var(--ux-ink)" }}>{h.num}</a>
                  <p className="mt-1 text-[0.8125rem] font-medium" style={{ color: "var(--ux-ink-2)" }}>{h.label}</p>
                  <p className="mt-0.5 text-[0.75rem]" style={{ color: "var(--ux-muted)" }}>{h.note}</p>
                </li>
              ))}
            </ul>
          </Card>

          <div className="ux-clay relative overflow-hidden p-[20px]"
               style={{ background: "linear-gradient(140deg, var(--ux-tint-green), var(--ux-tint-lilac))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={WELLBEING_ART.legal} alt=""
                 className="ux-float pointer-events-none absolute -bottom-3 -end-4 h-[100px] w-[100px] object-contain" />
            <h3 className="relative w-[60%] text-[0.875rem] font-semibold" style={{ color: "var(--ux-ink)" }}>
              Not legal advice
            </h3>
            <p className="relative mt-2 w-[60%] text-[0.75rem] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
              This is what the law says. A lawyer tells you what it means for you — and that is free.
            </p>
          </div>
        </div>
      }
    >
      <div className="mb-[20px] flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.5rem] font-bold" style={{ color: "var(--ux-ink)" }}>Your rights</h1>
          <p className="mt-1.5 text-[0.8125rem]" style={{ color: "var(--ux-muted)" }}>
            What the law already says is yours — and how to get a free lawyer.
          </p>

      <SourceNote source={source} what="rights" />
        </div>
        <Tabs items={["What you are owed", "If something is wrong"]} active={tab} onChange={setTab} />
      </div>

      {tab === "What you are owed" && (
        <div className="ux-deck ux-stagger space-y-[12px]">
          {RIGHTS.map((r, i) => {
            const on = open === r.id;
            return (
              <Card key={r.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
                <div className="flex items-start gap-3.5">
                  <IconTile icon={r.icon} tint={r.tint} ink={r.ink} size={46} radius={12} />
                  <div className="min-w-0 flex-1">
                    {/* The sentence she can repeat comes first. The Act comes second. */}
                    <h3 className="text-[1rem] font-semibold" style={{ color: "var(--ux-ink)" }}>{r.title}</h3>
                    <p className="mt-1.5 text-[0.8125rem] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{r.body}</p>
                    {on && (
                      <p className="ux-slide-up mt-2.5 rounded-[12px] p-3 text-[0.75rem] leading-relaxed"
                         style={{ background: "var(--ux-surface-2)", color: "var(--ux-muted)" }}>
                        {r.law}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <Btn variant="ghost" size="sm" iconEnd={on ? "ChevronUp" : "ChevronDown"}
                       onClick={() => setOpen(on ? null : r.id)}>
                    {on ? "Less" : "Which law"}
                  </Btn>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {tab === "If something is wrong" && (
        <>
          <Card className="mb-[16px]">
            <SectionHead title={`${STEPS.length} steps, in order`} sub="You do not need a lawyer to start" />
            <ol className="ux-stagger space-y-3.5">
              {STEPS.map((s, i) => (
                <li key={s.id} className="flex items-start gap-3">
                  <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full text-[0.75rem] font-bold"
                        style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-[0.875rem] font-semibold" style={{ color: "var(--ux-ink)" }}>{s.label}</p>
                    <p className="mt-0.5 text-[0.8125rem] leading-snug" style={{ color: "var(--ux-muted)" }}>{s.note}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-[1rem] font-semibold" style={{ color: "var(--ux-ink)" }}>
                  Call 15100 — it is free, whatever you earn
                </h3>
                <p className="mt-1.5 text-[0.8125rem] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
                  They assign you a lawyer. You pay nothing at any stage. You do not need documents to call.
                </p>
              </div>
              <Btn href="tel:15100" variant="primary" icon="Phone">Call 15100</Btn>
            </div>
          </Card>
        </>
      )}
    </HomeShell>
  );
}
