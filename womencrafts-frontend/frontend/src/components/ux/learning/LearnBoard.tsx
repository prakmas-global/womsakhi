"use client";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { TransitionLink } from "@/components/ux/TransitionLink";
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
};

const PLACES: Place[] = [
  {
    id: "programs", icon: "BookOpen", title: "Courses", sub: "Started and suggested",
    body: "Explore curated courses designed for real-life skills, from basics to advanced levels. Learn at your own pace with simple lessons, videos and practice activities.",
    cta: "Browse courses", tag: "Learn new skills", href: "/app/programs",
  },
  {
    id: "mentors", icon: "Users", title: "Mentors", sub: "Women who have done it",
    body: "Connect with inspiring women mentors across different fields. Get guidance, ask questions and learn from their real experiences.",
    cta: "Find mentors", tag: "Get guidance", href: "/app/mentors", pink: true,
  },
  {
    id: "certificates", icon: "Award", title: "Certificates", sub: "Proof you can show",
    body: "Earn certificates by completing courses and skill tests. Showcase them on your profile and use them for jobs, freelance work or personal growth.",
    cta: "View certificates", tag: "Show your progress", href: "/app/certificates",
  },
  {
    id: "library", icon: "Handshake", title: "Teach and learn", sub: "Swap what you know",
    body: "Share your knowledge, skills or experiences with other women. You can also learn directly from community members.",
    cta: "Start teaching", tag: "Teach & learn together", href: "/app/library",
  },
  {
    id: "assess", icon: "BadgeCheck", title: "Prove your skills", sub: "A short test, then a certificate",
    body: "Take skill tests to validate what you know. Get certified and build trust for opportunities, work or collaborations.",
    cta: "Take a test", tag: "Build your credibility", href: "/app/assess",
  },
  {
    id: "digital", icon: "Smartphone", title: "Using a phone", sub: "From the very beginning",
    body: "New to smartphones? Learn step-by-step with easy guides on using a phone, apps, internet, safety and more — in simple language.",
    cta: "Start learning", tag: "Digital confidence", href: "/app/digital",
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
      <div className="ux-fitboard flex flex-col xl:min-h-full" style={{ gap: "var(--fb-gap)" }}>
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
const HERO_INK = "#161734";
const HERO_INK_2 = "#413f63";
const HERO_BRAND = "#6c3fd0";

function Hero() {
  return (
    <section className="ux-sq relative isolate overflow-hidden rounded-[18px]"
             style={{ border: "1px solid #ecdff0",
                      background: "linear-gradient(102deg, #fdfbff 0%, #fcf5fb 38%, #faeef8 58%, #f8e9f5 100%)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/ux/art/hero-learn-banner.webp"
        alt=""
        aria-hidden
        decoding="async"
        fetchPriority="high"
        width={1720}
        height={587}
        /* The picture's own left edge is the same pale pink as the band, so the
           mask has only to dissolve the last of it — a harder fade would eat
           the "Small Steps Big Changes" lettering, which sits close to it. */
        className="pointer-events-none absolute inset-y-0 end-0 hidden h-full w-[57%] object-cover object-center lg:block"
        style={{ maskImage: "linear-gradient(to right, transparent 0%, #000 14%)",
                 WebkitMaskImage: "linear-gradient(to right, transparent 0%, #000 14%)" }}
      />

      <div className="relative p-5 sm:p-6 lg:ps-8"
           style={{ paddingBlock: "var(--fb-hero-y, 26px)" }}>
        <p className="text-2xs font-bold uppercase tracking-[0.16em]" style={{ color: HERO_BRAND }}>
          Learn
        </p>
        <h1 className="mt-1.5 max-w-[32rem] text-[clamp(1.7rem,2.9vw,2.3rem)] font-extrabold leading-[1.08] tracking-[-0.035em]"
            style={{ color: HERO_INK, textWrap: "balance" }}>
          Learn. Grow. Achieve.
        </h1>
        <p className="mt-2 max-w-[33rem] text-smd leading-relaxed" style={{ color: HERO_INK_2 }}>
          Explore courses, connect with mentors, earn certificates and share your knowledge.
          Everything you need to build a brighter you — in one place.
        </p>

        {/* Wider than the paragraph above it, as drawn: the row runs on under
            the left edge of the picture, where the art is only soft colour. */}
        {/* Wider than the paragraph above it, as drawn — the row runs on under
            the left edge of the picture, where the art is only soft colour —
            but it stops before she does. Held to 57% and spaced at 12px, all
            four fit on one line at 1440 as well as at the board's own 1586. */}
        <ul className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 lg:max-w-[56%]"
            style={{ fontSize: "var(--fb-chip, 12px)" }}>
          {PROMISES.map(([icon, label]) => (
            <li key={label} className="flex items-center gap-1.5">
              <I name={icon} className="h-[15px] w-[15px] shrink-0" sw={1.9} style={{ color: HERO_BRAND }} />
              <span className="font-medium" style={{ color: HERO_INK_2, fontSize: "inherit" }}>{label}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Below `lg` the picture cannot sit beside the words, so it sits under
          them at its own aspect rather than being cropped to a letterbox — the
          quote card is content, and cover would take it off the edge. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ux/art/hero-learn-banner.webp" alt="" aria-hidden loading="lazy" decoding="async"
           width={1720} height={587} className="block w-full lg:hidden" />
    </section>
  );
}

/* ── one of the six ───────────────────────────────────────────────────────── */

function PlaceCard({ p }: { p: Place }) {
  const tint = p.pink ? "--ux-tint-pink" : "--ux-brand-tint-2";
  const ink = p.pink ? "--ux-pink-ink" : "--ux-brand";

  return (
    <Card pad={0} className="ux-onscroll flex h-full min-h-0 flex-col overflow-hidden"
          /* A container, so the tag below can ask how much room THIS card has
             rather than how wide the window is — the answer differs by 34px
             between the board's own width and a 1440 laptop, and that is the
             whole difference between the pair fitting and not. */
          style={{ containerType: "inline-size" }}>
      <TransitionLink href={p.href}
                      className="ux-sq group flex shrink-0 items-start gap-3 rounded-t-[16px]"
                      style={{ padding: "var(--fb-pad)", paddingBottom: "calc(var(--fb-pad) - 5px)" }}>
        <IconTile icon={p.icon} tint={tint} ink={ink} size={44} radius={13} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <b className="min-w-0 flex-1 truncate text-[17px] font-bold leading-tight"
               style={{ color: v("--ux-ink") }}>{p.title}</b>
            <I name="ChevronRight" className="h-[17px] w-[17px] shrink-0 transition-transform group-hover:translate-x-0.5"
               sw={2} style={{ color: v("--ux-muted") }} />
          </span>
          <span className="mt-0.5 block text-xs" style={{ color: v("--ux-muted") }}>{p.sub}</span>
        </span>
      </TransitionLink>

      <div className="h-px shrink-0"
           style={{ background: v("--ux-line"), marginInline: "var(--fb-pad)" }} />

      {/*
        The clamp is inline, and it has to be.

        As a class in `tokens.css` it lost: something later in the cascade put
        `display: flow-root` back on the paragraph, so `-webkit-box` never
        applied, `-webkit-line-clamp` had nothing to act on, and a six-line
        description simply made the card six lines tall — which is what was
        still pushing the board past the window after the columns were fixed.

        `shrink-0` so the clamp is the only thing that ever shortens this.
        Left flexible, the card's own height squeezed it instead and the text
        stopped mid-sentence with no ellipsis — "from basics to" and then
        nothing, which reads as a bug rather than a summary.
      */}
      <p className="shrink-0 text-smd"
         style={{ color: v("--ux-ink-2"),
                  paddingInline: "var(--fb-pad)",
                  paddingTop: "calc(var(--fb-pad) - 4px)",
                  lineHeight: "var(--fb-lines, 1.5)",
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: "var(--fb-clamp, 4)",
                  overflow: "hidden" }}>
        {p.body}
      </p>

      {/* One line, as drawn. At three columns on a 1440 laptop the column is
          273px and the pair wrapped, which cost a row of height on a board
          that has none to give. The button keeps its full label; the tag
          beside it is the part that gives way. */}
      <div className="mt-auto flex shrink-0 items-center gap-1.5"
           style={{ padding: "var(--fb-pad)", paddingTop: "calc(var(--fb-pad) - 3px)" }}>
        <Btn href={p.href} variant="soft" size="sm" iconEnd="ArrowRight"
             className="shrink-0 whitespace-nowrap">{p.cta}</Btn>
        <span className="ux-tag-optional whitespace-nowrap rounded-full px-2.5 py-1.5 text-2xs font-semibold"
              style={{ background: v("--ux-surface-2"), color: v("--ux-muted") }}>
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
