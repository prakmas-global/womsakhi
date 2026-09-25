"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { useResource } from "@/lib/use-resource";
import { apiCommunityOverview, apiCircles, type Circle, type CommunityOverview } from "@/lib/community-api";
import { apiEvents, type GrowthEvent } from "@/lib/growth-api";
import { useT } from "@/i18n";
import { TransitionLink } from "@/components/ux/TransitionLink";
import { I } from "@/components/ux/kit";
import styles from "./CircleDashboard.module.css";
import { DashboardNudge } from "@/components/ux/reminders/DashboardNudge";

const quickLinks = [
  { icon: "UsersRound", label: "Find Your Circle", sub: "Based on your interests", href: "/app/circles" },
  { icon: "MessageCircle", label: "Meaningful Conversations", sub: "Safe & supportive space", href: "/app/messages" },
  { icon: "CalendarDays", label: "Events & Meetups", sub: "Online and nearby", href: "/app/events" },
  { icon: "HeartHandshake", label: "Help Each Other", sub: "Give, get and grow", href: "/app/together" },
  { icon: "Gift", label: "Pass It On", sub: "Share resources", href: "/app/swap" },
];
/**
 * The artwork behind a circle card.
 *
 * The photographs are the design and stay here; which circle gets which one is
 * decided by position, so a real circle from the server still lands on a real
 * picture. What used to live here alongside them was the circle list itself —
 * "Career Growth Circle, 1.2K members" and three more, shown to every woman
 * under the heading "My Circles" whether or not she had joined a single one.
 */
const MY_ART = [styles.photoCareer, styles.photoMothers, styles.photoWellness, styles.photoBusiness];
const FEATURE_ART = [styles.featureMoney, styles.featureCreative, styles.featureTravel, styles.featureBooks];

/** "1.2K" for a big circle, "862" for a small one. */
function members(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return String(n);
}

