"use client";

import Link from "next/link";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, I, IconTile, v } from "@/components/ux/kit";
import { ScreenHead } from "@/components/ux/learning/native";

/**
 * Selling tools — part of My shop.
 *
 * This used to be "Ways to sell", a second shop home beside My shop: it
 * repeated her month's takings and order counts, linked to screens that
 * already had their own place in the menu, and listed seven trackers under
 * "Not built yet" long after they were built. Two homes for one shop meant
 * she never knew which to open.
 *
 * Now My shop is the one home (orders, listings, takings) and this page holds
 * only what My shop does not: two views worked out from her orders, and seven
 * small notebooks for the parts of selling that happen on WhatsApp — each one
 * saved to `/shop/operations` and filled mostly by tapping, not typing.
 */

// The shop's own pages. They left the Earn menu (My shop lives under My
// services now) and are reached from here and from My shop's quick actions.
const INSIGHTS = [
  { href: "/app/collect", icon: "QrCode", label: "My link, and getting paid",
    note: "Your shop link and QR for buyers not on WomSakhi", tint: "--ux-tint-green", ink: "--ux-green-ink" },
  { href: "/app/documents/vault", icon: "FileText", label: "My shop papers",
    note: "Licences, Udyam and proof — kept in one place", tint: "--ux-tint-violet", ink: "--ux-violet" },
  { href: "/app/kitchen", icon: "ChefHat", label: "Selling food from home",
    note: "The ₹100 licence and kitchen checks, step by step", tint: "--ux-tint-orange", ink: "--ux-orange-ink" },
  { href: "/app/shop/buyers", icon: "Handshake", label: "Who buys from you",
    note: "Your returning customers, from your orders", tint: "--ux-tint-blue", ink: "--ux-blue-ink" },
  { href: "/app/shop/pricing", icon: "Tag", label: "What you charge",
    note: "Every price you have set, side by side", tint: "--ux-tint-amber", ink: "--ux-amber-ink" },
];

const TOOLS = [
  { href: "/app/shop/preorders", icon: "HandCoins", label: "Advance for materials",
    note: "Money a buyer pays before you buy cloth", tint: "--ux-tint-pink", ink: "--ux-pink-ink" },
  { href: "/app/shop/subscriptions", icon: "Repeat", label: "Monthly customers",
    note: "Tiffin, tuition — who has paid this month", tint: "--ux-tint-green", ink: "--ux-green-ink" },
  { href: "/app/shop/slots", icon: "CalendarDays", label: "My appointments",
    note: "Fittings, mehendi, classes — one diary", tint: "--ux-tint-violet", ink: "--ux-violet" },
  { href: "/app/shop/wholesale", icon: "Boxes", label: "Big orders",
    note: "Twenty pieces to one buyer — quote to delivery", tint: "--ux-tint-orange", ink: "--ux-orange-ink" },
  { href: "/app/shop/live", icon: "Radio", label: "Show and sell",
    note: "Plan a sale on WhatsApp or Instagram", tint: "--ux-tint-blue", ink: "--ux-blue-ink" },
  { href: "/app/shop/voice", icon: "Mic", label: "Speak a listing",
    note: "Say it in your language, check it, then list it", tint: "--ux-tint-amber", ink: "--ux-amber-ink" },
  { href: "/app/shop/disputes", icon: "Scale", label: "When something goes wrong",
    note: "A private record to settle it fairly", tint: "--ux-tint-pink", ink: "--ux-pink-ink" },
];

function Tile({ t }: { t: (typeof TOOLS)[number] }) {
  return (
    <Link href={t.href}
          className="ux-press ux-sq flex items-start gap-3.5 rounded-[var(--ux-r-card)] border p-4 text-left"
          style={{ borderColor: v("--ux-line"), background: v("--ux-surface") }}>
      <IconTile icon={t.icon} tint={t.tint} ink={t.ink} size={42} radius={12} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-snug" style={{ color: v("--ux-ink") }}>{t.label}</p>
        <p className="mt-1 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>{t.note}</p>
      </div>
      <I name="ChevronRight" className="mt-1 h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-faint") }} />
    </Link>
  );
}

export default function SellingTools() {
  return (
    <HomeShell active="/app/shop">
      <Back to="/app/documents" label="My shop" className="mb-4" />
      <ScreenHead title="Selling tools"
                  sub="Small notebooks for the selling that happens on WhatsApp and at your door. Tap to fill — very little typing." />

      <h2 className="mb-2.5 text-xs font-bold uppercase tracking-[0.08em]" style={{ color: v("--ux-faint") }}>Run your shop</h2>
      <div className="mb-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {INSIGHTS.map((t) => <Tile key={t.href} t={t} />)}
      </div>

      <h2 className="mb-2.5 text-xs font-bold uppercase tracking-[0.08em]" style={{ color: v("--ux-faint") }}>Keep track</h2>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((t) => <Tile key={t.href} t={t} />)}
      </div>
    </HomeShell>
  );
}
