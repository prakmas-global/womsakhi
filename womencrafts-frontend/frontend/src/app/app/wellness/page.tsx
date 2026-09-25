"use client";

import Image from "next/image";
import { useT } from "@/i18n";
import Link from "next/link";
import { Apple, ArrowRight, BookOpen, CalendarDays, ChevronLeft, ChevronRight, Droplets, Dumbbell, Footprints, HeartHandshake, Leaf, MessageCircle, Play, Sparkles, Sprout, Stethoscope } from "lucide-react";
import { HomeShell } from "@/components/ux/home/HomeShell";
import styles from "./wellness.module.css";
import { DashboardNudge } from "@/components/ux/reminders/DashboardNudge";
import { useAuth } from "@/context/AuthContext";
import { useCycle } from "@/components/ux/cycle/use-cycle";

const actions = [
  [CalendarDays, "Log my symptoms", "/app/health/cycle/log"], [Apple, "Track nutrition", "/app/health/nutrition"],
  [Dumbbell, "Start a workout", "/app/health/workouts"], [Leaf, "Check mental wellness", "/app/health/mind"],
  [Stethoscope, "Book a consultation", "/app/health/mentors"],
] as const;
const insights = [
  [Apple, "Nutrition", "Eat better, feel better", "/app/health/nutrition", "mint"],
  [Leaf, "Mental wellness", "A calmer, happier you", "/app/health/mind", "rose"],
  [Footprints, "Physical health", "Move, be stronger", "/app/health/workouts", "blue"],
  [Sparkles, "Women's health", "Care at every stage", "/app/health", "pink"],
] as const;

