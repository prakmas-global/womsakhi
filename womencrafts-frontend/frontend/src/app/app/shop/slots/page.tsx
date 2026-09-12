"use client";

import { useCallback, useMemo } from "react";

import { Btn, Card, I, Pill, SectionHead, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import { NotYetScreen } from "@/components/ux/shopplus/notyet";
import { apiListings, type Listing } from "@/lib/shop-api";
import { useResource } from "@/lib/use-resource";

/**
 * Sell your time, not just things.
 *
 * ── What this screen used to do, and why it had to stop ─────────────────────
 * A week-grid — three days across, four times down — built from eight slots in
 * `@/components/ux/eight/data`. It told her that Sunita Devi was coming at
 * 10:00 **today** for a blouse fitting and that Meera Joshi had booked three
 * hours of bridal mehendi tomorrow at 11:00. Neither woman had booked anything.
 * Tapping an empty square said "Added 15:00 tomorrow" and added nothing;
 * "Repeat next week" said "Same times added to next week" and did nothing at
 * all; closing a time promised "Nobody is told why" about a time no customer
 * could ever have seen.
 *
 * A diary is the one screen where a fixture is unambiguously dangerous: she
 * could plan her actual Tuesday around an appointment that does not exist, or
 * miss a real one because the grid looked full.
 *
 * There is no slots collection and no booking router that points at her —
 * `/me/bookings` is for HER booking a WomSakhi service, in the other direction.
 *
 * ── What is real, and stays ─────────────────────────────────────────────────
 * The services she has actually listed. Those come from `GET /shop/listings`,
 * they are hers, and they are the half of this screen that was never invented:
 * what she sells by the hour or by the visit, and what she asks for it.
 */
export default function SlotsPage() {
  const listings = useResource(
    useCallback((s: AbortSignal) => apiListings(s), []),
    [] as Listing[],
  );

  /** Her time, as opposed to her things. Only what the server actually sent. */
  const services = useMemo(
    () => listings.data.filter((l) => l.kind === "service"),
    [listings.data],
  );
  const known = listings.source === "live";

  return (
    <NotYetScreen
      eyebrow="Your week"
      title="Sell your time, not just things"
      lede="Half of what women here sell is time — a fitting, mehendi, tuition, a house call. A shop
            built only around stock cannot hold any of it."
      cannot="WomSakhi cannot take a booking for your time yet."
      why="Nobody can pick an hour from you here, nothing holds your week, and there is no diary
           behind this screen. What used to be drawn here — 'Sunita Devi, 10:00 today' — was made
           up, and a made-up appointment in a real week is worse than no diary at all."
      today={[
        {
          what: "Put the hours you are free into the listing itself, in the description. It is the first thing anyone reads and it stops the whole 'when are you free?' conversation.",
          say: "Fittings: weekdays 10–12 and 4–6. Sunday closed. Message me the day before.",
        },
        {
          what: "Write appointments in one place — a notebook by the machine is completely fine. One place, not three, and not only in your head.",
        },
        {
          what: "Send the day and the time back to the customer in a message, so there is a written version you can both look at.",
          say: "That is fixed — Thursday 4pm, at my place. If something changes, tell me the day before and it is no problem.",
        },
        {
          what: "When you cannot work, you do not owe anyone a reason. Say the time has gone and offer another one.",
        },
      ]}
      later={[
        "Show your week as a grid, so you can see the gap — the gap is the thing you are trying to sell.",
        "Let a customer take a free hour herself, from your shop link, without messaging you first.",
        "Let you close a time in one tap, with no reason field and nothing shown to a customer except that the hour has gone.",
      ]}
      footer={
        <>
          <Btn variant="outline" size="sm" icon="Store" href="/app/documents">What you sell</Btn>
          <Btn variant="ghost" size="sm" icon="MessageCircle" href="/app/messages">Your messages</Btn>
        </>
      }
    >
      {/*
        The one real thing on this screen. Rendered only when the server has
        actually answered — an empty list from a failed request would read as
        "you offer no services", which is a different statement from "we could
        not ask".
      */}
      {known && services.length > 0 && (
        <div>
          <SectionHead title="The time you already sell" icon="Clock"
                       sub="From what you have listed in your shop — not a diary"
                       chip={String(services.length)} />
          <Card pad={0} style={{ overflow: "hidden" }}>
            {services.map((s, i) => (
              <div key={s.id} className="flex flex-wrap items-center gap-3.5 px-5 py-4"
                   style={{ borderTop: i === 0 ? "none" : `1px solid ${v("--ux-line")}` }}>
                <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px]"
                      style={{ background: v("--ux-tint-blue"), color: v("--ux-blue-ink") }}>
                  <I name="Clock" className="h-[17px] w-[17px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{s.title}</p>
                  <p className="mt-0.5 text-xs" style={{ color: v("--ux-muted") }}>
                    {s.price_minor > 0
                      ? `${formatRupees(s.price_minor)}${s.rate ? ` ${s.rate}` : ""}`
                      : "You have not set a price for this"}
                  </p>
                </div>
                {s.status !== "live" && <Pill tone="neutral" size="sm">Paused</Pill>}
              </div>
            ))}
          </Card>
          <p className="mt-2 px-1 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>
            These are yours, from your shop. Nobody has booked any of them through WomSakhi, because
            nobody can yet.
          </p>
        </div>
      )}
    </NotYetScreen>
  );
}
