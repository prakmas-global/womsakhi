"use client";

import * as Icons from "@/components/ux/icons";

/**
 * The two states every screen has and almost no screen ships with.
 *
 * ── Why these are components and not per-screen markup ─────────────────────
 * Thirty-eight screens each inventing their own "something went wrong" is
 * thirty-eight different apologies, thirty-eight tones of voice, and thirty-
 * eight chances to forget one. One definition means a change to the wording
 * lands everywhere at once.
 *
 * ── Why the skeleton has a shape ───────────────────────────────────────────
 * A spinner says "wait". A skeleton says "wait, and here is roughly what is
 * coming" — the page does not jump when the content lands, because the boxes
 * were already the right size. That matters most on the slow connections this
 * app is actually used on.
 */

/**
 * What a given route is loading, in her words.
 *
 * "We could not load your orders" tells her the rest of the app is fine. "An
 * error occurred" tells her nothing and implies everything is broken. Kept
 * here rather than passed by each screen so no screen can forget it, and so
 * the wording is changed in one place.
 */
const WHAT: [RegExp, string][] = [
  [/^\/app\/health/, "your health checks"],
  [/^\/app\/rights/, "your rights"],
  [/^\/app\/family/, "childcare near you"],
  [/^\/app\/travel/, "your routes"],
  [/^\/app\/assess/, "your skill tests"],
  [/^\/app\/digital/, "these steps"],
  [/^\/app\/cover/, "your cover"],
  [/^\/app\/group-buy/, "what is being bought together"],
  [/^\/app\/wallet\/withdraw/, "this withdrawal"],
  [/^\/app\/wallet\/statement/, "your statement"],
  [/^\/app\/wallet/, "your money"],
  [/^\/app\/payments/, "your payments"],
  [/^\/app\/support-fund\/[^/]+/, "this scheme"],
  [/^\/app\/support-fund/, "the schemes"],
  [/^\/app\/applications/, "your applications"],
  [/^\/app\/opportunities/, "the work we found for you"],
  [/^\/app\/documents\/vault/, "your papers"],
  [/^\/app\/documents\/service/, "this service"],
  [/^\/app\/documents\/order/, "this order"],
  [/^\/app\/documents\/product/, "this product"],
  [/^\/app\/documents/, "your business"],
  [/^\/app\/programs\/[^/]+\/lesson/, "this lesson"],
  [/^\/app\/programs\/[^/]+/, "this course"],
  [/^\/app\/programs/, "your courses"],
  [/^\/app\/mentors\/[^/]+/, "this mentor"],
  [/^\/app\/mentors/, "the mentors"],
  [/^\/app\/library/, "the skill exchange"],
  [/^\/app\/certificates/, "your certificates"],
  [/^\/app\/circles\/new/, "this page"],
  [/^\/app\/circles\/[^/]+\/pay/, "this circle"],
  [/^\/app\/circles/, "your circles"],
  [/^\/app\/stories/, "the stories near you"],
  [/^\/app\/messages/, "your messages"],
  [/^\/app\/events/, "what is coming up"],
  [/^\/app\/explore/, "what we found"],
  [/^\/app\/search/, "your results"],
  [/^\/app\/notifications/, "your notifications"],
  [/^\/app\/schedule/, "your diary"],
  [/^\/app\/bookings/, "your bookings"],
  [/^\/app\/checkout/, "this payment"],
  [/^\/app\/progress\/goals/, "your goals"],
  [/^\/app\/progress/, "your journey"],
  [/^\/app\/saved/, "your saved things"],
  [/^\/app\/sakhi/, "Sakhi"],
  [/^\/app\/profile/, "your profile"],
  [/^\/app\/settings\/payments/, "how you get paid"],
  [/^\/app\/settings/, "your settings"],
  [/^\/app\/help/, "the answers"],
  [/^\/app\/safety/, "the safety centre"],
  [/^\/app\/refer/, "your referrals"],
  [/^\/app\/intake/, "this page"],
  [/^\/app\/feedback/, "this page"],
  [/^\/app$/, "your home screen"],
];

export function whatFailedFor(pathname: string): string {
  for (const [re, what] of WHAT) if (re.test(pathname)) return what;
  return "this page";
}

/** One shimmering block. Everything below is built from these. */
export function Skeleton({
  w = "100%", h = 14, r = 7, className = "",
}: { w?: number | string; h?: number; r?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`ux-skeleton block ${className}`}
      style={{ width: w, height: h, borderRadius: r }}
    />
  );
}

function SkelCard({ children, pad = 18 }: { children: React.ReactNode; pad?: number }) {
  return <div className="ux-card ux-sq" style={{ padding: pad }}>{children}</div>;
}

