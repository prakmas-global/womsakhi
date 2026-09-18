"use client";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { TransitionLink } from "@/components/ux/TransitionLink";
import { ListGroup, ListRow, type RowTint } from "@/components/ux/mobile/ListRow";
import { Card, I, IconTile, v } from "@/components/ux/kit";

/**
 * The Work board, built from `Womsakhi-user-ux/wm.png`.
 *
 * Three of the four supplied pieces of art are in it: `workmain1` is the hero,
 * `workmain2` is Sakhi at the end of the help strip, and `workmain4` is the
 * leaf field behind that strip. `workmain3` — the woman climbing steps under
 * "You can do this" — has no place on this board: the wireframe puts that line
 * on the journey card as lettering only, in the same marker script as the rest
 * of the app rather than that asset's calligraphic one. It is converted and
 * waiting if it is wanted somewhere.
 *
 * Every tint here is a token, so the five cards, the five journey steps and
 * the four stat tiles all flip with the theme. Only the hero band is fixed
 * light, because its art is a photograph on a pink wall.
 */

/* ── the five places, and the number under each ───────────────────────────── */

type Place = {
  id: string;
  icon: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  /** The line under the button: an icon and a fact, not a second action. */
  footIcon: string;
  foot: string;
  tint: string;
  ink: string;
  /** Two of the five carry a filled button, as drawn. */
  solid?: boolean;
  /** Which tinted tile this row wears in the phone list. */
  row: RowTint;
  /** Four of the five icons are solid shapes; Find work's magnifier is not. */
  outline?: boolean;
  /**
   * And its little bar chart underneath is not either — a bar chart is drawn
   * entirely from strokes, so filling it closes each bar into a sliver and
   * the glyph falls apart. Solid only works on a glyph with a closed
   * silhouette.
   */
  outlineFoot?: boolean;
};

const PLACES: Place[] = [
  {
    id: "opportunities", row: "pink", icon: "Search", title: "Find work",
    body: "Browse verified jobs, orders and freelance opportunities.",
    cta: "Explore Opportunities", href: "/app/opportunities",
    footIcon: "BarChart3", foot: "1,200+ active opportunities",
    tint: "--ux-tint-pink", ink: "--ux-pink-ink", outline: true, outlineFoot: true,
  },
  {
    id: "verified", row: "violet", icon: "ShieldCheck", title: "Did they pay her?",
    body: "Check reviews and payment history before you take the work.",
    cta: "Check Now", href: "/app/verified",
    footIcon: "Star", foot: "5,000+ verified reviews",
    tint: "--ux-tint-lilac", ink: "--ux-brand", solid: true,
  },
  {
    id: "applications", row: "blue", icon: "FileText", title: "Your applications",
    body: "Track all your job applications, messages and interview status.",
    cta: "View Applications", href: "/app/applications",
    footIcon: "Send", foot: "12 applications this month",
    tint: "--ux-tint-blue", ink: "--ux-blue-ink",
  },
  {
    id: "contracts", row: "amber", icon: "Users", title: "Big orders",
    body: "Explore larger projects that need a team. Collaborate and grow together.",
    cta: "See Big Orders", href: "/app/contracts",
    footIcon: "Users", foot: "80+ group opportunities",
    /* The board's Big orders is a warm orange, and `--ux-amber-ink` (#8f6a00)
       is an olive-brown that reads as neither. This is the orange it draws,
       darkened until it clears AA on the amber wash behind it — the board's
       own value sits at about 3.2:1, which is a colour a woman with low
       vision cannot read. */
    tint: "--ux-tint-amber", ink: "--ux-work-orange",
  },
  {
    id: "trust", row: "green", icon: "FileText", title: "Proof you keep your word",
    body: "Showcase your completed work, client feedback and certificates.",
    cta: "View My Proof", href: "/app/trust",
    footIcon: "Settings", foot: "Build a trusted profile",
    tint: "--ux-tint-green", ink: "--ux-green-ink", solid: true,
  },
];

/** All four in the one violet, as drawn — the board does not colour-code these. */
const PROMISES: [string, string][] = [
  ["ShieldCheck", "Safe & Verified"],
  ["Users", "Women-friendly"],
  ["CalendarCheck", "Flexible Work"],
  ["Star", "Real Opportunities"],
];

const STEPS: { icon: string; title: string; body: string }[] = [
  { icon: "Search", title: "Explore", body: "Browse and find opportunities" },
  { icon: "MessageCircle", title: "Apply", body: "Send your application" },
  { icon: "CalendarDays", title: "Collaborate", body: "Work, communicate and deliver" },
  { icon: "Star", title: "Get Verified", body: "Receive reviews and build trust" },
  { icon: "BarChart3", title: "Grow", body: "Get bigger opportunities" },
];
/** Which step she is on. The one before it is filled; the rest wait. */
const AT = 0;

