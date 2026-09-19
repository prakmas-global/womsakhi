"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { TransitionLink } from "@/components/ux/TransitionLink";
import { I } from "@/components/ux/kit";
import { useLearning } from "@/components/ux/growth";
import styles from "./LearnDashboard.module.css";

const ART = "/ux/art/learn-dashboard-";
const stats = [
  { icon: "BookOpen", value: "18", label: "Active Courses", href: "/app/programs" },
  { icon: "Target", value: "6", label: "Completed", href: "/app/programs" },
  { icon: "Clock", value: "28", unit: "hrs", label: "Learning Time", href: "/app/programs" },
  { icon: "Bookmark", value: "4", label: "Certificates", href: "/app/certificates" },
  { icon: "Users", value: "12", label: "Mentors", href: "/app/mentors" },
  { icon: "Flame", value: "7", label: "Day Streak", href: "/app/goals" },
];

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
  return <div className={styles.sectionTitle}>
    <div><h2>{title}</h2>{detail && <span>{detail}</span>}</div>
    <TransitionLink href={href}>View all <I name="ArrowRight" /></TransitionLink>
  </div>;
}

function CalendarPanel() {
  const [month, setMonth] = useState(new Date(2026, 8, 1));
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const offset = new Date(year, monthIndex, 1).getDay();
  const count = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [...Array.from({ length: offset }, () => 0), ...Array.from({ length: count }, (_, i) => i + 1)];
  const move = (n: number) => setMonth(new Date(year, monthIndex + n, 1));
  return <section className={styles.railPanel} aria-label="Learning calendar">
    <div className={styles.calendarHead}>
      <button type="button" onClick={() => move(-1)} aria-label="Previous month"><I name="ChevronLeft" /></button>
      <h2>{month.toLocaleString("en-IN", { month: "long", year: "numeric" })}</h2>
      <button type="button" onClick={() => move(1)} aria-label="Next month"><I name="ChevronRight" /></button>
      <TransitionLink href="/app/schedule">View Calendar <I name="ArrowRight" /></TransitionLink>
    </div>
    <div className={styles.calendarGrid}>
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => <span className={styles.weekday} key={day}>{day}</span>)}
      {cells.map((day, i) => <span key={`${i}-${day}`} className={day === 19 && monthIndex === 8 && year === 2026 ? styles.today : ""}>{day || ""}</span>)}
    </div>
    <TransitionLink className={styles.calendarEvent} href="/app/schedule"><I name="CalendarDays" /> Upcoming learning sessions <I name="ArrowRight" /></TransitionLink>
  </section>;
}

export function LearnDashboard() {
  const { data: learning } = useLearning();
  const current = learning.continuing.find(course => (course.pct ?? 0) > 0) ?? learning.continuing[0];
  const currentHref = current ? `/app/programs/${current.id}` : "/app/programs";
  const currentPct = current?.pct ?? 0;

  return <HomeShell active="/app/learn" loadFailed="your learning" fit>
    <div className={styles.dashboard}>
      <div className={styles.main}>
        <section className={styles.hero}>
          <img src={`${ART}hero.webp`} alt="" aria-hidden="true" />
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>Learn <span>•</span> Grow <span>•</span> Achieve</p>
            <h1>Learn Without Limits</h1>
            <p>New skills. Better opportunities. A brighter you.</p>
            <div className={styles.heroActions}>
              <TransitionLink className={styles.primaryAction} href={currentHref}>Continue Learning <I name="ArrowRight" /></TransitionLink>
              <TransitionLink className={styles.videoAction} href="/app/programs"><span><I name="Play" /></span> Watch your<br />learning journey</TransitionLink>
            </div>
            <div className={styles.heroBenefits}>
              <span><I name="BadgeCheck" /> Practical Skills</span><span><I name="Users" /> Expert Mentors</span>
              <span><I name="Award" /> Recognised Certificates</span><span><I name="Briefcase" /> Real Opportunities</span>
            </div>
          </div>
        </section>

        <div className={styles.stats}>{stats.map(item => <TransitionLink className={styles.stat} href={item.href} key={item.label}>
          <span className={styles.statIcon}><I name={item.icon} /></span><span><strong>{item.value}<small>{item.unit}</small></strong><span>{item.label}</span></span>
        </TransitionLink>)}</div>

        <section className={styles.section}>
          <SectionTitle title="Continue Learning" href="/app/programs" />
          <div className={styles.continueCard}>
            <TransitionLink href={currentHref} className={styles.continueImage}><img src={`${ART}continue.webp`} alt="Woman studying at a laptop" /><span><I name="Play" /></span><b>{current ? "In Progress" : "Explore"}</b></TransitionLink>
            <div className={styles.continueDetails}><h3>{current?.title ?? "Find your next course"}</h3><p>{current ? "Pick up where you left off" : "Explore new skills and opportunities"}</p><div className={styles.progressLine}><span><i style={{ width: `${currentPct}%` }} /></span><strong>{currentPct}%</strong> complete</div></div>
            <TransitionLink href={currentHref} className={styles.continueButton}>{current ? "Continue" : "Explore"} <I name="ArrowRight" /></TransitionLink>
          </div>
        </section>

        <section className={styles.section}>
          <SectionTitle title="Recommended for You" detail="Based on your interests and goals" href="/app/programs" />
          <div className={styles.recommendations}>{recommendations.map(course => <TransitionLink className={styles.course} href={course.href} key={course.title}>
            <div className={styles.courseImage}><img src={`${ART}${course.image}.webp`} alt="" /><b>{course.badge}</b></div>
            <div className={styles.courseBody}><h3>{course.title}</h3><p>{course.sub}</p><span className={styles.courseMeta}><I name="BookOpenCheck" /> {course.level} · <I name="Clock" /> {course.time}</span><span className={styles.rating}><I name="Star" /> <strong>{course.rating}</strong> ({course.count}) <i><I name="Play" /></i></span></div>
          </TransitionLink>)}</div>
        </section>

        <section className={styles.section}>
          <SectionTitle title="Learning Paths" detail="Structured programs to help you achieve your goals" href="/app/programs" />
          <div className={styles.paths}>{paths.map(path => <TransitionLink href={path.href} className={styles.path} key={path.title}><span><I name={path.icon} /></span><div><h3>{path.title}</h3><p>{path.sub}</p><small>{path.count}</small></div></TransitionLink>)}</div>
        </section>
      </div>

      <aside className={styles.rightRail} aria-label="Learning overview">
        <blockquote className={styles.quote}><span aria-hidden="true">“</span><p>Learning is not just for today, but for the life you dream about.</p><cite>— WomSakhi</cite></blockquote>
        <CalendarPanel />
        <section className={styles.railPanel}><SectionTitle title="Upcoming Sessions" href="/app/schedule" /><div className={styles.sessions}>{sessions.map(session => <TransitionLink href="/app/schedule" className={styles.session} key={session.title}><span className={styles.date}><small>{session.month}</small>{session.day}</span><span><b className={styles.sessionType}>{session.type}</b><strong>{session.title}</strong><small>{session.when}</small></span></TransitionLink>)}</div></section>
        <section className={styles.railPanel}><SectionTitle title="My Learning Goals" href="/app/goals" /><div className={styles.goals}>{goals.map(goal => <TransitionLink href={goal.href} className={styles.goal} key={goal.title}><span className={styles.goalIcon}><I name={goal.icon} /></span><span className={styles.goalInfo}><span>{goal.title}<b>{goal.done}</b></span><i><i style={{ width: `${goal.pct}%` }} /></i></span></TransitionLink>)}</div></section>
      </aside>
    </div>
  </HomeShell>;
}
