"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as Icons from "@/components/ux/icons";

import {
  Btn, Card, Chip, EmptyState, IconTile, Pill,
  SectionHead, SourceNote, plural
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { ChipRow, GroupHead, MediaRow, RowGroup } from "@/components/ux/learning/native";
import { DISCOVER_ART, KINDS, type Find, type Kind } from "@/components/ux/discover/data";
import { CITY } from "@/components/ux/local/data";
import { useDiscover } from "@/components/ux/growth";
import { useT } from "@/i18n";

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

function Row({ f, i }: { f: Find; i: number }) {
  const tr = useT();
  return (
    <Link
      href={f.href}
      className="ux-i ux-sq ux-onscroll flex items-center gap-3.5 rounded-[12px] border p-3.5"
      style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface)", ["--i" as string]: i }}
    >
      {f.art ? (
        <span className="h-[54px] w-[54px] shrink-0 overflow-hidden rounded-[12px]" style={{ background: `var(${f.tint})` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img loading="lazy" decoding="async" src={f.art} alt="" className="ux-art h-full w-full object-cover" />
        </span>
      ) : (
        <IconTile icon={f.icon} tint={f.tint} ink={f.ink} size={54} radius={12} />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 truncate text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>
            {f.title}
          </h3>
          {f.isNew && <Pill tone="brand" size="sm">New</Pill>}
          {f.near && <Pill tone="green" size="sm">{tr("explore.nearYou")}</Pill>}
        </div>
        <p className="mt-0.5 truncate text-xs" style={{ color: "var(--ux-muted)" }}>{f.sub}</p>
        <p className="mt-1 truncate text-xs font-medium" style={{ color: "var(--ux-ink-2)" }}>{f.meta}</p>
      </div>
      <span className="shrink-0 rounded-full px-2.5 py-[4px] text-2xs font-semibold"
            style={{ background: `var(${f.tint})`, color: `var(${f.ink}-ink)` }}>
        {f.kind}
      </span>
      <Icons.ArrowRight className="ux-arrow h-[17px] w-[17px] shrink-0" style={{ color: "var(--ux-faint)" }} />
    </Link>
  );
}

/**
 * The same find as a grouped-list row, for a phone.
 *
 * Every item here is a destination in another module, which is exactly what a
 * grouped inset list is for: picture, title, two quiet lines, what kind of
 * thing it is, a chevron. The bordered card per item was the desktop shape.
 */
function PhoneRow({ f }: { f: Find }) {
  const tr = useT();
  return (
    <MediaRow
      href={f.href}
      media={f.art ? (
        <span className="h-full w-full" style={{ background: `var(${f.tint})` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img loading="lazy" decoding="async" src={f.art} alt="" className="ux-art h-full w-full object-cover" />
        </span>
      ) : (
        <IconTile icon={f.icon} tint={f.tint} ink={f.ink} size={44} radius={12} />
      )}
      title={f.title}
      badges={<>
        {f.isNew && <Pill tone="brand" size="sm">New</Pill>}
        {f.near && <Pill tone="green" size="sm">{tr("explore.nearYou")}</Pill>}
      </>}
      lines={[f.sub, <span key="m" style={{ color: "var(--ux-ink-2)" }}>{f.meta}</span>]}
      trailing={
        <span className="shrink-0 rounded-full px-2.5 py-[4px] text-[12px] font-semibold"
              style={{ background: `var(${f.tint})`, color: `var(${f.ink}-ink)` }}>
          {f.kind}
        </span>
      }
    />
  );
}

/** A list of finds: a grouped list on a phone, the bordered rows from `lg`. */
function Finds({ items }: { items: Find[] }) {
  return (
    <>
      <RowGroup className="lg:hidden">
        {items.map((f) => <PhoneRow key={f.id} f={f} />)}
      </RowGroup>
      <div className="ux-deck ux-stagger hidden space-y-[12px] lg:block">
        {items.map((f, i) => <Row key={f.id} f={f} i={i} />)}
      </div>
    </>
  );
}

function Discover() {
  const tr = useT();
  const params = useSearchParams();
  const [kinds, setKinds] = useState<Kind[]>(() => {
    const k = params.get("kind");
    return k && (KINDS as string[]).includes(k) ? [k as Kind] : [];
  });
  const [nearOnly, setNearOnly] = useState(false);
  // Assembled from the modules that own each record, so a job posted this
  // morning turns up here rather than in a list that shipped with the app.
  const { data: FINDS, source } = useDiscover();

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
      { id: "near", title: `Near you in ${CITY}`, items: FINDS.filter((f) => f.near) },
      { id: "work", title: "Work you could apply for", items: FINDS.filter((f) => f.kind === "Work") },
      { id: "learn", title: "Learn something new", items: FINDS.filter((f) => f.kind === "Course") },
      { id: "people", title: "Women who will sit with you", items: FINDS.filter((f) => f.kind === "Mentor") },
    ];
    // A row with nothing in it is a heading with a gap under it.
    return groups.filter((g) => g.items.length);
  }, [FINDS]);
  const counts = useMemo(() => {
    const m = new Map<Kind, number>();
    for (const f of FINDS) m.set(f.kind, (m.get(f.kind) ?? 0) + 1);
    return m;
  }, [FINDS]);

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
                        {plural(k, 2)}
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
      <h1 className="ux-screen-title text-2xl font-bold" style={{ color: "var(--ux-ink)" }}>Everything</h1>
      <p className="mt-2 text-xsm lg:mt-1.5" style={{ color: "var(--ux-muted)" }}>
        Courses, work, mentors, circles, events and schemes — {FINDS.length} things in one place.
      </p>

      <SourceNote source={source} what="suggestions" />

      <ChipRow className="mb-6 mt-4 items-center lg:mb-[16px] lg:mt-[20px]">
        {KINDS.map((k) => (
          <Chip key={k} selected={kinds.includes(k)}
                onClick={() => setKinds(kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k])}>
            {plural(k, 2)}
          </Chip>
        ))}
        <span className="mx-1 h-6 w-px" style={{ background: "var(--ux-line)" }} />
        <Chip selected={nearOnly} onClick={() => setNearOnly(!nearOnly)} icon="MapPin">{tr("explore.nearMe")}</Chip>
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
              body="Try one fewer filter, or ask Sakhi in your own words."
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
                <div className="lg:hidden"><GroupHead title={c.title} action="See all" onAction={seeAll} /></div>
                <div className="hidden lg:block"><SectionHead title={c.title} action="See all" onAction={seeAll} /></div>
                <Finds items={c.items.slice(0, 4)} />
              </section>
            );
          })}
        </div>
      )}
    </HomeShell>
  );
}
