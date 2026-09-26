"use client";

import Image from "next/image";
import { useT } from "@/i18n";
import Link from "next/link";
import { Accessibility, ArrowRight, Bell, BookOpen, CalendarDays, ChevronRight, CircleUserRound, Clock3, Edit3, Gift, Heart, Headphones, Languages, Mail, MapPin, MoonStar, Phone, Settings, ShieldCheck, Sparkles, UserRound, UsersRound } from "lucide-react";
import { HomeShell } from "@/components/ux/home/HomeShell";
import styles from "./you.module.css";
import { useAuth } from "@/context/AuthContext";
import { useShell } from "@/components/ux/ShellProvider";
import { useCircles } from "@/components/ux/live";
import { apiMyPrograms } from "@/lib/growth-api";
import { useResource } from "@/lib/use-resource";
import { useCallback } from "react";

const shortcuts = [
  [UserRound,"Your profile","Show your true self","/app/profile","violet"], [ShieldCheck,"Getting verified","Build trust & unlock more","/app/verify","mint"],
  [Settings,"Settings","Personalize your experience","/app/settings","pink"], [Gift,"Bring a friend","Stronger together","/app/refer","rose"],
] as const;
const settings = [
  [Languages,"Language","English","/app/settings/language"], [Bell,"Notifications","Manage alerts","/app/settings/notifications"],
  [ShieldCheck,"Privacy & security","Keep your data safe","/app/settings/security"], [MoonStar,"Appearance","Light mode","/app/settings/appearance"],
  [Accessibility,"Accessibility","Make it easier for you","/app/settings/appearance"], [CircleUserRound,"Data & account","Manage your account","/app/settings/account"],
] as const;
/**
 * Her journey, counted rather than asserted.
 *
 * These four read "Aug 2026 · 5 · 3 · 120+" for every woman in the product.
 * The middle two were simply wrong for the account I checked — 3 programmes
 * against 20 real enrolments — and a number she can see is wrong is worse than
 * no number, because it tells her the rest of the screen is decorative too.
 */
function journeyRows(opts: { since: string; circles: number; programs: number }) {
  return [
    [CalendarDays, "Member since", opts.since, "/app/journey"],
    [UsersRound, "Communities joined", String(opts.circles), "/app/circles"],
    [BookOpen, "Programs enrolled", String(opts.programs), "/app/programs"],
  ] as const;
}

