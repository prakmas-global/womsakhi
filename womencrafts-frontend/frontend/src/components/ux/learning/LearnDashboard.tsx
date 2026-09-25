"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { useT } from "@/i18n";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { TransitionLink } from "@/components/ux/TransitionLink";
import { I } from "@/components/ux/kit";
import { useLearning } from "@/components/ux/growth";
import { useShell } from "@/components/ux/ShellProvider";
import { useResource } from "@/lib/use-resource";
import { apiCertificates } from "@/lib/me-api";
import { apiMyMentorRequests } from "@/lib/growth-api";
import { useCallback } from "react";
import styles from "./LearnDashboard.module.css";
import { DashboardNudge } from "@/components/ux/reminders/DashboardNudge";

const ART = "/ux/art/learn-dashboard-";
/**
 * Her six numbers — counted, not written down.
 *
 * These were fixed strings: 18 / 6 / 28 / 4 / 12 / 7, the same for every woman
 * in the product. For the account I checked, two of them were plainly wrong —
 * 18 active courses against 13 real enrolments, 4 certificates against 6 — and
 * they sat directly above a "Continue Learning" card that WAS real. Mixing the
 * two is worse than either, because she cannot tell which half to believe.
 *
 * "Day Streak" is gone rather than guessed: nothing in this product records
 * consecutive days, so there was no number to move it to.
 */
function statsFor(p: {
  active: number; completed: number; hours: number; certificates: number; mentors: number;
}) {
  return [
    { icon: "BookOpen", value: String(p.active), label: "Active Courses", href: "/app/programs" },
    { icon: "Target", value: String(p.completed), label: "Completed", href: "/app/programs" },
    { icon: "Clock", value: String(p.hours), unit: "hrs", label: "Learning Time", href: "/app/programs" },
    { icon: "Bookmark", value: String(p.certificates), label: "Certificates", href: "/app/certificates" },
    { icon: "Users", value: String(p.mentors), label: "Mentors", href: "/app/mentors" },
  ];
}

const recommendations = [
  { title: "Start Your Online Business", sub: "Turn your idea into income", image: "business", badge: "Popular", level: "Beginner", time: "2.5 hrs", rating: "4.8", count: "1.2k", href: "/app/programs" },
  { title: "Social Media for Growth", sub: "Build your personal brand", image: "social", badge: "Best for You", level: "Intermediate", time: "3 hrs", rating: "4.7", count: "856", href: "/app/programs" },
  { title: "Financial Basics for Women", sub: "Manage money with confidence", image: "finance", badge: "New", level: "Beginner", time: "2 hrs", rating: "4.9", count: "2.1k", href: "/app/programs" },
  { title: "Mindfulness & Mental Wellness", sub: "Feel calmer, stronger everyday", image: "mindfulness", badge: "Trending", level: "All Levels", time: "1.5 hrs", rating: "4.8", count: "980", href: "/app/programs" },
];

const paths = [
  { icon: "Briefcase", title: "Career & Jobs", sub: "Get job ready", count: "12 courses", href: "/app/programs" },
  { icon: "TrendingUp", title: "Entrepreneurship", sub: "Start and grow", count: "15 courses", href: "/app/programs" },
  { icon: "BadgeIndianRupee", title: "Money & Finance", sub: "Financial independence", count: "10 courses", href: "/app/programs" },
  { icon: "Heart", title: "Health & Wellness", sub: "A happier you", count: "9 courses", href: "/app/programs" },
];

const sessions = [
  { month: "SEP", day: "29", type: "Live", title: "Social Media Strategies", when: "Sep 29, 5:00 PM" },
  { month: "OCT", day: "03", type: "Mentor Session", title: "Career Guidance with Ananya", when: "Oct 3, 11:00 AM" },
  { month: "OCT", day: "04", type: "Webinar", title: "Women in Tech", when: "Oct 4, 4:00 PM" },
];

const goals = [
  { icon: "BookmarkCheck", title: "Complete 3 courses this month", done: "2/3", pct: 67, href: "/app/programs" },
  { icon: "CheckCircle2", title: "Learn a new skill", done: "1/1", pct: 100, href: "/app/goals" },
  { icon: "CalendarDays", title: "Attend 2 live sessions", done: "1/2", pct: 50, href: "/app/schedule" },
];

