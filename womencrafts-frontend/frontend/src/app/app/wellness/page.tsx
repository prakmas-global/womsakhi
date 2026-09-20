"use client";

import Image from "next/image";
import Link from "next/link";
import { Apple, ArrowRight, BookOpen, CalendarDays, ChevronLeft, ChevronRight, Droplets, Dumbbell, Footprints, HeartHandshake, Leaf, MessageCircle, MoonStar, Play, Sparkles, Sprout, Stethoscope } from "lucide-react";
import { HomeShell } from "@/components/ux/home/HomeShell";
import styles from "./wellness.module.css";

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
  return <HomeShell><div className={styles.page} data-dashboard="wellness">
    <section className={styles.hero} aria-labelledby="wellness-title">
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>Health &amp; wellness</p>
        <h1 id="wellness-title">Your wellbeing,<br /><em>our priority</em></h1>
        <p className={styles.intro}>A healthier you, a stronger tomorrow. Track, learn, get support and feel your best at every stage of life.</p>
        <div className={styles.heroLinks} aria-label="Wellness areas">
          <Link href="/app/health/cycle"><span><CalendarDays /></span>Track</Link><Link href="/app/health"><span><BookOpen /></span>Learn</Link>
          <Link href="/app/health/workouts"><span><Sprout /></span>Improve</Link><Link href="/app/health/mentors"><span><HeartHandshake /></span>Get support</Link>
        </div>
      </div>
      <div className={styles.heroArt}>
        <Image src="/ux/wellness/wellness-hero-v2.png" alt="A woman taking a calm moment for herself among soft botanical leaves" fill priority sizes="(max-width: 900px) 100vw, 58vw" />
        <p className={styles.heroNote}>Healthy women.<br />Happier world.<small>— WomSakhi</small></p>
        <blockquote>“Take care of yourself.<br />You&apos;re doing incredibly.”<cite>— WomSakhi</cite></blockquote>
      </div>
    </section>
    <section className={styles.primaryGrid}>
      <article className={`${styles.card} ${styles.wellnessCard}`}><header><h2>Today&apos;s wellness</h2><time>Thu, 18 Sep 2026</time></header>
        <div className={styles.wellnessBody}><div className={styles.score} aria-label="Wellness score 75 percent"><strong>75%</strong><span>Wellness<br />score</span></div>
          <div className={styles.scoreCopy}><h3>You&apos;re doing great, Priya!</h3><p>Keep going. Small steps make a big difference.</p>
            <div className={styles.metrics}><span><Footprints /><b>6,245</b><small>Steps</small></span><span><Droplets /><b>1.8 L</b><small>Water</small></span><span><MoonStar /><b>7h 20m</b><small>Sleep</small></span></div>
          </div></div>
      </article>
      <article className={`${styles.card} ${styles.cycleCard}`}><header><h2>My cycle</h2><span>Day 12 of 28</span></header>
        <div className={styles.cycleNav}><ChevronLeft /><div className={styles.cycleRing}><Droplets /><b>Fertile window</b><small>in 2 days</small></div><ChevronRight /></div>
        <Link className={styles.primaryButton} href="/app/health/cycle/log">Log period</Link>
      </article>
      <article className={`${styles.card} ${styles.actionsCard}`}><header><h2>Quick actions</h2></header><div className={styles.actionList}>
        {actions.map(([Icon,label,href]) => <Link key={label} href={href}><span><Icon /></span>{label}<ChevronRight /></Link>)}</div></article>
    </section>
    <section className={styles.secondaryGrid}>
      <article className={`${styles.card} ${styles.insights}`}><header><h2>Health insights</h2><Link href="/app/health">View all</Link></header><div className={styles.insightGrid}>
        {insights.map(([Icon,title,copy,href,tone]) => <Link key={title} href={href} className={styles[tone]}><span><Icon /></span><b>{title}</b><small>{copy}</small></Link>)}</div></article>
      <article className={`${styles.card} ${styles.recommended}`}><header><h2>Recommended for you</h2><Link href="/app/health/workouts">See all</Link></header>
        <Link href="/app/health/workouts" className={styles.videoCard}><Image src="/ux/wellness/morning-yoga-v2.png" alt="Woman practising an energising morning yoga stretch in the mountains" fill sizes="(max-width: 900px) 100vw, 32vw" /><span className={styles.videoShade} /><span className={styles.videoText}><b>10-min morning<br />yoga for energy</b><small>15 min · All levels</small></span><span className={styles.play}><Play fill="currentColor" /></span></Link><div className={styles.dots} aria-hidden><b /><i /><i /><i /><i /></div>
      </article>
      <article className={`${styles.card} ${styles.community}`}><header><div className={styles.communityTitle}><h2>Community support</h2><span className={styles.memberStack} aria-label="Women active in community"><Image src="/ux/art/avatar-woman-teal-shirt.webp" alt="" width={24} height={24} sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 240px" /><Image src="/ux/art/avatar-woman-hijab.webp" alt="" width={24} height={24} sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 240px" /><Image src="/ux/art/avatar-woman-purple-kurta.webp" alt="" width={24} height={24} sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 240px" /><Image src="/ux/art/avatar-woman-pink-glasses.webp" alt="" width={24} height={24} sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 240px" /></span></div><Link href="/app/circles">Join discussions <ArrowRight /></Link></header>
        <Link href="/app/circles" className={styles.discussion}><Image className={styles.avatar} src="/ux/art/avatar-woman-purple-kurta.webp" alt="Priya" width={34} height={34} sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 240px" /><span><b>Tips for healthy eating at work?</b><small>Posted in Nutrition</small></span><MessageCircle /><small>24</small></Link>
        <Link href="/app/circles" className={styles.discussion}><Image className={styles.avatar} src="/ux/art/avatar-woman-hijab.webp" alt="Aisha" width={34} height={34} sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 240px" /><span><b>How do you manage period pain?</b><small>Posted in Women&apos;s Health</small></span><MessageCircle /><small>18</small></Link>
        <Link href="/app/circles" className={styles.supportBanner}><span><b>You&apos;re not alone.</b><small>A community that cares.</small></span><Image src="/ux/wellness/community-women-v2.png" alt="Three women standing together in support" width={170} height={100} sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 240px" /><ArrowRight /></Link>
      </article>
    </section>
    <footer className={styles.mantra}><Leaf /><p>“Healthy women build healthier families, communities and a brighter world.” <cite>— WomSakhi</cite></p><Link href="/app/health">Together for a healthier tomorrow <ArrowRight /></Link></footer>
  </div></HomeShell>;
}