const STATS: { n: string; label: string; icon: string; tint: string; ink: string }[] = [
  { n: "12", label: "Applications sent", icon: "Send", tint: "--ux-tint-lilac", ink: "--ux-brand" },
  { n: "5", label: "Interviews", icon: "CalendarCheck", tint: "--ux-tint-pink", ink: "--ux-pink-ink" },
  { n: "3", label: "Jobs completed", icon: "CircleCheck", tint: "--ux-tint-green", ink: "--ux-green-ink" },
  { n: "3", label: "Positive reviews", icon: "Star", tint: "--ux-tint-blue", ink: "--ux-blue-ink" },
];

/**
 * A solid icon, drawn out of an outline set.
 *
 * The board's icons are filled shapes with their detail knocked out in the
 * colour behind them — a solid shield with a pale check in it, a solid page
 * with pale lines. Lucide ships outlines only, and simply filling one loses
 * exactly that detail: fill a `ShieldCheck` and the check disappears into it.
 *
 * Filling the paths AND stroking them in the background colour gives both at
 * once. The silhouette fills; every interior stroke is redrawn in the colour
 * of whatever sits behind, which is the knock-out. One icon set, no bespoke
 * SVG, and it tracks the theme because both colours are tokens.
 *
 * `Search` is the exception and stays an outline, because that is how the
 * board draws it — a filled magnifier is a lollipop.
 */
function SolidIcon({ name, size, ink, knockout, solid = true }: {
  name: string; size: number; ink: string; knockout: string; solid?: boolean;
}) {
  /* The knock-out stroke has to get thinner as the icon does. At 23px a 1.8
     stroke reads as detail; at 15px the same stroke eats the glyph and leaves
     a coloured blob — which is what the hero chips became. */
  const sw = solid ? (size <= 16 ? 1.05 : size <= 18 ? 1.35 : 1.8) : 2.3;
  return (
    <I name={name} className="shrink-0" sw={sw}
       style={{ width: size, height: size, color: ink,
                ...(solid ? { fill: ink, stroke: knockout } : {}) }} />
  );
}

/* ── the board ────────────────────────────────────────────────────────────── */

export function WorkBoard() {
  return (
    <HomeShell active="/app/work" loadFailed="your work" fit>
      {/*
        `min-h-full`, not `h-full`.

        `h-full` plus a `flex-1` middle row is a squeeze, and this board has
        more in it than the window has room for on a 1440x900 laptop: the
        journey's five captions and half the insight tiles were being clipped
        away with no scrollbar to reach them. A minimum fills the window when
        the board is shorter than it and lets the board win when it is not,
        with the scroller behind it as the floor. Density still does the work
        of making that rare — see `.ux-fitboard` in `ux/tokens.css`.
      */}
      <Phone />

      <div className="ux-fitboard hidden flex-col lg:flex xl:min-h-full" style={{ gap: "var(--fb-gap)" }}>
        <Hero />

        {/*
          The row that takes up the slack.

          Measured off the board: hero 280, cards 292, journey 230, foot 90.
          The hero, the journey and the foot are what they are; the five cards
          are the row with somewhere to put a taller window and somewhere to
          take one from, so this is the one that flexes. `flex-1` and no
          `min-h-0` on purpose — it may grow past its content, never shrink
          below it, which is the difference between fitting and clipping.
        */}
        <div className="ux-work-places min-w-0 xl:flex-1" style={{ gap: "var(--fb-gap)" }}>
          {PLACES.map((p) => <PlaceCard key={p.id} p={p} />)}
        </div>

        <div className="flex min-w-0 shrink-0 flex-col xl:flex-row xl:items-stretch"
             style={{ gap: "var(--fb-gap)" }}>
          <Journey />
          <Insights />
        </div>

        <HelpStrip />
      </div>
    </HomeShell>
  );
}

/* ── hero ─────────────────────────────────────────────────────────────────── */

/**
 * Fixed light in both themes, as on the Learn board and for the same reason:
 * the art is a photograph on a pink wall, so there is no dark counterpart to
 * swap to. Every colour below is chosen against this gradient rather than
 * against `--ux-canvas`, which in dark mode is behind the band, not under it.
 */
const HERO_INK = v("--ux-band-ink");
const HERO_INK_2 = v("--ux-band-ink-2");
const HERO_BRAND = v("--ux-band-brand");

