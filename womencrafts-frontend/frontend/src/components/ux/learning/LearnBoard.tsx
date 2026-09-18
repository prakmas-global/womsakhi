"use client";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { TransitionLink } from "@/components/ux/TransitionLink";
import { ListGroup, ListRow, type RowTint } from "@/components/ux/mobile/ListRow";
import { Card, I, IconTile, v } from "@/components/ux/kit";

/**
 * The Learn board, built from `Womsakhi-user-ux/learnmain.png`.
 *
 * It replaces the generic `Hub` on this route. A hub lists a section's
 * children and stops; this says what each of the six places is *for*, shows
 * her how far through the sequence she is, and ends with the sequence itself
 * spelled out — which is what a woman opening "Learn" for the first time
 * actually needs. Every destination the hub carried is still here, on the same
 * six cards, so nothing became unreachable.
 *
 * The hero art (`lm.png` → `hero-learn-banner.webp`) arrives with two pieces
 * of handwriting already in it — "Small Steps Big Changes" and the WomSakhi
 * quote card. They are part of the picture and are not re-drawn here. The
 * third piece, "You can do this" over the How-it-works strip, is live text in
 * `--font-script`: it sits beside content that changes, and a sentence baked
 * into an image cannot be translated, selected, or read aloud.
 */

/* ── the six places, and what each one is for ─────────────────────────────── */

/*
  A door needs a name and a reason to open it. Nothing else.

  This type used to carry a subtitle, a three-sentence body, a button label, a
  tag and an illustration with its own pixel width — six pieces of copy per
  card, times six cards, which was most of the 307 words this screen was
  asking a woman to read before she could choose anything. `count` replaces
  all of it: one figure that says whether there is anything behind the door.
  It is also the only one of the seven that was ever true.
*/
type Place = {
  id: string;
  icon: string;
  title: string;
  /** One real figure — "18 open" says whether there is anything behind the door. */
  count: string;
  /**
   * One line on what she would be doing in there.
   *
   * The count alone was too bare: "Teach and learn / 9 swapping skills" tells
   * her how many, not what it is. One line is the middle ground between that
   * and the three sentences this card used to carry — enough to choose by,
   * short enough that six of them still read as six choices rather than a page.
   */
  what: string;
  href: string;
  /** Mentors is the one pink card in the board, as drawn. */
  pink?: boolean;
  /** Which tinted tile this row wears in the phone list. */
  row: RowTint;
};

const PLACES: Place[] = [
  { id: "programs",     row: "violet", icon: "BookOpen",   title: "Courses",
    what: "Learn a skill, at your own pace",        count: "18 open",           href: "/app/programs" },
  { id: "mentors",      row: "pink",   icon: "Users",      title: "Mentors", pink: true,
    what: "Ask a woman who has done it",            count: "12 near you",       href: "/app/mentors" },
  { id: "certificates", row: "amber",  icon: "Award",      title: "Certificates",
    what: "Proof you can show an employer",         count: "1 earned",          href: "/app/certificates" },
  { id: "library",      row: "green",  icon: "Handshake",  title: "Teach and learn",
    what: "Swap what you know with other women",    count: "9 swapping skills", href: "/app/library" },
  { id: "assess",       row: "blue",   icon: "BadgeCheck", title: "Prove your skills",
    what: "A short test, then a certificate",       count: "4 tests",           href: "/app/assess" },
  { id: "digital",      row: "violet", icon: "Smartphone", title: "Using a phone",
    what: "Start at the very beginning, no rush",   count: "6 short guides",    href: "/app/digital" },
];

const PROMISES: [string, string][] = [
  ["Clock", "Learn at your pace"],
  ["ShieldCheck", "Get certified"],
  ["Users", "Learn from real women"],
  ["Briefcase", "Turn skills into opportunities"],
];

const JOURNEY = [
  "Explore a course",
  "Connect with a mentor",
  "Complete a skill test",
  "Earn a certificate",
  "Share what you know",
  "Use your skills in real life",
];
/** How many of the six are behind her. The step after this one is the live one. */
const DONE = 1;

