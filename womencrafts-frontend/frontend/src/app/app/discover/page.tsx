"use client";

import { Img } from "@/components/ux/media/Img";
import { PlaceMark } from "@/components/ux/nav/Place";
import Image from "next/image";
import { useT } from "@/i18n";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { ArrowRight, Bookmark, BookOpen, BriefcaseBusiness, Heart, IndianRupee, MapPin, Sparkles, TrendingUp, UserRound, UsersRound } from "lucide-react";
import { useDiscoverRails, type DiscoverItem } from "@/components/ux/discovery/data";
import { isNear, useMyCity } from "@/components/ux/discover/near";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { toast } from "@/components/ux/mobile/Toast";
import { apiSave, apiSaved, apiUnsave, type SavedKind } from "@/lib/entitlements-api";
import { useResource } from "@/lib/use-resource";
import styles from "./discover.module.css";
import { MediaCard, MediaGrid } from "@/components/ux/media/MediaCard";
import { artFor, type ArtKind } from "@/components/ux/media/art";

/** What each card is saved as on the server (`/saved`). Circles are joined, not saved. */
const SAVE_KIND: Partial<Record<DiscoverItem["kind"], SavedKind>> = {
  opportunity: "job", course: "program", woman: "mentor",
};

const FILTERS = [
  ["all", "All", Sparkles], ["learn", "Learning", BookOpen], ["work", "Work", BriefcaseBusiness],
  ["earn", "Earning", IndianRupee], ["community", "Community", UsersRound],
  ["women", "Mentors", UserRound], ["near", "Nearby", MapPin],
] as const;
type Filter = (typeof FILTERS)[number][0];

function SectionHead({ icon: Icon, title, copy, href }: { icon: typeof Heart; title: string; copy: string; href: string }) {
  const tr = useT();
  return <header className={styles.sectionHead}><span><Icon /></span><div><h2>{title}</h2><p>{copy}</p></div><Link href={href}>{tr("calendar.viewAll")} <ArrowRight /></Link></header>;
}

const ART_KIND: Record<DiscoverItem["kind"], ArtKind> = { opportunity: "job", course: "course", circle: "circle", woman: "mentor" };
/** The picture for an item: its own photo, else one that shows what it is about. */
const pictureOf = (item: DiscoverItem) =>
  artFor([item.title, item.detail, ...(item.tags ?? [])], ART_KIND[item.kind] ?? "generic", item.photo, item.id);

function OpportunityCard({ item, saved, onSave }: { item: DiscoverItem; saved: boolean; onSave?: () => void }) {
  const kind = item.kind === "course" ? "Course" : item.kind === "circle" ? "Circle" : item.kind === "woman" ? "Mentor"
    : item.earning ? "Earning" : "Work";
  return (
    <MediaCard
      href={item.href}
      image={pictureOf(item)}
      alt={item.title}
      topLeft={{ text: kind, tone: "light" }}
      overlay={item.meta ? <span className="truncate">{item.meta}</span> : null}
      title={item.title}
      subtitle={item.detail}
      footer={
        <div className="flex items-center justify-between gap-2">
          <Link href={item.href} className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: "var(--ux-brand)" }}>
            {item.kind === "opportunity" ? "View details" : "Explore"} <ArrowRight className="h-[13px] w-[13px]" />
          </Link>
          {onSave && (
            <button type="button" onClick={onSave} aria-label={`${saved ? "Remove" : "Save"} ${item.title}`} aria-pressed={saved}
                    className="ux-press grid h-8 w-8 place-items-center rounded-full"
                    style={{ background: saved ? "var(--ux-brand-tint)" : "var(--ux-surface-2)", color: "var(--ux-brand)" }}>
              <Bookmark className="h-[15px] w-[15px]" fill={saved ? "currentColor" : "none"} />
            </button>
          )}
        </div>
      }
    />
  );
}

