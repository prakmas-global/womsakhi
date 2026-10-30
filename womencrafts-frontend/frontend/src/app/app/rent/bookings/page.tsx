"use client";

import { useCallback, useState } from "react";

import { Btn, Card, EmptyState, I, v } from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { ScreenHead, Segments } from "@/components/ux/learning/native";
import { BookingCard } from "@/components/ux/rent/bookings/BookingCard";
import { RentSafety } from "@/components/ux/rent/bookings/parts";
import { isNow, nextFor } from "@/components/ux/rent/bookings/look";
import { useResource } from "@/lib/use-resource";
import { apiRentalBookings, type Booking } from "@/lib/rentals-api";

/**
 * My rentals — everything she is renting, and everything rented from her
 * (backend: routes/rentals.py).
 *
 * "Now" first: anything with a step still to take, the ones waiting on HER
 * at the very top, lit up. "Past" below, quiet. A tab narrows it to one
 * side when she both rents and rents out.
 */

const TABS = ["All", "Renting", "Rented out"];

export default function RentBookingsPage() {
  const [tab, setTab] = useState("All");
  const list = useResource(useCallback((s: AbortSignal) => apiRentalBookings("all", s), []), [] as Booking[]);

  const shown = list.data.filter((b) => tab === "All" || (tab === "Renting" ? b.side === "renter" : b.side === "owner"));
  // Waiting on her first, then the rest of what is still going.
  const now = shown.filter(isNow).sort((a, b) => Number(Boolean(nextFor(b)?.urgent)) - Number(Boolean(nextFor(a)?.urgent)));
  const past = shown.filter((b) => !isNow(b));
  const waiting = list.data.filter((b) => nextFor(b)?.urgent).length;

  return (
    <HomeShell rail={<div className="space-y-4"><RentSafety /></div>}>
      <ScreenHead title="My rentals"
                  sub={waiting ? `${waiting} ${waiting === 1 ? "needs" : "need"} you now.` : "What you rent, and what you rent out — every step."}>
        <Segments items={TABS} active={tab} onChange={setTab} label="Show" />
      </ScreenHead>

      {list.source === "loading" && !list.data.length ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <span key={i} className="ux-skeleton block h-[124px] rounded-[18px]" />)}</div>
      ) : !shown.length ? (
        <Card>
          <EmptyState icon="KeyRound"
                      title={tab === "Rented out" ? "Nothing rented out yet" : "No rentals yet"}
                      body={tab === "Rented out"
                        ? "Put up something you own — a lehenga, a big cooker, a sewing machine — and women near you can rent it."
                        : "Borrow what you need for a few days from verified women near you, instead of buying it."}
                      action={tab === "Rented out"
                        ? <Btn href="/app/rent/new" icon="Plus">Rent something out</Btn>
                        : <Btn href="/app/rent" icon="Search">See what you can rent</Btn>} />
        </Card>
      ) : (
        <div className="space-y-6">
          {now.length > 0 && (
            <section aria-labelledby="rent-now">
              <h2 id="rent-now" className="mb-2.5 flex items-center gap-2 text-base font-bold" style={{ color: v("--ux-ink") }}>
                <I name="Zap" className="h-4 w-4" style={{ color: v("--ux-brand") }} /> Now
              </h2>
              <div className="grid gap-3 lg:grid-cols-2">{now.map((b) => <BookingCard key={b.id} b={b} />)}</div>
            </section>
          )}
          {past.length > 0 && (
            <section aria-labelledby="rent-past">
              <h2 id="rent-past" className="mb-2.5 flex items-center gap-2 text-base font-bold" style={{ color: v("--ux-ink") }}>
                <I name="History" className="h-4 w-4" style={{ color: v("--ux-muted") }} /> Past
              </h2>
              <div className="grid gap-3 lg:grid-cols-2">{past.map((b) => <BookingCard key={b.id} b={b} />)}</div>
            </section>
          )}
        </div>
      )}
    </HomeShell>
  );
}