/** "2 hours ago" from whatever the server sent, passed through when it is words. */
function whenWords(when: string): string {
  if (!when) return "";
  const d = new Date(when);
  if (Number.isNaN(d.getTime())) return when;
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ${hrs === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}
const avatars = ["/ux/art/avatar-woman-purple-kurta.webp", "/ux/art/avatar-woman-hijab.webp", "/ux/art/avatar-woman-teal-shirt.webp"];

function CircleCard({ circle, art }: { circle: Circle; art: string }) {
  return <article className={styles.circleCard}>
    <div className={`${styles.circlePhoto} ${art}`}><button type="button" aria-label={`More options for ${circle.name}`}><I name="EllipsisVertical" /></button></div>
    <div className={styles.circleCardBody}>
      <h3>{circle.name}</h3>
      <p>{members(circle.member_count)} {circle.member_count === 1 ? "member" : "members"}</p>
      <div className={styles.memberRow}>{avatars.map(src => <img src={src} alt="" key={src} />)}</div>
      {/* Goes to the circle it names, not to the index. */}
      <TransitionLink href={`/app/circles/${circle.id}`}>{circle.joined ? "Open" : "Join"} <I name="ArrowRight" /></TransitionLink>
    </div>
  </article>;
}

function Heading({ title, href, label = "View all" }: { title: string; href: string; label?: string }) {
  return <div className={styles.heading}><h2>{title}</h2><TransitionLink href={href}>{label} <I name="ArrowRight" /></TransitionLink></div>;
}

export function CircleDashboard() {
  const tr = useT();

  /**
   * Everything on this dashboard used to be written into the file: four
   * circles under "My Circles" whether or not she had joined any, four
   * featured ones, "12K+ amazing women", a progress ring reading 75% with
   * "5 circles joined · 12 meaningful conversations · 3 people helped", three
   * dated events and three conversations. All of it the same for everybody.
   *
   * The layout below is untouched. Only the numbers and the names changed,
   * from invented to hers.
   */
  const overview = useResource<CommunityOverview>(
    useCallback((sig: AbortSignal) => apiCommunityOverview(sig), []),
    { circles: [], circle_id: null, savings: null, posts: [] },
  );
  const discover = useResource<Circle[]>(
    useCallback(() => apiCircles({}).catch(() => []), []),
    [],
  );
  const events = useResource<GrowthEvent[]>(
    useCallback((sig: AbortSignal) => apiEvents(sig).catch(() => []), []),
    [],
  );

  const mine = overview.data.circles.filter((c) => c.joined).slice(0, 4);
  // Circles she is not in yet, so "Featured" never suggests one she has joined.
  const featured = discover.data.filter((c) => !c.joined).slice(0, 4);
  const posts = overview.data.posts.slice(0, 3);
  // Only what has not happened yet, soonest first.
  const upcoming = events.data
    .filter((e) => !e.date || new Date(e.date) >= new Date(new Date().toDateString()))
    .slice(0, 3);
  const reach = discover.data.reduce((n, c) => n + c.member_count, 0);
  const joined = overview.data.circles.filter((c) => c.joined).length;
  const convos = overview.data.posts.length;
  const replies = overview.data.posts.reduce((n, p) => n + p.reply_count, 0);

  return <HomeShell active="/app/circle" loadFailed="your circles">
    <div className={styles.dashboard} data-dashboard="circle" data-circle-dashboard>
      <div className={styles.main}>
        <section className={styles.hero}>
          <picture>
            {/* The wide banner is composed for a laptop and carries lettering in
              its own artwork; a phone-shaped crop of it cuts the subject or the
              words. The phone gets a crop made for its shape. */}
            <source media="(max-width: 1023px)" srcSet="/ux/art/circle-dashboard-hero-mobile.webp" />
            <img src="/ux/art/circle-dashboard-hero-v2.png" alt="" className={styles.heroImage} />
          </picture>
          <span className={styles.heroHandwriting}>Different<br />Journeys<br />{tr("circleDashboard.sameStrength")} <I name="Heart" /></span>
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>Circle</p>
            <h1>{tr("circleDashboard.realWomen")}<br />{tr("circleDashboard.realConnections")}<br /><em>{tr("circleDashboard.aBrighterYou")}</em></h1>
            <p>{tr("circleDashboard.joinCirclesShareYourJourneyLearn")}</p>
            <div className={styles.heroActions}><TransitionLink href="/app/circles/create" className={styles.primary}>{tr("circleDashboard.createACircle")} <I name="ArrowRight" /></TransitionLink><TransitionLink href="/app/stories" className={styles.secondary}><I name="CirclePlay" /> {tr("circleDashboard.communityStories")}</TransitionLink></div>
          </div>
          {/* A real count across the circles, not "12K+". Hidden entirely when
            there is nobody yet — an empty community should not boast. */}
        {reach > 0 && <div className={styles.heroSocial}><span className={styles.memberRow}>{avatars.map(src => <img src={src} alt="" key={src} />)}</span><strong>{members(reach)}</strong> {tr("circleDashboard.amazingWomenAreAlreadyInCircles")}</div>}
        </section>

        <nav className={styles.quick} aria-label={tr("circleDashboard.circleShortcuts")}>{quickLinks.map(item => <TransitionLink href={item.href} key={item.label}><span><I name={item.icon} /></span><strong>{item.label}</strong><small>{item.sub}</small></TransitionLink>)}</nav>

        {/* Added to this dashboard, never in place of anything on it: the engine,
            reachable from the module it belongs to. */}
        <DashboardNudge
          preset="rem.preset.circle"
          icon="PiggyBank" tint="var(--ux-tint-green)" ink="var(--ux-green-ink)"
          labelKey="nudge.circle.label" noteKey="nudge.circle.note" />

        <section className={styles.panel}>
          <Heading title={`My Circles${joined ? ` (${joined})` : ""}`} href="/app/circles" />
          <div className={styles.myGrid}>{mine.map((circle, i) => <CircleCard key={circle.id} circle={circle} art={MY_ART[i % MY_ART.length]} />)}
            <TransitionLink href="/app/circles" className={styles.discoverCard}><span><I name="Sparkles" /></span><strong>{tr("circleDashboard.discoverMoreCircles")}</strong><small>{tr("circleDashboard.exploreCommunitiesThatMatchYourInterests")}</small><b>Explore <I name="ArrowRight" /></b></TransitionLink>
          </div>
        </section>

        <div className={styles.bottom}>
          <section className={styles.panel}><Heading title={tr("circleDashboard.featuredCircles")} href="/app/circles" /><div className={styles.featuredGrid}>{featured.map((circle, i) => <CircleCard key={circle.id} circle={circle} art={FEATURE_ART[i % FEATURE_ART.length]} />)}</div></section>
          <section className={styles.startCard}><img src="/ux/art/circle-dashboard-leaves.png" alt="" aria-hidden="true" /><h2>{tr("circleDashboard.startACircle")}<br />{tr("circleDashboard.sparkAMovement")}</h2><p>{tr("circleDashboard.createYourOwnCircleAroundA")}</p><TransitionLink href="/app/circles/create">{tr("circleDashboard.createACircle")} <I name="ArrowRight" /></TransitionLink></section>
        </div>
      </div>

      <aside className={styles.rail} aria-label={tr("circleDashboard.circleOverview")}>
        <blockquote className={styles.quote}><p>{tr("circleDashboard.whenWomenSupportEachOtherIncredible")}</p><cite>— WomSakhi</cite></blockquote>
        {/* Her own three counts. The ring read a flat 75% for everybody, above
            "5 circles joined · 12 meaningful conversations · 3 people helped"
            — numbers no woman had earned. There is no percentage any more,
            because there is no total to be a percentage OF: joining circles
            is not a task list with an end. The count she has is the count. */}
        <section className={styles.railPanel}><Heading title={tr("circleDashboard.yourCircleJourney")} href="/app/circles" label={tr("workviews.viewDetails")} /><div className={styles.journey}><span className={styles.ring}><strong>{joined}</strong></span><div><strong>{joined > 0 ? "You\u2019re making an impact!" : "Your circles start here"}</strong><p>{joined} {joined === 1 ? "circle" : "circles"} joined<br />{convos} {convos === 1 ? "conversation" : "conversations"}<br />{replies} {replies === 1 ? "reply" : "replies"} on them</p></div></div><p className={styles.journeyQuote}>{tr("circleDashboard.communityTurnsSmallStepsIntoBig")} <I name="Heart" /></p></section>
        {/* Real events, and only ones still to come. These were three fixed
            dates — SEP 28, OCT 04, OCT 12 — which were already in the past. */}
        {upcoming.length > 0 && <section className={styles.railPanel}><Heading title={tr("homeRail.upcomingEvents")} href="/app/events" /><div className={styles.eventList}>{upcoming.map(event => {
          const d = new Date(event.date);
          const ok = !Number.isNaN(d.getTime());
          return <div className={styles.event} key={event.id}><time><small>{ok ? d.toLocaleDateString("en-IN", { month: "short" }).toUpperCase() : ""}</small><strong>{ok ? String(d.getDate()).padStart(2, "0") : "\u2014"}</strong></time><div><strong>{event.title}</strong><span>{[event.venue || event.mode, event.time].filter(Boolean).join(" \u00b7 ")}</span><span className={styles.eventPeople}>{avatars.map(src => <img src={src} alt="" key={src} />)}</span></div><TransitionLink href={`/app/events/${event.id}`}>{event.registered ? "Open" : "Join"}</TransitionLink></div>;
        })}</div></section>}
        {/* Posts actually in her circles, with their real reply counts. */}
        {posts.length > 0 && <section className={styles.railPanel}><Heading title={tr("circleDashboard.activeConversations")} href="/app/circles" /><div className={styles.conversations}>{posts.map((post, index) => (
          <TransitionLink href={`/app/circles/${post.circle_id}`} key={post.id}><span className={styles.convAvatar}><img src={post.author_avatar || avatars[index % avatars.length]} alt="" /></span><span><strong>{post.body.slice(0, 64)}{post.body.length > 64 ? "\u2026" : ""}</strong><small>{post.reply_count} {post.reply_count === 1 ? "reply" : "replies"}{post.when ? ` \u00b7 ${whenWords(post.when)}` : ""}</small></span><I name="ChevronRight" /></TransitionLink>
        ))}</div></section>}
      </aside>
    </div>
  </HomeShell>;
}
