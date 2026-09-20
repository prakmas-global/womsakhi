"use client";

import Image from "next/image";
import Link from "next/link";
import { Accessibility, ArrowRight, Bell, BookOpen, CalendarDays, ChevronRight, CircleUserRound, Clock3, Edit3, Gift, Heart, Headphones, Languages, Mail, MapPin, MoonStar, Phone, Settings, ShieldCheck, Sparkles, UserRound, UsersRound } from "lucide-react";
import { HomeShell } from "@/components/ux/home/HomeShell";
import styles from "./you.module.css";

const shortcuts = [
  [UserRound,"Your profile","Show your true self","/app/profile","violet"], [ShieldCheck,"Getting verified","Build trust & unlock more","/app/verify","mint"],
  [Settings,"Settings","Personalize your experience","/app/settings","pink"], [Gift,"Bring a friend","Stronger together","/app/refer","rose"],
] as const;
const settings = [
  [Languages,"Language","English","/app/settings/language"], [Bell,"Notifications","Manage alerts","/app/settings/notifications"],
  [ShieldCheck,"Privacy & security","Keep your data safe","/app/settings/security"], [MoonStar,"Appearance","Light mode","/app/settings/appearance"],
  [Accessibility,"Accessibility","Make it easier for you","/app/settings/appearance"], [CircleUserRound,"Data & account","Manage your account","/app/settings/account"],
] as const;
const journey = [
  [CalendarDays,"Member since","Aug 2026","/app/journey"], [UsersRound,"Communities joined","5","/app/circles"],
  [BookOpen,"Programs enrolled","3","/app/programs"], [UserRound,"People connected","120+","/app/circle"],
] as const;

export default function YouDashboard() {
  return <HomeShell><div className={styles.page} data-dashboard="you">
    <section className={styles.hero}>
      <Image src="/ux/you/you-hero-v2.webp" alt="Priya looking hopefully across a sunrise city and mountain landscape" fill priority sizes="(max-width: 760px) 100vw, 80vw" />
      <div className={styles.heroShade}/><div className={styles.heroCopy}><h1>Hi Priya,<br/><em>You make the world brighter</em></h1><p>Manage your profile, preferences and everything about your WomSakhi journey — all in one place.</p><blockquote>“Empowered women empower a kinder world.”<cite>— WomSakhi</cite></blockquote></div>
      <div className={styles.heroWords}>Learn<br/>Earn<br/>Connect<br/>Grow<br/>Together <Heart/></div>
      <Link href="/app/journey" className={styles.heroCard}><Sparkles/><b>A brighter<br/>you</b><span>A kinder<br/>world</span><i><ChevronRight/></i></Link>
    </section>
    <nav className={styles.shortcuts} aria-label="Account shortcuts">{shortcuts.map(([Icon,title,copy,href,tone])=><Link href={href} key={title}><span className={styles[tone]}><Icon/></span><b>{title}<small>{copy}</small>{title==="Getting verified"&&<i><ShieldCheck/> Verified</i>}</b><ChevronRight/></Link>)}</nav>
    <section className={styles.dashboardGrid}>
      <article className={`${styles.panel} ${styles.profile}`}><header><h2>Your profile</h2><Link href="/app/profile">Edit <Edit3/></Link></header><div className={styles.identity}><Link href="/app/profile" aria-label="Open Priya Sharma's profile"><Image src="/ux/art/avatar-woman-purple-kurta.webp" alt="Priya Sharma" width={92} height={92} sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 240px" /></Link><div><h3>Priya Sharma <ShieldCheck/></h3><p>WomSakhi member since Aug 2026</p><span>Explorer　✦ Learner　✦ Changemaker</span></div></div><div className={styles.details}><a href="mailto:priya.sharma@example.com"><Mail/>priya.sharma@example.com</a><a href="tel:+919876543210"><Phone/>+91 98765 43210</a><Link href="/app/profile"><MapPin/>Hyderabad, India</Link><Link href="/app/journey"><CalendarDays/>Joined 12 Aug 2026</Link><blockquote>“A healthier,<br/>happier me.<br/>A kinder world.”<cite>— WomSakhi</cite></blockquote></div><div className={styles.tags}><Link href="/app/learn">Learning</Link><Link href="/app/wellness">Health</Link><Link href="/app/earn">Entrepreneurship</Link><Link href="/app/travel">Travel</Link><Link href="/app/discover">+3</Link></div></article>
      <article className={`${styles.panel} ${styles.settings}`}><header><h2>App settings</h2><Link href="/app/settings">View all <ArrowRight/></Link></header><div>{settings.map(([Icon,title,value,href])=><Link href={href} key={title}><span><Icon/></span><b>{title}</b><small>{value}</small><ChevronRight/></Link>)}</div></article>
      <article className={`${styles.panel} ${styles.journey}`}><header><h2>Your journey</h2><Link href="/app/journey">View all <ArrowRight/></Link></header><div>{journey.map(([Icon,title,value,href])=><Link href={href} key={title}><span><Icon/></span><b>{title}</b><small>{value}</small><ChevronRight/></Link>)}<Link href="/app/profile" className={styles.completion}><span><Clock3/></span><b>Profile completeness</b><small>80%</small><div><i/></div></Link></div></article>
    </section>
    <section className={styles.bottomGrid}>
      <Link href="/app/welcome" className={styles.guide}><Image src="/ux/you/get-started-v2.webp" alt="A woman beginning a journey through the mountains" fill sizes="(max-width: 760px) 100vw, 33vw"/><span><b>How to get started</b><small>A simple guide to explore,<br/>learn and grow on WomSakhi.</small><i>View guide <ArrowRight/></i></span></Link>
      <section className={styles.help}><Headphones/><div><b>Need help?</b><p>We&apos;re here for you. Find answers, contact support or share your feedback.</p><Link href="/app/helpdesk">Get help <ArrowRight/></Link></div></section>
      <Link href="/app/refer" className={styles.invite}><Image src="/ux/you/invite-community-v2.webp" alt="Women from different cultures standing together" fill sizes="(max-width: 760px) 100vw, 33vw"/><span><b>Invite &amp; inspire</b><small>Bring a friend and help<br/>more women win.</small><i>Invite now <ArrowRight/></i></span><p>Stronger together.<br/>Always.<small>— WomSakhi</small></p></Link>
    </section>
  </div></HomeShell>;
}
