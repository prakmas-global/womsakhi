"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useMemo, useRef, useState } from "react";
import { useT } from "@/i18n";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { TransitionLink } from "@/components/ux/TransitionLink";
import { I } from "@/components/ux/kit";
import { artFor } from "@/components/ux/media/art";
import { PlaceBadge } from "@/components/ux/nav/Place";
import { allNodes, type NavNode } from "@/components/ux/nav-tree";
import { useApplications, useEvents, useJobs } from "@/components/ux/growth";
import { apiToggleSaveOpportunity } from "@/lib/growth-api";
import { useResource } from "@/lib/use-resource";
import { apiMyWorkHistory, apiMyWorkProfile, type WorkDoneItem, type WorkProfile } from "@/lib/work-api";
import { DashboardNudge } from "@/components/ux/reminders/DashboardNudge";
import { payLabel, type Job } from "./data";
import { jobPicture, useWorkTaxonomy, WorkThumb } from "./pictures";
import { readinessOf, strengthOf } from "./readiness";
import styles from "./WorkDashboard.module.css";

/**
 * Work — the dashboard.
 *
 * ── What it was, and why it changed ─────────────────────────────────────────
 * It opened on a wall: nine near-identical picture tiles that repeated the
 * menu beside them, then four numbers that said nothing to her ("18
 * Companies"), an empty earnings chart that belongs in Earn, and four jobs
 * squeezed into thin cards. On a phone the jobs were 1,600px down a 3,800px
 * page, and the side column called a half-done profile "100% complete".
 *
 * ── One job per area, in the order she needs them ───────────────────────────
 *   1. Find work      the search, and how people hiring see her
 *   2. Right now      her applications, interviews, offers and finished work —
 *                     with the ONE thing to do next lit up
 *   3. Jobs for you   best matches first, one row of filters, cards with room
 *   4. Two ways       "I want work" / "I want to hire": the section's map as
 *                     two pictures with their places under them, not nine tiles
 *   5. In demand      skills counted from the jobs actually posted
 * The side column is her work profile (the same readiness as My work profile,
 * so the two never disagree) and what is coming up.
 */

const FILTERS = ["For you", "Remote", "Part-time", "Full-time", "Freelance", "Women-led"] as const;
type Filter = (typeof FILTERS)[number];

const NODES = new Map(allNodes().map((n) => [n.id, n]));
const node = (id: string) => NODES.get(id) as NavNode;

/** The section's places, by what she came to do. */
const WAYS = [
  { title: "I want work", sub: "Find jobs, orders and freelance work near you or from home.",
    art: "/ux/art/onboarding-work-v2.webp", ids: ["opportunities", "applications", "work-profile", "verified"] },
  { title: "I want to hire", sub: "Find women by skill, post a job, and choose who to talk to.",
    art: "/ux/art/scene-women-business-handshake.webp", ids: ["work-find", "work-post", "work-posts", "contracts"] },
] as const;

function JobCard({ job, image, saved, onSave }: { job: Job; image: string; saved: boolean; onSave: () => void }) {
  return (
    <article className={styles.job}>
      <TransitionLink href={`/app/opportunities/${job.id}`} className={styles.jobLink} aria-label={`${job.title}, ${job.org}`}>
        <span className={styles.jobImage}>
          <img src={image} alt="" loading="lazy" />
          <span className={styles.jobBadge}>{job.womenLed ? "Women-led" : job.mode === "Remote" ? "Remote" : job.kind}</span>
          {job.match >= 50 && <span className={styles.match}><I name="Sparkles" /> {job.match}% match</span>}
        </span>
        <span className={styles.jobBody}>
          <b className={styles.jobTitle}>{job.title}</b>
          <span className={styles.org}>{job.org}</span>
          <span className={styles.pay}><I name="Wallet" /> {payLabel(job)}</span>
          <span className={styles.jobMeta}><I name="MapPin" /> {job.place || job.mode}</span>
        </span>
      </TransitionLink>
      <button type="button" onClick={onSave} aria-pressed={saved} aria-label={saved ? `Unsave ${job.title}` : `Save ${job.title}`} className={styles.save}>
        <I name="Heart" style={saved ? { fill: "currentColor" } : undefined} />
      </button>
    </article>
  );
}

