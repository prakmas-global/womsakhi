"use client";

import Image from "next/image";
import { TransitionLink } from "@/components/ux/TransitionLink";
import { I, formatRupees } from "@/components/ux/kit";
import { useHome } from "@/components/ux/live";

/**
 * Home, on a phone.
 *
 * ── Why this is a separate screen rather than the desktop one restyled ──────
 * The desktop home opens on a marketing hero: a full-bleed banner, a 44px
 * "Connect. Learn. Earn. Grow. Together." and two stacked gradient buttons.
 * That is the right shape for a landing page and the wrong shape for an app —
 * on a 390px screen it spends the entire first viewport before showing a
 * single thing she can act on.
 *
 * Restyling it with CSS was tried first and it does not work, for a reason
 * worth stating: you can shrink a hero's type, but you cannot make a hero stop
 * being an announcement. An app's home screen answers "what do I do now"; a
 * landing page's answers "what is this". Those are different screens, so this
 * is a different component, rendered below `lg` while the desktop keeps its
 * own.
 *
 * The order is the answer to "what now", most urgent first:
 *   greeting → what she is owed → what she can tap → what she was doing →
 *   what is waiting for her.
 * Nothing here is decorative. There is no hero.
 */

/*
  `formatRupees` from the kit, never a local formatter.

  There was one here, and it was a 100x bug waiting for the API. Every money
  value in this app is in MINOR units — paise — and `formatMoney` divides by
  100 (it is `formatMoney` there, re-exported as `formatRupees`).
  The local one did not: it took rupees. The two agreed only because the
  mock `EARNINGS.total` happened to be written in rupees, so the screen looked
  right while the contract underneath it was wrong.

  The moment Home is wired to the real endpoint — which returns minor units
  like everything else — the same call would have printed Rs 24,30,000 where
  she earned Rs 24,350. TypeScript cannot see it: both are `number`.

  This is the third formatter this repo has grown. Two was already the bug.

/** Morning/afternoon/evening from the device clock, not the server's. */
/** White on the brand gradient, from the token rather than a literal — and
 *  the dimmer caption white as a mix of it, so both follow the token. */
