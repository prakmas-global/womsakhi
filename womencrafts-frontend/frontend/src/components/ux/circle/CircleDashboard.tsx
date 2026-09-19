"use client";
/* eslint-disable @next/next/no-img-element */

import { HomeShell } from "@/components/ux/home/HomeShell";
import { TransitionLink } from "@/components/ux/TransitionLink";
import { I } from "@/components/ux/kit";
import styles from "./CircleDashboard.module.css";

const quickLinks = [
  { icon: "UsersRound", label: "Find Your Circle", sub: "Based on your interests", href: "/app/circles" },
  { icon: "MessageCircle", label: "Meaningful Conversations", sub: "Safe & supportive space", href: "/app/messages" },
  { icon: "CalendarDays", label: "Events & Meetups", sub: "Online and nearby", href: "/app/events" },
  { icon: "HeartHandshake", label: "Help Each Other", sub: "Give, get and grow", href: "/app/together" },
  { icon: "Gift", label: "Pass It On", sub: "Share resources", href: "/app/swap" },
];
const myCircles = [
  { id: "career", name: "Career Growth Circle", members: "1.2K", art: styles.photoCareer },
  { id: "moms", name: "Moms & Motherhood", members: "862", art: styles.photoMothers },
  { id: "health", name: "Health & Wellness", members: "1.1K", art: styles.photoWellness },
  { id: "business", name: "Women Entrepreneurs", members: "954", art: styles.photoBusiness },
];
const featured = [
  { name: "Financial Freedom", members: "2.4K", art: styles.featureMoney },
  { name: "Creative Souls", members: "11K", art: styles.featureCreative },
  { name: "Travel Sisters", members: "18K", art: styles.featureTravel },
  { name: "Book Lovers", members: "946", art: styles.featureBooks },
];
const avatars = ["/ux/art/avatar-woman-purple-kurta.webp", "/ux/art/avatar-woman-hijab.webp", "/ux/art/avatar-woman-teal-shirt.webp"];

function CircleCard({ circle, joined }: { circle: { id?: string; name: string; members: string; art: string }; joined: boolean }) {
  return <article className={styles.circleCard}>
    <div className={`${styles.circlePhoto} ${circle.art}`}><button type="button" aria-label={`More options for ${circle.name}`}><I name="EllipsisVertical" /></button></div>
    <div className={styles.circleCardBody}>
      <h3>{circle.name}</h3>
      <p>{circle.members} members</p>
      <div className={styles.memberRow}>{avatars.map(src => <img src={src} alt="" key={src} />)}</div>
      <TransitionLink href={circle.id ? "/app/circles" : "/app/circles"}>{joined ? "Open" : "Join"} <I name="ArrowRight" /></TransitionLink>
    </div>
  </article>;
}

function Heading({ title, href, label = "View all" }: { title: string; href: string; label?: string }) {
  return <div className={styles.heading}><h2>{title}</h2><TransitionLink href={href}>{label} <I name="ArrowRight" /></TransitionLink></div>;
}