function SectionTitle({ title, detail, href }: { title: string; detail?: string; href: string }) {
  const tr = useT();
  return <div className={styles.sectionTitle}>
    <div><h2>{title}</h2>{detail && <span>{detail}</span>}</div>
    <TransitionLink href={href}>{tr("calendar.viewAll")} <I name="ArrowRight" /></TransitionLink>
  </div>;
}

function CalendarPanel() {
  const tr = useT();
  const [month, setMonth] = useState(new Date(2026, 8, 1));
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const offset = new Date(year, monthIndex, 1).getDay();
  const count = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [...Array.from({ length: offset }, () => 0), ...Array.from({ length: count }, (_, i) => i + 1)];
  const move = (n: number) => setMonth(new Date(year, monthIndex + n, 1));
  return <section className={styles.railPanel} aria-label={tr("learnDashboard.learningCalendar")}>
    <div className={styles.calendarHead}>
      <button type="button" onClick={() => move(-1)} aria-label={tr("schedule.previousMonth")}><I name="ChevronLeft" /></button>
      <h2>{month.toLocaleString("en-IN", { month: "long", year: "numeric" })}</h2>
      <button type="button" onClick={() => move(1)} aria-label={tr("schedule.nextMonth")}><I name="ChevronRight" /></button>
      <TransitionLink href="/app/schedule">{tr("homeRail.viewCalendar")} <I name="ArrowRight" /></TransitionLink>
    </div>
    <div className={styles.calendarGrid}>
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => <span className={styles.weekday} key={day}>{day}</span>)}
      {cells.map((day, i) => <span key={`${i}-${day}`} className={day === 19 && monthIndex === 8 && year === 2026 ? styles.today : ""}>{day || ""}</span>)}
    </div>
    <TransitionLink className={styles.calendarEvent} href="/app/schedule"><I name="CalendarDays" /> {tr("learnDashboard.upcomingLearningSessions")} <I name="ArrowRight" /></TransitionLink>
  </section>;
}