function Hero() {
  return (
    <section className="ux-sq relative isolate shrink-0 overflow-hidden rounded-[18px]"
             style={{ border: `1px solid ${v("--ux-band-edge")}`,
                      background: v("--ux-band-work") }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ux/art/hero-work-banner.webp" alt="" aria-hidden decoding="async" fetchPriority="high"
           width={1720} height={646}
           className="pointer-events-none absolute inset-y-0 end-0 hidden h-full w-[62%] object-cover lg:block"
           style={{ objectPosition: "69% center",
                    maskImage: "linear-gradient(to right, transparent 0%, #000 15%)",
                    WebkitMaskImage: "linear-gradient(to right, transparent 0%, #000 15%)" }} />

      <div className="relative p-5 sm:p-6 lg:ps-8" style={{ paddingBlock: "var(--fb-hero-y, 26px)" }}>
        <p className="flex items-center gap-2.5">
          {/* A shield with a check, not a briefcase — the board's mark for this
              section is the same "verified" shield it uses on the first chip. */}
          <IconTile icon="ShieldCheck" tint="--ux-brand-tint-2" ink="--ux-brand" size={30} radius={9} />
          <span className="text-2xs font-bold uppercase tracking-[0.16em]" style={{ color: HERO_INK }}>
            Work
          </span>
        </p>

        {/*
          The whole headline is the display serif, not just the italic.

          It was Poppins with one serif word inside it, and that is the single
          most visible thing the board does differently: "Find meaningful work"
          is set in the same high-contrast serif as the italic that follows, at
          a weight the geometric sans cannot reach. Two faces in one sentence
          read as a mistake; one face with an italic reads as a voice.
        */}
        <h1 className="mt-2 max-w-[30rem] leading-[1.04] tracking-[-0.025em]"
            style={{ color: HERO_INK, fontFamily: "var(--font-display), Georgia, serif",
                     fontWeight: 800, fontSize: "clamp(1.75rem, 3.2vw, var(--fb-h1, 2.6rem))" }}>
          Find meaningful work<br />
          on{" "}
          <em style={{ fontStyle: "italic", fontWeight: 700,
                       /* Violet into magenta across the two words, as drawn.
                          `color: transparent` under a clipped background is
                          the only way to gradient live text. */
                       background: v("--ux-band-italic"),
                       WebkitBackgroundClip: "text", backgroundClip: "text",
                       color: "transparent" }}>
            your terms
          </em>
        </h1>

        <p className="mt-2 max-w-[27rem] text-smd" style={{ color: HERO_INK_2, lineHeight: "var(--fb-lines, 1.55)" }}>
          Explore opportunities, build your reputation, and create a financially independent you.
        </p>

        <ul className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-2 lg:max-w-[58%]"
            style={{ fontSize: "var(--fb-chip, 12px)" }}>
          {/* Only the last one wears a pill, exactly as the board has it —
              and there is a reason it does: "Real Opportunities" is the one
              that sits over the photograph, where plain words would be
              competing with a plant. The first three are on flat gradient and
              need nothing. */}
          {PROMISES.map(([icon, label], i) => {
            const onArt = i === PROMISES.length - 1;
            return (
              <li key={label}
                  className={`flex items-center gap-2 rounded-full py-1.5 pe-3.5 ${onArt ? "ps-2.5" : "ps-0"}`}
                  style={onArt
                    ? { background: v("--ux-band-pill"), border: `1px solid ${v("--ux-band-pill-edge")}`,
                        backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }
                    : undefined}>
                {/* Solid on the three that stand on the gradient, outline in
                    the white pill — which is how the board draws them. */}
                <SolidIcon name={icon} size={16} ink={HERO_BRAND} solid={!onArt}
                           knockout={onArt ? "transparent" : v("--ux-band-chip-knock")} />
                <span className="font-semibold" style={{ color: HERO_INK, fontSize: "inherit" }}>{label}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ux/art/hero-work-banner.webp" alt="" aria-hidden loading="lazy" decoding="async"
           width={1720} height={646} className="block w-full lg:hidden" />
    </section>
  );
}

/* ── one of the five ──────────────────────────────────────────────────────── */

function PlaceCard({ p }: { p: Place }) {
  return (
    <Card pad={0} className="ux-onscroll flex min-w-0 flex-col overflow-hidden"
          /* A wash, not a flat fill. Each card on the board is strongest in
             its top-left corner and has given up its colour by the bottom
             right; flat, the five of them read as five swatches rather than
             as one family. */
          style={{ background: `linear-gradient(152deg, color-mix(in srgb, ${v(p.ink)} 17%, ${v("--ux-surface")}) 0%, ${v("--ux-surface")} 88%)`,
                   borderColor: `color-mix(in srgb, ${v(p.ink)} 16%, ${v("--ux-line")})`,
                   containerType: "inline-size",
                   padding: "calc(var(--fb-pad) - 2px)" }}>
      {/* Tinted, not white: on the board the tile is a deeper step of the
          card's own colour, which is what makes it sit IN the card rather
          than on top of it. */}
      <span className="grid shrink-0 place-items-center rounded-[14px]"
            style={{ width: "var(--fb-tile, 46px)", height: "var(--fb-tile, 46px)",
                     background: `color-mix(in srgb, ${v(p.ink)} 22%, ${v("--ux-surface")})` }}>
        <SolidIcon name={p.icon} size={23} ink={v(p.ink)} solid={!p.outline}
                   knockout={`color-mix(in srgb, ${v(p.ink)} 22%, ${v("--ux-surface")})`} />
      </span>

      <h3 className="mt-3.5 font-bold leading-tight"
          style={{ color: v("--ux-ink"), fontSize: "var(--fb-title, 19px)" }}>
        {p.title}
      </h3>

      <p className="mt-2 shrink-0"
         style={{ color: v("--ux-ink-2"), fontSize: "var(--fb-body, 13.5px)",
                  lineHeight: "var(--fb-lines, 1.55)",
                  display: "-webkit-box", WebkitBoxOrient: "vertical",
                  WebkitLineClamp: "var(--fb-clamp, 4)", overflow: "hidden" }}>
        {p.body}
      </p>

      <TransitionLink href={p.href}
        /* The soft buttons take a deeper wash of the card's own colour, not
           white — on a tinted card a white pill reads as a hole in it, and the
           board draws them in the family. */
        className="ux-press ux-hov ux-sq ux-clay mt-4 inline-flex w-fit shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-bold"
        /* `borderRadius` inline, because `.ux-clay` in `ux/tokens.css` sets
           18px and, being a plain class in a sheet that loads after the
           utilities, it beats `rounded-full`. The board's buttons are pills. */
        style={{ borderRadius: 999,
                 ...(p.solid
                   ? { background: `linear-gradient(96deg, color-mix(in srgb, ${v(p.ink)} 88%, #fff), ${v(p.ink)})`,
                       color: "#fff" }
                   : { background: `color-mix(in srgb, ${v(p.ink)} 18%, ${v("--ux-surface")})`, color: v(p.ink) }) }}>
        {p.cta}
        <I name="ArrowRight" className="h-[14px] w-[14px]" sw={2.4} />
      </TransitionLink>

      <p className="mt-auto flex items-center gap-2 pt-3.5 text-xs font-medium"
         style={{ color: v("--ux-muted") }}>
        <SolidIcon name={p.footIcon} size={15} ink={v(p.ink)} solid={!p.outlineFoot}
                   knockout={v("--ux-surface")} />
        <span className="min-w-0 truncate">{p.foot}</span>
      </p>
    </Card>
  );
}

/* ── the five steps of the journey ────────────────────────────────────────── */

function Journey() {
  return (
    <Card pad={0} className="relative min-w-0 flex-1 overflow-hidden"
          /* Shallower than the cards above. On the board this row is 230 tall
             against their 292, and it is the padding that makes the
             difference, not the contents. */
          style={{ padding: "calc(var(--fb-pad) - 4px)" }}>
      <div className="flex items-start gap-3 pe-[150px]">
        <IconTile icon="Route" tint="--ux-brand-tint-2" ink="--ux-brand" size={38} radius={12} />
        <div className="min-w-0">
          <h2 className="text-[20px] font-extrabold leading-tight" style={{ color: v("--ux-ink") }}>
            Your Work Journey
          </h2>
          <p className="mt-0.5 text-xs" style={{ color: v("--ux-muted") }}>
            Small steps today, bigger opportunities tomorrow.
          </p>
        </div>
      </div>

      <YouCanDoThis />

      {/* `sm:gap-0`. The row's own 12px gap was applying between all nine
          children — five steps and four connectors — and taking 96px out of
          the width the captions needed, which is why "Work, communicate and
          deliver" broke onto three lines where the board has two. The
          connectors are the spacing. */}
      <ol className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-0">
        {STEPS.map((s, i) => {
          const on = i === AT;
          return (
            <li key={s.title} className="flex min-w-0 flex-1 items-start gap-2 sm:contents">
              <div className="flex min-w-0 flex-1 flex-col items-center text-center">
                <span className="grid shrink-0 place-items-center rounded-full"
                      style={on
                        ? { width: "var(--fb-circle, 50px)", height: "var(--fb-circle, 50px)",
                            background: v("--ux-brand"), boxShadow: `0 4px 12px -4px color-mix(in srgb, ${v("--ux-brand")} 55%, transparent)` }
                        : { width: "var(--fb-circle, 50px)", height: "var(--fb-circle, 50px)",
                            background: v("--ux-brand-tint-2") }}>
                  <I name={s.icon} className="h-[21px] w-[21px]" sw={1.9}
                     style={{ color: on ? "#fff" : v("--ux-brand") }} />
                </span>
                <b className="mt-2 text-smd font-extrabold" style={{ color: v("--ux-ink") }}>{i + 1}</b>
                {/* One line. "Get Verified" broke across two at 1440 and made
                    that column taller than the four beside it. */}
                <b className="mt-0.5 whitespace-nowrap text-smd font-bold"
                   style={{ color: v("--ux-ink") }}>{s.title}</b>
                {/* `text-xs`, and the connectors kept narrow, so "Work,
                    communicate and deliver" sits on two lines as it is drawn
                    rather than breaking into three. */}
                <p className="mt-1 leading-snug"
                   style={{ color: v("--ux-ink-2"),
                            fontSize: "calc(var(--fb-body, 13.5px) - 1px)" }}>{s.body}</p>
              </div>
              {/*
                The dotted run between two circles, with its arrow at the
                midpoint.

                A FIXED width, not a `wide:` variant — `--breakpoint-wide` is
                declared in `design-system/tokens.css`, which is not the
                `@theme` block Tailwind reads, so `wide:w-[52px]` compiled to
                nothing, the connectors stayed narrow, and the captions broke
                onto a third line where the board has two.
              */}
              {i < STEPS.length - 1 && (
                <span aria-hidden className="hidden w-[38px] shrink-0 items-center gap-1 sm:flex"
                      /* Half a circle down, so the dotted run meets the two it
                         joins on their centres rather than on their tops. */
                      style={{ marginTop: "calc(var(--fb-circle, 50px) / 2)" }}>
                  <span className="h-px flex-1" style={{ borderTop: `2px dotted ${v("--ux-line-strong")}` }} />
                  <I name="ArrowRight" className="h-[13px] w-[13px] shrink-0" sw={2.2}
                     style={{ color: v("--ux-line-strong") }} />
                  <span className="h-px flex-1" style={{ borderTop: `2px dotted ${v("--ux-line-strong")}` }} />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/** The lettering on the journey card, live text so it can be translated. */
function YouCanDoThis() {
  return (
    <div className="pointer-events-none absolute end-[16px] top-[14px] hidden items-center gap-1.5 lg:flex">
      <span className="text-[20px] font-bold leading-none"
            style={{ fontFamily: "var(--font-script), ui-rounded, cursive", color: v("--ux-brand") }}>
        You can do this
      </span>
      <I name="Heart" className="h-[16px] w-[16px]" sw={0}
         style={{ color: v("--ux-pink"), fill: v("--ux-pink") }} />
    </div>
  );
}

/* ── what the month adds up to ────────────────────────────────────────────── */

function Insights() {
  return (
    <Card pad={0} className="flex w-full shrink-0 flex-col xl:w-[408px]"
          style={{ padding: "calc(var(--fb-pad) - 4px)" }}>
      <div className="flex items-center gap-2.5">
        <IconTile icon="BarChart3" tint="--ux-brand-tint-2" ink="--ux-brand" size={34} radius={11} />
        <h2 className="min-w-0 flex-1 text-[17px] font-bold" style={{ color: v("--ux-ink") }}>
          Work Insights
        </h2>
        {/* Drawn as a control and behaves as one — the range it reads is the
            only thing on this card she can change. */}
        <label className="ux-sq flex shrink-0 items-center gap-1 rounded-[10px] px-2.5 py-1.5 text-2xs font-semibold"
               style={{ background: v("--ux-surface-2"), color: v("--ux-ink-2"),
                        border: `1px solid ${v("--ux-line")}` }}>
          <span className="sr-only">Show insights for</span>
          <select defaultValue="month" className="cursor-pointer appearance-none bg-transparent pe-1 outline-none">
            <option value="month">This month</option>
            <option value="quarter">Last 3 months</option>
            <option value="year">This year</option>
          </select>
          <I name="ChevronDown" className="h-[13px] w-[13px]" sw={2.2} />
        </label>
      </div>

      <div className="mt-2.5 flex items-center gap-3">
        <Ring pct={68} />
        <div className="min-w-0">
          <p className="text-smd font-bold leading-tight" style={{ color: v("--ux-ink") }}>
            You&rsquo;re building something great!
          </p>
          <p className="mt-1 text-xs leading-snug" style={{ color: v("--ux-ink-2") }}>
            Applied to 12 jobs, completed 3 and received 3 positive reviews.
          </p>
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-2" style={{ gap: "calc(var(--fb-gap) - 2px)" }}>
        {STATS.map((s) => (
          <div key={s.label} className="flex items-center gap-2.5 rounded-[13px] px-2 py-1"
               style={{ border: `1px solid ${v("--ux-line")}` }}>
            <span className="grid shrink-0 place-items-center rounded-[10px]"
                  style={{ width: "var(--fb-stat, 28px)", height: "var(--fb-stat, 28px)",
                           background: v(s.tint) }}>
              <SolidIcon name={s.icon} size={15} ink={v(s.ink)} knockout={v(s.tint)} />
            </span>
            <span className="min-w-0">
              <b className="block text-smd font-extrabold leading-none" style={{ color: v("--ux-ink") }}>{s.n}</b>
              <span className="mt-1 block truncate text-2xs" style={{ color: v("--ux-muted") }}>{s.label}</span>
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** 68%, drawn from teal into brand the way the board has it. */
function Ring({ pct }: { pct: number }) {
  const r = 27;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0"
         style={{ width: "var(--fb-ring, 68px)", height: "var(--fb-ring, 68px)" }}>
      <svg viewBox="0 0 70 70" className="h-full w-full -rotate-90" aria-hidden>
        <defs>
          <linearGradient id="ux-work-ring" x1="0" y1="0" x2="1" y2="1">
            {/*
              Teal where the arc STARTS, blue where it ends.

              The svg is rotated -90° so the arc begins at twelve o'clock, and
              the gradient rotates with it — which put the blue at the top and
              the teal at the bottom, exactly backwards from the board. The
              stops are reversed to compensate.

              And it stops at blue. It used to run on into the brand violet,
              which the board's ring does not do: the whole arc is cool, and
              the violet made the last third read as a third colour rather
              than the end of the second.
            */}
            <stop offset="0%" stopColor={v("--ux-ring-c")} />
            <stop offset="54%" stopColor={v("--ux-ring-b")} />
            <stop offset="100%" stopColor={v("--ux-ring-a")} />
          </linearGradient>
        </defs>
        <circle cx="35" cy="35" r={r} fill="none" strokeWidth="8.5" stroke={v("--ux-brand-tint-2")} />
        <circle cx="35" cy="35" r={r} fill="none" strokeWidth="8.5" strokeLinecap="round"
                stroke="url(#ux-work-ring)" strokeDasharray={`${(c * pct) / 100} ${c}`} />
      </svg>
      {/* Sized off the ring, not fixed. At a fixed 15px the figure was wider
          than the hole and sat across the arc on both sides — measured at
          1440, where the ring steps down a size and the text did not. */}
      <span className="absolute inset-0 grid place-items-center font-extrabold leading-none"
            style={{ color: v("--ux-ink"),
                     fontSize: "calc(var(--fb-ring, 72px) * 0.2)",
                     letterSpacing: "-0.02em" }}>
        {pct}%
      </span>
    </div>
  );
}

/* ── the strip at the foot ────────────────────────────────────────────────── */

function HelpStrip() {
  return (
    /* No `overflow-hidden` on the section itself. Sakhi stands a little taller
       than this strip, as she is drawn, and clipping her took her head off. The
       leaf field still has to be clipped to the rounded corners, so it gets a
       clipping layer of its own underneath. */
    <section className="ux-sq relative isolate shrink-0 rounded-[18px]"
             style={{ border: `1px solid ${v("--ux-band-foot-edge")}`,
                      /* Pink through the middle and back to lilac at the end.
                         It ran pink all the way, and Sakhi's art has a pale
                         lilac ground of its own — so however softly her edges
                         were masked, a rectangle of the wrong pink showed
                         around her. The board's strip turns lilac exactly
                         where she stands, which is why it does not. */
                      background: v("--ux-band-foot") }}>
      <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[18px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ux/art/leaves-pink.webp" alt="" aria-hidden loading="lazy" decoding="async"
             width={900} height={629}
             /* A cluster, not a field. Spread across 46% of the strip at 80%
                opacity it was a pink haze; the board puts a readable plant just
                to the left of "Need help getting started?" and leaves the rest
                of the strip clean. The source is cropped to that cluster. */
             /* The gap the board leaves between the quote and "Need help
                getting started?", and nothing beyond it. At 21% wide and
                further right it ran under the heading and the heading lost
                its ground. */
             className="absolute inset-y-0 start-[26%] hidden h-full w-[11%] object-cover opacity-50 lg:block"
             style={{ maskImage: "linear-gradient(to right, transparent, #000 22%, #000 78%, transparent)",
                      WebkitMaskImage: "linear-gradient(to right, transparent, #000 22%, #000 78%, transparent)" }} />
      </span>

      <div className="relative flex flex-wrap items-center gap-x-5 gap-y-3 px-5 lg:pe-[272px]"
           style={{ minHeight: "var(--fb-foot, 78px)",
                    paddingBlock: "calc(var(--fb-pad) - 4px)" }}>
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {/* Outline at a heavy weight. A bulb is mostly its glass and its
              rays; filled it collapses into an amber blob and stops reading as
              a lamp at all — the one glyph on this board where solid is the
              wrong answer. */}
          <SolidIcon name="Lightbulb" size={26} ink={v("--ux-band-lamp")} knockout="transparent" solid={false} />
          <div className="min-w-0">
            {/* The board reads "towds". Shipping a typo because a wireframe
                had one is not fidelity, so it says "towards". */}
            {/* One line, as drawn. At 15px it broke after "stronger," and the
                strip stopped being a strip. */}
            <p className="italic leading-snug"
               style={{ color: HERO_INK, fontSize: "var(--fb-body, 13.5px)" }}>
              &ldquo;Every opportunity is a step towards a stronger, brighter you.&rdquo;
            </p>
            <p className="mt-1 text-2xs font-semibold" style={{ color: HERO_INK_2 }}>— WomSakhi</p>
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-smd font-bold" style={{ color: HERO_INK }}>Need help getting started?</p>
          <p className="mt-0.5 text-xs" style={{ color: HERO_INK_2 }}>
            We&rsquo;re here to guide you at every step.
          </p>
        </div>

        <TransitionLink href="/app/sakhi"
          className="ux-press ux-hov ux-sq ux-clay inline-flex shrink-0 items-center gap-2.5 rounded-full px-5 py-3 text-smd font-bold"
          style={{ borderRadius: 999,
                   background: "linear-gradient(96deg, var(--ux-fill), var(--ux-fill-2))", color: "#fff" }}>
          <I name="MessageCircle" className="h-[17px] w-[17px]" sw={2} />
          Chat with Sakhi
          <I name="ArrowRight" className="h-[15px] w-[15px]" sw={2.4} />
        </TransitionLink>
      </div>

      {/*
        Sakhi, and her invitation.

        Cropped to her and her speech bubble, and `contain` so both survive —
        `cover` on a strip this shallow kept the woman and threw the invitation
        off the right-hand edge.

        `end-[58px]` rather than the corner: the assistant launcher is fixed in
        that corner on every screen, and two Sakhis overlapping each other is
        worse than one an inch off where the board draws her.

        Hidden below `lg`, where the strip stacks and she would sit on the
        button rather than beside it.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ux/art/sakhi-ask-me.webp" alt="" aria-hidden loading="lazy" decoding="async"
           width={860} height={408}
           className="pointer-events-none absolute bottom-0 end-[84px] hidden h-[112%] w-[186px] object-contain object-bottom lg:block"
           /* Two masks, intersected: one dissolves her left edge into the
              strip, the other dissolves the part of her that rises above it.
              Without the second, the art's own pale background drew a hard
              rectangle across the bottom of the card overhead — most visible
              in dark mode, where the card behind her is nearly black. */
           /* Every edge dissolved, not just two. The art's own pale background
              is a slightly different pink from the strip's, so any hard edge
              draws a visible rectangle across it — the right-hand one was the
              worst, cutting straight down past her raised hand. */
           style={{ maskImage: "linear-gradient(to right, transparent 0%, #000 8%, #000 90%, transparent 100%), linear-gradient(to bottom, transparent 0%, #000 14%)",
                    WebkitMaskImage: "linear-gradient(to right, transparent 0%, #000 8%, #000 90%, transparent 100%), linear-gradient(to bottom, transparent 0%, #000 14%)",
                    maskComposite: "intersect", WebkitMaskComposite: "source-in" }} />
    </section>
  );
}

/* ── the same board, as a phone app ───────────────────────────────────────── */

/**
 * Work on a phone.
 *
 * The desktop board is a full-bleed hero, five washed cards each with a tile,
 * a heading, a paragraph, a pill button and a footnote, then a five-column
 * journey, a two-column insight panel and a help strip with Sakhi standing in
 * it. At 390 the hero alone was 950px tall — a whole screen and a half before
 * the first destination — and "Find work", the thing this section exists for,
 * began below the fold with its button already sliding under the help pill.
 *
 * A phone gets the same five places as a grouped list, her five journey steps
 * as a list, the month's four numbers as rows with the figure on the right
 * where a native app puts a value, and one full-width action at the end. The
 * hero survives as a banner, because the picture is good and a phone screen
 * can afford 132px of it — not 950.
 *
 * `hidden lg:flex` on the board above and `lg:hidden` here: both trees are in
 * the DOM, one is `display: none`, and `display: none` takes a subtree out of
 * the accessibility tree too, so nothing is announced twice.
 */
function Phone() {
  return (
    <div className="lg:hidden">
      <section className="ux-sq relative overflow-hidden rounded-[16px]"
               style={{ border: `1px solid ${v("--ux-band-edge")}`, background: v("--ux-band-work") }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ux/art/hero-work-banner.webp"
             alt="A woman at her laptop in a bright room, beside the words “Independent women build brighter tomorrows”."
             decoding="async" fetchPriority="high" width={1720} height={646}
             className="block h-[132px] w-full object-cover" style={{ objectPosition: "center 40%" }} />
      </section>

      <h1 className="ux-screen-title mt-4" style={{ color: v("--ux-ink") }}>Work</h1>
      <p className="mt-2 text-[15px] leading-snug" style={{ color: v("--ux-muted") }}>
        Find meaningful work on your terms — and build a reputation that travels with you.
      </p>

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
                     title={p.title} subtitle={p.body} />
          ))}
        </ListGroup>

        <section>
          <h3 className="ux-group-label">Your work journey</h3>
          <div className="rounded-[var(--ux-r-lg)] border p-4"
               style={{ background: v("--ux-surface"), borderColor: v("--ux-line") }}>
            <p className="text-[15px] font-bold leading-tight" style={{ color: v("--ux-ink") }}>
              Small steps today, bigger opportunities tomorrow.
            </p>
            <ol className="mt-4 flex flex-col gap-3">
              {STEPS.map((s, i) => {
                const on = i === AT;
                return (
                  <li key={s.title} className="flex items-start gap-3">
                    <span aria-hidden className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full"
                          style={on ? { background: v("--ux-brand") } : { background: v("--ux-brand-tint-2") }}>
                      <I name={s.icon} className="h-[17px] w-[17px]" sw={1.9}
                         style={{ color: on ? v("--ux-on-brand") : v("--ux-brand") }} />
                    </span>
                    <span className="min-w-0">
                      <b className="block text-[15px] font-bold leading-tight" style={{ color: v("--ux-ink") }}>
                        {i + 1}. {s.title}
                      </b>
                      <span className="mt-0.5 block text-[13px] leading-snug" style={{ color: v("--ux-ink-2") }}>
                        {s.body}
                      </span>
                    </span>
                    <span className="sr-only">{on ? " — you are here" : ""}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/*
          The month's four figures, as rows rather than a 2x2 of tiles.

          Two 160px tiles on a 390px screen is two columns of nothing — the
          labels truncated to "Applications s…" in the before shot. A native
          app puts the label on the left and the value on the right, which
          fits every label at full length and reads at a glance.
        */}
        <ListGroup title="This month"
                   footnote="Applied to 12 jobs, completed 3 and received 3 positive reviews.">
          {STATS.map((s) => (
            <ListRow key={s.label} icon={s.icon}
                     tint={s.ink === "--ux-brand" ? "violet"
                          : s.ink === "--ux-pink-ink" ? "pink"
                          : s.ink === "--ux-green-ink" ? "green" : "blue"}
                     title={s.label} value={s.n} chevron={false} />
          ))}
        </ListGroup>

        {/*
          The help strip, reduced to what it was actually for.

          On desktop it is a quote, a lamp, a leaf field and Sakhi standing at
          the end of it beside a button. All of that is decoration around one
          action, and on a phone the action is the only part that fits — full
          width, at the bottom, where a thumb already is.
        */}
        <section>
          <h3 className="ux-group-label">Need help getting started?</h3>
          <div className="rounded-[var(--ux-r-lg)] border p-4"
               style={{ background: v("--ux-band-foot"), borderColor: v("--ux-band-foot-edge") }}>
            <p className="text-[15px] italic leading-snug" style={{ color: HERO_INK }}>
              &ldquo;Every opportunity is a step towards a stronger, brighter you.&rdquo;
            </p>
            <p className="mt-1 text-[13px] font-semibold" style={{ color: HERO_INK_2 }}>— WomSakhi</p>
            <TransitionLink href="/app/sakhi"
              className="ux-press ux-sq ux-action-primary mt-4 inline-flex items-center justify-center gap-2.5"
              style={{ borderRadius: 14,
                       background: "linear-gradient(96deg, var(--ux-fill), var(--ux-fill-2))", color: v("--ux-on-brand") }}>
              <I name="MessageCircle" className="h-[17px] w-[17px]" sw={2} />
              Chat with Sakhi
            </TransitionLink>
          </div>
        </section>
      </div>
    </div>
  );
}