export function CircleDashboard() {
  return <HomeShell active="/app/circle" loadFailed="your circles">
    <div className={styles.dashboard} data-circle-dashboard>
      <div className={styles.main}>
        <section className={styles.hero}>
          <img src="/ux/art/circle-dashboard-hero-v2.png" alt="" className={styles.heroImage} />
          <span className={styles.heroHandwriting}>Different<br />Journeys<br />Same Strength <I name="Heart" /></span>
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>Circle</p>
            <h1>Real Women.<br />Real Connections.<br /><em>A Brighter You.</em></h1>
            <p>Join circles, share your journey, learn from each other, find support and create opportunities together.</p>
            <div className={styles.heroActions}><TransitionLink href="/app/circles/create" className={styles.primary}>Create a Circle <I name="ArrowRight" /></TransitionLink><TransitionLink href="/app/stories" className={styles.secondary}><I name="CirclePlay" /> Community Stories</TransitionLink></div>
          </div>
          <div className={styles.heroSocial}><span className={styles.memberRow}>{avatars.map(src => <img src={src} alt="" key={src} />)}</span><strong>12K+</strong> amazing women are already in circles</div>
        </section>

        <nav className={styles.quick} aria-label="Circle shortcuts">{quickLinks.map(item => <TransitionLink href={item.href} key={item.label}><span><I name={item.icon} /></span><strong>{item.label}</strong><small>{item.sub}</small></TransitionLink>)}</nav>

        <section className={styles.panel}>
          <Heading title="My Circles (6)" href="/app/circles" />
          <div className={styles.myGrid}>{myCircles.map(circle => <CircleCard key={circle.id} circle={circle} joined />)}
            <TransitionLink href="/app/circles" className={styles.discoverCard}><span><I name="Sparkles" /></span><strong>Discover More Circles</strong><small>Explore communities that match your interests.</small><b>Explore <I name="ArrowRight" /></b></TransitionLink>
          </div>
        </section>

        <div className={styles.bottom}>
          <section className={styles.panel}><Heading title="Featured Circles" href="/app/circles" /><div className={styles.featuredGrid}>{featured.map(circle => <CircleCard key={circle.name} circle={circle} joined={false} />)}</div></section>
          <section className={styles.startCard}><img src="/ux/art/circle-dashboard-leaves.png" alt="" aria-hidden="true" /><h2>Start a Circle.<br />Spark a Movement.</h2><p>Create your own circle around a cause, interest or community. Lead. Inspire. Empower.</p><TransitionLink href="/app/circles/create">Create a Circle <I name="ArrowRight" /></TransitionLink></section>
        </div>
      </div>

      <aside className={styles.rail} aria-label="Circle overview">
        <blockquote className={styles.quote}><p>“When women support each other, incredible things happen.”</p><cite>— WomSakhi</cite></blockquote>
        <section className={styles.railPanel}><Heading title="Your Circle Journey" href="/app/circles" label="View details" /><div className={styles.journey}><span className={styles.ring}><strong>75%</strong></span><div><strong>You&apos;re making an impact!</strong><p>5 circles joined<br />12 meaningful conversations<br />3 people helped</p></div></div><p className={styles.journeyQuote}>Community turns small steps into big changes. <I name="Heart" /></p></section>
        <section className={styles.railPanel}><Heading title="Upcoming Events" href="/app/events" /><div className={styles.eventList}>{[
          ["SEP", "28", "Women in Tech – Career Talk", "Online · 6:00 PM"], ["OCT", "04", "Mental Wellness Circle", "Hyderabad · 11:00 AM"], ["OCT", "12", "Entrepreneur Meetup", "Bangalore · 4:00 PM"],
        ].map(event => <div className={styles.event} key={event[2]}><time><small>{event[0]}</small><strong>{event[1]}</strong></time><div><strong>{event[2]}</strong><span>{event[3]}</span><span className={styles.eventPeople}>{avatars.map(src => <img src={src} alt="" key={src} />)}</span></div><TransitionLink href="/app/events">Join</TransitionLink></div>)}</div></section>
        <section className={styles.railPanel}><Heading title="Active Conversations" href="/app/messages" /><div className={styles.conversations}>{[
          ["Tips for work-life balance?", "24 replies · 2 hours ago"], ["Best learning resources for freelancing?", "18 replies · 4 hours ago"], ["Healthy recipes for busy days", "32 replies · 6 hours ago"],
        ].map((row, index) => <TransitionLink href="/app/messages" key={row[0]}><span className={styles.convAvatar}><img src={avatars[index]} alt="" /></span><span><strong>{row[0]}</strong><small>{row[1]}</small></span><I name="ChevronRight" /></TransitionLink>)}</div></section>
      </aside>
    </div>
  </HomeShell>;
}
