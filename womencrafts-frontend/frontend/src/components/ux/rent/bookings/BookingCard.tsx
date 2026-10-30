"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";

import { I, v } from "@/components/ux/kit";
import { formatMoney } from "@/components/ux/kit/money";
import { STATUS_LOOK, type Booking } from "@/lib/rentals-api";
import { day, nextFor } from "./look";

/**
 * One booking in "My rentals": the thing, the other woman, the dates, where it
 * stands — and, lit up, the one thing for her to do next.
 */
export function BookingCard({ b }: { b: Booking }) {
  const look = STATUS_LOOK[b.status];
  const next = nextFor(b);
  const shut = !look.open;
  return (
    <Link href={`/app/rent/bookings/${b.id}`}
          className="ux-press ux-hov block overflow-hidden rounded-[18px] border"
          style={{ borderColor: next?.urgent ? v("--ux-brand") : v("--ux-line"), background: v("--ux-surface"), boxShadow: "var(--ux-shadow-card)" }}>
      <div className="flex gap-3 p-3 sm:p-3.5">
        <span className="relative h-[84px] w-[84px] shrink-0 overflow-hidden rounded-[14px]" style={{ background: v("--ux-surface-2") }}>
          {b.item.photo
            ? <img src={b.item.photo} alt="" loading="lazy" className="h-full w-full object-cover" style={{ filter: shut ? "grayscale(.7)" : undefined }} />
            : <span className="grid h-full place-items-center" style={{ color: v("--ux-faint") }}><I name="Package" className="h-7 w-7" /></span>}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-2">
            <b className="min-w-0 flex-1 truncate text-sm" style={{ color: v("--ux-ink") }}>{b.item.title}</b>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-bold"
                  style={b.status === "closed"
                    ? { background: v("--ux-tint-green"), color: v("--ux-green-ink") }
                    : shut ? { background: v("--ux-surface-2"), color: v("--ux-muted") } : { background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
              <I name={look.icon} className="h-3 w-3" /> {look.label}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-xs" style={{ color: v("--ux-muted") }}>
            {b.side === "renter" ? `From ${b.with.first_name}` : `To ${b.with.first_name}`}
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: v("--ux-ink-2") }}>
            <span className="inline-flex items-center gap-1"><I name="CalendarRange" className="h-3.5 w-3.5" style={{ color: v("--ux-brand") }} />
              {day(b.start)} – {day(b.end)} · {b.days} {b.days === 1 ? "day" : "days"}</span>
            <span className="inline-flex items-center gap-1 font-bold"><I name="Wallet" className="h-3.5 w-3.5" style={{ color: v("--ux-brand") }} />
              {formatMoney(b.rent_minor)}</span>
          </span>
        </span>
      </div>
      {next && (
        <span className="flex items-center gap-2 border-t px-3.5 py-2.5 text-xs font-bold"
              style={next.urgent
                ? { borderColor: "transparent", background: "var(--ux-pic-ground)", color: "#fff" }
                : { borderColor: v("--ux-line"), background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
          <I name={next.icon} className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{next.text}</span>
          <I name="ChevronRight" className="h-4 w-4 shrink-0" />
        </span>
      )}
    </Link>
  );
}
