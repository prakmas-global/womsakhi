"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, Bus, ChevronRight, CircleHelp, FileText, HeartPulse, Landmark, MessageCircle, Mic2, Phone, Scale, Search, ShieldAlert, ShieldCheck, Siren, Users } from "lucide-react";
import { HomeShell } from "@/components/ux/home/HomeShell";
import styles from "./help.module.css";

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

const resources = [
  [FileText,"Download guides","/app/helpdesk"], [Phone,"Important contacts","/app/safety"],
  [Landmark,"Government schemes","/app/discover"], [Scale,"Legal templates","/app/rights"],
] as const;

export default function HelpPage(){
  const [query,setQuery]=useState("");
  const shown=useMemo(()=>{const q=query.trim().toLowerCase();return q?topics.filter(([,title,copy])=>`${title} ${copy}`.toLowerCase().includes(q)):topics},[query]);
  return <HomeShell><div className={styles.page} data-dashboard="help">
    <main className={styles.main}>
      <section className={styles.hero}>
        <Image src="/ux/help/help-hero-v2.png" alt="Five women supporting and listening to one another" fill priority sizes="(max-width: 900px) 100vw, 70vw" />
        <div className={styles.heroCopy}><p>Help &amp; support</p><h1>You&apos;re not alone,<br/><em>we&apos;re here for you</em></h1><span>Get answers. Find support. Take the next step.<br/>Together, we can handle anything.</span>
          <form className={styles.search} onSubmit={e=>e.preventDefault()}><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="What do you need help with today?" aria-label="Search help topics"/><button type="submit">Search</button></form>
        </div><p className={styles.heroNote}>Real conversations.<br/>Real support.<br/>Real change.<small>— WomSakhi</small></p>
      </section>

      <section className={styles.topics}><header><div><h2>Browse help topics</h2><p>Find guidance, tools and support for every stage of your life.</p></div>{query?<button onClick={()=>setQuery("")}>Clear search</button>:<Link href="/app/explore">View all <ArrowRight/></Link>}</header>
        {shown.length?<div className={styles.topicGrid}>{shown.map(([Icon,title,copy,href,tone])=><Link href={href} key={title} className={styles.topic}><span className={styles[tone]}><Icon/></span><span><b>{title}</b><small>{copy}</small></span><ChevronRight/></Link>)}</div>:<div className={styles.noResults}><CircleHelp/><b>No matching topic yet</b><p>Try a different phrase or contact the support team directly.</p><Link href="/app/helpdesk">Contact support <ArrowRight/></Link></div>}
      </section>

      <section className={styles.features}>
        <Link href="/app/circles" className={styles.community}><Image src="/ux/wellness/community-women-v2.png" alt="Women standing together" fill sizes="(max-width: 760px) 100vw, 32vw"/><span><b>Stronger<br/>together</b><small>Real stories. Real support.<br/>A kinder world for every woman.</small><i>Join community <ChevronRight/></i></span></Link>
        <Link href="/app/travel" className={styles.article}><Image src="/ux/help/safe-travel-v2.png" alt="Woman travelling safely through a mountain town" fill sizes="(max-width: 760px) 100vw, 32vw"/><span><small>Featured article</small><b>How to keep yourself safe while travelling</b><i>Read now <ArrowRight/></i></span></Link>
        <section className={styles.contact}><div><b>Can&apos;t find what you need?</b><p>Our team is here to help you personally.</p><Link href="/app/helpdesk">Contact support <ArrowRight/></Link></div><span aria-hidden>❦</span></section>
      </section>
    </main>

    <aside className={styles.rail}>
      <section className={styles.immediate}><header><div><h2>Need immediate help?</h2><p>You&apos;re not alone. Reach out anytime.</p></div><CircleHelp/></header>
        <a href="tel:181"><span><Phone/></span><b>Call helpline<small>Women&apos;s support line</small></b><ChevronRight/></a>
        <Link href="/app/helpdesk"><span><MessageCircle/></span><b>Live chat<small>Chat with a counselor</small></b><ChevronRight/></Link>
        <Link href="/app/safety"><span><ShieldCheck/></span><b>Report a concern<small>Safety &amp; emergency</small></b><ChevronRight/></Link>
      </section>
      <blockquote>“A problem shared<br/>is a problem halved.”<cite>— WomSakhi</cite></blockquote>
      <section className={styles.resources}><h2>Helpful resources</h2>{resources.map(([Icon,title,href])=><Link href={href} key={title}><Icon/><b>{title}</b><ChevronRight/></Link>)}</section>
    </aside>
  </div></HomeShell>;
}
