"use client";

import { PlaceMark } from "@/components/ux/nav/Place";
import { useMemo, useState } from "react";
import { useT } from "@/i18n";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, Bus, ChevronRight, CircleHelp, FileText, HeartPulse, Landmark, MessageCircle, Mic2, Phone, Scale, Search, ShieldAlert, ShieldCheck, Siren, Users } from "lucide-react";
import { HomeShell } from "@/components/ux/home/HomeShell";
import styles from "./help.module.css";
import { MediaCard, MediaGrid } from "@/components/ux/media/MediaCard";

/**
 * A picture per topic, chosen by hand: each one has to say what is behind the
 * tile before the words are read, and the safety and rights ones stay calm.
 */
const ART: Record<string, string> = {
  "/app/helpdesk": "/ux/art/work-dashboard-community.webp",
  "/app/safety": "/ux/art/onboarding-help-safety-v2.webp",
  "/app/safe-money": "/ux/art/course-counting-coins-calculator.webp",
  "/app/bringing": "/ux/art/circle-sharing-help.webp",
  "/app/school": "/ux/art/work-dashboard-support.webp",
  "/app/incase": "/ux/art/course-writing-notebook.webp",
  "/app/rights": "/ux/art/scene-woman-reading-document.webp",
  "/app/health": "/ux/wellness/morning-yoga-v2.webp",
  "/app/family": "/ux/art/onboarding-wellbeing-all-ages-v2.webp",
  "/app/travel": "/ux/help/safe-travel-v2.webp",
  "/app/voice": "/ux/art/course-confident-microphone.webp",
};

const topics = [
  [MessageCircle,"What has gone wrong","Answers, or a person","/app/helpdesk","coral"],
  [ShieldAlert,"Get help now","Alert your people, or call","/app/safety","violet"],
  [Landmark,"Money traps","The tricks aimed at women like you","/app/safe-money","berry"],
  [Siren,"When home is not sure","Tell someone who can help","/app/bringing","pink"],
  [BookOpen,"The school year","Fees, forms and dates, per child","/app/school","coral"],
  [FileText,"If something happens to me","Written down while you can","/app/incase","rose"],
  [Scale,"Your rights","And a free lawyer","/app/rights","plum"],
  [HeartPulse,"Health","What is free, and what is due","/app/health","pink"],
  [Users,"Family & childcare","Near you, and what it costs","/app/family","berry"],
  [Bus,"Travel","Routes, cost, and after dark","/app/travel","violet"],
  [Mic2,"Reading it out to you","Any screen read aloud, in your language","/app/voice","violet"],
] as const;

// Each goes where it says. "Download guides" led to the helpdesk inbox,
// "Government schemes" to Discover, and "Legal templates" to a page with no
// templates on it — so they now name what is actually behind them.
const resources = [
  [Landmark,"Government schemes — what you are owed","/app/haq"],
  [FileText,"My papers — Aadhaar, ration card, certificates","/app/haq/papers"],
  [Scale,"Free legal help, and your rights","/app/rights"],
  [Phone,"Emergency and helpline numbers","/app/safety"],
] as const;