export default function YouDashboard() {
  const tr = useT();

  /*
    Her, not a fixture.

    This screen carried one woman's whole identity in its source: "Hi Priya",
    "Priya Sharma", a fixed avatar, and — worst of it — a live `mailto:` to
    priya.sharma@example.com and a `tel:` to +91 98765 43210. Every member saw
    a stranger's contact details on the page called Your profile, beside her
    own name in the sidebar.
  */
  const { user } = useAuth();
  const shell = useShell();
  const { data: circles } = useCircles();
  const { data: enrolments } = useResource(
    useCallback(async (s: AbortSignal) => apiMyPrograms(s), []),
    [],
  );

  const name = (user?.full_name || "").trim();
  const firstName = name.split(" ")[0] || "";
  const joined = user?.created_at ? new Date(user.created_at) : null;
  const sinceLabel = joined
    ? joined.toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "Asia/Kolkata" })
    : "—";
  const joinedLabel = joined
    ? joined.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })
    : "";
  const verified = user?.verification_status === "active";
  // Only what she is actually part of. `withdrawn` is not an enrolment.
  const programCount = enrolments.filter((e) => e.status !== "withdrawn").length;
  const profilePct = shell.data?.profile_pct ?? 0;
  const journey = journeyRows({
    since: sinceLabel,
    circles: circles.mine.length,
    programs: programCount,
  });

  return <HomeShell><div className={styles.page} data-dashboard="you">
    <section className={styles.hero}>
      <Image src="/ux/you/you-hero-v2.webp" alt={tr("you.aWomanLookingHopefullyAcrossASunrise")} fill priority sizes="(max-width: 760px) 100vw, 80vw" />
      <div className={styles.heroShade}/><div className={styles.heroCopy}><h1>{tr("you.hiName", { name: firstName })}<br/><em>{tr("you.youMakeTheWorldBrighter")}</em></h1><p>Manage your profile, preferences and everything about your WomSakhi journey — all in one place.</p><blockquote>{tr("you.empoweredWomenEmpowerAKinderWorld")}<cite>— WomSakhi</cite></blockquote></div>
      <div className={styles.heroWords}>Learn<br/>Earn<br/>Connect<br/>Grow<br/>Together <Heart/></div>
      <Link href="/app/journey" className={styles.heroCard}><Sparkles/><b>A brighter<br/>you</b><span>A kinder<br/>world</span><i><ChevronRight/></i></Link>
    </section>
    <nav className={styles.shortcuts} aria-label={tr("you.accountShortcuts")}>{shortcuts.map(([Icon,title,copy,href,tone])=><Link href={href} key={title}><span className={styles[tone]}><Icon/></span><b>{title}<small>{copy}</small>{title==="Getting verified"&&<i><ShieldCheck/> Verified</i>}</b><ChevronRight/></Link>)}</nav>
    <section className={styles.dashboardGrid}>
      <article className={`${styles.panel} ${styles.profile}`}><header><h2>{tr("profile.title")}</h2><Link href="/app/profile">Edit <Edit3/></Link></header><div className={styles.identity}><Link href="/app/profile" aria-label={tr("you.openYourProfile")}><Image src={user?.avatar || "/ux/art/avatar-woman-purple-kurta.webp"} alt="" width={92} height={92} sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 240px" /></Link><div><h3>{name || "—"} {verified && <ShieldCheck/>}</h3><p>{tr("you.memberSince", { since: sinceLabel })}</p><span>{tr("you.explorerLearnerChangemaker")}</span></div></div><div className={styles.details}>{user?.email && <a href={`mailto:${user.email}`}><Mail/>{user.email}</a>}{user?.phone ? <a href={`tel:${user.phone.replace(/\s+/g, "")}`}><Phone/>{user.phone}</a> : <Link href="/app/profile"><Phone/>{tr("you.addYourPhone")}</Link>}<Link href="/app/profile"><MapPin/>{tr("you.sayWhereYouAre")}</Link>{joinedLabel && <Link href="/app/journey"><CalendarDays/>{tr("you.joinedOn", { date: joinedLabel })}</Link>}<blockquote>“A healthier,<br/>{tr("you.happierMe")}<br/>{tr("you.aKinderWorld")}<cite>— WomSakhi</cite></blockquote></div><div className={styles.tags}><Link href="/app/learn">Learning</Link><Link href="/app/wellness">Health</Link><Link href="/app/earn">Entrepreneurship</Link><Link href="/app/travel">Travel</Link><Link href="/app/discover">+3</Link></div></article>
      <article className={`${styles.panel} ${styles.settings}`}><header><h2>{tr("you.appSettings")}</h2><Link href="/app/settings">{tr("calendar.viewAll")} <ArrowRight/></Link></header><div>{settings.map(([Icon,title,value,href])=><Link href={href} key={title}><span><Icon/></span><b>{title}</b><small>{value}</small><ChevronRight/></Link>)}</div></article>
      <article className={`${styles.panel} ${styles.journey}`}><header><h2>{tr("you.yourJourney")}</h2><Link href="/app/journey">{tr("calendar.viewAll")} <ArrowRight/></Link></header><div>{journey.map(([Icon,title,value,href])=><Link href={href} key={title}><span><Icon/></span><b>{title}</b><small>{value}</small><ChevronRight/></Link>)}<Link href="/app/profile" className={styles.completion}><span><Clock3/></span><b>{tr("you.profileCompleteness")}</b><small>{profilePct}%</small><div><i style={{ width: `${profilePct}%` }}/></div></Link></div></article>
    </section>
    <section className={styles.bottomGrid}>
      <Link href="/app/welcome" className={styles.guide}><Image src="/ux/you/get-started-v2.webp" alt={tr("you.aWomanBeginningAJourneyThrough")} fill sizes="(max-width: 760px) 100vw, 33vw"/><span><b>{tr("you.howToGetStarted")}</b><small>{tr("you.aSimpleGuideToExplore")}<br/>learn and grow on WomSakhi.</small><i>{tr("you.viewGuide")} <ArrowRight/></i></span></Link>
      <section className={styles.help}><Headphones/><div><b>{tr("earnhome.needHelp")}</b><p>We&apos;re here for you. Find answers, contact support or share your feedback.</p><Link href="/app/helpdesk">{tr("bookings.getHelp")} <ArrowRight/></Link></div></section>
      <Link href="/app/refer" className={styles.invite}><Image src="/ux/you/invite-community-v2.webp" alt={tr("you.womenFromDifferentCulturesStandingTogether")} fill sizes="(max-width: 760px) 100vw, 33vw"/><span><b>Invite &amp; inspire</b><small>{tr("you.bringAFriendAndHelp")}<br/>{tr("you.moreWomenWin")}</small><i>{tr("you.inviteNow")} <ArrowRight/></i></span><p>{tr("you.strongerTogether")}<br/>Always.<small>— WomSakhi</small></p></Link>
    </section>
  </div></HomeShell>;
}
