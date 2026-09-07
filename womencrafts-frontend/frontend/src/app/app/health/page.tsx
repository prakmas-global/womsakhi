"use client";

import { useState } from "react";

import { apiMarkReference } from "@/lib/entitlements-api";
import { useAction } from "@/lib/use-action";
import * as Icons from "@/components/ux/icons";

import {
  Btn, Card, EmptyState, IconTile, Pill, SectionHead,
  SourceNote, Tabs, plural
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useGuidance, useHealthChecks, useHelplines } from "@/components/ux/entitlements";
import { WELLBEING_ART } from "@/components/ux/wellbeing/data";

/**
 * Health & Wellbeing.
 *
 * This screen gives no medical advice. It does two things instead: says which
 * checks are FREE and where, and says plainly what is overdue. The reason women
 * skip a haemoglobin test is almost never that they do not believe in it — it
 * is that nobody told them it costs nothing and takes ten minutes.
 */
const TOPIC_TINTS = [
  ["--ux-tint-pink", "--ux-pink"],
  ["--ux-tint-orange", "--ux-orange"],
  ["--ux-tint-violet", "--ux-violet"],
  ["--ux-tint-blue", "--ux-blue"],
] as const;

export default function HealthPage() {
  const { data: HEALTH_CHECKS, source, refetch } = useHealthChecks();
  // From the server, so a helpline that changes is an edit and not a deploy.
  const { data: HEALTH_HELP } = useHelplines("health");
  const { data: HEALTH_TOPICS } = useGuidance("health");
  const [tab, setTab] = useState("Your checks");
  /**
   * Which check-ups she has had — from the server, which records the mark and
   * the date. This was a local array starting empty, so every visit told her
   * she had never had any of them, and ticking one off changed nothing.
   */
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const isChecked = (c: { id: string; due: boolean }) => pending[c.id] ?? !c.due;
  const done = HEALTH_CHECKS.filter(isChecked).map((c) => c.id);

  const mark = useAction(
    // "saved" is the nearest thing the server has to un-marking a check-up:
    // it keeps the item on her list without claiming she has had it.
    async (id: string, want: string) => { await apiMarkReference(id, want === "done" ? "done" : "saved"); },
    {
      onDone: refetch,
      optimistic: (id, want) => setPending((p) => ({ ...p, [id]: want === "done" })),
      rollback: (id) => setPending((p) => { const n = { ...p }; delete n[id]; return n; }),
      fallbackError: "That did not save. Try again in a moment.",
    },
  );

  const due = HEALTH_CHECKS.filter((c) => c.due && !done.includes(c.id));

  return (
    <HomeShell
      rail={
        <div className="space-y-[16px]">
          <Card>
            <SectionHead title="Free, right now" icon="Phone" />
            <ul className="space-y-3">
              {HEALTH_HELP.map((h) => (
                <li key={h.id}>
                  {/* Tappable AND readable: the number is still plain text she
                      can read out loud to somebody, and one tap on a phone. */}
                  <a href={`tel:${h.num}`} className="ux-hov block text-[1.25rem] font-bold leading-none tabular-nums"
                     style={{ color: "var(--ux-ink)" }}>{h.num}</a>
                  <p className="mt-1 text-[0.8125rem] font-medium" style={{ color: "var(--ux-ink-2)" }}>{h.label}</p>
                  <p className="mt-0.5 text-[0.75rem]" style={{ color: "var(--ux-muted)" }}>{h.note}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <SectionHead title="What this is not" icon="Info" />
            <p className="text-[0.8125rem] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              Nothing here is medical advice, and nobody at WomSakhi is a doctor. This is a list of what is
              free, where it is, and when it is worth going.
            </p>
          </Card>

          <div className="ux-clay relative overflow-hidden p-[20px]"
               style={{ background: "linear-gradient(140deg, var(--ux-tint-pink), var(--ux-tint-lilac))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" src={WELLBEING_ART.health} alt=""
                 className="ux-float pointer-events-none absolute -bottom-3 -end-4 h-[100px] w-[100px] object-contain" />
            <h3 className="relative w-[60%] text-[0.875rem] font-semibold" style={{ color: "var(--ux-ink)" }}>
              Ten minutes a day
            </h3>
            <p className="relative mt-2 w-[60%] text-[0.75rem] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
              Sitting bent over close work for hours is what most members ask about. Small changes help.
            </p>
          </div>
        </div>
      }
    >
      <div className="mb-[20px] flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.5rem] font-bold" style={{ color: "var(--ux-ink)" }}>Health</h1>
          <p className="mt-1.5 text-[0.8125rem]" style={{ color: "var(--ux-muted)" }}>
            {due.length
              ? `${due.length} ${plural("check", due.length)} overdue — all of them free.`
              : "Nothing is overdue. Well done."}
          </p>

      <SourceNote source={source} what="checks" />
        </div>
        <Tabs items={["Your checks", "Worth knowing"]} active={tab} onChange={setTab} />
      </div>

      {tab === "Your checks" && (
        HEALTH_CHECKS.length ? (
          <div className="ux-deck ux-stagger space-y-[12px]">
            {HEALTH_CHECKS.map((c, i) => {
              const isDone = done.includes(c.id);
              const overdue = c.due && !isDone;
              return (
                <Card key={c.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
                  <div className="flex items-start gap-3.5">
                    <IconTile icon={c.icon} tint={c.tint} ink={c.ink} size={46} radius={12} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <h3 className="min-w-0 flex-1 text-[0.875rem] font-semibold" style={{ color: "var(--ux-ink)" }}>
                          {c.label}
                        </h3>
                        {/* Free is the headline, because cost is the barrier. */}
                        {c.free && <Pill tone="green" size="sm">Free</Pill>}
                        {overdue && <Pill tone="orange" size="sm">Overdue</Pill>}
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[0.75rem]" style={{ color: "var(--ux-muted)" }}>
                        <span>{c.every}</span>
                        <span>Last: {isDone ? "just now" : c.last}</span>
                      </p>
                      <p className="mt-2 flex items-center gap-1.5 text-[0.8125rem]" style={{ color: "var(--ux-ink-2)" }}>
                        <Icons.MapPin className="h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-brand)" }} />
                        {c.where}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3.5 flex items-center justify-between gap-4 border-t pt-3.5"
                       style={{ borderColor: "var(--ux-line)" }}>
                    <span className="text-[0.75rem]" style={{ color: "var(--ux-faint)" }}>
                      {c.free ? "Costs nothing, takes about ten minutes." : c.where}
                    </span>
                    <Btn variant={isDone ? "outline" : "primary"} size="sm"
                         icon={isDone ? "Check" : undefined}
                         onClick={() => void mark.run(c.id, isDone ? "saved" : "done")}>
                      {isDone ? "Marked done" : "Mark as done"}
                    </Btn>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <EmptyState icon="HeartPulse" title="Nothing tracked yet"
                        body="Add the checks that matter for you and we will remind you." />
          </Card>
        )
      )}

      {tab === "Worth knowing" && (
        <div className="ux-deck grid grid-cols-2 gap-[16px]">
          {HEALTH_TOPICS.map((t, i) => (
            <Card key={t.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
              <div className="flex items-start gap-3.5">
                {/* Tint rotates by position: colour is presentation, and an
                    editor adding a fifth card should not have to pick a CSS
                    variable for it. */}
                <IconTile icon={t.icon ?? "BookOpen"} tint={TOPIC_TINTS[i % TOPIC_TINTS.length][0]}
                          ink={TOPIC_TINTS[i % TOPIC_TINTS.length][1]} size={44} radius={12} />
                <div className="min-w-0 flex-1">
                  <h3 className="text-[0.875rem] font-semibold leading-snug" style={{ color: "var(--ux-ink)" }}>{t.label}</h3>
                  <p className="mt-1.5 text-[0.8125rem] leading-relaxed" style={{ color: "var(--ux-muted)" }}>{t.note}</p>
                  {/* Only when the entry actually says. "undefined min read"
                      is the kind of thing that ships. */}
                  {t.mins ? (
                    <p className="mt-2 text-[0.75rem]" style={{ color: "var(--ux-faint)" }}>{t.mins} min read</p>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </HomeShell>
  );
}