const ON_BRAND = "var(--ux-on-brand)";
const ON_BRAND_2 = "color-mix(in srgb, var(--ux-on-brand) 72%, transparent)";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function MobileHome() {
  /*
    One request for the whole screen.

    The alternative — a hook per block — is eleven requests before a woman on a
    3G connection sees anything, each with its own spinner and its own way to
    half-fail. `/me/home` gathers them server-side: 69ms at the median against
    715ms for the same eleven called in sequence, before any network cost.

    `data` is null on first load AND on failure, and both render the skeleton
    rather than throwing. This is the first screen after sign-in; an error
    boundary here is a woman staring at a blank app.
  */
  const { data, refetch } = useHome();

  if (!data) return <HomeSkeleton />;

  const { me, journey, earnings, opportunities, recommended, unavailable } = data;
  /*
    `unavailable` names the blocks whose server-side fetch timed out. The
    endpoint gathers eleven of them in parallel and returns whatever arrived
    rather than failing the whole screen, so a slow collection costs one card,
    not the app.

    It matters most for money. `earnings` is built from the `summary` block, so
    when that times out `earnings` is null — and `earnings?.money.balance_minor
    ?? 0` would print a confident **Rs 0** to a woman who has Rs 2,300. That is
    the same failure as an invented number, arrived at by a different route:
    the figure is wrong and nothing on screen says so.
  */
  const lost = (b: string) => unavailable?.includes(b) ?? false;
  const balanceUnknown = !earnings || lost("summary");

  return (
    <div className="lg:hidden" style={{ paddingBottom: 8 }}>
      {/*
        The greeting only — no avatar, no bell.

        Both were here first and both are in the top bar, which persists across
        every screen. Two avatars and two notification icons stacked 60px apart
        is not richness, it is the same control twice; the top bar wins because
        it is the one that is always there.
      */}
      {/*
        No side inset of its own. The shell already pads the content column,
        and this screen added a second 16px inside it, so Home sat 36px from
        the edge while every other screen sat at the shell's inset — the one
        screen whose edges did not line up with the rest. Now it uses the
        shell's inset, whatever that is.
      */}
      <header className="pb-3 pt-1">
        <p className="text-[13px]" style={{ color: "var(--ux-muted)" }}>{greeting()},</p>
        {/* The one large title on the screen: her name, at 34 — the spec's
            large-title step. It was 28, a size down from every other screen's
            title, so Home was the one screen that did not open like the rest. */}
        <h1 className="ux-screen-title mt-0.5"
            style={{ color: "var(--ux-ink)" }}>
          {me.first}
        </h1>
      </header>

      {/* ── the number she actually opens the app for ───────────────────── */}
      {balanceUnknown ? (
        /*
          Not a number, and not a zero.

          A retry rather than a link to the wallet, because the wallet reads the
          same block and would fail the same way. The tile keeps its colour and
          its place so the screen does not jump when the figure arrives.
        */
        <div className="ux-sq flex items-center gap-3 rounded-[16px] p-4"
             style={{ background: "linear-gradient(135deg, var(--ux-brand-700), var(--ux-brand-900))" }}>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em]"
               style={{ color: ON_BRAND_2 }}>
              Your balance
            </p>
            <p className="mt-0.5 text-[15px] font-semibold leading-snug" style={{ color: ON_BRAND }}>
              We could not load it just now.
            </p>
          </div>
          <button type="button" onClick={refetch}
                  className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold"
                  style={{ background: "color-mix(in srgb, var(--ux-on-brand) 18%, transparent)", color: ON_BRAND }}>
            <I name="RefreshCw" className="h-4 w-4" sw={2.2} />
            Try again
          </button>
        </div>
      ) : (
      <TransitionLink href="/app/wallet"
        className="ux-sq flex items-center gap-3 rounded-[16px] p-4"
        style={{ background: "linear-gradient(135deg, var(--ux-brand-700), var(--ux-brand-900))" }}>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em]"
             style={{ color: ON_BRAND_2 }}>
            Your balance
          </p>
          {/* tabular-nums so the figure does not jitter as it changes */}
          <p className="mt-0.5 text-[28px] font-bold leading-none [font-variant-numeric:tabular-nums]"
             style={{ color: ON_BRAND }}>
            {formatRupees(earnings.money.balance_minor)}
          </p>
        </div>
        {/*
          Earned this month, only when she earned something.

          The hero figure is her BALANCE, not the month's earnings, and the
          difference matters. Balance is money she has and can act on; this
          month's earnings is a score. For a woman between jobs the API
          honestly returns 0 and -100%, and "Rs 0, down 100%" as the first
          thing she sees every morning is accurate and cruel — it tells her
          something she already knows and nothing she can use.

          So the month sits underneath, and only when there is something to
          report. Nothing is hidden: the full picture, including a bad month,
          is one tap away in the wallet.
        */}
        {earnings.money.earned_this_month_minor > 0 && (
          <span className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold"
                style={{ background: "color-mix(in srgb, var(--ux-on-brand) 16%, transparent)", color: ON_BRAND }}>
            <I name="TrendingUp" className="h-3.5 w-3.5" sw={2.4} />
            {formatRupees(earnings.money.earned_this_month_minor)} this month
          </span>
        )}
      </TransitionLink>
      )}

      {/*
        ── what used to be a six-tile launcher ──────────────────────────────

        It was Courses, Mentors, Find work, Your wallet, Circles and Ask Sakhi,
        four across, and the argument for it was accessibility: icon over
        label, findable by picture for a woman who reads slowly.

        The argument does not survive checking where those tiles went. Five of
        the six are already in the tab bar pinned to the bottom of every
        screen — Courses and Mentors are inside Learn, Find work inside Work,
        Your wallet inside Earn, Circles inside Circle — and the tab bar is
        also icon-over-label, also findable by picture, and always there rather
        than only at the top of Home. So the grid was the same navigation a
        second time, in the one place you have to scroll back to reach.

        Ask Sakhi was the exception: nothing else on a phone reaches her. So
        she keeps a row of her own, as content rather than as a sixth of a
        navigation grid — which is also the honest shape for the one thing on
        this screen that answers back.
      */}
      <TransitionLink href="/app/sakhi"
        className="ux-sq mt-4 flex items-center gap-3 rounded-[12px] p-4"
        style={{ background: "var(--ux-tint-lilac)",
                 border: `1px solid color-mix(in srgb, var(--ux-violet) 22%, transparent)` }}>
        <span className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-[12px]"
              style={{ background: "color-mix(in srgb, var(--ux-violet) 16%, transparent)" }}>
          <I name="Sparkles" className="h-[21px] w-[21px]" sw={2}
             style={{ color: "var(--ux-violet-ink)" }} />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[17px] font-semibold leading-tight" style={{ color: "var(--ux-ink)" }}>
            Ask Sakhi
          </b>
          <span className="mt-0.5 block text-[13px] leading-snug" style={{ color: "var(--ux-ink-2)" }}>
            She has read every screen you have.
          </span>
        </span>
        <I name="ChevronRight" className="h-[18px] w-[18px] shrink-0" sw={2.2}
           style={{ color: "var(--ux-violet-ink)" }} />
      </TransitionLink>


      {/*
        Only when there is something to pick up.

        `journey` is null for a woman who has not started a course, and the
        old mock always showed "Digital Marketing Mastery, 65%" — a course she
        had never opened. An invented progress bar is a small lie that makes
        every other number on the screen less believable.
      */}
      {journey && (
        <Section title="Keep going">
          <TransitionLink href={journey.href}
            className="ux-sq flex items-center gap-3 rounded-[12px] p-4"
            style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
            {journey.cover
              ? <Image src={journey.cover} alt="" width={56} height={56}
                       className="h-14 w-14 shrink-0 rounded-[12px] object-cover" />
              : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[12px]"
                      style={{ background: "var(--ux-brand-tint-2)" }}>
                  <I name="BookOpen" className="h-6 w-6" style={{ color: "var(--ux-brand)" }} />
                </span>}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold" style={{ color: "var(--ux-ink)" }}>
                {journey.title}
              </p>
              <p className="mt-0.5 truncate text-[13px]" style={{ color: "var(--ux-muted)" }}>
                {journey.done} of {journey.total} done
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full"
                   style={{ background: "var(--ux-brand-tint-2)" }}>
                <div className="h-full rounded-full"
                     style={{ width: `${journey.pct}%`, background: "var(--ux-brand)" }} />
              </div>
            </div>
            <span className="shrink-0 text-[13px] font-bold [font-variant-numeric:tabular-nums]"
                  style={{ color: "var(--ux-brand)" }}>
              {journey.pct}%
            </span>
          </TransitionLink>
        </Section>
      )}

      {/* ── work waiting for her ────────────────────────────────────────── */}
      <Section title="Work for you">
        <div className="ux-hscroll flex gap-3">
          {opportunities.slice(0, 6).map((o: Record<string, unknown>, i: number) => (
            <TransitionLink key={String(o.id ?? i)} href={`/app/opportunities/${String(o.id ?? "")}`}
              className="ux-sq flex w-[76vw] max-w-[300px] shrink-0 flex-col gap-1 rounded-[12px] p-4"
              style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
              <p className="truncate text-[15px] font-bold" style={{ color: "var(--ux-ink)" }}>
                {String(o.title ?? "Opportunity")}
              </p>
              <p className="truncate text-[13px]" style={{ color: "var(--ux-muted)" }}>
                {[o.org, o.pay].filter(Boolean).map(String).join(" · ")}
              </p>
            </TransitionLink>
          ))}
        </div>
      </Section>

      {/* ── something to learn next ─────────────────────────────────────── */}
      <Section title="Suggested for you">
        <div className="ux-hscroll flex gap-3">
          {recommended.slice(0, 6).map((r: Record<string, unknown>, i: number) => (
            <TransitionLink key={String(r.id ?? i)} href={`/app/programs/${String(r.id ?? "")}`}
              className="ux-sq w-[64vw] max-w-[240px] shrink-0 overflow-hidden rounded-[12px]"
              style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
              {/* A catalogue entry may have no cover — an admin has to upload
                  one. A tinted block with the category on it beats a broken
                  image icon, and beats a stock photograph that implies a
                  course is something it is not. */}
              {r.cover
                ? <Image src={String(r.cover)} alt="" width={480} height={270}
                         className="h-[112px] w-full object-cover" />
                : <span className="grid h-[112px] w-full place-items-center"
                        style={{ background: "var(--ux-brand-tint-2)" }}>
                    <I name="GraduationCap" className="h-7 w-7" style={{ color: "var(--ux-brand)" }} />
                  </span>}
              <div className="p-4">
                <p className="truncate text-[15px] font-bold" style={{ color: "var(--ux-ink)" }}>
                  {String(r.title ?? "")}
                </p>
                {/* The server sends WHY it is here. The mock showed a star
                    rating and a review count; this platform collects neither,
                    so those numbers were decoration shaped like evidence. */}
                <p className="mt-0.5 truncate text-[13px]" style={{ color: "var(--ux-muted)" }}>
                  {String(r.reason ?? r.category ?? "")}
                </p>
              </div>
            </TransitionLink>
          ))}
        </div>
      </Section>
    </div>
  );
}

