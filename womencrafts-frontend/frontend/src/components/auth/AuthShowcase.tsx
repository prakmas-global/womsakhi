"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, BadgeIndianRupee, Briefcase, GraduationCap,
  Pause, PiggyBank, Play, PiggyBank as Pot, ShieldCheck, UserCheck, Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { fetchPublicStats, type PublicStats } from "@/lib/public-api";

/**
 * Brand glyphs, drawn here rather than imported.
 *
 * This version of lucide no longer ships Instagram, LinkedIn or Facebook —
 * third-party marks were removed from the set — so importing them fails the
 * build. These are the marks at their published outlines.
 */
type Glyph = { className?: string };
const InstagramGlyph = ({ className }: Glyph) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}
       strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <rect x="2" y="2" width="20" height="20" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);
const LinkedinGlyph = ({ className }: Glyph) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}
       strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-11h4v1.5A6 6 0 0 1 16 8z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);
const FacebookGlyph = ({ className }: Glyph) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}
       strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

/**
 * The panel beside the form: what WomSakhi is, and who it is for.
 *
 * Built to the approved comp — hero portrait bleeding out of the top right, the
 * reveal as a wide card, three offers, a trust bar and a strip of figures.
 *
 * ── Two things here are placeholders, on purpose and on the record ──────────
 * `HEADLINE_FIGURES` and the rating in `TRUST` are marketing copy, not data.
 * Every stats endpoint in this app is staff-authenticated and the seeded
 * database holds single digits, so nothing here can be read from the server
 * yet. They are gathered into two named constants at the top of this file so
 * they can be set to true numbers in one edit the day there are true numbers —
 * and so nobody later mistakes them for something that was measured.
 */

/**
 * The four headline tiles, and the trust line.
 *
 * These used to be typed in by hand — "10K+ Jobs Posted", "50K+ Members",
 * "4.9/5 from 2.3K+ members" — on the page a woman reads while deciding whether
 * to hand over a photograph of her Aadhaar card. Every one was invented,
 * because every stats endpoint in this app is staff-authenticated and there was
 * nothing public for the page to read.
 *
 * `GET /public/stats` now returns real counts. Until they arrive — and if any
 * is zero, or the request fails — the tiles fall back to PROMISES instead,
 * which are true at any size and do not need the platform to look bigger than
 * it is. The invented star rating is gone; there is no rating to show yet.
 */
type Figure = { icon: LucideIcon; value: string; label: string };

const PROMISES: readonly Figure[] = [
  { icon: BadgeIndianRupee, value: "Free", label: "To join, always" },
  { icon: Users, value: "Women only", label: "Every member verified" },
  { icon: UserCheck, value: "By hand", label: "Two people read each account" },
  { icon: ShieldCheck, value: "Private", label: "Your ID is never shown" },
];

const TRUST = {
  title: "Built with women, for women",
  body: "A safe space to learn, earn and grow together.",
} as const;

