"use client";

import { useCallback, useMemo, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { v } from "@/components/ux/kit";
import { useMe } from "@/components/ux/me";
import { useJourney } from "@/components/ux/journey";
import { readJourneyState } from "@/services/me.repository";
import {
  currentStep, journeySteps, stepState,
  type JourneyFacts, type JourneyStep,
} from "@/services/journey";
import { GOALS, goalPct } from "@/components/ux/discovery/data";
import {
  Achievements, GoalsRail, JourneyHero, JourneyStats, Motivation, NeedGuidance,
  OnYourWay, Recommended, StepCard, Stepper,
  type Badge, type Rec, type RailGoal,
} from "./journey-views";

/**
 * My Journey — skill to income, drawn as the seven places she passes through.
 *
 * ── Why seven steps with checklists, not one progress bar ───────────────────
 * "65% complete" is a number about a course. This is a claim about her life,
 * so it has to be legible: which step she is standing in, what is left inside
 * it, and what the next one is called. The checklist is the difference between
 * a screen that says she is 40% of the way and one that says which two things
 * are left.
 *
 * ── Evidence, never a survey ────────────────────────────────────────────────
 * Every tick is observed — a listing that exists, money that arrived, a
 * profile that is filled in. A woman asked to rate herself rates herself low,
 * and correcting that bias is half of why this product exists. That is also
 * why the ticks are not editable: the screen reports, it does not take her
 * word for it.
 *
 * ── Nothing ahead is locked ─────────────────────────────────────────────────
 * Every step in the strip is pressable, including ones she has not reached. A
 * woman who already sells but never took a course is not "not ready" to earn —
 * she is already earning, and a lock would be the app telling her she is wrong
 * about her own life.
 */
export default function JourneyPage() {
  const me = useMe();
  const { data: live } = useJourney();
  const [picked, setPicked] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const say = useCallback((msg: string) => {
    setNote(msg);
    window.setTimeout(() => setNote((n) => (n === msg ? null : n)), 3400);
  }, []);

  /**
   * What she has actually done.
   *
   * `readJourneyState` is still the fixture for her shop and her learning;
   * the profile half is live from `useMe`, and the months from `/me/journey`.
   * Mixing them is deliberate — the live parts should not wait for the mocked
   * ones to be replaced.
   */
  const facts: JourneyFacts = useMemo(() => {
    const base = readJourneyState();
    return {
      ...base,
      monthsActive: live.monthsHere || base.monthsActive,
      earnedMinor: live.lifetimeMinor || base.earnedMinor,
      profilePct: me.profilePct,
      verified: me.verified,
      hasAvatar: Boolean(me.avatar),
      hasTagline: Boolean(me.tagline?.trim()),
    };
  }, [live.monthsHere, live.lifetimeMinor, me.profilePct, me.verified, me.avatar, me.tagline]);

  const steps = useMemo(() => journeySteps(facts), [facts]);
  const here = useMemo(() => currentStep(steps), [steps]);
  const shown: JourneyStep = useMemo(
    () => steps.find((s) => s.id === picked) ?? here, [steps, picked, here]);

  const tally = useMemo(() => {
    const by = { done: 0, doing: 0, todo: 0 };
    for (const s of steps) by[stepState(s)] += 1;
    return by;
  }, [steps]);

  /** Said about what she has done, never about who she is. */
  const cheer = tally.done === 0 ? "The first step is the whole trick"
              : tally.done >= steps.length ? "You have walked all seven"
              : tally.done === 1 ? "One down — keep going"
              : `${tally.done} steps behind you`;

  /* ── The rail ─────────────────────────────────────────────────────────── */

  const goals: RailGoal[] = useMemo(() => GOALS.filter((g) => g.state === "on").slice(0, 3).map((g) => ({
    id: g.id,
    title: g.title,
    pct: goalPct(g),
    have: goalPct(g) > 0 ? `${goalPct(g)}%` : "Not yet",
    icon: g.icon, tint: g.tint, ink: g.ink,
  })), []);

  /**
   * Four badges, each one earned by something on this very screen.
   *
   * Not a separate list of achievements that could disagree with the steps —
   * the same facts, read again, so a woman can always point at the thing that
   * earned her the badge.
   */
  const badges: Badge[] = useMemo(() => [
    { id: "learner", label: "Early learner", icon: "GraduationCap", earned: facts.coursesDone > 0,
      tint: "--ux-tint-violet", ink: "--ux-violet-ink" },
    { id: "member",  label: "Active member", icon: "HeartHandshake", earned: facts.circles > 0,
      tint: "--ux-tint-pink", ink: "--ux-pink-ink" },
    { id: "setter",  label: "Goal setter",   icon: "Target", earned: goals.length > 0,
      tint: "--ux-tint-amber", ink: "--ux-amber-ink" },
    { id: "next",    label: "Next badge",    icon: "Award", earned: false,
      tint: "--ux-surface-2", ink: "--ux-faint" },
  ], [facts.coursesDone, facts.circles, goals.length]);

  /** Reading that belongs to the step she is standing in. */
  const recs: Rec[] = useMemo(() => {
    const forStep: Record<string, Rec[]> = {
      proof: [
        { id: "r1", title: "How to create a portfolio", kind: "Video", meta: "12 min",
          icon: "Play", tint: "--ux-tint-violet", ink: "--ux-violet-ink", href: "/app/programs" },
        { id: "r2", title: "Certificate templates", kind: "Resource", meta: "PDF",
          icon: "FileText", tint: "--ux-tint-pink", ink: "--ux-pink-ink", href: "/app/certificates" },
        { id: "r3", title: "Writing a great profile", kind: "Guide", meta: "8 min",
          icon: "BookOpen", tint: "--ux-tint-blue", ink: "--ux-blue-ink", href: "/app/profile" },
        { id: "r4", title: "Real stories from women like you", kind: "Article", meta: "5 min",
          icon: "Sparkles", tint: "--ux-tint-green", ink: "--ux-green-ink", href: "/app/stories" },
      ],
    };
    return forStep[shown.id] ?? [
      { id: "d1", title: `Courses for ${shown.label.toLowerCase()}`, kind: "Guide", meta: "Browse",
        icon: "BookOpen", tint: "--ux-tint-violet", ink: "--ux-violet-ink", href: "/app/programs" },
      { id: "d2", title: "Women who have done this", kind: "Article", meta: "5 min",
        icon: "Sparkles", tint: "--ux-tint-green", ink: "--ux-green-ink", href: "/app/stories" },
      { id: "d3", title: "Find a mentor", kind: "Guide", meta: "10 min",
        icon: "BookOpen", tint: "--ux-tint-pink", ink: "--ux-pink-ink", href: "/app/mentors" },
      { id: "d4", title: "Ask Sakhi what is next", kind: "Video", meta: "2 min",
        icon: "Play", tint: "--ux-tint-blue", ink: "--ux-blue-ink", href: "/app/sakhi" },
    ];
  }, [shown.id, shown.label]);

  const rail = (
    <div className="space-y-4">
      <Motivation
        text={me.tagline?.trim() || "I want to earn my own money and show my daughter it can be done."}
        name={me.first}
        onEdit={() => say("Your motivation is the line on your profile — change it there and it changes here.")}
      />
      <GoalsRail rows={goals} />
      <Achievements rows={badges} />
      <NeedGuidance />
      <OnYourWay />
    </div>
  );

  return (
    <HomeShell active="/app/journey" rail={rail} loadFailed="your journey">
      <div className="flex flex-col">
        <JourneyHero />

        <JourneyStats total={steps.length} done={tally.done} doing={tally.doing}
                      todo={tally.todo} cheer={cheer} />

        <Stepper steps={steps} at={shown.id} onPick={setPicked} />

        <StepCard step={shown} total={steps.length}
                  onCheck={() => say("These tick themselves. Each one turns green when you have actually done it — nothing here takes your word for it.")}
                  onLater={() => say("Saved. This step is here whenever you come back.")} />

        <Recommended rows={recs} />

        <div className="ux-toast rounded-[12px] px-5 py-3.5 text-xsm font-bold"
             data-on={note ? "true" : "false"} role="status" aria-live="polite"
             style={{ background: v("--ux-ink"), color: v("--ux-canvas"),
                      boxShadow: "0 20px 44px -18px rgba(0,0,0,.6)",
                      pointerEvents: note ? undefined : "none" }}>
          {note}
        </div>
      </div>
    </HomeShell>
  );
}
