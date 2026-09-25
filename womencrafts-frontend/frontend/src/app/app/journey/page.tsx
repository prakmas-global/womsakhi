"use client";

import { useCallback, useMemo, useState } from "react";
import { useT } from "@/i18n";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, BriefcaseBusiness, Heart, IndianRupee, MessageCircle, Target, UsersRound } from "lucide-react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { ScreenError, ScreenSkeleton, v } from "@/components/ux/kit";
import { useMe } from "@/components/ux/me";
import { useMeFacts } from "@/services/me.repository";
import {
  currentStep, journeySteps, stepState,
  type JourneyStep,
} from "@/services/journey";
import { apiGoals, type Goal } from "@/lib/money-api";
import { useResource } from "@/lib/use-resource";
import {
  Achievements, GoalsRail, Motivation, NeedGuidance,
  OnYourWay,
  type Badge, type Rec, type RailGoal,
} from "./journey-views";
import styles from "./journey.module.css";

/** Her goals, or none — never the four invented ones this rail used to show. */
const NO_GOALS: Goal[] = [];

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
  const tr = useT();
  const me = useMe();

  /**
   * What she has actually done — one read, from the server.
   *
   * This was `readJourneyState()`, a synchronous call into a file of fixtures:
   * five listings she had not made, an earnings total assembled from fabricated
   * payment requests, a shop recorded as open before she had opened one. Two of
   * the seven steps ticked themselves on that, and the stepper stood her
   * wherever the fixture said.
   *
   * `null` means we do not know yet, or could not find out. It is never
   * silently read as zero — see the guard below the hooks.
   */
  const { data: facts, source } = useMeFacts();

  /** Goals she set herself. Empty is a real answer; a fixture was not. */
  const goalsRead = useResource(apiGoals, NO_GOALS);

  const [note, setNote] = useState<string | null>(null);

  const say = useCallback((msg: string) => {
    setNote(msg);
    window.setTimeout(() => setNote((n) => (n === msg ? null : n)), 3400);
  }, []);

  const steps = useMemo(() => (facts ? journeySteps(facts) : []), [facts]);
  const here = useMemo(() => (steps.length ? currentStep(steps) : null), [steps]);
  const shown: JourneyStep | null = here;

  const tally = useMemo(() => {
    const by = { done: 0, doing: 0, todo: 0 };
    for (const s of steps) by[stepState(s)] += 1;
    return by;
  }, [steps]);

  /** Said about what she has done, never about who she is. */
  /* ── The rail ─────────────────────────────────────────────────────────── */

  /**
   * Three of her own goals.
   *
   * The four that used to be here were written for her — "Buy my own machine",
   * "So I stop paying rent on someone else's" — in the first person, in a rail
   * headed "My goals". `/me/goals` has carried the real ones all along, and
   * the server computes the percentage from whatever counts that goal, so
   * nothing is recomputed here.
   */
  const goals: RailGoal[] = useMemo(
    () => goalsRead.data
      .filter((g) => g.status === "open")
      .slice(0, 3)
      .map((g) => ({
        id: g.id,
        title: g.label,
        pct: g.pct,
        have: g.pct > 0 ? `${g.pct}%` : "Not yet",
        icon: g.icon || "Target",
        tint: "--ux-tint-amber",
        ink: "--ux-amber-ink",
      })),
    [goalsRead.data],
  );

  /**
   * Four badges, each one earned by something on this very screen.
   *
   * Not a separate list of achievements that could disagree with the steps —
   * the same facts, read again, so a woman can always point at the thing that
   * earned her the badge.
   */
  const badges: Badge[] = useMemo(() => (facts ? [
    { id: "learner", label: tr("journey.earlyLearner"), icon: "GraduationCap", earned: facts.coursesDone > 0,
      tint: "--ux-tint-violet", ink: "--ux-violet-ink" },
    { id: "member",  label: tr("journey.activeMember"), icon: "HeartHandshake", earned: facts.circles > 0,
      tint: "--ux-tint-pink", ink: "--ux-pink-ink" },
    { id: "setter",  label: tr("journey.goalSetter"),   icon: "Target", earned: goals.length > 0,
      tint: "--ux-tint-amber", ink: "--ux-amber-ink" },
    { id: "next",    label: tr("journey.nextBadge"),    icon: "Award", earned: false,
      tint: "--ux-surface-2", ink: "--ux-faint" },
  ] : []), [facts, goals.length]);

  /** Reading that belongs to the step she is standing in. */
  const recs: Rec[] = useMemo(() => {
    const forStep: Record<string, Rec[]> = {
      proof: [
        { id: "r1", title: tr("journey.howToCreateAPortfolio"), kind: "Video", meta: "12 min",
          icon: "Play", tint: "--ux-tint-violet", ink: "--ux-violet-ink", href: "/app/programs" },
        { id: "r2", title: tr("journey.certificateTemplates"), kind: "Resource", meta: "PDF",
          icon: "FileText", tint: "--ux-tint-pink", ink: "--ux-pink-ink", href: "/app/certificates" },
        { id: "r3", title: tr("journey.writingAGreatProfile"), kind: "Guide", meta: "8 min",
          icon: "BookOpen", tint: "--ux-tint-blue", ink: "--ux-blue-ink", href: "/app/profile" },
        { id: "r4", title: tr("journey.realStoriesFromWomenLikeYou"), kind: "Article", meta: "5 min",
          icon: "Sparkles", tint: "--ux-tint-green", ink: "--ux-green-ink", href: "/app/stories" },
      ],
    };
    if (!shown) return [];
    return forStep[shown.id] ?? [
      { id: "d1", title: `Courses for ${shown.label.toLowerCase()}`, kind: "Guide", meta: "Browse",
        icon: "BookOpen", tint: "--ux-tint-violet", ink: "--ux-violet-ink", href: "/app/programs" },
      { id: "d2", title: tr("journey.womenWhoHaveDoneThis"), kind: "Article", meta: "5 min",
        icon: "Sparkles", tint: "--ux-tint-green", ink: "--ux-green-ink", href: "/app/stories" },
      { id: "d3", title: tr("journey.findAMentor"), kind: "Guide", meta: "10 min",
        icon: "BookOpen", tint: "--ux-tint-pink", ink: "--ux-pink-ink", href: "/app/mentors" },
      { id: "d4", title: tr("journey.askSakhiWhatIsNext"), kind: "Video", meta: "2 min",
        icon: "Play", tint: "--ux-tint-blue", ink: "--ux-blue-ink", href: "/app/sakhi" },
    ];
  }, [shown]);

  const rail = (
    <div className="space-y-4">
      {/* Her words or none. The fallback here was a sentence somebody else
          wrote — "I want to earn my own money and show my daughter it can be
          done" — printed as a quotation with her name under it, on top of a
          `tagline` that was a module constant for every woman in the app. */}
      <Motivation
        text={facts ? facts.bio : null}
        name={me.first}
        onEdit={() => say("Your motivation is the line on your profile — change it there and it changes here.")}
      />
      <GoalsRail rows={goals} loading={goalsRead.source === "loading"} />
      {facts && <Achievements rows={badges} />}
      <NeedGuidance />
      <OnYourWay />
    </div>
  );

  /**
   * Nothing about her journey is drawn until her journey is known.
   *
   * The hero above it is fixed artwork and could be shown either way, but four
   * counters reading 0/0/0 and seven empty circles is not a loading state — it
   * is a screen telling a woman she has done none of it. So the whole thing
   * waits, and says which of the two it is waiting on.
   */
  if (!facts || !shown) {
    return (
      <HomeShell active="/app/journey" rail={rail} loadFailed="your journey" skeleton="detail">
        {source === "loading"
          ? <ScreenSkeleton shape="detail" />
          : <ScreenError what="your journey" />}
      </HomeShell>
    );
  }

  return (
    <HomeShell active="/app/journey" rail={rail} loadFailed="your journey">
      <div className={styles.page} data-dashboard="journey">
        <section className={styles.hero} aria-labelledby="journey-title">
          <Image src="/ux/journey/journey-hero-v1.png" alt={tr("journey.womenOfDifferentAgesAndBackgrounds")} fill priority sizes="(max-width: 760px) 100vw, 70vw" />
          <div className={styles.heroShade} />
          <div className={styles.heroCopy}>
            <p>{tr("ch.journey.label")}</p>
            <h1 id="journey-title">{tr("journey.smallSteps")}<br /><em>{tr("journey.bigDreams")}</em></h1>
            <span>{tr("journey.yourJourneyIsUniqueExploreLearn")}</span>
          </div>
          <p className={styles.heroWords}>Learn<br />Earn<br />Connect<br />Grow<br />Together <Heart /></p>
        </section>
        <nav className={styles.tabs} aria-label={tr("journey.journeyAreas")}>
          {[['Overview','Sparkles','/app/journey'],['Learning','BookOpen','/app/learn'],['Work','Briefcase','/app/work'],['Earn','IndianRupee','/app/earn'],['Circle','Users','/app/circle'],['Health & Wellness','Heart','/app/wellness'],['Goals','Target','/app/goals']].map(([label,icon,href],index)=><Link href={href} key={label} aria-current={index===0?'page':undefined}><span>{icon==='BookOpen'?<BookOpen/>:icon==='Briefcase'?<BriefcaseBusiness/>:icon==='IndianRupee'?<IndianRupee/>:icon==='Users'?<UsersRound/>:icon==='Heart'?<Heart/>:icon==='Target'?<Target/>:<Target/>}</span>{label}</Link>)}
        </nav>

        <div className={styles.featureGrid}>
          <section className={styles.motivationCard}><Image src="/ux/journey/journey-motivation-v1.png" alt={tr("journey.womanLookingAcrossAMountainValley")} fill sizes="(max-width:760px) 100vw, 45vw"/><div className={styles.motivationShade}/><div><small>Today&apos;s motivation</small><blockquote>{tr("journey.everyStepYouTake")}<br/>{tr("journey.buildsTheStrongerYou")}</blockquote><cite>— WomSakhi</cite></div></section>
          <section className={styles.quick}><header><h2>{tr("journey.quickActions")}</h2><p>{tr("journey.jumpIntoWhatMattersMost")}</p></header><div>{[
            [BookOpen,'Explore Learning','/app/learn'],[BriefcaseBusiness,'Find Opportunities','/app/opportunities'],[Target,'Track Goals','/app/goals'],[UsersRound,'Join Circle','/app/circles'],[Heart,'Check Health','/app/wellness'],[MessageCircle,'Ask Sakhi','/app/sakhi'],
          ].map(([Icon,label,href])=><Link href={href as string} key={label as string}><span><Icon/></span>{label as string}</Link>)}</div></section>
        </div>

        <section className={styles.glance}><header><h2>{tr("journey.yourJourneyAtAGlance")}</h2><p>Here&apos;s where you stand and what&apos;s next.</p></header><div>{[
          [BookOpen,facts.coursesDone,'Learning milestones','/app/learn'],[BriefcaseBusiness,facts.applications,'Opportunities','/app/work'],[IndianRupee,facts.earnedMinor>0?1:0,'Income sources','/app/earn'],[UsersRound,facts.circles,'Communities','/app/circle'],[Heart,`${Math.round(tally.done/steps.length*100)}%`,'Journey progress','/app/goals'],
        ].map(([Icon,value,label,href])=>{const MetricIcon=Icon as typeof BookOpen;return <Link href={href as string} key={label as string}><span><MetricIcon/></span><strong>{value as string | number}</strong><small>{label as string}</small><b>{tr("journey.exploreMore")} <ArrowRight/></b></Link>})}</div></section>

        <section className={styles.recommended}><header><div><h2>{tr("journey.recommendedForYou")}</h2><p>Based on your current journey step: {shown.label}.</p></div><Link href="/app/programs">{tr("calendar.viewAll")} <ArrowRight/></Link></header><div>{recs.map((rec,index)=><Link href={rec.href} key={rec.id} className={styles.rec}><Image src={['/ux/art/learn-dashboard-finance.webp','/ux/art/work-dashboard-writing.webp','/ux/art/circle-study-group.webp','/ux/wellness/morning-yoga-v2.png'][index%4]} alt="" fill sizes="240px"/><span><small>{rec.kind}</small><strong>{rec.title}</strong><b>{rec.meta}</b><i>Explore <ArrowRight/></i></span></Link>)}</div></section>

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