export default function WellnessDashboard() {
  const tr = useT();
  /*
    Her name and her cycle, from her account — not from the mock.

    This screen greeted every woman as "You're doing great, Priya!", dated
    itself "Thu, 18 Sep 2026" whatever the day, and showed 6,245 steps, 1.8 L
    of water and 7h 20m of sleep for a product that has never asked her any of
    those things, next to "Day 12 of 28 · Fertile window in 2 days" for a woman
    whose cycle tracker was not switched on.

    The last of those is why this is a correctness bug and not a polish one:
    a fertile window is something she may act on. The cycle ENGINE is already
    honest — it answers `cycle_day: null` until she has logged a real period —
    so the only thing that was guessing was this card.
  */
  const { user } = useAuth();
  const firstName = (user?.full_name || "").trim().split(" ")[0] || "";
  const { data: cycle } = useCycle();
  const cycleOn = Boolean(cycle && "setup" in cycle && cycle.setup);
  const status = cycleOn && cycle && "status" in cycle ? cycle.status : null;
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });

  return <HomeShell><div className={styles.page} data-dashboard="wellness">
    <section className={styles.hero} aria-labelledby="wellness-title">
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>Health &amp; wellness</p>
        <h1 id="wellness-title">{tr("wellness.yourWellbeing")}<br /><em>{tr("wellness.ourPriority")}</em></h1>
        <p className={styles.intro}>{tr("wellness.aHealthierYouAStrongerTomorrow")}</p>
        <div className={styles.heroLinks} aria-label={tr("wellness.wellnessAreas")}>
          <Link href="/app/health/cycle"><span><CalendarDays /></span>Track</Link><Link href="/app/health"><span><BookOpen /></span>Learn</Link>
          <Link href="/app/health/workouts"><span><Sprout /></span>Improve</Link><Link href="/app/health/mentors"><span><HeartHandshake /></span>{tr("wellness.getSupport")}</Link>
        </div>
      </div>
      <div className={styles.heroArt}>
        <Image src="/ux/wellness/wellness-hero-v2.png" alt={tr("wellness.aWomanTakingACalmMoment")} fill priority sizes="(max-width: 900px) 100vw, 58vw" />
        <p className={styles.heroNote}>{tr("wellness.healthyWomen")}<br />{tr("wellness.happierWorld")}<small>— WomSakhi</small></p>
        <blockquote>{tr("wellness.takeCareOfYourself")}<br />You&apos;re doing incredibly.”<cite>— WomSakhi</cite></blockquote>
      </div>
    </section>
    {/* Added to this dashboard, never in place of anything on it: the engine,
        reachable from the module it belongs to. */}
    <DashboardNudge href="/app/health/today" className={styles.nudgeSpacing}
      icon="HeartPulse" tint="var(--ux-tint-green)" ink="var(--ux-green-ink)"
      labelKey="nudge.cycle.label" noteKey="nudge.cycle.note" />

    <section className={styles.primaryGrid}>
      {/*
        No score, no steps, no water, no sleep.

        Nothing in this product measures any of them — there is no pedometer,
        no device integration and no screen that ever asks. Four invented
        numbers under the heading "Today's wellness" taught her the rest of the
        page was invented too. What IS true is whether she has told us how she
        is today, so that is what this card says, and the one tap that changes
        it is the whole card.
      */}
      <article className={`${styles.card} ${styles.wellnessCard}`}><header><h2>Today&apos;s wellness</h2><time>{today}</time></header>
        <div className={styles.wellnessBody}>
          <div className={`${styles.score} ${styles.scoreBlank}`} aria-hidden><Leaf /></div>
          <div className={styles.scoreCopy}>
            <h3>{firstName ? tr("wellness.youAreDoingGreat", { name: firstName }) : tr("wellness.youAreDoingGreatNoName")}</h3>
            <p>{tr("wellness.keepGoingSmallStepsMakeA")}</p>
            <Link href="/app/health/today" className={styles.todayAsk}>
              <HeartHandshake />
              <span><b>{tr("wellness.howAreYouToday")}</b><small>{tr("wellness.oneTapOnlyYou")}</small></span>
            </Link>
          </div>
        </div>
      </article>
      {/*
        Her real cycle, or plainly nothing.

        "Day 12 of 28" and "Fertile window in 2 days" were fixed text. A
        fertile window is something a woman may act on to conceive or to avoid
        it, and this one was shown to an account with the tracker switched off.
        The engine answers `cycle_day: null` until she has logged a real
        period; this card now says exactly what the engine knows and no more.
      */}
      <article className={`${styles.card} ${styles.cycleCard}`}><header><h2>{tr("wellness.myCycle")}</h2>
        <span>{status?.cycle_day ? tr("wellness.dayOf", { day: status.cycle_day, length: status.avg_cycle }) : tr("wellness.notStarted")}</span></header>
        <div className={styles.cycleNav}><ChevronLeft /><div className={styles.cycleRing}><Droplets />
          <b>{status?.phase_label || tr("wellness.notStarted")}</b>
          <small>{status?.days_until != null ? tr("wellness.inDays", { days: status.days_until }) : tr("wellness.logAFewDays")}</small>
        </div><ChevronRight /></div>
        <Link className={styles.primaryButton} href={cycleOn ? "/app/health/cycle/log" : "/app/health/cycle/start"}>
          {cycleOn ? tr("wellness.logPeriod") : tr("wellness.startTracking")}
        </Link>
      </article>
      <article className={`${styles.card} ${styles.actionsCard}`}><header><h2>{tr("goalviews.quickActions")}</h2></header><div className={styles.actionList}>
        {actions.map(([Icon,label,href]) => <Link key={label} href={href}><span><Icon /></span>{label}<ChevronRight /></Link>)}</div></article>
    </section>
    <section className={styles.secondaryGrid}>
      <article className={`${styles.card} ${styles.insights}`}><header><h2>{tr("wellness.healthInsights")}</h2><Link href="/app/health">{tr("calendar.viewAll")}</Link></header><div className={styles.insightGrid}>
        {insights.map(([Icon,title,copy,href,tone]) => <Link key={title} href={href} className={styles[tone]}><span><Icon /></span><b>{title}</b><small>{copy}</small></Link>)}</div></article>
      <article className={`${styles.card} ${styles.recommended}`}><header><h2>{tr("wellness.recommendedForYou")}</h2><Link href="/app/health/workouts">{tr("circles.seeAll")}</Link></header>
        <Link href="/app/health/workouts" className={styles.videoCard}><Image src="/ux/wellness/morning-yoga-v2.png" alt={tr("wellness.womanPractisingAnEnergisingMorningYoga")} fill sizes="(max-width: 900px) 100vw, 32vw" /><span className={styles.videoShade} /><span className={styles.videoText}><b>10-min morning<br />{tr("wellness.yogaForEnergy")}</b><small>15 min · All levels</small></span><span className={styles.play}><Play fill="currentColor" /></span></Link><div className={styles.dots} aria-hidden><b /><i /><i /><i /><i /></div>
      </article>
      <article className={`${styles.card} ${styles.community}`}><header><div className={styles.communityTitle}><h2>{tr("wellness.communitySupport")}</h2><span className={styles.memberStack} aria-label={tr("wellness.womenActiveInCommunity")}><Image src="/ux/art/avatar-woman-teal-shirt.webp" alt="" width={24} height={24} sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 240px" /><Image src="/ux/art/avatar-woman-hijab.webp" alt="" width={24} height={24} sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 240px" /><Image src="/ux/art/avatar-woman-purple-kurta.webp" alt="" width={24} height={24} sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 240px" /><Image src="/ux/art/avatar-woman-pink-glasses.webp" alt="" width={24} height={24} sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 240px" /></span></div><Link href="/app/circles">{tr("wellness.joinDiscussions")} <ArrowRight /></Link></header>
        <Link href="/app/circles" className={styles.discussion}><Image className={styles.avatar} src="/ux/art/avatar-woman-purple-kurta.webp" alt="Priya" width={34} height={34} sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 240px" /><span><b>{tr("wellness.tipsForHealthyEatingAtWork")}</b><small>{tr("wellness.postedInNutrition")}</small></span><MessageCircle /><small>24</small></Link>
        <Link href="/app/circles" className={styles.discussion}><Image className={styles.avatar} src="/ux/art/avatar-woman-hijab.webp" alt="Aisha" width={34} height={34} sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 240px" /><span><b>{tr("wellness.howDoYouManagePeriodPain")}</b><small>Posted in Women&apos;s Health</small></span><MessageCircle /><small>18</small></Link>
        <Link href="/app/circles" className={styles.supportBanner}><span><b>You&apos;re not alone.</b><small>{tr("wellness.aCommunityThatCares")}</small></span><Image src="/ux/wellness/community-women-v2.png" alt={tr("wellness.threeWomenStandingTogetherInSupport")} width={170} height={100} sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 240px" /><ArrowRight /></Link>
      </article>
    </section>
    <footer className={styles.mantra}><Leaf /><p>{tr("wellness.healthyWomenBuildHealthierFamiliesCommunitie")} <cite>— WomSakhi</cite></p><Link href="/app/health">{tr("wellness.togetherForAHealthierTomorrow")} <ArrowRight /></Link></footer>
  </div></HomeShell>;
}
