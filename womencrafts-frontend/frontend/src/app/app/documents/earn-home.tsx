"use client";

import Link from "next/link";

import * as Icons from "@/components/ux/icons";
import { Btn, Card, I, IconTile, Progress, v } from "@/components/ux/kit";
import { GROUP_ROW } from "@/components/ux/earn/phone";

/**
 * Earn — the dashboard she lands on.
 *
 * ── Every number here is hers ──────────────────────────────────────────────
 * The four figures, the five-step journey and the activity list are all
 * derived from `/shop/summary`, `/shop/listings` and `/shop/orders`. Nothing
 * on this screen is a made-up figure dressed as her business; where the API
 * has no field (a "pending payments" total, say) the number is computed from
 * orders she can go and count herself.
 *
 * The only invented content is the four ways to earn and the selling tips —
 * both are advice, not data, and neither claims to be about her.
 */

/* ------------------------------------------------------------------ */
/*  The banner                                                         */
/* ------------------------------------------------------------------ */

export function EarnHero() {
  return (
    /* On a phone the banner stands down to a large title: no fill, no frame,
       no inset — the words and the one action are what she came for. */
    <section className="relative mb-6 overflow-hidden rounded-[20px] max-lg:overflow-visible max-lg:rounded-none! max-lg:border-0! max-lg:bg-none! lg:mb-5"
             style={{ background: "linear-gradient(105deg, var(--ux-brand-tint) 0%, var(--ux-tint-lilac) 52%, var(--ux-tint-pink) 100%)",
                      border: "1px solid var(--ux-line)" }}>
      <div className="relative z-[1] max-w-[560px] p-0 lg:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] lg:text-2xs lg:font-extrabold lg:tracking-[0.14em]" style={{ color: v("--ux-muted") }}>
          Earn on your terms
        </p>
        <h1 className="ux-screen-title mt-2.5 text-3xl font-extrabold leading-[1.1] tracking-[-0.02em]"
            style={{ color: v("--ux-ink") }}>
          Turn your skills into
          <br />
          <span style={{ color: v("--ux-brand") }}>income &amp; impact</span>
        </h1>
        <p className="mt-3 max-w-[400px] text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
          Sell products, offer services, take orders — and be part of a stronger community of women.
        </p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <Btn href="/app/documents/new" icon="Plus" className="ux-action-primary">Add a product or service</Btn>
          <Btn href="/app/programs" variant="outline" icon="Play" className="max-lg:w-full">Watch how it works</Btn>
        </div>
      </div>

      {/* Her, at her own counter. Decorative — the words above carry the meaning. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ux/art/scene-woman-shop-owner.webp" alt="" aria-hidden loading="lazy" decoding="async"
           className="pointer-events-none absolute bottom-0 end-0 hidden h-full w-[42%] object-cover object-top lg:block"
           style={{ maskImage: "linear-gradient(100deg, transparent, #000 26%)",
                    WebkitMaskImage: "linear-gradient(100deg, transparent, #000 26%)" }} />

      <figure className="absolute bottom-5 end-6 hidden w-[196px] rounded-[14px] p-3.5 xl:block"
              style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)",
                       boxShadow: "var(--ux-shadow-card)" }}>
        <blockquote className="text-xs font-bold leading-snug" style={{ color: v("--ux-ink") }}>
          &ldquo;Small steps today, bigger dreams tomorrow.&rdquo;
        </blockquote>
        <figcaption className="mt-1.5 text-2xs" style={{ color: v("--ux-muted") }}>— WomSakhi</figcaption>
      </figure>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  The four numbers                                                   */
/* ------------------------------------------------------------------ */

export function Figure({ label, value, note, noteTone, icon, tint, ink, href }: {
  label: string; value: string; note?: string;
  /** Green for movement in her favour, muted for a plain count. */
  noteTone?: "up" | "plain";
  icon: string; tint: string; ink: string; href: string;
}) {
  return (
    <Link href={href} className={`ux-card ux-hov ux-sq block p-4 ${GROUP_ROW}`}>
      <div className="flex items-start justify-between gap-3 max-lg:flex-row-reverse max-lg:items-center max-lg:justify-end">
        <span className="min-w-0">
          <span className="block text-xs font-semibold" style={{ color: v("--ux-muted") }}>{label}</span>
          <span className="mt-2 block text-2xl font-extrabold leading-none tracking-[-0.02em]"
                style={{ color: v(noteTone === "up" ? "--ux-green-ink" : "--ux-ink") }}>
            {value}
          </span>
          {note && (
            <span className="mt-2 flex items-center gap-1 text-2xs font-semibold"
                  style={{ color: v(noteTone === "up" ? "--ux-green-ink" : "--ux-faint") }}>
              {noteTone === "up" && <Icons.TrendingUp className="h-[12px] w-[12px]" />}
              {note}
            </span>
          )}
        </span>
        <IconTile icon={icon} tint={tint} ink={ink} size={36} radius={11} />
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  How far along she is                                               */
/* ------------------------------------------------------------------ */

export interface Step { label: string; done: boolean }

/**
 * The five things that actually change how much she sells.
 *
 * Not "profile completeness" — a percentage of form fields is a number about
 * the form, not about her business. Each of these is checked against her real
 * listings and orders, and each one, done, makes a difference she can see.
 */
export function Journey({ steps }: { steps: Step[] }) {
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  return (
    <Card className="mb-6 lg:mb-5">
      <div className="flex flex-wrap items-center gap-4">
        <IconTile icon="Rocket" tint="--ux-tint-violet" ink="--ux-violet-ink" size={48} radius={14} />
        <div className="min-w-[220px] flex-1">
          <p className="text-smd font-extrabold" style={{ color: v("--ux-ink") }}>
            {done === steps.length ? "You have done all five" : "You're doing great!"}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: v("--ux-muted") }}>
            {next ? next.label : "Every step done — keep the orders moving."}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <span className="max-w-[420px] flex-1">
              <Progress pct={(done / steps.length) * 100} />
            </span>
            <span className="shrink-0 text-2xs font-semibold" style={{ color: v("--ux-muted") }}>
              {done} of {steps.length} done
            </span>
          </div>
        </div>
        <Btn href="/app/profile" variant="outline" size="sm" iconEnd="ArrowRight" className="max-lg:w-full max-lg:px-4">Complete profile</Btn>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Ways to earn                                                       */
/* ------------------------------------------------------------------ */

export const WAYS = [
  { id: "products", title: "Sell products", sub: "Handmade, home-based or sourced products.",
    icon: "Package", tint: "--ux-tint-pink", ink: "--ux-pink-ink",
    cta: "Add product", href: "/app/documents/new" },
  { id: "services", title: "Offer services", sub: "Stitching, mehendi, tuition, cooking, care.",
    icon: "Sparkles", tint: "--ux-tint-blue", ink: "--ux-blue-ink",
    cta: "Add service", href: "/app/documents/new" },
  { id: "orders", title: "Take orders", sub: "Get custom orders from customers.",
    icon: "ClipboardList", tint: "--ux-tint-amber", ink: "--ux-amber-ink",
    cta: "Manage orders", href: "/app/documents#orders" },
  { id: "together", title: "Collaborate", sub: "Work with other women on bigger orders.",
    icon: "UsersRound", tint: "--ux-tint-green", ink: "--ux-green-ink",
    cta: "Find opportunities", href: "/app/contracts" },
] as const;

export function WaysToEarn() {
  return (
    <section className="mb-6">
      <Head icon="Rocket" title="Ways to earn on WomSakhi"
            sub="Choose how you want to earn — or do it all!"
            more="View all" href="/app/documents/listings" />
      {/* One column on a phone, each way a row — icon, name, one line, and its
          button on the end, the App Store's list shape — rather than a 2x2 of
          168px cards with the words centred in a column of nothing. */}
      <div data-mobile-stack
           className="grid gap-3.5 max-lg:gap-0 max-lg:overflow-hidden max-lg:rounded-[16px] max-lg:border max-lg:border-[color:var(--ux-line)] max-lg:bg-[color:var(--ux-surface)]"
           style={{ gridTemplateColumns: "repeat(auto-fit, minmax(166px, 1fr))" }}>
        {WAYS.map((w) => (
          <Card key={w.id} pad={18}
                className={`flex h-full flex-col text-center max-lg:flex-row max-lg:items-center max-lg:gap-3 max-lg:text-start ${GROUP_ROW}`}>
            <span className="mx-auto max-lg:mx-0">
              <IconTile icon={w.icon} tint={w.tint} ink={w.ink} size={48} radius={14} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="mt-3 text-xsm font-bold max-lg:mt-0" style={{ color: v("--ux-ink") }}>{w.title}</p>
              <p className="mt-1.5 flex-1 text-xs leading-relaxed max-lg:mt-0.5 max-lg:text-[13px] max-lg:leading-snug" style={{ color: v("--ux-muted") }}>{w.sub}</p>
            </div>
            <div className="mt-4 max-lg:mt-0 max-lg:shrink-0">
              <Btn href={w.href} size="sm" variant="outline" full className="max-lg:w-auto">{w.cta}</Btn>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  A section heading, the wireframe's shape                           */
/* ------------------------------------------------------------------ */

export function Head({ icon, title, sub, more, href }: {
  icon: string; title: string; sub?: string; more?: string; href?: string;
}) {
  return (
    /* On a phone this is the quiet upper-case group label, not a second bold
       heading: the screen's one heavy line is its large title. */
    <div className="mb-2 flex items-end justify-between gap-3 lg:mb-3.5">
      <div className="flex min-w-0 items-start gap-2.5 max-lg:px-1">
        <I name={icon} className="mt-[3px] hidden h-[19px] w-[19px] shrink-0 lg:block" style={{ color: v("--ux-brand") }} />
        <span className="min-w-0">
          <h2 className="text-xs font-semibold uppercase leading-tight tracking-[0.06em] text-[color:var(--ux-muted)] lg:text-lg lg:font-extrabold lg:normal-case lg:tracking-[-0.01em] lg:text-[color:var(--ux-ink)]">
            {title}
          </h2>
          {sub && <span className="mt-1 block text-[13px] max-lg:leading-snug lg:mt-0.5 lg:text-xs" style={{ color: v("--ux-muted") }}>{sub}</span>}
        </span>
      </div>
      {more && href && (
        <Link href={href}
              className="ux-sq -me-2 flex min-h-[36px] shrink-0 items-center gap-0.5 rounded-[10px] px-2 text-[15px] font-semibold lg:text-xs lg:font-bold"
              style={{ color: v("--ux-brand") }}>
          {more} <Icons.ChevronRight className="h-[13px] w-[13px]" />
        </Link>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Recent activity                                                    */
/* ------------------------------------------------------------------ */

export interface Happening {
  id: string; title: string; what: string; when: string;
  amount?: string; photo?: string; icon: string; tint: string; ink: string; href: string;
}

export function Activity({ rows }: { rows: Happening[] }) {
  return (
    <section className="mb-6">
      <Head icon="Zap" title="Recent activity" more="View all" href="/app/documents#orders" />
      <Card pad={0} className="overflow-hidden">
        {rows.map((r) => (
          <Link key={r.id} href={r.href}
                className="ux-hov ux-sq flex items-center gap-3.5 border-b px-4 py-3 last:border-b-0"
                style={{ borderColor: v("--ux-line") }}>
            {r.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.photo} alt="" aria-hidden loading="lazy" decoding="async"
                   className="h-[44px] w-[44px] shrink-0 rounded-[12px] object-cover"
                   style={{ background: v("--ux-media-bed") }} />
            ) : (
              <IconTile icon={r.icon} tint={r.tint} ink={r.ink} size={44} radius={11} />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xsm font-bold" style={{ color: v("--ux-ink") }}>{r.title}</span>
              <span className="mt-0.5 block truncate text-xs" style={{ color: v("--ux-muted") }}>{r.what}</span>
            </span>
            <span className="shrink-0 text-end">
              {r.amount && (
                <span className="block text-xsm font-extrabold" style={{ color: v("--ux-green-ink") }}>
                  + {r.amount}
                </span>
              )}
              <span className="mt-0.5 block text-2xs" style={{ color: v("--ux-faint") }}>{r.when}</span>
            </span>
          </Link>
        ))}
      </Card>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Grow your income                                                   */
/* ------------------------------------------------------------------ */

export function GrowBanner() {
  return (
    <section className="relative mb-6 overflow-hidden rounded-[16px] lg:rounded-[20px]"
             style={{ background: "linear-gradient(100deg, var(--ux-tint-lilac), var(--ux-brand-tint) 58%, var(--ux-tint-pink))",
                      border: "1px solid var(--ux-line)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ux/art/scene-woman-planning-board.webp" alt="" aria-hidden loading="lazy" decoding="async"
           className="pointer-events-none absolute bottom-0 start-0 hidden h-full w-[26%] object-cover object-center sm:block"
           style={{ maskImage: "linear-gradient(268deg, transparent, #000 34%)",
                    WebkitMaskImage: "linear-gradient(268deg, transparent, #000 34%)" }} />
      <div className="relative z-[1] p-4 sm:ps-[30%] lg:p-6 lg:ps-[30%]">
        <h2 className="text-xl font-extrabold tracking-[-0.01em]" style={{ color: v("--ux-ink") }}>
          Grow your income with WomSakhi
        </h2>
        <p className="mt-1.5 text-xsm" style={{ color: v("--ux-ink-2") }}>
          Get tips, tools and personal guidance from Sakhi.
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Btn href="/app/programs" variant="outline" icon="Play" className="max-lg:w-full">Watch tutorial</Btn>
          <Btn href="/app/help" variant="outline" icon="MessageCircle" className="max-lg:w-full">Talk to Sakhi</Btn>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Rail: quick actions                                                */
/* ------------------------------------------------------------------ */

export const ACTIONS = [
  { label: "Add product",     icon: "Package",       tint: "--ux-tint-pink",   ink: "--ux-pink-ink",   href: "/app/documents/new" },
  { label: "Add service",     icon: "Sparkles",      tint: "--ux-tint-blue",   ink: "--ux-blue-ink",   href: "/app/documents/new" },
  { label: "Manage orders",   icon: "ClipboardList", tint: "--ux-tint-amber",  ink: "--ux-amber-ink",  href: "/app/documents#orders" },
  { label: "View earnings",   icon: "Wallet",        tint: "--ux-tint-blue",   ink: "--ux-blue-ink",   href: "/app/wallet" },
  { label: "Edit my store",   icon: "Store",         tint: "--ux-tint-green",  ink: "--ux-green-ink",  href: "/app/documents/listings" },
  { label: "Share my profile", icon: "Share2",       tint: "--ux-tint-violet", ink: "--ux-violet-ink", href: "/app/collect" },
] as const;

export function QuickActions() {
  return (
    <Card>
      <h2 className="mb-3 text-base font-extrabold" style={{ color: v("--ux-ink") }}>Quick actions</h2>
      <div className="space-y-1.5">
        {ACTIONS.map((a) => (
          <Link key={a.label} href={a.href}
                className="ux-hov ux-sq flex items-center gap-3 rounded-[12px] px-2.5 py-2.5"
                style={{ border: "1px solid var(--ux-line)" }}>
            <IconTile icon={a.icon} tint={a.tint} ink={a.ink} size={32} radius={9} />
            <span className="min-w-0 flex-1 truncate text-xsm font-semibold" style={{ color: v("--ux-ink") }}>
              {a.label}
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Rail: what actually sells                                          */
/* ------------------------------------------------------------------ */

export const SELL_TIPS = [
  { t: "Add clear photos",     s: "Products with photos get 3x more views",   icon: "Camera",        tint: "--ux-tint-violet", ink: "--ux-violet-ink" },
  { t: "Write detailed descriptions", s: "Tell your story and be clear about pricing", icon: "FileText", tint: "--ux-tint-green", ink: "--ux-green-ink" },
  { t: "Respond quickly",      s: "Build trust with faster replies",          icon: "MessageSquare", tint: "--ux-tint-pink",   ink: "--ux-pink-ink" },
  { t: "Share on WhatsApp",    s: "Invite friends and family to support your work", icon: "Share2",  tint: "--ux-tint-green",  ink: "--ux-green-ink" },
] as const;

export function SellTips() {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-extrabold" style={{ color: v("--ux-ink") }}>
          <I name="Lightbulb" className="h-[17px] w-[17px]" style={{ color: v("--ux-amber-ink") }} />
          Tips for more sales
        </h2>
        <Link href="/app/shop/pricing"
              className="ux-sq -me-2 flex min-h-[36px] items-center rounded-[10px] px-2 text-xs font-bold"
              style={{ color: v("--ux-brand") }}>
          See all
        </Link>
      </div>
      <div className="space-y-3">
        {SELL_TIPS.map((x, i) => (
          <div key={x.t} className="flex items-start gap-2.5 border-b pb-3 last:border-b-0 last:pb-0"
               style={{ borderColor: i === SELL_TIPS.length - 1 ? "transparent" : v("--ux-line") }}>
            <IconTile icon={x.icon} tint={x.tint} ink={x.ink} size={30} radius={9} />
            <span className="min-w-0">
              <span className="block text-xs font-bold" style={{ color: v("--ux-ink") }}>{x.t}</span>
              <span className="mt-0.5 block text-2xs leading-snug" style={{ color: v("--ux-muted") }}>{x.s}</span>
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Rail: a woman who did it                                           */
/* ------------------------------------------------------------------ */

export function SuccessStory() {
  return (
    <section className="relative overflow-hidden rounded-[16px] p-[18px]"
             style={{ background: "linear-gradient(150deg, var(--ux-tint-lilac), var(--ux-tint-pink))" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ux/art/scene-women-celebrating.webp" alt="" aria-hidden loading="lazy" decoding="async"
           className="pointer-events-none absolute bottom-0 end-0 h-[150px] w-[104px] object-cover object-top"
           style={{ maskImage: "linear-gradient(105deg, transparent, #000 40%)",
                    WebkitMaskImage: "linear-gradient(105deg, transparent, #000 40%)" }} />
      <div className="relative w-[62%]">
        <h2 className="text-smd font-extrabold leading-tight" style={{ color: v("--ux-ink") }}>
          Sakhi Success Stories
        </h2>
        <blockquote className="mt-2.5 text-xs leading-relaxed" style={{ color: v("--ux-ink-2") }}>
          &ldquo;I started with mehendi services, now I earn ₹25,000+ every month!&rdquo;
        </blockquote>
        <p className="mt-1.5 text-2xs font-semibold" style={{ color: v("--ux-muted") }}>— Neha, Jaipur</p>
      </div>
      <div className="relative mt-4">
        <Btn href="/app/stories" size="sm" variant="outline" iconEnd="ArrowRight">Read more stories</Btn>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Rail: someone to ask                                               */
/* ------------------------------------------------------------------ */

export function NeedHelp() {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <IconTile icon="Heart" tint="--ux-tint-pink" ink="--ux-pink-ink" size={38} radius={11} />
        <div className="min-w-0">
          <p className="text-xsm font-extrabold" style={{ color: v("--ux-brand") }}>Need help?</p>
          <p className="mt-0.5 text-xs" style={{ color: v("--ux-muted") }}>
            Our Sakhi team is here for you.
          </p>
        </div>
      </div>
      <div className="mt-3.5">
        <Btn href="/app/help" size="sm" variant="outline" full iconEnd="ArrowRight">Ask Sakhi</Btn>
      </div>
    </Card>
  );
}
