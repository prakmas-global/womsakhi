"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useMemo, useState } from "react";
import { useT } from "@/i18n";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { TransitionLink } from "@/components/ux/TransitionLink";
import { I } from "@/components/ux/kit";
import { useBusiness, useWalletInsights } from "@/components/ux/business";
import { useJobs } from "@/components/ux/growth";
import type { Job } from "@/components/ux/work/data";
import styles from "./EarnDashboard.module.css";
import { DashboardNudge } from "@/components/ux/reminders/DashboardNudge";
import { useResource } from "@/lib/use-resource";
import { apiTeachSummary, rupees, type TeachSummary } from "@/lib/teach-api";
import { isNear, useMyCity } from "@/components/ux/discover/near";
import { artFor } from "@/components/ux/media/art";

const money = (minor: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(minor / 100);
const ways = [
  { icon: "ShoppingBag", title: "Sell Products", sub: "Handmade, digital or physical products", href: "/app/documents", art: 0 },
  { icon: "Laptop", title: "Your Services", sub: "Sell, teach or mentor — switch them on yourself", href: "/app/services", art: 1 },
  { icon: "FileText", title: "Freelance / Projects", sub: "Work on short or long term projects", href: "/app/opportunities", art: 2 },
  { icon: "CalendarDays", title: "Host Events", sub: "Workshops, webinars and community events", href: "/app/events", art: 3 },
  { icon: "GraduationCap", title: "Create a Course", sub: "Free or paid — learners pay you directly", href: "/app/teach", art: 4 },
];
const filters = ["Recommended For You", "Trending", "Near You", "High Earning", "New"] as const;
type Filter = (typeof filters)[number];

/** The picture of the work itself — the app-wide chooser, so a job looks the same here as in Find work. */
const jobArt = (job: Job) => artFor([job.title, ...job.skills, job.categoryName], "job", null, job.id);

export function EarnDashboard() {
  const tr = useT();
  const { data: business } = useBusiness();
  const { data: insights } = useWalletInsights();
  const { data: jobs } = useJobs();
  // What her courses have earned — paid to her directly, confirmed by her in Teach.
  const { data: teaching } = useResource(
    useCallback((s: AbortSignal) => apiTeachSummary(s).catch(() => null), []),
    null as TeachSummary | null,
  );
  const [filter, setFilter] = useState<Filter>(filters[0]);
  // Her town, for "Near You" — not "anything that is not remote".
  const { data: city } = useMyCity();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const previous = business.stats.lastMonth_minor;
  const current = business.stats.month_minor;
  const change = previous > 0 ? Math.round((current - previous) / previous * 100) : null;
  const matches = useMemo(() => {
    const q = search.toLowerCase();
    let items = jobs.filter(job => !job.closed && (!q || `${job.title} ${job.org} ${job.place} ${job.skills.join(" ")}`.toLowerCase().includes(q)));
    // Recommended: the server's match against her My work profile skills.
    if (filter === "Recommended For You") items = [...items].sort((a, b) => b.match - a.match);
    if (filter === "Trending") items = [...items].sort((a, b) => b.applicants - a.applicants);
    if (filter === "Near You") items = items.filter(job => job.mode !== "Remote" && isNear(job.place, city));
    if (filter === "High Earning") items = [...items].sort((a, b) => b.payHigh - a.payHigh);
    // "New": the server already sends newest first.
    return items.slice(0, 4);
  }, [jobs, filter, search, city]);
  const chart = insights.monthly_minor.slice(-6);
  const labels = insights.month_labels.slice(-6);
  const chartMax = Math.max(1, ...chart);
  const productCount = business.products.filter(p => p.live).length;
  const serviceCount = business.services.filter(s => s.live).length;
  const orderCount = business.orders.length;
  const progress = [
    { icon: "Package", value: productCount, label: "Products", href: "/app/documents/listings", tone: "pink" },
    { icon: "ShoppingBag", value: orderCount, label: "Orders", href: "/app/documents", tone: "violet" },
    { icon: "Wallet", value: insights.withdrawn_minor > 0 ? 1 : 0, label: "Payouts", href: "/app/wallet", tone: "peach" },
  ];

  return <HomeShell columns active="/app/earn" loadFailed="your earnings">
    <div className={styles.dashboard} data-dashboard="earn" data-earn-dashboard>
      <div className={styles.main}>
        <section className={styles.hero}>
          <picture>
            {/* The wide banner is composed for a laptop and carries lettering in
              its own artwork; a phone-shaped crop of it cuts the subject or the
              words. The phone gets a crop made for its shape. */}
            <source media="(max-width: 1023px)" srcSet="/ux/art/earn-dashboard-hero-mobile.webp" />
            <img src="/ux/art/earn-dashboard-hero.webp" alt="" className={styles.heroImage} />
          </picture>
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>Earn <span>·</span> Create <span>·</span> Grow</p>
            <h1>{tr("earnDashboard.yourSkills")}<br />Real <em>Opportunities.</em></h1>
            <p>{tr("earnDashboard.turnWhatYouLoveIntoIncome")}</p>
            <div className={styles.heroActions}><TransitionLink href="/app/documents/new" className={styles.primary}>{tr("earnDashboard.startEarning")} <I name="ArrowRight" /></TransitionLink><TransitionLink href="/app/services" className={styles.secondary}><I name="CirclePlay" /> {tr("earnDashboard.exploreWaysToEarn")}</TransitionLink></div>
            <small>{productCount + serviceCount} of your listings are active</small>
          </div>
        </section>

        <div className={styles.stats}>
          <TransitionLink href="/app/wallet" className={styles.stat}><I name="Wallet" /><span><strong>{money(current)}</strong><small>{tr("earnDashboard.monthlyEarnings")}</small></span>{change !== null && <b className={change < 0 ? styles.decrease : undefined}>{change >= 0 ? "↑" : "↓"} {Math.abs(change)}%</b>}</TransitionLink>
          <TransitionLink href="/app/documents/listings" className={styles.stat}><I name="ShoppingBag" /><span><strong>{productCount + serviceCount}</strong><small>{tr("earnDashboard.activeListings")}</small></span></TransitionLink>
          <TransitionLink href="/app/documents" className={styles.stat}><I name="Users" /><span><strong>{business.stats.repeatBuyers}%</strong><small>{tr("earnDashboard.repeatBuyers")}</small></span></TransitionLink>
          <TransitionLink href="/app/documents" className={styles.stat}><I name="Star" /><span><strong>{business.shop.rating}</strong><small>Rating ({business.shop.reviews} reviews)</small></span></TransitionLink>
        </div>

        {/* Added to this dashboard, never in place of anything on it: the engine,
            reachable from the module it belongs to. */}
        <DashboardNudge
          preset="rem.preset.supplies"
          icon="ShoppingBasket" tint="var(--ux-tint-pink)" ink="var(--ux-brand)"
          labelKey="nudge.earn.label" noteKey="nudge.earn.note" />

        <section className={styles.ways}><h2>{tr("earnDashboard.waysYouCanEarn")}</h2><div className={styles.wayGrid}>{ways.map(way => <TransitionLink href={way.href} key={way.title} className={styles.way}><span className={`${styles.wayArt} ${styles[`wayArt${way.art}`]}`} /><span className={styles.wayText}><strong>{way.title}</strong><small>{way.sub}</small><I name="ArrowUpRight" /></span></TransitionLink>)}</div></section>

        <section className={styles.recommendations}>
          <div className={styles.sectionHead}><h2>{tr("earnDashboard.recommendedForYou")}</h2><TransitionLink href="/app/opportunities">{tr("dashboard.viewAll")} <I name="ArrowRight" /></TransitionLink></div>
          <div className={styles.tabs}>{filters.map(option => <button key={option} type="button" onClick={() => setFilter(option)} aria-pressed={filter === option}>{option}</button>)}</div>
          <form className={styles.search} onSubmit={event => { event.preventDefault(); setSearch(query.trim()); }}><I name="Search" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={tr("earnDashboard.searchOpportunities")} aria-label={tr("earnDashboard.searchEarningOpportunities")} /><button type="submit">Search</button></form>
          {matches.length ? <div className={styles.jobs}>{matches.map(job => <article key={job.id} className={styles.job}><div className={styles.jobArt} style={{ backgroundImage: `url(${jobArt(job)})` }} /><div className={styles.jobBody}><h3>{job.title}</h3><p>{job.org}</p><strong>{job.payText || `${money(job.payLow * 100)} – ${money(job.payHigh * 100)}`}</strong><div className={styles.tags}><span>{job.kind}</span><span>{job.mode}</span></div><TransitionLink href={`/app/opportunities/${job.id}`}>{tr("earnDashboard.viewOpportunity")} <I name="ArrowRight" /></TransitionLink></div></article>)}</div> : <div className={styles.empty}>{filter === "Near You" ? (city ? `Nothing listed in ${city} right now.` : <>Tell us your town to see work near you. <TransitionLink href="/app/settings/account">Set my town</TransitionLink></>) : tr("earnDashboard.noOpportunitiesMatchThisSelection")} <button type="button" onClick={() => { setFilter(filters[0]); setQuery(""); setSearch(""); }}>{tr("findwork.clearFilters")}</button></div>}
        </section>
      </div>

      <aside className={styles.rail} aria-label={tr("earnDashboard.earnOverview")}>
        <section className={styles.railPanel}><div className={styles.railHeading}><h2>{tr("earnDashboard.yourEarnings")}</h2><TransitionLink href="/app/wallet">{tr("homeRail.viewWallet")} <I name="ArrowRight" /></TransitionLink></div><strong className={styles.earningsNumber}>{money(current)}</strong><p>this month {change !== null && <span className={change < 0 ? styles.decrease : styles.change}>{change >= 0 ? "↑" : "↓"} {Math.abs(change)}% vs last month</span>}</p><div className={styles.chart}>{chart.length ? chart.map((amount, i) => <div key={`${labels[i]}-${i}`}><span style={{ height: `${Math.max(6, amount / chartMax * 86)}px` }} /><small>{labels[i] || ""}</small></div>) : <p>{tr("earnDashboard.earningsHistoryWillAppearHere")}</p>}</div></section>
        <section className={styles.railPanel}>
          <div className={styles.railHeading}><h2>Course income</h2><TransitionLink href="/app/teach">My courses <I name="ArrowRight" /></TransitionLink></div>
          {teaching && teaching.courses > 0 ? <>
            <strong className={styles.earningsNumber}>{rupees(teaching.month_minor)}</strong>
            <p>this month · {rupees(teaching.earned_minor)} in all from {teaching.learners} learner{teaching.learners === 1 ? "" : "s"}</p>
            {teaching.to_confirm > 0 && <p><TransitionLink href="/app/teach"><I name="Bell" /> {teaching.to_confirm} payment{teaching.to_confirm === 1 ? "" : "s"} to confirm</TransitionLink></p>}
          </> : <p>Teach what you know — set a price, and learners pay you directly by UPI. <TransitionLink href="/app/teach/new">Create a course <I name="ArrowRight" /></TransitionLink></p>}
        </section>
        <section className={styles.railPanel}><div className={styles.railHeading}><h2>{tr("homeRail.yourProgress")}</h2><TransitionLink href="/app/documents">{tr("dashboard.viewAll")} <I name="ArrowRight" /></TransitionLink></div><div className={styles.progress}>{progress.map(item => <TransitionLink href={item.href} key={item.label} className={`${styles.progressItem} ${styles[item.tone]}`}><span><I name={item.icon} /><strong>{item.value}</strong></span><small>{item.label}</small></TransitionLink>)}</div><blockquote>{tr("earnDashboard.smallStepsToday")}<br />{tr("earnDashboard.bigFinancialFreedomTomorrow")}</blockquote></section>
        <section className={styles.railPanel}><div className={styles.railHeading}><h2>{tr("earnDashboard.upcomingOpportunities")}</h2><TransitionLink href="/app/opportunities">{tr("dashboard.viewAll")} <I name="ArrowRight" /></TransitionLink></div><div className={styles.upcoming}>{jobs.slice(0, 3).map(job => <TransitionLink href={`/app/opportunities/${job.id}`} key={job.id}><span className={styles.upcomingArt} style={{ backgroundImage: `url(${jobArt(job)})` }} /><span><strong>{job.title}</strong><small>{job.org} · {job.mode}</small></span><I name="ChevronRight" /></TransitionLink>)}{!jobs.length && <p>{tr("earnDashboard.noOpportunitiesAvailableYet")}</p>}</div></section>
        <section className={styles.help}><h2>{tr("earnDashboard.needHelpGettingStarted")}</h2><p>Sell, teach or mentor — see what you can offer on WomSakhi.</p><TransitionLink href="/app/services">{tr("earnDashboard.exploreWaysToEarn")} <I name="ArrowRight" /></TransitionLink></section>
      </aside>
    </div>
  </HomeShell>;
}