/**
 * What Home looks like before the first response lands.
 *
 * Shaped like the real screen rather than a spinner: the same header, the same
 * earnings block, the same eight tiles. A spinner tells her to wait; a shape
 * tells her what is coming, and when the data arrives nothing jumps because
 * the boxes were already the right size.
 */
function HomeSkeleton() {
  const bar = { background: "var(--ux-surface-2)", borderRadius: 8 };
  return (
    <div className="lg:hidden" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your home screen</span>
      <div className="pb-3 pt-1">
        <div className="ux-shimmer h-3 w-24" style={bar} />
        <div className="ux-shimmer mt-2 h-7 w-32" style={bar} />
      </div>
      <div className="ux-shimmer h-[86px]" style={{ ...bar, borderRadius: 16 }} />
      {/* The Ask Sakhi row. This was still an eight-tile grid — the launcher
          that was taken off Home — so the screen jumped from one layout to
          another the moment it loaded. */}
      <div className="ux-shimmer mt-4 h-[78px]" style={{ ...bar, borderRadius: 12 }} />
      <div className="mt-6">
        <div className="ux-shimmer h-3 w-28" style={bar} />
        <div className="ux-shimmer mt-3 h-[86px] w-full" style={{ ...bar, borderRadius: 16 }} />
      </div>
    </div>
  );
}