function Row() {
  return (
    <SkelCard pad={16}>
      <div className="flex items-center gap-3.5">
        <Skeleton w={46} h={46} r={12} />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton w="52%" h={15} />
          <Skeleton w="34%" h={12} />
        </div>
        <Skeleton w={74} h={30} r={10} />
      </div>
    </SkelCard>
  );
}

/**
 * The title and subtitle every screen opens with, at the height they really
 * occupy. The outer boxes are the line boxes; the bars inside are the ink.
 */
function ScreenHead() {
  return (
    <div className="mb-[20px]">
      <div className="flex h-[36px] items-center"><Skeleton w={220} h={22} r={9} /></div>
      <div className="mt-1.5 flex h-[20px] items-center"><Skeleton w={320} h={13} /></div>
    </div>
  );
}

/**
 * A skeleton shaped like the screen behind it.
 *
 * Five shapes cover every screen in the app. Picking the wrong one is not a
 * bug — it is just a page that jumps slightly less than a spinner would.
 *
 * ── Why the header block reserves 36px and not 26px ────────────────────────
 * The heading it stands in for is `text-2xl font-bold` on 48 of the 56
 * screens that have one, and a 24px heading occupies a 36px line box, not a
 * 26px one. The bars were drawn at their own height rather than the height of
 * the thing they replace, so every screen in the app dropped ~12px the instant
 * its real header landed. The wrappers below hold the true line boxes; the
 * bars inside them are shorter on purpose, because a bar the full height of a
 * line of text reads as a filled block rather than as text.
 *
 * ── Why it does not appear for the first frames ────────────────────────────
 * `animation-delay` on a `backwards`-filled fade means the skeleton is
 * transparent until the delay is up. A navigation that resolves in under
 * 140ms therefore shows no skeleton at all, instead of one that appears and
 * vanishes inside three frames — which does not read as loading, it reads as
 * the screen glitching. Reduced motion zeroes the delay (tokens.css), which is
 * the right answer there: nothing is being animated, so nothing is withheld.
 */
export function ScreenSkeleton({ shape = "list" }: {
  shape?: "list" | "grid" | "detail" | "form" | "settings";
}) {
  if (shape === "settings") return <SettingsSkeleton />;
  return (
    <div className="ux-fade" role="status" aria-live="polite"
         style={{ animationDelay: "var(--ux-t-fast)" }}>
      <span className="sr-only">Loading…</span>

      <ScreenHead />

      {shape === "list" && (
        <div className="space-y-[12px]">
          {[0, 1, 2, 3].map((i) => <Row key={i} />)}
        </div>
      )}

      {shape === "grid" && (
        <div className="grid grid-cols-2 gap-[16px]">
          {[0, 1, 2, 3].map((i) => (
            <SkelCard key={i}>
              <Skeleton h={104} r={12} />
              <div className="mt-3 space-y-2">
                <Skeleton w="66%" h={15} />
                <Skeleton w="40%" h={12} />
              </div>
            </SkelCard>
          ))}
        </div>
      )}

      {shape === "detail" && (
        <>
          <SkelCard>
            <div className="flex items-start gap-4">
              <Skeleton w={76} h={76} r={16} />
              <div className="min-w-0 flex-1 space-y-2.5">
                <Skeleton w="58%" h={22} r={9} />
                <Skeleton w="42%" h={13} />
                <Skeleton w="72%" h={13} />
              </div>
            </div>
          </SkelCard>
          <div className="mt-[16px] space-y-[12px]">
            {[0, 1].map((i) => <Row key={i} />)}
          </div>
        </>
      )}

      {shape === "form" && (
        <SkelCard>
          {[0, 1, 2].map((i) => (
            <div key={i} className="mb-5 space-y-2">
              <Skeleton w={140} h={13} />
              <Skeleton h={44} r={11} />
            </div>
          ))}
          <Skeleton w={150} h={40} r={11} />
        </SkelCard>
      )}
    </div>
  );
}

/**
 * The eight settings sub-pages, which do not look like anything else.
 *
 * They all render through `SettingsPage`: a back link to the hub, then a
 * 720px column. Loading them with a full-width `list` skeleton meant the
 * content snapped in from full width to 720px AND slid down by the height of
 * a back link that was not in the skeleton — two shifts on one navigation, on
 * eight routes. This holds both.
 */
