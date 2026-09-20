"use client";
/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { TransitionLink } from "@/components/ux/TransitionLink";
import { I } from "@/components/ux/kit";
import { useBusiness, useWalletInsights } from "@/components/ux/business";
import { useJobs } from "@/components/ux/growth";
import type { Job } from "@/components/ux/work/data";
import styles from "./EarnDashboard.module.css";

const money = (minor: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(minor / 100);
const ways = [
  { icon: "ShoppingBag", title: "Sell Products", sub: "Handmade, digital or physical products", href: "/app/documents", art: 0 },
  { icon: "Laptop", title: "Offer Services", sub: "Consult, teach, design, write and more", href: "/app/shop", art: 1 },
  { icon: "FileText", title: "Freelance / Projects", sub: "Work on short or long term projects", href: "/app/opportunities", art: 2 },
  { icon: "CalendarDays", title: "Host Events", sub: "Workshops, webinars and community events", href: "/app/events", art: 3 },
  { icon: "Handshake", title: "Affiliate & Collaborate", sub: "Partner with women and brands", href: "/app/circle", art: 4 },
];
const filters = ["Recommended For You", "Trending", "Near You", "High Earning", "New"] as const;
type Filter = (typeof filters)[number];

function jobArt(job: Job) {
  const words = `${job.title} ${job.skills.join(" ")}`.toLowerCase();
  if (/baker|cake|cook|kitchen|food|tiffin/.test(words)) return "/ux/art/work-dashboard-kitchen.webp";
  if (/solar/.test(words)) return "/ux/art/work-dashboard-solar.webp";
  if (/anganwadi|support worker/.test(words)) return "/ux/art/work-dashboard-support.webp";
  if (/embroid/.test(words)) return "/ux/art/work-dashboard-embroidery.webp";
  if (/beaut|salon/.test(words)) return "/ux/art/work-dashboard-beauty.webp";
  if (/tailor|stitch/.test(words)) return "/ux/art/work-dashboard-tailoring.webp";
  if (/yoga|wellness|fitness/.test(words)) return "/ux/art/learn-dashboard-mindfulness.webp";
  if (/design|ux/.test(words)) return "/ux/art/work-dashboard-design.webp";
  if (/virtual|admin|assistant|data/.test(words)) return "/ux/art/work-dashboard-data.webp";
  if (/content|writ/.test(words)) return "/ux/art/work-dashboard-writing.webp";
  if (/social|marketing/.test(words)) return "/ux/art/work-dashboard-social.webp";
  return "/ux/art/work-dashboard-community.webp";
}

export function EarnDashboard() {
  const { data: business } = useBusiness();
  const { data: insights } = useWalletInsights();
  const { data: jobs } = useJobs();
  const [filter, setFilter] = useState<Filter>(filters[0]);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const previous = business.stats.lastMonth_minor;
  const current = business.stats.month_minor;
  const change = previous > 0 ? Math.round((current - previous) / previous * 100) : null;
  const matches = useMemo(() => {
    const q = search.toLowerCase();
    let items = jobs.filter(job => !q || `${job.title} ${job.org} ${job.skills.join(" ")}`.toLowerCase().includes(q));
    if (filter === "Trending") items = [...items].sort((a, b) => b.applicants - a.applicants);
    if (filter === "Near You") items = items.filter(job => job.mode !== "Remote");
    if (filter === "High Earning") items = [...items].sort((a, b) => b.payHigh - a.payHigh);
    if (filter === "New") items = [...items].sort((a, b) => a.postedDays - b.postedDays);
    return items.slice(0, 4);
  }, [jobs, filter, search]);
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

  return <HomeShell active="/app/earn" loadFailed="your earnings">
    <div className={styles.dashboard} data-dashboard="earn" data-earn-dashboard>
      <div className={styles.main}>
        <section className={styles.hero}>
          <picture>
            {/* The wide banner is composed for a laptop and carries lettering in
              its own artwork; a phone-shaped crop of it cuts the subject or the
              words. The phone gets a crop made for its shape. */}
            <source media="(max-width: 1023px)" srcSet="/ux/art/earn-dashboard-hero-mobile.webp" />
            <img src="/ux/art/earn-dashboard-hero.png" alt="" className={styles.heroImage} />
          </picture>
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>Earn <span>·</span> Create <span>·</span> Grow</p>
            <h1>Your Skills.<br />Real <em>Opportunities.</em></h1>
            <p>Turn what you love into income. Sell, offer services, work on projects, and grow with a community that supports you.</p>
            <div className={styles.heroActions}><TransitionLink href="/app/documents/new" className={styles.primary}>Start Earning <I name="ArrowRight" /></TransitionLink><TransitionLink href="/app/shop" className={styles.secondary}><I name="CirclePlay" /> Explore Ways to Earn</TransitionLink></div>
            <small>{productCount + serviceCount} of your listings are active</small>
          </div>
        </section>

        <div className={styles.stats}>
          <TransitionLink href="/app/wallet" className={styles.stat}><I name="Wallet" /><span><strong>{money(current)}</strong><small>Monthly Earnings</small></span>{change !== null && <b className={change < 0 ? styles.decrease : undefined}>{change >= 0 ? "↑" : "↓"} {Math.abs(change)}%</b>}</TransitionLink>
          <TransitionLink href="/app/documents/listings" className={styles.stat}><I name="ShoppingBag" /><span><strong>{productCount + serviceCount}</strong><small>Active Listings</small></span></TransitionLink>
          <TransitionLink href="/app/documents" className={styles.stat}><I name="Users" /><span><strong>{business.stats.repeatBuyers}%</strong><small>Repeat Buyers</small></span></TransitionLink>
          <TransitionLink href="/app/shop" className={styles.stat}><I name="Star" /><span><strong>{business.shop.rating}</strong><small>Rating ({business.shop.reviews} reviews)</small></span></TransitionLink>
        </div>

        <section className={styles.ways}><h2>Ways You Can Earn</h2><div className={styles.wayGrid}>{ways.map(way => <TransitionLink href={way.href} key={way.title} className={styles.way}><span className={`${styles.wayArt} ${styles[`wayArt${way.art}`]}`} /><span className={styles.wayText}><strong>{way.title}</strong><small>{way.sub}</small><I name="ArrowUpRight" /></span></TransitionLink>)}</div></section>

        <section className={styles.recommendations}>
          <div className={styles.sectionHead}><h2>Recommended For You</h2><TransitionLink href="/app/opportunities">View All <I name="ArrowRight" /></TransitionLink></div>
          <div className={styles.tabs}>{filters.map(option => <button key={option} type="button" onClick={() => setFilter(option)} aria-pressed={filter === option}>{option}</button>)}</div>
          <form className={styles.search} onSubmit={event => { event.preventDefault(); setSearch(query.trim()); }}><I name="Search" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search opportunities" aria-label="Search earning opportunities" /><button type="submit">Search</button></form>
          {matches.length ? <div className={styles.jobs}>{matches.map(job => <article key={job.id} className={styles.job}><div className={styles.jobArt} style={{ backgroundImage: `url(${jobArt(job)})` }} /><div className={styles.jobBody}><h3>{job.title}</h3><p>{job.org}</p><strong>{job.payText || `${money(job.payLow * 100)} – ${money(job.payHigh * 100)}`}</strong><div className={styles.tags}><span>{job.kind}</span><span>{job.mode}</span></div><TransitionLink href={`/app/opportunities/${job.id}`}>View Opportunity <I name="ArrowRight" /></TransitionLink></div></article>)}</div> : <div className={styles.empty}>No opportunities match this selection. <button type="button" onClick={() => { setFilter(filters[0]); setQuery(""); setSearch(""); }}>Clear filters</button></div>}
        </section>
      </div>

      <aside className={styles.rail} aria-label="Earn overview">
        <section className={styles.railPanel}><div className={styles.railHeading}><h2>Your Earnings</h2><TransitionLink href="/app/wallet">View Wallet <I name="ArrowRight" /></TransitionLink></div><strong className={styles.earningsNumber}>{money(current)}</strong><p>this month {change !== null && <span className={change < 0 ? styles.decrease : styles.change}>{change >= 0 ? "↑" : "↓"} {Math.abs(change)}% vs last month</span>}</p><div className={styles.chart}>{chart.length ? chart.map((amount, i) => <div key={`${labels[i]}-${i}`}><span style={{ height: `${Math.max(6, amount / chartMax * 86)}px` }} /><small>{labels[i] || ""}</small></div>) : <p>Earnings history will appear here.</p>}</div></section>
        <section className={styles.railPanel}><div className={styles.railHeading}><h2>Your Progress</h2><TransitionLink href="/app/documents">View All <I name="ArrowRight" /></TransitionLink></div><div className={styles.progress}>{progress.map(item => <TransitionLink href={item.href} key={item.label} className={`${styles.progressItem} ${styles[item.tone]}`}><span><I name={item.icon} /><strong>{item.value}</strong></span><small>{item.label}</small></TransitionLink>)}</div><blockquote>Small steps today,<br />big financial freedom tomorrow.</blockquote></section>
        <section className={styles.railPanel}><div className={styles.railHeading}><h2>Upcoming Opportunities</h2><TransitionLink href="/app/opportunities">View All <I name="ArrowRight" /></TransitionLink></div><div className={styles.upcoming}>{jobs.slice(0, 3).map(job => <TransitionLink href={`/app/opportunities/${job.id}`} key={job.id}><span className={styles.upcomingArt} style={{ backgroundImage: `url(${jobArt(job)})` }} /><span><strong>{job.title}</strong><small>{job.org} · {job.mode}</small></span><I name="ChevronRight" /></TransitionLink>)}{!jobs.length && <p>No opportunities available yet.</p>}</div></section>
        <section className={styles.help}><h2>Need Help Getting Started?</h2><p>Explore the ways to sell your work on WomSakhi.</p><TransitionLink href="/app/shop">Explore Ways to Earn <I name="ArrowRight" /></TransitionLink></section>
      </aside>
    </div>
  </HomeShell>;
}