export default function DiscoverPage() {
  const tr = useT();
  const rails = useDiscoverRails();
  const [filter, setFilter] = useState<Filter>("all");
  const { data: city } = useMyCity();

  // Bookmarks live on the server (`/saved`): what she saved here is in Saved,
  // on any phone, tomorrow. The set is the server's answer; `flips` are her
  // taps since it loaded, reverted if the write fails.
  const savedList = useResource(useCallback((s: AbortSignal) => apiSaved(s).catch(() => []), []), []);
  const [flips, setFlips] = useState<Record<string, boolean>>({});
  const keyOf = (item: DiscoverItem) => `${SAVE_KIND[item.kind]}:${item.id}`;
  const serverSaved = useMemo(() => new Set(savedList.data.map((x) => `${x.kind}:${x.ref_id}`)), [savedList.data]);
  const isSaved = (item: DiscoverItem) => flips[keyOf(item)] ?? serverSaved.has(keyOf(item));
  const toggleSave = async (item: DiscoverItem) => {
    const kind = SAVE_KIND[item.kind];
    if (!kind) return;
    const now = isSaved(item);
    setFlips((f) => ({ ...f, [keyOf(item)]: !now }));
    try {
      if (now) await apiUnsave(kind, item.id); else await apiSave(kind, item.id);
      toast(now ? "Removed from Saved" : "Saved — find it in Saved", { tone: "success" });
    } catch {
      setFlips((f) => ({ ...f, [keyOf(item)]: now }));
      toast("That did not save. Try again in a moment.", { tone: "error" });
    }
  };

  // Each tab is its own real slice: Work is jobs and internships, Earning is
  // work paid per piece or per job, Nearby is anything whose place names her town.
  const opportunities = useMemo(() => {
    const { work, learn, circles, women } = rails.data;
    if (filter === "learn") return learn;
    if (filter === "work") return work.filter((w) => !w.earning);
    if (filter === "earn") return work.filter((w) => w.earning);
    if (filter === "community") return circles;
    if (filter === "women") return women;
    if (filter === "near") return [...work, ...women].filter((x) => isNear(x.place, city));
    return [...work.slice(0, 3), ...learn.slice(0, 2), ...circles.slice(0, 2), ...women.slice(0, 1)];
  }, [filter, rails.data, city]);
  const visible = opportunities.slice(0, 8);

  return <HomeShell columns active="/app/discover" skeleton="grid" loadFailed="your recommendations"><main className={styles.page} data-dashboard="discover">
    <section data-banner data-page-hero className={styles.hero} aria-labelledby="chosen-title">
      <Image src="/ux/discover/chosen-hero-v1.webp" alt={tr("discover.aConfidentWomanLookingTowardNew")} fill priority sizes="(max-width: 760px) 100vw, 80vw" />
      <div className={styles.heroShade} /><div className={styles.heroCopy}><p><Link href="/app">Home</Link> / Chosen for you</p><div className="mb-2"><PlaceMark size={44} /></div><h1 id="chosen-title">Chosen <em>{tr("discover.forYou2")}</em></h1><span>{tr("discover.curatedOpportunitiesPeopleAndResourcesThat")}</span></div>
      <p className={styles.heroNote}>Opportunities<br />{tr("discover.findYouToo")}<br />Here <Heart /></p><blockquote>{tr("discover.theRightOpportunityAtTheRight")}<cite>— WomSakhi</cite></blockquote>
    </section>

    <nav className={styles.filters} aria-label={tr("discover.recommendationFilters")}><div>{FILTERS.map(([id, label, Icon]) => <button type="button" key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}><Icon />{id === "near" && city ? `Near ${city}` : label}</button>)}</div></nav>

    <section><SectionHead icon={Heart} title={tr("discover.opportunitiesForYou")} copy="Handpicked from your available recommendations." href="/app/explore" />
      {rails.source === "loading" ? <div className={styles.loading}>{tr("discover.findingTheBestMatchesForYou")}</div> : visible.length ? <MediaGrid>{visible.map((item) => <OpportunityCard key={`${item.kind}-${item.id}`} item={item} saved={isSaved(item)} onSave={SAVE_KIND[item.kind] ? () => void toggleSave(item) : undefined} />)}</MediaGrid> : filter === "near" && !city ? <div className={styles.empty}>Tell us your town to see what is near you. <Link href="/app/settings/account">Set my town</Link></div> : <div className={styles.empty}>{filter === "near" ? `Nothing listed in ${city} yet.` : tr("discover.noMatchesUnderThisFilterYet")} <button type="button" onClick={() => setFilter("all")}>{tr("books.showEverything")}</button></div>}
    </section>

    <section><SectionHead icon={UserRound} title={tr("discover.womenLikeYou2")} copy="Connect with women who share similar interests, skills or goals." href="/app/mentors" />
      <div className={styles.peopleGrid}>{rails.data.women.slice(0, 4).map(woman => <article className={styles.person} key={woman.id}>{woman.photo ? <Img src={woman.photo} width={54} height={54} /> : <span className={styles.initial}>{woman.title.charAt(0)}</span>}<div><h3>{woman.title}</h3><p>{woman.detail}</p><small><MapPin />{woman.meta || "WomSakhi community"}</small></div><div className={styles.tags}>{(woman.tags ?? []).slice(0, 3).map(tag => <span key={tag}>{tag}</span>)}</div><Link href={woman.href}>Connect</Link></article>)}</div>
    </section>

    <div className={styles.bottomGrid}>
      <section className={styles.panel}><SectionHead icon={TrendingUp} title={tr("discover.trendingForYou")} copy="Popular learning resources from your network." href="/app/programs" /><div className={styles.trending}>{rails.data.learn.slice(0, 3).map((item) => <Link href={item.href} key={item.id}><Img src={pictureOf(item)} width={94} height={58} /><span><b>{item.title}</b><small>{item.detail}</small></span><ArrowRight /></Link>)}</div></section>
      <section className={styles.panel}><SectionHead icon={UsersRound} title={tr("discover.communitiesYouMayLike")} copy="Join conversations, ask questions, and grow together." href="/app/circles" /><div className={styles.communities}>{rails.data.circles.slice(0, 3).map((circle) => <article key={circle.id}><span className={styles.communityArt}><Img src={pictureOf(circle)} width={44} height={44} /></span><h3>{circle.title}</h3><p>{circle.detail}</p><Link href={circle.href}>Join</Link></article>)}</div></section>
      <aside className={styles.mantra}><Sparkles /><p>{tr("discover.smallSteps2")}<br />{tr("discover.createBig")}<br />futures.</p><Heart /></aside>
    </div>
  </main></HomeShell>;
}
