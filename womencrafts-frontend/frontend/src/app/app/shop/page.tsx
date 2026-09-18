"use client";

import { useCallback } from "react";
import Link from "next/link";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, I, IconTile, Stat, v } from "@/components/ux/kit";
import { EYEBROW, GROUP, Section } from "@/components/ux/earn/phone";
import { formatRupees } from "@/components/ux/kit";
import { apiShopSummary, type ShopSummary } from "@/lib/shop-api";
import { useResource } from "@/lib/use-resource";
import { useT } from "@/i18n";

/**
 * Ways to sell.
 *
 * ── What this screen used to do, and why it had to stop ─────────────────────
 * The headline was `formatRupees(monthTotal(STREAMS))` — ₹28,000 "this month" —
 * summed from three invented shopfronts in `@/components/ux/shopplus/data`
 * ("Priya Tailoring, ₹18,400, 23 orders"). Beneath it sat three more figures
 * about her money: ₹6.19 lakh "paid to you before you started", ₹5,200 "already
 * paid for next month", and a count of "buyers with a standing order" — every
 * one of them a sum over rows nobody had ever created. The open/close switch on
 * each trade set React state and announced *"Priya's Kitchen is closed. Your
 * customers see 'back soon'"* to customers who did not exist, and "Another
 * trade" printed a sentence and added nothing.
 *
 * The tiles carried invented badges too: "3 waiting", "1 new", "2 too low" —
 * counts computed from the same fixture, which is what made them feel like the
 * app knew something about her week.
 *
 * ── What it does now ────────────────────────────────────────────────────────
 * One shop, because that is what the server holds. `GET /shop/summary` is hers:
 * what she has taken this month, what she took last month, how many things she
 * has listed, and how many orders are waiting on her. Nothing on this screen is
 * derived from anything else.
 *
 * ── And the tiles are split in two, honestly ────────────────────────────────
 * Seven of the ten things this menu offered are not built. Leaving them mixed
 * in with the three that work is how a woman ends up believing she has a
 * standing-order book. So they sit under their own heading, labelled as what
 * they are — and each one now opens a screen that says plainly what WomSakhi
 * cannot do and what she can do about it herself today. That is worth keeping;
 * a 404 is not.
 */

/** Things that do what the tile says. */
const WORKING = [
  { href: "/app/documents", icon: "Store", label: "What you sell, and your orders",
    note: "Add a piece, change a price, move an order along", tint: "--ux-tint-pink", ink: "--ux-pink-ink" },
  { href: "/app/shop/buyers", icon: "Handshake", label: "Who comes back",
    note: "Folded out of the orders you have written down", tint: "--ux-tint-blue", ink: "--ux-blue-ink" },
  { href: "/app/shop/pricing", icon: "Tag", label: "What you charge",
    note: "Every price you have set, side by side", tint: "--ux-tint-amber", ink: "--ux-amber-ink" },
  { href: "/app/collect", icon: "Landmark", label: "Getting paid",
    note: "Your shop link, and where money reaches you", tint: "--ux-tint-green", ink: "--ux-green-ink" },
  { href: "/app/contracts", icon: "Briefcase", label: "Big orders from real buyers",
    note: "Bulk orders placed with us — applying is real", tint: "--ux-tint-violet", ink: "--ux-violet" },
  { href: "/app/kitchen", icon: "ChefHat", label: "Selling food from home",
    note: "The licence is one hundred rupees a year", tint: "--ux-tint-orange", ink: "--ux-orange-ink" },
];

/** Ideas with nothing behind them yet. Each screen says so, and says what to do instead. */
const NOT_YET = [
  { href: "/app/shop/preorders", icon: "HandCoins", label: "Money before you buy cloth",
    note: "How to ask a buyer to pay for the materials" },
  { href: "/app/shop/subscriptions", icon: "Repeat", label: "Customers who pay every month",
    note: "How to turn a weekly customer into a monthly one" },
  { href: "/app/shop/wholesale", icon: "Boxes", label: "Selling to shops",
    note: "What to ask before you take a big order" },
  { href: "/app/shop/live", icon: "Radio", label: "Show and sell",
    note: "How to do it on WhatsApp this Saturday" },
  { href: "/app/shop/slots", icon: "CalendarDays", label: "Selling your time",
    note: "Your listed services, and how to hold a diary" },
  { href: "/app/shop/voice", icon: "Mic", label: "Speaking instead of typing",
    note: "Where the microphone on your own keyboard is" },
  { href: "/app/shop/disputes", icon: "Scale", label: "When something goes wrong",
    note: "How to settle it with a woman you both know" },
];

