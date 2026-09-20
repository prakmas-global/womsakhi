"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Bookmark, BookOpen, BriefcaseBusiness, Heart, IndianRupee, MapPin, SlidersHorizontal, Sparkles, TrendingUp, UserRound, UsersRound } from "lucide-react";
import { useDiscoverRails, type DiscoverItem } from "@/components/ux/discovery/data";
import { HomeShell } from "@/components/ux/home/HomeShell";
import styles from "./discover.module.css";

const FILTERS = [
  ["all", "All", Sparkles], ["learn", "Learning", BookOpen], ["work", "Work", BriefcaseBusiness],
  ["earn", "Earning", IndianRupee], ["community", "Community", UsersRound],
  ["women", "Mentors", UserRound], ["near", "Nearby", MapPin],
] as const;
type Filter = (typeof FILTERS)[number][0];
const ART = ["/ux/art/work-dashboard-writing.webp", "/ux/art/learn-dashboard-business.webp", "/ux/art/work-dashboard-design.webp", "/ux/art/course-confident-microphone.webp"];

function SectionHead({ icon: Icon, title, copy, href }: { icon: typeof Heart; title: string; copy: string; href: string }) {
  return <header className={styles.sectionHead}><span><Icon /></span><div><h2>{title}</h2><p>{copy}</p></div><Link href={href}>View all <ArrowRight /></Link></header>;
}

function OpportunityCard({ item, index, saved, onSave }: { item: DiscoverItem; index: number; saved: boolean; onSave: () => void }) {
  const kind = item.kind === "course" ? "Program" : item.kind === "circle" ? "Community" : "Opportunity";
  return <article className={`${styles.opportunity} ${styles[`tone${index % 4}`]}`}>
    <Image src={ART[index % ART.length]} alt="" width={180} height={150} sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 240px" />
    <button type="button" onClick={onSave} aria-label={`${saved ? "Remove" : "Save"} ${item.title}`} aria-pressed={saved}><Bookmark fill={saved ? "currentColor" : "none"} /></button>
    <div className={styles.opportunityBody}><small>{kind}</small><h3>{item.title}</h3><p>{item.detail}</p>{item.meta && <span>{item.meta}</span>}<Link href={item.href}>{item.kind === "opportunity" ? "View details" : "Explore"} <ArrowRight /></Link></div>
  </article>;
}

export default function DiscoverPage() {
  const rails = useDiscoverRails();
  const [filter, setFilter] = useState<Filter>("all");
  const [saved, setSaved] = useState<string[]>([]);
  const opportunities = useMemo(() => {
    if (filter === "learn") return rails.data.learn;
    if (filter === "work" || filter === "earn") return rails.data.work;
    if (filter === "community") return rails.data.circles;
    if (filter === "women" || filter === "near") return rails.data.women;
    return [...rails.data.work, ...rails.data.learn, ...rails.data.circles];
  }, [filter, rails.data]);
  const visible = opportunities.slice(0, 4);

  return <HomeShell active="/app/discover" skeleton="grid" loadFailed="your recommendations"><main className={styles.page} data-dashboard="discover">
    <section className={styles.hero} aria-labelledby="chosen-title">
      <Image src="/ux/discover/chosen-hero-v1.png" alt="A confident woman looking toward new opportunities" fill priority sizes="(max-width: 760px) 100vw, 80vw" />
      <div className={styles.heroShade} /><div className={styles.heroCopy}><p><Link href="/app">Home</Link> / Chosen for you</p><h1 id="chosen-title">Chosen <em>for You</em></h1><span>Curated opportunities, people, and resources that match your journey, skills and goals.</span></div>
      <p className={styles.heroNote}>Opportunities<br />find you too<br />Here <Heart /></p><blockquote>“The right opportunity at the right time can change everything.”<cite>— WomSakhi</cite></blockquote>
    </section>

    <nav className={styles.filters} aria-label="Recommendation filters"><div>{FILTERS.map(([id, label, Icon]) => <button type="button" key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}><Icon />{label}</button>)}</div><button type="button" className={styles.filterButton}><SlidersHorizontal />Filters</button></nav>

    <section><SectionHead icon={Heart} title="Opportunities for You" copy="Handpicked from your available recommendations." href="/app/explore" />
      {rails.source === "loading" ? <div className={styles.loading}>Finding the best matches for you...</div> : visible.length ? <div className={styles.opportunityGrid}>{visible.map((item, index) => <OpportunityCard key={`${item.kind}-${item.id}`} item={item} index={index} saved={saved.includes(item.id)} onSave={() => setSaved(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id])} />)}</div> : <div className={styles.empty}>No matches under this filter yet. <button type="button" onClick={() => setFilter("all")}>Show everything</button></div>}
    </section>

    <section><SectionHead icon={UserRound} title="Women Like You" copy="Connect with women who share similar interests, skills or goals." href="/app/mentors" />
      <div className={styles.peopleGrid}>{rails.data.women.slice(0, 4).map(woman => <article className={styles.person} key={woman.id}>{woman.photo ? <Image src={woman.photo} alt="" width={54} height={54} sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 240px" /> : <span className={styles.initial}>{woman.title.charAt(0)}</span>}<div><h3>{woman.title}</h3><p>{woman.detail}</p><small><MapPin />{woman.meta || "WomSakhi community"}</small></div><div className={styles.tags}>{(woman.tags || ["Mentoring", "Community"]).slice(0, 3).map(tag => <span key={tag}>{tag}</span>)}</div><Link href={woman.href}>Connect</Link></article>)}</div>
    </section>

    <div className={styles.bottomGrid}>
      <section className={styles.panel}><SectionHead icon={TrendingUp} title="Trending for You" copy="Popular learning resources from your network." href="/app/programs" /><div className={styles.trending}>{rails.data.learn.slice(0, 3).map((item, index) => <Link href={item.href} key={item.id}><Image src={ART[(index + 1) % ART.length]} alt="" width={94} height={58} sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 240px" /><span><b>{item.title}</b><small>{item.detail}</small></span><Bookmark /></Link>)}</div></section>
      <section className={styles.panel}><SectionHead icon={UsersRound} title="Communities You May Like" copy="Join conversations, ask questions, and grow together." href="/app/circles" /><div className={styles.communities}>{rails.data.circles.slice(0, 3).map((circle, index) => <article key={circle.id}><span className={styles.communityArt}><Image src={`/ux/art/avatar-woman-${["purple-kurta", "hijab", "teal-shirt"][index % 3]}.webp`} alt="" width={44} height={44} sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 240px" /></span><h3>{circle.title}</h3><p>{circle.detail}</p><Link href={circle.href}>Join</Link></article>)}</div></section>
      <aside className={styles.mantra}><Sparkles /><p>Small steps<br />create big<br />futures.</p><Heart /></aside>
    </div>
  </main></HomeShell>;
}
