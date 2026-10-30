"use client";

import { PlaceBadge, PlaceMark, PlaceTile } from "@/components/ux/nav/Place";
import { SECTIONS } from "@/components/ux/nav-tree";
import { TransitionLink } from "@/components/ux/TransitionLink";
import { useNavLabel } from "@/components/ux/use-nav-label";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import * as Icons from "@/components/ux/icons";

import {
  Btn, Card, Chip, EmptyState, IconTile,
  SectionHead, SourceNote, plural
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { ChipRow, GroupHead } from "@/components/ux/learning/native";
import { DISCOVER_ART as RAW_DISCOVER_ART, KINDS as RAW_KINDS, type Find, type Kind } from "@/components/ux/discover/data";
import { useExploreFeed, useMyCity } from "@/components/ux/discover/near";
import { useT } from "@/i18n";
import { useTranslated } from "@/i18n/data";
import { MediaCard, MediaGrid } from "@/components/ux/media/MediaCard";
import { artFor, type ArtKind } from "@/components/ux/media/art";

/**
 * Discover — a lens over the whole app, not a copy of it.
 *
 * Every item here belongs to another module, so opening one goes to the module
 * that owns it. A second, subtly different copy of a job listing living in
 * Discover is how two screens end up disagreeing about the same job.
 */
export default function DiscoverPage() {
  return (
    <Suspense fallback={<HomeShell active="/app/explore"><Card>Loading…</Card></HomeShell>}>
      <Discover />
    </Suspense>
  );
}

/** How each kind of thing looks in the filter rail. Presentation, not data. */
const KIND_LOOK: Record<Kind, { icon: string; tint: string; ink: string }> = {
  Course: { icon: "BookOpen", tint: "--ux-tint-violet", ink: "--ux-violet" },
  Work: { icon: "Briefcase", tint: "--ux-tint-blue", ink: "--ux-blue" },
  Mentor: { icon: "UserRound", tint: "--ux-tint-pink", ink: "--ux-pink" },
  Circle: { icon: "Users", tint: "--ux-tint-green", ink: "--ux-green" },
  Event: { icon: "CalendarDays", tint: "--ux-tint-orange", ink: "--ux-orange" },
  Scheme: { icon: "BadgeIndianRupee", tint: "--ux-tint-lilac", ink: "--ux-brand" },
};

const ART_KIND: Record<string, ArtKind> = {
  Course: "course", Work: "job", Mentor: "mentor", Circle: "circle", Event: "event", Scheme: "scheme",
};

/** One find as a picture card: its own photo or cover, else a picture of what it is about. */
function FindCard({ f }: { f: Find }) {
  const tr = useT();
  return (
    <MediaCard
      href={f.href}
      image={artFor([f.title, f.sub], ART_KIND[f.kind] ?? "generic", f.art, f.id)}
      alt={f.title}
      topLeft={{ text: f.kind, tone: "light" }}
      topRight={f.near ? { text: tr("explore.nearYou"), tone: "green" } : f.isNew ? { text: "New", tone: "brand" } : null}
      title={f.title}
      subtitle={f.sub}
      meta={f.meta ? <span className="font-medium" style={{ color: "var(--ux-ink-2)" }}>{f.meta}</span> : undefined}
    />
  );
}

/** A grid of finds, picture first, on every screen size. */
/**
 * Every part of WomSakhi as pictures — what "View all 30+ modules" on Home
 * opens onto.
 *
 * One row per section in its colour, each place a picture tile with its name
 * under it (components/ux/nav/places.ts). A woman who cannot read the rail
 * still sees the whole app here: on a phone each row slides sideways so the
 * page stays eight rows tall, not eighty tiles; from `lg` it is a grid.
 */
function AllPlaces() {
  const nav = useNavLabel();
  return (
    <div className="mb-8 space-y-6" data-all-places>
      {SECTIONS.map((s) => {
        const kids = (s.children ?? []).filter((c) => !c.unlisted);
        return (
          <section key={s.id} aria-labelledby={`all-${s.id}`}>
            <h2 id={`all-${s.id}`} className="mb-2.5 flex items-center gap-2.5 text-base font-bold" style={{ color: "var(--ux-ink)" }}>
              <PlaceBadge node={s} size={32} />
              <TransitionLink href={s.href} className="hover:underline">{nav.label(s)}</TransitionLink>
            </h2>
            <div className="-mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-1 [scrollbar-width:thin] lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0 xl:grid-cols-6">
              {kids.map((c) => (
                <div key={c.id} className="w-[108px] shrink-0 snap-start lg:w-auto">
                  <PlaceTile node={c} size="sm" />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Finds({ items }: { items: Find[] }) {
  return <MediaGrid>{items.map((f) => <FindCard key={f.id} f={f} />)}</MediaGrid>;
}

function Discover() {
  const DISCOVER_ART = useTranslated(RAW_DISCOVER_ART);
  // Labels translate; the values compared stay the English keys the records
  // carry. Comparing translated chips against `f.kind` emptied every filter
  // in any language but English.
  const LABELS = useTranslated(RAW_KINDS);
  const label = (k: Kind) => LABELS[RAW_KINDS.indexOf(k)] ?? k;
  const tr = useT();
  const params = useSearchParams();
  const [kinds, setKinds] = useState<Kind[]>(() => {
    const k = params.get("kind");
    return k && (RAW_KINDS as string[]).includes(k) ? [k as Kind] : [];
  });
  const [nearOnly, setNearOnly] = useState(false);
  // Her town — from My details, else My work profile. "" until she sets one.
  const { data: CITY } = useMyCity();
  // Assembled from the modules that own each record, with "near" measured
  // against her town rather than "not online".
  const { data: FINDS, source } = useExploreFeed(CITY);

  const shown = useMemo(() => FINDS.filter((f) => {
    if (kinds.length && !kinds.includes(f.kind)) return false;
    if (nearOnly && !f.near) return false;
    return true;
  }), [kinds, nearOnly, FINDS]);

  const filtering = kinds.length > 0 || nearOnly;
  /**
   * Themed rows, built from what is actually in the feed.
   *
   * `COLLECTIONS` was a curated list of fixture ids — `f1`, `f4`, `f7` — and
   * the moment this screen read the server those ids matched nothing, so every
   * themed row rendered empty. Grouping the real records by kind keeps the
   * shape of the page without pretending an editor picked them.
   */
  const collections = useMemo(() => {
    const groups: { id: string; title: string; items: Find[] }[] = [
      { id: "near", title: CITY ? `Near you in ${CITY}` : "Near you", items: FINDS.filter((f) => f.near) },
      { id: "work", title: tr("explore.workYouCouldApplyFor"), items: FINDS.filter((f) => f.kind === "Work") },
      { id: "learn", title: tr("explore.learnSomethingNew"), items: FINDS.filter((f) => f.kind === "Course") },
      { id: "people", title: tr("explore.womenWhoWillSitWithYou"), items: FINDS.filter((f) => f.kind === "Mentor") },
    ];
    // A row with nothing in it is a heading with a gap under it.
    return groups.filter((g) => g.items.length);
  }, [FINDS, CITY, tr]);
  const counts = useMemo(() => {
    const m = new Map<Kind, number>();
    for (const f of FINDS) m.set(f.kind, (m.get(f.kind) ?? 0) + 1);
    return m;
  }, [FINDS]);
  // Only the kinds there is something of — a chip that can only lead to an
  // empty list is a dead end.
  const KINDS = RAW_KINDS.filter((k) => (counts.get(k) ?? 0) > 0);

  return (
    <HomeShell
      active="/app/explore"
      rail={
        <div className="space-y-[16px]">
          <Card className="ux-onscroll-soft">
            <SectionHead title={tr("explore.whatIsHere")} sub={tr("explore.everythingWomsakhiCanPointYouAt")} />
            <ul className="ux-stagger space-y-2.5">
              {KINDS.map((k) => {
                // An icon per kind, written down rather than fished out of the
                // results.
                //
                // This was `FINDS.find((x) => x.kind === k)!` — over the SERVER
                // list. `useDiscover` returns work, events, mentors and courses;
                // `KINDS` also declares Circle and Scheme. So `find` returned
                // undefined for two of the six, the `!` said otherwise, and
                // `f.icon` threw — taking the whole Explore page down to an
                // error boundary. It was never the data's job to say what a
                // filter chip looks like.
                const look = KIND_LOOK[k];
                return (
                  <li key={k}>
                    <button
                      onClick={() => setKinds(kinds.includes(k) ? kinds.filter((x) => x !== k) : [k])}
                      className="ux-hov flex w-full items-center gap-3 rounded-[12px] px-2 py-2 text-start transition-colors"
                      style={{ background: kinds.includes(k) ? "var(--ux-brand-tint)" : "transparent" }}
                    >
                      <IconTile icon={look.icon} tint={look.tint} ink={look.ink} size={34} radius={10} />
                      <span className="min-w-0 flex-1 truncate text-xsm"
                            style={{ color: kinds.includes(k) ? "var(--ux-brand)" : "var(--ux-ink-2)",
                                     fontWeight: kinds.includes(k) ? 600 : 400 }}>
                        {plural(label(k), 2)}
                      </span>
                      <span className="shrink-0 text-xs" style={{ color: "var(--ux-faint)" }}>
                        {counts.get(k) ?? 0}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          <div className="ux-clay ux-onscroll-soft relative overflow-hidden p-[20px]"
               style={{ background: "linear-gradient(140deg, var(--ux-tint-lilac), var(--ux-tint-blue))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" src={DISCOVER_ART.hero} alt=""
                 className="ux-float pointer-events-none absolute -bottom-3 -end-4 h-[100px] w-[100px] object-contain" />
            <h3 className="relative w-[60%] text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("explore.tellSakhiWhatYouWant")}</h3>
            <p className="relative mt-2 w-[60%] text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>{tr("explore.sayItInYourOwnWords")}</p>
            <div className="relative mt-3 w-[60%]">
              <Btn href="/app/sakhi" variant="soft" size="sm" iconEnd="ArrowRight">{tr("explore.askSakhi")}</Btn>
            </div>
          </div>
        </div>
      }
    >
      <div className="flex min-w-0 items-center gap-3">
        <PlaceMark size={44} />
        <h1 className="ux-screen-title text-2xl font-bold min-w-0" style={{ color: "var(--ux-ink)" }}>Everything</h1>
      </div>
      <p className="mt-2 text-xsm lg:mt-1.5" style={{ color: "var(--ux-muted)" }}>
        Courses, work, mentors, circles and events — {FINDS.length} things in one place.
      </p>

      <SourceNote source={source} what="suggestions" />

      {!CITY && source !== "loading" && (
        <Card className="mt-3">
          <p className="flex flex-wrap items-center gap-2 text-xsm" style={{ color: "var(--ux-ink-2)" }}>
            <Icons.MapPin className="h-4 w-4 shrink-0" style={{ color: "var(--ux-brand)" }} />
            Tell us your town to see what is near you.
            <Btn href="/app/settings/account" size="sm" variant="soft" iconEnd="ArrowRight">Set my town</Btn>
          </p>
        </Card>
      )}

      {/* The app itself, before what is in it: every part as a picture. */}
      {!filtering && <div className="mt-5"><AllPlaces /></div>}

      <ChipRow className="mb-6 mt-4 items-center lg:mb-[16px] lg:mt-[20px]">
        {KINDS.map((k) => (
          <Chip key={k} selected={kinds.includes(k)}
                onClick={() => setKinds(kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k])}>
            {plural(label(k), 2)}
          </Chip>
        ))}
        <span className="mx-1 h-6 w-px" style={{ background: "var(--ux-line)" }} />
        {CITY && <Chip selected={nearOnly} onClick={() => setNearOnly(!nearOnly)} icon="MapPin">{tr("explore.nearMe")}</Chip>}
        {filtering && (
          <Btn variant="ghost" size="sm" icon="X" onClick={() => { setKinds([]); setNearOnly(false); }}>Clear</Btn>
        )}
      </ChipRow>

      {filtering ? (
        shown.length ? (
          <>
            <div className="lg:hidden"><GroupHead title={`${shown.length} ${plural("result", shown.length)}`} /></div>
            <p className="mb-3 hidden text-xsm lg:block" style={{ color: "var(--ux-muted)" }}>
              {shown.length} {plural("result", shown.length)}
            </p>
            <Finds items={shown} />
          </>
        ) : (
          <Card>
            <EmptyState
              icon="SearchX"
              title={tr("explore.nothingMatchesThat")}
              body={tr("explore.tryOneFewerFilterOrAsk")}
              action={<Btn onClick={() => { setKinds([]); setNearOnly(false); }} variant="soft">{tr("explore.showEverything")}</Btn>}
            />
          </Card>
        )
      ) : (
        /* Themed rows, so the page has a shape rather than being a heap. */
        <div className="space-y-6 lg:space-y-[24px]">
          {collections.map((c) => {
            const seeAll = () => {
              setKinds(Array.from(new Set(c.items.map((f) => f.kind))));
              setNearOnly(c.id === "near");
            };
            return (
              <section key={c.id}>
                {/* A quiet label on a phone; the section heading from `lg`. */}
                <div className="lg:hidden"><GroupHead title={c.title} action={tr("circles.seeAll")} onAction={seeAll} /></div>
                <div className="hidden lg:block"><SectionHead title={c.title} action={tr("circles.seeAll")} onAction={seeAll} /></div>
                <Finds items={c.items.slice(0, 4)} />
              </section>
            );
          })}
        </div>
      )}
    </HomeShell>
  );
}
