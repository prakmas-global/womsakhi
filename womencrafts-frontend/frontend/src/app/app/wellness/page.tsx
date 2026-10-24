"use client";

import Image from "next/image";
import { useT } from "@/i18n";
import Link from "next/link";
import { Apple, ArrowRight, BookOpen, CalendarDays, ChevronRight, Droplets, Dumbbell, Footprints, HeartHandshake, Leaf, MessageCircle, Play, Sparkles, Sprout, Stethoscope } from "lucide-react";
import { HomeShell } from "@/components/ux/home/HomeShell";
import styles from "./wellness.module.css";
import { DashboardNudge } from "@/components/ux/reminders/DashboardNudge";
import { useAuth } from "@/context/AuthContext";
import { useCycle } from "@/components/ux/cycle/use-cycle";
import { useCallback, useState } from "react";
import { useCircleRoom } from "@/components/ux/health/use-circle-room";
import { useResource } from "@/lib/use-resource";
import { apiPosts, type Post } from "@/lib/community-api";

/**
 * "Community support" — real posts from a real health circle.
 *
 * This card showed two invented discussions ("Tips for healthy eating at
 * work" by "Priya", 24 replies) and four stock avatars, all linking to the
 * circle list. Now it finds an actual health or wellness circle (hers first),
 * shows its two newest posts with their real reply counts, and offers to join
 * it for real — or, if there is no such circle yet, to start one.
 */
function CommunityCard() {
  const room = useCircleRoom(/health|wellness|period|nutrition|menopaus|mind|yoga|fitness/i);
  const id = room.room?.id ?? "";
  const canRead = Boolean(room.room && (room.joined || !room.room.is_private));
  const posts = useResource(useCallback(async (s: AbortSignal) => {
    void s;
    return id && canRead ? (await apiPosts(id).catch(() => [] as Post[])).slice(0, 2) : [];
  }, [id, canRead]), [] as Post[]);
  const [note, setNote] = useState("");
  const initials = (n: string) => n.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "W";

  return (
    <article className={`${styles.card} ${styles.community}`}>
      <header>
        <div className={styles.communityTitle}><h2>Community support</h2></div>
        <Link href={room.room ? `/app/circles/${room.room.id}` : "/app/circles"}>
          {room.room ? "Open the circle" : "Find circles"} <ArrowRight />
        </Link>
      </header>
      {room.loading ? null : !room.room ? (
        <Link href="/app/circles/create" className={styles.supportBanner}>
          <span><b>No health circle yet.</b><small>Start one — other women can find it and join.</small></span><ArrowRight />
        </Link>
      ) : (
        <>
          {posts.data.length ? posts.data.map((p) => (
            <Link key={p.id} href={`/app/circles/${room.room!.id}`} className={styles.discussion}>
              <span className={styles.avatar} aria-hidden>{initials(p.author_name)}</span>
              <span><b>{p.body.length > 70 ? `${p.body.slice(0, 70)}…` : p.body}</b><small>{p.author_name.split(" ")[0]} · in {room.room!.name}</small></span>
              <MessageCircle /><small>{p.reply_count}</small>
            </Link>
          )) : (
            <p style={{ padding: "8px 16px", fontSize: 12, color: "var(--ux-muted)" }}>
              {canRead ? "No posts yet — be the first to ask something." : `${room.room.name} is a private circle.`}
            </p>
          )}
          {room.joined ? (
            <Link href={`/app/circles/${room.room.id}`} className={styles.supportBanner}>
              <span><b>You are in {room.room.name}.</b><small>{room.room.member_count} women · ask anything</small></span><ArrowRight />
            </Link>
          ) : (
            <button type="button" className={styles.supportBanner} disabled={room.busy}
                    style={{ width: "calc(100% - 24px)", textAlign: "left", cursor: "pointer", border: 0 }}
                    onClick={async () => setNote((await room.join()) ? `You joined ${room.room!.name}.` : "Could not join just now.")}>
              <span><b>{note || `Join ${room.room.name}`}</b><small>{room.room.member_count} women · you are not alone</small></span><ArrowRight />
            </button>
          )}
        </>
      )}
    </article>
  );
}

