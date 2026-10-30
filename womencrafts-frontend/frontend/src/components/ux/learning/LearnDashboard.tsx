"use client";
/* eslint-disable @next/next/no-img-element */

import { SectionPictures } from "@/components/ux/nav/Hub";
import { useMemo, useState } from "react";
import { useT } from "@/i18n";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { TransitionLink } from "@/components/ux/TransitionLink";
import { I } from "@/components/ux/kit";
import { useLearning, useMentorSessions } from "@/components/ux/growth";
import { useShell } from "@/components/ux/ShellProvider";
import { useResource } from "@/lib/use-resource";
import { apiCertificates } from "@/lib/me-api";
import { apiEvents, apiMyMentorRequests, type GrowthEvent } from "@/lib/growth-api";
import { apiGoals, type Goal } from "@/lib/money-api";
import { useCallback } from "react";
import styles from "./LearnDashboard.module.css";
import { DashboardNudge } from "@/components/ux/reminders/DashboardNudge";
import { pictureOr, useMasterPictures } from "@/components/ux/media/MasterPictures";

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

/** "₹499" or "Free" — what a course costs her. */
const priceLabel = (minor?: number) => (minor ? `₹${(minor / 100).toLocaleString("en-IN")}` : "Free");

/**
 * Learning paths, each a group of course categories — counted from the real
 * catalogue. The paths and their categories are the "course_categories" master
 * staff control (Masters → Course categories); this list is what shows until
 * it loads, and if it can't.
 */
const PATHS = [
  { icon: "Briefcase", title: "Career & Jobs", sub: "Get job ready", cats: ["Digital Literacy", "Languages", "Personal Development"] },
  { icon: "TrendingUp", title: "Entrepreneurship", sub: "Start and grow", cats: ["Entrepreneurship", "Handicrafts", "Cooking & Food", "Beauty & Care", "Sustainability"] },
  { icon: "BadgeIndianRupee", title: "Money & Finance", sub: "Financial independence", cats: ["Money & Savings"] },
  { icon: "Heart", title: "Health & Wellness", sub: "A happier you", cats: ["Health & Wellness"] },
];

/**
 * What is coming up for HER — workshops she registered for and mentor
 * sessions a mentor accepted. These were three hardcoded sessions ("Career
 * Guidance with Ananya, Oct 3") and three hardcoded goals at 67/100/50%, the
 * same for every woman; the calendar beside them was pinned to September 2026
 * with the 19th marked as today.
 */
interface Upcoming { key: string; date: Date | null; type: string; title: string; when: string; href: string }

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
/** A day out of a time she or her mentor typed ("Sat 25 Oct, 11 am"). Null when it has none. */
function dayIn(text: string): Date | null {
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  const m = /(\d{1,2})\s+([A-Za-z]{3})/.exec(text) || /([A-Za-z]{3})[a-z]*\s+(\d{1,2})/.exec(text);
  if (!m) return null;
  const [d, mon] = /\d/.test(m[1]) ? [+m[1], m[2]] : [+m[2], m[1]];
  const mi = MONTHS.indexOf(mon.toLowerCase());
  if (mi < 0) return null;
  const now = new Date();
  let y = now.getFullYear();
  if (new Date(y, mi, d) < new Date(now.getFullYear(), now.getMonth() - 2, 1)) y += 1;
  return new Date(y, mi, d);
}
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function SectionTitle({ title, detail, href }: { title: string; detail?: string; href: string }) {
  const tr = useT();
  return <div className={styles.sectionTitle}>
    <div><h2>{title}</h2>{detail && <span>{detail}</span>}</div>
    <TransitionLink href={href}>{tr("calendar.viewAll")} <I name="ArrowRight" /></TransitionLink>
  </div>;
}

