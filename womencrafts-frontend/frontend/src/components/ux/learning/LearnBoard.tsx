"use client";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { TransitionLink } from "@/components/ux/TransitionLink";
import { ListGroup, ListRow, type RowTint } from "@/components/ux/mobile/ListRow";
import { Btn, Card, I, IconTile, v } from "@/components/ux/kit";

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

type Place = {
  id: string;
  icon: string;
  title: string;
  sub: string;
  body: string;
  cta: string;
  tag: string;
  href: string;
  /** Mentors is the one pink card in the board, as drawn. */
  pink?: boolean;
  /** Which tinted tile this row wears in the phone list. */
  row: RowTint;
  /**
   * The picture in the card's bottom-right corner.
   *
   * These are what the board fills its cards with, and what the version
   * without them left hollow: title, two lines, then a gap, then a button
   * pinned to the floor. Supplied per card, 296-372px wide, and drawn at ~150
   * — they have no headroom above that, so they are never scaled up.
   */
  art: string;
  /** How wide the art's own frame is, so each keeps its native proportions. */
  artW: number;
};

const PLACES: Place[] = [
  {
    id: "programs", row: "violet", icon: "BookOpen", title: "Courses", sub: "Started and suggested",
    body: "Real skills, taught in plain language, at whatever pace your day allows.",
    cta: "Browse courses", tag: "Learn new skills", href: "/app/programs", art: "learn-books", artW: 296,
  },
  {
    id: "mentors", row: "pink", icon: "Users", title: "Mentors", sub: "Women who have done it",
    body: "Women who have already done the thing you are trying to do.",
    cta: "Find mentors", tag: "Get guidance", href: "/app/mentors", art: "learn-mentors", artW: 332, pink: true,
  },
  {
    id: "certificates", row: "amber", icon: "Award", title: "Certificates", sub: "Proof you can show",
    body: "Proof you can put in front of an employer or a buyer.",
    cta: "View certificates", tag: "Show your progress", href: "/app/certificates", art: "learn-certificate", artW: 322,
  },
  {
    id: "library", row: "green", icon: "Handshake", title: "Teach and learn", sub: "Swap what you know",
    body: "Teach what you know, learn what you do not, from women like you.",
    cta: "Start teaching", tag: "Teach & learn together", href: "/app/library", art: "learn-teaching", artW: 338,
  },
  {
    id: "assess", row: "blue", icon: "BadgeCheck", title: "Prove your skills", sub: "A short test, then a certificate",
    body: "A short test, and a certificate that says you passed it.",
    cta: "Take a test", tag: "Build your credibility", href: "/app/assess", art: "learn-skilltest", artW: 337,
  },
  {
    id: "digital", row: "orange", icon: "Smartphone", title: "Using a phone", sub: "From the very beginning",
    body: "New to a smartphone? Start at the very beginning, with no rush.",
    cta: "Start learning", tag: "Digital confidence", href: "/app/digital", art: "learn-phone", artW: 306,
  },
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
          {/* An explicit `auto-fit`, not a `wide:` variant. `--breakpoint-wide`
              is declared in `design-system/tokens.css`, which is not the
              `@theme` block Tailwind reads, so `wide:grid-cols-3` compiled to
              nothing and the six cards sat in two columns — three rows where
              the board has two, and the reason it did not fit the window.
              Column count from the space available is also the right rule
              here: the journey card beside it is a fixed 276px. */}
          <div className="grid min-w-0 flex-1"
               style={{ gap: "var(--fb-gap)",
                        gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
            {PLACES.map((p) => <PlaceCard key={p.id} p={p} />)}
          </div>
          <Journey />
        </div>

        <HowItWorks />
      </div>
    </HomeShell>
  );
}

/* ── hero ─────────────────────────────────────────────────────────────────── */

/**
 * A deliberately light band in both themes.
 *
 * The artwork is a photograph on a pale pink wall with the quote card printed
 * into it, so there is no dark counterpart to swap to and no honest way to
 * tint one. The band therefore sets its own ink rather than reading the theme
 * — every colour below is chosen against this gradient, not against
 * `--ux-canvas`, which in dark mode is behind it rather than under it.
 */
const HERO_INK = v("--ux-band-ink");
const HERO_INK_2 = v("--ux-band-ink-2");
const HERO_BRAND = v("--ux-band-brand");

function Hero() {
  /*
    `lm.png`, whole and unmodified — the script, the woman and the quote card
    exactly as supplied, edge to edge across the band.

    It carries no headline of its own, so the words that were live text over it
    move below it: this app runs in eighteen languages and is read aloud, and
    text baked into a picture cannot be translated or spoken. The picture is
    the banner; the sentence under it is still a sentence.
  */
  return (
    <section className="ux-sq relative isolate shrink-0 overflow-hidden rounded-[18px]"
             style={{ border: `1px solid ${v("--ux-band-edge")}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ux/art/lm-banner-v2.webp"
           alt="A woman smiling at her laptop, beside the words “Small steps, big changes” and “Learning is not just for today, but for the life you dream about.”"
           decoding="async" fetchPriority="high" width={1900} height={648}
           /* Capped, not free-running. At its own 2.93:1 the picture is 540px
              tall on a 1580 board — a poster rather than a banner, and it put
              everything else below the fold. `object-cover` at a fixed height
              keeps the full width of it, which is where the script, the woman
              and the quote card all are, and trims only the empty ceiling and
              the desk. Height steps down with the window like every other
              measure on this board. */
           className="block w-full object-cover"
           style={{ height: "var(--fb-banner, 200px)", objectPosition: "center 34%" }} />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3"
           style={{ background: v("--ux-band-learn"), borderTop: `1px solid ${v("--ux-band-edge")}` }}>
        <div className="min-w-0 flex-1">
          <p className="text-2xs font-bold uppercase tracking-[0.16em]" style={{ color: HERO_BRAND }}>Learn</p>
          <h1 className="mt-0.5 font-extrabold leading-[1.1] tracking-[-0.03em]"
              style={{ fontSize: "clamp(1.25rem, 2.1vw, 1.7rem)", color: HERO_INK }}>
            Learn. Grow. Achieve.
          </h1>
        </div>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5"
            style={{ fontSize: "var(--fb-chip, 12px)" }}>
          {PROMISES.map(([icon, label]) => (
            <li key={label} className="flex items-center gap-1.5">
              <I name={icon} className="h-[15px] w-[15px] shrink-0" sw={1.9} style={{ color: HERO_BRAND }} />
              <span className="font-medium" style={{ color: HERO_INK_2, fontSize: "inherit" }}>{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ── one of the six ───────────────────────────────────────────────────────── */

function PlaceCard({ p }: { p: Place }) {
  const tint = p.pink ? "--ux-tint-pink" : "--ux-brand-tint-2";
  const ink = p.pink ? "--ux-pink-ink" : "--ux-brand";

  /*
    Six cards, rebuilt — and the illustration is gone.

    Each card used to carry a clip-art .webp bleeding off its bottom-right
    corner, under a three-sentence description clamped to two lines. Three
    things went wrong at once: the picture crowded the button it sat beside,
    the sentence stopped mid-word ("from basics to…"), and the card grew tall
    enough that only a row and a half fitted on screen. Making the card taller
    to fit the art made the board worse, and clamping the text to fit the card
    made the writing worse.

    So the art goes and the copy gets shorter. What is left is what a woman
    actually needs to choose between six doors: an icon she can recognise
    without reading, a name, and one sentence. The board is dense enough to see
    whole now, which is the only reason a grid of six beats a list of six.

    The whole card is one link. The button is a second affordance for the same
    destination, kept because "Browse courses" tells her what happens and
    "Courses" only tells her where she is.
  */
  return (
    <Card pad={0} className="ux-onscroll ux-lift group flex h-full min-h-0 flex-col overflow-hidden">
      <TransitionLink href={p.href} className="ux-sq flex min-h-0 flex-1 flex-col"
                      style={{ padding: "var(--fb-pad)" }}>
        <span className="flex items-start gap-3">
          <IconTile icon={p.icon} tint={tint} ink={ink} size={40} radius={12} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <b className="min-w-0 flex-1 text-[var(--fb-title,17px)] font-bold leading-tight"
                 style={{ color: v("--ux-ink") }}>{p.title}</b>
              <I name="ArrowUpRight"
                 className="h-[16px] w-[16px] shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                 sw={2.2} style={{ color: v(ink) }} />
            </span>
            <span className="mt-0.5 block text-xs" style={{ color: v("--ux-muted") }}>{p.sub}</span>
          </span>
        </span>

        {/* No clamp. The line is one sentence and it fits — that is the fix. */}
        <span className="mt-3 block text-[var(--fb-body,13.5px)]"
              style={{ color: v("--ux-ink-2"), lineHeight: "var(--fb-lines, 1.55)" }}>
          {p.body}
        </span>
      </TransitionLink>

      <div className="mt-auto flex shrink-0 items-center justify-between gap-2"
           style={{ paddingInline: "var(--fb-pad)", paddingBottom: "var(--fb-pad)" }}>
        <Btn href={p.href} variant="soft" size="sm" iconEnd="ArrowRight"
             className="shrink-0 whitespace-nowrap">{p.cta}</Btn>
        <span className="ux-tag-optional truncate text-xs" style={{ color: v("--ux-faint") }}>
          {p.tag}
        </span>
      </div>
    </Card>
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
                    className="grid h-[23px] w-[23px] shrink-0 place-items-center rounded-full text-[11px] font-bold"
                    style={done ? { background: v("--ux-green"), color: "#fff" }
                         : now ? { background: v("--ux-brand"), color: "#fff" }
                         : { background: v("--ux-surface-2"), color: v("--ux-muted"),
                             border: `1px solid ${v("--ux-line")}` }}>
                {done ? <I name="Check" className="h-[13px] w-[13px]" sw={3} /> : i + 1}
              </span>
              <span className="min-w-0 text-xs leading-snug"
                    style={{ color: done || now ? v("--ux-ink") : v("--ux-ink-2"),
                             fontWeight: now ? 700 : 500 }}>
                {step}
              </span>
              <span className="sr-only">
                {done ? " — done" : now ? " — you are here" : " — not started"}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-auto flex items-start gap-2.5 rounded-[13px] p-3"
           /* `mt-auto`, so the tip sits on the floor of the card however tall
              the column beside it turns out to be, rather than leaving a gap
              under itself. */
           style={{ background: v("--ux-brand-tint") }}>
        <I name="Lightbulb" className="mt-px h-[15px] w-[15px] shrink-0" sw={1.9}
           style={{ color: v("--ux-brand") }} />
        <p className="text-2xs leading-relaxed" style={{ color: v("--ux-brand-700") }}>
          Each step brings you closer to new opportunities and a stronger, more confident you.
        </p>
      </div>
    </Card>
  );
}

/**
 * The ring.
 *
 * Drawn rather than animated from zero: it is a statement of where she is, and
 * a figure that counts up every time the screen mounts turns a fact into a
 * performance. The number is inside the ring so the two cannot disagree.
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

/* ── the sequence, spelled out ────────────────────────────────────────────── */

function HowItWorks() {
  return (
    <Card pad={0} className="relative shrink-0 overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pe-[160px]"
           style={{ paddingInline: "var(--fb-pad)", paddingTop: "var(--fb-pad)",
                    paddingRight: 160 }}>
        <IconTile icon="Settings" tint="--ux-brand-tint-2" ink="--ux-brand" size={34} radius={11} />
        <h2 className="text-[17px] font-bold" style={{ color: v("--ux-ink") }}>How it works</h2>
        <p className="text-xs" style={{ color: v("--ux-muted") }}>
          Your learning journey in simple steps
        </p>
      </div>

      <YouCanDoThis />

      {/* 62px kept clear on the end, for the assistant.
          She floats `fixed` in the bottom-right corner of every screen. On a
          scrolling page the scroller's 96px of bottom clearance means she
          hovers over canvas; this board has no such clearance by design, so
          without this she sat on top of step 4. */}
      <ol className="flex flex-col gap-2.5 lg:flex-row lg:items-stretch"
          style={{ padding: "var(--fb-pad)", paddingInlineEnd: "calc(var(--fb-pad) + 58px)" }}>
        {HOW.map((s, i) => (
          <li key={s.title} className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="flex min-w-0 flex-1 items-start gap-3 rounded-[14px]"
                 style={{ background: v("--ux-surface-2"), padding: "calc(var(--fb-pad) - 4px)" }}
            >
              <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full"
                    style={{ background: s.pink ? v("--ux-tint-pink") : v("--ux-brand-tint-2") }}>
                <I name={s.icon} className="h-[21px] w-[21px]" sw={1.8}
                   style={{ color: s.pink ? v("--ux-pink-ink") : v("--ux-brand") }} />
              </span>
              <div className="min-w-0">
                <p className="flex items-baseline gap-2">
                  <b className="text-smd font-extrabold" style={{ color: v("--ux-brand") }}>{i + 1}</b>
                  <b className="min-w-0 text-smd font-bold" style={{ color: v("--ux-ink") }}>{s.title}</b>
                </p>
                <p className="mt-0.5 text-xs leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                  {s.body}
                </p>
              </div>
            </div>
            {i < HOW.length - 1 && (
              <I name="ArrowRight" aria-hidden className="hidden h-[17px] w-[17px] shrink-0 lg:block"
                 sw={2} style={{ color: v("--ux-line-strong") }} />
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}

/**
 * The one piece of handwriting that is text rather than picture.
 *
 * Hidden below `lg`, where the header wraps and there is no corner to put it
 * in — an encouragement that overlaps the title it is encouraging stops being
 * one. `aria-hidden` on the arrow only; the words are read.
 */
function YouCanDoThis() {
  return (
    <div className="pointer-events-none absolute end-[18px] top-[14px] hidden items-center gap-1.5 lg:flex">
      <svg width="46" height="22" viewBox="0 0 46 22" fill="none" aria-hidden>
        <path d="M45 4C33 -2 12 1 3 13" stroke={v("--ux-pink")} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M2 6.5 3 13.5l6.6-1.6" stroke={v("--ux-pink")} strokeWidth="1.6"
              strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[19px] font-bold leading-none"
            style={{ fontFamily: "var(--font-script), ui-rounded, cursive", color: v("--ux-brand") }}>
        You can do this
      </span>
      <I name="Heart" className="h-[15px] w-[15px]" sw={0}
         style={{ color: v("--ux-pink"), fill: v("--ux-pink") }} />
    </div>
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
      <p className="mt-1.5 text-[15px] leading-snug" style={{ color: v("--ux-muted") }}>
        Learn. Grow. Achieve — at your own pace, in your own time.
      </p>

      {/*
        The four promises on one line the thumb pushes along.

        Wrapped, they were four rows of icon-and-label — 130px of screen spent
        on reassurance before a single destination. `.ux-chiprow` bleeds the
        row to both edges, which is what tells a thumb there is more of it.
      */}
      <div className="ux-chiprow mt-3.5 flex flex-wrap gap-2"
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

      <div className="mt-5 space-y-5">
        <ListGroup title="Where to go">
          {PLACES.map((p) => (
            <ListRow key={p.id} href={p.href} icon={p.icon} tint={p.row}
                     title={p.title} subtitle={p.sub} />
          ))}
        </ListGroup>

        <section>
          <h3 className="ux-group-label">Your learning journey</h3>
          <div className="rounded-[var(--ux-r-lg)] border p-4"
               style={{ background: v("--ux-surface"), borderColor: v("--ux-line") }}>
            <div className="flex items-center gap-3.5">
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
                                   fontWeight: now ? 700 : 500 }}>
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