/**
 * A section: a quiet label, an action on the right, then the content.
 *
 * The label is small and grey rather than a heading, because on a phone the
 * screen has ONE title and everything below it is a group. Repeating heading
 * weight down the page is what makes a phone screen read as a dashboard.
 */
function Section({ title, href, cta, children }: {
  title: string;
  /*
    Optional, and usually absent now.

    Measured on this screen: three links to /app/programs, two to
    /app/opportunities and two to /app/wallet. The launcher already carries
    every one of those destinations as a tile, and the tiles are the ACCESSIBLE
    path — icon over label, findable by picture for a woman who reads slowly,
    which is the whole reason that grid exists. A second text link to the same
    place three rows below it is not a shortcut, it is the same door drawn
    twice with the page in between.

    So the heading keeps its action only where the launcher does not already go
    there. Everything else is reached by the tile.
  */
  href?: string; cta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-baseline justify-between px-4">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--ux-muted)" }}>
          {title}
        </h2>
        {/*
          Padded to a real hit box rather than marked exempt.

          `ux-tap-exempt` exists for a link inside a sentence, which cannot be
          44px tall without wrecking the sentence — WCAG 2.5.8 exempts those
          for exactly that reason. This is not one of those: it is a section
          action sitting on its own line, so the exemption was a way of
          silencing the audit rather than answering it. The negative margin
          keeps it optically aligned with the heading beside it.
        */}
        {href && cta && (
        <TransitionLink href={href}
                        className="-me-2 inline-flex min-h-[44px] items-center px-2 text-[13px] font-semibold"
                        style={{ color: "var(--ux-brand)" }}>
          {cta}
        </TransitionLink>
        )}
      </div>
      {children}
    </section>
  );
}

export default MobileHome;