function CalendarPanel({ marks }: { marks: Date[] }) {
  const tr = useT();
  const today = new Date();
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
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
      {cells.map((day, i) => {
        const at = day ? new Date(year, monthIndex, day) : null;
        const isToday = !!at && sameDay(at, today);
        const has = !!at && marks.some((m) => sameDay(m, at));
        return <span key={`${i}-${day}`} className={isToday ? styles.today : ""}
                     title={has ? "Something you are going to" : undefined}
                     style={has ? { position: "relative", ...(isToday ? {} : { fontWeight: 800, color: "var(--ux-brand)" }) } : undefined}>
          {day || ""}
          {has && <i aria-hidden style={{ position: "absolute", left: "50%", bottom: 2, width: 4, height: 4, marginLeft: -2, borderRadius: 9, background: isToday ? "#fff" : "var(--ux-brand)" }} />}
        </span>;
      })}
    </div>
    <TransitionLink className={styles.calendarEvent} href="/app/schedule"><I name="CalendarDays" /> {tr("learnDashboard.upcomingLearningSessions")} <I name="ArrowRight" /></TransitionLink>
  </section>;
}

export function LearnDashboard() {
  const courseCats = useMasterPictures("course_categories");
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
  const { data: sessions } = useMentorSessions();
  const { data: events } = useResource(
    useCallback(async (s: AbortSignal) => apiEvents(s).catch(() => [] as GrowthEvent[]), []), [] as GrowthEvent[],
  );
  const { data: allGoals } = useResource(
    useCallback(async (s: AbortSignal) => apiGoals(s).catch(() => [] as Goal[]), []), [] as Goal[],
  );
  // Learning goals: the ones that count skills — courses, tests, certificates.
  const goals = allGoals.filter((g) => g.kind === "skill" && g.status !== "dropped").slice(0, 3);
  const upcoming: Upcoming[] = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const fromEvents = events.filter((e) => e.registered).map((e) => ({
      key: `e-${e.id}`, date: dayIn(e.date), type: e.category || "Workshop", title: e.title,
      when: [e.date_label, e.time].filter(Boolean).join(", "), href: `/app/events/${e.id}`,
    }));
    const fromMentors = sessions.filter((x) => x.state === "Upcoming").map((x) => ({
      key: `m-${x.id}`, date: dayIn(x.scheduledFor || x.when), type: "Mentor session",
      title: `${x.topic.split(". ")[0]} — with ${x.mentor.split(" ")[0]}`, when: x.when, href: "/app/mentors",
    }));
    return [...fromEvents, ...fromMentors]
      .filter((u) => !u.date || u.date >= today)
      .sort((a, b) => (a.date?.getTime() ?? Infinity) - (b.date?.getTime() ?? Infinity));
  }, [events, sessions]);
  const marks = upcoming.flatMap((u) => (u.date ? [u.date] : []));
  const current = learning.continuing.find(course => (course.pct ?? 0) > 0) ?? learning.continuing[0];
  const currentHref = current ? `/app/programs/${current.id}` : "/app/programs";
  // Everything she has going: part-way courses first, then the paid ones
  // waiting on a teacher to confirm her payment.
  const mine = [...learning.continuing, ...learning.pending].slice(0, 3);
  // Free first, then by how many women are already learning it.
  const picks = [...learning.picks].sort((a, b) => Number(!!a.priceMinor) - Number(!!b.priceMinor)).slice(0, 4);
  const all = [...learning.continuing, ...learning.pending, ...learning.picks];
  const fromMaster = courseCats.loaded
    ? courseCats.items.map((p) => ({ icon: p.extra.icon || "BookOpen", title: p.label, sub: p.extra.note || "",
                                     cats: (p.children ?? []).map((c) => c.label), pic: courseCats.pic(p.label) }))
    : PATHS.map((p) => ({ ...p, pic: "" }));
  const paths = fromMaster.map((p) => ({ ...p, count: all.filter((c) => p.cats.includes(c.category)).length }));

  return <HomeShell active="/app/learn" loadFailed="your learning" fit>
    <div className={styles.dashboard} data-dashboard="learn">
      <div className={styles.main}>
        <section className={styles.hero} data-page-hero data-banner>
          <picture>
            {/* The wide banner is composed for a laptop and carries lettering in
              its own artwork; a phone-shaped crop of it cuts the subject or the
              words. The phone gets a crop made for its shape. */}
            <source media="(max-width: 1023px)" srcSet={`${ART}hero-mobile.webp`} />
            <img src={`${ART}hero.webp`} alt="" aria-hidden="true" />
          </picture>
          <div className={styles.heroContent} data-banner-copy>
            <p className={styles.eyebrow}>Learn <span>•</span> Grow <span>•</span> Achieve</p>
            <h1>{tr("learnDashboard.learnWithoutLimits")}</h1>
            <p>{tr("learnDashboard.newSkillsBetterOpportunitiesABrighter")}</p>
            <div className={styles.heroActions}>
              <TransitionLink className={styles.primaryAction} href={currentHref}>{tr("learnDashboard.continueLearning")} <I name="ArrowRight" /></TransitionLink>
              <TransitionLink className={styles.videoAction} href="/app/programs"><span><I name="Play" /></span> {tr("learnDashboard.watchYour")}<br />{tr("learnDashboard.learningJourney")}</TransitionLink>
            </div>

          </div>
        </section>
            <div className={styles.heroBenefits} data-banner-details>
              <span><I name="BadgeCheck" /> {tr("learnDashboard.practicalSkills")}</span><span><I name="Users" /> {tr("learnDashboard.expertMentors")}</span>
              <span><I name="Award" /> {tr("learnDashboard.recognisedCertificates")}</span><span><I name="Briefcase" /> {tr("learnDashboard.realOpportunities")}</span>
            </div>

        {/* Everything in this section as pictures in its colour — the map a
            woman who cannot read the rail finds her way by. */}
        <SectionPictures id="learn" className="" />

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
          <SectionTitle title="My learning" detail={mine.length ? undefined : "Courses you join appear here, with your progress"} href="/app/programs" />
          {mine.length === 0 ? (
            <div className={styles.continueCard}>
              <TransitionLink href="/app/programs" className={styles.continueImage}><img src={`${ART}continue.webp`} alt="" /><b>Explore</b></TransitionLink>
              <div className={styles.continueDetails}><h3>Find your first course</h3><p>Free courses from the WomSakhi team and from women like you</p></div>
              <TransitionLink href="/app/programs" className={styles.continueButton}>Explore <I name="ArrowRight" /></TransitionLink>
            </div>
          ) : mine.map(course => {
            const waiting = course.myStatus === "pending";
            return <div className={styles.continueCard} key={course.id} style={{ marginBottom: 12 }}>
              <TransitionLink href={`/app/programs/${course.id}`} className={styles.continueImage}><img src={course.ownCover ? course.thumb : pictureOr(null, [course.title], courseCats.of(course.category))} alt="" /><span><I name={waiting ? "Hourglass" : "Play"} /></span><b>{waiting ? "Waiting" : "In Progress"}</b></TransitionLink>
              <div className={styles.continueDetails}>
                <h3>{course.title}</h3>
                <p>{waiting
                  ? course.paymentStatus === "claimed" ? `Waiting for ${course.teacher} to confirm your payment` : `Pay ${course.teacher} ${priceLabel(course.priceMinor)} to start`
                  : `By ${course.teacher ?? "WomSakhi team"} · pick up where you left off`}</p>
                {!waiting && <div className={styles.progressLine}><span><i style={{ width: `${course.pct ?? 0}%` }} /></span><strong>{course.pct ?? 0}%</strong> complete</div>}
              </div>
              <TransitionLink href={`/app/programs/${course.id}`} className={styles.continueButton}>{waiting ? "Open" : "Continue"} <I name="ArrowRight" /></TransitionLink>
            </div>;
          })}
        </section>

        <section className={styles.section}>
          <SectionTitle title={tr("journey.recommendedForYou")} detail="From the WomSakhi team and from women who teach here" href="/app/programs" />
          <div className={styles.recommendations}>{picks.map(course => <TransitionLink className={styles.course} href={`/app/programs/${course.id}`} key={course.id}>
            <div className={styles.courseImage}><img src={course.ownCover ? course.thumb : pictureOr(null, [course.title], courseCats.of(course.category))} alt="" /><b>{priceLabel(course.priceMinor)}</b></div>
            <div className={styles.courseBody}><h3>{course.title}</h3><p>By {course.teacher}</p><span className={styles.courseMeta}><I name="BookOpenCheck" /> {course.lessons} lessons · <I name="Clock" /> {course.hours || "Own pace"}</span><span className={styles.rating}><I name={course.byMember ? "UserRound" : "Sparkles"} /> {course.byMember ? "Taught by a member" : "WomSakhi team"} <i><I name="Play" /></i></span></div>
          </TransitionLink>)}</div>
        </section>

        <section className={styles.section}>
          <SectionTitle title={tr("learnDashboard.learningPaths")} detail="Structured programs to help you achieve your goals" href="/app/programs" />
          <div className={styles.paths}>{paths.map(path => <TransitionLink href={`/app/programs?cat=${encodeURIComponent(path.cats.join(","))}&path=${encodeURIComponent(path.title)}`} className={styles.path} key={path.title}><span>{path.pic ? <img src={path.pic} alt="" loading="lazy" decoding="async" /> : <I name={path.icon} />}</span><div><h3>{path.title}</h3><p>{path.sub}</p><small>{path.count} course{path.count === 1 ? "" : "s"}</small></div></TransitionLink>)}</div>
        </section>
      </div>

      <aside className={`${styles.rightRail} ux-sticky-col`} aria-label={tr("learnDashboard.learningOverview")}>
        <blockquote className={styles.quote}><span aria-hidden="true">“</span><p>{tr("learnDashboard.learningIsNotJustForToday")}</p><cite>— WomSakhi</cite></blockquote>
        <CalendarPanel marks={marks} />
        <section className={styles.railPanel}>
          <SectionTitle title={tr("learnDashboard.upcomingSessions")} href="/app/schedule" />
          {upcoming.length ? (
            <div className={styles.sessions}>{upcoming.slice(0, 3).map(u => (
              <TransitionLink href={u.href} className={styles.session} key={u.key}>
                <span className={styles.date}>
                  <small>{u.date ? u.date.toLocaleString("en-IN", { month: "short" }).toUpperCase() : "TBC"}</small>
                  {u.date ? String(u.date.getDate()).padStart(2, "0") : "—"}
                </span>
                <span><b className={styles.sessionType}>{u.type}</b><strong>{u.title}</strong><small>{u.when}</small></span>
              </TransitionLink>
            ))}</div>
          ) : (
            <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--ux-muted)" }}>
              Nothing booked yet. <TransitionLink href="/app/events" style={{ color: "var(--ux-brand)", fontWeight: 700 }}>Find a workshop</TransitionLink>
              {" "}or <TransitionLink href="/app/mentors" style={{ color: "var(--ux-brand)", fontWeight: 700 }}>ask a mentor</TransitionLink>.
            </p>
          )}
        </section>
        <section className={styles.railPanel}>
          <SectionTitle title={tr("learnDashboard.myLearningGoals")} href="/app/goals" />
          {goals.length ? (
            <div className={styles.goals}>{goals.map(goal => (
              <TransitionLink href="/app/goals" className={styles.goal} key={goal.id}>
                <span className={styles.goalIcon}><I name={goal.reached ? "CheckCircle2" : "BookmarkCheck"} /></span>
                <span className={styles.goalInfo}>
                  <span>{goal.label}<b>{goal.current}/{goal.target}</b></span>
                  <i><i style={{ width: `${Math.min(100, goal.pct)}%` }} /></i>
                </span>
              </TransitionLink>
            ))}</div>
          ) : (
            <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--ux-muted)" }}>
              No learning goal yet. <TransitionLink href="/app/goals" style={{ color: "var(--ux-brand)", fontWeight: 700 }}>Set one</TransitionLink> — like finishing a course this month.
            </p>
          )}
        </section>
      </aside>
    </div>
  </HomeShell>;
}