export default function ShopHub() {
  const tr = useT();

  const shop = useResource(
    useCallback((s: AbortSignal) => apiShopSummary(s), []),
    null as ShopSummary | null,
  );
  /** True only when the server actually answered. A null from a failure is not an answer. */
  const s = shop.source === "live" ? shop.data : null;

  return (
    <HomeShell active="/app/shop">
      <div className="flex flex-col gap-6 lg:gap-5">

        <header className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1">
            <p className={EYEBROW}>{tr("shop.yourShops")}</p>
            {/*
              Her month, from the server, or a dash.

              Never ₹0 while the request is still out: "you have taken nothing"
              and "we have not asked yet" are different sentences, and only one
              of them is true at that moment.
            */}
            <h1 className="ux-screen-title mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
                style={{ color: v("--ux-ink") }}>
              {s ? `${formatRupees(s.month_minor)} this month` : "Your shop"}
            </h1>
            <p className="mt-1.5 max-w-[54ch] text-[15px] leading-snug lg:text-sm lg:leading-relaxed"
               style={{ color: v("--ux-muted") }}>
              {s
                ? s.last_month_minor > 0
                  ? `From the orders you have written down. Last month it was ${formatRupees(s.last_month_minor)}.`
                  : "From the orders you have written down. An order you took in cash and never recorded is not in this."
                : shop.error
                  ? "We could not reach WomSakhi just now, so your figures are not showing."
                  : "Loading your shop…"}
            </p>
          </div>
          <Btn variant="outline" icon="Store" href="/app/documents" className="max-lg:w-full">{tr("shop.whatYouSell")}</Btn>
        </header>

        {/* Three facts the server holds about her shop. No derived money. */}
        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat value={s ? String(s.needs_her) : "—"} label="orders waiting on you"
                  icon="Clock" tint="--ux-tint-amber" ink="--ux-amber-ink" />
            <Stat value={s ? String(s.listings) : "—"} label="things listed in your shop"
                  icon="Package" tint="--ux-tint-pink" ink="--ux-pink-ink" />
            <Stat value={s && s.review_count > 0 ? String(s.review_count) : "—"}
                  label="customers have left a review"
                  icon="MessageSquare" tint="--ux-tint-blue" ink="--ux-blue-ink" />
          </div>
          <div className="mt-4 flex items-start gap-2.5 border-t pt-3.5" style={{ borderColor: v("--ux-line") }}>
            <I name="Info" className="mt-[2px] h-[15px] w-[15px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              One shopfront, because that is what WomSakhi keeps. If you do two trades — stitching
              and mehendi, tailoring and tiffin — list both here; separate shopfronts for separate
              trades is something we would like to build and have not.
            </p>
          </div>
        </Card>

        <div>
          <Section title="What works today" icon="Sparkles"
                       sub="These do what they say" />
          {/* A phone gets these as one grouped list of destinations. */}
          <div className={`grid gap-3 md:grid-cols-2 lg:grid-cols-3 ${GROUP}`}>
            {WORKING.map((t) => (
              <Link key={t.href} href={t.href}
                    className="ux-press ux-sq flex items-start gap-3.5 rounded-[var(--ux-r-card)] border p-4 text-left max-lg:rounded-none max-lg:border-x-0 max-lg:border-b-0 max-lg:first:border-t-0"
                    style={{ borderColor: v("--ux-line"), background: v("--ux-surface") }}>
                <IconTile icon={t.icon} tint={t.tint} ink={t.ink} size={42} radius={12} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold leading-snug" style={{ color: v("--ux-ink") }}>{t.label}</p>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>{t.note}</p>
                </div>
                <I name="ChevronRight" className="mt-1 h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-faint") }} />
              </Link>
            ))}
          </div>
        </div>

        {/*
          The other seven, named as what they are.

          They are kept, and kept reachable, because each one describes
          something she can go and do on WhatsApp this week — and because a
          screen that says "this is not ready, here is what it will do" is worth
          more than a dead link and far more than a fixture.
        */}
        <div>
          <Section title="Not built yet" icon="Hammer"
                       sub="Ideas we have written down but not made. Each one explains what you can do yourself in the meantime." />
          <Card pad={0} style={{ overflow: "hidden" }}>
            {NOT_YET.map((t, i) => (
              <Link key={t.href} href={t.href}
                    className="ux-press flex items-center gap-3.5 px-4 py-4 lg:px-5"
                    style={{ borderTop: i === 0 ? "none" : `1px solid ${v("--ux-line")}` }}>
                <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px]"
                      style={{ background: v("--ux-surface-2"), color: v("--ux-muted") }}>
                  <I name={t.icon} className="h-[17px] w-[17px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{t.label}</p>
                  <p className="mt-0.5 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>{t.note}</p>
                </div>
                <I name="ChevronRight" className="h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-faint") }} />
              </Link>
            ))}
          </Card>
          <p className="mt-2 px-1 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>
            These screens used to show orders, customers and takings that were not yours. They
            showed nothing of yours, because there was nothing of yours to show — so now they say so.
          </p>
        </div>
      </div>
    </HomeShell>
  );
}