function SettingsSkeleton() {
  return (
    <div className="ux-fade" role="status" aria-live="polite"
         style={{ animationDelay: "var(--ux-t-fast)" }}>
      <span className="sr-only">Loading…</span>

      {/* The back link: -my-1 py-1 around a 12.5px line, then mb-3.5. */}
      <div className="mb-3.5 flex h-[19px] items-center"><Skeleton w={78} h={13} /></div>

      <div className="max-w-[720px]">
        <div className="flex h-[36px] items-center"><Skeleton w={190} h={22} r={9} /></div>
        <div className="mt-1.5 flex h-[20px] items-center"><Skeleton w={300} h={13} /></div>

        <div className="mt-[20px] space-y-[16px]">
          {[0, 1].map((i) => (
            <SkelCard key={i}>
              <Skeleton w={130} h={15} />
              <div className="mt-4 space-y-3.5">
                {[0, 1, 2].map((j) => (
                  <div key={j} className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton w="44%" h={13} />
                      <Skeleton w="66%" h={11} />
                    </div>
                    <Skeleton w={44} h={26} r={13} />
                  </div>
                ))}
              </div>
            </SkelCard>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * The right-hand rail, while it is on its way.
 *
 * Fifty-eight screens pass a `rail` to the shell and not one of their
 * `loading.tsx` files did, so the content column was laid out 320px + 25px
 * wider than the screen it was standing in for and then jumped narrower the
 * moment the page arrived. Every navigation in the app moved sideways.
 *
 * It cannot match each rail's contents — they differ per screen — so it does
 * not try. It reserves the column and shows two cards, which is what almost
 * every rail holds.
 */
export function RailSkeleton() {
  return (
    <div className="ux-fade space-y-[16px]" aria-hidden
         style={{ animationDelay: "var(--ux-t-fast)" }}>
      {[0, 1].map((i) => (
        <SkelCard key={i}>
          <Skeleton w="58%" h={15} />
          <Skeleton w="76%" h={11} className="mt-2" />
          <div className="mt-4 space-y-3">
            {[0, 1, 2].map((j) => (
              <div key={j} className="flex items-center gap-3">
                <Skeleton w={36} h={36} r={10} />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton w="70%" h={12} />
                  <Skeleton w="45%" h={10} />
                </div>
              </div>
            ))}
          </div>
        </SkelCard>
      ))}
    </div>
  );
}

/**
 * Verify and Welcome, while they load.
 *
 * These two run BEFORE the shell exists — the member layout renders them bare.
 * They had no `loading.tsx` of their own, so they inherited `/app/loading.tsx`
 * and every visit painted the entire app — sidebar, topbar, a grid of cards —
 * and then threw all of it away for a full-screen onboarding page. She saw an
 * app she does not have access to yet, for about a second.
 *
 * It deliberately does NOT render `OnboardFrame`: that frame wants a step
 * number and a total, and which step she is on is exactly what has not
 * arrived. "Step 1 of 3" over a screen that turns out to be step 3 is an
 * invented fact. The bar is drawn empty and the count is left blank until the
 * page can say something true.
 */
export function OnboardSkeleton() {
  return (
    <div className="ux-fade min-h-screen" role="status" aria-live="polite"
         style={{ background: "var(--ux-canvas)", animationDelay: "var(--ux-t-fast)" }}>
      <span className="sr-only">Loading…</span>

      <header className="flex items-center justify-between px-8 pb-2 pt-6">
        <Skeleton w={132} h={26} r={8} />
        <Skeleton w={74} h={13} />
      </header>

      <div className="px-8">
        <div className="ux-sq h-[5px] w-full rounded-full" style={{ background: "var(--ux-track)" }} />
      </div>

      <div className="mx-auto grid w-full max-w-[1080px] gap-[32px] px-8 py-[40px] lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <div className="flex h-[38px] items-center"><Skeleton w="62%" h={28} r={10} /></div>
          <div className="mt-2.5 space-y-2">
            <Skeleton w="82%" h={14} />
            <Skeleton w="54%" h={14} />
          </div>
          <div className="mt-[24px] space-y-[16px]">
            {[0, 1].map((i) => (
              <SkelCard key={i}>
                <div className="flex items-start gap-3.5">
                  <Skeleton w={46} h={46} r={12} />
                  <div className="min-w-0 flex-1 space-y-2.5">
                    <Skeleton w="48%" h={15} />
                    <Skeleton w="72%" h={12} />
                  </div>
                </div>
              </SkelCard>
            ))}
          </div>
        </div>

        <div className="min-w-0">
          <SkelCard pad={24}>
            <Skeleton w="66%" h={16} />
            <Skeleton w="88%" h={12} className="mt-2.5" />
            <div className="mt-4 space-y-2.5">
              {[0, 1, 2].map((i) => <Skeleton key={i} w={`${70 - i * 8}%`} h={12} />)}
            </div>
          </SkelCard>
        </div>
      </div>
    </div>
  );
}

/**
 * A route that exists only to send her somewhere else.
 *
 * `/app/explore/program/[id]` and `/app/explore/service/[id]` are `redirect()`
 * and nothing more. They were loading behind a full list skeleton, which
 * promised a list of things that this route will never render — and then the
 * destination showed its own skeleton, so one tap produced two different
 * loading screens. A skeleton is a claim about what is coming; here the only
 * true claim is that she is being moved.
 */
export function ScreenHandoff({ to = "there" }: { to?: string }) {
  return (
    <div className="ux-fade grid min-h-[280px] place-items-center" role="status" aria-live="polite"
         style={{ animationDelay: "var(--ux-t-fast)" }}>
      <div className="flex flex-col items-center text-center">
        <span className="grid h-[46px] w-[46px] place-items-center rounded-full"
              style={{ background: "var(--ux-brand-tint)" }}>
          <Icons.ArrowRight className="h-[20px] w-[20px]" style={{ color: "var(--ux-brand)" }} strokeWidth={2} />
        </span>
        <p className="mt-3 text-sm" style={{ color: "var(--ux-ink-2)" }}>Taking you to {to}…</p>
      </div>
    </div>
  );
}

/**
 * Something failed.
 *
 * Three rules, all of them learned the hard way by everyone who has ever
 * shipped a "Something went wrong":
 *
 * 1. Say WHAT failed, in her words. "We could not load your orders" tells her
 *    the rest of the app is fine. "An error occurred" tells her nothing and
 *    implies everything is broken.
 * 2. Give her the action. Retry is the first button, not a link at the bottom.
 * 3. Say her work is safe. The fear behind a failed screen is almost always
 *    "have I lost something", and answering it unprompted costs one sentence.
 */
export function ScreenError({
  what = "this page",
  reset,
  detail,
}: {
  /** What could not be loaded, in her words: "your orders", "this course". */
  what?: string;
  reset?: () => void;
  detail?: string;
}) {
  return (
    <div className="ux-slide-up" role="alert">
      <div className="ux-card ux-sq mx-auto max-w-[520px]" style={{ padding: 28 }}>
        <div className="flex flex-col items-center text-center">
          <span className="grid h-[62px] w-[62px] place-items-center rounded-full"
                style={{ background: "var(--ux-tint-orange)" }}>
            <Icons.CloudOff className="h-[28px] w-[28px]" style={{ color: "var(--ux-orange-ink)" }} strokeWidth={1.8} />
          </span>

          <h2 className="mt-4 text-lg font-bold" style={{ color: "var(--ux-ink)" }}>
            We could not load {what}
          </h2>
          <p className="mt-2 max-w-[42ch] text-sm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
            This is usually the connection rather than anything you did. Try again in a moment.
          </p>

          {/* The fear behind a failed screen is almost always "have I lost
              something". Answer it before she has to ask. */}
          <p className="mt-3 flex items-center gap-2 rounded-[12px] px-3.5 py-2.5 text-xsm"
             style={{ background: "var(--ux-tint-green)", color: "var(--ux-ink-2)" }}>
            <Icons.ShieldCheck className="h-[15px] w-[15px] shrink-0" style={{ color: "var(--ux-green-ink)" }} />
            Nothing you have done has been lost.
          </p>

          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            <button
              onClick={() => (reset ? reset() : window.location.reload())}
              className="ux-press ux-hov ux-sq inline-flex min-h-[42px] items-center gap-2 rounded-[12px] px-4 py-2.5 text-xsm font-semibold"
              style={{ background: "linear-gradient(96deg, var(--ux-fill), var(--ux-fill-2))", color: "var(--ux-on-brand)" }}
            >
              <Icons.RotateCcw className="ux-ico h-[15px] w-[15px]" strokeWidth={2.1} /> Try again
            </button>
            <a
              href="/app"
              className="ux-press ux-hov ux-sq inline-flex items-center gap-2 rounded-[12px] border px-4 py-2.5 text-xsm font-semibold"
              style={{ borderColor: "var(--ux-line-strong)", color: "var(--ux-ink)" }}
            >
              Go home
            </a>
            <a
              href="/app/help"
              className="ux-press ux-hov inline-flex items-center gap-2 rounded-[12px] px-4 py-2.5 text-xsm font-semibold"
              style={{ color: "var(--ux-brand)" }}
            >
              Get help
            </a>
          </div>

          {detail && (
            <p className="mt-4 font-mono text-2xs" style={{ color: "var(--ux-faint)" }}>{detail}</p>
          )}
        </div>
      </div>
    </div>
  );
}