const actions = [
  [CalendarDays, "Log my symptoms", "/app/health/cycle/log"], [Apple, "Track nutrition", "/app/health/nutrition"],
  [Dumbbell, "Start a workout", "/app/health/workouts"], [Leaf, "Check mental wellness", "/app/health/mind"],
  [Stethoscope, "Book a consultation", "/app/health/mentors"],
] as const;
const insights = [
  [Apple, "Nutrition", "Eat better, feel better", "/app/health/nutrition", "mint", "/ux/art/work-dashboard-kitchen.webp"],
  [Leaf, "Mental wellness", "A calmer, happier you", "/app/health/mind", "rose", "/ux/art/course-meditation.webp"],
  [Footprints, "Physical health", "Move, be stronger", "/app/health/workouts", "blue", "/ux/art/scene-woman-climbing-steps.webp"],
  [Sparkles, "Women's health", "Care at every stage", "/app/health", "pink", "/ux/art/onboarding-wellbeing-all-ages-v2.webp"],
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
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  });

  return <HomeShell columns><div className={styles.page} data-dashboard="wellness">
    <section className={styles.hero} aria-labelledby="wellness-title">
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>Health &amp; wellness</p>
        <h1 id="wellness-title">{tr("wellness.yourWellbeing")}<br /><em>{tr("wellness.ourPriority")}</em></h1>
        <p className={styles.intro}>{tr("wellness.aHealthierYouAStrongerTomorrow")}</p>
        <div className={styles.heroLinks} aria-label={tr("wellness.wellnessAreas")}>
          <Link href="/app/health/cycle"><span><CalendarDays /></span>Track</Link><Link href="/app/health"><span><BookOpen /></span>Learn</Link>
          <Link href="/app/health/workouts"><span><Sprout /></span>Improve</Link><Link href="/app/health/mentors"><span><HeartHandshake /></span>{tr("wellness.getSupport")}</Link><Link href="/app/health/games"><span><Sparkles /></span>Relax</Link>
        </div>
      </div>
      <div className={styles.heroArt}>
        <Image src="/ux/wellness/wellness-hero-v2.webp" alt={tr("wellness.aWomanTakingACalmMoment")} fill priority sizes="(max-width: 900px) 100vw, 58vw" />
        <p className={styles.heroNote}>{tr("wellness.healthyWomen")}<br />{tr("wellness.happierWorld")}<small>— WomSakhi</small></p>
        <blockquote>{tr("wellness.takeCareOfYourself")}<br />You&apos;re doing incredibly.”<cite>— WomSakhi</cite></blockquote>
      </div>
    </section>
    {/* Added to this dashboard, never in place of anything on it: the engine,
        reachable from the module it belongs to. */}
    <DashboardNudge href="/app/health/today" className={styles.nudgeSpacing}
      icon="HeartPulse" tint="var(--ux-tint-green)" ink="var(--ux-green-ink)"
      labelKey="nudge.cycle.label" noteKey="nudge.cycle.note" />

    {/* A few quiet minutes: breathing, bubbles, pairs and a rangoli to colour. */}
    <Link href="/app/health/games" className="ux-card ux-hov group relative mb-4 flex min-h-[132px] items-center overflow-hidden"
          style={{ padding: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ux/art/course-meditation.webp" alt="" className="h-[132px] w-[132px] shrink-0 object-cover sm:w-[200px]" />
      <span className="min-w-0 flex-1 px-4 py-3">
        <span className="block text-xs font-bold uppercase tracking-[0.08em]" style={{ color: "var(--ux-brand)" }}>Calm games</span>
        <span className="mt-1 block text-base font-bold" style={{ color: "var(--ux-ink)" }}>Need a calm minute?</span>
        <span className="mt-1 block text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>
          Breathe with me, pop bubbles, match pairs or colour a rangoli. No scores, no hurry.
        </span>
      </span>
      <span className="me-4 hidden rounded-[10px] px-4 py-2 text-xs font-bold sm:block"
            style={{ background: "var(--ux-brand-600)", color: "var(--ux-ink-on-brand)" }}>Play</span>
    </Link>

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
        <div className={styles.cycleNav} style={{ justifyContent: "center" }}><div className={styles.cycleRing}><Droplets />
          <b>{status?.phase_label || tr("wellness.notStarted")}</b>
          <small>{status?.days_until != null ? tr("wellness.inDays", { days: status.days_until }) : tr("wellness.logAFewDays")}</small>
        </div></div>
        <Link className={styles.primaryButton} href={cycleOn ? "/app/health/cycle/log" : "/app/health/cycle/start"}>
          {cycleOn ? tr("wellness.logPeriod") : tr("wellness.startTracking")}
        </Link>
      </article>
      <article className={`${styles.card} ${styles.actionsCard}`}><header><h2>{tr("goalviews.quickActions")}</h2></header><div className={styles.actionList}>
        {actions.map(([Icon,label,href]) => <Link key={label} href={href}><span><Icon /></span>{label}<ChevronRight /></Link>)}</div></article>
    </section>
    <section className={styles.secondaryGrid}>
      <article className={`${styles.card} ${styles.insights}`}><header><h2>{tr("wellness.healthInsights")}</h2><Link href="/app/health">{tr("calendar.viewAll")}</Link></header><div className={styles.insightGrid}>
        {/* A picture per area, so the four read before the words do. */}
        {insights.map(([Icon,title,copy,href,tone,art]) => <Link key={title} href={href} className={styles[tone]}
              style={{ display: "flex", flexDirection: "column", padding: 0, overflow: "hidden", alignItems: "stretch" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={art} alt="" loading="lazy" style={{ width: "100%", height: 92, objectFit: "cover", background: "var(--ux-surface-2)" }} />
          <span style={{ display: "flex", width: "auto", height: "auto", alignItems: "center", gap: 8, padding: "10px 12px", background: "transparent", borderRadius: 0, placeItems: "initial", color: "inherit" }}>
            <Icon style={{ width: 16, height: 16, flex: "none" }} /><b>{title}</b>
          </span>
          <small style={{ padding: "0 12px 12px" }}>{copy}</small>
        </Link>)}</div></article>
      <article className={`${styles.card} ${styles.recommended}`}><header><h2>{tr("wellness.recommendedForYou")}</h2><Link href="/app/health/workouts">{tr("circles.seeAll")}</Link></header>
        <Link href="/app/health/workouts" className={styles.videoCard}><Image src="/ux/wellness/morning-yoga-v2.webp" alt={tr("wellness.womanPractisingAnEnergisingMorningYoga")} fill sizes="(max-width: 900px) 100vw, 32vw" /><span className={styles.videoShade} /><span className={styles.videoText}><b>10-min morning<br />{tr("wellness.yogaForEnergy")}</b><small>15 min · All levels</small></span><span className={styles.play}><Play fill="currentColor" /></span></Link><div className={styles.dots} aria-hidden><b /><i /><i /><i /><i /></div>
      </article>
      <CommunityCard />
    </section>
    <footer className={styles.mantra}><Leaf /><p>{tr("wellness.healthyWomenBuildHealthierFamiliesCommunitie")} <cite>— WomSakhi</cite></p><Link href="/app/health">{tr("wellness.togetherForAHealthierTomorrow")} <ArrowRight /></Link></footer>
  </div></HomeShell>;
}
