"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import * as Icons from "lucide-react";

import {
  Btn, Card, ConfirmButton, EmptyState, IconTile, Pill,
  Progress, SectionHead, SourceNote, formatRupees
} from "@/components/ux/kit";
import { Field, TextInput } from "@/components/ux/settings/Frame";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useGoals, type Goal } from "@/components/ux/business";
import { useAction } from "@/lib/use-action";
import { apiAddGoal, apiDropGoal, apiMoveGoal } from "@/lib/money-api";

const SUGGESTED = [
  { label: "Save ₹20,000 for a machine", icon: "PiggyBank", why: "Your circle pays out in month 9" },
  { label: "Get your Udyam registration", icon: "Building2", why: "It unlocks bigger orders and loans" },
  { label: "List one service", icon: "HandHeart", why: "You already do work you have not listed" },
];

/**
 * Goals — the few things she is actually working towards.
 *
 * Every goal has a NUMBER and a DATE, because "grow my business" cannot be
 * finished and so is never finished. And every goal shows what would move it
 * this week — a goal without a next step is a wish with a progress bar.
 */
export default function GoalsPage() {
  const { data: goals, source, refetch } = useGoals();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ label: "", target: "", by: "", kind: "count" as Goal["kind"] });

  const add = useAction(
    async () => apiAddGoal({
      label: draft.label.trim(),
      kind: draft.kind,
      // A money target is typed in rupees and stored in paise, like every
      // other amount here.
      target: draft.kind === "money"
        ? Math.round(Number(draft.target.replace(/[^\d.]/g, "")) * 100)
        : Math.max(1, Math.round(Number(draft.target.replace(/[^\d.]/g, "")))),
      by: draft.by.trim(),
      unit: draft.kind === "count" ? "" : undefined,
    }),
    {
      onDone: () => { refetch(); setDraft({ label: "", target: "", by: "", kind: "count" }); setAdding(false); },
      fallbackError: "We could not save that goal. Try again in a moment.",
    },
  );

  const move = useAction(
    async (id: string, to: number) => apiMoveGoal(id, to),
    { onDone: refetch, fallbackError: "We could not move that along." },
  );

  const drop = useAction(
    async (id: string) => apiDropGoal(id),
    { onDone: refetch, fallbackError: "We could not drop that goal." },
  );

  // Money goals are in paise; everything else is a plain count.
  const fmt = (g: Goal, n: number) =>
    g.kind === "money" ? formatRupees(n) : `${n}${g.unit ? " " + g.unit : ""}`;

  const pctOf = (g: Goal) => g.pct;
  const closest = useMemo(
    () => [...goals].filter((g) => !g.reached).sort((a, b) => b.pct - a.pct)[0] ?? goals[0],
    [goals],
  );

  /**
   * What would move this goal, in her words.
   *
   * The first version asserted specifics nobody had measured — "two more orders
   * would close the gap", "three women viewed your profile and did not
   * message". Neither is something the platform knows, and a next step that is
   * made up is worse than none: she acts on it.
   *
   * What is left is true of every goal of that kind, and points at the screen
   * where the work actually happens.
   */
  const nextStep = (g: Goal) =>
    g.kind === "money" ? { text: "Work you could apply for", href: "/app/opportunities" }
    : g.kind === "skill" ? { text: "Carry on where you left off", href: "/app/programs" }
    : { text: "Your profile is where people find you", href: "/app/profile" };

  return (
    <HomeShell
      skeleton="detail"
      rail={
        <div className="space-y-[15px]">
          <Card>
            <SectionHead title="Closest to done" />
            {closest ? (
              <>
                <p className="text-[13.5px] font-semibold" style={{ color: "var(--ux-ink)" }}>{closest.label}</p>
                <div className="mt-2.5 flex items-center gap-2.5">
                  <Progress pct={pctOf(closest)} track="--ux-track" />
                  <span className="shrink-0 text-[11.5px] font-medium tabular-nums" style={{ color: "var(--ux-muted)" }}>
                    {pctOf(closest)}%
                  </span>
                </div>
                <p className="mt-2.5 text-[12px] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
                  {fmt(closest, closest.target - closest.current)} to go, {closest.by}.
                </p>
              </>
            ) : (
              <p className="text-[12.5px]" style={{ color: "var(--ux-muted)" }}>Nothing set yet.</p>
            )}
          </Card>

          <Card>
            <SectionHead title="Worth aiming at" sub="Based on where you are now" />
            <ul className="ux-stagger space-y-2.5">
              {SUGGESTED.map((s, i) => (
                <li key={s.label} className="ux-hov flex items-start gap-3" style={{ ["--i" as string]: i }}>
                  <IconTile icon={s.icon} tint="--ux-tint-lilac" ink="--ux-brand" size={34} radius={10} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-medium leading-snug" style={{ color: "var(--ux-ink)" }}>{s.label}</p>
                    <p className="mt-0.5 text-[11px] leading-snug" style={{ color: "var(--ux-muted)" }}>{s.why}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      }
    >
      <Link href="/app/progress"
            className="ux-hov -my-1 mb-3.5 inline-flex items-center gap-1.5 py-1 text-[12.5px] font-medium"
            style={{ color: "var(--ux-brand)" }}>
        <Icons.ArrowLeft className="ux-ico h-4 w-4" /> Your journey
      </Link>

      <div className="mb-[18px] flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold" style={{ color: "var(--ux-ink)" }}>Your goals</h1>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--ux-muted)" }}>
            {goals.length} you are working towards. Three is usually plenty.
          </p>

      <SourceNote source={source} what="goals" />
        </div>
        <Btn variant="primary" icon="Plus" onClick={() => setAdding(true)}>Add a goal</Btn>
      </div>

      {adding && (
        <Card className="ux-slide-up mb-[15px]">
          <SectionHead title="A new goal" sub="It needs a number and a date, or it cannot be finished" />
          <div className="space-y-4">
            <Field label="What do you want to happen" hint="“Earn ₹30,000 a month”, not “grow my business”.">
              <TextInput value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                         placeholder="Earn ₹30,000 a month" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="The number" hint="How you will know it is done.">
                <TextInput value={draft.target} onChange={(e) => setDraft((d) => ({ ...d, target: e.target.value }))}
                           placeholder="30000" inputMode="numeric" />
              </Field>
              <Field label="By when" hint="A month is enough.">
                <TextInput value={draft.by} onChange={(e) => setDraft((d) => ({ ...d, by: e.target.value }))}
                           placeholder="by December" />
              </Field>
            </div>

            {/* Which kind it is decides how it is measured — and whether she
                moves it herself. A money goal reads the ledger; a counted one
                is hers to move, because nothing on the platform knows how many
                regular clients she has found. */}
            <div>
              <p className="text-[13px] font-semibold" style={{ color: "var(--ux-ink)" }}>How is it measured?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {([
                  ["money", "Money I earn", "Counts itself from your earnings"],
                  ["skill", "Lessons I finish", "Counts itself from your courses"],
                  ["count", "Something I count", "You move this one yourself"],
                ] as const).map(([k, label, why]) => (
                  <button key={k} onClick={() => setDraft((d) => ({ ...d, kind: k }))}
                          aria-pressed={draft.kind === k}
                          className="ux-press ux-sq rounded-[11px] border px-3 py-2 text-start"
                          style={{ borderColor: draft.kind === k ? "var(--ux-brand)" : "var(--ux-line)",
                                   background: draft.kind === k ? "var(--ux-brand-tint)" : "var(--ux-surface)" }}>
                    <span className="block text-[12.5px] font-medium" style={{ color: "var(--ux-ink)" }}>{label}</span>
                    <span className="block text-[11px]" style={{ color: "var(--ux-muted)" }}>{why}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-4 border-t pt-4" style={{ borderColor: "var(--ux-line)" }}>
            <p className="text-[12px]" style={{ color: add.error ? "var(--ux-orange-ink)" : "var(--ux-faint)" }}>
              {add.error ? add.error
                : !draft.label.trim() ? "It needs something to aim at."
                : !draft.target.trim() ? "It needs a number."
                : !draft.by.trim() ? "It needs a date."
                : "Ready."}
            </p>
            <span className="flex items-center gap-2.5">
              <Btn variant="outline" onClick={() => setAdding(false)}>Cancel</Btn>
              <Btn variant="primary" icon="Check"
                   className={draft.label.trim() && draft.target.trim() && draft.by.trim() ? "" : "pointer-events-none opacity-50"}
                   onClick={() => void add.run()}>
                {add.busy ? "Saving…" : "Add it"}
              </Btn>
            </span>
          </div>
        </Card>
      )}

      {goals.length ? (
        <div className="ux-deck ux-stagger space-y-[13px]">
          {goals.map((g, i) => {
            const pct = pctOf(g);
            const step = nextStep(g);
            return (
              <Card key={g.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
                <div className="flex items-start gap-3.5">
                  <IconTile icon={g.icon} tint="--ux-tint-lilac" ink="--ux-brand" size={46} radius={12} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <h3 className="min-w-0 flex-1 text-[15px] font-semibold" style={{ color: "var(--ux-ink)" }}>
                        {g.label}
                      </h3>
                      {pct >= 100 && <Pill tone="green" size="sm">Done</Pill>}
                    </div>
                    <p className="mt-1 text-[12px]" style={{ color: "var(--ux-muted)" }}>{g.by}</p>

                    <div className="mt-3 flex items-center gap-3">
                      <Progress pct={pct} track="--ux-track" />
                      <span className="shrink-0 text-[12px] font-semibold tabular-nums" style={{ color: "var(--ux-ink)" }}>
                        {pct}%
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11.5px] tabular-nums" style={{ color: "var(--ux-muted)" }}>
                      {fmt(g, g.current)} of {fmt(g, g.target)}
                      {pct < 100 && ` · ${fmt(g, g.target - g.current)} to go`}
                    </p>
                  </div>
                </div>

                {/* Only for the ones she counts herself. A money goal that
                    could be nudged by hand is a money goal that can be made to
                    say anything, which is the opposite of what it is for. */}
                {g.manual && (
                  <div className="mt-3.5 flex items-center gap-2 border-t pt-3.5"
                       style={{ borderColor: "var(--ux-line)" }}>
                    <Btn variant="outline" size="sm" icon="Minus"
                         className={g.current <= 0 || move.busyWith === g.id
                           ? "pointer-events-none opacity-40" : ""}
                         onClick={() => void move.run(g.id, Math.max(0, g.current - 1))}>
                      One fewer
                    </Btn>
                    <Btn variant="primary" size="sm" icon="Plus"
                         className={move.busyWith === g.id ? "pointer-events-none opacity-60" : ""}
                         onClick={() => void move.run(g.id, g.current + 1)}>
                      {move.busyWith === g.id ? "Saving…" : "One more"}
                    </Btn>
                    <span className="flex-1" />
                    {/* Dropped, not deleted — a goal she set and did not reach
                        is part of her own record. */}
                    <ConfirmButton
                      question="Drop this goal?"
                      cost="It stops showing here. Nothing else changes."
                      confirmLabel="Drop it"
                      keepLabel="Keep it"
                      busy={drop.busyWith === g.id}
                      onConfirm={() => drop.run(g.id)}
                    >
                      Drop
                    </ConfirmButton>
                  </div>
                )}

                {(move.error || drop.error) && (move.busyWith === null && drop.busyWith === null) && (
                  <p className="ux-slide-up mt-2.5 text-[12.5px]" style={{ color: "var(--ux-orange-ink)" }}>
                    {move.error || drop.error}
                  </p>
                )}

                {/* A goal without a next step is a wish with a progress bar. */}
                {pct < 100 && (
                  <Link href={step.href}
                        className="ux-hov ux-sq mt-3.5 flex items-center gap-3 rounded-[12px] p-3 transition-colors hover:bg-[var(--ux-surface-2)]"
                        style={{ background: "var(--ux-surface-2)" }}>
                    <Icons.ArrowRightCircle className="h-[16px] w-[16px] shrink-0" style={{ color: "var(--ux-brand)" }} />
                    <span className="min-w-0 flex-1 text-[12.5px]" style={{ color: "var(--ux-ink-2)" }}>{step.text}</span>
                    <Icons.ChevronRight className="ux-arrow h-[16px] w-[16px] shrink-0" style={{ color: "var(--ux-faint)" }} />
                  </Link>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState icon="Target" title="No goals yet"
                      body="One number and one date is enough to start."
                      action={<Btn variant="primary" icon="Plus" onClick={() => setAdding(true)}>Add a goal</Btn>} />
        </Card>
      )}
    </HomeShell>
  );
}