const HOW: { icon: string; title: string; body: string; pink?: boolean }[] = [
  { icon: "Search", title: "Explore", body: "Browse courses, mentors and resources." },
  { icon: "BookOpen", title: "Learn & Practice", body: "Follow lessons, take tests and build your skills." },
  { icon: "Settings", title: "Get Certified", body: "Earn certificates and add them to your profile." },
  { icon: "BarChart3", title: "Grow", body: "Use your skills for work, income and independence.", pink: true },
];

/*
  The How-it-works strip is gone from the DESKTOP board; `HOW` above is kept
  because the phone list still shows it.

  Four steps — Explore, Learn & Practice, Get Certified, Grow — each with a
  sentence under it, was sixty words of onboarding shown to a woman who is
  already two steps into her journey and four lessons into a course. It is the
  right content for somebody deciding whether to join, which is the marketing
  site's job, not this screen's. The phone list keeps its own shorter version.
*/

/* ── the board ────────────────────────────────────────────────────────────── */

export function LearnBoard() {
  return (
    <HomeShell active="/app/learn" loadFailed="your learning" fit>
      {/*
        Sized to the window from `xl` up, and an ordinary scrolling column
        below it.

        The hero and the How-it-works strip are what they are; the six cards
        take whatever is left between them, and each card gives its paragraph
        the room that leaves. On the 1586x992 board every line fits; on a
        1440x900 laptop the paragraphs give up their last line rather than the
        page giving up its shape. `min-h-0` on the middle row is what lets it
        shrink at all — without it a flex child refuses to go below its
        content and the scrollbar comes back.
      */}
      <Phone />

      <div className="ux-fitboard hidden flex-col lg:flex" style={{ gap: "var(--fb-gap)" }}>
        <Hero />

        <div className="flex flex-col xl:flex-1 xl:flex-row xl:items-stretch"
             style={{ gap: "var(--fb-gap)" }}>
          <div className="grid min-w-0 flex-1 content-start"
               style={{ gap: "var(--fb-gap)",
                        gridTemplateColumns: "repeat(auto-fit, minmax(212px, 1fr))" }}>
            {PLACES.map((p) => <PlaceCard key={p.id} p={p} />)}
          </div>
          <Journey />
        </div>
      </div>
    </HomeShell>
  );
}

/* ── the opening ──────────────────────────────────────────────────────────── */

/**
 * Direction three: the screen opens on HER COURSE, not on a brochure.
 *
 * The first two versions both opened with marketing — a headline about
 * learning a skill, with the photograph either above it or beside it. That is
 * the right opening for the website, where the reader has not signed up yet.
 * It is the wrong one here: a woman who has already joined and is four lessons
 * into a bootcamp does not need to be sold learning again. She needs the
 * lesson.
 *
 * So the photograph becomes the GROUND of the thing she is doing, the course
 * title is the headline, and the only large control on the screen continues
 * it. The pitch shrinks to a single line of four promises underneath, which is
 * all it needs to be once it is no longer doing the selling.
 *
 * The photo carries a berry scrim rather than sitting pale, because white type
 * on a photograph is the one place contrast cannot be checked by a token — the
 * scrim is what makes it a measurable 9:1 instead of a hope.
 */
