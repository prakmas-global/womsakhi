"use client";

import Image from "next/image";
import { TransitionLink } from "@/components/ux/TransitionLink";
import { I } from "@/components/ux/kit";
import { ME, QUICK_ACTIONS, JOURNEY, RECOMMENDED, OPPORTUNITIES, EARNINGS } from "./data";

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

const money = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

/** Morning/afternoon/evening from the device clock, not the server's. */
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function MobileHome() {
  return (
    <div className="lg:hidden" style={{ paddingBottom: 8 }}>
      {/* ── who she is, and what is waiting ─────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 pb-3 pt-1">
        <TransitionLink href="/app/profile" className="ux-sq shrink-0" aria-label="Your profile">
          <Image src={ME.avatar} alt="" width={44} height={44}
                 className="h-11 w-11 rounded-full object-cover"
                 style={{ boxShadow: "0 0 0 2px var(--ux-brand-tint-2)" }} />
        </TransitionLink>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px]" style={{ color: "var(--ux-muted)" }}>{greeting()},</p>
          <p className="truncate text-[19px] font-bold leading-tight" style={{ color: "var(--ux-ink)" }}>
            {ME.first}
          </p>
        </div>
        <TransitionLink href="/app/notifications"
          className="ux-sq relative grid h-11 w-11 place-items-center rounded-full"
          style={{ background: "var(--ux-surface-2)" }} aria-label={`Notifications, ${ME.unread} unread`}>
          <I name="Bell" className="h-[19px] w-[19px]" style={{ color: "var(--ux-ink-2)" }} />
          {ME.unread > 0 && (
            <span aria-hidden
                  className="absolute right-1.5 top-1.5 grid h-[17px] min-w-[17px] place-items-center rounded-full px-1 text-[10px] font-bold"
                  style={{ background: "var(--ux-pink)", color: "#fff" }}>
              {ME.unread > 9 ? "9+" : ME.unread}
            </span>
          )}
        </TransitionLink>
      </header>

      {/* ── the number she actually opens the app for ───────────────────── */}
      <TransitionLink href="/app/wallet"
        className="ux-sq mx-4 flex items-center gap-3 rounded-[16px] p-4"
        style={{ background: "linear-gradient(135deg, var(--ux-brand-700), var(--ux-brand-900))" }}>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em]"
             style={{ color: "rgb(255 255 255 / 0.72)" }}>
            Earned {EARNINGS.period.toLowerCase()}
          </p>
          {/* tabular-nums so the figure does not jitter as it changes */}
          <p className="mt-0.5 text-[26px] font-extrabold leading-none text-white [font-variant-numeric:tabular-nums]">
            {money(EARNINGS.total)}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold"
              style={{ background: "rgb(255 255 255 / 0.16)", color: "#fff" }}>
          <I name="TrendingUp" className="h-3.5 w-3.5" sw={2.4} />
          {EARNINGS.delta}
        </span>
      </TransitionLink>

      {/* ── the launcher ────────────────────────────────────────────────── */}
      {/*
        Four across, icon over label — the shape of every app launcher, and the
        reason is that it is scannable by picture alone. That matters more here
        than in most apps: a woman who reads slowly should be able to find "the
        money one" without reading, and the label is there to confirm rather
        than to inform.
      */}
      <nav aria-label="Quick actions" className="mt-4 grid grid-cols-4 gap-1 px-2">
        {QUICK_ACTIONS.slice(0, 8).map((q) => (
          <TransitionLink key={q.href} href={q.href}
            className="ux-sq flex flex-col items-center gap-1.5 rounded-[14px] px-1 py-3">
            <span className="grid h-[46px] w-[46px] place-items-center rounded-[15px]"
                  style={{ background: `var(${q.tint})` }}>
              <I name={q.icon} className="h-[21px] w-[21px]" sw={1.9} style={{ color: `var(${q.ink})` }} />
            </span>
            <span className="w-full truncate text-center text-[11px] font-semibold leading-tight"
                  style={{ color: "var(--ux-ink-2)" }}>
              {q.label}
            </span>
          </TransitionLink>
        ))}
      </nav>

      {/* ── pick up where she stopped ───────────────────────────────────── */}
      <Section title="Keep going" href="/app/programs" cta="All courses">
        <TransitionLink href="/app/programs"
          className="ux-sq mx-4 flex items-center gap-3 rounded-[16px] p-3"
          style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
          <Image src={JOURNEY.art} alt="" width={56} height={56}
                 className="h-14 w-14 shrink-0 rounded-[12px] object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold" style={{ color: "var(--ux-ink)" }}>
              {JOURNEY.title}
            </p>
            <p className="mt-0.5 truncate text-[13px]" style={{ color: "var(--ux-muted)" }}>
              Next: {JOURNEY.next}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--ux-brand-tint-2)" }}>
              <div className="h-full rounded-full"
                   style={{ width: `${JOURNEY.pct}%`, background: "var(--ux-brand)" }} />
            </div>
          </div>
          <span className="shrink-0 text-[13px] font-bold [font-variant-numeric:tabular-nums]"
                style={{ color: "var(--ux-brand)" }}>
            {JOURNEY.pct}%
          </span>
        </TransitionLink>
      </Section>

      {/* ── work waiting for her ────────────────────────────────────────── */}
      <Section title="Work for you" href="/app/opportunities" cta="See all">
        <div className="ux-hscroll flex gap-3 px-4">
          {OPPORTUNITIES.slice(0, 6).map((o: Record<string, unknown>, i: number) => (
            <TransitionLink key={String(o.id ?? i)} href="/app/opportunities"
              className="ux-sq flex w-[76vw] max-w-[300px] shrink-0 flex-col gap-1 rounded-[16px] p-4"
              style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
              <p className="truncate text-[15px] font-bold" style={{ color: "var(--ux-ink)" }}>
                {String(o.title ?? o.role ?? "Opportunity")}
              </p>
              <p className="truncate text-[13px]" style={{ color: "var(--ux-muted)" }}>
                {String(o.meta ?? o.company ?? o.place ?? "")}
              </p>
            </TransitionLink>
          ))}
        </div>
      </Section>

      {/* ── something to learn next ─────────────────────────────────────── */}
      <Section title="Suggested for you" href="/app/programs" cta="More">
        <div className="ux-hscroll flex gap-3 px-4">
          {RECOMMENDED.map((r) => (
            <TransitionLink key={r.id} href="/app/programs"
              className="ux-sq w-[64vw] max-w-[240px] shrink-0 overflow-hidden rounded-[16px]"
              style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
              <Image src={r.art} alt="" width={480} height={270}
                     className="h-[112px] w-full object-cover" />
              <div className="p-3">
                <p className="truncate text-[14px] font-bold" style={{ color: "var(--ux-ink)" }}>{r.title}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[12px]" style={{ color: "var(--ux-muted)" }}>
                  <I name="Star" className="h-3 w-3" sw={0}
                     style={{ color: "var(--ux-amber)", fill: "var(--ux-amber)" }} />
                  {r.rating} · {r.count}
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
 * A section: a quiet label, an action on the right, then the content.
 *
 * The label is small and grey rather than a heading, because on a phone the
 * screen has ONE title and everything below it is a group. Repeating heading
 * weight down the page is what makes a phone screen read as a dashboard.
 */
function Section({ title, href, cta, children }: {
  title: string; href: string; cta: string; children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <div className="mb-2.5 flex items-baseline justify-between px-4">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.07em]" style={{ color: "var(--ux-muted)" }}>
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
        <TransitionLink href={href}
                        className="-me-2 inline-flex min-h-[44px] items-center px-2 text-[13px] font-semibold"
                        style={{ color: "var(--ux-brand)" }}>
          {cta}
        </TransitionLink>
      </div>
      {children}
    </section>
  );
}

export default MobileHome;
