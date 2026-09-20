"use client";
/* eslint-disable @next/next/no-img-element */

import { useMemo, useRef, useState } from "react";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { TransitionLink } from "@/components/ux/TransitionLink";
import { I } from "@/components/ux/kit";
import { useMe } from "@/components/ux/me";
import { useApplications, useEvents, useJobs } from "@/components/ux/growth";
import { useWalletInsights } from "@/components/ux/business";
import { apiToggleSaveOpportunity } from "@/lib/growth-api";
import { payLabel, type Job } from "./data";
import styles from "./WorkDashboard.module.css";

const ART = "/ux/art/work-dashboard-";
const FILTERS = ["For You", "Remote", "Part-time", "Full-time", "Freelance", "Women-led"] as const;
type Filter = (typeof FILTERS)[number];
const SKILLS = ["Social Media", "UI/UX Design", "Content Writing", "Virtual Assistance", "Data Entry", "Customer Support"];

function imageFor(job: Job) {
  const role = `${job.title} ${job.skills.join(" ")}`.toLowerCase();
  if (/kitchen|tiffin|baker|cook/.test(role)) return "kitchen";
  if (/solar/.test(role)) return "solar";
  if (/anganwadi|support worker/.test(role)) return "support";
  if (/embroid/.test(role)) return "embroidery";
  if (/beaut|salon/.test(role)) return "beauty";
  if (/data entry/.test(role)) return "data";
  if (/tailor|stitch/.test(role)) return "tailoring";
  if (/design|ux/.test(role)) return "design";
  if (/content|writ/.test(role)) return "writing";
  if (/social|marketing/.test(role)) return "social";
  return "community";
}