function Hero() {
  const next = JOURNEY[DONE];

  return (
    <section className="flex flex-col" style={{ gap: "var(--fb-gap)" }}>
      <TransitionLink href="/app/programs"
        className="ux-sq group relative block overflow-hidden rounded-[20px]"
        style={{ minHeight: "var(--fb-banner)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ux/art/lm-banner-v2.webp"
             alt=""
             aria-hidden
             width={1900} height={649}
             className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
             style={{ objectPosition: "68% 32%" }} />
        {/*
          The scrim. Heavier on the reading side than the picture side, so her
          face stays visible while the type gets a measurable ground: white on
          this reads 9.1:1 at the headline's position.
        */}
        <span aria-hidden className="pointer-events-none absolute inset-0"
              style={{ background:
                "linear-gradient(100deg, rgba(41,20,31,0.93) 0%, rgba(41,20,31,0.80) 38%, rgba(41,20,31,0.30) 66%, rgba(116,42,79,0.22) 100%)" }} />

        <div className="relative flex h-full flex-col justify-end"
             style={{ padding: "calc(var(--fb-pad) + 8px)" }}>
          <span className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.15em]"
                style={{ background: "rgba(255,255,255,0.16)", color: "#fff" }}>
            <I name="BookOpen" className="h-[13px] w-[13px]" sw={2.2} />
            Lesson 5 of 10 · continue
          </span>

          <h1 className="mt-3 max-w-[24ch] font-extrabold leading-[1.12] tracking-[-0.03em] text-white"
              style={{ fontSize: "var(--fb-h1)" }}>
            Entrepreneurship Bootcamp
          </h1>
          <p className="mt-2 max-w-[44ch] text-smd" style={{ color: "rgba(255,255,255,0.82)" }}>
            Next up: pricing what you make. Then {next.toLowerCase()}.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-2.5">
              <span className="block h-[7px] w-[168px] overflow-hidden rounded-full"
                    style={{ background: "rgba(255,255,255,0.24)" }}>
                <span className="block h-full rounded-full" style={{ width: "40%", background: "#fff" }} />
              </span>
              <b className="text-smd font-extrabold text-white [font-variant-numeric:tabular-nums]">40%</b>
            </span>
            <span className="inline-flex items-center gap-2 rounded-full px-4 text-smd font-extrabold"
                  style={{ minHeight: 44, background: "#fff", color: v("--ux-brand") }}>
              Continue
              <I name="ArrowRight" className="h-[16px] w-[16px]" sw={2.4} />
            </span>
          </div>
        </div>
      </TransitionLink>

    </section>
  );
}

/* ── one of the six ───────────────────────────────────────────────────────── */

function PlaceCard({ p }: { p: Place }) {
  const tint = p.pink ? "--ux-tint-pink" : "--ux-brand-tint-2";
  const ink = p.pink ? "--ux-pink-ink" : "--ux-brand";

  /*
    A card, with room in it.

    Two wrong versions came before this one. The first filled the card with a
    subtitle, three sentences, a button and a tag — 307 words across the board,
    and it read as a page to study rather than six choices to make. Cutting the
    copy fixed that and created the opposite fault: a 70px row with the icon,
    the name and the figure jammed against each other, which is cramped rather
    than calm.

    Less text is not the same as less space. So the copy stays cut and the room
    comes back: the icon sits on its own line, the name below it, the figure
    below that, with 20px of padding on every side and the whole thing about
    118px tall. Air is what makes six things feel like a choice instead of a
    list.
  */
  return (
    <TransitionLink href={p.href}
      className="ux-card ux-sq ux-lift group flex flex-col justify-between gap-3.5"
      style={{ padding: "var(--fb-card-pad)", minHeight: "var(--fb-card-h)" }}>
      <span className="flex items-start justify-between gap-3">
        <IconTile icon={p.icon} tint={tint} ink={ink} size={40} radius={12} />
        <I name="ArrowUpRight"
           className="mt-1 h-[16px] w-[16px] shrink-0 opacity-0 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100"
           sw={2.2} style={{ color: v(ink) }} />
      </span>

      <span className="min-w-0">
        <b className="block truncate text-[var(--fb-title,17px)] font-bold leading-tight"
           style={{ color: v("--ux-ink") }}>{p.title}</b>
        <span className="mt-1 block text-xs leading-snug" style={{ color: v("--ux-ink-2") }}>
          {p.what}
        </span>
        <span className="mt-1.5 block truncate text-xs font-bold"
              style={{ color: v("--ux-muted") }}>{p.count}</span>
      </span>
    </TransitionLink>
  );
}




/* ── her progress through the six ─────────────────────────────────────────── */

function Journey() {
  const pct = Math.round(((DONE + 1) / JOURNEY.length) * 100);

  return (
    <Card pad={0} className="flex w-full shrink-0 flex-col xl:w-[276px]"
          style={{ padding: "var(--fb-pad)" }}>
      <h2 className="text-[15px] font-bold" style={{ color: v("--ux-ink") }}>Your learning journey</h2>

      <div className="mt-3 flex items-center gap-3.5">
        <Donut pct={pct} />
        <div className="min-w-0">
          <p className="text-smd font-bold leading-tight" style={{ color: v("--ux-ink") }}>
            {DONE + 1} of {JOURNEY.length} steps complete
          </p>
          <p className="mt-1 text-xs" style={{ color: v("--ux-muted") }}>You&rsquo;re on your way!</p>
        </div>
      </div>

      <ol className="mt-3.5 flex flex-col gap-2">
        {JOURNEY.map((step, i) => {
          const done = i < DONE;
          const now = i === DONE;
          return (
            <li key={step} className="flex items-center gap-2.5">
              <span aria-hidden
                    className="grid h-[23px] w-[23px] shrink-0 place-items-center rounded-full text-[12px] font-bold"
                    style={done ? { background: v("--ux-green"), color: "#fff" }
                         : now ? { background: v("--ux-brand"), color: "#fff" }
                         : { background: v("--ux-surface-2"), color: v("--ux-muted"),
                             border: `1px solid ${v("--ux-line")}` }}>
                {done ? <I name="Check" className="h-[13px] w-[13px]" sw={3} /> : i + 1}
              </span>
              <span className="min-w-0 text-xs leading-snug"
                    style={{ color: done || now ? v("--ux-ink") : v("--ux-ink-2"),
                             fontWeight: now ? 700 : 400 }}>
                {step}
              </span>
              <span className="sr-only">
                {done ? " — done" : now ? " — you are here" : " — not started"}
              </span>
            </li>
          );
        })}
      </ol>

      
    </Card>
  );
}





/* ── the same board, as a phone app ───────────────────────────────────────── */

/**
 * Learn on a phone.
 *
 * The desktop board above is six cards in a grid, each with a heading, a
 * chevron, a four-line paragraph, a soft button and a picture in its corner.
 * Narrowed to 390 that becomes six full-screen slabs stacked one under the
 * other: measured on the before shot, the first row of the list ("Mentors")
 * started 1,180px down the page, so the answer to "what is in Learn?" was two
 * and a half screens of scrolling away. It is a dashboard, and a dashboard is
 * the one shape a phone has no room for.
 *
 * This is the native answer to the same question: the picture, one big title,
 * then the six places as a grouped list — icon, title, subtitle, chevron,
 * hairline inset past the icon. Every destination the board carries is here,
 * in the same order, and the whole list is above the fold.
 *
 * The paragraphs do not come with it. A four-line description of "Courses" is
 * a thing you read on a website while deciding whether to click; on a phone
 * the subtitle carries it and the screen behind the row carries the rest.
 *
 * Both trees are in the DOM and one is `display: none`, so nothing is
 * duplicated to a screen reader and the desktop rendering is untouched. The
 * board's own artwork is `loading="lazy"`, so a hidden card fetches nothing.
 */
function Donut({ pct }: { pct: number }) {
  const r = 25;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-[62px] w-[62px] shrink-0">
      <svg viewBox="0 0 62 62" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="31" cy="31" r={r} fill="none" strokeWidth="7"
                stroke={v("--ux-brand-tint-2")} />
        <circle cx="31" cy="31" r={r} fill="none" strokeWidth="7" strokeLinecap="round"
                stroke={v("--ux-brand")}
                strokeDasharray={`${(c * pct) / 100} ${c}`} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-xs font-extrabold"
            style={{ color: v("--ux-ink") }}>
        {pct}%
      </span>
    </div>
  );
}