export function LearnDashboard() {
  const tr = useT();
  const { data: learning } = useLearning();

  // Counted from what the server already sends the shell, plus the two lists
  // that own the other two numbers. Nothing here is written down.
  const shell = useShell();
  const p = shell.data?.progress ?? {};
  const { data: certificates } = useResource(
    useCallback(async (s: AbortSignal) => apiCertificates(s), []), [],
  );
  const { data: mentorRequests } = useResource(
    useCallback(async (s: AbortSignal) => apiMyMentorRequests(s), []), [],
  );
  const stats = statsFor({
    active: p.programs_active ?? 0,
    completed: p.programs_completed ?? 0,
    hours: p.learning_hours ?? 0,
    certificates: certificates.length,
    mentors: mentorRequests.length,
  });
  const current = learning.continuing.find(course => (course.pct ?? 0) > 0) ?? learning.continuing[0];
  const currentHref = current ? `/app/programs/${current.id}` : "/app/programs";
  const currentPct = current?.pct ?? 0;

  return <HomeShell active="/app/learn" loadFailed="your learning" fit>
    <div className={styles.dashboard} data-dashboard="learn">
      <div className={styles.main}>
        <section className={styles.hero}>
          <picture>
            {/* The wide banner is composed for a laptop and carries lettering in
              its own artwork; a phone-shaped crop of it cuts the subject or the
              words. The phone gets a crop made for its shape. */}
            <source media="(max-width: 1023px)" srcSet={`${ART}hero-mobile.webp`} />
            <img src={`${ART}hero.webp`} alt="" aria-hidden="true" />
          </picture>
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>Learn <span>•</span> Grow <span>•</span> Achieve</p>
            <h1>{tr("learnDashboard.learnWithoutLimits")}</h1>
            <p>{tr("learnDashboard.newSkillsBetterOpportunitiesABrighter")}</p>
            <div className={styles.heroActions}>
              <TransitionLink className={styles.primaryAction} href={currentHref}>{tr("learnDashboard.continueLearning")} <I name="ArrowRight" /></TransitionLink>
              <TransitionLink className={styles.videoAction} href="/app/programs"><span><I name="Play" /></span> {tr("learnDashboard.watchYour")}<br />{tr("learnDashboard.learningJourney")}</TransitionLink>
            </div>
            <div className={styles.heroBenefits}>
              <span><I name="BadgeCheck" /> {tr("learnDashboard.practicalSkills")}</span><span><I name="Users" /> {tr("learnDashboard.expertMentors")}</span>
              <span><I name="Award" /> {tr("learnDashboard.recognisedCertificates")}</span><span><I name="Briefcase" /> {tr("learnDashboard.realOpportunities")}</span>
            </div>
          </div>
        </section>

        <div className={styles.stats}>{stats.map(item => <TransitionLink className={styles.stat} href={item.href} key={item.label}>
          <span className={styles.statIcon}><I name={item.icon} /></span><span><strong>{item.value}<small>{item.unit}</small></strong><span>{item.label}</span></span>
        </TransitionLink>)}</div>

        {/* Added to this dashboard, never in place of anything on it: the engine,
            reachable from the module it belongs to. */}
        <DashboardNudge
          preset="rem.preset.study"
          icon="GraduationCap" tint="var(--ux-tint-violet)" ink="var(--ux-violet-ink)"
          labelKey="nudge.learn.label" noteKey="nudge.learn.note" />

        <section className={styles.section}>
          <SectionTitle title={tr("learnDashboard.continueLearning")} href="/app/programs" />
          <div className={styles.continueCard}>
            <TransitionLink href={currentHref} className={styles.continueImage}><img src={`${ART}continue.webp`} alt={tr("learnDashboard.womanStudyingAtALaptop")} /><span><I name="Play" /></span><b>{current ? "In Progress" : "Explore"}</b></TransitionLink>
            <div className={styles.continueDetails}><h3>{current?.title ?? "Find your next course"}</h3><p>{current ? "Pick up where you left off" : "Explore new skills and opportunities"}</p><div className={styles.progressLine}><span><i style={{ width: `${currentPct}%` }} /></span><strong>{currentPct}%</strong> complete</div></div>
            <TransitionLink href={currentHref} className={styles.continueButton}>{current ? "Continue" : "Explore"} <I name="ArrowRight" /></TransitionLink>
          </div>
        </section>

        <section className={styles.section}>
          <SectionTitle title={tr("journey.recommendedForYou")} detail="Based on your interests and goals" href="/app/programs" />
          <div className={styles.recommendations}>{recommendations.map(course => <TransitionLink className={styles.course} href={course.href} key={course.title}>
            <div className={styles.courseImage}><img src={`${ART}${course.image}.webp`} alt="" /><b>{course.badge}</b></div>
            <div className={styles.courseBody}><h3>{course.title}</h3><p>{course.sub}</p><span className={styles.courseMeta}><I name="BookOpenCheck" /> {course.level} · <I name="Clock" /> {course.time}</span><span className={styles.rating}><I name="Star" /> <strong>{course.rating}</strong> ({course.count}) <i><I name="Play" /></i></span></div>
          </TransitionLink>)}</div>
        </section>

        <section className={styles.section}>
          <SectionTitle title={tr("learnDashboard.learningPaths")} detail="Structured programs to help you achieve your goals" href="/app/programs" />
          <div className={styles.paths}>{paths.map(path => <TransitionLink href={path.href} className={styles.path} key={path.title}><span><I name={path.icon} /></span><div><h3>{path.title}</h3><p>{path.sub}</p><small>{path.count}</small></div></TransitionLink>)}</div>
        </section>
      </div>

      <aside className={styles.rightRail} aria-label={tr("learnDashboard.learningOverview")}>
        <blockquote className={styles.quote}><span aria-hidden="true">“</span><p>{tr("learnDashboard.learningIsNotJustForToday")}</p><cite>— WomSakhi</cite></blockquote>
        <CalendarPanel />
        <section className={styles.railPanel}><SectionTitle title={tr("learnDashboard.upcomingSessions")} href="/app/schedule" /><div className={styles.sessions}>{sessions.map(session => <TransitionLink href="/app/schedule" className={styles.session} key={session.title}><span className={styles.date}><small>{session.month}</small>{session.day}</span><span><b className={styles.sessionType}>{session.type}</b><strong>{session.title}</strong><small>{session.when}</small></span></TransitionLink>)}</div></section>
        <section className={styles.railPanel}><SectionTitle title={tr("learnDashboard.myLearningGoals")} href="/app/goals" /><div className={styles.goals}>{goals.map(goal => <TransitionLink href={goal.href} className={styles.goal} key={goal.title}><span className={styles.goalIcon}><I name={goal.icon} /></span><span className={styles.goalInfo}><span>{goal.title}<b>{goal.done}</b></span><i><i style={{ width: `${goal.pct}%` }} /></i></span></TransitionLink>)}</div></section>
      </aside>
    </div>
  </HomeShell>;
}