const money = (minor: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(minor / 100);

function PanelHeading({ title, href, action = "View all" }: { title: string; href: string; action?: string }) {
  return <div className={styles.panelHeading}><h2>{title}</h2><TransitionLink href={href}>{action} <I name="ArrowRight" /></TransitionLink></div>;
}

function JobTile({ job, image, saved, onSave }: { job: Job; image: string; saved: boolean; onSave: () => void }) {
  return <article className={styles.job}>
    <div className={styles.jobImage}>
      <img src={`${ART}${image}.webp`} alt="" loading="lazy" />
      <span className={styles.jobBadge}>{job.womenLed ? "Women-led" : job.mode === "Remote" ? "Remote" : job.kind}</span>
      <button type="button" onClick={onSave} aria-label={saved ? `Unsave ${job.title}` : `Save ${job.title}`} aria-pressed={saved} className={styles.save}><I name="Heart" style={saved ? { fill: "currentColor" } : undefined} /></button>
    </div>
    <div className={styles.jobBody}>
      <p className={styles.org}><span><I name={job.icon} /></span>{job.org}</p>
      <h3>{job.title}</h3>
      <p className={styles.jobMeta}><I name="MapPin" /> {job.mode} <span>·</span> <I name="Briefcase" /> {job.kind}</p>
      <p className={styles.pay}><I name="Wallet" /> {payLabel(job)}</p>
      <div className={styles.skills}>{job.skills.slice(0, 3).map(skill => <span key={skill}>{skill}</span>)}</div>
      <TransitionLink href={`/app/opportunities/${job.id}`} className={styles.details}>View Details <I name="ArrowRight" /></TransitionLink>
    </div>
  </article>;
}

export function WorkDashboard() {
  const { data: jobs } = useJobs();
  const { data: applications } = useApplications();
  const { data: events } = useEvents();
  const { data: insights } = useWalletInsights();
  const me = useMe();
  const [filter, setFilter] = useState<Filter>("For You");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [saveError, setSaveError] = useState("");
  const [chartRange, setChartRange] = useState("6");
  const resultsRef = useRef<HTMLElement>(null);

  const results = useMemo(() => jobs.filter(job => {
    const q = search.toLowerCase();
    if (q && ![job.title, job.org, ...job.skills].join(" ").toLowerCase().includes(q)) return false;
    if (filter === "Remote") return job.mode === "Remote";
    if (filter === "Part-time") return /part.time/i.test([job.title, job.about].join(" "));
    if (filter === "Full-time") return job.kind === "Job";
    if (filter === "Freelance") return job.kind === "Freelance";
    if (filter === "Women-led") return job.womenLed;
    return true;
  }).slice(0, 4), [jobs, search, filter]);

  const earnings = insights.monthly_minor.reduce((sum, amount) => sum + amount, 0);
  const months = insights.monthly_minor.slice(-Number(chartRange));
  const labels = insights.month_labels.slice(-Number(chartRange));
  const max = Math.max(1, ...months);
  const stats = [
    { icon: "Briefcase", value: jobs.length.toLocaleString("en-IN"), label: "Opportunities", href: "/app/opportunities" },
    { icon: "Users", value: new Set(jobs.map(job => job.org)).size.toLocaleString("en-IN"), label: "Companies", href: "/app/opportunities" },
    { icon: "FileText", value: applications.length.toLocaleString("en-IN"), label: "Applications", href: "/app/applications" },
    { icon: "Wallet", value: money(earnings), label: "Total Earnings", href: "/app/wallet" },
  ];

  const setTopic = (topic: string) => {
    setQuery(topic);
    setSearch(topic);
    setFilter("For You");
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const toggleSave = async (job: Job) => {
    const wasSaved = saved[job.id] ?? Boolean(job.saved);
    setSaved(current => ({ ...current, [job.id]: !wasSaved }));
    setSaveError("");
    try { await apiToggleSaveOpportunity(job.id); }
    catch {
      setSaved(current => ({ ...current, [job.id]: wasSaved }));
      setSaveError("That opportunity could not be saved. Please try again.");
    }
  };

  return <HomeShell active="/app/work" loadFailed="your work" fit>
    <div className={styles.dashboard} data-dashboard="work">
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
            <p className={styles.eyebrow}>Work <span>·</span> Opportunities <span>·</span> Growth</p>
            <h1>Work on<br /><em>your terms</em></h1>
            <p className={styles.heroSub}>Discover meaningful opportunities, build your reputation and create the life you want.</p>
            <form className={styles.search} onSubmit={event => { event.preventDefault(); setSearch(query.trim()); resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
              <I name="Search" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="What work are you looking for?" aria-label="Search opportunities" /><button type="submit">Search</button>
            </form>
            <div className={styles.quickFilters}>{FILTERS.slice(1).map(option => <button type="button" key={option} onClick={() => { setFilter(option); setSearch(""); setQuery(""); resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><I name={option === "Remote" ? "MapPin" : option === "Women-led" ? "Heart" : "Clock"} />{option}</button>)}</div>
          </div>
        </section>

        <div className={styles.stats}>{stats.map(stat => <TransitionLink href={stat.href} className={styles.stat} key={stat.label}><span><I name={stat.icon} /></span><div><strong>{stat.value}</strong><small>{stat.label}</small></div><I name="ChevronRight" /></TransitionLink>)}</div>

        <section className={styles.panel} ref={resultsRef}>
          <PanelHeading title="Recommended Opportunities" href="/app/opportunities" />
          <div className={styles.tabs}>{FILTERS.map(option => <button type="button" key={option} onClick={() => setFilter(option)} aria-pressed={filter === option}>{option}</button>)}</div>
          {saveError && <p className={styles.saveError} role="alert">{saveError}</p>}
          {results.length ? <div className={styles.jobs}>{results.map(job => <JobTile key={job.id} job={job} image={imageFor(job)} saved={saved[job.id] ?? Boolean(job.saved)} onSave={() => toggleSave(job)} />)}</div>
            : <div className={styles.empty}><I name="SearchX" /><p>No opportunities match this search.</p><button type="button" onClick={() => { setFilter("For You"); setSearch(""); setQuery(""); }}>Clear filters</button></div>}
        </section>

        <div className={styles.bottom}>
          <section className={styles.panel}>
            <div className={styles.panelHeading}><h2>Earnings Overview</h2><select value={chartRange} onChange={event => setChartRange(event.target.value)} aria-label="Earnings range"><option value="6">Last 6 months</option><option value="12">Last 12 months</option></select></div>
            <div className={styles.earnings}><div><strong>{money(earnings)}</strong><span>Total Earnings</span><TransitionLink href="/app/wallet">View wallet <I name="ArrowRight" /></TransitionLink></div><div className={styles.chart}>{months.length ? months.map((amount, i) => <div key={`${labels[i]}-${i}`}><span style={{ height: `${Math.max(8, amount / max * 58)}px` }} /><small>{labels[i] || ""}</small></div>) : <p>Your earnings will appear here.</p>}</div></div>
          </section>
          <section className={styles.panel}><PanelHeading title="Top Skills in Demand" href="/app/opportunities" /><div className={styles.skillChips}>{SKILLS.map(skill => <button key={skill} type="button" onClick={() => setTopic(skill)}>{skill}</button>)}</div></section>
        </div>
      </div>

      <aside className={styles.rail} aria-label="Work overview">
        <blockquote className={styles.quote}><span aria-hidden="true">“</span><p>Independent women create stronger families and brighter communities.</p><cite>— WomSakhi</cite></blockquote>
        <section className={styles.railPanel}><PanelHeading title="Upcoming Events" href="/app/schedule" action="View calendar" /><div className={styles.schedule}>{events.upcoming.slice(0, 4).map(event => <TransitionLink href={`/app/events/${event.id}`} key={event.id}><time>{event.day} {event.month}</time><span>{event.title}<small>{event.time || event.when}</small></span></TransitionLink>)}{!events.upcoming.length && <p>No upcoming events yet.</p>}</div></section>
        <section className={styles.railPanel}><PanelHeading title="Your Progress" href="/app/profile" /><div className={styles.progressTop}><div className={styles.ring} style={{ background: `conic-gradient(var(--ux-brand) ${me.profilePct}%, var(--ux-brand-tint-2) 0)` }}><span>{me.profilePct}%</span></div><div><strong>Your Profile Strength</strong><p>{me.profilePct === 100 ? "Your profile is complete." : "Complete a few more items to get better opportunities."}</p></div></div><div className={styles.tasks}><TransitionLink href="/app/profile"><I name={me.profilePct === 100 ? "CheckCircle2" : "Circle"} /> Complete profile <I name="ChevronRight" /></TransitionLink><TransitionLink href="/app/profile"><I name="Circle" /> Add portfolio <I name="ChevronRight" /></TransitionLink><TransitionLink href="/app/trust"><I name="Circle" /> Get verified reviews <I name="ChevronRight" /></TransitionLink><TransitionLink href="/app/intake"><I name="Circle" /> Link your skills <I name="ChevronRight" /></TransitionLink><TransitionLink href="/app/settings"><I name="Circle" /> Enable availability <I name="ChevronRight" /></TransitionLink></div></section>
        <section className={styles.reputation}><I name="Trophy" /><div><h2>Build Your Reputation</h2><p>Complete projects, get verified reviews and unlock bigger opportunities.</p><TransitionLink href="/app/trust">See How It Works <I name="ArrowRight" /></TransitionLink></div></section>
      </aside>
    </div>
  </HomeShell>;
}