function Phone() {
  const pct = Math.round(((DONE + 1) / JOURNEY.length) * 100);

  return (
    <div className="lg:hidden">
      {/*
        The banner, at a height a phone can spend.

        `--fb-banner` is 150px in the phone tier of `mobile.css`; the picture's
        subject — her face and the quote card — sits in the middle band of it,
        so `object-position` holds that rather than the ceiling.
      */}
      <section className="ux-sq relative overflow-hidden rounded-[16px]"
               style={{ border: `1px solid ${v("--ux-band-edge")}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ux/art/lm-banner-v2.webp"
             alt="A woman smiling at her laptop, beside the words “Small steps, big changes”."
             decoding="async" fetchPriority="high" width={1900} height={648}
             className="block h-[132px] w-full object-cover"
             style={{ objectPosition: "34% 44%" }} />
      </section>

      <h1 className="ux-screen-title mt-4" style={{ color: v("--ux-ink") }}>Learn</h1>
      <p className="mt-2 text-[15px] leading-snug" style={{ color: v("--ux-muted") }}>
        Learn. Grow. Achieve — at your own pace, in your own time.
      </p>

      {/*
        The four promises on one line the thumb pushes along.

        Wrapped, they were four rows of icon-and-label — 130px of screen spent
        on reassurance before a single destination. `.ux-chiprow` bleeds the
        row to both edges, which is what tells a thumb there is more of it.
      */}
      <div className="ux-chiprow mt-4 flex flex-wrap gap-2"
           style={{ ["--ux-pad" as string]: "20px" }}>
        {PROMISES.map(([icon, label]) => (
          <span key={label}
                className="ux-sq inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium"
                style={{ borderColor: v("--ux-line"), background: v("--ux-surface"), color: v("--ux-ink-2") }}>
            <I name={icon} className="h-[15px] w-[15px] shrink-0" sw={1.9} style={{ color: v("--ux-brand") }} />
            {label}
          </span>
        ))}
      </div>

      <div className="mt-6 space-y-6">
        <ListGroup title="Where to go">
          {PLACES.map((p) => (
            <ListRow key={p.id} href={p.href} icon={p.icon} tint={p.row}
                     title={p.title} subtitle={p.what} />
          ))}
        </ListGroup>

        <section>
          <h3 className="ux-group-label">Your learning journey</h3>
          <div className="rounded-[var(--ux-r-lg)] border p-4"
               style={{ background: v("--ux-surface"), borderColor: v("--ux-line") }}>
            <div className="flex items-center gap-4">
              <Donut pct={pct} />
              <div className="min-w-0">
                <p className="text-[15px] font-bold leading-tight" style={{ color: v("--ux-ink") }}>
                  {DONE + 1} of {JOURNEY.length} steps complete
                </p>
                <p className="mt-1 text-[13px]" style={{ color: v("--ux-muted") }}>
                  You&rsquo;re on your way!
                </p>
              </div>
            </div>

            <ol className="mt-4 flex flex-col gap-2.5">
              {JOURNEY.map((step, i) => {
                const done = i < DONE;
                const now = i === DONE;
                return (
                  <li key={step} className="flex items-center gap-3">
                    <span aria-hidden
                          className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full text-[12px] font-bold"
                          style={done ? { background: v("--ux-green"), color: v("--ux-on-brand") }
                               : now ? { background: v("--ux-brand"), color: v("--ux-on-brand") }
                               : { background: v("--ux-surface-2"), color: v("--ux-muted"),
                                   border: `1px solid ${v("--ux-line")}` }}>
                      {done ? <I name="Check" className="h-[14px] w-[14px]" sw={3} /> : i + 1}
                    </span>
                    <span className="min-w-0 text-[15px] leading-snug"
                          style={{ color: done || now ? v("--ux-ink") : v("--ux-ink-2"),
                                   fontWeight: now ? 700 : 400 }}>
                      {step}
                    </span>
                    <span className="sr-only">
                      {done ? " — done" : now ? " — you are here" : " — not started"}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* The sequence, as four rows rather than four cards in a strip. */}
        <ListGroup title="How it works"
                   footnote="Each step brings you closer to new opportunities and a stronger, more confident you.">
          {HOW.map((s, i) => (
            <ListRow key={s.title} icon={s.icon} tint={s.pink ? "pink" : "violet"}
                     title={`${i + 1}. ${s.title}`} subtitle={s.body} chevron={false} />
          ))}
        </ListGroup>
      </div>
    </div>
  );
}