export function WorkDashboard() {
  const tr = useT();
  const { data: jobs, source: jobsSource } = useJobs();
  const { data: applications } = useApplications();
  const { data: events } = useEvents();
  const workCats = useWorkTaxonomy();
  const profile = useResource(useCallback((s: AbortSignal) => apiMyWorkProfile(s).catch(() => null), []), null as WorkProfile | null);
  const history = useResource(useCallback((s: AbortSignal) => apiMyWorkHistory(s).catch(() => ({ items: [], praise: [] })), []),
    { items: [], praise: [] } as { items: WorkDoneItem[]; praise: string[] });

  const [filter, setFilter] = useState<Filter>("For you");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [saveError, setSaveError] = useState("");
  const jobsRef = useRef<HTMLElement>(null);

  // Best matches first, then the newest; closed and already-applied work drops out.
  const open = useMemo(() => jobs.filter((j) => !j.closed && !j.applied)
    .sort((a, b) => b.match - a.match || a.postedDays - b.postedDays), [jobs]);
  const results = useMemo(() => open.filter((job) => {
    const q = search.toLowerCase();
    if (q && ![job.title, job.org, ...job.skills].join(" ").toLowerCase().includes(q)) return false;
    if (filter === "Remote") return job.mode === "Remote";
    if (filter === "Part-time") return /part.time/i.test([job.title, job.about].join(" "));
    if (filter === "Full-time") return job.kind === "Job";
    if (filter === "Freelance") return job.kind === "Freelance";
    if (filter === "Women-led") return job.womenLed;
    return true;
  }).slice(0, 6), [open, search, filter]);

  // Skills asked for in the work actually posted — not a fixed list.
  const inDemand = useMemo(() => {
    const count = new Map<string, number>();
    for (const j of open) for (const s of j.skills) count.set(s, (count.get(s) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [open]);

  const p = profile.data;
  const steps = p ? strengthOf(p.skills, p.work_types, p.days, p.city) : [];
  const ready = readinessOf(steps);
  const nextStep = steps.find((s) => !s.done);
  const confirmed = history.data.items.filter((w) => w.confirmed).length;
  const moving = applications.filter((a) => a.step > 0 && a.stage !== "Done");
  const interviews = applications.filter((a) => a.stage === "Interview");
  const offers = applications.filter((a) => a.stage === "Offer");

  // The one thing to do next, most urgent first.
  const next = offers[0]
    ? { icon: "PartyPopper", title: `You have an offer: ${offers[0].title}`, sub: "When the work is done, tap “I finished this work” so it counts on your profile.", href: "/app/applications", cta: "Open it" }
    : interviews[0]
      ? { icon: "MessagesSquare", title: `Interview: ${interviews[0].title}`, sub: interviews[0].when, href: "/app/applications", cta: "See details" }
      : p && nextStep
        ? { icon: "IdCard", title: nextStep.label, sub: `Your work profile is ${ready}% ready. People hiring find women whose profile is complete.`, href: `/app/work/profile#${nextStep.to}`, cta: "Do it now" }
        : null;

  const status = [
    { icon: "Send", value: moving.length, label: "Applied", href: "/app/applications" },
    { icon: "MessagesSquare", value: interviews.length, label: "Interviews", href: "/app/applications" },
    { icon: "PartyPopper", value: offers.length, label: "Offers", href: "/app/applications", hot: offers.length > 0 },
    { icon: "BadgeCheck", value: confirmed, label: "Jobs done", href: "/app/work/profile#wp-work" },
  ];

  const goJobs = () => jobsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const toggleSave = async (job: Job) => {
    const was = saved[job.id] ?? Boolean(job.saved);
    setSaved((c) => ({ ...c, [job.id]: !was }));
    setSaveError("");
    try { await apiToggleSaveOpportunity(job.id); }
    catch { setSaved((c) => ({ ...c, [job.id]: was })); setSaveError("That job could not be saved. Please try again."); }
  };

  return <HomeShell active="/app/work" loadFailed="your work" fit>
    <div className={styles.dashboard} data-dashboard="work">
      <div className={styles.main}>
        {/* 1 · Find work */}
        <section className={styles.hero} data-page-hero data-banner>
          <picture>
            {/* The wide banner carries its own composition; a phone gets a crop made for its shape. */}
            <source media="(max-width: 1023px)" srcSet="/ux/art/work-dashboard-hero-mobile.webp" />
            <img src="/ux/art/work-dashboard-hero.webp" alt="" aria-hidden="true" />
          </picture>
          <div className={styles.heroContent} data-banner-copy>
            <h1>{tr("workDashboard.workOn")} <em>{tr("workBoard.yourTerms")}</em></h1>
            <p className={styles.heroSub}>Jobs, orders and freelance work from women and families you can trust.</p>
            <form className={styles.search} onSubmit={(e) => { e.preventDefault(); setSearch(query.trim()); setFilter("For you"); goJobs(); }}>
              <I name="Search" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr("workDashboard.whatWorkAreYouLookingFor")} aria-label="Search work" />
              <button type="submit">Search</button>
            </form>
            {p && (
              <TransitionLink href="/app/work/profile" className={styles.heroStatus}>
                <I name={p.shown_for ? "Eye" : "EyeOff"} />
                {p.shown_for
                  ? `People hiring can find you for ${p.shown_for} ${p.shown_for === 1 ? "skill" : "skills"}`
                  : "People hiring cannot find you yet — switch on a skill"}
                <I name="ChevronRight" />
              </TransitionLink>
            )}
          </div>
        </section>

        {/* 2 · Right now */}
        <section className={styles.panel} aria-labelledby="work-now">
          <div className={styles.panelHeading}><h2 id="work-now">Your work right now</h2>
            <TransitionLink href="/app/applications">My applications <I name="ArrowRight" /></TransitionLink></div>
          <div className={styles.status}>
            {status.map((s) => (
              <TransitionLink key={s.label} href={s.href} className={`${styles.statusTile} ${s.hot ? styles.hot : ""}`}>
                <span><I name={s.icon} /></span>
                <strong>{s.value}</strong>
                <small>{s.label}</small>
              </TransitionLink>
            ))}
          </div>
          {next && (
            <TransitionLink href={next.href} className={styles.next}>
              <span className={styles.nextIcon}><I name={next.icon} /></span>
              <span className={styles.nextText}><b>{next.title}</b><small>{next.sub}</small></span>
              <span className={styles.nextCta}>{next.cta} <I name="ArrowRight" /></span>
            </TransitionLink>
          )}
        </section>

        {/* 3 · Jobs for you */}
        <section className={styles.panel} ref={jobsRef} aria-labelledby="work-jobs">
          <div className={styles.panelHeading}>
            <h2 id="work-jobs">{search ? `Jobs for “${search}”` : "Jobs for you"}</h2>
            <TransitionLink href="/app/opportunities">All {open.length || ""} jobs <I name="ArrowRight" /></TransitionLink>
          </div>
          <div className={styles.filters} role="group" aria-label="Show jobs">
            {FILTERS.map((f) => (
              <button type="button" key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}>
                {filter === f && <I name="Check" />}{f}
              </button>
            ))}
            {search && <button type="button" onClick={() => { setSearch(""); setQuery(""); }} className={styles.clear}><I name="X" /> {search}</button>}
          </div>
          {saveError && <p className={styles.saveError} role="alert">{saveError}</p>}
          {jobsSource === "loading" && !jobs.length ? (
            <div className={styles.jobs}>{[0, 1, 2].map((i) => <span key={i} className={`ux-skeleton ${styles.jobSkeleton}`} />)}</div>
          ) : results.length ? (
            <div className={styles.jobs}>
              {results.map((job) => <JobCard key={job.id} job={job} image={jobPicture(job, workCats)}
                                             saved={saved[job.id] ?? Boolean(job.saved)} onSave={() => void toggleSave(job)} />)}
            </div>
          ) : (
            <div className={styles.empty}>
              <I name="SearchX" />
              <p>{tr("workDashboard.noOpportunitiesMatchThisSearch")}</p>
              <button type="button" onClick={() => { setFilter("For you"); setSearch(""); setQuery(""); }}>{tr("findwork.clearFilters")}</button>
            </div>
          )}
        </section>

        {/* 4 · Two ways to use Work — the section's map, by what she came to do */}
        <div className={styles.ways}>
          {WAYS.map((w) => (
            <section key={w.title} className={styles.way} aria-label={w.title}>
              <div className={styles.wayHead}>
                <img src={w.art} alt="" loading="lazy" />
                <div><h2>{w.title}</h2><p>{w.sub}</p></div>
              </div>
              <ul>
                {w.ids.map((id) => {
                  const n = node(id);
                  return n ? (
                    <li key={id}>
                      <TransitionLink href={n.href}>
                        <PlaceBadge node={n} size={36} radius={11} />
                        <span className={styles.wayText}><b>{n.label}</b><small>{n.note}</small></span>
                        <I name="ChevronRight" />
                      </TransitionLink>
                    </li>
                  ) : null;
                })}
              </ul>
            </section>
          ))}
        </div>

        {/* 5 · In demand */}
        {inDemand.length > 0 && (
          <section className={styles.panel} aria-labelledby="work-demand">
            <div className={styles.panelHeading}><h2 id="work-demand">Skills people are asking for</h2></div>
            <div className={styles.skillChips}>
              {inDemand.map(([skill, n]) => (
                <button key={skill} type="button" onClick={() => { setQuery(skill); setSearch(skill); setFilter("For you"); goJobs(); }}>
                  <WorkThumb src={artFor(skill, "job", undefined, skill)} size={24} />{skill}<small>{n}</small>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      <aside className={`${styles.rail} ux-sticky-col`} aria-label="Your work profile">
        {/* Her work profile — the same readiness as My work profile, never a different number. */}
        <section className={styles.profile}>
          <div className={styles.profileTop}>
            <div className={styles.ring} style={{ background: `conic-gradient(var(--ux-brand) ${ready}%, var(--ux-brand-tint-2) 0)` }}>
              <span>{p ? `${ready}%` : "…"}</span>
            </div>
            <div>
              <b>My work profile</b>
              <small>{!p ? "Loading…" : ready === 100 ? "Ready — people hiring can find you." : `${ready}% ready`}</small>
            </div>
          </div>
          {p && (
            <ul className={styles.facts}>
              <li><I name="Sparkles" /> {p.skills.length} {p.skills.length === 1 ? "skill" : "skills"}, {p.shown_for} shown to people hiring</li>
              <li><I name="BadgeCheck" /> {confirmed} {confirmed === 1 ? "job" : "jobs"} done through WomSakhi</li>
            </ul>
          )}
          {nextStep && <p className={styles.nextStep}><I name="Target" /> Next: {nextStep.label}</p>}
          <TransitionLink href={nextStep ? `/app/work/profile#${nextStep.to}` : "/app/work/profile"} className={styles.profileCta}>
            {nextStep ? "Finish my work profile" : "Open my work profile"} <I name="ArrowRight" />
          </TransitionLink>
        </section>

        <section className={styles.railPanel}>
          <div className={styles.panelHeading}><h2>Coming up</h2><TransitionLink href="/app/schedule">Calendar <I name="ArrowRight" /></TransitionLink></div>
          <div className={styles.schedule}>
            {interviews.slice(0, 2).map((a) => (
              <TransitionLink href="/app/applications" key={a.id} className={styles.interview}>
                <span><I name="MessagesSquare" /></span><span>Interview — {a.title}<small>{a.org}</small></span>
              </TransitionLink>
            ))}
            {events.upcoming.slice(0, 3).map((e) => (
              <TransitionLink href={`/app/events/${e.id}`} key={e.id}>
                <time>{e.day}<small>{e.month}</small></time><span>{e.title}<small>{e.time || e.when}</small></span>
              </TransitionLink>
            ))}
            {!interviews.length && !events.upcoming.length && <p>{tr("workDashboard.noUpcomingEventsYet")}</p>}
          </div>
        </section>

        <DashboardNudge preset="rem.preset.deadline" icon="Bell" tint="var(--ux-brand-tint)" ink="var(--ux-brand)"
                        labelKey="nudge.work.label" noteKey="nudge.work.note" />
      </aside>
    </div>
  </HomeShell>;
}