export default function HelpPage(){
  const tr = useT();
  const [query,setQuery]=useState("");
  const shown=useMemo(()=>{const q=query.trim().toLowerCase();return q?topics.filter(([,title,copy])=>`${title} ${copy}`.toLowerCase().includes(q)):topics},[query]);
  return <HomeShell columns><div className={styles.page} data-dashboard="help">
    <main className={styles.main}>
      <section data-banner data-page-hero className={styles.hero}>
        <Image src="/ux/help/help-hero-v2.webp" alt={tr("help.fiveWomenSupportingAndListeningTo")} fill priority sizes="(max-width: 900px) 100vw, 70vw" />
        <div className={styles.heroCopy}><p>Help &amp; support</p><div className="mb-2"><PlaceMark size={44} /></div><h1>You&apos;re not alone,<br/><em>we&apos;re here for you</em></h1><span>{tr("help.getAnswersFindSupportTakeThe")}<br/>{tr("help.togetherWeCanHandleAnything")}</span>
          <form className={styles.search} onSubmit={e=>e.preventDefault()}><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={tr("help.whatDoYouNeedHelpWith")} aria-label={tr("help.searchHelpTopics")}/><button type="submit">Search</button></form>
        </div><p className={styles.heroNote}>{tr("help.realConversations")}<br/>{tr("help.realSupport")}<br/>{tr("help.realChange")}<small>— WomSakhi</small></p>
      </section>

      <section className={styles.topics}><header><div><h2>{tr("help.browseHelpTopics")}</h2><p>{tr("help.findGuidanceToolsAndSupportFor")}</p></div>{query?<button onClick={()=>setQuery("")}>{tr("help.clearSearch")}</button>:<Link href="/app/explore">{tr("calendar.viewAll")} <ArrowRight/></Link>}</header>
        {shown.length?<MediaGrid>{shown.map(([Icon,title,copy,href])=><MediaCard key={title} href={href} image={ART[href] ?? "/ux/art/circle-hands-together.webp"} alt="" ratio="16/10"
          overlay={<><Icon className="h-[14px] w-[14px]" /> Open</>} title={title} subtitle={copy} />)}</MediaGrid>:<div className={styles.noResults}><CircleHelp/><b>{tr("help.noMatchingTopicYet")}</b><p>{tr("help.tryADifferentPhraseOrContact")}</p><Link href="/app/helpdesk">{tr("help.contactSupport")} <ArrowRight/></Link></div>}
      </section>

      <section className={styles.features}>
        <Link href="/app/circles" className={styles.community}><Image src="/ux/wellness/community-women-v2.webp" alt={tr("help.womenStandingTogether")} fill sizes="(max-width: 760px) 100vw, 32vw"/><span><b>Stronger<br/>together</b><small>{tr("help.realStoriesRealSupport")}<br/>{tr("help.aKinderWorldForEveryWoman")}</small><i>{tr("help.joinCommunity")} <ChevronRight/></i></span></Link>
        <Link href="/app/travel" className={styles.article}><Image src="/ux/help/safe-travel-v2.webp" alt={tr("help.womanTravellingSafelyThroughAMountain")} fill sizes="(max-width: 760px) 100vw, 32vw"/><span><small>{tr("help.featuredArticle")}</small><b>{tr("help.howToKeepYourselfSafeWhile")}</b><i>{tr("help.readNow")} <ArrowRight/></i></span></Link>
        <section className={styles.contact}><div><b>Can&apos;t find what you need?</b><p>{tr("help.ourTeamIsHereToHelp")}</p><Link href="/app/helpdesk">{tr("help.contactSupport")} <ArrowRight/></Link></div><span aria-hidden>❦</span></section>
      </section>
    </main>

    <aside className={`${styles.rail} ux-sticky-col`}>
      <section className={styles.immediate}><header><div><h2>{tr("help.needImmediateHelp")}</h2><p>You&apos;re not alone. Reach out anytime.</p></div><CircleHelp/></header>
        <a href="tel:181"><span><Phone/></span><b>{tr("help.callHelpline")}<small>Women&apos;s support line</small></b><ChevronRight/></a>
        <Link href="/app/helpdesk"><span><MessageCircle/></span><b>Message the WomSakhi team<small>A real person replies, usually within a day</small></b><ChevronRight/></Link>
        <Link href="/app/safety"><span><ShieldCheck/></span><b>{tr("help.reportAConcern")}<small>Safety &amp; emergency</small></b><ChevronRight/></Link>
      </section>
      <blockquote>{tr("help.aProblemShared")}<br/>{tr("help.isAProblemHalved")}<cite>— WomSakhi</cite></blockquote>
      <section className={styles.resources}><h2>{tr("help.helpfulResources")}</h2>{resources.map(([Icon,title,href])=><Link href={href} key={title}><Icon/><b>{title}</b><ChevronRight/></Link>)}</section>
    </aside>
  </div></HomeShell>;
}