/** 20 → "20", 1,500 → "1.5K", 12,000 → "12K+". Never rounds a count up. */
function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(Math.floor(n / 100) / 10).toFixed(1)}K`;
  return `${Math.floor(n / 1000)}K+`;
}

/** Real counts where we have them, promises where we do not. */
function figuresFrom(stats: PublicStats | null): readonly Figure[] {
  if (!stats) return PROMISES;
  const live: Figure[] = [];
  const add = (icon: LucideIcon, n: number | undefined, label: string) => {
    if (typeof n === "number" && n > 0) live.push({ icon, value: compact(n), label });
  };
  add(Briefcase, stats.jobs, "Jobs posted");
  add(GraduationCap, stats.courses, "Courses");
  add(Users, stats.members, "Members");
  add(Pot, stats.circles, "Savings circles");
  // All four or none: three real numbers beside one promise reads as a gap
  // where a figure should be, which is worse than four promises.
  return live.length === 4 ? live : PROMISES;
}

const OFFERS = [
  {
    icon: BadgeIndianRupee,
    title: "Work you can take today",
    body: "Openings near you, and a shop of your own if you make things.",
    cta: "Explore Jobs",
  },
  {
    icon: GraduationCap,
    title: "Learn a skill that pays",
    body: "Short courses that end in a certificate you can show.",
    cta: "Browse Courses",
  },
  {
    icon: PiggyBank,
    title: "Save with women you trust",
    body: "Run a savings circle here — every rupee goes into the pot.",
    cta: "Learn More",
  },
] as const;

/**
 * Where WomSakhi actually is.
 *
 * Read from the environment, so the rail shows exactly the accounts that exist
 * and nothing else. All three unset — the case today — and the rail does not
 * render at all: three grey icons that go nowhere on a sign-in page read as a
 * site that is half-built.
 *
 * Set in `.env.local`:
 *   NEXT_PUBLIC_SOCIAL_INSTAGRAM=https://instagram.com/…
 *   NEXT_PUBLIC_SOCIAL_LINKEDIN=https://linkedin.com/company/…
 *   NEXT_PUBLIC_SOCIAL_FACEBOOK=https://facebook.com/…
 */
const SOCIALS = [
  { icon: InstagramGlyph, label: "Instagram", href: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM ?? "" },
  { icon: LinkedinGlyph, label: "LinkedIn", href: process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN ?? "" },
  { icon: FacebookGlyph, label: "Facebook", href: process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK ?? "" },
].filter((s) => s.href);

const FACES = [
  "/ux/art/avatar-woman-purple-kurta.webp",
  "/ux/art/avatar-woman-hijab.webp",
  "/ux/art/avatar-woman-blue-saree.webp",
  "/ux/art/avatar-woman-blazer.webp",
];

/**
 * The portrait that bleeds out of the top right of the panel.
 *
 * Drawn with her on the right of a wide frame and empty space on the left, so
 * the headline sits in the dark half. Until this file exists the panel renders
 * without it and nothing looks broken.
 */
const HERO_SRC = "/ux/brand/auth-hero.png";

/** Per-browser, so the reveal is once per person rather than once per page load. */
const SEEN = "womsakhi.reveal.seen";

/** mm:ss — read off the file, so it stays true when the film is replaced. */
function clock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * The reveal.
 *
 * It introduces itself once on a first visit — the behaviour `checks/login.mjs`
 * guards — and waits on a control after that. Deliberately still true under
 * `prefers-reduced-motion`: an earlier version swapped the tile for a still
 * image, leaving anyone with that setting staring at a frozen frame with
 * nothing to press and no way to know it had ever been a video.
 *
 * The duration on the chip is read from the file rather than typed in, so
 * swapping in a longer promo film updates the label by itself.
 */
export function RevealCard({ compact = false }: { compact?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [length, setLength] = useState("");

  const toggle = useCallback(() => {
    const el = video.current;
    if (!el) return;
    if (el.paused) {
      if (el.ended || el.currentTime >= el.duration - 0.05) el.currentTime = 0;
      void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      el.pause();
      setPlaying(false);
    }
  }, []);

  useEffect(() => {
    const el = video.current;
    // Both the phone strip and the laptop panel mount; only one is on screen.
    // Without this the hidden copy would spend the one showing on nobody.
    if (!el || el.getBoundingClientRect().height === 0) return;

    // The length, read off the file rather than typed in — so replacing the
    // film updates the label by itself.
    //
    // Read HERE as well as from `onLoadedMetadata`, because with a cached file
    // the metadata is often ready before React attaches that handler, the event
    // never fires, and the chip silently loses its duration. Measured: the
    // video reported 6.04s while the label showed nothing at all.
    const readLength = () => {
      if (el.readyState >= 1 && Number.isFinite(el.duration)) setLength(clock(el.duration));
    };
    readLength();
    el.addEventListener("loadedmetadata", readLength);

    let firstVisit = true;
    try { firstVisit = !window.localStorage.getItem(SEEN); } catch { /* introduce her anyway */ }
    if (!firstVisit) {
      // Still tear down the metadata listener; only the autoplay is skipped.
      return () => el.removeEventListener("loadedmetadata", readLength);
    }
    try { window.localStorage.setItem(SEEN, "1"); } catch { /* it will introduce itself again */ }

    let cancelled = false;
    // Decided here rather than with the `autoPlay` attribute: that is evaluated
    // once, often before the file is ready, and a browser that quietly declines
    // leaves the poster up — which looks exactly like a video that is broken.
    const attempt = () => {
      if (cancelled || !el.paused) return;
      void el.play().then(() => { if (!cancelled) setPlaying(true); }).catch(() => {});
    };
    attempt();
    el.addEventListener("loadeddata", attempt);
    el.addEventListener("canplay", attempt);
    return () => {
      cancelled = true;
      el.removeEventListener("loadedmetadata", readLength);
      el.removeEventListener("loadeddata", attempt);
      el.removeEventListener("canplay", attempt);
    };
  }, []);

  const thumb = compact
    ? "clamp(4.875rem,12vh,6.5rem)"
    : "clamp(8.25rem,19vh,11rem)";

  return (
    <div
      className="auth-card relative overflow-hidden rounded-[20px]"
      style={{ padding: "clamp(0.5rem,1.2vh,0.75rem)" }}
    >
      <div className="flex items-center" style={{ gap: "clamp(0.75rem,2.4vw,1.375rem)" }}>
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause the WomSakhi film" : "Play the WomSakhi film"}
          className="group relative shrink-0 overflow-hidden rounded-[12px]"
          style={{
            width: `calc(${thumb} * 1.42)`,
            height: thumb,
            background: "var(--a-stage)",
            border: "1px solid var(--a-edge)",
          }}
        >
          <video
            ref={video}
            src="/womsakhi-reveal.mp4"
            poster="/womsakhi-reveal.jpg"
            muted
            playsInline
            preload="metadata"
            onLoadedMetadata={(e) => setLength(clock(e.currentTarget.duration))}
            onEnded={() => setPlaying(false)}
            className="h-full w-full object-cover"
          />
          <span
            className={`absolute inset-0 grid place-items-center transition-opacity duration-300 ${
              playing ? "opacity-0 group-hover:opacity-100" : "opacity-100"
            }`}
            style={{ background: "var(--a-scrim)" }}
          >
            <span
              className="grid place-items-center rounded-full text-white shadow-xl transition-transform duration-200 group-hover:scale-110"
              style={{
                width: "clamp(2.375rem,6vh,3.5rem)", height: "clamp(2.375rem,6vh,3.5rem)",
                background: "var(--a-fill)",
              }}
            >
              {playing
                ? <Pause className="h-5 w-5" fill="currentColor" />
                : <Play className="h-5 w-5 translate-x-[2px]" fill="currentColor" />}
            </span>
          </span>
        </button>

        <div className="min-w-0 flex-1 pe-1">
          <p
            className="font-bold leading-snug"
            style={{ color: "var(--a-ink)", fontSize: compact ? "clamp(0.8125rem,1.9vh,0.9375rem)" : "clamp(0.9375rem,2.2vh,1.1875rem)" }}
          >
            Watch how <span className="auth-shine">WomSakhi</span> empowers women
          </p>
          <button
            type="button"
            onClick={toggle}
            className="inline-flex min-h-[38px] items-center gap-2 rounded-full px-3.5 text-[0.75rem] font-semibold"
            style={{
              marginTop: "clamp(0.4375rem,1.2vh,0.75rem)",
              background: "var(--a-well-2)", border: "1px solid var(--a-edge)", color: "var(--a-ink-2)",
            }}
          >
            {playing
              ? <Pause className="h-3.5 w-3.5" fill="currentColor" aria-hidden />
              : <Play className="h-3.5 w-3.5" fill="currentColor" aria-hidden />}
            {playing ? "Pause video" : "Play video"}
            {length && <span style={{ color: "var(--a-faint)" }}>{length}</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The showcase, for a phone.
 *
 * A strip, not a page. The full panel is `lg:` only, and the screen still has
 * to fit without scrolling, so this is the smallest thing that carries the
 * film: the video, one line, and the control.
 */
export function AuthShowcaseCompact() {
  return (
    <div className="auth-panel rounded-[20px]" style={{ padding: "clamp(0.5rem,1.2vh,0.75rem)" }}>
      <RevealCard compact />
    </div>
  );
}

export default function AuthShowcase() {
  // "waiting" until the file answers, so a missing asset never flashes a dark
  // rectangle across the panel before it is taken down again.
  const [hero, setHero] = useState<"waiting" | "ready" | "gone">("waiting");

  // Real counts, or the promises. Never blocks the page: the promises render
  // immediately and the numbers replace them if and when they arrive.
  const [stats, setStats] = useState<PublicStats | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchPublicStats()
      .then((s) => { if (!cancelled) setStats(s); })
      .catch(() => {});   // the promises are a perfectly good answer
    return () => { cancelled = true; };
  }, []);
  const figures = figuresFrom(stats);

  return (
    <div
      className="auth-panel relative overflow-hidden rounded-[24px]"
      style={{ padding: "clamp(1rem,2.5vh,2rem) clamp(1.25rem,2.2vw,2.375rem)" }}
    >
      {/* ── The hero, bleeding out of the top right ──────────────────────────
          Drawn with her on the right of a wide frame and empty space on the
          left, so the headline sits in the dark half and she rises out of the
          corner. It is decorative: `alt` stays empty, and if the file is not
          there yet the panel simply renders without it. */}
      {hero !== "gone" && (
        <div
          className="pointer-events-none absolute end-0 top-0 h-full w-[46%] transition-opacity duration-500"
          style={{ opacity: hero === "ready" ? 1 : 0 }}
          aria-hidden
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={HERO_SRC}
            alt=""
            className="h-full w-full object-cover object-[70%_28%]"
            // A 1x1 placeholder ships at this path so the slot never 404s.
            // Anything that small IS the placeholder, not a portrait — treat it
            // as absent, or the feathering gradients paint a dark block over
            // nothing. Drop a real image in and it appears by itself.
            onLoad={(e) => setHero(e.currentTarget.naturalWidth > 8 ? "ready" : "gone")}
            onError={() => setHero("gone")}
          />
          {/* Feathered into the panel on the left and along the bottom, so she
              emerges from the ground rather than sitting in a rectangle.

              These live INSIDE the conditional deliberately. Hiding only the
              <img> on error left the two gradients painting a dark block with
              a hard vertical edge down the middle of the panel — the artwork
              missing looked far worse than the artwork never having been there. */}
          <span className="absolute inset-0"
                style={{ background: "linear-gradient(to right, var(--a-night) 2%, transparent 62%)" }} />
          <span className="absolute inset-0"
                style={{ background: "linear-gradient(to top, var(--a-night) 4%, transparent 46%)" }} />
        </div>
      )}
      <div className="pointer-events-none absolute -end-24 -top-24 h-[380px] w-[380px] rounded-full"
           style={{ background: "var(--a-corner-light)" }} aria-hidden />

      <div className="relative flex gap-4">
        {/* ── The rail ── only when there is somewhere to send her. */}
        {SOCIALS.length > 0 && (
          <div className="flex w-6 shrink-0 flex-col items-center gap-3.5 pt-1">
            {SOCIALS.map(({ icon: Icon, label, href }) => (
              <a
                key={label} href={href} target="_blank" rel="noreferrer"
                aria-label={`WomSakhi on ${label}`}
                className="auth-link grid h-6 w-6 place-items-center"
              >
                <Icon className="h-[15px] w-[15px]" />
              </a>
            ))}
            <span className="mt-1 w-px flex-1" style={{ background: "var(--a-edge)" }} aria-hidden />
          </div>
        )}

        <div className="min-w-0 flex-1">
          {/* ── Brand ── */}
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ux/brand/womsakhi-mark.webp" alt="" aria-hidden
                 className="object-contain"
                 style={{ width: "clamp(2.25rem,5.2vh,2.875rem)", height: "clamp(2.25rem,5.2vh,2.875rem)" }} />
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ux/brand/womsakhi-wordmark.webp" alt="WomSakhi"
                   className="object-contain" style={{ height: "clamp(1.3125rem,3.1vh,1.6875rem)" }} />
              <p className="mt-1 text-[0.6875rem] font-semibold tracking-[0.19em]" style={{ color: "var(--a-muted)" }}>
                EMPOWERING HER JOURNEY
              </p>
            </div>
          </div>

          {/* ── The promise ── */}
          <div className="flex gap-4" style={{ marginTop: "clamp(0.875rem,3vh,1.875rem)" }}>
            <span className="w-[3px] shrink-0 rounded-full"
                  style={{ background: "linear-gradient(var(--a-rose), transparent)" }} aria-hidden />
            <div>
              <h1 className="font-bold leading-[1.16] tracking-tight"
                  style={{ color: "var(--a-ink)", fontSize: "clamp(1.4rem, 3.3vh, 2.15rem)" }}>
                Empowering<br />women to work,<br />
                <span className="auth-shine">earn and grow</span><br />on their own terms.
              </h1>
              <p className="max-w-[38ch] leading-relaxed"
                 style={{ color: "var(--a-ink-2)", fontSize: "clamp(0.71875rem,1.55vh,0.8125rem)", marginTop: "clamp(0.5rem,1.4vh,1rem)" }}>
                WomSakhi is women only. Joining is free, and it always will be —
                nobody here may ever charge you to find work.
              </p>
            </div>
          </div>

          {/* ── The film ── */}
          <div style={{ marginTop: "clamp(0.625rem,1.9vh,1.375rem)" }}>
            <RevealCard />
          </div>

          {/* ── What you get ── */}
          <div className="grid grid-cols-3"
               style={{ marginTop: "clamp(0.4375rem,1.2vh,0.8125rem)", gap: "clamp(0.5rem,0.9vw,0.75rem)" }}>
            {OFFERS.map(({ icon: Icon, title, body, cta }) => (
              <div key={title} className="auth-card flex flex-col rounded-[16px]"
                   style={{ padding: "clamp(0.5625rem,1.25vh,0.875rem)" }}>
                <span className="grid place-items-center rounded-[12px]"
                      style={{
                        background: "var(--a-tint-rose)", color: "var(--a-rose)",
                        width: "clamp(1.75rem,4.2vh,2.125rem)", height: "clamp(1.75rem,4.2vh,2.125rem)",
                      }}>
                  <Icon className="h-[16px] w-[16px]" strokeWidth={2} aria-hidden />
                </span>
                <p className="font-semibold leading-snug"
                   style={{ color: "var(--a-ink)", fontSize: "clamp(0.71875rem,1.6vh,0.8125rem)", marginTop: "clamp(0.375rem,1vh,0.6875rem)" }}>
                  {title}
                </p>
                <p className="flex-1 leading-relaxed"
                   style={{ color: "var(--a-muted)", fontSize: "clamp(0.625rem,1.35vh,0.71875rem)", marginTop: "clamp(0.1875rem,0.6vh,0.375rem)" }}>
                  {body}
                </p>
                <Link href="/signup" className="auth-link inline-flex items-center gap-1.5 font-semibold"
                      style={{ fontSize: "clamp(0.625rem,1.35vh,0.71875rem)", marginTop: "clamp(0.375rem,1.1vh,0.6875rem)" }}>
                  {cta}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            ))}
          </div>

          {/* ── Who it is for ── */}
          <div className="auth-card flex items-center gap-3.5 rounded-[16px]"
               style={{ marginTop: "clamp(0.4375rem,1.2vh,0.75rem)", padding: "clamp(0.4375rem,1.1vh,0.6875rem) clamp(0.6875rem,1.4vh,0.9375rem)" }}>
            <div className="flex -space-x-2.5" aria-hidden>
              {FACES.map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src} src={src} alt=""
                     className="rounded-full object-cover"
                     style={{
                       width: "clamp(1.625rem,3.8vh,2rem)", height: "clamp(1.625rem,3.8vh,2rem)",
                       border: "2px solid var(--a-ring)", background: "var(--a-plum)",
                     }} />
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold" style={{ color: "var(--a-ink)", fontSize: "clamp(0.71875rem,1.55vh,0.8125rem)" }}>
                {TRUST.title}
              </p>
              <p className="mt-0.5 leading-snug" style={{ color: "var(--a-muted)", fontSize: "clamp(0.625rem,1.3vh,0.6875rem)" }}>
                {TRUST.body}
              </p>
            </div>
            {/* The comp put a "4.9/5 from 2.3K+ members" rating here. There is
                no rating — nobody has been asked for one — so the slot carries
                the thing that IS true and is the actual reason to trust this
                page. */}
            <span
              className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold"
              style={{ background: "var(--a-tint-rose)", color: "var(--a-rose)", fontSize: "clamp(0.625rem,1.4vh,0.6875rem)" }}
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Women only
            </span>
          </div>

          {/* ── The figures ── */}
          <div className="grid grid-cols-4"
               style={{ marginTop: "clamp(0.4375rem,1.2vh,0.75rem)", paddingTop: "clamp(0.4375rem,1.1vh,0.6875rem)", borderTop: "1px solid var(--a-edge-soft)" }}>
            {figures.map(({ icon: Icon, value, label }, i) => (
              <div key={label} className="flex items-center gap-2.5 px-1"
                   style={i < figures.length - 1 ? { borderInlineEnd: "1px solid var(--a-edge-soft)" } : undefined}>
                <Icon className="h-[15px] w-[15px] shrink-0" style={{ color: "var(--a-lilac)" }} strokeWidth={1.9} aria-hidden />
                <span className="min-w-0">
                  <span className="block font-bold leading-none" style={{ color: "var(--a-ink)", fontSize: "clamp(0.71875rem,1.6vh,0.8125rem)" }}>
                    {value}
                  </span>
                  <span className="mt-1 block leading-snug" style={{ color: "var(--a-muted)", fontSize: "clamp(0.5625rem,1.2vh,0.65625rem)" }}>
                    {label}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
